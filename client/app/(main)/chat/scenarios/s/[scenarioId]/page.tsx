/**
 * app/scenario/s/[scenarioId]/page.tsx
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
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { UnifiedSidebar } from "@/components/unified-sidebar";

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
        router.push("/home?section=scenarios");
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
      <SidebarProvider>
        <UnifiedSidebar
          activeSection="scenarios"
          onSectionChange={() => {}}
        />
        <SidebarInset>
          <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <div className="flex flex-1 items-center justify-between">
              <div>
                <Skeleton className="h-6 w-32" />
              </div>
            </div>
          </header>
          <div className="flex flex-1 flex-col gap-4 p-4">
            <div className="container mx-auto max-w-2xl">
              <Card>
                <CardHeader>
                  <Skeleton className="h-6 w-32" />
                  <Skeleton className="h-4 w-64" />
                </CardHeader>
                <CardContent className="space-y-4">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-32 w-full" />
                </CardContent>
              </Card>
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    );
  }

  if (!scenario) {
    return (
      <SidebarProvider>
        <UnifiedSidebar
          activeSection="scenarios"
          onSectionChange={() => {}}
        />
        <SidebarInset>
          <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <div className="flex flex-1 items-center justify-between">
              <div>
                <h1 className="text-xl font-semibold">Scenario Not Found</h1>
              </div>
            </div>
          </header>
          <div className="flex flex-1 flex-col gap-4 p-4">
            <div className="container mx-auto max-w-2xl text-center">
              <h2 className="text-2xl font-bold">Scenario Not Found</h2>
              <p className="text-muted-foreground mt-2">
                The scenario you're looking for doesn't exist.
              </p>
              <Button 
                className="mt-4" 
                onClick={() => router.push("/home?section=scenarios")}
              >
                Back to Scenarios
              </Button>
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    );
  }

  return (
    <SidebarProvider>
      <UnifiedSidebar
        activeSection="scenarios"
        onSectionChange={() => {}} // No-op since we're on a dedicated page
      />
      <SidebarInset>
        {/* Header */}
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <div className="flex flex-1 items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold">Edit Scenario</h1>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <div className="flex flex-1 flex-col gap-4 p-4">
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
                      onClick={() => router.push("/home?section=scenarios")}
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
      </SidebarInset>
    </SidebarProvider>
  );
}
