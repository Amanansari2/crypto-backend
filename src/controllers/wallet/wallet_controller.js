
const {
  TradingAccount,
  TradingTransaction,
  TradingPosition,
  TradingOrder,
  TradingOrderFill,
} = require("../../models/trading");

const MAX_PAGE_SIZE = 100;

const parsePagination = (query) => {
  const requestedLimit = Number.parseInt(query.limit, 10);
  const requestedOffset = Number.parseInt(query.offset, 10);

  const limit =
    Number.isInteger(requestedLimit) && requestedLimit > 0
      ? Math.min(requestedLimit, MAX_PAGE_SIZE)
      : 20;

  const offset =
    Number.isInteger(requestedOffset) && requestedOffset >= 0
      ? requestedOffset
      : 0;

  return { limit, offset };
};

const getWalletOverview = async (req, res) => {
  try {
    const { accountId } = req.params;

    const account = await TradingAccount.findOne({
      where: { accountId },
      attributes: [
        "accountId",
        "currency",
        "balance",
        "availableBalance",
        "usedMargin",
        "realizedPnl",
        "totalFees",
        "status",
      ],
    });

    if (!account) {
      return res.status(404).json({
        success: false,
        message: "Trading account not found",
      });
    }

    const openPositions = await TradingPosition.findAll({
      where: { accountId, status: "OPEN" },
      attributes: ["unrealizedPnl"],
    });

    const unrealizedPnl = openPositions.reduce(
      (total, position) =>
        total + Number(position.unrealizedPnl || 0),
      0,
    );

    const recentTransactions = await TradingTransaction.findAll({
      where: { accountId },
      attributes: [
        "id",
        "type",
        "amount",
        "balanceBefore",
        "balanceAfter",
        "referenceType",
        "referenceId",
        "description",
        "createdAt",
      ],
      order: [
        ["createdAt", "DESC"],
        ["id", "DESC"],
      ],
      limit: 50,
    });

    return res.status(200).json({
      success: true,
      wallet: {
        ...account.toJSON(),
        unrealizedPnl: Number(unrealizedPnl.toFixed(8)),
      },
      recentTransactions,
    });
  } catch (error) {
    console.error("Get wallet overview error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch wallet overview",
    });
  }
};

const getWalletTransactions = async (req, res) => {
  try {
    const { accountId } = req.params;
    const { limit, offset } = parsePagination(req.query);

    const accountExists = await TradingAccount.findOne({
      where: { accountId },
      attributes: ["accountId"],
    });

    if (!accountExists) {
      return res.status(404).json({
        success: false,
        message: "Trading account not found",
      });
    }

    const { count, rows } = await TradingTransaction.findAndCountAll({
      where: { accountId },
      order: [
        ["createdAt", "DESC"],
        ["id", "DESC"],
      ],
      limit,
      offset,
    });

    const nextOffset = offset + rows.length;

    return res.status(200).json({
      success: true,
      transactions: rows,
      pagination: {
        limit,
        offset,
        total: count,
        hasMore: nextOffset < count,
        nextOffset: nextOffset < count ? nextOffset : null,
      },
    });
  } catch (error) {
    console.error("Get wallet transactions error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch wallet transactions",
    });
  }
};

const getWalletTrades = async (req, res) => {
  try {
    const { accountId } = req.params;
    const { limit, offset } = parsePagination(req.query);

    const accountExists = await TradingAccount.findOne({
      where: { accountId },
      attributes: ["accountId"],
    });

    if (!accountExists) {
      return res.status(404).json({
        success: false,
        message: "Trading account not found",
      });
    }

    // One summary per tradeId, not one per order/fill.
    const tradeGroups = await TradingOrder.findAll({
      where: { accountId },
      attributes: [
        "tradeId",
        [TradingOrder.sequelize.fn("MIN", TradingOrder.sequelize.col("created_at")), "firstOrderAt"],
        [TradingOrder.sequelize.fn("MAX", TradingOrder.sequelize.col("created_at")), "lastOrderAt"],
      ],
      group: ["tradeId"],
      order: [
        [TradingOrder.sequelize.fn("MAX", TradingOrder.sequelize.col("created_at")), "DESC"],
        ["tradeId", "DESC"],
      ],
      limit,
      offset,
      raw: true,
    });

    const trades = await Promise.all(
      tradeGroups.map(async (group) => {
        const orders = await TradingOrder.findAll({
          where: { accountId, tradeId: group.tradeId },
          attributes: [
            "id",
            "tradeId",
            "symbol",
            "side",
            "positionSide",
            "orderType",
            "quantity",
            "filledQuantity",
            "price",
            "averagePrice",
            "leverage",
            "marginMode",
            "status",
            "fee",
            "createdAt",
          ],
          order: [["createdAt", "ASC"], ["id", "ASC"]],
          raw: true,
        });

        const orderIds = orders.map((order) => order.id);

        const fills = orderIds.length
          ? await TradingOrderFill.findAll({
              where: { accountId, orderId: orderIds },
              attributes: [
                "id",
                "orderId",
                "positionId",
                "symbol",
                "side",
                "quantity",
                "price",
                "fee",
                "realizedPnl",
                "createdAt",
              ],
              order: [["createdAt", "ASC"], ["id", "ASC"]],
              raw: true,
            })
          : [];

        const fees = fills.reduce(
          (sum, fill) => sum + Number(fill.fee || 0),
          0,
        );

        const realizedPnl = fills.reduce(
          (sum, fill) => sum + Number(fill.realizedPnl || 0),
          0,
        );

        const filledQuantity = fills.reduce(
          (sum, fill) => sum + Number(fill.quantity || 0),
          0,
        );

        const weightedFillValue = fills.reduce(
          (sum, fill) =>
            sum +
            Number(fill.quantity || 0) * Number(fill.price || 0),
          0,
        );

        return {
          tradeId: group.tradeId,
          symbol: orders[0]?.symbol ?? fills[0]?.symbol ?? null,
          status: orders.every((order) =>
            ["CANCELLED", "REJECTED", "EXPIRED"].includes(order.status),
          )
            ? "CANCELLED"
            : orders.every((order) => order.status === "FILLED")
              ? "FILLED"
              : "IN_PROGRESS",
          firstOrderAt: group.firstOrderAt,
          lastOrderAt: group.lastOrderAt,
          orders,
          fills,
          summary: {
            fillCount: fills.length,
            filledQuantity: Number(filledQuantity.toFixed(8)),
            averageFillPrice:
              filledQuantity > 0
                ? Number((weightedFillValue / filledQuantity).toFixed(8))
                : null,
            totalFees: Number(fees.toFixed(8)),
            realizedPnl: Number(realizedPnl.toFixed(8)),
            netRealizedPnl: Number((realizedPnl - fees).toFixed(8)),
          },
        };
      }),
    );

    // Grouped trade count is needed because one trade may have multiple orders.
    const allTradeIds = await TradingOrder.findAll({
      where: { accountId },
      attributes: ["tradeId"],
      group: ["tradeId"],
      raw: true,
    });

    const total = allTradeIds.length;
    const nextOffset = offset + trades.length;

    return res.status(200).json({
      success: true,
      trades,
      pagination: {
        limit,
        offset,
        total,
        hasMore: nextOffset < total,
        nextOffset: nextOffset < total ? nextOffset : null,
      },
    });
  } catch (error) {
    console.error("Get wallet trades error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch wallet trades",
    });
  }
};

const getWalletTradeDetails = async (req, res) => {
  try {
    const { accountId, tradeId } = req.params;

    const orders = await TradingOrder.findAll({
      where: { accountId, tradeId },
      include: [{ model: TradingOrderFill, as: "fills", required: false }],
      order: [["createdAt", "ASC"], ["id", "ASC"]],
    });

    if (!orders.length) {
      return res.status(404).json({
        success: false,
        message: "Trade not found",
      });
    }

    const orderIds = orders.map((order) => order.id);

    const transactions = await TradingTransaction.findAll({
      where: {
        accountId,
        referenceType: "ORDER",
        referenceId: orderIds,
      },
      order: [["createdAt", "ASC"], ["id", "ASC"]],
    });

    return res.status(200).json({
      success: true,
      trade: {
        tradeId,
        orders,
        transactions,
      },
    });
  } catch (error) {
    console.error("Get wallet trade details error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch trade details",
    });
  }
};

module.exports = {
  getWalletOverview,
  getWalletTransactions,
  getWalletTrades,
  getWalletTradeDetails,
};
