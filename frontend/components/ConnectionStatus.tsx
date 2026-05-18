"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CircleDot } from "lucide-react";
import { CHAIN_ID, SUPPORTED_CHAINS } from "@/lib/constants";
import { useMetaMask } from "@/hooks/useMetaMask";
import { useLanguage } from "@/context/LanguageContext";

type ApiState = "checking" | "online" | "offline";

export default function ConnectionStatus() {
  const { t } = useLanguage();
  const { chainId, error: walletError, isCorrectNetwork } = useMetaMask();
  const [apiState, setApiState] = useState<ApiState>("checking");

  useEffect(() => {
    let active = true;

    const checkApi = async () => {
      try {
        const response = await fetch("/api/health", { cache: "no-store" });
        if (!active) return;
        setApiState(response.ok ? "online" : "offline");
      } catch {
        if (!active) return;
        setApiState("offline");
      }
    };

    void checkApi();
    const timer = window.setInterval(() => void checkApi(), 20000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  const state = useMemo(() => {
    if (apiState === "offline") {
      return {
        label: t("connection.apiOffline"),
        className: "text-[var(--accent-red)] border-[rgba(239,68,68,0.25)]",
        icon: <AlertTriangle size={13} />,
      };
    }

    if (walletError || (chainId !== null && !isCorrectNetwork)) {
      return {
        label: chainId === null ? t("connection.walletWarning") : t("connection.wrongNetwork"),
        className: "text-[var(--accent-amber)] border-[rgba(245,158,11,0.3)]",
        icon: <AlertTriangle size={13} />,
      };
    }

    if (apiState === "online") {
      return {
        label: t("connection.online"),
        className: "text-[var(--accent-emerald)] border-[rgba(16,185,129,0.3)]",
        icon: <CircleDot size={13} />,
      };
    }

    return {
      label: t("connection.checking"),
      className: "text-[var(--text-secondary)] border-[var(--border)]",
      icon: <CircleDot size={13} />,
    };
  }, [apiState, walletError, chainId, isCorrectNetwork, t]);

  const tooltip =
    apiState === "offline"
      ? t("connection.backendUnreachable")
      : walletError || (chainId !== null && !isCorrectNetwork)
      ? t("connection.expectedChain", { chain: SUPPORTED_CHAINS[CHAIN_ID]?.name || CHAIN_ID })
      : t("connection.healthy");

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] ${state.className}`}
      title={tooltip}
    >
      {state.icon}
      {state.label}
    </span>
  );
}
