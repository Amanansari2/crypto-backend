const TradingAccount = require("./trading_account_model");
const TradingOrder = require("./trading_order_model");
const TradingOrderFill = require("./trading_order_fill_model");
const TradingPosition = require("./trading_position_model");
const TradingTransaction = require("./trading_transaction_model");

// Account → Orders
TradingAccount.hasMany(TradingOrder, {
  foreignKey: "accountId",
  as: "orders",
});

TradingOrder.belongsTo(TradingAccount, {
  foreignKey: "accountId",
  as: "account",
});

// Account → Positions
TradingAccount.hasMany(TradingPosition, {
  foreignKey: "accountId",
  as: "positions",
});

TradingPosition.belongsTo(TradingAccount, {
  foreignKey: "accountId",
  as: "account",
});

// Account → Transactions
TradingAccount.hasMany(TradingTransaction, {
  foreignKey: "accountId",
  as: "transactions",
});

TradingTransaction.belongsTo(TradingAccount, {
  foreignKey: "accountId",
  as: "account",
});

// Order → Fills
TradingOrder.hasMany(TradingOrderFill, {
  foreignKey: "orderId",
  as: "fills",
});

TradingOrderFill.belongsTo(TradingOrder, {
  foreignKey: "orderId",
  as: "order",
});

// Account → Fills
TradingAccount.hasMany(TradingOrderFill, {
  foreignKey: "accountId",
  as: "fills",
});

TradingOrderFill.belongsTo(TradingAccount, {
  foreignKey: "accountId",
  as: "account",
});

module.exports = {
  TradingAccount,
  TradingOrder,
  TradingOrderFill,
  TradingPosition,
  TradingTransaction,
};