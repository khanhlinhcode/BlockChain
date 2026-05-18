const ipfsService = require("../services/ipfsService");

/**
 * POST /api/ipfs/upload-file
 * Admin helper endpoint to upload a raw PDF to IPFS.
 */
exports.uploadFile = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "PDF file is required" });
    }
    const { cid, url } = await ipfsService.uploadPDFToIPFS(
      req.file.buffer,
      req.file.originalname || "document.pdf"
    );
    return res.status(201).json({ cid, url });
  } catch (err) {
    return next(err);
  }
};

/**
 * POST /api/ipfs/upload-json
 * Admin helper endpoint to upload metadata JSON to IPFS.
 */
exports.uploadJSON = async (req, res, next) => {
  try {
    const metadata = req.body?.metadata || req.body || {};
    const name = req.body?.name || `metadata-${Date.now()}`;
    const { cid } = await ipfsService.uploadJSONToIPFS(metadata, name);
    return res.status(201).json({ cid });
  } catch (err) {
    return next(err);
  }
};

/**
 * POST /api/ipfs/unpin
 * Admin helper endpoint to unpin an IPFS CID.
 */
exports.unpin = async (req, res, next) => {
  try {
    const { cid } = req.body;
    if (!cid) {
      return res.status(400).json({ error: "cid is required" });
    }
    await ipfsService.unpinFile(cid);
    return res.json({ success: true });
  } catch (err) {
    return next(err);
  }
};
