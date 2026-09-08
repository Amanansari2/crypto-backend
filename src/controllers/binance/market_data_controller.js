const marketStream = require("../../websocket/binance_market_stream.service");

const getMarketData = async (req, res) => {
  try {
    const { symbol } = req.params;

    if (!symbol) {
      return res.status(400).json({
        success: false,
        message: "Symbol is required",
      });
    }

    const normalizedSymbol = symbol.toUpperCase();

    const data =
      marketStream.getMarketData(normalizedSymbol);

    if (!data) {
      return res.status(404).json({
        success: false,
        message: "Market data not available",
      });
    }

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error(
      "Market data controller error:",
      error.message
    );

    return res.status(500).json({
      success: false,
      message: "Failed to get market data",
    });
  }
};

const getAllMarketData = async (req, res) => {
  try {
    const data =
      marketStream.getAllMarketData();

    return res.status(200).json({
      success: true,
      count: Object.keys(data).length,
      data,
    });
  } catch (error) {
    console.error(
      "All market data error:",
      error.message
    );

    return res.status(500).json({
      success: false,
      message: "Failed to get market data",
    });
  }
};

module.exports = {
  getMarketData,
  getAllMarketData,
};