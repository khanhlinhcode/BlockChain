const router = require("express").Router();
const auth = require("../controllers/authController");
const { verifyJWT } = require("../middleware/auth");
const { authLimiter, loginLimiter } = require("../middleware/rateLimit");

router.post("/login", loginLimiter, auth.login);
router.post("/login-metamask", loginLimiter, auth.loginMetaMask);
router.post("/link-wallet", verifyJWT, auth.linkWallet);
router.post("/refresh", authLimiter, auth.refresh);
router.post("/logout", verifyJWT, auth.logout);
router.get("/me", verifyJWT, auth.getMe);
router.post("/seed", authLimiter, auth.seed);

module.exports = router;
