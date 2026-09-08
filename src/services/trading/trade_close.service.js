const {
    TradingAccount,
    TradingOrder,
    TradingOrderFill,
    TradingPosition,
    TradingTransaction,
  } = require("../../models/trading");
  
  const sequelize = require("../../config/db");
  const marketStream = require("../../websocket/binance_market_stream.service");
  
  // Default Futures taker fee
  const FEE_RATE = Number(
    process.env.TRADING_FEE_RATE || 0.0004
  );
  
  const toNumber = (value) => Number(value);
  
  const round = (value, decimals = 8) => {
    return Number(Number(value).toFixed(decimals));
  };
  
  /**
   * Close an existing trade.
   *
   * This is the single close engine used by:
   * - Manual reduceOnly MARKET close
   * - Take Profit
   * - Stop Loss
   */
  const closeTrade = async ({
    accountId,
    symbol,
    tradeId,
    quantity,
    side,
    orderType = "MARKET",
    executionPrice = null,
    triggerPrice = null,
  }) => {
    const transaction = await sequelize.transaction();
  
    try {
      accountId = String(accountId);
      symbol = String(symbol).toUpperCase();
      tradeId = String(tradeId);
      quantity = toNumber(quantity);
  
      if (!accountId) {
        throw new Error("Account ID is required");
      }
  
      if (!symbol) {
        throw new Error("Symbol is required");
      }
  
      if (!tradeId) {
        throw new Error("tradeId is required");
      }
  
      if (!Number.isFinite(quantity) || quantity <= 0) {
        throw new Error("Close quantity must be greater than 0");
      }
  
      // --------------------------------------------------
      // Account
      // --------------------------------------------------
  
      const account = await TradingAccount.findOne({
        where: {
          accountId,
          status: "ACTIVE",
        },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
  
      if (!account) {
        throw new Error("Active trading account not found");
      }
  
      // --------------------------------------------------
      // Position
      // --------------------------------------------------
  
      const position = await TradingPosition.findOne({
        where: {
          tradeId,
          accountId,
          symbol,
          status: "OPEN",
        },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
  
      if (!position) {
        throw new Error(
          `No open position exists for tradeId ${tradeId}`
        );
      }
  
      const positionSide = position.side;
  
      // --------------------------------------------------
      // Execution price
      // --------------------------------------------------
  
      let markPrice;
  
      if (executionPrice === null) {
        const marketData =
          marketStream.getMarketData(symbol);
  
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
  
        executionPrice =
          side === "BUY"
            ? toNumber(marketData.askPrice)
            : toNumber(marketData.bidPrice);
  
        markPrice = toNumber(marketData.markPrice);
      } else {
        executionPrice = toNumber(executionPrice);
  
        const marketData =
          marketStream.getMarketData(symbol);
  
        markPrice = marketData
          ? toNumber(marketData.markPrice)
          : executionPrice;
      }
  
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
        markPrice = executionPrice;
      }
  
      // --------------------------------------------------
      // Existing position values
      // --------------------------------------------------
  
      const oldQuantity =
        toNumber(position.quantity);
  
      const oldEntryPrice =
        toNumber(position.entryPrice);
  
      const oldMargin =
        toNumber(position.margin);
  
      if (quantity > oldQuantity) {
        throw new Error(
          `Cannot close ${quantity} ${symbol}. Open position quantity is only ${oldQuantity}`
        );
      }
  
      // --------------------------------------------------
      // Closing notional + fee
      // --------------------------------------------------
  
      const notional =
        quantity * executionPrice;
  
      const fee =
        notional * FEE_RATE;
  
      // --------------------------------------------------
      // Realized PnL
      // --------------------------------------------------
  
      let realizedPnl = 0;
  
      if (positionSide === "LONG") {
        realizedPnl =
          (executionPrice - oldEntryPrice) *
          quantity;
      } else {
        realizedPnl =
          (oldEntryPrice - executionPrice) *
          quantity;
      }
  
      realizedPnl = round(realizedPnl);
  
      // --------------------------------------------------
      // Margin release
      // --------------------------------------------------
  
      const releasedMargin =
        oldQuantity > 0
          ? oldMargin *
            (quantity / oldQuantity)
          : 0;
  
      const remainingQuantity =
        oldQuantity - quantity;
  
      const remainingMargin =
        oldMargin - releasedMargin;
  
      // --------------------------------------------------
      // Create closing order
      // --------------------------------------------------
  
      const order =
        await TradingOrder.create(
          {
            tradeId: position.tradeId,
            accountId,
            symbol,
            side,
            positionSide,
            orderType,
            quantity,
            price: executionPrice,
            triggerPrice,
            leverage: position.leverage,
            marginMode: position.marginMode,
            reduceOnly: true,
            takeProfit: null,
            stopLoss: null,
            status: "FILLED",
            filledQuantity: quantity,
            averagePrice: executionPrice,
            fee,
            parentOrderId: null,
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
            orderId: order.id,
            accountId,
            positionId: position.id,
            symbol,
            side,
            quantity,
            price: executionPrice,
            fee,
            realizedPnl,
          },
          {
            transaction,
          }
        );
  
      // --------------------------------------------------
      // Update position
      // --------------------------------------------------
  
      const previousRealizedPnl =
        toNumber(position.realizedPnl);
  
      const totalRealizedPnl =
        previousRealizedPnl +
        realizedPnl;
  
      let updatedPosition;
  
      if (remainingQuantity <= 0) {
        updatedPosition =
          await position.update(
            {
              quantity: 0,
              markPrice,
              margin: 0,
              unrealizedPnl: 0,
              realizedPnl:
                round(totalRealizedPnl),
              status: "CLOSED",
            },
            {
              transaction,
            }
          );
      } else {
        updatedPosition =
          await position.update(
            {
              quantity:
                round(remainingQuantity),
              markPrice,
              margin:
                round(remainingMargin),
              unrealizedPnl: 0,
              realizedPnl:
                round(totalRealizedPnl),
            },
            {
              transaction,
            }
          );
      }
  
      // --------------------------------------------------
      // Account update
      // --------------------------------------------------
  
      const oldBalance =
        toNumber(account.balance);
  
      const oldAvailableBalance =
        toNumber(account.availableBalance);
  
      const oldUsedMargin =
        toNumber(account.usedMargin);
  
      const newBalance =
        oldBalance +
        realizedPnl -
        fee;
  
      const newAvailableBalance =
        oldAvailableBalance +
        releasedMargin +
        realizedPnl -
        fee;
  
      const newUsedMargin =
        Math.max(
          0,
          oldUsedMargin -
            releasedMargin
        );
  
      const newTotalFees =
        toNumber(account.totalFees) +
        fee;

        const newRealizedPnl =
  toNumber(account.realizedPnl) +
  realizedPnl;
  
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
  
      // --------------------------------------------------
      // Margin release transaction
      // --------------------------------------------------
  
      await TradingTransaction.create(
        {
          accountId,
  
          type: "MARGIN_RELEASE",
  
          amount:
            round(releasedMargin),
  
          balanceBefore:
            round(oldBalance),
  
          balanceAfter:
            round(
              oldBalance +
              realizedPnl
            ),
  
          referenceType: "ORDER",
  
          referenceId: order.id,
  
          description:
            `Margin released for ${side} ${quantity} ${symbol} trade ${tradeId}`,
        },
        {
          transaction,
        }
      );
  
      // --------------------------------------------------
      // Realized PnL transaction
      // --------------------------------------------------
  
      if (realizedPnl !== 0) {
        await TradingTransaction.create(
          {
            accountId,
  
            type: "REALIZED_PNL",
  
            amount:
              round(realizedPnl),
  
            balanceBefore:
              round(oldBalance),
  
            balanceAfter:
              round(
                oldBalance +
                realizedPnl
              ),
  
            referenceType: "ORDER",
  
            referenceId: order.id,
  
            description:
              `Realized PnL for ${symbol} trade ${tradeId}`,
          },
          {
            transaction,
          }
        );
      }
  
      // --------------------------------------------------
      // Fee transaction
      // --------------------------------------------------
  
      await TradingTransaction.create(
        {
          accountId,
  
          type: "FEE",
  
          amount:
            -round(fee),
  
          balanceBefore:
            round(
              oldBalance +
              realizedPnl
            ),
  
          balanceAfter:
            round(newBalance),
  
          referenceType: "ORDER",
  
          referenceId: order.id,
  
          description:
            `Trading fee for closing ${symbol} trade ${tradeId}`,
        },
        {
          transaction,
        }
      );
  
      // --------------------------------------------------
      // Commit
      // --------------------------------------------------
  
      await transaction.commit();

      if (remainingQuantity <= 0) {
        console.log(
          `📴 POSITION CLOSED | ${symbol} | tradeId=${tradeId}`
        );
      
        marketStream.releaseSymbol(
          symbol,
          "position"
        );
      }
  
      return {
        success: true,
  
        order: {
          id: order.id,
          tradeId: order.tradeId,
          accountId,
          symbol,
          side,
          positionSide,
          orderType,
          quantity,
          executionPrice,
          leverage:
            toNumber(position.leverage),
          marginMode:
            position.marginMode,
          reduceOnly: true,
          notional:
            round(notional),
          fee:
            round(fee),
          triggerPrice,
          status: "FILLED",
        },
  
        fill: {
          id: fill.id,
          quantity,
          price: executionPrice,
          fee: round(fee),
          realizedPnl:
            round(realizedPnl),
        },
  
        position: {
          id: updatedPosition.id,
          tradeId:
            updatedPosition.tradeId,
          symbol,
          side:
            updatedPosition.side,
          quantity:
            round(
              toNumber(
                updatedPosition.quantity
              )
            ),
          entryPrice:
            round(
              toNumber(
                updatedPosition.entryPrice
              )
            ),
          markPrice,
          leverage:
            toNumber(
              updatedPosition.leverage
            ),
          margin:
            round(
              toNumber(
                updatedPosition.margin
              )
            ),
          unrealizedPnl: 0,
          realizedPnl:
            round(
              toNumber(
                updatedPosition.realizedPnl
              )
            ),
          status:
            updatedPosition.status,
        },
  
        account: {
          accountId,
  
          balance:
            round(newBalance),
  
          availableBalance:
            round(
              newAvailableBalance
            ),
  
          usedMargin:
            round(newUsedMargin),
            realizedPnl: round(newRealizedPnl),
  
          totalFees:
            round(newTotalFees),
        },
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  };
  
  module.exports = {
    closeTrade,
  };