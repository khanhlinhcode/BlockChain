"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ShieldAlert, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useLanguage } from "@/context/LanguageContext";
import type { CertificateRecord } from "@/types";

export default function RevokePage() {
  const params = useParams();
  const router = useRouter();
  const { t } = useLanguage();
  const certRef = params.id as string;

  const [cert, setCert] = useState<CertificateRecord | null>(null);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCert() {
      try {
        const lookup = decodeURIComponent(certRef || "");
        try {
          const data = await api.getCertificate(lookup);
          setCert(data.certificate as CertificateRecord);
          return;
        } catch {
          const response = await api.getCertificatesAdvanced({
            page: 1,
            limit: 50,
            search: lookup,
            status: "all",
            order: "desc",
          });
          const match = (response.certificates || []).find(
            (item: CertificateRecord) => item.certHash === lookup || item.certId === lookup
          );
          if (!match) {
            throw new Error(t("revoke.notFound"));
          }
          setCert(match);
        }
      } catch (err: any) {
        const message = err.response?.data?.error || err.message || t("revoke.notFound");
        setError(message);
        toast.error(message);
      } finally {
        setLoading(false);
      }
    }
    if (certRef) void fetchCert();
  }, [certRef, t]);

  const handleRevoke = async () => {
    if (!cert) return;
    if (!reason.trim()) {
      setError(t("revoke.reasonRequired"));
      return;
    }
    try {
      setRevoking(true);
      setError(null);
      await api.revokeCertificate(cert.certHash, reason);
      toast.success(t("revoke.success"));
      router.push("/admin/certificates");
    } catch (err: any) {
      const message = err.response?.data?.error || t("revoke.failed");
      setError(message);
      toast.error(message);
    } finally {
      setRevoking(false);
    }
  };

  return (
    <div className="container mx-auto max-w-2xl px-4 py-8">
      <button
        onClick={() => router.back()}
        className="inline-flex items-center gap-2 text-muted-foreground hover:text-white mb-8 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        {t("common.back")}
      </button>

      <motion.div
        className="glass rounded-2xl p-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center">
            <ShieldAlert className="w-6 h-6 text-red-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">
              {t("revoke.title")}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t("revoke.subtitle")}
            </p>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-red-400 text-sm mb-6">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : cert ? (
          <div className="space-y-6">
            <div className="bg-white/5 rounded-lg p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">{t("common.recipient")}</span>
                <span className="text-sm text-white">{cert.recipientName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">{t("common.course")}</span>
                <span className="text-sm text-white">{cert.courseName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">{t("common.status")}</span>
                <span
                  className={`text-sm font-medium ${
                    cert.isRevoked
                      ? "text-red-400"
                      : "text-green-400"
                  }`}
                >
                  {cert.isRevoked ? t("common.revoked") : t("revoke.active")}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-2">
                {t("revoke.reasonLabel")}
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-red-500/50 transition-all resize-none h-24"
                placeholder={t("revoke.reasonPlaceholder")}
              />
            </div>

            <button
              onClick={handleRevoke}
              disabled={revoking || cert.isRevoked}
              className="w-full py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {revoking ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <ShieldAlert className="w-4 h-4" />
                  {t("revoke.title")}
                </>
              )}
            </button>
          </div>
        ) : null}
      </motion.div>
    </div>
  );
}
