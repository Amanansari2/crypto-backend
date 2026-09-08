const TradingPosition = require("../../models/trading/trading_position_model");
const marketStream = require("../../websocket/binance_market_stream.service");

// --------------------------------------------------
// Helpers
// --------------------------------------------------

const toNumber = (value) => Number(value);

const round = (value, decimals = 8) => {
  return Number(Number(value).toFixed(decimals));
};

// --------------------------------------------------
// Calculate PnL for one position
// --------------------------------------------------

const calculatePositionPnl = (position) => {
  const symbol = String(position.symbol).toUpperCase();

  const marketData = marketStream.getMarketData(symbol);

  if (!marketData) {
    return null;
  }

  const entryPrice = toNumber(position.entryPrice);
  const quantity = toNumber(position.quantity);
  const markPrice = toNumber(marketData.markPrice);
  const margin = toNumber(position.margin);

  if (
    !Number.isFinite(entryPrice) ||
    !Number.isFinite(quantity) ||
    !Number.isFinite(markPrice)
  ) {
    return null;
  }

  let unrealizedPnl = 0;

  if (position.side === "LONG") {
    unrealizedPnl =
      (markPrice - entryPrice) * quantity;
  } else if (position.side === "SHORT") {
    unrealizedPnl =
      (entryPrice - markPrice) * quantity;
  }

  const roi =
    margin > 0
      ? (unrealizedPnl / margin) * 100
      : 0;

  return {
    id: position.id,
    tradeId: position.tradeId,
    accountId: String(position.accountId),
    symbol,
    side: position.side,
    quantity: round(quantity),
    entryPrice: round(entryPrice),
    markPrice: round(markPrice),
    margin: round(margin),
    leverage: toNumber(position.leverage),

    unrealizedPnl: round(unrealizedPnl),
    roi: round(roi, 4),

    status: position.status,
    timestamp: Date.now(),
  };
};

// --------------------------------------------------
// Get all open positions for account
// --------------------------------------------------

const getAllPositionsPnl = async (accountId) => {
  const positions = await TradingPosition.findAll({
    where: {
      accountId: String(accountId),
      status: "OPEN",
    },
    order: [["id", "ASC"]],
  });

  return positions
    .map(calculatePositionPnl)
    .filter(Boolean);
};

// --------------------------------------------------
// Get one position
// --------------------------------------------------

const getPositionPnl = async ({
  accountId,
  symbol,
}) => {
  const position = await TradingPosition.findOne({
    where: {
      accountId: String(accountId),
      symbol: String(symbol).toUpperCase(),
      status: "OPEN",
    },
  });

  if (!position) {
    return null;
  }

  return calculatePositionPnl(position);
};

// --------------------------------------------------
// Total account unrealized PnL
// --------------------------------------------------

const getTotalUnrealizedPnl = async (accountId) => {
  const positions =
    await getAllPositionsPnl(accountId);

  const total = positions.reduce(
    (sum, position) =>
      sum + position.unrealizedPnl,
    0
  );

  return {
    accountId: String(accountId),
    totalUnrealizedPnl: round(total),
    positions,
    timestamp: Date.now(),
  };
};

module.exports = {
  calculatePositionPnl,
  getAllPositionsPnl,
  getPositionPnl,
  getTotalUnrealizedPnl,
};