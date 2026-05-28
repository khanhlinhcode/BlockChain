const rateLimit = require("express-rate-limit");
const jwt = require("jsonwebtoken");

function clientIp(req) {
  return req.ip || req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket?.remoteAddress || "unknown";
}

function keyGenerator(req) {
  if (process.env.NODE_ENV === "test" && req.headers["x-test-rate-limit-key"]) {
    return String(req.headers["x-test-rate-limit-key"]);
  }
  let adminId = req.admin?.id ? String(req.admin.id) : "";
  if (!adminId) {
    const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    const decoded = token ? jwt.decode(token) : null;
    if (decoded && typeof decoded === "object" && decoded.id) {
      adminId = String(decoded.id);
    }
  }
  return adminId ? `admin:${adminId}:${clientIp(req)}` : `ip:${clientIp(req)}`;
}

function rateLimitResponse(message, code) {
  return {
    success: false,
    error: message,
    code,
  };
}

function buildLimiter({ windowMs, limit, message, code }) {
  return rateLimit({
    windowMs,
    limit,
    keyGenerator,
    standardHeaders: true,
    legacyHeaders: false,
    message: rateLimitResponse(message, code),
  });
}

const apiLimiter = buildLimiter({
  windowMs: 60 * 1000,
  limit: (req) => (req.admin ? 500 : 100),
  message: "Too many API requests. Please slow down and try again shortly.",
  code: "RATE_LIMITED",
});

const authLimiter = buildLimiter({
  windowMs: 15 * 60 * 1000,
  limit: process.env.NODE_ENV === "test" ? 100 : 10,
  message: "Too many authentication requests. Please try again later.",
  code: "AUTH_RATE_LIMITED",
});

const loginLimiter = authLimiter;

const issueLimiter = buildLimiter({
  windowMs: 60 * 60 * 1000,
  limit: (req) => (req.admin ? 50 : 20),
  message: "Certificate issue limit reached. Please try again later.",
  code: "ISSUE_RATE_LIMITED",
});

const verifyLimiter = buildLimiter({
  windowMs: 60 * 1000,
  limit: process.env.NODE_ENV === "test" ? 20 : 30,
  message: "Too many verification requests. Please try again shortly.",
  code: "VERIFY_RATE_LIMITED",
});

module.exports = {
  apiLimiter,
  authLimiter,
  loginLimiter,
  issueLimiter,
  verifyLimiter,
  keyGenerator,
};
