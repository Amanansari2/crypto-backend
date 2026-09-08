const {
    TradingPosition,
  } = require("../../models/trading");
  
  const marketEvents = require("./market_event.service");
  const marketStream = require("../../websocket/binance_market_stream.service");
  const { closeTrade } = require("./trade_close.service");
  
  const toNumber = (value) => Number(value);
  
  /**
   * Check whether a position's TP or SL has been triggered.
   */
  const checkPosition = async (position, markPrice) => {
    const price = toNumber(markPrice);
  
    if (!Number.isFinite(price) || price <= 0) {
      return;
    }
  
    const takeProfit = position.takeProfit
      ? toNumber(position.takeProfit)
      : null;
  
    const stopLoss = position.stopLoss
      ? toNumber(position.stopLoss)
      : null;
  
    let triggerType = null;
  
    // --------------------------------------------------
    // LONG
    // --------------------------------------------------
  
    if (position.side === "LONG") {
      if (
        takeProfit !== null &&
        price >= takeProfit
      ) {
        triggerType = "TAKE_PROFIT";
      } else if (
        stopLoss !== null &&
        price <= stopLoss
      ) {
        triggerType = "STOP_LOSS";
      }
    }
  
    // --------------------------------------------------
    // SHORT
    // --------------------------------------------------
  
    if (position.side === "SHORT") {
      if (
        takeProfit !== null &&
        price <= takeProfit
      ) {
        triggerType = "TAKE_PROFIT";
      } else if (
        stopLoss !== null &&
        price >= stopLoss
      ) {
        triggerType = "STOP_LOSS";
      }
    }
  
    if (!triggerType) {
      return;
    }
  
    // --------------------------------------------------
    // Determine closing side
    // --------------------------------------------------
  
    const closingSide =
      position.side === "LONG"
        ? "SELL"
        : "BUY";
  
    const quantity =
      toNumber(position.quantity);
  
    if (quantity <= 0) {
      return;
    }
  
    console.log(
      `🎯 ${triggerType} triggered | ` +
      `tradeId=${position.tradeId} | ` +
      `${position.side} ${position.symbol} | ` +
      `trigger=${price}`
    );
  
    try {
      const result = await closeTrade({
        accountId: position.accountId,
        symbol: position.symbol,
        tradeId: position.tradeId,
        quantity,
        side: closingSide,
        orderType:
          triggerType === "TAKE_PROFIT"
            ? "TAKE_PROFIT_MARKET"
            : "STOP_MARKET",
        executionPrice: price,
        triggerPrice:
          triggerType === "TAKE_PROFIT"
            ? takeProfit
            : stopLoss,
      });
  
      console.log(
        `✅ ${triggerType} executed | ` +
        `tradeId=${position.tradeId} | ` +
        `positionId=${position.id}`
      );
  
      return result;
    } catch (error) {
      console.error(
        `❌ ${triggerType} execution failed | ` +
        `tradeId=${position.tradeId} |`,
        error.message
      );
    }
  };
  
  /**
   * Handle every mark-price update.
   */
  const handleMarkPrice = async ({
    symbol,
    markPrice,
  }) => {
    try {
      const positions =
        await TradingPosition.findAll({
          where: {
            symbol,
            status: "OPEN",
          },
        });
  
      if (!positions.length) {
        return;
      }
  
      for (const position of positions) {
        await checkPosition(
          position,
          markPrice
        );
      }
    } catch (error) {
      console.error(
        "❌ TP/SL mark-price handler error:",
        error.message
      );
    }
  };
  

  const restoreTpSlSymbols = async () => {
    const positions = await TradingPosition.findAll({
      where: {
        status: "OPEN",
      },
      attributes: ["symbol"],
    });
  
    const symbols = [
      ...new Set(
        positions
          .map((position) => position.symbol)
          .filter(Boolean)
          .map((symbol) => String(symbol).toUpperCase())
      ),
    ];
  
    for (const symbol of symbols) {
      marketStream.requireSymbol(symbol, "tpSl");
    }
  
    console.log(
      `🔄 Restored TP/SL symbols: ${symbols.length}`,
      symbols
    );
  };


  // --------------------------------------------------
  // Start listener
  // --------------------------------------------------
  
  const startTpSlExecution = () => {
    marketEvents.on(
      "markPrice",
      handleMarkPrice
    );
  
    console.log(
      "🎯 TP/SL execution service started"
    );
  };
  
  module.exports = {
    startTpSlExecution,
    restoreTpSlSymbols,
    handleMarkPrice,
    checkPosition,
  };