
// const axios = require("axios");
// const config = require("../config/coingecko");
// const MarketOverviewHistory = require("../models/market_overview.model");

// let globalMarketCache = null;
// let cacheExpiry = 0;
// let pendingRequest = null;

// const CACHE_DURATION = 3 *60 * 1000;
// const { Op } = require("sequelize");

// const getMarketCapHistory = async () => {
//   const sevenDaysAgo = new Date(
//     Date.now() - 7 * 24 * 60 * 60 * 1000
//   );

//   const records = await MarketOverviewHistory.findAll({
//     attributes: ["total_market_cap", "recorded_at"],
//     where: {
//       recorded_at: {
//         [Op.gte]: sevenDaysAgo,
//       },
//     },
//     order: [["recorded_at", "ASC"]],
//   });

//   return records.map((record) => ({
//     totalMarketCap: Number(record.total_market_cap),
//     recordedAt: record.recorded_at,
//   }));
// };

// const getGlobalMarketData = async () => {
//   // Return cached data if still valid
//   if (globalMarketCache && Date.now() < cacheExpiry) {
//     return globalMarketCache;
//   }

//   // Reuse an ongoing API request
//   if (pendingRequest) {
//     return pendingRequest;
//   }

//   pendingRequest = (async () => {
//     try {
//       const { data } = await axios.get(
//         `${config.baseUrl}/global`,
//         { timeout: 10000 }
//       );

//       const global = data?.data;

//       if (!global) {
//         throw new Error("Invalid CoinGecko global response");
//       }
//       const totalMarketCap = global.total_market_cap?.usd ?? null;

// if (totalMarketCap !== null) {
//   try {
//     await MarketOverviewHistory.create({
//       total_market_cap: totalMarketCap,
//       recorded_at: new Date(),
//     });
//   } catch (error) {
//     console.error(
//       "[Market Overview] History save failed:",
//       error.message
//     );
//   }
// }

//       const result = {
//          totalMarketCap,
//         totalVolume: global.total_volume?.usd ?? null,
//         marketCapChangePercentage24h:
//           global.market_cap_change_percentage_24h_usd ?? null,
//         btcDominance: global.market_cap_percentage?.btc ?? null,
//         ethDominance: global.market_cap_percentage?.eth ?? null,
//         activeCryptocurrencies:
//           global.active_cryptocurrencies ?? null,
//         updatedAt: Date.now(),
//       };

//       globalMarketCache = result;
//       cacheExpiry = Date.now() + CACHE_DURATION;

//       return result;
//     } catch (error) {
//       console.error(
//         "Global market data error:",
//         error.response?.data || error.message
//       );

//       // Use previous data if API fails
//       if (globalMarketCache) {
//         return globalMarketCache;
//       }

//       throw error;
//     } finally {
//       pendingRequest = null;
//     }
//   })();

//   return pendingRequest;
// };

// module.exports = {
//   getGlobalMarketData,
//   getMarketCapHistory,
// };



const axios = require("axios");
const { Op } = require("sequelize");

const config = require("../config/coingecko");
const MarketOverviewHistory = require("../models/market_overview.model");

let globalMarketCache = null;
let cacheExpiry = 0;
let pendingRequest = null;

const CACHE_DURATION = 3 * 60 * 1000;

// Fetch fresh data, save history and update cache
const fetchAndCacheGlobalMarketData = async () => {
  try {
    const { data } = await axios.get(
      `${config.baseUrl}/global`,
      { timeout: 10000 }
    );

    const global = data?.data;

    if (!global) {
      throw new Error("Invalid CoinGecko global response");
    }

    const totalMarketCap = global.total_market_cap?.usd ?? null;

    // Save historical snapshot
    if (totalMarketCap !== null) {
      try {
        await MarketOverviewHistory.create({
          total_market_cap: totalMarketCap,
          recorded_at: new Date(),
        });
      } catch (error) {
        console.error(
          "[Market Overview] History save failed:",
          error.message
        );
      }
    }

    const result = {
      totalMarketCap,
      totalVolume: global.total_volume?.usd ?? null,
      marketCapChangePercentage24h:
        global.market_cap_change_percentage_24h_usd ?? null,
      btcDominance: global.market_cap_percentage?.btc ?? null,
      ethDominance: global.market_cap_percentage?.eth ?? null,
      activeCryptocurrencies:
        global.active_cryptocurrencies ?? null,
      updatedAt: Date.now(),
    };

    globalMarketCache = result;
    cacheExpiry = Date.now() + CACHE_DURATION;

    return result;
  } catch (error) {
    console.error(
      "Global market data error:",
      error.response?.data || error.message
    );

    if (globalMarketCache) {
      return globalMarketCache;
    }

    throw error;
  }
};

// Normal API function - uses cache
const getGlobalMarketData = async () => {
  if (globalMarketCache && Date.now() < cacheExpiry) {
    return globalMarketCache;
  }

  if (pendingRequest) {
    return pendingRequest;
  }

  pendingRequest = fetchAndCacheGlobalMarketData();

  try {
    return await pendingRequest;
  } finally {
    pendingRequest = null;
  }
};

// Background scheduler function - bypasses cache
const refreshGlobalMarketData = async () => {
  if (pendingRequest) {
    return pendingRequest;
  }

  pendingRequest = fetchAndCacheGlobalMarketData();

  try {
    return await pendingRequest;
  } finally {
    pendingRequest = null;
  }
};

// Fetch last 7 days of chart history
const getMarketCapHistory = async () => {
  const sevenDaysAgo = new Date(
    Date.now() - 7 * 24 * 60 * 60 * 1000
  );

  const records = await MarketOverviewHistory.findAll({
    attributes: ["total_market_cap", "recorded_at"],
    where: {
      recorded_at: {
        [Op.gte]: sevenDaysAgo,
      },
    },
    order: [["recorded_at", "ASC"]],
  });

  return records.map((record) => ({
    totalMarketCap: Number(record.total_market_cap),
    recordedAt: record.recorded_at,
  }));
};
const cleanupOldMarketCapHistory = async () => {
  const sevenDaysAgo = new Date(
    Date.now() - 7 * 24 * 60 * 60 * 1000
  );

  const deletedCount = await MarketOverviewHistory.destroy({
    where: {
      recorded_at: {
        [Op.lt]: sevenDaysAgo,
      },
    },
  });

  console.log(
    `[Market Overview] Old history records deleted: ${deletedCount}`
  );

  return deletedCount;
};

module.exports = {
  getGlobalMarketData,
  refreshGlobalMarketData,
  getMarketCapHistory,
  cleanupOldMarketCapHistory,
};
