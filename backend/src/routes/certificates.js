const router = require("express").Router();
const cert = require("../controllers/certController");
const { verifyJWT } = require("../middleware/auth");
const { uploadPdfField, handleUploadError } = require("../middleware/upload");

// QR codes only encode public verification URLs, so they must be readable by
// mobile scanners and <img> tags that cannot attach Bearer tokens.
router.get("/:certId/qr", cert.getQR);

// Admin certificate routes require auth.
router.use(verifyJWT);

// Stats must come before :certId to avoid route conflict
router.get("/stats", cert.stats);
router.get("/audit", cert.audit);
router.post("/sync-from-chain", cert.syncFromChain);

router.post("/issue", ...uploadPdfField, handleUploadError, cert.issue);
router.get("/", cert.list);
router.get("/:certId", cert.getById);
router.put("/:certHash/revoke", cert.revoke);

module.exports = router;
