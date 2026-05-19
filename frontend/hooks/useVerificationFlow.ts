"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { getFriendlyError } from "@/lib/errorMessages";
import { useVerify } from "@/hooks/useVerify";
import type { VerifyResult } from "@/types";

function stepFromText(step: string): number {
  const lower = step.toLowerCase();
  if (lower.includes("hash")) return 0;
  if (lower.includes("kết nối") || lower.includes("connect")) return 1;
  if (lower.includes("truy vấn") || lower.includes("contract")) return 1;
  if (lower.includes("xác thực") || lower.includes("result")) return 3;
  return step ? 1 : -1;
}

export function useVerificationFlow() {
  const verifier = useVerify();
  const [verificationStep, setVerificationStep] = useState(-1);
  const [lastQueryId, setLastQueryId] = useState("");

  useEffect(() => {
    setVerificationStep(stepFromText(verifier.currentStep));
  }, [verifier.currentStep]);

  const notifyResult = useCallback((data: VerifyResult | null) => {
    if (!data) return;
    if (data.exists && data.isValid) {
      toast.success("Certificate verified directly on blockchain");
    } else if (data.exists && data.isRevoked) {
      toast.warning("Certificate is revoked");
    } else {
      toast.warning("Certificate not found");
    }
  }, []);

  const verifyById = useCallback(
    async (certId: string) => {
      const normalizedId = certId.trim().toUpperCase();
      if (!normalizedId) {
        verifier.setError("Please enter a certificate ID.");
        return;
      }

      setLastQueryId(normalizedId);
      try {
        const data = await verifier.verifyById(normalizedId);
        notifyResult(data);
      } catch (err: unknown) {
        const message = getFriendlyError(err, "Unable to verify certificate.");
        verifier.setError(message);
        toast.error(message);
      }
    },
    [notifyResult, verifier]
  );

  const verifyByFile = useCallback(
    async (file: File | null) => {
      if (!file) {
        verifier.setError("Please upload a certificate PDF.");
        return;
      }

      setLastQueryId("");
      try {
        const data = await verifier.verifyByFile(file);
        notifyResult(data);
      } catch (err: unknown) {
        const message = getFriendlyError(err, "Unable to verify certificate.");
        verifier.setError(message);
        toast.error(message);
      }
    },
    [notifyResult, verifier]
  );

  const reset = useCallback(() => {
    verifier.reset();
    setVerificationStep(-1);
    setLastQueryId("");
  }, [verifier]);

  return {
    loading: verifier.loading,
    verificationStep,
    currentStep: verifier.currentStep,
    result: verifier.result,
    error: verifier.error,
    lastQueryId,
    hasResult: verifier.loading || Boolean(verifier.result) || Boolean(verifier.error),
    setError: verifier.setError,
    reset,
    verifyById,
    verifyByFile,
  };
}
