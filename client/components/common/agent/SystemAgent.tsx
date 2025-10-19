/**
 * SystemAgent.tsx
 * Used to create and edit system agents
 * @AshokSaravanan222 & @siladiea
 * 07/20/2025
 */
"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { ModelPicker } from "@/components/common/forms/ModelPicker";
import { ReasoningPicker } from "@/components/common/forms/ReasoningPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useProfile } from "@/contexts/profile-context";
import {
  useAgentDetail,
  useCreateAgent as useCreateAgentV2,
  useUpdateAgent as useUpdateAgentV2,
} from "@/lib/api/v2/hooks/agents";
import { useLogger } from "@/lib/api/v2/hooks/logs";
import { Bug, Eye } from "lucide-react";
import UnifiedPromptEditor from "../editor/UnifiedPromptEditor";
import AgentDebugInfo from "./AgentDebugInfo";

interface SystemAgentFormData {
  name?: string;
  description?: string;
  systemPrompt?: string;
  temperature?: number;
  modelId?: string;
  reasoning?: "none" | "minimal" | "low" | "medium" | "high";
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
  const log = useLogger();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<SystemAgentFormData>();
  const [errors, setErrors] = useState<FormErrors>({});
  const [editorMode, setEditorMode] = useState<"editor" | "preview" | "debug">(
    "editor"
  );

  const isEditMode = !!agentId;

  // V2 API hooks
  const { data: agentDetail, isLoading: isLoadingAgentDetail } = useAgentDetail(
    agentId || "",
    effectiveProfile?.id || "",
    isEditMode
  );

  const { mutate: createAgent } = useCreateAgentV2();
  const { mutate: updateAgent } = useUpdateAgentV2();

  const isLoading = isLoadingAgentDetail;

  // Temperature bounds from v2 response
  const temperatureLower = agentDetail?.temperature_lower ?? 0.0;
  const temperatureUpper = agentDetail?.temperature_upper ?? 1.0;

  const initialFormData: SystemAgentFormData = useMemo(
    () => ({
      name: "",
      description: "",
      systemPrompt: "",
      temperature: 0.7,
      modelId: "",
      reasoning: "none",
    }),
    []
  );

  useEffect(() => {
    if (isEditMode && agentDetail) {
      setFormData({
        name: agentDetail.name,
        description: agentDetail.description,
        systemPrompt: agentDetail.system_prompt,
        temperature: agentDetail.temperature,
        modelId: agentDetail.model_id || "",
        reasoning:
          (agentDetail.reasoning as
            | "minimal"
            | "low"
            | "medium"
            | "high"
            | undefined) || "none",
      });
    } else if (!isEditMode && agentDetail) {
      // For create mode, use defaults from API response
      setFormData({
        ...initialFormData,
        temperature:
          agentDetail.temperature ?? initialFormData.temperature ?? 0.7,
        modelId: agentDetail.model_id || initialFormData.modelId || "",
        systemPrompt:
          agentDetail.system_prompt || initialFormData.systemPrompt || "",
      });
    }
  }, [isEditMode, agentDetail, initialFormData]);

  const handleInputChange = (
    field: keyof SystemAgentFormData,
    value: string | number | null | undefined
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
            system_prompt: formData.systemPrompt!,
            temperature: Number(formData.temperature),
            model_id: formData.modelId!,
            reasoning:
              formData.reasoning && formData.reasoning !== "none"
                ? formData.reasoning
                : null,
          },
          {
            onSuccess: () => {
              toast.success("Agent updated successfully!");
              resetFormAndState();
              router.push("/system/agents");
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
            system_prompt: formData.systemPrompt!,
            temperature: Number(formData.temperature),
            model_id: formData.modelId!,
            reasoning:
              formData.reasoning && formData.reasoning !== "none"
                ? formData.reasoning
                : null,
          },
          {
            onSuccess: (response) => {
              toast.success("Agent created successfully!");
              resetFormAndState();
              router.push(`/system/agents/a/${response.agentId}`);
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
                  {formData?.systemPrompt !== undefined && !isLoading && (
                    <>
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
                    </>
                  )}
                </div>
              </div>
              {formData?.systemPrompt !== undefined && !isLoading ? (
                <div className="h-[500px]">
                  <UnifiedPromptEditor
                    value={formData?.systemPrompt || ""}
                    onChange={(value) =>
                      handleInputChange("systemPrompt", value)
                    }
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
      </div>
    </TooltipProvider>
  );
}
