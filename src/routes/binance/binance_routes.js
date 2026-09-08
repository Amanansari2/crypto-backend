const router = require("express").Router();
const { getPairs } = require("../../controllers/binance/get_pair_controller");
const { getCandles }    = require("../../controllers/binance/candle_controller");
const { getOrderBook } = require("../../controllers/binance/order_book");
const { getContractInfo } = require("../../controllers/binance/contract_info_controller");
const syncCoinController = require("../../controllers/sync_coin.controller");
const {
    getMarketData,
    getAllMarketData,
  } = require("../../controllers/binance/market_data_controller");

router.get("/candles", getCandles);

router.get("/pairs", getPairs);

router.get("/order-book/:symbol", getOrderBook);

router.get("/contract-info/:symbol", getContractInfo);
router.post("/sync-coins", syncCoinController.syncCoins);
router.get(
    "/market-data/:symbol",
    getMarketData
  );
  
  router.get(
    "/market-data",
    getAllMarketData
  );

module.exports = router;                 