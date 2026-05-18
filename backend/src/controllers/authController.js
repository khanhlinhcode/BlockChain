const jwt = require("jsonwebtoken");
const { ethers } = require("ethers");
const bcrypt = require("bcryptjs");
const Admin = require("../models/Admin");
const blockchainService = require("../services/blockchainService");
const {
  blacklistToken,
  isTokenBlacklisted,
} = require("../services/tokenBlacklistService");

const signAccessToken = (admin) =>
  jwt.sign(
    { id: admin._id, username: admin.username, role: admin.role, walletAddress: admin.walletAddress },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "8h" }
  );

const signRefreshToken = (admin) =>
  jwt.sign(
    { id: admin._id, username: admin.username, role: admin.role, walletAddress: admin.walletAddress },
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d" }
  );

function sanitizeAdmin(admin) {
  return {
    id: admin._id,
    username: admin.username,
    role: admin.role,
    walletAddress: admin.walletAddress,
  };
}

function issueSession(admin) {
  const token = signAccessToken(admin);
  const refreshToken = signRefreshToken(admin);
  return { token, refreshToken, admin: sanitizeAdmin(admin) };
}

/**
 * POST /api/auth/login
 * Username + password login.
 */
exports.login = async (req, res, next) => {
  try {
    const username = String(req.body?.username || "").trim().toLowerCase();
    const password = String(req.body?.password || "");
    if (!username || !password) {
      return res
        .status(400)
        .json({ success: false, error: "Username and password are required" });
    }

    const admin = await Admin.findOne({ username, isActive: true }).select("+passwordHash");
    if (!admin || !(await admin.comparePassword(password))) {
      return res
        .status(401)
        .json({ success: false, error: "Invalid username or password" });
    }

    admin.lastLogin = new Date();
    await admin.save();

    return res.json({ success: true, ...issueSession(admin) });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/login-metamask
 * MetaMask signature-based login.
 */
exports.loginMetaMask = async (req, res, next) => {
  try {
    const { signature, message } = req.body;
    const walletAddress = String(req.body?.walletAddress || "").trim();
    if (!walletAddress || !signature || !message) {
      return res.status(400).json({
        success: false,
        error: "walletAddress, signature, and message are required",
      });
    }

    let normalizedWallet;
    try {
      normalizedWallet = ethers.getAddress(walletAddress).toLowerCase();
    } catch {
      return res.status(400).json({ success: false, error: "Invalid wallet address" });
    }

    // Verify signature
    const recoveredAddress = ethers.verifyMessage(message, signature);
    if (recoveredAddress.toLowerCase() !== normalizedWallet) {
      return res
        .status(401)
        .json({ success: false, error: "Signature verification failed" });
    }

    // Check if wallet is a registered admin
    let admin = await Admin.findOne({
      walletAddress: normalizedWallet,
      isActive: true,
    });

    // Fallback: check if wallet is an admin on-chain
    if (!admin) {
      try {
        const isOnChainAdmin = await blockchainService.isAdminOnChain(normalizedWallet);
        if (!isOnChainAdmin) {
          return res
            .status(403)
            .json({ success: false, error: "Wallet is not a registered admin" });
        }
        // Auto-create admin record for on-chain admin
        admin = new Admin({
          username: `wallet_${normalizedWallet.slice(2, 10).toLowerCase()}`,
          walletAddress: normalizedWallet,
          role: "admin",
        });
        admin.passwordHash = await bcrypt.hash(
          require("crypto").randomBytes(32).toString("hex"),
          12
        );
        await admin.save();
      } catch {
        return res
          .status(403)
          .json({ success: false, error: "Wallet is not a registered admin" });
      }
    }

    admin.lastLogin = new Date();
    await admin.save();

    return res.json({ success: true, ...issueSession(admin) });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/link-wallet
 * Link a signed MetaMask wallet to the currently authenticated admin account.
 */
exports.linkWallet = async (req, res, next) => {
  try {
    const { signature, message } = req.body;
    const walletAddress = String(req.body?.walletAddress || "").trim();

    if (!walletAddress || !signature || !message) {
      return res.status(400).json({
        success: false,
        error: "walletAddress, signature, and message are required",
      });
    }

    let normalizedWallet;
    try {
      normalizedWallet = ethers.getAddress(walletAddress).toLowerCase();
    } catch {
      return res.status(400).json({ success: false, error: "Invalid wallet address" });
    }

    const recoveredAddress = ethers.verifyMessage(message, signature);
    if (recoveredAddress.toLowerCase() !== normalizedWallet) {
      return res
        .status(401)
        .json({ success: false, error: "Signature verification failed" });
    }

    const existing = await Admin.findOne({
      walletAddress: normalizedWallet,
      _id: { $ne: req.admin.id },
      isActive: true,
    });
    if (existing) {
      return res.status(409).json({
        success: false,
        error: "This wallet is already linked to another admin account",
      });
    }

    const admin = await Admin.findById(req.admin.id);
    if (!admin || !admin.isActive) {
      return res.status(401).json({ success: false, error: "Admin not found or deactivated" });
    }

    admin.walletAddress = normalizedWallet;
    await admin.save();

    return res.json({
      success: true,
      message: "Wallet linked successfully",
      admin: sanitizeAdmin(admin),
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/logout
 * Invalidate active access/refresh tokens via in-memory blacklist.
 */
exports.logout = async (req, res) => {
  const accessToken = req.token;
  const refreshToken = req.body?.refreshToken;

  if (accessToken) {
    blacklistToken(accessToken);
  }
  if (refreshToken) {
    blacklistToken(refreshToken);
  }

  res.json({ success: true, message: "Logged out successfully" });
};

/**
 * POST /api/auth/refresh
 * Refresh access token using refresh token rotation.
 */
exports.refresh = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ success: false, error: "refreshToken is required" });
    }
    if (isTokenBlacklisted(refreshToken)) {
      return res
        .status(401)
        .json({ success: false, error: "Refresh token has been revoked" });
    }

    const decoded = jwt.verify(
      refreshToken,
      process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET
    );

    const admin = await Admin.findOne({ _id: decoded.id, isActive: true });
    if (!admin) {
      return res
        .status(401)
        .json({ success: false, error: "Admin not found or deactivated" });
    }

    blacklistToken(refreshToken);
    return res.json({ success: true, ...issueSession(admin) });
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ success: false, error: "Refresh token expired" });
    }
    if (err.name === "JsonWebTokenError") {
      return res.status(401).json({ success: false, error: "Invalid refresh token" });
    }
    return next(err);
  }
};

/**
 * GET /api/auth/me
 * Return current admin info from JWT.
 */
exports.getMe = async (req, res, next) => {
  try {
    const admin = await Admin.findById(req.admin.id);
    if (!admin) return res.status(404).json({ success: false, error: "Admin not found" });
    res.json({
      success: true,
      admin: {
        id: admin._id,
        username: admin.username,
        role: admin.role,
        walletAddress: admin.walletAddress,
        isActive: admin.isActive,
        lastLogin: admin.lastLogin,
        createdAt: admin.createdAt,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/seed
 * Create default superadmin from env vars. Only runs if no admin exists.
 */
exports.seed = async (_req, res, next) => {
  try {
    const count = await Admin.countDocuments();
    if (count > 0) {
      return res
        .status(400)
        .json({ success: false, error: "Admin accounts already exist. Seed aborted." });
    }

    const admin = new Admin({
      username: process.env.DEFAULT_ADMIN_USERNAME || "admin",
      role: "superadmin",
    });
    admin.passwordHash = await bcrypt.hash(
      process.env.DEFAULT_ADMIN_PASSWORD || "Admin@123456",
      12
    );
    await admin.save();

    res.status(201).json({
      success: true,
      message: "Default superadmin created",
      admin: { username: admin.username, role: admin.role },
    });
  } catch (err) {
    next(err);
  }
};
