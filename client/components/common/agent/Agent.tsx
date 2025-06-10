/**
 * Agent.tsx
 * Used to create and manage agents - supports both creation and editing
 * @AshokSaravanan222 & @siladiea
 * 05/20/2025
 */
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { getAgent } from "@/utils/queries/agents/get-agent";
import { createAgent } from "@/utils/mutations/agents/create-agent";
import { updateAgent } from "@/utils/mutations/agents/update-agent";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AgentProps {
  agentId?: string;
  mode?: "create" | "edit";
}

interface AgentFormData {
  name: string;
  subtitle: string;
  description: string;
  systemPrompt: string;
  agentType: "default" | "student" | "ta";
  temperature: number;
}

export default function Agent({ 
  agentId, 
  mode = agentId ? "edit" : "create",
}: AgentProps) {
  const router = useRouter();
  const isEditMode = mode === "edit" && !!agentId;
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<AgentFormData>({
    name: "",
    subtitle: "",
    description: "",
    systemPrompt: "",
    agentType: "student",
    temperature: 0,
  });

  const { data: agent, isLoading } = useQuery({
    queryKey: ["agent", agentId],
    queryFn: () => getAgent(agentId!),
    enabled: isEditMode,
  });

  useEffect(() => {
    if (agent && isEditMode) {
      setFormData({
        name: agent.name || "",
        subtitle: agent.subtitle || "",
        description: agent.description || "",
        systemPrompt: agent.systemPrompt || "",
        agentType: agent.agentType || "student",
        temperature: agent.temperature || 0,
      });
    }
  }, [agent, isEditMode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast.error("Agent name is required");
      return;
    }

    if (!formData.subtitle.trim()) {
      toast.error("Agent subtitle is required");
      return;
    }

    if (!formData.description.trim()) {
      toast.error("Agent description is required");
      return;
    }

    if (!formData.systemPrompt.trim()) {
      toast.error("System prompt is required");
      return;
    }

    setIsSubmitting(true);
    
    try {
      if (isEditMode) {
        await updateAgent(agentId!, formData);
        toast.success("Agent updated successfully!");
      } else {
        await createAgent(formData);
        toast.success("Agent created successfully!");
      }

      router.push("/management/agents");
    } catch (error) {
      console.error(`Error ${isEditMode ? 'updating' : 'creating'} agent:`, error);
      toast.error(`Failed to ${isEditMode ? 'update' : 'create'} agent`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    router.push("/management/agents");
  };

  if (isEditMode && isLoading) {
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
          <p className="text-muted-foreground">The agent you're looking for doesn't exist.</p>
        </div>
        <Button onClick={() => router.push("/management/agents")}>
          Back to Agents
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          {isEditMode ? "Edit Agent" : "Create Agent"}
        </h1>
        <p className="text-muted-foreground">
          {isEditMode 
            ? "Modify the personality and behavior characteristics for this AI student agent"
            : "Create a new AI student agent with specific personality and behavior characteristics"
          }
        </p>
      </div>
      
      <div className="container mx-auto max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Agent Details</CardTitle>
            <CardDescription>
              Define the personality and behavior characteristics for this AI student agent.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Agent Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Enthusiastic Student Agent"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="subtitle">Subtitle *</Label>
                <Input
                  id="subtitle"
                  value={formData.subtitle}
                  onChange={(e) => setFormData(prev => ({ ...prev, subtitle: e.target.value }))}
                  placeholder="Brief description of the agent"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description *</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Detailed behavior description and personality traits"
                  rows={4}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="systemPrompt">System Prompt *</Label>
                <Textarea
                  id="systemPrompt"
                  value={formData.systemPrompt}
                  onChange={(e) => setFormData(prev => ({ ...prev, systemPrompt: e.target.value }))}
                  placeholder="System prompt that defines how the agent should behave and respond"
                  rows={6}
                  required
                />
                <p className="text-sm text-muted-foreground">
                  This prompt defines the agent's behavior and personality in conversations.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="agentType">Agent Type</Label>
                <Select
                  value={formData.agentType}
                  onValueChange={(value: "default" | "student" | "ta") => 
                    setFormData(prev => ({ ...prev, agentType: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select agent type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="student">Student</SelectItem>
                    <SelectItem value="ta">Teaching Assistant</SelectItem>
                    <SelectItem value="default">Default</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="temperature">Temperature</Label>
                <Input
                  id="temperature"
                  type="number"
                  min="0"
                  max="100"
                  value={formData.temperature}
                  onChange={(e) => setFormData(prev => ({ ...prev, temperature: parseInt(e.target.value) || 0 }))}
                />
                <p className="text-sm text-muted-foreground">
                  Temperature value for response randomness (0-100). Lower values are more deterministic.
                </p>
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancel}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting 
                    ? (isEditMode ? "Updating..." : "Creating...") 
                    : (isEditMode ? "Update Agent" : "Create Agent")
                  }
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
