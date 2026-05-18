import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatAddress(address: string): string {
  if (!address) return "";
  if (address.length <= 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function formatDate(date: string | Date, locale = "en-US"): string {
  const value = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(value.getTime())) return "Invalid date";
  return value.toLocaleDateString(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function formatDateRelative(date: string, locale = "en"): string {
  const input = new Date(date);
  if (Number.isNaN(input.getTime())) return "Invalid date";

  const now = Date.now();
  const diffSeconds = Math.round((input.getTime() - now) / 1000);
  const absSeconds = Math.abs(diffSeconds);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });

  if (absSeconds < 60) return rtf.format(diffSeconds, "second");
  if (absSeconds < 60 * 60) return rtf.format(Math.round(diffSeconds / 60), "minute");
  if (absSeconds < 60 * 60 * 24) return rtf.format(Math.round(diffSeconds / 3600), "hour");
  if (absSeconds < 60 * 60 * 24 * 7) return rtf.format(Math.round(diffSeconds / 86400), "day");
  if (absSeconds < 60 * 60 * 24 * 30) return rtf.format(Math.round(diffSeconds / 604800), "week");
  if (absSeconds < 60 * 60 * 24 * 365) return rtf.format(Math.round(diffSeconds / 2592000), "month");
  return rtf.format(Math.round(diffSeconds / 31536000), "year");
}

export function truncateHash(hash: string, chars: number = 8): string {
  if (!hash) return "";
  const hasPrefix = hash.startsWith("0x");
  const body = hasPrefix ? hash.slice(2) : hash;
  if (body.length <= chars * 2) return hash;
  const start = hasPrefix ? `0x${body.slice(0, chars)}` : body.slice(0, chars);
  return `${start}...${body.slice(-chars)}`;
}

export async function copyToClipboard(text: string): Promise<void> {
  if (!text) return;

  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  if (typeof document === "undefined") return;

  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.style.position = "fixed";
  textArea.style.opacity = "0";
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  document.execCommand("copy");
  document.body.removeChild(textArea);
}

export function formatCertId(id: string): string {
  if (!id) return "";
  return id.trim().toUpperCase().replace(/\s+/g, "-");
}

export function getStatusColor(isRevoked: boolean): string {
  return isRevoked
    ? "text-red-400 bg-red-500/10 border-red-500/20"
    : "text-green-400 bg-green-500/10 border-green-500/20";
}

export async function calculateFileHash(file: File): Promise<string> {
  const webCrypto = globalThis.crypto?.subtle;
  if (!webCrypto) {
    throw new Error("Web Crypto API is not available in this environment");
  }

  const arrayBuffer = await file.arrayBuffer();
  const hashBuffer = await webCrypto.digest("SHA-256", arrayBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function verifyFileHash(file: File, storedHash: string): Promise<boolean> {
  const computedHash = await calculateFileHash(file);
  const normalize = (value: string) => value.toLowerCase().replace(/^0x/, "");
  return normalize(computedHash) === normalize(storedHash || "");
}
