// AUTO-GENERATED minimal hooks for simulation_chats
// Safe to edit: generator will SKIP unless --force-hooks
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/fetcher";
import type { SimulationChat, SimulationChatCreate, SimulationChatUpdate } from "@/lib/repos/simulationChatRepo";
import { simulationChatKeys, simulationChatKeysByScenarioId, simulationChatKeysByAttemptId } from "@/lib/api/keys";

export function useSimulationChats(filters?: unknown) {
  return useQuery({
    queryKey: simulationChatKeys.list(filters),
    queryFn: () => api<SimulationChat[]>("/api/v1/simulation_chats"),
  });
}

export function useCreateSimulationChat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: SimulationChatCreate) => api<SimulationChat>("/api/v1/simulation_chats", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: simulationChatKeys.all }),
  });
}

export function useSimulationChat(id: string, enabled = true) {
  return useQuery({
    queryKey: simulationChatKeys.detail(id),
    queryFn: () => api<SimulationChat>(`/api/v1/simulation_chats/${id}`),
    enabled: enabled && id !== undefined && id !== null && id !== "",
  });
}

export function useUpdateSimulationChat(id?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: SimulationChatUpdate & { id?: string }) => {
      const resolvedId = id ?? (patch as unknown as { id?: string })?.id;
      if (resolvedId === undefined || resolvedId === null || resolvedId === "") {
        throw new Error("Missing id for update");
      }
      const { id: _omit, ...body } = (patch as Record<string, unknown>) ?? {};
      return api<SimulationChat>(`/api/v1/simulation_chats/${resolvedId}`, { method: "PATCH", body: JSON.stringify(body) });
    },
    onSuccess: (_data, variables) => {
      const resolvedId = id ?? (variables as { id?: string } | undefined)?.id;
      if (resolvedId && resolvedId !== "") {
        qc.invalidateQueries({ queryKey: simulationChatKeys.detail(resolvedId) });
      } else {
        qc.invalidateQueries({ queryKey: simulationChatKeys.all });
      }
    },
  });
}

export function useDeleteSimulationChat(id?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (arg?: { id?: string } | string) => {
      const resolvedId = id ?? (typeof arg === "object" ? arg?.id : arg);
      if (resolvedId === undefined || resolvedId === null || resolvedId === "") {
        throw new Error("Missing id for delete");
      }
      return api<void>(`/api/v1/simulation_chats/${resolvedId}`, { method: "DELETE" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: simulationChatKeys.all }),
  });
}

export function useSimulationChatsByScenarioId(id: string) {
  return useQuery<SimulationChat[]>({
    queryKey: simulationChatKeysByScenarioId.one(id),
    queryFn: () => api<SimulationChat[]>(`/api/v1/simulation_chats/by/scenarioId/${id}`),
    enabled: id !== undefined && id !== null && id !== "",
  });
}

export function useSimulationChatsByScenarioIdBatch(ids: string[]) {
  return useQuery<SimulationChat[]>({
    queryKey: simulationChatKeysByScenarioId.many(ids),
    queryFn: () => api<SimulationChat[]>(`/api/v1/simulation_chats/by/scenarioId/batch`, { method: "POST", body: JSON.stringify({ ids }) }),
    enabled: Array.isArray(ids) && ids.length > 0,
  });
}

export function useSimulationChatsByAttemptId(id: string) {
  return useQuery<SimulationChat[]>({
    queryKey: simulationChatKeysByAttemptId.one(id),
    queryFn: () => api<SimulationChat[]>(`/api/v1/simulation_chats/by/attemptId/${id}`),
    enabled: id !== undefined && id !== null && id !== "",
  });
}

export function useSimulationChatsByAttemptIdBatch(ids: string[]) {
  return useQuery<SimulationChat[]>({
    queryKey: simulationChatKeysByAttemptId.many(ids),
    queryFn: () => api<SimulationChat[]>(`/api/v1/simulation_chats/by/attemptId/batch`, { method: "POST", body: JSON.stringify({ ids }) }),
    enabled: Array.isArray(ids) && ids.length > 0,
  });
}
