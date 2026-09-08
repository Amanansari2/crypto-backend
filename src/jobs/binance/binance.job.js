const cron = require("node-cron");
const syncBinancePairs = require("../../services/binance/binance.sync.service");

const startBinanceJob = () => {
  // ⏱️ daily at 12:00 AM
  cron.schedule("0 0 * * *", async () => {
    console.log("🟡 Running Binance sync job...");

    try {
      await syncBinancePairs();
      console.log("🟢 Binance sync completed");
    } catch (error) {
      console.error("🔴 Binance job failed:", error.message);
    }
  });
};

module.exports = startBinanceJob;  