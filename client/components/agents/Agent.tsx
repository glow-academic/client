/**
 * Agent.tsx
 * Used to create and edit system agents
 * @AshokSaravanan222 & @siladiea
 * 07/20/2025
 */
"use client";

import { useRouter } from "next/navigation";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { GenericPicker } from "@/components/common/forms/GenericPicker";
import { PromptInfo } from "@/components/common/forms/PromptPicker";
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
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useBreadcrumbContext } from "@/contexts/breadcrumb-context";
import { useProfile } from "@/contexts/profile-context";
import { cn } from "@/lib/utils";
import {
  getDefaultDepartmentIds,
  transformDepartmentIdsForSubmit,
} from "@/utils/department-picker-helpers";
import { Check, Power } from "lucide-react";
import { AgentModelSection } from "./AgentModelSection";
import { AgentPromptSection } from "./AgentPromptSection";
import { AgentReasoningSection } from "./AgentReasoningSection";
import { AgentRoleSection } from "./AgentRoleSection";
import { AgentTemperatureSection } from "./AgentTemperatureSection";
import { AgentVoiceSection } from "./AgentVoiceSection";

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
import type { OutputOf } from "@/lib/api/types";

// Extract model_mapping type from AgentDetailOut
// The API returns modalities in model_mapping, so we extract the actual type
type AgentModelMapping = NonNullable<AgentDetailOut["model_mapping"]>;
// Get the proper type from the OpenAPI schema - includes all fields (input_modalities, output_modalities, temperature_levels, reasoning_options, etc.)
type AgentModelMappingItem = OutputOf<
  "/api/v3/agents/detail",
  "post"
>["model_mapping"][string];

type StepStatus = "pending" | "active" | "completed";

interface Step {
  id: string;
  title: string;
  description: string;
  status: StepStatus;
  optional?: boolean;
}

interface AgentFormData {
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

export interface AgentProps {
  agentId?: string;
  // Optional server-provided data and actions (for server-side rendering)
  agentDetail?: AgentDetailOut;
  agentDetailDefault?: AgentNewOut;
  createAgentAction?: (input: CreateAgentIn) => Promise<CreateAgentOut>;
  updateAgentAction?: (input: UpdateAgentIn) => Promise<UpdateAgentOut>;
  deleteAgentPromptAction?: (
    input: DeleteAgentPromptIn,
  ) => Promise<DeleteAgentPromptOut>;
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
  createAgentAction,
  updateAgentAction,
  deleteAgentPromptAction,
}: AgentProps) {
  const router = useRouter();
  const { effectiveProfile } = useProfile();
  const { setEntityMetadata, clearEntityMetadata } = useBreadcrumbContext();
  const isSuperadmin = effectiveProfile?.role === "superadmin";

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<AgentFormData>();
  const [errors, setErrors] = useState<FormErrors>({});
  const [editorMode, setEditorMode] = useState<"editor" | "preview" | "debug">(
    "editor",
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

  // Type-safe model mapping - use the actual type from AgentDetailOut
  // Define this BEFORE temperatureBounds since temperatureBounds depends on it
  const modelMapping = useMemo((): AgentModelMapping => {
    const mapping =
      (agentData?.model_mapping as AgentModelMapping) ||
      ({} as AgentModelMapping);
    return mapping;
  }, [agentData?.model_mapping]);

  // Get temperature bounds and levels from selected model
  const temperatureBounds = useMemo(() => {
    // Get temperature bounds from selected model in model_mapping, fallback to agentDetail
    const selectedModelId = formData?.modelId;
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
        if (tempLevels && typeof tempLevels === 'object') {
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
        ? (tempLevels as Array<{ id: string; temperature: string; is_upper: boolean }>)
        : (tempLevels && typeof tempLevels === 'object'
            ? Object.values(tempLevels) as Array<{ id: string; temperature: string; is_upper: boolean }>
            : []);
      lower = agentDetailData?.temperature_lower ?? 0.0;
      upper = agentDetailData?.temperature_upper ?? 1.0;
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
    formData?.modelId,
    modelMapping,
  ]);

  // Helper to get available voice IDs and names
  const availableVoices = useMemo(() => {
    // Get voices from selected model in model_mapping, not from agentDetail
    const selectedModelId = formData?.modelId;
    let voices: Array<{ id: string; voice: string }> = [];

    if (selectedModelId && modelMapping && selectedModelId in modelMapping) {
      const modelInfo = modelMapping[selectedModelId];
      if (modelInfo && "available_voices" in modelInfo) {
        const modelVoices = (
          modelInfo as AgentModelMappingItem & {
            available_voices?: Array<{ id: string; voice: string }> | Record<string, { id: string; voice: string }>;
          }
        ).available_voices;
        // Handle both dict and array formats (backward compatibility)
        if (modelVoices && typeof modelVoices === 'object') {
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
        : (agentVoices && typeof agentVoices === 'object' ? Object.values(agentVoices) : []);
      voices = voicesArray.map((v) => ({
        id: v.id || "",
        voice: v.voice || "",
      }));
    }

    return voices;
  }, [formData?.modelId, modelMapping, agentDetail?.available_voices]);

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
      agentDetail.prompt_mapping,
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
            selectedDeptIds.includes(deptId),
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
        effectiveProfile?.primaryDepartmentId ?? null,
      ),
    [isSuperadmin, effectiveProfile?.primaryDepartmentId],
  );

  // Helper function to get required modalities based on agent_type
  const getRequiredModalities = (
    agentType: string,
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

  // Helper to extract modalities from model info
  // The API returns input_modalities and output_modalities as separate fields
  const getModelModalities = (
    modelInfo: AgentModelMappingItem | undefined,
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
    const modelInfoWithOldFormat = modelInfo as AgentModelMappingItem & {
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

      // Special rule: Models with audio input AND output should ONLY be available for simulation-voice role
      const hasAudioInput = modelInputMods.includes("audio");
      const hasAudioOutput = modelOutputMods.includes("audio");
      const isAudioModel = hasAudioInput && hasAudioOutput;

      if (isAudioModel && formData.role !== "simulation-voice") {
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
            modelOutputMods.includes(mod),
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
  }, [formData?.modelId, modelMapping]);

  const initialFormData: AgentFormData = useMemo(
    () => ({
      name: "New Agent",
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
    [defaultDepartmentIds],
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
      const formDataToSet = {
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
        reasoning: ((agentDetail.reasoning as
          | "none"
          | "minimal"
          | "low"
          | "medium"
          | "high"
          | undefined) || "none") as
          | "none"
          | "minimal"
          | "low"
          | "medium"
          | "high",
        voices: agentDetail.valid_voices || [],
      };
      setFormData(formDataToSet);
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
    field: keyof AgentFormData,
    value: string | number | boolean | string[] | null | undefined,
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
        validDepartmentIds,
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
                  (promptId) => promptId === existingPromptIds[0],
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
        });
        toast.success("Agent created successfully!");
        resetFormAndState();
        router.push(`/engine/agents`);
        setIsSubmitting(false);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      toast.error(
        `Failed to ${isEditMode ? "update" : "create"} agent: ${msg}`,
      );
      setIsSubmitting(false);
    }
  };

  const isReadonly = useMemo(() => {
    if (!isEditMode) return false;
    if (!agentData) return true;
    return !agentData.can_edit;
  }, [isEditMode, agentData]);

  // Step status logic
  const getStepStatus = useCallback(
    (stepId: string): StepStatus => {
      const hasRole = !!formData?.role;
      const hasModel = !!formData?.modelId?.trim();

      switch (stepId) {
        case "role":
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
          return formData?.systemPrompt?.trim() ? "completed" : "active";
        default:
          return "pending";
      }
    },
    [formData],
  );

  // Steps array
  const steps: Step[] = useMemo(() => {
    const baseSteps: Step[] = [
      {
        id: "role",
        title: "Role",
        description: "Select the agent role that defines its capabilities.",
        status: getStepStatus("role"),
      },
      {
        id: "model",
        title: "Model",
        description: "Select the AI model for this agent.",
        status: getStepStatus("model"),
      },
    ];

    // Conditionally add configuration steps based on model capabilities
    const configSteps: Step[] = [];

    if (selectedModelCapabilities) {
      configSteps.push({
        id: "temperature",
        title: "Temperature",
        description: "Configure the temperature setting for the model.",
        status: getStepStatus("temperature"),
        optional: true,
      });

      if (selectedModelCapabilities.has_text_output) {
        configSteps.push({
          id: "reasoning",
          title: "Reasoning Effort",
          description: "Configure the reasoning effort level.",
          status: getStepStatus("reasoning"),
          optional: true,
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
          status: getStepStatus("voice"),
          optional: true,
        });
      }
    }

    const promptStep: Step = {
      id: "prompt",
      title: "Prompt Instructions",
      description: "Define the system prompt that controls agent behavior.",
      status: getStepStatus("prompt"),
    };

    return [...baseSteps, ...configSteps, promptStep];
  }, [getStepStatus, selectedModelCapabilities]);

  // Handle role change - do NOT reset model when role is unselected
  const handleRoleChange = (roleId: string) => {
    handleInputChange("role", roleId);

    // If unselecting role (empty string), do NOT reset model - just update role
    if (!roleId || roleId === "") {
      return;
    }

    // If a role is selected, check if current model matches role requirements
    const requiredModalities = getRequiredModalities(roleId);
    const currentModelId = formData?.modelId;
    if (currentModelId && modelMapping) {
      const modelInfo = modelMapping[currentModelId];
      if (modelInfo) {
        const { input: modelInputMods, output: modelOutputMods } =
          getModelModalities(modelInfo);

        // Special rule: Audio models (with both audio input and output) should only work with simulation-voice
        const hasAudioInput = modelInputMods.includes("audio");
        const hasAudioOutput = modelOutputMods.includes("audio");
        const isAudioModel = hasAudioInput && hasAudioOutput;

        if (isAudioModel && roleId !== "simulation-voice") {
          // Reset model if audio model selected but role is not simulation-voice
          handleInputChange("modelId", "");
          return;
        }

        const hasRequiredInput = requiredModalities.input.every((mod) =>
          modelInputMods.includes(mod),
        );
        const hasRequiredOutput = requiredModalities.output.every((mod) =>
          modelOutputMods.includes(mod),
        );
        if (!hasRequiredInput || !hasRequiredOutput) {
          // Reset to first valid model or empty
          const filteredIds =
            agentData?.valid_model_ids?.filter((id) => {
              const info = modelMapping[id];
              if (!info) return false;
              const { input: inputMods, output: outputMods } =
                getModelModalities(info);

              // Special rule: Audio models only for simulation-voice
              const modelHasAudioInput = inputMods.includes("audio");
              const modelHasAudioOutput = outputMods.includes("audio");
              const modelIsAudio = modelHasAudioInput && modelHasAudioOutput;

              if (modelIsAudio && roleId !== "simulation-voice") {
                return false;
              }

              return (
                requiredModalities.input.every((mod) =>
                  inputMods.includes(mod),
                ) &&
                requiredModalities.output.every((mod) =>
                  outputMods.includes(mod),
                )
              );
            }) || [];
          handleInputChange("modelId", filteredIds[0] || "");
        }
      }
    }
  };
  // #endregion

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
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Step 1: Basic Information (Name, Description, Departments, Active) */}
            <Card className="transition-all">
              <CardContent className="pt-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium bg-green-500 text-white shrink-0">
                    <Check className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <input
                      type="text"
                      data-testid="input-agent-name"
                      value={formData?.name || ""}
                      onChange={(e) =>
                        handleInputChange("name", e.target.value)
                      }
                      onFocus={(e) => {
                        if (e.target.value === "New Agent") {
                          e.target.select();
                        }
                      }}
                      onBlur={(e) => {
                        // If empty on blur, revert to default name
                        if (!e.target.value || e.target.value.trim() === "") {
                          handleInputChange("name", "New Agent");
                        }
                      }}
                      className="w-full text-2xl font-semibold border-none outline-none bg-transparent px-2 py-1 hover:bg-muted/50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:bg-muted/50 focus:ring-2 focus:ring-primary/20"
                      placeholder="New Agent"
                      disabled={isReadonly}
                    />
                    <p className="text-xs text-muted-foreground mt-1 px-2">
                      Click to edit
                    </p>
                    {errors?.name && (
                      <p className="text-sm text-destructive mt-1 px-2">
                        {errors.name}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
              <CardContent className="pt-0 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="description">Description *</Label>
                  <Textarea
                    id="description"
                    data-testid="input-agent-description"
                    value={formData?.description || ""}
                    onChange={(e) =>
                      handleInputChange("description", e.target.value)
                    }
                    placeholder="Detailed behavior description and personality traits"
                    rows={4}
                    className={cn(errors?.description && "border-destructive")}
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
                    {formData?.departmentIds !== undefined ? (
                      <GenericPicker
                        items={
                          (agentData?.department_mapping || {}) as Record<
                            string,
                            { id: string; name: string; description?: string }
                          >
                        }
                        itemIds={agentData.valid_department_ids}
                        selectedIds={formData.departmentIds || []}
                        onSelect={(ids) =>
                          handleInputChange("departmentIds", ids)
                        }
                        getId={(dept) => (dept as unknown as { id: string }).id}
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
                    ) : null}
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
                        checked={formData?.active ?? true}
                        onCheckedChange={(checked) =>
                          handleInputChange("active", checked)
                        }
                        disabled={isReadonly}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground pl-5">
                      Inactive agents will not be available to perform
                      operations for departments
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Step 2: Role Selection */}
            <AgentRoleSection
              selectedRoleId={formData?.role || ""}
              selectedModelId={formData?.modelId}
              modelMapping={
                modelMapping as Record<
                  string,
                  {
                    input_modalities?: string[] | null;
                    output_modalities?: string[] | null;
                  }
                >
              }
              onRoleChange={handleRoleChange}
              stepStatus={getStepStatus("role")}
              stepTitle={steps[0]?.title || ""}
              stepDescription={steps[0]?.description || ""}
              stepNumber={2}
              isReadonly={isReadonly}
            />

            {/* Step 3: Model Selection */}
            <AgentModelSection
              modelId={formData?.modelId || ""}
              modelMapping={
                modelMapping as Record<
                  string,
                  { id: string; name: string; description?: string }
                >
              }
              validModelIds={agentData?.valid_model_ids || []}
              filteredValidModelIds={filteredValidModelIds}
              onModelChange={(modelId) => {
                handleInputChange("modelId", modelId);

                // Bidirectional filtering: Auto-set role based on model capabilities
                if (modelId && modelMapping && modelId in modelMapping) {
                  const modelInfo = modelMapping[modelId];
                  const { input: modelInputMods, output: modelOutputMods } =
                    getModelModalities(modelInfo);

                  // Special rule: Audio models (with both audio input and output) should only work with simulation-voice
                  const hasAudioInput = modelInputMods.includes("audio");
                  const hasAudioOutput = modelOutputMods.includes("audio");
                  const isAudioModel = hasAudioInput && hasAudioOutput;

                  // Special rule: Image models (with image output) should work with image role
                  const hasImageOutput = modelOutputMods.includes("image");
                  const hasVideoOutput = modelOutputMods.includes("video");

                  if (isAudioModel && formData?.role !== "simulation-voice") {
                    // Auto-set role to simulation-voice for audio models
                    handleInputChange("role", "simulation-voice");
                  } else if (
                    hasImageOutput &&
                    !hasVideoOutput &&
                    formData?.role !== "image" &&
                    !formData?.role
                  ) {
                    // If image model selected and no role selected, suggest image role
                    // But don't force it if user has already selected a different role
                    // Only auto-set if role is empty
                  } else if (
                    hasVideoOutput &&
                    formData?.role !== "video" &&
                    !formData?.role
                  ) {
                    // If video model selected and no role selected, suggest video role
                    // But don't force it if user has already selected a different role
                    // Only auto-set if role is empty
                  }
                }
              }}
              stepStatus={getStepStatus("model")}
              stepTitle={steps[1]?.title || ""}
              stepDescription={steps[1]?.description || ""}
              stepNumber={3}
              isReadonly={isReadonly}
              errors={errors}
              {...(formData?.role ? { role: formData.role } : {})}
            />

            {/* Step 4: Temperature Configuration */}
            {selectedModelCapabilities && (
              <AgentTemperatureSection
                temperature={formData?.temperature ?? 0.7}
                temperatureBounds={temperatureBounds}
                model_temperature_level_id={
                  formData?.model_temperature_level_id || null
                }
                onTemperatureChange={(temp) =>
                  handleInputChange("temperature", temp)
                }
                onTemperatureLevelIdChange={(levelId) =>
                  handleInputChange("model_temperature_level_id", levelId)
                }
                stepStatus={getStepStatus("temperature")}
                stepTitle={
                  steps.find((s) => s.id === "temperature")?.title || ""
                }
                stepDescription={
                  steps.find((s) => s.id === "temperature")?.description || ""
                }
                stepNumber={steps.findIndex((s) => s.id === "temperature") + 1}
                isReadonly={isReadonly}
              />
            )}

            {/* Step 5: Reasoning Configuration */}
            {selectedModelCapabilities?.has_text_output && (
              <>
                <AgentReasoningSection
                  model_reasoning_level_id={
                    formData?.model_reasoning_level_id || null
                  }
                  reasoning={formData?.reasoning || "none"}
                  reasoningMapping={
                    (agentDetail?.reasoning_mapping || {}) as Record<
                      string,
                      { id: string; name: string; description?: string }
                    >
                  }
                  reasoningOptions={(() => {
                    // Get reasoning options from selected model in model_mapping, fallback to agentDetail
                    const selectedModelId = formData?.modelId;
                    if (
                      selectedModelId &&
                      modelMapping &&
                      selectedModelId in modelMapping
                    ) {
                      const modelInfo = modelMapping[selectedModelId];
                      // Handle both dict and array formats (backward compatibility)
                      if (modelInfo?.reasoning_options && typeof modelInfo.reasoning_options === 'object') {
                        const reasoningOptionsArray = Array.isArray(modelInfo.reasoning_options)
                          ? modelInfo.reasoning_options
                          : Object.values(modelInfo.reasoning_options);
                        if (reasoningOptionsArray.length > 0) {
                          return reasoningOptionsArray.map((opt) => {
                            const optObj = opt as Record<string, string>;
                            return {
                              id: String(optObj["id"] || ""),
                              reasoning_level: String(
                                optObj["reasoning_level"] || "",
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
                    const agentReasoningOptions = agentDetail?.reasoning_options;
                    // Handle both dict and array formats (backward compatibility)
                    if (agentReasoningOptions && typeof agentReasoningOptions === 'object') {
                      const reasoningOptionsArray = Array.isArray(agentReasoningOptions)
                        ? agentReasoningOptions
                        : Object.values(agentReasoningOptions);
                      return reasoningOptionsArray as Array<{
                        id: string;
                        reasoning_level: string;
                      }>;
                    }
                    return [] as Array<{
                      id: string;
                      reasoning_level: string;
                    }>;
                  })()}
                  onReasoningChange={(reasoningLevel, optionId) => {
                    handleInputChange("model_reasoning_level_id", optionId);
                    // If reasoningLevel is null, it means unselected - set to "none"
                    if (reasoningLevel === null) {
                      handleInputChange("reasoning", "none");
                    } else {
                      handleInputChange(
                        "reasoning",
                        reasoningLevel as
                          | "none"
                          | "minimal"
                          | "low"
                          | "medium"
                          | "high",
                      );
                    }
                  }}
                  stepStatus={getStepStatus("reasoning")}
                  stepTitle={
                    steps.find((s) => s.id === "reasoning")?.title || ""
                  }
                  stepDescription={
                    steps.find((s) => s.id === "reasoning")?.description || ""
                  }
                  stepNumber={steps.findIndex((s) => s.id === "reasoning") + 1}
                  isReadonly={isReadonly}
                />
              </>
            )}

            {/* Step 6: Voice Configuration */}
            {/* Only show for models with BOTH input and output audio (e.g., gpt-realtime) */}
            {selectedModelCapabilities?.has_audio_input &&
              selectedModelCapabilities?.has_audio_output && (
                <AgentVoiceSection
                  model_voice_ids={formData?.model_voice_ids || []}
                  voices={formData?.voices || []}
                  availableVoices={availableVoices}
                  onVoiceChange={(voiceIds, optionIds) => {
                    handleInputChange("model_voice_ids", optionIds);
                    handleInputChange("voices", voiceIds);
                  }}
                  stepStatus={getStepStatus("voice")}
                  stepTitle={steps.find((s) => s.id === "voice")?.title || ""}
                  stepDescription={
                    steps.find((s) => s.id === "voice")?.description || ""
                  }
                  stepNumber={steps.findIndex((s) => s.id === "voice") + 1}
                  isReadonly={isReadonly}
                />
              )}

            {/* Final Step: Prompt Instructions */}
            <AgentPromptSection
              systemPrompt={formData?.systemPrompt || ""}
              promptId={formData?.promptId || null}
              promptMapping={agentDetail?.prompt_mapping || {}}
              filteredPromptMapping={filteredPromptMapping}
              hasPromptChanges={hasPromptChanges}
              resolvedPrompt={resolvedPrompt}
              resolvedPromptContent={resolvedPromptContent}
              onPromptChange={(prompt) =>
                handleInputChange("systemPrompt", prompt)
              }
              onPromptIdChange={(promptId) =>
                handleInputChange("promptId", promptId)
              }
              onResetPrompt={() => {
                setFormData((prev) => ({
                  ...prev,
                  systemPrompt: resolvedPromptContent,
                  promptId: resolvedPrompt.promptId,
                }));
              }}
              editorMode={editorMode}
              onEditorModeChange={setEditorMode}
              onDeletePrompt={(promptId, isDepartmentSpecific) => {
                setPromptToDelete({
                  promptId,
                  isDepartmentSpecific,
                });
                setShowDeletePromptDialog(true);
              }}
              stepStatus={getStepStatus("prompt")}
              stepTitle={steps[steps.length - 1]?.title || ""}
              stepDescription={steps[steps.length - 1]?.description || ""}
              stepNumber={steps.length}
              isReadonly={isReadonly}
              isEditMode={isEditMode}
              {...(agentDetail ? { agentDetail } : {})}
              {...(effectiveProfile ? { effectiveProfile } : {})}
              errors={errors}
            />

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
                      agent_id: agentId,
                      prompt_id: promptToDelete.promptId,
                      department_id: promptToDelete.isDepartmentSpecific
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
