const { TradingPosition } = require("../../models/trading");
const marketStream = require("../../websocket/binance_market_stream.service");
const toNumber = (value) => Number(value);

/**
 * Set, modify, or remove TP / SL
 * for one specific trade.
 */
const updateTradeTpSl = async ({
  accountId,
  tradeId,
  takeProfit = undefined,
  stopLoss = undefined,
}) => {
  if (!accountId) {
    throw new Error("Account ID is required");
  }

  if (!tradeId) {
    throw new Error("tradeId is required");
  }

  // --------------------------------------------------
  // Find exact open trade
  // --------------------------------------------------

  const position = await TradingPosition.findOne({
    where: {
      accountId,
      tradeId,
      status: "OPEN",
    },
  });

  if (!position) {
    throw new Error(
      `No open position found for tradeId ${tradeId}`
    );
  }

  const entryPrice = toNumber(position.entryPrice);

  marketStream.requireSymbol(
    position.symbol,
    "tpSl"
  );

 let marketData;

try {
  marketData =
    await marketStream.waitForMarketData(
      position.symbol
    );
} finally {
  marketStream.releaseSymbol(
    position.symbol,
    "tpSl"
  );
}

const currentPrice =
  toNumber(marketData.markPrice);

if (
  !Number.isFinite(currentPrice) ||
  currentPrice <= 0
) {
  throw new Error(
    `Invalid current market price for ${position.symbol}`
  );
}

  // --------------------------------------------------
  // Keep existing values when not supplied
  // --------------------------------------------------

  let newTakeProfit =
    takeProfit === undefined
      ? position.takeProfit
      : takeProfit;

  let newStopLoss =
    stopLoss === undefined
      ? position.stopLoss
      : stopLoss;

  // --------------------------------------------------
  // Convert values
  // --------------------------------------------------

  if (newTakeProfit !== null) {
    newTakeProfit = toNumber(newTakeProfit);

    if (
      !Number.isFinite(newTakeProfit) ||
      newTakeProfit <= 0
    ) {
      throw new Error(
        "Invalid take profit price"
      );
    }
  }

  if (newStopLoss !== null) {
    newStopLoss = toNumber(newStopLoss);

    if (
      !Number.isFinite(newStopLoss) ||
      newStopLoss <= 0
    ) {
      throw new Error(
        "Invalid stop loss price"
      );
    }
  }

  // --------------------------------------------------
  // LONG validation
  // --------------------------------------------------

  if (position.side === "LONG") {
    if (
      newStopLoss !== null &&
      newStopLoss >= currentPrice
    ) {
      throw new Error(
        `Stop loss must be below current price for LONG. Current: ${currentPrice}, SL: ${newStopLoss}`
      );
    }

    if (
      newTakeProfit !== null &&
      ( newTakeProfit <= entryPrice ||
        newTakeProfit <= currentPrice)
    ) {
      throw new Error(
        `Take profit must be above entry and current price for LONG. Entry: ${entryPrice}, Current:${currentPrice}, TP: ${newTakeProfit}`
      );
    }
    console.log("🔎 TP/SL VALIDATION:", {
        symbol: position.symbol,
        side: position.side,
        entryPrice,
        currentPrice,
        takeProfit: newTakeProfit,
        stopLoss: newStopLoss,
      });
  }

  // --------------------------------------------------
  // SHORT validation
  // --------------------------------------------------

  if (position.side === "SHORT") {
    if (
      newStopLoss !== null &&
      newStopLoss <= currentPrice
    ) {
      throw new Error(
        `Stop loss must be above current price for SHORT. Current: ${currentPrice}, SL: ${newStopLoss}`
      );
    }

    if (
      newTakeProfit !== null &&
      (newTakeProfit >= entryPrice ||
      newTakeProfit >= currentPrice)
    ) {
      throw new Error(
        `Take profit must be below entry and current price for SHORT. Entry: ${entryPrice}, Current:${currentPrice}, TP: ${newTakeProfit}`
      );
    }
  }

  // --------------------------------------------------
  // Update exact trade
  // --------------------------------------------------

  await position.update({
    takeProfit: newTakeProfit,
    stopLoss: newStopLoss,
  });

  return {
    success: true,

    position: {
      id: position.id,
      tradeId: position.tradeId,
      accountId: position.accountId,
      symbol: position.symbol,
      side: position.side,
      quantity: toNumber(position.quantity),
      entryPrice,
      takeProfit:
        position.takeProfit === null
          ? null
          : toNumber(position.takeProfit),
      stopLoss:
        position.stopLoss === null
          ? null
          : toNumber(position.stopLoss),
      status: position.status,
    },
  };
};

module.exports = {
  updateTradeTpSl,
};