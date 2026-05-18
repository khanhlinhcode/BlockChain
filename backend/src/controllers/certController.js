const Certificate = require("../models/Certificate");
const hashService = require("../services/hashService");
const ipfsService = require("../services/ipfsService");
const blockchainService = require("../services/blockchainService");
const qrService = require("../services/qrService");

const BASE_URL = () => process.env.FRONTEND_URL || "http://localhost:3000";
const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const CERT_ID_PATTERN = /^[A-Z0-9][A-Z0-9._:-]{2,79}$/;

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeCertId(value) {
  return String(value || "").trim().toUpperCase();
}

/**
 * POST /api/certificates/issue
 */
exports.issue = async (req, res, next) => {
  try {
    const recipientName = normalizeText(req.body.recipientName);
    const courseName = normalizeText(req.body.courseName);
    const issuingOrg = normalizeText(req.body.issuingOrg);
    const requestedCertId = normalizeCertId(req.body.certId);
    const file = req.file;

    if (!file || !file.buffer) {
      return res.status(400).json({ success: false, error: "PDF file is required" });
    }
    if (!recipientName || !courseName || !issuingOrg) {
      return res.status(400).json({
        success: false,
        error: "recipientName, courseName, and issuingOrg are required",
      });
    }
    if (requestedCertId && !CERT_ID_PATTERN.test(requestedCertId)) {
      return res.status(400).json({
        success: false,
        error: "Certificate ID must be 3-80 chars and contain only letters, numbers, '.', '_', ':', or '-'",
      });
    }

    // 1. Hash PDF
    const hexHash = await hashService.hashPDFBuffer(file.buffer);
    const certHash = await hashService.hashToBytes32(hexHash);

    // 2. Check duplicate
    const existing = await Certificate.findOne({ certHash });
    if (existing) {
      return res.status(409).json({
        success: false,
        error: "A certificate with this file already exists",
        certId: existing.certId,
      });
    }

    // 3. Use the provided certId when present, otherwise generate one.
    let certId = requestedCertId || hashService.generateCertId("CERT");
    for (let i = 0; !requestedCertId && i < 5; i++) {
      // Very unlikely collision guard.
      // eslint-disable-next-line no-await-in-loop
      const collision = await Certificate.exists({ certId });
      if (!collision) break;
      certId = hashService.generateCertId("CERT");
    }
    if (await Certificate.exists({ certId })) {
      return res
        .status(409)
        .json({ success: false, error: "A certificate with this ID already exists" });
    }

    // 4. Upload to IPFS
    let cid;
    let ipfsUrl;
    try {
      const uploaded = await ipfsService.uploadPDFToIPFS(file.buffer, `${certId}.pdf`);
      cid = uploaded.cid;
      ipfsUrl = uploaded.url;
    } catch (error) {
      error.status = 502;
      error.message = `IPFS upload failed: ${error.message}`;
      throw error;
    }

    // 5. Issue on blockchain
    const { txHash, blockNumber } = await blockchainService.issueCertOnChain(
      certHash, certId, cid, recipientName, courseName, issuingOrg
    );

    // 6. Generate QR code
    const qrDataUrl = await qrService.generateQRCode(certId, BASE_URL());

    // 7. Save to MongoDB
    const certificate = await Certificate.create({
      certHash,
      certId,
      ipfsCID: cid,
      ipfsUrl,
      recipientName,
      courseName,
      issuingOrg,
      issuerAddress: blockchainService.getSignerAddress(),
      issuedAt: new Date(),
      txHash,
      blockNumber,
      qrCodeUrl: `/api/certificates/${certId}/qr`,
    });

    return res.status(201).json({
      success: true,
      certId: certificate.certId,
      certHash: certificate.certHash,
      ipfsCID: cid,
      ipfsUrl,
      txHash,
      blockNumber,
      qrCode: qrDataUrl,
      certificate,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/certificates/:certHash/revoke
 */
exports.revoke = async (req, res, next) => {
  try {
    const rawCertHash = decodeURIComponent(req.params.certHash || "");
    const { reason } = req.body;
    let certHash;
    try {
      certHash = blockchainService.normalizeHash(rawCertHash);
    } catch (error) {
      return res.status(400).json({ success: false, error: "Invalid certificate hash" });
    }

    const cert = await Certificate.findOne({ certHash });
    if (!cert) return res.status(404).json({ success: false, error: "Certificate not found" });
    if (cert.isRevoked) {
      return res.status(400).json({ success: false, error: "Certificate is already revoked" });
    }

    // Revoke on-chain
    const { txHash } = await blockchainService.revokeCertOnChain(certHash, reason || "Revoked by admin");

    // Update DB
    cert.isRevoked = true;
    cert.revokedAt = new Date();
    cert.revokedBy = req.admin.walletAddress || req.admin.username;
    cert.revokeReason = reason || "No reason provided";
    try {
      await cert.save();
    } catch (error) {
      error.status = 500;
      error.message =
        "Certificate revoked on-chain but failed to update database. Manual reconciliation required.";
      throw error;
    }

    return res.json({ success: true, txHash, certificate: cert });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/certificates
 * Paginated list with search & status filter.
 */
exports.list = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;
    const { search, status, sort } = req.query;

    // Build filter
    const filter = {};
    if (status === "valid") filter.isRevoked = false;
    else if (status === "revoked") filter.isRevoked = true;

    if (search) {
      const safeSearch = escapeRegex(search);
      filter.$or = [
        { recipientName: { $regex: safeSearch, $options: "i" } },
        { courseName: { $regex: safeSearch, $options: "i" } },
        { certId: { $regex: safeSearch, $options: "i" } },
        { certHash: { $regex: safeSearch, $options: "i" } },
      ];
    }

    // Sort
    const sortField = sort || "issuedAt";
    const sortOrder = req.query.order === "asc" ? 1 : -1;

    const [certificates, total] = await Promise.all([
      Certificate.find(filter).sort({ [sortField]: sortOrder }).skip(skip).limit(limit),
      Certificate.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      certificates,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/certificates/stats
 */
exports.stats = async (_req, res, next) => {
  try {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const sixMonthsAgo = new Date(startOfMonth);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);

    const [total, valid, revoked, thisMonth, byOrg, monthlyAgg] = await Promise.all([
      Certificate.countDocuments(),
      Certificate.countDocuments({ isRevoked: false }),
      Certificate.countDocuments({ isRevoked: true }),
      Certificate.countDocuments({ issuedAt: { $gte: startOfMonth } }),
      Certificate.aggregate([
        { $group: { _id: "$issuingOrg", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),
      Certificate.aggregate([
        { $match: { issuedAt: { $gte: sixMonthsAgo } } },
        {
          $group: {
            _id: { year: { $year: "$issuedAt" }, month: { $month: "$issuedAt" } },
            count: { $sum: 1 },
          },
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } },
      ]),
    ]);

    const countByMonth = new Map(
      monthlyAgg.map((row) => [`${row._id.year}-${String(row._id.month).padStart(2, "0")}`, row.count])
    );
    const formatter = new Intl.DateTimeFormat("en-US", { month: "short" });
    const monthlyData = Array.from({ length: 6 }, (_, index) => {
      const date = new Date(sixMonthsAgo);
      date.setMonth(sixMonthsAgo.getMonth() + index);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      return {
        month: formatter.format(date),
        count: countByMonth.get(key) || 0,
      };
    });

    return res.json({
      success: true,
      total,
      valid,
      active: valid,
      revoked,
      thisMonth,
      issuedToday: thisMonth,
      monthlyData,
      byOrg,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/certificates/audit
 * Read blockchain events with optional filters.
 */
exports.audit = async (req, res, next) => {
  try {
    const { eventType = "all", from, to, limit } = req.query;
    const events = await blockchainService.getAuditEvents({
      eventType,
      from,
      to,
      limit,
    });

    const missingIds = events
      .filter((event) => !event.certId && event.certHash)
      .map((event) => event.certHash);

    if (!missingIds.length) {
      return res.json({ success: true, events });
    }

    const certificateRows = await Certificate.find({
      certHash: { $in: Array.from(new Set(missingIds)) },
    })
      .select("certHash certId")
      .lean();

    const certIdByHash = new Map(
      certificateRows.map((row) => [row.certHash, row.certId || ""])
    );

    const merged = events.map((event) => ({
      ...event,
      certId: event.certId || certIdByHash.get(event.certHash) || "Unknown",
    }));

    return res.json({ success: true, events: merged });
  } catch (err) {
    if (blockchainService.isRpcUnavailableError?.(err)) {
      blockchainService.resetDefaultClient?.();
      return res.json({
        success: true,
        events: [],
        warning:
          "Blockchain RPC is unavailable. Start the local Hardhat node or update ALCHEMY_URL to view on-chain audit events.",
      });
    }
    next(err);
  }
};

/**
 * GET /api/certificates/:certId
 */
exports.getById = async (req, res, next) => {
  try {
    const cert = await Certificate.findOne({ certId: req.params.certId });
    if (!cert) return res.status(404).json({ success: false, error: "Certificate not found" });
    return res.json({ success: true, certificate: cert });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/certificates/:certId/qr
 * Return QR code as PNG image.
 */
exports.getQR = async (req, res, next) => {
  try {
    const certId = normalizeCertId(req.params.certId);
    const verifyUrl = `${BASE_URL()}/verify/${encodeURIComponent(certId)}`;
    const dataUrl = await qrService.generateQRCode(certId, BASE_URL());
    const base64 = dataUrl.replace(/^data:image\/png;base64,/, "");
    const buffer = Buffer.from(base64, "base64");

    res.set("Content-Type", "image/png");
    res.set("Cache-Control", "no-store, max-age=0");
    res.set("X-QR-Verify-URL", verifyUrl);
    return res.send(buffer);
  } catch (err) {
    next(err);
  }
};
