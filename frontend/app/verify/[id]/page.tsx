"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import VerifyByIdContent from "@/components/verification/VerifyByIdContent";
import { useVerify } from "@/hooks/useVerify";

export default function VerifyByIdPage() {
  const params = useParams<{ id?: string }>();
  const certId = decodeURIComponent(String(params.id || ""));
  const { verifyById, loading, result, error, currentStep, reset } = useVerify();

  useEffect(() => {
    document.title = `Verify ${certId} | CertChain`;
  }, [certId]);

  useEffect(() => {
    if (!certId) return;
    void verifyById(certId);
  }, [certId, verifyById]);

  return (
    <VerifyByIdContent
      certId={certId}
      result={result}
      loading={loading}
      error={error}
      currentStep={currentStep}
      onReset={reset}
    />
  );
}
