export interface Certificate {
  _id: string;
  certId: string;
  certHash: string;
  ipfsCID: string;
  ipfsUrl: string;
  recipientName: string;
  courseName: string;
  issuingOrg: string;
  issuerAddress: string;
  issuedAt: string;
  isRevoked: boolean;
  revokedAt?: string;
  revokedBy?: string;
  revokeReason?: string;
  revokeTxHash?: string;
  revokeBlockNumber?: number;
  txHash: string;
  blockNumber: number;
  qrCodeUrl?: string;
  qrVerifyUrl?: string;
  qrCode?: string;
  verificationCount: number;
  lastVerifiedAt?: string;
  createdAt: string;
  updatedAt: string;
  issueDate?: string;
  status?: "active" | "revoked" | "expired";
  recipientEmail?: string;
  verifyUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface BlockchainCertificate {
  certHash: string;
  ipfsCID?: string;
  ipfsCid?: string;
  issuer: string;
  issuedAt: number;
  isRevoked: boolean;
  recipientName: string;
  certId: string;
  courseName: string;
  issuingOrg: string;
  revokedAt?: number;
  revokedBy?: string;
}

export interface VerifyResult {
  exists: boolean;
  isValid: boolean;
  isRevoked: boolean;
  certificate?: Certificate;
  error?: string;
  verifiedAt: string;
  source?: "backend" | "blockchain";
  message?: string;
  blockchain?: BlockchainCertificate;
}

export interface IssueFormData {
  recipientName: string;
  recipientEmail: string;
  courseName: string;
  issuingOrg: string;
  certId?: string;
  pdfFile: File;
}

export interface AdminUser {
  id: string;
  username: string;
  role: "superadmin" | "admin";
  walletAddress?: string;
}

export interface DashboardStats {
  total: number;
  valid: number;
  revoked: number;
  thisMonth: number;
  monthlyData: { month: string; count: number }[];
  active?: number;
  issuedToday?: number;
  byOrg?: Array<{ _id: string; count: number }>;
}

export type AuditEventType = "issued" | "revoked" | "verified";

export interface AuditEventItem {
  eventType: AuditEventType;
  certId: string;
  certHash: string;
  actor: string;
  timestamp: string;
  txHash: string;
  blockNumber: number;
}

export interface AuditEventFilters {
  eventType?: AuditEventType | "all";
  from?: string;
  to?: string;
  limit?: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  totalPages: number;
  limit: number;
}

export interface AuthResponse {
  token: string;
  admin: AdminUser;
  refreshToken?: string;
  message?: string;
}

export type CertificateRecord = Certificate;
export type VerifyResponse = VerifyResult;
export type Admin = AdminUser;
