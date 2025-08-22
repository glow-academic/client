// AUTO-GENERATED minimal hooks for models
// Safe to edit: generator will SKIP unless --force-hooks
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/fetcher";
import type { Model, ModelCreate, ModelUpdate } from "@/lib/repos/modelRepo";
import { modelKeys  } from "@/lib/api/keys";

export function useModels(filters?: unknown) {
  return useQuery({
    queryKey: modelKeys.list(filters),
    queryFn: () => api<Model[]>("/api/v1/models"),
  });
}

export function useCreateModel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: ModelCreate) => api<Model>("/api/v1/models", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: modelKeys.all }),
  });
}

export function useModel(id: string, enabled = true) {
  return useQuery({
    queryKey: modelKeys.detail(id),
    queryFn: () => api<Model>(`/api/v1/models/${id}`),
    enabled,
  });
}

export function useUpdateModel(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: ModelUpdate) => api<Model>(`/api/v1/models/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: modelKeys.detail(id) }),
  });
}

export function useDeleteModel(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>(`/api/v1/models/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: modelKeys.all }),
  });
}

