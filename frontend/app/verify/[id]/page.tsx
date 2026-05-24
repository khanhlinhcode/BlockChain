"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import VerifyByIdContent from "@/components/verification/VerifyByIdContent";
import { verifyApi } from "@/lib/api";
import { getFriendlyError } from "@/lib/errorMessages";
import { useVerify } from "@/hooks/useVerify";
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
    document.title = `Verify ${certId} | CertChain`;
  }, [certId]);

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
        setServerStep("Kiểm tra trực tiếp trên Sepolia blockchain...");
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
          return;
        }

        setServerStep("Không thấy trên blockchain, đối chiếu máy chủ...");
      } catch {
        if (cancelled) return;
        setServerStep("Blockchain chưa phản hồi, đối chiếu máy chủ...");
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
          setServerResult({ ...data, source: data.source || "backend" });
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
  }, [certId, reset, verifyOnChain]);

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
