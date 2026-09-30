"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import VerifyByIdContent from "@/components/verification/VerifyByIdContent";
import { verifyApi } from "@/lib/api";
import { getFriendlyError } from "@/lib/errorMessages";
import { mergeBackendMetadata, useVerify } from "@/hooks/useVerify";
import { useLanguage } from "@/context/LanguageContext";
import type { VerifyResponse } from "@/types";

const CHAIN_LOOKUP_TIMEOUT_MS = 10_000;
const BACKEND_LOOKUP_TIMEOUT_MS = 5_000;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error(`${label} timed out`));
    }, timeoutMs);

    promise
      .then((value) => resolve(value))
      .catch((error) => reject(error))
      .finally(() => window.clearTimeout(timer));
  });
}

export default function VerifyByIdPage() {
  const params = useParams<{ id?: string }>();
  const { t } = useLanguage();
  const certId = decodeURIComponent(String(params.id || ""));
  const {
    verifyById: verifyOnChain,
    loading: chainLoading,
    result: chainResult,
    error: chainError,
    currentStep: chainStep,
    reset,
  } = useVerify();
  const [serverLoading, setServerLoading] = useState(true);
  const [hasCompletedLookup, setHasCompletedLookup] = useState(false);
  const [serverResult, setServerResult] = useState<VerifyResponse | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [serverStep, setServerStep] = useState("");

  useEffect(() => {
    document.title = `${t("verify.pageTitle", { id: certId })} | CertChain`;
  }, [certId, t]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const normalizedId = certId.trim().toUpperCase();
      if (!normalizedId) return;

      reset();
      setHasCompletedLookup(false);
      setServerLoading(true);
      setServerResult(null);
      setServerError(null);

      let chainData: VerifyResponse | null = null;

      try {
        setServerStep(t("verify.chainChecking"));
        chainData = await withTimeout(
          verifyOnChain(normalizedId, { backendFallback: false }),
          CHAIN_LOOKUP_TIMEOUT_MS,
          "Blockchain verification"
        );
        if (cancelled) return;

        if (chainData?.exists) {
          setServerResult({ ...chainData, source: "blockchain" });
          setHasCompletedLookup(true);
          setServerLoading(false);
          setServerStep("");
        } else {
          setServerStep(t("verify.chainNotFound"));
        }
      } catch {
        if (cancelled) return;
        setServerStep(t("verify.chainUnavailable"));
        if (!chainData) {
          chainData = null;
        }
      }

      try {
        const data = await withTimeout(
          verifyApi.byId(normalizedId),
          BACKEND_LOOKUP_TIMEOUT_MS,
          "Backend verification"
        );
        if (cancelled) return;

        if (data.exists) {
          setServerResult(
            chainData?.exists
              ? mergeBackendMetadata({ ...chainData, source: "blockchain" }, data)
              : { ...data, source: data.source || "backend" }
          );
        } else {
          setServerResult(chainData || { ...data, source: "backend" });
        }
      } catch (error) {
        if (cancelled) return;
        if (chainData) {
          setServerResult(chainData);
        } else {
          setServerError(getFriendlyError(error));
        }
      } finally {
        if (!cancelled) {
          setHasCompletedLookup(true);
          setServerLoading(false);
          setServerStep("");
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [certId, reset, t, verifyOnChain]);

  const visibleResult = hasCompletedLookup ? serverResult || chainResult : null;
  const visibleError = visibleResult ? null : serverError || chainError;

  return (
    <VerifyByIdContent
      certId={certId}
      result={visibleResult}
      loading={serverLoading || chainLoading || !hasCompletedLookup}
      error={visibleError}
      currentStep={serverStep || chainStep}
      onReset={() => {
        setHasCompletedLookup(false);
        setServerLoading(false);
        setServerResult(null);
        setServerError(null);
        reset();
      }}
    />
  );
}
