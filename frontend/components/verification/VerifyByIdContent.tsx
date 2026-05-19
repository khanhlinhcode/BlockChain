"use client";

import Navbar from "@/components/Navbar";
import CertResult from "@/components/CertResult";
import { useLanguage } from "@/context/LanguageContext";
import type { VerifyResponse } from "@/types";

type VerifyByIdContentProps = {
  certId: string;
  result: VerifyResponse | null;
  loading?: boolean;
  error?: string | null;
  currentStep?: string;
  onReset?: () => void;
};

export default function VerifyByIdContent({
  certId,
  result,
  loading = false,
  error = null,
  currentStep = "",
  onReset,
}: VerifyByIdContentProps) {
  const { t } = useLanguage();

  return (
    <main className="page-bg">
      <Navbar />

      <section className="px-4 pb-20 pt-28 sm:px-6">
        <div className="mx-auto w-full max-w-3xl">
          <div className="mb-5 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.1em] text-[var(--text-muted)]">{t("verify.url")}</p>
            <p className="mono mt-1 break-all text-sm text-[var(--teal)]">/verify/{certId}</p>
          </div>

          <CertResult
            loading={loading}
            currentStep={currentStep}
            result={result}
            queriedId={certId}
            error={error}
            onReset={onReset}
          />
        </div>
      </section>
    </main>
  );
}
