"use client";

export const dynamic = "force-dynamic";

import {
  memo,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";
import JSZip from "jszip";
import {
  Check,
  CheckSquare,
  Copy,
  Download,
  Eye,
  Loader2,
  QrCode,
  RefreshCw,
  Search,
  Square,
  X,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { CHAIN_ID, SUPPORTED_CHAINS } from "@/lib/constants";
import { copyToClipboard, formatDate, truncateHash } from "@/lib/utils";
import { getFriendlyError } from "@/lib/errorMessages";
import { localeForLanguage } from "@/lib/i18n";
import { useLanguage } from "@/context/LanguageContext";
import AdminSidebar from "@/components/admin/AdminSidebar";
import type { CertificateRecord } from "@/types";

type StatusFilter = "all" | "valid" | "revoked";

type VerifyHistory = {
  verificationCount: number;
  lastVerifiedAt: string | null;
  records: Array<{ verifiedAt: string; ipAddress?: string }>;
};

function useDebounced<T>(value: T, delayMs: number) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [delayMs, value]);

  return debounced;
}

function toKey(certificate: CertificateRecord) {
  return certificate.certHash || certificate._id || certificate.certId;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function toCsvCell(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

const TableRow = memo(function TableRow({
  certificate,
  selected,
  onToggle,
  onOpen,
  onDownload,
  onRevoke,
  onCopyHash,
  copied,
  labels,
  locale,
}: {
  certificate: CertificateRecord;
  selected: boolean;
  onToggle: (certificate: CertificateRecord) => void;
  onOpen: (certificate: CertificateRecord) => void;
  onDownload: (certificate: CertificateRecord) => void;
  onRevoke: (certificate: CertificateRecord) => void;
  onCopyHash: (certificate: CertificateRecord) => void;
  copied: boolean;
  labels: {
    valid: string;
    revoked: string;
  };
  locale: string;
}) {
  return (
    <tr className="border-t border-[var(--border)] transition-all duration-200 hover:bg-[var(--bg-card)]">
      <td className="px-4 py-3">
        <button type="button" onClick={() => onToggle(certificate)} className="text-[var(--text-secondary)]">
          {selected ? <CheckSquare size={16} className="text-[var(--teal)]" /> : <Square size={16} />}
        </button>
      </td>
      <td className="px-4 py-3 mono text-[13px] text-[var(--teal)]">{certificate.certId}</td>
      <td className="px-4 py-3 text-[15px] text-[var(--text-primary)]">{certificate.recipientName}</td>
      <td className="px-4 py-3 text-[15px] text-[var(--text-secondary)]">{certificate.courseName}</td>
      <td className="px-4 py-3 text-[15px] text-[var(--text-secondary)]">{formatDate(certificate.issuedAt, locale)}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="mono text-[13px] text-[var(--text-secondary)]">{truncateHash(certificate.certHash, 8)}</span>
          <button type="button" onClick={() => onCopyHash(certificate)} className="text-[var(--teal)]">
            {copied ? <Check size={13} /> : <Copy size={13} />}
          </button>
        </div>
      </td>
      <td className="px-4 py-3">
        <span
          className={`status-badge inline-flex rounded-full px-3 py-0.5 font-medium ${
            certificate.isRevoked
              ? "border border-[rgba(255,77,109,0.3)] bg-[var(--red-glow)] text-[var(--red)]"
              : "border border-[rgba(0,214,143,0.3)] bg-[var(--green-glow)] text-[var(--green)]"
          }`}
        >
          {certificate.isRevoked ? labels.revoked : labels.valid}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => onOpen(certificate)} className="text-[var(--text-secondary)] hover:text-[var(--teal)]">
            <Eye size={15} />
          </button>
          <button type="button" onClick={() => onDownload(certificate)} className="text-[var(--text-secondary)] hover:text-[var(--teal)]">
            <QrCode size={15} />
          </button>
          <button
            type="button"
            onClick={() => onRevoke(certificate)}
            className={
              certificate.isRevoked
                ? "cursor-not-allowed opacity-50"
                : "text-[var(--text-secondary)] hover:text-[var(--red)]"
            }
            disabled={certificate.isRevoked}
          >
            <XCircle
              size={15}
              className={certificate.isRevoked ? "text-[var(--text-muted)]" : "text-[var(--red)]"}
            />
          </button>
        </div>
      </td>
    </tr>
  );
});

export default function AdminCertificatesPage() {
  const { language, t } = useLanguage();
  const locale = localeForLanguage(language);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState("");
  const deferredSearchInput = useDeferredValue(searchInput);
  const search = useDebounced(deferredSearchInput.trim(), 300);

  const [status, setStatus] = useState<StatusFilter>("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [organization, setOrganization] = useState("all");

  const [certificates, setCertificates] = useState<CertificateRecord[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const [activeCert, setActiveCert] = useState<CertificateRecord | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [history, setHistory] = useState<VerifyHistory | null>(null);

  const [revokeOpen, setRevokeOpen] = useState(false);
  const [revokeCert, setRevokeCert] = useState<CertificateRecord | null>(null);
  const [revokeReason, setRevokeReason] = useState("");
  const [revokeLoading, setRevokeLoading] = useState(false);
  const [revokeError, setRevokeError] = useState<string | null>(null);

  const [downloadingQr, setDownloadingQr] = useState<string | null>(null);
  const [downloadingZip, setDownloadingZip] = useState(false);
  const [syncingChain, setSyncingChain] = useState(false);

  useEffect(() => {
    document.title = `${t("certs.title")} | CertChain`;
  }, [t]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const merged: CertificateRecord[] = [];
      let nextPage = 1;
      let totalPages = 1;

      do {
        const response = await api.getCertificatesAdvanced({
          page: nextPage,
          limit: 100,
          search,
          status,
          order: "desc",
        });
        merged.push(...((response.certificates || []) as CertificateRecord[]));
        totalPages = response.totalPages || 1;
        nextPage += 1;
      } while (nextPage <= totalPages);

      setCertificates(merged);
      setPage(1);
    } catch (err: unknown) {
      const message = getFriendlyError(err, t("certs.loadFailed"));
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [search, status, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const organizations = useMemo(() => {
    const items = new Set<string>();
    certificates.forEach((item) => {
      if (item.issuingOrg) items.add(item.issuingOrg);
    });
    return Array.from(items).sort((a, b) => a.localeCompare(b));
  }, [certificates]);

  const filtered = useMemo(() => {
    return certificates.filter((item) => {
      if (organization !== "all" && item.issuingOrg !== organization) return false;

      const issued = new Date(item.issuedAt);
      if (fromDate) {
        const from = new Date(fromDate);
        if (issued < from) return false;
      }
      if (toDate) {
        const to = new Date(toDate);
        to.setHours(23, 59, 59, 999);
        if (issued > to) return false;
      }
      return true;
    });
  }, [certificates, organization, fromDate, toDate]);

  useEffect(() => {
    const validKeys = new Set(filtered.map((item) => toKey(item)));
    setSelected((prev) => {
      if (!prev.size) return prev;
      const next = new Set<string>();
      prev.forEach((key) => {
        if (validKeys.has(key)) next.add(key);
      });
      return next;
    });
  }, [filtered]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const paginated = useMemo(() => {
    const from = (page - 1) * limit;
    return filtered.slice(from, from + limit);
  }, [filtered, page, limit]);

  const selectedCertificates = useMemo(
    () => filtered.filter((item) => selected.has(toKey(item))),
    [filtered, selected]
  );

  const allCurrentSelected =
    paginated.length > 0 && paginated.every((item) => selected.has(toKey(item)));

  const start = total === 0 ? 0 : (page - 1) * limit + 1;
  const end = Math.min(total, (page - 1) * limit + paginated.length);

  const toggle = (item: CertificateRecord) => {
    const key = toKey(item);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const togglePage = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allCurrentSelected) {
        paginated.forEach((item) => next.delete(toKey(item)));
      } else {
        paginated.forEach((item) => next.add(toKey(item)));
      }
      return next;
    });
  };

  const clearFilters = () => {
    setSearchInput("");
    setStatus("all");
    setFromDate("");
    setToDate("");
    setOrganization("all");
  };

  const onCopyHash = async (item: CertificateRecord) => {
    try {
      await copyToClipboard(item.certHash);
      setCopiedHash(toKey(item));
      setTimeout(() => setCopiedHash(null), 1200);
    } catch {
      toast.error(t("common.copyHashError"));
    }
  };

  const downloadQr = async (item: CertificateRecord) => {
    try {
      setDownloadingQr(toKey(item));
      const blob = await api.getCertificateQRBlob(item.certId);
      downloadBlob(blob, `${item.certId}-qr.png`);
      toast.success(t("certs.qrDownloaded", { id: item.certId }));
    } catch (err: unknown) {
      toast.error(getFriendlyError(err, t("certs.qrFailed")));
    } finally {
      setDownloadingQr(null);
    }
  };

  const exportCsv = () => {
    if (!selectedCertificates.length) {
      toast.warning(t("certs.selectOne"));
      return;
    }

    const header = [
      t("common.certificateId"),
      t("common.recipient"),
      t("common.course"),
      t("common.issuedDate"),
      t("common.organization"),
      t("common.status"),
      t("common.hash"),
      t("common.txHash"),
    ];

    const rows = selectedCertificates.map((item) =>
      [
        item.certId,
        item.recipientName,
        item.courseName,
        formatDate(item.issuedAt, locale),
        item.issuingOrg,
        item.isRevoked ? t("common.revoked") : t("common.valid"),
        item.certHash,
        item.txHash || "",
      ]
        .map((cell) => toCsvCell(String(cell || "")))
        .join(",")
    );

    const csv = [header.map(toCsvCell).join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    downloadBlob(blob, `certificates-${new Date().toISOString().slice(0, 10)}.csv`);
    toast.success(t("certs.csvExported"));
  };

  const downloadZip = async () => {
    if (!selectedCertificates.length) {
      toast.warning(t("certs.selectOne"));
      return;
    }

    try {
      setDownloadingZip(true);
      const zip = new JSZip();
      for (const item of selectedCertificates) {
        const blob = await api.getCertificateQRBlob(item.certId);
        zip.file(`${item.certId}-qr.png`, blob);
      }
      const zipBlob = await zip.generateAsync({ type: "blob" });
      downloadBlob(zipBlob, `certificate-qr-${new Date().toISOString().slice(0, 10)}.zip`);
      toast.success(t("certs.zipDownloaded"));
    } catch (err: unknown) {
      toast.error(getFriendlyError(err, t("certs.zipFailed")));
    } finally {
      setDownloadingZip(false);
    }
  };

  const syncFromChain = async () => {
    try {
      setSyncingChain(true);
      const events = await api.getAuditEvents({ eventType: "issued", limit: 200 });
      const txHashes = Array.from(
        new Set(
          events
            .map((event) => event.txHash)
            .filter((txHash): txHash is string => /^0x[0-9a-fA-F]{64}$/.test(txHash || ""))
        )
      );

      if (!txHashes.length) {
        toast.warning(t("certs.syncNoEvents"));
        return;
      }

      let synced = 0;
      let failed = 0;
      for (const txHash of txHashes) {
        try {
          await api.syncCertificateFromChain(txHash);
          synced += 1;
        } catch {
          failed += 1;
        }
      }

      await load();
      if (failed > 0) {
        toast.warning(t("certs.syncPartial", { synced, failed }));
      } else {
        toast.success(t("certs.syncSuccess", { count: synced }));
      }
    } catch (err: unknown) {
      toast.error(getFriendlyError(err, t("certs.syncFailed")));
    } finally {
      setSyncingChain(false);
    }
  };

  const openDrawer = async (item: CertificateRecord) => {
    setActiveCert(item);
    setHistory(null);
    setHistoryLoading(true);

    try {
      const response = await api.getVerifyHistory(item.certId);
      if (Array.isArray(response)) {
        const rows = response
          .map((record) => ({
            verifiedAt: String((record as { verifiedAt?: string }).verifiedAt || ""),
            ipAddress: (record as { ipAddress?: string }).ipAddress,
          }))
          .filter((record) => Boolean(record.verifiedAt));
        setHistory({
          verificationCount: rows.length,
          lastVerifiedAt: rows.length ? rows[rows.length - 1].verifiedAt : null,
          records: rows,
        });
      } else if (response && typeof response === "object") {
        const payload = response as {
          verificationCount?: number;
          lastVerifiedAt?: string;
          history?: Array<{ verifiedAt?: string; ipAddress?: string }>;
        };
        const rows = (payload.history || [])
          .map((record) => ({
            verifiedAt: String(record.verifiedAt || ""),
            ipAddress: record.ipAddress,
          }))
          .filter((record) => Boolean(record.verifiedAt));

        setHistory({
          verificationCount: payload.verificationCount ?? rows.length,
          lastVerifiedAt: payload.lastVerifiedAt || (rows.length ? rows[rows.length - 1].verifiedAt : null),
          records: rows,
        });
      } else {
        setHistory({ verificationCount: 0, lastVerifiedAt: null, records: [] });
      }
    } catch {
      setHistory({ verificationCount: 0, lastVerifiedAt: null, records: [] });
    } finally {
      setHistoryLoading(false);
    }
  };

  const openRevoke = (item: CertificateRecord) => {
    setRevokeCert(item);
    setRevokeReason("");
    setRevokeError(null);
    setRevokeOpen(true);
  };

  const closeRevoke = () => {
    setRevokeOpen(false);
    setRevokeCert(null);
    setRevokeReason("");
    setRevokeError(null);
  };

  const confirmRevoke = async () => {
    if (!revokeCert) return;
    const reason = revokeReason.trim();
    if (!reason) {
      setRevokeError(t("certs.reasonRequired"));
      return;
    }

    try {
      setRevokeLoading(true);
      setRevokeError(null);
      await api.revokeCertificate(revokeCert.certHash, reason);
      toast.success(t("certs.revokedToast"));
      closeRevoke();
      await load();
    } catch (err: unknown) {
      const message = getFriendlyError(err, t("certs.revokeFailed"));
      setRevokeError(message);
      toast.error(message);
    } finally {
      setRevokeLoading(false);
    }
  };

  const explorer = SUPPORTED_CHAINS[CHAIN_ID]?.explorer;

  return (
    <div className="page-bg min-h-screen pb-20 md:pb-8">
      <AdminSidebar />

      <main className="px-4 py-8 md:ml-60 md:px-8">
        <h1 className="page-title">{t("certs.title")}</h1>
        <p className="page-subtitle mt-2">
          {t("certs.subtitle")}
        </p>

        <section className="glass mt-6 p-5">
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-12">
            <div className="relative xl:col-span-4">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder={t("certs.searchPlaceholder")}
                className="h-12 w-full rounded-xl bg-[var(--bg-input)] pl-9 pr-3 text-[15px]"
              />
            </div>

            <div className="xl:col-span-2">
              <select value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)} className="h-12 w-full rounded-xl bg-[var(--bg-input)] px-3 text-[15px]">
                <option value="all">{t("certs.allStatus")}</option>
                <option value="valid">{t("common.valid")}</option>
                <option value="revoked">{t("common.revoked")}</option>
              </select>
            </div>

            <div className="xl:col-span-2">
              <input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} className="h-12 w-full rounded-xl bg-[var(--bg-input)] px-3 text-[15px]" />
            </div>

            <div className="xl:col-span-2">
              <input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} className="h-12 w-full rounded-xl bg-[var(--bg-input)] px-3 text-[15px]" />
            </div>

            <div className="xl:col-span-2">
              <select value={organization} onChange={(event) => setOrganization(event.target.value)} className="h-12 w-full rounded-xl bg-[var(--bg-input)] px-3 text-[15px]">
                <option value="all">{t("certs.allOrganizations")}</option>
                {organizations.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => void load()} className="btn-outline inline-flex items-center gap-2 px-3 py-2 text-[15px]" disabled={loading}>
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              {t("common.refresh")}
            </button>

            <button type="button" onClick={exportCsv} className="btn-outline inline-flex items-center gap-2 px-3 py-2 text-[15px]">
              <Download size={14} />
              {t("certs.exportCsv", { count: selectedCertificates.length })}
            </button>

            <button
              type="button"
              onClick={() => void syncFromChain()}
              disabled={syncingChain}
              className="btn-outline inline-flex items-center gap-2 px-3 py-2 text-[15px]"
            >
              {syncingChain ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              {t("certs.syncFromChain")}
            </button>

            <button
              type="button"
              onClick={() => void downloadZip()}
              disabled={downloadingZip}
              className="btn-outline inline-flex items-center gap-2 px-3 py-2 text-[15px]"
            >
              {downloadingZip ? <Loader2 size={14} className="animate-spin" /> : <QrCode size={14} />}
              {t("certs.downloadZip")}
            </button>

            <button type="button" onClick={clearFilters} className="btn-outline px-3 py-2 text-[15px]">
              {t("certs.clearFilters")}
            </button>
          </div>
        </section>

        {error ? (
          <div className="mt-4 rounded-xl border border-[rgba(255,77,109,0.3)] bg-[var(--red-glow)] px-4 py-3 text-[15px] text-[var(--red)]">
            {error}
          </div>
        ) : null}

        <section className="glass mt-6 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="readable-table w-full min-w-[1100px]">
              <thead className="bg-[var(--bg-surface)]">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <button type="button" onClick={togglePage} className="text-[var(--text-secondary)]">
                      {allCurrentSelected ? <CheckSquare size={16} className="text-[var(--teal)]" /> : <Square size={16} />}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left uppercase text-[var(--text-muted)]">{t("common.certificateId")}</th>
                  <th className="px-4 py-3 text-left uppercase text-[var(--text-muted)]">{t("common.recipient")}</th>
                  <th className="px-4 py-3 text-left uppercase text-[var(--text-muted)]">{t("common.course")}</th>
                  <th className="px-4 py-3 text-left uppercase text-[var(--text-muted)]">{t("common.issuedDate")}</th>
                  <th className="px-4 py-3 text-left uppercase text-[var(--text-muted)]">{t("common.hash")}</th>
                  <th className="px-4 py-3 text-left uppercase text-[var(--text-muted)]">{t("common.status")}</th>
                  <th className="px-4 py-3 text-left uppercase text-[var(--text-muted)]">{t("common.actions")}</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  Array.from({ length: 7 }, (_, idx) => (
                    <tr key={`skeleton-${idx + 1}`} className="border-t border-[var(--border)]">
                      <td className="px-4 py-4"><div className="skeleton h-4 w-4" /></td>
                      <td className="px-4 py-4"><div className="skeleton h-4 w-28" /></td>
                      <td className="px-4 py-4"><div className="skeleton h-4 w-36" /></td>
                      <td className="px-4 py-4"><div className="skeleton h-4 w-32" /></td>
                      <td className="px-4 py-4"><div className="skeleton h-4 w-24" /></td>
                      <td className="px-4 py-4"><div className="skeleton h-4 w-32" /></td>
                      <td className="px-4 py-4"><div className="skeleton h-6 w-20" /></td>
                      <td className="px-4 py-4"><div className="skeleton h-4 w-20" /></td>
                    </tr>
                  ))
                ) : paginated.length ? (
                  paginated.map((item) => (
                    <TableRow
                      key={toKey(item)}
                      certificate={item}
                      selected={selected.has(toKey(item))}
                      onToggle={toggle}
                      onOpen={(certificate) => {
                        void openDrawer(certificate);
                      }}
                      onDownload={(certificate) => {
                        void downloadQr(certificate);
                      }}
                      onRevoke={openRevoke}
                      onCopyHash={(certificate) => {
                        void onCopyHash(certificate);
                      }}
                      copied={copiedHash === toKey(item)}
                      labels={{ valid: t("common.valid"), revoked: t("common.revoked") }}
                      locale={locale}
                    />
                  ))
                ) : (
                  <tr>
                    <td className="px-4 py-16 text-center" colSpan={8}>
                      <p className="text-[16px] text-[var(--text-secondary)]">{t("certs.noFound")}</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] px-4 py-4 text-[15px]">
            <p className="text-[var(--text-secondary)]">{t("certs.showing", { start, end, total })}</p>

            <div className="flex items-center gap-2">
              <label className="text-[var(--text-secondary)]">{t("certs.pageSize")}</label>
              <select
                value={limit}
                onChange={(event) => {
                  setLimit(Number(event.target.value));
                  setPage(1);
                }}
                className="h-9 rounded-lg bg-[var(--bg-input)] px-2 text-[15px]"
              >
                {[10, 20, 50].map((size) => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={page === 1}
                className="btn-outline px-3 py-1.5 text-[14px]"
              >
                {t("common.previous")}
              </button>

              <span className="text-[var(--text-secondary)]">{page} / {totalPages}</span>

              <button
                type="button"
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={page === totalPages}
                className="btn-outline px-3 py-1.5 text-[14px]"
              >
                {t("common.next")}
              </button>
            </div>
          </div>
        </section>
      </main>

      {activeCert ? (
        <div className="fixed inset-0 z-50">
          <button type="button" className="absolute inset-0 bg-black/55" onClick={() => setActiveCert(null)} />
          <aside className="absolute right-0 top-0 h-full w-full max-w-[480px] overflow-y-auto border-l border-[var(--border)] bg-[var(--bg-surface)] p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">{t("certs.detail")}</h2>
              <button type="button" onClick={() => setActiveCert(null)} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                <X size={18} />
              </button>
            </div>

            <div className="mt-5 space-y-4 text-[15px]">
              <Detail label={t("common.certificateId")} value={activeCert.certId} mono />
              <Detail label={t("common.recipient")} value={activeCert.recipientName} />
              <Detail label={t("common.course")} value={activeCert.courseName} />
              <Detail label={t("common.organization")} value={activeCert.issuingOrg} />
              <Detail label={t("common.issuedDate")} value={formatDate(activeCert.issuedAt, locale)} />
              <Detail label={t("common.hash")} value={activeCert.certHash} mono />
              <Detail label={t("common.txHash")} value={activeCert.txHash || t("common.na")} mono />
              <Detail label={t("common.blockNumber")} value={String(activeCert.blockNumber || t("common.na"))} />

              {activeCert.ipfsUrl ? (
                <a href={activeCert.ipfsUrl} target="_blank" rel="noopener noreferrer" className="btn-outline inline-flex w-full items-center justify-center px-4 py-2 text-sm">
                  {t("certs.viewIpfsDocument")}
                </a>
              ) : null}

              {explorer && activeCert.txHash ? (
                <a
                  href={`${explorer}/tx/${activeCert.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-outline inline-flex w-full items-center justify-center px-4 py-2 text-sm"
                >
                  {t("certs.viewBlockchainTx")}
                </a>
              ) : null}

              <section className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
                <h3 className="text-[15px] font-semibold text-[var(--text-primary)]">{t("certs.verificationHistory")}</h3>
                {historyLoading ? (
                  <div className="mt-3 space-y-2">
                    <div className="skeleton h-4 w-2/3" />
                    <div className="skeleton h-4 w-1/2" />
                  </div>
                ) : history ? (
                  <div className="mt-3 text-[14px] text-[var(--text-secondary)]">
                    <p>{t("certs.count", { count: history.verificationCount })}</p>
                    <p className="mt-1">{t("certs.lastVerified", { value: history.lastVerifiedAt ? formatDate(history.lastVerifiedAt, locale) : t("common.na") })}</p>
                    <div className="mt-3 max-h-40 space-y-2 overflow-auto">
                      {history.records.length ? (
                        history.records.map((item, index) => (
                          <div key={`${item.verifiedAt}-${index}`} className="rounded-lg border border-[var(--border)] px-2 py-1.5">
                            {formatDate(item.verifiedAt, locale)}
                          </div>
                        ))
                      ) : (
                        <p>{t("certs.noHistory")}</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="mt-3 text-[14px] text-[var(--text-secondary)]">{t("certs.noHistoryData")}</p>
                )}
              </section>

              {!activeCert.isRevoked ? (
                <button
                  type="button"
                  onClick={() => openRevoke(activeCert)}
                  className="w-full rounded-xl bg-[var(--red)] px-4 py-2.5 text-[15px] font-semibold text-white"
                >
                  {t("certs.revoke")}
                </button>
              ) : null}
            </div>
          </aside>
        </div>
      ) : null}

      {revokeOpen && revokeCert ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
          <section className="glass w-full max-w-[480px] p-8">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--red-glow)]">
              <XCircle size={28} className="text-[var(--red)]" />
            </div>
            <h2 className="mt-4 text-center text-2xl font-bold text-[var(--red)]">{t("certs.revoke")}</h2>
            <p className="mt-2 text-center text-[15px] text-[var(--text-secondary)]">{t("certs.revokeBody")}</p>

            <div className="mt-5 rounded-xl border border-[var(--border)] bg-[var(--bg-input)] p-3 text-[15px]">
              <p className="mono text-[var(--teal)]">{revokeCert.certId}</p>
              <p className="mt-1 text-[var(--text-secondary)]">{revokeCert.recipientName}</p>
            </div>

            <label className="mt-5 block text-[15px] text-[var(--text-secondary)]">
              {t("certs.reason")}
              <textarea
                value={revokeReason}
                onChange={(event) => setRevokeReason(event.target.value)}
                rows={4}
                className="mt-2 w-full rounded-xl bg-[var(--bg-input)] px-3 py-2"
                placeholder={t("certs.reasonPlaceholder")}
              />
            </label>

            {revokeError ? <p className="mt-2 text-[15px] text-[var(--red)]">{revokeError}</p> : null}

            <div className="mt-6 flex items-center justify-end gap-2">
              <button type="button" onClick={closeRevoke} className="btn-outline px-4 py-2 text-[15px]" disabled={revokeLoading}>
                {t("common.cancel")}
              </button>
              <button
                type="button"
                onClick={() => void confirmRevoke()}
                className="inline-flex items-center gap-2 rounded-xl bg-[var(--red)] px-4 py-2 text-[15px] font-semibold text-white disabled:opacity-60"
                disabled={revokeLoading || !revokeReason.trim()}
              >
                {revokeLoading ? <Loader2 size={14} className="animate-spin" /> : null}
                {t("certs.confirmRevoke")}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {downloadingQr ? (
        <div className="fixed bottom-4 right-4 rounded-full border border-[var(--teal-border)] bg-[var(--teal-glow)] px-3 py-2 text-[14px] text-[var(--teal)]">
          {t("certs.downloadingQr")}
        </div>
      ) : null}
    </div>
  );
}

function Detail({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-3">
      <p className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--text-muted)]">{label}</p>
      <p className={`${mono ? "mono" : ""} mt-1 break-all text-[15px] font-semibold text-[var(--text-primary)]`}>{value}</p>
    </div>
  );
}
