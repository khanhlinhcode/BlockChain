"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Search, Upload, QrCode, Loader2 } from "lucide-react";
import { useDropzone } from "react-dropzone";
import { api } from "@/lib/api";
import { getFriendlyError } from "@/lib/errorMessages";
import { useLanguage } from "@/context/LanguageContext";

const QRScanner = dynamic(() => import("./QRScanner"), { ssr: false });

type Tab = "id" | "file" | "qr";

export default function VerifyForm() {
  const router = useRouter();
  const { t } = useLanguage();
  const [tab, setTab] = useState<Tab>("id");
  const [certId, setCertId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  const handleIdSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!certId.trim()) return;
    try {
      setLoading(true);
      setError(null);
      const data = await api.verifyById(certId.trim());
      if (data.exists) {
        router.push(`/verify/${certId.trim()}`);
      } else {
        setError(t("verifyForm.notFoundId"));
      }
    } catch (err: any) {
      setError(getFriendlyError(err, t("verifyForm.failed")));
    } finally {
      setLoading(false);
    }
  };

  const onDrop = useCallback(async (files: File[]) => {
    if (!files.length) return;
    try {
      setLoading(true);
      setError(null);
      const data = await api.verifyByFile(files[0]);
      if (data.exists && data.certificate?.certId) {
        router.push(`/verify/${data.certificate.certId}`);
      } else {
        setError(data.message || t("verifyForm.notFoundFile"));
      }
    } catch (err: any) {
      setError(getFriendlyError(err, t("verifyForm.failed")));
    } finally {
      setLoading(false);
    }
  }, [router, t]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024,
    disabled: loading,
  });

  const handleQR = (id: string) => {
    router.push(`/verify/${id}`);
  };

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: "id", label: t("common.certificateId"), icon: Search },
    { id: "file", label: t("verify.tabFile"), icon: Upload },
    { id: "qr", label: t("verifyForm.scanQr"), icon: QrCode },
  ];

  return (
    <div>
      {/* Tab bar */}
      <div className="flex gap-1 bg-[rgba(255,255,255,0.03)] rounded-xl p-1 mb-6">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => { setTab(t.id); setError(null); }}
            disabled={loading}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
              tab === t.id
                ? "bg-[rgba(0,212,255,0.1)] text-[var(--accent-teal)]"
                : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            } ${loading ? "opacity-60 cursor-not-allowed" : ""}`}
          >
            <t.icon size={15} />
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-xl text-sm bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.15)] text-[var(--accent-red)]">
          {error}
        </div>
      )}

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
            className="btn-primary px-5 py-3 disabled:opacity-40 inline-flex items-center gap-2"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
            {loading ? t("verifyForm.verifying") : t("verifyForm.verify")}
          </button>
        </form>
      )}

      {tab === "file" && (
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${
            isDragActive
              ? "border-[var(--accent-teal)] bg-[rgba(0,212,255,0.05)]"
              : "border-[var(--border)] hover:border-[var(--border-hover)] hover:bg-[rgba(255,255,255,0.02)]"
          }`}
        >
          <input {...getInputProps({ accept: "application/pdf,.pdf", capture: false })} />
          <Upload size={32} className={`mx-auto mb-3 ${isDragActive ? "text-[var(--accent-teal)]" : "text-[var(--text-muted)]"}`} />
          {loading ? (
            <div className="flex items-center justify-center gap-2 text-[var(--text-secondary)]">
              <Loader2 size={16} className="animate-spin" /> {t("verifyForm.verifying")}
            </div>
          ) : (
            <>
              <p className="text-sm font-medium text-[var(--text-primary)] mb-1">
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
          onUseFileUpload={() => setTab("file")}
        />
      )}
    </div>
  );
}
