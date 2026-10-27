
const express = require("express");
const {
  getWalletOverview,
  getWalletTransactions,
  getWalletTrades,
  getWalletTradeDetails,
} = require("../../controllers/wallet/wallet_controller");

const router = express.Router();

router.get("/overview/:accountId", getWalletOverview);

router.get("/transactions/:accountId", getWalletTransactions);

router.get("/trades/:accountId", getWalletTrades);

router.get(
  "/trades/:accountId/:tradeId",
  getWalletTradeDetails,
);

module.exports = router;
