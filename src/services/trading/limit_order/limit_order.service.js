const crypto = require("crypto");

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

const FEE_RATE = Number(
  process.env.TRADING_FEE_RATE || 0.0004
);

// --------------------------------------------------
// Helpers
// --------------------------------------------------

const toNumber = (value) => Number(value);

const round = (value, decimals = 8) => {
  return Number(Number(value).toFixed(decimals));
};

// --------------------------------------------------
// Place Limit Order
// --------------------------------------------------

const placeLimitOrder = async ({
  accountId,
  symbol,
  side,
  quantity,
  price,
  leverage = 1,
  marginMode = "ISOLATED",
  reduceOnly = false,
  takeProfit = null,
  stopLoss = null,
}) => {
  const transaction =
    await sequelize.transaction();

  let symbolRequired = false;

  try {
    // --------------------------------------------------
    // Normalize
    // --------------------------------------------------

    accountId =
      String(accountId || "").trim();

    symbol =
      String(symbol || "")
        .trim()
        .toUpperCase();

    side =
      String(side || "")
        .trim()
        .toUpperCase();

    quantity = toNumber(quantity);
    price = toNumber(price);
    leverage = toNumber(leverage);

    marginMode =
      String(marginMode || "ISOLATED")
        .trim()
        .toUpperCase();

    reduceOnly = Boolean(reduceOnly);

    // --------------------------------------------------
    // Basic validation
    // --------------------------------------------------

    if (!accountId) {
      throw new Error(
        "Account ID is required"
      );
    }

    if (!symbol) {
      throw new Error(
        "Symbol is required"
      );
    }

    if (!["BUY", "SELL"].includes(side)) {
      throw new Error(
        "Side must be BUY or SELL"
      );
    }

    if (
      !Number.isFinite(quantity) ||
      quantity <= 0
    ) {
      throw new Error(
        "Quantity must be greater than 0"
      );
    }

    if (
      !Number.isFinite(price) ||
      price <= 0
    ) {
      throw new Error(
        "Limit price must be greater than 0"
      );
    }

    if (
      !Number.isFinite(leverage) ||
      leverage < 1 ||
      leverage > 125
    ) {
      throw new Error(
        "Leverage must be between 1 and 125"
      );
    }

    if (
      !["ISOLATED", "CROSS"].includes(
        marginMode
      )
    ) {
      throw new Error(
        "Margin mode must be ISOLATED or CROSS"
      );
    }

    // --------------------------------------------------
    // Validate Binance pair
    // --------------------------------------------------

    const pair =
      await BinancePair.findOne({
        where: {
          symbol,
        },
        transaction,
      });

    if (!pair) {
      throw new Error(
        `${symbol} is not an active Futures pair`
      );
    }

    // --------------------------------------------------
    // Require market data
    // --------------------------------------------------

    marketStream.requireSymbol(
      symbol,
      "limitOrder"
    );

    symbolRequired = true;

    // await marketStream.waitForMarketData(
    //   symbol
    // );

    const marketData =
      marketStream.getMarketData(symbol);

    if (!marketData) {
      throw new Error(
        `Market data unavailable for ${symbol}`
      );
    }

    const bidPrice =
      Number(
        marketData.bidPrice
      );

    const askPrice =
      Number(
        marketData.askPrice
      );

    if (
      !Number.isFinite(bidPrice) ||
      !Number.isFinite(askPrice)
    ) {
      throw new Error(
        `Live market price unavailable for ${symbol}`
      );
    }

    // --------------------------------------------------
    // Validate limit price direction
    // --------------------------------------------------

    if (
      side === "BUY" &&
      price >= askPrice
    ) {
      throw new Error(
        `BUY LIMIT price must be below current ask price (${askPrice})`
      );
    }

    if (
      side === "SELL" &&
      price <= bidPrice
    ) {
      throw new Error(
        `SELL LIMIT price must be above current bid price (${bidPrice})`
      );
    }

    // --------------------------------------------------
    // Validate TP / SL
    // --------------------------------------------------

    if (takeProfit != null) {
      takeProfit =
        toNumber(takeProfit);

      if (
        !Number.isFinite(takeProfit) ||
        takeProfit <= 0
      ) {
        throw new Error(
          "Invalid take profit price"
        );
      }
    }

    if (stopLoss != null) {
      stopLoss =
        toNumber(stopLoss);

      if (
        !Number.isFinite(stopLoss) ||
        stopLoss <= 0
      ) {
        throw new Error(
          "Invalid stop loss price"
        );
      }
    }

    // --------------------------------------------------
    // Validate TP / SL direction
    // --------------------------------------------------

    if (side === "BUY") {
      if (
        takeProfit != null &&
        takeProfit <= price
      ) {
        throw new Error(
          "BUY take profit must be above limit price"
        );
      }

      if (
        stopLoss != null &&
        stopLoss >= price
      ) {
        throw new Error(
          "BUY stop loss must be below limit price"
        );
      }
    }

    if (side === "SELL") {
      if (
        takeProfit != null &&
        takeProfit >= price
      ) {
        throw new Error(
          "SELL take profit must be below limit price"
        );
      }

      if (
        stopLoss != null &&
        stopLoss <= price
      ) {
        throw new Error(
          "SELL stop loss must be above limit price"
        );
      }
    }

    // --------------------------------------------------
    // Lock trading account
    // --------------------------------------------------

    const account =
      await TradingAccount.findOne({
        where: {
          accountId,
        },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

    if (!account) {
      throw new Error(
        "Trading account not found"
      );
    }

    if (
      String(account.currency)
        .toUpperCase() !== "USDT"
    ) {
      throw new Error(
        "Trading account currency must be USDT"
      );
    }

    // --------------------------------------------------
    // Calculate reservation
    // --------------------------------------------------

    const notional =
      quantity * price;

    const margin =
      notional / leverage;

    const fee =
      notional * FEE_RATE;

    const totalRequired =
      margin + fee;

    const oldBalance =
      toNumber(account.balance);

    const oldAvailableBalance =
      toNumber(
        account.availableBalance
      );

    const oldUsedMargin =
      toNumber(
        account.usedMargin
      );

    const oldTotalFees =
      toNumber(
        account.totalFees
      );

    if (
      oldAvailableBalance <
      totalRequired
    ) {
      throw new Error(
        "Insufficient available balance"
      );
    }

    // --------------------------------------------------
    // Create trade ID
    // --------------------------------------------------

    const tradeId =
      crypto.randomUUID();

    // --------------------------------------------------
    // Create LIMIT order
    // --------------------------------------------------

    const order =
      await TradingOrder.create(
        {
          tradeId,
          accountId,
          symbol,

          side,

          positionSide:
            side === "BUY"
              ? "LONG"
              : "SHORT",

          orderType: "LIMIT",

          quantity,

          price,

          triggerPrice: null,

          leverage,

          marginMode,

          reduceOnly,

          takeProfit,

          stopLoss,

          status: "OPEN",

          filledQuantity: 0,

          averagePrice: null,

          fee: 0,
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
        availableBalance:
          round(
            oldAvailableBalance -
              totalRequired
          ),

        usedMargin:
          round(
            oldUsedMargin +
              margin
          ),
      },
      {
        transaction,
      }
    );

    // --------------------------------------------------
    // MARGIN transaction
    // --------------------------------------------------

    await TradingTransaction.create(
      {
        accountId,

        type: "MARGIN",

        amount:
          -round(margin),

        balanceBefore:
          oldBalance,

        balanceAfter:
          oldBalance,

        referenceType:
          "ORDER",

        referenceId:
          order.id,

        description:
          `Margin reserved for LIMIT ${side} ${quantity} ${symbol}`,
      },
      {
        transaction,
      }
    );

    // --------------------------------------------------
    // FEE transaction
    // --------------------------------------------------

    await TradingTransaction.create(
      {
        accountId,

        type: "FEE",

        amount:
          -round(fee),

        balanceBefore:
          oldBalance,

        balanceAfter:
          oldBalance,

        referenceType:
          "ORDER",

        referenceId:
          order.id,

        description:
          `Fee reserved for LIMIT ${side} ${quantity} ${symbol}`,
      },
      {
        transaction,
      }
    );

    // --------------------------------------------------
    // Commit
    // --------------------------------------------------

    await transaction.commit();

    const { requireLimitOrderSymbol } =
  require("./limit_order_execution.service");

requireLimitOrderSymbol(symbol);

    console.log(
      `🟡 LIMIT ORDER CREATED | ${side} ${quantity} ${symbol} @ ${price} | tradeId=${tradeId}`
    );

    return {
      success: true,

      message:
        "Limit order placed successfully",

      order: {
        id: order.id,
        tradeId: order.tradeId,

        accountId:
          order.accountId,

        symbol:
          order.symbol,

        side:
          order.side,

        positionSide:
          order.positionSide,

        orderType:
          order.orderType,

        quantity:
          order.quantity,

        price:
          order.price,

        leverage:
          order.leverage,

        marginMode:
          order.marginMode,

        reduceOnly:
          order.reduceOnly,

        takeProfit:
          order.takeProfit,

        stopLoss:
          order.stopLoss,

        status:
          order.status,

        filledQuantity:
          order.filledQuantity,

        averagePrice:
          order.averagePrice,

        fee:
          order.fee,
      },

      reservation: {
        notional:
          round(notional),

        margin:
          round(margin),

        fee:
          round(fee),

        totalRequired:
          round(totalRequired),
      },

      account: {
        balance:
          round(oldBalance),

        availableBalance:
          round(
            oldAvailableBalance -
              totalRequired
          ),

        usedMargin:
          round(
            oldUsedMargin +
              margin
          ),

        totalFees:
          round(oldTotalFees),
      },
    };
  } catch (error) {
    if (!transaction.finished) {
      await transaction.rollback();
    }

    console.error(
      "❌ Place limit order error:",
      error.message
    );

    throw error;
  }
};

module.exports = {
  placeLimitOrder,
};