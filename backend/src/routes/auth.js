const router = require("express").Router();
const auth = require("../controllers/authController");
const { verifyJWT } = require("../middleware/auth");
const { authLimiter, loginLimiter } = require("../middleware/rateLimit");
const { enforceLoginProtection } = require("../middleware/loginProtection");
const { auditLogger } = require("../middleware/auditLogger");
const { validateRequest, validators } = require("../middleware/security");

router.post(
  "/login",
  loginLimiter,
  validators.login,
  validateRequest,
  enforceLoginProtection,
  auditLogger("LOGIN", (req) => ({ username: req.body.username })),
  auth.login
);
router.post(
  "/login-metamask",
  loginLimiter,
  validators.metamaskLogin,
  validateRequest,
  enforceLoginProtection,
  auditLogger("LOGIN_METAMASK", (req) => ({ walletAddress: req.body.walletAddress })),
  auth.loginMetaMask
);
router.post(
  "/link-wallet",
  verifyJWT,
  validators.metamaskLogin,
  validateRequest,
  auditLogger("ADD_WALLET", (req) => ({ walletAddress: req.body.walletAddress })),
  auth.linkWallet
);
router.post("/refresh", authLimiter, auth.refresh);
router.post("/logout", verifyJWT, auditLogger("LOGOUT"), auth.logout);
router.get("/me", verifyJWT, auth.getMe);
router.post("/seed", authLimiter, auth.seed);

module.exports = router;
