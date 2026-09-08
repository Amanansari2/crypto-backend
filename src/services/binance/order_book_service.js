
const axios = require("axios");

const config = require("../../config/binannce");

const getOrderBook = async (symbol) => {
  try {
    const { data } = await axios.get(
      `${config.futuresBaseUrl}/depth`,
      {
        params: {
          symbol: symbol.toUpperCase(),
          limit: 100,
        },
        timeout: 5000,
      }
    );

    return data;
  } catch (error) {
    console.error(
      "❌ Binance Futures Order Book Error:",
      error.response?.status,
      error.response?.data || error.message
    );

    throw error;
  }
};

module.exports = {
  getOrderBook,
};