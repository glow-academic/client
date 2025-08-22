// AUTO-GENERATED minimal hooks for model_runs
// Safe to edit: generator will SKIP unless --force-hooks
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/fetcher";
import type { ModelRun, ModelRunCreate, ModelRunUpdate } from "@/lib/repos/modelRunRepo";
import { modelRunKeys, modelRunKeysByModelId, modelRunKeysByPersonaId, modelRunKeysByAgentId, modelRunKeysByProfileId } from "@/lib/api/keys";

export function useModelRuns(filters?: unknown) {
  return useQuery({
    queryKey: modelRunKeys.list(filters),
    queryFn: () => api<ModelRun[]>("/api/v1/model_runs"),
  });
}

export function useCreateModelRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: ModelRunCreate) => api<ModelRun>("/api/v1/model_runs", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: modelRunKeys.all }),
  });
}

export function useModelRun(id: string, enabled = true) {
  return useQuery({
    queryKey: modelRunKeys.detail(id),
    queryFn: () => api<ModelRun>(`/api/v1/model_runs/${id}`),
    enabled,
  });
}

export function useUpdateModelRun(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: ModelRunUpdate) => api<ModelRun>(`/api/v1/model_runs/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: modelRunKeys.detail(id) }),
  });
}

export function useDeleteModelRun(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>(`/api/v1/model_runs/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: modelRunKeys.all }),
  });
}

export function useModelRunsByModelId(id: string) {
  return useQuery<ModelRun[]>({
    queryKey: modelRunKeysByModelId.one(id),
    queryFn: () => api<ModelRun[]>(`/api/v1/model_runs/by/modelId/${id}`),
    enabled: id !== undefined && id !== null,
  });
}

export function useModelRunsByModelIdBatch(ids: string[]) {
  return useQuery<ModelRun[]>({
    queryKey: modelRunKeysByModelId.many(ids),
    queryFn: () => api<ModelRun[]>(`/api/v1/model_runs/by/modelId/batch`, { method: "POST", body: JSON.stringify({ ids }) }),
    enabled: Array.isArray(ids) && ids.length > 0,
  });
}

export function useModelRunsByPersonaId(id: string) {
  return useQuery<ModelRun[]>({
    queryKey: modelRunKeysByPersonaId.one(id),
    queryFn: () => api<ModelRun[]>(`/api/v1/model_runs/by/personaId/${id}`),
    enabled: id !== undefined && id !== null,
  });
}

export function useModelRunsByPersonaIdBatch(ids: string[]) {
  return useQuery<ModelRun[]>({
    queryKey: modelRunKeysByPersonaId.many(ids),
    queryFn: () => api<ModelRun[]>(`/api/v1/model_runs/by/personaId/batch`, { method: "POST", body: JSON.stringify({ ids }) }),
    enabled: Array.isArray(ids) && ids.length > 0,
  });
}

export function useModelRunsByAgentId(id: string) {
  return useQuery<ModelRun[]>({
    queryKey: modelRunKeysByAgentId.one(id),
    queryFn: () => api<ModelRun[]>(`/api/v1/model_runs/by/agentId/${id}`),
    enabled: id !== undefined && id !== null,
  });
}

export function useModelRunsByAgentIdBatch(ids: string[]) {
  return useQuery<ModelRun[]>({
    queryKey: modelRunKeysByAgentId.many(ids),
    queryFn: () => api<ModelRun[]>(`/api/v1/model_runs/by/agentId/batch`, { method: "POST", body: JSON.stringify({ ids }) }),
    enabled: Array.isArray(ids) && ids.length > 0,
  });
}

export function useModelRunsByProfileId(id: string) {
  return useQuery<ModelRun[]>({
    queryKey: modelRunKeysByProfileId.one(id),
    queryFn: () => api<ModelRun[]>(`/api/v1/model_runs/by/profileId/${id}`),
    enabled: id !== undefined && id !== null,
  });
}

export function useModelRunsByProfileIdBatch(ids: string[]) {
  return useQuery<ModelRun[]>({
    queryKey: modelRunKeysByProfileId.many(ids),
    queryFn: () => api<ModelRun[]>(`/api/v1/model_runs/by/profileId/batch`, { method: "POST", body: JSON.stringify({ ids }) }),
    enabled: Array.isArray(ids) && ids.length > 0,
  });
}
