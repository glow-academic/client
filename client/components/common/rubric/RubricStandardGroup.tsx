/**
 * RubricStandardGroup.tsx
 * Used to display the standard group for the rubric page, in an editing mode for a form.
 * @AshokSaravanan222 & @siladiea
 * 06/07/2025
 */

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useUpdateRubric } from "@/lib/api/hooks/rubrics";
import {
  useCreateStandardGroup,
  useDeleteStandardGroup,
  useStandardGroupsByRubricId,
  useUpdateStandardGroup,
} from "@/lib/api/hooks/standard_groups";
import {
  useCreateStandard,
  useDeleteStandards,
  useUpdateStandard,
} from "@/lib/api/hooks/standards";
import { Standard, StandardGroup } from "@/types";
import { log } from "@/utils/logger";
import {
  Award,
  BookOpen,
  Brain,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  Edit,
  Lightbulb,
  LucideIcon,
  MessageSquare,
  Plus,
  Target,
  Trash2,
  Users,
} from "lucide-react";

// Icon mapping for different criteria with keyword matching
const getIconForName = (name: string): LucideIcon => {
  const nameLower = name.toLowerCase();

  if (
    nameLower.includes("communication") ||
    nameLower.includes("listening") ||
    nameLower.includes("speaking")
  ) {
    return MessageSquare;
  }
  if (
    nameLower.includes("time") ||
    nameLower.includes("management") ||
    nameLower.includes("schedule")
  ) {
    return Clock;
  }
  if (
    nameLower.includes("student") ||
    nameLower.includes("individual") ||
    nameLower.includes("adapt")
  ) {
    return Users;
  }
  if (
    nameLower.includes("knowledge") ||
    nameLower.includes("understanding") ||
    nameLower.includes("course")
  ) {
    return BookOpen;
  }
  if (
    nameLower.includes("accuracy") ||
    nameLower.includes("correct") ||
    nameLower.includes("precise")
  ) {
    return CheckCircle;
  }
  if (
    nameLower.includes("excellence") ||
    nameLower.includes("quality") ||
    nameLower.includes("performance")
  ) {
    return Award;
  }
  if (
    nameLower.includes("thinking") ||
    nameLower.includes("analysis") ||
    nameLower.includes("problem")
  ) {
    return Brain;
  }
  if (
    nameLower.includes("creative") ||
    nameLower.includes("innovation") ||
    nameLower.includes("idea")
  ) {
    return Lightbulb;
  }

  // Default icon
  return Target;
};

// Color mapping for different criteria with keyword matching
const getColorForName = (name: string): string => {
  const nameLower = name.toLowerCase();

  if (
    nameLower.includes("communication") ||
    nameLower.includes("listening") ||
    nameLower.includes("speaking")
  ) {
    return "blue";
  }
  if (
    nameLower.includes("time") ||
    nameLower.includes("management") ||
    nameLower.includes("schedule")
  ) {
    return "amber";
  }
  if (
    nameLower.includes("student") ||
    nameLower.includes("individual") ||
    nameLower.includes("adapt")
  ) {
    return "purple";
  }
  if (
    nameLower.includes("knowledge") ||
    nameLower.includes("understanding") ||
    nameLower.includes("course")
  ) {
    return "green";
  }
  if (
    nameLower.includes("accuracy") ||
    nameLower.includes("correct") ||
    nameLower.includes("precise")
  ) {
    return "emerald";
  }
  if (
    nameLower.includes("excellence") ||
    nameLower.includes("quality") ||
    nameLower.includes("performance")
  ) {
    return "orange";
  }
  if (
    nameLower.includes("thinking") ||
    nameLower.includes("analysis") ||
    nameLower.includes("problem")
  ) {
    return "indigo";
  }
  if (
    nameLower.includes("creative") ||
    nameLower.includes("innovation") ||
    nameLower.includes("idea")
  ) {
    return "pink";
  }

  // Default color
  return "slate";
};

// Point-based color mapping for badges
const getPointColorClass = (points: number, maxPoints: number): string => {
  const percentage = (points / maxPoints) * 100;

  if (percentage >= 90) return "bg-green-100 text-green-800 border-green-200";
  if (percentage >= 70) return "bg-blue-100 text-blue-800 border-blue-200";
  if (percentage >= 50)
    return "bg-yellow-100 text-yellow-800 border-yellow-200";
  if (percentage >= 30)
    return "bg-orange-100 text-orange-800 border-orange-200";
  return "bg-red-100 text-red-800 border-red-200";
};

// Helper function to get background and text colors for icons
const getColorClasses = (color: string) => {
  const colorMap = {
    blue: { bg: "bg-blue-100", text: "text-blue-600" },
    amber: { bg: "bg-amber-100", text: "text-amber-600" },
    purple: { bg: "bg-purple-100", text: "text-purple-600" },
    green: { bg: "bg-green-100", text: "text-green-600" },
    emerald: { bg: "bg-emerald-100", text: "text-emerald-600" },
    orange: { bg: "bg-orange-100", text: "text-orange-600" },
    indigo: { bg: "bg-indigo-100", text: "text-indigo-600" },
    pink: { bg: "bg-pink-100", text: "text-pink-600" },
    slate: { bg: "bg-slate-100", text: "text-slate-600" },
  };

  return colorMap[color as keyof typeof colorMap] || colorMap.slate;
};

export interface RubricStandardGroupProps {
  group?: StandardGroup;
  standards?: Standard[];
  rubricId: string;
  index: number;
  isOpen: boolean;
  onToggle: (index: number) => void;
  mode?: "edit" | "create";
}

interface StandardFormData {
  id?: string;
  name: string;
  description: string;
  points: string; // Changed to string for better input handling
  isNew?: boolean;
  isDeleted?: boolean;
}

interface StandardGroupFormData {
  name: string;
  description: string;
  points: string; // Changed to string for better input handling
  passPoints: string; // Changed to string for better input handling
}

export default function RubricStandardGroup({
  group,
  standards = [],
  rubricId,
  index,
  isOpen,
  onToggle,
  mode = "edit",
}: RubricStandardGroupProps) {
  const [isEditing, setIsEditing] = useState(mode === "create");

  // Mutation hooks
  const createStandardGroupMutation = useCreateStandardGroup();
  const updateStandardGroupMutation = useUpdateStandardGroup();
  const deleteStandardGroupMutation = useDeleteStandardGroup();
  const createStandardMutation = useCreateStandard();
  const updateStandardMutation = useUpdateStandard();
  const deleteStandardsMutation = useDeleteStandards();
  const updateRubricMutation = useUpdateRubric();
  const { data: standardGroups } = useStandardGroupsByRubricId(rubricId);

  // Form state for standard group
  const [groupFormData, setGroupFormData] = useState<StandardGroupFormData>({
    name: group?.name || "",
    description: group?.description || "",
    points: group?.points?.toString() || "5",
    passPoints: group?.passPoints?.toString() || "4",
  });

  // Form state for standards
  const [standardsFormData, setStandardsFormData] = useState<
    StandardFormData[]
  >([]);

  // Initialize standards form data when component mounts or standards change
  useEffect(() => {
    if (mode === "create") {
      // Don't reset standardsFormData in create mode to preserve user input
      return;
    }

    const groupStandards = standards.filter(
      (s) => s.standardGroupId === group?.id
    );
    // Sort standards by points (highest to lowest)
    const sortedStandards = groupStandards.sort((a, b) => b.points - a.points);
    const formData = sortedStandards.map((standard) => ({
      id: standard.id,
      name: standard.name,
      description: standard.description,
      points: standard.points.toString(),
      isNew: false,
      isDeleted: false,
    }));
    setStandardsFormData(formData);
  }, [standards, group?.id, mode]);

  const handleGroupInputChange = (
    field: keyof StandardGroupFormData,
    value: string
  ) => {
    setGroupFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleStandardInputChange = (
    standardIndex: number,
    field: keyof StandardFormData,
    value: string
  ) => {
    setStandardsFormData((prev) => {
      const updated = [...prev];
      updated[standardIndex] = { ...updated[standardIndex]!, [field]: value };
      return updated;
    });
  };

  const handleAddStandard = () => {
    const newStandard: StandardFormData = {
      name: "",
      description: "",
      points: "0",
      isNew: true,
      isDeleted: false,
    };
    setStandardsFormData((prev) => [...prev, newStandard]);
  };

  const handleDeleteStandard = (standardIndex: number) => {
    setStandardsFormData((prev) => {
      const updated = [...prev];
      const standard = updated[standardIndex]!;

      if (standard.isNew) {
        // Remove new standards completely
        return updated.filter((_, i) => i !== standardIndex);
      } else {
        // Mark existing standards for deletion
        updated[standardIndex] = { ...standard, isDeleted: true };
        return updated;
      }
    });
  };

  const validateForm = (): string[] => {
    const errors: string[] = [];

    // Validate group data
    if (!groupFormData.name.trim()) {
      errors.push("Standard group name is required");
    }
    if (!groupFormData.description.trim()) {
      errors.push("Standard group description is required");
    }

    const groupPoints = parseInt(groupFormData.points);
    const groupPassPoints = parseInt(groupFormData.passPoints);

    if (isNaN(groupPoints) || groupPoints <= 0) {
      errors.push(
        "Standard group points must be a valid number greater than 0"
      );
    }
    if (isNaN(groupPassPoints) || groupPassPoints <= 0) {
      errors.push(
        "Standard group pass points must be a valid number greater than 0"
      );
    }
    if (
      !isNaN(groupPoints) &&
      !isNaN(groupPassPoints) &&
      groupPassPoints > groupPoints
    ) {
      errors.push("Pass points cannot exceed maximum points");
    }

    // Validate standards
    const activeStandards = standardsFormData.filter((s) => !s.isDeleted);

    if (activeStandards.length === 0) {
      errors.push("At least one standard is required");
    }

    activeStandards.forEach((standard, index) => {
      if (!standard.name.trim()) {
        errors.push(`Standard ${index + 1}: Name is required`);
      }
      if (!standard.description.trim()) {
        errors.push(`Standard ${index + 1}: Description is required`);
      }

      const standardPoints = parseInt(standard.points);
      if (isNaN(standardPoints) || standardPoints <= 0) {
        errors.push(
          `Standard ${index + 1}: Points must be a valid number greater than 0`
        );
      }
      if (
        !isNaN(standardPoints) &&
        !isNaN(groupPoints) &&
        standardPoints > groupPoints
      ) {
        errors.push(
          `Standard ${index + 1}: Points cannot exceed group maximum (${groupPoints})`
        );
      }
    });

    // Check if passing is possible
    const standardPointsArray = activeStandards
      .map((s) => parseInt(s.points))
      .filter((p) => !isNaN(p));
    if (standardPointsArray.length > 0 && !isNaN(groupPassPoints)) {
      const maxStandardPoints = Math.max(...standardPointsArray);
      if (maxStandardPoints < groupPassPoints) {
        errors.push("No standard has enough points to meet the pass threshold");
      }
    }

    return errors;
  };

  const handleSave = async () => {
    const errors = validateForm();
    if (errors.length > 0) {
      toast.error(`Validation errors: ${errors.join(", ")}`);
      return;
    }

    try {
      if (mode === "create") {
        // Create new standard group
        const newGroup = await createStandardGroupMutation.mutateAsync({
          ...groupFormData,
          points: parseInt(groupFormData.points),
          passPoints: parseInt(groupFormData.passPoints),
          rubricId,
          shortName: groupFormData.name.substring(0, 10).toUpperCase(),
        });

        // Create standards for the new group
        if (newGroup?.id) {
          const promises: Promise<unknown>[] = [];
          standardsFormData.forEach((standard) => {
            if (!standard.isDeleted) {
              promises.push(
                createStandardMutation.mutateAsync({
                  name: standard.name,
                  description: standard.description,
                  points: parseInt(standard.points),
                  standardGroupId: newGroup.id,
                })
              );
            }
          });

          await Promise.all(promises);
        }

        toast.success("Standard group and standards created successfully");
      } else {
        // Update existing standard group
        await updateStandardGroupMutation.mutateAsync({
          id: group!.id,
          ...groupFormData,
          points: parseInt(groupFormData.points),
          passPoints: parseInt(groupFormData.passPoints),
        });

        // Handle standards with bulk operations
        const promises: Promise<unknown>[] = [];

        // Collect standards to delete for bulk operation
        const standardsToDelete = standardsFormData
          .filter((standard) => standard.isDeleted && standard.id)
          .map((standard) => standard.id!);

        // Collect standards to create
        const standardsToCreate = standardsFormData
          .filter((standard) => standard.isNew && !standard.isDeleted)
          .map((standard) => ({
            name: standard.name,
            description: standard.description,
            points: parseInt(standard.points),
            standardGroupId: group!.id,
          }));

        // Collect standards to update
        const standardsToUpdate = standardsFormData
          .filter(
            (standard) => !standard.isNew && !standard.isDeleted && standard.id
          )
          .map((standard) => ({
            id: standard.id,
            name: standard.name,
            description: standard.description,
            points: parseInt(standard.points),
          }));

        // Execute bulk operations
        if (standardsToDelete.length > 0) {
          promises.push(
            deleteStandardsMutation.mutateAsync({ ids: standardsToDelete })
          );
        }

        if (standardsToCreate.length > 0) {
          promises.push(
            ...standardsToCreate.map((standard) =>
              createStandardMutation.mutateAsync(standard)
            )
          );
        }

        if (standardsToUpdate.length > 0) {
          promises.push(
            ...standardsToUpdate.map((standard) =>
              updateStandardMutation.mutateAsync({
                id: standard.id!,
                name: standard.name,
                description: standard.description,
                points: standard.points,
              })
            )
          );
        }

        await Promise.all(promises);
        setIsEditing(false);
        toast.success("All changes saved successfully");
      }

      // Update rubric points after successful save
      await updateRubricPoints();
    } catch (error) {
      log.error("rubric.standard_group.save.failed", {
        message: "Error saving standard group changes",
        error,
        context: { component: "RubricStandardGroup", rubricId, mode },
      });
      toast.error("Failed to save changes");
    }
  };

  const handleCancel = () => {
    if (mode === "create") {
      // Reset to empty form for create mode
      setGroupFormData({
        name: "",
        description: "",
        points: "5",
        passPoints: "4",
      });
      setStandardsFormData([]);
    } else {
      setIsEditing(false);
      // Reset form data
      setGroupFormData({
        name: group!.name,
        description: group!.description,
        points: group!.points.toString(),
        passPoints: group!.passPoints.toString(),
      });

      // Reset standards data
      const groupStandards = standards.filter(
        (s) => s.standardGroupId === group?.id
      );
      const sortedStandards = groupStandards.sort(
        (a, b) => b.points - a.points
      );
      const formData = sortedStandards.map((standard) => ({
        id: standard.id,
        name: standard.name,
        description: standard.description,
        points: standard.points.toString(),
        isNew: false,
        isDeleted: false,
      }));
      setStandardsFormData(formData);
    }
  };

  const handleDeleteGroup = async () => {
    if (
      confirm(
        "Are you sure you want to delete this standard group? This will also delete all associated standards."
      )
    ) {
      try {
        await deleteStandardGroupMutation.mutateAsync(group!.id);
        toast.success("Standard group deleted successfully");
        await updateRubricPoints();
      } catch (error) {
        log.error("rubric.standard_group.delete.failed", {
          message: "Error deleting standard group",
          error,
          context: {
            component: "RubricStandardGroup",
            rubricId,
            groupId: group!.id,
          },
        });
        toast.error("Failed to delete standard group");
      }
    }
  };

  // Function to update rubric points based on all standard groups
  const updateRubricPoints = async () => {
    // Skip updating rubric points in creation mode
    if (rubricId === "new") {
      return;
    }

    try {
      // Use the data from the hook instead of fetching manually
      if (standardGroups) {
        const totalPoints = standardGroups.reduce(
          (sum, group) => sum + group.points,
          0
        );
        const totalPassPoints = standardGroups.reduce(
          (sum, group) => sum + group.passPoints,
          0
        );

        // Update the rubric with new totals
        await updateRubricMutation.mutateAsync({
          id: rubricId,
          points: totalPoints,
          passPoints: totalPassPoints,
        });
      }
    } catch (error) {
      log.error("rubric.points.update.failed", {
        message: "Error updating rubric points",
        error,
        context: { component: "RubricStandardGroup", rubricId },
      });
    }
  };

  // Get visible standards (not deleted) and sort by points only when not editing
  const visibleStandards = standardsFormData
    .filter((s) => !s.isDeleted)
    .sort((a, b) => (isEditing ? 0 : parseInt(b.points) - parseInt(a.points)));

  // Check if we can add more standards
  const groupPointsNum = parseInt(groupFormData.points) || 0;
  const canAddStandard = visibleStandards.length < groupPointsNum;

  // Get icon and color for the group
  const IconComponent = getIconForName(groupFormData.name);
  const color = getColorForName(groupFormData.name);
  const colorClasses = getColorClasses(color);

  return (
    <Card className="overflow-hidden w-full max-w-full">
      <Collapsible open={isOpen} onOpenChange={() => onToggle(index)}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/20 transition-colors">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div
                  className={`p-2 rounded-lg ${colorClasses.bg} flex-shrink-0`}
                >
                  <IconComponent className={`h-5 w-5 ${colorClasses.text}`} />
                </div>
                <div className="flex-1 min-w-0">
                  {isEditing ? (
                    <div
                      className="space-y-3 w-full"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div>
                        <Label className="text-xs">Name</Label>
                        <Input
                          value={groupFormData.name}
                          onChange={(e) =>
                            handleGroupInputChange("name", e.target.value)
                          }
                          className="text-lg font-semibold w-full"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Description</Label>
                        <Textarea
                          value={groupFormData.description}
                          onChange={(e) =>
                            handleGroupInputChange(
                              "description",
                              e.target.value
                            )
                          }
                          className="text-sm w-full"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs">Max Points</Label>
                          <Input
                            type="number"
                            value={groupFormData.points}
                            onChange={(e) =>
                              handleGroupInputChange("points", e.target.value)
                            }
                            className="text-sm"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Pass Points</Label>
                          <Input
                            type="number"
                            value={groupFormData.passPoints}
                            onChange={(e) =>
                              handleGroupInputChange(
                                "passPoints",
                                e.target.value
                              )
                            }
                            className="text-sm"
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="min-w-0">
                      <CardTitle className="text-lg truncate">
                        {mode === "create" ? "New Standard Group" : group!.name}
                      </CardTitle>
                      <CardDescription className="truncate">
                        {mode === "create"
                          ? "Create a new evaluation category"
                          : group!.description}
                      </CardDescription>
                      {mode === "edit" && (
                        <div className="flex gap-2 pt-2 flex-wrap">
                          <Badge variant="outline">
                            Total: {group!.points} points
                          </Badge>
                          <Badge variant="outline">
                            Pass: {group!.passPoints} points
                          </Badge>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {!isEditing && mode === "edit" && (
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsEditing(true);
                      }}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteGroup();
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
                {isOpen ? (
                  <ChevronUp className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">Points</TableHead>
                  <TableHead className="w-40">Name</TableHead>
                  <TableHead className="w-full">Description</TableHead>
                  {isEditing && <TableHead className="w-20">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleStandards.map((standard, standardIndex) => (
                  <TableRow key={standard.id || `new-${standardIndex}`}>
                    <TableCell className="w-20">
                      {isEditing ? (
                        <Input
                          type="number"
                          value={standard.points}
                          onChange={(e) =>
                            handleStandardInputChange(
                              standardIndex,
                              "points",
                              e.target.value
                            )
                          }
                          className="text-sm w-16"
                          min="0"
                          max={groupFormData.points}
                        />
                      ) : (
                        <Badge
                          className={`font-semibold ${getPointColorClass(parseInt(standard.points), parseInt(groupFormData.points))}`}
                        >
                          {standard.points}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="w-40">
                      {isEditing ? (
                        <Input
                          value={standard.name}
                          onChange={(e) =>
                            handleStandardInputChange(
                              standardIndex,
                              "name",
                              e.target.value
                            )
                          }
                          className="text-sm"
                          placeholder="Standard name"
                        />
                      ) : (
                        <span className="font-medium truncate block">
                          {standard.name}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="w-full max-w-0">
                      {isEditing ? (
                        <Textarea
                          value={standard.description}
                          onChange={(e) =>
                            handleStandardInputChange(
                              standardIndex,
                              "description",
                              e.target.value
                            )
                          }
                          className="text-sm min-h-[60px] max-w-full"
                          placeholder="Standard description"
                        />
                      ) : (
                        <div className="w-full overflow-hidden">
                          <span className="text-sm leading-relaxed line-clamp-2 block truncate">
                            {standard.description}
                          </span>
                        </div>
                      )}
                    </TableCell>
                    {isEditing && (
                      <TableCell className="w-20">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteStandard(standardIndex)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Add New Standard Button - Only show when editing */}
            {isEditing && (
              <div className="mt-4">
                {canAddStandard ? (
                  <Button
                    onClick={handleAddStandard}
                    size="sm"
                    variant="outline"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add Standard
                  </Button>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Cannot add more standards (limit: {groupFormData.points})
                  </p>
                )}
              </div>
            )}

            {/* Save/Cancel buttons - Only show when editing */}
            {isEditing && (
              <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
                <Button variant="outline" onClick={handleCancel}>
                  Cancel
                </Button>
                <Button onClick={handleSave}>
                  {mode === "create" ? "Create" : "Update"}
                </Button>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
