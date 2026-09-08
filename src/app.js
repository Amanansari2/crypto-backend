const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const marketRoutes = require("./routes/market.routes");
const binanceRoutes = require("./routes/binance/binance_routes");
const errorMiddleware = require("./middlewares/error.middleware");
const tradingRoutes = require("./routes/trading/trading_routes");


const app = express();

app.use(helmet());
app.use(cors());
app.use(morgan("dev"));
app.use(express.json());

app.get("/health", (req, res) => {
  res.status(200).json({ success: true, message: "API healthy" });
});

app.use("/api/market", marketRoutes);
app.use("/api/binance", binanceRoutes);
app.use(
  "/api/trading",
  tradingRoutes
);
app.use(errorMiddleware);

module.exports = app;
