const klineRequirements = new Map();

const createKlineStream = ({
  ensureSymbol,
  normalizeSymbol,
  assignSymbolToConnection,
  removeSymbolFromConnection,
  marketEvents,
  LOG_CONNECTION_EVENTS,
  SYMBOL_RELEASE_GRACE_MS,
  setManuallyDisconnected,
}) => {

  // --------------------------------------------------
  // UPDATE KLINE
  // --------------------------------------------------

  const updateKline = (data) => {
    if (!data?.s || !data?.k) {
      return;
    }

    const symbol = ensureSymbol(data.s);

    if (!symbol) {
      return;
    }

    const k = data.k;

    const payload = {
      symbol,

      interval: k.i != null
        ? String(k.i)
        : null,

      time: k.t != null
        ? Number(k.t)
        : null,

      closeTime: k.T != null
        ? Number(k.T)
        : null,  

      open: k.o != null
        ? Number(k.o)
        : null,

      high: k.h != null
        ? Number(k.h)
        : null,

      low: k.l != null
        ? Number(k.l)
        : null,

      close: k.c != null
        ? Number(k.c)
        : null,

      volume: k.v != null
        ? Number(k.v)
        : null,

      quoteVolume: k.q != null
        ? Number(k.q)
        : null,

      tradeCount: k.n != null
        ? Number(k.n)
        : null,

      isClosed: k.x != null
        ? Boolean(k.x)
        : false,

      eventTime: data.E != null
        ? Number(data.E)
        : null,

      transactionTime: data.T != null
        ? Number(data.T)
        : null,

      updatedAt: Date.now(),
    };

    marketEvents.emit("kline", payload);
  };


  // --------------------------------------------------
  // REQUIRE KLINES
  // --------------------------------------------------

  const requireKlines = (symbol, interval) => {
    const normalizedSymbol =
      ensureSymbol(symbol);

    if (!normalizedSymbol) {
      return false;
    }

    const normalizedInterval =
      String(interval || "")
        .trim();

    if (!normalizedInterval) {
      return false;
    }

    setManuallyDisconnected(false);

    /*
      Structure:

      BTCUSDT
        ├── 1m  -> count
        ├── 5m  -> count
        └── 15m -> count

      ETHUSDT
        └── 10m -> count
    */

    let symbolRequirements =
      klineRequirements.get(normalizedSymbol);

    if (!symbolRequirements) {
      symbolRequirements = new Map();

      klineRequirements.set(
        normalizedSymbol,
        symbolRequirements
      );
    }

    let requirement =
      symbolRequirements.get(normalizedInterval);

    if (!requirement) {
      requirement = {
        count: 0,
        releaseTimer: null,
      };

      symbolRequirements.set(
        normalizedInterval,
        requirement
      );
    }

    // Someone requested the same stream again.
    // Cancel any pending release.
    if (requirement.releaseTimer) {
      clearTimeout(
        requirement.releaseTimer
      );

      requirement.releaseTimer = null;
    }

    requirement.count++;

    /*
      Only the FIRST client for this exact
      symbol + interval creates the Binance stream.

      Example:

      Client A -> BTCUSDT 5m
      Client B -> BTCUSDT 5m

      Binance receives only:

      BTCUSDT@kline_5m
    */

    if (requirement.count === 1) {
      assignSymbolToConnection(
        normalizedSymbol,
        "kline",
        normalizedInterval
      );

      if (LOG_CONNECTION_EVENTS) {
        console.log(
          `🕯️ Klines required: ${normalizedSymbol} ${normalizedInterval}`
        );
      }
    }

    return true;
  };


  // --------------------------------------------------
  // RELEASE KLINES
  // --------------------------------------------------

  const releaseKlines = (symbol, interval) => {
    const normalizedSymbol =
      normalizeSymbol(symbol);

    if (!normalizedSymbol) {
      return false;
    }

    const normalizedInterval =
      String(interval || "")
        .trim();

    if (!normalizedInterval) {
      return false;
    }

    const symbolRequirements =
      klineRequirements.get(
        normalizedSymbol
      );

    if (!symbolRequirements) {
      return false;
    }

    const requirement =
      symbolRequirements.get(
        normalizedInterval
      );

    if (!requirement) {
      return false;
    }

    if (requirement.count <= 0) {
      return false;
    }

    requirement.count--;

    console.log(
      `📊 KLINE RELEASE CHECK | ${normalizedSymbol} ${normalizedInterval} | total=${requirement.count}`
    );

    /*
      Other clients are still using
      the same symbol + interval.

      Keep Binance stream alive.
    */

    if (requirement.count > 0) {
      return true;
    }

    /*
      Nobody currently needs this stream.

      Use the same grace-period pattern
      as the existing trade stream.
    */

    if (requirement.releaseTimer) {
      clearTimeout(
        requirement.releaseTimer
      );
    }

    requirement.releaseTimer =
      setTimeout(() => {

        const currentSymbolRequirements =
          klineRequirements.get(
            normalizedSymbol
          );

        if (!currentSymbolRequirements) {
          return;
        }

        const current =
          currentSymbolRequirements.get(
            normalizedInterval
          );

        if (!current) {
          return;
        }

        /*
          A new client may have requested
          the stream during the grace period.
        */

        if (current.count > 0) {
          current.releaseTimer = null;
          return;
        }

        /*
          Remove ONLY this exact:

          symbol + interval

          stream.
        */

        removeSymbolFromConnection(
          normalizedSymbol,
          "kline",
          normalizedInterval
        );

        currentSymbolRequirements.delete(
          normalizedInterval
        );

        /*
          Remove symbol completely only when
          it has no kline intervals remaining.
        */

        if (
          currentSymbolRequirements.size === 0
        ) {
          klineRequirements.delete(
            normalizedSymbol
          );
        }

        console.log(
          `📴 Klines released completely: ${normalizedSymbol} ${normalizedInterval}`
        );

      }, SYMBOL_RELEASE_GRACE_MS);

    return true;
  };


  return {
    updateKline,
    requireKlines,
    releaseKlines,
  };
};


module.exports = {
  klineRequirements,
  createKlineStream,
};