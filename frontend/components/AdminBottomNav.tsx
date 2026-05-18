"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, FileCheck2, FilePlus2, ScrollText } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

const ITEMS = [
  { href: "/admin/dashboard", labelKey: "admin.dashboard", icon: LayoutDashboard },
  { href: "/admin/issue", labelKey: "admin.issueCertificate", icon: FilePlus2 },
  { href: "/admin/certificates", labelKey: "admin.certificates", icon: FileCheck2 },
  { href: "/admin/audit", labelKey: "admin.auditLog", icon: ScrollText },
];

export default function AdminBottomNav() {
  const pathname = usePathname();
  const { t } = useLanguage();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border)] bg-[var(--bg-primary)]/95 px-2 py-2 backdrop-blur-xl md:hidden">
      <div className="grid grid-cols-4 gap-1">
        {ITEMS.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`inline-flex flex-col items-center justify-center gap-1 rounded-lg px-2 py-2 text-xs font-medium ${
                active
                  ? "text-[var(--accent-teal)] bg-[rgba(0,212,255,0.08)]"
                  : "text-[var(--text-secondary)]"
              }`}
            >
              <Icon size={14} />
              {t(item.labelKey)}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
