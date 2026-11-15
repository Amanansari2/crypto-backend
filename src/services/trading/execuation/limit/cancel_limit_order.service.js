
const {
  TradingAccount,
  TradingOrder,
  TradingTransaction,
} = require("../../../../models/trading");

const sequelize = require("../../../../config/db");

// const round = (value, decimals = 8) =>
//   Number(Number(value).toFixed(decimals));

// const FEE_RATE = Number(
//   process.env.TRADING_FEE_RATE || 0.0004
// );

const {
  round,
  calculateNotional,
  calculateMargin,
} = require("../../calculations/trading_calculation.service");

const cancelLimitOrder = async ({ accountId, tradeId }) => {
  const transaction = await sequelize.transaction();

  try {
    accountId = String(accountId || "").trim();
    tradeId = String(tradeId || "").trim();

    if (!accountId || !tradeId) {
      throw new Error("Account ID and trade ID are required");
    }

    // Lock the order so execution and cancellation cannot
    // successfully process the same pending order.
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
        `Cannot cancel order with status ${order.status}`
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

    const quantity = Number(order.quantity);
    const price = Number(order.price);
    const leverage = Number(order.leverage);

    // const reservedMargin = (quantity * price) / leverage;
    // const reservedFee = quantity * price * FEE_RATE;
    // const amountToRelease = reservedMargin + reservedFee;


const reservedNotional = calculateNotional(quantity, price);

const reservedMargin = calculateMargin(
  reservedNotional,
  leverage
);

// const reservedFee = calculateFee(
//   reservedNotional,
//   FEE_RATE
// );

// const amountToRelease = reservedMargin + reservedFee;
// const amountToRelease = reservedMargin;

    const oldBalance = Number(account.balance);
    const oldAvailableBalance = Number(account.availableBalance);
    const oldUsedMargin = Number(account.usedMargin);

    // Mark as cancelled inside the same transaction.
    await order.update(
      { status: "CANCELLED" },
      { transaction }
    );

    await account.update(
      {
        availableBalance: round(
          // oldAvailableBalance + amountToRelease
         oldAvailableBalance + reservedMargin
        ),
        usedMargin: round(
          Math.max(0, oldUsedMargin - reservedMargin)
        ),
      },
      { transaction }
    );

    // await TradingTransaction.create(
    //   {
    //     accountId,
    //     type: "MARGIN_RELEASE",
    //     amount: round(amountToRelease),
    //     balanceBefore: round(oldBalance),
    //     balanceAfter: round(oldBalance),
    //     referenceType: "ORDER",
    //     referenceId: order.id,
    //     description: `Reserved margin and fee released for cancelled LIMIT order ${order.symbol}`,
    //   },
    //   { transaction }
    // );
await TradingTransaction.create(
  {
    accountId,
    type: "MARGIN_RELEASE",
    amount: round(reservedMargin),
    balanceBefore: round(oldBalance),
    balanceAfter: round(oldBalance),
    referenceType: "ORDER",
    referenceId: order.id,
    description: `Reserved margin released for cancelled LIMIT order ${order.symbol}`,
  },
  { transaction }
);
    await transaction.commit();

    return {
      success: true,
      message: "Limit order cancelled successfully",
      order: {
        id: order.id,
        tradeId: order.tradeId,
        symbol: order.symbol,
        status: "CANCELLED",
      },
      // released: {
      //   margin: round(reservedMargin),
      //   fee: round(reservedFee),
      //   total: round(amountToRelease),
      // },
released: {
  margin: round(reservedMargin),
  fee: 0,
  total: round(reservedMargin),
},
    };
  } catch (error) {
    if (!transaction.finished) {
      await transaction.rollback();
    }
    throw error;
  }
};

module.exports = { cancelLimitOrder };