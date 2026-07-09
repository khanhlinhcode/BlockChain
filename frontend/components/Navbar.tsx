"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Lock, Menu, X } from "lucide-react";
import MetaMaskConnect from "@/components/MetaMaskConnect";
import ThemeToggle from "@/components/ThemeToggle";
import LanguageToggle from "@/components/LanguageToggle";
import { useLanguage } from "@/context/LanguageContext";

const NAV_LINKS = [
  { href: "/#verify-section", labelKey: "nav.verify" },
  { href: "/#how-it-works", labelKey: "nav.howItWorks" },
  { href: "/admin/login", labelKey: "nav.forOrganizations" },
  { href: "/about", labelKey: "nav.about" },
];

function Logo() {
  return (
    <Link href="/" className="site-logo group inline-flex items-center gap-3" aria-label="CertChain home">
      <span className="site-logo-mark relative inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--teal-border)] bg-[var(--teal-glow)] shadow-[0_0_26px_rgba(0,229,255,0.16)] transition-all duration-200 group-hover:border-[rgba(0,229,255,0.55)] group-hover:shadow-[0_0_34px_rgba(0,229,255,0.24)]">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M7 3.5 17 3.5 22 12 17 20.5 7 20.5 2 12 7 3.5Z"
            fill="var(--teal)"
            fillOpacity="0.95"
          />
          <path
            d="M8.35 7.25H15.65L19.25 12L15.65 16.75H8.35L4.75 12L8.35 7.25Z"
            stroke="rgba(2,5,7,0.45)"
            strokeWidth="1.25"
          />
        </svg>
      </span>
      <span className="site-logo-word font-display text-[28px] font-extrabold leading-none tracking-[-0.012em] text-[var(--text-primary)]">
        Cert<span className="gradient-text">Chain</span>
      </span>
    </Link>
  );
}

export default function Navbar() {
  const pathname = usePathname();
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  if (pathname.startsWith("/admin")) return null;

  return (
    <>
      <header className="site-header fixed inset-x-0 top-0 z-50 h-[80px] border-b border-[rgba(0,229,255,0.12)] bg-[var(--nav-bg)] shadow-[0_16px_50px_rgba(0,0,0,0.18)] backdrop-blur-2xl">
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[rgba(0,229,255,0.5)] to-transparent" />
        <div className="absolute inset-x-0 top-0 h-full bg-[radial-gradient(circle_at_50%_-30%,rgba(0,229,255,0.12),transparent_55%)]" />

        <div className="site-header-inner relative mx-auto grid h-full w-full max-w-[1840px] grid-cols-[1fr_auto_1fr] items-center gap-5 px-6 sm:px-10 lg:px-12 xl:px-16 2xl:px-20">
          <div className="flex min-w-0 justify-start">
            <Logo />
          </div>

          <nav className="hidden items-center gap-2 justify-self-center rounded-[22px] border border-[var(--border)] bg-[var(--nav-soft-bg)] p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] lg:flex xl:gap-2">
            {NAV_LINKS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="min-w-[124px] rounded-2xl px-4 py-2.5 text-center text-[16px] font-semibold text-[var(--text-secondary)] transition-all duration-200 hover:bg-[var(--teal-glow)] hover:text-[var(--text-primary)] xl:min-w-[142px] 2xl:min-w-[158px]"
              >
                {t(item.labelKey)}
              </Link>
            ))}
          </nav>

          <div className="hidden min-w-0 items-center justify-end gap-2.5 md:flex xl:gap-3">
            <MetaMaskConnect />
            <Link
              href="/admin/login"
              className="inline-flex h-12 items-center gap-2 rounded-2xl border border-[rgba(0,229,255,0.28)] bg-[rgba(0,229,255,0.055)] px-4 text-[16px] font-semibold text-[var(--teal)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-all duration-200 hover:border-[rgba(0,229,255,0.55)] hover:bg-[var(--teal-glow)] hover:shadow-[0_0_26px_rgba(0,229,255,0.16)]"
            >
              <Lock size={16} />
              {t("nav.admin")}
            </Link>
            <ThemeToggle />
            <LanguageToggle />
          </div>

          <button
            type="button"
            onClick={() => setOpen((prev) => !prev)}
            className="mobile-menu-button inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--nav-soft-bg)] text-[var(--text-primary)] transition-all duration-200 hover:border-[var(--teal-border)] hover:bg-[var(--teal-glow)] md:hidden"
            aria-label={open ? t("nav.closeMenu") : t("nav.openMenu")}
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </header>

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mobile-nav-drawer fixed inset-x-4 top-[88px] z-50 rounded-3xl border border-[var(--border)] bg-[var(--sidebar-bg)] p-4 shadow-[var(--shadow-card)] backdrop-blur-2xl md:hidden"
          >
            <div className="space-y-1">
              {NAV_LINKS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="block rounded-2xl px-4 py-3 text-[16px] font-semibold text-[var(--text-secondary)] transition-all duration-200 hover:bg-[var(--bg-card)] hover:text-[var(--text-primary)]"
                >
                  {t(item.labelKey)}
                </Link>
              ))}
            </div>

            <div className="mt-3 space-y-3 border-t border-[var(--border)] pt-3">
              <ThemeToggle showLabel />
              <LanguageToggle showLabel />
              <MetaMaskConnect />
              <Link
                href="/admin/login"
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-[rgba(0,229,255,0.28)] bg-[rgba(0,229,255,0.055)] px-4 text-[16px] font-semibold text-[var(--teal)] transition-all duration-200 hover:bg-[var(--teal-glow)]"
              >
                <Lock size={16} />
                {t("nav.adminLogin")}
              </Link>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
