
const { DataTypes } = require("sequelize");
const sequelize = require("../../config/db");

const UserSession = sequelize.define(
    "UserSession",
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
        refresh_token_hash: {
            type: DataTypes.CHAR(64),
            allowNull: false,
            unique: true
        },
        expires_at: {
            type: DataTypes.DATE,
            allowNull: false
        },
        revoked_at: {
            type: DataTypes.DATE,
            allowNull: true
        }
    },
    {
        tableName: "user_sessions",
        timestamps: true,
        createdAt: "created_at",
        updatedAt: "updated_at",
        freezeTableName: true
    }
);

module.exports = UserSession;
