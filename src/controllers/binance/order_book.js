const BinanceService = require("../../services/binance/order_book_service"  );
  
  exports.getOrderBook = async (req, res) => {
    try {
      const { symbol } = req.params;
  
      const data =
        await BinanceService.getOrderBook(
          symbol.toUpperCase()
        );
  
      return res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  };