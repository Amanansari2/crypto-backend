const axios = require("axios");
const config = require("../../config/binannce");

/**
 * 🔥 Fetch only USDT trading pairs
 */
const fetchUSDTTradingPairs = async () => {
  try {
    // const url = `${config.baseUrl}/exchangeInfo`;
    const url = `${config.futuresBaseUrl}/exchangeInfo`;
    console.log("🌐 Binance exchangeInfo URL:", url);

    const { data } = await axios.get(url);

    const filtered = data.symbols
      .filter(
        (s) =>
          s.quoteAsset === "USDT" &&
          s.status === "TRADING"
      )
      .map((s) => ({
        symbol: s.symbol,
        baseAsset: s.baseAsset,
      }));

    return filtered;
  } catch (error) {
    console.error(
      "Binance fetch error:",
      error.response?.data || error.message
    );
    throw error;
  }
};

module.exports = {
  fetchUSDTTradingPairs, 
};