import { NextResponse, type NextRequest } from "next/server";

function decodePayload(token: string): { exp?: number; role?: string } | null {
  try {
    const [, payload] = token.split(".");
    if (!payload) return null;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
    const json = atob(padded);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (!pathname.startsWith("/admin") || pathname === "/admin/login") {
    return NextResponse.next();
  }

  const token = request.cookies.get("certchain_token")?.value;
  if (!token) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  const payload = decodePayload(token);
  if (!payload?.exp || payload.exp * 1000 <= Date.now()) {
    const response = NextResponse.redirect(new URL("/admin/login", request.url));
    response.cookies.delete("certchain_token");
    response.cookies.delete("certchain_role");
    return response;
  }

  if ((pathname.startsWith("/admin/wallets") || pathname.startsWith("/admin/audit")) && payload.role !== "superadmin") {
    return NextResponse.redirect(new URL("/admin/dashboard", request.url));
  }

  const response = NextResponse.next();
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  return response;
}

export const config = {
  matcher: ["/admin/:path*"],
};
