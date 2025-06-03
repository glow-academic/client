/**
 * app/chat/scenarios/s/[scenarioId]/page.tsx
 * Scenario editing page
 */
"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { getScenario } from "@/utils/queries/get-scenario";
import { updateScenario } from "@/utils/mutations/update-scenario";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function EditScenarioPage() {
  const params = useParams();
  const router = useRouter();
  const scenarioId = params.scenarioId as string;
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
  });

  const { data: scenario, isLoading } = useQuery({
    queryKey: ["scenario", scenarioId],
    queryFn: () => getScenario(scenarioId),
    enabled: !!scenarioId,
  });

  useEffect(() => {
    if (scenario) {
      setFormData({
        name: scenario.name || "",
        description: scenario.description || "",
      });
    }
  }, [scenario]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast.error("Scenario name is required");
      return;
    }

    setIsSubmitting(true);
    
    try {
      const result = await updateScenario(
        scenarioId,
        formData.name,
        formData.description
      );
      
      if (result.success) {
        toast.success("Scenario updated successfully!");
        router.push("/chat/scenarios");
      } else {
        toast.error(result.error || "Failed to update scenario");
      }
    } catch (error) {
      console.error("Error updating scenario:", error);
      toast.error("Failed to update scenario");
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
              <Skeleton className="h-20 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!scenario) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Scenario Not Found</h1>
          <p className="text-muted-foreground">The scenario you're looking for doesn't exist.</p>
        </div>
        <Button onClick={() => router.push("/chat/scenarios")}>
          Back to Scenarios
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="container mx-auto max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Scenario Details</CardTitle>
            <CardDescription>
              Modify the context and setting for this conversation scenario.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Scenario Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Office Hours Help Session"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe the scenario context, setting, and expected interactions"
                  rows={6}
                />
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push("/chat/scenarios")}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Updating..." : "Update Scenario"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
