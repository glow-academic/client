/**
 * ScenarioWizard.tsx
 * Progressive step-by-step scenario creation flow
 * @AshokSaravanan222 & @siladiea
 * 05/20/2025
 */
"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronRight, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

// UI Components
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

// Custom Components
import { ScenarioPicker, type Model } from "./ScenarioPicker";
import { ScenarioSlider } from "./ScenarioSlider";

// Types and API functions
import { Agent, Class, Document, Scenario as ScenarioType } from "@/types";
import { newScenario } from "@/utils/api/scenarios/new-scenario";
import { logError } from "@/utils/logger";
import { createScenario } from "@/utils/mutations/scenarios/create-scenario";
import { updateScenario } from "@/utils/mutations/scenarios/update-scenario";
import { getAllAgents } from "@/utils/queries/agents/get-all-agents";
import { getAllClasses } from "@/utils/queries/classes/get-all-classes";
import { getAllDocuments } from "@/utils/queries/documents/get-all-documents";
import { getScenario } from "@/utils/queries/scenarios/get-scenario";

interface ScenarioProps {
  scenarioId?: string;
  mode?: "create" | "edit";
}

type StepStatus = "pending" | "active" | "completed";

interface Step {
  id: string;
  title: string;
  description: string;
  status: StepStatus;
  optional?: boolean;
}

export default function Scenario({
  mode = "create",
  scenarioId,
}: ScenarioProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const isEditMode = mode === "edit" && !!scenarioId;

  // Form data state
  const initialFormData: Partial<ScenarioType> = {
    classId: null,
    documents: [],
    agentId: null,
    seniority: null,
    crowdedness: null,
    intensity: null,
    location: null,
    tod: null,
    urgency: null,
    name: "",
    description: "",
  };

  const [formData, setFormData] =
    useState<Partial<ScenarioType>>(initialFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingScenario, setIsGeneratingScenario] = useState(false);

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

  // Load scenario data if editing
  useEffect(() => {
    if (isEditMode && scenario) {
      setFormData({
        classId: scenario.classId,
        documents: scenario.documents || [],
        agentId: scenario.agentId,
        seniority: scenario.seniority,
        crowdedness: scenario.crowdedness,
        intensity: scenario.intensity,
        location: scenario.location,
        tod: scenario.tod,
        urgency: scenario.urgency,
        name: scenario.name || "",
        description: scenario.description || "",
      });
    }
  }, [isEditMode, scenario]);

  // Calculate step status
  const getStepStatus = (stepId: string): StepStatus => {
    switch (stepId) {
      case "class":
        return formData.classId ? "completed" : "active";
      case "documents":
        return !formData.classId
          ? "pending"
          : formData.documents && formData.documents.length > 0
            ? "completed"
            : "active";
      case "agent":
        return !formData.classId
          ? "pending"
          : formData.agentId
            ? "completed"
            : "active";
      case "context":
        return !formData.agentId
          ? "pending"
          : formData.seniority || formData.crowdedness || formData.intensity
            ? "completed"
            : "active";
      case "environment":
        return !formData.agentId
          ? "pending"
          : formData.location || formData.tod || formData.urgency
            ? "completed"
            : "active";
      case "content":
        return !formData.agentId
          ? "pending"
          : formData.description
            ? "completed"
            : "active";
      default:
        return "pending";
    }
  };

  const steps: Step[] = [
    {
      id: "class",
      title: "Select Class",
      description: "Choose the class this scenario will be used in",
      status: getStepStatus("class"),
    },
    {
      id: "documents",
      title: "Choose Documents",
      description: "Select relevant documents for this scenario",
      status: getStepStatus("documents"),
      optional: true,
    },
    {
      id: "agent",
      title: "Select Agent Type",
      description: "Choose the type of AI agent for this scenario",
      status: getStepStatus("agent"),
    },
    {
      id: "context",
      title: "Set Context",
      description: "Configure student level and scenario parameters",
      status: getStepStatus("context"),
      optional: true,
    },
    {
      id: "environment",
      title: "Environment Details",
      description: "Set location, timing, and urgency",
      status: getStepStatus("environment"),
      optional: true,
    },
    {
      id: "content",
      title: "Generate Content",
      description: "AI will create a realistic scenario description",
      status: getStepStatus("content"),
    },
  ];

  // Convert database data to model format
  const classModels: Model[] = classes.map((cls: Class) => ({
    id: cls.id,
    name: cls.classCode || cls.name,
    description: `${cls.name} - ${cls.term} ${cls.year}`,
    type: "Classes" as const,
    strengths: cls.description || "",
  }));

  const documentModels: Model[] = documents
    .filter((doc) => !formData.classId || doc.classId === formData.classId)
    .map((doc: Document) => ({
      id: doc.id,
      name: doc.name,
      description: `${doc.type} document`,
      type: "Documents" as const,
      strengths: doc.mimeType,
    }));

  const agentModels: Model[] = agents
    .filter(
      (agent: Agent) =>
        agent.name.toLowerCase() === "aggressive" ||
        agent.name.toLowerCase() === "happy" ||
        agent.name.toLowerCase() === "confused"
    )
    .map((agent: Agent) => ({
      id: agent.id,
      name: agent.name,
      description: agent.description,
      type: "Agents" as const,
    }));

  // Event handlers
  const handleInputChange = (
    field: keyof Partial<ScenarioType>,
    value: string | number | string[] | null
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleGenerateScenario = async () => {
    setIsGeneratingScenario(true);

    try {
      const result = await newScenario({
        agentId: formData.agentId || null,
        classId: formData.classId || null,
        documentIds: formData.documents || [],
        seniority: formData.seniority || null,
        crowdedness: formData.crowdedness || null,
        intensity: formData.intensity || null,
        location: formData.location || null,
        tod: formData.tod || null,
        urgency: formData.urgency || null,
      });

      if (!result.success) {
        throw new Error(result.message || "Failed to generate scenario");
      }

      if (result.title || result.description) {
        setFormData((prev) => ({
          ...prev,
          name: result.title || prev.name || "",
          description: result.description || prev.description || "",
        }));
        toast.success("Scenario generated successfully!");
      } else {
        throw new Error("No scenario content was generated");
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

  const handleSubmit = async () => {
    setIsSubmitting(true);

    try {
      const payload = {
        name: formData.name?.trim() || "",
        description: formData.description?.trim() || "",
        agentId: formData.agentId,
        classId: formData.classId,
        documents: formData.documents,
        crowdedness: formData.crowdedness,
        intensity: formData.intensity,
        seniority: formData.seniority,
        location: formData.location,
        tod: formData.tod,
        urgency: formData.urgency,
      };

      if (isEditMode) {
        await updateScenario(scenarioId!, {
          ...payload,
          updatedAt: new Date().toISOString(),
        });
        toast.success("Scenario updated successfully!");
      } else {
        await createScenario(payload);
        toast.success("Scenario created successfully!");
      }

      queryClient.invalidateQueries({ queryKey: ["scenarios"] });
      router.push("/create/scenarios");
    } catch (error) {
      toast.error(
        `Failed to ${isEditMode ? "update" : "create"} scenario: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    } finally {
      setIsSubmitting(false);
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

  const selectedClass = classes.find((cls) => cls.id === formData.classId);
  const selectedDocuments = documents.filter((doc) =>
    formData.documents?.includes(doc.id)
  );
  const selectedAgent = agents.find((agent) => agent.id === formData.agentId);

  return (
    <div className="w-full p-6 space-y-8">
      {/* Progress Flow */}
      <div className="space-y-6">
        {/* Step 1: Class Selection */}
        <Card
          className={`transition-all ${!isEditMode && getStepStatus("class") === "active" ? "ring-2 ring-primary" : ""} ${
            !isEditMode && getStepStatus("class") === "pending"
              ? "opacity-50"
              : ""
          }`}
        >
          <CardHeader className="flex flex-row items-center space-y-0 pb-4">
            <div className="flex items-center space-x-3">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  getStepStatus("class") === "completed"
                    ? "bg-green-500 text-white"
                    : getStepStatus("class") === "active"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                }`}
              >
                {getStepStatus("class") === "completed" ? (
                  <Check className="w-4 h-4" />
                ) : (
                  "1"
                )}
              </div>
              <div>
                <CardTitle className="text-lg">
                  {steps[0]?.title || ""}
                </CardTitle>
                <CardDescription>{steps[0]?.description || ""}</CardDescription>
              </div>
            </div>
            {getStepStatus("class") === "completed" && (
              <ChevronRight className="w-5 h-5 text-muted-foreground ml-auto" />
            )}
          </CardHeader>
          <CardContent>
            <ScenarioPicker
              models={classModels}
              types={["Classes"]}
              label=""
              placeholder="Select a class..."
              description="This determines which students and documents are available for the scenario."
              onSelect={(model) => handleInputChange("classId", model.id)}
              selectedModel={
                selectedClass
                  ? {
                      id: selectedClass.id,
                      name: selectedClass.classCode || selectedClass.name,
                      description: `${selectedClass.name} - ${selectedClass.term} ${selectedClass.year}`,
                      type: "Classes" as const,
                    }
                  : undefined
              }
            />
          </CardContent>
        </Card>

        {/* Step 2: Documents */}
        <Card
          className={`transition-all ${!isEditMode && getStepStatus("documents") === "active" ? "ring-2 ring-primary" : ""} ${
            !isEditMode && getStepStatus("documents") === "pending"
              ? "opacity-50"
              : ""
          }`}
        >
          <CardHeader className="flex flex-row items-center space-y-0 pb-4">
            <div className="flex items-center space-x-3">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  getStepStatus("documents") === "completed"
                    ? "bg-green-500 text-white"
                    : getStepStatus("documents") === "active"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                }`}
              >
                {getStepStatus("documents") === "completed" ? (
                  <Check className="w-4 h-4" />
                ) : (
                  "2"
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-lg">
                    {steps[1]?.title || ""}
                  </CardTitle>
                  <Badge variant="secondary" className="text-xs">
                    Optional
                  </Badge>
                </div>
                <CardDescription>{steps[1]?.description || ""}</CardDescription>
              </div>
            </div>
            {getStepStatus("documents") === "completed" && (
              <ChevronRight className="w-5 h-5 text-muted-foreground ml-auto" />
            )}
          </CardHeader>
          <CardContent>
            <ScenarioPicker
              models={documentModels}
              types={["Documents"]}
              label=""
              placeholder="Select documents..."
              description="Choose documents that will be available during this scenario."
              multiSelect={true}
              selectedModels={selectedDocuments.map((doc) => ({
                id: doc.id,
                name: doc.name,
                description: `${doc.type} document`,
                type: "Documents" as const,
              }))}
              onMultiSelect={(models) =>
                handleInputChange(
                  "documents",
                  models.map((m) => m.id)
                )
              }
            />
          </CardContent>
        </Card>

        {/* Step 3: Agent Selection */}
        <Card
          className={`transition-all ${!isEditMode && getStepStatus("agent") === "active" ? "ring-2 ring-primary" : ""} ${
            !isEditMode && getStepStatus("agent") === "pending"
              ? "opacity-50"
              : ""
          }`}
        >
          <CardHeader className="flex flex-row items-center space-y-0 pb-4">
            <div className="flex items-center space-x-3">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  getStepStatus("agent") === "completed"
                    ? "bg-green-500 text-white"
                    : getStepStatus("agent") === "active"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                }`}
              >
                {getStepStatus("agent") === "completed" ? (
                  <Check className="w-4 h-4" />
                ) : (
                  "3"
                )}
              </div>
              <div>
                <CardTitle className="text-lg">
                  {steps[2]?.title || ""}
                </CardTitle>
                <CardDescription>{steps[2]?.description || ""}</CardDescription>
              </div>
            </div>
            {getStepStatus("agent") === "completed" && (
              <ChevronRight className="w-5 h-5 text-muted-foreground ml-auto" />
            )}
          </CardHeader>
          <CardContent>
            <ScenarioPicker
              models={agentModels}
              types={["Agents"]}
              label=""
              placeholder="Select an agent..."
              description="Choose the AI agent that will interact with students in this scenario."
              onSelect={(model) => handleInputChange("agentId", model.id)}
              selectedModel={
                selectedAgent
                  ? {
                      id: selectedAgent.id,
                      name: selectedAgent.name,
                      description: selectedAgent.description,
                      type: "Agents" as const,
                    }
                  : undefined
              }
            />
          </CardContent>
        </Card>

        {/* Step 4: Context Parameters */}
        <Card
          className={`transition-all ${!isEditMode && getStepStatus("context") === "active" ? "ring-2 ring-primary" : ""} ${
            !isEditMode && getStepStatus("context") === "pending"
              ? "opacity-50"
              : ""
          }`}
        >
          <CardHeader className="flex flex-row items-center space-y-0 pb-4">
            <div className="flex items-center space-x-3">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  getStepStatus("context") === "completed"
                    ? "bg-green-500 text-white"
                    : getStepStatus("context") === "active"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                }`}
              >
                {getStepStatus("context") === "completed" ? (
                  <Check className="w-4 h-4" />
                ) : (
                  "4"
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-lg">
                    {steps[3]?.title || ""}
                  </CardTitle>
                  <Badge variant="secondary" className="text-xs">
                    Optional
                  </Badge>
                </div>
                <CardDescription>{steps[3]?.description || ""}</CardDescription>
              </div>
            </div>
            {getStepStatus("context") === "completed" && (
              <ChevronRight className="w-5 h-5 text-muted-foreground ml-auto" />
            )}
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Seniority */}
            <div className="space-y-2">
              <Label>Student Seniority</Label>
              <Select
                value={formData.seniority || "none"}
                onValueChange={(value) =>
                  handleInputChange(
                    "seniority",
                    value === "none" ? null : value
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select student level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No preference</SelectItem>
                  <SelectItem value="freshman">Freshman</SelectItem>
                  <SelectItem value="sophomore">Sophomore</SelectItem>
                  <SelectItem value="junior">Junior</SelectItem>
                  <SelectItem value="senior">Senior</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Crowdedness */}
            <div className="space-y-2">
              {formData.crowdedness !== null ? (
                <ScenarioSlider
                  label="Crowdedness Level"
                  defaultValue={[5]}
                  description="How busy or crowded the environment should be (1-10)"
                  min={1}
                  max={10}
                  step={1}
                  value={[formData.crowdedness || 5]}
                  onValueChange={(value) =>
                    handleInputChange("crowdedness", value[0] || 5)
                  }
                  inlineTitle={true}
                  showReset={true}
                  onReset={() => handleInputChange("crowdedness", null)}
                />
              ) : (
                <>
                  <Label>Crowdedness Level</Label>
                  <Button
                    variant="outline"
                    onClick={() => handleInputChange("crowdedness", 5)}
                    className="w-full justify-start"
                  >
                    Set crowdedness level
                  </Button>
                </>
              )}
            </div>

            {/* Intensity */}
            <div className="space-y-2">
              {formData.intensity !== null ? (
                <ScenarioSlider
                  label="Intensity Level"
                  description="How intense or challenging the scenario should be (1-10)"
                  min={1}
                  max={10}
                  step={1}
                  defaultValue={[5]}
                  value={[formData.intensity || 5]}
                  onValueChange={(value) =>
                    handleInputChange("intensity", value[0] || 5)
                  }
                  inlineTitle={true}
                  showReset={true}
                  onReset={() => handleInputChange("intensity", null)}
                />
              ) : (
                <>
                  <Label>Intensity Level</Label>
                  <Button
                    variant="outline"
                    onClick={() => handleInputChange("intensity", 5)}
                    className="w-full justify-start"
                  >
                    Set intensity level
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Step 5: Environment Details */}
        <Card
          className={`transition-all ${!isEditMode && getStepStatus("environment") === "active" ? "ring-2 ring-primary" : ""} ${
            !isEditMode && getStepStatus("environment") === "pending"
              ? "opacity-50"
              : ""
          }`}
        >
          <CardHeader className="flex flex-row items-center space-y-0 pb-4">
            <div className="flex items-center space-x-3">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  getStepStatus("environment") === "completed"
                    ? "bg-green-500 text-white"
                    : getStepStatus("environment") === "active"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                }`}
              >
                {getStepStatus("environment") === "completed" ? (
                  <Check className="w-4 h-4" />
                ) : (
                  "5"
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-lg">
                    {steps[4]?.title || ""}
                  </CardTitle>
                  <Badge variant="secondary" className="text-xs">
                    Optional
                  </Badge>
                </div>
                <CardDescription>{steps[4]?.description || ""}</CardDescription>
              </div>
            </div>
            {getStepStatus("environment") === "completed" && (
              <ChevronRight className="w-5 h-5 text-muted-foreground ml-auto" />
            )}
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Location */}
            <div className="space-y-2">
              <Label>Location</Label>
              <Select
                value={formData.location || "none"}
                onValueChange={(value) =>
                  handleInputChange("location", value === "none" ? null : value)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select location" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No preference</SelectItem>
                  <SelectItem value="haas">HAAS Basement</SelectItem>
                  <SelectItem value="lawson">Lawson Commons</SelectItem>
                  <SelectItem value="dsai">DS/AI Basement</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Time of Day */}
            <div className="space-y-2">
              <Label>Time of Day</Label>
              <Select
                value={formData.tod || "none"}
                onValueChange={(value) =>
                  handleInputChange("tod", value === "none" ? null : value)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select time" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No preference</SelectItem>
                  <SelectItem value="9AM">9:00 AM</SelectItem>
                  <SelectItem value="10AM">10:00 AM</SelectItem>
                  <SelectItem value="11AM">11:00 AM</SelectItem>
                  <SelectItem value="12PM">12:00 PM</SelectItem>
                  <SelectItem value="1PM">1:00 PM</SelectItem>
                  <SelectItem value="2PM">2:00 PM</SelectItem>
                  <SelectItem value="3PM">3:00 PM</SelectItem>
                  <SelectItem value="4PM">4:00 PM</SelectItem>
                  <SelectItem value="5PM">5:00 PM</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Urgency */}
            <div className="space-y-2">
              <Label>Assignment Deadline</Label>
              <Select
                value={formData.urgency || "none"}
                onValueChange={(value) =>
                  handleInputChange("urgency", value === "none" ? null : value)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select urgency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No preference</SelectItem>
                  <SelectItem value="hour">Few hours</SelectItem>
                  <SelectItem value="day">Next day</SelectItem>
                  <SelectItem value="days">Couple of days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Step 6: Generated Content - Only show after generation is triggered */}
        {formData.description && (
          <Card
            className={`transition-all ${!isEditMode && getStepStatus("content") === "active" ? "ring-2 ring-primary" : ""}`}
          >
            <CardHeader className="flex flex-row items-center space-y-0 pb-4">
              <div className="flex items-center space-x-3">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    getStepStatus("content") === "completed"
                      ? "bg-green-500 text-white"
                      : getStepStatus("content") === "active"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                  }`}
                >
                  {getStepStatus("content") === "completed" ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    "6"
                  )}
                </div>
                <div className="flex-1">
                  <CardTitle className="text-lg">
                    {steps[5]?.title || ""}
                  </CardTitle>
                  <CardDescription>
                    {steps[5]?.description || ""}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="description">
                  Generated Scenario Description
                </Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) =>
                    handleInputChange("description", e.target.value)
                  }
                  placeholder="Generated scenario description will appear here..."
                  className="min-h-[120px]"
                />
                <p className="text-xs text-muted-foreground">
                  You can edit the generated description if needed.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-end">
        <Button
          onClick={formData.description ? handleSubmit : handleGenerateScenario}
          disabled={isSubmitting || isGeneratingScenario}
          className="min-w-[120px]"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              {isEditMode ? "Updating..." : "Saving..."}
            </>
          ) : isGeneratingScenario ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Generating...
            </>
          ) : formData.description ? (
            isEditMode ? (
              "Update Scenario"
            ) : (
              "Save Scenario"
            )
          ) : (
            "Create Scenario"
          )}
        </Button>
      </div>
    </div>
  );
}
