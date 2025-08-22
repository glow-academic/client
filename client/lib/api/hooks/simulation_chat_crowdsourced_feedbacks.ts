// AUTO-GENERATED minimal hooks for simulation_chat_crowdsourced_feedbacks
// Safe to edit: generator will SKIP unless --force-hooks
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/fetcher";
import type { SimulationChatCrowdsourcedFeedback, SimulationChatCrowdsourcedFeedbackCreate, SimulationChatCrowdsourcedFeedbackUpdate } from "@/lib/repos/simulationChatCrowdsourcedFeedbackRepo";
import { simulationChatCrowdsourcedFeedbackKeys, simulationChatCrowdsourcedFeedbackKeysByProfileId, simulationChatCrowdsourcedFeedbackKeysBySimulationChatFeedbackId } from "@/lib/api/keys";

export function useSimulationChatCrowdsourcedFeedbacks(filters?: unknown) {
  return useQuery({
    queryKey: simulationChatCrowdsourcedFeedbackKeys.list(filters),
    queryFn: () => api<SimulationChatCrowdsourcedFeedback[]>("/api/v1/simulation_chat_crowdsourced_feedbacks"),
  });
}

export function useCreateSimulationChatCrowdsourcedFeedback() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: SimulationChatCrowdsourcedFeedbackCreate) => api<SimulationChatCrowdsourcedFeedback>("/api/v1/simulation_chat_crowdsourced_feedbacks", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: simulationChatCrowdsourcedFeedbackKeys.all }),
  });
}

export function useSimulationChatCrowdsourcedFeedback(id: string, enabled = true) {
  return useQuery({
    queryKey: simulationChatCrowdsourcedFeedbackKeys.detail(id),
    queryFn: () => api<SimulationChatCrowdsourcedFeedback>(`/api/v1/simulation_chat_crowdsourced_feedbacks/${id}`),
    enabled,
  });
}

export function useUpdateSimulationChatCrowdsourcedFeedback(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: SimulationChatCrowdsourcedFeedbackUpdate) => api<SimulationChatCrowdsourcedFeedback>(`/api/v1/simulation_chat_crowdsourced_feedbacks/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: simulationChatCrowdsourcedFeedbackKeys.detail(id) }),
  });
}

export function useDeleteSimulationChatCrowdsourcedFeedback(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>(`/api/v1/simulation_chat_crowdsourced_feedbacks/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: simulationChatCrowdsourcedFeedbackKeys.all }),
  });
}

export function useSimulationChatCrowdsourcedFeedbacksByProfileId(id: string) {
  return useQuery({
    queryKey: simulationChatCrowdsourcedFeedbackKeysByProfileId.one(id),
    queryFn: () => api(`/api/v1/simulation_chat_crowdsourced_feedbacks/by/profileId/${id}`),
    enabled: id !== undefined && id !== null,
  });
}

export function useSimulationChatCrowdsourcedFeedbacksByProfileIdBatch(ids: string[]) {
  return useQuery({
    queryKey: simulationChatCrowdsourcedFeedbackKeysByProfileId.many(ids),
    queryFn: () => api(`/api/v1/simulation_chat_crowdsourced_feedbacks/by/profileId/batch`, { method: "POST", body: JSON.stringify({ ids }) }),
    enabled: Array.isArray(ids) && ids.length > 0,
  });
}

export function useSimulationChatCrowdsourcedFeedbacksBySimulationChatFeedbackId(id: string) {
  return useQuery({
    queryKey: simulationChatCrowdsourcedFeedbackKeysBySimulationChatFeedbackId.one(id),
    queryFn: () => api(`/api/v1/simulation_chat_crowdsourced_feedbacks/by/simulationChatFeedbackId/${id}`),
    enabled: id !== undefined && id !== null,
  });
}

export function useSimulationChatCrowdsourcedFeedbacksBySimulationChatFeedbackIdBatch(ids: string[]) {
  return useQuery({
    queryKey: simulationChatCrowdsourcedFeedbackKeysBySimulationChatFeedbackId.many(ids),
    queryFn: () => api(`/api/v1/simulation_chat_crowdsourced_feedbacks/by/simulationChatFeedbackId/batch`, { method: "POST", body: JSON.stringify({ ids }) }),
    enabled: Array.isArray(ids) && ids.length > 0,
  });
}
