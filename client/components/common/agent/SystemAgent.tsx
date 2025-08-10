/**
 * SystemAgent.tsx
 * Used to edit system agents only (edit mode only)
 * @AshokSaravanan222 & @siladiea
 * 07/20/2025
 */
"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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
import { updateAgent } from "@/utils/mutations/agents/update-agent";
import { getAgent } from "@/utils/queries/agents/get-agent";
import { getAllModels } from "@/utils/queries/models/get-all-models";
import MarkdownEditor from "../viewers/MarkdownEditor";
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
  agentId: string;
}

export default function SystemAgent({ agentId }: SystemAgentProps) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<SystemAgentFormData>();

  const { data: agent, isLoading: isLoadingAgent } = useQuery({
    queryKey: ["agent", agentId],
    queryFn: () => getAgent(agentId),
    enabled: !!agentId,
  });

  const { data: models, isLoading: isModelsLoading } = useQuery({
    queryKey: ["models"],
    queryFn: () => getAllModels(),
  });

  const isLoading = isLoadingAgent || isModelsLoading;

  useEffect(() => {
    if (agent) {
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
    }
  }, [agent]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData?.name) {
      toast.error("Agent name is required");
      return;
    }

    if (!formData?.description) {
      toast.error("Agent description is required");
      return;
    }

    if (!formData.systemPrompt) {
      toast.error("System prompt is required");
      return;
    }

    if (!formData.modelId || formData.modelId === "") {
      toast.error("Model selection is required");
      return;
    }

    setIsSubmitting(true);

    try {
      await updateAgent(agentId, {
        name: formData.name,
        description: formData.description,
        systemPrompt: formData.systemPrompt,
        temperature: Number(formData.temperature),
        modelId: formData.modelId,
        reasoning:
          formData.reasoning === "none" || !formData.reasoning
            ? null
            : formData.reasoning,
        updatedAt: new Date().toISOString(),
      });
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      queryClient.invalidateQueries({ queryKey: ["agent", agentId] });
      toast.success("Agent updated successfully!");
      router.push("/system/agents");
    } catch (error) {
      toast.error(`Failed to update agent: ${error}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 py-4 px-4">
      <div className="w-full">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Agent Name *</Label>
            {formData?.name !== undefined && !isLoading ? (
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="e.g., Enthusiastic Student Agent"
                required
              />
            ) : (
              <Skeleton className="h-10 w-full" />
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            {formData?.description !== undefined && !isLoading ? (
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                placeholder="Detailed behavior description and personality traits"
                rows={4}
                required
              />
            ) : (
              <Skeleton className="h-10 w-full" />
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
                      setFormData((prev) => ({
                        ...prev,
                        modelId: value,
                      }))
                    }
                    required
                  >
                    <SelectTrigger>
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
                      setFormData((prev) => ({
                        ...prev,
                        reasoning: value as
                          | "none"
                          | "minimal"
                          | "low"
                          | "medium"
                          | "high",
                      }))
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
                    setFormData((prev) => ({
                      ...prev,
                      temperature: value[0] || 0,
                    }))
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
            <Label htmlFor="systemPrompt">System Prompt *</Label>
            {formData?.systemPrompt !== undefined && !isLoading ? (
              <>
                <div className="h-[500px] overflow-auto">
                  <MarkdownEditor
                    value={formData?.systemPrompt || ""}
                    onChange={(value) =>
                      setFormData((prev) => ({
                        ...prev,
                        systemPrompt: value,
                      }))
                    }
                    placeholder="System prompt that defines how the agent should behave and respond. You can use markdown formatting."
                    className="h-full"
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  This prompt defines the agent's behavior and personality in
                  conversations. You can use markdown formatting for better
                  organization.
                </p>
              </>
            ) : (
              <Skeleton className="h-[500px] w-full" />
            )}
          </div>

          {/* Debug Info Section */}
          <div className="space-y-2">
            <Label>Debug Info</Label>
            <AgentDebugInfo agentId={agentId} />
            <p className="text-sm text-muted-foreground">
              These are debug instructions provided by the model, when it
              believed the prompt/tools was not clear or needed to be improved.
            </p>
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
              {isSubmitting ? "Updating..." : "Update Agent"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
