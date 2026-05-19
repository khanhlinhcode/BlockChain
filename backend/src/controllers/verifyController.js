const crypto = require("crypto");
const Certificate = require("../models/Certificate");
const hashService = require("../services/hashService");
const blockchainService = require("../services/blockchainService");

const CERT_ID_LOOKUP_PATTERN = /^[A-Z0-9][A-Z0-9._:-]{0,79}$/;
const VERIFY_CACHE_TTL_MS = 30 * 1000;
const verifyByIdCache = new Map();

function getCachedVerifyById(certId) {
  const cached = verifyByIdCache.get(certId);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    verifyByIdCache.delete(certId);
    return null;
  }
  return cached.payload;
}

function setCachedVerifyById(certId, payload) {
  verifyByIdCache.set(certId, {
    expiresAt: Date.now() + VERIFY_CACHE_TTL_MS,
    payload,
  });
}

/**
 * Build a standardized verification response.
 */
function buildResponse(cert, onChain) {
  const verifiedAt = new Date().toISOString();

  return {
    success: true,
    exists: onChain.exists,
    isValid: onChain.isValid,
    isRevoked: onChain.isRevoked,
    verifiedAt,
    certificate: cert
      ? {
          _id: cert._id,
          certId: cert.certId,
          certHash: cert.certHash,
          ipfsCID: cert.ipfsCID,
          recipientName: cert.recipientName,
          courseName: cert.courseName,
          issuingOrg: cert.issuingOrg,
          issuerAddress: cert.issuerAddress,
          issuedAt: cert.issuedAt,
          ipfsUrl: cert.ipfsUrl,
          qrCodeUrl: cert.qrCodeUrl,
          isRevoked: cert.isRevoked,
          revokedAt: cert.revokedAt,
          revokedBy: cert.revokedBy,
          revokeReason: cert.revokeReason,
          txHash: cert.txHash,
          blockNumber: cert.blockNumber,
          verificationCount: cert.verificationCount,
          lastVerifiedAt: cert.lastVerifiedAt,
          createdAt: cert.createdAt,
          updatedAt: cert.updatedAt,
          metadata: cert.metadata,
        }
      : null,
    blockchain: onChain.cert || null,
  };
}

function hashIpAddress(ip) {
  if (!ip) return "anonymous";
  return crypto.createHash("sha256").update(String(ip)).digest("hex");
}

function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || "unknown";
}

async function appendVerificationLog(cert, req) {
  const history = Array.isArray(cert.metadata?.verificationHistory)
    ? cert.metadata.verificationHistory
    : [];

  history.push({
    verifiedAt: new Date().toISOString(),
    ipAddress: hashIpAddress(getClientIp(req)),
  });

  cert.metadata = {
    ...(cert.metadata || {}),
    verificationHistory: history.slice(-1000),
  };
}

/**
 * POST /api/verify/by-id
 * Verify a certificate by its human-readable certId.
 */
exports.verifyById = async (req, res, next) => {
  try {
    const certId = String(req.body?.certId || "").trim().toUpperCase();
    if (!certId) return res.status(400).json({ success: false, error: "certId is required" });
    if (!CERT_ID_LOOKUP_PATTERN.test(certId)) {
      return res.status(400).json({ success: false, error: "Invalid certId format" });
    }

    const cached = getCachedVerifyById(certId);
    if (cached) {
      return res.json({
        ...cached,
        verifiedAt: new Date().toISOString(),
        cached: true,
      });
    }

    // DB lookup (fast)
    const cert = await Certificate.findOne({ certId });
    if (!cert) {
      return res.json({
        success: true,
        exists: false,
        isValid: false,
        isRevoked: false,
        certificate: null,
        blockchain: null,
        verifiedAt: new Date().toISOString(),
      });
    }

    // On-chain verification (authoritative)
    let onChain;
    try {
      onChain = await blockchainService.verifyCertOnChain(cert.certHash);
    } catch (error) {
      error.status = 503;
      error.message = `Blockchain service temporarily unavailable: ${error.message}`;
      throw error;
    }

    // Increment verification count
    cert.verificationCount += 1;
    cert.lastVerifiedAt = new Date();
    await appendVerificationLog(cert, req);
    await cert.save();

    const payload = buildResponse(cert, onChain);
    if (payload.exists) {
      setCachedVerifyById(certId, payload);
    }

    return res.json(payload);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/verify/by-file
 * Verify by uploading the original PDF — hash and look up.
 */
exports.verifyByFile = async (req, res, next) => {
  try {
    const file = req.file;
    if (!file || !file.buffer) {
      return res.status(400).json({ success: false, error: "PDF file is required" });
    }

    // Hash the uploaded file
    const hexHash = await hashService.hashPDFBuffer(file.buffer);
    const certHash = await hashService.hashToBytes32(hexHash);

    // DB lookup
    const cert = await Certificate.findOne({ certHash });
    if (!cert) {
      return res.json({
        success: true,
        exists: false,
        isValid: false,
        isRevoked: false,
        certificate: null,
        message: "No certificate matches this file",
        verifiedAt: new Date().toISOString(),
      });
    }

    // On-chain verification
    let onChain;
    try {
      onChain = await blockchainService.verifyCertOnChain(certHash);
    } catch (error) {
      error.status = 503;
      error.message = `Blockchain service temporarily unavailable: ${error.message}`;
      throw error;
    }

    cert.verificationCount += 1;
    cert.lastVerifiedAt = new Date();
    await appendVerificationLog(cert, req);
    await cert.save();

    return res.json(buildResponse(cert, onChain));
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/verify/by-hash
 * Direct hash lookup.
 */
exports.verifyByHash = async (req, res, next) => {
  try {
    const rawHash = String(req.body?.certHash || "");
    if (!rawHash) return res.status(400).json({ success: false, error: "certHash is required" });

    let certHash;
    try {
      certHash = blockchainService.normalizeHash(rawHash);
    } catch {
      return res.json({
        success: true,
        exists: false,
        isValid: false,
        isRevoked: false,
        certificate: null,
        blockchain: null,
        verifiedAt: new Date().toISOString(),
      });
    }

    const cert = await Certificate.findOne({ certHash });
    let onChain;
    try {
      onChain = await blockchainService.verifyCertOnChain(certHash);
    } catch (error) {
      error.status = 503;
      error.message = `Blockchain service temporarily unavailable: ${error.message}`;
      throw error;
    }

    if (cert) {
      cert.verificationCount += 1;
      cert.lastVerifiedAt = new Date();
      await appendVerificationLog(cert, req);
      await cert.save();
    }

    return res.json(buildResponse(cert, onChain));
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/verify/:certId/history
 * Return verification history records.
 */
exports.getHistory = async (req, res, next) => {
  try {
    const cert = await Certificate.findOne({ certId: req.params.certId });
    if (!cert) return res.status(404).json({ success: false, error: "Certificate not found" });

    const history = Array.isArray(cert.metadata?.verificationHistory)
      ? cert.metadata.verificationHistory
      : [];

    return res.json(history);
  } catch (err) {
    next(err);
  }
};
