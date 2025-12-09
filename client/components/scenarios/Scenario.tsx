/**
 * Scenario.tsx
 * Progressive step-by-step scenario creation flow
 * @AshokSaravanan222 & @siladiea
 * 05/20/2025
 */
"use client";
import {
  Brain,
  Check,
  Eye,
  GripVertical,
  Image,
  Loader2,
  Plus,
  PlusCircle,
  Power,
  RotateCcw,
  Search,
  Shuffle,
  Target,
  Trash2,
  Upload,
} from "lucide-react";
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import DocumentViewer, {
  type DocumentItem,
} from "@/components/common/chat/viewers/DocumentViewer";
import { type DocumentMappingItem } from "@/components/common/forms/DocumentPicker";
import { GenericPicker } from "@/components/common/forms/GenericPicker";
import { ImagePreviewCard } from "@/components/common/forms/ImagePreviewCard";
import { RangeSlider } from "@/components/common/forms/RangeSlider";
import { ParameterSelector } from "@/components/parameters/ParameterSelector";
import { cn } from "@/lib/utils";
import { getPersonaIconComponent } from "@/utils/persona-icons";

// Types and API functions
import type {
  CreateScenarioIn,
  CreateScenarioOut,
  GenerateAIScenarioIn,
  GenerateAIScenarioOut,
  RandomizeScenarioIn,
  RandomizeScenarioOut,
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

// Component for objective input with autocomplete
function ObjectiveInputWithAutocomplete({
  index,
  value,
  onChange,
  placeholder,
  suggestions,
  disabled,
  draggedObjectiveIndex,
  onDragStart,
  onDragOver,
  onDrop,
  onRemove,
  totalObjectives,
  useObjectives,
}: {
  index: number;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  suggestions: string[];
  disabled: boolean;
  draggedObjectiveIndex: number | null;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onRemove: () => void;
  totalObjectives: number;
  useObjectives: boolean;
}) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter suggestions based on current input value (completing the sentence)
  const filteredSuggestions = useMemo(() => {
    if (!value.trim() || !suggestions.length) return [];

    const valueLower = value.toLowerCase().trim();

    // Filter suggestions that start with or contain the typed text
    // Exclude exact matches (case-insensitive) to avoid distraction
    const matching = suggestions
      .filter((s) => {
        const sLower = s.toLowerCase().trim();
        // Skip exact matches
        if (sLower === valueLower) return false;
        // Include if starts with or contains the typed text
        return sLower.startsWith(valueLower) || sLower.includes(valueLower);
      })
      .slice(0, 5); // Show top 5 matches

    return matching;
  }, [suggestions, value]);

  const handleSelect = (suggestion: string) => {
    onChange(suggestion);
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
    setShowSuggestions(true);
  };

  const handleFocus = () => {
    if (value && filteredSuggestions.length > 0) {
      setShowSuggestions(true);
    }
  };

  const handleBlur = () => {
    // Delay hiding suggestions to allow clicks
    setTimeout(() => setShowSuggestions(false), 200);
  };

  return (
    <div
      className={`flex flex-col gap-2 ${
        draggedObjectiveIndex === index ? "opacity-50" : ""
      }`}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <div className="flex items-center gap-2">
        <div
          draggable={!disabled}
          onDragStart={onDragStart}
          className="cursor-grab active:cursor-grabbing shrink-0"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="flex-1 relative">
          <Input
            ref={inputRef}
            value={value}
            onChange={handleInputChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholder={placeholder}
            className="flex-1"
            disabled={disabled}
            onDragStart={(e) => e.preventDefault()} // Prevent dragging from input
          />
          {showSuggestions && !disabled && filteredSuggestions.length > 0 && (
            <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-md max-h-48 overflow-auto">
              <div className="p-1">
                {filteredSuggestions.map((suggestion, idx) => (
                  <div
                    key={idx}
                    onClick={() => handleSelect(suggestion)}
                    onMouseDown={(e) => e.preventDefault()} // Prevent input blur
                    className="px-2 py-1.5 text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground rounded-sm transition-colors"
                  >
                    {suggestion}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        {!(useObjectives && totalObjectives === 1) && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={onRemove}
            className="h-8 w-8 shrink-0"
            disabled={disabled}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

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
  generateAIScenarioAction?: (
    input: GenerateAIScenarioIn
  ) => Promise<GenerateAIScenarioOut>;
  randomizeScenarioAction?: (
    input: RandomizeScenarioIn
  ) => Promise<RandomizeScenarioOut>;
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
  generateAIScenarioAction: _generateAIScenarioAction,
  randomizeScenarioAction: _randomizeScenarioAction,
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

      const handleComplete = (data: {
        success: boolean;
        message: string;
        title: string;
        description: string;
        objectives: string[];
        dynamic_document_mapping?: Record<string, string>;
        trace_id?: string;
      }) => {
        // Clean up listeners
        socket.off("scenario_generation_progress", handleProgress);
        socket.off("scenario_generation_complete", handleComplete);
        socket.off("scenario_generation_error", handleError);

        if (data.success) {
          // Convert toast to success
          const successMessage = isRegenerating
            ? "Scenario regenerated successfully!"
            : "Scenario generated successfully!";
          toast.success(successMessage, { id: toastId });

          resolve({
            success: true,
            message: data.message,
            title: data.title,
            description: data.description,
            objectives: data.objectives,
            dynamic_document_mapping: data.dynamic_document_mapping || null,
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
        // Clean up listeners
        socket.off("scenario_generation_progress", handleProgress);
        socket.off("scenario_generation_complete", handleComplete);
        socket.off("scenario_generation_error", handleError);

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

      // Emit the event
      socket.emit("generate_scenario_ai", {
        departmentId: body.departmentId,
        personaIds: body.personaIds,
        documentIds: body.documentIds,
        fieldIds: body.fieldIds, // Renamed from parameterItemIds
        profileId: body.profileId,
        userInstructions: body.userInstructions,
        objectivesEnabled: body.objectivesEnabled,
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
  // Store problem statement ID for version selection
  const [selectedProblemStatementId, setSelectedProblemStatementId] = useState<
    string | null
  >(null);
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
  const [useObjectives, setUseObjectives] = useState(false);
  const [draggedObjectiveIndex, setDraggedObjectiveIndex] = useState<
    number | null
  >(null);

  // State for junction data (managed separately from scenario)
  const [currentObjectives, setCurrentObjectives] = useState<string[]>([]);
  const [currentFieldIds, setCurrentFieldIds] = useState<string[]>([]);
  const [currentDocumentIds, setCurrentDocumentIds] = useState<string[]>([]);
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
    if (formData.parameterIds && formData.parameterIds.length > 0) {
      params.set("parameterIds", formData.parameterIds.join(","));
    }
    if (currentFieldIds.length > 0) {
      // Renamed from currentParameterItemIds
      params.set("fieldIds", currentFieldIds.join(",")); // Renamed from parameterItemIds
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
    formData.parameterIds,
    currentFieldIds,
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
    formData.parameterIds,
    currentFieldIds, // Renamed from currentParameterItemIds
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
      setSelectedProblemStatementId(scenarioData.problem_statement_id || null);
      // Clear local versions when loading existing scenario (edit mode)
      setLocalProblemStatementVersions([]);
      setCurrentDocumentIds(scenarioData.document_ids);
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
      // Load objectives_enabled
      setUseObjectives(scenarioDataWithFlags.objectives_enabled ?? false);
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
      if (newData.selected_field_ids) {
        setCurrentFieldIds(newData.selected_field_ids);
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
  ]);

  // Sync selectedProblemStatementId with server data when it changes (e.g., after save/refetch)
  useEffect(() => {
    if (
      isEditMode &&
      scenarioData?.problem_statement_id &&
      formDataInitializedRef.current
    ) {
      // Only update if the ID changed and form is already initialized
      // This handles refetches after save operations
      setSelectedProblemStatementId(scenarioData.problem_statement_id);
    }
  }, [scenarioData?.problem_statement_id, isEditMode]);

  // Reset initialization flag when switching between edit/create modes or scenario changes
  useEffect(() => {
    formDataInitializedRef.current = false;
  }, [scenarioId, isEditMode]);

  // Auto-select agents when there's only one option (similar to Document.tsx)
  useEffect(() => {
    if (!scenarioData || !agentMapping) return;

    const scenarioAgentIds =
      scenarioData.valid_agent_ids?.filter((id) => {
        const agent = agentMapping[id];
        return agent?.roles?.includes("scenario");
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
    currentFieldIds, // Renamed from currentParameterItemIds
    originalFieldIds, // Renamed from originalParameterItemIds
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
      setSelectedProblemStatementId(null);
      toast.success("Scenario content reset");
    } catch {
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
    shouldRegenerateObjectives?: boolean
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

      if (result.title || result.description) {
        const newProblemStatement =
          result.description || formData.problemStatement || "";

        // Handle dynamic document mapping: replace parent document IDs with child document IDs
        let updatedDocumentIds = currentDocumentIds;
        if (result.dynamic_document_mapping) {
          const mapping = result.dynamic_document_mapping;
          // Replace each parent ID with its corresponding child ID if it exists in mapping
          updatedDocumentIds = currentDocumentIds.map(
            (docId) => mapping[docId] || docId
          );
          setCurrentDocumentIds(updatedDocumentIds);
          toast.success(
            `Created ${Object.keys(mapping).length} dynamic document(s) from templates`
          );
        }

        // If in create mode and we have a new problem statement, add it to local versions
        if (!isEditMode && newProblemStatement.trim()) {
          const now = new Date().toISOString();
          const versionId = `local-${Date.now()}`;
          setLocalProblemStatementVersions((prev) => [
            ...prev,
            {
              id: versionId,
              problem_statement: newProblemStatement,
              created_at: now,
              updated_at: now,
            },
          ]);
          setSelectedProblemStatementId(versionId);
        }

        setFormData((prev) => ({
          ...prev,
          // Only replace name if it's still the default "New Scenario"
          name:
            prev.name === "New Scenario" ||
            !prev.name ||
            prev.name.trim() === ""
              ? result.title || prev.name || "New Scenario"
              : prev.name,
          problemStatement: newProblemStatement,
        }));

        // If in edit mode, immediately save the new problem statement to create a version
        if (isEditMode && scenarioId && newProblemStatement.trim()) {
          // Clear selected version temporarily - it will be set by the refetch after save
          setSelectedProblemStatementId(null);
          // Save immediately to create new version in database
          try {
            await updateScenario({
              scenarioId: scenarioId,
              name: formData.name,
              problem_statement: newProblemStatement,
              department_ids:
                formData.departmentIds.length > 0
                  ? formData.departmentIds
                  : null,
              active: formData.active,
              persona_ids: selectedPersonaIds,
              document_ids: updatedDocumentIds, // Use updated IDs with child documents
              objective_ids: currentObjectives.filter((obj) => obj.trim()),
              parameters: groupFieldsByParameterId(
                currentFieldIds, // Renamed from currentParameterItemIds
                fieldMapping // Renamed from parameterItemMapping
              ),
              documents_enabled: useDocuments,
              document_vision_enabled: documentVisionEnabled,
              objectives_enabled: useObjectives,
              image_enabled: useImage,
              scenario_agent_id: formData.scenarioAgentId || null,
              image_agent_id: formData.imageAgentId || null,
            });
            // Query will refetch automatically via mutation's onSuccess invalidation
            // The useEffect watching problem_statement_id will update selectedProblemStatementId
            toast.success("Problem statement regenerated and saved!");
          } catch (error) {
            toast.error(
              `Failed to save regenerated problem statement: ${error instanceof Error ? error.message : "Unknown error"}`
            );
          }
        }
        // Update objectives only if regenerateObjectives is true and objectives are enabled
        if (
          shouldRegenerateObjectives &&
          result.objectives &&
          result.objectives.length > 0
        ) {
          setCurrentObjectives(result.objectives);
        }
        // Toast is already handled in handleGenerateAIScenario
      } else {
        throw new Error("No scenario content was generated");
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
            objectives_enabled: useObjectives,
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
            objectives_enabled: useObjectives,
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
        {/* Step 1: Basic Information - Subtle inline name editor */}
        <Card className="transition-all">
          <CardContent className="pt-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium bg-green-500 text-white shrink-0">
                <Check className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <input
                  type="text"
                  data-testid="input-scenario-title"
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
              <div className="flex items-center gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleRandomizeAll}
                      disabled={isReadonly}
                    >
                      <Shuffle className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Randomize All</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleResetAll}
                      disabled={isReadonly}
                    >
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Reset All</TooltipContent>
                </Tooltip>
              </div>
            </div>
          </CardContent>
          <CardContent className="pt-0 space-y-4">
            {/* Department Selection */}
            {scenarioData?.valid_department_ids &&
            scenarioData.valid_department_ids.length > 1 ? (
              <div className="space-y-2">
                <Label htmlFor="department">Department</Label>
                {formData?.departmentIds !== undefined ? (
                  <GenericPicker
                    items={departmentMapping}
                    itemIds={Array.from(
                      new Set([
                        ...(scenarioData?.valid_department_ids || []),
                        ...(formData.departmentIds || []),
                      ])
                    )}
                    selectedIds={formData.departmentIds || []}
                    onSelect={(ids) => handleInputChange("departmentIds", ids)}
                    getId={(dept) => (dept as unknown as { id: string }).id}
                    getLabel={(dept) => dept.name || ""}
                    getSearchText={(dept) =>
                      `${dept.name} ${dept.description || ""}`
                    }
                    placeholder="All Departments"
                    disabled={isReadonly}
                    multiSelect={true}
                    hideSelectedChips={true}
                    buttonClassName="w-full"
                  />
                ) : null}
              </div>
            ) : null}

            {/* Agent Selection */}
            {(() => {
              const scenarioAgentIds =
                scenarioData?.valid_agent_ids?.filter((id) => {
                  const agent = agentMapping[id];
                  return agent?.roles?.includes("scenario");
                }) || [];

              const imageAgentIds =
                scenarioData?.valid_agent_ids?.filter((id) => {
                  const agent = agentMapping[id];
                  return agent?.roles?.includes("image");
                }) || [];

              // Only show agent pickers if there's more than one option
              const showScenarioPicker = scenarioAgentIds.length > 1;
              const showImagePicker = imageAgentIds.length > 1;

              if (!showScenarioPicker && !showImagePicker) {
                return null;
              }

              return (
                <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
                  {/* Scenario Agent Selection */}
                  {showScenarioPicker && (
                    <div className="space-y-2">
                      <Label htmlFor="scenarioAgentId">Scenario Agent</Label>
                      {formData?.scenarioAgentId !== undefined ? (
                        <GenericPicker
                          items={agentMapping}
                          itemIds={scenarioAgentIds}
                          selectedIds={
                            formData?.scenarioAgentId
                              ? [formData.scenarioAgentId]
                              : []
                          }
                          onSelect={(ids) =>
                            setFormData((prev) => ({
                              ...prev,
                              scenarioAgentId: ids[0] || null,
                            }))
                          }
                          getId={(item) =>
                            (item as unknown as { id: string }).id
                          }
                          getLabel={(item) => item.name || ""}
                          getSearchText={(item) =>
                            `${item.name} ${item.description || ""}`
                          }
                          renderPreview={(item) => (
                            <div className="grid gap-2">
                              <h4 className="font-medium leading-none">
                                {item.name || "No agent selected"}
                              </h4>
                              <div className="text-sm text-muted-foreground">
                                {item.description || "No description available"}
                              </div>
                            </div>
                          )}
                          renderItem={(item, _isSelected) => (
                            <div className="flex items-center justify-between w-full">
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <div className="flex-1 min-w-0">
                                  <div className="truncate">{item.name}</div>
                                  {item.description && (
                                    <div className="text-xs text-muted-foreground mt-1 truncate group-data-[selected=true]:text-primary-foreground group-data-[highlighted=true]:text-primary-foreground">
                                      {item.description}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                          placeholder="Select scenario agent"
                          disabled={isReadonly}
                          multiSelect={false}
                          hideSelectedChips={true}
                          buttonClassName="w-full"
                          groupHeading="Agents"
                        />
                      ) : null}
                    </div>
                  )}

                  {/* Image Agent Selection */}
                  {showImagePicker && (
                    <div className="space-y-2">
                      <Label htmlFor="imageAgentId">Image Agent</Label>
                      {formData?.imageAgentId !== undefined ? (
                        <GenericPicker
                          items={agentMapping}
                          itemIds={imageAgentIds}
                          selectedIds={
                            formData?.imageAgentId
                              ? [formData.imageAgentId]
                              : []
                          }
                          onSelect={(ids) =>
                            setFormData((prev) => ({
                              ...prev,
                              imageAgentId: ids[0] || null,
                            }))
                          }
                          getId={(item) =>
                            (item as unknown as { id: string }).id
                          }
                          getLabel={(item) => item.name || ""}
                          getSearchText={(item) =>
                            `${item.name} ${item.description || ""}`
                          }
                          renderPreview={(item) => (
                            <div className="grid gap-2">
                              <h4 className="font-medium leading-none">
                                {item.name || "No agent selected"}
                              </h4>
                              <div className="text-sm text-muted-foreground">
                                {item.description || "No description available"}
                              </div>
                            </div>
                          )}
                          renderItem={(item, _isSelected) => (
                            <div className="flex items-center justify-between w-full">
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <div className="flex-1 min-w-0">
                                  <div className="truncate">{item.name}</div>
                                  {item.description && (
                                    <div className="text-xs text-muted-foreground mt-1 truncate group-data-[selected=true]:text-primary-foreground group-data-[highlighted=true]:text-primary-foreground">
                                      {item.description}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                          placeholder="Select image agent"
                          disabled={isReadonly}
                          multiSelect={false}
                          hideSelectedChips={true}
                          buttonClassName="w-full"
                          groupHeading="Agents"
                        />
                      ) : null}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Active Switch */}
            <div className="space-y-2 pt-2">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Label
                    htmlFor="active"
                    className="text-sm flex items-center gap-1.5"
                  >
                    <Power className="h-3.5 w-3.5 text-muted-foreground" />
                    Active
                  </Label>
                  <Switch
                    id="active"
                    data-testid="switch-scenario-active"
                    checked={formData.active ?? true}
                    onCheckedChange={(checked) =>
                      handleInputChange("active", checked)
                    }
                    disabled={isReadonly}
                  />
                </div>
                <p className="text-xs text-muted-foreground pl-5">
                  Inactive scenarios will not be available for other simulations
                </p>
              </div>
            </div>
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
          <CardHeader className="flex flex-row items-center space-y-0 pb-2 justify-between">
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
            <div className="flex items-center">
              <RangeSlider
                min={1}
                max={Math.min(5, validPersonaIds.length)}
                value={[
                  personaMinMax.min ?? 1,
                  Math.min(
                    Math.min(5, validPersonaIds.length),
                    personaMinMax.max ?? 2
                  ),
                ]}
                onValueChange={([min, max]) =>
                  setPersonaMinMax({
                    min: min ?? 1,
                    max: Math.min(
                      Math.min(5, validPersonaIds.length),
                      max ?? 2
                    ),
                  })
                }
                disabled={isReadonly}
                className="w-[200px] mr-4"
              />
              <div className="flex items-center gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleRandomizePersonaClient}
                      disabled={isReadonly}
                    >
                      <Shuffle className="h-4 w-4" />
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
            </div>
          </CardHeader>
          <CardContent className="space-y-3 px-6">
            {/* Search bar */}
            <div className="flex h-9 items-center gap-2 border-b px-0">
              <Search className="size-4 shrink-0 opacity-50" />
              <input
                type="text"
                placeholder="Search personas..."
                value={personaSearchTerm}
                onChange={(e) => setPersonaSearchTerm(e.target.value)}
                className="placeholder:text-muted-foreground flex h-9 w-full bg-transparent py-2 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            {/* Filtered personas grid */}
            <div className="grid grid-cols-2 gap-4 min-h-[272px] max-h-[272px] overflow-y-auto py-2 -mx-6 px-6">
              {useMemo(() => {
                if (!personaSearchTerm.trim()) {
                  return validPersonaIds;
                }
                const searchLower = personaSearchTerm.toLowerCase();
                return validPersonaIds.filter((personaId) => {
                  const persona = personaMapping[personaId];
                  if (!persona) return false;
                  const searchText =
                    `${persona.name} ${persona.description || ""}`.toLowerCase();
                  return searchText.includes(searchLower);
                });
              }, [validPersonaIds, personaMapping, personaSearchTerm]).map(
                (personaId) => {
                  const persona = personaMapping[personaId];
                  if (!persona) return null;

                  const IconComponent =
                    getPersonaIconComponent(persona.icon) || Brain;
                  const hexColor = persona.color || "#64748b";
                  const generateGradient = (hex: string) => {
                    const cleanHex = hex.replace("#", "");
                    const r = parseInt(cleanHex.substr(0, 2), 16);
                    const g = parseInt(cleanHex.substr(2, 2), 16);
                    const b = parseInt(cleanHex.substr(4, 2), 16);
                    const lighterR = Math.min(255, r + 60);
                    const lighterG = Math.min(255, g + 60);
                    const lighterB = Math.min(255, b + 60);
                    const lighterHex = `#${lighterR.toString(16).padStart(2, "0")}${lighterG.toString(16).padStart(2, "0")}${lighterB.toString(16).padStart(2, "0")}`;
                    return `linear-gradient(135deg, ${lighterHex} 0%, ${hex} 100%)`;
                  };

                  const isSelected = selectedPersonaIds.includes(personaId);

                  return (
                    <button
                      key={personaId}
                      type="button"
                      onClick={() => {
                        if (isReadonly) return;
                        const newIds = isSelected
                          ? selectedPersonaIds.filter((id) => id !== personaId)
                          : [...selectedPersonaIds, personaId];
                        handlePersonaSelect(newIds);
                      }}
                      disabled={isReadonly}
                      className={cn(
                        "relative flex flex-col gap-3 p-4 rounded-xl border bg-card text-card-foreground shadow-sm transition-all text-left",
                        "hover:shadow-md hover:bg-accent/50",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                        "disabled:pointer-events-none disabled:opacity-50",
                        isSelected && "ring-2 ring-primary bg-accent"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className="p-2 rounded-lg shadow-lg flex-shrink-0"
                          style={{
                            background: generateGradient(hexColor),
                          }}
                        >
                          <IconComponent className="h-5 w-5 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm">
                            {persona.name}
                          </div>
                          {persona.description && (
                            <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {persona.description}
                            </div>
                          )}
                        </div>
                        {isSelected && (
                          <Check className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                        )}
                      </div>
                    </button>
                  );
                }
              )}
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
          <CardHeader className="flex flex-row items-center space-y-0 pb-2 justify-between">
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
                </div>
                <CardDescription>{steps[2]?.description || ""}</CardDescription>
              </div>
            </div>
            <div className="flex items-center">
              <RangeSlider
                min={0}
                max={Math.min(5, validDocumentIds.length)}
                value={[
                  documentMinMax.min ?? 0,
                  Math.min(
                    Math.min(5, validDocumentIds.length),
                    documentMinMax.max ?? 2
                  ),
                ]}
                onValueChange={([min, max]) =>
                  setDocumentMinMax({
                    min: min ?? 0,
                    max: Math.min(
                      Math.min(5, validDocumentIds.length),
                      max ?? 2
                    ),
                  })
                }
                disabled={isReadonly}
                className="w-[200px] mr-4"
              />
              <div className="flex items-center gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleRandomizeDocumentsClient}
                      disabled={isReadonly}
                    >
                      <Shuffle className="h-4 w-4" />
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
            </div>
          </CardHeader>
          <CardContent className="space-y-3 px-6">
            {/* Search bar */}
            <div className="flex h-9 items-center gap-2 border-b px-0">
              <Search className="size-4 shrink-0 opacity-50" />
              <input
                type="text"
                placeholder="Search documents..."
                value={documentSearchTerm}
                onChange={(e) => setDocumentSearchTerm(e.target.value)}
                className="placeholder:text-muted-foreground flex h-9 w-full bg-transparent py-2 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            {/* Filtered documents grid */}
            <div className="grid grid-cols-3 gap-4 min-h-[272px] max-h-[272px] overflow-y-auto py-2 -mx-6 px-6">
              {useMemo(() => {
                if (!documentSearchTerm.trim()) {
                  return validDocumentIds;
                }
                const searchLower = documentSearchTerm.toLowerCase();
                return validDocumentIds.filter((docId) => {
                  const doc = documentMapping[docId];
                  if (!doc) return false;
                  const searchText =
                    `${doc.name} ${doc.description || ""}`.toLowerCase();
                  return searchText.includes(searchLower);
                });
              }, [validDocumentIds, documentMapping, documentSearchTerm]).map(
                (docId) => {
                  const document = documentMapping[docId];
                  if (!document) return null;

                  const isSelected = currentDocumentIds.includes(docId);
                  const fullDoc = scenarioData?.document_details?.find(
                    (d) => d.document_id === docId
                  );

                  // Create document item for DocumentViewer
                  const docForViewer: DocumentItem = fullDoc
                    ? ({
                        ...fullDoc,
                        upload_id: fullDoc.upload_id ?? null,
                        parameter_item_ids: [],
                        field_ids: [],
                      } as DocumentItem)
                    : ({
                        document_id: docId,
                        name: document.name || "Document",
                        updatedAt: new Date().toISOString(),
                        extension: "",
                        scenario_ids: [],
                        can_edit: false,
                        can_delete: false,
                        active: true,
                        department_ids: [],
                        field_ids: [],
                        parameter_item_ids: [],
                        upload_id: null,
                      } as DocumentItem);

                  return (
                    <button
                      key={docId}
                      type="button"
                      onClick={() => {
                        if (isReadonly) return;
                        const newIds = isSelected
                          ? currentDocumentIds.filter((id) => id !== docId)
                          : [...currentDocumentIds, docId].slice(
                              0,
                              documentMinMax.max
                            ); // Max documents from range slider
                        setCurrentDocumentIds(newIds);
                      }}
                      disabled={
                        isReadonly ||
                        (!isSelected &&
                          currentDocumentIds.length >=
                            (documentMinMax.max ?? 2))
                      }
                      className={cn(
                        "relative aspect-square rounded-xl border bg-card text-card-foreground shadow-sm transition-all overflow-hidden",
                        "hover:shadow-md",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                        "disabled:pointer-events-none disabled:opacity-50",
                        isSelected && "ring-2 ring-primary"
                      )}
                    >
                      {/* Preview button - top left */}
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          setPreviewDocumentId(docId);
                        }}
                        className="absolute top-2 left-2 z-10 h-6 w-6 bg-primary rounded-full flex items-center justify-center hover:bg-primary/90 transition-colors cursor-pointer"
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            e.stopPropagation();
                            setPreviewDocumentId(docId);
                          }
                        }}
                      >
                        <Eye className="h-3.5 w-3.5 text-primary-foreground" />
                      </div>

                      {/* Check icon - top right */}
                      {isSelected && (
                        <div className="absolute top-2 right-2 z-10 h-6 w-6 bg-primary rounded-full flex items-center justify-center">
                          <Check className="h-3.5 w-3.5 text-primary-foreground" />
                        </div>
                      )}

                      {/* Document preview */}
                      <div className="w-full h-full">
                        <DocumentViewer
                          document={docForViewer}
                          bare={true}
                          isFormDocument={false}
                          compact={true}
                        />
                      </div>

                      {/* Document name at bottom */}
                      <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-xs px-2 py-1">
                        <span className="truncate block">{document.name}</span>
                      </div>
                    </button>
                  );
                }
              )}
            </div>
          </CardContent>

          {/* Preview Dialog */}
          <Dialog
            open={previewDocumentId !== null}
            onOpenChange={(open) => !open && setPreviewDocumentId(null)}
          >
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
              <DialogHeader>
                <DialogTitle>
                  {previewDocumentId
                    ? documentMapping[previewDocumentId]?.name
                    : "Document Preview"}
                </DialogTitle>
                <DialogDescription>Preview document content</DialogDescription>
              </DialogHeader>
              {previewDocumentId &&
                (() => {
                  const docId = previewDocumentId;
                  const fullDoc = scenarioData?.document_details?.find(
                    (d) => d.document_id === docId
                  );
                  const docForViewer: DocumentItem = fullDoc
                    ? ({
                        ...fullDoc,
                        upload_id: fullDoc.upload_id ?? null,
                        parameter_item_ids: [],
                        field_ids: [],
                      } as DocumentItem)
                    : ({
                        document_id: docId,
                        name: documentMapping[docId]?.name || "Document",
                        updatedAt: new Date().toISOString(),
                        extension: "",
                        scenario_ids: [],
                        can_edit: false,
                        can_delete: false,
                        active: true,
                        department_ids: [],
                        field_ids: [],
                        parameter_item_ids: [],
                        upload_id: null,
                      } as DocumentItem);
                  return (
                    <div className="mt-4">
                      <DocumentViewer
                        document={docForViewer}
                        bare={true}
                        isFormDocument={false}
                      />
                    </div>
                  );
                })()}
            </DialogContent>
          </Dialog>
        </Card>

        {/* Step 4: Parameters */}
        <Card
          className={`transition-all ${!isEditMode && getStepStatus("parameters") === "active" ? "ring-2 ring-primary" : ""} ${
            !isEditMode && getStepStatus("parameters") === "pending"
              ? "opacity-50"
              : ""
          }`}
        >
          <CardHeader className="flex flex-row items-center space-y-0 pb-2 justify-between">
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
            <div className="flex items-center">
              {scenarioData?.valid_parameter_ids &&
              scenarioData.valid_parameter_ids.length > 0 ? (
                <>
                  <RangeSlider
                    min={0}
                    max={Math.min(5, scenarioData.valid_parameter_ids.length)}
                    value={[
                      parameterSelectionMinMax.min ?? 0,
                      Math.min(
                        Math.min(5, scenarioData.valid_parameter_ids.length),
                        parameterSelectionMinMax.max ?? 5
                      ),
                    ]}
                    onValueChange={([min, max]) =>
                      setParameterSelectionMinMax({
                        min: min ?? 0,
                        max: Math.min(
                          Math.min(5, scenarioData.valid_parameter_ids.length),
                          max ?? 5
                        ),
                      })
                    }
                    disabled={isReadonly}
                    className="w-[200px] mr-4"
                  />
                  <div className="flex items-center gap-2">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={handleRandomizeParametersClient}
                          disabled={isReadonly}
                        >
                          <Shuffle className="h-4 w-4" />
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
                </>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="space-y-3 px-6">
            {(() => {
              const validParamIds = scenarioData?.valid_parameter_ids || [];

              if (validParamIds.length === 0) {
                return null;
              }

              // Filter parameters based on search term
              const filteredParameterIds = !parameterSearchTerm.trim()
                ? validParamIds
                : validParamIds.filter((paramId) => {
                    const param = parameterMapping[paramId];
                    if (!param) return false;
                    const searchLower = parameterSearchTerm.toLowerCase();
                    const searchText =
                      `${param.name} ${param.description || ""}`.toLowerCase();
                    return searchText.includes(searchLower);
                  });

              return (
                <>
                  {/* Search bar */}
                  <div className="flex h-9 items-center gap-2 border-b px-0">
                    <Search className="size-4 shrink-0 opacity-50" />
                    <input
                      type="text"
                      placeholder="Search parameters..."
                      value={parameterSearchTerm}
                      onChange={(e) => setParameterSearchTerm(e.target.value)}
                      className="placeholder:text-muted-foreground flex h-9 w-full bg-transparent py-2 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-50"
                    />
                  </div>

                  {/* Filtered parameters grid */}
                  <div className="grid grid-cols-4 gap-4 min-h-[272px] max-h-[272px] overflow-y-auto py-2 -mx-6 px-6">
                    {filteredParameterIds.map((paramId) => {
                      const param = parameterMapping[paramId];
                      if (!param) return null;

                      const isSelected = (formData.parameterIds || []).includes(
                        paramId
                      );

                      return (
                        <button
                          key={paramId}
                          type="button"
                          onClick={() => {
                            if (isReadonly) return;
                            const currentIds = formData.parameterIds || [];
                            const newIds = isSelected
                              ? currentIds.filter((id) => id !== paramId)
                              : [...currentIds, paramId];
                            handleInputChange("parameterIds", newIds);

                            // When unselecting a parameter, also remove all its parameter items (fields)
                            if (isSelected) {
                              setCurrentFieldIds((prev) =>
                                prev.filter(
                                  (itemId) =>
                                    fieldMapping[itemId]?.parameter_id !==
                                    paramId
                                )
                              );
                            }
                          }}
                          disabled={isReadonly}
                          className={cn(
                            "relative flex flex-col gap-3 p-4 rounded-xl border bg-card text-card-foreground shadow-sm transition-all text-left",
                            "hover:shadow-md hover:bg-accent/50",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                            "disabled:pointer-events-none disabled:opacity-50",
                            isSelected && "ring-2 ring-primary bg-accent"
                          )}
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm">
                                {param.name}
                              </div>
                              {param.description && (
                                <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                  {param.description}
                                </div>
                              )}
                            </div>
                            {isSelected && (
                              <Check className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </>
              );
            })()}
          </CardContent>
        </Card>

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
              <Card
                key={paramId}
                className={`transition-all ${!isEditMode && stepStatus === "active" ? "ring-2 ring-primary" : ""} ${
                  !isEditMode && stepStatus === "pending" ? "opacity-50" : ""
                }`}
              >
                <CardHeader className="flex flex-row items-center space-y-0 pb-2 justify-between">
                  <div className="flex items-center space-x-3">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                        stepStatus === "completed"
                          ? "bg-green-500 text-white"
                          : stepStatus === "active"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                      }`}
                    >
                      {stepStatus === "completed" ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        String(stepIndex + 1)
                      )}
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-lg">{param.name}</CardTitle>
                      <CardDescription>
                        {param.description || ""}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <RangeSlider
                      min={1}
                      max={Math.min(5, validItemsForParam.length)}
                      value={[
                        fieldMinMax[paramId]?.min ?? 1,
                        Math.min(
                          Math.min(5, validItemsForParam.length),
                          fieldMinMax[paramId]?.max ?? 2
                        ),
                      ]}
                      onValueChange={([min, max]) =>
                        setFieldMinMax((prev) => ({
                          ...prev,
                          [paramId]: {
                            min,
                            max: Math.min(
                              Math.min(5, validItemsForParam.length),
                              max
                            ),
                          },
                        }))
                      }
                      disabled={isReadonly}
                      className="w-[200px] mr-4"
                    />
                    <div className="flex items-center gap-2">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              handleRandomizeParameterClient(paramId)
                            }
                            disabled={isReadonly}
                          >
                            <Shuffle className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Randomize</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleResetParameter(paramId)}
                            disabled={isReadonly}
                          >
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Reset</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="px-6">
                  <div className="[&_label.text-sm.font-medium]:hidden">
                    <ParameterSelector
                      parameterMapping={{ [paramId]: param }}
                      fieldMapping={fieldMapping}
                      validParameterItemIds={validItemsForParam}
                      selectedParameterItemIds={selectedItemsForParam}
                      onParameterItemIdsChange={(newIds) => {
                        // Update only this parameter's items
                        const otherFieldIds = currentFieldIds.filter(
                          (itemId) =>
                            fieldMapping[itemId]?.parameter_id !== paramId
                        );
                        setCurrentFieldIds([...otherFieldIds, ...newIds]);
                      }}
                      disabled={isReadonly}
                    />
                  </div>
                </CardContent>
              </Card>
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
                      String(contentStepNumber)
                    )}
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-lg">
                      {contentStepIndex >= 0
                        ? steps[contentStepIndex]?.title || ""
                        : ""}
                    </CardTitle>
                    <CardDescription>
                      {contentStepIndex >= 0
                        ? steps[contentStepIndex]?.description || ""
                        : ""}
                    </CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {Object.keys(problemStatementMapping).length > 0 && (
                    <div className="flex items-center gap-2">
                      <GenericPicker
                        items={problemStatementMapping}
                        itemIds={Object.keys(problemStatementMapping)}
                        selectedIds={
                          selectedProblemStatementId
                            ? [selectedProblemStatementId]
                            : []
                        }
                        onSelect={(ids) => {
                          const id = ids[0] || null;
                          setSelectedProblemStatementId(id);
                          if (id && problemStatementMapping[id]) {
                            handleInputChange(
                              "problemStatement",
                              problemStatementMapping[id].problem_statement
                            );
                          }
                        }}
                        getId={(item) => (item as unknown as { id: string }).id}
                        getLabel={(item) => {
                          const date = new Date(item.updated_at);
                          return `Version ${date.toLocaleDateString()}`;
                        }}
                        getSearchText={(item) => {
                          const date = new Date(item.updated_at);
                          const preview = item.problem_statement.substring(
                            0,
                            100
                          );
                          return `${date.toLocaleDateString()} ${preview}`;
                        }}
                        renderButton={(selectedItems) => {
                          if (selectedItems.length === 0) {
                            return "New Problem Statement";
                          }
                          const problemStatement = selectedItems[0];
                          const date = problemStatement?.updated_at
                            ? new Date(problemStatement.updated_at)
                            : new Date();
                          return `Version ${date.toLocaleDateString()}`;
                        }}
                        renderItem={(item, isSelected) => {
                          const date = new Date(item.updated_at);
                          const preview = item.problem_statement.substring(
                            0,
                            100
                          );
                          return (
                            <div className="flex flex-col items-start py-3 w-full">
                              <div className="flex items-center justify-between w-full">
                                <div className="flex items-center gap-2">
                                  <Check
                                    className={cn(
                                      "h-4 w-4",
                                      isSelected ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  <span className="font-medium">
                                    {date.toLocaleDateString()}{" "}
                                    {date.toLocaleTimeString()}
                                  </span>
                                </div>
                              </div>
                              <span className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                {preview}
                                {item.problem_statement.length > 100
                                  ? "..."
                                  : ""}
                              </span>
                            </div>
                          );
                        }}
                        disabled={isReadonly}
                        multiSelect={false}
                        hideSelectedChips={true}
                        buttonClassName="h-9 justify-between"
                        groupHeading="Version History"
                        placeholder="Select problem statement version..."
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedProblemStatementId(null);
                          handleInputChange("problemStatement", "");
                        }}
                        disabled={isReadonly}
                        className="h-9"
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        New
                      </Button>
                    </div>
                  )}
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    disabled={isUploadingImage || isReadonly}
                    className="hidden"
                  />
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
                        handleGenerateScenario(undefined, true);
                      }
                    }}
                    disabled={
                      isSubmitting || isGeneratingScenario || isReadonly
                    }
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
                {/* Image Preview or Upload Card */}
                {useImage && (
                  <div className="mb-4 w-1/4">
                    {image ? (
                      <ImagePreviewCard
                        image={image}
                        onRemove={() => setImage(null)}
                        showActions={!isReadonly}
                      />
                    ) : (
                      <div
                        onClick={() => {
                          if (!isReadonly && !isUploadingImage) {
                            imageInputRef.current?.click();
                          }
                        }}
                        className="aspect-square border-2 border-dashed border-muted-foreground/50 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-muted-foreground hover:bg-muted/50 transition-colors bg-muted/20"
                      >
                        <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground text-center px-4">
                          Click to upload image
                        </p>
                      </div>
                    )}
                  </div>
                )}
                <div className="space-y-2">
                  <Textarea
                    id="description"
                    data-testid="input-scenario-problem-statement"
                    value={formData.problemStatement || ""}
                    onChange={(e) => {
                      handleInputChange("problemStatement", e.target.value);
                      // Clear selected version when user manually edits
                      if (selectedProblemStatementId) {
                        setSelectedProblemStatementId(null);
                      }
                    }}
                    placeholder="Enter a custom problem statement or leave blank to auto-generate..."
                    className="min-h-[120px]"
                    disabled={isReadonly}
                  />
                </div>

                {/* Use Image and Use Objectives Switches */}
                <div className="space-y-4 pt-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Label
                        htmlFor="use-image"
                        className="text-sm flex items-center gap-1.5"
                      >
                        <Image
                          className="h-3.5 w-3.5 text-muted-foreground"
                          aria-label="Image icon"
                        />
                        Use Image
                      </Label>
                      <Switch
                        id="use-image"
                        checked={useImage}
                        onCheckedChange={(checked) => {
                          setUseImage(checked);
                          if (!checked) {
                            setImage(null);
                          }
                        }}
                        disabled={isReadonly}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground pl-5">
                      Use scenario background image
                    </p>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Label
                        htmlFor="use-objectives"
                        className="text-sm flex items-center gap-1.5"
                      >
                        <Target className="h-3.5 w-3.5 text-muted-foreground" />
                        Use Objectives
                      </Label>
                      <Switch
                        id="use-objectives"
                        checked={useObjectives}
                        onCheckedChange={(checked) => {
                          setUseObjectives(checked);
                          if (checked) {
                            // Ensure at least one objective when enabled
                            if (currentObjectives.length === 0) {
                              setCurrentObjectives([""]);
                            }
                          } else {
                            // Clear objectives when disabled
                            setCurrentObjectives([]);
                          }
                        }}
                        disabled={isReadonly}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground pl-5">
                      Use learning objectives
                    </p>
                  </div>
                </div>

                {/* Objectives List - Only visible when useObjectives is true */}
                {useObjectives && (
                  <div className="space-y-2">
                    {currentObjectives.length === 0 && (
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
                    {currentObjectives.map((objective, index) => (
                      <ObjectiveInputWithAutocomplete
                        key={`objective-${index}`}
                        index={index}
                        value={objective || ""}
                        onChange={(value) => updateObjective(index, value)}
                        placeholder={`Learning objective ${index + 1}`}
                        suggestions={objectivesHistory}
                        disabled={isReadonly}
                        draggedObjectiveIndex={draggedObjectiveIndex}
                        onDragStart={(e) => handleDragStartObjective(e, index)}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDropObjective(e, index)}
                        onRemove={() => removeObjective(index)}
                        totalObjectives={currentObjectives.length}
                        useObjectives={useObjectives}
                      />
                    ))}

                    {currentObjectives.length < 3 &&
                      currentObjectives.length > 0 && (
                        <div>
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={addObjective}
                            disabled={isReadonly}
                            size="sm"
                          >
                            <PlusCircle className="h-4 w-4 mr-2" /> Add
                            objective
                          </Button>
                        </div>
                      )}
                  </div>
                )}
              </CardContent>
            </Card>
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
