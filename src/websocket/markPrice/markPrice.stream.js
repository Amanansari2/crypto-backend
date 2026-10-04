const markPriceRequirements = new Map();

const createMarkPriceStream = ({
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
  const updateMarkPrice = (data) => {
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
      markPrice:
        data.p != null
          ? Number(data.p)
          : null,
      indexPrice:
        data.i != null
          ? Number(data.i)
          : null,
      fundingRate:
        data.r != null
          ? Number(data.r)
          : null,
      eventTime:
        data.E != null
          ? Number(data.E)
          : null,
      transactionTime:
        data.T != null
          ? Number(data.T)
          : null,
      updatedAt: Date.now(),
    };

    marketData.set(symbol, {
  ...current,

  markPrice:
    payload.markPrice != null
      ? payload.markPrice
      : current?.markPrice,

  indexPrice:
    payload.indexPrice != null
      ? payload.indexPrice
      : current?.indexPrice,

  fundingRate:
    payload.fundingRate != null
      ? payload.fundingRate
      : current?.fundingRate,

  eventTime:
    payload.eventTime != null
      ? payload.eventTime
      : current?.eventTime,

  transactionTime:
    payload.transactionTime != null
      ? payload.transactionTime
      : current?.transactionTime,

  updatedAt: payload.updatedAt,
});

    marketEvents.emit(
      "markPrice",
      payload
    );
  };

  const requireMarkPrice = (symbol) => {
    const normalizedSymbol =
      ensureSymbol(symbol);

    if (!normalizedSymbol) {
      return false;
    }

    setManuallyDisconnected(false);

    let requirement =
      markPriceRequirements.get(
        normalizedSymbol
      );

    if (!requirement) {
      requirement = {
        count: 0,
        releaseTimer: null,
      };

      markPriceRequirements.set(
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
        "markPrice"
      );

      if (LOG_CONNECTION_EVENTS) {
        console.log(
          `📊 Mark Price required: ${normalizedSymbol}`
        );
      }
    }

    return true;
  };

  const releaseMarkPrice = (symbol) => {
    const normalizedSymbol =
      normalizeSymbol(symbol);

    if (!normalizedSymbol) {
      return false;
    }

    const requirement =
      markPriceRequirements.get(
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
      `📊 MARK PRICE RELEASE CHECK | ${normalizedSymbol} | total=${requirement.count}`
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
          markPriceRequirements.get(
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
          "markPrice"
        );

        markPriceRequirements.delete(
          normalizedSymbol
        );

        console.log(
          `📴 Mark Price released completely: ${normalizedSymbol}`
        );
      }, SYMBOL_RELEASE_GRACE_MS);

    return true;
  };

  return {
    updateMarkPrice,
    requireMarkPrice,
    releaseMarkPrice,
  };
};

module.exports = {
  markPriceRequirements,
  createMarkPriceStream,
};  