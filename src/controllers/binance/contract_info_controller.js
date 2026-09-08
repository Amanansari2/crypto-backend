const contractInfoService =
require(
  "../../services/binance/contract_info_service",
);

const getContractInfo =
async (req, res, next) => {

  try {

    const symbol =
      req.params.symbol
        .toUpperCase();

    const data =
      await contractInfoService.getContractInfo(
        symbol,
      );

    return res.json({
      success: true,
      data,
    });

  } catch (e) {
    next(e);
  }
};

module.exports = {
  getContractInfo,
};