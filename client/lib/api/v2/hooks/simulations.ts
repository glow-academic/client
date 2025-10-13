/**
 * Simulations hooks for v2 API
 * These hooks call client-side BFF routes at /api/v2/simulations/*
 * which then proxy to the FastAPI server
 */

import { api } from "@/lib/api/fetcher";
import {
  simulationsDetailDefaultKeys,
  simulationsDetailKeys,
  simulationsListKeys,
} from "@/lib/api/v2/keys";
import {
  CreateSimulationRequest,
  CreateSimulationResponseSchema,
  DeleteSimulationRequest,
  DeleteSimulationResponseSchema,
  DuplicateSimulationRequest,
  DuplicateSimulationResponseSchema,
  SimulationDetailResponseSchema,
  SimulationsFilters,
  SimulationsListResponseSchema,
  UpdateSimulationRequest,
  UpdateSimulationResponseSchema,
} from "@/lib/api/v2/schemas/simulations";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

// Type for simulations hook options
type SimulationsHookOptions = {
  enabled?: boolean;
  staleTime?: number;
};

export function useSimulationsList(
  filters: SimulationsFilters,
  options: SimulationsHookOptions | boolean = true
) {
  const queryOptions =
    typeof options === "boolean"
      ? { enabled: options }
      : { enabled: true, ...options };

  return useQuery({
    queryKey: simulationsListKeys.list(filters),
    ...queryOptions,
    queryFn: async () => {
      const res = await api<unknown>("/api/v2/simulations/list", {
        method: "POST",
        body: JSON.stringify(filters),
      });
      return SimulationsListResponseSchema.parse(res);
    },
  });
}

export function useSimulationDetail(
  simulationId: string,
  profileId: string,
  options: SimulationsHookOptions | boolean = true
) {
  const queryOptions =
    typeof options === "boolean"
      ? { enabled: options }
      : { enabled: true, ...options };

  return useQuery({
    queryKey: simulationsDetailKeys.detail(simulationId, profileId),
    ...queryOptions,
    queryFn: async () => {
      const res = await api<unknown>("/api/v2/simulations/detail", {
        method: "POST",
        body: JSON.stringify({ simulationId, profileId }),
      });
      return SimulationDetailResponseSchema.parse(res);
    },
    enabled: queryOptions.enabled && !!simulationId && !!profileId,
  });
}

export function useSimulationDetailDefault(
  profileId: string,
  options: SimulationsHookOptions | boolean = true
) {
  const queryOptions =
    typeof options === "boolean"
      ? { enabled: options }
      : { enabled: true, ...options };

  return useQuery({
    queryKey: simulationsDetailDefaultKeys.detail(profileId),
    ...queryOptions,
    queryFn: async () => {
      const res = await api<unknown>("/api/v2/simulations/detail-default", {
        method: "POST",
        body: JSON.stringify({ profileId }),
      });
      return SimulationDetailResponseSchema.parse(res);
    },
    enabled: queryOptions.enabled && !!profileId,
  });
}

export function useCreateSimulation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: CreateSimulationRequest) => {
      const res = await api<unknown>("/api/v2/simulations/create", {
        method: "POST",
        body: JSON.stringify(request),
      });
      return CreateSimulationResponseSchema.parse(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return (
            typeof key === "string" && key.startsWith("simulations:v2:list")
          );
        },
      });
    },
  });
}

export function useUpdateSimulation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: UpdateSimulationRequest) => {
      const res = await api<unknown>("/api/v2/simulations/update", {
        method: "POST",
        body: JSON.stringify(request),
      });
      return UpdateSimulationResponseSchema.parse(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return (
            (typeof key === "string" &&
              key.startsWith("simulations:v2:list")) ||
            (typeof key === "string" && key.startsWith("simulations:v2:detail"))
          );
        },
      });
    },
  });
}

export function useDuplicateSimulation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: DuplicateSimulationRequest) => {
      const res = await api<unknown>("/api/v2/simulations/duplicate", {
        method: "POST",
        body: JSON.stringify(request),
      });
      return DuplicateSimulationResponseSchema.parse(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return (
            typeof key === "string" && key.startsWith("simulations:v2:list")
          );
        },
      });
    },
  });
}

export function useDeleteSimulation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: DeleteSimulationRequest) => {
      const res = await api<unknown>("/api/v2/simulations/delete", {
        method: "POST",
        body: JSON.stringify(request),
      });
      return DeleteSimulationResponseSchema.parse(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return (
            typeof key === "string" && key.startsWith("simulations:v2:list")
          );
        },
      });
    },
  });
}
