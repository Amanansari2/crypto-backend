const WebSocket = require("ws");

const marketStream = require(
    "./binance_market_stream.service"
  );

  const marketEvents = require(
    "../services/trading/market_event.service"
  );

let wss = null;

// accountId -> Set of WebSocket clients
const accountSubscribers = new Map();

// --------------------------------------------------
// Initialize
// --------------------------------------------------

const initializeTradingWebSocket = (server) => {
  wss = new WebSocket.Server({
    server,
    path: "/ws/trading",
  });

  console.log(
    "🟣 Trading WebSocket server initialized"
  );

  marketEvents.on("marketData", (data) => {
   
    if (!data?.symbol) {
      return;
    }
  
    const symbol = String(data.symbol)
      .trim()
      .toUpperCase();
  
    wss.clients.forEach((ws) => {
      if (
        ws.readyState === WebSocket.OPEN &&
        ws.symbolSubscriptions?.has(symbol)
      ) {
       
        ws.send(
          JSON.stringify({
            type: "MARKET_DATA",
            data,
          })
        );
      }
    });
  });

  marketEvents.on("bookTicker", (data) => {
    if (!data?.symbol) {
      return;
    }

    const symbol = String(data.symbol)
      .trim()
      .toUpperCase();

    wss.clients.forEach((ws) => {
      if (
        ws.readyState === WebSocket.OPEN &&
        ws.bookTickerSubscriptions?.has(symbol)
      ) {
        ws.send(
          JSON.stringify({
            type: "BOOK_TICKER",
            data,
          })
        );
      }
    });
  });


  marketEvents.on("orderBook", (data) => {
    if (!data?.symbol) {
      return;
    }
  
    const symbol = String(data.symbol)
      .trim()
      .toUpperCase();
  
    wss.clients.forEach((ws) => {
      if (
        ws.readyState === WebSocket.OPEN &&
        ws.orderBookSubscriptions?.has(symbol)
      ) {
        ws.send(
          JSON.stringify({
            type: "ORDER_BOOK",
            data,
          })
        );
      }
    });
  });


  marketEvents.on("markPrice", (data) => {
    if (!data?.symbol) {
      return;
    }
  
    const symbol = String(data.symbol)
      .trim()
      .toUpperCase();
  
    wss.clients.forEach((ws) => {
      if (
        ws.readyState === WebSocket.OPEN &&
        ws.markPriceSubscriptions?.has(symbol)
      ) {
        ws.send(
          JSON.stringify({
            type: "MARK_PRICE",
            data,
          })
        );
      }
    });
  });

  marketEvents.on("ticker", (data) => {
    if (!data?.symbol) {
      return;
    }
  
    const symbol = String(data.symbol)
      .trim()
      .toUpperCase();
  
    wss.clients.forEach((ws) => {
      if (
        ws.readyState === WebSocket.OPEN &&
        ws.tickerSubscriptions?.has(symbol)
      ) {
        ws.send(
          JSON.stringify({
            type: "TICKER",
            data,
          })
        );
      }
    });
  });


  marketEvents.on("trade", (data) => {
  if (!data?.symbol) {
    return;
  }

  const symbol = String(data.symbol)
    .trim()
    .toUpperCase();

  wss.clients.forEach((ws) => {
    if (
      ws.readyState === WebSocket.OPEN &&
      ws.tradeSubscriptions?.has(symbol)
    ) {
      ws.send(
        JSON.stringify({
          type: "TRADE",
          data,
        })
      );
    }
  });
});


  marketEvents.on("sharedMarketData", (data) => {
    if (!data?.symbol) {
      return;
    }
  
    const symbol =
      String(data.symbol)
        .trim()
        .toUpperCase();
  
    wss.clients.forEach((ws) => {
      if (
        ws.readyState === WebSocket.OPEN &&
        ws.sharedMarketDataSubscriptions?.has(symbol)
      ) {
        ws.send(
          JSON.stringify({
            type: "SHARED_MARKET_DATA",
            data,
          })
        );
      }
    });
  });

  wss.on("connection", (ws) => {
    console.log("🟢 Trading client connected");

    ws.isAlive = true;
    ws.accountId = null;
    ws.symbolSubscriptions = new Set();
    ws.orderBookSubscriptions = new Set();
    ws.bookTickerSubscriptions = new Set();
    ws.markPriceSubscriptions = new Set();
    ws.tickerSubscriptions = new Set();
    ws.sharedMarketDataSubscriptions = new Set();
    ws.tradeSubscriptions = new Set();

    ws.on("pong", () => {
      ws.isAlive = true;
    });

    // ----------------------------------------------
    // Client messages
    // ----------------------------------------------

    ws.on("message", (message) => {
      try {
        const data =
          JSON.parse(message.toString());

        console.log(
          "📩 Trading WS message:",
          data
        );

        // ------------------------------------------
// SUBSCRIBE MARKET DATA
// ------------------------------------------

if (data.type === "SUBSCRIBE_MARKET_DATA") {
    const symbol =
      String(data.symbol || "")
        .trim()
        .toUpperCase();
  
    if (!symbol) {
      ws.send(
        JSON.stringify({
          type: "ERROR",
          message: "symbol is required",
        })
      );
      return;
    }
  
    if (ws.symbolSubscriptions.has(symbol)) {
      ws.send(
        JSON.stringify({
          type: "MARKET_DATA_ALREADY_SUBSCRIBED",
          symbol,
        })
      );
      return; 
    }
  
    ws.symbolSubscriptions.add(symbol);
  
    marketStream.requireSymbol(
      symbol,
      "chart"
    );
  
    console.log(
      `📡 Client subscribed to market data ${symbol}`
    );
  
    ws.send(
      JSON.stringify({
        type: "MARKET_DATA_SUBSCRIBED",
        symbol,
      })
    );
  
    return;
  }


  // ------------------------------------------
// UNSUBSCRIBE MARKET DATA
// ------------------------------------------

if (data.type === "UNSUBSCRIBE_MARKET_DATA") {
    const symbol =
      String(data.symbol || "")
        .trim()
        .toUpperCase();
  
    if (!symbol) {
      ws.send(
        JSON.stringify({
          type: "ERROR",
          message: "symbol is required",
        })
      );
      return;
    }
  
    if (!ws.symbolSubscriptions.has(symbol)) {
      ws.send(
        JSON.stringify({
          type: "MARKET_DATA_NOT_SUBSCRIBED",
          symbol,
        })
      );
      return;
    }
  
    ws.symbolSubscriptions.delete(symbol);
  
    marketStream.releaseSymbol(
      symbol,
      "chart"
    );
  
    console.log(
      `📴 Client unsubscribed from market data ${symbol}`
    );
  
    ws.send(
      JSON.stringify({
        type: "MARKET_DATA_UNSUBSCRIBED",
        symbol,
      })
    );
  
    return;
  }

  // ------------------------------------------
// SUBSCRIBE BOOK TICKER
// ------------------------------------------

if (data.type === "SUBSCRIBE_BOOK_TICKER") {
    const symbol =
      String(data.symbol || "")
        .trim()
        .toUpperCase();
  
    if (!symbol) {
      ws.send(
        JSON.stringify({
          type: "ERROR",
          message: "symbol is required",
        })
      );
      return;
    }
  
    if (ws.bookTickerSubscriptions.has(symbol)) {
      ws.send(
        JSON.stringify({
          type: "BOOK_TICKER_ALREADY_SUBSCRIBED",
          symbol,
        })
      );
      return;
    }
  
    ws.bookTickerSubscriptions.add(symbol);
  
    marketStream.requireBookTicker(
      symbol
    );
  
    console.log(
      `📈 Client subscribed to book ticker ${symbol}`
    );
  
    ws.send(
      JSON.stringify({
        type: "BOOK_TICKER_SUBSCRIBED",
        symbol,
      })
    );
  
    return;  

  }

  // ------------------------------------------
// UNSUBSCRIBE BOOK TICKER
// ------------------------------------------

if (data.type === "UNSUBSCRIBE_BOOK_TICKER") {
    const symbol =
      String(data.symbol || "")
        .trim()
        .toUpperCase();
  
    if (!symbol) {
      ws.send(
        JSON.stringify({
          type: "ERROR",
          message: "symbol is required",
        })
      );
      return;
    }
  
    if (!ws.bookTickerSubscriptions.has(symbol)) {
      ws.send(
        JSON.stringify({
          type: "BOOK_TICKER_NOT_SUBSCRIBED",
          symbol,
        })
      );
      return;
    }
  
    ws.bookTickerSubscriptions.delete(symbol);
  
    marketStream.releaseBookTicker(
      symbol
    );
  
    console.log(
      `📴 Client unsubscribed from book ticker ${symbol}`
    );
  
    ws.send(
      JSON.stringify({
        type: "BOOK_TICKER_UNSUBSCRIBED",
        symbol,
      })
    );
  
    return;
  }


  // ------------------------------------------
// SUBSCRIBE MARK PRICE
// ------------------------------------------

if (data.type === "SUBSCRIBE_MARK_PRICE") {
    const symbol =
      String(data.symbol || "")
        .trim()
        .toUpperCase();
  
    if (!symbol) {
      ws.send(
        JSON.stringify({
          type: "ERROR",
          message: "symbol is required",
        })
      );
      return;
    }
  
    if (ws.markPriceSubscriptions.has(symbol)) {
      ws.send(
        JSON.stringify({
          type: "MARK_PRICE_ALREADY_SUBSCRIBED",
          symbol,
        })
      );
      return;
    }
  
    ws.markPriceSubscriptions.add(symbol);
  
    marketStream.requireMarkPrice(
      symbol
    );
  
    console.log(
      `📊 Client subscribed to mark price ${symbol}`
    );
  
    ws.send(
      JSON.stringify({
        type: "MARK_PRICE_SUBSCRIBED",
        symbol,
      })
    );
  
    return;
  }


  // ------------------------------------------
// UNSUBSCRIBE MARK PRICE
// ------------------------------------------

if (data.type === "UNSUBSCRIBE_MARK_PRICE") {
    const symbol =
      String(data.symbol || "")
        .trim()
        .toUpperCase();
  
    if (!symbol) {
      ws.send(
        JSON.stringify({
          type: "ERROR",
          message: "symbol is required",
        })
      );
      return;
    }
  
    if (!ws.markPriceSubscriptions.has(symbol)) {
      ws.send(
        JSON.stringify({
          type: "MARK_PRICE_NOT_SUBSCRIBED",
          symbol,
        })
      );
      return;
    }
  
    ws.markPriceSubscriptions.delete(symbol);
  
    marketStream.releaseMarkPrice(
      symbol
    );
  
    console.log(
      `📴 Client unsubscribed from mark price ${symbol}`
    );
  
    ws.send(
      JSON.stringify({
        type: "MARK_PRICE_UNSUBSCRIBED",
        symbol,
      })
    );
  
    return;
  }


    // ------------------------------------------
// SUBSCRIBE ORDER BOOK
// ------------------------------------------

if (data.type === "SUBSCRIBE_ORDER_BOOK") {
    const symbol =
      String(data.symbol || "")
        .trim()
        .toUpperCase();
  
    if (!symbol) {
      ws.send(
        JSON.stringify({
          type: "ERROR",
          message: "symbol is required",
        })
      );
  
      return;
    }
  
    if (ws.orderBookSubscriptions.has(symbol)) {
        ws.send(
          JSON.stringify({
            type: "ORDER_BOOK_ALREADY_SUBSCRIBED",
            symbol,
          })
        );
    
        return;
      }
    
      ws.orderBookSubscriptions.add(symbol);

    marketStream.requireDepth(
      symbol
    );
  
    console.log(
      `📖 Client subscribed to order book ${symbol}`
    );
  
    ws.send(
      JSON.stringify({
        type: "ORDER_BOOK_SUBSCRIBED",
        symbol,
      })
    );
  
    return;
  }

// ------------------------------------------
// UNSUBSCRIBE ORDER BOOK
// ------------------------------------------

if (data.type === "UNSUBSCRIBE_ORDER_BOOK") {
    const symbol =
      String(data.symbol || "")
        .trim()
        .toUpperCase();
  
    if (!symbol) {
      ws.send(
        JSON.stringify({
          type: "ERROR",
          message: "symbol is required",
        })
      );
  
      return;
    }
  
    if (!ws.orderBookSubscriptions.has(symbol)) {
      ws.send(
        JSON.stringify({
          type: "ORDER_BOOK_NOT_SUBSCRIBED",
          symbol,
        })
      );
  
      return;
    }
  
    ws.orderBookSubscriptions.delete(symbol);
  
    marketStream.releaseDepth(
      symbol
    );
  
    console.log(
      `📴 Client unsubscribed from order book ${symbol}`
    );
  
    ws.send(
      JSON.stringify({
        type: "ORDER_BOOK_UNSUBSCRIBED",
        symbol,
      })
    );
  
    return;
  }

  // ------------------------------------------
// SUBSCRIBE TICKER
// ------------------------------------------

if (data.type === "SUBSCRIBE_TICKER") {
    const symbol =
      String(data.symbol || "")
        .trim()
        .toUpperCase();
  
    if (!symbol) {
      ws.send(
        JSON.stringify({
          type: "ERROR",
          message: "symbol is required",
        })
      );
  
      return;
    }
  
    if (ws.tickerSubscriptions.has(symbol)) {
      ws.send(
        JSON.stringify({
          type: "TICKER_ALREADY_SUBSCRIBED",
          symbol,
        })
      );
  
      return;
    }
  
    ws.tickerSubscriptions.add(symbol);
  
    marketStream.requireTicker(
      symbol
    );
  
    console.log(
      `📈 Client subscribed to ticker ${symbol}`
    );
  
    ws.send(
      JSON.stringify({
        type: "TICKER_SUBSCRIBED",
        symbol,
      })
    );
  
    return;
  }

  // ------------------------------------------
// UNSUBSCRIBE TICKER
// ------------------------------------------

if (data.type === "UNSUBSCRIBE_TICKER") {
    const symbol =
      String(data.symbol || "")
        .trim()
        .toUpperCase();
  
    if (!symbol) {
      ws.send(
        JSON.stringify({
          type: "ERROR",
          message: "symbol is required",
        })
      );
  
      return;
    }
  
    if (!ws.tickerSubscriptions.has(symbol)) {
      ws.send(
        JSON.stringify({
          type: "TICKER_NOT_SUBSCRIBED",
          symbol,
        })
      );
  
      return;
    }
  
    ws.tickerSubscriptions.delete(symbol);
  
    marketStream.releaseTicker(
      symbol
    );
  
    console.log(
      `📴 Client unsubscribed from ticker ${symbol}`
    );
  
    ws.send(
      JSON.stringify({
        type: "TICKER_UNSUBSCRIBED",
        symbol,
      })
    );
  
    return;
  }


// ------------------------------------------
// SUBSCRIBE TRADES
// ------------------------------------------

if (data.type === "SUBSCRIBE_TRADES") {
  const symbol =
    String(data.symbol || "")
      .trim()
      .toUpperCase();

  if (!symbol) {
    ws.send(
      JSON.stringify({
        type: "ERROR",
        message: "symbol is required",
      })
    );

    return;
  }

  if (ws.tradeSubscriptions.has(symbol)) {
    ws.send(
      JSON.stringify({
        type: "TRADES_ALREADY_SUBSCRIBED",
        symbol,
      })
    );

    return;
  }

  ws.tradeSubscriptions.add(symbol);

  marketStream.requireTrades(
    symbol
  );

  console.log(
    `📈 Client subscribed to trades ${symbol}`
  );

  ws.send(
    JSON.stringify({
      type: "TRADES_SUBSCRIBED",
      symbol,
    })
  );

  return;
}


// ------------------------------------------
// UNSUBSCRIBE TRADES
// ------------------------------------------

if (data.type === "UNSUBSCRIBE_TRADES") {
  const symbol =
    String(data.symbol || "")
      .trim()
      .toUpperCase();

  if (!symbol) {
    ws.send(
      JSON.stringify({
        type: "ERROR",
        message: "symbol is required",
      })
    );

    return;
  }

  if (!ws.tradeSubscriptions.has(symbol)) {
    ws.send(
      JSON.stringify({
        type: "TRADES_NOT_SUBSCRIBED",
        symbol,
      })
    );

    return;
  }

  ws.tradeSubscriptions.delete(symbol);

  marketStream.releaseTrades(
    symbol
  );

  console.log(
    `📴 Client unsubscribed from trades ${symbol}`
  );

  ws.send(
    JSON.stringify({
      type: "TRADES_UNSUBSCRIBED",
      symbol,
    })
  );

  return;
}

  // ------------------------------------------
// SUBSCRIBE SHARED MARKET DATA
// ------------------------------------------

if (data.type === "SUBSCRIBE_SHARED_MARKET_DATA") {
    const symbol =
      String(data.symbol || "")
        .trim()
        .toUpperCase();

    if (!symbol) {
      ws.send(
        JSON.stringify({
          type: "ERROR",
          message: "symbol is required",
        })
      );

      return;
    }

    if (ws.sharedMarketDataSubscriptions.has(symbol)) {
      ws.send(
        JSON.stringify({
          type: "SHARED_MARKET_DATA_ALREADY_SUBSCRIBED",
          symbol,
        })
      );

      return;
    }

    ws.sharedMarketDataSubscriptions.add(symbol);

    marketStream.requireSharedData(
      symbol
    );

    console.log(
      `📊 Client subscribed to shared market data ${symbol}`
    );

    ws.send(
      JSON.stringify({
        type: "SHARED_MARKET_DATA_SUBSCRIBED",
        symbol,
      })
    );

    return;
}

// ------------------------------------------
// UNSUBSCRIBE SHARED MARKET DATA
// ------------------------------------------

if (data.type === "UNSUBSCRIBE_SHARED_MARKET_DATA") {
    const symbol =
      String(data.symbol || "")
        .trim()
        .toUpperCase();

    if (!symbol) {
      ws.send(
        JSON.stringify({
          type: "ERROR",
          message: "symbol is required",
        })
      );

      return;
    }

    if (!ws.sharedMarketDataSubscriptions.has(symbol)) {
      ws.send(
        JSON.stringify({
          type: "SHARED_MARKET_DATA_NOT_SUBSCRIBED",
          symbol,
        })
      );

      return;
    }

    ws.sharedMarketDataSubscriptions.delete(symbol);

    marketStream.releaseSharedData(
      symbol
    );

    console.log(
      `📴 Client unsubscribed from shared market data ${symbol}`
    );

    ws.send(
      JSON.stringify({
        type: "SHARED_MARKET_DATA_UNSUBSCRIBED",
        symbol,
      })
    );

    return;
}

        // ------------------------------------------
        // SUBSCRIBE
        // ------------------------------------------

        if (data.type === "SUBSCRIBE") {
          const accountId =
            String(data.accountId || "").trim();

          if (!accountId) {
            ws.send(
              JSON.stringify({
                type: "ERROR",
                message:
                  "accountId is required",
              })
            );

            return;
          }

          // Remove previous subscription
          removeClientSubscription(ws);

          ws.accountId = accountId;

          if (
            !accountSubscribers.has(
              accountId
            )
          ) {
            accountSubscribers.set(
              accountId,
              new Set()
            );
          }

          accountSubscribers
            .get(accountId)
            .add(ws);

          console.log(
            `📡 Client subscribed to account ${accountId}`
          );

          ws.send(
            JSON.stringify({
              type: "SUBSCRIBED",
              accountId,
            })
          );

          return;
        }

        // ------------------------------------------
        // UNSUBSCRIBE
        // ------------------------------------------

        if (
          data.type === "UNSUBSCRIBE"
        ) {
          removeClientSubscription(ws);

          ws.send(
            JSON.stringify({
              type: "UNSUBSCRIBED",
            })
          );

          return;
        }

        // ------------------------------------------
        // Unknown message
        // ------------------------------------------

        ws.send(
          JSON.stringify({
            type: "ERROR",
            message:
              "Unknown message type",
          })
        );
      } catch (error) {
        console.error(
          "❌ Trading WS message error:",
          error.message
        );

        ws.send(
          JSON.stringify({
            type: "ERROR",
            message: "Invalid JSON",
          })
        );
      }
    });

    // ----------------------------------------------
    // Disconnect
    // ----------------------------------------------

    ws.on("close", () => {
      releaseClientSymbols(ws);
      removeClientSubscription(ws);

      console.log(
        "🟠 Trading client disconnected"
      );
    });

    ws.on("error", (error) => {
      console.error(
        "🔴 Trading client WebSocket error:",
        error.message
      );

      releaseClientSymbols(ws);
      removeClientSubscription(ws);
    });

    // ----------------------------------------------
    // Initial response
    // ----------------------------------------------

    ws.send(
      JSON.stringify({
        type: "CONNECTED",
        message:
          "Trading WebSocket connected",
      })
    );
  });

  // ------------------------------------------------
  // Heartbeat
  // ------------------------------------------------

  const heartbeat = setInterval(() => {
    if (!wss) {
      return;
    }

    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) {
        releaseClientSymbols(ws);
        removeClientSubscription(ws);
        return ws.terminate();
      }

      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on("close", () => {
    clearInterval(heartbeat);
    accountSubscribers.clear();
  });

  return wss;
};

const releaseClientSymbols = (ws) => {
    const hasSymbolSubscriptions =
      ws.symbolSubscriptions &&
      ws.symbolSubscriptions.size > 0;
  
    const hasOrderBookSubscriptions =
      ws.orderBookSubscriptions &&
      ws.orderBookSubscriptions.size > 0;

      const hasBookTickerSubscriptions =
  ws.bookTickerSubscriptions &&
  ws.bookTickerSubscriptions.size > 0;

  const hasMarkPriceSubscriptions =
  ws.markPriceSubscriptions &&
  ws.markPriceSubscriptions.size > 0;

  const hasTickerSubscriptions =
  ws.tickerSubscriptions &&
  ws.tickerSubscriptions.size > 0;

  const hasSharedMarketDataSubscriptions =
  ws.sharedMarketDataSubscriptions &&
  ws.sharedMarketDataSubscriptions.size > 0;

  const hasTradeSubscriptions =
  ws.tradeSubscriptions &&
  ws.tradeSubscriptions.size > 0;
  
    if (!hasSymbolSubscriptions 
        && !hasOrderBookSubscriptions 
        && !hasBookTickerSubscriptions
        &&  !hasMarkPriceSubscriptions
        && !hasTickerSubscriptions
        && !hasSharedMarketDataSubscriptions
        && !hasTradeSubscriptions) {
      return;
    }
  
    if (hasSymbolSubscriptions) {
      for (const symbol of ws.symbolSubscriptions) {
        marketStream.releaseSymbol(
          symbol,
          "chart"
        );
  
        console.log(
          `📴 Released client symbol ${symbol}`
        );
      }
  
      ws.symbolSubscriptions.clear();
    }
  
    if (hasOrderBookSubscriptions) {
      for (const symbol of ws.orderBookSubscriptions) {
        marketStream.releaseDepth(
          symbol
        );
  
        console.log(
          `📴 Released order book ${symbol}`
        );
      }
  
      ws.orderBookSubscriptions.clear();
    }

    if (hasBookTickerSubscriptions) {
        for (const symbol of ws.bookTickerSubscriptions) {
          marketStream.releaseBookTicker(
            symbol
          );
      
          console.log(
            `📴 Released book ticker ${symbol}`
          );
        }
      
        ws.bookTickerSubscriptions.clear();
      }

      if (hasMarkPriceSubscriptions) {
        for (const symbol of ws.markPriceSubscriptions) {
          marketStream.releaseMarkPrice(
            symbol
          );
      
          console.log(
            `📴 Released mark price ${symbol}`
          );
        }
      
        ws.markPriceSubscriptions.clear();
      }

      if (hasTickerSubscriptions) {
        for (const symbol of ws.tickerSubscriptions) {
          marketStream.releaseTicker(
            symbol
          );
      
          console.log(
            `📴 Released ticker ${symbol}`
          );
        }
      
        ws.tickerSubscriptions.clear();
      }

      if (hasSharedMarketDataSubscriptions) {
        for (
          const symbol of ws.sharedMarketDataSubscriptions
        ) {
          marketStream.releaseSharedData(
            symbol
          );
      
          console.log(
            `📴 Released shared market data ${symbol}`
          );
        }
      
        ws.sharedMarketDataSubscriptions.clear();
      }

      if (hasTradeSubscriptions) {
  for (const symbol of ws.tradeSubscriptions) {
    marketStream.releaseTrades(
      symbol
    );

    console.log(
      `📴 Released trades ${symbol}`
    );
  }

  ws.tradeSubscriptions.clear();
}
  };

// --------------------------------------------------
// Remove client subscription
// --------------------------------------------------

const removeClientSubscription = (ws) => {
  const accountId = ws.accountId;

  if (!accountId) {
    return;
  }

  const clients =
    accountSubscribers.get(accountId);

  if (clients) {
    clients.delete(ws);

    if (clients.size === 0) {
      accountSubscribers.delete(
        accountId
      );
    }
  }

  ws.accountId = null;
  
};

// --------------------------------------------------
// Send to one account
// --------------------------------------------------

const sendToAccount = (
  accountId,
  payload
) => {
  if (!wss) {
    return;
  }

  const clients =
    accountSubscribers.get(
      String(accountId)
    );

  if (!clients) {
    return;
  }

  const message =
    JSON.stringify(payload);

  clients.forEach((ws) => {
    if (
      ws.readyState === WebSocket.OPEN
    ) {
      ws.send(message);
    }
  });
};

// --------------------------------------------------
// Broadcast to everyone
// --------------------------------------------------

const broadcast = (payload) => {
  if (!wss) {
    return;
  }

  const message =
    JSON.stringify(payload);

  wss.clients.forEach((ws) => {
    if (
      ws.readyState === WebSocket.OPEN
    ) {
      ws.send(message);
    }
  });
};

// --------------------------------------------------
// Client count
// --------------------------------------------------

const getClientCount = () => {
  if (!wss) {
    return 0;
  }

  return wss.clients.size;
};

// --------------------------------------------------
// Close
// --------------------------------------------------

const close = () => {
  if (!wss) {
    return;
  }

  wss.close();

  wss = null;

  accountSubscribers.clear();

  console.log(
    "🛑 Trading WebSocket server stopped"
  );
};
const getSubscribedAccountIds = () => {
    return Array.from(
      accountSubscribers.keys()
    );
  };

module.exports = {
  initializeTradingWebSocket,
  sendToAccount,
  broadcast,
  getClientCount,
  getSubscribedAccountIds,
  close,
};  