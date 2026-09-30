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

      <section className="px-4 pb-20 pt-24 sm:px-6 sm:pt-28">
        <div className="mx-auto w-full max-w-3xl">
          <CertResult
            loading={loading}
            currentStep={currentStep}
            result={result}
            queriedId={certId}
            error={error}
            onReset={onReset}
          />

          <details className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface-interactive)] px-4 py-3 text-sm">
            <summary className="cursor-pointer font-semibold text-[var(--text-secondary)]">
              {t("verify.url")}
            </summary>
            <p className="mono mt-2 break-all text-xs text-[var(--teal)] sm:text-sm">/verify/{certId}</p>
          </details>
        </div>
      </section>
    </main>
  );
}
