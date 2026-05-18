"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useDropzone } from "react-dropzone";
import { z } from "zod";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  Loader2,
  RefreshCw,
  Upload,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { API_BASE_URL, CHAIN_ID, SUPPORTED_CHAINS } from "@/lib/constants";
import { calculateFileHash, copyToClipboard, formatDate, truncateHash } from "@/lib/utils";
import { getFriendlyError } from "@/lib/errorMessages";
import { localeForLanguage } from "@/lib/i18n";
import { useMetaMask } from "@/hooks/useMetaMask";
import { useLanguage } from "@/context/LanguageContext";
import AdminSidebar from "@/components/admin/AdminSidebar";
import type { CertificateRecord } from "@/types";

type FormValues = {
  recipientName: string;
  courseName: string;
  issuingOrg: string;
  certId?: string;
};
type IssueMode = "backend" | "metamask";

const PIPELINE_KEYS = [
  "issue.pipelineIpfs",
  "issue.pipelineBlockchain",
  "issue.pipelineDb",
  "issue.pipelineQr",
  "issue.pipelineDone",
];

function generateCertId() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const suffix = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `CERT-${new Date().getFullYear()}-${suffix}`;
}

function fileSizeText(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function AdminIssuePage() {
  const { language, t } = useLanguage();
  const locale = localeForLanguage(language);
  const [step, setStep] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [fileHash, setFileHash] = useState("");
  const [mode, setMode] = useState<IssueMode>("backend");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedHash, setCopiedHash] = useState(false);
  const [pipelineIndex, setPipelineIndex] = useState(-1);
  const [result, setResult] = useState<CertificateRecord | null>(null);
  const [walletStatus, setWalletStatus] = useState<string | null>(null);

  const {
    account,
    connectWallet,
    signMessage,
    switchNetwork,
    isCorrectNetwork,
  } = useMetaMask();

  const schema = useMemo(
    () =>
      z.object({
        recipientName: z.string().trim().min(2, t("validation.nameShort")).max(100, t("validation.nameLong")),
        courseName: z.string().trim().min(2, t("validation.courseShort")).max(200, t("validation.courseLong")),
        issuingOrg: z.string().trim().min(2, t("validation.orgShort")).max(200, t("validation.orgLong")),
        certId: z.string().trim().optional(),
      }),
    [t]
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      recipientName: "",
      courseName: "",
      issuingOrg: process.env.NEXT_PUBLIC_ISSUING_ORG || "CertChain",
      certId: generateCertId(),
    },
  });

  useEffect(() => {
    document.title = `${t("issue.title")} | CertChain`;
  }, [t]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!file) {
        setFileHash("");
        return;
      }
      try {
        const hash = await calculateFileHash(file);
        if (!cancelled) setFileHash(`0x${hash}`);
      } catch {
        if (!cancelled) {
          setFileHash("");
          setError(t("issue.hashError"));
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [file, t]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { "application/pdf": [".pdf"] },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024,
    disabled: loading,
    onDropAccepted(files) {
      setFile(files[0] || null);
      setError(null);
    },
    onDropRejected() {
      setFile(null);
      setError(t("issue.pdfOnlyAllowed"));
    },
  });

  const progress = useMemo(() => (step / 3) * 100, [step]);

  const nextFromStepOne = async () => {
    const valid = await form.trigger(["recipientName", "courseName", "issuingOrg", "certId"]);
    if (!valid) return;
    if (!form.getValues("certId")?.trim()) {
      form.setValue("certId", generateCertId(), { shouldValidate: true });
    }
    setStep(2);
  };

  const nextFromStepTwo = () => {
    if (!file) {
      setError(t("issue.uploadPdfError"));
      return;
    }
    if (!fileHash) {
      setError(t("issue.hashWait"));
      return;
    }
    setError(null);
    setStep(3);
  };

  const submitIssue = async () => {
    if (!file) {
      setError(t("issue.pdfRequired"));
      return;
    }

    const values = form.getValues();
    const certId = values.certId?.trim() || generateCertId();

    try {
      setLoading(true);
      setError(null);
      setWalletStatus(null);
      setPipelineIndex(0);

      if (mode === "metamask") {
        const wallet = account || (await connectWallet());

        if (!isCorrectNetwork) {
          toast.warning(t("issue.wrongNetwork"));
          await switchNetwork(CHAIN_ID);
        }

        setWalletStatus(t("login.waitingMetamask"));
        const message = `Issue CertChain certificate\nCertID: ${certId}\nHash: ${fileHash}\nNonce: ${Date.now()}\nWallet: ${wallet}`;
        await signMessage(message);
      }

      const formData = new FormData();
      formData.append("pdfFile", file);
      formData.append("recipientName", values.recipientName);
      formData.append("courseName", values.courseName);
      formData.append("issuingOrg", values.issuingOrg);
      formData.append("certId", certId);

      const request = api.issueCertificate(formData);

      setPipelineIndex(1);
      await wait(500);
      setPipelineIndex(2);
      await wait(500);
      setPipelineIndex(3);

      const issued = (await request) as CertificateRecord;

      setPipelineIndex(4);
      setResult(issued);
      if (mode === "metamask") {
        setWalletStatus(t("login.txConfirmed"));
      }
      toast.success(t("issue.successToast"));
    } catch (err: unknown) {
      const message = getFriendlyError(err, t("issue.failed"));
      setError(message);
      toast.error(message);
      setWalletStatus(null);
    } finally {
      setLoading(false);
    }
  };

  const qrImage = useMemo(() => {
    if (!result?.qrCodeUrl) return "";
    if (result.qrCodeUrl.startsWith("data:image")) return result.qrCodeUrl;
    if (result.qrCodeUrl.startsWith("http://") || result.qrCodeUrl.startsWith("https://")) return result.qrCodeUrl;
    const apiRoot = API_BASE_URL.replace(/\/api\/?$/, "").replace(/\/$/, "");
    return `${apiRoot}${result.qrCodeUrl.startsWith("/") ? "" : "/"}${result.qrCodeUrl}`;
  }, [result]);

  const txUrl = useMemo(() => {
    if (!result?.txHash) return "";
    const explorer = SUPPORTED_CHAINS[CHAIN_ID]?.explorer;
    return explorer ? `${explorer}/tx/${result.txHash}` : "";
  }, [result]);

  if (result) {
    return (
      <div className="page-bg min-h-screen pb-20 md:pb-8">
        <main className="mx-auto max-w-3xl px-4 py-10">
          <section className="glass p-8 text-center">
            <div className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-full bg-[var(--green-glow)]">
              <CheckCircle2 size={34} className="text-[var(--green)]" />
            </div>
            <h1 className="mt-4 text-3xl font-extrabold text-[var(--green)]">{t("issue.successTitle")}</h1>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              {t("issue.successBody")}
            </p>

            <div className="mt-7 grid grid-cols-1 gap-3 text-left md:grid-cols-2">
              <SummaryItem label={t("common.certificateId")} value={result.certId} mono />
              <SummaryItem label={t("common.issuedDate")} value={formatDate(result.issuedAt, locale)} />
              <SummaryItem label={t("common.recipient")} value={result.recipientName} />
              <SummaryItem label={t("common.course")} value={result.courseName} />
              <SummaryItem label={t("common.organization")} value={result.issuingOrg} />
              <SummaryItem label={t("common.hash")} value={truncateHash(result.certHash, 10)} mono />
            </div>

            {qrImage ? (
              <div className="mt-6">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrImage}
                  alt={t("issue.qrAlt")}
                  className="mx-auto h-52 w-52 rounded-xl border border-[var(--border)] bg-white p-2"
                />
              </div>
            ) : null}

            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              {txUrl ? (
                <a href={txUrl} target="_blank" rel="noopener noreferrer" className="btn-outline px-4 py-2.5 text-sm">
                  {t("issue.viewExplorer")}
                </a>
              ) : null}
              {result.ipfsUrl ? (
                <a href={result.ipfsUrl} target="_blank" rel="noopener noreferrer" className="btn-outline px-4 py-2.5 text-sm">
                  {t("issue.viewIpfs")}
                </a>
              ) : null}
              <button
                type="button"
                className="btn-primary px-4 py-2.5 text-sm"
                onClick={() => {
                  setResult(null);
                  setStep(1);
                  setFile(null);
                  setFileHash("");
                  setPipelineIndex(-1);
                  setWalletStatus(null);
                  form.reset({
                    recipientName: "",
                    courseName: "",
                    issuingOrg: process.env.NEXT_PUBLIC_ISSUING_ORG || "CertChain",
                    certId: generateCertId(),
                  });
                }}
              >
                {t("issue.issueAnother")}
              </button>
              <Link href="/admin/certificates" className="btn-outline px-4 py-2.5 text-sm">
                {t("issue.viewAll")}
              </Link>
            </div>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="page-bg min-h-screen pb-20 md:pb-8">
      <AdminSidebar />

      <main className="mx-auto max-w-[760px] px-4 py-8 md:ml-60 md:max-w-none md:px-8">
        <h1 className="page-title">{t("issue.title")}</h1>
        <p className="page-subtitle mt-2">
          {t("issue.subtitle")}
        </p>

        <section className="glass mt-8 p-6">
          <div className="relative mb-3 h-2 overflow-hidden rounded-full bg-[var(--bg-surface)]">
            <div className="h-full bg-[var(--teal)] transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
          <div className="grid grid-cols-3 text-center text-sm font-medium text-[var(--text-secondary)]">
            <span className={step >= 1 ? "text-[var(--teal)]" : ""}>{t("issue.stepRecipient")}</span>
            <span className={step >= 2 ? "text-[var(--teal)]" : ""}>{t("issue.stepDocument")}</span>
            <span className={step >= 3 ? "text-[var(--teal)]" : ""}>{t("issue.stepReview")}</span>
          </div>
        </section>

        {error ? (
          <section className="mt-4 rounded-xl border border-[rgba(255,77,109,0.3)] bg-[var(--red-glow)] p-4 text-[15px] text-[var(--red)]">
            {error}
          </section>
        ) : null}

        {walletStatus ? (
          <section className="mt-4 rounded-xl border border-[var(--teal-border)] bg-[var(--teal-glow)] p-4 text-[15px] text-[var(--teal)]">
            {walletStatus}
          </section>
        ) : null}

        {loading ? (
          <section className="glass mt-6 p-6">
            <p className="mb-4 text-[15px] text-[var(--amber)]">{t("issue.doNotClose")}</p>
            <div className="space-y-3">
              {PIPELINE_KEYS.map((item, idx) => {
                const done = pipelineIndex > idx;
                const active = pipelineIndex === idx;
                return (
                  <div key={item} className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-3">
                    <span className="text-[15px] text-[var(--text-secondary)]">{t(item)}</span>
                    {done ? (
                      <CheckCircle2 size={17} className="text-[var(--green)]" />
                    ) : active ? (
                      <Loader2 size={16} className="animate-spin text-[var(--teal)]" />
                    ) : (
                      <span className="text-[13px] text-[var(--text-muted)]">{t("common.pending")}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

        {!loading && step === 1 ? (
          <section className="glass mt-6 p-6 sm:p-10">
            <h2 className="text-xl font-bold">{t("issue.recipientInfo")}</h2>
            <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
              <InputField label={t("issue.fullName")} error={form.formState.errors.recipientName?.message} full>
                <input
                  {...form.register("recipientName")}
                  className="h-12 w-full rounded-xl bg-[var(--bg-input)] px-4"
                  disabled={loading}
                />
              </InputField>

              <InputField label={t("issue.courseProgram")} error={form.formState.errors.courseName?.message}>
                <input
                  {...form.register("courseName")}
                  className="h-12 w-full rounded-xl bg-[var(--bg-input)] px-4"
                  disabled={loading}
                />
              </InputField>

              <InputField label={t("issue.issuingOrganization")} error={form.formState.errors.issuingOrg?.message}>
                <input
                  {...form.register("issuingOrg")}
                  className="h-12 w-full rounded-xl bg-[var(--bg-input)] px-4"
                  disabled={loading}
                />
              </InputField>

              <InputField label={t("common.certificateId")} error={form.formState.errors.certId?.message}>
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      {...form.register("certId")}
                      className="mono h-12 w-full rounded-xl bg-[var(--bg-input)] px-4 text-sm"
                      disabled={loading}
                    />
                    <button
                      type="button"
                      onClick={() => form.setValue("certId", generateCertId(), { shouldValidate: true })}
                      className="btn-outline inline-flex items-center gap-1 px-3 py-2 text-[14px]"
                    >
                      <RefreshCw size={13} />
                      {t("issue.generate")}
                    </button>
                  </div>
                  <p className="mono text-[13px] text-[var(--text-muted)]">
                    {t("issue.preview", { value: form.watch("certId") || t("issue.autoGenerated") })}
                  </p>
                </div>
              </InputField>
            </div>

            <div className="mt-8 flex justify-end">
              <button type="button" onClick={() => void nextFromStepOne()} className="btn-primary px-5 py-2.5 text-sm">
                {t("issue.nextStep")}
              </button>
            </div>
          </section>
        ) : null}

        {!loading && step === 2 ? (
          <section className="glass mt-6 p-6 sm:p-10">
            <h2 className="text-xl font-bold">{t("issue.uploadTitle")}</h2>
            <div
              {...getRootProps()}
              className={`mt-6 cursor-pointer rounded-xl border-2 border-dashed p-10 text-center transition-all duration-200 ${
                isDragActive
                  ? "border-[var(--teal)] bg-[var(--teal-glow)]"
                  : "border-[var(--border)] hover:border-[var(--teal)] hover:bg-[var(--teal-glow)]"
              }`}
            >
              <input {...getInputProps({ accept: "application/pdf,.pdf", capture: false })} />
              <Upload className="mx-auto text-[var(--text-muted)]" size={42} />
              <p className="mt-4 text-base font-semibold">{t("issue.dropHere")}</p>
              <p className="mt-1 text-sm text-[var(--text-muted)]">{t("verify.clickBrowse")}</p>
              <p className="mt-2 text-[13px] text-[var(--text-muted)]">{t("verify.pdfLimit")}</p>
            </div>

            {file ? (
              <div className="mt-5 rounded-xl border border-[rgba(0,214,143,0.35)] bg-[var(--green-glow)] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <p className="font-medium text-[var(--text-primary)]">{file.name}</p>
                  <span className="text-[var(--text-secondary)]">{fileSizeText(file.size)}</span>
                </div>

                <div className="mt-3 rounded-lg border border-[var(--teal-border)] bg-[var(--bg-input)] px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                  <p className="mono text-[13px] text-[var(--teal)]">{fileHash || t("issue.calculatingHash")}</p>
                    {fileHash ? (
                      <button
                        type="button"
                        onClick={async () => {
                          await copyToClipboard(fileHash);
                          setCopiedHash(true);
                          setTimeout(() => setCopiedHash(false), 1200);
                        }}
                        className="text-[var(--teal)]"
                      >
                        {copiedHash ? <Check size={14} /> : <Copy size={14} />}
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}

            <div className="mt-8 flex items-center justify-between gap-3">
              <button type="button" onClick={() => setStep(1)} className="btn-outline px-5 py-2.5 text-sm">
                ← {t("common.back")}
              </button>
              <button type="button" onClick={nextFromStepTwo} className="btn-primary px-5 py-2.5 text-sm">
                {t("issue.nextStep")}
              </button>
            </div>
          </section>
        ) : null}

        {!loading && step === 3 ? (
          <section className="glass mt-6 p-6 sm:p-10">
            <h2 className="text-xl font-bold">{t("issue.reviewTitle")}</h2>

            <div className="mt-5 rounded-xl bg-[var(--bg-input)] p-5">
              <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
                <Summary label={t("common.recipient")} value={form.getValues("recipientName") || t("common.na")} />
                <Summary label={t("common.course")} value={form.getValues("courseName") || t("common.na")} />
                <Summary label={t("common.organization")} value={form.getValues("issuingOrg") || t("common.na")} />
                <Summary label={t("common.certificateId")} value={form.getValues("certId") || t("common.na")} mono />
                <Summary label={t("issue.documentFingerprint")} value={fileHash ? truncateHash(fileHash, 12) : t("common.na")} mono full />
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-[rgba(255,184,0,0.34)] bg-[rgba(255,184,0,0.12)] p-4 text-sm text-[var(--amber)]">
              <div className="flex items-start gap-2">
                <AlertTriangle size={16} className="mt-0.5" />
                <span>{t("issue.permanentWarning")}</span>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setMode("backend")}
                className={`rounded-xl border px-4 py-3 text-left text-sm ${
                  mode === "backend"
                    ? "border-[var(--teal-border)] bg-[var(--teal-glow)] text-[var(--teal)]"
                    : "border-[var(--border)] text-[var(--text-secondary)]"
                }`}
              >
                <p className="font-semibold">{t("issue.backendMode")}</p>
                <p className="mt-1 text-[13px] text-[var(--text-muted)]">{t("issue.backendModeDesc")}</p>
              </button>
              <button
                type="button"
                onClick={() => setMode("metamask")}
                className={`rounded-xl border px-4 py-3 text-left text-sm ${
                  mode === "metamask"
                    ? "border-[var(--teal-border)] bg-[var(--teal-glow)] text-[var(--teal)]"
                    : "border-[var(--border)] text-[var(--text-secondary)]"
                }`}
              >
                <p className="inline-flex items-center gap-2 font-semibold">
                  <Wallet size={15} />
                  {t("issue.metamaskMode")}
                </p>
                <p className="mt-1 text-[13px] text-[var(--text-muted)]">{t("issue.metamaskModeDesc")}</p>
              </button>
            </div>

            <p className="mt-4 text-[13px] text-[var(--text-muted)]">{t("issue.gasEstimate")}</p>

            <div className="mt-8 flex items-center justify-between gap-3">
              <button type="button" onClick={() => setStep(2)} className="btn-outline px-5 py-2.5 text-sm">
                ← {t("common.back")}
              </button>
              <button
                type="button"
                onClick={() => void submitIssue()}
                className="btn-primary inline-flex items-center gap-2 px-5 py-2.5 text-sm"
              >
                <CheckCircle2 size={15} />
                {t("issue.confirm")}
              </button>
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}

function InputField({
  label,
  error,
  children,
  full,
}: {
  label: string;
  error?: string;
  children: ReactNode;
  full?: boolean;
}) {
  return (
    <label className={`block ${full ? "md:col-span-2" : ""}`}>
      <span className="mb-2 block text-sm font-semibold text-[var(--text-secondary)]">{label}</span>
      {children}
      {error ? <span className="mt-1 block text-[13px] text-[var(--red)]">{error}</span> : null}
    </label>
  );
}

function Summary({
  label,
  value,
  mono,
  full,
}: {
  label: string;
  value: string;
  mono?: boolean;
  full?: boolean;
}) {
  return (
    <div className={full ? "md:col-span-2" : ""}>
      <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">{label}</p>
      <p className={`${mono ? "mono" : ""} mt-1 text-[15px] font-semibold text-[var(--text-primary)]`}>{value}</p>
    </div>
  );
}

function SummaryItem({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-input)] p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">{label}</p>
      <p className={`${mono ? "mono" : ""} mt-1 text-[15px] font-semibold text-[var(--text-primary)]`}>{value}</p>
    </div>
  );
}
