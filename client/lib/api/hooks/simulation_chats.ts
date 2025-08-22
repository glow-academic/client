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
    enabled,
  });
}

export function useUpdateSimulationChat(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: SimulationChatUpdate) => api<SimulationChat>(`/api/v1/simulation_chats/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: simulationChatKeys.detail(id) }),
  });
}

export function useDeleteSimulationChat(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>(`/api/v1/simulation_chats/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: simulationChatKeys.all }),
  });
}

export function useSimulationChatsByScenarioId(id: string) {
  return useQuery({
    queryKey: simulationChatKeysByScenarioId.one(id),
    queryFn: () => api(`/api/v1/simulation_chats/by/scenarioId/${id}`),
    enabled: id !== undefined && id !== null,
  });
}

export function useSimulationChatsByScenarioIdBatch(ids: string[]) {
  return useQuery({
    queryKey: simulationChatKeysByScenarioId.many(ids),
    queryFn: () => api(`/api/v1/simulation_chats/by/scenarioId/batch`, { method: "POST", body: JSON.stringify({ ids }) }),
    enabled: Array.isArray(ids) && ids.length > 0,
  });
}

export function useSimulationChatsByAttemptId(id: string) {
  return useQuery({
    queryKey: simulationChatKeysByAttemptId.one(id),
    queryFn: () => api(`/api/v1/simulation_chats/by/attemptId/${id}`),
    enabled: id !== undefined && id !== null,
  });
}

export function useSimulationChatsByAttemptIdBatch(ids: string[]) {
  return useQuery({
    queryKey: simulationChatKeysByAttemptId.many(ids),
    queryFn: () => api(`/api/v1/simulation_chats/by/attemptId/batch`, { method: "POST", body: JSON.stringify({ ids }) }),
    enabled: Array.isArray(ids) && ids.length > 0,
  });
}
