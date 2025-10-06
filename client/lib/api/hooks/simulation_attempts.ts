// AUTO-GENERATED minimal hooks for simulation_attempts
// Safe to edit: generator will SKIP unless --force-hooks
import { api } from "@/lib/api/fetcher";
import {
  analyticsDependencyKeys,
  simulationAttemptKeys,
  simulationAttemptKeysByProfileId,
  simulationAttemptKeysBySimulationId,
} from "@/lib/api/keys";
import type {
  SimulationAttempt,
  SimulationAttemptCreate,
  SimulationAttemptUpdate,
} from "@/lib/repos/simulationAttemptRepo";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export function useSimulationAttempts(filters?: unknown) {
  return useQuery({
    queryKey: simulationAttemptKeys.list(filters),
    queryFn: () => api<SimulationAttempt[]>("/api/v1/simulation_attempts"),
  });
}

export function useCreateSimulationAttempt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: SimulationAttemptCreate) =>
      api<SimulationAttempt>("/api/v1/simulation_attempts", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      // Invalidate simulation attempts queries
      qc.invalidateQueries({ queryKey: simulationAttemptKeys.all });
      // Invalidate analytics dependencies since new attempt affects analytics
      qc.invalidateQueries({
        queryKey: analyticsDependencyKeys.simulationAttempts,
      });
    },
  });
}

export function useSimulationAttempt(id: string, enabled = true) {
  return useQuery({
    queryKey: simulationAttemptKeys.detail(id),
    queryFn: () => api<SimulationAttempt>(`/api/v1/simulation_attempts/${id}`),
    enabled: enabled && id !== undefined && id !== null && id !== "",
  });
}

export function useUpdateSimulationAttempt(id?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: SimulationAttemptUpdate & { id?: string }) => {
      const resolvedId = id ?? (patch as unknown as { id?: string })?.id;
      if (
        resolvedId === undefined ||
        resolvedId === null ||
        resolvedId === ""
      ) {
        throw new Error("Missing id for update");
      }
      const { id: _omit, ...body } = (patch as Record<string, unknown>) ?? {};
      return api<SimulationAttempt>(
        `/api/v1/simulation_attempts/${resolvedId}`,
        { method: "PATCH", body: JSON.stringify(body) }
      );
    },
    onSuccess: (_data, variables) => {
      const resolvedId = id ?? (variables as { id?: string } | undefined)?.id;
      if (resolvedId && resolvedId !== "") {
        qc.invalidateQueries({
          queryKey: simulationAttemptKeys.detail(resolvedId),
        });
      } else {
        qc.invalidateQueries({ queryKey: simulationAttemptKeys.all });
      }
      // Invalidate analytics dependencies since attempt update affects analytics
      qc.invalidateQueries({
        queryKey: analyticsDependencyKeys.simulationAttempts,
      });
    },
  });
}

export function useDeleteSimulationAttempt(id?: string) {
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
      return api<void>(`/api/v1/simulation_attempts/${resolvedId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      // Invalidate simulation attempts queries
      qc.invalidateQueries({ queryKey: simulationAttemptKeys.all });
      // Invalidate analytics dependencies since attempt deletion affects analytics
      qc.invalidateQueries({
        queryKey: analyticsDependencyKeys.simulationAttempts,
      });
    },
  });
}

export function useSimulationAttemptsByProfileId(id: string) {
  return useQuery<SimulationAttempt[]>({
    queryKey: simulationAttemptKeysByProfileId.one(id),
    queryFn: () =>
      api<SimulationAttempt[]>(
        `/api/v1/simulation_attempts/by/profileId/${id}`
      ),
    enabled: id !== undefined && id !== null && id !== "",
  });
}

export function useSimulationAttemptsByProfileIdBatch(ids: string[]) {
  return useQuery<SimulationAttempt[]>({
    queryKey: simulationAttemptKeysByProfileId.many(ids),
    queryFn: () =>
      api<SimulationAttempt[]>(
        `/api/v1/simulation_attempts/by/profileId/batch`,
        { method: "POST", body: JSON.stringify({ ids }) }
      ),
    enabled: Array.isArray(ids) && ids.length > 0,
  });
}

export function useSimulationAttemptsBySimulationId(id: string) {
  return useQuery<SimulationAttempt[]>({
    queryKey: simulationAttemptKeysBySimulationId.one(id),
    queryFn: () =>
      api<SimulationAttempt[]>(
        `/api/v1/simulation_attempts/by/simulationId/${id}`
      ),
    enabled: id !== undefined && id !== null && id !== "",
  });
}

export function useSimulationAttemptsBySimulationIdBatch(ids: string[]) {
  return useQuery<SimulationAttempt[]>({
    queryKey: simulationAttemptKeysBySimulationId.many(ids),
    queryFn: () =>
      api<SimulationAttempt[]>(
        `/api/v1/simulation_attempts/by/simulationId/batch`,
        { method: "POST", body: JSON.stringify({ ids }) }
      ),
    enabled: Array.isArray(ids) && ids.length > 0,
  });
}

export function useUpdateSimulationAttempts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      updates: Array<{ id: string } & SimulationAttemptUpdate>;
    }) =>
      api<SimulationAttempt[]>(`/api/v1/simulation_attempts/bulk-update`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: simulationAttemptKeys.all }),
  });
}
