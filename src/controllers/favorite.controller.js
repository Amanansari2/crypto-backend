const UserFavorite = require("../models/user_favorite.model");
const Coin = require("../models/coin_model");
const marketService = require("../services/market.service");


// TOGGLE FAVOURITE USING SYMBOL
exports.toggleFavorite = async (req, res, next) => {
    try {
        const user_id = req.auth.userId;
        const { symbol } = req.body;

        if (!symbol || typeof symbol !== "string" || !symbol.trim()) {
            return res.status(400).json({
                success: false,
                message: "Coin symbol is required."
            });
        }

        const coinSymbol = symbol.trim().toUpperCase();

        // Find coin using symbol
        const coin = await Coin.findOne({
            where: { symbol: coinSymbol }
        });

        if (!coin) {
            return res.status(404).json({
                success: false,
                message: "Coin not found."
            });
        }

        // Check whether coin is already favourite
        const favorite = await UserFavorite.findOne({
            where: {
                user_id,
                coin_id: coin.id
            }
        });

        // Already favourite: remove it
        if (favorite) {
            await favorite.destroy();

            return res.status(200).json({
                success: true,
                message: "Coin removed from favourites.",
                data: {
                    coin_id: coin.id,
                    coin_symbol: coin.symbol,
                    is_favorite: false
                }
            });
        }

        // Not favourite: add it
        const newFavorite = await UserFavorite.create({
            user_id,
            coin_id: coin.id,
            coin_symbol: coin.symbol
        });

        return res.status(201).json({
            success: true,
            message: "Coin added to favourites.",
            data: {
                id: newFavorite.id,
                user_id,
                coin_id: coin.id,
                coin_symbol: coin.symbol,
                is_favorite: true
            }
        });

    } catch (error) {
        next(error);
    }
};



// GET USER FAVOURITES
exports.getFavorites = async (req, res, next) => {
    try {
        const user_id = req.auth.userId;

        const favorites = await UserFavorite.findAll({
            where: { user_id },
            attributes: [
                "id",
                "coin_id",
                "coin_symbol",
                "created_at"
            ],
            order: [["created_at", "DESC"]],
            raw: true
        });

        const ids = favorites.map(item => item.coin_id);

        const coins = await marketService.getCoinsByIds(
            ids,
            user_id
        );

        return res.json({
            success: true,
            message: "Favourite coins fetched successfully.",
            data: {
                coins,
                total: coins.length
            }
        });

    } catch (error) {
        next(error);
    }
};