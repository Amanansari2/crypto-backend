const axios = require("axios");
const env = require("../../config/env");

const allowedIntervals = [
  "1m","3m","5m","15m","30m",
  "1h","2h","4h","6h","8h","12h",
  "1d","3d","1w","1M" 
];

exports.getCandles = async (req, res, next) => {
  try {
    let { symbol, interval, limit, endTime, startTime } = req.query;

    symbol = (symbol || "BTCUSDT").toUpperCase();
    interval = interval || "1m";
    limit = parseInt(limit) || 200; 

    if (!allowedIntervals.includes(interval)) {
      return res.status(400).json({
        success: false,
        error: "Invalid interval",
      });
    }

    if (limit < 1 || limit > 1000){
      return res.status(400).json({
        success: false,
        error: "Limit max 1000",
      });
    }

    const params = {
      symbol,
      interval,
      limit,
    };

    // 🔥 pagination logic
    if (endTime) {
      params.endTime = Number(endTime);
    }
    if (startTime) {
      params.startTime = Number(startTime);
    }

    // const response = await axios.get(`${env.binanceBaseUrl}/klines`, {
      const response = await axios.get(`${env.binanceFBaseUrl}/klines`, {

      params,
      timeout: 5000
    });

    const candles = response.data.map((c) => ({
      time: c[0],
      open: +c[1],
      high: +c[2],
      low: +c[3],
      close: +c[4],
      volume: +c[5],
    })).sort((a,b) => a.time - b.time);

    res.json({
      success: true,
      data: candles,
      meta: {
        count: candles.length,
        nextEndTime: candles.length > 0 ? candles[0].time - 1 : null, // 👈 important
      },
    });
  } catch (error) {
    if (error.response) {
      return res.status(error.response.status).json({
        success: false,
        error: error.response.data?.msg || "Binance API error",
      });
    }
    next(error);
  }
};