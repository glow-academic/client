// AUTO-GENERATED minimal hooks for simulation_messages
// Safe to edit: generator will SKIP unless --force-hooks
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/fetcher";
import type { SimulationMessage, SimulationMessageCreate, SimulationMessageUpdate } from "@/lib/repos/simulationMessageRepo";
import { simulationMessageKeys, simulationMessageKeysByChatId } from "@/lib/api/keys";

export function useSimulationMessages(filters?: unknown) {
  return useQuery({
    queryKey: simulationMessageKeys.list(filters),
    queryFn: () => api<SimulationMessage[]>("/api/v1/simulation_messages"),
  });
}

export function useCreateSimulationMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: SimulationMessageCreate) => api<SimulationMessage>("/api/v1/simulation_messages", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: simulationMessageKeys.all }),
  });
}

export function useSimulationMessage(id: string, enabled = true) {
  return useQuery({
    queryKey: simulationMessageKeys.detail(id),
    queryFn: () => api<SimulationMessage>(`/api/v1/simulation_messages/${id}`),
    enabled: enabled && id !== undefined && id !== null && id !== "",
  });
}

export function useUpdateSimulationMessage(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: SimulationMessageUpdate) => api<SimulationMessage>(`/api/v1/simulation_messages/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: simulationMessageKeys.detail(id) }),
  });
}

export function useDeleteSimulationMessage(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>(`/api/v1/simulation_messages/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: simulationMessageKeys.all }),
  });
}

export function useSimulationMessagesByChatId(id: string) {
  return useQuery<SimulationMessage[]>({
    queryKey: simulationMessageKeysByChatId.one(id),
    queryFn: () => api<SimulationMessage[]>(`/api/v1/simulation_messages/by/chatId/${id}`),
    enabled: id !== undefined && id !== null && id !== "",
  });
}

export function useSimulationMessagesByChatIdBatch(ids: string[]) {
  return useQuery<SimulationMessage[]>({
    queryKey: simulationMessageKeysByChatId.many(ids),
    queryFn: () => api<SimulationMessage[]>(`/api/v1/simulation_messages/by/chatId/batch`, { method: "POST", body: JSON.stringify({ ids }) }),
    enabled: Array.isArray(ids) && ids.length > 0,
  });
}
