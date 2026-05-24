import axios, {
  type AxiosError,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from "axios";
import type {
  AuditEventFilters,
  AuditEventItem,
  AdminUser,
  ApiResponse,
  Certificate,
  DashboardStats,
  PaginatedResponse,
  VerifyResult,
} from "@/types";
import {
  clearAuthSession,
  getAuthToken,
  getRefreshToken,
  getStoredToken,
  isTokenExpiringSoon,
  redirectToLogin,
  saveAuthSession,
  setAuthToken,
  setRefreshToken,
} from "./auth";
import { getFriendlyError } from "./errorMessages";

type RetriableRequestConfig = InternalAxiosRequestConfig & { _retry?: boolean };

type CertListParams = {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  sort?: string;
};

export type PreparedMetaMaskIssue = {
  certId: string;
  certHash: string;
  ipfsCID: string;
  ipfsUrl: string;
};

const API_BASE_URL =
  typeof window === "undefined" && process.env.SERVER_API_URL
    ? process.env.SERVER_API_URL
    : typeof window !== "undefined"
    ? "/api"
    : process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";
const IS_DEV = process.env.NODE_ENV === "development";

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
});

const authClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asString(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return fallback;
}

function asOptionalString(value: unknown): string | undefined {
  const parsed = asString(value, "");
  return parsed.length > 0 ? parsed : undefined;
}

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toIsoString(value: unknown): string | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(value * 1000).toISOString();
  }

  if (typeof value === "string") {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }

  return undefined;
}

function normalizeStatus(
  cert: Record<string, unknown>
): Certificate["status"] | undefined {
  const status = asString(cert.status, "").toLowerCase();
  if (status === "active" || status === "revoked" || status === "expired") {
    return status;
  }

  if (cert.isRevoked === true) return "revoked";
  if (cert.isRevoked === false) return "active";
  return undefined;
}

function normalizeCertificate(raw: unknown): Certificate {
  const cert = isRecord(raw) ? raw : {};
  const issuedAt =
    toIsoString(cert.issuedAt) ||
    toIsoString(cert.issueDate) ||
    toIsoString(cert.createdAt) ||
    new Date().toISOString();

  const id = asString(cert._id, asString(cert.certId, asString(cert.certHash)));
  const createdAt = toIsoString(cert.createdAt) || issuedAt;
  const updatedAt = toIsoString(cert.updatedAt) || createdAt;

  return {
    _id: id,
    certId: asString(cert.certId),
    certHash: asString(cert.certHash),
    ipfsCID: asString(cert.ipfsCID ?? cert.ipfsCid),
    ipfsUrl: asString(cert.ipfsUrl),
    recipientName: asString(cert.recipientName),
    courseName: asString(cert.courseName),
    issuingOrg: asString(cert.issuingOrg),
    issuerAddress: asString(cert.issuerAddress ?? cert.issuer),
    issuedAt,
    isRevoked: Boolean(cert.isRevoked),
    revokedAt: toIsoString(cert.revokedAt),
    revokedBy: asOptionalString(cert.revokedBy),
    revokeReason: asOptionalString(cert.revokeReason),
    revokeTxHash: asOptionalString(cert.revokeTxHash),
    revokeBlockNumber: asNumber(cert.revokeBlockNumber),
    txHash: asString(cert.txHash),
    blockNumber: asNumber(cert.blockNumber),
    qrCodeUrl: asOptionalString(cert.qrCodeUrl),
    qrVerifyUrl: asOptionalString(cert.qrVerifyUrl),
    qrCode: asOptionalString(cert.qrCode),
    verificationCount: asNumber(cert.verificationCount),
    lastVerifiedAt: toIsoString(cert.lastVerifiedAt),
    createdAt,
    updatedAt,
    issueDate: toIsoString(cert.issueDate),
    status: normalizeStatus(cert),
    recipientEmail: asOptionalString(cert.recipientEmail),
    verifyUrl: asOptionalString(cert.verifyUrl ?? cert.qrVerifyUrl),
    metadata: isRecord(cert.metadata) ? cert.metadata : undefined,
  };
}

function normalizeAdmin(raw: unknown): AdminUser {
  const value = isRecord(raw) ? raw : {};
  const username = asString(value.username, asString(value.email));
  const walletAddress = asOptionalString(value.walletAddress);

  return {
    id: asString(value.id, asString(value._id, username || walletAddress || "admin")),
    username,
    role: value.role === "superadmin" ? "superadmin" : "admin",
    walletAddress,
  };
}

function normalizeVerifyResult(raw: unknown): VerifyResult {
  const value = isRecord(raw) ? raw : {};
  const certRaw = isRecord(value.certificate) ? value.certificate : undefined;
  const chainRaw = isRecord(value.blockchain) ? value.blockchain : undefined;

  const mergedCert =
    certRaw &&
    normalizeCertificate({
      ...certRaw,
      certHash: certRaw.certHash ?? chainRaw?.certHash,
      ipfsCID: certRaw.ipfsCID ?? certRaw.ipfsCid ?? chainRaw?.ipfsCID ?? chainRaw?.ipfsCid,
      issuerAddress: certRaw.issuerAddress ?? chainRaw?.issuer,
      issuedAt: certRaw.issuedAt ?? toIsoString(chainRaw?.issuedAt),
      isRevoked: certRaw.isRevoked ?? chainRaw?.isRevoked,
      revokedAt: certRaw.revokedAt ?? toIsoString(chainRaw?.revokedAt),
      revokedBy: certRaw.revokedBy ?? chainRaw?.revokedBy,
    });

  return {
    exists: Boolean(value.exists),
    isValid: Boolean(value.isValid),
    isRevoked: Boolean(value.isRevoked),
    certificate: mergedCert,
    error: asOptionalString(value.error),
    verifiedAt: toIsoString(value.verifiedAt) || new Date().toISOString(),
    message: asOptionalString(value.message),
    blockchain: chainRaw
      ? {
          certHash: asString(chainRaw.certHash),
          ipfsCID: asOptionalString(chainRaw.ipfsCID),
          ipfsCid: asOptionalString(chainRaw.ipfsCid),
          issuer: asString(chainRaw.issuer),
          issuedAt: asNumber(chainRaw.issuedAt),
          isRevoked: Boolean(chainRaw.isRevoked),
          recipientName: asString(chainRaw.recipientName),
          certId: asString(chainRaw.certId),
          courseName: asString(chainRaw.courseName),
          issuingOrg: asString(chainRaw.issuingOrg),
          revokedAt: asNumber(chainRaw.revokedAt, 0) || undefined,
          revokedBy: asOptionalString(chainRaw.revokedBy),
        }
      : undefined,
  };
}

function normalizeAuditEvent(raw: unknown): AuditEventItem {
  const event = isRecord(raw) ? raw : {};
  const eventType = asString(event.eventType, "").toLowerCase();
  const normalizedType =
    eventType === "issued" || eventType === "revoked" || eventType === "verified"
      ? eventType
      : "issued";

  return {
    eventType: normalizedType,
    certId: asString(event.certId),
    certHash: asString(event.certHash),
    actor: asString(event.actor),
    timestamp: toIsoString(event.timestamp) || new Date().toISOString(),
    txHash: asString(event.txHash),
    blockNumber: asNumber(event.blockNumber),
  };
}

function extractResponseData<T>(payload: unknown): T {
  if (!isRecord(payload)) return payload as T;

  if (!("success" in payload)) return payload as T;

  const response = payload as ApiResponse<T> & Record<string, unknown>;
  if (response.success === false) {
    throw new Error(response.error || response.message || "Request failed");
  }

  if (response.data !== undefined) return response.data;

  const rest: Record<string, unknown> = {};
  Object.entries(response).forEach(([key, value]) => {
    if (key !== "success") {
      rest[key] = value;
    }
  });
  return rest as T;
}

function parseSort(sort?: string): { sortField?: string; order?: "asc" | "desc" } {
  if (!sort) return {};
  const [sortField, sortOrder] = sort.split(":");
  const order = sortOrder === "asc" ? "asc" : "desc";
  return { sortField: sortField || undefined, order };
}

function safePath(path: string): string {
  return path.startsWith("/") ? path : `/${path}`;
}

function isAuthRoute(url?: string): boolean {
  if (!url) return false;
  const normalized = safePath(url);
  return normalized.startsWith("/auth/login") || normalized.startsWith("/auth/refresh");
}

function stringifyBodyForLog(data: unknown): unknown {
  if (typeof FormData !== "undefined" && data instanceof FormData) {
    return "[FormData]";
  }

  return data;
}

async function maybeRefreshToken(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  try {
    const response = await authClient.post("/auth/refresh", { refreshToken });
    const payload = extractResponseData<{
      token?: string;
      refreshToken?: string;
      admin?: unknown;
    }>(response.data);

    if (!payload.token) return null;

    setAuthToken(payload.token);
    if (payload.refreshToken) setRefreshToken(payload.refreshToken);
    if (payload.admin !== undefined) {
      saveAuthSession(payload.token, payload.admin, payload.refreshToken);
    }

    return payload.token;
  } catch {
    return null;
  }
}

let refreshRequest: Promise<string | null> | null = null;

async function refreshAccessTokenOnce(): Promise<string | null> {
  if (!refreshRequest) {
    refreshRequest = maybeRefreshToken().finally(() => {
      refreshRequest = null;
    });
  }

  return refreshRequest;
}

apiClient.interceptors.request.use(
  async (config) => {
    const currentToken = getStoredToken();
    let token = getAuthToken();

    if (!token && currentToken && getRefreshToken()) {
      token = await refreshAccessTokenOnce();
    } else if (token && isTokenExpiringSoon(token, 30) && getRefreshToken()) {
      token = (await refreshAccessTokenOnce()) || token;
    }

    if (token) {
      if (!config.headers) {
        config.headers = {} as InternalAxiosRequestConfig["headers"];
      }
      (config.headers as Record<string, string>).Authorization = `Bearer ${token}`;
    }

    if (config.method?.toLowerCase() === "get") {
      if (!config.headers) {
        config.headers = {} as InternalAxiosRequestConfig["headers"];
      }
      (config.headers as Record<string, string>)["Cache-Control"] = "no-cache";
      (config.headers as Record<string, string>).Pragma = "no-cache";
    }

    if (IS_DEV) {
      console.debug("[API][Request]", {
        method: config.method?.toUpperCase(),
        url: config.url,
        params: config.params,
        data: stringifyBodyForLog(config.data),
      });
    }

    return config;
  },
  (error) => Promise.reject(error)
);

apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    if (IS_DEV) {
      console.debug("[API][Response]", {
        status: response.status,
        url: response.config.url,
        data: response.data,
      });
    }

    return response;
  },
  async (error: AxiosError) => {
    if (IS_DEV) {
      console.debug("[API][Error]", {
        status: error.response?.status,
        url: error.config?.url,
        data: error.response?.data,
      });
    }

    const status = error.response?.status;
    const originalRequest = error.config as RetriableRequestConfig | undefined;

    if (status === 401 && originalRequest && !originalRequest._retry && !isAuthRoute(originalRequest.url)) {
      originalRequest._retry = true;
      const refreshedToken = await refreshAccessTokenOnce();

      if (refreshedToken) {
        if (!originalRequest.headers) {
          originalRequest.headers = {} as InternalAxiosRequestConfig["headers"];
        }
        (originalRequest.headers as Record<string, string>).Authorization = `Bearer ${refreshedToken}`;
        return apiClient(originalRequest);
      }

      clearAuthSession();
      redirectToLogin();
    }

    error.message = getFriendlyError(error, error.message || "Request failed");
    return Promise.reject(error);
  }
);

export const authApi = {
  async login(credentials: {
    username: string;
    password: string;
  }): Promise<{ token: string; admin: AdminUser; refreshToken?: string }> {
    const response = await apiClient.post("/auth/login", credentials);
    const payload = extractResponseData<{
      token: string;
      admin: unknown;
      refreshToken?: string;
    }>(response.data);

    const admin = normalizeAdmin(payload.admin);
    saveAuthSession(payload.token, admin, payload.refreshToken);
    return { token: payload.token, admin, refreshToken: payload.refreshToken };
  },

  async loginMetaMask(data: {
    walletAddress: string;
    signature: string;
    message: string;
  }): Promise<{ token: string; admin: AdminUser; refreshToken?: string }> {
    const response = await apiClient.post("/auth/login-metamask", data);
    const payload = extractResponseData<{
      token: string;
      admin: unknown;
      refreshToken?: string;
    }>(response.data);

    const admin = normalizeAdmin(payload.admin);
    saveAuthSession(payload.token, admin, payload.refreshToken);
    return { token: payload.token, admin, refreshToken: payload.refreshToken };
  },

  async linkWallet(data: {
    walletAddress: string;
    signature: string;
    message: string;
  }): Promise<AdminUser> {
    const response = await apiClient.post("/auth/link-wallet", data);
    const payload = extractResponseData<{ admin: unknown }>(response.data);
    const admin = normalizeAdmin(payload.admin);
    const token = getStoredToken();
    if (token) {
      saveAuthSession(token, admin, getRefreshToken() || undefined);
    }
    return admin;
  },

  async logout(): Promise<void> {
    try {
      await apiClient.post("/auth/logout", {
        refreshToken: getRefreshToken() || undefined,
      });
    } catch {
      // Ignore network/API failures during local logout.
    } finally {
      clearAuthSession();
    }
  },

  async getMe(): Promise<AdminUser> {
    const response = await apiClient.get("/auth/me");
    const payload = extractResponseData<Record<string, unknown>>(response.data);
    const adminPayload = isRecord(payload.admin) ? payload.admin : payload;
    return normalizeAdmin(adminPayload);
  },
};

export const verifyApi = {
  async byId(certId: string): Promise<VerifyResult> {
    try {
      const response = await apiClient.post("/verify/by-id", { certId });
      return normalizeVerifyResult(extractResponseData(response.data));
    } catch (error: unknown) {
      const axiosError = error as AxiosError;
      if (axiosError.response?.status === 404) {
        return normalizeVerifyResult({
          exists: false,
          isValid: false,
          isRevoked: false,
          verifiedAt: new Date().toISOString(),
        });
      }
      throw error;
    }
  },

  async byFile(file: File): Promise<VerifyResult> {
    const formData = new FormData();
    formData.append("pdfFile", file);

    const response = await apiClient.post("/verify/by-file", formData);
    return normalizeVerifyResult(extractResponseData(response.data));
  },

  async byHash(certHash: string): Promise<VerifyResult> {
    const response = await apiClient.post("/verify/by-hash", { certHash });
    return normalizeVerifyResult(extractResponseData(response.data));
  },

  async getHistory(certId: string): Promise<Array<{ verifiedAt: string }>> {
    const response = await apiClient.get(`/verify/${encodeURIComponent(certId)}/history`);
    const payload = extractResponseData<Record<string, unknown> | Array<{ verifiedAt: string }>>(
      response.data
    );

    if (Array.isArray(payload)) {
      return payload
        .map((item) => ({ verifiedAt: toIsoString(item.verifiedAt) }))
        .filter((item): item is { verifiedAt: string } => Boolean(item.verifiedAt));
    }

    const lastVerifiedAt = toIsoString(payload.lastVerifiedAt);
    return lastVerifiedAt ? [{ verifiedAt: lastVerifiedAt }] : [];
  },
};

export const certApi = {
  async issue(formData: FormData): Promise<Certificate> {
    const response = await apiClient.post("/certificates/issue", formData);

    const payload = extractResponseData<Record<string, unknown>>(response.data);
    const certId = asString(payload.certId);
    if (certId) {
      try {
        return await certApi.getById(certId);
      } catch {
        // Fallback to partial response if detail endpoint fails.
      }
    }

    return normalizeCertificate({
      ...payload,
      certId,
      recipientName: asString(payload.recipientName, asString(formData.get("recipientName"))),
      courseName: asString(payload.courseName, asString(formData.get("courseName"))),
      issuingOrg: asString(payload.issuingOrg, asString(formData.get("issuingOrg"))),
      issuedAt: toIsoString(payload.issuedAt) || new Date().toISOString(),
    });
  },

  async prepareMetaMaskIssue(formData: FormData): Promise<PreparedMetaMaskIssue> {
    const response = await apiClient.post("/certificates/prepare-metamask-issue", formData);
    const payload = extractResponseData<Record<string, unknown>>(response.data);

    return {
      certId: asString(payload.certId),
      certHash: asString(payload.certHash),
      ipfsCID: asString(payload.ipfsCID),
      ipfsUrl: asString(payload.ipfsUrl),
    };
  },

  async list(params: CertListParams): Promise<PaginatedResponse<Certificate>> {
    const safePage = Math.max(1, params.page ?? 1);
    const safeLimit = Math.max(1, params.limit ?? 20);
    const { sortField, order } = parseSort(params.sort);

    const response = await apiClient.get("/certificates", {
      params: {
        page: safePage,
        limit: safeLimit,
        search: params.search || undefined,
        status: params.status || undefined,
        sort: sortField,
        order,
      },
    });

    const payload = isRecord(response.data) ? response.data : {};
    if (payload.success === false) {
      throw new Error(asString(payload.error, asString(payload.message, "Request failed")));
    }
    const pagination = isRecord(payload.pagination) ? payload.pagination : {};

    const rows = Array.isArray(payload.data)
      ? payload.data
      : Array.isArray(payload.certificates)
      ? payload.certificates
      : [];

    const data = rows.map((row) => normalizeCertificate(row));
    const total = asNumber(payload.total ?? pagination.total, data.length);
    const page = asNumber(payload.page ?? pagination.page, safePage);
    const totalPages = asNumber(
      payload.totalPages ?? pagination.totalPages ?? pagination.pages,
      Math.max(1, Math.ceil(total / safeLimit))
    );
    const limit = asNumber(payload.limit ?? pagination.limit, safeLimit);

    return { data, total, page, totalPages, limit };
  },

  async getById(certId: string): Promise<Certificate> {
    const response = await apiClient.get(`/certificates/${encodeURIComponent(certId)}`);
    const payload = extractResponseData<Record<string, unknown>>(response.data);
    const cert = isRecord(payload.certificate) ? payload.certificate : payload;
    return normalizeCertificate(cert);
  },

  async revoke(certHash: string, reason: string): Promise<{ txHash: string }> {
    const response = await apiClient.put(
      `/certificates/${encodeURIComponent(certHash)}/revoke`,
      { reason }
    );
    const payload = extractResponseData<Record<string, unknown>>(response.data);
    return { txHash: asString(payload.txHash) };
  },

  async syncFromChain(txHash: string): Promise<Certificate> {
    const response = await apiClient.post("/certificates/sync-from-chain", { txHash });
    const payload = extractResponseData<Record<string, unknown>>(response.data);
    const cert = isRecord(payload.certificate) ? payload.certificate : payload;
    return normalizeCertificate(cert);
  },

  async getQR(certId: string): Promise<Blob> {
    const response = await apiClient.get(`/certificates/${encodeURIComponent(certId)}/qr`, {
      responseType: "blob",
    });
    return response.data as Blob;
  },

  async getStats(): Promise<DashboardStats> {
    const response = await apiClient.get("/certificates/stats");
    const payload = extractResponseData<Record<string, unknown>>(response.data);
    const monthlyData = Array.isArray(payload.monthlyData)
      ? payload.monthlyData
          .map((entry) =>
            isRecord(entry)
              ? {
                  month: asString(entry.month),
                  count: asNumber(entry.count),
                }
              : null
          )
          .filter((entry): entry is { month: string; count: number } => Boolean(entry?.month))
      : [];

    return {
      total: asNumber(payload.total),
      valid: asNumber(payload.valid ?? payload.active),
      revoked: asNumber(payload.revoked),
      thisMonth: asNumber(payload.thisMonth ?? payload.issuedToday),
      monthlyData,
      active: asNumber(payload.active ?? payload.valid),
      issuedToday: asNumber(payload.issuedToday ?? payload.thisMonth),
      byOrg: Array.isArray(payload.byOrg)
        ? payload.byOrg
            .map((item) =>
              isRecord(item)
                ? { _id: asString(item._id), count: asNumber(item.count) }
                : null
            )
            .filter((item): item is { _id: string; count: number } => Boolean(item?._id))
        : undefined,
    };
  },
};

export const auditApi = {
  async list(filters: AuditEventFilters = {}): Promise<AuditEventItem[]> {
    const response = await apiClient.get("/certificates/audit", {
      params: {
        eventType: filters.eventType && filters.eventType !== "all" ? filters.eventType : undefined,
        from: filters.from || undefined,
        to: filters.to || undefined,
        limit: filters.limit || undefined,
      },
    });
    const payload = extractResponseData<Record<string, unknown>>(response.data);
    const eventsRaw = Array.isArray(payload.events)
      ? payload.events
      : Array.isArray(payload.data)
      ? payload.data
      : [];
    return eventsRaw.map((item) => normalizeAuditEvent(item));
  },
};

// Backward-compatible API wrapper used by existing pages/components.
export const api = {
  login: (username: string, password: string) =>
    authApi.login({ username, password }),

  loginMetaMask: (walletAddress: string, signature: string, message: string) =>
    authApi.loginMetaMask({ walletAddress, signature, message }),

  linkWallet: (walletAddress: string, signature: string, message: string) =>
    authApi.linkWallet({ walletAddress, signature, message }),

  seed: async () => {
    const response = await apiClient.post("/auth/seed");
    return extractResponseData(response.data);
  },

  getMe: () => authApi.getMe(),

  issueCertificate: (formData: FormData) => certApi.issue(formData),

  prepareMetaMaskIssue: (formData: FormData) => certApi.prepareMetaMaskIssue(formData),

  syncCertificateFromChain: (txHash: string) => certApi.syncFromChain(txHash),

  getCertificates: async (
    page = 1,
    limit = 20,
    search = "",
    status = "all",
    order: "asc" | "desc" = "desc"
  ) => {
    const result = await certApi.list({
      page,
      limit,
      search,
      status,
      sort: `issuedAt:${order}`,
    });

    return {
      certificates: result.data,
      total: result.total,
      page: result.page,
      totalPages: result.totalPages,
      limit: result.limit,
    };
  },

  getCertificatesAdvanced: async (params: {
    page?: number;
    limit?: number;
    search?: string;
    status?: "all" | "valid" | "revoked";
    order?: "asc" | "desc";
  }) => {
    const result = await certApi.list({
      page: params.page,
      limit: params.limit,
      search: params.search,
      status: params.status,
      sort: `issuedAt:${params.order || "desc"}`,
    });

    return {
      certificates: result.data,
      total: result.total,
      page: result.page,
      totalPages: result.totalPages,
      limit: result.limit,
    };
  },

  getCertificate: async (certId: string) => ({
    certificate: await certApi.getById(certId),
  }),

  getCertificateQRBlob: (certId: string) => certApi.getQR(certId),

  revokeCertificate: async (certHash: string, reason: string) => {
    const response = await apiClient.put(
      `/certificates/${encodeURIComponent(certHash)}/revoke`,
      { reason }
    );
    const payload = extractResponseData<Record<string, unknown>>(response.data);
    return {
      txHash: asString(payload.txHash),
      certificate: isRecord(payload.certificate)
        ? normalizeCertificate(payload.certificate)
        : undefined,
    };
  },

  getStats: () => certApi.getStats(),

  verifyById: (certId: string) => verifyApi.byId(certId),
  verifyByHash: (certHash: string) => verifyApi.byHash(certHash),
  verifyByFile: (file: File) => verifyApi.byFile(file),

  getVerifyHistory: async (certId: string) => {
    const response = await apiClient.get(`/verify/${encodeURIComponent(certId)}/history`);
    return extractResponseData(response.data);
  },

  getAuditEvents: (filters: AuditEventFilters = {}) => auditApi.list(filters),
};

export { apiClient as http };
