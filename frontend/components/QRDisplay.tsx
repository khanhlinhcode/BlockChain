"use client";

import { useMemo } from "react";
import { QRCodeSVG } from "qrcode.react";

interface QRDisplayProps {
  value: string;
  size?: number;
}

export default function QRDisplay({ value, size = 200 }: QRDisplayProps) {
  const qrValue = useMemo(() => value, [value]);

  return (
    <div className="inline-flex flex-col items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4 shadow-[var(--shadow-card)]">
      <div className="rounded-xl bg-white p-3">
        <QRCodeSVG
          value={qrValue}
          size={size}
          level="H"
          includeMargin={false}
          bgColor="#ffffff"
          fgColor="#000000"
        />
      </div>
      <p className="mono max-w-[220px] truncate text-center text-xs text-[var(--text-secondary)]">{qrValue}</p>
    </div>
  );
}
