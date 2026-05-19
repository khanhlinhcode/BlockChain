const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");
const fallbackAbi = require("../config/contractAbi");

const ABI_PATH_CANDIDATES = [
  path.join(__dirname, "../../../smart-contract/artifacts/contracts/CertRegistry.sol/CertRegistry.json"),
  path.join(__dirname, "../abi/CertRegistry.json"),
];

let provider = null;
let signer = null;
let signerAddress = null;
let contract = null;
let initPromise = null;

function loadContractArtifact() {
  for (const artifactPath of ABI_PATH_CANDIDATES) {
    if (!fs.existsSync(artifactPath)) {
      continue;
    }

    try {
      const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf-8"));
      if (Array.isArray(artifact.abi)) {
        return {
          abi: artifact.abi,
          bytecode: artifact.bytecode || artifact?.deployedBytecode?.object || null,
          source: artifactPath,
        };
      }
    } catch (error) {
      console.warn(
        `⚠️  Failed to parse contract artifact at ${artifactPath}: ${error.message}`
      );
    }
  }

  return {
    abi: fallbackAbi,
    bytecode: null,
    source: "fallback",
  };
}

function normalizeHash(hash) {
  if (typeof hash !== "string" || !hash.trim()) {
    throw new TypeError("Certificate hash must be a non-empty string");
  }

  const clean = hash.startsWith("0x") ? hash.slice(2) : hash;
  if (!/^[0-9a-fA-F]{64}$/.test(clean)) {
    throw new Error(`Invalid certificate hash format: expected 64 hex chars, got ${clean.length}`);
  }

  return `0x${clean.toLowerCase()}`;
}

function normalizePrivateKey(privateKey) {
  if (!privateKey) return null;
  const trimmed = String(privateKey).trim();
  if (!trimmed) return null;
  return trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;
}

async function buildClient({ rpcUrl, privateKey, contractAddress }) {
  const selectedRpcUrl = rpcUrl || process.env.ALCHEMY_URL || "http://127.0.0.1:8545";
  const selectedAddress = contractAddress || process.env.CONTRACT_ADDRESS;

  if (!selectedAddress || !ethers.isAddress(selectedAddress)) {
    throw new Error("CONTRACT_ADDRESS is missing or invalid");
  }

  const p = new ethers.JsonRpcProvider(selectedRpcUrl);

  try {
    let s;
    if (privateKey) {
      const wallet = new ethers.Wallet(normalizePrivateKey(privateKey), p);
      s = new ethers.NonceManager(wallet);
    } else {
      s = await p.getSigner();
    }

    const sAddress = s.address || (await s.getAddress());
    const artifact = loadContractArtifact();
    const c = new ethers.Contract(selectedAddress, artifact.abi, s);

    return {
      provider: p,
      signer: s,
      signerAddress: sAddress,
      contract: c,
      abi: artifact.abi,
      bytecode: artifact.bytecode,
      artifactSource: artifact.source,
    };
  } catch (error) {
    try {
      if (typeof p.destroy === "function") {
        p.destroy();
      }
    } catch {
      // no-op
    }
    throw error;
  }
}

async function initDefaultClient() {
  if (contract) {
    return;
  }

  if (initPromise) {
    await initPromise;
    return;
  }

  initPromise = (async () => {
    const client = await buildClient({
      rpcUrl: process.env.ALCHEMY_URL || "http://127.0.0.1:8545",
      privateKey: normalizePrivateKey(process.env.ADMIN_PRIVATE_KEY),
      contractAddress: process.env.CONTRACT_ADDRESS,
    });

    provider = client.provider;
    signer = client.signer;
    signerAddress = client.signerAddress;
    contract = client.contract;
  })();

  try {
    await initPromise;
  } finally {
    initPromise = null;
  }
}

async function getContract() {
  await initDefaultClient();
  return contract;
}

async function getProvider() {
  await initDefaultClient();
  return provider;
}

function resetDefaultClient() {
  try {
    if (provider && typeof provider.destroy === "function") {
      provider.destroy();
    }
  } catch {
    // Ignore cleanup errors; the next request will build a fresh client.
  }

  provider = null;
  signer = null;
  signerAddress = null;
  contract = null;
  initPromise = null;
}

async function waitForSuccess(tx) {
  const receipt = await tx.wait(1);
  if (!receipt) {
    throw new Error("Transaction receipt is null");
  }
  if (receipt.status !== 1) {
    throw new Error(`Transaction failed: ${tx.hash}`);
  }
  return receipt;
}

/**
 * Issue a certificate on-chain.
 * @returns {Promise<{txHash: string, blockNumber: number, gasUsed: string}>}
 */
async function issueCertOnChain(certHash, certId, ipfsCID, recipientName, courseName, issuingOrg) {
  const c = await getContract();
  const normalizedHash = normalizeHash(certHash);

  const tx = await c.issueCertificate(
    normalizedHash,
    certId,
    ipfsCID,
    recipientName,
    courseName,
    issuingOrg
  );
  const receipt = await waitForSuccess(tx);

  return {
    txHash: tx.hash,
    blockNumber: receipt.blockNumber,
    gasUsed: receipt.gasUsed.toString(),
  };
}

function mapCertificate(raw) {
  return {
    certHash: raw.certHash,
    issuer: raw.issuer,
    revokedBy: raw.revokedBy,
    issuedAt: Number(raw.issuedAt),
    revokedAt: Number(raw.revokedAt),
    isRevoked: raw.isRevoked,
    ipfsCID: raw.ipfsCID,
    recipientName: raw.recipientName,
    certId: raw.certId,
    courseName: raw.courseName,
    issuingOrg: raw.issuingOrg,
  };
}

async function getCertOnChain(certHash) {
  const c = await getContract();
  const cert = await c.getCertificate(normalizeHash(certHash));
  return mapCertificate(cert);
}

/**
 * Verify a certificate on-chain.
 * @returns {Promise<{exists: boolean, isValid: boolean, isRevoked: boolean, cert: object|null}>}
 */
async function verifyCertOnChain(certHash) {
  const c = await getContract();
  const normalizedHash = normalizeHash(certHash);

  try {
    const cert = await c.getCertificate(normalizedHash);
    const mapped = mapCertificate(cert);
    return {
      exists: true,
      isValid: !mapped.isRevoked,
      isRevoked: mapped.isRevoked,
      cert: mapped,
    };
  } catch (error) {
    if (ethers.isError(error, "CALL_EXCEPTION")) {
      return {
        exists: false,
        isValid: false,
        isRevoked: false,
        cert: null,
      };
    }
    throw error;
  }
}

/**
 * Revoke a certificate on-chain.
 * @returns {Promise<{txHash: string, blockNumber: number, gasUsed: string}>}
 */
async function revokeCertOnChain(certHash, reason) {
  const c = await getContract();
  const normalizedHash = normalizeHash(certHash);

  const tx = await c.revokeCertificate(normalizedHash, reason || "Revoked by admin");
  const receipt = await waitForSuccess(tx);

  return {
    txHash: tx.hash,
    blockNumber: receipt.blockNumber,
    gasUsed: receipt.gasUsed.toString(),
  };
}

/**
 * Get contract-level statistics.
 * @returns {Promise<{totalOnChain: number}>}
 */
async function getContractStats() {
  const c = await getContract();
  const total = await c.getTotalCertificates();
  return { totalOnChain: Number(total) };
}

function toNumber(value, fallback = 0) {
  try {
    return Number(value ?? fallback);
  } catch {
    return fallback;
  }
}

function toDate(value) {
  if (value === null || value === undefined) return null;
  const numeric = toNumber(value, NaN);
  if (Number.isFinite(numeric) && numeric > 0) {
    return new Date(numeric * 1000);
  }

  const date = new Date(value);
  if (!Number.isNaN(date.getTime())) return date;
  return null;
}

function normalizeEventType(eventType) {
  if (eventType === "issued" || eventType === "revoked" || eventType === "verified") {
    return eventType;
  }
  return "all";
}

function parseDateFilter(value, endOfDay = false) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    if (endOfDay) {
      date.setHours(23, 59, 59, 999);
    } else {
      date.setHours(0, 0, 0, 0);
    }
  }

  return date;
}

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return parsed;
}

function toBlockTimestampMs(block) {
  if (!block || block.timestamp === undefined || block.timestamp === null) {
    return null;
  }
  return Number(block.timestamp) * 1000;
}

async function findFirstBlockAtOrAfter(targetMs, latestBlock) {
  let low = 0;
  let high = latestBlock;
  let result = latestBlock;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    // eslint-disable-next-line no-await-in-loop
    const block = await provider.getBlock(mid);
    const timestampMs = toBlockTimestampMs(block);
    if (!timestampMs) break;

    if (timestampMs >= targetMs) {
      result = mid;
      high = mid - 1;
    } else {
      low = mid + 1;
    }
  }

  return result;
}

async function findLastBlockAtOrBefore(targetMs, latestBlock) {
  let low = 0;
  let high = latestBlock;
  let result = 0;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    // eslint-disable-next-line no-await-in-loop
    const block = await provider.getBlock(mid);
    const timestampMs = toBlockTimestampMs(block);
    if (!timestampMs) break;

    if (timestampMs <= targetMs) {
      result = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return result;
}

function parseSuggestedLogWindow(message) {
  if (!message) return null;

  const blocksMatch = message.match(/up to a\s+(\d+)\s+block range/i);
  if (blocksMatch) {
    const blocks = Number.parseInt(blocksMatch[1], 10);
    if (Number.isFinite(blocks) && blocks > 0) return blocks;
  }

  const suggestedRange = message.match(/\[(0x[0-9a-fA-F]+),\s*(0x[0-9a-fA-F]+)\]/);
  if (suggestedRange) {
    try {
      const from = Number(BigInt(suggestedRange[1]));
      const to = Number(BigInt(suggestedRange[2]));
      const count = to - from + 1;
      if (Number.isFinite(count) && count > 0) return count;
    } catch {
      return null;
    }
  }

  return null;
}

function isLogRangeLimitError(error) {
  const message = `${error?.message || ""} ${error?.shortMessage || ""}`.toLowerCase();
  return (
    message.includes("eth_getlogs") &&
    (message.includes("block range") ||
      message.includes("too wide") ||
      message.includes("free tier"))
  );
}

function isRpcRateLimitError(error) {
  const message = `${error?.message || ""} ${error?.shortMessage || ""}`.toLowerCase();
  return (
    message.includes("compute units per second capacity") ||
    message.includes("\"code\": 429") ||
    message.includes("rate limit")
  );
}

function isRpcUnavailableError(error) {
  const message = `${error?.message || ""} ${error?.shortMessage || ""} ${error?.code || ""}`.toLowerCase();
  return (
    message.includes("econnrefused") ||
    message.includes("failed to detect network") ||
    message.includes("network is unreachable") ||
    message.includes("network is unavailable") ||
    message.includes("could not connect") ||
    message.includes("socket hang up") ||
    message.includes("timeout") ||
    error?.code === "ECONNREFUSED"
  );
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function queryFilterInChunks(contractInstance, eventFilter, fromBlock, toBlock, windowSize) {
  if (fromBlock > toBlock) return [];

  const allEvents = [];
  let cursor = fromBlock;
  let currentWindow = Math.max(1, windowSize);
  let rateLimitRetries = 0;

  while (cursor <= toBlock) {
    const chunkEnd = Math.min(cursor + currentWindow - 1, toBlock);
    try {
      // eslint-disable-next-line no-await-in-loop
      const chunkEvents = await contractInstance.queryFilter(eventFilter, cursor, chunkEnd);
      allEvents.push(...chunkEvents);
      cursor = chunkEnd + 1;
      rateLimitRetries = 0;
    } catch (error) {
      if (isRpcRateLimitError(error)) {
        if (rateLimitRetries >= 6) {
          throw error;
        }
        // Backoff when provider throttles CU/s.
        // eslint-disable-next-line no-await-in-loop
        await sleep(250 * (rateLimitRetries + 1));
        rateLimitRetries += 1;
        continue;
      }

      if (!isLogRangeLimitError(error)) {
        throw error;
      }

      const message = `${error?.message || ""} ${error?.shortMessage || ""}`;
      const suggestedWindow = parseSuggestedLogWindow(message);

      if (suggestedWindow && suggestedWindow < currentWindow) {
        currentWindow = Math.max(1, suggestedWindow);
        continue;
      }

      if (currentWindow > 1) {
        currentWindow = Math.max(1, Math.floor(currentWindow / 2));
        continue;
      }

      throw error;
    }
  }

  return allEvents;
}

/**
 * Read audit events from the contract logs.
 * @param {{eventType?: "all"|"issued"|"revoked"|"verified", from?: string, to?: string, limit?: number}} filters
 * @returns {Promise<Array<{eventType: string, certId: string, certHash: string, actor: string, timestamp: string, txHash: string, blockNumber: number}>>}
 */
async function getAuditEvents(filters = {}) {
  const c = await getContract();
  const selectedType = normalizeEventType(filters.eventType);
  const limit = Math.min(500, Math.max(1, parseInt(filters.limit, 10) || 100));

  const includeIssued = selectedType === "all" || selectedType === "issued";
  const includeRevoked = selectedType === "all" || selectedType === "revoked";
  const includeVerified = selectedType === "all" || selectedType === "verified";

  const fromDateFilter = parseDateFilter(filters.from, false);
  const toDateFilter = parseDateFilter(filters.to, true);

  if (filters.from && !fromDateFilter) {
    throw new Error("Invalid from date");
  }
  if (filters.to && !toDateFilter) {
    throw new Error("Invalid to date");
  }

  const latestBlock = await provider.getBlockNumber();
  const configuredStartBlock = parsePositiveInt(process.env.CONTRACT_DEPLOY_BLOCK, -1);
  const fallbackLookback = Math.max(
    100,
    parsePositiveInt(process.env.AUDIT_LOOKBACK_BLOCKS, 300)
  );
  const defaultFromBlock =
    configuredStartBlock >= 0
      ? configuredStartBlock
      : Math.max(0, latestBlock - fallbackLookback);

  let fromBlock = defaultFromBlock;
  let toBlock = latestBlock;

  if (fromDateFilter) {
    fromBlock = await findFirstBlockAtOrAfter(fromDateFilter.getTime(), latestBlock);
  }
  if (toDateFilter) {
    toBlock = await findLastBlockAtOrBefore(toDateFilter.getTime(), latestBlock);
  }

  if (fromBlock > toBlock) {
    return [];
  }

  const initialWindow = Math.max(
    1,
    parsePositiveInt(process.env.AUDIT_LOG_BLOCK_WINDOW, 10)
  );

  const eventGroups = [];
  if (includeIssued) {
    eventGroups.push(
      await queryFilterInChunks(c, c.filters.CertIssued(), fromBlock, toBlock, initialWindow)
    );
  }
  if (includeRevoked) {
    eventGroups.push(
      await queryFilterInChunks(c, c.filters.CertRevoked(), fromBlock, toBlock, initialWindow)
    );
  }
  if (includeVerified) {
    eventGroups.push(
      await queryFilterInChunks(c, c.filters.CertVerified(), fromBlock, toBlock, initialWindow)
    );
  }

  const events = eventGroups.flat();
  const blockTimestampCache = new Map();

  async function getBlockTimestamp(blockNumber) {
    if (!Number.isFinite(blockNumber)) return null;
    if (blockTimestampCache.has(blockNumber)) {
      return blockTimestampCache.get(blockNumber);
    }
    try {
      const block = await provider.getBlock(blockNumber);
      const date = block?.timestamp ? new Date(block.timestamp * 1000) : null;
      blockTimestampCache.set(blockNumber, date);
      return date;
    } catch {
      blockTimestampCache.set(blockNumber, null);
      return null;
    }
  }

  const normalized = await Promise.all(
    events.map(async (event) => {
      const eventName = event.fragment?.name || event.eventName;
      const args = event.args || {};
      const blockNumber = toNumber(event.log?.blockNumber, toNumber(event.blockNumber, 0));

      let eventType = "verified";
      let certId = "";
      let actor = "";
      let timestamp = null;

      if (eventName === "CertIssued") {
        eventType = "issued";
        certId = args.certId || "";
        actor = args.issuer || "";
        timestamp = toDate(args.issuedAt);
      } else if (eventName === "CertRevoked") {
        eventType = "revoked";
        actor = args.revoker || "";
        timestamp = toDate(args.revokedAt);
      } else {
        eventType = "verified";
        actor = args.verifier || "";
        timestamp = toDate(args.verifiedAt);
      }

      if (!timestamp) {
        timestamp = await getBlockTimestamp(blockNumber);
      }
      if (!timestamp) {
        timestamp = new Date(0);
      }

      return {
        eventType,
        certId,
        certHash: args.certHash || "",
        actor,
        timestamp: timestamp.toISOString(),
        txHash: event.log?.transactionHash || event.transactionHash || "",
        blockNumber,
      };
    })
  );

  const filteredByDate = normalized.filter((item) => {
    const ts = new Date(item.timestamp).getTime();
    if (fromDateFilter && ts < fromDateFilter.getTime()) return false;
    if (toDateFilter && ts > toDateFilter.getTime()) return false;
    return true;
  });

  filteredByDate.sort((a, b) => {
    const byTime = new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    if (byTime !== 0) return byTime;
    return b.blockNumber - a.blockNumber;
  });

  return filteredByDate.slice(0, limit);
}

/**
 * Check if an address is an admin on-chain.
 */
async function isAdminOnChain(address) {
  const c = await getContract();
  return c.isAdmin(address);
}

/**
 * Get signer address for the configured blockchain client.
 */
function getSignerAddress() {
  return signerAddress;
}

/**
 * End-to-end test against local Hardhat node (http://localhost:8545).
 * It deploys a temporary CertRegistry (if needed), then issue -> verify -> revoke -> verify.
 */
async function testBlockchainService() {
  const logs = [];
  let localProvider = null;
  const push = (label, ok, details = "") => {
    const line = `${ok ? "PASS" : "FAIL"}: ${label}${details ? ` - ${details}` : ""}`;
    logs.push(line);
    if (process.env.NODE_ENV !== "production") {
      console.log(line);
    }
  };

  try {
    const localRpc = "http://127.0.0.1:8545";
    const artifact = loadContractArtifact();

    if (!artifact.bytecode) {
      throw new Error("Contract bytecode not found in artifact; run smart-contract compile first");
    }

    let localAddress = process.env.CONTRACT_ADDRESS;
    let deployClient = null;

    if (!process.env.ADMIN_PRIVATE_KEY) {
      const p = new ethers.JsonRpcProvider(localRpc);
      const s = await p.getSigner();
      deployClient = {
        provider: p,
        signer: s,
        signerAddress: s.address || (await s.getAddress()),
        contract: null,
        abi: artifact.abi,
        bytecode: artifact.bytecode,
        artifactSource: artifact.source,
      };
    } else {
      const p = new ethers.JsonRpcProvider(localRpc);
      const s = new ethers.Wallet(normalizePrivateKey(process.env.ADMIN_PRIVATE_KEY), p);
      deployClient = {
        provider: p,
        signer: s,
        signerAddress: s.address,
        contract: null,
        abi: artifact.abi,
        bytecode: artifact.bytecode,
        artifactSource: artifact.source,
      };
    }

    localProvider = deployClient.provider;

    if (!localAddress || !ethers.isAddress(localAddress)) {
      const factory = new ethers.ContractFactory(
        artifact.abi,
        artifact.bytecode,
        deployClient.signer
      );
      const deployed = await factory.deploy();
      await deployed.waitForDeployment();
      localAddress = await deployed.getAddress();
      push("Deploy test CertRegistry", true, `address=${localAddress}`);
    } else {
      push("Use existing contract", true, `address=${localAddress}`);
    }

    const testContract = new ethers.Contract(localAddress, artifact.abi, deployClient.signer);
    const certHash = normalizeHash(
      ethers.sha256(ethers.toUtf8Bytes("fake pdf content for testing"))
    );
    const certId = "CERT-TEST-001";
    const ipfsCID = "QmTestCid123";
    const recipientName = "Test User";
    const courseName = "Test Course";
    const issuingOrg = "Test Org";

    // 1) Issue
    try {
      const tx = await testContract.issueCertificate(
        certHash,
        certId,
        ipfsCID,
        recipientName,
        courseName,
        issuingOrg
      );
      const receipt = await waitForSuccess(tx);
      push("Issue certificate", receipt.status === 1, `tx=${tx.hash}`);
    } catch (error) {
      push("Issue certificate", false, error.message);
      throw error;
    }

    // 2) Verify exists
    try {
      const cert = await testContract.getCertificate(certHash);
      const exists = cert.certId === certId;
      push("Verify certificate exists", exists, `certId=${cert.certId}`);
      if (!exists) {
        throw new Error("Issued certificate data mismatch");
      }
    } catch (error) {
      push("Verify certificate exists", false, error.message);
      throw error;
    }

    // 3) Revoke
    try {
      const tx = await testContract.revokeCertificate(certHash, "Test revocation");
      const receipt = await waitForSuccess(tx);
      push("Revoke certificate", receipt.status === 1, `tx=${tx.hash}`);
    } catch (error) {
      push("Revoke certificate", false, error.message);
      throw error;
    }

    // 4) Verify revoked
    try {
      const cert = await testContract.getCertificate(certHash);
      push("Verify certificate is revoked", cert.isRevoked === true, `isRevoked=${cert.isRevoked}`);
    } catch (error) {
      push("Verify certificate is revoked", false, error.message);
      throw error;
    }

    return { ok: true, logs };
  } catch (error) {
    push("testBlockchainService", false, error.message);
    return { ok: false, logs, error: error.message };
  } finally {
    try {
      if (localProvider && typeof localProvider.destroy === "function") {
        localProvider.destroy();
      }
    } catch {
      // no-op
    }
  }
}

module.exports = {
  getProvider,
  getContract,
  getCertOnChain,
  issueCertOnChain,
  verifyCertOnChain,
  revokeCertOnChain,
  getContractStats,
  getAuditEvents,
  isAdminOnChain,
  getSignerAddress,
  testBlockchainService,
  normalizeHash,
  isRpcUnavailableError,
  resetDefaultClient,
};
