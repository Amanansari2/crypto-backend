const {
  TradingAccount,
  TradingOrder,
  TradingOrderFill,
  TradingPosition,
  TradingTransaction,
} = require("../../../models/trading");

const marketStream = require(
  "../../../websocket/binance_market_stream.service"
);
const marketEvents = require(
  "../market_event.service"
);
const { sendToAccount } = require(
  "../../../websocket/trading_client_ws.service"
);

const sequelize = require("../../../config/db");

// --------------------------------------------------
// State
// --------------------------------------------------

const requiredSymbols = new Set();
const executingOrderIds = new Set();
let listenerAttached = false;

// --------------------------------------------------
// Require symbol
// --------------------------------------------------

const requireLimitOrderSymbol = (symbol) => {
  if (!symbol) return;

  const normalizedSymbol = String(symbol)
    .trim()
    .toUpperCase();

  if (requiredSymbols.has(normalizedSymbol)) {
    return;
  }

  marketStream.requireSharedData(
    normalizedSymbol,
  );

  requiredSymbols.add(normalizedSymbol);

  console.log(
    `🟡 LIMIT ORDER EXECUATION SUBSCRIBED | ${normalizedSymbol}`
  );
};

// --------------------------------------------------
// Release symbol
// --------------------------------------------------

const releaseLimitOrderSymbol = (symbol) => {
  if (!symbol) return;

  const normalizedSymbol = String(symbol)
    .trim()
    .toUpperCase();

  if (!requiredSymbols.has(normalizedSymbol)) {
    return;
  }

  marketStream.releaseSharedData(
    normalizedSymbol
  );

  requiredSymbols.delete(normalizedSymbol);

  console.log(
    `⚪ LIMIT ORDER EXECUATION RELEASED | ${normalizedSymbol}`
  );
};

// --------------------------------------------------
// Load OPEN limit orders
// --------------------------------------------------

const loadOpenLimitOrders = async () => {
  const orders = await TradingOrder.findAll({
    where: {
      orderType: "LIMIT",
      status: "OPEN",
    },
    attributes: [
      "id",
      "tradeId",
      "accountId",
      "symbol",
      "side",
      "quantity",
      "price",
      "leverage",
      "marginMode",
      "reduceOnly",
      "takeProfit",
      "stopLoss",
      "status",
    ],
    order: [["id", "ASC"]],
  });

  for (const order of orders) {
    requireLimitOrderSymbol(order.symbol);
  }

  console.log(
    `📋 LIMIT ORDERS RESTORED | ${orders.length}`
  );

  return orders;
};

// --------------------------------------------------
// Check whether order should trigger
// --------------------------------------------------

const shouldTriggerLimitOrder = (
  order,
  marketData
) => {
  if (!order || !marketData) {
    return false;
  }

  const limitPrice = Number(order.price);

  if (!Number.isFinite(limitPrice)) {
    return false;
  }

  if (order.side === "BUY") {
    const askPrice = Number(
      marketData.askPrice
    );

    if (!Number.isFinite(askPrice)) {
      return false;
    }

    return askPrice <= limitPrice;
  }

  if (order.side === "SELL") {
    const bidPrice = Number(
      marketData.bidPrice
    );

    if (!Number.isFinite(bidPrice)) {
      return false;
    }

    return bidPrice >= limitPrice;
  }

  return false;
};

// --------------------------------------------------
// Check all open orders
// --------------------------------------------------

const checkOpenLimitOrders = async () => {
  const orders = await TradingOrder.findAll({
    where: {
      orderType: "LIMIT",
      status: "OPEN",
    },
  });

  for (const order of orders) {
     // ----------------------------------------------
  // Prevent duplicate execution
  // ----------------------------------------------

    if (executingOrderIds.has(order.id)) {
    continue;
  }

    const symbol = String(order.symbol)
      .trim()
      .toUpperCase();

    const marketData =
      marketStream.getMarketData(symbol);

    if (!marketData) {
      continue;
    }

    const triggered =
      shouldTriggerLimitOrder(
        order,
        marketData
      );

    if (!triggered) {
      continue;
    }
     // ----------------------------------------------
    // Mark order as executing
    // ----------------------------------------------

      executingOrderIds.add(order.id);

    // console.log(
    //   `🎯 LIMIT ORDER TRIGGERED | ${order.side} ${order.quantity} ${symbol} @ ${order.price}`
    // );

    try {
      await executeLimitOrder(
        order,
        marketData
      );
    } catch (error) {
      console.error(
        `❌ LIMIT ORDER EXECUTION FAILED | orderId=${order.id}`,
        error.message
      );
    } finally {
      executingOrderIds.delete(order.id);
    }
  }

};

// --------------------------------------------------
// Execute triggered order
// --------------------------------------------------

const executeLimitOrder = async (
  order,
  marketData
) => {
  const transaction =
    await sequelize.transaction();

  try {
    // --------------------------------------------------
    // Lock the LIMIT order
    // --------------------------------------------------

    const lockedOrder =
      await TradingOrder.findOne({
        where: {
          id: order.id,
          orderType: "LIMIT",
          status: "OPEN",
        },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

    // Already executed by another worker/event
    if (!lockedOrder) {
      await transaction.rollback();
      return;
    }

    // --------------------------------------------------
    // Get fresh market data
    // --------------------------------------------------

    const symbol = String(
      lockedOrder.symbol
    )
      .trim()
      .toUpperCase();

    const side = String(
      lockedOrder.side
    )
      .trim()
      .toUpperCase();

    const quantity =
      Number(lockedOrder.quantity);

    const leverage =
      Number(lockedOrder.leverage);

    const limitPrice =
      Number(lockedOrder.price);

    const freshMarketData =
      marketStream.getMarketData(symbol);

    if (!freshMarketData) {
      throw new Error(
        `Live market data unavailable for ${symbol}`
      );
    }

    // --------------------------------------------------
    // Verify trigger again after acquiring DB lock
    // --------------------------------------------------

    if (
      !shouldTriggerLimitOrder(
        lockedOrder,
        freshMarketData
      )
    ) {
      await transaction.rollback();
      return;
    }

    // --------------------------------------------------
    // Execution price
    // --------------------------------------------------

    const executionPrice =
      side === "BUY"
        ? Number(freshMarketData.askPrice)
        : Number(freshMarketData.bidPrice);

    if (
      !Number.isFinite(executionPrice) ||
      executionPrice <= 0
    ) {
      throw new Error(
        `Invalid execution price for ${symbol}`
      );
    }

    // --------------------------------------------------
    // Safety check
    // --------------------------------------------------

    if (side === "BUY" &&
        executionPrice > limitPrice) {
      await transaction.rollback();
      return;
    }

    if (side === "SELL" &&
        executionPrice < limitPrice) {
      await transaction.rollback();
      return;
    }

    // --------------------------------------------------
    // Position values
    // --------------------------------------------------

    const positionSide =
      side === "BUY"
        ? "LONG"
        : "SHORT";

    const notional =
      quantity * executionPrice;

    const margin =
      notional / leverage;

    const FEE_RATE = Number(
      process.env.TRADING_FEE_RATE || 0.0004
    );

    const fee =
      notional * FEE_RATE;

    // --------------------------------------------------
    // Get account with lock
    // --------------------------------------------------

    const account =
      await TradingAccount.findOne({
        where: {
          accountId:
            lockedOrder.accountId,
          status: "ACTIVE",
        },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

    if (!account) {
      throw new Error(
        "Active trading account not found"
      );
    }

    // --------------------------------------------------
    // Reserved values from LIMIT creation
    // --------------------------------------------------

    const reservedNotional =
      quantity * limitPrice;

    const reservedMargin =
      reservedNotional / leverage;

    const reservedFee =
      reservedNotional * FEE_RATE;

    // --------------------------------------------------
    // Account current values
    // --------------------------------------------------

    const oldBalance =
      Number(account.balance);

    const oldAvailableBalance =
      Number(account.availableBalance);

    const oldUsedMargin =
      Number(account.usedMargin);

    const oldTotalFees =
      Number(account.totalFees);

    // --------------------------------------------------
    // Convert reservation to actual fill
    // --------------------------------------------------

    const newBalance =
      oldBalance - fee;

    const newAvailableBalance =
      oldAvailableBalance +
      (reservedMargin - margin) +
      (reservedFee - fee);

    const newUsedMargin =
      oldUsedMargin -
      reservedMargin +
      margin;

    const newTotalFees =
      oldTotalFees + fee;

    // --------------------------------------------------
    // Create position
    // --------------------------------------------------

    const position =
      await TradingPosition.create(
        {
          tradeId:
            lockedOrder.tradeId,

          accountId:
            lockedOrder.accountId,

          symbol,

          side: positionSide,

          quantity,

          entryPrice:
            executionPrice,

          markPrice:
            Number(
              freshMarketData.markPrice ||
              executionPrice
            ),

          leverage,

          marginMode:
            lockedOrder.marginMode,

          margin:
            Number(margin.toFixed(8)),

          unrealizedPnl: 0,

          realizedPnl: 0,

          liquidationPrice: null,

          takeProfit:
            lockedOrder.takeProfit,

          stopLoss:
            lockedOrder.stopLoss,

          status: "OPEN",
        },
        {
          transaction,
        }
      );

    // --------------------------------------------------
    // Create fill
    // --------------------------------------------------

    const fill =
      await TradingOrderFill.create(
        {
          orderId:
            lockedOrder.id,

          accountId:
            lockedOrder.accountId,

          positionId:
            position.id,

          symbol,

          side,

          quantity,

          price:
            executionPrice,

          fee,

          realizedPnl: 0,
        },
        {
          transaction,
        }
      );

    // --------------------------------------------------
    // Update LIMIT order
    // --------------------------------------------------

    await lockedOrder.update(
      {
        status: "FILLED",

        filledQuantity:
          quantity,

        averagePrice:
          executionPrice,

        fee,
      },
      {
        transaction,
      }
    );

    // --------------------------------------------------
    // Update account
    // --------------------------------------------------

    await account.update(
      {
        balance:
          Number(
            newBalance.toFixed(8)
          ),

        availableBalance:
          Number(
            newAvailableBalance.toFixed(8)
          ),

        usedMargin:
          Number(
            newUsedMargin.toFixed(8)
          ),

        totalFees:
          Number(
            newTotalFees.toFixed(8)
          ),
      },
      {
        transaction,
      }
    );

    // --------------------------------------------------
    // Update reserved MARGIN transaction
    // --------------------------------------------------

    const marginTransaction =
      await TradingTransaction.findOne({
        where: {
          accountId:
            lockedOrder.accountId,

          type: "MARGIN",

          referenceType: "ORDER",

          referenceId:
            lockedOrder.id,
        },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

    if (marginTransaction) {
      await marginTransaction.update(
        {
          amount:
            -Number(
              margin.toFixed(8)
            ),

          description:
            `Margin used for filled LIMIT ${side} ${quantity} ${symbol}`,
        },
        {
          transaction,
        }
      );
    }

    // --------------------------------------------------
    // Update reserved FEE transaction
    // --------------------------------------------------

    const feeTransaction =
      await TradingTransaction.findOne({
        where: {
          accountId:
            lockedOrder.accountId,

          type: "FEE",

          referenceType: "ORDER",

          referenceId:
            lockedOrder.id,
        },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

    if (feeTransaction) {
      await feeTransaction.update(
        {
          amount:
            -Number(
              fee.toFixed(8)
            ),

          description:
            `Trading fee for filled LIMIT ${symbol}`,
        },
        {
          transaction,
        }
      );
    }

    // --------------------------------------------------
    // Commit
    // --------------------------------------------------

    await transaction.commit();

    console.log(
      `✅ LIMIT ORDER FILLED | orderId=${lockedOrder.id} | ` +
      `${side} ${quantity} ${symbol} @ ${executionPrice}`
    );

    console.log(
      `📌 LIMIT POSITION CREATED | positionId=${position.id} | ` +
      `${positionSide} ${quantity} ${symbol}`
    );
    
sendToAccount(lockedOrder.accountId, {
  type: "LIMIT_ORDER_FILLED",
  accountId: lockedOrder.accountId,
  orderId: lockedOrder.id,
  tradeId: lockedOrder.tradeId,
  positionId: position.id,
  symbol,
  status: "FILLED",
  timestamp: Date.now(),
});


    return {
      success: true,

      order: lockedOrder,

      fill,

      position,

      account,
    };

  } catch (error) {
    if (!transaction.finished) {
      await transaction.rollback();
    }

    console.error(
      `❌ LIMIT ORDER FILL FAILED | orderId=${order.id} |`,
      error.message
    );

    throw error;
  }
};

// --------------------------------------------------
// Start
// --------------------------------------------------

const startLimitOrderExecution = async () => {
  if (listenerAttached) {
    return;
  }

  listenerAttached = true;

  await loadOpenLimitOrders();

  marketEvents.on(
    "sharedMarketData",
    async (marketData) => {
      if (!marketData?.symbol) {
        return;
      }
      
//   console.log(
//       `📡 LIMIT MARKET DATA | ${marketData.symbol} | bid=${marketData.bidPrice} | ask=${marketData.askPrice}`
//     );

      try {
        await checkOpenLimitOrders();
      } catch (error) {
        console.error(
          "❌ Limit order execution error:",
          error.message
        );
      }
    }
  );

  console.log(
    "🎯 Limit order execution service started"
  );
};

// --------------------------------------------------
// Exports
// --------------------------------------------------

module.exports = {
  startLimitOrderExecution,
  loadOpenLimitOrders,
  checkOpenLimitOrders,
  shouldTriggerLimitOrder,
  requireLimitOrderSymbol,
  releaseLimitOrderSymbol,
};