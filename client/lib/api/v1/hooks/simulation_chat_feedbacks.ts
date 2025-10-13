// AUTO-GENERATED minimal hooks for simulation_chat_feedbacks
// Safe to edit: generator will SKIP unless --force-hooks
import { api } from "@/lib/api/fetcher";
import {
  simulationChatFeedbackKeys,
  simulationChatFeedbackKeysBySimulationChatGradeId,
  simulationChatFeedbackKeysByStandardId,
} from "@/lib/api/v1/keys";
import type {
  SimulationChatFeedback,
  SimulationChatFeedbackCreate,
  SimulationChatFeedbackUpdate,
} from "@/lib/repos/simulationChatFeedbackRepo";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export function useSimulationChatFeedbacks(filters?: unknown) {
  return useQuery({
    queryKey: simulationChatFeedbackKeys.list(filters),
    queryFn: () =>
      api<SimulationChatFeedback[]>("/api/v1/simulation_chat_feedbacks"),
  });
}

export function useCreateSimulationChatFeedback() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: SimulationChatFeedbackCreate) =>
      api<SimulationChatFeedback>("/api/v1/simulation_chat_feedbacks", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: simulationChatFeedbackKeys.all }),
  });
}

export function useSimulationChatFeedback(id: string, enabled = true) {
  return useQuery({
    queryKey: simulationChatFeedbackKeys.detail(id),
    queryFn: () =>
      api<SimulationChatFeedback>(`/api/v1/simulation_chat_feedbacks/${id}`),
    enabled: enabled && id !== undefined && id !== null && id !== "",
  });
}

export function useUpdateSimulationChatFeedback(id?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: SimulationChatFeedbackUpdate & { id?: string }) => {
      const resolvedId = id ?? (patch as unknown as { id?: string })?.id;
      if (
        resolvedId === undefined ||
        resolvedId === null ||
        resolvedId === ""
      ) {
        throw new Error("Missing id for update");
      }
      const { id: _omit, ...body } = (patch as Record<string, unknown>) ?? {};
      return api<SimulationChatFeedback>(
        `/api/v1/simulation_chat_feedbacks/${resolvedId}`,
        { method: "PATCH", body: JSON.stringify(body) }
      );
    },
    onSuccess: (_data, variables) => {
      const resolvedId = id ?? (variables as { id?: string } | undefined)?.id;
      if (resolvedId && resolvedId !== "") {
        qc.invalidateQueries({
          queryKey: simulationChatFeedbackKeys.detail(resolvedId),
        });
      } else {
        qc.invalidateQueries({ queryKey: simulationChatFeedbackKeys.all });
      }
    },
  });
}

export function useDeleteSimulationChatFeedback(id?: string) {
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
      return api<void>(`/api/v1/simulation_chat_feedbacks/${resolvedId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: simulationChatFeedbackKeys.all }),
  });
}

export function useSimulationChatFeedbacksByStandardId(id: string) {
  return useQuery<SimulationChatFeedback[]>({
    queryKey: simulationChatFeedbackKeysByStandardId.one(id),
    queryFn: () =>
      api<SimulationChatFeedback[]>(
        `/api/v1/simulation_chat_feedbacks/by/standardId/${id}`
      ),
    enabled: id !== undefined && id !== null && id !== "",
  });
}

export function useSimulationChatFeedbacksByStandardIdBatch(ids: string[]) {
  return useQuery<SimulationChatFeedback[]>({
    queryKey: simulationChatFeedbackKeysByStandardId.many(ids),
    queryFn: () =>
      api<SimulationChatFeedback[]>(
        `/api/v1/simulation_chat_feedbacks/by/standardId/batch`,
        { method: "POST", body: JSON.stringify({ ids }) }
      ),
    enabled: Array.isArray(ids) && ids.length > 0,
  });
}

export function useSimulationChatFeedbacksBySimulationChatGradeId(id: string) {
  return useQuery<SimulationChatFeedback[]>({
    queryKey: simulationChatFeedbackKeysBySimulationChatGradeId.one(id),
    queryFn: () =>
      api<SimulationChatFeedback[]>(
        `/api/v1/simulation_chat_feedbacks/by/simulationChatGradeId/${id}`
      ),
    enabled: id !== undefined && id !== null && id !== "",
  });
}

export function useSimulationChatFeedbacksBySimulationChatGradeIdBatch(
  ids: string[]
) {
  return useQuery<SimulationChatFeedback[]>({
    queryKey: simulationChatFeedbackKeysBySimulationChatGradeId.many(ids),
    queryFn: () =>
      api<SimulationChatFeedback[]>(
        `/api/v1/simulation_chat_feedbacks/by/simulationChatGradeId/batch`,
        { method: "POST", body: JSON.stringify({ ids }) }
      ),
    enabled: Array.isArray(ids) && ids.length > 0,
  });
}
