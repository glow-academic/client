// AUTO-GENERATED minimal hooks for simulation_hints
// Safe to edit: generator will SKIP unless --force-hooks
import { api } from "@/lib/api/fetcher";
import {
  simulationHintKeys,
  simulationHintKeysBySimulationMessageId,
} from "@/lib/api/v1/keys";
import type {
  SimulationHint,
  SimulationHintCreate,
  SimulationHintUpdate,
} from "@/lib/repos/simulationHintRepo";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export function useSimulationHints(filters?: unknown) {
  return useQuery({
    queryKey: simulationHintKeys.list(filters),
    queryFn: () => api<SimulationHint[]>("/api/v1/simulation_hints"),
  });
}

export function useCreateSimulationHint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: SimulationHintCreate) =>
      api<SimulationHint>("/api/v1/simulation_hints", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: simulationHintKeys.all }),
  });
}

export function useSimulationHint(id: string, enabled = true) {
  return useQuery({
    queryKey: simulationHintKeys.detail(id),
    queryFn: () => api<SimulationHint>(`/api/v1/simulation_hints/${id}`),
    enabled: enabled && id !== undefined && id !== null && id !== "",
  });
}

export function useUpdateSimulationHint(id?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: SimulationHintUpdate & { id?: string }) => {
      const resolvedId = id ?? (patch as unknown as { id?: string })?.id;
      if (
        resolvedId === undefined ||
        resolvedId === null ||
        resolvedId === ""
      ) {
        throw new Error("Missing id for update");
      }
      const { id: _omit, ...body } = (patch as Record<string, unknown>) ?? {};
      return api<SimulationHint>(`/api/v1/simulation_hints/${resolvedId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
    },
    onSuccess: (_data, variables) => {
      const resolvedId = id ?? (variables as { id?: string } | undefined)?.id;
      if (resolvedId && resolvedId !== "") {
        qc.invalidateQueries({
          queryKey: simulationHintKeys.detail(resolvedId),
        });
      } else {
        qc.invalidateQueries({ queryKey: simulationHintKeys.all });
      }
    },
  });
}

export function useDeleteSimulationHint(id?: string) {
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
      return api<void>(`/api/v1/simulation_hints/${resolvedId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: simulationHintKeys.all }),
  });
}

export function useSimulationHintsBySimulationMessageId(id: string) {
  return useQuery<SimulationHint[]>({
    queryKey: simulationHintKeysBySimulationMessageId.one(id),
    queryFn: () =>
      api<SimulationHint[]>(
        `/api/v1/simulation_hints/by/simulationMessageId/${id}`
      ),
    enabled: id !== undefined && id !== null && id !== "",
  });
}

export function useSimulationHintsBySimulationMessageIdBatch(ids: string[]) {
  return useQuery<SimulationHint[]>({
    queryKey: simulationHintKeysBySimulationMessageId.many(ids),
    queryFn: () =>
      api<SimulationHint[]>(
        `/api/v1/simulation_hints/by/simulationMessageId/batch`,
        { method: "POST", body: JSON.stringify({ ids }) }
      ),
    enabled: Array.isArray(ids) && ids.length > 0,
  });
}
