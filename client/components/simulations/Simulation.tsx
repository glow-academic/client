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

import { GenericPicker } from "@/components/common/forms/GenericPicker";
import {
  SimulationContentTable,
  type ContentItem,
} from "@/components/common/simulations/SimulationContentTable";
import { SimulationScenariosTable } from "@/components/common/simulations/SimulationScenariosTable";
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
  SimulationDetailOut,
  SimulationNewOut,
  UpdateSimulationIn,
  UpdateSimulationOut,
} from "@/app/(main)/create/simulations/s/[simulationId]/page";

export interface SimulationProps {
  simulationId?: string;
  // Optional server-provided data and actions (for server-side rendering)
  simulationDetail?: SimulationDetailOut;
  simulationDetailDefault?: SimulationNewOut;
  createSimulationAction?: (
    input: CreateSimulationIn
  ) => Promise<CreateSimulationOut>;
  updateSimulationAction?: (
    input: UpdateSimulationIn
  ) => Promise<UpdateSimulationOut>;
}

interface FormData {
  title?: string;
  description?: string;
  cohortIds?: string[];
  active?: boolean;
  practiceSimulation?: boolean;
  departmentIds?: string[] | null;
  hint_agent_id?: string | null;
  grade_text_agent_id?: string | null;
  grade_voice_agent_id?: string | null;
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
}: SimulationProps) {
  const { effectiveProfile } = useProfile();
  const { setEntityMetadata, clearEntityMetadata } = useBreadcrumbContext();
  const isSuperadmin = effectiveProfile?.role === "superadmin";

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingSimulationId, setEditingSimulationId] = useState<string | null>(
    null
  );
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
  const router = useRouter();
  const isEditMode = !!simulationId;

  // Use server-provided data (no React Query needed when server data is provided)
  const simulationDetail = serverSimulationDetail;
  const simulationDetailDefault = serverSimulationDetailDefault;
  const simulationData = isEditMode
    ? simulationDetail
    : simulationDetailDefault;

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
  // Extract agent mapping (only available in detail endpoint, not new endpoint)
  // Map to the expected type format: Record<string, { name: string; roles?: string[] }>
  const agentMapping = useMemo(() => {
    if (isEditMode && simulationDetail && "agent_mapping" in simulationDetail) {
      const mapping = simulationDetail.agent_mapping || {};
      const mapped: Record<string, { name: string; roles?: string[] }> = {};
      Object.entries(mapping).forEach(([key, value]) => {
        mapped[key] =
          value.roles && value.roles.length > 0
            ? { name: value.name, roles: value.roles }
            : { name: value.name };
      });
      return mapped;
    }
    return {};
  }, [isEditMode, simulationDetail]);
  const validAgentIds = useMemo(
    () =>
      (simulationData as { valid_agent_ids?: string[] })?.valid_agent_ids || [],
    [simulationData]
  );

  // State for managing content (scenarios only)
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

  // Switch field states (includes agent IDs)
  const [contentSwitchStates, setContentSwitchStates] = useState<
    Record<
      string,
      {
        hints_enabled?: boolean;
        copy_paste_allowed?: boolean;
        audio_enabled?: boolean;
        text_enabled?: boolean;
        show_problem_statement?: boolean;
        show_objectives?: boolean;
        show_image?: boolean;
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
          copy_paste_allowed?: boolean;
          audio_enabled?: boolean;
          text_enabled?: boolean;
          show_problem_statement?: boolean;
          show_objectives?: boolean;
          show_image?: boolean;
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
      if (
        deptData &&
        "scenario_ids" in deptData &&
        deptData.scenario_ids &&
        Array.isArray(deptData.scenario_ids)
      ) {
        deptData.scenario_ids.forEach((id: string) =>
          allDeptScenarioIds.add(id)
        );
      }
    });

    // Get union of scenario_ids from selected departments
    const selectedDeptScenarioIds = new Set<string>();
    selectedDeptIds.forEach((deptId) => {
      const deptData = departmentMapping[deptId];
      if (
        deptData &&
        "scenario_ids" in deptData &&
        deptData.scenario_ids &&
        Array.isArray(deptData.scenario_ids)
      ) {
        deptData.scenario_ids.forEach((id: string) =>
          selectedDeptScenarioIds.add(id)
        );
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
      if (
        deptData &&
        "rubric_ids" in deptData &&
        deptData.rubric_ids &&
        Array.isArray(deptData.rubric_ids)
      ) {
        deptData.rubric_ids.forEach((id: string) => allDeptRubricIds.add(id));
      }
    });

    // Get union of rubric_ids from selected departments
    const selectedDeptRubricIds = new Set<string>();
    selectedDeptIds.forEach((deptId) => {
      const deptData = departmentMapping[deptId];
      if (
        deptData &&
        "rubric_ids" in deptData &&
        deptData.rubric_ids &&
        Array.isArray(deptData.rubric_ids)
      ) {
        deptData.rubric_ids.forEach((id: string) =>
          selectedDeptRubricIds.add(id)
        );
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
        hint_agent_id: (simulationData as { hint_agent_id?: string })?.hint_agent_id || null,
        grade_text_agent_id: (simulationData as { grade_text_agent_id?: string })?.grade_text_agent_id || null,
        grade_voice_agent_id: (simulationData as { grade_voice_agent_id?: string | null })?.grade_voice_agent_id || null,
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
      simulationData.scenarios.forEach((scenario) => {
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
          copy_paste_allowed:
            switchState?.copy_paste_allowed ??
            ("copy_paste_allowed" in scenario
              ? scenario.copy_paste_allowed
              : false) ??
            false,
          audio_enabled:
            switchState?.audio_enabled ??
            ("audio_enabled" in scenario ? scenario.audio_enabled : false) ??
            false,
          text_enabled:
            switchState?.text_enabled ??
            ("text_enabled" in scenario ? scenario.text_enabled : true) ??
            true,
          show_problem_statement:
            switchState?.show_problem_statement ??
            ("show_problem_statement" in scenario
              ? scenario.show_problem_statement
              : true) ??
            true,
          show_objectives:
            switchState?.show_objectives ??
            ("show_objectives" in scenario
              ? scenario.show_objectives
              : "objectives_enabled" in scenario
                ? scenario.objectives_enabled
                : true) ??
            true,
          show_image:
            switchState?.show_image ??
            ("show_image" in scenario
              ? scenario.show_image
              : "image_input_enabled" in scenario
                ? scenario.image_input_enabled
                : true) ??
            true,
          rubric_id: switchState?.rubric_id ?? scenario.rubric_id ?? null,
          time_limit_seconds:
            switchState?.time_limit_seconds ??
            scenario.time_limit_seconds ??
            null,
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
          image_input_enabled?: boolean;
          copy_paste_allowed?: boolean;
          audio_enabled?: boolean;
          text_enabled?: boolean;
          show_problem_statement?: boolean;
          show_objectives?: boolean;
          show_image?: boolean;
          rubric_id?: string | null;
          time_limit_seconds?: number | null;
        }
      > = {};
      const newOriginalSwitchStates: Record<
        string,
        {
          hints_enabled?: boolean;
          objectives_enabled?: boolean;
          image_input_enabled?: boolean;
          copy_paste_allowed?: boolean;
          audio_enabled?: boolean;
          text_enabled?: boolean;
          show_problem_statement?: boolean;
          show_objectives?: boolean;
          show_image?: boolean;
          rubric_id?: string | null;
          time_limit_seconds?: number | null;
        }
      > = {};

      // Initialize active states and switch states from scenarios
      if (simulationData.scenarios) {
        simulationData.scenarios.forEach((scenario) => {
          const key = `scenario:${scenario.scenario_id}`;
          newActiveStates[key] = scenario.active;
          newOriginalActiveStates[key] = scenario.active;
          newSwitchStates[key] = {
            hints_enabled: scenario.hints_enabled ?? false,
            copy_paste_allowed:
              ("copy_paste_allowed" in scenario
                ? scenario.copy_paste_allowed
                : false) ?? false,
            audio_enabled:
              ("audio_enabled" in scenario ? scenario.audio_enabled : false) ??
              false,
            text_enabled:
              ("text_enabled" in scenario ? scenario.text_enabled : true) ??
              true,
            show_problem_statement:
              ("show_problem_statement" in scenario
                ? scenario.show_problem_statement
                : true) ?? true,
            show_objectives:
              ("show_objectives" in scenario
                ? scenario.show_objectives
                : "objectives_enabled" in scenario
                  ? scenario.objectives_enabled
                  : true) ?? true,
            show_image:
              ("show_image" in scenario
                ? scenario.show_image
                : "image_input_enabled" in scenario
                  ? scenario.image_input_enabled
                  : true) ?? true,
            rubric_id: scenario.rubric_id ?? null,
            time_limit_seconds: scenario.time_limit_seconds ?? null,
          };
          newOriginalSwitchStates[key] = {
            hints_enabled: scenario.hints_enabled ?? false,
            copy_paste_allowed:
              ("copy_paste_allowed" in scenario
                ? scenario.copy_paste_allowed
                : false) ?? false,
            audio_enabled:
              ("audio_enabled" in scenario ? scenario.audio_enabled : false) ??
              false,
            text_enabled:
              ("text_enabled" in scenario ? scenario.text_enabled : true) ??
              true,
            show_problem_statement:
              ("show_problem_statement" in scenario
                ? scenario.show_problem_statement
                : true) ?? true,
            show_objectives:
              ("show_objectives" in scenario
                ? scenario.show_objectives
                : "objectives_enabled" in scenario
                  ? scenario.objectives_enabled
                  : true) ?? true,
            show_image:
              ("show_image" in scenario
                ? scenario.show_image
                : "image_input_enabled" in scenario
                  ? scenario.image_input_enabled
                  : true) ?? true,
            rubric_id: scenario.rubric_id ?? null,
            time_limit_seconds: scenario.time_limit_seconds ?? null,
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
        type: "scenario";
        id: string;
        active: boolean;
        hints_enabled?: boolean;
        copy_paste_allowed?: boolean;
        audio_enabled?: boolean;
        text_enabled?: boolean;
        show_problem_statement?: boolean;
        show_objectives?: boolean;
        show_image?: boolean;
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
            baseItem.copy_paste_allowed =
              switchState?.copy_paste_allowed ??
              item.copy_paste_allowed ??
              false;
            baseItem.audio_enabled =
              switchState?.audio_enabled ?? item.audio_enabled ?? false;
            baseItem.text_enabled =
              switchState?.text_enabled ?? item.text_enabled ?? true;
            baseItem.show_problem_statement =
              switchState?.show_problem_statement ??
              item.show_problem_statement ??
              true;
            baseItem.show_objectives =
              switchState?.show_objectives ?? item.show_objectives ?? true;
            baseItem.show_image =
              switchState?.show_image ?? item.show_image ?? true;
            baseItem.rubric_id =
              switchState?.rubric_id ?? item.rubric_id ?? null;
            baseItem.time_limit_seconds =
              switchState?.time_limit_seconds ??
              item.time_limit_seconds ??
              null;
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
          hint_agent_id: formData?.hint_agent_id || null,
          grade_text_agent_id: formData?.grade_text_agent_id || null,
          grade_voice_agent_id: formData?.grade_voice_agent_id || null,
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
          hint_agent_id: formData?.hint_agent_id || null,
          grade_text_agent_id: formData?.grade_text_agent_id || null,
          grade_voice_agent_id: formData?.grade_voice_agent_id || null,
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

  // Check if form has changes
  const hasChanges = useMemo(() => {
    if (!isEditMode || !formData || !originalFormData || !simulationData)
      return false;

    const current = formData;
    const original = originalFormData;

    // Get original content IDs from server data
    const originalScenarioIds = simulationData.scenario_ids || [];
    const currentScenarioIdsFromContent = currentContentItems
      .filter((item) => item.type === "scenario")
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

  const handleShowProblemStatementToggle = useCallback(
    (contentId: string, enabled: boolean) => {
      setContentSwitchStates((prev) => ({
        ...prev,
        [contentId]: {
          ...prev[contentId],
          show_problem_statement: enabled,
        },
      }));
    },
    []
  );

  const handleShowObjectivesToggle = useCallback(
    (contentId: string, enabled: boolean) => {
      setContentSwitchStates((prev) => ({
        ...prev,
        [contentId]: {
          ...prev[contentId],
          show_objectives: enabled,
        },
      }));
    },
    []
  );

  const handleShowImageToggle = useCallback(
    (contentId: string, enabled: boolean) => {
      setContentSwitchStates((prev) => ({
        ...prev,
        [contentId]: {
          ...prev[contentId],
          show_image: enabled,
        },
      }));
    },
    []
  );

  // Handler for scenario picker selection - adds scenarios directly
  const handleScenarioSelect = useCallback(
    (scenarioIds: string[]) => {
      // Find newly selected scenarios (not already in currentContentItems)
      const existingScenarioIds = new Set(
        currentContentItems
          .filter((item) => item.type === "scenario")
          .map((item) => item.id)
      );
      const newScenarioIds = scenarioIds.filter(
        (id) => !existingScenarioIds.has(id)
      );

      if (newScenarioIds.length === 0) return;

      const maxPosition = Math.max(
        ...currentContentItems.map((item) => item.position),
        0
      );
      const newItems: ContentItem[] = newScenarioIds.map((scenarioId, idx) => {
        const scenarioData = simulationData?.scenario_mapping?.[scenarioId];
        return {
          type: "scenario" as const,
          id: scenarioId,
          title: scenarioData?.name || "Unnamed Scenario",
          description: scenarioData?.description || "",
          active: true,
          position: maxPosition + idx + 1,
          usage_count: 0,
          success_rate: 0,
          last_used: null,
          can_remove: true,
          isNew: true,
        };
      });
      setStagedContentItems((prev) => [...prev, ...newItems]);
      setCurrentScenarioIds((prev) => [...prev, ...newScenarioIds]);
    },
    [currentContentItems, simulationData?.scenario_mapping]
  );

  // TODO: Add parameter badge display (requires loading from scenario_parameter_items junction)

  return (
    <div
      className="space-y-6"
      data-page={`simulation-${isEditMode ? "edit" : "new"}`}
    >
      {isReadonly && (
        <div className="bg-muted border border-border rounded-lg p-4 mb-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-muted-foreground"
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
              <h3 className="text-sm font-medium text-foreground">
                Simulation is read-only
              </h3>
              <div className="mt-2 text-sm text-muted-foreground">
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
                <GenericPicker
                  items={simulationData?.department_mapping || {}}
                  itemIds={simulationData?.valid_department_ids || []}
                  selectedIds={formData.departmentIds || []}
                  onSelect={(ids) => handleInputChange("departmentIds", ids)}
                  getId={(dept) => (dept as unknown as { id: string }).id}
                  getLabel={(dept) => dept.name || ""}
                  getSearchText={(dept) =>
                    `${dept.name} ${dept.description || ""}`
                  }
                  placeholder="All Departments"
                  disabled={isReadonly}
                  multiSelect={true}
                  hideSelectedChips={true}
                  buttonClassName="w-full"
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

        {/* Agent Selection */}
        {validAgentIds.length > 0 && (
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {/* Hint Agent Selection */}
            <div className="space-y-2">
              <Label htmlFor="hint_agent_id">Hint Agent</Label>
              {formData?.hint_agent_id !== undefined ? (
                <GenericPicker
                  items={agentMapping}
                  itemIds={validAgentIds.filter((id) => {
                    const agent = agentMapping[id];
                    return agent?.roles?.includes("hint");
                  })}
                  selectedIds={formData.hint_agent_id ? [formData.hint_agent_id] : []}
                  onSelect={(ids) => handleInputChange("hint_agent_id", ids[0] || null)}
                  getId={(item) => (item as unknown as { id: string }).id}
                  getLabel={(item) => item.name || ""}
                  getSearchText={(item) =>
                    `${item.name} ${item.description || ""}`
                  }
                  renderPreview={(item) => (
                    <div className="grid gap-2">
                      <h4 className="font-medium leading-none">
                        {item.name || "No agent selected"}
                      </h4>
                      <div className="text-sm text-muted-foreground">
                        {item.description || "No description available"}
                      </div>
                    </div>
                  )}
                  renderItem={(item, _isSelected) => (
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className="flex-1 min-w-0">
                          <div className="truncate">{item.name}</div>
                          {item.description && (
                            <div className="text-xs text-muted-foreground mt-1 truncate group-data-[selected=true]:text-primary-foreground group-data-[highlighted=true]:text-primary-foreground">
                              {item.description}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                  placeholder="Select hint agent"
                  disabled={isReadonly}
                  multiSelect={false}
                  hideSelectedChips={true}
                  buttonClassName="w-full"
                  groupHeading="Agents"
                />
              ) : null}
            </div>

            {/* Grade Text Agent Selection */}
            <div className="space-y-2">
              <Label htmlFor="grade_text_agent_id">Grade Text Agent</Label>
              {formData?.grade_text_agent_id !== undefined ? (
                <GenericPicker
                  items={agentMapping}
                  itemIds={validAgentIds.filter((id) => {
                    const agent = agentMapping[id];
                    return agent?.roles?.includes("grade") || agent?.roles?.includes("grade-text");
                  })}
                  selectedIds={formData.grade_text_agent_id ? [formData.grade_text_agent_id] : []}
                  onSelect={(ids) => handleInputChange("grade_text_agent_id", ids[0] || null)}
                  getId={(item) => (item as unknown as { id: string }).id}
                  getLabel={(item) => item.name || ""}
                  getSearchText={(item) =>
                    `${item.name} ${item.description || ""}`
                  }
                  renderPreview={(item) => (
                    <div className="grid gap-2">
                      <h4 className="font-medium leading-none">
                        {item.name || "No agent selected"}
                      </h4>
                      <div className="text-sm text-muted-foreground">
                        {item.description || "No description available"}
                      </div>
                    </div>
                  )}
                  renderItem={(item, _isSelected) => (
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className="flex-1 min-w-0">
                          <div className="truncate">{item.name}</div>
                          {item.description && (
                            <div className="text-xs text-muted-foreground mt-1 truncate group-data-[selected=true]:text-primary-foreground group-data-[highlighted=true]:text-primary-foreground">
                              {item.description}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                  placeholder="Select grade text agent"
                  disabled={isReadonly}
                  multiSelect={false}
                  hideSelectedChips={true}
                  buttonClassName="w-full"
                  groupHeading="Agents"
                />
              ) : null}
            </div>

            {/* Grade Voice Agent Selection */}
            <div className="space-y-2">
              <Label htmlFor="grade_voice_agent_id">Grade Voice Agent</Label>
              {formData?.grade_voice_agent_id !== undefined ? (
                <GenericPicker
                  items={agentMapping}
                  itemIds={validAgentIds.filter((id) => {
                    const agent = agentMapping[id];
                    return agent?.roles?.includes("grade") || agent?.roles?.includes("grade-voice");
                  })}
                  selectedIds={formData.grade_voice_agent_id ? [formData.grade_voice_agent_id] : []}
                  onSelect={(ids) => handleInputChange("grade_voice_agent_id", ids[0] || null)}
                  getId={(item) => (item as unknown as { id: string }).id}
                  getLabel={(item) => item.name || ""}
                  getSearchText={(item) =>
                    `${item.name} ${item.description || ""}`
                  }
                  renderPreview={(item) => (
                    <div className="grid gap-2">
                      <h4 className="font-medium leading-none">
                        {item.name || "No agent selected"}
                      </h4>
                      <div className="text-sm text-muted-foreground">
                        {item.description || "No description available"}
                      </div>
                    </div>
                  )}
                  renderItem={(item, _isSelected) => (
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className="flex-1 min-w-0">
                          <div className="truncate">{item.name}</div>
                          {item.description && (
                            <div className="text-xs text-muted-foreground mt-1 truncate group-data-[selected=true]:text-primary-foreground group-data-[highlighted=true]:text-primary-foreground">
                              {item.description}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                  placeholder="Select grade voice agent"
                  disabled={isReadonly}
                  multiSelect={false}
                  hideSelectedChips={true}
                  buttonClassName="w-full"
                  groupHeading="Agents"
                />
              ) : null}
            </div>
          </div>
        )}

        {/* Content (Scenarios & Videos) */}
        <div className="space-y-6">
          {/* Central Content Table - Shared Attributes */}
          <div className="space-y-2">
            <div>
              <Label htmlFor="content">Content</Label>
              <p className="text-sm text-muted-foreground">
                Manage position, usage, and shared settings for all content
              </p>
            </div>

            <SimulationContentTable
              data={currentContentItems}
              onActiveToggle={handleContentActiveToggle}
              onMoveUp={handleContentMoveUp}
              onMoveDown={handleContentMoveDown}
              onRemove={handleContentRemove}
              onEditScenario={editScenario}
              onShowProblemStatementToggle={handleShowProblemStatementToggle}
              onShowObjectivesToggle={handleShowObjectivesToggle}
              onShowImageToggle={handleShowImageToggle}
              readonly={isReadonly}
            />
          </div>

          {/* Scenarios Table - Scenario-Specific Attributes */}
          <div className="space-y-2">
            <SimulationScenariosTable
              data={currentContentItems}
              onHintsToggle={handleHintsToggle}
              onCopyPasteToggle={handleCopyPasteToggle}
              onAudioToggle={handleAudioToggle}
              onTextToggle={handleTextToggle}
              onRubricChange={handleRubricChange}
              onTimeLimitChange={handleTimeLimitChange}
              rubricMapping={simulationData?.rubric_mapping || {}}
              validRubricIds={validRubricIds}
              agentMapping={agentMapping}
              validAgentIds={validAgentIds}
              scenarioMapping={simulationData?.scenario_mapping || {}}
              validScenarioIds={validScenarioIds}
              selectedScenarioIds={currentScenarioIds}
              onScenarioSelect={handleScenarioSelect}
              readonly={isReadonly}
            />
          </div>

        </div>

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
