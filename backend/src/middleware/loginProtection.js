const LoginAttempt = require("../models/LoginAttempt");

const MAX_FAILURES = 5;
const LOCK_MS = 30 * 60 * 1000;

function clientIp(req) {
  return req.ip || req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket?.remoteAddress || "unknown";
}

function loginIdentifier(req) {
  return String(req.body?.username || req.body?.walletAddress || "unknown").trim().toLowerCase();
}

async function enforceLoginProtection(req, res, next) {
  if (process.env.NODE_ENV === "test") {
    return next();
  }

  try {
    const identifier = loginIdentifier(req);
    const ip = clientIp(req);
    const record = await LoginAttempt.findOne({ identifier, ip });

    if (record?.lockedUntil && record.lockedUntil.getTime() > Date.now()) {
      return res.status(423).json({
        success: false,
        error: "Too many failed login attempts. Account is temporarily locked.",
        code: "LOGIN_LOCKED",
        lockedUntil: record.lockedUntil,
      });
    }

    res.on("finish", async () => {
      try {
        const failed = res.statusCode >= 400 && res.statusCode < 500;
        if (!failed) {
          await LoginAttempt.deleteOne({ identifier, ip });
          return;
        }

        const attempts = (record?.attempts || 0) + 1;
        const lockedUntil = attempts >= MAX_FAILURES ? new Date(Date.now() + LOCK_MS) : null;
        await LoginAttempt.updateOne(
          { identifier, ip },
          {
            $set: {
              attempts,
              lockedUntil,
              lastAttemptAt: new Date(),
            },
            $setOnInsert: { identifier, ip },
          },
          { upsert: true }
        );
      } catch {
        // Login protection must never crash the auth response.
      }
    });

    return next();
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  enforceLoginProtection,
};
