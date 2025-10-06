// AUTO-GENERATED minimal hooks for model_runs
// Safe to edit: generator will SKIP unless --force-hooks
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/fetcher";
import type {
  ModelRun,
  ModelRunCreate,
  ModelRunUpdate,
} from "@/lib/repos/modelRunRepo";
import {
  modelRunKeys,
  modelRunKeysByModelId,
  modelRunKeysByPersonaId,
  modelRunKeysByAgentId,
  modelRunKeysByProfileId,
} from "@/lib/api/keys";

export function useModelRuns(filters?: unknown) {
  return useQuery({
    queryKey: modelRunKeys.list(filters),
    queryFn: () => api<ModelRun[]>("/api/v1/model_runs"),
  });
}

export function useCreateModelRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: ModelRunCreate) =>
      api<ModelRun>("/api/v1/model_runs", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: modelRunKeys.all }),
  });
}

export function useModelRun(id: string, enabled = true) {
  return useQuery({
    queryKey: modelRunKeys.detail(id),
    queryFn: () => api<ModelRun>(`/api/v1/model_runs/${id}`),
    enabled: enabled && id !== undefined && id !== null && id !== "",
  });
}

export function useUpdateModelRun(id?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: ModelRunUpdate & { id?: string }) => {
      const resolvedId = id ?? (patch as unknown as { id?: string })?.id;
      if (
        resolvedId === undefined ||
        resolvedId === null ||
        resolvedId === ""
      ) {
        throw new Error("Missing id for update");
      }
      const { id: _omit, ...body } = (patch as Record<string, unknown>) ?? {};
      return api<ModelRun>(`/api/v1/model_runs/${resolvedId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
    },
    onSuccess: (_data, variables) => {
      const resolvedId = id ?? (variables as { id?: string } | undefined)?.id;
      if (resolvedId && resolvedId !== "") {
        qc.invalidateQueries({ queryKey: modelRunKeys.detail(resolvedId) });
      } else {
        qc.invalidateQueries({ queryKey: modelRunKeys.all });
      }
    },
  });
}

export function useDeleteModelRun(id?: string) {
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
      return api<void>(`/api/v1/model_runs/${resolvedId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: modelRunKeys.all }),
  });
}

export function useModelRunsByModelId(id: string) {
  return useQuery<ModelRun[]>({
    queryKey: modelRunKeysByModelId.one(id),
    queryFn: () => api<ModelRun[]>(`/api/v1/model_runs/by/modelId/${id}`),
    enabled: id !== undefined && id !== null && id !== "",
  });
}

export function useModelRunsByModelIdBatch(ids: string[]) {
  return useQuery<ModelRun[]>({
    queryKey: modelRunKeysByModelId.many(ids),
    queryFn: () =>
      api<ModelRun[]>(`/api/v1/model_runs/by/modelId/batch`, {
        method: "POST",
        body: JSON.stringify({ ids }),
      }),
    enabled: Array.isArray(ids) && ids.length > 0,
  });
}

export function useModelRunsByPersonaId(id: string) {
  return useQuery<ModelRun[]>({
    queryKey: modelRunKeysByPersonaId.one(id),
    queryFn: () => api<ModelRun[]>(`/api/v1/model_runs/by/personaId/${id}`),
    enabled: id !== undefined && id !== null && id !== "",
  });
}

export function useModelRunsByPersonaIdBatch(ids: string[]) {
  return useQuery<ModelRun[]>({
    queryKey: modelRunKeysByPersonaId.many(ids),
    queryFn: () =>
      api<ModelRun[]>(`/api/v1/model_runs/by/personaId/batch`, {
        method: "POST",
        body: JSON.stringify({ ids }),
      }),
    enabled: Array.isArray(ids) && ids.length > 0,
  });
}

export function useModelRunsByAgentId(id: string) {
  return useQuery<ModelRun[]>({
    queryKey: modelRunKeysByAgentId.one(id),
    queryFn: () => api<ModelRun[]>(`/api/v1/model_runs/by/agentId/${id}`),
    enabled: id !== undefined && id !== null && id !== "",
  });
}

export function useModelRunsByAgentIdBatch(ids: string[]) {
  return useQuery<ModelRun[]>({
    queryKey: modelRunKeysByAgentId.many(ids),
    queryFn: () =>
      api<ModelRun[]>(`/api/v1/model_runs/by/agentId/batch`, {
        method: "POST",
        body: JSON.stringify({ ids }),
      }),
    enabled: Array.isArray(ids) && ids.length > 0,
  });
}

export function useModelRunsByProfileId(id: string) {
  return useQuery<ModelRun[]>({
    queryKey: modelRunKeysByProfileId.one(id),
    queryFn: () => api<ModelRun[]>(`/api/v1/model_runs/by/profileId/${id}`),
    enabled: id !== undefined && id !== null && id !== "",
  });
}

export function useModelRunsByProfileIdBatch(ids: string[]) {
  return useQuery<ModelRun[]>({
    queryKey: modelRunKeysByProfileId.many(ids),
    queryFn: () =>
      api<ModelRun[]>(`/api/v1/model_runs/by/profileId/batch`, {
        method: "POST",
        body: JSON.stringify({ ids }),
      }),
    enabled: Array.isArray(ids) && ids.length > 0,
  });
}
