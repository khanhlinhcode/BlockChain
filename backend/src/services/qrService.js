const QRCode = require("qrcode");
const fs = require("fs");
const path = require("path");

const QR_DIR = path.join(__dirname, "../../uploads/qr");

function ensureQrDir() {
  if (!fs.existsSync(QR_DIR)) {
    fs.mkdirSync(QR_DIR, { recursive: true });
  }
}

function normalizeBaseUrl(baseUrl) {
  const value = String(baseUrl || process.env.FRONTEND_URL || "http://localhost:3000")
    .trim()
    .replace(/\/+$/, "");
  if (!value) {
    throw new Error("Frontend base URL is required to generate QR code");
  }
  return value;
}

function buildVerifyUrl(certId, baseUrl) {
  const cleanCertId = String(certId || "").trim().toUpperCase();
  if (!cleanCertId) {
    throw new Error("certId is required to generate QR code");
  }
  return `${normalizeBaseUrl(baseUrl)}/verify/${encodeURIComponent(cleanCertId)}`;
}

function qrOptions(extra = {}) {
  return {
    errorCorrectionLevel: "H",
    type: "image/png",
    width: 400,
    margin: 2,
    color: {
      dark: "#000000",
      light: "#FFFFFF",
    },
    ...extra,
  };
}

async function generateQRCode(certId, baseUrl) {
  const cleanCertId = String(certId || "").trim().toUpperCase();
  const verifyUrl = buildVerifyUrl(cleanCertId, baseUrl);
  ensureQrDir();

  const filePath = path.join(QR_DIR, `${cleanCertId}.png`);
  const options = qrOptions();

  if (process.env.NODE_ENV !== "test") {
    console.log(`Generating QR for URL: ${verifyUrl}`);
  }

  const base64 = await QRCode.toDataURL(verifyUrl, options);
  await QRCode.toFile(filePath, verifyUrl, options);

  return {
    base64,
    filePath,
    verifyUrl,
    certId: cleanCertId,
  };
}

async function generateQRCodeBase64(certId, baseUrl) {
  const result = await generateQRCode(certId, baseUrl);
  return result.base64;
}

async function getQRCodePath(certId) {
  const cleanCertId = String(certId || "").trim().toUpperCase();
  const filePath = path.join(QR_DIR, `${cleanCertId}.png`);
  return fs.existsSync(filePath) ? filePath : null;
}

module.exports = {
  generateQRCode,
  generateQRCodeBase64,
  getQRCodePath,
  buildVerifyUrl,
};
