/**
 * Agents hooks for v2 API
 * These hooks call client-side BFF routes at /api/v2/agents/*
 * which then proxy to the FastAPI server
 */

import { api } from "@/lib/api/fetcher";
import { agentsDetailKeys, agentsListKeys } from "@/lib/api/v2/keys";
import {
  AgentDetailResponseSchema,
  AgentsListResponseSchema,
  CreateAgentRequest,
  CreateAgentResponseSchema,
  DeleteAgentRequest,
  DeleteAgentResponseSchema,
  DuplicateAgentRequest,
  DuplicateAgentResponseSchema,
  UpdateAgentRequest,
  UpdateAgentResponseSchema,
} from "@/lib/api/v2/schemas/agents";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

// Type for agents hook options
type AgentsHookOptions = {
  enabled?: boolean;
  staleTime?: number;
};

export function useAgentsList(
  profileId: string,
  options: AgentsHookOptions | boolean = true
) {
  const queryOptions =
    typeof options === "boolean"
      ? { enabled: options }
      : { enabled: true, ...options };

  return useQuery({
    queryKey: agentsListKeys.list(profileId),
    ...queryOptions,
    queryFn: async () => {
      const res = await api<unknown>("/api/v2/agents/list", {
        method: "POST",
        body: JSON.stringify({ profileId }),
      });
      return AgentsListResponseSchema.parse(res);
    },
    enabled: queryOptions.enabled && !!profileId,
  });
}

export function useAgentDetail(
  agentId: string,
  profileId: string,
  options: AgentsHookOptions | boolean = true
) {
  const queryOptions =
    typeof options === "boolean"
      ? { enabled: options }
      : { enabled: true, ...options };

  return useQuery({
    queryKey: agentsDetailKeys.detail(agentId, profileId),
    ...queryOptions,
    queryFn: async () => {
      const res = await api<unknown>("/api/v2/agents/detail", {
        method: "POST",
        body: JSON.stringify({ agentId, profileId }),
      });
      return AgentDetailResponseSchema.parse(res);
    },
    enabled: queryOptions.enabled && !!agentId && !!profileId,
  });
}

export function useCreateAgent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: CreateAgentRequest) => {
      const res = await api<unknown>("/api/v2/agents/create", {
        method: "POST",
        body: JSON.stringify(request),
      });
      return CreateAgentResponseSchema.parse(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === "string" && key.startsWith("agents:v2:list");
        },
      });
    },
  });
}

export function useUpdateAgent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: UpdateAgentRequest) => {
      const res = await api<unknown>("/api/v2/agents/update", {
        method: "POST",
        body: JSON.stringify(request),
      });
      return UpdateAgentResponseSchema.parse(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return (
            (typeof key === "string" && key.startsWith("agents:v2:list")) ||
            (typeof key === "string" && key.startsWith("agents:v2:detail"))
          );
        },
      });
    },
  });
}

export function useDuplicateAgent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: DuplicateAgentRequest) => {
      const res = await api<unknown>("/api/v2/agents/duplicate", {
        method: "POST",
        body: JSON.stringify(request),
      });
      return DuplicateAgentResponseSchema.parse(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === "string" && key.startsWith("agents:v2:list");
        },
      });
    },
  });
}

export function useDeleteAgent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: DeleteAgentRequest) => {
      const res = await api<unknown>("/api/v2/agents/delete", {
        method: "POST",
        body: JSON.stringify(request),
      });
      return DeleteAgentResponseSchema.parse(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === "string" && key.startsWith("agents:v2:list");
        },
      });
    },
  });
}
