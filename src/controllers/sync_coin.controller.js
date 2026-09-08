const syncCoinService = require("../services/sync_coin.service");
const { sendSuccess } = require("../utils/response");

const syncCoins = async (req, res, next) => {
  try {
    const result = await syncCoinService.syncCoins();

    return sendSuccess(
      res,
      result,
      "Coins synced successfully."
    );
  } catch (error) {
    next(error);
  }
};

module.exports = {
  syncCoins,
};