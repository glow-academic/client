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
  StandardGroupUpdate,
  UpdateRubricRequest,
  UpdateRubricResponseSchema,
} from "@/lib/api/v2/schemas/rubrics";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

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

interface RubricUpdateParams {
  rubricId: string;
  profileId: string;
  name: string;
  description: string;
  department_ids: string[] | null;
  active: boolean;
  standardGroupUpdates: StandardGroupUpdate[];
}

export function useRubricUnifiedUpdate() {
  const queryClient = useQueryClient();
  const updateRubricMutation = useUpdateRubric();

  const updateRubric = useCallback(
    async (params: RubricUpdateParams) => {
      const {
        rubricId,
        profileId,
        name,
        description,
        department_ids,
        active,
        standardGroupUpdates,
      } = params;

      // Get current rubric detail from cache to merge with updates
      const currentDetail = queryClient.getQueryData(
        rubricsDetailKeys.detail(rubricId, profileId)
      ) as ReturnType<typeof RubricDetailResponseSchema.parse> | undefined;

      if (!currentDetail) {
        throw new Error("Rubric detail not found in cache");
      }

      // Build complete standard groups array
      // Start with all existing groups from cache
      const allGroups: StandardGroupUpdate[] = [];

      // Add all existing groups that aren't being updated
      currentDetail.standard_group_ids?.forEach((groupId: string) => {
        const groupDetail = currentDetail.standard_groups_detail[groupId];
        const groupMapping = currentDetail.standard_groups_mapping[groupId];

        if (!groupDetail || !groupMapping) {
          return;
        }

        // Check if this group is in the updates
        const update = standardGroupUpdates.find((g) => g.id === groupId);

        if (update) {
          // Use the updated version
          allGroups.push(update);
        } else {
          // Keep existing group
          const standards = groupDetail.standard_ids.map(
            (standardId: string) => {
              const stdMapping = currentDetail.standards_mapping[standardId];
              if (!stdMapping) {
                throw new Error(`Standard mapping not found for ${standardId}`);
              }
              return {
                id: standardId,
                name: stdMapping.name,
                description: stdMapping.description,
                points: stdMapping.points,
                deleted: false,
              };
            }
          );

          allGroups.push({
            id: groupId,
            name: groupMapping.name,
            short_name: groupMapping.name.substring(0, 10).toUpperCase(),
            description: groupMapping.description,
            points: groupDetail.points,
            passPoints: groupDetail.passPoints,
            standards,
            deleted: false,
          });
        }
      });

      // Add any new groups (no ID)
      const newGroups = standardGroupUpdates.filter((g) => !g.id);
      allGroups.push(...newGroups);

      // Make the unified update request
      const request: UpdateRubricRequest = {
        rubricId,
        name,
        description,
        department_ids,
        active,
        standard_groups: allGroups,
      };

      const result = await updateRubricMutation.mutateAsync(request);

      // Invalidate the detail query to refetch with updated data
      queryClient.invalidateQueries({
        queryKey: rubricsDetailKeys.detail(rubricId, profileId),
      });

      return result;
    },
    [queryClient, updateRubricMutation]
  );

  return {
    updateRubric,
    isPending: updateRubricMutation.isPending,
    isError: updateRubricMutation.isError,
    error: updateRubricMutation.error,
  };
}
