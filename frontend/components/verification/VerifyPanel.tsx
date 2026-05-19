"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useDropzone } from "react-dropzone";
import { AnimatePresence, motion } from "framer-motion";
import {
  Camera,
  CheckCircle2,
  FileUp,
  Hash,
  Loader2,
  ScanLine,
  ShieldCheck,
} from "lucide-react";
import CertResult from "@/components/CertResult";
import { useVerificationFlow } from "@/hooks/useVerificationFlow";
import { useLanguage } from "@/context/LanguageContext";

type VerifyTab = "id" | "file";

function ScannerLoading() {
  const { t } = useLanguage();
  return (
    <div className="premium-card p-6 text-sm text-[var(--text-secondary)]">
      {t("verify.scannerLoading")}
    </div>
  );
}

const QRScanner = dynamic(() => import("@/components/QRScanner"), {
  ssr: false,
  loading: () => <ScannerLoading />,
});

function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
}

export default function VerifyPanel() {
  const router = useRouter();
  const { t } = useLanguage();
  const [tab, setTab] = useState<VerifyTab>("id");
  const [certId, setCertId] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);

  const {
    loading,
    verificationStep,
    currentStep,
    result,
    error,
    lastQueryId,
    hasResult,
    setError,
    reset,
    verifyById,
    verifyByFile,
  } = useVerificationFlow();

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { "application/pdf": [".pdf"] },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024,
    disabled: loading,
    onDropAccepted(files) {
      setSelectedFile(files[0] ?? null);
      setError(null);
    },
    onDropRejected() {
      setSelectedFile(null);
      setError(t("verify.pdfOnlyError"));
    },
  });

  const onScannerDetect = (value: string) => {
    const id = value.trim();
    if (!id) return;
    setScannerOpen(false);
    router.push(`/verify/${encodeURIComponent(id)}`);
  };

  const resetVerification = () => {
    reset();
    setCertId("");
    setSelectedFile(null);
    setTab("id");
    window.requestAnimationFrame(() => {
      document.getElementById("verify-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  return (
    <>
      <section className="premium-card overflow-hidden">
        <div className="border-b border-[var(--border)] bg-[rgba(255,255,255,0.025)] px-5 py-4 sm:px-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="eyebrow">{t("verify.console")}</p>
              <h2 className="mt-1 text-xl font-bold text-[var(--text-primary)]">{t("verify.title")}</h2>
            </div>
            <div className="hidden rounded-full border border-[rgba(0,214,143,0.3)] bg-[var(--green-glow)] px-3 py-1.5 text-xs text-[var(--green)] sm:inline-flex">
              <ShieldCheck size={14} className="mr-1.5" />
              {t("verify.live")}
            </div>
          </div>
        </div>

        <div className="p-5 sm:p-6">
          <div className="surface-panel p-1">
            <div className="grid grid-cols-2 gap-1">
              <button
                type="button"
                onClick={() => setTab("id")}
                disabled={loading}
                className={`rounded-lg px-4 py-2.5 text-sm font-semibold ${
                  tab === "id"
                    ? "bg-[var(--bg-card-hover)] text-[var(--text-primary)] shadow-[0_8px_22px_rgba(0,0,0,0.24)]"
                    : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                }`}
              >
                {t("verify.tabId")}
              </button>
              <button
                type="button"
                onClick={() => setTab("file")}
                disabled={loading}
                className={`rounded-lg px-4 py-2.5 text-sm font-semibold ${
                  tab === "file"
                    ? "bg-[var(--bg-card-hover)] text-[var(--text-primary)] shadow-[0_8px_22px_rgba(0,0,0,0.24)]"
                    : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                }`}
              >
                {t("verify.tabFile")}
              </button>
            </div>
          </div>

          {tab === "id" ? (
            <form
              className="mt-5"
              onSubmit={(event) => {
                event.preventDefault();
                if (!certId.trim()) {
                  setError(t("verify.idRequired"));
                  return;
                }
                void verifyById(certId);
              }}
            >
              <label className="text-xs font-semibold uppercase text-[var(--text-muted)]">{t("common.certificateId")}</label>
              <div className="relative mt-2">
                <Hash size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                <input
                  value={certId}
                  onChange={(event) => setCertId(event.target.value)}
                  disabled={loading}
                  className="mono h-14 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-input)] pl-12 pr-4 text-sm"
                  placeholder="CERT-2026-0DXT0YUK"
                />
              </div>

              <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[rgba(255,255,255,0.018)] p-3">
                <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                  <ScanLine size={16} className="text-[var(--teal)]" />
                  {t("verify.scanInstead")}
                </div>
                <button
                  type="button"
                  onClick={() => setScannerOpen(true)}
                  disabled={loading}
                  className="btn-outline inline-flex items-center gap-2 px-3 py-2 text-xs"
                >
                  <Camera size={15} />
                  {t("verify.openCamera")}
                </button>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary mt-5 inline-flex h-[52px] w-full items-center justify-center gap-2 rounded-xl text-base"
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : null}
                {loading ? t("verify.verifying") : t("verify.submit")}
              </button>
            </form>
          ) : (
            <div className="mt-5">
              <div
                {...getRootProps()}
                className={`cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-all duration-200 sm:p-10 ${
                  isDragActive
                    ? "border-[var(--teal)] bg-[var(--teal-glow)]"
                    : "border-[var(--border)] hover:border-[var(--teal)] hover:bg-[var(--teal-glow)]"
                } ${loading ? "pointer-events-none opacity-70" : ""}`}
              >
                <input {...getInputProps({ accept: "application/pdf,.pdf", capture: false })} />
                <FileUp size={44} className="mx-auto text-[var(--text-muted)]" />
                <p className="mt-4 text-base font-semibold text-[var(--text-primary)]">{t("verify.dropPdf")}</p>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">{t("verify.clickBrowse")}</p>
                <p className="mt-3 text-xs text-[var(--text-muted)]">{t("verify.pdfLimit")}</p>
              </div>

              {selectedFile ? (
                <div className="mt-4 flex items-center gap-3 rounded-xl border border-[rgba(0,214,143,0.35)] bg-[var(--green-glow)] px-4 py-3 text-sm text-[var(--text-primary)]">
                  <CheckCircle2 size={18} className="shrink-0 text-[var(--green)]" />
                  <span className="truncate">{selectedFile.name}</span>
                  <span className="ml-auto text-[var(--text-secondary)]">{formatFileSize(selectedFile.size)}</span>
                </div>
              ) : null}

              <button
                type="button"
                onClick={() => void verifyByFile(selectedFile)}
                disabled={loading || !selectedFile}
                className="btn-primary mt-5 inline-flex h-[52px] w-full items-center justify-center gap-2 rounded-xl text-base"
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : null}
                {loading ? t("verify.verifying") : t("verify.start")}
              </button>
            </div>
          )}

          {hasResult ? (
            <div className="mt-5 animate-fade">
              <CertResult
                loading={loading}
                verificationStep={verificationStep}
                currentStep={currentStep}
                result={result}
                queriedId={lastQueryId}
                error={error}
                onReset={resetVerification}
              />
            </div>
          ) : null}
        </div>
      </section>

      <AnimatePresence>
        {scannerOpen ? (
          <motion.div
            className="fixed inset-0 z-[80] bg-black/70 p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="mx-auto mt-16 max-w-2xl"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
            >
              <QRScanner
                onDetect={onScannerDetect}
                onClose={() => setScannerOpen(false)}
                onUseFileUpload={() => {
                  setScannerOpen(false);
                  setTab("file");
                }}
              />
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
