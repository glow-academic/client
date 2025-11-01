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

import { DepartmentPicker } from "@/components/common/forms/DepartmentPicker";
import { ModelPicker } from "@/components/common/forms/ModelPicker";
import {
  PromptInfo,
  PromptPicker,
} from "@/components/common/forms/PromptPicker";
import { ReasoningPicker } from "@/components/common/forms/ReasoningPicker";
import { RolePicker } from "@/components/common/forms/RolePicker";
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
import { Skeleton } from "@/components/ui/skeleton";
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
  useAgentDetail,
  useAgentDetailDefault,
  useCreateAgent as useCreateAgentV2,
  useDeleteAgentPrompt,
  useUpdateAgent as useUpdateAgentV2,
} from "@/lib/api/v2/hooks/agents";
import { useLogger } from "@/lib/api/v2/hooks/logs";
import { Bug, Copy, Eye, Trash2 } from "lucide-react";
import UnifiedPromptEditor from "../editor/UnifiedPromptEditor";
import AgentDebugInfo from "./AgentDebugInfo";

interface SystemAgentFormData {
  name?: string;
  description?: string;
  systemPrompt?: string;
  promptId?: string | null;
  temperature?: number;
  modelId?: string;
  reasoning?: "none" | "minimal" | "low" | "medium" | "high";
  active?: boolean;
  role?: string; // agent_role enum value
  departmentIds?: string[]; // None = cross-department (superadmin only)
}

export interface SystemAgentProps {
  agentId?: string;
}

interface FormErrors {
  name?: string;
  description?: string;
  systemPrompt?: string;
  modelId?: string;
}

export default function SystemAgent({ agentId }: SystemAgentProps) {
  const router = useRouter();
  const { effectiveProfile } = useProfile();
  const { setEntityMetadata, clearEntityMetadata } = useBreadcrumbContext();
  const log = useLogger();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<SystemAgentFormData>();
  const [errors, setErrors] = useState<FormErrors>({});
  const [editorMode, setEditorMode] = useState<"editor" | "preview" | "debug">(
    "editor"
  );
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<
    string | null
  >(null); // null = "All Departments"
  const [isCreatingNewPrompt, setIsCreatingNewPrompt] = useState(false);
  const prevDepartmentIdRef = React.useRef<string | null>(null);
  const [showDeletePromptDialog, setShowDeletePromptDialog] = useState(false);
  const [promptToDelete, setPromptToDelete] = useState<{
    promptId: string;
    isDepartmentSpecific: boolean;
  } | null>(null);

  const isEditMode = !!agentId;

  // V2 API hooks
  const { data: agentDetail, isLoading: isLoadingAgentDetail } = useAgentDetail(
    agentId || "",
    effectiveProfile?.id || "",
    isEditMode
  );

  const { data: agentDetailDefault, isLoading: isLoadingAgentDefault } =
    useAgentDetailDefault(effectiveProfile?.id || "", !isEditMode);

  const { mutate: createAgent } = useCreateAgentV2();
  const { mutate: updateAgent } = useUpdateAgentV2();
  const { mutate: deleteAgentPrompt } = useDeleteAgentPrompt();

  // Use edit detail when editing, default detail when creating
  const agentData = isEditMode ? agentDetail : agentDetailDefault;
  const isLoading = isEditMode ? isLoadingAgentDetail : isLoadingAgentDefault;

  // Temperature bounds from v2 response
  const temperatureLower = agentData?.temperature_lower ?? 0.0;
  const temperatureUpper = agentData?.temperature_upper ?? 1.0;

  // Filter prompt_mapping based on selected department
  // When "All Departments" is selected, only show default prompts (null department_ids)
  // When a department is selected, only show department-specific prompts for that department
  const filteredPromptMapping = useMemo(() => {
    if (!isEditMode || !agentDetail?.prompt_mapping) {
      return agentDetail?.prompt_mapping || {};
    }

    const filtered: Record<string, PromptInfo> = {};
    for (const [promptId, promptInfo] of Object.entries(
      agentDetail.prompt_mapping
    )) {
      if (!selectedDepartmentId) {
        // "All Departments" selected - only show default prompts (null/empty department_ids)
        if (
          !promptInfo.department_ids ||
          promptInfo.department_ids.length === 0
        ) {
          filtered[promptId] = promptInfo;
        }
      } else {
        // Department selected - only show department-specific prompts for that department
        if (
          promptInfo.department_ids &&
          promptInfo.department_ids.includes(selectedDepartmentId)
        ) {
          filtered[promptId] = promptInfo;
        }
      }
    }
    return filtered;
  }, [selectedDepartmentId, agentDetail?.prompt_mapping, isEditMode]);

  // Detect if using default prompt (no department-specific prompt exists)
  const isUsingDefaultPrompt = useMemo(() => {
    if (!isEditMode || !selectedDepartmentId || !agentDetail) return false;
    return !agentDetail.department_prompt_links?.[selectedDepartmentId];
  }, [selectedDepartmentId, agentDetail, isEditMode]);

  // Get default prompt content
  const defaultPromptContent = useMemo(() => {
    if (!isEditMode || !agentDetail?.prompt_id || !agentDetail?.prompt_mapping)
      return "";
    const defaultPrompt = agentDetail.prompt_mapping[agentDetail.prompt_id];
    return defaultPrompt?.system_prompt || "";
  }, [agentDetail, isEditMode]);

  const initialFormData: SystemAgentFormData = useMemo(
    () => ({
      name: "",
      description: "",
      systemPrompt: "",
      promptId: null,
      temperature: 0.7,
      modelId: "",
      reasoning: "none",
      active: true,
      role: "assistant", // Default role
      departmentIds: effectiveProfile?.primaryDepartmentId
        ? [effectiveProfile.primaryDepartmentId]
        : [],
    }),
    [effectiveProfile?.primaryDepartmentId]
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
      setFormData({
        name: agentDetail.name,
        description: agentDetail.description,
        systemPrompt: agentDetail.system_prompt,
        promptId: agentDetail.prompt_id || null,
        temperature: agentDetail.temperature,
        modelId: agentDetail.model_id || "",
        reasoning:
          (agentDetail.reasoning as
            | "minimal"
            | "low"
            | "medium"
            | "high"
            | undefined) || "none",
        active: agentDetail.active ?? true,
        role: agentDetail.role || "assistant",
        departmentIds: agentDetail.department_ids || [],
      });
    } else if (!isEditMode && agentDetailDefault) {
      // For create mode, use defaults from API response
      setFormData({
        ...initialFormData,
        temperature:
          agentDetailDefault.temperature ?? initialFormData.temperature ?? 0.7,
        modelId: agentDetailDefault.model_id || initialFormData.modelId || "",
        systemPrompt:
          agentDetailDefault.system_prompt ||
          initialFormData.systemPrompt ||
          "",
        promptId: null,
        role: agentDetailDefault.role || "assistant",
        departmentIds: agentDetailDefault.department_ids || [],
      });
    }
  }, [isEditMode, agentDetail, agentDetailDefault, initialFormData]);

  // Update prompt when department selection changes
  useEffect(() => {
    if (!isEditMode || !agentDetail) return;

    // Track department changes FIRST and reset creating flag when department changes
    const departmentChanged =
      prevDepartmentIdRef.current !== selectedDepartmentId;
    if (departmentChanged) {
      setIsCreatingNewPrompt(false);
      prevDepartmentIdRef.current = selectedDepartmentId;
    }

    // Don't override state if user is actively creating a new prompt (unless department changed)
    if (isCreatingNewPrompt && !departmentChanged) return;

    // Determine which prompt should be selected for the current department
    const getCurrentPromptId = () => {
      if (!selectedDepartmentId) {
        // "All Departments" selected - use default prompt
        return agentDetail.prompt_id || null;
      }
      // Specific department selected - use department-specific prompt if it exists
      if (agentDetail.department_prompt_links?.[selectedDepartmentId]) {
        return agentDetail.department_prompt_links[selectedDepartmentId];
      }
      // No department-specific prompt - return null to indicate using default
      return null;
    };

    const currentPromptId = getCurrentPromptId();
    const promptInfo =
      currentPromptId && agentDetail.prompt_mapping?.[currentPromptId];

    // Check if current formData.promptId is valid for the selected department
    const currentPromptIsValid = formData?.promptId
      ? filteredPromptMapping[formData.promptId] !== undefined
      : true; // null promptId is valid (means using default)

    // Only auto-select when department changes, or if current prompt is invalid for department
    if (departmentChanged) {
      // Department changed - always update to the correct prompt
      if (promptInfo) {
        // Prompt exists (default or department-specific) - select it and update system prompt
        setFormData((prev) => ({
          ...prev,
          promptId: currentPromptId,
          systemPrompt: promptInfo.system_prompt,
        }));
      } else if (selectedDepartmentId && !currentPromptId) {
        // Department selected but no department-specific prompt - using default
        setFormData((prev) => ({
          ...prev,
          promptId: null,
          systemPrompt: "", // Clear to show default prompt UI
        }));
      } else {
        // "All Departments" selected but no default prompt, or other edge case
        setFormData((prev) => ({
          ...prev,
          promptId: null,
        }));
      }
    } else if (!currentPromptIsValid && formData?.promptId) {
      // Current prompt is invalid for selected department - reset to default
      if (promptInfo) {
        setFormData((prev) => ({
          ...prev,
          promptId: currentPromptId,
          systemPrompt: promptInfo.system_prompt,
        }));
      } else {
        setFormData((prev) => ({
          ...prev,
          promptId: null,
          systemPrompt: "",
        }));
      }
    }
  }, [
    selectedDepartmentId,
    agentDetail,
    isEditMode,
    formData?.promptId,
    isCreatingNewPrompt,
    filteredPromptMapping,
  ]);

  const handleInputChange = (
    field: keyof SystemAgentFormData,
    value: string | number | boolean | null | undefined
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
      if (isEditMode && agentId && agentDetail) {
        // Update existing agent using v2 API
        updateAgent(
          {
            agentId,
            name: formData.name!,
            description: formData.description!,
            prompt_id: formData.promptId || null,
            system_prompt: formData.systemPrompt!,
            temperature: Number(formData.temperature),
            model_id: formData.modelId!,
            reasoning:
              formData.reasoning && formData.reasoning !== "none"
                ? formData.reasoning
                : null,
            active: formData.active ?? true,
            role: formData.role || "assistant",
            department_ids:
              formData.departmentIds && formData.departmentIds.length > 0
                ? formData.departmentIds
                : null,
            department_id: selectedDepartmentId || null,
            department_prompt_id:
              selectedDepartmentId && formData.promptId
                ? formData.promptId
                : null,
          },
          {
            onSuccess: () => {
              toast.success("Agent updated successfully!");
              resetFormAndState();
              router.push("/management/agents");
              setIsSubmitting(false);
            },
            onError: (error) => {
              const msg =
                error instanceof Error ? error.message : "Unknown error";
              log.error("agent.update.failed", {
                error,
                context: { component: "SystemAgent", agentId },
              });
              toast.error(`Failed to update agent: ${msg}`);
              setIsSubmitting(false);
            },
          }
        );
      } else {
        // Create new agent using v2 API
        createAgent(
          {
            name: formData.name!,
            description: formData.description!,
            prompt_id: formData.promptId || null,
            system_prompt: formData.systemPrompt!,
            temperature: Number(formData.temperature),
            model_id: formData.modelId!,
            reasoning:
              formData.reasoning && formData.reasoning !== "none"
                ? formData.reasoning
                : null,
            active: formData.active ?? true,
            role: formData.role || "assistant",
            department_ids:
              formData.departmentIds && formData.departmentIds.length > 0
                ? formData.departmentIds
                : null,
          },
          {
            onSuccess: (response) => {
              toast.success("Agent created successfully!");
              resetFormAndState();
              router.push(`/management/agents/a/${response.agentId}`);
              setIsSubmitting(false);
            },
            onError: (error) => {
              const msg =
                error instanceof Error ? error.message : "Unknown error";
              log.error("agent.create.failed", {
                error,
                context: { component: "SystemAgent" },
              });
              toast.error(`Failed to create agent: ${msg}`);
              setIsSubmitting(false);
            },
          }
        );
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      log.error("agent.save.failed", {
        error,
        context: { component: "SystemAgent", isEditMode, agentId },
      });
      toast.error(
        `Failed to ${isEditMode ? "update" : "create"} agent: ${msg}`
      );
      setIsSubmitting(false);
    }
  };

  return (
    <TooltipProvider>
      <div className="space-y-6 py-4 px-4">
        <div className="w-full">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Agent Name *</Label>
              {formData?.name !== undefined && !isLoading ? (
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleInputChange("name", e.target.value)}
                  placeholder="e.g., Enthusiastic Student Agent"
                  className={errors.name ? "border-destructive" : ""}
                  required
                />
              ) : (
                <Skeleton className="h-10 w-full" />
              )}
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              {formData?.description !== undefined && !isLoading ? (
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) =>
                    handleInputChange("description", e.target.value)
                  }
                  placeholder="Detailed behavior description and personality traits"
                  rows={4}
                  className={errors.description ? "border-destructive" : ""}
                  required
                />
              ) : (
                <Skeleton className="h-10 w-full" />
              )}
              {errors.description && (
                <p className="text-sm text-destructive">{errors.description}</p>
              )}
            </div>

            {/* Role and Department Selection */}
            <div className="space-y-4">
              {/* Department Picker */}
              <div className="space-y-2">
                <Label htmlFor="department">Department</Label>
                {formData?.departmentIds !== undefined &&
                agentData?.department_mapping !== undefined &&
                !isLoading ? (
                  <DepartmentPicker
                    mapping={agentData.department_mapping || {}}
                    validIds={agentData.valid_department_ids || []}
                    selectedIds={formData.departmentIds || []}
                    onSelect={(ids) =>
                      setFormData((prev) => ({
                        ...prev,
                        departmentIds: ids,
                      }))
                    }
                    placeholder="All Departments"
                    disabled={isSubmitting}
                    multiSelect={true}
                  />
                ) : (
                  <Skeleton className="h-10 w-full" />
                )}
              </div>

              {/* Role Picker */}
              <div className="space-y-2">
                <Label htmlFor="role">Role *</Label>
                {formData?.role !== undefined && !isLoading ? (
                  <RolePicker
                    selectedRole={formData.role || "assistant"}
                    onSelect={(role) => handleInputChange("role", role)}
                    placeholder="Select role"
                  />
                ) : (
                  <Skeleton className="h-10 w-full" />
                )}
              </div>
            </div>

            {/* Switches - Horizontal Layout */}
            <div className="flex gap-8">
              {/* Agent Active Switch */}
              <div className="flex items-center gap-2">
                <Label htmlFor="active" className="text-sm">
                  Agent Active
                </Label>
                {formData?.active !== undefined && !isLoading ? (
                  <Switch
                    id="active"
                    checked={formData.active ?? true}
                    onCheckedChange={(checked) =>
                      handleInputChange("active", checked)
                    }
                  />
                ) : (
                  <Skeleton className="h-6 w-11" />
                )}
              </div>
            </div>

            {/* Text Model, Reasoning Effort, and Temperature - 3 Column Grid */}
            <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
              {/* Text Model */}
              <div className="space-y-2">
                <Label htmlFor="modelId">Text Model *</Label>
                {formData?.modelId !== undefined && !isLoading ? (
                  <>
                    <ModelPicker
                      mapping={agentDetail?.model_mapping || {}}
                      validIds={agentDetail?.valid_model_ids || []}
                      selectedIds={formData?.modelId ? [formData.modelId] : []}
                      onSelect={(ids) =>
                        handleInputChange("modelId", ids[0] || "")
                      }
                      placeholder="Select a model"
                      multiSelect={false}
                      buttonClassName={
                        errors.modelId ? "border-destructive" : ""
                      }
                    />
                    {errors.modelId && (
                      <p className="text-sm text-destructive">
                        {errors.modelId}
                      </p>
                    )}
                  </>
                ) : (
                  <Skeleton className="h-10 w-full" />
                )}
              </div>

              {/* Reasoning Effort */}
              <div className="space-y-2">
                <Label htmlFor="reasoning">Reasoning Effort</Label>
                {formData?.reasoning !== undefined && !isLoading ? (
                  <ReasoningPicker
                    mapping={agentDetail?.reasoning_mapping || {}}
                    validIds={["none", "minimal", "low", "medium", "high"]}
                    selectedIds={
                      formData?.reasoning ? [formData.reasoning] : ["none"]
                    }
                    onSelect={(ids) =>
                      handleInputChange(
                        "reasoning",
                        (ids[0] || "none") as
                          | "none"
                          | "minimal"
                          | "low"
                          | "medium"
                          | "high"
                      )
                    }
                    placeholder="Select reasoning effort"
                    multiSelect={false}
                  />
                ) : (
                  <Skeleton className="h-10 w-full" />
                )}
              </div>

              {/* Temperature */}
              <div className="space-y-2">
                <Label htmlFor="temperature">
                  Temperature:{" "}
                  {formData?.temperature !== undefined
                    ? formData.temperature.toFixed(2)
                    : "0.00"}
                </Label>
                {formData?.temperature !== undefined && !isLoading ? (
                  <>
                    <Slider
                      id="temperature"
                      data-testid="temperature-slider"
                      min={temperatureLower}
                      max={temperatureUpper}
                      step={0.01}
                      value={[formData?.temperature || 0]}
                      onValueChange={(value) =>
                        handleInputChange("temperature", value[0] || 0)
                      }
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Deterministic</span>
                      <span>Creative</span>
                    </div>
                  </>
                ) : (
                  <Skeleton className="h-10 w-full" />
                )}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="systemPrompt">System Prompt *</Label>
                <div className="flex gap-2">
                  {isEditMode && agentDetail && (
                    <DepartmentPicker
                      mapping={agentDetail.department_mapping}
                      validIds={agentDetail.valid_department_ids}
                      selectedIds={
                        selectedDepartmentId ? [selectedDepartmentId] : []
                      }
                      onSelect={(ids) => {
                        setSelectedDepartmentId(
                          ids.length > 0 ? ids[0]! : null
                        );
                      }}
                      multiSelect={false}
                      placeholder="All Departments"
                      disabled={false}
                      compact={true}
                      buttonClassName="h-8"
                    />
                  )}
                  {isEditMode &&
                    agentDetail &&
                    filteredPromptMapping &&
                    (Object.keys(filteredPromptMapping).length > 0 ||
                      selectedDepartmentId) && (
                      <PromptPicker
                        promptMapping={filteredPromptMapping}
                        selectedPromptId={formData?.promptId || null}
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
                        onCreateNew={() => {
                          setIsCreatingNewPrompt(true);
                          // When creating new, always start with empty prompt
                          // (Use "Branch from Default" button if you want to start with default content)
                          setFormData((prev) => ({
                            ...prev,
                            promptId: null,
                            systemPrompt: "",
                          }));
                        }}
                        placeholder="Select prompt version..."
                        disabled={false}
                        buttonClassName="h-8"
                      />
                    )}
                  {formData?.systemPrompt !== undefined && !isLoading && (
                    <>
                      {isEditMode &&
                        (formData?.promptId || isUsingDefaultPrompt) && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={() => {
                                  setIsCreatingNewPrompt(true);
                                  // Duplicate current prompt - keep content but create new prompt
                                  // If using default prompt, duplicate default content
                                  // If All Departments selected, duplicate current prompt content
                                  const contentToDuplicate =
                                    isUsingDefaultPrompt
                                      ? defaultPromptContent
                                      : formData?.systemPrompt || "";
                                  setFormData((prev) => ({
                                    ...prev,
                                    promptId: null,
                                    systemPrompt: contentToDuplicate,
                                  }));
                                }}
                                className="h-8 w-8 p-0"
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>
                                {isUsingDefaultPrompt
                                  ? "Branch from Default"
                                  : "Duplicate"}
                              </p>
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
              {formData?.systemPrompt !== undefined && !isLoading ? (
                <>
                  {isUsingDefaultPrompt &&
                  formData.systemPrompt === "" &&
                  !isCreatingNewPrompt ? (
                    <div className="space-y-4">
                      <div className="border rounded-lg p-6 bg-muted/50">
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-blue-500" />
                            <p className="text-sm font-medium">
                              Using Default Prompt
                            </p>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {selectedDepartmentId &&
                            agentDetail?.department_mapping?.[
                              selectedDepartmentId
                            ]
                              ? `No department-specific prompt exists for ${agentDetail.department_mapping[selectedDepartmentId].name}. The default prompt is being used.`
                              : "No department-specific prompt exists. The default prompt is being used."}
                          </p>
                          <div className="border-t pt-4 mt-4">
                            <p className="text-xs font-medium mb-2 text-muted-foreground">
                              Default Prompt Preview:
                            </p>
                            <div className="bg-background border rounded p-4 max-h-[200px] overflow-y-auto">
                              <pre className="text-xs whitespace-pre-wrap font-mono">
                                {defaultPromptContent || "No default prompt"}
                              </pre>
                            </div>
                          </div>
                          <div className="flex gap-2 pt-2">
                            <Button
                              type="button"
                              variant="default"
                              size="sm"
                              onClick={() => {
                                setIsCreatingNewPrompt(true);
                                setFormData((prev) => ({
                                  ...prev,
                                  promptId: null,
                                  systemPrompt: "",
                                }));
                              }}
                            >
                              Create New Prompt
                              {selectedDepartmentId &&
                              agentDetail?.department_mapping?.[
                                selectedDepartmentId
                              ]
                                ? ` for ${agentDetail.department_mapping[selectedDepartmentId].name}`
                                : ""}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setIsCreatingNewPrompt(true);
                                setFormData((prev) => ({
                                  ...prev,
                                  promptId: null,
                                  systemPrompt: defaultPromptContent,
                                }));
                              }}
                            >
                              Branch from Default
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="h-[500px]">
                      <UnifiedPromptEditor
                        value={formData?.systemPrompt || ""}
                        onChange={(value) => {
                          setIsCreatingNewPrompt(true); // User is actively editing
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
                  )}
                </>
              ) : (
                <Skeleton className="h-[500px] w-full" />
              )}
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
              <Button type="submit" disabled={isSubmitting}>
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
                onClick={() => {
                  if (!promptToDelete || !agentId) return;

                  deleteAgentPrompt(
                    {
                      agentId,
                      promptId: promptToDelete.promptId,
                      departmentId: promptToDelete.isDepartmentSpecific
                        ? selectedDepartmentId || null
                        : null,
                    },
                    {
                      onSuccess: () => {
                        toast.success("Prompt deleted successfully");
                        setShowDeletePromptDialog(false);
                        setPromptToDelete(null);
                        // Refresh agent detail - the query will automatically refetch
                      },
                      onError: (error) => {
                        toast.error(
                          `Failed to delete prompt: ${error.message}`
                        );
                      },
                    }
                  );
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
