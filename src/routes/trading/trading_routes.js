const express = require("express");

const {
  placeMarketOrder,
  placeLimitOrderController,
  updateTpSl,
  getTradingAccount,
  getOpenPositions,
  closePosition,
  getOpenLimitOrders,
  cancelLimitOrderController,
  modifyLimitOrderController,
} = require("../../controllers/trading/trading_controller");

const router = express.Router();

router.post(
  "/orders/market",
  placeMarketOrder
);

router.post(
  "/orders/limit",
  placeLimitOrderController
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

router.get(
  "/orders/open/:accountId",
  getOpenLimitOrders
);

router.delete(
  "/orders/:tradeId",
  cancelLimitOrderController
);

router.put(
  "/orders/:tradeId/modify",
  modifyLimitOrderController
);

module.exports = router;