"use client";

import { ChevronDown, Loader2, LogOut, Wallet } from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { toast } from "sonner";
import { CHAIN_ID, SUPPORTED_CHAINS } from "@/lib/constants";
import { useMetaMask } from "@/hooks/useMetaMask";
import { useLanguage } from "@/context/LanguageContext";

function truncateAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default function MetaMaskConnect({ fullWidth = false }: { fullWidth?: boolean }) {
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
  const widthClass = fullWidth ? "w-full justify-center" : "";

  if (!account) {
    return (
      <div className={fullWidth ? "w-full" : ""}>
        <button
          type="button"
          onClick={() => {
            void connectWallet().catch((err: unknown) => {
              const message = err instanceof Error ? err.message : t("wallet.connectError");
              toast.error(message);
            });
          }}
          disabled={isConnecting}
          className={`inline-flex h-11 items-center gap-2 rounded-xl border border-[var(--teal-border)] bg-[var(--surface-interactive)] px-4 text-[14px] font-semibold text-[var(--teal)] transition-[background-color,border-color,box-shadow,opacity] duration-150 hover:bg-[var(--teal-glow)] disabled:opacity-60 ${widthClass}`}
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
      <div className={fullWidth ? "w-full" : ""}>
        <button
          type="button"
          onClick={() => {
            void switchNetwork(CHAIN_ID).catch(() => undefined);
          }}
          className={`inline-flex min-h-11 items-center gap-2 rounded-xl border border-[rgba(255,184,0,0.35)] bg-[rgba(255,184,0,0.12)] px-4 py-2 text-[14px] font-semibold text-[var(--amber)] transition-colors duration-150 hover:bg-[rgba(255,184,0,0.18)] ${widthClass}`}
        >
          <Wallet size={14} />
          {t("wallet.switchTo", { chain: chainLabel })}
        </button>
        {error ? <p className="mt-1 text-[11px] text-[var(--red)]">{error}</p> : null}
      </div>
    );
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className={`inline-flex h-11 items-center gap-2 rounded-xl border border-[rgba(0,214,143,0.38)] bg-[var(--green-glow)] px-4 text-[14px] font-semibold text-[var(--green)] transition-[background-color,border-color,box-shadow] duration-150 hover:border-[rgba(0,214,143,0.62)] hover:bg-[rgba(0,214,143,0.2)] ${widthClass}`}
        >
          <span className="h-2 w-2 rounded-full bg-[var(--green)]" aria-hidden />
          <span className="mono">{truncateAddress(account)}</span>
          <ChevronDown size={12} aria-hidden />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="glass-floating z-[90] min-w-[180px] p-1.5"
        >
          <DropdownMenu.Item
            onSelect={disconnect}
            className="flex min-h-10 cursor-pointer items-center gap-2 rounded-lg px-3 text-[14px] text-[var(--text-secondary)] outline-none transition-colors duration-150 focus:bg-[var(--surface-interactive)] focus:text-[var(--text-primary)]"
          >
            <LogOut size={14} />
            {t("wallet.disconnect")}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
