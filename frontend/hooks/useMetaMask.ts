"use client";

import { useMetaMaskContext } from "@/context/MetaMaskContext";

export type { MetaMaskContextValue as UseMetaMaskReturn } from "@/context/MetaMaskContext";

export function useMetaMask() {
  return useMetaMaskContext();
}
