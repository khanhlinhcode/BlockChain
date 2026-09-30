"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { Lock, Menu, ShieldCheck, X } from "lucide-react";
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
    <Link href="/" className="group inline-flex min-h-11 items-center gap-2.5" aria-label="CertChain home">
      <span className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--teal-border)] bg-[var(--teal-glow)] transition-[background-color,border-color,box-shadow] duration-150 group-hover:border-[rgba(0,229,255,0.5)]">
        <svg width="23" height="23" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M7 3.5 17 3.5 22 12 17 20.5 7 20.5 2 12 7 3.5Z" fill="var(--teal)" />
          <path
            d="M8.35 7.25H15.65L19.25 12L15.65 16.75H8.35L4.75 12L8.35 7.25Z"
            stroke="rgba(2,5,7,0.45)"
            strokeWidth="1.25"
          />
        </svg>
      </span>
      <span className="font-display text-[23px] font-extrabold leading-none tracking-[-0.02em] text-[var(--text-primary)] sm:text-[25px]">
        Cert<span className="text-[var(--teal)]">Chain</span>
      </span>
    </Link>
  );
}

export default function Navbar() {
  const pathname = usePathname();
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [pathname]);

  if (pathname.startsWith("/admin")) return null;

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <header className="glass-floating fixed inset-x-0 top-0 z-50 h-[72px] rounded-none border-x-0 border-t-0">
        <div className="mx-auto flex h-full w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Logo />

          <nav className="hidden items-center gap-1 xl:flex" aria-label="Primary navigation">
            {NAV_LINKS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-lg px-3.5 py-2.5 text-[14px] font-semibold text-[var(--text-secondary)] transition-[color,background-color] duration-150 hover:bg-[var(--surface-interactive)] hover:text-[var(--text-primary)]"
              >
                {t(item.labelKey)}
              </Link>
            ))}
          </nav>

          <div className="hidden items-center justify-end gap-2 xl:flex">
            <MetaMaskConnect />
            <Link
              href="/admin/login"
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-[var(--teal-border)] bg-[var(--surface-interactive)] px-3.5 text-[14px] font-semibold text-[var(--teal)] transition-[color,background-color,border-color] duration-150 hover:bg-[var(--teal-glow)]"
            >
              <Lock size={15} />
              {t("nav.admin")}
            </Link>
            <ThemeToggle />
            <LanguageToggle />
          </div>

          <div className="flex items-center gap-2 xl:hidden">
            <Link
              href="/#verify-section"
              className="hidden min-h-11 items-center gap-2 rounded-xl bg-[var(--teal)] px-4 text-sm font-semibold text-black sm:inline-flex"
            >
              <ShieldCheck size={16} />
              {t("nav.verify")}
            </Link>
            <Dialog.Trigger asChild>
              <button
                type="button"
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-interactive)] text-[var(--text-primary)] transition-[background-color,border-color] duration-150 hover:border-[var(--teal-border)] hover:bg-[var(--teal-glow)]"
                aria-label={t("nav.openMenu")}
              >
                <Menu size={19} />
              </button>
            </Dialog.Trigger>
          </div>
        </div>
      </header>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[70] bg-black/55 backdrop-blur-[3px]" />
        <Dialog.Content
          className="glass-floating fixed inset-y-0 right-0 z-[80] flex w-[min(92vw,420px)] flex-col overflow-y-auto rounded-none border-y-0 border-r-0 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))] outline-none"
          aria-describedby={undefined}
        >
          <div className="flex items-center justify-between gap-4 border-b border-[var(--border)] pb-4">
            <Dialog.Title className="text-lg font-bold text-[var(--text-primary)]">CertChain</Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-interactive)] text-[var(--text-primary)]"
                aria-label={t("nav.closeMenu")}
              >
                <X size={19} />
              </button>
            </Dialog.Close>
          </div>

          <nav className="mt-5 grid gap-1" aria-label="Mobile navigation">
            {NAV_LINKS.map((item) => (
              <Dialog.Close asChild key={item.href}>
                <Link
                  href={item.href}
                  className="flex min-h-12 items-center rounded-xl px-4 text-[16px] font-semibold text-[var(--text-secondary)] transition-[color,background-color] duration-150 hover:bg-[var(--surface-interactive)] hover:text-[var(--text-primary)]"
                >
                  {t(item.labelKey)}
                </Link>
              </Dialog.Close>
            ))}
          </nav>

          <div className="mt-auto grid gap-3 border-t border-[var(--border)] pt-5">
            <MetaMaskConnect fullWidth />
            <div className="grid grid-cols-2 gap-3">
              <ThemeToggle showLabel />
              <LanguageToggle showLabel />
            </div>
            <Dialog.Close asChild>
              <Link
                href="/admin/login"
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-[var(--teal-border)] bg-[var(--surface-interactive)] px-4 text-[15px] font-semibold text-[var(--teal)]"
              >
                <Lock size={16} />
                {t("nav.adminLogin")}
              </Link>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
