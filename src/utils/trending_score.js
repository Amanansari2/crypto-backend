const STABLE_COINS = new Set([
    "USDT",
    "USDC",
    "BUSD",
    "FDUSD",
    "DAI",
    "TUSD",
    "USDP",
  ]);
  
  const WRAPPED_COINS = new Set([
    "WBTC",
    "WETH",
  ]);
  
  function calculateTrendScore(coin) {
    const priceMomentum = Math.abs(
      coin.priceChangePercentage24h
    );
  
    const volumeScore = Math.log10(
      coin.quoteVolumeRaw + 1
    );
  
    const liquidityScore = Math.log10(
      coin.weightedAvgPrice + 1
    );
  
    return (
      priceMomentum * 0.60 +
      volumeScore * 0.30 +
      liquidityScore * 0.10
    );
  }
  
  function getTrendingCoins(coins) {
    return coins
      .filter(
        (coin) =>
          !STABLE_COINS.has(coin.symbol) &&
          !WRAPPED_COINS.has(coin.symbol)
      )
      .map((coin) => ({
        ...coin,
        trendScore: calculateTrendScore(coin),
      }))
      .sort((a, b) => b.trendScore - a.trendScore)
      .slice(0, 20)
      .map(({ trendScore, ...coin }) => coin);
  }
  
  module.exports = {
    getTrendingCoins,
  };