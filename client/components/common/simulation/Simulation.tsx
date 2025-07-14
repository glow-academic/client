/**
 * Simulation.tsx
 * Used to create and manage simulations for the admin dashboard
 * @AshokSaravanan222 & @siladiea
 * 05/20/2025
 */
"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

// UI Components
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { Cohort, Rubric, Scenario } from "@/types";
import { createSimulation } from "@/utils/mutations/simulations/create-simulation";
import { updateSimulation } from "@/utils/mutations/simulations/update-simulation";
import { getAllCohorts } from "@/utils/queries/cohorts/get-all-cohorts";
import { getAllRubrics } from "@/utils/queries/rubrics/get-all-rubrics";
import { getAllScenarios } from "@/utils/queries/scenarios/get-all-scenarios";
import { GripVertical, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { getSimulation } from "@/utils/queries/simulations/get-simulation";

export interface SimulationProps {
  simulationId?: string;
}

interface FormData {
  title?: string;
  timeLimit?: number | null;
  rubricId?: string;
  cohortIds?: string[];
  scenarioIds?: string[];
  active?: boolean;
}

interface FormErrors {
  title?: string;
  timeLimit?: string;
  rubricId?: string;
  cohortIds?: string[];
}

export default function Simulation({ simulationId }: SimulationProps) {
  const queryClient = useQueryClient();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingSimulationId, setEditingSimulationId] = useState<string | null>(
    null
  );
  const [draggedScenario, setDraggedScenario] = useState<string | null>(null);
  const [draggedCohort, setDraggedCohort] = useState<string | null>(null);
  const router = useRouter();

  const isEditMode = !!simulationId;

  const initialFormData: FormData = useMemo(
    () => ({
      title: "",
      timeLimit: 15,
      rubricId: "",
      cohortIds: [],
      scenarioIds: [],
      active: true,
    }),
    []
  );

  const [formData, setFormData] = useState<FormData>();
  const [errors, setErrors] = useState<FormErrors>({});

  // Fetch simulations for the list mode
  const { data: simulation, isLoading: isLoadingSimulation } = useQuery({
    queryKey: ["simulation", simulationId],
    queryFn: () => getSimulation(simulationId!),
    enabled: isEditMode,
  });

  const { data: cohorts = [], isLoading: isLoadingCohorts } = useQuery({
    queryKey: ["cohorts"],
    queryFn: () => getAllCohorts(),
  });

  const { data: rubrics = [], isLoading: isLoadingRubrics } = useQuery({
    queryKey: ["rubrics"],
    queryFn: () => getAllRubrics(),
  });

  const { data: scenarios = [], isLoading: isLoadingScenarios } = useQuery({
    queryKey: ["scenarios"],
    queryFn: () => getAllScenarios(),
  });

  const isLoading =
    isLoadingSimulation ||
    isLoadingCohorts ||
    isLoadingRubrics ||
    isLoadingScenarios;

  useEffect(() => {
    if (simulation && isEditMode) {
      setFormData({
        title: simulation.title,
        timeLimit: simulation.timeLimit,
        rubricId: simulation.rubricId,
        cohortIds: simulation.cohortIds,
        scenarioIds: simulation.scenarioIds,
        active: simulation.active,
      });
    } else if (!isEditMode) {
      setFormData(initialFormData);
    }
  }, [simulation, isEditMode, initialFormData]);

  const handleInputChange = (
    field: keyof FormData,
    value: string | number | boolean | string[] | null
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const addCohort = (cohortId: string) => {
    if (!formData?.cohortIds?.includes(cohortId)) {
      setFormData((prev) => ({
        ...prev,
        cohortIds: [...(prev?.cohortIds || []), cohortId],
      }));
    }
  };

  const removeCohort = (cohortId: string) => {
    setFormData((prev) => ({
      ...prev,
      cohortIds: prev?.cohortIds?.filter((id) => id !== cohortId) || [],
    }));
  };

  const addScenario = (scenarioId: string) => {
    if (!formData?.scenarioIds?.includes(scenarioId)) {
      setFormData((prev) => ({
        ...prev,
        scenarioIds: [...(prev?.scenarioIds || []), scenarioId],
      }));
    }
  };

  const removeScenario = (scenarioId: string) => {
    setFormData((prev) => ({
      ...prev,
      scenarioIds: prev?.scenarioIds?.filter((id) => id !== scenarioId) || [],
    }));
  };

  const handleDragStartScenario = (e: React.DragEvent, scenarioId: string) => {
    setDraggedScenario(scenarioId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragStartCohort = (e: React.DragEvent, cohortId: string) => {
    setDraggedCohort(cohortId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, targetScenarioId: string) => {
    e.preventDefault();

    if (!draggedScenario) return;

    const newOrder = [...(formData?.scenarioIds || [])];
    const draggedIndex = newOrder.findIndex((id) => id === draggedScenario);
    const targetIndex = newOrder.findIndex((id) => id === targetScenarioId);

    if (draggedIndex !== -1 && targetIndex !== -1) {
      const [removed] = newOrder.splice(draggedIndex, 1);
      newOrder.splice(targetIndex, 0, removed!);

      setFormData((prev) => ({ ...prev, scenarioIds: newOrder }));
    }

    setDraggedScenario(null);
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData?.title?.trim()) {
      newErrors.title = "Title is required";
    }

    if (
      formData?.timeLimit &&
      (formData.timeLimit < 1 || formData.timeLimit > 120)
    ) {
      newErrors.timeLimit = "Time limit must be between 1 and 120 minutes";
    }

    if (!formData?.rubricId) {
      newErrors.rubricId = "Rubric is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const resetFormAndState = () => {
    setFormData(initialFormData);
    setEditingSimulationId(null);
    setErrors({});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsSubmitting(true);

    try {
      let result;
      const targetSimulationId = simulationId || editingSimulationId;
      if (targetSimulationId) {
        result = await updateSimulation(targetSimulationId, {
          ...formData,
          updatedAt: new Date().toISOString(),
        });
      } else {
        result = await createSimulation({
          title: formData?.title || "",
          rubricId: formData?.rubricId || "",
          scenarioIds: formData?.scenarioIds || [],
          timeLimit: formData?.timeLimit || null,
          active: formData?.active || true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }

      if (!result) {
        toast.error("Failed to create simulation");
        return;
      }

      resetFormAndState();
      queryClient.invalidateQueries({ queryKey: ["simulations"] });
      toast.success(
        targetSimulationId
          ? "Simulation updated successfully!"
          : "Simulation created successfully!"
      );
      router.push(`/create/simulations`);
    } catch (error) {
      const targetSimulationId = simulationId || editingSimulationId;
      toast.error(
        `Failed to ${targetSimulationId ? "update" : "create"} simulation: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const editScenario = (scenarioId: string) => {
    router.push(`/create/scenarios/s/${scenarioId}`);
  };

  const editCohort = (cohortId: string) => {
    router.push(`/create/cohorts/c/${cohortId}`);
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Simulation Information */}

        <div className="space-y-2">
          <Label htmlFor="title">Title</Label>
          {formData?.title !== undefined && !isLoading ? (
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => handleInputChange("title", e.target.value)}
              placeholder="Enter simulation title"
              className={errors.title ? "border-destructive" : ""}
            />
          ) : (
            <Skeleton className="h-10 w-full" />
          )}
          {errors.title && (
            <p className="text-sm text-destructive">{errors.title}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="timeLimit">Minutes Allowed</Label>
          {formData?.timeLimit !== undefined && !isLoading ? (
            <Input
              id="timeLimit"
              type="number"
              min="1"
              max="120"
              value={formData.timeLimit || ""}
              onChange={(e) =>
                handleInputChange("timeLimit", parseInt(e.target.value) || null)
              }
              className={errors.timeLimit ? "border-destructive" : ""}
              placeholder="Leave empty for no time limit"
            />
          ) : (
            <Skeleton className="h-10 w-full" />
          )}
          {errors.timeLimit && (
            <p className="text-sm text-destructive">{errors.timeLimit}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="rubricId">Rubric</Label>
          {formData?.rubricId !== undefined && !isLoading ? (
            <Select
              value={formData.rubricId || ""}
              onValueChange={(value) => handleInputChange("rubricId", value)}
            >
              <SelectTrigger
                className={errors.rubricId ? "border-destructive" : ""}
              >
                <SelectValue placeholder="Select a rubric..." />
              </SelectTrigger>
              <SelectContent>
                {rubrics.map((rubric: Rubric) => (
                  <SelectItem key={rubric.id} value={rubric.id}>
                    {rubric.name} ({rubric.points} points)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Skeleton className="h-10 w-full" />
          )}
          {errors.rubricId && (
            <p className="text-sm text-destructive">{errors.rubricId}</p>
          )}
        </div>

        {/* Cohorts */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <div>
              <Label htmlFor="cohortIds">Cohorts (Optional)</Label>
              {!isLoading && (
                <p className="text-sm text-muted-foreground mt-1">
                  Select cohorts to include in this simulation. If no cohorts
                  are selected, the simulation will be available to all users.
                </p>
              )}
            </div>
            <div className="flex gap-2">
              {formData?.cohortIds !== undefined && !isLoading ? (
                <Select
                  value=""
                  onValueChange={(value: string) => {
                    if (value) addCohort(value);
                  }}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Add cohort" />
                  </SelectTrigger>
                  <SelectContent>
                    {cohorts
                      .filter(
                        (cohort: Cohort) =>
                          !formData.cohortIds?.includes(cohort.id)
                      )
                      .map((cohort: Cohort) => (
                        <SelectItem key={cohort.id} value={cohort.id}>
                          {cohort.title}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              ) : (
                <Skeleton className="h-10 w-full" />
              )}
            </div>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Card key={i} className="p-3 min-h-[180px]">
                  <div className="space-y-3 h-full flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <Skeleton className="h-4 w-1/2" />
                        <div className="flex items-center gap-2">
                          <Skeleton className="h-6 w-6 rounded" />
                          <Skeleton className="h-6 w-6 rounded" />
                          <Skeleton className="h-4 w-4 rounded" />
                        </div>
                      </div>
                      <div className="space-y-2 mt-2">
                        <Skeleton className="h-3 w-full" />
                        <div className="flex items-center gap-2">
                          <Skeleton className="h-5 w-20 rounded" />
                        </div>
                        <Skeleton className="h-5 w-16 rounded" />
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : formData?.cohortIds?.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-center text-muted-foreground border border-dashed rounded-md p-4">
              <div>
                <p className="font-medium mb-1">No cohorts selected</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {formData?.cohortIds?.map((cohortId) => {
                const cohort = cohorts.find((c: Cohort) => c.id === cohortId);
                if (!cohort) return null;

                return (
                  <Card
                    key={cohortId}
                    className={`p-3 cursor-move hover:shadow-md transition-all border-l-4 border-l-blue-500 ${
                      draggedCohort === cohortId ? "opacity-50" : ""
                    }`}
                    draggable
                    onDragStart={(e) => handleDragStartCohort(e, cohortId)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, cohortId)}
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-sm">
                          {cohort.title || "Unnamed Cohort"}
                        </h4>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => editCohort(cohortId)}
                            className="h-6 w-6 p-0"
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => removeCohort(cohortId)}
                            className="h-6 w-6 p-0"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                          <GripVertical className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground line-clamp-3">
                          {cohort.description || "No description provided"}
                        </p>

                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Badge variant="outline" className="text-xs">
                            {cohort.profileIds?.length || 0} members
                          </Badge>
                        </div>

                        <Badge
                          className={`text-xs ${
                            cohort.active
                              ? "bg-green-100 text-green-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {cohort.active ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Scenarios */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <div>
              <Label htmlFor="scenarios">Scenarios</Label>
              {!isLoading && (
                <p className="text-sm text-muted-foreground mt-1">
                  If no scenarios are selected, a random scenario will be chosen
                  automatically
                </p>
              )}
            </div>
            <div className="flex gap-2">
              {formData?.scenarioIds !== undefined && !isLoading ? (
                <Select
                  value=""
                  onValueChange={(value: string) => {
                    if (value) addScenario(value);
                  }}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Add scenario" />
                  </SelectTrigger>
                  <SelectContent>
                    {scenarios
                      .filter(
                        (scenario: Scenario) =>
                          !formData.scenarioIds?.includes(scenario.id)
                      )
                      .map((scenario: Scenario) => (
                        <SelectItem key={scenario.id} value={scenario.id}>
                          {scenario.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              ) : (
                <Skeleton className="h-10 w-full" />
              )}
            </div>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Card key={i} className="p-3 min-h-[180px]">
                  <div className="space-y-3 h-full flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <Skeleton className="h-4 w-1/2" />
                        <div className="flex items-center gap-2">
                          <Skeleton className="h-6 w-6 rounded" />
                          <Skeleton className="h-6 w-6 rounded" />
                          <Skeleton className="h-4 w-4 rounded" />
                        </div>
                      </div>
                      <div className="space-y-2 mt-2">
                        <Skeleton className="h-3 w-full" />
                        <div className="flex items-center gap-2">
                          <Skeleton className="h-5 w-20 rounded" />
                          <Skeleton className="h-5 w-20 rounded" />
                        </div>
                        <Skeleton className="h-5 w-16 rounded" />
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : formData?.scenarioIds?.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-center text-muted-foreground border border-dashed rounded-md p-4">
              <div>
                <p className="font-medium mb-1">No scenarios selected</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {formData?.scenarioIds?.map((scenarioId) => {
                const scenario = scenarios.find(
                  (s: Scenario) => s.id === scenarioId
                );
                if (!scenario) return null;

                return (
                  <Card
                    key={scenarioId}
                    className={`p-3 min-h-[180px] cursor-move hover:shadow-md transition-all border-l-4 border-l-blue-500 ${
                      draggedScenario === scenarioId ? "opacity-50" : ""
                    }`}
                    draggable
                    onDragStart={(e) => handleDragStartScenario(e, scenarioId)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, scenarioId)}
                  >
                    <div className="space-y-3 h-full flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium text-sm">
                            {scenario.name || "Unnamed Scenario"}
                          </h4>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => editScenario(scenarioId)}
                              className="h-6 w-6 p-0"
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => removeScenario(scenarioId)}
                              className="h-6 w-6 p-0"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                            <GripVertical className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </div>

                        <div className="space-y-2 mt-2">
                          <p className="text-xs text-muted-foreground line-clamp-3">
                            {scenario.description || "No description provided"}
                          </p>

                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Badge variant="outline" className="text-xs">
                              Crowdedness: {scenario.crowdedness ?? "N/A"}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              Intensity: {scenario.intensity ?? "N/A"}
                            </Badge>
                          </div>

                          <Badge
                            className={`text-xs ${
                              scenario.seniority === "freshman"
                                ? "bg-blue-100 text-blue-800"
                                : scenario.seniority === "sophomore"
                                  ? "bg-green-100 text-green-800"
                                  : scenario.seniority === "junior"
                                    ? "bg-yellow-100 text-yellow-800"
                                    : scenario.seniority === "senior"
                                      ? "bg-red-100 text-red-800"
                                      : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {scenario.seniority
                              ? scenario.seniority.charAt(0).toUpperCase() +
                                scenario.seniority.slice(1)
                              : "No Level"}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Submit Button */}
        <div className="flex justify-end gap-4">
          <Button
            type="submit"
            disabled={isSubmitting}
            className="min-w-[120px]"
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                {simulationId || editingSimulationId
                  ? "Updating..."
                  : "Creating..."}
              </>
            ) : simulationId || editingSimulationId ? (
              "Update Simulation"
            ) : (
              "Create Simulation"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
