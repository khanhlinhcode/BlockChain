import axios, { type AxiosError } from "axios";
import { languageStorageKey } from "@/lib/i18n";

type ErrorPayload = {
  error?: string;
  message?: string;
};

type ErrorMessageKey =
  | "sessionExpired"
  | "forbidden"
  | "notFound"
  | "rateLimited"
  | "serverError"
  | "unavailable"
  | "duplicate"
  | "alreadyOnChain"
  | "insufficientGas"
  | "rejected"
  | "wrongNetwork"
  | "timeout"
  | "network"
  | "reverted"
  | "invalidSignature"
  | "certificateNotFound"
  | "fallback";

const messages: Record<"en" | "vi", Record<ErrorMessageKey, string>> = {
  en: {
    sessionExpired: "Your session has expired. Please sign in again.",
    forbidden: "You do not have permission to perform this action.",
    notFound: "The requested resource was not found.",
    rateLimited: "Too many requests. Please wait a moment and try again.",
    serverError: "Server error. Please try again in a few minutes.",
    unavailable: "Service is temporarily unavailable. Please try again shortly.",
    duplicate: "A certificate with this ID or document hash already exists. Please use different data.",
    alreadyOnChain: "Certificate already exists on blockchain. Each certificate can only be issued once.",
    insufficientGas: "Transaction failed: insufficient gas.",
    rejected: "You cancelled the transaction in MetaMask. No changes were made.",
    wrongNetwork: "You are on the wrong network. Please switch to the supported network and retry.",
    timeout: "Connection timeout. Please check your internet and try again.",
    network: "Cannot reach the server. Please check your internet and try again.",
    reverted: "Blockchain transaction failed. Please review the request data and try again.",
    invalidSignature: "Wallet signature is invalid. Please sign again in MetaMask.",
    certificateNotFound: "Certificate not found. Please check the certificate ID or upload the original file.",
    fallback: "Something went wrong. Please try again.",
  },
  vi: {
    sessionExpired: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
    forbidden: "Bạn không có quyền thực hiện thao tác này.",
    notFound: "Không tìm thấy tài nguyên được yêu cầu.",
    rateLimited: "Quá nhiều yêu cầu. Vui lòng chờ một chút rồi thử lại.",
    serverError: "Lỗi máy chủ. Vui lòng thử lại sau vài phút.",
    unavailable: "Dịch vụ tạm thời không khả dụng. Vui lòng thử lại sau.",
    duplicate: "Đã tồn tại chứng chỉ với mã hoặc hash tài liệu này. Vui lòng dùng dữ liệu khác.",
    alreadyOnChain: "Chứng chỉ đã tồn tại trên blockchain. Mỗi chứng chỉ chỉ được cấp một lần.",
    insufficientGas: "Giao dịch thất bại: không đủ gas.",
    rejected: "Bạn đã hủy thao tác trong MetaMask. Không có thay đổi nào được thực hiện.",
    wrongNetwork: "Bạn đang ở sai mạng. Vui lòng chuyển sang mạng được hỗ trợ rồi thử lại.",
    timeout: "Kết nối quá thời gian. Vui lòng kiểm tra internet và thử lại.",
    network: "Không thể kết nối máy chủ. Vui lòng kiểm tra internet và thử lại.",
    reverted: "Giao dịch blockchain thất bại. Vui lòng kiểm tra dữ liệu và thử lại.",
    invalidSignature: "Chữ ký ví không hợp lệ. Vui lòng ký lại trong MetaMask.",
    certificateNotFound: "Không tìm thấy chứng chỉ. Vui lòng kiểm tra mã hoặc tải file gốc lên.",
    fallback: "Đã xảy ra lỗi. Vui lòng thử lại.",
  },
};

function currentLocale() {
  if (typeof window === "undefined") return "en" as const;
  return window.localStorage.getItem(languageStorageKey) === "vi" ? "vi" : "en";
}

function msg(key: ErrorMessageKey) {
  return messages[currentLocale()][key];
}

function readServerMessage(error: AxiosError): string {
  const payload = error.response?.data as ErrorPayload | string | undefined;
  if (typeof payload === "string") return payload;
  return payload?.error || payload?.message || "";
}

function normalizeMessage(input: string): string {
  return input.trim().toLowerCase();
}

function getStatusMessage(status?: number): string | null {
  if (status === 401) return msg("sessionExpired");
  if (status === 403) return msg("forbidden");
  if (status === 404) return msg("notFound");
  if (status === 429) return msg("rateLimited");
  if (status === 500) return msg("serverError");
  if (status === 503) return msg("unavailable");
  return null;
}

function matchFriendlyMessage(message: string): string | null {
  const normalized = normalizeMessage(message);

  if (normalized.includes("e11000") || normalized.includes("duplicate key error")) {
    return msg("duplicate");
  }

  if (
    normalized.includes("certificate hash already registered") ||
    normalized.includes("hash already registered") ||
    normalized.includes("already exists on-chain") ||
    normalized.includes("already issued")
  ) {
    return msg("alreadyOnChain");
  }

  if (normalized.includes("insufficient funds") || normalized.includes("insufficient gas")) {
    return msg("insufficientGas");
  }

  if (
    normalized.includes("user rejected") ||
    normalized.includes("user denied") ||
    normalized.includes("rejected the request")
  ) {
    return msg("rejected");
  }

  if (normalized.includes("wrong network") || normalized.includes("unsupported chain")) {
    return msg("wrongNetwork");
  }

  if (normalized.includes("network error")) {
    return msg("timeout");
  }

  if (normalized.includes("timeout")) {
    return msg("timeout");
  }

  if (normalized.includes("execution reverted")) {
    return msg("reverted");
  }

  if (normalized.includes("invalid signature")) {
    return msg("invalidSignature");
  }

  if (normalized.includes("certificate not found")) {
    return msg("certificateNotFound");
  }

  return null;
}

export function getFriendlyError(error: unknown, fallback = msg("fallback")): string {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError;
    const code = axiosError.code;

    if (code === "ECONNABORTED" || code === "ETIMEDOUT") {
      return msg("timeout");
    }

    if (code === "ERR_NETWORK") {
      return msg("network");
    }

    const statusMessage = getStatusMessage(axiosError.response?.status);
    const serverMessage = readServerMessage(axiosError) || axiosError.message || "";

    const matched = matchFriendlyMessage(serverMessage);
    if (matched) return matched;
    if (statusMessage) return statusMessage;
    if (serverMessage) return serverMessage;
    return fallback;
  }

  if (typeof error === "object" && error !== null) {
    const errorLike = error as { code?: number | string; message?: string };

    if (errorLike.code === 4001 || errorLike.code === "ACTION_REJECTED") {
      return msg("rejected");
    }

    const message = errorLike.message || "";
    const matched = matchFriendlyMessage(message);
    if (matched) return matched;
    if (message) return message;
  }

  if (error instanceof Error && error.message) {
    const matched = matchFriendlyMessage(error.message);
    return matched || error.message;
  }

  return fallback;
}
