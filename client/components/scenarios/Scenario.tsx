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
import { StepCardAiButton } from "@/components/common/forms/StepCardAiButton";
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
import { TooltipProvider } from "@/components/ui/tooltip";
import { useBreadcrumbContext } from "@/contexts/breadcrumb-context";
import { useProfile } from "@/contexts/profile-context";
import { useSaveContext } from "@/contexts/save-context";
import { useAiGeneration } from "@/hooks/use-ai-generation";
import { useConditionalParameterToggle } from "@/hooks/use-conditional-parameter-toggle";
import { useDraftLifecycle } from "@/hooks/use-draft-lifecycle";
import { useFlushRegistry } from "@/hooks/use-flush-registry";
import { useGenerationModal } from "@/hooks/use-generation-modal";
import type { InputOf, OutputOf } from "@/lib/api/types";
import {
  buildMultiAction,
  buildResourceActions,
  checkHasResourceIds,
  computeEffectiveFormState,
  type ResourceConfig,
} from "@/lib/resources/action-builders";
import type { ServerToClientEvents } from "@/lib/ws/types";
import { parseAsBoolean, parseAsString, type Parser } from "nuqs";

// Types defined inline using InputOf/OutputOf
type GetScenarioOut = OutputOf<"/api/v4/artifacts/scenarios/get", "post">;
type SaveScenarioIn = InputOf<"/api/v4/artifacts/scenarios/save", "post">;
type SaveScenarioOut = OutputOf<"/api/v4/artifacts/scenarios/save", "post">;
type PatchScenarioDraftIn = InputOf<"/api/v4/artifacts/scenarios/draft", "patch">;
type PatchScenarioDraftOut = OutputOf<"/api/v4/artifacts/scenarios/draft", "patch">;

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

function getSelectedScenarioFlagIds(state: ScenarioFormState): string[] {
  return [
    state.active_flag_id,
    state.objectives_enabled_flag_id,
    state.images_enabled_flag_id,
    state.video_enabled_flag_id,
    state.questions_enabled_flag_id,
    state.problem_statement_enabled_flag_id,
    state.use_templates_flag_id,
  ].filter((id): id is string => !!id);
}

// AI form data shape for scenario generation
type ScenarioAiFormData = {
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

const FLUSH_KEYS = [
  "names",
  "descriptions",
  "problem_statements",
  "objectives",
  "templates",
  "images",
  "videos",
  "questions",
  "parameter_fields",
];

const VALID_RESOURCE_TYPES: ScenarioResourceType[] = [
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

const SCENARIO_RESOURCES: ResourceConfig[] = [
  { key: "names", formKey: "name_id", flushKey: "name_id", type: "single" },
  {
    key: "descriptions",
    formKey: "description_id",
    flushKey: "description_id",
    type: "single",
  },
  {
    key: "problem_statements",
    formKey: "problem_statement_id",
    flushKey: "problem_statement_id",
    type: "single",
  },
  {
    key: "departments",
    formKey: "department_ids",
    flushKey: null,
    type: "multi",
  },
  { key: "personas", formKey: "persona_ids", flushKey: null, type: "multi" },
  {
    key: "documents",
    formKey: "document_ids",
    flushKey: null,
    type: "multi",
  },
  { key: "templates", formKey: "template_ids", flushKey: "template_ids", type: "multi" },
  {
    key: "parameters",
    formKey: "parameter_ids",
    flushKey: null,
    type: "multi",
  },
  {
    key: "parameter_fields",
    formKey: "parameter_field_ids",
    flushKey: "parameter_field_ids",
    type: "multi",
  },
  { key: "images", formKey: "image_ids", flushKey: "image_ids", type: "multi" },
  {
    key: "objectives",
    formKey: "objective_ids",
    flushKey: "objective_ids",
    type: "multi",
  },
  { key: "videos", formKey: "video_ids", flushKey: "video_ids", type: "multi" },
  {
    key: "questions",
    formKey: "question_ids",
    flushKey: "question_ids",
    type: "multi",
  },
];

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

  // --- Flush Registry ---
  const { flushRegistryRef, registerFlushCallbacks, flushAllResources } =
    useFlushRegistry<FlushResult>(FLUSH_KEYS);

  // --- AI Generation ---
  const onAiComplete = useCallback(
    (data: Record<string, unknown>) => {
      const aiUpdates: Partial<ScenarioAiFormData> = {};
      if (data["name_resource"]) aiUpdates.name_resource = data["name_resource"] as ScenarioAiFormData["name_resource"];
      if (data["description_resource"]) aiUpdates.description_resource = data["description_resource"] as ScenarioAiFormData["description_resource"];
      if (data["problem_statement_resource"]) aiUpdates.problem_statement_resource = data["problem_statement_resource"] as ScenarioAiFormData["problem_statement_resource"];
      if (data["department_resources"]) aiUpdates.department_resources = data["department_resources"] as ScenarioAiFormData["department_resources"];
      if (data["persona_resources"]) aiUpdates.persona_resources = data["persona_resources"] as ScenarioAiFormData["persona_resources"];
      if (data["document_resources"]) aiUpdates.document_resources = data["document_resources"] as ScenarioAiFormData["document_resources"];
      if (data["template_resources"]) aiUpdates.template_resources = data["template_resources"] as ScenarioAiFormData["template_resources"];
      if (data["objective_resources"]) aiUpdates.objective_resources = data["objective_resources"] as ScenarioAiFormData["objective_resources"];
      if (data["question_resources"]) aiUpdates.question_resources = data["question_resources"] as ScenarioAiFormData["question_resources"];
      if (data["image_resources"]) aiUpdates.image_resources = data["image_resources"] as ScenarioAiFormData["image_resources"];
      if (data["video_resources"]) aiUpdates.video_resources = data["video_resources"] as ScenarioAiFormData["video_resources"];
      if (data["parameter_resources"]) aiUpdates.parameter_resources = data["parameter_resources"] as ScenarioAiFormData["parameter_resources"];
      if (data["parameter_field_resources"]) aiUpdates.parameter_field_resources = data["parameter_field_resources"] as ScenarioAiFormData["parameter_field_resources"];

      // Only name_resource auto-accepts (names are auto-applied without user confirmation)
      const formStateUpdates: Record<string, unknown> = {};
      const nameRes = data["name_resource"] as { id?: string } | undefined;
      if (nameRes?.id) formStateUpdates["name_id"] = String(nameRes.id);

      return { aiUpdates, formStateUpdates };
    },
    []
  );

  const {
    setGeneratingResources,
    isGenerating,
    aiFormData,
    clearAiResource,
  } = useAiGeneration<ScenarioResourceType, ScenarioAiFormData>({
    socket,
    isConnected,
    artifactType: "scenario",
    groupId: scenarioData?.group_id,
    eventPrefix: "scenario_generation",
    validResourceTypes: VALID_RESOURCE_TYPES,
    onComplete: onAiComplete,
  });

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

  // --- Form State ---
  const scenarioDataRef = useRef(scenarioData);
  useEffect(() => {
    scenarioDataRef.current = scenarioData;
  }, [scenarioData]);

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

    const selectedFlags = scenarioData.flags?.current ?? [];
    const selectedFlagId = (key: string): string | null => {
      const match = selectedFlags.find((flag) => flag?.key === key);
      const id = match?.flag_option_id;
      return id ? String(id) : null;
    };

    return {
      name_id: scenarioData.names?.resource?.id
        ? String(scenarioData.names.resource.id)
        : null,
      description_id: scenarioData.descriptions?.resource?.id
        ? String(scenarioData.descriptions.resource.id)
        : null,
      problem_statement_id: scenarioData.problem_statements?.resource
        ?.problem_statement_id
        ? String(scenarioData.problem_statements.resource.problem_statement_id)
        : null,
      active_flag_id: selectedFlagId("active"),
      objectives_enabled_flag_id: selectedFlagId("objectives_enabled"),
      images_enabled_flag_id: selectedFlagId("images_enabled"),
      video_enabled_flag_id: selectedFlagId("video_enabled"),
      questions_enabled_flag_id: selectedFlagId("questions_enabled"),
      problem_statement_enabled_flag_id: selectedFlagId(
        "problem_statement_enabled",
      ),
      use_templates_flag_id: selectedFlagId("use_templates"),
      department_ids: (scenarioData.departments?.current ?? [])
        .map((item) => item.department_id)
        .filter(Boolean)
        .map(String),
      persona_ids: (scenarioData.personas?.current ?? [])
        .map((item) => item.persona_id)
        .filter(Boolean)
        .map(String),
      document_ids: (scenarioData.documents?.current ?? [])
        .map((item) => item.document_id)
        .filter(Boolean)
        .map(String),
      template_ids: (scenarioData.templates?.current ?? [])
        .map((item) => item.template_id)
        .filter(Boolean)
        .map(String),
      parameter_ids: (scenarioData.parameters?.current ?? [])
        .map((item) => item.parameter_id)
        .filter(Boolean)
        .map(String),
      parameter_field_ids: (scenarioData.parameter_fields?.current ?? [])
        .map((item) => item.field_id)
        .filter(Boolean)
        .map(String),
      image_ids: (scenarioData.images?.current ?? [])
        .map((item) => item.image_id)
        .filter(Boolean)
        .map(String),
      objective_ids: (scenarioData.objectives?.current ?? [])
        .map((item) => item.id)
        .filter(Boolean)
        .map(String),
      video_ids: (scenarioData.videos?.current ?? [])
        .map((item) => item.video_id)
        .filter(Boolean)
        .map(String),
      question_ids: (scenarioData.questions?.current ?? [])
        .map((item) => item.question_id)
        .filter(Boolean)
        .map(String),
    };
  }, [scenarioData]);

  const [formState, setFormState] =
    useState<ScenarioFormState>(getInitialFormState);
  const formStateRef = useRef<Record<string, unknown>>(formState as unknown as Record<string, unknown>);
  const lastPatchedFormStateRef = useRef<ScenarioFormState | null>(null);
  useEffect(() => {
    formStateRef.current = formState as unknown as Record<string, unknown>;
  }, [formState]);

  // Separate effect to auto-accept name from AI generation
  const aiNameResource = aiFormData.name_resource;
  React.useEffect(() => {
    if (aiNameResource?.id) {
      setFormState((prev) => ({
        ...prev,
        name_id: String(aiNameResource.id!),
      }));
    }
  }, [aiNameResource]);

  // Memoize stringified array dependencies
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
    () =>
      JSON.stringify(
        (scenarioData?.departments?.current ?? [])
          .map((item) => item.department_id)
          .filter(Boolean),
      ),
    [scenarioData?.departments]
  );
  const scenarioPersonaIdsStr = useMemo(
    () =>
      JSON.stringify(
        (scenarioData?.personas?.current ?? [])
          .map((item) => item.persona_id)
          .filter(Boolean),
      ),
    [scenarioData?.personas]
  );
  const scenarioDocumentIdsStr = useMemo(
    () =>
      JSON.stringify(
        (scenarioData?.documents?.current ?? [])
          .map((item) => item.document_id)
          .filter(Boolean),
      ),
    [scenarioData?.documents]
  );
  const scenarioTemplateIdsStr = useMemo(
    () =>
      JSON.stringify(
        (scenarioData?.templates?.current ?? [])
          .map((item) => item.template_id)
          .filter(Boolean),
      ),
    [scenarioData?.templates]
  );
  const scenarioParameterIdsStr = useMemo(
    () =>
      JSON.stringify(
        (scenarioData?.parameters?.current ?? [])
          .map((item) => item.parameter_id)
          .filter(Boolean),
      ),
    [scenarioData?.parameters]
  );
  const scenarioParameterFieldIdsStr = useMemo(
    () =>
      JSON.stringify(
        (scenarioData?.parameter_fields?.current ?? [])
          .map((item) => item.field_id)
          .filter(Boolean),
      ),
    [scenarioData?.parameter_fields]
  );
  const scenarioImageIdsStr = useMemo(
    () =>
      JSON.stringify(
        (scenarioData?.images?.current ?? [])
          .map((item) => item.image_id)
          .filter(Boolean),
      ),
    [scenarioData?.images]
  );
  const scenarioObjectiveIdsStr = useMemo(
    () =>
      JSON.stringify(
        (scenarioData?.objectives?.current ?? [])
          .map((item) => item.id)
          .filter(Boolean),
      ),
    [scenarioData?.objectives]
  );
  const scenarioVideoIdsStr = useMemo(
    () =>
      JSON.stringify(
        (scenarioData?.videos?.current ?? [])
          .map((item) => item.video_id)
          .filter(Boolean),
      ),
    [scenarioData?.videos]
  );
  const scenarioQuestionIdsStr = useMemo(
    () =>
      JSON.stringify(
        (scenarioData?.questions?.current ?? [])
          .map((item) => item.question_id)
          .filter(Boolean),
      ),
    [scenarioData?.questions]
  );

  // Update form state when server data changes
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
        serverSyncPendingRef.current = true;
        return newState;
      }
      return prev;
    });
    // Use individual scenarioData fields in dependencies to prevent effect from running when unrelated fields change
    // Intentionally exclude formState and getInitialFormState to prevent infinite loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    scenarioData?.names,
    scenarioData?.descriptions,
    scenarioData?.problem_statements,
    scenarioData?.flags,
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

  // --- Draft Lifecycle ---
  const patchScenarioDraftActionRef = useRef(patchScenarioDraftAction);
  useEffect(() => {
    patchScenarioDraftActionRef.current = patchScenarioDraftAction;
  }, [patchScenarioDraftAction]);

  // Stable ref wrapper for patch action
  const patchActionRef = useRef<
    ((payload: Record<string, unknown>) => Promise<{ draft_id?: string | null; new_version?: number | null }>) | undefined
  >(undefined);
  useEffect(() => {
    if (patchScenarioDraftAction) {
      patchActionRef.current = async (payload: Record<string, unknown>) => {
        return await patchScenarioDraftAction({ body: payload } as PatchScenarioDraftIn);
      };
    } else {
      patchActionRef.current = undefined;
    }
  }, [patchScenarioDraftAction]);

  // formStateKey excludes draftId -- the hook prepends it
  const formStateKey = useMemo(
    () =>
      JSON.stringify({
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
        field_ids: formState.parameter_field_ids,
        image_ids: formState.image_ids,
        objective_ids: formState.objective_ids,
        video_ids: formState.video_ids,
        question_ids: formState.question_ids,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
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

  const hasResourceIds = checkHasResourceIds(
    SCENARIO_RESOURCES,
    formState as unknown as Record<string, unknown>,
  );

  const buildPatchPayload = useCallback(
    (
      draftId: string | null,
      expectedVersion: number,
      flushResults?: Record<string, unknown>
    ): Record<string, unknown> => {
      const effectiveState = computeEffectiveFormState(
        SCENARIO_RESOURCES,
        formStateRef.current as Record<string, unknown>,
        (flushResults ?? {}) as Record<string, unknown>,
      ) as unknown as ScenarioFormState;
      const referenceState = lastPatchedFormStateRef.current;
      const effectiveFlagIds = getSelectedScenarioFlagIds(effectiveState);
      const referenceFlagIds = referenceState
        ? getSelectedScenarioFlagIds(referenceState)
        : [];
      return {
        input_draft_id: draftId || null,
        group_id: scenarioData?.group_id ?? null,
        ...buildResourceActions(SCENARIO_RESOURCES, {
          formState: formStateRef.current,
          referenceState: referenceState as unknown as Record<string, unknown> | null,
          flushResults: (flushResults ?? {}) as Record<string, unknown>,
          entityData: scenarioData as Record<string, unknown> | null,
        }),
        flags: buildMultiAction({
          resourceIds: effectiveFlagIds,
          wasCreated: false,
          changed: JSON.stringify(effectiveFlagIds) !== JSON.stringify(referenceFlagIds),
          section: scenarioData?.flags ?? undefined,
        }),
        expected_version: expectedVersion,
      };
    },
    [scenarioData]
  );

  const draftVersion =
    scenarioData && "draft_version" in scenarioData
      ? (scenarioData as { draft_version?: number | null }).draft_version
      : null;

  const onPatchSuccess = useCallback(() => {
    lastPatchedFormStateRef.current = {
      ...(formStateRef.current as unknown as ScenarioFormState),
    };
  }, []);

  const {
    setUrlFormDataRef,
    onFormDataChange,
    flushAllAndSave,
    serverSyncPendingRef,
    formDataRef,
  } = useDraftLifecycle({
    formStateKey,
    patchActionRef,
    isAutosaveEnabled,
    buildPatchPayload,
    setSelectedDraftId,
    serverDraftVersion: draftVersion ?? null,
    hasResourceIds,
    flushRegistryRef,
    formStateRef,
    onPatchSuccess,
  });

  // --- Conditional Parameter Toggle ---
  const getParameterFields = useCallback(
    () => scenarioDataRef.current?.parameter_fields?.resources ?? [],
    []
  );

  const { handleConditionalParameterToggle } = useConditionalParameterToggle({
    setFormState,
    getParameterFields,
  });

  // --- Stable Data Memo ---
  const stableScenarioDataFields = useMemo(() => {
    if (!scenarioData) return null;
    return {
      group_id: scenarioData.group_id,
      names: scenarioData.names,
      descriptions: scenarioData.descriptions,
      problem_statements: scenarioData.problem_statements,
      flags: scenarioData.flags,
      departments: scenarioData.departments,
      personas: scenarioData.personas,
      documents: scenarioData.documents,
      templates: scenarioData.templates,
      parameters: scenarioData.parameters,
      parameter_fields: scenarioData.parameter_fields,
      objectives: scenarioData.objectives,
      images: scenarioData.images,
      videos: scenarioData.videos,
      questions: scenarioData.questions,
      can_edit: scenarioData.can_edit,
      disabled_reason: scenarioData.disabled_reason,
      basic_show_ai_generate: scenarioData.basic_show_ai_generate,
      content_show_ai_generate: scenarioData.content_show_ai_generate,
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
    (resourceType: string): boolean => {
      if (!stableScenarioDataFields) return false;
      switch (resourceType as ScenarioResourceType) {
        case "names":
          return stableScenarioDataFields.names?.resource?.generated ?? false;
        case "descriptions":
          return (
            stableScenarioDataFields.descriptions?.resource?.generated ?? false
          );
        case "problem_statements":
          return (
            stableScenarioDataFields.problem_statements?.resource?.generated ??
            false
          );
        case "objectives":
          return (
            stableScenarioDataFields.objectives?.current?.some(
              (o: { generated?: boolean | null }) => o.generated
            ) ?? false
          );
        case "scenario_flags":
          return (
            stableScenarioDataFields.flags?.resources?.some(
              (f: { generated?: boolean | null }) => f.generated
            ) ?? false
          );
        case "departments":
          return (
            stableScenarioDataFields.departments?.current?.some(
              (d: { generated?: boolean | null }) => d.generated
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
            stableScenarioDataFields.templates?.current?.some(
              (t: { generated?: boolean | null }) => t.generated
            ) ?? false
          );
        case "parameters":
          // ScenarioParameter doesn't have generated field in API
          return false;
        case "parameter_fields":
          return (
            stableScenarioDataFields.parameter_fields?.current?.some(
              (f: { generated?: boolean | null }) => f.generated
            ) ?? false
          );
        case "images":
          return (
            stableScenarioDataFields.images?.current?.some(
              (i: { generated?: boolean | null }) => i.generated
            ) ?? false
          );
        case "videos":
          return (
            stableScenarioDataFields.videos?.current?.some(
              (v: { generated?: boolean | null }) => v.generated
            ) ?? false
          );
        case "questions":
          return (
            stableScenarioDataFields.questions?.current?.some(
              (q: { generated?: boolean | null }) => q.generated
            ) ?? false
          );
        default:
          return false;
      }
    },
    [stableScenarioDataFields]
  );

  const isGeneratingStepResource = useCallback(
    (resourceType: string) => isGenerating(resourceType as ScenarioResourceType),
    [isGenerating]
  );

  // --- Disabled / Breadcrumb ---
  const disabled = useMemo(() => {
    if (!scenarioData) return false;
    return !scenarioData.can_edit;
  }, [scenarioData]);

  // Set breadcrumb context when scenario data is loaded in edit mode
  useEffect(() => {
    const scenarioName = stableScenarioDataFields?.names?.resource?.name;
    if (scenarioName && scenarioId && isEditMode) {
      setEntityMetadata({
        entityId: scenarioId,
        entityName: scenarioName,
        entityType: "scenario",
      });
    }
    return () => clearEntityMetadata();
  }, [
    stableScenarioDataFields?.names?.resource?.name,
    scenarioId,
    isEditMode,
    setEntityMetadata,
    clearEntityMetadata,
  ]);

  // --- Generation Handlers ---
  const handleGenerateResources = useCallback(
    async (
      resourceTypes: ScenarioResourceType[],
      userInstructions?: string,
    ) => {
      if (!socket || !isConnected) {
        toast.error("WebSocket not connected");
        return;
      }

      if (resourceTypes.length === 0) {
        toast.error("No resource types specified for generation");
        return;
      }

      let draftIdValue =
        (formDataRef.current["draftId"] as string | undefined) ?? null;
      if (!draftIdValue) {
        draftIdValue = await flushAllAndSave();
      }
      if (!draftIdValue) {
        toast.error("Please save a draft before generating with AI");
        return;
      }

      setGeneratingResources((prev) => {
        const next = new Set(prev);
        resourceTypes.forEach((rt) => next.add(rt));
        return next;
      });

      const formData = formDataRef.current;
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
      flushAllAndSave,
      formState.images_enabled_flag_id,
      formState.objectives_enabled_flag_id,
      formState.video_enabled_flag_id,
      formState.document_ids,
      formState.problem_statement_id,
      formState.template_ids,
      formState.department_ids,
      formState.persona_ids,
      formState.parameter_ids,
      formDataRef,
      setGeneratingResources,
    ]
  );

  const generateHandlers = useMemo(
    () =>
      Object.fromEntries(
        VALID_RESOURCE_TYPES.map((rt) => [
          rt,
          () => handleGenerateResources([rt]),
        ]),
      ) as Record<ScenarioResourceType, () => Promise<void>>,
    [handleGenerateResources],
  );

  // --- Generation Modal ---
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

  const onModalGenerate = useCallback(
    (selectedResources: ScenarioResourceType[], instructions?: string) => {
      handleGenerateResources(selectedResources, instructions);
    },
    [handleGenerateResources]
  );

  const { handleOpenStepCardModal, modalProps } = useGenerationModal<ScenarioResourceType>({
    stepResources,
    resourceLabels,
    canRegenerate,
    onGenerate: onModalGenerate,
    isGenerating,
  });

  // --- Steps / Form Config ---
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

    if (stableScenarioDataFields?.personas?.show) {
      items.push({
        id: "personas",
        title: "Personas",
        description: "Select personas for the scenario.",
        resetFields: ["personas", "personaSearch", "personaShowSelected"],
      });
    }

    if (stableScenarioDataFields?.documents?.show) {
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

    if (stableScenarioDataFields?.parameters?.show) {
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
    stableScenarioDataFields?.personas?.show,
    stableScenarioDataFields?.documents?.show,
    showTemplatesSection,
    stableScenarioDataFields?.parameters?.show,
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

  // --- Submit ---
  const handleSubmit = useCallback(
    async (_formData: Record<string, unknown>) => {
      if (stableScenarioDataFields?.names?.required && !formState.name_id) {
        toast.error("Scenario name is required");
        throw new Error("Scenario name is required");
      }

      if (stableScenarioDataFields?.descriptions?.required && !formState.description_id) {
        toast.error("Scenario description is required");
        throw new Error("Scenario description is required");
      }

      if (
        stableScenarioDataFields?.problem_statements?.required &&
        !formState.problem_statement_id
      ) {
        toast.error("Problem statement is required");
        throw new Error("Problem statement is required");
      }

      if (
        stableScenarioDataFields?.objectives?.required &&
        formState.objective_ids.length === 0
      ) {
        toast.error("Objectives are required");
        throw new Error("Objectives are required");
      }

      if (
        stableScenarioDataFields?.departments?.required &&
        formState.department_ids.length === 0
      ) {
        toast.error("Departments are required");
        throw new Error("Departments are required");
      }

      if (
        stableScenarioDataFields?.personas?.required &&
        formState.persona_ids.length === 0
      ) {
        toast.error("Personas are required");
        throw new Error("Personas are required");
      }

      if (
        stableScenarioDataFields?.documents?.required &&
        formState.document_ids.length === 0
      ) {
        toast.error("Documents are required");
        throw new Error("Documents are required");
      }

      if (
        stableScenarioDataFields?.templates?.required &&
        formState.template_ids.length === 0
      ) {
        toast.error("Templates are required");
        throw new Error("Templates are required");
      }

      if (
        stableScenarioDataFields?.parameters?.required &&
        formState.parameter_ids.length === 0
      ) {
        toast.error("Parameters are required");
        throw new Error("Parameters are required");
      }

      if (stableScenarioDataFields?.images?.required && formState.image_ids.length === 0) {
        toast.error("Images are required");
        throw new Error("Images are required");
      }

      if (stableScenarioDataFields?.videos?.required && formState.video_ids.length === 0) {
        toast.error("Videos are required");
        throw new Error("Videos are required");
      }

      if (
        stableScenarioDataFields?.questions?.required &&
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

      const effectiveFormState = computeEffectiveFormState(
        SCENARIO_RESOURCES,
        formStateRef.current as Record<string, unknown>,
        flushResults as Record<string, unknown>,
      ) as unknown as ScenarioFormState;

      try {
        const initialState = getInitialFormState();
        const effectiveFlagIds = getSelectedScenarioFlagIds(effectiveFormState);
        const initialFlagIds = getSelectedScenarioFlagIds(initialState);

        const resourceActions = buildResourceActions(SCENARIO_RESOURCES, {
          formState: formStateRef.current,
          referenceState: initialState as unknown as Record<string, unknown>,
          flushResults: flushResults as Record<string, unknown>,
          entityData: scenarioData as Record<string, unknown> | null,
        });
        const saveBody: SaveScenarioIn["body"] = {
          input_scenario_id: isEditMode && scenarioId ? scenarioId : null,
          group_id: scenarioData.group_id,
          names: resourceActions["names"] as SaveScenarioIn["body"]["names"],
          descriptions: resourceActions["descriptions"] as SaveScenarioIn["body"]["descriptions"],
          problem_statements: resourceActions["problem_statements"] as SaveScenarioIn["body"]["problem_statements"],
          departments: resourceActions["departments"] as SaveScenarioIn["body"]["departments"],
          personas: resourceActions["personas"] as SaveScenarioIn["body"]["personas"],
          documents: resourceActions["documents"] as SaveScenarioIn["body"]["documents"],
          templates: resourceActions["templates"] as SaveScenarioIn["body"]["templates"],
          parameters: resourceActions["parameters"] as SaveScenarioIn["body"]["parameters"],
          parameter_fields: resourceActions["parameter_fields"] as SaveScenarioIn["body"]["parameter_fields"],
          images: resourceActions["images"] as SaveScenarioIn["body"]["images"],
          objectives: resourceActions["objectives"] as SaveScenarioIn["body"]["objectives"],
          videos: resourceActions["videos"] as SaveScenarioIn["body"]["videos"],
          questions: resourceActions["questions"] as SaveScenarioIn["body"]["questions"],
          flags: buildMultiAction({
            resourceIds: effectiveFlagIds,
            wasCreated: false,
            changed:
              JSON.stringify(effectiveFlagIds) !== JSON.stringify(initialFlagIds),
            section: scenarioData.flags ?? undefined,
          }) as SaveScenarioIn["body"]["flags"],
        };

        await saveScenarioAction({
          body: saveBody,
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
      stableScenarioDataFields?.names?.required,
      stableScenarioDataFields?.descriptions?.required,
      stableScenarioDataFields?.problem_statements?.required,
      stableScenarioDataFields?.objectives?.required,
      stableScenarioDataFields?.departments?.required,
      stableScenarioDataFields?.personas?.required,
      stableScenarioDataFields?.documents?.required,
      stableScenarioDataFields?.templates?.required,
      stableScenarioDataFields?.parameters?.required,
      stableScenarioDataFields?.images?.required,
      stableScenarioDataFields?.videos?.required,
      stableScenarioDataFields?.questions?.required,
      profile?.id,
      saveScenarioAction,
      isEditMode,
      scenarioId,
      router,
      isAutosaveEnabled,
      flushAllResources,
      getInitialFormState,
      scenarioData,
    ]
  );

  // --- Step Status ---
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

  // --- Render Step ---
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
      const s = stableScenarioDataFields;
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
                  name_resource={s?.names?.resource ?? null}
                  show_name={s?.names?.show ?? true}
                  name_suggestions={s?.names?.suggestions ?? []}
                  names={s?.names?.resources ?? []}
                  disabled={disabled}
                  onNameIdChange={(nameId) =>
                    setFormState((prev) => ({ ...prev, name_id: nameId }))
                  }
                  onGenerate={generateHandlers["names"]}
                  isGenerating={isGenerating("names")}
                  placeholder="e.g., Customer Support Escalation"
                  defaultName="New Scenario"
                  required={s?.names?.required ?? false}
                  hideDescription={true}
                  group_id={s?.group_id ?? null}
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
                stepResources["basic"]?.length &&
                (s?.basic_show_ai_generate ?? false) ? (
                  <StepCardAiButton
                    stepId="basic"
                    resourceTypes={stepResources["basic"]}
                    canRegenerate={canRegenerate}
                    isGenerating={isGeneratingStepResource}
                    onOpenModal={handleOpenStepCardModal}
                    disabled={disabled}
                  />
                ) : undefined
              }
              {...resetProps}
            >
              <div className="space-y-4">
                <Descriptions
                  description_id={formState.description_id ?? null}
                  description_resource={
                    s?.descriptions?.resource ?? null
                  }
                  show_description={
                    s?.descriptions?.show ?? true
                  }
                  description_suggestions={
                    s?.descriptions?.suggestions ?? []
                  }
                  descriptions={s?.descriptions?.resources ?? []}
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
                  onGenerate={generateHandlers["descriptions"]}
                  isGenerating={isGenerating("descriptions")}
                  label="Description"
                  placeholder="Describe the scenario"
                  required={s?.descriptions?.required ?? false}
                  group_id={s?.group_id ?? null}
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
                    s?.departments?.current ?? []
                  }
                  show_departments={
                    s?.departments?.show ?? false
                  }
                  department_suggestions={
                    s?.departments?.suggestions ?? []
                  }
                  departments={s?.departments?.resources ?? []}
                  disabled={disabled}
                  onChange={(ids) =>
                    setFormState((prev) => ({ ...prev, department_ids: ids }))
                  }
                  label="Departments"
                  required={s?.departments?.required ?? false}
                  group_id={s?.group_id ?? null}
                  onGenerate={generateHandlers["departments"]}
                  isGenerating={isGenerating("departments")}
                  aiDepartmentResources={aiFormData.department_resources ?? null}
                  onAccept={() => clearAiResource("department_resources")}
                  onReject={() => clearAiResource("department_resources")}
                />

                {/* Server-driven Flags - single component for all flags */}
                {/* Filter out video_flag flags when video is not enabled */}
                <Flags
                  flags={(s?.flags?.resources ?? []).filter(
                    (f: { video_flag?: boolean | null }) => !f.video_flag || videoEnabled
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
                  show_flags={s?.flags?.show ?? false}
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
                  onGenerate={generateHandlers["scenario_flags"]}
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
                stepResources["problem_statement"]?.length &&
                (s?.problem_statements?.show_ai_generate ??
                  false) ? (
                  <StepCardAiButton
                    stepId="problem_statement"
                    resourceTypes={stepResources["problem_statement"]}
                    canRegenerate={canRegenerate}
                    isGenerating={isGeneratingStepResource}
                    onOpenModal={handleOpenStepCardModal}
                    disabled={disabled}
                  />
                ) : undefined
              }
              {...resetProps}
            >
              <ProblemStatements
                problem_statement_id={formState.problem_statement_id ?? null}
                problem_statement_resource={
                  s?.problem_statements?.resource ?? null
                }
                show_problem_statement={showProblemStatementSection}
                problem_statement_suggestions={
                  s?.problem_statements?.suggestions ?? []
                }
                problem_statements={
                  s?.problem_statements?.resources ?? []
                }
                disabled={disabled}
                onProblemStatementIdChange={(problemStatementId) =>
                  setFormState((prev) => ({
                    ...prev,
                    problem_statement_id: problemStatementId,
                  }))
                }
                onGenerate={generateHandlers["problem_statements"]}
                isGenerating={isGenerating("problem_statements")}
                label="Problem Statement"
                placeholder="Define the core problem"
                required={
                  s?.problem_statements?.required ?? false
                }
                group_id={s?.group_id ?? null}
                searchTerm={problemStatementSearch ?? undefined}
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
                aiResource={aiFormData.problem_statement_resource ?? null}
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
                stepResources["objectives"]?.length &&
                (s?.objectives?.show_ai_generate ?? false) ? (
                  <StepCardAiButton
                    stepId="objectives"
                    resourceTypes={stepResources["objectives"]}
                    canRegenerate={canRegenerate}
                    isGenerating={isGeneratingStepResource}
                    onOpenModal={handleOpenStepCardModal}
                    disabled={disabled}
                  />
                ) : undefined
              }
              {...resetProps}
            >
              <Objectives
                objective_ids={formState.objective_ids}
                objective_resources={
                  s?.objectives?.current ?? []
                }
                show_objectives={showObjectivesSection}
                objectives_required={
                  s?.objectives?.required ?? false
                }
                objective_suggestions={
                  s?.objectives?.suggestions ?? []
                }
                objectives={s?.objectives?.resources ?? []}
                disabled={disabled}
                onChange={(ids) =>
                  setFormState((prev) => ({ ...prev, objective_ids: ids }))
                }
                group_id={s?.group_id ?? null}
                createObjectivesAction={
                  createObjectivesAction as
                    | ((
                        input: CreateDraftObjectivesIn
                      ) => Promise<CreateDraftObjectivesOut>)
                    | undefined
                }
                onGenerate={generateHandlers["objectives"]}
                isGenerating={isGenerating("objectives")}
                isAutosaveEnabled={isAutosaveEnabled}
                registerFlush={registerFlushCallbacks["objectives"]}
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
                stepResources["personas"]?.length &&
                (s?.personas?.show_ai_generate ?? false) ? (
                  <StepCardAiButton
                    stepId="personas"
                    resourceTypes={stepResources["personas"]}
                    canRegenerate={canRegenerate}
                    isGenerating={isGeneratingStepResource}
                    onOpenModal={handleOpenStepCardModal}
                    disabled={disabled}
                  />
                ) : undefined
              }
              {...resetProps}
            >
              <div className="space-y-6">
                <Personas
                  persona_ids={formState.persona_ids}
                  persona_resources={
                    s?.personas?.current ?? []
                  }
                  show_personas={s?.personas?.show ?? false}
                  persona_suggestions={
                    s?.personas?.suggestions ?? []
                  }
                  personas={s?.personas?.resources ?? []}
                  disabled={disabled}
                  onChange={(ids) =>
                    setFormState((prev) => ({ ...prev, persona_ids: ids }))
                  }
                  group_id={s?.group_id ?? null}
                  required={s?.personas?.required ?? false}
                  onGenerate={generateHandlers["personas"]}
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
                stepResources["documents"]?.length &&
                (s?.documents?.show_ai_generate ?? false) ? (
                  <StepCardAiButton
                    stepId="documents"
                    resourceTypes={stepResources["documents"]}
                    canRegenerate={canRegenerate}
                    isGenerating={isGeneratingStepResource}
                    onOpenModal={handleOpenStepCardModal}
                    disabled={disabled}
                  />
                ) : undefined
              }
              {...resetProps}
            >
              <div className="space-y-6">
                <Documents
                  document_ids={formState.document_ids}
                  document_resources={
                    s?.documents?.current ?? []
                  }
                  show_documents={s?.documents?.show ?? false}
                  document_suggestions={
                    s?.documents?.suggestions ?? []
                  }
                  documents={s?.documents?.resources ?? []}
                  disabled={disabled}
                  onChange={(ids) =>
                    setFormState((prev) => ({ ...prev, document_ids: ids }))
                  }
                  group_id={s?.group_id ?? null}
                  required={s?.documents?.required ?? false}
                  onGenerate={generateHandlers["documents"]}
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
                stepResources["templates"]?.length &&
                (s?.templates?.show_ai_generate ?? false) ? (
                  <StepCardAiButton
                    stepId="templates"
                    resourceTypes={stepResources["templates"]}
                    canRegenerate={canRegenerate}
                    isGenerating={isGeneratingStepResource}
                    onOpenModal={handleOpenStepCardModal}
                    disabled={disabled}
                  />
                ) : undefined
              }
              {...resetProps}
            >
              <Templates
                template_ids={formState.template_ids}
                template_resources={
                  s?.templates?.current ?? []
                }
                show_templates={showTemplatesSection}
                template_suggestions={
                  s?.templates?.suggestions ?? []
                }
                templates={s?.templates?.resources ?? []}
                searchTerm={templateSearch}
                disabled={disabled}
                onChange={(ids) =>
                  setFormState((prev) => ({ ...prev, template_ids: ids }))
                }
                group_id={s?.group_id ?? null}
                required={s?.templates?.required ?? false}
                createTemplatesAction={
                  createTemplatesAction as
                    | ((
                        input: CreateDraftTemplatesIn
                      ) => Promise<CreateDraftTemplatesOut>)
                    | undefined
                }
                onGenerate={generateHandlers["templates"]}
                isGenerating={isGenerating("templates")}
                isAutosaveEnabled={isAutosaveEnabled}
                registerFlush={registerFlushCallbacks["templates"]}
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
                stepResources["parameters"]?.length &&
                ((s?.parameters?.show_ai_generate ?? false) ||
                  (s?.parameter_fields?.show_ai_generate ??
                    false)) ? (
                  <StepCardAiButton
                    stepId="parameters"
                    resourceTypes={stepResources["parameters"]}
                    canRegenerate={canRegenerate}
                    isGenerating={isGeneratingStepResource}
                    onOpenModal={handleOpenStepCardModal}
                    disabled={disabled}
                  />
                ) : undefined
              }
              {...resetProps}
            >
              <div className="space-y-6">
                <Parameters
                  parameter_ids={formState.parameter_ids}
                  parameter_resources={
                    s?.parameters?.current ?? []
                  }
                  show_parameters={
                    s?.parameters?.show ?? false
                  }
                  parameter_suggestions={
                    s?.parameters?.suggestions ?? []
                  }
                  parameters={s?.parameters?.resources ?? []}
                  searchTerm={parameterSearch}
                  showSelectedFilter={parameterShowSelected}
                  disabled={disabled}
                  onChange={(ids) =>
                    setFormState((prev) => ({ ...prev, parameter_ids: ids }))
                  }
                  group_id={s?.group_id ?? null}
                  required={s?.parameters?.required ?? false}
                  onGenerate={generateHandlers["parameters"]}
                  isGenerating={isGenerating("parameters")}
                  videoEnabled={videoEnabled}
                  aiParameterResources={aiFormData.parameter_resources ?? null}
                  onAccept={() => clearAiResource("parameter_resources")}
                  onReject={() => clearAiResource("parameter_resources")}
                />
                <ParameterFields
                  parameter_field_ids={formState.parameter_field_ids}
                  parameter_field_resources={
                    s?.parameter_fields?.current ?? []
                  }
                  show_parameter_fields={
                    s?.parameter_fields?.show ?? false
                  }
                  parameter_fields={s?.parameter_fields?.resources ?? []}
                  parameter_ids={formState.parameter_ids}
                  parameters={s?.parameters?.resources ?? []}
                  parameter_resources={
                    s?.parameters?.current ?? []
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
                  group_id={s?.group_id ?? null}
                  required={
                    s?.parameter_fields?.required ?? false
                  }
                  createParameterFieldsAction={createParameterFieldsAction}
                  isAutosaveEnabled={isAutosaveEnabled}
                  registerFlush={registerFlushCallbacks["parameter_fields"]}
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
                stepResources["images"]?.length &&
                (s?.images?.show_ai_generate ?? false) ? (
                  <StepCardAiButton
                    stepId="images"
                    resourceTypes={stepResources["images"]}
                    canRegenerate={canRegenerate}
                    isGenerating={isGeneratingStepResource}
                    onOpenModal={handleOpenStepCardModal}
                    disabled={disabled}
                  />
                ) : undefined
              }
              {...resetProps}
            >
              <Images
                image_ids={formState.image_ids}
                image_resources={s?.images?.current ?? []}
                show_images={showImagesSection}
                images_required={s?.images?.required ?? false}
                image_suggestions={s?.images?.suggestions ?? []}
                images={s?.images?.resources ?? []}
                disabled={disabled}
                onChange={(ids) =>
                  setFormState((prev) => ({ ...prev, image_ids: ids }))
                }
                group_id={s?.group_id ?? null}
                createImagesAction={
                  createImagesAction as
                    | ((
                        input: CreateDraftImagesIn
                      ) => Promise<CreateDraftImagesOut>)
                    | undefined
                }
                onGenerate={generateHandlers["images"]}
                isGenerating={isGenerating("images")}
                multiSelect={true}
                maxImages={3}
                isAutosaveEnabled={isAutosaveEnabled}
                registerFlush={registerFlushCallbacks["images"]}
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
                stepResources["videos"]?.length &&
                (s?.videos?.show_ai_generate ?? false) ? (
                  <StepCardAiButton
                    stepId="videos"
                    resourceTypes={stepResources["videos"]}
                    canRegenerate={canRegenerate}
                    isGenerating={isGeneratingStepResource}
                    onOpenModal={handleOpenStepCardModal}
                    disabled={disabled}
                  />
                ) : undefined
              }
              {...resetProps}
            >
              <Videos
                video_ids={formState.video_ids}
                video_resources={s?.videos?.current ?? []}
                show_videos={showVideosSection}
                videos_required={s?.videos?.required ?? false}
                video_suggestions={s?.videos?.suggestions ?? []}
                videos={s?.videos?.resources ?? []}
                disabled={disabled}
                onChange={(ids) =>
                  setFormState((prev) => ({ ...prev, video_ids: ids }))
                }
                group_id={s?.group_id ?? null}
                createVideosAction={
                  createVideosAction as
                    | ((
                        input: CreateDraftVideosIn
                      ) => Promise<CreateDraftVideosOut>)
                    | undefined
                }
                onGenerate={generateHandlers["videos"]}
                isGenerating={isGenerating("videos")}
                isAutosaveEnabled={isAutosaveEnabled}
                registerFlush={registerFlushCallbacks["videos"]}
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
                stepResources["questions"]?.length &&
                (s?.questions?.show_ai_generate ?? false) ? (
                  <StepCardAiButton
                    stepId="questions"
                    resourceTypes={stepResources["questions"]}
                    canRegenerate={canRegenerate}
                    isGenerating={isGeneratingStepResource}
                    onOpenModal={handleOpenStepCardModal}
                    disabled={disabled}
                  />
                ) : undefined
              }
              {...resetProps}
            >
              <Questions
                question_ids={formState.question_ids}
                question_resources={
                  s?.questions?.current ?? []
                }
                show_questions={showQuestionsSection}
                questions_required={
                  s?.questions?.required ?? false
                }
                question_suggestions={
                  s?.questions?.suggestions ?? []
                }
                questions={s?.questions?.resources ?? []}
                disabled={disabled}
                onChange={(ids) =>
                  setFormState((prev) => ({ ...prev, question_ids: ids }))
                }
                group_id={s?.group_id ?? null}
                createQuestionsAction={
                  createQuestionsAction as
                    | ((
                        input: CreateDraftQuestionsIn
                      ) => Promise<CreateDraftQuestionsOut>)
                    | undefined
                }
                onGenerate={generateHandlers["questions"]}
                isGenerating={isGenerating("questions")}
                isAutosaveEnabled={isAutosaveEnabled}
                registerFlush={registerFlushCallbacks["questions"]}
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
      generateHandlers,
      isGenerating,
      isGeneratingStepResource,
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
      canRegenerate,
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
      aiFormData,
      clearAiResource,
      videoEnabled,
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

        {modalProps.open && (
          <GenerateRegenerateModal {...modalProps} />
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
  const prevFingerprint = JSON.stringify(prevScenarioData ?? null);
  const nextFingerprint = JSON.stringify(nextScenarioData ?? null);

  if (
    prevProps.scenarioId !== nextProps.scenarioId ||
    prevFingerprint !== nextFingerprint
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
