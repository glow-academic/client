// AUTO-GENERATED minimal hooks for simulation_tags
// Safe to edit: generator will SKIP unless --force-hooks
import { api } from "@/lib/api/fetcher";
import {
  simulationTagKeys,
  simulationTagKeysBySimulationId,
} from "@/lib/api/keys";
import type {
  SimulationTag,
  SimulationTagCreate,
} from "@/lib/repos/simulationTagRepo";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export function useSimulationTags(filters?: unknown) {
  return useQuery({
    queryKey: simulationTagKeys.list(filters),
    queryFn: () => api<SimulationTag[]>("/api/v1/simulation_tags"),
  });
}

export function useCreateSimulationTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: SimulationTagCreate) =>
      api<SimulationTag>("/api/v1/simulation_tags", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: simulationTagKeys.all }),
  });
}

export function useSimulationTagsBySimulationId(id: string) {
  return useQuery<SimulationTag[]>({
    queryKey: simulationTagKeysBySimulationId.one(id),
    queryFn: () =>
      api<SimulationTag[]>(`/api/v1/simulation_tags/by/simulationId/${id}`),
    enabled: id !== undefined && id !== null && id !== "",
  });
}

export function useSimulationTagsBySimulationIdBatch(ids: string[]) {
  return useQuery<SimulationTag[]>({
    queryKey: simulationTagKeysBySimulationId.many(ids),
    queryFn: () =>
      api<SimulationTag[]>(`/api/v1/simulation_tags/by/simulationId/batch`, {
        method: "POST",
        body: JSON.stringify({ ids }),
      }),
    enabled: Array.isArray(ids) && ids.length > 0,
  });
}
