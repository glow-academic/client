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

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  useAgent,
  useCreateAgent,
  useUpdateAgent,
} from "@/lib/api/hooks/agents";
import { useModels } from "@/lib/api/hooks/models";
import { log } from "@/utils/logger";
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

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<SystemAgentFormData>();
  const [errors, setErrors] = useState<FormErrors>({});
  const [editorMode, setEditorMode] = useState<"editor" | "preview" | "debug">(
    "editor"
  );

  const isEditMode = !!agentId;

  const { data: agent, isLoading: isLoadingAgent } = useAgent(agentId!);
  const { data: models, isLoading: isModelsLoading } = useModels();

  const { mutateAsync: createAgent } = useCreateAgent();
  const { mutateAsync: updateAgent } = useUpdateAgent();

  const isLoading = isLoadingAgent || isModelsLoading;

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
    if (isEditMode && agent) {
      setFormData({
        name: agent.name,
        description: agent.description,
        systemPrompt: agent.systemPrompt,
        temperature: agent.temperature,
        modelId: agent.modelId || "",
        reasoning:
          (agent.reasoning as
            | "minimal"
            | "low"
            | "medium"
            | "high"
            | undefined) || "none",
      });
    } else if (!isEditMode) {
      setFormData(initialFormData);
    }
  }, [isEditMode, agent, initialFormData]);

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
      if (isEditMode && agentId && agent) {
        // Update existing agent
        await updateAgent({
          id: agentId,
          name: formData.name,
          description: formData.description,
          systemPrompt: formData.systemPrompt,
          temperature: Number(formData.temperature),
          modelId:
            formData.modelId && formData.modelId !== ""
              ? formData.modelId
              : undefined,
          reasoning:
            formData.reasoning && formData.reasoning !== "none"
              ? formData.reasoning
              : undefined,
        });
      } else {
        // Create new agent
        await createAgent({
          name: formData.name!,
          description: formData.description!,
          systemPrompt: formData.systemPrompt!,
          temperature: Number(formData.temperature),
          modelId: formData.modelId!,
          reasoning:
            formData.reasoning && formData.reasoning !== "none"
              ? formData.reasoning
              : undefined,
        });
      }

      toast.success(
        isEditMode
          ? "Agent updated successfully!"
          : "Agent created successfully!"
      );
      resetFormAndState();
      router.push("/system/agents");
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      log.error("agent.save.failed", {
        error,
        context: { component: "SystemAgent", isEditMode, agentId },
      });
      toast.error(
        `Failed to ${isEditMode ? "update" : "create"} agent: ${msg}`
      );
    } finally {
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

            <div className={`grid gap-4 grid-cols-1`}>
              {formData?.modelId !== undefined && !isLoading ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="modelId">Text Model *</Label>
                    <Select
                      value={formData?.modelId}
                      onValueChange={(value) =>
                        handleInputChange("modelId", value)
                      }
                      required
                    >
                      <SelectTrigger
                        className={errors.modelId ? "border-destructive" : ""}
                      >
                        <SelectValue placeholder="Select a model" />
                      </SelectTrigger>
                      <SelectContent>
                        {models
                          ?.filter((model) => model.active)
                          ?.map((model) => (
                            <SelectItem key={model.id} value={model.id}>
                              {model.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    {errors.modelId && (
                      <p className="text-sm text-destructive">
                        {errors.modelId}
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <Skeleton className="h-10 w-full" />
              )}
            </div>

            <div className={`grid gap-4 grid-cols-1`}>
              {formData?.reasoning !== undefined && !isLoading ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="reasoning">Reasoning Effort</Label>
                    <Select
                      value={formData?.reasoning || "none"}
                      onValueChange={(value) =>
                        handleInputChange(
                          "reasoning",
                          value as
                            | "none"
                            | "minimal"
                            | "low"
                            | "medium"
                            | "high"
                        )
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select reasoning effort" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="minimal">Minimal</SelectItem>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              ) : (
                <Skeleton className="h-10 w-full" />
              )}
            </div>

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
                    min={0}
                    max={1}
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
                      isEditMode && agentId ? (
                        <AgentDebugInfo agentId={agentId} />
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
