const QRCode = require("qrcode");
const fs = require("fs");
const path = require("path");

// Ensure uploads/qr directory exists
const QR_DIR = path.join(__dirname, "../../uploads/qr");
if (!fs.existsSync(QR_DIR)) {
  fs.mkdirSync(QR_DIR, { recursive: true });
}

/**
 * Generate a QR code encoding the verification URL.
 * Saves as PNG to /uploads/qr/{certId}.png and returns base64 string.
 * @param {string} certId - Certificate ID
 * @param {string} baseUrl - Frontend base URL
 * @returns {Promise<string>} Base64 PNG data URL
 */
async function generateQRCode(certId, baseUrl) {
  const verifyUrl = `${baseUrl}/verify/${certId}`;
  const filePath = path.join(QR_DIR, `${certId}.png`);

  const options = {
    type: "png",
    width: 400,
    margin: 2,
    color: { dark: "#000000", light: "#ffffff" },
    errorCorrectionLevel: "H",
  };

  // Save to file
  await QRCode.toFile(filePath, verifyUrl, options);

  // Also return as base64 data URL
  const dataUrl = await QRCode.toDataURL(verifyUrl, options);
  return dataUrl;
}

/**
 * Get the file path of a saved QR code.
 * @param {string} certId
 * @returns {Promise<string|null>} File path or null if not found
 */
async function getQRCodePath(certId) {
  const filePath = path.join(QR_DIR, `${certId}.png`);
  if (fs.existsSync(filePath)) return filePath;
  return null;
}

module.exports = { generateQRCode, getQRCodePath };
