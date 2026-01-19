/**
 * Scenario.tsx
 * Implementation using modular resource components
 * Used to create and manage scenarios - supports both creation and editing
 * Follows Persona.tsx pattern, adapted for scenarios
 */
"use client";

import { useRouter } from "next/navigation";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { Fields } from "@/components/resources/Fields";
import { Flags } from "@/components/resources/Flags";
import { Images } from "@/components/resources/Images";
import { Names } from "@/components/resources/Names";
import { Objectives } from "@/components/resources/Objectives";
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
import { useGenerationContext } from "@/contexts/generation-context";
import { useProfile } from "@/contexts/profile-context";
import type { InputOf, OutputOf } from "@/lib/api/types";
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
type CreateDraftScenarioFlagsIn = InputOf<
  "/api/v4/resources/scenario_flags",
  "post"
>;
type CreateDraftScenarioFlagsOut = OutputOf<
  "/api/v4/resources/scenario_flags",
  "post"
>;
type CreateDraftDepartmentsIn = InputOf<
  "/api/v4/resources/departments",
  "post"
>;
type CreateDraftDepartmentsOut = OutputOf<
  "/api/v4/resources/departments",
  "post"
>;
type CreateDraftPersonasIn = InputOf<"/api/v4/resources/personas", "post">;
type CreateDraftPersonasOut = OutputOf<
  "/api/v4/resources/personas",
  "post"
>;
type CreateDraftDocumentsIn = InputOf<"/api/v4/resources/documents", "post">;
type CreateDraftDocumentsOut = OutputOf<
  "/api/v4/resources/documents",
  "post"
>;
type CreateDraftTemplatesIn = InputOf<"/api/v4/resources/templates", "post">;
type CreateDraftTemplatesOut = OutputOf<
  "/api/v4/resources/templates",
  "post"
>;
type CreateDraftParametersIn = InputOf<"/api/v4/resources/parameters", "post">;
type CreateDraftParametersOut = OutputOf<
  "/api/v4/resources/parameters",
  "post"
>;
type CreateDraftFieldsIn = InputOf<"/api/v4/resources/fields", "post">;
type CreateDraftFieldsOut = OutputOf<
  "/api/v4/resources/fields",
  "post"
>;
type CreateDraftImagesIn = InputOf<"/api/v4/resources/images", "post">;
type CreateDraftImagesOut = OutputOf<
  "/api/v4/resources/images",
  "post"
>;
type CreateDraftVideosIn = InputOf<"/api/v4/resources/videos", "post">;
type CreateDraftVideosOut = OutputOf<
  "/api/v4/resources/videos",
  "post"
>;
type CreateDraftQuestionsIn = InputOf<"/api/v4/resources/questions", "post">;
type CreateDraftQuestionsOut = OutputOf<
  "/api/v4/resources/questions",
  "post"
>;

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
  | "fields"
  | "images"
  | "videos"
  | "questions"
  | "ranges";

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
  department_ids: string[];
  persona_ids: string[];
  document_ids: string[];
  template_ids: string[];
  parameter_ids: string[];
  field_ids: string[];
  image_ids: string[];
  objective_ids: string[];
  video_ids: string[];
  question_ids: string[];
};

type CreateFlagsIn = InputOf<"/api/v4/resources/flags", "post">;
type CreateFlagsOut = OutputOf<"/api/v4/resources/flags", "post">;

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
  createScenarioFlagsAction?: (
    input: CreateDraftScenarioFlagsIn
  ) => Promise<CreateDraftScenarioFlagsOut>;
  createDepartmentsAction?: (
    input: CreateDraftDepartmentsIn
  ) => Promise<CreateDraftDepartmentsOut>;
  createPersonasAction?: (
    input: CreateDraftPersonasIn
  ) => Promise<CreateDraftPersonasOut>;
  createDocumentsAction?: (
    input: CreateDraftDocumentsIn
  ) => Promise<CreateDraftDocumentsOut>;
  createTemplatesAction?: (
    input: CreateDraftTemplatesIn
  ) => Promise<CreateDraftTemplatesOut>;
  createParametersAction?: (
    input: CreateDraftParametersIn
  ) => Promise<CreateDraftParametersOut>;
  createFieldsAction?: (
    input: CreateDraftFieldsIn
  ) => Promise<CreateDraftFieldsOut>;
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
  createScenarioFlagsAction,
  createDepartmentsAction,
  createPersonasAction,
  createDocumentsAction,
  createTemplatesAction,
  createParametersAction,
  createFieldsAction,
  createImagesAction,
  createVideosAction,
  createQuestionsAction,
}: ScenarioProps) {
  const router = useRouter();
  const isEditMode = !!scenarioId;
  const {
    effectiveProfile,
    selectedDraftId,
    setSelectedDraftId,
    socket,
    isConnected,
  } = useProfile();
  const { setEntityMetadata, clearEntityMetadata } = useBreadcrumbContext();
  const { setGenerationCapability, clearGenerationCapability } =
    useGenerationContext();

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

  const isGenerating = useCallback(
    (resourceType: ScenarioResourceType) =>
      generatingResources.has(resourceType),
    [generatingResources]
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

  const onFormDataChange = useCallback((fd: Record<string, unknown>) => {
    formDataRef.current = fd;
    const nextDraftId = (fd["draftId"] as string | undefined) ?? null;
    setDraftId((prev) => (prev === nextDraftId ? prev : nextDraftId));
  }, []);

  // Sync URL draftId to profile context
  useEffect(() => {
    if (draftId !== selectedDraftId) {
      setSelectedDraftId(draftId);
    }
  }, [draftId, selectedDraftId, setSelectedDraftId]);

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
        department_ids: [],
        persona_ids: [],
        document_ids: [],
        template_ids: [],
        parameter_ids: [],
        field_ids: [],
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
      objectives_enabled_flag_id: scenarioData.objectives_enabled_flag_id ?? null,
      images_enabled_flag_id: scenarioData.images_enabled_flag_id ?? null,
      video_enabled_flag_id: scenarioData.video_enabled_flag_id ?? null,
      questions_enabled_flag_id: scenarioData.questions_enabled_flag_id ?? null,
      problem_statement_enabled_flag_id:
        scenarioData.problem_statement_enabled_flag_id ?? null,
      department_ids: (scenarioData.department_ids ?? []).map(String),
      persona_ids: (scenarioData.persona_ids ?? []).map(String),
      document_ids: (scenarioData.document_ids ?? []).map(String),
      template_ids: (scenarioData.template_ids ?? []).map(String),
      parameter_ids: (scenarioData.parameter_ids ?? []).map(String),
      field_ids: (scenarioData.field_ids ?? []).map(String),
      image_ids: (scenarioData.image_ids ?? []).map(String),
      objective_ids: (scenarioData.objective_ids ?? []).map(String),
      video_ids: (scenarioData.video_ids ?? []).map(String),
      question_ids: (scenarioData.question_ids ?? []).map(String),
    };
  }, [scenarioData]);

  const [formState, setFormState] = useState<ScenarioFormState>(
    getInitialFormState
  );

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
  const fieldIdsStr = useMemo(
    () => JSON.stringify(formState.field_ids),
    [formState.field_ids]
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

  useEffect(() => {
    const newState = getInitialFormState();
    setFormState((prev) => {
      if (
        prev.name_id !== newState.name_id ||
        prev.description_id !== newState.description_id ||
        prev.problem_statement_id !== newState.problem_statement_id ||
        prev.active_flag_id !== newState.active_flag_id ||
        prev.objectives_enabled_flag_id !== newState.objectives_enabled_flag_id ||
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
        JSON.stringify(prev.template_ids) !==
          JSON.stringify(newState.template_ids) ||
        JSON.stringify(prev.parameter_ids) !==
          JSON.stringify(newState.parameter_ids) ||
        JSON.stringify(prev.field_ids) !== JSON.stringify(newState.field_ids) ||
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
  }, [
    getInitialFormState,
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
    JSON.stringify(scenarioData?.video_ids),
    JSON.stringify(scenarioData?.question_ids),
  ]);

  // Draft version tracking for optimistic concurrency control
  const [lastSavedVersion, setLastSavedVersion] = useState(0);
  const lastSavedVersionRef = useRef(0);
  useEffect(() => {
    lastSavedVersionRef.current = lastSavedVersion;
  }, [lastSavedVersion]);

  const patchScenarioDraftActionRef = useRef(patchScenarioDraftAction);
  useEffect(() => {
    patchScenarioDraftActionRef.current = patchScenarioDraftAction;
  }, [patchScenarioDraftAction]);

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
        department_ids: formState.department_ids,
        persona_ids: formState.persona_ids,
        document_ids: formState.document_ids,
        template_ids: formState.template_ids,
        parameter_ids: formState.parameter_ids,
        field_ids: formState.field_ids,
        image_ids: formState.image_ids,
        objective_ids: formState.objective_ids,
        video_ids: formState.video_ids,
        question_ids: formState.question_ids,
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
      departmentIdsStr,
      personaIdsStr,
      documentIdsStr,
      templateIdsStr,
      parameterIdsStr,
      fieldIdsStr,
      imageIdsStr,
      objectiveIdsStr,
      videoIdsStr,
      questionIdsStr,
    ]
  );

  const lastPatchedKeyRef = useRef<string | null>(null);

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
      formState.department_ids.length > 0 ||
      formState.persona_ids.length > 0 ||
      formState.document_ids.length > 0 ||
      formState.template_ids.length > 0 ||
      formState.parameter_ids.length > 0 ||
      formState.field_ids.length > 0 ||
      formState.image_ids.length > 0 ||
      formState.objective_ids.length > 0 ||
      formState.video_ids.length > 0 ||
      formState.question_ids.length > 0;

    if (!hasResourceIds || !patchScenarioDraftActionRef.current) {
      return;
    }

    if (lastPatchedKeyRef.current === draftPatchKey) {
      return;
    }

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
            department_ids: formState.department_ids,
            persona_ids: formState.persona_ids,
            document_ids: formState.document_ids,
            template_ids: formState.template_ids,
            parameter_ids: formState.parameter_ids,
            field_ids: formState.field_ids,
            image_ids: formState.image_ids,
            objective_ids: formState.objective_ids,
            video_ids: formState.video_ids,
            question_ids: formState.question_ids,
            expected_version: lastSavedVersionRef.current,
          },
        });

        lastPatchedKeyRef.current = draftPatchKey;

        if (!draftId && result.draft_id) {
          setUrlFormDataRef.current?.({ draftId: result.draft_id });
        }

        if ((result.new_version ?? 0) !== lastSavedVersionRef.current) {
          setLastSavedVersion(result.new_version ?? 0);
          lastSavedVersionRef.current = result.new_version ?? 0;
        }
      } catch {
        // Draft save failed - API logs handle details
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [draftPatchKey, draftId, formState]);

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
      active_flag_resource: scenarioData.active_flag_resource,
      show_active_flag: scenarioData.show_active_flag,
      active_flag_agent_id: scenarioData.active_flag_agent_id,
      active_flag_required: scenarioData.active_flag_required,
      objectives_enabled_flag_resource:
        scenarioData.objectives_enabled_flag_resource,
      show_objectives_enabled_flag: scenarioData.show_objectives_enabled_flag,
      objectives_enabled_flag_agent_id:
        scenarioData.objectives_enabled_flag_agent_id,
      objectives_enabled_flag_required:
        scenarioData.objectives_enabled_flag_required,
      images_enabled_flag_resource: scenarioData.images_enabled_flag_resource,
      show_images_enabled_flag: scenarioData.show_images_enabled_flag,
      images_enabled_flag_agent_id: scenarioData.images_enabled_flag_agent_id,
      images_enabled_flag_required: scenarioData.images_enabled_flag_required,
      video_enabled_flag_resource: scenarioData.video_enabled_flag_resource,
      show_video_enabled_flag: scenarioData.show_video_enabled_flag,
      video_enabled_flag_agent_id: scenarioData.video_enabled_flag_agent_id,
      video_enabled_flag_required: scenarioData.video_enabled_flag_required,
      questions_enabled_flag_resource:
        scenarioData.questions_enabled_flag_resource,
      show_questions_enabled_flag: scenarioData.show_questions_enabled_flag,
      questions_enabled_flag_agent_id:
        scenarioData.questions_enabled_flag_agent_id,
      questions_enabled_flag_required:
        scenarioData.questions_enabled_flag_required,
      problem_statement_enabled_flag_resource:
        scenarioData.problem_statement_enabled_flag_resource,
      show_problem_statement_enabled_flag:
        scenarioData.show_problem_statement_enabled_flag,
      problem_statement_enabled_flag_agent_id:
        scenarioData.problem_statement_enabled_flag_agent_id,
      problem_statement_enabled_flag_required:
        scenarioData.problem_statement_enabled_flag_required,
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
      field_resources: scenarioData.field_resources,
      show_fields: scenarioData.show_fields,
      fields_agent_id: scenarioData.fields_agent_id,
      fields_required: scenarioData.fields_required,
      field_suggestions: scenarioData.field_suggestions,
      fields: scenarioData.fields,
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
      general_agent_id: scenarioData.general_agent_id,
      basic_agent_id: scenarioData.basic_agent_id,
      content_agent_id: scenarioData.content_agent_id,
    };
  }, [scenarioData]);

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
            stableScenarioDataFields.active_flag_resource?.generated ??
            false ||
            stableScenarioDataFields.objectives_enabled_flag_resource
              ?.generated ||
            stableScenarioDataFields.images_enabled_flag_resource?.generated ||
            stableScenarioDataFields.video_enabled_flag_resource?.generated ||
            stableScenarioDataFields.questions_enabled_flag_resource
              ?.generated ||
            stableScenarioDataFields.problem_statement_enabled_flag_resource
              ?.generated ||
            false
          );
        case "departments":
          return (
            stableScenarioDataFields.department_resources?.some(
              (d) => d.generated
            ) ?? false
          );
        case "personas":
          return (
            stableScenarioDataFields.persona_resources?.some((p) => p.generated) ??
            false
          );
        case "documents":
          return (
            stableScenarioDataFields.document_resources?.some((d) => d.generated) ??
            false
          );
        case "templates":
          return (
            stableScenarioDataFields.template_resources?.some((t) => t.generated) ??
            false
          );
        case "parameters":
          return (
            stableScenarioDataFields.parameter_resources?.some(
              (p) => p.generated
            ) ?? false
          );
        case "fields":
          return (
            stableScenarioDataFields.field_resources?.some((f) => f.generated) ??
            false
          );
        case "images":
          return (
            stableScenarioDataFields.image_resources?.some((i) => i.generated) ??
            false
          );
        case "videos":
          return (
            stableScenarioDataFields.video_resources?.some((v) => v.generated) ??
            false
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
    if (scenarioData?.general_agent_id) {
      setGenerationCapability({
        artifactType: "scenario",
        canGenerate: true,
        agentId: scenarioData.general_agent_id,
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
    scenarioData?.general_agent_id,
    setGenerationCapability,
    clearGenerationCapability,
  ]);

  useEffect(() => {
    if (!socket || !isConnected) return;

    const currentGroupId = scenarioData?.group_id;

    const handleGenerationComplete = (data: {
      artifact_type?: string;
      group_id?: string;
      resource_type?: string;
      resource_id?: string;
      name_id?: string | null;
      description_id?: string | null;
      problem_statement_id?: string | null;
      objective_ids?: string[];
      department_ids?: string[];
      persona_ids?: string[];
      document_ids?: string[];
      template_ids?: string[];
      parameter_ids?: string[];
      field_ids?: string[];
      image_ids?: string[];
      video_ids?: string[];
      question_ids?: string[];
      active_flag_id?: string | null;
      objectives_enabled_flag_id?: string | null;
      images_enabled_flag_id?: string | null;
      video_enabled_flag_id?: string | null;
      questions_enabled_flag_id?: string | null;
      problem_statement_enabled_flag_id?: string | null;
      message?: string;
      success?: boolean;
      [key: string]: unknown;
    }) => {
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
        "fields",
        "images",
        "videos",
        "questions",
        "ranges",
      ];

      if (
        data.resource_type &&
        validResourceTypes.includes(data.resource_type as ScenarioResourceType)
      ) {
        setFormState((prev) => {
          const updates: Partial<ScenarioFormState> = {};

          if (data.name_id) updates.name_id = data.name_id;
          if (data.description_id) updates.description_id = data.description_id;
          if (data.problem_statement_id)
            updates.problem_statement_id = data.problem_statement_id;
          if (data.active_flag_id) updates.active_flag_id = data.active_flag_id;
          if (data.objectives_enabled_flag_id)
            updates.objectives_enabled_flag_id =
              data.objectives_enabled_flag_id;
          if (data.images_enabled_flag_id)
            updates.images_enabled_flag_id = data.images_enabled_flag_id;
          if (data.video_enabled_flag_id)
            updates.video_enabled_flag_id = data.video_enabled_flag_id;
          if (data.questions_enabled_flag_id)
            updates.questions_enabled_flag_id = data.questions_enabled_flag_id;
          if (data.problem_statement_enabled_flag_id)
            updates.problem_statement_enabled_flag_id =
              data.problem_statement_enabled_flag_id;

          if (data.objective_ids && data.objective_ids.length > 0) {
            const newIds = data.objective_ids.filter(
              (id) => !prev.objective_ids.includes(id)
            );
            updates.objective_ids = [...prev.objective_ids, ...newIds];
          }
          if (data.department_ids && data.department_ids.length > 0) {
            const newIds = data.department_ids.filter(
              (id) => !prev.department_ids.includes(id)
            );
            updates.department_ids = [...prev.department_ids, ...newIds];
          }
          if (data.persona_ids && data.persona_ids.length > 0) {
            const newIds = data.persona_ids.filter(
              (id) => !prev.persona_ids.includes(id)
            );
            updates.persona_ids = [...prev.persona_ids, ...newIds];
          }
          if (data.document_ids && data.document_ids.length > 0) {
            const newIds = data.document_ids.filter(
              (id) => !prev.document_ids.includes(id)
            );
            updates.document_ids = [...prev.document_ids, ...newIds];
          }
          if (data.template_ids && data.template_ids.length > 0) {
            const newIds = data.template_ids.filter(
              (id) => !prev.template_ids.includes(id)
            );
            updates.template_ids = [...prev.template_ids, ...newIds];
          }
          if (data.parameter_ids && data.parameter_ids.length > 0) {
            const newIds = data.parameter_ids.filter(
              (id) => !prev.parameter_ids.includes(id)
            );
            updates.parameter_ids = [...prev.parameter_ids, ...newIds];
          }
          if (data.field_ids && data.field_ids.length > 0) {
            const newIds = data.field_ids.filter(
              (id) => !prev.field_ids.includes(id)
            );
            updates.field_ids = [...prev.field_ids, ...newIds];
          }
          if (data.image_ids && data.image_ids.length > 0) {
            const newIds = data.image_ids.filter(
              (id) => !prev.image_ids.includes(id)
            );
            updates.image_ids = [...prev.image_ids, ...newIds];
          }
          if (data.video_ids && data.video_ids.length > 0) {
            updates.video_ids = data.video_ids;
          }
          if (data.question_ids && data.question_ids.length > 0) {
            const newIds = data.question_ids.filter(
              (id) => !prev.question_ids.includes(id)
            );
            updates.question_ids = [...prev.question_ids, ...newIds];
          }

          if (data.resource_id && data.resource_type) {
            const resourceId = data.resource_id;
            switch (data.resource_type) {
              case "names":
                updates.name_id = resourceId;
                break;
              case "descriptions":
                updates.description_id = resourceId;
                break;
              case "problem_statements":
                updates.problem_statement_id = resourceId;
                break;
              case "objectives":
                updates.objective_ids = prev.objective_ids.includes(resourceId)
                  ? prev.objective_ids
                  : [...prev.objective_ids, resourceId];
                break;
              case "departments":
                updates.department_ids = prev.department_ids.includes(resourceId)
                  ? prev.department_ids
                  : [...prev.department_ids, resourceId];
                break;
              case "personas":
                updates.persona_ids = prev.persona_ids.includes(resourceId)
                  ? prev.persona_ids
                  : [...prev.persona_ids, resourceId];
                break;
              case "documents":
                updates.document_ids = prev.document_ids.includes(resourceId)
                  ? prev.document_ids
                  : [...prev.document_ids, resourceId];
                break;
              case "templates":
                updates.template_ids = prev.template_ids.includes(resourceId)
                  ? prev.template_ids
                  : [...prev.template_ids, resourceId];
                break;
              case "parameters":
                updates.parameter_ids = prev.parameter_ids.includes(resourceId)
                  ? prev.parameter_ids
                  : [...prev.parameter_ids, resourceId];
                break;
              case "fields":
                updates.field_ids = prev.field_ids.includes(resourceId)
                  ? prev.field_ids
                  : [...prev.field_ids, resourceId];
                break;
              case "images":
                updates.image_ids = prev.image_ids.includes(resourceId)
                  ? prev.image_ids
                  : [...prev.image_ids, resourceId];
                break;
              case "videos":
                updates.video_ids = [resourceId];
                break;
              case "questions":
                updates.question_ids = prev.question_ids.includes(resourceId)
                  ? prev.question_ids
                  : [...prev.question_ids, resourceId];
                break;
              default:
                break;
            }
          }

          return { ...prev, ...updates };
        });

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
        filter_field_ids: formState.field_ids.length
          ? formState.field_ids
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
      formState.field_ids,
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
      handleGenerateResources(
        ["personas"],
        determineAgentType(["personas"])
      ),
    [handleGenerateResources, determineAgentType]
  );

  const handleGenerateDocuments = useCallback(
    async () =>
      handleGenerateResources(
        ["documents"],
        determineAgentType(["documents"])
      ),
    [handleGenerateResources, determineAgentType]
  );

  const handleGenerateTemplates = useCallback(
    async () =>
      handleGenerateResources(
        ["templates"],
        determineAgentType(["templates"])
      ),
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

  const handleGenerateFields = useCallback(
    async () =>
      handleGenerateResources(["fields"], determineAgentType(["fields"])),
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
      handleGenerateResources(
        ["questions"],
        determineAgentType(["questions"])
      ),
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

  const stepResources: Record<string, ScenarioResourceType[]> = useMemo(
    () => ({
      basic: ["names", "descriptions", "scenario_flags", "departments"],
      configuration: ["scenario_flags"],
      content: ["problem_statements", "objectives"],
      resources: [
        "personas",
        "documents",
        "templates",
        "parameters",
        "fields",
      ],
      media: ["images", "videos", "questions"],
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
        "fields",
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
      fields: "Fields",
      images: "Images",
      videos: "Videos",
      questions: "Questions",
      ranges: "Ranges",
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

  useEffect(() => {
    const handleFullPageGenerate = () => {
      if (scenarioData?.general_agent_id) {
        handleOpenStepCardModal("all", "generate");
      }
    };
    window.addEventListener("full-page-generate", handleFullPageGenerate);
    return () =>
      window.removeEventListener("full-page-generate", handleFullPageGenerate);
  }, [scenarioData?.general_agent_id, handleOpenStepCardModal]);

  const steps = useMemo(
    () => [
      {
        id: "basic",
        title: "Basic Information",
        description:
          "Set the scenario name, description, departments, and active status.",
        resetFields: ["name", "description", "departments"],
      },
      {
        id: "configuration",
        title: "Configuration",
        description: "Enable or disable scenario features.",
        resetFields: ["configuration"],
      },
      {
        id: "content",
        title: "Content",
        description: "Define the problem statement and learning objectives.",
        resetFields: ["problem_statement", "objectives"],
      },
      {
        id: "resources",
        title: "Resources",
        description: "Select personas, documents, templates, parameters, fields.",
        resetFields: ["resources"],
      },
      {
        id: "media",
        title: "Media & Questions",
        description: "Select images, videos, and questions.",
        resetFields: ["media"],
      },
    ],
    []
  );

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
      backUrl: "/create/scenarios",
      backLabel: "Back",
      createLabel: "Save Scenario",
      updateLabel: "Save Scenario",
    }),
    []
  );

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

      if (
        scenarioData?.fields_required &&
        formState.field_ids.length === 0
      ) {
        toast.error("Fields are required");
        throw new Error("Fields are required");
      }

      if (
        scenarioData?.images_required &&
        formState.image_ids.length === 0
      ) {
        toast.error("Images are required");
        throw new Error("Images are required");
      }

      if (
        scenarioData?.videos_required &&
        formState.video_ids.length === 0
      ) {
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

      if (!effectiveProfile?.id) {
        toast.error("Profile not loaded. Please refresh the page.");
        throw new Error("Profile not loaded");
      }

      if (!saveScenarioAction) {
        toast.error("Save action not available");
        throw new Error("Save action not available");
      }

      if (!formState.name_id) {
        toast.error("Scenario name is required");
        throw new Error("Scenario name is required");
      }

      try {
        await saveScenarioAction({
          body: {
            input_scenario_id: isEditMode && scenarioId ? scenarioId : null,
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
            department_ids: formState.department_ids,
            persona_ids: formState.persona_ids,
            document_ids: formState.document_ids,
            template_document_ids: formState.template_ids,
            parameter_ids: formState.parameter_ids,
            field_ids: formState.field_ids,
            image_ids: formState.image_ids,
            objective_ids: formState.objective_ids,
            video_ids: formState.video_ids,
            question_ids: formState.question_ids,
          },
        });

        toast.success(
          `Scenario ${isEditMode ? "updated" : "created"} successfully!`
        );
        router.push("/create/scenarios");
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
      scenarioData?.fields_required,
      scenarioData?.images_required,
      scenarioData?.videos_required,
      scenarioData?.questions_required,
      effectiveProfile?.id,
      saveScenarioAction,
      isEditMode,
      scenarioId,
      router,
    ]
  );

  const getStepStatus = useCallback(
    (stepId: string, _formData: Record<string, unknown>): StepStatus => {
      const hasName = !!formState.name_id;
      const hasDescription = !!formState.description_id;
      const hasDepartments = formState.department_ids.length > 0;
      const hasProblemStatement = !!formState.problem_statement_id;
      const hasObjectives = formState.objective_ids.length > 0;
      const hasResources =
        formState.persona_ids.length > 0 ||
        formState.document_ids.length > 0 ||
        formState.template_ids.length > 0 ||
        formState.parameter_ids.length > 0 ||
        formState.field_ids.length > 0;
      const hasMedia =
        formState.image_ids.length > 0 ||
        formState.video_ids.length > 0 ||
        formState.question_ids.length > 0;

      switch (stepId) {
        case "basic":
          return hasName && hasDescription && hasDepartments
            ? "completed"
            : "active";
        case "configuration":
          if (!hasName || !hasDescription) return "pending";
          return "active";
        case "content":
          if (!hasName || !hasDescription) return "pending";
          return hasProblemStatement || hasObjectives ? "completed" : "active";
        case "resources":
          if (!hasName || !hasDescription) return "pending";
          return hasResources ? "completed" : "active";
        case "media":
          if (!hasName || !hasDescription) return "pending";
          return hasMedia ? "completed" : "active";
        default:
          return "pending";
      }
    },
    [formState]
  );

  const createScenarioFlagsWrapper = useCallback(
    async (input: CreateFlagsIn): Promise<CreateFlagsOut> => {
      if (!createScenarioFlagsAction) {
        return { flag_id: null };
      }
      const result = await createScenarioFlagsAction({
        body: {
          agent_id: input.body.agent_id,
          group_id: input.body.group_id,
          mcp: input.body.mcp,
        },
      });
      return { flag_id: result.scenario_flags_id ?? null };
    },
    [createScenarioFlagsAction]
  );

  const renderStep = useCallback(
    ({
      stepId,
      stepTitle,
      stepDescription,
      stepNumber,
      stepStatus,
      isOptional,
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
      const personaSearch = (formData["personaSearch"] as string | undefined) ?? "";
      const documentSearch = (formData["documentSearch"] as string | undefined) ?? "";
      const parameterSearch =
        (formData["parameterSearch"] as string | undefined) ?? "";
      const personaShowSelected =
        (formData["personaShowSelected"] as boolean | undefined) ?? false;
      const documentShowSelected =
        (formData["documentShowSelected"] as boolean | undefined) ?? false;
      const parameterShowSelected =
        (formData["parameterShowSelected"] as boolean | undefined) ?? false;

      const shouldShowGenerateAction = (stepKey: string, agentId?: string | null) =>
        stepResources[stepKey] && stepResources[stepKey].length > 0 && agentId;

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
                          onClick={() => handleOpenStepCardModal("basic", "generate")}
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
            >
              <Descriptions
                description_id={formState.description_id ?? null}
                description_resource={
                  currentScenarioData?.description_resource ?? null
                }
                show_description={currentScenarioData?.show_description ?? true}
                description_suggestions={
                  currentScenarioData?.description_suggestions ?? []
                }
                descriptions={currentScenarioData?.descriptions ?? []}
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
              />

              <Flags
                flag_id={formState.active_flag_id ?? null}
                flag_resource={currentScenarioData?.active_flag_resource ?? null}
                show_flag={currentScenarioData?.show_active_flag ?? false}
                disabled={disabled}
                onFlagIdChange={(flagId) =>
                  setFormState((prev) => ({ ...prev, active_flag_id: flagId }))
                }
                label="Active"
                helpText={currentScenarioData?.active_flag_resource?.description ?? undefined}
                iconId={currentScenarioData?.active_flag_resource?.icon_id ?? undefined}
                group_id={currentScenarioData?.group_id ?? null}
                agent_id={currentScenarioData?.active_flag_agent_id ?? null}
                createFlagsAction={
                  createScenarioFlagsAction
                    ? createScenarioFlagsWrapper
                    : undefined
                }
                onGenerate={handleGenerateFlags}
                isGenerating={isGenerating("scenario_flags")}
                required={currentScenarioData?.active_flag_required ?? false}
              />

              <Departments
                department_ids={formState.department_ids}
                department_resources={
                  currentScenarioData?.department_resources ?? []
                }
                show_departments={currentScenarioData?.show_departments ?? false}
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
                createDepartmentsAction={
                  createDepartmentsAction as
                    | ((
                        input: CreateDraftDepartmentsIn
                      ) => Promise<CreateDraftDepartmentsOut>)
                    | undefined
                }
                onGenerate={handleGenerateDepartments}
                isGenerating={isGenerating("departments")}
              />
            </StepCard>
          );
        case "configuration":
          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={disabled}
              isEditMode={isEditMode}
              resetFields={["configuration"]}
              actions={
                shouldShowGenerateAction(
                  "configuration",
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
                            handleOpenStepCardModal("configuration", "generate")
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
            >
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
                disabled={disabled}
                onFlagIdChange={(flagId) =>
                  setFormState((prev) => ({
                    ...prev,
                    problem_statement_enabled_flag_id: flagId,
                  }))
                }
                label="Problem Statement Enabled"
                helpText={
                  currentScenarioData?.problem_statement_enabled_flag_resource
                    ?.description ?? undefined
                }
                iconId={
                  currentScenarioData?.problem_statement_enabled_flag_resource
                    ?.icon_id ?? undefined
                }
                group_id={currentScenarioData?.group_id ?? null}
                agent_id={
                  currentScenarioData?.problem_statement_enabled_flag_agent_id ??
                  null
                }
                createFlagsAction={
                  createScenarioFlagsAction
                    ? createScenarioFlagsWrapper
                    : undefined
                }
                onGenerate={handleGenerateFlags}
                isGenerating={isGenerating("scenario_flags")}
                required={
                  currentScenarioData?.problem_statement_enabled_flag_required ??
                  false
                }
              />

              <Flags
                flag_id={formState.objectives_enabled_flag_id ?? null}
                flag_resource={
                  currentScenarioData?.objectives_enabled_flag_resource ?? null
                }
                show_flag={
                  currentScenarioData?.show_objectives_enabled_flag ?? false
                }
                disabled={disabled}
                onFlagIdChange={(flagId) =>
                  setFormState((prev) => ({
                    ...prev,
                    objectives_enabled_flag_id: flagId,
                  }))
                }
                label="Objectives Enabled"
                helpText={
                  currentScenarioData?.objectives_enabled_flag_resource
                    ?.description ?? undefined
                }
                iconId={
                  currentScenarioData?.objectives_enabled_flag_resource
                    ?.icon_id ?? undefined
                }
                group_id={currentScenarioData?.group_id ?? null}
                agent_id={
                  currentScenarioData?.objectives_enabled_flag_agent_id ?? null
                }
                createFlagsAction={
                  createScenarioFlagsAction
                    ? createScenarioFlagsWrapper
                    : undefined
                }
                onGenerate={handleGenerateFlags}
                isGenerating={isGenerating("scenario_flags")}
                required={
                  currentScenarioData?.objectives_enabled_flag_required ?? false
                }
              />

              <Flags
                flag_id={formState.images_enabled_flag_id ?? null}
                flag_resource={
                  currentScenarioData?.images_enabled_flag_resource ?? null
                }
                show_flag={currentScenarioData?.show_images_enabled_flag ?? false}
                disabled={disabled}
                onFlagIdChange={(flagId) =>
                  setFormState((prev) => ({
                    ...prev,
                    images_enabled_flag_id: flagId,
                  }))
                }
                label="Images Enabled"
                helpText={
                  currentScenarioData?.images_enabled_flag_resource?.description ??
                  undefined
                }
                iconId={
                  currentScenarioData?.images_enabled_flag_resource?.icon_id ??
                  undefined
                }
                group_id={currentScenarioData?.group_id ?? null}
                agent_id={currentScenarioData?.images_enabled_flag_agent_id ?? null}
                createFlagsAction={
                  createScenarioFlagsAction
                    ? createScenarioFlagsWrapper
                    : undefined
                }
                onGenerate={handleGenerateFlags}
                isGenerating={isGenerating("scenario_flags")}
                required={currentScenarioData?.images_enabled_flag_required ?? false}
              />

              <Flags
                flag_id={formState.video_enabled_flag_id ?? null}
                flag_resource={
                  currentScenarioData?.video_enabled_flag_resource ?? null
                }
                show_flag={currentScenarioData?.show_video_enabled_flag ?? false}
                disabled={disabled}
                onFlagIdChange={(flagId) =>
                  setFormState((prev) => ({
                    ...prev,
                    video_enabled_flag_id: flagId,
                  }))
                }
                label="Video Enabled"
                helpText={
                  currentScenarioData?.video_enabled_flag_resource?.description ??
                  undefined
                }
                iconId={
                  currentScenarioData?.video_enabled_flag_resource?.icon_id ??
                  undefined
                }
                group_id={currentScenarioData?.group_id ?? null}
                agent_id={currentScenarioData?.video_enabled_flag_agent_id ?? null}
                createFlagsAction={
                  createScenarioFlagsAction
                    ? createScenarioFlagsWrapper
                    : undefined
                }
                onGenerate={handleGenerateFlags}
                isGenerating={isGenerating("scenario_flags")}
                required={currentScenarioData?.video_enabled_flag_required ?? false}
              />

              <Flags
                flag_id={formState.questions_enabled_flag_id ?? null}
                flag_resource={
                  currentScenarioData?.questions_enabled_flag_resource ?? null
                }
                show_flag={
                  currentScenarioData?.show_questions_enabled_flag ?? false
                }
                disabled={disabled}
                onFlagIdChange={(flagId) =>
                  setFormState((prev) => ({
                    ...prev,
                    questions_enabled_flag_id: flagId,
                  }))
                }
                label="Questions Enabled"
                helpText={
                  currentScenarioData?.questions_enabled_flag_resource
                    ?.description ?? undefined
                }
                iconId={
                  currentScenarioData?.questions_enabled_flag_resource?.icon_id ??
                  undefined
                }
                group_id={currentScenarioData?.group_id ?? null}
                agent_id={currentScenarioData?.questions_enabled_flag_agent_id ?? null}
                createFlagsAction={
                  createScenarioFlagsAction
                    ? createScenarioFlagsWrapper
                    : undefined
                }
                onGenerate={handleGenerateFlags}
                isGenerating={isGenerating("scenario_flags")}
                required={currentScenarioData?.questions_enabled_flag_required ?? false}
              />
            </StepCard>
          );
        case "content":
          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={disabled}
              isEditMode={isEditMode}
              resetFields={["problem_statement", "objectives"]}
              actions={
                shouldShowGenerateAction(
                  "content",
                  currentScenarioData?.content_agent_id
                ) ? (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenStepCardModal("content", "generate")}
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
            >
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
                problem_statements={currentScenarioData?.problem_statements ?? []}
                disabled={disabled}
                onProblemStatementIdChange={(problemStatementId) =>
                  setFormState((prev) => ({
                    ...prev,
                    problem_statement_id: problemStatementId,
                  }))
                }
                onGenerate={handleGenerateProblemStatements}
                isGenerating={isGenerating("problem_statements")}
                placeholder="Define the core problem"
                required={currentScenarioData?.problem_statement_required ?? false}
                group_id={currentScenarioData?.group_id ?? null}
                agent_id={currentScenarioData?.problem_statement_agent_id ?? null}
                createProblemStatementsAction={
                  createProblemStatementsAction as
                    | ((
                        input: CreateDraftProblemStatementsIn
                      ) => Promise<CreateDraftProblemStatementsOut>)
                    | undefined
                }
              />

              <Objectives
                objective_ids={formState.objective_ids}
                objective_resources={currentScenarioData?.objective_resources ?? []}
                show_objectives={currentScenarioData?.show_objectives ?? false}
                objectives_agent_id={currentScenarioData?.objectives_agent_id ?? null}
                objectives_required={currentScenarioData?.objectives_required ?? false}
                objective_suggestions={currentScenarioData?.objective_suggestions ?? []}
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
              />
            </StepCard>
          );
        case "resources":
          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={disabled}
              isEditMode={isEditMode}
              searchTerm={personaSearch}
              onSearchChange={(value) => setFormData({ personaSearch: value })}
              resetFields={["resources"]}
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
                  "resources",
                  currentScenarioData?.general_agent_id
                ) ? (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            handleOpenStepCardModal("resources", "generate")
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
            >
              <Personas
                persona_ids={formState.persona_ids}
                persona_resources={currentScenarioData?.persona_resources ?? []}
                show_personas={currentScenarioData?.show_personas ?? false}
                persona_suggestions={currentScenarioData?.persona_suggestions ?? []}
                personas={currentScenarioData?.personas ?? []}
                disabled={disabled}
                onChange={(ids) =>
                  setFormState((prev) => ({ ...prev, persona_ids: ids }))
                }
                group_id={currentScenarioData?.group_id ?? null}
                personas_agent_id={currentScenarioData?.personas_agent_id ?? null}
                required={currentScenarioData?.personas_required ?? false}
                createPersonasAction={
                  createPersonasAction as
                    | ((
                        input: CreateDraftPersonasIn
                      ) => Promise<CreateDraftPersonasOut>)
                    | undefined
                }
                onGenerate={handleGeneratePersonas}
                isGenerating={isGenerating("personas")}
              />

              <Documents
                document_ids={formState.document_ids}
                document_resources={currentScenarioData?.document_resources ?? []}
                show_documents={currentScenarioData?.show_documents ?? false}
                document_suggestions={currentScenarioData?.document_suggestions ?? []}
                documents={currentScenarioData?.documents ?? []}
                disabled={disabled}
                onChange={(ids) =>
                  setFormState((prev) => ({ ...prev, document_ids: ids }))
                }
                group_id={currentScenarioData?.group_id ?? null}
                documents_agent_id={currentScenarioData?.documents_agent_id ?? null}
                required={currentScenarioData?.documents_required ?? false}
                createDocumentsAction={
                  createDocumentsAction as
                    | ((
                        input: CreateDraftDocumentsIn
                      ) => Promise<CreateDraftDocumentsOut>)
                    | undefined
                }
                onGenerate={handleGenerateDocuments}
                isGenerating={isGenerating("documents")}
              />

              <Templates
                template_ids={formState.template_ids}
                template_resources={currentScenarioData?.template_resources ?? []}
                show_templates={currentScenarioData?.show_templates ?? false}
                template_suggestions={currentScenarioData?.template_suggestions ?? []}
                templates={currentScenarioData?.templates ?? []}
                disabled={disabled}
                onChange={(ids) =>
                  setFormState((prev) => ({ ...prev, template_ids: ids }))
                }
                group_id={currentScenarioData?.group_id ?? null}
                templates_agent_id={currentScenarioData?.templates_agent_id ?? null}
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
                searchTerm={documentSearch}
                showSelectedFilter={documentShowSelected}
              />

              <Parameters
                parameter_ids={formState.parameter_ids}
                parameter_resources={
                  currentScenarioData?.parameter_resources ?? []
                }
                show_parameters={currentScenarioData?.show_parameters ?? false}
                parameter_suggestions={
                  currentScenarioData?.parameter_suggestions ?? []
                }
                parameters={currentScenarioData?.parameters ?? []}
                disabled={disabled}
                onChange={(ids) =>
                  setFormState((prev) => ({ ...prev, parameter_ids: ids }))
                }
                group_id={currentScenarioData?.group_id ?? null}
                agent_id={currentScenarioData?.parameters_agent_id ?? null}
                required={currentScenarioData?.parameters_required ?? false}
                createParametersAction={
                  createParametersAction as
                    | ((
                        input: CreateDraftParametersIn
                      ) => Promise<CreateDraftParametersOut>)
                    | undefined
                }
                onGenerate={handleGenerateParameters}
                isGenerating={isGenerating("parameters")}
                searchTerm={parameterSearch}
                showSelectedFilter={parameterShowSelected}
              />

              <Fields
                field_ids={formState.field_ids}
                field_resources={currentScenarioData?.field_resources ?? []}
                show_fields={currentScenarioData?.show_fields ?? false}
                field_suggestions={currentScenarioData?.field_suggestions ?? []}
                fields={currentScenarioData?.fields ?? []}
                disabled={disabled}
                onChange={(ids) =>
                  setFormState((prev) => ({ ...prev, field_ids: ids }))
                }
                group_id={currentScenarioData?.group_id ?? null}
                agent_id={currentScenarioData?.fields_agent_id ?? null}
                required={currentScenarioData?.fields_required ?? false}
                createFieldsAction={
                  createFieldsAction as
                    | ((input: CreateDraftFieldsIn) => Promise<CreateDraftFieldsOut>)
                    | undefined
                }
                searchTerm={parameterSearch}
                showSelectedFilter={parameterShowSelected}
              />
            </StepCard>
          );
        case "media":
          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={disabled}
              isEditMode={isEditMode}
              resetFields={["media"]}
              actions={
                shouldShowGenerateAction(
                  "media",
                  currentScenarioData?.content_agent_id
                ) ? (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenStepCardModal("media", "generate")}
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
            >
              <Images
                image_ids={formState.image_ids}
                image_resources={currentScenarioData?.image_resources ?? []}
                show_images={currentScenarioData?.show_images ?? false}
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
                    | ((input: CreateDraftImagesIn) => Promise<CreateDraftImagesOut>)
                    | undefined
                }
                onGenerate={handleGenerateImages}
                isGenerating={isGenerating("images")}
                multiSelect={true}
                maxImages={3}
              />

              <Videos
                video_ids={formState.video_ids}
                video_resources={currentScenarioData?.video_resources ?? []}
                show_videos={currentScenarioData?.show_videos ?? false}
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
                    | ((input: CreateDraftVideosIn) => Promise<CreateDraftVideosOut>)
                    | undefined
                }
                onGenerate={handleGenerateVideos}
                isGenerating={isGenerating("videos")}
              />

              <Questions
                question_ids={formState.question_ids}
                question_resources={currentScenarioData?.question_resources ?? []}
                show_questions={currentScenarioData?.show_questions ?? false}
                questions_agent_id={currentScenarioData?.questions_agent_id ?? null}
                questions_required={currentScenarioData?.questions_required ?? false}
                question_suggestions={currentScenarioData?.question_suggestions ?? []}
                questions={currentScenarioData?.questions ?? []}
                disabled={disabled}
                onChange={(ids) =>
                  setFormState((prev) => ({ ...prev, question_ids: ids }))
                }
                group_id={currentScenarioData?.group_id ?? null}
                agent_id={currentScenarioData?.questions_agent_id ?? null}
                createQuestionsAction={
                  createQuestionsAction as
                    | ((input: CreateDraftQuestionsIn) => Promise<CreateDraftQuestionsOut>)
                    | undefined
                }
                onGenerate={handleGenerateQuestions}
                isGenerating={isGenerating("questions")}
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
      handleGenerateFields,
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
      createScenarioFlagsWrapper,
      createDepartmentsAction,
      createPersonasAction,
      createDocumentsAction,
      createTemplatesAction,
      createParametersAction,
      createFieldsAction,
      createImagesAction,
      createVideosAction,
      createQuestionsAction,
      canRegenerate,
      handleOpenStepCardModal,
      stepResources,
    ]
  );

  return (
    <TooltipProvider>
      <div className="w-full p-6 space-y-8" data-page={`scenario-${isEditMode ? "edit" : "new"}`}>
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
    department_ids: prevScenarioData?.department_ids,
    persona_ids: prevScenarioData?.persona_ids,
    document_ids: prevScenarioData?.document_ids,
    template_ids: prevScenarioData?.template_ids,
    parameter_ids: prevScenarioData?.parameter_ids,
    field_ids: prevScenarioData?.field_ids,
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
    department_ids: nextScenarioData?.department_ids,
    persona_ids: nextScenarioData?.persona_ids,
    document_ids: nextScenarioData?.document_ids,
    template_ids: nextScenarioData?.template_ids,
    parameter_ids: nextScenarioData?.parameter_ids,
    field_ids: nextScenarioData?.field_ids,
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

export type { ScenarioProps };
