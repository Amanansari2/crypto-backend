
const axios = require("axios");

const API_URL = "https://api.alternative.me/fng/";

let fearGreedCache = null;
let cacheExpiry = 0;
let pendingRequest = null;

const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

const getFearGreedData = async () => {
  if (fearGreedCache && Date.now() < cacheExpiry) {
    return fearGreedCache;
  }

  if (pendingRequest) {
    return pendingRequest;
  }

  pendingRequest = (async () => {
    try {
      const { data } = await axios.get(API_URL, {
        params: { limit: 8 },
        timeout: 10000,
      });

      if (!Array.isArray(data?.data) || data.data.length === 0) {
        throw new Error("Invalid Fear & Greed API response");
      }

      const formatRecord = (item) => {
        if (!item) return null;

        return {
          value: Number(item.value),
          classification: item.value_classification,
          timestamp: Number(item.timestamp),
        };
      };

      const result = {
        current: formatRecord(data.data[0]),
        yesterday: formatRecord(data.data[1]),
        lastWeek: formatRecord(data.data[7]),
        updatedAt: Date.now(),
      };

      fearGreedCache = result;
      cacheExpiry = Date.now() + CACHE_DURATION;

      return result;
    } catch (error) {
      console.error(
        "Fear & Greed API error:",
        error.response?.data || error.message
      );

      if (fearGreedCache) {
        return fearGreedCache;
      }

      throw error;
    } finally {
      pendingRequest = null;
    }
  })();

  return pendingRequest;
};

module.exports = {
  getFearGreedData,
};
