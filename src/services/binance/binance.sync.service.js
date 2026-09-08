const BinancePair = require("../../models/binance/binance_pair_model.js");
const {
  fetchUSDTTradingPairs,
} = require("./binance.service");

const syncBinancePairs = async () => {
  try {
    const pairs = await fetchUSDTTradingPairs();

    // 🧹 clear old data
    await BinancePair.destroy({ where: {} });

    // 💾 insert new
    await BinancePair.bulkCreate(pairs);

    console.log(`✅ Synced ${pairs.length} pairs`);
  } catch (error) {
    console.error("❌ Binance sync failed:", error.message);
  }
};

module.exports = syncBinancePairs; 