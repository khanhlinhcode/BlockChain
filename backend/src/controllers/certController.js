const Certificate = require("../models/Certificate");
const hashService = require("../services/hashService");
const ipfsService = require("../services/ipfsService");
const blockchainService = require("../services/blockchainService");
const qrService = require("../services/qrService");

const BASE_URL = () => process.env.FRONTEND_URL || "http://localhost:3000";
const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const CERT_ID_PATTERN = /^[A-Z0-9][A-Z0-9._:-]{2,79}$/;
const ALLOWED_SORT_FIELDS = new Set(["issuedAt", "certId", "recipientName", "courseName", "createdAt"]);
const TX_HASH_PATTERN = /^0x[0-9a-fA-F]{64}$/;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

function normalizeText(value) {
  return String(value || "")
    .replace(/[<>]/g, "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim();
}

function normalizeCertId(value) {
  return String(value || "").trim().toUpperCase();
}

function ipfsGatewayUrl(cid) {
  const gateway = (process.env.PINATA_GATEWAY || process.env.IPFS_GATEWAY || "https://gateway.pinata.cloud/ipfs")
    .replace(/\/+$/, "");
  return `${gateway}/${cid}`;
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
      error.status = 503;
      error.message = `IPFS service temporarily unavailable: ${error.message}`;
      throw error;
    }

    // 5. Issue on blockchain
    let txHash;
    let blockNumber;
    try {
      const tx = await blockchainService.issueCertOnChain(
        certHash,
        certId,
        cid,
        recipientName,
        courseName,
        issuingOrg
      );
      txHash = tx.txHash;
      blockNumber = tx.blockNumber;
    } catch (error) {
      error.status = 503;
      error.message = `Blockchain service temporarily unavailable: ${error.message}`;
      throw error;
    }

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
    let txHash;
    try {
      const tx = await blockchainService.revokeCertOnChain(certHash, reason || "Revoked by admin");
      txHash = tx.txHash;
    } catch (error) {
      error.status = 503;
      error.message = `Blockchain service temporarily unavailable: ${error.message}`;
      throw error;
    }

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
    const sortField = ALLOWED_SORT_FIELDS.has(String(sort || "")) ? String(sort) : "issuedAt";
    const sortOrder = req.query.order === "asc" ? 1 : -1;

    const [certificates, total] = await Promise.all([
      Certificate.find(filter).sort({ [sortField]: sortOrder }).skip(skip).limit(limit),
      Certificate.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      data: certificates,
      certificates,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      limit,
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
    const maxLimit = Math.min(500, Math.max(1, parseInt(limit, 10) || 200));
    const events = await blockchainService.getAuditEvents({
      eventType,
      from,
      to,
      limit: maxLimit,
    });

    const missingIds = events
      .filter((event) => !event.certId && event.certHash)
      .map((event) => event.certHash);

    const fromDate = from ? new Date(from) : null;
    const toDate = to ? new Date(to) : null;
    if (toDate && !Number.isNaN(toDate.getTime())) {
      toDate.setHours(23, 59, 59, 999);
    }

    const certificateFilter = {};
    if (eventType !== "all" && eventType !== "issued") {
      certificateFilter._id = { $exists: false };
    }
    if (fromDate && !Number.isNaN(fromDate.getTime())) {
      certificateFilter.issuedAt = { ...(certificateFilter.issuedAt || {}), $gte: fromDate };
    }
    if (toDate && !Number.isNaN(toDate.getTime())) {
      certificateFilter.issuedAt = { ...(certificateFilter.issuedAt || {}), $lte: toDate };
    }

    const [missingRows, issuedRows] = await Promise.all([
      missingIds.length
        ? Certificate.find({ certHash: { $in: Array.from(new Set(missingIds)) } })
            .select("certHash certId")
            .lean()
        : [],
      Certificate.find(certificateFilter)
        .select("certHash certId issuerAddress issuedAt txHash blockNumber")
        .sort({ issuedAt: -1 })
        .limit(maxLimit)
        .lean(),
    ]);

    const certIdByHash = new Map(missingRows.map((row) => [row.certHash, row.certId || ""]));
    const normalizedChainEvents = events.map((event) => ({
      ...event,
      certId: event.certId || certIdByHash.get(event.certHash) || "Unknown",
    }));

    const chainEventKeys = new Set(
      normalizedChainEvents.map((event) => `${event.eventType}:${event.txHash || event.certHash}`)
    );

    const mongoIssuedEvents = issuedRows
      .map((row) => ({
        eventType: "issued",
        certId: row.certId || "Unknown",
        certHash: row.certHash || "",
        actor: row.issuerAddress || "",
        timestamp: row.issuedAt ? new Date(row.issuedAt).toISOString() : new Date(0).toISOString(),
        txHash: row.txHash || "",
        blockNumber: Number(row.blockNumber || 0),
        source: "database",
      }))
      .filter((event) => !chainEventKeys.has(`${event.eventType}:${event.txHash || event.certHash}`));

    const merged = [...normalizedChainEvents, ...mongoIssuedEvents]
      .sort((a, b) => {
        const byTime = new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
        if (byTime !== 0) return byTime;
        return Number(b.blockNumber || 0) - Number(a.blockNumber || 0);
      })
      .slice(0, maxLimit);

    return res.json({ success: true, events: merged });
  } catch (err) {
    if (blockchainService.isRpcUnavailableError?.(err)) {
      blockchainService.resetDefaultClient?.();
      try {
        const maxLimit = Math.min(500, Math.max(1, parseInt(req.query.limit, 10) || 200));
        const fallbackRows = await Certificate.find({})
          .select("certHash certId issuerAddress issuedAt txHash blockNumber")
          .sort({ issuedAt: -1 })
          .limit(maxLimit)
          .lean();
        return res.json({
          success: true,
          events: fallbackRows.map((row) => ({
            eventType: "issued",
            certId: row.certId || "Unknown",
            certHash: row.certHash || "",
            actor: row.issuerAddress || "",
            timestamp: row.issuedAt ? new Date(row.issuedAt).toISOString() : new Date(0).toISOString(),
            txHash: row.txHash || "",
            blockNumber: Number(row.blockNumber || 0),
            source: "database",
          })),
          warning:
            "Blockchain RPC is unavailable. Showing database-backed certificate issue history.",
        });
      } catch {
        return res.json({
          success: true,
          events: [],
          warning:
            "Blockchain RPC is unavailable. Start the local Hardhat node or update ALCHEMY_URL to view on-chain audit events.",
        });
      }
    }
    next(err);
  }
};

/**
 * POST /api/certificates/sync-from-chain
 * Persist a certificate that was issued directly on-chain, for example through
 * a browser wallet, so MongoDB-backed list/search pages stay consistent.
 */
exports.syncFromChain = async (req, res, next) => {
  try {
    const txHash = String(req.body.txHash || "").trim();
    if (!TX_HASH_PATTERN.test(txHash)) {
      return res.status(400).json({
        success: false,
        error: "Valid txHash is required",
      });
    }

    const provider = await blockchainService.getProvider();
    const receipt = await provider.getTransactionReceipt(txHash);

    if (!receipt) {
      return res.status(404).json({
        success: false,
        error: "Transaction not found or not confirmed yet",
      });
    }

    if (receipt.status !== 1) {
      return res.status(400).json({
        success: false,
        error: "Transaction failed on blockchain",
      });
    }

    const contract = await blockchainService.getContract();
    const contractAddress =
      typeof contract.getAddress === "function"
        ? await contract.getAddress()
        : String(contract.target || process.env.CONTRACT_ADDRESS || "");

    let issuedEvent = null;
    for (const log of receipt.logs || []) {
      if (
        contractAddress &&
        log.address &&
        String(log.address).toLowerCase() !== String(contractAddress).toLowerCase()
      ) {
        continue;
      }

      try {
        const parsed = contract.interface.parseLog(log);
        if (parsed?.name === "CertIssued") {
          issuedEvent = parsed.args;
          break;
        }
      } catch {
        // Ignore logs from other contracts in the same transaction.
      }
    }

    if (!issuedEvent) {
      return res.status(400).json({
        success: false,
        error: "No CertIssued event found in transaction",
      });
    }

    const certHash = blockchainService.normalizeHash(String(issuedEvent.certHash));
    const eventCertId = normalizeCertId(issuedEvent.certId);

    const existing = await Certificate.findOne({
      $or: [{ certHash }, ...(eventCertId ? [{ certId: eventCertId }] : [])],
    });
    if (existing) {
      return res.status(200).json({
        success: true,
        message: "Certificate already synced",
        certificate: existing,
      });
    }

    const onChainCert = await blockchainService.getCertOnChain(certHash);
    const certId = normalizeCertId(onChainCert.certId || eventCertId);
    const ipfsCID = normalizeText(onChainCert.ipfsCID);

    if (!certId) {
      return res.status(400).json({
        success: false,
        error: "On-chain certificate is missing certId",
      });
    }
    if (!ipfsCID) {
      return res.status(400).json({
        success: false,
        error: "On-chain certificate is missing IPFS CID",
      });
    }

    const issuedAtSeconds = Number(onChainCert.issuedAt);
    const revokedAtSeconds = Number(onChainCert.revokedAt || 0);
    const isRevoked = Boolean(onChainCert.isRevoked);

    try {
      await qrService.generateQRCode(certId, BASE_URL());
    } catch {
      // QR files can be regenerated by GET /api/certificates/:certId/qr.
    }

    const certificate = await Certificate.create({
      certHash,
      certId,
      ipfsCID,
      ipfsUrl: ipfsGatewayUrl(ipfsCID),
      recipientName: normalizeText(onChainCert.recipientName),
      courseName: normalizeText(onChainCert.courseName),
      issuingOrg: normalizeText(onChainCert.issuingOrg),
      issuerAddress: String(onChainCert.issuer || issuedEvent.issuer || ""),
      issuedAt:
        Number.isFinite(issuedAtSeconds) && issuedAtSeconds > 0
          ? new Date(issuedAtSeconds * 1000)
          : new Date(),
      isRevoked,
      revokedAt:
        isRevoked && Number.isFinite(revokedAtSeconds) && revokedAtSeconds > 0
          ? new Date(revokedAtSeconds * 1000)
          : null,
      revokedBy:
        isRevoked && onChainCert.revokedBy && String(onChainCert.revokedBy).toLowerCase() !== ZERO_ADDRESS
          ? String(onChainCert.revokedBy)
          : null,
      txHash,
      blockNumber: Number(receipt.blockNumber),
      qrCodeUrl: `/api/certificates/${certId}/qr`,
      verificationCount: 0,
    });

    return res.status(201).json({
      success: true,
      message: "Certificate synced from blockchain",
      certificate,
    });
  } catch (err) {
    if (blockchainService.isRpcUnavailableError?.(err)) {
      blockchainService.resetDefaultClient?.();
      err.status = 503;
      err.message = `Blockchain service temporarily unavailable: ${err.message}`;
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
