// AUTO-GENERATED minimal hooks for simulation_crowdsourced_messages
// Safe to edit: generator will SKIP unless --force-hooks
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/fetcher";
import type {
  SimulationCrowdsourcedMessage,
  SimulationCrowdsourcedMessageCreate,
  SimulationCrowdsourcedMessageUpdate,
} from "@/lib/repos/simulationCrowdsourcedMessageRepo";
import {
  simulationCrowdsourcedMessageKeys,
  simulationCrowdsourcedMessageKeysBySimulationMessageId,
  simulationCrowdsourcedMessageKeysByProfileId,
} from "@/lib/api/keys";

export function useSimulationCrowdsourcedMessages(filters?: unknown) {
  return useQuery({
    queryKey: simulationCrowdsourcedMessageKeys.list(filters),
    queryFn: () =>
      api<SimulationCrowdsourcedMessage[]>(
        "/api/v1/simulation_crowdsourced_messages",
      ),
  });
}

export function useCreateSimulationCrowdsourcedMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: SimulationCrowdsourcedMessageCreate) =>
      api<SimulationCrowdsourcedMessage>(
        "/api/v1/simulation_crowdsourced_messages",
        { method: "POST", body: JSON.stringify(payload) },
      ),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: simulationCrowdsourcedMessageKeys.all }),
  });
}

export function useSimulationCrowdsourcedMessage(id: string, enabled = true) {
  return useQuery({
    queryKey: simulationCrowdsourcedMessageKeys.detail(id),
    queryFn: () =>
      api<SimulationCrowdsourcedMessage>(
        `/api/v1/simulation_crowdsourced_messages/${id}`,
      ),
    enabled: enabled && id !== undefined && id !== null && id !== "",
  });
}

export function useUpdateSimulationCrowdsourcedMessage(id?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (
      patch: SimulationCrowdsourcedMessageUpdate & { id?: string },
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
      return api<SimulationCrowdsourcedMessage>(
        `/api/v1/simulation_crowdsourced_messages/${resolvedId}`,
        { method: "PATCH", body: JSON.stringify(body) },
      );
    },
    onSuccess: (_data, variables) => {
      const resolvedId = id ?? (variables as { id?: string } | undefined)?.id;
      if (resolvedId && resolvedId !== "") {
        qc.invalidateQueries({
          queryKey: simulationCrowdsourcedMessageKeys.detail(resolvedId),
        });
      } else {
        qc.invalidateQueries({
          queryKey: simulationCrowdsourcedMessageKeys.all,
        });
      }
    },
  });
}

export function useDeleteSimulationCrowdsourcedMessage(id?: string) {
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
        `/api/v1/simulation_crowdsourced_messages/${resolvedId}`,
        { method: "DELETE" },
      );
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: simulationCrowdsourcedMessageKeys.all }),
  });
}

export function useSimulationCrowdsourcedMessagesBySimulationMessageId(
  id: string,
) {
  return useQuery<SimulationCrowdsourcedMessage[]>({
    queryKey: simulationCrowdsourcedMessageKeysBySimulationMessageId.one(id),
    queryFn: () =>
      api<SimulationCrowdsourcedMessage[]>(
        `/api/v1/simulation_crowdsourced_messages/by/simulationMessageId/${id}`,
      ),
    enabled: id !== undefined && id !== null && id !== "",
  });
}

export function useSimulationCrowdsourcedMessagesBySimulationMessageIdBatch(
  ids: string[],
) {
  return useQuery<SimulationCrowdsourcedMessage[]>({
    queryKey: simulationCrowdsourcedMessageKeysBySimulationMessageId.many(ids),
    queryFn: () =>
      api<SimulationCrowdsourcedMessage[]>(
        `/api/v1/simulation_crowdsourced_messages/by/simulationMessageId/batch`,
        { method: "POST", body: JSON.stringify({ ids }) },
      ),
    enabled: Array.isArray(ids) && ids.length > 0,
  });
}

export function useSimulationCrowdsourcedMessagesByProfileId(id: string) {
  return useQuery<SimulationCrowdsourcedMessage[]>({
    queryKey: simulationCrowdsourcedMessageKeysByProfileId.one(id),
    queryFn: () =>
      api<SimulationCrowdsourcedMessage[]>(
        `/api/v1/simulation_crowdsourced_messages/by/profileId/${id}`,
      ),
    enabled: id !== undefined && id !== null && id !== "",
  });
}

export function useSimulationCrowdsourcedMessagesByProfileIdBatch(
  ids: string[],
) {
  return useQuery<SimulationCrowdsourcedMessage[]>({
    queryKey: simulationCrowdsourcedMessageKeysByProfileId.many(ids),
    queryFn: () =>
      api<SimulationCrowdsourcedMessage[]>(
        `/api/v1/simulation_crowdsourced_messages/by/profileId/batch`,
        { method: "POST", body: JSON.stringify({ ids }) },
      ),
    enabled: Array.isArray(ids) && ids.length > 0,
  });
}
