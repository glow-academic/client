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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useProfile } from "@/contexts/profile-context";
import { Rubric, Scenario } from "@/types";
import { createSimulation } from "@/utils/mutations/simulations/create-simulation";
import { updateSimulation } from "@/utils/mutations/simulations/update-simulation";
import { getAllParameterItems } from "@/utils/queries/parameter_items/get-all-parameter-items";
import { getAllParameters } from "@/utils/queries/parameters/get-all-parameters";
import { getAllRubrics } from "@/utils/queries/rubrics/get-all-rubrics";
import { getAllScenarios } from "@/utils/queries/scenarios/get-all-scenarios";
import { getSimulation } from "@/utils/queries/simulations/get-simulation";
import { GripVertical, Loader2, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  SimulationScenario,
  SimulationScenarioPicker,
} from "./SimulationScenarioPicker";

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
  defaultSimulation?: boolean;
  practiceSimulation?: boolean;
}

interface FormErrors {
  title?: string;
  timeLimit?: string;
  rubricId?: string;
  cohortIds?: string[];
}

export default function Simulation({ simulationId }: SimulationProps) {
  const queryClient = useQueryClient();
  const { effectiveProfile } = useProfile();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingSimulationId, setEditingSimulationId] = useState<string | null>(
    null
  );
  const [draggedScenario, setDraggedScenario] = useState<string | null>(null);
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
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
      defaultSimulation: false,
      practiceSimulation: false,
    }),
    []
  );

  const [formData, setFormData] = useState<FormData>();
  const [originalFormData, setOriginalFormData] = useState<FormData>();
  const [errors, setErrors] = useState<FormErrors>({});

  // Fetch simulations for the list mode
  const { data: simulation, isLoading: isLoadingSimulation } = useQuery({
    queryKey: ["simulation", simulationId],
    queryFn: () => getSimulation(simulationId!),
    enabled: isEditMode,
  });

  const { data: rubrics = [], isLoading: isLoadingRubrics } = useQuery({
    queryKey: ["rubrics"],
    queryFn: () => getAllRubrics(),
  });

  const { data: scenarios = [], isLoading: isLoadingScenarios } = useQuery({
    queryKey: ["scenarios"],
    queryFn: () => getAllScenarios(),
  });

  const { data: parameters = [], isLoading: isLoadingParameters } = useQuery({
    queryKey: ["parameters"],
    queryFn: () => getAllParameters(),
  });

  const { data: parameterItems = [], isLoading: isLoadingParameterItems } =
    useQuery({
      queryKey: ["parameter-items"],
      queryFn: () => getAllParameterItems(),
    });

  const isLoading =
    isLoadingSimulation ||
    isLoadingRubrics ||
    isLoadingScenarios ||
    isLoadingParameters ||
    isLoadingParameterItems;

  useEffect(() => {
    if (simulation && isEditMode) {
      const simulationData = {
        title: simulation.title,
        timeLimit: simulation.timeLimit,
        rubricId: simulation.rubricId,
        scenarioIds: simulation.scenarioIds,
        active: simulation.active,
        defaultSimulation: simulation.defaultSimulation ?? false,
        practiceSimulation: simulation.practiceSimulation ?? false,
      };
      setFormData(simulationData);
      setOriginalFormData(simulationData); // Set original data for comparison
    } else if (!isEditMode) {
      setFormData(initialFormData);
      setOriginalFormData(initialFormData);
    }
  }, [simulation, isEditMode, initialFormData]);

  // Check if form has changes
  const hasChanges = useMemo(() => {
    if (!isEditMode || !formData || !originalFormData) return false;

    const current = formData;
    const original = originalFormData;

    return (
      current.title !== original.title ||
      current.timeLimit !== original.timeLimit ||
      current.rubricId !== original.rubricId ||
      current.active !== original.active ||
      current.defaultSimulation !== original.defaultSimulation ||
      current.practiceSimulation !== original.practiceSimulation ||
      JSON.stringify(current.scenarioIds?.sort()) !==
        JSON.stringify(original.scenarioIds?.sort())
    );
  }, [formData, originalFormData, isEditMode]);

  const handleInputChange = (
    field: keyof FormData,
    value: string | number | boolean | string[] | null
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleDragStartScenario = (e: React.DragEvent, scenarioId: string) => {
    setDraggedScenario(scenarioId);
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
    setOriginalFormData(initialFormData);
    setEditingSimulationId(null);
    setErrors({});
  };

  const handleSubmit = async () => {
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
          defaultSimulation: formData?.defaultSimulation || false,
          practiceSimulation: formData?.practiceSimulation || false,
          updatedAt: new Date().toISOString(),
        });
        toast.success("Simulation updated successfully!");
      } else {
        result = await createSimulation({
          title: formData?.title || "",
          rubricId: formData?.rubricId || "",
          scenarioIds: formData?.scenarioIds || [],
          timeLimit: formData?.timeLimit || null,
          active: formData?.active || true,
          defaultSimulation: formData?.defaultSimulation || false,
          practiceSimulation: formData?.practiceSimulation || false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        toast.success("Simulation created successfully!");
      }

      if (!result) {
        toast.error("Failed to create simulation");
        return;
      }

      resetFormAndState();
      queryClient.invalidateQueries({ queryKey: ["simulations"] });
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

  const handleUpdateClick = () => {
    handleSubmit();
  };

  const handleConfirmUpdate = () => {
    setShowUpdateDialog(false);
    handleSubmit();
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleUpdateClick();
  };

  const editScenario = (scenarioId: string) => {
    window.open(`/create/scenarios/s/${scenarioId}`, "_blank");
  };

  // Transform scenarios to match SimulationScenarioPicker interface
  const transformedScenarios: SimulationScenario[] = useMemo(() => {
    return scenarios.map((scenario) => ({
      id: scenario.id,
      title: scenario.name,
      description: scenario.description,
      active: scenario.active,
      defaultScenario: scenario.defaultScenario,
      practiceScenario: scenario.practiceScenario,
      parameterItemIds: scenario.parameterItemIds || [],
    }));
  }, [scenarios]);

  // Compute selected scenarios from formData
  const selectedScenarios = useMemo(() => {
    if (!formData?.scenarioIds || scenarios.length === 0) {
      return [];
    }
    return transformedScenarios.filter((scenario) =>
      formData.scenarioIds?.includes(scenario.id)
    );
  }, [formData?.scenarioIds, transformedScenarios, scenarios.length]);

  // Handle scenario selection from picker
  const handleScenarioSelection = (selectedScenarios: SimulationScenario[]) => {
    const scenarioIds = selectedScenarios.map((scenario) => scenario.id);
    setFormData((prev) => ({
      ...prev,
      scenarioIds,
    }));
  };

  // Get parameter badges for a scenario
  const getScenarioParameterBadges = (scenario: Scenario) => {
    if (!scenario.parameterItemIds || scenario.parameterItemIds.length === 0) {
      return [];
    }

    const badges: {
      parameterName: string;
      value: string;
      parameterId: string;
    }[] = [];

    scenario.parameterItemIds.forEach((parameterItemId) => {
      const parameterItem = parameterItems.find(
        (item) => item.id === parameterItemId
      );
      if (parameterItem) {
        const parameter = parameters.find(
          (param) => param.id === parameterItem.parameterId
        );
        if (parameter && !parameter.numerical) {
          // Only show non-numerical parameters
          badges.push({
            parameterName: parameter.name,
            value: parameterItem.value,
            parameterId: parameter.id,
          });
        }
      }
    });

    return badges;
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleFormSubmit} className="space-y-6">
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

        {/* Active/Inactive, Default Simulation, and Practice Simulation Switches */}
        <div className="space-y-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="active" className="text-sm">
              Simulation Active
            </Label>
            {formData?.active !== undefined && !isLoading ? (
              <Switch
                id="active"
                checked={formData.active ?? true}
                onCheckedChange={(checked) =>
                  handleInputChange("active", checked)
                }
              />
            ) : (
              <Skeleton className="h-6 w-11" />
            )}
          </div>

          {/* Default Simulation Switch - Only for superadmin */}
          {effectiveProfile?.role === "superadmin" && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="defaultSimulation" className="text-sm">
                Default Simulation
              </Label>
              {formData?.defaultSimulation !== undefined && !isLoading ? (
                <Switch
                  id="defaultSimulation"
                  checked={formData.defaultSimulation ?? false}
                  onCheckedChange={(checked) =>
                    handleInputChange("defaultSimulation", checked)
                  }
                />
              ) : (
                <Skeleton className="h-6 w-11" />
              )}
            </div>
          )}

          {/* Practice Simulation Switch - Only for superadmin */}
          {effectiveProfile?.role === "superadmin" && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="practiceSimulation" className="text-sm">
                Practice Simulation
              </Label>
              {formData?.practiceSimulation !== undefined && !isLoading ? (
                <Switch
                  id="practiceSimulation"
                  checked={formData.practiceSimulation ?? false}
                  onCheckedChange={(checked) =>
                    handleInputChange("practiceSimulation", checked)
                  }
                />
              ) : (
                <Skeleton className="h-6 w-11" />
              )}
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
          </div>

          {isLoading ? (
            <Skeleton className="h-10 w-full" />
          ) : (
            <SimulationScenarioPicker
              scenarios={transformedScenarios}
              parameters={parameters}
              parameterItems={parameterItems}
              label=""
              placeholder="Select scenarios..."
              description="Choose scenarios to include in this simulation"
              onSelect={handleScenarioSelection}
              selectedScenarios={selectedScenarios}
              hideSelectedChips={true}
              showOnlyActive={true}
              showLabel={false}
            />
          )}

          {/* Display selected scenarios with preview functionality */}
          {selectedScenarios.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mt-4">
              {selectedScenarios.map((scenario) => {
                const originalScenario = scenarios.find(
                  (s: Scenario) => s.id === scenario.id
                );
                if (!originalScenario) return null;

                return (
                  <Card
                    key={scenario.id}
                    className={`p-3 min-h-[180px] cursor-move hover:shadow-md transition-all border-l-4 border-l-blue-500 ${
                      draggedScenario === scenario.id ? "opacity-50" : ""
                    }`}
                    draggable
                    onDragStart={(e) => handleDragStartScenario(e, scenario.id)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, scenario.id)}
                  >
                    <div className="space-y-3 h-full flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium text-sm">
                            {scenario.title || "Unnamed Scenario"}
                          </h4>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => editScenario(scenario.id)}
                              className="h-6 w-6 p-0"
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const newSelectedScenarios =
                                  selectedScenarios.filter(
                                    (s) => s.id !== scenario.id
                                  );
                                handleScenarioSelection(newSelectedScenarios);
                              }}
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
                          {/* Parameter badges */}
                          {(() => {
                            const parameterBadges =
                              getScenarioParameterBadges(originalScenario);
                            if (parameterBadges.length > 0) {
                              return (
                                <div className="flex items-center gap-1 flex-wrap">
                                  {parameterBadges.slice(0, 4).map((badge) => (
                                    <TooltipProvider key={badge.parameterId}>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Badge
                                            variant="secondary"
                                            className="text-xs"
                                          >
                                            {badge.value}
                                          </Badge>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p>{badge.parameterName}</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  ))}
                                  {parameterBadges.length > 4 && (
                                    <Badge
                                      variant="outline"
                                      className="text-xs"
                                    >
                                      +{parameterBadges.length - 4}
                                    </Badge>
                                  )}
                                </div>
                              );
                            }
                            return null;
                          })()}
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
        <div className="flex justify-end gap-3">
          <Button
            variant="outline"
            type="button"
            onClick={() => router.push("/create/simulations")}
          >
            Back
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting || (isEditMode && !hasChanges)}
            className="min-w-[120px]"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
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

      {/* Update Confirmation Dialog */}
      <AlertDialog open={showUpdateDialog} onOpenChange={setShowUpdateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Update Simulation</AlertDialogTitle>
            <AlertDialogDescription>
              This simulation is currently being used by a cohort. Are you sure
              you want to proceed?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmUpdate}
              disabled={isSubmitting}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {isSubmitting ? "Updating..." : "Update"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
