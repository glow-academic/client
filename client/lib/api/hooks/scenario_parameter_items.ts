// AUTO-GENERATED minimal hooks for scenario_parameter_items
// Safe to edit: generator will SKIP unless --force-hooks
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/fetcher";
import type { ScenarioParameterItem, ScenarioParameterItemCreate, ScenarioParameterItemUpdate } from "@/lib/repos/scenarioParameterItemRepo";
import { scenarioParameterItemKeys, scenarioParameterItemKeysByScenarioId, scenarioParameterItemKeysByParameterItemId } from "@/lib/api/keys";

export function useScenarioParameterItems(filters?: unknown) {
  return useQuery({
    queryKey: scenarioParameterItemKeys.list(filters),
    queryFn: () => api<ScenarioParameterItem[]>("/api/v1/scenario_parameter_items"),
  });
}

export function useCreateScenarioParameterItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: ScenarioParameterItemCreate) => api<ScenarioParameterItem>("/api/v1/scenario_parameter_items", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: scenarioParameterItemKeys.all }),
  });
}


export function useScenarioParameterItemsByScenarioId(id: string) {
  return useQuery<ScenarioParameterItem[]>({
    queryKey: scenarioParameterItemKeysByScenarioId.one(id),
    queryFn: () => api<ScenarioParameterItem[]>(`/api/v1/scenario_parameter_items/by/scenarioId/${id}`),
    enabled: id !== undefined && id !== null && id !== "",
  });
}

export function useScenarioParameterItemsByScenarioIdBatch(ids: string[]) {
  return useQuery<ScenarioParameterItem[]>({
    queryKey: scenarioParameterItemKeysByScenarioId.many(ids),
    queryFn: () => api<ScenarioParameterItem[]>(`/api/v1/scenario_parameter_items/by/scenarioId/batch`, { method: "POST", body: JSON.stringify({ ids }) }),
    enabled: Array.isArray(ids) && ids.length > 0,
  });
}

export function useScenarioParameterItemsByParameterItemId(id: string) {
  return useQuery<ScenarioParameterItem[]>({
    queryKey: scenarioParameterItemKeysByParameterItemId.one(id),
    queryFn: () => api<ScenarioParameterItem[]>(`/api/v1/scenario_parameter_items/by/parameterItemId/${id}`),
    enabled: id !== undefined && id !== null && id !== "",
  });
}

export function useScenarioParameterItemsByParameterItemIdBatch(ids: string[]) {
  return useQuery<ScenarioParameterItem[]>({
    queryKey: scenarioParameterItemKeysByParameterItemId.many(ids),
    queryFn: () => api<ScenarioParameterItem[]>(`/api/v1/scenario_parameter_items/by/parameterItemId/batch`, { method: "POST", body: JSON.stringify({ ids }) }),
    enabled: Array.isArray(ids) && ids.length > 0,
  });
}
