"use client";

export const dynamic = "force-dynamic";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { ethers } from "ethers";
import {
  Activity,
  Flame,
  RefreshCw,
  ShieldCheck,
  ShieldX,
  Wallet,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { CHAIN_ID, CONTRACT_ADDRESS, SUPPORTED_CHAINS } from "@/lib/constants";
import { getFriendlyError } from "@/lib/errorMessages";
import { formatAddress, formatDate, truncateHash } from "@/lib/utils";
import { localeForLanguage } from "@/lib/i18n";
import { useMetaMask } from "@/hooks/useMetaMask";
import { useLanguage } from "@/context/LanguageContext";
import AdminSidebar from "@/components/admin/AdminSidebar";
import LogoutButton from "@/components/admin/LogoutButton";
import type { CertificateRecord, DashboardStats } from "@/types";

const FALLBACK_GAS_PRICE = ethers.parseUnits("20", "gwei");

function formatGasPrice(gasPrice: bigint) {
  return `${Number(ethers.formatUnits(gasPrice, "gwei")).toFixed(2)} gwei`;
}

function StatCard({
  label,
  value,
  icon,
  glow,
  trend,
}: {
  label: string;
  value: number;
  icon: ReactNode;
  glow: string;
  trend: string;
}) {
  return (
    <article className="glass relative overflow-hidden p-6">
      <div className={`absolute right-5 top-5 rounded-full p-2 ${glow}`}>{icon}</div>
      <p className="text-[15px] text-[var(--text-muted)]">{label}</p>
      <p className="mt-2 text-4xl font-extrabold leading-none gradient-text">{value.toLocaleString()}</p>
      <p className="mt-3 text-[13px] text-[var(--text-secondary)]">{trend}</p>
    </article>
  );
}

export default function AdminDashboardPage() {
  const { language, t } = useLanguage();
  const locale = localeForLanguage(language);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recent, setRecent] = useState<CertificateRecord[]>([]);
  const [gasPrice, setGasPrice] = useState("N/A");
  const { account, chainId } = useMetaMask();

  useEffect(() => {
    document.title = `${t("admin.dashboard")} | CertChain`;
  }, [t]);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [statsRes, certRes] = await Promise.all([
        api.getStats(),
        api.getCertificates(1, 10, "", "all", "desc"),
      ]);
      setStats(statsRes);
      setRecent((certRes.certificates || []) as CertificateRecord[]);
    } catch (err: unknown) {
      const message = getFriendlyError(err, t("dashboard.loadFailed"));
      setLoadError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    const loadGas = async () => {
      try {
        // Avoid MetaMask BrowserProvider here because some wallets/RPCs do not
        // support priority-fee lookup methods used by ethers fee detection.
        const active = new ethers.JsonRpcProvider(SUPPORTED_CHAINS[CHAIN_ID]?.rpcUrl);
        const fee = await active.getFeeData();
        setGasPrice(formatGasPrice(fee.gasPrice ?? FALLBACK_GAS_PRICE));
      } catch {
        setGasPrice(formatGasPrice(FALLBACK_GAS_PRICE));
      }
    };

    void loadGas();
  }, []);

  const chartData = useMemo(() => {
    if (stats?.monthlyData?.length) {
      return stats.monthlyData.map((row) => ({ month: row.month, count: row.count }));
    }
    return [
      { month: "Jan", count: 0 },
      { month: "Feb", count: 0 },
      { month: "Mar", count: 0 },
      { month: "Apr", count: 0 },
      { month: "May", count: 0 },
      { month: "Jun", count: 0 },
    ];
  }, [stats]);

  const pieData = useMemo(
    () => [
      { name: t("common.valid"), value: stats?.valid || 0, fill: "#00D68F" },
      { name: t("common.revoked"), value: stats?.revoked || 0, fill: "#FF4D6D" },
    ],
    [stats, t]
  );

  const chainName = SUPPORTED_CHAINS[chainId || CHAIN_ID]?.name || t("common.unknown");

  return (
    <div className="page-bg min-h-screen pb-20 md:pb-8">
      <AdminSidebar />

      <main className="md:ml-60">
        <header className="border-b border-[var(--border)] px-4 py-5 sm:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="page-title">{t("admin.dashboard")}</h1>
              <p className="page-subtitle mt-2">
                {t("dashboard.subtitle")}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-[15px] text-[var(--text-secondary)]">
                {new Date().toLocaleDateString(locale, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
              <button
                type="button"
                onClick={() => void loadDashboard()}
                className="btn-outline inline-flex items-center gap-2 px-3 py-2 text-sm"
                disabled={loading}
              >
                <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                {t("common.refresh")}
              </button>
              <LogoutButton compact />
            </div>
          </div>
        </header>

        <section className="px-4 py-6 sm:px-8">
          {loadError ? (
            <div className="mb-5 rounded-xl border border-[rgba(255,77,109,0.3)] bg-[var(--red-glow)] px-4 py-3 text-[15px] text-[var(--red)]">
              {loadError}
            </div>
          ) : null}

          {loading ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
                {Array.from({ length: 4 }, (_, idx) => (
                  <div key={`stat-${idx + 1}`} className="glass p-6">
                    <div className="skeleton h-4 w-24" />
                    <div className="mt-3 skeleton h-10 w-28" />
                    <div className="mt-3 skeleton h-3 w-32" />
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                <div className="glass p-6 xl:col-span-2">
                  <div className="skeleton h-5 w-48" />
                  <div className="mt-4 skeleton h-[260px] w-full" />
                </div>
                <div className="glass p-6">
                  <div className="skeleton h-5 w-40" />
                  <div className="mt-4 skeleton h-[260px] w-full" />
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
                <StatCard
                  label={t("dashboard.totalCerts")}
                  value={stats?.total || 0}
                  icon={<Activity size={16} className="text-[var(--teal)]" />}
                  glow="bg-[var(--teal-glow)]"
                  trend={t("dashboard.thisMonthTrend", { count: stats?.thisMonth || 0 })}
                />
                <StatCard
                  label={t("common.valid")}
                  value={stats?.valid || 0}
                  icon={<ShieldCheck size={16} className="text-[var(--green)]" />}
                  glow="bg-[var(--green-glow)]"
                  trend={t("dashboard.validTrend")}
                />
                <StatCard
                  label={t("common.revoked")}
                  value={stats?.revoked || 0}
                  icon={<ShieldX size={16} className="text-[var(--red)]" />}
                  glow="bg-[var(--red-glow)]"
                  trend={t("dashboard.revokedTrend")}
                />
                <StatCard
                  label={t("dashboard.thisMonth")}
                  value={stats?.thisMonth || 0}
                  icon={<Flame size={16} className="text-[var(--amber)]" />}
                  glow="bg-[rgba(255,184,0,0.14)]"
                  trend={t("dashboard.thisMonthTrend2")}
                />
              </div>

              <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
                <article className="glass p-6 xl:col-span-2">
                  <h2 className="section-title">{t("dashboard.chartIssued")}</h2>
                  <div className="mt-4 h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData}>
                        <defs>
                          <linearGradient id="issuedFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#00E5FF" stopOpacity={0.35} />
                            <stop offset="95%" stopColor="#00E5FF" stopOpacity={0.03} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid stroke="rgba(139,163,204,0.12)" vertical={false} />
                        <XAxis dataKey="month" stroke="#8BA3CC" tickLine={false} axisLine={false} />
                        <YAxis stroke="#8BA3CC" tickLine={false} axisLine={false} allowDecimals={false} />
                        <Tooltip
                          contentStyle={{
                            background: "#0D1628",
                            border: "1px solid rgba(139,163,204,0.18)",
                            borderRadius: 12,
                            color: "#EFF6FF",
                          }}
                        />
                        <Area type="monotone" dataKey="count" stroke="#00E5FF" strokeWidth={2} fill="url(#issuedFill)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </article>

                <article className="glass p-6">
                  <h2 className="section-title">{t("dashboard.statusDistribution")}</h2>
                  <div className="mt-4 h-[220px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={56}
                          outerRadius={90}
                          paddingAngle={4}
                        />
                        <Tooltip
                          contentStyle={{
                            background: "#0D1628",
                            border: "1px solid rgba(139,163,204,0.18)",
                            borderRadius: 12,
                            color: "#EFF6FF",
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-3 space-y-2 text-[15px]">
                    <div className="flex items-center justify-between">
                      <span className="text-[var(--text-secondary)]">{t("common.valid")}</span>
                      <span className="font-semibold text-[var(--green)]">{stats?.valid || 0}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[var(--text-secondary)]">{t("common.revoked")}</span>
                      <span className="font-semibold text-[var(--red)]">{stats?.revoked || 0}</span>
                    </div>
                  </div>
                </article>
              </div>
            </>
          )}

          <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-4">
            <article className="glass overflow-hidden xl:col-span-3">
              <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
                <h2 className="section-title">{t("dashboard.recent")}</h2>
                <Link href="/admin/certificates" className="text-[15px] text-[var(--teal)] hover:underline">
                  {t("dashboard.viewAll")}
                </Link>
              </div>

              <div className="overflow-x-auto">
                <table className="readable-table w-full min-w-[760px]">
                  <thead className="bg-[var(--bg-surface)]">
                    <tr>
                      <th className="px-6 py-3 text-left uppercase text-[var(--text-muted)]">ID</th>
                      <th className="px-6 py-3 text-left uppercase text-[var(--text-muted)]">{t("common.recipient")}</th>
                      <th className="px-6 py-3 text-left uppercase text-[var(--text-muted)]">{t("common.course")}</th>
                      <th className="px-6 py-3 text-left uppercase text-[var(--text-muted)]">{t("common.issuedDate")}</th>
                      <th className="px-6 py-3 text-left uppercase text-[var(--text-muted)]">{t("common.status")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.length ? (
                      recent.map((item) => (
                        <tr key={item._id} className="border-t border-[var(--border)] hover:bg-[var(--bg-card)]">
                          <td className="px-6 py-4 mono text-[13px] text-[var(--teal)]">{item.certId}</td>
                          <td className="px-6 py-4 text-sm text-[var(--text-primary)]">{item.recipientName}</td>
                          <td className="px-6 py-4 text-sm text-[var(--text-secondary)]">{item.courseName}</td>
                          <td className="px-6 py-4 text-sm text-[var(--text-secondary)]">{formatDate(item.issuedAt, locale)}</td>
                          <td className="px-6 py-4">
                            <span
                              className={`status-badge inline-flex rounded-full px-3 py-0.5 font-medium ${
                                item.isRevoked
                                  ? "border border-[rgba(255,77,109,0.35)] bg-[var(--red-glow)] text-[var(--red)]"
                                  : "border border-[rgba(0,214,143,0.35)] bg-[var(--green-glow)] text-[var(--green)]"
                              }`}
                            >
                              {item.isRevoked ? t("common.revoked") : t("common.valid")}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td className="px-6 py-10 text-center text-[15px] text-[var(--text-secondary)]" colSpan={5}>
                          {t("dashboard.noRecent")}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </article>

            <article className="glass p-5">
              <h2 className="section-title">{t("dashboard.blockchainStatus")}</h2>
              <div className="mt-4 space-y-4 text-[15px]">
                <div>
                  <p className="text-[var(--text-muted)]">{t("dashboard.connectedNetwork")}</p>
                  <p className="mt-1 text-[var(--text-primary)]">{chainName}</p>
                </div>

                <div>
                  <p className="text-[var(--text-muted)]">{t("dashboard.contractAddress")}</p>
                  <a
                    href={SUPPORTED_CHAINS[CHAIN_ID]?.explorer ? `${SUPPORTED_CHAINS[CHAIN_ID].explorer}/address/${CONTRACT_ADDRESS}` : "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mono mt-1 block text-[13px] text-[var(--teal)] hover:underline"
                  >
                    {truncateHash(CONTRACT_ADDRESS || "0x", 8)}
                  </a>
                </div>

                <div>
                  <p className="text-[var(--text-muted)]">{t("dashboard.adminWallet")}</p>
                  <p className="mono mt-1 text-[13px] text-[var(--text-secondary)]">
                    {account ? formatAddress(account) : t("common.notConnected")}
                  </p>
                </div>

                <div>
                  <p className="text-[var(--text-muted)]">{t("dashboard.gasPrice")}</p>
                  <p className="mt-1 text-[var(--text-primary)]">{gasPrice}</p>
                </div>

                <div>
                  <p className="text-[var(--text-muted)]">{t("dashboard.health")}</p>
                  <Link href="/admin/audit" className="mt-1 inline-flex items-center gap-1 text-[var(--teal)] hover:underline">
                    {t("dashboard.viewAudit")}
                    <Wallet size={13} />
                  </Link>
                </div>
              </div>
            </article>
          </div>
        </section>
      </main>
    </div>
  );
}
