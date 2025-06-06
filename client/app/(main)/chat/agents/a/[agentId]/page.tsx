/**
 * app/chat/profiles/p/[profileId]/page.tsx
 * Profile editing page
 */
"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { getAgent } from "@/utils/queries/get-agent";
import { updateAgent } from "@/utils/mutations/update-agent";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function EditProfilePage() {
  const params = useParams();
  const router = useRouter();
  const agentId = params.agentId as string;
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    subtitle: "",
    description: "",
    prompt: "",
    threshold: 50,
  });

  const { data: agent, isLoading } = useQuery({
    queryKey: ["agent", agentId],
    queryFn: () => getAgent(agentId),
    enabled: !!agentId,
  });

  useEffect(() => {
    if (agent) {
      setFormData({
        name: agent.name || "",
        subtitle: agent.subtitle || "",
        description: agent.description || "",
        prompt: agent.prompt || "",
        threshold: agent.threshold || 50,
      });
    }
  }, [agent]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast.error("Profile name is required");
      return;
    }

    setIsSubmitting(true);
    
    try {
      const result = await updateAgent(
        agentId,
        formData.name,
        formData.subtitle,
        formData.description,
        formData.prompt,
        formData.threshold
      );
      
      if (result.success) {
        toast.success("Agent updated successfully!");
        router.push("/chat/agents");
      } else {
        toast.error(result.error || "Failed to update agent");
      }
    } catch (error) {
      console.error("Error updating agent:", error);
      toast.error("Failed to update agent");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
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
              <Skeleton className="h-10 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Agent Not Found</h1>
          <p className="text-muted-foreground">The agent you're looking for doesn't exist.</p>
        </div>
        <Button onClick={() => router.push("/chat/agents")}>
          Back to Agents
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="container mx-auto max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Agent Details</CardTitle>
            <CardDescription>
              Modify the personality and behavior characteristics for this AI student agent.
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
                <Label htmlFor="subtitle">Subtitle</Label>
                <Input
                  id="subtitle"
                  value={formData.subtitle}
                  onChange={(e) => setFormData(prev => ({ ...prev, subtitle: e.target.value }))}
                  placeholder="Brief description of the agent"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Detailed behavior description and personality traits"
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="threshold">Threshold (%)</Label>
                <Input
                  id="threshold"
                  type="number"
                  min="0"
                  max="100"
                  value={formData.threshold}
                  onChange={(e) => setFormData(prev => ({ ...prev, threshold: parseInt(e.target.value) || 0 }))}
                />
                <p className="text-sm text-muted-foreground">
                  Threshold value for agent activation (0-100)
                </p>
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push("/chat/agents")}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Updating..." : "Update Agent"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
