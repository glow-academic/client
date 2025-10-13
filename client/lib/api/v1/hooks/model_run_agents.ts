// AUTO-GENERATED minimal hooks for model_run_agents
// Safe to edit: generator will SKIP unless --force-hooks
import { api } from "@/lib/api/fetcher";
import {
  modelRunAgentKeys,
  modelRunAgentKeysByAgentId,
  modelRunAgentKeysByModelRunId,
} from "@/lib/api/v1/keys";
import type {
  ModelRunAgent,
  ModelRunAgentCreate,
} from "@/lib/repos/modelRunAgentRepo";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export function useModelRunAgents(filters?: unknown) {
  return useQuery({
    queryKey: modelRunAgentKeys.list(filters),
    queryFn: () => api<ModelRunAgent[]>("/api/v1/model_run_agents"),
  });
}

export function useCreateModelRunAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: ModelRunAgentCreate) =>
      api<ModelRunAgent>("/api/v1/model_run_agents", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: modelRunAgentKeys.all }),
  });
}

export function useModelRunAgentsByModelRunId(id: string) {
  return useQuery<ModelRunAgent[]>({
    queryKey: modelRunAgentKeysByModelRunId.one(id),
    queryFn: () =>
      api<ModelRunAgent[]>(`/api/v1/model_run_agents/by/modelRunId/${id}`),
    enabled: id !== undefined && id !== null && id !== "",
  });
}

export function useModelRunAgentsByModelRunIdBatch(ids: string[]) {
  return useQuery<ModelRunAgent[]>({
    queryKey: modelRunAgentKeysByModelRunId.many(ids),
    queryFn: () =>
      api<ModelRunAgent[]>(`/api/v1/model_run_agents/by/modelRunId/batch`, {
        method: "POST",
        body: JSON.stringify({ ids }),
      }),
    enabled: Array.isArray(ids) && ids.length > 0,
  });
}

export function useModelRunAgentsByAgentId(id: string) {
  return useQuery<ModelRunAgent[]>({
    queryKey: modelRunAgentKeysByAgentId.one(id),
    queryFn: () =>
      api<ModelRunAgent[]>(`/api/v1/model_run_agents/by/agentId/${id}`),
    enabled: id !== undefined && id !== null && id !== "",
  });
}

export function useModelRunAgentsByAgentIdBatch(ids: string[]) {
  return useQuery<ModelRunAgent[]>({
    queryKey: modelRunAgentKeysByAgentId.many(ids),
    queryFn: () =>
      api<ModelRunAgent[]>(`/api/v1/model_run_agents/by/agentId/batch`, {
        method: "POST",
        body: JSON.stringify({ ids }),
      }),
    enabled: Array.isArray(ids) && ids.length > 0,
  });
}
