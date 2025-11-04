/**
 * RubricDetails.tsx
 * Used to display the details for the rubric page in edit mode.
 * @AshokSaravanan222 & @siladiea
 * 06/07/2025
 */

import { useState } from "react";
import { toast } from "sonner";

import { DepartmentPicker } from "@/components/common/forms/DepartmentPicker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api/client";
import { keys } from "@/lib/query/keys";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Edit, Power } from "lucide-react";
import { useRouter } from "next/navigation";

type RubricItem = {
  rubric_id: string;
  name: string;
  description: string;
  department_ids: string[] | null;
  points: number;
  passPoints: number;
  can_edit: boolean;
  can_delete: boolean;
  can_duplicate: boolean;
  standard_groups: Record<string, string[]>;
};

export interface RubricDetailsProps {
  rubric: RubricItem;
  rubricId: string;
  departmentMapping: Record<string, { name: string; description: string }>;
  validDepartmentIds: string[];
  isCreateMode?: boolean;
  isReadonly?: boolean;
  profileId?: string; // Required for v2 unified update
}

export default function RubricDetails({
  rubric,
  rubricId,
  departmentMapping,
  validDepartmentIds,
  isCreateMode = false,
  isReadonly = false,
  profileId,
}: RubricDetailsProps) {
  const [isEditing, setIsEditing] = useState(isCreateMode);
  const router = useRouter();
  const queryClient = useQueryClient();

  // V3 mutation hooks
  const createRubricMutation = useMutation({
    mutationFn: (request: {
      name: string;
      description: string;
      department_ids: string[];
      active: boolean;
      points: number;
      passPoints: number;
      standard_groups: Array<{
        name: string;
        short_name?: string;
        description?: string;
        points: number;
        passPoints: number;
        standards: Array<{
          name: string;
          description?: string;
          points: number;
        }>;
      }>;
    }) => api.post("/rubrics/create", { body: request }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.rubrics.all });
    },
  });

  // Unified update helper - merges updates with existing data
  const updateRubricUnified = async (params: {
    rubricId: string;
    profileId: string;
    name: string;
    description: string;
    department_ids: string[] | null;
    active: boolean;
    standardGroupUpdates: Array<{
      id?: string;
      name: string;
      short_name: string;
      description: string;
      points: number;
      passPoints: number;
      standards: Array<{
        id?: string;
        name: string;
        description: string;
        points: number;
        deleted: boolean;
      }>;
      deleted: boolean;
    }>;
  }) => {
    // Get current rubric detail from cache or fetch
    const currentDetail = queryClient.getQueryData<{
      name: string;
      description: string;
      department_ids: string[] | null;
      points: number;
      passPoints: number;
      active: boolean;
      standard_group_ids: string[];
      standard_groups_detail: Record<
        string,
        { points: number; passPoints: number; standard_ids: string[] }
      >;
      standard_groups_mapping: Record<
        string,
        { name: string; description: string }
      >;
      standards_mapping: Record<
        string,
        { name: string; description: string; points: number }
      >;
    }>(
      keys.rubrics.with({
        rubricId: params.rubricId,
        profileId: params.profileId,
      })
    );

    if (!currentDetail) {
      // Fetch if not in cache
      const fetched = await api.post("/rubrics/detail", {
        body: {
          rubricId: params.rubricId,
          profileId: params.profileId,
        },
      });
      // Build complete standard groups array
      const allGroups: Array<{
        name: string;
        short_name?: string;
        description?: string;
        points: number;
        passPoints: number;
        standards: Array<{
          name: string;
          description?: string;
          points: number;
        }>;
      }> = [];

      // Add all existing groups that aren't being updated
      fetched.standard_group_ids?.forEach((groupId) => {
        const groupDetail = fetched.standard_groups_detail[groupId];
        const groupMapping = fetched.standard_groups_mapping[groupId];

        if (!groupDetail || !groupMapping) return;

        // Check if this group is in the updates
        const update = params.standardGroupUpdates.find(
          (g) => g.id === groupId && !g.deleted
        );

        if (!update) {
          // Keep existing group
          const standards = groupDetail.standard_ids
            .map((standardId) => {
              const stdMapping = fetched.standards_mapping[standardId];
              if (!stdMapping) {
                throw new Error(`Standard mapping not found for ${standardId}`);
              }
              const name = stdMapping["name"];
              const points = stdMapping["points"];
              if (!name || typeof points !== "number") {
                return null;
              }
              const desc = stdMapping["description"];
              const result: {
                name: string;
                description?: string;
                points: number;
              } = {
                name,
                points,
              };
              if (desc) {
                result.description = desc;
              }
              return result;
            })
            .filter(
              (
                s
              ): s is { name: string; description?: string; points: number } =>
                s !== null
            );

          const groupName = groupMapping["name"];
          const groupDesc = groupMapping["description"];
          if (groupName) {
            allGroups.push({
              name: groupName,
              short_name: groupName.substring(0, 10).toUpperCase(),
              ...(groupDesc ? { description: groupDesc } : {}),
              points: groupDetail["points"],
              passPoints: groupDetail["passPoints"],
              standards,
            });
          }
        }
      });

      // Add updated/new groups
      params.standardGroupUpdates.forEach((update) => {
        if (update.deleted) return;
        const standards = update.standards
          .filter((s) => !s.deleted)
          .map((s) => {
            const desc = s.description;
            return {
              name: s.name,
              ...(desc ? { description: desc } : {}),
              points: s.points,
            };
          });
        allGroups.push({
          name: update.name,
          ...(update.short_name ? { short_name: update.short_name } : {}),
          ...(update.description ? { description: update.description } : {}),
          points: update.points,
          passPoints: update.passPoints,
          standards,
        });
      });

      // Calculate total points
      const totalPoints = allGroups.reduce((sum, g) => sum + g.points, 0);
      const totalPassPoints = allGroups.reduce(
        (sum, g) => sum + g.passPoints,
        0
      );

      // Make the update request
      const response = await api.post("/rubrics/update", {
        body: {
          rubricId: params.rubricId,
          name: params.name,
          description: params.description,
          active: params.active,
          points: totalPoints,
          passPoints: totalPassPoints,
          department_ids: params.department_ids || [],
          standard_groups: allGroups,
        },
      });

      // Invalidate the detail query
      queryClient.invalidateQueries({
        queryKey: keys.rubrics.with({
          rubricId: params.rubricId,
          profileId: params.profileId,
        }),
      });

      return { ...response, points: totalPoints, passPoints: totalPassPoints };
    }

    // Build complete standard groups array from cached data
    const allGroups: Array<{
      name: string;
      short_name?: string;
      description?: string;
      points: number;
      passPoints: number;
      standards: Array<{
        name: string;
        description?: string;
        points: number;
      }>;
    }> = [];

    // Add all existing groups that aren't being updated
    currentDetail.standard_group_ids?.forEach((groupId) => {
      const groupDetail = currentDetail.standard_groups_detail[groupId];
      const groupMapping = currentDetail.standard_groups_mapping[groupId];

      if (!groupDetail || !groupMapping) return;

      // Check if this group is in the updates
      const update = params.standardGroupUpdates.find(
        (g) => g.id === groupId && !g.deleted
      );

      if (!update) {
        // Keep existing group
        const standards = groupDetail.standard_ids.map((standardId) => {
          const stdMapping = currentDetail.standards_mapping[standardId];
          if (!stdMapping) {
            throw new Error(`Standard mapping not found for ${standardId}`);
          }
          const desc = stdMapping["description"];
          return {
            name: stdMapping["name"],
            ...(desc ? { description: desc } : {}),
            points: stdMapping["points"],
          };
        });

        const groupName = groupMapping["name"];
        const groupDesc = groupMapping["description"];
        if (groupName) {
          allGroups.push({
            name: groupName,
            short_name: groupName.substring(0, 10).toUpperCase(),
            ...(groupDesc ? { description: groupDesc } : {}),
            points: groupDetail["points"],
            passPoints: groupDetail["passPoints"],
            standards,
          });
        }
      }
    });

    // Add updated/new groups
    params.standardGroupUpdates.forEach((update) => {
      if (update.deleted) return;
      const standards = update.standards
        .filter((s) => !s.deleted)
        .map((s) => {
          const result: { name: string; description?: string; points: number } =
            {
              name: s.name,
              points: s.points,
            };
          if (s.description) {
            result.description = s.description;
          }
          return result;
        });
      const groupObj: {
        name: string;
        short_name?: string;
        description?: string;
        points: number;
        passPoints: number;
        standards: Array<{
          name: string;
          description?: string;
          points: number;
        }>;
      } = {
        name: update.name,
        points: update.points,
        passPoints: update.passPoints,
        standards,
      };
      if (update.short_name) {
        groupObj.short_name = update.short_name;
      }
      if (update.description) {
        groupObj.description = update.description;
      }
      allGroups.push(groupObj);
    });

    // Calculate total points
    const totalPoints = allGroups.reduce((sum, g) => sum + g.points, 0);
    const totalPassPoints = allGroups.reduce((sum, g) => sum + g.passPoints, 0);

    // Make the update request
    const response = await api.post("/rubrics/update", {
      body: {
        rubricId: params.rubricId,
        name: params.name,
        description: params.description,
        active: params.active,
        points: totalPoints,
        passPoints: totalPassPoints,
        department_ids: params.department_ids || [],
        standard_groups: allGroups,
      },
    });

    // Invalidate the detail query
    queryClient.invalidateQueries({
      queryKey: keys.rubrics.with({
        rubricId: params.rubricId,
        profileId: params.profileId,
      }),
    });

    return { ...response, points: totalPoints, passPoints: totalPassPoints };
  };

  const updateRubricMutation = useMutation({
    mutationFn: updateRubricUnified,
  });

  const isUpdating = updateRubricMutation.isPending;
  const [formData, setFormData] = useState({
    name: rubric.name || "",
    description: rubric.description || "",
    departmentIds: rubric.department_ids || [],
    active: true,
  });

  const handleInputChange = (
    field: keyof typeof formData,
    value: string | boolean
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleDepartmentChange = (departmentIds: string[]) => {
    setFormData((prev) => ({ ...prev, departmentIds }));
  };

  const handleSave = async () => {
    try {
      if (isCreateMode) {
        // V3 create with empty standard_groups (will be added later)
        const data = await createRubricMutation.mutateAsync({
          name: formData.name,
          description: formData.description,
          department_ids: formData.departmentIds,
          active: formData.active,
          points: 0, // Will be calculated when standard groups are added
          passPoints: 0,
          standard_groups: [], // Start with no standard groups
        });

        if (data && data.rubricId) {
          toast.success("Rubric created successfully");
          // Redirect to the newly created rubric for editing
          router.push(`/management/rubrics/r/${data.rubricId}`);
        }
      } else {
        // V3 unified update - only update metadata, preserve standard groups
        if (!profileId) {
          toast.error("Profile ID is required for updates");
          return;
        }

        const result = await updateRubricMutation.mutateAsync({
          rubricId,
          profileId,
          name: formData.name,
          description: formData.description,
          department_ids: formData.departmentIds,
          active: formData.active,
          standardGroupUpdates: [], // No changes to standard groups, just metadata
        });

        toast.success(
          `Rubric updated successfully. Total points: ${result.points}`
        );
        setIsEditing(false);
      }
    } catch {
      toast.error(
        isCreateMode ? "Failed to create rubric" : "Failed to update rubric"
      );
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setFormData({
      name: rubric.name,
      description: rubric.description,
      active: true,
      departmentIds: rubric.department_ids || [],
    });
  };

  const content = (
    <div className="flex-1 flex flex-col gap-4">
      {isEditing ? (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleInputChange("name", e.target.value)}
              className="text-2xl font-bold"
              placeholder="Rubric Name"
              disabled={
                createRubricMutation.isPending || isUpdating || isReadonly
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange("description", e.target.value)}
              placeholder="Rubric Description"
              disabled={
                createRubricMutation.isPending || isUpdating || isReadonly
              }
            />
          </div>

          {/* Department Selection */}
          <div className="space-y-2">
            <Label htmlFor="department">Department</Label>
            <DepartmentPicker
              mapping={departmentMapping}
              validIds={validDepartmentIds}
              selectedIds={formData.departmentIds || []}
              onSelect={handleDepartmentChange}
              placeholder="All Departments"
              disabled={
                createRubricMutation.isPending || isUpdating || isReadonly
              }
              multiSelect={true}
            />
          </div>

          {/* Active Switch */}
          <div className="space-y-2 pt-2">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Label
                  htmlFor="active"
                  className="text-sm flex items-center gap-1.5"
                >
                  <Power className="h-3.5 w-3.5 text-muted-foreground" />
                  Active
                </Label>
                <Switch
                  id="active"
                  checked={formData.active}
                  onCheckedChange={(checked) =>
                    handleInputChange("active", checked)
                  }
                  disabled={
                    createRubricMutation.isPending || isUpdating || isReadonly
                  }
                />
              </div>
              <p className="text-xs text-muted-foreground pl-5">
                Inactive rubrics will not be available for simulations
              </p>
            </div>
          </div>
          {!isCreateMode && (
            <div className="p-3 bg-muted/20 rounded-lg border">
              <h4 className="text-sm font-medium mb-2">Points Calculation</h4>
              <p className="text-xs text-muted-foreground mb-2">
                Points are automatically calculated from standard groups and
                cannot be edited directly.
              </p>
              <div className="flex gap-2">
                <Badge variant="outline">Total: {rubric.points} points</Badge>
                <Badge variant="outline">
                  Pass: {rubric.passPoints} points
                </Badge>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div>
          <h1 className="text-2xl font-bold">
            {isCreateMode ? "Create New Rubric" : rubric.name}
          </h1>
          <p className="text-muted-foreground mt-2">
            {isCreateMode
              ? "Define the basic information for this evaluation rubric. You'll be able to add standard groups after creation."
              : rubric.description}
          </p>
          {!isCreateMode && (
            <div className="flex gap-4 mt-2">
              <Badge variant="outline">Total: {rubric.points} points</Badge>
              <Badge variant="outline">Pass: {rubric.passPoints} points</Badge>
              <Badge variant={true ? "default" : "secondary"}>
                {true ? "Active" : "Inactive"}
              </Badge>
            </div>
          )}
        </div>
      )}
      <div className="flex gap-2 justify-end">
        {isEditing ? (
          <>
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={createRubricMutation.isPending || isUpdating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={
                createRubricMutation.isPending || isUpdating || isReadonly
              }
            >
              {createRubricMutation.isPending || isUpdating
                ? isCreateMode
                  ? "Creating..."
                  : "Updating..."
                : isCreateMode
                  ? "Create Rubric"
                  : "Update"}
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditing(true)}
              disabled={isReadonly}
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          </>
        )}
      </div>
    </div>
  );

  // In create mode, render without Card wrapper; in edit mode, use Card
  if (isCreateMode) {
    return <div className="space-y-4">{content}</div>;
  }

  return (
    <Card>
      <CardHeader>{content}</CardHeader>
    </Card>
  );
}
