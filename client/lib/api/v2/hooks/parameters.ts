/**
 * Parameters hooks for v2 API
 * These hooks call client-side BFF routes at /api/v2/parameters/*
 * which then proxy to the FastAPI server
 */

import { api } from "@/lib/api/v2/fetcher";
import {
  parametersDetailDefaultKeys,
  parametersDetailKeys,
  parametersListKeys,
} from "@/lib/api/v2/keys";
import {
  CreateParameterItemRequest,
  CreateParameterItemResponseSchema,
  CreateParameterRequest,
  CreateParameterResponseSchema,
  DeleteParameterRequest,
  DeleteParameterResponseSchema,
  DuplicateParameterRequest,
  DuplicateParameterResponseSchema,
  ParameterDetailResponseSchema,
  ParametersFilters,
  ParametersListResponseSchema,
  UpdateParameterRequest,
  UpdateParameterResponseSchema,
} from "@/lib/api/v2/schemas/parameters";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

// Type for parameters hook options
type ParametersHookOptions = {
  enabled?: boolean;
  staleTime?: number;
};

export function useParametersList(
  filters: ParametersFilters,
  options: ParametersHookOptions | boolean = true
) {
  const queryOptions =
    typeof options === "boolean"
      ? { enabled: options }
      : { enabled: true, ...options };

  return useQuery({
    queryKey: parametersListKeys.list(filters),
    ...queryOptions,
    queryFn: async () => {
      const res = await api<unknown>("/api/v2/parameters/list", {
        method: "POST",
        body: JSON.stringify(filters),
      });
      return ParametersListResponseSchema.parse(res);
    },
  });
}

export function useParameterDetail(
  parameterId: string,
  profileId: string,
  options: ParametersHookOptions | boolean = true
) {
  const queryOptions =
    typeof options === "boolean"
      ? { enabled: options }
      : { enabled: true, ...options };

  return useQuery({
    queryKey: parametersDetailKeys.detail(parameterId, profileId),
    ...queryOptions,
    queryFn: async () => {
      const res = await api<unknown>("/api/v2/parameters/detail", {
        method: "POST",
        body: JSON.stringify({ parameterId, profileId }),
      });
      return ParameterDetailResponseSchema.parse(res);
    },
    enabled: queryOptions.enabled && !!parameterId && !!profileId,
  });
}

export function useParameterDetailDefault(
  profileId: string,
  options: ParametersHookOptions | boolean = true
) {
  const queryOptions =
    typeof options === "boolean"
      ? { enabled: options }
      : { enabled: true, ...options };

  return useQuery({
    queryKey: parametersDetailDefaultKeys.detail(profileId),
    ...queryOptions,
    queryFn: async () => {
      const res = await api<unknown>("/api/v2/parameters/detail-default", {
        method: "POST",
        body: JSON.stringify({ profileId }),
      });
      return ParameterDetailResponseSchema.parse(res);
    },
    enabled: queryOptions.enabled && !!profileId,
  });
}

export function useCreateParameter() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: CreateParameterRequest) => {
      const res = await api<unknown>("/api/v2/parameters/create", {
        method: "POST",
        body: JSON.stringify(request),
      });
      return CreateParameterResponseSchema.parse(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return (
            typeof key === "string" && key.startsWith("parameters:v2:list")
          );
        },
      });
    },
  });
}

export function useUpdateParameter() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: UpdateParameterRequest) => {
      const res = await api<unknown>("/api/v2/parameters/update", {
        method: "POST",
        body: JSON.stringify(request),
      });
      return UpdateParameterResponseSchema.parse(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return (
            (typeof key === "string" && key.startsWith("parameters:v2:list")) ||
            (typeof key === "string" && key.startsWith("parameters:v2:detail"))
          );
        },
      });
    },
  });
}

export function useDuplicateParameter() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: DuplicateParameterRequest) => {
      const res = await api<unknown>("/api/v2/parameters/duplicate", {
        method: "POST",
        body: JSON.stringify(request),
      });
      return DuplicateParameterResponseSchema.parse(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return (
            typeof key === "string" && key.startsWith("parameters:v2:list")
          );
        },
      });
    },
  });
}

export function useDeleteParameter() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: DeleteParameterRequest) => {
      const res = await api<unknown>("/api/v2/parameters/delete", {
        method: "POST",
        body: JSON.stringify(request),
      });
      return DeleteParameterResponseSchema.parse(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return (
            typeof key === "string" && key.startsWith("parameters:v2:list")
          );
        },
      });
    },
  });
}

// ============================================================================
// PARAMETER ITEM CREATION (for inline creation from pickers)
// ============================================================================

export function useCreateParameterItemV2() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: CreateParameterItemRequest) => {
      const res = await api<unknown>("/api/v2/parameters/items/create", {
        method: "POST",
        body: JSON.stringify(request),
      });
      return CreateParameterItemResponseSchema.parse(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return (
            (typeof key === "string" &&
              key.startsWith("parameters:v2:detail")) ||
            (typeof key === "string" && key.startsWith("scenarios:v2:detail"))
          );
        },
      });
    },
  });
}
