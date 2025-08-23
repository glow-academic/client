// AUTO-GENERATED minimal hooks for simulation_attempts
// Safe to edit: generator will SKIP unless --force-hooks
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/fetcher";
import type { SimulationAttempt, SimulationAttemptCreate, SimulationAttemptUpdate } from "@/lib/repos/simulationAttemptRepo";
import { simulationAttemptKeys, simulationAttemptKeysByProfileId, simulationAttemptKeysBySimulationId } from "@/lib/api/keys";

export function useSimulationAttempts(filters?: unknown) {
  return useQuery({
    queryKey: simulationAttemptKeys.list(filters),
    queryFn: () => api<SimulationAttempt[]>("/api/v1/simulation_attempts"),
  });
}

export function useCreateSimulationAttempt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: SimulationAttemptCreate) => api<SimulationAttempt>("/api/v1/simulation_attempts", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: simulationAttemptKeys.all }),
  });
}

export function useSimulationAttempt(id: string, enabled = true) {
  return useQuery({
    queryKey: simulationAttemptKeys.detail(id),
    queryFn: () => api<SimulationAttempt>(`/api/v1/simulation_attempts/${id}`),
    enabled: enabled && id !== undefined && id !== null && id !== "",
  });
}

export function useUpdateSimulationAttempt(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: SimulationAttemptUpdate) => api<SimulationAttempt>(`/api/v1/simulation_attempts/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: simulationAttemptKeys.detail(id) }),
  });
}

export function useDeleteSimulationAttempt(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>(`/api/v1/simulation_attempts/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: simulationAttemptKeys.all }),
  });
}

export function useSimulationAttemptsByProfileId(id: string) {
  return useQuery<SimulationAttempt[]>({
    queryKey: simulationAttemptKeysByProfileId.one(id),
    queryFn: () => api<SimulationAttempt[]>(`/api/v1/simulation_attempts/by/profileId/${id}`),
    enabled: id !== undefined && id !== null && id !== "",
  });
}

export function useSimulationAttemptsByProfileIdBatch(ids: string[]) {
  return useQuery<SimulationAttempt[]>({
    queryKey: simulationAttemptKeysByProfileId.many(ids),
    queryFn: () => api<SimulationAttempt[]>(`/api/v1/simulation_attempts/by/profileId/batch`, { method: "POST", body: JSON.stringify({ ids }) }),
    enabled: Array.isArray(ids) && ids.length > 0,
  });
}

export function useSimulationAttemptsBySimulationId(id: string) {
  return useQuery<SimulationAttempt[]>({
    queryKey: simulationAttemptKeysBySimulationId.one(id),
    queryFn: () => api<SimulationAttempt[]>(`/api/v1/simulation_attempts/by/simulationId/${id}`),
    enabled: id !== undefined && id !== null && id !== "",
  });
}

export function useSimulationAttemptsBySimulationIdBatch(ids: string[]) {
  return useQuery<SimulationAttempt[]>({
    queryKey: simulationAttemptKeysBySimulationId.many(ids),
    queryFn: () => api<SimulationAttempt[]>(`/api/v1/simulation_attempts/by/simulationId/batch`, { method: "POST", body: JSON.stringify({ ids }) }),
    enabled: Array.isArray(ids) && ids.length > 0,
  });
}
