// ==================================================
// SHARED MARKET DATA STREAM
// ==================================================

const sharedDataRequirements = new Map();
const sharedMarketData = new Map();

const createSharedMarketDataStream = ({
  ensureSymbol,
  normalizeSymbol,
  marketData,
  marketEvents,
  SYMBOL_RELEASE_GRACE_MS,
  setManuallyDisconnected,
  requireBookTicker,
  releaseBookTicker,
  requireMarkPrice,
  requireTicker,
releaseTicker,
releaseMarkPrice,
}) => {

  // ==================================================
  // REQUIRE SHARED DATA
  // ==================================================

  const requireSharedData = (symbol) => {
    const normalizedSymbol =
      ensureSymbol(symbol);

    if (!normalizedSymbol) {
      return false;
    }

    setManuallyDisconnected(false);

    let requirement =
      sharedDataRequirements.get(
        normalizedSymbol
      );

    if (!requirement) {
      requirement = {
        count: 0,
        releaseTimer: null,
      };

      sharedDataRequirements.set(
        normalizedSymbol,
        requirement
      );
    }

    if (requirement.releaseTimer) {
      clearTimeout(
        requirement.releaseTimer
      );

      requirement.releaseTimer = null;
    }

    if (requirement.count === 0) {
        requireBookTicker(normalizedSymbol);
        requireMarkPrice(normalizedSymbol);
        requireTicker(normalizedSymbol);
      }

    requirement.count++;

    return true;
  };

  // ==================================================
  // RELEASE SHARED DATA
  // ==================================================

  const releaseSharedData = (symbol) => {
    const normalizedSymbol =
      normalizeSymbol(symbol);

    if (!normalizedSymbol) {
      return false;
    }

    const requirement =
      sharedDataRequirements.get(
        normalizedSymbol
      );

    if (!requirement) {
      return false;
    }

    if (requirement.count <= 0) {
      return false;
    }

    requirement.count--;

    console.log(
      `📊 SHARED DATA RELEASE CHECK | ${normalizedSymbol} | total=${requirement.count}`
    );

    if (requirement.count === 0) {
        releaseBookTicker(normalizedSymbol);
        releaseMarkPrice(normalizedSymbol);
        releaseTicker(normalizedSymbol);
      }
      

    if (requirement.count > 0) {
      return true;
    }

    if (requirement.releaseTimer) {
      clearTimeout(
        requirement.releaseTimer
      );
    }

    requirement.releaseTimer =
      setTimeout(() => {
        const current =
          sharedDataRequirements.get(
            normalizedSymbol
          );

        if (!current) {
          return;
        }

        if (current.count > 0) {
          current.releaseTimer = null;
          return;
        }

        sharedDataRequirements.delete(
          normalizedSymbol
        );

        console.log(
          `📴 Shared market data released completely: ${normalizedSymbol}`
        );
      }, SYMBOL_RELEASE_GRACE_MS);

    return true;
  };


   // ==================================================
  // CREATE SHARED MARKET DATA PAYLOAD
  // ==================================================

  const createSharedMarketDataPayload = (symbol) => {

    const normalizedSymbol =
      normalizeSymbol(symbol);

    if (!normalizedSymbol) {
      return null;
    }

    const current =
      sharedMarketData.get(normalizedSymbol) || 
      marketData.get(normalizedSymbol);

    if (!current) {
      return null;
    }

    return {
      symbol: normalizedSymbol,

      // ----------------------------------------------
      // PRICE
      // ----------------------------------------------

      lastPrice:
        current.lastPrice ?? null,

      priceChange:
        current.priceChange ?? null,

      priceChangePercent:
        current.priceChangePercent ?? null,

      weightedAveragePrice:
        current.weightedAveragePrice ?? null,

      // ----------------------------------------------
      // 24H PRICE RANGE
      // ----------------------------------------------

      openPrice:
        current.openPrice ?? null,

      highPrice:
        current.highPrice ?? null,

      lowPrice:
        current.lowPrice ?? null,

      // ----------------------------------------------
      // VOLUME
      // ----------------------------------------------

      volume:
        current.volume ?? null,

      quoteVolume:
        current.quoteVolume ?? null,

      tradeCount:
        current.tradeCount ?? null,

      // ----------------------------------------------
      // BOOK TICKER
      // ----------------------------------------------

      bidPrice:
        current.bidPrice ?? null,

      bidQuantity:
        current.bidQuantity ?? null,

      askPrice:
        current.askPrice ?? null,

      askQuantity:
        current.askQuantity ?? null,

      // ----------------------------------------------
      // MARK PRICE
      // ----------------------------------------------

      markPrice:
        current.markPrice ?? null,

      // ----------------------------------------------
      // TIME
      // ----------------------------------------------

      eventTime:
        current.eventTime ?? null,

      transactionTime:
        current.transactionTime ?? null,

      updatedAt:
        current.updatedAt ?? null,
    };
  };


  // ==================================================
// LISTEN BOOK TICKER
// ==================================================

marketEvents.on("bookTicker", (data) => {

    if (!data?.symbol) {
      return;
    }
  
    const symbol =
      normalizeSymbol(data.symbol);
  
    if (!symbol) {
      return;
    }
  
    const requirement =
      sharedDataRequirements.get(symbol);
  
    if (!requirement || requirement.count <= 0) {
      return;
    }

    const current =
    sharedMarketData.get(symbol) ||
    marketData.get(symbol) ||
    {};

  sharedMarketData.set(symbol, {
    ...current,
    bidPrice: data.bidPrice ?? current.bidPrice ?? null,
    bidQuantity: data.bidQuantity ?? current.bidQuantity ?? null,
    askPrice: data.askPrice ?? current.askPrice ?? null,
    askQuantity: data.askQuantity ?? current.askQuantity ?? null,
    eventTime: data.eventTime ?? current.eventTime ?? null,
    transactionTime:
      data.transactionTime ??
      current.transactionTime ??
      null,
    updatedAt:
      data.updatedAt ??
      current.updatedAt ??
      null,
  });
  
    emitSharedMarketData(symbol);
  });

    // ==================================================
// LISTEN MARK PRICE
// ==================================================

marketEvents.on("markPrice", (data) => {
    if (!data?.symbol) return;
  
    const symbol = normalizeSymbol(data.symbol);
    if (!symbol) return;
  
    const requirement = sharedDataRequirements.get(symbol);
    if (!requirement || requirement.count <= 0) return;

    const current =
    sharedMarketData.get(symbol) ||
    marketData.get(symbol) ||
    {};

  sharedMarketData.set(symbol, {
    ...current,
    markPrice:
      data.markPrice ??
      current.markPrice ??
      null,
    indexPrice:
      data.indexPrice ??
      current.indexPrice ??
      null,
    fundingRate:
      data.fundingRate ??
      current.fundingRate ??
      null,
    eventTime:
      data.eventTime ??
      current.eventTime ??
      null,
    transactionTime:
      data.transactionTime ??
      current.transactionTime ??
      null,
    updatedAt:
      data.updatedAt ??
      current.updatedAt ??
      null,
  });
  
    emitSharedMarketData(symbol);
  });


  // ==================================================
// LISTEN 24H TICKER
// ==================================================

marketEvents.on("ticker", (data) => {
  if (!data?.symbol) {
    return;
  }

  const symbol = normalizeSymbol(data.symbol);

  if (!symbol) {
    return;
  }

  const requirement =
    sharedDataRequirements.get(symbol);

  if (!requirement || requirement.count <= 0) {
    return;
  }

  const current =
    sharedMarketData.get(symbol) ||
    marketData.get(symbol) ||
    {};

  sharedMarketData.set(symbol, {
    ...current,

    lastPrice:
      data.lastPrice ??
      current.lastPrice ??
      null,

    priceChange:
      data.priceChange ??
      current.priceChange ??
      null,

    priceChangePercent:
      data.priceChangePercent ??
      current.priceChangePercent ??
      null,

    weightedAveragePrice:
      data.weightedAveragePrice ??
      current.weightedAveragePrice ??
      null,

    openPrice:
      data.openPrice ??
      current.openPrice ??
      null,

    highPrice:
      data.highPrice ??
      current.highPrice ??
      null,

    lowPrice:
      data.lowPrice ??
      current.lowPrice ??
      null,

    volume:
      data.volume ??
      current.volume ??
      null,

    quoteVolume:
      data.quoteVolume ??
      current.quoteVolume ??
      null,

    tradeCount:
      data.tradeCount ??
      current.tradeCount ??
      null,

    eventTime:
      data.eventTime ??
      current.eventTime ??
      null,

    transactionTime:
      data.transactionTime ??
      current.transactionTime ??
      null,

    updatedAt:
      data.updatedAt ??
      current.updatedAt ??
      null,
  });

  emitSharedMarketData(symbol);
});

  // ==================================================
// EMIT SHARED MARKET DATA
// ==================================================

const emitSharedMarketData = (symbol) => {

    const payload =
      createSharedMarketDataPayload(symbol);
  
    if (!payload) {
      return false;
    }
  
    marketEvents.emit(
      "sharedMarketData",
      payload
    );
  
    return true;
  };



  // ==================================================
  // GET SHARED DATA
  // ==================================================

  const getSharedMarketData = (symbol) => {
    const normalizedSymbol =
      normalizeSymbol(symbol);

    if (!normalizedSymbol) {
      return null;
    }

    return (
      sharedMarketData.get(normalizedSymbol) || 
      marketData.get(normalizedSymbol) || null
    );
  };

  return {
    requireSharedData,
    releaseSharedData,
    getSharedMarketData,
    createSharedMarketDataPayload,
    emitSharedMarketData
  };
};

module.exports = {
  sharedDataRequirements,
  createSharedMarketDataStream,
};