const tradingEngine = require("../../services/trading/trading_engine.service");
const {
    updateTradeTpSl,
  } = require("../../services/trading/tp_sl_management.service");
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


module.exports = {
  placeMarketOrder,
  updateTpSl
};




