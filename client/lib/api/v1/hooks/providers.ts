// AUTO-GENERATED minimal hooks for providers
// Safe to edit: generator will SKIP unless --force-hooks
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/fetcher";
import type {
  Provider,
  ProviderCreate,
  ProviderUpdate,
} from "@/lib/repos/providerRepo";
import { providerKeys, providerKeysByDepartmentId } from "@/lib/api/keys";

export function useProviders(filters?: unknown) {
  return useQuery({
    queryKey: providerKeys.list(filters),
    queryFn: () => api<Provider[]>("/api/v1/providers"),
  });
}

export function useCreateProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: ProviderCreate) =>
      api<Provider>("/api/v1/providers", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: providerKeys.all }),
  });
}

export function useProvider(id: string, enabled = true) {
  return useQuery({
    queryKey: providerKeys.detail(id),
    queryFn: () => api<Provider>(`/api/v1/providers/${id}`),
    enabled: enabled && id !== undefined && id !== null && id !== "",
  });
}

export function useUpdateProvider(id?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: ProviderUpdate & { id?: string }) => {
      const resolvedId = id ?? (patch as unknown as { id?: string })?.id;
      if (
        resolvedId === undefined ||
        resolvedId === null ||
        resolvedId === ""
      ) {
        throw new Error("Missing id for update");
      }
      const { id: _omit, ...body } = (patch as Record<string, unknown>) ?? {};
      return api<Provider>(`/api/v1/providers/${resolvedId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
    },
    onSuccess: (_data, variables) => {
      const resolvedId = id ?? (variables as { id?: string } | undefined)?.id;
      if (resolvedId && resolvedId !== "") {
        qc.invalidateQueries({ queryKey: providerKeys.detail(resolvedId) });
      } else {
        qc.invalidateQueries({ queryKey: providerKeys.all });
      }
    },
  });
}

export function useDeleteProvider(id?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (arg?: { id?: string } | string) => {
      const resolvedId = id ?? (typeof arg === "object" ? arg?.id : arg);
      if (
        resolvedId === undefined ||
        resolvedId === null ||
        resolvedId === ""
      ) {
        throw new Error("Missing id for delete");
      }
      return api<void>(`/api/v1/providers/${resolvedId}`, { method: "DELETE" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: providerKeys.all }),
  });
}

export function useProvidersByDepartmentId(id: string) {
  return useQuery<Provider[]>({
    queryKey: providerKeysByDepartmentId.one(id),
    queryFn: () => api<Provider[]>(`/api/v1/providers/by/departmentId/${id}`),
    enabled: id !== undefined && id !== null && id !== "",
  });
}

export function useProvidersByDepartmentIdBatch(ids: string[]) {
  return useQuery<Provider[]>({
    queryKey: providerKeysByDepartmentId.many(ids),
    queryFn: () =>
      api<Provider[]>(`/api/v1/providers/by/departmentId/batch`, {
        method: "POST",
        body: JSON.stringify({ ids }),
      }),
    enabled: Array.isArray(ids) && ids.length > 0,
  });
}
