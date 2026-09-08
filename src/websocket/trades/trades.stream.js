const tradeRequirements = new Map();

const createTradeStream = ({
  ensureSymbol,
  normalizeSymbol,
  assignSymbolToConnection,
  removeSymbolFromConnection,
  marketEvents,
  LOG_CONNECTION_EVENTS,
  SYMBOL_RELEASE_GRACE_MS,
  setManuallyDisconnected,
}) => {

  // ==================================================
  // UPDATE TRADE
  // ==================================================

  const updateTrade = (data) => {
    if (!data?.s) {
      return;
    }

    const symbol =
      ensureSymbol(data.s);

    if (!symbol) {
      return;
    }

    const payload = {
      symbol,

      tradeId:
        data.a != null
          ? Number(data.a)
          : null,

      price:
        data.p != null
          ? Number(data.p)
          : null,

      quantity:
        data.q != null
          ? Number(data.q)
          : null,

      eventTime:
        data.E != null
          ? Number(data.E)
          : null,

      transactionTime:
        data.T != null
          ? Number(data.T)
          : null,

      isBuyerMaker:
        data.m != null
          ? Boolean(data.m)
          : null,

      updatedAt: Date.now(),
    };

    marketEvents.emit(
      "trade",
      payload
    );
  };


  // ==================================================
  // REQUIRE TRADES
  // ==================================================

  const requireTrades = (symbol) => {
    const normalizedSymbol =
      ensureSymbol(symbol);

    if (!normalizedSymbol) {
      return false;
    }

    setManuallyDisconnected(false);

    let requirement =
      tradeRequirements.get(
        normalizedSymbol
      );

    if (!requirement) {
      requirement = {
        count: 0,
        releaseTimer: null,
      };

      tradeRequirements.set(
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
        "trade"
      );

      if (LOG_CONNECTION_EVENTS) {
        console.log(
          `📈 Trades required: ${normalizedSymbol}`
        );
      }
    }

    return true;
  };


  // ==================================================
  // RELEASE TRADES
  // ==================================================

  const releaseTrades = (symbol) => {
    const normalizedSymbol =
      normalizeSymbol(symbol);

    if (!normalizedSymbol) {
      return false;
    }

    const requirement =
      tradeRequirements.get(
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
      `📊 TRADES RELEASE CHECK | ${normalizedSymbol} | total=${requirement.count}`
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
          tradeRequirements.get(
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
          "trade"
        );

        tradeRequirements.delete(
          normalizedSymbol
        );

        console.log(
          `📴 Trades released completely: ${normalizedSymbol}`
        );

      }, SYMBOL_RELEASE_GRACE_MS);

    return true;
  };


  return {
    updateTrade,
    requireTrades,
    releaseTrades,
  };
};


module.exports = {
  tradeRequirements,
  createTradeStream,
};