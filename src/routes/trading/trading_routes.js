const express = require("express");

const {
  placeMarketOrder,
  updateTpSl
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

module.exports = router;