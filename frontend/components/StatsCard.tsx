"use client";

import type { LucideIcon } from "lucide-react";

interface StatsCardProps {
  title: string;
  value: number;
  icon: LucideIcon;
  color: "teal" | "green" | "red" | "amber";
  loading?: boolean;
}

const COLOR_MAP = {
  teal: {
    bg: "bg-[var(--teal-glow)]",
    text: "text-[var(--teal)]",
    border: "border-[var(--teal-border)]",
  },
  green: {
    bg: "bg-[var(--green-glow)]",
    text: "text-[var(--green)]",
    border: "border-[rgba(0,214,143,0.3)]",
  },
  red: {
    bg: "bg-[var(--red-glow)]",
    text: "text-[var(--red)]",
    border: "border-[rgba(255,77,109,0.3)]",
  },
  amber: {
    bg: "bg-[rgba(255,184,0,0.14)]",
    text: "text-[var(--amber)]",
    border: "border-[rgba(255,184,0,0.3)]",
  },
};

export default function StatsCard({ title, value, icon: Icon, color, loading }: StatsCardProps) {
  const styles = COLOR_MAP[color];

  return (
    <article className={`glass p-6 ${styles.border} transition-all duration-200 hover:-translate-y-0.5`}>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-[var(--text-muted)]">{title}</p>
        <span className={`inline-flex rounded-full p-2 ${styles.bg}`}>
          <Icon className={styles.text} size={16} />
        </span>
      </div>

      {loading ? (
        <div className="skeleton h-10 w-24" />
      ) : (
        <p className="text-4xl font-extrabold leading-none gradient-text">{value.toLocaleString()}</p>
      )}
    </article>
  );
}
