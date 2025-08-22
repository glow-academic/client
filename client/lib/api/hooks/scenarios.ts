// AUTO-GENERATED minimal hooks for scenarios
// Safe to edit: generator will SKIP unless --force-hooks
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/fetcher";
import type { Scenario, ScenarioCreate, ScenarioUpdate } from "@/lib/repos/scenarioRepo";
import { scenarioKeys, scenarioKeysByPersonaId } from "@/lib/api/keys";

export function useScenarios(filters?: unknown) {
  return useQuery({
    queryKey: scenarioKeys.list(filters),
    queryFn: () => api<Scenario[]>("/api/v1/scenarios"),
  });
}

export function useCreateScenario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: ScenarioCreate) => api<Scenario>("/api/v1/scenarios", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: scenarioKeys.all }),
  });
}

export function useScenario(id: string, enabled = true) {
  return useQuery({
    queryKey: scenarioKeys.detail(id),
    queryFn: () => api<Scenario>(`/api/v1/scenarios/${id}`),
    enabled,
  });
}

export function useUpdateScenario(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: ScenarioUpdate) => api<Scenario>(`/api/v1/scenarios/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: scenarioKeys.detail(id) }),
  });
}

export function useDeleteScenario(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>(`/api/v1/scenarios/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: scenarioKeys.all }),
  });
}

export function useScenariosByPersonaId(id: string) {
  return useQuery<Scenario[]>({
    queryKey: scenarioKeysByPersonaId.one(id),
    queryFn: () => api<Scenario[]>(`/api/v1/scenarios/by/personaId/${id}`),
    enabled: id !== undefined && id !== null,
  });
}

export function useScenariosByPersonaIdBatch(ids: string[]) {
  return useQuery<Scenario[]>({
    queryKey: scenarioKeysByPersonaId.many(ids),
    queryFn: () => api<Scenario[]>(`/api/v1/scenarios/by/personaId/batch`, { method: "POST", body: JSON.stringify({ ids }) }),
    enabled: Array.isArray(ids) && ids.length > 0,
  });
}
