const router = require("express").Router();
const AuditLog = require("../models/AuditLog");
const { verifyJWT, requireSuperAdmin } = require("../middleware/auth");
const { validateRequest, validators } = require("../middleware/security");

router.use(verifyJWT, requireSuperAdmin);

router.get("/", validators.auditQuery, validateRequest, async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const filter = {};

    if (req.query.action && req.query.action !== "all") {
      filter.action = String(req.query.action).toUpperCase();
    }
    if (req.query.admin) {
      filter.adminUsername = { $regex: String(req.query.admin).trim(), $options: "i" };
    }
    if (req.query.from || req.query.to) {
      filter.createdAt = {};
      if (req.query.from) filter.createdAt.$gte = new Date(req.query.from);
      if (req.query.to) {
        const to = new Date(req.query.to);
        to.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = to;
      }
    }

    const [logs, total] = await Promise.all([
      AuditLog.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      AuditLog.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      logs,
      total,
      page,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      limit,
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
