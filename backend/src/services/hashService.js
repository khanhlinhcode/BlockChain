const crypto = require("crypto");

/**
 * Hash a PDF file buffer using SHA-256.
 * @param {Buffer} buffer - File buffer
 * @returns {Promise<string>} Hex-encoded hash (64 chars)
 */
async function hashPDFBuffer(buffer) {
  if (!Buffer.isBuffer(buffer)) {
    throw new TypeError("hashPDFBuffer expects a Buffer input");
  }

  const hash = crypto.createHash("sha256").update(buffer).digest("hex");
  if (hash.length !== 64) {
    throw new Error(`Unexpected SHA-256 hash length: ${hash.length}`);
  }

  return hash.toLowerCase();
}

/**
 * Convert a hex hash string to Solidity bytes32 format.
 * @param {string} hexHash - 64-char hex hash
 * @returns {Promise<string>} 0x-prefixed bytes32 string
 */
async function hashToBytes32(hexHash) {
  if (typeof hexHash !== "string" || !hexHash.trim()) {
    throw new TypeError("hashToBytes32 expects a non-empty hex string");
  }

  const clean = hexHash.startsWith("0x") ? hexHash.slice(2) : hexHash;
  if (clean.length !== 64) {
    throw new Error(`Invalid hash length: ${clean.length}`);
  }
  if (!/^[0-9a-fA-F]{64}$/.test(clean)) {
    throw new Error("Invalid hash format: expected 64 hex characters");
  }

  return `0x${clean.toLowerCase()}`;
}

/**
 * Verify that a buffer matches a stored hash.
 * @param {Buffer} buffer - File buffer to verify
 * @param {string} storedHash - Expected hash (with or without 0x prefix)
 * @returns {Promise<boolean>}
 */
async function verifyFileHash(buffer, storedHash) {
  if (typeof storedHash !== "string" || !storedHash.trim()) {
    return false;
  }

  const computedHash = await hashPDFBuffer(buffer);
  const normalize = (value) => value.toLowerCase().replace(/^0x/, "");

  return normalize(computedHash) === normalize(storedHash);
}

/**
 * Generate a unique human-readable certificate ID.
 * Format: PREFIX-YEAR-RANDOM8  (e.g. CERT-2024-A3F9K2LM)
 * @param {string} prefix - ID prefix (default: 'CERT')
 * @returns {string}
 */
function generateCertId(prefix = "CERT") {
  const year = new Date().getFullYear();
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let random = "";
  const bytes = crypto.randomBytes(8);
  for (let i = 0; i < 8; i++) {
    random += chars[bytes[i] % chars.length];
  }
  return `${prefix}-${year}-${random}`;
}

module.exports = {
  hashPDFBuffer,
  hashToBytes32,
  verifyFileHash,
  generateCertId,
};
