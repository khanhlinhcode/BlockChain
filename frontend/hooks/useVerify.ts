"use client";

import { useState, useCallback } from "react";
import { verifyApi } from "@/lib/api";
import { getFriendlyError } from "@/lib/errorMessages";
import type { VerifyResult } from "@/types";

export function useVerify() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const verifyByHash = useCallback(async (certHash: string) => {
    try {
      setLoading(true);
      setError(null);
      const data = await verifyApi.byHash(certHash);
      setResult(data);
      return data;
    } catch (err: unknown) {
      const msg = getFriendlyError(err, "Verification failed");
      setError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const verifyByFile = useCallback(async (file: File) => {
    try {
      setLoading(true);
      setError(null);
      const data = await verifyApi.byFile(file);
      setResult(data);
      return data;
    } catch (err: unknown) {
      const msg = getFriendlyError(err, "Verification failed");
      setError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return { loading, result, error, verifyByHash, verifyByFile, reset };
}
