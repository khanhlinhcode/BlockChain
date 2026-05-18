"use client";

import { useState } from "react";
import { ChevronDown, Loader2, LogOut, Wallet } from "lucide-react";
import { toast } from "sonner";
import { CHAIN_ID, SUPPORTED_CHAINS } from "@/lib/constants";
import { useMetaMask } from "@/hooks/useMetaMask";
import { useLanguage } from "@/context/LanguageContext";

function truncateAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default function MetaMaskConnect() {
  const { t } = useLanguage();
  const {
    account,
    error,
    isConnecting,
    isCorrectNetwork,
    connectWallet,
    disconnect,
    switchNetwork,
  } = useMetaMask();
  const [open, setOpen] = useState(false);

  if (!account) {
    return (
      <div>
        <button
          type="button"
          onClick={() => {
            void connectWallet().catch((err: unknown) => {
              const message = err instanceof Error ? err.message : t("wallet.connectError");
              toast.error(message);
            });
          }}
          disabled={isConnecting}
          className="inline-flex h-11 items-center gap-2 rounded-2xl border border-[var(--teal-border)] bg-[rgba(0,229,255,0.045)] px-4 text-[14px] font-semibold text-[var(--teal)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-all duration-200 hover:bg-[var(--teal-glow)] hover:shadow-[0_0_24px_rgba(0,229,255,0.14)] disabled:opacity-60"
        >
          {isConnecting ? <Loader2 size={14} className="animate-spin" /> : <Wallet size={14} />}
          {t("wallet.wallet")}
        </button>
      </div>
    );
  }

  if (!isCorrectNetwork) {
    const chainLabel = SUPPORTED_CHAINS[CHAIN_ID]?.name ?? `Chain ${CHAIN_ID}`;
    return (
      <div>
        <button
          type="button"
          onClick={() => {
            void switchNetwork(CHAIN_ID).catch(() => undefined);
          }}
          className="inline-flex h-11 items-center gap-2 rounded-2xl border border-[rgba(255,184,0,0.35)] bg-[rgba(255,184,0,0.12)] px-4 text-[14px] font-semibold text-[var(--amber)] transition-all duration-200 hover:bg-[rgba(255,184,0,0.18)]"
        >
          <Wallet size={14} />
          {t("wallet.switchTo", { chain: chainLabel })}
        </button>
        {error ? <p className="mt-1 text-[11px] text-[var(--red)]">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex h-11 items-center gap-2 rounded-2xl border border-[rgba(0,214,143,0.38)] bg-[var(--green-glow)] px-4 text-[14px] font-semibold text-[var(--green)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-all duration-200 hover:border-[rgba(0,214,143,0.62)] hover:bg-[rgba(0,214,143,0.2)] hover:shadow-[0_0_24px_rgba(0,214,143,0.14)]"
      >
        <span className="h-2 w-2 rounded-full bg-[var(--green)]" />
        <span className="mono">{truncateAddress(account)}</span>
        <ChevronDown size={12} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open ? (
        <div className="absolute right-0 z-30 mt-2 min-w-[150px] rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-1 shadow-[var(--shadow-card)]">
          <button
            type="button"
            onClick={() => {
              disconnect();
              setOpen(false);
            }}
            className="inline-flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[14px] text-[var(--text-secondary)] transition-all duration-200 hover:bg-[var(--bg-card)] hover:text-[var(--text-primary)]"
          >
            <LogOut size={12} />
            {t("wallet.disconnect")}
          </button>
        </div>
      ) : null}
    </div>
  );
}
