
const express = require("express");
const authMiddleware = require("../../middlewares/auth.middleware");
const {
  getWalletOverview,
  getWalletTransactions,
  getWalletTrades,
  getWalletTradeDetails,
} = require("../../controllers/wallet/wallet_controller");

const router = express.Router();
router.use(authMiddleware);

router.get("/overview/:accountId", getWalletOverview);

router.get("/transactions/:accountId", getWalletTransactions);

router.get("/trades/:accountId", getWalletTrades);

router.get(
  "/trades/:accountId/:tradeId",
  getWalletTradeDetails,
);

module.exports = router;
