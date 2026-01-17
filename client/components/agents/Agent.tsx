/**
 * Agent.tsx
 * Used to create and edit system agents
 * @AshokSaravanan222 & @siladiea
 * 07/20/2025
 */
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";

import UnifiedPromptEditor from "@/components/common/editor/UnifiedPromptEditor";
import { AGENT_ROLES } from "@/components/common/forms/AgentRolePicker";
import {
  GenericForm,
  type StepStatus,
} from "@/components/common/forms/GenericForm";
import {
  PromptInfo,
  PromptPicker,
} from "@/components/common/forms/PromptPicker";
import { SelectableGrid } from "@/components/common/forms/SelectableGrid";
import { StepCard } from "@/components/common/forms/StepCard";
import type { GenerateRegenerateModalResource } from "@/components/common/GenerateRegenerateModal";
import { GenerateRegenerateModal } from "@/components/common/GenerateRegenerateModal";
import { ReadOnlyBanner } from "@/components/common/ReadOnlyBanner";
import { Departments } from "@/components/resources/Departments";
import { Descriptions } from "@/components/resources/Descriptions";
import { Flags } from "@/components/resources/Flags";
import { Names } from "@/components/resources/Names";
import { ReasoningLevels } from "@/components/resources/ReasoningLevels";
import { TemperatureLevels } from "@/components/resources/TemperatureLevels";
import { Voices } from "@/components/resources/Voices";
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
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useBreadcrumbContext } from "@/contexts/breadcrumb-context";
import { useGenerationContext } from "@/contexts/generation-context";
import { useProfile } from "@/contexts/profile-context";
import { useDraftAutosave } from "@/hooks/use-draft-autosave";
import type { ResourceType } from "@/lib/resources/types";
import { cn } from "@/lib/utils";
import {
  getDefaultDepartmentIds,
  transformDepartmentIdsForSubmit,
} from "@/utils/department-picker-helpers";
import {
  Bug,
  Check,
  Eye,
  Loader2,
  RotateCcw,
  Sparkles,
  Trash2,
} from "lucide-react";
import { parseAsString, useQueryStates, type Parser, type Values } from "nuqs";
import AgentDebugInfo from "./AgentDebugInfo";

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

// Build model_mapping type from models array
// The API returns models array, we build a mapping from model_id to model info
type AgentModelMapping = Record<
  string,
  {
    model_id: string;
    name: string | null;
    description: string | null;
    input_modalities: string[] | null;
    output_modalities: string[] | null;
    temperature_lower: number | null;
    temperature_upper: number | null;
    temperature_levels: unknown;
    reasoning_options: unknown;
    available_voices: unknown;
  }
>;

// Remove old StepStatus and Step interfaces - use from GenericForm
// Remove AgentFormData interface - form fields are in draftState, URL params are separate

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
}

interface FormErrors {
  name?: string;
  description?: string;
  systemPrompt?: string;
  modelId?: string;
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
}: AgentProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isEditMode = !!agentId;
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
  const isSuperadmin = effectiveProfile?.role === "superadmin";

  const [errors, setErrors] = useState<FormErrors>({});
  const [editorMode, setEditorMode] = useState<"editor" | "preview" | "debug">(
    "editor"
  );
  const prevDepartmentIdsRef = React.useRef<string[]>([]);
  const [showDeletePromptDialog, setShowDeletePromptDialog] = useState(false);
  const [promptToDelete, setPromptToDelete] = useState<{
    promptId: string;
    isDepartmentSpecific: boolean;
  } | null>(null);

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
    roleSearch: parseAsString,
    modelSearch: parseAsString,
    reasoningSearch: parseAsString,
    voiceSearch: parseAsString,
    _promptSearch: parseAsString,
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

  const draftId = urlDraftId;

  // Local draft state (not in URL) - initialized from server data or draft payload
  type DraftState = {
    name: string;
    description: string;
    systemPrompt: string;
    promptId: string | null;
    modelId: string;
    active: boolean;
    role: string;
    departmentIds: string[];
    temperature_level_id: string | null;
    reasoning_level_id: string | null;
    voice_ids: string[];
  };

  const defaultDepartmentIds = useMemo(
    () =>
      getDefaultDepartmentIds(
        isSuperadmin,
        effectiveProfile?.primary_department_id ?? null
      ),
    [isSuperadmin, effectiveProfile?.primary_department_id]
  );

  // Initialize draft state from server data or draft payload
  const initialDraftState = useMemo((): DraftState => {
    const data = isEditMode ? agentDetail : agentDetailDefault;
    if (!data) {
      return {
        name: "New Agent",
        description: "",
        systemPrompt: "",
        promptId: null,
        modelId: "",
        active: true,
        role: "assistant",
        departmentIds: defaultDepartmentIds,
        temperature_level_id: null,
        reasoning_level_id: null,
        voice_ids: [],
      };
    }

    // If draftId exists, server should have merged draft payload into data
    // Otherwise, use server defaults
    return {
      name: data.name || "New Agent",
      description: data.description || "",
      systemPrompt: data.system_prompt || "",
      promptId: data.prompt_id || null,
      modelId: data.model_id || "",
      active: data.active ?? true,
      role: data.role || "assistant",
      departmentIds: data.department_ids || [],
      temperature_level_id: data.temperature_level_id || null,
      reasoning_level_id: data.reasoning_level_id || null,
      voice_ids: data.voice_ids || [],
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
    // Include actual content fields so it recomputes when server data changes
    agentDetailDefault?.name,
    agentDetailDefault?.description,
    agentDetailDefault?.system_prompt,
    agentDetailDefault?.model_id,
    agentDetailDefault?.role,
    agentDetailDefault?.department_ids,
    agentDetail?.name,
    agentDetail?.description,
    agentDetail?.system_prompt,
    agentDetail?.model_id,
    agentDetail?.role,
    agentDetail?.department_ids,
    agentDetail?.selected_temperature_level_id,
    agentDetail?.selected_reasoning_level_id,
    agentDetail?.selected_voice_ids,
  ]);

  const [draftState, setDraftState] = useState<DraftState>(initialDraftState);

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
        router.refresh();
      },
      [router, searchParams]
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

  // Build model mapping from models array
  // Define this BEFORE temperatureBounds since temperatureBounds depends on it
  const modelMapping = useMemo((): AgentModelMapping => {
    if (!agentData?.models || !Array.isArray(agentData.models)) {
      return {} as AgentModelMapping;
    }
    const mapping: AgentModelMapping = {};
    agentData.models.forEach((model) => {
      if (model.model_id) {
        mapping[model.model_id] = {
          model_id: model.model_id,
          name: model.name || null,
          description: model.description || null,
          input_modalities: model.input_modalities || null,
          output_modalities: model.output_modalities || null,
          temperature_lower: model.temperature_lower ?? null,
          temperature_upper: model.temperature_upper ?? null,
          temperature_levels: model.temperature_levels ?? null,
          reasoning_options: model.reasoning_options ?? null,
          available_voices: model.available_voices ?? null,
        };
      }
    });
    return mapping;
  }, [agentData?.models]);

  // Compute department_mapping from departments array
  const departmentMapping = useMemo(() => {
    if (!agentData?.departments || !Array.isArray(agentData.departments)) {
      return {} as Record<
        string,
        { id: string; name: string; description?: string }
      >;
    }
    const mapping: Record<
      string,
      { id: string; name: string; description?: string }
    > = {};
    agentData.departments.forEach((dept) => {
      if (dept.department_id) {
        const desc = dept.description || undefined;
        mapping[dept.department_id] = {
          id: dept.department_id,
          name: dept.name || "",
          ...(desc !== undefined ? { description: desc } : {}),
        };
      }
    });
    return mapping;
  }, [agentData?.departments]);

  // Build prompt_mapping from prompts array and department_prompt_links
  const promptMapping = useMemo(() => {
    if (!agentDetail?.prompts || !Array.isArray(agentDetail.prompts)) {
      return {} as Record<string, PromptInfo>;
    }
    const mapping: Record<string, PromptInfo> = {};
    agentDetail.prompts.forEach((prompt) => {
      if (prompt.prompt_id) {
        // Get department_ids from department_prompt_links
        const deptIds: string[] = [];
        if (
          agentDetail.department_prompt_links &&
          Array.isArray(agentDetail.department_prompt_links)
        ) {
          agentDetail.department_prompt_links.forEach((link) => {
            if (link.prompt_id === prompt.prompt_id && link.department_id) {
              deptIds.push(link.department_id);
            }
          });
        }
        mapping[prompt.prompt_id] = {
          system_prompt: prompt.system_prompt || "",
          name: prompt.name || "",
          description: prompt.description || "",
          created_at: prompt.created_at || "",
          updated_at: prompt.updated_at || "",
          department_ids: deptIds.length > 0 ? deptIds : null,
          can_delete: prompt.can_delete ?? false,
        };
      }
    });
    return mapping;
  }, [agentDetail?.prompts, agentDetail?.department_prompt_links]);

  // Filter prompt_mapping client-side based on selected departments from form
  // API returns all prompts user has access to, then we filter by selected departments
  // When "All Departments" selected (empty array): Show ALL prompts (default + all department-specific)
  // When specific departments selected: Show default + prompts for those departments
  const filteredPromptMapping = useMemo(() => {
    if (!isEditMode || Object.keys(promptMapping).length === 0) {
      return promptMapping;
    }

    const selectedDeptIds = draftState.departmentIds || [];
    const filtered: Record<string, PromptInfo> = {};

    for (const [promptId, promptInfoRaw] of Object.entries(promptMapping)) {
      // Add default values for name and description if missing (for backward compatibility)
      // Type assertion needed because API schema may not be fully updated in TypeScript types
      const rawInfo = promptInfoRaw as PromptInfo & {
        name?: string;
        description?: string;
      };
      const promptInfo: PromptInfo = {
        ...promptInfoRaw,
        name: rawInfo.name || "",
        description: rawInfo.description || "",
      };

      // Always include default prompt (no department_ids)
      if (
        !promptInfo.department_ids ||
        promptInfo.department_ids.length === 0
      ) {
        filtered[promptId] = promptInfo;
      } else if (selectedDeptIds.length === 0) {
        // "All Departments" selected - show ALL prompts including department-specific ones
        filtered[promptId] = promptInfo;
      } else {
        // Specific departments selected - show prompts for those departments
        if (
          promptInfo.department_ids.some((deptId) =>
            selectedDeptIds.includes(deptId)
          )
        ) {
          filtered[promptId] = promptInfo;
        }
      }
    }
    return filtered;
  }, [draftState.departmentIds, promptMapping, isEditMode]);

  // Get default prompt content (from agent_prompts table)
  const defaultPromptContent = useMemo(() => {
    if (
      !isEditMode ||
      !agentDetail?.prompt_id ||
      Object.keys(promptMapping).length === 0
    )
      return "";
    const defaultPrompt = promptMapping[agentDetail.prompt_id];
    return defaultPrompt?.system_prompt || "";
  }, [agentDetail, isEditMode, promptMapping]);

  // Get resolved prompt (what's actually saved/configured for selected departments from form)
  // This is what would be used in production for the selected department(s)
  const resolvedPrompt = useMemo(() => {
    if (
      !isEditMode ||
      !agentDetail ||
      Object.keys(promptMapping).length === 0
    ) {
      return { promptId: null, content: "" };
    }

    const selectedDeptIds = draftState.departmentIds || [];
    if (selectedDeptIds.length === 0) {
      // "All Departments" - use default prompt
      return {
        promptId: agentDetail.prompt_id || null,
        content: defaultPromptContent,
      };
    }

    // For multiple departments, check if all have the same prompt
    const firstDeptId = selectedDeptIds[0]!;
    // Find prompt_id for first department from department_prompt_links array
    const firstLink = agentDetail.department_prompt_links?.find(
      (link) => link.department_id === firstDeptId
    );
    const firstPromptId = firstLink?.prompt_id || agentDetail.prompt_id || null;

    // Check if all selected departments have the same prompt
    const allSamePrompt = selectedDeptIds.every((deptId) => {
      const link = agentDetail.department_prompt_links?.find(
        (l) => l.department_id === deptId
      );
      const promptId = link?.prompt_id || agentDetail.prompt_id || null;
      return promptId === firstPromptId;
    });

    if (allSamePrompt && firstPromptId) {
      const promptInfo = promptMapping[firstPromptId];
      return {
        promptId: firstPromptId,
        content: promptInfo?.system_prompt || defaultPromptContent,
      };
    }

    // Mixed prompts - return default
    return {
      promptId: agentDetail.prompt_id || null,
      content: defaultPromptContent,
    };
  }, [
    draftState.departmentIds,
    promptMapping,
    agentDetail,
    defaultPromptContent,
    isEditMode,
  ]);

  // Get resolved prompt content for change detection
  const resolvedPromptContent = useMemo(() => {
    return resolvedPrompt.content;
  }, [resolvedPrompt]);

  // Check if current prompt content differs from resolved prompt
  const hasPromptChanges = useMemo(() => {
    if (!draftState.systemPrompt) return false;
    return draftState.systemPrompt !== resolvedPromptContent;
  }, [draftState.systemPrompt, resolvedPromptContent]);

  // formData is no longer needed - form fields are in draftState, URL params are in urlParams

  // Helper function to get required modalities based on agent_type
  const getRequiredModalities = useCallback(
    (
      agentType: string
    ): {
      input: string[];
      output: string[];
    } => {
      switch (agentType) {
        case "simulation":
        case "hint":
        case "question":
        case "scenario":
        case "grade":
        case "document":
        case "classify":
        case "eval":
          return { input: ["text"], output: ["text"] };
        case "voice":
        case "audio":
          return { input: ["text", "audio"], output: ["text", "audio"] };
        case "image":
          return { input: [], output: ["image"] };
        case "video":
          return { input: [], output: ["video"] };
        default:
          return { input: ["text"], output: ["text"] };
      }
    },
    []
  );

  // Helper to extract modalities from model info
  // The API returns input_modalities and output_modalities as separate fields
  const getModelModalities = useCallback(
    (
      modelInfo: AgentModelMapping[string] | undefined
    ): { input: string[]; output: string[] } => {
      if (!modelInfo) return { input: [], output: [] };

      // New format: separate fields (from our API update) - type-safe
      if (modelInfo.input_modalities || modelInfo.output_modalities) {
        return {
          input: Array.isArray(modelInfo.input_modalities)
            ? modelInfo.input_modalities
            : [],
          output: Array.isArray(modelInfo.output_modalities)
            ? modelInfo.output_modalities
            : [],
        };
      }

      // Old format: nested modalities object (backward compatibility)
      // Type assertion needed for old format
      const modelInfoWithOldFormat = modelInfo as AgentModelMapping[string] & {
        modalities?: {
          input?: string[];
          output?: string[];
        };
      };
      if (modelInfoWithOldFormat.modalities) {
        return {
          input: modelInfoWithOldFormat.modalities.input || [],
          output: modelInfoWithOldFormat.modalities.output || [],
        };
      }

      return { input: [], output: [] };
    },
    []
  );

  // Filter valid_model_ids based on agent_type modality requirements
  const filteredValidModelIds = useMemo(() => {
    if (!draftState.role || !agentData?.valid_model_ids || !modelMapping) {
      return agentData?.valid_model_ids || [];
    }

    const requiredModalities = getRequiredModalities(draftState.role);
    const filtered: string[] = [];

    for (const modelId of agentData.valid_model_ids) {
      const modelInfo = modelMapping[modelId];
      if (!modelInfo) continue;

      const { input: modelInputMods, output: modelOutputMods } =
        getModelModalities(modelInfo);

      // Special rule: Models with audio input AND output should ONLY be available for simulation-voice role
      const hasAudioInput = modelInputMods.includes("audio");
      const hasAudioOutput = modelOutputMods.includes("audio");
      const isAudioModel = hasAudioInput && hasAudioOutput;

      if (isAudioModel && draftState.role !== "simulation-voice") {
        // Skip audio models for non-voice roles
        continue;
      }

      // If no modalities configured, include the model (backward compatibility)
      // Otherwise, check if it has required modalities
      if (modelInputMods.length === 0 && modelOutputMods.length === 0) {
        // No modalities configured - include all models for backward compatibility
        filtered.push(modelId);
      } else {
        const hasRequiredInput =
          requiredModalities.input.length === 0 ||
          requiredModalities.input.every((mod) => modelInputMods.includes(mod));
        const hasRequiredOutput =
          requiredModalities.output.length === 0 ||
          requiredModalities.output.every((mod) =>
            modelOutputMods.includes(mod)
          );

        if (hasRequiredInput && hasRequiredOutput) {
          filtered.push(modelId);
        }
      }
    }

    return filtered;
  }, [
    draftState.role,
    agentData?.valid_model_ids,
    modelMapping,
    getRequiredModalities,
    getModelModalities,
  ]);

  // Get selected model capabilities
  const selectedModelCapabilities = useMemo(() => {
    if (!draftState.modelId || !modelMapping) {
      return null;
    }

    const modelInfo = modelMapping[draftState.modelId];
    if (!modelInfo) {
      return null;
    }

    const { input: inputMods, output: outputMods } =
      getModelModalities(modelInfo);

    return {
      input_modalities: inputMods,
      output_modalities: outputMods,
      has_text_output: outputMods.includes("text"),
      has_audio_input: inputMods.includes("audio"),
      has_audio_output: outputMods.includes("audio"),
      has_image_output: outputMods.includes("image"),
      has_video_output: outputMods.includes("video"),
    };
  }, [draftState.modelId, modelMapping, getModelModalities]);

  // Set breadcrumb context when agent data is loaded
  useEffect(() => {
    const agentName = agentData?.name_resource?.name || agentDetail?.name;
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
    agentDetail?.name,
    agentId,
    isEditMode,
    setEntityMetadata,
    clearEntityMetadata,
  ]);

  // Set generation capability when agent data is loaded
  useEffect(() => {
    // For agents, we need to determine if any agent_id is available for generation
    // Use the first available agent_id from resource types
    const availableAgentId =
      agentData?.name_agent_id ||
      agentData?.description_agent_id ||
      agentData?.models_agent_id ||
      agentData?.prompts_agent_id ||
      agentData?.instructions_agent_id ||
      agentData?.flag_agent_id ||
      agentData?.departments_agent_id ||
      null;

    if (availableAgentId) {
      setGenerationCapability({
        artifactType: "agent",
        canGenerate: true,
        agentId: availableAgentId,
      });
    } else {
      setGenerationCapability({
        artifactType: "agent",
        canGenerate: false,
        agentId: null,
      });
    }
    return () => clearGenerationCapability();
  }, [
    agentData?.name_agent_id,
    agentData?.description_agent_id,
    agentData?.models_agent_id,
    agentData?.prompts_agent_id,
    agentData?.instructions_agent_id,
    agentData?.flag_agent_id,
    agentData?.departments_agent_id,
    setGenerationCapability,
    clearGenerationCapability,
  ]);

  // Initialize department change tracking ref
  useEffect(() => {
    prevDepartmentIdsRef.current = [...draftState.departmentIds];
  }, [draftState.departmentIds]);

  // Update prompt when department selection changes
  useEffect(() => {
    if (!isEditMode || !agentDetail || !draftState.departmentIds) return;

    // Track department changes - compare arrays
    const prevIds = prevDepartmentIdsRef.current;
    const currentIds = draftState.departmentIds || [];
    const departmentChanged =
      prevIds.length !== currentIds.length ||
      !prevIds.every((id) => currentIds.includes(id));

    if (departmentChanged) {
      prevDepartmentIdsRef.current = [...currentIds];
    }

    // Only auto-set if user hasn't made changes (compare content to resolved prompt)
    if (hasPromptChanges && !departmentChanged) return;

    // Only auto-set when department changes - use resolvedPrompt which is computed for current selection
    if (departmentChanged) {
      setDraftState((prev) => ({
        ...prev,
        promptId: resolvedPrompt.promptId,
        systemPrompt: resolvedPrompt.content,
      }));
    }
  }, [
    draftState.departmentIds,
    agentDetail,
    isEditMode,
    resolvedPrompt,
    hasPromptChanges,
  ]);

  // handleInputChange removed - use setDraftState directly

  const resetFormAndState = useCallback(() => {
    setDraftState(initialDraftState);
    setErrors({});
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
        id: "role",
        title: "Role",
        description: "Select the agent role that defines its capabilities.",
        resetFields: ["role"] as string[],
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

    const promptStep = {
      id: "prompt",
      title: "Prompt Instructions",
      description: "Define the system prompt that controls agent behavior.",
      resetFields: ["systemPrompt", "promptId"] as string[],
    };

    return [...baseSteps, ...configSteps, promptStep];
  }, [selectedModelCapabilities]);

  // Reset handler for GenericForm - resets draftState fields
  const handleReset = useCallback(
    (stepId: string, _fields: string[]) => {
      const step = steps.find((s) => s.id === stepId);
      if (!step || !step.resetFields) return;

      // Map resetFields to draftState fields and reset them
      const resetUpdates: Partial<DraftState> = {};
      step.resetFields.forEach((field) => {
        switch (field) {
          case "name":
            resetUpdates.name = initialDraftState.name;
            break;
          case "description":
            resetUpdates.description = initialDraftState.description;
            break;
          case "active":
            resetUpdates.active = initialDraftState.active;
            break;
          case "departmentIds":
            resetUpdates.departmentIds = initialDraftState.departmentIds;
            break;
          case "role":
            resetUpdates.role = initialDraftState.role;
            break;
          case "modelId":
            resetUpdates.modelId = initialDraftState.modelId;
            break;
          case "temperature_level_id":
            resetUpdates.temperature_level_id =
              initialDraftState.temperature_level_id;
            break;
          case "reasoning_level_id":
            resetUpdates.reasoning_level_id =
              initialDraftState.reasoning_level_id;
            break;
          case "voice_ids":
            resetUpdates.voice_ids = initialDraftState.voice_ids;
            break;
          case "systemPrompt":
            resetUpdates.systemPrompt = initialDraftState.systemPrompt;
            break;
          case "promptId":
            resetUpdates.promptId = initialDraftState.promptId;
            break;
        }
      });

      setDraftState((prev) => ({ ...prev, ...resetUpdates }));
    },
    [steps, initialDraftState]
  );

  // Handle form submission (for GenericForm)
  const handleSubmit = useCallback(
    async (_formData: Values<Record<string, Parser<unknown>>>) => {
      // Form data from GenericForm is URL params (search/filter)
      // Actual form fields are in draftState

      // Validation
      if (!draftState.name) {
        setErrors((prev) => ({ ...prev, name: "Agent name is required" }));
        throw new Error("Agent name is required");
      }

      if (!draftState.description) {
        setErrors((prev) => ({
          ...prev,
          description: "Agent description is required",
        }));
        throw new Error("Agent description is required");
      }

      if (!draftState.systemPrompt) {
        setErrors((prev) => ({
          ...prev,
          systemPrompt: "System prompt is required",
        }));
        throw new Error("System prompt is required");
      }

      if (!draftState.modelId || draftState.modelId.trim().length === 0) {
        setErrors((prev) => ({
          ...prev,
          modelId: "Model selection is required",
        }));
        throw new Error("Model selection is required");
      }

      try {
        const validDepartmentIds = agentData?.valid_department_ids || [];
        const finalDepartmentIds = transformDepartmentIdsForSubmit(
          draftState.departmentIds || [],
          isSuperadmin,
          validDepartmentIds
        );

        if (isEditMode && agentId && agentDetail) {
          // Safety check: Only create/update overrides for departments that:
          // 1. Don't have an override yet (use default), OR
          // 2. Are the only department selected, OR
          // 3. All selected departments share the same existing override prompt
          const selectedDeptIds = draftState.departmentIds || [];
          let departmentsForPromptOverride: string[] = [];

          if (hasPromptChanges) {
            const targetDeptIds =
              selectedDeptIds.length === 0
                ? agentDetail?.valid_department_ids || []
                : selectedDeptIds;

            if (targetDeptIds.length > 0) {
              // If only one department selected, always allow update
              if (targetDeptIds.length === 1) {
                departmentsForPromptOverride = targetDeptIds;
              } else {
                // For multiple departments, check which ones are safe to update
                // Convert department_prompt_links array to Record<department_id, prompt_id>
                const departmentPromptLinksArray =
                  agentDetail?.department_prompt_links ?? [];
                const departmentPromptLinks: Record<
                  string,
                  string | undefined
                > = {};
                departmentPromptLinksArray.forEach((link) => {
                  if (link.department_id) {
                    departmentPromptLinks[link.department_id] =
                      link.prompt_id ?? undefined;
                  }
                });
                const existingPromptIds = targetDeptIds
                  .map((deptId) => departmentPromptLinks[deptId])
                  .filter((promptId) => promptId !== undefined);

                const allShareSamePrompt =
                  existingPromptIds.length > 0 &&
                  existingPromptIds.every(
                    (promptId) => promptId === existingPromptIds[0]
                  );

                if (allShareSamePrompt) {
                  // All departments share the same override - safe to update all
                  departmentsForPromptOverride = targetDeptIds;
                } else {
                  // Not all share same prompt - only update departments without overrides
                  const safeToUpdate: string[] = [];
                  for (const deptId of targetDeptIds) {
                    if (!departmentPromptLinks[deptId]) {
                      // Department doesn't have an override - safe to create one
                      safeToUpdate.push(deptId);
                    }
                  }
                  departmentsForPromptOverride = safeToUpdate;
                }
              }
            }
          }
        }

        // Always create new prompt version if content differs from resolved prompt
        // Never create default prompts - always create department-specific overrides
        const shouldCreateNewPrompt = hasPromptChanges;

        // Save agent using unified v4 API (handles both create and update)
        // Ensure profileId exists - required for API calls
        if (!effectiveProfile?.id) {
          toast.error("Profile not loaded. Please refresh the page.");
          throw new Error("Profile not loaded");
        }

        // Note: profileId is added by the server action
        // Use input_agent_id = null for create, agent_id for update
        // Extract name and description from resource IDs if available, otherwise use draftState text
        const nameText =
          agentData?.name_resource?.name || draftState.name || "New Agent";
        const descriptionText =
          agentData?.description_resource?.description ||
          draftState.description ||
          null;

        await handleSaveAgent({
          input_agent_id: isEditMode ? agentId : null,
          name: nameText,
          description: descriptionText,
          model_id: draftState.modelId!.trim(),
          prompt_id: shouldCreateNewPrompt ? null : draftState.promptId || null,
          system_prompt: draftState.systemPrompt!,
          instructions_id: agentData?.instructions_id || null,
          active_flag_id: agentData?.active_flag_id || null,
          department_ids: finalDepartmentIds,
          artifact_name: draftState.role || "assistant",
          temperature_level_id: draftState.temperature_level_id || null,
          reasoning_level_id: draftState.reasoning_level_id || null,
          voice_ids:
            draftState.voice_ids && draftState.voice_ids.length > 0
              ? draftState.voice_ids
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
      agentDetail,
      agentData,
      isSuperadmin,
      effectiveProfile,
      hasPromptChanges,
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
  const getStepStatus = useCallback(
    (
      stepId: string,
      _formData: Values<Record<string, Parser<unknown>>>
    ): StepStatus => {
      const hasRole = !!draftState.role;
      const hasModel = !!draftState.modelId?.trim();
      const hasName = !!draftState.name?.trim();
      const hasDescription = !!draftState.description?.trim();

      switch (stepId) {
        case "basic":
          return hasName && hasDescription ? "completed" : "active";
        case "role":
          if (!hasName || !hasDescription) return "pending";
          return hasRole ? "completed" : "active";
        case "model":
          if (!hasRole) return "pending";
          return hasModel ? "completed" : "active";
        case "temperature":
          if (!hasModel) return "pending";
          // Always completed if model selected (optional step)
          return "completed";
        case "reasoning":
          if (!hasModel) return "pending";
          // Always completed if model selected (optional step)
          return "completed";
        case "voice":
          if (!hasModel) return "pending";
          // Always completed if model selected (optional step)
          return "completed";
        case "prompt":
          if (!hasModel) return "pending";
          return draftState.systemPrompt?.trim() ? "completed" : "active";
        default:
          return "pending";
      }
    },
    [draftState]
  );

  // Handle role change - do NOT reset model when role is unselected
  const handleRoleChange = useCallback(
    (roleId: string) => {
      setDraftState((prev) => ({ ...prev, role: roleId }));

      // If unselecting role (empty string), do NOT reset model - just update role
      if (!roleId || roleId === "") {
        return;
      }

      // If a role is selected, check if current model matches role requirements
      const requiredModalities = getRequiredModalities(roleId);
      const currentModelId = draftState.modelId;
      if (currentModelId && modelMapping) {
        const modelInfo = modelMapping[currentModelId];
        if (modelInfo) {
          const { input: modelInputMods, output: modelOutputMods } =
            getModelModalities(modelInfo);

          // Special rule: Audio models (with both audio input and output) should only work with voice role
          const hasAudioInput = modelInputMods.includes("audio");
          const hasAudioOutput = modelOutputMods.includes("audio");
          const isAudioModel = hasAudioInput && hasAudioOutput;

          if (isAudioModel && roleId !== "voice") {
            // Reset model if audio model selected but role is not voice
            setDraftState((prev) => ({ ...prev, modelId: "" }));
            return;
          }

          const hasRequiredInput = requiredModalities.input.every((mod) =>
            modelInputMods.includes(mod)
          );
          const hasRequiredOutput = requiredModalities.output.every((mod) =>
            modelOutputMods.includes(mod)
          );
          if (!hasRequiredInput || !hasRequiredOutput) {
            // Reset to first valid model or empty
            const filteredIds =
              agentData?.valid_model_ids?.filter((id) => {
                const info = modelMapping[id];
                if (!info) return false;
                const { input: inputMods, output: outputMods } =
                  getModelModalities(info);

                // Special rule: Audio models only for voice
                const modelHasAudioInput = inputMods.includes("audio");
                const modelHasAudioOutput = outputMods.includes("audio");
                const modelIsAudio = modelHasAudioInput && modelHasAudioOutput;

                if (modelIsAudio && roleId !== "voice") {
                  return false;
                }

                return (
                  requiredModalities.input.every((mod) =>
                    inputMods.includes(mod)
                  ) &&
                  requiredModalities.output.every((mod) =>
                    outputMods.includes(mod)
                  )
                );
              }) || [];
            setDraftState((prev) => ({
              ...prev,
              modelId: filteredIds[0] || "",
            }));
          }
        }
      }
    },
    [
      draftState.modelId,
      modelMapping,
      agentData?.valid_model_ids,
      getRequiredModalities,
      getModelModalities,
    ]
  );

  // Helper to get required modalities for a role (for role filtering)
  const getRequiredModalitiesForRole = useCallback(
    (roleId: string): { input: string[]; output: string[] } => {
      return getRequiredModalities(roleId);
    },
    [getRequiredModalities]
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
          return agentData.models?.some((m) => m.generated) ?? false;
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
        const agentTypeMap: Record<ResourceType, string> = {
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
        };
        const firstType = resourceTypes[0];
        if (firstType && firstType in agentTypeMap) {
          return agentTypeMap[firstType];
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

  const handleGenerateInstructions = useCallback(
    async () =>
      handleGenerateResources(
        ["instructions"],
        determineAgentType(["instructions"])
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

  const handleGenerateVoices = useCallback(
    async () =>
      handleGenerateResources(["voices"], determineAgentType(["voices"])),
    [handleGenerateResources, determineAgentType]
  );

  // Listen for full-page-generate event from layout
  useEffect(() => {
    const handleFullPageGenerate = () => {
      // Check if generation is available (agent has generation capability)
      if (agentData?.general_agent_id || agentId) {
        // Open modal instead of directly generating
        handleOpenStepCardModal("all", "generate");
      }
    };
    window.addEventListener("full-page-generate", handleFullPageGenerate);
    return () =>
      window.removeEventListener("full-page-generate", handleFullPageGenerate);
  }, [agentData?.general_agent_id, agentId, handleOpenStepCardModal]);

  // WebSocket handlers for AI generation
  useEffect(() => {
    if (!socket || !isConnected) return;

    const currentGroupId = agentData?.group_id;

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
      message?: string;
      success?: boolean;
      [key: string]: unknown;
    }) => {
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
      ];
      if (
        data.resource_type &&
        validResourceTypes.includes(data.resource_type as ResourceType)
      ) {
        // Update draftState with generated resource IDs and text
        setDraftState((prev) => {
          const updates: Partial<DraftState> = {};
          if (data.name_id) {
            // Find name text from agentData names array
            const nameResource = agentData?.names?.find(
              (n) => n.id === data.name_id
            );
            if (nameResource?.name) {
              updates.name = nameResource.name;
            }
          }
          if (data.description_id) {
            // Find description text from agentData descriptions array
            const descriptionResource = agentData?.descriptions?.find(
              (d) => d.id === data.description_id
            );
            if (descriptionResource?.description) {
              updates.description = descriptionResource.description;
            }
          }
          if (data.model_id) updates.modelId = data.model_id;
          if (data.prompt_id) updates.promptId = data.prompt_id;
          if (data.reasoning_level_id)
            updates.reasoning_level_id = data.reasoning_level_id;
          if (data.temperature_level_id)
            updates.temperature_level_id = data.temperature_level_id;
          if (data.voice_ids && data.voice_ids.length > 0) {
            updates.voice_ids = [
              ...new Set([...prev.voice_ids, ...data.voice_ids]),
            ];
          }
          if (data.instructions_id) {
            // Find instructions text from agentData instructions array
            const instructionsResource = agentData?.instructions?.find(
              (inst) => inst.id === data.instructions_id
            );
            // Note: Instructions are stored separately, not in draftState.systemPrompt
            // The systemPrompt is for prompts, not instructions
          }
          if (data.active_flag_id) {
            updates.active = true; // Flag ID means active
          }
          if (data.department_ids && data.department_ids.length > 0) {
            updates.departmentIds = [
              ...new Set([...prev.departmentIds, ...data.department_ids]),
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
  }, [
    socket,
    isConnected,
    agentData?.group_id,
    agentData?.names,
    agentData?.descriptions,
    agentData?.instructions,
  ]);

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
      ],
    }),
    []
  );

  // Resource labels for display
  const resourceLabels: Record<ResourceType, string> = useMemo(
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
                case "role":
                  return "Role reset";
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
                            // Update draftState with name text from resource
                            const nameResource = agentData?.names?.find(
                              (n) => n.id === nameId
                            );
                            setDraftState((prev) => ({
                              ...prev,
                              name: nameResource?.name || "New Agent",
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
                            // Update draftState with description text from resource
                            const descriptionResource =
                              agentData?.descriptions?.find(
                                (d) => d.id === descriptionId
                              );
                            setDraftState((prev) => ({
                              ...prev,
                              description:
                                descriptionResource?.description || "",
                            }));
                          }}
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

                        {/* Active Switch - using Flags resource component */}
                        <Flags
                          flag_id={agentData?.active_flag_id ?? null}
                          flag_resource={agentData?.flag_resource ?? null}
                          show_flag={agentData?.show_flag ?? false}
                          disabled={isReadonly}
                          onFlagIdChange={(flagId) => {
                            // Update draftState active based on flag
                            setDraftState((prev) => ({
                              ...prev,
                              active: flagId ? true : false,
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

                case "role": {
                  const roleSearch =
                    (stepFormData["roleSearch"] as string) || "";

                  // Filter roles based on selected model capabilities (computed directly, not with useMemo inside callback)
                  let filteredRoles = [...AGENT_ROLES];

                  // If a model is selected, filter roles based on model capabilities
                  if (
                    draftState.modelId &&
                    modelMapping &&
                    draftState.modelId in modelMapping
                  ) {
                    const modelInfo = modelMapping[draftState.modelId];
                    if (modelInfo) {
                      const { input: modelInputMods, output: modelOutputMods } =
                        getModelModalities(modelInfo);
                      const hasAudioInput = modelInputMods.includes("audio");
                      const hasAudioOutput = modelOutputMods.includes("audio");
                      const isAudioModel = hasAudioInput && hasAudioOutput;

                      filteredRoles = filteredRoles.filter((role) => {
                        if (isAudioModel) {
                          return role.id === "voice";
                        }
                        const requiredModalities = getRequiredModalitiesForRole(
                          role.id
                        );
                        const hasRequiredInput =
                          requiredModalities.input.length === 0 ||
                          requiredModalities.input.every((mod) =>
                            modelInputMods.includes(mod)
                          );
                        const hasRequiredOutput =
                          requiredModalities.output.length === 0 ||
                          requiredModalities.output.every((mod) =>
                            modelOutputMods.includes(mod)
                          );
                        return hasRequiredInput && hasRequiredOutput;
                      });
                    }
                  }

                  // Filter by search term
                  if (roleSearch.trim()) {
                    const searchLower = roleSearch.toLowerCase();
                    filteredRoles = filteredRoles.filter(
                      (role) =>
                        role.name?.toLowerCase().includes(searchLower) ||
                        role.description?.toLowerCase().includes(searchLower)
                    );
                  }

                  // Sort: selected role first, then by name
                  filteredRoles = filteredRoles.sort((a, b) => {
                    if (a.id === draftState.role) return -1;
                    if (b.id === draftState.role) return 1;
                    return (a.name || "").localeCompare(b.name || "");
                  });

                  return (
                    <StepCard
                      stepStatus={stepStatus}
                      stepNumber={stepNumber}
                      stepTitle={stepTitle}
                      stepDescription={stepDescription}
                      isReadonly={isReadonly}
                      isEditMode={isEditMode}
                      searchTerm={roleSearch}
                      onSearchChange={(term) =>
                        setStepFormData({ roleSearch: term || null })
                      }
                      searchPlaceholder="Search roles..."
                      resetFields={["role"]}
                      {...(onReset ? { onReset } : {})}
                      resetLabel="Reset"
                    >
                      <SelectableGrid
                        items={filteredRoles}
                        selectedId={draftState.role || null}
                        onSelect={(roleId) => {
                          // Allow unselecting by clicking the same role again
                          if (roleId === draftState.role) {
                            handleRoleChange("");
                          } else {
                            handleRoleChange(roleId);
                          }
                        }}
                        getId={(role) => role.id}
                        renderItem={(role, isSelected) => (
                          <div
                            className={cn(
                              "relative flex flex-col gap-3 p-4 rounded-xl border bg-card text-card-foreground shadow-sm transition-all text-left",
                              "hover:shadow-md hover:bg-accent/50",
                              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                              isSelected && "ring-2 ring-primary bg-accent"
                            )}
                          >
                            {isSelected && (
                              <div className="absolute top-2 right-2 z-10 h-6 w-6 bg-primary rounded-full flex items-center justify-center">
                                <Check className="h-3.5 w-3.5 text-primary-foreground" />
                              </div>
                            )}
                            <div className="flex items-start gap-3">
                              <div className="flex-1 min-w-0">
                                <h3 className="font-medium text-sm leading-tight">
                                  {role.name}
                                </h3>
                                {role.description && (
                                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                    {role.description}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                        emptyMessage="No roles found. Try adjusting your search."
                        disabled={isReadonly}
                      />
                    </StepCard>
                  );
                }

                case "model": {
                  const modelSearch =
                    (stepFormData["modelSearch"] as string) || "";

                  // Build models from mapping (computed directly, not with useMemo inside callback)
                  const baseModels = filteredValidModelIds
                    .map((id) => ({
                      id,
                      name: modelMapping[id]?.name || "Unnamed Model",
                      description: modelMapping[id]?.description,
                    }))
                    .sort((a, b) => (a.name || "").localeCompare(b.name || ""));

                  // Apply search filter, then sort selected first
                  let filteredModels = baseModels;
                  if (modelSearch.trim()) {
                    const searchLower = modelSearch.toLowerCase();
                    filteredModels = filteredModels.filter(
                      (model) =>
                        model.name?.toLowerCase().includes(searchLower) ||
                        model.description?.toLowerCase().includes(searchLower)
                    );
                  }
                  filteredModels = filteredModels.sort((a, b) => {
                    if (a.id === draftState.modelId) return -1;
                    if (b.id === draftState.modelId) return 1;
                    return (a.name || "").localeCompare(b.name || "");
                  });

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
                      {filteredValidModelIds.length === 0 && draftState.role ? (
                        <p className="text-xs text-muted-foreground">
                          No models available for this agent type. Please select
                          a different role or configure models with the required
                          modalities.
                        </p>
                      ) : (
                        <>
                          <SelectableGrid
                            items={filteredModels}
                            selectedId={draftState.modelId || null}
                            onSelect={(modelId) => {
                              // Allow unselecting by clicking the same model again
                              if (modelId === draftState.modelId) {
                                setDraftState((prev) => ({
                                  ...prev,
                                  modelId: "",
                                }));
                              } else {
                                setDraftState((prev) => ({ ...prev, modelId }));

                                // Bidirectional filtering: Auto-set role based on model capabilities
                                if (
                                  modelId &&
                                  modelMapping &&
                                  modelId in modelMapping
                                ) {
                                  const modelInfo = modelMapping[modelId];
                                  const {
                                    input: modelInputMods,
                                    output: modelOutputMods,
                                  } = getModelModalities(modelInfo);
                                  const hasAudioInput =
                                    modelInputMods.includes("audio");
                                  const hasAudioOutput =
                                    modelOutputMods.includes("audio");
                                  const isAudioModel =
                                    hasAudioInput && hasAudioOutput;

                                  if (
                                    isAudioModel &&
                                    draftState.role !== "voice"
                                  ) {
                                    handleRoleChange("voice");
                                  }
                                }
                              }
                              if (errors.modelId) {
                                setErrors((prev) => {
                                  const { modelId: _, ...rest } = prev;
                                  return rest;
                                });
                              }
                            }}
                            getId={(model) => model.id}
                            renderItem={(model, isSelected) => (
                              <div
                                className={cn(
                                  "relative flex flex-col gap-3 p-4 rounded-xl border bg-card text-card-foreground shadow-sm transition-all text-left",
                                  "hover:shadow-md hover:bg-accent/50",
                                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                                  isSelected && "ring-2 ring-primary bg-accent"
                                )}
                              >
                                {isSelected && (
                                  <div className="absolute top-2 right-2 z-10 h-6 w-6 bg-primary rounded-full flex items-center justify-center">
                                    <Check className="h-3.5 w-3.5 text-primary-foreground" />
                                  </div>
                                )}
                                <div className="flex items-start gap-3">
                                  <div className="flex-1 min-w-0">
                                    <h3 className="font-medium text-sm leading-tight">
                                      {model.name || "Unnamed Model"}
                                    </h3>
                                    {model.description && (
                                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                        {model.description}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
                            emptyMessage="No models found. Try adjusting your search."
                            disabled={isReadonly}
                          />
                          {errors?.modelId && (
                            <p className="text-sm text-destructive">
                              {errors.modelId}
                            </p>
                          )}
                        </>
                      )}
                    </StepCard>
                  );
                }

                case "temperature": {
                  if (!selectedModelCapabilities) return null;

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
                  if (!selectedModelCapabilities?.has_text_output) return null;

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
                  // Only show for models with BOTH input and output audio (e.g., gpt-realtime)
                  if (
                    !selectedModelCapabilities?.has_audio_input ||
                    !selectedModelCapabilities?.has_audio_output
                  ) {
                    return null;
                  }

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
                        onGenerate={handleGenerateVoices}
                        isGenerating={isGenerating("voices")}
                        group_id={agentData?.group_id ?? null}
                        agent_id={agentData?.voices_agent_id ?? null}
                        createVoicesAction={createVoicesAction}
                      />
                    </StepCard>
                  );
                }

                case "prompt": {
                  return (
                    <StepCard
                      stepStatus={stepStatus}
                      stepNumber={stepNumber}
                      stepTitle={stepTitle}
                      stepDescription={stepDescription}
                      isReadonly={isReadonly}
                      isEditMode={isEditMode}
                      resetFields={["systemPrompt", "promptId"]}
                      {...(onReset ? { onReset } : {})}
                      resetLabel="Reset"
                      actions={
                        <div className="flex gap-2">
                          {isEditMode &&
                            agentDetail &&
                            filteredPromptMapping &&
                            Object.keys(filteredPromptMapping).length > 0 && (
                              <PromptPicker
                                promptMapping={filteredPromptMapping}
                                selectedPromptId={draftState.promptId || null}
                                defaultPromptId={agentDetail?.prompt_id || null}
                                onSelect={(selectedPromptId) => {
                                  if (
                                    selectedPromptId &&
                                    filteredPromptMapping[selectedPromptId]
                                  ) {
                                    const prompt =
                                      filteredPromptMapping[selectedPromptId];
                                    setDraftState((prev) => ({
                                      ...prev,
                                      promptId: selectedPromptId,
                                      systemPrompt: prompt.system_prompt,
                                    }));
                                  } else {
                                    setDraftState((prev) => ({
                                      ...prev,
                                      promptId: null,
                                    }));
                                  }
                                }}
                                placeholder="Select prompt..."
                                disabled={isReadonly}
                                buttonClassName="h-8"
                              />
                            )}
                          {hasPromptChanges && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => {
                                    setDraftState((prev) => ({
                                      ...prev,
                                      systemPrompt: resolvedPromptContent,
                                      promptId: resolvedPrompt.promptId,
                                    }));
                                  }}
                                  className="h-8 w-8 p-0"
                                  data-testid="btn-reset-changes"
                                >
                                  <RotateCcw className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Reset to saved prompt</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                type="button"
                                variant={
                                  editorMode === "preview"
                                    ? "default"
                                    : "secondary"
                                }
                                size="sm"
                                onClick={() =>
                                  setEditorMode(
                                    editorMode === "preview"
                                      ? "editor"
                                      : "preview"
                                  )
                                }
                                className="h-8 w-8 p-0"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Preview</p>
                            </TooltipContent>
                          </Tooltip>
                          {isEditMode && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  variant={
                                    editorMode === "debug"
                                      ? "default"
                                      : "secondary"
                                  }
                                  size="sm"
                                  onClick={() =>
                                    setEditorMode(
                                      editorMode === "debug"
                                        ? "editor"
                                        : "debug"
                                    )
                                  }
                                  className="h-8 w-8 p-0"
                                >
                                  <Bug className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Debug</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                          {isEditMode &&
                            !isReadonly &&
                            draftState.promptId &&
                            filteredPromptMapping[draftState.promptId]
                              ?.can_delete && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => {
                                      const promptInfo =
                                        filteredPromptMapping[
                                          draftState.promptId!
                                        ];
                                      if (!promptInfo) return;
                                      setPromptToDelete({
                                        promptId: draftState.promptId!,
                                        isDepartmentSpecific: !!(
                                          promptInfo.department_ids &&
                                          promptInfo.department_ids.length > 0
                                        ),
                                      });
                                      setShowDeletePromptDialog(true);
                                    }}
                                    className="h-8 w-8 p-0"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Delete</p>
                                </TooltipContent>
                              </Tooltip>
                            )}
                        </div>
                      }
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="systemPrompt">System Prompt *</Label>
                        </div>
                        <div
                          className="h-[500px]"
                          data-testid="editor-system-prompt"
                        >
                          <UnifiedPromptEditor
                            value={draftState.systemPrompt || ""}
                            onChange={(value) => {
                              setDraftState((prev) => ({
                                ...prev,
                                systemPrompt: value,
                                promptId: null, // Clear promptId when editing, indicating new prompt
                              }));
                              if (errors.systemPrompt) {
                                setErrors((prev) => {
                                  const { systemPrompt: _, ...rest } = prev;
                                  return rest;
                                });
                              }
                            }}
                            placeholder="System prompt that defines how the agent should behave and respond. You can use markdown formatting."
                            className="h-full"
                            debugContent={
                              isEditMode &&
                              agentDetail &&
                              effectiveProfile?.role === "superadmin" &&
                              agentDetail.debug_info &&
                              Array.isArray(agentDetail.debug_info) ? (
                                <AgentDebugInfo
                                  debugInfo={agentDetail.debug_info
                                    .filter(
                                      (
                                        item
                                      ): item is {
                                        created_at: string;
                                        model_id: string;
                                        content: string;
                                      } =>
                                        !!item.created_at &&
                                        !!item.model_id &&
                                        !!item.content
                                    )
                                    .map((item) => ({
                                      created_at: item.created_at,
                                      model_id: item.model_id,
                                      content: item.content,
                                    }))}
                                  modelMapping={Object.fromEntries(
                                    Object.entries(modelMapping).map(
                                      ([id, model]) => [
                                        id,
                                        {
                                          name: model.name ?? "",
                                          description: model.description ?? "",
                                        },
                                      ]
                                    )
                                  )}
                                />
                              ) : undefined
                            }
                            activeMode={editorMode}
                          />
                        </div>
                        <p className="text-sm text-muted-foreground">
                          This prompt defines the agent's behavior and
                          personality in conversations. You can use markdown
                          formatting for better organization.
                        </p>
                        {errors?.systemPrompt && (
                          <p className="text-sm text-destructive">
                            {errors.systemPrompt}
                          </p>
                        )}
                      </div>
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

        {/* Delete Prompt Confirmation Dialog */}
        <AlertDialog
          open={showDeletePromptDialog}
          onOpenChange={setShowDeletePromptDialog}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Prompt</AlertDialogTitle>
              <AlertDialogDescription>
                {promptToDelete?.isDepartmentSpecific ? (
                  <>
                    Are you sure you want to delete this department-specific
                    prompt? This will delete the prompt and fall back to the
                    default prompt for this department.
                  </>
                ) : (
                  <>
                    Are you sure you want to delete this prompt? This will
                    delete the prompt and set the latest prompt as active.
                  </>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel
                onClick={() => {
                  setShowDeletePromptDialog(false);
                  setPromptToDelete(null);
                }}
              >
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={async () => {
                  if (!promptToDelete || !agentId) return;

                  try {
                    await handleDeleteAgentPrompt({
                      agent_id: agentId,
                      prompt_id: promptToDelete.promptId,
                      department_id: promptToDelete.isDepartmentSpecific
                        ? draftState.departmentIds &&
                          draftState.departmentIds.length > 0
                          ? draftState.departmentIds[0]!
                          : null
                        : null,
                    });
                    toast.success("Prompt deleted successfully");
                    setShowDeletePromptDialog(false);
                    setPromptToDelete(null);
                    // Refresh the page to get updated data
                    router.refresh();
                  } catch (error) {
                    const msg =
                      error instanceof Error ? error.message : "Unknown error";
                    toast.error(`Failed to delete prompt: ${msg}`);
                  }
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
}
