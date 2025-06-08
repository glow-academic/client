/**
 * app/chat/agents/new/page.tsx
 * Agent creation page
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { createAgent } from "@/utils/mutations/create-agent";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function NewProfilePage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    subtitle: "",
    description: "",
    prompt: "",
    threshold: 50,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast.error("Profile name is required");
      return;
    }

    setIsSubmitting(true);
    
    try {
      const result = await createAgent(
        formData.name,
        formData.subtitle,
        formData.description,
        formData.prompt,
        formData.threshold
      );
      
      if (result.success) {
        toast.success("Agent created successfully!");
        router.push("/chat/agents");
      } else {
        toast.error(result.error || "Failed to create agent");
      }
    } catch (error) {
      console.error("Error creating agent:", error);
      toast.error("Failed to create agent");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
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
                  {isSubmitting ? "Creating..." : "Create Agent"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
