const BinanceOrderBookService = require("../../services/binance/order_book_service");
const depthConnections = new Map();

const depthRequirements = new Map();

const orderBooks = new Map();
const depthUpdateBuffers = new Map();

const createDepthStream = ({
  ensureSymbol,
  normalizeSymbol,
  assignSymbolToConnection,
  removeSymbolFromConnection,
  marketData,
  marketEvents,
  LOG_CONNECTION_EVENTS,
  SYMBOL_RELEASE_GRACE_MS,
  setManuallyDisconnected,
}) => {

  const getOrCreateOrderBook = (symbol) => {
  let book = orderBooks.get(symbol);

  if (!book) {
    book = {
      bids: new Map(),
      asks: new Map(),
      lastUpdateId: null,
      snapshotLoaded: false,
      snapshotLoading: false,
    };

    orderBooks.set(symbol, book);
  }

  return book;
};

const applyLevels = (bookSide, levels) => {
  if (!Array.isArray(levels)) {
    return;
  }

  for (const level of levels) {
    if (!Array.isArray(level) || level.length < 2) {
      continue;
    }

    const price = Number(level[0]);
    const quantity = Number(level[1]);

    if (!Number.isFinite(price) || !Number.isFinite(quantity)) {
      continue;
    }

    // Binance sends quantity 0 when a price level should be removed.
    if (quantity === 0) {
      bookSide.delete(price);
    } else {
      bookSide.set(price, quantity);
    }
  }
};




const loadSnapshot = async (symbol) => {
  const book = getOrCreateOrderBook(symbol);

  if (book.snapshotLoading) {
    return null;
  }

  book.snapshotLoading = true;

  try {
    const snapshot =
      await BinanceOrderBookService.getOrderBook(symbol);

    if (!snapshot) {
      throw new Error(
        `Empty order book snapshot: ${symbol}`
      );
    }

    book.bids.clear();
    book.asks.clear();

    applyLevels(book.bids, snapshot.bids);
    applyLevels(book.asks, snapshot.asks);

    const snapshotUpdateId =
      Number(snapshot.lastUpdateId);

    if (!Number.isFinite(snapshotUpdateId)) {
      throw new Error(
        `Invalid snapshot update ID: ${symbol}`
      );
    }

    const buffer =
      depthUpdateBuffers.get(symbol) || [];

    const firstValidIndex =
      buffer.findIndex((update) => {
        const firstId = Number(update.U);
        const finalId = Number(update.u);

        return (
          Number.isFinite(firstId) &&
          Number.isFinite(finalId) &&
          firstId <= snapshotUpdateId + 1 &&
          finalId >= snapshotUpdateId + 1
        );
      });

    if (firstValidIndex === -1) {
      console.warn(
        `⏳ Waiting for valid depth update: ${symbol} | ` +
        `snapshot=${snapshotUpdateId} | ` +
        `buffered=${buffer.length}`
      );

      book.snapshotLoaded = false;

      return null;
    }

    const relevantUpdates =
      buffer.slice(firstValidIndex);

    let lastUpdateId =
      snapshotUpdateId;

    for (const update of relevantUpdates) {
      const updateFirstId =
        Number(update.U);

      const updateFinalId =
        Number(update.u);

      if (
        !Number.isFinite(updateFirstId) ||
        !Number.isFinite(updateFinalId)
      ) {
        continue;
      }

      if (updateFinalId <= lastUpdateId) {
        continue;
      }

      if (updateFirstId > lastUpdateId + 1) {
        console.warn(
          `⚠️ Order book gap detected: ${symbol} | ` +
          `expected=${lastUpdateId + 1} | ` +
          `received=${updateFirstId}`
        );

        book.snapshotLoaded = false;

        return null;
      }

      applyLevels(book.bids, update.b);
      applyLevels(book.asks, update.a);

      lastUpdateId =
        updateFinalId;
    }

    book.lastUpdateId =
      lastUpdateId;

    depthUpdateBuffers.delete(symbol);

    book.snapshotLoaded = true;

    console.log(
      `✅ Order book synchronized: ${symbol} | ` +
      `bids=${book.bids.size} | ` +
      `asks=${book.asks.size} | ` +
      `lastUpdateId=${book.lastUpdateId}`
    );

    return book;

  } catch (error) {

    console.error(
      `❌ Order book snapshot error: ${symbol}`,
      error.message
    );

    book.snapshotLoaded = false;

    throw error;

  } finally {

    book.snapshotLoading = false;
  }
};



const resyncOrderBook = async (symbol) => {
  const book = getOrCreateOrderBook(symbol);

  if (book.snapshotLoading) {
    return;
  }

  book.snapshotLoaded = false;

  try {
    const result =
      await loadSnapshot(symbol);

    if (result) {
      return;
    }

    setTimeout(() => {
      resyncOrderBook(symbol)
        .catch((error) => {
          console.error(
            `❌ Order book retry failed: ${symbol}`,
            error.message
          );
        });
    }, 100);
  } catch (error) {
    console.error(
      `❌ Order book resync failed: ${symbol}`,
      error.message
    );

    setTimeout(() => {
      resyncOrderBook(symbol)
        .catch((retryError) => {
          console.error(
            `❌ Order book retry failed: ${symbol}`,
            retryError.message
          );
        });
    }, 500);
  }
};



  // ==================================================
  // UPDATE ORDER BOOK
  // ==================================================

 

  const updateOrderBook = (data) => {
  if (!data?.s) {
    return;
  }

  const symbol = ensureSymbol(data.s);

  if (!symbol) {
    return;
  }

 const book = getOrCreateOrderBook(symbol);

if (!book.snapshotLoaded) {
  let buffer = depthUpdateBuffers.get(symbol);

  if (!buffer) {
    buffer = [];
    depthUpdateBuffers.set(symbol, buffer);
  }

  buffer.push(data);

  return;
}

const updateFirstId = Number(data.U);
const updateFinalId = Number(data.u);

if (
  !Number.isFinite(updateFirstId) ||
  !Number.isFinite(updateFinalId)
) {
  return;
}

if (updateFinalId <= book.lastUpdateId) {
  return;
}

const previousUpdateId =
  book.lastUpdateId;

const previousUpdateIdFromBinance =
  Number(data.pu);

if (
  Number.isFinite(previousUpdateIdFromBinance) &&
  previousUpdateIdFromBinance !== previousUpdateId
) {
  console.warn(
    `⚠️ Live order book sequence mismatch: ${symbol} | ` +
    `expected pu=${previousUpdateId} | ` +
    `received pu=${previousUpdateIdFromBinance} | ` +
    `U=${updateFirstId} | ` +
    `u=${updateFinalId}`
  );

  book.snapshotLoaded = false;

  depthUpdateBuffers.set(
    symbol,
    [data]
  );

  resyncOrderBook(symbol)
    .catch((error) => {
      console.error(
        `❌ Failed to resync order book: ${symbol}`,
        error.message
      );
    });

  return;
}

applyLevels(book.bids, data.b);
applyLevels(book.asks, data.a);

book.lastUpdateId = updateFinalId;

  const bids = [...book.bids.entries()]
    .sort((a, b) => b[0] - a[0])
    .slice(0, 100);

  const asks = [...book.asks.entries()]
    .sort((a, b) => a[0] - b[0])
    .slice(0, 100);

  marketEvents.emit("orderBook", {
    symbol,
    bids,
    asks,
    updateId: book.lastUpdateId,
  });
};

  // ==================================================
  // REQUIRE DEPTH
  // ==================================================

  const requireDepth = (
    symbol
  ) => {
    const normalizedSymbol =
      ensureSymbol(symbol);

    if (!normalizedSymbol) {
      return false;
    }

    setManuallyDisconnected(false);

    let requirement =
      depthRequirements.get(
        normalizedSymbol
      );

    if (!requirement) {
      requirement = {
        count: 0,
        releaseTimer: null,
      };

      depthRequirements.set(
        normalizedSymbol,
        requirement
      );
    }

    if (requirement.releaseTimer) {
      clearTimeout(
        requirement.releaseTimer
      );

      requirement.releaseTimer = null;
    }

    requirement.count++;

   if (requirement.count === 1) {
  const book =
    getOrCreateOrderBook(normalizedSymbol);

  book.snapshotLoaded = false;
  book.lastUpdateId = null;

  depthUpdateBuffers.set(
    normalizedSymbol,
    []
  );

  assignSymbolToConnection(
    normalizedSymbol,
    "depth"
  );

 resyncOrderBook(normalizedSymbol)
  .catch((error) => {
    console.error(
      `❌ Failed to initialize order book: ${normalizedSymbol}`,
      error.message
    );
  });

  if (LOG_CONNECTION_EVENTS) {
    console.log(
      `📖 Depth required: ${normalizedSymbol}`
    );
  }
}

    return true;
  };


  // ==================================================
  // RELEASE DEPTH
  // ==================================================

  const releaseDepth = (
    symbol
  ) => {
    const normalizedSymbol =
      normalizeSymbol(symbol);

    if (!normalizedSymbol) {
      return false;
    }

    const requirement =
      depthRequirements.get(
        normalizedSymbol
      );

    if (!requirement) {
      return false;
    }

    if (requirement.count <= 0) {
      return false;
    }

    requirement.count--;

    console.log(
      `📊 DEPTH RELEASE CHECK | ${normalizedSymbol} | total=${requirement.count}`
    );

    if (requirement.count > 0) {
      return true;
    }

    if (requirement.releaseTimer) {
      clearTimeout(
        requirement.releaseTimer
      );
    }

    requirement.releaseTimer =
      setTimeout(() => {

        const current =
          depthRequirements.get(
            normalizedSymbol
          );

        if (!current) {
          return;
        }

        if (current.count > 0) {
          current.releaseTimer = null;
          return;
        }

        removeSymbolFromConnection(
          normalizedSymbol,
          "depth"
        );

        depthRequirements.delete(
          normalizedSymbol
        );

        console.log(
          `📴 Depth released completely: ${normalizedSymbol}`
        );

      }, SYMBOL_RELEASE_GRACE_MS);

    return true;
  };


  return {
    updateOrderBook,
    requireDepth,
    releaseDepth,
  };
};





module.exports = {
  depthConnections,
  depthRequirements,
  createDepthStream,
};