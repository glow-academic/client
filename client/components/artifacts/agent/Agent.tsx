/**
 * Agent.tsx
 * Used to create and edit system agents
 * @AshokSaravanan222 & @siladiea
 * 07/20/2025
 */
"use client";

import { useRouter } from "next/navigation";
import React, {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
import { Flags } from "@/components/resources/Flags";
import { Instructions } from "@/components/resources/Instructions";
import { Models } from "@/components/resources/Models";
import { Names } from "@/components/resources/Names";
import { Prompts } from "@/components/resources/Prompts";
import { ReasoningLevels } from "@/components/resources/ReasoningLevels";
import { TemperatureLevels } from "@/components/resources/TemperatureLevels";
import { Tools } from "@/components/resources/Tools";
import { Voices } from "@/components/resources/Voices";
import { useBreadcrumbContext } from "@/contexts/breadcrumb-context";
import { useProfile } from "@/contexts/profile-context";
import { useSaveContext } from "@/contexts/save-context";
import { useAiGeneration } from "@/hooks/use-ai-generation";
import { useDraftLifecycle } from "@/hooks/use-draft-lifecycle";
import { useFlushRegistry } from "@/hooks/use-flush-registry";
import { useGenerationModal } from "@/hooks/use-generation-modal";
import {
  buildResourceActions,
  checkHasResourceIds,
  computeEffectiveFormState,
  type ResourceConfig,
} from "@/lib/resources/action-builders";
import type { ResourceType } from "@/lib/resources/types";
import type { ServerToClientEvents } from "@/lib/ws/types";
import {
  getDefaultDepartmentIds,
  transformDepartmentIdsForSubmit,
} from "@/utils/department-picker-helpers";
import {
  parseAsBoolean,
  parseAsString,
  useQueryStates,
  type Parser,
  type Values,
} from "nuqs";

// Type-only import from server page
import type {
  GetAgentOut,
  PatchAgentDraftIn,
  PatchAgentDraftOut,
  SaveAgentIn,
  SaveAgentOut,
} from "@/app/(main)/intelligence/agents/a/[agentId]/page";
import type { InputOf, OutputOf } from "@/lib/api/types";

// Resource creation action types
type CreateDraftVoicesIn = InputOf<"/api/v4/resources/voices", "post">;
type CreateDraftVoicesOut = OutputOf<"/api/v4/resources/voices", "post">;
type CreateDraftPromptsIn = InputOf<"/api/v4/resources/prompts", "post">;
type CreateDraftPromptsOut = OutputOf<"/api/v4/resources/prompts", "post">;
type AgentGenerationCompletePayload = Parameters<
  ServerToClientEvents["agent_generation_complete"]
>[0];

type AgentAiFormData = {
  name_resource?: AgentGenerationCompletePayload["name_resource"];
  description_resource?: AgentGenerationCompletePayload["description_resource"];
  model_resource?: AgentGenerationCompletePayload["model_resource"];
  prompt_resource?: AgentGenerationCompletePayload["prompt_resource"];
  instructions_resource?: AgentGenerationCompletePayload["instructions_resource"];
  flag_resource?: AgentGenerationCompletePayload["flag_resource"];
  temperature_level_resource?: AgentGenerationCompletePayload["temperature_level_resource"];
  reasoning_level_resource?: AgentGenerationCompletePayload["reasoning_level_resource"];
  department_resources?: AgentGenerationCompletePayload["department_resources"];
  tool_resources?: AgentGenerationCompletePayload["tool_resources"];
  voice_resources?: AgentGenerationCompletePayload["voice_resources"];
};

type SaveAgentBody = SaveAgentIn extends { body: infer B } ? B : never;

type FlushResult = {
  prompt_id?: string | null;
  voice_ids?: string[];
};

const FLUSH_KEYS = ["prompts", "voices"] as const;

const AGENT_RESOURCES: ResourceConfig[] = [
  { key: "names", formKey: "name_id", flushKey: null, type: "single" },
  {
    key: "descriptions",
    formKey: "description_id",
    flushKey: null,
    type: "single",
  },
  { key: "models", formKey: "modelId", flushKey: null, type: "single" },
  {
    key: "prompts",
    formKey: "prompt_id",
    flushKey: "prompt_id",
    type: "single",
  },
  {
    key: "instructions",
    formKey: "instructions_id",
    flushKey: null,
    type: "single",
  },
  { key: "flags", formKey: "active_flag_id", flushKey: null, type: "single" },
  {
    key: "departments",
    formKey: "departmentIds",
    flushKey: null,
    type: "multi",
  },
  { key: "tools", formKey: "tool_ids", flushKey: null, type: "multi" },
  {
    key: "temperature_levels",
    formKey: "temperature_level_id",
    flushKey: null,
    type: "single",
  },
  {
    key: "reasoning_levels",
    formKey: "reasoning_level_id",
    flushKey: null,
    type: "single",
  },
  { key: "voices", formKey: "voice_ids", flushKey: "voice_ids", type: "multi" },
];

export interface AgentProps {
  agentId?: string;
  // Optional server-provided data and actions (for server-side rendering)
  agentDetail?: GetAgentOut; // For edit mode (agent_id provided)
  agentDetailDefault?: GetAgentOut; // For new mode (agent_id = null)
  saveAgentAction?: (input: SaveAgentIn) => Promise<SaveAgentOut>;
  // Draft action: Resource-specific prop name is acceptable since types are resource-specific
  // See Z-DOCS.md "Draft Autosave Pattern" section for migration guide
  patchAgentDraftAction?: (
    input: PatchAgentDraftIn,
  ) => Promise<PatchAgentDraftOut>;
  // Resource creation actions
  createVoicesAction?: (
    input: CreateDraftVoicesIn,
  ) => Promise<CreateDraftVoicesOut>;
  createPromptsAction?: (
    input: CreateDraftPromptsIn,
  ) => Promise<CreateDraftPromptsOut>;
}

export default function Agent({
  agentId,
  agentDetail: serverAgentDetail,
  agentDetailDefault: serverAgentDetailDefault,
  saveAgentAction,
  patchAgentDraftAction,
  createVoicesAction,
  createPromptsAction,
}: AgentProps) {
  const router = useRouter();
  const isEditMode = !!agentId;
  const { profile, selectedDraftId, setSelectedDraftId, socket, isConnected } =
    useProfile();
  const { isAutosaveEnabled } = useSaveContext();
  const { setEntityMetadata, clearEntityMetadata } = useBreadcrumbContext();
  const isSuperadmin = profile?.role === "superadmin";
  const { flushRegistryRef, registerFlushCallbacks, flushAllResources } =
    useFlushRegistry<FlushResult>(FLUSH_KEYS);

  // Stabilize server props to prevent unnecessary re-renders from object reference changes
  const stabilizeServerProp = React.useCallback(
    (
      data: typeof serverAgentDetail | typeof serverAgentDetailDefault,
    ): string | null => {
      if (!data) return null;
      if (typeof data === "object" && data !== null) {
        if ("agent_id" in data && data.agent_id) {
          return `agent_id:${String(data.agent_id)}`;
        }
        const keyFields: Record<string, unknown> = {};
        if ("valid_model_ids" in data) {
          keyFields["valid_model_ids"] = Array.isArray(data["valid_model_ids"])
            ? data["valid_model_ids"].length
            : data["valid_model_ids"];
        }
        if ("valid_department_ids" in data) {
          keyFields["valid_department_ids"] = Array.isArray(
            data["valid_department_ids"],
          )
            ? data["valid_department_ids"].sort().join(",")
            : data["valid_department_ids"];
        }
        const sortedKeys = Object.keys(keyFields).sort();
        const hash = sortedKeys
          .map((k) => `${k}:${JSON.stringify(keyFields[k])}`)
          .join("|");
        return `new:${hash.length}:${hash.slice(0, 100)}`;
      }
      return String(data);
    },
    [],
  );

  const agentDetailId = React.useMemo(
    () => stabilizeServerProp(serverAgentDetail),
    [serverAgentDetail, stabilizeServerProp],
  );
  const agentDetailDefaultId = React.useMemo(
    () => stabilizeServerProp(serverAgentDetailDefault),
    [serverAgentDetailDefault, stabilizeServerProp],
  );

  // Use refs to track latest server props (for effect access) and stable props (for render)
  const latestServerAgentDetailRef = React.useRef(serverAgentDetail);
  const latestServerAgentDetailDefaultRef = React.useRef(
    serverAgentDetailDefault,
  );

  // Update latest refs on every render (no effect needed - just sync)
  latestServerAgentDetailRef.current = serverAgentDetail;
  latestServerAgentDetailDefaultRef.current = serverAgentDetailDefault;

  // Use refs to track stable server props - only update when ID changes
  const stableAgentDetailRef = React.useRef<{
    data: typeof serverAgentDetail;
    id: string | null;
  }>({
    data: serverAgentDetail,
    id: agentDetailId,
  });
  const stableAgentDetailDefaultRef = React.useRef<{
    data: typeof serverAgentDetailDefault;
    id: string | null;
  }>({
    data: serverAgentDetailDefault,
    id: agentDetailDefaultId,
  });

  React.useEffect(() => {
    // Only update when ID actually changes, use latest ref for data
    if (stableAgentDetailRef.current.id !== agentDetailId) {
      stableAgentDetailRef.current = {
        data: latestServerAgentDetailRef.current,
        id: agentDetailId,
      };
    }
  }, [agentDetailId]); // Only depend on ID, not object reference

  React.useEffect(() => {
    // Only update when ID actually changes, use latest ref for data
    if (stableAgentDetailDefaultRef.current.id !== agentDetailDefaultId) {
      stableAgentDetailDefaultRef.current = {
        data: latestServerAgentDetailDefaultRef.current,
        id: agentDetailDefaultId,
      };
    }
  }, [agentDetailDefaultId]); // Only depend on ID, not object reference

  // Use stable references
  const agentDetail = stableAgentDetailRef.current.data;
  const agentDetailDefault = stableAgentDetailDefaultRef.current.data;

  const sectionData = (
    isEditMode ? agentDetail : agentDetailDefault
  ) as GetAgentOut | undefined;
  const namesSection = sectionData?.names;
  const descriptionsSection = sectionData?.descriptions;
  const modelsSection = sectionData?.models;
  const promptsSection = sectionData?.prompts;
  const instructionsSection = sectionData?.instructions;
  const flagsSection = sectionData?.flags;
  const departmentsSection = sectionData?.departments;
  const toolsSection = sectionData?.tools;
  const temperatureLevelsSection = sectionData?.temperature_levels;
  const reasoningLevelsSection = sectionData?.reasoning_levels;
  const voicesSection = sectionData?.voices;

  // Inline parsers for URL-backed state (search/filter params only - form fields in draftState)
  const agentSearchParamsClient = {
    // Draft ID (URL-backed, updated when draft is created)
    draftId: parseAsString,
    // Search params for filtering (URL-backed for browser back/forward)
    modelSearch: parseAsString,
    toolSearch: parseAsString,
    toolShowSelected: parseAsBoolean,
    modelShowSelected: parseAsBoolean,
    reasoningSearch: parseAsString,
    voiceSearch: parseAsString,
    descriptionSearch: parseAsString,
    promptSearch: parseAsString,
    instructionsSearch: parseAsString,
  } as const;

  // URL-backed state using nuqs (only navigation/search params)
  const [urlParams] = useQueryStates(agentSearchParamsClient, {
    history: "replace",
    shallow: true, // Use shallow routing to prevent server component re-renders
  });

  // Get draftId from URL (managed by nuqs via urlParams)
  const urlDraftId = urlParams.draftId || null;

  // Sync URL draftId to profile context
  useEffect(() => {
    if (urlDraftId !== selectedDraftId) {
      setSelectedDraftId(urlDraftId);
    }
  }, [urlDraftId, selectedDraftId, setSelectedDraftId]);

  // Local draft state (not in URL) - initialized from server data or draft payload
  // Store resource IDs only, not text or resource objects (canonical pattern - matches Persona.tsx)
  type DraftState = {
    name_id: string | null;
    description_id: string | null;
    prompt_id: string | null;
    modelId: string;
    active_flag_id: string | null;
    tool_ids: string[];
    departmentIds: string[];
    temperature_level_id: string | null;
    reasoning_level_id: string | null;
    voice_ids: string[];
    instructions_id: string | null;
  };

  const defaultDepartmentIds = useMemo(
    () =>
      getDefaultDepartmentIds(
        isSuperadmin,
        profile?.primary_department_id ?? null,
      ),
    [isSuperadmin, profile?.primary_department_id],
  );

  // Initialize draft state from server data or draft payload
  // Extract resource IDs from server data (canonical pattern - matches Persona.tsx)
  const initialDraftState = useMemo((): DraftState => {
    const data = sectionData;
    if (!data) {
      return {
        name_id: null,
        description_id: null,
        prompt_id: null,
        modelId: "",
        active_flag_id: null,
        tool_ids: [],
        departmentIds: defaultDepartmentIds,
        temperature_level_id: null,
        reasoning_level_id: null,
        voice_ids: [],
        instructions_id: null,
      };
    }

    const currentFlag = data.flags?.current?.[0];
    const currentDepartments =
      data.departments?.current
        ?.map((d) => d.department_id)
        .filter((id): id is string => !!id) ?? [];
    const currentTools =
      data.tools?.current
        ?.map((t) => t.id)
        .filter((id): id is string => !!id) ?? [];
    const currentVoices =
      data.voices?.current
        ?.map((v) => v.id)
        .filter((id): id is string => !!id) ?? [];

    return {
      name_id: data.names?.resource?.id ?? null,
      description_id: data.descriptions?.resource?.id ?? null,
      prompt_id: data.prompts?.resource?.id ?? null,
      modelId: data.models?.resource?.id ?? "",
      active_flag_id: currentFlag?.flag_option_id ?? null,
      tool_ids: currentTools,
      departmentIds: currentDepartments,
      temperature_level_id: data.temperature_levels?.resource?.id ?? null,
      reasoning_level_id: data.reasoning_levels?.resource?.id ?? null,
      voice_ids: currentVoices,
      instructions_id: data.instructions?.resource?.id ?? null,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    sectionData,
    defaultDepartmentIds,
  ]);

  const [draftState, setDraftState] = useState<DraftState>(initialDraftState);
  const lastPatchedFormStateRef = useRef<Record<string, unknown>>(
    initialDraftState as Record<string, unknown>,
  );
  // Sync draft_version from server to avoid unintended draft forks.
  const draftVersion = sectionData?.draft_version ?? null;

  // Track previous initialDraftState content to avoid unnecessary updates
  const prevInitialDraftStateRef = useRef<string>(
    JSON.stringify(initialDraftState),
  );

  // Update draft state when server data changes (e.g., draft selected)
  useEffect(() => {
    // Deep compare to avoid unnecessary state updates
    const currentStateStr = prevInitialDraftStateRef.current;
    const newStateStr = JSON.stringify(initialDraftState);

    // Only update if content actually changed
    if (currentStateStr !== newStateStr) {
      prevInitialDraftStateRef.current = newStateStr;
      setDraftState(initialDraftState);
      lastPatchedFormStateRef.current = {
        ...initialDraftState,
      } as Record<string, unknown>;
    }
  }, [initialDraftState]);

  const formStateRef = useRef(draftState as Record<string, unknown>);
  useEffect(() => {
    formStateRef.current = draftState as Record<string, unknown>;
  }, [draftState]);

  const hasResourceIds = checkHasResourceIds(
    AGENT_RESOURCES,
    draftState as Record<string, unknown>,
  );

  const patchActionRef = useRef<
    | ((
        payload: Record<string, unknown>,
      ) => Promise<{ draft_id?: string | null; new_version?: number | null }>)
    | undefined
  >(undefined);

  useEffect(() => {
    if (!patchAgentDraftAction) {
      patchActionRef.current = undefined;
      return;
    }
    patchActionRef.current = async (payload: Record<string, unknown>) =>
      patchAgentDraftAction({ body: payload } as PatchAgentDraftIn);
  }, [patchAgentDraftAction]);

  const buildPatchPayload = useCallback(
    (
      nextDraftId: string | null,
      expectedVersion: number,
      flushResults: Record<string, unknown> = {},
    ) => {
      const effective = computeEffectiveFormState(
        AGENT_RESOURCES,
        draftState as Record<string, unknown>,
        flushResults,
      );

      return {
        input_draft_id: nextDraftId,
        group_id: sectionData?.group_id ?? null,
        ...buildResourceActions(AGENT_RESOURCES, {
          formState: effective,
          referenceState: lastPatchedFormStateRef.current,
          flushResults,
          entityData: (sectionData as Record<string, unknown> | undefined) ?? null,
        }),
        expected_version: expectedVersion,
      };
    },
    [sectionData, draftState],
  );

  const {
    setUrlFormDataRef,
    onFormDataChange,
    flushAllAndSave,
    formDataRef,
  } = useDraftLifecycle({
    formStateKey: JSON.stringify(draftState),
    patchActionRef,
    isAutosaveEnabled,
    buildPatchPayload,
    setSelectedDraftId,
    serverDraftVersion: typeof draftVersion === "number" ? draftVersion : null,
    hasResourceIds,
    flushRegistryRef,
    formStateRef,
    onPatchSuccess: () => {
      lastPatchedFormStateRef.current = { ...formStateRef.current };
    },
  });

  // Use server actions directly (no mutations needed)
  const handleSaveAgent = useCallback(
    async (body: SaveAgentBody) => {
      if (!saveAgentAction) {
        throw new Error("saveAgentAction is required");
      }
      await saveAgentAction({ body });
    },
    [saveAgentAction],
  );

  // Get selected model capabilities
  const selectedModelCapabilities = useMemo(() => {
    if (!draftState.modelId) {
      return null;
    }

    const selectedModel = modelsSection?.resources?.find(
      (m: any) => m.model_id === draftState.modelId,
    );
    if (!selectedModel) {
      return null;
    }

    const inputMods = (selectedModel as any).input_modalities ?? [];
    const outputMods = (selectedModel as any).output_modalities ?? [];

    return {
      input_modalities: inputMods,
      output_modalities: outputMods,
      has_text_output: outputMods.includes("text"),
      has_audio_input: inputMods.includes("audio"),
      has_audio_output: outputMods.includes("audio"),
      has_image_output: outputMods.includes("image"),
      has_video_output: outputMods.includes("video"),
    };
  }, [draftState.modelId, modelsSection?.resources]);

  // Set breadcrumb context when agent data is loaded
  useEffect(() => {
    const agentName = namesSection?.resource?.name;
    if (agentName && agentId && isEditMode) {
      setEntityMetadata({
        entityId: agentId,
        entityName: agentName,
        entityType: "agent",
      });
    }
    return () => clearEntityMetadata();
  }, [
    namesSection?.resource?.name,
    agentId,
    isEditMode,
    setEntityMetadata,
    clearEntityMetadata,
  ]);

  // handleInputChange removed - use setDraftState directly

  const resetFormAndState = useCallback(() => {
    setDraftState(initialDraftState);
  }, [initialDraftState]);

  // Initialize form from server data (for GenericForm)
  const initializeForm = useCallback(
    (
      _serverData: unknown,
      _isEditMode: boolean,
    ): Partial<Values<Record<string, Parser<unknown>>>> => {
      // GenericForm expects URL params, but we use draftState for form fields
      // So we return empty object - form fields are initialized via draftState
      return {};
    },
    [],
  );

  // Steps configuration for GenericForm (moved before handleReset to fix declaration order)
  const steps = useMemo(() => {
    const baseSteps = [
      {
        id: "basic",
        title: "Basic Information",
        description:
          "Set the agent name, description, departments, and active status.",
        resetFields: [
          "name",
          "description",
          "active",
          "departmentIds",
        ] as string[],
      },
      {
        id: "tools",
        title: "Tools",
        description:
          "Select the tools this agent can use. Tools define what operations the agent can perform.",
        resetFields: ["tool_ids"] as string[],
      },
      {
        id: "model",
        title: "Model",
        description: "Select the AI model for this agent.",
        resetFields: ["modelId"] as string[],
      },
    ];

    // Conditionally add configuration steps based on model capabilities
    const configSteps = [];

    if (selectedModelCapabilities) {
      configSteps.push({
        id: "temperature",
        title: "Temperature",
        description: "Configure the temperature setting for the model.",
        optional: true,
        resetFields: ["temperature_level_id"] as string[],
      });

      if (selectedModelCapabilities.has_text_output) {
        configSteps.push({
          id: "reasoning",
          title: "Reasoning Effort",
          description: "Configure the reasoning effort level.",
          optional: true,
          resetFields: ["reasoning_level_id"] as string[],
        });
      }

      // Only show voice configuration for models with BOTH input and output audio (e.g., gpt-realtime)
      if (
        selectedModelCapabilities.has_audio_input &&
        selectedModelCapabilities.has_audio_output
      ) {
        configSteps.push({
          id: "voice",
          title: "Voices",
          description: "Select voices for audio output.",
          optional: true,
          resetFields: ["voice_ids"] as string[],
        });
      }
    }

    const instructionsStep = {
      id: "instructions",
      title: "Instructions",
      description: "Define instructions for the agent's behavior.",
      optional: true,
      resetFields: ["instructions_id"] as string[],
    };

    const promptStep = {
      id: "prompt",
      title: "Prompt Instructions",
      description: "Define the system prompt that controls agent behavior.",
      resetFields: ["prompt_id"] as string[],
    };

    return [...baseSteps, ...configSteps, instructionsStep, promptStep];
  }, [selectedModelCapabilities]);

  // Reset handler for GenericForm - resets draftState fields
  // Simplified with constant map (canonical pattern)
  const resetters: Record<
    string,
    (s: DraftState, init: DraftState) => Partial<DraftState>
  > = useMemo(
    () => ({
      name: (_s, init) => ({ name_id: init.name_id }),
      description: (_s, init) => ({ description_id: init.description_id }),
      active: (_s, init) => ({ active_flag_id: init.active_flag_id }),
      departmentIds: (_s, init) => ({ departmentIds: init.departmentIds }),
      tool_ids: (_s, init) => ({ tool_ids: init.tool_ids }),
      modelId: (_s, init) => ({ modelId: init.modelId }),
      temperature_level_id: (_s, init) => ({
        temperature_level_id: init.temperature_level_id,
      }),
      reasoning_level_id: (_s, init) => ({
        reasoning_level_id: init.reasoning_level_id,
      }),
      voice_ids: (_s, init) => ({ voice_ids: init.voice_ids }),
      prompt_id: (_s, init) => ({ prompt_id: init.prompt_id }),
      instructions_id: (_s, init) => ({
        instructions_id: init.instructions_id,
      }),
    }),
    [],
  );

  const handleReset = useCallback(
    (stepId: string, _fields: string[]) => {
      const step = steps.find((s) => s.id === stepId);
      if (!step || !step.resetFields) return;

      // Map resetFields to draftState fields and reset them
      const resetUpdates: Partial<DraftState> = {};
      step.resetFields.forEach((field) => {
        const resetter = resetters[field];
        if (resetter) {
          Object.assign(resetUpdates, resetter(draftState, initialDraftState));
        }
      });

      setDraftState((prev) => ({ ...prev, ...resetUpdates }));
    },
    [steps, initialDraftState, draftState, resetters],
  );

  // Handle form submission (for GenericForm)
  const handleSubmit = useCallback(
    async (_formData: Values<Record<string, Parser<unknown>>>) => {
      try {
        const flushResults = await flushAllResources();
        const effectiveFormState = computeEffectiveFormState(
          AGENT_RESOURCES,
          draftState as Record<string, unknown>,
          flushResults,
        );

        const nameId = effectiveFormState["name_id"] as string | null;
        const descriptionId = effectiveFormState["description_id"] as
          | string
          | null;
        const promptId = effectiveFormState["prompt_id"] as string | null;
        const modelId = effectiveFormState["modelId"] as string | null;
        if (!nameId) throw new Error("Agent name is required");
        if (!descriptionId) throw new Error("Agent description is required");
        if (!promptId) throw new Error("Prompt selection is required");
        if (!modelId || modelId.trim().length === 0) {
          throw new Error("Model selection is required");
        }

        const validDepartmentIds =
          departmentsSection?.resources
            ?.map((d: any) => d.department_id)
            .filter((id: any): id is string => !!id) ?? [];
        const finalDepartmentIds = transformDepartmentIdsForSubmit(
          (effectiveFormState["departmentIds"] as string[]) ?? [],
          isSuperadmin,
          validDepartmentIds,
        );
        const normalizedFormState = {
          ...effectiveFormState,
          departmentIds: finalDepartmentIds,
        };
        const saveActions = buildResourceActions(AGENT_RESOURCES, {
          formState: normalizedFormState,
          referenceState: lastPatchedFormStateRef.current,
          flushResults,
          entityData: (sectionData as Record<string, unknown> | undefined) ?? null,
        });

        // Save agent using unified v4 API (handles both create and update)
        if (!profile?.id) {
          toast.error("Profile not loaded. Please refresh the page.");
          throw new Error("Profile not loaded");
        }

        const savePayload = {
          group_id: sectionData?.group_id ?? "",
          input_agent_id: isEditMode ? agentId : null,
          ...saveActions,
        } as SaveAgentBody;
        await handleSaveAgent(savePayload);
        toast.success(
          `Agent ${isEditMode ? "updated" : "created"} successfully!`,
        );
        resetFormAndState();
        router.push("/intelligence/agents");
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        toast.error(
          `Failed to ${isEditMode ? "update" : "create"} agent: ${msg}`,
        );
        throw error; // Re-throw for GenericForm to handle
      }
    },
    [
      draftState,
      isEditMode,
      agentId,
      sectionData,
      departmentsSection?.resources,
      isSuperadmin,
      profile,
      handleSaveAgent,
      flushAllResources,
      resetFormAndState,
      router,
    ],
  );

  // Extract disabled state from can_edit flag (check in both new and edit modes)
  const disabled = useMemo(
    () => (sectionData?.can_edit == null ? false : !sectionData.can_edit),
    [sectionData?.can_edit],
  );

  const isReadonly = disabled; // Alias for backward compatibility

  // Step status calculation for GenericForm
  // Check resource IDs instead of display values (canonical pattern - matches Persona.tsx)
  const getStepStatus = useCallback(
    (
      stepId: string,
      _formData: Values<Record<string, Parser<unknown>>>,
    ): StepStatus => {
      const hasModel = !!draftState.modelId?.trim();
      const hasName = !!draftState.name_id;
      const hasDescription = !!draftState.description_id;
      const hasTools = draftState.tool_ids && draftState.tool_ids.length > 0;

      switch (stepId) {
        case "basic":
          return hasName && hasDescription ? "completed" : "active";
        case "tools":
          if (!hasName || !hasDescription) return "pending";
          return hasTools ? "completed" : "active";
        case "model":
          return hasModel ? "completed" : "active";
        case "temperature":
          if (!hasModel) return "pending";
          // Optional step: completed only if value is chosen
          return draftState.temperature_level_id ? "completed" : "active";
        case "reasoning":
          if (!hasModel) return "pending";
          // Optional step: completed only if value is chosen
          return draftState.reasoning_level_id ? "completed" : "active";
        case "voice":
          if (!hasModel) return "pending";
          // Optional step: completed only if value is chosen
          return draftState.voice_ids.length > 0 ? "completed" : "active";
        case "prompt":
          if (!hasModel) return "pending";
          return draftState.prompt_id ? "completed" : "active";
        case "instructions":
          // Instructions are optional: completed only if value is chosen
          if (!hasModel) return "pending";
          return draftState.instructions_id ? "completed" : "active";
        default:
          return "pending";
      }
    },
    [draftState],
  );

  // Helper to check if a resource type can be regenerated
  const canRegenerate = useCallback(
    (resourceType: ResourceType): boolean => {
      switch (resourceType) {
        case "names":
          return namesSection?.resource?.generated ?? false;
        case "descriptions":
          return descriptionsSection?.resource?.generated ?? false;
        case "models":
          return (
            modelsSection?.resources?.some(
              (m: any) => (m as { generated?: boolean }).generated,
            ) ?? false
          );
        case "prompts":
          return promptsSection?.resources?.some((p: any) => p.generated) ?? false;
        case "instructions":
          return instructionsSection?.resource?.generated ?? false;
        case "flags":
          return flagsSection?.current?.some((f) => f.generated) ?? false;
        case "departments":
          return departmentsSection?.current?.some((d: any) => d.generated) ?? false;
        case "reasoning_levels":
          return reasoningLevelsSection?.resource?.generated ?? false;
        case "temperature_levels":
          return temperatureLevelsSection?.resource?.generated ?? false;
        case "voices":
          return voicesSection?.current?.some((v: any) => v.generated) ?? false;
        case "tools":
          return toolsSection?.current?.some((t: any) => t.generated) ?? false;
        default:
          return false;
      }
    },
    [
      namesSection?.resource,
      descriptionsSection?.resource,
      modelsSection?.resources,
      promptsSection?.resources,
      instructionsSection?.resource,
      flagsSection?.current,
      departmentsSection?.current,
      reasoningLevelsSection?.resource,
      temperatureLevelsSection?.resource,
      voicesSection?.current,
      toolsSection?.current,
    ],
  );
  const canRegenerateForStepCard = useCallback(
    (resourceType: string) => canRegenerate(resourceType as ResourceType),
    [canRegenerate],
  );

  // Valid resource types for AI generation
  const AGENT_VALID_RESOURCE_TYPES: ResourceType[] = useMemo(
    () => [
      "names",
      "descriptions",
      "models",
      "prompts",
      "instructions",
      "flags",
      "departments",
      "reasoning_levels",
      "temperature_levels",
      "voices",
      "tools",
    ],
    [],
  );

  // AI generation completion handler
  const onAiComplete = useCallback((data: Record<string, unknown>) => {
    const aiUpdates: Partial<AgentAiFormData> = {};
    if (data["name_resource"]) {
      aiUpdates.name_resource = data[
        "name_resource"
      ] as AgentAiFormData["name_resource"];
    }
    if (data["description_resource"]) {
      aiUpdates.description_resource = data[
        "description_resource"
      ] as AgentAiFormData["description_resource"];
    }
    if (data["model_resource"]) {
      aiUpdates.model_resource = data[
        "model_resource"
      ] as AgentAiFormData["model_resource"];
    }
    if (data["prompt_resource"]) {
      aiUpdates.prompt_resource = data[
        "prompt_resource"
      ] as AgentAiFormData["prompt_resource"];
    }
    if (data["instructions_resource"]) {
      aiUpdates.instructions_resource = data[
        "instructions_resource"
      ] as AgentAiFormData["instructions_resource"];
    }
    if (data["flag_resource"]) {
      aiUpdates.flag_resource = data["flag_resource"] as AgentAiFormData["flag_resource"];
    }
    if (data["temperature_level_resource"]) {
      aiUpdates.temperature_level_resource = data[
        "temperature_level_resource"
      ] as AgentAiFormData["temperature_level_resource"];
    }
    if (data["reasoning_level_resource"]) {
      aiUpdates.reasoning_level_resource = data[
        "reasoning_level_resource"
      ] as AgentAiFormData["reasoning_level_resource"];
    }
    if (data["department_resources"]) {
      aiUpdates.department_resources = data[
        "department_resources"
      ] as AgentAiFormData["department_resources"];
    }
    if (data["tool_resources"]) {
      aiUpdates.tool_resources = data[
        "tool_resources"
      ] as AgentAiFormData["tool_resources"];
    }
    if (data["voice_resources"]) {
      aiUpdates.voice_resources = data[
        "voice_resources"
      ] as AgentAiFormData["voice_resources"];
    }

    const formStateUpdates: Record<string, unknown> = {};
    const nameResource = data["name_resource"] as { id?: string } | undefined;
    if (nameResource?.id) formStateUpdates["name_id"] = nameResource.id;
    const descriptionResource = data["description_resource"] as
      | { id?: string }
      | undefined;
    if (descriptionResource?.id) {
      formStateUpdates["description_id"] = descriptionResource.id;
    }
    const modelResource = data["model_resource"] as { id?: string } | undefined;
    if (modelResource?.id) formStateUpdates["modelId"] = modelResource.id;
    const promptResource = data["prompt_resource"] as { id?: string } | undefined;
    if (promptResource?.id) formStateUpdates["prompt_id"] = promptResource.id;
    const instructionsResource = data["instructions_resource"] as
      | { id?: string }
      | undefined;
    if (instructionsResource?.id) {
      formStateUpdates["instructions_id"] = instructionsResource.id;
    }
    const flagResource = data["flag_resource"] as { id?: string } | undefined;
    if (flagResource?.id) {
      formStateUpdates["active_flag_id"] = flagResource.id;
    }
    const tempLevelResource = data["temperature_level_resource"] as
      | { id?: string }
      | undefined;
    if (tempLevelResource?.id) {
      formStateUpdates["temperature_level_id"] = tempLevelResource.id;
    }
    const reasoningLevelResource = data["reasoning_level_resource"] as
      | { id?: string }
      | undefined;
    if (reasoningLevelResource?.id) {
      formStateUpdates["reasoning_level_id"] = reasoningLevelResource.id;
    }

    const departmentResources = data["department_resources"] as
      | Array<{ department_id?: string | null }>
      | undefined;
    if (departmentResources?.length) {
      formStateUpdates["departmentIds"] = departmentResources
        .map((item) => item.department_id)
        .filter((id): id is string => !!id);
    }

    const toolResources = data["tool_resources"] as
      | Array<{ id?: string | null }>
      | undefined;
    if (toolResources?.length) {
      formStateUpdates["tool_ids"] = toolResources
        .map((item) => item.id)
        .filter((id): id is string => !!id);
    }

    const voiceResources = data["voice_resources"] as
      | Array<{ id?: string | null }>
      | undefined;
    if (voiceResources?.length) {
      formStateUpdates["voice_ids"] = voiceResources
        .map((item) => item.id)
        .filter((id): id is string => !!id);
    }

    return { aiUpdates, formStateUpdates };
  }, []);

  // AI generation hook (replaces WebSocket useEffect + generatingResources state)
  const { setGeneratingResources, isGenerating, aiFormData } = useAiGeneration<
    ResourceType,
    AgentAiFormData
  >({
    socket,
    isConnected,
    artifactType: "agent",
    groupId: sectionData?.group_id,
    eventPrefix: "agent_generation",
    validResourceTypes: AGENT_VALID_RESOURCE_TYPES,
    onComplete: onAiComplete,
    setFormState: setDraftState as Dispatch<
      SetStateAction<Record<string, unknown>>
    >,
  });
  const isGeneratingForStepCard = useCallback(
    (resourceType: string) => isGenerating(resourceType as ResourceType),
    [isGenerating],
  );

  // Multi-generation handler - accepts list of resource types and optional user instructions
  const handleGenerateResources = useCallback(
    async (
      resourceTypes: ResourceType[],
      userInstructions?: string,
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

      let currentDraftId =
        (formDataRef.current["draftId"] as string | undefined) ?? null;
      if (!currentDraftId) currentDraftId = await flushAllAndSave();
      if (!currentDraftId) {
        toast.error("Please save a draft before generating with AI");
        return;
      }

      // Emit agent_generate event
      socket.emit("agent_generate", {
        resource_types: resourceTypes,
        user_instructions: userInstructions ? [userInstructions] : null,
        agent_id: agentId || null,
        draft_id: currentDraftId,
        mcp: false,
      });
    },
    [
      socket,
      isConnected,
      agentId,
      setGeneratingResources,
      formDataRef,
      flushAllAndSave,
    ],
  );

  // Individual generation handlers
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

  const handleGenerateReasoningLevels = useCallback(
    async () => handleGenerateResources(["reasoning_levels"]),
    [handleGenerateResources],
  );

  const handleGenerateTemperatureLevels = useCallback(
    async () => handleGenerateResources(["temperature_levels"]),
    [handleGenerateResources],
  );

  // Step-to-resources mapping for multi-generation
  const stepResources: Record<string, ResourceType[]> = useMemo(
    () => ({
      basic: ["names", "descriptions", "departments", "flags"],
      model: ["models"],
      temperature: ["temperature_levels"],
      reasoning: ["reasoning_levels"],
      voice: ["voices"],
      prompt: ["prompts"],
      instructions: ["instructions"],
      tools: ["tools"],
      all: [
        "names",
        "descriptions",
        "models",
        "prompts",
        "instructions",
        "flags",
        "departments",
        "reasoning_levels",
        "temperature_levels",
        "voices",
        "tools",
      ],
    }),
    [],
  );

  // Resource labels for display (only for resources used in this component)
  const resourceLabels: Partial<Record<ResourceType, string>> = useMemo(
    () => ({
      names: "Names",
      descriptions: "Descriptions",
      models: "Models",
      prompts: "Prompts",
      instructions: "Instructions",
      flags: "Flags",
      departments: "Departments",
      reasoning_levels: "Reasoning Levels",
      temperature_levels: "Temperature Levels",
      voices: "Voices",
      tools: "Tools",
    }),
    [],
  );

  // Modal generate handler
  const onModalGenerate = useCallback(
    (selectedResources: ResourceType[], instructions?: string) => {
      handleGenerateResources(selectedResources, instructions);
    },
    [handleGenerateResources],
  );

  // Generation modal hook (replaces modal state + handleOpenStepCardModal + full-page-generate listener)
  const { handleOpenStepCardModal, modalProps } =
    useGenerationModal<ResourceType>({
      stepResources,
      resourceLabels,
      canRegenerate,
      onGenerate: onModalGenerate,
      isGenerating,
    });

  const mergeById = useCallback(
    <T extends { id?: string | null }>(base: T[] = [], extra: T[] = []): T[] => {
      const map = new Map<string, T>();
      for (const item of base) {
        if (item.id) map.set(item.id, item);
      }
      for (const item of extra) {
        if (item.id) map.set(item.id, item);
      }
      return Array.from(map.values());
    },
    [],
  );

  const mergeByDepartmentId = useCallback(
    <T extends { department_id?: string | null }>(
      base: T[] = [],
      extra: T[] = [],
    ): T[] => {
      const map = new Map<string, T>();
      for (const item of base) {
        if (item.department_id) map.set(item.department_id, item);
      }
      for (const item of extra) {
        if (item.department_id) map.set(item.department_id, item);
      }
      return Array.from(map.values());
    },
    [],
  );

  const aiNameResource = aiFormData.name_resource;
  const aiDescriptionResource = aiFormData.description_resource;
  const aiModelResource = aiFormData.model_resource;
  const aiPromptResource = aiFormData.prompt_resource;
  const aiInstructionsResource = aiFormData.instructions_resource;
  const aiTemperatureResource = aiFormData.temperature_level_resource;
  const aiReasoningResource = aiFormData.reasoning_level_resource;

  const mergedNames = mergeById(
    namesSection?.resources ?? [],
    aiNameResource ? [aiNameResource as { id?: string | null }] : [],
  );
  const mergedDescriptions = mergeById(
    descriptionsSection?.resources ?? [],
    aiDescriptionResource
      ? [aiDescriptionResource as { id?: string | null }]
      : [],
  );
  const mergedModels = mergeById(
    modelsSection?.resources ?? [],
    aiModelResource ? [aiModelResource] : [],
  );
  const mergedPrompts = mergeById(
    promptsSection?.resources ?? [],
    aiPromptResource ? [aiPromptResource] : [],
  );
  const mergedInstructions = mergeById(
    instructionsSection?.resources ?? [],
    aiInstructionsResource ? [aiInstructionsResource] : [],
  );
  const mergedTemperatureLevels = mergeById(
    temperatureLevelsSection?.resources ?? [],
    aiTemperatureResource ? [aiTemperatureResource] : [],
  );
  const mergedReasoningLevels = mergeById(
    reasoningLevelsSection?.resources ?? [],
    aiReasoningResource ? [aiReasoningResource] : [],
  );
  const mergedTools = mergeById(
    toolsSection?.resources ?? [],
    (aiFormData.tool_resources ?? []) as Array<{ id?: string | null }>,
  );
  const mergedVoices = mergeById(
    voicesSection?.resources ?? [],
    (aiFormData.voice_resources ?? []) as Array<{ id?: string | null }>,
  );
  const mergedDepartments = mergeByDepartmentId(
    departmentsSection?.resources ?? [],
    (aiFormData.department_resources ?? []) as Array<{
      department_id?: string | null;
    }>,
  );

  return (
    <div className="space-y-6 py-4 px-4">
        <ReadOnlyBanner
          disabled={disabled}
          disabledReason={sectionData?.disabled_reason ?? null}
          entityType="agent"
        />
        <div className="w-full">
          <GenericForm
            nuqsParsers={
              agentSearchParamsClient as Record<string, Parser<unknown>>
            }
            onFormDataChange={onFormDataChange}
            steps={steps}
            getStepStatus={getStepStatus}
            serverData={sectionData}
            initializeForm={initializeForm}
            formFieldKeys={[]} // Form fields are in draftState, not URL params
            onReset={handleReset}
            resetSuccessMessage={(stepId) => {
              switch (stepId) {
                case "basic":
                  return "Basic information reset";
                case "tools":
                  return "Tools reset";
                case "model":
                  return "Model reset";
                case "temperature":
                  return "Temperature reset";
                case "reasoning":
                  return "Reasoning effort reset";
                case "voice":
                  return "Voices reset";
                case "prompt":
                  return "Prompt reset";
                case "instructions":
                  return "Instructions reset";
                default:
                  return "Reset";
              }
            }}
            onSubmit={handleSubmit}
            submitButton={{
              backUrl: "/intelligence/agents",
              backLabel: "Back",
              createLabel: "Create Agent",
              updateLabel: "Update Agent",
            }}
            isReadonly={isReadonly}
            isEditMode={isEditMode}
            registerSetFormData={(setter) => {
              setUrlFormDataRef.current = setter as (
                updates: Record<string, unknown>,
              ) => void;
            }}
            renderStep={({
              stepId,
              stepStatus,
              stepTitle,
              stepDescription,
              stepNumber,
              formData: stepFormData,
              setFormData: setStepFormData,
              onReset,
            }) => {
              switch (stepId) {
                case "basic": {
                  const descriptionSearch =
                    (stepFormData["descriptionSearch"] as
                      | string
                      | null
                      | undefined) || "";
                  return (
                    <StepCard
                      stepStatus={stepStatus}
                      stepNumber={stepNumber}
                      stepTitle={stepTitle}
                      stepDescription={stepDescription}
                      isReadonly={isReadonly}
                      isEditMode={isEditMode}
                      customHeader={
                        <Names
                          name_id={draftState.name_id}
                          name_resource={aiNameResource ?? namesSection?.resource ?? null}
                          show_name={namesSection?.show ?? true}
                          name_suggestions={namesSection?.suggestions ?? []}
                          names={mergedNames}
                          disabled={isReadonly}
                          onNameIdChange={(nameId) => {
                            // Update draftState with name_id (canonical pattern - IDs are source of truth)
                            setDraftState((prev) => ({
                              ...prev,
                              name_id: nameId,
                            }));
                          }}
                          onGenerate={handleGenerateName}
                          isGenerating={isGenerating("names")}
                          placeholder="e.g., Customer Support Agent"
                          defaultName="New Agent"
                          required={namesSection?.required ?? false}
                          hideDescription={true}
                          group_id={sectionData?.group_id ?? null}
                          showAiGenerate={!!sectionData?.names?.show_ai_generate}
                        />
                      }
                      resetFields={[
                        "name",
                        "description",
                        "active",
                        "departmentIds",
                      ]}
                      actions={
                        stepResources["basic"] &&
                        stepResources["basic"].length > 0 &&
                        (sectionData?.names?.show_ai_generate ||
                          sectionData?.descriptions?.show_ai_generate ||
                          sectionData?.departments?.show_ai_generate ||
                          sectionData?.flags?.show_ai_generate) ? (
                          <StepCardAiButton
                            stepId="basic"
                            resourceTypes={stepResources["basic"] ?? []}
                            canRegenerate={canRegenerateForStepCard}
                            isGenerating={isGeneratingForStepCard}
                            onOpenModal={handleOpenStepCardModal}
                            disabled={isReadonly}
                          />
                        ) : undefined
                      }
                      {...(onReset ? { onReset } : {})}
                      resetLabel="Reset"
                    >
                      <div className="space-y-4">
                        {/* Description field - using Descriptions resource component */}
                        <Descriptions
                          description_id={draftState.description_id}
                          description_resource={
                            aiDescriptionResource ?? descriptionsSection?.resource ?? null
                          }
                          show_description={descriptionsSection?.show ?? true}
                          description_suggestions={
                            descriptionsSection?.suggestions ?? []
                          }
                          descriptions={mergedDescriptions}
                          disabled={isReadonly}
                          onDescriptionIdChange={(descriptionId) => {
                            // Update draftState with description_id (canonical pattern - IDs are source of truth)
                            setDraftState((prev) => ({
                              ...prev,
                              description_id: descriptionId,
                            }));
                          }}
                          searchTerm={descriptionSearch}
                          onSearchChange={(term: string) =>
                            setStepFormData({ descriptionSearch: term || null })
                          }
                          onGenerate={handleGenerateDescription}
                          isGenerating={isGenerating("descriptions")}
                          label="Description"
                          placeholder="Detailed behavior description and personality traits"
                          required={descriptionsSection?.required ?? false}
                          rows={4}
                          data-testid="input-agent-description"
                          group_id={sectionData?.group_id ?? null}
                          showAiGenerate={
                            !!sectionData?.descriptions?.show_ai_generate
                          }
                        />

                        {/* Department Selection */}
                        <Departments
                          department_ids={draftState.departmentIds || []}
                          department_resources={
                            (aiFormData.department_resources ??
                              departmentsSection?.current ??
                              []) as any[]
                          }
                          show_departments={
                            departmentsSection?.show ?? false
                          }
                          department_suggestions={
                            (departmentsSection?.suggestions ?? []) as string[]
                          }
                          departments={mergedDepartments}
                          disabled={isReadonly}
                          onChange={(ids) => {
                            setDraftState((prev) => ({
                              ...prev,
                              departmentIds: ids,
                            }));
                          }}
                          onGenerate={handleGenerateDepartments}
                          isGenerating={isGenerating("departments")}
                          required={departmentsSection?.required ?? false}
                          group_id={sectionData?.group_id ?? null}
                          showAiGenerate={
                            !!sectionData?.departments?.show_ai_generate
                          }
                        />

                        <Flags
                          flags={flagsSection?.resources ?? []}
                          flag_id={draftState.active_flag_id}
                          show_flags={flagsSection?.show ?? false}
                          columns={1}
                          label="Active"
                          disabled={isReadonly}
                          onChange={(flagId) => {
                            setDraftState((prev) => ({
                              ...prev,
                              active_flag_id: flagId,
                            }));
                          }}
                          onGenerate={handleGenerateFlags}
                          isGenerating={isGenerating("flags")}
                          group_id={sectionData?.group_id ?? null}
                          link_tool_id={flagsSection?.link_tool_id ?? null}
                          showAiGenerate={!!sectionData?.flags?.show_ai_generate}
                        />
                      </div>
                    </StepCard>
                  );
                }

                case "tools": {
                  const toolSearch =
                    (stepFormData["toolSearch"] as string) || "";
                  const toolShowSelected =
                    (stepFormData["toolShowSelected"] as boolean) ?? false;
                  return (
                    <StepCard
                      stepStatus={stepStatus}
                      stepNumber={stepNumber}
                      stepTitle={stepTitle}
                      stepDescription={stepDescription}
                      isReadonly={isReadonly}
                      isEditMode={isEditMode}
                      searchTerm={toolSearch}
                      onSearchChange={(term) =>
                        setStepFormData({ toolSearch: term || null })
                      }
                      searchPlaceholder="Search tools..."
                      filters={[
                        {
                          key: "showSelected",
                          label: "Show selected",
                          value: toolShowSelected,
                          onChange: (value: boolean) =>
                            setStepFormData({
                              toolShowSelected: value || null,
                            }),
                        },
                      ]}
                      resetFields={["tool_ids"]}
                      {...(onReset ? { onReset } : {})}
                      resetLabel="Reset"
                      actions={
                        stepResources["tools"] &&
                        stepResources["tools"].length > 0 &&
                        sectionData?.tools?.show_ai_generate ? (
                          <StepCardAiButton
                            stepId="tools"
                            resourceTypes={stepResources["tools"] ?? []}
                            canRegenerate={canRegenerateForStepCard}
                            isGenerating={isGeneratingForStepCard}
                            onOpenModal={handleOpenStepCardModal}
                            disabled={isReadonly}
                          />
                        ) : undefined
                      }
                    >
                      <Tools
                        tool_ids={draftState.tool_ids}
                        tool_resources={
                          (aiFormData.tool_resources ?? toolsSection?.current ?? []) as any[]
                        }
                        show_tools={toolsSection?.show ?? false}
                        tool_suggestions={toolsSection?.suggestions ?? []}
                        tools={mergedTools as any[]}
                        disabled={isReadonly}
                        onChange={(ids) =>
                          setDraftState((prev) => ({ ...prev, tool_ids: ids }))
                        }
                        label="Tools"
                        description="Select the tools this agent can use. Tools define what operations the agent can perform."
                        required={toolsSection?.required ?? false}
                        group_id={sectionData?.group_id ?? null}
                        link_tool_id={toolsSection?.link_tool_id ?? null}
                        showAiGenerate={!!sectionData?.tools?.show_ai_generate}
                        searchTerm={toolSearch}
                        onSearchChange={(term) =>
                          setStepFormData({ toolSearch: term || null })
                        }
                        showSelectedFilter={toolShowSelected}
                        onShowSelectedChange={(value) =>
                          setStepFormData({ toolShowSelected: value })
                        }
                      />
                    </StepCard>
                  );
                }

                case "model": {
                  const modelSearch =
                    (stepFormData["modelSearch"] as string) || "";
                  const modelShowSelected =
                    (stepFormData["modelShowSelected"] as boolean) ?? false;
                  return (
                    <StepCard
                      stepStatus={stepStatus}
                      stepNumber={stepNumber}
                      stepTitle={stepTitle}
                      stepDescription={stepDescription}
                      isReadonly={isReadonly}
                      isEditMode={isEditMode}
                      searchTerm={modelSearch}
                      onSearchChange={(term) =>
                        setStepFormData({ modelSearch: term || null })
                      }
                      searchPlaceholder="Search models..."
                      filters={[
                        {
                          key: "showSelected",
                          label: "Show selected",
                          value: modelShowSelected,
                          onChange: (value: boolean) =>
                            setStepFormData({
                              modelShowSelected: value || null,
                            }),
                        },
                      ]}
                      resetFields={["modelId"]}
                      actions={
                        stepResources["model"] &&
                        stepResources["model"].length > 0 &&
                        sectionData?.models?.show_ai_generate ? (
                          <StepCardAiButton
                            stepId="model"
                            resourceTypes={stepResources["model"] ?? []}
                            canRegenerate={canRegenerateForStepCard}
                            isGenerating={isGeneratingForStepCard}
                            onOpenModal={handleOpenStepCardModal}
                            disabled={isReadonly}
                          />
                        ) : undefined
                      }
                      {...(onReset ? { onReset } : {})}
                      resetLabel="Reset"
                    >
                      <Models
                        model_id={draftState.modelId || null}
                        model_resource={
                          (aiModelResource ?? modelsSection?.resource ?? null) as any
                        }
                        show_models={modelsSection?.show ?? true}
                        model_suggestions={modelsSection?.suggestions ?? []}
                        models={mergedModels as any[]}
                        disabled={isReadonly}
                        onModelIdChange={(modelId) => {
                          setDraftState((prev) => ({
                            ...prev,
                            modelId: modelId || "",
                          }));
                        }}
                        label="Model"
                        required={modelsSection?.required ?? true}
                        id="model"
                        helpText="Select the AI model for this agent."
                        searchTerm={modelSearch}
                        onSearchChange={(term) =>
                          setStepFormData({ modelSearch: term || null })
                        }
                        showSelectedFilter={modelShowSelected}
                        onShowSelectedChange={(value) =>
                          setStepFormData({ modelShowSelected: value })
                        }
                        link_tool_id={modelsSection?.link_tool_id ?? null}
                      />
                    </StepCard>
                  );
                }

                case "temperature": {
                  const selectedModel = modelsSection?.resources?.find(
                    (m: any) => m.model_id === draftState.modelId,
                  );

                  return (
                    <StepCard
                      stepStatus={stepStatus}
                      stepNumber={stepNumber}
                      stepTitle={stepTitle}
                      stepDescription={stepDescription}
                      isReadonly={isReadonly}
                      isEditMode={isEditMode}
                      resetFields={["temperature_level_id"]}
                      {...(onReset ? { onReset } : {})}
                      resetLabel="Reset"
                      actions={
                        stepResources["temperature"] &&
                        stepResources["temperature"].length > 0 &&
                        sectionData?.temperature_levels?.show_ai_generate ? (
                          <StepCardAiButton
                            stepId="temperature"
                            resourceTypes={stepResources["temperature"] ?? []}
                            canRegenerate={canRegenerateForStepCard}
                            isGenerating={isGeneratingForStepCard}
                            onOpenModal={handleOpenStepCardModal}
                            disabled={isReadonly}
                          />
                        ) : undefined
                      }
                    >
                      <TemperatureLevels
                        temperature_level_id={draftState.temperature_level_id}
                        temperature_level_resource={
                          (aiTemperatureResource ??
                            temperatureLevelsSection?.resource ??
                            null) as any
                        }
                        show_temperature_levels={
                          temperatureLevelsSection?.show ?? true
                        }
                        temperature_level_suggestions={
                          temperatureLevelsSection?.suggestions ?? []
                        }
                        temperature_levels={mergedTemperatureLevels as any[]}
                        temperature_lower={
                          (selectedModel as any)?.temperature_lower ?? null
                        }
                        temperature_upper={
                          (selectedModel as any)?.temperature_upper ?? null
                        }
                        disabled={isReadonly}
                        onTemperatureLevelIdChange={(id) =>
                          setDraftState((prev) => ({
                            ...prev,
                            temperature_level_id: id,
                          }))
                        }
                        onGenerate={handleGenerateTemperatureLevels}
                        isGenerating={isGenerating("temperature_levels")}
                        showSlider={true}
                        group_id={sectionData?.group_id ?? null}
                        link_tool_id={
                          temperatureLevelsSection?.link_tool_id ?? null
                        }
                        showAiGenerate={
                          !!sectionData?.temperature_levels?.show_ai_generate
                        }
                      />
                    </StepCard>
                  );
                }

                case "reasoning": {
                  return (
                    <StepCard
                      stepStatus={stepStatus}
                      stepNumber={stepNumber}
                      stepTitle={stepTitle}
                      stepDescription={stepDescription}
                      isReadonly={isReadonly}
                      isEditMode={isEditMode}
                      resetFields={["reasoning_level_id"]}
                      {...(onReset ? { onReset } : {})}
                      resetLabel="Reset"
                      actions={
                        stepResources["reasoning"] &&
                        stepResources["reasoning"].length > 0 &&
                        sectionData?.reasoning_levels?.show_ai_generate ? (
                          <StepCardAiButton
                            stepId="reasoning"
                            resourceTypes={stepResources["reasoning"] ?? []}
                            canRegenerate={canRegenerateForStepCard}
                            isGenerating={isGeneratingForStepCard}
                            onOpenModal={handleOpenStepCardModal}
                            disabled={isReadonly}
                          />
                        ) : undefined
                      }
                    >
                      <ReasoningLevels
                        reasoning_level_id={draftState.reasoning_level_id}
                        reasoning_level_resource={
                          (aiReasoningResource ?? reasoningLevelsSection?.resource ?? null) as any
                        }
                        show_reasoning_levels={
                          reasoningLevelsSection?.show ?? true
                        }
                        reasoning_level_suggestions={
                          reasoningLevelsSection?.suggestions ?? []
                        }
                        reasoning_levels={mergedReasoningLevels as any[]}
                        disabled={isReadonly}
                        onReasoningLevelIdChange={(id) =>
                          setDraftState((prev) => ({
                            ...prev,
                            reasoning_level_id: id,
                          }))
                        }
                        onGenerate={handleGenerateReasoningLevels}
                        isGenerating={isGenerating("reasoning_levels")}
                        group_id={sectionData?.group_id ?? null}
                        link_tool_id={
                          reasoningLevelsSection?.link_tool_id ?? null
                        }
                        showAiGenerate={
                          !!sectionData?.reasoning_levels?.show_ai_generate
                        }
                      />
                    </StepCard>
                  );
                }

                case "voice": {
                  return (
                    <StepCard
                      stepStatus={stepStatus}
                      stepNumber={stepNumber}
                      stepTitle={stepTitle}
                      stepDescription={stepDescription}
                      isReadonly={isReadonly}
                      isEditMode={isEditMode}
                      resetFields={["voice_ids"]}
                      {...(onReset ? { onReset } : {})}
                      resetLabel="Reset"
                      actions={
                        stepResources["voice"] &&
                        stepResources["voice"].length > 0 &&
                        sectionData?.voices?.show_ai_generate ? (
                          <StepCardAiButton
                            stepId="voice"
                            resourceTypes={stepResources["voice"] ?? []}
                            canRegenerate={canRegenerateForStepCard}
                            isGenerating={isGeneratingForStepCard}
                            onOpenModal={handleOpenStepCardModal}
                            disabled={isReadonly}
                          />
                        ) : undefined
                      }
                    >
                      <Voices
                        voice_ids={draftState.voice_ids}
                        voice_resources={
                          (aiFormData.voice_resources ?? voicesSection?.current ?? []) as any[]
                        }
                        show_voices={voicesSection?.show ?? true}
                        voice_suggestions={voicesSection?.suggestions ?? []}
                        voices={mergedVoices as any[]}
                        disabled={isReadonly}
                        onVoiceIdsChange={(ids) =>
                          setDraftState((prev) => ({ ...prev, voice_ids: ids }))
                        }
                        group_id={sectionData?.group_id ?? null}
                        create_tool_id={voicesSection?.create_tool_id ?? null}
                        link_tool_id={voicesSection?.link_tool_id ?? null}
                        createVoicesAction={createVoicesAction}
                        registerFlush={registerFlushCallbacks["voices"]}
                      />
                    </StepCard>
                  );
                }

                case "prompt": {
                  const promptSearch =
                    (stepFormData["promptSearch"] as string) || "";
                  return (
                    <StepCard
                      stepStatus={stepStatus}
                      stepNumber={stepNumber}
                      stepTitle={stepTitle}
                      stepDescription={stepDescription}
                      isReadonly={isReadonly}
                      isEditMode={isEditMode}
                      resetFields={["prompt_id"]}
                      {...(onReset ? { onReset } : {})}
                      resetLabel="Reset"
                      actions={
                        stepResources["prompt"] &&
                        stepResources["prompt"].length > 0 &&
                        sectionData?.prompts?.show_ai_generate ? (
                          <StepCardAiButton
                            stepId="prompt"
                            resourceTypes={stepResources["prompt"] ?? []}
                            canRegenerate={canRegenerateForStepCard}
                            isGenerating={isGeneratingForStepCard}
                            onOpenModal={handleOpenStepCardModal}
                            disabled={isReadonly}
                          />
                        ) : undefined
                      }
                    >
                      <Prompts
                        prompt_id={draftState.prompt_id}
                        prompt_resource={
                          (aiPromptResource ?? promptsSection?.resource ?? null) as any
                        }
                        show_prompts={promptsSection?.show ?? true}
                        prompt_suggestions={promptsSection?.suggestions ?? []}
                        prompts={mergedPrompts as any[]}
                        disabled={isReadonly}
                        onPromptIdChange={(id) => {
                          setDraftState((prev) => ({ ...prev, prompt_id: id }));
                        }}
                        searchTerm={promptSearch}
                        onSearchChange={(term: string) =>
                          setStepFormData({ promptSearch: term || null })
                        }
                        group_id={sectionData?.group_id ?? null}
                        create_tool_id={promptsSection?.create_tool_id ?? null}
                        link_tool_id={promptsSection?.link_tool_id ?? null}
                        createPromptsAction={createPromptsAction}
                        registerFlush={registerFlushCallbacks["prompts"]}
                      />
                    </StepCard>
                  );
                }

                case "instructions": {
                  const instructionsSearch =
                    (stepFormData["instructionsSearch"] as string) || "";
                  return (
                    <StepCard
                      stepStatus={stepStatus}
                      stepNumber={stepNumber}
                      stepTitle={stepTitle}
                      stepDescription={stepDescription}
                      isReadonly={isReadonly}
                      isEditMode={isEditMode}
                      resetFields={["instructions_id"]}
                      {...(onReset ? { onReset } : {})}
                      resetLabel="Reset"
                      actions={
                        stepResources["instructions"] &&
                        stepResources["instructions"].length > 0 &&
                        sectionData?.instructions?.show_ai_generate ? (
                          <StepCardAiButton
                            stepId="instructions"
                            resourceTypes={stepResources["instructions"] ?? []}
                            canRegenerate={canRegenerateForStepCard}
                            isGenerating={isGeneratingForStepCard}
                            onOpenModal={handleOpenStepCardModal}
                            disabled={isReadonly}
                          />
                        ) : undefined
                      }
                    >
                      <Instructions
                        instructions_id={draftState.instructions_id}
                        instructions_resource={
                          (aiInstructionsResource ??
                            instructionsSection?.resource ??
                            null) as any
                        }
                        show_instructions={instructionsSection?.show ?? true}
                        instructions_suggestions={
                          instructionsSection?.suggestions ?? []
                        }
                        instructions={mergedInstructions as any[]}
                        disabled={isReadonly}
                        onInstructionsIdChange={(id) =>
                          setDraftState((prev) => ({
                            ...prev,
                            instructions_id: id,
                          }))
                        }
                        searchTerm={instructionsSearch}
                        onSearchChange={(term: string) =>
                          setStepFormData({ instructionsSearch: term || null })
                        }
                        group_id={sectionData?.group_id ?? null}
                        showAiGenerate={
                          !!sectionData?.instructions?.show_ai_generate
                        }
                      />
                    </StepCard>
                  );
                }
                default:
                  return null;
              }
            }}
          />
        </div>

        {/* Generate/Regenerate Modal */}
        {modalProps.mode && <GenerateRegenerateModal {...modalProps} />}
    </div>
  );
}
