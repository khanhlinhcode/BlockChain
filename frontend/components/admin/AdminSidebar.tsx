"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  FileCheck2,
  FilePlus2,
  ScrollText,
  Loader2,
  Wallet,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { getStoredAdmin } from "@/lib/auth";
import { CHAIN_ID, SUPPORTED_CHAINS } from "@/lib/constants";
import { formatAddress } from "@/lib/utils";
import { useMetaMask } from "@/hooks/useMetaMask";
import ThemeToggle from "@/components/ThemeToggle";
import LanguageToggle from "@/components/LanguageToggle";
import { useLanguage } from "@/context/LanguageContext";
import LogoutButton from "./LogoutButton";
import type { AdminUser } from "@/types";

const NAV_ITEMS = [
  { href: "/admin/dashboard", labelKey: "admin.dashboard", icon: BarChart3 },
  { href: "/admin/issue", labelKey: "admin.issueCertificate", icon: FilePlus2 },
  { href: "/admin/certificates", labelKey: "admin.certificates", icon: FileCheck2 },
  { href: "/admin/audit", labelKey: "admin.auditLog", icon: ScrollText },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const { t } = useLanguage();
  const { account, chainId, connectWallet, signMessage } = useMetaMask();
  const [linkingWallet, setLinkingWallet] = useState(false);
  const [linkedWalletAddress, setLinkedWalletAddress] = useState<string | null>(() => {
    const admin = getStoredAdmin<AdminUser>();
    return admin?.walletAddress || null;
  });
  const chainName = SUPPORTED_CHAINS[chainId || CHAIN_ID]?.name || t("common.unknown");
  const hasWallet = Boolean(account);
  const hasLinkedWallet = Boolean(linkedWalletAddress);

  useEffect(() => {
    let cancelled = false;

    api
      .getMe()
      .then((admin) => {
        if (!cancelled) setLinkedWalletAddress(admin.walletAddress || null);
      })
      .catch(() => {
        if (!cancelled) {
          const admin = getStoredAdmin<AdminUser>();
          setLinkedWalletAddress(admin?.walletAddress || null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const linkCurrentWallet = async () => {
    if (hasLinkedWallet) {
      toast.info(t("admin.linkWalletLinked"));
      return;
    }

    try {
      setLinkingWallet(true);
      const address = await connectWallet();
      const message = `${t("admin.linkWalletSign")}\nAddress: ${address}\nNonce: ${Date.now()}`;
      const signature = await signMessage(message);
      const admin = await api.linkWallet(address, signature, message);
      setLinkedWalletAddress(admin.walletAddress || address);
      toast.success(t("admin.linkWalletSuccess"));
    } catch {
      toast.error(t("admin.linkWalletError"));
    } finally {
      setLinkingWallet(false);
    }
  };

  return (
    <aside className="fixed inset-y-0 left-0 hidden w-60 overflow-hidden border-r border-[var(--border)] bg-[var(--sidebar-bg)] px-4 py-5 backdrop-blur-xl md:flex md:flex-col">
      <Link href="/" className="inline-flex items-center gap-2.5">
        <span className="text-[var(--teal)]">⬡</span>
        <span className="font-display text-[22px] font-extrabold">
          Cert<span className="gradient-text">Chain</span>
        </span>
      </Link>

      <p className="mt-6 text-xs font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">{t("admin.mainMenu")}</p>

      <nav className="mt-3 space-y-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-[15px] font-semibold transition-all duration-200 ${
                active
                  ? "border border-[var(--teal-border)] bg-[var(--teal-glow)] text-[var(--teal)]"
                  : "text-[var(--text-secondary)] hover:bg-[var(--bg-card)] hover:text-[var(--text-primary)]"
              }`}
            >
              <Icon size={15} />
              {t(item.labelKey)}
            </Link>
          );
        })}
      </nav>

      <Link
        href="/"
        className="mt-2 flex items-center gap-2 rounded-[10px] px-3 py-2.5 text-[15px] text-[var(--text-muted)] transition-all duration-200 hover:bg-[var(--bg-card)] hover:text-[var(--text-secondary)]"
      >
        ← {t("admin.publicSite")}
      </Link>

      <div className="sidebar-control-stack mt-auto shrink-0 pb-3 pt-3">
        <ThemeToggle
          showLabel
          className="sidebar-soft-control h-[42px] rounded-[14px] px-3 text-[13px] shadow-none"
        />
        <LanguageToggle
          showLabel
          className="sidebar-soft-control h-[42px] rounded-[14px] px-3 text-[13px] shadow-none"
        />
        <div className="sidebar-wallet-card p-3">
          <div className="flex items-center gap-2 text-[13px] font-semibold text-[var(--text-secondary)]">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                hasWallet
                  ? "bg-[var(--green)] shadow-[0_0_14px_rgba(0,214,143,0.35)]"
                  : "bg-[var(--text-muted)]"
              }`}
            />
            <span className={hasWallet ? "mono leading-none" : "leading-none"}>
              {account ? formatAddress(account) : t("admin.walletNotConnected")}
            </span>
          </div>
          <div className="mt-2 inline-flex rounded-full bg-[rgba(255,184,0,0.12)] px-2.5 py-1 text-[12px] font-semibold text-[var(--amber)]">
            {chainName}
          </div>
        </div>
        <button
          type="button"
          onClick={() => void linkCurrentWallet()}
          disabled={linkingWallet}
          className="sidebar-link-wallet flex w-full items-center gap-2 px-3 text-[13px] font-bold text-[var(--teal)] transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {linkingWallet ? <Loader2 size={15} className="animate-spin" /> : <Wallet size={15} />}
          {linkingWallet
            ? t("common.loading")
            : hasLinkedWallet
            ? t("admin.linkWalletLinked")
            : hasWallet
            ? t("admin.linkWallet")
            : t("admin.connectWallet")}
        </button>
        <LogoutButton />
      </div>
    </aside>
  );
}
