const QRCode = require("qrcode");
const fs = require("fs");
const os = require("os");
const path = require("path");

const QR_DIR = path.join(__dirname, "../../uploads/qr");

function ensureQrDir() {
  if (!fs.existsSync(QR_DIR)) {
    fs.mkdirSync(QR_DIR, { recursive: true });
  }
}

function firstLanFrontendUrl() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === "IPv4" && !iface.internal) {
        return `http://${iface.address}:3000`;
      }
    }
  }
  return "";
}

function isLocalhostUrl(value) {
  return /localhost|127\.0\.0\.1|0\.0\.0\.0|\[?::1\]?/i.test(String(value || ""));
}

function normalizeBaseUrl(baseUrl) {
  const prodUrl = process.env.NEXT_PUBLIC_FRONTEND_URL || process.env.PUBLIC_FRONTEND_URL;
  const frontendUrl = process.env.FRONTEND_URL;
  const selected =
    (prodUrl && !isLocalhostUrl(prodUrl) ? prodUrl : "") ||
    (frontendUrl && !isLocalhostUrl(frontendUrl) ? frontendUrl : "") ||
    (baseUrl && !isLocalhostUrl(baseUrl) ? baseUrl : "") ||
    firstLanFrontendUrl() ||
    baseUrl ||
    frontendUrl ||
    "http://localhost:3000";

  const value = String(selected)
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
