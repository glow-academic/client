/**
 * Cohorts hooks for v2 API
 * These hooks call client-side BFF routes at /api/v2/cohorts/*
 * which then proxy to the FastAPI server
 */

import { api } from "@/lib/api/v2/fetcher";
import {
  cohortsDetailDefaultKeys,
  cohortsDetailKeys,
  cohortsListKeys,
} from "@/lib/api/v2/keys";
import {
  AddProfilesToCohortRequest,
  AddProfilesToCohortResponseSchema,
  CohortDetailResponseSchema,
  CohortDetailWithProfilesRequest,
  CohortDetailWithProfilesResponseSchema,
  CohortsFilters,
  CohortsListResponseSchema,
  CreateCohortRequest,
  CreateCohortResponseSchema,
  DeleteCohortRequest,
  DeleteCohortResponseSchema,
  DuplicateCohortRequest,
  DuplicateCohortResponseSchema,
  LeaveCohortRequest,
  LeaveCohortResponseSchema,
  RemoveProfilesFromCohortRequest,
  RemoveProfilesFromCohortResponseSchema,
  UpdateCohortRequest,
  UpdateCohortResponseSchema,
} from "@/lib/api/v2/schemas/cohorts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

// Type for cohorts hook options
type CohortsHookOptions = {
  enabled?: boolean;
  staleTime?: number;
};

export function useCohortsList(
  filters: CohortsFilters,
  options: CohortsHookOptions | boolean = true
) {
  const queryOptions =
    typeof options === "boolean"
      ? { enabled: options }
      : { enabled: true, ...options };

  return useQuery({
    queryKey: cohortsListKeys.list(filters),
    ...queryOptions,
    queryFn: async () => {
      const res = await api<unknown>("/api/v2/cohorts/list", {
        method: "POST",
        body: JSON.stringify(filters),
      });
      return CohortsListResponseSchema.parse(res);
    },
  });
}

export function useCohortDetail(
  cohortId: string,
  profileId: string,
  options: CohortsHookOptions | boolean = true
) {
  const queryOptions =
    typeof options === "boolean"
      ? { enabled: options }
      : { enabled: true, ...options };

  return useQuery({
    queryKey: cohortsDetailKeys.detail(cohortId, profileId),
    ...queryOptions,
    queryFn: async () => {
      const res = await api<unknown>("/api/v2/cohorts/detail", {
        method: "POST",
        body: JSON.stringify({ cohortId, profileId }),
      });
      return CohortDetailResponseSchema.parse(res);
    },
    enabled: queryOptions.enabled && !!cohortId && !!profileId,
  });
}

export function useCohortDetailDefault(
  profileId: string,
  options: CohortsHookOptions | boolean = true
) {
  const queryOptions =
    typeof options === "boolean"
      ? { enabled: options }
      : { enabled: true, ...options };

  return useQuery({
    queryKey: cohortsDetailDefaultKeys.detail(profileId),
    ...queryOptions,
    queryFn: async () => {
      const res = await api<unknown>("/api/v2/cohorts/detail-default", {
        method: "POST",
        body: JSON.stringify({ profileId }),
      });
      return CohortDetailResponseSchema.parse(res);
    },
    enabled: queryOptions.enabled && !!profileId,
  });
}

export function useCohortDetailWithProfiles(
  request: CohortDetailWithProfilesRequest,
  options: CohortsHookOptions | boolean = true
) {
  const queryOptions =
    typeof options === "boolean"
      ? { enabled: options }
      : { enabled: true, ...options };

  return useQuery({
    queryKey: [
      "cohorts:v2:detail-with-profiles",
      request.cohortId,
      request.departmentIds,
      request.currentProfileId,
    ],
    ...queryOptions,
    queryFn: async () => {
      const res = await api<unknown>("/api/v2/cohorts/detail-with-profiles", {
        method: "POST",
        body: JSON.stringify(request),
      });
      return CohortDetailWithProfilesResponseSchema.parse(res);
    },
    enabled:
      queryOptions.enabled &&
      !!request.cohortId &&
      !!request.currentProfileId &&
      request.departmentIds.length > 0,
  });
}

export function useCreateCohort() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: CreateCohortRequest) => {
      const res = await api<unknown>("/api/v2/cohorts/create", {
        method: "POST",
        body: JSON.stringify(request),
      });
      return CreateCohortResponseSchema.parse(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === "string" && key.startsWith("cohorts:v2:list");
        },
      });
    },
  });
}

export function useUpdateCohort() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: UpdateCohortRequest) => {
      const res = await api<unknown>("/api/v2/cohorts/update", {
        method: "POST",
        body: JSON.stringify(request),
      });
      return UpdateCohortResponseSchema.parse(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return (
            (typeof key === "string" && key.startsWith("cohorts:v2:list")) ||
            (typeof key === "string" && key.startsWith("cohorts:v2:detail"))
          );
        },
      });
    },
  });
}

export function useDuplicateCohort() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: DuplicateCohortRequest) => {
      const res = await api<unknown>("/api/v2/cohorts/duplicate", {
        method: "POST",
        body: JSON.stringify(request),
      });
      return DuplicateCohortResponseSchema.parse(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === "string" && key.startsWith("cohorts:v2:list");
        },
      });
    },
  });
}

export function useDeleteCohort() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: DeleteCohortRequest) => {
      const res = await api<unknown>("/api/v2/cohorts/delete", {
        method: "POST",
        body: JSON.stringify(request),
      });
      return DeleteCohortResponseSchema.parse(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === "string" && key.startsWith("cohorts:v2:list");
        },
      });
    },
  });
}

export function useLeaveCohort() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: LeaveCohortRequest) => {
      const res = await api<unknown>("/api/v2/cohorts/leave", {
        method: "POST",
        body: JSON.stringify(request),
      });
      return LeaveCohortResponseSchema.parse(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === "string" && key.startsWith("cohorts:v2:list");
        },
      });
    },
  });
}

export function useAddProfilesToCohort() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: AddProfilesToCohortRequest) => {
      const res = await api<unknown>("/api/v2/cohorts/add-profiles", {
        method: "POST",
        body: JSON.stringify(request),
      });
      return AddProfilesToCohortResponseSchema.parse(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return (
            (typeof key === "string" && key.startsWith("cohorts:v2:list")) ||
            (typeof key === "string" && key.startsWith("cohorts:v2:detail")) ||
            (typeof key === "string" && key.startsWith("profile:v2:list"))
          );
        },
      });
    },
  });
}

export function useRemoveProfilesFromCohort() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: RemoveProfilesFromCohortRequest) => {
      const res = await api<unknown>("/api/v2/cohorts/remove-profiles", {
        method: "POST",
        body: JSON.stringify(request),
      });
      return RemoveProfilesFromCohortResponseSchema.parse(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return (
            (typeof key === "string" && key.startsWith("cohorts:v2:list")) ||
            (typeof key === "string" && key.startsWith("cohorts:v2:detail")) ||
            (typeof key === "string" && key.startsWith("profile:v2:list"))
          );
        },
      });
    },
  });
}
