const jwt = require("jsonwebtoken");
const { ethers } = require("ethers");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const Admin = require("../models/Admin");
const AllowedWallet = require("../models/AllowedWallet");
const {
  blacklistToken,
  isTokenBlacklisted,
} = require("../services/tokenBlacklistService");
const { logAudit } = require("../middleware/auditLogger");

const signAccessToken = (admin) =>
  jwt.sign(
    {
      id: admin._id,
      username: admin.username,
      role: admin.role,
      walletAddress: admin.walletAddress,
      jti: crypto.randomUUID(),
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "8h" }
  );

const signRefreshToken = (admin) =>
  jwt.sign(
    {
      id: admin._id,
      username: admin.username,
      role: admin.role,
      walletAddress: admin.walletAddress,
      jti: crypto.randomUUID(),
    },
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

    const allowedWallet = await AllowedWallet.findOne({
      address: normalizedWallet,
      isActive: true,
    });
    if (!allowedWallet) {
      return res.status(403).json({
        success: false,
        error: "Wallet is not allowed to access CertChain admin",
        code: "WALLET_NOT_ALLOWED",
      });
    }

    // Check if wallet is a registered admin
    let admin = await Admin.findOne({
      walletAddress: normalizedWallet,
      isActive: true,
    });

    // Backward-compatible: create an admin profile only after whitelist approval.
    if (!admin) {
      admin = new Admin({
        username: `wallet_${normalizedWallet.slice(2, 10).toLowerCase()}`,
        walletAddress: normalizedWallet,
        role: "admin",
      });
      admin.passwordHash = await bcrypt.hash(
        crypto.randomBytes(32).toString("hex"),
        12
      );
      await admin.save();
    }

    admin.lastLogin = new Date();
    await admin.save();
    allowedWallet.lastLoginAt = new Date();
    await allowedWallet.save();

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
exports.logout = async (req, res, next) => {
  const accessToken = req.token;
  const refreshToken = req.body?.refreshToken;

  try {
    if (accessToken) {
      await blacklistToken(accessToken, "logout");
    }
    if (refreshToken) {
      await blacklistToken(refreshToken, "logout");
    }
    res.json({ success: true, message: "Logged out successfully" });
  } catch (error) {
    next(error);
  }
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
    if (await isTokenBlacklisted(refreshToken)) {
      return res
        .status(401)
        .json({ success: false, error: "Refresh token has been revoked", code: "TOKEN_REVOKED" });
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

    await blacklistToken(refreshToken, "refresh_rotation");
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
 * Create default superadmin from env vars. MetaMask login can create wallet-only
 * admin records first, so the seed must be keyed by username instead of
 * blocking on any admin document in the collection.
 */
exports.seed = async (_req, res, next) => {
  try {
    const username = String(process.env.DEFAULT_ADMIN_USERNAME || "admin")
      .trim()
      .toLowerCase();
    const existing = await Admin.findOne({ username });
    if (existing) {
      return res
        .status(400)
        .json({ success: false, error: "Default admin already exists. Seed aborted." });
    }

    const admin = new Admin({
      username,
      role: "superadmin",
    });
    const defaultWallet = String(
      process.env.DEFAULT_SUPERADMIN_WALLET ||
        process.env.DEFAULT_ADMIN_WALLET ||
        process.env.ADMIN_WALLET_ADDRESS ||
        ""
    ).trim();
    let normalizedWallet = "";
    if (defaultWallet) {
      try {
        normalizedWallet = ethers.getAddress(defaultWallet).toLowerCase();
        admin.walletAddress = normalizedWallet;
      } catch {
        normalizedWallet = "";
      }
    }
    admin.passwordHash = await bcrypt.hash(
      process.env.DEFAULT_ADMIN_PASSWORD || "Admin@123456",
      12
    );
    await admin.save();

    const extraWallets = String(process.env.DEFAULT_ALLOWED_WALLETS || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    const walletsToSeed = Array.from(new Set([normalizedWallet, ...extraWallets].filter(Boolean)));

    for (const wallet of walletsToSeed) {
      try {
        const address = ethers.getAddress(wallet).toLowerCase();
        // eslint-disable-next-line no-await-in-loop
        await AllowedWallet.updateOne(
          { address },
          {
            $setOnInsert: {
              address,
              addedBy: admin._id,
              label: address === normalizedWallet ? "Default superadmin wallet" : "Seeded admin wallet",
              isActive: true,
            },
          },
          { upsert: true }
        );
      } catch {
        // Ignore invalid optional seed wallet values.
      }
    }

    await logAudit({
      action: "ADD_WALLET",
      req: _req,
      admin,
      details: { seededWalletCount: walletsToSeed.length },
    });

    res.status(201).json({
      success: true,
      message: "Default superadmin created",
      admin: { username: admin.username, role: admin.role },
    });
  } catch (err) {
    next(err);
  }
};
