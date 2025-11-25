/**
 * Simulation.tsx
 * Used to create and manage simulations for the admin dashboard
 * @AshokSaravanan222 & @siladiea
 * 05/20/2025
 */
"use client";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
// RubricPicker is now used in SimulationContentTable, not here
import { Textarea } from "@/components/ui/textarea";

import { DepartmentPicker } from "@/components/common/forms/DepartmentPicker";
import { AddContentButton } from "@/components/common/simulations/AddContentButton";
import SearchExistingScenarioModal from "@/components/common/simulations/SearchExistingScenarioModal";
import SearchExistingVideoModal from "@/components/common/simulations/SearchExistingVideoModal";
import {
  SimulationContentTable,
  type ContentItem,
} from "@/components/common/simulations/SimulationContentTable";
import { Switch } from "@/components/ui/switch";
import { useBreadcrumbContext } from "@/contexts/breadcrumb-context";
import { useProfile } from "@/contexts/profile-context";
import {
  getDefaultDepartmentIds,
  transformDepartmentIdsForSubmit,
} from "@/utils/department-picker-helpers";
import { GraduationCap, Loader2, Power } from "lucide-react";
import { useRouter } from "next/navigation";

// Type-only import from server page
import type {
  CreateSimulationIn,
  CreateSimulationOut,
  SimulationDetailDefaultOut,
  SimulationDetailOut,
  UpdateSimulationIn,
  UpdateSimulationOut,
} from "@/app/(main)/create/simulations/s/[simulationId]/page";

export interface SimulationProps {
  simulationId?: string;
  // Optional server-provided data and actions (for server-side rendering)
  simulationDetail?: SimulationDetailOut;
  simulationDetailDefault?: SimulationDetailDefaultOut;
  createSimulationAction?: (
    input: CreateSimulationIn
  ) => Promise<CreateSimulationOut>;
  updateSimulationAction?: (
    input: UpdateSimulationIn
  ) => Promise<UpdateSimulationOut>;
  searchScenarioAction?: (input: {
    body: { query: string; limit: number };
  }) => Promise<
    Array<{
      id: string;
      name: string | null;
      problem_statement: string | null;
      persona_id: string | null;
      default_scenario: boolean;
      score: number;
    }>
  >;
  searchVideoAction?: (input: {
    body: { query: string; limit: number; department_ids?: string[] | null };
  }) => Promise<
    Array<{
      id: string;
      name: string | null;
      description: string | null;
      length_seconds: number;
      department_ids: string[] | null;
      score: number;
    }>
  >;
}

interface FormData {
  title?: string;
  description?: string;
  cohortIds?: string[];
  active?: boolean;
  practiceSimulation?: boolean;
  departmentIds?: string[] | null;
}

interface FormErrors {
  title?: string;
  cohortIds?: string[];
  departmentIds?: string[];
}

export default function Simulation({
  simulationId,
  simulationDetail: serverSimulationDetail,
  simulationDetailDefault: serverSimulationDetailDefault,
  createSimulationAction,
  updateSimulationAction,
  searchScenarioAction,
  searchVideoAction,
}: SimulationProps) {
  const { effectiveProfile } = useProfile();
  const { setEntityMetadata, clearEntityMetadata } = useBreadcrumbContext();
  const isSuperadmin = effectiveProfile?.role === "superadmin";

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingSimulationId, setEditingSimulationId] = useState<string | null>(
    null
  );
  const [draggedScenario, setDraggedScenario] = useState<string | null>(null);
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
  const router = useRouter();
  const isEditMode = !!simulationId;

  // Use server-provided data (no React Query needed when server data is provided)
  const simulationDetail = serverSimulationDetail;
  const simulationDetailDefault = serverSimulationDetailDefault;
  const simulationData = isEditMode
    ? simulationDetail
    : simulationDetailDefault;

  // Extract strongly typed scenario from SimulationDetailOut or SimulationDetailDefaultOut
  type ScenarioInSimulation = NonNullable<
    SimulationDetailOut["scenarios"]
  >[number] extends infer S
    ? S
    : NonNullable<SimulationDetailDefaultOut["scenarios"]>[number];

  // Extract body types from server action types for type safety
  type CreateSimulationBody = CreateSimulationIn extends { body: infer B }
    ? B
    : never;
  type UpdateSimulationBody = UpdateSimulationIn extends { body: infer B }
    ? B
    : never;

  // Use server actions directly (no mutations needed)
  const handleCreateSimulation = async (body: CreateSimulationBody) => {
    if (!createSimulationAction) {
      throw new Error("createSimulationAction is required");
    }
    await createSimulationAction({ body });
  };

  const handleUpdateSimulation = async (body: UpdateSimulationBody) => {
    if (!updateSimulationAction) {
      throw new Error("updateSimulationAction is required");
    }
    await updateSimulationAction({ body });
  };

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

  const defaultDepartmentIds = useMemo(
    () =>
      getDefaultDepartmentIds(
        isSuperadmin,
        effectiveProfile?.primaryDepartmentId ?? null
      ),
    [isSuperadmin, effectiveProfile?.primaryDepartmentId]
  );

  const initialFormData: FormData = useMemo(
    () => ({
      title: "",
      description: "",
      cohortIds: [],
      active: true,
      practiceSimulation: false,
      departmentIds: defaultDepartmentIds,
    }),
    [defaultDepartmentIds]
  );

  const [formData, setFormData] = useState<FormData>();
  const [originalFormData, setOriginalFormData] = useState<FormData>();
  const [errors, setErrors] = useState<FormErrors>({});

  // Readonly logic using server-provided can_edit flag
  const isReadonly = useMemo(() => {
    if (!isEditMode || !simulationData) return false;
    return !simulationData.can_edit;
  }, [isEditMode, simulationData]);

  // Extract department mapping
  const departmentMapping = useMemo(
    () => simulationData?.department_mapping || {},
    [simulationData]
  );

  // State for managing unified content (scenarios + videos)
  const [currentContentItems, setCurrentContentItems] = useState<ContentItem[]>(
    []
  );
  const [stagedContentItems, setStagedContentItems] = useState<ContentItem[]>(
    []
  ); // New items not yet saved
  const [contentActiveStates, setContentActiveStates] = useState<
    Record<string, boolean>
  >({});
  const [originalContentActiveStates, setOriginalContentActiveStates] =
    useState<Record<string, boolean>>({});

  // Switch field states
  const [contentSwitchStates, setContentSwitchStates] = useState<
    Record<
      string,
      {
        hints_enabled?: boolean;
        objectives_enabled?: boolean;
        input_guardrail_enabled?: boolean;
        output_guardrail_enabled?: boolean;
        image_input_enabled?: boolean;
        copy_paste_allowed?: boolean;
        audio_enabled?: boolean;
        text_enabled?: boolean;
        show_scenario?: boolean;
        rubric_id?: string | null;
        time_limit_seconds?: number | null;
      }
    >
  >({});
  const [originalContentSwitchStates, setOriginalContentSwitchStates] =
    useState<
      Record<
        string,
        {
          hints_enabled?: boolean;
          objectives_enabled?: boolean;
          input_guardrail_enabled?: boolean;
          output_guardrail_enabled?: boolean;
          image_input_enabled?: boolean;
          copy_paste_allowed?: boolean;
          audio_enabled?: boolean;
          text_enabled?: boolean;
          show_scenario?: boolean;
          rubric_id?: string | null;
          time_limit_seconds?: number | null;
        }
      >
    >({});

  // Legacy state for backward compatibility during migration
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
  // Includes: items from selected departments + cross-department items + currently selected items from content
  const validRubricIds = useMemo(() => {
    const baseIds = simulationData?.valid_rubric_ids || [];
    const selectedDeptIds = formData?.departmentIds || [];

    // Always include currently selected rubrics from content items (for edit mode - ensures selected items are visible)
    const selectedRubricIdSet = new Set<string>();
    currentContentItems.forEach((item) => {
      if (item.type === "scenario" && item.rubric_id) {
        selectedRubricIdSet.add(item.rubric_id);
      }
    });

    // If no departments selected, return all valid IDs plus selected ones
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
    // 3. Currently selected from content
    const filtered = baseIds.filter((id) => {
      const inSelectedDepts = selectedDeptRubricIds.has(id);
      const isCrossDept = !allDeptRubricIds.has(id); // Not in any department = cross-department
      return inSelectedDepts || isCrossDept;
    });

    return Array.from(new Set([...filtered, ...selectedRubricIdSet]));
  }, [
    simulationData?.valid_rubric_ids,
    formData?.departmentIds,
    currentContentItems,
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
      // Note: This is legacy code - active states are now handled via contentActiveStates
      // Keeping for backward compatibility during migration
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

  // Legacy drag-and-drop handlers - replaced by table's up/down buttons
  const _handleDragStartScenario = (e: React.DragEvent, scenarioId: string) => {
    setDraggedScenario(scenarioId);
    e.dataTransfer.effectAllowed = "move";
  };

  const _handleDragOver = (e: React.DragEvent) => {
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
  // Convert server data to unified ContentItem format
  const unifiedContentItems = useMemo(() => {
    const items: ContentItem[] = [];

    // Add scenarios from server data
    if (simulationData?.scenarios) {
      simulationData.scenarios.forEach((scenario: ScenarioInSimulation) => {
        const key = `scenario:${scenario.scenario_id}`;
        const switchState = contentSwitchStates[key];
        items.push({
          type: "scenario",
          id: scenario.scenario_id,
          title: scenario.title,
          description: scenario.description,
          active: contentActiveStates[key] ?? scenario.active,
          position: scenario.position,
          usage_count: scenario.usage_count,
          success_rate: scenario.success_rate,
          last_used: scenario.last_used,
          can_remove: scenario.can_remove,
          isNew: false,
          hints_enabled:
            switchState?.hints_enabled ?? scenario.hints_enabled ?? false,
          objectives_enabled:
            switchState?.objectives_enabled ??
            scenario.objectives_enabled ??
            true,
          input_guardrail_enabled:
            switchState?.input_guardrail_enabled ??
            scenario.input_guardrail_enabled ??
            false,
          output_guardrail_enabled:
            switchState?.output_guardrail_enabled ??
            scenario.output_guardrail_enabled ??
            false,
          image_input_enabled:
            switchState?.image_input_enabled ??
            scenario.image_input_enabled ??
            false,
          copy_paste_allowed:
            switchState?.copy_paste_allowed ??
            scenario.copy_paste_allowed ??
            false,
          audio_enabled:
            switchState?.audio_enabled ?? scenario.audio_enabled ?? false,
          text_enabled:
            switchState?.text_enabled ?? scenario.text_enabled ?? true,
          show_scenario:
            switchState?.show_scenario ?? scenario.show_scenario ?? true,
          rubric_id: switchState?.rubric_id ?? scenario.rubric_id ?? null,
          time_limit_seconds:
            switchState?.time_limit_seconds ??
            scenario.time_limit_seconds ??
            null,
        });
      });
    }

    // Add videos from server data
    if (simulationData?.videos) {
      simulationData.videos.forEach((video) => {
        const key = `video:${video["video_id"]}`;
        const switchState = contentSwitchStates[key];
        items.push({
          type: "video",
          id: video["video_id"] as string,
          title: video["title"] as string,
          description: video["description"] as string,
          active: contentActiveStates[key] ?? (video["active"] as boolean),
          position: video["position"] as number,
          usage_count: video["usage_count"] as number,
          success_rate: video["success_rate"] as number,
          last_used: video["last_used"] as string | null,
          can_remove: video["can_remove"] as boolean,
          length_seconds: video["length_seconds"] as number,
          isNew: false,
          objectives_enabled:
            switchState?.objectives_enabled ??
            (video["objectives_enabled"] as boolean) ??
            true,
          show_scenario:
            switchState?.show_scenario ??
            (video["show_scenario"] as boolean) ??
            true,
        });
      });
    }

    // Add staged items (newly added, not yet saved)
    stagedContentItems.forEach((item) => {
      const key = `${item.type}:${item.id}`;
      items.push({
        ...item,
        active: contentActiveStates[key] ?? item.active,
      });
    });

    // Sort by position
    return items.sort((a, b) => a.position - b.position);
  }, [
    simulationData?.scenarios,
    simulationData?.videos,
    stagedContentItems,
    contentActiveStates,
    contentSwitchStates,
  ]);

  // Initialize content active states and switch states from server data
  useEffect(() => {
    if (isEditMode && simulationData) {
      const newActiveStates: Record<string, boolean> = {};
      const newOriginalActiveStates: Record<string, boolean> = {};
      const newSwitchStates: Record<
        string,
        {
          hints_enabled?: boolean;
          objectives_enabled?: boolean;
          input_guardrail_enabled?: boolean;
          output_guardrail_enabled?: boolean;
          image_input_enabled?: boolean;
          copy_paste_allowed?: boolean;
          audio_enabled?: boolean;
          text_enabled?: boolean;
          show_scenario?: boolean;
          rubric_id?: string | null;
          time_limit_seconds?: number | null;
        }
      > = {};
      const newOriginalSwitchStates: Record<
        string,
        {
          hints_enabled?: boolean;
          objectives_enabled?: boolean;
          input_guardrail_enabled?: boolean;
          output_guardrail_enabled?: boolean;
          image_input_enabled?: boolean;
          copy_paste_allowed?: boolean;
          audio_enabled?: boolean;
          text_enabled?: boolean;
          show_scenario?: boolean;
          rubric_id?: string | null;
          time_limit_seconds?: number | null;
        }
      > = {};

      // Initialize active states and switch states from scenarios
      if (simulationData.scenarios) {
        simulationData.scenarios.forEach((scenario: ScenarioInSimulation) => {
          const key = `scenario:${scenario.scenario_id}`;
          newActiveStates[key] = scenario.active;
          newOriginalActiveStates[key] = scenario.active;
          newSwitchStates[key] = {
            hints_enabled: scenario.hints_enabled ?? false,
            objectives_enabled: scenario.objectives_enabled ?? true,
            input_guardrail_enabled: scenario.input_guardrail_enabled ?? false,
            output_guardrail_enabled:
              scenario.output_guardrail_enabled ?? false,
            image_input_enabled: scenario.image_input_enabled ?? false,
            copy_paste_allowed: scenario.copy_paste_allowed ?? false,
            audio_enabled: scenario.audio_enabled ?? false,
            text_enabled: scenario.text_enabled ?? true,
            show_scenario: scenario.show_scenario ?? true,
            rubric_id: scenario.rubric_id ?? null,
            time_limit_seconds: scenario.time_limit_seconds ?? null,
          };
          newOriginalSwitchStates[key] = {
            hints_enabled: scenario.hints_enabled ?? false,
            objectives_enabled: scenario.objectives_enabled ?? true,
            input_guardrail_enabled: scenario.input_guardrail_enabled ?? false,
            output_guardrail_enabled:
              scenario.output_guardrail_enabled ?? false,
            image_input_enabled: scenario.image_input_enabled ?? false,
            copy_paste_allowed: scenario.copy_paste_allowed ?? false,
            audio_enabled: scenario.audio_enabled ?? false,
            text_enabled: scenario.text_enabled ?? true,
            show_scenario: scenario.show_scenario ?? true,
            rubric_id: scenario.rubric_id ?? null,
            time_limit_seconds: scenario.time_limit_seconds ?? null,
          };
        });
      }

      // Initialize active states and switch states from videos
      if (simulationData.videos) {
        simulationData.videos.forEach((video) => {
          const key = `video:${video["video_id"]}`;
          newActiveStates[key] = video["active"] as boolean;
          newOriginalActiveStates[key] = video["active"] as boolean;
          const videoObjectivesEnabled =
            (video["objectives_enabled"] as boolean) ?? true;
          const videoShowScenario =
            (video["show_scenario"] as boolean) ?? true;
          newSwitchStates[key] = {
            objectives_enabled: videoObjectivesEnabled,
            show_scenario: videoShowScenario,
          };
          newOriginalSwitchStates[key] = {
            objectives_enabled: videoObjectivesEnabled,
            show_scenario: videoShowScenario,
          };
        });
      }

      setContentActiveStates((prev) => {
        // Merge with existing states to preserve user changes
        return { ...newActiveStates, ...prev };
      });
      setOriginalContentActiveStates(newOriginalActiveStates);
      setContentSwitchStates((prev) => {
        // Merge with existing states to preserve user changes
        return { ...newSwitchStates, ...prev };
      });
      setOriginalContentSwitchStates(newOriginalSwitchStates);
    } else if (!isEditMode) {
      // Reset for create mode
      setContentActiveStates({});
      setOriginalContentActiveStates({});
      setContentSwitchStates({});
      setOriginalContentSwitchStates({});
    }
  }, [isEditMode, simulationData]);

  // Update currentContentItems from unifiedContentItems and sync legacy state
  useEffect(() => {
    setCurrentContentItems(unifiedContentItems);
    // Sync legacy currentScenarioIds for backward compatibility
    const scenarioIds = unifiedContentItems
      .filter((item) => item.type === "scenario")
      .map((item) => item.id);
    setCurrentScenarioIds(scenarioIds);
  }, [unifiedContentItems]);

  // Use ref to capture currentScenarioIds before they get filtered (legacy)
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
    // Note: rubric_id is now per-scenario, not simulation-level, so we don't save it here

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
            // rubric_id is now per-scenario, not simulation-level
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

            // Note: rubric_id is now per-scenario, not simulation-level, so we don't restore it here
          }
        });
        return prev; // Return unchanged since we're using separate setters
      });
    }

    // Update previous department IDs
    setPreviousDepartmentIds(currentDeptIds);
  }, [
    formData?.departmentIds,
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

  // Note: rubric_id is now per-scenario, not simulation-level, so we don't clear it here

  // Modal states
  const [showSearchScenarioModal, setShowSearchScenarioModal] = useState(false);
  const [showSearchVideoModal, setShowSearchVideoModal] = useState(false);

  // Legacy drag-and-drop handler - replaced by table's up/down buttons
  const _handleDrop = (e: React.DragEvent, targetScenarioId: string) => {
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
      const validDepartmentIds = simulationData?.valid_department_ids || [];
      const finalDepartmentIds = transformDepartmentIdsForSubmit(
        formData?.departmentIds || [],
        isSuperadmin,
        validDepartmentIds
      );

      const targetSimulationId = simulationId || editingSimulationId;

      // Convert unified content items to API format
      // Separate scenarios and videos while preserving order
      interface ContentItemPayload {
        type: "scenario" | "video";
        id: string;
        active: boolean;
        hints_enabled?: boolean;
        objectives_enabled?: boolean;
        input_guardrail_enabled?: boolean;
        output_guardrail_enabled?: boolean;
        image_input_enabled?: boolean;
        copy_paste_allowed?: boolean;
        audio_enabled?: boolean;
        text_enabled?: boolean;
        show_scenario?: boolean;
        rubric_id?: string | null;
        time_limit_seconds?: number | null;
      }

      const contentItems: ContentItemPayload[] = currentContentItems.map(
        (item) => {
          const key = `${item.type}:${item.id}`;
          const switchState = contentSwitchStates[key];
          const baseItem: ContentItemPayload = {
            type: item.type,
            id: item.id,
            active: contentActiveStates[key] ?? item.active,
          };

          if (item.type === "scenario") {
            baseItem.hints_enabled =
              switchState?.hints_enabled ?? item.hints_enabled ?? false;
            baseItem.objectives_enabled =
              switchState?.objectives_enabled ??
              item.objectives_enabled ??
              true;
            baseItem.input_guardrail_enabled =
              switchState?.input_guardrail_enabled ??
              item.input_guardrail_enabled ??
              false;
            baseItem.output_guardrail_enabled =
              switchState?.output_guardrail_enabled ??
              item.output_guardrail_enabled ??
              false;
            baseItem.image_input_enabled =
              switchState?.image_input_enabled ??
              item.image_input_enabled ??
              false;
            baseItem.copy_paste_allowed =
              switchState?.copy_paste_allowed ??
              item.copy_paste_allowed ??
              false;
            baseItem.audio_enabled =
              switchState?.audio_enabled ?? item.audio_enabled ?? false;
            baseItem.text_enabled =
              switchState?.text_enabled ?? item.text_enabled ?? true;
            baseItem.show_scenario =
              switchState?.show_scenario ?? item.show_scenario ?? true;
            baseItem.rubric_id =
              switchState?.rubric_id ?? item.rubric_id ?? null;
            baseItem.time_limit_seconds =
              switchState?.time_limit_seconds ??
              item.time_limit_seconds ??
              null;
          } else if (item.type === "video") {
            baseItem.objectives_enabled =
              switchState?.objectives_enabled ??
              item.objectives_enabled ??
              true;
            baseItem.show_scenario =
              switchState?.show_scenario ?? item.show_scenario ?? true;
          }

          return baseItem;
        }
      );

      if (targetSimulationId) {
        // UPDATE mode - unified content items
        const updatePayload = {
          simulationId: targetSimulationId,
          title: formData?.title || "",
          description: formData?.description ?? "",
          department_ids: finalDepartmentIds,
          active: formData?.active ?? true,
          practice_simulation: formData?.practiceSimulation || false,
          rubric_id: "", // Deprecated: kept for backward compatibility
          time_limit: null, // Deprecated: kept for backward compatibility
          content_items: contentItems,
        };

        await handleUpdateSimulation(updatePayload);
        toast.success("Simulation updated successfully!");
      } else {
        // CREATE mode - unified content items
        const createPayload = {
          title: formData?.title || "",
          description: formData?.description ?? "",
          department_ids: finalDepartmentIds,
          active: formData?.active || true,
          practice_simulation: formData?.practiceSimulation || false,
          rubric_id: "", // Deprecated: kept for backward compatibility
          time_limit: null, // Deprecated: kept for backward compatibility
          content_items: contentItems,
        };

        await handleCreateSimulation(createPayload);
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

  // Handler for editing scenario - opens in new tab
  const editScenario = (scenarioId: string) => {
    window.open(`/create/scenarios/s/${scenarioId}`, "_blank");
  };

  // Legacy handler - not used in table-based interface
  const _handleScenarioSelection = (scenarioIds: string[]) => {
    setCurrentScenarioIds(scenarioIds);
  };

  // Check if form has changes
  const hasChanges = useMemo(() => {
    if (!isEditMode || !formData || !originalFormData || !simulationData)
      return false;

    const current = formData;
    const original = originalFormData;

    // Get original content IDs from server data
    const originalScenarioIds = simulationData.scenario_ids || [];
    const originalVideoIds = simulationData.video_ids || [];
    const currentScenarioIdsFromContent = currentContentItems
      .filter((item) => item.type === "scenario")
      .map((item) => item.id);
    const currentVideoIdsFromContent = currentContentItems
      .filter((item) => item.type === "video")
      .map((item) => item.id);

    return (
      current.title !== original.title ||
      current.description !== original.description ||
      current.active !== original.active ||
      current.practiceSimulation !== original.practiceSimulation ||
      JSON.stringify(current.departmentIds?.sort()) !==
        JSON.stringify(original.departmentIds?.sort()) ||
      JSON.stringify(currentScenarioIdsFromContent) !==
        JSON.stringify(originalScenarioIds) ||
      JSON.stringify(currentVideoIdsFromContent) !==
        JSON.stringify(originalVideoIds) ||
      JSON.stringify(contentActiveStates) !==
        JSON.stringify(originalContentActiveStates) ||
      JSON.stringify(contentSwitchStates) !==
        JSON.stringify(originalContentSwitchStates)
    );
  }, [
    formData,
    originalFormData,
    isEditMode,
    currentContentItems,
    simulationData,
    contentActiveStates,
    originalContentActiveStates,
    contentSwitchStates,
    originalContentSwitchStates,
  ]);

  // Helper function to format last used date (not currently used in table)
  const _formatLastUsed = (date: string | null): string => {
    if (!date) return "Never";
    const d = new Date(date);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  // Helper function to remove a scenario (legacy - replaced by handleContentRemove)
  // Kept for backward compatibility but not used
  const _handleRemoveScenario = (scenarioId: string) => {
    setCurrentScenarioIds((prev) => prev.filter((id) => id !== scenarioId));
    // Active states are now handled via contentActiveStates in handleContentRemove
  };


  const handleContentActiveToggle = useCallback(
    (contentId: string, active: boolean) => {
      setContentActiveStates((prev) => ({
        ...prev,
        [contentId]: active,
      }));
    },
    []
  );

  // Switch toggle handlers
  const handleHintsToggle = useCallback(
    (contentId: string, enabled: boolean) => {
      setContentSwitchStates((prev) => ({
        ...prev,
        [contentId]: {
          ...prev[contentId],
          hints_enabled: enabled,
        },
      }));
    },
    []
  );

  const handleObjectivesToggle = useCallback(
    (contentId: string, enabled: boolean) => {
      setContentSwitchStates((prev) => ({
        ...prev,
        [contentId]: {
          ...prev[contentId],
          objectives_enabled: enabled,
        },
      }));
    },
    []
  );

  const handleInputGuardrailToggle = useCallback(
    (contentId: string, enabled: boolean) => {
      setContentSwitchStates((prev) => ({
        ...prev,
        [contentId]: {
          ...prev[contentId],
          input_guardrail_enabled: enabled,
        },
      }));
    },
    []
  );

  const handleOutputGuardrailToggle = useCallback(
    (contentId: string, enabled: boolean) => {
      setContentSwitchStates((prev) => ({
        ...prev,
        [contentId]: {
          ...prev[contentId],
          output_guardrail_enabled: enabled,
        },
      }));
    },
    []
  );

  const handleImageInputToggle = useCallback(
    (contentId: string, enabled: boolean) => {
      setContentSwitchStates((prev) => ({
        ...prev,
        [contentId]: {
          ...prev[contentId],
          image_input_enabled: enabled,
        },
      }));
    },
    []
  );

  const handleCopyPasteToggle = useCallback(
    (contentId: string, enabled: boolean) => {
      setContentSwitchStates((prev) => ({
        ...prev,
        [contentId]: {
          ...prev[contentId],
          copy_paste_allowed: enabled,
        },
      }));
    },
    []
  );

  const handleRubricChange = useCallback(
    (contentId: string, rubricId: string | null) => {
      setContentSwitchStates((prev) => ({
        ...prev,
        [contentId]: {
          ...prev[contentId],
          rubric_id: rubricId,
        },
      }));
    },
    []
  );

  const handleTimeLimitChange = useCallback(
    (contentId: string, timeLimitMinutes: number | null) => {
      // Convert minutes to seconds for storage
      const timeLimitSeconds = timeLimitMinutes ? timeLimitMinutes * 60 : null;
      setContentSwitchStates((prev) => ({
        ...prev,
        [contentId]: {
          ...prev[contentId],
          time_limit_seconds: timeLimitSeconds,
        },
      }));
    },
    []
  );

  const handleContentMoveUp = useCallback((contentId: string) => {
    setCurrentContentItems((prev) => {
      const index = prev.findIndex(
        (item) => `${item.type}:${item.id}` === contentId
      );
      if (index <= 0) return prev;
      const newItems = [...prev];
      const prevItem = newItems[index - 1];
      const currentItem = newItems[index];
      if (!prevItem || !currentItem) return prev;
      [newItems[index - 1], newItems[index]] = [currentItem, prevItem];
      // Recalculate positions sequentially
      return newItems.map((item, idx) => ({ ...item, position: idx + 1 }));
    });
  }, []);

  const handleContentMoveDown = useCallback((contentId: string) => {
    setCurrentContentItems((prev) => {
      const index = prev.findIndex(
        (item) => `${item.type}:${item.id}` === contentId
      );
      if (index < 0 || index >= prev.length - 1) return prev;
      const newItems = [...prev];
      const currentItem = newItems[index];
      const nextItem = newItems[index + 1];
      if (!currentItem || !nextItem) return prev;
      [newItems[index], newItems[index + 1]] = [nextItem, currentItem];
      // Recalculate positions sequentially
      return newItems.map((item, idx) => ({ ...item, position: idx + 1 }));
    });
  }, []);

  const handleContentRemove = useCallback((contentId: string) => {
    const [type, id] = contentId.split(":");
    if (type === "scenario") {
      setCurrentScenarioIds((prev) => prev.filter((sid) => sid !== id));
    }
    setCurrentContentItems((prev) =>
      prev.filter((item) => `${item.type}:${item.id}` !== contentId)
    );
    setStagedContentItems((prev) =>
      prev.filter((item) => `${item.type}:${item.id}` !== contentId)
    );
    setContentActiveStates((prev) => {
      const newStates = { ...prev };
      delete newStates[contentId];
      return newStates;
    });
  }, []);

  const handleAudioToggle = useCallback(
    (contentId: string, enabled: boolean) => {
      setContentSwitchStates((prev) => ({
        ...prev,
        [contentId]: {
          ...prev[contentId],
          audio_enabled: enabled,
        },
      }));
    },
    []
  );

  const handleTextToggle = useCallback(
    (contentId: string, enabled: boolean) => {
      setContentSwitchStates((prev) => ({
        ...prev,
        [contentId]: {
          ...prev[contentId],
          text_enabled: enabled,
        },
      }));
    },
    []
  );

  const handleShowScenarioToggle = useCallback(
    (contentId: string, enabled: boolean) => {
      setContentSwitchStates((prev) => ({
        ...prev,
        [contentId]: {
          ...prev[contentId],
          show_scenario: enabled,
        },
      }));
    },
    []
  );

  const handleStagedScenarios = useCallback(
    (
      scenarios: Array<{
        scenarioId: string;
        name?: string;
        description?: string;
      }>
    ) => {
      const maxPosition = Math.max(
        ...currentContentItems.map((item) => item.position),
        0
      );
      const newItems: ContentItem[] = scenarios.map((scenario, idx) => ({
        type: "scenario" as const,
        id: scenario.scenarioId,
        title: scenario.name || "Unnamed Scenario",
        description: scenario.description || "",
        active: true,
        position: maxPosition + idx + 1,
        usage_count: 0,
        success_rate: 0,
        last_used: null,
        can_remove: true,
        isNew: true,
      }));
      setStagedContentItems((prev) => [...prev, ...newItems]);
      setCurrentScenarioIds((prev) => [
        ...prev,
        ...scenarios.map((s) => s.scenarioId),
      ]);
    },
    [currentContentItems]
  );

  const handleStagedVideos = useCallback(
    (
      videos: Array<{
        videoId: string;
        name?: string;
        description?: string;
        length_seconds?: number;
      }>
    ) => {
      const maxPosition = Math.max(
        ...currentContentItems.map((item) => item.position),
        0
      );
      const newItems: ContentItem[] = videos.map((video, idx) => ({
        type: "video" as const,
        id: video.videoId,
        title: video.name || "Unnamed Video",
        description: video.description || "",
        active: true,
        position: maxPosition + idx + 1,
        usage_count: 0,
        success_rate: 0,
        last_used: null,
        can_remove: true,
        length_seconds: video.length_seconds || 0,
        isNew: true,
      }));
      setStagedContentItems((prev) => [...prev, ...newItems]);
    },
    [currentContentItems]
  );

  // TODO: Add parameter badge display (requires loading from scenario_parameter_items junction)

  return (
    <div
      className="space-y-6"
      data-page={`simulation-${isEditMode ? "edit" : "new"}`}
    >
      {isReadonly && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-yellow-400"
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
              <h3 className="text-sm font-medium text-yellow-800">
                Simulation is read-only
              </h3>
              <div className="mt-2 text-sm text-yellow-700">
                <p>
                  {simulationData?.department_ids?.length === 0
                    ? "This is a default simulation that cannot be edited. You can view the details but cannot make changes."
                    : "This simulation cannot be edited. You can view the details but cannot make changes."}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
      <form onSubmit={handleFormSubmit} className="space-y-6">
        {/* Basic Simulation Information */}

        <div className="space-y-2">
          <Label htmlFor="title">Title</Label>
          {formData?.title !== undefined ? (
            <Input
              id="title"
              data-testid="input-simulation-title"
              value={formData.title}
              onChange={(e) => handleInputChange("title", e.target.value)}
              placeholder="Enter simulation title"
              className={errors.title ? "border-destructive" : ""}
              disabled={isReadonly}
            />
          ) : null}
          {errors.title && (
            <p className="text-sm text-destructive">{errors.title}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          {formData?.description !== undefined ? (
            <Textarea
              id="description"
              data-testid="input-simulation-description"
              value={formData.description || ""}
              onChange={(e) => handleInputChange("description", e.target.value)}
              placeholder="Enter a brief description (optional)"
              rows={3}
              disabled={isReadonly}
            />
          ) : null}
        </div>

        {/* Department Selection */}
        {simulationData?.valid_department_ids &&
          simulationData.valid_department_ids.length > 1 && (
            <div className="space-y-2">
              <Label htmlFor="department">Department</Label>
              {formData?.departmentIds !== undefined ? (
                <DepartmentPicker
                  mapping={simulationData?.department_mapping || {}}
                  validIds={simulationData?.valid_department_ids || []}
                  selectedIds={formData.departmentIds || []}
                  onSelect={(ids) => handleInputChange("departmentIds", ids)}
                  placeholder="All Departments"
                  disabled={isReadonly}
                  multiSelect={true}
                  triggerProps={{ "data-testid": "picker-department" }}
                />
              ) : null}
              {errors.departmentIds && (
                <p className="text-sm text-destructive">
                  {errors.departmentIds}
                </p>
              )}
            </div>
          )}

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
              {formData?.active !== undefined ? (
                <Switch
                  id="active"
                  data-testid="switch-simulation-active"
                  checked={formData.active ?? true}
                  onCheckedChange={(checked) =>
                    handleInputChange("active", checked)
                  }
                  disabled={isReadonly}
                />
              ) : null}
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
                {formData?.practiceSimulation !== undefined ? (
                  <Switch
                    id="practiceSimulation"
                    data-testid="switch-simulation-practice"
                    checked={formData.practiceSimulation ?? false}
                    onCheckedChange={(checked) =>
                      handleInputChange("practiceSimulation", checked)
                    }
                    disabled={isReadonly}
                  />
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground pl-5">
                Show this simulation on the practice page
              </p>
            </div>
          )}
        </div>

        {/* Content (Scenarios & Videos) */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <div>
              <Label htmlFor="content">Content</Label>
              <p className="text-sm text-muted-foreground">
                Manage scenarios and videos for this simulation
              </p>
            </div>
            {!isReadonly && (
              <AddContentButton
                onAddScenario={() => setShowSearchScenarioModal(true)}
                onAddVideo={() => setShowSearchVideoModal(true)}
              />
            )}
          </div>

          <SimulationContentTable
            data={currentContentItems}
            onActiveToggle={handleContentActiveToggle}
            onMoveUp={handleContentMoveUp}
            onMoveDown={handleContentMoveDown}
            onRemove={handleContentRemove}
            onEditScenario={editScenario}
            onHintsToggle={handleHintsToggle}
            onObjectivesToggle={handleObjectivesToggle}
            onInputGuardrailToggle={handleInputGuardrailToggle}
            onOutputGuardrailToggle={handleOutputGuardrailToggle}
            onImageInputToggle={handleImageInputToggle}
            onCopyPasteToggle={handleCopyPasteToggle}
            onAudioToggle={handleAudioToggle}
            onTextToggle={handleTextToggle}
            onShowScenarioToggle={handleShowScenarioToggle}
            onRubricChange={handleRubricChange}
            onTimeLimitChange={handleTimeLimitChange}
            rubricMapping={simulationData?.rubric_mapping || {}}
            validRubricIds={validRubricIds}
            readonly={isReadonly}
          />
        </div>

        {/* Search Modals */}
        {searchScenarioAction && (
          <SearchExistingScenarioModal
            open={showSearchScenarioModal}
            onOpenChange={setShowSearchScenarioModal}
            onStagedScenarios={handleStagedScenarios}
            existingScenarioIds={currentScenarioIds}
            searchScenarioAction={searchScenarioAction}
          />
        )}
        {searchVideoAction && (
          <SearchExistingVideoModal
            open={showSearchVideoModal}
            onOpenChange={setShowSearchVideoModal}
            onStagedVideos={handleStagedVideos}
            existingVideoIds={currentContentItems
              .filter((item) => item.type === "video")
              .map((item) => item.id)}
            {...(formData?.departmentIds && {
              departmentIds: formData.departmentIds,
            })}
            searchVideoAction={searchVideoAction}
          />
        )}

        {/* Submit Button */}
        <div className="flex justify-end gap-3">
          <Button
            variant="outline"
            type="button"
            data-testid="btn-back-simulation"
            onClick={() => router.push("/create/simulations")}
          >
            Back
          </Button>
          <Button
            type="submit"
            data-testid="btn-submit-simulation"
            disabled={isSubmitting || isReadonly || (isEditMode && !hasChanges)}
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
