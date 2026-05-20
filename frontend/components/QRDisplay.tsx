"use client";

import { useMemo } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Download } from "lucide-react";

interface QRDisplayProps {
  value: string;
  size?: number;
  certId?: string;
}

export default function QRDisplay({ value, size = 200, certId }: QRDisplayProps) {
  const qrValue = useMemo(() => value.trim(), [value]);
  const fileName = `QR-${certId || qrValue.split("/").filter(Boolean).pop() || "certificate"}.png`;

  const downloadQr = () => {
    const svg = document.querySelector(`[data-qr-id="certchain-qr"] svg`);
    if (!(svg instanceof SVGElement)) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const image = new Image();
    const canvas = document.createElement("canvas");
    const padding = 24;
    canvas.width = size + padding * 2;
    canvas.height = size + padding * 2;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    image.onload = () => {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, padding, padding, size, size);
      const link = document.createElement("a");
      link.href = canvas.toDataURL("image/png");
      link.download = fileName;
      link.click();
    };
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgData)}`;
  };

  if (!qrValue) return null;

  return (
    <div className="inline-flex flex-col items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4 shadow-[var(--shadow-card)]">
      <div className="rounded-xl bg-white p-3" data-qr-id="certchain-qr">
        <QRCodeSVG
          value={qrValue}
          size={size}
          level="H"
          includeMargin={false}
          bgColor="#ffffff"
          fgColor="#000000"
        />
      </div>
      <p className="mono max-w-[260px] truncate text-center text-xs text-[var(--text-secondary)]">{qrValue}</p>
      <button
        type="button"
        onClick={downloadQr}
        className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--teal-border)] px-4 py-2 text-sm font-semibold text-[var(--teal)] transition-all duration-200 hover:bg-[var(--teal-glow)]"
      >
        <Download size={15} />
        Download QR Code
      </button>
    </div>
  );
}
