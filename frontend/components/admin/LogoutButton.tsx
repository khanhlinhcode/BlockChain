"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/context/LanguageContext";
import { useMetaMaskContext } from "@/context/MetaMaskContext";

type LogoutButtonProps = {
  compact?: boolean;
  className?: string;
};

export default function LogoutButton({ compact = false, className = "" }: LogoutButtonProps) {
  const router = useRouter();
  const { t } = useLanguage();
  const { disconnect } = useMetaMaskContext();
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    if (!window.confirm(t("admin.logoutConfirm"))) return;

    try {
      setLoading(true);
      const token = localStorage.getItem("certchain_token");
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/logout`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
    } catch {
      // Ignore API logout failure and continue local cleanup.
    } finally {
      localStorage.removeItem("certchain_token");
      localStorage.removeItem("certchain_refresh_token");
      localStorage.removeItem("certchain_admin");
      localStorage.removeItem("certchain_wallet_connected");
      disconnect();
      router.replace("/admin/login");
      setLoading(false);
    }
  };

  if (compact) {
    return (
      <button
        type="button"
        title={t("admin.logout")}
        aria-label={t("admin.logout")}
        onClick={() => void handleLogout()}
        disabled={loading}
        className={`inline-flex items-center justify-center rounded-lg border border-[rgba(255,77,109,0.2)] bg-transparent p-2 text-[var(--text-muted)] transition-all duration-200 hover:border-[rgba(255,77,109,0.4)] hover:text-[var(--red)] disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void handleLogout()}
      disabled={loading}
      className={`sidebar-danger-control flex w-full items-center gap-2 px-3 text-[13px] font-bold text-[var(--red)] transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <polyline points="16 17 21 12 16 7" />
        <line x1="21" y1="12" x2="9" y2="12" />
      </svg>
      {loading ? t("admin.logoutLoading") : t("admin.logout")}
    </button>
  );
}
