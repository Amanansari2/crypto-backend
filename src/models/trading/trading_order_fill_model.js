const { DataTypes } = require("sequelize");

const sequelize = require("../../config/db");

const TradingOrderFill = sequelize.define(
  "TradingOrderFill",
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },

    orderId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      field: "order_id",
    },

    positionId: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: true,
        field: "position_id",
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

    quantity: {
      type: DataTypes.DECIMAL(30, 8),
      allowNull: false,
    },

    price: {
      type: DataTypes.DECIMAL(30, 8),
      allowNull: false,
    },

    fee: {
      type: DataTypes.DECIMAL(30, 8),
      allowNull: false,
      defaultValue: 0,
    },


    realizedPnl: {
      type: DataTypes.DECIMAL(30, 8),
      allowNull: false,
      defaultValue: 0,
      field: "realized_pnl",
    },

    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: "created_at",
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "trading_order_fills",
    timestamps: false,
  }
);

module.exports = TradingOrderFill;