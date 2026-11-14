const jwt = require("jsonwebtoken");
const env = require("../config/env");

function authMiddleware(req, res, next) {
    try {
        const authorization = req.headers.authorization;

        if (!authorization || !authorization.startsWith("Bearer ")) {
            return res.status(401).json({
                success: false,
                message: "Authentication token is required."
            });
        }

        const token = authorization.slice(7).trim();

        if (!token) {
            return res.status(401).json({
                success: false,
                message: "Authentication token is required."
            });
        }

        const decoded = jwt.verify(token, env.jwtSecret, {
            issuer: "terminal1"
        });

        req.auth = {
            userId: Number(decoded.sub)
        };

        if (!Number.isSafeInteger(req.auth.userId) || req.auth.userId <= 0) {
            return res.status(401).json({
                success: false,
                message: "Invalid authentication token."
            });
        }

        next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            message: "Your session is invalid or expired. Please log in again."
        });
    }
}

module.exports = authMiddleware;