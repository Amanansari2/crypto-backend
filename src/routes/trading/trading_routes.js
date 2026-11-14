const express = require("express");
const authMiddleware = require("../../middlewares/auth.middleware");
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
  getOrderHistory,  
  getTradingHistory,
  getPositionHistory,
} = require("../../controllers/trading/trading_controller");

const router = express.Router();
router.use(authMiddleware);

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

//---------------------------histrory

router.get(
  "/orders/history/:accountId",
  getOrderHistory
);

router.get(
  "/orders/trading-history/:accountId",
   getTradingHistory
  );

  router.get(
  "/orders/positions/history/:accountId",
  getPositionHistory
);

module.exports = router;  