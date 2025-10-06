// AUTO-GENERATED minimal hooks for simulation_chat_crowdsourced_feedbacks
// Safe to edit: generator will SKIP unless --force-hooks
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/fetcher";
import type {
  SimulationChatCrowdsourcedFeedback,
  SimulationChatCrowdsourcedFeedbackCreate,
  SimulationChatCrowdsourcedFeedbackUpdate,
} from "@/lib/repos/simulationChatCrowdsourcedFeedbackRepo";
import {
  simulationChatCrowdsourcedFeedbackKeys,
  simulationChatCrowdsourcedFeedbackKeysByProfileId,
  simulationChatCrowdsourcedFeedbackKeysBySimulationChatFeedbackId,
} from "@/lib/api/keys";

export function useSimulationChatCrowdsourcedFeedbacks(filters?: unknown) {
  return useQuery({
    queryKey: simulationChatCrowdsourcedFeedbackKeys.list(filters),
    queryFn: () =>
      api<SimulationChatCrowdsourcedFeedback[]>(
        "/api/v1/simulation_chat_crowdsourced_feedbacks",
      ),
  });
}

export function useCreateSimulationChatCrowdsourcedFeedback() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: SimulationChatCrowdsourcedFeedbackCreate) =>
      api<SimulationChatCrowdsourcedFeedback>(
        "/api/v1/simulation_chat_crowdsourced_feedbacks",
        { method: "POST", body: JSON.stringify(payload) },
      ),
    onSuccess: () =>
      qc.invalidateQueries({
        queryKey: simulationChatCrowdsourcedFeedbackKeys.all,
      }),
  });
}

export function useSimulationChatCrowdsourcedFeedback(
  id: string,
  enabled = true,
) {
  return useQuery({
    queryKey: simulationChatCrowdsourcedFeedbackKeys.detail(id),
    queryFn: () =>
      api<SimulationChatCrowdsourcedFeedback>(
        `/api/v1/simulation_chat_crowdsourced_feedbacks/${id}`,
      ),
    enabled: enabled && id !== undefined && id !== null && id !== "",
  });
}

export function useUpdateSimulationChatCrowdsourcedFeedback(id?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (
      patch: SimulationChatCrowdsourcedFeedbackUpdate & { id?: string },
    ) => {
      const resolvedId = id ?? (patch as unknown as { id?: string })?.id;
      if (
        resolvedId === undefined ||
        resolvedId === null ||
        resolvedId === ""
      ) {
        throw new Error("Missing id for update");
      }
      const { id: _omit, ...body } = (patch as Record<string, unknown>) ?? {};
      return api<SimulationChatCrowdsourcedFeedback>(
        `/api/v1/simulation_chat_crowdsourced_feedbacks/${resolvedId}`,
        { method: "PATCH", body: JSON.stringify(body) },
      );
    },
    onSuccess: (_data, variables) => {
      const resolvedId = id ?? (variables as { id?: string } | undefined)?.id;
      if (resolvedId && resolvedId !== "") {
        qc.invalidateQueries({
          queryKey: simulationChatCrowdsourcedFeedbackKeys.detail(resolvedId),
        });
      } else {
        qc.invalidateQueries({
          queryKey: simulationChatCrowdsourcedFeedbackKeys.all,
        });
      }
    },
  });
}

export function useDeleteSimulationChatCrowdsourcedFeedback(id?: string) {
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
      return api<void>(
        `/api/v1/simulation_chat_crowdsourced_feedbacks/${resolvedId}`,
        { method: "DELETE" },
      );
    },
    onSuccess: () =>
      qc.invalidateQueries({
        queryKey: simulationChatCrowdsourcedFeedbackKeys.all,
      }),
  });
}

export function useSimulationChatCrowdsourcedFeedbacksByProfileId(id: string) {
  return useQuery<SimulationChatCrowdsourcedFeedback[]>({
    queryKey: simulationChatCrowdsourcedFeedbackKeysByProfileId.one(id),
    queryFn: () =>
      api<SimulationChatCrowdsourcedFeedback[]>(
        `/api/v1/simulation_chat_crowdsourced_feedbacks/by/profileId/${id}`,
      ),
    enabled: id !== undefined && id !== null && id !== "",
  });
}

export function useSimulationChatCrowdsourcedFeedbacksByProfileIdBatch(
  ids: string[],
) {
  return useQuery<SimulationChatCrowdsourcedFeedback[]>({
    queryKey: simulationChatCrowdsourcedFeedbackKeysByProfileId.many(ids),
    queryFn: () =>
      api<SimulationChatCrowdsourcedFeedback[]>(
        `/api/v1/simulation_chat_crowdsourced_feedbacks/by/profileId/batch`,
        { method: "POST", body: JSON.stringify({ ids }) },
      ),
    enabled: Array.isArray(ids) && ids.length > 0,
  });
}

export function useSimulationChatCrowdsourcedFeedbacksBySimulationChatFeedbackId(
  id: string,
) {
  return useQuery<SimulationChatCrowdsourcedFeedback[]>({
    queryKey:
      simulationChatCrowdsourcedFeedbackKeysBySimulationChatFeedbackId.one(id),
    queryFn: () =>
      api<SimulationChatCrowdsourcedFeedback[]>(
        `/api/v1/simulation_chat_crowdsourced_feedbacks/by/simulationChatFeedbackId/${id}`,
      ),
    enabled: id !== undefined && id !== null && id !== "",
  });
}

export function useSimulationChatCrowdsourcedFeedbacksBySimulationChatFeedbackIdBatch(
  ids: string[],
) {
  return useQuery<SimulationChatCrowdsourcedFeedback[]>({
    queryKey:
      simulationChatCrowdsourcedFeedbackKeysBySimulationChatFeedbackId.many(
        ids,
      ),
    queryFn: () =>
      api<SimulationChatCrowdsourcedFeedback[]>(
        `/api/v1/simulation_chat_crowdsourced_feedbacks/by/simulationChatFeedbackId/batch`,
        { method: "POST", body: JSON.stringify({ ids }) },
      ),
    enabled: Array.isArray(ids) && ids.length > 0,
  });
}
