const rateLimit = require("express-rate-limit");

function keyGenerator(req) {
  if (process.env.NODE_ENV === "test" && req.headers["x-test-rate-limit-key"]) {
    return String(req.headers["x-test-rate-limit-key"]);
  }
  return req.ip || req.socket?.remoteAddress || "unknown";
}

/** General API: 100 requests / 15 min */
exports.apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  keyGenerator,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "Too many requests, please try again later" },
});

/** Login endpoints: 5 attempts / 15 min */
exports.loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  keyGenerator,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "Too many login attempts, please try again later" },
});

/** Other auth endpoints: 20 / 15 min */
exports.authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  keyGenerator,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "Too many authentication requests, please try again later" },
});

/** Public verify endpoints: 20 / 15 min */
exports.verifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  keyGenerator,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "Too many verification requests, please try again later" },
});
