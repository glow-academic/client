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
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

// UI Components
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
import { Textarea } from "@/components/ui/textarea";

// Custom Components
import { ParameterSelector } from "./ParameterSelector";
import { ScenarioPicker } from "./ScenarioPicker";

// Types and API functions
import {
  Document,
  Persona,
  Scenario as ScenarioType,
  Simulation,
} from "@/types";
import { newScenario } from "@/utils/api/scenarios/new-scenario";
import { logError } from "@/utils/logger";
import { createScenario } from "@/utils/mutations/scenarios/create-scenario";
import { updateScenario } from "@/utils/mutations/scenarios/update-scenario";
import { getAllDocuments } from "@/utils/queries/documents/get-all-documents";
import { getAllParameterItems } from "@/utils/queries/parameter_items/get-all-parameter-items";
import { getAllParameters } from "@/utils/queries/parameters/get-all-parameters";
import { getAllPersonas } from "@/utils/queries/personas/get-all-personas";
import { getScenario } from "@/utils/queries/scenarios/get-scenario";
import { getAllSimulations } from "@/utils/queries/simulations/get-all-simulations";
import { Model } from "@/utils/scenario";

export interface ScenarioProps {
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
    documentIds: [],
    personaId: null,
    parameterItemIds: [],
    name: "",
    description: "",
  };

  const [formData, setFormData] =
    useState<Partial<ScenarioType>>(initialFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingScenario, setIsGeneratingScenario] = useState(false);
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
  const [originalFormData, setOriginalFormData] =
    useState<Partial<ScenarioType>>(initialFormData);

  // Data fetching
  const { data: documents = [] } = useQuery({
    queryKey: ["documents"],
    queryFn: () => getAllDocuments(),
  });

  const { data: personas = [] } = useQuery({
    queryKey: ["personas"],
    queryFn: () => getAllPersonas(),
  });

  const { data: parameters = [] } = useQuery({
    queryKey: ["parameters"],
    queryFn: () => getAllParameters(),
  });

  const { data: parameterItems = [] } = useQuery({
    queryKey: ["parameter-items"],
    queryFn: () => getAllParameterItems(),
  });

  const { data: simulations = [] } = useQuery({
    queryKey: ["simulations"],
    queryFn: () => getAllSimulations(),
    enabled: isEditMode, // Only fetch when in edit mode
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
      const scenarioData = {
        documentIds: scenario.documentIds || [],
        personaId: scenario.personaId,
        parameterItemIds: scenario.parameterItemIds || [],
        name: scenario.name || "",
        description: scenario.description || "",
      };
      setFormData(scenarioData);
      setOriginalFormData(scenarioData); // Set original data for comparison
    }
  }, [isEditMode, scenario]);

  // Check if form has changes
  const hasChanges = useMemo(() => {
    if (!isEditMode) return false;

    const current = formData;
    const original = originalFormData;

    return (
      current.personaId !== original.personaId ||
      current.name !== original.name ||
      current.description !== original.description ||
      JSON.stringify(current.documentIds?.sort()) !==
        JSON.stringify(original.documentIds?.sort()) ||
      JSON.stringify(current.parameterItemIds?.sort()) !==
        JSON.stringify(original.parameterItemIds?.sort())
    );
  }, [formData, originalFormData, isEditMode]);

  // Count simulations using this scenario
  const affectedSimulations = useMemo(() => {
    if (!isEditMode || !scenarioId) return [];
    return simulations.filter(
      (sim: Simulation) =>
        sim.scenarioIds && sim.scenarioIds.includes(scenarioId),
    );
  }, [simulations, scenarioId, isEditMode]);

  // Calculate step status
  const getStepStatus = (stepId: string): StepStatus => {
    switch (stepId) {
      case "persona":
        return formData.personaId ? "completed" : "active";
      case "documents":
        return !formData.documentIds
          ? "pending"
          : formData.documentIds && formData.documentIds.length > 0
            ? "completed"
            : "active";
      case "parameters":
        return !formData.personaId
          ? "pending"
          : formData.parameterItemIds && formData.parameterItemIds.length > 0
            ? "completed"
            : "active";
      case "content":
        return !formData.personaId ? "pending" : "active"; // Always active once persona is selected, user can choose to fill or leave blank
      default:
        return "pending";
    }
  };

  const steps: Step[] = [
    {
      id: "persona",
      title: "Select Persona Type",
      description: "Choose the type of persona for this scenario",
      status: getStepStatus("persona"),
    },
    {
      id: "documents",
      title: "Choose Documents",
      description: "Select relevant documents for this scenario",
      status: getStepStatus("documents"),
      optional: true,
    },
    {
      id: "parameters",
      title: "Set Parameters",
      description: "Configure scenario parameters and environment",
      status: getStepStatus("parameters"),
      optional: true,
    },
    {
      id: "content",
      title: "Scenario Content",
      description:
        "Add a custom description or leave blank for auto-generation",
      status: getStepStatus("content"),
    },
  ];

  const documentModels: Model[] = documents.map((doc: Document) => ({
    id: doc.id,
    name: doc.name,
    description: `${doc.type} document`,
    type: "Documents" as const,
    strengths: doc.mimeType,
  }));

  const personaModels: Model[] = personas.map((persona: Persona) => ({
    id: persona.id,
    name: persona.name,
    description: persona.description,
    type: "Personas" as const,
  }));

  // Event handlers
  const handleInputChange = (
    field: keyof Partial<ScenarioType>,
    value: string | string[] | null,
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleGenerateScenario = async () => {
    setIsGeneratingScenario(true);

    try {
      const result = await newScenario({
        personaId: formData.personaId || null,
        documentIds: formData.documentIds || [],
        parameterItemIds: formData.parameterItemIds || [],
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
        `Failed to generate scenario: ${error instanceof Error ? error.message : "Unknown error"}`,
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
        personaId: formData.personaId,
        documentIds: formData.documentIds,
        parameterItemIds: formData.parameterItemIds,
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
        `Failed to ${isEditMode ? "update" : "create"} scenario: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateClick = () => {
    if (isEditMode && affectedSimulations.length > 0) {
      setShowUpdateDialog(true);
    } else {
      handleSubmit();
    }
  };

  const handleConfirmUpdate = () => {
    setShowUpdateDialog(false);
    handleSubmit();
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

  const selectedDocuments = documents.filter((doc) =>
    formData.documentIds?.includes(doc.id),
  );
  const selectedPersona = personas.find(
    (persona) => persona.id === formData.personaId,
  );

  return (
    <div className="w-full p-6 space-y-8">
      <div className="space-y-6">
        {/* Step 1: Persona Selection */}
        <Card
          className={`transition-all ${!isEditMode && getStepStatus("persona") === "active" ? "ring-2 ring-primary" : ""} ${
            !isEditMode && getStepStatus("persona") === "pending"
              ? "opacity-50"
              : ""
          }`}
        >
          <CardHeader className="flex flex-row items-center space-y-0 pb-4">
            <div className="flex items-center space-x-3">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  getStepStatus("persona") === "completed"
                    ? "bg-green-500 text-white"
                    : getStepStatus("persona") === "active"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                }`}
              >
                {getStepStatus("persona") === "completed" ? (
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
            {getStepStatus("persona") === "completed" && (
              <ChevronRight className="w-5 h-5 text-muted-foreground ml-auto" />
            )}
          </CardHeader>
          <CardContent>
            <ScenarioPicker
              models={personaModels}
              types={["Personas"]}
              label=""
              placeholder="Select a persona..."
              description="Choose the persona that will interact with students in this scenario."
              onSelect={(model) => handleInputChange("personaId", model.id)}
              selectedModel={
                selectedPersona
                  ? {
                      id: selectedPersona.id,
                      name: selectedPersona.name,
                      description: selectedPersona.description,
                      type: "Personas" as const,
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
                  "documentIds",
                  models.map((m) => m.id),
                )
              }
            />
          </CardContent>
        </Card>

        {/* Step 3: Parameters */}
        <Card
          className={`transition-all ${!isEditMode && getStepStatus("parameters") === "active" ? "ring-2 ring-primary" : ""} ${
            !isEditMode && getStepStatus("parameters") === "pending"
              ? "opacity-50"
              : ""
          }`}
        >
          <CardHeader className="flex flex-row items-center space-y-0 pb-4">
            <div className="flex items-center space-x-3">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  getStepStatus("parameters") === "completed"
                    ? "bg-green-500 text-white"
                    : getStepStatus("parameters") === "active"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                }`}
              >
                {getStepStatus("parameters") === "completed" ? (
                  <Check className="w-4 h-4" />
                ) : (
                  "3"
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-lg">
                    {steps[2]?.title || ""}
                  </CardTitle>
                  <Badge variant="secondary" className="text-xs">
                    Optional
                  </Badge>
                </div>
                <CardDescription>{steps[2]?.description || ""}</CardDescription>
              </div>
            </div>
            {getStepStatus("parameters") === "completed" && (
              <ChevronRight className="w-5 h-5 text-muted-foreground ml-auto" />
            )}
          </CardHeader>
          <CardContent>
            <ParameterSelector
              parameters={parameters}
              parameterItems={parameterItems}
              selectedParameterItemIds={formData.parameterItemIds || []}
              onParameterItemIdsChange={(parameterItemIds) =>
                handleInputChange("parameterItemIds", parameterItemIds)
              }
            />
          </CardContent>
        </Card>

        {/* Step 4: Content */}
        <Card
          className={`transition-all ${!isEditMode && getStepStatus("content") === "active" ? "ring-2 ring-primary" : ""} ${
            !isEditMode && getStepStatus("content") === "pending"
              ? "opacity-50"
              : ""
          }`}
        >
          <CardHeader className="flex flex-row items-center space-y-0 pb-4 justify-between">
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
                  "4"
                )}
              </div>
              <div className="flex-1">
                <CardTitle className="text-lg">
                  {steps[3]?.title || ""}
                </CardTitle>
                <CardDescription>{steps[3]?.description || ""}</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleGenerateScenario}
                disabled={isSubmitting || isGeneratingScenario}
              >
                {isGeneratingScenario ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {formData.description ? "Regenerating..." : "Generating..."}
                  </>
                ) : formData.description ? (
                  "Regenerate"
                ) : (
                  "Generate"
                )}
              </Button>
              {getStepStatus("content") === "completed" && (
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="description">Scenario Description</Label>
              <Textarea
                id="description"
                value={formData.description || ""}
                onChange={(e) =>
                  handleInputChange("description", e.target.value)
                }
                placeholder="Enter a custom scenario description or leave blank to auto-generate..."
                className="min-h-[120px]"
              />
              <div className="flex items-start gap-2 p-3 rounded-md bg-blue-50 border border-blue-200">
                <div className="text-blue-600 text-sm">
                  <strong>💡 Tip:</strong> You can save the scenario with a
                  blank description and we will dynamically generate one for
                  each chat.
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-3">
        <Button
          variant="outline"
          onClick={() => router.push("/create/scenarios")}
          disabled={isSubmitting || isGeneratingScenario}
        >
          Back
        </Button>
        <Button
          onClick={isEditMode ? handleUpdateClick : handleSubmit}
          disabled={
            isSubmitting || isGeneratingScenario || (isEditMode && !hasChanges)
          }
          className="min-w-[120px]"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              {isEditMode ? "Updating..." : "Saving..."}
            </>
          ) : isEditMode ? (
            "Update Scenario"
          ) : (
            "Save Scenario"
          )}
        </Button>
      </div>

      {/* Update Confirmation Dialog */}
      <AlertDialog open={showUpdateDialog} onOpenChange={setShowUpdateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Update Scenario</AlertDialogTitle>
            <AlertDialogDescription>
              This scenario is currently used by {affectedSimulations.length}{" "}
              simulation{affectedSimulations.length !== 1 ? "s" : ""}:
              <ul className="mt-2 list-disc list-inside">
                {affectedSimulations.map((sim) => (
                  <li key={sim.id} className="text-sm">
                    {sim.title}
                  </li>
                ))}
              </ul>
              <div className="mt-3 text-sm font-medium">
                Updating this scenario will affect all of these simulations. Are
                you sure you want to proceed?
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmUpdate}
              disabled={isSubmitting}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {isSubmitting ? "Updating..." : "Update"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
