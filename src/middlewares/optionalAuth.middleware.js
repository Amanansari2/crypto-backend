const jwt = require("jsonwebtoken");
const env = require("../config/env");

function optionalAuth(req, res, next) {
    try {
        const authorization = req.headers.authorization;

        // Guest user
        if (!authorization) {
            req.auth = null;
            return next();
        }

        if (!authorization.startsWith("Bearer ")) {
            return res.status(401).json({
                success: false,
                message: "Invalid authorization header."
            });
        }

        const token = authorization.slice(7).trim();

        const decoded = jwt.verify(token, env.jwtSecret, {
            issuer: "terminal1"
        });

        const userId = Number(decoded.sub);

        if (!Number.isSafeInteger(userId) || userId <= 0) {
            return res.status(401).json({
                success: false,
                message: "Invalid authentication token."
            });
        }

        req.auth = {
            userId
        };

        next();

    } catch (error) {
        return res.status(401).json({
            success: false,
            message: "Your session is invalid or expired."
        });
    }
}

module.exports = optionalAuth;