/**
 * Scenario.tsx
 * Progressive step-by-step scenario creation flow
 * @AshokSaravanan222 & @siladiea
 * 05/20/2025
 */
"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronRight, Loader2, Settings } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

// Custom Components
import { DocumentPicker } from "./DocumentPicker";
import { ParameterSelector } from "./ParameterSelector";
import { PersonaPicker } from "./PersonaPicker";

// Types and API functions
import { useProfile } from "@/contexts/profile-context";
import { Scenario as ScenarioType, Simulation } from "@/types";
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
  const { effectiveProfile } = useProfile();
  const isEditMode = mode === "edit" && !!scenarioId;

  // Form data state
  const initialFormData: Partial<ScenarioType> = {
    documentIds: [],
    personaId: null,
    parameterItemIds: [],
    name: "",
    description: "",
    defaultScenario: false,
    practiceScenario: false,
  };

  const [formData, setFormData] =
    useState<Partial<ScenarioType>>(initialFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingScenario, setIsGeneratingScenario] = useState(false);
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
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
        defaultScenario: scenario.defaultScenario ?? false,
        practiceScenario: scenario.practiceScenario ?? false,
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
      current.defaultScenario !== original.defaultScenario ||
      current.practiceScenario !== original.practiceScenario ||
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
        sim.scenarioIds && sim.scenarioIds.includes(scenarioId)
    );
  }, [simulations, scenarioId, isEditMode]);

  // Check if scenario is readonly (used by active simulations)
  const isReadonly = useMemo(() => {
    if (!isEditMode || !scenarioId) return false;
    return affectedSimulations.some((sim: Simulation) => sim.active);
  }, [affectedSimulations, isEditMode, scenarioId]);

  // Calculate step status
  const getStepStatus = (stepId: string): StepStatus => {
    // If we have a scenario description, mark all sections as completed
    if (formData.description && formData.description.trim()) {
      return "completed";
    }

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
      title: "Scenario",
      description:
        "This is what the TA will see when they enter the scenario. Leave blank for auto-generation.",
      status: getStepStatus("content"),
    },
  ];

  // Event handlers
  const handleInputChange = (
    field: keyof Partial<ScenarioType>,
    value: string | string[] | boolean | null
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
        personaId: formData.personaId,
        documentIds: formData.documentIds,
        parameterItemIds: formData.parameterItemIds,
        defaultScenario: formData.defaultScenario || false,
        practiceScenario: formData.practiceScenario || false,
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

      // Invalidate all relevant queries to ensure data consistency
      queryClient.invalidateQueries({ queryKey: ["scenarios"] });

      // Invalidate specific scenario query if in edit mode
      if (isEditMode && scenarioId) {
        queryClient.invalidateQueries({ queryKey: ["scenario", scenarioId] });
      }

      // Invalidate simulations queries since scenarios are used by simulations
      queryClient.invalidateQueries({ queryKey: ["simulations"] });

      // Invalidate analytics queries that depend on scenarios
      queryClient.invalidateQueries({ queryKey: ["simulationAttempts"] });
      queryClient.invalidateQueries({ queryKey: ["simulationChats"] });
      queryClient.invalidateQueries({ queryKey: ["simulationGrades"] });
      queryClient.invalidateQueries({ queryKey: ["simulationFeedbacks"] });

      // Invalidate documents queries since scenarios reference documents
      queryClient.invalidateQueries({ queryKey: ["documents"] });

      // Invalidate personas queries since scenarios reference personas
      queryClient.invalidateQueries({ queryKey: ["personas"] });

      // Invalidate parameters queries since scenarios reference parameters
      queryClient.invalidateQueries({ queryKey: ["parameters"] });
      queryClient.invalidateQueries({ queryKey: ["parameter-items"] });

      router.push("/create/scenarios");
    } catch (error) {
      toast.error(
        `Failed to ${isEditMode ? "update" : "create"} scenario: ${error instanceof Error ? error.message : "Unknown error"}`
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
    formData.documentIds?.includes(doc.id)
  );
  const selectedPersona = personas.find(
    (persona) => persona.id === formData.personaId
  );

  return (
    <div className="w-full p-6 space-y-8">
      {isReadonly && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-yellow-400"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">
                Scenario is in use by active simulations
              </h3>
              <div className="mt-2 text-sm text-yellow-700">
                <p>
                  This scenario is currently being used by{" "}
                  {affectedSimulations.filter((sim) => sim.active).length}{" "}
                  active simulation
                  {affectedSimulations.filter((sim) => sim.active).length !== 1
                    ? "s"
                    : ""}
                  . You can view the details but cannot make changes to prevent
                  disruption to ongoing simulations.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Scenario Title Input */}
      <div className="flex justify-center mb-6 relative">
        <div className="w-full max-w-2xl">
          <input
            type="text"
            value={formData.name || ""}
            onChange={(e) => handleInputChange("name", e.target.value)}
            placeholder="New Scenario"
            className="w-full text-3xl font-semibold text-center border-none outline-none bg-transparent px-2 py-1 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isReadonly}
          />
        </div>
        {/* Settings Icon - Only for superadmin */}
        {effectiveProfile?.role === "superadmin" && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSettingsDialog(true)}
            className="absolute right-0 top-0"
            disabled={isReadonly}
          >
            <Settings className="h-5 w-5" />
          </Button>
        )}
      </div>

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
            <PersonaPicker
              personas={personas}
              label=""
              placeholder="Select a persona..."
              description="Choose the persona that will interact with students in this scenario."
              onSelect={(persona) => handleInputChange("personaId", persona.id)}
              selectedPersona={selectedPersona}
              disabled={isReadonly}
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
            <DocumentPicker
              documents={documents}
              label=""
              placeholder="Select documents..."
              description="Choose documents that will be available during this scenario."
              multiSelect={true}
              selectedDocuments={selectedDocuments}
              onMultiSelect={(selectedDocs) =>
                handleInputChange(
                  "documentIds",
                  selectedDocs.map((doc) => doc.id)
                )
              }
              disabled={isReadonly}
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
              disabled={isReadonly}
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
                variant="default"
                size="sm"
                onClick={handleGenerateScenario}
                disabled={isSubmitting || isGeneratingScenario || isReadonly}
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
              <Textarea
                id="description"
                value={formData.description || ""}
                onChange={(e) =>
                  handleInputChange("description", e.target.value)
                }
                placeholder="Enter a custom scenario description or leave blank to auto-generate..."
                className="min-h-[120px]"
                disabled={isReadonly}
              />
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
            isSubmitting ||
            isGeneratingScenario ||
            (isEditMode && !hasChanges) ||
            isReadonly
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

      {/* Settings Dialog */}
      <AlertDialog
        open={showSettingsDialog}
        onOpenChange={setShowSettingsDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Scenario Settings</AlertDialogTitle>
            <AlertDialogDescription>
              Configure advanced settings for this scenario.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Default Scenario</Label>
                <p className="text-sm text-muted-foreground">
                  Mark this as a default scenario that can be used as a
                  template.
                </p>
              </div>
              <Switch
                checked={formData.defaultScenario ?? false}
                onCheckedChange={(checked) =>
                  handleInputChange("defaultScenario", checked)
                }
                disabled={isReadonly}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Practice Scenario</Label>
                <p className="text-sm text-muted-foreground">
                  Mark this as a practice scenario for training purposes.
                </p>
              </div>
              <Switch
                checked={formData.practiceScenario ?? false}
                onCheckedChange={(checked) =>
                  handleInputChange("practiceScenario", checked)
                }
                disabled={isReadonly}
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Close</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
