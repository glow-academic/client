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
import { useAiGeneration } from "@/hooks/use-ai-generation";
import { useDraftLifecycle } from "@/hooks/use-draft-lifecycle";
import { useFlushRegistry } from "@/hooks/use-flush-registry";
import { useGenerationModal } from "@/hooks/use-generation-modal";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { ResourceType } from "@/lib/resources/types";
import { parseAsBoolean, parseAsString, type Parser } from "nuqs";

// Types defined inline using InputOf/OutputOf
type SaveSimulationIn = InputOf<"/api/v4/artifacts/simulations/save", "post">;
type SaveSimulationOut = OutputOf<"/api/v4/artifacts/simulations/save", "post">;
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
type PatchSimulationDraftIn = InputOf<"/api/v4/artifacts/simulations/draft", "patch">;
type PatchSimulationDraftOut = OutputOf<"/api/v4/artifacts/simulations/draft", "patch">;

type SimulationData = OutputOf<"/api/v4/artifacts/simulations/get", "post">;
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

// AI form data shape for simulation generation
type SimulationAiFormData = {
  scenario_resources?: Array<{
    scenario_id?: string | null;
    name?: string | null;
    title?: string | null;
  }>;
};

type SimulationFormState = {
  name_id: string | null;
  description_id: string | null;
  flag_ids: string[];
  department_ids: string[];
  scenario_ids: string[];
  scenario_flag_ids: string[];
  scenario_persona_ids: string[];
  scenario_position_ids: string[];
  scenario_rubric_ids: string[];
  scenario_time_limit_ids: string[];
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

const FLUSH_KEYS = [
  "names",
  "descriptions",
  "scenario_flags",
  "scenario_personas",
  "scenario_positions",
  "scenario_rubrics",
  "scenario_time_limits",
] as const;

const VALID_RESOURCE_TYPES: SimulationResourceType[] = [
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

  // --- Flush Registry ---
  const { flushRegistryRef, registerFlushCallbacks, flushAllResources } =
    useFlushRegistry<FlushResult>(FLUSH_KEYS);

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

  const getInitialFormState = useCallback((): SimulationFormState => {
    const data = simulationDataRef.current;
    if (!data) {
      return {
        name_id: null,
        description_id: null,
        flag_ids: [],
        department_ids: [],
        scenario_ids: [],
        scenario_flag_ids: [],
        scenario_persona_ids: [],
        scenario_position_ids: [],
        scenario_rubric_ids: [],
        scenario_time_limit_ids: [],
      };
    }
    return {
      name_id: data.name_id ?? null,
      description_id: data.description_id ?? null,
      flag_ids: data.flag_ids ?? [],
      department_ids: data.department_ids ?? [],
      scenario_ids: data.scenario_ids ?? [],
      scenario_flag_ids: data.scenario_flag_ids ?? [],
      scenario_persona_ids: data.scenario_persona_ids ?? [],
      scenario_position_ids: data.scenario_position_ids ?? [],
      scenario_rubric_ids: data.scenario_rubric_ids ?? [],
      scenario_time_limit_ids: data.scenario_time_limit_ids ?? [],
    };
  }, []);

  const [formState, setFormState] = useState<SimulationFormState>(getInitialFormState);

  // --- AI Generation ---
  // Use a ref to access current formState in the onComplete callback
  // without creating a dependency that would recreate the callback
  const formStateForAiRef = React.useRef<SimulationFormState>(formState);
  React.useEffect(() => {
    formStateForAiRef.current = formState;
  }, [formState]);

  const onAiComplete = useCallback(
    (data: Record<string, unknown>) => {
      const currentFormState = formStateForAiRef.current;
      const aiUpdates: Partial<SimulationAiFormData> = {};
      const formStateUpdates: Record<string, unknown> = {};

      // Auto-apply name_id and description_id
      if (data["name_id"]) formStateUpdates["name_id"] = data["name_id"];
      if (data["description_id"]) formStateUpdates["description_id"] = data["description_id"];

      // For array IDs, append and deduplicate using current formState
      const flagIds = data["flag_ids"] as string[] | undefined;
      if (flagIds && flagIds.length > 0 && currentFormState) {
        const newFlagIds = flagIds.filter(
          (id) => !currentFormState.flag_ids.includes(id)
        );
        formStateUpdates["flag_ids"] = [...currentFormState.flag_ids, ...newFlagIds];
      }

      const departmentIds = data["department_ids"] as string[] | undefined;
      if (departmentIds && departmentIds.length > 0 && currentFormState) {
        const newDeptIds = departmentIds.filter(
          (id) => !currentFormState.department_ids.includes(id)
        );
        formStateUpdates["department_ids"] = [...currentFormState.department_ids, ...newDeptIds];
      }

      // Scenarios go to aiFormData for diff view (not auto-applied)
      if (
        data["resource_type"] === "scenarios" &&
        data["scenario_resources"] &&
        (data["scenario_resources"] as unknown[]).length > 0
      ) {
        aiUpdates.scenario_resources = data["scenario_resources"] as SimulationAiFormData["scenario_resources"];
      }

      const scenarioFlagIds = data["scenario_flag_ids"] as string[] | undefined;
      if (scenarioFlagIds && scenarioFlagIds.length > 0 && currentFormState) {
        const newIds = scenarioFlagIds.filter(
          (id) => !currentFormState.scenario_flag_ids.includes(id)
        );
        formStateUpdates["scenario_flag_ids"] = [...currentFormState.scenario_flag_ids, ...newIds];
      }

      const scenarioPersonaIds = data["scenario_persona_ids"] as string[] | undefined;
      if (scenarioPersonaIds && scenarioPersonaIds.length > 0 && currentFormState) {
        const newIds = scenarioPersonaIds.filter(
          (id) => !currentFormState.scenario_persona_ids.includes(id)
        );
        formStateUpdates["scenario_persona_ids"] = [...currentFormState.scenario_persona_ids, ...newIds];
      }

      const scenarioPositionIds = data["scenario_position_ids"] as string[] | undefined;
      if (scenarioPositionIds && scenarioPositionIds.length > 0 && currentFormState) {
        const newIds = scenarioPositionIds.filter(
          (id) => !currentFormState.scenario_position_ids.includes(id)
        );
        formStateUpdates["scenario_position_ids"] = [...currentFormState.scenario_position_ids, ...newIds];
      }

      const scenarioRubricIds = data["scenario_rubric_ids"] as string[] | undefined;
      if (scenarioRubricIds && scenarioRubricIds.length > 0 && currentFormState) {
        const newIds = scenarioRubricIds.filter(
          (id) => !currentFormState.scenario_rubric_ids.includes(id)
        );
        formStateUpdates["scenario_rubric_ids"] = [...currentFormState.scenario_rubric_ids, ...newIds];
      }

      const scenarioTimeLimitIds = data["scenario_time_limit_ids"] as string[] | undefined;
      if (scenarioTimeLimitIds && scenarioTimeLimitIds.length > 0 && currentFormState) {
        const newIds = scenarioTimeLimitIds.filter(
          (id) => !currentFormState.scenario_time_limit_ids.includes(id)
        );
        formStateUpdates["scenario_time_limit_ids"] = [...currentFormState.scenario_time_limit_ids, ...newIds];
      }

      return { aiUpdates, formStateUpdates };
    },
    []
  );

  const groupId = simulationData?.group_id;

  const {
    setGeneratingResources,
    isGenerating,
    aiFormData,
    clearAiResource,
  } = useAiGeneration<SimulationResourceType, SimulationAiFormData>({
    socket,
    isConnected,
    artifactType: "simulation",
    groupId,
    eventPrefix: "simulation_generation",
    validResourceTypes: VALID_RESOURCE_TYPES,
    onComplete: onAiComplete,
    setFormState: setFormState as unknown as React.Dispatch<React.SetStateAction<Record<string, unknown>>>,
  });

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

  // Use ref to access formState in renderStep without depending on it
  const formStateRef = React.useRef<Record<string, unknown>>(formState as unknown as Record<string, unknown>);
  React.useEffect(() => {
    formStateRef.current = formState as unknown as Record<string, unknown>;
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
        serverSyncPendingRef.current = true;
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

  // --- Draft Lifecycle ---
  const patchSimulationDraftActionRef = React.useRef(
    patchSimulationDraftAction
  );
  React.useEffect(() => {
    patchSimulationDraftActionRef.current = patchSimulationDraftAction;
  }, [patchSimulationDraftAction]);

  // Stable ref wrapper for patch action
  const patchActionRef = React.useRef<
    ((payload: Record<string, unknown>) => Promise<{ draft_id?: string | null; new_version?: number | null }>) | undefined
  >(undefined);
  React.useEffect(() => {
    if (patchSimulationDraftAction) {
      patchActionRef.current = async (payload: Record<string, unknown>) => {
        return await patchSimulationDraftAction({ body: payload } as PatchSimulationDraftIn);
      };
    } else {
      patchActionRef.current = undefined;
    }
  }, [patchSimulationDraftAction]);

  // formStateKey excludes draftId -- the hook prepends it
  const formStateKey = React.useMemo(
    () =>
      JSON.stringify({
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
      }),
    // Use stringified arrays to prevent recreation when array references change but content is same
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
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
    ]
  );

  const hasResourceIds = !!(
    formState.name_id ||
    formState.description_id ||
    formState.flag_ids.length > 0 ||
    formState.department_ids.length > 0 ||
    formState.scenario_ids.length > 0 ||
    formState.scenario_flag_ids.length > 0 ||
    formState.scenario_persona_ids.length > 0 ||
    formState.scenario_position_ids.length > 0 ||
    formState.scenario_rubric_ids.length > 0 ||
    formState.scenario_time_limit_ids.length > 0
  );

  const buildPatchPayload = useCallback(
    (
      draftId: string | null,
      expectedVersion: number,
      flushResults?: Record<string, unknown>
    ): Record<string, unknown> => {
      const currentFormState = formStateRef.current as unknown as SimulationFormState;
      const fr = (flushResults ?? {}) as Partial<FlushResult>;
      return {
        input_draft_id: draftId || null,
        name_id: fr.name_id !== undefined ? fr.name_id : currentFormState.name_id,
        description_id: fr.description_id !== undefined ? fr.description_id : currentFormState.description_id,
        flag_ids: currentFormState.flag_ids,
        department_ids: currentFormState.department_ids,
        scenario_ids: currentFormState.scenario_ids,
        scenario_flag_ids: fr.scenario_flag_ids !== undefined ? fr.scenario_flag_ids : currentFormState.scenario_flag_ids,
        scenario_persona_ids: fr.scenario_persona_ids !== undefined ? fr.scenario_persona_ids : currentFormState.scenario_persona_ids,
        scenario_position_ids: fr.scenario_position_ids !== undefined ? fr.scenario_position_ids : currentFormState.scenario_position_ids,
        scenario_rubric_ids: fr.scenario_rubric_ids !== undefined ? fr.scenario_rubric_ids : currentFormState.scenario_rubric_ids,
        scenario_time_limit_ids: fr.scenario_time_limit_ids !== undefined ? fr.scenario_time_limit_ids : currentFormState.scenario_time_limit_ids,
        expected_version: expectedVersion,
      };
    },
    []
  );

  const draftVersion =
    simulationData && "draft_version" in simulationData
      ? (simulationData as { draft_version?: number | null }).draft_version
      : null;

  const {
    setUrlFormDataRef,
    onFormDataChange,
    serverSyncPendingRef,
    formDataRef,
  } = useDraftLifecycle({
    formStateKey,
    patchActionRef,
    isAutosaveEnabled,
    buildPatchPayload,
    setSelectedDraftId,
    serverDraftVersion: draftVersion ?? null,
    hasResourceIds,
    flushRegistryRef,
    formStateRef,
  });

  // --- Generation Handlers ---
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
    [socket, isConnected, simulationId, setGeneratingResources, formDataRef]
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
      const baseFormState = formStateRef.current as unknown as SimulationFormState;
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

  // --- Generation Modal ---
  const onModalGenerate = useCallback(
    (selectedResources: SimulationResourceType[], instructions?: string) => {
      const agentType = determineAgentType(selectedResources);
      handleGenerateResources(
        selectedResources,
        agentType,
        instructions
      );
    },
    [handleGenerateResources, determineAgentType]
  );

  const { handleOpenStepCardModal, modalProps } = useGenerationModal<SimulationResourceType>({
    stepResources,
    resourceLabels,
    canRegenerate,
    onGenerate: onModalGenerate,
    isGenerating,
  });

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
                  registerFlush={registerFlushCallbacks["names"]}
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
                  registerFlush={registerFlushCallbacks["descriptions"]}
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
                  registerFlush={registerFlushCallbacks["scenario_flags"]}
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
                  registerFlush={registerFlushCallbacks["scenario_personas"]}
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
                  registerFlush={registerFlushCallbacks["scenario_positions"]}
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
                  registerFlush={registerFlushCallbacks["scenario_rubrics"]}
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
                  registerFlush={registerFlushCallbacks["scenario_time_limits"]}
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

        {modalProps.open && (
          <GenerateRegenerateModal {...modalProps} />
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
