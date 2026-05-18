"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useLanguage } from "@/context/LanguageContext";

type ThemeToggleProps = {
  showLabel?: boolean;
  className?: string;
};

export default function ThemeToggle({ showLabel = false, className = "" }: ThemeToggleProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const { t } = useLanguage();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isDark = mounted ? resolvedTheme !== "light" : true;
  const label = isDark ? t("theme.light") : t("theme.dark");

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={`inline-flex items-center gap-2 border border-[var(--border)] bg-[var(--nav-soft-bg)] font-semibold text-[var(--text-secondary)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-all duration-200 hover:border-[var(--teal-border)] hover:bg-[var(--teal-glow)] hover:text-[var(--teal)] ${showLabel ? "h-11 w-full justify-start rounded-xl px-3 text-[14px]" : "h-11 w-11 justify-center rounded-2xl px-0 text-[15px]"} ${className}`}
      aria-label={t("theme.toggle")}
      title={isDark ? t("theme.switchLight") : t("theme.switchDark")}
    >
      {isDark ? <Sun size={16} /> : <Moon size={16} />}
      {showLabel ? <span>{`${label}${t("theme.mode") ? ` ${t("theme.mode")}` : ""}`}</span> : null}
    </button>
  );
}
