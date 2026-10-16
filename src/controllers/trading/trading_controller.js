const tradingEngine = require("../../services/trading/trading_engine.service");
const {
    updateTradeTpSl,
  } = require("../../services/trading/tp_sl_management.service");
  const TradingAccount = require("../../models/trading/trading_account_model");
const TradingPosition = require("../../models/trading/trading_position_model");
const {
  closeTrade,
} = require("../../services/trading/trade_close.service");

const {
  placeLimitOrder,
} = require("../../services/trading/limit_order/limit_order.service");
const {
  cancelLimitOrder,
} = require("../../services/trading/limit_order/cancel_limit_order.service");
const {
  modifyLimitOrder,
} = require("../../services/trading/limit_order/modify_limit_order.service");

const TradingOrder = require("../../models/trading/trading_order_model");

const TradingOrderFill = require("../../models/trading/trading_order_fill_model");

const placeMarketOrder = async (req, res) => {
  try {
    const result =
      await tradingEngine.placeMarketOrder({
        accountId: req.body.accountId,
        symbol: req.body.symbol,
        side: req.body.side,
        quantity: req.body.quantity,
        leverage: req.body.leverage,
        marginMode: req.body.marginMode,
        reduceOnly: req.body.reduceOnly,
        tradeId: req.body.tradeId,
        takeProfit: req.body.takeProfit,
        stopLoss: req.body.stopLoss,
      });

    return res.status(201).json(result);
  } catch (error) {
    console.error(
      "❌ Place market order error:",
      error.message
    ); 

    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};



const updateTpSl = async (req, res) => {
    try {
       console.log("🔥 TP/SL REQUEST:", {
      body: req.body,
      tradeId: req.params.tradeId,
    });
    
      const result = await updateTradeTpSl({
        accountId: req.body.accountId,
        tradeId: req.params.tradeId,
        takeProfit: req.body.takeProfit,
        stopLoss: req.body.stopLoss,
      });
  
      return res.status(200).json(result);
    } catch (error) {
      console.error(
        "❌ Update TP/SL error:",
        error.message
      );
  
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  };

  const getTradingAccount = async (req, res) => {
  try {
    const { accountId } = req.params;

    const account = await TradingAccount.findOne({
      where: {
        accountId,
      },
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

    return res.status(200).json({
      success: true,
      account,
    });
  } catch (error) {
    console.error(
      "❌ Get trading account error:",
      error.message
    );

    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

const getOpenPositions = async (req, res) => {
  try {
    const { accountId } = req.params;

    const positions = await TradingPosition.findAll({
      where: {
        accountId,
        status: "OPEN",
      },
      order: [["createdAt", "DESC"]],
    });

    return res.status(200).json({
      success: true,
      positions,
    });
  } catch (error) {
    console.error(
      "❌ Get open positions error:",
      error.message
    );

    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

const closePosition = async (req, res) => {
  try {
    const result = await closeTrade({
      accountId: req.body.accountId,
      symbol: req.body.symbol,
      tradeId: req.params.tradeId,
      quantity: req.body.quantity,
      side: req.body.side,
      orderType: "MARKET",
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error(
      "❌ Close position error:",
      error.message
    );

    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};


//==========================================>>>>>>>>>>>
//----------Limit Order Controller------------------->>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>


const placeLimitOrderController = async (req, res) => {
  try {
    const result =
      await placeLimitOrder({
        accountId: req.body.accountId,
        symbol: req.body.symbol,
        side: req.body.side,
        quantity: req.body.quantity,
        price: req.body.price,
        leverage: req.body.leverage,
        marginMode: req.body.marginMode,
        reduceOnly: req.body.reduceOnly,
        takeProfit: req.body.takeProfit,
        stopLoss: req.body.stopLoss,
      });

    return res.status(201).json(result);
  } catch (error) {
    console.error(
      "❌ Place limit order error:",
      error.message
    );

    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

const getOpenLimitOrders = async (req, res) => {
  try {
    const { accountId } = req.params;

    const orders = await TradingOrder.findAll({
      where: {
        accountId,
        orderType: "LIMIT",
        status: "OPEN",
      },
      order: [["createdAt", "DESC"]],
    });

    return res.status(200).json({
      success: true,
      orders,
    });
  } catch (error) {
    console.error(
      "❌ Get open limit orders error:",
      error.message
    );

    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

const cancelLimitOrderController = async (req, res) => {
  try {
    const result = await cancelLimitOrder({
      accountId: req.body.accountId,
      tradeId: req.params.tradeId,
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error("Cancel limit order error:", error.message);

    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};




const modifyLimitOrderController = async (req, res) => {
  try {
    const result = await modifyLimitOrder({
      accountId: req.body.accountId,
      tradeId: req.params.tradeId,
      price: req.body.price,
      quantity: req.body.quantity,
      takeProfit: req.body.takeProfit,
      stopLoss: req.body.stopLoss,
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error("Modify limit order error:", error.message);

    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

//--------------------------------------------------------------------histiry section



const getOrderHistory = async (req, res) => {
  try {
    const { accountId } = req.params;

    const {
      page = 1,
      limit = 20,
      symbol,
      side,
      orderType,
      status,
    } = req.query;

    if (!accountId) {
      return res.status(400).json({
        success: false,
        message: "Account ID is required",
      });
    }

    const pageNumber = Number(page);
    const pageSize = Number(limit);

    if (
      !Number.isInteger(pageNumber) ||
      pageNumber < 1 ||
      !Number.isInteger(pageSize) ||
      pageSize < 1 ||
      pageSize > 100
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid page or limit. Limit must be between 1 and 100.",
      });
    }

    const where = {
      accountId: String(accountId),
    };

    if (symbol) {
      where.symbol = String(symbol).toUpperCase();
    }

    if (side) {
      const normalizedSide = String(side).toUpperCase();

      if (!["BUY", "SELL"].includes(normalizedSide)) {
        return res.status(400).json({
          success: false,
          message: "Side must be BUY or SELL",
        });
      }

      where.side = normalizedSide;
    }

    if (orderType) {
      const normalizedType = String(orderType).toUpperCase();
      const allowedTypes = [
        "MARKET",
        "LIMIT",
        "STOP",
        "STOP_MARKET",
        "TAKE_PROFIT",
        "TAKE_PROFIT_MARKET",
      ];

      if (!allowedTypes.includes(normalizedType)) {
        return res.status(400).json({
          success: false,
          message: "Invalid order type",
        });
      }

      where.orderType = normalizedType;
    }

    if (status) {
      const normalizedStatus = String(status).toUpperCase();
      const allowedStatuses = [
        "NEW",
        "OPEN",
        "PARTIALLY_FILLED",
        "FILLED",
        "CANCELLED",
        "REJECTED",
        "EXPIRED",
      ];

      if (!allowedStatuses.includes(normalizedStatus)) {
        return res.status(400).json({
          success: false,
          message: "Invalid order status",
        });
      }

      where.status = normalizedStatus;
    } else {
      // Default history excludes currently active orders.
      where.status = [
        "FILLED",
        "CANCELLED",
        "REJECTED",
        "EXPIRED",
      ];
    }

    const { count, rows } = await TradingOrder.findAndCountAll({
      where,
      order: [["createdAt", "DESC"]],
      limit: pageSize,
      offset: (pageNumber - 1) * pageSize,
    });

    return res.status(200).json({
      success: true,
      orders: rows,
      pagination: {
        page: pageNumber,
        limit: pageSize,
        total: count,
        totalPages: Math.ceil(count / pageSize),
      },
    });
  } catch (error) {
    console.error("Get order history error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch order history",
    });
  }
};



const getTradingHistory = async (req, res) => {
  try {
    const { accountId } = req.params;

    const {
      page = 1,
      limit = 20,
      symbol,
      side,
    } = req.query;

    if (!accountId) {
      return res.status(400).json({
        success: false,
        message: "Account ID is required",
      });
    }

    const pageNumber = Number(page);
    const pageSize = Number(limit);

    if (
      !Number.isInteger(pageNumber) ||
      pageNumber < 1 ||
      !Number.isInteger(pageSize) ||
      pageSize < 1 ||
      pageSize > 100
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid page or limit. Limit must be between 1 and 100.",
      });
    }

    const where = {
      accountId: String(accountId),
    };

    if (symbol) {
      where.symbol = String(symbol).toUpperCase();
    }

    if (side) {
      const normalizedSide = String(side).toUpperCase();

      if (!["BUY", "SELL"].includes(normalizedSide)) {
        return res.status(400).json({
          success: false,
          message: "Side must be BUY or SELL",
        });
      }

      where.side = normalizedSide;
    }

    const { count, rows } =
      await TradingOrderFill.findAndCountAll({
        where,
        order: [["createdAt", "DESC"]],
        limit: pageSize,
        offset: (pageNumber - 1) * pageSize,
      });

    return res.status(200).json({
      success: true,
      trades: rows,
      pagination: {
        page: pageNumber,
        limit: pageSize,
        total: count,
        totalPages: Math.ceil(count / pageSize),
      },
    });
  } catch (error) {
    console.error("Get trading history error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch trading history",
    });
  }
};




const getPositionHistory = async (req, res) => {
  try {
    const { accountId } = req.params;

    const {
      page = 1,
      limit = 20,
      symbol,
      side,
    } = req.query;

    if (!accountId) {
      return res.status(400).json({
        success: false,
        message: "Account ID is required",
      });
    }

    const pageNumber = Number(page);
    const pageSize = Number(limit);

    if (
      !Number.isInteger(pageNumber) ||
      pageNumber < 1 ||
      !Number.isInteger(pageSize) ||
      pageSize < 1 ||
      pageSize > 100
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid page or limit. Limit must be between 1 and 100.",
      });
    }

    // Only closed positions
    const where = {
      accountId: String(accountId),
      status: "CLOSED",
    };

    // Optional symbol filter
    if (symbol) {
      where.symbol = String(symbol).trim().toUpperCase();
    }

    // Optional position-side filter
    if (side) {
      const normalizedSide = String(side).trim().toUpperCase();

      if (!["LONG", "SHORT"].includes(normalizedSide)) {
        return res.status(400).json({
          success: false,
          message: "Side must be LONG or SHORT",
        });
      }

      where.side = normalizedSide;
    }

    // Fetch paginated closed positions
    const { count, rows } = await TradingPosition.findAndCountAll({
      where,
      order: [
        ["updatedAt", "DESC"],
        ["id", "DESC"],
      ],
      limit: pageSize,
      offset: (pageNumber - 1) * pageSize,
    });

    const positionIds = rows.map((position) => position.id);

    // Fetch closing fills for the current page
    const closingFills = positionIds.length
      ? await TradingOrderFill.findAll({
          where: {
            accountId: String(accountId),
            positionId: positionIds,
          },
          include: [
            {
              model: TradingOrder,
              as: "order",
              required: true,
              attributes: [],
              where: {
                reduceOnly: true,
                status: "FILLED",
              },
            },
          ],
          order: [
            ["createdAt", "ASC"],
            ["id", "ASC"],
          ],
        })
      : [];

    // Group closing fills by position ID
    const fillsByPosition = new Map();

    for (const fill of closingFills) {
      const key = String(fill.positionId);

      if (!fillsByPosition.has(key)) {
        fillsByPosition.set(key, []);
      }

      fillsByPosition.get(key).push(fill);
    }

    // Add exit price and closing timestamp
    const positions = rows.map((position) => {
      const positionData = position.toJSON();

      const fills =
        fillsByPosition.get(String(position.id)) || [];

      const totalClosedQuantity = fills.reduce(
        (sum, fill) => sum + Number(fill.quantity),
        0
      );

      const totalClosingValue = fills.reduce(
        (sum, fill) =>
          sum + Number(fill.quantity) * Number(fill.price),
        0
      );

      const lastClosingFill =
        fills.length > 0 ? fills[fills.length - 1] : null;

      const exitPrice =
        totalClosedQuantity > 0
          ? Number(
              (totalClosingValue / totalClosedQuantity).toFixed(8)
            )
          : null;

      return {
        ...positionData,
        exitPrice,
        closedAt: lastClosingFill
          ? lastClosingFill.createdAt
          : null,
      };
    });

    return res.status(200).json({
      success: true,
      positions,
      pagination: {
        page: pageNumber,
        limit: pageSize,
        total: count,
        totalPages: Math.ceil(count / pageSize),
      },
    });
  } catch (error) {
    console.error("Get position history error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch position history",
    });
  }
};




module.exports = {
  placeMarketOrder,
  updateTpSl,
  getTradingAccount,
  getOpenPositions,
  closePosition,
  placeLimitOrderController,
  getOpenLimitOrders,
  cancelLimitOrderController,
  modifyLimitOrderController,
  getOrderHistory,
  getTradingHistory,
  getPositionHistory,
};




