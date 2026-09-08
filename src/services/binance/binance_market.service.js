const axios = require("axios");
const config = require("../../config/binannce");

const get24hrTicker = async () => {
  try {
    const { data } = await axios.get(
      // `${config.baseUrl}/ticker/24hr`
      `${config.futuresBaseUrl}/ticker/24hr`,
    );

    return data;
  } catch (error) {
    console.error(
      "Binance ticker error:",
      error.response?.data || error.message
    );
    throw error; 
  }
};

module.exports = {
  get24hrTicker,
};