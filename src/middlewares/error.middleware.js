const logger = require("../utils/logger");

const errorMiddleware = (err, req, res, next) => {
  logger.error(err);
  return res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal server error"
  });
};

module.exports = errorMiddleware;
