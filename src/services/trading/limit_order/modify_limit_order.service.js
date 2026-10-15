
const {
  TradingAccount,
  TradingOrder,
  TradingTransaction,
} = require("../../../models/trading");

const BinancePair = require(
  "../../../models/binance/binance_pair_model"
);

const marketStream = require(
  "../../../websocket/binance_market_stream.service"
);

const sequelize = require("../../../config/db");

const round = (value, decimals = 8) =>
  Number(Number(value).toFixed(decimals));

const FEE_RATE = Number(
  process.env.TRADING_FEE_RATE || 0.0004
);

const modifyLimitOrder = async ({
  accountId,
  tradeId,
  price,
  quantity,
  takeProfit = null,
  stopLoss = null,
}) => {
  const transaction = await sequelize.transaction();

  try {
    accountId = String(accountId || "").trim();
    tradeId = String(tradeId || "").trim();
    price = Number(price);
    quantity = Number(quantity);

    if (!accountId || !tradeId) {
      throw new Error("Account ID and trade ID are required");
    }

    if (!Number.isFinite(price) || price <= 0) {
      throw new Error("Limit price must be greater than 0");
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new Error("Quantity must be greater than 0");
    }

    const order = await TradingOrder.findOne({
      where: {
        accountId,
        tradeId,
        orderType: "LIMIT",
      },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!order) {
      throw new Error("Limit order not found");
    }

    if (order.status !== "OPEN") {
      throw new Error(
        `Cannot modify order with status ${order.status}`
      );
    }

    const account = await TradingAccount.findOne({
      where: { accountId },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!account) {
      throw new Error("Trading account not found");
    }

    const pair = await BinancePair.findOne({
      where: { symbol: order.symbol },
      transaction,
    });

    if (!pair) {
      throw new Error(
        `${order.symbol} is not an active Futures pair`
      );
    }

    const symbol = String(order.symbol).toUpperCase();

    marketStream.requireSymbol(symbol, "limitOrder");

    const marketData = marketStream.getMarketData(symbol);

    if (!marketData) {
      throw new Error(
        `Market data unavailable for ${symbol}`
      );
    }

    const bidPrice = Number(marketData.bidPrice);
    const askPrice = Number(marketData.askPrice);

    if (
      !Number.isFinite(bidPrice) ||
      !Number.isFinite(askPrice)
    ) {
      throw new Error("Live market price unavailable");
    }

    if (order.side === "BUY" && price >= askPrice) {
      throw new Error(
        `BUY LIMIT price must be below current ask price (${askPrice})`
      );
    }

    if (order.side === "SELL" && price <= bidPrice) {
      throw new Error(
        `SELL LIMIT price must be above current bid price (${bidPrice})`
      );
    }

    // Validate optional TP and SL.
    if (takeProfit !== null) {
      takeProfit = Number(takeProfit);

      if (!Number.isFinite(takeProfit) || takeProfit <= 0) {
        throw new Error("Invalid take profit price");
      }
    }

    if (stopLoss !== null) {
      stopLoss = Number(stopLoss);

      if (!Number.isFinite(stopLoss) || stopLoss <= 0) {
        throw new Error("Invalid stop loss price");
      }
    }

    // Match the existing limit-order placement rules.
    if (order.side === "BUY") {
      if (takeProfit !== null && takeProfit <= price) {
        throw new Error(
          "BUY take profit must be above limit price"
        );
      }

      if (stopLoss !== null && stopLoss >= price) {
        throw new Error(
          "BUY stop loss must be below limit price"
        );
      }
    }

    if (order.side === "SELL") {
      if (takeProfit !== null && takeProfit >= price) {
        throw new Error(
          "SELL take profit must be below limit price"
        );
      }

      if (stopLoss !== null && stopLoss <= price) {
        throw new Error(
          "SELL stop loss must be above limit price"
        );
      }
    }

    const leverage = Number(order.leverage);
    const oldQuantity = Number(order.quantity);
    const oldPrice = Number(order.price);

    if (!Number.isFinite(leverage) || leverage <= 0) {
      throw new Error("Invalid order leverage");
    }

    const oldMargin = (oldQuantity * oldPrice) / leverage;
    const oldFee = oldQuantity * oldPrice * FEE_RATE;

    const newMargin = (quantity * price) / leverage;
    const newFee = quantity * price * FEE_RATE;

    const marginDifference = newMargin - oldMargin;
    const feeDifference = newFee - oldFee;
    const totalDifference = marginDifference + feeDifference;

    const availableBalance = Number(account.availableBalance);
    const usedMargin = Number(account.usedMargin);

    if (
      totalDifference > 0 &&
      availableBalance < totalDifference
    ) {
      throw new Error("Insufficient available balance");
    }

    console.log("MODIFY ORDER DEBUG:", {
  accountId,
  orderId: order.id,
  tradeId: order.tradeId,
});

    const marginTransaction = await TradingTransaction.findOne({
      where: {
        accountId,
        type: "MARGIN",
        referenceType: "ORDER",
        referenceId: order.id,
      },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    const feeTransaction = await TradingTransaction.findOne({
      where: {
        accountId,
        type: "FEE",
        referenceType: "ORDER",
        referenceId: order.id,
      },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!marginTransaction || !feeTransaction) {
      throw new Error("Order reservation transactions not found");
    }

    await account.update(
      {
        availableBalance: round(
          availableBalance - totalDifference
        ),
        usedMargin: round(
          Math.max(0, usedMargin + marginDifference)
        ),
      },
      { transaction }
    );

    await marginTransaction.update(
      {
        amount: round(-newMargin),
        description:
          `Margin reserved for modified LIMIT ${order.side} ${quantity} ${symbol}`,
      },
      { transaction }
    );

    await feeTransaction.update(
      {
        amount: round(-newFee),
        description:
          `Fee reserved for modified LIMIT ${order.side} ${quantity} ${symbol}`,
      },
      { transaction }
    );

    await order.update(
      {
        price: round(price),
        quantity: round(quantity),
        takeProfit:
          takeProfit === null ? null : round(takeProfit),
        stopLoss:
          stopLoss === null ? null : round(stopLoss),
      },
      { transaction }
    );

    await transaction.commit();

    return {
      success: true,
      message: "Limit order modified successfully",
      order: {
        id: order.id,
        tradeId: order.tradeId,
        accountId: order.accountId,
        symbol: order.symbol,
        side: order.side,
        price: round(price),
        quantity: round(quantity),
        takeProfit:
          takeProfit === null ? null : round(takeProfit),
        stopLoss:
          stopLoss === null ? null : round(stopLoss),
        status: order.status,
      },
      reservation: {
        previousMargin: round(oldMargin),
        newMargin: round(newMargin),
        previousFee: round(oldFee),
        newFee: round(newFee),
        availableBalanceAdjustment: round(-totalDifference),
      },
    };
  } catch (error) {
    if (!transaction.finished) {
      await transaction.rollback();
    }

    throw error;
  }
};

module.exports = { modifyLimitOrder };
