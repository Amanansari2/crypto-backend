
const round = (value, decimals = 8) => {
  return Number(Number(value).toFixed(decimals));
};

const toNumber = (value) => Number(value);

// Notional = Quantity × Price
const calculateNotional = (quantity, price) => {
  return round(quantity * price);
};

// Margin = Notional ÷ Leverage
const calculateMargin = (notional, leverage) => {
  return round(notional / leverage);
};

// Fee calculation only — no wallet deduction here
const calculateFee = (notional, feeRate) => {
  return round(notional * feeRate);
};

// Unrealized PnL
const calculateUnrealizedPnl = ({
  side,
  entryPrice,
  markPrice,
  quantity,
}) => {
  const pnl = side === "LONG"
    ? (markPrice - entryPrice) * quantity
    : (entryPrice - markPrice) * quantity;

  return round(pnl);
};

// Realized PnL
const calculateRealizedPnl = ({
  side,
  entryPrice,
  exitPrice,
  quantity,
}) => {
  const pnl = side === "LONG"
    ? (exitPrice - entryPrice) * quantity
    : (entryPrice - exitPrice) * quantity;

  return round(pnl);
};

// ROI = PnL ÷ Margin × 100
const calculateRoi = (pnl, margin) => {
  if (!margin) return 0;

  return round((pnl / margin) * 100);
};

// Partial or full margin release
const calculateReleasedMargin = ({
  oldMargin,
  closeQuantity,
  oldQuantity,
}) => {
  if (!oldQuantity) return 0;

  return round(oldMargin * (closeQuantity / oldQuantity));
};

module.exports = {
  round,
  toNumber,
  calculateNotional,
  calculateMargin,
  calculateFee,
  calculateUnrealizedPnl,
  calculateRealizedPnl,
  calculateRoi,
  calculateReleasedMargin,
};
