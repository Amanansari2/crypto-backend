const {
    getAllPositionsPnl,
  } = require("./position_pnl_service");
  
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
  // Broadcast PnL for one symbol
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
  
      for (const accountId of accountIds) {
        try {
          const positions =
            await getAllPositionsPnl(
              accountId
            );
  
          // Only send if this account has
          // an open position for this symbol.
          const affectedPositions =
            positions.filter(
              (position) =>
                position.symbol === symbol
            );
  
          if (!affectedPositions.length) {
            continue;
          }
  
          for (const position of affectedPositions){
          sendToAccount(
            accountId,
            {
              type: "POSITION_PNL",
              accountId,
              tradeId: position.tradeId,
              positionId: position.id,
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
  // Start event-driven PnL
  // --------------------------------------------------
  
  const startPnlBroadcast = () => {
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