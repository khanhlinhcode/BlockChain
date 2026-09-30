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
    <Link href="/" className="group inline-flex items-center gap-3.5" aria-label="CertChain home">
      <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--teal-border)] bg-[var(--teal-glow)] transition-[background-color,border-color] duration-150 group-hover:border-[rgba(0,229,255,0.5)]">
        <svg width="27" height="27" viewBox="0 0 24 24" fill="none" aria-hidden>
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
      <span className="font-display text-[29px] font-extrabold leading-none tracking-[-0.02em] text-[var(--text-primary)]">
        Cert<span className="text-[var(--teal)]">Chain</span>
      </span>
    </Link>
  );
}

function FooterHeading({ children }: { children: ReactNode }) {
  return (
    <div>
      <span className="block h-0.5 w-8 rounded-full bg-[var(--teal)]" />
      <h2 className="mt-4 font-display text-[18px] font-bold leading-6 tracking-[-0.01em] text-[var(--text-primary)]">
        {children}
      </h2>
    </div>
  );
}

function FooterLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="group inline-flex min-h-11 w-fit items-center gap-2 py-1.5 text-[15px] font-medium leading-6 text-[var(--text-secondary)] transition-colors duration-150 hover:text-[var(--teal)]"
    >
      <span>{label}</span>
      <ArrowUpRight size={14} className="opacity-55 transition-[opacity,transform] duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100" />
    </Link>
  );
}

function TrustSignalCard({ icon, label, body }: { icon: ReactNode; label: string; body: string }) {
  return (
    <div className="border-b border-[var(--border)] py-4 last:border-b-0">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center text-[var(--teal)]">
          {icon}
        </span>
        <div>
          <h3 className="text-[16px] font-semibold leading-6 tracking-[-0.005em] text-[var(--text-primary)]">{label}</h3>
          <p className="mt-1.5 text-[14.5px] leading-6 text-[var(--text-secondary)]">{body}</p>
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
    <footer className="relative border-t border-[var(--border)] bg-[var(--bg-surface)]">

      <div className="relative mx-auto max-w-7xl px-6 py-16 sm:px-8 lg:px-10">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-[1.1fr_0.65fr_0.7fr_1.25fr]">
          <section>
            <LogoMark />
            <p className="mt-6 max-w-md text-[17px] font-normal leading-8 text-[var(--text-secondary)]">
              {t("footer.description")}
            </p>

            <div className="mt-6 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-[var(--teal-border)] bg-[var(--teal-glow)] px-3.5 py-2 text-[14px] font-semibold tracking-[-0.005em] text-[var(--teal)]">
                <ShieldCheck size={15} />
                {t("footer.publicVerification")}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--nav-soft-bg)] px-3.5 py-2 text-[14px] font-semibold tracking-[-0.005em] text-[var(--text-secondary)]">
                <LockKeyhole size={15} />
                {t("footer.adminControlled")}
              </span>
            </div>
          </section>

          <section>
            <FooterHeading>{t("footer.product")}</FooterHeading>
            <nav className="mt-5 flex flex-col gap-2.5">
              {productLinks.map((item) => (
                <FooterLink key={item.labelKey} href={item.href} label={t(item.labelKey)} />
              ))}
            </nav>
          </section>

          <section>
            <FooterHeading>{t("footer.workflows")}</FooterHeading>
            <nav className="mt-5 flex flex-col gap-2.5">
              {workflowLinks.map((item) => (
                <FooterLink key={item.labelKey} href={item.href} label={t(item.labelKey)} />
              ))}
            </nav>
          </section>

          <section>
            <FooterHeading>{t("footer.trustLayer")}</FooterHeading>
            <p className="mt-4 text-[16px] font-normal leading-8 text-[var(--text-secondary)]">
              {t("footer.trustLayerBody")}
            </p>
            <div className="mt-3 grid sm:grid-cols-2 sm:gap-x-5 lg:grid-cols-1 xl:grid-cols-2">
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

        <div className="mt-12 flex flex-col gap-4 border-t border-[var(--border)] pt-6 text-[15px] font-medium leading-6 text-[var(--text-muted)] sm:flex-row sm:items-center sm:justify-between">
          <p>{t("footer.copyright", { year })}</p>
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/#verify-section" className="rounded-lg px-2.5 py-1 transition-colors duration-150 hover:bg-[var(--teal-glow)] hover:text-[var(--teal)]">
              {t("nav.verify")}
            </Link>
            <Link href="/admin/login" className="rounded-lg px-2.5 py-1 transition-colors duration-150 hover:bg-[var(--teal-glow)] hover:text-[var(--teal)]">
              {t("nav.admin")}
            </Link>
            <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1">
              <Github size={14} />
              {t("footer.web3")}
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
