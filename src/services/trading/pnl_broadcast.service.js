// const {
//     getAllPositionsPnl,
//   } = require("./position_pnl_service");
  
//   const {
//     sendToAccount,
//     getSubscribedAccountIds,
//   } = require(
//     "../../websocket/trading_client_ws.service"
//   );
  
//   const marketEvents = require(
//     "./market_event.service"
//   );
  
//   let running = false;
  
//   // --------------------------------------------------
//   // Broadcast PnL for one symbol
//   // --------------------------------------------------
  
//   const broadcastSymbolPnl = async (symbol) => {
//     if (running) {
//       return;
//     }
  
//     running = true;
  
//     try {
//       const accountIds =
//         getSubscribedAccountIds();
  
//       if (!accountIds.length) {
//         return;
//       }
  
//       for (const accountId of accountIds) {
//         try {
//           const positions =
//             await getAllPositionsPnl(
//               accountId
//             );
  
//           // Only send if this account has
//           // an open position for this symbol.
//           const affectedPositions =
//             positions.filter(
//               (position) =>
//                 position.symbol === symbol
//             );
  
//           if (!affectedPositions.length) {
//             continue;
//           }
  
//           for (const position of affectedPositions){
//           sendToAccount(
//             accountId,
//             {
//               type: "POSITION_LIVE_PNL",
//               accountId,
//               tradeId: position.tradeId,
//               positionId: position.id,
//               position,
//               timestamp: Date.now(),
//             }
//           );
//         }
//         } catch (error) {
//           console.error(
//             `❌ PnL update failed for ${accountId}:`,
//             error.message
//           );
//         }
//       }
//     } finally {
//       running = false;
//     }
//   };
  
//   // --------------------------------------------------
//   // Start event-driven PnL
//   // --------------------------------------------------
  
//   const startPnlBroadcast = () => {
//     marketEvents.on(
//       "markPrice",
//       ({ symbol }) => {
//         broadcastSymbolPnl(symbol);
//       }
//     );
  
//     console.log(
//       "📈 Event-driven PnL broadcaster started"
//     );
//   };
  
//   // --------------------------------------------------
//   // Export
//   // --------------------------------------------------
  
//   module.exports = {
//     startPnlBroadcast,
//   };


const {
  getAllPositionsPnl,
} = require("./position_pnl_service");

const TradingPosition = require(
  "../../models/trading/trading_position_model"
);

const marketStream = require(
  "../../websocket/binance_market_stream.service"
);

const {
  sendToAccount,
  getSubscribedAccountIds,
} = require(
  "../../websocket/trading_client_ws.service"
);

const marketEvents = require(
  "./market_event.service"
);

let running = false;

// --------------------------------------------------
// PnL Mark Price Symbols
// --------------------------------------------------

// Symbols that are currently required by
// the live position PnL system.
const pnlMarkPriceSymbols = new Set();

// --------------------------------------------------
// Ensure Mark Price For All Open Positions
// --------------------------------------------------

const ensurePositionMarkPrices = async (
  accountIds
) => {
  const requiredSymbols = new Set();

  for (const accountId of accountIds) {
    const positions =
      await TradingPosition.findAll({
        where: {
          accountId: String(accountId),
          status: "OPEN",
        },
        attributes: ["symbol"],
      });

    for (const position of positions) {
      const symbol =
        String(position.symbol).toUpperCase();

      if (symbol) {
        requiredSymbols.add(symbol);
      }
    }
  }

  // ------------------------------------------------
  // Require newly needed symbols
  // ------------------------------------------------

  for (const symbol of requiredSymbols) {
    if (!pnlMarkPriceSymbols.has(symbol)) {
      marketStream.requireMarkPrice(symbol);

      pnlMarkPriceSymbols.add(symbol);

      console.log(
        `📈 PnL Mark Price required: ${symbol}`
      );
    }
  }

  // ------------------------------------------------
  // Release symbols that are no longer required
  // ------------------------------------------------

  for (
    const symbol of [...pnlMarkPriceSymbols]
  ) {
    if (!requiredSymbols.has(symbol)) {
      marketStream.releaseMarkPrice(symbol);

      pnlMarkPriceSymbols.delete(symbol);

      console.log(
        `📉 PnL Mark Price released: ${symbol}`
      );
    }
  }
};

// --------------------------------------------------
// Broadcast PnL
// --------------------------------------------------

const broadcastSymbolPnl = async (symbol) => {
  if (running) {
    return;
  }

  running = true;

  try {
    const accountIds =
      getSubscribedAccountIds();

    if (!accountIds.length) {
      return;
    }

    // Make sure mark price stays active
    // for ALL open position symbols.
    await ensurePositionMarkPrices(
      accountIds
    );

    // ------------------------------------------------
    // Process every subscribed account
    // ------------------------------------------------

    for (const accountId of accountIds) {
      try {
        const positions =
          await getAllPositionsPnl(
            accountId
          );

        // ------------------------------------------------
        // Send ALL open positions
        // ------------------------------------------------

        for (const position of positions) {
          sendToAccount(
            accountId,
            {
              type: "POSITION_LIVE_PNL",

              accountId,

              tradeId:
                position.tradeId,

              positionId:
                position.id,

              position,

              timestamp: Date.now(),
            }
          );
        }
      } catch (error) {
        console.error(
          `❌ PnL update failed for ${accountId}:`,
          error.message
        );
      }
    }
  } finally {
    running = false;
  }
};

// --------------------------------------------------
// Start Event-Driven PnL
// --------------------------------------------------

const startPnlBroadcast = async () => {
  // ------------------------------------------------
  // Initial sync
  // ------------------------------------------------

  const accountIds =
    getSubscribedAccountIds();

  if (accountIds.length) {
    try {
      await ensurePositionMarkPrices(
        accountIds
      );
    } catch (error) {
      console.error(
        "❌ Initial PnL mark price sync failed:",
        error.message
      );
    }
  }

  // ------------------------------------------------
  // Listen for mark price updates
  // ------------------------------------------------

  marketEvents.on(
    "markPrice",
    ({ symbol }) => {
      broadcastSymbolPnl(symbol);
    }
  );

  console.log(
    "📈 Event-driven PnL broadcaster started"
  );
};

// --------------------------------------------------
// Export
// --------------------------------------------------

module.exports = {
  startPnlBroadcast,
};