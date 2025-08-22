// AUTO-GENERATED minimal hooks for standards
// Safe to edit: generator will SKIP unless --force-hooks
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/fetcher";
import type { Standard, StandardCreate, StandardUpdate } from "@/lib/repos/standardRepo";
import { standardKeys, standardKeysByStandardGroupId } from "@/lib/api/keys";

export function useStandards(filters?: unknown) {
  return useQuery({
    queryKey: standardKeys.list(filters),
    queryFn: () => api<Standard[]>("/api/v1/standards"),
  });
}

export function useCreateStandard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: StandardCreate) => api<Standard>("/api/v1/standards", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: standardKeys.all }),
  });
}

export function useStandard(id: string, enabled = true) {
  return useQuery({
    queryKey: standardKeys.detail(id),
    queryFn: () => api<Standard>(`/api/v1/standards/${id}`),
    enabled,
  });
}

export function useUpdateStandard(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: StandardUpdate) => api<Standard>(`/api/v1/standards/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: standardKeys.detail(id) }),
  });
}

export function useDeleteStandard(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>(`/api/v1/standards/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: standardKeys.all }),
  });
}

export function useStandardsByStandardGroupId(id: string) {
  return useQuery<Standard[]>({
    queryKey: standardKeysByStandardGroupId.one(id),
    queryFn: () => api<Standard[]>(`/api/v1/standards/by/standardGroupId/${id}`),
    enabled: id !== undefined && id !== null,
  });
}

export function useStandardsByStandardGroupIdBatch(ids: string[]) {
  return useQuery<Standard[]>({
    queryKey: standardKeysByStandardGroupId.many(ids),
    queryFn: () => api<Standard[]>(`/api/v1/standards/by/standardGroupId/batch`, { method: "POST", body: JSON.stringify({ ids }) }),
    enabled: Array.isArray(ids) && ids.length > 0,
  });
}
