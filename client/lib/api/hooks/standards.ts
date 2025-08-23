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
    enabled: enabled && id !== undefined && id !== null && id !== "",
  });
}

export function useUpdateStandard(id?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: StandardUpdate & { id?: string }) => {
      const resolvedId = id ?? (patch as unknown as { id?: string })?.id;
      if (resolvedId === undefined || resolvedId === null || resolvedId === "") {
        throw new Error("Missing id for update");
      }
      const { id: _omit, ...body } = (patch as Record<string, unknown>) ?? {};
      return api<Standard>(`/api/v1/standards/${resolvedId}`, { method: "PATCH", body: JSON.stringify(body) });
    },
    onSuccess: (_data, variables) => {
      const resolvedId = id ?? (variables as { id?: string } | undefined)?.id;
      if (resolvedId && resolvedId !== "") {
        qc.invalidateQueries({ queryKey: standardKeys.detail(resolvedId) });
      } else {
        qc.invalidateQueries({ queryKey: standardKeys.all });
      }
    },
  });
}

export function useDeleteStandard(id?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (arg?: { id?: string } | string) => {
      const resolvedId = id ?? (typeof arg === "object" ? arg?.id : arg);
      if (resolvedId === undefined || resolvedId === null || resolvedId === "") {
        throw new Error("Missing id for delete");
      }
      return api<void>(`/api/v1/standards/${resolvedId}`, { method: "DELETE" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: standardKeys.all }),
  });
}

export function useStandardsByStandardGroupId(id: string) {
  return useQuery<Standard[]>({
    queryKey: standardKeysByStandardGroupId.one(id),
    queryFn: () => api<Standard[]>(`/api/v1/standards/by/standardGroupId/${id}`),
    enabled: id !== undefined && id !== null && id !== "",
  });
}

export function useStandardsByStandardGroupIdBatch(ids: string[]) {
  return useQuery<Standard[]>({
    queryKey: standardKeysByStandardGroupId.many(ids),
    queryFn: () => api<Standard[]>(`/api/v1/standards/by/standardGroupId/batch`, { method: "POST", body: JSON.stringify({ ids }) }),
    enabled: Array.isArray(ids) && ids.length > 0,
  });
}
