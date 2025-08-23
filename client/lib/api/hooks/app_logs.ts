// AUTO-GENERATED minimal hooks for app_logs
// Safe to edit: generator will SKIP unless --force-hooks
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/fetcher";
import type { AppLog, AppLogCreate, AppLogUpdate } from "@/lib/repos/appLogRepo";
import { appLogKeys  } from "@/lib/api/keys";

export function useAppLogs(filters?: unknown) {
  return useQuery({
    queryKey: appLogKeys.list(filters),
    queryFn: () => api<AppLog[]>("/api/v1/app_logs"),
  });
}

export function useCreateAppLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: AppLogCreate) => api<AppLog>("/api/v1/app_logs", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: appLogKeys.all }),
  });
}

export function useAppLog(id: number, enabled = true) {
  return useQuery({
    queryKey: appLogKeys.detail(id),
    queryFn: () => api<AppLog>(`/api/v1/app_logs/${id}`),
    enabled: enabled && id !== undefined && id !== null,
  });
}

export function useUpdateAppLog(id?: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: AppLogUpdate & { id?: number }) => {
      const resolvedId = id ?? (patch as unknown as { id?: number })?.id;
      if (resolvedId === undefined || resolvedId === null) {
        throw new Error("Missing id for update");
      }
      const { id: _omit, ...body } = (patch as Record<string, unknown>) ?? {};
      return api<AppLog>(`/api/v1/app_logs/${resolvedId}`, { method: "PATCH", body: JSON.stringify(body) });
    },
    onSuccess: (_data, variables) => {
      const resolvedId = id ?? (variables as { id?: number } | undefined)?.id;
      if (resolvedId) {
        qc.invalidateQueries({ queryKey: appLogKeys.detail(resolvedId) });
      } else {
        qc.invalidateQueries({ queryKey: appLogKeys.all });
      }
    },
  });
}

export function useDeleteAppLog(id?: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (arg?: { id?: number } | number) => {
      const resolvedId = id ?? (typeof arg === "object" ? arg?.id : arg);
      if (resolvedId === undefined || resolvedId === null) {
        throw new Error("Missing id for delete");
      }
      return api<void>(`/api/v1/app_logs/${resolvedId}`, { method: "DELETE" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: appLogKeys.all }),
  });
}

