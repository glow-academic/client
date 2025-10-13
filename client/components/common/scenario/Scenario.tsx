/**
 * Scenario.tsx
 * Progressive step-by-step scenario creation flow
 * @AshokSaravanan222 & @siladiea
 * 05/20/2025
 */
"use client";
import { Check, Loader2, RotateCcw, Settings, Shuffle } from "lucide-react";
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Custom Components
import { DocumentPicker } from "./DocumentPicker";
import { ParameterSelector } from "./ParameterSelector";
import { PersonaPicker } from "./PersonaPicker";

// Types and API functions
import { DepartmentSelector } from "@/components/common/forms/DepartmentSelector";
import { useDepartments } from "@/contexts/departments-context";
import { useProfile } from "@/contexts/profile-context";
import { useDepartments as useDepartmentsHook } from "@/lib/api/v1/hooks/departments";
import { useDocumentsByDepartmentIdBatch } from "@/lib/api/v1/hooks/documents";
import { useParameterItems } from "@/lib/api/v1/hooks/parameter_items";
import { useParametersByDepartmentIdBatch } from "@/lib/api/v1/hooks/parameters";
import { usePersonasByDepartmentIdBatch } from "@/lib/api/v1/hooks/personas";
import {
  useCreateScenarioDocument,
  useScenarioDocumentsByScenarioId,
} from "@/lib/api/v1/hooks/scenario_documents";
import {
  useCreateScenarioObjective,
  useScenarioObjectivesByScenarioId,
} from "@/lib/api/v1/hooks/scenario_objectives";
import {
  useCreateScenarioParameterItem,
  useScenarioParameterItemsByScenarioId,
} from "@/lib/api/v1/hooks/scenario_parameter_items";
import {
  useCreateScenarioPersona,
  useScenarioPersonasByScenarioId,
} from "@/lib/api/v1/hooks/scenario_personas";
import {
  useCreateScenario,
  useScenario,
  useUpdateScenario,
} from "@/lib/api/v1/hooks/scenarios";
import { useSimulationScenariosByScenarioId } from "@/lib/api/v1/hooks/simulation_scenarios";
import { useSimulationsByDepartmentIdBatch } from "@/lib/api/v1/hooks/simulations";
import { Scenario as ScenarioType, Simulation } from "@/types";
import { newScenario } from "@/utils/api/scenarios/new-scenario";
import { randomizeScenario } from "@/utils/api/scenarios/randomize";
import { log } from "@/utils/logger";

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
  const { effectiveProfile } = useProfile();
  const { effectiveDepartmentIds } = useDepartments();
  const isEditMode = mode === "edit" && !!scenarioId;

  // Mutation hooks
  const createScenarioMutation = useCreateScenario();
  const updateScenarioMutation = useUpdateScenario();
  const createScenarioObjectiveMutation = useCreateScenarioObjective();
  const createScenarioParameterItemMutation = useCreateScenarioParameterItem();
  const createScenarioDocumentMutation = useCreateScenarioDocument();
  const createScenarioPersonaMutation = useCreateScenarioPersona();

  // Load linked data from junction tables
  const { data: linkedObjectives = [] } = useScenarioObjectivesByScenarioId(
    scenarioId || ""
  );
  const { data: linkedParameterItems = [] } =
    useScenarioParameterItemsByScenarioId(scenarioId || "");
  const { data: linkedDocuments = [] } = useScenarioDocumentsByScenarioId(
    scenarioId || ""
  );
  const { data: linkedPersonas = [] } = useScenarioPersonasByScenarioId(
    scenarioId || ""
  );

  // Form data state
  const initialFormData: Partial<ScenarioType> = {
    name: "",
    problemStatement: "",
    defaultScenario: false,
    departmentId: "",
  };

  const [formData, setFormData] =
    useState<Partial<ScenarioType>>(initialFormData);

  // Store personaId separately since it's now in junction table
  const [selectedPersonaId, setSelectedPersonaId] = useState<string | null>(
    null
  );
  const [originalDocumentIds, setOriginalDocumentIds] = useState<string[]>([]);
  const [originalParameterItemIds, setOriginalParameterItemIds] = useState<
    string[]
  >([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingScenario, setIsGeneratingScenario] = useState(false);
  const [isRandomizingPersona, setIsRandomizingPersona] = useState(false);
  const [isRandomizingDocuments, setIsRandomizingDocuments] = useState(false);
  const [isRandomizingParameters, setIsRandomizingParameters] = useState(false);
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [originalFormData, setOriginalFormData] =
    useState<Partial<ScenarioType>>(initialFormData);
  const [noDocuments, setNoDocuments] = useState(false);

  // State for junction data (managed separately from scenario)
  const [currentObjectives, setCurrentObjectives] = useState<string[]>([]);
  const [currentParameterItemIds, setCurrentParameterItemIds] = useState<
    string[]
  >([]);
  const [currentDocumentIds, setCurrentDocumentIds] = useState<string[]>([]);

  // Sync junction data when linked data loads
  useEffect(() => {
    if (linkedObjectives.length > 0) {
      const sorted = [...linkedObjectives].sort((a, b) => a.idx - b.idx);
      setCurrentObjectives(sorted.map((o) => o.objective));
    }
  }, [linkedObjectives]);

  useEffect(() => {
    if (linkedParameterItems.length > 0) {
      const paramIds = linkedParameterItems.map((lpi) => lpi.parameterItemId);
      setCurrentParameterItemIds(paramIds);
      if (isEditMode) {
        setOriginalParameterItemIds(paramIds);
      }
    }
  }, [linkedParameterItems, isEditMode]);

  useEffect(() => {
    if (linkedDocuments.length > 0) {
      const docIds = linkedDocuments.map((ld) => ld.documentId);
      setCurrentDocumentIds(docIds);
      if (isEditMode) {
        setOriginalDocumentIds(docIds);
      }
    }
  }, [linkedDocuments, isEditMode]);

  useEffect(() => {
    if (linkedPersonas.length > 0 && isEditMode) {
      // Load persona from junction table (only one active persona per scenario)
      const activePersona = linkedPersonas.find((lp) => lp.active);
      if (activePersona) {
        setSelectedPersonaId(activePersona.personaId);
      }
    }
  }, [linkedPersonas, isEditMode]);

  const { data: documents = [] } = useDocumentsByDepartmentIdBatch(
    effectiveDepartmentIds
  );
  const { data: personas = [] } = usePersonasByDepartmentIdBatch(
    effectiveDepartmentIds
  );
  const { data: parameters = [] } = useParametersByDepartmentIdBatch(
    effectiveDepartmentIds
  );
  const { data: parameterItems = [] } = useParameterItems();
  const { data: simulations = [] } = useSimulationsByDepartmentIdBatch(
    effectiveDepartmentIds
  );
  const { data: scenario, isLoading } = useScenario(scenarioId!);
  const { data: departments = [] } = useDepartmentsHook();

  // Load scenario data if editing
  useEffect(() => {
    if (isEditMode && scenario) {
      const scenarioData = {
        personaId: null, // Will be loaded from junction table via separate useEffect
        name: scenario.name || "",
        problemStatement: scenario.problemStatement || "",
        defaultScenario: scenario.defaultScenario ?? false,
        departmentId: scenario.departmentId,
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

    // Compare current state with original
    // Note: personaId, documentIds, and parameterItemIds are now tracked separately
    const originalPersonaId = linkedPersonas[0]?.personaId || null;

    return (
      selectedPersonaId !== originalPersonaId ||
      current.name !== original.name ||
      current.problemStatement !== original.problemStatement ||
      current.defaultScenario !== original.defaultScenario ||
      JSON.stringify([...currentDocumentIds].sort()) !==
        JSON.stringify([...(originalDocumentIds || [])].sort()) ||
      JSON.stringify([...currentParameterItemIds].sort()) !==
        JSON.stringify([...(originalParameterItemIds || [])].sort())
    );
  }, [
    formData,
    originalFormData,
    isEditMode,
    selectedPersonaId,
    linkedPersonas,
    currentDocumentIds,
    originalDocumentIds,
    currentParameterItemIds,
    originalParameterItemIds,
  ]);

  // Get simulations using this scenario via junction table
  const { data: simulationScenarios = [] } = useSimulationScenariosByScenarioId(
    scenarioId || ""
  );

  // Count simulations using this scenario
  const affectedSimulations = useMemo(() => {
    if (!isEditMode || !scenarioId) return [];
    const simulationIds = simulationScenarios
      .filter((ss) => ss.active)
      .map((ss) => ss.simulationId);
    return simulations.filter((sim: Simulation) =>
      simulationIds.includes(sim.id)
    );
  }, [simulations, simulationScenarios, scenarioId, isEditMode]);

  // Check if scenario is readonly (used by active simulations or is a generated scenario)
  const isReadonly = useMemo(() => {
    if (!isEditMode || !scenarioId) return false;

    const usedByActiveSimulations = affectedSimulations.some(
      (sim: Simulation) => sim.active
    );

    // Note: parentId is now in scenario_tree junction table
    // For now, just check if scenario is marked as generated
    const isGeneratedScenario = !!scenario?.generated;

    return usedByActiveSimulations || isGeneratedScenario;
  }, [affectedSimulations, isEditMode, scenarioId, scenario]);

  // Calculate step status
  const getStepStatus = (stepId: string): StepStatus => {
    // If we have a scenario description, mark all sections as completed
    if (formData.problemStatement && formData.problemStatement.trim()) {
      return "completed";
    }

    switch (stepId) {
      case "persona":
        return selectedPersonaId ? "completed" : "active";
      case "documents":
        return currentDocumentIds.length > 0 ? "completed" : "active";
      case "parameters":
        return !selectedPersonaId
          ? "pending"
          : currentParameterItemIds.length > 0
            ? "completed"
            : "active";
      case "content":
        return !selectedPersonaId ? "pending" : "active"; // Always active once persona is selected, user can choose to fill or leave blank
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

  const handleRandomizeParameters = async () => {
    try {
      setIsRandomizingParameters(true);
      const resp = await randomizeScenario({
        name: formData.name || "",
        personaId: selectedPersonaId,
        documentIds: currentDocumentIds,
        parameterItemIds: currentParameterItemIds,
        targets: ["parameters"],
      });
      if (!resp.success) throw new Error(resp.message);
      setCurrentParameterItemIds(resp.parameterItemIds || []);
      toast.success("Parameter suggestions applied");
    } catch (error) {
      log.error("scenario.parameters.randomize.failed", {
        message: "Error randomizing parameters",
        error,
        context: {
          component: "Scenario",
          function: "handleRandomizeParameters",
        },
      });
      toast.error("Failed to randomize parameters");
    } finally {
      setIsRandomizingParameters(false);
    }
  };

  const handleResetParameters = () => {
    try {
      setCurrentParameterItemIds([]);
      toast.success("Parameters reset");
    } catch (error) {
      log.error("scenario.parameters.reset.failed", {
        message: "Error resetting parameters",
        error,
        context: { component: "Scenario", function: "handleResetParameters" },
      });
      toast.error("Failed to reset parameters");
    }
  };

  // Persona actions
  const handleRandomizePersona = async () => {
    try {
      setIsRandomizingPersona(true);
      const resp = await randomizeScenario({
        name: formData.name || "",
        personaId: selectedPersonaId,
        documentIds: currentDocumentIds,
        parameterItemIds: currentParameterItemIds,
        targets: ["persona"],
      });
      if (!resp.success) throw new Error(resp.message);
      if (resp.personaId) setSelectedPersonaId(resp.personaId);
      toast.success("Persona suggestion applied");
    } catch (error) {
      log.error("scenario.persona.randomize.failed", {
        message: "Error randomizing persona",
        error,
        context: { component: "Scenario", function: "handleRandomizePersona" },
      });
      toast.error("Failed to randomize persona");
    } finally {
      setIsRandomizingPersona(false);
    }
  };

  const handleResetPersona = () => {
    try {
      setSelectedPersonaId(null);
      toast.success("Persona reset");
    } catch (error) {
      log.error("scenario.persona.reset.failed", {
        message: "Error resetting persona",
        error,
        context: { component: "Scenario", function: "handleResetPersona" },
      });
      toast.error("Failed to reset persona");
    }
  };

  // Documents actions
  const handleRandomizeDocuments = async () => {
    try {
      setIsRandomizingDocuments(true);
      if (noDocuments) {
        toast("No documents selected by choice");
        return;
      }
      const resp = await randomizeScenario({
        name: formData.name || "",
        personaId: selectedPersonaId,
        documentIds: currentDocumentIds,
        parameterItemIds: currentParameterItemIds,
        targets: ["documents"],
      });
      if (!resp.success) throw new Error(resp.message);
      setCurrentDocumentIds(resp.documentIds || []);
      toast.success("Document suggestions applied");
    } catch (error) {
      log.error("scenario.documents.randomize.failed", {
        message: "Error randomizing documents",
        error,
        context: {
          component: "Scenario",
          function: "handleRandomizeDocuments",
        },
      });
      toast.error("Failed to randomize documents");
    } finally {
      setIsRandomizingDocuments(false);
    }
  };

  const handleResetDocuments = () => {
    try {
      setCurrentDocumentIds([]);
      toast.success("Documents reset");
    } catch (error) {
      log.error("scenario.documents.reset.failed", {
        message: "Error resetting documents",
        error,
        context: { component: "Scenario", function: "handleResetDocuments" },
      });
      toast.error("Failed to reset documents");
    }
  };

  const handleResetContent = () => {
    try {
      setFormData((prev) => ({ ...prev, description: "" }));
      toast.success("Scenario content reset");
    } catch (error) {
      log.error("scenario.content.reset.failed", {
        message: "Error resetting content",
        error,
        context: { component: "Scenario", function: "handleResetContent" },
      });
      toast.error("Failed to reset content");
    }
  };

  const handleGenerateScenario = async () => {
    setIsGeneratingScenario(true);

    try {
      const result = await newScenario({
        personaId: selectedPersonaId,
        documentIds: currentDocumentIds,
        parameterItemIds: currentParameterItemIds,
        profileId: effectiveProfile?.id || null,
      });

      if (!result.success) {
        throw new Error(result.message || "Failed to generate scenario");
      }

      if (result.title || result.description) {
        setFormData((prev) => ({
          ...prev,
          name: result.title || prev.name || "",
          problemStatement: result.description || prev.problemStatement || "",
        }));
        // Update objectives if returned
        // Note: objectives may not be in response type anymore
        if (result.objectives) {
          setCurrentObjectives(result.objectives);
        }
        toast.success("Scenario generated successfully!");
      } else {
        throw new Error("No scenario content was generated");
      }
    } catch (error) {
      log.error("scenario.generate.failed", {
        message: "Error generating scenario",
        error,
        context: { component: "Scenario", function: "handleGenerateScenario" },
      });
      toast.error(
        `Failed to generate scenario: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    } finally {
      setIsGeneratingScenario(false);
    }
  };

  const handleSubmit = async () => {
    // Department validation for superadmins
    if (effectiveProfile?.role === "superadmin" && !formData.departmentId) {
      toast.error("Department selection is required for superadmin users");
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        name: formData.name?.trim() || "",
        problemStatement: formData.problemStatement?.trim() || "",
        defaultScenario: formData.defaultScenario || false,
        departmentId: formData.departmentId || effectiveDepartmentIds[0] || "",
      };

      if (isEditMode) {
        // UPDATE mode
        await updateScenarioMutation.mutateAsync({
          id: scenarioId!,
          ...payload,
          updatedAt: new Date().toISOString(),
        });

        // Update persona junction if changed
        const currentPersonaId = linkedPersonas[0]?.personaId;
        if (selectedPersonaId !== currentPersonaId) {
          // TODO: Need delete endpoint for scenario_personas composite key
          // For now, backend should handle via CASCADE or manual cleanup
          if (selectedPersonaId) {
            await createScenarioPersonaMutation.mutateAsync({
              scenarioId: scenarioId!,
              personaId: selectedPersonaId,
            });
          }
        }

        toast.success("Scenario updated successfully!");
      } else {
        // CREATE mode
        const newScenario = await createScenarioMutation.mutateAsync(payload);

        // Create junction records if scenario was created successfully
        if (newScenario?.id) {
          // Create persona link
          if (selectedPersonaId && newScenario.id) {
            await createScenarioPersonaMutation.mutateAsync({
              scenarioId: newScenario.id,
              personaId: selectedPersonaId,
            });
          }

          // Create objectives
          for (let i = 0; i < currentObjectives.length; i++) {
            if (currentObjectives[i]?.trim()) {
              await createScenarioObjectiveMutation.mutateAsync({
                scenarioId: newScenario.id,
                idx: i + 1,
                objective: currentObjectives[i] || "",
              });
            }
          }

          // Create parameter item links
          for (const paramItemId of currentParameterItemIds) {
            if (paramItemId) {
              await createScenarioParameterItemMutation.mutateAsync({
                scenarioId: newScenario.id,
                parameterItemId: paramItemId,
              });
            }
          }

          // Create document links
          for (const docId of currentDocumentIds) {
            if (docId) {
              await createScenarioDocumentMutation.mutateAsync({
                scenarioId: newScenario.id,
                documentId: docId,
              });
            }
          }
        }

        toast.success("Scenario created successfully!");
      }

      router.push("/create/scenarios");
    } catch (error) {
      log.error("scenario.submit.failed", {
        message: "Error submitting scenario",
        error,
        context: {
          component: "Scenario",
          function: "handleSubmit",
          mode: isEditMode ? "edit" : "create",
          scenarioId,
        },
      });
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
    currentDocumentIds.includes(doc.id)
  );
  const selectedPersona = personas.find(
    (persona) => persona.id === selectedPersonaId
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
                {scenario?.generated
                  ? "Generated scenario cannot be edited"
                  : "Scenario is in use by active simulations"}
              </h3>
              <div className="mt-2 text-sm text-yellow-700">
                {scenario?.generated ? (
                  <p>
                    This is a generated scenario that cannot be directly edited.
                    You can duplicate this scenario to create a new editable
                    version with your desired changes.
                  </p>
                ) : (
                  <p>
                    This scenario is currently being used by{" "}
                    {affectedSimulations.filter((sim) => sim.active).length}{" "}
                    active simulation
                    {affectedSimulations.filter((sim) => sim.active).length !==
                    1
                      ? "s"
                      : ""}
                    . You can view the details but cannot make changes to
                    prevent disruption to ongoing simulations.
                  </p>
                )}
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
            <div className="ml-auto flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleRandomizePersona}
                    disabled={isReadonly || isRandomizingPersona}
                  >
                    {isRandomizingPersona ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Shuffle className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Randomize</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleResetPersona}
                    disabled={isReadonly}
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Reset</TooltipContent>
              </Tooltip>
            </div>
          </CardHeader>
          <CardContent>
            <PersonaPicker
              personas={personas}
              label=""
              placeholder="Select a persona..."
              description="Choose the persona that will interact with students in this scenario."
              onSelect={(persona) => setSelectedPersonaId(persona.id)}
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
            <div className="ml-auto flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={noDocuments}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setNoDocuments(checked);
                    if (checked) {
                      setCurrentDocumentIds([]);
                    }
                  }}
                  disabled={isReadonly}
                />
                No documents
              </label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleRandomizeDocuments}
                    disabled={
                      isReadonly || isRandomizingDocuments || noDocuments
                    }
                  >
                    {isRandomizingDocuments ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Shuffle className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Randomize</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleResetDocuments}
                    disabled={isReadonly}
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Reset</TooltipContent>
              </Tooltip>
            </div>
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
                setCurrentDocumentIds(selectedDocs.map((doc) => doc.id))
              }
              disabled={isReadonly || noDocuments}
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
            <div className="ml-auto flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleRandomizeParameters}
                    disabled={isReadonly || isRandomizingParameters}
                  >
                    {isRandomizingParameters ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Shuffle className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Randomize</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleResetParameters}
                    disabled={isReadonly}
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Reset</TooltipContent>
              </Tooltip>
            </div>
          </CardHeader>
          <CardContent>
            <ParameterSelector
              parameters={parameters}
              parameterItems={parameterItems}
              selectedParameterItemIds={currentParameterItemIds}
              onParameterItemIdsChange={(parameterItemIds) =>
                setCurrentParameterItemIds(parameterItemIds)
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
                    {formData.problemStatement
                      ? "Regenerating..."
                      : "Generating..."}
                  </>
                ) : formData.problemStatement ? (
                  "Regenerate"
                ) : (
                  "Generate"
                )}
              </Button>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleResetContent}
                    disabled={isReadonly}
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Reset</TooltipContent>
              </Tooltip>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Textarea
                id="description"
                value={formData.problemStatement || ""}
                onChange={(e) =>
                  handleInputChange("problemStatement", e.target.value)
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
            isReadonly ||
            createScenarioMutation.isPending ||
            updateScenarioMutation.isPending
          }
          className="min-w-[120px]"
        >
          {isSubmitting ||
          createScenarioMutation.isPending ||
          updateScenarioMutation.isPending ? (
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
            {/* Department Selection - Only for superadmin */}
            {effectiveProfile?.role === "superadmin" && (
              <div className="space-y-2">
                <Label htmlFor="department">Department</Label>
                <DepartmentSelector
                  departments={departments.map((dept) => ({
                    id: dept.id,
                    title: dept.title as string,
                    ...(dept.description && { description: dept.description }),
                  }))}
                  selectedDepartment={
                    formData?.departmentId
                      ? (() => {
                          const dept = departments.find(
                            (d) => d.id === formData.departmentId
                          );
                          return dept
                            ? {
                                id: dept.id,
                                title: dept.title as string,
                                ...(dept.description && {
                                  description: dept.description,
                                }),
                              }
                            : null;
                        })()
                      : null
                  }
                  onSelect={(department) =>
                    handleInputChange("departmentId", department?.id || "")
                  }
                  placeholder="Select department"
                  disabled={isReadonly}
                />
              </div>
            )}
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
            {/* Practice Scenario feature removed - was not in final schema */}
            {/* <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Practice Scenario</Label>
                <p className="text-sm text-muted-foreground">
                  Mark this as a practice scenario for training purposes.
                </p>
              </div>
              <Switch
                checked={false}
                onCheckedChange={() => {}}
                disabled={isReadonly}
              />
            </div> */}
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
