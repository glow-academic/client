// AUTO-GENERATED minimal hooks for simulations
// Safe to edit: generator will SKIP unless --force-hooks
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/fetcher";
import type { Simulation, SimulationCreate, SimulationUpdate } from "@/lib/repos/simulationRepo";
import { simulationKeys, simulationKeysByRubricId } from "@/lib/api/keys";

export function useSimulations(filters?: unknown) {
  return useQuery({
    queryKey: simulationKeys.list(filters),
    queryFn: () => api<Simulation[]>("/api/v1/simulations"),
  });
}

export function useCreateSimulation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: SimulationCreate) => api<Simulation>("/api/v1/simulations", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: simulationKeys.all }),
  });
}

export function useSimulation(id: string, enabled = true) {
  return useQuery({
    queryKey: simulationKeys.detail(id),
    queryFn: () => api<Simulation>(`/api/v1/simulations/${id}`),
    enabled,
  });
}

export function useUpdateSimulation(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: SimulationUpdate) => api<Simulation>(`/api/v1/simulations/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: simulationKeys.detail(id) }),
  });
}

export function useDeleteSimulation(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>(`/api/v1/simulations/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: simulationKeys.all }),
  });
}

export function useSimulationsByRubricId(id: string) {
  return useQuery<Simulation[]>({
    queryKey: simulationKeysByRubricId.one(id),
    queryFn: () => api<Simulation[]>(`/api/v1/simulations/by/rubricId/${id}`),
    enabled: id !== undefined && id !== null,
  });
}

export function useSimulationsByRubricIdBatch(ids: string[]) {
  return useQuery<Simulation[]>({
    queryKey: simulationKeysByRubricId.many(ids),
    queryFn: () => api<Simulation[]>(`/api/v1/simulations/by/rubricId/batch`, { method: "POST", body: JSON.stringify({ ids }) }),
    enabled: Array.isArray(ids) && ids.length > 0,
  });
}
