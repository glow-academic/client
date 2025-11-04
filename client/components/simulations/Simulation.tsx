/**
 * Simulation.tsx
 * Used to create and manage simulations for the admin dashboard
 * @AshokSaravanan222 & @siladiea
 * 05/20/2025
 */
"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
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
import { RubricPicker } from "@/components/common/forms/RubricPicker";
import { Textarea } from "@/components/ui/textarea";

import { DepartmentPicker } from "@/components/common/forms/DepartmentPicker";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useBreadcrumbContext } from "@/contexts/breadcrumb-context";
import { useProfile } from "@/contexts/profile-context";
import { api } from "@/lib/api/client";
import type { SimulationDetailResponse } from "@/lib/api/v2/schemas/simulations";
import { keys } from "@/lib/query/keys";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BarChart3,
  CheckCircle2,
  Clock,
  GraduationCap,
  Loader2,
  Power,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { ScenarioPicker } from "@/components/common/forms/ScenarioPicker";

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
  practiceSimulation?: boolean;
  departmentIds?: string[] | null;
}

interface FormErrors {
  title?: string;
  timeLimit?: string;
  rubricId?: string;
  cohortIds?: string[];
  departmentIds?: string[];
}

export default function Simulation({ simulationId }: SimulationProps) {
  const { effectiveProfile } = useProfile();
  const { setEntityMetadata, clearEntityMetadata } = useBreadcrumbContext();
  const queryClient = useQueryClient();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingSimulationId, setEditingSimulationId] = useState<string | null>(
    null
  );
  const [draggedScenario, setDraggedScenario] = useState<string | null>(null);
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
  const router = useRouter();
  const isEditMode = !!simulationId;

  // V3 API - fetch simulation detail when editing
  const { data: simulationDetail, isLoading: isLoadingSimulationDetail } =
    useQuery({
      queryKey: keys.simulations.with({
        simulationId: simulationId || "",
        profileId: effectiveProfile?.id || "",
      }),
      queryFn: () =>
        api.post("/simulations/detail", {
          body: {
            simulationId: simulationId || "",
            profileId: effectiveProfile?.id || "",
          },
        }),
      enabled: !!simulationId && isEditMode && !!effectiveProfile?.id,
    });

  // V3 API - fetch default simulation detail when creating
  const {
    data: simulationDetailDefault,
    isLoading: isLoadingSimulationDefault,
  } = useQuery({
    queryKey: keys.simulations.with({
      profileId: effectiveProfile?.id || "",
      default: true,
    }),
    queryFn: () =>
      api.post("/simulations/detail-default", {
        body: {
          profileId: effectiveProfile?.id || "",
        },
      }),
    enabled: !isEditMode && !!effectiveProfile?.id,
  });

  // V3 API - create mutation
  const createSimulationMutation = useMutation({
    mutationFn: (body: {
      title: string;
      description: string;
      department_ids: string[] | null;
      active: boolean;
      practice_simulation: boolean;
      time_limit: number | null;
      rubric_id: string;
      scenario_ids: string[] | Array<{ scenario_id: string; active: boolean }>;
    }) => api.post("/simulations/create", { body }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.simulations.all });
      router.push("/simulations");
    },
  });

  // V3 API - update mutation
  const updateSimulationMutation = useMutation({
    mutationFn: (body: {
      simulationId: string;
      title: string;
      description: string;
      department_ids: string[] | null;
      active: boolean;
      practice_simulation: boolean;
      time_limit: number | null;
      rubric_id: string;
      scenario_ids: string[] | Array<{ scenario_id: string; active: boolean }>;
    }) => api.post("/simulations/update", { body }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.simulations.all });
      router.push("/simulations");
    },
  });

  // Use edit detail when editing, default detail when creating
  const simulationData: SimulationDetailResponse | undefined = isEditMode
    ? simulationDetail
    : simulationDetailDefault;
  const isLoadingData = isEditMode
    ? isLoadingSimulationDetail
    : isLoadingSimulationDefault;

  // Set breadcrumb context when simulation data is loaded
  useEffect(() => {
    if (simulationDetail?.name && simulationId && isEditMode) {
      setEntityMetadata({
        entityId: simulationId,
        entityName: simulationDetail.name,
        entityType: "simulation",
      });
    }
    return () => clearEntityMetadata();
  }, [
    simulationDetail,
    simulationId,
    isEditMode,
    setEntityMetadata,
    clearEntityMetadata,
  ]);

  const initialFormData: FormData = useMemo(
    () => ({
      title: "",
      description: "",
      timeLimit: 15,
      rubricId: "",
      cohortIds: [],
      active: true,
      practiceSimulation: false,
      departmentIds: effectiveProfile?.primaryDepartmentId
        ? [effectiveProfile.primaryDepartmentId]
        : [],
    }),
    [effectiveProfile?.primaryDepartmentId]
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

  // Extract department mapping
  const departmentMapping = useMemo(
    () => simulationData?.department_mapping || {},
    [simulationData]
  );

  // State for managing scenario IDs (declared early for use in validScenarioIds useMemo)
  const [currentScenarioIds, setCurrentScenarioIds] = useState<string[]>([]);

  // Extract valid scenario IDs from V2 response, filtered by selected departments
  // Includes: items from selected departments + cross-department items + currently selected items
  const validScenarioIds = useMemo(() => {
    const baseIds = simulationData?.valid_scenario_ids || [];
    const selectedDeptIds = formData?.departmentIds || [];

    // Always include currently selected scenarios (for edit mode - ensures selected items are visible)
    const selectedScenarioIdsSet = new Set(currentScenarioIds);

    // If no departments selected, return all valid IDs plus selected ones
    if (selectedDeptIds.length === 0) {
      return Array.from(new Set([...baseIds, ...selectedScenarioIdsSet]));
    }

    // Get union of scenario_ids from ALL departments (to identify cross-department items)
    const allDeptScenarioIds = new Set<string>();
    Object.values(departmentMapping).forEach((deptData) => {
      if (deptData?.scenario_ids && Array.isArray(deptData.scenario_ids)) {
        deptData.scenario_ids.forEach((id) => allDeptScenarioIds.add(id));
      }
    });

    // Get union of scenario_ids from selected departments
    const selectedDeptScenarioIds = new Set<string>();
    selectedDeptIds.forEach((deptId) => {
      const deptData = departmentMapping[deptId];
      if (deptData?.scenario_ids && Array.isArray(deptData.scenario_ids)) {
        deptData.scenario_ids.forEach((id) => selectedDeptScenarioIds.add(id));
      }
    });

    // Include items that are:
    // 1. In selected departments
    // 2. Cross-department (not in any department's scenario_ids)
    // 3. Currently selected
    const filtered = baseIds.filter((id) => {
      const inSelectedDepts = selectedDeptScenarioIds.has(id);
      const isCrossDept = !allDeptScenarioIds.has(id); // Not in any department = cross-department
      return inSelectedDepts || isCrossDept;
    });

    return Array.from(new Set([...filtered, ...selectedScenarioIdsSet]));
  }, [
    simulationData?.valid_scenario_ids,
    formData?.departmentIds,
    departmentMapping,
    currentScenarioIds,
  ]);

  // Extract valid rubric IDs from V2 response, filtered by selected departments
  // Includes: items from selected departments + cross-department items + currently selected items
  const validRubricIds = useMemo(() => {
    const baseIds = simulationData?.valid_rubric_ids || [];
    const selectedDeptIds = formData?.departmentIds || [];

    // Always include currently selected rubric (for edit mode - ensures selected item is visible)
    const selectedRubricIdSet = formData?.rubricId
      ? new Set([formData.rubricId])
      : new Set<string>();

    // If no departments selected, return all valid IDs plus selected one
    if (selectedDeptIds.length === 0) {
      return Array.from(new Set([...baseIds, ...selectedRubricIdSet]));
    }

    // Get union of rubric_ids from ALL departments (to identify cross-department items)
    const allDeptRubricIds = new Set<string>();
    Object.values(departmentMapping).forEach((deptData) => {
      if (deptData?.rubric_ids && Array.isArray(deptData.rubric_ids)) {
        deptData.rubric_ids.forEach((id) => allDeptRubricIds.add(id));
      }
    });

    // Get union of rubric_ids from selected departments
    const selectedDeptRubricIds = new Set<string>();
    selectedDeptIds.forEach((deptId) => {
      const deptData = departmentMapping[deptId];
      if (deptData?.rubric_ids && Array.isArray(deptData.rubric_ids)) {
        deptData.rubric_ids.forEach((id) => selectedDeptRubricIds.add(id));
      }
    });

    // Include items that are:
    // 1. In selected departments
    // 2. Cross-department (not in any department's rubric_ids)
    // 3. Currently selected
    const filtered = baseIds.filter((id) => {
      const inSelectedDepts = selectedDeptRubricIds.has(id);
      const isCrossDept = !allDeptRubricIds.has(id); // Not in any department = cross-department
      return inSelectedDepts || isCrossDept;
    });

    return Array.from(new Set([...filtered, ...selectedRubricIdSet]));
  }, [
    simulationData?.valid_rubric_ids,
    formData?.departmentIds,
    formData?.rubricId,
    departmentMapping,
  ]);

  // Note: Cohort filtering is not currently used in Simulation component
  // but kept for future use if cohorts are added to simulation forms
  // const validCohortIds = useMemo(() => {
  //   const baseIds = simulationData?.valid_cohort_ids || [];
  //   const selectedDeptIds = formData?.departmentIds || [];
  //
  //   // If no departments selected, return all valid IDs
  //   if (selectedDeptIds.length === 0) {
  //     return baseIds;
  //   }
  //
  //   // Get union of cohort_ids from selected departments
  //   const deptCohortIds = new Set<string>();
  //   selectedDeptIds.forEach((deptId) => {
  //     const deptData = departmentMapping[deptId];
  //     if (deptData?.cohort_ids && Array.isArray(deptData.cohort_ids)) {
  //       deptData.cohort_ids.forEach((id) => deptCohortIds.add(id));
  //     }
  //   });
  //
  //   // Filter base IDs to only include those in department cohort IDs
  //   return baseIds.filter((id) => deptCohortIds.has(id));
  // }, [simulationData?.valid_cohort_ids, formData?.departmentIds, departmentMapping]);

  useEffect(() => {
    if (simulationData && isEditMode) {
      const deptIds = simulationData.department_ids || [];
      const formDataFromServer = {
        title: simulationData.name,
        description: simulationData.description,
        timeLimit: simulationData.time_limit,
        rubricId: simulationData.rubric_id,
        active: simulationData.active,
        practiceSimulation: simulationData.practice_simulation ?? false,
        departmentIds: deptIds,
      };
      setFormData(formDataFromServer);
      setOriginalFormData(formDataFromServer);
      // Set current scenario IDs from server (already ordered by position)
      setCurrentScenarioIds(simulationData.scenario_ids);
      // Initialize previousDepartmentIds when loading simulation data
      setPreviousDepartmentIds((prev) => (prev.length === 0 ? deptIds : prev));

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

  // Staged selections per department (preserved when departments are deselected)
  type StagedSelections = {
    scenario_ids?: string[];
    rubric_id?: string | undefined;
  };
  const [_stagedSelections, setStagedSelections] = useState<
    Record<string, StagedSelections>
  >({});
  const [previousDepartmentIds, setPreviousDepartmentIds] = useState<string[]>(
    []
  );
  // Use ref to capture currentScenarioIds before they get filtered
  const currentScenarioIdsRef = useRef<string[]>([]);
  useEffect(() => {
    currentScenarioIdsRef.current = currentScenarioIds;
  }, [currentScenarioIds]);

  // Track department changes and manage staged selections
  useEffect(() => {
    const currentDeptIds = formData?.departmentIds || [];
    const prevDeptIds = previousDepartmentIds || [];

    // Skip if no change (initial load or same selection)
    if (
      currentDeptIds.length === prevDeptIds.length &&
      currentDeptIds.every((id, idx) => id === prevDeptIds[idx])
    ) {
      // Initialize on first load
      if (prevDeptIds.length === 0 && currentDeptIds.length > 0) {
        setPreviousDepartmentIds(currentDeptIds);
      }
      return;
    }

    // CRITICAL: Use ref to capture currentScenarioIds BEFORE they get filtered by the clearing effect
    // This ensures we save the full list before validScenarioIds changes filter them out
    // The ref contains the value from the previous render, before department changes affected validScenarioIds
    const scenariosToSave = [...currentScenarioIdsRef.current];
    const rubricToSave = formData?.rubricId || undefined;

    // Find departments that were deselected
    const deselectedDepts = prevDeptIds.filter(
      (id) => !currentDeptIds.includes(id)
    );

    // Find departments that were newly selected
    const newlySelectedDepts = currentDeptIds.filter(
      (id) => !prevDeptIds.includes(id)
    );

    // Save selections for deselected departments
    // Use the captured values to ensure we save before clearing happens
    if (deselectedDepts.length > 0) {
      setStagedSelections((prev) => {
        const updated = { ...prev };
        deselectedDepts.forEach((deptId) => {
          updated[deptId] = {
            scenario_ids: scenariosToSave,
            rubric_id: rubricToSave,
          };
        });
        return updated;
      });
    }

    // Restore selections for newly selected departments
    if (newlySelectedDepts.length > 0) {
      setStagedSelections((prev) => {
        newlySelectedDepts.forEach((deptId) => {
          const staged = prev[deptId];
          if (staged) {
            // Restore scenarios if valid
            if (staged.scenario_ids && staged.scenario_ids.length > 0) {
              const validScenarioSet = new Set(validScenarioIds);
              const validScenarios = staged.scenario_ids.filter((id) =>
                validScenarioSet.has(id)
              );
              if (validScenarios.length > 0) {
                setCurrentScenarioIds((prevScenarios) => {
                  const combined = new Set([
                    ...prevScenarios,
                    ...validScenarios,
                  ]);
                  return Array.from(combined);
                });
              }
            }

            // Restore rubric if valid
            if (
              staged.rubric_id &&
              validRubricIds.includes(staged.rubric_id) &&
              !formData?.rubricId
            ) {
              setFormData((prev) => ({ ...prev, rubricId: staged.rubric_id! }));
            }
          }
        });
        return prev; // Return unchanged since we're using separate setters
      });
    }

    // Update previous department IDs
    setPreviousDepartmentIds(currentDeptIds);
  }, [
    formData?.departmentIds,
    formData?.rubricId,
    previousDepartmentIds,
    // Note: We don't include currentScenarioIds in dependencies to avoid race conditions
    // with the clearing effect. We capture the value at the start of the effect instead.
    validScenarioIds,
    validRubricIds,
  ]);

  // Clean up staged selections for departments that are no longer valid
  useEffect(() => {
    const validDeptIds = new Set(simulationData?.valid_department_ids || []);
    setStagedSelections((prev) => {
      const cleaned: Record<string, StagedSelections> = {};
      Object.keys(prev).forEach((deptId) => {
        const staged = prev[deptId];
        if (validDeptIds.has(deptId) && staged) {
          cleaned[deptId] = staged;
        }
      });
      return cleaned;
    });
  }, [simulationData?.valid_department_ids]);

  // Clear selections when they become invalid after department changes
  // (but preserve cross-department entities and staged selections)
  useEffect(() => {
    // Clear scenarios that are no longer valid
    if (currentScenarioIds.length > 0) {
      const validSet = new Set(validScenarioIds);
      const filtered = currentScenarioIds.filter((id) => validSet.has(id));
      if (filtered.length !== currentScenarioIds.length) {
        setCurrentScenarioIds(filtered);
      }
    }
  }, [currentScenarioIds, validScenarioIds]);

  useEffect(() => {
    // Clear rubric if it's no longer valid
    if (formData?.rubricId && !validRubricIds.includes(formData.rubricId)) {
      setFormData((prev) => ({ ...prev, rubricId: "" }));
    }
  }, [formData?.rubricId, validRubricIds]);

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
          department_ids: formData?.departmentIds || null,
          active: formData?.active ?? true,
          practice_simulation: formData?.practiceSimulation || false,
          time_limit: formData?.timeLimit || null,
          rubric_id: formData?.rubricId || "",
          scenario_ids: currentScenarioIds.map((scenarioId) => ({
            scenario_id: scenarioId,
            active: scenarioActiveStates[scenarioId] ?? true,
          })),
        };

        await updateSimulationMutation.mutateAsync(updatePayload);
        toast.success("Simulation updated successfully!");
      } else {
        // CREATE mode - v2 API handles scenarios in one request
        const createPayload = {
          title: formData?.title || "",
          description: formData?.description ?? "",
          department_ids: formData?.departmentIds || null,
          active: formData?.active || true,
          practice_simulation: formData?.practiceSimulation || false,
          time_limit: formData?.timeLimit || null,
          rubric_id: formData?.rubricId || "",
          scenario_ids: currentScenarioIds.map((scenarioId) => ({
            scenario_id: scenarioId,
            active: scenarioActiveStates[scenarioId] ?? true,
          })),
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
      current.practiceSimulation !== original.practiceSimulation ||
      JSON.stringify(current.departmentIds?.sort()) !==
        JSON.stringify(original.departmentIds?.sort()) ||
      JSON.stringify(currentScenarioIds) !==
        JSON.stringify(originalScenarioIds) ||
      JSON.stringify(scenarioActiveStates) !==
        JSON.stringify(originalActiveStates)
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

        {/* Department Selection */}
        <div className="space-y-2">
          <Label htmlFor="department">Department</Label>
          {formData?.departmentIds !== undefined && !isLoading ? (
            <DepartmentPicker
              mapping={simulationData?.department_mapping || {}}
              validIds={simulationData?.valid_department_ids || []}
              selectedIds={formData.departmentIds || []}
              onSelect={(ids) => handleInputChange("departmentIds", ids)}
              placeholder="All Departments"
              disabled={isReadonly}
              multiSelect={true}
            />
          ) : (
            <Skeleton className="h-10 w-full" />
          )}
          {errors.departmentIds && (
            <p className="text-sm text-destructive">{errors.departmentIds}</p>
          )}
        </div>

        {/* Active and Practice Simulation Switches */}
        <div className="space-y-2 pt-2">
          {/* Active Switch */}
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Label
                htmlFor="active"
                className="text-sm flex items-center gap-1.5"
              >
                <Power className="h-3.5 w-3.5 text-muted-foreground" />
                Active
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
            <p className="text-xs text-muted-foreground pl-5">
              Inactive simulations will not be available for cohorts
            </p>
          </div>

          {/* Practice Simulation Switch - Only for superadmin */}
          {effectiveProfile?.role === "superadmin" && (
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Label
                  htmlFor="practiceSimulation"
                  className="text-sm flex items-center gap-1.5"
                >
                  <GraduationCap className="h-3.5 w-3.5 text-muted-foreground" />
                  Practice
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
              <p className="text-xs text-muted-foreground pl-5">
                Show this simulation on the practice page
              </p>
            </div>
          )}
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
                  validIds={validRubricIds}
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
              <ScenarioPicker
                scenarioMapping={simulationData?.scenario_mapping || {}}
                validScenarioIds={validScenarioIds}
                selectedScenarioIds={currentScenarioIds}
                onSelect={handleScenarioSelection}
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
                  ? (scenarioStats?.can_remove ?? false)
                  : true; // New scenarios always show remove

                // Get active state for styling
                const isScenarioActive =
                  scenarioActiveStates[scenarioId] ?? true;

                return (
                  <Card
                    key={scenarioId}
                    className={`p-4 cursor-move hover:shadow-md transition-all flex flex-col h-full ${
                      draggedScenario === scenarioId ? "opacity-50" : ""
                    } ${!isScenarioActive ? "opacity-50 bg-muted" : ""}`}
                    draggable={!isReadonly}
                    onDragStart={(e) =>
                      !isReadonly && handleDragStartScenario(e, scenarioId)
                    }
                    onDragOver={handleDragOver}
                    onDrop={(e) => !isReadonly && handleDrop(e, scenarioId)}
                  >
                    {/* Header: Title, Description, and Active Switch */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <h4 className="font-medium text-sm line-clamp-1">
                          {scenarioData.name || "Unnamed Scenario"}
                        </h4>
                        <p className="text-xs text-muted-foreground line-clamp-4 mt-2">
                          {scenarioData.description ||
                            "No description provided"}
                        </p>
                      </div>
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

                    {/* Content area with flex-grow */}
                    <div className="flex-grow flex flex-col">
                      {/* Bottom section - Statistics and Actions */}
                      <div className="space-y-2 mt-auto">
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
                              <span>
                                Success: {scenarioStats.success_rate}%
                              </span>
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
