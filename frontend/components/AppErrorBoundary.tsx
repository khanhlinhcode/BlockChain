"use client";

import type { ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { ErrorBoundary, type FallbackProps } from "react-error-boundary";
import { useLanguage } from "@/context/LanguageContext";

function ErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  const { t } = useLanguage();
  const message = error instanceof Error ? error.message : t("error.unexpected");

  return (
    <div className="glass-card border-[rgba(239,68,68,0.25)] p-5 text-left">
      <div className="inline-flex items-center gap-2 text-[var(--accent-red)]">
        <AlertTriangle size={16} />
        <span className="text-sm font-semibold">{t("error.title")}</span>
      </div>
      <p className="mt-2 text-xs text-[var(--text-secondary)]">
        {message}
      </p>
      <button
        type="button"
        onClick={resetErrorBoundary}
        className="btn-ghost mt-4 inline-flex items-center gap-2 px-3 py-2 text-xs"
      >
        <RefreshCw size={13} />
        {t("error.tryAgain")}
      </button>
    </div>
  );
}

export default function AppErrorBoundary({ children }: { children: ReactNode }) {
  return <ErrorBoundary FallbackComponent={ErrorFallback}>{children}</ErrorBoundary>;
}
