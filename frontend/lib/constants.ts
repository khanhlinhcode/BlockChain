// ═══════════════════════════════════════
//  CONTRACT & CHAIN CONFIG
// ═══════════════════════════════════════

export const CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "";

const parsedChainId = Number.parseInt(
  process.env.NEXT_PUBLIC_CHAIN_ID || "11155111",
  10
);

export const CHAIN_ID = Number.isFinite(parsedChainId) ? parsedChainId : 11155111; // Default: Sepolia

export const API_BASE_URL =
  typeof window === "undefined" && process.env.SERVER_API_URL
    ? process.env.SERVER_API_URL
    : process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

export const IPFS_GATEWAY =
  process.env.NEXT_PUBLIC_IPFS_GATEWAY || "https://gateway.pinata.cloud/ipfs";

// ═══════════════════════════════════════
//  SUPPORTED CHAINS
// ═══════════════════════════════════════

export const SUPPORTED_CHAINS: Record<
  number,
  { name: string; rpcUrl: string; explorer: string; symbol: string }
> = {
  31337: {
    name: "Hardhat Local",
    rpcUrl: "http://127.0.0.1:8545",
    explorer: "",
    symbol: "ETH",
  },
  80001: {
    name: "Polygon Mumbai",
    rpcUrl: "https://rpc-mumbai.maticvigil.com",
    explorer: "https://mumbai.polygonscan.com",
    symbol: "MATIC",
  },
  11155111: {
    name: "Ethereum Sepolia",
    rpcUrl: "https://rpc.sepolia.org",
    explorer: "https://sepolia.etherscan.io",
    symbol: "ETH",
  },
};

// ═══════════════════════════════════════
//  STATUS ENUM
// ═══════════════════════════════════════

export const STATUS = {
  VALID: "valid",
  REVOKED: "revoked",
  NOT_FOUND: "not_found",
} as const;

export type StatusType = (typeof STATUS)[keyof typeof STATUS];

// ═══════════════════════════════════════
//  CONTRACT ABI (human-readable)
// ═══════════════════════════════════════

export const CONTRACT_ABI = [
  "function addAdmin(address _admin) external",
  "function removeAdmin(address _admin) external",
  "function isAdmin(address _addr) external view returns (bool)",
  "function admins(address) external view returns (bool)",
  "function issueCertificate(bytes32 _hash, string _certId, string _ipfsCID, string _recipientName, string _courseName, string _issuingOrg) external",
  "function verifyCertificate(bytes32 _hash) external returns (bool exists, bool isValid, bool isRevoked)",
  "function verifyCertificateById(string _certId) external returns (bool exists, bool isValid, bool isRevoked)",
  "function revokeCertificate(bytes32 _hash, string _reason) external",
  "function getCertificate(bytes32 _hash) external view returns (tuple(bytes32 certHash, string ipfsCID, address issuer, uint256 issuedAt, bool isRevoked, string recipientName, string certId, string courseName, string issuingOrg, uint256 revokedAt, address revokedBy))",
  "function getCertificateById(string _certId) external view returns (tuple(bytes32 certHash, string ipfsCID, address issuer, uint256 issuedAt, bool isRevoked, string recipientName, string certId, string courseName, string issuingOrg, uint256 revokedAt, address revokedBy))",
  "function getVerificationHistory(bytes32 _hash) external view returns (tuple(address verifier, uint256 verifiedAt)[])",
  "function getTotalCertificates() external view returns (uint256)",
  "function getIssuedByAdmin(address _admin) external view returns (bytes32[])",
  "function getHashByCertId(string _certId) external view returns (bytes32)",
  "event CertIssued(bytes32 indexed certHash, string certId, address indexed issuer, uint256 issuedAt)",
  "event CertVerified(bytes32 indexed certHash, address verifier, uint256 verifiedAt)",
  "event CertRevoked(bytes32 indexed certHash, address indexed revoker, string reason, uint256 revokedAt)",
  "event AdminAdded(address indexed admin)",
  "event AdminRemoved(address indexed admin)",
];
