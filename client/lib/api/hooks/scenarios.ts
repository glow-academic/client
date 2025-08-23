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
    enabled: enabled && id !== undefined && id !== null && id !== "",
  });
}

export function useUpdateScenario(id?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: ScenarioUpdate & { id?: string }) => {
      const resolvedId = id ?? (patch as unknown as { id?: string })?.id;
      if (resolvedId === undefined || resolvedId === null || resolvedId === "") {
        throw new Error("Missing id for update");
      }
      const { id: _omit, ...body } = (patch as Record<string, unknown>) ?? {};
      return api<Scenario>(`/api/v1/scenarios/${resolvedId}`, { method: "PATCH", body: JSON.stringify(body) });
    },
    onSuccess: (_data, variables) => {
      const resolvedId = id ?? (variables as { id?: string } | undefined)?.id;
      if (resolvedId && resolvedId !== "") {
        qc.invalidateQueries({ queryKey: scenarioKeys.detail(resolvedId) });
      } else {
        qc.invalidateQueries({ queryKey: scenarioKeys.all });
      }
    },
  });
}

export function useDeleteScenario(id?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (arg?: { id?: string } | string) => {
      const resolvedId = id ?? (typeof arg === "object" ? arg?.id : arg);
      if (resolvedId === undefined || resolvedId === null || resolvedId === "") {
        throw new Error("Missing id for delete");
      }
      return api<void>(`/api/v1/scenarios/${resolvedId}`, { method: "DELETE" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: scenarioKeys.all }),
  });
}

export function useScenariosByPersonaId(id: string) {
  return useQuery<Scenario[]>({
    queryKey: scenarioKeysByPersonaId.one(id),
    queryFn: () => api<Scenario[]>(`/api/v1/scenarios/by/personaId/${id}`),
    enabled: id !== undefined && id !== null && id !== "",
  });
}

export function useScenariosByPersonaIdBatch(ids: string[]) {
  return useQuery<Scenario[]>({
    queryKey: scenarioKeysByPersonaId.many(ids),
    queryFn: () => api<Scenario[]>(`/api/v1/scenarios/by/personaId/batch`, { method: "POST", body: JSON.stringify({ ids }) }),
    enabled: Array.isArray(ids) && ids.length > 0,
  });
}
