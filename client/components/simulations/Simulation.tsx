/**
 * Simulation.tsx
 * Implementation using modular resource components
 * Used to create and manage simulations - supports both creation and editing
 * Follows Persona.tsx patterns for consistency
 */
"use client";

import { useRouter } from "next/navigation";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  GenericForm,
  type StepStatus,
} from "@/components/common/forms/GenericForm";
import { StepCard } from "@/components/common/forms/StepCard";
import type { GenerateRegenerateModalResource } from "@/components/common/GenerateRegenerateModal";
import { GenerateRegenerateModal } from "@/components/common/GenerateRegenerateModal";
import { ReadOnlyBanner } from "@/components/common/ReadOnlyBanner";
import { Departments } from "@/components/resources/Departments";
import { Descriptions } from "@/components/resources/Descriptions";
import { Flags } from "@/components/resources/Flags";
import { Names } from "@/components/resources/Names";
import { ScenarioFlags } from "@/components/resources/ScenarioFlags";
import { ScenarioPositions } from "@/components/resources/ScenarioPositions";
import { Scenarios } from "@/components/resources/Scenarios";
import { Rubrics } from "@/components/resources/Rubrics";
import { Times } from "@/components/resources/Times";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Loader2, Sparkles } from "lucide-react";

import { useBreadcrumbContext } from "@/contexts/breadcrumb-context";
import { useGenerationContext } from "@/contexts/generation-context";
import { useProfile } from "@/contexts/profile-context";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { ResourceType } from "@/lib/resources/types";
import { parseAsBoolean, parseAsString, type Parser } from "nuqs";

// Types defined inline using InputOf/OutputOf
type SaveSimulationIn = InputOf<"/api/v4/simulations/save", "post">;
type SaveSimulationOut = OutputOf<"/api/v4/simulations/save", "post">;
type CreateDraftNamesIn = InputOf<"/api/v4/resources/names", "post">;
type CreateDraftNamesOut = OutputOf<"/api/v4/resources/names", "post">;
type CreateDraftDescriptionsIn = InputOf<
  "/api/v4/resources/descriptions",
  "post"
>;
type CreateDraftDescriptionsOut = OutputOf<
  "/api/v4/resources/descriptions",
  "post"
>;
type CreateDraftFlagsIn = InputOf<"/api/v4/resources/flags", "post">;
type CreateDraftFlagsOut = OutputOf<"/api/v4/resources/flags", "post">;
type CreateDraftDepartmentsIn = InputOf<
  "/api/v4/resources/departments",
  "post"
>;
type CreateDraftDepartmentsOut = OutputOf<
  "/api/v4/resources/departments",
  "post"
>;
type CreateDraftScenariosIn = InputOf<"/api/v4/resources/scenarios", "post">;
type CreateDraftScenariosOut = OutputOf<"/api/v4/resources/scenarios", "post">;
type CreateDraftRubricsIn = InputOf<"/api/v4/resources/rubrics", "post">;
type CreateDraftRubricsOut = OutputOf<"/api/v4/resources/rubrics", "post">;
type CreateDraftScenarioFlagsIn = InputOf<
  "/api/v4/resources/simulation_scenario_flags",
  "post"
>;
type CreateDraftScenarioFlagsOut = OutputOf<
  "/api/v4/resources/simulation_scenario_flags",
  "post"
>;
type CreateDraftScenarioPositionsIn = InputOf<
  "/api/v4/resources/scenario_positions",
  "post"
>;
type CreateDraftScenarioPositionsOut = OutputOf<
  "/api/v4/resources/scenario_positions",
  "post"
>;
type CreateDraftScenarioRubricGradeAgentsIn = InputOf<
  "/api/v4/resources/scenario_rubric_grade_agents",
  "post"
>;
type CreateDraftScenarioRubricGradeAgentsOut = OutputOf<
  "/api/v4/resources/scenario_rubric_grade_agents",
  "post"
>;
type PatchSimulationDraftIn = InputOf<"/api/v4/simulations/draft", "patch">;
type PatchSimulationDraftOut = OutputOf<"/api/v4/simulations/draft", "patch">;

type SimulationData = OutputOf<"/api/v4/simulations/get", "post">;
type SimulationResourceType = ResourceType | "scenario_rubrics" | "scenario_time_limits";

export interface SimulationProps {
  simulationId?: string;
  // Server-provided data (for server-side rendering)
  simulationData?: SimulationData;
  // Server actions (replaces useMutation)
  saveSimulationAction?: (
    input: SaveSimulationIn
  ) => Promise<SaveSimulationOut>;
  patchSimulationDraftAction?: (
    input: PatchSimulationDraftIn
  ) => Promise<PatchSimulationDraftOut>;
  // Resource creation actions
  createNamesAction?: (
    input: CreateDraftNamesIn
  ) => Promise<CreateDraftNamesOut>;
  createDescriptionsAction?: (
    input: CreateDraftDescriptionsIn
  ) => Promise<CreateDraftDescriptionsOut>;
  createFlagsAction?: (
    input: CreateDraftFlagsIn
  ) => Promise<CreateDraftFlagsOut>;
  createDepartmentsAction?: (
    input: CreateDraftDepartmentsIn
  ) => Promise<CreateDraftDepartmentsOut>;
  createScenariosAction?: (
    input: CreateDraftScenariosIn
  ) => Promise<CreateDraftScenariosOut>;
  createRubricsAction?: (
    input: CreateDraftRubricsIn
  ) => Promise<CreateDraftRubricsOut>;
  createScenarioFlagsAction?: (
    input: CreateDraftScenarioFlagsIn
  ) => Promise<CreateDraftScenarioFlagsOut>;
  createScenarioPositionsAction?: (
    input: CreateDraftScenarioPositionsIn
  ) => Promise<CreateDraftScenarioPositionsOut>;
  createScenarioRubricGradeAgentsAction?: (
    input: CreateDraftScenarioRubricGradeAgentsIn
  ) => Promise<CreateDraftScenarioRubricGradeAgentsOut>;
}

function SimulationComponent({
  simulationId,
  simulationData,
  saveSimulationAction,
  patchSimulationDraftAction,
  createNamesAction,
  createDescriptionsAction,
  createFlagsAction,
  createDepartmentsAction,
  createScenariosAction,
  createRubricsAction,
  createScenarioFlagsAction,
  createScenarioPositionsAction,
}: SimulationProps) {
  const router = useRouter();
  const isEditMode = !!simulationId;
  const {
    effectiveProfile,
    selectedDraftId,
    setSelectedDraftId,
    socket,
    isConnected,
  } = useProfile();
  const { setEntityMetadata, clearEntityMetadata } = useBreadcrumbContext();
  const { setGenerationCapability, clearGenerationCapability } =
    useGenerationContext();

  // Generation state for AI workflows - simplified using ResourceType
  const [generatingResources, setGeneratingResources] = useState<
    Set<SimulationResourceType>
  >(new Set());

  // Modal state for generate/regenerate
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [modalMode, setModalMode] = useState<"generate" | "regenerate" | null>(
    null
  );
  const [modalResources, setModalResources] = useState<
    GenerateRegenerateModalResource[]
  >([]);
  const [modalInstructions, setModalInstructions] = useState("");

  const isGenerating = useCallback(
    (resourceType: SimulationResourceType) =>
      generatingResources.has(resourceType),
    [generatingResources]
  );

  // nuqs parsers for URL-backed state (will be passed to GenericForm)
  // Memoize to prevent new object reference on every render
  const simulationSearchParamsClient = useMemo(
    () => ({
      // Draft ID (URL-backed, updated when draft is created)
      draftId: parseAsString,
      // Search params (URL-backed, updated via debounced callback in StepCard)
      descriptionSearch: parseAsString,
      scenarioSearch: parseAsString,
      // Filter params (URL-backed)
      scenarioShowSelected: parseAsBoolean,
    }),
    []
  );

  // Local form state (not in URL) - stores only resource IDs
  // Display values are managed inside resource components
  // Use ref to store simulationData to prevent callback recreation on every render
  const simulationDataRef = React.useRef(simulationData);
  React.useEffect(() => {
    simulationDataRef.current = simulationData;
  }, [simulationData]);

  // Memoize simulationData fields used in renderStep to prevent callback recreation
  // when only object reference changes (but content is same)
  const stableSimulationDataFields = React.useMemo(() => {
    if (!simulationData) return null;
    return {
      group_id: simulationData.group_id,
      name_resource: simulationData.name_resource,
      show_name: simulationData.show_name,
      name_suggestions: simulationData.name_suggestions,
      names: simulationData.names,
      name_required: simulationData.name_required,
      name_agent_id: simulationData.name_agent_id,
      description_resource: simulationData.description_resource,
      show_description: simulationData.show_description,
      description_suggestions: simulationData.description_suggestions,
      description_required: simulationData.description_required,
      description_agent_id: simulationData.description_agent_id,
      descriptions: simulationData.descriptions,
      department_resources: simulationData.department_resources,
      show_departments: simulationData.show_departments,
      department_suggestions: simulationData.department_suggestions,
      departments_required: simulationData.departments_required,
      departments_agent_id: simulationData.departments_agent_id,
      departments: simulationData.departments,
      flag_resource: simulationData.flag_resource,
      show_flag: simulationData.show_flag,
      flag_required: simulationData.flag_required,
      flag_agent_id: simulationData.flag_agent_id,
      flags: simulationData.flags,
      scenario_ids: simulationData.scenario_ids,
      scenario_resources: simulationData.scenario_resources,
      show_scenarios: simulationData.show_scenarios,
      scenarios_agent_id: simulationData.scenarios_agent_id,
      scenarios_required: simulationData.scenarios_required,
      scenario_suggestions: simulationData.scenario_suggestions,
      scenarios: simulationData.scenarios,
      scenario_flag_ids: simulationData.scenario_flag_ids,
      scenario_flag_resources: simulationData.scenario_flag_resources,
      show_scenario_flags: simulationData.show_scenario_flags,
      scenario_flags_agent_id: simulationData.scenario_flags_agent_id,
      scenario_flags_required: simulationData.scenario_flags_required,
      scenario_flag_suggestions: simulationData.scenario_flag_suggestions,
      scenario_flags: simulationData.scenario_flags,
      scenario_position_ids: simulationData.scenario_position_ids,
      scenario_position_resources: simulationData.scenario_position_resources,
      show_scenario_positions: simulationData.show_scenario_positions,
      scenario_positions_agent_id: simulationData.scenario_positions_agent_id,
      scenario_positions_required: simulationData.scenario_positions_required,
      scenario_position_suggestions:
        simulationData.scenario_position_suggestions,
      scenario_positions: simulationData.scenario_positions,
      scenario_rubric_ids: simulationData.scenario_rubric_ids,
      scenario_rubric_resources: simulationData.scenario_rubric_resources,
      show_scenario_rubrics: simulationData.show_scenario_rubrics,
      scenario_rubrics_agent_id: simulationData.scenario_rubrics_agent_id,
      scenario_rubrics_required: simulationData.scenario_rubrics_required,
      scenario_rubric_suggestions: simulationData.scenario_rubric_suggestions,
      scenario_rubrics: simulationData.scenario_rubrics,
      scenario_time_limit_ids: simulationData.scenario_time_limit_ids,
      scenario_time_limit_resources:
        simulationData.scenario_time_limit_resources,
      show_scenario_time_limits: simulationData.show_scenario_time_limits,
      scenario_time_limits_agent_id: simulationData.scenario_time_limits_agent_id,
      scenario_time_limits_required: simulationData.scenario_time_limits_required,
      scenario_time_limit_suggestions:
        simulationData.scenario_time_limit_suggestions,
      scenario_time_limits: simulationData.scenario_time_limits,
      general_agent_id: simulationData.general_agent_id,
    };
    // Intentionally depend on individual fields, not whole simulationData object
    // to prevent recreation when only object reference changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    simulationData?.group_id,
    simulationData?.name_resource,
    simulationData?.show_name,
    simulationData?.name_suggestions,
    simulationData?.names,
    simulationData?.name_required,
    simulationData?.name_agent_id,
    simulationData?.description_resource,
    simulationData?.show_description,
    simulationData?.description_suggestions,
    simulationData?.description_required,
    simulationData?.description_agent_id,
    simulationData?.descriptions,
    simulationData?.department_resources,
    simulationData?.show_departments,
    simulationData?.department_suggestions,
    simulationData?.departments_required,
    simulationData?.departments_agent_id,
    simulationData?.departments,
    simulationData?.flag_resource,
    simulationData?.show_flag,
    simulationData?.flag_required,
    simulationData?.flag_agent_id,
    simulationData?.flags,
    simulationData?.scenario_ids,
    simulationData?.scenario_resources,
    simulationData?.show_scenarios,
    simulationData?.scenarios_agent_id,
    simulationData?.scenarios_required,
    simulationData?.scenario_suggestions,
    simulationData?.scenarios,
    simulationData?.scenario_flag_ids,
    simulationData?.scenario_flag_resources,
    simulationData?.show_scenario_flags,
    simulationData?.scenario_flags_agent_id,
    simulationData?.scenario_flags_required,
    simulationData?.scenario_flag_suggestions,
    simulationData?.scenario_flags,
    simulationData?.scenario_position_ids,
    simulationData?.scenario_position_resources,
    simulationData?.show_scenario_positions,
    simulationData?.scenario_positions_agent_id,
    simulationData?.scenario_positions_required,
    simulationData?.scenario_position_suggestions,
    simulationData?.scenario_positions,
    simulationData?.scenario_rubric_ids,
    simulationData?.scenario_rubric_resources,
    simulationData?.show_scenario_rubrics,
    simulationData?.scenario_rubrics_agent_id,
    simulationData?.scenario_rubrics_required,
    simulationData?.scenario_rubric_suggestions,
    simulationData?.scenario_rubrics,
    simulationData?.scenario_time_limit_ids,
    simulationData?.scenario_time_limit_resources,
    simulationData?.show_scenario_time_limits,
    simulationData?.scenario_time_limits_agent_id,
    simulationData?.scenario_time_limits_required,
    simulationData?.scenario_time_limit_suggestions,
    simulationData?.scenario_time_limits,
    simulationData?.general_agent_id,
  ]);

  // Helper to check if a resource type can be regenerated
  // Use stableSimulationDataFields to prevent callback recreation when simulationData object reference changes
  const canRegenerate = useCallback(
    (resourceType: SimulationResourceType): boolean => {
      if (!stableSimulationDataFields) return false;
      switch (resourceType) {
        case "names":
          return stableSimulationDataFields.name_resource?.generated ?? false;
        case "descriptions":
          return (
            stableSimulationDataFields.description_resource?.generated ?? false
          );
        case "flags":
          return stableSimulationDataFields.flag_resource?.generated ?? false;
        case "departments":
          return (
            stableSimulationDataFields.department_resources?.some(
              (d) => d.generated
            ) ?? false
          );
        case "scenarios":
          return (
            stableSimulationDataFields.scenario_resources?.some(
              (s) => s.generated
            ) ?? false
          );
        case "scenario_flags":
          return (
            stableSimulationDataFields.scenario_flag_resources?.some(
              (f) => f.generated
            ) ?? false
          );
        case "scenario_positions":
          return (
            stableSimulationDataFields.scenario_position_resources?.some(
              (p) => p.generated
            ) ?? false
          );
        case "scenario_rubrics":
          return (
            stableSimulationDataFields.scenario_rubric_resources?.some(
              (r) => r.generated
            ) ?? false
          );
        case "scenario_time_limits":
          return (
            stableSimulationDataFields.scenario_time_limit_resources?.some(
              (t) => t.generated
            ) ?? false
          );
        default:
          return false;
      }
    },
    [stableSimulationDataFields]
  );

  const getInitialFormState = useCallback(() => {
    const data = simulationDataRef.current;
    if (!data) {
      return {
        name_id: null as string | null,
        description_id: null as string | null,
        active_flag_id: null as string | null,
        department_ids: [] as string[],
        scenario_ids: [] as string[],
        scenario_flag_ids: [] as string[],
        scenario_position_ids: [] as string[],
        scenario_rubric_ids: [] as string[],
        scenario_time_limit_ids: [] as string[],
      };
    }
    // Extract resource IDs from server data
    // Note: Server data may have display values, but we only store IDs here
    return {
      name_id: data.name_id ?? null,
      description_id: data.description_id ?? null,
      active_flag_id: data.active_flag_id ?? null,
      department_ids: data.department_ids ?? [],
      scenario_ids: data.scenario_ids ?? [],
      scenario_flag_ids: data.scenario_flag_ids ?? [],
      scenario_position_ids: data.scenario_position_ids ?? [],
      scenario_rubric_ids: data.scenario_rubric_ids ?? [],
      scenario_time_limit_ids: data.scenario_time_limit_ids ?? [],
    };
    // Remove simulationData from dependencies - use ref instead to prevent callback recreation
  }, []);

  const [formState, setFormState] = useState(getInitialFormState);
  // Use ref to access formState in renderStep without depending on it
  const formStateRef = React.useRef(formState);
  React.useEffect(() => {
    formStateRef.current = formState;
  }, [formState]);

  // Memoize stringified array dependencies to prevent effect from running when array references change but content is same
  const departmentIdsStr = React.useMemo(
    () => JSON.stringify(simulationData?.department_ids ?? []),
    [simulationData?.department_ids]
  );

  // Memoize stringified formState arrays for draft listener effect dependencies
  const formStateDepartmentIdsStr = React.useMemo(
    () => JSON.stringify(formState.department_ids),
    [formState.department_ids]
  );
  const formStateScenarioIdsStr = React.useMemo(
    () => JSON.stringify(formState.scenario_ids),
    [formState.scenario_ids]
  );

  // Update form state when server data changes
  // Use simulationData directly in dependency array, not getInitialFormState
  useEffect(() => {
    const newState = getInitialFormState();
    setFormState((prev) => {
      // Only update if resource IDs actually changed
      if (
        prev.name_id !== newState.name_id ||
        prev.description_id !== newState.description_id ||
        prev.active_flag_id !== newState.active_flag_id ||
        JSON.stringify(prev.department_ids) !==
          JSON.stringify(newState.department_ids) ||
        JSON.stringify(prev.scenario_ids) !==
          JSON.stringify(newState.scenario_ids) ||
        JSON.stringify(prev.scenario_flag_ids) !==
          JSON.stringify(newState.scenario_flag_ids) ||
        JSON.stringify(prev.scenario_position_ids) !==
          JSON.stringify(newState.scenario_position_ids) ||
        JSON.stringify(prev.scenario_rubric_ids) !==
          JSON.stringify(newState.scenario_rubric_ids) ||
        JSON.stringify(prev.scenario_time_limit_ids) !==
          JSON.stringify(newState.scenario_time_limit_ids)
      ) {
        return newState;
      }
      return prev;
    });
    // Use stringified arrays in dependencies to prevent effect from running when array references change but content is same
    // Intentionally exclude formState and getInitialFormState to prevent infinite loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    simulationData?.name_id,
    simulationData?.description_id,
    simulationData?.active_flag_id,
    departmentIdsStr,
    JSON.stringify(simulationData?.scenario_ids ?? []),
    JSON.stringify(simulationData?.scenario_flag_ids ?? []),
    JSON.stringify(simulationData?.scenario_position_ids ?? []),
    JSON.stringify(simulationData?.scenario_rubric_ids ?? []),
    JSON.stringify(simulationData?.scenario_time_limit_ids ?? []),
  ]);

  // Draft version tracking for optimistic concurrency control
  // Keep version in a ref so updating it doesn't retrigger the effect
  const [lastSavedVersion, setLastSavedVersion] = useState(0);
  const lastSavedVersionRef = React.useRef(0);
  React.useEffect(() => {
    lastSavedVersionRef.current = lastSavedVersion;
  }, [lastSavedVersion]);

  // Get draftId from GenericForm's URL state via bridge (GenericForm is single source of truth)
  const [draftId, setDraftId] = useState<string | null>(null);
  const setUrlFormDataRef = React.useRef<
    null | ((updates: Record<string, unknown>) => void)
  >(null);

  // Store formData from GenericForm to access search params
  const formDataRef = React.useRef<Record<string, unknown>>({});

  // Memoized callback to sync draftId from GenericForm - only update if value changed
  const onFormDataChange = React.useCallback((fd: Record<string, unknown>) => {
    // Store formData for access in handleGenerateResources
    formDataRef.current = fd;
    const next = (fd["draftId"] as string | undefined) ?? null;
    setDraftId((prev) => (prev === next ? prev : next));
  }, []);

  // Sync URL draftId to profile context
  useEffect(() => {
    if (draftId !== selectedDraftId) {
      setSelectedDraftId(draftId);
    }
  }, [draftId, selectedDraftId, setSelectedDraftId]);

  // Use ref to stabilize patchSimulationDraftAction to prevent effect recreation when prop reference changes
  const patchSimulationDraftActionRef = React.useRef(
    patchSimulationDraftAction
  );
  React.useEffect(() => {
    patchSimulationDraftActionRef.current = patchSimulationDraftAction;
  }, [patchSimulationDraftAction]);

  // Build a stable key for "what would we patch" - only changes when form data actually changes
  const draftPatchKey = React.useMemo(() => {
    return JSON.stringify({
      draftId: draftId || null,
      name_id: formState.name_id,
      description_id: formState.description_id,
      active_flag_id: formState.active_flag_id,
      department_ids: formState.department_ids,
      scenario_ids: formState.scenario_ids,
    });
    // Use stringified arrays to prevent recreation when array references change but content is same
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    draftId,
    formState.name_id,
    formState.description_id,
    formState.active_flag_id,
    formStateDepartmentIdsStr,
    formStateScenarioIdsStr,
  ]);

  // Track last patched payload so we don't repatch identical state
  const lastPatchedKeyRef = React.useRef<string | null>(null);

  // Draft change listener - watches resource IDs and patches draft
  // Only triggers when the payload actually changes, not when version changes
  useEffect(() => {
    const hasResourceIds =
      formState.name_id ||
      formState.description_id ||
      formState.active_flag_id ||
      formState.department_ids.length > 0 ||
      formState.scenario_ids.length > 0;

    if (!hasResourceIds || !patchSimulationDraftActionRef.current) {
      return;
    }

    // ✅ If nothing changed since the last successful patch, do nothing.
    if (lastPatchedKeyRef.current === draftPatchKey) {
      return;
    }

    const timer = setTimeout(async () => {
      try {
        if (!patchSimulationDraftActionRef.current) return;
        const result = await patchSimulationDraftActionRef.current({
          body: {
            input_draft_id: draftId || null,
            name_id: formState.name_id,
            description_id: formState.description_id,
            active_flag_id: formState.active_flag_id,
            department_ids: formState.department_ids,
            scenario_ids: formState.scenario_ids,
            expected_version: lastSavedVersionRef.current, // ✅ ref, not state dep
          },
        });

        // Mark this payload as patched so we don't loop
        lastPatchedKeyRef.current = draftPatchKey;

        if (!draftId && result.draft_id) {
          // Update URL when draft is created via GenericForm bridge (GenericForm owns URL state)
          setUrlFormDataRef.current?.({ draftId: result.draft_id });
        }

        // This can stay as state (for UI), but it won't re-trigger patching
        // because the effect is gated by payload changes.
        if ((result.new_version ?? 0) !== lastSavedVersionRef.current) {
          setLastSavedVersion(result.new_version ?? 0);
          lastSavedVersionRef.current = result.new_version ?? 0;
        }
      } catch {
        // Failed to save draft - error already logged by API
        // Don't update lastPatchedKeyRef on failure so we retry on next change
      }
    }, 1000);

    return () => clearTimeout(timer);
    // ✅ Trigger only when payload changes, not when version changes
    // patchSimulationDraftAction and setDraftId are accessed via refs to prevent effect recreation
    // when prop/function references change but functionality is the same
    // We access formState fields and draftId inside the effect, but depend on draftPatchKey
    // to prevent unnecessary effect recreation when individual fields change but payload is same
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    draftPatchKey, // ✅ trigger only when payload changes
    // patchSimulationDraftAction and setDraftId are accessed via refs
  ]);

  // WebSocket handlers for AI generation - unified handler for all resource types
  useEffect(() => {
    if (!socket || !isConnected) return;

    // Use single group_id from simulationData (no need to track multiple)
    const currentGroupId = simulationData?.group_id;

    const handleGenerationComplete = (data: {
      artifact_type?: string;
      group_id?: string;
      resource_type?: string;
      name_id?: string | null;
      description_id?: string | null;
      active_flag_id?: string | null;
      department_ids?: string[];
      scenario_ids?: string[];
      scenario_flag_ids?: string[];
      scenario_position_ids?: string[];
      scenario_rubric_ids?: string[];
      scenario_time_limit_ids?: string[];
      message?: string;
      success?: boolean;
      [key: string]: unknown;
    }) => {
      // Filter by artifact_type and group_id
      if (
        data.artifact_type !== "simulation" ||
        !data.group_id ||
        data.group_id !== currentGroupId
      ) {
        return; // Not for this simulation or wrong group_id
      }

      const validResourceTypes: SimulationResourceType[] = [
        "names",
        "descriptions",
        "flags",
        "departments",
        "scenarios",
        "scenario_flags",
        "scenario_positions",
        "scenario_rubrics",
        "scenario_time_limits",
      ];
      if (
        data.resource_type &&
        validResourceTypes.includes(data.resource_type as SimulationResourceType)
      ) {
        // Update formState with the resource ID that was generated
        // Only update the field that matches resource_type (others will be null)
        setFormState((prev) => {
          const updates: Partial<typeof prev> = {};

          if (data.name_id) updates.name_id = data.name_id;
          if (data.description_id) updates.description_id = data.description_id;
          if (data.active_flag_id) updates.active_flag_id = data.active_flag_id;
          if (data.department_ids && data.department_ids.length > 0) {
            // For arrays, append new IDs (avoid duplicates)
            const newDeptIds = data.department_ids.filter(
              (id) => !prev.department_ids.includes(id)
            );
            updates.department_ids = [...prev.department_ids, ...newDeptIds];
          }
          if (data.scenario_ids && data.scenario_ids.length > 0) {
            // For arrays, append new IDs (avoid duplicates)
            const newScenarioIds = data.scenario_ids.filter(
              (id) => !prev.scenario_ids.includes(id)
            );
            updates.scenario_ids = [...prev.scenario_ids, ...newScenarioIds];
          }
          if (data.scenario_flag_ids && data.scenario_flag_ids.length > 0) {
            // For arrays, append new IDs (avoid duplicates)
            const newScenarioFlagIds = data.scenario_flag_ids.filter(
              (id) => !prev.scenario_flag_ids.includes(id)
            );
            updates.scenario_flag_ids = [
              ...prev.scenario_flag_ids,
              ...newScenarioFlagIds,
            ];
          }
          if (
            data.scenario_position_ids &&
            data.scenario_position_ids.length > 0
          ) {
            // For arrays, append new IDs (avoid duplicates)
            const newScenarioPositionIds = data.scenario_position_ids.filter(
              (id) => !prev.scenario_position_ids.includes(id)
            );
            updates.scenario_position_ids = [
              ...prev.scenario_position_ids,
              ...newScenarioPositionIds,
            ];
          }
          if (data.scenario_rubric_ids && data.scenario_rubric_ids.length > 0) {
            // For arrays, append new IDs (avoid duplicates)
            const newScenarioRubricIds = data.scenario_rubric_ids.filter(
              (id) => !prev.scenario_rubric_ids.includes(id)
            );
            updates.scenario_rubric_ids = [
              ...prev.scenario_rubric_ids,
              ...newScenarioRubricIds,
            ];
          }
          if (
            data.scenario_time_limit_ids &&
            data.scenario_time_limit_ids.length > 0
          ) {
            // For arrays, append new IDs (avoid duplicates)
            const newScenarioTimeLimitIds = data.scenario_time_limit_ids.filter(
              (id) => !prev.scenario_time_limit_ids.includes(id)
            );
            updates.scenario_time_limit_ids = [
              ...prev.scenario_time_limit_ids,
              ...newScenarioTimeLimitIds,
            ];
          }

          // Only update if there are actual changes
          if (Object.keys(updates).length === 0) {
            return prev;
          }

          return { ...prev, ...updates };
        });

        // Remove from generating set
        setGeneratingResources((prev) => {
          const next = new Set(prev);
          if (data.resource_type) {
            next.delete(data.resource_type as SimulationResourceType);
          }
          return next;
        });

        if (data.success !== false) {
          toast.success(
            data.message || `${data.resource_type} generated successfully`
          );
        } else {
          toast.error(
            data.message || `Failed to generate ${data.resource_type}`
          );
        }
      }
    };

    const handleGenerationProgress = (data: {
      artifact_type?: string;
      group_id?: string;
      resource_type?: string;
      [key: string]: unknown;
    }) => {
      // Filter by artifact_type and group_id
      if (
        data.artifact_type !== "simulation" ||
        !data.group_id ||
        data.group_id !== currentGroupId
      ) {
        return; // Not for this simulation or wrong group_id
      }
      // Handle progress updates if needed
    };

    const handleGenerationError = (data: {
      artifact_type?: string;
      group_id?: string;
      resource_type?: string;
      resource_types?: string[];
      message?: string;
      [key: string]: unknown;
    }) => {
      if (
        data.artifact_type !== "simulation" ||
        !data.group_id ||
        data.group_id !== currentGroupId
      ) {
        return;
      }

      const validResourceTypes: SimulationResourceType[] = [
        "names",
        "descriptions",
        "flags",
        "departments",
        "scenarios",
        "scenario_flags",
        "scenario_positions",
        "scenario_rubrics",
        "scenario_time_limits",
      ];
      const resourceTypes =
        data.resource_types || (data.resource_type ? [data.resource_type] : []);
      setGeneratingResources((prev) => {
        const next = new Set(prev);
        resourceTypes.forEach((rt) => {
          if (validResourceTypes.includes(rt as SimulationResourceType)) {
            next.delete(rt as SimulationResourceType);
          }
        });
        return next;
      });
      toast.error(data.message || "Generation failed");
    };

    // Listen to simulation-specific events filtered by artifact_type and group_id
    socket.on("simulation_generation_progress", handleGenerationProgress);
    socket.on("simulation_generation_complete", handleGenerationComplete);
    socket.on("simulation_generation_error", handleGenerationError);

    return () => {
      socket.off("simulation_generation_progress", handleGenerationProgress);
      socket.off("simulation_generation_complete", handleGenerationComplete);
      socket.off("simulation_generation_error", handleGenerationError);
    };
  }, [socket, isConnected, simulationData?.group_id]);

  // Determine agent type for generation (simplified for simulations)
  const determineAgentType = useCallback(
    (resourceTypes: SimulationResourceType[]): string | null => {
      const allResourceTypes: SimulationResourceType[] = [
        "names",
        "descriptions",
        "departments",
        "flags",
        "scenarios",
        "scenario_flags",
        "scenario_positions",
        "scenario_rubrics",
        "scenario_time_limits",
      ];

      const isAllResources =
        resourceTypes.length === allResourceTypes.length &&
        resourceTypes.every((rt) => allResourceTypes.includes(rt));

      if (isAllResources) {
        return "general";
      } else if (resourceTypes.length === 1) {
        // Single resource type - map to agent_type
        const agentTypeMap: Record<SimulationResourceType, string> = {
          names: "name",
          descriptions: "description",
          departments: "departments",
          flags: "flags",
          scenarios: "scenarios",
          scenario_flags: "scenario_flags",
          scenario_positions: "scenario_positions",
          scenario_rubrics: "scenario_rubrics",
          scenario_time_limits: "scenario_time_limits",
          // Not used for simulations but needed for type safety
          colors: "color",
          icons: "icon",
          instructions: "instructions",
          fields: "fields",
          examples: "examples",
        };
        const firstType = resourceTypes[0];
        if (firstType && firstType in agentTypeMap) {
          return agentTypeMap[firstType];
        }
      }
      return null;
    },
    []
  );

  const handleGenerateResources = useCallback(
    async (
      resourceTypes: SimulationResourceType[],
      agentType: string | null,
      userInstructions?: string
    ) => {
      if (!socket || !isConnected) {
        toast.error("WebSocket not connected");
        return;
      }

      // Set all resources as generating
      setGeneratingResources((prev) => {
        const next = new Set(prev);
        resourceTypes.forEach((rt) => next.add(rt));
        return next;
      });

      // Read search params from formData
      const formData = formDataRef.current;
      const draftId = (formData["draftId"] as string | undefined) ?? null;
      const descriptionSearch =
        (formData["descriptionSearch"] as string | undefined) ?? null;
      const scenarioSearch =
        (formData["scenarioSearch"] as string | undefined) ?? null;
      const scenarioShowSelected =
        (formData["scenarioShowSelected"] as boolean | undefined) ?? false;
      const filterScenarioIds =
        (formData["filterScenarioIds"] as string[] | undefined) ?? null;

      // Emit simulation_generate event with GetSimulationApiRequest fields
      socket.emit("simulation_generate", {
        resource_types: resourceTypes, // Simple array of strings
        agent_type: agentType,
        user_instructions: userInstructions ? [userInstructions] : null,
        // GetSimulationApiRequest fields from formData
        draft_id: draftId || null,
        scenario_search: scenarioSearch || null,
        scenario_show_selected: scenarioShowSelected || false,
        filter_scenario_ids: filterScenarioIds || null,
        simulation_id: simulationId || null,
        mcp: false,
      });
    },
    [socket, isConnected, simulationId]
  );

  // Individual generation handlers - generate directly without modals
  const handleGenerateName = useCallback(
    async () =>
      handleGenerateResources(["names"], determineAgentType(["names"])),
    [handleGenerateResources, determineAgentType]
  );

  const handleGenerateDescription = useCallback(
    async () =>
      handleGenerateResources(
        ["descriptions"],
        determineAgentType(["descriptions"])
      ),
    [handleGenerateResources, determineAgentType]
  );

  const handleGenerateDepartments = useCallback(
    async () =>
      handleGenerateResources(
        ["departments"],
        determineAgentType(["departments"])
      ),
    [handleGenerateResources, determineAgentType]
  );

  const handleGenerateFlags = useCallback(
    async () =>
      handleGenerateResources(["flags"], determineAgentType(["flags"])),
    [handleGenerateResources, determineAgentType]
  );

  const handleGenerateScenarios = useCallback(
    async () =>
      handleGenerateResources(["scenarios"], determineAgentType(["scenarios"])),
    [handleGenerateResources, determineAgentType]
  );

  const handleGenerateScenarioFlags = useCallback(
    async () =>
      handleGenerateResources(
        ["scenario_flags"],
        determineAgentType(["scenario_flags"])
      ),
    [handleGenerateResources, determineAgentType]
  );

  const handleGenerateScenarioPositions = useCallback(
    async () =>
      handleGenerateResources(
        ["scenario_positions"],
        determineAgentType(["scenario_positions"])
      ),
    [handleGenerateResources, determineAgentType]
  );

  const handleGenerateScenarioRubrics = useCallback(
    async () =>
      handleGenerateResources(
        ["scenario_rubrics"],
        determineAgentType(["scenario_rubrics"])
      ),
    [handleGenerateResources, determineAgentType]
  );

  const handleGenerateScenarioTimeLimits = useCallback(
    async () =>
      handleGenerateResources(
        ["scenario_time_limits"],
        determineAgentType(["scenario_time_limits"])
      ),
    [handleGenerateResources, determineAgentType]
  );

  // Disabled logic based on can_edit flag - standardized for all resource components
  // Check can_edit in both new and edit modes to show disabled_reason when agents are missing
  const disabled = useMemo(() => {
    if (!simulationData) return false;
    return !simulationData.can_edit;
  }, [simulationData]);

  // Set breadcrumb context when simulation data is loaded
  useEffect(() => {
    const simulationName = simulationData?.name_resource?.name;
    if (simulationName && simulationId && isEditMode) {
      setEntityMetadata({
        entityId: simulationId,
        entityName: simulationName,
        entityType: "simulation",
      });
    }
    return () => clearEntityMetadata();
  }, [
    simulationData,
    simulationId,
    isEditMode,
    setEntityMetadata,
    clearEntityMetadata,
  ]);

  // Set generation capability when simulation data is loaded
  useEffect(() => {
    if (simulationData?.general_agent_id) {
      setGenerationCapability({
        artifactType: "simulation",
        canGenerate: true,
        agentId: simulationData.general_agent_id,
      });
    } else {
      setGenerationCapability({
        artifactType: "simulation",
        canGenerate: false,
        agentId: null,
      });
    }
    return () => clearGenerationCapability();
  }, [
    simulationData?.general_agent_id,
    setGenerationCapability,
    clearGenerationCapability,
  ]);

  // Submit handler for GenericForm (uses formState, not formData parameter)
  const handleSubmit = useCallback(
    async (_formData: Record<string, unknown>) => {
      // Validate required resource IDs using {resource}_required flags from simulationData
      if (simulationData?.name_required && !formState.name_id) {
        toast.error("Simulation name is required");
        throw new Error("Simulation name is required");
      }

      if (
        simulationData?.departments_required &&
        (!formState.department_ids || formState.department_ids.length === 0)
      ) {
        toast.error("Departments are required");
        throw new Error("Departments are required");
      }

      if (simulationData?.flag_required && !formState.active_flag_id) {
        toast.error("Active flag is required");
        throw new Error("Active flag is required");
      }

      if (simulationData?.description_required && !formState.description_id) {
        toast.error("Description is required");
        throw new Error("Description is required");
      }

      if (
        simulationData?.scenarios_required &&
        (!formState.scenario_ids || formState.scenario_ids.length === 0)
      ) {
        toast.error("Scenarios are required");
        throw new Error("Scenarios are required");
      }

      if (
        simulationData?.scenario_flags_required &&
        (!formState.scenario_flag_ids ||
          formState.scenario_flag_ids.length === 0)
      ) {
        toast.error("Scenario flags are required");
        throw new Error("Scenario flags are required");
      }

      if (
        simulationData?.scenario_positions_required &&
        (!formState.scenario_position_ids ||
          formState.scenario_position_ids.length === 0)
      ) {
        toast.error("Scenario positions are required");
        throw new Error("Scenario positions are required");
      }

      if (
        simulationData?.scenario_rubrics_required &&
        (!formState.scenario_rubric_ids ||
          formState.scenario_rubric_ids.length === 0)
      ) {
        toast.error("Scenario rubrics are required");
        throw new Error("Scenario rubrics are required");
      }

      if (
        simulationData?.scenario_time_limits_required &&
        (!formState.scenario_time_limit_ids ||
          formState.scenario_time_limit_ids.length === 0)
      ) {
        toast.error("Scenario time limits are required");
        throw new Error("Scenario time limits are required");
      }

      // Pass department_ids directly - SQL handles validation via validate_department_create_permissions/validate_department_update_permissions

      // Ensure profileId exists - required for API calls
      if (!effectiveProfile?.id) {
        toast.error("Profile not loaded. Please refresh the page.");
        throw new Error("Profile not loaded");
      }

      if (!saveSimulationAction) {
        toast.error("Save action not available");
        throw new Error("Save action not available");
      }

      // Ensure required fields are present (TypeScript guard)
      if (!formState.name_id) {
        toast.error("Required fields are missing");
        throw new Error("Required fields are missing");
      }

      try {
        await saveSimulationAction({
          body: {
            input_simulation_id:
              isEditMode && simulationId ? simulationId : null,
            name_id: formState.name_id,
            description_id: formState.description_id || null,
            active_flag_id: formState.active_flag_id || null,
            department_ids: formState.department_ids || [],
            // Note: practice_simulation is handled separately (boolean, not a flag resource)
            practice_simulation: false, // Default value - can be updated later if needed
            // Complex resources (scenarios, videos, etc.) are handled separately
            // Convert scenario resource IDs to artifact IDs for save endpoint
            scenario_ids: formState.scenario_ids, // These are resource IDs, SQL will convert to artifact IDs
            scenario_active_flags: [],
            scenario_hints_enabled: [],
            scenario_time_limit_seconds: [],
            scenario_audio_enabled: [],
            scenario_text_enabled: [],
            scenario_rubric_grade_agents: [],
            scenario_flag_ids: formState.scenario_flag_ids || [],
            scenario_position_ids: formState.scenario_position_ids || [],
          },
        });
        toast.success(
          `Simulation ${isEditMode ? "updated" : "created"} successfully!`
        );
        router.push("/create/simulations");
      } catch (error) {
        toast.error(
          `Failed to ${isEditMode ? "update" : "create"} simulation: ${error instanceof Error ? error.message : "Unknown error"}`
        );
        throw error;
      }
    },
    [
      formState,
      isEditMode,
      simulationId,
      effectiveProfile?.id,
      saveSimulationAction,
      router,
      simulationData?.name_required,
      simulationData?.description_required,
      simulationData?.flag_required,
      simulationData?.departments_required,
      simulationData?.scenarios_required,
      simulationData?.scenario_flags_required,
      simulationData?.scenario_positions_required,
      simulationData?.scenario_rubrics_required,
      simulationData?.scenario_time_limits_required,
    ]
  );

  // Step status logic (for GenericForm) - check resource IDs instead of display values
  const getStepStatus = useCallback(
    (stepId: string, _formData: Record<string, unknown>): StepStatus => {
      // Check resource IDs from formState (components manage their own display state)
      const hasName =
        !(simulationData?.name_required ?? false) || !!formState.name_id;
      const hasDescription =
        !(simulationData?.description_required ?? false) ||
        !!formState.description_id;
      const hasDepartments =
        !(simulationData?.departments_required ?? false) ||
        formState.department_ids.length > 0;
      const hasActiveFlag =
        !(simulationData?.flag_required ?? false) ||
        !!formState.active_flag_id;
      const hasScenarios =
        !(simulationData?.scenarios_required ?? false) ||
        formState.scenario_ids.length > 0;
      const hasScenarioFlags =
        !(simulationData?.scenario_flags_required ?? false) ||
        formState.scenario_flag_ids.length > 0;
      const hasScenarioPositions =
        !(simulationData?.scenario_positions_required ?? false) ||
        formState.scenario_position_ids.length > 0;
      const hasScenarioRubrics =
        !(simulationData?.scenario_rubrics_required ?? false) ||
        formState.scenario_rubric_ids.length > 0;
      const hasScenarioTimeLimits =
        !(simulationData?.scenario_time_limits_required ?? false) ||
        formState.scenario_time_limit_ids.length > 0;

      switch (stepId) {
        case "basic":
          return hasName && hasDescription && hasDepartments && hasActiveFlag
            ? "completed"
            : "active";
        case "scenarios":
          return hasScenarios &&
            hasScenarioFlags &&
            hasScenarioPositions &&
            hasScenarioRubrics &&
            hasScenarioTimeLimits
            ? "completed"
            : "active";
        default:
          return "pending";
      }
    },
    [formState, simulationData]
  );

  // Step-to-resources mapping for multi-generation
  const stepResources: Record<string, SimulationResourceType[]> = useMemo(
    () => ({
      basic: ["names", "descriptions", "departments", "flags"],
      scenarios: [
        "scenarios",
        "scenario_flags",
        "scenario_positions",
        "scenario_rubrics",
        "scenario_time_limits",
      ],
      all: [
        "names",
        "descriptions",
        "departments",
        "flags",
        "scenarios",
        "scenario_flags",
        "scenario_positions",
        "scenario_rubrics",
        "scenario_time_limits",
      ], // All resources for full-page generation
    }),
    []
  );

  // Resource labels for display
  const resourceLabels: Record<string, string> = useMemo(
    () => ({
      names: "Names",
      descriptions: "Descriptions",
      departments: "Departments",
      flags: "Flags",
      scenarios: "Scenarios",
      scenario_flags: "Scenario Flags",
      scenario_positions: "Scenario Positions",
      scenario_rubrics: "Scenario Rubrics",
      scenario_time_limits: "Scenario Time Limits",
    }),
    []
  );

  // Handler to open modal for step card generation
  const handleOpenStepCardModal = useCallback(
    (stepId: string, mode: "generate" | "regenerate") => {
      const resourceTypes = stepResources[stepId] || [];
      const resources: GenerateRegenerateModalResource[] = resourceTypes.map(
        (rt) => ({
          id: rt,
          label: resourceLabels[rt],
          active: mode === "regenerate" ? canRegenerate(rt) : true,
        })
      );

      setModalResources(resources);
      setModalMode(mode);
      setModalInstructions("");
      setShowGenerateModal(true);
    },
    [stepResources, resourceLabels, canRegenerate]
  );

  // Handler for modal generate/regenerate action
  const handleModalGenerate = useCallback(
    async (selectedResources: string[], instructions: string) => {
      const resourceTypes = selectedResources as SimulationResourceType[];
      const agentType = determineAgentType(resourceTypes);
      await handleGenerateResources(
        resourceTypes,
        agentType,
        instructions.trim() || undefined
      );
      setShowGenerateModal(false);
      setModalInstructions("");
    },
    [handleGenerateResources, determineAgentType]
  );

  // Listen for full-page-generate event from layout
  useEffect(() => {
    const handleFullPageGenerate = () => {
      if (simulationData?.general_agent_id) {
        // Open modal instead of directly generating
        handleOpenStepCardModal("all", "generate");
      }
    };
    window.addEventListener("full-page-generate", handleFullPageGenerate);
    return () =>
      window.removeEventListener("full-page-generate", handleFullPageGenerate);
  }, [simulationData?.general_agent_id, handleOpenStepCardModal]);

  // Steps configuration for GenericForm
  const steps = useMemo(
    () => [
      {
        id: "basic",
        title: "Basic Information",
        description:
          "Set the simulation name, description, departments, and active status.",
        resetFields: ["name", "description", "department_ids", "active"],
      },
      {
        id: "scenarios",
        title: "Scenarios",
        description:
          "Select scenarios and configure scenario flags, positions, rubrics, and time limits.",
        resetFields: [
          "scenario_ids",
          "scenario_flag_ids",
          "scenario_position_ids",
          "scenario_rubric_ids",
          "scenario_time_limit_ids",
          "scenarioSearch",
          "scenarioShowSelected",
        ],
      },
    ],
    []
  );

  // Memoize formFieldKeys to prevent re-initialization loops
  const formFieldKeys = useMemo(
    () => [
      "name",
      "description",
      "departments",
      "active",
      "scenario_ids",
      "scenario_flag_ids",
      "scenario_position_ids",
      "scenario_rubric_ids",
      "scenario_time_limit_ids",
    ],
    []
  );

  // Memoize resetSuccessMessage to prevent GenericForm re-renders
  const resetSuccessMessage = useCallback((stepId: string) => {
    switch (stepId) {
      case "basic":
        return "Basic information reset";
      case "scenarios":
        return "Scenario configuration reset";
      default:
        return "Reset";
    }
  }, []);

  // Memoize submitButton to prevent GenericForm re-renders
  const submitButton = useMemo(
    () => ({
      backUrl: "/create/simulations",
      backLabel: "Back",
      createLabel: "Create Simulation",
      updateLabel: "Update Simulation",
    }),
    []
  );

  // Render step content - memoized to prevent unnecessary re-renders
  // Updated to match Persona.tsx signature
  const renderStep = useCallback(
    ({
      stepId,
      stepStatus,
      stepTitle,
      stepDescription,
      stepNumber,
      formData: stepFormData,
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
      // Use memoized fields to avoid dependency on simulationData object reference
      const currentSimulationData = stableSimulationDataFields;
      if (!currentSimulationData) {
        return <div>Loading...</div>;
      }

      const descriptionSearch =
        (stepFormData["descriptionSearch"] as string | undefined) ?? null;

      switch (stepId) {
        case "basic":
          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={disabled}
              isEditMode={isEditMode}
              resetFields={["name", "description", "department_ids", "active"]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
              actions={
                stepResources["basic"] &&
                stepResources["basic"].length > 0 &&
                currentSimulationData?.general_agent_id ? (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            const hasRegeneratable = stepResources[
                              "basic"
                            ]!.some((rt) => canRegenerate(rt));
                            handleOpenStepCardModal(
                              "basic",
                              hasRegeneratable ? "regenerate" : "generate"
                            );
                          }}
                          disabled={
                            disabled ||
                            stepResources["basic"]!.some((rt) =>
                              isGenerating(rt)
                            )
                          }
                        >
                          {stepResources["basic"]!.some((rt) =>
                            isGenerating(rt)
                          ) ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Sparkles className="h-4 w-4" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {stepResources["basic"]!.some((rt) => canRegenerate(rt))
                          ? "Regenerate"
                          : "Generate"}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ) : undefined
              }
            >
              <div className="space-y-6">
                <Names
                  name_id={formState.name_id ?? null}
                  name_resource={currentSimulationData.name_resource ?? null}
                  show_name={currentSimulationData.show_name ?? true}
                  name_suggestions={
                    currentSimulationData.name_suggestions ?? []
                  }
                  names={currentSimulationData.names ?? []}
                  disabled={disabled}
                  onNameIdChange={(id) =>
                    setFormState((prev) => ({ ...prev, name_id: id }))
                  }
                  onGenerate={handleGenerateName}
                  isGenerating={isGenerating("names")}
                  createNamesAction={createNamesAction}
                  group_id={currentSimulationData.group_id ?? null}
                  agent_id={currentSimulationData.name_agent_id ?? null}
                  required={currentSimulationData.name_required ?? false}
                />
                <Descriptions
                  description_id={formState.description_id ?? null}
                  description_resource={
                    currentSimulationData.description_resource ?? null
                  }
                  show_description={
                    currentSimulationData.show_description ?? true
                  }
                  description_suggestions={
                    currentSimulationData.description_suggestions ?? []
                  }
                  descriptions={currentSimulationData.descriptions ?? []}
                  disabled={disabled}
                  onDescriptionIdChange={(id) =>
                    setFormState((prev) => ({ ...prev, description_id: id }))
                  }
                  searchTerm={descriptionSearch || undefined}
                  onSearchChange={(term: string) =>
                    setStepFormData({ descriptionSearch: term || null })
                  }
                  onGenerate={handleGenerateDescription}
                  isGenerating={isGenerating("descriptions")}
                  createDescriptionsAction={createDescriptionsAction}
                  group_id={currentSimulationData.group_id ?? null}
                  agent_id={currentSimulationData.description_agent_id ?? null}
                  required={currentSimulationData.description_required ?? false}
                />
                <Departments
                  department_ids={formState.department_ids ?? []}
                  department_resources={
                    currentSimulationData.department_resources ?? []
                  }
                  show_departments={
                    currentSimulationData.show_departments ?? false
                  }
                  department_suggestions={
                    currentSimulationData.department_suggestions ?? []
                  }
                  departments={currentSimulationData.departments ?? []}
                  disabled={disabled}
                  onChange={(ids) =>
                    setFormState((prev) => ({ ...prev, department_ids: ids }))
                  }
                  createDepartmentsAction={createDepartmentsAction}
                  onGenerate={handleGenerateDepartments}
                  isGenerating={isGenerating("departments")}
                  group_id={currentSimulationData.group_id ?? null}
                  agent_id={currentSimulationData.departments_agent_id ?? null}
                  required={currentSimulationData.departments_required ?? false}
                />
                <Flags
                  flag_id={formState.active_flag_id ?? null}
                  flag_resource={currentSimulationData.flag_resource ?? null}
                  show_flag={currentSimulationData.show_flag ?? false}
                  flags={currentSimulationData.flags ?? []}
                  disabled={disabled}
                  onFlagIdChange={(id) =>
                    setFormState((prev) => ({ ...prev, active_flag_id: id }))
                  }
                  onGenerate={handleGenerateFlags}
                  isGenerating={isGenerating("flags")}
                  createFlagsAction={createFlagsAction}
                  group_id={currentSimulationData.group_id ?? null}
                  agent_id={currentSimulationData.flag_agent_id ?? null}
                  required={currentSimulationData.flag_required ?? false}
                  label="Active"
                  helpText="Whether this simulation is active"
                />
                <Scenarios
                  scenario_ids={formState.scenario_ids ?? []}
                  scenario_resources={
                    currentSimulationData.scenario_resources ?? []
                  }
                  show_scenarios={currentSimulationData.show_scenarios ?? false}
                  scenario_suggestions={
                    currentSimulationData.scenario_suggestions ?? []
                  }
                  scenarios={currentSimulationData.scenarios ?? []}
                  disabled={disabled}
                  onChange={(ids) =>
                    setFormState((prev) => ({ ...prev, scenario_ids: ids }))
                  }
                  createScenariosAction={createScenariosAction}
                  onGenerate={handleGenerateScenarios}
                  isGenerating={isGenerating("scenarios")}
                  group_id={currentSimulationData.group_id ?? null}
                  agent_id={currentSimulationData.scenarios_agent_id ?? null}
                  required={currentSimulationData.scenarios_required ?? false}
                />
                <ScenarioFlags
                  scenario_flag_ids={formState.scenario_flag_ids ?? []}
                  scenario_flag_resources={
                    currentSimulationData.scenario_flag_resources ?? []
                  }
                  show_scenario_flags={
                    currentSimulationData.show_scenario_flags ?? false
                  }
                  scenario_flag_suggestions={
                    currentSimulationData.scenario_flag_suggestions ?? []
                  }
                  scenario_flags={currentSimulationData.scenario_flags ?? []}
                  disabled={disabled}
                  onChange={(ids) =>
                    setFormState((prev) => ({
                      ...prev,
                      scenario_flag_ids: ids,
                    }))
                  }
                  createScenarioFlagsAction={createScenarioFlagsAction}
                  onGenerate={handleGenerateScenarioFlags}
                  isGenerating={isGenerating("scenario_flags")}
                  group_id={currentSimulationData.group_id ?? null}
                  agent_id={
                    currentSimulationData.scenario_flags_agent_id ?? null
                  }
                  required={
                    currentSimulationData.scenario_flags_required ?? false
                  }
                />
                <ScenarioPositions
                  scenario_position_ids={formState.scenario_position_ids ?? []}
                  scenario_position_resources={
                    currentSimulationData.scenario_position_resources ?? []
                  }
                  show_scenario_positions={
                    currentSimulationData.show_scenario_positions ?? false
                  }
                  scenario_position_suggestions={
                    currentSimulationData.scenario_position_suggestions ?? []
                  }
                  scenario_positions={
                    currentSimulationData.scenario_positions ?? []
                  }
                  disabled={disabled}
                  onChange={(positions) => {
                    // Convert positions array to IDs array for form state
                    const ids = positions.map(
                      (p) => `${p.simulation_id}-${p.scenario_id}`
                    );
                    setFormState((prev) => ({
                      ...prev,
                      scenario_position_ids: ids,
                    }));
                  }}
                  simulation_id={simulationId || null}
                  scenario_ids={formState.scenario_ids}
                  createScenarioPositionsAction={createScenarioPositionsAction}
                  onGenerate={handleGenerateScenarioPositions}
                  isGenerating={isGenerating("scenario_positions")}
                  group_id={currentSimulationData.group_id ?? null}
                  agent_id={
                    currentSimulationData.scenario_positions_agent_id ?? null
                  }
                  required={
                    currentSimulationData.scenario_positions_required ?? false
                  }
                />
                <ScenarioRubricGradeAgents
                  scenario_rubric_grade_agent_ids={
                    formState.scenario_rubric_grade_agent_ids ?? []
                  }
                  scenario_rubric_grade_agent_resources={
                    currentSimulationData.scenario_rubric_grade_agent_resources ??
                    []
                  }
                  show_scenario_rubric_grade_agents={
                    currentSimulationData.show_scenario_rubric_grade_agents ??
                    false
                  }
                  scenario_rubric_grade_agent_suggestions={
                    currentSimulationData.scenario_rubric_grade_agent_suggestions ??
                    []
                  }
                  scenario_rubric_grade_agents={
                    currentSimulationData.scenario_rubric_grade_agents ?? []
                  }
                  disabled={disabled}
                  onChange={(ids) =>
                    setFormState((prev) => ({
                      ...prev,
                      scenario_rubric_grade_agent_ids: ids,
                    }))
                  }
                  createScenarioRubricGradeAgentsAction={
                    createScenarioRubricGradeAgentsAction
                  }
                  onGenerate={handleGenerateScenarioRubricGradeAgents}
                  isGenerating={isGenerating("scenario_rubric_grade_agents")}
                  group_id={currentSimulationData.group_id ?? null}
                  agent_id={
                    currentSimulationData.scenario_rubric_grade_agents_agent_id ??
                    null
                  }
                  required={
                    currentSimulationData.scenario_rubric_grade_agents_required ??
                    false
                  }
                />
              </div>
            </StepCard>
          );
        default:
          return null;
      }
    },
    [
      stableSimulationDataFields,
      formState,
      disabled,
      isEditMode,
      simulationId,
      handleGenerateName,
      handleGenerateDescription,
      handleGenerateDepartments,
      handleGenerateFlags,
      handleGenerateScenarios,
      handleGenerateScenarioFlags,
      handleGenerateScenarioPositions,
      handleGenerateScenarioRubricGradeAgents,
      isGenerating,
      stepResources,
      canRegenerate,
      handleOpenStepCardModal,
      createNamesAction,
      createDescriptionsAction,
      createFlagsAction,
      createDepartmentsAction,
      createScenariosAction,
      createScenarioFlagsAction,
      createScenarioPositionsAction,
      createScenarioRubricGradeAgentsAction,
    ]
  );

  if (!simulationData) {
    return <div>Loading simulation data...</div>;
  }

  return (
    <TooltipProvider>
      <div
        className="w-full p-6 space-y-8"
        data-page={`simulation-${isEditMode ? "edit" : "new"}`}
      >
        <ReadOnlyBanner
          disabled={disabled}
          disabledReason={simulationData?.disabled_reason ?? null}
          entityType="simulation"
        />

        <GenericForm
          nuqsParsers={
            simulationSearchParamsClient as Record<string, Parser<unknown>>
          }
          steps={steps}
          getStepStatus={getStepStatus}
          serverData={simulationData}
          formFieldKeys={formFieldKeys}
          resetSuccessMessage={resetSuccessMessage}
          onSubmit={handleSubmit}
          submitButton={submitButton}
          isReadonly={disabled}
          isEditMode={isEditMode}
          renderStep={renderStep}
          onFormDataChange={onFormDataChange}
          registerSetFormData={(setter) => {
            setUrlFormDataRef.current = setter;
          }}
        />

        {/* Generate/Regenerate Modal */}
        {modalMode && (
          <GenerateRegenerateModal
            open={showGenerateModal}
            onOpenChange={setShowGenerateModal}
            resources={modalResources}
            onResourcesChange={setModalResources}
            instructions={modalInstructions}
            onInstructionsChange={setModalInstructions}
            onGenerate={handleModalGenerate}
            isGenerating={modalResources.some((r) =>
              isGenerating(r.id as SimulationResourceType)
            )}
            mode={modalMode}
          />
        )}
      </div>
    </TooltipProvider>
  );
}

// Memoize component to prevent re-renders when only prop references change (content is same)
export default React.memo(SimulationComponent, (prevProps, nextProps) => {
  // Compare simulationData by resource IDs, not object reference
  const prevIds = {
    name_id: prevProps.simulationData?.name_id,
    description_id: prevProps.simulationData?.description_id,
    active_flag_id: prevProps.simulationData?.active_flag_id,
    department_ids: prevProps.simulationData?.department_ids,
    scenario_ids: prevProps.simulationData?.scenario_ids,
    scenario_flag_ids: prevProps.simulationData?.scenario_flag_ids,
    scenario_position_ids:
      prevProps.simulationData?.scenario_position_resources?.map(
        (p) => `${p.simulation_id}-${p.scenario_id}`
      ),
    scenario_rubric_grade_agent_ids:
      prevProps.simulationData?.scenario_rubric_grade_agent_ids,
  };
  const nextIds = {
    name_id: nextProps.simulationData?.name_id,
    description_id: nextProps.simulationData?.description_id,
    active_flag_id: nextProps.simulationData?.active_flag_id,
    department_ids: nextProps.simulationData?.department_ids,
    scenario_ids: nextProps.simulationData?.scenario_ids,
    scenario_flag_ids: nextProps.simulationData?.scenario_flag_ids,
    scenario_position_ids:
      nextProps.simulationData?.scenario_position_resources?.map(
        (p) => `${p.simulation_id}-${p.scenario_id}`
      ),
    scenario_rubric_grade_agent_ids:
      nextProps.simulationData?.scenario_rubric_grade_agent_ids,
  };

  // Compare primitive props
  if (
    prevProps.simulationId !== nextProps.simulationId ||
    JSON.stringify(prevIds) !== JSON.stringify(nextIds)
  ) {
    return false; // Props changed, re-render
  }

  // Compare function props by reference (should be stable from server actions)
  if (
    prevProps.saveSimulationAction !== nextProps.saveSimulationAction ||
    prevProps.patchSimulationDraftAction !==
      nextProps.patchSimulationDraftAction ||
    prevProps.createNamesAction !== nextProps.createNamesAction ||
    prevProps.createDescriptionsAction !== nextProps.createDescriptionsAction ||
    prevProps.createFlagsAction !== nextProps.createFlagsAction ||
    prevProps.createDepartmentsAction !== nextProps.createDepartmentsAction ||
    prevProps.createScenariosAction !== nextProps.createScenariosAction ||
    prevProps.createScenarioFlagsAction !==
      nextProps.createScenarioFlagsAction ||
    prevProps.createScenarioPositionsAction !==
      nextProps.createScenarioPositionsAction ||
    prevProps.createScenarioRubricGradeAgentsAction !==
      nextProps.createScenarioRubricGradeAgentsAction
  ) {
    return false; // Function props changed, re-render
  }

  // All props are equivalent, skip re-render
  return true;
});
