const { DataTypes } = require("sequelize");
const sequelize = require("../../config/db");

const BinancePair = sequelize.define(
  "BinancePair",
  {
    symbol: {
      type: DataTypes.STRING,
      primaryKey: true,
    },
    baseAsset: {
      type: DataTypes.STRING,
      allowNull: false,
      index: true,
    },
  },
  {
    tableName: "binance_pairs",
    timestamps: false,
  }
);

module.exports = BinancePair; 