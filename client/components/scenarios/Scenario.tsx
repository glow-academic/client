/**
 * Scenario.tsx
 * Implementation using modular resource components
 * Used to create and manage scenarios - supports both creation and editing
 * Follows Persona.tsx pattern, adapted for scenarios
 */
"use client";

import { useRouter } from "next/navigation";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";

import {
  GenericForm,
  type StepStatus,
} from "@/components/common/forms/GenericForm";
import { StepCard } from "@/components/common/forms/StepCard";
import type { GenerateRegenerateModalResource } from "@/components/common/GenerateRegenerateModal";
import { GenerateRegenerateModal } from "@/components/common/GenerateRegenerateModal";
import { ReadOnlyBanner } from "@/components/common/ReadOnlyBanner";
import { Departments } from "@/components/resources/Departments";
import { Descriptions } from "@/components/resources/Descriptions";
import { Documents } from "@/components/resources/Documents";
import { Flags } from "@/components/resources/Flags";
import { Images } from "@/components/resources/Images";
import { Names } from "@/components/resources/Names";
import { Objectives } from "@/components/resources/Objectives";
import { ParameterFields } from "@/components/resources/ParameterFields";
import { Parameters } from "@/components/resources/Parameters";
import { Personas } from "@/components/resources/Personas";
import { ProblemStatements } from "@/components/resources/ProblemStatements";
import { Questions } from "@/components/resources/Questions";
import { Templates } from "@/components/resources/Templates";
import { Videos } from "@/components/resources/Videos";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useBreadcrumbContext } from "@/contexts/breadcrumb-context";
import { useProfile } from "@/contexts/profile-context";
import { useSaveContext } from "@/contexts/save-context";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { ServerToClientEvents } from "@/lib/ws/types";
import { Sparkles } from "lucide-react";
import { parseAsBoolean, parseAsString, type Parser } from "nuqs";

// Types defined inline using InputOf/OutputOf
type GetScenarioOut = OutputOf<"/api/v4/scenarios/get", "post">;
type SaveScenarioIn = InputOf<"/api/v4/scenarios/save", "post">;
type SaveScenarioOut = OutputOf<"/api/v4/scenarios/save", "post">;
type PatchScenarioDraftIn = InputOf<"/api/v4/scenarios/draft", "patch">;
type PatchScenarioDraftOut = OutputOf<"/api/v4/scenarios/draft", "patch">;

type CreateDraftNamesIn = InputOf<"/api/v4/resources/names", "post">;
type CreateDraftNamesOut = OutputOf<"/api/v4/resources/names", "post">;
type CreateDraftDescriptionsIn = InputOf<
  "/api/v4/resources/descriptions",
  "post"
>;
type CreateDraftDescriptionsOut = OutputOf<
  "/api/v4/resources/descriptions",
  "post"
>;
type CreateDraftProblemStatementsIn = InputOf<
  "/api/v4/resources/problem_statements",
  "post"
>;
type CreateDraftProblemStatementsOut = OutputOf<
  "/api/v4/resources/problem_statements",
  "post"
>;
type CreateDraftObjectivesIn = InputOf<"/api/v4/resources/objectives", "post">;
type CreateDraftObjectivesOut = OutputOf<
  "/api/v4/resources/objectives",
  "post"
>;
type CreateDraftTemplatesIn = InputOf<"/api/v4/resources/templates", "post">;
type CreateDraftTemplatesOut = OutputOf<"/api/v4/resources/templates", "post">;
type CreateDraftParameterFieldsIn = InputOf<
  "/api/v4/resources/parameter_fields",
  "post"
>;
type CreateDraftParameterFieldsOut = OutputOf<
  "/api/v4/resources/parameter_fields",
  "post"
>;
type CreateDraftImagesIn = InputOf<"/api/v4/resources/images", "post">;
type CreateDraftImagesOut = OutputOf<"/api/v4/resources/images", "post">;
type CreateDraftVideosIn = InputOf<"/api/v4/resources/videos", "post">;
type CreateDraftVideosOut = OutputOf<"/api/v4/resources/videos", "post">;
type CreateDraftQuestionsIn = InputOf<"/api/v4/resources/questions", "post">;
type CreateDraftQuestionsOut = OutputOf<"/api/v4/resources/questions", "post">;

// Socket event types (auto-generated from server)
type ScenarioGenerationCompletePayload = Parameters<
  ServerToClientEvents["scenario_generation_complete"]
>[0];

type ScenarioResourceType =
  | "names"
  | "descriptions"
  | "problem_statements"
  | "objectives"
  | "scenario_flags"
  | "departments"
  | "personas"
  | "documents"
  | "templates"
  | "parameters"
  | "parameter_fields"
  | "images"
  | "videos"
  | "questions";

type ScenarioFormState = {
  name_id: string | null;
  description_id: string | null;
  problem_statement_id: string | null;
  active_flag_id: string | null;
  objectives_enabled_flag_id: string | null;
  images_enabled_flag_id: string | null;
  video_enabled_flag_id: string | null;
  questions_enabled_flag_id: string | null;
  problem_statement_enabled_flag_id: string | null;
  use_templates_flag_id: string | null;
  department_ids: string[];
  persona_ids: string[];
  document_ids: string[];
  template_ids: string[];
  parameter_ids: string[];
  parameter_field_ids: string[];
  image_ids: string[];
  objective_ids: string[];
  video_ids: string[];
  question_ids: string[];
};

export interface ScenarioProps {
  scenarioId?: string;
  // Server-provided data (for server-side rendering)
  scenarioDetailDefault?: GetScenarioOut; // For new mode
  scenarioDetail?: GetScenarioOut; // For edit mode
  // Server actions (unified save action like Persona)
  saveScenarioAction?: (input: SaveScenarioIn) => Promise<SaveScenarioOut>;
  patchScenarioDraftAction?: (
    input: PatchScenarioDraftIn
  ) => Promise<PatchScenarioDraftOut>;
  // Resource creation actions
  createNamesAction?: (
    input: CreateDraftNamesIn
  ) => Promise<CreateDraftNamesOut>;
  createDescriptionsAction?: (
    input: CreateDraftDescriptionsIn
  ) => Promise<CreateDraftDescriptionsOut>;
  createProblemStatementsAction?: (
    input: CreateDraftProblemStatementsIn
  ) => Promise<CreateDraftProblemStatementsOut>;
  createObjectivesAction?: (
    input: CreateDraftObjectivesIn
  ) => Promise<CreateDraftObjectivesOut>;
  createTemplatesAction?: (
    input: CreateDraftTemplatesIn
  ) => Promise<CreateDraftTemplatesOut>;
  createParameterFieldsAction?: (
    input: CreateDraftParameterFieldsIn
  ) => Promise<CreateDraftParameterFieldsOut>;
  createImagesAction?: (
    input: CreateDraftImagesIn
  ) => Promise<CreateDraftImagesOut>;
  createVideosAction?: (
    input: CreateDraftVideosIn
  ) => Promise<CreateDraftVideosOut>;
  createQuestionsAction?: (
    input: CreateDraftQuestionsIn
  ) => Promise<CreateDraftQuestionsOut>;
}

function ScenarioComponent({
  scenarioId,
  scenarioDetailDefault: serverScenarioDetailDefault,
  scenarioDetail: serverScenarioDetail,
  saveScenarioAction,
  patchScenarioDraftAction,
  createNamesAction,
  createDescriptionsAction,
  createProblemStatementsAction,
  createObjectivesAction,
  createTemplatesAction,
  createParameterFieldsAction,
  createImagesAction,
  createVideosAction,
  createQuestionsAction,
}: ScenarioProps) {
  const router = useRouter();
  const isEditMode = !!scenarioId;
  const { profile, setSelectedDraftId, socket, isConnected } = useProfile();
  const { setEntityMetadata, clearEntityMetadata } = useBreadcrumbContext();
  const { isAutosaveEnabled } = useSaveContext();

  // Use scenarioDetail for edit mode, scenarioDetailDefault for new mode
  const scenarioData = isEditMode
    ? serverScenarioDetail
    : serverScenarioDetailDefault;

  // Generation state for AI workflows
  const [generatingResources, setGeneratingResources] = useState<
    Set<ScenarioResourceType>
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

  // AI-generated pending suggestions state - stores AI suggestions before user accepts/rejects
  // Uses server-generated types for full resource objects
  const [aiFormData, setAiFormData] = useState<{
    name_resource?: ScenarioGenerationCompletePayload["name_resource"];
    description_resource?: ScenarioGenerationCompletePayload["description_resource"];
    problem_statement_resource?: ScenarioGenerationCompletePayload["problem_statement_resource"];
    department_resources?: ScenarioGenerationCompletePayload["department_resources"];
    persona_resources?: ScenarioGenerationCompletePayload["persona_resources"];
    document_resources?: ScenarioGenerationCompletePayload["document_resources"];
    template_resources?: ScenarioGenerationCompletePayload["template_resources"];
    objective_resources?: ScenarioGenerationCompletePayload["objective_resources"];
    question_resources?: ScenarioGenerationCompletePayload["question_resources"];
    image_resources?: ScenarioGenerationCompletePayload["image_resources"];
    video_resources?: ScenarioGenerationCompletePayload["video_resources"];
    parameter_resources?: ScenarioGenerationCompletePayload["parameter_resources"];
    parameter_field_resources?: ScenarioGenerationCompletePayload["parameter_field_resources"];
    // Flags use a different structure for AI suggestions (id + key)
    flag_resources?: Array<{ id?: string | null; key?: string | null }>;
  }>({});

  // Clear a pending AI resource suggestion
  // Note: We explicitly set to undefined instead of using delete to ensure
  // React properly detects the state change and triggers re-renders
  const clearAiResource = useCallback((key: keyof typeof aiFormData) => {
    setAiFormData((prev) => ({
      ...prev,
      [key]: undefined,
    }));
  }, []);

  const isGenerating = useCallback(
    (resourceType: ScenarioResourceType) =>
      generatingResources.has(resourceType),
    [generatingResources]
  );

  // Type for flush results - each resource returns its created ID(s)
  type FlushResult = {
    name_id?: string | null;
    description_id?: string | null;
    problem_statement_id?: string | null;
    objective_ids?: string[];
    template_ids?: string[];
    image_ids?: string[];
    video_ids?: string[];
    question_ids?: string[];
    parameter_field_ids?: string[];
  };

  // Registry of flush callbacks from creatable resource components
  const flushRegistryRef = useRef<
    Map<string, () => Promise<FlushResult | void>>
  >(new Map());

  // Create stable registerFlush callback
  const createRegisterFlush = useCallback((key: string) => {
    return (flush: () => Promise<FlushResult | void>) => {
      flushRegistryRef.current.set(key, flush);
    };
  }, []);

  // Memoize registerFlush callbacks to prevent re-renders
  const registerFlushCallbacks = useMemo(
    () => ({
      names: createRegisterFlush("names"),
      descriptions: createRegisterFlush("descriptions"),
      problem_statements: createRegisterFlush("problem_statements"),
      objectives: createRegisterFlush("objectives"),
      templates: createRegisterFlush("templates"),
      images: createRegisterFlush("images"),
      videos: createRegisterFlush("videos"),
      questions: createRegisterFlush("questions"),
      parameter_fields: createRegisterFlush("parameter_fields"),
    }),
    [createRegisterFlush]
  );

  // Set breadcrumb context when scenario data is loaded in edit mode
  useEffect(() => {
    const scenarioName = scenarioData?.name_resource?.name;
    if (scenarioName && scenarioId && isEditMode) {
      setEntityMetadata({
        entityId: scenarioId,
        entityName: scenarioName,
        entityType: "scenario",
      });
    }
    return () => clearEntityMetadata();
  }, [
    scenarioData?.name_resource?.name,
    scenarioId,
    isEditMode,
    setEntityMetadata,
    clearEntityMetadata,
  ]);

  // nuqs parsers for URL-backed state (search/filter params only)
  const scenarioSearchParamsClient = useMemo(
    () => ({
      draftId: parseAsString,
      personaSearch: parseAsString,
      documentSearch: parseAsString,
      parameterSearch: parseAsString,
      descriptionSearch: parseAsString,
      problemStatementSearch: parseAsString,
      templateSearch: parseAsString,
      imageSearch: parseAsString,
      videoSearch: parseAsString,
      personaShowSelected: parseAsBoolean,
      documentShowSelected: parseAsBoolean,
      parameterShowSelected: parseAsBoolean,
    }),
    []
  );

  const [draftId, setDraftId] = useState<string | null>(null);
  const setUrlFormDataRef = useRef<
    null | ((updates: Record<string, unknown>) => void)
  >(null);
  const formDataRef = useRef<Record<string, unknown>>({});

  // Track last synced draftId to prevent redundant profile context updates
  const lastSyncedDraftIdRef = useRef<string | null>(null);

  const onFormDataChange = useCallback(
    (fd: Record<string, unknown>) => {
      formDataRef.current = fd;
      const nextDraftId = (fd["draftId"] as string | undefined) ?? null;
      setDraftId((prev) => (prev === nextDraftId ? prev : nextDraftId));

      // One-way sync to profile context (no effect dependency on selectedDraftId)
      if (nextDraftId !== lastSyncedDraftIdRef.current) {
        lastSyncedDraftIdRef.current = nextDraftId;
        setSelectedDraftId(nextDraftId);
      }
    },
    [setSelectedDraftId]
  );

  const getInitialFormState = useCallback((): ScenarioFormState => {
    if (!scenarioData) {
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
        use_templates_flag_id: null,
        department_ids: [],
        persona_ids: [],
        document_ids: [],
        template_ids: [],
        parameter_ids: [],
        parameter_field_ids: [],
        image_ids: [],
        objective_ids: [],
        video_ids: [],
        question_ids: [],
      };
    }

    return {
      name_id: scenarioData.name_id ?? null,
      description_id: scenarioData.description_id ?? null,
      problem_statement_id: scenarioData.problem_statement_id ?? null,
      active_flag_id: scenarioData.active_flag_id ?? null,
      objectives_enabled_flag_id:
        scenarioData.objectives_enabled_flag_id ?? null,
      images_enabled_flag_id: scenarioData.images_enabled_flag_id ?? null,
      video_enabled_flag_id: scenarioData.video_enabled_flag_id ?? null,
      questions_enabled_flag_id: scenarioData.questions_enabled_flag_id ?? null,
      problem_statement_enabled_flag_id:
        scenarioData.problem_statement_enabled_flag_id ?? null,
      use_templates_flag_id: scenarioData.use_templates_flag_id ?? null,
      department_ids: (scenarioData.department_ids ?? []).map(String),
      persona_ids: (scenarioData.persona_ids ?? []).map(String),
      document_ids: (scenarioData.document_ids ?? []).map(String),
      template_ids: (scenarioData.template_ids ?? []).map(String),
      parameter_ids: (scenarioData.parameter_ids ?? []).map(String),
      parameter_field_ids: (scenarioData.parameter_field_ids ?? []).map(String),
      image_ids: (scenarioData.image_ids ?? []).map(String),
      objective_ids: (scenarioData.objective_ids ?? []).map(String),
      video_ids: (scenarioData.video_ids ?? []).map(String),
      question_ids: (scenarioData.question_ids ?? []).map(String),
    };
  }, [scenarioData]);

  const [formState, setFormState] =
    useState<ScenarioFormState>(getInitialFormState);

  // Ref to store formState for stable access in callbacks
  const formStateRef = useRef(formState);
  useEffect(() => {
    formStateRef.current = formState;
  }, [formState]);

  // Ref to track scenarioData for conditional parameter toggle
  const scenarioDataRef = useRef(scenarioData);
  useEffect(() => {
    scenarioDataRef.current = scenarioData;
  }, [scenarioData]);

  // Track if a change came from server sync (to skip triggering autosave)
  const serverSyncPendingRef = useRef(false);

  const departmentIdsStr = useMemo(
    () => JSON.stringify(formState.department_ids),
    [formState.department_ids]
  );
  const personaIdsStr = useMemo(
    () => JSON.stringify(formState.persona_ids),
    [formState.persona_ids]
  );
  const documentIdsStr = useMemo(
    () => JSON.stringify(formState.document_ids),
    [formState.document_ids]
  );
  const templateIdsStr = useMemo(
    () => JSON.stringify(formState.template_ids),
    [formState.template_ids]
  );
  const parameterIdsStr = useMemo(
    () => JSON.stringify(formState.parameter_ids),
    [formState.parameter_ids]
  );
  const parameterFieldIdsStr = useMemo(
    () => JSON.stringify(formState.parameter_field_ids),
    [formState.parameter_field_ids]
  );
  const imageIdsStr = useMemo(
    () => JSON.stringify(formState.image_ids),
    [formState.image_ids]
  );
  const objectiveIdsStr = useMemo(
    () => JSON.stringify(formState.objective_ids),
    [formState.objective_ids]
  );
  const videoIdsStr = useMemo(
    () => JSON.stringify(formState.video_ids),
    [formState.video_ids]
  );
  const questionIdsStr = useMemo(
    () => JSON.stringify(formState.question_ids),
    [formState.question_ids]
  );

  // Memoized stringified scenarioData array IDs for useEffect dependency
  const scenarioDepartmentIdsStr = useMemo(
    () => JSON.stringify(scenarioData?.department_ids),
    [scenarioData?.department_ids]
  );
  const scenarioPersonaIdsStr = useMemo(
    () => JSON.stringify(scenarioData?.persona_ids),
    [scenarioData?.persona_ids]
  );
  const scenarioDocumentIdsStr = useMemo(
    () => JSON.stringify(scenarioData?.document_ids),
    [scenarioData?.document_ids]
  );
  const scenarioTemplateIdsStr = useMemo(
    () => JSON.stringify(scenarioData?.template_ids),
    [scenarioData?.template_ids]
  );
  const scenarioParameterIdsStr = useMemo(
    () => JSON.stringify(scenarioData?.parameter_ids),
    [scenarioData?.parameter_ids]
  );
  const scenarioParameterFieldIdsStr = useMemo(
    () => JSON.stringify(scenarioData?.parameter_field_ids),
    [scenarioData?.parameter_field_ids]
  );
  const scenarioImageIdsStr = useMemo(
    () => JSON.stringify(scenarioData?.image_ids),
    [scenarioData?.image_ids]
  );
  const scenarioObjectiveIdsStr = useMemo(
    () => JSON.stringify(scenarioData?.objective_ids),
    [scenarioData?.objective_ids]
  );
  const scenarioVideoIdsStr = useMemo(
    () => JSON.stringify(scenarioData?.video_ids),
    [scenarioData?.video_ids]
  );
  const scenarioQuestionIdsStr = useMemo(
    () => JSON.stringify(scenarioData?.question_ids),
    [scenarioData?.question_ids]
  );

  useEffect(() => {
    const newState = getInitialFormState();
    setFormState((prev) => {
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
        prev.use_templates_flag_id !== newState.use_templates_flag_id ||
        JSON.stringify(prev.department_ids) !==
          JSON.stringify(newState.department_ids) ||
        JSON.stringify(prev.persona_ids) !==
          JSON.stringify(newState.persona_ids) ||
        JSON.stringify(prev.document_ids) !==
          JSON.stringify(newState.document_ids) ||
        JSON.stringify(prev.template_ids) !==
          JSON.stringify(newState.template_ids) ||
        JSON.stringify(prev.parameter_ids) !==
          JSON.stringify(newState.parameter_ids) ||
        JSON.stringify(prev.parameter_field_ids) !==
          JSON.stringify(newState.parameter_field_ids) ||
        JSON.stringify(prev.image_ids) !== JSON.stringify(newState.image_ids) ||
        JSON.stringify(prev.objective_ids) !==
          JSON.stringify(newState.objective_ids) ||
        JSON.stringify(prev.video_ids) !== JSON.stringify(newState.video_ids) ||
        JSON.stringify(prev.question_ids) !==
          JSON.stringify(newState.question_ids)
      ) {
        return newState;
      }
      return prev;
    });
    // Use individual scenarioData fields in dependencies to prevent effect from running when unrelated fields change
    // Intentionally exclude formState and getInitialFormState to prevent infinite loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    scenarioData?.use_templates_flag_id,
    scenarioDepartmentIdsStr,
    scenarioPersonaIdsStr,
    scenarioDocumentIdsStr,
    scenarioTemplateIdsStr,
    scenarioParameterIdsStr,
    scenarioParameterFieldIdsStr,
    scenarioImageIdsStr,
    scenarioObjectiveIdsStr,
    scenarioVideoIdsStr,
    scenarioQuestionIdsStr,
  ]);

  // Draft version tracking for optimistic concurrency control
  const [lastSavedVersion, setLastSavedVersion] = useState(0);
  const lastSavedVersionRef = useRef(0);
  useEffect(() => {
    lastSavedVersionRef.current = lastSavedVersion;
  }, [lastSavedVersion]);
  // Sync draft_version from server to avoid unintended draft forks.
  const draftVersion =
    scenarioData && "draft_version" in scenarioData
      ? (scenarioData as { draft_version?: number | null }).draft_version
      : null;
  // Track if version has been synced from server to prevent patching before sync
  const versionSyncedRef = useRef(false);
  useEffect(() => {
    if (
      typeof draftVersion === "number" &&
      draftVersion !== lastSavedVersionRef.current
    ) {
      setLastSavedVersion(draftVersion);
      lastSavedVersionRef.current = draftVersion;
    }
    versionSyncedRef.current = true; // Mark as synced
  }, [draftVersion]);

  const patchScenarioDraftActionRef = useRef(patchScenarioDraftAction);
  useEffect(() => {
    patchScenarioDraftActionRef.current = patchScenarioDraftAction;
  }, [patchScenarioDraftAction]);

  // Array dependencies use stringified versions to detect changes correctly
  const draftPatchKey = useMemo(
    () =>
      JSON.stringify({
        draftId: draftId || null,
        name_id: formState.name_id,
        description_id: formState.description_id,
        problem_statement_id: formState.problem_statement_id,
        active_flag_id: formState.active_flag_id,
        objectives_enabled_flag_id: formState.objectives_enabled_flag_id,
        images_enabled_flag_id: formState.images_enabled_flag_id,
        video_enabled_flag_id: formState.video_enabled_flag_id,
        questions_enabled_flag_id: formState.questions_enabled_flag_id,
        problem_statement_enabled_flag_id:
          formState.problem_statement_enabled_flag_id,
        use_templates_flag_id: formState.use_templates_flag_id,
        department_ids: departmentIdsStr,
        persona_ids: personaIdsStr,
        document_ids: documentIdsStr,
        template_document_ids: templateIdsStr,
        parameter_ids: parameterIdsStr,
        field_ids: parameterFieldIdsStr,
        image_ids: imageIdsStr,
        objective_ids: objectiveIdsStr,
        video_ids: videoIdsStr,
        question_ids: questionIdsStr,
      }),
    [
      draftId,
      formState.name_id,
      formState.description_id,
      formState.problem_statement_id,
      formState.active_flag_id,
      formState.objectives_enabled_flag_id,
      formState.images_enabled_flag_id,
      formState.video_enabled_flag_id,
      formState.questions_enabled_flag_id,
      formState.problem_statement_enabled_flag_id,
      formState.use_templates_flag_id,
      departmentIdsStr,
      personaIdsStr,
      documentIdsStr,
      templateIdsStr,
      parameterIdsStr,
      parameterFieldIdsStr,
      imageIdsStr,
      objectiveIdsStr,
      videoIdsStr,
      questionIdsStr,
    ]
  );

  const lastPatchedKeyRef = useRef<string | null>(null);
  const isFirstPatchRef = useRef(true);

  // Track if there are pending changes for beforeunload warning
  const hasPendingChangesRef = useRef(false);

  // Draft change listener - watches resource IDs and patches draft
  // Only triggers when the payload actually changes, not when version changes
  useEffect(() => {
    const hasResourceIds =
      formState.name_id ||
      formState.description_id ||
      formState.problem_statement_id ||
      formState.active_flag_id ||
      formState.objectives_enabled_flag_id ||
      formState.images_enabled_flag_id ||
      formState.video_enabled_flag_id ||
      formState.questions_enabled_flag_id ||
      formState.problem_statement_enabled_flag_id ||
      formState.use_templates_flag_id ||
      formState.department_ids.length > 0 ||
      formState.persona_ids.length > 0 ||
      formState.document_ids.length > 0 ||
      formState.template_ids.length > 0 ||
      formState.parameter_ids.length > 0 ||
      formState.parameter_field_ids.length > 0 ||
      formState.image_ids.length > 0 ||
      formState.objective_ids.length > 0 ||
      formState.video_ids.length > 0 ||
      formState.question_ids.length > 0;

    if (!hasResourceIds || !patchScenarioDraftActionRef.current) {
      return;
    }

    // Wait for version sync before patching to prevent race conditions
    if (!versionSyncedRef.current && lastSavedVersionRef.current !== 0) {
      return;
    }

    // Skip the first effect run - treat initial server state as the baseline
    // This prevents creating an unwanted draft on page load when server returns pre-populated IDs
    if (isFirstPatchRef.current) {
      isFirstPatchRef.current = false;
      lastPatchedKeyRef.current = draftPatchKey;
      return;
    }

    // If this change came from server sync, reset baseline instead of triggering save
    if (serverSyncPendingRef.current) {
      serverSyncPendingRef.current = false;
      lastPatchedKeyRef.current = draftPatchKey;
      return;
    }

    // ✅ If nothing changed since the last successful patch, do nothing.
    if (lastPatchedKeyRef.current === draftPatchKey) {
      return;
    }

    // Mark that we have pending changes (for beforeunload warning)
    hasPendingChangesRef.current = true;

    // Skip autosave if disabled (manual save mode)
    if (!isAutosaveEnabled) {
      return;
    }

    // Immediately show "Saving draft..." when autosave is enabled
    window.dispatchEvent(
      new CustomEvent("save-status-change", { detail: { status: "saving" } })
    );

    const timer = setTimeout(async () => {
      try {
        if (!patchScenarioDraftActionRef.current) return;

        const result = await patchScenarioDraftActionRef.current({
          body: {
            input_draft_id: draftId || null,
            name_id: formState.name_id,
            description_id: formState.description_id,
            problem_statement_id: formState.problem_statement_id,
            active_flag_id: formState.active_flag_id,
            objectives_enabled_flag_id: formState.objectives_enabled_flag_id,
            images_enabled_flag_id: formState.images_enabled_flag_id,
            video_enabled_flag_id: formState.video_enabled_flag_id,
            questions_enabled_flag_id: formState.questions_enabled_flag_id,
            problem_statement_enabled_flag_id:
              formState.problem_statement_enabled_flag_id,
            use_templates_flag_id: formState.use_templates_flag_id,
            department_ids: formState.department_ids,
            persona_ids: formState.persona_ids,
            document_ids: formState.document_ids,
            template_document_ids: formState.template_ids,
            parameter_ids: formState.parameter_ids,
            parameter_field_ids: formState.parameter_field_ids,
            image_ids: formState.image_ids,
            objective_ids: formState.objective_ids,
            video_ids: formState.video_ids,
            question_ids: formState.question_ids,
            expected_version: lastSavedVersionRef.current,
          },
        });

        // Mark this payload as patched so we don't loop
        lastPatchedKeyRef.current = draftPatchKey;

        if (!draftId && result.draft_id) {
          // Update URL when draft is created via GenericForm bridge (GenericForm owns URL state)
          toast.success("Draft created", {
            description: "Your changes are being auto-saved",
          });
          setUrlFormDataRef.current?.({ draftId: result.draft_id });
        } else if (result.draft_id && result.draft_id !== draftId) {
          // Sync URL to server-returned draft_id to avoid stale draft mismatch
          setUrlFormDataRef.current?.({ draftId: result.draft_id });
        }

        if ((result.new_version ?? 0) !== lastSavedVersionRef.current) {
          setLastSavedVersion(result.new_version ?? 0);
          lastSavedVersionRef.current = result.new_version ?? 0;
        }

        // Clear pending changes flag after successful save
        hasPendingChangesRef.current = false;

        // Notify save context that save completed and changes are saved
        window.dispatchEvent(
          new CustomEvent("save-status-change", { detail: { status: "idle" } })
        );
        window.dispatchEvent(
          new CustomEvent("unsaved-changes", { detail: { hasChanges: false } })
        );
      } catch {
        toast.error("Failed to save draft", {
          description:
            "Your changes may not have been saved. Please try again.",
        });
        window.dispatchEvent(
          new CustomEvent("save-status-change", { detail: { status: "error" } })
        );
      }
    }, 1000);

    return () => clearTimeout(timer);
    // ✅ Trigger only when payload changes, not when version changes
    // patchScenarioDraftAction is accessed via ref to prevent effect recreation
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    draftPatchKey, // ✅ trigger only when payload changes
    isAutosaveEnabled, // ✅ re-check when autosave mode changes
    // patchScenarioDraftAction is accessed via ref
  ]);

  // Warn users about unsaved changes when navigating away
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasPendingChangesRef.current) {
        e.preventDefault();
        e.returnValue = "You have unsaved changes.";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  // Emit unsaved-changes event when draftPatchKey changes
  useEffect(() => {
    // During server sync, report no changes (baseline will be reset by autosave effect)
    if (serverSyncPendingRef.current) {
      window.dispatchEvent(
        new CustomEvent("unsaved-changes", { detail: { hasChanges: false } })
      );
      return;
    }
    // Only report changes after we've established a baseline (ref is not null)
    const hasChanges =
      lastPatchedKeyRef.current !== null &&
      lastPatchedKeyRef.current !== draftPatchKey;
    window.dispatchEvent(
      new CustomEvent("unsaved-changes", { detail: { hasChanges } })
    );
  }, [draftPatchKey]);

  // Flush all resources without saving to draft - returns the created IDs
  // Used by handleSubmit when autosave is off to get IDs before final save
  const flushAllResources = useCallback(async (): Promise<FlushResult> => {
    const flushPromises = Array.from(flushRegistryRef.current.values()).map(
      (flush) => flush()
    );
    const flushResults = await Promise.all(flushPromises);

    // Merge all flush results into a single object (filter out void results)
    const mergedFlushResults = flushResults.reduce<FlushResult>(
      (acc, result) => (result ? { ...acc, ...result } : acc),
      {}
    );

    return mergedFlushResults;
  }, []);

  // Flush all resources and patch draft (for manual save via Save toolbar)
  const flushAllAndSave = useCallback(async () => {
    const startTime = Date.now();
    const MIN_SAVING_DURATION = 1000; // Show "Saving..." for at least 1 second on manual save

    window.dispatchEvent(
      new CustomEvent("save-status-change", { detail: { status: "saving" } })
    );

    try {
      // 1. Flush all creatable resource components and collect returned IDs
      const flushPromises = Array.from(flushRegistryRef.current.values()).map(
        (flush) => flush()
      );
      const flushResults = await Promise.all(flushPromises);

      // 2. Merge all flush results into a single object (filter out void results)
      const mergedFlushResults = flushResults.reduce<FlushResult>(
        (acc, result) => (result ? { ...acc, ...result } : acc),
        {}
      );

      // 3. Patch draft with all resource IDs - use flush results with fallback to current formState
      let isNewDraft = false;
      if (patchScenarioDraftActionRef.current) {
        const currentFormState = formStateRef.current;
        const result = await patchScenarioDraftActionRef.current({
          body: {
            input_draft_id: draftId || null,
            // Use flush results (fresh) with fallback to formState (for non-flushed resources)
            name_id:
              mergedFlushResults.name_id !== undefined
                ? mergedFlushResults.name_id
                : currentFormState.name_id,
            description_id:
              mergedFlushResults.description_id !== undefined
                ? mergedFlushResults.description_id
                : currentFormState.description_id,
            problem_statement_id:
              mergedFlushResults.problem_statement_id !== undefined
                ? mergedFlushResults.problem_statement_id
                : currentFormState.problem_statement_id,
            active_flag_id: currentFormState.active_flag_id,
            objectives_enabled_flag_id:
              currentFormState.objectives_enabled_flag_id,
            images_enabled_flag_id: currentFormState.images_enabled_flag_id,
            video_enabled_flag_id: currentFormState.video_enabled_flag_id,
            questions_enabled_flag_id:
              currentFormState.questions_enabled_flag_id,
            problem_statement_enabled_flag_id:
              currentFormState.problem_statement_enabled_flag_id,
            use_templates_flag_id: currentFormState.use_templates_flag_id,
            department_ids: currentFormState.department_ids,
            persona_ids: currentFormState.persona_ids,
            document_ids: currentFormState.document_ids,
            template_document_ids:
              mergedFlushResults.template_ids !== undefined
                ? mergedFlushResults.template_ids
                : currentFormState.template_ids,
            parameter_ids: currentFormState.parameter_ids,
            parameter_field_ids:
              mergedFlushResults.parameter_field_ids !== undefined
                ? mergedFlushResults.parameter_field_ids
                : currentFormState.parameter_field_ids,
            image_ids:
              mergedFlushResults.image_ids !== undefined
                ? mergedFlushResults.image_ids
                : currentFormState.image_ids,
            objective_ids:
              mergedFlushResults.objective_ids !== undefined
                ? mergedFlushResults.objective_ids
                : currentFormState.objective_ids,
            video_ids:
              mergedFlushResults.video_ids !== undefined
                ? mergedFlushResults.video_ids
                : currentFormState.video_ids,
            question_ids:
              mergedFlushResults.question_ids !== undefined
                ? mergedFlushResults.question_ids
                : currentFormState.question_ids,
            expected_version: lastSavedVersionRef.current,
          },
        });

        // Update refs
        lastPatchedKeyRef.current = draftPatchKey;
        if (result.new_version !== undefined && result.new_version !== null) {
          lastSavedVersionRef.current = result.new_version;
          setLastSavedVersion(result.new_version);
        }

        // Update URL if draft was created
        if (!draftId && result.draft_id) {
          setUrlFormDataRef.current?.({ draftId: result.draft_id });
          isNewDraft = true;
        }
      }

      // Ensure minimum display duration for manual save
      const elapsed = Date.now() - startTime;
      if (elapsed < MIN_SAVING_DURATION) {
        await new Promise((resolve) =>
          setTimeout(resolve, MIN_SAVING_DURATION - elapsed)
        );
      }

      window.dispatchEvent(
        new CustomEvent("save-status-change", { detail: { status: "idle" } })
      );
      window.dispatchEvent(
        new CustomEvent("unsaved-changes", { detail: { hasChanges: false } })
      );

      hasPendingChangesRef.current = false;

      // Show success toast for manual save
      toast.success(isNewDraft ? "Draft created" : "Draft saved");
    } catch {
      window.dispatchEvent(
        new CustomEvent("save-status-change", { detail: { status: "error" } })
      );
      toast.error("Failed to save draft");
    }
  }, [draftId, draftPatchKey]);

  // Listen for save trigger from layout
  useEffect(() => {
    const handleTriggerSave = () => flushAllAndSave();
    window.addEventListener("trigger-save", handleTriggerSave);
    return () => window.removeEventListener("trigger-save", handleTriggerSave);
  }, [flushAllAndSave]);

  const stableScenarioDataFields = useMemo(() => {
    if (!scenarioData) return null;
    return {
      group_id: scenarioData.group_id,
      name_resource: scenarioData.name_resource,
      show_name: scenarioData.show_name,
      name_suggestions: scenarioData.name_suggestions,
      names: scenarioData.names,
      name_required: scenarioData.name_required,
      name_agent_id: scenarioData.name_agent_id,
      description_resource: scenarioData.description_resource,
      show_description: scenarioData.show_description,
      description_suggestions: scenarioData.description_suggestions,
      description_required: scenarioData.description_required,
      description_agent_id: scenarioData.description_agent_id,
      descriptions: scenarioData.descriptions,
      problem_statement_resource: scenarioData.problem_statement_resource,
      show_problem_statement: scenarioData.show_problem_statement,
      problem_statement_suggestions: scenarioData.problem_statement_suggestions,
      problem_statement_required: scenarioData.problem_statement_required,
      problem_statement_agent_id: scenarioData.problem_statement_agent_id,
      problem_statements: scenarioData.problem_statements,
      objective_resources: scenarioData.objective_resources,
      show_objectives: scenarioData.show_objectives,
      objectives_agent_id: scenarioData.objectives_agent_id,
      objectives_required: scenarioData.objectives_required,
      objective_suggestions: scenarioData.objective_suggestions,
      objectives: scenarioData.objectives,
      // Server-driven flags array with master visibility
      flags: scenarioData.flags,
      show_flags: scenarioData.show_flags,
      department_resources: scenarioData.department_resources,
      show_departments: scenarioData.show_departments,
      departments_agent_id: scenarioData.departments_agent_id,
      departments_required: scenarioData.departments_required,
      department_suggestions: scenarioData.department_suggestions,
      departments: scenarioData.departments,
      persona_resources: scenarioData.persona_resources,
      show_personas: scenarioData.show_personas,
      personas_agent_id: scenarioData.personas_agent_id,
      personas_required: scenarioData.personas_required,
      persona_suggestions: scenarioData.persona_suggestions,
      personas: scenarioData.personas,
      document_resources: scenarioData.document_resources,
      show_documents: scenarioData.show_documents,
      documents_agent_id: scenarioData.documents_agent_id,
      documents_required: scenarioData.documents_required,
      document_suggestions: scenarioData.document_suggestions,
      documents: scenarioData.documents,
      template_resources: scenarioData.template_resources,
      show_templates: scenarioData.show_templates,
      templates_agent_id: scenarioData.templates_agent_id,
      templates_required: scenarioData.templates_required,
      template_suggestions: scenarioData.template_suggestions,
      templates: scenarioData.templates,
      parameter_resources: scenarioData.parameter_resources,
      show_parameters: scenarioData.show_parameters,
      parameters_agent_id: scenarioData.parameters_agent_id,
      parameters_required: scenarioData.parameters_required,
      parameter_suggestions: scenarioData.parameter_suggestions,
      parameters: scenarioData.parameters,
      parameter_field_resources: scenarioData.parameter_field_resources,
      show_parameter_fields: scenarioData.show_parameter_fields,
      parameter_fields_agent_id: scenarioData.parameter_fields_agent_id,
      parameter_fields_required: scenarioData.parameter_fields_required,
      parameter_fields: scenarioData.parameter_fields,
      image_resources: scenarioData.image_resources,
      show_images: scenarioData.show_images,
      images_agent_id: scenarioData.images_agent_id,
      images_required: scenarioData.images_required,
      image_suggestions: scenarioData.image_suggestions,
      images: scenarioData.images,
      video_resources: scenarioData.video_resources,
      show_videos: scenarioData.show_videos,
      videos_agent_id: scenarioData.videos_agent_id,
      videos_required: scenarioData.videos_required,
      video_suggestions: scenarioData.video_suggestions,
      videos: scenarioData.videos,
      question_resources: scenarioData.question_resources,
      show_questions: scenarioData.show_questions,
      questions_agent_id: scenarioData.questions_agent_id,
      questions_required: scenarioData.questions_required,
      question_suggestions: scenarioData.question_suggestions,
      questions: scenarioData.questions,
      can_edit: scenarioData.can_edit,
      disabled_reason: scenarioData.disabled_reason,
      basic_agent_id: scenarioData.basic_agent_id,
      content_agent_id: scenarioData.content_agent_id,
    };
  }, [scenarioData]);

  const flagsEnabled = useMemo(
    () => ({
      problemStatement: !!formState.problem_statement_enabled_flag_id,
      objectives: !!formState.objectives_enabled_flag_id,
      images: !!formState.images_enabled_flag_id,
      videos: !!formState.video_enabled_flag_id,
      questions: !!formState.questions_enabled_flag_id,
      templates: !!formState.use_templates_flag_id,
    }),
    [
      formState.problem_statement_enabled_flag_id,
      formState.objectives_enabled_flag_id,
      formState.images_enabled_flag_id,
      formState.video_enabled_flag_id,
      formState.questions_enabled_flag_id,
      formState.use_templates_flag_id,
    ]
  );

  const showProblemStatementSection = flagsEnabled.problemStatement;
  const showObjectivesSection = flagsEnabled.objectives;
  const showImagesSection = flagsEnabled.images;
  const showVideosSection = flagsEnabled.videos;
  const showQuestionsSection = flagsEnabled.questions;
  const showTemplatesSection = flagsEnabled.templates;

  // Whether video mode is enabled - used for filtering personas/documents/parameters
  const videoEnabled = !!formState.video_enabled_flag_id;

  const canRegenerate = useCallback(
    (resourceType: ScenarioResourceType): boolean => {
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
            stableScenarioDataFields.flags?.some((f) => f.generated) ?? false
          );
        case "departments":
          return (
            stableScenarioDataFields.department_resources?.some(
              (d) => d.generated
            ) ?? false
          );
        case "personas":
          // ScenarioPersona doesn't have generated field in API
          return false;
        case "documents":
          // ScenarioDocument doesn't have generated field in API
          return false;
        case "templates":
          return (
            stableScenarioDataFields.template_resources?.some(
              (t) => t.generated
            ) ?? false
          );
        case "parameters":
          // ScenarioParameter doesn't have generated field in API
          return false;
        case "parameter_fields":
          return (
            stableScenarioDataFields.parameter_field_resources?.some(
              (f) => f.generated
            ) ?? false
          );
        case "images":
          return (
            stableScenarioDataFields.image_resources?.some(
              (i) => i.generated
            ) ?? false
          );
        case "videos":
          return (
            stableScenarioDataFields.video_resources?.some(
              (v) => v.generated
            ) ?? false
          );
        case "questions":
          return (
            stableScenarioDataFields.question_resources?.some(
              (q) => q.generated
            ) ?? false
          );
        default:
          return false;
      }
    },
    [stableScenarioDataFields]
  );

  const disabled = useMemo(() => {
    if (!scenarioData) return false;
    return !scenarioData.can_edit;
  }, [scenarioData]);

  useEffect(() => {
    if (!socket || !isConnected) return;

    const currentGroupId = scenarioData?.group_id;

    const handleGenerationComplete = (
      data: ScenarioGenerationCompletePayload
    ) => {
      if (
        data.artifact_type !== "scenario" ||
        !data.group_id ||
        data.group_id !== currentGroupId
      ) {
        return;
      }

      const validResourceTypes: ScenarioResourceType[] = [
        "names",
        "descriptions",
        "problem_statements",
        "objectives",
        "scenario_flags",
        "departments",
        "personas",
        "documents",
        "templates",
        "parameters",
        "parameter_fields",
        "images",
        "videos",
        "questions",
      ];

      if (
        data.resource_type &&
        validResourceTypes.includes(data.resource_type as ScenarioResourceType)
      ) {
        // Store full resources in aiFormData for diff view workflow
        setAiFormData((prev) => {
          const updates: Partial<typeof prev> = {};
          if (data.name_resource) updates.name_resource = data.name_resource;
          if (data.description_resource)
            updates.description_resource = data.description_resource;
          if (data.problem_statement_resource)
            updates.problem_statement_resource = data.problem_statement_resource;
          if (data.department_resources)
            updates.department_resources = data.department_resources;
          if (data.persona_resources)
            updates.persona_resources = data.persona_resources;
          if (data.document_resources)
            updates.document_resources = data.document_resources;
          if (data.template_resources)
            updates.template_resources = data.template_resources;
          if (data.objective_resources)
            updates.objective_resources = data.objective_resources;
          if (data.question_resources)
            updates.question_resources = data.question_resources;
          if (data.image_resources)
            updates.image_resources = data.image_resources;
          if (data.video_resources)
            updates.video_resources = data.video_resources;
          if (data.parameter_resources)
            updates.parameter_resources = data.parameter_resources;
          if (data.parameter_field_resources)
            updates.parameter_field_resources = data.parameter_field_resources;
          return { ...prev, ...updates };
        });

        // Only auto-accept name_resource (names are auto-applied without user confirmation)
        if (data.name_resource?.id) {
          setFormState((prev) => ({
            ...prev,
            name_id: String(data.name_resource!.id),
          }));
        }

        setGeneratingResources((prev) => {
          const next = new Set(prev);
          next.delete(data.resource_type as ScenarioResourceType);
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
      if (
        data.artifact_type !== "scenario" ||
        !data.group_id ||
        data.group_id !== currentGroupId
      ) {
        return;
      }
    };

    const handleGenerationError = (data: {
      artifact_type?: string;
      group_id?: string;
      message?: string;
      resource_type?: string;
      resource_types?: string[];
    }) => {
      if (
        data.artifact_type !== "scenario" ||
        !data.group_id ||
        data.group_id !== currentGroupId
      ) {
        return;
      }

      const resourceTypes =
        data.resource_types || (data.resource_type ? [data.resource_type] : []);

      setGeneratingResources((prev) => {
        const next = new Set(prev);
        resourceTypes.forEach((rt) => {
          next.delete(rt as ScenarioResourceType);
        });
        return next;
      });

      toast.error(data.message || "Generation failed");
    };

    socket.on("scenario_generation_progress", handleGenerationProgress);
    socket.on("scenario_generation_complete", handleGenerationComplete);
    socket.on("scenario_generation_error", handleGenerationError);

    return () => {
      socket.off("scenario_generation_progress", handleGenerationProgress);
      socket.off("scenario_generation_complete", handleGenerationComplete);
      socket.off("scenario_generation_error", handleGenerationError);
    };
  }, [socket, isConnected, scenarioData?.group_id]);

  const determineAgentType = useCallback(
    (resourceTypes: ScenarioResourceType[]): string | null => {
      const basicResources: ScenarioResourceType[] = [
        "names",
        "descriptions",
        "scenario_flags",
        "departments",
      ];
      const contentResources: ScenarioResourceType[] = [
        "problem_statements",
        "objectives",
        "images",
        "videos",
        "questions",
        "templates",
      ];

      const isBasicCombo =
        resourceTypes.length === basicResources.length &&
        resourceTypes.every((rt) => basicResources.includes(rt));
      const isContentCombo =
        resourceTypes.length === contentResources.length &&
        resourceTypes.every((rt) => contentResources.includes(rt));

      if (isBasicCombo) {
        return "basic";
      }
      if (isContentCombo) {
        return "content";
      }

      if (resourceTypes.length === 1) {
        const agentTypeMap: Partial<Record<ScenarioResourceType, string>> = {
          names: "name",
          descriptions: "description",
          problem_statements: "content",
          objectives: "content",
          images: "content",
          videos: "content",
          questions: "content",
          templates: "content",
        };
        const firstType = resourceTypes[0];
        if (firstType && firstType in agentTypeMap) {
          return agentTypeMap[firstType] ?? null;
        }
      }

      return "general";
    },
    []
  );

  const handleGenerateResources = useCallback(
    async (
      resourceTypes: ScenarioResourceType[],
      agentType: string | null,
      userInstructions?: string
    ) => {
      if (!socket || !isConnected) {
        toast.error("WebSocket not connected");
        return;
      }

      setGeneratingResources((prev) => {
        const next = new Set(prev);
        resourceTypes.forEach((rt) => next.add(rt));
        return next;
      });

      const formData = formDataRef.current;
      const draftIdValue = (formData["draftId"] as string | undefined) ?? null;
      const personaSearch =
        (formData["personaSearch"] as string | undefined) ?? null;
      const documentSearch =
        (formData["documentSearch"] as string | undefined) ?? null;
      const parameterSearch =
        (formData["parameterSearch"] as string | undefined) ?? null;
      const personaShowSelected =
        (formData["personaShowSelected"] as boolean | undefined) ?? false;
      const documentShowSelected =
        (formData["documentShowSelected"] as boolean | undefined) ?? false;
      const parameterShowSelected =
        (formData["parameterShowSelected"] as boolean | undefined) ?? false;

      socket.emit("scenario_generate", {
        resource_types: resourceTypes,
        agent_type: agentType,
        user_instructions: userInstructions ? [userInstructions] : null,
        scenario_id: scenarioId || null,
        use_image: !!formState.images_enabled_flag_id,
        use_objectives: !!formState.objectives_enabled_flag_id,
        use_video: !!formState.video_enabled_flag_id,
        document_ids: formState.document_ids.length
          ? formState.document_ids
          : null,
        problem_statement_ids: formState.problem_statement_id
          ? [formState.problem_statement_id]
          : null,
        template_document_ids: formState.template_ids.length
          ? formState.template_ids
          : null,
        filter_department_ids: formState.department_ids.length
          ? formState.department_ids
          : null,
        filter_persona_ids: formState.persona_ids.length
          ? formState.persona_ids
          : null,
        filter_document_ids: formState.document_ids.length
          ? formState.document_ids
          : null,
        filter_parameter_ids: formState.parameter_ids.length
          ? formState.parameter_ids
          : null,
        persona_search: personaSearch,
        document_search: documentSearch,
        parameter_search: parameterSearch,
        persona_show_selected: personaShowSelected,
        document_show_selected: documentShowSelected,
        parameter_show_selected: parameterShowSelected,
        draft_id: draftIdValue,
        mcp: false,
      });
    },
    [
      socket,
      isConnected,
      scenarioId,
      formState.images_enabled_flag_id,
      formState.objectives_enabled_flag_id,
      formState.video_enabled_flag_id,
      formState.document_ids,
      formState.problem_statement_id,
      formState.template_ids,
      formState.department_ids,
      formState.persona_ids,
      formState.parameter_ids,
    ]
  );

  const handleGenerateName = useCallback(
    async () =>
      handleGenerateResources(["names"], determineAgentType(["names"])),
    [handleGenerateResources, determineAgentType]
  );

  const handleGenerateDescription = useCallback(
    async () =>
      handleGenerateResources(
        ["descriptions"],
        determineAgentType(["descriptions"])
      ),
    [handleGenerateResources, determineAgentType]
  );

  const handleGenerateProblemStatements = useCallback(
    async () =>
      handleGenerateResources(
        ["problem_statements"],
        determineAgentType(["problem_statements"])
      ),
    [handleGenerateResources, determineAgentType]
  );

  const handleGenerateObjectives = useCallback(
    async () =>
      handleGenerateResources(
        ["objectives"],
        determineAgentType(["objectives"])
      ),
    [handleGenerateResources, determineAgentType]
  );

  const handleGenerateDepartments = useCallback(
    async () =>
      handleGenerateResources(
        ["departments"],
        determineAgentType(["departments"])
      ),
    [handleGenerateResources, determineAgentType]
  );

  const handleGeneratePersonas = useCallback(
    async () =>
      handleGenerateResources(["personas"], determineAgentType(["personas"])),
    [handleGenerateResources, determineAgentType]
  );

  const handleGenerateDocuments = useCallback(
    async () =>
      handleGenerateResources(["documents"], determineAgentType(["documents"])),
    [handleGenerateResources, determineAgentType]
  );

  const handleGenerateTemplates = useCallback(
    async () =>
      handleGenerateResources(["templates"], determineAgentType(["templates"])),
    [handleGenerateResources, determineAgentType]
  );

  const handleGenerateParameters = useCallback(
    async () =>
      handleGenerateResources(
        ["parameters"],
        determineAgentType(["parameters"])
      ),
    [handleGenerateResources, determineAgentType]
  );

  const handleGenerateImages = useCallback(
    async () =>
      handleGenerateResources(["images"], determineAgentType(["images"])),
    [handleGenerateResources, determineAgentType]
  );

  const handleGenerateVideos = useCallback(
    async () =>
      handleGenerateResources(["videos"], determineAgentType(["videos"])),
    [handleGenerateResources, determineAgentType]
  );

  const handleGenerateQuestions = useCallback(
    async () =>
      handleGenerateResources(["questions"], determineAgentType(["questions"])),
    [handleGenerateResources, determineAgentType]
  );

  const handleGenerateFlags = useCallback(
    async () =>
      handleGenerateResources(
        ["scenario_flags"],
        determineAgentType(["scenario_flags"])
      ),
    [handleGenerateResources, determineAgentType]
  );

  // Handle toggling conditional parameters on/off when parameter fields are selected/deselected
  // This supports transitive chains: when a field's conditional parameter is deselected,
  // we also deselect any conditional parameters that were triggered by that parameter's fields
  const handleConditionalParameterToggle = useCallback(
    (conditionalParameterId: string, selected: boolean) => {
      setFormState((prev) => {
        if (selected) {
          // Auto-add conditional parameter if not present
          if (!prev.parameter_ids.includes(conditionalParameterId)) {
            return {
              ...prev,
              parameter_ids: [...prev.parameter_ids, conditionalParameterId],
            };
          }
        } else {
          // Auto-remove conditional parameter and handle chain cleanup
          // Build a set of parameters to remove (starts with the one being deselected)
          const toRemove = new Set<string>([conditionalParameterId]);

          // Get all available fields from scenarioData to find chain dependencies
          const allFields = scenarioDataRef.current?.parameter_fields ?? [];

          // Recursively find conditional params that should also be removed
          // (parameters whose trigger fields belong to parameters being removed)
          let changed = true;
          while (changed) {
            changed = false;
            for (const field of allFields) {
              // If this field belongs to a parameter we're removing
              // and it has conditional_parameter_ids
              if (
                field.parameter_id &&
                toRemove.has(field.parameter_id) &&
                field.conditional_parameter_ids?.length
              ) {
                for (const condParamId of field.conditional_parameter_ids) {
                  if (condParamId && !toRemove.has(condParamId)) {
                    toRemove.add(condParamId);
                    changed = true;
                  }
                }
              }
            }
          }

          // Also find fields that should be deselected (fields of removed parameters)
          const fieldsToRemove = new Set<string>();
          for (const field of allFields) {
            if (
              field.parameter_id &&
              toRemove.has(field.parameter_id) &&
              field.field_id
            ) {
              fieldsToRemove.add(field.field_id);
            }
          }

          return {
            ...prev,
            parameter_ids: prev.parameter_ids.filter((id) => !toRemove.has(id)),
            parameter_field_ids: prev.parameter_field_ids.filter(
              (id) => !fieldsToRemove.has(id)
            ),
          };
        }
        return prev;
      });
    },
    []
  );

  const stepResources: Record<string, ScenarioResourceType[]> = useMemo(
    () => ({
      basic: ["names", "descriptions", "scenario_flags", "departments"],
      problem_statement: ["problem_statements"],
      objectives: ["objectives"],
      personas: ["personas"],
      documents: ["documents"],
      templates: ["templates"],
      parameters: ["parameters", "parameter_fields"],
      images: ["images"],
      videos: ["videos"],
      questions: ["questions"],
      all: [
        "names",
        "descriptions",
        "problem_statements",
        "objectives",
        "scenario_flags",
        "departments",
        "personas",
        "documents",
        "templates",
        "parameters",
        "parameter_fields",
        "images",
        "videos",
        "questions",
      ],
    }),
    []
  );

  const resourceLabels: Record<ScenarioResourceType, string> = useMemo(
    () => ({
      names: "Names",
      descriptions: "Descriptions",
      problem_statements: "Problem Statements",
      objectives: "Objectives",
      scenario_flags: "Flags",
      departments: "Departments",
      personas: "Personas",
      documents: "Documents",
      templates: "Templates",
      parameters: "Parameters",
      parameter_fields: "Parameter Fields",
      images: "Images",
      videos: "Videos",
      questions: "Questions",
    }),
    []
  );

  const handleOpenStepCardModal = useCallback(
    (stepId: string, mode: "generate" | "regenerate") => {
      const resourceTypes = stepResources[stepId] || [];
      const resources: GenerateRegenerateModalResource[] = resourceTypes.map(
        (rt) => ({
          id: rt,
          label: resourceLabels[rt] ?? "",
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

  const handleModalGenerate = useCallback(
    async (selectedResources: string[], instructions: string) => {
      const resourceTypes = selectedResources as ScenarioResourceType[];
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

  // Listen for full-page-generate event from layout
  useEffect(() => {
    const handleFullPageGenerate = (
      event: CustomEvent<{ agentId?: string }>
    ) => {
      const agentId = event.detail?.agentId;
      if (agentId) {
        handleOpenStepCardModal("all", "generate");
      }
    };
    window.addEventListener(
      "full-page-generate",
      handleFullPageGenerate as EventListener
    );
    return () =>
      window.removeEventListener(
        "full-page-generate",
        handleFullPageGenerate as EventListener
      );
  }, [handleOpenStepCardModal]);

  const steps = useMemo(() => {
    const items = [
      {
        id: "basic",
        title: "Basic Information",
        description:
          "Set the scenario name, description, departments, and configuration options.",
        resetFields: [
          "name",
          "description",
          "departments",
          "descriptionSearch",
        ],
      },
    ];

    if (showProblemStatementSection) {
      items.push({
        id: "problem_statement",
        title: "Problem Statement",
        description: "Define the core problem statement for the scenario.",
        resetFields: ["problem_statement", "problemStatementSearch"],
      });
    }

    if (showObjectivesSection) {
      items.push({
        id: "objectives",
        title: "Objectives",
        description: "Define learning objectives for the scenario.",
        resetFields: ["objectives"],
      });
    }

    if (stableScenarioDataFields?.show_personas) {
      items.push({
        id: "personas",
        title: "Personas",
        description: "Select personas for the scenario.",
        resetFields: ["personas", "personaSearch", "personaShowSelected"],
      });
    }

    if (stableScenarioDataFields?.show_documents) {
      items.push({
        id: "documents",
        title: "Documents",
        description: "Select documents for the scenario.",
        resetFields: ["documents", "documentSearch", "documentShowSelected"],
      });
    }

    if (showTemplatesSection) {
      items.push({
        id: "templates",
        title: "Templates",
        description: "Select templates for the scenario.",
        resetFields: ["templates", "templateSearch"],
      });
    }

    if (stableScenarioDataFields?.show_parameters) {
      items.push({
        id: "parameters",
        title: "Parameters",
        description: "Select parameters for the scenario.",
        resetFields: ["parameters", "parameterSearch", "parameterShowSelected"],
      });
    }

    if (showImagesSection) {
      items.push({
        id: "images",
        title: "Images",
        description: "Select images for the scenario.",
        resetFields: ["images"],
      });
    }

    if (showVideosSection) {
      items.push({
        id: "videos",
        title: "Videos",
        description: "Select videos for the scenario.",
        resetFields: ["videos"],
      });
    }

    if (showQuestionsSection) {
      items.push({
        id: "questions",
        title: "Questions",
        description: "Select questions for the scenario.",
        resetFields: ["questions"],
      });
    }

    return items;
  }, [
    showProblemStatementSection,
    showObjectivesSection,
    stableScenarioDataFields?.show_personas,
    stableScenarioDataFields?.show_documents,
    showTemplatesSection,
    stableScenarioDataFields?.show_parameters,
    showImagesSection,
    showVideosSection,
    showQuestionsSection,
  ]);

  const formFieldKeys = useMemo(
    () => [
      "draftId",
      "personaSearch",
      "documentSearch",
      "parameterSearch",
      "personaShowSelected",
      "documentShowSelected",
      "parameterShowSelected",
    ],
    []
  );

  const submitButton = useMemo(
    () => ({
      backUrl: "/training/scenarios",
      backLabel: "Back",
      createLabel: "Save Scenario",
      updateLabel: "Save Scenario",
    }),
    []
  );

  const resetSuccessMessage = useCallback((stepId: string) => {
    switch (stepId) {
      case "basic":
        return "Basic information reset";
      case "problem_statement":
        return "Problem statement reset";
      case "objectives":
        return "Objectives reset";
      case "personas":
        return "Personas reset";
      case "documents":
        return "Documents reset";
      case "templates":
        return "Templates reset";
      case "parameters":
        return "Parameters reset";
      case "images":
        return "Images reset";
      case "videos":
        return "Videos reset";
      case "questions":
        return "Questions reset";
      default:
        return "Reset";
    }
  }, []);

  const handleReset = useCallback((stepId: string) => {
    setFormState((prev) => {
      switch (stepId) {
        case "basic":
          return {
            ...prev,
            name_id: null,
            description_id: null,
            active_flag_id: null,
            department_ids: [],
            objectives_enabled_flag_id: null,
            images_enabled_flag_id: null,
            video_enabled_flag_id: null,
            questions_enabled_flag_id: null,
            problem_statement_enabled_flag_id: null,
            use_templates_flag_id: null,
          };
        case "problem_statement":
          return {
            ...prev,
            problem_statement_id: null,
          };
        case "objectives":
          return {
            ...prev,
            objective_ids: [],
          };
        case "personas":
          return {
            ...prev,
            persona_ids: [],
          };
        case "documents":
          return {
            ...prev,
            document_ids: [],
          };
        case "templates":
          return {
            ...prev,
            template_ids: [],
          };
        case "parameters":
          return {
            ...prev,
            parameter_ids: [],
            parameter_field_ids: [],
          };
        case "images":
          return {
            ...prev,
            image_ids: [],
          };
        case "videos":
          return {
            ...prev,
            video_ids: [],
          };
        case "questions":
          return {
            ...prev,
            question_ids: [],
          };
        default:
          return prev;
      }
    });
  }, []);

  const handleSubmit = useCallback(
    async (_formData: Record<string, unknown>) => {
      if (scenarioData?.name_required && !formState.name_id) {
        toast.error("Scenario name is required");
        throw new Error("Scenario name is required");
      }

      if (scenarioData?.description_required && !formState.description_id) {
        toast.error("Scenario description is required");
        throw new Error("Scenario description is required");
      }

      if (
        scenarioData?.problem_statement_required &&
        !formState.problem_statement_id
      ) {
        toast.error("Problem statement is required");
        throw new Error("Problem statement is required");
      }

      if (
        scenarioData?.objectives_required &&
        formState.objective_ids.length === 0
      ) {
        toast.error("Objectives are required");
        throw new Error("Objectives are required");
      }

      if (
        scenarioData?.departments_required &&
        formState.department_ids.length === 0
      ) {
        toast.error("Departments are required");
        throw new Error("Departments are required");
      }

      if (
        scenarioData?.personas_required &&
        formState.persona_ids.length === 0
      ) {
        toast.error("Personas are required");
        throw new Error("Personas are required");
      }

      if (
        scenarioData?.documents_required &&
        formState.document_ids.length === 0
      ) {
        toast.error("Documents are required");
        throw new Error("Documents are required");
      }

      if (
        scenarioData?.templates_required &&
        formState.template_ids.length === 0
      ) {
        toast.error("Templates are required");
        throw new Error("Templates are required");
      }

      if (
        scenarioData?.parameters_required &&
        formState.parameter_ids.length === 0
      ) {
        toast.error("Parameters are required");
        throw new Error("Parameters are required");
      }

      if (scenarioData?.images_required && formState.image_ids.length === 0) {
        toast.error("Images are required");
        throw new Error("Images are required");
      }

      if (scenarioData?.videos_required && formState.video_ids.length === 0) {
        toast.error("Videos are required");
        throw new Error("Videos are required");
      }

      if (
        scenarioData?.questions_required &&
        formState.question_ids.length === 0
      ) {
        toast.error("Questions are required");
        throw new Error("Questions are required");
      }

      if (!profile?.id) {
        toast.error("Profile not loaded. Please refresh the page.");
        throw new Error("Profile not loaded");
      }

      if (!saveScenarioAction) {
        toast.error("Save action not available");
        throw new Error("Save action not available");
      }

      if (!scenarioData?.group_id) {
        toast.error("Group not found. Please try again.");
        throw new Error("Group ID is required for save");
      }

      if (!formState.name_id) {
        toast.error("Scenario name is required");
        throw new Error("Scenario name is required");
      }

      // When autosave is disabled, flush all resources first to create them
      // This gets the IDs directly without saving to draft
      let flushResults: FlushResult = {};
      if (!isAutosaveEnabled) {
        flushResults = await flushAllResources();
      }

      // Get the current form state and merge with flush results
      // Flush results take precedence (they're freshly created)
      const baseFormState = formStateRef.current;
      const effectiveFormState = {
        ...baseFormState,
        name_id:
          flushResults.name_id !== undefined
            ? flushResults.name_id
            : baseFormState.name_id,
        description_id:
          flushResults.description_id !== undefined
            ? flushResults.description_id
            : baseFormState.description_id,
        problem_statement_id:
          flushResults.problem_statement_id !== undefined
            ? flushResults.problem_statement_id
            : baseFormState.problem_statement_id,
        parameter_field_ids:
          flushResults.parameter_field_ids !== undefined
            ? flushResults.parameter_field_ids
            : baseFormState.parameter_field_ids,
      };

      try {
        await saveScenarioAction({
          body: {
            // Context
            group_id: scenarioData.group_id,
            input_scenario_id: isEditMode && scenarioId ? scenarioId : null,

            // Required single-select
            name_id: effectiveFormState.name_id!,

            // Optional single-select (use null instead of undefined for exactOptionalPropertyTypes)
            description_id: effectiveFormState.description_id ?? null,
            problem_statement_id:
              effectiveFormState.problem_statement_id ?? null,
            active_flag_id: effectiveFormState.active_flag_id ?? null,
            objectives_enabled_flag_id:
              effectiveFormState.objectives_enabled_flag_id ?? null,
            images_enabled_flag_id:
              effectiveFormState.images_enabled_flag_id ?? null,
            video_enabled_flag_id:
              effectiveFormState.video_enabled_flag_id ?? null,
            questions_enabled_flag_id:
              effectiveFormState.questions_enabled_flag_id ?? null,
            problem_statement_enabled_flag_id:
              effectiveFormState.problem_statement_enabled_flag_id ?? null,
            use_templates_flag_id:
              effectiveFormState.use_templates_flag_id ?? null,

            // Optional multi-select (use null instead of undefined for exactOptionalPropertyTypes)
            department_ids:
              effectiveFormState.department_ids.length > 0
                ? effectiveFormState.department_ids
                : null,
            persona_ids:
              effectiveFormState.persona_ids.length > 0
                ? effectiveFormState.persona_ids
                : null,
            document_ids:
              effectiveFormState.document_ids.length > 0
                ? effectiveFormState.document_ids
                : null,
            template_document_ids:
              effectiveFormState.template_ids.length > 0
                ? effectiveFormState.template_ids
                : null,
            parameter_ids:
              effectiveFormState.parameter_ids.length > 0
                ? effectiveFormState.parameter_ids
                : null,
            parameter_field_ids:
              effectiveFormState.parameter_field_ids.length > 0
                ? effectiveFormState.parameter_field_ids
                : null,
            image_ids:
              effectiveFormState.image_ids.length > 0
                ? effectiveFormState.image_ids
                : null,
            objective_ids:
              effectiveFormState.objective_ids.length > 0
                ? effectiveFormState.objective_ids
                : null,
            video_ids:
              effectiveFormState.video_ids.length > 0
                ? effectiveFormState.video_ids
                : null,
            question_ids:
              effectiveFormState.question_ids.length > 0
                ? effectiveFormState.question_ids
                : null,
          },
        });

        toast.success(
          `Scenario ${isEditMode ? "updated" : "created"} successfully!`
        );
        router.push("/training/scenarios");
      } catch (error) {
        toast.error(
          `Failed to ${isEditMode ? "update" : "create"} scenario: ${error instanceof Error ? error.message : "Unknown error"}`
        );
        throw error;
      }
    },
    [
      formState,
      scenarioData?.name_required,
      scenarioData?.description_required,
      scenarioData?.problem_statement_required,
      scenarioData?.objectives_required,
      scenarioData?.departments_required,
      scenarioData?.personas_required,
      scenarioData?.documents_required,
      scenarioData?.templates_required,
      scenarioData?.parameters_required,
      scenarioData?.images_required,
      scenarioData?.videos_required,
      scenarioData?.questions_required,
      scenarioData?.group_id,
      profile?.id,
      saveScenarioAction,
      isEditMode,
      scenarioId,
      router,
      isAutosaveEnabled,
      flushAllResources,
    ]
  );

  const getStepStatus = useCallback(
    (stepId: string, _formData: Record<string, unknown>): StepStatus => {
      const hasName = !!formState.name_id;
      const hasDescription = !!formState.description_id;
      const hasDepartments = formState.department_ids.length > 0;
      const hasProblemStatement = !!formState.problem_statement_id;
      const hasObjectives = formState.objective_ids.length > 0;
      switch (stepId) {
        case "basic":
          return hasName && hasDescription && hasDepartments
            ? "completed"
            : "active";
        case "problem_statement":
          if (!hasName || !hasDescription) return "pending";
          return hasProblemStatement ? "completed" : "active";
        case "objectives":
          if (!hasName || !hasDescription) return "pending";
          return hasObjectives ? "completed" : "active";
        case "personas":
          if (!hasName || !hasDescription) return "pending";
          return formState.persona_ids.length > 0 ? "completed" : "active";
        case "documents":
          if (!hasName || !hasDescription) return "pending";
          return formState.document_ids.length > 0 ? "completed" : "active";
        case "templates":
          if (!hasName || !hasDescription) return "pending";
          return formState.template_ids.length > 0 ? "completed" : "active";
        case "parameters":
          if (!hasName || !hasDescription) return "pending";
          return formState.parameter_ids.length > 0 ? "completed" : "active";
        case "images":
          if (!hasName || !hasDescription) return "pending";
          return formState.image_ids.length > 0 ? "completed" : "active";
        case "videos":
          if (!hasName || !hasDescription) return "pending";
          return formState.video_ids.length > 0 ? "completed" : "active";
        case "questions":
          if (!hasName || !hasDescription) return "pending";
          return formState.question_ids.length > 0 ? "completed" : "active";
        default:
          return "pending";
      }
    },
    [formState]
  );

  const renderStep = useCallback(
    ({
      stepId,
      stepTitle,
      stepDescription,
      stepNumber,
      stepStatus,
      isOptional: _isOptional,
      formData,
      setFormData,
      filters,
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
      const currentScenarioData = stableScenarioDataFields;
      const personaSearch =
        (formData["personaSearch"] as string | undefined) ?? "";
      const documentSearch =
        (formData["documentSearch"] as string | undefined) ?? "";
      const parameterSearch =
        (formData["parameterSearch"] as string | undefined) ?? "";
      const descriptionSearch =
        (formData["descriptionSearch"] as string | undefined) ?? "";
      const problemStatementSearch =
        (formData["problemStatementSearch"] as string | undefined) ?? "";
      const templateSearch =
        (formData["templateSearch"] as string | undefined) ?? "";
      const personaShowSelected =
        (formData["personaShowSelected"] as boolean | undefined) ?? false;
      const documentShowSelected =
        (formData["documentShowSelected"] as boolean | undefined) ?? false;
      const parameterShowSelected =
        (formData["parameterShowSelected"] as boolean | undefined) ?? false;

      const shouldShowGenerateAction = (
        stepKey: string,
        agentId?: string | null
      ) =>
        stepResources[stepKey] && stepResources[stepKey].length > 0 && agentId;
      const resetProps = onReset ? { onReset, resetLabel: "Reset" } : {};

      switch (stepId) {
        case "basic":
          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={disabled}
              isEditMode={isEditMode}
              customHeader={
                <Names
                  name_id={formState.name_id ?? null}
                  name_resource={currentScenarioData?.name_resource ?? null}
                  show_name={currentScenarioData?.show_name ?? true}
                  name_suggestions={currentScenarioData?.name_suggestions ?? []}
                  names={currentScenarioData?.names ?? []}
                  disabled={disabled}
                  onNameIdChange={(nameId) =>
                    setFormState((prev) => ({ ...prev, name_id: nameId }))
                  }
                  onGenerate={handleGenerateName}
                  isGenerating={isGenerating("names")}
                  placeholder="e.g., Customer Support Escalation"
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
                  aiResource={aiFormData.name_resource ?? null}
                  onAccept={() => clearAiResource("name_resource")}
                  onReject={() => clearAiResource("name_resource")}
                />
              }
              resetFields={["name", "description", "departments"]}
              actions={
                shouldShowGenerateAction(
                  "basic",
                  currentScenarioData?.basic_agent_id
                ) ? (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            handleOpenStepCardModal("basic", "generate")
                          }
                          disabled={disabled}
                        >
                          <Sparkles className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Generate</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ) : null
              }
              {...resetProps}
            >
              <div className="space-y-4">
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
                  searchTerm={descriptionSearch}
                  onSearchChange={(term: string) =>
                    setFormData({ descriptionSearch: term || null })
                  }
                  disabled={disabled}
                  onDescriptionIdChange={(descriptionId) =>
                    setFormState((prev) => ({
                      ...prev,
                      description_id: descriptionId,
                    }))
                  }
                  onGenerate={handleGenerateDescription}
                  isGenerating={isGenerating("descriptions")}
                  label="Description"
                  placeholder="Describe the scenario"
                  required={currentScenarioData?.description_required ?? false}
                  group_id={currentScenarioData?.group_id ?? null}
                  agent_id={currentScenarioData?.description_agent_id ?? null}
                  createDescriptionsAction={
                    createDescriptionsAction as
                      | ((
                          input: CreateDraftDescriptionsIn
                        ) => Promise<CreateDraftDescriptionsOut>)
                      | undefined
                  }
                  aiResource={aiFormData.description_resource}
                  onAccept={() => clearAiResource("description_resource")}
                  onReject={() => clearAiResource("description_resource")}
                />

                <Departments
                  department_ids={formState.department_ids}
                  department_resources={
                    currentScenarioData?.department_resources ?? []
                  }
                  show_departments={
                    currentScenarioData?.show_departments ?? false
                  }
                  department_suggestions={
                    currentScenarioData?.department_suggestions ?? []
                  }
                  departments={currentScenarioData?.departments ?? []}
                  disabled={disabled}
                  onChange={(ids) =>
                    setFormState((prev) => ({ ...prev, department_ids: ids }))
                  }
                  label="Departments"
                  required={currentScenarioData?.departments_required ?? false}
                  group_id={currentScenarioData?.group_id ?? null}
                  agent_id={currentScenarioData?.departments_agent_id ?? null}
                  onGenerate={handleGenerateDepartments}
                  isGenerating={isGenerating("departments")}
                  aiDepartmentResources={aiFormData.department_resources ?? null}
                  onAccept={() => clearAiResource("department_resources")}
                  onReject={() => clearAiResource("department_resources")}
                />

                {/* Server-driven Flags - single component for all flags */}
                {/* Filter out video_flag flags when video is not enabled */}
                <Flags
                  flags={(currentScenarioData?.flags ?? []).filter(
                    (f) => !f.video_flag || videoEnabled
                  )}
                  flag_ids={{
                    active: formState.active_flag_id ?? null,
                    video_enabled: formState.video_enabled_flag_id ?? null,
                    problem_statement_enabled:
                      formState.problem_statement_enabled_flag_id ?? null,
                    objectives_enabled:
                      formState.objectives_enabled_flag_id ?? null,
                    images_enabled: formState.images_enabled_flag_id ?? null,
                    use_templates: formState.use_templates_flag_id ?? null,
                    questions_enabled:
                      formState.questions_enabled_flag_id ?? null,
                  }}
                  show_flags={currentScenarioData?.show_flags ?? false}
                  columns={2}
                  label="Flags"
                  disabled={disabled}
                  onChange={(key: string, flagId: string | null) => {
                    const fieldMap: Record<string, string> = {
                      active: "active_flag_id",
                      video_enabled: "video_enabled_flag_id",
                      problem_statement_enabled:
                        "problem_statement_enabled_flag_id",
                      objectives_enabled: "objectives_enabled_flag_id",
                      images_enabled: "images_enabled_flag_id",
                      use_templates: "use_templates_flag_id",
                      questions_enabled: "questions_enabled_flag_id",
                    };
                    const field = fieldMap[key];
                    if (field) {
                      setFormState((prev) => ({ ...prev, [field]: flagId }));
                    }
                  }}
                  onGenerate={handleGenerateFlags}
                  isGenerating={isGenerating("scenario_flags")}
                  aiFlagResources={aiFormData.flag_resources ?? null}
                  onAccept={() => clearAiResource("flag_resources")}
                  onReject={() => clearAiResource("flag_resources")}
                />
              </div>
            </StepCard>
          );
        case "problem_statement":
          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={disabled}
              isEditMode={isEditMode}
              resetFields={["problem_statement"]}
              actions={
                shouldShowGenerateAction(
                  "problem_statement",
                  currentScenarioData?.content_agent_id
                ) ? (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            handleOpenStepCardModal(
                              "problem_statement",
                              "generate"
                            )
                          }
                          disabled={disabled}
                        >
                          <Sparkles className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Generate</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ) : null
              }
              {...resetProps}
            >
              <ProblemStatements
                problem_statement_id={formState.problem_statement_id ?? null}
                problem_statement_resource={
                  currentScenarioData?.problem_statement_resource ?? null
                }
                show_problem_statement={showProblemStatementSection}
                problem_statement_suggestions={
                  currentScenarioData?.problem_statement_suggestions ?? []
                }
                problem_statements={
                  currentScenarioData?.problem_statements ?? []
                }
                disabled={disabled}
                onProblemStatementIdChange={(problemStatementId) =>
                  setFormState((prev) => ({
                    ...prev,
                    problem_statement_id: problemStatementId,
                  }))
                }
                onGenerate={handleGenerateProblemStatements}
                isGenerating={isGenerating("problem_statements")}
                label="Problem Statement"
                placeholder="Define the core problem"
                required={
                  currentScenarioData?.problem_statement_required ?? false
                }
                group_id={currentScenarioData?.group_id ?? null}
                agent_id={
                  currentScenarioData?.problem_statement_agent_id ?? null
                }
                searchTerm={problemStatementSearch}
                onSearchChange={(term: string) =>
                  setFormData({ problemStatementSearch: term || null })
                }
                createProblemStatementsAction={
                  createProblemStatementsAction as
                    | ((
                        input: CreateDraftProblemStatementsIn
                      ) => Promise<CreateDraftProblemStatementsOut>)
                    | undefined
                }
                aiResource={aiFormData.problem_statement_resource}
                onAccept={() => clearAiResource("problem_statement_resource")}
                onReject={() => clearAiResource("problem_statement_resource")}
              />
            </StepCard>
          );
        case "objectives":
          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={disabled}
              isEditMode={isEditMode}
              resetFields={["objectives"]}
              actions={
                shouldShowGenerateAction(
                  "objectives",
                  currentScenarioData?.content_agent_id
                ) ? (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            handleOpenStepCardModal("objectives", "generate")
                          }
                          disabled={disabled}
                        >
                          <Sparkles className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Generate</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ) : null
              }
              {...resetProps}
            >
              <Objectives
                objective_ids={formState.objective_ids}
                objective_resources={
                  currentScenarioData?.objective_resources ?? []
                }
                show_objectives={showObjectivesSection}
                objectives_agent_id={
                  currentScenarioData?.objectives_agent_id ?? null
                }
                objectives_required={
                  currentScenarioData?.objectives_required ?? false
                }
                objective_suggestions={
                  currentScenarioData?.objective_suggestions ?? []
                }
                objectives={currentScenarioData?.objectives ?? []}
                disabled={disabled}
                onChange={(ids) =>
                  setFormState((prev) => ({ ...prev, objective_ids: ids }))
                }
                group_id={currentScenarioData?.group_id ?? null}
                agent_id={currentScenarioData?.objectives_agent_id ?? null}
                createObjectivesAction={
                  createObjectivesAction as
                    | ((
                        input: CreateDraftObjectivesIn
                      ) => Promise<CreateDraftObjectivesOut>)
                    | undefined
                }
                onGenerate={handleGenerateObjectives}
                isGenerating={isGenerating("objectives")}
                isAutosaveEnabled={isAutosaveEnabled}
                registerFlush={registerFlushCallbacks.objectives}
                aiObjectiveResources={aiFormData.objective_resources ?? null}
                onAccept={() => clearAiResource("objective_resources")}
                onReject={() => clearAiResource("objective_resources")}
              />
            </StepCard>
          );
        case "personas":
          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={disabled}
              isEditMode={isEditMode}
              searchTerm={personaSearch}
              onSearchChange={(value) =>
                setFormData({ personaSearch: value || null })
              }
              resetFields={["personas"]}
              filters={
                filters ?? [
                  {
                    key: "personaShowSelected",
                    label: "Show selected only",
                    value: personaShowSelected,
                    onChange: (value) =>
                      setFormData({ personaShowSelected: value }),
                  },
                ]
              }
              actions={
                shouldShowGenerateAction(
                  "personas",
                  currentScenarioData?.personas_agent_id
                ) ? (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            handleOpenStepCardModal("personas", "generate")
                          }
                          disabled={disabled}
                        >
                          <Sparkles className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Generate</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ) : null
              }
              {...resetProps}
            >
              <div className="space-y-6">
                <Personas
                  persona_ids={formState.persona_ids}
                  persona_resources={
                    currentScenarioData?.persona_resources ?? []
                  }
                  show_personas={currentScenarioData?.show_personas ?? false}
                  persona_suggestions={
                    currentScenarioData?.persona_suggestions ?? []
                  }
                  personas={currentScenarioData?.personas ?? []}
                  disabled={disabled}
                  onChange={(ids) =>
                    setFormState((prev) => ({ ...prev, persona_ids: ids }))
                  }
                  group_id={currentScenarioData?.group_id ?? null}
                  personas_agent_id={
                    currentScenarioData?.personas_agent_id ?? null
                  }
                  required={currentScenarioData?.personas_required ?? false}
                  onGenerate={handleGeneratePersonas}
                  isGenerating={isGenerating("personas")}
                  videoEnabled={videoEnabled}
                  aiPersonaResources={aiFormData.persona_resources ?? null}
                  onAccept={() => clearAiResource("persona_resources")}
                  onReject={() => clearAiResource("persona_resources")}
                />
              </div>
            </StepCard>
          );
        case "documents":
          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={disabled}
              isEditMode={isEditMode}
              searchTerm={documentSearch}
              onSearchChange={(value) =>
                setFormData({ documentSearch: value || null })
              }
              resetFields={["documents"]}
              filters={
                filters ?? [
                  {
                    key: "documentShowSelected",
                    label: "Show selected only",
                    value: documentShowSelected,
                    onChange: (value) =>
                      setFormData({ documentShowSelected: value }),
                  },
                ]
              }
              actions={
                shouldShowGenerateAction(
                  "documents",
                  currentScenarioData?.documents_agent_id
                ) ? (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            handleOpenStepCardModal("documents", "generate")
                          }
                          disabled={disabled}
                        >
                          <Sparkles className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Generate</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ) : null
              }
              {...resetProps}
            >
              <div className="space-y-6">
                <Documents
                  document_ids={formState.document_ids}
                  document_resources={
                    currentScenarioData?.document_resources ?? []
                  }
                  show_documents={currentScenarioData?.show_documents ?? false}
                  document_suggestions={
                    currentScenarioData?.document_suggestions ?? []
                  }
                  documents={currentScenarioData?.documents ?? []}
                  disabled={disabled}
                  onChange={(ids) =>
                    setFormState((prev) => ({ ...prev, document_ids: ids }))
                  }
                  group_id={currentScenarioData?.group_id ?? null}
                  documents_agent_id={
                    currentScenarioData?.documents_agent_id ?? null
                  }
                  required={currentScenarioData?.documents_required ?? false}
                  onGenerate={handleGenerateDocuments}
                  isGenerating={isGenerating("documents")}
                  videoEnabled={videoEnabled}
                  aiDocumentResources={aiFormData.document_resources ?? null}
                  onAccept={() => clearAiResource("document_resources")}
                  onReject={() => clearAiResource("document_resources")}
                />
              </div>
            </StepCard>
          );
        case "templates":
          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={disabled}
              isEditMode={isEditMode}
              searchTerm={templateSearch}
              onSearchChange={(term: string) =>
                setFormData({ templateSearch: term || null })
              }
              searchPlaceholder="Search templates..."
              debounceMs={300}
              resetFields={["templates"]}
              actions={
                shouldShowGenerateAction(
                  "templates",
                  currentScenarioData?.content_agent_id
                ) ? (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            handleOpenStepCardModal("templates", "generate")
                          }
                          disabled={disabled}
                        >
                          <Sparkles className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Generate</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ) : null
              }
              {...resetProps}
            >
              <Templates
                template_ids={formState.template_ids}
                template_resources={
                  currentScenarioData?.template_resources ?? []
                }
                show_templates={showTemplatesSection}
                template_suggestions={
                  currentScenarioData?.template_suggestions ?? []
                }
                templates={currentScenarioData?.templates ?? []}
                searchTerm={templateSearch}
                disabled={disabled}
                onChange={(ids) =>
                  setFormState((prev) => ({ ...prev, template_ids: ids }))
                }
                group_id={currentScenarioData?.group_id ?? null}
                templates_agent_id={
                  currentScenarioData?.templates_agent_id ?? null
                }
                required={currentScenarioData?.templates_required ?? false}
                createTemplatesAction={
                  createTemplatesAction as
                    | ((
                        input: CreateDraftTemplatesIn
                      ) => Promise<CreateDraftTemplatesOut>)
                    | undefined
                }
                onGenerate={handleGenerateTemplates}
                isGenerating={isGenerating("templates")}
                isAutosaveEnabled={isAutosaveEnabled}
                registerFlush={registerFlushCallbacks.templates}
                aiTemplateResources={aiFormData.template_resources ?? null}
                onAccept={() => clearAiResource("template_resources")}
                onReject={() => clearAiResource("template_resources")}
              />
            </StepCard>
          );
        case "parameters":
          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={disabled}
              isEditMode={isEditMode}
              searchTerm={parameterSearch}
              onSearchChange={(value) =>
                setFormData({ parameterSearch: value || null })
              }
              searchPlaceholder="Search parameters..."
              resetFields={["parameters"]}
              filters={
                filters ?? [
                  {
                    key: "parameterShowSelected",
                    label: "Show selected only",
                    value: parameterShowSelected,
                    onChange: (value) =>
                      setFormData({ parameterShowSelected: value }),
                  },
                ]
              }
              actions={
                shouldShowGenerateAction(
                  "parameters",
                  currentScenarioData?.parameters_agent_id
                ) ? (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            handleOpenStepCardModal("parameters", "generate")
                          }
                          disabled={disabled}
                        >
                          <Sparkles className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Generate</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ) : null
              }
              {...resetProps}
            >
              <div className="space-y-6">
                <Parameters
                  parameter_ids={formState.parameter_ids}
                  parameter_resources={
                    currentScenarioData?.parameter_resources ?? []
                  }
                  show_parameters={
                    currentScenarioData?.show_parameters ?? false
                  }
                  parameter_suggestions={
                    currentScenarioData?.parameter_suggestions ?? []
                  }
                  parameters={currentScenarioData?.parameters ?? []}
                  searchTerm={parameterSearch}
                  showSelectedFilter={parameterShowSelected}
                  disabled={disabled}
                  onChange={(ids) =>
                    setFormState((prev) => ({ ...prev, parameter_ids: ids }))
                  }
                  group_id={currentScenarioData?.group_id ?? null}
                  agent_id={currentScenarioData?.parameters_agent_id ?? null}
                  required={currentScenarioData?.parameters_required ?? false}
                  onGenerate={handleGenerateParameters}
                  isGenerating={isGenerating("parameters")}
                  videoEnabled={videoEnabled}
                  aiParameterResources={aiFormData.parameter_resources ?? null}
                  onAccept={() => clearAiResource("parameter_resources")}
                  onReject={() => clearAiResource("parameter_resources")}
                />
                <ParameterFields
                  parameter_field_ids={formState.parameter_field_ids}
                  parameter_field_resources={
                    currentScenarioData?.parameter_field_resources ?? []
                  }
                  show_parameter_fields={
                    currentScenarioData?.show_parameter_fields ?? false
                  }
                  parameter_fields={currentScenarioData?.parameter_fields ?? []}
                  parameter_ids={formState.parameter_ids}
                  parameters={currentScenarioData?.parameters ?? []}
                  parameter_resources={
                    currentScenarioData?.parameter_resources ?? []
                  }
                  disabled={disabled}
                  onChange={(ids) =>
                    setFormState((prev) => ({
                      ...prev,
                      parameter_field_ids: ids,
                    }))
                  }
                  onConditionalParameterToggle={
                    handleConditionalParameterToggle
                  }
                  group_id={currentScenarioData?.group_id ?? null}
                  agent_id={
                    currentScenarioData?.parameter_fields_agent_id ?? null
                  }
                  required={
                    currentScenarioData?.parameter_fields_required ?? false
                  }
                  createParameterFieldsAction={createParameterFieldsAction}
                  isAutosaveEnabled={isAutosaveEnabled}
                  registerFlush={registerFlushCallbacks.parameter_fields}
                  aiParameterFieldResources={aiFormData.parameter_field_resources ?? null}
                  onAccept={() => clearAiResource("parameter_field_resources")}
                  onReject={() => clearAiResource("parameter_field_resources")}
                />
              </div>
            </StepCard>
          );
        case "images":
          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={disabled}
              isEditMode={isEditMode}
              resetFields={["images"]}
              actions={
                shouldShowGenerateAction(
                  "images",
                  currentScenarioData?.content_agent_id
                ) ? (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            handleOpenStepCardModal("images", "generate")
                          }
                          disabled={disabled}
                        >
                          <Sparkles className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Generate</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ) : null
              }
              {...resetProps}
            >
              <Images
                image_ids={formState.image_ids}
                image_resources={currentScenarioData?.image_resources ?? []}
                show_images={showImagesSection}
                images_agent_id={currentScenarioData?.images_agent_id ?? null}
                images_required={currentScenarioData?.images_required ?? false}
                image_suggestions={currentScenarioData?.image_suggestions ?? []}
                images={currentScenarioData?.images ?? []}
                disabled={disabled}
                onChange={(ids) =>
                  setFormState((prev) => ({ ...prev, image_ids: ids }))
                }
                group_id={currentScenarioData?.group_id ?? null}
                agent_id={currentScenarioData?.images_agent_id ?? null}
                createImagesAction={
                  createImagesAction as
                    | ((
                        input: CreateDraftImagesIn
                      ) => Promise<CreateDraftImagesOut>)
                    | undefined
                }
                onGenerate={handleGenerateImages}
                isGenerating={isGenerating("images")}
                multiSelect={true}
                maxImages={3}
                isAutosaveEnabled={isAutosaveEnabled}
                registerFlush={registerFlushCallbacks.images}
                aiImageResources={aiFormData.image_resources ?? null}
                onAccept={() => clearAiResource("image_resources")}
                onReject={() => clearAiResource("image_resources")}
              />
            </StepCard>
          );
        case "videos":
          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={disabled}
              isEditMode={isEditMode}
              resetFields={["videos"]}
              actions={
                shouldShowGenerateAction(
                  "videos",
                  currentScenarioData?.content_agent_id
                ) ? (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            handleOpenStepCardModal("videos", "generate")
                          }
                          disabled={disabled}
                        >
                          <Sparkles className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Generate</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ) : null
              }
              {...resetProps}
            >
              <Videos
                video_ids={formState.video_ids}
                video_resources={currentScenarioData?.video_resources ?? []}
                show_videos={showVideosSection}
                videos_agent_id={currentScenarioData?.videos_agent_id ?? null}
                videos_required={currentScenarioData?.videos_required ?? false}
                video_suggestions={currentScenarioData?.video_suggestions ?? []}
                videos={currentScenarioData?.videos ?? []}
                disabled={disabled}
                onChange={(ids) =>
                  setFormState((prev) => ({ ...prev, video_ids: ids }))
                }
                group_id={currentScenarioData?.group_id ?? null}
                agent_id={currentScenarioData?.videos_agent_id ?? null}
                createVideosAction={
                  createVideosAction as
                    | ((
                        input: CreateDraftVideosIn
                      ) => Promise<CreateDraftVideosOut>)
                    | undefined
                }
                onGenerate={handleGenerateVideos}
                isGenerating={isGenerating("videos")}
                isAutosaveEnabled={isAutosaveEnabled}
                registerFlush={registerFlushCallbacks.videos}
                aiVideoResources={aiFormData.video_resources ?? null}
                onAccept={() => clearAiResource("video_resources")}
                onReject={() => clearAiResource("video_resources")}
              />
            </StepCard>
          );
        case "questions":
          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={disabled}
              isEditMode={isEditMode}
              resetFields={["questions"]}
              actions={
                shouldShowGenerateAction(
                  "questions",
                  currentScenarioData?.content_agent_id
                ) ? (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            handleOpenStepCardModal("questions", "generate")
                          }
                          disabled={disabled}
                        >
                          <Sparkles className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Generate</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ) : null
              }
              {...resetProps}
            >
              <Questions
                question_ids={formState.question_ids}
                question_resources={
                  currentScenarioData?.question_resources ?? []
                }
                show_questions={showQuestionsSection}
                questions_agent_id={
                  currentScenarioData?.questions_agent_id ?? null
                }
                questions_required={
                  currentScenarioData?.questions_required ?? false
                }
                question_suggestions={
                  currentScenarioData?.question_suggestions ?? []
                }
                questions={currentScenarioData?.questions ?? []}
                disabled={disabled}
                onChange={(ids) =>
                  setFormState((prev) => ({ ...prev, question_ids: ids }))
                }
                group_id={currentScenarioData?.group_id ?? null}
                agent_id={currentScenarioData?.questions_agent_id ?? null}
                createQuestionsAction={
                  createQuestionsAction as
                    | ((
                        input: CreateDraftQuestionsIn
                      ) => Promise<CreateDraftQuestionsOut>)
                    | undefined
                }
                onGenerate={handleGenerateQuestions}
                isGenerating={isGenerating("questions")}
                isAutosaveEnabled={isAutosaveEnabled}
                registerFlush={registerFlushCallbacks.questions}
                aiQuestionResources={aiFormData.question_resources ?? null}
                onAccept={() => clearAiResource("question_resources")}
                onReject={() => clearAiResource("question_resources")}
              />
            </StepCard>
          );
        default:
          return null;
      }
    },
    [
      stableScenarioDataFields,
      disabled,
      isEditMode,
      handleGenerateName,
      handleGenerateDescription,
      handleGenerateProblemStatements,
      handleGenerateObjectives,
      handleGenerateDepartments,
      handleGeneratePersonas,
      handleGenerateDocuments,
      handleGenerateTemplates,
      handleGenerateParameters,
      handleGenerateImages,
      handleGenerateVideos,
      handleGenerateQuestions,
      handleGenerateFlags,
      isGenerating,
      formState,
      createNamesAction,
      createDescriptionsAction,
      createProblemStatementsAction,
      createObjectivesAction,
      createTemplatesAction,
      createParameterFieldsAction,
      createImagesAction,
      createVideosAction,
      createQuestionsAction,
      handleOpenStepCardModal,
      stepResources,
      isAutosaveEnabled,
      registerFlushCallbacks,
      showImagesSection,
      showVideosSection,
      showQuestionsSection,
      handleConditionalParameterToggle,
      showObjectivesSection,
      showProblemStatementSection,
      showTemplatesSection,
    ]
  );

  return (
    <TooltipProvider>
      <div
        className="w-full p-6 space-y-8"
        data-page={`scenario-${isEditMode ? "edit" : "new"}`}
      >
        <ReadOnlyBanner
          disabled={disabled}
          disabledReason={scenarioData?.disabled_reason ?? null}
          entityType="scenario"
        />

        <GenericForm
          nuqsParsers={
            scenarioSearchParamsClient as Record<string, Parser<unknown>>
          }
          steps={steps}
          getStepStatus={getStepStatus}
          serverData={scenarioData}
          formFieldKeys={formFieldKeys}
          onSubmit={handleSubmit}
          submitButton={submitButton}
          isReadonly={disabled}
          isEditMode={isEditMode}
          renderStep={renderStep}
          onReset={(stepId) => handleReset(stepId)}
          resetSuccessMessage={resetSuccessMessage}
          onFormDataChange={onFormDataChange}
          registerSetFormData={(setter) => {
            setUrlFormDataRef.current = setter;
          }}
        />

        {modalMode && (
          <GenerateRegenerateModal
            open={showGenerateModal}
            onOpenChange={setShowGenerateModal}
            resources={modalResources}
            onResourcesChange={setModalResources}
            instructions={modalInstructions}
            onInstructionsChange={setModalInstructions}
            onGenerate={handleModalGenerate}
            isGenerating={modalResources.some((r) =>
              isGenerating(r.id as ScenarioResourceType)
            )}
            mode={modalMode}
          />
        )}
      </div>
    </TooltipProvider>
  );
}

// Memoize component to prevent re-renders when only prop references change (content is same)
export default React.memo(ScenarioComponent, (prevProps, nextProps) => {
  const prevScenarioData = prevProps.scenarioId
    ? prevProps.scenarioDetail
    : prevProps.scenarioDetailDefault;
  const nextScenarioData = nextProps.scenarioId
    ? nextProps.scenarioDetail
    : nextProps.scenarioDetailDefault;

  const prevIds = {
    name_id: prevScenarioData?.name_id,
    description_id: prevScenarioData?.description_id,
    problem_statement_id: prevScenarioData?.problem_statement_id,
    active_flag_id: prevScenarioData?.active_flag_id,
    objectives_enabled_flag_id: prevScenarioData?.objectives_enabled_flag_id,
    images_enabled_flag_id: prevScenarioData?.images_enabled_flag_id,
    video_enabled_flag_id: prevScenarioData?.video_enabled_flag_id,
    questions_enabled_flag_id: prevScenarioData?.questions_enabled_flag_id,
    problem_statement_enabled_flag_id:
      prevScenarioData?.problem_statement_enabled_flag_id,
    use_templates_flag_id: prevScenarioData?.use_templates_flag_id,
    department_ids: prevScenarioData?.department_ids,
    persona_ids: prevScenarioData?.persona_ids,
    document_ids: prevScenarioData?.document_ids,
    template_ids: prevScenarioData?.template_ids,
    parameter_ids: prevScenarioData?.parameter_ids,
    parameter_field_ids: prevScenarioData?.parameter_field_ids,
    image_ids: prevScenarioData?.image_ids,
    objective_ids: prevScenarioData?.objective_ids,
    video_ids: prevScenarioData?.video_ids,
    question_ids: prevScenarioData?.question_ids,
  };
  const nextIds = {
    name_id: nextScenarioData?.name_id,
    description_id: nextScenarioData?.description_id,
    problem_statement_id: nextScenarioData?.problem_statement_id,
    active_flag_id: nextScenarioData?.active_flag_id,
    objectives_enabled_flag_id: nextScenarioData?.objectives_enabled_flag_id,
    images_enabled_flag_id: nextScenarioData?.images_enabled_flag_id,
    video_enabled_flag_id: nextScenarioData?.video_enabled_flag_id,
    questions_enabled_flag_id: nextScenarioData?.questions_enabled_flag_id,
    problem_statement_enabled_flag_id:
      nextScenarioData?.problem_statement_enabled_flag_id,
    use_templates_flag_id: nextScenarioData?.use_templates_flag_id,
    department_ids: nextScenarioData?.department_ids,
    persona_ids: nextScenarioData?.persona_ids,
    document_ids: nextScenarioData?.document_ids,
    template_ids: nextScenarioData?.template_ids,
    parameter_ids: nextScenarioData?.parameter_ids,
    parameter_field_ids: nextScenarioData?.parameter_field_ids,
    image_ids: nextScenarioData?.image_ids,
    objective_ids: nextScenarioData?.objective_ids,
    video_ids: nextScenarioData?.video_ids,
    question_ids: nextScenarioData?.question_ids,
  };

  if (
    prevProps.scenarioId !== nextProps.scenarioId ||
    JSON.stringify(prevIds) !== JSON.stringify(nextIds)
  ) {
    return false;
  }

  if (
    prevProps.saveScenarioAction !== nextProps.saveScenarioAction ||
    prevProps.patchScenarioDraftAction !== nextProps.patchScenarioDraftAction
  ) {
    return false;
  }

  return true;
});
