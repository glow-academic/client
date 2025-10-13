// AUTO-GENERATED minimal hooks for model_run_models
// Safe to edit: generator will SKIP unless --force-hooks
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/fetcher";
import type {
  ModelRunModel,
  ModelRunModelCreate,
} from "@/lib/repos/modelRunModelRepo";
import {
  modelRunModelKeys,
  modelRunModelKeysByModelRunId,
  modelRunModelKeysByModelId,
} from "@/lib/api/keys";

export function useModelRunModels(filters?: unknown) {
  return useQuery({
    queryKey: modelRunModelKeys.list(filters),
    queryFn: () => api<ModelRunModel[]>("/api/v1/model_run_models"),
  });
}

export function useCreateModelRunModel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: ModelRunModelCreate) =>
      api<ModelRunModel>("/api/v1/model_run_models", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: modelRunModelKeys.all }),
  });
}

export function useModelRunModelsByModelRunId(id: string) {
  return useQuery<ModelRunModel[]>({
    queryKey: modelRunModelKeysByModelRunId.one(id),
    queryFn: () =>
      api<ModelRunModel[]>(`/api/v1/model_run_models/by/modelRunId/${id}`),
    enabled: id !== undefined && id !== null && id !== "",
  });
}

export function useModelRunModelsByModelRunIdBatch(ids: string[]) {
  return useQuery<ModelRunModel[]>({
    queryKey: modelRunModelKeysByModelRunId.many(ids),
    queryFn: () =>
      api<ModelRunModel[]>(`/api/v1/model_run_models/by/modelRunId/batch`, {
        method: "POST",
        body: JSON.stringify({ ids }),
      }),
    enabled: Array.isArray(ids) && ids.length > 0,
  });
}

export function useModelRunModelsByModelId(id: string) {
  return useQuery<ModelRunModel[]>({
    queryKey: modelRunModelKeysByModelId.one(id),
    queryFn: () =>
      api<ModelRunModel[]>(`/api/v1/model_run_models/by/modelId/${id}`),
    enabled: id !== undefined && id !== null && id !== "",
  });
}

export function useModelRunModelsByModelIdBatch(ids: string[]) {
  return useQuery<ModelRunModel[]>({
    queryKey: modelRunModelKeysByModelId.many(ids),
    queryFn: () =>
      api<ModelRunModel[]>(`/api/v1/model_run_models/by/modelId/batch`, {
        method: "POST",
        body: JSON.stringify({ ids }),
      }),
    enabled: Array.isArray(ids) && ids.length > 0,
  });
}
