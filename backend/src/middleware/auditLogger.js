const AuditLog = require("../models/AuditLog");
const mongoose = require("mongoose");

const SENSITIVE_KEYS = new Set([
  "password",
  "passwordHash",
  "token",
  "refreshToken",
  "authorization",
  "privateKey",
  "ADMIN_PRIVATE_KEY",
  "signature",
]);

function clientIp(req) {
  return req.ip || req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket?.remoteAddress || "unknown";
}

function sanitizeValue(value) {
  if (Array.isArray(value)) return value.map(sanitizeValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !SENSITIVE_KEYS.has(key))
        .map(([key, item]) => [key, sanitizeValue(item)])
    );
  }
  if (typeof value === "string" && value.length > 180) {
    return `${value.slice(0, 80)}...${value.slice(-20)}`;
  }
  return value;
}

async function logAudit({
  action,
  req,
  status = "success",
  details = {},
  admin = null,
}) {
  try {
    if (mongoose.connection.readyState !== 1) return;
    const actor = admin || req?.admin || {};
    await AuditLog.create({
      action,
      adminId: actor.id || actor._id || null,
      adminUsername: actor.username || "",
      ip: req ? clientIp(req) : "",
      userAgent: req?.headers?.["user-agent"] || "",
      details: sanitizeValue(details),
      status,
    });
  } catch {
    // Audit logging must never block the main user flow.
  }
}

function auditLogger(action, detailsFactory) {
  return (req, res, next) => {
    const originalJson = res.json.bind(res);
    let responsePayload = null;

    res.json = (payload) => {
      responsePayload = payload;
      return originalJson(payload);
    };

    res.on("finish", () => {
      const status = res.statusCode >= 200 && res.statusCode < 400 ? "success" : "failure";
      const responseAdmin = responsePayload?.admin || null;
      const details =
        typeof detailsFactory === "function"
          ? detailsFactory(req, res, responsePayload)
          : detailsFactory || {};
      void logAudit({
        action,
        req,
        status,
        details: {
          ...details,
          statusCode: res.statusCode,
          error: responsePayload?.error,
          code: responsePayload?.code,
        },
        admin: req.admin || responseAdmin,
      });
    });

    next();
  };
}

module.exports = {
  auditLogger,
  logAudit,
  sanitizeValue,
};
