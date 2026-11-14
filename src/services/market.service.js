// const Coin = require("../models/coin_model");
// const { formatNumber } = require("../utils/number");
// const { get24hrTicker } = require("./binance/binance_market.service");
// const { getTrendingCoins } = require("../utils/trending_score");

// const getMergedCoins = async () => {
//   const [coins, tickers] = await Promise.all([
//     Coin.findAll({
//       raw: true,
//     }),
//     get24hrTicker(),
//   ]);

//   const tickerMap = new Map();

//   for (const ticker of tickers) {
//     if (!ticker.symbol.endsWith("USDT")) continue;

//     let symbol = ticker.symbol.replace("USDT", "");

//     tickerMap.set(symbol, ticker);

//     // 1000PEPE -> PEPE
//     if (symbol.startsWith("1000")) {
//       tickerMap.set(symbol.replace(/^1000/, ""), ticker);
//     }
//   } 

//   const merged = [];

//   for (const coin of coins) {
//     const ticker = tickerMap.get(coin.symbol);

//     if (!ticker) continue;

//     merged.push({
//       id: coin.id,
//       symbol: coin.symbol,
//       name: coin.name,
//       image: coin.image,

//       currentPrice: Number(ticker.lastPrice),

//       priceChangePercentage24h: Number(
//         ticker.priceChangePercent
//       ),

//       highPrice: Number(ticker.highPrice),

//       lowPrice: Number(ticker.lowPrice),

//       quoteVolume: formatNumber(
//         ticker.quoteVolume
//       ),
      
//       quoteVolumeRaw: Number(
//         ticker.quoteVolume
//       ),


//       openPrice: Number(ticker.openPrice),

//       weightedAvgPrice: 
//         Number(ticker.weightedAvgPrice),
//     });
//   }

//   return merged;
// };

// /// 🌍 ALL COINS
// const getAllCoins = async (
//   currency = "usd",
//   perPage = 30,
//   page = 1,
//   search = ""
// ) => {
//   const coins = await getMergedCoins();
//   let filteredCoins = coins;
//   if(search.trim()){
//     const keyword = search.trim().toLowerCase();
//     filteredCoins = coins.filter((coin )=>{
//       return(
//         coin.symbol.toLowerCase().includes(keyword) ||
//         coin.name.toLowerCase().includes(keyword)
//       );
//     } );
//   }



//   const totalItems = filteredCoins.length;
//   const totalPages = Math.ceil(totalItems / perPage);

//   const start = (page - 1) * perPage;
//   const items = filteredCoins.slice(start, start + perPage);

//   return {
//     items,
//     totalItems,
//     totalPages,
//     currentPage: page,
//     hasMore: page < totalPages,
//   };
// };

// /// 📈 GAINERS
// const getGainers = async (
//   currency = "usd",
//   perPage = 30,
//   page = 1,
//   search = ""
// ) => {
//   const coins = await getMergedCoins();
     
//      const start = (page - 1) * perPage;
//   return coins
//     .sort(
//       (a, b) =>
//         b.priceChangePercentage24h -
//         a.priceChangePercentage24h
//     )
//     .slice(0, perPage);
// };

// /// 📉 LOSERS
// const getLosers = async (
//   currency = "usd",
//   perPage =30,
//   page = 1,
//   search = ""
// ) => {
//   const coins = await getMergedCoins();
  
  
//   const start = (page - 1) * perPage;
//   return coins
//     .sort(
//       (a, b) =>
//         a.priceChangePercentage24h -
//         b.priceChangePercentage24h
//     )
//     .slice(0, perPage);
// };

// /// 🔥 TRENDING
// const getTrending = async () => {
//   const coins = await getMergedCoins();

//   return coins
//     .sort(
//       (a, b) =>
//         b.quoteVolumeRaw -
//         a.quoteVolumeRaw
//     )
//     .slice(0, 20);
// };

// /// 🆕 NEW COINS
// const getNewCoins = async (
//   currency = "usd",
//   perPage = 30,
//   page = 1,
//   search = ""
// ) => {
//   const coins = await getMergedCoins();

 
//   const start = (page - 1) * perPage;
//   return coins
//     .sort((a, b) => b.id - a.id)
//     .slice(0, perPage);
// };

// module.exports = {
//   getAllCoins,
//   getGainers,
//   getLosers,
//   getTrending,
//   getNewCoins,
// };




const Coin = require("../models/coin_model");
const UserFavorite = require("../models/user_favorite.model");
const { formatNumber } = require("../utils/number");
const { get24hrTicker } = require("./binance/binance_market.service");
const { getTrendingCoins } = require("../utils/trending_score");

const getMergedCoins = async (userId = null) => {
  const [coins, tickers, favorites] = await Promise.all([
    Coin.findAll({
      raw: true,
    }),
    get24hrTicker(),
    // Get logged-in user's favourite coin IDs
        userId
            ? UserFavorite.findAll({
                where: {
                    user_id: userId
                },
                attributes: ["coin_id"],
                raw: true
            })
            : Promise.resolve([])
  ]);

   // Create favourite ID lookup
    const favoriteIds = new Set(
        favorites.map(item => String(item.coin_id))
    );

  const tickerMap = new Map();

  for (const ticker of tickers) {
    if (!ticker.symbol.endsWith("USDT")) continue;

    let symbol = ticker.symbol.replace("USDT", "");

    tickerMap.set(symbol, ticker);

    // 1000PEPE -> PEPE
    if (symbol.startsWith("1000")) {
      tickerMap.set(symbol.replace(/^1000/, ""), ticker);
    }
  } 

  const merged = [];

  for (const coin of coins) {
    const ticker = tickerMap.get(coin.symbol);

    if (!ticker) continue;

    merged.push({
      id: coin.id,
      symbol: coin.symbol,
      name: coin.name,
      image: coin.image,
 // NEW FIELD
            is_favorite: favoriteIds.has(String(coin.id)),
      currentPrice: Number(ticker.lastPrice),

      priceChangePercentage24h: Number(
        ticker.priceChangePercent
      ),

      highPrice: Number(ticker.highPrice),

      lowPrice: Number(ticker.lowPrice),

      quoteVolume: formatNumber(
        ticker.quoteVolume
      ),
      
      quoteVolumeRaw: Number(
        ticker.quoteVolume
      ),


      openPrice: Number(ticker.openPrice),

      weightedAvgPrice: 
        Number(ticker.weightedAvgPrice),
    });
  }

  return merged;
};

/// 🌍 ALL COINS
const getAllCoins = async (
  currency = "usd",
  perPage = 30,
  page = 1,
  search = "",
  userId = null
) => {
  const coins = await getMergedCoins(userId);
  let filteredCoins = coins;
  if(search.trim()){
    const keyword = search.trim().toLowerCase();
    filteredCoins = coins.filter((coin )=>{
      return(
        coin.symbol.toLowerCase().includes(keyword) ||
        coin.name.toLowerCase().includes(keyword)
      );
    } );
  }



  const totalItems = filteredCoins.length;
  const totalPages = Math.ceil(totalItems / perPage);

  const start = (page - 1) * perPage;
  const items = filteredCoins.slice(start, start + perPage);

  return {
    items,
    totalItems,
    totalPages,
    currentPage: page,
    hasMore: page < totalPages,
  };
};

/// 📈 GAINERS
const getGainers = async (
  currency = "usd",
  perPage = 30,
  page = 1,
  search = "",
  userId = null,
) => {
  const coins = await getMergedCoins(userId);
     
     const start = (page - 1) * perPage;
  return coins
    .sort(
      (a, b) =>
        b.priceChangePercentage24h -
        a.priceChangePercentage24h
    )
    .slice(0, perPage);
};

/// 📉 LOSERS
const getLosers = async (
  currency = "usd",
  perPage =30,
  page = 1,
  search = "",
    userId = null

) => {
  const coins = await getMergedCoins(userId);
  
  
  const start = (page - 1) * perPage;
  return coins
    .sort(
      (a, b) =>
        a.priceChangePercentage24h -
        b.priceChangePercentage24h
    )
    .slice(0, perPage);
};

/// 🔥 TRENDING
const getTrending = async (
    userId = null
) => {
  const coins = await getMergedCoins(userId);

  return coins
    .sort(
      (a, b) =>
        b.quoteVolumeRaw -
        a.quoteVolumeRaw
    )
    .slice(0, 20);
};

/// 🆕 NEW COINS
const getNewCoins = async (
  currency = "usd",
  perPage = 30,
  page = 1,
  search = "",
    userId = null
) => {
  const coins = await getMergedCoins(userId);

 
  const start = (page - 1) * perPage;
  return coins
    .sort((a, b) => b.id - a.id)
    .slice(0, perPage);
};

const getCoinsByIds = async (ids,   userId = null) => {
    if (!ids.length) {
        return [];
    }

    const coins = await getMergedCoins(userId);

    const favoriteIds = new Set(
        ids.map(id => String(id))
    );

    return coins.filter(coin =>
        favoriteIds.has(String(coin.id))
    );
};

module.exports = {
  getAllCoins,
  getGainers,
  getLosers,
  getTrending,
  getNewCoins,
  getCoinsByIds
};