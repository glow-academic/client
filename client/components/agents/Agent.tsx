/**
 * Agent.tsx
 * Used to create and edit system agents
 * @AshokSaravanan222 & @siladiea
 * 07/20/2025
 */
"use client";

import { useRouter } from "next/navigation";
import React, {
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
import { StepCard } from "@/components/common/forms/StepCard";
import type { GenerateRegenerateModalResource } from "@/components/common/GenerateRegenerateModal";
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
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useBreadcrumbContext } from "@/contexts/breadcrumb-context";
import { useProfile } from "@/contexts/profile-context";
import { useDraftAutosave } from "@/hooks/use-draft-autosave";
import type { ResourceType } from "@/lib/resources/types";
import {
  getDefaultDepartmentIds,
  transformDepartmentIdsForSubmit,
} from "@/utils/department-picker-helpers";
import { Loader2, Sparkles } from "lucide-react";
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
} from "@/app/(main)/engine/agents/a/[agentId]/page";
import type { InputOf, OutputOf } from "@/lib/api/types";

// Resource creation action types
type CreateDraftReasoningLevelsIn = InputOf<
  "/api/v4/resources/reasoning_levels",
  "post"
>;
type CreateDraftReasoningLevelsOut = OutputOf<
  "/api/v4/resources/reasoning_levels",
  "post"
>;
type CreateDraftTemperatureLevelsIn = InputOf<
  "/api/v4/resources/temperature_levels",
  "post"
>;
type CreateDraftTemperatureLevelsOut = OutputOf<
  "/api/v4/resources/temperature_levels",
  "post"
>;
type CreateDraftVoicesIn = InputOf<"/api/v4/resources/voices", "post">;
type CreateDraftVoicesOut = OutputOf<"/api/v4/resources/voices", "post">;
type CreateDraftPromptsIn = InputOf<"/api/v4/resources/prompts", "post">;
type CreateDraftPromptsOut = OutputOf<"/api/v4/resources/prompts", "post">;
type CreateDraftModelsIn = InputOf<"/api/v4/resources/models", "post">;
type CreateDraftModelsOut = OutputOf<"/api/v4/resources/models", "post">;

export interface AgentProps {
  agentId?: string;
  // Optional server-provided data and actions (for server-side rendering)
  agentDetail?: GetAgentOut; // For edit mode (agent_id provided)
  agentDetailDefault?: GetAgentOut; // For new mode (agent_id = null)
  saveAgentAction?: (input: SaveAgentIn) => Promise<SaveAgentOut>;
  // Draft action: Resource-specific prop name is acceptable since types are resource-specific
  // See Z-DOCS.md "Draft Autosave Pattern" section for migration guide
  patchAgentDraftAction?: (
    input: PatchAgentDraftIn
  ) => Promise<PatchAgentDraftOut>;
  // Resource creation actions
  createReasoningLevelsAction?: (
    input: CreateDraftReasoningLevelsIn
  ) => Promise<CreateDraftReasoningLevelsOut>;
  createTemperatureLevelsAction?: (
    input: CreateDraftTemperatureLevelsIn
  ) => Promise<CreateDraftTemperatureLevelsOut>;
  createVoicesAction?: (
    input: CreateDraftVoicesIn
  ) => Promise<CreateDraftVoicesOut>;
  createPromptsAction?: (
    input: CreateDraftPromptsIn
  ) => Promise<CreateDraftPromptsOut>;
  createModelsAction?: (
    input: CreateDraftModelsIn
  ) => Promise<CreateDraftModelsOut>;
}

export default function Agent({
  agentId,
  agentDetail: serverAgentDetail,
  agentDetailDefault: serverAgentDetailDefault,
  saveAgentAction,
  patchAgentDraftAction,
  createReasoningLevelsAction,
  createTemperatureLevelsAction,
  createVoicesAction,
  createPromptsAction,
  createModelsAction: _createModelsAction,
}: AgentProps) {
  const router = useRouter();
  const isEditMode = !!agentId;
  const {
    profile,
    selectedDraftId,
    setSelectedDraftId,
    socket,
    isConnected,
  } = useProfile();
  const { setEntityMetadata, clearEntityMetadata } = useBreadcrumbContext();
  const isSuperadmin = profile?.role === "superadmin";

  // Generation state for AI workflows
  const [generatingResources, setGeneratingResources] = useState<
    Set<ResourceType>
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
    (resourceType: ResourceType) => generatingResources.has(resourceType),
    [generatingResources]
  );

  // Stabilize server props to prevent unnecessary re-renders from object reference changes
  const stabilizeServerProp = React.useCallback(
    (
      data: typeof serverAgentDetail | typeof serverAgentDetailDefault
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
            data["valid_department_ids"]
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
    []
  );

  const agentDetailId = React.useMemo(
    () => stabilizeServerProp(serverAgentDetail),
    [serverAgentDetail, stabilizeServerProp]
  );
  const agentDetailDefaultId = React.useMemo(
    () => stabilizeServerProp(serverAgentDetailDefault),
    [serverAgentDetailDefault, stabilizeServerProp]
  );

  // Use refs to track latest server props (for effect access) and stable props (for render)
  const latestServerAgentDetailRef = React.useRef(serverAgentDetail);
  const latestServerAgentDetailDefaultRef = React.useRef(
    serverAgentDetailDefault
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

  // Use edit detail when editing, default detail when creating
  const agentData = isEditMode ? agentDetail : agentDetailDefault;

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
  const [urlParams, setUrlParams] = useQueryStates(agentSearchParamsClient, {
    history: "replace",
    shallow: true, // Use shallow routing to prevent server component re-renders
  });

  // Store nuqs setter in ref for use in callbacks (like Persona pattern)
  const setUrlParamsRef = React.useRef(setUrlParams);
  React.useEffect(() => {
    setUrlParamsRef.current = setUrlParams;
  }, [setUrlParams]);

  // Get draftId from URL (managed by nuqs via urlParams)
  const urlDraftId = urlParams.draftId || null;

  // Sync URL draftId to profile context
  useEffect(() => {
    if (urlDraftId !== selectedDraftId) {
      setSelectedDraftId(urlDraftId);
    }
  }, [urlDraftId, selectedDraftId, setSelectedDraftId]);

  const draftId = urlDraftId;

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
        profile?.primary_department_id ?? null
      ),
    [isSuperadmin, profile?.primary_department_id]
  );

  // Initialize draft state from server data or draft payload
  // Extract resource IDs from server data (canonical pattern - matches Persona.tsx)
  const initialDraftState = useMemo((): DraftState => {
    const data = isEditMode ? agentDetail : agentDetailDefault;
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

    // Extract resource IDs only, not display text or resource objects
    return {
      name_id: data.name_id ?? null,
      description_id: data.description_id ?? null,
      prompt_id: data.prompt_id ?? null,
      modelId: data.model_id ?? "",
      active_flag_id: data.active_flag_id ?? null,
      tool_ids: data.tool_ids ?? [],
      departmentIds: data.department_ids ?? [],
      temperature_level_id: data.temperature_level_id ?? null,
      reasoning_level_id: data.reasoning_level_id ?? null,
      voice_ids: data.voice_ids ?? [],
      instructions_id: data.instructions_id ?? null,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isEditMode,
    agentDetail,
    agentDetailDefault,
    agentDetailId,
    agentDetailDefaultId,
    draftId,
    urlDraftId,
    defaultDepartmentIds,
    // Include resource ID fields so it recomputes when server data changes
    agentDetailDefault?.name_id,
    agentDetailDefault?.description_id,
    agentDetailDefault?.model_id,
    agentDetailDefault?.tool_ids,
    agentDetailDefault?.department_ids,
    agentDetailDefault?.instructions_id,
    agentDetail?.name_id,
    agentDetail?.description_id,
    agentDetail?.model_id,
    agentDetail?.tool_ids,
    agentDetail?.department_ids,
    agentDetail?.temperature_level_id,
    agentDetail?.reasoning_level_id,
    agentDetail?.voice_ids,
    agentDetail?.instructions_id,
  ]);

  const [draftState, setDraftState] = useState<DraftState>(initialDraftState);
  // Sync draft_version from server to avoid unintended draft forks.
  const draftVersion =
    agentData && "draft_version" in agentData
      ? (agentData as { draft_version?: number | null }).draft_version
      : null;

  // Track previous initialDraftState content to avoid unnecessary updates
  const prevInitialDraftStateRef = useRef<string>(
    JSON.stringify(initialDraftState)
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
    }
  }, [initialDraftState]);

  // Integrate autosave hook
  // Pattern: Transform hook API to backend API
  const {
    saveStatus: _saveStatus,
    saveNow: _saveNow,
    lastSavedVersion: _lastSavedVersion,
  } = useDraftAutosave({
    draftId,
    draftState,
    initialVersion: typeof draftVersion === "number" ? draftVersion : 0,
    patchDraftAction: patchAgentDraftAction
      ? async (input) => {
          // Transform hook API → backend API
          const result = await patchAgentDraftAction({
            body: {
              input_draft_id: input.body.draft_id || null,
              patch: input.body.patch as Record<string, unknown>,
              expected_version: input.body.expected_version,
            } as PatchAgentDraftIn["body"],
          });
          // Transform backend API → hook API
          return {
            draftId: result.draft_id || "",
            newVersion: result.new_version || 0,
            draftExists: result.draft_exists || false,
          };
        }
      : async () => {
          // Throw error instead of fake success (prevents silent failures)
          throw new Error("patchAgentDraftAction is required for autosave");
        },
    debounceMs: 1000,
    onDraftCreated: useCallback(
      (newDraftId: string) => {
        // Use nuqs setter via ref (canonical pattern - matches Persona.tsx)
        if (urlParams.draftId === newDraftId) return;
        setUrlParamsRef.current({ draftId: newDraftId });
      },
      [urlParams.draftId]
    ),
  });

  // Extract body types from server action types for type safety
  type SaveAgentBody = SaveAgentIn extends { body: infer B } ? B : never;
  // Prompts delete removed - DeleteAgentPromptBody no longer needed

  // Use server actions directly (no mutations needed)
  const handleSaveAgent = useCallback(
    async (body: SaveAgentBody) => {
      if (!saveAgentAction) {
        throw new Error("saveAgentAction is required");
      }
      await saveAgentAction({ body });
    },
    [saveAgentAction]
  );

  // Get selected model capabilities
  const selectedModelCapabilities = useMemo(() => {
    if (!draftState.modelId) {
      return null;
    }

    const selectedModel = agentData?.models?.find(
      (m) => m.model_id === draftState.modelId
    );
    if (!selectedModel) {
      return null;
    }

    const inputMods = selectedModel.input_modalities ?? [];
    const outputMods = selectedModel.output_modalities ?? [];

    return {
      input_modalities: inputMods,
      output_modalities: outputMods,
      has_text_output: outputMods.includes("text"),
      has_audio_input: inputMods.includes("audio"),
      has_audio_output: outputMods.includes("audio"),
      has_image_output: outputMods.includes("image"),
      has_video_output: outputMods.includes("video"),
    };
  }, [draftState.modelId, agentData?.models]);

  // Set breadcrumb context when agent data is loaded
  useEffect(() => {
    const agentName = agentData?.name_resource?.name;
    if (agentName && agentId && isEditMode) {
      setEntityMetadata({
        entityId: agentId,
        entityName: agentName,
        entityType: "agent",
      });
    }
    return () => clearEntityMetadata();
  }, [
    agentData?.name_resource?.name,
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
      _isEditMode: boolean
    ): Partial<Values<Record<string, Parser<unknown>>>> => {
      // GenericForm expects URL params, but we use draftState for form fields
      // So we return empty object - form fields are initialized via draftState
      return {};
    },
    []
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
    []
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
    [steps, initialDraftState, draftState, resetters]
  );

  // Handle form submission (for GenericForm)
  const handleSubmit = useCallback(
    async (_formData: Values<Record<string, Parser<unknown>>>) => {
      // Form data from GenericForm is URL params (search/filter)
      // Actual form fields are in draftState

      // Validation - check resource IDs
      if (!draftState.name_id) {
        throw new Error("Agent name is required");
      }

      if (!draftState.description_id) {
        throw new Error("Agent description is required");
      }

      if (!draftState.prompt_id) {
        throw new Error("Prompt selection is required");
      }

      if (!draftState.modelId || draftState.modelId.trim().length === 0) {
        throw new Error("Model selection is required");
      }

      try {
        const validDepartmentIds = agentData?.valid_department_ids || [];
        const finalDepartmentIds = transformDepartmentIdsForSubmit(
          draftState.departmentIds || [],
          isSuperadmin,
          validDepartmentIds
        );

        // Save agent using unified v4 API (handles both create and update)
        // Ensure profileId exists - required for API calls
        if (!profile?.id) {
          toast.error("Profile not loaded. Please refresh the page.");
          throw new Error("Profile not loaded");
        }

        // Note: profileId is added by the server action
        // Use input_agent_id = null for create, agent_id for update
        const nameText = agentData?.name_resource?.name || "New Agent";
        const descriptionText =
          agentData?.description_resource?.description || null;

        await handleSaveAgent({
          input_agent_id: isEditMode ? agentId : null,
          name: nameText,
          description: descriptionText,
          model_id: draftState.modelId!.trim(),
          prompt_id: draftState.prompt_id || null,
          system_prompt: null, // Prompts component handles system_prompt via prompt_id
          instructions_id: draftState.instructions_id || null,
          active_flag_id: draftState.active_flag_id || null,
          department_ids: finalDepartmentIds,
          artifact_name: "assistant", // Default artifact name (tools replace role)
          temperature_level_id: draftState.temperature_level_id || null,
          reasoning_level_id: draftState.reasoning_level_id || null,
          voice_ids:
            draftState.voice_ids && draftState.voice_ids.length > 0
              ? draftState.voice_ids
              : [],
          tool_ids:
            draftState.tool_ids && draftState.tool_ids.length > 0
              ? draftState.tool_ids
              : [],
        });
        toast.success(
          `Agent ${isEditMode ? "updated" : "created"} successfully!`
        );
        resetFormAndState();
        router.push("/engine/agents");
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        toast.error(
          `Failed to ${isEditMode ? "update" : "create"} agent: ${msg}`
        );
        throw error; // Re-throw for GenericForm to handle
      }
    },
    [
      draftState,
      isEditMode,
      agentId,
      agentData,
      isSuperadmin,
      profile,
      handleSaveAgent,
      resetFormAndState,
      router,
    ]
  );

  // Extract disabled state from can_edit flag (check in both new and edit modes)
  const disabled = useMemo(() => {
    if (!agentData) return false;
    // can_edit exists on unified GetAgentOut response
    if ("can_edit" in agentData) {
      return !agentData.can_edit;
    }
    return false;
  }, [agentData]);

  const isReadonly = disabled; // Alias for backward compatibility

  // Step status calculation for GenericForm
  // Check resource IDs instead of display values (canonical pattern - matches Persona.tsx)
  const getStepStatus = useCallback(
    (
      stepId: string,
      _formData: Values<Record<string, Parser<unknown>>>
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
    [draftState]
  );

  // Helper to check if a resource type can be regenerated
  const canRegenerate = useCallback(
    (resourceType: ResourceType): boolean => {
      if (!agentData) return false;
      switch (resourceType) {
        case "names":
          return agentData.name_resource?.generated ?? false;
        case "descriptions":
          return agentData.description_resource?.generated ?? false;
        case "models":
          return (
            agentData.models?.some(
              (m) => (m as { generated?: boolean }).generated
            ) ?? false
          );
        case "prompts":
          return agentData.prompts?.some((p) => p.generated) ?? false;
        case "instructions":
          return agentData.instructions_resource?.generated ?? false;
        case "flags":
          return agentData.flag_resource?.generated ?? false;
        case "departments":
          return agentData.departments?.some((d) => d.generated) ?? false;
        case "reasoning_levels":
          return agentData.reasoning_level_resource?.generated ?? false;
        case "temperature_levels":
          return agentData.temperature_level_resource?.generated ?? false;
        case "voices":
          return agentData.voice_resources?.some((v) => v.generated) ?? false;
        case "tools":
          return agentData.tool_resources?.some((t) => t.generated) ?? false;
        default:
          return false;
      }
    },
    [agentData]
  );

  // Helper function to determine agent_type from resource types
  const determineAgentType = useCallback(
    (resourceTypes: ResourceType[]): string | null => {
      if (resourceTypes.length === 1) {
        const agentTypeMap: Partial<Record<ResourceType, string>> = {
          names: "name",
          descriptions: "description",
          models: "models",
          prompts: "prompts",
          instructions: "instructions",
          flags: "flags",
          departments: "departments",
          reasoning_levels: "reasoning_levels",
          temperature_levels: "temperature_levels",
          voices: "voices",
          tools: "tools",
        };
        const firstType = resourceTypes[0];
        if (firstType && firstType in agentTypeMap && agentTypeMap[firstType]) {
          return agentTypeMap[firstType]!;
        }
      }
      // For multiple resources, use "general" or find first available agent
      return "general";
    },
    []
  );

  // Multi-generation handler - accepts list of resource types and optional user instructions
  const handleGenerateResources = useCallback(
    async (
      resourceTypes: ResourceType[],
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

      // Emit agent_generate event
      socket.emit("agent_generate", {
        resource_types: resourceTypes,
        agent_type: agentType,
        user_instructions: userInstructions ? [userInstructions] : null,
        agent_id: agentId || null,
        draft_id: draftId || null,
        mcp: false,
      });
    },
    [socket, isConnected, agentId, draftId]
  );

  // Individual generation handlers
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

  const handleGenerateReasoningLevels = useCallback(
    async () =>
      handleGenerateResources(
        ["reasoning_levels"],
        determineAgentType(["reasoning_levels"])
      ),
    [handleGenerateResources, determineAgentType]
  );

  const handleGenerateTemperatureLevels = useCallback(
    async () =>
      handleGenerateResources(
        ["temperature_levels"],
        determineAgentType(["temperature_levels"])
      ),
    [handleGenerateResources, determineAgentType]
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
    []
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
    []
  );

  // Handler to open modal for step card generation
  const handleOpenStepCardModal = useCallback(
    (stepId: string, mode: "generate" | "regenerate") => {
      const resourceTypes = stepResources[stepId] || [];
      const resources: GenerateRegenerateModalResource[] = resourceTypes.map(
        (rt) => ({
          id: rt,
          label: resourceLabels[rt] || rt,
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

  // Listen for full-page-generate event from layout
  useEffect(() => {
    const handleFullPageGenerate = (
      event: CustomEvent<{ agentId?: string }>
    ) => {
      const eventAgentId = event.detail?.agentId;
      if (eventAgentId) {
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

  // WebSocket handlers for AI generation
  // Use refs to minimize dependencies and prevent stale closures (canonical pattern)
  const agentDataRef = React.useRef(agentData);
  React.useEffect(() => {
    agentDataRef.current = agentData;
  }, [agentData]);

  const groupIdRef = React.useRef(agentData?.group_id ?? null);
  React.useEffect(() => {
    groupIdRef.current = agentData?.group_id ?? null;
  }, [agentData?.group_id]);

  const draftStateRef = React.useRef(draftState);
  React.useEffect(() => {
    draftStateRef.current = draftState;
  }, [draftState]);

  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleGenerationComplete = (data: {
      artifact_type?: string;
      group_id?: string;
      resource_type?: string;
      name_id?: string | null;
      description_id?: string | null;
      model_id?: string | null;
      prompt_id?: string | null;
      instructions_id?: string | null;
      active_flag_id?: string | null;
      department_ids?: string[];
      tool_ids?: string[];
      message?: string;
      success?: boolean;
      [key: string]: unknown;
    }) => {
      const currentGroupId = groupIdRef.current;
      if (
        data.artifact_type !== "agent" ||
        !data.group_id ||
        data.group_id !== currentGroupId
      ) {
        return;
      }

      const validResourceTypes: ResourceType[] = [
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
        "tools", // Add tools to valid resource types
      ];
      if (
        data.resource_type &&
        validResourceTypes.includes(data.resource_type as ResourceType)
      ) {
        // Update draftState with generated resource IDs directly (canonical pattern)
        // Don't lookup text from arrays - IDs are source of truth
        setDraftState((prev) => {
          const updates: Partial<DraftState> = {};
          if (data.name_id) {
            updates.name_id = data.name_id;
          }
          if (data.description_id) {
            updates.description_id = data.description_id;
          }
          if (data.model_id) updates.modelId = data.model_id;
          if (data.prompt_id) updates.prompt_id = data.prompt_id;
          if (data["reasoning_level_id"]) {
            const reasoningLevelId = data["reasoning_level_id"];
            if (typeof reasoningLevelId === "string") {
              updates.reasoning_level_id = reasoningLevelId;
            }
          }
          if (data["temperature_level_id"]) {
            const temperatureLevelId = data["temperature_level_id"];
            if (typeof temperatureLevelId === "string") {
              updates.temperature_level_id = temperatureLevelId;
            }
          }
          if (data["voice_ids"]) {
            const voiceIds = data["voice_ids"];
            if (Array.isArray(voiceIds) && voiceIds.length > 0) {
              updates.voice_ids = [
                ...new Set([
                  ...prev.voice_ids,
                  ...voiceIds.filter(
                    (id): id is string => typeof id === "string"
                  ),
                ]),
              ];
            }
          }
          if (data.active_flag_id) {
            updates.active_flag_id = data.active_flag_id;
          }
          if (data.department_ids && data.department_ids.length > 0) {
            updates.departmentIds = [
              ...new Set([...prev.departmentIds, ...data.department_ids]),
            ];
          }
          if (data.instructions_id) {
            updates.instructions_id = data.instructions_id;
          }
          if (
            data.tool_ids &&
            Array.isArray(data.tool_ids) &&
            data.tool_ids.length > 0
          ) {
            updates.tool_ids = [
              ...new Set([
                ...prev.tool_ids,
                ...data.tool_ids.filter(
                  (id): id is string => typeof id === "string"
                ),
              ]),
            ];
          }
          return { ...prev, ...updates };
        });

        setGeneratingResources((prev) => {
          const next = new Set(prev);
          next.delete(data.resource_type as ResourceType);
          return next;
        });
        if (data.success) {
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
      const currentGroupId = groupIdRef.current;
      if (
        data.artifact_type !== "agent" ||
        !data.group_id ||
        data.group_id !== currentGroupId
      ) {
        return;
      }
      // Handle progress updates if needed
    };

    const handleGenerationError = (data: {
      artifact_type?: string;
      group_id?: string;
      message?: string;
      resource_type?: string;
      resource_types?: string[];
    }) => {
      const currentGroupId = groupIdRef.current;
      if (
        data.artifact_type !== "agent" ||
        !data.group_id ||
        data.group_id !== currentGroupId
      ) {
        return;
      }

      const validResourceTypes: ResourceType[] = [
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
        "tools", // Add tools to valid resource types
      ];
      const resourceTypes =
        data.resource_types || (data.resource_type ? [data.resource_type] : []);
      setGeneratingResources((prev) => {
        const next = new Set(prev);
        resourceTypes.forEach((rt) => {
          if (validResourceTypes.includes(rt as ResourceType)) {
            next.delete(rt as ResourceType);
          }
        });
        return next;
      });
      toast.error(data.message || "Generation failed");
    };

    socket.on("agent_generation_progress", handleGenerationProgress);
    socket.on("agent_generation_complete", handleGenerationComplete);
    socket.on("agent_generation_error", handleGenerationError);

    return () => {
      socket.off("agent_generation_progress", handleGenerationProgress);
      socket.off("agent_generation_complete", handleGenerationComplete);
      socket.off("agent_generation_error", handleGenerationError);
    };
  }, [socket, isConnected]); // Minimal dependencies - use refs inside handlers

  // Handler for modal generate/regenerate action
  const handleModalGenerate = useCallback(
    async (selectedResources: string[], instructions: string) => {
      const resourceTypes = selectedResources as ResourceType[];
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

  return (
    <TooltipProvider>
      <div className="space-y-6 py-4 px-4">
        <ReadOnlyBanner
          disabled={disabled}
          disabledReason={agentData?.disabled_reason ?? null}
          entityType="agent"
        />
        <div className="w-full">
          <GenericForm
            nuqsParsers={
              agentSearchParamsClient as Record<string, Parser<unknown>>
            }
            steps={steps}
            getStepStatus={getStepStatus}
            serverData={agentData}
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
              backUrl: "/engine/agents",
              backLabel: "Back",
              createLabel: "Create Agent",
              updateLabel: "Update Agent",
            }}
            isReadonly={isReadonly}
            isEditMode={isEditMode}
            registerSetFormData={(setter) => {
              setUrlParamsRef.current = setter as typeof setUrlParams;
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
                          name_id={agentData?.name_id ?? null}
                          name_resource={agentData?.name_resource ?? null}
                          show_name={agentData?.show_name ?? true}
                          name_suggestions={agentData?.name_suggestions ?? []}
                          names={agentData?.names ?? []}
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
                          required={agentData?.name_required ?? false}
                          hideDescription={true}
                          group_id={agentData?.group_id ?? null}
                          agent_id={agentData?.name_agent_id ?? null}
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
                        (agentData?.name_agent_id ||
                          agentData?.description_agent_id ||
                          agentData?.departments_agent_id ||
                          agentData?.flag_agent_id) ? (
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
                                      hasRegeneratable
                                        ? "regenerate"
                                        : "generate"
                                    );
                                  }}
                                  disabled={
                                    isReadonly ||
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
                                {stepResources["basic"]!.some((rt) =>
                                  canRegenerate(rt)
                                )
                                  ? "Regenerate"
                                  : "Generate"}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ) : undefined
                      }
                      {...(onReset ? { onReset } : {})}
                      resetLabel="Reset"
                    >
                      <div className="space-y-4">
                        {/* Description field - using Descriptions resource component */}
                        <Descriptions
                          description_id={agentData?.description_id ?? null}
                          description_resource={
                            agentData?.description_resource ?? null
                          }
                          show_description={agentData?.show_description ?? true}
                          description_suggestions={
                            agentData?.description_suggestions ?? []
                          }
                          descriptions={agentData?.descriptions ?? []}
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
                          required={agentData?.description_required ?? false}
                          rows={4}
                          data-testid="input-agent-description"
                          group_id={agentData?.group_id ?? null}
                          agent_id={agentData?.description_agent_id ?? null}
                        />

                        {/* Department Selection */}
                        <Departments
                          department_ids={draftState.departmentIds || []}
                          department_resources={
                            agentData?.department_resources ?? []
                          }
                          show_departments={
                            agentData?.show_departments ?? false
                          }
                          department_suggestions={
                            agentData?.department_suggestions ?? []
                          }
                          departments={agentData?.departments ?? []}
                          disabled={isReadonly}
                          onChange={(ids) => {
                            setDraftState((prev) => ({
                              ...prev,
                              departmentIds: ids,
                            }));
                          }}
                          onGenerate={handleGenerateDepartments}
                          isGenerating={isGenerating("departments")}
                          required={agentData?.departments_required ?? false}
                          group_id={agentData?.group_id ?? null}
                          agent_id={agentData?.departments_agent_id ?? null}
                        />

                        <Flags
                          flag_id={draftState.active_flag_id}
                          flag_resource={agentData?.flag_resource ?? null}
                          show_flag={agentData?.show_flag ?? false}
                          disabled={isReadonly}
                          onFlagIdChange={(flagId) => {
                            setDraftState((prev) => ({
                              ...prev,
                              active_flag_id: flagId,
                            }));
                          }}
                          onGenerate={handleGenerateFlags}
                          isGenerating={isGenerating("flags")}
                          label="Active"
                          helpText="Inactive agents will not be available to perform operations for departments"
                          required={agentData?.flag_required ?? false}
                          group_id={agentData?.group_id ?? null}
                          agent_id={agentData?.flag_agent_id ?? null}
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
                        agentData?.tools_agent_id ? (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    const hasRegeneratable = stepResources[
                                      "tools"
                                    ]!.some((rt) => canRegenerate(rt));
                                    handleOpenStepCardModal(
                                      "tools",
                                      hasRegeneratable
                                        ? "regenerate"
                                        : "generate"
                                    );
                                  }}
                                  disabled={
                                    isReadonly ||
                                    stepResources["tools"]!.some((rt) =>
                                      isGenerating(rt)
                                    )
                                  }
                                >
                                  {stepResources["tools"]!.some((rt) =>
                                    isGenerating(rt)
                                  ) ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Sparkles className="h-4 w-4" />
                                  )}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                {stepResources["tools"]!.some((rt) =>
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
                      <Tools
                        tool_ids={draftState.tool_ids}
                        tool_resources={agentData?.tool_resources ?? []}
                        show_tools={agentData?.show_tools ?? false}
                        tool_suggestions={agentData?.tool_suggestions ?? []}
                        tools={agentData?.tools ?? []}
                        disabled={isReadonly}
                        onChange={(ids) =>
                          setDraftState((prev) => ({ ...prev, tool_ids: ids }))
                        }
                        label="Tools"
                        description="Select the tools this agent can use. Tools define what operations the agent can perform."
                        required={agentData?.tools_required ?? false}
                        group_id={agentData?.group_id ?? null}
                        agent_id={agentData?.tools_agent_id ?? null}
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
                        agentData?.models_agent_id ? (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    const hasRegeneratable = stepResources[
                                      "model"
                                    ]!.some((rt) => canRegenerate(rt));
                                    handleOpenStepCardModal(
                                      "model",
                                      hasRegeneratable
                                        ? "regenerate"
                                        : "generate"
                                    );
                                  }}
                                  disabled={
                                    isReadonly ||
                                    stepResources["model"]!.some((rt) =>
                                      isGenerating(rt)
                                    )
                                  }
                                >
                                  {stepResources["model"]!.some((rt) =>
                                    isGenerating(rt)
                                  ) ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Sparkles className="h-4 w-4" />
                                  )}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                {stepResources["model"]!.some((rt) =>
                                  canRegenerate(rt)
                                )
                                  ? "Regenerate"
                                  : "Generate"}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ) : undefined
                      }
                      {...(onReset ? { onReset } : {})}
                      resetLabel="Reset"
                    >
                      <Models
                        model_id={draftState.modelId || null}
                        model_resource={agentData?.model_resource ?? null}
                        show_models={agentData?.show_models ?? true}
                        model_suggestions={agentData?.model_suggestions ?? []}
                        models={agentData?.models ?? []}
                        disabled={isReadonly}
                        onModelIdChange={(modelId) => {
                          setDraftState((prev) => ({
                            ...prev,
                            modelId: modelId || "",
                          }));
                        }}
                        label="Model"
                        required={agentData?.models_required ?? true}
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
                        group_id={agentData?.group_id ?? null}
                        agent_id={agentData?.models_agent_id ?? null}
                      />
                    </StepCard>
                  );
                }

                case "temperature": {
                  const selectedModel = agentData?.models?.find(
                    (m) => m.model_id === draftState.modelId
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
                        agentData?.temperature_levels_agent_id ? (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    const hasRegeneratable = stepResources[
                                      "temperature"
                                    ]!.some((rt) => canRegenerate(rt));
                                    handleOpenStepCardModal(
                                      "temperature",
                                      hasRegeneratable
                                        ? "regenerate"
                                        : "generate"
                                    );
                                  }}
                                  disabled={
                                    isReadonly ||
                                    stepResources["temperature"]!.some((rt) =>
                                      isGenerating(rt)
                                    )
                                  }
                                >
                                  {stepResources["temperature"]!.some((rt) =>
                                    isGenerating(rt)
                                  ) ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Sparkles className="h-4 w-4" />
                                  )}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                {stepResources["temperature"]!.some((rt) =>
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
                      <TemperatureLevels
                        temperature_level_id={draftState.temperature_level_id}
                        temperature_level_resource={
                          agentData?.temperature_level_resource ?? null
                        }
                        show_temperature_levels={
                          agentData?.show_temperature_levels ?? true
                        }
                        temperature_level_suggestions={
                          agentData?.temperature_level_suggestions ?? []
                        }
                        temperature_levels={agentData?.temperature_levels ?? []}
                        temperature_lower={
                          selectedModel?.temperature_lower ?? null
                        }
                        temperature_upper={
                          selectedModel?.temperature_upper ?? null
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
                        group_id={agentData?.group_id ?? null}
                        agent_id={
                          agentData?.temperature_levels_agent_id ?? null
                        }
                        createTemperatureLevelsAction={
                          createTemperatureLevelsAction
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
                        agentData?.reasoning_levels_agent_id ? (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    const hasRegeneratable = stepResources[
                                      "reasoning"
                                    ]!.some((rt) => canRegenerate(rt));
                                    handleOpenStepCardModal(
                                      "reasoning",
                                      hasRegeneratable
                                        ? "regenerate"
                                        : "generate"
                                    );
                                  }}
                                  disabled={
                                    isReadonly ||
                                    stepResources["reasoning"]!.some((rt) =>
                                      isGenerating(rt)
                                    )
                                  }
                                >
                                  {stepResources["reasoning"]!.some((rt) =>
                                    isGenerating(rt)
                                  ) ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Sparkles className="h-4 w-4" />
                                  )}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                {stepResources["reasoning"]!.some((rt) =>
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
                      <ReasoningLevels
                        reasoning_level_id={draftState.reasoning_level_id}
                        reasoning_level_resource={
                          agentData?.reasoning_level_resource ?? null
                        }
                        show_reasoning_levels={
                          agentData?.show_reasoning_levels ?? true
                        }
                        reasoning_level_suggestions={
                          agentData?.reasoning_level_suggestions ?? []
                        }
                        reasoning_levels={agentData?.reasoning_levels ?? []}
                        disabled={isReadonly}
                        onReasoningLevelIdChange={(id) =>
                          setDraftState((prev) => ({
                            ...prev,
                            reasoning_level_id: id,
                          }))
                        }
                        onGenerate={handleGenerateReasoningLevels}
                        isGenerating={isGenerating("reasoning_levels")}
                        group_id={agentData?.group_id ?? null}
                        agent_id={agentData?.reasoning_levels_agent_id ?? null}
                        createReasoningLevelsAction={
                          createReasoningLevelsAction
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
                        agentData?.voices_agent_id ? (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    const hasRegeneratable = stepResources[
                                      "voice"
                                    ]!.some((rt) => canRegenerate(rt));
                                    handleOpenStepCardModal(
                                      "voice",
                                      hasRegeneratable
                                        ? "regenerate"
                                        : "generate"
                                    );
                                  }}
                                  disabled={
                                    isReadonly ||
                                    stepResources["voice"]!.some((rt) =>
                                      isGenerating(rt)
                                    )
                                  }
                                >
                                  {stepResources["voice"]!.some((rt) =>
                                    isGenerating(rt)
                                  ) ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Sparkles className="h-4 w-4" />
                                  )}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                {stepResources["voice"]!.some((rt) =>
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
                      <Voices
                        voice_ids={draftState.voice_ids}
                        voice_resources={agentData?.voice_resources ?? []}
                        show_voices={agentData?.show_voices ?? true}
                        voice_suggestions={agentData?.voice_suggestions ?? []}
                        voices={agentData?.voices ?? []}
                        disabled={isReadonly}
                        onVoiceIdsChange={(ids) =>
                          setDraftState((prev) => ({ ...prev, voice_ids: ids }))
                        }
                        group_id={agentData?.group_id ?? null}
                        agent_id={agentData?.voices_agent_id ?? null}
                        createVoicesAction={createVoicesAction}
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
                        agentData?.prompts_agent_id ? (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    const hasRegeneratable = stepResources[
                                      "prompt"
                                    ]!.some((rt) => canRegenerate(rt));
                                    handleOpenStepCardModal(
                                      "prompt",
                                      hasRegeneratable
                                        ? "regenerate"
                                        : "generate"
                                    );
                                  }}
                                  disabled={
                                    isReadonly ||
                                    stepResources["prompt"]!.some((rt) =>
                                      isGenerating(rt)
                                    )
                                  }
                                >
                                  {stepResources["prompt"]!.some((rt) =>
                                    isGenerating(rt)
                                  ) ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Sparkles className="h-4 w-4" />
                                  )}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                {stepResources["prompt"]!.some((rt) =>
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
                      <Prompts
                        prompt_id={draftState.prompt_id}
                        prompt_resource={agentData?.prompt_resource ?? null}
                        show_prompts={agentData?.show_prompts ?? true}
                        prompt_suggestions={agentData?.prompt_suggestions ?? []}
                        prompts={agentData?.prompts ?? []}
                        disabled={isReadonly}
                        onPromptIdChange={(id) => {
                          setDraftState((prev) => ({ ...prev, prompt_id: id }));
                        }}
                        searchTerm={promptSearch}
                        onSearchChange={(term: string) =>
                          setStepFormData({ promptSearch: term || null })
                        }
                        group_id={agentData?.group_id ?? null}
                        agent_id={agentData?.prompts_agent_id ?? null}
                        createPromptsAction={createPromptsAction}
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
                        agentData?.instructions_agent_id ? (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    const hasRegeneratable = stepResources[
                                      "instructions"
                                    ]!.some((rt) => canRegenerate(rt));
                                    handleOpenStepCardModal(
                                      "instructions",
                                      hasRegeneratable
                                        ? "regenerate"
                                        : "generate"
                                    );
                                  }}
                                  disabled={
                                    disabled || isGenerating("instructions")
                                  }
                                >
                                  {isGenerating("instructions") ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Sparkles className="h-4 w-4" />
                                  )}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Generate Instructions</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ) : undefined
                      }
                    >
                      <Instructions
                        instructions_id={draftState.instructions_id}
                        instructions_resource={
                          agentData?.instructions_resource ?? null
                        }
                        show_instructions={agentData?.show_instructions ?? true}
                        instructions_suggestions={
                          agentData?.instructions_suggestions ?? []
                        }
                        instructions={agentData?.instructions ?? []}
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
                        group_id={agentData?.group_id ?? null}
                        agent_id={agentData?.instructions_agent_id ?? null}
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
              isGenerating(r.id as ResourceType)
            )}
            mode={modalMode}
          />
        )}
      </div>
    </TooltipProvider>
  );
}
