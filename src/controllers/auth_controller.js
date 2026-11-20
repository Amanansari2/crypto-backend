const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Register = require("../models/auth/register.model");
const env = require("../config/env");
const { sendEmail } = require("../services/email.service");
const sequelize = require("../config/db");
const { TradingAccount } = require("../models/trading");
const UserSession = require("../models/auth/user_session_model");

// No Redis/database schema changes: temporary OTP state is kept in this process.
// It is cleared on server restart and is not shared across multiple Node instances.
const OTP_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 30 * 1000;
const MAX_OTP_ATTEMPTS = 5;
const otpStore = new Map();       // key: verify:<email> or reset:<email>
const resetGrants = new Map();    // key: one-time reset token hash

const normalizeEmail = value => String(value || "").trim().toLowerCase();
const validEmail = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const validPassword = value => typeof value === "string" && value.length >= 8 && value.length <= 128;
const hash = value => crypto.createHash("sha256").update(value).digest("hex");
const newOtp = () => crypto.randomInt(0, 1000000).toString().padStart(6, "0");
const escapeHtml = value => String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#039;");

const generateUID = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let randomPart = "";

    for (let i = 0; i < 6; i++) {
        randomPart += chars.charAt(
            crypto.randomInt(0, chars.length)
        );
    }

    return `terminal1${randomPart}`;
};

const generateTradingUID = () => {
    return `TRD-${crypto.randomBytes(16).toString("hex").toUpperCase()}`;
};

function makeOtpEmail({ name, otp, purpose }) {
    const verify = purpose === "verify";
    const heading = verify ? "Verify your Terminal1 email" : "Reset your Terminal1 password";
    const action = verify ? "verify your email address" : "reset your password";
    return {
        subject: heading,
        text: `Hello ${name || ""},\n\nUse this one-time code to ${action}: ${otp}\n\nThis code expires in 10 minutes. If you did not request this, you can ignore this email.`,
        html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#172033"><h2>${heading}</h2><p>Hello ${escapeHtml(name || "there")},</p><p>Use this one-time code to ${action}:</p><div style="font-size:32px;font-weight:bold;letter-spacing:8px;padding:18px;background:#f3f7fb;text-align:center;border-radius:8px">${otp}</div><p>This code expires in 10 minutes. Do not share it with anyone.</p><p>If you did not request this, you can ignore this email.</p></div>`
    };
}

async function sendOtp(email, name, purpose) {
    const key = `${purpose}:${email}`;
    const now = Date.now();
    const previous = otpStore.get(key);
    if (previous && now - previous.sentAt < RESEND_COOLDOWN_MS) {
        const error = new Error("Please wait before requesting another OTP.");
        error.status = 429;
        throw error;
    }
    const otp = newOtp();
    const record = { otpHash: hash(otp), expiresAt: now + OTP_TTL_MS, sentAt: now, attempts: 0, verified: false };
    // Store before sending, but remove it if email delivery fails.
    otpStore.set(key, record);
    try {
        const message = makeOtpEmail({ name, otp, purpose });
        await sendEmail({ to: email, ...message });
    } catch (error) {
        if (otpStore.get(key) === record) otpStore.delete(key);
        throw error;
    }
}

function verifyOtp(email, purpose, suppliedOtp) {
    const key = `${purpose}:${email}`;
    const record = otpStore.get(key);
    if (!record || record.expiresAt <= Date.now()) {
        otpStore.delete(key);
        return { ok: false, message: "OTP is invalid or expired. Please request a new OTP." };
    }
    if (record.attempts >= MAX_OTP_ATTEMPTS) {
        otpStore.delete(key);
        return { ok: false, message: "Too many incorrect attempts. Please request a new OTP." };
    }
    record.attempts += 1;
    if (record.otpHash !== hash(String(suppliedOtp || "").trim())) {
        return { ok: false, message: "Incorrect OTP." };
    }
    otpStore.delete(key); // one-time use
    return { ok: true };
}

function publicUser(user) {
    return {
        uid: user.uid,
        trading_uid: user.trading_uid,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        is_email_verified: Boolean(user.is_email_verified),
        account_status: user.account_status,
        email_verified_at: user.email_verified_at,
        created_at: user.created_at
    };
}

exports.register = async (req, res, next) => {
    try {
        const first_name = String(req.body.first_name || "").trim();
        const last_name = String(req.body.last_name || "").trim();
        const email = normalizeEmail(req.body.email);
        const password = req.body.password;
        if (!first_name || !last_name || !email || !password) return res.status(400).json({ success: false, message: "First name, last name, email and password are required." });
        if (first_name.length > 100 || last_name.length > 100) return res.status(400).json({ success: false, message: "First and last names must be 100 characters or fewer." });
        if (email.length > 255 || !validEmail(email)) return res.status(400).json({ success: false, message: "Please enter a valid email address." });
        if (!validPassword(password)) return res.status(400).json({ success: false, message: "Password must be between 8 and 128 characters." });

        let user = await Register.findOne({ where: { email } });
        if (user && (user.is_email_verified || user.account_status !== "pending")) return res.status(409).json({ success: false, message: "An account with this email already exists." });
        if (!user) {
            user = await Register.create({
                uid: generateUID(), first_name, last_name, email,
                password: await bcrypt.hash(password, 12), is_email_verified: false, account_status: "pending"
            });
        } else {
            // Allow an unverified pending registration to request a fresh OTP.
            user.first_name = first_name; user.last_name = last_name;
            user.password = await bcrypt.hash(password, 12); await user.save();
        }
        await sendOtp(email, first_name, "verify");
        return res.status(201).json({ success: true, message: "Registration saved as pending. Enter the 6-digit OTP sent to your email to activate your account." });
    } catch (error) {
        if (error.status === 429) return res.status(429).json({ success: false, message: error.message });
        if (error.name === "SequelizeUniqueConstraintError") return res.status(409).json({ success: false, message: "An account with this email already exists." });
        next(error);
    }
};

// exports.verifyEmail = async (req, res, next) => {
//     try {
//         const email = normalizeEmail(req.body.email);
//         const otp = String(req.body.otp || "").trim();
//         if (!validEmail(email) || !/^\d{6}$/.test(otp)) return res.status(400).json({ success: false, message: "A valid email and 6-digit OTP are required." });
//         const user = await Register.findOne({ where: { email, account_status: "pending", is_email_verified: false } });
//         if (!user) return res.status(400).json({ success: false, message: "No pending account found for this email." });
//         const result = verifyOtp(email, "verify", otp);
//         if (!result.ok) return res.status(400).json({ success: false, message: result.message });
//         user.is_email_verified = true;
//         user.account_status = "active";
//         user.email_verified_at = new Date();
//         await user.save();
//         return res.json({ success: true, message: "Email verified successfully. Your account is now active.", data: { user: publicUser(user) } });
//     } catch (error) { next(error); }
// };

exports.verifyEmail = async (req, res, next) => {
    let transaction;

    try {
        const email = normalizeEmail(req.body.email);
        const otp = String(req.body.otp || "").trim();

        if (!validEmail(email) || !/^\d{6}$/.test(otp)) {
            return res.status(400).json({
                success: false,
                message: "A valid email and 6-digit OTP are required."
            });
        }

        const user = await Register.findOne({
            where: {
                email,
                account_status: "pending",
                is_email_verified: false
            }
        });

        if (!user) {
            return res.status(400).json({
                success: false,
                message: "No pending account found for this email."
            });
        }

        const result = verifyOtp(email, "verify", otp);

        if (!result.ok) {
            return res.status(400).json({
                success: false,
                message: result.message
            });
        }

        // Start database transaction
        transaction = await sequelize.transaction();

        // Lock user row while creating the trading account
        const lockedUser = await Register.findByPk(user.id, {
            transaction,
            lock: transaction.LOCK.UPDATE
        });

        if (
            !lockedUser ||
            lockedUser.account_status !== "pending" ||
            lockedUser.is_email_verified
        ) {
            await transaction.rollback();
            transaction = null;

            return res.status(400).json({
                success: false,
                message: "Account is already verified or unavailable."
            });
        }

        // Generate trading UID only if it does not already exist
        if (!lockedUser.trading_uid) {
            lockedUser.trading_uid = generateTradingUID();
        }

        // Activate user
        lockedUser.is_email_verified = true;
        lockedUser.account_status = "active";
        lockedUser.email_verified_at = new Date();

        await lockedUser.save({ transaction });

        // Check whether trading account already exists
        const existingAccount = await TradingAccount.findOne({
            where: {
                accountId: lockedUser.trading_uid
            },
            transaction
        });

        // Create trading account if it does not exist
        if (!existingAccount) {
            await TradingAccount.create(
                {
                    accountId: lockedUser.trading_uid,
                    currency: "USDT",
                    balance: 0,
                    availableBalance: 0,
                    usedMargin: 0,
                    realizedPnl: 0,
                    totalFees: 0,
                    status: "ACTIVE"
                },
                { transaction }
            );
        }

        // Commit both user activation and account creation
        await transaction.commit();
        transaction = null;

        return res.json({
            success: true,
            message: "Email verified successfully. Your account is now active.",
            data: {
                user: publicUser(lockedUser)
            }
        });

    } catch (error) {
        if (transaction) {
            await transaction.rollback();
        }

        next(error);
    }
};

exports.resendVerification = async (req, res, next) => {
    try {
        const email = normalizeEmail(req.body.email);
        if (!validEmail(email)) return res.status(400).json({ success: false, message: "A valid email is required." });
        const user = await Register.findOne({ where: { email, is_email_verified: 0, account_status: "pending" } });
        if (!user) return res.json({ success: true, message: "If a pending account exists for this email, a verification OTP will be sent." });
        await sendOtp(email, user.first_name, "verify");
        return res.json({ success: true, message: "A new verification OTP has been sent." });
    } catch (error) {
        if (error.status === 429) return res.status(429).json({ success: false, message: error.message });
        next(error);
    }
};

// exports.login = async (req, res, next) => {
//     try {
//         const email = normalizeEmail(req.body.email), password = req.body.password;
//         if (!email || !password) return res.status(400).json({ success: false, message: "Email and password are required." });
//         const user = await Register.findOne({ where: { email } });
//         if (!user || !(await bcrypt.compare(password, user.password))) return res.status(401).json({ success: false, message: "Invalid email or password." });
//         if (!user.is_email_verified || user.account_status !== "active") return res.status(403).json({ success: false, code: "EMAIL_NOT_VERIFIED", message: "Please verify your email before logging in." });
//         if (
//     !env.jwtSecret ||
//     typeof env.jwtSecret !== "string" ||
//     env.jwtSecret.length < 32
// ) {
//     throw new Error("Configure a strong JWT_SECRET in the .env.");
// }
//         user.last_login_at = new Date(); await user.save();
//         const token = jwt.sign({ sub: String(user.id), uid: user.uid }, env.jwtSecret, { expiresIn: process.env.JWT_EXPIRES_IN || "1d", issuer: "terminal1" });
//         return res.json({ success: true, message: "Login successful.", data: { token, user: publicUser(user) } });
//     } catch (error) { next(error); }
// };



exports.login = async (req, res, next) => {
    try {
        const email = normalizeEmail(req.body.email);
        const password = req.body.password;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required."
            });
        }

        const user = await Register.findOne({ where: { email } });

        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password."
            });
        }

        if (!user.is_email_verified || user.account_status !== "active") {
            return res.status(403).json({
                success: false,
                code: "EMAIL_NOT_VERIFIED",
                message: "Please verify your email before logging in."
            });
        }

        if (
            !env.jwtSecret ||
            typeof env.jwtSecret !== "string" ||
            env.jwtSecret.length < 32
        ) {
            throw new Error("Configure a strong JWT_SECRET in the .env.");
        }

        user.last_login_at = new Date();
        await user.save();

        // Generate refresh token
        const refreshToken = crypto.randomBytes(64).toString("hex");
        const refreshTokenHash = hash(refreshToken);

        const expiresAt = new Date(
            Date.now() + 30 * 24 * 60 * 60 * 1000
        );

        // Create a separate session for this login
        const session = await UserSession.create({
            user_id: user.id,
            refresh_token_hash: refreshTokenHash,
            expires_at: expiresAt
        });

        // Generate 15-minute access token
        const accessToken = jwt.sign(
            {
                sub: String(user.id),
                uid: user.uid,
                sid: String(session.id)
            },
            env.jwtSecret,
            {
                expiresIn: "15m",
                issuer: "terminal1"
            }
        );

        return res.json({
            success: true,
            message: "Login successful.",
            data: {
                token: accessToken,
                refresh_token: refreshToken,
                user: publicUser(user)
            }
        });

    } catch (error) {
        next(error);
    }
};


exports.forgotPassword = async (req, res, next) => {
    try {
        const email = normalizeEmail(req.body.email);
        if (!validEmail(email)) return res.status(400).json({ success: false, message: "A valid email is required." });
        const response = { success: true, message: "If an active account exists for this email, a password-reset OTP will be sent." };
        const user = await Register.findOne({ where: { email, is_email_verified: 1, account_status: "active" } });
        if (user) await sendOtp(email, user.first_name, "reset");
        return res.json(response);
    } catch (error) {
        if (error.status === 429) return res.status(429).json({ success: false, message: error.message });
        next(error);
    }
};

exports.verifyResetOtp = async (req, res, next) => {
    try {
        const email = normalizeEmail(req.body.email), otp = String(req.body.otp || "").trim();
        if (!validEmail(email) || !/^\d{6}$/.test(otp)) return res.status(400).json({ success: false, message: "A valid email and 6-digit OTP are required." });
        const user = await Register.findOne({ where: { email, is_email_verified: true, account_status: "active" } });
        if (!user) return res.status(400).json({ success: false, message: "OTP is invalid or expired. Please request a new OTP." });
        const result = verifyOtp(email, "reset", otp);
        if (!result.ok) return res.status(400).json({ success: false, message: result.message });
        const resetToken = crypto.randomBytes(32).toString("hex");
        resetGrants.set(hash(resetToken), { userId: user.id, expiresAt: Date.now() + OTP_TTL_MS });
        return res.json({ success: true, message: "OTP verified. Use the reset token to set your new password.", data: { reset_token: resetToken } });
    } catch (error) { next(error); }
};

exports.resetPassword = async (req, res, next) => {
    try {
        const token = String(req.body.reset_token || req.body.token || "").trim();
        const password = req.body.password;
        const confirmPassword = req.body.confirm_password;
        if (!token || !password || !confirmPassword) return res.status(400).json({ success: false, message: "Reset token, password and confirm_password are required." });
        if (password !== confirmPassword) return res.status(400).json({ success: false, message: "Password and confirmation do not match." });
        if (!validPassword(password)) return res.status(400).json({ success: false, message: "Password must be between 8 and 128 characters." });
        const tokenHash = hash(token), grant = resetGrants.get(tokenHash);
        if (!grant || grant.expiresAt <= Date.now()) { resetGrants.delete(tokenHash); return res.status(400).json({ success: false, message: "Reset token is invalid or expired. Please restart password recovery." }); }
        const user = await Register.findByPk(grant.userId);
        if (!user || user.account_status !== "active") { resetGrants.delete(tokenHash); return res.status(400).json({ success: false, message: "Account is not available." }); }
        user.password = await bcrypt.hash(password, 12); await user.save();
        resetGrants.delete(tokenHash);
        return res.json({ success: true, message: "Password reset successfully. You can now log in." });
    } catch (error) { next(error); }
};

exports.me = async (req, res, next) => {
    try {
        const user = await Register.findByPk(req.auth.userId);
        if (!user || user.account_status !== "active") return res.status(404).json({ success: false, message: "User account not found or inactive." });
        return res.json({ success: true, data: { user: publicUser(user) } });
    } catch (error) { next(error); }
};

exports.changePassword = async (req, res, next) => {
    try {
        const currentPassword = req.body.current_password, newPassword = req.body.new_password, confirmPassword = req.body.confirm_password;
        if (!currentPassword || !newPassword || !confirmPassword) return res.status(400).json({ success: false, message: "Current password, new password and confirm_password are required." });
        if (newPassword !== confirmPassword) return res.status(400).json({ success: false, message: "New password and confirmation do not match." });
        if (!validPassword(newPassword)) return res.status(400).json({ success: false, message: "New password must be between 8 and 128 characters." });
        const user = await Register.findByPk(req.auth.userId);
        if (!user || user.account_status !== "active") return res.status(404).json({ success: false, message: "User account not found or inactive." });
        if (!(await bcrypt.compare(currentPassword, user.password))) return res.status(400).json({ success: false, message: "Current password is incorrect." });
        if (await bcrypt.compare(newPassword, user.password)) return res.status(400).json({ success: false, message: "Choose a password different from your current password." });
        user.password = await bcrypt.hash(newPassword, 12); await user.save();
        return res.json({ success: true, message: "Password changed successfully." });
    } catch (error) { next(error); }
};


exports.refresh = async (req, res, next) => {
    let transaction;

    try {
        const refreshToken = String(req.body.refresh_token || "").trim();

        if (!refreshToken) {
            return res.status(401).json({
                success: false,
                message: "Refresh token is required."
            });
        }

        transaction = await sequelize.transaction();

        // Find and lock the existing session
        const session = await UserSession.findOne({
            where: {
                refresh_token_hash: hash(refreshToken),
                revoked_at: null
            },
            transaction,
            lock: transaction.LOCK.UPDATE
        });

        if (!session) {
            await transaction.rollback();
            transaction = null;

            return res.status(401).json({
                success: false,
                message: "Invalid or revoked refresh token. Please log in again."
            });
        }

        // Check refresh token expiry
        if (new Date(session.expires_at) <= new Date()) {
            session.revoked_at = new Date();
            await session.save({ transaction });

            await transaction.commit();
            transaction = null;

            return res.status(401).json({
                success: false,
                message: "Refresh token expired. Please log in again."
            });
        }

        const user = await Register.findByPk(session.user_id, {
            transaction
        });

        if (!user || user.account_status !== "active" || !user.is_email_verified) {
            session.revoked_at = new Date();
            await session.save({ transaction });

            await transaction.commit();
            transaction = null;

            return res.status(401).json({
                success: false,
                message: "User account is unavailable. Please log in again."
            });
        }

        // Rotate refresh token
        const newRefreshToken = crypto.randomBytes(64).toString("hex");

        session.refresh_token_hash = hash(newRefreshToken);
        session.expires_at = new Date(
            Date.now() + 30 * 24 * 60 * 60 * 1000
        );

        await session.save({ transaction });

        // Generate new access token
        const accessToken = jwt.sign(
            {
                sub: String(user.id),
                uid: user.uid,
                sid: String(session.id)
            },
            env.jwtSecret,
            {
                expiresIn: "15m",
                issuer: "terminal1"
            }
        );

        await transaction.commit();
        transaction = null;

        return res.json({
            success: true,
            message: "Token refreshed successfully.",
            data: {
                token: accessToken,
                refresh_token: newRefreshToken
            }
        });

    } catch (error) {
        if (transaction) {
            await transaction.rollback();
        }

        next(error);
    }
};


// exports.logout = async (req, res) => res.json({ success: true, message: "Logged out. Please discard your authentication token." });



exports.logout = async (req, res, next) => {
    try {
        const session = await UserSession.findOne({
            where: {
                id: req.auth.sessionId,
                user_id: req.auth.userId,
                revoked_at: null
            }
        });

        if (!session) {
            return res.status(401).json({
                success: false,
                message: "Session is already invalid or logged out."
            });
        }

        session.revoked_at = new Date();
        await session.save();

        return res.json({
            success: true,
            message: "Logged out successfully."
        });

    } catch (error) {
        next(error);
    }
};
