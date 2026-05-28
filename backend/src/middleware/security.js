const helmet = require("helmet");
const mongoSanitize = require("express-mongo-sanitize");
const xssClean = require("xss-clean");
const hpp = require("hpp");
const { validationResult, matchedData, body, param, query } = require("express-validator");

function applySecurityMiddleware(app) {
  app.use(
    helmet({
      frameguard: { action: "deny" },
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
    body("username")
      .isString()
      .withMessage("Tên đăng nhập không hợp lệ")
      .bail()
      .trim()
      .isLength({ min: 1, max: 80 })
      .withMessage("Tên đăng nhập là bắt buộc")
      .escape(),
    body("password")
      .isString()
      .withMessage("Mật khẩu không hợp lệ")
      .bail()
      .isLength({ min: 1, max: 200 })
      .withMessage("Mật khẩu là bắt buộc"),
  ],
  metamaskLogin: [
    body("walletAddress").isEthereumAddress().withMessage("Địa chỉ ví không hợp lệ"),
    body("signature")
      .isString()
      .withMessage("Chữ ký không hợp lệ")
      .bail()
      .isLength({ min: 20, max: 300 })
      .withMessage("Chữ ký không hợp lệ"),
    body("message")
      .isString()
      .withMessage("Thông điệp ký không hợp lệ")
      .bail()
      .isLength({ min: 1, max: 1000 })
      .withMessage("Thông điệp ký không hợp lệ"),
  ],
  wallet: [
    body("address").isEthereumAddress().withMessage("Địa chỉ ví không hợp lệ"),
    body("label")
      .optional({ values: "falsy" })
      .isString()
      .withMessage("Nhãn ví không hợp lệ")
      .bail()
      .trim()
      .isLength({ max: 120 })
      .withMessage("Nhãn ví tối đa 120 ký tự")
      .escape(),
  ],
  walletId: [param("id").isMongoId().withMessage("ID ví không hợp lệ")],
  certificateIssue: [
    body("recipientName")
      .isString()
      .withMessage("Tên người nhận không hợp lệ")
      .bail()
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage("Tên người nhận phải từ 2 đến 100 ký tự")
      .escape(),
    body("recipientEmail")
      .optional({ values: "falsy" })
      .isEmail()
      .withMessage("Email người nhận không hợp lệ")
      .normalizeEmail(),
    body("courseName")
      .isString()
      .withMessage("Tên khóa học không hợp lệ")
      .bail()
      .trim()
      .isLength({ min: 2, max: 200 })
      .withMessage("Tên khóa học phải từ 2 đến 200 ký tự")
      .escape(),
    body("issuingOrg")
      .isString()
      .withMessage("Tên tổ chức không hợp lệ")
      .bail()
      .trim()
      .isLength({ min: 2, max: 200 })
      .withMessage("Tên tổ chức phải từ 2 đến 200 ký tự")
      .escape(),
    body("certId")
      .optional({ values: "falsy" })
      .isString()
      .withMessage("Mã chứng chỉ không hợp lệ")
      .bail()
      .trim()
      .isLength({ min: 3, max: 80 })
      .withMessage("Mã chứng chỉ phải từ 3 đến 80 ký tự"),
  ],
  txHash: [
    body("txHash")
      .exists({ checkFalsy: true })
      .withMessage("Valid txHash is required")
      .bail()
      .isString()
      .withMessage("Valid txHash is required")
      .bail()
      .matches(/^0x[0-9a-fA-F]{64}$/)
      .withMessage("Valid txHash is required"),
  ],
  auditQuery: [
    query("action")
      .optional({ values: "falsy" })
      .isString()
      .withMessage("Loại sự kiện không hợp lệ")
      .bail()
      .trim()
      .isLength({ max: 40 })
      .withMessage("Loại sự kiện không hợp lệ")
      .escape(),
    query("admin")
      .optional({ values: "falsy" })
      .isString()
      .withMessage("Tên admin không hợp lệ")
      .bail()
      .trim()
      .isLength({ max: 80 })
      .withMessage("Tên admin không hợp lệ")
      .escape(),
    query("from").optional({ values: "falsy" }).isISO8601().withMessage("Ngày bắt đầu không hợp lệ"),
    query("to").optional({ values: "falsy" }).isISO8601().withMessage("Ngày kết thúc không hợp lệ"),
    query("page").optional({ values: "falsy" }).isInt({ min: 1, max: 10000 }).withMessage("Trang không hợp lệ"),
    query("limit").optional({ values: "falsy" }).isInt({ min: 1, max: 200 }).withMessage("Giới hạn không hợp lệ"),
  ],
};

module.exports = {
  applySecurityMiddleware,
  validateRequest,
  validators,
};
