"use client";

import { useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  Database,
  KeyRound,
  LockKeyhole,
  ScanSearch,
  ShieldCheck,
  UploadCloud,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import { useLanguage } from "@/context/LanguageContext";

const ABOUT_CARDS = [
  {
    titleKey: "home.aboutCard1Title",
    bodyKey: "home.aboutCard1Body",
    icon: Building2,
  },
  {
    titleKey: "home.aboutCard2Title",
    bodyKey: "home.aboutCard2Body",
    icon: ShieldCheck,
  },
  {
    titleKey: "home.aboutCard3Title",
    bodyKey: "home.aboutCard3Body",
    icon: Database,
  },
  {
    titleKey: "home.aboutCard4Title",
    bodyKey: "home.aboutCard4Body",
    icon: BadgeCheck,
  },
];

const ABOUT_FLOW = [
  {
    titleKey: "home.aboutFlow1Title",
    bodyKey: "home.aboutFlow1Body",
    icon: UploadCloud,
  },
  {
    titleKey: "home.aboutFlow2Title",
    bodyKey: "home.aboutFlow2Body",
    icon: KeyRound,
  },
  {
    titleKey: "home.aboutFlow3Title",
    bodyKey: "home.aboutFlow3Body",
    icon: Workflow,
  },
  {
    titleKey: "home.aboutFlow4Title",
    bodyKey: "home.aboutFlow4Body",
    icon: ScanSearch,
  },
];

export default function AboutPage() {
  const { t } = useLanguage();

  useEffect(() => {
    document.title = `${t("nav.about")} | CertChain`;
  }, [t]);

  return (
    <main className="page-bg min-h-screen">
      <Navbar />

      <section className="mx-auto max-w-7xl px-4 pb-24 pt-32 sm:px-6 lg:pt-36">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start"
        >
          <div className="premium-card p-7 sm:p-8">
            <p className="eyebrow">{t("home.aboutEyebrow")}</p>
            <h1 className="mt-4 text-4xl font-extrabold leading-tight text-[var(--text-primary)] sm:text-6xl">
              {t("home.aboutTitle")}
            </h1>
            <p className="mt-5 text-[18px] leading-8 text-[var(--text-secondary)]">
              {t("home.aboutSubtitle")}
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <Metric value="SHA-256" label={t("home.aboutMetricHash")} />
              <Metric value="QR" label={t("home.aboutMetricQr")} />
              <Metric value="On-chain" label={t("home.aboutMetricChain")} />
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/#verify-section" className="btn-primary inline-flex items-center gap-2 px-5 py-3 text-sm">
                {t("home.aboutPrimaryCta")}
                <ArrowRight size={16} />
              </Link>
              <Link href="/admin/login" className="btn-outline inline-flex items-center gap-2 px-5 py-3 text-sm">
                <LockKeyhole size={16} />
                {t("home.aboutAdminCta")}
              </Link>
            </div>
          </div>

          <div className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {ABOUT_CARDS.map((item) => {
                const Icon = item.icon;
                return (
                  <InfoCard
                    key={item.titleKey}
                    icon={Icon}
                    title={t(item.titleKey)}
                    body={t(item.bodyKey)}
                  />
                );
              })}
            </div>

            <div className="premium-card p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="eyebrow">{t("home.aboutFlowEyebrow")}</p>
                  <h2 className="mt-2 text-2xl font-extrabold text-[var(--text-primary)]">{t("home.aboutFlowTitle")}</h2>
                </div>
                <span className="rounded-full border border-[var(--teal-border)] bg-[var(--teal-glow)] px-3 py-1.5 text-xs font-bold uppercase tracking-[0.1em] text-[var(--teal)]">
                  {t("home.aboutFlowBadge")}
                </span>
              </div>

              <div className="mt-6 grid gap-3">
                {ABOUT_FLOW.map((item, index) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.titleKey} className="flex gap-4 rounded-2xl border border-[var(--border)] bg-[var(--nav-soft-bg)] p-4">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[var(--teal-border)] bg-[var(--teal-glow)] text-[var(--teal)]">
                        <Icon size={19} />
                      </span>
                      <div>
                        <p className="mono text-xs font-bold text-[var(--text-muted)]">0{index + 1}</p>
                        <h3 className="mt-1 text-base font-bold text-[var(--text-primary)]">{t(item.titleKey)}</h3>
                        <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">{t(item.bodyKey)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </motion.div>
      </section>
    </main>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div className="surface-panel px-4 py-4">
      <p className="gradient-text text-2xl font-extrabold leading-none">{value}</p>
      <p className="mt-2 text-xs font-medium text-[var(--text-muted)]">{label}</p>
    </div>
  );
}

function InfoCard({ icon: Icon, title, body }: { icon: LucideIcon; title: string; body: string }) {
  return (
    <article className="surface-panel p-5 transition-all duration-200 hover:border-[var(--teal-border)] hover:bg-[var(--teal-glow)]">
      <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--teal-border)] bg-[var(--teal-glow)] text-[var(--teal)]">
        <Icon size={20} />
      </span>
      <h2 className="mt-4 text-lg font-bold text-[var(--text-primary)]">{title}</h2>
      <p className="mt-2 text-[15px] leading-7 text-[var(--text-secondary)]">{body}</p>
    </article>
  );
}
