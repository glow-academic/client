/**
 * SystemAgent.tsx
 * Used to create and edit system agents
 * @AshokSaravanan222 & @siladiea
 * 07/20/2025
 */
"use client";

import { useRouter } from "next/navigation";
import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import UnifiedPromptEditor from "@/components/common/editor/UnifiedPromptEditor";
import { AGENT_ROLES } from "@/components/common/forms/AgentRolePicker";
import { GenericPicker } from "@/components/common/forms/GenericPicker";
import {
  PromptInfo,
  PromptPicker,
} from "@/components/common/forms/PromptPicker";
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
import { Input } from "@/components/ui/input";
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
import {
  getDefaultDepartmentIds,
  transformDepartmentIdsForSubmit,
} from "@/utils/department-picker-helpers";
import { Bug, Eye, Power, RotateCcw, Trash2 } from "lucide-react";
import AgentDebugInfo from "./AgentDebugInfo";

// Type-only import from server page
import type {
  AgentDetailOut,
  AgentNewOut,
  CreateAgentIn,
  CreateAgentOut,
  DeleteAgentPromptIn,
  DeleteAgentPromptOut,
  UpdateAgentIn,
  UpdateAgentOut,
} from "@/app/(main)/engine/agents/a/[agentId]/page";

// Extract model_mapping type from AgentDetailOut
// The API returns modalities in model_mapping, so we extract the actual type
type AgentModelMapping = NonNullable<AgentDetailOut["model_mapping"]>;
type AgentModelMappingItem = AgentModelMapping[string];

interface SystemAgentFormData {
  name?: string;
  description?: string;
  systemPrompt?: string;
  promptId?: string | null;
  modelId?: string;
  active?: boolean;
  role?: string; // agent_role enum value
  departmentIds?: string[]; // None = cross-department (superadmin only)
  // Option IDs from model tables
  model_temperature_level_id?: string | null;
  model_reasoning_level_id?: string | null;
  model_voice_ids?: string[];
  // Display values (for backward compatibility and UI)
  temperature?: number;
  reasoning?: "none" | "minimal" | "low" | "medium" | "high";
  voices?: string[];
}

export interface SystemAgentProps {
  agentId?: string;
  // Optional server-provided data and actions (for server-side rendering)
  agentDetail?: AgentDetailOut;
  agentDetailDefault?: AgentNewOut;
  createAgentAction?: (input: CreateAgentIn) => Promise<CreateAgentOut>;
  updateAgentAction?: (input: UpdateAgentIn) => Promise<UpdateAgentOut>;
  deleteAgentPromptAction?: (
    input: DeleteAgentPromptIn
  ) => Promise<DeleteAgentPromptOut>;
}

interface FormErrors {
  name?: string;
  description?: string;
  systemPrompt?: string;
  modelId?: string;
}

export default function SystemAgent({
  agentId,
  agentDetail: serverAgentDetail,
  agentDetailDefault: serverAgentDetailDefault,
  createAgentAction,
  updateAgentAction,
  deleteAgentPromptAction,
}: SystemAgentProps) {
  const router = useRouter();
  const { effectiveProfile } = useProfile();
  const { setEntityMetadata, clearEntityMetadata } = useBreadcrumbContext();
  const isSuperadmin = effectiveProfile?.role === "superadmin";

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<SystemAgentFormData>();
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

  const isEditMode = !!agentId;

  // Use server-provided data (no React Query needed when server data is provided)
  const agentDetail = serverAgentDetail;
  const agentDetailDefault = serverAgentDetailDefault;
  const agentData = isEditMode ? agentDetail : agentDetailDefault;

  // Extract body types from server action types for type safety
  type CreateAgentBody = CreateAgentIn extends { body: infer B } ? B : never;
  type UpdateAgentBody = UpdateAgentIn extends { body: infer B } ? B : never;
  type DeleteAgentPromptBody = DeleteAgentPromptIn extends { body: infer B }
    ? B
    : never;

  // Use server actions directly (no mutations needed)
  const handleCreateAgent = async (body: CreateAgentBody) => {
    if (!createAgentAction) {
      throw new Error("createAgentAction is required");
    }
    await createAgentAction({ body });
  };

  const handleUpdateAgent = async (body: UpdateAgentBody) => {
    if (!updateAgentAction) {
      throw new Error("updateAgentAction is required");
    }
    await updateAgentAction({ body });
  };

  const handleDeleteAgentPrompt = async (body: DeleteAgentPromptBody) => {
    if (!deleteAgentPromptAction) {
      throw new Error("deleteAgentPromptAction is required");
    }
    await deleteAgentPromptAction({ body });
  };

  // Get temperature bounds and levels from selected model
  const temperatureBounds = useMemo(() => {
    const agentDetailData = isEditMode ? agentDetail : agentDetailDefault;
    const agentDetailWithLevels = agentDetailData as typeof agentDetailData & {
      temperature_levels?: Array<{
        id: string;
        temperature: string;
        is_upper: boolean;
      }>;
    };
    const levels = (agentDetailWithLevels?.temperature_levels || []) as Array<{
      id: string;
      temperature: string;
      is_upper: boolean;
    }>;
    const values = levels
      .filter((l) => !l.is_upper)
      .map((l) => l.temperature?.toString() || "")
      .filter(Boolean);

    return {
      lower: agentDetailData?.temperature_lower ?? 0.0,
      upper: agentDetailData?.temperature_upper ?? 1.0,
      values: values.length > 0 ? values : [],
      levels: levels,
    };
  }, [isEditMode, agentDetail, agentDetailDefault]);

  // Helper to get temperature level ID from temperature value
  const getTemperatureLevelId = useMemo(() => {
    const levels = temperatureBounds.levels || [];
    return (temperature: number) => {
      // Find the closest matching level (prefer non-upper bounds)
      const matchingLevel = levels.find(
        (l) =>
          !l.is_upper &&
          Math.abs(parseFloat(l.temperature) - temperature) < 0.001
      );
      return matchingLevel?.id || null;
    };
  }, [temperatureBounds.levels]);

  // Helper to get reasoning option ID from reasoning level value
  const getReasoningOptionId = useMemo(() => {
    const options = (agentDetail?.reasoning_options || []) as Array<{
      id: string;
      reasoning_level: string;
    }>;
    const mapping = new Map<string, string>();
    options.forEach((opt) => {
      if (opt.id && opt.reasoning_level) {
        mapping.set(opt.reasoning_level, opt.id);
      }
    });
    return (reasoningLevel: string) => mapping.get(reasoningLevel) || null;
  }, [agentDetail?.reasoning_options]);

  // Helper to get reasoning level value from option ID
  const getReasoningLevelFromId = useMemo(() => {
    const options = (agentDetail?.reasoning_options || []) as Array<{
      id: string;
      reasoning_level: string;
    }>;
    const mapping = new Map<string, string>();
    options.forEach((opt) => {
      if (opt.id && opt.reasoning_level) {
        mapping.set(opt.id, opt.reasoning_level);
      }
    });
    return (optionId: string) => mapping.get(optionId) || "none";
  }, [agentDetail?.reasoning_options]);

  // Helper to get available voice IDs and names
  const availableVoices = useMemo(() => {
    const voices = (agentDetail?.available_voices || []) as Array<{
      id: string;
      voice: string;
    }>;
    return voices.map((v) => ({
      id: v.id || "",
      voice: v.voice || "",
    }));
  }, [agentDetail?.available_voices]);

  // Filter prompt_mapping client-side based on selected departments from form
  // API returns all prompts user has access to, then we filter by selected departments
  // When "All Departments" selected (empty array): Show ALL prompts (default + all department-specific)
  // When specific departments selected: Show default + prompts for those departments
  const filteredPromptMapping = useMemo(() => {
    if (!isEditMode || !agentDetail?.prompt_mapping) {
      return agentDetail?.prompt_mapping || {};
    }

    const selectedDeptIds = formData?.departmentIds || [];
    const filtered: Record<string, PromptInfo> = {};

    for (const [promptId, promptInfoRaw] of Object.entries(
      agentDetail.prompt_mapping
    )) {
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
  }, [formData?.departmentIds, agentDetail?.prompt_mapping, isEditMode]);

  // Get default prompt content (from agent_prompts table)
  const defaultPromptContent = useMemo(() => {
    if (!isEditMode || !agentDetail?.prompt_id || !agentDetail?.prompt_mapping)
      return "";
    const defaultPrompt = agentDetail.prompt_mapping[agentDetail.prompt_id];
    return defaultPrompt?.system_prompt || "";
  }, [agentDetail, isEditMode]);

  // Get resolved prompt (what's actually saved/configured for selected departments from form)
  // This is what would be used in production for the selected department(s)
  const resolvedPrompt = useMemo(() => {
    if (!isEditMode || !agentDetail?.prompt_mapping) {
      return { promptId: null, content: "" };
    }

    const selectedDeptIds = formData?.departmentIds || [];
    if (selectedDeptIds.length === 0) {
      // "All Departments" - use default prompt
      return {
        promptId: agentDetail.prompt_id || null,
        content: defaultPromptContent,
      };
    }

    // For multiple departments, check if all have the same prompt
    const firstDeptId = selectedDeptIds[0]!;
    const firstPromptId =
      agentDetail.department_prompt_links?.[firstDeptId] ||
      agentDetail.prompt_id ||
      null;

    // Check if all selected departments have the same prompt
    const allSamePrompt = selectedDeptIds.every((deptId) => {
      const promptId =
        agentDetail.department_prompt_links?.[deptId] ||
        agentDetail.prompt_id ||
        null;
      return promptId === firstPromptId;
    });

    if (allSamePrompt && firstPromptId) {
      const promptInfo = agentDetail.prompt_mapping[firstPromptId];
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
    formData?.departmentIds,
    agentDetail?.prompt_mapping,
    agentDetail?.department_prompt_links,
    agentDetail?.prompt_id,
    defaultPromptContent,
    isEditMode,
  ]);

  // Get resolved prompt content for change detection
  const resolvedPromptContent = useMemo(() => {
    return resolvedPrompt.content;
  }, [resolvedPrompt]);

  // Check if current prompt content differs from resolved prompt
  const hasPromptChanges = useMemo(() => {
    if (!formData?.systemPrompt) return false;
    return formData.systemPrompt !== resolvedPromptContent;
  }, [formData?.systemPrompt, resolvedPromptContent]);

  const defaultDepartmentIds = useMemo(
    () =>
      getDefaultDepartmentIds(
        isSuperadmin,
        effectiveProfile?.primaryDepartmentId ?? null
      ),
    [isSuperadmin, effectiveProfile?.primaryDepartmentId]
  );

  // Helper function to get required modalities based on agent_type
  const getRequiredModalities = (
    agentType: string
  ): {
    input: string[];
    output: string[];
  } => {
    switch (agentType) {
      case "simulation-text":
      case "hint":
      case "question":
      case "outline":
      case "scenario":
      case "grade":
      case "document":
      case "classify":
      case "eval":
        return { input: ["text"], output: ["text"] };
      case "simulation-voice":
        return { input: ["text", "audio"], output: ["text", "audio"] };
      case "image":
        return { input: [], output: ["image"] };
      case "video":
        return { input: [], output: ["video"] };
      default:
        return { input: ["text"], output: ["text"] };
    }
  };

  // Type-safe model mapping - use the actual type from AgentDetailOut
  const modelMapping = useMemo((): AgentModelMapping => {
    return (
      (agentData?.model_mapping as AgentModelMapping) ||
      ({} as AgentModelMapping)
    );
  }, [agentData?.model_mapping]);

  // Helper to extract modalities from model info
  // The API returns input_modalities and output_modalities as separate fields
  const getModelModalities = (
    modelInfo: AgentModelMappingItem | undefined
  ): { input: string[]; output: string[] } => {
    if (!modelInfo) return { input: [], output: [] };

    // Type assertion needed because the OpenAPI schema may not be fully updated
    // but the runtime data includes these fields
    const modelInfoWithModalities = modelInfo as AgentModelMappingItem & {
      input_modalities?: string[];
      output_modalities?: string[];
      modalities?: {
        input: string[];
        output: string[];
      };
    };

    // New format: separate fields (from our API update)
    if (
      modelInfoWithModalities.input_modalities ||
      modelInfoWithModalities.output_modalities
    ) {
      return {
        input: modelInfoWithModalities.input_modalities || [],
        output: modelInfoWithModalities.output_modalities || [],
      };
    }

    // Old format: nested modalities object (backward compatibility)
    if (modelInfoWithModalities.modalities) {
      return {
        input: modelInfoWithModalities.modalities.input || [],
        output: modelInfoWithModalities.modalities.output || [],
      };
    }

    return { input: [], output: [] };
  };

  // Filter valid_model_ids based on agent_type modality requirements
  const filteredValidModelIds = useMemo(() => {
    if (!formData?.role || !agentData?.valid_model_ids || !modelMapping) {
      return agentData?.valid_model_ids || [];
    }

    const requiredModalities = getRequiredModalities(formData.role);
    const filtered: string[] = [];

    for (const modelId of agentData.valid_model_ids) {
      const modelInfo = modelMapping[modelId];
      if (!modelInfo) continue;

      const { input: modelInputMods, output: modelOutputMods } =
        getModelModalities(modelInfo);

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
  }, [formData?.role, agentData?.valid_model_ids, modelMapping]);

  // Get selected model capabilities
  const selectedModelCapabilities = useMemo(() => {
    if (!formData?.modelId || !modelMapping) {
      return null;
    }

    const modelInfo = modelMapping[formData.modelId];
    if (!modelInfo) return null;

    const { input: inputMods, output: outputMods } =
      getModelModalities(modelInfo);

    return {
      input_modalities: inputMods,
      output_modalities: outputMods,
      has_text_output: outputMods.includes("text"),
      has_audio_output: outputMods.includes("audio"),
      has_image_output: outputMods.includes("image"),
      has_video_output: outputMods.includes("video"),
    };
  }, [formData?.modelId, modelMapping]);

  const initialFormData: SystemAgentFormData = useMemo(
    () => ({
      name: "",
      description: "",
      systemPrompt: "",
      promptId: null,
      modelId: "",
      active: true,
      role: "assistant", // Default role
      departmentIds: defaultDepartmentIds,
      model_temperature_level_id: null,
      model_reasoning_level_id: null,
      model_voice_ids: [],
      temperature: 0.7,
      reasoning: "none",
      voices: [],
    }),
    [defaultDepartmentIds]
  );

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

  useEffect(() => {
    if (isEditMode && agentDetail) {
      // Ensure modelId is set - use agent's model_id or first valid model
      const defaultModelId =
        agentDetail.model_id ||
        (agentDetail.valid_model_ids && agentDetail.valid_model_ids.length > 0
          ? agentDetail.valid_model_ids[0]
          : "");

      const deptIds = agentDetail.department_ids || [];
      setFormData({
        name: agentDetail.name,
        description: agentDetail.description,
        systemPrompt: agentDetail.system_prompt,
        promptId: agentDetail.prompt_id || null,
        modelId: defaultModelId || "",
        active: agentDetail.active ?? true,
        role: agentDetail.role || "assistant",
        departmentIds: deptIds,
        // Option IDs
        model_temperature_level_id:
          agentDetail.selected_temperature_level_id || null,
        model_reasoning_level_id:
          agentDetail.selected_reasoning_level_id || null,
        model_voice_ids: agentDetail.selected_voice_ids || [],
        // Display values (for backward compatibility)
        temperature: agentDetail.temperature,
        reasoning:
          (agentDetail.reasoning as
            | "minimal"
            | "low"
            | "medium"
            | "high"
            | undefined) || "none",
        voices: agentDetail.valid_voices || [],
      });
      // Initialize the ref for department change tracking
      prevDepartmentIdsRef.current = [...deptIds];
    } else if (!isEditMode && agentDetailDefault) {
      // For create mode, use defaults from API response
      // Ensure modelId is set - use default from API or first valid model
      const defaultModelId =
        agentDetailDefault.model_id ||
        (agentDetailDefault.valid_model_ids &&
        agentDetailDefault.valid_model_ids.length > 0
          ? agentDetailDefault.valid_model_ids[0]
          : "");

      setFormData({
        ...initialFormData,
        modelId: defaultModelId || "",
        systemPrompt:
          agentDetailDefault.system_prompt ||
          initialFormData.systemPrompt ||
          "",
        promptId: null,
        role: agentDetailDefault.role || "assistant",
        departmentIds:
          agentDetailDefault.department_ids?.length > 0
            ? agentDetailDefault.department_ids
            : defaultDepartmentIds,
        // Option IDs (empty for new agents)
        model_temperature_level_id: null,
        model_reasoning_level_id: null,
        model_voice_ids: [],
        // Display values
        temperature:
          agentDetailDefault.temperature ?? initialFormData.temperature ?? 0.7,
        reasoning: "none",
        voices: [],
      });
    }
  }, [
    isEditMode,
    agentDetail,
    agentDetailDefault,
    initialFormData,
    defaultDepartmentIds,
  ]);

  // Update prompt when department selection changes
  // Update prompt when department selection changes in form
  useEffect(() => {
    if (!isEditMode || !agentDetail || !formData?.departmentIds) return;

    // Track department changes - compare arrays
    const prevIds = prevDepartmentIdsRef.current;
    const currentIds = formData.departmentIds || [];
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
      setFormData((prev) => ({
        ...prev,
        promptId: resolvedPrompt.promptId,
        systemPrompt: resolvedPrompt.content,
      }));
    }
  }, [
    formData?.departmentIds,
    agentDetail,
    isEditMode,
    resolvedPrompt,
    hasPromptChanges,
  ]);

  const handleInputChange = (
    field: keyof SystemAgentFormData,
    value: string | number | boolean | string[] | null | undefined
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const resetFormAndState = () => {
    setFormData(initialFormData);
    setErrors({});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData?.name) {
      setErrors((prev) => ({ ...prev, name: "Agent name is required" }));
      return;
    }

    if (!formData?.description) {
      setErrors((prev) => ({
        ...prev,
        description: "Agent description is required",
      }));
      return;
    }

    if (!formData?.systemPrompt) {
      setErrors((prev) => ({
        ...prev,
        systemPrompt: "System prompt is required",
      }));
      return;
    }

    if (!formData?.modelId || formData.modelId.trim().length === 0) {
      setErrors((prev) => ({
        ...prev,
        modelId: "Model selection is required",
      }));
      return;
    }

    setIsSubmitting(true);

    try {
      const validDepartmentIds = agentData?.valid_department_ids || [];
      const finalDepartmentIds = transformDepartmentIdsForSubmit(
        formData.departmentIds || [],
        isSuperadmin,
        validDepartmentIds
      );

      if (isEditMode && agentId && agentDetail) {
        // Safety check: Only create/update overrides for departments that:
        // 1. Don't have an override yet (use default), OR
        // 2. Are the only department selected, OR
        // 3. All selected departments share the same existing override prompt
        const selectedDeptIds = formData.departmentIds || [];
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
              const departmentPromptLinks =
                agentDetail?.department_prompt_links || {};
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

        // Update existing agent using v3 API
        // Ensure profileId exists - required for API calls
        if (!effectiveProfile?.id) {
          toast.error("Profile not loaded. Please refresh the page.");
          setIsSubmitting(false);
          return;
        }

        // Note: profileId is added by the server action
        await handleUpdateAgent({
          agentId,
          name: formData.name!,
          description: formData.description!,
          prompt_id: shouldCreateNewPrompt ? null : formData.promptId || null,
          system_prompt: formData.systemPrompt!,
          model_id: formData.modelId!.trim(),
          active: formData.active ?? true,
          role: formData.role || "assistant",
          department_ids: finalDepartmentIds,
          department_ids_for_prompt: departmentsForPromptOverride,
          model_temperature_level_id:
            formData.model_temperature_level_id || null,
          model_reasoning_level_id: formData.model_reasoning_level_id || null,
          model_voice_ids:
            formData.model_voice_ids && formData.model_voice_ids.length > 0
              ? formData.model_voice_ids
              : null,
          profileId: effectiveProfile.id,
        });
        toast.success("Agent updated successfully!");
        resetFormAndState();
        router.push("/engine/agents");
        setIsSubmitting(false);
      } else {
        // Ensure profileId exists - required for API calls
        if (!effectiveProfile?.id) {
          toast.error("Profile not loaded. Please refresh the page.");
          setIsSubmitting(false);
          return;
        }

        // Create new agent using v3 API
        // Note: profileId is added by the server action
        await handleCreateAgent({
          name: formData.name!,
          description: formData.description!,
          prompt_id: formData.promptId || null,
          system_prompt: formData.systemPrompt!,
          model_id: formData.modelId!.trim(),
          active: formData.active ?? true,
          role: formData.role || "assistant",
          department_ids: finalDepartmentIds,
          model_temperature_level_id:
            formData.model_temperature_level_id || null,
          model_reasoning_level_id: formData.model_reasoning_level_id || null,
          model_voice_ids:
            formData.model_voice_ids && formData.model_voice_ids.length > 0
              ? formData.model_voice_ids
              : null,
          profileId: effectiveProfile.id,
        });
        toast.success("Agent created successfully!");
        resetFormAndState();
        router.push(`/engine/agents`);
        setIsSubmitting(false);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      toast.error(
        `Failed to ${isEditMode ? "update" : "create"} agent: ${msg}`
      );
      setIsSubmitting(false);
    }
  };

  const isReadonly = useMemo(() => {
    if (!isEditMode) return false;
    if (!agentData) return true;
    return !agentData.can_edit;
  }, [isEditMode, agentData]);

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
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Agent Name *</Label>
              {formData?.name !== undefined ? (
                <Input
                  id="name"
                  data-testid="input-agent-name"
                  value={formData.name}
                  onChange={(e) => handleInputChange("name", e.target.value)}
                  placeholder="e.g., Enthusiastic Student Agent"
                  className={errors.name ? "border-destructive" : ""}
                  required
                />
              ) : null}
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              {formData?.description !== undefined ? (
                <Textarea
                  id="description"
                  data-testid="input-agent-description"
                  value={formData.description}
                  onChange={(e) =>
                    handleInputChange("description", e.target.value)
                  }
                  placeholder="Detailed behavior description and personality traits"
                  rows={4}
                  className={errors.description ? "border-destructive" : ""}
                  required
                />
              ) : null}
              {errors.description && (
                <p className="text-sm text-destructive">{errors.description}</p>
              )}
            </div>

            {/* Role and Department Selection */}
            <div className="space-y-4">
              {/* Department Picker */}
              {agentData?.valid_department_ids &&
                agentData.valid_department_ids.length > 1 && (
                  <div className="space-y-2">
                    <Label htmlFor="department">Department</Label>
                    {formData?.departmentIds !== undefined &&
                    agentData?.department_mapping !== undefined ? (
                      <GenericPicker
                        items={agentData.department_mapping || {}}
                        itemIds={agentData.valid_department_ids || []}
                        selectedIds={formData.departmentIds || []}
                        onSelect={(ids) =>
                          setFormData((prev) => ({
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
                        disabled={isSubmitting}
                        multiSelect={true}
                        hideSelectedChips={true}
                        buttonClassName="w-full"
                      />
                    ) : null}
                  </div>
                )}

              {/* Role Picker */}
              <div className="space-y-2">
                <Label htmlFor="role">Role *</Label>
                {formData?.role !== undefined ? (
                  <GenericPicker
                    items={[...AGENT_ROLES]}
                    selectedIds={formData.role ? [formData.role] : []}
                    onSelect={(ids) => {
                      const role = ids[0] || "";
                      handleInputChange("role", role);
                      // If current model doesn't match new role requirements, reset modelId
                      const requiredModalities = getRequiredModalities(role);
                      const currentModelId = formData?.modelId;
                      if (currentModelId && modelMapping) {
                        const modelInfo = modelMapping[currentModelId];
                        if (modelInfo) {
                          const {
                            input: modelInputMods,
                            output: modelOutputMods,
                          } = getModelModalities(modelInfo);
                          const hasRequiredInput =
                            requiredModalities.input.every((mod) =>
                              modelInputMods.includes(mod)
                            );
                          const hasRequiredOutput =
                            requiredModalities.output.every((mod) =>
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
                                return (
                                  requiredModalities.input.every((mod) =>
                                    inputMods.includes(mod)
                                  ) &&
                                  requiredModalities.output.every((mod) =>
                                    outputMods.includes(mod)
                                  )
                                );
                              }) || [];
                            handleInputChange("modelId", filteredIds[0] || "");
                          }
                        }
                      }
                    }}
                    getId={(role) => (role as { id: string }).id}
                    getLabel={(role) => (role as { name: string }).name}
                    getSearchText={(role) =>
                      `${(role as { name: string }).name} ${(role as { description?: string }).description || ""}`
                    }
                    placeholder="Select role"
                    multiSelect={false}
                    hideSelectedChips={true}
                    buttonClassName="w-full"
                    groupHeading="Agent Roles"
                  />
                ) : null}
              </div>
            </div>

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
                  {formData?.active !== undefined ? (
                    <Switch
                      id="active"
                      checked={formData.active ?? true}
                      onCheckedChange={(checked) =>
                        handleInputChange("active", checked)
                      }
                    />
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground pl-5">
                  Inactive agents will not be available to perform operations
                  for departments
                </p>
              </div>
            </div>

            {/* Model, Reasoning Effort, and Temperature - Dynamic Grid */}
            <div
              className={`grid gap-4 ${
                selectedModelCapabilities?.has_text_output
                  ? "grid-cols-1 md:grid-cols-3"
                  : "grid-cols-1 md:grid-cols-2"
              }`}
            >
              {/* Model Selection - filtered by agent_type */}
              <div className="space-y-2">
                <Label htmlFor="modelId">
                  {formData?.role === "image"
                    ? "Image Model"
                    : formData?.role === "video"
                      ? "Video Model"
                      : formData?.role === "simulation-voice"
                        ? "Voice Model"
                        : "Text Model"}{" "}
                  *
                </Label>
                {formData?.modelId !== undefined ? (
                  <>
                    <GenericPicker
                      items={modelMapping}
                      itemIds={filteredValidModelIds}
                      selectedIds={formData?.modelId ? [formData.modelId] : []}
                      onSelect={(ids) => {
                        const newModelId = ids[0] || "";
                        handleInputChange("modelId", newModelId);
                        // If selected model doesn't support current reasoning level, reset to "none"
                        // This will be handled by conditional rendering below
                      }}
                      getId={(item) => (item as unknown as { id: string }).id}
                      getLabel={(item) => item.name || ""}
                      getSearchText={(item) =>
                        `${item.name} ${item.description || ""}`
                      }
                      renderPreview={(item) => (
                        <div className="grid gap-2">
                          <h4 className="font-medium leading-none">
                            {item.name || "No model selected"}
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
                      placeholder="Select a model"
                      multiSelect={false}
                      hideSelectedChips={true}
                      buttonClassName={
                        errors.modelId ? "border-destructive w-full" : "w-full"
                      }
                      groupHeading="Models"
                    />
                    {filteredValidModelIds.length === 0 && formData?.role && (
                      <p className="text-xs text-muted-foreground">
                        No models available for this agent type. Please select a
                        different role or configure models with the required
                        modalities.
                      </p>
                    )}
                    {errors.modelId && (
                      <p className="text-sm text-destructive">
                        {errors.modelId}
                      </p>
                    )}
                  </>
                ) : null}
              </div>

              {/* Reasoning Effort - Show only if model supports text output */}
              {selectedModelCapabilities?.has_text_output && (
                <div className="space-y-2">
                  <Label htmlFor="reasoning">Reasoning Effort</Label>
                  {formData?.model_reasoning_level_id !== undefined ? (
                    <GenericPicker
                      items={agentDetail?.reasoning_mapping || {}}
                      itemIds={
                        agentDetail?.reasoning_options &&
                        Array.isArray(agentDetail.reasoning_options) &&
                        agentDetail.reasoning_options.length > 0
                          ? (
                              agentDetail.reasoning_options as Array<{
                                id: string;
                                reasoning_level: string;
                              }>
                            ).map((opt) => opt.reasoning_level)
                          : ["none", "minimal", "low", "medium", "high"]
                      }
                      selectedIds={
                        formData.model_reasoning_level_id
                          ? [
                              getReasoningLevelFromId(
                                formData.model_reasoning_level_id
                              ),
                            ]
                          : formData.reasoning
                            ? [formData.reasoning]
                            : ["none"]
                      }
                      onSelect={(ids) => {
                        const reasoningLevel = ids[0] || "none";
                        const optionId = getReasoningOptionId(reasoningLevel);
                        handleInputChange("model_reasoning_level_id", optionId);
                        handleInputChange(
                          "reasoning",
                          reasoningLevel as
                            | "none"
                            | "minimal"
                            | "low"
                            | "medium"
                            | "high"
                        );
                      }}
                      getId={(item) => (item as unknown as { id: string }).id}
                      getLabel={(item) => item.name || ""}
                      getSearchText={(item) =>
                        `${item.name} ${item.description || ""}`
                      }
                      renderPreview={(item) => (
                        <div className="grid gap-2">
                          <h4 className="font-medium leading-none">
                            {item.name || "No level selected"}
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
                      placeholder="Select reasoning effort"
                      multiSelect={false}
                      hideSelectedChips={true}
                      buttonClassName="w-full"
                      groupHeading="Reasoning Effort"
                    />
                  ) : null}
                </div>
              )}

              {/* Voices - Show if model supports audio output */}
              {selectedModelCapabilities?.has_audio_output && (
                <div className="space-y-2">
                  <Label htmlFor="voices">Voices</Label>
                  {formData?.model_voice_ids !== undefined ? (
                    <GenericPicker
                      items={[...VOICES]}
                      selectedIds={
                        formData.model_voice_ids &&
                        formData.model_voice_ids.length > 0
                          ? availableVoices
                              .filter((v) =>
                                formData.model_voice_ids?.includes(v.id)
                              )
                              .map((v) => v.voice)
                          : formData.voices || []
                      }
                      onSelect={(voiceIds) => {
                        // Map voice IDs back to option IDs
                        const selectedIds = availableVoices
                          .filter((v) => voiceIds.includes(v.voice))
                          .map((v) => v.id);
                        handleInputChange("model_voice_ids", selectedIds);
                        handleInputChange("voices", voiceIds);
                      }}
                      getId={(item) => (item as { id: string }).id}
                      getLabel={(item) => (item as { name: string }).name}
                      getSearchText={(item) => (item as { name: string }).name}
                      disabled={isSubmitting || isReadonly}
                      multiSelect={true}
                      hideSelectedChips={true}
                      buttonClassName="w-full"
                      groupHeading="Voices"
                    />
                  ) : null}
                </div>
              )}

              {/* Temperature - Show only if model supports temperature configuration */}
              {selectedModelCapabilities && (
                <div className="space-y-2">
                  <Label htmlFor="temperature">
                    Temperature:{" "}
                    {formData?.temperature !== undefined
                      ? formData.temperature.toFixed(2)
                      : "0.00"}
                  </Label>
                  {formData?.temperature !== undefined ? (
                    <>
                      {temperatureBounds.values.length > 0 ? (
                        // Use dropdown picker if specific temperature values are provided
                        <select
                          id="temperature"
                          data-testid="temperature-picker"
                          value={formData.temperature?.toString() || "0.7"}
                          onChange={(e) => {
                            const tempValue = parseFloat(e.target.value);
                            const levelId = getTemperatureLevelId(tempValue);
                            handleInputChange("temperature", tempValue);
                            handleInputChange(
                              "model_temperature_level_id",
                              levelId
                            );
                          }}
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {temperatureBounds.values.map((val: string) => (
                            <option key={val} value={val}>
                              {parseFloat(val).toFixed(2)}
                            </option>
                          ))}
                        </select>
                      ) : (
                        // Use slider if temperature range is provided
                        <>
                          <Slider
                            id="temperature"
                            data-testid="temperature-slider"
                            min={temperatureBounds.lower}
                            max={temperatureBounds.upper}
                            step={0.01}
                            value={[formData?.temperature || 0]}
                            onValueChange={(value) => {
                              const tempValue = value[0] || 0;
                              const levelId = getTemperatureLevelId(tempValue);
                              handleInputChange("temperature", tempValue);
                              handleInputChange(
                                "model_temperature_level_id",
                                levelId
                              );
                            }}
                            className="w-full"
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
                    </>
                  ) : null}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="systemPrompt">System Prompt *</Label>
                <div className="flex gap-2">
                  {isEditMode &&
                    agentDetail &&
                    filteredPromptMapping &&
                    (Object.keys(filteredPromptMapping).length > 0 ||
                      (formData?.departmentIds &&
                        formData.departmentIds.length > 0)) && (
                      <PromptPicker
                        promptMapping={filteredPromptMapping}
                        selectedPromptId={formData?.promptId || null}
                        defaultPromptId={agentDetail?.prompt_id || null}
                        onSelect={(promptId) => {
                          if (promptId && filteredPromptMapping[promptId]) {
                            const prompt = filteredPromptMapping[promptId];
                            setFormData((prev) => ({
                              ...prev,
                              promptId: promptId,
                              systemPrompt: prompt.system_prompt,
                            }));
                          } else {
                            setFormData((prev) => ({
                              ...prev,
                              promptId: null,
                            }));
                          }
                        }}
                        placeholder="Select prompt..."
                        disabled={false}
                        buttonClassName="h-8"
                      />
                    )}
                  {formData?.systemPrompt !== undefined && (
                    <>
                      {hasPromptChanges && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() => {
                                setFormData((prev) => ({
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
                              editorMode === "preview" ? "default" : "secondary"
                            }
                            size="sm"
                            onClick={() =>
                              setEditorMode(
                                editorMode === "preview" ? "editor" : "preview"
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
                                editorMode === "debug" ? "default" : "secondary"
                              }
                              size="sm"
                              onClick={() =>
                                setEditorMode(
                                  editorMode === "debug" ? "editor" : "debug"
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
                        formData?.promptId &&
                        filteredPromptMapping[formData.promptId]
                          ?.can_delete && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={() => {
                                  const promptId = formData.promptId!;
                                  const promptInfo =
                                    filteredPromptMapping[promptId];
                                  if (!promptInfo) return;
                                  setPromptToDelete({
                                    promptId,
                                    isDepartmentSpecific:
                                      !!promptInfo.department_ids &&
                                      promptInfo.department_ids.length > 0,
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
                    </>
                  )}
                </div>
              </div>
              {formData?.systemPrompt !== undefined ? (
                <div className="h-[500px]" data-testid="editor-system-prompt">
                  <UnifiedPromptEditor
                    value={formData?.systemPrompt || ""}
                    onChange={(value) => {
                      handleInputChange("systemPrompt", value);
                      // Clear promptId when editing, indicating new prompt
                      setFormData((prev) => ({
                        ...prev,
                        promptId: null,
                      }));
                    }}
                    placeholder="System prompt that defines how the agent should behave and respond. You can use markdown formatting."
                    className="h-full"
                    debugContent={
                      isEditMode &&
                      agentDetail &&
                      effectiveProfile?.role === "superadmin" ? (
                        <AgentDebugInfo
                          debugInfo={agentDetail.debug_info}
                          modelMapping={agentDetail.model_mapping}
                        />
                      ) : undefined
                    }
                    activeMode={editorMode}
                  />
                </div>
              ) : null}
              <p className="text-sm text-muted-foreground">
                This prompt defines the agent's behavior and personality in
                conversations. You can use markdown formatting for better
                organization.
              </p>
              {errors.systemPrompt && (
                <p className="text-sm text-destructive">
                  {errors.systemPrompt}
                </p>
              )}
            </div>

            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                disabled={isSubmitting}
              >
                Back
              </Button>
              <Button
                type="submit"
                data-testid="btn-submit-agent"
                disabled={
                  isSubmitting || !createAgentAction || !updateAgentAction
                }
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    {isEditMode ? "Updating..." : "Creating..."}
                  </>
                ) : isEditMode ? (
                  "Update Agent"
                ) : (
                  "Create Agent"
                )}
              </Button>
            </div>
          </form>
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
                      agentId,
                      promptId: promptToDelete.promptId,
                      departmentId: promptToDelete.isDepartmentSpecific
                        ? formData?.departmentIds &&
                          formData.departmentIds.length > 0
                          ? formData.departmentIds[0]!
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
