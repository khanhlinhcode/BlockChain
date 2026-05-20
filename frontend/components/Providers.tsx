"use client";

import { useEffect, type ReactNode } from "react";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { SWRConfig } from "swr";
import { validateAuthSessionOnLoad } from "@/lib/auth";
import { MetaMaskProvider } from "@/context/MetaMaskContext";
import { LanguageProvider } from "@/context/LanguageContext";
import AppErrorBoundary from "./AppErrorBoundary";

function ServiceWorkerRegistrar() {
  useEffect(() => {
    validateAuthSessionOnLoad();

    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV !== "production") {
      if (typeof navigator.serviceWorker.getRegistrations === "function") {
        navigator.serviceWorker
          .getRegistrations()
          .then((registrations) => {
            registrations.forEach((registration) => {
              void registration.unregister();
            });
          })
          .catch(() => {
            // Some mobile browsers expose serviceWorker but reject registration reads.
          });
      }
      if (typeof window.caches?.keys === "function") {
        window.caches
          .keys()
          .then((keys) => Promise.all(keys.map((key) => window.caches.delete(key))))
          .catch(() => {
            // Cache cleanup is best-effort in development.
          });
      }
      return;
    }

    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Ignore registration failures.
    });
  }, []);

  return null;
}

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange={false}
    >
      <LanguageProvider>
      <SWRConfig
        value={{
          revalidateOnFocus: false,
          shouldRetryOnError: true,
          dedupingInterval: 8000,
          fetcher: async (input: string) => {
            const response = await fetch(input, { cache: "no-store" });
            if (!response.ok) {
              throw new Error(`Request failed: ${response.status}`);
            }
            return response.json();
          },
        }}
      >
        <MetaMaskProvider>
          <AppErrorBoundary>
            <ServiceWorkerRegistrar />
            {children}
            <Toaster
              richColors
              closeButton
              position="top-right"
              duration={3500}
            />
          </AppErrorBoundary>
        </MetaMaskProvider>
      </SWRConfig>
      </LanguageProvider>
    </ThemeProvider>
  );
}
