// const jwt = require("jsonwebtoken");
// const env = require("../config/env");

// function authMiddleware(req, res, next) {
//     try {
//         const authorization = req.headers.authorization;

//         if (!authorization || !authorization.startsWith("Bearer ")) {
//             return res.status(401).json({
//                 success: false,
//                 message: "Authentication token is required."
//             });
//         }

//         const token = authorization.slice(7).trim();

//         if (!token) {
//             return res.status(401).json({
//                 success: false,
//                 message: "Authentication token is required."
//             });
//         }

//         const decoded = jwt.verify(token, env.jwtSecret, {
//             issuer: "terminal1"
//         });

//         req.auth = {
//             userId: Number(decoded.sub)
//         };

//         if (!Number.isSafeInteger(req.auth.userId) || req.auth.userId <= 0) {
//             return res.status(401).json({
//                 success: false,
//                 message: "Invalid authentication token."
//             });
//         }

//         next();
//     } catch (error) {
//         return res.status(401).json({
//             success: false,
//             message: "Your session is invalid or expired. Please log in again."
//         });
//     }
// }

// module.exports = authMiddleware;


const jwt = require("jsonwebtoken");
const env = require("../config/env");
const UserSession = require("../models/auth/user_session_model");

async function authMiddleware(req, res, next) {
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

        const userId = Number(decoded.sub);
        const sessionId = Number(decoded.sid);

        if (
            !Number.isSafeInteger(userId) ||
            userId <= 0 ||
            !Number.isSafeInteger(sessionId) ||
            sessionId <= 0
        ) {
            return res.status(401).json({
                success: false,
                message: "Invalid authentication token."
            });
        }

        // Verify that this session is still active
        const session = await UserSession.findOne({
            where: {
                id: sessionId,
                user_id: userId,
                revoked_at: null
            }
        });

        if (!session || new Date(session.expires_at) <= new Date()) {
            return res.status(401).json({
                success: false,
                message: "Your session is invalid or expired. Please log in again."
            });
        }

        req.auth = {
            userId,
            sessionId
        };

        next();

    } catch (error) {
        return res.status(401).json({
            success: false,
            message: "Your session is invalid or expired. Please log in again."
        });
    }
}

module.exports = authMiddleware;
