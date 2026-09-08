const { DataTypes } = require("sequelize");

const sequelize = require("../../config/db");

const TradingTransaction = sequelize.define(
  "TradingTransaction",
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },

    accountId: {
      type: DataTypes.STRING(50),
      allowNull: false,
      field: "account_id",
    },

    type: {
      type: DataTypes.ENUM(
        "DEPOSIT",
        "WITHDRAWAL",
        "MARGIN",
        "MARGIN_RELEASE",
        "REALIZED_PNL",
        "FEE",
        "FUNDING_FEE",
        "LIQUIDATION"
      ),
      allowNull: false,
    },

    amount: {
      type: DataTypes.DECIMAL(30, 8),
      allowNull: false,
    },

    balanceBefore: {
      type: DataTypes.DECIMAL(30, 8),
      allowNull: false,
      field: "balance_before",
    },

    balanceAfter: {
      type: DataTypes.DECIMAL(30, 8),
      allowNull: false,
      field: "balance_after",
    },

    referenceType: {
      type: DataTypes.STRING(30),
      allowNull: true,
      field: "reference_type",
    },

    referenceId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
      field: "reference_id",
    },

    description: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },

    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: "created_at",
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "trading_transactions",
    timestamps: false,
  }
);

module.exports = TradingTransaction;