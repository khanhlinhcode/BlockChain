"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import AdminBottomNav from "@/components/AdminBottomNav";
import LogoutButton from "@/components/admin/LogoutButton";
import ThemeToggle from "@/components/ThemeToggle";
import LanguageToggle from "@/components/LanguageToggle";
import { useLanguage } from "@/context/LanguageContext";
import { clearAuthSession, getAuthToken } from "@/lib/auth";

function decodeJwtPayload(token: string): { exp?: number; role?: string } | null {
  try {
    const [, payload] = token.split(".");
    if (!payload) return null;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

export default function AdminAuthLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useLanguage();
  const isLoginPage = pathname === "/admin/login";
  const pageHasSidebar =
    pathname === "/admin/dashboard" ||
    pathname === "/admin/issue" ||
    pathname === "/admin/certificates" ||
    pathname === "/admin/audit" ||
    pathname === "/admin/wallets" ||
    pathname.startsWith("/admin/revoke");
  const [authorized, setAuthorized] = useState(isLoginPage);

  useEffect(() => {
    if (pathname === "/admin/login") {
      setAuthorized(true);
      return;
    }

    const token = getAuthToken();
    if (!token) {
      setAuthorized(false);
      router.replace("/admin/login");
      return;
    }

    try {
      const payload = decodeJwtPayload(token);
      if (!payload?.exp || payload.exp * 1000 < Date.now()) {
        clearAuthSession();
        setAuthorized(false);
        router.replace("/admin/login");
        return;
      }

      if ((pathname.startsWith("/admin/wallets") || pathname.startsWith("/admin/audit")) && payload.role !== "superadmin") {
        setAuthorized(false);
        router.replace("/admin/dashboard");
        return;
      }
    } catch {
      clearAuthSession();
      setAuthorized(false);
      router.replace("/admin/login");
      return;
    }

    setAuthorized(true);
  }, [pathname, router]);

  if (!authorized) {
    return (
      <div className="page-bg flex min-h-screen items-center justify-center">
        <div className="glass px-5 py-4 text-sm text-[var(--text-secondary)]">{t("admin.checkingSession")}</div>
      </div>
    );
  }

  if (isLoginPage) return <>{children}</>;

  return (
    <div className="min-h-screen">
      {!pageHasSidebar ? (
        <div className="fixed right-3 top-3 z-[60] hidden items-center gap-2 md:flex">
          <Link
            href="/"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 12px",
              borderRadius: "10px",
              color: "var(--text-muted)",
              fontSize: "14px",
              fontFamily: "var(--font-body)",
              transition: "all 0.2s",
              textDecoration: "none",
              border: "1px solid var(--border)",
              background: "var(--bg-surface)",
            }}
          >
            ← {t("admin.publicSite")}
          </Link>
          <ThemeToggle />
          <LanguageToggle />
          <LogoutButton compact />
        </div>
      ) : null}
      {children}
      <AdminBottomNav />
    </div>
  );
}
