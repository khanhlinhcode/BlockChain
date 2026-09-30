"use client";

import { Languages } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

type LanguageToggleProps = {
  showLabel?: boolean;
  className?: string;
};

export default function LanguageToggle({ showLabel = false, className = "" }: LanguageToggleProps) {
  const { language, toggleLanguage, t } = useLanguage();

  return (
    <button
      type="button"
      onClick={toggleLanguage}
      className={`inline-flex items-center gap-2 border border-[var(--border)] bg-[var(--surface-interactive)] font-semibold text-[var(--text-secondary)] transition-[color,background-color,border-color] duration-150 hover:border-[var(--teal-border)] hover:bg-[var(--teal-glow)] hover:text-[var(--teal)] ${showLabel ? "h-11 w-full justify-start rounded-xl px-3 text-[14px]" : "h-11 rounded-xl px-3 text-[14px]"} ${className}`}
      aria-label={t("language.toggle")}
      title={t("language.toggle")}
    >
      <Languages size={16} />
      <span className="mono text-[13px] font-bold">{language === "en" ? "EN" : "VI"}</span>
      {showLabel ? <span>{t("language.toggle")}</span> : null}
    </button>
  );
}
