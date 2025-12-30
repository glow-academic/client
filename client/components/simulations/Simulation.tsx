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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
// RubricPicker is now used in SimulationContentTable, not here
import { Textarea } from "@/components/ui/textarea";

import { GenericPicker } from "@/components/common/forms/GenericPicker";
import { ScenarioCardGrid } from "@/components/common/simulations/ScenarioCardGrid";
import type { ContentItem } from "@/components/common/simulations/SimulationContentTable";
import { SimulationScenarioSection } from "@/components/common/simulations/SimulationScenarioSection";
import { Switch } from "@/components/ui/switch";
import { Accordion } from "@/components/ui/accordion";
import { useBreadcrumbContext } from "@/contexts/breadcrumb-context";
import { useProfile } from "@/contexts/profile-context";
import { cn } from "@/lib/utils";
import {
  getDefaultDepartmentIds,
  transformDepartmentIdsForSubmit,
} from "@/utils/department-picker-helpers";
import { Check, GraduationCap, Loader2, Power } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

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
    input: CreateSimulationIn,
  ) => Promise<CreateSimulationOut>;
  updateSimulationAction?: (
    input: UpdateSimulationIn,
  ) => Promise<UpdateSimulationOut>;
}

interface RubricGradeAgent {
  rubric_id: string;
  grade_text_agent_id: string;
  grade_voice_agent_id?: string | null;
}

interface FormData {
  title?: string;
  description?: string;
  cohortIds?: string[];
  active?: boolean;
  practiceSimulation?: boolean;
  departmentIds?: string[] | null;
  hint_agent_id?: string | null;
  simulation_text_agent_id?: string | null;
  simulation_voice_agent_id?: string | null;
}

interface FormErrors {
  title?: string;
  cohortIds?: string[];
  departmentIds?: string[];
}

type StepStatus = "pending" | "active" | "completed";

interface Step {
  id: string;
  title: string;
  description: string;
  status: StepStatus;
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
    null,
  );
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const isEditMode = !!simulationId;

  // Helper function to update URL with query parameters
  const updateUrlParams = useCallback(
    (updates: Record<string, string | string[] | null>) => {
      const params = new URLSearchParams(searchParams.toString());

      Object.entries(updates).forEach(([key, value]) => {
        if (value === null || (Array.isArray(value) && value.length === 0)) {
          params.delete(key);
        } else if (Array.isArray(value)) {
          // Use comma-separated values to match how page.tsx reads them
          params.set(key, value.join(","));
        } else {
          params.set(key, value);
        }
      });

      const newParamsString = params.toString();
      router.replace(`${pathname}?${newParamsString}`, { scroll: false });
    },
    [searchParams, pathname, router],
  );

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
        effectiveProfile?.primaryDepartmentId ?? null,
      ),
    [isSuperadmin, effectiveProfile?.primaryDepartmentId],
  );

  const initialFormData: FormData = useMemo(
    () => ({
      title: "New Simulation",
      description: "",
      cohortIds: [],
      active: true,
      practiceSimulation: false,
      departmentIds: defaultDepartmentIds,
    }),
    [defaultDepartmentIds],
  );

  const [formData, setFormData] = useState<FormData>();
  const [originalFormData, setOriginalFormData] = useState<FormData>();
  const [errors, setErrors] = useState<FormErrors>({});

  // Readonly logic using server-provided can_edit flag
  const isReadonly = useMemo(() => {
    if (!isEditMode || !simulationData) return false;
    return !simulationData.can_edit;
  }, [isEditMode, simulationData]);

  // Extract department mapping - create dict from array (composite types)
  const departmentMapping = useMemo(() => {
    const departments = simulationData?.departments || [];
    return departments.reduce((acc, dept) => {
      acc[String(dept.department_id)] = {
        name: dept.name || "",
        description: dept.description || "",
        scenario_ids: dept.scenario_ids?.map(String) || null,
        rubric_ids: dept.rubric_ids?.map(String) || null,
        cohort_ids: dept.cohort_ids?.map(String) || null,
      };
      return acc;
    }, {} as Record<string, { name: string; description: string; scenario_ids: string[] | null; rubric_ids: string[] | null; cohort_ids: string[] | null }>);
  }, [simulationData?.departments]);
  // Extract agent mapping - create dict from array (composite types)
  // Map to the expected type format: Record<string, { name: string; description: string; roles?: string[] }>
  // Always include selected agents even if they're not in the API response (for backward compatibility)
  const agentMapping = useMemo(() => {
    const mapped: Record<
      string,
      { name: string; description: string; roles?: string[] }
    > = {};

    // Add agents from API response (arrays now)
    const agents = (isEditMode && simulationDetail && "agents" in simulationDetail
      ? simulationDetail.agents
      : simulationData?.agents) || [];
    
    agents.forEach((agent) => {
      const key = String(agent.agent_id);
      mapped[key] =
        agent.roles && agent.roles.length > 0
          ? {
              name: agent.name || "",
              description: agent.description || "",
              roles: agent.roles.map(String),
            }
          : { name: agent.name || "", description: agent.description || "" };
    });

    // Add selected agents that aren't in the mapping (for backward compatibility)
    // This ensures GenericPicker can display selected agents even if they're not in valid_agent_ids
    if (
      formData?.simulation_text_agent_id &&
      !mapped[formData.simulation_text_agent_id]
    ) {
      mapped[formData.simulation_text_agent_id] = {
        name: `Agent ${formData.simulation_text_agent_id.slice(0, 8)}...`,
        description: "Selected simulation text agent",
        roles: [],
      };
    }
    if (
      formData?.simulation_voice_agent_id &&
      !mapped[formData.simulation_voice_agent_id]
    ) {
      mapped[formData.simulation_voice_agent_id] = {
        name: `Agent ${formData.simulation_voice_agent_id.slice(0, 8)}...`,
        description: "Selected simulation voice agent",
        roles: [],
      };
    }
    if (formData?.hint_agent_id && !mapped[formData.hint_agent_id]) {
      mapped[formData.hint_agent_id] = {
        name: `Agent ${formData.hint_agent_id.slice(0, 8)}...`,
        description: "Selected hint agent",
        roles: [],
      };
    }
    if (
      formData?.grade_text_agent_id &&
      !mapped[formData.grade_text_agent_id]
    ) {
      mapped[formData.grade_text_agent_id] = {
        name: `Agent ${formData.grade_text_agent_id.slice(0, 8)}...`,
        description: "Selected grade text agent",
        roles: [],
      };
    }
    if (
      formData?.grade_voice_agent_id &&
      !mapped[formData.grade_voice_agent_id]
    ) {
      mapped[formData.grade_voice_agent_id] = {
        name: `Agent ${formData.grade_voice_agent_id.slice(0, 8)}...`,
        description: "Selected grade voice agent",
        roles: [],
      };
    }

    return mapped;
  }, [
    isEditMode,
    simulationDetail,
    simulationData?.agents,
    formData?.simulation_text_agent_id,
    formData?.simulation_voice_agent_id,
    formData?.hint_agent_id,
    formData?.grade_text_agent_id,
    formData?.grade_voice_agent_id,
  ]);
  
  // Extract scenario mapping - create dict from scenarios_full array (composite types)
  const scenarioMapping = useMemo(() => {
    const scenariosFull = (isEditMode && simulationDetail && "scenarios_full" in simulationDetail
      ? simulationDetail.scenarios_full
      : simulationData?.scenarios_full) || [];
    
    return scenariosFull.reduce((acc, scenario) => {
      acc[String(scenario.scenario_id)] = {
        name: scenario.name || "",
        description: scenario.description || "",
        persona_ids: scenario.persona_ids?.map(String) || [],
        persona_mapping: scenario.persona_mapping || [],
        document_mapping: scenario.document_mapping || [],
        parameter_item_mapping: scenario.parameter_item_mapping || [],
        parameter_item_ids: scenario.parameter_item_ids?.map(String) || [],
        document_ids: scenario.document_ids?.map(String) || [],
      };
      return acc;
    }, {} as Record<string, {
      name: string;
      description: string;
      persona_ids: string[];
      persona_mapping: Array<{ persona_id: string | { toString(): string }; name?: string | null; description?: string | null; color?: string | null; icon?: string | null; image_model?: boolean | null }>;
      document_mapping: Array<{ document_id: string | { toString(): string }; name?: string | null; description?: string | null }>;
      parameter_item_mapping: Array<{ field_id: string | { toString(): string }; name?: string | null; description?: string | null; parameter_id?: string | { toString(): string } | null; parameter_name?: string | null }>;
      parameter_item_ids: string[];
      document_ids: string[];
    }>);
  }, [isEditMode, simulationDetail, simulationData?.scenarios_full]);
  
  const validAgentIds = useMemo(
    () =>
      (simulationData as { valid_agent_ids?: string[] })?.valid_agent_ids || [],
    [simulationData],
  );

  // State for managing content (scenarios only)
  const [stagedContentItems, setStagedContentItems] = useState<ContentItem[]>(
    [],
  ); // New items not yet saved
  const [contentActiveStates, setContentActiveStates] = useState<
    Record<string, boolean>
  >({});
  const [originalContentActiveStates, setOriginalContentActiveStates] =
    useState<Record<string, boolean>>({});

  // State for accordion (only one section open at a time)
  const [openAccordionItem, setOpenAccordionItem] = useState<string | null>(
    null,
  );

  // Switch field states (includes agent IDs)
  const [contentSwitchStates, setContentSwitchStates] = useState<
    Record<
      string,
      {
        hints_enabled?: boolean;
        copy_paste_allowed?: boolean;
        audio_enabled?: boolean;
        text_enabled?: boolean;
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
          allDeptScenarioIds.add(id),
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
          selectedDeptScenarioIds.add(id),
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
  // Compute content items directly (DHH-style: inline, no memo chains)
  // Must be computed before useMemos that depend on it
  // Use searchParams to determine ordering (like Scenario.tsx) - guarantees consistent ordering
  const contentItems = useMemo(() => {
    const items: ContentItem[] = [];
    const itemsMap = new Map<string, ContentItem>();

    // Get ordered scenario IDs from searchParams (source of truth for ordering)
    // Prioritize URL params if they exist, otherwise derive order from simulationData.scenarios (ordered by position)
    const scenarioIdsFromUrl =
      searchParams.get("scenarioIds")?.split(",").filter(Boolean) || [];
    const orderedScenarioIdsFromUrl =
      scenarioIdsFromUrl.length > 0
        ? scenarioIdsFromUrl // Use URL params if available (source of truth)
        : isEditMode
          ? simulationData?.scenarios
              ?.filter((s) => currentScenarioIds.includes(s.scenario_id))
              .sort((a, b) => a.position - b.position)
              .map((s) => s.scenario_id) || currentScenarioIds
          : currentScenarioIds;

    // Track which scenario IDs are in server data
    const serverScenarioIds = new Set(
      simulationData?.scenarios?.map((s) => s.scenario_id) || [],
    );

    // Add scenarios from server data (only those in currentScenarioIds)
    if (simulationData?.scenarios && orderedScenarioIdsFromUrl.length > 0) {
      const currentScenarioIdsSet = new Set(orderedScenarioIdsFromUrl);
      simulationData.scenarios
        .filter((scenario) => currentScenarioIdsSet.has(scenario.scenario_id))
        .forEach((scenario) => {
          const key = `scenario:${scenario.scenario_id}`;
          const switchState = contentSwitchStates[key];
          const item: ContentItem = {
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
            rubric_id: switchState?.rubric_id ?? scenario.rubric_id ?? null,
            time_limit_seconds:
              switchState?.time_limit_seconds ??
              scenario.time_limit_seconds ??
              null,
            has_active_video:
              ("has_active_video" in scenario
                ? scenario.has_active_video
                : false) ?? false,
          };
          itemsMap.set(scenario.scenario_id, item);
        });
    }

    // Add staged items (newly added, not yet saved)
    stagedContentItems.forEach((item) => {
      const key = `${item.type}:${item.id}`;
      itemsMap.set(item.id, {
        ...item,
        active: contentActiveStates[key] ?? item.active,
      });
    });

    // Add scenarios from URL params that aren't in server data (NEW scenarios)
    orderedScenarioIdsFromUrl.forEach((scenarioId) => {
      if (!itemsMap.has(scenarioId) && !serverScenarioIds.has(scenarioId)) {
        // This scenario is in URL params but not in server data - it's NEW
        const scenarioData = scenarioMapping[scenarioId];
        const maxPosition = Math.max(
          ...Array.from(itemsMap.values()).map((item) => item.position),
          0,
        );
        const item: ContentItem = {
          type: "scenario",
          id: scenarioId,
          title: scenarioData?.name || "Unnamed Scenario",
          description: scenarioData?.description || "",
          active: contentActiveStates[`scenario:${scenarioId}`] ?? true,
          position: maxPosition + 1,
          usage_count: 0,
          success_rate: 0,
          last_used: null,
          can_remove: true,
          isNew: true,
          hints_enabled:
            contentSwitchStates[`scenario:${scenarioId}`]?.hints_enabled ??
            false,
          copy_paste_allowed:
            contentSwitchStates[`scenario:${scenarioId}`]?.copy_paste_allowed ??
            false,
          audio_enabled:
            contentSwitchStates[`scenario:${scenarioId}`]?.audio_enabled ??
            false,
          text_enabled:
            contentSwitchStates[`scenario:${scenarioId}`]?.text_enabled ?? true,
          rubric_id:
            contentSwitchStates[`scenario:${scenarioId}`]?.rubric_id ?? null,
          time_limit_seconds:
            contentSwitchStates[`scenario:${scenarioId}`]?.time_limit_seconds ??
            null,
          has_active_video: false,
        };
        itemsMap.set(scenarioId, item);
      }
    });

    // Build ordered list based on searchParams order (or currentScenarioIds in edit mode)
    orderedScenarioIdsFromUrl.forEach((scenarioId, index) => {
      const item = itemsMap.get(scenarioId);
      if (item) {
        items.push({
          ...item,
          position: index + 1, // Update position based on URL order
        });
      }
    });

    // Add any items not in the ordered list (shouldn't happen, but safety check)
    itemsMap.forEach((item, id) => {
      if (!orderedScenarioIdsFromUrl.includes(id)) {
        items.push(item);
      }
    });

    return items;
  }, [
    isEditMode,
    currentScenarioIds,
    searchParams,
    simulationData?.scenarios,
    scenarioMapping,
    contentSwitchStates,
    contentActiveStates,
    stagedContentItems,
  ]);

  const validRubricIds = useMemo(() => {
    const baseIds = simulationData?.valid_rubric_ids || [];
    const selectedDeptIds = formData?.departmentIds || [];

    // Always include currently selected rubrics from content items (for edit mode - ensures selected items are visible)
    const selectedRubricIdSet = new Set<string>();
    contentItems.forEach((item) => {
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
          selectedDeptRubricIds.add(id),
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
    contentItems,
    departmentMapping,
  ]);

  // Extract rubric mapping - create dict from rubrics array (composite types)
  // Always include selected rubrics (for backward compatibility)
  // This ensures GenericPicker can display selected rubrics even if they're not in valid_rubric_ids
  // MUST be defined after contentItems since it depends on it
  const rubricMapping = useMemo(() => {
    const rubrics = (isEditMode && simulationDetail && "rubrics" in simulationDetail
      ? simulationDetail.rubrics
      : simulationData?.rubrics) || [];
    
    const mapped: Record<
      string,
      { id: string; name: string; description?: string }
    > = {};

    // Map rubrics array to dict
    rubrics.forEach((rubric) => {
      const id = String(rubric.rubric_id);
      mapped[id] = {
        id,
        name: rubric.name || "",
        description: rubric.description || "",
      };
    });

    // Add selected rubrics from content items that aren't in the mapping
    contentItems.forEach((item) => {
      if (
        item.type === "scenario" &&
        item.rubric_id &&
        !mapped[item.rubric_id]
      ) {
        mapped[item.rubric_id] = {
          id: item.rubric_id,
          name: `Rubric ${item.rubric_id.slice(0, 8)}...`,
          description: "Selected rubric",
        };
      }
    });

    return mapped;
  }, [
    isEditMode,
    simulationDetail,
    simulationData?.rubrics,
    contentItems,
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

  // Track if we've initialized to prevent resetting on searchParams changes
  const hasInitializedRef = useRef(false);
  // Track if we've set the initial accordion state to prevent reopening when user closes it
  const hasSetInitialAccordionRef = useRef(false);

  useEffect(() => {
    if (simulationData && isEditMode) {
      // Only initialize once in edit mode
      if (!hasInitializedRef.current) {
        const deptIds = simulationData.department_ids || [];
        const formDataFromServer = {
          title: simulationData.name,
          description: simulationData.description,
          active: simulationData.active,
          practiceSimulation: simulationData.practice_simulation ?? false,
          departmentIds: deptIds,
          hint_agent_id: isEditMode
            ? simulationDetail?.hint_agent_id || null
            : null,
          simulation_text_agent_id: isEditMode
            ? simulationDetail?.simulation_text_agent_id || null
            : null,
          simulation_voice_agent_id: isEditMode
            ? simulationDetail?.simulation_voice_agent_id || null
            : null,
        };
        setFormData(formDataFromServer);
        setOriginalFormData(formDataFromServer);
        // Prioritize URL params if they exist, otherwise use server data (already ordered by position)
        const scenarioIdsFromUrl =
          searchParams.get("scenarioIds")?.split(",").filter(Boolean) || [];
        const initialScenarioIds =
          scenarioIdsFromUrl.length > 0
            ? scenarioIdsFromUrl
            : simulationData.scenario_ids;
        setCurrentScenarioIds(initialScenarioIds);
        // Initialize previousDepartmentIds when loading simulation data
        setPreviousDepartmentIds((prev) =>
          prev.length === 0 ? deptIds : prev,
        );
        hasInitializedRef.current = true;
      }
    } else if (!isEditMode && simulationData) {
      // Only initialize once in create mode, and only if currentScenarioIds is empty
      if (!hasInitializedRef.current || currentScenarioIds.length === 0) {
        setFormData(initialFormData);
        setOriginalFormData(initialFormData);

        // Initialize scenario IDs from URL params in create mode (only if not already set)
        const scenarioIdsFromUrl =
          searchParams.get("scenarioIds")?.split(",").filter(Boolean) || [];
        if (scenarioIdsFromUrl.length > 0 && currentScenarioIds.length === 0) {
          setCurrentScenarioIds(scenarioIdsFromUrl);
        }
        if (!hasInitializedRef.current) {
          hasInitializedRef.current = true;
        }
      }
    }
  }, [
    simulationData,
    isEditMode,
    initialFormData,
    simulationDetail,
    currentScenarioIds.length,
    searchParams,
    // Note: searchParams is included but effect uses hasInitializedRef to prevent loops
  ]);

  const handleInputChange = (
    field: keyof FormData,
    value: string | number | boolean | string[] | null,
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
    [],
  );

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

  // Set first accordion item as open by default when contentItems are available (only once)
  useEffect(() => {
    if (!hasSetInitialAccordionRef.current && contentItems.length > 0) {
      const firstScenarioItem = contentItems.find(
        (item) => item.type === "scenario",
      );
      if (firstScenarioItem) {
        setOpenAccordionItem(
          `${firstScenarioItem.type}:${firstScenarioItem.id}`,
        );
        hasSetInitialAccordionRef.current = true;
      }
    }
  }, [contentItems]);

  // Auto-select agents when there's only one option available (similar to Scenario.tsx)
  useEffect(() => {
    if (!simulationData || !agentMapping) return;

    const hintAgentIds =
      validAgentIds.filter((id) => {
        const agent = agentMapping[id];
        return agent?.roles?.includes("hint");
      }) || [];

    const gradeTextAgentIds =
      validAgentIds.filter((id) => {
        const agent = agentMapping[id];
        return (
          agent?.roles?.includes("grade") ||
          agent?.roles?.includes("grade-text")
        );
      }) || [];

    const gradeVoiceAgentIds =
      validAgentIds.filter((id) => {
        const agent = agentMapping[id];
        return (
          agent?.roles?.includes("grade") ||
          agent?.roles?.includes("grade-voice")
        );
      }) || [];

    const simulationTextAgentIds =
      validAgentIds.filter((id) => {
        const agent = agentMapping[id];
        return agent?.roles?.includes("simulation-text");
      }) || [];

    const simulationVoiceAgentIds =
      validAgentIds.filter((id) => {
        const agent = agentMapping[id];
        return agent?.roles?.includes("simulation-voice");
      }) || [];

    // Auto-select first hint agent if only one option and not already set
    if (
      hintAgentIds.length === 1 &&
      (!formData?.hint_agent_id || formData.hint_agent_id === null)
    ) {
      setFormData((prev) => ({
        ...prev,
        hint_agent_id: hintAgentIds[0] || null,
      }));
    }


    // Auto-select first simulation text agent if only one option and not already set
    if (
      simulationTextAgentIds.length === 1 &&
      (!formData?.simulation_text_agent_id ||
        formData.simulation_text_agent_id === null)
    ) {
      setFormData((prev) => ({
        ...prev,
        simulation_text_agent_id: simulationTextAgentIds[0] || null,
      }));
    }

    // Auto-select first simulation voice agent if only one option and not already set
    if (
      simulationVoiceAgentIds.length === 1 &&
      (!formData?.simulation_voice_agent_id ||
        formData.simulation_voice_agent_id === null)
    ) {
      setFormData((prev) => ({
        ...prev,
        simulation_voice_agent_id: simulationVoiceAgentIds[0] || null,
      }));
    }
  }, [
    simulationData,
    agentMapping,
    validAgentIds,
    formData?.hint_agent_id,
    formData?.grade_text_agent_id,
    formData?.grade_voice_agent_id,
    formData?.simulation_text_agent_id,
    formData?.simulation_voice_agent_id,
  ]);

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
      (id) => !currentDeptIds.includes(id),
    );

    // Find departments that were newly selected
    const newlySelectedDepts = currentDeptIds.filter(
      (id) => !prevDeptIds.includes(id),
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
                validScenarioSet.has(id),
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
  // Use ref to track previous validScenarioIds to prevent loops
  const prevValidScenarioIdsRef = useRef<string[]>([]);
  useEffect(() => {
    // Only run if validScenarioIds actually changed (not just currentScenarioIds)
    const validScenarioIdsChanged =
      prevValidScenarioIdsRef.current.length !== validScenarioIds.length ||
      !prevValidScenarioIdsRef.current.every(
        (id, idx) => id === validScenarioIds[idx],
      );

    if (!validScenarioIdsChanged) {
      return;
    }

    // Clear scenarios that are no longer valid
    if (currentScenarioIds.length > 0) {
      const validSet = new Set(validScenarioIds);
      const filtered = currentScenarioIds.filter((id) => validSet.has(id));
      if (filtered.length !== currentScenarioIds.length) {
        setCurrentScenarioIds(filtered);
        // Also update URL params to keep them in sync
        updateUrlParams({
          scenarioIds: filtered.length > 0 ? filtered : null,
        });
      }
    }

    // Update ref to track current validScenarioIds
    prevValidScenarioIdsRef.current = [...validScenarioIds];
  }, [currentScenarioIds, validScenarioIds, updateUrlParams]);

  // Note: rubric_id is now per-scenario, not simulation-level, so we don't clear it here

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData?.title?.trim()) {
      newErrors.title = "Title is required";
    }

    // Validate scenarios: each scenario must have at least one of text_enabled or audio_enabled
    // Also validate that if time limit is enabled, it must have a valid value
    const scenarioItems = contentItems.filter(
      (item) => item.type === "scenario",
    );
    const invalidScenarios: string[] = [];
    const invalidTimeLimitScenarios: string[] = [];
    scenarioItems.forEach((item) => {
      const key = `scenario:${item.id}`;
      const switchState = contentSwitchStates[key];
      const textEnabled =
        switchState?.text_enabled ?? item.text_enabled ?? true;
      const audioEnabled =
        switchState?.audio_enabled ?? item.audio_enabled ?? false;
      const timeLimitSeconds =
        switchState?.time_limit_seconds ?? item.time_limit_seconds ?? null;
      const hasTimeLimit = timeLimitSeconds !== null && timeLimitSeconds > 0;

      if (!textEnabled && !audioEnabled) {
        invalidScenarios.push(item.title || item.id);
      }

      // Check if time limit is enabled but has invalid value
      if (hasTimeLimit && (!timeLimitSeconds || timeLimitSeconds <= 0)) {
        invalidTimeLimitScenarios.push(item.title || item.id);
      }
    });

    if (invalidScenarios.length > 0) {
      toast.error(
        `Each scenario must have at least one input method enabled (text or audio). Please fix: ${invalidScenarios.join(", ")}`,
      );
      setErrors(newErrors);
      return false;
    }

    if (invalidTimeLimitScenarios.length > 0) {
      toast.error(
        `Time limit is enabled but has no value. Please enter a time limit or disable it for: ${invalidTimeLimitScenarios.join(", ")}`,
      );
      setErrors(newErrors);
      return false;
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
        validDepartmentIds,
      );

      const targetSimulationId = simulationId || editingSimulationId;

      // Convert unified content items to API format
      // Separate scenarios and videos while preserving order
      // Extract flat arrays from content items (scenarios only)
      const scenarioItems = contentItems.filter(
        (item): item is ContentItem & { type: "scenario" } =>
          item.type === "scenario",
      );

      const scenario_ids: string[] = [];
      const scenario_active_flags: boolean[] = [];
      const scenario_hints_enabled: boolean[] = [];
      const scenario_audio_enabled: boolean[] = [];
      const scenario_text_enabled: boolean[] = [];
      const scenario_time_limit_seconds: number[] = [];
      const scenario_rubric_grade_agents: Array<{
        scenario_id: string;
        rubric_id: string;
        grade_text_agent_id: string;
        grade_voice_agent_id?: string | null;
      }> = [];

      scenarioItems.forEach((item) => {
        const key = `${item.type}:${item.id}`;
        const switchState = contentSwitchStates[key];
        const active = contentActiveStates[key] ?? item.active;

        scenario_ids.push(item.id);
        scenario_active_flags.push(active);
        scenario_hints_enabled.push(
          switchState?.hints_enabled ?? item.hints_enabled ?? false,
        );
        scenario_audio_enabled.push(
          switchState?.audio_enabled ?? item.audio_enabled ?? false,
        );
        scenario_text_enabled.push(
          switchState?.text_enabled ?? item.text_enabled ?? true,
        );
        // Convert null/undefined to 0 for time limit
        const timeLimit =
          switchState?.time_limit_seconds ?? item.time_limit_seconds ?? null;
        scenario_time_limit_seconds.push(timeLimit ?? 0);
        
        // Build rubric_grade_agents array from rubric_grade_agents on item
        // For now, use rubric_id if available (backward compatibility during migration)
        const rubricId = switchState?.rubric_id ?? item.rubric_id ?? null;
        const rubricGradeAgents = switchState?.rubric_grade_agents ?? item.rubric_grade_agents ?? [];
        
        if (rubricGradeAgents.length > 0) {
          // Use new structure
          rubricGradeAgents.forEach((rga: RubricGradeAgent) => {
            if (rga.rubric_id && rga.grade_text_agent_id) {
              scenario_rubric_grade_agents.push({
                scenario_id: item.id,
                rubric_id: rga.rubric_id,
                grade_text_agent_id: rga.grade_text_agent_id,
                grade_voice_agent_id: rga.grade_voice_agent_id || null,
              });
            }
          });
        } else if (rubricId && rubricId !== "00000000-0000-0000-0000-000000000000") {
          // Fallback: use rubric_id if no rubric_grade_agents (backward compatibility)
          // This will need grade_text_agent_id - for now, skip if not available
          // TODO: Add UI to select agents per rubric
        }
      });

      if (targetSimulationId) {
        // UPDATE mode - flat arrays
        const updatePayload = {
          simulation_id: targetSimulationId,
          title: formData?.title || "",
          description: formData?.description ?? "",
          department_ids: finalDepartmentIds,
          active: formData?.active ?? true,
          practice_simulation: formData?.practiceSimulation || false,
          scenario_ids,
          scenario_active_flags,
          video_ids: [] as string[], // Empty for now
          video_active_flags: [] as boolean[], // Empty for now
          scenario_hints_enabled,
          scenario_rubric_grade_agents,
          scenario_time_limit_seconds,
          scenario_audio_enabled,
          scenario_text_enabled,
          video_show_problem_statement: [] as boolean[], // Empty for now
          video_show_objectives: [] as boolean[], // Empty for now
          video_show_image: [] as boolean[], // Empty for now
          hint_agent_id: formData?.hint_agent_id || "00000000-0000-0000-0000-000000000000",
          simulation_text_agent_id: formData?.simulation_text_agent_id || "00000000-0000-0000-0000-000000000000",
          simulation_voice_agent_id:
            formData?.simulation_voice_agent_id || "00000000-0000-0000-0000-000000000000",
        };

        await handleUpdateSimulation(updatePayload);
        toast.success("Simulation updated successfully!");
      } else {
        // CREATE mode - flat arrays
        const createPayload = {
          title: formData?.title || "",
          description: formData?.description ?? "",
          department_ids: finalDepartmentIds,
          active: formData?.active || true,
          practice_simulation: formData?.practiceSimulation || false,
          scenario_ids,
          scenario_active_flags,
          scenario_hints_enabled,
          scenario_rubric_grade_agents,
          scenario_time_limit_seconds,
          scenario_audio_enabled,
          scenario_text_enabled,
          simulation_text_agent_id: formData?.simulation_text_agent_id || "00000000-0000-0000-0000-000000000000",
          simulation_voice_agent_id:
            formData?.simulation_voice_agent_id || "00000000-0000-0000-0000-000000000000",
        };

        await handleCreateSimulation(createPayload);
        toast.success("Simulation created successfully!");
      }

      resetFormAndState();
      router.push(`/create/simulations`);
    } catch (error) {
      const targetSimulationId = simulationId || editingSimulationId;
      toast.error(
        `Failed to ${targetSimulationId ? "update" : "create"} simulation: ${error instanceof Error ? error.message : "Unknown error"}`,
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
    const currentScenarioIdsFromContent = contentItems
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
    contentItems,
    simulationData,
    contentActiveStates,
    originalContentActiveStates,
    contentSwitchStates,
    originalContentSwitchStates,
  ]);

  // Step status logic
  const getStepStatus = useCallback(
    (stepId: string): StepStatus => {
      const hasTitle = !!formData?.title?.trim();
      const hasScenarios = currentScenarioIds.length > 0;
      const scenarioItems = contentItems.filter(
        (item) => item.type === "scenario",
      );

      switch (stepId) {
        case "basic":
          return hasTitle ? "completed" : "active";
        case "scenarios":
          if (!hasTitle) return "pending";
          return hasScenarios ? "completed" : "active";
        default:
          // Handle scenario-specific steps (format: "scenario-{scenarioId}")
          if (stepId.startsWith("scenario-")) {
            if (!hasScenarios) return "pending";
            const scenarioId = stepId.replace("scenario-", "");
            const scenarioIndex = scenarioItems.findIndex(
              (item) => item.id === scenarioId,
            );
            if (scenarioIndex === -1) return "pending";

            // Previous scenarios must be completed before this one is active
            const previousScenariosCompleted = scenarioItems
              .slice(0, scenarioIndex)
              .every((item) => {
                const key = `scenario:${item.id}`;
                const switchState = contentSwitchStates[key];
                const textEnabled =
                  switchState?.text_enabled ?? item.text_enabled ?? true;
                const audioEnabled =
                  switchState?.audio_enabled ?? item.audio_enabled ?? false;
                const hasRubric =
                  (switchState?.rubric_id ?? item.rubric_id) !== null;
                const timeLimitSeconds =
                  switchState?.time_limit_seconds ??
                  item.time_limit_seconds ??
                  null;
                const hasTimeLimit =
                  timeLimitSeconds !== null && timeLimitSeconds > 0;

                // Scenario is "completed" if:
                // 1. Has at least one input method enabled (text or audio)
                // 2. Has a rubric selected
                // 3. If time limit switch is on, must have a valid time limit value
                const hasValidTimeLimit =
                  !hasTimeLimit ||
                  (timeLimitSeconds !== null && timeLimitSeconds > 0);
                return (
                  (textEnabled || audioEnabled) &&
                  hasRubric &&
                  hasValidTimeLimit
                );
              });

            if (!previousScenariosCompleted) return "pending";

            // Check if current scenario is completed
            const currentScenario = scenarioItems[scenarioIndex];
            if (!currentScenario) return "pending";
            const currentKey = `scenario:${currentScenario.id}`;
            const currentSwitchState = contentSwitchStates[currentKey];
            const currentTextEnabled =
              currentSwitchState?.text_enabled ??
              currentScenario.text_enabled ??
              true;
            const currentAudioEnabled =
              currentSwitchState?.audio_enabled ??
              currentScenario.audio_enabled ??
              false;
            const currentHasRubric =
              (currentSwitchState?.rubric_id ?? currentScenario.rubric_id) !==
              null;
            const currentTimeLimitSeconds =
              currentSwitchState?.time_limit_seconds ??
              currentScenario.time_limit_seconds ??
              null;
            const currentHasTimeLimit =
              currentTimeLimitSeconds !== null && currentTimeLimitSeconds > 0;

            // Scenario is completed if:
            // 1. Has at least one input method enabled (text or audio)
            // 2. Has a rubric selected
            // 3. If time limit switch is on, must have a valid time limit value
            const hasValidTimeLimit =
              !currentHasTimeLimit ||
              (currentTimeLimitSeconds !== null && currentTimeLimitSeconds > 0);
            const isCurrentCompleted =
              (currentTextEnabled || currentAudioEnabled) &&
              currentHasRubric &&
              hasValidTimeLimit;

            return isCurrentCompleted ? "completed" : "active";
          }
          return "pending";
      }
    },
    [
      formData?.title,
      currentScenarioIds.length,
      contentItems,
      contentSwitchStates,
    ],
  );

  // Steps array - dynamically includes steps for each scenario
  const steps: Step[] = useMemo(() => {
    const baseSteps: Step[] = [
      {
        id: "basic",
        title: "Basic Information",
        description:
          "Set the simulation name, description, departments, and agents.",
        status: getStepStatus("basic"),
      },
      {
        id: "scenarios",
        title: "Scenarios",
        description: "Select scenarios to include in this simulation.",
        status: getStepStatus("scenarios"),
      },
    ];

    // Add individual scenario configuration steps
    const scenarioItems = contentItems.filter(
      (item) => item.type === "scenario",
    );
    const scenarioSteps: Step[] = scenarioItems.map((item) => ({
      id: `scenario-${item.id}`,
      title: item.title,
      description: item.description || "Configure settings for this scenario.",
      status: getStepStatus(`scenario-${item.id}`),
    }));

    return [...baseSteps, ...scenarioSteps];
  }, [getStepStatus, contentItems]);

  const handleContentActiveToggle = useCallback(
    (contentId: string, active: boolean) => {
      setContentActiveStates((prev) => ({
        ...prev,
        [contentId]: active,
      }));
    },
    [],
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
    [],
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
    [],
  );

  const handleRubricChange = useCallback(
    (contentId: string, rubricId: string | null) => {
      // Legacy handler - kept for backward compatibility but should use handleRubricGradeAgentsChange
      setContentSwitchStates((prev) => ({
        ...prev,
        [contentId]: {
          ...prev[contentId],
          rubric_id: rubricId,
        },
      }));
    },
    [],
  );

  const handleRubricGradeAgentsChange = useCallback(
    (contentId: string, rubricGradeAgents: Array<{
      rubric_id: string;
      grade_text_agent_id: string;
      grade_voice_agent_id?: string | null;
    }>) => {
      setContentSwitchStates((prev) => ({
        ...prev,
        [contentId]: {
          ...prev[contentId],
          rubric_grade_agents: rubricGradeAgents,
        },
      }));
    },
    [],
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
    [],
  );

  const handleContentMoveUp = useCallback(
    (contentId: string) => {
      const [type, id] = contentId.split(":");
      if (type !== "scenario" || !id) return;

      // Get ordered scenario IDs from searchParams (source of truth)
      const orderedIds = isEditMode
        ? [...currentScenarioIds]
        : searchParams.get("scenarioIds")?.split(",").filter(Boolean) || [
            ...currentScenarioIds,
          ];

      const index = orderedIds.indexOf(id);
      if (index <= 0) return;

      // Swap with previous item
      const reorderedIds = [...orderedIds];
      const prevId = reorderedIds[index - 1];
      const currentId = reorderedIds[index];
      if (!prevId || !currentId) return;
      [reorderedIds[index - 1], reorderedIds[index]] = [
        currentId,
        prevId,
      ];

      // Update state and URL params (URL params are source of truth)
      setCurrentScenarioIds(reorderedIds);
      updateUrlParams({
        scenarioIds: reorderedIds.length > 0 ? reorderedIds : null,
      });
    },
    [currentScenarioIds, isEditMode, searchParams, updateUrlParams],
  );

  const handleContentMoveDown = useCallback(
    (contentId: string) => {
      const [type, id] = contentId.split(":");
      if (type !== "scenario" || !id) return;

      // Get ordered scenario IDs from searchParams (source of truth)
      const orderedIds = isEditMode
        ? [...currentScenarioIds]
        : searchParams.get("scenarioIds")?.split(",").filter(Boolean) || [
            ...currentScenarioIds,
          ];

      const index = orderedIds.indexOf(id);
      if (index < 0 || index >= orderedIds.length - 1) return;

      // Swap with next item
      const reorderedIds = [...orderedIds];
      const currentId = reorderedIds[index];
      const nextId = reorderedIds[index + 1];
      if (!currentId || !nextId) return;
      [reorderedIds[index], reorderedIds[index + 1]] = [
        nextId,
        currentId,
      ];

      // Update state and URL params (URL params are source of truth)
      setCurrentScenarioIds(reorderedIds);
      updateUrlParams({
        scenarioIds: reorderedIds.length > 0 ? reorderedIds : null,
      });
    },
    [currentScenarioIds, isEditMode, searchParams, updateUrlParams],
  );

  const handleContentRemove = useCallback(
    (contentId: string) => {
      const [type, id] = contentId.split(":");
      if (type === "scenario") {
        const newScenarioIds = currentScenarioIds.filter((sid) => sid !== id);
        setCurrentScenarioIds(newScenarioIds);
        // Update URL params
        updateUrlParams({
          scenarioIds: newScenarioIds.length > 0 ? newScenarioIds : null,
        });
      }
      setStagedContentItems((prev) =>
        prev.filter((item) => `${item.type}:${item.id}` !== contentId),
      );
      setContentActiveStates((prev) => {
        const newStates = { ...prev };
        delete newStates[contentId];
        return newStates;
      });
      setContentSwitchStates((prev) => {
        const newStates = { ...prev };
        delete newStates[contentId];
        return newStates;
      });
    },
    [currentScenarioIds, updateUrlParams],
  );

  const handleAudioToggle = useCallback(
    (contentId: string, enabled: boolean) => {
      setContentSwitchStates((prev) => {
        const currentState = prev[contentId] || {};
        const currentTextEnabled = currentState.text_enabled;

        // Find the item in contentItems to get base/default state
        const item = contentItems.find(
          (i) => `${i.type}:${i.id}` === contentId,
        );
        const baseTextEnabled = item?.text_enabled ?? true;

        // Determine actual text_enabled state (switch state overrides base)
        const actualTextEnabled = currentTextEnabled ?? baseTextEnabled;

        // If disabling audio and text is also disabled, enable text
        const newTextEnabled =
          !enabled && !actualTextEnabled ? true : undefined;

        return {
          ...prev,
          [contentId]: {
            ...prev[contentId],
            audio_enabled: enabled,
            ...(newTextEnabled !== undefined && {
              text_enabled: newTextEnabled,
            }),
          },
        };
      });
    },
    [contentItems],
  );

  const handleTextToggle = useCallback(
    (contentId: string, enabled: boolean) => {
      setContentSwitchStates((prev) => {
        const currentState = prev[contentId] || {};
        const currentAudioEnabled = currentState.audio_enabled;

        // Find the item in contentItems to get base/default state
        const item = contentItems.find(
          (i) => `${i.type}:${i.id}` === contentId,
        );
        const baseAudioEnabled = item?.audio_enabled ?? false;

        // Determine actual audio_enabled state (switch state overrides base)
        const actualAudioEnabled = currentAudioEnabled ?? baseAudioEnabled;

        // If disabling text and audio is also disabled, enable audio
        const newAudioEnabled =
          !enabled && !actualAudioEnabled ? true : undefined;

        return {
          ...prev,
          [contentId]: {
            ...prev[contentId],
            text_enabled: enabled,
            ...(newAudioEnabled !== undefined && {
              audio_enabled: newAudioEnabled,
            }),
          },
        };
      });
    },
    [contentItems],
  );

  // Handler for scenario picker selection - adds scenarios directly
  const handleScenarioSelect = useCallback(
    (scenarioIds: string[]) => {
      // Update URL params with selected scenario IDs
      updateUrlParams({
        scenarioIds: scenarioIds.length > 0 ? scenarioIds : null,
      });

      // Find newly selected scenarios (not already in contentItems)
      const existingScenarioIds = new Set(
        contentItems
          .filter((item) => item.type === "scenario")
          .map((item) => item.id),
      );
      const newScenarioIds = scenarioIds.filter(
        (id) => !existingScenarioIds.has(id),
      );

      // Handle removal: remove scenarios that are no longer selected
      // Only remove scenarios that are in stagedContentItems (newly added), not server data
      const stagedScenarioIds = new Set(
        stagedContentItems
          .filter((item) => item.type === "scenario")
          .map((item) => item.id),
      );
      const removedScenarioIds = Array.from(existingScenarioIds).filter(
        (id) => !scenarioIds.includes(id) && stagedScenarioIds.has(id),
      );

      if (removedScenarioIds.length > 0) {
        // Remove from staged content items only (not server data)
        setStagedContentItems((prev) =>
          prev.filter(
            (item) =>
              !removedScenarioIds.includes(item.id) || item.type !== "scenario",
          ),
        );
        // Clean up state
        removedScenarioIds.forEach((id) => {
          const contentId = `scenario:${id}`;
          setContentActiveStates((prev) => {
            const newStates = { ...prev };
            delete newStates[contentId];
            return newStates;
          });
          setContentSwitchStates((prev) => {
            const newStates = { ...prev };
            delete newStates[contentId];
            return newStates;
          });
        });
      }

      if (newScenarioIds.length === 0) {
        // Update currentScenarioIds even if no new items (handles removals)
        setCurrentScenarioIds(scenarioIds);
        return;
      }

      const maxPosition = Math.max(
        ...contentItems.map((item) => item.position),
        0,
      );
      const newItems: ContentItem[] = newScenarioIds.map((scenarioId, idx) => {
        const scenarioData = scenarioMapping[scenarioId];
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
      setCurrentScenarioIds(scenarioIds);
    },
    [
      contentItems,
      stagedContentItems,
      scenarioMapping,
      updateUrlParams,
    ],
  );

  // TODO: Add parameter badge display (requires loading from scenario_parameter_items junction)

  return (
    <div
      className="w-full p-6 space-y-8"
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
      <form onSubmit={handleFormSubmit} className="space-y-8">
        {/* Step 1: Basic Information */}
        <Card className="transition-all">
          <CardContent className="pt-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium bg-green-500 text-white shrink-0">
                <Check className="w-4 h-4" />
              </div>
              <div className="flex-1">
                {formData?.title !== undefined ? (
                  <input
                    type="text"
                    id="title"
                    data-testid="input-simulation-title"
                    value={formData.title}
                    onChange={(e) => handleInputChange("title", e.target.value)}
                    onFocus={(e) => {
                      if (e.target.value === "New Simulation") {
                        e.target.select();
                      }
                    }}
                    onBlur={(e) => {
                      // If empty on blur, revert to default name
                      if (!e.target.value || e.target.value.trim() === "") {
                        handleInputChange("title", "New Simulation");
                      }
                    }}
                    className={cn(
                      "w-full text-2xl font-semibold border-none outline-none bg-transparent px-2 py-1 hover:bg-muted/50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:bg-muted/50 focus:ring-2 focus:ring-primary/20",
                      errors.title && "border-destructive",
                    )}
                    placeholder="New Simulation"
                    disabled={isReadonly}
                  />
                ) : null}
                <p className="text-xs text-muted-foreground mt-1 px-2">
                  Click to edit
                </p>
                {errors.title && (
                  <p className="text-sm text-destructive mt-1 px-2">
                    {errors.title}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
          <CardContent className="pt-0 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              {formData?.description !== undefined ? (
                <Textarea
                  id="description"
                  data-testid="input-simulation-description"
                  value={formData.description || ""}
                  onChange={(e) =>
                    handleInputChange("description", e.target.value)
                  }
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
                      items={departmentMapping}
                      itemIds={simulationData?.valid_department_ids || []}
                      selectedIds={formData.departmentIds || []}
                      onSelect={(ids) =>
                        handleInputChange("departmentIds", ids)
                      }
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
                      selectedIds={
                        formData.hint_agent_id ? [formData.hint_agent_id] : []
                      }
                      onSelect={(ids) =>
                        handleInputChange("hint_agent_id", ids[0] || null)
                      }
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

                {/* Grade agents are now configured per-scenario in the scenario sections */}

                {/* Simulation Text Agent Selection */}
                <div className="space-y-2">
                  <Label htmlFor="simulation_text_agent_id">
                    Simulation Text Agent
                  </Label>
                  {formData?.simulation_text_agent_id !== undefined ? (
                    <GenericPicker
                      items={agentMapping}
                      itemIds={(() => {
                        const roleFilteredIds = validAgentIds.filter((id) => {
                          const agent = agentMapping[id];
                          return agent?.roles?.includes("simulation-text");
                        });
                        // Always include selected agent ID even if it doesn't have the role
                        // (for backward compatibility with agents that may not have roles set)
                        if (
                          formData.simulation_text_agent_id &&
                          agentMapping[formData.simulation_text_agent_id] &&
                          !roleFilteredIds.includes(
                            formData.simulation_text_agent_id,
                          )
                        ) {
                          return [
                            ...roleFilteredIds,
                            formData.simulation_text_agent_id,
                          ];
                        }
                        return roleFilteredIds;
                      })()}
                      selectedIds={(() => {
                        const agentId = formData.simulation_text_agent_id;
                        const hasAgent = agentId && agentMapping[agentId];
                        return hasAgent ? [agentId] : [];
                      })()}
                      onSelect={(ids) => {
                        handleInputChange(
                          "simulation_text_agent_id",
                          ids[0] || null,
                        );
                      }}
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
                      placeholder="Select simulation text agent"
                      disabled={isReadonly}
                      multiSelect={false}
                      hideSelectedChips={true}
                      buttonClassName="w-full"
                      groupHeading="Agents"
                    />
                  ) : null}
                </div>

                {/* Simulation Voice Agent Selection */}
                <div className="space-y-2">
                  <Label htmlFor="simulation_voice_agent_id">
                    Simulation Voice Agent
                  </Label>
                  {formData?.simulation_voice_agent_id !== undefined ? (
                    <GenericPicker
                      items={agentMapping}
                      itemIds={(() => {
                        const roleFilteredIds = validAgentIds.filter((id) => {
                          const agent = agentMapping[id];
                          return agent?.roles?.includes("simulation-voice");
                        });
                        // Always include selected agent ID even if it doesn't have the role
                        // (for backward compatibility with agents that may not have roles set)
                        if (
                          formData.simulation_voice_agent_id &&
                          agentMapping[formData.simulation_voice_agent_id] &&
                          !roleFilteredIds.includes(
                            formData.simulation_voice_agent_id,
                          )
                        ) {
                          return [
                            ...roleFilteredIds,
                            formData.simulation_voice_agent_id,
                          ];
                        }
                        return roleFilteredIds;
                      })()}
                      selectedIds={(() => {
                        const agentId = formData.simulation_voice_agent_id;
                        const hasAgent = agentId && agentMapping[agentId];
                        return hasAgent ? [agentId] : [];
                      })()}
                      onSelect={(ids) => {
                        handleInputChange(
                          "simulation_voice_agent_id",
                          ids[0] || null,
                        );
                      }}
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
                      placeholder="Select simulation voice agent"
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
          </CardContent>
        </Card>

        {/* Step 2: Scenarios Selection */}
        <Card
          className={cn(
            "transition-all",
            !isEditMode &&
              steps[1]?.status === "active" &&
              "ring-2 ring-primary",
            !isEditMode && steps[1]?.status === "pending" && "opacity-50",
          )}
        >
          <CardHeader className="flex flex-row items-center space-y-0 pb-2 justify-between">
            <div className="flex items-center space-x-3">
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium",
                  steps[1]?.status === "completed"
                    ? "bg-green-500 text-white"
                    : steps[1]?.status === "active"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted",
                )}
              >
                {steps[1]?.status === "completed" ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <span>2</span>
                )}
              </div>
              <div>
                <CardTitle className="text-lg">
                  {steps[1]?.title || "Scenarios"}
                </CardTitle>
                <CardDescription>
                  {steps[1]?.description ||
                    "Select scenarios to include in this simulation."}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 px-6">
            <ScenarioCardGrid
              scenarioMapping={scenarioMapping}
              validScenarioIds={validScenarioIds}
              selectedScenarioIds={
                // Use searchParams as source of truth for ordering
                searchParams.get("scenarioIds")?.split(",").filter(Boolean) ||
                currentScenarioIds
              }
              onSelect={handleScenarioSelect}
              readonly={isReadonly}
              canRemoveMap={useMemo(() => {
                const map: Record<string, boolean> = {};
                if (simulationData?.scenarios) {
                  simulationData.scenarios.forEach((scenario) => {
                    map[scenario.scenario_id] = scenario.can_remove;
                  });
                }
                return map;
              }, [simulationData?.scenarios])}
            />
          </CardContent>
        </Card>

        {/* Individual Scenario Configuration Steps */}
        <Accordion
          type="single"
          collapsible
          value={openAccordionItem ?? ""}
          onValueChange={(value) => setOpenAccordionItem(value || null)}
          className="space-y-4"
        >
          {contentItems
            .filter((item) => item.type === "scenario")
            .map((item, index) => {
              const stepIndex = 2 + index; // After basic (0), scenarios (1)
              const stepId = `scenario-${item.id}`;
              const stepStatus = getStepStatus(stepId);
              const scenarioItems = contentItems.filter(
                (i) => i.type === "scenario",
              );
              const accordionValue = `${item.type}:${item.id}`;

              return (
                <SimulationScenarioSection
                  key={`${item.type}:${item.id}`}
                  item={item}
                  position={item.position}
                  totalItems={scenarioItems.length}
                  rubricMapping={rubricMapping}
                  validRubricIds={validRubricIds}
                  onActiveToggle={handleContentActiveToggle}
                  onMoveUp={handleContentMoveUp}
                  onMoveDown={handleContentMoveDown}
                  onRemove={handleContentRemove}
                  onEditScenario={editScenario}
                  onHintsToggle={handleHintsToggle}
                  onCopyPasteToggle={handleCopyPasteToggle}
                  onAudioToggle={handleAudioToggle}
                  onTextToggle={handleTextToggle}
                  onRubricChange={handleRubricChange}
                  onTimeLimitChange={handleTimeLimitChange}
                  readonly={isReadonly}
                  stepStatus={stepStatus}
                  stepNumber={stepIndex + 1}
                  isEditMode={isEditMode}
                  practiceSimulation={formData?.practiceSimulation ?? false}
                  accordionValue={accordionValue}
                  isAccordionOpen={openAccordionItem === accordionValue}
                  onAccordionToggle={(open) =>
                    setOpenAccordionItem(open ? accordionValue : null)
                  }
                />
              );
            })}
        </Accordion>

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
