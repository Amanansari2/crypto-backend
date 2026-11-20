const http = require("http");

const app = require("./app");

const env = require("./config/env");
const sequelize = require("./config/db");
const logger = require("./utils/logger");
const {
  startMarketOverviewJob,
  startFearGreedJob,
  startMarketHistoryCleanupJob,
} = require("./jobs/market/market_overview.job");

const {
  startTpSlExecution,
  restoreTpSlSymbols
} = require("./services/trading/risk/tp_sl_execution.service");
 
const syncBinancePairs = require(
  "./services/binance/binance.sync.service"
);

const startBinanceJob = require(
  "./jobs/binance/binance.job"
);



const tradingClientWs = require(
  "./websocket/trading_client_ws.service"
);
const pnlBroadcast = require(
  "./services/trading/positions/pnl_broadcast.service"
);

const {
    verifyEmailConnection
} = require("./services/email.service");

verifyEmailConnection()
    .then(() => {
        console.log("Hostinger SMTP is ready");
    })
    .catch((error) => {
        console.error("SMTP connection failed:", error.message);
    });

console.log("SMTP host:", process.env.SMTP_HOST);
console.log("SMTP port:", process.env.SMTP_PORT);
console.log("SMTP username:", process.env.SMTP_USER);
console.log("SMTP password loaded:", Boolean(process.env.SMTP_PASS));

const {
  startLimitOrderExecution,
} = require("./services/trading/execuation/limit/limit_order_execution.service");



const startServer = async () => {

  const server = http.createServer(app);

  tradingClientWs.initializeTradingWebSocket(
    server
  );

  server.listen(env.port, async () => {

    logger.info(
      `Server running on port ${env.port}`
    );

    try {

      await sequelize.authenticate();

      logger.info("Database connected");
await startMarketOverviewJob(); 
await startFearGreedJob();
      await startMarketHistoryCleanupJob();
      await syncBinancePairs();
      await restoreTpSlSymbols();
      await startLimitOrderExecution();

     
      startTpSlExecution();
      pnlBroadcast.startPnlBroadcast();
      

      logger.info( 
        "🚀 Trading services started"
      );

      startBinanceJob();

    } catch (error) {

      const message =
        error &&
        (
          error.message ||
          error.original?.message ||
          error.name
        )
          ? error.message ||
            error.original?.message ||
            error.name
          : "Unknown database connection error";

      logger.error(
        "Database connection failed:",
        message
      );

      logger.warn(
        "API is running, but database-dependent routes may fail."
      );
    }
  });
};

startServer();