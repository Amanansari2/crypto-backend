// const express = require("express");
// const cryptoController = require("../controllers/market.controller");

// const router = express.Router();

// router.get("/all", cryptoController.getAllCoins);
// router.get("/gainers", cryptoController.getGainers);
// router.get("/losers", cryptoController.getLosers);
// router.get("/trending", cryptoController.getTrending);
// router.get("/new", cryptoController.getNewCoins);

// module.exports = router;


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

module.exports = router;
