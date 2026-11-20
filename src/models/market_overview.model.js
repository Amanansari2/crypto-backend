
const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const MarketOverviewHistory = sequelize.define(
  "MarketOverviewHistory",
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },

    total_market_cap: {
      type: DataTypes.DECIMAL(30, 2),
      allowNull: false,
    },

    recorded_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  },
  {
    tableName: "market_overview_history",
    timestamps: false,
    indexes: [
      {
        fields: ["recorded_at"],
      },
    ],
  }
);

module.exports = MarketOverviewHistory;

