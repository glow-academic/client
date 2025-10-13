/**
 * Rubrics hooks for v2 API
 * These hooks call client-side BFF routes at /api/v2/rubrics/*
 * which then proxy to the FastAPI server
 */

import { api } from "@/lib/api/fetcher";
import {
  rubricsDetailDefaultKeys,
  rubricsDetailKeys,
  rubricsListKeys,
} from "@/lib/api/v2/keys";
import {
  CreateRubricRequest,
  CreateRubricResponseSchema,
  DeleteRubricRequest,
  DeleteRubricResponseSchema,
  DuplicateRubricRequest,
  DuplicateRubricResponseSchema,
  RubricDetailResponseSchema,
  RubricsFilters,
  RubricsListResponseSchema,
  UpdateRubricRequest,
  UpdateRubricResponseSchema,
} from "@/lib/api/v2/schemas/rubrics";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

// Type for rubrics hook options
type RubricsHookOptions = {
  enabled?: boolean;
  staleTime?: number;
};

export function useRubricsList(
  filters: RubricsFilters,
  options: RubricsHookOptions | boolean = true
) {
  const queryOptions =
    typeof options === "boolean"
      ? { enabled: options }
      : { enabled: true, ...options };

  return useQuery({
    queryKey: rubricsListKeys.list(filters),
    ...queryOptions,
    queryFn: async () => {
      const res = await api<unknown>("/api/v2/rubrics/list", {
        method: "POST",
        body: JSON.stringify(filters),
      });
      return RubricsListResponseSchema.parse(res);
    },
  });
}

export function useRubricDetail(
  rubricId: string,
  profileId: string,
  options: RubricsHookOptions | boolean = true
) {
  const queryOptions =
    typeof options === "boolean"
      ? { enabled: options }
      : { enabled: true, ...options };

  return useQuery({
    queryKey: rubricsDetailKeys.detail(rubricId, profileId),
    ...queryOptions,
    queryFn: async () => {
      const res = await api<unknown>("/api/v2/rubrics/detail", {
        method: "POST",
        body: JSON.stringify({ rubricId, profileId }),
      });
      return RubricDetailResponseSchema.parse(res);
    },
    enabled: queryOptions.enabled && !!rubricId && !!profileId,
  });
}

export function useRubricDetailDefault(
  profileId: string,
  options: RubricsHookOptions | boolean = true
) {
  const queryOptions =
    typeof options === "boolean"
      ? { enabled: options }
      : { enabled: true, ...options };

  return useQuery({
    queryKey: rubricsDetailDefaultKeys.detail(profileId),
    ...queryOptions,
    queryFn: async () => {
      const res = await api<unknown>("/api/v2/rubrics/detail-default", {
        method: "POST",
        body: JSON.stringify({ profileId }),
      });
      return RubricDetailResponseSchema.parse(res);
    },
    enabled: queryOptions.enabled && !!profileId,
  });
}

export function useCreateRubric() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: CreateRubricRequest) => {
      const res = await api<unknown>("/api/v2/rubrics/create", {
        method: "POST",
        body: JSON.stringify(request),
      });
      return CreateRubricResponseSchema.parse(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === "string" && key.startsWith("rubrics:v2:list");
        },
      });
    },
  });
}

export function useUpdateRubric() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: UpdateRubricRequest) => {
      const res = await api<unknown>("/api/v2/rubrics/update", {
        method: "POST",
        body: JSON.stringify(request),
      });
      return UpdateRubricResponseSchema.parse(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return (
            (typeof key === "string" && key.startsWith("rubrics:v2:list")) ||
            (typeof key === "string" && key.startsWith("rubrics:v2:detail"))
          );
        },
      });
    },
  });
}

export function useDuplicateRubric() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: DuplicateRubricRequest) => {
      const res = await api<unknown>("/api/v2/rubrics/duplicate", {
        method: "POST",
        body: JSON.stringify(request),
      });
      return DuplicateRubricResponseSchema.parse(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === "string" && key.startsWith("rubrics:v2:list");
        },
      });
    },
  });
}

export function useDeleteRubric() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: DeleteRubricRequest) => {
      const res = await api<unknown>("/api/v2/rubrics/delete", {
        method: "POST",
        body: JSON.stringify(request),
      });
      return DeleteRubricResponseSchema.parse(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === "string" && key.startsWith("rubrics:v2:list");
        },
      });
    },
  });
}
