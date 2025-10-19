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
import { RubricPicker } from "@/components/common/rubric/RubricPicker";
import { Textarea } from "@/components/ui/textarea";

import { DepartmentPicker } from "@/components/common/forms/DepartmentPicker";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useProfile } from "@/contexts/profile-context";
import {
  useCreateSimulation as useCreateSimulationV2,
  useSimulationDetail,
  useSimulationDetailDefault,
  useUpdateSimulation as useUpdateSimulationV2,
} from "@/lib/api/v2/hooks/simulations";
import type { SimulationDetailResponse } from "@/lib/api/v2/schemas/simulations";
import { BarChart3, CheckCircle2, Clock, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { SimulationScenarioPicker } from "./SimulationScenarioPicker";

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
  const { effectiveProfile, departmentIds } = useProfile();

  // Mutation hooks (v2)
  const createSimulationMutation = useCreateSimulationV2();
  const updateSimulationMutation = useUpdateSimulationV2();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingSimulationId, setEditingSimulationId] = useState<string | null>(
    null
  );
  const [draggedScenario, setDraggedScenario] = useState<string | null>(null);
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
  const router = useRouter();
  const isEditMode = !!simulationId;

  // V2 API hooks - fetch data from server
  const { data: simulationDetail, isLoading: isLoadingSimulationDetail } =
    useSimulationDetail(
      simulationId || "",
      effectiveProfile?.id || "",
      !!simulationId && isEditMode
    );

  const {
    data: simulationDetailDefault,
    isLoading: isLoadingSimulationDefault,
  } = useSimulationDetailDefault(effectiveProfile?.id || "", !isEditMode);

  // Use edit detail when editing, default detail when creating
  const simulationData: SimulationDetailResponse | undefined = isEditMode
    ? simulationDetail
    : simulationDetailDefault;
  const isLoadingData = isEditMode
    ? isLoadingSimulationDetail
    : isLoadingSimulationDefault;

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

  const isLoading = isLoadingData;

  // Permission logic - server computes can_edit flag
  const isReadonly = useMemo(() => {
    if (!isEditMode || !simulationData) return false;
    return !simulationData.can_edit;
  }, [isEditMode, simulationData]);

  useEffect(() => {
    if (simulationData && isEditMode) {
      const formDataFromServer = {
        title: simulationData.name,
        description: simulationData.description,
        timeLimit: simulationData.time_limit,
        rubricId: simulationData.rubric_id,
        active: simulationData.active,
        defaultSimulation: simulationData.default_simulation ?? false,
        practiceSimulation: simulationData.practice_simulation ?? false,
        departmentId: simulationData.department_id,
        outputGuardrailActive: simulationData.output_guardrail_active ?? false,
        inputGuardrailActive: simulationData.input_guardrail_active ?? false,
        imageInputActive: simulationData.image_input_active ?? false,
        hintsEnabled: simulationData.hints_enabled ?? false,
      };
      setFormData(formDataFromServer);
      setOriginalFormData(formDataFromServer);
      // Set current scenario IDs from server (already ordered by position)
      setCurrentScenarioIds(simulationData.scenario_ids);

      // Initialize scenario active states from server data
      const activeStates: Record<string, boolean> = {};
      simulationData.scenarios.forEach((s) => {
        activeStates[s.scenario_id] = s.active;
      });
      setScenarioActiveStates(activeStates);
      setOriginalActiveStates(activeStates);
    } else if (!isEditMode && simulationData) {
      setFormData(initialFormData);
      setOriginalFormData(initialFormData);
    }
  }, [simulationData, isEditMode, initialFormData]);

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

  // State for managing scenario IDs
  const [currentScenarioIds, setCurrentScenarioIds] = useState<string[]>([]);

  // State for managing scenario active toggles (staged changes)
  const [scenarioActiveStates, setScenarioActiveStates] = useState<
    Record<string, boolean>
  >({});
  const [originalActiveStates, setOriginalActiveStates] = useState<
    Record<string, boolean>
  >({});

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
        // UPDATE mode - v2 API handles scenarios in one request
        const updatePayload = {
          simulationId: targetSimulationId,
          title: formData?.title || "",
          description: formData?.description ?? "",
          department_id: formData?.departmentId || departmentIds[0] || "",
          active: formData?.active ?? true,
          default_simulation: formData?.defaultSimulation || false,
          practice_simulation: formData?.practiceSimulation || false,
          hints_enabled: formData?.hintsEnabled || false,
          input_guardrail_active: formData?.inputGuardrailActive || false,
          output_guardrail_active: formData?.outputGuardrailActive || false,
          image_input_active: formData?.imageInputActive || false,
          time_limit: formData?.timeLimit || null,
          rubric_id: formData?.rubricId || "",
          scenario_ids: currentScenarioIds,
        };

        await updateSimulationMutation.mutateAsync(updatePayload);
        toast.success("Simulation updated successfully!");
      } else {
        // CREATE mode - v2 API handles scenarios in one request
        const createPayload = {
          title: formData?.title || "",
          description: formData?.description ?? "",
          department_id: formData?.departmentId || departmentIds[0] || "",
          active: formData?.active || true,
          default_simulation: formData?.defaultSimulation || false,
          practice_simulation: formData?.practiceSimulation || false,
          hints_enabled: formData?.hintsEnabled || false,
          input_guardrail_active: formData?.inputGuardrailActive || false,
          output_guardrail_active: formData?.outputGuardrailActive || false,
          image_input_active: formData?.imageInputActive || false,
          time_limit: formData?.timeLimit || null,
          rubric_id: formData?.rubricId || "",
          scenario_ids: currentScenarioIds,
        };

        await createSimulationMutation.mutateAsync(createPayload);
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

  // Handle scenario selection from picker (now works with IDs)
  const handleScenarioSelection = (scenarioIds: string[]) => {
    setCurrentScenarioIds(scenarioIds);
  };

  // Check if form has changes
  const hasChanges = useMemo(() => {
    if (!isEditMode || !formData || !originalFormData || !simulationData)
      return false;

    const current = formData;
    const original = originalFormData;

    // Get original scenario IDs from server data
    const originalScenarioIds = simulationData.scenario_ids || [];

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
      JSON.stringify(currentScenarioIds) !== JSON.stringify(originalScenarioIds) ||
      JSON.stringify(scenarioActiveStates) !== JSON.stringify(originalActiveStates)
    );
  }, [
    formData,
    originalFormData,
    isEditMode,
    currentScenarioIds,
    simulationData,
    scenarioActiveStates,
    originalActiveStates,
  ]);

  // Helper function to format last used date
  const formatLastUsed = (date: string | null): string => {
    if (!date) return "Never";
    const d = new Date(date);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  // Helper function to remove a scenario
  const handleRemoveScenario = (scenarioId: string) => {
    setCurrentScenarioIds((prev) => prev.filter((id) => id !== scenarioId));
    // Also remove from active states if present
    setScenarioActiveStates((prev) => {
      const newStates = { ...prev };
      delete newStates[scenarioId];
      return newStates;
    });
  };

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
              <DepartmentPicker
                mapping={simulationData?.department_mapping || {}}
                validIds={simulationData?.valid_department_ids || []}
                selectedIds={
                  formData?.departmentId ? [formData.departmentId] : []
                }
                onSelect={(ids) =>
                  handleInputChange("departmentId", ids[0] || "")
                }
                placeholder="Select department"
                disabled={isReadonly}
                multiSelect={false}
              />
            ) : (
              <Skeleton className="h-10 w-full" />
            )}
            {errors.departmentId && (
              <p className="text-sm text-destructive">{errors.departmentId}</p>
            )}
          </div>
        )}

        {/* First Row of Switches - Simulation Active, Default Simulation, Practice Simulation */}
        <div className="flex gap-8">
          {/* Simulation Active Switch */}
          <div className="flex items-center gap-2">
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
            <div className="flex items-center gap-2">
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
            <div className="flex items-center gap-2">
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
        </div>

        {/* Second Row of Switches - Guardrails */}
        <div className="flex gap-8">
          <div className="flex items-center gap-2">
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

          <div className="flex items-center gap-2">
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

          <div className="flex items-center gap-2">
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
        </div>

        {/* Third Row of Switches - Hints */}
        <div className="flex gap-8">
          <div className="flex items-center gap-2">
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
                    {(formData.rubricId &&
                      simulationData?.rubric_mapping[formData.rubricId]
                        ?.name) ||
                      "No rubric selected"}
                  </span>
                </Button>
              ) : (
                <RubricPicker
                  mapping={simulationData?.rubric_mapping || {}}
                  validIds={simulationData?.valid_rubric_ids || []}
                  selectedIds={formData.rubricId ? [formData.rubricId] : []}
                  onSelect={(ids) =>
                    handleInputChange("rubricId", ids[0] || "")
                  }
                  placeholder="Select a rubric..."
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
                scenarioMapping={simulationData?.scenario_mapping || {}}
                validScenarioIds={simulationData?.valid_scenario_ids || []}
                selectedScenarioIds={currentScenarioIds}
                onSelect={handleScenarioSelection}
                parameterItemMapping={
                  simulationData?.parameter_item_mapping || {}
                }
                label=""
                placeholder="Select scenarios..."
                description="Choose scenarios to include in this simulation"
                hideSelectedChips={true}
                showOnlyActive={true}
                showLabel={false}
                isPracticeSimulation={formData?.practiceSimulation ?? false}
              />
            )}
          </div>

          {/* Display selected scenarios with preview functionality */}
          {currentScenarioIds.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {currentScenarioIds.map((scenarioId) => {
                const scenarioData =
                  simulationData?.scenario_mapping[scenarioId];
                if (!scenarioData) return null;

                // Determine if this is an existing scenario (in original server data)
                const isExistingScenario =
                  simulationData?.scenario_ids.includes(scenarioId) ?? false;

                // Get scenario statistics from scenarios array (only for existing scenarios)
                const scenarioStats = simulationData?.scenarios.find(
                  (s) => s.scenario_id === scenarioId
                );

                // Determine if Remove button should show
                const shouldShowRemove = isExistingScenario
                  ? scenarioStats?.can_remove ?? false
                  : true; // New scenarios always show remove

                // Get active state for styling
                const isScenarioActive =
                  scenarioActiveStates[scenarioId] ?? true;

                return (
                  <Card
                    key={scenarioId}
                    className={`p-4 cursor-move hover:shadow-md transition-all ${
                      draggedScenario === scenarioId ? "opacity-50" : ""
                    } ${!isScenarioActive ? "opacity-50 bg-muted" : ""}`}
                    draggable={!isReadonly}
                    onDragStart={(e) =>
                      !isReadonly && handleDragStartScenario(e, scenarioId)
                    }
                    onDragOver={handleDragOver}
                    onDrop={(e) => !isReadonly && handleDrop(e, scenarioId)}
                  >
                    <div className="space-y-3">
                      {/* Header: Title and Active Switch */}
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-medium text-sm flex-1">
                          {scenarioData.name || "Unnamed Scenario"}
                        </h4>
                        {isExistingScenario && !isReadonly && (
                          <Switch
                            checked={scenarioActiveStates[scenarioId] ?? true}
                            onCheckedChange={(checked) =>
                              setScenarioActiveStates((prev) => ({
                                ...prev,
                                [scenarioId]: checked,
                              }))
                            }
                          />
                        )}
                      </div>

                      {/* Description */}
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {scenarioData.description || "No description provided"}
                      </p>

                      {/* Statistics Row - Only for existing scenarios */}
                      {isExistingScenario && scenarioStats && (
                        <div className="flex items-center gap-4 text-xs text-muted-foreground border-t pt-2">
                          <div className="flex items-center gap-1">
                            <BarChart3 className="h-3 w-3" />
                            <span>Usage: {scenarioStats.usage_count}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            <span>
                              Last: {formatLastUsed(scenarioStats.last_used)}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            <span>Success: {scenarioStats.success_rate}%</span>
                          </div>
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="flex items-center justify-between border-t pt-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => editScenario(scenarioId)}
                        >
                          View Details
                        </Button>

                        {!isReadonly && shouldShowRemove && (
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={() => handleRemoveScenario(scenarioId)}
                          >
                            Remove
                          </Button>
                        )}
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
