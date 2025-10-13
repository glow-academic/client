// AUTO-GENERATED minimal hooks for model_run_personas
// Safe to edit: generator will SKIP unless --force-hooks
import { api } from "@/lib/api/fetcher";
import {
  modelRunPersonaKeys,
  modelRunPersonaKeysByModelRunId,
  modelRunPersonaKeysByPersonaId,
} from "@/lib/api/v1/keys";
import type {
  ModelRunPersona,
  ModelRunPersonaCreate,
} from "@/lib/repos/modelRunPersonaRepo";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export function useModelRunPersonas(filters?: unknown) {
  return useQuery({
    queryKey: modelRunPersonaKeys.list(filters),
    queryFn: () => api<ModelRunPersona[]>("/api/v1/model_run_personas"),
  });
}

export function useCreateModelRunPersona() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: ModelRunPersonaCreate) =>
      api<ModelRunPersona>("/api/v1/model_run_personas", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: modelRunPersonaKeys.all }),
  });
}

export function useModelRunPersonasByModelRunId(id: string) {
  return useQuery<ModelRunPersona[]>({
    queryKey: modelRunPersonaKeysByModelRunId.one(id),
    queryFn: () =>
      api<ModelRunPersona[]>(`/api/v1/model_run_personas/by/modelRunId/${id}`),
    enabled: id !== undefined && id !== null && id !== "",
  });
}

export function useModelRunPersonasByModelRunIdBatch(ids: string[]) {
  return useQuery<ModelRunPersona[]>({
    queryKey: modelRunPersonaKeysByModelRunId.many(ids),
    queryFn: () =>
      api<ModelRunPersona[]>(`/api/v1/model_run_personas/by/modelRunId/batch`, {
        method: "POST",
        body: JSON.stringify({ ids }),
      }),
    enabled: Array.isArray(ids) && ids.length > 0,
  });
}

export function useModelRunPersonasByPersonaId(id: string) {
  return useQuery<ModelRunPersona[]>({
    queryKey: modelRunPersonaKeysByPersonaId.one(id),
    queryFn: () =>
      api<ModelRunPersona[]>(`/api/v1/model_run_personas/by/personaId/${id}`),
    enabled: id !== undefined && id !== null && id !== "",
  });
}

export function useModelRunPersonasByPersonaIdBatch(ids: string[]) {
  return useQuery<ModelRunPersona[]>({
    queryKey: modelRunPersonaKeysByPersonaId.many(ids),
    queryFn: () =>
      api<ModelRunPersona[]>(`/api/v1/model_run_personas/by/personaId/batch`, {
        method: "POST",
        body: JSON.stringify({ ids }),
      }),
    enabled: Array.isArray(ids) && ids.length > 0,
  });
}
