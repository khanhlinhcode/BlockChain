"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { Loader2, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import AdminSidebar from "@/components/admin/AdminSidebar";
import { api } from "@/lib/api";
import { formatAddress, formatDate } from "@/lib/utils";
import { getFriendlyError } from "@/lib/errorMessages";
import { useLanguage } from "@/context/LanguageContext";
import { localeForLanguage } from "@/lib/i18n";
import type { AllowedWallet } from "@/types";

export default function AdminWalletsPage() {
  const { language } = useLanguage();
  const locale = localeForLanguage(language);
  const [wallets, setWallets] = useState<AllowedWallet[]>([]);
  const [address, setAddress] = useState("");
  const [label, setLabel] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadWallets = async () => {
    try {
      setLoading(true);
      setWallets(await api.getAllowedWallets());
    } catch (error) {
      toast.error(getFriendlyError(error, "Unable to load wallet whitelist."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    document.title = "Wallet Whitelist | CertChain";
    void loadWallets();
  }, []);

  const addWallet = async () => {
    if (!address.trim()) {
      toast.error("Wallet address is required.");
      return;
    }

    try {
      setSaving(true);
      await api.addAllowedWallet({ address: address.trim(), label: label.trim() });
      setAddress("");
      setLabel("");
      toast.success("Wallet added to whitelist.");
      await loadWallets();
    } catch (error) {
      toast.error(getFriendlyError(error, "Unable to add wallet."));
    } finally {
      setSaving(false);
    }
  };

  const toggleWallet = async (wallet: AllowedWallet) => {
    try {
      await api.updateAllowedWallet(wallet._id, { isActive: !wallet.isActive });
      setWallets((rows) =>
        rows.map((row) => (row._id === wallet._id ? { ...row, isActive: !wallet.isActive } : row))
      );
      toast.success(wallet.isActive ? "Wallet disabled." : "Wallet enabled.");
    } catch (error) {
      toast.error(getFriendlyError(error, "Unable to update wallet."));
    }
  };

  const deleteWallet = async (wallet: AllowedWallet) => {
    if (!window.confirm(`Remove ${wallet.address} from whitelist?`)) return;
    try {
      await api.deleteAllowedWallet(wallet._id);
      setWallets((rows) => rows.filter((row) => row._id !== wallet._id));
      toast.success("Wallet removed.");
    } catch (error) {
      toast.error(getFriendlyError(error, "Unable to delete wallet."));
    }
  };

  return (
    <div className="page-bg min-h-screen pb-20 md:pb-8">
      <AdminSidebar />
      <main className="space-y-6 px-4 py-8 md:ml-60 md:px-8">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--teal)]">
            Security
          </p>
          <h1 className="page-title mt-2">Wallet Whitelist</h1>
          <p className="page-subtitle mt-2">
            Only active wallets in this list can log in with MetaMask.
          </p>
        </div>

        <section className="glass-card p-5">
          <div className="grid gap-3 lg:grid-cols-[1fr_240px_auto]">
            <input
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              placeholder="0x..."
              className="input-dark px-4 py-3 font-mono text-[15px]"
            />
            <input
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="Label"
              className="input-dark px-4 py-3 text-[15px]"
            />
            <button
              type="button"
              onClick={() => void addWallet()}
              disabled={saving}
              className="btn-primary inline-flex items-center justify-center gap-2 px-5 py-3 text-sm"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              Add wallet
            </button>
          </div>
        </section>

        <section className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="readable-table w-full min-w-[820px]">
              <thead className="bg-[rgba(255,255,255,0.03)]">
                <tr>
                  <th className="px-4 py-3 text-left uppercase text-[var(--text-muted)]">Wallet</th>
                  <th className="px-4 py-3 text-left uppercase text-[var(--text-muted)]">Label</th>
                  <th className="px-4 py-3 text-left uppercase text-[var(--text-muted)]">Last login</th>
                  <th className="px-4 py-3 text-left uppercase text-[var(--text-muted)]">Status</th>
                  <th className="px-4 py-3 text-right uppercase text-[var(--text-muted)]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-[var(--text-secondary)]">
                      <Loader2 className="mx-auto animate-spin" />
                    </td>
                  </tr>
                ) : wallets.length ? (
                  wallets.map((wallet) => (
                    <tr key={wallet._id} className="border-t border-[var(--border)]">
                      <td className="px-4 py-3 font-mono text-[14px] text-[var(--text-primary)]">
                        {formatAddress(wallet.address)}
                      </td>
                      <td className="px-4 py-3 text-[15px] text-[var(--text-secondary)]">
                        {wallet.label || "Admin wallet"}
                      </td>
                      <td className="px-4 py-3 text-[14px] text-[var(--text-secondary)]">
                        {wallet.lastLoginAt ? formatDate(wallet.lastLoginAt, locale) : "Never"}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => void toggleWallet(wallet)}
                          className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold ${
                            wallet.isActive ? "badge-valid" : "badge-revoked"
                          }`}
                        >
                          <ShieldCheck size={13} />
                          {wallet.isActive ? "Active" : "Disabled"}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => void deleteWallet(wallet)}
                          className="inline-flex items-center gap-2 rounded-full border border-[rgba(255,77,109,0.35)] px-3 py-1.5 text-xs font-bold text-[var(--red)] transition hover:bg-[var(--red-glow)]"
                        >
                          <Trash2 size={13} />
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-[var(--text-secondary)]">
                      No wallets have been whitelisted yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
