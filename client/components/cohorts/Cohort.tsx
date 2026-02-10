/**
 * Cohort.tsx
 * Implementation using modular resource components
 * Used to create and manage cohorts - supports both creation and editing
 * Follows Persona.tsx pattern, adapted for cohorts
 * @AshokSaravanan222 & @siladiea
 * 01/12/2026
 */
"use client";

import { useRouter } from "next/navigation";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  GenericForm,
  type StepStatus,
} from "@/components/common/forms/GenericForm";
import { StepCardAiButton } from "@/components/common/forms/StepCardAiButton";
import { StepCard } from "@/components/common/forms/StepCard";
import { GenerateRegenerateModal } from "@/components/common/GenerateRegenerateModal";
import { ReadOnlyBanner } from "@/components/common/ReadOnlyBanner";
import { Departments } from "@/components/resources/Departments";
import { Descriptions } from "@/components/resources/Descriptions";
import { Flags } from "@/components/resources/FlagsLegacy";
import { Names } from "@/components/resources/Names";
import {
  SimulationPositions,
  type SimulationPositionsProps,
  type SimulationPositionItem,
} from "@/components/resources/SimulationPositions";
import { Simulations } from "@/components/resources/Simulations";
import type { FlagItem } from "@/components/resources/FlagsLegacy";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useBreadcrumbContext } from "@/contexts/breadcrumb-context";
import { useProfile } from "@/contexts/profile-context";
import { useSaveContext } from "@/contexts/save-context";
import { useAiGeneration } from "@/hooks/use-ai-generation";
import { useDraftLifecycle } from "@/hooks/use-draft-lifecycle";
import { useFlushRegistry } from "@/hooks/use-flush-registry";
import { useGenerationModal } from "@/hooks/use-generation-modal";
import type { InputOf, OutputOf } from "@/lib/api/types";
import {
  buildResourceActions,
  checkHasResourceIds,
  computeEffectiveFormState,
  type ResourceConfig,
} from "@/lib/resources/action-builders";
import type { ResourceType } from "@/lib/resources/types";
import type { ServerToClientEvents } from "@/lib/ws/types";
import { parseAsBoolean, parseAsString, type Parser } from "nuqs";

// Socket event types (auto-generated from server)
type CohortGenerationCompletePayload = Parameters<
  ServerToClientEvents["cohort_generation_complete"]
>[0];

// Types defined inline using InputOf/OutputOf
type SaveCohortIn = InputOf<"/api/v4/artifacts/cohorts/save", "post">;
type SaveCohortOut = OutputOf<"/api/v4/artifacts/cohorts/save", "post">;
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
type CreateDraftSimulationPositionsIn = InputOf<
  "/api/v4/resources/simulation_positions",
  "post"
>;
type CreateDraftSimulationPositionsOut = OutputOf<
  "/api/v4/resources/simulation_positions",
  "post"
>;
type PatchCohortDraftIn = InputOf<"/api/v4/artifacts/cohorts/draft", "patch">;
type PatchCohortDraftOut = OutputOf<"/api/v4/artifacts/cohorts/draft", "patch">;

type CohortData = OutputOf<"/api/v4/artifacts/cohorts/get", "post">;

// Type for flush results - each resource returns its created ID(s)
type FlushResult = {
  name_id?: string | null;
  description_id?: string | null;
};

// AI form data shape for cohort generation
type CohortAiFormData = {
  name_resource?: CohortGenerationCompletePayload["name_resource"];
  description_resource?: CohortGenerationCompletePayload["description_resource"];
  flag_resource?: CohortGenerationCompletePayload["flag_resource"];
  department_resources?: CohortGenerationCompletePayload["department_resources"];
  simulation_resources?: CohortGenerationCompletePayload["simulation_resources"];
  simulation_positions?: CohortGenerationCompletePayload["simulation_positions"];
};

type CohortFormState = {
  name_id: string | null;
  description_id: string | null;
  active_flag_id: string | null;
  department_ids: string[];
  simulation_ids: string[];
  simulation_positions: SimulationPositionItem[];
};

export interface CohortProps {
  cohortId?: string;
  // Server-provided data (for server-side rendering)
  cohortData?: CohortData;
  // Server actions (replaces useMutation)
  saveCohortAction?: (input: SaveCohortIn) => Promise<SaveCohortOut>;
  patchCohortDraftAction?: (
    input: PatchCohortDraftIn
  ) => Promise<PatchCohortDraftOut>;
  // Resource creation actions
  createNamesAction?: (
    input: CreateDraftNamesIn
  ) => Promise<CreateDraftNamesOut>;
  createDescriptionsAction?: (
    input: CreateDraftDescriptionsIn
  ) => Promise<CreateDraftDescriptionsOut>;
  createSimulationPositionsAction?: (
    input: CreateDraftSimulationPositionsIn
  ) => Promise<CreateDraftSimulationPositionsOut>;
}

const FLUSH_KEYS = [
  "names",
  "descriptions",
] as const;

const VALID_RESOURCE_TYPES: ResourceType[] = [
  "names",
  "descriptions",
  "flags",
  "departments",
  "simulations",
  "simulation_positions",
];

const COHORT_RESOURCES: ResourceConfig[] = [
  { key: "names", formKey: "name_id", flushKey: "name_id", type: "single" },
  {
    key: "descriptions",
    formKey: "description_id",
    flushKey: "description_id",
    type: "single",
  },
  { key: "flags", formKey: "active_flag_id", flushKey: null, type: "single" },
  {
    key: "departments",
    formKey: "department_ids",
    flushKey: null,
    type: "multi",
  },
  {
    key: "simulations",
    formKey: "simulation_ids",
    flushKey: null,
    type: "multi",
  },
  {
    key: "simulation_positions",
    formKey: "simulation_ids",
    flushKey: null,
    type: "multi",
  },
];

function CohortComponent({
  cohortId,
  cohortData,
  saveCohortAction,
  patchCohortDraftAction,
  createNamesAction,
  createDescriptionsAction,
  createSimulationPositionsAction,
}: CohortProps) {
  const router = useRouter();
  const isEditMode = !!cohortId;
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

  // --- AI Generation ---
  const onAiComplete = useCallback(
    (data: Record<string, unknown>) => {
      const aiUpdates: Partial<CohortAiFormData> = {};

      const resourceType = data["resource_type"] as string | undefined;

      // Handle simulation_positions specially - merge directly into formState
      if (resourceType === "simulation_positions") {
        const positions = data["simulation_positions"] as
          | Array<{
              simulation_id?: string | null;
              value?: number | null;
              generated?: boolean | null;
              mcp?: boolean | null;
            }>
          | undefined;

        if (positions && positions.length > 0) {
          setFormState((prev) => {
            const nextPositions = new Map<string, SimulationPositionItem>();
            prev.simulation_positions.forEach((pos) => {
              if (pos.simulation_id) {
                nextPositions.set(pos.simulation_id, pos);
              }
            });
            positions.forEach((pos) => {
              if (
                pos.simulation_id &&
                pos.value !== null &&
                pos.value !== undefined
              ) {
                nextPositions.set(pos.simulation_id, {
                  simulation_id: pos.simulation_id,
                  value: pos.value,
                  generated: pos.generated ?? false,
                });
              }
            });
            const merged = Array.from(nextPositions.values()).sort((a, b) => {
              if (a.value !== b.value) return a.value - b.value;
              return a.simulation_id.localeCompare(b.simulation_id);
            });
            return { ...prev, simulation_positions: merged };
          });
        }
        return { aiUpdates };
      }

      // For other resource types, build formState updates from hydrated resources.
      const formStateUpdates: Record<string, unknown> = {};

      const nameResource = data["name_resource"] as { id?: string | null } | undefined;
      if (nameResource?.id) formStateUpdates["name_id"] = nameResource.id;

      const descriptionResource = data["description_resource"] as
        | { id?: string | null }
        | undefined;
      if (descriptionResource?.id) {
        formStateUpdates["description_id"] = descriptionResource.id;
      }

      const flagResource = data["flag_resource"] as { id?: string | null } | undefined;
      if (flagResource?.id) formStateUpdates["active_flag_id"] = flagResource.id;

      const departmentResources = data["department_resources"] as
        | Array<{ department_id?: string | null }>
        | undefined;
      const departmentIds = (departmentResources ?? [])
        .map((d) => d.department_id)
        .filter((id): id is string => !!id);
      if (departmentIds && departmentIds.length > 0) {
        formStateUpdates["_append_department_ids"] = departmentIds;
      }

      const simulationResources = data["simulation_resources"] as
        | Array<{ simulation_id?: string | null }>
        | undefined;
      const simulationIds = (simulationResources ?? [])
        .map((s) => s.simulation_id)
        .filter((id): id is string => !!id);
      if (simulationIds && simulationIds.length > 0) {
        formStateUpdates["_append_simulation_ids"] = simulationIds;
      }

      return { aiUpdates, formStateUpdates };
    },
    []
  );

  // Custom setFormState wrapper for AI generation that handles append semantics
  const setFormStateForAi = useCallback(
    (updater: (prev: Record<string, unknown>) => Record<string, unknown>) => {
      setFormState((prev) => {
        const updates = updater(prev as unknown as Record<string, unknown>);
        const result = { ...prev };

        if (updates["name_id"]) result.name_id = updates["name_id"] as string;
        if (updates["description_id"]) result.description_id = updates["description_id"] as string;
        if (updates["active_flag_id"]) result.active_flag_id = updates["active_flag_id"] as string;

        const appendDeptIds = updates["_append_department_ids"] as string[] | undefined;
        if (appendDeptIds && appendDeptIds.length > 0) {
          const newDeptIds = appendDeptIds.filter(
            (id) => !prev.department_ids.includes(id)
          );
          result.department_ids = [...prev.department_ids, ...newDeptIds];
        }

        const appendSimIds = updates["_append_simulation_ids"] as string[] | undefined;
        if (appendSimIds && appendSimIds.length > 0) {
          const newSimIds = appendSimIds.filter(
            (id) => !prev.simulation_ids.includes(id)
          );
          result.simulation_ids = [...prev.simulation_ids, ...newSimIds];
        }

        return result;
      });
    },
    []
  );

  const {
    setGeneratingResources,
    isGenerating,
  } = useAiGeneration<ResourceType, CohortAiFormData>({
    socket,
    isConnected,
    artifactType: "cohort",
    groupId: cohortData?.group_id,
    eventPrefix: "cohort_generation",
    validResourceTypes: VALID_RESOURCE_TYPES,
    onComplete: onAiComplete,
    setFormState: setFormStateForAi as React.Dispatch<React.SetStateAction<Record<string, unknown>>>,
  });

  // nuqs parsers for URL-backed state (will be passed to GenericForm)
  // Memoize to prevent new object reference on every render
  const cohortSearchParamsClient = useMemo(
    () => ({
      // Draft ID (URL-backed, updated when draft is created)
      draftId: parseAsString,
      // Search params (URL-backed, updated via debounced callback in StepCard)
      descriptionSearch: parseAsString,
      simulationSearch: parseAsString,
      // Filter params (URL-backed)
      simulationShowSelected: parseAsBoolean,
    }),
    []
  );

  // Local form state (not in URL) - stores only resource IDs
  // Display values are managed inside resource components
  // Use ref to store cohortData to prevent callback recreation on every render
  const cohortDataRef = React.useRef(cohortData);
  React.useEffect(() => {
    cohortDataRef.current = cohortData;
  }, [cohortData]);

  // Memoize cohortData fields used in renderStep to prevent callback recreation
  // when only object reference changes (but content is same)
  const stableCohortDataFields = React.useMemo(() => {
    if (!cohortData) return null;
    return {
      group_id: cohortData.group_id,
      names: cohortData.names,
      descriptions: cohortData.descriptions,
      flags: cohortData.flags,
      departments: cohortData.departments,
      simulations: cohortData.simulations,
      simulation_positions: cohortData.simulation_positions,
      basic_show_ai_generate: cohortData.basic_show_ai_generate,
      simulations_step_show_ai_generate: cohortData.simulations_step_show_ai_generate,
    };
    // Intentionally depend on individual fields, not whole cohortData object
    // to prevent recreation when only object reference changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    cohortData?.group_id,
    cohortData?.names,
    cohortData?.descriptions,
    cohortData?.departments,
    cohortData?.flags,
    cohortData?.simulations,
    cohortData?.simulation_positions,
    cohortData?.basic_show_ai_generate,
    cohortData?.simulations_step_show_ai_generate,
  ]);

  // Helper to check if a resource type can be regenerated
  // Use stableCohortDataFields to prevent callback recreation when cohortData object reference changes
  const canRegenerate = useCallback(
    (resourceType: ResourceType): boolean => {
      if (!stableCohortDataFields) return false;
      switch (resourceType) {
        case "names":
          return stableCohortDataFields.names?.resource?.generated ?? false;
        case "descriptions":
          return stableCohortDataFields.descriptions?.resource?.generated ?? false;
        case "flags":
          return stableCohortDataFields.flags?.resource?.generated ?? false;
        case "departments":
          return stableCohortDataFields.departments?.current?.some((d) => d.generated) ?? false;
        case "simulations":
          return stableCohortDataFields.simulations?.current?.some((s) => s.generated) ?? false;
        case "simulation_positions":
          return stableCohortDataFields.simulation_positions?.current?.some((p) => p.generated) ?? false;
        default:
          return false;
      }
    },
    [stableCohortDataFields]
  );

  const getInitialFormState = useCallback(() => {
    const data = cohortDataRef.current;
    if (!data) {
      return {
        name_id: null as string | null,
        description_id: null as string | null,
        active_flag_id: null as string | null,
        department_ids: [] as string[],
        simulation_ids: [] as string[],
        simulation_positions: [] as SimulationPositionItem[],
      };
    }
    // Extract resource IDs from server data
    // Note: Server data may have display values, but we only store IDs here
    return {
      name_id: data.names?.resource?.id ?? null,
      description_id: data.descriptions?.resource?.id ?? null,
      active_flag_id: data.flags?.resource?.id ?? null,
      department_ids: (data.departments?.current ?? [])
        .map((d) => d.department_id)
        .filter((id): id is string => !!id),
      simulation_ids: (data.simulations?.current ?? [])
        .map((s) => s.simulation_id)
        .filter((id): id is string => !!id),
      simulation_positions: (data.simulation_positions?.current ?? []).map(
        (p) => ({
          simulation_id: p.simulation_id ?? "",
          value: p.value ?? 0,
          generated: p.generated ?? false,
          mcp: p.mcp ?? false,
        })
      ),
    };
    // Remove cohortData from dependencies - use ref instead to prevent callback recreation
  }, []);

  const [formState, setFormState] = useState<CohortFormState>(getInitialFormState);
  const lastPatchedFormStateRef = React.useRef<CohortFormState>(getInitialFormState());
  // Use ref to access formState in renderStep without depending on it
  const formStateRef = React.useRef<Record<string, unknown>>(formState as unknown as Record<string, unknown>);
  React.useEffect(() => {
    formStateRef.current = formState as unknown as Record<string, unknown>;
  }, [formState]);

  // Memoize stringified array dependencies to prevent effect from running when array references change but content is same
  const departmentIdsStr = React.useMemo(
    () =>
      JSON.stringify(
        (cohortData?.departments?.current ?? [])
          .map((d) => d.department_id)
          .filter(Boolean)
      ),
    [cohortData?.departments]
  );
  const simulationIdsStr = React.useMemo(
    () =>
      JSON.stringify(
        (cohortData?.simulations?.current ?? [])
          .map((s) => s.simulation_id)
          .filter(Boolean)
      ),
    [cohortData?.simulations]
  );
  const simulationPositionsStr = React.useMemo(
    () => JSON.stringify(cohortData?.simulation_positions?.current ?? []),
    [cohortData?.simulation_positions]
  );

  // Update form state when server data changes
  // Use cohortData directly in dependency array, not getInitialFormState
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
        JSON.stringify(prev.simulation_ids) !==
          JSON.stringify(newState.simulation_ids) ||
        JSON.stringify(prev.simulation_positions) !==
          JSON.stringify(newState.simulation_positions)
      ) {
        serverSyncPendingRef.current = true;
        return newState;
      }
      return prev;
    });
    lastPatchedFormStateRef.current = newState;
    // Use stringified arrays in dependencies to prevent effect from running when array references change but content is same
    // Intentionally exclude formState and getInitialFormState to prevent infinite loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    cohortData?.names,
    cohortData?.descriptions,
    cohortData?.flags,
    departmentIdsStr,
    simulationIdsStr,
    simulationPositionsStr,
  ]);

  // --- Draft Lifecycle ---
  const patchCohortDraftActionRef = React.useRef(patchCohortDraftAction);
  React.useEffect(() => {
    patchCohortDraftActionRef.current = patchCohortDraftAction;
  }, [patchCohortDraftAction]);

  // Stable ref wrapper for patch action
  const patchActionRef = React.useRef<
    ((payload: Record<string, unknown>) => Promise<{ draft_id?: string | null; new_version?: number | null }>) | undefined
  >(undefined);
  React.useEffect(() => {
    if (patchCohortDraftAction) {
      patchActionRef.current = async (payload: Record<string, unknown>) => {
        return await patchCohortDraftAction({ body: payload } as PatchCohortDraftIn);
      };
    } else {
      patchActionRef.current = undefined;
    }
  }, [patchCohortDraftAction]);

  // Memoize stringified formState arrays for draft listener effect dependencies
  const formStateDepartmentIdsStr = React.useMemo(
    () => JSON.stringify(formState.department_ids),
    [formState.department_ids]
  );
  const formStateSimulationIdsStr = React.useMemo(
    () => JSON.stringify(formState.simulation_ids),
    [formState.simulation_ids]
  );
  const formStateSimulationPositionsStr = React.useMemo(
    () => JSON.stringify(formState.simulation_positions),
    [formState.simulation_positions]
  );

  // formStateKey excludes draftId -- the hook prepends it
  const formStateKey = React.useMemo(
    () =>
      JSON.stringify({
        name_id: formState.name_id,
        description_id: formState.description_id,
        active_flag_id: formState.active_flag_id,
        department_ids: formState.department_ids,
        simulation_ids: formState.simulation_ids,
        simulation_positions: formState.simulation_positions,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      formState.name_id,
      formState.description_id,
      formState.active_flag_id,
      formStateDepartmentIdsStr,
      formStateSimulationIdsStr,
      formStateSimulationPositionsStr,
    ]
  );

  const hasResourceIds = checkHasResourceIds(COHORT_RESOURCES, formState);

  const buildPatchPayload = useCallback(
    (
      draftId: string | null,
      expectedVersion: number,
      flushResults?: Record<string, unknown>
    ): Record<string, unknown> => {
      const currentFormState = formStateRef.current as unknown as CohortFormState;
      return {
        input_draft_id: draftId || null,
        group_id: stableCohortDataFields?.group_id ?? null,
        ...buildResourceActions(COHORT_RESOURCES, {
          formState: currentFormState as unknown as Record<string, unknown>,
          referenceState:
            lastPatchedFormStateRef.current as unknown as Record<string, unknown>,
          flushResults: (flushResults ?? {}) as Record<string, unknown>,
          entityData: stableCohortDataFields as Record<string, unknown> | null,
        }),
        simulation_position_values:
          currentFormState.simulation_positions.length > 0
            ? currentFormState.simulation_ids.map(
                (simulationId, index) =>
                  currentFormState.simulation_positions.find(
                    (position) => position.simulation_id === simulationId
                  )?.value ?? index + 1
              )
            : null,
        expected_version: expectedVersion,
      };
    },
    [stableCohortDataFields]
  );

  const draftVersion =
    cohortData && "draft_version" in cohortData
      ? (cohortData as { draft_version?: number | null }).draft_version
      : null;

  const onPatchSuccess = useCallback(() => {
    lastPatchedFormStateRef.current = {
      ...(formStateRef.current as unknown as CohortFormState),
    };
  }, []);

  const {
    setUrlFormDataRef,
    onFormDataChange,
    flushAllAndSave,
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
    onPatchSuccess,
  });

  const handleGenerateResources = useCallback(
    async (
      resourceTypes: ResourceType[],
      userInstructions?: string
    ) => {
      if (!socket || !isConnected) {
        toast.error("WebSocket not connected");
        return;
      }

      if (resourceTypes.length === 0) {
        toast.error("No resource types specified for generation");
        return;
      }

      let draftIdToUse =
        (formDataRef.current["draftId"] as string | undefined) ?? null;
      if (!draftIdToUse) {
        draftIdToUse = await flushAllAndSave();
      }
      if (!draftIdToUse) {
        toast.error("Please save a draft before generating with AI");
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
      const descriptionSearch =
        (formData["descriptionSearch"] as string | undefined) ?? null;
      const simulationSearch =
        (formData["simulationSearch"] as string | undefined) ?? null;
      const simulationShowSelected =
        (formData["simulationShowSelected"] as boolean | undefined) ?? false;

      // Emit cohort_generate with resource_types
      socket.emit("cohort_generate", {
        resource_types: resourceTypes,
        user_instructions: userInstructions ? [userInstructions] : null,
        // GetCohortApiRequest fields from formData
        draft_id: draftIdToUse,
        descriptions_search: descriptionSearch || null,
        simulation_search: simulationSearch || null,
        simulation_show_selected: simulationShowSelected || false,
        cohort_id: cohortId || null,
      });
    },
    [socket, isConnected, cohortId, flushAllAndSave, formDataRef, setGeneratingResources]
  );

  // Individual generation handlers - generate directly without modals
  const handleGenerateName = useCallback(
    async () => handleGenerateResources(["names"]),
    [handleGenerateResources]
  );

  const handleGenerateDescription = useCallback(
    async () => handleGenerateResources(["descriptions"]),
    [handleGenerateResources]
  );

  const handleGenerateDepartments = useCallback(
    async () => handleGenerateResources(["departments"]),
    [handleGenerateResources]
  );

  const handleGenerateFlags = useCallback(
    async () => handleGenerateResources(["flags"]),
    [handleGenerateResources]
  );

  const handleGenerateSimulations = useCallback(
    async () => handleGenerateResources(["simulations"]),
    [handleGenerateResources]
  );

  const handleGenerateSimulationPositions = useCallback(
    async () => handleGenerateResources(["simulation_positions"]),
    [handleGenerateResources]
  );

  // --- Generation Modal ---
  // Step-to-resources mapping for multi-generation
  const stepResources: Record<string, ResourceType[]> = useMemo(
    () => ({
      basic: ["names", "descriptions", "departments", "flags"],
      simulations: ["simulations"],
      all: [
        "names",
        "descriptions",
        "flags",
        "departments",
        "simulations",
        "simulation_positions",
      ], // All resources for full-page generation
    }),
    []
  );

  // Resource labels for display
  const resourceLabels: Partial<Record<ResourceType, string>> = useMemo(
    () => ({
      names: "Names",
      descriptions: "Descriptions",
      flags: "Flags",
      departments: "Departments",
      simulations: "Simulations",
      simulation_positions: "Simulation Positions",
    }),
    []
  );

  const onModalGenerate = useCallback(
    (selectedResources: ResourceType[], instructions?: string) => {
      handleGenerateResources(selectedResources, instructions);
    },
    [handleGenerateResources]
  );

  const { handleOpenStepCardModal, modalProps } = useGenerationModal<ResourceType>({
    stepResources,
    resourceLabels,
    canRegenerate,
    onGenerate: onModalGenerate,
    isGenerating,
  });

  // Disabled logic based on can_edit flag - standardized for all resource components
  // Check can_edit in both new and edit modes to show disabled_reason when agents are missing
  const disabled = useMemo(() => {
    if (!cohortData) return false;
    return !cohortData.can_edit;
  }, [cohortData]);

  // Set breadcrumb context when cohort data is loaded
  useEffect(() => {
    const cohortName = cohortData?.names?.resource?.name;
    if (cohortName && cohortId && isEditMode) {
      setEntityMetadata({
        entityId: cohortId,
        entityName: cohortName,
        entityType: "cohort",
      });
    }
    return () => clearEntityMetadata();
  }, [
    cohortData,
    cohortId,
    isEditMode,
    setEntityMetadata,
    clearEntityMetadata,
  ]);

  // Submit handler for GenericForm (uses formState, not formData parameter)
  const handleSubmit = useCallback(
    async (_formData: Record<string, unknown>) => {
      let flushResults: FlushResult = {};
      if (!isAutosaveEnabled) {
        flushResults = await flushAllResources();
      }

      const baseFormState = formStateRef.current as unknown as CohortFormState;
      const effectiveFormState = computeEffectiveFormState(
        COHORT_RESOURCES,
        baseFormState as unknown as Record<string, unknown>,
        flushResults as Record<string, unknown>
      ) as unknown as CohortFormState;

      // Validate required resource IDs using {resource}_required flags from cohortData
      if (cohortData?.names?.required && !effectiveFormState.name_id) {
        toast.error("Cohort name is required");
        throw new Error("Cohort name is required");
      }

      if (
        cohortData?.departments?.required &&
        (!effectiveFormState.department_ids || effectiveFormState.department_ids.length === 0)
      ) {
        toast.error("Departments are required");
        throw new Error("Departments are required");
      }

      // Pass department_ids and simulation_ids directly - SQL handles validation

      // Ensure profileId exists - required for API calls
      if (!profile?.id) {
        toast.error("Profile not loaded. Please refresh the page.");
        throw new Error("Profile not loaded");
      }

      if (!saveCohortAction) {
        toast.error("Save action not available");
        throw new Error("Save action not available");
      }

      if (!cohortData?.group_id) {
        toast.error("Group not found. Please try again.");
        throw new Error("Group ID is required for save");
      }

      // Ensure required fields are present (TypeScript guard)
      if (!effectiveFormState.name_id) {
        toast.error("Required fields are missing");
        throw new Error("Required fields are missing");
      }

      try {
        const initialState = getInitialFormState();

        await saveCohortAction({
          body: {
            // Context
            group_id: cohortData.group_id,
            input_cohort_id: isEditMode && cohortId ? cohortId : null,
            ...buildResourceActions(COHORT_RESOURCES, {
              formState: formStateRef.current as unknown as Record<
                string,
                unknown
              >,
              referenceState: initialState as unknown as Record<string, unknown>,
              flushResults: flushResults as Record<string, unknown>,
              entityData: cohortData as Record<string, unknown> | null,
            }),

            // Special: simulation position values
            simulation_position_values:
              effectiveFormState.simulation_positions.length > 0
                ? effectiveFormState.simulation_ids.map(
                    (simulationId, index) =>
                      effectiveFormState.simulation_positions.find(
                        (position) => position.simulation_id === simulationId
                      )?.value ?? index + 1
                  )
                : undefined,
          } as SaveCohortIn["body"],
        } as SaveCohortIn);
        toast.success(
          `Cohort ${isEditMode ? "updated" : "created"} successfully!`
        );
        router.push("/training/cohorts");
      } catch (error) {
        toast.error(
          `Failed to ${isEditMode ? "update" : "create"} cohort: ${error instanceof Error ? error.message : "Unknown error"}`
        );
        throw error;
      }
    },
    [
      isAutosaveEnabled,
      flushAllResources,
      getInitialFormState,
      isEditMode,
      cohortId,
      cohortData,
      profile?.id,
      saveCohortAction,
      router,
    ]
  );

  // Step status logic (for GenericForm) - check resource IDs instead of display values
  const getStepStatus = useCallback(
    (stepId: string, _formData: Record<string, unknown>): StepStatus => {
      // Check resource IDs from formState (components manage their own display state)
      const hasName = !!formState.name_id;
      const hasDescription = !!formState.description_id;
      const hasSimulations = formState.simulation_ids.length > 0;

      switch (stepId) {
        case "basic":
          return hasName && hasDescription ? "completed" : "active";
        case "simulations":
          if (!hasName || !hasDescription) return "pending";
          return hasSimulations ? "completed" : "active";
        default:
          return "pending";
      }
    },
    [formState]
  );

  // Steps configuration for GenericForm
  const steps = useMemo(
    () => [
      {
        id: "basic",
        title: "Basic Information",
        description:
          "Set the cohort name, description, departments, and active status.",
        resetFields: ["name", "description", "department_ids", "active"],
      },
      {
        id: "simulations",
        title: "Simulations",
        description: "Select simulations for this cohort.",
        resetFields: ["simulation_ids", "simulation_positions"],
      },
    ],
    []
  );

  // Memoize formFieldKeys to prevent re-initialization loops
  const formFieldKeys = useMemo(
    () => [
      "name",
      "description",
      "active",
      "department_ids",
      "simulation_ids",
      "simulation_positions",
    ],
    []
  );

  // Memoize resetSuccessMessage to prevent GenericForm re-renders
  const resetSuccessMessage = useCallback((stepId: string) => {
    switch (stepId) {
      case "basic":
        return "Basic information reset";
      case "simulations":
        return "Simulations reset";
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
            active_flag_id: null,
            department_ids: [],
          };
        case "simulations":
          return {
            ...prev,
            simulation_ids: [],
            simulation_positions: [],
          };
        default:
          return prev;
      }
    });
  }, []);

  // Memoize submitButton to prevent GenericForm re-renders
  const submitButton = useMemo(
    () => ({
      backUrl: "/training/cohorts",
      backLabel: "Back",
      createLabel: "Create Cohort",
      updateLabel: "Update Cohort",
    }),
    []
  );

  // Memoize renderStep to prevent GenericForm re-renders
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
      // Use memoized fields to avoid dependency on cohortData object reference
      const s = stableCohortDataFields;
      switch (stepId) {
        case "basic":
          const flagResource: FlagItem | null = s?.flags?.resource
            ? {
                id: s.flags.resource.id ?? null,
                name: s.flags.resource.name ?? null,
                description: s.flags.resource.description ?? null,
                icon: s.flags.resource.icon ?? null,
                generated: s.flags.resource.generated ?? false,
              }
            : null;
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
                  name_resource={s?.names?.resource ?? null}
                  show_name={s?.names?.show ?? true}
                  name_suggestions={s?.names?.suggestions ?? []}
                  names={s?.names?.resources ?? []}
                  disabled={disabled}
                  onNameIdChange={(nameId) =>
                    setFormState((prev) => ({ ...prev, name_id: nameId }))
                  }
                  onGenerate={handleGenerateName}
                  isGenerating={isGenerating("names")}
                  placeholder="e.g., Spring 2024 Cohort"
                  defaultName="New Cohort"
                  required={s?.names?.required ?? false}
                  hideDescription={true}
                  group_id={s?.group_id ?? null}
                  showAiGenerate={s?.names?.show_ai_generate ?? false}
                  createNamesAction={
                    createNamesAction as
                      | ((
                          input: CreateDraftNamesIn
                        ) => Promise<CreateDraftNamesOut>)
                      | undefined
                  }
                  isAutosaveEnabled={isAutosaveEnabled}
                  registerFlush={registerFlushCallbacks["names"]}
                />
              }
              resetFields={["name", "description", "department_ids", "active"]}
              actions={
                stepResources["basic"] &&
                stepResources["basic"].length > 0 &&
                (s?.basic_show_ai_generate ?? false) ? (
                  <StepCardAiButton
                    stepId="basic"
                    resourceTypes={stepResources["basic"] ?? []}
                    canRegenerate={(rt) => canRegenerate(rt as ResourceType)}
                    isGenerating={(rt) => isGenerating(rt as ResourceType)}
                    disabled={disabled}
                    onOpenModal={handleOpenStepCardModal}
                  />
                ) : undefined
              }
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
            >
              <div className="space-y-4">
                {/* Description field - using Descriptions resource component */}
                <Descriptions
                  description_id={formState.description_id ?? null}
                  description_resource={s?.descriptions?.resource ?? null}
                  show_description={s?.descriptions?.show ?? true}
                  description_suggestions={s?.descriptions?.suggestions ?? []}
                  descriptions={s?.descriptions?.resources ?? []}
                  disabled={disabled}
                  onDescriptionIdChange={(descriptionId) =>
                    setFormState((prev) => ({
                      ...prev,
                      description_id: descriptionId,
                    }))
                  }
                  searchTerm={
                    (stepFormData["descriptionSearch"] as
                      | string
                      | null
                      | undefined) || ""
                  }
                  onSearchChange={(term: string) =>
                    setStepFormData({ descriptionSearch: term || null })
                  }
                  onGenerate={handleGenerateDescription}
                  isGenerating={isGenerating("descriptions")}
                  label="Description"
                  placeholder="Detailed description of the cohort"
                  required={s?.descriptions?.required ?? false}
                  rows={4}
                  data-testid="input-cohort-description"
                  group_id={s?.group_id ?? null}
                  showAiGenerate={s?.descriptions?.show_ai_generate ?? false}
                  createDescriptionsAction={createDescriptionsAction}
                  isAutosaveEnabled={isAutosaveEnabled}
                  registerFlush={registerFlushCallbacks["descriptions"]}
                />

                {/* Department Selection */}
                <Departments
                  department_ids={formState.department_ids ?? []}
                  department_resources={s?.departments?.current ?? []}
                  show_departments={s?.departments?.show ?? false}
                  department_suggestions={s?.departments?.suggestions ?? []}
                  departments={s?.departments?.resources ?? []}
                  disabled={disabled}
                  onChange={(ids) =>
                    setFormState((prev) => ({ ...prev, department_ids: ids }))
                  }
                  onGenerate={handleGenerateDepartments}
                  isGenerating={isGenerating("departments")}
                  required={s?.departments?.required ?? false}
                  group_id={s?.group_id ?? null}
                  showAiGenerate={s?.departments?.show_ai_generate ?? false}
                />

                {/* Active Switch - using Flags resource component */}
                <Flags
                  flag_id={formState.active_flag_id ?? null}
                  flag_resource={flagResource}
                  show_flag={s?.flags?.show ?? false}
                  disabled={disabled}
                  onFlagIdChange={(flagId) =>
                    setFormState((prev) => ({
                      ...prev,
                      active_flag_id: flagId,
                    }))
                  }
                  onGenerate={handleGenerateFlags}
                  isGenerating={isGenerating("flags")}
                  label="Active"
                  helpText="Inactive cohorts will not be available for selection"
                  required={s?.flags?.required ?? false}
                  group_id={s?.group_id ?? null}
                  showAiGenerate={s?.flags?.show_ai_generate ?? false}
                />
              </div>
            </StepCard>
          );

        case "simulations": {
          const simulationSearchTerm =
            (stepFormData["simulationSearch"] as string | null | undefined) ||
            "";
          const simulationShowSelected =
            (stepFormData["simulationShowSelected"] as
              | boolean
              | null
              | undefined) ?? false;
          const simulationResourcesForUi = (s?.simulations?.resources ?? []).map(
            (sim) => ({
              simulation_id: sim.simulation_id ?? null,
              name: sim.name ?? null,
              description: sim.description ?? null,
              time_limit: sim.time_limit ?? null,
              generated: sim.generated ?? false,
            })
          );
          const simulationCurrentForUi = (s?.simulations?.current ?? []).map(
            (sim) => ({
              simulation_id: sim.simulation_id ?? null,
              name: sim.name ?? null,
              description: sim.description ?? null,
              time_limit: sim.time_limit ?? null,
              generated: sim.generated ?? false,
            })
          );
          const simulationPositionsAction =
            createSimulationPositionsAction as
              | SimulationPositionsProps["createSimulationPositionsAction"]
              | undefined;
          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={disabled}
              isEditMode={isEditMode}
              searchTerm={simulationSearchTerm}
              onSearchChange={(term: string) =>
                setStepFormData({ simulationSearch: term || null })
              }
              searchPlaceholder="Search simulations..."
              debounceMs={300}
              filters={[
                {
                  key: "showSelected",
                  label: "Show selected",
                  value: simulationShowSelected,
                  onChange: (value: boolean) =>
                    setStepFormData({
                      simulationShowSelected: value || null,
                    }),
                },
              ]}
              resetFields={[
                "simulation_ids",
                "simulationSearch",
                "simulationShowSelected",
              ]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
              actions={
                stepResources["simulations"] &&
                stepResources["simulations"].length > 0 &&
                (s?.simulations_step_show_ai_generate ?? false) ? (
                  <StepCardAiButton
                    stepId="simulations"
                    resourceTypes={stepResources["simulations"] ?? []}
                    canRegenerate={(rt) => canRegenerate(rt as ResourceType)}
                    isGenerating={(rt) => isGenerating(rt as ResourceType)}
                    disabled={disabled}
                    onOpenModal={handleOpenStepCardModal}
                  />
                ) : undefined
              }
            >
              <Simulations
                simulation_ids={formState.simulation_ids ?? []}
                simulation_resources={simulationCurrentForUi}
                show_simulations={s?.simulations?.show ?? false}
                simulation_suggestions={s?.simulations?.suggestions ?? []}
                simulations={simulationResourcesForUi}
                disabled={disabled}
                onChange={(ids) =>
                  setFormState((prev) => ({
                    ...prev,
                    simulation_ids: ids,
                  }))
                }
                onGenerate={handleGenerateSimulations}
                isGenerating={isGenerating("simulations")}
                label="Simulations"
                required={s?.simulations?.required ?? false}
                group_id={s?.group_id ?? null}
                showAiGenerate={s?.simulations?.show_ai_generate ?? false}
                searchTerm={simulationSearchTerm}
                showSelectedFilter={simulationShowSelected}
              />
              <SimulationPositions
                simulation_ids={formState.simulation_ids ?? []}
                simulation_resources={simulationCurrentForUi}
                simulations={simulationResourcesForUi}
                show_simulation_positions={
                  s?.simulation_positions?.show ?? false
                }
                simulation_positions={formState.simulation_positions ?? []}
                disabled={disabled}
                onChange={(positions) => {
                  const orderedSimulationIds = [...positions]
                    .sort((a, b) => a.value - b.value)
                    .map((position) => position.simulation_id);
                  setFormState((prev) => ({
                    ...prev,
                    simulation_positions: positions,
                    simulation_ids:
                      orderedSimulationIds.length > 0
                        ? orderedSimulationIds
                        : prev.simulation_ids,
                  }));
                }}
                label="Simulation Positions"
                required={
                  s?.simulation_positions?.required ?? false
                }
                group_id={s?.group_id ?? null}
                showAiGenerate={s?.simulation_positions?.show_ai_generate ?? false}
                onGenerate={
                  isEditMode ? handleGenerateSimulationPositions : undefined
                }
                isGenerating={isGenerating("simulation_positions")}
                createSimulationPositionsAction={simulationPositionsAction}
              />
            </StepCard>
          );
        }

        default:
          return null;
      }
    },
    [
      // Use stableCohortDataFields instead of cohortData to prevent callback recreation
      // when only object reference changes (but content is same)
      stableCohortDataFields,
      disabled,
      isEditMode,
      handleGenerateName,
      handleGenerateDescription,
      handleGenerateDepartments,
      handleGenerateFlags,
      handleGenerateSimulations,
      handleGenerateSimulationPositions,
      isGenerating,
      stepResources,
      // Depend on individual formState fields instead of whole object to prevent callback recreation
      // when object reference changes but values are same
      formState.name_id,
      formState.description_id,
      formState.active_flag_id,
      // Include arrays - they're used in the callback, but the formState sync effect ensures
      // they only change when content actually changes (not just reference)
      formState.department_ids,
      formState.simulation_ids,
      formState.simulation_positions,
      createNamesAction,
      createDescriptionsAction,
      createSimulationPositionsAction,
      canRegenerate,
      handleOpenStepCardModal,
      isAutosaveEnabled,
      registerFlushCallbacks,
    ]
  );

  return (
    <TooltipProvider>
      <div
        className="w-full p-6 space-y-8"
        data-page={`cohort-${isEditMode ? "edit" : "new"}`}
      >
        <ReadOnlyBanner
          disabled={disabled}
          disabledReason={cohortData?.disabled_reason ?? null}
          entityType="cohort"
        />

        <GenericForm
          nuqsParsers={
            cohortSearchParamsClient as Record<string, Parser<unknown>>
          }
          steps={steps}
          getStepStatus={getStepStatus}
          serverData={cohortData}
          formFieldKeys={formFieldKeys}
          resetSuccessMessage={resetSuccessMessage}
          onReset={(stepId) => handleReset(stepId)}
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
export default React.memo(CohortComponent, (prevProps, nextProps) => {
  // Compare cohortData by resource IDs, not object reference
  const prevIds = {
    name_id: prevProps.cohortData?.names?.resource?.id,
    description_id: prevProps.cohortData?.descriptions?.resource?.id,
    active_flag_id: prevProps.cohortData?.flags?.resource?.id,
    department_ids: prevProps.cohortData?.departments?.current?.map(
      (d) => d.department_id
    ),
    simulation_ids: prevProps.cohortData?.simulations?.current?.map(
      (s) => s.simulation_id
    ),
  };
  const nextIds = {
    name_id: nextProps.cohortData?.names?.resource?.id,
    description_id: nextProps.cohortData?.descriptions?.resource?.id,
    active_flag_id: nextProps.cohortData?.flags?.resource?.id,
    department_ids: nextProps.cohortData?.departments?.current?.map(
      (d) => d.department_id
    ),
    simulation_ids: nextProps.cohortData?.simulations?.current?.map(
      (s) => s.simulation_id
    ),
  };

  // Compare primitive props
  if (
    prevProps.cohortId !== nextProps.cohortId ||
    JSON.stringify(prevIds) !== JSON.stringify(nextIds)
  ) {
    return false; // Props changed, re-render
  }

  // Compare function props by reference (should be stable from server actions)
  if (
    prevProps.saveCohortAction !== nextProps.saveCohortAction ||
    prevProps.patchCohortDraftAction !== nextProps.patchCohortDraftAction ||
    prevProps.createNamesAction !== nextProps.createNamesAction ||
    prevProps.createDescriptionsAction !== nextProps.createDescriptionsAction ||
    prevProps.createSimulationPositionsAction !== nextProps.createSimulationPositionsAction
  ) {
    return false; // Function props changed, re-render
  }

  // All props are equivalent, skip re-render
  return true;
});
