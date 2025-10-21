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
import { DepartmentPicker } from "@/components/common/forms/DepartmentPicker";
import { useBreadcrumbContext } from "@/contexts/breadcrumb-context";
import { useProfile } from "@/contexts/profile-context";
import { useLogger } from "@/lib/api/v2/hooks/logs";
import {
  useCreateScenario,
  useGenerateScenarioAI,
  useRandomizeScenario,
  useScenarioDetail,
  useScenarioDetailDefault,
  useUpdateScenario,
} from "@/lib/api/v2/hooks/scenarios";
import {
  getAllValidParameterItemIds,
  getObjectivesFromMapping,
  getParameterItemIdsFromStructure,
  groupParameterItemsByParameterId,
} from "@/utils/scenario-helpers";

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
  const { setEntityMetadata, clearEntityMetadata } = useBreadcrumbContext();
  const isEditMode = mode === "edit" && !!scenarioId;
  const log = useLogger();
  // V2 API hooks - single hook for all data
  const { data: scenarioDetail, isLoading: isLoadingScenarioDetail } =
    useScenarioDetail(
      scenarioId || "",
      effectiveProfile?.id || "",
      !!scenarioId && isEditMode
    );

  const { data: scenarioDetailDefault, isLoading: isLoadingScenarioDefault } =
    useScenarioDetailDefault(effectiveProfile?.id || "", !isEditMode);

  // Use edit detail when editing, default detail when creating
  const scenarioData = isEditMode ? scenarioDetail : scenarioDetailDefault;
  const isLoadingData = isEditMode
    ? isLoadingScenarioDetail
    : isLoadingScenarioDefault;

  // Set breadcrumb context when scenario data is loaded
  useEffect(() => {
    if (scenarioDetail?.name && scenarioId && isEditMode) {
      setEntityMetadata({
        entityId: scenarioId,
        entityName: scenarioDetail.name,
        entityType: "scenario",
      });
    }
    return () => clearEntityMetadata();
  }, [
    scenarioDetail,
    scenarioId,
    isEditMode,
    setEntityMetadata,
    clearEntityMetadata,
  ]);

  // V2 Mutation hooks
  const { mutate: createScenario } = useCreateScenario();
  const { mutate: updateScenario } = useUpdateScenario();
  const generateAIMutation = useGenerateScenarioAI();
  const randomizeMutation = useRandomizeScenario();

  // Form data state
  const initialFormData = useMemo(
    () => ({
      name: "",
      problemStatement: "",
      defaultScenario: false,
      departmentId: effectiveProfile?.primaryDepartmentId || "",
    }),
    [effectiveProfile?.primaryDepartmentId]
  );

  const [formData, setFormData] = useState(initialFormData);

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
  const [originalFormData, setOriginalFormData] = useState(initialFormData);
  const [noDocuments, setNoDocuments] = useState(false);

  // State for junction data (managed separately from scenario)
  const [currentObjectives, setCurrentObjectives] = useState<string[]>([]);
  const [currentParameterItemIds, setCurrentParameterItemIds] = useState<
    string[]
  >([]);
  const [currentDocumentIds, setCurrentDocumentIds] = useState<string[]>([]);

  // Extract mappings from V2 response
  const personaMapping = useMemo(
    () => scenarioData?.persona_mapping || {},
    [scenarioData]
  );
  const documentMapping = useMemo(
    () => scenarioData?.document_mapping || {},
    [scenarioData]
  );
  const parameterMapping = useMemo(
    () => scenarioData?.parameter_mapping || {},
    [scenarioData]
  );
  const parameterItemMapping = useMemo(
    () => scenarioData?.parameter_item_mapping || {},
    [scenarioData]
  );
  const simulationMapping = useMemo(
    () => scenarioData?.simulation_mapping || {},
    [scenarioData]
  );
  const departmentMapping = useMemo(
    () => scenarioData?.department_mapping || {},
    [scenarioData]
  );

  // Extract valid IDs from V2 response
  const validPersonaIds = useMemo(
    () => scenarioData?.valid_persona_ids || [],
    [scenarioData]
  );
  const validDocumentIds = useMemo(
    () => scenarioData?.valid_document_ids || [],
    [scenarioData]
  );
  const validParameterItemIds = useMemo(
    () => getAllValidParameterItemIds(scenarioData?.parameters || {}),
    [scenarioData]
  );

  // Load scenario data from V2 response
  useEffect(() => {
    if (scenarioData && isEditMode) {
      // Edit mode: load existing scenario data
      setFormData({
        name: scenarioData.name,
        problemStatement: scenarioData.problem_statement,
        defaultScenario: scenarioData.default_scenario,
        departmentId: scenarioData.department_id,
      });
      setSelectedPersonaId(scenarioData.persona_id);
      setCurrentDocumentIds(scenarioData.document_ids);
      setCurrentParameterItemIds(
        getParameterItemIdsFromStructure(scenarioData.parameters)
      );
      setCurrentObjectives(
        getObjectivesFromMapping(
          scenarioData.objective_ids,
          scenarioData.objective_mapping
        )
      );
      // Store originals for change tracking
      setOriginalFormData({
        name: scenarioData.name,
        problemStatement: scenarioData.problem_statement,
        defaultScenario: scenarioData.default_scenario,
        departmentId: scenarioData.department_id,
      });
      setOriginalDocumentIds(scenarioData.document_ids);
      setOriginalParameterItemIds(
        getParameterItemIdsFromStructure(scenarioData.parameters)
      );
    } else if (!isEditMode && scenarioData) {
      // Create mode: use defaults from API
      setFormData({
        name: "",
        problemStatement: "",
        defaultScenario: false,
        departmentId: scenarioData.department_id,
      });
    }
  }, [scenarioData, isEditMode]);

  // Check if form has changes
  const hasChanges = useMemo(() => {
    if (!isEditMode) return false;

    const current = formData;
    const original = originalFormData;
    const originalPersonaId = scenarioData?.persona_id || null;

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
    scenarioData,
    currentDocumentIds,
    originalDocumentIds,
    currentParameterItemIds,
    originalParameterItemIds,
  ]);

  // Use server-computed readonly flag from V2 API
  const isReadonly = useMemo(() => {
    if (!isEditMode || !scenarioData) return false;
    return !scenarioData.can_edit;
  }, [isEditMode, scenarioData]);

  // Get affected simulations from V2 data
  const affectedSimulations = useMemo(() => {
    if (!scenarioData?.active_simulation_ids) return [];
    return scenarioData.active_simulation_ids.map((id) => ({
      id,
      name: simulationMapping[id]?.name || "",
      active: true, // These are active simulations from server
    }));
  }, [scenarioData, simulationMapping]);

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
    field: string,
    value: string | string[] | boolean | null
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleRandomizeParameters = async () => {
    try {
      setIsRandomizingParameters(true);
      const resp = await randomizeMutation.mutateAsync({
        name: formData.name || "",
        personaId: selectedPersonaId || undefined,
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
      const resp = await randomizeMutation.mutateAsync({
        name: formData.name || "",
        personaId: selectedPersonaId || undefined,
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
      const resp = await randomizeMutation.mutateAsync({
        name: formData.name || "",
        personaId: selectedPersonaId || undefined,
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
      // Get department ID from first valid department
      const departmentId = effectiveProfile?.primaryDepartmentId || "";
      if (!departmentId) {
        throw new Error("No valid department found");
      }

      const result = await generateAIMutation.mutateAsync({
        departmentId,
        personaId: selectedPersonaId || undefined,
        documentIds: currentDocumentIds,
        parameterItemIds: currentParameterItemIds,
        profileId: effectiveProfile?.id || undefined,
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
      // Prepare payload for V2 API
      const payload = {
        name: formData.name?.trim() || "",
        problem_statement: formData.problemStatement?.trim() || "",
        department_id:
          formData.departmentId || effectiveProfile?.primaryDepartmentId || "",
        active: true,
        default_scenario: formData.defaultScenario || false,
        persona_id: selectedPersonaId,
        document_ids: currentDocumentIds,
        objective_ids: currentObjectives.filter((obj) => obj.trim()), // Send raw objective text
        parameters: groupParameterItemsByParameterId(
          currentParameterItemIds,
          parameterItemMapping
        ),
      };

      if (isEditMode) {
        // UPDATE mode - V2 handles all junction tables automatically
        updateScenario(
          {
            scenarioId: scenarioId!,
            ...payload,
          },
          {
            onSuccess: () => {
              toast.success("Scenario updated successfully!");
              router.push("/create/scenarios");
            },
            onError: (error) => {
              log.error("scenario.update.failed", {
                message: "Error updating scenario",
                error,
                context: {
                  component: "Scenario",
                  function: "handleSubmit",
                  scenarioId,
                },
              });
              toast.error(`Failed to update scenario: ${error.message}`);
              setIsSubmitting(false);
            },
          }
        );
      } else {
        // CREATE mode - V2 handles all junction tables automatically
        createScenario(payload, {
          onSuccess: () => {
            toast.success("Scenario created successfully!");
            router.push("/create/scenarios");
          },
          onError: (error) => {
            log.error("scenario.create.failed", {
              message: "Error creating scenario",
              error,
              context: {
                component: "Scenario",
                function: "handleSubmit",
              },
            });
            toast.error(`Failed to create scenario: ${error.message}`);
            setIsSubmitting(false);
          },
        });
      }
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

  // Convert selectedPersonaId to selectedPersonaIds array for PersonaPicker
  const selectedPersonaIds = useMemo(() => {
    return selectedPersonaId ? [selectedPersonaId] : [];
  }, [selectedPersonaId]);

  // Handler to convert PersonaPicker output (array) to single ID
  const handlePersonaSelect = (ids: string[]) => {
    setSelectedPersonaId(ids[0] || null);
  };

  // Loading state for edit mode
  if (isLoadingData) {
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
                {scenarioData?.generated
                  ? "Generated scenario cannot be edited"
                  : "Scenario is in use by active simulations"}
              </h3>
              <div className="mt-2 text-sm text-yellow-700">
                {scenarioData?.generated ? (
                  <p>
                    This is a generated scenario that cannot be directly edited.
                    You can duplicate this scenario to create a new editable
                    version with your desired changes.
                  </p>
                ) : (
                  <p>
                    This scenario is currently being used by{" "}
                    {affectedSimulations.length} active simulation
                    {affectedSimulations.length !== 1 ? "s" : ""}. You can view
                    the details but cannot make changes to prevent disruption to
                    ongoing simulations.
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
              mapping={personaMapping}
              validIds={validPersonaIds}
              selectedIds={selectedPersonaIds}
              onSelect={handlePersonaSelect}
              multiSelect={false}
              label=""
              placeholder="Select a persona..."
              description="Choose the persona that will interact with students in this scenario."
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
              mapping={documentMapping}
              validIds={validDocumentIds}
              selectedIds={currentDocumentIds}
              onSelect={setCurrentDocumentIds}
              label=""
              placeholder="Select documents..."
              description="Choose documents that will be available during this scenario."
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
              parameterMapping={parameterMapping}
              parameterItemMapping={parameterItemMapping}
              validParameterItemIds={validParameterItemIds}
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
            {/* Department Selection - Only for superadmin */}
            {effectiveProfile?.role === "superadmin" && (
              <div className="space-y-2">
                <Label htmlFor="department">Department</Label>
                <DepartmentPicker
                  mapping={departmentMapping}
                  validIds={scenarioData?.valid_department_ids || []}
                  selectedIds={
                    formData?.departmentId ? [formData.departmentId] : []
                  }
                  onSelect={(ids) =>
                    handleInputChange("departmentId", ids[0] || "")
                  }
                  placeholder="Select department"
                  disabled={isReadonly}
                  multiSelect={false}
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
                    {sim.name}
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
