const jwt = require("jsonwebtoken");
const Admin = require("../models/Admin");
const { isTokenBlacklisted } = require("../services/tokenBlacklistService");

/**
 * JWT authentication middleware.
 * Expects: Authorization: Bearer <token>
 * Attaches req.admin = { id, username, role, walletAddress }
 */
async function verifyJWT(req, res, next) {
  try {
    const authHeader = String(req.headers.authorization || "");
    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, error: "Authentication required" });
    }

    const token = authHeader.slice(7).trim();
    if (!token) {
      return res.status(401).json({ success: false, error: "Authentication required" });
    }
    if (isTokenBlacklisted(token)) {
      return res.status(401).json({ success: false, error: "Token has been revoked" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Verify admin still exists and is active
    const admin = await Admin.findById(decoded.id);
    if (!admin || !admin.isActive) {
      return res
        .status(401)
        .json({ success: false, error: "Account not found or deactivated" });
    }

    req.admin = {
      id: admin._id,
      username: admin.username,
      role: admin.role,
      walletAddress: admin.walletAddress,
    };
    req.token = token;
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ success: false, error: "Token expired" });
    }
    if (err.name === "JsonWebTokenError") {
      return res.status(401).json({ success: false, error: "Invalid token" });
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
      return res.status(401).json({ success: false, error: "Authentication required" });
    }
    if (!roles.includes(req.admin.role)) {
      return res.status(403).json({ success: false, error: "Insufficient permissions" });
    }
    next();
  };
}

module.exports = { verifyJWT, requireRole };
