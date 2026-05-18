"use client";

import { useMemo, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Hash,
  Home,
  Linkedin,
  Loader2,
  RotateCcw,
  Share2,
  ShieldX,
  User,
} from "lucide-react";
import { toast } from "sonner";
import type { VerifyResponse } from "@/types";
import { copyToClipboard, formatDate, formatDateRelative, truncateHash } from "@/lib/utils";
import { localeForLanguage } from "@/lib/i18n";
import { useLanguage } from "@/context/LanguageContext";

const PDFViewerModal = dynamic(() => import("@/components/PDFViewerModal"), { ssr: false });

interface CertResultProps {
  loading?: boolean;
  result?: VerifyResponse | null;
  queriedId?: string;
  verificationStep?: number;
  error?: string | null;
  onReset?: () => void;
}

type UiState = "loading" | "valid" | "revoked" | "not_found" | "error";

function getIpfsUrl(result?: VerifyResponse | null): string {
  if (!result) return "";
  if (result.certificate?.ipfsUrl) return result.certificate.ipfsUrl;
  const cid = result.certificate?.ipfsCID || result.blockchain?.ipfsCID || result.blockchain?.ipfsCid;
  if (!cid) return "";
  const gateway = process.env.NEXT_PUBLIC_IPFS_GATEWAY || "https://gateway.pinata.cloud/ipfs";
  return `${gateway.replace(/\/$/, "")}/${cid}`;
}

function getUiState(params: {
  loading: boolean;
  error?: string | null;
  result?: VerifyResponse | null;
}): UiState {
  if (params.loading) return "loading";
  if (params.error) return "error";
  if (!params.result || !params.result.exists || !params.result.certificate) return "not_found";
  if (params.result.isRevoked || params.result.certificate.isRevoked) return "revoked";
  return "valid";
}

export default function CertResult({
  loading = false,
  result = null,
  queriedId,
  verificationStep = -1,
  error,
  onReset,
}: CertResultProps) {
  const { language, t } = useLanguage();
  const [copiedField, setCopiedField] = useState<"id" | "hash" | "link" | null>(null);
  const [pdfOpen, setPdfOpen] = useState(false);
  const locale = localeForLanguage(language);

  const state = getUiState({ loading, error, result });
  const cert = result?.certificate;
  const certId = cert?.certId || queriedId || "N/A";
  const certHash = cert?.certHash || result?.blockchain?.certHash || "N/A";
  const ipfsUrl = getIpfsUrl(result);
  const verificationTime = result?.verifiedAt || cert?.lastVerifiedAt || new Date().toISOString();

  const verificationLink = useMemo(() => {
    if (typeof window === "undefined" || !certId || certId === "N/A") return "";
    return `${window.location.origin}/verify/${encodeURIComponent(certId)}`;
  }, [certId]);

  const copyField = async (type: "id" | "hash" | "link", value: string) => {
    if (!value || value === "N/A") return;
    try {
      await copyToClipboard(value);
      setCopiedField(type);
      setTimeout(() => setCopiedField(null), 1400);
    } catch {
      toast.error(t("common.copyError"));
    }
  };

  const shareOnLinkedIn = () => {
    if (!verificationLink) return;
    const title = t("result.linkedinTitle", { id: certId });
    const linkedIn = new URL("https://www.linkedin.com/shareArticle");
    linkedIn.searchParams.set("mini", "true");
    linkedIn.searchParams.set("url", verificationLink);
    linkedIn.searchParams.set("title", title);
    linkedIn.searchParams.set("summary", title);
    window.open(linkedIn.toString(), "_blank", "noopener,noreferrer");
  };

  const downloadBadge = () => {
    if (!cert || !certId) return;

    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 420;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, "#060B18");
    gradient.addColorStop(1, "#10284A");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = "rgba(0,229,255,0.45)";
    ctx.lineWidth = 4;
    ctx.strokeRect(18, 18, canvas.width - 36, canvas.height - 36);

    ctx.fillStyle = "#00D68F";
    ctx.beginPath();
    ctx.arc(120, 120, 52, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#FFFFFF";
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.moveTo(92, 122);
    ctx.lineTo(113, 144);
    ctx.lineTo(154, 98);
    ctx.stroke();

    ctx.fillStyle = "#EFF6FF";
    ctx.font = "700 52px Be Vietnam Pro, sans-serif";
    ctx.fillText(t("result.badgeTitle"), 210, 122);

    ctx.fillStyle = "#8BA3CC";
    ctx.font = "500 24px Be Vietnam Pro, sans-serif";
    ctx.fillText(t("result.badgeCertId", { id: certId }), 210, 182);
    ctx.fillText(t("result.badgeRecipient", { name: cert.recipientName }), 210, 222);
    ctx.fillText(t("result.badgeIssuedBy", { org: cert.issuingOrg }), 210, 262);
    ctx.fillText(t("result.badgeVerified", { time: new Date(verificationTime).toLocaleString(locale) }), 210, 302);

    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = `${certId}-verification-badge.png`;
    link.click();
  };

  if (state === "loading") {
    const steps = [
      t("result.stepHashing"),
      t("result.stepQuerying"),
      t("result.stepCrossRef"),
      t("result.stepResult"),
    ];

    return (
      <motion.section
        className="rounded-2xl border border-[var(--teal-border)] bg-[var(--teal-glow)] p-6"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="mb-5 flex items-center gap-3 text-[var(--text-primary)]">
          <Loader2 size={20} className="animate-spin text-[var(--teal)]" />
          <h3 className="text-lg font-bold">{t("result.loadingTitle")}</h3>
        </div>

        <div className="space-y-3">
          {steps.map((label, index) => {
            const done = verificationStep > index;
            const active = verificationStep === index;
            return (
              <motion.div
                key={label}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: verificationStep >= index ? 1 : 0.5, y: 0 }}
                transition={{ delay: index * 0.08 }}
                className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-4 py-3"
              >
                <span className="text-sm text-[var(--text-secondary)]">{label}</span>
                {done ? (
                  <CheckCircle2 size={17} className="text-[var(--green)]" />
                ) : active ? (
                  <Loader2 size={16} className="animate-spin text-[var(--teal)]" />
                ) : (
                  <span className="text-xs text-[var(--text-muted)]">{t("common.pending")}</span>
                )}
              </motion.div>
            );
          })}
        </div>
      </motion.section>
    );
  }

  if (state === "error") {
    return (
      <section className="rounded-2xl border border-[rgba(255,77,109,0.3)] bg-[var(--red-glow)] p-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 text-[var(--red)]" size={20} />
          <div>
            <h3 className="text-lg font-bold text-[var(--red)]">{t("result.errorTitle")}</h3>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              {error || t("result.errorBody")}
            </p>
          </div>
        </div>
        <ResultActions onReset={onReset} />
      </section>
    );
  }

  if (state === "not_found") {
    return (
      <section className="rounded-2xl border border-[rgba(255,184,0,0.38)] bg-[rgba(255,184,0,0.1)] p-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 text-[var(--amber)]" size={20} />
          <div>
            <h3 className="text-lg font-bold text-[var(--amber)]">{t("result.notFoundTitle")}</h3>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              {t("result.notFoundBody")}
            </p>
            {queriedId ? (
              <p className="mono mt-3 text-xs text-[var(--text-muted)]">{t("result.requested")}: {queriedId}</p>
            ) : null}
          </div>
        </div>
        <ResultActions onReset={onReset} />
      </section>
    );
  }

  const revoked = state === "revoked";

  return (
    <>
      <motion.section
        className={`rounded-2xl p-6 sm:p-8 ${
          revoked
            ? "border border-[rgba(255,77,109,0.3)] bg-[var(--red-glow)] shadow-[var(--glow-red)]"
            : "border border-[rgba(0,214,143,0.3)] bg-[var(--green-glow)] shadow-[var(--glow-green)]"
        }`}
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex flex-wrap items-center gap-3">
          <div
            className={`inline-flex h-10 w-10 items-center justify-center rounded-full ${
              revoked ? "bg-[rgba(255,77,109,0.2)]" : "bg-[rgba(0,214,143,0.2)]"
            }`}
          >
            {revoked ? (
              <ShieldX className="text-[var(--red)]" size={22} />
            ) : (
              <CheckCircle2 className="text-[var(--green)]" size={22} />
            )}
          </div>

          <h3
            className={`text-2xl font-bold ${
              revoked ? "text-[var(--red)]" : "text-[var(--green)]"
            }`}
          >
            {revoked ? t("result.revokedTitle") : t("result.verifiedTitle")}
          </h3>
        </div>

        <div className="my-6 h-px bg-[var(--border)]" />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label={t("common.recipient")} value={cert?.recipientName || t("common.na")} icon={<User size={14} />} full />
          <Field label={t("common.course")} value={cert?.courseName || t("common.na")} />
          <Field label={t("result.issuingOrg")} value={cert?.issuingOrg || t("common.na")} />
          <Field label={t("common.issueDate")} value={cert?.issuedAt ? formatDate(cert.issuedAt, locale) : t("common.na")} />

          <Field
            label={t("common.certificateId")}
            value={certId}
            mono
            action={
              <button
                type="button"
                onClick={() => void copyField("id", certId)}
                className="inline-flex items-center gap-1 text-xs text-[var(--teal)]"
              >
                {copiedField === "id" ? <Check size={13} /> : <Copy size={13} />}
                {copiedField === "id" ? t("common.copied") : t("common.copy")}
              </button>
            }
          />

          <Field
            label={t("result.blockchainHash")}
            value={truncateHash(certHash, 10)}
            mono
            action={
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => void copyField("hash", certHash)}
                  className="inline-flex items-center gap-1 text-xs text-[var(--teal)]"
                >
                  {copiedField === "hash" ? <Check size={13} /> : <Copy size={13} />}
                  {copiedField === "hash" ? t("common.copied") : t("common.copy")}
                </button>
                {cert?.txHash ? (
                  <a
                    href={`https://sepolia.etherscan.io/tx/${cert.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-[var(--teal)]"
                  >
                    <ExternalLink size={13} />
                    Tx
                  </a>
                ) : null}
              </div>
            }
          />

          {revoked ? (
            <Field label={t("result.revokedAt")} value={cert?.revokedAt ? formatDate(cert.revokedAt, locale) : t("common.na")} />
          ) : null}
          {revoked ? <Field label={t("result.revocationReason")} value={cert?.revokeReason || t("result.notProvided")} full /> : null}
        </div>

        <div className="mt-7 flex flex-wrap gap-3">
          {ipfsUrl ? (
            <>
              <button
                type="button"
                onClick={() => setPdfOpen(true)}
                className="btn-outline inline-flex items-center gap-2 px-4 py-2.5 text-sm"
              >
                <FileText size={15} />
                {t("result.viewDocument")}
              </button>

              <a
                href={ipfsUrl}
                download={`${certId}.pdf`}
                className="btn-outline inline-flex items-center gap-2 px-4 py-2.5 text-sm"
              >
                <Download size={15} />
                {t("result.downloadPdf")}
              </a>
            </>
          ) : null}

          {!revoked && cert ? (
            <>
              <button
                type="button"
                onClick={() => void copyField("link", verificationLink)}
                className="btn-outline inline-flex items-center gap-2 px-4 py-2.5 text-sm"
              >
                <Share2 size={15} />
                {copiedField === "link" ? t("result.linkCopied") : t("result.copyLink")}
              </button>

              <button
                type="button"
                onClick={shareOnLinkedIn}
                className="btn-outline inline-flex items-center gap-2 px-4 py-2.5 text-sm"
              >
                <Linkedin size={15} />
                {t("result.shareLinkedIn")}
              </button>

              <button
                type="button"
                onClick={downloadBadge}
                className="btn-outline inline-flex items-center gap-2 px-4 py-2.5 text-sm"
              >
                <Download size={15} />
                {t("result.downloadBadge")}
              </button>
            </>
          ) : null}
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--text-muted)]">
          <span>{t("result.verifiedAgo", { time: formatDateRelative(verificationTime, language) })}</span>
          <span>
            {t("result.block", { block: typeof cert?.blockNumber === "number" ? cert.blockNumber.toLocaleString(locale) : t("common.na") })}
          </span>
        </div>

        <ResultActions onReset={onReset} />
      </motion.section>

      {ipfsUrl ? (
        <PDFViewerModal
          open={pdfOpen}
          pdfUrl={ipfsUrl}
          certId={certId}
          onClose={() => setPdfOpen(false)}
        />
      ) : null}
    </>
  );
}

function ResultActions({ onReset }: { onReset?: () => void }) {
  const { t } = useLanguage();

  return (
    <div className="mt-7 rounded-2xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--bg-card)_76%,transparent)] p-3">
      <p className="mb-3 text-sm font-semibold text-[var(--text-secondary)]">
        {t("result.nextActionHint")}
      </p>
      <div className="flex flex-col gap-3 sm:flex-row">
        {onReset ? (
          <button
            type="button"
            onClick={onReset}
            className="btn-primary inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm"
          >
            <RotateCcw size={15} />
            {t("result.verifyAnother")}
          </button>
        ) : (
          <Link
            href="/#verify-section"
            className="btn-primary inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm"
          >
            <RotateCcw size={15} />
            {t("result.verifyAnother")}
          </Link>
        )}

        <Link
          href="/"
          className="btn-outline inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm"
        >
          <Home size={15} />
          {t("result.backHome")}
        </Link>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  action,
  mono,
  icon,
  full,
}: {
  label: string;
  value: string;
  action?: ReactNode;
  mono?: boolean;
  icon?: ReactNode;
  full?: boolean;
}) {
  return (
    <div className={`rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-3 ${full ? "md:col-span-2" : ""}`}>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.11em] text-[var(--text-muted)]">
          {icon ? icon : <Hash size={12} />}
          {label}
        </div>
        {action ? <div>{action}</div> : null}
      </div>
      <p className={`${mono ? "mono" : ""} break-all text-sm font-semibold text-[var(--text-primary)]`}>{value}</p>
    </div>
  );
}
