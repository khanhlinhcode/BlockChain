"use client";

import { useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
  FileText,
  LockKeyhole,
  Shield,
  ShieldCheck,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import VerifyPanel from "@/components/verification/VerifyPanel";
import { useLanguage } from "@/context/LanguageContext";

const STEPS = [
  {
    number: "01",
    titleKey: "home.step1Title",
    descriptionKey: "home.step1Body",
    icon: FileText,
  },
  {
    number: "02",
    titleKey: "home.step2Title",
    descriptionKey: "home.step2Body",
    icon: Shield,
  },
  {
    number: "03",
    titleKey: "home.step3Title",
    descriptionKey: "home.step3Body",
    icon: CheckCircle2,
  },
];

export default function HomePage() {
  const { t } = useLanguage();

  useEffect(() => {
    document.title = `${t("home.titleLine1")} ${t("home.titleLine2")} | CertChain`;
  }, [t]);

  return (
    <main className="page-bg">
      <Navbar />

      <section id="verify-section" className="mx-auto grid min-h-screen w-full max-w-7xl items-center gap-10 px-4 pb-16 pt-28 sm:px-6 lg:grid-cols-[0.92fr_1.08fr] lg:pt-24">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="max-w-2xl"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--teal-border)] bg-[var(--teal-glow)] px-4 py-2">
            <ShieldCheck size={15} className="text-[var(--teal)]" />
            <span className="eyebrow">{t("home.badge")}</span>
          </div>

          <h1 className="mt-7 text-5xl font-extrabold leading-[1.04] text-[var(--text-primary)] sm:text-6xl lg:text-7xl">
            {t("home.titleLine1")}
            <span className="gradient-text block">{t("home.titleLine2")}</span>
          </h1>

          <p className="mt-6 max-w-xl text-lg leading-8 text-[var(--text-secondary)]">
            {t("home.subtitle")}
          </p>

          <div className="mt-9 grid max-w-xl grid-cols-3 gap-3.5">
            <Signal value="10k+" label={t("home.statIssued")} />
            <Signal value="100%" label={t("home.statHashLocked")} />
            <Signal value="<2s" label={t("home.statLookup")} />
          </div>

          <div className="mt-9 flex flex-wrap gap-3.5">
            <Link href="/#verify-card" className="btn-primary inline-flex items-center gap-2 px-6 py-3.5 text-[16px]">
              {t("home.verifyNow")}
              <ArrowRight size={18} />
            </Link>
            <Link href="/admin/login" className="btn-outline inline-flex items-center gap-2 px-6 py-3.5 text-[16px]">
              <LockKeyhole size={18} />
              {t("home.adminPortal")}
            </Link>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.08 }}
          id="verify-card"
          className="scroll-mt-28 lg:pl-4"
        >
          <VerifyPanel />
        </motion.div>
      </section>

      <section className="border-y border-[var(--border)] bg-[rgba(255,255,255,0.018)] px-4 py-8">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-3 md:grid-cols-3">
          <TrustItem icon={ShieldCheck} title={t("home.trustIssuerTitle")} body={t("home.trustIssuerBody")} />
          <TrustItem icon={FileText} title={t("home.trustHashTitle")} body={t("home.trustHashBody")} />
          <TrustItem icon={Sparkles} title={t("home.trustPublicTitle")} body={t("home.trustPublicBody")} />
        </div>
      </section>

      <section id="how-it-works" className="px-4 py-24 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <p className="eyebrow">{t("home.howEyebrow")}</p>
            <h2 className="mt-3 text-4xl font-extrabold text-[var(--text-primary)]">{t("home.howTitle")}</h2>
            <p className="mt-4 text-[17px] leading-7 text-[var(--text-secondary)]">
              {t("home.howSubtitle")}
            </p>
          </div>

          <div className="mt-14 grid grid-cols-1 gap-4 md:grid-cols-3">
            {STEPS.map((step, index) => {
              const Icon = step.icon;
              return (
                <article key={step.number} className="premium-card relative p-7">
                  {index < 2 ? (
                    <span className="pointer-events-none absolute -right-3 top-12 z-10 hidden h-6 w-6 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg-surface)] text-sm text-[var(--text-muted)] md:flex">
                      <ArrowRight size={14} />
                    </span>
                  ) : null}
                  <div className="flex items-center justify-between">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--teal-border)] bg-[var(--teal-glow)] text-sm font-bold text-[var(--teal)]">
                      {step.number}
                    </span>
                    <Icon size={30} className="text-[var(--teal)]" strokeWidth={1.6} />
                  </div>
                  <h3 className="mt-6 text-lg font-bold text-[var(--text-primary)]">{t(step.titleKey)}</h3>
                  <p className="mt-3 text-[15px] leading-7 text-[var(--text-secondary)]">{t(step.descriptionKey)}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>
    </main>
  );
}

function Signal({ value, label }: { value: string; label: string }) {
  return (
    <div className="surface-panel px-4 py-[18px] transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--teal-border)] sm:px-5">
      <p className="gradient-text font-display text-[28px] font-extrabold leading-none tracking-[-0.01em] sm:text-[32px]">
        {value}
      </p>
      <p className="mt-2.5 text-[14px] font-semibold leading-5 text-[var(--text-secondary)] sm:text-[15px]">{label}</p>
    </div>
  );
}

function TrustItem({
  icon: Icon,
  title,
  body,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
}) {
  return (
    <div className="surface-panel flex gap-3 p-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[var(--teal-border)] bg-[var(--teal-glow)] text-[var(--teal)]">
        <Icon size={19} />
      </div>
      <div>
        <h3 className="text-sm font-bold text-[var(--text-primary)]">{title}</h3>
        <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">{body}</p>
      </div>
    </div>
  );
}
