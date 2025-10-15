/**
 * Scenarios hooks for v2 API
 * These hooks call client-side BFF routes at /api/v2/scenarios/*
 * which then proxy to the FastAPI server
 */

import { api } from "@/lib/api/fetcher";
import {
  scenariosDetailDefaultKeys,
  scenariosDetailKeys,
  scenariosListKeys,
} from "@/lib/api/v2/keys";
import {
  CreateScenarioRequest,
  CreateScenarioResponseSchema,
  DeleteScenarioRequest,
  DeleteScenarioResponseSchema,
  DuplicateScenarioRequest,
  DuplicateScenarioResponseSchema,
  GenerateScenarioAIRequest,
  GenerateScenarioAIResponseSchema,
  RandomizeScenarioRequest,
  RandomizeScenarioResponseSchema,
  ScenarioDetailResponseSchema,
  ScenariosFilters,
  ScenariosListResponseSchema,
  UpdateScenarioRequest,
  UpdateScenarioResponseSchema,
} from "@/lib/api/v2/schemas/scenarios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

// Type for scenarios hook options
type ScenariosHookOptions = {
  enabled?: boolean;
  staleTime?: number;
};

export function useScenariosList(
  filters: ScenariosFilters,
  options: ScenariosHookOptions | boolean = true
) {
  const queryOptions =
    typeof options === "boolean"
      ? { enabled: options }
      : { enabled: true, ...options };

  return useQuery({
    queryKey: scenariosListKeys.list(filters),
    ...queryOptions,
    queryFn: async () => {
      const res = await api<unknown>("/api/v2/scenarios/list", {
        method: "POST",
        body: JSON.stringify(filters),
      });
      return ScenariosListResponseSchema.parse(res);
    },
  });
}

export function useScenarioDetail(
  scenarioId: string,
  profileId: string,
  options: ScenariosHookOptions | boolean = true
) {
  const queryOptions =
    typeof options === "boolean"
      ? { enabled: options }
      : { enabled: true, ...options };

  return useQuery({
    queryKey: scenariosDetailKeys.detail(scenarioId, profileId),
    ...queryOptions,
    queryFn: async () => {
      const res = await api<unknown>("/api/v2/scenarios/detail", {
        method: "POST",
        body: JSON.stringify({ scenarioId, profileId }),
      });
      return ScenarioDetailResponseSchema.parse(res);
    },
    enabled: queryOptions.enabled && !!scenarioId && !!profileId,
  });
}

export function useScenarioDetailDefault(
  profileId: string,
  options: ScenariosHookOptions | boolean = true
) {
  const queryOptions =
    typeof options === "boolean"
      ? { enabled: options }
      : { enabled: true, ...options };

  return useQuery({
    queryKey: scenariosDetailDefaultKeys.detail(profileId),
    ...queryOptions,
    queryFn: async () => {
      const res = await api<unknown>("/api/v2/scenarios/detail-default", {
        method: "POST",
        body: JSON.stringify({ profileId }),
      });
      return ScenarioDetailResponseSchema.parse(res);
    },
    enabled: queryOptions.enabled && !!profileId,
  });
}

export function useCreateScenario() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: CreateScenarioRequest) => {
      const res = await api<unknown>("/api/v2/scenarios/create", {
        method: "POST",
        body: JSON.stringify(request),
      });
      return CreateScenarioResponseSchema.parse(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === "string" && key.startsWith("scenarios:v2:list");
        },
      });
    },
  });
}

export function useUpdateScenario() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: UpdateScenarioRequest) => {
      const res = await api<unknown>("/api/v2/scenarios/update", {
        method: "POST",
        body: JSON.stringify(request),
      });
      return UpdateScenarioResponseSchema.parse(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return (
            (typeof key === "string" && key.startsWith("scenarios:v2:list")) ||
            (typeof key === "string" && key.startsWith("scenarios:v2:detail"))
          );
        },
      });
    },
  });
}

export function useDuplicateScenario() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: DuplicateScenarioRequest) => {
      const res = await api<unknown>("/api/v2/scenarios/duplicate", {
        method: "POST",
        body: JSON.stringify(request),
      });
      return DuplicateScenarioResponseSchema.parse(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === "string" && key.startsWith("scenarios:v2:list");
        },
      });
    },
  });
}

export function useDeleteScenario() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: DeleteScenarioRequest) => {
      const res = await api<unknown>("/api/v2/scenarios/delete", {
        method: "POST",
        body: JSON.stringify(request),
      });
      return DeleteScenarioResponseSchema.parse(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === "string" && key.startsWith("scenarios:v2:list");
        },
      });
    },
  });
}

export function useGenerateScenarioAI() {
  return useMutation({
    mutationFn: async (request: GenerateScenarioAIRequest) => {
      const res = await api<unknown>("/api/v2/scenarios/generate-ai", {
        method: "POST",
        body: JSON.stringify(request),
      });
      return GenerateScenarioAIResponseSchema.parse(res);
    },
  });
}

export function useRandomizeScenario() {
  return useMutation({
    mutationFn: async (request: RandomizeScenarioRequest) => {
      const res = await api<unknown>("/api/v2/scenarios/randomize", {
        method: "POST",
        body: JSON.stringify(request),
      });
      return RandomizeScenarioResponseSchema.parse(res);
    },
  });
}
