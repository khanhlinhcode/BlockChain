"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  User,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { getAuthToken } from "@/lib/auth";
import { getFriendlyError } from "@/lib/errorMessages";
import { useMetaMask } from "@/hooks/useMetaMask";
import { useLanguage } from "@/context/LanguageContext";

type LoginMode = "password" | "metamask";

function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function normalizeAuthError(error: unknown, invalidText: string, fallbackText: string) {
  const status = (error as { response?: { status?: number } })?.response?.status;
  if (status === 401) return invalidText;
  const message = getFriendlyError(error, fallbackText);
  if (message.toLowerCase().includes("invalid credential")) return invalidText;
  return message;
}

export default function AdminLoginPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [mode, setMode] = useState<LoginMode>("password");
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const {
    account,
    connectWallet,
    signMessage,
    switchNetwork,
    isCorrectNetwork,
    isConnecting,
    error: walletError,
  } = useMetaMask();

  useEffect(() => {
    document.title = `${t("login.portal")} | CertChain`;
    const token = getAuthToken();
    if (token) router.replace("/admin/dashboard");
  }, [router, t]);

  const onPasswordLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      setLoading(true);
      setError(null);
      setStatus(null);
      await api.login(username.trim(), password);
      toast.success(t("login.success"));
      router.push("/admin/dashboard");
    } catch (err: unknown) {
      const message = normalizeAuthError(err, t("login.invalid"), t("login.failed"));
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const onMetaMaskLogin = async () => {
    try {
      setLoading(true);
      setError(null);
      setStatus(t("login.waitingMetamask"));

      const address = account || (await connectWallet());

      if (!isCorrectNetwork) {
        await switchNetwork();
      }

      const message = `Sign in to CertChain Admin\nNonce: ${Date.now()}`;
      const signature = await signMessage(message);

      setStatus(t("login.txPending"));
      await api.loginMetaMask(address, signature, message);
      setStatus(t("login.txConfirmed"));
      toast.success(t("login.metamaskSuccess"));
      router.push("/admin/dashboard");
    } catch (err: unknown) {
      const message = normalizeAuthError(err, t("login.invalid"), t("login.failed"));
      setError(message);
      setStatus(null);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="page-bg flex min-h-screen items-center justify-center px-4 py-10">
      <motion.section
        className="glass w-full max-w-[440px] p-8 sm:p-12"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Link
          href="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            color: "var(--text-muted)",
            fontSize: "14px",
            fontFamily: "var(--font-body)",
            marginBottom: "32px",
            transition: "color 0.2s",
            textDecoration: "none",
          }}
          onMouseEnter={(event) => {
            event.currentTarget.style.color = "var(--text-secondary)";
          }}
          onMouseLeave={(event) => {
            event.currentTarget.style.color = "var(--text-muted)";
          }}
        >
          ← {t("login.back")}
        </Link>

        <header className="text-center">
          <div className="mx-auto inline-flex items-center gap-2">
            <span className="text-[var(--teal)]">⬡</span>
            <h1 className="text-[22px] font-extrabold">{t("login.title")}</h1>
          </div>
          <p className="mt-2 text-sm text-[var(--text-muted)]">{t("login.portal")}</p>
        </header>

        <div className="mt-8 grid grid-cols-2 gap-2 rounded-full border border-[var(--border)] bg-[var(--bg-surface)] p-1">
          <button
            type="button"
            onClick={() => {
              setMode("password");
              setError(null);
            }}
            className={`rounded-full px-4 py-2 text-sm font-medium ${
              mode === "password"
                ? "bg-[var(--teal)] text-black"
                : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            }`}
          >
            {t("login.passwordTab")}
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("metamask");
              setError(null);
            }}
            className={`rounded-full px-4 py-2 text-sm font-medium ${
              mode === "metamask"
                ? "bg-[var(--teal)] text-black"
                : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            }`}
          >
            {t("login.metamaskTab")}
          </button>
        </div>

        {error || walletError ? (
          <div className="mt-5 flex items-start gap-2 rounded-xl border border-[rgba(255,77,109,0.3)] bg-[var(--red-glow)] p-4 text-sm text-[var(--red)]">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <span>{error || walletError}</span>
          </div>
        ) : null}

        {status ? (
          <div className="mt-5 rounded-xl border border-[var(--teal-border)] bg-[var(--teal-glow)] p-3 text-sm text-[var(--teal)]">
            {status}
          </div>
        ) : null}

        <AnimatePresence mode="wait">
          {mode === "password" ? (
            <motion.form
              key="password"
              onSubmit={(event) => void onPasswordLogin(event)}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="mt-8 space-y-5"
            >
              <label className="block">
                <span className="mb-2 block text-[13px] font-medium text-[var(--text-secondary)]">
                  {t("login.username")}
                </span>
                <div className="relative">
                  <User size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                  <input
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    className="h-12 w-full rounded-xl bg-[var(--bg-input)] pl-10 pr-4 text-[15px]"
                    placeholder="Nhập tên đăng nhập"
                    autoComplete="username"
                    disabled={loading}
                    required
                  />
                </div>
              </label>

              <label className="block">
                <span className="mb-2 block text-[13px] font-medium text-[var(--text-secondary)]">
                  {t("login.password")}
                </span>
                <div className="relative">
                  <Lock size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="h-12 w-full rounded-xl bg-[var(--bg-input)] pl-10 pr-11 text-[15px]"
                    placeholder="••••••••"
                    autoComplete="current-password"
                    disabled={loading}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </label>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary inline-flex h-12 w-full items-center justify-center gap-2 text-sm"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />}
                {loading ? t("login.signingIn") : t("login.signIn")}
              </button>
            </motion.form>
          ) : (
            <motion.div
              key="metamask"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="mt-8 space-y-4"
            >
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-5 text-center">
                <div className="text-4xl">🦊</div>
                <p className="mt-3 text-sm text-[var(--text-secondary)]">
                  {t("login.connectAdminWallet")}
                </p>
              </div>

              {account ? (
                <div className="mono rounded-full border border-[var(--teal-border)] bg-[var(--teal-glow)] px-4 py-2 text-center text-sm text-[var(--teal)]">
                  {shortAddress(account)}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => void connectWallet()}
                  disabled={isConnecting || loading}
                  className="btn-outline inline-flex h-12 w-full items-center justify-center gap-2 text-sm"
                >
                  {isConnecting ? <Loader2 size={16} className="animate-spin" /> : <Wallet size={16} />}
                  {isConnecting ? t("login.connecting") : t("login.connectWallet")}
                </button>
              )}

              <button
                type="button"
                onClick={() => void onMetaMaskLogin()}
                disabled={!account || loading}
                className="btn-primary inline-flex h-12 w-full items-center justify-center gap-2 text-sm"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Wallet size={16} />}
                {loading ? t("login.signingChallenge") : t("login.signInMetamask")}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.section>
    </main>
  );
}
