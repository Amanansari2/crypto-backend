const http = require("http");

const app = require("./app");

const env = require("./config/env");
const sequelize = require("./config/db");
const logger = require("./utils/logger");
const {
  startTpSlExecution,
  restoreTpSlSymbols
} = require("./services/trading/tp_sl_execution.service");

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
  "./services/trading/pnl_broadcast.service"
);

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

      await syncBinancePairs();
      await restoreTpSlSymbols();

     
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