const jwt = require("jsonwebtoken");
const Admin = require("../models/Admin");
const { isTokenBlacklisted } = require("../services/tokenBlacklistService");
const { isWalletAllowed } = require("../services/walletAuthorizationService");

const AUTH_METHODS = new Set(["password", "wallet"]);

/**
 * JWT authentication middleware.
 * Expects: Authorization: Bearer <token>
 * Attaches req.admin = { id, username, role, walletAddress }
 */
async function verifyJWT(req, res, next) {
  try {
    const authHeader = String(req.headers.authorization || "");
    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, error: "Authentication required", code: "AUTH_REQUIRED" });
    }

    const token = authHeader.slice(7).trim();
    if (!token) {
      return res.status(401).json({ success: false, error: "Authentication required", code: "AUTH_REQUIRED" });
    }
    if (await isTokenBlacklisted(token)) {
      return res.status(401).json({
        success: false,
        error: "Token has been revoked",
        code: "TOKEN_REVOKED",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!AUTH_METHODS.has(decoded.authMethod)) {
      return res.status(401).json({
        success: false,
        error: "Session must be renewed",
        code: "SESSION_RENEWAL_REQUIRED",
      });
    }

    // Verify admin still exists and is active
    const admin = await Admin.findById(decoded.id);
    if (!admin || !admin.isActive) {
      return res
        .status(401)
        .json({ success: false, error: "Account not found or deactivated", code: "ACCOUNT_INACTIVE" });
    }

    if (decoded.authMethod === "wallet" && !(await isWalletAllowed(admin.walletAddress))) {
      return res.status(403).json({
        success: false,
        error: "Wallet is no longer allowed to access CertChain admin",
        code: "WALLET_NOT_ALLOWED",
      });
    }

    req.admin = {
      id: admin._id,
      username: admin.username,
      role: admin.role,
      walletAddress: admin.walletAddress,
      authMethod: decoded.authMethod,
    };
    req.token = token;
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ success: false, error: "Token expired", code: "TOKEN_EXPIRED" });
    }
    if (err.name === "JsonWebTokenError") {
      return res.status(401).json({ success: false, error: "Invalid token", code: "INVALID_TOKEN" });
    }
    next(err);
  }
}

/**
 * Role-based authorization middleware.
 * Usage: requireRole('superadmin')
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.admin) {
      return res.status(401).json({ success: false, error: "Authentication required", code: "AUTH_REQUIRED" });
    }
    if (!roles.includes(req.admin.role)) {
      return res.status(403).json({ success: false, error: "Insufficient permissions", code: "FORBIDDEN" });
    }
    next();
  };
}

const requireSuperAdmin = requireRole("superadmin");

module.exports = { verifyJWT, requireRole, requireSuperAdmin };
