/**
 * Scenario.tsx
 * Progressive step-by-step scenario creation flow
 * @AshokSaravanan222 & @siladiea
 * 05/20/2025
 */
"use client";
import {
  Check,
  GripVertical,
  Loader2,
  PlusCircle,
  RotateCcw,
  Shuffle,
  Trash2,
} from "lucide-react";
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
import { Input } from "@/components/ui/input";
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
      name: "New Scenario",
      problemStatement: "",
      departmentIds: effectiveProfile?.primaryDepartmentId
        ? [effectiveProfile.primaryDepartmentId]
        : [],
      active: true,
      hintsEnabled: false,
      objectivesEnabled: true,
      imageInputEnabled: false,
      inputGuardrailEnabled: false,
      outputGuardrailEnabled: false,
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
  const [originalObjectives, setOriginalObjectives] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingScenario, setIsGeneratingScenario] = useState(false);
  const [isRandomizingPersona, setIsRandomizingPersona] = useState(false);
  const [isRandomizingDocuments, setIsRandomizingDocuments] = useState(false);
  const [isRandomizingParameters, setIsRandomizingParameters] = useState(false);
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
  const [showRegenerationDialog, setShowRegenerationDialog] = useState(false);
  const [regenerationInstructions, setRegenerationInstructions] = useState("");
  const [originalFormData, setOriginalFormData] = useState(initialFormData);
  const [useDocuments, setUseDocuments] = useState(true);
  const [draggedObjectiveIndex, setDraggedObjectiveIndex] = useState<
    number | null
  >(null);

  // State for junction data (managed separately from scenario)
  const [currentObjectives, setCurrentObjectives] = useState<string[]>([]);
  const [currentParameterItemIds, setCurrentParameterItemIds] = useState<
    string[]
  >([]);
  const [currentDocumentIds, setCurrentDocumentIds] = useState<string[]>([]);

  // Staged selections per department (preserved when departments are deselected)
  type StagedSelections = {
    persona_id?: string | null;
    document_ids?: string[];
    parameter_item_ids?: string[];
  };
  const [_stagedSelections, setStagedSelections] = useState<
    Record<string, StagedSelections>
  >({});
  const [previousDepartmentIds, setPreviousDepartmentIds] = useState<string[]>(
    []
  );

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

  // Extract valid IDs from V2 response, filtered by selected departments
  const validPersonaIds = useMemo(() => {
    const baseIds = scenarioData?.valid_persona_ids || [];
    const selectedDeptIds = formData.departmentIds || [];

    // If no departments selected, return all valid IDs
    if (selectedDeptIds.length === 0) {
      return baseIds;
    }

    // Get union of persona_ids from selected departments
    const deptPersonaIds = new Set<string>();
    selectedDeptIds.forEach((deptId) => {
      const deptData = departmentMapping[deptId];
      if (deptData?.persona_ids && Array.isArray(deptData.persona_ids)) {
        deptData.persona_ids.forEach((id) => deptPersonaIds.add(id));
      }
    });

    // Filter base IDs to only include those in department persona IDs
    return baseIds.filter((id) => deptPersonaIds.has(id));
  }, [
    scenarioData?.valid_persona_ids,
    formData.departmentIds,
    departmentMapping,
  ]);

  const validDocumentIds = useMemo(() => {
    const baseIds = scenarioData?.valid_document_ids || [];
    const selectedDeptIds = formData.departmentIds || [];

    // If no departments selected, return all valid IDs
    if (selectedDeptIds.length === 0) {
      return baseIds;
    }

    // Get union of document_ids from selected departments
    const deptDocumentIds = new Set<string>();
    selectedDeptIds.forEach((deptId) => {
      const deptData = departmentMapping[deptId];
      if (deptData?.document_ids && Array.isArray(deptData.document_ids)) {
        deptData.document_ids.forEach((id) => deptDocumentIds.add(id));
      }
    });

    // Filter base IDs to only include those in department document IDs
    return baseIds.filter((id) => deptDocumentIds.has(id));
  }, [
    scenarioData?.valid_document_ids,
    formData.departmentIds,
    departmentMapping,
  ]);

  const validParameterItemIds = useMemo(() => {
    const baseIds = getAllValidParameterItemIds(scenarioData?.parameters || {});
    const selectedDeptIds = formData.departmentIds || [];

    // If no departments selected, return all valid IDs
    if (selectedDeptIds.length === 0) {
      return baseIds;
    }

    // Get union of parameter_ids from selected departments
    // Note: We need to map parameter_ids to parameter_item_ids
    const deptParameterIds = new Set<string>();
    selectedDeptIds.forEach((deptId) => {
      const deptData = departmentMapping[deptId];
      if (deptData?.parameter_ids && Array.isArray(deptData.parameter_ids)) {
        deptData.parameter_ids.forEach((id) => deptParameterIds.add(id));
      }
    });

    // Filter parameter items: include if their parameter_id is in department parameter IDs
    return baseIds.filter((itemId) => {
      const item = parameterItemMapping[itemId];
      return item && deptParameterIds.has(item.parameter_id);
    });
  }, [
    scenarioData?.parameters,
    formData.departmentIds,
    departmentMapping,
    parameterItemMapping,
  ]);

  // Track department changes and manage staged selections
  useEffect(() => {
    const currentDeptIds = formData.departmentIds || [];
    const prevDeptIds = previousDepartmentIds || [];

    // Skip if no change (initial load or same selection)
    if (
      currentDeptIds.length === prevDeptIds.length &&
      currentDeptIds.every((id, idx) => id === prevDeptIds[idx])
    ) {
      // Initialize on first load
      if (prevDeptIds.length === 0 && currentDeptIds.length > 0) {
        setPreviousDepartmentIds(currentDeptIds);
      }
      return;
    }

    // Find departments that were deselected
    const deselectedDepts = prevDeptIds.filter(
      (id) => !currentDeptIds.includes(id)
    );

    // Find departments that were newly selected
    const newlySelectedDepts = currentDeptIds.filter(
      (id) => !prevDeptIds.includes(id)
    );

    // Save selections for deselected departments
    if (deselectedDepts.length > 0) {
      setStagedSelections((prev) => {
        const updated = { ...prev };
        deselectedDepts.forEach((deptId) => {
          updated[deptId] = {
            persona_id: selectedPersonaId,
            document_ids: [...currentDocumentIds],
            parameter_item_ids: [...currentParameterItemIds],
          };
        });
        return updated;
      });
    }

    // Restore selections for newly selected departments
    if (newlySelectedDepts.length > 0) {
      setStagedSelections((prev) => {
        newlySelectedDepts.forEach((deptId) => {
          const staged = prev[deptId];
          if (staged) {
            // Restore persona if valid
            if (
              staged.persona_id &&
              validPersonaIds.includes(staged.persona_id)
            ) {
              setSelectedPersonaId(
                (prevPersona) => prevPersona || staged.persona_id || null
              );
            }

            // Restore documents if valid
            if (staged.document_ids && staged.document_ids.length > 0) {
              const validDocSet = new Set(validDocumentIds);
              const validDocs = staged.document_ids.filter((id) =>
                validDocSet.has(id)
              );
              if (validDocs.length > 0) {
                setCurrentDocumentIds((prevDocs) => {
                  const combined = new Set([...prevDocs, ...validDocs]);
                  return Array.from(combined);
                });
              }
            }

            // Restore parameter items if valid
            if (
              staged.parameter_item_ids &&
              staged.parameter_item_ids.length > 0
            ) {
              const validParamSet = new Set(validParameterItemIds);
              const validParams = staged.parameter_item_ids.filter((id) =>
                validParamSet.has(id)
              );
              if (validParams.length > 0) {
                setCurrentParameterItemIds((prevParams) => {
                  const combined = new Set([...prevParams, ...validParams]);
                  return Array.from(combined);
                });
              }
            }
          }
        });
        return prev; // Return unchanged since we're using separate setters
      });
    }

    // Update previous department IDs
    setPreviousDepartmentIds(currentDeptIds);
  }, [
    formData.departmentIds,
    previousDepartmentIds,
    selectedPersonaId,
    currentDocumentIds,
    currentParameterItemIds,
    validPersonaIds,
    validDocumentIds,
    validParameterItemIds,
  ]);

  // Clean up staged selections for departments that are no longer valid
  useEffect(() => {
    const validDeptIds = new Set(scenarioData?.valid_department_ids || []);
    setStagedSelections((prev) => {
      const cleaned: Record<string, StagedSelections> = {};
      Object.keys(prev).forEach((deptId) => {
        if (validDeptIds.has(deptId) && prev[deptId]) {
          cleaned[deptId] = prev[deptId];
        }
      });
      return cleaned;
    });
  }, [scenarioData?.valid_department_ids]);

  // Clear selections when they become invalid after department changes
  // (but preserve cross-department entities and staged selections)
  useEffect(() => {
    // Clear persona if it's no longer valid
    if (selectedPersonaId && !validPersonaIds.includes(selectedPersonaId)) {
      setSelectedPersonaId(null);
    }
  }, [selectedPersonaId, validPersonaIds]);

  useEffect(() => {
    // Clear documents that are no longer valid
    if (currentDocumentIds.length > 0) {
      const validSet = new Set(validDocumentIds);
      const filtered = currentDocumentIds.filter((id) => validSet.has(id));
      if (filtered.length !== currentDocumentIds.length) {
        setCurrentDocumentIds(filtered);
      }
    }
  }, [currentDocumentIds, validDocumentIds]);

  useEffect(() => {
    // Clear parameter items that are no longer valid
    if (currentParameterItemIds.length > 0) {
      const validSet = new Set(validParameterItemIds);
      const filtered = currentParameterItemIds.filter((id) => validSet.has(id));
      if (filtered.length !== currentParameterItemIds.length) {
        setCurrentParameterItemIds(filtered);
      }
    }
  }, [currentParameterItemIds, validParameterItemIds]);

  // Load scenario data from V2 response
  useEffect(() => {
    if (scenarioData && isEditMode) {
      // Edit mode: load existing scenario data
      const deptIds = scenarioData.department_ids || [];
      setFormData({
        name: scenarioData.name,
        problemStatement: scenarioData.problem_statement,
        departmentIds: deptIds,
        active: scenarioData.active ?? true,
        hintsEnabled: scenarioData.hints_enabled ?? false,
        objectivesEnabled: scenarioData.objectives_enabled ?? true,
        imageInputEnabled: scenarioData.image_input_enabled ?? false,
        inputGuardrailEnabled: scenarioData.input_guardrail_enabled ?? false,
        outputGuardrailEnabled: scenarioData.output_guardrail_enabled ?? false,
      });
      // Initialize previousDepartmentIds when loading scenario data
      if (previousDepartmentIds.length === 0 && deptIds.length > 0) {
        setPreviousDepartmentIds(deptIds);
      }
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
        departmentIds: scenarioData.department_ids || [],
        active: scenarioData.active ?? true,
        hintsEnabled: scenarioData.hints_enabled ?? false,
        objectivesEnabled: scenarioData.objectives_enabled ?? true,
        imageInputEnabled: scenarioData.image_input_enabled ?? false,
        inputGuardrailEnabled: scenarioData.input_guardrail_enabled ?? false,
        outputGuardrailEnabled: scenarioData.output_guardrail_enabled ?? false,
      });
      setOriginalDocumentIds(scenarioData.document_ids);
      setOriginalParameterItemIds(
        getParameterItemIdsFromStructure(scenarioData.parameters)
      );
      setOriginalObjectives(
        getObjectivesFromMapping(
          scenarioData.objective_ids,
          scenarioData.objective_mapping
        )
      );
    } else if (!isEditMode && scenarioData) {
      // Create mode: use defaults from API
      setFormData({
        name: "New Scenario",
        problemStatement: "",
        departmentIds: scenarioData.department_ids || [],
        active: true,
        hintsEnabled: false,
        objectivesEnabled: true,
        imageInputEnabled: false,
        inputGuardrailEnabled: false,
        outputGuardrailEnabled: false,
      });
    }
  }, [scenarioData, isEditMode, previousDepartmentIds.length]);

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
      current.active !== original.active ||
      current.hintsEnabled !== original.hintsEnabled ||
      current.objectivesEnabled !== original.objectivesEnabled ||
      current.imageInputEnabled !== original.imageInputEnabled ||
      current.inputGuardrailEnabled !== original.inputGuardrailEnabled ||
      current.outputGuardrailEnabled !== original.outputGuardrailEnabled ||
      JSON.stringify(current.departmentIds?.sort()) !==
        JSON.stringify(original.departmentIds?.sort()) ||
      JSON.stringify([...currentDocumentIds].sort()) !==
        JSON.stringify([...(originalDocumentIds || [])].sort()) ||
      JSON.stringify([...currentParameterItemIds].sort()) !==
        JSON.stringify([...(originalParameterItemIds || [])].sort()) ||
      JSON.stringify(currentObjectives) !==
        JSON.stringify(originalObjectives || [])
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
    currentObjectives,
    originalObjectives,
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
      case "basic":
        // Always completed - name defaults to "New Scenario"
        return "completed";
      case "persona":
        // Can start immediately, doesn't depend on name
        return selectedPersonaId ? "completed" : "active";
      case "documents":
        return !selectedPersonaId
          ? "pending"
          : currentDocumentIds.length > 0 || !useDocuments
            ? "completed"
            : "active";
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
      id: "basic",
      title: "",
      description: "",
      status: getStepStatus("basic"),
    },
    {
      id: "persona",
      title: "Select Persona Type",
      description: "Choose the type of persona for this scenario",
      status: getStepStatus("persona"),
    },
    {
      id: "documents",
      title: "Choose Documents",
      description: "Select 1-2 relevant documents for this scenario",
      status: getStepStatus("documents"),
      optional: true,
    },
    {
      id: "parameters",
      title: "Set Parameters",
      description: "Configure scenario parameters and environment",
      status: getStepStatus("parameters"),
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
      if (!useDocuments) {
        toast("Documents disabled by choice");
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

  // Objective handlers
  const addObjective = () => {
    if (currentObjectives.length >= 3) {
      toast.error("Maximum 3 objectives allowed");
      return;
    }
    setCurrentObjectives((prev) => [...prev, ""]);
  };

  const removeObjective = (index: number) => {
    setCurrentObjectives((prev) => {
      const next = [...prev];
      next.splice(index, 1);
      return next;
    });
  };

  const updateObjective = (index: number, value: string) => {
    setCurrentObjectives((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const handleDragStartObjective = (
    e: React.DragEvent<HTMLDivElement>,
    index: number
  ) => {
    setDraggedObjectiveIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDropObjective = (
    e: React.DragEvent<HTMLDivElement>,
    targetIndex: number
  ) => {
    e.preventDefault();
    if (draggedObjectiveIndex === null) return;
    setCurrentObjectives((prev) => {
      const next = [...prev];
      const [removed] = next.splice(draggedObjectiveIndex, 1);
      next.splice(targetIndex, 0, removed || "");
      return next;
    });
    setDraggedObjectiveIndex(null);
  };

  const handleGenerateScenario = async (userInstructions?: string) => {
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
        userInstructions: userInstructions || undefined,
      });

      if (!result.success) {
        throw new Error(result.message || "Failed to generate scenario");
      }

      if (result.title || result.description) {
        setFormData((prev) => ({
          ...prev,
          // Only replace name if it's still the default "New Scenario"
          name:
            prev.name === "New Scenario" ||
            !prev.name ||
            prev.name.trim() === ""
              ? result.title || prev.name || "New Scenario"
              : prev.name,
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
    setIsSubmitting(true);

    try {
      // Prepare payload for V2 API
      const payload = {
        name: formData.name?.trim() || "",
        problem_statement: formData.problemStatement?.trim() || "",
        department_ids: formData.departmentIds || null,
        active: formData.active ?? true,
        persona_id: selectedPersonaId,
        document_ids: currentDocumentIds,
        objective_ids: currentObjectives.filter((obj) => obj.trim()), // Send raw objective text
        parameters: groupParameterItemsByParameterId(
          currentParameterItemIds,
          parameterItemMapping
        ),
        hints_enabled: formData.hintsEnabled ?? false,
        objectives_enabled: formData.objectivesEnabled ?? true,
        image_input_enabled: formData.imageInputEnabled ?? false,
        input_guardrail_enabled: formData.inputGuardrailEnabled ?? false,
        output_guardrail_enabled: formData.outputGuardrailEnabled ?? false,
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

      <div className="space-y-6">
        {/* Step 1: Basic Information - Subtle inline name editor */}
        <Card className="transition-all">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium bg-green-500 text-white shrink-0">
                <Check className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <input
                  type="text"
                  value={formData.name || ""}
                  onChange={(e) => handleInputChange("name", e.target.value)}
                  onFocus={(e) => {
                    if (e.target.value === "New Scenario") {
                      e.target.select();
                    }
                  }}
                  onBlur={(e) => {
                    // If empty on blur, revert to "New Scenario"
                    if (!e.target.value || e.target.value.trim() === "") {
                      handleInputChange("name", "New Scenario");
                    }
                  }}
                  className="w-full text-2xl font-semibold border-none outline-none bg-transparent px-2 py-1 hover:bg-muted/50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:bg-muted/50 focus:ring-2 focus:ring-primary/20"
                  placeholder="New Scenario"
                  disabled={isReadonly}
                />
                <p className="text-xs text-muted-foreground mt-1 px-2">
                  {formData.name === "New Scenario" || !formData.name
                    ? "Click to edit • Name will be auto-generated if unchanged"
                    : "Click to edit"}
                </p>
              </div>
            </div>
          </CardContent>
          <CardContent className="pt-0 space-y-4">
            {/* Department Selection */}
            <div className="space-y-2">
              <Label htmlFor="department">Department</Label>
              <DepartmentPicker
                mapping={departmentMapping}
                validIds={scenarioData?.valid_department_ids || []}
                selectedIds={formData.departmentIds || []}
                onSelect={(ids) => handleInputChange("departmentIds", ids)}
                placeholder="All Departments"
                disabled={isReadonly}
                multiSelect={true}
              />
            </div>

            {/* Active Switch */}
            <div className="flex items-center gap-2">
              <Label htmlFor="active" className="text-sm">
                Scenario Active
              </Label>
              <Switch
                id="active"
                checked={formData.active ?? true}
                onCheckedChange={(checked) =>
                  handleInputChange("active", checked)
                }
                disabled={isReadonly}
              />
            </div>

            {/* Scenario Flags - Removed guardrails, moved to persona section */}
          </CardContent>
        </Card>
        {/* Step 2: Persona Selection */}
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
                  "2"
                )}
              </div>
              <div>
                <CardTitle className="text-lg">
                  {steps[1]?.title || ""}
                </CardTitle>
                <CardDescription>{steps[1]?.description || ""}</CardDescription>
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
          <CardContent className="space-y-4">
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

            {/* Guardrail Switches */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="inputGuardrailEnabled" className="text-sm">
                  Input Guardrail Enabled
                </Label>
                <Switch
                  id="inputGuardrailEnabled"
                  checked={formData.inputGuardrailEnabled ?? false}
                  onCheckedChange={(checked) =>
                    handleInputChange("inputGuardrailEnabled", checked)
                  }
                  disabled={isReadonly}
                />
              </div>

              <div className="flex items-center gap-2">
                <Label htmlFor="outputGuardrailEnabled" className="text-sm">
                  Output Guardrail Enabled
                </Label>
                <Switch
                  id="outputGuardrailEnabled"
                  checked={formData.outputGuardrailEnabled ?? false}
                  onCheckedChange={(checked) =>
                    handleInputChange("outputGuardrailEnabled", checked)
                  }
                  disabled={isReadonly}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Step 3: Documents */}
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
            <div className="ml-auto flex items-center gap-3">
              {useDocuments && (
                <div className="flex items-center gap-2">
                  <Switch
                    id="imageInputEnabled"
                    checked={formData.imageInputEnabled ?? false}
                    onCheckedChange={(checked) =>
                      handleInputChange("imageInputEnabled", checked)
                    }
                    disabled={isReadonly}
                  />
                  <Label htmlFor="imageInputEnabled" className="text-sm">
                    Image Input Enabled
                  </Label>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Switch
                  id="use-documents"
                  checked={useDocuments}
                  onCheckedChange={(checked) => {
                    setUseDocuments(checked);
                    if (!checked) {
                      setCurrentDocumentIds([]);
                    }
                  }}
                  disabled={isReadonly}
                />
                <Label htmlFor="use-documents" className="text-sm">
                  Use documents
                </Label>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleRandomizeDocuments}
                    disabled={
                      isReadonly || isRandomizingDocuments || !useDocuments
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
              documentDetails={scenarioData?.document_details || []}
              multiSelect={true}
              label=""
              placeholder="Select documents..."
              description="Choose documents that will be available during this scenario."
              disabled={isReadonly || !useDocuments}
              onSelect={(ids) => {
                // Enforce max 2 documents
                const limitedIds = ids.slice(0, 2);
                setCurrentDocumentIds(limitedIds);
              }}
            />
          </CardContent>
        </Card>

        {/* Step 4: Parameters */}
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

        {/* Step 5: Content */}
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
                  "5"
                )}
              </div>
              <div className="flex-1">
                <CardTitle className="text-lg">
                  {steps[4]?.title || ""}
                </CardTitle>
                <CardDescription>{steps[4]?.description || ""}</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="default"
                size="sm"
                onClick={() => {
                  if (
                    formData.problemStatement &&
                    formData.problemStatement.trim()
                  ) {
                    setShowRegenerationDialog(true);
                  } else {
                    handleGenerateScenario();
                  }
                }}
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

            {/* Hints Enabled Switch */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="hintsEnabled" className="text-sm">
                  Hints Enabled
                </Label>
                <Switch
                  id="hintsEnabled"
                  checked={formData.hintsEnabled ?? false}
                  onCheckedChange={(checked) =>
                    handleInputChange("hintsEnabled", checked)
                  }
                  disabled={isReadonly}
                />
              </div>
            </div>

            {/* Objectives Section */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="objectivesEnabled" className="text-sm">
                  Objectives Enabled
                </Label>
                <Switch
                  id="objectivesEnabled"
                  checked={formData.objectivesEnabled ?? true}
                  onCheckedChange={(checked) => {
                    handleInputChange("objectivesEnabled", checked);
                    // Auto-create first objective when enabling
                    if (checked && currentObjectives.length === 0) {
                      setCurrentObjectives([""]);
                    }
                  }}
                  disabled={isReadonly}
                />
                <Badge variant="secondary" className="text-xs">
                  Optional
                </Badge>
              </div>

              {formData.objectivesEnabled && (
                <div className="space-y-2">
                  {currentObjectives.map((objective, index) => (
                    <div
                      key={`objective-${index}`}
                      className={`flex items-center gap-2 ${
                        draggedObjectiveIndex === index ? "opacity-50" : ""
                      }`}
                      draggable={!isReadonly}
                      onDragStart={(e) => handleDragStartObjective(e, index)}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDropObjective(e, index)}
                    >
                      <GripVertical className="h-4 w-4 text-muted-foreground shrink-0 cursor-grab" />
                      <Input
                        value={objective || ""}
                        onChange={(e) => updateObjective(index, e.target.value)}
                        placeholder={`Learning objective ${index + 1}`}
                        className="flex-1"
                        disabled={isReadonly}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => removeObjective(index)}
                        className="h-8 w-8 shrink-0"
                        disabled={isReadonly}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {formData.objectivesEnabled && currentObjectives.length < 3 && (
                <div>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={addObjective}
                    disabled={isReadonly}
                    size="sm"
                  >
                    <PlusCircle className="h-4 w-4 mr-2" /> Add objective
                  </Button>
                </div>
              )}
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

      {/* Regeneration Dialog */}
      <AlertDialog
        open={showRegenerationDialog}
        onOpenChange={setShowRegenerationDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Regenerate Scenario</AlertDialogTitle>
            <AlertDialogDescription>
              What would you like to change or emphasize in this scenario?
              Provide any specific instructions for the AI generation.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="regeneration-instructions">
                Instructions (Optional)
              </Label>
              <Textarea
                id="regeneration-instructions"
                value={regenerationInstructions}
                onChange={(e) => setRegenerationInstructions(e.target.value)}
                placeholder="e.g., Make it more challenging, focus on time management, emphasize the student's frustration..."
                className="min-h-[100px]"
                disabled={isGeneratingScenario}
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={isGeneratingScenario}
              onClick={() => {
                setRegenerationInstructions("");
                setShowRegenerationDialog(false);
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                handleGenerateScenario(
                  regenerationInstructions.trim() || undefined
                );
                setShowRegenerationDialog(false);
                setRegenerationInstructions("");
              }}
              disabled={isGeneratingScenario}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {isGeneratingScenario ? "Regenerating..." : "Regenerate"}
            </AlertDialogAction>
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
