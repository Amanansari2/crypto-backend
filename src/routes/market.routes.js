const express = require("express");
const cryptoController = require("../controllers/market.controller");

const router = express.Router();

router.get("/all", cryptoController.getAllCoins);
router.get("/gainers", cryptoController.getGainers);
router.get("/losers", cryptoController.getLosers);
router.get("/trending", cryptoController.getTrending);
router.get("/new", cryptoController.getNewCoins);

module.exports = router;
