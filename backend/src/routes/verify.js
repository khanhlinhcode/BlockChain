const router = require("express").Router();
const verify = require("../controllers/verifyController");
const { uploadPdfField, handleUploadError } = require("../middleware/upload");
const { verifyLimiter } = require("../middleware/rateLimit");

// All verify routes are PUBLIC (no auth)
router.use(verifyLimiter);

router.post("/by-id", verify.verifyById);
router.post("/by-file", ...uploadPdfField, handleUploadError, verify.verifyByFile);
router.post("/by-hash", verify.verifyByHash);
router.get("/:certId/history", verify.getHistory);

module.exports = router;
