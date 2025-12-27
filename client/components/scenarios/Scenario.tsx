/**
 * Scenario.tsx
 * Progressive step-by-step scenario creation flow
 * @AshokSaravanan222 & @siladiea
 * 05/20/2025
 */
"use client";
import {
  parseJsonDict,
  scenarioSearchParamsClient,
  stringifyJsonDict,
} from "@/app/(main)/create/scenarios/searchParams";
import { Loader2, RotateCcw } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQueryStates } from "nuqs";
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
import { ContentSection } from "@/components/scenarios/ContentSection";
import { DocumentSection } from "@/components/scenarios/DocumentSection";
import { ParameterItemSection } from "@/components/scenarios/ParameterItemSection";
import { ParameterSection } from "@/components/scenarios/ParameterSection";
import { PersonaSection } from "@/components/scenarios/PersonaSection";
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

  // URL-backed state using nuqs (replaces manual useState + updateUrlParams)
  const [q, setQ] = useQueryStates(scenarioSearchParamsClient, {
    history: "replace", // Don't spam back button for every keystroke
    shallow: false, // Trigger server-side re-fetch when params change
  });

  // Use server-provided data directly (no fallback needed - server pages always provide data)
  const scenarioDetail = serverScenarioDetail;
  const scenarioDetailDefault = serverScenarioDetailDefault;

  // Use edit detail when editing, default detail when creating
  const scenarioData = isEditMode ? scenarioDetail : scenarioDetailDefault;

  // Centralized query parameter configuration (DHH-style: URL as source of truth)
  // Only include params in URL when they differ from defaults
  const queryParamConfig = useMemo(() => {
    const serverCurrentValues = scenarioData as
      | (ScenarioNewOut & {
          objectives_enabled?: boolean;
          images_enabled?: boolean;
          video_enabled?: boolean;
          questions_enabled?: boolean;
        })
      | undefined;

    // Default values (from server defaults)
    const defaults = {
      objectives_enabled: true,
      images_enabled: false,
      video_enabled: false,
      questions_enabled: false,
    };

    // Get current server values (edit mode) or defaults (create mode)
    const getServerValue = (
      field:
        | "objectives_enabled"
        | "images_enabled"
        | "video_enabled"
        | "questions_enabled"
    ): boolean => {
      if (isEditMode && serverCurrentValues) {
        // Edit mode: compare against server's current value
        if (field === "images_enabled") {
          return (
            (serverCurrentValues as ScenarioNewOut).image_input_enabled ??
            defaults[field]
          );
        }
        return serverCurrentValues[field] ?? defaults[field];
      }
      // Create mode: compare against defaults
      return defaults[field];
    };

    return {
      defaults,
      getServerValue,
      urlParamNames: {
        objectives_enabled: "useObjectives",
        images_enabled: "useImage",
        video_enabled: "useVideo",
        questions_enabled: "useQuestions",
      },
    };
  }, [scenarioData, isEditMode]);

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
    const isRegenerating = !!problemStatement?.trim();
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
          updateProblemStatementIds((prev) => {
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
          updateObjectiveIds(data.objective_ids);
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
            updateDocumentIds((prev) => {
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
            updateDocumentIds((prev) => {
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
      socket.on(
        "scenarios_tools_objectives_complete",
        handleObjectivesComplete
      );
      socket.on("scenarios_tools_document_complete", handleDocumentComplete);
      socket.on("scenarios_tools_image_complete", handleImageComplete);

      // eslint-disable-next-line no-console
      console.log(
        "[Scenario] Registered WebSocket event listeners for scenario generation"
      );

      // Emit the event
      // scenarioAgentId is required - UI filters and selects appropriate agent for scenario generation
      if (!basicInfoState.scenarioAgentId) {
        toast.error("Please select a scenario agent before generating");
        reject(new Error("Scenario agent ID is required"));
        return;
      }

      socket.emit("generate_scenario", {
        departmentId: body.departmentId,
        scenarioAgentId: basicInfoState.scenarioAgentId, // Required: selected scenario agent ID
        imageAgentId: basicInfoState.imageAgentId || undefined, // Optional: selected image agent ID
        videoAgentId: basicInfoState.videoAgentId || undefined, // Optional: selected video agent ID
        personaIds: body.personaIds,
        documentIds: body.documentIds,
        fieldIds: body.fieldIds, // Renamed from parameterItemIds
        profileId: body.profileId,
        scenarioId: scenarioId || undefined, // Pass scenarioId if in edit mode
        imagesEnabled: useImage,
        videoEnabled: useVideo,
        objectivesEnabled: useObjectives,
        questionsEnabled: useQuestions,
        videoLength: selectedVideoLength || undefined,
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

  const initialFormData = useMemo(() => {
    return {
      departmentIds: defaultDepartmentIds,
      parameterIds: [] as string[], // Empty means "all parameters"
    };
  }, [defaultDepartmentIds]);

  // State for basic info section (agents and active)
  const [basicInfoState, setBasicInfoState] = useState<{
    scenarioAgentId: string | null;
    imageAgentId: string | null;
    videoAgentId: string | null;
    active: boolean;
  }>({
    scenarioAgentId: null,
    imageAgentId: null,
    videoAgentId: null,
    active: true,
  });

  // Derived values from nuqs (name and problemStatement now managed by nuqs)
  const name = q.name ?? "New Scenario";
  const problemStatement = q.problemStatement ?? "";

  const [formData, setFormData] = useState(initialFormData);

  // Track if form data has been initialized from scenarioData to prevent resetting user changes
  const formDataInitializedRef = useRef<boolean>(false);

  // Event handler for form input changes (defined early for use in useEffect)
  const handleInputChange = useCallback(
    (field: string, value: string | string[] | boolean | null) => {
      // Handle name and problemStatement via nuqs
      if (field === "name") {
        setQ({ name: (value as string) || null });
      } else if (field === "problemStatement") {
        setQ({ problemStatement: (value as string) || null });
      } else {
        setFormData((prev) => ({ ...prev, [field]: value }));
      }
    },
    [setQ]
  );

  // URL-backed state is now managed by nuqs (q object above)
  // Extract values with defaults for easier use
  const personaSearchTerm = q.personaSearch ?? "";
  const documentSearchTerm = q.documentSearch ?? "";
  const parameterSearchTerm = q.parameterSearch ?? "";
  const documentShowSelected = q.documentShowSelected ?? false;
  const documentShowTemplate = q.documentShowTemplate ?? false;
  const personaShowSelected = q.personaShowSelected ?? false;
  const parameterShowSelected = q.parameterShowSelected ?? false;

  // Derived from URL params (arrays) - memoized to prevent unnecessary re-renders
  const selectedPersonaIds = useMemo(() => q.personaIds ?? [], [q.personaIds]);
  const currentDocumentIds = useMemo(
    () => q.documentIds ?? [],
    [q.documentIds]
  );
  const templateDocumentIds = useMemo(
    () => q.templateDocumentIds ?? [],
    [q.templateDocumentIds]
  );
  const currentFieldIds = useMemo(() => q.fieldIds ?? [], [q.fieldIds]);
  const currentProblemStatementIds = useMemo(
    () => q.problemStatementIds ?? [],
    [q.problemStatementIds]
  );
  const currentObjectiveIds = useMemo(
    () => q.objectiveIds ?? [],
    [q.objectiveIds]
  );

  // Derived from URL params (JSON-encoded dicts)
  const fieldShowSelectedByParam = useMemo(
    () => parseJsonDict(q.fieldShowSelected, {}),
    [q.fieldShowSelected]
  );
  const fieldMinMax = useMemo(
    () =>
      parseJsonDict<Record<string, { min: number; max: number }>>(
        q.fieldRanges,
        {}
      ),
    [q.fieldRanges]
  );
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
  // URL-backed flags (now managed by nuqs)
  const useObjectives = q.useObjectives ?? false;
  const useImage = q.useImage ?? false;
  const useVideo = q.useVideo ?? false;
  const useQuestions = q.useQuestions ?? false;
  const useProblemStatement = q.useProblemStatement ?? false;

  // Video length - now managed by nuqs
  const selectedVideoLength = q.videoLength ?? null;

  // State for junction data (managed separately from scenario)
  // Objectives now managed by nuqs
  const currentObjectives = useMemo(() => {
    if (q.objectives) {
      try {
        const parsed = JSON.parse(q.objectives);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      } catch {
        // Invalid JSON - ignore, use empty array
      }
    }
    return [];
  }, [q.objectives]);
  // State for content section (image, video, questions, objectives)
  const [contentState, setContentState] = useState<{
    image: { id: string; name: string; upload_id: string } | null;
    selectedVideo: {
      id: string;
      name: string;
      length_seconds: number;
      upload_id?: string;
    } | null;
    activeVideoId: string | null;
    questions: Array<{
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
    }>;
    currentQuestionIds: string[];
    objectives: string[];
    scenarioPreviewDocumentId: string | null;
  }>({
    image: null,
    selectedVideo: null,
    activeVideoId: null,
    questions: [],
    currentQuestionIds: [],
    objectives: [],
    scenarioPreviewDocumentId: null,
  });

  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Use transition for smooth UI updates during randomization
  // This ensures the old UI stays visible while new randomized selections are being applied
  const [isPending, startTransition] = useTransition();

  // Track which section is currently being randomized for loading indicators
  const [randomizingSection, setRandomizingSection] = useState<
    "persona" | "document" | "parameters" | `parameter_${string}` | "all" | null
  >(null);

  // Min/max state for randomization (URL-backed via nuqs, fallback to server values)
  // Initialize from URL params, fallback to server's current values
  const personaMinMax = useMemo(() => {
    if (q.personaMin !== null && q.personaMax !== null) {
      return { min: q.personaMin, max: q.personaMax };
    }
    // Fallback to server values
    if (scenarioData && "persona_min" in scenarioData) {
      const newData = scenarioData as ScenarioNewOut;
      return {
        min: newData.persona_min ?? 1,
        max: newData.persona_max ?? 1,
      };
    }
    return { min: 1, max: 1 };
  }, [q.personaMin, q.personaMax, scenarioData]);

  const documentMinMax = useMemo(() => {
    if (q.documentMin !== null && q.documentMax !== null) {
      return { min: q.documentMin, max: q.documentMax };
    }
    // Fallback to server values
    if (scenarioData && "document_min" in scenarioData) {
      const newData = scenarioData as ScenarioNewOut;
      return {
        min: newData.document_min ?? 0,
        max: newData.document_max ?? 1,
      };
    }
    return { min: 0, max: 1 };
  }, [q.documentMin, q.documentMax, scenarioData]);

  const parameterSelectionMinMax = useMemo(() => {
    if (q.parameterSelectionMin !== null && q.parameterSelectionMax !== null) {
      return { min: q.parameterSelectionMin, max: q.parameterSelectionMax };
    }
    // Fallback to server values
    if (scenarioData && "parameter_selection_min" in scenarioData) {
      const newData = scenarioData as ScenarioNewOut;
      return {
        min: newData.parameter_selection_min ?? 0,
        max: newData.parameter_selection_max ?? 3,
      };
    }
    const ranges = scenarioData?.allowed_ranges;
    return ranges?.parameter_selection
      ? {
          min: ranges.parameter_selection.min,
          max: ranges.parameter_selection.max,
        }
      : { min: 0, max: 3 };
  }, [q.parameterSelectionMin, q.parameterSelectionMax, scenarioData]);
  // fieldMinMax is now derived from URL params above

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

  // Build mappings from arrays (arrays are now the source of truth)
  const fieldMapping = useMemo(() => {
    const data = scenarioData as any;
    const map: Record<string, any> = {};
    if (data?.fields && Array.isArray(data.fields)) {
      data.fields.forEach((f: any) => {
        if (f.field_id) {
          map[String(f.field_id)] = {
            name: f.name || "",
            description: f.description || "",
            parameter_id: f.parameter_id ? String(f.parameter_id) : "",
            parameter_name: f.parameter_name || "",
            conditional_parameter_ids:
              f.conditional_parameter_ids?.map((id: any) => String(id)) || [],
          };
        }
      });
    }
    return map;
  }, [scenarioData]);

  // Helper to get objective mapping from arrays
  const getObjectiveMapping = useMemo(() => {
    const map: Record<string, { name: string }> = {};
    const data = scenarioData as any;
    if (data?.objectives && Array.isArray(data.objectives)) {
      data.objectives.forEach((obj: any) => {
        if (obj.objective_id) {
          map[String(obj.objective_id)] = {
            name: obj.name || obj.description || "",
          };
        }
      });
    }
    return map;
  }, [scenarioData]);

  // Helper functions to update URL-backed state via setQ
  const updatePersonaIds = useCallback(
    (ids: string[] | ((prev: string[]) => string[])) => {
      const newIds = typeof ids === "function" ? ids(selectedPersonaIds) : ids;
      setQ({ personaIds: newIds.length > 0 ? newIds : null });
    },
    [selectedPersonaIds, setQ]
  );

  const updateDocumentIds = useCallback(
    (ids: string[] | ((prev: string[]) => string[])) => {
      const newIds = typeof ids === "function" ? ids(currentDocumentIds) : ids;
      setQ({ documentIds: newIds.length > 0 ? newIds : null });
    },
    [currentDocumentIds, setQ]
  );

  const updateTemplateDocumentIds = useCallback(
    (ids: string[] | ((prev: string[]) => string[])) => {
      const newIds = typeof ids === "function" ? ids(templateDocumentIds) : ids;
      setQ({ templateDocumentIds: newIds.length > 0 ? newIds : null });
    },
    [templateDocumentIds, setQ]
  );

  const updateFieldIds = useCallback(
    (ids: string[] | ((prev: string[]) => string[])) => {
      const newIds = typeof ids === "function" ? ids(currentFieldIds) : ids;
      setQ({ fieldIds: newIds.length > 0 ? newIds : null });
    },
    [currentFieldIds, setQ]
  );

  const updateProblemStatementIds = useCallback(
    (ids: string[] | ((prev: string[]) => string[])) => {
      const newIds =
        typeof ids === "function" ? ids(currentProblemStatementIds) : ids;
      setQ({ problemStatementIds: newIds.length > 0 ? newIds : null });
    },
    [currentProblemStatementIds, setQ]
  );

  const updateObjectiveIds = useCallback(
    (ids: string[] | ((prev: string[]) => string[])) => {
      const newIds = typeof ids === "function" ? ids(currentObjectiveIds) : ids;
      setQ({ objectiveIds: newIds.length > 0 ? newIds : null });
    },
    [currentObjectiveIds, setQ]
  );

  // Helper to update objectives (JSON-encoded array) via nuqs
  const updateObjectives = useCallback(
    (objectives: string[] | ((prev: string[]) => string[])) => {
      const newObjectives =
        typeof objectives === "function"
          ? objectives(currentObjectives)
          : objectives;
      const objectivesJson = JSON.stringify(newObjectives);
      setQ({ objectives: objectivesJson || null });
    },
    [currentObjectives, setQ]
  );

  // Helper to update videoLength via nuqs
  const updateVideoLength = useCallback(
    (length: number | null) => {
      // Validate length is 4, 8, or 12, or null
      if (length !== null && ![4, 8, 12].includes(length)) {
        return;
      }
      setQ({ videoLength: length });
    },
    [setQ]
  );

  const updateFieldShowSelected = useCallback(
    (
      value:
        | Record<string, boolean>
        | ((prev: Record<string, boolean>) => Record<string, boolean>)
    ) => {
      const newValue =
        typeof value === "function" ? value(fieldShowSelectedByParam) : value;
      setQ({
        fieldShowSelected: stringifyJsonDict(newValue) || null,
      });
    },
    [fieldShowSelectedByParam, setQ]
  );

  const updateFieldRanges = useCallback(
    (
      value:
        | Record<string, { min: number; max: number }>
        | ((
            prev: Record<string, { min: number; max: number }>
          ) => Record<string, { min: number; max: number }>)
    ) => {
      const newValue = typeof value === "function" ? value(fieldMinMax) : value;
      setQ({
        fieldRanges: stringifyJsonDict(newValue) || null,
      });
    },
    [fieldMinMax, setQ]
  );

  // Helper function to build search params including filters, search terms, ranges, and randomize param
  const buildSearchParams = useCallback(() => {
    const params = new URLSearchParams();

    // Add filter params (always include if non-empty)
    // Arrays are handled by nuqs automatically, but we still need to set them for URLSearchParams
    // Note: This function is used for manual URL building, nuqs handles arrays automatically
    if (formData.departmentIds && formData.departmentIds.length > 0) {
      // nuqs will handle array serialization
      formData.departmentIds.forEach((id) => {
        params.append("departmentIds", id);
      });
    }
    if (selectedPersonaIds.length > 0) {
      selectedPersonaIds.forEach((id) => {
        params.append("personaIds", id);
      });
    }
    if (currentDocumentIds.length > 0) {
      currentDocumentIds.forEach((id) => {
        params.append("documentIds", id);
      });
    }
    if (templateDocumentIds.length > 0) {
      templateDocumentIds.forEach((id) => {
        params.append("templateDocumentIds", id);
      });
    }
    if (formData.parameterIds && formData.parameterIds.length > 0) {
      formData.parameterIds.forEach((id) => {
        params.append("parameterIds", id);
      });
    }
    if (currentFieldIds.length > 0) {
      currentFieldIds.forEach((id) => {
        params.append("fieldIds", id);
      });
    }
    if (currentProblemStatementIds.length > 0) {
      currentProblemStatementIds.forEach((id) => {
        params.append("problemStatementIds", id);
      });
    }
    if (currentObjectiveIds.length > 0) {
      currentObjectiveIds.forEach((id) => {
        params.append("objectiveIds", id);
      });
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

    // Add filter params when true (omit when false, following boolean flag pattern)
    if (documentShowSelected) {
      params.set("documentShowSelected", "true");
    }
    if (documentShowTemplate) {
      params.set("documentShowTemplate", "true");
    }
    if (personaShowSelected) {
      params.set("personaShowSelected", "true");
    }
    if (parameterShowSelected) {
      params.set("parameterShowSelected", "true");
    }
    // Add per-parameter field filters (JSON-encoded dict)
    const fieldShowSelectedJson = stringifyJsonDict(fieldShowSelectedByParam);
    if (fieldShowSelectedJson) {
      params.set("fieldShowSelected", fieldShowSelectedJson);
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

    // Build filtered ranges dict (only include ranges that differ from server or are needed for randomization)
    const filteredFieldRanges: Record<string, { min: number; max: number }> =
      {};
    Object.entries(fieldMinMax).forEach(([paramId, range]) => {
      // Include range if:
      // 1. Parameter is selected, OR
      // 2. We're randomizing all (server will randomize parameters and need these ranges)
      // AND range differs from server's current value
      const shouldInclude = isRandomizing || selectedParamIds.includes(paramId);
      const serverFieldRange = serverFieldRanges[paramId] as
        | { min?: number; max?: number }
        | undefined;
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
        filteredFieldRanges[paramId] = range;
      }
    });

    // Add field ranges as JSON-encoded dict
    const fieldRangesJson = stringifyJsonDict(filteredFieldRanges);
    if (fieldRangesJson) {
      params.set("fieldRanges", fieldRangesJson);
    }

    // Feature flags - compare against server's current values (edit mode) or defaults (create mode)
    // Objectives flag - always include when true to preserve user intent, only include false if it differs from default
    if (useObjectives) {
      params.set(queryParamConfig.urlParamNames.objectives_enabled, "true");
    } else {
      // Only include false if it differs from the default (for edit mode when server value was true)
      const serverObjectivesEnabled =
        queryParamConfig.getServerValue("objectives_enabled");
      if (useObjectives !== serverObjectivesEnabled) {
        params.set(queryParamConfig.urlParamNames.objectives_enabled, "false");
      }
    }

    const serverImageEnabled =
      queryParamConfig.getServerValue("images_enabled");
    if (useImage !== serverImageEnabled) {
      params.set(
        queryParamConfig.urlParamNames.images_enabled,
        useImage ? "true" : "false"
      );
    }

    const serverVideoEnabled = queryParamConfig.getServerValue("video_enabled");
    if (useVideo !== serverVideoEnabled) {
      params.set(
        queryParamConfig.urlParamNames.video_enabled,
        useVideo ? "true" : "false"
      );
    }

    const serverQuestionsEnabled =
      queryParamConfig.getServerValue("questions_enabled");
    if (useQuestions !== serverQuestionsEnabled) {
      params.set(
        queryParamConfig.urlParamNames.questions_enabled,
        useQuestions ? "true" : "false"
      );
    }

    // Problem statement flag - no server-side enabled flag, so only include when true
    if (useProblemStatement) {
      params.set("useProblemStatement", "true");
    }

    // Add text fields when they differ from server values
    // Problem statement text (now managed by nuqs)
    const serverProblemStatement =
      isEditMode && scenarioData && "problem_statement" in scenarioData
        ? (scenarioData as ScenarioDetailOut).problem_statement || ""
        : "";
    if (
      problemStatement &&
      problemStatement.trim() !== "" &&
      problemStatement.trim() !== serverProblemStatement
    ) {
      params.set("problemStatement", problemStatement);
    }

    // Objectives text (JSON-encoded array, now managed by nuqs)
    // Include all objectives (even empty strings) to preserve the count of enabled objective slots
    const serverObjectives =
      isEditMode && scenarioData && "objectives_history" in scenarioData
        ? (scenarioData as ScenarioDetailOut).objectives_history?.map(
            (obj) => obj.objective
          ) || []
        : [];
    const currentObjectivesString = JSON.stringify(currentObjectives);
    const serverObjectivesString = JSON.stringify(serverObjectives);
    // Always include objectives if they differ from server (even if empty strings - preserves count)
    if (currentObjectivesString !== serverObjectivesString) {
      params.set("objectives", currentObjectivesString);
    }

    // Name text (now managed by nuqs)
    const serverName =
      isEditMode && scenarioData && "name" in scenarioData
        ? (scenarioData as ScenarioDetailOut).name || ""
        : "New Scenario";
    if (
      name &&
      name.trim() !== "" &&
      name !== "New Scenario" &&
      name !== serverName
    ) {
      params.set("name", name);
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
    documentShowSelected,
    documentShowTemplate,
    personaShowSelected,
    parameterShowSelected,
    fieldShowSelectedByParam,
    personaMinMax,
    documentMinMax,
    parameterSelectionMinMax,
    fieldMinMax,
    useObjectives, // Include useObjectives for objectives flag
    useImage, // Include useImage for useImage flag
    useVideo, // Include useVideo for video flag
    useQuestions, // Include useQuestions for questions flag
    useProblemStatement, // Include useProblemStatement for problem statement flag
    queryParamConfig, // Include queryParamConfig for server value comparisons
    // searchParams is used to check if randomize=all - only used for conditional, won't cause loops
    searchParams,
    // Text fields for URL sync (now managed by nuqs)
    problemStatement,
    currentObjectives,
    name,
    isEditMode,
  ]);

  // Convert arrays to lookup maps for performance (prefer arrays, fallback to mappings for backward compatibility)
  const personaMapping = useMemo(() => {
    // Prefer arrays (new format) - use type assertion since types may not be updated yet
    const data = scenarioData as any;
    if (
      data?.personas &&
      Array.isArray(data.personas) &&
      data.personas.length > 0
    ) {
      const map: Record<string, any> = {};
      data.personas.forEach((p: any) => {
        if (p.persona_id) {
          map[String(p.persona_id)] = {
            name: p.name || "",
            description: p.description || "",
            color: p.color || "",
            icon: p.icon || "",
            image_model: p.image_model || false,
            parameter_ids: p.parameter_ids?.map((id: any) => String(id)) || [],
            field_ids: p.field_ids?.map((id: any) => String(id)) || [],
            example: p.example,
          };
        }
      });
      return map;
    }
    // Fallback to mapping (backward compatibility)
    return data?.persona_mapping || {};
  }, [scenarioData]);

  const documentMapping = useMemo((): Record<string, DocumentMappingItem> => {
    // Use arrays directly (server is source of truth - arrays are guaranteed)
    const data = scenarioData as any;
    const documents = data?.documents || [];
    const map: Record<string, DocumentMappingItem> = {};
    if (Array.isArray(documents)) {
      documents.forEach((d: any) => {
        if (d.document_id) {
          map[String(d.document_id)] = {
            name: d.name || "",
            description: d.description || "",
            filePath: d.file_path || null,
            mimeType: d.mime_type || null,
            parameter_ids: d.parameter_ids?.map((id: any) => String(id)) || [],
            field_ids: d.field_ids?.map((id: any) => String(id)) || [],
            parent_document_id: d.parent_document_id
              ? String(d.parent_document_id)
              : null,
          };
        }
      });
    }
    return map;
  }, [scenarioData]);

  const parameterMapping = useMemo(() => {
    // Use arrays directly (server is source of truth - arrays are guaranteed)
    const data = scenarioData as any;
    const parameters = data?.parameters || [];
    const map: Record<string, any> = {};
    if (Array.isArray(parameters)) {
      parameters.forEach((p: any) => {
        if (p.parameter_id) {
          map[String(p.parameter_id)] = {
            name: p.name || "",
            description: p.description || "",
            numerical: false,
            document_parameter: p.document_parameter || false,
            persona_parameter: p.persona_parameter || false,
            scenario_parameter: p.scenario_parameter || false,
            video_parameter: p.video_parameter || false,
          };
        }
      });
    }
    return map;
  }, [scenarioData]);

  // fieldMapping is defined above (before buildSearchParams) so it can be used there
  const simulationMapping = useMemo(() => {
    // Use arrays directly (server is source of truth - arrays are guaranteed)
    const data = scenarioData as any;
    const simulations = data?.simulations || [];
    const map: Record<string, any> = {};
    if (Array.isArray(simulations)) {
      simulations.forEach((s: any) => {
        if (s.simulation_id) {
          map[String(s.simulation_id)] = {
            name: s.name || "",
            description: s.description || "",
            time_limit: s.time_limit,
            department_ids:
              s.department_ids?.map((id: any) => String(id)) || [],
          };
        }
      });
    }
    return map;
  }, [scenarioData]);

  const departmentMapping = useMemo(() => {
    // Use arrays directly (server is source of truth - arrays are guaranteed)
    const data = scenarioData as any;
    const departments = data?.departments || [];
    const map: Record<string, any> = {};
    if (Array.isArray(departments)) {
      departments.forEach((d: any) => {
        if (d.department_id) {
          map[String(d.department_id)] = {
            name: d.name || "",
            description: d.description || "",
            persona_ids: d.persona_ids?.map((id: any) => String(id)) || [],
            document_ids: d.document_ids?.map((id: any) => String(id)) || [],
            parameter_ids: d.parameter_ids?.map((id: any) => String(id)) || [],
            parameter_item_ids: d.field_ids?.map((id: any) => String(id)) || [],
          };
        }
      });
    }
    return map;
  }, [scenarioData]);

  const agentMapping = useMemo(() => {
    // Use arrays directly (server is source of truth - arrays are guaranteed)
    const data = scenarioData as any;
    const agents = data?.agents || [];
    const map: Record<string, any> = {};
    if (Array.isArray(agents)) {
      agents.forEach((a: any) => {
        if (a.agent_id) {
          map[String(a.agent_id)] = {
            name: a.name || "",
            description: a.description || "",
            roles: a.roles || [],
          };
        }
      });
    }
    return map;
  }, [scenarioData]);
  // Merge server problem statement mapping with local versions (for create mode)
  // IDs from database are unique, so just merge - local versions override server versions if same ID
  const problemStatementMapping = useMemo(() => {
    const data = scenarioData as any;
    const serverMappingRaw = data?.problem_statement_mapping || {};
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
  }, [scenarioData, localProblemStatementVersions]);

  // Compute selected problem statement ID for picker (DHH-style: derive from state, not effects)
  const selectedProblemStatementId = useMemo(() => {
    // If we have IDs from URL, use the first one
    if (currentProblemStatementIds.length > 0) {
      return currentProblemStatementIds[0];
    }
    // Otherwise, find the ID that matches the current problem statement text
    if (problemStatement && problemStatement.trim()) {
      const matchingId = Object.entries(problemStatementMapping).find(
        ([_id, info]) => info.problem_statement === problemStatement
      )?.[0];
      return matchingId;
    }
    return undefined;
  }, [currentProblemStatementIds, problemStatement, problemStatementMapping]);

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
    upload_id?: string;
  };
  const videoMapping = useMemo((): Record<string, VideoMappingItem> => {
    const scenarioVideos = (
      scenarioData as ScenarioDetailOut & {
        scenario_videos?: Array<{
          id?: string;
          name?: string;
          length_seconds?: number;
          active?: boolean;
          upload_id?: string;
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
        upload_id?: string;
      };
      const videoId = vidTyped["id"];
      if (videoId) {
        mapping[videoId] = {
          id: videoId,
          name: vidTyped["name"] || "",
          length_seconds: vidTyped["length_seconds"] || 0,
          ...(vidTyped["upload_id"]
            ? { upload_id: vidTyped["upload_id"] }
            : {}),
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
        field.conditional_parameter_ids.forEach((paramId: string) =>
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
                updatePersonaIds((prevPersonas) => {
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
                updateDocumentIds((prevDocs) => {
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
                updateFieldIds((prevParams) => {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    formData.departmentIds,
    previousDepartmentIds,
    selectedPersonaIds,
    currentDocumentIds,
    currentFieldIds,
    validPersonaIds,
    validDocumentIds,
    validParameterItemIds,
    // updatePersonaIds, updateDocumentIds, updateFieldIds intentionally omitted to prevent infinite loops
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
    // BUT: Skip cleanup if filters are active - selected personas might be filtered out temporarily
    // Only clean up when filters are NOT active (to avoid clearing selections due to UI filters)
    if (selectedPersonaIds.length > 0 && !personaShowSelected) {
      const validSet = new Set(validPersonaIds);
      const filtered = selectedPersonaIds.filter((id) => validSet.has(id));
      if (filtered.length !== selectedPersonaIds.length) {
        updatePersonaIds(filtered);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPersonaIds, validPersonaIds, personaShowSelected]); // updatePersonaIds intentionally omitted

  useEffect(() => {
    // Clear documents that are no longer valid
    // BUT: Skip cleanup if filters are active - selected documents might be filtered out temporarily
    // Only clean up when filters are NOT active (to avoid clearing selections due to UI filters)
    if (
      currentDocumentIds.length > 0 &&
      !documentShowSelected &&
      !documentShowTemplate
    ) {
      const validSet = new Set(validDocumentIds);
      const filtered = currentDocumentIds.filter((id) => validSet.has(id));
      if (filtered.length !== currentDocumentIds.length) {
        updateDocumentIds(filtered);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    currentDocumentIds,
    validDocumentIds,
    documentShowSelected,
    documentShowTemplate,
  ]); // updateDocumentIds intentionally omitted

  // Initialize/update scenarioPreviewDocumentId when allPreviewDocumentIds changes
  // Use allPreviewDocumentIds (not currentDocumentIds) because it already handles parent->child replacement
  // This ensures we preview the actual child document instead of the parent template
  useEffect(() => {
    if (allPreviewDocumentIds.length > 0) {
      // If current preview is not in the preview documents, or no preview is set, select the first one
      const firstDocId = allPreviewDocumentIds[0];
      if (
        !contentState.scenarioPreviewDocumentId ||
        (firstDocId &&
          !allPreviewDocumentIds.includes(
            contentState.scenarioPreviewDocumentId
          ))
      ) {
        setContentState((prev) => ({
          ...prev,
          scenarioPreviewDocumentId: firstDocId || null,
        }));
      }
    } else {
      // No documents selected, clear preview
      setContentState((prev) => ({
        ...prev,
        scenarioPreviewDocumentId: null,
      }));
    }
  }, [allPreviewDocumentIds, contentState.scenarioPreviewDocumentId]);

  // Note: Document/persona parameter syncing removed - parameters are now selected independently
  // Filtering happens automatically via validGeneralParameterItemIds based on selected personas/documents

  useEffect(() => {
    // Clear parameter items (fields) that are no longer valid
    // BUT: Skip cleanup if any parameter's filter is active - selected fields might be filtered out temporarily
    // Only clean up when filters are NOT active (to avoid clearing selections due to UI filters)
    const hasAnyFieldFilterActive = Object.values(
      fieldShowSelectedByParam
    ).some(Boolean);
    if (currentFieldIds.length > 0 && !hasAnyFieldFilterActive) {
      const validSet = new Set(validParameterItemIds);
      const filtered = currentFieldIds.filter((id) => validSet.has(id));
      if (filtered.length !== currentFieldIds.length) {
        updateFieldIds(filtered);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentFieldIds, validParameterItemIds, fieldShowSelectedByParam]); // updateFieldIds intentionally omitted

  // Note: problemStatementIds, objectiveIds, and templateDocumentIds are now derived from URL params
  // No need for sync effects - they're automatically synced via nuqs

  // Note: name, problemStatement, objectives, and videoLength are now managed by nuqs
  // No manual URL sync effects needed - nuqs handles URL sync automatically

  // Don't auto-select images - user must explicitly choose or upload via picker

  // Populate currentObjectives from currentObjectiveIds when objective_mapping becomes available
  // This handles the case where objectiveIds are loaded from URL before scenarioData is available
  // BUT: Only if URL doesn't have objectives text (text takes priority over IDs)
  useEffect(() => {
    // Check if URL has objectives text - if so, don't populate from IDs
    const objectivesParam = searchParams.get("objectives");
    if (objectivesParam) {
      // URL has objectives text - don't override with IDs
      return;
    }

    // No URL text - populate from IDs if available
    if (
      currentObjectiveIds.length > 0 &&
      Object.keys(getObjectiveMapping).length > 0
    ) {
      const objectivesFromIds = getObjectivesFromMapping(
        currentObjectiveIds,
        getObjectiveMapping
      );
      // Only update if different (avoid unnecessary re-renders)
      const currentObjectivesString = JSON.stringify(contentState.objectives);
      const newObjectivesString = JSON.stringify(objectivesFromIds);
      if (currentObjectivesString !== newObjectivesString) {
        updateObjectives(objectivesFromIds);
        setContentState((prev) => ({ ...prev, objectives: objectivesFromIds }));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentObjectiveIds, getObjectiveMapping, searchParams]);

  // Handle randomized selections from WebSocket event
  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleRandomizeComplete = (data: {
      success: boolean;
      randomized_selections: {
        personaIds?: string[] | null;
        documentIds?: string[] | null;
        parameterIds?: string[] | null;
        fieldIds?: string[] | null;
      };
      message?: string;
    }) => {
      if (!data.success) {
        toast.error(data.message || "Failed to randomize selections");
        setRandomizingSection(null);
        return;
      }

      const randomized = data.randomized_selections;

      // Update state with randomized selections using transition for smooth UI updates
      startTransition(() => {
        if (randomized.personaIds) {
          updatePersonaIds(randomized.personaIds);
        }
        if (randomized.documentIds) {
          updateDocumentIds(randomized.documentIds);
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
        // Check which section was being randomized
        if (randomizingSection && randomizingSection.startsWith("parameter_")) {
          // Single parameter randomization: keep fields for other parameters, add randomized ones
          const paramId = randomizingSection.replace("parameter_", "");
          const otherParamFields = currentFieldIds.filter(
            (itemId) => fieldMapping[itemId]?.parameter_id !== paramId
          );
          finalFieldIds = [...otherParamFields, ...randomized.fieldIds];
        } else {
          // Full randomization (randomize=all): replace all fields
          finalFieldIds = randomized.fieldIds;
        }
        // Wrap field updates in transition too for smooth transitions
        startTransition(() => {
          updateFieldIds(finalFieldIds!);
        });
      }

      // Update URL params with randomized selections
      requestAnimationFrame(() => {
        setQ({
          personaIds:
            randomized.personaIds && randomized.personaIds.length > 0
              ? randomized.personaIds
              : null,
          documentIds:
            randomized.documentIds && randomized.documentIds.length > 0
              ? randomized.documentIds
              : null,
          parameterIds:
            randomized.parameterIds && randomized.parameterIds.length > 0
              ? randomized.parameterIds
              : null,
          fieldIds:
            finalFieldIds && finalFieldIds.length > 0 ? finalFieldIds : null,
        });
      });

      if (data.message) {
        toast.success(data.message);
      }
    };

    const handleRandomizeError = (data: {
      success: boolean;
      message: string;
    }) => {
      toast.error(data.message || "Failed to randomize selections");
      setRandomizingSection(null);
    };

    socket.on("scenario_randomize_complete", handleRandomizeComplete);
    socket.on("scenario_randomize_error", handleRandomizeError);

    return () => {
      socket.off("scenario_randomize_complete", handleRandomizeComplete);
      socket.off("scenario_randomize_error", handleRandomizeError);
    };
  }, [
    socket,
    isConnected,
    randomizingSection,
    currentFieldIds,
    fieldMapping,
    updatePersonaIds,
    updateDocumentIds,
    updateFieldIds,
    handleInputChange,
    setQ,
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
    documentShowSelected,
    documentShowTemplate,
    personaShowSelected,
    parameterShowSelected,
    fieldShowSelectedByParam,
    personaMinMax,
    documentMinMax,
    parameterSelectionMinMax,
    fieldMinMax,
    useObjectives, // Include useObjectives to trigger URL updates when useObjectives changes
    useImage, // Include useImage to trigger URL updates when useImage changes
    useVideo, // Include useVideo to trigger URL updates when useVideo changes
    useQuestions, // Include useQuestions to trigger URL updates when useQuestions changes
    problemStatement, // Include problemStatement to trigger URL updates when text changes
    currentObjectives, // Include objectives to trigger URL updates when text changes
    name, // Include name to trigger URL updates when text changes
    pathname,
  ]);

  // Load scenario data from V2 response
  useEffect(() => {
    if (scenarioData && isEditMode && !formDataInitializedRef.current) {
      // Edit mode: load existing scenario data (only once)
      const deptIds = scenarioData.department_ids || [];
      // Initialize name and problemStatement via nuqs
      setQ({
        name: scenarioData.name || null,
        problemStatement: scenarioData.problem_statement || null,
      });
      // Initialize basic info state
      setBasicInfoState({
        scenarioAgentId: scenarioData.scenario_agent_id || null,
        imageAgentId: scenarioData.image_agent_id || null,
        videoAgentId:
          (scenarioData as ScenarioDetailOut & { video_agent_id?: string })
            .video_agent_id || null,
        active: scenarioData.active ?? true,
      });
      setFormData({
        departmentIds: deptIds,
        parameterIds: scenarioData.scenario_parameter_ids || [],
      });
      // Initialize previousDepartmentIds when loading scenario data
      if (previousDepartmentIds.length === 0 && deptIds.length > 0) {
        setPreviousDepartmentIds(deptIds);
      }
      updatePersonaIds(scenarioData.persona_ids || []);
      // Clear local versions when loading existing scenario (edit mode)
      setLocalProblemStatementVersions([]);
      const docIds = scenarioData.document_ids || [];
      updateDocumentIds(docIds);
      // Extract template document IDs from documentDetails (is_template field) for edit mode
      const templateDocIds =
        scenarioData.document_details
          ?.filter((doc) => doc.is_template === true)
          .map((doc) => doc.document_id) || [];
      updateTemplateDocumentIds(templateDocIds);
      updateFieldIds(getFieldIdsFromStructure(scenarioData.parameters));
      updateObjectives(
        getObjectivesFromMapping(
          scenarioData.objective_ids,
          getObjectiveMapping
        )
      );
      // Load scenario flags from server data
      const scenarioDataWithFlags = scenarioData as ScenarioDetailOut & {
        objectives_enabled?: boolean;
        images_enabled?: boolean;
        video_enabled?: boolean;
        questions_enabled?: boolean;
        problem_statement_enabled?: boolean;
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
      // Load images_enabled flag
      const imagesEnabled = scenarioDataWithFlags.images_enabled ?? false;
      // Load problem_statement_enabled flag
      const problemStatementEnabled =
        scenarioDataWithFlags.problem_statement_enabled ?? true;

      // Update URL-backed flags via nuqs
      setQ({
        useObjectives: objectivesEnabled || null,
        useImage: imagesEnabled || null,
        useProblemStatement: problemStatementEnabled || null,
      });
      // In edit mode, load saved images from scenario (scenario_images represents saved images)
      // In create mode, don't auto-select - user must explicitly choose or upload via picker
      const scenarioImages = scenarioDataWithFlags.scenario_images;
      if (
        isEditMode &&
        imagesEnabled &&
        scenarioImages &&
        Array.isArray(scenarioImages) &&
        scenarioImages.length > 0
      ) {
        // In edit mode, load the first saved image (scenario_images contains saved images)
        const firstImage = scenarioImages[0] as {
          id?: string;
          name?: string;
          upload_id?: string;
        };
        const uploadId = firstImage.upload_id || firstImage.id;
        if (uploadId) {
          setContentState((prev) => ({
            ...prev,
            image: {
              id: uploadId,
              name: firstImage.name || "",
              upload_id: uploadId,
            },
          }));
        } else {
          setContentState((prev) => ({ ...prev, image: null }));
        }
      } else {
        // Create mode or no saved images - don't auto-select
        setContentState((prev) => ({ ...prev, image: null }));
      }

      // Load video_enabled and scenario video (only active video)
      const videoEnabled = scenarioDataWithFlags.video_enabled ?? false;
      setQ({ useVideo: videoEnabled || null });
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
          upload_id?: string;
        };
        const videoId = activeVideoTyped["id"];
        const uploadId = activeVideoTyped["upload_id"];
        if (videoId) {
          setContentState((prev) => ({
            ...prev,
            selectedVideo: {
              id: videoId,
              name: activeVideoTyped["name"] || "",
              length_seconds: activeVideoTyped["length_seconds"] || 0,
              ...(uploadId ? { upload_id: uploadId } : {}),
            },
            activeVideoId: videoId,
          }));
        } else {
          setContentState((prev) => ({
            ...prev,
            selectedVideo: null,
            activeVideoId: null,
          }));
        }
      } else {
        setContentState((prev) => ({
          ...prev,
          selectedVideo: null,
          activeVideoId: null,
        }));
      }

      // Load questions_enabled and questions
      const questionsEnabled = scenarioDataWithFlags.questions_enabled ?? false;
      setQ({ useQuestions: questionsEnabled || null });
      const questionIds = scenarioDataWithFlags.question_ids || [];
      const questionsData = scenarioDataWithFlags.questions || [];
      if (
        questionsData &&
        Array.isArray(questionsData) &&
        questionsData.length > 0
      ) {
        const mappedQuestions = questionsData.map((q) => {
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
        });
        setContentState((prev) => ({
          ...prev,
          questions: mappedQuestions,
          currentQuestionIds: questionIds,
        }));
      } else {
        setContentState((prev) => ({
          ...prev,
          questions: [],
          currentQuestionIds: [],
        }));
      }
      // Store originals for change tracking (name and problemStatement now tracked via nuqs)
      // Basic info state (agents, active) tracked separately
      setOriginalFormData({
        departmentIds: scenarioData.department_ids || [],
        parameterIds: scenarioData.scenario_parameter_ids || [],
      });
      setOriginalDocumentIds(scenarioData.document_ids || []);
      // Store template document IDs for original tracking (already extracted above as templateDocIds)
      setOriginalTemplateDocumentIds(templateDocIds);
      setOriginalFieldIds(getFieldIdsFromStructure(scenarioData.parameters));
      setOriginalObjectives(
        getObjectivesFromMapping(
          scenarioData.objective_ids,
          getObjectiveMapping
        )
      );
      formDataInitializedRef.current = true;
    } else if (!isEditMode && scenarioData && !formDataInitializedRef.current) {
      // Create mode: initialize from server response (server-driven approach)
      // Server already parsed URL params and returns selected IDs, search terms, ranges
      const newData = scenarioData as ScenarioNewOut;
      // Preserve problem statement and name if they were set from URL params (don't reset to empty/default)
      // Name and problemStatement are now managed by nuqs, so they're already in q
      // Only initialize if not already set in URL
      if (!q.problemStatement) {
        // No problem statement in URL - keep empty or use default
      }
      if (!q.name || q.name === "New Scenario") {
        // Name is default or not set - keep as is (nuqs will handle default)
      }
      // Initialize basic info state
      setBasicInfoState({
        scenarioAgentId: scenarioData.scenario_agent_id || null,
        imageAgentId: scenarioData.image_agent_id || null,
        videoAgentId:
          (scenarioData as ScenarioDetailOut & { video_agent_id?: string })
            .video_agent_id || null,
        active: true, // Default for create mode
      });
      setFormData({
        ...initialFormData,
        parameterIds: newData.selected_parameter_ids || [],
      });

      // Initialize selections from server response (filtered to valid IDs)
      // Only update URL if server values differ from current URL values
      if (newData.selected_persona_ids) {
        const currentPersonaIds = q.personaIds ?? [];
        if (
          JSON.stringify([...currentPersonaIds].sort()) !==
          JSON.stringify([...newData.selected_persona_ids].sort())
        ) {
          updatePersonaIds(newData.selected_persona_ids);
        }
      }
      if (newData.selected_document_ids) {
        const currentDocIds = q.documentIds ?? [];
        if (
          JSON.stringify([...currentDocIds].sort()) !==
          JSON.stringify([...newData.selected_document_ids].sort())
        ) {
          updateDocumentIds(newData.selected_document_ids);
        }
      }
      // Template document IDs: prioritize URL params over server response
      // URL params are the source of truth (DHH-style)
      const currentTemplateIds = q.templateDocumentIds ?? [];
      if (currentTemplateIds.length > 0) {
        // URL params take precedence - no update needed
      } else if (newData.selected_template_document_ids) {
        // Fallback to server response if no URL params
        updateTemplateDocumentIds(newData.selected_template_document_ids);
      }
      if (newData.selected_field_ids) {
        const currentFieldIdsFromQ = q.fieldIds ?? [];
        if (
          JSON.stringify([...currentFieldIdsFromQ].sort()) !==
          JSON.stringify([...newData.selected_field_ids].sort())
        ) {
          updateFieldIds(newData.selected_field_ids);
        }
      }

      // Don't auto-select images - user must explicitly choose or upload

      // Initialize objective IDs from URL params (server doesn't return selected_objective_ids)
      // URL params are the source of truth (DHH-style)
      const currentObjectiveIdsFromQ = q.objectiveIds ?? [];
      if (currentObjectiveIdsFromQ.length > 0) {
        // Populate currentObjectives from objective IDs using objective mapping
        // Use the helper function that prefers arrays, falls back to mapping
        if (Object.keys(getObjectiveMapping).length > 0) {
          const objectivesFromIds = getObjectivesFromMapping(
            currentObjectiveIdsFromQ,
            getObjectiveMapping
          );
          updateObjectives(objectivesFromIds);
          setContentState((prev) => ({
            ...prev,
            objectives: objectivesFromIds,
          }));
        }
      }

      // Initialize problem statement IDs from URL params (server doesn't return selected_problem_statement_ids)
      const currentProblemStatementIdsFromQ = q.problemStatementIds ?? [];
      if (currentProblemStatementIdsFromQ.length > 0) {
        // Set first as active and update name if needed
        // Use problemStatementMapping which prefers arrays, falls back to mapping
        const firstId = currentProblemStatementIdsFromQ[0];
        if (firstId) {
          const firstProblemStatementRaw = problemStatementMapping[firstId];
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
            // Set as active - but only if URL doesn't have problem statement text (text takes priority)
            const problemStatementFromUrl =
              searchParams.get("problemStatement");
            if (
              !problemStatementFromUrl &&
              (!problemStatement || !problemStatement.trim())
            ) {
              setQ({
                problemStatement:
                  firstProblemStatement.problem_statement || null,
              });
            }
            // Set name in new mode (using name field)
            const isNewMode =
              !isEditMode &&
              (!name || name === "New Scenario" || name.trim() === "");
            if (isNewMode && firstProblemStatement.name) {
              setQ({ name: firstProblemStatement.name || null });
            }
          }
        }
      }

      // Initialize search terms and ranges from server response (update URL via nuqs)
      // Only update if server values differ from current URL values
      const updates: Partial<typeof q> = {};
      if (
        newData.persona_search &&
        newData.persona_search !== q.personaSearch
      ) {
        updates.personaSearch = newData.persona_search;
      }
      if (
        newData.document_search &&
        newData.document_search !== q.documentSearch
      ) {
        updates.documentSearch = newData.document_search;
      }
      if (
        newData.parameter_search &&
        newData.parameter_search !== q.parameterSearch
      ) {
        updates.parameterSearch = newData.parameter_search;
      }

      // Update ranges if server values differ
      const serverPersonaMin = newData.persona_min ?? 1;
      const serverPersonaMax = newData.persona_max ?? 1;
      if (
        q.personaMin !== serverPersonaMin ||
        q.personaMax !== serverPersonaMax
      ) {
        updates.personaMin = serverPersonaMin;
        updates.personaMax = serverPersonaMax;
      }

      const serverDocumentMin = newData.document_min ?? 0;
      const serverDocumentMax = newData.document_max ?? 1;
      if (
        q.documentMin !== serverDocumentMin ||
        q.documentMax !== serverDocumentMax
      ) {
        updates.documentMin = serverDocumentMin;
        updates.documentMax = serverDocumentMax;
      }

      const parameterDefault =
        scenarioData?.allowed_ranges?.parameter_selection ||
        parameterSelectionMinMax;
      const serverParameterMin =
        newData.parameter_selection_min ?? parameterDefault.min;
      const serverParameterMax =
        newData.parameter_selection_max ?? parameterDefault.max;
      if (
        q.parameterSelectionMin !== serverParameterMin ||
        q.parameterSelectionMax !== serverParameterMax
      ) {
        updates.parameterSelectionMin = serverParameterMin;
        updates.parameterSelectionMax = serverParameterMax;
      }

      if (Object.keys(updates).length > 0) {
        setQ(updates);
      }

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
        // Update URL with field ranges if they differ from current URL values
        const currentFieldRanges = parseJsonDict<
          Record<string, { min: number; max: number }>
        >(q.fieldRanges, {});
        if (JSON.stringify(result) !== JSON.stringify(currentFieldRanges)) {
          updateFieldRanges(result);
        }
      } else {
        // If no field_ranges in response, initialize with defaults for all parameters
        // This ensures reset works even if server doesn't return field_ranges
        // Use parameterMapping (all parameters) not generalParameterMapping (filtered)
        const defaultFieldRanges: Record<string, { min: number; max: number }> =
          {};
        Object.keys(parameterMapping).forEach((paramId) => {
          defaultFieldRanges[paramId] = { min: 1, max: 3 };
        });
        const currentFieldRanges = parseJsonDict<
          Record<string, { min: number; max: number }>
        >(q.fieldRanges, {});
        if (
          JSON.stringify(defaultFieldRanges) !==
          JSON.stringify(currentFieldRanges)
        ) {
          updateFieldRanges(defaultFieldRanges);
        }
      }

      formDataInitializedRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    scenarioData,
    isEditMode,
    previousDepartmentIds.length,
    effectiveProfile?.primaryDepartmentId,
    initialFormData,
    searchParams,
    q.documentMax,
    q.documentMin,
    q.documentSearch,
    q.parameterSearch,
    q.parameterSelectionMax,
    q.parameterSelectionMin,
    q.personaMax,
    q.personaMin,
    q.personaSearch,
    setQ,
    parameterMapping,
    fieldMapping,
    parameterSelectionMinMax, // Used as fallback value in effect
    name,
    problemStatement,
    handleInputChange,
    useImage,
    // q.documentIds, q.fieldIds, etc. intentionally omitted - only specific q fields needed
    // update* functions intentionally omitted to prevent infinite loops
  ]);

  // Problem statement ID is now managed via URL parameters, not state

  // Note: getScenarioAgentRole and expectedScenarioRole removed - scenarios now always use base 'scenario' role

  // Reset initialization flag when switching between edit/create modes or scenario changes
  useEffect(() => {
    formDataInitializedRef.current = false;
  }, [scenarioId, isEditMode]);

  // Reset agent selection when flags change to incompatible combination
  useEffect(() => {
    if (!scenarioData || !agentMapping || !basicInfoState.scenarioAgentId)
      return;

    const agent = agentMapping[basicInfoState.scenarioAgentId];
    const agentRole = agent?.roles?.[0]; // Get first role (should be only one)

    // If current agent doesn't match 'scenario' role, clear selection
    if (agentRole && agentRole !== "scenario") {
      setBasicInfoState((prev) => ({
        ...prev,
        scenarioAgentId: null,
        videoAgentId: null,
      }));
    }
  }, [scenarioData, agentMapping, basicInfoState.scenarioAgentId]);

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
    if (scenarioAgentIds.length === 1 && !basicInfoState.scenarioAgentId) {
      setBasicInfoState((prev) => ({
        ...prev,
        scenarioAgentId: scenarioAgentIds[0] || null,
      }));
    }

    // Auto-select first image agent if only one option and not already set
    if (imageAgentIds.length === 1 && !basicInfoState.imageAgentId) {
      setBasicInfoState((prev) => ({
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
    if (videoAgentIds.length === 1 && !basicInfoState.videoAgentId) {
      setBasicInfoState((prev) => ({
        ...prev,
        videoAgentId: videoAgentIds[0] || null,
      }));
    }
  }, [
    scenarioData,
    agentMapping,
    basicInfoState.scenarioAgentId,
    basicInfoState.imageAgentId,
    basicInfoState.videoAgentId,
  ]);

  // Store original name and problemStatement for change tracking (from server data)
  const originalName = useMemo(() => {
    if (!isEditMode || !scenarioData) return "New Scenario";
    return scenarioData.name || "New Scenario";
  }, [isEditMode, scenarioData]);

  const originalProblemStatement = useMemo(() => {
    if (!isEditMode || !scenarioData) return "";
    return (scenarioData as ScenarioDetailOut).problem_statement || "";
  }, [isEditMode, scenarioData]);

  // Store original basic info state for change tracking
  const originalBasicInfoState = useMemo(() => {
    if (!isEditMode || !scenarioData) {
      return {
        scenarioAgentId: null,
        imageAgentId: null,
        videoAgentId: null,
        active: true,
      };
    }
    return {
      scenarioAgentId: scenarioData.scenario_agent_id || null,
      imageAgentId: scenarioData.image_agent_id || null,
      videoAgentId:
        (scenarioData as ScenarioDetailOut & { video_agent_id?: string })
          .video_agent_id || null,
      active: scenarioData.active ?? true,
    };
  }, [isEditMode, scenarioData]);

  // Check if form has changes
  const hasChanges = useMemo(() => {
    if (!isEditMode) return false;

    const current = formData;
    const original = originalFormData;
    const originalPersonaIds = scenarioData?.persona_ids || [];

    return (
      JSON.stringify(selectedPersonaIds.sort()) !==
        JSON.stringify(originalPersonaIds.sort()) ||
      name !== originalName ||
      problemStatement !== originalProblemStatement ||
      basicInfoState.active !== originalBasicInfoState.active ||
      basicInfoState.scenarioAgentId !==
        originalBasicInfoState.scenarioAgentId ||
      basicInfoState.imageAgentId !== originalBasicInfoState.imageAgentId ||
      basicInfoState.videoAgentId !== originalBasicInfoState.videoAgentId ||
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
    name,
    originalName,
    problemStatement,
    originalProblemStatement,
    basicInfoState.active,
    basicInfoState.scenarioAgentId,
    basicInfoState.imageAgentId,
    basicInfoState.videoAgentId,
    originalBasicInfoState.active,
    originalBasicInfoState.scenarioAgentId,
    originalBasicInfoState.imageAgentId,
    originalBasicInfoState.videoAgentId,
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
    return problemStatement !== originalProblemStatement;
  }, [isEditMode, problemStatement, originalProblemStatement]);

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
      if (problemStatement && problemStatement.trim()) {
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
      problemStatement,
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
      ([paramId, param]) => {
        const p = param as { name: string; description?: string };
        return {
          id: `parameter-${paramId}`,
          title: p.name,
          description: p.description || "",
          status: getStepStatus(`parameter-${paramId}`),
        };
      }
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

  // Parameter actions - WebSocket randomization per parameter
  const handleRandomizeParameterClient = (paramId: string) => {
    if (!socket || !isConnected) {
      toast.error("WebSocket not connected. Please refresh the page.");
      return;
    }

    // Set loading state for this specific parameter section
    setRandomizingSection(`parameter_${paramId}`);

    // Emit WebSocket event with all current filter/search/range params
    socket.emit("scenario_randomize", {
      scenarioId: isEditMode ? scenarioId : null,
      randomize: `parameter_${paramId}`,
      departmentIds: q.departmentIds ?? null,
      personaIds: q.personaIds ?? null,
      documentIds: q.documentIds ?? null,
      templateDocumentIds: q.templateDocumentIds ?? null,
      parameterIds: q.parameterIds ?? null,
      fieldIds: q.fieldIds ?? null,
      personaSearch: q.personaSearch ?? null,
      documentSearch: q.documentSearch ?? null,
      parameterSearch: q.parameterSearch ?? null,
      personaMin: q.personaMin ?? null,
      personaMax: q.personaMax ?? null,
      documentMin: q.documentMin ?? null,
      documentMax: q.documentMax ?? null,
      parameterSelectionMin: q.parameterSelectionMin ?? null,
      parameterSelectionMax: q.parameterSelectionMax ?? null,
      fieldRanges: fieldMinMax,
      useImage: q.useImage ?? null,
      useVideo: q.useVideo ?? null,
      profileId: effectiveProfile?.id ?? "",
    });
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

      // Clear URL params using nuqs and router for dynamic params
      setQ({
        fieldIds: null,
        randomize: null,
      });
      // Clear dynamic field range params manually
      const params = new URLSearchParams(searchParams.toString());
      params.delete(`fieldMin_${paramId}`);
      params.delete(`fieldMax_${paramId}`);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });

      // Update local state after URL update completes (next frame)
      requestAnimationFrame(() => {
        // Reset local state for this parameter's range
        updateFieldRanges((prev) => ({
          ...prev,
          [paramId]: { min: defaultMin, max: defaultMax },
        }));
        // Update local state - remove this parameter's fields
        updateFieldIds(currentParamItems);
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

  // Persona actions - WebSocket randomization
  const handleRandomizePersonaClient = () => {
    if (!socket || !isConnected) {
      toast.error("WebSocket not connected. Please refresh the page.");
      return;
    }

    // Set loading state for persona section
    setRandomizingSection("persona");

    // Emit WebSocket event with all current filter/search/range params
    socket.emit("scenario_randomize", {
      scenarioId: isEditMode ? scenarioId : null,
      randomize: "persona",
      departmentIds: q.departmentIds ?? null,
      personaIds: q.personaIds ?? null,
      documentIds: q.documentIds ?? null,
      templateDocumentIds: q.templateDocumentIds ?? null,
      parameterIds: q.parameterIds ?? null,
      fieldIds: q.fieldIds ?? null,
      personaSearch: q.personaSearch ?? null,
      documentSearch: q.documentSearch ?? null,
      parameterSearch: q.parameterSearch ?? null,
      personaMin: q.personaMin ?? null,
      personaMax: q.personaMax ?? null,
      documentMin: q.documentMin ?? null,
      documentMax: q.documentMax ?? null,
      parameterSelectionMin: q.parameterSelectionMin ?? null,
      parameterSelectionMax: q.parameterSelectionMax ?? null,
      fieldRanges: fieldMinMax,
      useImage: q.useImage ?? null,
      useVideo: q.useVideo ?? null,
      profileId: effectiveProfile?.id ?? "",
    });
  };

  const handleResetPersona = () => {
    try {
      // Get default min/max from server or use defaults
      const newData = scenarioData as ScenarioNewOut | undefined;
      const defaultMin = newData?.persona_min ?? 1;
      const defaultMax = newData?.persona_max ?? 1;

      // Set resetting flag to prevent buildSearchParams from interfering
      isResettingRef.current = true;

      // Clear URL params and reset to defaults using nuqs
      setQ({
        personaIds: null,
        personaSearch: null,
        personaMin: defaultMin,
        personaMax: defaultMax,
        randomize: null,
      });

      // Update local state after URL update completes (next frame)
      requestAnimationFrame(() => {
        updatePersonaIds([]);
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

  // Documents actions - WebSocket randomization
  const handleRandomizeDocumentsClient = () => {
    if (!socket || !isConnected) {
      toast.error("WebSocket not connected. Please refresh the page.");
      return;
    }

    // Set loading state for document section
    setRandomizingSection("document");

    // Emit WebSocket event with all current filter/search/range params
    socket.emit("scenario_randomize", {
      scenarioId: isEditMode ? scenarioId : null,
      randomize: "document",
      departmentIds: q.departmentIds ?? null,
      personaIds: q.personaIds ?? null,
      documentIds: q.documentIds ?? null,
      templateDocumentIds: q.templateDocumentIds ?? null,
      parameterIds: q.parameterIds ?? null,
      fieldIds: q.fieldIds ?? null,
      personaSearch: q.personaSearch ?? null,
      documentSearch: q.documentSearch ?? null,
      parameterSearch: q.parameterSearch ?? null,
      personaMin: q.personaMin ?? null,
      personaMax: q.personaMax ?? null,
      documentMin: q.documentMin ?? null,
      documentMax: q.documentMax ?? null,
      parameterSelectionMin: q.parameterSelectionMin ?? null,
      parameterSelectionMax: q.parameterSelectionMax ?? null,
      fieldRanges: fieldMinMax,
      useImage: q.useImage ?? null,
      useVideo: q.useVideo ?? null,
      profileId: effectiveProfile?.id ?? "",
    });
  };

  const handleResetDocuments = () => {
    try {
      // Get default min/max from server or use defaults
      const newData = scenarioData as ScenarioNewOut | undefined;
      const defaultMin = newData?.document_min ?? 0;
      const defaultMax = newData?.document_max ?? 1;

      // Set resetting flag to prevent buildSearchParams from interfering
      isResettingRef.current = true;

      // Clear URL params and reset to defaults using nuqs
      setQ({
        documentIds: null,
        documentSearch: null,
        documentMin: defaultMin,
        documentMax: defaultMax,
        randomize: null,
      });

      // Update local state after URL update completes (next frame)
      requestAnimationFrame(() => {
        updateDocumentIds([]);
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

  // Document removal handler - removes document from selection
  const handleDocumentRemove = (docId: string) => {
    // Check if document is in currentDocumentIds (could be regular or child document)
    if (currentDocumentIds.includes(docId)) {
      updateDocumentIds((prev) => prev.filter((id) => id !== docId));
    }
    // Check if document is in templateDocumentIds (template document)
    if (templateDocumentIds.includes(docId)) {
      updateTemplateDocumentIds((prev) => prev.filter((id) => id !== docId));
    }
    // Note: URL params are automatically updated via useEffect that watches currentDocumentIds and templateDocumentIds
  };

  // Parameters actions - WebSocket randomization
  const handleRandomizeParametersClient = () => {
    if (!socket || !isConnected) {
      toast.error("WebSocket not connected. Please refresh the page.");
      return;
    }

    // Set loading state for parameters section
    setRandomizingSection("parameters");

    // Emit WebSocket event with all current filter/search/range params
    socket.emit("scenario_randomize", {
      scenarioId: isEditMode ? scenarioId : null,
      randomize: "parameters",
      departmentIds: q.departmentIds ?? null,
      personaIds: q.personaIds ?? null,
      documentIds: q.documentIds ?? null,
      templateDocumentIds: q.templateDocumentIds ?? null,
      parameterIds: q.parameterIds ?? null,
      fieldIds: q.fieldIds ?? null,
      personaSearch: q.personaSearch ?? null,
      documentSearch: q.documentSearch ?? null,
      parameterSearch: q.parameterSearch ?? null,
      personaMin: q.personaMin ?? null,
      personaMax: q.personaMax ?? null,
      documentMin: q.documentMin ?? null,
      documentMax: q.documentMax ?? null,
      parameterSelectionMin: q.parameterSelectionMin ?? null,
      parameterSelectionMax: q.parameterSelectionMax ?? null,
      fieldRanges: fieldMinMax,
      useImage: q.useImage ?? null,
      useVideo: q.useVideo ?? null,
      profileId: effectiveProfile?.id ?? "",
    });
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

      // Clear field ranges (now JSON-encoded dict)
      urlUpdates["fieldRanges"] = null;

      // Clear URL params using nuqs
      setQ({
        parameterIds: null,
        parameterSearch: null,
        fieldRanges: null,
        parameterSelectionMin: defaultMin,
        parameterSelectionMax: defaultMax,
        fieldIds: null,
        randomize: null,
      });

      // Clear dynamic field range params manually
      const params = new URLSearchParams(searchParams.toString());
      Object.keys(parameterMapping).forEach((paramId) => {
        params.delete(`fieldMin_${paramId}`);
        params.delete(`fieldMax_${paramId}`);
      });
      // Also clear any we might have missed
      searchParams.forEach((_value, key) => {
        if (key.startsWith("fieldMin_") || key.startsWith("fieldMax_")) {
          params.delete(key);
        }
      });
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });

      // Update local state after URL update completes (next frame)
      requestAnimationFrame(() => {
        handleInputChange("parameterIds", []);
        // Clear all field IDs and ranges when resetting parameters
        updateFieldIds([]);
        // Reset field ranges to defaults for ALL parameters
        const defaultFieldRanges: Record<string, { min: number; max: number }> =
          {};
        Object.keys(parameterMapping).forEach((paramId) => {
          defaultFieldRanges[paramId] = { min: 1, max: 3 };
        });
        updateFieldRanges(defaultFieldRanges);
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

  // Randomize all: personas, documents, and all parameters (WebSocket)
  const handleRandomizeAll = () => {
    if (!socket || !isConnected) {
      toast.error("WebSocket not connected. Please refresh the page.");
      return;
    }

    try {
      // Set loading state for all sections
      setRandomizingSection("all");

      // Emit WebSocket event with all current filter/search/range params
      socket.emit("scenario_randomize", {
        scenarioId: isEditMode ? scenarioId : null,
        randomize: "all",
        departmentIds: q.departmentIds ?? null,
        personaIds: q.personaIds ?? null,
        documentIds: q.documentIds ?? null,
        templateDocumentIds: q.templateDocumentIds ?? null,
        parameterIds: q.parameterIds ?? null,
        fieldIds: q.fieldIds ?? null,
        personaSearch: q.personaSearch ?? null,
        documentSearch: q.documentSearch ?? null,
        parameterSearch: q.parameterSearch ?? null,
        personaMin: q.personaMin ?? null,
        personaMax: q.personaMax ?? null,
        documentMin: q.documentMin ?? null,
        documentMax: q.documentMax ?? null,
        parameterSelectionMin: q.parameterSelectionMin ?? null,
        parameterSelectionMax: q.parameterSelectionMax ?? null,
        fieldRanges: fieldMinMax,
        useImage: q.useImage ?? null,
        useVideo: q.useVideo ?? null,
        profileId: effectiveProfile?.id ?? "",
      });
    } catch {
      toast.error("Failed to randomize all selections");
      setRandomizingSection(null);
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

      // Clear field ranges (now JSON-encoded dict)
      urlUpdates["fieldRanges"] = null;
      urlUpdates["fieldShowSelected"] = null;

      // Set resetting flag to prevent buildSearchParams from interfering
      isResettingRef.current = true;

      // Clear URL params using nuqs (static params) and router (dynamic params)
      setQ({
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
      });

      // Clear dynamic field range params manually
      const params = new URLSearchParams(searchParams.toString());
      Object.keys(parameterMapping).forEach((paramId) => {
        params.delete(`fieldMin_${paramId}`);
        params.delete(`fieldMax_${paramId}`);
      });
      searchParams.forEach((_value, key) => {
        if (key.startsWith("fieldMin_") || key.startsWith("fieldMax_")) {
          params.delete(key);
        }
      });
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });

      // Update local state after URL update completes (next frame)
      requestAnimationFrame(() => {
        // Reset all local state to defaults for instant UI feedback
        // Server response will sync these values properly via useEffect
        // Reset field ranges to defaults for ALL parameters (including defaults)
        // Use parameterMapping (all parameters) not generalParameterMapping (filtered)
        const defaultFieldRanges: Record<string, { min: number; max: number }> =
          {};
        Object.keys(parameterMapping).forEach((paramId) => {
          defaultFieldRanges[paramId] = { min: 1, max: 3 };
        });
        updateFieldRanges(defaultFieldRanges);

        // Reset all selections
        updatePersonaIds([]);
        updateDocumentIds([]);
        updateFieldIds([]);
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
      setQ({ problemStatement: null });
      // Clear objectives array via contentState
      setContentState((prev) => ({ ...prev, objectives: [] }));
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

  // Note: Objective, question, option, and image/video handlers are now in ContentSection

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
            setContentState((prev) => ({
              ...prev,
              image: {
                id: databaseUploadId, // Use upload_id as id
                name: file.name,
                upload_id: databaseUploadId,
              },
            }));
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
      // Flatten parameters dict to parameter_item_ids array (required by API)
      const parameterItemIds = Object.values(parametersDict).flat();
      const parameterIds = Object.keys(parametersDict);
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
        parameter_item_ids: string[];
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
        video_length?: number | null;
      } = {
        name: name?.trim() || "",
        description:
          scenarioData &&
          typeof scenarioData === "object" &&
          "description" in scenarioData
            ? ((scenarioData as { description?: string | null }).description ??
              null)
            : null,
        problem_statement: problemStatement?.trim() || "",
        department_ids: finalDepartmentIds,
        active: basicInfoState.active,
        persona_ids: selectedPersonaIds.length > 0 ? selectedPersonaIds : null,
        document_ids: currentDocumentIds,
        template_document_ids:
          templateDocumentIds.length > 0 ? templateDocumentIds : null,
        objective_ids: contentState.objectives.filter((obj) => obj.trim()), // Send raw objective text
        upload_ids: contentState.image?.upload_id
          ? [contentState.image.upload_id]
          : null,
        image_names: contentState.image?.name
          ? [contentState.image.name]
          : null,
        parameters: parametersDict,
        parameter_item_ids: parameterItemIds,
        parameter_ids: parameterIds.length > 0 ? parameterIds : null,
        scenario_agent_id: basicInfoState.scenarioAgentId || null,
        image_agent_id: basicInfoState.imageAgentId || null,
        video_enabled: useVideo,
        questions_enabled: useQuestions,
        video_agent_id: basicInfoState.videoAgentId || null,
        video_ids: contentState.selectedVideo
          ? [contentState.selectedVideo.id]
          : null,
        active_video_id: contentState.activeVideoId || null,
        question_ids:
          contentState.currentQuestionIds.length > 0
            ? contentState.currentQuestionIds
            : null,
        question_timestamps:
          contentState.questions.length > 0 && contentState.selectedVideo
            ? contentState.questions.reduce(
                (acc, q) => {
                  if (q.times && q.times.length > 0) {
                    acc[q.id] = { [contentState.selectedVideo!.id]: q.times };
                  }
                  return acc;
                },
                {} as Record<string, Record<string, number[]>>
              )
            : null,
        video_length: selectedVideoLength || null,
      };

      // Include problem_statement_versions if in create mode and we have local versions
      if (!isEditMode && localProblemStatementVersions.length > 0) {
        const versions = localProblemStatementVersions.map(
          (v) => v.problem_statement
        );
        // Ensure current problem statement is included as the last version (most recent)
        const currentProblemStatement = problemStatement?.trim() || "";
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
            scenario_id: scenarioId!,
            ...payload,
            objectives_enabled: useObjectives,
            images_enabled: useImage,
            video_enabled: useVideo,
            questions_enabled: useQuestions,
            problem_statement_enabled: useProblemStatement,
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
            problem_statement_enabled: useProblemStatement,
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
    updatePersonaIds(ids);
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
          name={name || ""}
          departmentIds={formData.departmentIds || []}
          validDepartmentIds={scenarioData?.valid_department_ids || []}
          departmentMapping={departmentMapping}
          initialScenarioAgentId={basicInfoState.scenarioAgentId}
          initialImageAgentId={basicInfoState.imageAgentId}
          initialVideoAgentId={basicInfoState.videoAgentId}
          validAgentIds={scenarioData?.valid_agent_ids || []}
          agentMapping={agentMapping}
          initialActive={basicInfoState.active}
          useVideo={useVideo}
          onNameChange={(name) => handleInputChange("name", name)}
          onDepartmentIdsChange={(ids) =>
            handleInputChange("departmentIds", ids)
          }
          onUseVideoChange={(enabled) => {
            setQ({ useVideo: enabled || null });
            if (!enabled) {
              setContentState((prev) => ({
                ...prev,
                selectedVideo: null,
                activeVideoId: null,
              }));
              setQ({ useQuestions: null });
            }
          }}
          onRandomizeAll={handleRandomizeAll}
          onResetAll={handleResetAll}
          onStateChange={setBasicInfoState}
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
          showSelected={personaShowSelected}
          onPersonaIdsChange={handlePersonaSelect}
          onSearchTermChange={(term) => setQ({ personaSearch: term || null })}
          onMinMaxChange={(minMax) =>
            setQ({ personaMin: minMax.min, personaMax: minMax.max })
          }
          onRandomize={handleRandomizePersonaClient}
          onReset={handleResetPersona}
          onShowSelectedChange={(value) =>
            setQ({ personaShowSelected: value || null })
          }
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
                documentDetails: (() => {
                  const details = scenarioData.document_details as Array<{
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
                  }>;
                  return details;
                })(),
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
          showSelected={documentShowSelected}
          showTemplate={documentShowTemplate}
          onDocumentIdsChange={updateDocumentIds}
          onTemplateDocumentIdsChange={updateTemplateDocumentIds}
          onSearchTermChange={(term) => setQ({ documentSearch: term || null })}
          onShowSelectedChange={(value) =>
            setQ({ documentShowSelected: value || null })
          }
          onShowTemplateChange={(value) =>
            setQ({ documentShowTemplate: value || null })
          }
          onMinMaxChange={(minMax) =>
            setQ({ documentMin: minMax.min, documentMax: minMax.max })
          }
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
          onSearchTermChange={(term) => setQ({ parameterSearch: term || null })}
          onMinMaxChange={(minMax) =>
            setQ({
              parameterSelectionMin: minMax.min,
              parameterSelectionMax: minMax.max,
            })
          }
          onRandomize={handleRandomizeParametersClient}
          onReset={handleResetParameters}
          onParameterUnselect={(paramId) => {
            // When unselecting a parameter, also remove all its parameter items (fields)
            updateFieldIds((prev) =>
              prev.filter(
                (itemId) => fieldMapping[itemId]?.parameter_id !== paramId
              )
            );
          }}
          showSelected={parameterShowSelected}
          onShowSelectedChange={(value) =>
            setQ({ parameterShowSelected: value || null })
          }
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
            // Get full parameter from parameterMapping (has all required fields)
            const fullParam = parameterMapping[paramId] || param;

            return (
              <ParameterItemSection
                key={paramId}
                parameterId={paramId}
                parameter={fullParam as any}
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
                showSelected={
                  (fieldShowSelectedByParam as Record<string, boolean>)[
                    paramId
                  ] || false
                }
                onFieldIdsChange={(newIds) => {
                  // Update only this parameter's items
                  const otherFieldIds = currentFieldIds.filter(
                    (itemId) => fieldMapping[itemId]?.parameter_id !== paramId
                  );
                  updateFieldIds([...otherFieldIds, ...newIds]);
                }}
                onMinMaxChange={(minMax) =>
                  updateFieldRanges((prev) => ({
                    ...prev,
                    [paramId]: minMax,
                  }))
                }
                onRandomize={() => handleRandomizeParameterClient(paramId)}
                onReset={() => handleResetParameter(paramId)}
                onShowSelectedChange={(value) =>
                  updateFieldShowSelected((prev) => ({
                    ...prev,
                    [paramId]: value,
                  }))
                }
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
              problemStatement={problemStatement || ""}
              problemStatementMapping={problemStatementMapping}
              currentProblemStatementIds={currentProblemStatementIds}
              {...(selectedProblemStatementId
                ? { selectedProblemStatementId }
                : {})}
              hasProblemStatementChanges={hasProblemStatementChanges}
              originalProblemStatement={originalProblemStatement}
              useProblemStatement={useProblemStatement}
              initialObjectives={contentState.objectives}
              objectivesHistory={objectivesHistory}
              useObjectives={useObjectives}
              onUseObjectivesChange={(enabled) => {
                setQ({ useObjectives: enabled || null });
              }}
              useImage={useImage}
              initialImage={contentState.image}
              imageMapping={imageMapping}
              isUploadingImage={isUploadingImage}
              allPreviewDocumentIds={allPreviewDocumentIds}
              documentMapping={documentMapping}
              initialScenarioPreviewDocumentId={
                contentState.scenarioPreviewDocumentId
              }
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
                setQ({ problemStatement: originalProblemStatement || null })
              }
              onUseProblemStatementChange={(enabled) => {
                setQ({ useProblemStatement: enabled || null });
                if (!enabled) {
                  setQ({ problemStatement: null });
                }
              }}
              onUseImageChange={(enabled) => {
                setQ({ useImage: enabled || null });
              }}
              onImageUpload={handleImageUpload}
              useVideo={useVideo}
              initialSelectedVideo={contentState.selectedVideo}
              videoMapping={videoMapping}
              initialActiveVideoId={contentState.activeVideoId}
              onUseVideoChange={(enabled) => {
                setQ({ useVideo: enabled || null });
                if (!enabled) {
                  setQ({ useQuestions: null });
                }
              }}
              selectedVideoLength={selectedVideoLength}
              onVideoLengthChange={updateVideoLength}
              useQuestions={useQuestions}
              initialQuestions={contentState.questions}
              initialCurrentQuestionIds={contentState.currentQuestionIds}
              onUseQuestionsChange={(enabled) => {
                setQ({ useQuestions: enabled || null });
              }}
              onStateChange={setContentState}
              onScenarioPreviewDocumentChange={(docId) => {
                setContentState((prev) => ({
                  ...prev,
                  scenarioPreviewDocumentId: docId,
                }));
              }}
              onDocumentRemove={handleDocumentRemove}
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
