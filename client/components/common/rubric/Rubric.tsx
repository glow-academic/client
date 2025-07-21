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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { logError } from "@/utils/logger";
import { createRubric } from "@/utils/mutations/rubrics/create-rubric";
import { updateRubric } from "@/utils/mutations/rubrics/update-rubric";
import { getRubric } from "@/utils/queries/rubrics/get-rubric";
import { getStandardGroupsByRubric } from "@/utils/queries/standard_groups/get-standard-groups-by-rubric";
import { getStandardsByStandardGroups } from "@/utils/queries/standards/get-standards-by-standardgroups";
import { BookOpen } from "lucide-react";
import RubricDetails from "./RubricDetails";
import RubricStandardGroup from "./RubricStandardGroup";

export interface RubricProps {
  rubricId?: string;
}

export default function Rubric({ rubricId }: RubricProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const isEditMode = !!rubricId;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    points: 100,
    passPoints: 70,
    active: true,
  });

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
    enabled: isEditMode,
  });

  const { data: standards, isLoading: standardsLoading } = useQuery({
    queryKey: ["standards", standardGroups?.map((group) => group.id)],
    queryFn: () =>
      getStandardsByStandardGroups(standardGroups!.map((group) => group.id)),
    enabled: !!standardGroups && standardGroups.length > 0,
  });

  const isLoading = rubricLoading || standardGroupsLoading || standardsLoading;

  // Initialize form values when data loads
  useEffect(() => {
    if (isEditMode && rubric) {
      setFormData({
        name: rubric.name || "",
        description: rubric.description || "",
        points: rubric.points || 100,
        passPoints: rubric.passPoints || 70,
        active: rubric.active ?? true,
      });
    }
  }, [rubric, isEditMode]);

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
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["rubrics"] });
      toast.success("Rubric created successfully!");
      if (data?.id) {
        router.push(`/create/rubrics/${data.id}`);
      } else {
        router.push("/create/rubrics");
      }
    },
    onError: (error) => {
      logError("Error creating rubric:", error);
      toast.error("Failed to create rubric");
    },
  });

  const updateRubricPointsMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: { points: number; passPoints: number };
    }) => updateRubric(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rubric", rubricId] });
      // Don't show toast for automatic updates
    },
    onError: (error) => {
      logError("Error updating rubric points:", error);
      // Don't show error toast for automatic updates
    },
  });

  // Auto-calculate rubric points when standard groups change
  useEffect(() => {
    if (isEditMode && standardGroups && rubric && rubricId) {
      const totalPoints = standardGroups.reduce(
        (sum, group) => sum + group.points,
        0
      );
      const totalPassPoints = standardGroups.reduce(
        (sum, group) => sum + group.passPoints,
        0
      );

      // Only update if the calculated values differ from current rubric values
      if (
        totalPoints !== rubric.points ||
        totalPassPoints !== rubric.passPoints
      ) {
        updateRubricPointsMutation.mutate({
          id: rubricId,
          data: {
            points: totalPoints,
            passPoints: totalPassPoints,
          },
        });
      }
    }
  }, [
    standardGroups,
    rubric,
    isEditMode,
    rubricId,
    updateRubricPointsMutation,
  ]);

  // Helper functions
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
      createMutation.mutate(formData);
    } catch (error) {
      logError("Error creating rubric:", error);
      toast.error("Failed to create rubric");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    router.push("/create/rubrics");
  };

  const handleInputChange = (
    field: keyof typeof formData,
    value: string | number | boolean
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Loading state
  if (isLoading) {
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

  return (
    <div className="space-y-6">
      {/* Rubric Header - Use RubricDetails component in edit mode */}
      {isEditMode && rubric ? (
        <RubricDetails rubric={rubric} rubricId={rubricId!} />
      ) : null}

      {/* Create Mode Form */}
      {!isEditMode && (
        <Card>
          <CardHeader>
            <CardTitle>Rubric Details</CardTitle>
            <CardDescription>
              Define the basic information for this evaluation rubric.
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
                    onChange={(e) => handleInputChange("name", e.target.value)}
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
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="active"
                    checked={formData.active}
                    onCheckedChange={(checked) =>
                      handleInputChange("active", checked)
                    }
                  />
                  <Label htmlFor="active">Active</Label>
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
                  {isSubmitting ? "Creating..." : "Create Rubric"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Standard Groups - Only show in edit mode */}
      {isEditMode && (
        <div className="space-y-6">
          {/* Existing Standard Groups */}
          {standardGroups?.map((group, index) => (
            <RubricStandardGroup
              key={group.id}
              group={group}
              standards={standards || []}
              rubricId={rubricId!}
              index={index}
              isOpen={openCards[index] ?? false}
              onToggle={toggleCard}
              mode="edit"
            />
          ))}

          {/* Add New Standard Group */}
          <RubricStandardGroup
            rubricId={rubricId!}
            index={standardGroups?.length || 0}
            isOpen={true}
            onToggle={() => {}} // No toggle needed for create mode
            mode="create"
          />
        </div>
      )}

      {/* Information Card for Create Mode */}
      {!isEditMode && (
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
                    {Math.round((formData.passPoints / formData.points) * 100)}
                    %)
                  </Badge>
                  <Badge variant={formData.active ? "default" : "secondary"}>
                    {formData.active ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
