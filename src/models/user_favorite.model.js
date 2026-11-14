const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const UserFavorite = sequelize.define(
    "UserFavorite",
    {
        id: {
            type: DataTypes.BIGINT.UNSIGNED,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false
        },

        user_id: {
            type: DataTypes.INTEGER.UNSIGNED,
            allowNull: false
        },

        coin_id: {
            type: DataTypes.BIGINT.UNSIGNED,
            allowNull: false
        },
          coin_symbol: {
            type: DataTypes.STRING(50),
            allowNull: false
        }
    },
    {
        tableName: "user_favorites",
        timestamps: true,
        createdAt: "created_at",
        updatedAt: false
    }
);

module.exports = UserFavorite;