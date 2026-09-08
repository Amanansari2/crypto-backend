// const dotenv = require("dotenv");

// dotenv.config();

// module.exports = {
//   port: Number(process.env.PORT) || 5000,
//   nodeEnv: process.env.NODE_ENV || "development",
//   db: {
//     host: process.env.DB_HOST,
//     port: Number(process.env.DB_PORT) || 3306,
//     name: process.env.DB_NAME,
//     user: process.env.DB_USER,
//     password: process.env.DB_PASSWORD
//   },
//   jwtSecret: process.env.JWT_SECRET || "super-secret-key",
//   coingeckoBaseUrl:
//     process.env.COINGECKO_BASE_URL || "https://api.coingecko.com/api/v3",
//   binanceBaseUrl: process.env.BINANCE_BASE_URL || "https://api.binance.com/api/v3",
//   binanceFBaseUrl: process.env.BINANCE_FBASE_URL || "https://fapi.binance.com/fapi/v3"

// };


const dotenv = require("dotenv");

dotenv.config();

module.exports = {
  port: Number(process.env.PORT) || 5000,

  nodeEnv:
    process.env.NODE_ENV || "development",

  db: {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 3306,
    name: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  },

  jwtSecret:
    process.env.JWT_SECRET || "super-secret-key",

  coingeckoBaseUrl:
    process.env.COINGECKO_BASE_URL ||
    "https://api.coingecko.com/api/v3",

  // Binance USDⓈ-M Futures REST API
  binanceFBaseUrl:
    process.env.BINANCE_FBASE_URL ||
    "https://fapi.binance.com/fapi/v3",

  // Binance USDⓈ-M Futures WebSocket
  binanceFWsBaseUrl:
    process.env.BINANCE_FWS_BASE_URL ||
    "wss://fstream.binance.com",
};