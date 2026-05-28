const router = require("express").Router();
const cert = require("../controllers/certController");
const { verifyJWT } = require("../middleware/auth");
const { uploadPdfField, handleUploadError } = require("../middleware/upload");
const { issueLimiter } = require("../middleware/rateLimit");
const { auditLogger } = require("../middleware/auditLogger");
const { validateRequest, validators } = require("../middleware/security");

// QR codes only encode public verification URLs, so they must be readable by
// mobile scanners and <img> tags that cannot attach Bearer tokens.
router.get("/:certId/qr", cert.getQR);

// Admin certificate routes require auth.
router.use(verifyJWT);

// Stats must come before :certId to avoid route conflict
router.get("/stats", cert.stats);
router.get("/audit", cert.audit);
router.post("/sync-from-chain", issueLimiter, validators.txHash, validateRequest, auditLogger("ISSUE_CERT", (req) => ({ txHash: req.body.txHash, mode: "metamask_sync" })), cert.syncFromChain);
router.post("/sync-issued", issueLimiter, validators.txHash, validateRequest, auditLogger("ISSUE_CERT", (req) => ({ txHash: req.body.txHash, mode: "metamask_sync" })), cert.syncFromChain);

router.post(
  "/prepare-metamask-issue",
  issueLimiter,
  ...uploadPdfField,
  handleUploadError,
  cert.prepareMetaMaskIssue
);
router.post(
  "/issue",
  issueLimiter,
  ...uploadPdfField,
  handleUploadError,
  validators.certificateIssue,
  validateRequest,
  auditLogger("ISSUE_CERT", (req) => ({ certId: req.body.certId, mode: "backend" })),
  cert.issue
);
router.get("/", cert.list);
router.get("/:certId", cert.getById);
router.put("/:certHash/revoke", auditLogger("REVOKE_CERT", (req) => ({ certHash: req.params.certHash })), cert.revoke);

module.exports = router;
