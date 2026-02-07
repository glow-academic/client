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
import { ScenarioPersonas } from "@/components/resources/ScenarioPersonas";
import { ScenarioPositions } from "@/components/resources/ScenarioPositions";
import { ScenarioRubrics } from "@/components/resources/ScenarioRubrics";
import { ScenarioTimeLimits } from "@/components/resources/ScenarioTimeLimits";
import { Scenarios } from "@/components/resources/Scenarios";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Loader2, Sparkles } from "lucide-react";

import { useBreadcrumbContext } from "@/contexts/breadcrumb-context";
import { useProfile } from "@/contexts/profile-context";
import { useSaveContext } from "@/contexts/save-context";
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
type CreateDraftScenarioFlagsIn = InputOf<
  "/api/v4/resources/scenario_flags",
  "post"
>;
type CreateDraftScenarioFlagsOut = OutputOf<
  "/api/v4/resources/scenario_flags",
  "post"
>;
type CreateDraftScenarioPersonasIn = InputOf<
  "/api/v4/resources/scenario_personas",
  "post"
>;
type CreateDraftScenarioPersonasOut = OutputOf<
  "/api/v4/resources/scenario_personas",
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
type CreateDraftScenarioRubricsIn = InputOf<
  "/api/v4/resources/scenario_rubrics",
  "post"
>;
type CreateDraftScenarioRubricsOut = OutputOf<
  "/api/v4/resources/scenario_rubrics",
  "post"
>;
type CreateDraftScenarioTimeLimitsIn = InputOf<
  "/api/v4/resources/scenario_time_limits",
  "post"
>;
type CreateDraftScenarioTimeLimitsOut = OutputOf<
  "/api/v4/resources/scenario_time_limits",
  "post"
>;
type PatchSimulationDraftIn = InputOf<"/api/v4/simulations/draft", "patch">;
type PatchSimulationDraftOut = OutputOf<"/api/v4/simulations/draft", "patch">;

type SimulationData = OutputOf<"/api/v4/simulations/get", "post">;
type SimulationResourceType = ResourceType | "scenario_personas" | "scenario_time_limits";

// Type for flush results - each resource returns its created ID(s)
type FlushResult = {
  name_id?: string | null;
  description_id?: string | null;
  scenario_flag_ids?: string[];
  scenario_persona_ids?: string[];
  scenario_position_ids?: string[];
  scenario_rubric_ids?: string[];
  scenario_time_limit_ids?: string[];
};

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
  createScenarioFlagsAction?: (
    input: CreateDraftScenarioFlagsIn
  ) => Promise<CreateDraftScenarioFlagsOut>;
  createScenarioPersonasAction?: (
    input: CreateDraftScenarioPersonasIn
  ) => Promise<CreateDraftScenarioPersonasOut>;
  createScenarioPositionsAction?: (
    input: CreateDraftScenarioPositionsIn
  ) => Promise<CreateDraftScenarioPositionsOut>;
  createScenarioRubricsAction?: (
    input: CreateDraftScenarioRubricsIn
  ) => Promise<CreateDraftScenarioRubricsOut>;
  createScenarioTimeLimitsAction?: (
    input: CreateDraftScenarioTimeLimitsIn
  ) => Promise<CreateDraftScenarioTimeLimitsOut>;
}

function SimulationComponent({
  simulationId,
  simulationData,
  saveSimulationAction,
  patchSimulationDraftAction,
  createNamesAction,
  createDescriptionsAction,
  createScenarioFlagsAction,
  createScenarioPersonasAction,
  createScenarioPositionsAction,
  createScenarioRubricsAction,
  createScenarioTimeLimitsAction,
}: SimulationProps) {
  const router = useRouter();
  const isEditMode = !!simulationId;
  const {
    profile,
    setSelectedDraftId,
    socket,
    isConnected,
  } = useProfile();
  const { setEntityMetadata, clearEntityMetadata } = useBreadcrumbContext();
  const { isAutosaveEnabled } = useSaveContext();

  // Registry of flush callbacks from creatable resource components
  const flushRegistryRef = React.useRef<
    Map<string, () => Promise<FlushResult | void>>
  >(new Map());

  // Create stable registerFlush callback
  const createRegisterFlush = useCallback((key: string) => {
    return (flush: () => Promise<FlushResult | void>) => {
      flushRegistryRef.current.set(key, flush);
    };
  }, []);

  // Memoize registerFlush callbacks to prevent re-renders
  const registerFlushCallbacks = useMemo(
    () => ({
      names: createRegisterFlush("names"),
      descriptions: createRegisterFlush("descriptions"),
      scenario_flags: createRegisterFlush("scenario_flags"),
      scenario_personas: createRegisterFlush("scenario_personas"),
      scenario_positions: createRegisterFlush("scenario_positions"),
      scenario_rubrics: createRegisterFlush("scenario_rubrics"),
      scenario_time_limits: createRegisterFlush("scenario_time_limits"),
    }),
    [createRegisterFlush]
  );

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

  // AI form data state for AI diff view - stores pending AI suggestions
  const [aiFormData, setAiFormData] = useState<{
    scenario_resources?: Array<{
      scenario_id?: string | null;
      name?: string | null;
      title?: string | null;
    }>;
  }>({});

  // Clear AI resource suggestion for a specific key
  const clearAiResource = useCallback(
    (key: keyof typeof aiFormData) => {
      setAiFormData((prev) => ({
        ...prev,
        [key]: undefined,
      }));
    },
    []
  );

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
      flag_resources: simulationData.flag_resources,
      show_flags: simulationData.show_flags,
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
      scenario_persona_ids: simulationData.scenario_persona_ids,
      scenario_persona_resources: simulationData.scenario_persona_resources,
      show_scenario_personas: simulationData.show_scenario_personas,
      scenario_personas_agent_id: simulationData.scenario_personas_agent_id,
      scenario_personas_required: simulationData.scenario_personas_required,
      scenario_persona_suggestions:
        simulationData.scenario_persona_suggestions,
      scenario_personas: simulationData.scenario_personas,
      scenario_position_ids: simulationData.scenario_position_ids,
      scenario_position_resources: simulationData.scenario_position_resources,
      show_scenario_positions: simulationData.show_scenario_positions,
      scenario_positions_agent_id: simulationData.scenario_positions_agent_id,
      scenario_positions_required: simulationData.scenario_positions_required,
      scenario_position_suggestions:
        simulationData.scenario_position_suggestions,
      scenario_positions: simulationData.scenario_positions,
      scenario_rubric_ids:
        simulationData.scenario_rubric_ids,
      scenario_rubric_resources:
        simulationData.scenario_rubric_resources,
      show_scenario_rubrics:
        simulationData.show_scenario_rubrics,
      scenario_rubrics_agent_id:
        simulationData.scenario_rubrics_agent_id,
      scenario_rubrics_required:
        simulationData.scenario_rubrics_required,
      scenario_rubric_suggestions:
        simulationData.scenario_rubric_suggestions,
      scenario_rubrics:
        simulationData.scenario_rubrics,
      rubrics: simulationData.rubrics,
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
    simulationData?.flag_resources,
    simulationData?.show_flags,
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
    simulationData?.scenario_persona_ids,
    simulationData?.scenario_persona_resources,
    simulationData?.show_scenario_personas,
    simulationData?.scenario_personas_agent_id,
    simulationData?.scenario_personas_required,
    simulationData?.scenario_persona_suggestions,
    simulationData?.scenario_personas,
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
    simulationData?.rubrics,
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
          return (
            stableSimulationDataFields.flag_resources?.some(
              (f) => f.generated
            ) ?? false
          );
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
        case "scenario_personas":
          return (
            stableSimulationDataFields.scenario_persona_resources?.some(
              (p) => p.generated
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
        flag_ids: [] as string[],
        department_ids: [] as string[],
        scenario_ids: [] as string[],
        scenario_flag_ids: [] as string[],
        scenario_persona_ids: [] as string[],
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
      flag_ids: data.flag_ids ?? [],
      department_ids: data.department_ids ?? [],
      scenario_ids: data.scenario_ids ?? [],
      scenario_flag_ids: data.scenario_flag_ids ?? [],
      scenario_persona_ids: data.scenario_persona_ids ?? [],
      scenario_position_ids: data.scenario_position_ids ?? [],
      scenario_rubric_ids:
        data.scenario_rubric_ids ?? [],
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
  const formStateFlagIdsStr = React.useMemo(
    () => JSON.stringify(formState.flag_ids),
    [formState.flag_ids]
  );
  const formStateDepartmentIdsStr = React.useMemo(
    () => JSON.stringify(formState.department_ids),
    [formState.department_ids]
  );
  const formStateScenarioIdsStr = React.useMemo(
    () => JSON.stringify(formState.scenario_ids),
    [formState.scenario_ids]
  );
  const formStateScenarioFlagIdsStr = React.useMemo(
    () => JSON.stringify(formState.scenario_flag_ids),
    [formState.scenario_flag_ids]
  );
  const formStateScenarioPersonaIdsStr = React.useMemo(
    () => JSON.stringify(formState.scenario_persona_ids),
    [formState.scenario_persona_ids]
  );
  const formStateScenarioPositionIdsStr = React.useMemo(
    () => JSON.stringify(formState.scenario_position_ids),
    [formState.scenario_position_ids]
  );
  const formStateScenarioRubricIdsStr = React.useMemo(
    () => JSON.stringify(formState.scenario_rubric_ids),
    [formState.scenario_rubric_ids]
  );
  const formStateScenarioTimeLimitIdsStr = React.useMemo(
    () => JSON.stringify(formState.scenario_time_limit_ids),
    [formState.scenario_time_limit_ids]
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
        JSON.stringify(prev.flag_ids) !==
          JSON.stringify(newState.flag_ids) ||
        JSON.stringify(prev.department_ids) !==
          JSON.stringify(newState.department_ids) ||
        JSON.stringify(prev.scenario_ids) !==
          JSON.stringify(newState.scenario_ids) ||
        JSON.stringify(prev.scenario_flag_ids) !==
          JSON.stringify(newState.scenario_flag_ids) ||
        JSON.stringify(prev.scenario_persona_ids) !==
          JSON.stringify(newState.scenario_persona_ids) ||
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
    JSON.stringify(simulationData?.flag_ids ?? []),
    departmentIdsStr,
    JSON.stringify(simulationData?.scenario_ids ?? []),
    JSON.stringify(simulationData?.scenario_flag_ids ?? []),
    JSON.stringify(simulationData?.scenario_persona_ids ?? []),
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
  // Sync draft_version from server to avoid unintended draft forks.
  const draftVersion =
    simulationData && "draft_version" in simulationData
      ? (simulationData as { draft_version?: number | null }).draft_version
      : null;
  // Track if version has been synced from server to prevent patching before sync
  const versionSyncedRef = React.useRef(false);
  React.useEffect(() => {
    if (
      typeof draftVersion === "number" &&
      draftVersion !== lastSavedVersionRef.current
    ) {
      setLastSavedVersion(draftVersion);
      lastSavedVersionRef.current = draftVersion;
    }
    versionSyncedRef.current = true; // Mark as synced
  }, [draftVersion]);

  // Get draftId from GenericForm's URL state via bridge (GenericForm is single source of truth)
  const [draftId, setDraftId] = useState<string | null>(null);
  const setUrlFormDataRef = React.useRef<
    null | ((updates: Record<string, unknown>) => void)
  >(null);

  // Store formData from GenericForm to access search params
  const formDataRef = React.useRef<Record<string, unknown>>({});

  // Track last synced draftId to prevent redundant profile context updates
  const lastSyncedDraftIdRef = React.useRef<string | null>(null);

  // Track when we're syncing from server data (to reset baseline, not trigger save)
  // Defined early so it's available for onFormDataChange and formState sync effect
  const serverSyncPendingRef = React.useRef(false);

  // Memoized callback to sync draftId from GenericForm - only update if value changed
  const onFormDataChange = React.useCallback((fd: Record<string, unknown>) => {
    // Store formData for access in handleGenerateResources
    formDataRef.current = fd;
    const next = (fd["draftId"] as string | undefined) ?? null;
    setDraftId((prev) => {
      // If draftId is changing on initial load (null → value), mark as server sync
      // to prevent triggering autosave for URL-based draft loading
      if (prev === null && next !== null) {
        serverSyncPendingRef.current = true;
      }
      return prev === next ? prev : next;
    });

    // One-way sync to profile context (no effect dependency on selectedDraftId)
    if (next !== lastSyncedDraftIdRef.current) {
      lastSyncedDraftIdRef.current = next;
      setSelectedDraftId(next);
    }
  }, [setSelectedDraftId]);

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
      flag_ids: formState.flag_ids,
      department_ids: formState.department_ids,
      scenario_ids: formState.scenario_ids,
      scenario_flag_ids: formState.scenario_flag_ids,
      scenario_persona_ids: formState.scenario_persona_ids,
      scenario_position_ids: formState.scenario_position_ids,
      scenario_rubric_ids: formState.scenario_rubric_ids,
      scenario_time_limit_ids: formState.scenario_time_limit_ids,
    });
    // Use stringified arrays to prevent recreation when array references change but content is same
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    draftId,
    formState.name_id,
    formState.description_id,
    formStateFlagIdsStr,
    formStateDepartmentIdsStr,
    formStateScenarioIdsStr,
    formStateScenarioFlagIdsStr,
    formStateScenarioPersonaIdsStr,
    formStateScenarioPositionIdsStr,
    formStateScenarioRubricIdsStr,
    formStateScenarioTimeLimitIdsStr,
  ]);

  // Track last patched payload so we don't repatch identical state
  const lastPatchedKeyRef = React.useRef<string | null>(null);
  const isFirstPatchRef = React.useRef(true);

  // Track if there are pending changes for beforeunload warning
  const hasPendingChangesRef = React.useRef(false);

  // Draft change listener - watches resource IDs and patches draft
  // Only triggers when the payload actually changes, not when version changes
  useEffect(() => {
    const hasResourceIds =
      formState.name_id ||
      formState.description_id ||
      formState.flag_ids.length > 0 ||
      formState.department_ids.length > 0 ||
      formState.scenario_ids.length > 0 ||
      formState.scenario_flag_ids.length > 0 ||
      formState.scenario_persona_ids.length > 0 ||
      formState.scenario_position_ids.length > 0 ||
      formState.scenario_rubric_ids.length > 0 ||
      formState.scenario_time_limit_ids.length > 0;

    if (!hasResourceIds || !patchSimulationDraftActionRef.current) {
      return;
    }

    // Wait for version sync before patching to prevent race conditions
    // Only block if there's an actual numeric version to sync (not null for new simulations)
    if (typeof simulationData?.draft_version === "number" && !versionSyncedRef.current) {
      return;
    }

    // Skip the first effect run - treat initial server state as the baseline
    // This prevents creating an unwanted draft on page load when server returns pre-populated IDs
    if (isFirstPatchRef.current) {
      isFirstPatchRef.current = false;
      lastPatchedKeyRef.current = draftPatchKey;
      return;
    }

    // If this change came from server sync, reset baseline instead of triggering save
    if (serverSyncPendingRef.current) {
      serverSyncPendingRef.current = false;
      lastPatchedKeyRef.current = draftPatchKey;
      return;
    }

    // ✅ If nothing changed since the last successful patch, do nothing.
    if (lastPatchedKeyRef.current === draftPatchKey) {
      return;
    }

    // Mark that we have pending changes (for beforeunload warning)
    hasPendingChangesRef.current = true;

    // Skip autosave if disabled (manual save mode)
    if (!isAutosaveEnabled) {
      return;
    }

    // Immediately show "Saving draft..." when autosave is enabled
    // (actual API call is debounced, but UI reflects intent immediately)
    window.dispatchEvent(
      new CustomEvent("save-status-change", { detail: { status: "saving" } })
    );

    const timer = setTimeout(async () => {
      try {
        if (!patchSimulationDraftActionRef.current) return;

        const result = await patchSimulationDraftActionRef.current({
          body: {
            input_draft_id: draftId || null,
            name_id: formState.name_id,
            description_id: formState.description_id,
            flag_ids: formState.flag_ids,
            department_ids: formState.department_ids,
            scenario_ids: formState.scenario_ids,
            scenario_flag_ids: formState.scenario_flag_ids,
            scenario_persona_ids: formState.scenario_persona_ids,
            scenario_position_ids: formState.scenario_position_ids,
            scenario_rubric_ids: formState.scenario_rubric_ids,
            scenario_time_limit_ids: formState.scenario_time_limit_ids,
            expected_version: lastSavedVersionRef.current, // ✅ ref, not state dep
          },
        });

        // Mark this payload as patched so we don't loop
        lastPatchedKeyRef.current = draftPatchKey;

        if (!draftId && result.draft_id) {
          // Update URL when draft is created via GenericForm bridge (GenericForm owns URL state)
          toast.success("Draft created", {
            description: "Your changes are being auto-saved",
          });
          setUrlFormDataRef.current?.({ draftId: result.draft_id });
        } else if (result.draft_id && result.draft_id !== draftId) {
          // Sync URL to server-returned draft_id to avoid stale draft mismatch
          setUrlFormDataRef.current?.({ draftId: result.draft_id });
        }

        // This can stay as state (for UI), but it won't re-trigger patching
        // because the effect is gated by payload changes.
        if ((result.new_version ?? 0) !== lastSavedVersionRef.current) {
          setLastSavedVersion(result.new_version ?? 0);
          lastSavedVersionRef.current = result.new_version ?? 0;
        }

        // Clear pending changes flag after successful save
        hasPendingChangesRef.current = false;

        // Notify save context that save completed and changes are saved
        window.dispatchEvent(
          new CustomEvent("save-status-change", { detail: { status: "idle" } })
        );
        window.dispatchEvent(
          new CustomEvent("unsaved-changes", { detail: { hasChanges: false } })
        );
      } catch {
        // Show user feedback
        toast.error("Failed to save draft", {
          description: "Your changes may not have been saved. Please try again.",
        });
        // Notify save context of error, then reset to idle
        window.dispatchEvent(
          new CustomEvent("save-status-change", { detail: { status: "error" } })
        );
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
    isAutosaveEnabled, // ✅ re-check when autosave mode changes
    // patchSimulationDraftAction and setDraftId are accessed via refs
  ]);

  // Warn users about unsaved changes when navigating away
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasPendingChangesRef.current) {
        e.preventDefault();
        e.returnValue = "You have unsaved changes.";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  // Emit unsaved-changes event when draftPatchKey changes
  useEffect(() => {
    // During server sync, report no changes (baseline will be reset by autosave effect)
    if (serverSyncPendingRef.current) {
      window.dispatchEvent(
        new CustomEvent("unsaved-changes", { detail: { hasChanges: false } })
      );
      return;
    }
    // Only report changes after we've established a baseline (ref is not null)
    const hasChanges =
      lastPatchedKeyRef.current !== null &&
      lastPatchedKeyRef.current !== draftPatchKey;
    window.dispatchEvent(
      new CustomEvent("unsaved-changes", { detail: { hasChanges } })
    );
  }, [draftPatchKey]);

  // Flush all resources without saving to draft - returns the created IDs
  // Used by handleSubmit when autosave is off to get IDs before final save
  const flushAllResources = useCallback(async (): Promise<FlushResult> => {
    const flushPromises = Array.from(flushRegistryRef.current.values()).map(
      (flush) => flush()
    );
    const flushResults = await Promise.all(flushPromises);

    // Merge all flush results into a single object (filter out void results)
    const mergedFlushResults = flushResults.reduce<FlushResult>(
      (acc, result) => (result ? { ...acc, ...result } : acc),
      {}
    );

    return mergedFlushResults;
  }, []);

  // Flush all resources and patch draft (for manual save via Save toolbar)
  const flushAllAndSave = useCallback(async () => {
    const startTime = Date.now();
    const MIN_SAVING_DURATION = 1000; // Show "Saving..." for at least 1 second on manual save

    window.dispatchEvent(
      new CustomEvent("save-status-change", { detail: { status: "saving" } })
    );

    try {
      // 1. Flush all creatable resource components and collect returned IDs
      const flushPromises = Array.from(flushRegistryRef.current.values()).map(
        (flush) => flush()
      );
      const flushResults = await Promise.all(flushPromises);

      // 2. Merge all flush results into a single object (filter out void results)
      const mergedFlushResults = flushResults.reduce<FlushResult>(
        (acc, result) => (result ? { ...acc, ...result } : acc),
        {}
      );

      // 3. Patch draft with all resource IDs - use flush results with fallback to current formState
      // This avoids the stale closure problem by using freshly returned IDs
      let isNewDraft = false;
      if (patchSimulationDraftActionRef.current) {
        const currentFormState = formStateRef.current;
        const result = await patchSimulationDraftActionRef.current({
          body: {
            input_draft_id: draftId || null,
            // Use flush results (fresh) with fallback to formState (for non-flushed resources)
            name_id:
              mergedFlushResults.name_id !== undefined
                ? mergedFlushResults.name_id
                : currentFormState.name_id,
            description_id:
              mergedFlushResults.description_id !== undefined
                ? mergedFlushResults.description_id
                : currentFormState.description_id,
            flag_ids: currentFormState.flag_ids,
            department_ids: currentFormState.department_ids,
            scenario_ids: currentFormState.scenario_ids,
            scenario_flag_ids:
              mergedFlushResults.scenario_flag_ids !== undefined
                ? mergedFlushResults.scenario_flag_ids
                : currentFormState.scenario_flag_ids,
            scenario_persona_ids:
              mergedFlushResults.scenario_persona_ids !== undefined
                ? mergedFlushResults.scenario_persona_ids
                : currentFormState.scenario_persona_ids,
            scenario_position_ids:
              mergedFlushResults.scenario_position_ids !== undefined
                ? mergedFlushResults.scenario_position_ids
                : currentFormState.scenario_position_ids,
            scenario_rubric_ids:
              mergedFlushResults.scenario_rubric_ids !== undefined
                ? mergedFlushResults.scenario_rubric_ids
                : currentFormState.scenario_rubric_ids,
            scenario_time_limit_ids:
              mergedFlushResults.scenario_time_limit_ids !== undefined
                ? mergedFlushResults.scenario_time_limit_ids
                : currentFormState.scenario_time_limit_ids,
            expected_version: lastSavedVersionRef.current,
          },
        });

        // Update refs
        lastPatchedKeyRef.current = draftPatchKey;
        if (result.new_version !== undefined && result.new_version !== null) {
          lastSavedVersionRef.current = result.new_version;
          setLastSavedVersion(result.new_version);
        }

        // Update URL if draft was created
        if (!draftId && result.draft_id) {
          setUrlFormDataRef.current?.({ draftId: result.draft_id });
          isNewDraft = true;
        }
      }

      // Ensure minimum display duration for manual save
      const elapsed = Date.now() - startTime;
      if (elapsed < MIN_SAVING_DURATION) {
        await new Promise((resolve) =>
          setTimeout(resolve, MIN_SAVING_DURATION - elapsed)
        );
      }

      window.dispatchEvent(
        new CustomEvent("save-status-change", { detail: { status: "idle" } })
      );
      window.dispatchEvent(
        new CustomEvent("unsaved-changes", { detail: { hasChanges: false } })
      );

      hasPendingChangesRef.current = false;

      // Show success toast for manual save
      toast.success(isNewDraft ? "Draft created" : "Draft saved");
    } catch {
      window.dispatchEvent(
        new CustomEvent("save-status-change", { detail: { status: "error" } })
      );
      toast.error("Failed to save draft");
    }
  }, [draftId, draftPatchKey]);

  // Listen for save trigger from layout
  useEffect(() => {
    const handleTriggerSave = () => flushAllAndSave();
    window.addEventListener("trigger-save", handleTriggerSave);
    return () => window.removeEventListener("trigger-save", handleTriggerSave);
  }, [flushAllAndSave]);

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
      flag_ids?: string[];
      department_ids?: string[];
      scenario_ids?: string[];
      scenario_resources?: Array<{
        scenario_id?: string | null;
        name?: string | null;
        title?: string | null;
      }>;
      scenario_flag_ids?: string[];
      scenario_persona_ids?: string[];
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
        "scenario_personas",
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
          if (data.flag_ids && data.flag_ids.length > 0) {
            // For arrays, append new IDs (avoid duplicates)
            const newFlagIds = data.flag_ids.filter(
              (id) => !prev.flag_ids.includes(id)
            );
            updates.flag_ids = [...prev.flag_ids, ...newFlagIds];
          }
          if (data.department_ids && data.department_ids.length > 0) {
            // For arrays, append new IDs (avoid duplicates)
            const newDeptIds = data.department_ids.filter(
              (id) => !prev.department_ids.includes(id)
            );
            updates.department_ids = [...prev.department_ids, ...newDeptIds];
          }
          // For scenarios, store in aiFormData for diff view instead of auto-applying
          // This is handled separately below after formState update
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
            data.scenario_persona_ids &&
            data.scenario_persona_ids.length > 0
          ) {
            // For arrays, append new IDs (avoid duplicates)
            const newScenarioPersonaIds = data.scenario_persona_ids.filter(
              (id) => !prev.scenario_persona_ids.includes(id)
            );
            updates.scenario_persona_ids = [
              ...prev.scenario_persona_ids,
              ...newScenarioPersonaIds,
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

        // Store scenario_resources in aiFormData for AI diff view
        if (
          data.resource_type === "scenarios" &&
          data.scenario_resources &&
          data.scenario_resources.length > 0
        ) {
          setAiFormData((prev) => ({
            ...prev,
            scenario_resources: data.scenario_resources,
          }));
        }

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
        "scenario_personas",
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
        "scenario_personas",
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
          scenario_personas: "scenario_personas",
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

  const handleGenerateScenarioPersonas = useCallback(
    async () =>
      handleGenerateResources(
        ["scenario_personas"],
        determineAgentType(["scenario_personas"])
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

  // Submit handler for GenericForm (uses formState, not formData parameter)
  const handleSubmit = useCallback(
    async (_formData: Record<string, unknown>) => {
      // When autosave is disabled, flush all resources first to create them
      // This gets the IDs directly without saving to draft
      let flushResults: FlushResult = {};
      if (!isAutosaveEnabled) {
        flushResults = await flushAllResources();
      }

      // Get the current form state and merge with flush results
      // Flush results take precedence (they're freshly created)
      const baseFormState = formStateRef.current;
      const effectiveFormState = {
        name_id:
          flushResults.name_id !== undefined
            ? flushResults.name_id
            : baseFormState.name_id,
        description_id:
          flushResults.description_id !== undefined
            ? flushResults.description_id
            : baseFormState.description_id,
        flag_ids: baseFormState.flag_ids,
        department_ids: baseFormState.department_ids,
        scenario_ids: baseFormState.scenario_ids,
        scenario_flag_ids: baseFormState.scenario_flag_ids,
        scenario_persona_ids: baseFormState.scenario_persona_ids,
        scenario_position_ids: baseFormState.scenario_position_ids,
        scenario_rubric_ids: baseFormState.scenario_rubric_ids,
        scenario_time_limit_ids: baseFormState.scenario_time_limit_ids,
      };

      // Validate required resource IDs using {resource}_required flags from simulationData
      if (simulationData?.name_required && !effectiveFormState.name_id) {
        toast.error("Simulation name is required");
        throw new Error("Simulation name is required");
      }

      if (
        simulationData?.departments_required &&
        (!effectiveFormState.department_ids || effectiveFormState.department_ids.length === 0)
      ) {
        toast.error("Departments are required");
        throw new Error("Departments are required");
      }

      if (
        simulationData?.flag_required &&
        (!effectiveFormState.flag_ids || effectiveFormState.flag_ids.length === 0)
      ) {
        toast.error("At least one flag is required");
        throw new Error("At least one flag is required");
      }

      if (simulationData?.description_required && !effectiveFormState.description_id) {
        toast.error("Description is required");
        throw new Error("Description is required");
      }

      if (
        simulationData?.scenarios_required &&
        (!effectiveFormState.scenario_ids || effectiveFormState.scenario_ids.length === 0)
      ) {
        toast.error("Scenarios are required");
        throw new Error("Scenarios are required");
      }

      if (
        simulationData?.scenario_flags_required &&
        (!effectiveFormState.scenario_flag_ids ||
          effectiveFormState.scenario_flag_ids.length === 0)
      ) {
        toast.error("Scenario flags are required");
        throw new Error("Scenario flags are required");
      }

      if (
        simulationData?.scenario_personas_required &&
        (!effectiveFormState.scenario_persona_ids ||
          effectiveFormState.scenario_persona_ids.length === 0)
      ) {
        toast.error("Scenario personas are required");
        throw new Error("Scenario personas are required");
      }

      if (
        simulationData?.scenario_positions_required &&
        (!effectiveFormState.scenario_position_ids ||
          effectiveFormState.scenario_position_ids.length === 0)
      ) {
        toast.error("Scenario positions are required");
        throw new Error("Scenario positions are required");
      }

      if (
        simulationData?.scenario_rubrics_required &&
        (!effectiveFormState.scenario_rubric_ids ||
          effectiveFormState.scenario_rubric_ids.length === 0)
      ) {
        toast.error("Scenario rubrics are required");
        throw new Error("Scenario rubrics are required");
      }

      if (
        simulationData?.scenario_time_limits_required &&
        (!effectiveFormState.scenario_time_limit_ids ||
          effectiveFormState.scenario_time_limit_ids.length === 0)
      ) {
        toast.error("Scenario time limits are required");
        throw new Error("Scenario time limits are required");
      }

      // Pass department_ids directly - SQL handles validation via validate_department_create_permissions/validate_department_update_permissions

      // Ensure profileId exists - required for API calls
      if (!profile?.id) {
        toast.error("Profile not loaded. Please refresh the page.");
        throw new Error("Profile not loaded");
      }

      if (!saveSimulationAction) {
        toast.error("Save action not available");
        throw new Error("Save action not available");
      }

      if (!simulationData?.group_id) {
        toast.error("Group not found. Please try again.");
        throw new Error("Group ID is required for save");
      }

      // Ensure required fields are present (TypeScript guard)
      if (!effectiveFormState.name_id) {
        toast.error("Required fields are missing");
        throw new Error("Required fields are missing");
      }

      try {
        await saveSimulationAction({
          body: {
            // Context
            group_id: simulationData.group_id,
            input_simulation_id:
              isEditMode && simulationId ? simulationId : null,

            // Required single-select
            name_id: effectiveFormState.name_id,

            // Optional single-select
            description_id: effectiveFormState.description_id ?? undefined,

            // Optional multi-select
            flag_ids:
              effectiveFormState.flag_ids.length > 0
                ? effectiveFormState.flag_ids
                : undefined,
            department_ids:
              effectiveFormState.department_ids.length > 0
                ? effectiveFormState.department_ids
                : undefined,
            scenario_ids:
              effectiveFormState.scenario_ids.length > 0
                ? effectiveFormState.scenario_ids
                : undefined,
            scenario_flag_ids:
              effectiveFormState.scenario_flag_ids.length > 0
                ? effectiveFormState.scenario_flag_ids
                : undefined,
            scenario_persona_ids:
              effectiveFormState.scenario_persona_ids.length > 0
                ? effectiveFormState.scenario_persona_ids
                : undefined,
            scenario_position_ids:
              effectiveFormState.scenario_position_ids.length > 0
                ? effectiveFormState.scenario_position_ids
                : undefined,
            scenario_rubric_ids:
              effectiveFormState.scenario_rubric_ids.length > 0
                ? effectiveFormState.scenario_rubric_ids
                : undefined,
            scenario_time_limit_ids:
              effectiveFormState.scenario_time_limit_ids.length > 0
                ? effectiveFormState.scenario_time_limit_ids
                : undefined,
          },
        });
        toast.success(
          `Simulation ${isEditMode ? "updated" : "created"} successfully!`
        );
        router.push("/training/simulations");
      } catch (error) {
        toast.error(
          `Failed to ${isEditMode ? "update" : "create"} simulation: ${error instanceof Error ? error.message : "Unknown error"}`
        );
        throw error;
      }
    },
    [
      isAutosaveEnabled,
      flushAllResources,
      isEditMode,
      simulationId,
      profile?.id,
      saveSimulationAction,
      simulationData?.group_id,
      router,
      simulationData?.name_required,
      simulationData?.description_required,
      simulationData?.flag_required,
      simulationData?.departments_required,
      simulationData?.scenarios_required,
      simulationData?.scenario_flags_required,
      simulationData?.scenario_personas_required,
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
      const hasFlags =
        !(simulationData?.flag_required ?? false) ||
        formState.flag_ids.length > 0;
      const hasScenarios =
        !(simulationData?.scenarios_required ?? false) ||
        formState.scenario_ids.length > 0;
      const hasScenarioFlags =
        !(simulationData?.scenario_flags_required ?? false) ||
        formState.scenario_flag_ids.length > 0;
      const hasScenarioPersonas =
        !(simulationData?.scenario_personas_required ?? false) ||
        formState.scenario_persona_ids.length > 0;
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
          return hasName && hasDescription && hasDepartments && hasFlags
            ? "completed"
            : "active";
        case "scenarios":
          return (
            hasScenarios &&
            hasScenarioFlags &&
            hasScenarioPersonas &&
            hasScenarioPositions &&
            hasScenarioRubrics &&
            hasScenarioTimeLimits
          )
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
        "scenario_personas",
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
        "scenario_personas",
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
      scenario_personas: "Scenario Personas",
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
    const handleFullPageGenerate = (
      event: CustomEvent<{ agentId?: string }>
    ) => {
      const agentId = event.detail?.agentId;
      if (agentId) {
        // Open modal instead of directly generating
        handleOpenStepCardModal("all", "generate");
      }
    };
    window.addEventListener(
      "full-page-generate",
      handleFullPageGenerate as EventListener
    );
    return () =>
      window.removeEventListener(
        "full-page-generate",
        handleFullPageGenerate as EventListener
      );
  }, [handleOpenStepCardModal]);

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
          "scenario_persona_ids",
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
      "scenario_persona_ids",
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

  const handleReset = useCallback((stepId: string) => {
    setFormState((prev) => {
      switch (stepId) {
        case "basic":
          return {
            ...prev,
            name_id: null,
            description_id: null,
            flag_ids: [],
            department_ids: [],
          };
        case "scenarios":
          return {
            ...prev,
            scenario_ids: [],
            scenario_flag_ids: [],
            scenario_persona_ids: [],
            scenario_position_ids: [],
            scenario_rubric_ids: [],
            scenario_time_limit_ids: [],
          };
        default:
          return prev;
      }
    });
  }, []);

  // Memoize submitButton to prevent GenericForm re-renders
  const submitButton = useMemo(
    () => ({
      backUrl: "/training/simulations",
      backLabel: "Back",
      createLabel: "Create Simulation",
      updateLabel: "Update Simulation",
    }),
    []
  );

  // Compute scenario_resources with show_hints flag
  // show_hints is based on practice_simulation mode - when practice mode is on, hints are hidden
  // For now, default to true (show hints) since practice_simulation isn't exposed in the form yet
  const scenarioResourcesWithShowHints = useMemo(() => {
    const resources = stableSimulationDataFields?.scenario_resources ?? [];
    // TODO: When practice_simulation is exposed in the API response, use it here:
    // const isPractice = simulationData?.practice_simulation ?? false;
    // For now, always show hints (show_hints = true)
    return resources.map((sr) => ({
      ...sr,
      show_hints: true, // Will be set to !isPractice when practice mode is exposed
    }));
  }, [stableSimulationDataFields?.scenario_resources]);

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
              customHeader={
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
                  placeholder="Simulation name"
                  defaultName="New Simulation"
                  hideDescription={true}
                  isAutosaveEnabled={isAutosaveEnabled}
                  registerFlush={registerFlushCallbacks.names}
                />
              }
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
              <div className="space-y-4">
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
                  isAutosaveEnabled={isAutosaveEnabled}
                  registerFlush={registerFlushCallbacks.descriptions}
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
                  onGenerate={handleGenerateDepartments}
                  isGenerating={isGenerating("departments")}
                  group_id={currentSimulationData.group_id ?? null}
                  agent_id={currentSimulationData.departments_agent_id ?? null}
                  required={currentSimulationData.departments_required ?? false}
                />
                <Flags
                  mode="multi"
                  flags={currentSimulationData.flags ?? []}
                  flag_ids={
                    // Convert flag_ids array to Record for Flags component
                    (currentSimulationData.flags ?? []).reduce(
                      (acc, flag) => {
                        const isEnabled = formState.flag_ids.includes(
                          flag.flag_option_id ?? ""
                        );
                        acc[flag.key] = isEnabled
                          ? flag.flag_option_id ?? null
                          : null;
                        return acc;
                      },
                      {} as Record<string, string | null>
                    )
                  }
                  show_flags={currentSimulationData.show_flags ?? false}
                  columns={1}
                  label="Flags"
                  disabled={disabled}
                  onChange={(key: string, flagId: string | null) => {
                    setFormState((prev) => {
                      if (flagId) {
                        // Add flag if not already present
                        if (!prev.flag_ids.includes(flagId)) {
                          return {
                            ...prev,
                            flag_ids: [...prev.flag_ids, flagId],
                          };
                        }
                      } else {
                        // Remove flag by finding the flag_option_id for this key
                        const flag = (currentSimulationData.flags ?? []).find(
                          (f) => f.key === key
                        );
                        if (flag?.flag_option_id) {
                          return {
                            ...prev,
                            flag_ids: prev.flag_ids.filter(
                              (id) => id !== flag.flag_option_id
                            ),
                          };
                        }
                      }
                      return prev;
                    });
                  }}
                  onGenerate={handleGenerateFlags}
                  isGenerating={isGenerating("flags")}
                />
              </div>
            </StepCard>
          );
        case "scenarios": {
          const scenarioSearch =
            (stepFormData["scenarioSearch"] as string | undefined) ?? null;
          const scenarioShowSelected =
            (stepFormData["scenarioShowSelected"] as boolean | undefined) ?? false;
          const hasSelectedScenarios =
            (formState.scenario_ids ?? []).length > 0;
          const showScenarioFlags =
            (currentSimulationData.show_scenario_flags ?? false) ||
            hasSelectedScenarios;
          const showScenarioPersonas =
            (currentSimulationData.show_scenario_personas ?? false) ||
            hasSelectedScenarios;
          const showScenarioPositions =
            (currentSimulationData.show_scenario_positions ?? false) ||
            hasSelectedScenarios;
          const showScenarioRubrics =
            (currentSimulationData.show_scenario_rubrics ?? false) ||
            hasSelectedScenarios;
          const showScenarioTimeLimits =
            (currentSimulationData.show_scenario_time_limits ?? false) ||
            hasSelectedScenarios;

          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={disabled}
              isEditMode={isEditMode}
              resetFields={[
                "scenario_ids",
                "scenario_flag_ids",
                "scenario_persona_ids",
                "scenario_position_ids",
                "scenario_rubric_ids",
                "scenario_time_limit_ids",
                "scenarioSearch",
                "scenarioShowSelected",
              ]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
              filters={[
                {
                  key: "scenarioShowSelected",
                  label: "Show selected only",
                  value: scenarioShowSelected,
                  onChange: (value: boolean) =>
                    setStepFormData({ scenarioShowSelected: value }),
                },
              ]}
              searchTerm={scenarioSearch ?? ""}
              onSearchChange={(term: string) =>
                setStepFormData({ scenarioSearch: term || null })
              }
              searchPlaceholder="Search scenarios..."
              actions={
                stepResources["scenarios"] &&
                stepResources["scenarios"].length > 0 &&
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
                              "scenarios"
                            ]!.some((rt) => canRegenerate(rt));
                            handleOpenStepCardModal(
                              "scenarios",
                              hasRegeneratable ? "regenerate" : "generate"
                            );
                          }}
                          disabled={
                            disabled ||
                            stepResources["scenarios"]!.some((rt) =>
                              isGenerating(rt)
                            )
                          }
                        >
                          {stepResources["scenarios"]!.some((rt) =>
                            isGenerating(rt)
                          ) ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Sparkles className="h-4 w-4" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {stepResources["scenarios"]!.some((rt) =>
                          canRegenerate(rt)
                        )
                          ? "Regenerate"
                          : "Generate"}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ) : undefined
              }
            >
              <div className="space-y-6">
                <Scenarios
                  scenario_ids={formState.scenario_ids ?? []}
                  scenario_resources={
                    currentSimulationData.scenario_resources ?? []
                  }
                  show_scenarios={
                    currentSimulationData.show_scenarios ?? false
                  }
                  scenario_suggestions={
                    currentSimulationData.scenario_suggestions ?? []
                  }
                  scenarios={currentSimulationData.scenarios ?? []}
                  disabled={disabled}
                  onChange={(ids) =>
                    setFormState((prev) => ({ ...prev, scenario_ids: ids }))
                  }
                  onGenerate={handleGenerateScenarios}
                  isGenerating={isGenerating("scenarios")}
                  group_id={currentSimulationData.group_id ?? null}
                  agent_id={currentSimulationData.scenarios_agent_id ?? null}
                  required={currentSimulationData.scenarios_required ?? false}
                  searchTerm={scenarioSearch ?? ""}
                  showSelectedOnly={scenarioShowSelected}
                  aiScenarioResources={aiFormData.scenario_resources ?? null}
                  onAccept={() => clearAiResource("scenario_resources")}
                  onReject={() => clearAiResource("scenario_resources")}
                />
                <ScenarioFlags
                  scenario_flag_ids={formState.scenario_flag_ids ?? []}
                  scenario_flag_resources={
                    currentSimulationData.scenario_flag_resources ?? []
                  }
                  show_scenario_flags={
                    showScenarioFlags
                  }
                  scenario_flag_suggestions={
                    currentSimulationData.scenario_flag_suggestions ?? []
                  }
                  scenario_flags={currentSimulationData.scenario_flags ?? []}
                  scenario_ids={formState.scenario_ids ?? []}
                  scenarios={currentSimulationData.scenarios ?? []}
                  scenario_resources={scenarioResourcesWithShowHints}
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
                  isAutosaveEnabled={isAutosaveEnabled}
                  registerFlush={registerFlushCallbacks.scenario_flags}
                />
                <ScenarioPersonas
                  scenario_persona_ids={formState.scenario_persona_ids ?? []}
                  scenario_persona_resources={
                    currentSimulationData.scenario_persona_resources ?? []
                  }
                  show_scenario_personas={
                    showScenarioPersonas
                  }
                  scenario_persona_suggestions={
                    currentSimulationData.scenario_persona_suggestions ?? []
                  }
                  scenario_personas={
                    currentSimulationData.scenario_personas ?? []
                  }
                  scenarios={currentSimulationData.scenarios ?? []}
                  scenario_resources={
                    currentSimulationData.scenario_resources ?? []
                  }
                  disabled={disabled}
                  onChange={() => {}}
                  onPersonaIdsChange={(ids) =>
                    setFormState((prev) => ({
                      ...prev,
                      scenario_persona_ids: ids,
                    }))
                  }
                  simulation_id={simulationId || null}
                  scenario_ids={formState.scenario_ids}
                  createScenarioPersonasAction={createScenarioPersonasAction}
                  onGenerate={handleGenerateScenarioPersonas}
                  isGenerating={isGenerating("scenario_personas")}
                  group_id={currentSimulationData.group_id ?? null}
                  agent_id={
                    currentSimulationData.scenario_personas_agent_id ?? null
                  }
                  required={
                    currentSimulationData.scenario_personas_required ?? false
                  }
                  isAutosaveEnabled={isAutosaveEnabled}
                  registerFlush={registerFlushCallbacks.scenario_personas}
                />
                <ScenarioPositions
                  scenario_position_ids={formState.scenario_position_ids ?? []}
                  scenario_position_resources={
                    currentSimulationData.scenario_position_resources ?? []
                  }
                  show_scenario_positions={
                    showScenarioPositions
                  }
                  scenario_position_suggestions={
                    currentSimulationData.scenario_position_suggestions ?? []
                  }
                  scenario_positions={
                    currentSimulationData.scenario_positions ?? []
                  }
                  scenarios={currentSimulationData.scenarios ?? []}
                  scenario_resources={
                    currentSimulationData.scenario_resources ?? []
                  }
                  disabled={disabled}
                  onChange={() => {}}
                  onPositionIdsChange={(ids) =>
                    setFormState((prev) => ({
                      ...prev,
                      scenario_position_ids: ids,
                    }))
                  }
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
                  isAutosaveEnabled={isAutosaveEnabled}
                  registerFlush={registerFlushCallbacks.scenario_positions}
                />
                <ScenarioRubrics
                  scenario_rubric_ids={
                    formState.scenario_rubric_ids ?? []
                  }
                  scenario_rubric_resources={
                    currentSimulationData.scenario_rubric_resources ??
                    []
                  }
                  show_scenario_rubrics={
                    showScenarioRubrics
                  }
                  scenario_rubric_suggestions={
                    currentSimulationData.scenario_rubric_suggestions ??
                    []
                  }
                  scenario_rubrics={
                    currentSimulationData.scenario_rubrics ?? []
                  }
                  rubrics={currentSimulationData.rubrics ?? []}
                  scenario_ids={formState.scenario_ids ?? []}
                  scenarios={currentSimulationData.scenarios ?? []}
                  scenario_resources={
                    currentSimulationData.scenario_resources ?? []
                  }
                  disabled={disabled}
                  onChange={(ids) =>
                    setFormState((prev) => ({
                      ...prev,
                      scenario_rubric_ids: ids,
                    }))
                  }
                  createScenarioRubricsAction={
                    createScenarioRubricsAction
                  }
                  onGenerate={handleGenerateScenarioRubrics}
                  isGenerating={isGenerating("scenario_rubrics")}
                  group_id={currentSimulationData.group_id ?? null}
                  agent_id={
                    currentSimulationData.scenario_rubrics_agent_id ??
                    null
                  }
                  required={
                    currentSimulationData.scenario_rubrics_required ??
                    false
                  }
                  isAutosaveEnabled={isAutosaveEnabled}
                  registerFlush={registerFlushCallbacks.scenario_rubrics}
                />
                <ScenarioTimeLimits
                  scenario_time_limit_ids={
                    formState.scenario_time_limit_ids ?? []
                  }
                  scenario_time_limit_resources={
                    currentSimulationData.scenario_time_limit_resources ?? []
                  }
                  show_scenario_time_limits={showScenarioTimeLimits}
                  scenario_ids={formState.scenario_ids ?? []}
                  scenarios={currentSimulationData.scenarios ?? []}
                  scenario_resources={currentSimulationData.scenario_resources ?? []}
                  disabled={disabled}
                  onTimeLimitIdsChange={(ids) =>
                    setFormState((prev) => ({
                      ...prev,
                      scenario_time_limit_ids: ids,
                    }))
                  }
                  group_id={currentSimulationData.group_id ?? null}
                  agent_id={
                    currentSimulationData.scenario_time_limits_agent_id ?? null
                  }
                  createScenarioTimeLimitsAction={
                    createScenarioTimeLimitsAction
                  }
                  onGenerate={handleGenerateScenarioTimeLimits}
                  isGenerating={isGenerating("scenario_time_limits")}
                  required={
                    currentSimulationData.scenario_time_limits_required ?? false
                  }
                  isAutosaveEnabled={isAutosaveEnabled}
                  registerFlush={registerFlushCallbacks.scenario_time_limits}
                />
              </div>
            </StepCard>
          );
        }
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
      handleGenerateScenarioPersonas,
      handleGenerateScenarioPositions,
      handleGenerateScenarioRubrics,
      handleGenerateScenarioTimeLimits,
      isGenerating,
      stepResources,
      canRegenerate,
      handleOpenStepCardModal,
      createNamesAction,
      createDescriptionsAction,
      createScenarioFlagsAction,
      createScenarioPersonasAction,
      createScenarioPositionsAction,
      createScenarioRubricsAction,
      createScenarioTimeLimitsAction,
      scenarioResourcesWithShowHints,
      isAutosaveEnabled,
      registerFlushCallbacks,
      aiFormData,
      clearAiResource,
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
        onReset={(stepId) => handleReset(stepId)}
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
    flag_ids: prevProps.simulationData?.flag_ids,
    department_ids: prevProps.simulationData?.department_ids,
    scenario_ids: prevProps.simulationData?.scenario_ids,
    scenario_flag_ids: prevProps.simulationData?.scenario_flag_ids,
    scenario_persona_ids: prevProps.simulationData?.scenario_persona_ids,
    scenario_position_ids: prevProps.simulationData?.scenario_position_ids,
    scenario_rubric_ids: prevProps.simulationData?.scenario_rubric_ids,
    scenario_time_limit_ids:
      prevProps.simulationData?.scenario_time_limit_ids,
  };
  const nextIds = {
    name_id: nextProps.simulationData?.name_id,
    description_id: nextProps.simulationData?.description_id,
    flag_ids: nextProps.simulationData?.flag_ids,
    department_ids: nextProps.simulationData?.department_ids,
    scenario_ids: nextProps.simulationData?.scenario_ids,
    scenario_flag_ids: nextProps.simulationData?.scenario_flag_ids,
    scenario_persona_ids: nextProps.simulationData?.scenario_persona_ids,
    scenario_position_ids: nextProps.simulationData?.scenario_position_ids,
    scenario_rubric_ids: nextProps.simulationData?.scenario_rubric_ids,
    scenario_time_limit_ids:
      nextProps.simulationData?.scenario_time_limit_ids,
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
    prevProps.createScenarioFlagsAction !==
      nextProps.createScenarioFlagsAction ||
    prevProps.createScenarioPersonasAction !==
      nextProps.createScenarioPersonasAction ||
    prevProps.createScenarioPositionsAction !==
      nextProps.createScenarioPositionsAction ||
    prevProps.createScenarioRubricsAction !==
      nextProps.createScenarioRubricsAction ||
    prevProps.createScenarioTimeLimitsAction !==
      nextProps.createScenarioTimeLimitsAction
  ) {
    return false; // Function props changed, re-render
  }

  // All props are equivalent, skip re-render
  return true;
});
