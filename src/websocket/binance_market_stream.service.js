const WebSocket = require("ws");

const marketEvents = require(
  "../services/trading/market_event.service"
);

const {  depthConnections,
    depthRequirements,
    createDepthStream, } = require("./depth/depth.stream");

    const {
        bookTickerRequirements,
        createBookTickerStream,
      } = require("./bookTicker/bookTicker.stream");

      const {
        markPriceRequirements,
        createMarkPriceStream,
      } = require("./markPrice/markPrice.stream");


      const {
        tickerRequirements,
        createTickerStream,
      } = require("./ticker/ticker.stream");


      const {
        sharedDataRequirements,
        createSharedMarketDataStream,
      } = require("./sharedMarketData/sharedMarketData.stream");
// ==================================================
// CONFIG
// ==================================================

const BINANCE_WS_BASE_URL = "wss://fstream.binance.com";

const PUBLIC_WS_URL =
  `${BINANCE_WS_BASE_URL}/public/stream`;

const MARKET_WS_URL =
  `${BINANCE_WS_BASE_URL}/market/stream`;

// Binance currently allows up to 1024 streams
// per connection.
//


// We keep a safety margin so we don't run right
// against the Binance limit.
const MAX_STREAMS_PER_CONNECTION = 900;

const RECONNECT_INITIAL_DELAY = 1000;
const RECONNECT_MAX_DELAY = 30000;

const STALE_PRICE_THRESHOLD = 5000;

// Time to wait after nobody needs a symbol
// before actually unsubscribing.
// const SYMBOL_RELEASE_GRACE_MS = 5*60*1000;
const SYMBOL_RELEASE_GRACE_MS = 10000;


const LOG_CONNECTION_EVENTS = true;

// ==================================================
// RUNTIME STATE
// ==================================================

// bookTicker connections
const publicConnections = new Map();

// markPrice connections
const marketConnections = new Map();

// ticker connections
const tickerConnections = new Map();

// symbol -> market data
const marketData = new Map();

// --------------------------------------------------
// Symbol requirement manager
//
// Example:
//
// BTCUSDT
//   chart: 2
//   position: 1
//   tpSl: 0
//
// Total = 3
// --------------------------------------------------

const symbolRequirements = new Map();

/*
{
  BTCUSDT: {
    chart: 2,
    position: 1,
    tpSl: 0,
    generic: 0,
    releaseTimer: Timeout|null
  }
}
*/

// ==================================================
// GLOBAL STATE
// ==================================================

let nextConnectionId = 1;

let requestId = 1;

const pendingRequests = new Map();

let manuallyDisconnected = false;

// ==================================================
// HELPERS
// ==================================================

const normalizeSymbol = (symbol) => {
  return String(symbol || "")
    .trim()
    .toUpperCase();
};

const normalizeReason = (reason) => {
  return String(reason || "generic")
    .trim()
    .toLowerCase();
};

const ensureSymbol = (symbol) => {
  const normalizedSymbol =
    normalizeSymbol(symbol);

  if (!normalizedSymbol) {
    return null;
  }

  if (!marketData.has(normalizedSymbol)) {
    marketData.set(
      normalizedSymbol,
      createMarketRecord(normalizedSymbol)
    );
  }

  return normalizedSymbol;
};

const createMarketRecord = (symbol) => ({
  symbol,

  //book ticker
  bidPrice: null,
  bidQuantity: null,
  askPrice: null,
  askQuantity: null,

//mark price
  markPrice: null,
  indexPrice: null,
  fundingRate: null,

  // 24H ticker
  lastPrice: null,
  priceChange: null,
  priceChangePercent: null,
  weightedAveragePrice: null,
  openPrice: null,
  highPrice: null,
  lowPrice: null,
  volume: null,
  quoteVolume: null,
  tradeCount: null,

  eventTime: null,
  transactionTime: null,
  updatedAt: null,

  connected: false,
});

// ==================================================
// CONNECTION STATE
// ==================================================

const createConnectionState = (
  id,
  type
) => ({
  id,
  type,

  // Symbols assigned to this connection
  symbols: new Set(),

  // Streams currently believed to be subscribed
  subscribedSymbols: new Set(),

  socket: null,

  reconnectTimer: null,

  reconnectAttempts: 0,

  manuallyClosed: false,
});

// ==================================================
// BINANCE STREAM NAMES
// ==================================================

const getStreamName = (
  symbol,
  streamType
) => {
  const normalized =
    normalizeSymbol(symbol).toLowerCase();

  if (streamType === "bookTicker") {
    return `${normalized}@bookTicker`;
  }

  if (streamType === "markPrice") {
    return `${normalized}@markPrice@1s`;
  }

  if(streamType == "ticker"){
    return `${normalized}@ticker`;
  }

  if (streamType === "depth") {
    return `${normalized}@depth20@100ms`;
  }

  throw new Error(
    `Unknown stream type: ${streamType}`
  );
};

// ==================================================
// REQUEST ID
// ==================================================

const getRequestId = () => {
  const id = requestId;

  requestId++;

  if (requestId > 2147483647) {
    requestId = 1;
  }

  return id;
};


const subscribeSymbols = (
  connection,
  symbols
) => {
  if (!connection.socket) {
    return;
  }

  if (
    connection.socket.readyState !==
    WebSocket.OPEN
  ) {
    return;
  }

  if (!symbols.length) {
    return;
  }

  const streams =
    symbols.map((symbol) =>
      getStreamName(
        symbol,
        connection.type
      )
    );

    const id = getRequestId();

    const payload = {
      method: "SUBSCRIBE",
      params: streams,
      id,
    };
    
    pendingRequests.set(id, {
      action: "SUBSCRIBE",
      type: connection.type,
      symbols,
    });


  try {
    connection.socket.send(
      JSON.stringify(payload)
    );

    symbols.forEach((symbol) => {
      connection.subscribedSymbols.add(
        symbol
      );
    });

    if (LOG_CONNECTION_EVENTS) {
      console.log(
        `📡 SUBSCRIBE ${connection.type} ${connection.id}:`,
        symbols.join(", ")
      );
    }
  } catch (error) {
    console.error(
      `❌ Subscribe failed for ${connection.type}:`,
      error.message
    );
  }
};

// ==================================================
// SEND UNSUBSCRIBE
// ==================================================

const unsubscribeSymbols = (
  connection,
  symbols
) => {
  if (!connection.socket) {
    return;
  }

  if (
    connection.socket.readyState !==
    WebSocket.OPEN
  ) {
    return;
  }

  if (!symbols.length) {
    return;
  }

  const streams =
    symbols.map((symbol) =>
      getStreamName(
        symbol,
        connection.type
      )
    );

    const id = getRequestId();

    const payload = {
      method: "UNSUBSCRIBE",
      params: streams,
      id,
    };
    
    pendingRequests.set(id, {
      action: "UNSUBSCRIBE",
      type: connection.type,
      symbols,
    });  

  try {
    connection.socket.send(
      JSON.stringify(payload)
    );

    symbols.forEach((symbol) => {
      connection.subscribedSymbols.delete(
        symbol
      );
    });

    if (LOG_CONNECTION_EVENTS) {
      console.log(
        `📴 UNSUBSCRIBE ${connection.type} ${connection.id}:`,
        symbols.join(", ")
      );
    }
  } catch (error) {
    console.error(
      `❌ Unsubscribe failed for ${connection.type}:`,
      error.message
    );
  }
};

// ==================================================
// FIND CONNECTION WITH CAPACITY
// ==================================================

const findConnectionWithCapacity = (
  connectionMap
) => {
  for (
    const connection of
    connectionMap.values()
  ) {
    if (
      connection.symbols.size <
      MAX_STREAMS_PER_CONNECTION
    ) {
      return connection;
    }
  }

  return null;
};

// ==================================================
// CREATE CONNECTION
// ==================================================

const createConnection = (
  connectionMap,
  type
) => {
  const connection =
    createConnectionState(
      nextConnectionId++,
      type
    );

  connectionMap.set(
    connection.id,
    connection
  );

  openConnection(connection);

  return connection;
};

// ==================================================
// GET OR CREATE CONNECTION
// ==================================================

const getOrCreateConnection = (
  connectionMap,
  type
) => {
  let connection =
    findConnectionWithCapacity(
      connectionMap
    );

  if (!connection) {
    connection =
      createConnection(
        connectionMap,
        type
      );
  }

  return connection;
};

// ==================================================
// ASSIGN SYMBOL TO CONNECTION
// ==================================================

const assignSymbolToConnection = (
  symbol,
  type
) => {

const connectionMap =
  type === "bookTicker"
    ? publicConnections
    : type === "ticker"
      ? tickerConnections
      : type === "depth"
        ? depthConnections
        : marketConnections;

  // Already assigned?
  for (
    const connection of
    connectionMap.values()
  ) {
    if (
      connection.symbols.has(symbol)
    ) {
      return connection;
    }
  }

  const connection =
    getOrCreateConnection(
      connectionMap,
      type
    );

  connection.symbols.add(symbol);

  if (
    connection.socket &&
    connection.socket.readyState ===
      WebSocket.OPEN
  ) {
    subscribeSymbols(
      connection,
      [symbol]
    );
  }

  return connection;
};

// ==================================================
// REMOVE SYMBOL FROM CONNECTION
// ==================================================

const removeSymbolFromConnection = (
  symbol,
  type
) => {


const connectionMap =
  type === "bookTicker"
    ? publicConnections
    : type === "ticker"
      ? tickerConnections
      : type === "depth"
        ? depthConnections
        : marketConnections;

  for (
    const connection of
    connectionMap.values()
  ) {
    if (
      !connection.symbols.has(symbol)
    ) {
      continue;
    }

    if (
      connection.socket &&
      connection.socket.readyState ===
        WebSocket.OPEN
    ) {
      unsubscribeSymbols(
        connection,
        [symbol]
      );
    }

    connection.symbols.delete(symbol);

    connection.subscribedSymbols.delete(
      symbol
    );

    // Keep the connection alive.
    //
    // We do NOT close the connection here.
    // This prevents constant connect/disconnect
    // cycles when users switch symbols.

    return;
  }
};


const {
    updateOrderBook,
    requireDepth,
    releaseDepth,
  } = createDepthStream({
    ensureSymbol,
    normalizeSymbol,
    assignSymbolToConnection,
    removeSymbolFromConnection,
    marketData,
    marketEvents,
    LOG_CONNECTION_EVENTS,
    SYMBOL_RELEASE_GRACE_MS,
    setManuallyDisconnected: (value) => {
      manuallyDisconnected = value;
    },
  });

 

  const {
    updateBookTicker,
    requireBookTicker,
    releaseBookTicker,
  } = createBookTickerStream({
    ensureSymbol,
    normalizeSymbol,
    assignSymbolToConnection,
    removeSymbolFromConnection,
    marketData,
    marketEvents,
    LOG_CONNECTION_EVENTS,
    SYMBOL_RELEASE_GRACE_MS,
    setManuallyDisconnected: (value) => {
      manuallyDisconnected = value;
    },
  });

  const {
    updateMarkPrice,
    requireMarkPrice,
    releaseMarkPrice,
  } = createMarkPriceStream({
    ensureSymbol,
    normalizeSymbol,
    assignSymbolToConnection,
    removeSymbolFromConnection,
    marketEvents,
    LOG_CONNECTION_EVENTS,
    SYMBOL_RELEASE_GRACE_MS,
    setManuallyDisconnected: (value) => {
      manuallyDisconnected = value;
    },
  });

  const {
    update24hrTicker,
    requireTicker,
    releaseTicker,
  } = createTickerStream({
    ensureSymbol,
    normalizeSymbol,
    assignSymbolToConnection,
    removeSymbolFromConnection,
    marketData,
    marketEvents,
    LOG_CONNECTION_EVENTS,
    SYMBOL_RELEASE_GRACE_MS,
    setManuallyDisconnected: (value) => {
      manuallyDisconnected = value;
    },
  });

  const {
    requireSharedData,
    releaseSharedData,
    getSharedMarketData,
    createSharedMarketDataPayload,
    emitSharedMarketData,
  } = createSharedMarketDataStream({
    ensureSymbol,
    normalizeSymbol,
    marketData,
    marketEvents,
    SYMBOL_RELEASE_GRACE_MS,
    setManuallyDisconnected: (value) => {
      manuallyDisconnected = value;
    },
    requireBookTicker,
    releaseBookTicker,
    requireMarkPrice,
    releaseMarkPrice,
    requireTicker,
releaseTicker,
  });


// ==================================================
// UPDATE CONNECTION STATUS
// ==================================================

const updateConnectionStatus = (
  connection,
  connected
) => {
  for (
    const symbol of
    connection.symbols
  ) {
    const current =
      marketData.get(symbol);

    if (!current) {
      continue;
    }

    // A symbol is considered fully connected
    // only when both streams are connected.
    const bookConnected =
      isSymbolAssignedAndConnected(
        symbol,
        publicConnections
      );

    const markConnected =
      isSymbolAssignedAndConnected(
        symbol,
        marketConnections
      );

    marketData.set(symbol, {
      ...current,

      connected:
        bookConnected &&
        markConnected,
    });
  }
};

// ==================================================
// CHECK SYMBOL CONNECTION
// ==================================================

const isSymbolAssignedAndConnected = (
  symbol,
  connectionMap
) => {
  for (
    const connection of
    connectionMap.values()
  ) {
    if (
      connection.symbols.has(symbol)
    ) {
      return (
        connection.socket &&
        connection.socket.readyState ===
          WebSocket.OPEN
      );
    }
  }

  return false;
};

// ==================================================
// OPEN CONNECTION
// ==================================================

const openConnection = (
  connection
) => {
  if (
    manuallyDisconnected ||
    connection.manuallyClosed
  ) {
    return;
  }

  if (
    connection.socket &&
    (
      connection.socket.readyState ===
        WebSocket.OPEN ||
      connection.socket.readyState ===
        WebSocket.CONNECTING
    )
  ) {
    return;
  }

const baseUrl =
  connection.type === "bookTicker" ||
  connection.type === "depth"
    ? PUBLIC_WS_URL
    : MARKET_WS_URL;

  if (LOG_CONNECTION_EVENTS) {
    console.log(
      `🔵 Connecting ${connection.type} connection ${connection.id}...`
    );
  }

  const ws =
    new WebSocket(baseUrl);

  connection.socket = ws;

  ws.on("open", () => {
    connection.reconnectAttempts = 0;

    connection.subscribedSymbols.clear();

    if (LOG_CONNECTION_EVENTS) {
      console.log(
        `🟢 ${connection.type} connection ${connection.id} connected`
      );
    }

    // Subscribe all currently assigned symbols.
    const symbols =
      [...connection.symbols];

    if (symbols.length) {
      subscribeSymbols(
        connection,
        symbols
      );
    }

    updateConnectionStatus(
      connection,
      true
    );
  });

  ws.on("message", (message) => {
    try {
      const raw =
        JSON.parse(
          message.toString()
        );

      // Binance subscription response
      if (
        raw &&
        Object.prototype.hasOwnProperty.call(
          raw,
          "result"
        ) &&
        Object.prototype.hasOwnProperty.call(
          raw,
          "id"
        )
      ) {
        const request =
          pendingRequests.get(raw.id);
      
        if (raw.result === null) {
          if (request) {
            console.log(
              `✅ Binance ${request.action} accepted | ${request.type} | id=${raw.id} | ${request.symbols.join(", ")}`
            );
      
            pendingRequests.delete(
              raw.id
            );
          } else {
            console.log(
              `✅ Binance request accepted | ${connection.type} | id=${raw.id}`
            );
          }
        } else {
          console.error(
            `❌ Binance request failed | ${connection.type} | id=${raw.id}`,
            raw.result
          );
      
          if (request) {  
            pendingRequests.delete(
              raw.id
            );
          }
        }
      
        return;
      }

      const data = raw?.data || raw;

      if (!data) {
        return;
      }

      if (connection.type === "bookTicker") {
        if (
          data.e === "bookTicker"
        ) {
          updateBookTicker(data);
        }

        return;
      }

      if ( connection.type === "markPrice") {
        if (
          data.e ===
          "markPriceUpdate"
        ) {
          updateMarkPrice(data);
        }
         return;
      }

      if (connection.type === "ticker") {
        if (
          data.e ===
          "24hrTicker"
        ) {
          update24hrTicker(data);
        }
      
        return;
      }

      if (connection.type === "depth") {
       if(data.e === "depthUpdate"){
        updateOrderBook(data);
       }
      
        return;
      }

    } catch (error) {
      console.error(
        `❌ ${connection.type} message error:`,
        error.message
      );
    }
  });

  ws.on("error", (error) => {
    console.error(
      `🔴 ${connection.type} connection ${connection.id} error:`,
      error.message
    );
  });

  ws.on("close", () => {
    connection.socket = null;

    connection.subscribedSymbols.clear();

    updateConnectionStatus(
      connection,
      false
    );

    if (LOG_CONNECTION_EVENTS) {
      console.log(
        `🟠 ${connection.type} connection ${connection.id} disconnected`
      );
    }

    scheduleReconnect(
      connection
    );
  });
};

// ==================================================
// RECONNECT
// ==================================================

const getReconnectDelay = (
  connection
) => {
  const delay =
    RECONNECT_INITIAL_DELAY *
    Math.pow(
      2,
      connection.reconnectAttempts
    );

  return Math.min(
    delay,
    RECONNECT_MAX_DELAY
  );
};

const scheduleReconnect = (
  connection
) => {
  if (
    manuallyDisconnected ||
    connection.manuallyClosed
  ) {
    return;
  }

  if (
    connection.reconnectTimer
  ) {
    return;
  }

  // If connection has no symbols anymore,
  // don't reconnect it.
  if (
    connection.symbols.size === 0
  ) {
    removeEmptyConnection(
      connection
    );

    return;
  }

  const delay =
    getReconnectDelay(
      connection
    );

  connection.reconnectAttempts++;

  if (LOG_CONNECTION_EVENTS) {
    console.log(
      `🟡 ${connection.type} connection ${connection.id} reconnecting in ${delay}ms`
    );
  }

  connection.reconnectTimer =
    setTimeout(() => {
      connection.reconnectTimer = null;

      openConnection(
        connection
      );
    }, delay);
};

// ==================================================
// REMOVE EMPTY CONNECTION
// ==================================================

const removeEmptyConnection = (
  connection
) => {


const connectionMap =
  connection.type ===
  "bookTicker"
    ? publicConnections
    : connection.type ===
      "ticker"
      ? tickerConnections
      : connection.type ===
        "depth"
        ? depthConnections
        : marketConnections;

  connection.manuallyClosed = true;

  if (
    connection.reconnectTimer
  ) {
    clearTimeout(
      connection.reconnectTimer
    );

    connection.reconnectTimer = null;
  }

  if (connection.socket) {
    try {
      connection.socket.close();
    } catch (_) {}

    connection.socket = null;
  }

  connectionMap.delete(
    connection.id
  );
};


// ==================================================
// REQUIRE SYMBOL
// ==================================================

const requireSymbol = (
  symbol,
  reason = "generic"
) => {
  const normalizedSymbol =
    ensureSymbol(symbol);

  if (!normalizedSymbol) {
    return false;
  }

  const normalizedReason =
    normalizeReason(reason);

  manuallyDisconnected = false;

  let requirement =
    symbolRequirements.get(
      normalizedSymbol
    );

  if (!requirement) {
    requirement = {
      chart: 0,
      position: 0,
      tpSl: 0,
      liquidation: 0,
      generic: 0,
      releaseTimer: null,
    };

    symbolRequirements.set(
      normalizedSymbol,
      requirement
    );
  }

  // Cancel pending release.
  if (
    requirement.releaseTimer
  ) {
    clearTimeout(
      requirement.releaseTimer
    );

    requirement.releaseTimer = null;
  }

  if (
    requirement[
      normalizedReason
    ] === undefined
  ) {
    requirement[
      normalizedReason
    ] = 0;
  }

  requirement[
    normalizedReason
  ]++;

  // If this is the first requirement,
  // actually connect the symbol.
  if (
    getTotalRequirement(
      requirement
    ) === 1
  ) {

    

    if (LOG_CONNECTION_EVENTS) {
      console.log(
        `📡 Symbol required: ${normalizedSymbol} (${normalizedReason})`
      );
    }
  }

  return true;
};

// ==================================================
// RELEASE SYMBOL
// ==================================================

const releaseSymbol = (
  symbol,
  reason = "generic"
) => {
  const normalizedSymbol =
    normalizeSymbol(symbol);

  if (!normalizedSymbol) {
    return false;
  }

  const normalizedReason =
    normalizeReason(reason);

  const requirement =
    symbolRequirements.get(
      normalizedSymbol
    );

  if (!requirement) {
    return false;
  }

  if (
    requirement[
      normalizedReason
    ] === undefined
  ) {
    return false;
  }

  if (
    requirement[
      normalizedReason
    ] <= 0
  ) {
    return false;
  }

  requirement[
    normalizedReason
  ]--;

  const total =
    getTotalRequirement(
      requirement
    );

    console.log(
        `📊 RELEASE CHECK | ${normalizedSymbol} | reason=${normalizedReason} | total=${total}`
      );

  if (total > 0) {
    return true;
  }

  // Nobody needs this symbol anymore.
  //
  // Don't immediately unsubscribe.
  // Give the user a short grace period.
  if (
    requirement.releaseTimer
  ) {
    clearTimeout(
      requirement.releaseTimer
    );
  }

  
  requirement.releaseTimer =
    setTimeout(() => {

        const current =
        symbolRequirements.get(
          normalizedSymbol
        );

      if (!current) {
        return;
      }

      const stillRequired =
        getTotalRequirement(
          current
        );

      if (
        stillRequired > 0
      ) {
        current.releaseTimer = null;
        return;
      }

    //   removeSymbolFromConnection(
    //     normalizedSymbol,
    //     "bookTicker"
    //   );

      

      symbolRequirements.delete(
        normalizedSymbol
      );

      marketData.delete(
        normalizedSymbol
      );

      if (LOG_CONNECTION_EVENTS) {
        console.log(
          `📴 Symbol released completely: ${normalizedSymbol}`
        );
      }
    }, SYMBOL_RELEASE_GRACE_MS);

  return true;
};

// ==================================================
// TOTAL REQUIREMENTS
// ==================================================

const getTotalRequirement = (
  requirement
) => {
  return Object.keys(
    requirement
  )
    .filter(
      (key) =>
        key !== "releaseTimer"
    )
    .reduce(
      (sum, key) =>
        sum +
        Number(
          requirement[key] || 0
        ),
      0
    );
};

// ==================================================
// CONNECT SYMBOL
//
// Backward-compatible API.
//
// Equivalent to:
// requireSymbol(symbol, "generic")
// ==================================================

const connectSymbol = (
  symbol
) => {
  return requireSymbol(
    symbol,
    "generic"
  );
};

// ==================================================
// CONNECT MULTIPLE SYMBOLS
// ==================================================

const connectSymbols = (
  symbols = []
) => {
  if (!Array.isArray(symbols)) {
    return;
  }

  for (
    const symbol of symbols
  ) {
    requireSymbol(
      symbol,
      "generic"
    );
  }
};

// ==================================================
// DISCONNECT SYMBOL
//
// This is an administrative / force disconnect.
//
// For normal user lifecycle use:
//
// releaseSymbol(symbol, reason)
//
// ==================================================

const disconnectSymbol = (
  symbol
) => {
  const normalizedSymbol =
    normalizeSymbol(symbol);

  if (!normalizedSymbol) {
    return;
  }

  const requirement =
    symbolRequirements.get(
      normalizedSymbol
    );

  if (requirement?.releaseTimer) {
    clearTimeout(
      requirement.releaseTimer
    );
  }

  symbolRequirements.delete(
    normalizedSymbol
  );

  const depthRequirement =
  depthRequirements.get(
    normalizedSymbol
  );

if (depthRequirement?.releaseTimer) {
  clearTimeout(
    depthRequirement.releaseTimer
  );
}

depthRequirements.delete( normalizedSymbol );

const tickerRequirement =
  tickerRequirements.get(normalizedSymbol);

if (tickerRequirement?.releaseTimer) {
  clearTimeout(tickerRequirement.releaseTimer);
}

tickerRequirements.delete(normalizedSymbol);


const bookTickerRequirement =
  bookTickerRequirements.get(
    normalizedSymbol
  );

if (bookTickerRequirement?.releaseTimer) {
  clearTimeout(
    bookTickerRequirement.releaseTimer
  );
}

bookTickerRequirements.delete(
  normalizedSymbol
);

const markPriceRequirement =
  markPriceRequirements.get(
    normalizedSymbol
  );

if (markPriceRequirement?.releaseTimer) {
  clearTimeout(
    markPriceRequirement.releaseTimer
  );
}

markPriceRequirements.delete(
  normalizedSymbol
);

const sharedRequirement =
  sharedDataRequirements.get(normalizedSymbol);

if (sharedRequirement?.releaseTimer) {
  clearTimeout(sharedRequirement.releaseTimer);
}

sharedDataRequirements.delete(normalizedSymbol);



  removeSymbolFromConnection(
    normalizedSymbol,
    "bookTicker"
  );

  removeSymbolFromConnection(
    normalizedSymbol,
    "markPrice"
  );

  removeSymbolFromConnection(
    normalizedSymbol,
    "ticker"
  );

  removeSymbolFromConnection(
    normalizedSymbol,
    "depth"
  );

  marketData.delete(
    normalizedSymbol
  );
};

// ==================================================
// GET MARKET DATA
// ==================================================

const getMarketData = (
  symbol
) => {
  const normalizedSymbol =
    normalizeSymbol(symbol);

  if (!normalizedSymbol) {
    return null;
  }

  return (
    marketData.get(
      normalizedSymbol
    ) || null
  );
};

// ==================================================
// GET PRICE
// ==================================================

const getPrice = (
  symbol
) => {
  const data =
    getMarketData(symbol);

  if (!data) {
    return null;
  }

  return {
    bid: data.bidPrice,
    ask: data.askPrice,
    mark: data.markPrice,
  };
};

// ==================================================
// PRICE FRESHNESS
// ==================================================

const isPriceFresh = (
  symbol,
  maxAge =
    STALE_PRICE_THRESHOLD
) => {
  const data =
    getMarketData(symbol);

  if (!data) {
    return false;
  }

  if (!data.updatedAt) {
    return false;
  }

  return (
    Date.now() -
      data.updatedAt <=
    maxAge
  );
};


const waitForMarketData = (
    symbol,
    timeout = 5000
  ) => {
    const normalizedSymbol =
      normalizeSymbol(symbol);
  
    if (!normalizedSymbol) {
      return Promise.reject(
        new Error("Invalid symbol")
      );
    }
  
    const existing =
      getMarketData(normalizedSymbol);

      console.log("🔎 WAIT MARKET DATA:", {
        symbol: normalizedSymbol,
        existing,
        fresh: isPriceFresh(normalizedSymbol),
      });
  
    if (
      existing?.bidPrice != null &&
      existing?.askPrice != null &&
      existing?.markPrice != null && 
      isPriceFresh(normalizedSymbol)

    ) {
      return Promise.resolve(existing);
    }
  
    return new Promise((resolve, reject) => {
      let timer;
  
      const onMarketData = (data) => {
        console.log("📥 MARKET DATA EVENT:", {
            requested: normalizedSymbol,
            received: data?.symbol,
            bid: data?.bidPrice,
            ask: data?.askPrice,
            mark: data?.markPrice,
            updatedAt: data?.updatedAt,
            age: data?.updatedAt
              ? Date.now() - data.updatedAt
              : null,
          });
        if (
          data?.symbol !== normalizedSymbol
        ) {
          return;
        }
  
        if (
          data.bidPrice == null ||
          data.askPrice == null ||
          data.markPrice == null
        ) {
          return;
        }
  
        cleanup();
        resolve(data);
      };
  
      const cleanup = () => {
        clearTimeout(timer);
        marketEvents.removeListener(
          "marketData",
          onMarketData
        );
      };
  
      timer = setTimeout(() => {
        cleanup();
  
        reject(
          new Error(
            `Live market data timeout for ${normalizedSymbol}`
          )
        );
      }, timeout);
  
      marketEvents.on(
        "marketData",
        onMarketData
      );
    });
  };

// ==================================================
// ALL MARKET DATA
// ==================================================

const getAllMarketData = () => {
  return Object.fromEntries(
    marketData
  );
};

// ==================================================
// CONNECTED SYMBOLS
// ==================================================

const getConnectedSymbols = () => {
  return [...marketData.entries()]
    .filter(
      ([, data]) =>
        data.connected
    )
    .map(
      ([symbol]) =>
        symbol
    );
};

// ==================================================
// REQUIRED SYMBOLS
// ==================================================

const getRequiredSymbols = () => {
  return [
    ...symbolRequirements.keys(),
  ];
};

// ==================================================
// SYMBOL REQUIREMENTS
// ==================================================

const getSymbolRequirements = (
  symbol = null
) => {
  if (symbol) {
    const normalizedSymbol =
      normalizeSymbol(symbol);

    const requirement =
      symbolRequirements.get(
        normalizedSymbol
      );

    if (!requirement) {
      return null;
    }

    return {
      symbol: normalizedSymbol,

      chart:
        requirement.chart || 0,

      position:
        requirement.position || 0,

      tpSl:
        requirement.tpSl || 0,

      liquidation:
        requirement.liquidation || 0,

      generic:
        requirement.generic || 0,

      total:
        getTotalRequirement(
          requirement
        ),
    };
  }

  return Object.fromEntries(
    [...symbolRequirements.entries()]
      .map(
        ([
          symbol,
          requirement,
        ]) => [
          symbol,
          {
            chart:
              requirement.chart ||
              0,

            position:
              requirement.position ||
              0,

            tpSl:
              requirement.tpSl ||
              0,

            liquidation:
              requirement.liquidation ||
              0,

            generic:
              requirement.generic ||
              0,

            total:
              getTotalRequirement(
                requirement
              ),
          },
        ]
      )
  );
};

// ==================================================
// CONNECTION STATS
// ==================================================

const getConnectionStats = () => {
  const getStats = (
    connectionMap
  ) => {
    return [
      ...connectionMap.values(),
    ].map(
      (connection) => ({
        id: connection.id,

        type: connection.type,

        symbols:
          connection.symbols.size,

        subscribed:
          connection
            .subscribedSymbols
            .size,

        connected:
          Boolean(
            connection.socket &&
            connection.socket
              .readyState ===
              WebSocket.OPEN
          ),
      })
    );
  };

  return {
    bookTicker:
      getStats(
        publicConnections
      ),

    markPrice:
      getStats(
        marketConnections
      ),

    requiredSymbols:
      symbolRequirements.size,

    marketDataSymbols:
      marketData.size,

      ticker:
  getStats(
    tickerConnections
  ),

  depth:
  getStats(
    depthConnections
  ),

  };
};

// ==================================================
// DISCONNECT EVERYTHING
// ==================================================

const disconnect = () => {
  manuallyDisconnected = true;

  for (
    const requirement of
    symbolRequirements.values()
  ) {
    if (
      requirement.releaseTimer
    ) {
      clearTimeout(
        requirement.releaseTimer
      );
    }
  }



  for (
    const connection of
    publicConnections.values()
  ) {
    connection.manuallyClosed =
      true;

    if (
      connection.reconnectTimer
    ) {
      clearTimeout(
        connection.reconnectTimer
      );

      connection.reconnectTimer =
        null;
    }

    if (connection.socket) {
      try {
        connection.socket.close();
      } catch (_) {}

      connection.socket = null;
    }
  }

  for (
    const connection of
    marketConnections.values()
  ) {
    connection.manuallyClosed =
      true;

    if (
      connection.reconnectTimer
    ) {
      clearTimeout(
        connection.reconnectTimer
      );

      connection.reconnectTimer =
        null;
    }

    if (connection.socket) {
      try {
        connection.socket.close();
      } catch (_) {}

      connection.socket = null;
    }
  }

  for (
    const requirement of
    bookTickerRequirements.values()
  ) {
    if (
      requirement.releaseTimer
    ) {
      clearTimeout(
        requirement.releaseTimer
      );
    }
  }

  bookTickerRequirements.clear();


  for (
    const requirement of
    sharedDataRequirements.values()
  ) {
    if (
      requirement.releaseTimer
    ) {
      clearTimeout(
        requirement.releaseTimer
      );
    }
  }
  
  sharedDataRequirements.clear();

  for (
    const requirement of
    markPriceRequirements.values()
  ) {
    if (
      requirement.releaseTimer
    ) {
      clearTimeout(
        requirement.releaseTimer
      );
    }
  }

  markPriceRequirements.clear();

  for (
    const connection of
    tickerConnections.values()
  ) {
    connection.manuallyClosed =
      true;
  
    if (
      connection.reconnectTimer
    ) {
      clearTimeout(
        connection.reconnectTimer
      );
  
      connection.reconnectTimer =
        null;
    }
  
    if (connection.socket) {
      try {
        connection.socket.close();
      } catch (_) {}
  
      connection.socket = null;
    }
  }

  for (
    const connection of
    depthConnections.values()
  ) {
    connection.manuallyClosed =
      true;

    if (
      connection.reconnectTimer
    ) {
      clearTimeout(
        connection.reconnectTimer
      );

      connection.reconnectTimer =
        null;
    }

    if (connection.socket) {
      try {
        connection.socket.close();
      } catch (_) {}

      connection.socket = null;
    }
  }

  for (const requirement of tickerRequirements.values()) {
    if (requirement.releaseTimer) {
      clearTimeout(requirement.releaseTimer);
    }
  }
  
  tickerRequirements.clear();

  publicConnections.clear();

  marketConnections.clear();
  
  tickerConnections.clear();

  depthConnections.clear();

  symbolRequirements.clear();

  for (
    const requirement of
    depthRequirements.values()
  ) {
    if (
      requirement.releaseTimer
    ) {
      clearTimeout(
        requirement.releaseTimer
      );
    }
  }
  
  depthRequirements.clear();

  marketData.clear();

  console.log(
    "🛑 Binance Futures WebSocket disconnected"
  );
};

// ==================================================
// EXPORTS
// ==================================================

module.exports = {

  // -----------------------------------------------
  // Symbol lifecycle
  // -----------------------------------------------

  requireSymbol,
  releaseSymbol,

  getRequiredSymbols,
  getSymbolRequirements,

  requireDepth,
releaseDepth,

requireBookTicker,
releaseBookTicker,

requireMarkPrice,
releaseMarkPrice,

requireTicker,
releaseTicker,

requireSharedData,
releaseSharedData,
getSharedMarketData,

  // -----------------------------------------------
  // Backward compatibility
  // -----------------------------------------------

  connectSymbol,
  connectSymbols,
  disconnectSymbol,

  // -----------------------------------------------
  // Market data
  // -----------------------------------------------

  getMarketData,
  getAllMarketData,
  getConnectedSymbols,

  getPrice, 
  isPriceFresh,
  waitForMarketData,

  // -----------------------------------------------
  // Monitoring
  // -----------------------------------------------

  getConnectionStats, 

  // -----------------------------------------------
  // Shutdown
  // -----------------------------------------------

  disconnect,
};