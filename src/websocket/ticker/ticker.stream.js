const tickerRequirements = new Map();

const createTickerStream = ({
  ensureSymbol,
  normalizeSymbol,
  assignSymbolToConnection,
  removeSymbolFromConnection,
  marketData,
  marketEvents,
  LOG_CONNECTION_EVENTS,
  SYMBOL_RELEASE_GRACE_MS,
  setManuallyDisconnected,
}) => {

  const update24hrTicker = (data) => {
    if (!data?.s) {
      return;
    }

    const symbol = ensureSymbol(data.s);

    if (!symbol) {
      return;
    }

    const current = marketData.get(symbol);

    const payload = {
      symbol,

      lastPrice:
        data.c != null
          ? Number(data.c)
          : current.lastPrice,

      priceChange:
        data.p != null
          ? Number(data.p)
          : current.priceChange,

      priceChangePercent:
        data.P != null
          ? Number(data.P)
          : current.priceChangePercent,

      weightedAveragePrice:
        data.w != null
          ? Number(data.w)
          : current.weightedAveragePrice,

      openPrice:
        data.o != null
          ? Number(data.o)
          : current.openPrice,

      highPrice:
        data.h != null
          ? Number(data.h)
          : current.highPrice,

      lowPrice:
        data.l != null
          ? Number(data.l)
          : current.lowPrice,

      volume:
        data.v != null
          ? Number(data.v)
          : current.volume,

      quoteVolume:
        data.q != null
          ? Number(data.q)
          : current.quoteVolume,

      tradeCount:
        data.n != null
          ? Number(data.n)
          : current.tradeCount,

      eventTime:
        data.E != null
          ? Number(data.E)
          : current.eventTime,

      transactionTime:
        data.T != null
          ? Number(data.T)
          : current.transactionTime,

      updatedAt: Date.now(),
    };

    marketData.set(symbol, {
      ...current,
      ...payload,
    });

    marketEvents.emit("ticker", payload);
  };


  const requireTicker = (symbol) => {
    const normalizedSymbol =
      ensureSymbol(symbol);

    if (!normalizedSymbol) {
      return false;
    }

    setManuallyDisconnected(false);

    let requirement =
      tickerRequirements.get(
        normalizedSymbol
      );

    if (!requirement) {
      requirement = {
        count: 0,
        releaseTimer: null,
      };

      tickerRequirements.set(
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

    requirement.count++;

    if (requirement.count === 1) {
      assignSymbolToConnection(
        normalizedSymbol,
        "ticker"
      );

      if (LOG_CONNECTION_EVENTS) {
        console.log(
          `📊 Ticker required: ${normalizedSymbol}`
        );
      }
    }

    return true;
  };


  const releaseTicker = (symbol) => {
    const normalizedSymbol =
      normalizeSymbol(symbol);

    if (!normalizedSymbol) {
      return false;
    }

    const requirement =
      tickerRequirements.get(
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
      `📊 TICKER RELEASE CHECK | ${normalizedSymbol} | total=${requirement.count}`
    );

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
          tickerRequirements.get(
            normalizedSymbol
          );

        if (!current) {
          return;
        }

        if (current.count > 0) {
          current.releaseTimer = null;
          return;
        }

        removeSymbolFromConnection(
          normalizedSymbol,
          "ticker"
        );

        tickerRequirements.delete(
          normalizedSymbol
        );

        console.log(
          `📴 Ticker released completely: ${normalizedSymbol}`
        );
      }, SYMBOL_RELEASE_GRACE_MS);

    return true;
  };


  return {
    update24hrTicker,
    requireTicker,
    releaseTicker,
  };
};


module.exports = {
  tickerRequirements,
  createTickerStream,
};