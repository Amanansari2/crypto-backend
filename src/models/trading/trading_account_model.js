const { DataTypes } = require("sequelize");

const sequelize = require("../../config/db");

const TradingAccount = sequelize.define(
  "TradingAccount",
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },

    accountId: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
      field: "account_id",
    },

    currency: {
      type: DataTypes.STRING(10),
      allowNull: false,
      defaultValue: "USDT",
    },

    balance: {
      type: DataTypes.DECIMAL(30, 8),
      allowNull: false,
      defaultValue: 10000,
    },

    availableBalance: {
      type: DataTypes.DECIMAL(30, 8),
      allowNull: false,
      defaultValue: 10000,
      field: "available_balance",
    },

    usedMargin: {
      type: DataTypes.DECIMAL(30, 8),
      allowNull: false,
      defaultValue: 0,
      field: "used_margin",
    },

    realizedPnl: {
      type: DataTypes.DECIMAL(30, 8),
      allowNull: false,
      defaultValue: 0,
      field: "realized_pnl",
    },

    totalFees: {
      type: DataTypes.DECIMAL(30, 8),
      allowNull: false,
      defaultValue: 0,
      field: "total_fees",
    },

    status: {
      type: DataTypes.ENUM(
        "ACTIVE",
        "SUSPENDED",
        "CLOSED"
      ),
      allowNull: false,
      defaultValue: "ACTIVE",
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
    tableName: "trading_accounts",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

module.exports = TradingAccount;