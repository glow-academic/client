/**
 * Simulation.tsx
 * Used to create and manage simulations for the admin dashboard
 * @AshokSaravanan222 & @siladiea
 * 05/20/2025
 */
"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

// UI Components
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

import {
  GenericForm,
  type StepStatus,
} from "@/components/common/forms/GenericForm";
import { GenericPicker } from "@/components/common/forms/GenericPicker";
import { SelectableGrid } from "@/components/common/forms/SelectableGrid";
import { StepCard } from "@/components/common/forms/StepCard";
import { useBreadcrumbContext } from "@/contexts/breadcrumb-context";
import { useProfile } from "@/contexts/profile-context";
import { useDraftAutosave } from "@/hooks/use-draft-autosave";
import { cn } from "@/lib/utils";
import {
  getDefaultDepartmentIds,
  transformDepartmentIdsForSubmit,
} from "@/utils/department-picker-helpers";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Clock,
  Copy,
  FileText,
  GraduationCap,
  GripVertical,
  Lightbulb,
  Mic,
  Power,
  Text,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  parseAsBoolean,
  parseAsString,
  useQueryStates,
  type Parser,
  type Values,
} from "nuqs";

// Type-only import from server page
import type {
  CreateSimulationIn,
  CreateSimulationOut,
  PatchSimulationDraftIn,
  PatchSimulationDraftOut,
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
  patchSimulationDraftAction?: (
    input: PatchSimulationDraftIn
  ) => Promise<PatchSimulationDraftOut>;
}

export default function Simulation({
  simulationId,
  simulationDetail: serverSimulationDetail,
  simulationDetailDefault: serverSimulationDetailDefault,
  createSimulationAction,
  updateSimulationAction,
  patchSimulationDraftAction,
}: SimulationProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { effectiveProfile, selectedDraftId, setSelectedDraftId } =
    useProfile();
  const { setEntityMetadata, clearEntityMetadata } = useBreadcrumbContext();
  const isSuperadmin = effectiveProfile?.role === "superadmin";
  const isEditMode = !!simulationId;

  // Inline parsers for URL-backed state
  // Only include search/filter params, not draft data (scenarioIds is draft data)
  const simulationSearchParamsClient = {
    draftId: parseAsString,
    scenarioSearch: parseAsString,
    scenarioShowSelected: parseAsBoolean,
  } as const;

  // URL-backed state using nuqs
  const [urlParams, setUrlParams] = useQueryStates(
    simulationSearchParamsClient,
    {
      history: "replace",
      shallow: true, // Use shallow routing to prevent server component re-renders
    }
  );

  // Get draftId from URL (managed by nuqs via urlParams)
  const urlDraftId = urlParams.draftId || null;

  // Sync URL draftId to profile context
  useEffect(() => {
    if (urlDraftId !== selectedDraftId) {
      setSelectedDraftId(urlDraftId);
    }
  }, [urlDraftId, selectedDraftId, setSelectedDraftId]);

  const draftId = urlDraftId;

  // Extract body types from server action types for type safety
  type CreateSimulationBody = CreateSimulationIn extends { body: infer B }
    ? B
    : never;
  type UpdateSimulationBody = UpdateSimulationIn extends { body: infer B }
    ? B
    : never;

  // Use server actions directly (no mutations needed)
  const handleCreateSimulation = useCallback(
    async (body: CreateSimulationBody) => {
      if (!createSimulationAction) {
        throw new Error("createSimulationAction is required");
      }
      await createSimulationAction({ body });
    },
    [createSimulationAction]
  );

  const handleUpdateSimulation = useCallback(
    async (body: UpdateSimulationBody) => {
      if (!updateSimulationAction) {
        throw new Error("updateSimulationAction is required");
      }
      await updateSimulationAction({ body });
    },
    [updateSimulationAction]
  );

  // Set breadcrumb context when simulation data is loaded
  useEffect(() => {
    if (serverSimulationDetail?.name && simulationId && isEditMode) {
      setEntityMetadata({
        entityId: simulationId,
        entityName: serverSimulationDetail.name,
        entityType: "simulation",
      });
    }
    return () => clearEntityMetadata();
  }, [
    serverSimulationDetail,
    simulationId,
    isEditMode,
    setEntityMetadata,
    clearEntityMetadata,
  ]);

  const defaultDepartmentIds = useMemo(
    () =>
      getDefaultDepartmentIds(
        isSuperadmin,
        effectiveProfile?.primary_department_id ?? null
      ),
    [isSuperadmin, effectiveProfile?.primary_department_id]
  );

  // Use server-provided data
  const simulationDetail = serverSimulationDetail;
  const simulationDetailDefault = serverSimulationDetailDefault;
  const simulationData = isEditMode
    ? simulationDetail
    : simulationDetailDefault;

  // Form data from nuqs (URL-backed - only search params)
  const formData = urlParams;

  // Helper to update form data (URL-backed)
  const setFormData = useCallback(
    (updates: Partial<typeof urlParams>) => {
      setUrlParams((prev) => ({ ...prev, ...updates }));
    },
    [setUrlParams]
  );

  // Local draft state (not in URL) - for form fields like title, description, etc.
  type DraftState = {
    title: string;
    description: string;
    active: boolean;
    practiceSimulation: boolean;
    departmentIds: string[];
    hint_agent_id: string | null;
    simulation_text_agent_id: string | null;
    simulation_voice_agent_id: string | null;
    member_agent_id: string | null; // Member agent for rubric grade agents
    scenarioIds: string[]; // Track selected scenario IDs (for ordering)
    scenarioActiveStates: Record<string, boolean>;
    scenarioSettings: Record<
      string,
      {
        hints_enabled?: boolean;
        copy_paste_allowed?: boolean;
        audio_enabled?: boolean;
        text_enabled?: boolean;
        rubric_ids?: string[]; // Array of rubric IDs (multi-select)
        grade_agent_ids?: string[]; // Array of grade agent IDs (multi-select) - will generate all permutations
        time_limit_seconds?: number | null;
        time_limit_enabled?: boolean; // Track if time limit feature is enabled (separate from value)
      }
    >;
  };

  // Initialize draft state from server data
  const initialDraftState = useMemo((): DraftState => {
    const data = isEditMode ? simulationDetail : simulationDetailDefault;

    // Get scenarioIds from server data (draft payload if available, otherwise simulation data)
    // Both SimulationDetailOut and SimulationNewOut have scenario_ids field
    const serverScenarioIds =
      data && "scenario_ids" in data
        ? (data.scenario_ids || []).map(String)
        : [];

    if (!data) {
      return {
        title: "New Simulation",
        description: "",
        active: true,
        practiceSimulation: false,
        departmentIds: defaultDepartmentIds,
        hint_agent_id: null,
        simulation_text_agent_id: null,
        simulation_voice_agent_id: null,
        member_agent_id: null,
        scenarioIds: serverScenarioIds,
        scenarioActiveStates: {},
        scenarioSettings: {},
      };
    }

    // Initialize scenario active states and settings from server data
    // First, try to read from draft payload fields (scenario_active_states, scenario_settings)
    // These are returned by SQL when draft exists
    let scenarioActiveStates: Record<string, boolean> = {};
    let scenarioSettings: Record<
      string,
      {
        hints_enabled?: boolean;
        copy_paste_allowed?: boolean;
        audio_enabled?: boolean;
        text_enabled?: boolean;
        rubric_ids?: string[];
        grade_agent_ids?: string[];
        time_limit_seconds?: number | null;
        time_limit_enabled?: boolean;
      }
    > = {};

    // Try to read from draft payload fields first (if draft exists)
    if (
      data &&
      "scenario_active_states" in data &&
      data.scenario_active_states
    ) {
      try {
        const parsed =
          typeof data.scenario_active_states === "string"
            ? JSON.parse(data.scenario_active_states)
            : data.scenario_active_states;
        if (parsed && typeof parsed === "object") {
          scenarioActiveStates = parsed as Record<string, boolean>;
        }
      } catch (e) {
        // Ignore parse errors, fall back to scenarios array
      }
    }
    if (data && "scenario_settings" in data && data.scenario_settings) {
      try {
        const parsed =
          typeof data.scenario_settings === "string"
            ? JSON.parse(data.scenario_settings)
            : data.scenario_settings;
        if (parsed && typeof parsed === "object") {
          scenarioSettings = parsed as Record<
            string,
            {
              hints_enabled?: boolean;
              copy_paste_allowed?: boolean;
              audio_enabled?: boolean;
              text_enabled?: boolean;
              rubric_ids?: string[];
              grade_agent_ids?: string[];
              time_limit_seconds?: number | null;
              time_limit_enabled?: boolean;
            }
          >;
        }
      } catch (e) {
        // Ignore parse errors, fall back to scenarios array
      }
    }

    // Member agent ID is now provided by server (auto-selected when there's only one option)
    // For edit mode, fall back to extracting from first scenario's rubric_grade_agents if not provided by server
    let memberAgentId: string | null =
      (data && "member_agent_id" in data
        ? (data.member_agent_id as string | null)
        : null) || null;
    if (
      !memberAgentId &&
      isEditMode &&
      simulationDetail &&
      "scenarios" in simulationDetail &&
      simulationDetail.scenarios
    ) {
      // Fallback: Find first scenario with rubric_grade_agents to get member agent
      const firstScenarioWithRubric = simulationDetail.scenarios.find(
        (s) =>
          s.rubric_grade_agents &&
          Array.isArray(s.rubric_grade_agents) &&
          s.rubric_grade_agents.length > 0 &&
          s.rubric_grade_agents[0]?.grade_agent_id
      );
      if (firstScenarioWithRubric?.rubric_grade_agents?.[0]?.grade_agent_id) {
        memberAgentId =
          firstScenarioWithRubric.rubric_grade_agents[0].grade_agent_id;
      }
    }

    // If draft payload didn't have these fields, fall back to extracting from scenarios array (edit mode only)
    if (
      Object.keys(scenarioActiveStates).length === 0 &&
      isEditMode &&
      simulationDetail &&
      "scenarios" in simulationDetail &&
      simulationDetail.scenarios
    ) {
      // Use ordered scenario IDs from server (by position) if URL params not available
      simulationDetail.scenarios
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
        .forEach((scenario) => {
          const key = scenario.scenario_id;
          if (key) {
            scenarioActiveStates[key] = scenario.active ?? false;
            // Extract rubric_ids and grade_agent_ids from rubric_grade_agents (support multiple)
            const rubricGradeAgents =
              scenario.rubric_grade_agents &&
              Array.isArray(scenario.rubric_grade_agents) &&
              scenario.rubric_grade_agents.length > 0
                ? scenario.rubric_grade_agents
                : [];
            // Collect all unique rubric_ids and grade_agent_ids
            const rubricIdsSet = new Set<string>();
            const gradeAgentIdsSet = new Set<string>();
            rubricGradeAgents.forEach((rga) => {
              if (rga.rubric_id) {
                rubricIdsSet.add(rga.rubric_id);
              }
              if (rga.grade_agent_id) {
                gradeAgentIdsSet.add(rga.grade_agent_id);
              }
            });
            // Only set if not already set from draft payload
            if (!(key in scenarioSettings)) {
              scenarioSettings[key] = {
                hints_enabled: scenario.hints_enabled ?? false,
                copy_paste_allowed:
                  ("copy_paste_allowed" in scenario
                    ? scenario.copy_paste_allowed
                    : false) ?? false,
                audio_enabled:
                  ("audio_enabled" in scenario
                    ? scenario.audio_enabled
                    : false) ?? false,
                text_enabled:
                  ("text_enabled" in scenario ? scenario.text_enabled : true) ??
                  true,
                rubric_ids: Array.from(rubricIdsSet),
                grade_agent_ids: Array.from(gradeAgentIdsSet),
                time_limit_seconds: scenario.time_limit_seconds ?? null,
                // Infer time_limit_enabled from time_limit_seconds (if not null, it's enabled)
                time_limit_enabled:
                  scenario.time_limit_seconds !== null &&
                  scenario.time_limit_seconds !== undefined,
              };
            }
          }
        });
    }

    const result = {
      title: data.name || "New Simulation",
      description: data.description || "",
      active: data.active ?? true,
      practiceSimulation: data.practice_simulation ?? false,
      departmentIds: data.department_ids || defaultDepartmentIds,
      // Agent IDs are now auto-selected server-side when there's only one option
      // Use server-provided values (which include auto-selected defaults)
      hint_agent_id: data.hint_agent_id || null,
      simulation_text_agent_id: data.simulation_text_agent_id || null,
      simulation_voice_agent_id: data.simulation_voice_agent_id || null,
      member_agent_id: memberAgentId,
      scenarioIds: serverScenarioIds,
      scenarioActiveStates,
      scenarioSettings,
    };
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isEditMode,
    simulationDetail,
    simulationDetailDefault,
    draftId, // Add draftId to dependencies so it recomputes when draft changes
    urlDraftId, // Add urlDraftId to dependencies so it recomputes when URL draft changes
    defaultDepartmentIds,
    // Include actual content fields so it recomputes when server data changes (not just object reference)
    simulationDetailDefault?.name,
    simulationDetailDefault?.description,
    simulationDetailDefault?.active,
    simulationDetailDefault?.practice_simulation,
    simulationDetailDefault?.department_ids,
    simulationDetailDefault?.scenario_ids,
    simulationDetailDefault?.hint_agent_id,
    simulationDetailDefault?.simulation_text_agent_id,
    simulationDetailDefault?.simulation_voice_agent_id,
    simulationDetail?.name,
    simulationDetail?.description,
    simulationDetail?.active,
    simulationDetail?.practice_simulation,
    simulationDetail?.department_ids,
    simulationDetail?.scenario_ids,
    simulationDetail?.hint_agent_id,
    simulationDetail?.simulation_text_agent_id,
    simulationDetail?.simulation_voice_agent_id,
    // Note: member_agent_id may not be in TypeScript types but is in SQL/draft payload
    // Access via 'in' operator check in the useMemo body instead of dependency array
  ]);

  // Local draft state (not in URL)
  const [draftState, setDraftState] = useState<DraftState>(initialDraftState);

  // Track previous initialDraftState content to avoid unnecessary updates
  const prevInitialDraftStateRef = useRef<string>(
    JSON.stringify(initialDraftState)
  );

  // Update draft state when server data changes (e.g., draft selected)
  // Only update if content actually changed (deep comparison to prevent unnecessary re-renders)
  // CRITICAL: Prevent overwriting draftState with empty values if current state has content
  useEffect(() => {
    // Deep compare to avoid unnecessary state updates
    const currentStateStr = prevInitialDraftStateRef.current;
    const newStateStr = JSON.stringify(initialDraftState);

    // Only update if content actually changed
    if (currentStateStr !== newStateStr) {
      // Check if new state is "empty" (no title, no scenarios) but current state has content
      // This prevents form reset when server data refreshes before draft payload is merged
      const newStateIsEmpty =
        (!initialDraftState.title || initialDraftState.title.trim() === "") &&
        (initialDraftState.scenarioIds?.length || 0) === 0;

      // Get current draftState to check if it has content
      setDraftState((currentDraftState) => {
        const currentStateHasContent =
          (currentDraftState.title?.trim() || "").length > 0 ||
          (currentDraftState.scenarioIds?.length || 0) > 0;

        // Prevent overwriting with empty values if current state has content
        // This handles race condition when server refreshes before draft payload is merged
        // CRITICAL: Always update boolean fields (active, practiceSimulation) from initialDraftState
        // even when skipping the update, as these are simple boolean values that should always sync
        if (newStateIsEmpty && currentStateHasContent) {
          // Keep current state but update boolean fields from initialDraftState
          return {
            ...currentDraftState,
            active: initialDraftState.active,
            practiceSimulation: initialDraftState.practiceSimulation,
          };
        }

        // Merge scenarioSettings and scenarioActiveStates from current state if new state doesn't have them
        // SQL now returns these from draft payload, but preserve from current draftState if missing
        const mergedState = { ...initialDraftState };
        if (
          Object.keys(currentDraftState.scenarioSettings || {}).length > 0 &&
          Object.keys(mergedState.scenarioSettings || {}).length === 0
        ) {
          mergedState.scenarioSettings = {
            ...currentDraftState.scenarioSettings,
          };
        }
        if (
          Object.keys(currentDraftState.scenarioActiveStates || {}).length >
            0 &&
          Object.keys(mergedState.scenarioActiveStates || {}).length === 0
        ) {
          mergedState.scenarioActiveStates = {
            ...currentDraftState.scenarioActiveStates,
          };
        }

        // Update prev ref and return merged state
        prevInitialDraftStateRef.current = JSON.stringify(mergedState);
        return mergedState;
      });
    } else {
      // Even if strings match, check if boolean fields differ and update them
      // This handles cases where draftState was initialized with defaults but server returns different values
      setDraftState((currentDraftState) => {
        const activeDiffers =
          currentDraftState.active !== initialDraftState.active;
        const practiceSimulationDiffers =
          currentDraftState.practiceSimulation !==
          initialDraftState.practiceSimulation;

        if (activeDiffers || practiceSimulationDiffers) {
          return {
            ...currentDraftState,
            active: initialDraftState.active,
            practiceSimulation: initialDraftState.practiceSimulation,
          };
        }
        return currentDraftState;
      });
      // Even if strings match, update ref to prevent false positives
      prevInitialDraftStateRef.current = newStateStr;
    }
  }, [initialDraftState, draftId, urlDraftId]);

  // Track when draftId changes to reset autosave hook state
  const prevDraftIdRef = useRef<string | null>(draftId);
  useEffect(() => {
    if (prevDraftIdRef.current !== draftId) {
      // Draft changed - this will trigger useDraftAutosave to reset lastSavedVersion
      prevDraftIdRef.current = draftId;
    }
  }, [draftId]);

  // Get draft version from server (source of truth)
  const draftVersion = useMemo(() => {
    const data = isEditMode ? simulationDetail : simulationDetailDefault;
    return (
      (data && "draft_version" in data ? (data.draft_version as number) : 0) ||
      0
    );
  }, [isEditMode, simulationDetail, simulationDetailDefault]);

  // Integrate autosave hook
  // Pattern: Transform hook API (draft_id, patch, expected_version) to backend API (input_draft_id, patch, expected_version)
  // Server is source of truth for version - we pass initialVersion from server response
  const {
    saveStatus: _saveStatus,
    saveNow: _saveNow,
    lastSavedVersion: _lastSavedVersion,
  } = useDraftAutosave({
    draftId,
    draftState,
    initialVersion: draftVersion, // Server-provided version (source of truth)
    patchDraftAction: patchSimulationDraftAction
      ? async (input) => {
          // Transform camelCase keys to snake_case for draft payload (SQL expects snake_case for some fields, camelCase for others)
          // Based on SQL defaults: scenarioIds (camelCase), scenarioActiveStates (camelCase), scenarioSettings (camelCase),
          // departmentIds (camelCase), practiceSimulation (camelCase), but hint_agent_id (snake_case), etc.
          // Actually, looking at the SQL, it uses camelCase for arrays/objects and snake_case for IDs
          // So we need to check what the actual SQL expects. For now, let's keep camelCase as-is since SQL defaults use camelCase
          // But we should verify this matches what SQL expects
          const transformedPatch: Record<string, unknown> = {};
          Object.entries(input.body.patch as Record<string, unknown>).forEach(
            ([key, value]) => {
              // Keep camelCase keys as-is (scenarioIds, scenarioActiveStates, scenarioSettings, departmentIds, practiceSimulation)
              // These match SQL defaults
              transformedPatch[key] = value;
            }
          );
          // Transform hook API → backend API
          // Hook API: { body: { draft_id, patch, expected_version } }
          // Backend API: { body: { input_draft_id, patch, expected_version } }
          // Note: profile_id is added server-side from header
          const result = await patchSimulationDraftAction({
            body: {
              input_draft_id: input.body.draft_id || null,
              patch: transformedPatch,
              expected_version: input.body.expected_version,
            } as PatchSimulationDraftIn["body"],
          });
          // Transform backend API → hook API
          // Backend API: { draft_id, new_version, draft_exists }
          // Hook API: { draftId, newVersion, draftExists }
          return {
            draftId: result.draft_id || "",
            newVersion: result.new_version || 0,
            draftExists: result.draft_exists || false,
          };
        }
      : async () => ({ draftId: "", newVersion: 0, draftExists: false }),
    debounceMs: 1000,
    onDraftCreated: useCallback(
      (newDraftId: string) => {
        // Only update URL if draftId actually changed
        const currentUrlDraftId = searchParams.get("draftId");
        if (newDraftId === currentUrlDraftId) {
          return;
        }
        // Update URL with new draftId and trigger server-side refetch
        const params = new URLSearchParams(searchParams.toString());
        params.set("draftId", newDraftId);
        const newUrl = `?${params.toString()}`;
        router.replace(newUrl, { scroll: false });
        // Force server components to re-render with updated search params
        router.refresh();
      },
      [router, searchParams]
    ),
  });

  // Readonly logic using server-provided can_edit flag
  const isReadonly = useMemo(() => {
    if (!isEditMode || !simulationData) return false;
    return !simulationData.can_edit;
  }, [isEditMode, simulationData]);

  // Extract department mapping - create dict from array (composite types)
  const departmentMapping = useMemo(() => {
    const departments = simulationData?.departments || [];
    return departments.reduce(
      (acc, dept) => {
        acc[String(dept.department_id)] = {
          name: dept.name || "",
          description: dept.description || "",
          scenario_ids: dept.scenario_ids?.map(String) || null,
          rubric_ids: dept.rubric_ids?.map(String) || null,
          cohort_ids: dept.cohort_ids?.map(String) || null,
        };
        return acc;
      },
      {} as Record<
        string,
        {
          name: string;
          description: string;
          scenario_ids: string[] | null;
          rubric_ids: string[] | null;
          cohort_ids: string[] | null;
        }
      >
    );
  }, [simulationData?.departments]);
  // Extract agent mapping - create dict from array (composite types)
  // Always include selected agents even if they're not in the API response (for backward compatibility)
  const agentMapping = useMemo(() => {
    const mapped: Record<
      string,
      { id: string; name: string; description: string; roles?: string[] }
    > = {};

    // Add agents from API response (arrays now)
    const agents =
      (isEditMode && simulationDetail && "agents" in simulationDetail
        ? simulationDetail.agents
        : simulationData?.agents) || [];

    agents.forEach((agent) => {
      const key = String(agent.agent_id);
      mapped[key] =
        agent.roles && agent.roles.length > 0
          ? {
              id: key,
              name: agent.name || "",
              description: agent.description || "",
              roles: agent.roles.map(String),
            }
          : {
              id: key,
              name: agent.name || "",
              description: agent.description || "",
            };
    });

    // Add selected agents that aren't in the mapping (for backward compatibility)
    // This ensures GenericPicker can display selected agents even if they're not in valid_agent_ids
    if (
      draftState.simulation_text_agent_id &&
      !mapped[draftState.simulation_text_agent_id]
    ) {
      mapped[draftState.simulation_text_agent_id] = {
        id: draftState.simulation_text_agent_id,
        name: `Agent ${draftState.simulation_text_agent_id.slice(0, 8)}...`,
        description: "Selected simulation agent",
        roles: [],
      };
    }
    if (
      draftState.simulation_voice_agent_id &&
      !mapped[draftState.simulation_voice_agent_id]
    ) {
      mapped[draftState.simulation_voice_agent_id] = {
        id: draftState.simulation_voice_agent_id,
        name: `Agent ${draftState.simulation_voice_agent_id.slice(0, 8)}...`,
        description: "Selected voice agent",
        roles: [],
      };
    }
    if (draftState.hint_agent_id && !mapped[draftState.hint_agent_id]) {
      mapped[draftState.hint_agent_id] = {
        id: draftState.hint_agent_id,
        name: `Agent ${draftState.hint_agent_id.slice(0, 8)}...`,
        description: "Selected hint agent",
        roles: [],
      };
    }

    return mapped;
  }, [
    isEditMode,
    simulationDetail,
    simulationData?.agents,
    draftState.simulation_text_agent_id,
    draftState.simulation_voice_agent_id,
    draftState.hint_agent_id,
  ]);

  // Extract scenario mapping - create dict from scenarios_full array (composite types)
  const scenarioMapping = useMemo(() => {
    const scenariosFull =
      (isEditMode && simulationDetail && "scenarios_full" in simulationDetail
        ? simulationDetail.scenarios_full
        : simulationData?.scenarios_full) || [];

    return scenariosFull.reduce(
      (acc, scenario) => {
        acc[String(scenario.scenario_id)] = {
          name: scenario.name || "",
          description: scenario.description || "",
          persona_ids: scenario.persona_ids?.map(String) || [],
          persona_mapping: (scenario.persona_mapping || []) as Array<{
            persona_id: string | { toString(): string };
            name?: string | null;
            description?: string | null;
            color?: string | null;
            icon?: string | null;
            image_model?: boolean | null;
          }>,
          document_mapping: (scenario.document_mapping || []) as Array<{
            document_id: string | { toString(): string };
            name?: string | null;
            description?: string | null;
          }>,
          parameter_item_mapping: (scenario.parameter_item_mapping ||
            []) as Array<{
            field_id: string | { toString(): string };
            name?: string | null;
            description?: string | null;
            parameter_id?: string | { toString(): string } | null;
            parameter_name?: string | null;
          }>,
          parameter_item_ids: scenario.parameter_item_ids?.map(String) || [],
          document_ids: scenario.document_ids?.map(String) || [],
        };
        return acc;
      },
      {} as Record<
        string,
        {
          name: string;
          description: string;
          persona_ids: string[];
          persona_mapping: Array<{
            persona_id: string | { toString(): string };
            name?: string | null;
            description?: string | null;
            color?: string | null;
            icon?: string | null;
            image_model?: boolean | null;
          }>;
          document_mapping: Array<{
            document_id: string | { toString(): string };
            name?: string | null;
            description?: string | null;
          }>;
          parameter_item_mapping: Array<{
            field_id: string | { toString(): string };
            name?: string | null;
            description?: string | null;
            parameter_id?: string | { toString(): string } | null;
            parameter_name?: string | null;
          }>;
          parameter_item_ids: string[];
          document_ids: string[];
        }
      >
    );
  }, [isEditMode, simulationDetail, simulationData?.scenarios_full]);

  const validAgentIds = useMemo(() => {
    const ids =
      (simulationData as { valid_agent_ids?: string[] })?.valid_agent_ids || [];
    return ids;
  }, [simulationData]);

  // Get scenario IDs from URL params (source of truth) - defined earlier
  // const currentScenarioIds = urlParams.scenarioIds || [];

  // Extract valid scenario IDs from V2 response, filtered by selected departments
  // Includes: items from selected departments + cross-department items + currently selected items
  const validScenarioIds = useMemo(() => {
    const baseIds = simulationData?.valid_scenario_ids || [];
    const selectedDeptIds = draftState.departmentIds || [];

    // Always include currently selected scenarios (for edit mode - ensures selected items are visible)
    const selectedScenarioIdsSet = new Set(draftState.scenarioIds || []);

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
    draftState.departmentIds,
    departmentMapping,
    draftState.scenarioIds,
  ]);

  // Build scenarios array from scenarioMapping (similar to Cohort's simulationsArray)
  const scenariosArray = useMemo(() => {
    return validScenarioIds
      .map((id) => {
        const scenario = scenarioMapping[id];
        if (!scenario) return null;
        return {
          scenario_id: id,
          name: scenario.name || "",
          description: scenario.description || "",
        };
      })
      .filter(
        (
          scenario
        ): scenario is {
          scenario_id: string;
          name: string;
          description: string;
        } => scenario !== null
      );
  }, [validScenarioIds, scenarioMapping]);

  const validRubricIds = useMemo(() => {
    const baseIds = simulationData?.valid_rubric_ids || [];
    const selectedDeptIds = draftState.departmentIds || [];

    // Always include currently selected rubrics from draftState (for edit mode - ensures selected items are visible)
    const selectedRubricIdSet = new Set<string>();
    Object.values(draftState.scenarioSettings).forEach((settings) => {
      if (settings.rubric_ids && settings.rubric_ids.length > 0) {
        settings.rubric_ids.forEach((id) => selectedRubricIdSet.add(id));
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
    draftState.departmentIds,
    draftState.scenarioSettings,
    departmentMapping,
  ]);

  // Extract rubric mapping - create dict from rubrics array (composite types)
  // Always include selected rubrics (for backward compatibility)
  // This ensures GenericPicker can display selected rubrics even if they're not in valid_rubric_ids
  const rubricMapping = useMemo(() => {
    const rubrics =
      (isEditMode && simulationDetail && "rubrics" in simulationDetail
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

    // Add selected rubrics from draftState that aren't in the mapping
    Object.values(draftState.scenarioSettings).forEach((settings) => {
      if (settings.rubric_ids && settings.rubric_ids.length > 0) {
        settings.rubric_ids.forEach((rubricId) => {
          if (rubricId && !mapped[rubricId]) {
            mapped[rubricId] = {
              id: rubricId,
              name: `Rubric ${rubricId.slice(0, 8)}...`,
              description: "Selected rubric",
            };
          }
        });
      }
    });

    return mapped;
  }, [
    isEditMode,
    simulationDetail,
    simulationData?.rubrics,
    draftState.scenarioSettings,
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

  // Note: scenarioIds is now only in draftState, not URL params

  // Initialize content active states and switch states from server data
  // Note: Agent auto-selection is now handled server-side in get_simulation_new_complete.sql and get_simulation_detail_complete.sql

  // Clear scenarios that are no longer valid after department changes
  // Use ref to track previous validScenarioIds to prevent loops
  const prevValidScenarioIdsRef = useRef<string[]>([]);
  useEffect(() => {
    // Only run if validScenarioIds actually changed
    const validScenarioIdsChanged =
      prevValidScenarioIdsRef.current.length !== validScenarioIds.length ||
      !prevValidScenarioIdsRef.current.every(
        (id, idx) => id === validScenarioIds[idx]
      );

    if (!validScenarioIdsChanged) {
      return;
    }

    // Clear scenarios that are no longer valid
    if (draftState.scenarioIds.length > 0) {
      const validSet = new Set(validScenarioIds);
      const filtered = draftState.scenarioIds.filter((id) => validSet.has(id));
      if (filtered.length !== draftState.scenarioIds.length) {
        setDraftState((prev) => ({ ...prev, scenarioIds: filtered }));
      }
    }

    // Update ref to track current validScenarioIds
    prevValidScenarioIdsRef.current = [...validScenarioIds];
  }, [draftState.scenarioIds, validScenarioIds]);

  // Note: rubric_id is now per-scenario, not simulation-level, so we don't clear it here

  // Submit handler for GenericForm
  const handleSubmit = useCallback(
    async (_formDataLocal: unknown) => {
      // Validate form
      if (!draftState.title?.trim()) {
        toast.error("Title is required");
        return;
      }

      const scenarioIds = draftState.scenarioIds || [];
      if (scenarioIds.length === 0) {
        toast.error("At least one scenario is required");
        return;
      }

      // Validate each scenario has at least one input method enabled
      const invalidScenarios: string[] = [];
      scenarioIds.forEach((scenarioId) => {
        const settings = draftState.scenarioSettings[scenarioId] || {};
        const textEnabled = settings.text_enabled ?? true;
        const audioEnabled = settings.audio_enabled ?? false;
        if (!textEnabled && !audioEnabled) {
          const scenario = scenarioMapping[scenarioId];
          invalidScenarios.push(scenario?.name || scenarioId);
        }
      });

      if (invalidScenarios.length > 0) {
        toast.error(
          `Each scenario must have at least one input method enabled (text or audio). Please fix: ${invalidScenarios.join(", ")}`
        );
        return;
      }

      try {
        const validDepartmentIds = simulationData?.valid_department_ids || [];
        const finalDepartmentIds = transformDepartmentIdsForSubmit(
          draftState.departmentIds || [],
          isSuperadmin,
          validDepartmentIds
        );

        // Convert to API format - use draftState.scenarioIds order
        const scenario_ids: string[] = [];
        const scenario_active_flags: boolean[] = [];
        const scenario_hints_enabled: boolean[] = [];
        const scenario_audio_enabled: boolean[] = [];
        const scenario_text_enabled: boolean[] = [];
        const scenario_time_limit_seconds: number[] = [];
        const scenario_rubric_grade_agents: Array<{
          scenario_id: string | null;
          rubric_id: string | null;
          grade_agent_id: string | null;
          audio_agent_id: string | null;
        }> = [];

        scenarioIds.forEach((scenarioId) => {
          const settings = draftState.scenarioSettings[scenarioId] || {};
          const active =
            draftState.scenarioActiveStates[scenarioId] ??
            simulationData?.scenarios?.find((s) => s.scenario_id === scenarioId)
              ?.active ??
            true;

          scenario_ids.push(scenarioId);
          scenario_active_flags.push(active);
          scenario_hints_enabled.push(settings.hints_enabled ?? false);
          scenario_audio_enabled.push(settings.audio_enabled ?? false);
          scenario_text_enabled.push(settings.text_enabled ?? true);
          scenario_time_limit_seconds.push(settings.time_limit_seconds ?? 0);

          // Build rubric_grade_agents with all permutations of rubric_ids and grade_agent_ids
          const rubricIds = settings.rubric_ids || [];
          const gradeAgentIds = settings.grade_agent_ids || [];

          // Generate all permutations of rubric_ids × grade_agent_ids
          rubricIds.forEach((rubricId) => {
            if (
              !rubricId ||
              rubricId === "00000000-0000-0000-0000-000000000000"
            ) {
              return;
            }
            gradeAgentIds.forEach((gradeAgentId) => {
              if (
                !gradeAgentId ||
                gradeAgentId === "00000000-0000-0000-0000-000000000000"
              ) {
                return;
              }
              scenario_rubric_grade_agents.push({
                scenario_id: scenarioId,
                rubric_id: rubricId,
                grade_agent_id: gradeAgentId,
                audio_agent_id: null, // TODO: Add UI to select audio agent if needed
              });
            });
          });
        });

        if (simulationId) {
          // UPDATE mode
          const updatePayload = {
            simulation_id: simulationId,
            title: draftState.title,
            description: draftState.description ?? "",
            department_ids: finalDepartmentIds || [],
            active: draftState.active ?? true,
            practice_simulation: draftState.practiceSimulation || false,
            scenario_ids,
            scenario_active_flags,
            video_ids: [] as string[],
            video_active_flags: [] as boolean[],
            scenario_hints_enabled,
            scenario_rubric_grade_agents,
            scenario_time_limit_seconds,
            scenario_audio_enabled,
            scenario_text_enabled,
            video_show_problem_statement: [] as boolean[],
            video_show_objectives: [] as boolean[],
            video_show_image: [] as boolean[],
            hint_agent_id:
              draftState.hint_agent_id ||
              "00000000-0000-0000-0000-000000000000",
            simulation_text_agent_id:
              draftState.simulation_text_agent_id ||
              "00000000-0000-0000-0000-000000000000",
            simulation_voice_agent_id:
              draftState.simulation_voice_agent_id ||
              "00000000-0000-0000-0000-000000000000",
          };

          await handleUpdateSimulation(updatePayload);
          toast.success("Simulation updated successfully!");
        } else {
          // CREATE mode
          const createPayload = {
            title: draftState.title,
            description: draftState.description ?? "",
            department_ids: finalDepartmentIds || [],
            active: draftState.active || true,
            practice_simulation: draftState.practiceSimulation || false,
            scenario_ids,
            scenario_active_flags,
            scenario_hints_enabled,
            scenario_rubric_grade_agents,
            scenario_time_limit_seconds,
            scenario_audio_enabled,
            scenario_text_enabled,
            simulation_text_agent_id:
              draftState.simulation_text_agent_id ||
              "00000000-0000-0000-0000-000000000000",
            simulation_voice_agent_id:
              draftState.simulation_voice_agent_id ||
              "00000000-0000-0000-0000-000000000000",
          };

          await handleCreateSimulation(createPayload);
          toast.success("Simulation created successfully!");
        }

        router.push(`/create/simulations`);
      } catch (error) {
        toast.error(
          `Failed to ${simulationId ? "update" : "create"} simulation: ${error instanceof Error ? error.message : "Unknown error"}`
        );
        throw error;
      }
    },
    [
      draftState,
      simulationId,
      simulationData,
      scenarioMapping,
      isSuperadmin,
      handleCreateSimulation,
      handleUpdateSimulation,
      router,
    ]
  );

  // Step status logic for GenericForm
  const getStepStatus = useCallback(
    (stepId: string, _formDataLocal: unknown): StepStatus => {
      // Use draftState.scenarioIds for step status (not URL-backed formData)
      const hasScenarios = (draftState.scenarioIds?.length || 0) > 0;

      switch (stepId) {
        case "basic":
          // Basic step is always active/completed based on whether scenarios are selected
          return hasScenarios ? "completed" : "active";
        case "scenarios":
          return hasScenarios ? "completed" : "active";
        default:
          return "pending";
      }
    },
    [draftState.scenarioIds]
  );

  // Steps configuration for GenericForm
  const steps = useMemo(
    () => [
      {
        id: "basic",
        title: "Basic Information",
        description:
          "Set the simulation name, description, departments, and agents.",
        resetFields: [
          "title",
          "description",
          "departmentIds",
          "active",
          "practiceSimulation",
        ],
      },
      {
        id: "scenarios",
        title: "Scenarios",
        description: "Select scenarios to include in this simulation.",
        resetFields: ["scenarioSearch", "scenarioShowSelected"],
        filters: [
          {
            key: "scenarioShowSelected",
            label: "Show selected",
          },
        ],
      },
    ],
    []
  );

  // Form initialization function for GenericForm
  const initializeForm = useCallback(
    (_serverData: unknown, _editMode: boolean) => {
      // scenarioIds is draft data, not URL-backed form data
      return {};
    },
    []
  );

  // Render step callback for GenericForm
  const renderStep = useCallback(
    ({
      stepId,
      stepTitle,
      stepDescription,
      stepNumber,
      stepStatus,
      formData: _stepFormData,
      setFormData: setStepFormData,
      onReset,
    }: {
      stepId: string;
      stepTitle: string;
      stepDescription: string;
      stepNumber: number;
      stepStatus: StepStatus;
      isOptional: boolean;
      formData: Record<string, unknown>;
      setFormData: (updates: Partial<Record<string, unknown>>) => void;
      filters?: Array<{
        key: string;
        label: string;
        value: boolean;
        onChange: (value: boolean) => void;
      }>;
      onReset?: () => void;
    }) => {
      if (stepId === "basic") {
        return (
          <StepCard
            stepStatus={stepStatus}
            stepNumber={stepNumber}
            stepTitle={stepTitle}
            stepDescription={stepDescription}
            isReadonly={isReadonly}
            isEditMode={isEditMode}
            editableTitle={{
              value: draftState.title,
              onChange: (value) =>
                setDraftState((prev) => ({ ...prev, title: value })),
              placeholder: "New Simulation",
              defaultName: "New Simulation",
              required: true,
            }}
            resetFields={[
              "title",
              "description",
              "departmentIds",
              "active",
              "practiceSimulation",
            ]}
            {...(onReset ? { onReset } : {})}
            resetLabel="Reset"
          >
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  data-testid="input-simulation-description"
                  value={draftState.description}
                  onChange={(e) =>
                    setDraftState((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  placeholder="Enter a brief description (optional)"
                  rows={3}
                  disabled={isReadonly}
                />
              </div>

              {/* Department Selection */}
              {simulationData?.valid_department_ids &&
                simulationData.valid_department_ids.length > 1 && (
                  <div className="space-y-2">
                    <Label htmlFor="department">Department</Label>
                    <GenericPicker
                      items={departmentMapping}
                      itemIds={simulationData?.valid_department_ids || []}
                      selectedIds={draftState.departmentIds || []}
                      onSelect={(ids) =>
                        setDraftState((prev) => ({
                          ...prev,
                          departmentIds: ids,
                        }))
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
                  </div>
                )}

              {/* Agent Selection */}
              {validAgentIds.length > 0 && (
                <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                  {/* Hint Agent Selection */}
                  <div className="space-y-2">
                    <Label htmlFor="hint_agent_id">Hint Agent</Label>
                    <GenericPicker
                      items={agentMapping}
                      itemIds={validAgentIds.filter((id) => {
                        const agent = agentMapping[id];
                        return agent?.roles?.includes("hint");
                      })}
                      selectedIds={
                        draftState.hint_agent_id
                          ? [draftState.hint_agent_id]
                          : []
                      }
                      onSelect={(ids) =>
                        setDraftState((prev) => ({
                          ...prev,
                          hint_agent_id: ids[0] || null,
                        }))
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
                  </div>

                  {/* Simulation Agent Selection */}
                  <div className="space-y-2">
                    <Label htmlFor="simulation_text_agent_id">
                      Simulation Agent
                    </Label>
                    <GenericPicker
                      items={agentMapping}
                      itemIds={(() => {
                        const roleFilteredIds = validAgentIds.filter((id) => {
                          const agent = agentMapping[id];
                          return agent?.roles?.includes("simulation");
                        });
                        if (
                          draftState.simulation_text_agent_id &&
                          agentMapping[draftState.simulation_text_agent_id] &&
                          !roleFilteredIds.includes(
                            draftState.simulation_text_agent_id
                          )
                        ) {
                          return [
                            ...roleFilteredIds,
                            draftState.simulation_text_agent_id,
                          ];
                        }
                        return roleFilteredIds;
                      })()}
                      selectedIds={(() => {
                        const agentId = draftState.simulation_text_agent_id;
                        const hasAgent = agentId && agentMapping[agentId];
                        return hasAgent ? [agentId] : [];
                      })()}
                      onSelect={(ids) => {
                        setDraftState((prev) => ({
                          ...prev,
                          simulation_text_agent_id: ids[0] || null,
                        }));
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
                      placeholder="Select simulation agent"
                      disabled={isReadonly}
                      multiSelect={false}
                      hideSelectedChips={true}
                      buttonClassName="w-full"
                      groupHeading="Agents"
                    />
                  </div>

                  {/* Voice Agent Selection */}
                  <div className="space-y-2">
                    <Label htmlFor="simulation_voice_agent_id">
                      Voice Agent
                    </Label>
                    <GenericPicker
                      items={agentMapping}
                      itemIds={(() => {
                        const roleFilteredIds = validAgentIds.filter((id) => {
                          const agent = agentMapping[id];
                          return agent?.roles?.includes("voice");
                        });
                        if (
                          draftState.simulation_voice_agent_id &&
                          agentMapping[draftState.simulation_voice_agent_id] &&
                          !roleFilteredIds.includes(
                            draftState.simulation_voice_agent_id
                          )
                        ) {
                          return [
                            ...roleFilteredIds,
                            draftState.simulation_voice_agent_id,
                          ];
                        }
                        return roleFilteredIds;
                      })()}
                      selectedIds={(() => {
                        const agentId = draftState.simulation_voice_agent_id;
                        const hasAgent = agentId && agentMapping[agentId];
                        return hasAgent ? [agentId] : [];
                      })()}
                      onSelect={(ids) => {
                        setDraftState((prev) => ({
                          ...prev,
                          simulation_voice_agent_id: ids[0] || null,
                        }));
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
                      placeholder="Select voice agent"
                      disabled={isReadonly}
                      multiSelect={false}
                      hideSelectedChips={true}
                      buttonClassName="w-full"
                      groupHeading="Agents"
                    />
                  </div>

                  {/* Member Agent Selection */}
                  <div className="space-y-2">
                    <Label htmlFor="member_agent_id">Member Agent</Label>
                    <GenericPicker
                      items={agentMapping}
                      itemIds={validAgentIds.filter((id) => {
                        const agent = agentMapping[id];
                        return agent?.roles?.includes("member");
                      })}
                      selectedIds={
                        draftState.member_agent_id
                          ? [draftState.member_agent_id]
                          : []
                      }
                      onSelect={(ids) =>
                        setDraftState((prev) => ({
                          ...prev,
                          member_agent_id: ids[0] || null,
                        }))
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
                      placeholder="Select member agent"
                      disabled={isReadonly}
                      multiSelect={false}
                      hideSelectedChips={true}
                      buttonClassName="w-full"
                      groupHeading="Agents"
                    />
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
                    <Switch
                      id="active"
                      data-testid="switch-simulation-active"
                      checked={draftState.active ?? true}
                      onCheckedChange={(checked) => {
                        setDraftState((prev) => ({ ...prev, active: checked }));
                      }}
                      disabled={isReadonly}
                    />
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
                      <Switch
                        id="practiceSimulation"
                        data-testid="switch-simulation-practice"
                        checked={draftState.practiceSimulation ?? false}
                        onCheckedChange={(checked) =>
                          setDraftState((prev) => ({
                            ...prev,
                            practiceSimulation: checked,
                          }))
                        }
                        disabled={isReadonly}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground pl-5">
                      Show this simulation on the practice page
                    </p>
                  </div>
                )}
              </div>
            </div>
          </StepCard>
        );
      }

      if (stepId === "scenarios") {
        // Read from urlParams (nuqs-backed state) for search/filter, draftState for selected IDs
        // Note: stepFormData is still needed for setStepFormData calls to GenericForm
        const scenarioShowSelected = urlParams.scenarioShowSelected ?? false;
        const selectedScenarioIds = draftState.scenarioIds || [];
        const scenarioSearch = urlParams.scenarioSearch || "";

        // Filter scenarios: department-based + client-side search/show_selected for immediate UI feedback
        // Note: SQL also filters server-side, but client-side filtering provides immediate feedback
        let filteredScenarios = scenariosArray.filter((scenario) =>
          validScenarioIds.includes(scenario.scenario_id)
        );

        // Apply client-side search filter (for immediate UI feedback while server request is in flight)
        if (scenarioSearch.trim()) {
          const searchLower = scenarioSearch.toLowerCase();
          filteredScenarios = filteredScenarios.filter(
            (scenario) =>
              scenario.name.toLowerCase().includes(searchLower) ||
              (scenario.description || "").toLowerCase().includes(searchLower)
          );
        }

        // Apply client-side "show selected" filter (for immediate UI feedback)
        if (scenarioShowSelected && selectedScenarioIds.length > 0) {
          filteredScenarios = filteredScenarios.filter((scenario) =>
            selectedScenarioIds.includes(scenario.scenario_id)
          );
        }

        // Create filter onChange handler (inline function, not useCallback)
        // Update both stepFormData (for GenericForm) and urlParams (for URL sync)
        const createScenarioFilterOnChange = (value: boolean) => {
          setStepFormData({ scenarioShowSelected: value });
          setUrlParams((prev) => ({
            ...prev,
            scenarioShowSelected: value || null,
          }));
        };

        // Build canRemoveMap
        const scenarioCanRemoveMap: Record<string, boolean> = {};
        if (simulationData?.scenarios) {
          simulationData.scenarios.forEach((scenario) => {
            if (scenario.scenario_id) {
              scenarioCanRemoveMap[scenario.scenario_id] =
                scenario.can_remove ?? false;
            }
          });
        }

        return (
          <StepCard
            stepStatus={stepStatus}
            stepNumber={stepNumber}
            stepTitle={stepTitle}
            stepDescription={stepDescription}
            isReadonly={isReadonly}
            isEditMode={isEditMode}
            searchTerm={scenarioSearch}
            onSearchChange={(term: string) => {
              setStepFormData({ scenarioSearch: term || null });
              setUrlParams((prev) => ({
                ...prev,
                scenarioSearch: term || null,
              }));
            }}
            searchPlaceholder="Search scenarios..."
            debounceMs={300}
            filters={[
              {
                key: "showSelected",
                label: "Show selected",
                value: scenarioShowSelected,
                onChange: createScenarioFilterOnChange,
              },
            ]}
            resetFields={["scenarioSearch", "scenarioShowSelected"]}
            {...(onReset ? { onReset } : {})}
            resetLabel="Reset"
          >
            <SelectableGrid
              items={filteredScenarios}
              selectedId={null}
              selectedIds={selectedScenarioIds}
              onSelect={(scenarioId) => {
                const isSelected = selectedScenarioIds.includes(scenarioId);
                // Prevent unselection if can_remove is false
                if (isSelected && scenarioCanRemoveMap[scenarioId] === false) {
                  return;
                }
                const newIds = isSelected
                  ? selectedScenarioIds.filter((id) => id !== scenarioId)
                  : [...selectedScenarioIds, scenarioId];
                // Update draftState (scenarioIds is draft data, not URL param - don't call setStepFormData)
                setDraftState((prev) => ({ ...prev, scenarioIds: newIds }));
              }}
              getId={(scenario) => scenario.scenario_id}
              renderItem={(scenario, isSelected) => (
                <div
                  className={cn(
                    "relative flex flex-col gap-3 p-4 rounded-xl border bg-card text-card-foreground shadow-sm transition-all text-left",
                    "hover:shadow-md hover:bg-accent/50",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    isSelected && "ring-2 ring-primary bg-accent",
                    isSelected &&
                      scenarioCanRemoveMap[scenario.scenario_id] === false &&
                      "opacity-75 cursor-not-allowed"
                  )}
                >
                  {/* Check icon - top right */}
                  {isSelected && (
                    <div className="absolute top-2 right-2 z-10 h-6 w-6 bg-primary rounded-full flex items-center justify-center">
                      <Check className="h-3.5 w-3.5 text-primary-foreground" />
                    </div>
                  )}

                  <div className="flex items-start gap-3">
                    <FileText className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-sm leading-tight">
                        {scenario.name || "Unnamed Scenario"}
                      </h3>
                      {scenario.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {scenario.description}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
              emptyMessage="No scenarios found. Try adjusting your search or filters."
              disabled={isReadonly}
            />
          </StepCard>
        );
      }

      return null;
    },
    [
      isReadonly,
      isEditMode,
      draftState,
      setDraftState,
      simulationData,
      departmentMapping,
      validAgentIds,
      agentMapping,
      draftId,
      effectiveProfile?.role,
      scenariosArray,
      validScenarioIds,
      urlParams,
      setUrlParams,
    ]
  );

  // Helper function to get scenario settings with defaults
  const getScenarioSettings = useCallback(
    (scenarioId: string) => {
      const simulationScenario = simulationData?.scenarios?.find(
        (s) => s.scenario_id === scenarioId
      );
      return (
        draftState.scenarioSettings[scenarioId] ||
        (simulationScenario
          ? {
              hints_enabled: simulationScenario.hints_enabled ?? false,
              copy_paste_allowed:
                ("copy_paste_allowed" in simulationScenario
                  ? simulationScenario.copy_paste_allowed
                  : false) ?? false,
              audio_enabled:
                ("audio_enabled" in simulationScenario
                  ? simulationScenario.audio_enabled
                  : false) ?? false,
              text_enabled:
                ("text_enabled" in simulationScenario
                  ? simulationScenario.text_enabled
                  : true) ?? true,
              rubric_ids: [],
              grade_agent_ids: [],
              time_limit_seconds: simulationScenario.time_limit_seconds ?? null,
              time_limit_enabled:
                simulationScenario.time_limit_seconds !== null &&
                simulationScenario.time_limit_seconds !== undefined,
            }
          : {
              hints_enabled: false,
              copy_paste_allowed: false,
              audio_enabled: false,
              text_enabled: true,
              rubric_ids: [],
              grade_agent_ids: [],
              time_limit_seconds: null,
              time_limit_enabled: false,
            })
      );
    },
    [draftState.scenarioSettings, simulationData?.scenarios]
  );

  // Content sections for nested scenario management
  const contentSections = useMemo(() => {
    const scenarioIds = draftState.scenarioIds || [];
    if (scenarioIds.length === 0) {
      return [];
    }

    return [
      {
        id: "active-scenarios",
        insertAfter: "scenarios",
        render: ({
          formData: _contentFormData,
          setFormData: _setContentFormData,
        }: {
          formData: Record<string, unknown>;
          setFormData: (updates: Partial<Record<string, unknown>>) => void;
        }) => {
          const activeStates = draftState.scenarioActiveStates;

          return (
            <StepCard
              stepStatus="completed"
              stepNumber={3}
              stepTitle="Active Scenarios"
              stepDescription="Enable or disable scenarios in this simulation."
              isReadonly={isReadonly}
              isEditMode={isEditMode}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {scenarioIds.map((scenarioId) => {
                  const scenario = scenarioMapping[scenarioId];
                  const simulationScenario = simulationData?.scenarios?.find(
                    (s) => s.scenario_id === scenarioId
                  );
                  const active =
                    activeStates[scenarioId] ??
                    simulationScenario?.active ??
                    true;

                  return (
                    <Card key={scenarioId} className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-sm leading-tight truncate">
                            {scenario?.name || "Unnamed Scenario"}
                          </h3>
                          {scenario?.description && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {scenario.description}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 ml-4 shrink-0">
                          <Label
                            htmlFor={`${scenarioId}-active`}
                            className="text-sm flex items-center gap-1.5"
                          >
                            <Power className="h-3.5 w-3.5 text-muted-foreground" />
                          </Label>
                          <Switch
                            id={`${scenarioId}-active`}
                            checked={active}
                            onCheckedChange={(checked) => {
                              setDraftState((prev) => ({
                                ...prev,
                                scenarioActiveStates: {
                                  ...prev.scenarioActiveStates,
                                  [scenarioId]: checked,
                                },
                              }));
                            }}
                            disabled={isReadonly}
                          />
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </StepCard>
          );
        },
      },
      {
        id: "scenario-positions",
        insertAfter: "scenarios",
        render: ({
          formData: _contentFormData,
          setFormData: _setContentFormData,
        }: {
          formData: Record<string, unknown>;
          setFormData: (updates: Partial<Record<string, unknown>>) => void;
        }) => {
          const orderedIds = draftState.scenarioIds || [];

          return (
            <StepCard
              stepStatus="completed"
              stepNumber={4}
              stepTitle="Scenario Positions"
              stepDescription="Reorder scenarios to set their display order."
              isReadonly={isReadonly}
              isEditMode={isEditMode}
            >
              <div className="space-y-2">
                {orderedIds.map((scenarioId, index) => {
                  const scenario = scenarioMapping[scenarioId];
                  const canMoveUp = index > 0;
                  const canMoveDown = index < orderedIds.length - 1;

                  return (
                    <Card key={scenarioId} className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 shrink-0">
                          <GripVertical className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium text-muted-foreground w-6">
                            {index + 1}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-sm leading-tight truncate">
                            {scenario?.name || "Unnamed Scenario"}
                          </h3>
                          {scenario?.description && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {scenario.description}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => {
                              const reorderedIds = [...orderedIds];
                              if (index > 0) {
                                const prev = reorderedIds[index - 1];
                                const curr = reorderedIds[index];
                                if (prev !== undefined && curr !== undefined) {
                                  reorderedIds[index - 1] = curr;
                                  reorderedIds[index] = prev;
                                  setDraftState((prev) => ({
                                    ...prev,
                                    scenarioIds: reorderedIds,
                                  }));
                                }
                              }
                            }}
                            disabled={!canMoveUp || isReadonly}
                          >
                            <ArrowUp className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => {
                              const reorderedIds = [...orderedIds];
                              if (index < orderedIds.length - 1) {
                                const curr = reorderedIds[index];
                                const next = reorderedIds[index + 1];
                                if (curr !== undefined && next !== undefined) {
                                  reorderedIds[index] = next;
                                  reorderedIds[index + 1] = curr;
                                  setDraftState((prev) => ({
                                    ...prev,
                                    scenarioIds: reorderedIds,
                                  }));
                                }
                              }
                            }}
                            disabled={!canMoveDown || isReadonly}
                          >
                            <ArrowDown className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </StepCard>
          );
        },
      },
      {
        id: "hints-settings",
        insertAfter: "scenarios",
        render: ({
          formData: _contentFormData,
          setFormData: _setContentFormData,
        }: {
          formData: Record<string, unknown>;
          setFormData: (updates: Partial<Record<string, unknown>>) => void;
        }) => {
          // Only show if not practice simulation
          if (draftState.practiceSimulation) {
            return null;
          }

          return (
            <StepCard
              stepStatus="completed"
              stepNumber={5}
              stepTitle="Hints Settings"
              stepDescription="Enable or disable hints for each scenario."
              isReadonly={isReadonly}
              isEditMode={isEditMode}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {scenarioIds.map((scenarioId) => {
                  const scenario = scenarioMapping[scenarioId];
                  const settings = getScenarioSettings(scenarioId);

                  return (
                    <Card key={scenarioId} className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-sm leading-tight truncate">
                            {scenario?.name || "Unnamed Scenario"}
                          </h3>
                          {scenario?.description && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {scenario.description}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 ml-4 shrink-0">
                          <Label
                            htmlFor={`${scenarioId}-hints`}
                            className="text-sm flex items-center gap-1.5"
                          >
                            <Lightbulb className="h-3.5 w-3.5 text-muted-foreground" />
                          </Label>
                          <Switch
                            id={`${scenarioId}-hints`}
                            checked={settings.hints_enabled ?? false}
                            onCheckedChange={(checked) => {
                              setDraftState((prev) => ({
                                ...prev,
                                scenarioSettings: {
                                  ...prev.scenarioSettings,
                                  [scenarioId]: {
                                    ...prev.scenarioSettings[scenarioId],
                                    hints_enabled: checked,
                                  },
                                },
                              }));
                            }}
                            disabled={isReadonly}
                          />
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </StepCard>
          );
        },
      },
      {
        id: "copy-paste-settings",
        insertAfter: "scenarios",
        render: ({
          formData: _contentFormData,
          setFormData: _setContentFormData,
        }: {
          formData: Record<string, unknown>;
          setFormData: (updates: Partial<Record<string, unknown>>) => void;
        }) => {
          return (
            <StepCard
              stepStatus="completed"
              stepNumber={6}
              stepTitle="Copy/Paste Settings"
              stepDescription="Enable or disable copy/paste for each scenario (only applies when text is enabled)."
              isReadonly={isReadonly}
              isEditMode={isEditMode}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {scenarioIds.map((scenarioId) => {
                  const scenario = scenarioMapping[scenarioId];
                  const settings = getScenarioSettings(scenarioId);
                  const textEnabled = settings.text_enabled ?? true;

                  return (
                    <Card
                      key={scenarioId}
                      className={cn("p-4", !textEnabled && "opacity-50")}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-sm leading-tight truncate">
                            {scenario?.name || "Unnamed Scenario"}
                          </h3>
                          {scenario?.description && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {scenario.description}
                            </p>
                          )}
                          {!textEnabled && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Text must be enabled
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 ml-4 shrink-0">
                          <Label
                            htmlFor={`${scenarioId}-copy-paste`}
                            className="text-sm flex items-center gap-1.5"
                          >
                            <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                          </Label>
                          <Switch
                            id={`${scenarioId}-copy-paste`}
                            checked={settings.copy_paste_allowed ?? false}
                            onCheckedChange={(checked) => {
                              setDraftState((prev) => ({
                                ...prev,
                                scenarioSettings: {
                                  ...prev.scenarioSettings,
                                  [scenarioId]: {
                                    ...prev.scenarioSettings[scenarioId],
                                    copy_paste_allowed: checked,
                                  },
                                },
                              }));
                            }}
                            disabled={isReadonly || !textEnabled}
                          />
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </StepCard>
          );
        },
      },
      {
        id: "audio-settings",
        insertAfter: "scenarios",
        render: ({
          formData: _contentFormData,
          setFormData: _setContentFormData,
        }: {
          formData: Record<string, unknown>;
          setFormData: (updates: Partial<Record<string, unknown>>) => void;
        }) => {
          return (
            <StepCard
              stepStatus="completed"
              stepNumber={7}
              stepTitle="Audio Settings"
              stepDescription="Enable or disable audio input for each scenario."
              isReadonly={isReadonly}
              isEditMode={isEditMode}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {scenarioIds.map((scenarioId) => {
                  const scenario = scenarioMapping[scenarioId];
                  const settings = getScenarioSettings(scenarioId);

                  return (
                    <Card key={scenarioId} className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-sm leading-tight truncate">
                            {scenario?.name || "Unnamed Scenario"}
                          </h3>
                          {scenario?.description && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {scenario.description}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 ml-4 shrink-0">
                          <Label
                            htmlFor={`${scenarioId}-audio`}
                            className="text-sm flex items-center gap-1.5"
                          >
                            <Mic className="h-3.5 w-3.5 text-muted-foreground" />
                          </Label>
                          <Switch
                            id={`${scenarioId}-audio`}
                            checked={settings.audio_enabled ?? false}
                            onCheckedChange={(checked) => {
                              const currentSettings =
                                getScenarioSettings(scenarioId);
                              const newSettings = {
                                ...currentSettings,
                                audio_enabled: checked,
                              };
                              // If disabling audio and text is also disabled, enable text
                              if (
                                !checked &&
                                !(currentSettings.text_enabled ?? true)
                              ) {
                                newSettings.text_enabled = true;
                              }
                              setDraftState((prev) => ({
                                ...prev,
                                scenarioSettings: {
                                  ...prev.scenarioSettings,
                                  [scenarioId]: newSettings,
                                },
                              }));
                            }}
                            disabled={isReadonly}
                          />
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </StepCard>
          );
        },
      },
      {
        id: "text-settings",
        insertAfter: "scenarios",
        render: ({
          formData: _contentFormData,
          setFormData: _setContentFormData,
        }: {
          formData: Record<string, unknown>;
          setFormData: (updates: Partial<Record<string, unknown>>) => void;
        }) => {
          return (
            <StepCard
              stepStatus="completed"
              stepNumber={8}
              stepTitle="Text Settings"
              stepDescription="Enable or disable text input for each scenario."
              isReadonly={isReadonly}
              isEditMode={isEditMode}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {scenarioIds.map((scenarioId) => {
                  const scenario = scenarioMapping[scenarioId];
                  const settings = getScenarioSettings(scenarioId);

                  return (
                    <Card key={scenarioId} className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-sm leading-tight truncate">
                            {scenario?.name || "Unnamed Scenario"}
                          </h3>
                          {scenario?.description && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {scenario.description}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 ml-4 shrink-0">
                          <Label
                            htmlFor={`${scenarioId}-text`}
                            className="text-sm flex items-center gap-1.5"
                          >
                            <Text className="h-3.5 w-3.5 text-muted-foreground" />
                          </Label>
                          <Switch
                            id={`${scenarioId}-text`}
                            checked={settings.text_enabled ?? true}
                            onCheckedChange={(checked) => {
                              const currentSettings =
                                getScenarioSettings(scenarioId);
                              const newSettings = {
                                ...currentSettings,
                                text_enabled: checked,
                              };
                              // If disabling text and audio is also disabled, enable audio
                              if (
                                !checked &&
                                !(currentSettings.audio_enabled ?? false)
                              ) {
                                newSettings.audio_enabled = true;
                              }
                              setDraftState((prev) => ({
                                ...prev,
                                scenarioSettings: {
                                  ...prev.scenarioSettings,
                                  [scenarioId]: newSettings,
                                },
                              }));
                            }}
                            disabled={isReadonly}
                          />
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </StepCard>
          );
        },
      },
      {
        id: "time-limits",
        insertAfter: "scenarios",
        render: ({
          formData: _contentFormData,
          setFormData: _setContentFormData,
        }: {
          formData: Record<string, unknown>;
          setFormData: (updates: Partial<Record<string, unknown>>) => void;
        }) => {
          return (
            <StepCard
              stepStatus="completed"
              stepNumber={9}
              stepTitle="Time Limits"
              stepDescription="Set time limits (in minutes) for each scenario."
              isReadonly={isReadonly}
              isEditMode={isEditMode}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {scenarioIds.map((scenarioId) => {
                  const scenario = scenarioMapping[scenarioId];
                  const settings = getScenarioSettings(scenarioId);
                  const timeLimitMinutes = settings.time_limit_seconds
                    ? Math.round(settings.time_limit_seconds / 60)
                    : null;
                  // Use time_limit_enabled flag if available, otherwise infer from time_limit_seconds (backward compatibility)
                  const hasTimeLimit =
                    settings.time_limit_enabled !== undefined
                      ? settings.time_limit_enabled
                      : settings.time_limit_seconds !== null &&
                        settings.time_limit_seconds !== undefined;

                  return (
                    <Card key={scenarioId} className="p-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-sm leading-tight truncate">
                              {scenario?.name || "Unnamed Scenario"}
                            </h3>
                            {scenario?.description && (
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                {scenario.description}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 ml-4 shrink-0">
                            <Label
                              htmlFor={`${scenarioId}-time-limit-toggle`}
                              className="text-sm flex items-center gap-1.5"
                            >
                              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                            </Label>
                            <Switch
                              id={`${scenarioId}-time-limit-toggle`}
                              checked={hasTimeLimit}
                              onCheckedChange={(checked) => {
                                setDraftState((prev) => {
                                  const currentSettings =
                                    prev.scenarioSettings[scenarioId] || {};
                                  const newSettings = {
                                    ...prev.scenarioSettings,
                                    [scenarioId]: {
                                      ...currentSettings,
                                      time_limit_enabled: checked,
                                      time_limit_seconds: checked
                                        ? currentSettings.time_limit_seconds ||
                                          60 // Preserve existing value if enabling, default to 60 if none
                                        : null, // Set to null when disabling
                                    },
                                  };
                                  return {
                                    ...prev,
                                    scenarioSettings: newSettings,
                                  };
                                });
                              }}
                              disabled={isReadonly}
                            />
                          </div>
                        </div>
                        {hasTimeLimit && (
                          <Input
                            type="number"
                            min="1"
                            max="120"
                            value={timeLimitMinutes || ""}
                            onChange={(e) => {
                              const minutes =
                                e.target.value === ""
                                  ? null
                                  : parseInt(e.target.value, 10);
                              setDraftState((prev) => {
                                const currentSettings =
                                  prev.scenarioSettings[scenarioId] || {};
                                // If input is empty, set to null but keep time_limit_enabled true (switch stays on)
                                // If input has value, convert to seconds
                                const newTimeLimit =
                                  minutes && minutes > 0 ? minutes * 60 : null;
                                return {
                                  ...prev,
                                  scenarioSettings: {
                                    ...prev.scenarioSettings,
                                    [scenarioId]: {
                                      ...currentSettings,
                                      time_limit_seconds: newTimeLimit,
                                      // Preserve time_limit_enabled flag (don't change it when input changes)
                                      time_limit_enabled:
                                        currentSettings.time_limit_enabled !==
                                        undefined
                                          ? currentSettings.time_limit_enabled
                                          : true, // Default to enabled if not set (backward compatibility)
                                    },
                                  },
                                };
                              });
                            }}
                            placeholder="Enter minutes"
                            disabled={isReadonly}
                            className="w-full"
                          />
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            </StepCard>
          );
        },
      },
      {
        id: "rubric-settings",
        insertAfter: "scenarios",
        render: ({
          formData: _contentFormData,
          setFormData: _setContentFormData,
        }: {
          formData: Record<string, unknown>;
          setFormData: (updates: Partial<Record<string, unknown>>) => void;
        }) => {
          return (
            <StepCard
              stepStatus="completed"
              stepNumber={10}
              stepTitle="Rubric Settings"
              stepDescription="Select rubrics for each scenario."
              isReadonly={isReadonly}
              isEditMode={isEditMode}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {scenarioIds.map((scenarioId) => {
                  const scenario = scenarioMapping[scenarioId];
                  const settings = getScenarioSettings(scenarioId);

                  // Grade agent picker only shows grade agents (no member_agent_id fallback)
                  const gradeAgentIds = validAgentIds.filter((id) => {
                    const agent = agentMapping[id];
                    return agent?.roles?.includes("grade");
                  });
                  const selectedGradeAgentIds = settings.grade_agent_ids || [];
                  // Filter to only valid grade agents
                  const validGradeAgentIds = selectedGradeAgentIds.filter(
                    (id: string) => gradeAgentIds.includes(id)
                  );
                  const selectedRubricIds = settings.rubric_ids || [];

                  return (
                    <Card key={scenarioId} className="p-4">
                      <div className="space-y-3">
                        <h3 className="font-medium text-sm leading-tight truncate">
                          {scenario?.name || "Unnamed Scenario"}
                        </h3>
                        {scenario?.description && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {scenario.description}
                          </p>
                        )}
                        <div className="space-y-2">
                          <Label className="text-xs">
                            Rubrics (Multi-select)
                          </Label>
                          <GenericPicker
                            items={rubricMapping}
                            itemIds={validRubricIds}
                            selectedIds={selectedRubricIds}
                            onSelect={(ids) => {
                              setDraftState((prev) => {
                                const currentSettings =
                                  prev.scenarioSettings[scenarioId] || {};
                                const newSettings = {
                                  ...currentSettings,
                                  rubric_ids: ids.length > 0 ? ids : [],
                                };
                                // Remove old rubric_id field if new format is used
                                if (newSettings.rubric_ids.length > 0) {
                                  delete (
                                    newSettings as { rubric_id?: string | null }
                                  ).rubric_id;
                                }
                                return {
                                  ...prev,
                                  scenarioSettings: {
                                    ...prev.scenarioSettings,
                                    [scenarioId]: newSettings,
                                  },
                                };
                              });
                            }}
                            getId={(item: {
                              id: string;
                              name: string;
                              description?: string;
                            }) => item.id}
                            getLabel={(item: {
                              id: string;
                              name: string;
                              description?: string;
                            }) => item.name || ""}
                            getSearchText={(item: {
                              id: string;
                              name: string;
                              description?: string;
                            }) => `${item.name} ${item.description || ""}`}
                            placeholder="Select rubrics"
                            disabled={isReadonly}
                            multiSelect={true}
                            hideSelectedChips={false}
                            buttonClassName="w-full"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">
                            Grade Agents (Multi-select)
                          </Label>
                          <GenericPicker
                            items={agentMapping}
                            itemIds={gradeAgentIds}
                            selectedIds={validGradeAgentIds}
                            onSelect={(ids) => {
                              setDraftState((prev) => ({
                                ...prev,
                                scenarioSettings: {
                                  ...prev.scenarioSettings,
                                  [scenarioId]: {
                                    ...prev.scenarioSettings[scenarioId],
                                    grade_agent_ids: ids.length > 0 ? ids : [],
                                  },
                                },
                              }));
                            }}
                            getId={(item: {
                              id: string;
                              name: string;
                              description: string;
                              roles?: string[];
                            }) => item.id}
                            getLabel={(item: {
                              id: string;
                              name: string;
                              description: string;
                              roles?: string[];
                            }) => item.name || ""}
                            getSearchText={(item: {
                              id: string;
                              name: string;
                              description: string;
                              roles?: string[];
                            }) => `${item.name} ${item.description || ""}`}
                            placeholder="Select grade agents"
                            disabled={isReadonly}
                            multiSelect={true}
                            hideSelectedChips={false}
                            buttonClassName="w-full"
                          />
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </StepCard>
          );
        },
      },
    ];
  }, [
    draftState.scenarioIds,
    draftState.scenarioActiveStates,
    draftState.practiceSimulation,
    scenarioMapping,
    simulationData?.scenarios,
    rubricMapping,
    validRubricIds,
    agentMapping,
    validAgentIds,
    isReadonly,
    isEditMode,
    getScenarioSettings,
  ]);

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
      <GenericForm
        nuqsParsers={
          simulationSearchParamsClient as Record<string, Parser<unknown>>
        }
        steps={steps}
        getStepStatus={getStepStatus}
        formData={
          formData as unknown as Values<Record<string, Parser<unknown>>>
        }
        setFormData={
          setFormData as unknown as (
            updates:
              | Partial<Values<Record<string, Parser<unknown>>>>
              | ((
                  prev: Values<Record<string, Parser<unknown>>>
                ) => Partial<Values<Record<string, Parser<unknown>>>>)
          ) => void
        }
        serverData={simulationData}
        initializeForm={initializeForm}
        formFieldKeys={["scenarioSearch", "scenarioShowSelected"]}
        resetSuccessMessage={(stepId) => {
          if (stepId === "basic") return "Basic information reset";
          if (stepId === "scenarios") return "Scenarios reset";
          return `${stepId} reset`;
        }}
        onSubmit={handleSubmit}
        submitButton={{
          createLabel: "Create Simulation",
          updateLabel: "Update Simulation",
          backUrl: "/create/simulations",
          backLabel: "Back",
        }}
        isReadonly={isReadonly}
        isEditMode={isEditMode}
        renderStep={renderStep}
        contentSections={contentSections}
      />
    </div>
  );
}
