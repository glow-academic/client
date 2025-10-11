// AUTO-GENERATED minimal hooks for simulation_scenarios
// Safe to edit: generator will SKIP unless --force-hooks
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/fetcher";
import type { SimulationScenario, SimulationScenarioCreate, SimulationScenarioUpdate } from "@/lib/repos/simulationScenarioRepo";
import { simulationScenarioKeys, simulationScenarioKeysBySimulationId, simulationScenarioKeysByScenarioId } from "@/lib/api/keys";

export function useSimulationScenarios(filters?: unknown) {
  return useQuery({
    queryKey: simulationScenarioKeys.list(filters),
    queryFn: () => api<SimulationScenario[]>("/api/v1/simulation_scenarios"),
  });
}

export function useCreateSimulationScenario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: SimulationScenarioCreate) => api<SimulationScenario>("/api/v1/simulation_scenarios", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: simulationScenarioKeys.all }),
  });
}


export function useSimulationScenariosBySimulationId(id: string) {
  return useQuery<SimulationScenario[]>({
    queryKey: simulationScenarioKeysBySimulationId.one(id),
    queryFn: () => api<SimulationScenario[]>(`/api/v1/simulation_scenarios/by/simulationId/${id}`),
    enabled: id !== undefined && id !== null && id !== "",
  });
}

export function useSimulationScenariosBySimulationIdBatch(ids: string[]) {
  return useQuery<SimulationScenario[]>({
    queryKey: simulationScenarioKeysBySimulationId.many(ids),
    queryFn: () => api<SimulationScenario[]>(`/api/v1/simulation_scenarios/by/simulationId/batch`, { method: "POST", body: JSON.stringify({ ids }) }),
    enabled: Array.isArray(ids) && ids.length > 0,
  });
}

export function useSimulationScenariosByScenarioId(id: string) {
  return useQuery<SimulationScenario[]>({
    queryKey: simulationScenarioKeysByScenarioId.one(id),
    queryFn: () => api<SimulationScenario[]>(`/api/v1/simulation_scenarios/by/scenarioId/${id}`),
    enabled: id !== undefined && id !== null && id !== "",
  });
}

export function useSimulationScenariosByScenarioIdBatch(ids: string[]) {
  return useQuery<SimulationScenario[]>({
    queryKey: simulationScenarioKeysByScenarioId.many(ids),
    queryFn: () => api<SimulationScenario[]>(`/api/v1/simulation_scenarios/by/scenarioId/batch`, { method: "POST", body: JSON.stringify({ ids }) }),
    enabled: Array.isArray(ids) && ids.length > 0,
  });
}
