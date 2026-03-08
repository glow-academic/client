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
import { ReadOnlyBanner } from "@/components/common/forms/ReadOnlyBanner";
import { Departments } from "@/components/resources/Departments";
import { Descriptions } from "@/components/resources/Descriptions";
import { Documents } from "@/components/resources/Documents";
import { Flags } from "@/components/resources/Flags";
import { Images } from "@/components/resources/Images";
import { Names } from "@/components/resources/Names";
import { Objectives } from "@/components/resources/Objectives";
import { ParameterFieldsNew } from "@/components/resources/ParameterFieldsNew";
import { Personas } from "@/components/resources/Personas";
import { ProblemStatements } from "@/components/resources/ProblemStatements";
import { Options } from "@/components/resources/Options";
import { Questions } from "@/components/resources/Questions";
import { Videos } from "@/components/resources/Videos";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useProfile } from "@/contexts/profile-context";
import { useDrafts } from "@/contexts/draft-context";
import { useArtifactAi } from "@/hooks/use-artifact-ai";
import { useDraftLifecycle } from "@/hooks/use-draft-lifecycle";
import type { InputOf, OutputOf } from "@/lib/api/types";
import {
  buildDraftPayload,
  checkHasResourceIds,
  type ResourceConfig,
} from "@/lib/resources/action-builders";
import { parseAsArrayOf, parseAsBoolean, parseAsString, type Parser } from "nuqs";

// Types defined inline using InputOf/OutputOf
type GetScenarioOut = OutputOf<"/api/v5/artifacts/scenarios/get", "post">;
type CreateScenarioIn = InputOf<"/api/v5/artifacts/scenarios/create", "post">;
type CreateScenarioOut = OutputOf<"/api/v5/artifacts/scenarios/create", "post">;
type UpdateScenarioIn = InputOf<"/api/v5/artifacts/scenarios/update", "post">;
type UpdateScenarioOut = OutputOf<"/api/v5/artifacts/scenarios/update", "post">;
type PatchScenarioDraftIn = InputOf<
  "/api/v5/artifacts/scenarios/draft",
  "patch"
>;
type PatchScenarioDraftOut = OutputOf<
  "/api/v5/artifacts/scenarios/draft",
  "patch"
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
  | "parameters"
  | "parameter_fields"
  | "images"
  | "videos"
  | "questions"
  | "options";

type ScenarioFormState = {
  // ID fields
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
  parameter_field_ids: string[];
  image_ids: string[];
  objective_ids: string[];
  video_ids: string[];
  question_ids: string[];
  option_ids: string[];
  // Value fields for creatables (sent to draft endpoint when set)
  name: string | null;
  description: string | null;
  problem_statement: string | null;
};

export interface ScenarioProps {
  scenarioId?: string;
  // Server-provided data (for server-side rendering)
  scenarioDetailDefault?: GetScenarioOut; // For new mode
  scenarioDetail?: GetScenarioOut; // For edit mode
  // Server actions
  createScenarioAction?: (input: CreateScenarioIn) => Promise<CreateScenarioOut>;
  updateScenarioAction?: (input: UpdateScenarioIn) => Promise<UpdateScenarioOut>;
  patchScenarioDraftAction?: (
    input: PatchScenarioDraftIn,
  ) => Promise<PatchScenarioDraftOut>;
}

const VALID_RESOURCE_TYPES: ScenarioResourceType[] = [
  "names",
  "descriptions",
  "problem_statements",
  "objectives",
  "scenario_flags",
  "departments",
  "personas",
  "documents",
  "parameters",
  "parameter_fields",
  "images",
  "videos",
  "questions",
  "options",
];

const SCENARIO_RESOURCES: ResourceConfig[] = [
  { key: "names", formKey: "name_id", flushKey: null, type: "single" },
  {
    key: "descriptions",
    formKey: "description_id",
    flushKey: null,
    type: "single",
  },
  {
    key: "problem_statements",
    formKey: "problem_statement_id",
    flushKey: null,
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
  {
    key: "parameter_fields",
    formKey: "parameter_field_ids",
    flushKey: null,
    type: "multi",
  },
  { key: "images", formKey: "image_ids", flushKey: null, type: "multi" },
  {
    key: "objectives",
    formKey: "objective_ids",
    flushKey: null,
    type: "multi",
  },
  { key: "videos", formKey: "video_ids", flushKey: null, type: "multi" },
  {
    key: "questions",
    formKey: "question_ids",
    flushKey: null,
    type: "multi",
  },
  {
    key: "options",
    formKey: "option_ids",
    flushKey: null,
    type: "multi",
  },
];

function ScenarioComponent({
  scenarioId,
  scenarioDetailDefault: serverScenarioDetailDefault,
  scenarioDetail: serverScenarioDetail,
  createScenarioAction,
  updateScenarioAction,
  patchScenarioDraftAction,
}: ScenarioProps) {
  const router = useRouter();
  const isEditMode = !!scenarioId;
  const { profile } = useProfile();
  const { setSelectedDraftId, isAutosaveEnabled } = useDrafts();

  // Use scenarioDetail for edit mode, scenarioDetailDefault for new mode
  const scenarioData = isEditMode
    ? serverScenarioDetail
    : serverScenarioDetailDefault;

  // --- AI Generation State ---
  const { isGenerating, makeOnGenerationComplete, generate } =
    useArtifactAi({
      artifactType: "scenario",
      validResourceTypes: VALID_RESOURCE_TYPES as string[],
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
      imageSearch: parseAsString,
      videoSearch: parseAsString,
      personaShowSelected: parseAsBoolean,
      documentShowSelected: parseAsBoolean,
      parameterShowSelected: parseAsBoolean,
      parameterIds: parseAsArrayOf(parseAsString),
    }),
    [],
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
        department_ids: [],
        persona_ids: [],
        document_ids: [],
        parameter_field_ids: [],
        image_ids: [],
        objective_ids: [],
        video_ids: [],
        question_ids: [],
        option_ids: [],
        name: null,
        description: null,
        problem_statement: null,
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
      active_flag_id: selectedFlagId("scenario_active"),
      objectives_enabled_flag_id: selectedFlagId("objectives_enabled"),
      images_enabled_flag_id: selectedFlagId("images_enabled"),
      video_enabled_flag_id: selectedFlagId("video_enabled"),
      questions_enabled_flag_id: selectedFlagId("questions_enabled"),
      problem_statement_enabled_flag_id: selectedFlagId(
        "problem_statement_enabled",
      ),
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
      option_ids: (scenarioData.options?.current ?? [])
        .map((item: { option_id?: string | null }) => item.option_id)
        .filter(Boolean)
        .map(String),
      name: null,
      description: null,
      problem_statement: null,
    };
  }, [scenarioData]);

  const [formState, setFormState] =
    useState<ScenarioFormState>(getInitialFormState);
  const formStateRef = useRef<Record<string, unknown>>(
    formState as unknown as Record<string, unknown>,
  );
  const lastPatchedFormStateRef = useRef<ScenarioFormState | null>(null);
  // Track internal (unflushed) questions from Questions component for immediate Options rendering
  const [internalQuestions, setInternalQuestions] = useState<{ id: string; question_text: string }[]>([]);
  useEffect(() => {
    formStateRef.current = formState as unknown as Record<string, unknown>;
  }, [formState]);

  // Memoize stringified array dependencies
  const departmentIdsStr = useMemo(
    () => JSON.stringify(formState.department_ids),
    [formState.department_ids],
  );
  const personaIdsStr = useMemo(
    () => JSON.stringify(formState.persona_ids),
    [formState.persona_ids],
  );
  const documentIdsStr = useMemo(
    () => JSON.stringify(formState.document_ids),
    [formState.document_ids],
  );
  const parameterFieldIdsStr = useMemo(
    () => JSON.stringify(formState.parameter_field_ids),
    [formState.parameter_field_ids],
  );
  const imageIdsStr = useMemo(
    () => JSON.stringify(formState.image_ids),
    [formState.image_ids],
  );
  const objectiveIdsStr = useMemo(
    () => JSON.stringify(formState.objective_ids),
    [formState.objective_ids],
  );
  const videoIdsStr = useMemo(
    () => JSON.stringify(formState.video_ids),
    [formState.video_ids],
  );
  const questionIdsStr = useMemo(
    () => JSON.stringify(formState.question_ids),
    [formState.question_ids],
  );
  const optionIdsStr = useMemo(
    () => JSON.stringify(formState.option_ids),
    [formState.option_ids],
  );

  // Memoized stringified scenarioData array IDs for useEffect dependency
  const scenarioDepartmentIdsStr = useMemo(
    () =>
      JSON.stringify(
        (scenarioData?.departments?.current ?? [])
          .map((item) => item.department_id)
          .filter(Boolean),
      ),
    [scenarioData?.departments],
  );
  const scenarioPersonaIdsStr = useMemo(
    () =>
      JSON.stringify(
        (scenarioData?.personas?.current ?? [])
          .map((item) => item.persona_id)
          .filter(Boolean),
      ),
    [scenarioData?.personas],
  );
  const scenarioDocumentIdsStr = useMemo(
    () =>
      JSON.stringify(
        (scenarioData?.documents?.current ?? [])
          .map((item) => item.document_id)
          .filter(Boolean),
      ),
    [scenarioData?.documents],
  );
  const scenarioParameterFieldIdsStr = useMemo(
    () =>
      JSON.stringify(
        (scenarioData?.parameter_fields?.current ?? [])
          .map((item) => item.field_id)
          .filter(Boolean),
      ),
    [scenarioData?.parameter_fields],
  );
  const scenarioImageIdsStr = useMemo(
    () =>
      JSON.stringify(
        (scenarioData?.images?.current ?? [])
          .map((item) => item.image_id)
          .filter(Boolean),
      ),
    [scenarioData?.images],
  );
  const scenarioObjectiveIdsStr = useMemo(
    () =>
      JSON.stringify(
        (scenarioData?.objectives?.current ?? [])
          .map((item) => item.id)
          .filter(Boolean),
      ),
    [scenarioData?.objectives],
  );
  const scenarioVideoIdsStr = useMemo(
    () =>
      JSON.stringify(
        (scenarioData?.videos?.current ?? [])
          .map((item) => item.video_id)
          .filter(Boolean),
      ),
    [scenarioData?.videos],
  );
  const scenarioQuestionIdsStr = useMemo(
    () =>
      JSON.stringify(
        (scenarioData?.questions?.current ?? [])
          .map((item) => item.question_id)
          .filter(Boolean),
      ),
    [scenarioData?.questions],
  );
  const scenarioOptionIdsStr = useMemo(
    () =>
      JSON.stringify(
        (scenarioData?.options?.current ?? [])
          .map((item: { option_id?: string | null }) => item.option_id)
          .filter(Boolean),
      ),
    [scenarioData?.options],
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
        JSON.stringify(prev.department_ids) !==
          JSON.stringify(newState.department_ids) ||
        JSON.stringify(prev.persona_ids) !==
          JSON.stringify(newState.persona_ids) ||
        JSON.stringify(prev.document_ids) !==
          JSON.stringify(newState.document_ids) ||
        JSON.stringify(prev.parameter_field_ids) !==
          JSON.stringify(newState.parameter_field_ids) ||
        JSON.stringify(prev.image_ids) !== JSON.stringify(newState.image_ids) ||
        JSON.stringify(prev.objective_ids) !==
          JSON.stringify(newState.objective_ids) ||
        JSON.stringify(prev.video_ids) !== JSON.stringify(newState.video_ids) ||
        JSON.stringify(prev.question_ids) !==
          JSON.stringify(newState.question_ids) ||
        JSON.stringify(prev.option_ids) !==
          JSON.stringify(newState.option_ids)
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
    scenarioParameterFieldIdsStr,
    scenarioImageIdsStr,
    scenarioObjectiveIdsStr,
    scenarioVideoIdsStr,
    scenarioQuestionIdsStr,
    scenarioOptionIdsStr,
  ]);

  // --- Draft Lifecycle ---
  const patchScenarioDraftActionRef = useRef(patchScenarioDraftAction);
  useEffect(() => {
    patchScenarioDraftActionRef.current = patchScenarioDraftAction;
  }, [patchScenarioDraftAction]);

  // Stable ref wrapper for patch action
  const patchActionRef = useRef<
    | ((
        payload: Record<string, unknown>,
      ) => Promise<{ draft_id?: string | null; new_version?: number | null }>)
    | undefined
  >(undefined);
  useEffect(() => {
    if (patchScenarioDraftAction) {
      patchActionRef.current = async (payload: Record<string, unknown>) => {
        const result = await patchScenarioDraftAction({
          body: payload,
        } as PatchScenarioDraftIn);

        // Sync form_state from server response (server is source of truth)
        const fs = (result as Record<string, unknown>)?.["form_state"] as Record<string, unknown> | undefined;
        if (fs) {
          serverSyncPendingRef.current = true;
          setFormState((prev) => ({
            ...prev,
            name_id: (fs["name_id"] as string) ?? prev.name_id,
            description_id: (fs["description_id"] as string) ?? prev.description_id,
            problem_statement_id: (fs["problem_statement_id"] as string) ?? prev.problem_statement_id,
            flag_ids: (fs["flag_ids"] as string[]) ?? prev.active_flag_id,
            department_ids: (fs["department_ids"] as string[]) ?? prev.department_ids,
            persona_ids: (fs["persona_ids"] as string[]) ?? prev.persona_ids,
            document_ids: (fs["document_ids"] as string[]) ?? prev.document_ids,
            parameter_field_ids: (fs["parameter_field_ids"] as string[]) ?? prev.parameter_field_ids,
            objective_ids: (fs["objective_ids"] as string[]) ?? prev.objective_ids,
            image_ids: (fs["image_ids"] as string[]) ?? prev.image_ids,
            video_ids: (fs["video_ids"] as string[]) ?? prev.video_ids,
            question_ids: (fs["question_ids"] as string[]) ?? prev.question_ids,
            option_ids: (fs["option_ids"] as string[]) ?? prev.option_ids,
            // Clear value fields after server resolves them to IDs
            name: fs["name_id"] ? null : prev.name,
            description: fs["description_id"] ? null : prev.description,
            problem_statement: fs["problem_statement_id"] ? null : prev.problem_statement,
          }));
        }

        return result;
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
        department_ids: formState.department_ids,
        persona_ids: formState.persona_ids,
        document_ids: formState.document_ids,
        field_ids: formState.parameter_field_ids,
        image_ids: formState.image_ids,
        objective_ids: formState.objective_ids,
        video_ids: formState.video_ids,
        question_ids: formState.question_ids,
        option_ids: formState.option_ids,
        // Value fields trigger autosave too
        name: formState.name,
        description: formState.description,
        problem_statement: formState.problem_statement,
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
      departmentIdsStr,
      personaIdsStr,
      documentIdsStr,
      parameterFieldIdsStr,
      imageIdsStr,
      objectiveIdsStr,
      videoIdsStr,
      questionIdsStr,
      optionIdsStr,
      formState.name,
      formState.description,
      formState.problem_statement,
    ],
  );

  const hasResourceIds = checkHasResourceIds(
    SCENARIO_RESOURCES,
    formState as unknown as Record<string, unknown>,
  ) || !!formState.name || !!formState.description || !!formState.problem_statement;

  const buildPatchPayload = useCallback(
    (
      draftId: string | null,
      expectedVersion: number,
    ): Record<string, unknown> => {
      const current = formStateRef.current as unknown as ScenarioFormState;
      const ref = lastPatchedFormStateRef.current;

      // Build flat draft payload for ID-based resources
      const idPayload = buildDraftPayload(SCENARIO_RESOURCES, {
        formState: formStateRef.current,
        referenceState: ref as unknown as Record<string, unknown> | null,
        flushResults: {},
      });

      // Value fields for creatables (value takes precedence over ID)
      if (current.name != null) {
        if (!ref || current.name !== ref.name) {
          idPayload["name"] = current.name;
          delete idPayload["name_id"];
        }
      }
      if (current.description != null) {
        if (!ref || current.description !== ref.description) {
          idPayload["description"] = current.description;
          delete idPayload["description_id"];
        }
      }
      if (current.problem_statement != null) {
        if (!ref || current.problem_statement !== ref.problem_statement) {
          idPayload["problem_statement"] = current.problem_statement;
          delete idPayload["problem_statement_id"];
        }
      }

      // Build flag fields separately (individual flag fields)
      const FLAG_FIELDS = [
        "active_flag_id",
        "objectives_enabled_flag_id",
        "images_enabled_flag_id",
        "video_enabled_flag_id",
        "questions_enabled_flag_id",
        "problem_statement_enabled_flag_id",
      ] as const;
      const flagPayload: Record<string, string | null> = {};
      for (const field of FLAG_FIELDS) {
        const effectiveVal = current[field] ?? null;
        const refVal = ref?.[field] ?? null;
        if (effectiveVal !== refVal) {
          flagPayload[field] = effectiveVal;
        }
      }

      return {
        input_draft_id: draftId || null,
        ...idPayload,
        ...flagPayload,
        expected_version: expectedVersion,
      };
    },
    [],
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

  // Empty flush registry ref (no more client-side resource creation)
  const emptyFlushRef = useRef(new Map<string, () => Promise<void | Record<string, unknown>>>());

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
    flushRegistryRef: emptyFlushRef,
    formStateRef,
    onPatchSuccess,
  });

  // --- Initialize URL parameterIds from server resolved_parameter_ids ---
  const hasInitializedParameterIds = useRef(false);
  useEffect(() => {
    const resolvedIds = (scenarioData as GetScenarioOut & { resolved_parameter_ids?: string[] | null })?.resolved_parameter_ids;
    if (resolvedIds && resolvedIds.length > 0 && !hasInitializedParameterIds.current) {
      hasInitializedParameterIds.current = true;
      if (setUrlFormDataRef.current) {
        setUrlFormDataRef.current({ parameterIds: resolvedIds });
      }
    }
  }, [scenarioData, setUrlFormDataRef]);

  // --- Stable Data Memo ---
  const stableScenarioDataFields = useMemo(() => {
    if (!scenarioData) return null;
    return {
      names: scenarioData.names,
      descriptions: scenarioData.descriptions,
      problem_statements: scenarioData.problem_statements,
      flags: scenarioData.flags,
      departments: scenarioData.departments,
      personas: scenarioData.personas,
      documents: scenarioData.documents,
      parameters: scenarioData.parameters,
      parameter_fields: scenarioData.parameter_fields,
      objectives: scenarioData.objectives,
      images: scenarioData.images,
      videos: scenarioData.videos,
      questions: scenarioData.questions,
      options: scenarioData.options,
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
    }),
    [
      formState.problem_statement_enabled_flag_id,
      formState.objectives_enabled_flag_id,
      formState.images_enabled_flag_id,
      formState.video_enabled_flag_id,
      formState.questions_enabled_flag_id,
    ],
  );

  const showProblemStatementSection = flagsEnabled.problemStatement;
  const showObjectivesSection = flagsEnabled.objectives;
  const showImagesSection = flagsEnabled.images;
  const showVideosSection = flagsEnabled.videos;
  const showQuestionsSection = flagsEnabled.questions;

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
              (o: { generated?: boolean | null }) => o.generated,
            ) ?? false
          );
        case "scenario_flags":
          return (
            stableScenarioDataFields.flags?.resources?.some(
              (f: { generated?: boolean | null }) => f.generated,
            ) ?? false
          );
        case "departments":
          return (
            stableScenarioDataFields.departments?.current?.some(
              (d: { generated?: boolean | null }) => d.generated,
            ) ?? false
          );
        case "personas":
          // ScenarioPersona doesn't have generated field in API
          return false;
        case "documents":
          // ScenarioDocument doesn't have generated field in API
          return false;
        case "parameters":
          // ScenarioParameter doesn't have generated field in API
          return false;
        case "parameter_fields":
          return (
            stableScenarioDataFields.parameter_fields?.current?.some(
              (f: { generated?: boolean | null }) => f.generated,
            ) ?? false
          );
        case "images":
          return (
            stableScenarioDataFields.images?.current?.some(
              (i: { generated?: boolean | null }) => i.generated,
            ) ?? false
          );
        case "videos":
          return (
            stableScenarioDataFields.videos?.current?.some(
              (v: { generated?: boolean | null }) => v.generated,
            ) ?? false
          );
        case "questions":
          return (
            stableScenarioDataFields.questions?.current?.some(
              (q: { generated?: boolean | null }) => q.generated,
            ) ?? false
          );
        default:
          return false;
      }
    },
    [stableScenarioDataFields],
  );

  const isGeneratingStepResource = useCallback(
    (resourceType: string) =>
      isGenerating(resourceType as ScenarioResourceType),
    [isGenerating],
  );

  // --- Disabled / Breadcrumb ---
  const disabled = useMemo(() => {
    if (!scenarioData) return false;
    return !scenarioData.can_edit;
  }, [scenarioData]);

  // --- Generation Handlers ---
  const handleGenerateResources = useCallback(
    async (
      resourceTypes: ScenarioResourceType[],
      userInstructions?: string,
    ) => {
      let draftIdValue =
        (formDataRef.current["draftId"] as string | undefined) ?? null;
      if (!draftIdValue) {
        draftIdValue = await flushAllAndSave();
      }
      if (!draftIdValue) {
        toast.error("Please save a draft before generating with AI");
        return;
      }

      generate(resourceTypes, {
        user_instructions: userInstructions ? [userInstructions] : null,
        draft_id: draftIdValue,
      });
    },
    [
      flushAllAndSave,
      formDataRef,
      generate,
    ],
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
      personas: ["personas"],
      documents: ["documents"],
      parameters: ["parameters", "parameter_fields"],
      context: ["images", "problem_statements", "objectives"],
      video: ["videos", "questions"],
      all: [
        "names",
        "descriptions",
        "problem_statements",
        "objectives",
        "scenario_flags",
        "departments",
        "personas",
        "documents",
        "parameters",
        "parameter_fields",
        "images",
        "videos",
        "questions",
      ],
    }),
    [],
  );

  const handleDirectStepGenerate = useCallback(
    (stepId: string, _mode: "generate" | "regenerate") => {
      const resources = stepResources[stepId];
      if (resources) {
        handleGenerateResources(resources);
      }
    },
    [stepResources, handleGenerateResources],
  );

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

    if (stableScenarioDataFields?.parameters?.show) {
      items.push({
        id: "parameters",
        title: "Parameters",
        description: "Select parameters for the scenario.",
        resetFields: ["parameter_field_ids", "parameterSearch", "parameterShowSelected", "parameterIds"],
      });
    }

    if (showProblemStatementSection || showObjectivesSection || showImagesSection) {
      items.push({
        id: "context",
        title: "Context",
        description:
          "Define the visual context, problem statement, and learning objectives.",
        resetFields: [
          "problem_statement",
          "objectives",
          "images",
          "problemStatementSearch",
        ],
      });
    }

    if (showVideosSection || showQuestionsSection) {
      items.push({
        id: "video",
        title: "Video",
        description:
          "Add video content, questions, and answer options.",
        resetFields: ["videos", "questions"],
      });
    }

    return items;
  }, [
    stableScenarioDataFields?.personas?.show,
    stableScenarioDataFields?.documents?.show,
    stableScenarioDataFields?.parameters?.show,
    showProblemStatementSection,
    showObjectivesSection,
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
      "parameterIds",
    ],
    [],
  );

  const submitButton = useMemo(
    () => ({
      backUrl: "/training/scenarios",
      backLabel: "Back",
      createLabel: "Save Scenario",
      updateLabel: "Save Scenario",
    }),
    [],
  );

  const resetSuccessMessage = useCallback((stepId: string) => {
    switch (stepId) {
      case "basic":
        return "Basic information reset";
      case "personas":
        return "Personas reset";
      case "documents":
        return "Documents reset";
      case "parameters":
        return "Parameters reset";
      case "context":
        return "Context reset";
      case "video":
        return "Video reset";
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
            name: null,
            description_id: null,
            description: null,
            active_flag_id: null,
            department_ids: [],
            objectives_enabled_flag_id: null,
            images_enabled_flag_id: null,
            video_enabled_flag_id: null,
            questions_enabled_flag_id: null,
            problem_statement_enabled_flag_id: null,
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
        case "parameters":
          return {
            ...prev,
            parameter_field_ids: [],
          };
        case "context":
          return {
            ...prev,
            problem_statement_id: null,
            problem_statement: null,
            objective_ids: [],
            image_ids: [],
          };
        case "video":
          return {
            ...prev,
            video_ids: [],
            question_ids: [],
            option_ids: [],
          };
        default:
          return prev;
      }
    });
  }, []);

  // --- Submit ---
  const handleSubmit = useCallback(
    async (_formData: Record<string, unknown>) => {
      // Check for name (either ID or value)
      const hasName = !!formState.name_id || !!formState.name;
      if (stableScenarioDataFields?.names?.required && !hasName) {
        toast.error("Scenario name is required");
        throw new Error("Scenario name is required");
      }

      const hasDescription = !!formState.description_id || !!formState.description;
      if (
        stableScenarioDataFields?.descriptions?.required &&
        !hasDescription
      ) {
        toast.error("Scenario description is required");
        throw new Error("Scenario description is required");
      }

      const hasProblemStatement = !!formState.problem_statement_id || !!formState.problem_statement;
      if (
        stableScenarioDataFields?.problem_statements?.required &&
        !hasProblemStatement
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
        stableScenarioDataFields?.images?.required &&
        formState.image_ids.length === 0
      ) {
        toast.error("Images are required");
        throw new Error("Images are required");
      }

      if (
        stableScenarioDataFields?.videos?.required &&
        formState.video_ids.length === 0
      ) {
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

      if (!hasName) {
        toast.error("Scenario name is required");
        throw new Error("Scenario name is required");
      }

      // Build common fields for create/update (dual-mode: ID or value)
      const commonFields = {
        name_id: formState.name_id ?? undefined,
        name: formState.name ?? undefined,
        description_id: formState.description_id ?? undefined,
        description: formState.description ?? undefined,
        problem_statement_id: formState.problem_statement_id ?? undefined,
        problem_statement: formState.problem_statement ?? undefined,
        active_flag_id: formState.active_flag_id ?? undefined,
        objectives_enabled_flag_id:
          formState.objectives_enabled_flag_id ?? undefined,
        images_enabled_flag_id:
          formState.images_enabled_flag_id ?? undefined,
        video_enabled_flag_id:
          formState.video_enabled_flag_id ?? undefined,
        questions_enabled_flag_id:
          formState.questions_enabled_flag_id ?? undefined,
        problem_statement_enabled_flag_id:
          formState.problem_statement_enabled_flag_id ?? undefined,
        department_ids: formState.department_ids?.length
          ? formState.department_ids
          : undefined,
        persona_ids: formState.persona_ids?.length
          ? formState.persona_ids
          : undefined,
        document_ids: formState.document_ids?.length
          ? formState.document_ids
          : undefined,
        parameter_field_ids: formState.parameter_field_ids?.length
          ? formState.parameter_field_ids
          : undefined,
        image_ids: formState.image_ids?.length
          ? formState.image_ids
          : undefined,
        objective_ids: formState.objective_ids?.length
          ? formState.objective_ids
          : undefined,
        video_ids: formState.video_ids?.length
          ? formState.video_ids
          : undefined,
        question_ids: formState.question_ids?.length
          ? formState.question_ids
          : undefined,
        option_ids: formState.option_ids?.length
          ? formState.option_ids
          : undefined,
      };

      try {
        if (isEditMode && scenarioId && updateScenarioAction) {
          await updateScenarioAction({
            body: {
              scenarios: [{ scenario_id: scenarioId, ...commonFields }],
              group_id: scenarioData?.group_id ?? undefined,
            },
          } as UpdateScenarioIn);
        } else if (createScenarioAction) {
          await createScenarioAction({
            body: {
              scenarios: [commonFields],
              group_id: scenarioData?.group_id ?? undefined,
            },
          } as CreateScenarioIn);
        } else {
          toast.error("Save action not available");
          throw new Error("Save action not available");
        }

        toast.success(
          `Scenario ${isEditMode ? "updated" : "created"} successfully!`,
        );
        router.push("/training/scenarios");
      } catch (error) {
        toast.error(
          `Failed to ${isEditMode ? "update" : "create"} scenario: ${error instanceof Error ? error.message : "Unknown error"}`,
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
      stableScenarioDataFields?.images?.required,
      stableScenarioDataFields?.videos?.required,
      stableScenarioDataFields?.questions?.required,
      profile?.id,
      createScenarioAction,
      updateScenarioAction,
      isEditMode,
      scenarioId,
      scenarioData?.group_id,
      router,
    ],
  );

  // --- Step Status ---
  const getStepStatus = useCallback(
    (stepId: string, _formData: Record<string, unknown>): StepStatus => {
      const hasName = !!formState.name_id || !!formState.name;
      const hasDescription = !!formState.description_id || !!formState.description;
      const hasDepartments = formState.department_ids.length > 0;
      const hasProblemStatement = !!formState.problem_statement_id || !!formState.problem_statement;
      const hasObjectives = formState.objective_ids.length > 0;
      switch (stepId) {
        case "basic":
          return hasName && hasDescription && hasDepartments
            ? "completed"
            : "active";
        case "personas":
          if (!hasName || !hasDescription) return "pending";
          return formState.persona_ids.length > 0 ? "completed" : "active";
        case "documents":
          if (!hasName || !hasDescription) return "pending";
          return formState.document_ids.length > 0 ? "completed" : "active";
        case "parameters":
          if (!hasName || !hasDescription) return "pending";
          return formState.parameter_field_ids.length > 0 ? "completed" : "active";
        case "context": {
          if (!hasName || !hasDescription) return "pending";
          const hasContextContent =
            hasProblemStatement ||
            hasObjectives ||
            formState.image_ids.length > 0;
          return hasContextContent ? "completed" : "active";
        }
        case "video": {
          if (!hasName || !hasDescription) return "pending";
          const hasVideoContent =
            formState.video_ids.length > 0 ||
            formState.question_ids.length > 0;
          return hasVideoContent ? "completed" : "active";
        }
        default:
          return "pending";
      }
    },
    [formState],
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
                    setFormState((prev) => ({ ...prev, name_id: nameId, name: null }))
                  }
                  onNameChange={(name) =>
                    setFormState((prev) => ({ ...prev, name: name || null, name_id: null }))
                  }
                  onGenerate={generateHandlers["names"]}
                  placeholder="e.g., Customer Support Escalation"
                  defaultName="New Scenario"
                  required={s?.names?.required ?? false}
                  hideDescription={true}
                  showAiGenerate={s?.names?.show_ai_generate ?? false}
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
                    onOpenModal={handleDirectStepGenerate}
                    disabled={disabled}
                  />
                ) : undefined
              }
              {...resetProps}
            >
              <div className="space-y-4">
                <Descriptions
                  description_id={formState.description_id ?? null}
                  description_resource={s?.descriptions?.resource ?? null}
                  show_description={s?.descriptions?.show ?? true}
                  description_suggestions={s?.descriptions?.suggestions ?? []}
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
                      description: null,
                    }))
                  }
                  onDescriptionChange={(desc) =>
                    setFormState((prev) => ({
                      ...prev,
                      description: desc || null,
                      description_id: null,
                    }))
                  }
                  onGenerate={generateHandlers["descriptions"]}
                  label="Description"
                  placeholder="Describe the scenario"
                  required={s?.descriptions?.required ?? false}
                  showAiGenerate={s?.descriptions?.show_ai_generate ?? false}
                />

                <Departments
                  department_ids={formState.department_ids}
                  department_resources={s?.departments?.current ?? []}
                  show_departments={s?.departments?.show ?? false}
                  department_suggestions={s?.departments?.suggestions ?? []}
                  departments={s?.departments?.resources ?? []}
                  disabled={disabled}
                  onChange={(ids) =>
                    setFormState((prev) => ({ ...prev, department_ids: ids }))
                  }
                  label="Departments"
                  required={s?.departments?.required ?? false}
                  showAiGenerate={s?.departments?.show_ai_generate ?? false}
                  onGenerate={generateHandlers["departments"]}
                />

                {/* Server-driven Flags - single component for all flags */}
                {/* Filter out video_flag flags when video is not enabled */}
                <Flags
                  flags={(s?.flags?.resources ?? []).filter(
                    (f: { video_flag?: boolean | null }) =>
                      !f.video_flag || videoEnabled,
                  )}
                  flag_ids={{
                    scenario_active: formState.active_flag_id ?? null,
                    video_enabled: formState.video_enabled_flag_id ?? null,
                    problem_statement_enabled:
                      formState.problem_statement_enabled_flag_id ?? null,
                    objectives_enabled:
                      formState.objectives_enabled_flag_id ?? null,
                    images_enabled: formState.images_enabled_flag_id ?? null,
                    questions_enabled:
                      formState.questions_enabled_flag_id ?? null,
                  }}
                  show_flags={s?.flags?.show ?? false}
                  columns={2}
                  label="Flags"
                  disabled={disabled}
                  onChange={(key: string, flagId: string | null) => {
                    const fieldMap: Record<string, string> = {
                      scenario_active: "active_flag_id",
                      video_enabled: "video_enabled_flag_id",
                      problem_statement_enabled:
                        "problem_statement_enabled_flag_id",
                      objectives_enabled: "objectives_enabled_flag_id",
                      images_enabled: "images_enabled_flag_id",
                      questions_enabled: "questions_enabled_flag_id",
                    };
                    const field = fieldMap[key];
                    if (field) {
                      setFormState((prev) => ({ ...prev, [field]: flagId }));
                    }
                  }}
                  onGenerate={generateHandlers["scenario_flags"]}
                  showAiGenerate={s?.flags?.show_ai_generate ?? false}

                />
              </div>
            </StepCard>
          );
        case "context":
          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={disabled}
              isEditMode={isEditMode}
              resetFields={["problem_statement", "objectives", "images"]}
              actions={
                stepResources["context"]?.length &&
                ((s?.images?.show_ai_generate ?? false) ||
                  (s?.problem_statements?.show_ai_generate ?? false) ||
                  (s?.objectives?.show_ai_generate ?? false)) ? (
                  <StepCardAiButton
                    stepId="context"
                    resourceTypes={stepResources["context"]}
                    canRegenerate={canRegenerate}
                    isGenerating={isGeneratingStepResource}
                    onOpenModal={handleDirectStepGenerate}
                    disabled={disabled}
                  />
                ) : undefined
              }
              {...resetProps}
            >
              <div className="space-y-4">
                {showImagesSection && (
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
                    onGenerate={generateHandlers["images"]}
                    showAiGenerate={s?.images?.show_ai_generate ?? false}
                    multiSelect={true}
                    maxImages={3}
                  />
                )}
                {showProblemStatementSection && (
                  <ProblemStatements
                    problem_statement_id={
                      formState.problem_statement_id ?? null
                    }
                    problem_statement_resource={
                      s?.problem_statements?.resource ?? null
                    }
                    show_problem_statement={showProblemStatementSection}
                    problem_statement_suggestions={
                      s?.problem_statements?.suggestions ?? []
                    }
                    problem_statements={s?.problem_statements?.resources ?? []}
                    disabled={disabled}
                    onProblemStatementIdChange={(problemStatementId) =>
                      setFormState((prev) => ({
                        ...prev,
                        problem_statement_id: problemStatementId,
                        problem_statement: null,
                      }))
                    }
                    onGenerate={generateHandlers["problem_statements"]}
                    label="Problem Statement"
                    placeholder="Define the core problem"
                    required={s?.problem_statements?.required ?? false}
                    searchTerm={problemStatementSearch ?? undefined}
                    onSearchChange={(term: string) =>
                      setFormData({ problemStatementSearch: term || null })
                    }
                    showAiGenerate={s?.problem_statements?.show_ai_generate ?? false}
                  />
                )}
                {showObjectivesSection && (
                  <Objectives
                    objective_ids={formState.objective_ids}
                    objective_resources={s?.objectives?.current ?? []}
                    show_objectives={showObjectivesSection}
                    objectives_required={s?.objectives?.required ?? false}
                    objective_suggestions={s?.objectives?.suggestions ?? []}
                    objectives={s?.objectives?.resources ?? []}
                    disabled={disabled}
                    onChange={(ids) =>
                      setFormState((prev) => ({ ...prev, objective_ids: ids }))
                    }
                    showAiGenerate={s?.objectives?.show_ai_generate ?? false}
                    onGenerate={generateHandlers["objectives"]}
                  />
                )}
              </div>
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
                    onOpenModal={handleDirectStepGenerate}
                    disabled={disabled}
                  />
                ) : undefined
              }
              {...resetProps}
            >
              <div className="space-y-6">
                <Personas
                  persona_ids={formState.persona_ids}
                  persona_resources={s?.personas?.current ?? []}
                  show_personas={s?.personas?.show ?? false}
                  persona_suggestions={s?.personas?.suggestions ?? []}
                  personas={s?.personas?.resources ?? []}
                  disabled={disabled}
                  onChange={(ids) =>
                    setFormState((prev) => ({ ...prev, persona_ids: ids }))
                  }
                  required={s?.personas?.required ?? false}
                  onGenerate={generateHandlers["personas"]}
                  showAiGenerate={s?.personas?.show_ai_generate ?? false}
                  videoEnabled={videoEnabled}

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
                    onOpenModal={handleDirectStepGenerate}
                    disabled={disabled}
                  />
                ) : undefined
              }
              {...resetProps}
            >
              <div className="space-y-6">
                <Documents
                  document_ids={formState.document_ids}
                  document_resources={s?.documents?.current ?? []}
                  show_documents={s?.documents?.show ?? false}
                  document_suggestions={s?.documents?.suggestions ?? []}
                  documents={s?.documents?.resources ?? []}
                  disabled={disabled}
                  onChange={(ids) =>
                    setFormState((prev) => ({ ...prev, document_ids: ids }))
                  }
                  required={s?.documents?.required ?? false}
                  onGenerate={generateHandlers["documents"]}
                  showAiGenerate={s?.documents?.show_ai_generate ?? false}
                  videoEnabled={videoEnabled}

                />
              </div>
            </StepCard>
          );
        case "parameters": {
          const urlParameterIds = ((formData["parameterIds"] as string[]) ?? []);
          const setStepFormData = setFormData;
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
              resetFields={["parameter_field_ids", "parameterIds"]}
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
                  (s?.parameter_fields?.show_ai_generate ?? false)) ? (
                  <StepCardAiButton
                    stepId="parameters"
                    resourceTypes={stepResources["parameters"]}
                    canRegenerate={canRegenerate}
                    isGenerating={isGeneratingStepResource}
                    onOpenModal={handleDirectStepGenerate}
                    disabled={disabled}
                  />
                ) : undefined
              }
              {...resetProps}
            >
              <div className="space-y-6">
                <ParameterFieldsNew
                  parameterIds={urlParameterIds}
                  parameterFieldIds={formState.parameter_field_ids}
                  parameterFieldResources={s?.parameter_fields?.current ?? []}
                  allParameters={s?.parameters?.resources ?? []}
                  availableFields={s?.parameter_fields?.resources ?? []}
                  onToggleParameter={(parameterId, open) => {
                    const current = urlParameterIds;
                    if (open) {
                      setStepFormData({ parameterIds: [...current, parameterId] });
                    } else {
                      setStepFormData({ parameterIds: current.filter((id: string) => id !== parameterId) });
                    }
                  }}
                  onChange={(ids) =>
                    setFormState((prev) => ({
                      ...prev,
                      parameter_field_ids: ids,
                    }))
                  }
                  disabled={disabled}
                  showAiGenerate={s?.parameter_fields?.show_ai_generate ?? false}
                  required={s?.parameter_fields?.required ?? false}
                />
              </div>
            </StepCard>
          );
        }
        case "video":
          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={disabled}
              isEditMode={isEditMode}
              resetFields={["videos", "questions"]}
              actions={
                stepResources["video"]?.length &&
                ((s?.videos?.show_ai_generate ?? false) ||
                  (s?.questions?.show_ai_generate ?? false)) ? (
                  <StepCardAiButton
                    stepId="video"
                    resourceTypes={stepResources["video"]}
                    canRegenerate={canRegenerate}
                    isGenerating={isGeneratingStepResource}
                    onOpenModal={handleDirectStepGenerate}
                    disabled={disabled}
                  />
                ) : undefined
              }
              {...resetProps}
            >
              <div className="space-y-4">
                {showVideosSection && (
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
                    onGenerate={generateHandlers["videos"]}
                    showAiGenerate={s?.videos?.show_ai_generate ?? false}
                  />
                )}
                {showQuestionsSection && (
                  <Questions
                    question_ids={formState.question_ids}
                    question_resources={s?.questions?.current ?? []}
                    show_questions={showQuestionsSection}
                    questions_required={s?.questions?.required ?? false}
                    question_suggestions={s?.questions?.suggestions ?? []}
                    questions={s?.questions?.resources ?? []}
                    disabled={disabled}
                    onChange={(ids) =>
                      setFormState((prev) => ({
                        ...prev,
                        question_ids: ids,
                      }))
                    }
                    onGenerate={generateHandlers["questions"]}
                    showAiGenerate={s?.questions?.show_ai_generate ?? false}
                    onInternalQuestionsChange={setInternalQuestions}
                  />
                )}
                {showQuestionsSection && internalQuestions.length > 0 && (
                  <Options
                    option_ids={formState.option_ids}
                    option_resources={s?.options?.current ?? []}
                    show_options={true}
                    options={s?.options?.resources ?? []}
                    question_ids={formState.question_ids}
                    question_resources={s?.questions?.current ?? []}
                    internalQuestions={internalQuestions}
                    disabled={disabled}
                    onChange={(ids) =>
                      setFormState((prev) => ({ ...prev, option_ids: ids }))
                    }
                    showAiGenerate={s?.options?.show_ai_generate ?? false}
                  />
                )}
              </div>
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
      handleDirectStepGenerate,
      canRegenerate,
      stepResources,
      showImagesSection,
      showVideosSection,
      showQuestionsSection,
      internalQuestions,
      showObjectivesSection,
      showProblemStatementSection,
      videoEnabled,
      makeOnGenerationComplete,
    ],
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
    prevProps.createScenarioAction !== nextProps.createScenarioAction ||
    prevProps.updateScenarioAction !== nextProps.updateScenarioAction ||
    prevProps.patchScenarioDraftAction !== nextProps.patchScenarioDraftAction
  ) {
    return false;
  }

  return true;
});
