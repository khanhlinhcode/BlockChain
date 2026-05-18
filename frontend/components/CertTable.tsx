"use client";

import { memo } from "react";
import Link from "next/link";
import { Eye, ShieldAlert } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { localeForLanguage } from "@/lib/i18n";
import { useLanguage } from "@/context/LanguageContext";
import type { CertificateRecord } from "@/types";

interface CertTableProps {
  certificates: CertificateRecord[];
  loading?: boolean;
}

function CertTable({ certificates, loading }: CertTableProps) {
  const { language, t } = useLanguage();
  const locale = localeForLanguage(language);

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 6 }, (_, idx) => (
          <div key={`cert-skeleton-${idx + 1}`} className="skeleton h-14 w-full" />
        ))}
      </div>
    );
  }

  if (!certificates.length) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] py-12 text-center text-[15px] text-[var(--text-secondary)]">
        {t("certTable.noFound")}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
      <table className="readable-table w-full min-w-[760px]">
        <thead className="bg-[var(--bg-surface)]">
          <tr>
            <th className="px-4 py-3 text-left uppercase text-[var(--text-muted)]">
              {t("common.certificateId")}
            </th>
            <th className="px-4 py-3 text-left uppercase text-[var(--text-muted)]">
              {t("common.recipient")}
            </th>
            <th className="px-4 py-3 text-left uppercase text-[var(--text-muted)]">
              {t("common.course")}
            </th>
            <th className="px-4 py-3 text-left uppercase text-[var(--text-muted)]">
              {t("common.issuedDate")}
            </th>
            <th className="px-4 py-3 text-left uppercase text-[var(--text-muted)]">
              {t("common.status")}
            </th>
            <th className="px-4 py-3 text-right uppercase text-[var(--text-muted)]">
              {t("common.actions")}
            </th>
          </tr>
        </thead>

        <tbody>
          {certificates.map((certificate) => (
            <tr key={certificate._id || certificate.certHash} className="border-t border-[var(--border)] hover:bg-[var(--bg-card)]">
              <td className="px-4 py-3 mono text-[13px] text-[var(--teal)]">{certificate.certId}</td>
              <td className="px-4 py-3 font-medium text-[var(--text-primary)]">{certificate.recipientName}</td>
              <td className="px-4 py-3 text-[var(--text-secondary)]">{certificate.courseName}</td>
              <td className="px-4 py-3 text-[var(--text-secondary)]">{formatDate(certificate.issuedAt, locale)}</td>
              <td className="px-4 py-3">
                <span
                  className={`status-badge inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-medium ${
                    certificate.isRevoked
                      ? "border border-[rgba(255,77,109,0.35)] bg-[var(--red-glow)] text-[var(--red)]"
                      : "border border-[rgba(0,214,143,0.35)] bg-[var(--green-glow)] text-[var(--green)]"
                  }`}
                >
                  {certificate.isRevoked ? <ShieldAlert size={12} /> : null}
                  {certificate.isRevoked ? t("common.revoked") : t("common.valid")}
                </span>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center justify-end gap-2">
                  <Link
                    href={`/verify/${encodeURIComponent(certificate.certId)}`}
                    className="rounded-lg p-2 text-[var(--text-secondary)] transition-all duration-200 hover:bg-[var(--teal-glow)] hover:text-[var(--teal)]"
                    title={t("certTable.viewVerification")}
                  >
                    <Eye size={15} />
                  </Link>

                  {!certificate.isRevoked ? (
                    <Link
                      href={`/admin/revoke/${encodeURIComponent(certificate.certHash)}`}
                      className="rounded-lg p-2 text-[var(--text-secondary)] transition-all duration-200 hover:bg-[var(--red-glow)] hover:text-[var(--red)]"
                      title={t("certTable.revokeCertificate")}
                    >
                      <ShieldAlert size={15} />
                    </Link>
                  ) : null}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default memo(CertTable);
