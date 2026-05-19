"use client";

import { useCallback, useState } from "react";
import { ethers } from "ethers";
import CertRegistryABI from "@/lib/abi/CertRegistry.json";
import { CHAIN_ID, CONTRACT_ADDRESS, IPFS_GATEWAY, SUPPORTED_CHAINS } from "@/lib/constants";
import { calculateFileHash } from "@/lib/utils";
import type { Certificate, VerifyResult } from "@/types";

type EthereumProvider = ethers.Eip1193Provider & {
  request?: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

type ContractCertificate = {
  certHash?: string;
  issuer?: string;
  revokedBy?: string;
  issuedAt?: bigint | number | string;
  revokedAt?: bigint | number | string;
  isRevoked?: boolean;
  ipfsCID?: string;
  recipientName?: string;
  certId?: string;
  courseName?: string;
  issuingOrg?: string;
};

const ALCHEMY_KEY = process.env.NEXT_PUBLIC_ALCHEMY_KEY;
const RPC_URL =
  process.env.NEXT_PUBLIC_RPC_URL ||
  (CHAIN_ID === 11155111 && ALCHEMY_KEY
    ? `https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_KEY}`
    : undefined) ||
  SUPPORTED_CHAINS[CHAIN_ID]?.rpcUrl ||
  "https://rpc.sepolia.org";

function getEthereum(): EthereumProvider | null {
  if (typeof window === "undefined") return null;
  return (window as Window & { ethereum?: EthereumProvider }).ethereum ?? null;
}

function asNumber(value: unknown): number {
  try {
    return Number(value ?? 0);
  } catch {
    return 0;
  }
}

function notFound(): VerifyResult {
  return {
    exists: false,
    isValid: false,
    isRevoked: false,
    verifiedAt: new Date().toISOString(),
    source: "blockchain",
  };
}

function ipfsUrl(cid: string): string {
  return cid ? `${IPFS_GATEWAY.replace(/\/$/, "")}/${cid}` : "";
}

function mapCertificate(raw: ContractCertificate, fallbackHash = ""): Certificate {
  const issuedAt = asNumber(raw.issuedAt);
  const revokedAt = asNumber(raw.revokedAt);
  const now = new Date().toISOString();
  const certId = String(raw.certId || "");
  const certHash = String(raw.certHash || fallbackHash || "");
  const ipfsCID = String(raw.ipfsCID || "");

  return {
    _id: certId || certHash,
    certId,
    certHash,
    ipfsCID,
    ipfsUrl: ipfsUrl(ipfsCID),
    recipientName: String(raw.recipientName || ""),
    courseName: String(raw.courseName || ""),
    issuingOrg: String(raw.issuingOrg || ""),
    issuerAddress: String(raw.issuer || ""),
    issuedAt: issuedAt > 0 ? new Date(issuedAt * 1000).toISOString() : now,
    isRevoked: Boolean(raw.isRevoked),
    revokedAt: revokedAt > 0 ? new Date(revokedAt * 1000).toISOString() : undefined,
    revokedBy: raw.revokedBy ? String(raw.revokedBy) : undefined,
    txHash: "",
    blockNumber: 0,
    qrCodeUrl: undefined,
    verificationCount: 0,
    createdAt: now,
    updatedAt: now,
    status: raw.isRevoked ? "revoked" : "active",
  };
}

function buildResult(cert: ContractCertificate, fallbackHash = ""): VerifyResult {
  const issuedAt = asNumber(cert.issuedAt);
  if (!cert || issuedAt === 0 || !cert.certId) return notFound();

  const certificate = mapCertificate(cert, fallbackHash);
  return {
    exists: true,
    isValid: !certificate.isRevoked,
    isRevoked: certificate.isRevoked,
    certificate,
    verifiedAt: new Date().toISOString(),
    source: "blockchain",
    blockchain: {
      certHash: certificate.certHash,
      ipfsCID: certificate.ipfsCID,
      issuer: certificate.issuerAddress,
      issuedAt,
      isRevoked: certificate.isRevoked,
      recipientName: certificate.recipientName,
      certId: certificate.certId,
      courseName: certificate.courseName,
      issuingOrg: certificate.issuingOrg,
      revokedAt: asNumber(cert.revokedAt) || undefined,
      revokedBy: cert.revokedBy ? String(cert.revokedBy) : undefined,
    },
  };
}

export function normalizeDirectVerifyError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err || "");
  const lower = msg.toLowerCase();

  if (lower.includes("contract_address") || lower.includes("contract address")) {
    return "Chưa cấu hình địa chỉ smart contract. Kiểm tra NEXT_PUBLIC_CONTRACT_ADDRESS.";
  }
  if (lower.includes("network") || lower.includes("could not detect") || lower.includes("failed to fetch")) {
    return "Không thể kết nối blockchain. Kiểm tra RPC/network và thử lại.";
  }
  return "Xác thực thất bại. Vui lòng thử lại.";
}

export function useVerify() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState("");

  const getProvider = useCallback(async () => {
    const ethereum = getEthereum();
    if (ethereum) {
      try {
        const browserProvider = new ethers.BrowserProvider(ethereum);
        const network = await browserProvider.getNetwork();
        if (Number(network.chainId) === CHAIN_ID) {
          return browserProvider;
        }
      } catch {
        // Fall back to configured read-only RPC below.
      }
    }

    return new ethers.JsonRpcProvider(RPC_URL, CHAIN_ID);
  }, []);

  const getContract = useCallback(async () => {
    if (!CONTRACT_ADDRESS || !ethers.isAddress(CONTRACT_ADDRESS)) {
      throw new Error("CONTRACT_ADDRESS is missing or invalid");
    }
    const provider = await getProvider();
    return new ethers.Contract(CONTRACT_ADDRESS, CertRegistryABI, provider);
  }, [getProvider]);

  const verifyById = useCallback(
    async (certId: string): Promise<VerifyResult | null> => {
      const normalizedId = certId.trim().toUpperCase();
      if (!normalizedId) {
        setError("Vui lòng nhập mã chứng chỉ.");
        return null;
      }

      setLoading(true);
      setError(null);
      setResult(null);

      try {
        setCurrentStep("Kết nối blockchain...");
        const contract = await getContract();

        setCurrentStep("Truy vấn smart contract...");
        const cert = (await contract.getCertificateById(normalizedId)) as ContractCertificate;

        setCurrentStep("Xác thực kết quả...");
        const data = buildResult(cert);
        setResult(data);
        return data;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err || "");
        if (msg.toLowerCase().includes("certificate not found")) {
          const data = notFound();
          setResult(data);
          return data;
        }

        const friendly = normalizeDirectVerifyError(err);
        setError(friendly);
        return null;
      } finally {
        setLoading(false);
        setCurrentStep("");
      }
    },
    [getContract]
  );

  const verifyByFile = useCallback(
    async (file: File): Promise<VerifyResult | null> => {
      setLoading(true);
      setError(null);
      setResult(null);

      try {
        setCurrentStep("Tính toán hash tài liệu...");
        const hexHash = await calculateFileHash(file);
        const bytes32Hash = `0x${hexHash}`;

        setCurrentStep("Truy vấn smart contract...");
        const contract = await getContract();
        const cert = (await contract.getCertificate(bytes32Hash)) as ContractCertificate;

        setCurrentStep("Xác thực kết quả...");
        const data = buildResult(cert, bytes32Hash);
        setResult(data);
        return data;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err || "");
        if (msg.toLowerCase().includes("certificate not found")) {
          const data = notFound();
          setResult(data);
          return data;
        }

        const friendly = normalizeDirectVerifyError(err);
        setError(friendly);
        return null;
      } finally {
        setLoading(false);
        setCurrentStep("");
      }
    },
    [getContract]
  );

  const verifyByHash = useCallback(
    async (certHash: string): Promise<VerifyResult | null> => {
      const clean = certHash.startsWith("0x") ? certHash : `0x${certHash}`;
      setLoading(true);
      setError(null);
      setResult(null);

      try {
        setCurrentStep("Truy vấn smart contract...");
        const contract = await getContract();
        const cert = (await contract.getCertificate(clean)) as ContractCertificate;
        const data = buildResult(cert, clean);
        setResult(data);
        return data;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err || "");
        if (msg.toLowerCase().includes("certificate not found")) {
          const data = notFound();
          setResult(data);
          return data;
        }
        const friendly = normalizeDirectVerifyError(err);
        setError(friendly);
        return null;
      } finally {
        setLoading(false);
        setCurrentStep("");
      }
    },
    [getContract]
  );

  const reset = useCallback(() => {
    setLoading(false);
    setResult(null);
    setError(null);
    setCurrentStep("");
  }, []);

  return {
    verifyById,
    verifyByFile,
    verifyByHash,
    loading,
    result,
    error,
    currentStep,
    setError,
    reset,
  };
}
