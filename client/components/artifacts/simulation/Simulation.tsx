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
import { StepCardAiButton } from "@/components/common/forms/StepCardAiButton";
import { ReadOnlyBanner } from "@/components/common/forms/ReadOnlyBanner";
import { Departments } from "@/components/resources/Departments";
import { Descriptions } from "@/components/resources/Descriptions";
import { Flags } from "@/components/resources/Flags";
import { Names } from "@/components/resources/Names";
import { ScenarioFlags } from "@/components/resources/ScenarioFlags";
import { ScenarioPositions } from "@/components/resources/ScenarioPositions";
import { ScenarioRubrics } from "@/components/resources/ScenarioRubrics";
import { ScenarioTimeLimits } from "@/components/resources/ScenarioTimeLimits";
import { Scenarios } from "@/components/resources/Scenarios";
import { TooltipProvider } from "@/components/ui/tooltip";

import { useProfile } from "@/contexts/profile-context";
import { useDrafts } from "@/contexts/draft-context";
import { useArtifactAi } from "@/hooks/use-artifact-ai";
import { useDraftLifecycle } from "@/hooks/use-draft-lifecycle";
import { useFlushRegistry } from "@/hooks/use-flush-registry";
import type { InputOf, OutputOf } from "@/lib/api/types";
import {
  buildDraftPayload,
  checkHasResourceIds,
  computeEffectiveFormState,
  type ResourceConfig,
} from "@/lib/resources/action-builders";
import type { ResourceType } from "@/lib/resources/types";
import { parseAsBoolean, parseAsString, type Parser } from "nuqs";

// Types defined inline using InputOf/OutputOf
type SaveSimulationIn = InputOf<"/api/v5/artifacts/simulations/save", "post">;
type SaveSimulationOut = OutputOf<"/api/v5/artifacts/simulations/save", "post">;
type CreateDraftNamesIn = InputOf<"/api/v5/resources/names", "post">;
type CreateDraftNamesOut = OutputOf<"/api/v5/resources/names", "post">;
type CreateDraftDescriptionsIn = InputOf<
  "/api/v5/resources/descriptions",
  "post"
>;
type CreateDraftDescriptionsOut = OutputOf<
  "/api/v5/resources/descriptions",
  "post"
>;
type CreateDraftScenarioPositionsIn = InputOf<
  "/api/v5/resources/scenario_positions",
  "post"
>;
type CreateDraftScenarioPositionsOut = OutputOf<
  "/api/v5/resources/scenario_positions",
  "post"
>;
type CreateDraftScenarioRubricsIn = InputOf<
  "/api/v5/resources/scenario_rubrics",
  "post"
>;
type CreateDraftScenarioRubricsOut = OutputOf<
  "/api/v5/resources/scenario_rubrics",
  "post"
>;
type CreateDraftScenarioTimeLimitsIn = InputOf<
  "/api/v5/resources/scenario_time_limits",
  "post"
>;
type CreateDraftScenarioTimeLimitsOut = OutputOf<
  "/api/v5/resources/scenario_time_limits",
  "post"
>;
type PatchSimulationDraftIn = InputOf<
  "/api/v5/artifacts/simulations/draft",
  "patch"
>;
type PatchSimulationDraftOut = OutputOf<
  "/api/v5/artifacts/simulations/draft",
  "patch"
>;

type SimulationData = OutputOf<"/api/v5/artifacts/simulations/get", "post">;
type SimulationResourceType =
  | ResourceType
  | "scenario_time_limits";
type GeneratedResource = { generated?: boolean | null };

const EMPTY_FORM_STATE: SimulationFormState = {
  name_id: null,
  description_id: null,
  flag_ids: [],
  department_ids: [],
  scenario_ids: [],
  scenario_flag_ids: [],
  scenario_position_ids: [],
  scenario_rubric_ids: [],
  scenario_time_limit_ids: [],
};

// Type for flush results - each resource returns its created ID(s)
type FlushResult = {
  name_id?: string | null;
  description_id?: string | null;
  scenario_flag_ids?: string[];
  scenario_position_ids?: string[];
  scenario_rubric_ids?: string[];
  scenario_time_limit_ids?: string[];
};

type SimulationFormState = {
  name_id: string | null;
  description_id: string | null;
  flag_ids: string[];
  department_ids: string[];
  scenario_ids: string[];
  scenario_flag_ids: string[];
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
    input: SaveSimulationIn,
  ) => Promise<SaveSimulationOut>;
  patchSimulationDraftAction?: (
    input: PatchSimulationDraftIn,
  ) => Promise<PatchSimulationDraftOut>;
  // Resource creation actions
  createNamesAction?: (
    input: CreateDraftNamesIn,
  ) => Promise<CreateDraftNamesOut>;
  createDescriptionsAction?: (
    input: CreateDraftDescriptionsIn,
  ) => Promise<CreateDraftDescriptionsOut>;
  createScenarioFlagsAction?: React.ComponentProps<
    typeof ScenarioFlags
  >["createScenarioFlagsAction"];
  createScenarioPositionsAction?: (
    input: CreateDraftScenarioPositionsIn,
  ) => Promise<CreateDraftScenarioPositionsOut>;
  createScenarioRubricsAction?: (
    input: CreateDraftScenarioRubricsIn,
  ) => Promise<CreateDraftScenarioRubricsOut>;
  createScenarioTimeLimitsAction?: (
    input: CreateDraftScenarioTimeLimitsIn,
  ) => Promise<CreateDraftScenarioTimeLimitsOut>;
}

const FLUSH_KEYS = [
  "names",
  "descriptions",
  "scenario_flags",
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
  "scenario_positions",
  "scenario_rubrics",
  "scenario_time_limits",
];

const SIMULATION_RESOURCES: ResourceConfig[] = [
  { key: "names", formKey: "name_id", flushKey: "name_id", type: "single" },
  {
    key: "descriptions",
    formKey: "description_id",
    flushKey: "description_id",
    type: "single",
  },
  { key: "flags", formKey: "flag_ids", flushKey: null, type: "multi" },
  {
    key: "departments",
    formKey: "department_ids",
    flushKey: null,
    type: "multi",
  },
  { key: "scenarios", formKey: "scenario_ids", flushKey: null, type: "multi" },
  {
    key: "scenario_flags",
    formKey: "scenario_flag_ids",
    flushKey: "scenario_flag_ids",
    type: "multi",
  },
  {
    key: "scenario_positions",
    formKey: "scenario_position_ids",
    flushKey: "scenario_position_ids",
    type: "multi",
  },
  {
    key: "scenario_rubrics",
    formKey: "scenario_rubric_ids",
    flushKey: "scenario_rubric_ids",
    type: "multi",
  },
  {
    key: "scenario_time_limits",
    formKey: "scenario_time_limit_ids",
    flushKey: "scenario_time_limit_ids",
    type: "multi",
  },
];

function SimulationComponent({
  simulationId,
  simulationData,
  saveSimulationAction,
  patchSimulationDraftAction,
  createNamesAction,
  createDescriptionsAction,
  createScenarioFlagsAction,
  createScenarioPositionsAction,
  createScenarioRubricsAction,
  createScenarioTimeLimitsAction,
}: SimulationProps) {
  const router = useRouter();
  const isEditMode = !!simulationId;
  const { profile } = useProfile();
  const { setSelectedDraftId, isAutosaveEnabled } = useDrafts();

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
    [],
  );

  // Local form state (not in URL) - stores only resource IDs
  // Display values are managed inside resource components
  // Use ref to store simulationData to prevent callback recreation on every render
  const simulationDataRef = React.useRef(simulationData);
  React.useEffect(() => {
    simulationDataRef.current = simulationData;
  }, [simulationData]);

  const stableSimulationDataFields = React.useMemo(() => {
    if (!simulationData) return null;
    return {
      names: simulationData.names,
      descriptions: simulationData.descriptions,
      flags: simulationData.flags,
      departments: simulationData.departments,
      scenarios: simulationData.scenarios,
      scenario_flags: simulationData.scenario_flags,
      scenario_positions: simulationData.scenario_positions,
      scenario_rubrics: simulationData.scenario_rubrics,
      scenario_time_limits: simulationData.scenario_time_limits,
      rubrics: simulationData.rubrics,
      draft_version: simulationData.draft_version,
      can_edit: simulationData.can_edit,
      disabled_reason: simulationData.disabled_reason,
      basic_show_ai_generate: simulationData.basic_show_ai_generate,
    };
  }, [simulationData]);

  const getInitialFormState = useCallback((): SimulationFormState => {
    const data = simulationDataRef.current;
    if (!data) return EMPTY_FORM_STATE;
    return {
      name_id: data.names?.resource?.id ?? null,
      description_id: data.descriptions?.resource?.id ?? null,
      flag_ids: (data.flags?.current ?? [])
        .map((x) => x.flag_option_id)
        .filter(Boolean) as string[],
      department_ids: (data.departments?.current ?? [])
        .map((x) => x.department_id)
        .filter(Boolean) as string[],
      scenario_ids: (data.scenarios?.current ?? [])
        .map((x) => x.scenario_id)
        .filter(Boolean) as string[],
      scenario_flag_ids: (data.scenario_flags?.current ?? [])
        .map((x) => x.id)
        .filter(Boolean) as string[],
      scenario_position_ids: (data.scenario_positions?.current ?? [])
        .map((x) => x.id)
        .filter(Boolean) as string[],
      scenario_rubric_ids: (data.scenario_rubrics?.current ?? [])
        .map((x) => x.id)
        .filter(Boolean) as string[],
      scenario_time_limit_ids: (data.scenario_time_limits?.current ?? [])
        .map((x) => x.id)
        .filter(Boolean) as string[],
    };
  }, []);

  const [formState, setFormState] =
    useState<SimulationFormState>(getInitialFormState);

  // --- AI Generation ---
  const { isGenerating, makeOnGenerationComplete, generate } = useArtifactAi({
    artifactType: "simulation",
    validResourceTypes: VALID_RESOURCE_TYPES,
  });

  // Helper to check if a resource type can be regenerated
  // Use stableSimulationDataFields to prevent callback recreation when simulationData object reference changes
  const canRegenerate: (resourceType: string) => boolean = useCallback(
    (resourceType: string): boolean => {
      if (!stableSimulationDataFields) return false;
      switch (resourceType) {
        case "names":
          return stableSimulationDataFields.names?.resource?.generated ?? false;
        case "descriptions":
          return (
            stableSimulationDataFields.descriptions?.resource?.generated ??
            false
          );
        case "flags":
          return (
            stableSimulationDataFields.flags?.current?.some(
              (f: GeneratedResource) => f.generated,
            ) ?? false
          );
        case "departments":
          return (
            stableSimulationDataFields.departments?.current?.some(
              (d: GeneratedResource) => d.generated,
            ) ?? false
          );
        case "scenarios":
          return (
            stableSimulationDataFields.scenarios?.current?.some(
              (s: GeneratedResource) => s.generated,
            ) ?? false
          );
        case "scenario_flags":
          return (
            stableSimulationDataFields.scenario_flags?.current?.some(
              (f: GeneratedResource) => f.generated,
            ) ?? false
          );
        case "scenario_positions":
          return (
            stableSimulationDataFields.scenario_positions?.current?.some(
              (p: GeneratedResource) => p.generated,
            ) ?? false
          );
        case "scenario_rubrics":
          return (
            stableSimulationDataFields.scenario_rubrics?.current?.some(
              (r: GeneratedResource) => r.generated,
            ) ?? false
          );
        case "scenario_time_limits":
          return (
            stableSimulationDataFields.scenario_time_limits?.current?.some(
              (t: GeneratedResource) => t.generated,
            ) ?? false
          );
        default:
          return false;
      }
    },
    [stableSimulationDataFields],
  );

  // Use ref to access formState in renderStep without depending on it
  const formStateRef = React.useRef<Record<string, unknown>>(
    formState as unknown as Record<string, unknown>,
  );
  React.useEffect(() => {
    formStateRef.current = formState as unknown as Record<string, unknown>;
  }, [formState]);

  // Memoize stringified formState arrays for draft listener effect dependencies
  const formStateFlagIdsStr = React.useMemo(
    () => JSON.stringify(formState.flag_ids),
    [formState.flag_ids],
  );
  const formStateDepartmentIdsStr = React.useMemo(
    () => JSON.stringify(formState.department_ids),
    [formState.department_ids],
  );
  const formStateScenarioIdsStr = React.useMemo(
    () => JSON.stringify(formState.scenario_ids),
    [formState.scenario_ids],
  );
  const formStateScenarioFlagIdsStr = React.useMemo(
    () => JSON.stringify(formState.scenario_flag_ids),
    [formState.scenario_flag_ids],
  );
  const formStateScenarioPositionIdsStr = React.useMemo(
    () => JSON.stringify(formState.scenario_position_ids),
    [formState.scenario_position_ids],
  );
  const formStateScenarioRubricIdsStr = React.useMemo(
    () => JSON.stringify(formState.scenario_rubric_ids),
    [formState.scenario_rubric_ids],
  );
  const formStateScenarioTimeLimitIdsStr = React.useMemo(
    () => JSON.stringify(formState.scenario_time_limit_ids),
    [formState.scenario_time_limit_ids],
  );

  // --- Draft Lifecycle ---
  const patchSimulationDraftActionRef = React.useRef(
    patchSimulationDraftAction,
  );
  React.useEffect(() => {
    patchSimulationDraftActionRef.current = patchSimulationDraftAction;
  }, [patchSimulationDraftAction]);

  // Stable ref wrapper for patch action
  const patchActionRef = React.useRef<
    | ((
        payload: Record<string, unknown>,
      ) => Promise<{ draft_id?: string | null; new_version?: number | null }>)
    | undefined
  >(undefined);
  React.useEffect(() => {
    if (patchSimulationDraftAction) {
      patchActionRef.current = async (payload: Record<string, unknown>) => {
        return await patchSimulationDraftAction({
          body: payload,
        } as PatchSimulationDraftIn);
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
      formStateScenarioPositionIdsStr,
      formStateScenarioRubricIdsStr,
      formStateScenarioTimeLimitIdsStr,
    ],
  );

  const hasResourceIds = checkHasResourceIds(
    SIMULATION_RESOURCES,
    formState as unknown as Record<string, unknown>,
  );

  const buildPatchPayload = useCallback(
    (
      draftId: string | null,
      expectedVersion: number,
      flushResults?: Record<string, unknown>,
    ): Record<string, unknown> => {
      const currentFormState =
        formStateRef.current as unknown as SimulationFormState;
      const fr = (flushResults ?? {}) as Record<string, unknown>;
      const draftPayload = buildDraftPayload(SIMULATION_RESOURCES, {
        formState: currentFormState as unknown as Record<string, unknown>,
        referenceState: null,
        flushResults: fr,
      });
      return {
        input_draft_id: draftId || null,
        ...draftPayload,
        expected_version: expectedVersion,
      };
    },
    [stableSimulationDataFields],
  );

  const draftVersion =
    stableSimulationDataFields && "draft_version" in stableSimulationDataFields
      ? (stableSimulationDataFields as { draft_version?: number | null })
          .draft_version
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

  // Update form state when server data changes.
  useEffect(() => {
    const newState = getInitialFormState();
    setFormState((prev) => {
      if (
        prev.name_id !== newState.name_id ||
        prev.description_id !== newState.description_id ||
        JSON.stringify(prev.flag_ids) !== JSON.stringify(newState.flag_ids) ||
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
        serverSyncPendingRef.current = true;
        return newState;
      }
      return prev;
    });
  }, [stableSimulationDataFields, getInitialFormState, serverSyncPendingRef]);

  // --- Generation Handlers ---
  const handleGenerateResources = useCallback(
    async (
      resourceTypes: SimulationResourceType[],
      userInstructions?: string,
    ) => {
      const formData = formDataRef.current;
      const draftId = (formData["draftId"] as string | undefined) ?? null;

      generate(resourceTypes, {
        user_instructions: userInstructions ? [userInstructions] : null,
        draft_id: draftId || null,
      });
    },
    [generate, formDataRef],
  );

  // Individual generation handlers - generate directly without modals
  const handleGenerateName = useCallback(
    async () => handleGenerateResources(["names"]),
    [handleGenerateResources],
  );

  const handleGenerateDescription = useCallback(
    async () => handleGenerateResources(["descriptions"]),
    [handleGenerateResources],
  );

  const handleGenerateDepartments = useCallback(
    async () => handleGenerateResources(["departments"]),
    [handleGenerateResources],
  );

  const handleGenerateFlags = useCallback(
    async () => handleGenerateResources(["flags"]),
    [handleGenerateResources],
  );

  const handleGenerateScenarios = useCallback(
    async () => handleGenerateResources(["scenarios"]),
    [handleGenerateResources],
  );

  const handleGenerateScenarioFlags = useCallback(
    async () => handleGenerateResources(["scenario_flags"]),
    [handleGenerateResources],
  );

  const handleGenerateScenarioPositions = useCallback(
    async () => handleGenerateResources(["scenario_positions"]),
    [handleGenerateResources],
  );

  const handleGenerateScenarioRubrics = useCallback(
    async () => handleGenerateResources(["scenario_rubrics"]),
    [handleGenerateResources],
  );

  const handleGenerateScenarioTimeLimits = useCallback(
    async () => handleGenerateResources(["scenario_time_limits"]),
    [handleGenerateResources],
  );

  // Disabled logic based on can_edit flag - standardized for all resource components
  // Check can_edit in both new and edit modes to show disabled_reason when agents are missing
  const disabled = useMemo(() => {
    if (!stableSimulationDataFields) return false;
    return !(stableSimulationDataFields.can_edit as boolean | undefined);
  }, [stableSimulationDataFields]);

  // Submit handler for GenericForm (uses formState, not formData parameter)
  const handleSubmit = useCallback(
    async (_formData: Record<string, unknown>) => {
      // When autosave is disabled, flush all resources first to create them
      // This gets the IDs directly without saving to draft
      let flushResults: FlushResult = {};
      if (!isAutosaveEnabled) {
        flushResults = await flushAllResources();
      }

      const baseFormState =
        formStateRef.current as unknown as SimulationFormState;
      const effectiveFormState = computeEffectiveFormState(
        SIMULATION_RESOURCES,
        baseFormState as unknown as Record<string, unknown>,
        flushResults as Record<string, unknown>,
      ) as unknown as SimulationFormState;

      // Validate required resource IDs using {resource}_required flags from simulationData
      if (
        stableSimulationDataFields?.names?.required &&
        !effectiveFormState.name_id
      ) {
        toast.error("Simulation name is required");
        throw new Error("Simulation name is required");
      }

      if (
        stableSimulationDataFields?.departments?.required &&
        (!effectiveFormState.department_ids ||
          effectiveFormState.department_ids.length === 0)
      ) {
        toast.error("Departments are required");
        throw new Error("Departments are required");
      }

      if (
        stableSimulationDataFields?.flags?.required &&
        (!effectiveFormState.flag_ids ||
          effectiveFormState.flag_ids.length === 0)
      ) {
        toast.error("At least one flag is required");
        throw new Error("At least one flag is required");
      }

      if (
        stableSimulationDataFields?.descriptions?.required &&
        !effectiveFormState.description_id
      ) {
        toast.error("Description is required");
        throw new Error("Description is required");
      }

      if (
        stableSimulationDataFields?.scenarios?.required &&
        (!effectiveFormState.scenario_ids ||
          effectiveFormState.scenario_ids.length === 0)
      ) {
        toast.error("Scenarios are required");
        throw new Error("Scenarios are required");
      }

      if (
        stableSimulationDataFields?.scenario_flags?.required &&
        (!effectiveFormState.scenario_flag_ids ||
          effectiveFormState.scenario_flag_ids.length === 0)
      ) {
        toast.error("Scenario flags are required");
        throw new Error("Scenario flags are required");
      }

      if (
        stableSimulationDataFields?.scenario_positions?.required &&
        (!effectiveFormState.scenario_position_ids ||
          effectiveFormState.scenario_position_ids.length === 0)
      ) {
        toast.error("Scenario positions are required");
        throw new Error("Scenario positions are required");
      }

      if (
        stableSimulationDataFields?.scenario_rubrics?.required &&
        (!effectiveFormState.scenario_rubric_ids ||
          effectiveFormState.scenario_rubric_ids.length === 0)
      ) {
        toast.error("Scenario rubrics are required");
        throw new Error("Scenario rubrics are required");
      }

      if (
        stableSimulationDataFields?.scenario_time_limits?.required &&
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
            input_simulation_id:
              isEditMode && simulationId ? simulationId : null,
            name_id: effectiveFormState.name_id!,
            description_id: effectiveFormState.description_id || null,
            flag_ids: effectiveFormState.flag_ids.length > 0 ? effectiveFormState.flag_ids : null,
            department_ids: effectiveFormState.department_ids.length > 0 ? effectiveFormState.department_ids : null,
            scenario_ids: effectiveFormState.scenario_ids.length > 0 ? effectiveFormState.scenario_ids : null,
            scenario_flag_ids: effectiveFormState.scenario_flag_ids.length > 0 ? effectiveFormState.scenario_flag_ids : null,
            scenario_position_ids: effectiveFormState.scenario_position_ids.length > 0 ? effectiveFormState.scenario_position_ids : null,
            scenario_rubric_ids: effectiveFormState.scenario_rubric_ids.length > 0 ? effectiveFormState.scenario_rubric_ids : null,
            scenario_time_limit_ids: effectiveFormState.scenario_time_limit_ids.length > 0 ? effectiveFormState.scenario_time_limit_ids : null,
          },
        });
        toast.success(
          `Simulation ${isEditMode ? "updated" : "created"} successfully!`,
        );
        router.push("/training/simulations");
      } catch (error) {
        toast.error(
          `Failed to ${isEditMode ? "update" : "create"} simulation: ${error instanceof Error ? error.message : "Unknown error"}`,
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
      stableSimulationDataFields,
      router,
    ],
  );

  // Step status logic (for GenericForm) - check resource IDs instead of display values
  const getStepStatus = useCallback(
    (stepId: string, _formData: Record<string, unknown>): StepStatus => {
      // Check resource IDs from formState (components manage their own display state)
      const hasName =
        !(stableSimulationDataFields?.names?.required ?? false) ||
        !!formState.name_id;
      const hasDescription =
        !(stableSimulationDataFields?.descriptions?.required ?? false) ||
        !!formState.description_id;
      const hasDepartments =
        !(stableSimulationDataFields?.departments?.required ?? false) ||
        formState.department_ids.length > 0;
      const hasFlags =
        !(stableSimulationDataFields?.flags?.required ?? false) ||
        formState.flag_ids.length > 0;
      const hasScenarios =
        !(stableSimulationDataFields?.scenarios?.required ?? false) ||
        formState.scenario_ids.length > 0;
      const hasScenarioFlags =
        !(stableSimulationDataFields?.scenario_flags?.required ?? false) ||
        formState.scenario_flag_ids.length > 0;
      const hasScenarioPositions =
        !(stableSimulationDataFields?.scenario_positions?.required ?? false) ||
        formState.scenario_position_ids.length > 0;
      const hasScenarioRubrics =
        !(stableSimulationDataFields?.scenario_rubrics?.required ?? false) ||
        formState.scenario_rubric_ids.length > 0;
      const hasScenarioTimeLimits =
        !(
          stableSimulationDataFields?.scenario_time_limits?.required ?? false
        ) || formState.scenario_time_limit_ids.length > 0;

      switch (stepId) {
        case "basic":
          return hasName && hasDescription && hasDepartments && hasFlags
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
    [formState, stableSimulationDataFields],
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
    [],
  );

  const handleDirectStepGenerate = useCallback(
    (stepId: string, _mode: "generate" | "regenerate") => {
      const resources = stepResources[stepId];
      if (resources) {
        handleGenerateResources(resources);
      }
    },
    [stepResources, handleGenerateResources],
  );

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
    [],
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
    [],
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
    [],
  );

  // Compute scenario_resources with show_hints flag
  // show_hints is based on practice_simulation mode - when practice mode is on, hints are hidden
  // For now, default to true (show hints) since practice_simulation isn't exposed in the form yet
  const scenarioResourcesWithShowHints = useMemo(() => {
    const resources = stableSimulationDataFields?.scenarios?.current ?? [];
    // TODO: When practice_simulation is exposed in the API response, use it here:
    // const isPractice = stableSimulationDataFields?.practice_simulation ?? false;
    // For now, always show hints (show_hints = true)
    return resources.map((sr: { [key: string]: unknown }) => ({
      ...sr,
      show_hints: true, // Will be set to !isPractice when practice mode is exposed
    }));
  }, [stableSimulationDataFields?.scenarios]);

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
      const s = stableSimulationDataFields;
      if (!s) {
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
                  name_resource={s.names?.resource ?? null}
                  show_name={s.names?.show ?? true}
                  name_suggestions={s.names?.suggestions ?? []}
                  names={s.names?.resources ?? []}
                  disabled={disabled}
                  onNameIdChange={(id) =>
                    setFormState((prev) => ({ ...prev, name_id: id }))
                  }
                  onGenerate={handleGenerateName}
                  createNamesAction={createNamesAction}
                  required={s.names?.required ?? false}
                  placeholder="Simulation name"
                  defaultName="New Simulation"
                  hideDescription={true}
                  showAiGenerate={s.names?.show_ai_generate ?? false}
                  create_tool_id={s.names?.tool_id ?? null}

                  isAutosaveEnabled={isAutosaveEnabled}
                  registerFlush={registerFlushCallbacks["names"]}
                />
              }
              resetFields={["name", "description", "department_ids", "active"]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
              actions={
                stepResources["basic"]?.length && s?.basic_show_ai_generate ? (
                  <StepCardAiButton
                    stepId="basic"
                    resourceTypes={stepResources["basic"]}
                    canRegenerate={(rt: string) => canRegenerate(rt)}
                    isGenerating={(rt: string) =>
                      isGenerating(rt as SimulationResourceType)
                    }
                    onOpenModal={handleDirectStepGenerate}
                    disabled={disabled}
                  />
                ) : undefined
              }
            >
              <div className="space-y-4">
                <Descriptions
                  description_id={formState.description_id ?? null}
                  description_resource={s.descriptions?.resource ?? null}
                  show_description={s.descriptions?.show ?? true}
                  description_suggestions={s.descriptions?.suggestions ?? []}
                  descriptions={s.descriptions?.resources ?? []}
                  disabled={disabled}
                  onDescriptionIdChange={(id) =>
                    setFormState((prev) => ({ ...prev, description_id: id }))
                  }
                  searchTerm={descriptionSearch ?? ""}
                  onSearchChange={(term: string) =>
                    setStepFormData({ descriptionSearch: term || null })
                  }
                  onGenerate={handleGenerateDescription}
                  createDescriptionsAction={createDescriptionsAction}
                  required={s.descriptions?.required ?? false}
                  showAiGenerate={s.descriptions?.show_ai_generate ?? false}
                  create_tool_id={s.descriptions?.tool_id ?? null}

                  isAutosaveEnabled={isAutosaveEnabled}
                  registerFlush={registerFlushCallbacks["descriptions"]}
                />
                <Departments
                  department_ids={formState.department_ids ?? []}
                  department_resources={s.departments?.current ?? []}
                  show_departments={s.departments?.show ?? false}
                  department_suggestions={s.departments?.suggestions ?? []}
                  departments={s.departments?.resources ?? []}
                  disabled={disabled}
                  onChange={(ids) =>
                    setFormState((prev) => ({ ...prev, department_ids: ids }))
                  }
                  onGenerate={handleGenerateDepartments}
                  required={s.departments?.required ?? false}
                  showAiGenerate={s.departments?.show_ai_generate ?? false}

                />
                <Flags
                  mode="multi"
                  flags={s.flags?.resources ?? []}
                  flag_ids={
                    // Convert flag_ids array to Record for Flags component
                    (s.flags?.resources ?? []).reduce(
                      (
                        acc: Record<string, string | null>,
                        flag: {
                          key?: string | null;
                          flag_option_id?: string | null;
                        },
                      ) => {
                        const isEnabled = formState.flag_ids.includes(
                          flag.flag_option_id ?? "",
                        );
                        if (flag.key) {
                          acc[flag.key] = isEnabled
                            ? (flag.flag_option_id ?? null)
                            : null;
                        }
                        return acc;
                      },
                      {} as Record<string, string | null>,
                    )
                  }
                  show_flags={s.flags?.show ?? false}
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
                        const flag = (s.flags?.resources ?? []).find(
                          (f: { key?: string | null }) => f.key === key,
                        );
                        if (flag?.flag_option_id) {
                          return {
                            ...prev,
                            flag_ids: prev.flag_ids.filter(
                              (id) => id !== flag.flag_option_id,
                            ),
                          };
                        }
                      }
                      return prev;
                    });
                  }}
                  onGenerate={handleGenerateFlags}
                  showAiGenerate={s.flags?.show_ai_generate ?? false}

                />
              </div>
            </StepCard>
          );
        case "scenarios": {
          const scenarioSearch =
            (stepFormData["scenarioSearch"] as string | undefined) ?? null;
          const scenarioShowSelected =
            (stepFormData["scenarioShowSelected"] as boolean | undefined) ??
            false;
          const hasSelectedScenarios =
            (formState.scenario_ids ?? []).length > 0;
          const showScenarioFlags =
            (s.scenario_flags?.show ?? false) || hasSelectedScenarios;
          const showScenarioPositions =
            (s.scenario_positions?.show ?? false) || hasSelectedScenarios;
          const showScenarioRubrics =
            (s.scenario_rubrics?.show ?? false) || hasSelectedScenarios;
          const showScenarioTimeLimits =
            (s.scenario_time_limits?.show ?? false) || hasSelectedScenarios;

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
                stepResources["scenarios"]?.length &&
                s?.basic_show_ai_generate ? (
                  <StepCardAiButton
                    stepId="scenarios"
                    resourceTypes={stepResources["scenarios"]}
                    canRegenerate={(rt: string) => canRegenerate(rt)}
                    isGenerating={(rt: string) =>
                      isGenerating(rt as SimulationResourceType)
                    }
                    onOpenModal={handleDirectStepGenerate}
                    disabled={disabled}
                  />
                ) : undefined
              }
            >
              <div className="space-y-6">
                <Scenarios
                  scenario_ids={formState.scenario_ids ?? []}
                  scenario_resources={s.scenarios?.current ?? []}
                  show_scenarios={(s.scenarios?.show ?? false) || (s.scenarios?.required ?? false)}
                  scenario_suggestions={s.scenarios?.suggestions ?? []}
                  scenarios={s.scenarios?.resources ?? []}
                  disabled={disabled}
                  onChange={(ids) =>
                    setFormState((prev) => ({ ...prev, scenario_ids: ids }))
                  }
                  onGenerate={handleGenerateScenarios}
                  required={s.scenarios?.required ?? false}
                  showAiGenerate={s.scenarios?.show_ai_generate ?? false}

                  searchTerm={scenarioSearch ?? ""}
                  showSelectedOnly={scenarioShowSelected}
                />
                <ScenarioFlags
                  scenario_flag_ids={formState.scenario_flag_ids ?? []}
                  scenario_flag_resources={s.scenario_flags?.current ?? []}
                  show_scenario_flags={showScenarioFlags}
                  scenario_flags={s.scenario_flags?.resources ?? []}
                  scenario_ids={formState.scenario_ids ?? []}
                  scenarios={s.scenarios?.resources ?? []}
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
                  required={s.scenario_flags?.required ?? false}
                  showAiGenerate={s.scenario_flags?.show_ai_generate ?? false}
                  create_tool_id={s.scenario_flags?.tool_id ?? null}

                  isAutosaveEnabled={isAutosaveEnabled}
                  registerFlush={registerFlushCallbacks["scenario_flags"]}
                />
                <ScenarioPositions
                  scenario_position_ids={formState.scenario_position_ids ?? []}
                  scenario_position_resources={
                    s.scenario_positions?.current ?? []
                  }
                  show_scenario_positions={showScenarioPositions}
                  scenario_position_suggestions={
                    s.scenario_positions?.suggestions ?? []
                  }
                  scenario_positions={s.scenario_positions?.resources ?? []}
                  scenarios={s.scenarios?.resources ?? []}
                  scenario_resources={s.scenarios?.current ?? []}
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
                  required={s.scenario_positions?.required ?? false}
                  showAiGenerate={s.scenario_positions?.show_ai_generate ?? false}
                  create_tool_id={s.scenario_positions?.tool_id ?? null}

                  isAutosaveEnabled={isAutosaveEnabled}
                  registerFlush={registerFlushCallbacks["scenario_positions"]}
                />
                <ScenarioRubrics
                  scenario_rubric_ids={formState.scenario_rubric_ids ?? []}
                  scenario_rubric_resources={s.scenario_rubrics?.current ?? []}
                  show_scenario_rubrics={showScenarioRubrics}
                  scenario_rubric_suggestions={
                    s.scenario_rubrics?.suggestions ?? []
                  }
                  scenario_rubrics={s.scenario_rubrics?.resources ?? []}
                  rubrics={s.rubrics ?? []}
                  scenario_ids={formState.scenario_ids ?? []}
                  scenarios={s.scenarios?.resources ?? []}
                  scenario_resources={s.scenarios?.current ?? []}
                  disabled={disabled}
                  onChange={(ids) =>
                    setFormState((prev) => ({
                      ...prev,
                      scenario_rubric_ids: ids,
                    }))
                  }
                  createScenarioRubricsAction={createScenarioRubricsAction}
                  onGenerate={handleGenerateScenarioRubrics}
                  required={s.scenario_rubrics?.required ?? false}
                  showAiGenerate={s.scenario_rubrics?.show_ai_generate ?? false}
                  create_tool_id={s.scenario_rubrics?.tool_id ?? null}

                  isAutosaveEnabled={isAutosaveEnabled}
                  registerFlush={registerFlushCallbacks["scenario_rubrics"]}
                />
                <ScenarioTimeLimits
                  scenario_time_limit_ids={
                    formState.scenario_time_limit_ids ?? []
                  }
                  scenario_time_limit_resources={
                    s.scenario_time_limits?.current ?? []
                  }
                  show_scenario_time_limits={showScenarioTimeLimits}
                  scenario_ids={formState.scenario_ids ?? []}
                  scenarios={s.scenarios?.resources ?? []}
                  scenario_resources={s.scenarios?.current ?? []}
                  disabled={disabled}
                  onTimeLimitIdsChange={(ids) =>
                    setFormState((prev) => ({
                      ...prev,
                      scenario_time_limit_ids: ids,
                    }))
                  }
                  createScenarioTimeLimitsAction={
                    createScenarioTimeLimitsAction
                  }
                  onGenerate={handleGenerateScenarioTimeLimits}
                  required={s.scenario_time_limits?.required ?? false}
                  showAiGenerate={s.scenario_time_limits?.show_ai_generate ?? false}
                  create_tool_id={s.scenario_time_limits?.tool_id ?? null}
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
      handleGenerateScenarioPositions,
      handleGenerateScenarioRubrics,
      handleGenerateScenarioTimeLimits,
      isGenerating,
      stepResources,
      canRegenerate,
      handleDirectStepGenerate,
      createNamesAction,
      createDescriptionsAction,
      createScenarioFlagsAction,
      createScenarioPositionsAction,
      createScenarioRubricsAction,
      createScenarioTimeLimitsAction,
      scenarioResourcesWithShowHints,
      isAutosaveEnabled,
      registerFlushCallbacks,
      makeOnGenerationComplete,
    ],
  );

  if (!stableSimulationDataFields) {
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
          disabledReason={stableSimulationDataFields?.disabled_reason ?? null}
          entityType="simulation"
        />

        <GenericForm
          nuqsParsers={
            simulationSearchParamsClient as Record<string, Parser<unknown>>
          }
          steps={steps}
          getStepStatus={getStepStatus}
          serverData={simulationData as SimulationData}
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

      </div>
    </TooltipProvider>
  );
}

export default React.memo(SimulationComponent);
