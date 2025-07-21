/**
 * RubricStandardGroup.tsx
 * Used to display the standard group for the rubric page, in an editing mode for a form.
 * @AshokSaravanan222 & @siladiea
 * 06/07/2025
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Standard, StandardGroup } from "@/types";
import { createStandardGroup } from "@/utils/mutations/standard_groups/create-standard-group";
import { deleteStandardGroup } from "@/utils/mutations/standard_groups/delete-standard-group";
import { updateStandardGroup } from "@/utils/mutations/standard_groups/update-standard-group";
import { createStandard } from "@/utils/mutations/standards/create-standard";
import { deleteStandard } from "@/utils/mutations/standards/delete-standard";
import { updateStandard } from "@/utils/mutations/standards/update-standard";
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

interface RubricStandardGroupProps {
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
  points: number;
  isNew?: boolean;
  isDeleted?: boolean;
}

interface StandardGroupFormData {
  name: string;
  description: string;
  points: number;
  passPoints: number;
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
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(mode === "create");

  // Form state for standard group
  const [groupFormData, setGroupFormData] = useState<StandardGroupFormData>({
    name: group?.name || "",
    description: group?.description || "",
    points: group?.points || 25,
    passPoints: group?.passPoints || 18,
  });

  // Form state for standards
  const [standardsFormData, setStandardsFormData] = useState<
    StandardFormData[]
  >([]);

  // Initialize standards form data when component mounts or standards change
  useEffect(() => {
    if (mode === "create") {
      setStandardsFormData([]);
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
      points: standard.points,
      isNew: false,
      isDeleted: false,
    }));
    setStandardsFormData(formData);
  }, [standards, group?.id, mode]);

  const updateStandardGroupMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<StandardGroup> }) =>
      updateStandardGroup(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["standardGroups", rubricId] });
      toast.success("Standard group updated successfully");
    },
    onError: () => {
      toast.error("Failed to update standard group");
    },
  });

  const createStandardGroupMutation = useMutation({
    mutationFn: createStandardGroup,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["standardGroups", rubricId] });
      toast.success("Standard group created successfully");
      setIsEditing(false);
    },
    onError: () => {
      toast.error("Failed to create standard group");
    },
  });

  const deleteStandardGroupMutation = useMutation({
    mutationFn: deleteStandardGroup,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["standardGroups", rubricId] });
      toast.success("Standard group deleted successfully");
    },
    onError: () => {
      toast.error("Failed to delete standard group");
    },
  });

  const createStandardMutation = useMutation({
    mutationFn: createStandard,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["standards", [group?.id]],
      });
      toast.success("Standard created successfully");
    },
    onError: () => {
      toast.error("Failed to create standard");
    },
  });

  const updateStandardMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Standard> }) =>
      updateStandard(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["standards", [group?.id]],
      });
      toast.success("Standard updated successfully");
    },
    onError: () => {
      toast.error("Failed to update standard");
    },
  });

  const deleteStandardMutation = useMutation({
    mutationFn: deleteStandard,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["standards", [group?.id]],
      });
      toast.success("Standard deleted successfully");
    },
    onError: () => {
      toast.error("Failed to delete standard");
    },
  });

  const handleGroupInputChange = (
    field: keyof StandardGroupFormData,
    value: string | number
  ) => {
    setGroupFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleStandardInputChange = (
    standardIndex: number,
    field: keyof StandardFormData,
    value: string | number
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
      points: 0,
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
    if (groupFormData.points <= 0) {
      errors.push("Standard group points must be greater than 0");
    }
    if (groupFormData.passPoints <= 0) {
      errors.push("Standard group pass points must be greater than 0");
    }
    if (groupFormData.passPoints > groupFormData.points) {
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
      if (standard.points <= 0) {
        errors.push(`Standard ${index + 1}: Points must be greater than 0`);
      }
      if (standard.points > groupFormData.points) {
        errors.push(
          `Standard ${index + 1}: Points cannot exceed group maximum (${groupFormData.points})`
        );
      }
    });

    // Check if passing is possible
    const maxStandardPoints = Math.max(...activeStandards.map((s) => s.points));
    if (maxStandardPoints < groupFormData.passPoints) {
      errors.push("No standard has enough points to meet the pass threshold");
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
                  points: standard.points,
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
          data: groupFormData,
        });

        // Handle standards
        const promises: Promise<unknown>[] = [];

        standardsFormData.forEach((standard) => {
          if (standard.isDeleted && standard.id) {
            // Delete existing standards
            promises.push(deleteStandardMutation.mutateAsync(standard.id));
          } else if (standard.isNew && !standard.isDeleted) {
            // Create new standards
            promises.push(
              createStandardMutation.mutateAsync({
                name: standard.name,
                description: standard.description,
                points: standard.points,
                standardGroupId: group!.id,
              })
            );
          } else if (!standard.isNew && !standard.isDeleted && standard.id) {
            // Update existing standards
            promises.push(
              updateStandardMutation.mutateAsync({
                id: standard.id,
                data: {
                  name: standard.name,
                  description: standard.description,
                  points: standard.points,
                },
              })
            );
          }
        });

        await Promise.all(promises);
        setIsEditing(false);
        toast.success("All changes saved successfully");
      }
    } catch {
      toast.error("Failed to save changes");
    }
  };

  const handleCancel = () => {
    if (mode === "create") {
      // Reset to empty form for create mode
      setGroupFormData({
        name: "",
        description: "",
        points: 25,
        passPoints: 18,
      });
      setStandardsFormData([]);
    } else {
      setIsEditing(false);
      // Reset form data
      setGroupFormData({
        name: group!.name,
        description: group!.description,
        points: group!.points,
        passPoints: group!.passPoints,
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
        points: standard.points,
        isNew: false,
        isDeleted: false,
      }));
      setStandardsFormData(formData);
    }
  };

  const handleDeleteGroup = () => {
    if (
      confirm(
        "Are you sure you want to delete this standard group? This will also delete all associated standards."
      )
    ) {
      deleteStandardGroupMutation.mutate(group!.id);
    }
  };

  // Get visible standards (not deleted) and sort by points
  const visibleStandards = standardsFormData
    .filter((s) => !s.isDeleted)
    .sort((a, b) => b.points - a.points);

  // Check if we can add more standards
  const canAddStandard = visibleStandards.length < groupFormData.points;

  // Get icon and color for the group
  const IconComponent = getIconForName(groupFormData.name);
  const color = getColorForName(groupFormData.name);
  const colorClasses = getColorClasses(color);

  return (
    <Card className="overflow-hidden">
      <Collapsible open={isOpen} onOpenChange={() => onToggle(index)}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/20 transition-colors">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 flex-1">
                <div className={`p-2 rounded-lg ${colorClasses.bg}`}>
                  <IconComponent className={`h-5 w-5 ${colorClasses.text}`} />
                </div>
                <div className="flex-1">
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
                              handleGroupInputChange(
                                "points",
                                parseInt(e.target.value) || 0
                              )
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
                                parseInt(e.target.value) || 0
                              )
                            }
                            className="text-sm"
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <CardTitle className="text-lg">
                        {mode === "create" ? "New Standard Group" : group!.name}
                      </CardTitle>
                      <CardDescription>
                        {mode === "create"
                          ? "Create a new evaluation category"
                          : group!.description}
                      </CardDescription>
                      {mode === "edit" && (
                        <div className="flex gap-4 mt-2 text-sm text-muted-foreground">
                          <span>Max Points: {group!.points}</span>
                          <span>Pass Points: {group!.passPoints}</span>
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
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">Points</TableHead>
                  <TableHead className="w-40">Name</TableHead>
                  <TableHead>Description</TableHead>
                  {isEditing && <TableHead className="w-20">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleStandards.map((standard, standardIndex) => (
                  <TableRow key={standard.id || `new-${standardIndex}`}>
                    <TableCell>
                      {isEditing ? (
                        <Input
                          type="number"
                          value={standard.points}
                          onChange={(e) =>
                            handleStandardInputChange(
                              standardIndex,
                              "points",
                              parseInt(e.target.value) || 0
                            )
                          }
                          className="text-sm w-16"
                          min="0"
                          max={groupFormData.points}
                        />
                      ) : (
                        <Badge
                          className={`font-semibold ${getPointColorClass(standard.points, groupFormData.points)}`}
                        >
                          {standard.points}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
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
                        <span className="font-medium">{standard.name}</span>
                      )}
                    </TableCell>
                    <TableCell>
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
                          className="text-sm min-h-[60px]"
                          placeholder="Standard description"
                        />
                      ) : (
                        <span className="text-sm leading-relaxed">
                          {standard.description}
                        </span>
                      )}
                    </TableCell>
                    {isEditing && (
                      <TableCell>
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
