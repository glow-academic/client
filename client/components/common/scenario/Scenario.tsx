/**
 * Scenario.tsx
 * Used to create and manage scenarios - supports both creation and editing
 * @AshokSaravanan222 & @siladiea
 * 05/20/2025
 */
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { getScenario } from "@/utils/queries/scenarios/get-scenario";
import { createScenario } from "@/utils/mutations/scenarios/create-scenario";
import { updateScenario } from "@/utils/mutations/scenarios/update-scenario";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface ScenarioProps {
  scenarioId?: string;
  mode?: "create" | "edit";
}

export default function Scenario({
  scenarioId,
  mode = scenarioId ? "edit" : "create",
}: ScenarioProps) {
  const router = useRouter();
  const isEditMode = mode === "edit" && !!scenarioId;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
  });

  // Only fetch scenario data if in edit mode
  const { data: scenario, isLoading } = useQuery({
    queryKey: ["scenario", scenarioId],
    queryFn: () => getScenario(scenarioId!),
    enabled: isEditMode,
  });

  useEffect(() => {
    if (isEditMode && scenario) {
      setFormData({
        name: scenario.name || "",
        description: scenario.description || "",
      });
    }
  }, [scenario, isEditMode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error("Scenario name is required");
      return;
    }

    setIsSubmitting(true);

    try {
      if (isEditMode) {
        await updateScenario(scenarioId!, formData);
        toast.success("Scenario updated successfully!");
      } else {
        // For creation, we need to provide the required fields
        // Note: agentId, crowdedness, intensity, and seniority are required by the schema
        // but for now we'll use default values. This should be enhanced based on your needs.
        const scenarioData = {
          name: formData.name,
          description: formData.description,
          agentId: "11111111-aaaa-aaaa-aaaa-111111111111", // Default agent ID - should be configurable
          crowdedness: 1,
          intensity: 1,
          seniority: "freshman" as const,
        };

        await createScenario(scenarioData);
        toast.success("Scenario created successfully!");
      }

      router.push("/create/scenarios");
    } catch (error) {
      console.error(
        `Error ${isEditMode ? "updating" : "creating"} scenario:`,
        error,
      );
      toast.error(`Failed to ${isEditMode ? "update" : "create"} scenario`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    router.push("/create/scenarios");
  };

  // Loading state for edit mode
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
              <Skeleton className="h-20 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Error state for edit mode when scenario not found
  if (isEditMode && !isLoading && !scenario) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Scenario Not Found</h1>
          <p className="text-muted-foreground">
            The scenario you're looking for doesn't exist.
          </p>
        </div>
        <Button onClick={handleCancel}>Back to Scenarios</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          {isEditMode ? "Edit Scenario" : "Create Scenario"}
        </h1>
        <p className="text-muted-foreground">
          {isEditMode
            ? "Modify the context and setting for this conversation scenario"
            : "Create a new conversation scenario"}
        </p>
      </div>

      <div className="container mx-auto max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Scenario Details</CardTitle>
            <CardDescription>
              {isEditMode
                ? "Modify the context and setting for this conversation scenario."
                : "Define the context and setting for this conversation scenario."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Scenario Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="e.g., Office Hours Help Session"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  placeholder="Describe the scenario context, setting, and expected interactions"
                  rows={6}
                />
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
                    ? isEditMode
                      ? "Updating..."
                      : "Creating..."
                    : isEditMode
                      ? "Update Scenario"
                      : "Create Scenario"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
