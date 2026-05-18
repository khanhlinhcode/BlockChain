"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Download, ExternalLink, X } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

interface PDFViewerModalProps {
  open: boolean;
  pdfUrl: string;
  certId: string;
  onClose: () => void;
}

export default function PDFViewerModal({
  open,
  pdfUrl,
  certId,
  onClose,
}: PDFViewerModalProps) {
  const { t } = useLanguage();

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            className="fixed inset-0 z-50 bg-black/65"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-5"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
          >
            <div className="glass-card h-[92vh] w-full max-w-6xl p-3 sm:p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="truncate text-sm text-[var(--text-primary)]">
                  {t("pdf.title")} • <span className="font-mono">{certId}</span>
                </p>
                <div className="flex items-center gap-2">
                  <a
                    href={pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-ghost inline-flex items-center gap-1 px-2.5 py-1.5 text-xs"
                  >
                    <ExternalLink size={13} />
                    {t("pdf.open")}
                  </a>
                  <a
                    href={pdfUrl}
                    download={`${certId}.pdf`}
                    className="btn-primary inline-flex items-center gap-1 px-2.5 py-1.5 text-xs"
                  >
                    <Download size={13} />
                    {t("common.download")}
                  </a>
                  <button
                    type="button"
                    onClick={onClose}
                    className="btn-ghost inline-flex items-center gap-1 px-2.5 py-1.5 text-xs"
                    aria-label={t("pdf.close")}
                  >
                    <X size={13} />
                    {t("pdf.close")}
                  </button>
                </div>
              </div>

              <iframe
                src={`${pdfUrl}#view=FitH`}
                title={`Certificate ${certId}`}
                className="h-[calc(92vh-64px)] w-full rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)]"
              />
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}
