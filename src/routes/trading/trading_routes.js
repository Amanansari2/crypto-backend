const express = require("express");

const {
  placeMarketOrder,
  updateTpSl,
  getTradingAccount,
  getOpenPositions,
  closePosition,
} = require("../../controllers/trading/trading_controller");

const router = express.Router();

router.post(
  "/orders/market",
  placeMarketOrder
);

router.put(
    "/positions/:tradeId/tp-sl",
    updateTpSl
  );

router.get(
  "/accounts/:accountId",
  getTradingAccount
);

router.get(
  "/positions/:accountId",
  getOpenPositions
);

router.post(
  "/positions/:tradeId/close",
  closePosition
);

module.exports = router;