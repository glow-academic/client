// AUTO-GENERATED minimal hooks for standard_groups
// Safe to edit: generator will SKIP unless --force-hooks
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/fetcher";
import type { StandardGroup, StandardGroupCreate, StandardGroupUpdate } from "@/lib/repos/standardGroupRepo";
import { standardGroupKeys, standardGroupKeysByRubricId } from "@/lib/api/keys";

export function useStandardGroups(filters?: unknown) {
  return useQuery({
    queryKey: standardGroupKeys.list(filters),
    queryFn: () => api<StandardGroup[]>("/api/v1/standard_groups"),
  });
}

export function useCreateStandardGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: StandardGroupCreate) => api<StandardGroup>("/api/v1/standard_groups", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: standardGroupKeys.all }),
  });
}

export function useStandardGroup(id: string, enabled = true) {
  return useQuery({
    queryKey: standardGroupKeys.detail(id),
    queryFn: () => api<StandardGroup>(`/api/v1/standard_groups/${id}`),
    enabled,
  });
}

export function useUpdateStandardGroup(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: StandardGroupUpdate) => api<StandardGroup>(`/api/v1/standard_groups/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: standardGroupKeys.detail(id) }),
  });
}

export function useDeleteStandardGroup(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>(`/api/v1/standard_groups/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: standardGroupKeys.all }),
  });
}

export function useStandardGroupsByRubricId(id: string) {
  return useQuery({
    queryKey: standardGroupKeysByRubricId.one(id),
    queryFn: () => api(`/api/v1/standard_groups/by/rubricId/${id}`),
    enabled: id !== undefined && id !== null,
  });
}

export function useStandardGroupsByRubricIdBatch(ids: string[]) {
  return useQuery({
    queryKey: standardGroupKeysByRubricId.many(ids),
    queryFn: () => api(`/api/v1/standard_groups/by/rubricId/batch`, { method: "POST", body: JSON.stringify({ ids }) }),
    enabled: Array.isArray(ids) && ids.length > 0,
  });
}
