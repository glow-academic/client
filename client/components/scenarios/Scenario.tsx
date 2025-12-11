/**
 * Scenario.tsx
 * Progressive step-by-step scenario creation flow
 * @AshokSaravanan222 & @siladiea
 * 05/20/2025
 */
"use client";
import { Loader2, RotateCcw } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import * as tus from "tus-js-client";

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
import { Button } from "@/components/ui/button";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

// Custom Components
import { type DocumentMappingItem } from "@/components/common/forms/DocumentPicker";
import { DocumentSection } from "@/components/common/forms/DocumentSection";
import { ParameterItemSection } from "@/components/common/forms/ParameterItemSection";
import { ParameterSection } from "@/components/common/forms/ParameterSection";
import { PersonaSection } from "@/components/common/forms/PersonaSection";
import { ContentSection } from "@/components/scenarios/ContentSection";
import { ScenarioBasicInfoSection } from "@/components/scenarios/ScenarioBasicInfoSection";

// Types and API functions
import type {
  CreateScenarioIn,
  CreateScenarioOut,
  GenerateAIScenarioIn,
  GenerateAIScenarioOut,
  ScenarioDetailOut,
  ScenarioNewOut,
  UpdateScenarioIn,
  UpdateScenarioOut,
} from "@/app/(main)/create/scenarios/s/[scenarioId]/page";
import { useBreadcrumbContext } from "@/contexts/breadcrumb-context";
import { useProfile } from "@/contexts/profile-context";
import {
  getDefaultDepartmentIds,
  transformDepartmentIdsForSubmit,
} from "@/utils/department-picker-helpers";
import {
  getFieldIdsFromStructure,
  getObjectivesFromMapping,
  groupFieldsByParameterId,
} from "@/utils/scenario-helpers";

export interface ScenarioProps {
  scenarioId?: string;
  mode?: "create" | "edit";
  // Server-provided data (for server-side rendering)
  scenarioDetail?: ScenarioDetailOut;
  scenarioDetailDefault?: ScenarioNewOut;
  // Server actions (replaces useMutation)
  createScenarioAction?: (
    input: CreateScenarioIn
  ) => Promise<CreateScenarioOut>;
  updateScenarioAction?: (
    input: UpdateScenarioIn
  ) => Promise<UpdateScenarioOut>;
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
  scenarioDetail: serverScenarioDetail,
  scenarioDetailDefault: serverScenarioDetailDefault,
  createScenarioAction,
  updateScenarioAction,
}: ScenarioProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { effectiveProfile, socket, isConnected } = useProfile();
  const { setEntityMetadata, clearEntityMetadata } = useBreadcrumbContext();
  const isEditMode = mode === "edit" && !!scenarioId;
  const isSuperadmin = effectiveProfile?.role === "superadmin";

  // Helper function to update URL with query parameters
  const updateUrlParams = useCallback(
    (updates: Record<string, string | string[] | null>) => {
      const params = new URLSearchParams(searchParams.toString());

      Object.entries(updates).forEach(([key, value]) => {
        if (value === null || (Array.isArray(value) && value.length === 0)) {
          params.delete(key);
        } else if (Array.isArray(value)) {
          // Use comma-separated values to match how page.tsx reads them
          params.set(key, value.join(","));
        } else {
          params.set(key, value);
        }
      });

      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [searchParams, pathname, router]
  );

  // Use server-provided data directly (no fallback needed - server pages always provide data)
  const scenarioDetail = serverScenarioDetail;
  const scenarioDetailDefault = serverScenarioDetailDefault;

  // Use edit detail when editing, default detail when creating
  const scenarioData = isEditMode ? scenarioDetail : scenarioDetailDefault;

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

  // Extract body types for type safety
  type CreateScenarioBody = CreateScenarioIn extends { body: infer B }
    ? B
    : never;
  type UpdateScenarioBody = UpdateScenarioIn extends { body: infer B }
    ? B
    : never;
  type GenerateAIScenarioBody = GenerateAIScenarioIn;

  // Server action handlers
  const handleCreateScenario = async (body: CreateScenarioBody) => {
    if (!createScenarioAction) {
      throw new Error("createScenarioAction is required");
    }
    return await createScenarioAction({ body });
  };

  const handleUpdateScenario = async (body: UpdateScenarioBody) => {
    if (!updateScenarioAction) {
      throw new Error("updateScenarioAction is required");
    }
    return await updateScenarioAction({ body });
  };

  const handleGenerateAIScenario = async (
    body: GenerateAIScenarioBody
  ): Promise<GenerateAIScenarioOut> => {
    if (!socket || !isConnected) {
      throw new Error("WebSocket not connected");
    }

    // Determine if we're regenerating (problem statement exists) or generating new
    const isRegenerating = !!formData.problemStatement?.trim();
    const initialMessage = isRegenerating
      ? "Regenerating scenario..."
      : "Generating scenario...";

    // Create a single toast at the start
    const toastId = toast.loading(initialMessage);

    return new Promise((resolve, reject) => {
      // Collect IDs from tool completion events
      let problemStatementId: string | null = null;
      let objectiveIds: string[] = [];
      const documentIds: string[] = [];
      const imageIds: string[] = [];
      const title = "";
      const description = "";
      const objectives: string[] = [];
      const dynamicDocumentMapping: Record<string, string> | null = null;

      // Set up event listeners
      const handleProgress = (data: {
        type: string;
        message?: string;
        tool_name?: string;
        trace_id?: string;
      }) => {
        // Update the same toast with progress messages
        const progressMessage =
          data.message ||
          (data.type === "start"
            ? initialMessage
            : data.tool_name
              ? `Calling ${data.tool_name}...`
              : "Processing...");
        toast.loading(progressMessage, { id: toastId });
      };

      // Tool completion event handlers
      const handleProblemStatementComplete = (data: {
        success: boolean;
        problem_statement_id: string;
        trace_id?: string;
        message?: string;
      }) => {
        // eslint-disable-next-line no-console
        console.log(
          "[Scenario] scenario_tool_problem_statement_complete event received:",
          {
            success: data.success,
            problem_statement_id: data.problem_statement_id,
            trace_id: data.trace_id,
            message: data.message,
          }
        );
        if (data.success) {
          problemStatementId = data.problem_statement_id;
          // Update state to trigger URL refresh
          setCurrentProblemStatementIds((prev) => {
            if (prev.includes(data.problem_statement_id)) {
              return prev;
            }
            return [...prev, data.problem_statement_id];
          });
        }
      };

      const handleObjectivesComplete = (data: {
        success: boolean;
        objective_ids: string[];
        trace_id?: string;
        message?: string;
      }) => {
        // eslint-disable-next-line no-console
        console.log(
          "[Scenario] scenario_tool_objectives_complete event received:",
          {
            success: data.success,
            objective_ids: data.objective_ids,
            trace_id: data.trace_id,
            message: data.message,
          }
        );
        if (data.success) {
          objectiveIds = data.objective_ids;
        }
      };

      const handleDocumentComplete = (data: {
        success: boolean;
        document_id: string;
        parent_document_id?: string;
        trace_id?: string;
        message?: string;
      }) => {
        // eslint-disable-next-line no-console
        console.log(
          "[Scenario] scenario_tool_document_complete event received:",
          {
            success: data.success,
            document_id: data.document_id,
            parent_document_id: data.parent_document_id,
            trace_id: data.trace_id,
            message: data.message,
          }
        );

        if (data.success) {
          documentIds.push(data.document_id);

          // If parent_document_id is provided, add template document to currentTemplateDocumentIds
          // Keep parent document in currentDocumentIds (don't replace)
          const parentDocumentId = data.parent_document_id;
          if (parentDocumentId) {
            // eslint-disable-next-line no-console
            console.log("[Scenario] Adding template document:", {
              parent_id: parentDocumentId,
              template_id: data.document_id,
            });
            // Add template document to templateDocumentIds
            setCurrentTemplateDocumentIds((prev) => {
              if (prev.includes(data.document_id)) {
                return prev;
              }
              return [...prev, data.document_id];
            });
            // Keep parent document in currentDocumentIds (don't replace)
            // Parent document stays in currentDocumentIds for selection box
          } else {
            // No parent ID - just add the new document ID to regular documents
            // eslint-disable-next-line no-console
            console.log(
              "[Scenario] No parent_document_id provided, adding new document:",
              data.document_id
            );
            setCurrentDocumentIds((prev) => [...prev, data.document_id]);
          }
        } else {
          // eslint-disable-next-line no-console
          console.error("[Scenario] Document completion failed:", data.message);
        }
      };

      const handleImageComplete = (data: {
        success: boolean;
        image_id: string;
        trace_id?: string;
        message?: string;
      }) => {
        // eslint-disable-next-line no-console
        console.log("[Scenario] scenario_tool_image_complete event received:", {
          success: data.success,
          image_id: data.image_id,
          trace_id: data.trace_id,
          message: data.message,
        });
        if (data.success) {
          imageIds.push(data.image_id);
        }
      };

      const handleComplete = (data: {
        success: boolean;
        message: string;
        trace_id?: string;
      }) => {
        // Clean up all listeners
        socket.off("scenario_generation_progress", handleProgress);
        socket.off("scenario_generation_complete", handleComplete);
        socket.off("scenario_generation_error", handleError);
        socket.off(
          "scenario_tool_problem_statement_complete",
          handleProblemStatementComplete
        );
        socket.off(
          "scenario_tool_objectives_complete",
          handleObjectivesComplete
        );
        socket.off("scenario_tool_document_complete", handleDocumentComplete);
        socket.off("scenario_tool_image_complete", handleImageComplete);

        if (data.success) {
          // Convert toast to success
          const successMessage = isRegenerating
            ? "Scenario regenerated successfully!"
            : "Scenario generated successfully!";
          toast.success(successMessage, { id: toastId });

          // Fetch problem statement details if we have an ID
          // Note: title and description will need to be fetched separately if needed
          // For now, we'll return empty strings and let the client fetch from the API
          resolve({
            success: true,
            message: data.message,
            title: title,
            description: description,
            objectives: objectives,
            dynamic_document_mapping: dynamicDocumentMapping,
            problem_statement_id: problemStatementId,
            objective_ids: objectiveIds,
            document_ids: documentIds,
            image_ids: imageIds,
          });
        } else {
          // Convert toast to error
          toast.error(data.message || "Scenario generation failed", {
            id: toastId,
          });
          reject(new Error(data.message || "Scenario generation failed"));
        }
      };

      const handleError = (data: {
        success: boolean;
        message: string;
        trace_id?: string;
      }) => {
        // Clean up all listeners
        socket.off("scenario_generation_progress", handleProgress);
        socket.off("scenario_generation_complete", handleComplete);
        socket.off("scenario_generation_error", handleError);
        socket.off(
          "scenario_tool_problem_statement_complete",
          handleProblemStatementComplete
        );
        socket.off(
          "scenario_tool_objectives_complete",
          handleObjectivesComplete
        );
        socket.off("scenario_tool_document_complete", handleDocumentComplete);
        socket.off("scenario_tool_image_complete", handleImageComplete);

        // Convert toast to error
        toast.error(data.message || "Scenario generation failed", {
          id: toastId,
        });
        reject(new Error(data.message || "Scenario generation failed"));
      };

      // Register listeners
      socket.on("scenario_generation_progress", handleProgress);
      socket.on("scenario_generation_complete", handleComplete);
      socket.on("scenario_generation_error", handleError);
      socket.on(
        "scenario_tool_problem_statement_complete",
        handleProblemStatementComplete
      );
      socket.on("scenario_tool_objectives_complete", handleObjectivesComplete);
      socket.on("scenario_tool_document_complete", handleDocumentComplete);
      socket.on("scenario_tool_image_complete", handleImageComplete);

      // eslint-disable-next-line no-console
      console.log(
        "[Scenario] Registered WebSocket event listeners for scenario generation"
      );

      // Emit the event
      // agentId is required - UI filters and selects appropriate agent based on flags
      if (!formData.scenarioAgentId) {
        toast.error("Please select a scenario agent before generating");
        reject(new Error("Scenario agent ID is required"));
        return;
      }

      socket.emit("generate_scenario", {
        departmentId: body.departmentId,
        agentId: formData.scenarioAgentId, // Required: selected agent ID
        personaIds: body.personaIds,
        documentIds: body.documentIds,
        fieldIds: body.fieldIds, // Renamed from parameterItemIds
        profileId: body.profileId,
        scenarioId: scenarioId || undefined, // Pass scenarioId if in edit mode
        objectivesMin: objectiveCount[0] > 0 ? objectiveCount[0] : undefined,
        objectivesMax: objectiveCount[1] > 0 ? objectiveCount[1] : undefined,
      });
    });
  };

  // Wrapper functions for compatibility (matching original mutateAsync signature)
  const createScenario = handleCreateScenario;
  const updateScenario = handleUpdateScenario;

  // Form data state
  const defaultDepartmentIds = useMemo(
    () =>
      getDefaultDepartmentIds(
        isSuperadmin,
        effectiveProfile?.primaryDepartmentId || null
      ),
    [isSuperadmin, effectiveProfile?.primaryDepartmentId]
  );

  // defaultParameterIds removed - not used (empty array means "all parameters")

  const initialFormData = useMemo(
    () => ({
      name: "New Scenario",
      problemStatement: "",
      departmentIds: defaultDepartmentIds,
      active: true,
      scenarioAgentId: null as string | null,
      imageAgentId: null as string | null,
      parameterIds: [] as string[], // Empty means "all parameters"
    }),
    [defaultDepartmentIds]
  );

  const [formData, setFormData] = useState(initialFormData);

  // Track if form data has been initialized from scenarioData to prevent resetting user changes
  const formDataInitializedRef = useRef<boolean>(false);
  // Track last processed randomized_selections to prevent re-processing
  const lastProcessedRandomizedRef = useRef<string | null>(null);
  // Track if we're currently applying randomized selections to skip URL updates
  const isApplyingRandomizedRef = useRef<boolean>(false);

  // Event handler for form input changes (defined early for use in useEffect)
  const handleInputChange = useCallback(
    (field: string, value: string | string[] | boolean | null) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  // Store personaIds separately since it's now in junction table
  const [selectedPersonaIds, setSelectedPersonaIds] = useState<string[]>([]);
  const [personaSearchTerm, setPersonaSearchTerm] = useState<string>("");
  const [documentSearchTerm, setDocumentSearchTerm] = useState<string>("");
  const [parameterSearchTerm, setParameterSearchTerm] = useState<string>("");
  const [previewDocumentId, setPreviewDocumentId] = useState<string | null>(
    null
  );
  // Problem statement ID will come from URL parameters, not stored in state
  // Track local problem statement versions during creation (before scenario is saved)
  const [localProblemStatementVersions, setLocalProblemStatementVersions] =
    useState<
      Array<{
        id: string;
        problem_statement: string;
        created_at: string;
        updated_at: string;
      }>
    >([]);
  const [originalDocumentIds, setOriginalDocumentIds] = useState<string[]>([]);
  const [originalTemplateDocumentIds, setOriginalTemplateDocumentIds] =
    useState<string[]>([]);
  const [originalFieldIds, setOriginalFieldIds] = useState<string[]>([]);
  const [originalObjectives, setOriginalObjectives] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingScenario, setIsGeneratingScenario] = useState(false);
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
  const [showRegenerationDialog, setShowRegenerationDialog] = useState(false);
  const [regenerationInstructions, setRegenerationInstructions] = useState("");
  const [regenerateObjectives, setRegenerateObjectives] = useState(true);
  const [originalFormData, setOriginalFormData] = useState(initialFormData);
  // Documents are always enabled (no switch)
  const useDocuments = true;
  const documentVisionEnabled = false;
  const [useImage, setUseImage] = useState(false);
  // Objective count state: [min, max] - initialized from server or URL params
  const [objectiveCount, setObjectiveCount] = useState<[number, number]>([
    0, 0,
  ]);
  const [draggedObjectiveIndex, setDraggedObjectiveIndex] = useState<
    number | null
  >(null);

  // State for junction data (managed separately from scenario)
  const [currentObjectives, setCurrentObjectives] = useState<string[]>([]);
  const [currentFieldIds, setCurrentFieldIds] = useState<string[]>([]);
  const [currentDocumentIds, setCurrentDocumentIds] = useState<string[]>([]);
  const [currentTemplateDocumentIds, setCurrentTemplateDocumentIds] = useState<
    string[]
  >([]);
  const [scenarioPreviewDocumentId, setScenarioPreviewDocumentId] = useState<
    string | null
  >(null);
  const [currentProblemStatementIds, setCurrentProblemStatementIds] = useState<
    string[]
  >([]);
  const [image, setImage] = useState<{
    id: string;
    name: string;
    upload_id: string;
  } | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Min/max state for randomization (initialized from server-provided allowed_ranges)
  const [personaMinMax, setPersonaMinMax] = useState(() => {
    const ranges = scenarioData?.allowed_ranges;
    return ranges?.persona
      ? { min: ranges.persona.min, max: ranges.persona.max }
      : { min: 1, max: 2 };
  });
  const [documentMinMax, setDocumentMinMax] = useState(() => {
    const ranges = scenarioData?.allowed_ranges;
    return ranges?.document
      ? { min: ranges.document.min, max: ranges.document.max }
      : { min: 0, max: 2 };
  });
  const [parameterSelectionMinMax, setParameterSelectionMinMax] = useState(
    () => {
      const ranges = scenarioData?.allowed_ranges;
      return ranges?.parameter_selection
        ? {
            min: ranges.parameter_selection.min,
            max: ranges.parameter_selection.max,
          }
        : { min: 0, max: 5 };
    }
  );
  const [fieldMinMax, setFieldMinMax] = useState<
    Record<string, { min: number; max: number }>
  >(() => {
    const ranges = scenarioData?.allowed_ranges;
    if (!ranges?.fields) return {};
    // Convert server format to client format
    const result: Record<string, { min: number; max: number }> = {};
    Object.entries(ranges.fields).forEach(([paramId, range]) => {
      result[paramId] = { min: range.min, max: range.max };
    });
    return result;
  });

  // Staged selections per department (preserved when departments are deselected)
  type StagedSelections = {
    persona_ids?: string[];
    document_ids?: string[];
    field_ids?: string[];
  };
  const [_stagedSelections, setStagedSelections] = useState<
    Record<string, StagedSelections>
  >({});
  const [previousDepartmentIds, setPreviousDepartmentIds] = useState<string[]>(
    []
  );

  // Helper function to build search params including filters, search terms, ranges, and randomize param
  const buildSearchParams = useCallback(() => {
    const params = new URLSearchParams();

    // Add filter params (always include if non-empty)
    // Use comma-separated values to match how page.tsx reads them (searchParams.get().split(","))
    if (formData.departmentIds && formData.departmentIds.length > 0) {
      params.set("departmentIds", formData.departmentIds.join(","));
    }
    if (selectedPersonaIds.length > 0) {
      params.set("personaIds", selectedPersonaIds.join(","));
    }
    if (currentDocumentIds.length > 0) {
      params.set("documentIds", currentDocumentIds.join(","));
    }
    if (currentTemplateDocumentIds.length > 0) {
      params.set("templateDocumentIds", currentTemplateDocumentIds.join(","));
    }
    if (formData.parameterIds && formData.parameterIds.length > 0) {
      params.set("parameterIds", formData.parameterIds.join(","));
    }
    if (currentFieldIds.length > 0) {
      // Renamed from currentParameterItemIds
      params.set("fieldIds", currentFieldIds.join(",")); // Renamed from parameterItemIds
    }
    if (currentProblemStatementIds.length > 0) {
      params.set("problemStatementIds", currentProblemStatementIds.join(","));
    }

    // Add search params when non-empty
    if (personaSearchTerm.trim()) {
      params.set("personaSearch", personaSearchTerm);
    }
    if (documentSearchTerm.trim()) {
      params.set("documentSearch", documentSearchTerm);
    }
    if (parameterSearchTerm.trim()) {
      params.set("parameterSearch", parameterSearchTerm);
    }

    // Add range params when different from defaults
    // Persona ranges (default: min=1, max=2)
    if (personaMinMax.min !== 1 || personaMinMax.max !== 2) {
      params.set("personaMin", personaMinMax.min.toString());
      params.set("personaMax", personaMinMax.max.toString());
    }
    // Document ranges (default: min=0, max=2)
    if (documentMinMax.min !== 0 || documentMinMax.max !== 2) {
      params.set("documentMin", documentMinMax.min.toString());
      params.set("documentMax", documentMinMax.max.toString());
    }
    // Parameter selection ranges (default: min=0, max=5)
    if (
      parameterSelectionMinMax.min !== 0 ||
      parameterSelectionMinMax.max !== 5
    ) {
      params.set(
        "parameterSelectionMin",
        parameterSelectionMinMax.min.toString()
      );
      params.set(
        "parameterSelectionMax",
        parameterSelectionMinMax.max.toString()
      );
    }
    // Per-parameter item ranges (default: min=1, max=2 for each)
    // Include ranges for selected parameters, or for all parameters if randomize=all (server needs ranges for randomized params)
    const selectedParamIds = formData.parameterIds || [];
    const isRandomizing = searchParams.get("randomize") === "all";
    Object.entries(fieldMinMax).forEach(([fieldId, range]) => {
      // Include range if:
      // 1. Parameter is selected, OR
      // 2. We're randomizing all (server will randomize parameters and need these ranges)
      // AND range differs from default
      const shouldInclude = isRandomizing || selectedParamIds.includes(fieldId);
      if (shouldInclude && (range.min !== 1 || range.max !== 2)) {
        params.set(`fieldMin_${fieldId}`, range.min.toString());
        params.set(`fieldMax_${fieldId}`, range.max.toString());
      }
    });

    // Note: randomize param is set separately by randomize handlers, not here
    // This function builds the base URL state (filters, searches, ranges)

    return params;
  }, [
    formData.departmentIds,
    selectedPersonaIds,
    currentDocumentIds,
    currentTemplateDocumentIds,
    formData.parameterIds,
    currentFieldIds,
    currentProblemStatementIds,
    personaSearchTerm,
    documentSearchTerm,
    parameterSearchTerm,
    personaMinMax,
    documentMinMax,
    parameterSelectionMinMax,
    fieldMinMax,
    // searchParams is used to check if randomize=all - only used for conditional, won't cause loops
    searchParams,
  ]);

  // Extract mappings from V2 response
  const personaMapping = useMemo(
    () => scenarioData?.persona_mapping || {},
    [scenarioData]
  );
  // Backend now includes selected documents in document_mapping with all necessary fields
  const documentMapping = useMemo((): Record<string, DocumentMappingItem> => {
    return (scenarioData?.document_mapping || {}) as Record<
      string,
      DocumentMappingItem
    >;
  }, [scenarioData]);
  const parameterMapping = useMemo(
    () => scenarioData?.parameter_mapping || {},
    [scenarioData]
  );
  // Backend now includes selected fields in field_mapping with all necessary fields
  const fieldMapping = useMemo(() => {
    return scenarioData?.field_mapping || {};
  }, [scenarioData]);
  const simulationMapping = useMemo(
    () => scenarioData?.simulation_mapping || {},
    [scenarioData]
  );
  // Backend now includes selected departments in department_mapping
  const departmentMapping = useMemo(() => {
    return scenarioData?.department_mapping || {};
  }, [scenarioData]);
  // Extract agent mapping
  const agentMapping = useMemo(() => {
    return scenarioData?.agent_mapping || {};
  }, [scenarioData]);
  // Merge server problem statement mapping with local versions (for create mode)
  // IDs from database are unique, so just merge - local versions override server versions if same ID
  const problemStatementMapping = useMemo(() => {
    const serverMapping = scenarioData?.problem_statement_mapping || {};
    const localMapping: Record<
      string,
      { problem_statement: string; created_at: string; updated_at: string }
    > = {};

    // Convert local versions to ProblemStatementInfo format
    localProblemStatementVersions.forEach((version) => {
      localMapping[version.id] = {
        problem_statement: version.problem_statement,
        created_at: version.created_at,
        updated_at: version.updated_at,
      };
    });

    // Simple merge: server versions + local versions (local takes precedence if same ID)
    return { ...serverMapping, ...localMapping };
  }, [scenarioData?.problem_statement_mapping, localProblemStatementVersions]);
  // Combine currentDocumentIds and currentTemplateDocumentIds for preview
  // Filter out parent documents if their template document exists
  const allPreviewDocumentIds = useMemo(() => {
    const combined = [...currentDocumentIds, ...currentTemplateDocumentIds];
    const templateDocSet = new Set(currentTemplateDocumentIds);
    // Filter out parent documents that have template documents
    const filtered = combined.filter((docId) => {
      const doc = documentMapping[docId];
      // If this document has a parent and the parent's template exists, exclude parent
      if (doc?.parent_document_id) {
        // This is a template document, include it
        return true;
      }
      // Check if this document is a parent that has a template
      const hasTemplate = Array.from(templateDocSet).some((templateId) => {
        const templateDoc = documentMapping[templateId];
        return templateDoc?.parent_document_id === docId;
      });
      // Exclude parent if template exists
      return !hasTemplate;
    });
    return filtered;
  }, [currentDocumentIds, currentTemplateDocumentIds, documentMapping]);

  // Extract image mapping from scenario_images array
  type ImageMappingItem = {
    id: string;
    name: string;
    upload_id?: string;
    file_path?: string;
    mime_type?: string;
    created_at: string;
    updated_at: string;
  };
  const imageMapping = useMemo((): Record<string, ImageMappingItem> => {
    const scenarioImages = (
      scenarioData as ScenarioDetailOut & {
        scenario_images?: Array<{
          id?: string;
          name?: string;
          upload_id?: string;
          file_path?: string;
          mime_type?: string;
          created_at?: string;
          updated_at?: string;
        }>;
      }
    )?.scenario_images;

    if (!scenarioImages || !Array.isArray(scenarioImages)) {
      return {};
    }

    const mapping: Record<string, ImageMappingItem> = {};

    scenarioImages.forEach((img) => {
      const imgTyped = img as {
        id?: string;
        name?: string;
        upload_id?: string;
        file_path?: string;
        mime_type?: string;
        created_at?: string;
        updated_at?: string;
      };
      const imageId = imgTyped.upload_id || imgTyped.id;
      if (imageId) {
        const uploadId = imgTyped.upload_id || imgTyped.id;
        const imageItem: ImageMappingItem = {
          id: imageId,
          name: imgTyped.name || "Untitled Image",
          ...(uploadId ? { upload_id: uploadId } : {}),
          ...(imgTyped.file_path ? { file_path: imgTyped.file_path } : {}),
          ...(imgTyped.mime_type ? { mime_type: imgTyped.mime_type } : {}),
          created_at: imgTyped.created_at || new Date().toISOString(),
          updated_at: imgTyped.updated_at || new Date().toISOString(),
        };
        mapping[imageId] = imageItem;
      }
    });

    return mapping;
  }, [scenarioData]);
  // Filter objectives_history based on selected departments
  const objectivesHistory = useMemo(() => {
    const rawHistory = scenarioData?.objectives_history || [];
    const selectedDeptIds = formData.departmentIds || [];

    // Convert to array of strings for autocomplete
    const objectives: string[] = [];

    // If no departments selected, return all objectives
    if (selectedDeptIds.length === 0) {
      rawHistory.forEach((obj) => {
        if (typeof obj === "string") {
          objectives.push(obj);
        } else if (obj && typeof obj === "object") {
          const objWithDept = obj as {
            objective: string;
            department_ids?: string[];
          };
          if ("objective" in objWithDept) {
            objectives.push(objWithDept.objective);
          }
        }
      });
      return objectives;
    }

    // Filter objectives that:
    // 1. Have department_ids that intersect with selected departments
    // 2. Are cross-department (empty department_ids array)
    rawHistory.forEach((obj) => {
      // Handle both new format (object with department_ids) and legacy format (string)
      if (typeof obj === "string") {
        objectives.push(obj); // Legacy format - include all
      } else if (obj && typeof obj === "object") {
        const objWithDept = obj as {
          objective: string;
          department_ids?: string[];
        };
        if ("objective" in objWithDept) {
          const deptIds = objWithDept.department_ids || [];
          // Include if cross-department (empty) or has intersection with selected departments
          if (
            deptIds.length === 0 ||
            deptIds.some((id: string) => selectedDeptIds.includes(id))
          ) {
            objectives.push(objWithDept.objective);
          }
        }
      }
    });

    return objectives;
  }, [scenarioData?.objectives_history, formData.departmentIds]);

  // Use server-provided filtered valid IDs (replacing client-side filtering)
  // Server now handles all filtering logic based on query parameters
  const validPersonaIds = useMemo(() => {
    return scenarioData?.valid_persona_ids || [];
  }, [scenarioData?.valid_persona_ids]);

  // Use server-provided filtered valid document IDs
  const validDocumentIds = useMemo(() => {
    return scenarioData?.valid_document_ids || [];
  }, [scenarioData?.valid_document_ids]);

  // Use server-provided filtered valid parameter item IDs
  const validParameterItemIds = useMemo(() => {
    // Use server-provided filtered IDs if available, otherwise fall back to mapping keys
    if (scenarioData?.valid_field_ids) {
      return scenarioData.valid_field_ids;
    }
    // Fallback for backward compatibility
    return Object.keys(fieldMapping || {});
  }, [scenarioData?.valid_field_ids, fieldMapping]);

  // Use server-provided filtered valid general parameter item IDs
  const validGeneralParameterItemIds = useMemo(() => {
    // Use server-provided filtered IDs if available, otherwise fall back to validParameterItemIds
    if (scenarioData?.valid_general_field_ids) {
      return scenarioData.valid_general_field_ids;
    }
    // Fallback for backward compatibility
    return validParameterItemIds;
  }, [scenarioData?.valid_general_field_ids, validParameterItemIds]);

  const generalParameterMapping = useMemo(() => {
    // Top parameter selection is the source of truth for section 4
    // Show all selected parameters (or none if empty), regardless of whether they have fields
    // This allows debugging - parameters with 0 fields will still be visible
    const selectedParamIds = formData.parameterIds || [];
    const conditionalParamIds = new Set<string>();

    // Get conditional parameters from currently selected fields
    currentFieldIds.forEach((fieldId) => {
      const field = fieldMapping[fieldId];
      if (field?.conditional_parameter_ids) {
        field.conditional_parameter_ids.forEach((paramId) =>
          conditionalParamIds.add(paramId)
        );
      }
    });

    // If no parameters selected, show no parameters (empty means "none")
    if (selectedParamIds.length === 0) {
      // Only include conditional parameters if any fields are selected
      if (conditionalParamIds.size === 0) {
        return {};
      }
      // Include conditional parameters even if no parameters explicitly selected
      const filtered: typeof parameterMapping = {};
      Object.keys(parameterMapping).forEach((paramId) => {
        if (conditionalParamIds.has(paramId)) {
          const param = parameterMapping[paramId];
          if (param) {
            filtered[paramId] = param;
          }
        }
      });
      return filtered;
    }

    // Parameters are selected - include all selected parameters and conditional ones
    // Include them even if they have 0 fields (for debugging/visibility)
    const filtered: typeof parameterMapping = {};
    Object.keys(parameterMapping).forEach((paramId) => {
      if (
        selectedParamIds.includes(paramId) ||
        conditionalParamIds.has(paramId)
      ) {
        const param = parameterMapping[paramId];
        if (param) {
          filtered[paramId] = param;
        }
      }
    });
    return filtered;
  }, [parameterMapping, formData.parameterIds, currentFieldIds, fieldMapping]);

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
            persona_ids: selectedPersonaIds,
            document_ids: [...currentDocumentIds],
            field_ids: [...currentFieldIds],
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
            if (staged.persona_ids && staged.persona_ids.length > 0) {
              // Restore personas that are still valid
              const validPersonaSet = new Set(validPersonaIds);
              const validPersonas = staged.persona_ids.filter((id) =>
                validPersonaSet.has(id)
              );
              if (validPersonas.length > 0) {
                setSelectedPersonaIds((prevPersonas) => {
                  // Merge staged personas with existing ones, deduplicate
                  const combined = new Set([...prevPersonas, ...validPersonas]);
                  return Array.from(combined);
                });
              }
            }

            // Restore documents if valid
            if (staged.document_ids && staged.document_ids.length > 0) {
              const validDocSet = new Set(validDocumentIds);
              const validDocs = staged.document_ids.filter((id) =>
                validDocSet.has(id)
              );
              if (validDocs.length > 0) {
                setCurrentDocumentIds((prevDocs) => {
                  // Deduplicate when merging staged documents back
                  const combined = new Set([...prevDocs, ...validDocs]);
                  return Array.from(combined);
                });
              }
            }

            // Restore parameter items if valid
            if (staged.field_ids && staged.field_ids.length > 0) {
              const validParamSet = new Set(validParameterItemIds);
              const validParams = staged.field_ids.filter((id) =>
                validParamSet.has(id)
              );
              if (validParams.length > 0) {
                setCurrentFieldIds((prevParams) => {
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
    selectedPersonaIds,
    currentDocumentIds,
    currentFieldIds,
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
    // Clear personas that are no longer valid
    if (selectedPersonaIds.length > 0) {
      const validSet = new Set(validPersonaIds);
      const filtered = selectedPersonaIds.filter((id) => validSet.has(id));
      if (filtered.length !== selectedPersonaIds.length) {
        setSelectedPersonaIds(filtered);
      }
    }
  }, [selectedPersonaIds, validPersonaIds]);

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

  // Initialize/update scenarioPreviewDocumentId when currentDocumentIds changes
  useEffect(() => {
    if (currentDocumentIds.length > 0) {
      // If current preview is not in the selected documents, or no preview is set, select the first one
      const firstDocId = currentDocumentIds[0];
      if (
        !scenarioPreviewDocumentId ||
        (firstDocId && !currentDocumentIds.includes(scenarioPreviewDocumentId))
      ) {
        setScenarioPreviewDocumentId(firstDocId || null);
      }
    } else {
      // No documents selected, clear preview
      setScenarioPreviewDocumentId(null);
    }
  }, [currentDocumentIds, scenarioPreviewDocumentId]);

  // Note: Document/persona parameter syncing removed - parameters are now selected independently
  // Filtering happens automatically via validGeneralParameterItemIds based on selected personas/documents

  useEffect(() => {
    // Clear parameter items that are no longer valid
    if (currentFieldIds.length > 0) {
      const validSet = new Set(validParameterItemIds);
      const filtered = currentFieldIds.filter((id) => validSet.has(id));
      if (filtered.length !== currentFieldIds.length) {
        setCurrentFieldIds(filtered);
      }
    }
  }, [currentFieldIds, validParameterItemIds]);

  // Sync problem statement IDs from URL params (for server-driven updates after router.refresh())
  useEffect(() => {
    const problemStatementIdsFromUrl =
      searchParams.get("problemStatementIds")?.split(",").filter(Boolean) || [];
    // Only update if URL params differ from current state (prevents loops)
    const urlIdsSorted = [...problemStatementIdsFromUrl].sort().join(",");
    const currentIdsSorted = [...currentProblemStatementIds].sort().join(",");
    if (urlIdsSorted !== currentIdsSorted) {
      setCurrentProblemStatementIds(problemStatementIdsFromUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]); // Only depend on searchParams - currentProblemStatementIds comparison prevents loops

  // Handle randomized selections from server response
  useEffect(() => {
    if (scenarioData?.randomized_selections) {
      const randomized = scenarioData.randomized_selections;
      // Create a hash of the randomized selections to detect if we've already processed this
      const randomizedHash = JSON.stringify({
        personaIds: randomized.personaIds,
        documentIds: randomized.documentIds,
        parameterIds: randomized.parameterIds,
        fieldIds: randomized.fieldIds,
      });

      // Skip if we've already processed this exact randomized selection
      if (lastProcessedRandomizedRef.current === randomizedHash) {
        return;
      }

      // Mark that we're applying randomized selections (prevents second useEffect from running)
      isApplyingRandomizedRef.current = true;
      lastProcessedRandomizedRef.current = randomizedHash;

      // Update state only - don't update URL params here (let the second useEffect handle it)
      if (randomized.personaIds) {
        setSelectedPersonaIds(randomized.personaIds);
      }
      if (randomized.documentIds) {
        setCurrentDocumentIds(randomized.documentIds);
      }
      if (randomized.parameterIds) {
        handleInputChange("parameterIds", randomized.parameterIds);
      }
      if (randomized.fieldIds) {
        setCurrentFieldIds(randomized.fieldIds);
      }

      // Clear randomization param immediately, but batch with state updates
      // Use requestAnimationFrame to ensure this happens after React's state updates
      requestAnimationFrame(() => {
        updateUrlParams({
          randomize: null,
        });
        // Reset the flag after clearing params (use another frame to ensure URL update completes)
        requestAnimationFrame(() => {
          isApplyingRandomizedRef.current = false;
        });
      });
    }
  }, [scenarioData?.randomized_selections, updateUrlParams, handleInputChange]);

  // Debounce timeout ref for URL updates
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // Track last params string to prevent duplicate updates
  const lastParamsStringRef = useRef<string>("");

  // Helper to normalize URLSearchParams for comparison (sort keys and values)
  const normalizeParamsString = (params: URLSearchParams): string => {
    const sorted = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join("&");
    return sorted;
  };

  // Update URL params when selections change (for server-driven filtering)
  // Follows analytics pattern: Form state → URL → router.refresh() → Server re-fetch → Filtered data
  // Server already parses URL params and returns filtered data, so no need for URL → Form sync
  useEffect(() => {
    // Skip URL updates if we're currently applying randomized selections
    // This prevents infinite loops when randomized selections trigger state updates
    if (isApplyingRandomizedRef.current) {
      return;
    }

    // Clear existing timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // Debounce URL updates (100ms, like analytics)
    debounceTimeoutRef.current = setTimeout(() => {
      const newParams = buildSearchParams();
      const newParamsString = normalizeParamsString(newParams);
      const currentParamsString = normalizeParamsString(searchParams);

      // Only update URL if params actually changed (prevents unnecessary updates and loops)
      if (
        newParamsString !== currentParamsString &&
        newParamsString !== lastParamsStringRef.current
      ) {
        lastParamsStringRef.current = newParamsString;
        router.replace(`${pathname}?${newParams.toString()}`, {
          scroll: false,
        });
        // Force server components to re-render with updated search params (like analytics)
        router.refresh();
      }
    }, 100);

    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
    // Remove buildSearchParams from dependencies - it's already covered by its own dependencies
    // Remove searchParams and router from dependencies to prevent loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    formData.departmentIds,
    selectedPersonaIds,
    currentDocumentIds,
    currentTemplateDocumentIds,
    formData.parameterIds,
    currentFieldIds, // Renamed from currentParameterItemIds
    currentProblemStatementIds,
    personaSearchTerm,
    documentSearchTerm,
    parameterSearchTerm,
    personaMinMax,
    documentMinMax,
    parameterSelectionMinMax,
    fieldMinMax,
    pathname,
  ]);

  // Load scenario data from V2 response
  useEffect(() => {
    if (scenarioData && isEditMode && !formDataInitializedRef.current) {
      // Edit mode: load existing scenario data (only once)
      const deptIds = scenarioData.department_ids || [];
      setFormData({
        name: scenarioData.name,
        problemStatement: scenarioData.problem_statement,
        departmentIds: deptIds,
        active: scenarioData.active ?? true,
        scenarioAgentId: scenarioData.scenario_agent_id || null,
        imageAgentId: scenarioData.image_agent_id || null,
        parameterIds: scenarioData.scenario_parameter_ids || [],
      });
      // Initialize previousDepartmentIds when loading scenario data
      if (previousDepartmentIds.length === 0 && deptIds.length > 0) {
        setPreviousDepartmentIds(deptIds);
      }
      setSelectedPersonaIds(scenarioData.persona_ids || []);
      // Clear local versions when loading existing scenario (edit mode)
      setLocalProblemStatementVersions([]);
      setCurrentDocumentIds(scenarioData.document_ids);
      // Extract template document IDs from document_mapping (documents with parent_document_id)
      const templateDocIds = Object.entries(scenarioData.document_mapping || {})
        .filter(
          ([_, doc]) =>
            doc &&
            typeof doc === "object" &&
            "parent_document_id" in doc &&
            doc.parent_document_id
        )
        .map(([docId]) => docId);
      setCurrentTemplateDocumentIds(templateDocIds);
      setCurrentFieldIds(getFieldIdsFromStructure(scenarioData.parameters));
      setCurrentObjectives(
        getObjectivesFromMapping(
          scenarioData.objective_ids,
          (scenarioData.objective_mapping || {}) as Record<
            string,
            { name: string }
          >
        )
      );
      // Load scenario flags from server data
      const scenarioDataWithFlags = scenarioData as ScenarioDetailOut & {
        documents_enabled?: boolean;
        use_documents?: boolean; // Backward compatibility
        document_vision_enabled?: boolean;
        objectives_enabled?: boolean;
        image_enabled?: boolean;
        scenario_images?: Array<{
          id?: string;
          name?: string;
          upload_id?: string;
        }>;
      };
      // Documents are always enabled (no switch)
      // Initialize objective count from server data or default to [0, 0]
      if (scenarioDataWithFlags?.objective_count_range) {
        setObjectiveCount([
          scenarioDataWithFlags.objective_count_range.min || 0,
          scenarioDataWithFlags.objective_count_range.max || 0,
        ]);
      }
      // Load image_enabled and scenario image (single image - take first if exists)
      const imageEnabled = scenarioDataWithFlags.image_enabled ?? false;
      setUseImage(imageEnabled);
      const scenarioImages = scenarioDataWithFlags.scenario_images;
      if (
        imageEnabled &&
        scenarioImages &&
        Array.isArray(scenarioImages) &&
        scenarioImages.length > 0
      ) {
        const firstImage = scenarioImages[0] as {
          id?: string;
          name?: string;
          upload_id?: string;
        };
        const uploadId = firstImage.upload_id || firstImage.id;
        if (uploadId) {
          setImage({
            id: uploadId, // Use upload_id as id
            name: firstImage.name || "",
            upload_id: uploadId,
          });
        } else {
          setImage(null);
        }
      } else {
        setImage(null);
      }
      // Store originals for change tracking
      setOriginalFormData({
        name: scenarioData.name,
        problemStatement: scenarioData.problem_statement,
        departmentIds: scenarioData.department_ids || [],
        active: scenarioData.active ?? true,
        scenarioAgentId: scenarioData.scenario_agent_id || null,
        imageAgentId: scenarioData.image_agent_id || null,
        parameterIds: scenarioData.scenario_parameter_ids || [],
      });
      setOriginalDocumentIds(scenarioData.document_ids);
      // Extract template document IDs from document_mapping for original tracking
      const originalTemplateDocIds = Object.entries(
        scenarioData.document_mapping || {}
      )
        .filter(
          ([_, doc]) =>
            doc &&
            typeof doc === "object" &&
            "parent_document_id" in doc &&
            doc.parent_document_id
        )
        .map(([docId]) => docId);
      setOriginalTemplateDocumentIds(originalTemplateDocIds);
      setOriginalFieldIds(getFieldIdsFromStructure(scenarioData.parameters));
      setOriginalObjectives(
        getObjectivesFromMapping(
          scenarioData.objective_ids,
          (scenarioData.objective_mapping || {}) as Record<
            string,
            { name: string }
          >
        )
      );
      formDataInitializedRef.current = true;
    } else if (!isEditMode && scenarioData && !formDataInitializedRef.current) {
      // Create mode: initialize from server response (server-driven approach)
      // Server already parsed URL params and returns selected IDs, search terms, ranges
      const newData = scenarioData as ScenarioNewOut;
      setFormData({
        ...initialFormData,
        scenarioAgentId: scenarioData.scenario_agent_id || null,
        imageAgentId: scenarioData.image_agent_id || null,
        parameterIds: newData.selected_parameter_ids || [],
      });

      // Initialize selections from server response (filtered to valid IDs)
      if (newData.selected_persona_ids) {
        setSelectedPersonaIds(newData.selected_persona_ids);
      }
      if (newData.selected_document_ids) {
        setCurrentDocumentIds(newData.selected_document_ids);
      }
      if (newData.selected_template_document_ids) {
        setCurrentTemplateDocumentIds(newData.selected_template_document_ids);
      }
      if (newData.selected_field_ids) {
        setCurrentFieldIds(newData.selected_field_ids);
      }

      // Initialize problem statement IDs from URL params (server doesn't return selected_problem_statement_ids)
      const problemStatementIdsFromUrl = searchParams
        .get("problemStatementIds")
        ?.split(",")
        .filter(Boolean);
      if (problemStatementIdsFromUrl && problemStatementIdsFromUrl.length > 0) {
        setCurrentProblemStatementIds(problemStatementIdsFromUrl);
      }

      // Initialize template document IDs from URL params
      const templateDocumentIdsFromUrl = searchParams
        .get("templateDocumentIds")
        ?.split(",")
        .filter(Boolean);
      if (templateDocumentIdsFromUrl && templateDocumentIdsFromUrl.length > 0) {
        setCurrentTemplateDocumentIds(templateDocumentIdsFromUrl);
      }

      // Initialize search terms from server response
      if (newData.persona_search) {
        setPersonaSearchTerm(newData.persona_search);
      }
      if (newData.document_search) {
        setDocumentSearchTerm(newData.document_search);
      }
      if (newData.parameter_search) {
        setParameterSearchTerm(newData.parameter_search);
      }

      // Initialize range values from server response
      if (
        newData.persona_min !== undefined ||
        newData.persona_max !== undefined
      ) {
        setPersonaMinMax({
          min: newData.persona_min ?? 1,
          max: newData.persona_max ?? 2,
        });
      }
      if (
        newData.document_min !== undefined ||
        newData.document_max !== undefined
      ) {
        setDocumentMinMax({
          min: newData.document_min ?? 0,
          max: newData.document_max ?? 2,
        });
      }
      if (
        newData.parameter_selection_min !== undefined ||
        newData.parameter_selection_max !== undefined
      ) {
        setParameterSelectionMinMax({
          min: newData.parameter_selection_min ?? 0,
          max: newData.parameter_selection_max ?? 5,
        });
      }

      // Initialize per-parameter item ranges from server response
      if (newData.field_ranges) {
        setFieldMinMax(
          newData.field_ranges as Record<string, { min: number; max: number }>
        );
      }

      formDataInitializedRef.current = true;
    }
  }, [
    scenarioData,
    isEditMode,
    previousDepartmentIds.length,
    effectiveProfile?.primaryDepartmentId,
    initialFormData,
    searchParams,
  ]);

  // Problem statement ID is now managed via URL parameters, not state

  // Helper function to compute scenario agent role from flags
  const getScenarioAgentRole = useCallback(
    (
      imageEnabled: boolean,
      objectivesEnabled: boolean,
      documentsEnabled: boolean
    ): string => {
      // Determine agent role based on flag combinations (matches SQL function logic)
      if (imageEnabled && objectivesEnabled && documentsEnabled) {
        return "scenario-image-objectives-templates";
      } else if (imageEnabled && objectivesEnabled) {
        return "scenario-image-objectives";
      } else if (imageEnabled && documentsEnabled) {
        return "scenario-image-templates";
      } else if (objectivesEnabled && documentsEnabled) {
        return "scenario-objectives-templates";
      } else if (imageEnabled) {
        return "scenario-image";
      } else if (objectivesEnabled) {
        return "scenario-objectives";
      } else if (documentsEnabled) {
        return "scenario-templates";
      } else {
        return "scenario"; // Base scenario (no special features)
      }
    },
    []
  );

  // Compute expected agent role from current flags
  const expectedScenarioRole = useMemo(() => {
    const documentsEnabled = currentDocumentIds.length > 0;
    return getScenarioAgentRole(
      useImage,
      objectiveCount[1] > 0,
      documentsEnabled
    );
  }, [useImage, objectiveCount, currentDocumentIds, getScenarioAgentRole]);

  // Reset initialization flag when switching between edit/create modes or scenario changes
  useEffect(() => {
    formDataInitializedRef.current = false;
  }, [scenarioId, isEditMode]);

  // Reset agent selection when flags change to incompatible combination
  useEffect(() => {
    if (!scenarioData || !agentMapping || !formData.scenarioAgentId) return;

    const agent = agentMapping[formData.scenarioAgentId];
    const agentRole = agent?.roles?.[0]; // Get first role (should be only one)

    // If current agent doesn't match expected role, clear selection
    if (
      agentRole &&
      agentRole !== expectedScenarioRole &&
      agentRole !== "scenario"
    ) {
      // Only clear if it's not the legacy 'scenario' role (backward compatibility)
      setFormData((prev) => ({
        ...prev,
        scenarioAgentId: null,
      }));
    }
  }, [
    expectedScenarioRole,
    scenarioData,
    agentMapping,
    formData.scenarioAgentId,
  ]);

  // Auto-select agents when there's only one option (similar to Document.tsx)
  useEffect(() => {
    if (!scenarioData || !agentMapping) return;

    const scenarioAgentIds =
      scenarioData.valid_agent_ids?.filter((id) => {
        const agent = agentMapping[id];
        const agentRole = agent?.roles?.[0];
        // Filter by expected role OR legacy 'scenario' role (backward compatibility)
        return agentRole === expectedScenarioRole || agentRole === "scenario";
      }) || [];

    const imageAgentIds =
      scenarioData.valid_agent_ids?.filter((id) => {
        const agent = agentMapping[id];
        return agent?.roles?.includes("image");
      }) || [];

    // Auto-select first scenario agent if only one option and not already set
    if (scenarioAgentIds.length === 1 && !formData.scenarioAgentId) {
      setFormData((prev) => ({
        ...prev,
        scenarioAgentId: scenarioAgentIds[0] || null,
      }));
    }

    // Auto-select first image agent if only one option and not already set
    if (imageAgentIds.length === 1 && !formData.imageAgentId) {
      setFormData((prev) => ({
        ...prev,
        imageAgentId: imageAgentIds[0] || null,
      }));
    }
  }, [
    scenarioData,
    agentMapping,
    formData.scenarioAgentId,
    formData.imageAgentId,
    expectedScenarioRole,
  ]);

  // Check if form has changes
  const hasChanges = useMemo(() => {
    if (!isEditMode) return false;

    const current = formData;
    const original = originalFormData;
    const originalPersonaIds = scenarioData?.persona_ids || [];

    return (
      JSON.stringify(selectedPersonaIds.sort()) !==
        JSON.stringify(originalPersonaIds.sort()) ||
      current.name !== original.name ||
      current.problemStatement !== original.problemStatement ||
      current.active !== original.active ||
      JSON.stringify(current.departmentIds?.sort()) !==
        JSON.stringify(original.departmentIds?.sort()) ||
      JSON.stringify([...currentDocumentIds].sort()) !==
        JSON.stringify([...(originalDocumentIds || [])].sort()) ||
      JSON.stringify([...currentTemplateDocumentIds].sort()) !==
        JSON.stringify([...(originalTemplateDocumentIds || [])].sort()) ||
      JSON.stringify([...currentFieldIds].sort()) !==
        JSON.stringify([...(originalFieldIds || [])].sort()) ||
      JSON.stringify(currentObjectives) !==
        JSON.stringify(originalObjectives || [])
    );
  }, [
    formData,
    originalFormData,
    isEditMode,
    selectedPersonaIds,
    scenarioData,
    currentDocumentIds,
    originalDocumentIds,
    currentTemplateDocumentIds,
    originalTemplateDocumentIds,
    currentFieldIds, // Renamed from currentParameterItemIds
    originalFieldIds, // Renamed from originalParameterItemIds
    currentObjectives,
    originalObjectives,
  ]);

  // Check if problem statement has changes (for reset button)
  const hasProblemStatementChanges = useMemo(() => {
    if (!isEditMode) return false;
    const current = formData?.problemStatement || "";
    const original = originalFormData?.problemStatement || "";
    return current !== original;
  }, [
    isEditMode,
    formData?.problemStatement,
    originalFormData?.problemStatement,
  ]);

  // Use server-computed readonly flag from V2 API
  const isReadonly = useMemo(() => {
    if (!isEditMode || !scenarioData) return false;
    return !scenarioData.can_edit;
  }, [isEditMode, scenarioData]);

  // Get affected simulations from V2 data
  const affectedSimulations = useMemo(() => {
    if (!scenarioData?.active_simulation_ids) return [];
    return scenarioData.active_simulation_ids.map((id) => {
      const sim = simulationMapping[id] as { name?: string } | undefined;
      return {
        id,
        name: sim?.name || "",
        active: true, // These are active simulations from server
      };
    });
  }, [scenarioData, simulationMapping]);

  // Calculate step status
  const getStepStatus = useCallback(
    (stepId: string): StepStatus => {
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
          return selectedPersonaIds.length > 0 ? "completed" : "active";
        case "documents":
          return selectedPersonaIds.length === 0
            ? "pending"
            : currentDocumentIds.length > 0
              ? "completed"
              : "active";
        case "parameters":
          return selectedPersonaIds.length === 0
            ? "pending"
            : (formData.parameterIds || []).length > 0
              ? "completed"
              : "active";
        case "content":
          return selectedPersonaIds.length === 0 ? "pending" : "active"; // Always active once personas are selected, user can choose to fill or leave blank
        default:
          // Handle individual parameter steps (parameter-{paramId})
          if (stepId.startsWith("parameter-")) {
            const paramId = stepId.replace("parameter-", "");
            const paramItems = currentFieldIds.filter(
              (itemId) => fieldMapping[itemId]?.parameter_id === paramId
            );
            return selectedPersonaIds.length === 0
              ? "pending"
              : paramItems.length > 0
                ? "completed"
                : "active";
          }
          return "pending";
      }
    },
    [
      selectedPersonaIds,
      currentDocumentIds,
      currentFieldIds, // Renamed from currentParameterItemIds
      fieldMapping, // Renamed from parameterItemMapping
      formData.problemStatement,
      formData.parameterIds,
    ]
  );

  // Update min/max ranges from server-provided allowed_ranges
  useEffect(() => {
    const ranges = scenarioData?.allowed_ranges;
    if (ranges) {
      if (ranges.persona) {
        setPersonaMinMax({ min: ranges.persona.min, max: ranges.persona.max });
      }
      if (ranges.document) {
        setDocumentMinMax({
          min: ranges.document.min,
          max: ranges.document.max,
        });
      }
      if (ranges.parameter_selection) {
        setParameterSelectionMinMax({
          min: ranges.parameter_selection.min,
          max: ranges.parameter_selection.max,
        });
      }
      if (ranges.fields) {
        // Convert server format to client format
        const converted: Record<string, { min: number; max: number }> = {};
        Object.entries(ranges.fields).forEach(([fieldId, range]) => {
          converted[fieldId] = { min: range.min, max: range.max };
        });
        setFieldMinMax(converted);
      }
    }
  }, [scenarioData?.allowed_ranges]);

  // Dynamic steps array based on available parameters
  const steps: Step[] = useMemo(() => {
    const baseSteps: Step[] = [
      {
        id: "basic",
        title: "",
        description: "",
        status: getStepStatus("basic"),
      },
      {
        id: "persona",
        title: "Personas",
        description:
          "Define the personality, background, or behavior of the participants in the scenario.",
        status: getStepStatus("persona"),
      },
      {
        id: "documents",
        title: "Documents",
        description:
          "Select key documents or reference materials to ground scenario responses.",
        status: getStepStatus("documents"),
        optional: true,
      },
      {
        id: "parameters",
        title: "Parameters",
        description: "Select which parameters to include in the scenario.",
        status: getStepStatus("parameters"),
      },
    ];

    // Add individual parameter steps
    const parameterSteps: Step[] = Object.entries(generalParameterMapping).map(
      ([paramId, param]) => ({
        id: `parameter-${paramId}`,
        title: param.name,
        description: param.description || "",
        status: getStepStatus(`parameter-${paramId}`),
      })
    );

    const contentStep: Step = {
      id: "content",
      title: "Scenario",
      description:
        "This is what the TA will see when they enter the scenario. Leave blank for auto-generation.",
      status: getStepStatus("content"),
    };

    return [...baseSteps, ...parameterSteps, contentStep];
  }, [generalParameterMapping, getStepStatus]);

  // Parameter actions - Server-side randomization per parameter
  const handleRandomizeParameterClient = (paramId: string) => {
    // Clear existing parameter item selections for this parameter
    const filteredFieldIds = currentFieldIds.filter(
      (itemId) => fieldMapping[itemId]?.parameter_id !== paramId
    );
    // Update URL with cleared selections and randomize param
    updateUrlParams({
      fieldIds: filteredFieldIds.length > 0 ? filteredFieldIds : null,
      randomize: `parameter_${paramId}`,
    });
    // Update local state
    setCurrentFieldIds(filteredFieldIds);
    // Trigger page refresh to get randomized results from server
    router.refresh();
  };

  const handleResetParameter = (paramId: string) => {
    try {
      // Remove this parameter's items from URL params
      const currentParamItems = currentFieldIds.filter(
        (itemId) => fieldMapping[itemId]?.parameter_id !== paramId
      );
      updateUrlParams({
        fieldIds: currentParamItems.length > 0 ? currentParamItems : null,
        randomize: null,
      });
      // Update local state
      setCurrentFieldIds(currentParamItems);
      router.refresh();
      toast.success(
        `${generalParameterMapping[paramId]?.name || "Parameter"} reset`
      );
    } catch {
      toast.error("Failed to reset parameter");
    }
  };

  // Persona actions - Server-side randomization
  const handleRandomizePersonaClient = () => {
    // Clear existing persona selections
    updateUrlParams({
      personaIds: null,
      randomize: "persona",
    });
    setSelectedPersonaIds([]);
    // Trigger page refresh to get randomized results from server
    router.refresh();
  };

  const handleResetPersona = () => {
    try {
      updateUrlParams({
        personaIds: null,
        personaSearch: null,
        randomize: null,
      });
      setSelectedPersonaIds([]);
      router.refresh();
      toast.success("Persona reset");
    } catch {
      toast.error("Failed to reset persona");
    }
  };

  // Documents actions - Server-side randomization
  const handleRandomizeDocumentsClient = () => {
    // Clear existing document selections
    updateUrlParams({
      documentIds: null,
      randomize: "document",
    });
    setCurrentDocumentIds([]);
    // Trigger page refresh to get randomized results from server
    router.refresh();
  };

  const handleResetDocuments = () => {
    try {
      updateUrlParams({
        documentIds: null,
        documentSearch: null,
        randomize: null,
      });
      setCurrentDocumentIds([]);
      router.refresh();
      toast.success("Documents reset");
    } catch {
      toast.error("Failed to reset documents");
    }
  };

  // Parameters actions - Server-side randomization
  const handleRandomizeParametersClient = () => {
    // Clear existing parameter selections
    updateUrlParams({
      parameterIds: null,
      randomize: "parameters",
    });
    handleInputChange("parameterIds", []);
    // Trigger page refresh to get randomized results from server
    router.refresh();
  };

  const handleResetParameters = () => {
    try {
      updateUrlParams({
        parameterIds: null,
        parameterSearch: null,
        randomize: null,
      });
      handleInputChange("parameterIds", []);
      router.refresh();
      toast.success("Parameters reset");
    } catch {
      toast.error("Failed to reset parameters");
    }
  };

  // Helper functions removed - filtering now handled by server

  // Randomize all: personas, documents, and all parameters (server-side via URL params)
  const handleRandomizeAll = () => {
    try {
      // Clear existing selection params BEFORE adding randomization params
      // This ensures randomization happens from the full filtered set, not from pre-selected items
      const clearParams: Record<string, string | null> = {
        personaIds: null,
        documentIds: null,
        parameterIds: null,
        fieldIds: null,
      };

      // Set randomize=all and keep range params (min/max values)
      const randomizeParams: Record<string, string> = {
        randomize: "all",
      };

      // Update URL with cleared selections and randomization param
      updateUrlParams({ ...clearParams, ...randomizeParams });

      // Trigger page refresh to get randomized results from server
      router.refresh();
    } catch {
      toast.error("Failed to randomize all selections");
    }
  };

  // Reset all: personas, documents, and all parameters (clear URL params)
  const handleResetAll = () => {
    try {
      // Clear all selection and randomization params from URL - server will return unfiltered/default valid IDs
      updateUrlParams({
        departmentIds: null,
        personaIds: null,
        documentIds: null,
        parameterIds: null,
        fieldIds: null,
        personaSearch: null,
        documentSearch: null,
        parameterSearch: null,
        randomize: null,
      });
      // Also reset local state
      setSelectedPersonaIds([]);
      setCurrentDocumentIds([]);
      setCurrentFieldIds([]);
      handleInputChange("parameterIds", []);
      // Trigger page refresh to get reset results from server
      router.refresh();
      toast.success("All selections reset");
    } catch {
      toast.error("Failed to reset all selections");
    }
  };

  const handleResetContent = () => {
    try {
      // Clear problem statement and turn off objectives
      setFormData((prev) => ({
        ...prev,
        problemStatement: "",
      }));
      // Clear objectives array
      setCurrentObjectives([]);
      // Clear selected problem statement ID
      toast.success("Scenario content reset");
    } catch {
      toast.error("Failed to reset content");
    }
  };

  const handleProblemStatementVersionSelect = (id: string) => {
    if (id && problemStatementMapping[id]) {
      handleInputChange(
        "problemStatement",
        problemStatementMapping[id].problem_statement
      );
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

  const handleDragStartObjective = (e: React.DragEvent, index: number) => {
    setDraggedObjectiveIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDropObjective = (e: React.DragEvent, targetIndex: number) => {
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

  const handleImageSelect = (
    image: {
      id: string;
      name: string;
      upload_id: string;
    } | null
  ) => {
    setImage(image);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    setIsUploadingImage(true);
    const toastId = toast.loading(`Uploading image: ${file.name}`, {
      description: "0% complete",
      dismissible: true,
    });

    try {
      // Generate a unique fileId for tracking
      const fileId = `${Date.now()}-${Math.random().toString(36).substring(7)}`;

      let tusUploadInstance: tus.Upload | null = null;
      // Create TUS upload
      tusUploadInstance = new tus.Upload(file, {
        endpoint: `/api/uploads/upload`,
        retryDelays: [0, 3000, 5000, 10000, 20000],
        metadata: {
          filename: file.name,
          filetype: file.type,
          fileId: fileId,
        },
        onError: (error) => {
          toast.error(`Upload failed: ${file.name}`, {
            description: error.message || "An error occurred during upload",
            id: toastId,
          });
          setIsUploadingImage(false);
        },
        onProgress: (bytesUploaded, bytesTotal) => {
          const percentage = Math.round((bytesUploaded / bytesTotal) * 100);
          toast.loading(`Uploading image: ${file.name}`, {
            description: `${percentage}% complete`,
            id: toastId,
          });
        },
        onSuccess: async () => {
          // Extract TUS upload_id from upload URL
          const uploadUrl = tusUploadInstance?.url || "";
          const tusUploadIdMatch = uploadUrl.match(/\/upload\/([^\/]+)/);
          if (!tusUploadIdMatch || !tusUploadIdMatch[1]) {
            toast.error("Failed to extract upload ID from upload URL", {
              id: toastId,
            });
            setIsUploadingImage(false);
            return;
          }
          const tusUploadId = tusUploadIdMatch[1];

          // Finalize upload to get database upload_id
          try {
            const finalizeResponse = await fetch(
              `/api/uploads/upload/${tusUploadId}/finalize`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({}),
              }
            );

            const finalizeResult = await finalizeResponse.json();

            if (!finalizeResult.success || !finalizeResult.uploadId) {
              throw new Error(
                finalizeResult.message || "Failed to finalize upload"
              );
            }

            const databaseUploadId = finalizeResult.uploadId;

            // Store upload_id directly (no image creation needed)
            // Image will be linked to scenario when form is submitted
            setImage({
              id: databaseUploadId, // Use upload_id as id
              name: file.name,
              upload_id: databaseUploadId,
            });
            toast.success(`Image uploaded: ${file.name}`, { id: toastId });
          } catch (finalizeError) {
            toast.error(
              `Failed to finalize upload: ${
                finalizeError instanceof Error
                  ? finalizeError.message
                  : "Unknown error"
              }`,
              { id: toastId }
            );
          } finally {
            setIsUploadingImage(false);
          }
        },
      });

      tusUploadInstance.start();
    } catch (error) {
      toast.error(
        `Failed to upload image: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        {
          id: toastId,
        }
      );
      setIsUploadingImage(false);
    }

    // Reset input
    e.target.value = "";
  };

  const handleGenerateScenario = async (
    userInstructions?: string,
    _shouldRegenerateObjectives?: boolean
  ) => {
    setIsGeneratingScenario(true);

    try {
      // Get department ID from first valid department
      const departmentId = effectiveProfile?.primaryDepartmentId || "";
      if (!departmentId) {
        throw new Error("No valid department found");
      }

      const result = await handleGenerateAIScenario({
        departmentId,
        personaIds: selectedPersonaIds.length > 0 ? selectedPersonaIds : null,
        documentIds: currentDocumentIds.length > 0 ? currentDocumentIds : null,
        fieldIds: currentFieldIds.length > 0 ? currentFieldIds : null,
        profileId: effectiveProfile?.id || null,
        userInstructions: userInstructions || null,
        objectivesEnabled: true, // Always enabled - controlled by simulation page
      });

      if (!result.success) {
        throw new Error(result.message || "Failed to generate scenario");
      }

      // Handle generated IDs from tool completion events
      // Note: Document IDs are already updated in real-time via handleDocumentComplete
      // This is just for showing success message
      if (result.document_ids && result.document_ids.length > 0) {
        toast.success(
          `Created ${result.document_ids.length} dynamic document(s)`
        );
      }

      if (result.objective_ids && result.objective_ids.length > 0) {
        // Objectives will be loaded from the API when scenario detail is fetched
        // For now, we just note that they were created
        toast.success(`Created ${result.objective_ids.length} objective(s)`);
      }

      if (result.image_ids && result.image_ids.length > 0) {
        // Images will be loaded from the API when scenario detail is fetched
        toast.success(`Created ${result.image_ids.length} image(s)`);
      }

      // If we have a problem statement ID, we'll need to fetch it from the API
      // For now, we'll trigger a refresh of the scenario data if in edit mode
      if (result.problem_statement_id && isEditMode) {
        // In edit mode, refresh scenario data to get the new problem statement
        // This will be handled by the parent component refreshing the data
        toast.success("Problem statement created successfully");
      } else if (result.problem_statement_id && !isEditMode) {
        // In create mode, we'll store the ID for later linking
        // The problem statement will be linked when the scenario is saved
        toast.success("Problem statement created successfully");
      }

      // Note: title and description are no longer in the completion event
      // They will be fetched from the API when the scenario detail is loaded
      // If in edit mode, refresh scenario data to get the newly generated content
      if (isEditMode && scenarioId) {
        // Trigger a refetch of scenario data to get the new problem statement, objectives, etc.
        // This will be handled by the parent component or query invalidation
      }
    } catch (error) {
      // Error toast is already handled in handleGenerateAIScenario for WebSocket errors
      // Only show toast for errors that occur BEFORE calling handleGenerateAIScenario
      // (e.g., validation errors, connection errors before WebSocket call)
      if (error instanceof Error) {
        // Pre-WebSocket errors that should show a toast:
        const preWebSocketErrors = [
          "WebSocket not connected",
          "No valid department found",
          "No scenario content was generated",
        ];
        const isPreWebSocketError = preWebSocketErrors.some((msg) =>
          error.message.includes(msg)
        );
        // All other errors come from handleGenerateAIScenario and already have toasts
        if (isPreWebSocketError) {
          toast.error(
            `Failed to generate scenario: ${error.message || "Unknown error"}`
          );
        }
      }
    } finally {
      setIsGeneratingScenario(false);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);

    try {
      // Transform department IDs for submit (non-superadmin: empty -> all valid departments)
      const finalDepartmentIds = transformDepartmentIdsForSubmit(
        formData.departmentIds || [],
        isSuperadmin,
        scenarioData?.valid_department_ids || []
      );

      // Prepare payload for V2 API
      const parametersDict = groupFieldsByParameterId(
        currentFieldIds, // Renamed from currentParameterItemIds
        fieldMapping // Renamed from parameterItemMapping
      );
      const payload: {
        name: string;
        problem_statement: string;
        problem_statement_versions?: string[];
        department_ids: string[] | null;
        active: boolean;
        persona_ids: string[] | null;
        document_ids: string[];
        template_document_ids?: string[] | null;
        objective_ids: string[];
        upload_ids: string[] | null;
        image_names: string[] | null;
        parameters: Record<string, string[]>;
        parameter_ids?: string[] | null;
        scenario_agent_id?: string | null;
        image_agent_id?: string | null;
      } = {
        name: formData.name?.trim() || "",
        problem_statement: formData.problemStatement?.trim() || "",
        department_ids: finalDepartmentIds,
        active: formData.active ?? true,
        persona_ids: selectedPersonaIds.length > 0 ? selectedPersonaIds : null,
        document_ids: currentDocumentIds,
        template_document_ids:
          currentTemplateDocumentIds.length > 0
            ? currentTemplateDocumentIds
            : null,
        objective_ids: currentObjectives.filter((obj) => obj.trim()), // Send raw objective text
        upload_ids: image?.upload_id ? [image.upload_id] : null,
        image_names: image?.name ? [image.name] : null,
        parameters: parametersDict,
        scenario_agent_id: formData.scenarioAgentId || null,
        image_agent_id: formData.imageAgentId || null,
      };

      // Include problem_statement_versions if in create mode and we have local versions
      if (!isEditMode && localProblemStatementVersions.length > 0) {
        const versions = localProblemStatementVersions.map(
          (v) => v.problem_statement
        );
        // Ensure current problem statement is included as the last version (most recent)
        const currentProblemStatement = formData.problemStatement?.trim() || "";
        if (
          currentProblemStatement &&
          !versions.includes(currentProblemStatement)
        ) {
          versions.push(currentProblemStatement);
        }
        payload.problem_statement_versions = versions;
      }

      if (isEditMode) {
        // UPDATE mode - V2 handles all junction tables automatically
        try {
          await updateScenario({
            scenarioId: scenarioId!,
            ...payload,
            documents_enabled: useDocuments,
            document_vision_enabled: documentVisionEnabled,
            objectives_enabled: objectiveCount[1] > 0,
            image_enabled: useImage,
          });
          toast.success("Scenario updated successfully!");
          router.push("/create/scenarios");
        } catch (error) {
          toast.error(
            `Failed to update scenario: ${error instanceof Error ? error.message : "Unknown error"}`
          );
          setIsSubmitting(false);
        }
      } else {
        // CREATE mode - V2 handles all junction tables automatically
        try {
          await createScenario({
            ...payload,
            documents_enabled: useDocuments,
            document_vision_enabled: documentVisionEnabled,
            objectives_enabled: objectiveCount[1] > 0,
            image_enabled: useImage,
          });
          // Clear local versions after successful creation
          setLocalProblemStatementVersions([]);
          toast.success("Scenario created successfully!");
          router.push("/create/scenarios");
        } catch (error) {
          toast.error(
            `Failed to create scenario: ${error instanceof Error ? error.message : "Unknown error"}`
          );
          setIsSubmitting(false);
        }
      }
    } catch (error) {
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

  // Handler for PersonaPicker multi-select
  const handlePersonaSelect = (ids: string[]) => {
    setSelectedPersonaIds(ids);
  };

  return (
    <div className="w-full p-6 space-y-8">
      {isReadonly && (
        <div className="bg-muted border border-border rounded-lg p-4 mb-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-muted-foreground"
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
              <h3 className="text-sm font-medium text-foreground">
                {scenarioData?.generated
                  ? "Generated scenario cannot be edited"
                  : scenarioData?.department_ids?.length === 0
                    ? "Default scenario cannot be edited"
                    : "Scenario is in use by active simulations"}
              </h3>
              <div className="mt-2 text-sm text-muted-foreground">
                {scenarioData?.generated ? (
                  <p>
                    This is a generated scenario that cannot be directly edited.
                    You can duplicate this scenario to create a new editable
                    version with your desired changes.
                  </p>
                ) : scenarioData?.department_ids?.length === 0 ? (
                  <p>
                    This is a default scenario that cannot be edited. You can
                    view the details but cannot make changes.
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
        {/* Step 1: Basic Information */}
        <ScenarioBasicInfoSection
          name={formData.name || ""}
          departmentIds={formData.departmentIds || []}
          validDepartmentIds={scenarioData?.valid_department_ids || []}
          departmentMapping={departmentMapping}
          scenarioAgentId={formData.scenarioAgentId}
          imageAgentId={formData.imageAgentId}
          validAgentIds={scenarioData?.valid_agent_ids || []}
          agentMapping={agentMapping}
          expectedScenarioRole={expectedScenarioRole}
          active={formData.active ?? true}
          onNameChange={(name) => handleInputChange("name", name)}
          onDepartmentIdsChange={(ids) =>
            handleInputChange("departmentIds", ids)
          }
          onScenarioAgentIdChange={(id) =>
            setFormData((prev) => ({ ...prev, scenarioAgentId: id }))
          }
          onImageAgentIdChange={(id) =>
            setFormData((prev) => ({ ...prev, imageAgentId: id }))
          }
          onActiveChange={(active) => handleInputChange("active", active)}
          onRandomizeAll={handleRandomizeAll}
          onResetAll={handleResetAll}
          isReadonly={isReadonly}
          isSuperadmin={isSuperadmin}
        />
        {/* Step 2: Persona Selection */}
        <PersonaSection
          validPersonaIds={validPersonaIds}
          personaMapping={personaMapping}
          selectedPersonaIds={selectedPersonaIds}
          searchTerm={personaSearchTerm}
          minMax={personaMinMax}
          onPersonaIdsChange={handlePersonaSelect}
          onSearchTermChange={setPersonaSearchTerm}
          onMinMaxChange={setPersonaMinMax}
          onRandomize={handleRandomizePersonaClient}
          onReset={handleResetPersona}
          stepStatus={getStepStatus("persona")}
          stepTitle={steps[1]?.title || ""}
          stepDescription={steps[1]?.description || ""}
          stepNumber={2}
          isReadonly={isReadonly}
          isEditMode={isEditMode}
        />

        {/* Step 3: Documents */}
        <DocumentSection
          validDocumentIds={validDocumentIds}
          documentMapping={documentMapping}
          selectedDocumentIds={currentDocumentIds}
          templateDocumentIds={currentTemplateDocumentIds}
          {...(scenarioData?.document_details
            ? {
                documentDetails: scenarioData.document_details as Array<{
                  document_id: string;
                  upload_id?: string | null;
                  [key: string]: unknown;
                }>,
              }
            : {})}
          searchTerm={documentSearchTerm}
          minMax={documentMinMax}
          previewDocumentId={previewDocumentId}
          onDocumentIdsChange={setCurrentDocumentIds}
          onTemplateDocumentIdsChange={setCurrentTemplateDocumentIds}
          onSearchTermChange={setDocumentSearchTerm}
          onMinMaxChange={setDocumentMinMax}
          onPreviewDocument={setPreviewDocumentId}
          onRandomize={handleRandomizeDocumentsClient}
          onReset={handleResetDocuments}
          stepStatus={getStepStatus("documents")}
          stepTitle={steps[2]?.title || ""}
          stepDescription={steps[2]?.description || ""}
          stepNumber={3}
          isReadonly={isReadonly}
          isEditMode={isEditMode}
        />

        {/* Step 4: Parameters */}
        <ParameterSection
          validParameterIds={scenarioData?.valid_parameter_ids || []}
          parameterMapping={parameterMapping}
          selectedParameterIds={formData.parameterIds || []}
          searchTerm={parameterSearchTerm}
          minMax={parameterSelectionMinMax}
          onParameterIdsChange={(ids) => handleInputChange("parameterIds", ids)}
          onSearchTermChange={setParameterSearchTerm}
          onMinMaxChange={setParameterSelectionMinMax}
          onRandomize={handleRandomizeParametersClient}
          onReset={handleResetParameters}
          onParameterUnselect={(paramId) => {
            // When unselecting a parameter, also remove all its parameter items (fields)
            setCurrentFieldIds((prev) =>
              prev.filter(
                (itemId) => fieldMapping[itemId]?.parameter_id !== paramId
              )
            );
          }}
          stepStatus={getStepStatus("parameters")}
          stepTitle={steps[3]?.title || ""}
          stepDescription={steps[3]?.description || ""}
          stepNumber={4}
          isReadonly={isReadonly}
          isEditMode={isEditMode}
        />

        {/* Individual Parameter Sections */}
        {Object.entries(generalParameterMapping).map(
          ([paramId, param], index) => {
            const stepIndex = 4 + index; // After basic (0), persona (1), documents (2), parameters (3)
            const stepId = `parameter-${paramId}`;
            const stepStatus = getStepStatus(stepId);
            const validItemsForParam = validGeneralParameterItemIds.filter(
              (itemId) => fieldMapping[itemId]?.parameter_id === paramId
            );
            const selectedItemsForParam = currentFieldIds.filter(
              (itemId) => fieldMapping[itemId]?.parameter_id === paramId
            );

            return (
              <ParameterItemSection
                key={paramId}
                parameterId={paramId}
                parameter={param}
                validFieldIds={validItemsForParam}
                fieldMapping={fieldMapping}
                selectedFieldIds={selectedItemsForParam}
                minMax={fieldMinMax[paramId] || { min: 1, max: 2 }}
                onFieldIdsChange={(newIds) => {
                  // Update only this parameter's items
                  const otherFieldIds = currentFieldIds.filter(
                    (itemId) => fieldMapping[itemId]?.parameter_id !== paramId
                  );
                  setCurrentFieldIds([...otherFieldIds, ...newIds]);
                }}
                onMinMaxChange={(minMax) =>
                  setFieldMinMax((prev) => ({
                    ...prev,
                    [paramId]: minMax,
                  }))
                }
                onRandomize={() => handleRandomizeParameterClient(paramId)}
                onReset={() => handleResetParameter(paramId)}
                stepStatus={stepStatus}
                stepNumber={stepIndex + 1}
                isReadonly={isReadonly}
                isEditMode={isEditMode}
              />
            );
          }
        )}

        {/* Content Step */}
        {(() => {
          const contentStepIndex = steps.findIndex(
            (step) => step.id === "content"
          );
          const contentStepNumber =
            contentStepIndex >= 0 ? contentStepIndex + 1 : steps.length;
          return (
            <ContentSection
              problemStatement={formData.problemStatement || ""}
              problemStatementMapping={problemStatementMapping}
              currentProblemStatementIds={currentProblemStatementIds}
              hasProblemStatementChanges={hasProblemStatementChanges}
              originalProblemStatement={
                originalFormData?.problemStatement || ""
              }
              objectiveCountRange={
                scenarioData?.objective_count_range
                  ? {
                      min: scenarioData.objective_count_range.min,
                      max: scenarioData.objective_count_range.max,
                    }
                  : { min: 0, max: 5 }
              }
              objectiveCount={objectiveCount}
              onObjectiveCountChange={(min, max) =>
                setObjectiveCount([min, max])
              }
              objectives={currentObjectives}
              objectivesHistory={objectivesHistory}
              useImage={useImage}
              image={image}
              imageMapping={imageMapping}
              isUploadingImage={isUploadingImage}
              allPreviewDocumentIds={allPreviewDocumentIds}
              documentMapping={documentMapping}
              scenarioPreviewDocumentId={scenarioPreviewDocumentId}
              {...(scenarioData?.document_details
                ? {
                    documentDetails: scenarioData.document_details as Array<{
                      document_id: string;
                      upload_id?: string | null;
                      [key: string]: unknown;
                    }>,
                  }
                : {})}
              templateDocumentIds={currentTemplateDocumentIds}
              selectedPersonaIds={selectedPersonaIds}
              personaMapping={personaMapping}
              onProblemStatementChange={(value) =>
                handleInputChange("problemStatement", value)
              }
              onProblemStatementVersionSelect={
                handleProblemStatementVersionSelect
              }
              onResetProblemStatement={() =>
                handleInputChange(
                  "problemStatement",
                  originalFormData?.problemStatement || ""
                )
              }
              onObjectivesChange={setCurrentObjectives}
              onAddObjective={addObjective}
              onRemoveObjective={removeObjective}
              onUpdateObjective={updateObjective}
              onDragStartObjective={handleDragStartObjective}
              onDragOverObjective={handleDragOver}
              onDropObjective={handleDropObjective}
              onUseImageChange={(enabled) => {
                setUseImage(enabled);
                if (!enabled) {
                  setImage(null);
                }
              }}
              onImageSelect={handleImageSelect}
              onImageUpload={handleImageUpload}
              onImageRemove={() => setImage(null)}
              onScenarioPreviewDocumentChange={setScenarioPreviewDocumentId}
              onGenerate={handleGenerateScenario}
              onResetContent={handleResetContent}
              onShowRegenerationDialog={() => setShowRegenerationDialog(true)}
              stepStatus={getStepStatus("content")}
              stepTitle={
                contentStepIndex >= 0
                  ? steps[contentStepIndex]?.title || ""
                  : ""
              }
              stepDescription={
                contentStepIndex >= 0
                  ? steps[contentStepIndex]?.description || ""
                  : ""
              }
              stepNumber={contentStepNumber}
              isReadonly={isReadonly}
              isGeneratingScenario={isGeneratingScenario}
              isSubmitting={isSubmitting}
              draggedObjectiveIndex={draggedObjectiveIndex}
              imageInputRef={imageInputRef as React.RefObject<HTMLInputElement>}
              isEditMode={isEditMode}
            />
          );
        })()}
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
          data-testid="btn-submit-scenario"
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
            <AlertDialogDescription className="pb-2">
              Provide instructions for what you'd like to change.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label htmlFor="regeneration-instructions">Instructions</Label>
              <Textarea
                id="regeneration-instructions"
                value={regenerationInstructions}
                onChange={(e) => setRegenerationInstructions(e.target.value)}
                placeholder="e.g., Make it more challenging, focus on time management..."
                className="min-h-[100px]"
                disabled={isGeneratingScenario}
              />
            </div>
            {
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Label
                    htmlFor="regenerate-objectives"
                    className="text-sm flex items-center gap-1.5"
                  >
                    <RotateCcw className="h-3.5 w-3.5 text-muted-foreground" />
                    Regenerate Objectives
                  </Label>
                  <Switch
                    id="regenerate-objectives"
                    checked={regenerateObjectives}
                    onCheckedChange={setRegenerateObjectives}
                    disabled={isGeneratingScenario}
                  />
                </div>
                <p className="text-xs text-muted-foreground pl-5">
                  Replace current objectives; previous versions remain in
                  history
                </p>
              </div>
            }
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={isGeneratingScenario}
              onClick={() => {
                setRegenerationInstructions("");
                setRegenerateObjectives(true);
                setShowRegenerationDialog(false);
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                handleGenerateScenario(
                  regenerationInstructions.trim() || undefined,
                  regenerateObjectives
                );
                setShowRegenerationDialog(false);
                setRegenerationInstructions("");
                setRegenerateObjectives(true);
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
