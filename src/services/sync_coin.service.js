const Coin = require("../models/coin_model");
const { fetchUSDTTradingPairs } = require("./binance/binance.service");
const { getMarkets } = require("./coingecko.service");

const syncCoins = async () => {
  let inserted = 0;
  let skipped = 0;
  let notFound = 0;

  // 1. Binance Futures pairs
  const pairs = await fetchUSDTTradingPairs();

  // 2. CoinGecko se saare pages load karo
 
let allCoins = [];
let page = 1;

while (true) {
  try {
    const coins = await getMarkets("usd", 250, page);

    if (!coins || coins.length === 0) {
      break;
    }

    allCoins.push(...coins);

    console.log(`✅ Page ${page} loaded (${coins.length} coins)`);

    await new Promise(resolve => setTimeout(resolve, 1000));

    page++;
  } catch (err) {
    console.error(`❌ Failed to load page ${page}:`, err.message);
    break;
  }
}

// Load all existing symbols from DB (1 query only)
const existingCoins = await Coin.findAll({
    attributes: ["symbol"],
  });
  
  const existingSet = new Set(
    existingCoins.map(c => c.symbol.toUpperCase())
  );
  
  // Create CoinGecko symbol map
  const coinMap = new Map();
  
  for (const coin of allCoins) {
    const key = coin.symbol.toUpperCase();
  
    if (!coinMap.has(key)) {
      coinMap.set(key, coin);
    }
  }


  // 3. Har Binance coin check karo
  for (const pair of pairs) {
    const symbol = pair.baseAsset.toUpperCase();
    const lookupSymbol = symbol.replace(/^1000/, "").toUpperCase();

    if (existingSet.has(symbol)) {
        skipped++;
        continue;
      }

      const cgCoin = coinMap.get(lookupSymbol);

      if (!cgCoin) {
        notFound++;
        console.log(`❌ CoinGecko match not found : ${symbol}`);
        continue;
      }

    await Coin.create({
      symbol,
      name: cgCoin.name,
      image: cgCoin.image,
      coingeckoId: cgCoin.id,
    });

    existingSet.add(symbol);

    inserted++;

    console.log(`✅ Added : ${symbol}`);
  }

  return {
    inserted,
    skipped,
    notFound,
    total: pairs.length,
  };
};

module.exports = {
  syncCoins,
};