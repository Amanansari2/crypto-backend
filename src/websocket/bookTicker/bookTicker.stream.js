const bookTickerRequirements = new Map();

const createBookTickerStream = ({
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

  // ==================================================
  // UPDATE BOOK TICKER
  // ==================================================

  const updateBookTicker = (data) => {
    if (!data?.s) {
      return;
    }

    const symbol =
      ensureSymbol(data.s);

    if (!symbol) {
      return;
    }

    const current =
      marketData.get(symbol);

    marketData.set(symbol, {
      ...current,

      bidPrice:
        data.b != null
          ? Number(data.b)
          : current.bidPrice,

      bidQuantity:
        data.B != null
          ? Number(data.B)
          : current.bidQuantity,

      askPrice:
        data.a != null
          ? Number(data.a)
          : current.askPrice,

      askQuantity:
        data.A != null
          ? Number(data.A)
          : current.askQuantity,

      eventTime:
        data.E != null
          ? Number(data.E)
          : current.eventTime,

      transactionTime:
        data.T != null
          ? Number(data.T)
          : current.transactionTime,

      updatedAt: Date.now(),
    });

    marketEvents.emit("bookTicker", {
      symbol,
      bidPrice:
        marketData.get(symbol).bidPrice,
      bidQuantity:
        marketData.get(symbol).bidQuantity,
      askPrice:
        marketData.get(symbol).askPrice,
      askQuantity:
        marketData.get(symbol).askQuantity,
      eventTime:
        marketData.get(symbol).eventTime,
      transactionTime:
        marketData.get(symbol).transactionTime,
      updatedAt:
        marketData.get(symbol).updatedAt,
    });
  };


  // ==================================================
  // REQUIRE BOOK TICKER
  // ==================================================

  const requireBookTicker = (symbol) => {
    const normalizedSymbol =
      ensureSymbol(symbol);

    if (!normalizedSymbol) {
      return false;
    }

    setManuallyDisconnected(false);

    let requirement =
      bookTickerRequirements.get(
        normalizedSymbol
      );

    if (!requirement) {
      requirement = {
        count: 0,
        releaseTimer: null,
      };

      bookTickerRequirements.set(
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
        "bookTicker"
      );

      if (LOG_CONNECTION_EVENTS) {
        console.log(
          `📈 Book Ticker required: ${normalizedSymbol}`
        );
      }
    }

    return true;
  };


  // ==================================================
  // RELEASE BOOK TICKER
  // ==================================================

  const releaseBookTicker = (symbol) => {
    const normalizedSymbol =
      normalizeSymbol(symbol);

    if (!normalizedSymbol) {
      return false;
    }

    const requirement =
      bookTickerRequirements.get(
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
      `📊 BOOK TICKER RELEASE CHECK | ${normalizedSymbol} | total=${requirement.count}`
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
          bookTickerRequirements.get(
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
          "bookTicker"
        );

        bookTickerRequirements.delete(
          normalizedSymbol
        );

        console.log(
          `📴 Book Ticker released completely: ${normalizedSymbol}`
        );

      }, SYMBOL_RELEASE_GRACE_MS);

    return true;
  };


  return {
    updateBookTicker,
    requireBookTicker,
    releaseBookTicker,
  };
};


module.exports = {
  bookTickerRequirements,
  createBookTickerStream,
};