const { DataTypes } = require("sequelize");

const sequelize = require("../../config/db");

const TradingPosition = sequelize.define(
  "TradingPosition",
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    tradeId: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        allowNull: false,
        unique: true,
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
      type: DataTypes.ENUM("LONG", "SHORT"),
      allowNull: false,
    },

    quantity: {
      type: DataTypes.DECIMAL(30, 8),
      allowNull: false,
      defaultValue: 0,
    },

    entryPrice: {
      type: DataTypes.DECIMAL(30, 8),
      allowNull: false,
      field: "entry_price",
    },

    markPrice: {
      type: DataTypes.DECIMAL(30, 8),
      allowNull: false,
      field: "mark_price",
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

    margin: {
      type: DataTypes.DECIMAL(30, 8),
      allowNull: false,
      defaultValue: 0,
    },

    unrealizedPnl: {
      type: DataTypes.DECIMAL(30, 8),
      allowNull: false,
      defaultValue: 0,
      field: "unrealized_pnl",
    },

    realizedPnl: {
      type: DataTypes.DECIMAL(30, 8),
      allowNull: false,
      defaultValue: 0,
      field: "realized_pnl",
    },

    liquidationPrice: {
      type: DataTypes.DECIMAL(30, 8),
      allowNull: true,
      field: "liquidation_price",
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
        "OPEN",
        "CLOSED"
      ),
      allowNull: false,
      defaultValue: "OPEN",
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
    tableName: "trading_positions",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

module.exports = TradingPosition;