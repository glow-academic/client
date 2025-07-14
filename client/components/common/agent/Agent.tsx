/**
 * Agent.tsx
 * Used to create and manage agents - supports both creation and editing
 * @AshokSaravanan222 & @siladiea
 * 05/20/2025
 */
"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
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
import { createAgent } from "@/utils/mutations/agents/create-agent";
import { updateAgent } from "@/utils/mutations/agents/update-agent";
import { getAgent } from "@/utils/queries/agents/get-agent";
import { getAllModels } from "@/utils/queries/models/get-all-models";

interface FormData {
  name?: string;
  description?: string;
  systemPrompt?: string;
  temperature?: number;
  modelId?: string;
}

export interface AgentProps {
  agentId?: string;
  mode?: "create" | "edit";
}

export default function Agent({
  agentId,
  mode = agentId ? "edit" : "create",
}: AgentProps) {
  const router = useRouter();
  const isEditMode = mode === "edit" && !!agentId;
  const queryClient = useQueryClient();

  const initialFormData: FormData = useMemo(
    () => ({
      name: "",
      description: "",
      systemPrompt: "",
      temperature: 0.0,
      modelId: "",
    }),
    []
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<FormData>();

  const { data: agent, isLoading: isLoadingAgent } = useQuery({
    queryKey: ["agent", agentId],
    queryFn: () => getAgent(agentId!),
    enabled: isEditMode,
  });

  const { data: models, isLoading: isModelsLoading } = useQuery({
    queryKey: ["models"],
    queryFn: () => getAllModels(),
  });

  const isLoading = isLoadingAgent || isModelsLoading;

  useEffect(() => {
    if (agent && isEditMode) {
      setFormData({
        name: agent.name,
        description: agent.description,
        systemPrompt: agent.systemPrompt,
        temperature: agent.temperature,
        modelId: agent.modelId || "",
      });
    } else if (!isEditMode) {
      setFormData(initialFormData);
    }
  }, [agent, isEditMode, initialFormData]);

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
      // must have some model selected
      toast.error("Model selection is required");
      return;
    }

    setIsSubmitting(true);

    try {
      if (isEditMode) {
        await updateAgent(agentId!, {
          name: formData.name,
          description: formData.description,
          systemPrompt: formData.systemPrompt,
          temperature: Number(formData.temperature),
          modelId: formData.modelId,
          updatedAt: new Date().toISOString(),
        });
        queryClient.invalidateQueries({ queryKey: ["agents"] });
        queryClient.invalidateQueries({ queryKey: ["agent", agentId] });
        toast.success("Agent updated successfully!");
      } else {
        const newAgent = await createAgent({
          name: formData.name,
          description: formData.description,
          systemPrompt: formData.systemPrompt,
          temperature: Number(formData.temperature),
          modelId: formData.modelId,
        });
        queryClient.invalidateQueries({ queryKey: ["agents"] });
        queryClient.invalidateQueries({ queryKey: ["agent", newAgent?.id] });
        toast.success("Agent created successfully!");
      }

      router.push("/management/agents");
    } catch (error) {
      toast.error(
        `Failed to ${isEditMode ? "update" : "create"} agent: ${error}`
      );
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
            {formData?.modelId !== undefined &&
            !isLoading ? (
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
                        ?.filter(
                          (model) => model.active
                        )
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

          <div className="space-y-2">
            <Label htmlFor="temperature">
              Temperature: {formData?.temperature && formData.temperature}
            </Label>
            {formData?.temperature !== undefined && !isLoading ? (
              <>
                <Slider
                  id="temperature"
                  data-testid="temperature-slider"
                  min={0}
                  max={100}
                  step={1}
                  value={[(formData?.temperature || 0) * 100]}
                  onValueChange={(value) =>
                    setFormData((prev) => ({
                      ...prev,
                      temperature: (value[0] || 0) / 100,
                    }))
                  }
                  className="w-full"
                />{" "}
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
                <Textarea
                  id="systemPrompt"
                  value={formData?.systemPrompt || ""}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      systemPrompt: e.target.value,
                    }))
                  }
                  placeholder="System prompt that defines how the agent should behave and respond"
                  rows={20}
                  required
                />
                <p className="text-sm text-muted-foreground">
                  This prompt defines the agent's behavior and personality in
                  conversations.
                </p>
              </>
            ) : (
              <Skeleton className="h-100 w-full" />
            )}
          </div>

          <div className="flex gap-2 justify-end">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? isEditMode
                  ? "Updating..."
                  : "Creating..."
                : isEditMode
                  ? "Update Agent"
                  : "Create Agent"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
