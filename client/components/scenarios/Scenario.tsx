/**
 * Scenario.tsx
 * Progressive step-by-step scenario creation flow
 * @AshokSaravanan222 & @siladiea
 * 05/20/2025
 */
"use client";
import {
  Check,
  Copy,
  GripVertical,
  Image,
  Lightbulb,
  Loader2,
  PlusCircle,
  Power,
  RotateCcw,
  Shield,
  ShieldCheck,
  Shuffle,
  Target,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { Skeleton } from "@/components/ui/skeleton";
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
  ScenarioDetailDefaultOut,
  ScenarioDetailOut,
  UpdateScenarioIn,
  UpdateScenarioOut,
} from "@/app/(main)/create/scenarios/s/[scenarioId]/page";
import { DepartmentPicker } from "@/components/common/forms/DepartmentPicker";
import { useBreadcrumbContext } from "@/contexts/breadcrumb-context";
import { useProfile } from "@/contexts/profile-context";
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
        {totalObjectives > 1 && (
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
  scenarioDetailDefault?: ScenarioDetailDefaultOut;
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
  generateAIScenarioAction,
  randomizeScenarioAction,
}: ScenarioProps) {
  const router = useRouter();
  const { effectiveProfile } = useProfile();
  const { setEntityMetadata, clearEntityMetadata } = useBreadcrumbContext();
  const isEditMode = mode === "edit" && !!scenarioId;

  // Use server-provided data directly (no fallback needed - server pages always provide data)
  const scenarioDetail = serverScenarioDetail;
  const scenarioDetailDefault = serverScenarioDetailDefault;

  // Use edit detail when editing, default detail when creating
  const scenarioData = isEditMode ? scenarioDetail : scenarioDetailDefault;
  const isLoadingData = false; // No loading when using server data

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

  const handleGenerateAIScenario = async (body: GenerateAIScenarioBody) => {
    if (!generateAIScenarioAction) {
      throw new Error("generateAIScenarioAction is required");
    }
    return await generateAIScenarioAction({ body });
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
  const initialFormData = useMemo(
    () => ({
      name: "New Scenario",
      problemStatement: "",
      departmentIds: effectiveProfile?.primaryDepartmentId
        ? [effectiveProfile.primaryDepartmentId]
        : [],
      active: true,
      hintsEnabled: false,
      objectivesEnabled: false,
      imageInputEnabled: false,
      copyPasteAllowed: false,
      inputGuardrailEnabled: false,
      outputGuardrailEnabled: false,
    }),
    [effectiveProfile?.primaryDepartmentId]
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
  const validDocumentIds = useMemo(() => {
    const baseIds = scenarioData?.valid_document_ids || [];
    const selectedDeptIds = formData.departmentIds || [];

    // Always include currently selected documents (for edit mode - ensures selected items are visible)
    const selectedDocIds = new Set(currentDocumentIds);

    // If no departments selected, return all valid IDs plus selected ones
    if (selectedDeptIds.length === 0) {
      return Array.from(new Set([...baseIds, ...selectedDocIds]));
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

    return Array.from(new Set([...filtered, ...selectedDocIds]));
  }, [
    scenarioData?.valid_document_ids,
    formData.departmentIds,
    departmentMapping,
    currentDocumentIds,
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
        hintsEnabled: scenarioData.hints_enabled ?? false,
        objectivesEnabled: scenarioData.objectives_enabled ?? false,
        imageInputEnabled: scenarioData.image_input_enabled ?? false,
        copyPasteAllowed: scenarioData.copy_paste_allowed ?? false,
        inputGuardrailEnabled: scenarioData.input_guardrail_enabled ?? false,
        outputGuardrailEnabled: scenarioData.output_guardrail_enabled ?? false,
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
      // Store originals for change tracking
      setOriginalFormData({
        name: scenarioData.name,
        problemStatement: scenarioData.problem_statement,
        departmentIds: scenarioData.department_ids || [],
        active: scenarioData.active ?? true,
        hintsEnabled: scenarioData.hints_enabled ?? false,
        objectivesEnabled: scenarioData.objectives_enabled ?? false,
        imageInputEnabled: scenarioData.image_input_enabled ?? false,
        copyPasteAllowed: scenarioData.copy_paste_allowed ?? false,
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
      current.hintsEnabled !== original.hintsEnabled ||
      current.objectivesEnabled !== original.objectivesEnabled ||
      current.imageInputEnabled !== original.imageInputEnabled ||
      current.copyPasteAllowed !== original.copyPasteAllowed ||
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
      const resp = await handleRandomizeScenario({
        name: formData.name || "",
        personaIds: selectedPersonaIds.length > 0 ? selectedPersonaIds : null,
        documentIds: currentDocumentIds,
        parameterItemIds: currentParameterItemIds,
        departmentIds: formData.departmentIds || null,
        targets: ["parameters"],
      });
      if (!resp.success) throw new Error(resp.message);
      // Overwrite (not merge) parameter items - completely replace existing selection
      setCurrentParameterItemIds(resp.parameterItemIds || []);
      toast.success("Parameter suggestions applied");
    } catch {
      toast.error("Failed to randomize parameters");
    } finally {
      setIsRandomizingParameters(false);
    }
  };

  const handleResetParameters = () => {
    try {
      setCurrentParameterItemIds([]);
      toast.success("Parameters reset");
    } catch {
      toast.error("Failed to reset parameters");
    }
  };

  // Persona actions
  const handleRandomizePersona = async () => {
    try {
      setIsRandomizingPersona(true);
      const resp = await handleRandomizeScenario({
        name: formData.name || "",
        personaIds: selectedPersonaIds.length > 0 ? selectedPersonaIds : null,
        documentIds: currentDocumentIds,
        parameterItemIds: currentParameterItemIds,
        departmentIds: formData.departmentIds || null,
        targets: ["persona"],
      });
      if (!resp.success) throw new Error(resp.message);
      // Overwrite (not merge) personas - completely replace existing selection
      setSelectedPersonaIds(resp.personaIds || []);
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
      const resp = await handleRandomizeScenario({
        name: formData.name || "",
        personaIds: selectedPersonaIds.length > 0 ? selectedPersonaIds : null,
        documentIds: currentDocumentIds,
        parameterItemIds: currentParameterItemIds,
        departmentIds: formData.departmentIds || null,
        targets: ["documents"],
      });
      if (!resp.success) throw new Error(resp.message);
      // Overwrite (not merge) documents - completely replace existing selection
      // Deduplicate to prevent React key errors
      const uniqueDocumentIds = Array.from(new Set(resp.documentIds || []));
      setCurrentDocumentIds(uniqueDocumentIds);
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
        objectivesEnabled: formData.objectivesEnabled,
      });

      if (!result.success) {
        throw new Error(result.message || "Failed to generate scenario");
      }

      if (result.title || result.description) {
        const newProblemStatement =
          result.description || formData.problemStatement || "";

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
              document_ids: currentDocumentIds,
              objective_ids: currentObjectives.filter((obj) => obj.trim()),
              parameters: groupParameterItemsByParameterId(
                currentParameterItemIds,
                parameterItemMapping
              ),
              hints_enabled: formData.hintsEnabled ?? false,
              objectives_enabled: formData.objectivesEnabled ?? false,
              image_input_enabled: formData.imageInputEnabled ?? false,
              copy_paste_allowed: formData.copyPasteAllowed ?? false,
              input_guardrail_enabled: formData.inputGuardrailEnabled ?? false,
              output_guardrail_enabled:
                formData.outputGuardrailEnabled ?? false,
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
          formData.objectivesEnabled &&
          result.objectives &&
          result.objectives.length > 0
        ) {
          setCurrentObjectives(result.objectives);
        } else if (!formData.objectivesEnabled) {
          // Clear objectives if disabled
          setCurrentObjectives([]);
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
        parameters: Record<string, string[]>;
        hints_enabled: boolean;
        objectives_enabled: boolean;
        image_input_enabled: boolean;
        copy_paste_allowed: boolean;
        input_guardrail_enabled: boolean;
        output_guardrail_enabled: boolean;
      } = {
        name: formData.name?.trim() || "",
        problem_statement: formData.problemStatement?.trim() || "",
        department_ids: formData.departmentIds || null,
        active: formData.active ?? true,
        persona_ids: selectedPersonaIds.length > 0 ? selectedPersonaIds : null,
        document_ids: currentDocumentIds,
        objective_ids: currentObjectives.filter((obj) => obj.trim()), // Send raw objective text
        parameters: groupParameterItemsByParameterId(
          currentParameterItemIds,
          parameterItemMapping
        ),
        hints_enabled: formData.hintsEnabled ?? false,
        objectives_enabled: formData.objectivesEnabled ?? false,
        image_input_enabled: formData.imageInputEnabled ?? false,
        copy_paste_allowed: formData.copyPasteAllowed ?? false,
        input_guardrail_enabled: formData.inputGuardrailEnabled ?? false,
        output_guardrail_enabled: formData.outputGuardrailEnabled ?? false,
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
          await createScenario(payload);
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
          <CardContent className="pt-3">
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
              {formData?.departmentIds !== undefined && !isLoadingData ? (
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
              ) : (
                <Skeleton className="h-10 w-full" />
              )}
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
              disabled={isReadonly}
            />

            {/* Guardrail Switches */}
            <div className="space-y-2 pt-2">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Label
                    htmlFor="copyPasteAllowed"
                    className="text-sm flex items-center gap-1.5"
                  >
                    <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                    Copy Paste
                  </Label>
                  <Switch
                    id="copyPasteAllowed"
                    checked={formData.copyPasteAllowed ?? false}
                    onCheckedChange={(checked) =>
                      handleInputChange("copyPasteAllowed", checked)
                    }
                    disabled={isReadonly}
                  />
                </div>
                <p className="text-xs text-muted-foreground pl-5">
                  Allow students to copy and paste text during the scenario
                </p>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Label
                    htmlFor="inputGuardrailEnabled"
                    className="text-sm flex items-center gap-1.5"
                  >
                    <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                    Input Guardrail
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
                <p className="text-xs text-muted-foreground pl-5">
                  Monitor and filter inappropriate input from students
                </p>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Label
                    htmlFor="outputGuardrailEnabled"
                    className="text-sm flex items-center gap-1.5"
                  >
                    <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" />
                    Output Guardrail
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
                <p className="text-xs text-muted-foreground pl-5">
                  Monitor and filter inappropriate output from the persona
                </p>
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
                </div>
                <CardDescription>{steps[2]?.description || ""}</CardDescription>
              </div>
            </div>
            <div className="ml-auto flex items-center gap-3">
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
              disabled={isReadonly || !useDocuments}
              onSelect={(ids) => {
                // Enforce max 2 documents and deduplicate
                const uniqueIds = Array.from(new Set(ids));
                const limitedIds = uniqueIds.slice(0, 2);
                setCurrentDocumentIds(limitedIds);
              }}
            />

            {/* Image Input Enabled Switch */}
            {useDocuments && (
              <div className="space-y-2 pt-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Label
                      htmlFor="imageInputEnabled"
                      className="text-sm flex items-center gap-1.5"
                    >
                      {/* eslint-disable-next-line */}
                      <Image className="h-3.5 w-3.5 text-muted-foreground" />
                      Image Vision
                    </Label>
                    <Switch
                      id="imageInputEnabled"
                      checked={formData.imageInputEnabled ?? false}
                      onCheckedChange={(checked) =>
                        handleInputChange("imageInputEnabled", checked)
                      }
                      disabled={isReadonly}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground pl-5">
                    Enable AI vision to analyze visual content in documents
                  </p>
                </div>
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
            <div className="space-y-2">
              <Textarea
                id="description"
                value={formData.problemStatement || ""}
                onChange={(e) => {
                  handleInputChange("problemStatement", e.target.value);
                  // Clear selected version when user manually edits
                  if (selectedProblemStatementId) {
                    setSelectedProblemStatementId(null);
                  }
                }}
                placeholder="Enter a custom scenario description or leave blank to auto-generate..."
                className="min-h-[120px]"
                disabled={isReadonly}
              />
            </div>

            {/* Hints Enabled and Objectives Enabled Switches */}
            <div className="space-y-2 pt-2">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Label
                    htmlFor="hintsEnabled"
                    className="text-sm flex items-center gap-1.5"
                  >
                    <Lightbulb className="h-3.5 w-3.5 text-muted-foreground" />
                    Hints
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
                <p className="text-xs text-muted-foreground pl-5">
                  Provide hints to help students progress through the scenario
                </p>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Label
                    htmlFor="objectivesEnabled"
                    className="text-sm flex items-center gap-1.5"
                  >
                    <Target className="h-3.5 w-3.5 text-muted-foreground" />
                    Objectives
                  </Label>
                  <Switch
                    id="objectivesEnabled"
                    checked={formData.objectivesEnabled ?? false}
                    onCheckedChange={(checked) => {
                      handleInputChange("objectivesEnabled", checked);
                      // Auto-create first objective when enabling
                      if (checked && currentObjectives.length === 0) {
                        setCurrentObjectives([""]);
                      }
                    }}
                    disabled={isReadonly}
                  />
                </div>
                <p className="text-xs text-muted-foreground pl-5">
                  Display learning objectives to students during the scenario
                </p>
              </div>
            </div>

            {/* Objectives List */}
            {formData.objectivesEnabled && (
              <div className="space-y-2">
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
                  />
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
            {formData.objectivesEnabled && (
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
            )}
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
