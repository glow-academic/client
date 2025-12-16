/**
 * Scenario.tsx
 * Progressive step-by-step scenario creation flow
 * @AshokSaravanan222 & @siladiea
 * 05/20/2025
 */
"use client";
import { Loader2, RotateCcw } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
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
          // Update state to trigger URL sync
          setCurrentObjectiveIds(() => {
            return data.objective_ids;
          });
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

          const parentDocumentId = data.parent_document_id;
          if (parentDocumentId) {
            // Document has a parent - this is a dynamic child document (created from a template)
            // Add child to currentDocumentIds and remove parent from templateDocumentIds
            // eslint-disable-next-line no-console
            console.log("[Scenario] Adding dynamic child document:", {
              parent_id: parentDocumentId,
              document_id: data.document_id,
            });
            // Add child document to currentDocumentIds
            // Keep parent in URL (for persistence) but add child for display
            setCurrentDocumentIds((prev) => {
              // Add child if not already present
              if (prev.includes(data.document_id)) {
                return prev;
              }
              return [...prev, data.document_id];
            });
            // Note: We keep parent in templateDocumentIds for URL persistence
            // The display logic will filter/show child instead of parent
          } else {
            // Regular document (no parent) - add to currentDocumentIds
            // eslint-disable-next-line no-console
            console.log("[Scenario] Adding new document:", data.document_id);
            setCurrentDocumentIds((prev) => {
              return [...prev, data.document_id];
            });
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
        socket.off("scenarios_generation_progress", handleProgress);
        socket.off("scenarios_generation_complete", handleComplete);
        socket.off("scenarios_generation_error", handleError);
        socket.off(
          "scenarios_tools_statement_complete",
          handleProblemStatementComplete
        );
        socket.off(
          "scenarios_tools_objectives_complete",
          handleObjectivesComplete
        );
        socket.off("scenarios_tools_document_complete", handleDocumentComplete);
        socket.off("scenarios_tools_image_complete", handleImageComplete);

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
        socket.off("scenarios_generation_progress", handleProgress);
        socket.off("scenarios_generation_complete", handleComplete);
        socket.off("scenarios_generation_error", handleError);
        socket.off(
          "scenarios_tools_statement_complete",
          handleProblemStatementComplete
        );
        socket.off(
          "scenarios_tools_objectives_complete",
          handleObjectivesComplete
        );
        socket.off("scenarios_tools_document_complete", handleDocumentComplete);
        socket.off("scenarios_tools_image_complete", handleImageComplete);

        // Convert toast to error
        toast.error(data.message || "Scenario generation failed", {
          id: toastId,
        });
        reject(new Error(data.message || "Scenario generation failed"));
      };

      // Register listeners
      socket.on("scenarios_generation_progress", handleProgress);
      socket.on("scenarios_generation_complete", handleComplete);
      socket.on("scenarios_generation_error", handleError);
      socket.on(
        "scenario_tool_problem_statement_complete",
        handleProblemStatementComplete
      );
      socket.on("scenarios_tools_objectives_complete", handleObjectivesComplete);
      socket.on("scenarios_tools_document_complete", handleDocumentComplete);
      socket.on("scenarios_tools_image_complete", handleImageComplete);

      // eslint-disable-next-line no-console
      console.log(
        "[Scenario] Registered WebSocket event listeners for scenario generation"
      );

      // Emit the event
      // scenarioAgentId is required - UI filters and selects appropriate agent for scenario generation
      if (!formData.scenarioAgentId) {
        toast.error("Please select a scenario agent before generating");
        reject(new Error("Scenario agent ID is required"));
        return;
      }

      socket.emit("generate_scenario", {
        departmentId: body.departmentId,
        scenarioAgentId: formData.scenarioAgentId, // Required: selected scenario agent ID
        imageAgentId: formData.imageAgentId || undefined, // Optional: selected image agent ID
        videoAgentId: formData.videoAgentId || undefined, // Optional: selected video agent ID
        personaIds: body.personaIds,
        documentIds: body.documentIds,
        fieldIds: body.fieldIds, // Renamed from parameterItemIds
        profileId: body.profileId,
        scenarioId: scenarioId || undefined, // Pass scenarioId if in edit mode
        imagesEnabled: useImage,
        videoEnabled: useVideo,
        objectivesEnabled: useObjectives,
        questionsEnabled: useQuestions,
      });
    });
  };

  // Note: Using handleCreateScenario and handleUpdateScenario directly

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
      videoAgentId: null as string | null,
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
  // Use Objectives flag - initialized from URL params (DHH-style: URL as source of truth)
  const [useObjectives, setUseObjectives] = useState(() => {
    const useObjectivesFromUrl = searchParams.get("useObjectives");
    return useObjectivesFromUrl === "true";
  });
  // Use Image flag - initialized from URL params (DHH-style: URL as source of truth)
  const [useImage, setUseImage] = useState(() => {
    const useImageFromUrl = searchParams.get("useImage");
    return useImageFromUrl === "true";
  });
  // Use Video flag - initialized from URL params
  const [useVideo, setUseVideo] = useState(() => {
    const useVideoFromUrl = searchParams.get("useVideo");
    return useVideoFromUrl === "true";
  });
  // Use Questions flag - initialized from URL params
  const [useQuestions, setUseQuestions] = useState(() => {
    const useQuestionsFromUrl = searchParams.get("useQuestions");
    return useQuestionsFromUrl === "true";
  });
  const [draggedObjectiveIndex, setDraggedObjectiveIndex] = useState<
    number | null
  >(null);

  // State for junction data (managed separately from scenario)
  const [currentObjectives, setCurrentObjectives] = useState<string[]>([]);
  const [currentFieldIds, setCurrentFieldIds] = useState<string[]>([]);
  const [currentDocumentIds, setCurrentDocumentIds] = useState<string[]>([]);
  // templateDocumentIds comes from URL params (single source of truth)
  const [templateDocumentIds, setTemplateDocumentIds] = useState<string[]>(
    () => {
      const templateDocumentIdsFromUrl =
        searchParams.get("templateDocumentIds")?.split(",").filter(Boolean) ||
        [];
      return templateDocumentIdsFromUrl;
    }
  );
  const [scenarioPreviewDocumentId, setScenarioPreviewDocumentId] = useState<
    string | null
  >(null);
  // Initialize problem statement IDs from URL params (DHH-style: compute when needed)
  const [currentProblemStatementIds, setCurrentProblemStatementIds] = useState<
    string[]
  >(() => {
    const problemStatementIdsFromUrl =
      searchParams.get("problemStatementIds")?.split(",").filter(Boolean) || [];
    return problemStatementIdsFromUrl;
  });
  // Initialize objective IDs from URL params (DHH-style: compute when needed)
  const [currentObjectiveIds, setCurrentObjectiveIds] = useState<string[]>(
    () => {
      const objectiveIdsFromUrl =
        searchParams.get("objectiveIds")?.split(",").filter(Boolean) || [];
      return objectiveIdsFromUrl;
    }
  );
  const [image, setImage] = useState<{
    id: string;
    name: string;
    upload_id: string;
  } | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Video state
  const [selectedVideo, setSelectedVideo] = useState<{
    id: string;
    name: string;
    length_seconds: number;
  } | null>(null);
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);

  // Questions state
  const [currentQuestionIds, setCurrentQuestionIds] = useState<string[]>([]);
  const [questions, setQuestions] = useState<
    Array<{
      id: string;
      question_text: string;
      allow_multiple: boolean;
      options: Array<{
        id: string;
        option_text: string;
        type?: "discrete" | "freeform";
        is_correct: boolean;
      }>;
      times?: number[];
    }>
  >([]);
  const [draggedQuestionIndex, setDraggedQuestionIndex] = useState<
    number | null
  >(null);
  const [draggedOptionIndex, setDraggedOptionIndex] = useState<{
    questionIndex: number;
    optionIndex: number;
  } | null>(null);

  // Use transition for smooth UI updates during randomization
  // This ensures the old UI stays visible while new randomized selections are being applied
  const [isPending, startTransition] = useTransition();

  // Track which section is currently being randomized for loading indicators
  const [randomizingSection, setRandomizingSection] = useState<
    "persona" | "document" | "parameters" | `parameter_${string}` | "all" | null
  >(null);

  // Min/max state for randomization (current values, not allowed ranges)
  // Initialize from server's persona_min/persona_max (current values), default to 1
  const [personaMinMax, setPersonaMinMax] = useState(() => {
    // In create mode, check if scenarioData has persona_min/persona_max
    if (scenarioData && "persona_min" in scenarioData) {
      const newData = scenarioData as ScenarioNewOut;
      return {
        min: newData.persona_min ?? 1,
        max: newData.persona_max ?? 1,
      };
    }
    // Default to 1 (not the allowed range max of 3)
    return { min: 1, max: 1 };
  });
  // Initialize from server's current values (persona_min/persona_max, document_min/document_max, etc.)
  // Server is source of truth - use current values, not allowed_ranges
  const [documentMinMax, setDocumentMinMax] = useState(() => {
    if (scenarioData && "document_min" in scenarioData) {
      const newData = scenarioData as ScenarioNewOut;
      return {
        min: newData.document_min ?? 0,
        max: newData.document_max ?? 1,
      };
    }
    // Fallback to default current values (0-1) if server data not available yet
    // allowed_ranges contains bounds (0-3), but we want default current values (0-1)
    return { min: 0, max: 1 };
  });
  const [parameterSelectionMinMax, setParameterSelectionMinMax] = useState(
    () => {
      if (scenarioData && "parameter_selection_min" in scenarioData) {
        const newData = scenarioData as ScenarioNewOut;
        return {
          min: newData.parameter_selection_min ?? 0,
          max: newData.parameter_selection_max ?? 3,
        };
      }
      // Fallback to allowed range if server data not available yet
      const ranges = scenarioData?.allowed_ranges;
      return ranges?.parameter_selection
        ? {
            min: ranges.parameter_selection.min,
            max: ranges.parameter_selection.max,
          }
        : { min: 0, max: 3 };
    }
  );
  const [fieldMinMax, setFieldMinMax] = useState<
    Record<string, { min: number; max: number }>
  >(() => {
    // Use field_ranges (current values) if available, otherwise use allowed_ranges.fields
    if (scenarioData && "field_ranges" in scenarioData) {
      const newData = scenarioData as ScenarioNewOut;
      if (newData.field_ranges) {
        const result: Record<string, { min: number; max: number }> = {};
        Object.entries(newData.field_ranges).forEach(([paramId, range]) => {
          // Handle undefined values with defaults - type assertion needed for index signature
          const typedRange = range as { min?: number; max?: number };
          result[paramId] = {
            min: typedRange.min ?? 1,
            max: typedRange.max ?? 3,
          };
        });
        return result;
      }
    }
    // Fallback to allowed_ranges.fields if server data not available yet
    const ranges = scenarioData?.allowed_ranges;
    if (!ranges?.fields) return {};
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

  // Extract mappings from V2 response - defined early so they can be used in buildSearchParams
  const fieldMapping = useMemo(() => {
    return scenarioData?.field_mapping || {};
  }, [scenarioData]);

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
    if (templateDocumentIds.length > 0) {
      params.set("templateDocumentIds", templateDocumentIds.join(","));
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
    if (currentObjectiveIds.length > 0) {
      params.set("objectiveIds", currentObjectiveIds.join(","));
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

    // Add range params when different from server-provided current values
    // Compare against server's current values (persona_min/persona_max), not allowed_ranges
    const serverCurrentValues = scenarioData as ScenarioNewOut | undefined;

    // Persona ranges - compare against server's current values
    const serverPersonaMin = serverCurrentValues?.persona_min ?? 1;
    const serverPersonaMax = serverCurrentValues?.persona_max ?? 1;
    if (
      personaMinMax.min !== serverPersonaMin ||
      personaMinMax.max !== serverPersonaMax
    ) {
      params.set("personaMin", personaMinMax.min.toString());
      params.set("personaMax", personaMinMax.max.toString());
    }

    // Document ranges - compare against server's current values
    const serverDocumentMin = serverCurrentValues?.document_min ?? 0;
    const serverDocumentMax = serverCurrentValues?.document_max ?? 1;
    if (
      documentMinMax.min !== serverDocumentMin ||
      documentMinMax.max !== serverDocumentMax
    ) {
      params.set("documentMin", documentMinMax.min.toString());
      params.set("documentMax", documentMinMax.max.toString());
    }

    // Parameter selection ranges - compare against server's current values
    const serverParameterMin =
      serverCurrentValues?.parameter_selection_min ?? 0;
    const serverParameterMax =
      serverCurrentValues?.parameter_selection_max ?? 3;
    if (
      parameterSelectionMinMax.min !== serverParameterMin ||
      parameterSelectionMinMax.max !== serverParameterMax
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

    // Per-parameter field ranges - compare against server's current values
    // Include ranges for selected parameters, or for all parameters if randomize=all (server needs ranges for randomized params)
    const selectedParamIds = formData.parameterIds || [];
    const isRandomizing = searchParams.get("randomize") === "all";
    const serverFieldRanges = serverCurrentValues?.field_ranges || {};
    Object.entries(fieldMinMax).forEach(([fieldId, range]) => {
      // Include range if:
      // 1. Parameter is selected, OR
      // 2. We're randomizing all (server will randomize parameters and need these ranges)
      // AND range differs from server's current value
      const shouldInclude = isRandomizing || selectedParamIds.includes(fieldId);
      // Get the parameter_id for this field to find its range in server response
      const fieldParamId = fieldMapping[fieldId]?.parameter_id;
      const serverFieldRange = fieldParamId
        ? (serverFieldRanges[fieldParamId] as
            | { min?: number; max?: number }
            | undefined)
        : undefined;
      const fieldDefaultMin = serverFieldRange?.["min"] ?? 1;
      const fieldDefaultMax = serverFieldRange?.["max"] ?? 3;
      const fieldDefault: { min: number; max: number } = {
        min: fieldDefaultMin,
        max: fieldDefaultMax,
      };
      if (
        shouldInclude &&
        (range["min"] !== fieldDefault.min || range["max"] !== fieldDefault.max)
      ) {
        params.set(`fieldMin_${fieldId}`, range["min"].toString());
        params.set(`fieldMax_${fieldId}`, range["max"].toString());
      }
    });

    // Use Image flag - compare against server's current value
    const serverImageEnabled =
      serverCurrentValues?.image_input_enabled ?? false;
    if (useImage !== serverImageEnabled) {
      params.set("useImage", useImage ? "true" : "false");
    }

    // Note: randomize param is set separately by randomize handlers, not here
    // This function builds the base URL state (filters, searches, ranges)

    return params;
  }, [
    scenarioData, // Include full scenarioData to access current values (persona_min, persona_max, etc.)
    formData.departmentIds,
    selectedPersonaIds,
    currentDocumentIds,
    templateDocumentIds,
    formData.parameterIds,
    currentFieldIds,
    currentProblemStatementIds,
    currentObjectiveIds,
    personaSearchTerm,
    documentSearchTerm,
    parameterSearchTerm,
    personaMinMax,
    documentMinMax,
    parameterSelectionMinMax,
    fieldMinMax,
    useImage, // Include useImage for useImage flag
    fieldMapping, // Used for field ranges comparison
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
  // fieldMapping is defined above (before buildSearchParams) so it can be used there
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
    const serverMappingRaw = scenarioData?.problem_statement_mapping || {};
    // Normalize server mapping to ensure all entries have name field (for backward compatibility)
    const serverMapping: Record<
      string,
      {
        name: string;
        problem_statement: string;
        created_at: string;
        updated_at: string;
      }
    > = {};
    Object.entries(serverMappingRaw).forEach(([id, entry]) => {
      serverMapping[id] = {
        name: (entry as { name?: string }).name || "", // Ensure name field exists
        problem_statement: (entry as { problem_statement: string })
          .problem_statement,
        created_at: (entry as { created_at: string }).created_at,
        updated_at: (entry as { updated_at: string }).updated_at,
      };
    });

    const localMapping: Record<
      string,
      {
        name: string;
        problem_statement: string;
        created_at: string;
        updated_at: string;
      }
    > = {};

    // Convert local versions to ProblemStatementInfo format
    localProblemStatementVersions.forEach((version) => {
      localMapping[version.id] = {
        name: "", // Local versions don't have name, use empty string as fallback
        problem_statement: version.problem_statement,
        created_at: version.created_at,
        updated_at: version.updated_at,
      };
    });

    // Simple merge: server versions + local versions (local takes precedence if same ID)
    return { ...serverMapping, ...localMapping };
  }, [scenarioData?.problem_statement_mapping, localProblemStatementVersions]);

  // Compute selected problem statement ID for picker (DHH-style: derive from state, not effects)
  const selectedProblemStatementId = useMemo(() => {
    // If we have IDs from URL, use the first one
    if (currentProblemStatementIds.length > 0) {
      return currentProblemStatementIds[0];
    }
    // Otherwise, find the ID that matches the current problem statement text
    if (formData.problemStatement && formData.problemStatement.trim()) {
      const matchingId = Object.entries(problemStatementMapping).find(
        ([_id, info]) => info.problem_statement === formData.problemStatement
      )?.[0];
      return matchingId;
    }
    return undefined;
  }, [
    currentProblemStatementIds,
    formData.problemStatement,
    problemStatementMapping,
  ]);

  // Combine currentDocumentIds and templateDocumentIds for preview
  // Filter out parent template documents if we have their children (dynamic documents)
  // Also filter templateDocumentIds to exclude parents of children
  const filteredTemplateDocumentIds = useMemo(() => {
    // Get parent_document_id for each document in currentDocumentIds
    const childParentIds = new Set<string>();
    currentDocumentIds.forEach((docId) => {
      const docDetail = scenarioData?.document_details?.find(
        (d) => d.document_id === docId
      );
      const parentId = (docDetail as { parent_document_id?: string })
        ?.parent_document_id;
      if (parentId) {
        childParentIds.add(parentId);
      }
    });
    // Filter out parent documents from templateDocumentIds if we have their children
    return templateDocumentIds.filter((docId) => !childParentIds.has(docId));
  }, [currentDocumentIds, templateDocumentIds, scenarioData?.document_details]);

  // For display: replace parent template documents with their children
  // This ensures we show the actual dynamic document instead of the template
  const allPreviewDocumentIds = useMemo(() => {
    // Build a map of parent -> child for quick lookup
    // Check ALL document_details, not just currentDocumentIds, to find children
    const parentToChildMap = new Map<string, string>();
    if (scenarioData?.document_details) {
      scenarioData.document_details.forEach((docDetail) => {
        const parentId = (docDetail as { parent_document_id?: string })
          ?.parent_document_id;
        if (parentId) {
          // If we already have a child for this parent, keep the most recent one
          // (or we could keep the first one - either way, we just need one child)
          if (!parentToChildMap.has(parentId)) {
            parentToChildMap.set(parentId, docDetail.document_id);
          }
        }
      });
    }

    // Start with all currentDocumentIds (includes children)
    const result = [...currentDocumentIds];

    // Replace any parent templates in currentDocumentIds with their children
    const resultWithChildren = result.map((docId) => {
      const childId = parentToChildMap.get(docId);
      return childId || docId; // Use child if exists, otherwise keep original
    });

    // Add templateDocumentIds, but replace parents with their children if children exist
    filteredTemplateDocumentIds.forEach((templateDocId) => {
      const childId = parentToChildMap.get(templateDocId);
      if (childId) {
        // Parent has a child - use child instead
        if (!resultWithChildren.includes(childId)) {
          resultWithChildren.push(childId);
        }
      } else {
        // No child exists - add template document
        if (!resultWithChildren.includes(templateDocId)) {
          resultWithChildren.push(templateDocId);
        }
      }
    });

    return resultWithChildren;
  }, [
    currentDocumentIds,
    filteredTemplateDocumentIds,
    scenarioData?.document_details,
  ]);

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

  // Extract video mapping from scenario_videos array
  type VideoMappingItem = {
    id: string;
    name: string;
    length_seconds: number;
  };
  const videoMapping = useMemo((): Record<string, VideoMappingItem> => {
    const scenarioVideos = (
      scenarioData as ScenarioDetailOut & {
        scenario_videos?: Array<{
          id?: string;
          name?: string;
          length_seconds?: number;
          active?: boolean;
        }>;
      }
    )?.scenario_videos;

    if (!scenarioVideos || !Array.isArray(scenarioVideos)) {
      return {};
    }

    const mapping: Record<string, VideoMappingItem> = {};
    scenarioVideos.forEach((vid) => {
      const vidTyped = vid as {
        id?: string;
        name?: string;
        length_seconds?: number;
        active?: boolean;
      };
      const videoId = vidTyped["id"];
      if (videoId) {
        mapping[videoId] = {
          id: videoId,
          name: vidTyped["name"] || "",
          length_seconds: vidTyped["length_seconds"] || 0,
        };
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

  // Initialize/update scenarioPreviewDocumentId when allPreviewDocumentIds changes
  // Use allPreviewDocumentIds (not currentDocumentIds) because it already handles parent->child replacement
  // This ensures we preview the actual child document instead of the parent template
  useEffect(() => {
    if (allPreviewDocumentIds.length > 0) {
      // If current preview is not in the preview documents, or no preview is set, select the first one
      const firstDocId = allPreviewDocumentIds[0];
      if (
        !scenarioPreviewDocumentId ||
        (firstDocId &&
          !allPreviewDocumentIds.includes(scenarioPreviewDocumentId))
      ) {
        setScenarioPreviewDocumentId(firstDocId || null);
      }
    } else {
      // No documents selected, clear preview
      setScenarioPreviewDocumentId(null);
    }
  }, [allPreviewDocumentIds, scenarioPreviewDocumentId]);

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

  // Sync problem statement IDs from URL params (DHH-style: compute when needed, not in effects)
  // Only sync FROM URL TO state when URL changes (browser navigation, direct URL entry)
  // Do NOT sync when state changes from events - let the debounced effect sync TO URL instead
  useEffect(() => {
    const problemStatementIdsFromUrl =
      searchParams.get("problemStatementIds")?.split(",").filter(Boolean) || [];
    const urlIdsSorted = [...problemStatementIdsFromUrl].sort().join(",");
    const currentIdsSorted = [...currentProblemStatementIds].sort().join(",");
    if (urlIdsSorted !== currentIdsSorted) {
      setCurrentProblemStatementIds(problemStatementIdsFromUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]); // Only watch searchParams - don't re-run when state changes from events

  // Sync objective IDs from URL params (DHH-style: compute when needed, not in effects)
  // Only sync FROM URL TO state when URL changes (browser navigation, direct URL entry)
  // Do NOT sync when state changes from events - let the debounced effect sync TO URL instead
  useEffect(() => {
    const objectiveIdsFromUrl =
      searchParams.get("objectiveIds")?.split(",").filter(Boolean) || [];
    const urlIdsSorted = [...objectiveIdsFromUrl].sort().join(",");
    const currentIdsSorted = [...currentObjectiveIds].sort().join(",");
    if (urlIdsSorted !== currentIdsSorted) {
      setCurrentObjectiveIds(objectiveIdsFromUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]); // Only watch searchParams - don't re-run when state changes from events

  // Sync template document IDs from URL params (DHH-style: compute when needed, not in effects)
  // Only sync FROM URL TO state when URL changes (browser navigation, direct URL entry)
  // Do NOT sync when state changes from events - let the debounced effect sync TO URL instead
  useEffect(() => {
    const templateDocumentIdsFromUrl =
      searchParams.get("templateDocumentIds")?.split(",").filter(Boolean) || [];
    const urlIdsSorted = [...templateDocumentIdsFromUrl].sort().join(",");
    const currentIdsSorted = [...templateDocumentIds].sort().join(",");
    if (urlIdsSorted !== currentIdsSorted) {
      setTemplateDocumentIds(templateDocumentIdsFromUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]); // Only watch searchParams - don't re-run when state changes from events

  // Sync useImage from URL params (DHH-style: URL as source of truth)
  // Only sync FROM URL TO state when URL changes (browser navigation, direct URL entry)
  // Do NOT sync when state changes from events - let the debounced effect sync TO URL instead
  useEffect(() => {
    const useImageFromUrl = searchParams.get("useImage");
    const urlUseImage = useImageFromUrl === "true";
    // Only update if different from current state
    if (useImage !== urlUseImage) {
      setUseImage(urlUseImage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]); // Only watch searchParams - don't re-run when state changes from events

  // Initialize image from scenario_images when they become available (similar to objectives)
  // This handles the case where imageIds are in URL but scenario_images loads asynchronously
  useEffect(() => {
    if (!isEditMode && useImage && scenarioData) {
      const scenarioImages = (
        scenarioData as ScenarioDetailOut & {
          scenario_images?: Array<{
            id?: string;
            name?: string;
            upload_id?: string;
            file_path?: string;
            mime_type?: string;
            active?: boolean;
            created_at?: string;
            updated_at?: string;
          }>;
        }
      )?.scenario_images;
      if (
        !image && // Only set if image isn't already set
        scenarioImages &&
        Array.isArray(scenarioImages) &&
        scenarioImages.length > 0
      ) {
        const firstImage = scenarioImages[0];
        if (firstImage) {
          const uploadId = firstImage.upload_id || firstImage.id;
          if (uploadId) {
            setImage({
              id: uploadId,
              name: firstImage.name || "",
              upload_id: uploadId,
            });
          }
        }
      }
    }
  }, [useImage, scenarioData, image, isEditMode]);

  // Populate currentObjectives from currentObjectiveIds when objective_mapping becomes available
  // This handles the case where objectiveIds are loaded from URL before scenarioData is available
  useEffect(() => {
    if (
      currentObjectiveIds.length > 0 &&
      scenarioData?.objective_mapping &&
      Object.keys(scenarioData.objective_mapping).length > 0
    ) {
      const objectiveMapping = (scenarioData.objective_mapping || {}) as Record<
        string,
        { name: string }
      >;
      const objectivesFromIds = getObjectivesFromMapping(
        currentObjectiveIds,
        objectiveMapping
      );
      // Only update if different (avoid unnecessary re-renders)
      const currentObjectivesString = JSON.stringify(currentObjectives);
      const newObjectivesString = JSON.stringify(objectivesFromIds);
      if (currentObjectivesString !== newObjectivesString) {
        setCurrentObjectives(objectivesFromIds);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentObjectiveIds, scenarioData?.objective_mapping]);

  // Handle randomized selections from server response
  useEffect(() => {
    // Only process if randomize param is present (prevents processing stale randomized_selections)
    const randomizeParam = searchParams.get("randomize");
    if (scenarioData?.randomized_selections && randomizeParam) {
      const randomized = scenarioData.randomized_selections;
      // Create a hash of the randomized selections to detect if we've already processed this
      const randomizedHash = JSON.stringify({
        personaIds: randomized.personaIds,
        documentIds: randomized.documentIds,
        parameterIds: randomized.parameterIds,
        fieldIds: randomized.fieldIds,
      });

      // Skip if we're currently applying randomized selections (prevents double-processing)
      if (isApplyingRandomizedRef.current) {
        // Still clear randomizing section to prevent infinite loading
        setRandomizingSection(null);
        return;
      }

      // If we've already processed this exact randomized selection, just clear the param and reset hash
      // (This handles the case where same result comes back - we still need to clear param for next randomization)
      if (lastProcessedRandomizedRef.current === randomizedHash) {
        // Reset hash so next randomization (even if same result) can be processed
        lastProcessedRandomizedRef.current = null;
        // Clear randomizing section to prevent infinite loading
        setRandomizingSection(null);
        updateUrlParams({
          randomize: null,
        });
        return;
      }

      // Mark that we're applying randomized selections (prevents second useEffect from running)
      isApplyingRandomizedRef.current = true;
      lastProcessedRandomizedRef.current = randomizedHash;

      // Update state with randomized selections using transition for smooth UI updates
      // This ensures the old UI stays visible while new selections are being applied,
      // especially important for personas which sort selected ones first
      startTransition(() => {
        if (randomized.personaIds) {
          setSelectedPersonaIds(randomized.personaIds);
        }
        if (randomized.documentIds) {
          setCurrentDocumentIds(randomized.documentIds);
        }
        if (randomized.parameterIds) {
          handleInputChange("parameterIds", randomized.parameterIds);
        }
        // Clear randomizing section state when randomization completes
        setRandomizingSection(null);
      });

      // Compute merged fieldIds if needed (for single parameter randomization)
      let finalFieldIds: string[] | undefined;
      if (randomized.fieldIds && randomized.fieldIds.length > 0) {
        const randomizeParam = searchParams.get("randomize");
        if (randomizeParam && randomizeParam.startsWith("parameter_")) {
          // Single parameter randomization: keep fields for other parameters, add randomized ones
          const paramId = randomizeParam.replace("parameter_", "");
          // Compute merged fields before state update
          // Note: Using currentFieldIds and fieldMapping from closure - they're stable references

          const otherParamFields = currentFieldIds.filter(
            (itemId) => fieldMapping[itemId]?.parameter_id !== paramId
          );
          finalFieldIds = [...otherParamFields, ...randomized.fieldIds];
          // Wrap field updates in transition too for smooth transitions
          startTransition(() => {
            setCurrentFieldIds(finalFieldIds!);
          });
        } else {
          // Full randomization (randomize=all): replace all fields
          finalFieldIds = randomized.fieldIds;
          startTransition(() => {
            setCurrentFieldIds(finalFieldIds!);
          });
        }
      }

      // Update URL params with randomized selections AND clear randomize param
      // This ensures URL reflects the randomized state (URL is source of truth)
      requestAnimationFrame(() => {
        const urlUpdates: Record<string, string | string[] | null> = {
          randomize: null, // Clear randomize param
        };

        // Add randomized IDs to URL params so URL reflects current state
        if (randomized.personaIds && randomized.personaIds.length > 0) {
          urlUpdates["personaIds"] = randomized.personaIds;
        }
        if (randomized.documentIds && randomized.documentIds.length > 0) {
          urlUpdates["documentIds"] = randomized.documentIds;
        }
        if (randomized.parameterIds && randomized.parameterIds.length > 0) {
          urlUpdates["parameterIds"] = randomized.parameterIds;
        }
        if (finalFieldIds && finalFieldIds.length > 0) {
          // Use the computed finalFieldIds (already merged if needed)
          urlUpdates["fieldIds"] = finalFieldIds;
        }

        updateUrlParams(urlUpdates);
        // Reset the flag after clearing params (use another frame to ensure URL update completes)
        requestAnimationFrame(() => {
          isApplyingRandomizedRef.current = false;
          // Ensure randomizing section is cleared even if transition didn't run
          setRandomizingSection(null);
        });
      });
    }
  }, [
    scenarioData?.randomized_selections,
    searchParams,
    updateUrlParams,
    handleInputChange,
    randomizingSection,
    currentFieldIds,
    fieldMapping,
  ]);

  // Also handle randomized flag as fallback (DHH-style: server tells client when to clear param)
  // This ensures the param is cleared even if randomized_selections processing fails or gets stuck
  // Also updates URL with randomized IDs from main fields (persona_ids, document_ids, etc.)
  useEffect(() => {
    const randomizeParam = searchParams.get("randomize");
    if (scenarioData?.randomized === true && randomizeParam) {
      // Server has applied randomization to main fields - update URL with randomized IDs
      // Use a small delay to ensure randomized_selections useEffect has a chance to run first
      const timeoutId = setTimeout(() => {
        // Only process if param is still present (randomized_selections might have already handled it)
        if (searchParams.get("randomize")) {
          // Read randomized values from main fields and update URL params
          // This ensures URL reflects the randomized state even if randomized_selections didn't process
          // Use transition for smooth state updates
          startTransition(() => {
            if (
              scenarioData.persona_ids &&
              scenarioData.persona_ids.length > 0
            ) {
              setSelectedPersonaIds(scenarioData.persona_ids);
            }
            if (
              scenarioData.document_ids &&
              scenarioData.document_ids.length > 0
            ) {
              setCurrentDocumentIds(scenarioData.document_ids);
            }
            if (
              scenarioData.scenario_parameter_ids &&
              scenarioData.scenario_parameter_ids.length > 0
            ) {
              handleInputChange(
                "parameterIds",
                scenarioData.scenario_parameter_ids
              );
            }
            // For fields, we need to extract from parameters dict or use selected_field_ids
            const serverData = scenarioData as ScenarioNewOut | undefined;
            if (
              serverData?.selected_field_ids &&
              serverData.selected_field_ids.length > 0
            ) {
              setCurrentFieldIds(serverData.selected_field_ids);
            }
          });

          const fallbackUrlUpdates: Record<string, string | string[] | null> = {
            randomize: null, // Clear randomize param
          };

          // Update URL params to reflect randomized state
          if (scenarioData.persona_ids && scenarioData.persona_ids.length > 0) {
            fallbackUrlUpdates["personaIds"] = scenarioData.persona_ids;
          }
          if (
            scenarioData.document_ids &&
            scenarioData.document_ids.length > 0
          ) {
            fallbackUrlUpdates["documentIds"] = scenarioData.document_ids;
          }
          if (
            scenarioData.scenario_parameter_ids &&
            scenarioData.scenario_parameter_ids.length > 0
          ) {
            fallbackUrlUpdates["parameterIds"] =
              scenarioData.scenario_parameter_ids;
          }
          // For fields, we need to extract from parameters dict or use selected_field_ids
          const fallbackServerData = scenarioData as ScenarioNewOut | undefined;
          if (
            fallbackServerData?.selected_field_ids &&
            fallbackServerData.selected_field_ids.length > 0
          ) {
            fallbackUrlUpdates["fieldIds"] =
              fallbackServerData.selected_field_ids;
          }

          // Reset flags to allow next randomization to be processed
          lastProcessedRandomizedRef.current = null;
          isApplyingRandomizedRef.current = false;
          // Clear randomizing section state
          setRandomizingSection(null);
          updateUrlParams(fallbackUrlUpdates);
        }
      }, 200);

      return () => clearTimeout(timeoutId);
    }
    return undefined;
  }, [
    scenarioData?.randomized,
    scenarioData,
    searchParams,
    updateUrlParams,
    startTransition,
    handleInputChange,
  ]);

  // Debounce timeout ref for URL updates
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // Track last params string to prevent duplicate updates
  const lastParamsStringRef = useRef<string>("");
  // Track if we're currently resetting to prevent buildSearchParams from interfering
  const isResettingRef = useRef<boolean>(false);

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
    // Skip if we're currently resetting (prevents re-adding params that were just cleared)
    debounceTimeoutRef.current = setTimeout(() => {
      // Skip buildSearchParams if we're resetting - let reset handlers manage URL directly
      if (isResettingRef.current) {
        return;
      }

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
    templateDocumentIds,
    formData.parameterIds,
    currentFieldIds, // Renamed from currentParameterItemIds
    currentProblemStatementIds,
    currentObjectiveIds,
    personaSearchTerm,
    documentSearchTerm,
    parameterSearchTerm,
    personaMinMax,
    documentMinMax,
    parameterSelectionMinMax,
    fieldMinMax,
    useImage, // Include useImage to trigger URL updates when useImage changes
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
        videoAgentId:
          (scenarioData as ScenarioDetailOut & { video_agent_id?: string })
            .video_agent_id || null,
        parameterIds: scenarioData.scenario_parameter_ids || [],
      });
      // Initialize previousDepartmentIds when loading scenario data
      if (previousDepartmentIds.length === 0 && deptIds.length > 0) {
        setPreviousDepartmentIds(deptIds);
      }
      setSelectedPersonaIds(scenarioData.persona_ids || []);
      // Clear local versions when loading existing scenario (edit mode)
      setLocalProblemStatementVersions([]);
      setCurrentDocumentIds(scenarioData.document_ids || []);
      // Extract template document IDs from documentDetails (is_template field) for edit mode
      const templateDocIds =
        scenarioData.document_details
          ?.filter((doc) => doc.is_template === true)
          .map((doc) => doc.document_id) || [];
      setTemplateDocumentIds(templateDocIds);
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
        objectives_enabled?: boolean;
        images_enabled?: boolean;
        video_enabled?: boolean;
        questions_enabled?: boolean;
        scenario_images?: Array<{
          id?: string;
          name?: string;
          upload_id?: string;
        }>;
        scenario_videos?: Array<{
          id?: string;
          name?: string;
          length_seconds?: number;
          active?: boolean;
        }>;
        question_ids?: string[];
        questions?: Array<{
          id?: string;
          question_text?: string;
          allow_multiple?: boolean;
          options?: Array<{
            id?: string;
            option_text?: string;
            is_correct?: boolean;
          }>;
          times?: number[];
        }>;
      };
      // Load objectives_enabled and objectives
      const objectivesEnabled =
        scenarioDataWithFlags.objectives_enabled ?? false;
      setUseObjectives(objectivesEnabled);
      // Load images_enabled and scenario image (single image - take first if exists)
      const imagesEnabled = scenarioDataWithFlags.images_enabled ?? false;
      setUseImage(imagesEnabled);
      const scenarioImages = scenarioDataWithFlags.scenario_images;
      if (
        imagesEnabled &&
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

      // Load video_enabled and scenario video (only active video)
      const videoEnabled = scenarioDataWithFlags.video_enabled ?? false;
      setUseVideo(videoEnabled);
      const scenarioVideos = scenarioDataWithFlags.scenario_videos;
      if (
        videoEnabled &&
        scenarioVideos &&
        Array.isArray(scenarioVideos) &&
        scenarioVideos.length > 0
      ) {
        // Find active video (only one should be active)
        const activeVideo =
          scenarioVideos.find((v) => {
            const vTyped = v as { active?: boolean };
            return vTyped["active"] === true;
          }) || scenarioVideos[0];
        const activeVideoTyped = activeVideo as {
          id?: string;
          name?: string;
          length_seconds?: number;
        };
        const videoId = activeVideoTyped["id"];
        if (videoId) {
          setSelectedVideo({
            id: videoId,
            name: activeVideoTyped["name"] || "",
            length_seconds: activeVideoTyped["length_seconds"] || 0,
          });
          setActiveVideoId(videoId);
        } else {
          setSelectedVideo(null);
          setActiveVideoId(null);
        }
      } else {
        setSelectedVideo(null);
        setActiveVideoId(null);
      }

      // Load questions_enabled and questions
      const questionsEnabled = scenarioDataWithFlags.questions_enabled ?? false;
      setUseQuestions(questionsEnabled);
      const questionIds = scenarioDataWithFlags.question_ids || [];
      const questionsData = scenarioDataWithFlags.questions || [];
      setCurrentQuestionIds(questionIds);
      if (
        questionsData &&
        Array.isArray(questionsData) &&
        questionsData.length > 0
      ) {
        setQuestions(
          questionsData.map((q) => {
            const qTyped = q as {
              id?: string;
              question_text?: string;
              allow_multiple?: boolean;
              options?: Array<{
                id?: string;
                option_text?: string;
                type?: "discrete" | "freeform";
                is_correct?: boolean;
              }>;
              times?: number[];
            };
            return {
              id: qTyped["id"] || "",
              question_text: qTyped["question_text"] || "",
              allow_multiple: qTyped["allow_multiple"] || false,
              options: (qTyped["options"] || []).map((opt) => ({
                id: opt["id"] || "",
                option_text: opt["option_text"] || "",
                type: opt["type"] || "discrete",
                is_correct: opt["is_correct"] || false,
              })),
              times: qTyped["times"] || [],
            };
          })
        );
      } else {
        setQuestions([]);
      }
      // Store originals for change tracking
      setOriginalFormData({
        name: scenarioData.name,
        problemStatement: scenarioData.problem_statement,
        departmentIds: scenarioData.department_ids || [],
        active: scenarioData.active ?? true,
        scenarioAgentId: scenarioData.scenario_agent_id || null,
        imageAgentId: scenarioData.image_agent_id || null,
        videoAgentId:
          (scenarioData as ScenarioDetailOut & { video_agent_id?: string })
            .video_agent_id || null,
        parameterIds: scenarioData.scenario_parameter_ids || [],
      });
      setOriginalDocumentIds(scenarioData.document_ids || []);
      // Store template document IDs for original tracking (already extracted above as templateDocIds)
      setOriginalTemplateDocumentIds(templateDocIds);
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
      // Preserve problem statement and name if they were set from URL params (don't reset to empty/default)
      const preservedProblemStatement =
        formData.problemStatement || initialFormData.problemStatement;
      // Preserve name if it was set from problem statement (not default "New Scenario")
      const preservedName =
        formData.name &&
        formData.name !== "New Scenario" &&
        formData.name.trim() !== ""
          ? formData.name
          : initialFormData.name;
      setFormData({
        ...initialFormData,
        problemStatement: preservedProblemStatement,
        name: preservedName,
        scenarioAgentId: scenarioData.scenario_agent_id || null,
        imageAgentId: scenarioData.image_agent_id || null,
        videoAgentId:
          (scenarioData as ScenarioDetailOut & { video_agent_id?: string })
            .video_agent_id || null,
        parameterIds: newData.selected_parameter_ids || [],
      });

      // Initialize selections from server response (filtered to valid IDs)
      if (newData.selected_persona_ids) {
        setSelectedPersonaIds(newData.selected_persona_ids);
      }
      if (newData.selected_document_ids) {
        setCurrentDocumentIds(newData.selected_document_ids);
      }
      // Template document IDs: prioritize URL params over server response
      // URL params are the source of truth (DHH-style)
      const templateDocumentIdsFromUrl =
        searchParams.get("templateDocumentIds")?.split(",").filter(Boolean) ||
        [];
      if (templateDocumentIdsFromUrl.length > 0) {
        // URL params take precedence
        setTemplateDocumentIds(templateDocumentIdsFromUrl);
      } else if (newData.selected_template_document_ids) {
        // Fallback to server response if no URL params
        setTemplateDocumentIds(newData.selected_template_document_ids);
      }
      if (newData.selected_field_ids) {
        setCurrentFieldIds(newData.selected_field_ids);
      }

      // Initialize image from scenario_images if available (when imageIds in URL)
      const scenarioImages = (
        scenarioData as ScenarioDetailOut & {
          scenario_images?: Array<{
            id?: string;
            name?: string;
            upload_id?: string;
            file_path?: string;
            mime_type?: string;
            active?: boolean;
            created_at?: string;
            updated_at?: string;
          }>;
        }
      )?.scenario_images;
      if (
        useImage &&
        scenarioImages &&
        Array.isArray(scenarioImages) &&
        scenarioImages.length > 0
      ) {
        const firstImage = scenarioImages[0];
        if (firstImage) {
          const uploadId = firstImage.upload_id || firstImage.id;
          if (uploadId) {
            setImage({
              id: uploadId,
              name: firstImage.name || "",
              upload_id: uploadId,
            });
          }
        }
      }

      // Initialize objective IDs from URL params (server doesn't return selected_objective_ids)
      // URL params are the source of truth (DHH-style)
      const objectiveIdsFromUrl = searchParams
        .get("objectiveIds")
        ?.split(",")
        .filter(Boolean);
      if (objectiveIdsFromUrl && objectiveIdsFromUrl.length > 0) {
        setCurrentObjectiveIds(objectiveIdsFromUrl);
        // Populate currentObjectives from objective IDs using objective_mapping
        // Note: objective_mapping might not be available yet, so we'll populate in a separate useEffect
        const objectiveMapping = (scenarioData?.objective_mapping ||
          {}) as Record<string, { name: string }>;
        if (Object.keys(objectiveMapping).length > 0) {
          const objectivesFromIds = getObjectivesFromMapping(
            objectiveIdsFromUrl,
            objectiveMapping
          );
          setCurrentObjectives(objectivesFromIds);
        }
      }

      // Initialize problem statement IDs from URL params (server doesn't return selected_problem_statement_ids)
      const problemStatementIdsFromUrl = searchParams
        .get("problemStatementIds")
        ?.split(",")
        .filter(Boolean);
      if (problemStatementIdsFromUrl && problemStatementIdsFromUrl.length > 0) {
        setCurrentProblemStatementIds(problemStatementIdsFromUrl);

        // Set first as active and update name if needed
        // Check scenarioData directly for problem_statement_mapping (DHH-style: simple, inline)
        const mappingRaw = scenarioData?.problem_statement_mapping || {};
        const firstId = problemStatementIdsFromUrl[0];
        if (firstId) {
          const firstProblemStatementRaw = mappingRaw[firstId];
          if (firstProblemStatementRaw) {
            // Normalize to ensure name field exists (for backward compatibility)
            const firstProblemStatement = {
              name: (firstProblemStatementRaw as { name?: string }).name || "",
              problem_statement: (
                firstProblemStatementRaw as { problem_statement: string }
              ).problem_statement,
              created_at: (firstProblemStatementRaw as { created_at: string })
                .created_at,
              updated_at: (firstProblemStatementRaw as { updated_at: string })
                .updated_at,
            };
            // Set as active
            if (
              !formData.problemStatement ||
              !formData.problemStatement.trim()
            ) {
              handleInputChange(
                "problemStatement",
                firstProblemStatement.problem_statement
              );
            }
            // Set name in new mode (using name field)
            const isNewMode =
              !isEditMode &&
              (!formData.name ||
                formData.name === "New Scenario" ||
                formData.name.trim() === "");
            if (isNewMode && firstProblemStatement.name) {
              handleInputChange("name", firstProblemStatement.name);
            }
          }
        }
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

      // Initialize range values from server response (current values, not allowed ranges)
      // Always set from server response if available, default to 1
      // Always update to ensure reset works properly (even if values match defaults)
      setPersonaMinMax({
        min: newData.persona_min ?? 1,
        max: newData.persona_max ?? 1,
      });
      // Always update document ranges (not conditional) to ensure reset works
      setDocumentMinMax({
        min: newData.document_min ?? 0,
        max: newData.document_max ?? 1,
      });
      // Always update parameter selection ranges to ensure reset works
      const parameterDefault =
        scenarioData?.allowed_ranges?.parameter_selection ||
        parameterSelectionMinMax;
      setParameterSelectionMinMax({
        min: newData.parameter_selection_min ?? parameterDefault.min,
        max: newData.parameter_selection_max ?? parameterDefault.max,
      });

      // Initialize per-parameter item ranges from server response
      // Always update field ranges (even if empty) to ensure reset works
      if (newData.field_ranges) {
        const result: Record<string, { min: number; max: number }> = {};
        Object.entries(newData.field_ranges).forEach(([paramId, range]) => {
          // Type assertion needed for index signature - use bracket notation
          const typedRange = range as { min?: number; max?: number };
          result[paramId] = {
            min: typedRange["min"] ?? 1,
            max: typedRange["max"] ?? 3,
          };
        });
        setFieldMinMax(result);
      } else {
        // If no field_ranges in response, initialize with defaults for all parameters
        // This ensures reset works even if server doesn't return field_ranges
        // Use parameterMapping (all parameters) not generalParameterMapping (filtered)
        const defaultFieldRanges: Record<string, { min: number; max: number }> =
          {};
        Object.keys(parameterMapping).forEach((paramId) => {
          defaultFieldRanges[paramId] = { min: 1, max: 3 };
        });
        setFieldMinMax(defaultFieldRanges);
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
    parameterSelectionMinMax, // Used as fallback value in effect
    parameterMapping,
    fieldMapping,
    formData.name,
    formData.problemStatement,
    handleInputChange,
    useImage,
  ]);

  // Problem statement ID is now managed via URL parameters, not state

  // Note: getScenarioAgentRole and expectedScenarioRole removed - scenarios now always use base 'scenario' role

  // Reset initialization flag when switching between edit/create modes or scenario changes
  useEffect(() => {
    formDataInitializedRef.current = false;
  }, [scenarioId, isEditMode]);

  // Reset agent selection when flags change to incompatible combination
  useEffect(() => {
    if (!scenarioData || !agentMapping || !formData.scenarioAgentId) return;

    const agent = agentMapping[formData.scenarioAgentId];
    const agentRole = agent?.roles?.[0]; // Get first role (should be only one)

    // If current agent doesn't match 'scenario' role, clear selection
    if (agentRole && agentRole !== "scenario") {
      setFormData((prev) => ({
        ...prev,
        scenarioAgentId: null,
        videoAgentId: null,
      }));
    }
  }, [scenarioData, agentMapping, formData.scenarioAgentId]);

  // Auto-select agents when there's only one option (similar to Document.tsx)
  useEffect(() => {
    if (!scenarioData || !agentMapping) return;

    const scenarioAgentIds =
      scenarioData.valid_agent_ids?.filter((id) => {
        const agent = agentMapping[id];
        const agentRole = agent?.roles?.[0];
        // Filter by 'scenario' role only
        return agentRole === "scenario";
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

    // Auto-select first video agent if only one option and not already set
    const videoAgentIds =
      scenarioData.valid_agent_ids?.filter((id) => {
        const agent = agentMapping[id];
        return agent?.roles?.includes("video");
      }) || [];
    if (videoAgentIds.length === 1 && !formData.videoAgentId) {
      setFormData((prev) => ({
        ...prev,
        videoAgentId: videoAgentIds[0] || null,
      }));
    }
  }, [
    scenarioData,
    agentMapping,
    formData.scenarioAgentId,
    formData.imageAgentId,
    formData.videoAgentId,
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
      JSON.stringify([...templateDocumentIds].sort()) !==
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
    templateDocumentIds,
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

  // Removed useEffect - server values are initialized in useState and useEffect at line 1436
  // Server is source of truth, no need to sync via useEffect (DHH approach)

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
        "This is what will be seen when entering the scenario. Leave blank for auto-generation.",
      status: getStepStatus("content"),
    };

    return [...baseSteps, ...parameterSteps, contentStep];
  }, [generalParameterMapping, getStepStatus]);

  // Parameter actions - Server-side randomization per parameter
  const handleRandomizeParameterClient = (paramId: string) => {
    // Set loading state for this specific parameter section
    setRandomizingSection(`parameter_${paramId}`);
    // Keep fields for other parameters in URL to avoid flash
    // Keep existing fields in local state too - randomized ones will merge via randomized_selections useEffect
    const filteredFieldIds = currentFieldIds.filter(
      (itemId) => fieldMapping[itemId]?.parameter_id !== paramId
    );
    // Update URL: keep fields for other parameters, add randomize param
    // Server will randomize fields for this parameter and return them
    // The randomized_selections useEffect will merge randomized fields with existing ones
    updateUrlParams({
      fieldIds: filteredFieldIds.length > 0 ? filteredFieldIds : null,
      randomize: `parameter_${paramId}`,
    });
    // Don't clear local state - keep existing fields until server returns randomized ones
    // The randomized_selections useEffect will merge and update state
    // Trigger page refresh to get randomized results from server
    router.refresh();
  };

  const handleResetParameter = (paramId: string) => {
    try {
      // Get default min/max for this parameter from server or use defaults
      const newData = scenarioData as ScenarioNewOut | undefined;
      const serverFieldRanges = newData?.field_ranges || {};
      const serverRange = serverFieldRanges[paramId];
      const defaultMin = serverRange?.["min"] ?? 1;
      const defaultMax = serverRange?.["max"] ?? 3;

      // Set resetting flag to prevent buildSearchParams from interfering
      isResettingRef.current = true;

      // Remove this parameter's items from URL params and local state
      const currentParamItems = currentFieldIds.filter(
        (itemId) => fieldMapping[itemId]?.parameter_id !== paramId
      );

      // Build URL updates - clear field IDs and range params for this parameter
      const urlUpdates: Record<string, string | string[] | null> = {
        fieldIds: currentParamItems.length > 0 ? currentParamItems : null,
        randomize: null,
      };
      // Clear range params for this parameter
      urlUpdates[`fieldMin_${paramId}`] = null;
      urlUpdates[`fieldMax_${paramId}`] = null;

      // Clear URL params FIRST, then update state after URL update completes
      updateUrlParams(urlUpdates);

      // Update local state after URL update completes (next frame)
      requestAnimationFrame(() => {
        // Reset local state for this parameter's range
        setFieldMinMax((prev) => ({
          ...prev,
          [paramId]: { min: defaultMin, max: defaultMax },
        }));
        // Update local state - remove this parameter's fields
        setCurrentFieldIds(currentParamItems);
        // Refresh after state updates to get fresh server data
        router.refresh();
        // Reset flag after refresh completes
        setTimeout(() => {
          isResettingRef.current = false;
        }, 200);
      });

      toast.success(
        `${generalParameterMapping[paramId]?.name || "Parameter"} reset`
      );
    } catch {
      isResettingRef.current = false;
      toast.error("Failed to reset parameter");
    }
  };

  // Persona actions - Server-side randomization
  const handleRandomizePersonaClient = () => {
    // Set loading state for persona section
    setRandomizingSection("persona");
    // Keep existing personaIds in URL to avoid flash of empty state
    // Server will randomize and return new values, which will update URL via randomized_selections useEffect
    updateUrlParams({
      randomize: "persona",
    });
    // Don't clear local state - keep existing values until server returns randomized ones
    // Trigger page refresh to get randomized results from server
    router.refresh();
  };

  const handleResetPersona = () => {
    try {
      // Get default min/max from server or use defaults
      const newData = scenarioData as ScenarioNewOut | undefined;
      const defaultMin = newData?.persona_min ?? 1;
      const defaultMax = newData?.persona_max ?? 1;

      // Set resetting flag to prevent buildSearchParams from interfering
      isResettingRef.current = true;

      // Clear URL params FIRST, then update state after URL update completes
      // This prevents buildSearchParams useEffect from re-adding params
      updateUrlParams({
        personaIds: null,
        personaSearch: null,
        personaMin: null,
        personaMax: null,
        randomize: null,
      });

      // Update local state after URL update completes (next frame)
      // This ensures URL is cleared before state updates trigger buildSearchParams
      requestAnimationFrame(() => {
        setPersonaMinMax({ min: defaultMin, max: defaultMax });
        setSelectedPersonaIds([]);
        setPersonaSearchTerm("");
        // Clear resetting flag after state updates and refresh
        router.refresh();
        // Reset flag after refresh completes
        setTimeout(() => {
          isResettingRef.current = false;
        }, 200);
      });

      toast.success("Persona reset");
    } catch {
      isResettingRef.current = false;
      toast.error("Failed to reset persona");
    }
  };

  // Documents actions - Server-side randomization
  const handleRandomizeDocumentsClient = () => {
    // Set loading state for document section
    setRandomizingSection("document");
    // Keep existing documentIds in URL to avoid flash of empty state
    // Server will randomize and return new values, which will update URL via randomized_selections useEffect
    updateUrlParams({
      randomize: "document",
    });
    // Don't clear local state - keep existing values until server returns randomized ones
    // Trigger page refresh to get randomized results from server
    router.refresh();
  };

  const handleResetDocuments = () => {
    try {
      // Get default min/max from server or use defaults
      const newData = scenarioData as ScenarioNewOut | undefined;
      const defaultMin = newData?.document_min ?? 0;
      const defaultMax = newData?.document_max ?? 1;

      // Set resetting flag to prevent buildSearchParams from interfering
      isResettingRef.current = true;

      // Clear URL params FIRST, then update state after URL update completes
      // This prevents buildSearchParams useEffect from re-adding params
      updateUrlParams({
        documentIds: null,
        documentSearch: null,
        documentMin: null,
        documentMax: null,
        randomize: null,
      });

      // Update local state after URL update completes (next frame)
      // This ensures URL is cleared before state updates trigger buildSearchParams
      requestAnimationFrame(() => {
        setDocumentMinMax({ min: defaultMin, max: defaultMax });
        setCurrentDocumentIds([]);
        setDocumentSearchTerm("");
        // Refresh after state updates to get fresh server data
        router.refresh();
        // Reset flag after refresh completes
        setTimeout(() => {
          isResettingRef.current = false;
        }, 200);
      });

      toast.success("Documents reset");
    } catch {
      isResettingRef.current = false;
      toast.error("Failed to reset documents");
    }
  };

  // Parameters actions - Server-side randomization
  const handleRandomizeParametersClient = () => {
    // Keep existing parameterIds in URL to avoid flash of empty state
    // Server will randomize and return new values, which will update URL via randomized_selections useEffect
    updateUrlParams({
      randomize: "parameters",
    });
    // Don't clear local state - keep existing values until server returns randomized ones
    // Trigger page refresh to get randomized results from server
    router.refresh();
  };

  const handleResetParameters = () => {
    try {
      // Get default min/max from server or use defaults
      const newData = scenarioData as ScenarioNewOut | undefined;
      const defaultMin = newData?.parameter_selection_min ?? 0;
      const defaultMax = newData?.parameter_selection_max ?? 3;

      // Set resetting flag to prevent buildSearchParams from interfering
      isResettingRef.current = true;

      // Build URL updates - clear parameter IDs, search, ranges, and ALL field IDs
      const urlUpdates: Record<string, string | string[] | null> = {
        parameterIds: null,
        parameterSearch: null,
        parameterSelectionMin: null,
        parameterSelectionMax: null,
        fieldIds: null, // Clear all field IDs when resetting parameters
        randomize: null,
      };

      // Clear all field range params for ALL parameters (including defaults)
      // Use parameterMapping (all parameters) not generalParameterMapping (filtered)
      Object.keys(parameterMapping).forEach((paramId) => {
        urlUpdates[`fieldMin_${paramId}`] = null;
        urlUpdates[`fieldMax_${paramId}`] = null;
      });

      // Also clear any fieldMin_* or fieldMax_* params from URL that we might have missed
      searchParams.forEach((_value, key) => {
        if (key.startsWith("fieldMin_") || key.startsWith("fieldMax_")) {
          urlUpdates[key] = null;
        }
      });

      // Clear URL params FIRST, then update state after URL update completes
      // This prevents buildSearchParams useEffect from re-adding params
      updateUrlParams(urlUpdates);

      // Update local state after URL update completes (next frame)
      // This ensures URL is cleared before state updates trigger buildSearchParams
      requestAnimationFrame(() => {
        setParameterSelectionMinMax({ min: defaultMin, max: defaultMax });
        handleInputChange("parameterIds", []);
        setParameterSearchTerm("");
        // Clear all field IDs and ranges when resetting parameters
        setCurrentFieldIds([]);
        // Reset field ranges to defaults for ALL parameters
        const defaultFieldRanges: Record<string, { min: number; max: number }> =
          {};
        Object.keys(parameterMapping).forEach((paramId) => {
          defaultFieldRanges[paramId] = { min: 1, max: 3 };
        });
        setFieldMinMax(defaultFieldRanges);
        // Refresh after state updates to get fresh server data
        router.refresh();
        // Reset flag after refresh completes
        setTimeout(() => {
          isResettingRef.current = false;
        }, 200);
      });

      toast.success("Parameters reset");
    } catch {
      isResettingRef.current = false;
      toast.error("Failed to reset parameters");
    }
  };

  // Helper functions removed - filtering now handled by server

  // Randomize all: personas, documents, and all parameters (server-side via URL params)
  const handleRandomizeAll = () => {
    try {
      // Set loading state for all sections
      setRandomizingSection("all");
      // Keep existing IDs in URL to avoid flash of empty state
      // Server will randomize and return new values, which will update URL via randomized_selections useEffect
      // Server randomizes from the full filtered set regardless of existing selections
      updateUrlParams({
        randomize: "all",
      });

      // Trigger page refresh to get randomized results from server
      router.refresh();
    } catch {
      toast.error("Failed to randomize all selections");
    }
  };

  // Reset all: personas, documents, and all parameters (clear URL params)
  const handleResetAll = () => {
    try {
      // Clear all URL params first - server will return defaults
      // Build URL updates - clear all params including ranges
      const urlUpdates: Record<string, string | null> = {
        departmentIds: null,
        personaIds: null,
        documentIds: null,
        parameterIds: null,
        fieldIds: null,
        personaSearch: null,
        documentSearch: null,
        parameterSearch: null,
        personaMin: null,
        personaMax: null,
        documentMin: null,
        documentMax: null,
        parameterSelectionMin: null,
        parameterSelectionMax: null,
        randomize: null,
      };

      // Clear all field range params for ALL parameters (including defaults)
      // Use parameterMapping (all parameters) not generalParameterMapping (filtered)
      // Also clear any fieldMin_* or fieldMax_* params that might exist in URL but not in current mapping
      Object.keys(parameterMapping).forEach((paramId) => {
        urlUpdates[`fieldMin_${paramId}`] = null;
        urlUpdates[`fieldMax_${paramId}`] = null;
      });

      // Also clear any fieldMin_* or fieldMax_* params from URL that we might have missed
      // This handles edge cases where params exist but aren't in current parameterMapping
      searchParams.forEach((_value, key) => {
        if (key.startsWith("fieldMin_") || key.startsWith("fieldMax_")) {
          urlUpdates[key] = null;
        }
      });

      // Set resetting flag to prevent buildSearchParams from interfering
      isResettingRef.current = true;

      // Update URL FIRST, then update state after URL update completes
      // This prevents buildSearchParams useEffect from re-adding params
      updateUrlParams(urlUpdates);

      // Update local state after URL update completes (next frame)
      // This ensures URL is cleared before state updates trigger buildSearchParams
      requestAnimationFrame(() => {
        // Reset all local state to defaults for instant UI feedback
        // Server response will sync these values properly via useEffect
        setPersonaMinMax({ min: 1, max: 1 });
        setDocumentMinMax({ min: 0, max: 1 });
        setParameterSelectionMinMax({ min: 0, max: 3 });

        // Reset field ranges to defaults for ALL parameters (including defaults)
        // Use parameterMapping (all parameters) not generalParameterMapping (filtered)
        const defaultFieldRanges: Record<string, { min: number; max: number }> =
          {};
        Object.keys(parameterMapping).forEach((paramId) => {
          defaultFieldRanges[paramId] = { min: 1, max: 3 };
        });
        setFieldMinMax(defaultFieldRanges);

        // Reset all search terms
        setPersonaSearchTerm("");
        setDocumentSearchTerm("");
        setParameterSearchTerm("");

        // Reset all selections
        setSelectedPersonaIds([]);
        setCurrentDocumentIds([]);
        setCurrentFieldIds([]);
        handleInputChange("parameterIds", []);

        // Refresh after state updates to get fresh server data
        // The useEffect at line 1695 will sync state from server response
        router.refresh();
        // Reset flag after refresh completes
        setTimeout(() => {
          isResettingRef.current = false;
        }, 200);
      });
      toast.success("All selections reset");
    } catch {
      isResettingRef.current = false;
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
    const maxObjectives = 3; // Hardcoded max of 3
    if (currentObjectives.length >= maxObjectives) {
      toast.error(`Maximum ${maxObjectives} objectives allowed`);
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

  // Question drag handlers
  const handleDragStartQuestion = (e: React.DragEvent, index: number) => {
    setDraggedQuestionIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOverQuestion = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDropQuestion = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedQuestionIndex === null) return;
    setQuestions((prev) => {
      const next = [...prev];
      const removed = next[draggedQuestionIndex];
      if (!removed) return next;
      next.splice(draggedQuestionIndex, 1);
      next.splice(targetIndex, 0, removed);
      return next;
    });
    setDraggedQuestionIndex(null);
  };

  // Option drag handlers
  const handleDragStartOption = (
    e: React.DragEvent,
    questionIndex: number,
    optionIndex: number
  ) => {
    setDraggedOptionIndex({ questionIndex, optionIndex });
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOverOption = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDropOption = (
    e: React.DragEvent,
    questionIndex: number,
    targetOptionIndex: number
  ) => {
    e.preventDefault();
    if (draggedOptionIndex === null) return;
    if (
      draggedOptionIndex.questionIndex !== questionIndex ||
      draggedOptionIndex.optionIndex === targetOptionIndex
    ) {
      setDraggedOptionIndex(null);
      return;
    }
    setQuestions((prev) => {
      const next = [...prev];
      const question = next[draggedOptionIndex.questionIndex];
      if (!question) return next;
      const options = [...question.options];
      const removed = options[draggedOptionIndex.optionIndex];
      if (!removed) return next;
      options.splice(draggedOptionIndex.optionIndex, 1);
      options.splice(targetOptionIndex, 0, removed);
      next[draggedOptionIndex.questionIndex] = {
        ...question,
        options,
      };
      return next;
    });
    setDraggedOptionIndex(null);
  };

  // Question update handlers
  const handleUpdateQuestion = (
    index: number,
    question: {
      id: string;
      question_text: string;
      allow_multiple: boolean;
      options: Array<{
        id: string;
        option_text: string;
        type?: "discrete" | "freeform";
        is_correct: boolean;
      }>;
      times?: number[];
    }
  ) => {
    setQuestions((prev) => {
      const next = [...prev];
      next[index] = question;
      return next;
    });
  };

  const handleQuestionTimesChange = (index: number, times: number[]) => {
    setQuestions((prev) => {
      const next = [...prev];
      const question = next[index];
      if (!question) return next;
      next[index] = {
        ...question,
        times,
      };
      return next;
    });
  };

  // Option management handlers
  const handleAddOption = (questionIndex: number) => {
    setQuestions((prev) => {
      const next = [...prev];
      const question = next[questionIndex];
      if (!question) return next;
      next[questionIndex] = {
        ...question,
        options: [
          ...question.options,
          {
            id: "",
            option_text: "",
            type: "discrete",
            is_correct: false,
          },
        ],
      };
      return next;
    });
  };

  const handleRemoveOption = (questionIndex: number, optionIndex: number) => {
    setQuestions((prev) => {
      const next = [...prev];
      const question = next[questionIndex];
      if (!question) return next;
      next[questionIndex] = {
        ...question,
        options: question.options.filter((_, i) => i !== optionIndex),
      };
      return next;
    });
  };

  const handleOptionChange = (
    questionIndex: number,
    optionIndex: number,
    option: {
      id: string;
      option_text: string;
      type?: "discrete" | "freeform";
      is_correct: boolean;
    }
  ) => {
    setQuestions((prev) => {
      const next = [...prev];
      const question = next[questionIndex];
      if (!question) return next;
      const options = [...question.options];
      const existingOption = options[optionIndex];
      if (!existingOption) return next;
      options[optionIndex] = option;
      next[questionIndex] = {
        ...question,
        options,
      };
      return next;
    });
  };

  const handleToggleOptionCorrect = (
    questionIndex: number,
    optionIndex: number
  ) => {
    setQuestions((prev) => {
      const next = [...prev];
      const question = next[questionIndex];
      if (!question) return next;
      const options = [...question.options];
      const existingOption = options[optionIndex];
      if (!existingOption) return next;
      options[optionIndex] = {
        ...existingOption,
        is_correct: !existingOption.is_correct,
      };
      next[questionIndex] = {
        ...question,
        options,
      };
      return next;
    });
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
        objectivesEnabled: useObjectives,
        imagesEnabled: useImage,
        videoEnabled: useVideo,
        questionsEnabled: useQuestions,
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
        description?: string | null;
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
        video_enabled?: boolean;
        questions_enabled?: boolean;
        video_agent_id?: string | null;
        video_ids?: string[] | null;
        active_video_id?: string | null;
        question_ids?: string[] | null;
        question_timestamps?: Record<string, Record<string, number[]>> | null;
      } = {
        name: formData.name?.trim() || "",
        description: scenarioData && typeof scenarioData === "object" && "description" in scenarioData ? (scenarioData as { description?: string | null }).description ?? null : null,
        problem_statement: formData.problemStatement?.trim() || "",
        department_ids: finalDepartmentIds,
        active: formData.active ?? true,
        persona_ids: selectedPersonaIds.length > 0 ? selectedPersonaIds : null,
        document_ids: currentDocumentIds,
        template_document_ids:
          templateDocumentIds.length > 0 ? templateDocumentIds : null,
        objective_ids: currentObjectives.filter((obj) => obj.trim()), // Send raw objective text
        upload_ids: image?.upload_id ? [image.upload_id] : null,
        image_names: image?.name ? [image.name] : null,
        parameters: parametersDict,
        scenario_agent_id: formData.scenarioAgentId || null,
        image_agent_id: formData.imageAgentId || null,
        video_enabled: useVideo,
        questions_enabled: useQuestions,
        video_agent_id: formData.videoAgentId || null,
        video_ids: selectedVideo ? [selectedVideo.id] : null,
        active_video_id: activeVideoId || null,
        question_ids: currentQuestionIds.length > 0 ? currentQuestionIds : null,
        question_timestamps:
          questions.length > 0 && selectedVideo
            ? questions.reduce(
                (acc, q) => {
                  if (q.times && q.times.length > 0) {
                    acc[q.id] = { [selectedVideo.id]: q.times };
                  }
                  return acc;
                },
                {} as Record<string, Record<string, number[]>>
              )
            : null,
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
          await handleUpdateScenario({
            scenarioId: scenarioId!,
            ...payload,
            objectives_enabled: useObjectives,
            images_enabled: useImage,
            video_enabled: useVideo,
            questions_enabled: useQuestions,
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
          await handleCreateScenario({
            ...payload,
            objectives_enabled: useObjectives,
            images_enabled: useImage,
            video_enabled: useVideo,
            questions_enabled: useQuestions,
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
          videoAgentId={formData.videoAgentId}
          validAgentIds={scenarioData?.valid_agent_ids || []}
          agentMapping={agentMapping}
          active={formData.active ?? true}
          useVideo={useVideo}
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
          onVideoAgentIdChange={(id) =>
            setFormData((prev) => ({ ...prev, videoAgentId: id }))
          }
          onActiveChange={(active) => handleInputChange("active", active)}
          onUseVideoChange={(enabled) => {
            setUseVideo(enabled);
            if (!enabled) {
              setSelectedVideo(null);
              setActiveVideoId(null);
              setUseQuestions(false);
            }
          }}
          onRandomizeAll={handleRandomizeAll}
          onResetAll={handleResetAll}
          isReadonly={isReadonly}
        />
        {/* Step 2: Persona Selection */}
        <PersonaSection
          validPersonaIds={validPersonaIds}
          personaMapping={personaMapping}
          selectedPersonaIds={selectedPersonaIds}
          searchTerm={personaSearchTerm}
          minMax={personaMinMax}
          allowedRange={
            scenarioData?.allowed_ranges?.persona
              ? {
                  min: scenarioData.allowed_ranges.persona.min,
                  max: scenarioData.allowed_ranges.persona.max,
                }
              : undefined
          }
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
          disabled={isPending}
          isRandomizing={
            randomizingSection === "persona" || randomizingSection === "all"
          }
          isEditMode={isEditMode}
        />

        {/* Step 3: Documents */}
        <DocumentSection
          validDocumentIds={validDocumentIds}
          documentMapping={documentMapping}
          selectedDocumentIds={currentDocumentIds}
          templateDocumentIds={templateDocumentIds}
          {...(scenarioData?.document_details
            ? {
                documentDetails: scenarioData.document_details as Array<{
                  document_id: string;
                  name: string;
                  updatedAt: string;
                  extension: string;
                  scenario_ids: string[];
                  can_edit: boolean;
                  can_delete: boolean;
                  active: boolean;
                  department_ids: string[] | null;
                  upload_id: string | null;
                  field_ids: string[];
                }>,
              }
            : {})}
          searchTerm={documentSearchTerm}
          minMax={documentMinMax}
          {...(scenarioData?.allowed_ranges?.document
            ? {
                allowedRange: {
                  min: scenarioData.allowed_ranges.document.min,
                  max: scenarioData.allowed_ranges.document.max,
                },
              }
            : {})}
          previewDocumentId={previewDocumentId}
          onDocumentIdsChange={setCurrentDocumentIds}
          onTemplateDocumentIdsChange={setTemplateDocumentIds}
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
          isRandomizing={
            randomizingSection === "document" || randomizingSection === "all"
          }
          isEditMode={isEditMode}
        />

        {/* Step 4: Parameters */}
        <ParameterSection
          validParameterIds={scenarioData?.valid_parameter_ids || []}
          parameterMapping={parameterMapping}
          selectedParameterIds={formData.parameterIds || []}
          searchTerm={parameterSearchTerm}
          minMax={parameterSelectionMinMax}
          allowedRange={
            scenarioData?.allowed_ranges?.parameter_selection
              ? {
                  min: scenarioData.allowed_ranges.parameter_selection.min,
                  max: scenarioData.allowed_ranges.parameter_selection.max,
                }
              : undefined
          }
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
          isRandomizing={
            randomizingSection === "parameters" || randomizingSection === "all"
          }
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
                minMax={
                  fieldMinMax[paramId] ||
                  scenarioData?.allowed_ranges?.fields?.[paramId] || {
                    min: 1,
                    max: 3,
                  }
                }
                allowedRange={
                  scenarioData?.allowed_ranges?.fields?.[paramId]
                    ? {
                        min: scenarioData.allowed_ranges.fields[paramId].min,
                        max: scenarioData.allowed_ranges.fields[paramId].max,
                      }
                    : undefined
                }
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
                isRandomizing={
                  randomizingSection === `parameter_${paramId}` ||
                  randomizingSection === "all"
                }
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
              {...(selectedProblemStatementId
                ? { selectedProblemStatementId }
                : {})}
              hasProblemStatementChanges={hasProblemStatementChanges}
              originalProblemStatement={
                originalFormData?.problemStatement || ""
              }
              objectives={currentObjectives}
              objectivesHistory={objectivesHistory}
              useObjectives={useObjectives}
              onUseObjectivesChange={(enabled) => {
                setUseObjectives(enabled);
                if (enabled) {
                  // Automatically add one objective if none exist
                  if (currentObjectives.length === 0) {
                    setCurrentObjectives([""]);
                  }
                } else {
                  setCurrentObjectives([]);
                }
              }}
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
              templateDocumentIds={filteredTemplateDocumentIds}
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
              useVideo={useVideo}
              selectedVideo={selectedVideo}
              videoMapping={videoMapping}
              activeVideoId={activeVideoId}
              onUseVideoChange={(enabled) => {
                setUseVideo(enabled);
                if (!enabled) {
                  setSelectedVideo(null);
                  setActiveVideoId(null);
                  setUseQuestions(false);
                }
              }}
              onVideoSelect={(video) => {
                setSelectedVideo(video);
                setActiveVideoId(video?.id || null);
              }}
              useQuestions={useQuestions}
              questions={questions}
              currentQuestionIds={currentQuestionIds}
              onUseQuestionsChange={(enabled) => {
                setUseQuestions(enabled);
                if (enabled) {
                  // Automatically add one question if none exist
                  if (questions.length === 0) {
                    setQuestions([
                      {
                        id: "",
                        question_text: "",
                        allow_multiple: false,
                        options: [
                          {
                            id: "",
                            option_text: "",
                            type: "discrete",
                            is_correct: false,
                          },
                          {
                            id: "",
                            option_text: "",
                            type: "discrete",
                            is_correct: false,
                          },
                        ],
                        times: [],
                      },
                    ]);
                  }
                } else {
                  setQuestions([]);
                  setCurrentQuestionIds([]);
                }
              }}
              onQuestionsChange={(newQuestions) => {
                setQuestions(newQuestions);
                setCurrentQuestionIds(newQuestions.map((q) => q.id));
              }}
              onDragStartQuestion={handleDragStartQuestion}
              onDragOverQuestion={handleDragOverQuestion}
              onDropQuestion={handleDropQuestion}
              onDragStartOption={handleDragStartOption}
              onDragOverOption={handleDragOverOption}
              onDropOption={handleDropOption}
              onUpdateQuestion={handleUpdateQuestion}
              onQuestionTimesChange={handleQuestionTimesChange}
              onAddOption={handleAddOption}
              onRemoveOption={handleRemoveOption}
              onOptionChange={handleOptionChange}
              onToggleOptionCorrect={handleToggleOptionCorrect}
              draggedQuestionIndex={draggedQuestionIndex}
              draggedOptionIndex={draggedOptionIndex}
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
