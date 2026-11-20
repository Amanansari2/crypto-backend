
const {
  refreshGlobalMarketData: refreshGlobalMarketDataFromService, cleanupOldMarketCapHistory,
} = require("../../services/market_overview.service");
const {
  getFearGreedData,
} = require("../../services/fear_greed.service");

let refreshInterval = null;
let isRefreshing = false;

let fearGreedRefreshInterval = null;
let isFearGreedRefreshing = false;

const refreshGlobalMarketData = async () => {
  if (isRefreshing) return;

  isRefreshing = true;

  try {
    const data =  await refreshGlobalMarketDataFromService();

    console.log(
      "[Market Overview] Data refreshed:",
      new Date(data.updatedAt).toISOString()
    );
  } catch (error) {
    console.error(
      "[Market Overview] Refresh failed:",
      error.message
    );
  } finally {
    isRefreshing = false;
  }
};

const startMarketOverviewJob = async () => {
  if (refreshInterval) return;

  // Initial fetch
  await refreshGlobalMarketData();

  // Refresh every 3 minutes
  refreshInterval = setInterval(
    refreshGlobalMarketData,
    3 * 60 * 1000
  );

  console.log("[Market Overview] Scheduler started");
};

const refreshFearGreedData = async () => {
  if (isFearGreedRefreshing) return;

  isFearGreedRefreshing = true;

  try {
    const data = await getFearGreedData();

    console.log(
      "[Fear & Greed] Data refreshed:",
      data.current?.value,
      data.current?.classification
    );
  } catch (error) {
    console.error(
      "[Fear & Greed] Refresh failed:",
      error.message
    );
  } finally {
    isFearGreedRefreshing = false;
  }
};

const startFearGreedJob = async () => {
  if (fearGreedRefreshInterval) return;

  await refreshFearGreedData();

  fearGreedRefreshInterval = setInterval(
    refreshFearGreedData,
    60 * 60 * 1000
  );

  console.log("[Fear & Greed] Scheduler started");
};

let historyCleanupInterval = null;
let isHistoryCleanupRunning = false;

const runMarketHistoryCleanup = async () => {
  if (isHistoryCleanupRunning) return;

  isHistoryCleanupRunning = true;

  try {
    await cleanupOldMarketCapHistory();
  } catch (error) {
    console.error(
      "[Market Overview] History cleanup failed:",
      error.message
    );
  } finally {
    isHistoryCleanupRunning = false;
  }
};

const startMarketHistoryCleanupJob = async () => {
  if (historyCleanupInterval) return;

  // Initial cleanup
  await runMarketHistoryCleanup();

  // Run once every 24 hours
  historyCleanupInterval = setInterval(
    runMarketHistoryCleanup,
    24 * 60 * 60 * 1000
  );

  console.log("[Market Overview] History cleanup scheduler started");
};

module.exports = {
  startMarketOverviewJob,
  startFearGreedJob,
  startMarketHistoryCleanupJob,
};
