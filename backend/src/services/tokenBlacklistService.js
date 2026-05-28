const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const mongoose = require("mongoose");
const TokenBlacklist = require("../models/TokenBlacklist");

const blacklistedTokens = new Map();

function cleanupExpired() {
  const now = Date.now();
  for (const [token, expiresAtMs] of blacklistedTokens.entries()) {
    if (!expiresAtMs || expiresAtMs <= now) {
      blacklistedTokens.delete(token);
    }
  }
}

function getExpiryMs(token) {
  try {
    const decoded = jwt.decode(token);
    if (!decoded || typeof decoded !== "object" || !decoded.exp) {
      return Date.now() + 60 * 60 * 1000;
    }
    return Number(decoded.exp) * 1000;
  } catch {
    return Date.now() + 60 * 60 * 1000;
  }
}

function hashToken(token) {
  return crypto.createHash("sha256").update(String(token || "")).digest("hex");
}

async function blacklistToken(token, reason = "logout") {
  if (!token) return;
  const expiry = getExpiryMs(token);
  blacklistedTokens.set(token, expiry);

  try {
    if (mongoose.connection.readyState !== 1) return;
    await TokenBlacklist.updateOne(
      { tokenHash: hashToken(token) },
      {
        $set: {
          tokenHash: hashToken(token),
          expiresAt: new Date(expiry),
          invalidatedAt: new Date(),
          reason,
        },
      },
      { upsert: true }
    );
  } catch {
    // Keep in-memory blacklist as a best-effort fallback if MongoDB is down.
  }
}

async function isTokenBlacklisted(token) {
  cleanupExpired();
  if (!token) return false;
  if (blacklistedTokens.has(token)) return true;

  try {
    if (mongoose.connection.readyState !== 1) return false;
    const existing = await TokenBlacklist.exists({
      tokenHash: hashToken(token),
      expiresAt: { $gt: new Date() },
    });
    return Boolean(existing);
  } catch {
    return false;
  }
}

module.exports = {
  blacklistToken,
  isTokenBlacklisted,
  hashToken,
};
