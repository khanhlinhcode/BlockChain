"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { auditApi, authApi, certApi, verifyApi } from "@/lib/api";
import { getFriendlyError } from "@/lib/errorMessages";
import type {
  AdminUser,
  AuditEventFilters,
  AuditEventItem,
  Certificate,
  DashboardStats,
  PaginatedResponse,
  VerifyResult,
} from "@/types";

export type UseCertificateListParams = {
  page?: number;
  limit?: number;
  search?: string;
  status?: "all" | "valid" | "revoked";
  sort?: string;
};

function getErrorMessage(error: unknown, fallback: string): string {
  return getFriendlyError(error, fallback);
}

export function useAdminMe(enabled = true) {
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await authApi.getMe();
      setAdmin(data);
      return data;
    } catch (err) {
      const message = getErrorMessage(err, "Failed to load admin profile");
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    void refresh();
  }, [enabled, refresh]);

  return { admin, loading, error, refresh };
}

export function useCertificateList(
  params: UseCertificateListParams = {},
  enabled = true
) {
  const safeParams = useMemo(
    () => ({
      page: params.page ?? 1,
      limit: params.limit ?? 20,
      search: params.search ?? "",
      status: params.status ?? "all",
      sort: params.sort ?? "issuedAt:desc",
    }),
    [params.limit, params.page, params.search, params.sort, params.status]
  );

  const [result, setResult] = useState<PaginatedResponse<Certificate>>({
    data: [],
    total: 0,
    page: safeParams.page,
    totalPages: 1,
    limit: safeParams.limit,
  });
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await certApi.list(safeParams);
      setResult(data);
      return data;
    } catch (err) {
      const message = getErrorMessage(err, "Failed to load certificates");
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [safeParams]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    void refetch();
  }, [enabled, refetch]);

  return {
    ...result,
    loading,
    error,
    refetch,
  };
}

export function useCertificate(certId?: string, enabled = true) {
  const [certificate, setCertificate] = useState<Certificate | null>(null);
  const [loading, setLoading] = useState(Boolean(certId && enabled));
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!certId) return null;
    try {
      setLoading(true);
      setError(null);
      const data = await certApi.getById(certId);
      setCertificate(data);
      return data;
    } catch (err) {
      const message = getErrorMessage(err, "Failed to load certificate");
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [certId]);

  useEffect(() => {
    if (!enabled || !certId) {
      setLoading(false);
      return;
    }

    void refetch();
  }, [certId, enabled, refetch]);

  return { certificate, loading, error, refetch };
}

export function useDashboardStats(enabled = true) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await certApi.getStats();
      setStats(data);
      return data;
    } catch (err) {
      const message = getErrorMessage(err, "Failed to load dashboard stats");
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    void refetch();
  }, [enabled, refetch]);

  return { stats, loading, error, refetch };
}

export function useVerificationHistory(certId?: string, enabled = true) {
  const [history, setHistory] = useState<Array<{ verifiedAt: string }>>([]);
  const [loading, setLoading] = useState(Boolean(certId && enabled));
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!certId) return [];
    try {
      setLoading(true);
      setError(null);
      const data = await verifyApi.getHistory(certId);
      setHistory(data);
      return data;
    } catch (err) {
      const message = getErrorMessage(err, "Failed to load verification history");
      setError(message);
      return [];
    } finally {
      setLoading(false);
    }
  }, [certId]);

  useEffect(() => {
    if (!enabled || !certId) {
      setLoading(false);
      return;
    }

    void refetch();
  }, [certId, enabled, refetch]);

  return { history, loading, error, refetch };
}

export function useVerifyCertificate() {
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const byId = useCallback(async (certId: string) => {
    try {
      setLoading(true);
      setError(null);
      const data = await verifyApi.byId(certId);
      setResult(data);
      return data;
    } catch (err) {
      const message = getErrorMessage(err, "Verification by ID failed");
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const byHash = useCallback(async (certHash: string) => {
    try {
      setLoading(true);
      setError(null);
      const data = await verifyApi.byHash(certHash);
      setResult(data);
      return data;
    } catch (err) {
      const message = getErrorMessage(err, "Verification by hash failed");
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const byFile = useCallback(async (file: File) => {
    try {
      setLoading(true);
      setError(null);
      const data = await verifyApi.byFile(file);
      setResult(data);
      return data;
    } catch (err) {
      const message = getErrorMessage(err, "Verification by file failed");
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return { result, loading, error, byId, byHash, byFile, reset };
}

export function useAuditEvents(filters: AuditEventFilters = {}, enabled = true) {
  const key = enabled
    ? ([
        "audit-events",
        filters.eventType || "all",
        filters.from || "",
        filters.to || "",
        filters.limit || 100,
      ] as const)
    : null;

  const { data, error, isLoading, mutate } = useSWR<AuditEventItem[]>(
    key,
    () => auditApi.list(filters),
    { keepPreviousData: true }
  );

  const refetch = useCallback(async () => {
    const latest = await mutate();
    return latest || [];
  }, [mutate]);

  return {
    events: data || [],
    loading: isLoading,
    error: error ? getErrorMessage(error, "Failed to load audit events") : null,
    refetch,
  };
}
