const PinataSDK = require("@pinata/sdk");
const { Readable } = require("stream");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

let pinata;

function getPinata() {
  if (!pinata) {
    pinata = new PinataSDK(
      process.env.PINATA_API_KEY,
      process.env.PINATA_SECRET_KEY
    );
  }
  return pinata;
}

const GATEWAY = process.env.PINATA_GATEWAY || "https://gateway.pinata.cloud/ipfs";
const LOCAL_IPFS_DIR = path.join(__dirname, "../../uploads/ipfs");

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

function toLocalCid(seed) {
  const digest = crypto.createHash("sha256").update(seed).digest("hex");
  return `bafy${digest.slice(0, 56)}`;
}

/**
 * Upload a PDF buffer to IPFS via Pinata.
 * @param {Buffer} buffer - File buffer
 * @param {string} filename - Original filename
 * @returns {Promise<{cid: string, url: string}>}
 */
async function uploadPDFToIPFS(buffer, filename) {
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

  const sdk = getPinata();
  const stream = Readable.from(buffer);
  stream.path = filename; // Pinata requires a path property

  const result = await sdk.pinFileToIPFS(stream, {
    pinataMetadata: { name: filename },
    pinataOptions: { cidVersion: 1 },
  });

  return {
    cid: result.IpfsHash,
    url: `${GATEWAY}/${result.IpfsHash}`,
  };
}

/**
 * Upload JSON metadata to IPFS via Pinata.
 * @param {object} metadata - JSON data
 * @param {string} name - Metadata name
 * @returns {Promise<{cid: string}>}
 */
async function uploadJSONToIPFS(metadata, name) {
  if (!hasPinataCredentials()) {
    ensureLocalIpfsDir();
    const payload = JSON.stringify(metadata ?? {}, null, 2);
    const cid = toLocalCid(`${name}:${payload}`);
    const outputPath = path.join(LOCAL_IPFS_DIR, `${cid}.json`);
    fs.writeFileSync(outputPath, payload, "utf-8");
    return { cid };
  }

  const sdk = getPinata();
  const result = await sdk.pinJSONToIPFS(metadata, {
    pinataMetadata: { name },
  });
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
  const sdk = getPinata();
  await sdk.unpin(cid);
}

module.exports = { uploadPDFToIPFS, uploadJSONToIPFS, unpinFile };
