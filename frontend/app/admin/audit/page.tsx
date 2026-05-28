"use client";

export const dynamic = "force-dynamic";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Filter, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import AdminSidebar from "@/components/admin/AdminSidebar";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { getFriendlyError } from "@/lib/errorMessages";
import { localeForLanguage } from "@/lib/i18n";
import { useLanguage } from "@/context/LanguageContext";
import type { SecurityAuditLog } from "@/types";

const ACTIONS = [
  "all",
  "LOGIN",
  "LOGIN_METAMASK",
  "LOGOUT",
  "ISSUE_CERT",
  "REVOKE_CERT",
  "ADD_WALLET",
  "UPDATE_WALLET",
  "DELETE_WALLET",
];

function csvEscape(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

export default function AdminAuditPage() {
  const { language, t } = useLanguage();
  const locale = localeForLanguage(language);
  const [logs, setLogs] = useState<SecurityAuditLog[]>([]);
  const [action, setAction] = useState("all");
  const [admin, setAdmin] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const query = useMemo(
    () => ({
      action: action === "all" ? undefined : action,
      admin: admin || undefined,
      from: from || undefined,
      to: to || undefined,
      page,
      limit: 25,
    }),
    [action, admin, from, to, page]
  );

  const loadLogs = useCallback(async () => {
    try {
      setLoading(true);
      const result = await api.getSecurityAuditLogs(query);
      setLogs(result.data);
      setTotalPages(result.totalPages);
    } catch (error) {
      toast.error(getFriendlyError(error, t("audit.loadFailed")));
    } finally {
      setLoading(false);
    }
  }, [query, t]);

  useEffect(() => {
    document.title = `${t("audit.title")} | CertChain`;
    void loadLogs();
  }, [loadLogs, t]);

  const exportCsv = () => {
    const rows = [
      ["Action", "Admin", "IP", "Status", "Time", "Details"],
      ...logs.map((log) => [
        log.action,
        log.adminUsername || "",
        log.ip || "",
        log.status,
        log.createdAt,
        JSON.stringify(log.details || {}),
      ]),
    ];
    const csv = rows.map((row) => row.map(csvEscape).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `certchain-audit-${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="page-bg min-h-screen pb-20 md:pb-8">
      <AdminSidebar />
      <main className="space-y-6 px-4 py-8 md:ml-60 md:px-8">
        <div>
          <h1 className="page-title">{t("audit.title")}</h1>
          <p className="page-subtitle mt-2">
            Security events for login, logout, certificate issuance, revocation, and wallet changes.
          </p>
        </div>

        <section className="glass-card p-4 sm:p-5">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
            <div className="relative lg:col-span-3">
              <Filter size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <select value={action} onChange={(event) => { setAction(event.target.value); setPage(1); }} className="input-dark w-full px-9 py-2.5 text-[15px]">
                {ACTIONS.map((item) => (
                  <option key={item} value={item}>{item === "all" ? "All actions" : item}</option>
                ))}
              </select>
            </div>
            <input value={admin} onChange={(event) => { setAdmin(event.target.value); setPage(1); }} placeholder="Admin username" className="input-dark px-3 py-2.5 text-[15px] lg:col-span-3" />
            <input type="date" value={from} onChange={(event) => { setFrom(event.target.value); setPage(1); }} className="input-dark px-3 py-2.5 text-[15px] lg:col-span-2" />
            <input type="date" value={to} onChange={(event) => { setTo(event.target.value); setPage(1); }} className="input-dark px-3 py-2.5 text-[15px] lg:col-span-2" />
            <div className="flex gap-2 lg:col-span-2">
              <button type="button" onClick={() => void loadLogs()} className="btn-ghost inline-flex items-center gap-2 px-3 py-2 text-[15px]">
                <RefreshCw size={14} />
                {t("common.refresh")}
              </button>
              <button type="button" onClick={exportCsv} className="btn-ghost inline-flex items-center gap-2 px-3 py-2 text-[15px]">
                <Download size={14} />
                CSV
              </button>
            </div>
          </div>
        </section>

        <section className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="readable-table w-full min-w-[980px]">
              <thead className="bg-[rgba(255,255,255,0.03)]">
                <tr>
                  <th className="px-4 py-3 text-left uppercase text-[var(--text-muted)]">Action</th>
                  <th className="px-4 py-3 text-left uppercase text-[var(--text-muted)]">Admin</th>
                  <th className="px-4 py-3 text-left uppercase text-[var(--text-muted)]">IP</th>
                  <th className="px-4 py-3 text-left uppercase text-[var(--text-muted)]">Status</th>
                  <th className="px-4 py-3 text-left uppercase text-[var(--text-muted)]">Time</th>
                  <th className="px-4 py-3 text-left uppercase text-[var(--text-muted)]">Details</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-[var(--text-secondary)]">
                      <Loader2 className="mx-auto animate-spin" />
                    </td>
                  </tr>
                ) : logs.length ? (
                  logs.map((log) => (
                    <tr key={log._id} className="border-t border-[var(--border)] hover:bg-[rgba(255,255,255,0.02)]">
                      <td className="px-4 py-3 font-mono text-[14px] text-[var(--teal)]">{log.action}</td>
                      <td className="px-4 py-3 text-[14px] text-[var(--text-primary)]">{log.adminUsername || "system"}</td>
                      <td className="px-4 py-3 font-mono text-[13px] text-[var(--text-secondary)]">{log.ip || "-"}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${log.status === "success" ? "badge-valid" : "badge-revoked"}`}>
                          {log.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[14px] text-[var(--text-secondary)]">{formatDate(log.createdAt, locale)}</td>
                      <td className="max-w-[360px] truncate px-4 py-3 font-mono text-[12px] text-[var(--text-muted)]">
                        {JSON.stringify(log.details || {})}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-[var(--text-secondary)]">
                      No audit events found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-[var(--border)] px-4 py-3 text-sm text-[var(--text-secondary)]">
            <button type="button" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="btn-ghost px-3 py-2 disabled:opacity-40">
              Previous
            </button>
            <span>Page {page} / {totalPages}</span>
            <button type="button" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)} className="btn-ghost px-3 py-2 disabled:opacity-40">
              Next
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
