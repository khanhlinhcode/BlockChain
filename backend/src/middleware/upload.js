const multer = require("multer");

const storage = multer.memoryStorage();

const fileFilter = (_req, file, cb) => {
  const originalName = String(file.originalname || "").toLowerCase();
  const hasPdfExtension = originalName.endsWith(".pdf");
  const hasPdfMime = file.mimetype === "application/pdf";

  if (hasPdfMime && hasPdfExtension) {
    cb(null, true);
  } else {
    cb(new Error("Only PDF files are allowed"), false);
  }
};

/**
 * Multer upload middleware — PDF only, max 10MB, memory storage.
 */
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

const pdfFieldsUpload = upload.fields([
  { name: "pdfFile", maxCount: 1 },
  { name: "file", maxCount: 1 },
]);

function normalizeUploadedPdf(req, _res, next) {
  if (!req.file && req.files) {
    req.file = req.files.pdfFile?.[0] || req.files.file?.[0];
  }
  next();
}

function handleUploadError(err, _req, res, next) {
  if (!err) return next();

  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res
        .status(400)
        .json({ success: false, error: "File too large. Maximum 10MB allowed." });
    }
    return res.status(400).json({ success: false, error: err.message });
  }

  if (err.message === "Only PDF files are allowed") {
    return res.status(400).json({ success: false, error: err.message });
  }

  return next(err);
}

module.exports = {
  upload,
  uploadPdfField: [pdfFieldsUpload, normalizeUploadedPdf],
  handleUploadError,
};
