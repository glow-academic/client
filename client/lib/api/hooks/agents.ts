// AUTO-GENERATED minimal hooks for agents
// Safe to edit: generator will SKIP unless --force-hooks
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/fetcher";
import type { Agent, AgentCreate, AgentUpdate } from "@/lib/repos/agentRepo";
import { agentKeys, agentKeysByModelId } from "@/lib/api/keys";

export function useAgents(filters?: unknown) {
  return useQuery({
    queryKey: agentKeys.list(filters),
    queryFn: () => api<Agent[]>("/api/v1/agents"),
  });
}

export function useCreateAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: AgentCreate) => api<Agent>("/api/v1/agents", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: agentKeys.all }),
  });
}

export function useAgent(id: string, enabled = true) {
  return useQuery({
    queryKey: agentKeys.detail(id),
    queryFn: () => api<Agent>(`/api/v1/agents/${id}`),
    enabled,
  });
}

export function useUpdateAgent(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: AgentUpdate) => api<Agent>(`/api/v1/agents/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: agentKeys.detail(id) }),
  });
}

export function useDeleteAgent(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>(`/api/v1/agents/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: agentKeys.all }),
  });
}

export function useAgentsByModelId(id: string) {
  return useQuery({
    queryKey: agentKeysByModelId.one(id),
    queryFn: () => api(`/api/v1/agents/by/modelId/${id}`),
    enabled: id !== undefined && id !== null,
  });
}

export function useAgentsByModelIdBatch(ids: string[]) {
  return useQuery({
    queryKey: agentKeysByModelId.many(ids),
    queryFn: () => api(`/api/v1/agents/by/modelId/batch`, { method: "POST", body: JSON.stringify({ ids }) }),
    enabled: Array.isArray(ids) && ids.length > 0,
  });
}
