"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Filter, RefreshCw } from "lucide-react";
import useSWR from "swr";
import { api } from "@/lib/api";
import { CHAIN_ID, SUPPORTED_CHAINS } from "@/lib/constants";
import { formatAddress, formatDate, truncateHash } from "@/lib/utils";
import { localeForLanguage } from "@/lib/i18n";
import { useLanguage } from "@/context/LanguageContext";
import AdminSidebar from "@/components/admin/AdminSidebar";
import type { AuditEventFilters, AuditEventItem, AuditEventType } from "@/types";

type EventFilterValue = "all" | AuditEventType;

function eventTypeLabel(type: AuditEventType): string {
  if (type === "issued") return "CertIssued";
  if (type === "revoked") return "CertRevoked";
  return "CertVerified";
}

function eventTypeClass(type: AuditEventType): string {
  if (type === "issued") return "badge-valid";
  if (type === "revoked") return "badge-revoked";
  return "badge-pending";
}

function useAuditEvents(filters: AuditEventFilters) {
  return useSWR(
    ["audit-events", filters.eventType || "all", filters.from || "", filters.to || "", filters.limit || 100] as const,
    async () => api.getAuditEvents(filters)
  );
}

export default function AdminAuditPage() {
  const { language, t } = useLanguage();
  const locale = localeForLanguage(language);
  const [eventType, setEventType] = useState<EventFilterValue>("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const filters = useMemo<AuditEventFilters>(
    () => ({
      eventType,
      from: fromDate || undefined,
      to: toDate || undefined,
      limit: 200,
    }),
    [eventType, fromDate, toDate]
  );

  const { data, isLoading, error, mutate } = useAuditEvents(filters);
  const events = data || [];
  const explorerBase = SUPPORTED_CHAINS[CHAIN_ID]?.explorer || "";

  return (
    <div className="page-bg min-h-screen pb-20 md:pb-8">
      <AdminSidebar />
      <main className="space-y-6 px-4 py-8 md:ml-60 md:px-8">
      <div>
        <h1 className="page-title">{t("audit.title")}</h1>
        <p className="page-subtitle mt-2">
          {t("audit.subtitle")}
        </p>
      </div>

      <section className="glass-card p-4 sm:p-5">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
          <div className="relative lg:col-span-4">
            <Filter
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
            />
            <select
              value={eventType}
              onChange={(event) => setEventType(event.target.value as EventFilterValue)}
              className="input-dark w-full px-9 py-2.5 text-[15px]"
            >
              <option value="all">{t("audit.allTypes")}</option>
              <option value="issued">CertIssued</option>
              <option value="revoked">CertRevoked</option>
              <option value="verified">CertVerified</option>
            </select>
          </div>
          <div className="lg:col-span-3">
            <input
              type="date"
              value={fromDate}
              onChange={(event) => setFromDate(event.target.value)}
              className="input-dark w-full px-3 py-2.5 text-[15px]"
              aria-label={t("common.fromDate")}
            />
          </div>
          <div className="lg:col-span-3">
            <input
              type="date"
              value={toDate}
              onChange={(event) => setToDate(event.target.value)}
              className="input-dark w-full px-3 py-2.5 text-[15px]"
              aria-label={t("common.toDate")}
            />
          </div>
          <div className="flex items-center gap-2 lg:col-span-2">
            <button
              type="button"
              onClick={() => void mutate()}
              className="btn-ghost inline-flex items-center gap-2 px-3 py-2 text-[15px]"
            >
              <RefreshCw size={14} />
              {t("common.refresh")}
            </button>
            <button
              type="button"
              onClick={() => {
                setEventType("all");
                setFromDate("");
                setToDate("");
              }}
              className="btn-ghost inline-flex items-center gap-2 px-3 py-2 text-[15px]"
            >
              {t("common.reset")}
            </button>
          </div>
        </div>
      </section>

      {error ? (
        <div className="rounded-lg border border-[rgba(239,68,68,0.25)] bg-[rgba(239,68,68,0.1)] px-4 py-3 text-[15px] text-[var(--accent-red)]">
          {(error as Error).message || t("audit.loadFailed")}
        </div>
      ) : null}

      <section className="glass-card overflow-hidden">
        <div className="hidden overflow-x-auto md:block">
          <table className="readable-table w-full min-w-[920px]">
            <thead className="bg-[rgba(255,255,255,0.03)]">
              <tr>
                <th className="px-4 py-3 text-left uppercase text-[var(--text-muted)]">
                  {t("audit.eventType")}
                </th>
                <th className="px-4 py-3 text-left uppercase text-[var(--text-muted)]">
                  {t("common.certificateId")}
                </th>
                <th className="px-4 py-3 text-left uppercase text-[var(--text-muted)]">
                  {t("audit.actor")}
                </th>
                <th className="px-4 py-3 text-left uppercase text-[var(--text-muted)]">
                  {t("audit.timestamp")}
                </th>
                <th className="px-4 py-3 text-left uppercase text-[var(--text-muted)]">
                  {t("audit.tx")}
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <AuditTableSkeleton />
              ) : events.length ? (
                events.map((event) => (
                  <AuditTableRow key={`${event.txHash}-${event.eventType}`} event={event} explorerBase={explorerBase} locale={locale} t={t} />
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-[16px] text-[var(--text-secondary)]">
                    {t("audit.noEventsFilters")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="space-y-3 p-4 md:hidden">
          {isLoading ? (
            <AuditCardSkeleton />
          ) : events.length ? (
            events.map((event) => (
              <motion.article
                key={`${event.txHash}-${event.blockNumber}`}
                className="rounded-lg border border-[var(--border)] p-3"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${eventTypeClass(event.eventType)}`}>
                    {eventTypeLabel(event.eventType)}
                  </span>
                  <span className="text-xs text-[var(--text-muted)]">#{event.blockNumber}</span>
                </div>
                <p className="text-[13px] font-medium text-[var(--text-muted)]">{t("common.certificateId")}</p>
                <p className="font-mono text-sm text-[var(--text-primary)]">{event.certId || t("common.unknown")}</p>
                <p className="mt-2 text-[13px] font-medium text-[var(--text-muted)]">{t("audit.actor")}</p>
                <p className="font-mono text-sm text-[var(--text-secondary)]">{formatAddress(event.actor)}</p>
                <p className="mt-2 text-[13px] font-medium text-[var(--text-muted)]">{t("audit.timestamp")}</p>
                <p className="text-sm text-[var(--text-secondary)]">{formatDate(event.timestamp, locale)}</p>
                <p className="mt-2 text-[13px] font-medium text-[var(--text-muted)]">{t("audit.transaction")}</p>
                {explorerBase && event.txHash ? (
                  <a
                    href={`${explorerBase}/tx/${event.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-sm text-[var(--accent-teal)] hover:underline"
                  >
                    {truncateHash(event.txHash, 10)}
                  </a>
                ) : (
                  <span className="font-mono text-sm text-[var(--text-secondary)]">
                    {truncateHash(event.txHash, 10)}
                  </span>
                )}
              </motion.article>
            ))
          ) : (
            <p className="py-10 text-center text-sm text-[var(--text-secondary)]">
              {t("audit.noEvents")}
            </p>
          )}
        </div>
      </section>
      </main>
    </div>
  );
}

function AuditTableRow({
  event,
  explorerBase,
  locale,
  t,
}: {
  event: AuditEventItem;
  explorerBase: string;
  locale: string;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  return (
    <tr className="border-t border-[var(--border)] hover:bg-[rgba(255,255,255,0.02)]">
      <td className="px-4 py-3">
        <span className={`status-badge inline-flex rounded-full px-2.5 py-1 font-medium ${eventTypeClass(event.eventType)}`}>
          {eventTypeLabel(event.eventType)}
        </span>
      </td>
      <td className="px-4 py-3 font-mono text-[14px] text-[var(--text-primary)]">{event.certId || t("common.unknown")}</td>
      <td className="px-4 py-3 font-mono text-[14px] text-[var(--text-secondary)]">{formatAddress(event.actor)}</td>
      <td className="px-4 py-3 text-sm text-[var(--text-secondary)]">{formatDate(event.timestamp, locale)}</td>
      <td className="px-4 py-3">
        {explorerBase && event.txHash ? (
          <a
            href={`${explorerBase}/tx/${event.txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-[14px] text-[var(--accent-teal)] hover:underline"
          >
            {truncateHash(event.txHash, 12)}
          </a>
        ) : (
          <span className="font-mono text-[14px] text-[var(--text-secondary)]">{truncateHash(event.txHash, 12)}</span>
        )}
      </td>
    </tr>
  );
}

function AuditTableSkeleton() {
  const rowIds = [
    "audit-skeleton-1",
    "audit-skeleton-2",
    "audit-skeleton-3",
    "audit-skeleton-4",
    "audit-skeleton-5",
    "audit-skeleton-6",
    "audit-skeleton-7",
  ];

  return (
    <>
      {rowIds.map((rowId) => (
        <tr key={rowId} className="border-t border-[var(--border)]">
          <td className="px-4 py-3">
            <div className="skeleton h-6 w-24" />
          </td>
          <td className="px-4 py-3">
            <div className="skeleton h-4 w-44" />
          </td>
          <td className="px-4 py-3">
            <div className="skeleton h-4 w-32" />
          </td>
          <td className="px-4 py-3">
            <div className="skeleton h-4 w-28" />
          </td>
          <td className="px-4 py-3">
            <div className="skeleton h-4 w-36" />
          </td>
        </tr>
      ))}
    </>
  );
}

function AuditCardSkeleton() {
  const cardIds = ["audit-card-1", "audit-card-2", "audit-card-3"];
  return (
    <>
      {cardIds.map((cardId) => (
        <div key={cardId} className="rounded-lg border border-[var(--border)] p-3">
          <div className="skeleton h-5 w-28" />
          <div className="mt-3 skeleton h-4 w-44" />
          <div className="mt-2 skeleton h-4 w-36" />
          <div className="mt-2 skeleton h-4 w-28" />
        </div>
      ))}
    </>
  );
}
