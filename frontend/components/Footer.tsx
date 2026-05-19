"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowUpRight,
  BadgeCheck,
  Clock3,
  FileSearch,
  Github,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

const productLinks = [
  { href: "/#verify-section", labelKey: "footer.verifyCertificate" },
  { href: "/#how-it-works", labelKey: "nav.howItWorks" },
  { href: "/admin/login", labelKey: "footer.adminPortal" },
];

const workflowLinks = [
  { href: "/#verify-section", labelKey: "footer.uploadPdf" },
  { href: "/#verify-section", labelKey: "footer.idLookup" },
  { href: "/admin/login", labelKey: "footer.issuerConsole" },
];

const trustSignals = [
  {
    icon: ShieldCheck,
    labelKey: "footer.signalTamperProof",
    bodyKey: "footer.signalTamperProofBody",
  },
  {
    icon: Clock3,
    labelKey: "footer.signalInstant",
    bodyKey: "footer.signalInstantBody",
  },
  {
    icon: FileSearch,
    labelKey: "footer.signalAudit",
    bodyKey: "footer.signalAuditBody",
  },
  {
    icon: BadgeCheck,
    labelKey: "footer.signalIssuer",
    bodyKey: "footer.signalIssuerBody",
  },
];

function LogoMark() {
  return (
    <Link href="/" className="group inline-flex items-center gap-3" aria-label="CertChain home">
      <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--teal-border)] bg-[var(--teal-glow)] shadow-[0_0_28px_rgba(0,229,255,0.16)] transition-all duration-200 group-hover:border-[rgba(0,229,255,0.55)]">
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
      <span className="font-display text-[26px] font-extrabold leading-none tracking-[-0.035em] text-[var(--text-primary)]">
        Cert<span className="gradient-text">Chain</span>
      </span>
    </Link>
  );
}

function FooterLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex w-fit items-center gap-1 text-[15px] font-medium text-[var(--text-secondary)] transition-all duration-200 hover:text-[var(--teal)]"
    >
      {label}
      <ArrowUpRight size={13} />
    </Link>
  );
}

function TrustSignalCard({ icon, label, body }: { icon: ReactNode; label: string; body: string }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--nav-soft-bg)] p-4 transition-all duration-200 hover:border-[var(--teal-border)] hover:bg-[var(--teal-glow)]">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--teal-border)] bg-[var(--teal-glow)] text-[var(--teal)]">
          {icon}
        </span>
        <div>
          <h3 className="text-[15px] font-bold text-[var(--text-primary)]">{label}</h3>
          <p className="mt-1 text-[13px] leading-5 text-[var(--text-secondary)]">{body}</p>
        </div>
      </div>
    </div>
  );
}

export default function Footer() {
  const pathname = usePathname();
  const { t } = useLanguage();
  const year = new Date().getFullYear();

  if (pathname.startsWith("/admin")) return null;

  return (
    <footer className="relative overflow-hidden border-t border-[var(--border)] bg-[var(--bg-base)]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[rgba(0,229,255,0.55)] to-transparent" />
      <div className="pointer-events-none absolute left-1/2 top-0 h-64 w-[52rem] -translate-x-1/2 rounded-full bg-[var(--teal-glow)] blur-3xl" />

      <div className="relative mx-auto max-w-7xl px-6 py-14 sm:px-8 lg:px-10">
        <div className="grid gap-10 lg:grid-cols-[1.15fr_0.72fr_0.75fr_1.35fr]">
          <section>
            <LogoMark />
            <p className="mt-5 max-w-md text-[16px] leading-7 text-[var(--text-secondary)]">
              {t("footer.description")}
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <span className="inline-flex items-center gap-2 rounded-full border border-[var(--teal-border)] bg-[var(--teal-glow)] px-3 py-1.5 text-[13px] font-bold uppercase tracking-[0.1em] text-[var(--teal)]">
                <ShieldCheck size={14} />
                {t("footer.publicVerification")}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--nav-soft-bg)] px-3 py-1.5 text-[13px] font-bold uppercase tracking-[0.1em] text-[var(--text-secondary)]">
                <LockKeyhole size={14} />
                {t("footer.adminControlled")}
              </span>
            </div>
          </section>

          <section>
            <h2 className="font-display text-[16px] font-bold uppercase tracking-[0.12em] text-[var(--text-primary)]">
              {t("footer.product")}
            </h2>
            <nav className="mt-5 flex flex-col gap-3">
              {productLinks.map((item) => (
                <FooterLink key={item.labelKey} href={item.href} label={t(item.labelKey)} />
              ))}
            </nav>
          </section>

          <section>
            <h2 className="font-display text-[16px] font-bold uppercase tracking-[0.12em] text-[var(--text-primary)]">
              {t("footer.workflows")}
            </h2>
            <nav className="mt-5 flex flex-col gap-3">
              {workflowLinks.map((item) => (
                <FooterLink key={item.labelKey} href={item.href} label={t(item.labelKey)} />
              ))}
            </nav>
          </section>

          <section>
            <h2 className="font-display text-[16px] font-bold uppercase tracking-[0.12em] text-[var(--text-primary)]">
              {t("footer.trustLayer")}
            </h2>
            <p className="mt-4 text-[15px] leading-7 text-[var(--text-secondary)]">
              {t("footer.trustLayerBody")}
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              {trustSignals.map((item) => {
                const Icon = item.icon;
                return (
                  <TrustSignalCard
                    key={item.labelKey}
                    icon={<Icon size={18} />}
                    label={t(item.labelKey)}
                    body={t(item.bodyKey)}
                  />
                );
              })}
            </div>
          </section>
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-[var(--border)] pt-6 text-[14px] text-[var(--text-muted)] sm:flex-row sm:items-center sm:justify-between">
          <p>{t("footer.copyright", { year })}</p>
          <div className="flex flex-wrap items-center gap-4">
            <Link href="/#verify-section" className="transition-colors duration-200 hover:text-[var(--teal)]">
              {t("nav.verify")}
            </Link>
            <Link href="/admin/login" className="transition-colors duration-200 hover:text-[var(--teal)]">
              {t("nav.admin")}
            </Link>
            <span className="inline-flex items-center gap-1">
              <Github size={14} />
              {t("footer.web3")}
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
