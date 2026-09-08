const { DataTypes } = require("sequelize");

const sequelize = require("../../config/db");

const TradingOrder = sequelize.define(
  "TradingOrder",
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },

    tradeId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: "trade_id",
      },

    accountId: {
      type: DataTypes.STRING(50),
      allowNull: false,
      field: "account_id",
    },

    symbol: {
      type: DataTypes.STRING(30),
      allowNull: false,
    },

    side: {
      type: DataTypes.ENUM("BUY", "SELL"),
      allowNull: false,
    },

    positionSide: {
      type: DataTypes.ENUM("LONG", "SHORT"),
      allowNull: false,
      field: "position_side",
    },

    orderType: {
      type: DataTypes.ENUM(
        "MARKET",
        "LIMIT",
        "STOP",
        "STOP_MARKET",
        "TAKE_PROFIT",
        "TAKE_PROFIT_MARKET"
      ),
      allowNull: false,
      field: "order_type",
    },

    quantity: {
      type: DataTypes.DECIMAL(30, 8),
      allowNull: false,
    },

    price: {
      type: DataTypes.DECIMAL(30, 8),
      allowNull: true,
    },

    triggerPrice: {
      type: DataTypes.DECIMAL(30, 8),
      allowNull: true,
      field: "trigger_price",
    },

    leverage: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 1,
    },

    marginMode: {
      type: DataTypes.ENUM("ISOLATED", "CROSS"),
      allowNull: false,
      defaultValue: "ISOLATED",
      field: "margin_mode",
    },

    reduceOnly: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: "reduce_only",
    },

    takeProfit: {
      type: DataTypes.DECIMAL(30, 8),
      allowNull: true,
      field: "take_profit",
    },

    stopLoss: {
      type: DataTypes.DECIMAL(30, 8),
      allowNull: true,
      field: "stop_loss",
    },

    status: {
      type: DataTypes.ENUM(
        "NEW",
        "OPEN",
        "PARTIALLY_FILLED",
        "FILLED",
        "CANCELLED",
        "REJECTED",
        "EXPIRED"
      ),
      allowNull: false,
      defaultValue: "NEW",
    },

    filledQuantity: {
      type: DataTypes.DECIMAL(30, 8),
      allowNull: false,
      defaultValue: 0,
      field: "filled_quantity",
    },

    averagePrice: {
      type: DataTypes.DECIMAL(30, 8),
      allowNull: true,
      field: "average_price",
    },

    fee: {
      type: DataTypes.DECIMAL(30, 8),
      allowNull: false,
      defaultValue: 0,
    },

    parentOrderId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
      field: "parent_order_id",
    },

    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: "created_at",
      defaultValue: DataTypes.NOW,
    },

    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: "updated_at",
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "trading_orders",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

module.exports = TradingOrder;