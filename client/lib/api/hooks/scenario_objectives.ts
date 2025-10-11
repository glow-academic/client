// AUTO-GENERATED minimal hooks for scenario_objectives
// Safe to edit: generator will SKIP unless --force-hooks
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/fetcher";
import type { ScenarioObjective, ScenarioObjectiveCreate, ScenarioObjectiveUpdate } from "@/lib/repos/scenarioObjectiveRepo";
import { scenarioObjectiveKeys, scenarioObjectiveKeysByScenarioId } from "@/lib/api/keys";

export function useScenarioObjectives(filters?: unknown) {
  return useQuery({
    queryKey: scenarioObjectiveKeys.list(filters),
    queryFn: () => api<ScenarioObjective[]>("/api/v1/scenario_objectives"),
  });
}

export function useCreateScenarioObjective() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: ScenarioObjectiveCreate) => api<ScenarioObjective>("/api/v1/scenario_objectives", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: scenarioObjectiveKeys.all }),
  });
}


export function useScenarioObjectivesByScenarioId(id: string) {
  return useQuery<ScenarioObjective[]>({
    queryKey: scenarioObjectiveKeysByScenarioId.one(id),
    queryFn: () => api<ScenarioObjective[]>(`/api/v1/scenario_objectives/by/scenarioId/${id}`),
    enabled: id !== undefined && id !== null && id !== "",
  });
}

export function useScenarioObjectivesByScenarioIdBatch(ids: string[]) {
  return useQuery<ScenarioObjective[]>({
    queryKey: scenarioObjectiveKeysByScenarioId.many(ids),
    queryFn: () => api<ScenarioObjective[]>(`/api/v1/scenario_objectives/by/scenarioId/batch`, { method: "POST", body: JSON.stringify({ ids }) }),
    enabled: Array.isArray(ids) && ids.length > 0,
  });
}
