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
    enabled: enabled && id !== undefined && id !== null && id !== "",
  });
}

export function useUpdateStandardGroup(id?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: StandardGroupUpdate & { id?: string }) => {
      const resolvedId = id ?? (patch as unknown as { id?: string })?.id;
      if (resolvedId === undefined || resolvedId === null || resolvedId === "") {
        throw new Error("Missing id for update");
      }
      const { id: _omit, ...body } = (patch as Record<string, unknown>) ?? {};
      return api<StandardGroup>(`/api/v1/standard_groups/${resolvedId}`, { method: "PATCH", body: JSON.stringify(body) });
    },
    onSuccess: (_data, variables) => {
      const resolvedId = id ?? (variables as { id?: string } | undefined)?.id;
      if (resolvedId && resolvedId !== "") {
        qc.invalidateQueries({ queryKey: standardGroupKeys.detail(resolvedId) });
      } else {
        qc.invalidateQueries({ queryKey: standardGroupKeys.all });
      }
    },
  });
}

export function useDeleteStandardGroup(id?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (arg?: { id?: string } | string) => {
      const resolvedId = id ?? (typeof arg === "object" ? arg?.id : arg);
      if (resolvedId === undefined || resolvedId === null || resolvedId === "") {
        throw new Error("Missing id for delete");
      }
      return api<void>(`/api/v1/standard_groups/${resolvedId}`, { method: "DELETE" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: standardGroupKeys.all }),
  });
}

export function useStandardGroupsByRubricId(id: string) {
  return useQuery<StandardGroup[]>({
    queryKey: standardGroupKeysByRubricId.one(id),
    queryFn: () => api<StandardGroup[]>(`/api/v1/standard_groups/by/rubricId/${id}`),
    enabled: id !== undefined && id !== null && id !== "",
  });
}

export function useStandardGroupsByRubricIdBatch(ids: string[]) {
  return useQuery<StandardGroup[]>({
    queryKey: standardGroupKeysByRubricId.many(ids),
    queryFn: () => api<StandardGroup[]>(`/api/v1/standard_groups/by/rubricId/batch`, { method: "POST", body: JSON.stringify({ ids }) }),
    enabled: Array.isArray(ids) && ids.length > 0,
  });
}
