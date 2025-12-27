/**
 * Rubric.tsx
 * Step-based rubric editing component with 4 steps:
 * 1. Basic Information (name, description, department, active)
 * 2. Standard Groups (card grid for adding/editing groups)
 * 3. Group Configuration (accordion with standards/levels per group)
 * 4. Preview (grid view with generate button)
 */
"use client";

import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { GenericPicker } from "@/components/common/forms/GenericPicker";
import {
  RubricStandardGroupCardGrid,
  type StandardGroupCard,
} from "@/components/rubrics/RubricStandardGroupCardGrid";
import { RubricStandardSection } from "@/components/rubrics/RubricStandardSection";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useBreadcrumbContext } from "@/contexts/breadcrumb-context";
import { useProfile } from "@/contexts/profile-context";
import { cn } from "@/lib/utils";
import { transformDepartmentIdsForSubmit } from "@/utils/department-picker-helpers";
import { Check, Power, Sparkles } from "lucide-react";
import { toast } from "sonner";

// Type-only import from server page
import type {
  CreateRubricIn,
  CreateRubricOut,
} from "@/app/(main)/engine/rubrics/page";
import type {
  RubricDetailOut,
  RubricNewOut,
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
  position: number;
  active: boolean;
};

type StepStatus = "pending" | "active" | "completed";

interface Step {
  id: string;
  title: string;
  description: string;
  status: StepStatus;
}

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
  const { effectiveProfile, socket, isConnected } = useProfile();
  const { setEntityMetadata, clearEntityMetadata } = useBreadcrumbContext();
  const isSuperadmin = effectiveProfile?.role === "superadmin";

  const rubricDetail = serverRubricDetail;
  const rubricDetailDefault = serverRubricDetailDefault;
  const rubricData = isEditMode ? rubricDetail : rubricDetailDefault;

  // Form state for rubric metadata
  const [formData, setFormData] = useState({
    name: rubricData?.name || "New Rubric",
    description: rubricData?.description || "",
    active: rubricData?.active ?? true,
    departmentIds: rubricData?.department_ids || [],
    rubricAgentId: rubricData?.rubric_agent_id || null,
  });

  // Grid state
  const [standardGroups, setStandardGroups] = useState<StandardGroup[]>([]);
  const [standards, setStandards] = useState<Standard[]>([]);
  const [gridCells, setGridCells] = useState<GridCell[]>([]);

  // Loading states
  const [isSaving, setIsSaving] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isGeneratingRubric, setIsGeneratingRubric] = useState(false);

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
        name: rubricData.name || "New Rubric",
        description: rubricData.description || "",
        active: rubricData.active ?? true,
        departmentIds: rubricData.department_ids || [],
        rubricAgentId: rubricData.rubric_agent_id || null,
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

    // Transform standard groups from arrays - sort by position
    const groups: StandardGroup[] = [];
    if (rubricData.standard_groups) {
      rubricData.standard_groups.forEach((group) => {
        if (group.standard_group_id) {
          groups.push({
            id: String(group.standard_group_id),
            name: group.name || "",
            description: group.description || "",
            points: group.points || 0,
            passPoints: group.pass_points || 0,
            position: group.position ?? 1,
            active: group.active ?? true,
          });
        }
      });
    }
    // Sort by position
    groups.sort((a, b) => a.position - b.position);
    setStandardGroups(groups);

    // Transform standards from arrays
    const standardsList: Standard[] = [];
    const cells: GridCell[] = [];
    if (rubricData.standard_groups && rubricData.standards) {
      rubricData.standard_groups.forEach((group) => {
        if (group.standard_group_id && group.standard_ids) {
          const groupId = String(group.standard_group_id);
          group.standard_ids.forEach((standardId) => {
            const standard = rubricData.standards?.find(
              (s) => s.standard_id === standardId
            );
            if (standard && standard.standard_id) {
              const name = standard.name;
              const points = standard.points;
              if (name && typeof points === "number") {
                standardsList.push({
                  id: String(standardId),
                  name,
                  points,
                  standardGroupId: groupId,
                });
                // Initialize grid cell with standard's description for its group
                cells.push({
                  standardGroupId: groupId,
                  standardId: String(standardId),
                  description: standard.description || "",
                });
              }
            }
          });
        }
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

  // Auto-select rubric agent if only one option available
  useEffect(() => {
    if (!rubricData) return;

    const agents = rubricData.agents || [];
    const rubricAgentIds =
      rubricData.valid_agent_ids?.filter((id) => {
        const agent = agents.find((a) => String(a.agent_id) === id);
        return agent?.roles?.includes("rubric");
      }) || [];

    // Auto-select first rubric agent if only one option and not already set
    if (rubricAgentIds.length === 1 && !formData.rubricAgentId) {
      setFormData((prev) => ({
        ...prev,
        rubricAgentId: rubricAgentIds[0] || null,
      }));
    }
  }, [
    isEditMode,
    rubricData,
    formData.rubricAgentId,
  ]);

  // Step status logic
  const getStepStatus = useCallback(
    (stepId: string): StepStatus => {
      const hasName = !!formData.name?.trim();
      const hasGroups = standardGroups.length > 0;
      const hasStandards = standards.length > 0;

      switch (stepId) {
        case "basic":
          return hasName ? "completed" : "active";
        case "groups":
          if (!hasName) return "pending";
          return hasGroups ? "completed" : "active";
        case "configuration":
          if (!hasName || !hasGroups) return "pending";
          return hasStandards ? "completed" : "active";
        case "preview":
          if (!hasName || !hasGroups || !hasStandards) return "pending";
          return "completed";
        default:
          return "pending";
      }
    },
    [formData.name, standardGroups.length, standards.length],
  );

  // Steps array
  const steps: Step[] = useMemo(() => {
    return [
      {
        id: "basic",
        title: "Basic Information",
        description:
          "Set the rubric name, description, departments, and active status.",
        status: getStepStatus("basic"),
      },
      {
        id: "groups",
        title: "Standard Groups",
        description: "Add standard groups to organize your rubric.",
        status: getStepStatus("groups"),
      },
      {
        id: "configuration",
        title: "Group Configuration",
        description: "Configure standards and levels for each group.",
        status: getStepStatus("configuration"),
      },
      {
        id: "preview",
        title: "Preview",
        description: "Review your rubric grid and generate if needed.",
        status: getStepStatus("preview"),
      },
    ];
  }, [getStepStatus]);

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
      rubricAgentId?: string | null;
    }) => {
      if (!updateRubricAction || !rubricId) {
        throw new Error("updateRubricAction and rubricId are required");
      }

      // Build standard groups array for API
      // Group standards by their standardGroupId, preserve position order
      const sortedGroups = [...updates.standardGroups].sort(
        (a, b) => a.position - b.position,
      );
      const allGroups = sortedGroups.map((group) => {
        // Find standards that belong to this group
        const groupStandards = updates.standards.filter(
          (s) => s.standardGroupId === group.id,
        );
        return {
          name: group.name,
          short_name: group.name.substring(0, 10).toUpperCase(),
          description: group.description,
          points: group.points,
          passPoints: group.passPoints,
          position: group.position,
          active: group.active,
          standards: groupStandards.map((s) => {
            // Get description from grid cell for this group-standard pair
            // If not found, use empty string (will be set from standard's description on first save)
            const cell = updates.gridCells.find(
              (c) => c.standardGroupId === group.id && c.standardId === s.id,
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
        0,
      );

      // Ensure profileId exists - required for API calls
      if (!effectiveProfile?.id) {
        throw new Error("Profile not loaded. Please refresh the page.");
      }

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
          rubric_agent_id: updates.rubricAgentId || null,
        },
      });
    },
    [updateRubricAction, rubricId, effectiveProfile?.id],
  );

  // Handle save
  const handleSave = async () => {
    // Ensure profileId exists - required for API calls
    if (!effectiveProfile?.id) {
      toast.error("Profile not loaded. Please refresh the page.");
      return;
    }

    try {
      const finalDepartmentIds = transformDepartmentIdsForSubmit(
        formData.departmentIds || [],
        isSuperadmin,
        rubricData?.valid_department_ids || [],
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
          rubricAgentId: formData.rubricAgentId,
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
        // Calculate total points from standard groups
        const totalPoints = standardGroups.reduce(
          (sum, g) => sum + g.points,
          0,
        );
        const totalPassPoints = standardGroups.reduce(
          (sum, g) => sum + g.passPoints,
          0,
        );

        const data = await createRubricAction({
          body: {
            name: formData.name,
            description: formData.description,
            department_ids: finalDepartmentIds ?? [],
            active: formData.active,
            points: totalPoints,
            passPoints: totalPassPoints,
            rubric_agent_id: formData.rubricAgentId || null,
            standard_groups: standardGroups.map((g, index) => ({
              name: g.name,
              short_name: g.name.substring(0, 10).toUpperCase(),
              description: g.description,
              points: g.points,
              passPoints: g.passPoints,
              position: g.position ?? index + 1,
              active: g.active ?? true,
              standards: standards
                .filter((s) => s.standardGroupId === g.id)
                .map((s) => {
                  const cell = gridCells.find(
                    (c) => c.standardGroupId === g.id && c.standardId === s.id,
                  );
                  return {
                    name: s.name,
                    description: cell?.description || "",
                    points: s.points,
                  };
                }),
            })),
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
          description: error instanceof Error ? error.message : "Unknown error",
        },
      );
    } finally {
      setIsSaving(false);
      setIsCreating(false);
    }
  };

  // Handle standard groups change from card grid
  const handleStandardGroupsChange = useCallback(
    (newGroups: StandardGroupCard[]) => {
      // Update positions to maintain order
      const updatedGroups = newGroups.map((g, index) => ({
        id: g.id,
        name: g.name,
        description: g.description || "",
        points: g.points || 5,
        passPoints: g.passPoints || 4,
        position: index + 1,
        active: g.active ?? true,
      }));

      // Find deleted groups (groups that were in standardGroups but not in newGroups)
      const existingGroupIds = new Set(standardGroups.map((g) => g.id));
      const newGroupIds = new Set(newGroups.map((g) => g.id));
      const deletedGroupIds = Array.from(existingGroupIds).filter(
        (id) => !newGroupIds.has(id),
      );
      const addedGroupIds = Array.from(newGroupIds).filter(
        (id) => !existingGroupIds.has(id),
      );

      // Clean up standards and grid cells for deleted groups
      if (deletedGroupIds.length > 0) {
        setStandards((prev) =>
          prev.filter((s) => !deletedGroupIds.includes(s.standardGroupId)),
        );
        setGridCells((prev) =>
          prev.filter((c) => !deletedGroupIds.includes(c.standardGroupId)),
        );
      }

      // Auto-create first standard for newly added groups
      if (addedGroupIds.length > 0) {
        const newStandards: Standard[] = [];
        const newGridCells: GridCell[] = [];

        addedGroupIds.forEach((groupId, index) => {
          const group = updatedGroups.find((g) => g.id === groupId);
          if (!group) return;

          // First standard always gets 1 point
          const newStandard: Standard = {
            id: `temp-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`,
            name: "",
            points: 1,
            standardGroupId: groupId,
          };
          newStandards.push(newStandard);

          // Initialize grid cells for the new standard across all groups
          updatedGroups.forEach((g) => {
            newGridCells.push({
              standardGroupId: g.id,
              standardId: newStandard.id,
              description: "",
            });
          });
        });

        // Initialize grid cells for all existing standards in the new groups
        standards.forEach((existingStandard) => {
          addedGroupIds.forEach((groupId) => {
            newGridCells.push({
              standardGroupId: groupId,
              standardId: existingStandard.id,
              description: "",
            });
          });
        });

        setStandards((prev) => [...prev, ...newStandards]);
        setGridCells((prev) => [...prev, ...newGridCells]);
      }

      setStandardGroups(updatedGroups);
    },
    [standardGroups, standards],
  );

  // Handle group metadata change
  const handleGroupChange = useCallback(
    (groupId: string, updates: Partial<StandardGroup>) => {
      setStandardGroups((prev) =>
        prev.map((g) => (g.id === groupId ? { ...g, ...updates } : g)),
      );
    },
    [],
  );

  // Handle add standard
  const handleAddStandard = useCallback(
    (groupId: string) => {
      const group = standardGroups.find((g) => g.id === groupId);
      if (!group) return;

      const groupStandards = standards.filter(
        (s) => s.standardGroupId === groupId,
      );

      // Check if we've reached the maximum number of standards (group points)
      if (groupStandards.length >= group.points) {
        return; // Don't add if we've reached the limit
      }

      // Find the next available points value that doesn't conflict
      const usedPoints = new Set(groupStandards.map((s) => s.points));
      let nextPoints = 1;
      while (usedPoints.has(nextPoints) && nextPoints <= group.points) {
        nextPoints++;
      }

      // If we've exceeded the group points, don't add
      if (nextPoints > group.points) {
        return;
      }

      const newStandard: Standard = {
        id: `temp-${Date.now()}`,
        name: "",
        points: nextPoints,
        standardGroupId: groupId,
      };
      setStandards((prev) => [...prev, newStandard]);
      // Initialize grid cells for this standard
      standardGroups.forEach((g) => {
        const existingCell = gridCells.find(
          (c) => c.standardGroupId === g.id && c.standardId === newStandard.id,
        );
        if (!existingCell) {
          setGridCells((prev) => [
            ...prev,
            {
              standardGroupId: g.id,
              standardId: newStandard.id,
              description: "",
            },
          ]);
        }
      });
    },
    [standardGroups, standards, gridCells],
  );

  // Handle remove standard
  const handleRemoveStandard = useCallback(
    (groupId: string, standardId: string) => {
      setStandards((prev) => prev.filter((s) => s.id !== standardId));
      setGridCells((prev) =>
        prev.filter(
          (c) =>
            !(c.standardGroupId === groupId && c.standardId === standardId),
        ),
      );
    },
    [],
  );

  // Handle grid cell change
  const handleCellChange = (
    groupId: string,
    standardId: string,
    description: string,
  ) => {
    setGridCells((prev) => {
      const existing = prev.find(
        (c) => c.standardGroupId === groupId && c.standardId === standardId,
      );
      if (existing) {
        return prev.map((c) =>
          c.standardGroupId === groupId && c.standardId === standardId
            ? { ...c, description }
            : c,
        );
      } else {
        return [...prev, { standardGroupId: groupId, standardId, description }];
      }
    });
  };

  // Handle rubric generation
  const handleGenerateRubric = async () => {
    if (!socket || !isConnected) {
      toast.error("WebSocket not connected");
      return;
    }

    if (!formData.rubricAgentId) {
      toast.error("Please select a rubric agent before generating");
      return;
    }

    if (standardGroups.length === 0 || standards.length === 0) {
      toast.error("Please add standard groups and standards before generating");
      return;
    }

    const departmentId = formData.departmentIds[0] || rubricData?.valid_department_ids?.[0];
    if (!departmentId) {
      toast.error("Please select a department");
      return;
    }

    setIsGeneratingRubric(true);
    const toastId = toast.loading("Generating rubric descriptions...");

    try {
      type GenerateRubricOut = {
        success: boolean;
        message: string;
        trace_id?: string;
      };

      const result = await new Promise<GenerateRubricOut>(
        (resolve, reject) => {
          const handleProgress = (data: {
            type: string;
            message?: string;
            trace_id?: string;
          }) => {
            if (data.type === "start") {
              toast.loading(data.message || "Starting rubric generation...", {
                id: toastId,
              });
            } else if (data.type === "tool_call") {
              toast.loading(
                data.message || `Generating descriptions...`,
                { id: toastId },
              );
            }
          };

          const handleComplete = (data: {
            success: boolean;
            message: string;
            trace_id?: string;
          }) => {
            socket.off("rubrics_generation_progress", handleProgress);
            socket.off("rubrics_generation_complete", handleComplete);
            socket.off("rubrics_generation_error", handleError);
            socket.off(
              "rubrics_tools_standard_group_descriptions_complete",
              handleDescriptionsComplete,
            );

            if (data.success) {
              resolve({
                success: true,
                message: data.message,
                ...(data.trace_id && { trace_id: data.trace_id }),
              });
            } else {
              reject(new Error(data.message || "Rubric generation failed"));
            }
          };

          const handleError = (data: {
            success: boolean;
            message: string;
            trace_id?: string;
          }) => {
            socket.off("rubrics_generation_progress", handleProgress);
            socket.off("rubrics_generation_complete", handleComplete);
            socket.off("rubrics_generation_error", handleError);
            socket.off(
              "rubrics_tools_standard_group_descriptions_complete",
              handleDescriptionsComplete,
            );

            reject(new Error(data.message || "Rubric generation failed"));
          };

          const handleDescriptionsComplete = (data: {
            success: boolean;
            rubric_id: string;
            updated_count: number;
            trace_id?: string;
            message?: string;
            descriptions?: Array<{
              standard_group_id: string;
              standard_id: string;
              description: string;
            }>;
          }) => {
            // Update grid cells with generated descriptions
            if (data.descriptions && Array.isArray(data.descriptions)) {
              setGridCells((prevCells) => {
                const updatedCells = [...prevCells];
                data.descriptions!.forEach((desc) => {
                  const cellIndex = updatedCells.findIndex(
                    (c) =>
                      c.standardGroupId === desc.standard_group_id &&
                      c.standardId === desc.standard_id,
                  );
                  if (cellIndex >= 0) {
                    const existingCell = updatedCells[cellIndex];
                    if (existingCell) {
                      updatedCells[cellIndex] = {
                        standardGroupId: existingCell.standardGroupId,
                        standardId: existingCell.standardId,
                        description: desc.description,
                      };
                    }
                  } else {
                    updatedCells.push({
                      standardGroupId: desc.standard_group_id,
                      standardId: desc.standard_id,
                      description: desc.description,
                    });
                  }
                });
                return updatedCells;
              });
              toast.success(
                `Generated ${data.updated_count} description${data.updated_count !== 1 ? "s" : ""}`,
                { id: toastId },
              );
            }
          };

          socket.on("rubrics_generation_progress", handleProgress);
          socket.on("rubrics_generation_complete", handleComplete);
          socket.on("rubrics_generation_error", handleError);
          socket.on(
            "rubrics_tools_standard_group_descriptions_complete",
            handleDescriptionsComplete,
          );

          socket.emit("rubric_generate", {
            departmentId,
            profileId: effectiveProfile?.id,
            rubricId: isEditMode && rubricId ? rubricId : undefined,
            rubricAgentId: formData.rubricAgentId!,
            standardGroups: standardGroups.map((g) => ({
              id: g.id,
              name: g.name,
              description: g.description,
              points: g.points,
              passPoints: g.passPoints,
            })),
            standards: standards.map((s) => ({
              id: s.id,
              name: s.name,
              points: s.points,
              standardGroupId: s.standardGroupId,
            })),
          });
        },
      );

      if (result.success) {
        toast.success("Rubric generation completed successfully", {
          id: toastId,
        });
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to generate rubric",
        { id: toastId },
      );
    } finally {
      setIsGeneratingRubric(false);
    }
  };

  // Group level names by uniqueness for column headers
  const levelNameGroups = useMemo(() => {
    const nameMap = new Map<
      string,
      { name: string; count: number; groups: string[] }
    >();

    standardGroups.forEach((group) => {
      const groupStandards = standards.filter(
        (s) => s.standardGroupId === group.id,
      );
      groupStandards.forEach((standard) => {
        const existing = nameMap.get(standard.name);
        if (existing) {
          existing.count++;
          if (!existing.groups.includes(group.id)) {
            existing.groups.push(group.id);
          }
        } else {
          nameMap.set(standard.name, {
            name: standard.name,
            count: 1,
            groups: [group.id],
          });
        }
      });
    });

    return Array.from(nameMap.values());
  }, [standardGroups, standards]);

  // Table columns definition
  const columns = useMemo<ColumnDef<StandardGroup>[]>(() => {
    const cols: ColumnDef<StandardGroup>[] = [
      {
        id: "group",
        header: () => <div></div>, // Empty header
        cell: ({ row }) => (
          <div className="font-medium whitespace-normal break-words max-w-[200px]">
            {row.original.name}
          </div>
        ),
      },
    ];

    // Add a column for each level name group
    levelNameGroups.forEach((levelGroup, index) => {
      const headerName =
        levelGroup.count > 1
          ? `${levelGroup.name} ${index + 1}`
          : levelGroup.name;

      cols.push({
        id: `level-${levelGroup.name}-${index}`,
        header: () => <div className="font-medium">{headerName}</div>,
        cell: ({ row }) => {
          const group = row.original;
          // Find the standard for this group with this name
          const standard = standards.find(
            (s) => s.standardGroupId === group.id && s.name === levelGroup.name,
          );

          if (!standard) {
            return (
              <div className="text-xs text-muted-foreground text-center py-4">
                —
              </div>
            );
          }

          const cell = gridCells.find(
            (c) =>
              c.standardGroupId === group.id && c.standardId === standard.id,
          );

          return (
            <Textarea
              value={cell?.description || ""}
              onChange={(e) =>
                handleCellChange(group.id, standard.id, e.target.value)
              }
              placeholder="Description..."
              className="min-h-[140px] resize-none"
              disabled={isReadonly}
            />
          );
        },
      });
    });

    return cols;
  }, [levelNameGroups, standards, gridCells, isReadonly]);

  // Table state - simplified, no filters or sorting
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
    <div
      className="space-y-6"
      data-page={`rubric-${isEditMode ? "edit" : "new"}`}
    >
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

      {/* Step 1: Basic Information */}
      <Card className="transition-all">
        <CardContent className="pt-3">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium shrink-0",
                steps[0]?.status === "completed"
                  ? "bg-green-500 text-white"
                  : steps[0]?.status === "active"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted",
              )}
            >
              {steps[0]?.status === "completed" ? (
                <Check className="w-4 h-4" />
              ) : (
                <span>1</span>
              )}
            </div>
            <div className="flex-1">
              <input
                type="text"
                id="rubric-name"
                data-testid="input-rubric-name"
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
                onFocus={(e) => {
                  if (e.target.value === "New Rubric") {
                    e.target.select();
                  }
                }}
                onBlur={(e) => {
                  if (!e.target.value || e.target.value.trim() === "") {
                    setFormData((prev) => ({ ...prev, name: "New Rubric" }));
                  }
                }}
                className={cn(
                  "w-full text-2xl font-semibold border-none outline-none bg-transparent px-2 py-1 hover:bg-muted/50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:bg-muted/50 focus:ring-2 focus:ring-primary/20",
                )}
                placeholder="New Rubric"
                disabled={isReadonly}
              />
              <p className="text-xs text-muted-foreground mt-1 px-2">
                Click to edit
              </p>
            </div>
          </div>
        </CardContent>
        <CardContent className="pt-0 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="rubric-description">Description</Label>
            <Textarea
              id="rubric-description"
              value={formData.description}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  description: e.target.value,
                }))
              }
              placeholder="Rubric Description"
              disabled={isReadonly}
              data-testid="input-rubric-description"
              rows={3}
            />
          </div>

          {/* Department Selection */}
          {rubricData?.valid_department_ids &&
            rubricData.valid_department_ids.length > 1 && (
              <div className="space-y-2">
                <Label htmlFor="department">Department</Label>
                <GenericPicker
                  items={(() => {
                    // Convert departments array to dict format expected by GenericPicker
                    const mapping: Record<string, { name: string; description: string }> = {};
                    (rubricData.departments || []).forEach((dept) => {
                      if (dept.department_id) {
                        mapping[String(dept.department_id)] = {
                          name: dept.name || "",
                          description: dept.description || "",
                        };
                      }
                    });
                    return mapping;
                  })()}
                  itemIds={rubricData.valid_department_ids}
                  selectedIds={formData.departmentIds || []}
                  onSelect={(ids) =>
                    setFormData((prev) => ({ ...prev, departmentIds: ids }))
                  }
                  getId={(dept) => (dept as unknown as { id: string }).id}
                  getLabel={(dept) => dept.name || ""}
                  getSearchText={(dept) =>
                    `${dept.name} ${dept.description || ""}`
                  }
                  placeholder="All Departments"
                  disabled={isReadonly}
                  multiSelect={true}
                  hideSelectedChips={true}
                  buttonClassName="w-full"
                />
              </div>
            )}

          {/* Rubric Agent Selection */}
          {(() => {
            const agents = rubricData?.agents || [];
            const rubricAgentIds =
              rubricData?.valid_agent_ids?.filter((id) => {
                const agent = agents.find((a) => String(a.agent_id) === id);
                return agent?.roles?.includes("rubric");
              }) || [];

            const showRubricPicker = rubricAgentIds.length > 0;

            if (!showRubricPicker) {
              return null;
            }

            return (
              <div className="space-y-2">
                <Label htmlFor="rubricAgentId">Rubric Agent</Label>
                {formData?.rubricAgentId !== undefined ? (
                  <GenericPicker
                    items={(() => {
                      // Convert agents array to dict format expected by GenericPicker
                      const mapping: Record<string, { name: string; description: string; roles: string[] }> = {};
                      agents.forEach((agent) => {
                        if (agent.agent_id) {
                          mapping[String(agent.agent_id)] = {
                            name: agent.name || "",
                            description: agent.description || "",
                            roles: agent.roles || [],
                          };
                        }
                      });
                      return mapping;
                    })()}
                    itemIds={rubricAgentIds}
                    selectedIds={
                      formData?.rubricAgentId ? [formData.rubricAgentId] : []
                    }
                    onSelect={(ids) =>
                      setFormData((prev) => ({
                        ...prev,
                        rubricAgentId: ids[0] || null,
                      }))
                    }
                    getId={(item) => (item as unknown as { id: string }).id}
                    getLabel={(item) => item.name || ""}
                    getSearchText={(item) =>
                      `${item.name} ${item.description || ""}`
                    }
                    placeholder="Select rubric agent"
                    disabled={isReadonly}
                    multiSelect={false}
                    hideSelectedChips={true}
                    buttonClassName="w-full"
                    groupHeading="Agents"
                  />
                ) : null}
              </div>
            );
          })()}

          {/* Active Switch */}
          <div className="space-y-2 pt-2">
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
        </CardContent>
      </Card>

      {/* Step 2: Standard Groups */}
      <Card
        className={cn(
          "transition-all",
          !isEditMode && steps[1]?.status === "active" && "ring-2 ring-primary",
          !isEditMode && steps[1]?.status === "pending" && "opacity-50",
        )}
      >
        <CardHeader className="flex flex-row items-center space-y-0 pb-2 justify-between">
          <div className="flex items-center space-x-3">
            <div
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium",
                steps[1]?.status === "completed"
                  ? "bg-green-500 text-white"
                  : steps[1]?.status === "active"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted",
              )}
            >
              {steps[1]?.status === "completed" ? (
                <Check className="w-4 h-4" />
              ) : (
                <span>2</span>
              )}
            </div>
            <div>
              <CardTitle className="text-lg">
                {steps[1]?.title || "Standard Groups"}
              </CardTitle>
              <CardDescription>
                {steps[1]?.description ||
                  "Add standard groups to organize your rubric."}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 px-6">
          <RubricStandardGroupCardGrid
            groups={standardGroups.map((g) => ({
              id: g.id,
              name: g.name,
              description: g.description || "",
              points: g.points || 5,
              passPoints: g.passPoints || 4,
              position: g.position || standardGroups.indexOf(g) + 1,
              active: g.active ?? true,
            }))}
            onGroupsChange={handleStandardGroupsChange}
            readonly={isReadonly}
          />
        </CardContent>
      </Card>

      {/* Step 3: Individual Standard Configuration Blocks */}
      {standardGroups.length > 0 && (
        <div className="space-y-4">
          {standardGroups.map((group, index) => {
            const stepIndex = 2 + index; // After basic (0), groups (1)
            const groupStandards = standards.filter(
              (s) => s.standardGroupId === group.id,
            );
            const hasStandards = groupStandards.length > 0;
            // Step status: pending if previous groups aren't done, active if this group has no standards, completed if it has standards
            const baseStatus = getStepStatus("configuration");
            const actualStepStatus: StepStatus =
              baseStatus === "pending"
                ? "pending"
                : !hasStandards
                  ? "active"
                  : "completed";

            return (
              <RubricStandardSection
                key={group.id}
                group={group}
                standards={standards}
                gridCells={gridCells}
                position={index + 1}
                totalGroups={standardGroups.length}
                onGroupChange={handleGroupChange}
                onStandardsChange={setStandards}
                onGridCellChange={handleCellChange}
                onAddStandard={handleAddStandard}
                onRemoveStandard={handleRemoveStandard}
                readonly={isReadonly}
                stepStatus={actualStepStatus}
                stepNumber={stepIndex + 1}
                isEditMode={isEditMode}
              />
            );
          })}
        </div>
      )}

      {/* Step 4: Grid Preview */}
      {standardGroups.length > 0 && standards.length > 0 && (
        <Card
          className={cn(
            "transition-all",
            !isEditMode &&
              steps[3]?.status === "active" &&
              "ring-2 ring-primary",
            !isEditMode && steps[3]?.status === "pending" && "opacity-50",
          )}
        >
          <CardHeader className="flex flex-row items-center space-y-0 pb-2 justify-between">
            <div className="flex items-center space-x-3">
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium",
                  steps[3]?.status === "completed"
                    ? "bg-green-500 text-white"
                    : steps[3]?.status === "active"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted",
                )}
              >
                {steps[3]?.status === "completed" ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <span>4</span>
                )}
              </div>
              <div>
                <CardTitle className="text-lg">
                  {steps[3]?.title || "Preview"}
                </CardTitle>
                <CardDescription>
                  {steps[3]?.description ||
                    "Review your rubric grid and generate if needed."}
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="default"
                size="sm"
                disabled={isReadonly || isGeneratingRubric || !formData.rubricAgentId}
                onClick={handleGenerateRubric}
              >
                <Sparkles className="h-4 w-4 mr-2" />
                {isGeneratingRubric ? "Generating..." : "Generate"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 px-6">
            {/* Grid Table */}
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <TableHead
                          key={header.id}
                          colSpan={header.colSpan}
                          className={`border-r py-2 text-xs text-center ${
                            header.id === "group"
                              ? "max-w-[200px] whitespace-normal"
                              : ""
                          }`}
                        >
                          {header.isPlaceholder
                            ? null
                            : flexRender(
                                header.column.columnDef.header,
                                header.getContext(),
                              )}
                        </TableHead>
                      ))}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {table.getRowModel().rows.length ? (
                    table.getRowModel().rows.map((row) => (
                      <TableRow
                        key={row.id}
                        className="hover:bg-muted/30 transition-colors"
                      >
                        {row.getVisibleCells().map((cell) => (
                          <TableCell
                            key={cell.id}
                            className={`border-r px-3 py-2 ${
                              cell.column.id === "group"
                                ? "max-w-[200px] whitespace-normal"
                                : ""
                            }`}
                          >
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext(),
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={table.getAllColumns().length}
                        className="h-24 text-center px-6"
                      >
                        No standard groups yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bottom Actions */}
      <div className="flex justify-end gap-3">
        <Button
          variant="outline"
          type="button"
          onClick={() => router.back()}
          disabled={isSaving || isCreating}
        >
          Back
        </Button>
        <Button
          onClick={handleSave}
          disabled={
            (isSaving || isCreating || isReadonly) &&
            (!isEditMode || !formData.name.trim())
          }
          data-testid={isEditMode ? "btn-save-rubric" : "btn-create-rubric"}
        >
          {isSaving || isCreating
            ? isEditMode
              ? "Saving..."
              : "Creating..."
            : isEditMode
              ? "Update Rubric"
              : "Create Rubric"}
        </Button>
      </div>
    </div>
  );
}
