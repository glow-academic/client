// AUTO-GENERATED minimal hooks for scenario_tree
// Safe to edit: generator will SKIP unless --force-hooks
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/fetcher";
import type { ScenarioTree, ScenarioTreeCreate, ScenarioTreeUpdate } from "@/lib/repos/scenarioTreeRepo";
import { scenarioTreeKeys, scenarioTreeKeysByParentId, scenarioTreeKeysByChildId } from "@/lib/api/keys";

export function useScenarioTrees(filters?: unknown) {
  return useQuery({
    queryKey: scenarioTreeKeys.list(filters),
    queryFn: () => api<ScenarioTree[]>("/api/v1/scenario_tree"),
  });
}

export function useCreateScenarioTree() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: ScenarioTreeCreate) => api<ScenarioTree>("/api/v1/scenario_tree", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: scenarioTreeKeys.all }),
  });
}


export function useScenarioTreeByParentId(id: string) {
  return useQuery<ScenarioTree[]>({
    queryKey: scenarioTreeKeysByParentId.one(id),
    queryFn: () => api<ScenarioTree[]>(`/api/v1/scenario_tree/by/parentId/${id}`),
    enabled: id !== undefined && id !== null && id !== "",
  });
}

export function useScenarioTreeByParentIdBatch(ids: string[]) {
  return useQuery<ScenarioTree[]>({
    queryKey: scenarioTreeKeysByParentId.many(ids),
    queryFn: () => api<ScenarioTree[]>(`/api/v1/scenario_tree/by/parentId/batch`, { method: "POST", body: JSON.stringify({ ids }) }),
    enabled: Array.isArray(ids) && ids.length > 0,
  });
}

export function useScenarioTreeByChildId(id: string) {
  return useQuery<ScenarioTree[]>({
    queryKey: scenarioTreeKeysByChildId.one(id),
    queryFn: () => api<ScenarioTree[]>(`/api/v1/scenario_tree/by/childId/${id}`),
    enabled: id !== undefined && id !== null && id !== "",
  });
}

export function useScenarioTreeByChildIdBatch(ids: string[]) {
  return useQuery<ScenarioTree[]>({
    queryKey: scenarioTreeKeysByChildId.many(ids),
    queryFn: () => api<ScenarioTree[]>(`/api/v1/scenario_tree/by/childId/batch`, { method: "POST", body: JSON.stringify({ ids }) }),
    enabled: Array.isArray(ids) && ids.length > 0,
  });
}
