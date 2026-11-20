


const express = require("express");
const cryptoController = require("../controllers/market.controller");
const favoriteController = require("../controllers/favorite.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const optionalAuth = require("../middlewares/optionalAuth.middleware");
const router = express.Router();

router.get("/all", optionalAuth, cryptoController.getAllCoins);
router.get("/gainers", optionalAuth,cryptoController.getGainers);
router.get("/losers", optionalAuth,cryptoController.getLosers);
router.get("/trending", optionalAuth, cryptoController.getTrending);
router.get("/new", optionalAuth,cryptoController.getNewCoins);
// FAVOURITES


router.get(
    "/favorites",
    optionalAuth,
    favoriteController.getFavorites
);

router.post("/favorites/toggle", authMiddleware, favoriteController.toggleFavorite);

router.get("/overview/global", cryptoController.getGlobalMarketOverview);
router.get(
  "/fear-greed",
  cryptoController.getFearGreedIndex
);
router.get(
  "/overview/history",
  cryptoController.getMarketCapHistory
);

module.exports = router;
