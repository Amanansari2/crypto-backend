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
};




