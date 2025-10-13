// AUTO-GENERATED minimal hooks for cohort_simulations
// Safe to edit: generator will SKIP unless --force-hooks
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/fetcher";
import type {
  CohortSimulation,
  CohortSimulationCreate,
} from "@/lib/repos/cohortSimulationRepo";
import {
  cohortSimulationKeys,
  cohortSimulationKeysByCohortId,
  cohortSimulationKeysBySimulationId,
} from "@/lib/api/keys";

export function useCohortSimulations(filters?: unknown) {
  return useQuery({
    queryKey: cohortSimulationKeys.list(filters),
    queryFn: () => api<CohortSimulation[]>("/api/v1/cohort_simulations"),
  });
}

export function useCreateCohortSimulation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CohortSimulationCreate) =>
      api<CohortSimulation>("/api/v1/cohort_simulations", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: cohortSimulationKeys.all }),
  });
}

export function useCohortSimulationsByCohortId(id: string) {
  return useQuery<CohortSimulation[]>({
    queryKey: cohortSimulationKeysByCohortId.one(id),
    queryFn: () =>
      api<CohortSimulation[]>(`/api/v1/cohort_simulations/by/cohortId/${id}`),
    enabled: id !== undefined && id !== null && id !== "",
  });
}

export function useCohortSimulationsByCohortIdBatch(ids: string[]) {
  return useQuery<CohortSimulation[]>({
    queryKey: cohortSimulationKeysByCohortId.many(ids),
    queryFn: () =>
      api<CohortSimulation[]>(`/api/v1/cohort_simulations/by/cohortId/batch`, {
        method: "POST",
        body: JSON.stringify({ ids }),
      }),
    enabled: Array.isArray(ids) && ids.length > 0,
  });
}

export function useCohortSimulationsBySimulationId(id: string) {
  return useQuery<CohortSimulation[]>({
    queryKey: cohortSimulationKeysBySimulationId.one(id),
    queryFn: () =>
      api<CohortSimulation[]>(
        `/api/v1/cohort_simulations/by/simulationId/${id}`,
      ),
    enabled: id !== undefined && id !== null && id !== "",
  });
}

export function useCohortSimulationsBySimulationIdBatch(ids: string[]) {
  return useQuery<CohortSimulation[]>({
    queryKey: cohortSimulationKeysBySimulationId.many(ids),
    queryFn: () =>
      api<CohortSimulation[]>(
        `/api/v1/cohort_simulations/by/simulationId/batch`,
        { method: "POST", body: JSON.stringify({ ids }) },
      ),
    enabled: Array.isArray(ids) && ids.length > 0,
  });
}
