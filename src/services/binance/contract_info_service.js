const axios = require("axios");

const getContractInfo = async (symbol) => {

  const [exchangeRes, premiumRes] =
      await Promise.all([
        axios.get(
          "https://fapi.binance.com/fapi/v1/exchangeInfo"
        ),
        axios.get(
          "https://fapi.binance.com/fapi/v1/premiumIndex"
        ),
      ]);

  const contract =
      exchangeRes.data.symbols.find(
        (s) =>
            s.symbol === symbol,
      );

  if (!contract) {
    throw new Error(
      "Symbol not found",
    );
  }

  const premium =
      premiumRes.data.find(
        (p) =>
            p.symbol === symbol,
      );

  const priceFilter =
      contract.filters.find(
        (f) =>
            f.filterType ===
            "PRICE_FILTER",
      );

  const lotSize =
      contract.filters.find(
        (f) =>
            f.filterType ===
            "LOT_SIZE",
      );

  const marketLotSize =
      contract.filters.find(
        (f) =>
            f.filterType ===
            "MARKET_LOT_SIZE",
      );

  return {

    symbol,

    settlementCrypto:
        contract.marginAsset,

    tickSize:
        priceFilter?.tickSize,

    leverage:
        "1 ~ 125",

    fundingFeeSettled:
        "Every 8hr",

    fundingRate:
        premium?.lastFundingRate,

    nextFundingTime:
        premium?.nextFundingTime,

    maxLimitOrderSize:
        lotSize?.maxQty,

    maxMarketOrderSize:
        marketLotSize?.maxQty,

    baseAsset:
        contract.baseAsset,

    quoteAsset:
        contract.quoteAsset,

    contractType:
        contract.contractType,
  };
};

module.exports = {
  getContractInfo,
};