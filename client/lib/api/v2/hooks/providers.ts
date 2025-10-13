/**
 * Providers hooks for v2 API
 * These hooks call client-side BFF routes at /api/v2/providers/*
 * which then proxy to the FastAPI server
 */

import { api } from "@/lib/api/fetcher";
import {
  modelsDetailKeys,
  providersDetailKeys,
  providersListKeys,
} from "@/lib/api/v2/keys";
import {
  CreateModelRequest,
  CreateModelResponseSchema,
  CreateProviderRequest,
  CreateProviderResponseSchema,
  DeleteModelRequest,
  DeleteModelResponseSchema,
  DeleteProviderRequest,
  DeleteProviderResponseSchema,
  ModelDetailResponseSchema,
  ProviderDetailResponseSchema,
  ProvidersFilters,
  ProvidersListResponseSchema,
  UpdateModelRequest,
  UpdateModelResponseSchema,
  UpdateProviderRequest,
  UpdateProviderResponseSchema,
} from "@/lib/api/v2/schemas/providers";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

// Type for providers hook options
type ProvidersHookOptions = {
  enabled?: boolean;
  staleTime?: number;
};

// ============================================================================
// PROVIDER HOOKS
// ============================================================================

export function useProvidersList(
  filters: ProvidersFilters,
  options: ProvidersHookOptions | boolean = true
) {
  const queryOptions =
    typeof options === "boolean"
      ? { enabled: options }
      : { enabled: true, ...options };

  return useQuery({
    queryKey: providersListKeys.list(filters),
    ...queryOptions,
    queryFn: async () => {
      const res = await api<unknown>("/api/v2/providers/list", {
        method: "POST",
        body: JSON.stringify(filters),
      });
      return ProvidersListResponseSchema.parse(res);
    },
  });
}

export function useProviderDetail(
  providerId: string,
  profileId: string,
  options: ProvidersHookOptions | boolean = true
) {
  const queryOptions =
    typeof options === "boolean"
      ? { enabled: options }
      : { enabled: true, ...options };

  return useQuery({
    queryKey: providersDetailKeys.detail(providerId, profileId),
    ...queryOptions,
    queryFn: async () => {
      const res = await api<unknown>("/api/v2/providers/detail", {
        method: "POST",
        body: JSON.stringify({ providerId, profileId }),
      });
      return ProviderDetailResponseSchema.parse(res);
    },
    enabled: queryOptions.enabled && !!providerId && !!profileId,
  });
}

export function useCreateProvider() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: CreateProviderRequest) => {
      const res = await api<unknown>("/api/v2/providers/create", {
        method: "POST",
        body: JSON.stringify(request),
      });
      return CreateProviderResponseSchema.parse(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === "string" && key.startsWith("providers:v2:list");
        },
      });
    },
  });
}

export function useUpdateProvider() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: UpdateProviderRequest) => {
      const res = await api<unknown>("/api/v2/providers/update", {
        method: "POST",
        body: JSON.stringify(request),
      });
      return UpdateProviderResponseSchema.parse(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return (
            (typeof key === "string" && key.startsWith("providers:v2:list")) ||
            (typeof key === "string" && key.startsWith("providers:v2:detail"))
          );
        },
      });
    },
  });
}

export function useDeleteProvider() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: DeleteProviderRequest) => {
      const res = await api<unknown>("/api/v2/providers/delete", {
        method: "POST",
        body: JSON.stringify(request),
      });
      return DeleteProviderResponseSchema.parse(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === "string" && key.startsWith("providers:v2:list");
        },
      });
    },
  });
}

// ============================================================================
// MODEL HOOKS
// ============================================================================

export function useModelDetail(
  modelId: string,
  providerId: string,
  profileId: string,
  options: ProvidersHookOptions | boolean = true
) {
  const queryOptions =
    typeof options === "boolean"
      ? { enabled: options }
      : { enabled: true, ...options };

  return useQuery({
    queryKey: modelsDetailKeys.detail(modelId, providerId, profileId),
    ...queryOptions,
    queryFn: async () => {
      const res = await api<unknown>("/api/v2/providers/models/detail", {
        method: "POST",
        body: JSON.stringify({ modelId, providerId, profileId }),
      });
      return ModelDetailResponseSchema.parse(res);
    },
    enabled: queryOptions.enabled && !!modelId && !!providerId && !!profileId,
  });
}

export function useCreateModel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: CreateModelRequest) => {
      const res = await api<unknown>("/api/v2/providers/models/create", {
        method: "POST",
        body: JSON.stringify(request),
      });
      return CreateModelResponseSchema.parse(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === "string" && key.startsWith("providers:v2:list");
        },
      });
    },
  });
}

export function useUpdateModel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: UpdateModelRequest) => {
      const res = await api<unknown>("/api/v2/providers/models/update", {
        method: "POST",
        body: JSON.stringify(request),
      });
      return UpdateModelResponseSchema.parse(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return (
            (typeof key === "string" && key.startsWith("providers:v2:list")) ||
            (typeof key === "string" && key.startsWith("models:v2:detail"))
          );
        },
      });
    },
  });
}

export function useDeleteModel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: DeleteModelRequest) => {
      const res = await api<unknown>("/api/v2/providers/models/delete", {
        method: "POST",
        body: JSON.stringify(request),
      });
      return DeleteModelResponseSchema.parse(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === "string" && key.startsWith("providers:v2:list");
        },
      });
    },
  });
}
