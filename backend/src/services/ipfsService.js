const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const GATEWAY = process.env.PINATA_GATEWAY || "https://gateway.pinata.cloud/ipfs";
const LOCAL_IPFS_DIR = path.join(__dirname, "../../uploads/ipfs");
const PINATA_API_BASE = "https://api.pinata.cloud/pinning";

function ensureLocalIpfsDir() {
  if (!fs.existsSync(LOCAL_IPFS_DIR)) {
    fs.mkdirSync(LOCAL_IPFS_DIR, { recursive: true });
  }
}

function hasPinataCredentials() {
  const key = String(process.env.PINATA_API_KEY || "").trim();
  const secret = String(process.env.PINATA_SECRET_KEY || "").trim();
  if (!key || !secret) return false;
  if (key.startsWith("test_") || secret.startsWith("test_")) return false;
  return true;
}

function pinataHeaders(extra = {}) {
  return {
    pinata_api_key: process.env.PINATA_API_KEY,
    pinata_secret_api_key: process.env.PINATA_SECRET_KEY,
    ...extra,
  };
}

function toLocalCid(seed) {
  const digest = crypto.createHash("sha256").update(seed).digest("hex");
  return `bafy${digest.slice(0, 56)}`;
}

function sanitizeFilename(filename, fallback) {
  const cleaned = String(filename || "")
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "-")
    .replace(/\s+/g, "-")
    .slice(0, 140);
  return cleaned || fallback;
}

async function parsePinataResponse(response) {
  const text = await response.text();
  let payload;
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { message: text };
  }

  if (!response.ok) {
    const message = payload.error || payload.message || `Pinata request failed with ${response.status}`;
    throw new Error(message);
  }

  if (!payload.IpfsHash) {
    throw new Error("Pinata response did not include IpfsHash");
  }

  return payload;
}

/**
 * Upload a PDF buffer to IPFS via Pinata REST API.
 * Falls back to local deterministic storage when Pinata credentials are absent.
 * @param {Buffer} buffer - File buffer
 * @param {string} filename - Original filename
 * @returns {Promise<{cid: string, url: string}>}
 */
async function uploadPDFToIPFS(buffer, filename) {
  if (!Buffer.isBuffer(buffer)) {
    throw new TypeError("uploadPDFToIPFS expects a Buffer input");
  }

  const safeFilename = sanitizeFilename(filename, "certificate.pdf");

  if (!hasPinataCredentials()) {
    ensureLocalIpfsDir();
    const cid = toLocalCid(buffer);
    const outputPath = path.join(LOCAL_IPFS_DIR, `${cid}.pdf`);
    fs.writeFileSync(outputPath, buffer);
    return {
      cid,
      url: `${GATEWAY}/${cid}`,
    };
  }

  if (typeof fetch !== "function" || typeof FormData === "undefined" || typeof Blob === "undefined") {
    throw new Error("Node 20+ fetch/FormData support is required for Pinata uploads");
  }

  const formData = new FormData();
  formData.append("file", new Blob([buffer], { type: "application/pdf" }), safeFilename);
  formData.append("pinataMetadata", JSON.stringify({ name: safeFilename }));
  formData.append("pinataOptions", JSON.stringify({ cidVersion: 1 }));

  const response = await fetch(`${PINATA_API_BASE}/pinFileToIPFS`, {
    method: "POST",
    headers: pinataHeaders(),
    body: formData,
  });

  const result = await parsePinataResponse(response);
  return {
    cid: result.IpfsHash,
    url: `${GATEWAY}/${result.IpfsHash}`,
  };
}

/**
 * Upload JSON metadata to IPFS via Pinata REST API.
 * @param {object} metadata - JSON data
 * @param {string} name - Metadata name
 * @returns {Promise<{cid: string}>}
 */
async function uploadJSONToIPFS(metadata, name) {
  const safeName = sanitizeFilename(name, "metadata.json");

  if (!hasPinataCredentials()) {
    ensureLocalIpfsDir();
    const payload = JSON.stringify(metadata ?? {}, null, 2);
    const cid = toLocalCid(`${safeName}:${payload}`);
    const outputPath = path.join(LOCAL_IPFS_DIR, `${cid}.json`);
    fs.writeFileSync(outputPath, payload, "utf-8");
    return { cid };
  }

  const response = await fetch(`${PINATA_API_BASE}/pinJSONToIPFS`, {
    method: "POST",
    headers: pinataHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      pinataMetadata: { name: safeName },
      pinataContent: metadata ?? {},
    }),
  });

  const result = await parsePinataResponse(response);
  return { cid: result.IpfsHash };
}

/**
 * Unpin (remove) a file from Pinata.
 * @param {string} cid - CID to unpin
 */
async function unpinFile(cid) {
  if (!hasPinataCredentials()) {
    return;
  }

  const safeCid = String(cid || "").trim();
  if (!safeCid) return;

  const response = await fetch(`${PINATA_API_BASE}/unpin/${encodeURIComponent(safeCid)}`, {
    method: "DELETE",
    headers: pinataHeaders(),
  });

  if (!response.ok && response.status !== 404) {
    const text = await response.text();
    throw new Error(text || `Pinata unpin failed with ${response.status}`);
  }
}

module.exports = { uploadPDFToIPFS, uploadJSONToIPFS, unpinFile };
