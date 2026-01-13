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
import { GenericPicker } from "@/components/common/forms/GenericPicker";
import {
  PromptInfo,
  PromptPicker,
} from "@/components/common/forms/PromptPicker";
import { SelectableGrid } from "@/components/common/forms/SelectableGrid";
import { StepCard } from "@/components/common/forms/StepCard";
import { VOICES } from "@/components/common/forms/voices";
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
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useBreadcrumbContext } from "@/contexts/breadcrumb-context";
import { useProfile } from "@/contexts/profile-context";
import { useDraftAutosave } from "@/hooks/use-draft-autosave";
import { cn } from "@/lib/utils";
import {
  getDefaultDepartmentIds,
  transformDepartmentIdsForSubmit,
} from "@/utils/department-picker-helpers";
import { Bug, Check, Eye, Power, RotateCcw, Trash2 } from "lucide-react";
import { parseAsString, useQueryStates, type Parser, type Values } from "nuqs";
import AgentDebugInfo from "./AgentDebugInfo";

// Type-only import from server page
import type {
  GetAgentOut,
  SaveAgentIn,
  SaveAgentOut,
  DeleteAgentPromptIn,
  DeleteAgentPromptOut,
  PatchAgentDraftIn,
  PatchAgentDraftOut,
} from "@/app/(main)/engine/agents/a/[agentId]/page";

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
  deleteAgentPromptAction?: (
    input: DeleteAgentPromptIn
  ) => Promise<DeleteAgentPromptOut>;
  // Draft action: Resource-specific prop name is acceptable since types are resource-specific
  // See Z-DOCS.md "Draft Autosave Pattern" section for migration guide
  patchAgentDraftAction?: (
    input: PatchAgentDraftIn
  ) => Promise<PatchAgentDraftOut>;
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
  deleteAgentPromptAction,
  patchAgentDraftAction,
}: AgentProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isEditMode = !!agentId;
  const { effectiveProfile, selectedDraftId, setSelectedDraftId } =
    useProfile();
  const { setEntityMetadata, clearEntityMetadata } = useBreadcrumbContext();
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
    model_temperature_level_id: string | null;
    model_reasoning_level_id: string | null;
    model_voice_ids: string[];
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
        model_temperature_level_id: null,
        model_reasoning_level_id: null,
        model_voice_ids: [],
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
      model_temperature_level_id:
        (
          data as typeof data & {
            selected_temperature_level_id?: string | null;
          }
        ).selected_temperature_level_id || null,
      model_reasoning_level_id:
        (data as typeof data & { selected_reasoning_level_id?: string | null })
          .selected_reasoning_level_id || null,
      model_voice_ids:
        (data as typeof data & { selected_voice_ids?: string[] | null })
          .selected_voice_ids || [],
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
  type DeleteAgentPromptBody = DeleteAgentPromptIn extends { body: infer B }
    ? B
    : never;

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

  const handleDeleteAgentPrompt = async (body: DeleteAgentPromptBody) => {
    if (!deleteAgentPromptAction) {
      throw new Error("deleteAgentPromptAction is required");
    }
    await deleteAgentPromptAction({ body });
  };

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

  // Compute reasoning_mapping from reasoning_options array
  const reasoningMapping = useMemo(() => {
    if (
      !agentDetail?.reasoning_options ||
      !Array.isArray(agentDetail.reasoning_options)
    ) {
      return {} as Record<
        string,
        { id: string; name: string; description?: string }
      >;
    }
    const mapping: Record<
      string,
      { id: string; name: string; description?: string }
    > = {};
    agentDetail.reasoning_options.forEach((opt) => {
      if (opt.id) {
        mapping[opt.id] = {
          id: opt.id,
          name: opt.reasoning_level || "",
        };
      }
    });
    return mapping;
  }, [agentDetail?.reasoning_options]);

  // Get temperature bounds and levels from selected model
  const temperatureBounds = useMemo(() => {
    // Get temperature bounds from selected model in model_mapping, fallback to agentDetail
    const selectedModelId = draftState.modelId;
    let lower = 0.0;
    let upper = 1.0;
    let levels: Array<{ id: string; temperature: string; is_upper: boolean }> =
      [];

    if (selectedModelId && modelMapping && selectedModelId in modelMapping) {
      const modelInfo = modelMapping[selectedModelId];
      if (modelInfo) {
        // Read temperature bounds and levels from model_mapping (type-safe)
        lower =
          typeof modelInfo.temperature_lower === "number"
            ? modelInfo.temperature_lower
            : 0.0;
        upper =
          typeof modelInfo.temperature_upper === "number"
            ? modelInfo.temperature_upper
            : 1.0;
        const tempLevels = modelInfo.temperature_levels;
        // Handle both dict and array formats (backward compatibility)
        if (tempLevels && typeof tempLevels === "object") {
          const levelsArray = Array.isArray(tempLevels)
            ? tempLevels
            : Object.values(tempLevels);
          if (levelsArray.length > 0) {
            levels = levelsArray.map((l) => {
              const levelObj = l as Record<string, string | boolean>;
              return {
                id: String(levelObj["id"] || ""),
                temperature: String(levelObj["temperature"] || ""),
                is_upper: Boolean(levelObj["is_upper"] || false),
              };
            });
          }
        }
      }
    }

    // Fallback to agentDetail if no model selected or model doesn't have data
    if (levels.length === 0) {
      const agentDetailData = isEditMode ? agentDetail : agentDetailDefault;
      const agentDetailWithLevels =
        agentDetailData as typeof agentDetailData & {
          temperature_levels?: Array<{
            id: string;
            temperature: string;
            is_upper: boolean;
          }>;
        };
      const tempLevels = agentDetailWithLevels?.temperature_levels;
      // Handle both dict and array formats (backward compatibility)
      levels = Array.isArray(tempLevels)
        ? (tempLevels as Array<{
            id: string;
            temperature: string;
            is_upper: boolean;
          }>)
        : tempLevels && typeof tempLevels === "object"
          ? (Object.values(tempLevels) as Array<{
              id: string;
              temperature: string;
              is_upper: boolean;
            }>)
          : [];
      const agentDetailWithTemp = agentDetailData as typeof agentDetailData & {
        temperature_lower?: number | null;
        temperature_upper?: number | null;
      };
      lower = agentDetailWithTemp?.temperature_lower ?? 0.0;
      upper = agentDetailWithTemp?.temperature_upper ?? 1.0;
    }

    const values = levels
      .filter((l) => !l.is_upper)
      .map((l) => l.temperature?.toString() || "")
      .filter(Boolean);

    return {
      lower,
      upper,
      values: values.length > 0 ? values : [],
      levels: levels,
    };
  }, [
    isEditMode,
    agentDetail,
    agentDetailDefault,
    draftState.modelId,
    modelMapping,
  ]);

  // Helper to get available voice IDs and names
  const availableVoices = useMemo(() => {
    // Get voices from selected model in model_mapping, not from agentDetail
    const selectedModelId = draftState.modelId;
    let voices: Array<{ id: string; voice: string }> = [];

    if (selectedModelId && modelMapping && selectedModelId in modelMapping) {
      const modelInfo = modelMapping[selectedModelId];
      if (modelInfo && "available_voices" in modelInfo) {
        const modelVoices = (
          modelInfo as typeof modelInfo & {
            available_voices?:
              | Array<{ id: string; voice: string }>
              | Record<string, { id: string; voice: string }>;
          }
        ).available_voices;
        // Handle both dict and array formats (backward compatibility)
        if (modelVoices && typeof modelVoices === "object") {
          const voicesArray = Array.isArray(modelVoices)
            ? modelVoices
            : Object.values(modelVoices);
          voices = voicesArray.map((v) => ({
            id: String(v["id"] || ""),
            voice: String(v["voice"] || ""),
          }));
        }
      }
    }

    // Fallback to agentDetail if no model selected or model doesn't have voices
    if (voices.length === 0 && agentDetail?.available_voices) {
      const agentVoices = agentDetail.available_voices;
      // Handle both dict and array formats (backward compatibility)
      const voicesArray = Array.isArray(agentVoices)
        ? agentVoices
        : agentVoices && typeof agentVoices === "object"
          ? Object.values(agentVoices)
          : [];
      voices = voicesArray.map((v) => {
        const voiceItem = v as { id?: string; voice?: string };
        return {
          id: voiceItem.id || "",
          voice: voiceItem.voice || "",
        };
      });
    }

    return voices;
  }, [draftState.modelId, modelMapping, agentDetail?.available_voices]);

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
    if (agentDetail?.name && agentId && isEditMode) {
      setEntityMetadata({
        entityId: agentId,
        entityName: agentDetail.name,
        entityType: "agent",
      });
    }
    return () => clearEntityMetadata();
  }, [
    agentDetail,
    agentId,
    isEditMode,
    setEntityMetadata,
    clearEntityMetadata,
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
        resetFields: ["model_temperature_level_id"] as string[],
      });

      if (selectedModelCapabilities.has_text_output) {
        configSteps.push({
          id: "reasoning",
          title: "Reasoning Effort",
          description: "Configure the reasoning effort level.",
          optional: true,
          resetFields: ["model_reasoning_level_id"] as string[],
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
          resetFields: ["model_voice_ids"] as string[],
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
          case "model_temperature_level_id":
            resetUpdates.model_temperature_level_id =
              initialDraftState.model_temperature_level_id;
            break;
          case "model_reasoning_level_id":
            resetUpdates.model_reasoning_level_id =
              initialDraftState.model_reasoning_level_id;
            break;
          case "model_voice_ids":
            resetUpdates.model_voice_ids = initialDraftState.model_voice_ids;
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
          await handleSaveAgent({
            input_agent_id: isEditMode ? agentId : null,
            name: draftState.name!,
            description: draftState.description || null,
            model_id: draftState.modelId!.trim(),
            prompt_id: shouldCreateNewPrompt
              ? null
              : draftState.promptId || null,
            system_prompt: draftState.systemPrompt!,
            instructions_id: null, // Not used for agents
            active_flag_id: null, // Will be set based on active boolean
            department_ids: finalDepartmentIds,
            artifact_name: draftState.role || "assistant",
            temperature_level_id:
              draftState.model_temperature_level_id || null,
            reasoning_level_id:
              draftState.model_reasoning_level_id || null,
            voice_ids:
              draftState.model_voice_ids &&
              draftState.model_voice_ids.length > 0
                ? draftState.model_voice_ids
                : [],
          });
          toast.success(`Agent ${isEditMode ? "updated" : "created"} successfully!`);
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

  return (
    <TooltipProvider>
      <div className="space-y-6 py-4 px-4">
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
                  Agent is read-only
                </h3>
                <div className="mt-2 text-sm text-muted-foreground">
                  <p>
                    {agentData?.department_ids?.length === 0
                      ? "This is a default agent that cannot be edited. You can view the details but cannot make changes."
                      : "This agent cannot be edited. You can view the details but cannot make changes."}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
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
                      editableTitle={{
                        value: draftState.name || "New Agent",
                        onChange: (value) => {
                          setDraftState((prev) => ({
                            ...prev,
                            name: value || "New Agent",
                          }));
                        },
                        placeholder: "New Agent",
                        defaultName: "New Agent",
                        required: true,
                      }}
                      resetFields={[
                        "name",
                        "description",
                        "active",
                        "departmentIds",
                      ]}
                      {...(onReset ? { onReset } : {})}
                      resetLabel="Reset"
                    >
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="description">Description *</Label>
                          <Textarea
                            id="description"
                            data-testid="input-agent-description"
                            value={draftState.description || ""}
                            onChange={(e) => {
                              setDraftState((prev) => ({
                                ...prev,
                                description: e.target.value,
                              }));
                              if (errors.description) {
                                setErrors((prev) => {
                                  const { description: _, ...rest } = prev;
                                  return rest;
                                });
                              }
                            }}
                            placeholder="Detailed behavior description and personality traits"
                            rows={4}
                            className={cn(
                              errors?.description && "border-destructive"
                            )}
                            disabled={isReadonly}
                            required
                          />
                          {errors?.description && (
                            <p className="text-sm text-destructive">
                              {errors.description}
                            </p>
                          )}
                        </div>

                        {/* Department Selection */}
                        {agentData?.valid_department_ids &&
                        agentData.valid_department_ids.length > 1 ? (
                          <div className="space-y-2">
                            <Label htmlFor="department">Department</Label>
                            <GenericPicker
                              items={departmentMapping}
                              itemIds={agentData.valid_department_ids}
                              selectedIds={draftState.departmentIds || []}
                              onSelect={(ids) => {
                                setDraftState((prev) => ({
                                  ...prev,
                                  departmentIds: ids,
                                }));
                              }}
                              getId={(dept) =>
                                (dept as unknown as { id: string }).id
                              }
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
                        ) : null}

                        {/* Active Switch */}
                        <div className="space-y-2 pt-2">
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
                                checked={draftState.active ?? true}
                                onCheckedChange={(checked) => {
                                  setDraftState((prev) => ({
                                    ...prev,
                                    active: checked,
                                  }));
                                }}
                                disabled={isReadonly}
                              />
                            </div>
                            <p className="text-xs text-muted-foreground pl-5">
                              Inactive agents will not be available to perform
                              operations for departments
                            </p>
                          </div>
                        </div>
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

                  // Compute current temperature from level_id (computed directly, not with useMemo inside callback)
                  let currentTemperature = 0.7;
                  if (
                    draftState.modelId &&
                    draftState.model_temperature_level_id &&
                    temperatureBounds.levels.length > 0
                  ) {
                    const level = temperatureBounds.levels.find(
                      (l) =>
                        l.id === draftState.model_temperature_level_id &&
                        !l.is_upper
                    );
                    if (level) {
                      currentTemperature = parseFloat(level.temperature);
                    }
                  }

                  // Helper to get temperature level ID from temperature value
                  const getTemperatureLevelId = (
                    temp: number
                  ): string | null => {
                    const matchingLevel = temperatureBounds.levels.find(
                      (l) =>
                        !l.is_upper &&
                        Math.abs(parseFloat(l.temperature) - temp) < 0.001
                    );
                    return matchingLevel?.id || null;
                  };

                  return (
                    <StepCard
                      stepStatus={stepStatus}
                      stepNumber={stepNumber}
                      stepTitle={stepTitle}
                      stepDescription={stepDescription}
                      isReadonly={isReadonly}
                      isEditMode={isEditMode}
                      resetFields={["model_temperature_level_id"]}
                      {...(onReset ? { onReset } : {})}
                      resetLabel="Reset"
                    >
                      <div className="space-y-2">
                        <Label htmlFor="temperature">
                          Temperature: {currentTemperature.toFixed(2)}
                        </Label>
                        {temperatureBounds.lower === temperatureBounds.upper ? (
                          <>
                            <Slider
                              id="temperature"
                              data-testid="temperature-slider"
                              min={temperatureBounds.lower}
                              max={temperatureBounds.upper}
                              step={0.01}
                              value={[currentTemperature]}
                              onValueChange={(value) => {
                                const tempValue =
                                  value[0] || temperatureBounds.lower;
                                const levelId =
                                  getTemperatureLevelId(tempValue);
                                setDraftState((prev) => ({
                                  ...prev,
                                  model_temperature_level_id: levelId,
                                }));
                              }}
                              className="w-full"
                              disabled={isReadonly}
                            />
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>
                                {temperatureBounds.lower.toFixed(2)}{" "}
                                (Deterministic)
                              </span>
                              <span>
                                {temperatureBounds.upper.toFixed(2)} (Creative)
                              </span>
                            </div>
                          </>
                        ) : (
                          <>
                            <Slider
                              id="temperature"
                              data-testid="temperature-slider"
                              min={temperatureBounds.lower}
                              max={temperatureBounds.upper}
                              step={0.01}
                              value={[currentTemperature]}
                              onValueChange={(value) => {
                                const tempValue = value[0] || 0;
                                const levelId =
                                  getTemperatureLevelId(tempValue);
                                setDraftState((prev) => ({
                                  ...prev,
                                  model_temperature_level_id: levelId,
                                }));
                              }}
                              className="w-full"
                              disabled={isReadonly}
                            />
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>
                                {temperatureBounds.lower.toFixed(2)}{" "}
                                (Deterministic)
                              </span>
                              <span>
                                {temperatureBounds.upper.toFixed(2)} (Creative)
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                    </StepCard>
                  );
                }

                case "reasoning": {
                  if (!selectedModelCapabilities?.has_text_output) return null;

                  const reasoningSearch =
                    (stepFormData["reasoningSearch"] as string) || "";

                  // Get reasoning options from selected model in model_mapping, fallback to agentDetail
                  // Get reasoning options from selected model in model_mapping, fallback to agentDetail (computed directly, not with useMemo inside callback)
                  let reasoningOptions: Array<{
                    id: string;
                    reasoning_level: string;
                  }> = [];
                  const selectedModelId = draftState.modelId;
                  if (
                    selectedModelId &&
                    modelMapping &&
                    selectedModelId in modelMapping
                  ) {
                    const modelInfo = modelMapping[selectedModelId];
                    if (
                      modelInfo?.reasoning_options &&
                      typeof modelInfo.reasoning_options === "object"
                    ) {
                      const reasoningOptionsArray = Array.isArray(
                        modelInfo.reasoning_options
                      )
                        ? modelInfo.reasoning_options
                        : Object.values(modelInfo.reasoning_options);
                      if (reasoningOptionsArray.length > 0) {
                        reasoningOptions = reasoningOptionsArray.map((opt) => {
                          const optObj = opt as Record<string, string>;
                          return {
                            id: String(optObj["id"] || ""),
                            reasoning_level: String(
                              optObj["reasoning_level"] || ""
                            ),
                          };
                        }) as Array<{
                          id: string;
                          reasoning_level: string;
                        }>;
                      }
                    }
                  }
                  // Fallback to agentDetail
                  if (reasoningOptions.length === 0) {
                    const agentReasoningOptions =
                      agentDetail?.reasoning_options;
                    if (
                      agentReasoningOptions &&
                      typeof agentReasoningOptions === "object"
                    ) {
                      const reasoningOptionsArray = Array.isArray(
                        agentReasoningOptions
                      )
                        ? agentReasoningOptions
                        : Object.values(agentReasoningOptions);
                      reasoningOptions = reasoningOptionsArray.map((opt) => {
                        const optObj = opt as Record<string, string>;
                        return {
                          id: String(optObj["id"] || ""),
                          reasoning_level: String(
                            optObj["reasoning_level"] || ""
                          ),
                        };
                      }) as Array<{
                        id: string;
                        reasoning_level: string;
                      }>;
                    }
                  }

                  // Helper to get reasoning option ID from reasoning level value
                  const getReasoningOptionId = (
                    reasoningLevel: string
                  ): string | null => {
                    const mapping = new Map<string, string>();
                    reasoningOptions.forEach((opt) => {
                      if (opt.id && opt.reasoning_level) {
                        mapping.set(opt.reasoning_level, opt.id);
                      }
                    });
                    return mapping.get(reasoningLevel) || null;
                  };

                  // Helper to get reasoning level value from option ID
                  const getReasoningLevelFromId = (
                    optionId: string
                  ): string => {
                    const mapping = new Map<string, string>();
                    reasoningOptions.forEach((opt) => {
                      if (opt.id && opt.reasoning_level) {
                        mapping.set(opt.id, opt.reasoning_level);
                      }
                    });
                    return mapping.get(optionId) || "none";
                  };

                  const selectedReasoningLevel: string | null =
                    draftState.model_reasoning_level_id
                      ? getReasoningLevelFromId(
                          draftState.model_reasoning_level_id
                        )
                      : "none";

                  // Filter reasoning levels based on search term (computed directly, not with useMemo inside callback)
                  const availableReasoningLevels =
                    reasoningOptions && reasoningOptions.length > 0
                      ? reasoningOptions.map((opt) => opt.reasoning_level)
                      : ["none", "minimal", "low", "medium", "high"];

                  let filteredReasoningLevels = availableReasoningLevels;
                  if (reasoningSearch.trim()) {
                    const searchLower = reasoningSearch.toLowerCase();
                    filteredReasoningLevels = availableReasoningLevels.filter(
                      (level) => {
                        const mappingItem = reasoningMapping[level];
                        if (!mappingItem) return false;
                        const searchText =
                          `${mappingItem.name} ${mappingItem.description || ""}`.toLowerCase();
                        return searchText.includes(searchLower);
                      }
                    );
                  }

                  return (
                    <StepCard
                      stepStatus={stepStatus}
                      stepNumber={stepNumber}
                      stepTitle={stepTitle}
                      stepDescription={stepDescription}
                      isReadonly={isReadonly}
                      isEditMode={isEditMode}
                      searchTerm={reasoningSearch}
                      onSearchChange={(term) =>
                        setStepFormData({ reasoningSearch: term || null })
                      }
                      searchPlaceholder="Search reasoning effort..."
                      resetFields={["model_reasoning_level_id"]}
                      {...(onReset ? { onReset } : {})}
                      resetLabel="Reset"
                    >
                      <div className="grid grid-cols-4 gap-4 min-h-[272px] max-h-[272px] overflow-y-auto py-2">
                        {filteredReasoningLevels.map((level) => {
                          const mappingItem = reasoningMapping[level];
                          if (!mappingItem) return null;

                          const isSelected =
                            selectedReasoningLevel !== null &&
                            selectedReasoningLevel === level;

                          return (
                            <button
                              key={level}
                              type="button"
                              onClick={() => {
                                if (isReadonly) return;
                                const newLevel =
                                  selectedReasoningLevel === level
                                    ? null
                                    : level;
                                const optionId = newLevel
                                  ? getReasoningOptionId(newLevel)
                                  : null;
                                setDraftState((prev) => ({
                                  ...prev,
                                  model_reasoning_level_id: optionId,
                                }));
                              }}
                              disabled={isReadonly}
                              className={cn(
                                "relative flex flex-col gap-3 p-4 rounded-xl border bg-card text-card-foreground shadow-sm transition-all text-left",
                                "hover:shadow-md hover:bg-accent/50",
                                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                                "disabled:pointer-events-none disabled:opacity-50",
                                isSelected && "ring-2 ring-primary bg-accent"
                              )}
                            >
                              <div className="flex items-start gap-3">
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium text-sm">
                                    {mappingItem.name}
                                  </div>
                                  {mappingItem.description && (
                                    <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                      {mappingItem.description}
                                    </div>
                                  )}
                                </div>
                                {isSelected && (
                                  <Check className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
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

                  const voiceSearch =
                    (stepFormData["voiceSearch"] as string) || "";

                  // Compute selected voice IDs (computed directly, not with useMemo inside callback)
                  const selectedVoiceIds =
                    draftState.model_voice_ids &&
                    draftState.model_voice_ids.length > 0
                      ? availableVoices
                          .filter((v) =>
                            draftState.model_voice_ids.includes(v.id)
                          )
                          .map((v) => v.voice)
                      : [];

                  // Get available voice names from availableVoices
                  const availableVoiceNames = availableVoices.map(
                    (v) => v.voice
                  );

                  // Filter voices based on search term and availability
                  let filteredVoices = VOICES.filter((voice) =>
                    availableVoiceNames.includes(voice.id)
                  );

                  if (voiceSearch.trim()) {
                    const searchLower = voiceSearch.toLowerCase();
                    filteredVoices = filteredVoices.filter(
                      (voice) =>
                        voice.name.toLowerCase().includes(searchLower) ||
                        voice.id.toLowerCase().includes(searchLower)
                    );
                  }

                  return (
                    <StepCard
                      stepStatus={stepStatus}
                      stepNumber={stepNumber}
                      stepTitle={stepTitle}
                      stepDescription={stepDescription}
                      isReadonly={isReadonly}
                      isEditMode={isEditMode}
                      searchTerm={voiceSearch}
                      onSearchChange={(term) =>
                        setStepFormData({ voiceSearch: term || null })
                      }
                      searchPlaceholder="Search voices..."
                      resetFields={["model_voice_ids"]}
                      {...(onReset ? { onReset } : {})}
                      resetLabel="Reset"
                    >
                      <div className="grid grid-cols-4 gap-4 min-h-[272px] max-h-[272px] overflow-y-auto py-2">
                        {filteredVoices.map((voice) => {
                          const isSelected = selectedVoiceIds.includes(
                            voice.id
                          );

                          return (
                            <button
                              key={voice.id}
                              type="button"
                              onClick={() => {
                                if (isReadonly) return;
                                const newVoiceIds = isSelected
                                  ? selectedVoiceIds.filter(
                                      (id) => id !== voice.id
                                    )
                                  : [...selectedVoiceIds, voice.id];

                                // Map voice IDs back to option IDs
                                const selectedIds = availableVoices
                                  .filter((v) => newVoiceIds.includes(v.voice))
                                  .map((v) => v.id);

                                setDraftState((prev) => ({
                                  ...prev,
                                  model_voice_ids: selectedIds,
                                }));
                              }}
                              disabled={isReadonly}
                              className={cn(
                                "relative flex flex-col gap-3 p-4 rounded-xl border bg-card text-card-foreground shadow-sm transition-all text-left",
                                "hover:shadow-md hover:bg-accent/50",
                                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                                "disabled:pointer-events-none disabled:opacity-50",
                                isSelected && "ring-2 ring-primary bg-accent"
                              )}
                            >
                              <div className="flex items-start gap-3">
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium text-sm">
                                    {voice.name}
                                  </div>
                                </div>
                                {isSelected && (
                                  <Check className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
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
