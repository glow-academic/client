// AUTO-GENERATED minimal hooks for parameter_items
// Safe to edit: generator will SKIP unless --force-hooks
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/fetcher";
import type { ParameterItem, ParameterItemCreate, ParameterItemUpdate } from "@/lib/repos/parameterItemRepo";
import { parameterItemKeys, parameterItemKeysByParameterId } from "@/lib/api/keys";

export function useParameterItems(filters?: unknown) {
  return useQuery({
    queryKey: parameterItemKeys.list(filters),
    queryFn: () => api<ParameterItem[]>("/api/v1/parameter_items"),
  });
}

export function useCreateParameterItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: ParameterItemCreate) => api<ParameterItem>("/api/v1/parameter_items", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: parameterItemKeys.all }),
  });
}

export function useParameterItem(id: string, enabled = true) {
  return useQuery({
    queryKey: parameterItemKeys.detail(id),
    queryFn: () => api<ParameterItem>(`/api/v1/parameter_items/${id}`),
    enabled,
  });
}

export function useUpdateParameterItem(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: ParameterItemUpdate) => api<ParameterItem>(`/api/v1/parameter_items/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: parameterItemKeys.detail(id) }),
  });
}

export function useDeleteParameterItem(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>(`/api/v1/parameter_items/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: parameterItemKeys.all }),
  });
}

export function useParameterItemsByParameterId(id: string) {
  return useQuery({
    queryKey: parameterItemKeysByParameterId.one(id),
    queryFn: () => api(`/api/v1/parameter_items/by/parameterId/${id}`),
    enabled: id !== undefined && id !== null,
  });
}

export function useParameterItemsByParameterIdBatch(ids: string[]) {
  return useQuery({
    queryKey: parameterItemKeysByParameterId.many(ids),
    queryFn: () => api(`/api/v1/parameter_items/by/parameterId/batch`, { method: "POST", body: JSON.stringify({ ids }) }),
    enabled: Array.isArray(ids) && ids.length > 0,
  });
}
