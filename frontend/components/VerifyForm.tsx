"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Search, Upload, QrCode, Loader2, type LucideIcon } from "lucide-react";
import { useDropzone } from "react-dropzone";
import CertResult from "@/components/CertResult";
import { useVerify } from "@/hooks/useVerify";
import { useLanguage } from "@/context/LanguageContext";

const QRScanner = dynamic(() => import("./QRScanner"), { ssr: false });

type Tab = "id" | "file" | "qr";

export default function VerifyForm() {
  const router = useRouter();
  const { t } = useLanguage();
  const [tab, setTab] = useState<Tab>("id");
  const [certId, setCertId] = useState("");
  const {
    verifyById,
    verifyByFile,
    loading,
    result,
    error,
    currentStep,
    setError,
    reset,
  } = useVerify();

  const handleIdSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = certId.trim();
    if (!normalized) {
      setError(t("verify.idRequired"));
      return;
    }
    await verifyById(normalized);
  };

  const onDrop = useCallback(async (files: File[]) => {
    if (!files.length) return;
    await verifyByFile(files[0]);
  }, [verifyByFile]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024,
    disabled: loading,
  });

  const handleQR = (id: string) => {
    router.push(`/verify/${encodeURIComponent(id)}`);
  };

  const switchTab = (nextTab: Tab) => {
    setTab(nextTab);
    reset();
  };

  const tabs: { id: Tab; label: string; icon: LucideIcon }[] = [
    { id: "id", label: t("common.certificateId"), icon: Search },
    { id: "file", label: t("verify.tabFile"), icon: Upload },
    { id: "qr", label: t("verifyForm.scanQr"), icon: QrCode },
  ];

  return (
    <div>
      <div className="mb-6 flex gap-1 rounded-xl bg-[rgba(255,255,255,0.03)] p-1">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => switchTab(item.id)}
            disabled={loading}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-all ${
              tab === item.id
                ? "bg-[rgba(0,212,255,0.1)] text-[var(--accent-teal)]"
                : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            } ${loading ? "cursor-not-allowed opacity-60" : ""}`}
          >
            <item.icon size={15} />
            <span className="hidden sm:inline">{item.label}</span>
          </button>
        ))}
      </div>

      {error && !loading ? (
        <div className="mb-4 rounded-xl border border-[rgba(239,68,68,0.15)] bg-[rgba(239,68,68,0.08)] px-4 py-3 text-sm text-[var(--accent-red)]">
          {error}
        </div>
      ) : null}

      {tab === "id" && (
        <form onSubmit={handleIdSubmit} className="flex gap-3">
          <input
            type="text"
            value={certId}
            onChange={(e) => setCertId(e.target.value)}
            placeholder={t("verifyForm.placeholder")}
            disabled={loading}
            className="input-dark flex-1 px-4 py-3 text-sm"
          />
          <button
            type="submit"
            disabled={!certId.trim() || loading}
            className="btn-primary inline-flex items-center gap-2 px-5 py-3 disabled:opacity-40"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
            {loading ? t("verifyForm.verifying") : t("verifyForm.verify")}
          </button>
        </form>
      )}

      {tab === "file" && (
        <div
          {...getRootProps()}
          className={`cursor-pointer rounded-xl border-2 border-dashed p-10 text-center transition-all ${
            isDragActive
              ? "border-[var(--accent-teal)] bg-[rgba(0,212,255,0.05)]"
              : "border-[var(--border)] hover:border-[var(--border-hover)] hover:bg-[rgba(255,255,255,0.02)]"
          } ${loading ? "pointer-events-none opacity-70" : ""}`}
        >
          <input {...getInputProps({ accept: "application/pdf,.pdf", capture: false })} />
          <Upload size={32} className={`mx-auto mb-3 ${isDragActive ? "text-[var(--accent-teal)]" : "text-[var(--text-muted)]"}`} />
          {loading ? (
            <div className="flex items-center justify-center gap-2 text-[var(--text-secondary)]">
              <Loader2 size={16} className="animate-spin" /> {currentStep || t("verifyForm.verifying")}
            </div>
          ) : (
            <>
              <p className="mb-1 text-sm font-medium text-[var(--text-primary)]">
                {isDragActive ? t("verifyForm.dropActive") : t("verifyForm.dragDrop")}
              </p>
              <p className="text-xs text-[var(--text-muted)]">{t("verifyForm.pdfOnly")}</p>
            </>
          )}
        </div>
      )}

      {tab === "qr" && (
        <QRScanner
          onDetect={handleQR}
          onUseFileUpload={() => switchTab("file")}
        />
      )}

      {(loading || result || error) && tab !== "qr" ? (
        <div className="mt-5">
          <CertResult
            loading={loading}
            currentStep={currentStep}
            result={result}
            queriedId={certId.trim()}
            error={error}
            onReset={reset}
          />
        </div>
      ) : null}
    </div>
  );
}
