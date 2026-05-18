"use client";

import Link from "next/link";
import Navbar from "@/components/Navbar";
import CertResult from "@/components/CertResult";
import { useLanguage } from "@/context/LanguageContext";
import type { VerifyResponse } from "@/types";

type VerifyByIdContentProps = {
  certId: string;
  result: VerifyResponse | null;
};

export default function VerifyByIdContent({ certId, result }: VerifyByIdContentProps) {
  const { t } = useLanguage();

  return (
    <main className="page-bg">
      <Navbar />

      <section className="px-4 pt-28 pb-20 sm:px-6">
        <div className="mx-auto w-full max-w-3xl">
          <div className="mb-5 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.1em] text-[var(--text-muted)]">{t("verify.url")}</p>
            <p className="mono mt-1 break-all text-sm text-[var(--teal)]">/verify/{certId}</p>
          </div>

          {result?.exists ? (
            <CertResult result={result} queriedId={certId} />
          ) : (
            <div className="glass p-7 sm:p-8">
              <h1 className="text-2xl font-extrabold text-[var(--amber)]">{t("verify.notFoundTitle")}</h1>
              <p className="mt-3 text-sm text-[var(--text-secondary)]">
                {t("verify.notFoundBody")}
              </p>

              <div className="mt-6">
                <Link href="/#verify-section" className="btn-outline inline-flex px-5 py-2.5 text-sm">
                  {t("verify.backToVerify")}
                </Link>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
