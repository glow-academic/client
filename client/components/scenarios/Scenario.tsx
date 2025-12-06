/**
 * Scenario.tsx
 * Progressive step-by-step scenario creation flow
 * @AshokSaravanan222 & @siladiea
 * 05/20/2025
 */
"use client";
import {
  Check,
  Eye,
  GripVertical,
  Image,
  Loader2,
  PlusCircle,
  Power,
  RotateCcw,
  Shuffle,
  Target,
  Trash2,
  Upload,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
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
import {
  DocumentPicker,
  type DocumentMappingItem,
} from "@/components/common/forms/DocumentPicker";
import { ImagePreviewCard } from "@/components/common/forms/ImagePreviewCard";
import { PersonaPicker } from "@/components/common/forms/PersonaPicker";
import { ProblemStatementPicker } from "@/components/common/forms/ProblemStatementPicker";
import { ParameterSelector } from "@/components/parameters/ParameterSelector";

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
import { AgentPicker } from "@/components/common/forms/AgentPicker";
import { DepartmentPicker } from "@/components/common/forms/DepartmentPicker";
import { useBreadcrumbContext } from "@/contexts/breadcrumb-context";
import { useProfile } from "@/contexts/profile-context";
import {
  getDefaultDepartmentIds,
  transformDepartmentIdsForSubmit,
} from "@/utils/department-picker-helpers";
import {
  getObjectivesFromMapping,
  getParameterItemIdsFromStructure,
  groupParameterItemsByParameterId,
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
  randomizeScenarioAction,
}: ScenarioProps) {
  const router = useRouter();
  const { effectiveProfile, socket, isConnected } = useProfile();
  const { setEntityMetadata, clearEntityMetadata } = useBreadcrumbContext();
  const isEditMode = mode === "edit" && !!scenarioId;
  const isSuperadmin = effectiveProfile?.role === "superadmin";

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
  type GenerateAIScenarioBody = GenerateAIScenarioIn extends { body: infer B }
    ? B
    : never;
  type RandomizeScenarioBody = RandomizeScenarioIn extends { body: infer B }
    ? B
    : never;

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

    return new Promise((resolve, reject) => {
      // Set up event listeners
      const handleProgress = (data: {
        type: string;
        message?: string;
        tool_name?: string;
        trace_id?: string;
      }) => {
        // Can show progress toast if needed
        if (data.type === "start") {
          toast.info(data.message || "Starting scenario generation...");
        }
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
          resolve({
            success: true,
            message: data.message,
            title: data.title,
            description: data.description,
            objectives: data.objectives,
            dynamic_document_mapping: data.dynamic_document_mapping || null,
          });
        } else {
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
        parameterItemIds: body.parameterItemIds,
        profileId: body.profileId,
        userInstructions: body.userInstructions,
        objectivesEnabled: body.objectivesEnabled,
      });
    });
  };

  const handleRandomizeScenario = async (body: RandomizeScenarioBody) => {
    if (!randomizeScenarioAction) {
      throw new Error("randomizeScenarioAction is required");
    }
    return await randomizeScenarioAction({ body });
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

  const initialFormData = useMemo(
    () => ({
      name: "New Scenario",
      problemStatement: "",
      departmentIds: defaultDepartmentIds,
      active: true,
      scenarioAgentId: null as string | null,
    }),
    [defaultDepartmentIds]
  );

  const [formData, setFormData] = useState(initialFormData);

  // Track if form data has been initialized from scenarioData to prevent resetting user changes
  const formDataInitializedRef = useRef<boolean>(false);

  // Store personaIds separately since it's now in junction table
  const [selectedPersonaIds, setSelectedPersonaIds] = useState<string[]>([]);
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
  const [regenerateObjectives, setRegenerateObjectives] = useState(true);
  const [originalFormData, setOriginalFormData] = useState(initialFormData);
  const [useDocuments, setUseDocuments] = useState(true);
  const [documentVisionEnabled, setDocumentVisionEnabled] = useState(false);
  const [useImage, setUseImage] = useState(false);
  const [useObjectives, setUseObjectives] = useState(false);
  const [draggedObjectiveIndex, setDraggedObjectiveIndex] = useState<
    number | null
  >(null);

  // State for junction data (managed separately from scenario)
  const [currentObjectives, setCurrentObjectives] = useState<string[]>([]);
  const [currentParameterItemIds, setCurrentParameterItemIds] = useState<
    string[]
  >([]);
  const [currentDocumentIds, setCurrentDocumentIds] = useState<string[]>([]);
  const [image, setImage] = useState<{
    id: string;
    name: string;
    upload_id: string;
  } | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Staged selections per department (preserved when departments are deselected)
  type StagedSelections = {
    persona_ids?: string[];
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
  // Backend now includes selected parameter items in parameter_item_mapping with all necessary fields
  const parameterItemMapping = useMemo(() => {
    return scenarioData?.parameter_item_mapping || {};
  }, [scenarioData]);
  const simulationMapping = useMemo(
    () => scenarioData?.simulation_mapping || {},
    [scenarioData]
  );
  // Backend now includes selected departments in department_mapping
  const departmentMapping = useMemo(() => {
    return scenarioData?.department_mapping || {};
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

  // Extract valid IDs from V2 response, filtered by selected departments
  // Includes: items from selected departments + cross-department items + currently selected items
  const validPersonaIds = useMemo(() => {
    const baseIds = scenarioData?.valid_persona_ids || [];
    const selectedDeptIds = formData.departmentIds || [];

    // Always include currently selected personas (for edit mode - ensures selected items are visible)
    const selectedPersonaIdSet = new Set(selectedPersonaIds);

    // If no departments selected, return all valid IDs plus selected ones
    if (selectedDeptIds.length === 0) {
      return Array.from(new Set([...baseIds, ...selectedPersonaIdSet]));
    }

    // Get union of persona_ids from ALL departments (to identify cross-department items)
    const allDeptPersonaIds = new Set<string>();
    Object.values(departmentMapping).forEach((deptData) => {
      if (deptData?.persona_ids && Array.isArray(deptData.persona_ids)) {
        deptData.persona_ids.forEach((id) => allDeptPersonaIds.add(id));
      }
    });

    // Get union of persona_ids from selected departments
    const selectedDeptPersonaIds = new Set<string>();
    selectedDeptIds.forEach((deptId) => {
      const deptData = departmentMapping[deptId];
      if (deptData?.persona_ids && Array.isArray(deptData.persona_ids)) {
        deptData.persona_ids.forEach((id) => selectedDeptPersonaIds.add(id));
      }
    });

    // Include items that are:
    // 1. In selected departments
    // 2. Cross-department (not in any department's persona_ids)
    // 3. Currently selected
    const filtered = baseIds.filter((id) => {
      const inSelectedDepts = selectedDeptPersonaIds.has(id);
      const isCrossDept = !allDeptPersonaIds.has(id); // Not in any department = cross-department
      return inSelectedDepts || isCrossDept;
    });

    return Array.from(new Set([...filtered, ...selectedPersonaIdSet]));
  }, [
    scenarioData?.valid_persona_ids,
    formData.departmentIds,
    departmentMapping,
    selectedPersonaIds,
  ]);

  // Extract valid document IDs from V2 response, filtered by selected departments
  // Includes: items from selected departments + cross-department items + currently selected items
  // Also filters by selected document parameter items (bidirectional filtering)
  const validDocumentIds = useMemo(() => {
    const baseIds = scenarioData?.valid_document_ids || [];
    const selectedDeptIds = formData.departmentIds || [];

    // Always include currently selected documents (for edit mode - ensures selected items are visible)
    const selectedDocIds = new Set(currentDocumentIds);

    // If no departments selected, return all valid IDs plus selected ones
    if (selectedDeptIds.length === 0) {
      const allValidIds = Array.from(new Set([...baseIds, ...selectedDocIds]));

      // Filter by selected document parameter items if any are selected
      // Compute documentParameterItemIds inline to avoid dependency order issue
      const currentDocParamItemIds = currentParameterItemIds.filter(
        (itemId) => {
          const item = parameterItemMapping[itemId];
          if (!item) return false;
          const paramId = item.parameter_id;
          // Check if this is a document parameter by checking parameterMapping
          const param = parameterMapping[paramId];
          return param?.document_parameter === true;
        }
      );

      if (currentDocParamItemIds.length > 0) {
        // If document_details is empty/missing, can't filter - show all documents
        if (
          !scenarioData?.document_details ||
          scenarioData.document_details.length === 0
        ) {
          return allValidIds;
        }

        const docsWithSelectedParams = new Set<string>();
        scenarioData.document_details.forEach((doc) => {
          if (doc.parameter_item_ids) {
            // Check if document has all selected document parameter items
            const docParamItemsSet = new Set(doc.parameter_item_ids);
            const hasAllSelectedParams = currentDocParamItemIds.every(
              (paramId) => docParamItemsSet.has(paramId)
            );
            if (hasAllSelectedParams) {
              docsWithSelectedParams.add(doc.document_id);
            }
          }
        });

        // If no documents match, show all (document_details might be incomplete)
        if (docsWithSelectedParams.size === 0) {
          return allValidIds;
        }

        // Intersect: only show documents that have the selected parameter items
        // Also include currently selected documents
        return allValidIds.filter(
          (id) => docsWithSelectedParams.has(id) || selectedDocIds.has(id)
        );
      }

      return allValidIds;
    }

    // Get union of document_ids from ALL departments (to identify cross-department items)
    const allDeptDocumentIds = new Set<string>();
    Object.values(departmentMapping).forEach((deptData) => {
      if (deptData?.document_ids && Array.isArray(deptData.document_ids)) {
        deptData.document_ids.forEach((id) => allDeptDocumentIds.add(id));
      }
    });

    // Get union of document_ids from selected departments
    const selectedDeptDocumentIds = new Set<string>();
    selectedDeptIds.forEach((deptId) => {
      const deptData = departmentMapping[deptId];
      if (deptData?.document_ids && Array.isArray(deptData.document_ids)) {
        deptData.document_ids.forEach((id) => selectedDeptDocumentIds.add(id));
      }
    });

    // Include items that are:
    // 1. In selected departments
    // 2. Cross-department (not in any department's document_ids)
    // 3. Currently selected
    const filtered = baseIds.filter((id) => {
      const inSelectedDepts = selectedDeptDocumentIds.has(id);
      const isCrossDept = !allDeptDocumentIds.has(id); // Not in any department = cross-department
      return inSelectedDepts || isCrossDept;
    });

    const deptFilteredIds = Array.from(
      new Set([...filtered, ...selectedDocIds])
    );

    // Filter by selected document parameter items if any are selected
    // Compute documentParameterItemIds inline to avoid dependency order issue
    const currentDocParamItemIds = currentParameterItemIds.filter((itemId) => {
      const item = parameterItemMapping[itemId];
      if (!item) return false;
      const paramId = item.parameter_id;
      // Check if this is a document parameter by checking parameterMapping
      const param = parameterMapping[paramId];
      return param?.document_parameter === true;
    });

    if (currentDocParamItemIds.length > 0) {
      // If document_details is empty/missing, can't filter - show all documents
      if (
        !scenarioData?.document_details ||
        scenarioData.document_details.length === 0
      ) {
        return deptFilteredIds;
      }

      const docsWithSelectedParams = new Set<string>();
      scenarioData.document_details.forEach((doc) => {
        if (doc.parameter_item_ids) {
          // Check if document has all selected document parameter items
          const docParamItemsSet = new Set(doc.parameter_item_ids);
          const hasAllSelectedParams = currentDocParamItemIds.every((paramId) =>
            docParamItemsSet.has(paramId)
          );
          if (hasAllSelectedParams) {
            docsWithSelectedParams.add(doc.document_id);
          }
        }
      });

      // If no documents match, show all (document_details might be incomplete)
      if (docsWithSelectedParams.size === 0) {
        return deptFilteredIds;
      }

      // Intersect: only show documents that have the selected parameter items
      // Also include currently selected documents
      return deptFilteredIds.filter(
        (id) => docsWithSelectedParams.has(id) || selectedDocIds.has(id)
      );
    }

    return deptFilteredIds;
  }, [
    scenarioData?.valid_document_ids,
    formData.departmentIds,
    departmentMapping,
    currentDocumentIds,
    currentParameterItemIds,
    parameterItemMapping,
    parameterMapping,
    scenarioData?.document_details,
  ]);

  // Extract valid parameter item IDs, filtered by selected departments
  // Includes: items from selected departments + cross-department items + currently selected items
  const validParameterItemIds = useMemo(() => {
    // Derive valid IDs from parameter_item_mapping keys
    // This ensures consistency - whatever is in the mapping is considered valid
    // Backend now returns all accessible items in parameter_item_mapping (same as default mode)
    const mappingIds = Object.keys(parameterItemMapping || {});
    const selectedDeptIds = formData.departmentIds || [];

    // Always include currently selected parameter items (for edit mode - ensures selected items are visible)
    const selectedParamItemIds = new Set(currentParameterItemIds);

    // If no departments selected, return all mapping IDs plus selected ones
    if (selectedDeptIds.length === 0) {
      return Array.from(new Set([...mappingIds, ...selectedParamItemIds]));
    }

    // Get union of parameter_item_ids from ALL departments (to identify cross-department items)
    const allDeptParameterItemIds = new Set<string>();
    Object.values(departmentMapping).forEach((deptData) => {
      if (
        deptData?.parameter_item_ids &&
        Array.isArray(deptData.parameter_item_ids)
      ) {
        deptData.parameter_item_ids.forEach((id: string) =>
          allDeptParameterItemIds.add(id)
        );
      }
    });

    // Get union of parameter_item_ids from selected departments
    const selectedDeptParameterItemIds = new Set<string>();
    selectedDeptIds.forEach((deptId) => {
      const deptData = departmentMapping[deptId];
      if (
        deptData?.parameter_item_ids &&
        Array.isArray(deptData.parameter_item_ids)
      ) {
        deptData.parameter_item_ids.forEach((id: string) =>
          selectedDeptParameterItemIds.add(id)
        );
      }
    });

    // Include items that are:
    // 1. In selected departments
    // 2. Cross-department (not in any department's parameter_item_ids)
    // 3. Currently selected
    const filtered = mappingIds.filter((itemId) => {
      const inSelectedDepts = selectedDeptParameterItemIds.has(itemId);
      const isCrossDept = !allDeptParameterItemIds.has(itemId); // Not in any department = cross-department
      return inSelectedDepts || isCrossDept;
    });

    return Array.from(new Set([...filtered, ...selectedParamItemIds]));
  }, [
    parameterItemMapping,
    formData.departmentIds,
    departmentMapping,
    currentParameterItemIds,
  ]);

  // Filter parameters by type
  const documentParameterIds = useMemo(() => {
    return Object.keys(parameterMapping).filter(
      (paramId) => parameterMapping[paramId]?.document_parameter === true
    );
  }, [parameterMapping]);

  const personaParameterIds = useMemo(() => {
    return Object.keys(parameterMapping).filter(
      (paramId) => parameterMapping[paramId]?.persona_parameter === true
    );
  }, [parameterMapping]);

  const generalParameterIds = useMemo(() => {
    return Object.keys(parameterMapping).filter(
      (paramId) =>
        parameterMapping[paramId]?.document_parameter !== true &&
        parameterMapping[paramId]?.persona_parameter !== true
    );
  }, [parameterMapping]);

  // Filter parameter item IDs by parameter type
  const documentParameterItemIds = useMemo(() => {
    return currentParameterItemIds.filter((itemId) => {
      const item = parameterItemMapping[itemId];
      if (!item) return false;
      const paramId = item.parameter_id;
      return documentParameterIds.includes(paramId);
    });
  }, [currentParameterItemIds, parameterItemMapping, documentParameterIds]);

  const personaParameterItemIds = useMemo(() => {
    return currentParameterItemIds.filter((itemId) => {
      const item = parameterItemMapping[itemId];
      if (!item) return false;
      const paramId = item.parameter_id;
      return personaParameterIds.includes(paramId);
    });
  }, [currentParameterItemIds, parameterItemMapping, personaParameterIds]);

  const generalParameterItemIds = useMemo(() => {
    return currentParameterItemIds.filter((itemId) => {
      const item = parameterItemMapping[itemId];
      if (!item) return false;
      const paramId = item.parameter_id;
      return generalParameterIds.includes(paramId);
    });
  }, [currentParameterItemIds, parameterItemMapping, generalParameterIds]);

  // Filter valid parameter item IDs by parameter type
  const validDocumentParameterItemIds = useMemo(() => {
    // First filter by document parameter type
    const documentParamItems = validParameterItemIds.filter((itemId) => {
      const item = parameterItemMapping[itemId];
      if (!item) return false;
      const paramId = item.parameter_id;
      return documentParameterIds.includes(paramId);
    });

    // If no documents selected, show all document parameter items
    if (currentDocumentIds.length === 0) {
      return documentParamItems;
    }

    // If documents are selected, only show parameter items linked to those documents
    // But if document_details is empty/missing, show all document parameter items
    if (
      !scenarioData?.document_details ||
      scenarioData.document_details.length === 0
    ) {
      return documentParamItems;
    }

    const paramItemsFromSelectedDocs = new Set<string>();
    currentDocumentIds.forEach((docId) => {
      const docDetails = scenarioData.document_details.find(
        (d) => d.document_id === docId
      );
      if (docDetails?.parameter_item_ids) {
        docDetails.parameter_item_ids.forEach((paramItemId) => {
          // Only include if it's a document parameter
          const item = parameterItemMapping[paramItemId];
          if (item) {
            const paramId = item.parameter_id;
            if (documentParameterIds.includes(paramId)) {
              paramItemsFromSelectedDocs.add(paramItemId);
            }
          }
        });
      }
    });

    // If no parameter items found from selected documents, show all (document_details might be incomplete)
    if (paramItemsFromSelectedDocs.size === 0) {
      return documentParamItems;
    }

    // Intersect: only show items that are both document parameters AND linked to selected documents
    // Also include currently selected items to prevent them from disappearing
    const selectedDocParamItems = new Set(documentParameterItemIds);
    return documentParamItems.filter(
      (itemId) =>
        paramItemsFromSelectedDocs.has(itemId) ||
        selectedDocParamItems.has(itemId)
    );
  }, [
    validParameterItemIds,
    parameterItemMapping,
    documentParameterIds,
    currentDocumentIds,
    scenarioData?.document_details,
    documentParameterItemIds,
  ]);

  const validPersonaParameterItemIds = useMemo(() => {
    return validParameterItemIds.filter((itemId) => {
      const item = parameterItemMapping[itemId];
      if (!item) return false;
      const paramId = item.parameter_id;
      return personaParameterIds.includes(paramId);
    });
  }, [validParameterItemIds, parameterItemMapping, personaParameterIds]);

  const validGeneralParameterItemIds = useMemo(() => {
    return validParameterItemIds.filter((itemId) => {
      const item = parameterItemMapping[itemId];
      if (!item) return false;
      const paramId = item.parameter_id;
      return generalParameterIds.includes(paramId);
    });
  }, [validParameterItemIds, parameterItemMapping, generalParameterIds]);

  // Filter parameter mapping by type
  const documentParameterMapping = useMemo(() => {
    const filtered: typeof parameterMapping = {};
    documentParameterIds.forEach((paramId) => {
      if (parameterMapping[paramId]) {
        filtered[paramId] = parameterMapping[paramId];
      }
    });
    return filtered;
  }, [parameterMapping, documentParameterIds]);

  const personaParameterMapping = useMemo(() => {
    const filtered: typeof parameterMapping = {};
    personaParameterIds.forEach((paramId) => {
      if (parameterMapping[paramId]) {
        filtered[paramId] = parameterMapping[paramId];
      }
    });
    return filtered;
  }, [parameterMapping, personaParameterIds]);

  const generalParameterMapping = useMemo(() => {
    const filtered: typeof parameterMapping = {};
    generalParameterIds.forEach((paramId) => {
      if (parameterMapping[paramId]) {
        filtered[paramId] = parameterMapping[paramId];
      }
    });
    return filtered;
  }, [parameterMapping, generalParameterIds]);

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
    selectedPersonaIds,
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

  // Sync document parameters when documents change (integrity constraint)
  // Note: This only runs when documents change, not when parameters change manually
  useEffect(() => {
    if (currentDocumentIds.length === 0) {
      // Clear document parameters if no documents selected
      setCurrentParameterItemIds((prev) => {
        const nonDocumentParamIds = prev.filter((itemId) => {
          const item = parameterItemMapping[itemId];
          if (!item) return true;
          const paramId = item.parameter_id;
          return !documentParameterIds.includes(paramId);
        });
        // Only update if something changed
        if (nonDocumentParamIds.length !== prev.length) {
          return nonDocumentParamIds;
        }
        return prev;
      });
      return;
    }

    // Extract parameter items from selected documents
    const documentParamItemIdsFromDocs = new Set<string>();
    currentDocumentIds.forEach((docId) => {
      const docDetails = scenarioData?.document_details?.find(
        (d) => d.document_id === docId
      );
      if (docDetails?.parameter_item_ids) {
        docDetails.parameter_item_ids.forEach((paramItemId) => {
          // Only include if it's a document parameter
          const item = parameterItemMapping[paramItemId];
          if (item) {
            const paramId = item.parameter_id;
            if (documentParameterIds.includes(paramId)) {
              documentParamItemIdsFromDocs.add(paramItemId);
            }
          }
        });
      }
    });

    const newDocumentParamItemIdsArray = Array.from(
      documentParamItemIdsFromDocs
    );

    // Update document parameters to match documents
    // Use functional update to avoid dependency on currentParameterItemIds
    setCurrentParameterItemIds((prev) => {
      // Get current document parameter items
      const currentDocumentParamItemIds = prev.filter((itemId) => {
        const item = parameterItemMapping[itemId];
        if (!item) return false;
        const paramId = item.parameter_id;
        return documentParameterIds.includes(paramId);
      });
      const currentDocumentParamItemIdsSet = new Set(
        currentDocumentParamItemIds
      );
      const newDocumentParamItemIdsSet = new Set(newDocumentParamItemIdsArray);

      // Check if they're different
      const isDifferent =
        currentDocumentParamItemIdsSet.size !==
          newDocumentParamItemIdsSet.size ||
        !Array.from(currentDocumentParamItemIdsSet).every((id) =>
          newDocumentParamItemIdsSet.has(id)
        );

      if (isDifferent) {
        // Remove old document parameter items and add new ones
        const nonDocumentParamIds = prev.filter((itemId) => {
          const item = parameterItemMapping[itemId];
          if (!item) return true;
          const paramId = item.parameter_id;
          return !documentParameterIds.includes(paramId);
        });
        return [...nonDocumentParamIds, ...newDocumentParamItemIdsArray];
      }
      return prev;
    });
  }, [
    currentDocumentIds,
    scenarioData?.document_details,
    parameterItemMapping,
    documentParameterIds,
    // Note: intentionally NOT including currentParameterItemIds or documentParameterItemIds
    // to avoid overwriting user's manual parameter selections
    // Using functional setState updates to access current state without dependency
  ]);

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
    if (scenarioData && isEditMode && !formDataInitializedRef.current) {
      // Edit mode: load existing scenario data (only once)
      const deptIds = scenarioData.department_ids || [];
      setFormData({
        name: scenarioData.name,
        problemStatement: scenarioData.problem_statement,
        departmentIds: deptIds,
        active: scenarioData.active ?? true,
        scenarioAgentId: scenarioData.scenario_agent_id || null,
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
      setCurrentParameterItemIds(
        getParameterItemIdsFromStructure(scenarioData.parameters)
      );
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
      // Load documents_enabled (with backward compatibility for use_documents)
      setUseDocuments(
        scenarioDataWithFlags.documents_enabled ??
          scenarioDataWithFlags.use_documents ??
          true
      );
      // Load document_vision_enabled
      setDocumentVisionEnabled(
        scenarioDataWithFlags.document_vision_enabled ?? false
      );
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
      });
      setOriginalDocumentIds(scenarioData.document_ids);
      setOriginalParameterItemIds(
        getParameterItemIdsFromStructure(scenarioData.parameters)
      );
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
      // Create mode: use initialFormData (which already has primaryDepartmentId set correctly)
      // Only set on initial load to prevent overwriting user selections when scenarioData updates
      setFormData(initialFormData);
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
      JSON.stringify([...currentParameterItemIds].sort()) !==
        JSON.stringify([...(originalParameterItemIds || [])].sort()) ||
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
        return selectedPersonaIds.length > 0 ? "completed" : "active";
      case "documents":
        return selectedPersonaIds.length === 0
          ? "pending"
          : currentDocumentIds.length > 0 || !useDocuments
            ? "completed"
            : "active";
      case "parameters":
        return selectedPersonaIds.length === 0
          ? "pending"
          : currentParameterItemIds.length > 0
            ? "completed"
            : "active";
      case "content":
        return selectedPersonaIds.length === 0 ? "pending" : "active"; // Always active once personas are selected, user can choose to fill or leave blank
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
      title: "Problem Statement",
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
      // Only randomize general parameters - exclude document and persona parameters
      const generalParamItemIds = generalParameterItemIds;
      const resp = await handleRandomizeScenario({
        name: formData.name || "",
        personaIds: selectedPersonaIds.length > 0 ? selectedPersonaIds : null,
        documentIds: currentDocumentIds,
        parameterItemIds: generalParamItemIds,
        departmentIds: formData.departmentIds || null,
        targets: ["parameters"],
      });
      if (!resp.success) throw new Error(resp.message);
      // Merge randomized general parameters with existing document and persona parameters
      const randomizedGeneralParamItemIds = resp.parameterItemIds || [];
      const updatedParameterItemIds = [
        ...documentParameterItemIds,
        ...personaParameterItemIds,
        ...randomizedGeneralParamItemIds,
      ];
      setCurrentParameterItemIds(updatedParameterItemIds);
      toast.success("Parameter suggestions applied");
    } catch {
      toast.error("Failed to randomize parameters");
    } finally {
      setIsRandomizingParameters(false);
    }
  };

  const handleResetParameters = () => {
    try {
      // Only reset general parameters, keep document and persona parameters
      const nonGeneralIds = currentParameterItemIds.filter((itemId) => {
        const item = parameterItemMapping[itemId];
        if (!item) return false;
        const paramId = item.parameter_id;
        return (
          documentParameterIds.includes(paramId) ||
          personaParameterIds.includes(paramId)
        );
      });
      setCurrentParameterItemIds(nonGeneralIds);
      toast.success("Parameters reset");
    } catch {
      toast.error("Failed to reset parameters");
    }
  };

  // Handler for document parameters
  // With bidirectional filtering, we just update state - the UI prevents invalid selections
  const handleDocumentParameterItemIdsChange = (
    newDocumentParamItemIds: string[]
  ) => {
    // Remove old document parameter items
    const nonDocumentParamIds = currentParameterItemIds.filter((itemId) => {
      const item = parameterItemMapping[itemId];
      if (!item) return true;
      const paramId = item.parameter_id;
      // Check if this is a document parameter by checking parameterMapping
      const param = parameterMapping[paramId];
      return param?.document_parameter !== true;
    });

    // Combine with new document parameter items
    const updatedParameterItemIds = [
      ...nonDocumentParamIds,
      ...newDocumentParamItemIds,
    ];
    setCurrentParameterItemIds(updatedParameterItemIds);

    // Note: No integrity checks needed - bidirectional filtering in validDocumentIds
    // will automatically filter out documents that don't match the selected parameters
  };

  // Handler for persona parameters
  const handlePersonaParameterItemIdsChange = (
    newPersonaParamItemIds: string[]
  ) => {
    // Remove old persona parameter items
    const nonPersonaParamIds = currentParameterItemIds.filter((itemId) => {
      const item = parameterItemMapping[itemId];
      if (!item) return true;
      const paramId = item.parameter_id;
      return !personaParameterIds.includes(paramId);
    });

    // Combine with new persona parameter items
    const updatedParameterItemIds = [
      ...nonPersonaParamIds,
      ...newPersonaParamItemIds,
    ];
    setCurrentParameterItemIds(updatedParameterItemIds);
  };

  // Handler for general parameters
  const handleGeneralParameterItemIdsChange = (
    newGeneralParamItemIds: string[]
  ) => {
    // Remove old general parameter items
    const nonGeneralParamIds = currentParameterItemIds.filter((itemId) => {
      const item = parameterItemMapping[itemId];
      if (!item) return true;
      const paramId = item.parameter_id;
      return (
        documentParameterIds.includes(paramId) ||
        personaParameterIds.includes(paramId)
      );
    });

    // Combine with new general parameter items
    const updatedParameterItemIds = [
      ...nonGeneralParamIds,
      ...newGeneralParamItemIds,
    ];
    setCurrentParameterItemIds(updatedParameterItemIds);
  };

  // Persona actions
  const handleRandomizePersona = async () => {
    try {
      setIsRandomizingPersona(true);
      // Only send non-persona parameters to backend (like general parameters does)
      // This prevents old persona parameters from being included in the request
      const nonPersonaParamItemIds = currentParameterItemIds.filter(
        (itemId) => {
          const item = parameterItemMapping[itemId];
          if (!item) return true;
          const paramId = item.parameter_id;
          return !personaParameterIds.includes(paramId);
        }
      );
      const resp = await handleRandomizeScenario({
        name: formData.name || "",
        personaIds: null, // Send null to force randomization
        documentIds: currentDocumentIds,
        parameterItemIds: nonPersonaParamItemIds,
        departmentIds: formData.departmentIds || null,
        targets: ["persona"],
      });
      if (!resp.success) throw new Error(resp.message);
      // Overwrite (not merge) personas - completely replace existing selection
      setSelectedPersonaIds(resp.personaIds || []);
      // Clear persona parameters FIRST, then add new ones from response
      // Extract persona parameters from response (even if empty)
      const returnedPersonaParamItemIds =
        resp.parameterItemIds && resp.parameterItemIds.length > 0
          ? resp.parameterItemIds.filter((itemId) => {
              const item = parameterItemMapping[itemId];
              if (!item) return false;
              const paramId = item.parameter_id;
              return personaParameterIds.includes(paramId);
            })
          : [];
      // Combine: keep document/general (from nonPersonaParamItemIds) + new persona parameters
      setCurrentParameterItemIds([
        ...nonPersonaParamItemIds,
        ...returnedPersonaParamItemIds,
      ]);
      toast.success("Persona suggestion applied");
    } catch {
      toast.error("Failed to randomize persona");
    } finally {
      setIsRandomizingPersona(false);
    }
  };

  const handleResetPersona = () => {
    try {
      setSelectedPersonaIds([]);
      // Clear persona parameters
      const nonPersonaParamIds = currentParameterItemIds.filter((itemId) => {
        const item = parameterItemMapping[itemId];
        if (!item) return true;
        const paramId = item.parameter_id;
        return !personaParameterIds.includes(paramId);
      });
      setCurrentParameterItemIds(nonPersonaParamIds);
      toast.success("Persona reset");
    } catch {
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
      // Only send non-document parameters to backend (like persona randomization does)
      // This prevents old document parameters from being included in the request
      const nonDocumentParamItemIds = currentParameterItemIds.filter(
        (itemId) => {
          const item = parameterItemMapping[itemId];
          if (!item) return true;
          const paramId = item.parameter_id;
          return !documentParameterIds.includes(paramId);
        }
      );
      const resp = await handleRandomizeScenario({
        name: formData.name || "",
        personaIds: selectedPersonaIds.length > 0 ? selectedPersonaIds : null,
        documentIds: null, // Send null to force randomization
        parameterItemIds: nonDocumentParamItemIds,
        departmentIds: formData.departmentIds || null,
        targets: ["documents"],
      });
      if (!resp.success) throw new Error(resp.message);
      // Overwrite (not merge) documents - completely replace existing selection
      // Deduplicate to prevent React key errors
      const uniqueDocumentIds = Array.from(new Set(resp.documentIds || []));
      setCurrentDocumentIds(uniqueDocumentIds);
      // Update parameters: backend returns all parameters (general + persona + document)
      // Extract document parameters from response and keep persona/general from current
      if (resp.parameterItemIds && resp.parameterItemIds.length > 0) {
        const returnedDocumentParamItemIds = resp.parameterItemIds.filter(
          (itemId) => {
            const item = parameterItemMapping[itemId];
            if (!item) return false;
            const paramId = item.parameter_id;
            return documentParameterIds.includes(paramId);
          }
        );
        // Keep persona and general parameters from current selection
        const nonDocumentParamIds = currentParameterItemIds.filter((itemId) => {
          const item = parameterItemMapping[itemId];
          if (!item) return true;
          const paramId = item.parameter_id;
          return !documentParameterIds.includes(paramId);
        });
        // Combine: keep persona/general + new document parameters
        setCurrentParameterItemIds([
          ...nonDocumentParamIds,
          ...returnedDocumentParamItemIds,
        ]);
      }
      toast.success("Document suggestions applied");
    } catch {
      toast.error("Failed to randomize documents");
    } finally {
      setIsRandomizingDocuments(false);
    }
  };

  const handleResetDocuments = () => {
    try {
      setCurrentDocumentIds([]);
      // Clear document parameters (will also be cleared by useEffect, but doing it explicitly)
      const nonDocumentParamIds = currentParameterItemIds.filter((itemId) => {
        const item = parameterItemMapping[itemId];
        if (!item) return true;
        const paramId = item.parameter_id;
        return !documentParameterIds.includes(paramId);
      });
      setCurrentParameterItemIds(nonDocumentParamIds);
      toast.success("Documents reset");
    } catch {
      toast.error("Failed to reset documents");
    }
  };

  const handleResetContent = () => {
    try {
      // Clear problem statement and turn off objectives
      setFormData((prev) => ({
        ...prev,
        problemStatement: "",
        objectivesEnabled: false,
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
        parameterItemIds:
          currentParameterItemIds.length > 0 ? currentParameterItemIds : null,
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
              parameters: groupParameterItemsByParameterId(
                currentParameterItemIds,
                parameterItemMapping
              ),
              documents_enabled: useDocuments,
              document_vision_enabled: documentVisionEnabled,
              objectives_enabled: useObjectives,
              image_enabled: useImage,
              scenario_agent_id: formData.scenarioAgentId || null,
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
        // Only show success toast if not in edit mode (edit mode shows its own toast after save)
        if (!isEditMode) {
          toast.success("Scenario generated successfully!");
        }
      } else {
        throw new Error("No scenario content was generated");
      }
    } catch (error) {
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
      // Transform department IDs for submit (non-superadmin: empty -> all valid departments)
      const finalDepartmentIds = transformDepartmentIdsForSubmit(
        formData.departmentIds || [],
        isSuperadmin,
        scenarioData?.valid_department_ids || []
      );

      // Prepare payload for V2 API
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
        scenario_agent_id?: string | null;
      } = {
        name: formData.name?.trim() || "",
        problem_statement: formData.problemStatement?.trim() || "",
        department_ids: finalDepartmentIds,
        active: formData.active ?? true,
        persona_ids: selectedPersonaIds.length > 0 ? selectedPersonaIds : null,
        document_ids: currentDocumentIds,
        objective_ids: currentObjectives.filter((obj) => obj.trim()), // Send raw objective text
        upload_ids:
          image?.upload_id || image?.id ? [image.upload_id || image.id] : null,
        image_names: image?.name ? [image.name] : null,
        parameters: groupParameterItemsByParameterId(
          currentParameterItemIds,
          parameterItemMapping
        ),
        scenario_agent_id: formData.scenarioAgentId || null,
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
            </div>
          </CardContent>
          <CardContent className="pt-0 space-y-4">
            {/* Department Selection */}
            {scenarioData?.valid_department_ids &&
            scenarioData.valid_department_ids.length > 1 ? (
              <div className="space-y-2">
                <Label htmlFor="department">Department</Label>
                {formData?.departmentIds !== undefined ? (
                  <DepartmentPicker
                    mapping={departmentMapping}
                    validIds={Array.from(
                      new Set([
                        ...(scenarioData?.valid_department_ids || []),
                        ...(formData.departmentIds || []),
                      ])
                    )}
                    selectedIds={formData.departmentIds || []}
                    onSelect={(ids) => handleInputChange("departmentIds", ids)}
                    placeholder="All Departments"
                    disabled={isReadonly}
                    multiSelect={true}
                  />
                ) : null}
              </div>
            ) : null}

            {/* Scenario Agent Selection */}
            <div className="space-y-2">
              <Label htmlFor="scenarioAgentId">Scenario Agent</Label>
              {formData?.scenarioAgentId !== undefined ? (
                <AgentPicker
                  mapping={agentMapping}
                  validIds={
                    scenarioData?.valid_agent_ids?.filter((id) => {
                      const agent = agentMapping[id];
                      return agent?.roles?.includes("scenario");
                    }) || []
                  }
                  selectedIds={
                    formData?.scenarioAgentId ? [formData.scenarioAgentId] : []
                  }
                  onSelect={(ids) =>
                    setFormData((prev) => ({
                      ...prev,
                      scenarioAgentId: ids[0] || null,
                    }))
                  }
                  placeholder="Select scenario agent"
                  disabled={isReadonly}
                  multiSelect={false}
                />
              ) : null}
            </div>

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
              multiSelect={true}
              label=""
              placeholder="Select a persona..."
              description="Choose the persona that will interact with students in this scenario."
              readonly={isReadonly}
            />
            {Object.keys(personaParameterMapping).length > 0 && (
              <div className="pt-2">
                <ParameterSelector
                  parameterMapping={personaParameterMapping}
                  parameterItemMapping={parameterItemMapping}
                  validParameterItemIds={validPersonaParameterItemIds}
                  selectedParameterItemIds={personaParameterItemIds}
                  onParameterItemIdsChange={handlePersonaParameterItemIdsChange}
                  disabled={isReadonly}
                />
              </div>
            )}
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
                </div>
                <CardDescription>{steps[2]?.description || ""}</CardDescription>
              </div>
            </div>
            <div className="ml-auto flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Label
                  htmlFor="document-vision"
                  className="text-sm flex items-center gap-1.5"
                >
                  <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                  Document Vision
                </Label>
                <Switch
                  id="document-vision"
                  checked={documentVisionEnabled}
                  onCheckedChange={(checked) => {
                    setDocumentVisionEnabled(checked);
                  }}
                  disabled={isReadonly || !useDocuments}
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="use-documents"
                  checked={useDocuments}
                  onCheckedChange={(checked) => {
                    setUseDocuments(checked);
                    if (!checked) {
                      setCurrentDocumentIds([]);
                      setDocumentVisionEnabled(false);
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
          <CardContent className="space-y-4">
            <DocumentPicker
              mapping={documentMapping}
              validIds={validDocumentIds}
              selectedIds={currentDocumentIds}
              documentDetails={scenarioData?.document_details || []}
              multiSelect={true}
              label=""
              placeholder="Select documents..."
              description="Choose documents that will be available during this scenario."
              disabled={!useDocuments}
              readonly={isReadonly}
              onSelect={(ids) => {
                // Enforce max 2 documents and deduplicate
                const uniqueIds = Array.from(new Set(ids));
                const limitedIds = uniqueIds.slice(0, 2);
                setCurrentDocumentIds(limitedIds);
              }}
            />
            {Object.keys(documentParameterMapping).length > 0 &&
              useDocuments && (
                <div className="pt-2">
                  <ParameterSelector
                    parameterMapping={documentParameterMapping}
                    parameterItemMapping={parameterItemMapping}
                    validParameterItemIds={validDocumentParameterItemIds}
                    selectedParameterItemIds={documentParameterItemIds}
                    onParameterItemIdsChange={
                      handleDocumentParameterItemIdsChange
                    }
                    disabled={isReadonly || !useDocuments}
                  />
                </div>
              )}
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
            {Object.keys(generalParameterMapping).length > 0 ? (
              <ParameterSelector
                parameterMapping={generalParameterMapping}
                parameterItemMapping={parameterItemMapping}
                validParameterItemIds={validGeneralParameterItemIds}
                selectedParameterItemIds={generalParameterItemIds}
                onParameterItemIdsChange={handleGeneralParameterItemIdsChange}
                disabled={isReadonly}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                No general environment parameters available.
              </p>
            )}
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
              {Object.keys(problemStatementMapping).length > 0 && (
                <ProblemStatementPicker
                  problemStatementMapping={problemStatementMapping}
                  selectedProblemStatementId={selectedProblemStatementId}
                  onSelect={(id) => {
                    setSelectedProblemStatementId(id);
                    if (id && problemStatementMapping[id]) {
                      handleInputChange(
                        "problemStatement",
                        problemStatementMapping[id].problem_statement
                      );
                    }
                  }}
                  onCreateNew={() => {
                    setSelectedProblemStatementId(null);
                    handleInputChange("problemStatement", "");
                  }}
                  disabled={isReadonly}
                  buttonClassName="h-9"
                />
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
                        <PlusCircle className="h-4 w-4 mr-2" /> Add objective
                      </Button>
                    </div>
                  )}
              </div>
            )}
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
