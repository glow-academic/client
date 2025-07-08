/**
 * Agent.tsx
 * Used to create and manage agents - supports both creation and editing
 * @AshokSaravanan222 & @siladiea
 * 05/20/2025
 */
"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useRole } from "@/contexts/role-context";
import { type Agent } from "@/types";
import { createAgent } from "@/utils/mutations/agents/create-agent";
import { updateAgent } from "@/utils/mutations/agents/update-agent";
import { getAgent } from "@/utils/queries/agents/get-agent";
import { getAllModels } from "@/utils/queries/models/get-all-models";

interface AgentProps {
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

  // Role-based access control
  const { effectiveRole } = useRole();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<Partial<Agent>>({
    name: "",
    description: "",
    systemPrompt: "",
    temperature: 0.0,
    modelId: null,
    voiceAgent: false,
    sttModelId: "default",
    ttsModelId: "default",
  });

  const { data: agent, isLoading: isLoadingAgent } = useQuery({
    queryKey: ["agent", agentId],
    queryFn: () => getAgent(agentId!),
    enabled: isEditMode,
  });

  const { data: models, isLoading: isModelsLoading } = useQuery({
    queryKey: ["models"],
    queryFn: () => getAllModels(),
  });

  // Loading state for the entire form (only when agent is loading in edit mode)
  const isFormLoading = isEditMode && isLoadingAgent;

  useEffect(() => {
    if (agent && isEditMode) {
      setFormData({
        name: agent.name || "",
        description: agent.description || "",
        systemPrompt: agent.systemPrompt || "",
        temperature: agent.temperature || 0.0,
        modelId: agent.modelId || null,
        voiceAgent: agent.voiceAgent || false,
        sttModelId: agent.sttModelId || "default",
        ttsModelId: agent.ttsModelId || "default",
      });
    }
  }, [agent, isEditMode]);

  // Role-based access control - check after all hooks
  if (!["instructor", "instructional", "admin"].includes(effectiveRole)) {
    return (
      <div className="flex items-center justify-center h-64">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-destructive">Access Denied</CardTitle>
            <CardDescription>
              You need instructor privileges or higher to access agent
              management.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name?.trim()) {
      toast.error("Agent name is required");
      return;
    }

    if (!formData.description?.trim()) {
      toast.error("Agent description is required");
      return;
    }

    if (!formData.systemPrompt?.trim()) {
      toast.error("System prompt is required");
      return;
    }

    if (!formData.modelId) {
      toast.error("Model selection is required");
      return;
    }

    setIsSubmitting(true);

    try {
      if (isEditMode) {
        await updateAgent(agentId!, {
          ...formData,
          updatedAt: new Date().toISOString(),
        });
        queryClient.invalidateQueries({ queryKey: ["agents"] });
        queryClient.invalidateQueries({ queryKey: ["agent", agentId] });
        toast.success("Agent updated successfully!");
      } else {
        const newAgent = await createAgent(formData as Agent);
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

  if (isFormLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </div>
        <div className="container mx-auto max-w-2xl">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-4 w-64" />
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (isEditMode && !agent) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Agent Not Found</h1>
          <p className="text-muted-foreground">
            The agent you're looking for doesn't exist.
          </p>
        </div>
        <Button onClick={() => router.push("/management/agents")}>
          Back to Agents
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 py-4 px-4">
      <div className="w-full">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Agent Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, name: e.target.value }))
              }
              placeholder="e.g., Enthusiastic Student Agent"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              value={formData.description || ""}
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
          </div>

          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Switch
                id="voiceAgent"
                checked={formData.voiceAgent || false}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({
                    ...prev,
                    voiceAgent: checked,
                    // Reset voice model selections when disabling voice
                    ...(checked
                      ? {}
                      : { sttModelId: "default", ttsModelId: "default" }),
                  }))
                }
              />
              <Label htmlFor="voiceAgent">
                {formData.voiceAgent ? "Voice Mode" : "Standard Mode"}
              </Label>
            </div>
          </div>

          <div
            className={`grid gap-4 ${formData.voiceAgent ? "grid-cols-1 md:grid-cols-3" : "grid-cols-1"}`}
          >
            <div className="space-y-2">
              <Label htmlFor="modelId">Text Model *</Label>
              {isModelsLoading ? (
                <Skeleton className="h-10 w-full" />
              ) : (
                <Select
                  value={formData.modelId || "default"}
                  onValueChange={(value) =>
                    setFormData((prev) => ({
                      ...prev,
                      modelId: value === "default" ? null : value,
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
                        (model) => model.active && model.modelType === "ttt"
                      )
                      ?.map((model) => (
                        <SelectItem key={model.id} value={model.id}>
                          {model.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {formData.voiceAgent && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="sttModelId">Speech-to-Text Model</Label>
                  {isModelsLoading ? (
                    <Skeleton className="h-10 w-full" />
                  ) : (
                    <Select
                      value={formData.sttModelId || "default"}
                      onValueChange={(value) =>
                        setFormData((prev) => ({
                          ...prev,
                          sttModelId: value === "default" ? null : value,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select STT model" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="default">Default</SelectItem>
                        {models
                          ?.filter(
                            (model) => model.active && model.modelType === "stt"
                          )
                          ?.map((model) => (
                            <SelectItem key={model.id} value={model.id}>
                              {model.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ttsModelId">Text-to-Speech Model</Label>
                  {isModelsLoading ? (
                    <Skeleton className="h-10 w-full" />
                  ) : (
                    <Select
                      value={formData.ttsModelId || "default"}
                      onValueChange={(value) =>
                        setFormData((prev) => ({
                          ...prev,
                          ttsModelId: value === "default" ? null : value,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select TTS model" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="default">Default</SelectItem>
                        {models
                          ?.filter(
                            (model) => model.active && model.modelType === "tts"
                          )
                          ?.map((model) => (
                            <SelectItem key={model.id} value={model.id}>
                              {model.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="temperature">
              Temperature: {(formData.temperature || 0).toFixed(2)}
            </Label>
            <Slider
              id="temperature"
              data-testid="temperature-slider"
              min={0}
              max={100}
              step={1}
              value={[(formData.temperature || 0) * 100]}
              onValueChange={(value) =>
                setFormData((prev) => ({
                  ...prev,
                  temperature: (value[0] || 0) / 100,
                }))
              }
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Deterministic</span>
              <span>Creative</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="systemPrompt">System Prompt *</Label>
            <Textarea
              id="systemPrompt"
              value={formData.systemPrompt || ""}
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
