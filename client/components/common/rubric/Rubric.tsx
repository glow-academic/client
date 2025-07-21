/**
 * Rubric.tsx
 * Used to create and manage rubrics - supports both creation and editing with full functionality
 * @AshokSaravanan222 & @siladiea
 * 05/20/2025
 */
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Rubric as RubricType, Standard, StandardGroup } from "@/types";
import { logError } from "@/utils/logger";
import { createRubric } from "@/utils/mutations/rubrics/create-rubric";
import { updateRubric } from "@/utils/mutations/rubrics/update-rubric";
import { updateStandardGroup } from "@/utils/mutations/standard_groups/update-standard-group";
import { updateStandard } from "@/utils/mutations/standards/update-standard";
import { getRubric } from "@/utils/queries/rubrics/get-rubric";
import { getStandardGroupsByRubric } from "@/utils/queries/standard_groups/get-standard-groups-by-rubric";
import { getStandardsByStandardGroups } from "@/utils/queries/standards/get-standards-by-standardgroups";
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  Clock,
  Edit,
  LucideIcon,
  MessageSquare,
  Save,
  Target,
  Users,
  X,
} from "lucide-react";

// Icon mapping for different criteria
const iconMap: Record<string, LucideIcon> = {
  "Facilitates student-driven learning": MessageSquare,
  "Demonstrates understanding of course objectives": Target,
  "Manages session time effectively": Clock,
  "Adapts approach to individual student needs": Users,
};

// Color mapping for different criteria
const colorMap: Record<string, string> = {
  "Facilitates student-driven learning": "blue",
  "Demonstrates understanding of course objectives": "green",
  "Manages session time effectively": "amber",
  "Adapts approach to individual student needs": "purple",
};

const ratingLabels = {
  5: "Excellent",
  4: "Good",
  3: "Acceptable",
  2: "Marginal",
  1: "Poor",
};

const ratingColors = {
  5: "bg-green-100 text-green-800 border-green-200",
  4: "bg-blue-100 text-blue-800 border-blue-200",
  3: "bg-yellow-100 text-yellow-800 border-yellow-200",
  2: "bg-orange-100 text-orange-800 border-orange-200",
  1: "bg-red-100 text-red-800 border-red-200",
};

interface EditingState {
  rubric: boolean;
  standardGroups: Record<string, boolean>;
  standards: Record<string, boolean>;
}

export interface RubricProps {
  rubricId?: string;
  mode?: "create" | "edit";
  showAdvancedFeatures?: boolean;
}

export default function Rubric({
  rubricId,
  mode = rubricId ? "edit" : "create",
  showAdvancedFeatures = true,
}: RubricProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const isEditMode = mode === "edit" && !!rubricId;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    points: 100,
    passPoints: 70,
  });

  // State for advanced editing
  const [editing, setEditing] = useState<EditingState>({
    rubric: false,
    standardGroups: {},
    standards: {},
  });

  const [standardGroupForms, setStandardGroupForms] = useState<
    Record<string, Partial<StandardGroup>>
  >({});
  const [standardForms, setStandardForms] = useState<
    Record<string, Partial<Standard>>
  >({});
  const [openCards, setOpenCards] = useState<Record<number, boolean>>({});

  // Queries
  const { data: rubric, isLoading: rubricLoading } = useQuery({
    queryKey: ["rubric", rubricId],
    queryFn: () => getRubric(rubricId!),
    enabled: isEditMode,
  });

  const { data: standardGroups, isLoading: standardGroupsLoading } = useQuery({
    queryKey: ["standardGroups", rubricId],
    queryFn: () => getStandardGroupsByRubric(rubricId!),
    enabled: isEditMode && showAdvancedFeatures,
  });

  const { data: standards, isLoading: standardsLoading } = useQuery({
    queryKey: ["standards", standardGroups?.map((group) => group.id)],
    queryFn: () =>
      getStandardsByStandardGroups(standardGroups!.map((group) => group.id)),
    enabled:
      !!standardGroups && standardGroups.length > 0 && showAdvancedFeatures,
  });

  const isLoading =
    rubricLoading ||
    (showAdvancedFeatures && (standardGroupsLoading || standardsLoading));

  // Initialize form values when data loads
  useEffect(() => {
    if (isEditMode && rubric) {
      setFormData({
        name: rubric.name || "",
        description: rubric.description || "",
        points: rubric.points || 100,
        passPoints: rubric.passPoints || 70,
      });
    }
  }, [rubric, isEditMode]);

  useEffect(() => {
    if (standardGroups) {
      const forms: Record<string, Partial<StandardGroup>> = {};
      standardGroups.forEach((group) => {
        forms[group.id] = {
          name: group.name,
          description: group.description,
          points: group.points,
          passPoints: group.passPoints,
        };
      });
      setStandardGroupForms(forms);
    }
  }, [standardGroups]);

  useEffect(() => {
    if (standards) {
      const forms: Record<string, Partial<Standard>> = {};
      standards.forEach((standard) => {
        forms[standard.id] = {
          name: standard.name,
          description: standard.description,
          points: standard.points,
        };
      });
      setStandardForms(forms);
    }
  }, [standards]);

  // Initialize open cards when standard groups load
  useEffect(() => {
    if (standardGroups) {
      const initialOpenState: Record<number, boolean> = {};
      standardGroups.forEach((_, index) => {
        initialOpenState[index] = true;
      });
      setOpenCards(initialOpenState);
    }
  }, [standardGroups]);

  // Mutations
  const createMutation = useMutation({
    mutationFn: createRubric,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rubrics"] });
      toast.success("Rubric created successfully!");
      router.push("/create/rubrics");
    },
    onError: (error) => {
      logError("Error creating rubric:", error);
      toast.error("Failed to create rubric");
    },
  });

  const updateRubricMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<RubricType> }) =>
      updateRubric(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rubric", rubricId] });
      queryClient.invalidateQueries({ queryKey: ["rubrics"] });
      if (showAdvancedFeatures) {
        toast.success("Rubric updated successfully");
        setEditing((prev) => ({ ...prev, rubric: false }));
      } else {
        toast.success("Rubric updated successfully!");
        router.push("/create/rubrics");
      }
    },
    onError: (error) => {
      logError("Error updating rubric:", error);
      toast.error("Failed to update rubric");
    },
  });

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

  const updateStandardMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Standard> }) =>
      updateStandard(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["standards", standardGroups?.map((group) => group.id)],
      });
      toast.success("Standard updated successfully");
    },
    onError: () => {
      toast.error("Failed to update standard");
    },
  });

  // Helper functions
  const getStandardsByGroupAndRating = (groupId: string) => {
    if (!standards) return {};

    const groupStandards = standards.filter(
      (s) => s.standardGroupId === groupId
    );
    const ratingMap: Record<number, Standard> = {};

    groupStandards.forEach((standard) => {
      // Extract rating from name (e.g., "Excellent (5)" -> 5)
      const ratingMatch = standard.name.match(/\((\d+)\)/);
      if (ratingMatch) {
        const rating = parseInt(ratingMatch[1]!);
        ratingMap[rating] = standard;
      }
    });

    return ratingMap;
  };

  const toggleCard = (index: number) => {
    setOpenCards((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  // Event handlers
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error("Rubric name is required");
      return;
    }

    if (!formData.description.trim()) {
      toast.error("Rubric description is required");
      return;
    }

    if (formData.points <= 0) {
      toast.error("Total points must be greater than 0");
      return;
    }

    if (formData.passPoints < 0 || formData.passPoints > formData.points) {
      toast.error("Pass points must be between 0 and total points");
      return;
    }

    setIsSubmitting(true);

    try {
      if (isEditMode) {
        updateRubricMutation.mutate({
          id: rubricId!,
          data: formData,
        });
      } else {
        createMutation.mutate(formData);
      }
    } catch (error) {
      logError(`Error ${isEditMode ? "updating" : "creating"} rubric:`, error);
      toast.error(`Failed to ${isEditMode ? "update" : "create"} rubric`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    router.push("/create/rubrics");
  };

  const handleInputChange = (
    field: keyof typeof formData,
    value: string | number
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSaveRubric = () => {
    updateRubricMutation.mutate({
      id: rubricId!,
      data: formData,
    });
  };

  const handleSaveStandardGroup = (groupId: string) => {
    updateStandardGroupMutation.mutate({
      id: groupId,
      data: standardGroupForms[groupId] || {},
    });
    setEditing((prev) => ({
      ...prev,
      standardGroups: { ...prev.standardGroups, [groupId]: false },
    }));
  };

  const handleSaveStandard = (standardId: string) => {
    updateStandardMutation.mutate({
      id: standardId,
      data: standardForms[standardId] || {},
    });
    setEditing((prev) => ({
      ...prev,
      standards: { ...prev.standards, [standardId]: false },
    }));
  };

  // Loading state for edit mode
  if (isEditMode && isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </div>
        <div className="container mx-auto max-w-4xl">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-4 w-64" />
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-20 w-full" />
              <div className="grid grid-cols-2 gap-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Error state for edit mode when rubric not found
  if (isEditMode && !isLoading && !rubric) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Rubric Not Found</h1>
          <p className="text-muted-foreground">
            The rubric you're looking for doesn't exist.
          </p>
        </div>
        <Button onClick={handleCancel}>Back to Rubrics</Button>
      </div>
    );
  }

  // For advanced features, show the full editing interface
  if (
    showAdvancedFeatures &&
    isEditMode &&
    rubric &&
    standardGroups &&
    standards
  ) {
    return (
      <div className="space-y-6">
        {/* Rubric Header */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1">
                {editing.rubric ? (
                  <div className="space-y-4">
                    <Input
                      value={formData.name}
                      onChange={(e) =>
                        handleInputChange("name", e.target.value)
                      }
                      className="text-2xl font-bold"
                      placeholder="Rubric Name"
                    />
                    <Textarea
                      value={formData.description}
                      onChange={(e) =>
                        handleInputChange("description", e.target.value)
                      }
                      placeholder="Rubric Description"
                    />
                    <div className="flex gap-4">
                      <div>
                        <label className="text-sm font-medium">
                          Total Points
                        </label>
                        <Input
                          type="number"
                          value={formData.points}
                          onChange={(e) =>
                            handleInputChange(
                              "points",
                              parseInt(e.target.value) || 0
                            )
                          }
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium">
                          Pass Points
                        </label>
                        <Input
                          type="number"
                          value={formData.passPoints}
                          onChange={(e) =>
                            handleInputChange(
                              "passPoints",
                              parseInt(e.target.value) || 0
                            )
                          }
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <h1 className="text-2xl font-bold">{rubric.name}</h1>
                    <p className="text-muted-foreground mt-2">
                      {rubric.description}
                    </p>
                    <div className="flex gap-4 mt-2">
                      <Badge variant="outline">
                        Total: {rubric.points} points
                      </Badge>
                      <Badge variant="outline">
                        Pass: {rubric.passPoints} points
                      </Badge>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                {editing.rubric ? (
                  <>
                    <Button onClick={handleSaveRubric} size="sm">
                      <Save className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditing((prev) => ({ ...prev, rubric: false }));
                        setFormData({
                          name: rubric.name,
                          description: rubric.description,
                          points: rubric.points,
                          passPoints: rubric.passPoints,
                        });
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setEditing((prev) => ({ ...prev, rubric: true }))
                    }
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Standard Groups */}
        <div className="space-y-6">
          {standardGroups.map((group, index) => {
            const IconComponent = iconMap[group.name] || Target;
            const color = colorMap[group.name] || "blue";
            const isOpen = openCards[index];
            const ratings = getStandardsByGroupAndRating(group.id);
            const isEditingGroup = editing.standardGroups[group.id];

            return (
              <Card key={group.id} className="overflow-hidden">
                <Collapsible
                  open={isOpen ?? false}
                  onOpenChange={() => toggleCard(index)}
                >
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-muted/20 transition-colors">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 flex-1">
                          <div
                            className={`p-2 rounded-lg ${
                              color === "blue"
                                ? "bg-blue-100"
                                : color === "green"
                                  ? "bg-green-100"
                                  : color === "amber"
                                    ? "bg-amber-100"
                                    : "bg-purple-100"
                            }`}
                          >
                            <IconComponent
                              className={`h-5 w-5 ${
                                color === "blue"
                                  ? "text-blue-600"
                                  : color === "green"
                                    ? "text-green-600"
                                    : color === "amber"
                                      ? "text-amber-600"
                                      : "text-purple-600"
                              }`}
                            />
                          </div>
                          <div className="flex-1">
                            {isEditingGroup ? (
                              <div
                                className="space-y-2 w-full"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Input
                                  value={
                                    standardGroupForms[group.id]?.name || ""
                                  }
                                  onChange={(e) =>
                                    setStandardGroupForms((prev) => ({
                                      ...prev,
                                      [group.id]: {
                                        ...prev[group.id],
                                        name: e.target.value,
                                      },
                                    }))
                                  }
                                  className="text-lg font-semibold w-full"
                                />
                                <Textarea
                                  value={
                                    standardGroupForms[group.id]?.description ||
                                    ""
                                  }
                                  onChange={(e) =>
                                    setStandardGroupForms((prev) => ({
                                      ...prev,
                                      [group.id]: {
                                        ...prev[group.id],
                                        description: e.target.value,
                                      },
                                    }))
                                  }
                                  className="text-sm w-full"
                                />
                              </div>
                            ) : (
                              <div>
                                <CardTitle className="text-lg">
                                  {group.name}
                                </CardTitle>
                                <CardDescription>
                                  {group.description}
                                </CardDescription>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {isEditingGroup ? (
                            <div
                              className="flex gap-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Button
                                size="sm"
                                onClick={() =>
                                  handleSaveStandardGroup(group.id)
                                }
                              >
                                <Save className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setEditing((prev) => ({
                                    ...prev,
                                    standardGroups: {
                                      ...prev.standardGroups,
                                      [group.id]: false,
                                    },
                                  }));
                                }}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditing((prev) => ({
                                  ...prev,
                                  standardGroups: {
                                    ...prev.standardGroups,
                                    [group.id]: true,
                                  },
                                }));
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
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
                            <TableHead className="w-24">Rating</TableHead>
                            <TableHead className="w-32">Level</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead className="w-20">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {[5, 4, 3, 2, 1].map((rating) => {
                            const standard = ratings[rating];
                            if (!standard) return null;

                            const isEditingStandard =
                              editing.standards[standard.id];

                            return (
                              <TableRow key={standard.id}>
                                <TableCell>
                                  <Badge
                                    className={`font-semibold ${ratingColors[rating as keyof typeof ratingColors]}`}
                                  >
                                    {rating}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <span className="font-medium">
                                    {
                                      ratingLabels[
                                        rating as keyof typeof ratingLabels
                                      ]
                                    }
                                  </span>
                                </TableCell>
                                <TableCell className="text-sm leading-relaxed">
                                  {isEditingStandard ? (
                                    <Textarea
                                      value={
                                        standardForms[standard.id]
                                          ?.description || ""
                                      }
                                      onChange={(e) =>
                                        setStandardForms((prev) => ({
                                          ...prev,
                                          [standard.id]: {
                                            ...prev[standard.id],
                                            description: e.target.value,
                                          },
                                        }))
                                      }
                                      className="min-h-[60px] w-full"
                                    />
                                  ) : (
                                    standard.description
                                  )}
                                </TableCell>
                                <TableCell>
                                  {isEditingStandard ? (
                                    <div className="flex gap-1">
                                      <Button
                                        size="sm"
                                        onClick={() =>
                                          handleSaveStandard(standard.id)
                                        }
                                      >
                                        <Save className="h-3 w-3" />
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                          setEditing((prev) => ({
                                            ...prev,
                                            standards: {
                                              ...prev.standards,
                                              [standard.id]: false,
                                            },
                                          }));
                                        }}
                                      >
                                        <X className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  ) : (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() =>
                                        setEditing((prev) => ({
                                          ...prev,
                                          standards: {
                                            ...prev.standards,
                                            [standard.id]: true,
                                          },
                                        }))
                                      }
                                    >
                                      <Edit className="h-3 w-3" />
                                    </Button>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            );
          })}
        </div>
      </div>
    );
  }

  // For simple create/edit mode, show the basic form
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          {isEditMode ? "Edit Rubric" : "Create Rubric"}
        </h1>
        <p className="text-muted-foreground">
          {isEditMode
            ? "Modify the evaluation criteria and scoring for this rubric"
            : "Create a new evaluation rubric with scoring criteria"}
        </p>
      </div>

      <div className="container mx-auto max-w-4xl">
        <div className="grid gap-6">
          {/* Main Form */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Rubric Details
              </CardTitle>
              <CardDescription>
                {isEditMode
                  ? "Modify the basic information for this evaluation rubric."
                  : "Define the basic information for this evaluation rubric."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Rubric Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) =>
                        handleInputChange("name", e.target.value)
                      }
                      placeholder="e.g., Teaching Assistant Evaluation Rubric"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Description *</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) =>
                        handleInputChange("description", e.target.value)
                      }
                      placeholder="Describe the purpose and scope of this evaluation rubric"
                      rows={4}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="points">Total Points *</Label>
                      <Input
                        id="points"
                        type="number"
                        min="1"
                        value={formData.points}
                        onChange={(e) =>
                          handleInputChange(
                            "points",
                            parseInt(e.target.value) || 0
                          )
                        }
                        placeholder="100"
                        required
                      />
                      <p className="text-sm text-muted-foreground">
                        Maximum points achievable in this rubric
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="passPoints">Pass Points *</Label>
                      <Input
                        id="passPoints"
                        type="number"
                        min="0"
                        max={formData.points}
                        value={formData.passPoints}
                        onChange={(e) =>
                          handleInputChange(
                            "passPoints",
                            parseInt(e.target.value) || 0
                          )
                        }
                        placeholder="70"
                        required
                      />
                      <p className="text-sm text-muted-foreground">
                        Minimum points required to pass
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCancel}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting
                      ? isEditMode
                        ? "Updating..."
                        : "Creating..."
                      : isEditMode
                        ? "Update Rubric"
                        : "Create Rubric"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Information Card */}
          <Card className="bg-muted/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                About Rubrics
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <h4 className="font-semibold mb-2">What is a Rubric?</h4>
                  <ul className="text-sm space-y-1 text-muted-foreground">
                    <li>• A scoring guide for evaluating performance</li>
                    <li>• Defines criteria and performance levels</li>
                    <li>• Provides consistent evaluation standards</li>
                    <li>• Helps ensure fair and objective assessment</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Best Practices</h4>
                  <ul className="text-sm space-y-1 text-muted-foreground">
                    <li>• Use clear, specific criteria</li>
                    <li>• Define measurable performance levels</li>
                    <li>• Align with learning objectives</li>
                    <li>• Keep language simple and understandable</li>
                  </ul>
                </div>
              </div>

              {formData.points > 0 && (
                <div className="mt-4 p-3 bg-background rounded-lg border">
                  <h4 className="font-semibold mb-2">Current Configuration</h4>
                  <div className="flex gap-4">
                    <Badge variant="outline">
                      Total: {formData.points} points
                    </Badge>
                    <Badge variant="outline">
                      Pass: {formData.passPoints} points (
                      {Math.round(
                        (formData.passPoints / formData.points) * 100
                      )}
                      %)
                    </Badge>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
