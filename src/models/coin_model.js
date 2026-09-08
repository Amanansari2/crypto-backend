const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const Coin = sequelize.define(
  "Coin",
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },

    symbol: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },

    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    image: {
      type: DataTypes.TEXT,
      allowNull: false,
    },

    coingeckoId: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true,
      field: "coingecko_id",
    },
  },
  {
    tableName: "coins",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

module.exports = Coin;