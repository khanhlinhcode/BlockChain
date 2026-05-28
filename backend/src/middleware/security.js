const helmet = require("helmet");
const mongoSanitize = require("express-mongo-sanitize");
const xssClean = require("xss-clean");
const hpp = require("hpp");
const { validationResult, matchedData, body, param, query } = require("express-validator");

function applySecurityMiddleware(app) {
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
    })
  );
  app.use(mongoSanitize({ replaceWith: "_" }));
  app.use(xssClean());
  app.use(hpp());
}

function validateRequest(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const first = errors.array()[0];
    return res.status(400).json({
      success: false,
      error: first?.msg || "Invalid request input",
      code: "VALIDATION_ERROR",
      details: errors.array().map((error) => ({
        field: error.path,
        message: error.msg,
      })),
    });
  }

  req.validated = matchedData(req, { locations: ["body", "params", "query"], includeOptionals: false });
  return next();
}

const validators = {
  login: [
    body("username").isString().trim().isLength({ min: 1, max: 80 }).escape(),
    body("password").isString().isLength({ min: 1, max: 200 }),
  ],
  metamaskLogin: [
    body("walletAddress").isEthereumAddress(),
    body("signature").isString().isLength({ min: 20, max: 300 }),
    body("message").isString().isLength({ min: 1, max: 1000 }),
  ],
  wallet: [
    body("address").isEthereumAddress(),
    body("label").optional({ values: "falsy" }).isString().trim().isLength({ max: 120 }).escape(),
  ],
  walletId: [param("id").isMongoId()],
  certificateIssue: [
    body("recipientName").isString().trim().isLength({ min: 2, max: 100 }).escape(),
    body("recipientEmail").optional({ values: "falsy" }).isEmail().normalizeEmail(),
    body("courseName").isString().trim().isLength({ min: 2, max: 200 }).escape(),
    body("issuingOrg").isString().trim().isLength({ min: 2, max: 200 }).escape(),
    body("certId").optional({ values: "falsy" }).isString().trim().isLength({ min: 3, max: 80 }),
  ],
  txHash: [body("txHash").isString().matches(/^0x[0-9a-fA-F]{64}$/).withMessage("Valid txHash is required")],
  auditQuery: [
    query("action").optional({ values: "falsy" }).isString().trim().isLength({ max: 40 }).escape(),
    query("admin").optional({ values: "falsy" }).isString().trim().isLength({ max: 80 }).escape(),
    query("from").optional({ values: "falsy" }).isISO8601(),
    query("to").optional({ values: "falsy" }).isISO8601(),
    query("page").optional({ values: "falsy" }).isInt({ min: 1, max: 10000 }),
    query("limit").optional({ values: "falsy" }).isInt({ min: 1, max: 200 }),
  ],
};

module.exports = {
  applySecurityMiddleware,
  validateRequest,
  validators,
};
