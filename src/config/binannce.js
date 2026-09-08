// const env = require("./env");

// module.exports = {
//   baseUrl: env.binanceBaseUrl,
// };

const env = require("./env");
console.log("🔧 Binance Futures REST:", env.binanceFBaseUrl);
console.log("🔧 Binance Futures WS:", env.binanceFWsBaseUrl);

module.exports = {
  futuresBaseUrl: env.binanceFBaseUrl,

  futuresWsBaseUrl: env.binanceFWsBaseUrl,
};