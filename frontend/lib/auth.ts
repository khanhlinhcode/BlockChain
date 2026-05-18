const TOKEN_KEY = "certchain_token";
const REFRESH_TOKEN_KEY = "certchain_refresh_token";
const ADMIN_KEY = "certchain_admin";

interface JwtPayload {
  exp?: number;
  [key: string]: unknown;
}

let expiryTimer: number | null = null;

function isBrowser() {
  return typeof window !== "undefined";
}

function decodeBase64Url(input: string): string | null {
  try {
    const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
    if (isBrowser() && typeof window.atob === "function") {
      return window.atob(normalized);
    }

    if (typeof Buffer !== "undefined") {
      return Buffer.from(normalized, "base64").toString("utf-8");
    }
  } catch {
    return null;
  }

  return null;
}

function parseJwt(token: string): JwtPayload | null {
  try {
    const [, payloadBase64] = token.split(".");
    if (!payloadBase64) return null;
    const decoded = decodeBase64Url(payloadBase64);
    if (!decoded) return null;
    return JSON.parse(decoded) as JwtPayload;
  } catch {
    return null;
  }
}

export function getTokenExpiryMs(token: string): number | null {
  const payload = parseJwt(token);
  if (!payload?.exp) return null;
  return payload.exp * 1000;
}

export function isTokenExpired(token: string, skewSeconds = 0): boolean {
  const expiryMs = getTokenExpiryMs(token);
  if (!expiryMs) return false;
  return expiryMs <= Date.now() + skewSeconds * 1000;
}

export function isTokenExpiringSoon(token: string, withinSeconds = 60): boolean {
  return isTokenExpired(token, withinSeconds);
}

function clearExpiryTimer() {
  if (!isBrowser()) return;
  if (expiryTimer) {
    window.clearTimeout(expiryTimer);
    expiryTimer = null;
  }
}

export function redirectToLogin() {
  if (!isBrowser()) return;
  if (window.location.pathname !== "/admin/login") {
    window.location.href = "/admin/login";
  }
}

export function clearAuthSession() {
  if (!isBrowser()) return;
  clearExpiryTimer();
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(ADMIN_KEY);
}

export function scheduleTokenExpiryLogout() {
  if (!isBrowser()) return;
  clearExpiryTimer();

  const token = getStoredToken();
  if (!token) return;

  const expiryMs = getTokenExpiryMs(token);
  if (!expiryMs) return;

  const waitMs = Math.max(expiryMs - Date.now(), 0);
  expiryTimer = window.setTimeout(() => {
    clearAuthSession();
    redirectToLogin();
  }, waitMs);
}

export function saveAuthSession(token: string, admin: unknown, refreshToken?: string) {
  if (!isBrowser()) return;
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(ADMIN_KEY, JSON.stringify(admin));
  if (refreshToken) {
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  }
  scheduleTokenExpiryLogout();
}

export function setAuthToken(token: string) {
  if (!isBrowser()) return;
  localStorage.setItem(TOKEN_KEY, token);
  scheduleTokenExpiryLogout();
}

export function setRefreshToken(refreshToken: string) {
  if (!isBrowser()) return;
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

export function getStoredToken(): string | null {
  if (!isBrowser()) return null;
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return null;

  if (isTokenExpired(token)) {
    clearAuthSession();
    return null;
  }

  return token;
}

export function getRefreshToken(): string | null {
  if (!isBrowser()) return null;
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function getAuthToken(): string | null {
  const token = getStoredToken();
  if (!token) return null;

  if (!isTokenExpired(token)) return token;

  if (!getRefreshToken()) {
    clearAuthSession();
  }

  return null;
}

export function getStoredAdmin<T = unknown>(): T | null {
  if (!isBrowser()) return null;
  const value = localStorage.getItem(ADMIN_KEY);
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export function validateAuthSessionOnLoad() {
  if (!isBrowser()) return;
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return;

  if (isTokenExpired(token)) {
    clearAuthSession();
    if (
      window.location.pathname.startsWith("/admin") &&
      window.location.pathname !== "/admin/login"
    ) {
      window.location.href = "/admin/login";
    }
  }
}
