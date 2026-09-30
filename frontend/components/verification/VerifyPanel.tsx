"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useDropzone } from "react-dropzone";
import * as Dialog from "@radix-ui/react-dialog";
import * as Tabs from "@radix-ui/react-tabs";
import {
  Camera,
  CheckCircle2,
  FileUp,
  Hash,
  Loader2,
  ScanLine,
  ShieldCheck,
  X,
} from "lucide-react";
import CertResult from "@/components/CertResult";
import { useVerificationFlow } from "@/hooks/useVerificationFlow";
import { useLanguage } from "@/context/LanguageContext";

type VerifyTab = "id" | "file";

function ScannerLoading() {
  const { t } = useLanguage();
  return (
    <div className="glass-floating p-6 text-sm text-[var(--text-secondary)]" role="status">
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
      <section className="surface-elevated overflow-hidden">
        <div className="border-b border-[var(--border)] bg-[var(--surface-interactive)] px-5 py-4 sm:px-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">{t("verify.console")}</p>
              <h2 className="mt-1 text-xl font-bold text-[var(--text-primary)]">{t("verify.title")}</h2>
            </div>
            <div className="hidden rounded-full border border-[rgba(0,214,143,0.3)] bg-[var(--green-glow)] px-3 py-1.5 text-xs text-[var(--green)] sm:inline-flex">
              <ShieldCheck size={14} className="mr-1.5" />
              {t("verify.live")}
            </div>
          </div>
        </div>

        <div className="p-5 sm:p-6">
          <Tabs.Root value={tab} onValueChange={(value) => setTab(value as VerifyTab)}>
            <Tabs.List className="surface-interactive grid grid-cols-2 gap-1 p-1" aria-label={t("verify.title")}>
              <Tabs.Trigger
                value="id"
                onClick={() => setTab("id")}
                disabled={loading}
                className={`min-h-11 rounded-lg px-3 py-2.5 text-sm font-semibold transition-[color,background-color,box-shadow] duration-150 ${
                  tab === "id"
                    ? "bg-[var(--surface-raised)] text-[var(--text-primary)] shadow-[var(--control-shadow)]"
                    : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                }`}
              >
                {t("verify.tabId")}
              </Tabs.Trigger>
              <Tabs.Trigger
                value="file"
                onClick={() => setTab("file")}
                disabled={loading}
                className={`min-h-11 rounded-lg px-3 py-2.5 text-sm font-semibold transition-[color,background-color,box-shadow] duration-150 ${
                  tab === "file"
                    ? "bg-[var(--surface-raised)] text-[var(--text-primary)] shadow-[var(--control-shadow)]"
                    : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                }`}
              >
                {t("verify.tabFile")}
              </Tabs.Trigger>
            </Tabs.List>
          </Tabs.Root>

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
              <label htmlFor="certificate-id" className="text-xs font-semibold uppercase tracking-[0.06em] text-[var(--text-muted)]">{t("common.certificateId")}</label>
              <div className="relative mt-2">
                <Hash size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                <input
                  id="certificate-id"
                  name="certificate-id"
                  value={certId}
                  onChange={(event) => setCertId(event.target.value)}
                  disabled={loading}
                  className="mono h-14 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-input)] pl-12 pr-4 text-base sm:text-sm"
                  placeholder="CERT-2026-0DXT0YUK"
                />
              </div>

              <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-interactive)] p-3">
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
                aria-label={t("verify.dropPdf")}
                className={`cursor-pointer rounded-xl border-2 border-dashed p-7 text-center transition-[background-color,border-color,opacity] duration-150 sm:p-10 ${
                  isDragActive
                    ? "border-[var(--teal)] bg-[var(--teal-glow)]"
                    : "border-[var(--border)] hover:border-[var(--teal)] hover:bg-[var(--teal-glow)]"
                } ${loading ? "pointer-events-none opacity-70" : ""}`}
              >
                <input {...getInputProps({ accept: "application/pdf,.pdf", capture: false })} />
                <FileUp size={44} className="mx-auto text-[var(--text-muted)]" />
                <p className="mt-4 text-base font-semibold text-[var(--text-primary)]">
                  <span className="sm:hidden">{t("verify.choosePdf")}</span>
                  <span className="hidden sm:inline">{t("verify.dropOrChoosePdf")}</span>
                </p>
                <p className="mt-3 text-xs text-[var(--text-muted)]">{t("verify.pdfLimit")}</p>
              </div>

              {selectedFile ? (
                <div className="mt-4 flex items-center gap-3 rounded-xl border border-[rgba(0,214,143,0.35)] bg-[var(--green-glow)] px-4 py-3 text-sm text-[var(--text-primary)]">
                  <CheckCircle2 size={18} className="shrink-0 text-[var(--green)]" />
                  <span className="min-w-0 flex-1 truncate">{selectedFile.name}</span>
                  <span className="shrink-0 text-[var(--text-secondary)]">{formatFileSize(selectedFile.size)}</span>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setSelectedFile(null);
                    }}
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--text-secondary)] hover:bg-[var(--surface-interactive)] hover:text-[var(--text-primary)]"
                    aria-label={t("verify.removeFile")}
                  >
                    <X size={16} />
                  </button>
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

      <Dialog.Root open={scannerOpen} onOpenChange={setScannerOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[80] bg-black/72 backdrop-blur-sm" />
          <Dialog.Content
            className="fixed inset-x-3 top-1/2 z-[90] mx-auto max-h-[calc(100dvh-1.5rem)] max-w-2xl -translate-y-1/2 overflow-y-auto outline-none sm:inset-x-6"
            aria-describedby={undefined}
          >
            <Dialog.Title className="sr-only">{t("qr.title")}</Dialog.Title>
              <QRScanner
                onDetect={onScannerDetect}
                onClose={() => setScannerOpen(false)}
                onUseFileUpload={() => {
                  setScannerOpen(false);
                  setTab("file");
                }}
              />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
