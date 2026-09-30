"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Download, ExternalLink, X } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

interface PDFViewerModalProps {
  open: boolean;
  pdfUrl: string;
  certId: string;
  onClose: () => void;
}

export default function PDFViewerModal({ open, pdfUrl, certId, onClose }: PDFViewerModalProps) {
  const { t } = useLanguage();

  return (
    <Dialog.Root open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-sm" />
        <Dialog.Content
          className="glass-floating fixed inset-2 z-[100] flex flex-col overflow-hidden p-3 outline-none sm:inset-5 sm:p-4"
          aria-describedby={undefined}
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <Dialog.Title className="min-w-0 truncate text-sm font-semibold text-[var(--text-primary)]">
              {t("pdf.title")} <span aria-hidden>·</span> <span className="font-mono">{certId}</span>
            </Dialog.Title>
            <div className="flex shrink-0 items-center gap-2">
              <a
                href={pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-ghost inline-flex min-h-11 items-center gap-1.5 px-3 text-xs"
              >
                <ExternalLink size={14} />
                <span className="hidden sm:inline">{t("pdf.open")}</span>
              </a>
              <a
                href={pdfUrl}
                download={`${certId}.pdf`}
                className="btn-primary inline-flex min-h-11 items-center gap-1.5 px-3 text-xs"
              >
                <Download size={14} />
                <span className="hidden sm:inline">{t("common.download")}</span>
              </a>
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-interactive)] text-[var(--text-primary)]"
                  aria-label={t("pdf.close")}
                >
                  <X size={16} />
                </button>
              </Dialog.Close>
            </div>
          </div>

          <iframe
            src={`${pdfUrl}#view=FitH`}
            title={t("pdf.iframeTitle", { id: certId })}
            className="min-h-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)]"
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
