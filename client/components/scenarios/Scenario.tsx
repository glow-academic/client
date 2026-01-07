/**
 * Scenario.tsx
 * Progressive step-by-step scenario creation flow
 * @AshokSaravanan222 & @siladiea
 * 05/20/2025
 */
"use client";
import { Brain, Check, Eye, Loader2, RotateCcw, Shuffle } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  parseAsBoolean,
  parseAsInteger,
  parseAsString,
  useQueryStates,
  type Parser,
  type Values,
} from "nuqs";
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
import DocumentViewer, {
  type DocumentItem,
} from "@/components/common/chat/viewers/DocumentViewer";
import { RangeSlider } from "@/components/common/forms/RangeSlider";
import { ParameterSelector } from "@/components/parameters/ParameterSelector";
import { ContentSection } from "@/components/scenarios/ContentSection";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { getPersonaIconComponent } from "@/utils/persona-icons";

// Custom Components
import { type DocumentMappingItem } from "@/components/common/forms/DocumentPicker";
import {
  GenericForm,
  type StepStatus,
} from "@/components/common/forms/GenericForm";
import { GenericPicker } from "@/components/common/forms/GenericPicker";
import { SelectableGrid } from "@/components/common/forms/SelectableGrid";
import { StepCard } from "@/components/common/forms/StepCard";
import { buildSearchParams } from "./scenario-helpers";
import type { DraftState } from "./scenario-types";
import { isScenarioDetailOut, isScenarioNewOut } from "./scenario-types";

// Utility function to generate gradient from hex color (used for persona cards)
const generateGradientFromHex = (hexColor: string): string => {
  const cleanHex = hexColor.replace("#", "");
  const r = parseInt(cleanHex.substr(0, 2), 16);
  const g = parseInt(cleanHex.substr(2, 2), 16);
  const b = parseInt(cleanHex.substr(4, 2), 16);
  const lighterR = Math.min(255, r + 60);
  const lighterG = Math.min(255, g + 60);
  const lighterB = Math.min(255, b + 60);
  const lighterHex = `#${lighterR.toString(16).padStart(2, "0")}${lighterG.toString(16).padStart(2, "0")}${lighterB.toString(16).padStart(2, "0")}`;
  return `linear-gradient(135deg, ${lighterHex} 0%, ${hexColor} 100%)`;
};

// Types and API functions
import type {
  CreateScenarioIn,
  CreateScenarioOut,
  GenerateAIScenarioIn,
  GenerateAIScenarioOut,
  PatchScenarioDraftIn,
  PatchScenarioDraftOut,
  ScenarioDetailOut,
  ScenarioNewOut,
  UpdateScenarioIn,
  UpdateScenarioOut,
} from "@/app/(main)/create/scenarios/s/[scenarioId]/page";
import { useBreadcrumbContext } from "@/contexts/breadcrumb-context";
import { useProfile } from "@/contexts/profile-context";
import { useDraftAutosave } from "@/hooks/use-draft-autosave";
import {
  getDefaultDepartmentIds,
  transformDepartmentIdsForSubmit,
} from "@/utils/department-picker-helpers";
import {
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
  // Draft action: Resource-specific prop name is acceptable since types are resource-specific
  patchScenarioDraftAction?: (
    input: PatchScenarioDraftIn
  ) => Promise<PatchScenarioDraftOut>;
}

// StepStatus type imported from GenericForm

export default function Scenario({
  mode = "create",
  scenarioId,
  scenarioDetail: serverScenarioDetail,
  scenarioDetailDefault: serverScenarioDetailDefault,
  createScenarioAction,
  updateScenarioAction,
  patchScenarioDraftAction,
}: ScenarioProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const {
    effectiveProfile,
    socket,
    isConnected,
    selectedDraftId,
    setSelectedDraftId,
  } = useProfile();
  const { setEntityMetadata, clearEntityMetadata } = useBreadcrumbContext();
  const isEditMode = mode === "edit" && !!scenarioId;
  const isSuperadmin = effectiveProfile?.role === "superadmin";

  // Inline parsers for URL-backed state (navigation/search params only - form fields moved to local state)
  const scenarioSearchParamsClient = {
    // Draft ID (URL-backed, updated when draft is created)
    draftId: parseAsString,
    // Search params (URL-backed, updated via debounced callback in StepCard)
    personaSearch: parseAsString,
    documentSearch: parseAsString,
    parameterSearch: parseAsString,
    // Filter params (URL-backed)
    documentShowSelected: parseAsBoolean,
    documentShowTemplate: parseAsBoolean,
    personaShowSelected: parseAsBoolean,
    parameterShowSelected: parseAsBoolean,
    // Range params (URL-backed for filtering)
    personaMin: parseAsInteger,
    personaMax: parseAsInteger,
    documentMin: parseAsInteger,
    documentMax: parseAsInteger,
    parameterSelectionMin: parseAsInteger,
    parameterSelectionMax: parseAsInteger,
  } as const;

  // URL-backed state using nuqs (only navigation/search params)
  const [urlParams, setUrlParams] = useQueryStates(scenarioSearchParamsClient, {
    history: "replace",
    shallow: true, // Use shallow routing to prevent server component re-renders
  });

  // Get draftId from URL (managed by nuqs via urlParams)
  const urlDraftId = urlParams.draftId || null;

  // Sync URL draftId to profile context
  useEffect(() => {
    if (urlDraftId !== selectedDraftId) {
      setSelectedDraftId(urlDraftId);
    }
  }, [urlDraftId, selectedDraftId, setSelectedDraftId]);

  const draftId = urlDraftId;

  // Use server-provided data directly (no fallback needed - server pages always provide data)
  const scenarioDetail = serverScenarioDetail;
  const scenarioDetailDefault = serverScenarioDetailDefault;

  // Use edit detail when editing, default detail when creating
  const scenarioData = isEditMode ? scenarioDetail : scenarioDetailDefault;

  // Local draft state (not in URL) - initialized from server data or draft payload
  // DraftState type imported from scenario-types.ts

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
          // In edit mode, check ScenarioDetailOut for image_input_enabled
          if (isEditMode && "image_input_enabled" in serverCurrentValues) {
            return (
              (serverCurrentValues as ScenarioDetailOut).image_input_enabled ??
              defaults[field]
            );
          }
          return defaults[field];
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

  // Initialize draft state from server data or draft payload
  // Use stable refs (scenarioDetail/scenarioDetailDefault) instead of raw props to prevent recomputation on every server render
  // IMPORTANT: Include actual data fields in dependencies, not just IDs, so it recomputes when content changes
  const initialDraftState = useMemo((): DraftState => {
    const data = isEditMode ? scenarioDetail : scenarioDetailDefault;
    if (!data) {
      return {
        name: "",
        problemStatement: "",
        objectives: [],
        departmentIds: [],
        personaIds: [],
        documentIds: [],
        templateDocumentIds: [],
        parameterIds: [],
        fieldIds: [],
        imageIds: [],
        objectiveIds: [],
        problemStatementIds: [],
        useImage: false,
        useVideo: false,
        useObjectives: true,
        useQuestions: false,
        useProblemStatement: false,
        videoLength: null,
        active: true,
        randomize: null,
        randomizePersonas: null,
        randomizeDocuments: null,
        randomizeParameters: null,
        fieldShowSelected: {},
        fieldRanges: {},
        randomizeParameterItems: {},
        personaMin: null,
        personaMax: null,
        documentMin: null,
        documentMax: null,
        parameterSelectionMin: null,
        parameterSelectionMax: null,
        scenarioDomainId: null,
        imageDomainId: null,
        videoDomainId: null,
      };
    }

    // Initialize nested objects from draft payload fields first (if draft exists)
    let fieldShowSelected: Record<string, boolean> = {};
    let fieldRanges: Record<string, { min: number; max: number }> = {};
    let randomizeParameterItems: Record<string, string> = {};

    // Try to read from draft payload fields (returned by SQL when draft exists)
    if (
      data &&
      "draft_field_show_selected" in data &&
      data.draft_field_show_selected
    ) {
      try {
        const parsed =
          typeof data.draft_field_show_selected === "string"
            ? JSON.parse(data.draft_field_show_selected)
            : data.draft_field_show_selected;
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          fieldShowSelected = parsed as Record<string, boolean>;
        }
      } catch {
        // Ignore parse errors, fall back to empty object
      }
    }

    if (data && "draft_field_ranges" in data && data.draft_field_ranges) {
      try {
        const parsed =
          typeof data.draft_field_ranges === "string"
            ? JSON.parse(data.draft_field_ranges)
            : data.draft_field_ranges;
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          fieldRanges = parsed as Record<string, { min: number; max: number }>;
        }
      } catch {
        // Ignore parse errors, fall back to empty object
      }
    }

    if (
      data &&
      "draft_randomize_parameter_items" in data &&
      data.draft_randomize_parameter_items
    ) {
      try {
        const parsed =
          typeof data.draft_randomize_parameter_items === "string"
            ? JSON.parse(data.draft_randomize_parameter_items)
            : data.draft_randomize_parameter_items;
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          randomizeParameterItems = parsed as Record<string, string>;
        }
      } catch {
        // Ignore parse errors, fall back to empty object
      }
    }

    // If draftId exists, server should have merged draft payload into data
    // Otherwise, use server defaults
    // Type narrowing: check isEditMode to determine which type we have
    const isDetail = isEditMode && "problem_statement" in data;
    const detailData = isDetail ? (data as ScenarioDetailOut) : null;
    const newData = !isDetail ? (data as ScenarioNewOut) : null;

    return {
      name: (isDetail && detailData?.name) || "",
      problemStatement: detailData?.problem_statement || "",
      objectives: [], // Will be populated from objective_ids if needed
      departmentIds: (data.department_ids || []).map((id) => String(id)),
      personaIds: detailData?.persona_ids || [],
      documentIds: detailData?.document_ids || [],
      templateDocumentIds: newData?.selected_template_document_ids || [],
      parameterIds: detailData?.parameter_ids || [],
      fieldIds: [], // Will be populated from scenario fields if needed
      imageIds:
        newData?.scenario_images?.map((img) => String(img.upload_id)) || [],
      objectiveIds: detailData?.objective_ids || [],
      problemStatementIds: detailData?.problem_statement_id
        ? [String(detailData.problem_statement_id)]
        : [],
      useImage: detailData?.image_input_enabled ?? false,
      useVideo: newData?.video_enabled ?? false,
      useObjectives: detailData?.objectives_enabled ?? true,
      useQuestions: newData?.questions_enabled ?? false,
      useProblemStatement: false, // Not directly available in data
      videoLength: null, // Will be set from selected video
      active: detailData?.active ?? true,
      randomize: null,
      randomizePersonas: null,
      randomizeDocuments: null,
      randomizeParameters: null,
      fieldShowSelected,
      fieldRanges,
      randomizeParameterItems,
      personaMin: detailData?.persona_range_min ?? null,
      personaMax: detailData?.persona_range_max ?? null,
      documentMin: detailData?.document_range_min ?? null,
      documentMax: detailData?.document_range_max ?? null,
      parameterSelectionMin: detailData?.parameter_range_min ?? null,
      parameterSelectionMax: detailData?.parameter_range_max ?? null,
      scenarioDomainId: data.scenario_domain_id || null,
      imageDomainId: data.image_domain_id || null,
      videoDomainId:
        (detailData as ScenarioDetailOut & { video_domain_id?: string })
          ?.video_domain_id || null,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isEditMode,
    scenarioDetail,
    scenarioDetailDefault,
    draftId,
    urlDraftId,
    // Include actual content fields so it recomputes when server data changes (not just object reference)
    scenarioDetailDefault?.department_ids,
    // Extract complex expression to separate variable - only access name from scenarioDetail (ScenarioDetailOut)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    (() => {
      if (isEditMode && scenarioDetail && isScenarioDetailOut(scenarioDetail)) {
        return scenarioDetail.name;
      }
      return undefined;
    })(),
    scenarioDetail?.problem_statement,
    scenarioDetail?.department_ids,
    scenarioDetail?.persona_ids,
    scenarioDetail?.document_ids,
    scenarioDetail?.objective_ids,
  ]);

  const [draftState, setDraftState] = useState<DraftState>(initialDraftState);

  // Track previous initialDraftState content to avoid unnecessary updates
  const prevInitialDraftStateRef = useRef<string>(
    JSON.stringify(initialDraftState)
  );

  // Update draft state when server data changes (e.g., draft selected)
  // Only update if content actually changed (deep comparison to prevent unnecessary re-renders)
  useEffect(() => {
    // Deep compare to avoid unnecessary state updates
    const currentStateStr = prevInitialDraftStateRef.current;
    const newStateStr = JSON.stringify(initialDraftState);

    // Only update if content actually changed
    if (currentStateStr !== newStateStr) {
      prevInitialDraftStateRef.current = newStateStr;
      setDraftState(initialDraftState);
    }
  }, [initialDraftState]);

  // Integrate autosave hook
  // Pattern: Transform hook API (draft_id, patch, expected_version) to backend API (input_draft_id, patch, expected_version)
  // See Z-DOCS.md "Draft Autosave Pattern" section for type transformation details
  const {
    saveStatus: _saveStatus,
    saveNow: _saveNow,
    lastSavedVersion: _lastSavedVersion,
  } = useDraftAutosave({
    draftId,
    draftState,
    patchDraftAction: patchScenarioDraftAction
      ? async (input) => {
          // Transform camelCase keys to snake_case for draft payload (SQL expects snake_case)
          const camelToSnake: Record<string, string> = {
            departmentIds: "department_ids",
            personaIds: "persona_ids",
            documentIds: "document_ids",
            templateDocumentIds: "template_document_ids",
            parameterIds: "parameter_ids",
            fieldIds: "field_ids",
            imageIds: "image_ids",
            objectiveIds: "objective_ids",
            problemStatementIds: "problem_statement_ids",
            useImage: "use_image",
            useVideo: "use_video",
            useObjectives: "use_objectives",
            useQuestions: "use_questions",
            useProblemStatement: "use_problem_statement",
            videoLength: "video_length",
            problemStatement: "problem_statement",
            fieldShowSelected: "field_show_selected",
            fieldRanges: "field_ranges",
            randomizeParameterItems: "randomize_parameter_items",
            randomizePersonas: "randomize_personas",
            randomizeDocuments: "randomize_documents",
            randomizeParameters: "randomize_parameters",
            personaMin: "persona_min",
            personaMax: "persona_max",
            documentMin: "document_min",
            documentMax: "document_max",
            parameterSelectionMin: "parameter_selection_min",
            parameterSelectionMax: "parameter_selection_max",
            scenarioDomainId: "scenario_domain_id",
            imageDomainId: "image_domain_id",
            videoDomainId: "video_domain_id",
          };
          const transformedPatch: Record<string, unknown> = {};
          Object.entries(input.body.patch as Record<string, unknown>).forEach(
            ([key, value]) => {
              const snakeKey = camelToSnake[key] || key;
              transformedPatch[snakeKey] = value;
            }
          );

          // Transform input to match API structure (API uses input_draft_id, patch, expected_version)
          // Note: profile_id is added server-side from header
          const result = await patchScenarioDraftAction({
            body: {
              input_draft_id: input.body.draft_id || null,
              patch: transformedPatch,
              expected_version: input.body.expected_version,
            } as PatchScenarioDraftIn["body"],
          });
          // Transform backend API → hook API
          // Backend API: { draft_id, new_version, draft_exists }
          // Hook API: { draftId, newVersion, draftExists }
          return {
            draftId: result.draft_id || "",
            newVersion: result.new_version || 0,
            draftExists: result.draft_exists || false,
          };
        }
      : async () => ({ draftId: "", newVersion: 0, draftExists: false }),
    debounceMs: 1000,
    onDraftCreated: useCallback(
      (newDraftId: string) => {
        // Only update URL if draftId actually changed
        const currentUrlDraftId = searchParams.get("draftId");
        if (newDraftId === currentUrlDraftId) {
          return;
        }
        // Update URL with new draftId and trigger server-side refetch
        // This ensures the server component gets fresh data with the new draft
        const params = new URLSearchParams(searchParams.toString());
        params.set("draftId", newDraftId);
        const newUrl = `?${params.toString()}`;
        router.replace(newUrl, { scroll: false });
        // Force server components to re-render with updated search params
        router.refresh();
      },
      [router, searchParams]
    ),
  });

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

  // Note: Using handleCreateScenario and handleUpdateScenario directly

  // Form data state
  const defaultDepartmentIds = useMemo(
    () =>
      getDefaultDepartmentIds(
        isSuperadmin,
        effectiveProfile?.primary_department_id || null
      ),
    [isSuperadmin, effectiveProfile?.primary_department_id]
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
    scenarioDomainId: string | null;
    imageDomainId: string | null;
    videoDomainId: string | null;
    active: boolean;
  }>({
    scenarioDomainId: null,
    imageDomainId: null,
    videoDomainId: null,
    active: true,
  });

  // Form data: merged object of draftState (form fields) + urlParams (search/filter params)
  // Following Persona.tsx pattern: formData = { ...draftState, ...urlParams }
  // Note: Range params (personaMin/Max, etc.) exist in both draftState and urlParams
  // URL params take precedence for filtering, but draftState values are used for form persistence
  const formData = useMemo(() => {
    return {
      ...draftState,
      // Override range params with URL params if present (for filtering)
      personaMin: urlParams.personaMin ?? draftState.personaMin ?? null,
      personaMax: urlParams.personaMax ?? draftState.personaMax ?? null,
      documentMin: urlParams.documentMin ?? draftState.documentMin ?? null,
      documentMax: urlParams.documentMax ?? draftState.documentMax ?? null,
      parameterSelectionMin:
        urlParams.parameterSelectionMin ??
        draftState.parameterSelectionMin ??
        null,
      parameterSelectionMax:
        urlParams.parameterSelectionMax ??
        draftState.parameterSelectionMax ??
        null,
      // URL-only params (search/filter)
      draftId: urlParams.draftId || null,
      personaSearch: urlParams.personaSearch || null,
      documentSearch: urlParams.documentSearch || null,
      parameterSearch: urlParams.parameterSearch || null,
      documentShowSelected: urlParams.documentShowSelected || null,
      documentShowTemplate: urlParams.documentShowTemplate || null,
      personaShowSelected: urlParams.personaShowSelected || null,
      parameterShowSelected: urlParams.parameterShowSelected || null,
    } as Record<string, unknown>;
  }, [draftState, urlParams]);

  // Wrapper for setFormData that updates draftState for form fields, urlParams for navigation
  const setFormData = useCallback(
    (
      updates:
        | Partial<Record<string, unknown>>
        | ((prev: Record<string, unknown>) => Partial<Record<string, unknown>>)
    ) => {
      // Handle function form
      const resolvedUpdates =
        typeof updates === "function" ? updates(formData) : updates;

      const draftUpdates: Partial<DraftState> = {};
      const urlUpdates: Partial<Record<string, unknown>> = {};

      Object.entries(resolvedUpdates).forEach(([key, value]) => {
        // Form fields go to draftState
        if (
          key === "name" ||
          key === "problemStatement" ||
          key === "objectives" ||
          key === "departmentIds" ||
          key === "personaIds" ||
          key === "documentIds" ||
          key === "templateDocumentIds" ||
          key === "parameterIds" ||
          key === "fieldIds" ||
          key === "imageIds" ||
          key === "objectiveIds" ||
          key === "problemStatementIds" ||
          key === "useImage" ||
          key === "useVideo" ||
          key === "useObjectives" ||
          key === "useQuestions" ||
          key === "useProblemStatement" ||
          key === "videoLength" ||
          key === "active" ||
          key === "randomize" ||
          key === "randomizePersonas" ||
          key === "randomizeDocuments" ||
          key === "randomizeParameters" ||
          key === "fieldShowSelected" ||
          key === "fieldRanges" ||
          key === "randomizeParameterItems" ||
          key === "scenarioDomainId" ||
          key === "imageDomainId" ||
          key === "videoDomainId"
        ) {
          draftUpdates[key as keyof DraftState] = value as never;
        }

        // Range params: update both draftState (for persistence) and urlParams (for filtering)
        if (
          key === "personaMin" ||
          key === "personaMax" ||
          key === "documentMin" ||
          key === "documentMax" ||
          key === "parameterSelectionMin" ||
          key === "parameterSelectionMax"
        ) {
          draftUpdates[key as keyof DraftState] = value as never;
          urlUpdates[key] = value;
        }

        // Search/filter params go to urlParams only
        if (
          key === "draftId" ||
          key === "personaSearch" ||
          key === "documentSearch" ||
          key === "parameterSearch" ||
          key === "documentShowSelected" ||
          key === "documentShowTemplate" ||
          key === "personaShowSelected" ||
          key === "parameterShowSelected"
        ) {
          urlUpdates[key] = value;
        }
      });

      if (Object.keys(draftUpdates).length > 0) {
        setDraftState((prev) => ({ ...prev, ...draftUpdates }));
      }

      if (Object.keys(urlUpdates).length > 0) {
        setUrlParams((prev) => ({ ...prev, ...urlUpdates }));
      }
    },
    [formData, setUrlParams]
  );

  // Merged object for WebSocket emits (combines draftState and urlParams)
  // Used by randomize handlers to send current filter/search/range params to server
  const q = useMemo(() => {
    return {
      ...draftState,
      ...urlParams,
    };
  }, [draftState, urlParams]);

  // Track if form data has been initialized (prevents re-initialization on re-renders)
  const formDataInitializedRef = useRef<boolean>(false);

  // Helper to update draft state (form fields)
  const handleInputChange = useCallback(
    (key: keyof DraftState, value: unknown) => {
      setDraftState((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  // Extract values from formData (merged draftState + urlParams)
  const personaSearchTerm = (formData["personaSearch"] as string | null) || "";
  const documentSearchTerm =
    (formData["documentSearch"] as string | null) || "";
  const parameterSearchTerm =
    (formData["parameterSearch"] as string | null) || "";
  const documentShowSelected =
    (formData["documentShowSelected"] as boolean | null) ?? false;
  const documentShowTemplate =
    (formData["documentShowTemplate"] as boolean | null) ?? false;
  const personaShowSelected =
    (formData["personaShowSelected"] as boolean | null) ?? false;
  const parameterShowSelected =
    (formData["parameterShowSelected"] as boolean | null) ?? false;

  // Derived from draft state (form fields) - wrapped in useMemo to fix React hook dependencies
  const name = useMemo(
    () => draftState.name || "New Scenario",
    [draftState.name]
  );
  const problemStatement = useMemo(
    () => draftState.problemStatement || "",
    [draftState.problemStatement]
  );
  const selectedPersonaIds = useMemo(
    () => draftState.personaIds || [],
    [draftState.personaIds]
  );
  const currentDocumentIds = useMemo(
    () => draftState.documentIds || [],
    [draftState.documentIds]
  );
  const templateDocumentIds = useMemo(
    () => draftState.templateDocumentIds || [],
    [draftState.templateDocumentIds]
  );
  const currentFieldIds = useMemo(
    () => draftState.fieldIds || [],
    [draftState.fieldIds]
  );
  const currentProblemStatementIds = useMemo(
    () => draftState.problemStatementIds || [],
    [draftState.problemStatementIds]
  );
  const currentObjectiveIds = useMemo(
    () => draftState.objectiveIds || [],
    [draftState.objectiveIds]
  );
  const fieldShowSelectedByParam = useMemo(
    () => draftState.fieldShowSelected || {},
    [draftState.fieldShowSelected]
  );
  const fieldMinMax = useMemo(
    () => draftState.fieldRanges || {},
    [draftState.fieldRanges]
  );
  const [_previewDocumentId, setPreviewDocumentId] = useState<string | null>(
    null
  );
  // Local state for preview dialog in documents step (moved outside renderStep)
  const [localPreviewDocId, setLocalPreviewDocId] = useState<string | null>(
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
  // Feature flags from draft state
  const useObjectives = draftState.useObjectives ?? false;
  const useImage = draftState.useImage ?? false;
  const useVideo = draftState.useVideo ?? false;
  const useQuestions = draftState.useQuestions ?? false;
  const useProblemStatement = draftState.useProblemStatement ?? false;

  // Video length from draft state
  const selectedVideoLength = draftState.videoLength ?? null;

  // Objectives from draft state (array, not JSON-encoded) - wrapped in useMemo to fix React hook dependencies
  const currentObjectives = useMemo(
    () => draftState.objectives || [],
    [draftState.objectives]
  );
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

  // Min/max state for randomization (from draft state, fallback to server values)
  // Initialize from draft state, fallback to server's current values
  const personaMinMax = useMemo(() => {
    const personaMin = draftState.personaMin;
    const personaMax = draftState.personaMax;
    if (
      personaMin !== null &&
      personaMin !== undefined &&
      personaMax !== null &&
      personaMax !== undefined
    ) {
      return { min: personaMin, max: personaMax };
    }
    // Fallback to server values (from ScenarioNewOut)
    if (scenarioData && !isEditMode && isScenarioNewOut(scenarioData)) {
      return {
        min: scenarioData.persona_range_min ?? 1,
        max: scenarioData.persona_range_max ?? 1,
      };
    }
    return { min: 1, max: 1 };
  }, [draftState.personaMin, draftState.personaMax, scenarioData, isEditMode]);

  const documentMinMax = useMemo(() => {
    const documentMin = draftState.documentMin;
    const documentMax = draftState.documentMax;
    if (
      documentMin !== null &&
      documentMin !== undefined &&
      documentMax !== null &&
      documentMax !== undefined
    ) {
      return { min: documentMin, max: documentMax };
    }
    // Fallback to server values (from ScenarioNewOut)
    if (scenarioData && !isEditMode && isScenarioNewOut(scenarioData)) {
      return {
        min: scenarioData.document_range_min ?? 0,
        max: scenarioData.document_range_max ?? 1,
      };
    }
    return { min: 0, max: 1 };
  }, [
    draftState.documentMin,
    draftState.documentMax,
    scenarioData,
    isEditMode,
  ]);

  const parameterSelectionMinMax = useMemo(() => {
    const parameterSelectionMin = draftState.parameterSelectionMin;
    const parameterSelectionMax = draftState.parameterSelectionMax;
    if (
      parameterSelectionMin !== null &&
      parameterSelectionMin !== undefined &&
      parameterSelectionMax !== null &&
      parameterSelectionMax !== undefined
    ) {
      return { min: parameterSelectionMin, max: parameterSelectionMax };
    }
    // Fallback to server values (from ScenarioNewOut)
    if (scenarioData && !isEditMode && isScenarioNewOut(scenarioData)) {
      return {
        min: scenarioData.parameter_range_min ?? 0,
        max: scenarioData.parameter_range_max ?? 3,
      };
    }
    // Use parameter_range_min and parameter_range_max directly from API response
    const newDataForRanges =
      scenarioData && !isEditMode && isScenarioNewOut(scenarioData)
        ? scenarioData
        : null;
    if (newDataForRanges) {
      const min = newDataForRanges.parameter_range_min;
      const max = newDataForRanges.parameter_range_max;
      if (
        min !== null &&
        min !== undefined &&
        max !== null &&
        max !== undefined
      ) {
        return {
          min,
          max,
        };
      }
    }
    return { min: 0, max: 3 };
  }, [
    draftState.parameterSelectionMin,
    draftState.parameterSelectionMax,
    scenarioData,
    isEditMode,
  ]);
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
    if (!scenarioData) return {};
    const fields =
      isScenarioDetailOut(scenarioData) || isScenarioNewOut(scenarioData)
        ? scenarioData.fields
        : undefined;
    const map: Record<
      string,
      {
        name: string;
        description: string;
        parameter_id: string;
        parameter_name: string;
        conditional_parameter_ids: string[];
      }
    > = {};
    if (fields && Array.isArray(fields)) {
      fields.forEach((f) => {
        const field = f as {
          field_id?: string | null;
          name?: string | null;
          description?: string | null;
          parameter_id?: string | null;
          parameter_name?: string | null;
          conditional_parameter_ids?: Array<string | null> | null;
        };
        if (field.field_id) {
          map[String(field.field_id)] = {
            name: field.name || "",
            description: field.description || "",
            parameter_id: field.parameter_id ? String(field.parameter_id) : "",
            parameter_name: field.parameter_name || "",
            conditional_parameter_ids:
              field.conditional_parameter_ids
                ?.map((id) => String(id))
                .filter(
                  (id): id is string => id !== "null" && id !== "undefined"
                ) || [],
          };
        }
      });
    }
    return map;
  }, [scenarioData]);

  // Helper to get objective mapping from arrays
  const getObjectiveMapping = useMemo(() => {
    const map: Record<string, { name: string }> = {};
    if (!scenarioData) return map;
    const objectives =
      isScenarioDetailOut(scenarioData) || isScenarioNewOut(scenarioData)
        ? scenarioData.objectives
        : undefined;
    if (objectives && Array.isArray(objectives)) {
      objectives.forEach((obj) => {
        const objective = obj as {
          objective_id?: string | null;
          name?: string | null;
          description?: string | null;
        };
        if (objective.objective_id) {
          map[String(objective.objective_id)] = {
            name: objective.name || objective.description || "",
          };
        }
      });
    }
    return map;
  }, [scenarioData]);

  // Helper functions to update draft state directly
  const updatePersonaIds = useCallback(
    (ids: string[] | ((prev: string[]) => string[])) => {
      const newIds = typeof ids === "function" ? ids(selectedPersonaIds) : ids;
      setDraftState((prev) => ({ ...prev, personaIds: newIds }));
    },
    [selectedPersonaIds]
  );

  const updateDocumentIds = useCallback(
    (ids: string[] | ((prev: string[]) => string[])) => {
      const newIds = typeof ids === "function" ? ids(currentDocumentIds) : ids;
      setDraftState((prev) => ({ ...prev, documentIds: newIds }));
    },
    [currentDocumentIds]
  );

  const updateTemplateDocumentIds = useCallback(
    (ids: string[] | ((prev: string[]) => string[])) => {
      const newIds = typeof ids === "function" ? ids(templateDocumentIds) : ids;
      setDraftState((prev) => ({ ...prev, templateDocumentIds: newIds }));
    },
    [templateDocumentIds]
  );

  const updateFieldIds = useCallback(
    (ids: string[] | ((prev: string[]) => string[])) => {
      const newIds = typeof ids === "function" ? ids(currentFieldIds) : ids;
      setDraftState((prev) => ({ ...prev, fieldIds: newIds }));
    },
    [currentFieldIds]
  );

  const updateProblemStatementIds = useCallback(
    (ids: string[] | ((prev: string[]) => string[])) => {
      const newIds =
        typeof ids === "function" ? ids(currentProblemStatementIds) : ids;
      setDraftState((prev) => ({ ...prev, problemStatementIds: newIds }));
    },
    [currentProblemStatementIds]
  );

  const updateObjectiveIds = useCallback(
    (ids: string[] | ((prev: string[]) => string[])) => {
      const newIds = typeof ids === "function" ? ids(currentObjectiveIds) : ids;
      setDraftState((prev) => ({ ...prev, objectiveIds: newIds }));
    },
    [currentObjectiveIds]
  );

  // Helper to update objectives (array in draft state)
  const updateObjectives = useCallback(
    (objectives: string[] | ((prev: string[]) => string[])) => {
      const newObjectives =
        typeof objectives === "function"
          ? objectives(currentObjectives)
          : objectives;
      setDraftState((prev) => ({ ...prev, objectives: newObjectives }));
    },
    [currentObjectives]
  );

  // Helper to update videoLength (in draft state)
  const updateVideoLength = useCallback((length: number | null) => {
    // Validate length is 4, 8, or 12, or null
    if (length !== null && ![4, 8, 12].includes(length)) {
      return;
    }
    setDraftState((prev) => ({ ...prev, videoLength: length }));
  }, []);

  const updateFieldRanges = useCallback(
    (
      value:
        | Record<string, { min: number; max: number }>
        | ((
            prev: Record<string, { min: number; max: number }>
          ) => Record<string, { min: number; max: number }>)
    ) => {
      const newValue = typeof value === "function" ? value(fieldMinMax) : value;
      setDraftState((prev) => ({ ...prev, fieldRanges: newValue }));
    },
    [fieldMinMax]
  );

  const handleGenerateAIScenario = useCallback(
    async (body: GenerateAIScenarioBody): Promise<GenerateAIScenarioOut> => {
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
            console.error(
              "[Scenario] Document completion failed:",
              data.message
            );
          }
        };

        const handleImageComplete = (data: {
          success: boolean;
          image_id: string;
          trace_id?: string;
          message?: string;
        }) => {
          // eslint-disable-next-line no-console
          console.log(
            "[Scenario] scenario_tool_image_complete event received:",
            {
              success: data.success,
              image_id: data.image_id,
              trace_id: data.trace_id,
              message: data.message,
            }
          );
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
          socket.off(
            "scenarios_tools_document_complete",
            handleDocumentComplete
          );
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
          socket.off(
            "scenarios_tools_document_complete",
            handleDocumentComplete
          );
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
        // scenarioDomainId is required - UI filters and selects appropriate agent for scenario generation
        if (!basicInfoState.scenarioDomainId) {
          toast.error("Please select a scenario agent before generating");
          reject(new Error("Scenario agent ID is required"));
          return;
        }

        socket.emit("generate_scenario", {
          departmentId: body.departmentId,
          scenarioDomainId: basicInfoState.scenarioDomainId, // Required: selected scenario agent ID
          imageDomainId: basicInfoState.imageDomainId || undefined, // Optional: selected image agent ID
          videoDomainId: basicInfoState.videoDomainId || undefined, // Optional: selected video agent ID
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
    },
    [
      socket,
      isConnected,
      problemStatement,
      updateProblemStatementIds,
      updateObjectiveIds,
      updateDocumentIds,
      basicInfoState,
      scenarioId,
      useImage,
      useVideo,
      useObjectives,
      useQuestions,
      selectedVideoLength,
    ]
  );

  // Helper function to build search params - imported from scenario-helpers.ts
  const buildSearchParamsCallback = useCallback(() => {
    return buildSearchParams({
      draftState,
      selectedPersonaIds,
      currentDocumentIds,
      templateDocumentIds,
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
      useObjectives,
      useImage,
      useVideo,
      useQuestions,
      useProblemStatement,
      queryParamConfig,
      searchParams,
      problemStatement,
      currentObjectives,
      name,
      isEditMode,
      scenarioData,
    });
  }, [
    draftState,
    selectedPersonaIds,
    currentDocumentIds,
    templateDocumentIds,
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
    useObjectives,
    useImage,
    useVideo,
    useQuestions,
    useProblemStatement,
    queryParamConfig,
    searchParams,
    problemStatement,
    currentObjectives,
    name,
    isEditMode,
    scenarioData,
  ]);

  // Convert arrays to lookup maps for performance (prefer arrays, fallback to mappings for backward compatibility)
  const personaMapping = useMemo(() => {
    if (!scenarioData) return {};
    const personas =
      isScenarioDetailOut(scenarioData) || isScenarioNewOut(scenarioData)
        ? scenarioData.personas
        : undefined;
    const map: Record<
      string,
      {
        persona_id: string | null;
        name: string | null;
        description: string | null;
        color: string | null;
        icon: string | null;
        image_model: boolean | null;
        parameter_ids: string[] | null;
        field_ids: string[] | null;
        example: string | null;
      }
    > = {};
    if (personas && Array.isArray(personas) && personas.length > 0) {
      personas.forEach((p) => {
        const persona = p as {
          persona_id?: string | null;
          name?: string | null;
          description?: string | null;
          color?: string | null;
          icon?: string | null;
          image_model?: boolean | null;
          parameter_ids?: Array<string | null> | null;
          field_ids?: Array<string | null> | null;
          example?: unknown;
        };
        if (persona.persona_id) {
          map[String(persona.persona_id)] = {
            persona_id: persona.persona_id,
            name: persona.name || null,
            description: persona.description || null,
            color: persona.color || null,
            icon: persona.icon || null,
            image_model: persona.image_model ?? null,
            parameter_ids:
              persona.parameter_ids
                ?.map((id) => String(id))
                .filter(
                  (id): id is string => id !== "null" && id !== "undefined"
                ) || null,
            field_ids:
              persona.field_ids
                ?.map((id) => String(id))
                .filter(
                  (id): id is string => id !== "null" && id !== "undefined"
                ) || null,
            example: (persona.example as string | null) || null,
          };
        }
      });
      return map;
    }
    // Fallback to empty object (no persona_mapping in new format)
    return {};
  }, [scenarioData]);

  const documentMapping = useMemo((): Record<string, DocumentMappingItem> => {
    // Use arrays directly (server is source of truth - arrays are guaranteed)
    if (!scenarioData) return {};
    const documents =
      isScenarioDetailOut(scenarioData) || isScenarioNewOut(scenarioData)
        ? scenarioData.documents
        : undefined;
    const map: Record<string, DocumentMappingItem> = {};
    if (documents && Array.isArray(documents)) {
      documents.forEach((d) => {
        const doc = d as {
          document_id?: string | null;
          name?: string | null;
          description?: string | null;
          file_path?: string | null;
          mime_type?: string | null;
          parameter_ids?: Array<string | null> | null;
          field_ids?: Array<string | null> | null;
          parent_document_id?: string | null;
        };
        if (doc.document_id) {
          const mappingItem: DocumentMappingItem = {
            name: doc.name || "",
            description: doc.description || "",
            parameter_ids:
              doc.parameter_ids
                ?.map((id) => String(id))
                .filter(
                  (id): id is string => id !== "null" && id !== "undefined"
                ) || [],
            field_ids:
              doc.field_ids
                ?.map((id) => String(id))
                .filter(
                  (id): id is string => id !== "null" && id !== "undefined"
                ) || [],
            parent_document_id: doc.parent_document_id
              ? String(doc.parent_document_id)
              : null,
          };
          if (doc.file_path) {
            mappingItem.filePath = doc.file_path;
          }
          if (doc.mime_type) {
            mappingItem.mimeType = doc.mime_type;
          }
          map[String(doc.document_id)] = mappingItem;
        }
      });
    }
    return map;
  }, [scenarioData]);

  const parameterMapping = useMemo(() => {
    // Use arrays directly (server is source of truth - arrays are guaranteed)
    if (!scenarioData) return {};
    const parameters =
      isScenarioDetailOut(scenarioData) || isScenarioNewOut(scenarioData)
        ? scenarioData.parameters
        : undefined;
    const map: Record<
      string,
      {
        name: string;
        description: string;
        numerical: boolean;
        document_parameter: boolean;
        persona_parameter: boolean;
        scenario_parameter: boolean;
        video_parameter: boolean;
      }
    > = {};
    if (parameters && Array.isArray(parameters)) {
      parameters.forEach((p) => {
        const param = p as {
          parameter_id?: string | null;
          name?: string | null;
          description?: string | null;
          document_parameter?: boolean | null;
          persona_parameter?: boolean | null;
          scenario_parameter?: boolean | null;
          video_parameter?: boolean | null;
        };
        if (param.parameter_id) {
          map[String(param.parameter_id)] = {
            name: param.name || "",
            description: param.description || "",
            numerical: false,
            document_parameter: param.document_parameter || false,
            persona_parameter: param.persona_parameter || false,
            scenario_parameter: param.scenario_parameter || false,
            video_parameter: param.video_parameter || false,
          };
        }
      });
    }
    return map;
  }, [scenarioData]);

  // fieldMapping is defined above (before buildSearchParams) so it can be used there
  const simulationMapping = useMemo(() => {
    // Use arrays directly (server is source of truth - arrays are guaranteed)
    // simulations only exist on ScenarioDetailOut
    if (!scenarioData || !isScenarioDetailOut(scenarioData)) return {};
    const simulations = scenarioData.simulations;
    const map: Record<
      string,
      {
        name: string;
        description: string;
        time_limit?: number | null;
        department_ids: string[];
      }
    > = {};
    if (simulations && Array.isArray(simulations)) {
      simulations.forEach((s) => {
        const sim = s as {
          simulation_id?: string | null;
          name?: string | null;
          description?: string | null;
          time_limit?: number | null;
          department_ids?: Array<string | null> | null;
        };
        if (sim.simulation_id) {
          map[String(sim.simulation_id)] = {
            name: sim.name || "",
            description: sim.description || "",
            time_limit: sim.time_limit ?? null,
            department_ids:
              sim.department_ids
                ?.map((id) => String(id))
                .filter(
                  (id): id is string => id !== "null" && id !== "undefined"
                ) || [],
          };
        }
      });
    }
    return map;
  }, [scenarioData]);

  const departmentMapping = useMemo(() => {
    // Use arrays directly (server is source of truth - arrays are guaranteed)
    if (!scenarioData) return {};
    const departments =
      isScenarioDetailOut(scenarioData) || isScenarioNewOut(scenarioData)
        ? scenarioData.departments
        : undefined;
    const map: Record<
      string,
      {
        name: string;
        description: string;
        persona_ids: string[];
        document_ids: string[];
        parameter_ids: string[];
        parameter_item_ids: string[];
      }
    > = {};
    if (departments && Array.isArray(departments)) {
      departments.forEach((d) => {
        const dept = d as {
          department_id?: string | null;
          name?: string | null;
          description?: string | null;
          persona_ids?: Array<string | null> | null;
          document_ids?: Array<string | null> | null;
          parameter_ids?: Array<string | null> | null;
          field_ids?: Array<string | null> | null;
        };
        if (dept.department_id) {
          map[String(dept.department_id)] = {
            name: dept.name || "",
            description: dept.description || "",
            persona_ids:
              dept.persona_ids
                ?.map((id) => String(id))
                .filter(
                  (id): id is string => id !== "null" && id !== "undefined"
                ) || [],
            document_ids:
              dept.document_ids
                ?.map((id) => String(id))
                .filter(
                  (id): id is string => id !== "null" && id !== "undefined"
                ) || [],
            parameter_ids:
              dept.parameter_ids
                ?.map((id) => String(id))
                .filter(
                  (id): id is string => id !== "null" && id !== "undefined"
                ) || [],
            parameter_item_ids:
              dept.field_ids
                ?.map((id) => String(id))
                .filter(
                  (id): id is string => id !== "null" && id !== "undefined"
                ) || [],
          };
        }
      });
    }
    return map;
  }, [scenarioData]);

  const agentMapping = useMemo(() => {
    // Use arrays directly (server is source of truth - arrays are guaranteed)
    if (!scenarioData) return {};
    const agents =
      isScenarioDetailOut(scenarioData) || isScenarioNewOut(scenarioData)
        ? scenarioData.agents
        : undefined;
    const map: Record<
      string,
      {
        name: string;
        description: string;
        roles: string[];
      }
    > = {};
    if (agents && Array.isArray(agents)) {
      agents.forEach((a) => {
        const agent = a as {
          agent_id?: string | null;
          name?: string | null;
          description?: string | null;
          roles?: Array<string | null> | null;
        };
        if (agent.agent_id) {
          map[String(agent.agent_id)] = {
            name: agent.name || "",
            description: agent.description || "",
            roles:
              agent.roles?.filter(
                (role): role is string => role !== null && role !== undefined
              ) || [],
          };
        }
      });
    }
    return map;
  }, [scenarioData]);
  // Merge server problem statement mapping with local versions (for create mode)
  // IDs from database are unique, so just merge - local versions override server versions if same ID
  const problemStatementMapping = useMemo(() => {
    const data = scenarioData as
      | ScenarioDetailOut
      | ScenarioNewOut
      | null
      | undefined;
    // Build mapping from problem_statements array
    const serverMapping: Record<
      string,
      {
        name: string;
        problem_statement: string;
        created_at: string;
        updated_at: string;
      }
    > = {};
    if (data?.problem_statements) {
      data.problem_statements.forEach((ps) => {
        if (ps.problem_statement_id) {
          serverMapping[String(ps.problem_statement_id)] = {
            name: ps.name || "", // Ensure name field exists
            problem_statement: ps.problem_statement || "",
            created_at: ps.created_at || "",
            updated_at: ps.updated_at || "",
          };
        }
      });
    }

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
        if (parentId && docDetail.document_id) {
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
    const selectedDeptIds = draftState.departmentIds || [];

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
  }, [scenarioData?.objectives_history, draftState.departmentIds]);

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
    // Use server-provided filtered IDs (valid_field_ids exists on both types)
    // Fallback for backward compatibility
    return validParameterItemIds;
  }, [validParameterItemIds]);

  const generalParameterMapping = useMemo(() => {
    // Top parameter selection is the source of truth for section 4
    // Show all selected parameters (or none if empty), regardless of whether they have fields
    // This allows debugging - parameters with 0 fields will still be visible
    const selectedParamIds = draftState.parameterIds || [];
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
  }, [
    parameterMapping,
    draftState.parameterIds,
    currentFieldIds,
    fieldMapping,
  ]);

  // Track department changes and manage staged selections
  useEffect(() => {
    const currentDeptIds = draftState.departmentIds || [];
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
    draftState.departmentIds,
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
    // valid_department_ids exists on ScenarioNewOut
    const newDataForDepts =
      scenarioData && !isEditMode && isScenarioNewOut(scenarioData)
        ? (scenarioData as ScenarioNewOut)
        : null;
    const validDeptIdsArray =
      newDataForDepts &&
      "valid_department_ids" in newDataForDepts &&
      newDataForDepts.valid_department_ids
        ? (newDataForDepts.valid_department_ids as string[]).map(String)
        : [];
    const validDeptIds = new Set(validDeptIdsArray);
    setStagedSelections((prev) => {
      const cleaned: Record<string, StagedSelections> = {};
      Object.keys(prev).forEach((deptId) => {
        if (validDeptIds.has(deptId) && prev[deptId]) {
          cleaned[deptId] = prev[deptId];
        }
      });
      return cleaned;
    });
  }, [scenarioData, isEditMode]);

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

      // Update draft state with randomized selections (no URL update needed - form fields are in draft state)
      // Note: URL params are only for search/filter, not form fields

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

      const newParams = buildSearchParamsCallback();
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
    draftState.departmentIds,
    selectedPersonaIds,
    currentDocumentIds,
    templateDocumentIds,
    draftState.parameterIds,
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
      // In edit mode, scenarioData is ScenarioDetailOut
      const detailData = scenarioData as ScenarioDetailOut;
      const deptIds = detailData.department_ids || [];
      // Initialize name and problemStatement in draft state
      handleInputChange("name", detailData.name || null);
      handleInputChange(
        "problemStatement",
        detailData.problem_statement || null
      );
      // Initialize basic info state
      setBasicInfoState({
        scenarioDomainId: detailData.scenario_domain_id || null,
        imageDomainId: detailData.image_domain_id || null,
        videoDomainId:
          (detailData as ScenarioDetailOut & { video_domain_id?: string })
            .video_domain_id || null,
        active: detailData.active ?? true,
      });
      handleInputChange("departmentIds", deptIds);
      handleInputChange("parameterIds", detailData.parameter_ids || []);
      // Initialize previousDepartmentIds when loading scenario data
      if (previousDepartmentIds.length === 0 && deptIds.length > 0) {
        setPreviousDepartmentIds(deptIds.map(String));
      }
      updatePersonaIds(detailData.persona_ids || []);
      // Clear local versions when loading existing scenario (edit mode)
      setLocalProblemStatementVersions([]);
      const docIds = detailData.document_ids || [];
      updateDocumentIds(docIds);
      // Extract template document IDs from documentDetails (is_template field) for edit mode
      const templateDocIds =
        detailData.document_details
          ?.filter((doc) => doc.is_template === true)
          .map((doc) => doc.document_id)
          .filter((id): id is string => id !== null) || [];
      updateTemplateDocumentIds(templateDocIds);
      // Extract field IDs from parameters array
      const fieldIds = (detailData.parameters || [])
        .flatMap((p) => {
          // Parameters array contains objects with field_ids array
          const paramWithFields = p as { field_ids?: string[] | null };
          return paramWithFields.field_ids || [];
        })
        .filter((id): id is string => id !== null && id !== undefined);
      updateFieldIds(fieldIds);
      updateObjectives(
        getObjectivesFromMapping(
          detailData.objective_ids || [],
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

      // Update feature flags in draft state
      handleInputChange("useObjectives", objectivesEnabled || null);
      handleInputChange("useImage", imagesEnabled || null);
      handleInputChange("useProblemStatement", problemStatementEnabled || null);
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
      handleInputChange("useVideo", videoEnabled || null);
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
      handleInputChange("useQuestions", questionsEnabled || null);
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
        departmentIds: detailData.department_ids || [],
        parameterIds: detailData.parameter_ids || [],
      });
      setOriginalDocumentIds(detailData.document_ids || []);
      // Store template document IDs for original tracking (already extracted above as templateDocIds)
      setOriginalTemplateDocumentIds(templateDocIds);
      // Extract field IDs from parameters structure
      const fieldIdsFromParams = (detailData.parameters || [])
        .flatMap((p) => {
          const paramWithFields = p as { field_ids?: string[] | null };
          return paramWithFields.field_ids || [];
        })
        .filter((id): id is string => id !== null && id !== undefined);
      setOriginalFieldIds(fieldIdsFromParams);
      setOriginalObjectives(
        getObjectivesFromMapping(
          detailData.objective_ids || [],
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
      if (!problemStatement) {
        // No problem statement in URL - keep empty or use default
      }
      if (!name || name === "New Scenario") {
        // Name is default or not set - keep as is (nuqs will handle default)
      }
      // Initialize basic info state
      setBasicInfoState({
        scenarioDomainId: scenarioData.scenario_domain_id || null,
        imageDomainId: scenarioData.image_domain_id || null,
        videoDomainId:
          (scenarioData as ScenarioDetailOut & { video_domain_id?: string })
            .video_domain_id || null,
        active: true, // Default for create mode
      });
      // Initialize draft state from initialFormData and server response
      setDraftState((prev) => ({
        ...prev,
        ...initialFormData,
        parameterIds:
          ("selected_parameter_ids" in newData &&
            Array.isArray(newData.selected_parameter_ids) &&
            newData.selected_parameter_ids) ||
          [],
      }));

      // Initialize selections from server response (filtered to valid IDs)
      // Only update URL if server values differ from current URL values
      if (
        "selected_persona_ids" in newData &&
        Array.isArray(newData.selected_persona_ids) &&
        newData.selected_persona_ids.length > 0
      ) {
        const currentPersonaIds = selectedPersonaIds;
        if (
          JSON.stringify([...currentPersonaIds].sort()) !==
          JSON.stringify([...newData.selected_persona_ids].sort())
        ) {
          updatePersonaIds(newData.selected_persona_ids);
        }
      }
      if (
        "selected_document_ids" in newData &&
        Array.isArray(newData.selected_document_ids) &&
        newData.selected_document_ids.length > 0
      ) {
        const currentDocIds = currentDocumentIds;
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
      } else if (
        "selected_template_document_ids" in newData &&
        Array.isArray(newData.selected_template_document_ids) &&
        newData.selected_template_document_ids.length > 0
      ) {
        // Fallback to server response if no URL params
        updateTemplateDocumentIds(newData.selected_template_document_ids);
      }
      if (
        "selected_field_ids" in newData &&
        Array.isArray(newData.selected_field_ids) &&
        newData.selected_field_ids.length > 0
      ) {
        const currentFieldIdsFromQ = currentFieldIds;
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
      const currentObjectiveIdsFromQ = currentObjectiveIds;
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
      const currentProblemStatementIdsFromQ = currentProblemStatementIds;
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
              handleInputChange(
                "problemStatement",
                firstProblemStatement.problem_statement || null
              );
            }
            // Set name in new mode (using name field)
            const isNewMode =
              !isEditMode &&
              (!name || name === "New Scenario" || name.trim() === "");
            if (isNewMode && firstProblemStatement.name) {
              handleInputChange("name", firstProblemStatement.name || null);
            }
          }
        }
      }

      // Initialize search terms and ranges from server response (update URL via nuqs)
      // Only update if server values differ from current URL values
      const updates: Partial<Record<string, string | number | null>> = {};
      if (
        "persona_search" in newData &&
        typeof newData.persona_search === "string" &&
        newData.persona_search &&
        newData.persona_search !== personaSearchTerm
      ) {
        updates["personaSearch"] = newData.persona_search;
      }
      if (
        "document_search" in newData &&
        typeof newData.document_search === "string" &&
        newData.document_search &&
        newData.document_search !== documentSearchTerm
      ) {
        updates["documentSearch"] = newData.document_search;
      }
      if (
        "parameter_search" in newData &&
        typeof newData.parameter_search === "string" &&
        newData.parameter_search &&
        newData.parameter_search !== parameterSearchTerm
      ) {
        updates["parameterSearch"] = newData.parameter_search;
      }

      // Update ranges if server values differ
      const serverPersonaMin = isScenarioNewOut(newData)
        ? (newData.persona_range_min ?? 1)
        : 1;
      const serverPersonaMax = isScenarioNewOut(newData)
        ? (newData.persona_range_max ?? 1)
        : 1;
      if (
        personaMinMax.min !== serverPersonaMin ||
        personaMinMax.max !== serverPersonaMax
      ) {
        updates["personaMin"] = serverPersonaMin;
        updates["personaMax"] = serverPersonaMax;
      }

      const serverDocumentMin = isScenarioNewOut(newData)
        ? (newData.document_range_min ?? 0)
        : 0;
      const serverDocumentMax = isScenarioNewOut(newData)
        ? (newData.document_range_max ?? 1)
        : 1;
      if (
        documentMinMax.min !== serverDocumentMin ||
        documentMinMax.max !== serverDocumentMax
      ) {
        updates["documentMin"] = serverDocumentMin;
        updates["documentMax"] = serverDocumentMax;
      }

      const parameterDefault = parameterSelectionMinMax;
      const serverParameterMin = isScenarioNewOut(newData)
        ? (newData.parameter_range_min ?? parameterDefault.min)
        : parameterDefault.min;
      const serverParameterMax = isScenarioNewOut(newData)
        ? (newData.parameter_range_max ?? parameterDefault.max)
        : parameterDefault.max;
      if (
        parameterSelectionMinMax.min !== serverParameterMin ||
        parameterSelectionMinMax.max !== serverParameterMax
      ) {
        updates["parameterSelectionMin"] = serverParameterMin;
        updates["parameterSelectionMax"] = serverParameterMax;
      }

      if (Object.keys(updates).length > 0) {
        setFormData(updates);
      }

      // Initialize per-parameter item ranges from server response
      // Always update field ranges (even if empty) to ensure reset works
      if ("field_ranges" in newData && newData.field_ranges) {
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
        const currentFieldRanges = fieldMinMax;
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
        const currentFieldRanges = fieldMinMax;
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
    effectiveProfile?.primary_department_id,
    initialFormData,
    searchParams,
    q.documentMax,
    q.documentMin,
    documentSearchTerm,
    parameterSearchTerm,
    parameterSelectionMinMax,
    personaMinMax,
    personaSearchTerm,
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

  // Note: Domain ID validation removed - domains are already validated by artifact type
  // No need to check agent roles since domain IDs are already scoped to the correct artifact

  // Auto-select domains when there's only one option (similar to Document.tsx)
  // Note: This assumes the API returns domain IDs in scenario_domain_id, image_domain_id, video_domain_id fields
  // If the API still returns agent IDs, this will need to be updated to look up domain IDs from agent IDs
  useEffect(() => {
    if (!scenarioData) return;

    // Auto-select scenario domain if only one option and not already set
    // TODO: Update this when API returns valid_domain_ids instead of valid_agent_ids
    if (scenarioData.scenario_domain_id && !basicInfoState.scenarioDomainId) {
      setBasicInfoState((prev) => ({
        ...prev,
        scenarioDomainId: scenarioData.scenario_domain_id || null,
      }));
    }

    // Auto-select image domain if only one option and not already set
    if (scenarioData.image_domain_id && !basicInfoState.imageDomainId) {
      setBasicInfoState((prev) => ({
        ...prev,
        imageDomainId: scenarioData.image_domain_id || null,
      }));
    }

    // Auto-select video domain if only one option and not already set
    if (
      (scenarioData as ScenarioDetailOut & { video_domain_id?: string })
        ?.video_domain_id &&
      !basicInfoState.videoDomainId
    ) {
      setBasicInfoState((prev) => ({
        ...prev,
        videoDomainId:
          (scenarioData as ScenarioDetailOut & { video_domain_id?: string })
            ?.video_domain_id || null,
      }));
    }
  }, [
    scenarioData,
    basicInfoState.scenarioDomainId,
    basicInfoState.imageDomainId,
    basicInfoState.videoDomainId,
  ]);

  // Store original name and problemStatement for change tracking (from server data)
  const originalName = useMemo(() => {
    if (!isEditMode || !scenarioData) return "New Scenario";
    // In edit mode, scenarioData is ScenarioDetailOut
    if ("name" in scenarioData) {
      return (scenarioData as ScenarioDetailOut).name || "New Scenario";
    }
    return "New Scenario";
  }, [isEditMode, scenarioData]);

  const originalProblemStatement = useMemo(() => {
    if (!isEditMode || !scenarioData) return "";
    return (scenarioData as ScenarioDetailOut).problem_statement || "";
  }, [isEditMode, scenarioData]);

  // Store original basic info state for change tracking
  const originalBasicInfoState = useMemo(() => {
    if (!isEditMode || !scenarioData) {
      return {
        scenarioDomainId: null,
        imageDomainId: null,
        videoDomainId: null,
        active: true,
      };
    }
    // In edit mode, scenarioData is ScenarioDetailOut
    const detailData = scenarioData as ScenarioDetailOut;
    return {
      scenarioDomainId: detailData.scenario_domain_id || null,
      imageDomainId: detailData.image_domain_id || null,
      videoDomainId:
        (detailData as ScenarioDetailOut & { video_domain_id?: string })
          .video_domain_id || null,
      active: detailData.active ?? true,
    };
  }, [isEditMode, scenarioData]);

  // Check if form has changes
  const hasChanges = useMemo(() => {
    if (!isEditMode) return false;

    const current = formData;
    const original = originalFormData;
    // In edit mode, get persona_ids from ScenarioDetailOut
    const originalPersonaIds =
      isEditMode && scenarioData && "persona_ids" in scenarioData
        ? (scenarioData as ScenarioDetailOut).persona_ids || []
        : [];

    return (
      JSON.stringify(selectedPersonaIds.sort()) !==
        JSON.stringify(originalPersonaIds.sort()) ||
      name !== originalName ||
      problemStatement !== originalProblemStatement ||
      basicInfoState.active !== originalBasicInfoState.active ||
      basicInfoState.scenarioDomainId !==
        originalBasicInfoState.scenarioDomainId ||
      basicInfoState.imageDomainId !== originalBasicInfoState.imageDomainId ||
      basicInfoState.videoDomainId !== originalBasicInfoState.videoDomainId ||
      JSON.stringify(
        (current["departmentIds"] as string[] | undefined)?.sort() || []
      ) !== JSON.stringify((original.departmentIds || []).sort()) ||
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
    basicInfoState.scenarioDomainId,
    basicInfoState.imageDomainId,
    basicInfoState.videoDomainId,
    originalBasicInfoState.active,
    originalBasicInfoState.scenarioDomainId,
    originalBasicInfoState.imageDomainId,
    originalBasicInfoState.videoDomainId,
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
    // can_edit exists on ScenarioDetailOut
    if ("can_edit" in scenarioData) {
      return !(scenarioData as ScenarioDetailOut).can_edit;
    }
    return false;
  }, [isEditMode, scenarioData]);

  // Get affected simulations from V2 data
  const affectedSimulations = useMemo(() => {
    // simulation_ids exists on ScenarioDetailOut
    if (isEditMode && scenarioData && isScenarioDetailOut(scenarioData)) {
      if (!scenarioData.simulation_ids) return [];
      return scenarioData.simulation_ids.map((id: string) => {
        const sim = simulationMapping[id] as { name?: string } | undefined;
        return {
          id,
          name: sim?.name || "",
          active: true, // These are active simulations from server
        };
      });
    }
    return [];
  }, [isEditMode, scenarioData, simulationMapping]);

  // Calculate step status for GenericForm
  // Note: formData parameter is urlParams (search/filter only), but status is calculated from draftState (form fields)
  const getStepStatus = useCallback(
    (stepId: string, _formData: Record<string, unknown>): StepStatus => {
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
            : (draftState.parameterIds || []).length > 0
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
      draftState.parameterIds,
    ]
  );

  // Steps configuration for GenericForm
  const steps = useMemo(
    () => [
      {
        id: "basic",
        title: "Basic Information",
        description:
          "Set scenario name, departments, agents, and active status.",
        resetFields: [
          "name",
          "departmentIds",
          "scenarioDomainId",
          "imageDomainId",
          "videoDomainId",
          "active",
        ],
      },
      {
        id: "persona",
        title: "Persona Selection",
        description: "Select personas for this scenario.",
        resetFields: ["personaIds"],
        filters: [{ key: "personaShowSelected", label: "Show selected" }],
      },
      {
        id: "documents",
        title: "Document Selection",
        description: "Select documents and templates for this scenario.",
        resetFields: ["documentIds", "templateDocumentIds"],
        filters: [
          { key: "documentShowSelected", label: "Show selected" },
          { key: "documentShowTemplate", label: "Show templates" },
        ],
      },
      {
        id: "parameters",
        title: "Parameter Selection",
        description: "Select parameters for this scenario.",
        resetFields: ["parameterIds"],
        filters: [{ key: "parameterShowSelected", label: "Show selected" }],
      },
      // Dynamic parameter item steps added via contentSections
      {
        id: "content",
        title: "Content",
        description:
          "Define problem statement, objectives, images, videos, and questions.",
        resetFields: [
          "problemStatement",
          "objectives",
          "useImage",
          "useVideo",
          "useObjectives",
          "useQuestions",
          "useProblemStatement",
        ],
      },
    ],
    []
  );

  // Content sections will be defined after renderStep (see below)

  // Form initialization function for GenericForm
  // Updates draftState directly (like Cohort.tsx), returns empty object for GenericForm
  const initializeForm = useCallback(
    (serverData: unknown, editMode: boolean) => {
      if (
        !editMode ||
        !serverData ||
        typeof serverData !== "object" ||
        !("department_ids" in serverData)
      ) {
        return {};
      }

      const scenarioDetail = serverData as ScenarioDetailOut;
      const deptIds = scenarioDetail.department_ids || [];

      // Update draftState directly
      const draftUpdates: Partial<DraftState> = {};

      if (scenarioDetail.name) draftUpdates.name = scenarioDetail.name;
      if (scenarioDetail.problem_statement)
        draftUpdates.problemStatement = scenarioDetail.problem_statement;
      if (deptIds.length > 0)
        draftUpdates.departmentIds = deptIds.map((id) => String(id));
      if (scenarioDetail.persona_ids && scenarioDetail.persona_ids.length > 0)
        draftUpdates.personaIds = scenarioDetail.persona_ids;
      if (scenarioDetail.document_ids && scenarioDetail.document_ids.length > 0)
        draftUpdates.documentIds = scenarioDetail.document_ids;
      if (
        scenarioDetail.parameter_ids &&
        scenarioDetail.parameter_ids.length > 0
      )
        draftUpdates.parameterIds = scenarioDetail.parameter_ids;
      if (scenarioDetail.active !== undefined)
        draftUpdates.active = scenarioDetail.active ?? true;
      if (scenarioDetail.scenario_domain_id)
        draftUpdates.scenarioDomainId = scenarioDetail.scenario_domain_id;
      if (scenarioDetail.image_domain_id)
        draftUpdates.imageDomainId = scenarioDetail.image_domain_id;
      if (
        (scenarioDetail as ScenarioDetailOut & { video_domain_id?: string })
          .video_domain_id
      )
        draftUpdates.videoDomainId =
          (scenarioDetail as ScenarioDetailOut & { video_domain_id?: string })
            .video_domain_id || null;
      if (scenarioDetail.image_input_enabled !== undefined)
        draftUpdates.useImage = scenarioDetail.image_input_enabled ?? false;
      if (
        (scenarioDetail as ScenarioDetailOut & { video_enabled?: boolean })
          .video_enabled !== undefined
      )
        draftUpdates.useVideo =
          (scenarioDetail as ScenarioDetailOut & { video_enabled?: boolean })
            .video_enabled ?? false;
      if (scenarioDetail.objectives_enabled !== undefined)
        draftUpdates.useObjectives = scenarioDetail.objectives_enabled ?? true;
      if (
        (scenarioDetail as ScenarioDetailOut & { questions_enabled?: boolean })
          .questions_enabled !== undefined
      )
        draftUpdates.useQuestions =
          (
            scenarioDetail as ScenarioDetailOut & {
              questions_enabled?: boolean;
            }
          ).questions_enabled ?? false;

      // Apply updates to draftState
      if (Object.keys(draftUpdates).length > 0) {
        setDraftState((prev) => ({ ...prev, ...draftUpdates }));
      }

      // Return empty object for GenericForm compatibility (form fields are handled via draftState)
      return {};
    },
    []
  );

  // Parameter actions - WebSocket randomization per parameter
  const handleRandomizeParameterClient = useCallback(
    (paramId: string) => {
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
    },
    [
      socket,
      isConnected,
      setRandomizingSection,
      isEditMode,
      scenarioId,
      q,
      fieldMinMax,
      effectiveProfile?.id,
    ]
  );

  const handleResetParameter = useCallback(
    (paramId: string) => {
      try {
        // Get default min/max for this parameter from server or use defaults
        // field_ranges is an array on ScenarioDetailOut, not an object
        // For create mode, we don't have field_ranges, so use defaults
        const defaultMin = 1;
        const defaultMax = 3;

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

        // Clear draft state (form fields are in draft state, not URL params)
        handleInputChange("fieldIds", null);
        handleInputChange("randomize", null);
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
    },
    [
      currentFieldIds,
      fieldMapping,
      handleInputChange,
      searchParams,
      router,
      pathname,
      updateFieldRanges,
      updateFieldIds,
      generalParameterMapping,
    ]
  );

  // Persona actions - WebSocket randomization
  const handleRandomizePersonaClient = useCallback(() => {
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
  }, [
    socket,
    isConnected,
    setRandomizingSection,
    isEditMode,
    scenarioId,
    q,
    fieldMinMax,
    effectiveProfile?.id,
  ]);

  // Documents actions - WebSocket randomization
  const handleRandomizeDocumentsClient = useCallback(() => {
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
  }, [
    socket,
    isConnected,
    setRandomizingSection,
    isEditMode,
    scenarioId,
    q,
    fieldMinMax,
    effectiveProfile?.id,
  ]);

  // Document removal handler - removes document from selection
  const handleDocumentRemove = useCallback(
    (docId: string) => {
      // Check if document is in currentDocumentIds (could be regular or child document)
      if (currentDocumentIds.includes(docId)) {
        updateDocumentIds((prev) => prev.filter((id) => id !== docId));
      }
      // Check if document is in templateDocumentIds (template document)
      if (templateDocumentIds.includes(docId)) {
        updateTemplateDocumentIds((prev) => prev.filter((id) => id !== docId));
      }
      // Note: URL params are automatically updated via useEffect that watches currentDocumentIds and templateDocumentIds
    },
    [
      currentDocumentIds,
      templateDocumentIds,
      updateDocumentIds,
      updateTemplateDocumentIds,
    ]
  );

  // Parameters actions - WebSocket randomization
  const handleRandomizeParametersClient = useCallback(() => {
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
  }, [
    socket,
    isConnected,
    setRandomizingSection,
    isEditMode,
    scenarioId,
    q,
    fieldMinMax,
    effectiveProfile?.id,
  ]);

  // Helper functions removed - filtering now handled by server

  // Randomize all: personas, documents, and all parameters (WebSocket)
  const handleRandomizeAll = useCallback(() => {
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
  }, [
    socket,
    isConnected,
    setRandomizingSection,
    isEditMode,
    scenarioId,
    q,
    fieldMinMax,
    effectiveProfile?.id,
  ]);

  const handleResetContent = useCallback(() => {
    try {
      // Clear problem statement and turn off objectives
      handleInputChange("problemStatement", null);
      // Clear objectives array via contentState
      setContentState((prev) => ({ ...prev, objectives: [] }));
      // Clear selected problem statement ID
      toast.success("Scenario content reset");
    } catch {
      toast.error("Failed to reset content");
    }
  }, [handleInputChange, setContentState]);

  const handleProblemStatementVersionSelect = useCallback(
    (id: string) => {
      if (id && problemStatementMapping[id]) {
        handleInputChange(
          "problemStatement",
          problemStatementMapping[id].problem_statement
        );
      }
    },
    [problemStatementMapping, handleInputChange]
  );

  // Note: Objective, question, option, and image/video handlers are now in ContentSection

  const handleImageUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
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

              if (!finalizeResult.success || !finalizeResult.upload_id) {
                throw new Error(
                  finalizeResult.message || "Failed to finalize upload"
                );
              }

              const databaseUploadId = finalizeResult.upload_id;

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
    },
    [setContentState]
  );

  const handleGenerateScenario = useCallback(
    async (
      userInstructions?: string,
      _shouldRegenerateObjectives?: boolean
    ) => {
      setIsGeneratingScenario(true);

      try {
        // Get department ID from first valid department
        const departmentId = effectiveProfile?.primary_department_id || "";
        if (!departmentId) {
          throw new Error("No valid department found");
        }

        const result = await handleGenerateAIScenario({
          departmentId,
          personaIds: selectedPersonaIds.length > 0 ? selectedPersonaIds : null,
          documentIds:
            currentDocumentIds.length > 0 ? currentDocumentIds : null,
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
    },
    [
      effectiveProfile,
      handleGenerateAIScenario,
      selectedPersonaIds,
      currentDocumentIds,
      currentFieldIds,
      useObjectives,
      useImage,
      useVideo,
      useQuestions,
      isEditMode,
      scenarioId,
    ]
  );

  const handleSubmit = async () => {
    setIsSubmitting(true);

    try {
      // Transform department IDs for submit (non-superadmin: empty -> all valid departments)
      const newDataForDepts =
        scenarioData && !isEditMode && isScenarioNewOut(scenarioData)
          ? (scenarioData as ScenarioNewOut)
          : null;
      const validDeptIds =
        newDataForDepts &&
        "valid_department_ids" in newDataForDepts &&
        newDataForDepts.valid_department_ids
          ? (newDataForDepts.valid_department_ids as string[]).map(String)
          : [];
      const finalDepartmentIds = transformDepartmentIdsForSubmit(
        draftState.departmentIds || [],
        isSuperadmin,
        validDeptIds
      );

      // Prepare payload for V2 API
      const parametersDict = groupFieldsByParameterId(
        currentFieldIds, // Renamed from currentParameterItemIds
        fieldMapping // Renamed from parameterItemMapping
      );
      // Convert parameters dict to array format required by API: [{ parameter_id: string, field_ids: string[] }]
      const parametersArray: Array<{
        parameter_id: string;
        field_ids: string[];
      }> = Object.entries(parametersDict).map(([paramId, fieldIds]) => ({
        parameter_id: paramId,
        field_ids: fieldIds,
      }));
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
        parameters: Array<{ parameter_id: string; field_ids: string[] }>;
        parameter_item_ids: string[];
        parameter_ids?: string[] | null;
        scenario_domain_id?: string | null;
        image_domain_id?: string | null;
        video_enabled?: boolean;
        questions_enabled?: boolean;
        video_domain_id?: string | null;
        video_ids?: string[] | null;
        active_video_id?: string | null;
        question_ids?: string[] | null;
        question_timestamps?: Array<{
          question_id: string | null;
          video_id: string | null;
          timestamps: number[] | null;
        }> | null;
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
        parameters: parametersArray,
        parameter_item_ids: parameterItemIds,
        parameter_ids: parameterIds.length > 0 ? parameterIds : null,
        scenario_domain_id: basicInfoState.scenarioDomainId || null,
        image_domain_id: basicInfoState.imageDomainId || null,
        video_enabled: useVideo,
        questions_enabled: useQuestions,
        video_domain_id: basicInfoState.videoDomainId || null,
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
            ? contentState.questions
                .filter((q) => q.times && q.times.length > 0)
                .map((q) => ({
                  question_id: q.id,
                  video_id: contentState.selectedVideo!.id,
                  timestamps: q.times!,
                }))
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
  const handlePersonaSelect = useCallback(
    (ids: string[]) => {
      updatePersonaIds(ids);
    },
    [updatePersonaIds]
  );

  // Render step callback for GenericForm
  // Migrates all custom sections inline using StepCard/SelectableGrid pattern
  const renderStep = useCallback(
    ({
      stepId,
      stepStatus,
      stepTitle,
      stepDescription,
      stepNumber,
      formData: _stepFormData,
      setFormData: _setStepFormData,
      onReset,
    }: {
      stepId: string;
      stepTitle: string;
      stepDescription: string;
      stepNumber: number;
      stepStatus: StepStatus;
      isOptional: boolean;
      formData: Record<string, unknown>;
      setFormData: (updates: Partial<Record<string, unknown>>) => void;
      filters?: Array<{
        key: string;
        label: string;
        value: boolean;
        onChange: (value: boolean) => void;
      }>;
      onReset?: () => void;
    }) => {
      switch (stepId) {
        case "basic": {
          // Migrate ScenarioBasicInfoSection inline
          // Agent IDs are conditionally rendered below, no need for these variables

          // Agent pickers are conditionally rendered below, no need for these variables

          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={isReadonly}
              isEditMode={isEditMode}
              editableTitle={{
                value: name || "New Scenario",
                onChange: (value) => handleInputChange("name", value),
                placeholder: "New Scenario",
                defaultName: "New Scenario",
                required: false,
              }}
              {...(onReset ? { onReset } : {})}
              resetFields={[
                "name",
                "departmentIds",
                "scenarioDomainId",
                "imageDomainId",
                "videoDomainId",
                "active",
              ]}
              actions={
                <div className="flex items-center gap-2">
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleRandomizeAll}
                    disabled={isReadonly}
                  >
                    Randomize All
                  </Button>
                </div>
              }
            >
              <div className="space-y-4">
                {/* Department Selection */}
                {(() => {
                  const newDataForDepts =
                    scenarioData &&
                    !isEditMode &&
                    isScenarioNewOut(scenarioData)
                      ? (scenarioData as ScenarioNewOut)
                      : null;
                  const validDeptIds =
                    newDataForDepts &&
                    "valid_department_ids" in newDataForDepts &&
                    newDataForDepts.valid_department_ids
                      ? (newDataForDepts.valid_department_ids as string[]).map(
                          String
                        )
                      : [];
                  return validDeptIds.length > 1 ? (
                    <div className="space-y-2">
                      <Label htmlFor="department">Department</Label>
                      <GenericPicker
                        items={departmentMapping}
                        itemIds={Array.from(
                          new Set([
                            ...validDeptIds,
                            ...(draftState.departmentIds || []),
                          ])
                        )}
                        selectedIds={draftState.departmentIds || []}
                        onSelect={(ids) =>
                          handleInputChange("departmentIds", ids)
                        }
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
                    </div>
                  ) : null;
                })()}

                {/* Agent Selection */}
                {(() => {
                  const agentIds =
                    scenarioData && "valid_agent_ids" in scenarioData
                      ? (scenarioData as ScenarioNewOut).valid_agent_ids || []
                      : [];
                  const filteredScenarioAgentIds = agentIds.filter((id) => {
                    const agent = agentMapping[id];
                    return agent?.roles?.includes("scenario");
                  });
                  const imageDomainIds = agentIds.filter((id) => {
                    const agent = agentMapping[id];
                    return agent?.roles?.includes("image");
                  });
                  const videoDomainIds = agentIds.filter((id) => {
                    const agent = agentMapping[id];
                    return agent?.roles?.includes("video");
                  });
                  const showScenarioPicker =
                    filteredScenarioAgentIds.length > 0;
                  const showImagePicker = imageDomainIds.length > 0;
                  const showVideoPicker = videoDomainIds.length > 0;

                  return showScenarioPicker ||
                    showImagePicker ||
                    showVideoPicker ? (
                    <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                      {/* Scenario Agent Selection */}
                      {showScenarioPicker && (
                        <div className="space-y-2">
                          <Label htmlFor="scenarioDomainId">
                            Scenario Agent
                          </Label>
                          <GenericPicker
                            items={agentMapping}
                            itemIds={filteredScenarioAgentIds}
                            selectedIds={
                              basicInfoState.scenarioDomainId
                                ? [basicInfoState.scenarioDomainId]
                                : []
                            }
                            onSelect={(ids) =>
                              setBasicInfoState((prev) => ({
                                ...prev,
                                scenarioDomainId: ids[0] || null,
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
                                  {item.description ||
                                    "No description available"}
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
                        </div>
                      )}

                      {/* Image Agent Selection */}
                      {showImagePicker && (
                        <div className="space-y-2">
                          <Label htmlFor="imageDomainId">Image Agent</Label>
                          <GenericPicker
                            items={agentMapping}
                            itemIds={imageDomainIds}
                            selectedIds={
                              basicInfoState.imageDomainId
                                ? [basicInfoState.imageDomainId]
                                : []
                            }
                            onSelect={(ids) =>
                              setBasicInfoState((prev) => ({
                                ...prev,
                                imageDomainId: ids[0] || null,
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
                                  {item.description ||
                                    "No description available"}
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
                        </div>
                      )}

                      {/* Video Agent Selection */}
                      {showVideoPicker && (
                        <div className="space-y-2">
                          <Label htmlFor="videoDomainId">Video Agent</Label>
                          <GenericPicker
                            items={agentMapping}
                            itemIds={videoDomainIds}
                            selectedIds={
                              basicInfoState.videoDomainId
                                ? [basicInfoState.videoDomainId]
                                : []
                            }
                            onSelect={(ids) =>
                              setBasicInfoState((prev) => ({
                                ...prev,
                                videoDomainId: ids[0] || null,
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
                                  {item.description ||
                                    "No description available"}
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
                            placeholder="Select video agent"
                            disabled={isReadonly}
                            multiSelect={false}
                            hideSelectedChips={true}
                            buttonClassName="w-full"
                            groupHeading="Agents"
                          />
                        </div>
                      )}
                    </div>
                  ) : null;
                })()}

                {/* Active Switch */}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="active">Active</Label>
                    <p className="text-xs text-muted-foreground">
                      Inactive scenarios will not be available for other
                      simulations
                    </p>
                  </div>
                  <Switch
                    id="active"
                    checked={basicInfoState.active}
                    onCheckedChange={(checked) =>
                      setBasicInfoState((prev) => ({
                        ...prev,
                        active: checked,
                      }))
                    }
                    disabled={isReadonly}
                  />
                </div>

                {/* Video Enabled Switch */}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="useVideo">Enable Video</Label>
                    <p className="text-xs text-muted-foreground">
                      Enable video support for this scenario
                    </p>
                  </div>
                  <Switch
                    id="useVideo"
                    checked={useVideo}
                    onCheckedChange={(enabled) => {
                      handleInputChange("useVideo", enabled || null);
                      if (!enabled) {
                        setContentState((prev) => ({
                          ...prev,
                          selectedVideo: null,
                          activeVideoId: null,
                        }));
                        handleInputChange("useQuestions", null);
                      }
                    }}
                    disabled={isReadonly}
                  />
                </div>
              </div>
            </StepCard>
          );
        }
        case "persona": {
          // Inline PersonaSection using StepCard + SelectableGrid pattern
          const newDataForRanges =
            scenarioData && !isEditMode && isScenarioNewOut(scenarioData)
              ? scenarioData
              : null;
          const sliderMin =
            newDataForRanges?.persona_range_min ?? personaMinMax.min ?? 1;
          const sliderMax =
            newDataForRanges?.persona_range_max ?? personaMinMax.max ?? 1;

          // Server handles filtering via validPersonaIds (showSelected filter applied server-side)
          // Client only applies search term filtering (for instant feedback while typing)
          // Note: Filtering is handled by StepCard's searchTerm prop, so we use validPersonaIds directly
          // Create persona items for SelectableGrid
          const personaItems = validPersonaIds
            .filter((personaId) => {
              // Client-side search filtering (StepCard also handles this, but we filter here for SelectableGrid)
              if (!personaSearchTerm.trim()) return true;
              const persona = personaMapping[personaId];
              if (!persona) return false;
              const searchLower = personaSearchTerm.toLowerCase();
              const searchText =
                `${persona.name} ${persona.description || ""}`.toLowerCase();
              return searchText.includes(searchLower);
            })
            .map((personaId) => {
              const persona = personaMapping[personaId];
              return {
                id: personaId,
                persona,
              };
            });

          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={isReadonly}
              isEditMode={isEditMode}
              searchTerm={personaSearchTerm}
              onSearchChange={(term: string) =>
                setUrlParams({ personaSearch: term || null })
              }
              searchPlaceholder="Search personas..."
              debounceMs={300}
              filters={[
                {
                  key: "showSelected",
                  label: "Show selected",
                  value: personaShowSelected,
                  onChange: (value: boolean) =>
                    setUrlParams({ personaShowSelected: value || null }),
                },
              ]}
              actions={
                <div className="flex items-center gap-2">
                  <Popover>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <PopoverTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={
                              isReadonly ||
                              isPending ||
                              randomizingSection === "persona" ||
                              randomizingSection === "all"
                            }
                          >
                            {randomizingSection === "persona" ||
                            randomizingSection === "all" ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Shuffle className="h-4 w-4" />
                            )}
                          </Button>
                        </PopoverTrigger>
                      </TooltipTrigger>
                      <TooltipContent>Randomize</TooltipContent>
                    </Tooltip>
                    <PopoverContent className="w-80 p-4" align="end">
                      <div className="space-y-4">
                        <RangeSlider
                          min={sliderMin}
                          max={sliderMax}
                          value={[
                            personaMinMax.min ?? sliderMin,
                            personaMinMax.max ?? sliderMax,
                          ]}
                          onValueChange={([min, max]) => {
                            handleInputChange("personaMin", min ?? sliderMin);
                            handleInputChange("personaMax", max ?? sliderMax);
                          }}
                          disabled={isReadonly}
                          label="Range"
                        />
                        <Button
                          onClick={handleRandomizePersonaClient}
                          disabled={
                            isReadonly ||
                            randomizingSection === "persona" ||
                            randomizingSection === "all"
                          }
                          className="w-full"
                          size="sm"
                        >
                          {randomizingSection === "persona" ||
                          randomizingSection === "all" ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Randomizing...
                            </>
                          ) : (
                            "Randomize"
                          )}
                        </Button>
                      </div>
                    </PopoverContent>
                  </Popover>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={onReset}
                        disabled={isReadonly}
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Reset</TooltipContent>
                  </Tooltip>
                </div>
              }
              resetFields={["personaIds"]}
              {...(onReset ? { onReset } : {})}
            >
              <SelectableGrid<{
                id: string;
                persona: (typeof personaMapping)[string];
              }>
                items={personaItems.filter(
                  (
                    item
                  ): item is {
                    id: string;
                    persona: NonNullable<(typeof personaMapping)[string]>;
                  } => item.persona !== undefined
                )}
                selectedId={null}
                selectedIds={selectedPersonaIds}
                onSelect={(ids) =>
                  handlePersonaSelect(Array.isArray(ids) ? ids : [ids])
                }
                getId={(item) => item.id}
                renderItem={(item, isSelected) => {
                  const persona = item.persona;
                  const IconComponent =
                    getPersonaIconComponent(persona.icon || "") || Brain;
                  const hexColor = persona.color || "#64748b";

                  return (
                    <div
                      className={cn(
                        "relative flex flex-col gap-3 p-4 rounded-xl border bg-card text-card-foreground shadow-sm transition-all text-left",
                        "hover:shadow-md hover:bg-accent/50",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                        isSelected && "ring-2 ring-primary bg-accent"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className="p-2 rounded-lg shadow-lg flex-shrink-0"
                          style={{
                            background: generateGradientFromHex(hexColor),
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
                    </div>
                  );
                }}
                emptyMessage="No personas found. Try adjusting your search."
                disabled={isReadonly}
              />
            </StepCard>
          );
        }
        case "documents": {
          // Inline DocumentSection using StepCard + SelectableGrid pattern
          const newDataForRanges =
            scenarioData && !isEditMode && isScenarioNewOut(scenarioData)
              ? scenarioData
              : null;
          const sliderMin =
            newDataForRanges?.document_range_min ?? documentMinMax.min ?? 0;
          const sliderMax =
            newDataForRanges?.document_range_max ?? documentMinMax.max ?? 1;

          // Create document items for SelectableGrid
          const documentItems = validDocumentIds
            .filter((docId) => {
              // Client-side search filtering
              if (!documentSearchTerm.trim()) return true;
              const doc = documentMapping[docId];
              if (!doc) return false;
              const searchLower = documentSearchTerm.toLowerCase();
              const searchText =
                `${doc.name} ${doc.description || ""}`.toLowerCase();
              return searchText.includes(searchLower);
            })
            .map((docId) => {
              const doc = documentMapping[docId];
              if (!doc) return null;
              const fullDoc =
                scenarioData && "document_details" in scenarioData
                  ? (scenarioData as ScenarioDetailOut).document_details?.find(
                      (d) => d.document_id === docId
                    )
                  : undefined;
              return {
                id: docId,
                doc,
                fullDoc,
              };
            })
            .filter((item): item is NonNullable<typeof item> => item !== null);

          return (
            <>
              <StepCard
                stepStatus={stepStatus}
                stepNumber={stepNumber}
                stepTitle={stepTitle}
                stepDescription={stepDescription}
                isReadonly={isReadonly}
                isEditMode={isEditMode}
                searchTerm={documentSearchTerm}
                onSearchChange={(term: string) =>
                  setUrlParams({ documentSearch: term || null })
                }
                searchPlaceholder="Search documents..."
                debounceMs={300}
                filters={[
                  {
                    key: "showSelected",
                    label: "Show selected",
                    value: documentShowSelected,
                    onChange: (value: boolean) =>
                      setUrlParams({ documentShowSelected: value || null }),
                  },
                  {
                    key: "showTemplate",
                    label: "Show templates",
                    value: documentShowTemplate,
                    onChange: (value: boolean) =>
                      setUrlParams({ documentShowTemplate: value || null }),
                  },
                ]}
                actions={
                  <div className="flex items-center gap-2">
                    <Popover>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <PopoverTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={
                                isReadonly ||
                                isPending ||
                                randomizingSection === "document" ||
                                randomizingSection === "all"
                              }
                            >
                              {randomizingSection === "document" ||
                              randomizingSection === "all" ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Shuffle className="h-4 w-4" />
                              )}
                            </Button>
                          </PopoverTrigger>
                        </TooltipTrigger>
                        <TooltipContent>Randomize</TooltipContent>
                      </Tooltip>
                      <PopoverContent className="w-80 p-4" align="end">
                        <div className="space-y-4">
                          <RangeSlider
                            min={sliderMin}
                            max={sliderMax}
                            value={[
                              documentMinMax.min ?? sliderMin,
                              documentMinMax.max ?? sliderMax,
                            ]}
                            onValueChange={([min, max]) => {
                              handleInputChange(
                                "documentMin",
                                min ?? sliderMin
                              );
                              handleInputChange(
                                "documentMax",
                                max ?? sliderMax
                              );
                            }}
                            disabled={isReadonly}
                            label="Range"
                          />
                          <Button
                            onClick={handleRandomizeDocumentsClient}
                            disabled={
                              isReadonly ||
                              randomizingSection === "document" ||
                              randomizingSection === "all"
                            }
                            className="w-full"
                            size="sm"
                          >
                            {randomizingSection === "document" ||
                            randomizingSection === "all" ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Randomizing...
                              </>
                            ) : (
                              "Randomize"
                            )}
                          </Button>
                        </div>
                      </PopoverContent>
                    </Popover>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={onReset}
                          disabled={isReadonly}
                        >
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Reset</TooltipContent>
                    </Tooltip>
                  </div>
                }
                resetFields={["documentIds", "templateDocumentIds"]}
                {...(onReset ? { onReset } : {})}
              >
                <SelectableGrid<{
                  id: string;
                  doc: DocumentMappingItem;
                  fullDoc?: unknown;
                }>
                  items={documentItems}
                  selectedId={null}
                  selectedIds={currentDocumentIds}
                  onSelect={(ids) =>
                    updateDocumentIds(Array.isArray(ids) ? ids : [ids])
                  }
                  getId={(item) => item.id}
                  renderItem={(item, isSelected) => {
                    const fullDocTyped = item.fullDoc as
                      | {
                          document_id: string | null;
                          name: string | null;
                          updated_at: string | null;
                          extension: string | null;
                          scenario_ids: string[] | null;
                          can_edit: boolean | null;
                          can_delete: boolean | null;
                          active: boolean | null;
                          department_ids: string[] | null;
                          upload_id: string | null;
                          field_ids: string[];
                        }
                      | undefined;
                    const docForViewer: DocumentItem = fullDocTyped
                      ? {
                          document_id: fullDocTyped.document_id || "",
                          name: fullDocTyped.name || "",
                          updated_at:
                            fullDocTyped.updated_at || new Date().toISOString(),
                          extension: fullDocTyped.extension || "",
                          scenario_ids: fullDocTyped.scenario_ids || [],
                          can_edit: fullDocTyped.can_edit ?? false,
                          can_delete: fullDocTyped.can_delete ?? false,
                          active: fullDocTyped.active ?? true,
                          department_ids: fullDocTyped.department_ids || [],
                          upload_id: fullDocTyped.upload_id ?? null,
                          field_ids: fullDocTyped.field_ids || [],
                          valid_field_ids: null,
                          active_scenario_count: null,
                          total_scenario_links: null,
                        }
                      : {
                          document_id: item.id,
                          name: item.doc.name || "Document",
                          valid_field_ids: null,
                          active_scenario_count: null,
                          total_scenario_links: null,
                          updated_at: new Date().toISOString(),
                          extension: "",
                          scenario_ids: [],
                          can_edit: false,
                          can_delete: false,
                          active: true,
                          department_ids: [],
                          upload_id: null,
                          field_ids: [],
                        };

                    return (
                      <div
                        className={cn(
                          "relative aspect-square rounded-xl border bg-card text-card-foreground shadow-sm transition-all overflow-hidden",
                          "hover:shadow-md",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                          isSelected && "ring-2 ring-primary"
                        )}
                      >
                        {/* Preview button */}
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            const docId = item.id;
                            setLocalPreviewDocId(docId);
                            setPreviewDocumentId(docId);
                          }}
                          className="absolute top-2 left-2 z-10 h-6 w-6 bg-primary rounded-full flex items-center justify-center hover:bg-primary/90 transition-colors cursor-pointer"
                        >
                          <Eye className="h-3.5 w-3.5 text-primary-foreground" />
                        </div>

                        {/* Check icon */}
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

                        {/* Document name */}
                        <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-xs px-2 py-1">
                          <span className="truncate block">
                            {item.doc.name}
                          </span>
                        </div>
                      </div>
                    );
                  }}
                  emptyMessage="No documents found. Try adjusting your search."
                  disabled={isReadonly}
                />
              </StepCard>

              {/* Preview Dialog */}
              <Dialog
                open={localPreviewDocId !== null}
                onOpenChange={(open) => {
                  if (!open) {
                    setLocalPreviewDocId(null);
                    setPreviewDocumentId(null);
                  }
                }}
              >
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
                  <DialogHeader>
                    <DialogTitle>
                      {localPreviewDocId
                        ? documentMapping[localPreviewDocId]?.name
                        : "Document Preview"}
                    </DialogTitle>
                    <DialogDescription>
                      Preview document content
                    </DialogDescription>
                  </DialogHeader>
                  {localPreviewDocId &&
                    (() => {
                      const fullDoc =
                        scenarioData && "document_details" in scenarioData
                          ? (
                              scenarioData as ScenarioDetailOut
                            ).document_details?.find(
                              (d) => d.document_id === localPreviewDocId
                            )
                          : undefined;
                      const fullDocTyped = fullDoc as
                        | {
                            document_id: string | null;
                            name: string | null;
                            updated_at: string | null;
                            extension: string | null;
                            scenario_ids: string[] | null;
                            can_edit: boolean | null;
                            can_delete: boolean | null;
                            active: boolean | null;
                            department_ids: string[] | null;
                            upload_id: string | null;
                            field_ids: string[];
                          }
                        | undefined;
                      const docForViewer: DocumentItem = fullDocTyped
                        ? {
                            document_id: fullDocTyped.document_id || "",
                            name: fullDocTyped.name || "",
                            updated_at:
                              fullDocTyped.updated_at ||
                              new Date().toISOString(),
                            extension: fullDocTyped.extension || "",
                            scenario_ids: fullDocTyped.scenario_ids || [],
                            can_edit: fullDocTyped.can_edit ?? false,
                            can_delete: fullDocTyped.can_delete ?? false,
                            active: fullDocTyped.active ?? true,
                            department_ids: fullDocTyped.department_ids || [],
                            upload_id: fullDocTyped.upload_id ?? null,
                            field_ids: fullDocTyped.field_ids || [],
                            valid_field_ids: null,
                            active_scenario_count: null,
                            total_scenario_links: null,
                          }
                        : {
                            document_id: localPreviewDocId,
                            valid_field_ids: null,
                            active_scenario_count: null,
                            total_scenario_links: null,
                            name:
                              documentMapping[localPreviewDocId]?.name ||
                              "Document",
                            updated_at: new Date().toISOString(),
                            extension: "",
                            scenario_ids: [],
                            can_edit: false,
                            can_delete: false,
                            active: true,
                            department_ids: [],
                            upload_id: null,
                            field_ids: [],
                          };
                      return (
                        <DocumentViewer
                          document={docForViewer}
                          bare={false}
                          isFormDocument={false}
                        />
                      );
                    })()}
                </DialogContent>
              </Dialog>
            </>
          );
        }
        case "parameters": {
          // Inline ParameterSection using StepCard + GenericPicker pattern
          const newDataForRanges =
            scenarioData && !isEditMode && isScenarioNewOut(scenarioData)
              ? scenarioData
              : null;
          const sliderMin =
            newDataForRanges?.parameter_range_min ??
            parameterSelectionMinMax.min ??
            0;
          const sliderMax =
            newDataForRanges?.parameter_range_max ??
            parameterSelectionMinMax.max ??
            3;

          const validParamIds =
            scenarioData && "valid_parameter_ids" in scenarioData
              ? (scenarioData as ScenarioNewOut).valid_parameter_ids || []
              : [];
          if (validParamIds.length === 0) {
            return null;
          }

          // GenericPicker handles filtering internally
          // No need to pre-filter here

          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={isReadonly}
              isEditMode={isEditMode}
              searchTerm={parameterSearchTerm}
              onSearchChange={(term: string) =>
                setUrlParams({ parameterSearch: term || null })
              }
              searchPlaceholder="Search parameters..."
              debounceMs={300}
              filters={[
                {
                  key: "showSelected",
                  label: "Show selected",
                  value: parameterShowSelected,
                  onChange: (value: boolean) =>
                    setUrlParams({ parameterShowSelected: value || null }),
                },
              ]}
              actions={
                <div className="flex items-center gap-2">
                  <Popover>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <PopoverTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={
                              isReadonly ||
                              isPending ||
                              randomizingSection === "parameters" ||
                              randomizingSection === "all"
                            }
                          >
                            {randomizingSection === "parameters" ||
                            randomizingSection === "all" ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Shuffle className="h-4 w-4" />
                            )}
                          </Button>
                        </PopoverTrigger>
                      </TooltipTrigger>
                      <TooltipContent>Randomize</TooltipContent>
                    </Tooltip>
                    <PopoverContent className="w-80 p-4" align="end">
                      <div className="space-y-4">
                        <RangeSlider
                          min={sliderMin}
                          max={sliderMax}
                          value={[
                            parameterSelectionMinMax.min ?? sliderMin,
                            parameterSelectionMinMax.max ?? sliderMax,
                          ]}
                          onValueChange={([min, max]) => {
                            handleInputChange(
                              "parameterSelectionMin",
                              min ?? sliderMin
                            );
                            handleInputChange(
                              "parameterSelectionMax",
                              max ?? sliderMax
                            );
                          }}
                          disabled={isReadonly}
                          label="Range"
                        />
                        <Button
                          onClick={handleRandomizeParametersClient}
                          disabled={
                            isReadonly ||
                            randomizingSection === "parameters" ||
                            randomizingSection === "all"
                          }
                          className="w-full"
                          size="sm"
                        >
                          {randomizingSection === "parameters" ||
                          randomizingSection === "all" ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Randomizing...
                            </>
                          ) : (
                            "Randomize"
                          )}
                        </Button>
                      </div>
                    </PopoverContent>
                  </Popover>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={onReset}
                        disabled={isReadonly}
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Reset</TooltipContent>
                  </Tooltip>
                </div>
              }
              resetFields={["parameterIds"]}
              {...(onReset ? { onReset } : {})}
            >
              <GenericPicker
                items={parameterMapping}
                itemIds={validParamIds}
                selectedIds={draftState.parameterIds || []}
                onSelect={(ids) => {
                  handleInputChange("parameterIds", ids);
                  // When unselecting a parameter, also remove all its parameter items (fields)
                  const unselectedParams = (
                    draftState.parameterIds || []
                  ).filter((id) => !ids.includes(id));
                  if (unselectedParams.length > 0) {
                    unselectedParams.forEach((paramId) => {
                      updateFieldIds((prev) =>
                        prev.filter(
                          (itemId) =>
                            fieldMapping[itemId]?.parameter_id !== paramId
                        )
                      );
                    });
                  }
                }}
                getId={(item) => (item as unknown as { id: string }).id}
                getLabel={(item) => item.name || ""}
                getSearchText={(item) =>
                  `${item.name} ${item.description || ""}`
                }
                placeholder="Select parameters"
                disabled={isReadonly}
                multiSelect={true}
                hideSelectedChips={true}
                buttonClassName="w-full"
              />
            </StepCard>
          );
        }
        case "content": {
          // Content section wrapper - uses ContentSection component wrapped in StepCard pattern
          // Note: Full inline migration would be 2700+ lines, so using component wrapper for now
          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={isReadonly}
              isEditMode={isEditMode}
              resetFields={[
                "problemStatement",
                "objectives",
                "useImage",
                "useVideo",
                "useObjectives",
                "useQuestions",
                "useProblemStatement",
              ]}
              {...(onReset ? { onReset } : {})}
            >
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
                  handleInputChange("useObjectives", enabled || null);
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
                  handleInputChange(
                    "problemStatement",
                    originalProblemStatement || null
                  )
                }
                onUseProblemStatementChange={(enabled) => {
                  handleInputChange("useProblemStatement", enabled || null);
                  if (!enabled) {
                    handleInputChange("problemStatement", null);
                  }
                }}
                onUseImageChange={(enabled) => {
                  handleInputChange("useImage", enabled || null);
                }}
                onImageUpload={handleImageUpload}
                useVideo={useVideo}
                initialSelectedVideo={contentState.selectedVideo}
                videoMapping={videoMapping}
                initialActiveVideoId={contentState.activeVideoId}
                onUseVideoChange={(enabled) => {
                  handleInputChange("useVideo", enabled || null);
                  if (!enabled) {
                    handleInputChange("useQuestions", null);
                  }
                }}
                selectedVideoLength={selectedVideoLength}
                onVideoLengthChange={updateVideoLength}
                useQuestions={useQuestions}
                initialQuestions={contentState.questions}
                initialCurrentQuestionIds={contentState.currentQuestionIds}
                onUseQuestionsChange={(enabled) => {
                  handleInputChange("useQuestions", enabled || null);
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
                stepStatus={stepStatus}
                stepTitle={stepTitle}
                stepDescription={stepDescription}
                stepNumber={stepNumber}
                isReadonly={isReadonly}
                isGeneratingScenario={isGeneratingScenario}
                isSubmitting={isSubmitting}
                imageInputRef={
                  imageInputRef as React.RefObject<HTMLInputElement>
                }
                isEditMode={isEditMode}
              />
            </StepCard>
          );
        }
        default:
          // Handle dynamic parameter steps (parameter-{paramId})
          if (stepId.startsWith("parameter-")) {
            // Inline ParameterItemSection for dynamic parameter steps
            const paramId = stepId.replace("parameter-", "");
            const param = generalParameterMapping[paramId];
            if (!param) return null;

            const validItemsForParam = validGeneralParameterItemIds.filter(
              (itemId: string) => fieldMapping[itemId]?.parameter_id === paramId
            );
            const selectedItemsForParam = currentFieldIds.filter(
              (itemId) => fieldMapping[itemId]?.parameter_id === paramId
            );
            const fullParam = parameterMapping[paramId] || param;
            // field_ranges only exists on ScenarioDetailOut, not ScenarioDetailNew
            // For new scenarios, use defaults
            const fieldRange =
              isEditMode && scenarioData && isScenarioDetailOut(scenarioData)
                ? scenarioData.field_ranges?.find(
                    (range) => range.parameter_id === paramId
                  )
                : undefined;
            const sliderMin = fieldRange?.min_count ?? 1;
            const sliderMax = fieldRange?.max_count ?? 3;

            return (
              <StepCard
                stepStatus={stepStatus}
                stepNumber={stepNumber}
                stepTitle={fullParam.name}
                stepDescription={fullParam.description || ""}
                isReadonly={isReadonly}
                isEditMode={isEditMode}
                resetFields={[`fieldIds-${paramId}`]}
                {...(onReset ? { onReset } : {})}
                actions={
                  <div className="flex items-center gap-2">
                    <Popover>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <PopoverTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={
                                isReadonly ||
                                isPending ||
                                randomizingSection === `parameter_${paramId}` ||
                                randomizingSection === "all"
                              }
                            >
                              {randomizingSection === `parameter_${paramId}` ||
                              randomizingSection === "all" ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Shuffle className="h-4 w-4" />
                              )}
                            </Button>
                          </PopoverTrigger>
                        </TooltipTrigger>
                        <TooltipContent>Randomize</TooltipContent>
                      </Tooltip>
                      <PopoverContent className="w-80 p-4" align="end">
                        <div className="space-y-4">
                          <RangeSlider
                            min={sliderMin}
                            max={sliderMax}
                            value={[
                              fieldMinMax[paramId]?.min ?? sliderMin,
                              fieldMinMax[paramId]?.max ?? sliderMax,
                            ]}
                            onValueChange={([min, max]) =>
                              updateFieldRanges((prev) => ({
                                ...prev,
                                [paramId]: {
                                  min: min ?? sliderMin,
                                  max: max ?? sliderMax,
                                },
                              }))
                            }
                            disabled={isReadonly}
                            label="Range"
                          />
                          <Button
                            onClick={() =>
                              handleRandomizeParameterClient(paramId)
                            }
                            disabled={
                              isReadonly ||
                              randomizingSection === `parameter_${paramId}` ||
                              randomizingSection === "all"
                            }
                            className="w-full"
                            size="sm"
                          >
                            {randomizingSection === `parameter_${paramId}` ||
                            randomizingSection === "all" ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Randomizing...
                              </>
                            ) : (
                              "Randomize"
                            )}
                          </Button>
                        </div>
                      </PopoverContent>
                    </Popover>
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
                }
              >
                <ParameterSelector
                  parameterMapping={{
                    [paramId]: fullParam,
                  }}
                  fieldMapping={fieldMapping}
                  validParameterItemIds={validItemsForParam}
                  selectedParameterItemIds={selectedItemsForParam}
                  onParameterItemIdsChange={(newIds) => {
                    // Update only this parameter's items
                    const otherFieldIds = currentFieldIds.filter(
                      (itemId) => fieldMapping[itemId]?.parameter_id !== paramId
                    );
                    updateFieldIds([...otherFieldIds, ...newIds]);
                  }}
                  disabled={isReadonly}
                />
              </StepCard>
            );
          }
          return null;
      }
    },
    [
      name,
      draftState.departmentIds,
      draftState.parameterIds,
      scenarioData,
      localPreviewDocId,
      departmentMapping,
      agentMapping,
      basicInfoState,
      setBasicInfoState,
      handleRandomizeAll,
      handleRandomizePersonaClient,
      handlePersonaSelect,
      handleRandomizeDocumentsClient,
      handleRandomizeParametersClient,
      handleRandomizeParameterClient,
      handleResetParameter,
      updateDocumentIds,
      updateFieldIds,
      updateFieldRanges,
      setPreviewDocumentId,
      isReadonly,
      isEditMode,
      isPending,
      randomizingSection,
      personaSearchTerm,
      personaShowSelected,
      personaMinMax,
      validPersonaIds,
      personaMapping,
      selectedPersonaIds,
      documentSearchTerm,
      documentShowSelected,
      documentShowTemplate,
      documentMinMax,
      validDocumentIds,
      documentMapping,
      currentDocumentIds,
      parameterSearchTerm,
      parameterShowSelected,
      parameterSelectionMinMax,
      parameterMapping,
      fieldMapping,
      generalParameterMapping,
      validGeneralParameterItemIds,
      currentFieldIds,
      fieldMinMax,
      setUrlParams,
      handleInputChange,
      handleGenerateScenario,
      handleResetContent,
      handleProblemStatementVersionSelect,
      handleImageUpload,
      handleDocumentRemove,
      problemStatement,
      problemStatementMapping,
      currentProblemStatementIds,
      selectedProblemStatementId,
      hasProblemStatementChanges,
      originalProblemStatement,
      useProblemStatement,
      useObjectives,
      useImage,
      useVideo,
      useQuestions,
      objectivesHistory,
      imageMapping,
      videoMapping,
      allPreviewDocumentIds,
      filteredTemplateDocumentIds,
      selectedVideoLength,
      updateVideoLength,
      contentState,
      isUploadingImage,
      isGeneratingScenario,
      isSubmitting,
      imageInputRef,
      setShowRegenerationDialog,
    ]
  );

  // Content sections for dynamic parameter steps (defined after renderStep)
  const contentSections = useMemo(() => {
    return Object.entries(generalParameterMapping).map(
      ([paramId, param], index) => {
        const stepIndex = 4 + index; // After basic (0), persona (1), documents (2), parameters (3)
        return {
          id: `parameter-${paramId}`,
          render: ({
            formData,
            setFormData,
          }: {
            formData: Record<string, unknown>;
            setFormData: (updates: Partial<Record<string, unknown>>) => void;
          }) => {
            return renderStep({
              stepId: `parameter-${paramId}`,
              stepStatus: getStepStatus(`parameter-${paramId}`, formData),
              stepTitle: param.name,
              stepDescription: param.description || "",
              stepNumber: stepIndex + 1,
              isOptional: false,
              formData,
              setFormData,
            });
          },
          insertAfter: "parameters",
        };
      }
    );
  }, [generalParameterMapping, getStepStatus, renderStep]);

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
                {isEditMode &&
                scenarioData &&
                "department_ids" in scenarioData &&
                (scenarioData as ScenarioDetailOut).department_ids?.length === 0
                  ? "Default scenario cannot be edited"
                  : "Scenario is in use by active simulations"}
              </h3>
              <div className="mt-2 text-sm text-muted-foreground">
                {isEditMode &&
                scenarioData &&
                "department_ids" in scenarioData &&
                (scenarioData as ScenarioDetailOut).department_ids?.length ===
                  0 ? (
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

      <GenericForm
        nuqsParsers={
          scenarioSearchParamsClient as Record<string, Parser<unknown>>
        }
        steps={steps}
        getStepStatus={getStepStatus}
        formData={
          formData as unknown as Values<Record<string, Parser<unknown>>>
        }
        setFormData={
          setFormData as unknown as (
            updates:
              | Partial<Values<Record<string, Parser<unknown>>>>
              | ((
                  prev: Values<Record<string, Parser<unknown>>>
                ) => Partial<Values<Record<string, Parser<unknown>>>>)
          ) => void
        }
        serverData={scenarioData}
        initializeForm={initializeForm}
        formFieldKeys={[
          "name",
          "problemStatement",
          "objectives",
          "departmentIds",
          "personaIds",
          "documentIds",
          "templateDocumentIds",
          "parameterIds",
          "fieldIds",
          "imageIds",
          "objectiveIds",
          "problemStatementIds",
          "useImage",
          "useVideo",
          "useObjectives",
          "useQuestions",
          "useProblemStatement",
          "videoLength",
          "active",
          "scenarioDomainId",
          "imageDomainId",
          "videoDomainId",
        ]}
        onSubmit={async () => {
          if (isEditMode) {
            await handleUpdateClick();
          } else {
            await handleSubmit();
          }
        }}
        submitButton={{
          backUrl: "/create/scenarios",
          backLabel: "Back",
          createLabel: "Save Scenario",
          updateLabel: "Update Scenario",
        }}
        isReadonly={isReadonly}
        isEditMode={isEditMode}
        renderStep={renderStep}
        contentSections={contentSections}
      />

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
                {affectedSimulations.map(
                  (sim: { id: string; name: string }) => (
                    <li key={sim.id} className="text-sm">
                      {sim.name}
                    </li>
                  )
                )}
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
