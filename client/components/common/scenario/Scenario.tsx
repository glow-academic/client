/**
 * Scenario.tsx
 * Enhanced scenario component for creating and editing scenarios
 * @AshokSaravanan222 & @siladiea
 * 05/20/2025
 */
"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, RotateCcw, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

// UI Components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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

// Custom Components
import { ScenarioPicker, type Model } from "./ScenarioPicker";
import { ScenarioSlider } from "./ScenarioSlider";

// Types and API functions
import { Agent, Class, Document, Scenario as ScenarioType } from "@/types";
import { createScenario } from "@/utils/mutations/scenarios/create-scenario";
import { updateScenario } from "@/utils/mutations/scenarios/update-scenario";
import { getAllAgents } from "@/utils/queries/agents/get-all-agents";
import { getAllClasses } from "@/utils/queries/classes/get-all-classes";
import { getAllDocuments } from "@/utils/queries/documents/get-all-documents";
import { getScenario } from "@/utils/queries/scenarios/get-scenario";
import { logError } from "@/utils/logger";

interface ScenarioProps {
  scenarioId?: string;
  mode?: "create" | "edit";
}

interface ScenarioFormData {
  name: string;
  description: string;
  agentId: string | null;
  classId: string | null;
  documents: string[];
  crowdedness: number | null;
  intensity: number | null;
  seniority: "freshman" | "sophomore" | "junior" | "senior" | null;
}

interface FormErrors {
  name?: string;
  description?: string;
  agentId?: string;
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
  const [showDocumentModal, setShowDocumentModal] = useState(false);
  const [previewDocument] = useState<Document | null>(null);
  const [editingScenarioId, setEditingScenarioId] = useState<string | null>(
    null
  );

  const initialFormData: ScenarioFormData = {
    name: "",
    description: "",
    agentId: null,
    classId: null,
    documents: [],
    crowdedness: null,
    intensity: null,
    seniority: null,
  };

  const [formData, setFormData] = useState<ScenarioFormData>(initialFormData);
  const [errors, setErrors] = useState<FormErrors>({});

  // State for playground functionality
  const [query, setQuery] = useState("");
  const [response, setResponse] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingScenario, setIsGeneratingScenario] = useState(false);
  const [seniorityExplicitlySet, setSeniorityExplicitlySet] = useState(false);

  // Data fetching
  const { data: documents = [] } = useQuery({
    queryKey: ["documents"],
    queryFn: () => getAllDocuments(),
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
    name: cls.classCode || cls.name,
    description: `${cls.name} - ${cls.term} ${cls.year}`,
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

  // Seniority models for picker
  const seniorityModels: Model[] = [
    {
      id: "freshman",
      name: "Freshman",
      description: "First-year student level",
      type: "Scenarios" as const,
      strengths: "Basic understanding, eager to learn",
    },
    {
      id: "sophomore",
      name: "Sophomore",
      description: "Second-year student level",
      type: "Scenarios" as const,
      strengths: "Some foundation knowledge, building confidence",
    },
    {
      id: "junior",
      name: "Junior",
      description: "Third-year student level",
      type: "Scenarios" as const,
      strengths: "Solid foundation, more independent learning",
    },
    {
      id: "senior",
      name: "Senior",
      description: "Fourth-year student level",
      type: "Scenarios" as const,
      strengths: "Advanced knowledge, preparing for career",
    },
  ];

  // Load scenario data if editing
  useEffect(() => {
    const targetScenarioId = scenarioId || editingScenarioId;
    if (targetScenarioId && scenario) {
      const scenarioData = scenario as ScenarioType;
      setFormData({
        name: scenarioData.name || "",
        description: scenarioData.description || "",
        agentId: scenarioData.agentId,
        classId: scenarioData.classId,
        documents: scenarioData.documents || [],
        crowdedness: scenarioData.crowdedness,
        intensity: scenarioData.intensity,
        seniority: scenarioData.seniority,
      });
      // Mark seniority as explicitly set if we're loading existing data and seniority is not null
      setSeniorityExplicitlySet(!!scenarioData.seniority);
    }
  }, [scenarioId, editingScenarioId, scenario]);

  // Event handlers
  const handleInputChange = (
    field: keyof ScenarioFormData,
    value: string | number | boolean | string[] | null | undefined
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleAgentSelect = (model: Model) => {
    handleInputChange("agentId", model.id === "" ? "" : model.id);
  };

  const handleClassSelect = (model: Model) => {
    handleInputChange("classId", model.id === "" ? "" : model.id);
  };

  const handleDocumentSelect = (model: Model) => {
    if (model.id === "") return; // Don't add empty selections for documents
    if (!formData.documents.includes(model.id)) {
      handleInputChange("documents", [...formData.documents, model.id]);
    }
  };

  const handleSenioritySelect = (model: Model) => {
    if (model.id === "") {
      // Clearing selection - reset to default but mark as not explicitly set
      handleInputChange("seniority", "freshman");
      setSeniorityExplicitlySet(false);
    } else {
      handleInputChange(
        "seniority",
        model.id as "freshman" | "sophomore" | "junior" | "senior"
      );
      setSeniorityExplicitlySet(true);
    }
  };

  const removeDocument = (documentId: string) => {
    handleInputChange(
      "documents",
      formData.documents.filter((id) => id !== documentId)
    );
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    // All fields are now optional, so we only validate format/range constraints
    if (
      formData.crowdedness &&
      (formData.crowdedness < 1 || formData.crowdedness > 10)
    ) {
      newErrors.crowdedness = "Crowdedness must be between 1 and 10";
    }

    if (
      formData.intensity &&
      (formData.intensity < 1 || formData.intensity > 10)
    ) {
      newErrors.intensity = "Intensity must be between 1 and 10";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Separate validation for testing - more permissive
  const validateForTesting = (): boolean => {
    return !!query.trim();
  };

  const resetFormAndState = () => {
    setFormData(initialFormData);
    setEditingScenarioId(null);
    setErrors({});
    setSeniorityExplicitlySet(false);
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        name: formData.name.trim() || "",
        description: formData.description.trim() || "",
        agentId: formData.agentId || null,
        classId: formData.classId || null,
        documents: formData.documents,
        crowdedness: formData.crowdedness || null,
        intensity: formData.intensity || null,
        seniority: formData.seniority || null,
      };

      const targetScenarioId = scenarioId || editingScenarioId;
      if (targetScenarioId) {
        await updateScenario(targetScenarioId, {
          ...payload,
          updatedAt: new Date().toISOString(),
        });
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
        `Failed to ${targetScenarioId ? "update" : "create"} scenario: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    } finally {
      setIsSubmitting(false);
    }
  };
  const handleGenerateScenario = async () => {
    // Allow generation with incomplete data - the AI can work with what's available
    setIsGeneratingScenario(true);

    try {
      const formDataToSend = new FormData();

      // Only append non-null values
      if (formData.agentId) {
        formDataToSend.append("agent_id", formData.agentId);
      }
      if (formData.classId) {
        formDataToSend.append("class_id", formData.classId);
      }
      formData.documents.forEach((docId) => {
        if (docId) {
          formDataToSend.append("document_ids", docId);
        }
      });
      if (formData.seniority) {
        formDataToSend.append("seniority", formData.seniority);
      }
      if (formData.crowdedness) {
        formDataToSend.append("crowdedness", formData.crowdedness.toString());
      }
      if (formData.intensity) {
        formDataToSend.append("intensity", formData.intensity.toString());
      }

      const response = await fetch(
        `${process.env["NEXT_PUBLIC_API_URL"]}/scenarios/new`,
        {
          method: "POST",
          body: formDataToSend,
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        setFormData((prev) => ({
          ...prev,
          name: result.title,
          description: result.description,
        }));
        toast.success("Scenario generated successfully!");
      } else {
        throw new Error(result.message || "Failed to generate scenario");
      }
    } catch (error) {
      logError("Error generating scenario:", error);
      toast.error(
        `Failed to generate scenario: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    } finally {
      setIsGeneratingScenario(false);
    }
  };

  const handleTestQuery = async () => {
    if (!query.trim()) {
      toast.error("Please enter a query to test");
      return;
    }

    if (!formData.agentId) {
      toast.error("Please select an agent to test with");
      return;
    }

    setIsGenerating(true);
    setResponse("");

    try {
      const formDataToSend = new FormData();
      formDataToSend.append("agent_id", formData.agentId);
      formDataToSend.append("description", formData.description || "");
      formDataToSend.append("query", query);

      const response = await fetch(
        `${process.env["NEXT_PUBLIC_API_URL"]}/scenarios/test`,
        {
          method: "POST",
          body: formDataToSend,
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("No response body");
      }

      let fullResponse = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = new TextDecoder().decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.text) {
                fullResponse += data.text;
                setResponse(fullResponse);
              } else if (data.error) {
                throw new Error(data.error);
              } else if (data.done) {
                // Stream completed successfully
                break;
              }
            } catch (parseError) {
              logError("Error parsing JSON:", parseError);
              // Skip malformed JSON lines
              continue;
            }
          }
        }
      }
    } catch (error) {
      logError("Error testing scenario:", error);
      toast.error(
        `Failed to test scenario: ${error instanceof Error ? error.message : "Unknown error"}`
      );
      setResponse("Error: Failed to generate response. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  // Loading state for edit mode
  if (isEditMode && isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Loading Scenario...</h1>
          <p className="text-muted-foreground">
            Please wait while we load the scenario data.
          </p>
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
        <Button onClick={() => router.push("/create/scenarios")}>
          Back to Scenarios
        </Button>
      </div>
    );
  }

  const selectedAgent = agents.find((agent) => agent.id === formData.agentId);
  const selectedClass = classes.find((cls) => cls.id === formData.classId);
  const selectedDocuments = documents.filter((doc) =>
    formData.documents.includes(doc.id)
  );

  // Create/Edit mode - render the playground-style layout with insert mode
  return (
    <>
      <div className="h-full flex flex-col">
        <div className="container h-full px-2 py-2">
          <div className="grid h-full items-stretch gap-6 lg:grid-cols-[1fr_280px]">
            {/* Configuration Sidebar */}
            <div className="hidden flex-col space-y-4 lg:flex lg:order-2 pt-3">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleInputChange("name", e.target.value)}
                  placeholder="e.g., Office Hours Help Session"
                  className={errors.name ? "border-destructive" : ""}
                />
                {errors.name && (
                  <p className="text-sm text-destructive">{errors.name}</p>
                )}
              </div>

              {/* Agent Selection */}
              <ScenarioPicker
                models={agentModels}
                types={["Agents"]}
                label="Agent"
                placeholder="Select an agent..."
                description="Choose the AI agent that will interact with students in this scenario."
                onSelect={handleAgentSelect}
                selectedModel={
                  selectedAgent
                    ? {
                        id: selectedAgent.id,
                        name: selectedAgent.name,
                        description: selectedAgent.description,
                        type: "Agents" as const,
                        strengths: selectedAgent.subtitle,
                      }
                    : undefined
                }
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
                description="Choose the class that this scenario will be used in. If no class is selected, the scenario will be available globally across all classes."
                onSelect={handleClassSelect}
                selectedModel={
                  selectedClass
                    ? {
                        id: selectedClass.id,
                        name: selectedClass.classCode || selectedClass.name,
                        description: `${selectedClass.name} - ${selectedClass.term} ${selectedClass.year}`,
                        type: "Classes" as const,
                        strengths: selectedClass.description || "",
                      }
                    : undefined
                }
              />

              {/* Document Selection */}
              <ScenarioPicker
                models={documentModels}
                types={["Documents"]}
                label="Documents"
                placeholder="Select documents..."
                description="Choose documents that will be available during this scenario."
                onSelect={handleDocumentSelect}
              />

              {/* Seniority Selection */}
              <ScenarioPicker
                models={seniorityModels}
                types={["Scenarios"]}
                label="Seniority"
                placeholder="Select student seniority"
                description="Choose the academic level of the student"
                onSelect={handleSenioritySelect}
                selectedModel={
                  seniorityExplicitlySet
                    ? seniorityModels.find(
                        (model) => model.id === formData.seniority
                      )
                    : undefined
                }
              />

              {/* Scenario Parameters */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Crowdedness</Label>
                    {formData.crowdedness !== null && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleInputChange("crowdedness", null)}
                        className="h-6 px-2 text-xs"
                      >
                        Clear
                      </Button>
                    )}
                  </div>
                  {formData.crowdedness !== null ? (
                    <ScenarioSlider
                      label=""
                      description="How busy or crowded the scenario environment should be"
                      min={1}
                      max={10}
                      step={1}
                      defaultValue={[formData.crowdedness]}
                      value={[formData.crowdedness]}
                      onValueChange={(value) =>
                        handleInputChange("crowdedness", value[0])
                      }
                    />
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => handleInputChange("crowdedness", 1)}
                      className="w-full"
                    >
                      Set Crowdedness
                    </Button>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Intensity</Label>
                    {formData.intensity !== null && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleInputChange("intensity", null)}
                        className="h-6 px-2 text-xs"
                      >
                        Clear
                      </Button>
                    )}
                  </div>
                  {formData.intensity !== null ? (
                    <ScenarioSlider
                      label=""
                      description="How intense or challenging the scenario should be"
                      min={1}
                      max={10}
                      step={1}
                      defaultValue={[formData.intensity]}
                      value={[formData.intensity]}
                      onValueChange={(value) =>
                        handleInputChange("intensity", value[0])
                      }
                    />
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => handleInputChange("intensity", 1)}
                      className="w-full"
                    >
                      Set Intensity
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Main Content Area */}
            <div className="lg:order-1">
              <div className="flex flex-col space-y-4 h-full">
                {/* Description */}
                <div className="space-y-3">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="description">Scenario</Label>
                      <HoverCard openDelay={200}>
                        <HoverCardTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleGenerateScenario}
                            disabled={isGeneratingScenario}
                            className="h-6 w-6 p-0"
                            title="Generate scenario with AI"
                          >
                            {isGeneratingScenario ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Sparkles className="h-4 w-4" />
                            )}
                          </Button>
                        </HoverCardTrigger>
                        <HoverCardContent
                          align="start"
                          className="w-[280px] text-sm"
                          side="right"
                        >
                          <div className="space-y-2">
                            <h4 className="font-medium">
                              AI Scenario Generator
                            </h4>
                            <p className="text-muted-foreground">
                              Generate a realistic scenario title and
                              description based on your selected agent, class,
                              documents, and parameters. The AI will create
                              contextually appropriate scenarios for student-GTA
                              interactions.
                            </p>
                          </div>
                        </HoverCardContent>
                      </HoverCard>
                    </div>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) =>
                        handleInputChange("description", e.target.value)
                      }
                      placeholder="Describe the scenario context, setting, and expected interactions... If left blank, the AI will generate a scenario for you."
                      className="min-h-[80px] resize-none"
                      rows={3}
                    />
                  </div>
                </div>

                {/* Playground Area - Match sidebar height */}
                <div className="flex-1 flex flex-col space-y-4">
                  <div className="grid h-full gap-4 grid-rows-2 lg:grid-cols-2 lg:grid-rows-1">
                    {/* Query Input */}
                    <div className="flex flex-col space-y-2">
                      <Textarea
                        id="query"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Enter a question or prompt to test how the agent responds in this scenario..."
                        className="h-full resize-none"
                      />
                    </div>

                    {/* Response Output */}
                    <div className="flex flex-col space-y-2">
                      <div className="h-full rounded-md border bg-muted p-4 overflow-auto">
                        {isGenerating ? (
                          <div className="flex items-center justify-center h-full">
                            <div className="text-sm text-muted-foreground">
                              Generating response...
                            </div>
                          </div>
                        ) : response ? (
                          <div className="text-sm whitespace-pre-wrap">
                            {response}
                          </div>
                        ) : (
                          <div className="flex items-center justify-center h-full">
                            <div className="text-sm text-muted-foreground">
                              Agent response will appear here after you submit a
                              query
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons - Aligned horizontally */}

                  {/* Selected Documents Display */}
                  {selectedDocuments.length > 0 && (
                    <div className="space-y-2">
                      <Label>
                        Selected Documents ({selectedDocuments.length})
                      </Label>
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
          <div className="flex items-center justify-between mt-4">
            <div className="flex items-center space-x-2">
              <Button
                onClick={handleTestQuery}
                disabled={isGenerating || !validateForTesting()}
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
            <Button onClick={handleSubmit} disabled={isSubmitting}>
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
