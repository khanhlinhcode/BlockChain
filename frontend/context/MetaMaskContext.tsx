"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { ethers } from "ethers";
import { CHAIN_ID, SUPPORTED_CHAINS } from "@/lib/constants";
import { getFriendlyError } from "@/lib/errorMessages";
import { useLanguage } from "@/context/LanguageContext";

type ChainInfo = { chainId: number | null; name: string };

type EthereumEventListener = ((accounts: string[]) => void) | (() => void);

interface EthereumProvider {
  request: (args: { method: string; params?: unknown[] | object }) => Promise<unknown>;
  on?: (event: string, cb: EthereumEventListener) => void;
  removeListener?: (event: string, cb: EthereumEventListener) => void;
}

export interface MetaMaskContextValue {
  account: string | null;
  chainId: number | null;
  provider: ethers.BrowserProvider | null;
  signer: ethers.JsonRpcSigner | null;
  error: string | null;
  isConnecting: boolean;
  connecting: boolean;
  isCorrectNetwork: boolean;
  connectWallet: () => Promise<string>;
  connect: () => Promise<void>;
  signMessage: (message: string) => Promise<string>;
  getNetwork: () => Promise<ChainInfo>;
  switchNetwork: (targetChainId?: number) => Promise<void>;
  disconnect: () => void;
}

const MetaMaskContext = createContext<MetaMaskContextValue | undefined>(undefined);
const walletSessionStorageKey = "certchain_wallet_connected";

function getEthereum(): EthereumProvider | null {
  if (typeof window === "undefined") return null;
  return (window as Window & { ethereum?: EthereumProvider }).ethereum ?? null;
}

function toHexChainId(chainId: number) {
  return `0x${chainId.toString(16)}`;
}

function shouldRestoreWalletSession() {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(walletSessionStorageKey) === "true";
}

function markWalletSession(connected: boolean) {
  if (typeof window === "undefined") return;
  if (connected) {
    window.localStorage.setItem(walletSessionStorageKey, "true");
  } else {
    window.localStorage.removeItem(walletSessionStorageKey);
  }
}

async function requestChainId(ethereum: EthereumProvider): Promise<number> {
  const rawChainId = (await ethereum.request({
    method: "eth_chainId",
  })) as string;
  const parsedChainId = Number.parseInt(rawChainId, 16);
  if (!Number.isFinite(parsedChainId)) {
    throw new Error("Unable to determine chain ID from MetaMask.");
  }
  return parsedChainId;
}

export function MetaMaskProvider({ children }: { children: ReactNode }) {
  const { t } = useLanguage();
  const [account, setAccount] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [signer, setSigner] = useState<ethers.JsonRpcSigner | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const disconnect = useCallback(() => {
    markWalletSession(false);
    setAccount(null);
    setChainId(null);
    setProvider(null);
    setSigner(null);
    setError(null);
  }, []);

  const syncState = useCallback(
    async (accountsOverride?: string[], options?: { forceAccount?: boolean }) => {
      const ethereum = getEthereum();
      if (!ethereum) {
        disconnect();
        return;
      }

      try {
        const browserProvider = new ethers.BrowserProvider(ethereum);
        const accounts: string[] =
          accountsOverride ?? (await browserProvider.send("eth_accounts", []));
        const currentChainId = await requestChainId(ethereum);

        setProvider(browserProvider);
        setChainId(currentChainId);

        if (!accounts.length) {
          markWalletSession(false);
          setAccount(null);
          setSigner(null);
          return;
        }

        const canExposeAccount = options?.forceAccount || shouldRestoreWalletSession();
        if (!canExposeAccount) {
          setAccount(null);
          setSigner(null);
          return;
        }

        const walletSigner = await browserProvider.getSigner();
        setSigner(walletSigner);
        setAccount(accounts[0]);
        setError(null);
      } catch (err: unknown) {
        const message = getFriendlyError(
          err,
          t("metamask.syncFailed")
        );
        setError(message);
      }
    },
    [disconnect, t]
  );

  const connectWallet = useCallback(async () => {
    const ethereum = getEthereum();
    if (!ethereum) {
      const message = t("metamask.notInstalled");
      setError(message);
      throw new Error(message);
    }

    setIsConnecting(true);
    setError(null);

    try {
      const accounts = (await ethereum.request({
        method: "eth_requestAccounts",
      })) as string[];
      const connected = accounts?.[0];
      if (!connected) {
        throw new Error(t("metamask.noAccount"));
      }
      markWalletSession(true);
      await syncState(accounts, { forceAccount: true });
      return connected;
    } catch (err: unknown) {
      const message = getFriendlyError(err, t("metamask.connectFailed"));
      setError(message);
      throw new Error(message);
    } finally {
      setIsConnecting(false);
    }
  }, [syncState, t]);

  const connect = useCallback(async () => {
    await connectWallet();
  }, [connectWallet]);

  const signMessage = useCallback(
    async (message: string) => {
      if (!message.trim()) throw new Error(t("metamask.messageRequired"));
      if (!signer) {
        await connectWallet();
      }

      const activeSigner = signer ?? (await provider?.getSigner());
      if (!activeSigner) throw new Error(t("metamask.signerUnavailable"));
      return activeSigner.signMessage(message);
    },
    [connectWallet, provider, signer, t]
  );

  const getNetwork = useCallback(async (): Promise<ChainInfo> => {
    const ethereum = getEthereum();
    if (!ethereum) return { chainId: null, name: t("metamask.unavailable") };

    const currentProvider = provider ?? new ethers.BrowserProvider(ethereum);
    const network = await currentProvider.getNetwork();
    const currentChainId = await requestChainId(ethereum);
    return {
      chainId: currentChainId,
      name: SUPPORTED_CHAINS[currentChainId]?.name || network.name || t("common.unknown"),
    };
  }, [provider, t]);

  const switchNetwork = useCallback(
    async (targetChainId = CHAIN_ID) => {
      const ethereum = getEthereum();
      if (!ethereum) {
        const message = t("metamask.notInstalled");
        setError(message);
        throw new Error(message);
      }

      try {
        await ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: toHexChainId(targetChainId) }],
        });
        await syncState(undefined, { forceAccount: shouldRestoreWalletSession() });
      } catch (err: unknown) {
        const code =
          typeof err === "object" && err !== null && "code" in err
            ? (err as { code?: unknown }).code
            : undefined;

        if (code === 4902) {
          const chain = SUPPORTED_CHAINS[targetChainId];
          if (!chain) throw err;

          await ethereum.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: toHexChainId(targetChainId),
                chainName: chain.name,
                rpcUrls: [chain.rpcUrl],
                nativeCurrency: {
                  name: chain.symbol,
                  symbol: chain.symbol,
                  decimals: 18,
                },
                blockExplorerUrls: chain.explorer ? [chain.explorer] : [],
              },
            ],
          });
          await syncState(undefined, { forceAccount: shouldRestoreWalletSession() });
          return;
        }

        const message =
          getFriendlyError(err, t("metamask.switchFailed"));
        setError(message);
        throw new Error(message);
      }
    },
    [syncState, t]
  );

  useEffect(() => {
    const ethereum = getEthereum();
    if (!ethereum) return;

    void syncState(undefined, { forceAccount: shouldRestoreWalletSession() });

    const onAccountsChanged = (accounts: string[]) => {
      if (!accounts.length) {
        disconnect();
        return;
      }
      if (!shouldRestoreWalletSession()) return;
      void syncState(accounts, { forceAccount: true });
    };
    const onChainChanged = () => {
      window.location.reload();
    };

    ethereum.on?.("accountsChanged", onAccountsChanged);
    ethereum.on?.("chainChanged", onChainChanged);

    return () => {
      ethereum.removeListener?.("accountsChanged", onAccountsChanged);
      ethereum.removeListener?.("chainChanged", onChainChanged);
    };
  }, [disconnect, syncState]);

  const isCorrectNetwork = chainId === CHAIN_ID;

  const value = useMemo<MetaMaskContextValue>(
    () => ({
      account,
      chainId,
      provider,
      signer,
      error,
      isConnecting,
      connecting: isConnecting,
      isCorrectNetwork,
      connectWallet,
      connect,
      signMessage,
      getNetwork,
      switchNetwork,
      disconnect,
    }),
    [
      account,
      chainId,
      provider,
      signer,
      error,
      isConnecting,
      isCorrectNetwork,
      connectWallet,
      connect,
      signMessage,
      getNetwork,
      switchNetwork,
      disconnect,
    ]
  );

  return <MetaMaskContext.Provider value={value}>{children}</MetaMaskContext.Provider>;
}

export function useMetaMaskContext(): MetaMaskContextValue {
  const context = useContext(MetaMaskContext);
  if (!context) {
    throw new Error("useMetaMask must be used within Providers.");
  }
  return context;
}
