/**
 * Hook for unified rubric updates
 * Handles merging partial standard group updates into full rubric structure
 */

import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { rubricsDetailKeys } from "../keys";
import type {
  StandardGroupUpdate,
  UpdateRubricRequest,
} from "../schemas/rubrics";
import { useUpdateRubric } from "./rubrics";

interface RubricUpdateParams {
  rubricId: string;
  profileId: string;
  name: string;
  description: string;
  departmentId: string;
  active: boolean;
  defaultRubric: boolean;
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
        departmentId,
        active,
        defaultRubric,
        standardGroupUpdates,
      } = params;

      // Get current rubric detail from cache to merge with updates
      const currentDetail = queryClient.getQueryData(
        rubricsDetailKeys.detail(rubricId, profileId)
      ) as any;

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
        department_id: departmentId,
        active,
        default_rubric: defaultRubric,
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
