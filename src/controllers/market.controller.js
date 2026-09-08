const marketService = require("../services/market.service");
const { sendSuccess } = require("../utils/response");



/// 🔵 All Coins (pagination)
const getAllCoins = async (req, res, next) => {
  try {
    const currency = req.query.currency || "usd";
    const limit = Number(req.query.perPage) || 30;
    const page = Number(req.query.page) || 1;
    const search = req.query.search || "";

    const data = await marketService.getAllCoins(currency, limit, page, search);

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

    let data = await marketService.getGainers(currency, limit, page, search);
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

    let data = await marketService.getLosers(currency, limit, page, search);

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
    let data = await marketService.getTrending();
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
    let data = await marketService.getNewCoins(currency, limit, page, search);
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

module.exports = {
  getAllCoins,
  getGainers,
  getLosers,
  getTrending,
  getNewCoins,
};