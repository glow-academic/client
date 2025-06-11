/**
 * Scenario.tsx
 * Enhanced scenario component for creating and editing scenarios
 * @AshokSaravanan222 & @siladiea
 * 05/20/2025
 */
"use client";
import React, { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2, Edit, FileText, RotateCcw } from "lucide-react";

// UI Components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Custom Components
import { ScenarioPicker, type Model } from "./ScenarioPicker";
import { ScenarioSlider } from "./ScenarioSlider";

// Types and API functions
import { Document, Agent, Class, type Scenario } from "@/types";
import { getAllDocuments } from "@/utils/queries/documents/get-all-documents";
import { getAllScenarios } from "@/utils/queries/scenarios/get-all-scenarios";
import { getAllAgents } from "@/utils/queries/agents/get-all-agents";
import { getAllClasses } from "@/utils/queries/classes/get-all-classes";
import { getScenario } from "@/utils/queries/scenarios/get-scenario";
import { createScenario } from "@/utils/mutations/scenarios/create-scenario";
import { updateScenario } from "@/utils/mutations/scenarios/update-scenario";
import { deleteScenario } from "@/utils/mutations/scenarios/delete-scenario";

interface ScenarioProps {
  scenarioId?: string;
  mode?: "create" | "edit" | "list";
}

interface ScenarioFormData {
  name: string;
  description: string;
  agentId: string;
  classId: string;
  documents: string[];
  crowdedness: number;
  intensity: number;
  seniority: "freshman" | "sophomore" | "junior" | "senior";
}

interface FormErrors {
  name?: string;
  description?: string;
  agentId?: string;
  classId?: string;
  documents?: string;
  crowdedness?: string;
  intensity?: string;
}

export default function Scenario({
  mode = "create",
  scenarioId,
}: ScenarioProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const isEditMode = mode === "edit" && !!scenarioId;

  // State management
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [scenarioToDelete, setScenarioToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDocumentModal, setShowDocumentModal] = useState(false);
  const [previewDocument] = useState<Document | null>(null);
  const [editingScenarioId, setEditingScenarioId] = useState<string | null>(null);

  const initialFormData: ScenarioFormData = {
    name: "",
    description: "",
    agentId: "",
    classId: "",
    documents: [],
    crowdedness: 1,
    intensity: 1,
    seniority: "freshman",
  };

  const [formData, setFormData] = useState<ScenarioFormData>(initialFormData);
  const [errors, setErrors] = useState<FormErrors>({});

  // Data fetching
  const { data: documents = [] } = useQuery({
    queryKey: ["documents"],
    queryFn: () => getAllDocuments(),
  });

  const { data: scenarios = [] } = useQuery({
    queryKey: ["scenarios"],
    queryFn: () => getAllScenarios(),
  });

  const { data: agents = [] } = useQuery({
    queryKey: ["agents"],
    queryFn: () => getAllAgents(),
  });

  const { data: classes = [] } = useQuery({
    queryKey: ["classes"],
    queryFn: () => getAllClasses(),
  });

  // Only fetch scenario data if in edit mode
  const { data: scenario, isLoading } = useQuery({
    queryKey: ["scenario", scenarioId],
    queryFn: () => getScenario(scenarioId!),
    enabled: isEditMode,
  });

  // Convert database data to model format for pickers
  const agentModels: Model[] = agents.map((agent: Agent) => ({
    id: agent.id,
    name: agent.name,
    description: agent.description,
    type: "Agents" as const,
    strengths: agent.subtitle,
  }));

  const classModels: Model[] = classes.map((cls: Class) => ({
    id: cls.id,
    name: cls.name,
    description: `${cls.term} ${cls.year}`,
    type: "Classes" as const,
    strengths: cls.description || "",
  }));

  const documentModels: Model[] = documents.map((doc: Document) => ({
    id: doc.id,
    name: doc.name,
    description: `${doc.type} document`,
    type: "Documents" as const,
    strengths: doc.mimeType,
  }));

  // Load scenario data if editing
  useEffect(() => {
    const targetScenarioId = scenarioId || editingScenarioId;
    if (targetScenarioId && scenario) {
      const scenarioData = scenario as any;
      setFormData({
        name: scenarioData.name || "",
        description: scenarioData.description || "",
        agentId: scenarioData.agentId || "",
        classId: scenarioData.classId || "",
        documents: scenarioData.documents || [],
        crowdedness: scenarioData.crowdedness || 1,
        intensity: scenarioData.intensity || 1,
        seniority: scenarioData.seniority || "freshman",
      });
    }
  }, [scenarioId, editingScenarioId, scenario]);

  // Event handlers
  const handleInputChange = (
    field: keyof ScenarioFormData,
    value: string | number | boolean | string[],
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleAgentSelect = (model: Model) => {
    handleInputChange("agentId", model.id);
  };

  const handleClassSelect = (model: Model) => {
    handleInputChange("classId", model.id);
  };

  const handleDocumentSelect = (model: Model) => {
    if (!formData.documents.includes(model.id)) {
      handleInputChange("documents", [...formData.documents, model.id]);
    }
  };

  const removeDocument = (documentId: string) => {
    handleInputChange("documents", formData.documents.filter(id => id !== documentId));
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = "Name is required";
    }

    if (!formData.agentId) {
      newErrors.agentId = "An agent must be selected";
    }

    if (!formData.classId) {
      newErrors.classId = "A class must be selected";
    }

    if (formData.crowdedness < 1 || formData.crowdedness > 10) {
      newErrors.crowdedness = "Crowdedness must be between 1 and 10";
    }

    if (formData.intensity < 1 || formData.intensity > 10) {
      newErrors.intensity = "Intensity must be between 1 and 10";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const resetFormAndState = () => {
    setFormData(initialFormData);
    setEditingScenarioId(null);
    setErrors({});
  };

  const handleEditScenarioClick = (scenarioId: string) => {
    setEditingScenarioId(scenarioId);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        name: formData.name,
        description: formData.description,
        agentId: formData.agentId,
        classId: formData.classId,
        documents: formData.documents,
        crowdedness: formData.crowdedness,
        intensity: formData.intensity,
        seniority: formData.seniority,
      };

      const targetScenarioId = scenarioId || editingScenarioId;
      if (targetScenarioId) {
        await updateScenario(targetScenarioId, payload);
        toast.success("Scenario updated successfully!");
      } else {
        await createScenario(payload);
        toast.success("Scenario created successfully!");
      }

      resetFormAndState();
      queryClient.invalidateQueries({ queryKey: ["scenarios"] });
      
      // Navigate back to scenarios list
      router.push("/create/scenarios");
    } catch (error) {
      const targetScenarioId = scenarioId || editingScenarioId;
      toast.error(
        `Failed to ${targetScenarioId ? "update" : "create"} scenario: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteScenario = async () => {
    if (!scenarioToDelete) return;

    try {
      setIsDeleting(true);
      toast.loading("Deleting scenario...");

      await deleteScenario(scenarioToDelete);

      queryClient.invalidateQueries({ queryKey: ["scenarios"] });

      toast.dismiss();
      toast.success("Scenario deleted successfully");
      setShowDeleteDialog(false);
      setScenarioToDelete(null);
    } catch (error) {
      console.error("Error deleting scenario:", error);
      toast.dismiss();
      toast.error(
        `Failed to delete scenario: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } finally {
      setIsDeleting(false);
    }
  };

  // Loading state for edit mode
  if (isEditMode && isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Loading Scenario...</h1>
          <p className="text-muted-foreground">Please wait while we load the scenario data.</p>
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
        <Button onClick={() => router.push("/create/scenarios")}>Back to Scenarios</Button>
      </div>
    );
  }



  if (mode === "list") {
    return (
      <div className="space-y-6">
        <div className="grid gap-4">
          {scenarios.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No scenarios found</h3>
                <p className="text-muted-foreground text-center mb-4">
                  Create your first scenario to get started with student interactions.
                </p>
              </CardContent>
            </Card>
          ) : (
            scenarios.map((scenario: any) => (
              <Card key={scenario.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <CardTitle className="text-lg">{scenario.name}</CardTitle>
                      <CardDescription>
                        {scenario.description && (
                          <p className="text-sm mb-2">{scenario.description}</p>
                        )}
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>Crowdedness: {scenario.crowdedness}/10</span>
                          <span>Intensity: {scenario.intensity}/10</span>
                        </div>
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Badge variant="outline">
                        {scenario.seniority.charAt(0).toUpperCase() + scenario.seniority.slice(1)}
                      </Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditScenarioClick(scenario.id)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setScenarioToDelete(scenario.id);
                          setShowDeleteDialog(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            ))
          )}
        </div>

        {/* Delete confirmation dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Scenario</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this scenario? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteScenario}
                disabled={isDeleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  const selectedAgent = agents.find(agent => agent.id === formData.agentId);
  const selectedClass = classes.find(cls => cls.id === formData.classId);
  const selectedDocuments = documents.filter(doc => formData.documents.includes(doc.id));

  // State for playground functionality
  const [query, setQuery] = useState("");
  const [response, setResponse] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const handleTestQuery = async () => {
    if (!query.trim() || !selectedAgent) {
      toast.error("Please enter a query and select an agent");
      return;
    }

    setIsGenerating(true);
    try {
      // TODO: Implement actual API call to test the scenario
      // For now, simulate a response
      await new Promise(resolve => setTimeout(resolve, 1500));
      setResponse(`Agent Response: This is a simulated response to "${query}". The ${selectedAgent.name} agent would respond based on the scenario context: ${formData.description || "No scenario description provided"}.`);
    } catch (error) {
      toast.error("Failed to generate response");
    } finally {
      setIsGenerating(false);
    }
  };

  // Create/Edit mode - render the playground-style layout with insert mode
  return (
    <>
      <div className="hidden h-full flex-col md:flex">
        <div className="container h-full py-6">
          <div className="grid h-full items-stretch gap-6 md:grid-cols-[1fr_200px]">
            {/* Configuration Sidebar */}
            <div className="hidden flex-col space-y-4 sm:flex md:order-2">
              <div className="grid gap-2">
                <HoverCard openDelay={200}>
                  <HoverCardTrigger asChild>
                    <span className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      Configuration
                    </span>
                  </HoverCardTrigger>
                  <HoverCardContent className="w-[320px] text-sm" side="left">
                    Configure the scenario parameters including agent selection, class assignment, 
                    document references, and difficulty settings.
                  </HoverCardContent>
                </HoverCard>
              </div>

              {/* Agent Selection */}
              <ScenarioPicker
                models={agentModels}
                types={["Agents"]}
                label="Agent"
                placeholder="Select an agent..."
                description="Choose the AI agent that will interact with students in this scenario."
                onSelect={handleAgentSelect}
                selectedModel={selectedAgent ? {
                  id: selectedAgent.id,
                  name: selectedAgent.name,
                  description: selectedAgent.description,
                  type: "Agents" as const,
                  strengths: selectedAgent.subtitle,
                } : undefined}
              />
              {errors.agentId && (
                <p className="text-sm text-destructive">{errors.agentId}</p>
              )}

              {/* Class Selection */}
              <ScenarioPicker
                models={classModels}
                types={["Classes"]}
                label="Class"
                placeholder="Select a class..."
                description="Choose the class that this scenario will be used in."
                onSelect={handleClassSelect}
                selectedModel={selectedClass ? {
                  id: selectedClass.id,
                  name: selectedClass.name,
                  description: `${selectedClass.term} ${selectedClass.year}`,
                  type: "Classes" as const,
                  strengths: selectedClass.description || "",
                } : undefined}
              />
              {errors.classId && (
                <p className="text-sm text-destructive">{errors.classId}</p>
              )}

              {/* Seniority Selection */}
              <div className="grid gap-2">
                <Label className="text-sm font-medium">Student Seniority</Label>
                <Select
                  value={formData.seniority}
                  onValueChange={(value: "freshman" | "sophomore" | "junior" | "senior") =>
                    handleInputChange("seniority", value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select seniority level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="freshman">Freshman</SelectItem>
                    <SelectItem value="sophomore">Sophomore</SelectItem>
                    <SelectItem value="junior">Junior</SelectItem>
                    <SelectItem value="senior">Senior</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Document Selection */}
              <ScenarioPicker
                models={documentModels}
                types={["Documents"]}
                label="Documents"
                placeholder="Select documents..."
                description="Choose documents that will be available during this scenario."
                onSelect={handleDocumentSelect}
              />

              {/* Scenario Parameters */}
              <ScenarioSlider
                label="Crowdedness"
                description="How busy or crowded the scenario environment should be"
                min={1}
                max={10}
                step={1}
                defaultValue={[formData.crowdedness]}
                value={[formData.crowdedness]}
                onValueChange={(value) => handleInputChange("crowdedness", value[0])}
              />

              <ScenarioSlider
                label="Intensity"
                description="How intense or challenging the scenario should be"
                min={1}
                max={10}
                step={1}
                defaultValue={[formData.intensity]}
                value={[formData.intensity]}
                onValueChange={(value) => handleInputChange("intensity", value[0])}
              />
            </div>

            {/* Main Content Area */}
            <div className="md:order-1">
              <div className="flex flex-col space-y-4 h-full">
                {/* Scenario Name and Description at the top */}
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="name">Scenario Name</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => handleInputChange("name", e.target.value)}
                      placeholder="e.g., Office Hours Help Session"
                      className={errors.name ? "border-destructive" : ""}
                      required
                    />
                    {errors.name && (
                      <p className="text-sm text-destructive">{errors.name}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Scenario Description</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => handleInputChange("description", e.target.value)}
                      placeholder="Describe the scenario context, setting, and expected interactions..."
                      className="min-h-[80px] resize-none"
                      rows={3}
                    />
                  </div>
                </div>

                {/* Playground Area - Half and Half Split */}
                <div className="flex-1 flex flex-col space-y-4">
                  <div className="grid h-full grid-rows-2 gap-4 lg:grid-cols-2 lg:grid-rows-1">
                    {/* Query Input */}
                    <div className="flex flex-col space-y-2">
                      <Label htmlFor="query">Test Query</Label>
                      <Textarea
                        id="query"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Enter a question or prompt to test how the agent responds in this scenario..."
                        className="h-full min-h-[200px] lg:min-h-[300px] resize-none"
                      />
                    </div>

                    {/* Response Output */}
                    <div className="flex flex-col space-y-2">
                      <Label>Agent Response</Label>
                      <div className="h-full min-h-[200px] lg:min-h-[300px] rounded-md border bg-muted p-4 overflow-auto">
                        {isGenerating ? (
                          <div className="flex items-center justify-center h-full">
                            <div className="text-sm text-muted-foreground">Generating response...</div>
                          </div>
                        ) : response ? (
                          <div className="text-sm whitespace-pre-wrap">{response}</div>
                        ) : (
                          <div className="flex items-center justify-center h-full">
                            <div className="text-sm text-muted-foreground">
                              Agent response will appear here after you submit a query
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Button 
                        onClick={handleTestQuery} 
                        disabled={isGenerating || !query.trim() || !selectedAgent}
                      >
                        {isGenerating ? "Generating..." : "Test Query"}
                      </Button>
                      <Button 
                        variant="secondary"
                        onClick={() => {
                          setQuery("");
                          setResponse("");
                        }}
                        disabled={isGenerating}
                      >
                        <span className="sr-only">Clear</span>
                        <RotateCcw />
                      </Button>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Button 
                        variant="outline"
                        onClick={() => router.push("/create/scenarios")}
                        disabled={isSubmitting}
                      >
                        Cancel
                      </Button>
                      <Button 
                        onClick={handleSubmit} 
                        disabled={isSubmitting}
                      >
                        {isSubmitting
                          ? isEditMode
                            ? "Updating..."
                            : "Creating..."
                          : isEditMode
                            ? "Update Scenario"
                            : "Save Scenario"}
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Selected Documents Display */}
                {selectedDocuments.length > 0 && (
                  <div className="space-y-2">
                    <Label>Selected Documents ({selectedDocuments.length})</Label>
                    <div className="flex flex-wrap gap-2">
                      {selectedDocuments.map((doc) => (
                        <div
                          key={doc.id}
                          className="flex items-center gap-2 bg-secondary px-3 py-1 rounded-md text-sm"
                        >
                          <span>{doc.name}</span>
                          <button
                            type="button"
                            onClick={() => removeDocument(doc.id)}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Document Preview Modal */}
      <Dialog open={showDocumentModal} onOpenChange={setShowDocumentModal}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>Document Preview: {previewDocument?.name}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden">
            {previewDocument && (
              <div className="p-4 bg-muted rounded-md">
                <p className="text-sm text-muted-foreground">
                  Document preview would be displayed here
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
} 