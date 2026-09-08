const EventEmitter = require("events");

const marketEvents = new EventEmitter();

// We don't want EventEmitter's default limit
// to become a problem when many listeners exist.
marketEvents.setMaxListeners(0);

module.exports = marketEvents;