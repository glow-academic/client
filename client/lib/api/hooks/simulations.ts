// AUTO-GENERATED minimal hooks for simulations
// Safe to edit: generator will SKIP unless --force-hooks
import { api } from "@/lib/api/fetcher";
import {
  simulationKeys,
  simulationKeysByDepartmentId,
  simulationKeysByRubricId,
} from "@/lib/api/keys";
import type {
  Simulation,
  SimulationCreate,
  SimulationUpdate,
} from "@/lib/repos/simulationRepo";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export function useSimulations(filters?: unknown) {
  return useQuery({
    queryKey: simulationKeys.list(filters),
    queryFn: () => api<Simulation[]>("/api/v1/simulations"),
  });
}

export function useCreateSimulation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: SimulationCreate) =>
      api<Simulation>("/api/v1/simulations", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: simulationKeys.all }),
  });
}

export function useSimulation(id: string, enabled = true) {
  return useQuery({
    queryKey: simulationKeys.detail(id),
    queryFn: () => api<Simulation>(`/api/v1/simulations/${id}`),
    enabled: enabled && id !== undefined && id !== null && id !== "",
  });
}

export function useUpdateSimulation(id?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: SimulationUpdate & { id?: string }) => {
      const resolvedId = id ?? (patch as unknown as { id?: string })?.id;
      if (
        resolvedId === undefined ||
        resolvedId === null ||
        resolvedId === ""
      ) {
        throw new Error("Missing id for update");
      }
      const { id: _omit, ...body } = (patch as Record<string, unknown>) ?? {};
      return api<Simulation>(`/api/v1/simulations/${resolvedId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
    },
    onSuccess: (_data, variables) => {
      const resolvedId = id ?? (variables as { id?: string } | undefined)?.id;
      if (resolvedId && resolvedId !== "") {
        qc.invalidateQueries({ queryKey: simulationKeys.detail(resolvedId) });
      } else {
        qc.invalidateQueries({ queryKey: simulationKeys.all });
      }
    },
  });
}

export function useDeleteSimulation(id?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (arg?: { id?: string } | string) => {
      const resolvedId = id ?? (typeof arg === "object" ? arg?.id : arg);
      if (
        resolvedId === undefined ||
        resolvedId === null ||
        resolvedId === ""
      ) {
        throw new Error("Missing id for delete");
      }
      return api<void>(`/api/v1/simulations/${resolvedId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: simulationKeys.all }),
  });
}

export function useSimulationsByRubricId(id: string) {
  return useQuery<Simulation[]>({
    queryKey: simulationKeysByRubricId.one(id),
    queryFn: () => api<Simulation[]>(`/api/v1/simulations/by/rubricId/${id}`),
    enabled: id !== undefined && id !== null && id !== "",
  });
}

export function useSimulationsByRubricIdBatch(ids: string[]) {
  return useQuery<Simulation[]>({
    queryKey: simulationKeysByRubricId.many(ids),
    queryFn: () =>
      api<Simulation[]>(`/api/v1/simulations/by/rubricId/batch`, {
        method: "POST",
        body: JSON.stringify({ ids }),
      }),
    enabled: Array.isArray(ids) && ids.length > 0,
  });
}

export function useSimulationsByDepartmentId(id: string)  {
  return useQuery<Simulation[]>({
    queryKey: simulationKeysByDepartmentId.one(id),
    queryFn: () =>
      api<Simulation[]>(`/api/v1/simulations/by/departmentId/${id}`),
    enabled: id !== undefined && id !== null && id !== "",
  });
}

export function useSimulationsByDepartmentIdBatch(ids: string[]) {
  return useQuery<Simulation[]>({
    queryKey: simulationKeysByDepartmentId.many(ids),
    queryFn: () =>
      api<Simulation[]>(`/api/v1/simulations/by/departmentId/batch`, {
        method: "POST",
        body: JSON.stringify({ ids }),
      }),
    enabled: Array.isArray(ids) && ids.length > 0,
  });
}
