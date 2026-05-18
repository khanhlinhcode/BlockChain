const jwt = require("jsonwebtoken");

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

function blacklistToken(token) {
  if (!token) return;
  const expiry = getExpiryMs(token);
  blacklistedTokens.set(token, expiry);
}

function isTokenBlacklisted(token) {
  cleanupExpired();
  if (!token) return false;
  return blacklistedTokens.has(token);
}

module.exports = {
  blacklistToken,
  isTokenBlacklisted,
};
