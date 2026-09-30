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

      <section id="verify-section" className="mx-auto grid w-full max-w-7xl items-start gap-x-12 gap-y-7 px-4 pb-14 pt-28 sm:px-6 lg:min-h-[760px] lg:grid-cols-[0.88fr_1.12fr] lg:grid-rows-[auto_1fr] lg:items-center lg:pb-20 lg:pt-28">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="max-w-2xl lg:self-end"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--teal-border)] bg-[var(--teal-glow)] px-3.5 py-2">
            <ShieldCheck size={15} className="text-[var(--teal)]" />
            <span className="eyebrow">{t("home.badge")}</span>
          </div>

          <h1 className="hero-title mt-6 max-w-[11ch] text-[clamp(2.35rem,11vw,3rem)] font-extrabold leading-[1.02] tracking-[-0.025em] text-[var(--text-primary)] sm:max-w-[13ch] sm:text-[3.35rem] lg:max-w-[14ch] lg:text-[2.9rem] xl:max-w-[11ch] xl:text-[4.25rem]">
            {t("home.titleLine1")}
            <span className="block text-[var(--teal)]">{t("home.titleLine2")}</span>
          </h1>

          <p className="mt-5 max-w-xl text-[16px] leading-7 text-[var(--text-secondary)] sm:text-lg sm:leading-8">
            {t("home.subtitle")}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.08 }}
          id="verify-card"
          className="scroll-mt-24 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:pl-2"
        >
          <VerifyPanel />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.12 }}
          className="max-w-xl lg:self-start"
        >
          <div className="grid grid-cols-3 gap-2.5 sm:gap-3.5">
            <Signal value="10k+" label={t("home.statIssued")} />
            <Signal value="100%" label={t("home.statHashLocked")} />
            <Signal value="<2s" label={t("home.statLookup")} />
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
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
      </section>

      <section className="border-y border-[var(--border)] bg-[var(--surface-interactive)] px-4 py-7">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-0 md:grid-cols-3">
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
            {STEPS.map((step) => {
              const Icon = step.icon;
              return (
                <article key={step.number} className="surface relative p-6 sm:p-7">
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
    <div className="surface-interactive px-3 py-4 sm:px-5">
      <p className="font-display text-[24px] font-extrabold leading-none tracking-[-0.01em] text-[var(--teal)] sm:text-[30px]">
        {value}
      </p>
      <p className="mt-2 text-[12px] font-semibold leading-4 text-[var(--text-secondary)] sm:text-[14px] sm:leading-5">{label}</p>
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
    <div className="flex gap-3 border-b border-[var(--border)] py-5 last:border-b-0 md:border-b-0 md:border-r md:px-5 md:first:pl-0 md:last:border-r-0 md:last:pr-0">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center text-[var(--teal)]">
        <Icon size={19} />
      </div>
      <div>
        <h3 className="text-sm font-bold text-[var(--text-primary)]">{title}</h3>
        <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">{body}</p>
      </div>
    </div>
  );
}
