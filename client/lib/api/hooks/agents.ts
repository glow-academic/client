// AUTO-GENERATED minimal hooks for agents
// Safe to edit: generator will SKIP unless --force-hooks
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/fetcher";
import type { Agent, AgentCreate, AgentUpdate } from "@/lib/repos/agentRepo";
import {
  agentKeys,
  agentKeysByModelId,
  agentKeysByDepartmentId,
} from "@/lib/api/keys";

export function useAgents(filters?: unknown) {
  return useQuery({
    queryKey: agentKeys.list(filters),
    queryFn: () => api<Agent[]>("/api/v1/agents"),
  });
}

export function useCreateAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: AgentCreate) =>
      api<Agent>("/api/v1/agents", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: agentKeys.all }),
  });
}

export function useAgent(id: string, enabled = true) {
  return useQuery({
    queryKey: agentKeys.detail(id),
    queryFn: () => api<Agent>(`/api/v1/agents/${id}`),
    enabled: enabled && id !== undefined && id !== null && id !== "",
  });
}

export function useUpdateAgent(id?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: AgentUpdate & { id?: string }) => {
      const resolvedId = id ?? (patch as unknown as { id?: string })?.id;
      if (
        resolvedId === undefined ||
        resolvedId === null ||
        resolvedId === ""
      ) {
        throw new Error("Missing id for update");
      }
      const { id: _omit, ...body } = (patch as Record<string, unknown>) ?? {};
      return api<Agent>(`/api/v1/agents/${resolvedId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
    },
    onSuccess: (_data, variables) => {
      const resolvedId = id ?? (variables as { id?: string } | undefined)?.id;
      if (resolvedId && resolvedId !== "") {
        qc.invalidateQueries({ queryKey: agentKeys.detail(resolvedId) });
      } else {
        qc.invalidateQueries({ queryKey: agentKeys.all });
      }
    },
  });
}

export function useDeleteAgent(id?: string) {
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
      return api<void>(`/api/v1/agents/${resolvedId}`, { method: "DELETE" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: agentKeys.all }),
  });
}

export function useAgentsByModelId(id: string) {
  return useQuery<Agent[]>({
    queryKey: agentKeysByModelId.one(id),
    queryFn: () => api<Agent[]>(`/api/v1/agents/by/modelId/${id}`),
    enabled: id !== undefined && id !== null && id !== "",
  });
}

export function useAgentsByModelIdBatch(ids: string[]) {
  return useQuery<Agent[]>({
    queryKey: agentKeysByModelId.many(ids),
    queryFn: () =>
      api<Agent[]>(`/api/v1/agents/by/modelId/batch`, {
        method: "POST",
        body: JSON.stringify({ ids }),
      }),
    enabled: Array.isArray(ids) && ids.length > 0,
  });
}

export function useAgentsByDepartmentId(id: string) {
  return useQuery<Agent[]>({
    queryKey: agentKeysByDepartmentId.one(id),
    queryFn: () => api<Agent[]>(`/api/v1/agents/by/departmentId/${id}`),
    enabled: id !== undefined && id !== null && id !== "",
  });
}

export function useAgentsByDepartmentIdBatch(ids: string[]) {
  return useQuery<Agent[]>({
    queryKey: agentKeysByDepartmentId.many(ids),
    queryFn: () =>
      api<Agent[]>(`/api/v1/agents/by/departmentId/batch`, {
        method: "POST",
        body: JSON.stringify({ ids }),
      }),
    enabled: Array.isArray(ids) && ids.length > 0,
  });
}
