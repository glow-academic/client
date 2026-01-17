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
  Loader2,
  RotateCcw,
  Shuffle,
  Sparkles,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  parseAsBoolean,
  parseAsString,
  useQueryStates,
  type Parser,
  type Values,
} from "nuqs";
import React, {
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
import { ConfigSection } from "@/components/scenarios/ConfigSection";
// TODO: Re-integrate preview sections in future
// import { PreviewStep } from "@/components/scenarios/PreviewStep";
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
import type { GenerateRegenerateModalResource } from "@/components/common/GenerateRegenerateModal";
import { GenerateRegenerateModal } from "@/components/common/GenerateRegenerateModal";
import { ReadOnlyBanner } from "@/components/common/ReadOnlyBanner";
import { Descriptions } from "@/components/resources/Descriptions";
import { Flags } from "@/components/resources/Flags";
import { Names } from "@/components/resources/Names";
import { Objectives } from "@/components/resources/Objectives";
import { ProblemStatements } from "@/components/resources/ProblemStatements";
import { useGenerationContext } from "@/contexts/generation-context";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { ResourceType } from "@/lib/resources/types";
import { buildSearchParams } from "./scenario-helpers";
import type { DraftState, ScenarioFormState } from "./scenario-types";
import { isScenarioDetailOut, isScenarioNewOut } from "./scenario-types";

// Resource creation types
type CreateDraftNamesIn = InputOf<"/api/v4/resources/names", "post">;
type CreateDraftNamesOut = OutputOf<"/api/v4/resources/names", "post">;

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
  GetScenarioOut,
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
  // Unified endpoint: both use GetScenarioOut (scenario_id null for new, provided for detail)
  scenarioDetail?: GetScenarioOut;
  scenarioDetailDefault?: GetScenarioOut;
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
  // Resource creation actions
  createNamesAction?: (
    input: InputOf<"/api/v4/resources/names", "post">
  ) => Promise<OutputOf<"/api/v4/resources/names", "post">>;
  createDescriptionsAction?: (
    input: InputOf<"/api/v4/resources/descriptions", "post">
  ) => Promise<OutputOf<"/api/v4/resources/descriptions", "post">>;
  createProblemStatementsAction?: (
    input: InputOf<"/api/v4/resources/problem_statements", "post">
  ) => Promise<OutputOf<"/api/v4/resources/problem_statements", "post">>;
  createObjectivesAction?: (
    input: InputOf<"/api/v4/resources/objectives", "post">
  ) => Promise<OutputOf<"/api/v4/resources/objectives", "post">>;
  createScenarioFlagsAction?: (
    input: InputOf<"/api/v4/resources/scenario_flags", "post">
  ) => Promise<OutputOf<"/api/v4/resources/scenario_flags", "post">>;
}

// StepStatus type imported from GenericForm

function ScenarioComponent({
  mode = "create",
  scenarioId,
  scenarioDetail: serverScenarioDetail,
  scenarioDetailDefault: serverScenarioDetailDefault,
  createScenarioAction,
  updateScenarioAction,
  patchScenarioDraftAction,
  createNamesAction,
  createDescriptionsAction,
  createProblemStatementsAction,
  createObjectivesAction,
  createScenarioFlagsAction,
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
  const { setGenerationCapability, clearGenerationCapability } =
    useGenerationContext();
  const isEditMode = mode === "edit" && !!scenarioId;
  const isSuperadmin = effectiveProfile?.role === "superadmin";

  // Generation state for AI workflows
  const [generatingResources, setGeneratingResources] = useState<
    Set<ResourceType>
  >(new Set());

  // Modal state for generate/regenerate
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [modalMode, setModalMode] = useState<"generate" | "regenerate" | null>(
    null
  );
  const [modalResources, setModalResources] = useState<
    GenerateRegenerateModalResource[]
  >([]);
  const [modalInstructions, setModalInstructions] = useState("");

  const isGenerating = useCallback(
    (resourceType: ResourceType) => generatingResources.has(resourceType),
    [generatingResources]
  );

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
    // Legacy range params removed - use resource-based approach instead
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
    if (!data || typeof data !== "object") {
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
        // Legacy fields removed - use resource-based approach instead
        scenarioDomainId: null,
        imageDomainId: null,
        videoDomainId: null,
      };
    }

    // Type assert data as GetScenarioOut after null check
    const typedData = data as GetScenarioOut;

    // If draftId exists, server should have merged draft payload into data
    // Otherwise, use server defaults
    // Type narrowing: check isEditMode to determine which type we have
    const isDetail = isEditMode && isScenarioDetailOut(typedData);
    const detailData = isDetail ? typedData : null;
    const newData = !isDetail && isScenarioNewOut(typedData) ? typedData : null;

    // Safely access properties with type guards
    const departmentIds = Array.isArray(typedData.department_ids)
      ? typedData.department_ids.map((id) => String(id))
      : [];

    return {
      name:
        (isDetail && detailData && "name" in detailData && detailData.name) ||
        "",
      problemStatement:
        (detailData &&
          "problem_statement" in detailData &&
          detailData.problem_statement) ||
        "",
      objectives: [], // Will be populated from objective_ids if needed
      departmentIds,
      personaIds:
        detailData &&
        "persona_ids" in detailData &&
        Array.isArray(detailData.persona_ids)
          ? detailData.persona_ids
          : [],
      documentIds:
        detailData &&
        "document_ids" in detailData &&
        Array.isArray(detailData.document_ids)
          ? detailData.document_ids
          : [],
      templateDocumentIds:
        newData &&
        "selected_template_document_ids" in newData &&
        Array.isArray(newData.selected_template_document_ids)
          ? newData.selected_template_document_ids
          : [],
      parameterIds:
        detailData &&
        "parameter_ids" in detailData &&
        Array.isArray(detailData.parameter_ids)
          ? detailData.parameter_ids
          : [],
      fieldIds: [], // Will be populated from scenario fields if needed
      imageIds:
        newData &&
        "scenario_images" in newData &&
        Array.isArray(newData.scenario_images)
          ? newData.scenario_images.map((img: { upload_id?: string | null }) =>
              String(img.upload_id || "")
            )
          : [],
      objectiveIds:
        detailData &&
        "objective_ids" in detailData &&
        Array.isArray(detailData.objective_ids)
          ? detailData.objective_ids
          : [],
      problemStatementIds:
        detailData &&
        "problem_statement_id" in detailData &&
        detailData.problem_statement_id
          ? [String(detailData.problem_statement_id)]
          : [],
      useImage:
        detailData && "image_input_enabled" in detailData
          ? (detailData.image_input_enabled ?? false)
          : false,
      useVideo:
        newData && "video_enabled" in newData
          ? (newData.video_enabled ?? false)
          : false,
      useObjectives:
        detailData && "objectives_enabled" in detailData
          ? (detailData.objectives_enabled ?? true)
          : true,
      useQuestions:
        newData && "questions_enabled" in newData
          ? (newData.questions_enabled ?? false)
          : false,
      useProblemStatement: false, // Not directly available in data
      videoLength: null, // Will be set from selected video
      active:
        detailData && "active" in detailData
          ? (detailData.active ?? true)
          : true,
      randomize: null,
      randomizePersonas: null,
      randomizeDocuments: null,
      randomizeParameters: null,
      // Legacy fields removed - use resource-based approach instead
      scenarioDomainId:
        "scenario_domain_id" in typedData && typedData.scenario_domain_id
          ? typedData.scenario_domain_id
          : null,
      imageDomainId:
        "image_domain_id" in typedData && typedData.image_domain_id
          ? typedData.image_domain_id
          : null,
      videoDomainId:
        detailData &&
        typeof detailData === "object" &&
        "video_domain_id" in detailData
          ? (detailData as { video_domain_id?: string }).video_domain_id || null
          : null,
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

  // Resource-based form state (stores only resource IDs)
  // Use ref to store scenarioData to prevent callback recreation on every render
  const scenarioDataRef = React.useRef(scenarioData);
  React.useEffect(() => {
    scenarioDataRef.current = scenarioData;
  }, [scenarioData]);

  // Helper to get initial form state from scenarioData
  const getInitialFormState = useCallback((): ScenarioFormState => {
    const data = scenarioDataRef.current;
    if (!data) {
      return {
        name_id: null,
        description_id: null,
        problem_statement_id: null,
        active_flag_id: null,
        objectives_enabled_flag_id: null,
        images_enabled_flag_id: null,
        video_enabled_flag_id: null,
        questions_enabled_flag_id: null,
        problem_statement_enabled_flag_id: null,
        department_ids: [],
        persona_ids: [],
        document_ids: [],
        template_document_ids: [],
        parameter_ids: [],
        field_ids: [],
        image_ids: [],
        objective_ids: [],
        video_length: null,
        scenario_domain_id: null,
        image_domain_id: null,
        video_domain_id: null,
      };
    }
    // Extract resource IDs from server data
    return {
      name_id: data.name_id ? String(data.name_id) : null,
      description_id: data.description_id ? String(data.description_id) : null,
      problem_statement_id: data.problem_statement_id
        ? String(data.problem_statement_id)
        : null,
      active_flag_id: data.active_flag_id ? String(data.active_flag_id) : null,
      objectives_enabled_flag_id: data.objectives_enabled_flag_id
        ? String(data.objectives_enabled_flag_id)
        : null,
      images_enabled_flag_id: data.images_enabled_flag_id
        ? String(data.images_enabled_flag_id)
        : null,
      video_enabled_flag_id: data.video_enabled_flag_id
        ? String(data.video_enabled_flag_id)
        : null,
      questions_enabled_flag_id: data.questions_enabled_flag_id
        ? String(data.questions_enabled_flag_id)
        : null,
      problem_statement_enabled_flag_id: data.problem_statement_enabled_flag_id
        ? String(data.problem_statement_enabled_flag_id)
        : null,
      department_ids: (data.department_ids || []).map(String),
      persona_ids: (data.persona_ids || []).map(String),
      document_ids: (data.document_ids || []).map(String),
      template_document_ids: (data.template_ids || []).map(String),
      parameter_ids: (data.parameter_ids || []).map(String),
      field_ids: (data.field_ids || []).map(String),
      image_ids: (data.image_ids || []).map(String),
      objective_ids: (data.objective_ids || []).map(String),
      video_length: null, // TODO: Extract from video data
      scenario_domain_id: null, // TODO: Extract from scenario data
      image_domain_id: null, // TODO: Extract from scenario data
      video_domain_id: null, // TODO: Extract from scenario data
    };
  }, []);

  const [formState, setFormState] =
    useState<ScenarioFormState>(getInitialFormState);
  // Use ref to access formState in renderStep without depending on it
  const formStateRef = React.useRef(formState);
  React.useEffect(() => {
    formStateRef.current = formState;
  }, [formState]);

  // Update form state when server data changes
  useEffect(() => {
    const newState = getInitialFormState();
    setFormState((prev) => {
      // Only update if resource IDs actually changed
      if (
        prev.name_id !== newState.name_id ||
        prev.description_id !== newState.description_id ||
        prev.problem_statement_id !== newState.problem_statement_id ||
        prev.active_flag_id !== newState.active_flag_id ||
        prev.objectives_enabled_flag_id !==
          newState.objectives_enabled_flag_id ||
        prev.images_enabled_flag_id !== newState.images_enabled_flag_id ||
        prev.video_enabled_flag_id !== newState.video_enabled_flag_id ||
        prev.questions_enabled_flag_id !== newState.questions_enabled_flag_id ||
        prev.problem_statement_enabled_flag_id !==
          newState.problem_statement_enabled_flag_id ||
        JSON.stringify(prev.department_ids) !==
          JSON.stringify(newState.department_ids) ||
        JSON.stringify(prev.persona_ids) !==
          JSON.stringify(newState.persona_ids) ||
        JSON.stringify(prev.document_ids) !==
          JSON.stringify(newState.document_ids) ||
        JSON.stringify(prev.template_document_ids) !==
          JSON.stringify(newState.template_document_ids) ||
        JSON.stringify(prev.parameter_ids) !==
          JSON.stringify(newState.parameter_ids) ||
        JSON.stringify(prev.field_ids) !== JSON.stringify(newState.field_ids) ||
        JSON.stringify(prev.image_ids) !== JSON.stringify(newState.image_ids) ||
        JSON.stringify(prev.objective_ids) !==
          JSON.stringify(newState.objective_ids)
      ) {
        return newState;
      }
      return prev;
    });
  }, [
    scenarioData?.name_id,
    scenarioData?.description_id,
    scenarioData?.problem_statement_id,
    scenarioData?.active_flag_id,
    scenarioData?.objectives_enabled_flag_id,
    scenarioData?.images_enabled_flag_id,
    scenarioData?.video_enabled_flag_id,
    scenarioData?.questions_enabled_flag_id,
    scenarioData?.problem_statement_enabled_flag_id,
    JSON.stringify(scenarioData?.department_ids),
    JSON.stringify(scenarioData?.persona_ids),
    JSON.stringify(scenarioData?.document_ids),
    JSON.stringify(scenarioData?.template_ids),
    JSON.stringify(scenarioData?.parameter_ids),
    JSON.stringify(scenarioData?.field_ids),
    JSON.stringify(scenarioData?.image_ids),
    JSON.stringify(scenarioData?.objective_ids),
  ]);

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
            // Legacy fields removed - use resource-based approach instead
            randomizePersonas: "randomize_personas",
            randomizeDocuments: "randomize_documents",
            randomizeParameters: "randomize_parameters",
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

  // WebSocket handlers for AI generation - unified handler for all resource types
  useEffect(() => {
    if (!socket || !isConnected) return;

    // Use group_id from scenarioData
    const currentGroupId = scenarioData?.group_id;

    const handleGenerationComplete = (data: {
      artifact_type?: string;
      group_id?: string;
      resource_type?: string;
      name_id?: string | null;
      description_id?: string | null;
      problem_statement_id?: string | null;
      objective_ids?: string[];
      active_flag_id?: string | null;
      objectives_enabled_flag_id?: string | null;
      hints_enabled_flag_id?: string | null;
      message?: string;
      success?: boolean;
      [key: string]: unknown;
    }) => {
      // Filter by artifact_type and group_id
      if (
        data.artifact_type !== "scenario" ||
        !data.group_id ||
        data.group_id !== currentGroupId
      ) {
        return; // Not for this scenario or wrong group_id
      }

      const validResourceTypes: ResourceType[] = [
        "names",
        "descriptions",
        "problem_statements",
        "objectives",
        "ranges",
        "scenario_flags",
      ];
      if (
        data.resource_type &&
        validResourceTypes.includes(data.resource_type as ResourceType)
      ) {
        // Update formState with the resource ID that was generated
        setFormState((prev) => {
          const updates: Partial<ScenarioFormState> = {};

          if (data.name_id) updates.name_id = String(data.name_id);
          if (data.description_id)
            updates.description_id = String(data.description_id);
          if (data.problem_statement_id)
            updates.problem_statement_id = String(data.problem_statement_id);
          if (data.objective_ids && data.objective_ids.length > 0) {
            // For arrays, append new IDs (avoid duplicates)
            const newObjectiveIds = data.objective_ids
              .map(String)
              .filter((id) => !prev.objective_ids.includes(id));
            updates.objective_ids = [...prev.objective_ids, ...newObjectiveIds];
          }
          if (data.active_flag_id)
            updates.active_flag_id = String(data.active_flag_id);
          if (data.objectives_enabled_flag_id)
            updates.objectives_enabled_flag_id = String(
              data.objectives_enabled_flag_id
            );
          if (data.hints_enabled_flag_id)
            updates.objectives_enabled_flag_id = String(
              data.hints_enabled_flag_id
            );

          return { ...prev, ...updates };
        });

        setGeneratingResources((prev) => {
          const next = new Set(prev);
          next.delete(data.resource_type as ResourceType);
          return next;
        });
        if (data.success) {
          toast.success(
            data.message || `${data.resource_type} generated successfully`
          );
        } else {
          toast.error(
            data.message || `Failed to generate ${data.resource_type}`
          );
        }
      }
    };

    const handleGenerationProgress = (data: {
      artifact_type?: string;
      group_id?: string;
      resource_type?: string;
      [key: string]: unknown;
    }) => {
      // Filter by artifact_type and group_id
      if (
        data.artifact_type !== "scenario" ||
        !data.group_id ||
        data.group_id !== currentGroupId
      ) {
        return; // Not for this scenario or wrong group_id
      }
      // Handle progress updates if needed
    };

    const handleGenerationError = (data: {
      artifact_type?: string;
      group_id?: string;
      message?: string;
      resource_type?: string;
      resource_types?: string[];
    }) => {
      // Filter by artifact_type and group_id
      if (
        data.artifact_type !== "scenario" ||
        !data.group_id ||
        data.group_id !== currentGroupId
      ) {
        return; // Not for this scenario or wrong group_id
      }

      const validResourceTypes: ResourceType[] = [
        "names",
        "descriptions",
        "problem_statements",
        "objectives",
        "ranges",
        "scenario_flags",
      ];
      const resourceTypes =
        data.resource_types || (data.resource_type ? [data.resource_type] : []);
      setGeneratingResources((prev) => {
        const next = new Set(prev);
        resourceTypes.forEach((rt) => {
          if (validResourceTypes.includes(rt as ResourceType)) {
            next.delete(rt as ResourceType);
          }
        });
        return next;
      });
      toast.error(data.message || "Generation failed");
    };

    // Listen to scenario-specific events filtered by artifact_type and group_id
    socket.on("scenario_generation_progress", handleGenerationProgress);
    socket.on("scenario_generation_complete", handleGenerationComplete);
    socket.on("scenario_generation_error", handleGenerationError);

    return () => {
      socket.off("scenario_generation_progress", handleGenerationProgress);
      socket.off("scenario_generation_complete", handleGenerationComplete);
      socket.off("scenario_generation_error", handleGenerationError);
    };
  }, [socket, isConnected, scenarioData?.group_id]);

  // Memoize scenarioData fields used in renderStep to prevent callback recreation
  // when only object reference changes (but content is same)
  const stableScenarioDataFields = React.useMemo(() => {
    if (!scenarioData) return null;
    return {
      group_id: scenarioData.group_id,
      name_id: scenarioData.name_id,
      name_resource: scenarioData.name_resource,
      show_name: scenarioData.show_name,
      name_suggestions: scenarioData.name_suggestions,
      names: scenarioData.names,
      name_required: scenarioData.name_required,
      name_agent_id: scenarioData.name_agent_id,
      description_id: scenarioData.description_id,
      description_resource: scenarioData.description_resource,
      show_description: scenarioData.show_description,
      description_suggestions: scenarioData.description_suggestions,
      description_required: scenarioData.description_required,
      description_agent_id: scenarioData.description_agent_id,
      descriptions: scenarioData.descriptions,
      problem_statement_id: scenarioData.problem_statement_id,
      problem_statement_resource: scenarioData.problem_statement_resource,
      show_problem_statement: scenarioData.show_problem_statement,
      problem_statement_suggestions: scenarioData.problem_statement_suggestions,
      problem_statement_required: scenarioData.problem_statement_required,
      problem_statement_agent_id: scenarioData.problem_statement_agent_id,
      problem_statements: scenarioData.problem_statements,
      objective_ids: scenarioData.objective_ids,
      objective_resources: scenarioData.objective_resources,
      show_objectives: scenarioData.show_objectives,
      objectives_agent_id: scenarioData.objectives_agent_id,
      objectives_required: scenarioData.objectives_required,
      objective_suggestions: scenarioData.objective_suggestions,
      objectives: scenarioData.objectives,
      active_flag_id: scenarioData.active_flag_id,
      active_flag_resource: scenarioData.active_flag_resource,
      show_active_flag: scenarioData.show_active_flag,
      active_flag_agent_id: scenarioData.active_flag_agent_id,
      active_flag_required: scenarioData.active_flag_required,
      objectives_enabled_flag_id: scenarioData.objectives_enabled_flag_id,
      objectives_enabled_flag_resource:
        scenarioData.objectives_enabled_flag_resource,
      show_objectives_enabled_flag: scenarioData.show_objectives_enabled_flag,
      objectives_enabled_flag_agent_id:
        scenarioData.objectives_enabled_flag_agent_id,
      objectives_enabled_flag_required:
        scenarioData.objectives_enabled_flag_required,
      images_enabled_flag_id: scenarioData.images_enabled_flag_id,
      images_enabled_flag_resource: scenarioData.images_enabled_flag_resource,
      show_images_enabled_flag: scenarioData.show_images_enabled_flag,
      images_enabled_flag_agent_id: scenarioData.images_enabled_flag_agent_id,
      images_enabled_flag_required: scenarioData.images_enabled_flag_required,
      video_enabled_flag_id: scenarioData.video_enabled_flag_id,
      video_enabled_flag_resource: scenarioData.video_enabled_flag_resource,
      show_video_enabled_flag: scenarioData.show_video_enabled_flag,
      video_enabled_flag_agent_id: scenarioData.video_enabled_flag_agent_id,
      video_enabled_flag_required: scenarioData.video_enabled_flag_required,
      questions_enabled_flag_id: scenarioData.questions_enabled_flag_id,
      questions_enabled_flag_resource:
        scenarioData.questions_enabled_flag_resource,
      show_questions_enabled_flag: scenarioData.show_questions_enabled_flag,
      questions_enabled_flag_agent_id:
        scenarioData.questions_enabled_flag_agent_id,
      questions_enabled_flag_required:
        scenarioData.questions_enabled_flag_required,
      problem_statement_enabled_flag_id:
        scenarioData.problem_statement_enabled_flag_id,
      problem_statement_enabled_flag_resource:
        scenarioData.problem_statement_enabled_flag_resource,
      show_problem_statement_enabled_flag:
        scenarioData.show_problem_statement_enabled_flag,
      problem_statement_enabled_flag_agent_id:
        scenarioData.problem_statement_enabled_flag_agent_id,
      problem_statement_enabled_flag_required:
        scenarioData.problem_statement_enabled_flag_required,
      department_ids: scenarioData.department_ids,
      department_resources: scenarioData.department_resources,
      show_departments: scenarioData.show_departments,
      departments_agent_id: scenarioData.departments_agent_id,
      departments_required: scenarioData.departments_required,
      department_suggestions: scenarioData.department_suggestions,
      departments: scenarioData.departments,
      can_edit: scenarioData.can_edit,
      disabled_reason: scenarioData.disabled_reason,
      general_agent_id: scenarioData.general_agent_id,
      basic_agent_id: scenarioData.basic_agent_id,
      content_agent_id: scenarioData.content_agent_id,
    };
  }, [
    scenarioData?.group_id,
    scenarioData?.name_id,
    scenarioData?.name_resource,
    scenarioData?.show_name,
    scenarioData?.name_suggestions,
    scenarioData?.names,
    scenarioData?.name_required,
    scenarioData?.name_agent_id,
    scenarioData?.description_id,
    scenarioData?.description_resource,
    scenarioData?.show_description,
    scenarioData?.description_suggestions,
    scenarioData?.description_required,
    scenarioData?.description_agent_id,
    scenarioData?.descriptions,
    scenarioData?.problem_statement_id,
    scenarioData?.problem_statement_resource,
    scenarioData?.show_problem_statement,
    scenarioData?.problem_statement_suggestions,
    scenarioData?.problem_statement_required,
    scenarioData?.problem_statement_agent_id,
    scenarioData?.problem_statements,
    scenarioData?.objective_ids,
    scenarioData?.objective_resources,
    scenarioData?.show_objectives,
    scenarioData?.objectives_agent_id,
    scenarioData?.objectives_required,
    scenarioData?.objective_suggestions,
    scenarioData?.objectives,
    scenarioData?.active_flag_id,
    scenarioData?.active_flag_resource,
    scenarioData?.show_active_flag,
    scenarioData?.active_flag_agent_id,
    scenarioData?.active_flag_required,
    scenarioData?.objectives_enabled_flag_id,
    scenarioData?.objectives_enabled_flag_resource,
    scenarioData?.show_objectives_enabled_flag,
    scenarioData?.objectives_enabled_flag_agent_id,
    scenarioData?.objectives_enabled_flag_required,
    scenarioData?.images_enabled_flag_id,
    scenarioData?.images_enabled_flag_resource,
    scenarioData?.show_images_enabled_flag,
    scenarioData?.images_enabled_flag_agent_id,
    scenarioData?.images_enabled_flag_required,
    scenarioData?.video_enabled_flag_id,
    scenarioData?.video_enabled_flag_resource,
    scenarioData?.show_video_enabled_flag,
    scenarioData?.video_enabled_flag_agent_id,
    scenarioData?.video_enabled_flag_required,
    scenarioData?.questions_enabled_flag_id,
    scenarioData?.questions_enabled_flag_resource,
    scenarioData?.show_questions_enabled_flag,
    scenarioData?.questions_enabled_flag_agent_id,
    scenarioData?.questions_enabled_flag_required,
    scenarioData?.problem_statement_enabled_flag_id,
    scenarioData?.problem_statement_enabled_flag_resource,
    scenarioData?.show_problem_statement_enabled_flag,
    scenarioData?.problem_statement_enabled_flag_agent_id,
    scenarioData?.problem_statement_enabled_flag_required,
    JSON.stringify(scenarioData?.department_ids),
    scenarioData?.department_resources,
    scenarioData?.show_departments,
    scenarioData?.departments_agent_id,
    scenarioData?.departments_required,
    scenarioData?.department_suggestions,
    scenarioData?.departments,
    scenarioData?.can_edit,
    scenarioData?.disabled_reason,
    scenarioData?.general_agent_id,
    scenarioData?.basic_agent_id,
    scenarioData?.content_agent_id,
  ]);

  // Helper to check if a resource type can be regenerated
  const canRegenerate = useCallback(
    (resourceType: ResourceType): boolean => {
      if (!stableScenarioDataFields) return false;
      switch (resourceType) {
        case "names":
          return stableScenarioDataFields.name_resource?.generated ?? false;
        case "descriptions":
          return (
            stableScenarioDataFields.description_resource?.generated ?? false
          );
        case "problem_statements":
          return (
            stableScenarioDataFields.problem_statement_resource?.generated ??
            false
          );
        case "objectives":
          return (
            stableScenarioDataFields.objective_resources?.some(
              (o) => o.generated
            ) ?? false
          );
        case "scenario_flags":
          return (
            stableScenarioDataFields.active_flag_resource?.generated ??
            (false ||
              stableScenarioDataFields.objectives_enabled_flag_resource
                ?.generated) ??
            (false ||
              stableScenarioDataFields.images_enabled_flag_resource
                ?.generated) ??
            (false ||
              stableScenarioDataFields.video_enabled_flag_resource
                ?.generated) ??
            (false ||
              stableScenarioDataFields.questions_enabled_flag_resource
                ?.generated) ??
            (false ||
              stableScenarioDataFields.problem_statement_enabled_flag_resource
                ?.generated) ??
            false
          );
        default:
          return false;
      }
    },
    [stableScenarioDataFields]
  );

  // Individual resource generation handlers
  const handleGenerateName = useCallback(() => {
    handleGenerateResources(["names"]);
  }, [handleGenerateResources]);

  const handleGenerateDescription = useCallback(() => {
    handleGenerateResources(["descriptions"]);
  }, [handleGenerateResources]);

  const handleGenerateFlags = useCallback(() => {
    handleGenerateResources(["scenario_flags"]);
  }, [handleGenerateResources]);

  const handleGenerateProblemStatements = useCallback(() => {
    handleGenerateResources(["problem_statements"]);
  }, [handleGenerateResources]);

  const handleGenerateObjectives = useCallback(() => {
    handleGenerateResources(["objectives"]);
  }, [handleGenerateResources]);

  // Helper function to determine agent_type from resource types
  const determineAgentType = useCallback(
    (resourceTypes: ResourceType[]): string | null => {
      // For scenarios, we can use "scenario" as the agent type
      // or map individual resource types if needed
      if (resourceTypes.length === 1) {
        const agentTypeMap: Record<ResourceType, string> = {
          names: "name",
          descriptions: "description",
          problem_statements: "problem_statement",
          objectives: "objectives",
          ranges: "ranges",
          scenario_flags: "scenario_flags",
        };
        const firstType = resourceTypes[0];
        if (firstType && firstType in agentTypeMap) {
          return agentTypeMap[firstType];
        }
      }
      // For multiple resources, use "scenario" as general type
      return "scenario";
    },
    []
  );

  // Multi-generation handler - accepts list of resource types and optional user instructions
  const handleGenerateResources = useCallback(
    async (
      resourceTypes: ResourceType[],
      agentType: string | null,
      userInstructions?: string
    ) => {
      if (!socket || !isConnected) {
        toast.error("WebSocket not connected");
        return;
      }

      // Set all resources as generating
      setGeneratingResources((prev) => {
        const next = new Set(prev);
        resourceTypes.forEach((rt) => next.add(rt));
        return next;
      });

      // Get draftId from URL params
      const draftId = urlDraftId || null;

      // Emit scenario_generate event with GetScenarioApiRequest fields
      socket.emit("scenario_generate", {
        resource_types: resourceTypes, // Simple array of strings
        agent_type: agentType,
        user_instructions: userInstructions ? [userInstructions] : null,
        // GetScenarioApiRequest fields
        draft_id: draftId || null,
        scenario_id: scenarioId || null,
        mcp: false,
      });
    },
    [socket, isConnected, scenarioId, urlDraftId]
  );

  // Handler to open modal for step card generation
  const handleOpenStepCardModal = useCallback(
    (stepId: string, mode: "generate" | "regenerate") => {
      const resourceTypes = stepResources[stepId] || [];
      const resources: GenerateRegenerateModalResource[] = resourceTypes.map(
        (rt) => ({
          id: rt,
          label: resourceLabels[rt],
          active: mode === "regenerate" ? canRegenerate(rt) : true,
        })
      );

      setModalResources(resources);
      setModalMode(mode);
      setModalInstructions("");
      setShowGenerateModal(true);
    },
    [stepResources, resourceLabels, canRegenerate]
  );

  // Handler for modal generate/regenerate action
  const handleModalGenerate = useCallback(
    async (selectedResources: string[], instructions: string) => {
      const resourceTypes = selectedResources as ResourceType[];
      const agentType = determineAgentType(resourceTypes);
      await handleGenerateResources(
        resourceTypes,
        agentType,
        instructions.trim() || undefined
      );
      setShowGenerateModal(false);
      setModalInstructions("");
    },
    [handleGenerateResources, determineAgentType]
  );

  // Set generation capability when scenario data is loaded
  useEffect(() => {
    // TODO: Check for general_agent_id once scenarioData structure is updated with agent IDs
    // For now, check if group_id exists as a proxy for generation capability
    if (scenarioData?.group_id) {
      setGenerationCapability({
        artifactType: "scenario",
        canGenerate: true,
        agentId: null, // TODO: Set to actual general_agent_id once available
      });
    } else {
      setGenerationCapability({
        artifactType: "scenario",
        canGenerate: false,
        agentId: null,
      });
    }
    return () => clearGenerationCapability();
  }, [
    scenarioData?.group_id,
    setGenerationCapability,
    clearGenerationCapability,
  ]);

  // Step-to-resources mapping for multi-generation
  const stepResources: Record<string, ResourceType[]> = useMemo(
    () => ({
      basic: ["names", "descriptions", "scenario_flags"],
      content: ["problem_statements", "objectives"],
      all: [
        "names",
        "descriptions",
        "problem_statements",
        "objectives",
        "scenario_flags",
      ], // All resources for full-page generation
    }),
    []
  );

  // Resource labels for modal
  const resourceLabels: Record<ResourceType, string> = useMemo(
    () => ({
      names: "Names",
      descriptions: "Descriptions",
      problem_statements: "Problem Statements",
      objectives: "Objectives",
      ranges: "Ranges",
      scenario_flags: "Scenario Flags",
    }),
    []
  );

  // Listen for full-page-generate event from layout
  useEffect(() => {
    const handleFullPageGenerate = () => {
      // TODO: Check for general_agent_id once scenarioData structure is updated
      if (scenarioData?.group_id) {
        // Open modal instead of directly generating
        handleOpenStepCardModal("all", "generate");
      }
    };
    window.addEventListener("full-page-generate", handleFullPageGenerate);
    return () =>
      window.removeEventListener("full-page-generate", handleFullPageGenerate);
  }, [scenarioData?.group_id, handleOpenStepCardModal]);

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
      // Legacy range params removed - use resource-based approach instead
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
          // Legacy fields removed - use resource-based approach instead
          key === "scenarioDomainId" ||
          key === "imageDomainId" ||
          key === "videoDomainId"
        ) {
          draftUpdates[key as keyof DraftState] = value as never;
        }

        // Legacy range params removed - use resource-based approach instead

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
    if (!scenarioData || typeof scenarioData !== "object") return {};
    const typedData = scenarioData as GetScenarioOut;
    if (!("personas" in typedData)) return {};
    const personas = typedData.personas;
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
    if (!scenarioData || typeof scenarioData !== "object") {
      return templateDocumentIds;
    }
    const typedData = scenarioData as GetScenarioOut;
    if (!("document_details" in typedData) || !typedData.document_details) {
      return templateDocumentIds;
    }
    currentDocumentIds.forEach((docId) => {
      const docDetail = typedData.document_details?.find(
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
  }, [currentDocumentIds, templateDocumentIds, scenarioData]);

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
    if (
      !scenarioData ||
      typeof scenarioData !== "object" ||
      !("objectives_history" in scenarioData)
    ) {
      return [];
    }
    const typedData = scenarioData as GetScenarioOut;
    const rawHistory = typedData.objectives_history || [];
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
  }, [scenarioData, draftState.departmentIds]);

  // Use server-provided filtered valid IDs (replacing client-side filtering)
  // Server now handles all filtering logic based on query parameters
  const validPersonaIds = useMemo(() => {
    if (
      !scenarioData ||
      typeof scenarioData !== "object" ||
      !("valid_persona_ids" in scenarioData)
    ) {
      return [];
    }
    const typedData = scenarioData as GetScenarioOut;
    return typedData.valid_persona_ids || [];
  }, [scenarioData]);

  // Use server-provided filtered valid document IDs
  const validDocumentIds = useMemo(() => {
    if (
      !scenarioData ||
      typeof scenarioData !== "object" ||
      !("valid_document_ids" in scenarioData)
    ) {
      return [];
    }
    const typedData = scenarioData as GetScenarioOut;
    return typedData.valid_document_ids || [];
  }, [scenarioData]);

  // Use server-provided filtered valid parameter item IDs
  const validParameterItemIds = useMemo(() => {
    // Use server-provided filtered IDs if available, otherwise fall back to mapping keys
    if (
      scenarioData &&
      typeof scenarioData === "object" &&
      "valid_field_ids" in scenarioData &&
      scenarioData.valid_field_ids
    ) {
      const typedData = scenarioData as GetScenarioOut;
      return typedData.valid_field_ids;
    }
    // Fallback for backward compatibility
    return Object.keys(fieldMapping || {});
  }, [scenarioData, fieldMapping]);

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

  // Disabled logic based on can_edit flag - standardized for all resource components
  // Check can_edit in both new and edit modes to show disabled_reason when agents are missing
  const disabled = useMemo(() => {
    if (!scenarioData) return false;
    // can_edit exists on GetScenarioOut (unified response)
    if ("can_edit" in scenarioData) {
      return !scenarioData.can_edit;
    }
    return false;
  }, [scenarioData]);

  // Alias for backward compatibility during migration
  const isReadonly = disabled;

  // Set breadcrumb context when scenario data is loaded
  useEffect(() => {
    if (
      !scenarioData ||
      typeof scenarioData !== "object" ||
      !("name_resource" in scenarioData)
    ) {
      return;
    }
    const typedData = scenarioData as GetScenarioOut;
    const scenarioName = typedData.name_resource?.name;
    if (scenarioName && scenarioId && isEditMode) {
      setEntityMetadata({
        entityId: scenarioId,
        entityName: scenarioName,
        entityType: "scenario",
      });
    }
    return () => clearEntityMetadata();
  }, [
    scenarioData,
    scenarioId,
    isEditMode,
    setEntityMetadata,
    clearEntityMetadata,
  ]);

  // Generation capability is handled by parent components
  // Removed useGenerationContext integration - no longer needed

  // Get affected simulations from unified API data
  const affectedSimulations = useMemo(() => {
    // simulation_ids exists on GetScenarioOut when scenario_exists is true
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
          // Check resource IDs from formState
          return formState.name_id ? "completed" : "active";
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
          // Check resource IDs from formState
          const hasProblemStatement = !!formState.problem_statement_id;
          const hasObjectives =
            formState.objective_ids && formState.objective_ids.length > 0;
          return selectedPersonaIds.length === 0
            ? "pending"
            : hasProblemStatement || hasObjectives
              ? "completed"
              : "active";
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
      formState.name_id,
      formState.problem_statement_id,
      formState.objective_ids,
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
      {
        id: "preview",
        title: "Preview",
        description: "Preview scenario messages, hints, and documents.",
        resetFields: [],
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
      // Validate required resource IDs using {resource}_required flags from scenarioData
      if (scenarioData?.name_required && !formState.name_id) {
        toast.error("Scenario name is required");
        setIsSubmitting(false);
        return;
      }

      if (
        scenarioData?.problem_statement_required &&
        !formState.problem_statement_id
      ) {
        toast.error("Problem statement is required");
        setIsSubmitting(false);
        return;
      }

      if (
        scenarioData?.objectives_required &&
        (!formState.objective_ids || formState.objective_ids.length === 0)
      ) {
        toast.error("At least one objective is required");
        setIsSubmitting(false);
        return;
      }

      // Ensure profileId exists - required for API calls
      if (!effectiveProfile?.id) {
        toast.error("Profile not loaded. Please refresh the page.");
        setIsSubmitting(false);
        return;
      }

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
        formState.department_ids || [],
        isSuperadmin,
        validDeptIds
      );

      // Extract values from resources when resource IDs are present
      const nameValue =
        formState.name_id && scenarioData?.name_resource
          ? scenarioData.name_resource.name
          : name?.trim() || "";
      const descriptionValue =
        formState.description_id && scenarioData?.description_resource
          ? scenarioData.description_resource.description
          : scenarioData &&
              typeof scenarioData === "object" &&
              "description" in scenarioData
            ? ((scenarioData as { description?: string | null }).description ??
              null)
            : null;
      const problemStatementValue =
        formState.problem_statement_id &&
        scenarioData?.problem_statement_resource
          ? scenarioData.problem_statement_resource.problem_statement
          : problemStatement?.trim() || "";
      // Extract objective texts from resources when objective_ids are present
      // Note: objective_resources has id (not objective_id) and objective fields
      const objectiveTexts =
        formState.objective_ids && scenarioData?.objective_resources
          ? scenarioData.objective_resources
              .filter((obj) =>
                formState.objective_ids?.includes(String(obj.id))
              )
              .map((obj) => obj.objective)
          : contentState.objectives.filter((obj) => obj.trim());
      // Extract flag values: if flag_id is set, the flag is enabled (true), otherwise use legacy state
      // Note: Flag resources don't have a value field - if flag_id exists, the flag is enabled
      const activeValue = formState.active_flag_id
        ? true
        : basicInfoState.active;
      const objectivesEnabledValue = formState.objectives_enabled_flag_id
        ? true
        : useObjectives;
      const imagesEnabledValue = formState.images_enabled_flag_id
        ? true
        : useImage;
      const videoEnabledValue = formState.video_enabled_flag_id
        ? true
        : useVideo;
      const questionsEnabledValue = formState.questions_enabled_flag_id
        ? true
        : useQuestions;
      const problemStatementEnabledValue =
        formState.problem_statement_enabled_flag_id
          ? true
          : useProblemStatement;

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
        name: nameValue,
        description: descriptionValue,
        problem_statement: problemStatementValue,
        department_ids: finalDepartmentIds,
        active: activeValue,
        persona_ids: selectedPersonaIds.length > 0 ? selectedPersonaIds : null,
        document_ids: currentDocumentIds,
        template_document_ids:
          templateDocumentIds.length > 0 ? templateDocumentIds : null,
        objective_ids: objectiveTexts, // Send objective texts from resources
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
      // Use the extracted problem statement value instead of legacy state
      if (!isEditMode && localProblemStatementVersions.length > 0) {
        const versions = localProblemStatementVersions.map(
          (v) => v.problem_statement
        );
        // Ensure current problem statement is included as the last version (most recent)
        const currentProblemStatement = problemStatementValue;
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
            objectives_enabled: objectivesEnabledValue,
            images_enabled: imagesEnabledValue,
            video_enabled: videoEnabledValue,
            questions_enabled: questionsEnabledValue,
            problem_statement_enabled: problemStatementEnabledValue,
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
            objectives_enabled: objectivesEnabledValue,
            images_enabled: imagesEnabledValue,
            video_enabled: videoEnabledValue,
            questions_enabled: questionsEnabledValue,
            problem_statement_enabled: problemStatementEnabledValue,
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
      // Use stableScenarioDataFields to prevent callback recreation
      const currentScenarioData = stableScenarioDataFields;

      switch (stepId) {
        case "basic": {
          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={isReadonly}
              isEditMode={isEditMode}
              customHeader={
                <Names
                  name_id={formState.name_id ?? null}
                  name_resource={currentScenarioData?.name_resource ?? null}
                  show_name={currentScenarioData?.show_name ?? true}
                  name_suggestions={currentScenarioData?.name_suggestions ?? []}
                  names={currentScenarioData?.names ?? []}
                  disabled={isReadonly}
                  onNameIdChange={(nameId) =>
                    setFormState((prev) => ({ ...prev, name_id: nameId }))
                  }
                  onGenerate={handleGenerateName}
                  isGenerating={isGenerating("names")}
                  placeholder="e.g., Customer Service Scenario"
                  defaultName="New Scenario"
                  required={currentScenarioData?.name_required ?? false}
                  hideDescription={true}
                  group_id={currentScenarioData?.group_id ?? null}
                  agent_id={currentScenarioData?.name_agent_id ?? null}
                  createNamesAction={
                    createNamesAction as
                      | ((
                          input: CreateDraftNamesIn
                        ) => Promise<CreateDraftNamesOut>)
                      | undefined
                  }
                />
              }
              resetFields={[
                "name",
                "description",
                "department_ids",
                "active_flag_id",
              ]}
              actions={
                stepResources["basic"] &&
                stepResources["basic"].length > 0 &&
                currentScenarioData?.basic_agent_id ? (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            const hasRegeneratable = stepResources[
                              "basic"
                            ]!.some((rt) => canRegenerate(rt));
                            handleOpenStepCardModal(
                              "basic",
                              hasRegeneratable ? "regenerate" : "generate"
                            );
                          }}
                          disabled={
                            isReadonly ||
                            stepResources["basic"]!.some((rt) =>
                              isGenerating(rt)
                            )
                          }
                        >
                          {stepResources["basic"]!.some((rt) =>
                            isGenerating(rt)
                          ) ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Sparkles className="h-4 w-4" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {stepResources["basic"]!.some((rt) => canRegenerate(rt))
                          ? "Regenerate"
                          : "Generate"}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ) : undefined
              }
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
            >
              <div className="space-y-4">
                {/* Description field - using Descriptions resource component */}
                <Descriptions
                  description_id={formState.description_id ?? null}
                  description_resource={
                    currentScenarioData?.description_resource ?? null
                  }
                  show_description={
                    currentScenarioData?.show_description ?? true
                  }
                  description_suggestions={
                    currentScenarioData?.description_suggestions ?? []
                  }
                  descriptions={currentScenarioData?.descriptions ?? []}
                  disabled={isReadonly}
                  onDescriptionIdChange={(descriptionId) =>
                    setFormState((prev) => ({
                      ...prev,
                      description_id: descriptionId,
                    }))
                  }
                  searchTerm={
                    (_stepFormData["descriptionSearch"] as
                      | string
                      | null
                      | undefined) || ""
                  }
                  onSearchChange={(term: string) =>
                    _setStepFormData({ descriptionSearch: term || null })
                  }
                  onGenerate={handleGenerateDescription}
                  isGenerating={isGenerating("descriptions")}
                  label="Description"
                  placeholder="Detailed scenario description"
                  required={currentScenarioData?.description_required ?? false}
                  rows={4}
                  group_id={currentScenarioData?.group_id ?? null}
                  agent_id={currentScenarioData?.description_agent_id ?? null}
                  createDescriptionsAction={createDescriptionsAction}
                />

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
                            ...(formState.department_ids || []),
                          ])
                        )}
                        selectedIds={formState.department_ids || []}
                        onSelect={(ids) =>
                          setFormState((prev) => ({
                            ...prev,
                            department_ids: ids,
                          }))
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

                {/* Active Flag - using Flags resource component */}
                <Flags
                  flag_id={formState.active_flag_id ?? null}
                  flag_resource={
                    currentScenarioData?.active_flag_resource ?? null
                  }
                  show_flag={currentScenarioData?.show_active_flag ?? false}
                  disabled={isReadonly}
                  onFlagIdChange={(flagId) =>
                    setFormState((prev) => ({
                      ...prev,
                      active_flag_id: flagId,
                    }))
                  }
                  onGenerate={handleGenerateFlags}
                  isGenerating={isGenerating("scenario_flags")}
                  label="Active"
                  helpText="Inactive scenarios will not be available for other simulations"
                  required={currentScenarioData?.active_flag_required ?? false}
                  group_id={currentScenarioData?.group_id ?? null}
                  agent_id={currentScenarioData?.active_flag_agent_id ?? null}
                  createFlagsAction={createScenarioFlagsAction}
                />

                {/* Objectives Enabled Flag */}
                <Flags
                  flag_id={formState.objectives_enabled_flag_id ?? null}
                  flag_resource={
                    currentScenarioData?.objectives_enabled_flag_resource ??
                    null
                  }
                  show_flag={
                    currentScenarioData?.show_objectives_enabled_flag ?? false
                  }
                  disabled={isReadonly}
                  onFlagIdChange={(flagId) =>
                    setFormState((prev) => ({
                      ...prev,
                      objectives_enabled_flag_id: flagId,
                    }))
                  }
                  onGenerate={handleGenerateFlags}
                  isGenerating={isGenerating("scenario_flags")}
                  label="Enable Objectives"
                  helpText="Enable objectives for this scenario"
                  required={
                    currentScenarioData?.objectives_enabled_flag_required ??
                    false
                  }
                  group_id={currentScenarioData?.group_id ?? null}
                  agent_id={
                    currentScenarioData?.objectives_enabled_flag_agent_id ??
                    null
                  }
                  createFlagsAction={createScenarioFlagsAction}
                />

                {/* Images Enabled Flag */}
                <Flags
                  flag_id={formState.images_enabled_flag_id ?? null}
                  flag_resource={
                    currentScenarioData?.images_enabled_flag_resource ?? null
                  }
                  show_flag={
                    currentScenarioData?.show_images_enabled_flag ?? false
                  }
                  disabled={isReadonly}
                  onFlagIdChange={(flagId) =>
                    setFormState((prev) => ({
                      ...prev,
                      images_enabled_flag_id: flagId,
                    }))
                  }
                  onGenerate={handleGenerateFlags}
                  isGenerating={isGenerating("scenario_flags")}
                  label="Enable Images"
                  helpText="Enable image support for this scenario"
                  required={
                    currentScenarioData?.images_enabled_flag_required ?? false
                  }
                  group_id={currentScenarioData?.group_id ?? null}
                  agent_id={
                    currentScenarioData?.images_enabled_flag_agent_id ?? null
                  }
                  createFlagsAction={createScenarioFlagsAction}
                />

                {/* Video Enabled Flag */}
                <Flags
                  flag_id={formState.video_enabled_flag_id ?? null}
                  flag_resource={
                    currentScenarioData?.video_enabled_flag_resource ?? null
                  }
                  show_flag={
                    currentScenarioData?.show_video_enabled_flag ?? false
                  }
                  disabled={isReadonly}
                  onFlagIdChange={(flagId) => {
                    setFormState((prev) => ({
                      ...prev,
                      video_enabled_flag_id: flagId,
                    }));
                    // Clear video-related state if disabled
                    if (!flagId) {
                      setContentState((prev) => ({
                        ...prev,
                        selectedVideo: null,
                        activeVideoId: null,
                      }));
                      setFormState((prev) => ({
                        ...prev,
                        questions_enabled_flag_id: null,
                      }));
                    }
                  }}
                  onGenerate={handleGenerateFlags}
                  isGenerating={isGenerating("scenario_flags")}
                  label="Enable Video"
                  helpText="Enable video support for this scenario"
                  required={
                    currentScenarioData?.video_enabled_flag_required ?? false
                  }
                  group_id={currentScenarioData?.group_id ?? null}
                  agent_id={
                    currentScenarioData?.video_enabled_flag_agent_id ?? null
                  }
                  createFlagsAction={createScenarioFlagsAction}
                />

                {/* Questions Enabled Flag */}
                <Flags
                  flag_id={formState.questions_enabled_flag_id ?? null}
                  flag_resource={
                    currentScenarioData?.questions_enabled_flag_resource ?? null
                  }
                  show_flag={
                    currentScenarioData?.show_questions_enabled_flag ?? false
                  }
                  disabled={isReadonly || !formState.video_enabled_flag_id}
                  onFlagIdChange={(flagId) =>
                    setFormState((prev) => ({
                      ...prev,
                      questions_enabled_flag_id: flagId,
                    }))
                  }
                  onGenerate={handleGenerateFlags}
                  isGenerating={isGenerating("scenario_flags")}
                  label="Enable Questions"
                  helpText="Enable questions for this scenario"
                  required={
                    currentScenarioData?.questions_enabled_flag_required ??
                    false
                  }
                  group_id={currentScenarioData?.group_id ?? null}
                  agent_id={
                    currentScenarioData?.questions_enabled_flag_agent_id ?? null
                  }
                  createFlagsAction={createScenarioFlagsAction}
                />

                {/* Problem Statement Enabled Flag */}
                <Flags
                  flag_id={formState.problem_statement_enabled_flag_id ?? null}
                  flag_resource={
                    currentScenarioData?.problem_statement_enabled_flag_resource ??
                    null
                  }
                  show_flag={
                    currentScenarioData?.show_problem_statement_enabled_flag ??
                    false
                  }
                  disabled={isReadonly}
                  onFlagIdChange={(flagId) =>
                    setFormState((prev) => ({
                      ...prev,
                      problem_statement_enabled_flag_id: flagId,
                    }))
                  }
                  onGenerate={handleGenerateFlags}
                  isGenerating={isGenerating("scenario_flags")}
                  label="Enable Problem Statement"
                  helpText="Enable problem statement for this scenario"
                  required={
                    currentScenarioData?.problem_statement_enabled_flag_required ??
                    false
                  }
                  group_id={currentScenarioData?.group_id ?? null}
                  agent_id={
                    currentScenarioData?.problem_statement_enabled_flag_agent_id ??
                    null
                  }
                  createFlagsAction={createScenarioFlagsAction}
                />
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
          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={isReadonly}
              isEditMode={isEditMode}
              resetFields={[
                "problem_statement_id",
                "objective_ids",
                "useImage",
                "useVideo",
                "useQuestions",
              ]}
              actions={
                stepResources["content"] &&
                stepResources["content"].length > 0 &&
                currentScenarioData?.content_agent_id ? (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            const hasRegeneratable = stepResources[
                              "content"
                            ]!.some((rt) => canRegenerate(rt));
                            handleOpenStepCardModal(
                              "content",
                              hasRegeneratable ? "regenerate" : "generate"
                            );
                          }}
                          disabled={
                            isReadonly ||
                            stepResources["content"]!.some((rt) =>
                              isGenerating(rt)
                            )
                          }
                        >
                          {stepResources["content"]!.some((rt) =>
                            isGenerating(rt)
                          ) ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Sparkles className="h-4 w-4" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {stepResources["content"]!.some((rt) =>
                          canRegenerate(rt)
                        )
                          ? "Regenerate"
                          : "Generate"}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ) : undefined
              }
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
            >
              <div className="space-y-4">
                {/* Problem Statement - using ProblemStatements resource component */}
                <ProblemStatements
                  problem_statement_id={formState.problem_statement_id ?? null}
                  problem_statement_resource={
                    currentScenarioData?.problem_statement_resource ?? null
                  }
                  show_problem_statement={
                    currentScenarioData?.show_problem_statement ?? true
                  }
                  problem_statement_suggestions={
                    currentScenarioData?.problem_statement_suggestions ?? []
                  }
                  problem_statements={
                    currentScenarioData?.problem_statements ?? []
                  }
                  disabled={isReadonly}
                  onProblemStatementIdChange={(problemStatementId) =>
                    setFormState((prev) => ({
                      ...prev,
                      problem_statement_id: problemStatementId,
                    }))
                  }
                  searchTerm={
                    (_stepFormData["problemStatementSearch"] as
                      | string
                      | null
                      | undefined) || ""
                  }
                  onSearchChange={(term: string) =>
                    _setStepFormData({ problemStatementSearch: term || null })
                  }
                  onGenerate={handleGenerateProblemStatements}
                  isGenerating={isGenerating("problem_statements")}
                  label="Problem Statement"
                  placeholder="Describe the problem or scenario context"
                  required={
                    currentScenarioData?.problem_statement_required ?? false
                  }
                  rows={4}
                  group_id={currentScenarioData?.group_id ?? null}
                  agent_id={
                    currentScenarioData?.problem_statement_agent_id ?? null
                  }
                  createProblemStatementsAction={createProblemStatementsAction}
                />

                {/* Objectives - using Objectives resource component */}
                <Objectives
                  objective_ids={formState.objective_ids ?? []}
                  objective_resources={
                    currentScenarioData?.objective_resources ?? []
                  }
                  show_objectives={
                    currentScenarioData?.show_objectives ?? false
                  }
                  objective_suggestions={
                    currentScenarioData?.objective_suggestions ?? []
                  }
                  objectives={currentScenarioData?.objectives ?? []}
                  disabled={isReadonly}
                  onChange={(ids) =>
                    setFormState((prev) => ({ ...prev, objective_ids: ids }))
                  }
                  onGenerate={handleGenerateObjectives}
                  isGenerating={isGenerating("objectives")}
                  required={currentScenarioData?.objectives_required ?? false}
                  group_id={currentScenarioData?.group_id ?? null}
                  agent_id={currentScenarioData?.objectives_agent_id ?? null}
                  createObjectivesAction={createObjectivesAction}
                />

                {/* TODO: Images, Videos, Questions will be migrated to resources later */}
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
                        documentDetails:
                          scenarioData.document_details as Array<{
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
                  onShowRegenerationDialog={() =>
                    setShowRegenerationDialog(true)
                  }
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
              </div>
            </StepCard>
          );
        }
        case "preview": {
          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={isReadonly}
              isEditMode={isEditMode}
              resetFields={[]}
              {...(onReset ? { onReset } : {})}
            >
              {/* TODO: Re-integrate preview sections in future */}
              {/* <PreviewStep
                selectedPersonaIds={selectedPersonaIds}
                personaMapping={personaMapping}
                allPreviewDocumentIds={allPreviewDocumentIds}
                documentMapping={documentMapping}
                {...(scenarioData?.document_details
                  ? {
                      documentDetails: scenarioData.document_details as Array<{
                        document_id: string;
                        upload_id?: string | null;
                        [key: string]: unknown;
                      }>,
                    }
                  : {})}
                scenarioPreviewDocumentId={
                  contentState.scenarioPreviewDocumentId ?? null
                }
                onScenarioPreviewDocumentChange={(docId) => {
                  setContentState((prev) => ({
                    ...prev,
                    scenarioPreviewDocumentId: docId,
                  }));
                }}
                onDocumentRemove={handleDocumentRemove}
                useVideo={useVideo ?? false}
                selectedVideo={contentState.selectedVideo ?? null}
                image={contentState.image ?? null}
                stepStatus={stepStatus}
                stepTitle={stepTitle}
                stepDescription={stepDescription}
                stepNumber={stepNumber}
                isReadonly={isReadonly}
                disabled={isReadonly}
              /> */}
              <div className="text-muted-foreground text-sm">
                Preview section temporarily disabled - will be re-integrated as
                resources
              </div>
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
        <ReadOnlyBanner
          disabledReason={
            scenarioData &&
            typeof scenarioData === "object" &&
            "disabled_reason" in scenarioData
              ? ((scenarioData as GetScenarioOut).disabled_reason ?? null)
              : null
          }
        />
      )}

      {/* Config Section - Feature Flags */}
      <div className="mb-6">
        <ConfigSection
          useProblemStatement={useProblemStatement ?? false}
          useObjectives={useObjectives ?? false}
          useImages={useImage ?? false}
          useVideos={useVideo ?? false}
          useQuestions={useQuestions ?? false}
          onUseProblemStatementChange={(enabled) => {
            handleInputChange("useProblemStatement", enabled || null);
            if (!enabled) {
              handleInputChange("problemStatement", null);
            }
          }}
          onUseObjectivesChange={(enabled) => {
            handleInputChange("useObjectives", enabled || null);
          }}
          onUseImagesChange={(enabled) => {
            handleInputChange("useImage", enabled || null);
          }}
          onUseVideosChange={(enabled) => {
            handleInputChange("useVideo", enabled || null);
            if (!enabled) {
              handleInputChange("useQuestions", null);
            }
          }}
          onUseQuestionsChange={(enabled) => {
            handleInputChange("useQuestions", enabled || null);
          }}
          disabled={isReadonly}
        />
      </div>

      <GenerateRegenerateModal
        open={showGenerateModal}
        onOpenChange={setShowGenerateModal}
        mode={modalMode}
        resources={modalResources}
        instructions={modalInstructions}
        onInstructionsChange={setModalInstructions}
        onGenerate={handleModalGenerate}
      />
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

// Memoize component to prevent re-renders when only prop references change (content is same)
export default React.memo(ScenarioComponent, (prevProps, nextProps) => {
  // Compare scenarioData by resource IDs, not object reference
  const prevIds = {
    name_id: prevProps.scenarioDetail?.name_id,
    description_id: prevProps.scenarioDetail?.description_id,
    problem_statement_id: prevProps.scenarioDetail?.problem_statement_id,
    department_ids: prevProps.scenarioDetail?.department_ids,
    persona_ids: prevProps.scenarioDetail?.persona_ids,
    document_ids: prevProps.scenarioDetail?.document_ids,
    parameter_ids: prevProps.scenarioDetail?.parameter_ids,
    field_ids: prevProps.scenarioDetail?.field_ids,
    objective_ids: prevProps.scenarioDetail?.objective_ids,
    image_ids: prevProps.scenarioDetail?.image_ids,
    video_ids: prevProps.scenarioDetail?.video_ids,
    question_ids: prevProps.scenarioDetail?.question_ids,
    template_ids: prevProps.scenarioDetail?.template_ids,
  };
  const nextIds = {
    name_id: nextProps.scenarioDetail?.name_id,
    description_id: nextProps.scenarioDetail?.description_id,
    problem_statement_id: nextProps.scenarioDetail?.problem_statement_id,
    department_ids: nextProps.scenarioDetail?.department_ids,
    persona_ids: nextProps.scenarioDetail?.persona_ids,
    document_ids: nextProps.scenarioDetail?.document_ids,
    parameter_ids: nextProps.scenarioDetail?.parameter_ids,
    field_ids: nextProps.scenarioDetail?.field_ids,
    objective_ids: nextProps.scenarioDetail?.objective_ids,
    image_ids: nextProps.scenarioDetail?.image_ids,
    video_ids: nextProps.scenarioDetail?.video_ids,
    question_ids: nextProps.scenarioDetail?.question_ids,
    template_ids: nextProps.scenarioDetail?.template_ids,
  };

  // Compare primitive props
  if (
    prevProps.scenarioId !== nextProps.scenarioId ||
    prevProps.mode !== nextProps.mode ||
    JSON.stringify(prevIds) !== JSON.stringify(nextIds)
  ) {
    return false; // Props changed, re-render
  }

  // Compare function props by reference (should be stable from server actions)
  if (
    prevProps.createScenarioAction !== nextProps.createScenarioAction ||
    prevProps.updateScenarioAction !== nextProps.updateScenarioAction ||
    prevProps.patchScenarioDraftAction !== nextProps.patchScenarioDraftAction
  ) {
    return false; // Function props changed, re-render
  }

  // All props are equivalent, skip re-render
  return true;
});
