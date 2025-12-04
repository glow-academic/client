/**
 * RubricDetails.tsx
 * Used to display the details for the rubric page in edit mode.
 * @AshokSaravanan222 & @siladiea
 * 06/07/2025
 */

import { useState } from "react";
import { toast } from "sonner";

import type {
  CreateRubricIn,
  CreateRubricOut,
} from "@/app/(main)/engine/rubrics/page";
import type {
  UpdateRubricIn,
  UpdateRubricOut,
} from "@/app/(main)/engine/rubrics/r/[rubricId]/page";
import { DepartmentPicker } from "@/components/common/forms/DepartmentPicker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useProfile } from "@/contexts/profile-context";
import { api } from "@/lib/api/client";
import {
  getDefaultDepartmentIds,
  transformDepartmentIdsForSubmit,
} from "@/utils/department-picker-helpers";
import { Edit, Power } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo } from "react";

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
  profileId?: string; // Required for unified update
  createRubricAction?: (input: CreateRubricIn) => Promise<CreateRubricOut>;
  updateRubricAction?: (input: UpdateRubricIn) => Promise<UpdateRubricOut>;
}

export default function RubricDetails({
  rubric,
  rubricId,
  departmentMapping,
  validDepartmentIds,
  isCreateMode = false,
  isReadonly = false,
  profileId,
  createRubricAction,
  updateRubricAction,
}: RubricDetailsProps) {
  const { effectiveProfile } = useProfile();
  const isSuperadmin = effectiveProfile?.role === "superadmin";
  const [isEditing, setIsEditing] = useState(isCreateMode);
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  // Unified update helper - merges updates with existing data
  // Note: This client-side fetch is necessary because the server update endpoint
  // requires the full standard_groups array. For metadata-only updates, we need
  // to fetch current rubric to preserve existing standard groups.
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
    if (!updateRubricAction) {
      throw new Error("updateRubricAction is required");
    }

    // Fetch current rubric detail
    const fetched = await api.post("/rubrics/detail", {
      body: {
        rubricId: params.rubricId,
        profileId: params.profileId,
      },
    });

    const currentDetail = fetched;

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
        const standards = groupDetail.standard_ids
          .map((standardId) => {
            const stdMapping = currentDetail.standards_mapping[standardId];
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
            (s): s is { name: string; description?: string; points: number } =>
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
    const totalPassPoints = allGroups.reduce((sum, g) => sum + g.passPoints, 0);

    // Make the update request using server action
    const response = await updateRubricAction({
      body: {
        rubricId: params.rubricId,
        name: params.name,
        description: params.description,
        active: params.active,
        points: totalPoints,
        passPoints: totalPassPoints,
        department_ids: params.department_ids || [],
        standard_groups: allGroups,
        profileId: profileId || effectiveProfile?.id || "guest-profile-id",
      },
    });

    return { ...response, points: totalPoints, passPoints: totalPassPoints };
  };

  const defaultDepartmentIds = useMemo(
    () =>
      getDefaultDepartmentIds(
        isSuperadmin,
        effectiveProfile?.primaryDepartmentId ?? null
      ),
    [isSuperadmin, effectiveProfile?.primaryDepartmentId]
  );

  const initialDepartmentIds = useMemo(() => {
    // For create mode, use default; for edit mode, use rubric's department_ids
    if (
      isCreateMode &&
      (!rubric.department_ids || rubric.department_ids.length === 0)
    ) {
      return defaultDepartmentIds;
    }
    return rubric.department_ids || [];
  }, [isCreateMode, rubric.department_ids, defaultDepartmentIds]);

  const [formData, setFormData] = useState({
    name: rubric.name || "",
    description: rubric.description || "",
    departmentIds: initialDepartmentIds,
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
      const finalDepartmentIds = transformDepartmentIdsForSubmit(
        formData.departmentIds || [],
        isSuperadmin,
        validDepartmentIds
      );

      if (isCreateMode) {
        if (!createRubricAction) {
          toast.error("Create action is not available");
          return;
        }
        setIsCreating(true);
        // V3 create with empty standard_groups (will be added later)
        const data = await createRubricAction({
          body: {
            name: formData.name,
            description: formData.description,
            department_ids: finalDepartmentIds ?? [],
            active: formData.active,
            points: 0, // Will be calculated when standard groups are added
            passPoints: 0,
            standard_groups: [], // Start with no standard groups
            profileId: effectiveProfile?.id || "guest-profile-id",
          },
        });

        if (data && data.rubricId) {
          toast.success("Rubric created successfully");
          router.refresh();
          // Redirect to the newly created rubric for editing
          router.push(`/engine/rubrics/r/${data.rubricId}`);
        }
      } else {
        // V3 update - only update metadata, preserve standard groups
        if (!profileId) {
          toast.error("Profile ID is required for updates");
          return;
        }
        if (!updateRubricAction) {
          toast.error("Update action is not available");
          return;
        }
        setIsUpdating(true);
        const result = await updateRubricUnified({
          rubricId,
          profileId,
          name: formData.name,
          description: formData.description,
          department_ids: finalDepartmentIds,
          active: formData.active,
          standardGroupUpdates: [], // No changes to standard groups, just metadata
        });

        toast.success(
          `Rubric updated successfully. Total points: ${result.points}`
        );
        setIsEditing(false);
        router.refresh();
      }
    } catch (error) {
      toast.error(
        isCreateMode ? "Failed to create rubric" : "Failed to update rubric",
        {
          description: error instanceof Error ? error.message : "Unknown error",
        }
      );
    } finally {
      setIsCreating(false);
      setIsUpdating(false);
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
              disabled={isCreating || isUpdating || isReadonly}
              data-testid="input-rubric-name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange("description", e.target.value)}
              placeholder="Rubric Description"
              disabled={isCreating || isUpdating || isReadonly}
              data-testid="input-rubric-description"
            />
          </div>

          {/* Department Selection */}
          {validDepartmentIds.length > 1 && (
            <div className="space-y-2">
              <Label htmlFor="department">Department</Label>
              <DepartmentPicker
                mapping={departmentMapping}
                validIds={validDepartmentIds}
                selectedIds={formData.departmentIds || []}
                onSelect={handleDepartmentChange}
                placeholder="All Departments"
                disabled={isCreating || isUpdating || isReadonly}
                multiSelect={true}
                triggerProps={{ "data-testid": "picker-department" }}
              />
            </div>
          )}

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
                  disabled={isCreating || isUpdating || isReadonly}
                  data-testid="switch-rubric-active"
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
      <div className="flex flex-wrap gap-2 justify-end">
        {isEditing ? (
          <>
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={isCreating || isUpdating}
              data-testid="btn-cancel-rubric"
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={isCreating || isUpdating || isReadonly}
              data-testid="btn-save-rubric"
              className="w-full sm:w-auto"
            >
              {isCreating || isUpdating
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
              data-testid="btn-edit-rubric"
              className="w-full sm:w-auto"
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
