const axios = require("axios");
const config = require("../config/coingecko");

const formatNumber = (num) => {
  if (!num) return "0";
  if (num >= 1e12) return (num / 1e12).toFixed(2) + "T";
  if (num >= 1e9) return (num / 1e9).toFixed(2) + "B";
  if (num >= 1e6) return (num / 1e6).toFixed(2) + "M";
  if (num >= 1e3) return (num / 1e3).toFixed(2) + "K";
  return num.toString();
};

const formatCoins = (coins) => {
  return coins.map(coin => ({
    id: coin.id,
    name: coin.name,
    symbol: coin.symbol.toUpperCase(),
    image: coin.image,
    currentPrice: Number(coin.current_price.toFixed(2)),
    priceChangePercentage24h: coin.price_change_percentage_24h_in_currency,
    marketCap: formatNumber(coin.market_cap),
    volume: formatNumber(coin.total_volume),
    marketCapRank: coin.market_cap_rank,
    sparkline: coin.sparkline_in_7d?.price.slice(-30) || [],
  }));
};

const getMarkets = async (vsCurrency = "usd", perPage = 20, page = 1) => {
  try{
  const { data } = await axios.get(`${config.baseUrl}/coins/markets`, {
    params: {
      vs_currency: vsCurrency,
      per_page: perPage,
      page,
      sparkline: true,
      price_change_percentage: "1h,24h,7d"
    },
    timeout: 5000
  });


    return formatCoins(data);
  } catch (error) {
    console.error("Error fetching markets:", error.message);
    throw new Error("Failed to fetch markets from CoinGecko");
  }
};

const getTrending = async () => {
  try{
  const { data } = await axios.get(`${config.baseUrl}/search/trending`);
  const ids = data.coins.map((item) => item.item.id).join(",");

  if(!ids) return [];

  const { data: marketData } = await axios.get(
    `${config.baseUrl}/coins/markets`,
    {
      params: {
        vs_currency: "usd",
        ids: ids,
        sparkline: true,
        price_change_percentage: "24h",
      },
    }
  );

  // 👉 STEP 3: same formatter use karo
  return formatCoins(marketData);

} catch (error) {
  console.error("Error fetching trending:", error.message);
  throw new Error("Failed to fetch trending coins");
}
};

module.exports = { getMarkets, getTrending };
