const depthConnections = new Map();

const depthRequirements = new Map();

const createDepthStream = ({
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
  // UPDATE ORDER BOOK
  // ==================================================

  const updateOrderBook = (data) => {
    if (!data?.s) {
      return;
    }

    const symbol = ensureSymbol(data.s);

    if (!symbol) {
      return;
    }

    marketEvents.emit("orderBook", {
      symbol,
      bids: data.b || [],
      asks: data.a || [],
      updateId: data.u,
    });
  };


  // ==================================================
  // REQUIRE DEPTH
  // ==================================================

  const requireDepth = (
    symbol
  ) => {
    const normalizedSymbol =
      ensureSymbol(symbol);

    if (!normalizedSymbol) {
      return false;
    }

    setManuallyDisconnected(false);

    let requirement =
      depthRequirements.get(
        normalizedSymbol
      );

    if (!requirement) {
      requirement = {
        count: 0,
        releaseTimer: null,
      };

      depthRequirements.set(
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
        "depth"
      );

      if (LOG_CONNECTION_EVENTS) {
        console.log(
          `📖 Depth required: ${normalizedSymbol}`
        );
      }
    }

    return true;
  };


  // ==================================================
  // RELEASE DEPTH
  // ==================================================

  const releaseDepth = (
    symbol
  ) => {
    const normalizedSymbol =
      normalizeSymbol(symbol);

    if (!normalizedSymbol) {
      return false;
    }

    const requirement =
      depthRequirements.get(
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
      `📊 DEPTH RELEASE CHECK | ${normalizedSymbol} | total=${requirement.count}`
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
          depthRequirements.get(
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
          "depth"
        );

        depthRequirements.delete(
          normalizedSymbol
        );

        console.log(
          `📴 Depth released completely: ${normalizedSymbol}`
        );

      }, SYMBOL_RELEASE_GRACE_MS);

    return true;
  };


  return {
    updateOrderBook,
    requireDepth,
    releaseDepth,
  };
};





module.exports = {
  depthConnections,
  depthRequirements,
  createDepthStream,
};