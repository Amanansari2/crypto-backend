const crypto = require("crypto");
const {
    TradingAccount,
    TradingOrder,
    TradingOrderFill,
    TradingPosition,
    TradingTransaction,
  } = require("../../models/trading");
  const {
    closeTrade,
  } = require("./trade_close.service");
  
  const BinancePair = require("../../models/binance/binance_pair_model");
  const marketStream = require("../../websocket/binance_market_stream.service");
  const sequelize = require("../../config/db");
  
  // Default Futures taker fee.
  // Keep this configurable through .env.
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
  // Place Market Order
  // --------------------------------------------------
  
  const placeMarketOrder = async ({
    accountId,
    symbol,
    side,
    quantity,
    leverage = 1,
    marginMode = "ISOLATED",
    reduceOnly = false,
    tradeId = null,
    takeProfit = null,
    stopLoss = null,
  }) => {

    if (reduceOnly) {
        return closeTrade({
          accountId,
          symbol,
          tradeId,
          quantity,
          side,
          orderType: "MARKET",
        });
      }

    const transaction = await sequelize.transaction();
  
    try {
      // ----------------------------------------------
      // Normalize input
      // ----------------------------------------------
  
      accountId = String(accountId);
      symbol = String(symbol).toUpperCase();
      side = String(side).toUpperCase();
  
      quantity = toNumber(quantity);
      leverage = toNumber(leverage);
      reduceOnly = Boolean(reduceOnly);
  
      // ----------------------------------------------
      // Validate
      // ----------------------------------------------
  
      if (!accountId) {
        throw new Error("Account ID is required");
      }
  
      if (!symbol) {
        throw new Error("Symbol is required");
      }
  
      if (!["BUY", "SELL"].includes(side)) {
        throw new Error("Side must be BUY or SELL");
      }
  
      if (!Number.isFinite(quantity) || quantity <= 0) {
        throw new Error("Quantity must be greater than 0");
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
        !["ISOLATED", "CROSS"].includes(marginMode)
      ) {
        throw new Error(
          "Margin mode must be ISOLATED or CROSS"
        );
      }
  
      // ----------------------------------------------
      // Check Futures pair
      // ----------------------------------------------
  
      const pair = await BinancePair.findOne({
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
  
      // ----------------------------------------------
      // Get account
      // ----------------------------------------------
  
      const account =
        await TradingAccount.findOne({
          where: {
            accountId,
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
  
      if (account.currency !== "USDT") {
        throw new Error(
          "Trading account must use USDT"
        );
      }
  
      // ----------------------------------------------
      // Get live market data
      // ----------------------------------------------
      marketStream.requireSymbol(
        symbol,
        "position"
      );
      
      await marketStream.waitForMarketData(
        symbol
      );

      const marketData =
        marketStream.getMarketData(symbol);

        console.log("🔎 MARKET EXECUTION PRICE CHECK:", {
            symbol,
            marketData,
            price: marketStream.getPrice(symbol),
            fresh: marketStream.isPriceFresh(symbol),
          });
  
      if (!marketData) {
        throw new Error(
          `Live market data unavailable for ${symbol}`
        );
      }
  
      if (!marketStream.isPriceFresh(symbol)) {
        throw new Error(
          `Market data for ${symbol} is stale`
        );
      }
  
      // ----------------------------------------------
      // Execution price
      //
      // BUY  -> Ask
      // SELL -> Bid
      // ----------------------------------------------
  
      const executionPrice =
        side === "BUY"
          ? toNumber(marketData.askPrice)
          : toNumber(marketData.bidPrice);
  
      const markPrice =
        toNumber(marketData.markPrice);
  
      if (
        !Number.isFinite(executionPrice) ||
        executionPrice <= 0
      ) {
        throw new Error(
          `Invalid execution price for ${symbol}`
        );
      }
  
      if (
        !Number.isFinite(markPrice) ||
        markPrice <= 0
      ) {
        throw new Error(
          `Invalid mark price for ${symbol}`
        );
      }

      // ----------------------------------------------
// Validate TP / SL
// ----------------------------------------------

if (takeProfit !== null && takeProfit !== undefined) {
    takeProfit = toNumber(takeProfit);
  
    if (!Number.isFinite(takeProfit) || takeProfit <= 0) {
      throw new Error("Invalid take profit price");
    }
  }
  
  if (stopLoss !== null && stopLoss !== undefined) {
    stopLoss = toNumber(stopLoss);
  
    if (!Number.isFinite(stopLoss) || stopLoss <= 0) {
      throw new Error("Invalid stop loss price");
    }
  }
  
  // LONG / BUY
  if (side === "BUY") {
    if (stopLoss !== null && stopLoss >= executionPrice) {
      throw new Error(
        `Stop loss must be below entry price for LONG. Entry: ${executionPrice}, SL: ${stopLoss}`
      );
    }
  
    if (takeProfit !== null && takeProfit <= executionPrice) {
      throw new Error(
        `Take profit must be above entry price for LONG. Entry: ${executionPrice}, TP: ${takeProfit}`
      );
    }
  }
  
  // SHORT / SELL
  if (side === "SELL") {
    if (stopLoss !== null && stopLoss <= executionPrice) {
      throw new Error(
        `Stop loss must be above entry price for SHORT. Entry: ${executionPrice}, SL: ${stopLoss}`
      );
    }
  
    if (takeProfit !== null && takeProfit >= executionPrice) {
      throw new Error(
        `Take profit must be below entry price for SHORT. Entry: ${executionPrice}, TP: ${takeProfit}`
      );
    }
  }
  
      // ----------------------------------------------
      // Determine position side
      //
      // Normal:
      // BUY  -> LONG
      // SELL -> SHORT
      //
      // Reduce:
      // SELL -> LONG
      // BUY  -> SHORT
      // ----------------------------------------------
  
      const positionSide = reduceOnly
        ? side === "SELL"
          ? "LONG"
          : "SHORT"
        : side === "BUY"
          ? "LONG"
          : "SHORT";
  
      
  
  
  
      // ==================================================
      // OPEN / INCREASE
      // ==================================================
  
      const notional =
        quantity * executionPrice;
  
      const margin =
        notional / leverage;
  
      const fee =
        notional * FEE_RATE;
  
      const totalRequired =
        margin + fee;
  
      const availableBalance =
        toNumber(account.availableBalance);
  
      if (
        availableBalance < totalRequired
      ) {
        throw new Error(
          `Insufficient available balance. Required: ${round(
            totalRequired
          )} USDT, Available: ${round(
            availableBalance
          )} USDT`
        );
      }
  
      // ----------------------------------------------
      // Create order
      // ----------------------------------------------
      const newTradeId = crypto.randomUUID();
      const order =
        await TradingOrder.create(
          {
            tradeId: newTradeId,
            accountId,
            symbol,
            side,
            positionSide,
            orderType: "MARKET",
            quantity,
            price: executionPrice,
            triggerPrice: null,
            leverage,
            marginMode,
            reduceOnly: false,
            takeProfit,
            stopLoss,
            status: "FILLED",
            filledQuantity: quantity,
            averagePrice: executionPrice,
            fee,
          },
          {
            transaction,
          }
        );
  
     
  
      // ----------------------------------------------
      // Find same-side position
      // ----------------------------------------------
  
    
    const position =
  await TradingPosition.create(
    {
        tradeId: newTradeId,
      accountId,
      symbol,
      side: positionSide,
      quantity,
      entryPrice: executionPrice,
      markPrice,
      leverage,
      marginMode,
      margin: round(margin),
      unrealizedPnl: 0,
      realizedPnl: 0,
      liquidationPrice: null,
      takeProfit,
      stopLoss,
      status: "OPEN",
    },
    {
      transaction,
    }
  );

   // ----------------------------------------------
      // Create fill
      // ----------------------------------------------
  
      const fill =
        await TradingOrderFill.create(
          {
            orderId: order.id,
            accountId,
            positionId: position.id,
            symbol,
            side,
            quantity,
            price: executionPrice,
            fee,
            realizedPnl: 0,
          },
          {
            transaction,
          }
        );
  
      // ----------------------------------------------
      // Account update
      // ----------------------------------------------
  
      const oldBalance =
        toNumber(account.balance);
  
      const oldAvailableBalance =
        toNumber(account.availableBalance);
  
      const oldUsedMargin =
        toNumber(account.usedMargin);
  
      const newBalance =
        oldBalance - fee;
  
      const newAvailableBalance =
        oldAvailableBalance -
        totalRequired;
  
      const newUsedMargin =
        oldUsedMargin + margin;
  
      const newTotalFees =
        toNumber(account.totalFees) +
        fee;

        const newRealizedPnl =
  toNumber(account.realizedPnl);

  
      await account.update(
        {
          balance:
            round(newBalance),
  
          availableBalance:
            round(newAvailableBalance),
  
          usedMargin:
            round(newUsedMargin),
            realizedPnl: round(newRealizedPnl),
  
          totalFees:
            round(newTotalFees),
        },
        {
          transaction,
        }
      );
  
      // ----------------------------------------------
      // Margin transaction
      // ----------------------------------------------
  
      await TradingTransaction.create(
        {
          accountId,
          type: "MARGIN",
          amount: -round(margin),
          balanceBefore: round(oldBalance),
          balanceAfter: round(oldBalance),
          referenceType: "ORDER",
          referenceId: order.id,
          description: `Margin reserved for ${side} ${quantity} ${symbol}`,
        },
        {
          transaction,
        }
      );
  
      // ----------------------------------------------
      // Fee transaction
      // ----------------------------------------------
  
      await TradingTransaction.create(
        {
          accountId,
          type: "FEE",
          amount:
            -round(fee),
          balanceBefore:
            round(oldBalance),
          balanceAfter:
            round(newBalance),
          referenceType: "ORDER",
          referenceId: order.id,
          description:
            `Trading fee for ${symbol}`,
        },
        {
          transaction,
        }
      );
  
      // ----------------------------------------------
      // Commit
      // ----------------------------------------------
  
      await transaction.commit();

      console.log(
        `📈 POSITION OPEN | ${symbol} | tradeId=${newTradeId}`
      );
    //      marketStream.requireSymbol(
    //     symbol,
    //     "position"
    //   );
 
      console.log(
        `🔎 POSITION SUBSCRIPTION CHECK | ${symbol} | position requirement should remain active`
      );
      
   
      
  
      return {
        success: true,
  
        order: {
          id: order.id,
          tradeId: order.tradeId,
          accountId,
          symbol,
          side,
          positionSide,
          orderType: "MARKET",
          quantity,
          executionPrice,
          leverage,
          marginMode,
          margin:
            round(margin),
          notional:
            round(notional),
          fee:
            round(fee),
          status: "FILLED",
        },
  
        fill: {
          id: fill.id,
          quantity,
          price: executionPrice,
          fee:
            round(fee),
        },
  
        position: {
          id: position.id,
          tradeId: position.tradeId,
          symbol,
          side: position.side,
          quantity:
            round(
              toNumber( position.quantity )
            ),
          entryPrice:
            round(
              toNumber(position.entryPrice)
            ),
          markPrice,
          leverage,
          margin:
            round(
              toNumber(position.margin)
            ),
          unrealizedPnl: 0,
          realizedPnl:
            round(
              toNumber(position.realizedPnl)
            ),
          status: position.status,
        },
  
        account: {
          accountId,
          balance: round(newBalance),
          availableBalance: round( newAvailableBalance),
          usedMargin: round(newUsedMargin),
          realizedPnl: round(newRealizedPnl),
          totalFees: round(newTotalFees),
        },
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  };
  
  // --------------------------------------------------
  // Export
  // --------------------------------------------------
  
  module.exports = {placeMarketOrder,};