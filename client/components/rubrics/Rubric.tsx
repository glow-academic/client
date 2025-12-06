/**
 * Rubric.tsx
 * Refactored rubric editing component with grid-based interface
 * Uses TanStack React Table for grid layout with standard groups as rows and standards as columns
 */
"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useCallback } from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { DepartmentPicker } from "@/components/common/forms/DepartmentPicker";
import { useBreadcrumbContext } from "@/contexts/breadcrumb-context";
import { useProfile } from "@/contexts/profile-context";
import { api } from "@/lib/api/client";
import {
  getDefaultDepartmentIds,
  transformDepartmentIdsForSubmit,
} from "@/utils/department-picker-helpers";
import { toast } from "sonner";
import { Plus, Power, Sparkles, Trash2, Edit } from "lucide-react";

// Type-only import from server page
import type {
  CreateRubricIn,
  CreateRubricOut,
} from "@/app/(main)/engine/rubrics/page";
import type {
  RubricNewOut,
  RubricDetailOut,
  UpdateRubricIn,
  UpdateRubricOut,
} from "@/app/(main)/engine/rubrics/r/[rubricId]/page";

// Types
type StandardGroup = {
  id: string;
  name: string;
  description: string;
  points: number;
  passPoints: number;
};

type Standard = {
  id: string;
  name: string;
  points: number;
  standardGroupId: string;
};

type GridCell = {
  standardGroupId: string;
  standardId: string;
  description: string;
};

export interface RubricProps {
  rubricId?: string;
  rubricDetail?: RubricDetailOut;
  rubricDetailDefault?: RubricNewOut;
  updateRubricAction?: (input: UpdateRubricIn) => Promise<UpdateRubricOut>;
  createRubricAction?: (input: CreateRubricIn) => Promise<CreateRubricOut>;
}

export default function Rubric({
  rubricId,
  rubricDetail: serverRubricDetail,
  rubricDetailDefault: serverRubricDetailDefault,
  updateRubricAction,
  createRubricAction,
}: RubricProps) {
  const router = useRouter();
  const isEditMode = !!rubricId;
  const { effectiveProfile } = useProfile();
  const { setEntityMetadata, clearEntityMetadata } = useBreadcrumbContext();
  const isSuperadmin = effectiveProfile?.role === "superadmin";

  const rubricDetail = serverRubricDetail;
  const rubricDetailDefault = serverRubricDetailDefault;
  const rubricData = isEditMode ? rubricDetail : rubricDetailDefault;

  // Form state for rubric metadata
  const [formData, setFormData] = useState({
    name: rubricData?.name || "",
    description: rubricData?.description || "",
    active: rubricData?.active ?? true,
    departmentIds: rubricData?.department_ids || [],
  });

  // Grid state
  const [standardGroups, setStandardGroups] = useState<StandardGroup[]>([]);
  const [standards, setStandards] = useState<Standard[]>([]);
  const [gridCells, setGridCells] = useState<GridCell[]>([]);

  // Modal states
  const [showAddGroupModal, setShowAddGroupModal] = useState(false);
  const [showAddStandardModal, setShowAddStandardModal] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingStandardId, setEditingStandardId] = useState<string | null>(
    null
  );

  // Form states for modals
  const [groupFormData, setGroupFormData] = useState({
    name: "",
    description: "",
    points: "5",
    passPoints: "4",
  });

  const [standardFormData, setStandardFormData] = useState({
    name: "",
    points: "1",
  });

  // Loading states
  const [isSaving, setIsSaving] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Set breadcrumb context
  useEffect(() => {
    if (rubricDetail?.name && rubricId && isEditMode) {
      setEntityMetadata({
        entityId: rubricId,
        entityName: rubricDetail.name,
        entityType: "rubric",
      });
    }
    return () => clearEntityMetadata();
  }, [
    rubricDetail,
    rubricId,
    isEditMode,
    setEntityMetadata,
    clearEntityMetadata,
  ]);

  // Initialize form data from server data
  useEffect(() => {
    if (rubricData) {
      setFormData({
        name: rubricData.name || "",
        description: rubricData.description || "",
        active: rubricData.active ?? true,
        departmentIds: rubricData.department_ids || [],
      });
    }
  }, [rubricData]);

  // Transform server data to grid structure
  useEffect(() => {
    if (!rubricData || !isEditMode) {
      setStandardGroups([]);
      setStandards([]);
      setGridCells([]);
      return;
    }

    // Transform standard groups
    const groups: StandardGroup[] = [];
    if (rubricData.standard_group_ids) {
      rubricData.standard_group_ids.forEach((groupId) => {
      const groupMapping = rubricData.standard_groups_mapping[groupId];
      const groupDetail = rubricData.standard_groups_detail[groupId];
        if (groupMapping && groupDetail) {
          groups.push({
        id: groupId,
            name: groupMapping["name"] || "",
            description: groupMapping["description"] || "",
            points: groupDetail["points"] || 0,
            passPoints: groupDetail["passPoints"] || 0,
          });
        }
      });
    }
    setStandardGroups(groups);

    // Transform standards
    const standardsList: Standard[] = [];
    const cells: GridCell[] = [];
    if (rubricData.standard_group_ids) {
      rubricData.standard_group_ids.forEach((groupId) => {
      const groupDetail = rubricData.standard_groups_detail[groupId];
      const standardIds = groupDetail?.["standard_ids"] || [];
      standardIds.forEach((standardId) => {
        const standard = rubricData.standards_mapping[standardId];
        if (standard) {
          const name = standard["name"];
          const points = standard["points"];
          if (name && typeof points === "number") {
              standardsList.push({
              id: standardId,
              name,
              points,
              standardGroupId: groupId,
              });
              // Initialize grid cell with standard's description for its group
              cells.push({
                standardGroupId: groupId,
                standardId,
                description: standard["description"] || "",
            });
          }
        }
      });
    });
    }
    setStandards(standardsList);
    setGridCells(cells);
  }, [rubricData, isEditMode]);

  const isReadonly = useMemo(() => {
    if (!isEditMode) return false;
    if (!rubricData) return true;
    return !rubricData.can_edit;
  }, [isEditMode, rubricData]);

  const defaultDepartmentIds = useMemo(
    () =>
      getDefaultDepartmentIds(
        isSuperadmin,
        effectiveProfile?.primaryDepartmentId ?? null
      ),
    [isSuperadmin, effectiveProfile?.primaryDepartmentId]
  );

  // Unified update helper
  const updateRubricUnified = useCallback(
    async (updates: {
      name: string;
      description: string;
      department_ids: string[] | null;
      active: boolean;
      standardGroups: StandardGroup[];
      standards: Standard[];
      gridCells: GridCell[];
    }) => {
      if (!updateRubricAction || !rubricId) {
        throw new Error("updateRubricAction and rubricId are required");
      }

      // Build standard groups array for API
      // Group standards by their standardGroupId
      const allGroups = updates.standardGroups.map((group) => {
        // Find standards that belong to this group
        const groupStandards = updates.standards.filter(
          (s) => s.standardGroupId === group.id
        );
        return {
          name: group.name,
          short_name: group.name.substring(0, 10).toUpperCase(),
          description: group.description,
          points: group.points,
          passPoints: group.passPoints,
          standards: groupStandards.map((s) => {
            // Get description from grid cell for this group-standard pair
            // If not found, use empty string (will be set from standard's description on first save)
            const cell = updates.gridCells.find(
              (c) =>
                c.standardGroupId === group.id && c.standardId === s.id
            );
            return {
              name: s.name,
              description: cell?.description || "",
              points: s.points,
            };
          }),
        };
      });

      // Calculate total points
      const totalPoints = allGroups.reduce((sum, g) => sum + g.points, 0);
      const totalPassPoints = allGroups.reduce(
        (sum, g) => sum + g.passPoints,
        0
      );

      return updateRubricAction({
        body: {
          rubricId,
          name: updates.name,
          description: updates.description,
          active: updates.active,
          points: totalPoints,
          passPoints: totalPassPoints,
          department_ids: updates.department_ids || [],
          standard_groups: allGroups,
          profileId: effectiveProfile?.id || "guest-profile-id",
        },
      });
    },
    [updateRubricAction, rubricId, effectiveProfile?.id]
  );

  // Handle save
  const handleSave = async () => {
    try {
      const finalDepartmentIds = transformDepartmentIdsForSubmit(
        formData.departmentIds || [],
        isSuperadmin,
        rubricData?.valid_department_ids || []
      );

      if (isEditMode) {
        setIsSaving(true);
        await updateRubricUnified({
          name: formData.name,
          description: formData.description,
          department_ids: finalDepartmentIds,
          active: formData.active,
          standardGroups,
          standards,
          gridCells,
        });
        toast.success("Rubric updated successfully");
        router.refresh();
      } else {
        // Create mode
        if (!createRubricAction) {
          toast.error("Create action is not available");
          return;
        }
        setIsCreating(true);
        const data = await createRubricAction({
          body: {
            name: formData.name,
            description: formData.description,
            department_ids: finalDepartmentIds ?? [],
            active: formData.active,
            points: 0,
            passPoints: 0,
            standard_groups: [],
            profileId: effectiveProfile?.id || "guest-profile-id",
          },
        });

        if (data && data.rubricId) {
          toast.success("Rubric created successfully");
          router.push(`/engine/rubrics/r/${data.rubricId}`);
        }
      }
    } catch (error) {
      toast.error(
        isEditMode ? "Failed to update rubric" : "Failed to create rubric",
        {
          description:
            error instanceof Error ? error.message : "Unknown error",
        }
      );
    } finally {
      setIsSaving(false);
      setIsCreating(false);
    }
  };

  // Handle add standard group
  const handleAddGroup = () => {
    setGroupFormData({
      name: "",
      description: "",
      points: "5",
      passPoints: "4",
    });
    setEditingGroupId(null);
    setShowAddGroupModal(true);
  };

  // Handle edit standard group
  const handleEditGroup = (groupId: string) => {
    const group = standardGroups.find((g) => g.id === groupId);
    if (group) {
      setGroupFormData({
        name: group.name,
        description: group.description,
        points: group.points.toString(),
        passPoints: group.passPoints.toString(),
      });
      setEditingGroupId(groupId);
      setShowAddGroupModal(true);
    }
  };

  // Handle save standard group
  const handleSaveGroup = () => {
    if (!groupFormData.name.trim()) {
      toast.error("Group name is required");
      return;
    }

    const points = parseInt(groupFormData.points);
    const passPoints = parseInt(groupFormData.passPoints);

    if (isNaN(points) || points <= 0) {
      toast.error("Points must be a valid number greater than 0");
      return;
    }

    if (isNaN(passPoints) || passPoints <= 0) {
      toast.error("Pass points must be a valid number greater than 0");
      return;
    }

    if (passPoints > points) {
      toast.error("Pass points cannot exceed maximum points");
      return;
    }

    if (editingGroupId) {
      // Update existing group
      setStandardGroups((prev) =>
        prev.map((g) =>
          g.id === editingGroupId
            ? {
                ...g,
                name: groupFormData.name,
                description: groupFormData.description,
                points,
                passPoints,
              }
            : g
        )
      );
    } else {
      // Add new group
      const newGroup: StandardGroup = {
        id: `temp-${Date.now()}`,
        name: groupFormData.name,
        description: groupFormData.description,
        points,
        passPoints,
      };
      setStandardGroups((prev) => [...prev, newGroup]);
    }

    setShowAddGroupModal(false);
    setEditingGroupId(null);
  };

  // Handle delete standard group
  const handleDeleteGroup = async (groupId: string) => {
    if (
      !confirm(
        "Are you sure you want to delete this standard group? This will also delete all associated standards."
      )
    ) {
      return;
    }

    // Remove group and its standards
    setStandardGroups((prev) => prev.filter((g) => g.id !== groupId));
    setStandards((prev) => prev.filter((s) => s.standardGroupId !== groupId));
    setGridCells((prev) =>
      prev.filter((c) => c.standardGroupId !== groupId)
    );

    // If in edit mode, save immediately
    if (isEditMode && updateRubricAction) {
      try {
        const finalDepartmentIds = transformDepartmentIdsForSubmit(
          formData.departmentIds || [],
          isSuperadmin,
          rubricData?.valid_department_ids || []
        );
        await updateRubricUnified({
          name: formData.name,
          description: formData.description,
          department_ids: finalDepartmentIds,
          active: formData.active,
          standardGroups: standardGroups.filter((g) => g.id !== groupId),
          standards: standards.filter((s) => s.standardGroupId !== groupId),
          gridCells: gridCells.filter((c) => c.standardGroupId !== groupId),
        });
        toast.success("Standard group deleted successfully");
        router.refresh();
      } catch (error) {
        toast.error("Failed to delete standard group", {
          description:
            error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  };

  // Handle add standard
  const handleAddStandard = () => {
    setStandardFormData({
      name: "",
      points: "1",
    });
    setEditingStandardId(null);
    setShowAddStandardModal(true);
  };

  // Handle edit standard
  const handleEditStandard = (standardId: string) => {
    const standard = standards.find((s) => s.id === standardId);
    if (standard) {
      setStandardFormData({
        name: standard.name,
        points: standard.points.toString(),
      });
      setEditingStandardId(standardId);
      setShowAddStandardModal(true);
    }
  };

  // Handle save standard
  const handleSaveStandard = () => {
    if (!standardFormData.name.trim()) {
      toast.error("Standard name is required");
      return;
    }

    const points = parseInt(standardFormData.points);
    if (isNaN(points) || points <= 0) {
      toast.error("Points must be a valid number greater than 0");
      return;
    }

    // For now, we need to assign to a group - use first group or prompt user
    if (standardGroups.length === 0) {
      toast.error("Please add a standard group first");
      return;
    }

    if (editingStandardId) {
      // Update existing standard
      setStandards((prev) =>
        prev.map((s) =>
          s.id === editingStandardId
            ? { ...s, name: standardFormData.name, points }
            : s
        )
      );
    } else {
      // Add new standard - assign to first group for now
      // In a true grid, standards would appear in all groups, but for now
      // we assign to one group and display across all groups
      const firstGroup = standardGroups[0];
      const newStandard: Standard = {
        id: `temp-${Date.now()}`,
        name: standardFormData.name,
        points,
        standardGroupId: firstGroup.id,
      };
      setStandards((prev) => [...prev, newStandard]);

      // Initialize grid cells for this standard across all groups
      // This allows editing descriptions per group-standard pair
      standardGroups.forEach((group) => {
        const existingCell = gridCells.find(
          (c) =>
            c.standardGroupId === group.id && c.standardId === newStandard.id
        );
        if (!existingCell) {
          setGridCells((prev) => [
      ...prev,
            {
              standardGroupId: group.id,
              standardId: newStandard.id,
              description: "",
            },
          ]);
        }
      });
    }

    setShowAddStandardModal(false);
    setEditingStandardId(null);
  };

  // Handle delete standard
  const handleDeleteStandard = async (standardId: string) => {
    if (!confirm("Are you sure you want to delete this standard?")) {
      return;
    }

    setStandards((prev) => prev.filter((s) => s.id !== standardId));
    setGridCells((prev) => prev.filter((c) => c.standardId !== standardId));

    // If in edit mode, save immediately
    if (isEditMode && updateRubricAction) {
      try {
        const finalDepartmentIds = transformDepartmentIdsForSubmit(
          formData.departmentIds || [],
          isSuperadmin,
          rubricData?.valid_department_ids || []
        );
        await updateRubricUnified({
          name: formData.name,
          description: formData.description,
          department_ids: finalDepartmentIds,
          active: formData.active,
          standardGroups,
          standards: standards.filter((s) => s.id !== standardId),
          gridCells: gridCells.filter((c) => c.standardId !== standardId),
        });
        toast.success("Standard deleted successfully");
        router.refresh();
      } catch (error) {
        toast.error("Failed to delete standard", {
          description:
            error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  };

  // Handle grid cell change
  const handleCellChange = (
    groupId: string,
    standardId: string,
    description: string
  ) => {
    setGridCells((prev) => {
      const existing = prev.find(
        (c) => c.standardGroupId === groupId && c.standardId === standardId
      );
      if (existing) {
        return prev.map((c) =>
          c.standardGroupId === groupId && c.standardId === standardId
            ? { ...c, description }
            : c
        );
      } else {
        return [...prev, { standardGroupId: groupId, standardId, description }];
      }
    });
  };

  // Get unique standards (for columns) sorted by points descending (most to least)
  // Note: Currently standards belong to one group, but we display them as columns
  // across all groups. In a true grid, standards would appear in multiple groups.
  const uniqueStandards = useMemo(() => {
    const seen = new Set<string>();
    const unique = standards.filter((s) => {
      if (seen.has(s.id)) return false;
      seen.add(s.id);
      return true;
    });
    // Sort by points descending (most points first, left to right)
    return unique.sort((a, b) => b.points - a.points);
  }, [standards]);

  // Table columns definition
  const columns = useMemo<ColumnDef<StandardGroup>[]>(() => {
    const cols: ColumnDef<StandardGroup>[] = [
      {
        id: "group",
        header: "Standard Group",
        cell: ({ row }) => (
          <div className="space-y-1">
            <div className="font-medium">{row.original.name}</div>
            <div className="text-xs text-muted-foreground">
              {row.original.description}
            </div>
            <div className="flex gap-2 text-xs">
              <Badge variant="outline">
                {row.original.points} pts
              </Badge>
              <Badge variant="outline">
                Pass: {row.original.passPoints} pts
              </Badge>
            </div>
            {!isReadonly && (
              <div className="flex gap-1 mt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleEditGroup(row.original.id)}
                  className="h-7 px-2"
                >
                  <Edit className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteGroup(row.original.id)}
                  className="h-7 px-2"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
        ),
      },
    ];

    // Add a column for each unique standard
    uniqueStandards.forEach((standard) => {
      cols.push({
        id: standard.id,
        header: () => (
          <div className="space-y-1">
            <div className="font-medium">{standard.name}</div>
            <Badge variant="outline" className="text-xs">
              {standard.points} pts
            </Badge>
            {!isReadonly && (
              <div className="flex gap-1 mt-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleEditStandard(standard.id)}
                  className="h-6 px-1"
                >
                  <Edit className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteStandard(standard.id)}
                  className="h-6 px-1"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
        ),
        cell: ({ row }) => {
          const group = row.original;
          const cell = gridCells.find(
            (c) =>
              c.standardGroupId === group.id && c.standardId === standard.id
          );
          // Check if this standard belongs to this group (for current structure)
          const standardBelongsToGroup =
            standard.standardGroupId === group.id;
          return (
            <Textarea
              value={cell?.description || ""}
              onChange={(e) =>
                handleCellChange(group.id, standard.id, e.target.value)
              }
              placeholder={
                standardBelongsToGroup
                  ? "Description..."
                  : "Standard not in this group"
              }
              className="min-h-[80px] resize-none"
              disabled={isReadonly || !standardBelongsToGroup}
            />
          );
        },
      });
    });

    return cols;
  }, [uniqueStandards, gridCells, isReadonly]);

  const table = useReactTable({
    data: standardGroups,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  // Error state
  if (isEditMode && !rubricData) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Rubric Not Found</h1>
          <p className="text-muted-foreground">
            The rubric you're looking for doesn't exist.
          </p>
        </div>
        <Button onClick={() => router.push("/engine/rubrics")}>
          Back to Rubrics
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-page={`rubric-${isEditMode ? "edit" : "new"}`}>
      {/* Readonly warning */}
      {isReadonly && (
        <div className="bg-muted border border-border rounded-lg p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-muted-foreground"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-foreground">
                Rubric is read-only
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                  {rubricData?.department_ids?.length === 0
                  ? "This is a default rubric that cannot be edited."
                  : "This rubric cannot be edited."}
                </p>
            </div>
          </div>
        </div>
      )}

      {/* Inline form for rubric metadata */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="rubric-name">Name</Label>
          <Input
            id="rubric-name"
            value={formData.name}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, name: e.target.value }))
            }
            className="text-2xl"
            placeholder="Rubric Name"
            disabled={isReadonly}
            data-testid="input-rubric-name"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="rubric-description">Description</Label>
          <Textarea
            id="rubric-description"
            value={formData.description}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, description: e.target.value }))
            }
            placeholder="Rubric Description"
            disabled={isReadonly}
            data-testid="input-rubric-description"
          />
        </div>

        {/* Department Selection */}
        {rubricData?.valid_department_ids &&
          rubricData.valid_department_ids.length > 1 && (
            <div className="space-y-2">
              <Label htmlFor="department">Department</Label>
              <DepartmentPicker
                mapping={rubricData.department_mapping || {}}
                validIds={rubricData.valid_department_ids}
                selectedIds={formData.departmentIds || []}
                onSelect={(ids) =>
                  setFormData((prev) => ({ ...prev, departmentIds: ids }))
                }
                placeholder="All Departments"
                disabled={isReadonly}
                multiSelect={true}
                triggerProps={{ "data-testid": "picker-department" }}
              />
            </div>
          )}

        {/* Active Switch */}
        <div className="space-y-2 pt-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="active" className="text-sm flex items-center gap-1.5">
              <Power className="h-3.5 w-3.5 text-muted-foreground" />
              Active
            </Label>
            <Switch
              id="active"
              checked={formData.active}
              onCheckedChange={(checked) =>
                setFormData((prev) => ({ ...prev, active: checked }))
              }
              disabled={isReadonly}
              data-testid="switch-rubric-active"
            />
          </div>
          <p className="text-xs text-muted-foreground pl-5">
            Inactive rubrics will not be available for simulations
          </p>
        </div>

      </div>

      {/* Toolbar */}
      {isEditMode && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleAddGroup}
              disabled={isReadonly}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Row (Group)
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleAddStandard}
              disabled={isReadonly || standardGroups.length === 0}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Column (Standard)
            </Button>
          </div>
          <div className="flex items-center gap-2">
            {/* Generate button placeholder */}
            <Button
              variant="default"
              size="sm"
              disabled={isReadonly}
              onClick={() => {
                toast.info("Generate feature coming soon");
              }}
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Generate
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving || isReadonly}
              data-testid="btn-save-rubric"
            >
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      )}

      {/* Grid Table - Only show in edit mode */}
      {isEditMode && (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id} className="min-w-[200px]">
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 text-center"
                  >
                    No standard groups yet. Click "Add Row" to get started.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create mode message */}
      {!isEditMode && (
        <div className="p-4 bg-muted/20 rounded-lg border text-center">
          <p className="text-sm text-muted-foreground">
            Create the rubric first, then you'll be able to add standard groups
            and standards.
          </p>
        </div>
      )}

      {/* Create mode - show save button */}
      {!isEditMode && (
        <div className="flex justify-end">
          <Button
            onClick={handleSave}
            disabled={isCreating || !formData.name.trim()}
            data-testid="btn-create-rubric"
          >
            {isCreating ? "Creating..." : "Create Rubric"}
          </Button>
        </div>
      )}

      {/* Add Standard Group Modal */}
      <Dialog open={showAddGroupModal} onOpenChange={setShowAddGroupModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingGroupId ? "Edit Standard Group" : "Add Standard Group"}
            </DialogTitle>
            <DialogDescription>
              {editingGroupId
                ? "Update the standard group details."
                : "Create a new standard group for this rubric."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="group-name">Name *</Label>
              <Input
                id="group-name"
                value={groupFormData.name}
                onChange={(e) =>
                  setGroupFormData((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="Standard Group Name"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="group-description">Description</Label>
              <Textarea
                id="group-description"
                value={groupFormData.description}
                onChange={(e) =>
                  setGroupFormData((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                placeholder="Standard Group Description"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="group-points">Points *</Label>
                <Input
                  id="group-points"
                  type="number"
                  value={groupFormData.points}
                  onChange={(e) =>
                    setGroupFormData((prev) => ({
                      ...prev,
                      points: e.target.value,
                    }))
                  }
                  min="1"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="group-pass-points">Pass Points *</Label>
                <Input
                  id="group-pass-points"
                  type="number"
                  value={groupFormData.passPoints}
                  onChange={(e) =>
                    setGroupFormData((prev) => ({
                      ...prev,
                      passPoints: e.target.value,
                    }))
                  }
                  min="1"
                  required
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowAddGroupModal(false);
                setEditingGroupId(null);
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveGroup}>
              {editingGroupId ? "Update" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Standard Modal */}
      <Dialog open={showAddStandardModal} onOpenChange={setShowAddStandardModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingStandardId ? "Edit Standard" : "Add Standard"}
            </DialogTitle>
            <DialogDescription>
              {editingStandardId
                ? "Update the standard details."
                : "Create a new standard for this rubric."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="standard-name">Name *</Label>
              <Input
                id="standard-name"
                value={standardFormData.name}
                onChange={(e) =>
                  setStandardFormData((prev) => ({
                    ...prev,
                    name: e.target.value,
                  }))
                }
                placeholder="Standard Name"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="standard-points">Points *</Label>
              <Input
                id="standard-points"
                type="number"
                value={standardFormData.points}
                onChange={(e) =>
                  setStandardFormData((prev) => ({
                    ...prev,
                    points: e.target.value,
                  }))
                }
                min="1"
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowAddStandardModal(false);
                setEditingStandardId(null);
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveStandard}>
              {editingStandardId ? "Update" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
