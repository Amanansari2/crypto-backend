const { DataTypes } = require("sequelize");
const sequelize = require("../../config/db");

const Register = sequelize.define(
    "Register",
    {
        id: {
            type: DataTypes.INTEGER.UNSIGNED,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false
        },

        uid: {
            type: DataTypes.CHAR(36),
            allowNull: false,
            unique: true,
            defaultValue: DataTypes.UUIDV4
        },

        trading_uid: {
    type: DataTypes.STRING(50),
    allowNull: true,
    unique: true
},

        first_name: {
            type: DataTypes.STRING(100),
            allowNull: false
        },

        last_name: {
            type: DataTypes.STRING(100),
            allowNull: false
        },

        email: {
            type: DataTypes.STRING(255),
            allowNull: false,
            unique: true,
            validate: {
                isEmail: true
            }
        },

        password: {
            type: DataTypes.STRING(255),
            allowNull: false
        },

        is_email_verified: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        },

        account_status: {
            type: DataTypes.ENUM(
                "pending",
                "active",
                "suspended",
                "deleted"
            ),
            allowNull: false,
            defaultValue: "pending"
        },

        email_verified_at: {
            type: DataTypes.DATE,
            allowNull: true
        },

        last_login_at: {
            type: DataTypes.DATE,
            allowNull: true
        }
    },
    {
        tableName: "register",
        timestamps: true,
        createdAt: "created_at",
        updatedAt: "updated_at"
    }
);

module.exports = Register;
