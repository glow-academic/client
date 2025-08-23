// AUTO-GENERATED minimal hooks for debug_info
// Safe to edit: generator will SKIP unless --force-hooks
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/fetcher";
import type { DebugInfo, DebugInfoCreate, DebugInfoUpdate } from "@/lib/repos/debugInfoRepo";
import { debugInfoKeys, debugInfoKeysByModelRunId } from "@/lib/api/keys";

export function useDebugInfos(filters?: unknown) {
  return useQuery({
    queryKey: debugInfoKeys.list(filters),
    queryFn: () => api<DebugInfo[]>("/api/v1/debug_info"),
  });
}

export function useCreateDebugInfo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: DebugInfoCreate) => api<DebugInfo>("/api/v1/debug_info", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: debugInfoKeys.all }),
  });
}

export function useDebugInfo(id: string, enabled = true) {
  return useQuery({
    queryKey: debugInfoKeys.detail(id),
    queryFn: () => api<DebugInfo>(`/api/v1/debug_info/${id}`),
    enabled: enabled && id !== undefined && id !== null && id !== "",
  });
}

export function useUpdateDebugInfo(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: DebugInfoUpdate) => api<DebugInfo>(`/api/v1/debug_info/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: debugInfoKeys.detail(id) }),
  });
}

export function useDeleteDebugInfo(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>(`/api/v1/debug_info/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: debugInfoKeys.all }),
  });
}

export function useDebugInfoByModelRunId(id: string) {
  return useQuery<DebugInfo[]>({
    queryKey: debugInfoKeysByModelRunId.one(id),
    queryFn: () => api<DebugInfo[]>(`/api/v1/debug_info/by/modelRunId/${id}`),
    enabled: id !== undefined && id !== null && id !== "",
  });
}

export function useDebugInfoByModelRunIdBatch(ids: string[]) {
  return useQuery<DebugInfo[]>({
    queryKey: debugInfoKeysByModelRunId.many(ids),
    queryFn: () => api<DebugInfo[]>(`/api/v1/debug_info/by/modelRunId/batch`, { method: "POST", body: JSON.stringify({ ids }) }),
    enabled: Array.isArray(ids) && ids.length > 0,
  });
}
