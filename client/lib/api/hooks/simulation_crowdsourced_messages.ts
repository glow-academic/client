// AUTO-GENERATED minimal hooks for simulation_crowdsourced_messages
// Safe to edit: generator will SKIP unless --force-hooks
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/fetcher";
import type { SimulationCrowdsourcedMessage, SimulationCrowdsourcedMessageCreate, SimulationCrowdsourcedMessageUpdate } from "@/lib/repos/simulationCrowdsourcedMessageRepo";
import { simulationCrowdsourcedMessageKeys, simulationCrowdsourcedMessageKeysBySimulationMessageId, simulationCrowdsourcedMessageKeysByProfileId } from "@/lib/api/keys";

export function useSimulationCrowdsourcedMessages(filters?: unknown) {
  return useQuery({
    queryKey: simulationCrowdsourcedMessageKeys.list(filters),
    queryFn: () => api<SimulationCrowdsourcedMessage[]>("/api/v1/simulation_crowdsourced_messages"),
  });
}

export function useCreateSimulationCrowdsourcedMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: SimulationCrowdsourcedMessageCreate) => api<SimulationCrowdsourcedMessage>("/api/v1/simulation_crowdsourced_messages", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: simulationCrowdsourcedMessageKeys.all }),
  });
}

export function useSimulationCrowdsourcedMessage(id: string, enabled = true) {
  return useQuery({
    queryKey: simulationCrowdsourcedMessageKeys.detail(id),
    queryFn: () => api<SimulationCrowdsourcedMessage>(`/api/v1/simulation_crowdsourced_messages/${id}`),
    enabled,
  });
}

export function useUpdateSimulationCrowdsourcedMessage(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: SimulationCrowdsourcedMessageUpdate) => api<SimulationCrowdsourcedMessage>(`/api/v1/simulation_crowdsourced_messages/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: simulationCrowdsourcedMessageKeys.detail(id) }),
  });
}

export function useDeleteSimulationCrowdsourcedMessage(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>(`/api/v1/simulation_crowdsourced_messages/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: simulationCrowdsourcedMessageKeys.all }),
  });
}

export function useSimulationCrowdsourcedMessagesBySimulationMessageId(id: string) {
  return useQuery({
    queryKey: simulationCrowdsourcedMessageKeysBySimulationMessageId.one(id),
    queryFn: () => api(`/api/v1/simulation_crowdsourced_messages/by/simulationMessageId/${id}`),
    enabled: id !== undefined && id !== null,
  });
}

export function useSimulationCrowdsourcedMessagesBySimulationMessageIdBatch(ids: string[]) {
  return useQuery({
    queryKey: simulationCrowdsourcedMessageKeysBySimulationMessageId.many(ids),
    queryFn: () => api(`/api/v1/simulation_crowdsourced_messages/by/simulationMessageId/batch`, { method: "POST", body: JSON.stringify({ ids }) }),
    enabled: Array.isArray(ids) && ids.length > 0,
  });
}

export function useSimulationCrowdsourcedMessagesByProfileId(id: string) {
  return useQuery({
    queryKey: simulationCrowdsourcedMessageKeysByProfileId.one(id),
    queryFn: () => api(`/api/v1/simulation_crowdsourced_messages/by/profileId/${id}`),
    enabled: id !== undefined && id !== null,
  });
}

export function useSimulationCrowdsourcedMessagesByProfileIdBatch(ids: string[]) {
  return useQuery({
    queryKey: simulationCrowdsourcedMessageKeysByProfileId.many(ids),
    queryFn: () => api(`/api/v1/simulation_crowdsourced_messages/by/profileId/batch`, { method: "POST", body: JSON.stringify({ ids }) }),
    enabled: Array.isArray(ids) && ids.length > 0,
  });
}
