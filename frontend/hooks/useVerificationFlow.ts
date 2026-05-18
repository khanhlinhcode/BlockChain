"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { getFriendlyError } from "@/lib/errorMessages";
import type { VerifyResult } from "@/types";

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function useVerificationFlow() {
  const [loading, setLoading] = useState(false);
  const [verificationStep, setVerificationStep] = useState(-1);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastQueryId, setLastQueryId] = useState("");

  const run = useCallback(async (verifyPromise: Promise<VerifyResult>) => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      setVerificationStep(0);
      await wait(300);

      setVerificationStep(1);
      const data = await verifyPromise;

      setVerificationStep(2);
      await wait(200);
      setVerificationStep(3);
      await wait(200);

      setResult(data);
      if (data.exists && data.isValid) {
        toast.success("Certificate verified successfully");
      } else if (data.exists && data.isRevoked) {
        toast.warning("Certificate is revoked");
      } else {
        toast.warning("Certificate not found");
      }
    } catch (err: unknown) {
      const message = getFriendlyError(err, "Unable to verify certificate.");
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
      setVerificationStep(-1);
    }
  }, []);

  const verifyById = useCallback(
    async (certId: string) => {
      const normalizedId = certId.trim().toUpperCase();
      if (!normalizedId) {
        setError("Please enter a certificate ID.");
        return;
      }

      setLastQueryId(normalizedId);
      await run(api.verifyById(normalizedId));
    },
    [run]
  );

  const verifyByFile = useCallback(
    async (file: File | null) => {
      if (!file) {
        setError("Please upload a certificate PDF.");
        return;
      }

      setLastQueryId("");
      await run(api.verifyByFile(file));
    },
    [run]
  );

  const reset = useCallback(() => {
    setLoading(false);
    setVerificationStep(-1);
    setResult(null);
    setError(null);
    setLastQueryId("");
  }, []);

  return {
    loading,
    verificationStep,
    result,
    error,
    lastQueryId,
    hasResult: loading || Boolean(result) || Boolean(error),
    setError,
    reset,
    verifyById,
    verifyByFile,
  };
}
