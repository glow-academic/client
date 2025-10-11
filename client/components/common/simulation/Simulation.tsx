/**
 * Simulation.tsx
 * Used to create and manage simulations for the admin dashboard
 * @AshokSaravanan222 & @siladiea
 * 05/20/2025
 */
"use client";
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
// Replaced standard select with RubricPicker
import {
  RubricPicker,
  Rubric as RubricPickerItem,
} from "@/components/common/rubric/RubricPicker";
import { Textarea } from "@/components/ui/textarea";

import { DepartmentSelector } from "@/components/common/forms/DepartmentSelector";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useDepartments } from "@/contexts/departments-context";
import { useProfile } from "@/contexts/profile-context";
import { useCohortSimulations } from "@/lib/api/hooks/cohort_simulations";
import { useCohortsByDepartmentIdBatch } from "@/lib/api/hooks/cohorts";
import { useDepartments as useDepartmentsHook } from "@/lib/api/hooks/departments";
import { useParameterItems } from "@/lib/api/hooks/parameter_items";
import { useParametersByDepartmentIdBatch } from "@/lib/api/hooks/parameters";
import { useRubricsByDepartmentIdBatch } from "@/lib/api/hooks/rubrics";
import { useScenariosByDepartmentIdBatch } from "@/lib/api/hooks/scenarios";
import {
  useCreateSimulationScenario,
  useSimulationScenariosBySimulationId,
} from "@/lib/api/hooks/simulation_scenarios";
import {
  useCreateSimulation,
  useSimulation,
  useUpdateSimulation,
} from "@/lib/api/hooks/simulations";
import { Rubric, Scenario } from "@/types";
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
  description?: string;
  timeLimit?: number | null;
  rubricId?: string;
  cohortIds?: string[];
  active?: boolean;
  defaultSimulation?: boolean;
  practiceSimulation?: boolean;
  departmentId?: string | null;
  outputGuardrailActive?: boolean;
  inputGuardrailActive?: boolean;
  imageInputActive?: boolean;
  hintsEnabled?: boolean;
}

interface FormErrors {
  title?: string;
  timeLimit?: string;
  rubricId?: string;
  cohortIds?: string[];
  departmentId?: string;
}

export default function Simulation({ simulationId }: SimulationProps) {
  const { effectiveProfile } = useProfile();
  const { effectiveDepartmentIds } = useDepartments();

  // Mutation hooks
  const createSimulationMutation = useCreateSimulation();
  const updateSimulationMutation = useUpdateSimulation();
  const createSimulationScenarioMutation = useCreateSimulationScenario();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingSimulationId, setEditingSimulationId] = useState<string | null>(
    null
  );
  const [draggedScenario, setDraggedScenario] = useState<string | null>(null);
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
  const router = useRouter();

  const isEditMode = !!simulationId;

  // Load linked scenarios from junction table
  const { data: linkedScenarios = [] } = useSimulationScenariosBySimulationId(
    simulationId || editingSimulationId || ""
  );

  const initialFormData: FormData = useMemo(
    () => ({
      title: "",
      description: "",
      timeLimit: 15,
      rubricId: "",
      cohortIds: [],
      active: true,
      defaultSimulation: false,
      practiceSimulation: false,
      departmentId: "",
      outputGuardrailActive: false,
      inputGuardrailActive: false,
      imageInputActive: false,
      hintsEnabled: false,
    }),
    []
  );

  const [formData, setFormData] = useState<FormData>();
  const [originalFormData, setOriginalFormData] = useState<FormData>();
  const [errors, setErrors] = useState<FormErrors>({});

  const { data: simulation, isLoading: isLoadingSimulation } = useSimulation(
    simulationId!
  );
  const { data: rubrics = [] } = useRubricsByDepartmentIdBatch(
    effectiveDepartmentIds
  );
  const { data: scenarios = [] } = useScenariosByDepartmentIdBatch(
    effectiveDepartmentIds
  );
  const { data: parameters = [] } = useParametersByDepartmentIdBatch(
    effectiveDepartmentIds
  );
  const { data: parameterItems = [], isLoading: isLoadingParameterItems } =
    useParameterItems();
  // Load cohorts (for display, not currently used in logic)
  const { data: _cohorts = [] } = useCohortsByDepartmentIdBatch(
    effectiveDepartmentIds
  );
  const { data: departments = [] } = useDepartmentsHook();
  const { data: allCohortSimulations = [] } = useCohortSimulations();

  const isLoading = isLoadingSimulation || isLoadingParameterItems;

  // Determine readonly based on permissions and usage
  const isDefaultNonSuperadmin =
    !!formData?.defaultSimulation && effectiveProfile?.role !== "superadmin";

  const isAdmin =
    effectiveProfile?.role === "admin" ||
    effectiveProfile?.role === "superadmin";

  const isInUse = useMemo(() => {
    const targetId = simulationId || editingSimulationId;
    if (!targetId) return false;
    // Check if simulation is linked to any cohort via junction table
    return allCohortSimulations.some((cs) => cs.simulationId === targetId);
  }, [allCohortSimulations, simulationId, editingSimulationId]);

  const isReadonly = useMemo(() => {
    if (!isEditMode) return false; // creating new simulation is editable
    if (isDefaultNonSuperadmin) return true;
    if (isAdmin) return false;
    // Non-admin: editable only if not in use
    return isInUse;
  }, [isEditMode, isDefaultNonSuperadmin, isAdmin, isInUse]);

  useEffect(() => {
    if (simulation && isEditMode) {
      const simulationData = {
        title: simulation.title,
        description: simulation.description,
        timeLimit: simulation.timeLimit,
        rubricId: simulation.rubricId,
        active: simulation.active,
        defaultSimulation: simulation.defaultSimulation ?? false,
        practiceSimulation: simulation.practiceSimulation ?? false,
        departmentId: simulation.departmentId,
        outputGuardrailActive: simulation.outputGuardrailActive ?? false,
        inputGuardrailActive: simulation.inputGuardrailActive ?? false,
        imageInputActive: simulation.imageInputActive ?? false,
        hintsEnabled: simulation.hintsEnabled ?? false,
      };
      setFormData(simulationData);
      setOriginalFormData(simulationData); // Set original data for comparison
    } else if (!isEditMode) {
      setFormData(initialFormData);
      setOriginalFormData(initialFormData);
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

  const handleDragStartScenario = (e: React.DragEvent, scenarioId: string) => {
    setDraggedScenario(scenarioId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  // State for managing scenario IDs (extracted from junction table)
  const [currentScenarioIds, setCurrentScenarioIds] = useState<string[]>([]);

  // Update currentScenarioIds when linkedScenarios changes
  useEffect(() => {
    if (linkedScenarios.length > 0) {
      const sortedScenarios = [...linkedScenarios].sort(
        (a, b) => a.position - b.position
      );
      setCurrentScenarioIds(sortedScenarios.map((ls) => ls.scenarioId));
    } else {
      setCurrentScenarioIds([]);
    }
  }, [linkedScenarios]);

  const handleDrop = (e: React.DragEvent, targetScenarioId: string) => {
    e.preventDefault();

    if (!draggedScenario) return;

    const newOrder = [...currentScenarioIds];
    const draggedIndex = newOrder.findIndex((id) => id === draggedScenario);
    const targetIndex = newOrder.findIndex((id) => id === targetScenarioId);

    if (draggedIndex !== -1 && targetIndex !== -1) {
      const [removed] = newOrder.splice(draggedIndex, 1);
      const insertIndex =
        draggedIndex < targetIndex ? targetIndex - 1 : targetIndex;
      newOrder.splice(insertIndex, 0, removed!);

      setCurrentScenarioIds(newOrder);
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

    // Department validation for superadmins
    if (effectiveProfile?.role === "superadmin" && !formData?.departmentId) {
      newErrors.departmentId =
        "Department selection is required for superadmin users";
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
      const targetSimulationId = simulationId || editingSimulationId;

      if (targetSimulationId) {
        // UPDATE mode - update simulation metadata
        const updatePayload = {
          id: targetSimulationId,
          title: formData?.title || "",
          description: formData?.description ?? "",
          timeLimit: formData?.timeLimit || null,
          rubricId: formData?.rubricId || "",
          active: formData?.active ?? true,
          defaultSimulation: formData?.defaultSimulation || false,
          practiceSimulation: formData?.practiceSimulation || false,
          departmentId:
            formData?.departmentId || effectiveDepartmentIds[0] || "",
          outputGuardrailActive: formData?.outputGuardrailActive || false,
          inputGuardrailActive: formData?.inputGuardrailActive || false,
          imageInputActive: formData?.imageInputActive || false,
          hintsEnabled: formData?.hintsEnabled || false,
          updatedAt: new Date().toISOString(),
        };

        await updateSimulationMutation.mutateAsync(updatePayload);

        // Note: Junction table scenario management requires API endpoint updates
        // For now, scenarios are managed separately through the UI
        // TODO: Add batch update endpoint for simulation_scenarios

        toast.success("Simulation updated successfully!");
      } else {
        // CREATE mode - create simulation first, then junction records
        const newSimulation = await createSimulationMutation.mutateAsync({
          title: formData?.title || "",
          description: formData?.description ?? "",
          rubricId: formData?.rubricId || "",
          timeLimit: formData?.timeLimit || null,
          active: formData?.active || true,
          defaultSimulation: formData?.defaultSimulation || false,
          practiceSimulation: formData?.practiceSimulation || false,
          departmentId:
            formData?.departmentId || effectiveDepartmentIds[0] || "",
          outputGuardrailActive: formData?.outputGuardrailActive || false,
          inputGuardrailActive: formData?.inputGuardrailActive || false,
          imageInputActive: formData?.imageInputActive || false,
          hintsEnabled: formData?.hintsEnabled || false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        // Create junction records for scenarios
        if (newSimulation?.id) {
          for (let i = 0; i < currentScenarioIds.length; i++) {
            const scenarioId = currentScenarioIds[i];
            if (scenarioId) {
              await createSimulationScenarioMutation.mutateAsync({
                simulationId: newSimulation.id,
                scenarioId: scenarioId,
                position: i + 1,
              });
            }
          }
        }

        toast.success("Simulation created successfully!");
      }

      resetFormAndState();
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
      description: scenario.problemStatement,
      active: scenario.active,
      defaultScenario: scenario.defaultScenario,
      practiceScenario: false, // practice is simulation-level only now
      parameterItemIds: [], // managed via junction table
      parentId: null, // managed via scenario_tree junction
      updatedAt: scenario.updatedAt,
    }));
  }, [scenarios]);

  // Handle scenario selection from picker
  const handleScenarioSelection = (scenarios: SimulationScenario[]) => {
    const scenarioIds = scenarios.map((scenario) => scenario.id);
    setCurrentScenarioIds(scenarioIds);
  };

  // Combine scenarios for display
  const selectedScenarios = React.useMemo(() => {
    return currentScenarioIds
      .map((id) => transformedScenarios.find((s) => s.id === id))
      .filter(Boolean) as SimulationScenario[];
  }, [currentScenarioIds, transformedScenarios]);

  // Check if form has changes
  const hasChanges = useMemo(() => {
    if (!isEditMode || !formData || !originalFormData) return false;

    const current = formData;
    const original = originalFormData;

    // Get original scenario IDs from linkedScenarios
    const originalScenarioIds = linkedScenarios
      .sort((a, b) => a.position - b.position)
      .map((ls) => ls.scenarioId);

    return (
      current.title !== original.title ||
      current.description !== original.description ||
      current.timeLimit !== original.timeLimit ||
      current.rubricId !== original.rubricId ||
      current.active !== original.active ||
      current.defaultSimulation !== original.defaultSimulation ||
      current.practiceSimulation !== original.practiceSimulation ||
      current.departmentId !== original.departmentId ||
      current.outputGuardrailActive !== original.outputGuardrailActive ||
      current.inputGuardrailActive !== original.inputGuardrailActive ||
      current.imageInputActive !== original.imageInputActive ||
      current.hintsEnabled !== original.hintsEnabled ||
      JSON.stringify(currentScenarioIds) !== JSON.stringify(originalScenarioIds)
    );
  }, [
    formData,
    originalFormData,
    isEditMode,
    currentScenarioIds,
    linkedScenarios,
  ]);

  // TODO: Add parameter badge display (requires loading from scenario_parameter_items junction)

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
              disabled={isReadonly}
            />
          ) : (
            <Skeleton className="h-10 w-full" />
          )}
          {errors.title && (
            <p className="text-sm text-destructive">{errors.title}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          {formData?.description !== undefined && !isLoading ? (
            <Textarea
              id="description"
              value={formData.description || ""}
              onChange={(e) => handleInputChange("description", e.target.value)}
              placeholder="Enter a brief description (optional)"
              rows={3}
              disabled={isReadonly}
            />
          ) : (
            <Skeleton className="h-20 w-full" />
          )}
        </div>

        {/* Department Selection - Only for superadmin */}
        {effectiveProfile?.role === "superadmin" && (
          <div className="space-y-2">
            <Label htmlFor="department">Department</Label>
            {formData?.departmentId !== undefined && !isLoading ? (
              <DepartmentSelector
                departments={departments.map((dept) => ({
                  id: dept.id,
                  title: dept.title as string,
                  ...(dept.description && { description: dept.description }),
                }))}
                selectedDepartment={
                  formData?.departmentId
                    ? (() => {
                        const dept = departments.find(
                          (d) => d.id === formData.departmentId
                        );
                        return dept
                          ? {
                              id: dept.id,
                              title: dept.title as string,
                              ...(dept.description && {
                                description: dept.description,
                              }),
                            }
                          : null;
                      })()
                    : null
                }
                onSelect={(department) =>
                  handleInputChange("departmentId", department?.id || "")
                }
                placeholder="Select department"
                disabled={isReadonly}
              />
            ) : (
              <Skeleton className="h-10 w-full" />
            )}
            {errors.departmentId && (
              <p className="text-sm text-destructive">{errors.departmentId}</p>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
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
                  handleInputChange(
                    "timeLimit",
                    parseInt(e.target.value) || null
                  )
                }
                className={errors.timeLimit ? "border-destructive" : ""}
                placeholder="Leave empty for no time limit"
                disabled={isReadonly}
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
              isReadonly ? (
                <Button
                  variant="outline"
                  size="sm"
                  className={`${errors.rubricId ? "border-destructive" : ""} w-full justify-between`}
                  disabled
                >
                  <span className="truncate text-left">
                    {(() => {
                      const selected = rubrics.find(
                        (r: Rubric) => r.id === formData.rubricId
                      );
                      return selected ? selected.name : "No rubric selected";
                    })()}
                  </span>
                </Button>
              ) : (
                <RubricPicker
                  rubrics={rubrics
                    .filter((rubric: Rubric) => rubric.active)
                    .map(
                      (r: Rubric) =>
                        ({
                          id: r.id,
                          name: r.name,
                          description: r.description,
                          points: r.points,
                          active: r.active,
                        }) as RubricPickerItem
                    )}
                  placeholder="Select a rubric..."
                  onSelect={(selected) =>
                    handleInputChange("rubricId", selected[0]?.id || "")
                  }
                  selectedRubrics={(() => {
                    const selected = rubrics.find(
                      (r: Rubric) => r.id === formData.rubricId
                    );
                    return selected
                      ? [
                          {
                            id: selected.id,
                            name: selected.name,
                            description: selected.description,
                            points: selected.points,
                            active: selected.active,
                          } as RubricPickerItem,
                        ]
                      : [];
                  })()}
                  hideSelectedChips={true}
                  buttonClassName={`${errors.rubricId ? "border-destructive" : ""}`}
                />
              )
            ) : (
              <Skeleton className="h-10 w-full" />
            )}
            {errors.rubricId && (
              <p className="text-sm text-destructive">{errors.rubricId}</p>
            )}
          </div>
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
                disabled={isReadonly}
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
                  disabled={isReadonly}
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
                  disabled={isReadonly}
                />
              ) : (
                <Skeleton className="h-6 w-11" />
              )}
            </div>
          )}

          {/* Guardrails and Features */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="outputGuardrailActive" className="text-sm">
              Output Guardrail Active
            </Label>
            {formData?.outputGuardrailActive !== undefined && !isLoading ? (
              <Switch
                id="outputGuardrailActive"
                checked={formData.outputGuardrailActive ?? false}
                onCheckedChange={(checked) =>
                  handleInputChange("outputGuardrailActive", checked)
                }
                disabled={isReadonly}
              />
            ) : (
              <Skeleton className="h-6 w-11" />
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="inputGuardrailActive" className="text-sm">
              Input Guardrail Active
            </Label>
            {formData?.inputGuardrailActive !== undefined && !isLoading ? (
              <Switch
                id="inputGuardrailActive"
                checked={formData.inputGuardrailActive ?? false}
                onCheckedChange={(checked) =>
                  handleInputChange("inputGuardrailActive", checked)
                }
                disabled={isReadonly}
              />
            ) : (
              <Skeleton className="h-6 w-11" />
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="imageInputActive" className="text-sm">
              Image Input Active
            </Label>
            {formData?.imageInputActive !== undefined && !isLoading ? (
              <Switch
                id="imageInputActive"
                checked={formData.imageInputActive ?? false}
                onCheckedChange={(checked) =>
                  handleInputChange("imageInputActive", checked)
                }
                disabled={isReadonly}
              />
            ) : (
              <Skeleton className="h-6 w-11" />
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="hintsEnabled" className="text-sm">
              Hints Enabled
            </Label>
            {formData?.hintsEnabled !== undefined && !isLoading ? (
              <Switch
                id="hintsEnabled"
                checked={formData.hintsEnabled ?? false}
                onCheckedChange={(checked) =>
                  handleInputChange("hintsEnabled", checked)
                }
                disabled={isReadonly}
              />
            ) : (
              <Skeleton className="h-6 w-11" />
            )}
          </div>
        </div>

        {/* Scenarios */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <div>
              <Label htmlFor="scenarios">Scenarios</Label>
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
                isPracticeSimulation={formData?.practiceSimulation ?? false}
              />
            )}
          </div>

          {/* Display selected scenarios with preview functionality */}
          {selectedScenarios.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
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
                    draggable={!isReadonly}
                    onDragStart={(e) =>
                      !isReadonly && handleDragStartScenario(e, scenario.id)
                    }
                    onDragOver={handleDragOver}
                    onDrop={(e) => !isReadonly && handleDrop(e, scenario.id)}
                  >
                    <div className="space-y-3 h-full flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium text-sm">
                            {scenario.title || "Unnamed Scenario"}
                          </h4>
                          <div className="flex items-center gap-2">
                            {!isReadonly && (
                              <>
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
                                    handleScenarioSelection(
                                      newSelectedScenarios
                                    );
                                  }}
                                  className="h-6 w-6 p-0"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </>
                            )}
                            <GripVertical className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </div>

                        <div className="space-y-2 mt-2">
                          <p className="text-xs text-muted-foreground line-clamp-3">
                            {scenario.description || "No description provided"}
                          </p>
                          {/* Parameter badges - TODO: Load from junction table */}
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="flex items-center justify-center h-40 text-center text-muted-foreground border border-dashed rounded-md p-4">
              <div>
                <p className="font-medium mb-1">No scenarios selected</p>
                <p className="text-sm">
                  Use the selector above to add scenarios to this simulation
                </p>
              </div>
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
            disabled={
              isSubmitting ||
              isReadonly ||
              (isEditMode && !hasChanges) ||
              createSimulationMutation.isPending ||
              updateSimulationMutation.isPending
            }
            className="min-w-[120px]"
          >
            {isSubmitting ||
            createSimulationMutation.isPending ||
            updateSimulationMutation.isPending ? (
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
            <AlertDialogCancel
              disabled={isSubmitting || updateSimulationMutation.isPending}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmUpdate}
              disabled={isSubmitting || updateSimulationMutation.isPending}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {isSubmitting || updateSimulationMutation.isPending
                ? "Updating..."
                : "Update"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
