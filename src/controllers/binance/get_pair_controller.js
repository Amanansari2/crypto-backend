const BinancePair = require("../../models/binance/binance_pair_model");

const getPairs = async (req, res) => {
  try {
    const pairs = await BinancePair.findAll({
      attributes: ["symbol", "baseAsset"],
    });

    res.status(200).json({
      success: true,
      count: pairs.length,
      data: pairs,
    });
  } catch (error) {
    console.error("Error fetching pairs:", error.message);

    res.status(500).json({
      success: false,
      message: "Failed to fetch Binance pairs",
    });
  }
};

module.exports = { getPairs };