


const marketService = require("../services/market.service");
const { sendSuccess } = require("../utils/response");
const marketOverviewService = require("../services/market_overview.service");
const fearGreedService = require("../services/fear_greed.service");


/// 🔵 All Coins (pagination)
const getAllCoins = async (req, res, next) => {
  try {
    const currency = req.query.currency || "usd";
    const limit = Number(req.query.perPage) || 30;
    const page = Number(req.query.page) || 1;
    const search = req.query.search || "";
    const userId = req.auth?.userId || null;
    
    const data = await marketService.getAllCoins(currency, limit, page, search, userId);

    return sendSuccess(res, { 
      coins: data.items,
      currentPage: data.currentPage,
      hasMore: data.hasMore,
      totalItems: data.totalItems,
      totalPages: data.totalPages,
    }, "All coins");
  } catch (e) {
    next(e);
  }
};

/// 📈 Gainers
const getGainers = async (req, res, next) => {
  try {
    const currency = req.query.currency || "usd";
    const limit = Number(req.query.perPage) || 30;
    const page = Number(req.query.page) || 1;
    const search = (req.query.search || "").trim().toLowerCase();
    const userId = req.auth?.userId || null;


    let data = await marketService.getGainers(currency, limit, page, search, userId);
    if(search){
      data = data.filter((coin) => {
        return (
          coin.symbol.toLowerCase().includes(search) ||
          coin.name.toLowerCase().includes(search)
        );
      });
    }

    return sendSuccess(res, {
      coins: data,
      currentPage: page,
      hasMore: data.length === limit,
    }, "Top gainers");
  } catch (e) {
    next(e);
  }
};


/// 📉 Losers
const getLosers = async (req, res, next) => {
  try {
    const currency = req.query.currency || "usd";
    const limit = Number(req.query.perPage) || 30;
    const page = Number(req.query.page) || 1;
    const search = (req.query.search || "").trim().toLowerCase();
    const userId = req.auth?.userId || null;


    let data = await marketService.getLosers(currency, limit, page, search, userId);

    if (search) {
      data = data.filter((coin) => {
        return (
          coin.symbol.toLowerCase().includes(search) ||
          coin.name.toLowerCase().includes(search)
        );
      });
    }

    return sendSuccess(
      res,
      {
        coins: data,
        currentPage: page,
        hasMore: data.length === limit,
      },
      "Top losers"
    );
  } catch (e) {
    next(e);
  }
};

/// 🔥 Trending (NO pagination)
const getTrending = async (req, res, next) => {
  try {
    const search = (req.query.search || "").trim().toLowerCase();
    const userId = req.auth?.userId || null;

    let data = await marketService.getTrending(userId);
    if(search){
      data = data.filter((coin) => {
        return (
          coin.symbol.toLowerCase().includes(search) ||
          coin.name.toLowerCase().includes(search)
        );
      });
    }

    return sendSuccess(res, {
      coins: data,
      currentPage: 1,
      hasMore: false,
    }, "Trending coins");
  } catch (e) {
    next(e);
  }
};

/// 🆕 New Coins
const getNewCoins = async (req, res, next) => {
  try {
    const currency = req.query.currency || "usd";
    const limit = Number(req.query.perPage) || 30;
    const page = Number(req.query.page) || 1;
    const search = (req.query.search || "").trim().toLowerCase();
    const userId = req.auth?.userId || null;

    let data = await marketService.getNewCoins(currency, limit, page, search, userId);
    if(search){
      data = data.filter((coin) => {
        return (
          coin.symbol.toLowerCase().includes(search) ||
          coin.name.toLowerCase().includes(search)
        );
      });
    }

    return sendSuccess(res, {
      coins: data,
      currentPage: page,
      hasMore: data.length === limit,
    }, "New coins");
  } catch (e) {
    next(e);
  }
};

/// 🌍 Global Market Overview
const getGlobalMarketOverview = async (req, res, next) => {
  try {
    const data = await marketOverviewService.getGlobalMarketData();

    return sendSuccess(
      res,
      data,
      "Global market overview"
    );
  } catch (e) {
    next(e);
  }
};

const getFearGreedIndex = async (req, res, next) => {
  try {
    const data = await fearGreedService.getFearGreedData();

    return sendSuccess(
      res,
      data,
      "Fear & Greed Index"
    );
  } catch (error) {
    next(error);
  }
};

const getMarketCapHistory = async (req, res, next) => {
  try {
    const data = await marketOverviewService.getMarketCapHistory();

    return sendSuccess(
      res,
      data,
      "Market cap history fetched successfully"
    );
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllCoins,
  getGainers,
  getLosers,
  getTrending,
  getNewCoins,
  getGlobalMarketOverview,
  getFearGreedIndex,
  getMarketCapHistory,
};