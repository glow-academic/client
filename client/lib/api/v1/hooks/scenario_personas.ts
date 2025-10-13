// AUTO-GENERATED minimal hooks for scenario_personas
// Safe to edit: generator will SKIP unless --force-hooks
import { api } from "@/lib/api/fetcher";
import {
  scenarioPersonaKeys,
  scenarioPersonaKeysByPersonaId,
  scenarioPersonaKeysByScenarioId,
} from "@/lib/api/v1/keys";
import type {
  ScenarioPersona,
  ScenarioPersonaCreate,
} from "@/lib/repos/scenarioPersonaRepo";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export function useScenarioPersonas(filters?: unknown) {
  return useQuery({
    queryKey: scenarioPersonaKeys.list(filters),
    queryFn: () => api<ScenarioPersona[]>("/api/v1/scenario_personas"),
  });
}

export function useCreateScenarioPersona() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: ScenarioPersonaCreate) =>
      api<ScenarioPersona>("/api/v1/scenario_personas", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: scenarioPersonaKeys.all }),
  });
}

export function useScenarioPersonasByScenarioId(id: string) {
  return useQuery<ScenarioPersona[]>({
    queryKey: scenarioPersonaKeysByScenarioId.one(id),
    queryFn: () =>
      api<ScenarioPersona[]>(`/api/v1/scenario_personas/by/scenarioId/${id}`),
    enabled: id !== undefined && id !== null && id !== "",
  });
}

export function useScenarioPersonasByScenarioIdBatch(ids: string[]) {
  return useQuery<ScenarioPersona[]>({
    queryKey: scenarioPersonaKeysByScenarioId.many(ids),
    queryFn: () =>
      api<ScenarioPersona[]>(`/api/v1/scenario_personas/by/scenarioId/batch`, {
        method: "POST",
        body: JSON.stringify({ ids }),
      }),
    enabled: Array.isArray(ids) && ids.length > 0,
  });
}

export function useScenarioPersonasByPersonaId(id: string) {
  return useQuery<ScenarioPersona[]>({
    queryKey: scenarioPersonaKeysByPersonaId.one(id),
    queryFn: () =>
      api<ScenarioPersona[]>(`/api/v1/scenario_personas/by/personaId/${id}`),
    enabled: id !== undefined && id !== null && id !== "",
  });
}

export function useScenarioPersonasByPersonaIdBatch(ids: string[]) {
  return useQuery<ScenarioPersona[]>({
    queryKey: scenarioPersonaKeysByPersonaId.many(ids),
    queryFn: () =>
      api<ScenarioPersona[]>(`/api/v1/scenario_personas/by/personaId/batch`, {
        method: "POST",
        body: JSON.stringify({ ids }),
      }),
    enabled: Array.isArray(ids) && ids.length > 0,
  });
}
