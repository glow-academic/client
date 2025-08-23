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

export function useUpdateSimulationMessage(id?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: SimulationMessageUpdate & { id?: string }) => {
      const resolvedId = id ?? (patch as unknown as { id?: string })?.id;
      if (resolvedId === undefined || resolvedId === null || resolvedId === "") {
        throw new Error("Missing id for update");
      }
      const { id: _omit, ...body } = (patch as Record<string, unknown>) ?? {};
      return api<SimulationMessage>(`/api/v1/simulation_messages/${resolvedId}`, { method: "PATCH", body: JSON.stringify(body) });
    },
    onSuccess: (_data, variables) => {
      const resolvedId = id ?? (variables as { id?: string } | undefined)?.id;
      if (resolvedId && resolvedId !== "") {
        qc.invalidateQueries({ queryKey: simulationMessageKeys.detail(resolvedId) });
      } else {
        qc.invalidateQueries({ queryKey: simulationMessageKeys.all });
      }
    },
  });
}

export function useDeleteSimulationMessage(id?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (arg?: { id?: string } | string) => {
      const resolvedId = id ?? (typeof arg === "object" ? arg?.id : arg);
      if (resolvedId === undefined || resolvedId === null || resolvedId === "") {
        throw new Error("Missing id for delete");
      }
      return api<void>(`/api/v1/simulation_messages/${resolvedId}`, { method: "DELETE" });
    },
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
