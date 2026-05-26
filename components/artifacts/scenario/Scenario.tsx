/**
 * Scenario.tsx
 * Implementation using modular resource components
 * Used to create and manage scenarios - supports both creation and editing
 * Follows Persona.tsx pattern, adapted for scenarios
 */
"use client";

import { useRouter, useSearchParams } from "next/navigation";
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
import { ParameterFields } from "@/components/resources/ParameterFields";
import { Personas } from "@/components/resources/Personas";
import { ProblemStatements } from "@/components/resources/ProblemStatements";
import { Options } from "@/components/resources/Options";
import { Questions } from "@/components/resources/Questions";
import { Videos } from "@/components/resources/Videos";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  uploadScenarioImage,
  uploadScenarioVideo,
} from "@/lib/uploads/scenario";
import { useProfile } from "@/contexts/profile-context";
import { useDrafts } from "@/contexts/draft-context";
import { useScenarioAi } from "@/hooks/use-scenario-ai";
import { useDraftLifecycle } from "@/hooks/use-draft-lifecycle";
import { useGenerationDraft } from "@/hooks/use-generation-draft";
import type { InputOf, OutputOf } from "@/lib/api/types";
import {
  checkHasResourceIds,
  type ResourceConfig,
} from "@/lib/resources/action-builders";
import { parseAsArrayOf, parseAsBoolean, parseAsString, type Parser } from "nuqs";

// Types defined inline using InputOf/OutputOf
type GetScenarioOut = OutputOf<"/scenario/get", "post">;
type CreateScenarioIn = InputOf<"/scenario/create", "post">;
type CreateScenarioOut = OutputOf<"/scenario/create", "post">;
type UpdateScenarioIn = InputOf<"/scenario/update", "post">;
type UpdateScenarioOut = OutputOf<"/scenario/update", "post">;
type PatchScenarioDraftIn = InputOf<
  "/scenario/draft",
  "post"
>;
type PatchScenarioDraftOut = OutputOf<
  "/scenario/draft",
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
  // Canonical: ids of selected flag-resource rows. Server also accepts
  // denormalized booleans (active/video_enabled/etc.) but the UI ships ids.
  flag_ids: string[];
  department_ids: string[];
  persona_ids: string[];
  document_ids: string[];
  parameter_field_ids: string[];
  image_ids: string[];
  objective_ids: string[];
  video_ids: string[];
  question_ids: string[];
  option_ids: string[];
  // Value fields for single-select creatables
  name: string | null;
  description: string | null;
  problem_statement: string | null;
  // Value fields for multi-select creatables (merged with IDs by draft endpoint)
  objectives: string[] | null;
  images: Array<{ name: string; description: string; upload_id: string }> | null;
  videos: Array<{ name: string; description: string; upload_id: string; length_seconds: number }> | null;
  questions: Array<{ question_text: string; time: number; allow_multiple: boolean }> | null;
  options: Array<{ option_text: string; is_correct: boolean; question_id: string }> | null;
  // Pending resource IDs (connections with active=false, awaiting acceptance)
  pending_ids: string[];
};

export interface ScenarioProps {
  scenarioId?: string;
  // Resolved group_id for this scenario session — drives the AI draft
  // event subscription (``scenario.draft.completed``) so the URL's
  // draftId stays in sync with whatever the LLM just saved. Mirrors
  // Persona.tsx's prop of the same name.
  groupId?: string | null;
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

// Canonical: the server returns one ScenarioFlagResource row per flags_resource
// entry (typically two per logical flag — value=true and value=false). The
// client carries selection as a flat `flag_ids: string[]`. The legacy per-feature
// fields (active_flag_id, video_enabled_flag_id, ...) are gone.

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
  { key: "flags", formKey: "flag_ids", flushKey: null, type: "multi" },
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
  groupId: groupIdProp,
}: ScenarioProps) {
  // Fall back to the resolved group_id on the SSR payload when the
  // parent page didn't pass one explicitly. New-page invocations
  // resolve a fresh group server-side before rendering; either source
  // gives ``useGenerationDraft`` the room it needs to subscribe.
  const groupId =
    groupIdProp ??
    ((serverScenarioDetail ?? serverScenarioDetailDefault) as
      | { group_id?: string | null }
      | undefined)?.group_id ??
    null;
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
    useScenarioAi({});

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
      // Single mode param replaces the old per-feature booleans
      // (videoEnabled, imagesEnabled, objectivesEnabled, questionsEnabled,
      // problemStatementEnabled). Needed in the URL so SSR knows which
      // shape to render before hydration; section visibility itself is
      // driven by formState.
      mode: parseAsString,
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
        flag_ids: [],
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
        objectives: null,
        images: null,
        videos: null,
        questions: null,
        options: null,
        pending_ids: [],
      };
    }

    return {
      name_id: scenarioData.names?.find((n: any) => n.selected)?.id
        ? String(scenarioData.names.find((n: any) => n.selected).id)
        : null,
      description_id: scenarioData.descriptions?.find((d: any) => d.selected)?.id
        ? String(scenarioData.descriptions.find((d: any) => d.selected).id)
        : null,
      problem_statement_id: scenarioData.problem_statements?.find((p: any) => p.selected)
        ?.problem_statement_id
        ? String(scenarioData.problem_statements.find((p: any) => p.selected).problem_statement_id)
        : null,
      flag_ids: (scenarioData.flags?.filter((f: any) => f.selected) ?? [])
        .map((f: any) => f.id)
        .filter((id: any): id is string => !!id)
        .map(String),
      department_ids: (scenarioData.departments?.filter((d: any) => d.selected) ?? [])
        .map((item: any) => item.department_id)
        .filter(Boolean)
        .map(String),
      persona_ids: (scenarioData.personas?.filter((p: any) => p.selected) ?? [])
        .map((item: any) => item.persona_id)
        .filter(Boolean)
        .map(String),
      document_ids: (scenarioData.documents?.filter((d: any) => d.selected) ?? [])
        .map((item: any) => item.document_id)
        .filter(Boolean)
        .map(String),
      parameter_field_ids: (scenarioData.parameter_fields?.filter((f: any) => f.selected) ?? [])
        .map((item: any) => item.id)
        .filter(Boolean)
        .map(String),
      image_ids: (scenarioData.images?.filter((i: any) => i.selected) ?? [])
        .map((item: any) => item.image_id)
        .filter(Boolean)
        .map(String),
      objective_ids: (scenarioData.objectives?.filter((o: any) => o.selected) ?? [])
        .map((item: any) => item.id)
        .filter(Boolean)
        .map(String),
      video_ids: (scenarioData.videos?.filter((v: any) => v.selected) ?? [])
        .map((item: any) => item.video_id)
        .filter(Boolean)
        .map(String),
      question_ids: (scenarioData.questions?.filter((q: any) => q.selected) ?? [])
        .map((item: any) => item.question_id)
        .filter(Boolean)
        .map(String),
      option_ids: (scenarioData.options?.filter((o: any) => o.selected) ?? [])
        .map((item: { option_id?: string | null; selected?: boolean }) => item.option_id)
        .filter(Boolean)
        .map(String),
      name: null,
      description: null,
      problem_statement: null,
      objectives: null,
      images: null,
      videos: null,
      questions: null,
      options: null,
      // Collect all pending resource IDs from the API response
      pending_ids: [
        ...((scenarioData.names ?? []).filter((n: any) => n.pending).map((n: any) => n.id).filter(Boolean)),
        ...((scenarioData.descriptions ?? []).filter((d: any) => d.pending).map((d: any) => d.id).filter(Boolean)),
        ...((scenarioData.problem_statements ?? []).filter((p: any) => p.pending).map((p: any) => p.id).filter(Boolean)),
        ...((scenarioData.flags ?? []).filter((f: any) => f.pending).map((f: any) => f.id).filter(Boolean)),
        ...((scenarioData.departments ?? []).filter((d: any) => d.pending).map((d: any) => d.department_id).filter(Boolean)),
        ...((scenarioData.personas ?? []).filter((p: any) => p.pending).map((p: any) => p.id).filter(Boolean)),
        ...((scenarioData.documents ?? []).filter((d: any) => d.pending).map((d: any) => d.id).filter(Boolean)),
        ...((scenarioData.objectives ?? []).filter((o: any) => o.pending).map((o: any) => o.id).filter(Boolean)),
        ...((scenarioData.images ?? []).filter((i: any) => i.pending).map((i: any) => i.id).filter(Boolean)),
        ...((scenarioData.videos ?? []).filter((v: any) => v.pending).map((v: any) => v.id).filter(Boolean)),
        ...((scenarioData.questions ?? []).filter((q: any) => q.pending).map((q: any) => q.id).filter(Boolean)),
        ...((scenarioData.options ?? []).filter((o: any) => o.pending).map((o: any) => o.id).filter(Boolean)),
        ...((scenarioData.parameter_fields ?? []).filter((p: any) => p.pending).map((p: any) => p.id).filter(Boolean)),
      ],
    };
  }, [scenarioData]);

  const [formState, setFormState] =
    useState<ScenarioFormState>(getInitialFormState);
  const formStateRef = useRef<Record<string, unknown>>(
    formState as unknown as Record<string, unknown>,
  );
  // Track internal (unflushed) questions from Questions component for immediate Options rendering
  const [internalQuestions, setInternalQuestions] = useState<{ id: string; question_text: string }[]>([]);
  useEffect(() => {
    formStateRef.current = formState as unknown as Record<string, unknown>;
  }, [formState]);

  // ── Assessment mode ──────────────────────────────────────────────────
  // UI shape toggle. Not persisted as a scenario flag; the single `mode`
  // URL param (`contextual | assessment`) lets SSR pick the right step
  // layout before hydration, and lets a mid-flow refresh come back with
  // the user's last choice. Initial fallback is derived from the saved
  // flags so existing scenarios in assessment shape render correctly
  // even without `?mode=` in the URL.
  // Per-type boolean view of flag_ids, built from the catalog. Used by both
  // <Flags> and the assessmentMode derivation below.
  const flagValues = useMemo<Record<string, boolean | null>>(() => {
    const map: Record<string, boolean | null> = {};
    const byId = new Map(
      (scenarioData?.flags ?? [])
        .filter((f: any) => f.id)
        .map((f: any) => [String(f.id), f]),
    );
    for (const id of formState.flag_ids) {
      const row = byId.get(id) as any;
      if (!row) continue;
      const t = row.type ?? row.name;
      if (t && row.value != null) map[t] = row.value;
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formState.flag_ids, scenarioData?.flags]);

  const searchParams = useSearchParams();
  const [assessmentMode, setAssessmentMode] = useState<boolean>(() => {
    const urlMode = searchParams.get("mode");
    if (urlMode === "assessment") return true;
    if (urlMode === "contextual") return false;
    return !!flagValues["video_enabled"] || !!flagValues["questions_enabled"];
  });
  // If a server sync later populates an assessment flag (e.g. AI
  // generation enabled video on a scenario that loaded as contextual),
  // flip the mode on. We never auto-flip off — leaving mode=assessment
  // on after the user clears both flags is fine (switches stay visible).
  useEffect(() => {
    if (flagValues["video_enabled"] || flagValues["questions_enabled"]) {
      setAssessmentMode(true);
    }
  }, [flagValues]);

  // Rows grouped by flag type — used when a toggle swaps between true/false ids.
  type FlagRow = NonNullable<NonNullable<typeof scenarioData>["flags"]>[number];
  const flagRowsByType = useMemo(() => {
    const map = new Map<string, FlagRow[]>();
    for (const f of scenarioData?.flags ?? []) {
      const t = (f as any).type ?? (f as any).name;
      if (!t) continue;
      const list = map.get(t) ?? [];
      list.push(f as FlagRow);
      map.set(t, list);
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenarioData?.flags]);

  const handleFlagToggle = useCallback(
    (type: string, next: boolean | null) => {
      setFormState((prev) => {
        const rows = (flagRowsByType.get(type) ?? []) as Array<{ id?: string | null; value?: boolean | null }>;
        const rowIdsForType = new Set(
          rows.map((r) => r.id).filter((id): id is string => !!id),
        );
        const retained = prev.flag_ids.filter((id) => !rowIdsForType.has(id));
        const target =
          next == null
            ? null
            : (rows.find((r) => r.value === next)?.id ?? null);
        const nextIds = target ? [...retained, target] : retained;
        return { ...prev, flag_ids: nextIds };
      });
    },
    [flagRowsByType],
  );

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
        (scenarioData?.departments?.filter((d: any) => d.selected) ?? [])
          .map((item: any) => item.department_id)
          .filter(Boolean),
      ),
    [scenarioData?.departments],
  );
  const scenarioPersonaIdsStr = useMemo(
    () =>
      JSON.stringify(
        (scenarioData?.personas?.filter((p: any) => p.selected) ?? [])
          .map((item: any) => item.persona_id)
          .filter(Boolean),
      ),
    [scenarioData?.personas],
  );
  const scenarioDocumentIdsStr = useMemo(
    () =>
      JSON.stringify(
        (scenarioData?.documents?.filter((d: any) => d.selected) ?? [])
          .map((item: any) => item.document_id)
          .filter(Boolean),
      ),
    [scenarioData?.documents],
  );
  const scenarioParameterFieldIdsStr = useMemo(
    () =>
      JSON.stringify(
        (scenarioData?.parameter_fields?.filter((f: any) => f.selected) ?? [])
          .map((item: any) => item.id)
          .filter(Boolean),
      ),
    [scenarioData?.parameter_fields],
  );
  const scenarioImageIdsStr = useMemo(
    () =>
      JSON.stringify(
        (scenarioData?.images?.filter((i: any) => i.selected) ?? [])
          .map((item: any) => item.image_id)
          .filter(Boolean),
      ),
    [scenarioData?.images],
  );
  const scenarioObjectiveIdsStr = useMemo(
    () =>
      JSON.stringify(
        (scenarioData?.objectives?.filter((o: any) => o.selected) ?? [])
          .map((item: any) => item.id)
          .filter(Boolean),
      ),
    [scenarioData?.objectives],
  );
  const scenarioVideoIdsStr = useMemo(
    () =>
      JSON.stringify(
        (scenarioData?.videos?.filter((v: any) => v.selected) ?? [])
          .map((item: any) => item.video_id)
          .filter(Boolean),
      ),
    [scenarioData?.videos],
  );
  const scenarioQuestionIdsStr = useMemo(
    () =>
      JSON.stringify(
        (scenarioData?.questions?.filter((q: any) => q.selected) ?? [])
          .map((item: any) => item.question_id)
          .filter(Boolean),
      ),
    [scenarioData?.questions],
  );
  const scenarioOptionIdsStr = useMemo(
    () =>
      JSON.stringify(
        (scenarioData?.options?.filter((o: any) => o.selected) ?? [])
          .map((item: { option_id?: string | null; selected?: boolean }) => item.option_id)
          .filter(Boolean),
      ),
    [scenarioData?.options],
  );

  // --- Draft Lifecycle ---
  const patchScenarioDraftActionRef = useRef(patchScenarioDraftAction);
  useEffect(() => {
    patchScenarioDraftActionRef.current = patchScenarioDraftAction;
  }, [patchScenarioDraftAction]);

  // Stable ref wrapper for patch action
  const patchActionRef = useRef<
    | ((
        payload: Record<string, unknown>,
      ) => Promise<{ draft_id?: string | null }>)
    | undefined
  >(undefined);

  // formStateKey excludes draftId -- the hook prepends it
  const formStateKey = useMemo(
    () =>
      JSON.stringify({
        name_id: formState.name_id,
        description_id: formState.description_id,
        problem_statement_id: formState.problem_statement_id,
        flag_ids: formState.flag_ids,
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
        objectives: formState.objectives,
        images: formState.images,
        videos: formState.videos,
        questions: formState.questions,
        options: formState.options,
        // Pending lifecycle — included so per-field Accept/Reject (which
        // mutates only the pending list) reliably triggers autosave.
        pending_ids: formState.pending_ids,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      formState.name_id,
      formState.description_id,
      formState.problem_statement_id,
      formState.flag_ids,
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
      formState.objectives,
      formState.images,
      formState.videos,
      formState.questions,
      formState.options,
      // eslint-disable-next-line react-hooks/exhaustive-deps
      JSON.stringify(formState.pending_ids),
    ],
  );

  const hasResourceIds = checkHasResourceIds(
    SCENARIO_RESOURCES,
    formState as unknown as Record<string, unknown>,
  )
    || !!formState.name
    || !!formState.description
    || !!formState.problem_statement
    || (formState.objectives?.length ?? 0) > 0
    || (formState.images?.length ?? 0) > 0
    || (formState.videos?.length ?? 0) > 0
    || (formState.questions?.length ?? 0) > 0
    || (formState.options?.length ?? 0) > 0
    || formState.flag_ids.length > 0;

  // Append-only drafts: every save sends a FULL snapshot of the current
  // form state, never a diff. Diff-based saves caused prior-field loss —
  // e.g. save name, then save description, the second save omitted name_id
  // and the new draft row lost the name on refresh.
  const buildPatchPayload = useCallback(
    (draftId: string | null): Record<string, unknown> => {
      const current = formStateRef.current as unknown as ScenarioFormState;
      const payload: Record<string, unknown> = {
        input_draft_id: draftId || null,
      };

      // Single-value creatables: value takes precedence over ID
      if (current.name != null) payload["name"] = current.name;
      else if (current.name_id) payload["name_id"] = current.name_id;

      if (current.description != null) payload["description"] = current.description;
      else if (current.description_id) payload["description_id"] = current.description_id;

      if (current.problem_statement != null) payload["problem_statement"] = current.problem_statement;
      else if (current.problem_statement_id) payload["problem_statement_id"] = current.problem_statement_id;

      // Multi-value creatables: values merged with IDs server-side
      if (current.objectives && current.objectives.length > 0) payload["objectives"] = current.objectives;
      if (current.objective_ids && current.objective_ids.length > 0) payload["objective_ids"] = current.objective_ids;

      // Image + video resources are created server-side at upload time
      // (full chain: resource + entry + junction + uploads_entry). The
      // FE never sends ``images``/``videos`` value-arrays — that goes
      // through draft.create_image/video which only writes the bare
      // resource row and orphans the upload (see scenario/draft.py).
      if (current.image_ids && current.image_ids.length > 0) payload["image_ids"] = current.image_ids;
      if (current.video_ids && current.video_ids.length > 0) payload["video_ids"] = current.video_ids;

      if (current.questions && current.questions.length > 0) payload["questions"] = current.questions;
      if (current.question_ids && current.question_ids.length > 0) payload["question_ids"] = current.question_ids;

      if (current.options && current.options.length > 0) payload["options"] = current.options;
      if (current.option_ids && current.option_ids.length > 0) payload["option_ids"] = current.option_ids;

      // Canonical: ship the flag_ids array straight through.
      if (current.flag_ids?.length) payload["flag_ids"] = current.flag_ids;

      // Associations
      if (current.department_ids?.length) payload["department_ids"] = current.department_ids;
      if (current.persona_ids?.length) payload["persona_ids"] = current.persona_ids;
      if (current.document_ids?.length) payload["document_ids"] = current.document_ids;
      if (current.parameter_field_ids?.length) payload["parameter_field_ids"] = current.parameter_field_ids;

      // Pending state
      if (current.pending_ids?.length) payload["pending_ids"] = current.pending_ids;

      return payload;
    },
    [],
  );

  // --- Stable value-change handlers (extracted from inline arrows) ---
  // These keep child components from seeing a new onChange ref every render.
  const handleNameChange = useCallback((name: string) => {
    setFormState((prev) => ({ ...prev, name: name || null, name_id: null }));
  }, []);

  const handleDescriptionChange = useCallback((desc: string) => {
    setFormState((prev) => ({
      ...prev,
      description: desc || null,
      description_id: null,
    }));
  }, []);

  const handleProblemStatementChange = useCallback((ps: string) => {
    setFormState((prev) => ({
      ...prev,
      problem_statement: ps || null,
      problem_statement_id: null,
    }));
  }, []);

  const handleObjectivesChange = useCallback((objectives: string[]) => {
    setFormState((prev) => ({
      ...prev,
      objectives: objectives.length > 0 ? objectives : null,
    }));
  }, []);

  const handleQuestionsChange = useCallback((qs: NonNullable<ScenarioFormState["questions"]>) => {
    setFormState((prev) => ({
      ...prev,
      questions: qs.length > 0 ? qs : null,
    }));
  }, []);

  const handleOptionsChange = useCallback((opts: NonNullable<ScenarioFormState["options"]>) => {
    setFormState((prev) => ({
      ...prev,
      options: opts.length > 0 ? opts : null,
    }));
  }, []);

  // ─── Per-field pending lifecycle ──────────────────────────────────
  // Field components (Names, Descriptions, ...) call these when the user
  // clicks the inline ✓/✗ on a pending diff. Mirrors persona pattern.
  type SingleField = "name_id" | "description_id" | "problem_statement_id";
  type MultiField =
    | "department_ids"
    | "parameter_field_ids"
    | "flag_ids"
    | "persona_ids"
    | "document_ids"
    | "image_ids"
    | "video_ids"
    | "objective_ids"
    | "question_ids"
    | "option_ids";

  const handleAcceptPendingField = useCallback(
    (field: SingleField, pendingId: string) => {
      setFormState((prev) => ({
        ...prev,
        [field]: pendingId,
        // Clear the corresponding value field so the patch payload carries
        // the resolved id instead of the (also-stale) text.
        ...(field === "name_id" ? { name: null } : {}),
        ...(field === "description_id" ? { description: null } : {}),
        ...(field === "problem_statement_id" ? { problem_statement: null } : {}),
        pending_ids: prev.pending_ids.filter((id) => id !== pendingId),
      }));
    },
    [],
  );

  const handleRejectPendingField = useCallback(
    (field: SingleField, pendingId: string) => {
      setFormState((prev) => ({
        ...prev,
        [field]: prev[field] === pendingId ? null : prev[field],
        pending_ids: prev.pending_ids.filter((id) => id !== pendingId),
      }));
    },
    [],
  );

  const handleAcceptPendingMulti = useCallback(
    (_field: MultiField, pendingIds: string[]) => {
      const removeSet = new Set(pendingIds);
      setFormState((prev) => ({
        ...prev,
        pending_ids: prev.pending_ids.filter((id) => !removeSet.has(id)),
      }));
    },
    [],
  );

  const handleRejectPendingMulti = useCallback(
    (field: MultiField, pendingIds: string[]) => {
      const removeSet = new Set(pendingIds);
      setFormState((prev) => ({
        ...prev,
        [field]: (prev[field] as string[]).filter((id) => !removeSet.has(id)),
        pending_ids: prev.pending_ids.filter((id) => !removeSet.has(id)),
      }));
    },
    [],
  );

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
    hasResourceIds,
    flushRegistryRef: emptyFlushRef,
    formStateRef,
  });

  // --- AI Draft Sync (generic: update draftId when AI saves) ---
  // The URL update already triggers a Next.js RSC re-fetch via
  // ``GenericForm``'s ``shallow: false`` default, so an explicit
  // ``router.refresh()`` here would just produce a second SSR cycle.
  // Mirror of Persona.tsx's wiring — without this, ``scenario.draft.completed``
  // fires on every LLM ``Scenario_Draft`` call but the URL keeps the old
  // draftId and the page never switches to the AI-saved draft.
  useGenerationDraft({
    artifactType: "scenario",
    groupId,
    onDraftCompleted: (draftId) => {
      setUrlFormDataRef.current?.({ draftId });
    },
    onDraftFailed: (message) => {
      toast.error("AI draft failed", { description: message });
    },
  });

  // Update form state when server data changes.
  //
  // CRITICAL: merge, do not replace. Flag toggles write the URL (for server
  // filtering) which causes the parent to refetch scenarioData. If we replaced
  // prev with newState wholesale, any user toggle that hasn't been persisted
  // yet would be clobbered back to null (server doesn't know about it until
  // the debounced save lands). We preserve user-set IDs the server hasn't
  // acknowledged by only adopting the server value when it's non-null or the
  // user hadn't set anything either.
  useEffect(() => {
    const newState = getInitialFormState();
    setFormState((prev) => {
      const mergeId = (p: string | null, n: string | null) =>
        // Server wins when it has a concrete ID; if server returns null but
        // user has set something, keep the user's in-flight value.
        n !== null ? n : p;
      const mergeList = (p: string[], n: string[]) =>
        // Server wins when it has any entries; otherwise preserve user's
        // in-flight selection.
        n && n.length > 0 ? n : p;

      const merged: ScenarioFormState = {
        ...prev,
        name_id: mergeId(prev.name_id, newState.name_id),
        description_id: mergeId(prev.description_id, newState.description_id),
        problem_statement_id: mergeId(
          prev.problem_statement_id,
          newState.problem_statement_id,
        ),
        flag_ids: mergeList(prev.flag_ids, newState.flag_ids),
        department_ids: mergeList(prev.department_ids, newState.department_ids),
        persona_ids: mergeList(prev.persona_ids, newState.persona_ids),
        document_ids: mergeList(prev.document_ids, newState.document_ids),
        parameter_field_ids: mergeList(
          prev.parameter_field_ids,
          newState.parameter_field_ids,
        ),
        image_ids: mergeList(prev.image_ids, newState.image_ids),
        objective_ids: mergeList(prev.objective_ids, newState.objective_ids),
        video_ids: mergeList(prev.video_ids, newState.video_ids),
        question_ids: mergeList(prev.question_ids, newState.question_ids),
        option_ids: mergeList(prev.option_ids, newState.option_ids),
        // Value fields (name/description/...) are always prev — newState.* is
        // always null here (server state only), and we never want to clobber
        // in-flight user typing.
      };

      const changed =
        prev.name_id !== merged.name_id ||
        prev.description_id !== merged.description_id ||
        prev.problem_statement_id !== merged.problem_statement_id ||
        JSON.stringify(prev.flag_ids) !== JSON.stringify(merged.flag_ids) ||
        JSON.stringify(prev.department_ids) !==
          JSON.stringify(merged.department_ids) ||
        JSON.stringify(prev.persona_ids) !== JSON.stringify(merged.persona_ids) ||
        JSON.stringify(prev.document_ids) !==
          JSON.stringify(merged.document_ids) ||
        JSON.stringify(prev.parameter_field_ids) !==
          JSON.stringify(merged.parameter_field_ids) ||
        JSON.stringify(prev.image_ids) !== JSON.stringify(merged.image_ids) ||
        JSON.stringify(prev.objective_ids) !==
          JSON.stringify(merged.objective_ids) ||
        JSON.stringify(prev.video_ids) !== JSON.stringify(merged.video_ids) ||
        JSON.stringify(prev.question_ids) !==
          JSON.stringify(merged.question_ids) ||
        JSON.stringify(prev.option_ids) !== JSON.stringify(merged.option_ids);

      if (changed) {
        serverSyncPendingRef.current = true;
        return merged;
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

  useEffect(() => {
    if (patchScenarioDraftAction) {
      patchActionRef.current = async (payload: Record<string, unknown>) => {
        const result = await patchScenarioDraftAction({
          body: payload,
        } as PatchScenarioDraftIn);

        // Sync form_state from server response (server is source of truth)
        const fs = (result as Record<string, unknown>)?.["form_state"] as Record<string, unknown> | undefined;
        if (fs) {
          setFormState((prev) => {
            const newObjectiveIds = (fs["objective_ids"] as string[]) ?? prev.objective_ids;
            const newImageIds = (fs["image_ids"] as string[]) ?? prev.image_ids;
            const newVideoIds = (fs["video_ids"] as string[]) ?? prev.video_ids;
            const newQuestionIds = (fs["question_ids"] as string[]) ?? prev.question_ids;
            const newOptionIds = (fs["option_ids"] as string[]) ?? prev.option_ids;

            const next = {
              ...prev,
              name_id: (fs["name_id"] as string) ?? prev.name_id,
              description_id: (fs["description_id"] as string) ?? prev.description_id,
              problem_statement_id: (fs["problem_statement_id"] as string) ?? prev.problem_statement_id,
              flag_ids: (fs["flag_ids"] as string[] | null) ?? prev.flag_ids,
              department_ids: (fs["department_ids"] as string[]) ?? prev.department_ids,
              persona_ids: (fs["persona_ids"] as string[]) ?? prev.persona_ids,
              document_ids: (fs["document_ids"] as string[]) ?? prev.document_ids,
              parameter_field_ids: (fs["parameter_field_ids"] as string[]) ?? prev.parameter_field_ids,
              objective_ids: newObjectiveIds,
              image_ids: newImageIds,
              video_ids: newVideoIds,
              question_ids: newQuestionIds,
              option_ids: newOptionIds,
              // Clear value fields only once the server resolves them to IDs,
              // so a keystroke in flight isn't clobbered to null by a "no-op"
              // sync that kept the id unchanged.
              name: fs["name_id"] ? null : prev.name,
              description: fs["description_id"] ? null : prev.description,
              problem_statement: fs["problem_statement_id"] ? null : prev.problem_statement,
              // Only clear multi-text arrays when server actually returned IDs
              // for them (mirrors the single-value creatables above).
              objectives: (fs["objective_ids"] as string[])?.length ? null : prev.objectives,
              images: (fs["image_ids"] as string[])?.length ? null : prev.images,
              videos: (fs["video_ids"] as string[])?.length ? null : prev.videos,
              questions: (fs["question_ids"] as string[])?.length ? null : prev.questions,
              options: (fs["option_ids"] as string[])?.length ? null : prev.options,
            };
            // Only set the server-sync absorb flag when the state actually
            // changes. If the server returned identical values, setting the
            // flag would let it stick until the next user action and silently
            // swallow that action's save. (Same fix as Persona.)
            const flagFieldsChanged =
              JSON.stringify(prev.flag_ids) !== JSON.stringify(next.flag_ids);
            const changed =
              prev.name_id !== next.name_id ||
              prev.name !== next.name ||
              prev.description_id !== next.description_id ||
              prev.description !== next.description ||
              prev.problem_statement_id !== next.problem_statement_id ||
              prev.problem_statement !== next.problem_statement ||
              flagFieldsChanged ||
              JSON.stringify(prev.department_ids) !== JSON.stringify(next.department_ids) ||
              JSON.stringify(prev.persona_ids) !== JSON.stringify(next.persona_ids) ||
              JSON.stringify(prev.document_ids) !== JSON.stringify(next.document_ids) ||
              JSON.stringify(prev.parameter_field_ids) !== JSON.stringify(next.parameter_field_ids) ||
              JSON.stringify(prev.objective_ids) !== JSON.stringify(next.objective_ids) ||
              JSON.stringify(prev.image_ids) !== JSON.stringify(next.image_ids) ||
              JSON.stringify(prev.video_ids) !== JSON.stringify(next.video_ids) ||
              JSON.stringify(prev.question_ids) !== JSON.stringify(next.question_ids) ||
              JSON.stringify(prev.option_ids) !== JSON.stringify(next.option_ids) ||
              JSON.stringify(prev.objectives) !== JSON.stringify(next.objectives) ||
              JSON.stringify(prev.images) !== JSON.stringify(next.images) ||
              JSON.stringify(prev.videos) !== JSON.stringify(next.videos) ||
              JSON.stringify(prev.questions) !== JSON.stringify(next.questions) ||
              JSON.stringify(prev.options) !== JSON.stringify(next.options);
            if (!changed) return prev;
            serverSyncPendingRef.current = true;
            return next;
          });
        }

        return result;
      };
    } else {
      patchActionRef.current = undefined;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patchScenarioDraftAction]);

  // --- Initialize URL parameterIds from server resolved_parameter_ids ---
  const hasInitializedParameterIds = useRef(false);
  useEffect(() => {
    const resolvedIds = (scenarioData as GetScenarioOut & { resolved_parameter_ids?: string[] | null })?.resolved_parameter_ids;
    if (!hasInitializedParameterIds.current) {
      hasInitializedParameterIds.current = true;
      if (setUrlFormDataRef.current) {
        // Set resolved IDs, or null to remove empty ?parameterIds= from URL
        setUrlFormDataRef.current({
          parameterIds: resolvedIds && resolvedIds.length > 0 ? resolvedIds : null,
        });
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
      show_ai_generate: scenarioData.show_ai_generate,
    };
  }, [scenarioData]);

  const flagsEnabled = useMemo(
    () => ({
      problemStatement: !!flagValues["problem_statement_enabled"],
      objectives: !!flagValues["objectives_enabled"],
      images: !!flagValues["images_enabled"],
      videos: !!flagValues["video_enabled"],
      questions: !!flagValues["questions_enabled"],
    }),
    [flagValues],
  );

  const showProblemStatementSection = flagsEnabled.problemStatement;
  const showObjectivesSection = flagsEnabled.objectives;
  const showImagesSection = flagsEnabled.images;
  const showVideosSection = flagsEnabled.videos;
  const showQuestionsSection = flagsEnabled.questions;

  // Whether video mode is enabled - used for filtering personas/documents/parameters
  const videoEnabled = !!flagValues["video_enabled"];

  const canRegenerate = useCallback(
    (resourceType: string): boolean => {
      if (!stableScenarioDataFields) return false;
      switch (resourceType as ScenarioResourceType) {
        case "names":
          return stableScenarioDataFields.names?.find((n: any) => n.selected)?.generated ?? false;
        case "descriptions":
          return (
            stableScenarioDataFields.descriptions?.find((d: any) => d.selected)?.generated ?? false
          );
        case "problem_statements":
          return (
            stableScenarioDataFields.problem_statements?.find((p: any) => p.selected)?.generated ??
            false
          );
        case "objectives":
          return (
            stableScenarioDataFields.objectives?.filter(
              (o: any) => o.selected,
            )?.some(
              (o: { generated?: boolean | null }) => o.generated,
            ) ?? false
          );
        case "scenario_flags":
          return (
            stableScenarioDataFields.flags?.some(
              (f: { generated?: boolean | null }) => f.generated,
            ) ?? false
          );
        case "departments":
          return (
            stableScenarioDataFields.departments?.filter(
              (d: any) => d.selected,
            )?.some(
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
            stableScenarioDataFields.parameter_fields?.filter(
              (f: any) => f.selected,
            )?.some(
              (f: { generated?: boolean | null }) => f.generated,
            ) ?? false
          );
        case "images":
          return (
            stableScenarioDataFields.images?.filter(
              (i: any) => i.selected,
            )?.some(
              (i: { generated?: boolean | null }) => i.generated,
            ) ?? false
          );
        case "videos":
          return (
            stableScenarioDataFields.videos?.filter(
              (v: any) => v.selected,
            )?.some(
              (v: { generated?: boolean | null }) => v.generated,
            ) ?? false
          );
        case "questions":
          return (
            stableScenarioDataFields.questions?.filter(
              (q: any) => q.selected,
            )?.some(
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

  // --- Pending state helpers per step ---
  const stepHasPending = useCallback(
    (stepId: string): boolean => {
      const pendingSet = new Set(formState.pending_ids);
      if (pendingSet.size === 0) return false;
      const data = scenarioDataRef.current;
      if (!data) return false;
      const resources = stepResources[stepId] ?? [];
      for (const rt of resources) {
        const items = (data as any)[rt] ?? [];
        for (const item of items) {
          const itemId = item.id ?? item.department_id ?? item.persona_id ?? item.document_id ?? item.field_id ?? item.image_id ?? item.video_id ?? item.question_id ?? item.option_id ?? item.flag_option_id;
          if (itemId && pendingSet.has(itemId)) return true;
        }
      }
      return false;
    },
    [formState.pending_ids, stepResources],
  );

  const handleAcceptAllForStep = useCallback(
    (stepId: string) => {
      const data = scenarioDataRef.current;
      if (!data) return;
      const resources = stepResources[stepId] ?? [];
      const idsToAccept: string[] = [];
      for (const rt of resources) {
        const items = (data as any)[rt] ?? [];
        for (const item of items) {
          if (item.pending) {
            const itemId = item.id ?? item.department_id ?? item.persona_id ?? item.document_id ?? item.field_id ?? item.image_id ?? item.video_id ?? item.question_id ?? item.option_id ?? item.flag_option_id;
            if (itemId) idsToAccept.push(itemId);
          }
        }
      }
      // Remove accepted IDs from pending_ids (keep in form state = confirmed)
      setFormState((prev) => ({
        ...prev,
        pending_ids: prev.pending_ids.filter((id) => !idsToAccept.includes(id)),
      }));
    },
    [stepResources],
  );

  const handleRejectAllForStep = useCallback(
    (stepId: string) => {
      const data = scenarioDataRef.current;
      if (!data) return;
      const resources = stepResources[stepId] ?? [];
      const idsToReject: string[] = [];
      for (const rt of resources) {
        const items = (data as any)[rt] ?? [];
        for (const item of items) {
          if (item.pending) {
            const itemId = item.id ?? item.department_id ?? item.persona_id ?? item.document_id ?? item.field_id ?? item.image_id ?? item.video_id ?? item.question_id ?? item.option_id ?? item.flag_option_id;
            if (itemId) idsToReject.push(itemId);
          }
        }
      }
      const rejectSet = new Set(idsToReject);
      // Remove from both form state and pending_ids
      setFormState((prev) => ({
        ...prev,
        name_id: rejectSet.has(prev.name_id ?? "") ? null : prev.name_id,
        description_id: rejectSet.has(prev.description_id ?? "") ? null : prev.description_id,
        problem_statement_id: rejectSet.has(prev.problem_statement_id ?? "") ? null : prev.problem_statement_id,
        flag_ids: prev.flag_ids.filter((id) => !rejectSet.has(id)),
        department_ids: prev.department_ids.filter((id) => !rejectSet.has(id)),
        persona_ids: prev.persona_ids.filter((id) => !rejectSet.has(id)),
        document_ids: prev.document_ids.filter((id) => !rejectSet.has(id)),
        parameter_field_ids: prev.parameter_field_ids.filter((id) => !rejectSet.has(id)),
        image_ids: prev.image_ids.filter((id) => !rejectSet.has(id)),
        objective_ids: prev.objective_ids.filter((id) => !rejectSet.has(id)),
        video_ids: prev.video_ids.filter((id) => !rejectSet.has(id)),
        question_ids: prev.question_ids.filter((id) => !rejectSet.has(id)),
        option_ids: prev.option_ids.filter((id) => !rejectSet.has(id)),
        pending_ids: prev.pending_ids.filter((id) => !rejectSet.has(id)),
      }));
    },
    [stepResources],
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

    if (true) {
      items.push({
        id: "personas",
        title: "Personas",
        description: "Select personas for the scenario.",
        resetFields: ["personas", "personaSearch", "personaShowSelected"],
      });
    }

    if (true) {
      items.push({
        id: "documents",
        title: "Documents",
        description: "Select documents for the scenario.",
        resetFields: ["documents", "documentSearch", "documentShowSelected"],
      });
    }

    if (true) {
      items.push({
        id: "parameters",
        title: "Parameters",
        description: "Select parameters for the scenario.",
        resetFields: ["parameter_field_ids", "parameterSearch", "parameterShowSelected", "parameterIds"],
      });
    }

    // Context step appears only if any of its features are enabled.
    // Images is hidden in assessmentMode, so it doesn't count while on.
    const hasAnyContextFeature =
      !!flagValues["problem_statement_enabled"] ||
      !!flagValues["objectives_enabled"] ||
      (!assessmentMode && !!flagValues["images_enabled"]);

    if (hasAnyContextFeature) {
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

    // Assessment step appears only in assessmentMode and only if at
    // least one of its features is enabled. Label/description adapts to
    // what's enabled so the card doesn't say "Video" when the scenario
    // is questions-only.
    const videoOn = assessmentMode && !!flagValues["video_enabled"];
    const questionsOn = assessmentMode && !!flagValues["questions_enabled"];

    if (videoOn || questionsOn) {
      const title =
        videoOn && questionsOn
          ? "Video & Questions"
          : videoOn
            ? "Video"
            : "Questions";
      const description =
        videoOn && questionsOn
          ? "Add video content, questions, and answer options."
          : videoOn
            ? "Add video content for the scenario."
            : "Add questions and answer options.";
      items.push({
        id: "video",
        title,
        description,
        resetFields: ["videos", "questions"],
      });
    }

    return items;
  }, [
    stableScenarioDataFields,
    assessmentMode,
    flagValues,
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
            flag_ids: [],
            department_ids: [],
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
            objectives: null,
            image_ids: [],
            images: null,
          };
        case "video":
          return {
            ...prev,
            video_ids: [],
            videos: null,
            question_ids: [],
            questions: null,
            option_ids: [],
            options: null,
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
      if (true && !hasName) {
        toast.error("Scenario name is required");
        throw new Error("Scenario name is required");
      }

      const hasDescription = !!formState.description_id || !!formState.description;
      if (
        false &&
        !hasDescription
      ) {
        toast.error("Scenario description is required");
        throw new Error("Scenario description is required");
      }

      const hasProblemStatement = !!formState.problem_statement_id || !!formState.problem_statement;
      if (
        false &&
        !hasProblemStatement
      ) {
        toast.error("Problem statement is required");
        throw new Error("Problem statement is required");
      }

      if (
        false &&
        formState.objective_ids.length === 0
      ) {
        toast.error("Objectives are required");
        throw new Error("Objectives are required");
      }

      if (
        false &&
        formState.department_ids.length === 0
      ) {
        toast.error("Departments are required");
        throw new Error("Departments are required");
      }

      if (
        false &&
        formState.persona_ids.length === 0
      ) {
        toast.error("Personas are required");
        throw new Error("Personas are required");
      }

      if (
        false &&
        formState.document_ids.length === 0
      ) {
        toast.error("Documents are required");
        throw new Error("Documents are required");
      }

      if (
        false &&
        formState.image_ids.length === 0
      ) {
        toast.error("Images are required");
        throw new Error("Images are required");
      }

      if (
        false &&
        formState.video_ids.length === 0
      ) {
        toast.error("Videos are required");
        throw new Error("Videos are required");
      }

      if (
        false &&
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
        // Legacy CreateScenarioItem fields: derive per-feature flag IDs from
        // canonical flag_ids for the bulk create/update endpoint.
        ...(() => {
          const byType: Record<string, string | undefined> = {};
          const byId = new Map(
            (scenarioData?.flags ?? [])
              .filter((f: any) => f.id)
              .map((f: any) => [String(f.id), f]),
          );
          for (const id of formState.flag_ids) {
            const row = byId.get(id) as any;
            if (!row) continue;
            const t = row.type ?? row.name;
            if (t && row.value === true) byType[t] = id;
          }
          return {
            active_flag_id: byType["scenario_active"],
            objectives_enabled_flag_id: byType["objectives_enabled"],
            images_enabled_flag_id: byType["images_enabled"],
            video_enabled_flag_id: byType["video_enabled"],
            questions_enabled_flag_id: byType["questions_enabled"],
            problem_statement_enabled_flag_id: byType["problem_statement_enabled"],
          };
        })(),
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
              scenarios: [{ id: scenarioId, ...commonFields }],
            },
          } as UpdateScenarioIn);
        } else if (createScenarioAction) {
          await createScenarioAction({
            body: {
              scenarios: [commonFields],
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      formState,
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

      // Section visibility is driven by formState + assessmentMode.
      // Drafts retain saved IDs even when a flag is off; the API accepts
      // them, the UI just hides the section.
      const showProblemStatement = !!flagValues["problem_statement_enabled"];
      const showObjectives = !!flagValues["objectives_enabled"];
      const showImages = !assessmentMode && !!flagValues["images_enabled"];
      const showVideo = assessmentMode && !!flagValues["video_enabled"];
      const showQuestions = assessmentMode && !!flagValues["questions_enabled"];
      // Child components (Personas/Documents) still accept a videoEnabled
      // hint for their own filtering — alias of showVideo.
      const urlVideoEnabled = showVideo;

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
                  name_resource={s?.names?.find((n: any) => n.selected) ?? null}
                  show_name={true}
                  name_suggestions={[]}
                  names={s?.names ?? []}
                  disabled={disabled}
                  onNameIdChange={(nameId) =>
                    setFormState((prev) => ({
                      ...prev,
                      name_id: nameId,
                      name: null,
                    }))
                  }
                  onNameChange={handleNameChange}
                  onAcceptPending={(pendingId) =>
                    handleAcceptPendingField("name_id", pendingId)
                  }
                  onRejectPending={(pendingId) =>
                    handleRejectPendingField("name_id", pendingId)
                  }
                  onGenerate={generateHandlers["names"]}
                  placeholder="e.g., Customer Support Escalation"
                  defaultName="New Scenario"
                  required={true}
                  hideDescription={true}
                  showAiGenerate={false}
                />
              }
              resetFields={["name", "description", "departments"]}
              actions={
                stepResources["basic"]?.length &&
                (s?.show_ai_generate ?? false) ? (
                  <StepCardAiButton
                    stepId="basic"
                    resourceTypes={stepResources["basic"]}
                    canRegenerate={canRegenerate}
                    isGenerating={isGeneratingStepResource}
                    onOpenModal={handleDirectStepGenerate}
                    disabled={disabled}
                    hasPending={stepHasPending("basic")}
                    onAcceptAll={() => handleAcceptAllForStep("basic")}
                    onRejectAll={() => handleRejectAllForStep("basic")}
                  />
                ) : undefined
              }
              {...resetProps}
            >
              <div className="space-y-4">
                <Descriptions
                  description_id={formState.description_id ?? null}
                  description_resource={s?.descriptions?.find((d: any) => d.selected) ?? null}
                  show_description={true}
                  description_suggestions={[]}
                  descriptions={s?.descriptions ?? []}
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
                  onDescriptionChange={handleDescriptionChange}
                  onAcceptPending={(pendingId) =>
                    handleAcceptPendingField("description_id", pendingId)
                  }
                  onRejectPending={(pendingId) =>
                    handleRejectPendingField("description_id", pendingId)
                  }
                  onGenerate={generateHandlers["descriptions"]}
                  label="Description"
                  placeholder="Describe the scenario"
                  required={false}
                  showAiGenerate={false}
                />

                <Departments
                  department_ids={formState.department_ids}
                  department_resources={s?.departments?.filter((d: any) => d.selected) ?? []}
                  show_departments={true}
                  department_suggestions={[]}
                  departments={s?.departments ?? []}
                  disabled={disabled}
                  onChange={(ids) =>
                    setFormState((prev) => {
                      const removedIds = prev.department_ids.filter((id) => !ids.includes(id));
                      return {
                        ...prev,
                        department_ids: ids,
                        pending_ids: prev.pending_ids.filter((id) => !removedIds.includes(id)),
                      };
                    })
                  }
                  onAcceptPending={(pendingIds) =>
                    handleAcceptPendingMulti("department_ids", pendingIds)
                  }
                  onRejectPending={(pendingIds) =>
                    handleRejectPendingMulti("department_ids", pendingIds)
                  }
                  label="Departments"
                  required={false}
                  showAiGenerate={false}
                  onGenerate={generateHandlers["departments"]}
                />

                {/* Server-driven Flags — assessmentMode gates which feature
                    switches are visible:
                      off → contextual (images + PS + objectives)
                      on  → assessment (video + questions, no images) */}
                <Flags
                  flags={(() => {
                    // Keep presentation ordering local: Active first, then
                    // the rest in server order.
                    const filtered = (s?.flags ?? []).filter(
                      (f: any) => {
                        const t = f.type ?? f.name;
                        // Mode-driven feature gating
                        if (t === "images_enabled") return !assessmentMode;
                        if (t === "video_enabled" || t === "questions_enabled") {
                          return assessmentMode;
                        }
                        return true;
                      },
                    );
                    return [...filtered].sort((a: any, b: any) => {
                      const at = a.type ?? a.name;
                      const bt = b.type ?? b.name;
                      if (at === "scenario_active") return -1;
                      if (bt === "scenario_active") return 1;
                      return 0;
                    });
                  })()}
                  values={flagValues}
                  show_flags={true}
                  columns={2}
                  label="Flags"
                  disabled={disabled}
                  headerRight={
                    <div
                      role="radiogroup"
                      aria-label="Scenario mode"
                      className="inline-flex items-center rounded-full border bg-muted/50 p-0.5 text-xs"
                    >
                      {([
                        { value: false, label: "Contextual" },
                        { value: true, label: "Assessment" },
                      ] as const).map(({ value, label }) => {
                        const active = assessmentMode === value;
                        return (
                          <button
                            key={label}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            disabled={disabled}
                            onClick={() => {
                              if (assessmentMode === value) return;
                              setAssessmentMode(value);
                              // Keep persisted flags aligned with visible
                              // switches: assessment clears images; contextual
                              // clears video + questions. Saved IDs for the
                              // hidden features stay in the backing draft —
                              // a user who toggles back gets their values
                              // restored via the server sync.
                              // Drop ids whose type is hidden by the new mode.
                              const dropTypes = value
                                ? new Set(["images_enabled"])
                                : new Set(["video_enabled", "questions_enabled"]);
                              const dropIds = new Set<string>();
                              for (const t of dropTypes) {
                                for (const r of (flagRowsByType.get(t) ?? []) as Array<{ id?: string | null }>) {
                                  if (r.id) dropIds.add(r.id);
                                }
                              }
                              setFormState((prev) => ({
                                ...prev,
                                flag_ids: prev.flag_ids.filter((id) => !dropIds.has(id)),
                              }));
                              setFormData({
                                mode: value ? "assessment" : "contextual",
                              });
                            }}
                            className={cn(
                              "rounded-full px-3 py-1 font-medium transition-colors",
                              active
                                ? "bg-background text-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground",
                              disabled && "pointer-events-none opacity-50",
                            )}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  }
                  onChange={handleFlagToggle}
                  onAcceptPending={(pendingIds) =>
                    handleAcceptPendingMulti("flag_ids", pendingIds)
                  }
                  onRejectPending={(pendingIds) =>
                    handleRejectPendingMulti("flag_ids", pendingIds)
                  }
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
                (s?.show_ai_generate ?? false) ? (
                  <StepCardAiButton
                    stepId="context"
                    resourceTypes={stepResources["context"]}
                    canRegenerate={canRegenerate}
                    isGenerating={isGeneratingStepResource}
                    onOpenModal={handleDirectStepGenerate}
                    disabled={disabled}
                    hasPending={stepHasPending("context")}
                    onAcceptAll={() => handleAcceptAllForStep("context")}
                    onRejectAll={() => handleRejectAllForStep("context")}
                  />
                ) : undefined
              }
              {...resetProps}
            >
              <div className="space-y-4">
                {showImages && (
                  <Images
                    image_ids={formState.image_ids}
                    image_resources={s?.images?.filter((i: any) => i.selected) ?? []}
                    show_images={showImages}
                    images_required={false}
                    images={s?.images ?? []}
                    disabled={disabled}
                    onChange={(ids) =>
                      setFormState((prev) => {
                        const removedIds = prev.image_ids.filter((id) => !ids.includes(id));
                        return {
                          ...prev,
                          image_ids: ids,
                          pending_ids: prev.pending_ids.filter((id) => !removedIds.includes(id)),
                        };
                      })
                    }
                    onImageUploaded={(image_id) =>
                      setFormState((prev) => ({
                        ...prev,
                        image_ids: [...prev.image_ids, image_id],
                      }))
                    }
                    multiSelect={true}
                    maxImages={3}
                    uploadImage={uploadScenarioImage}
                    downloadBaseUrl="/api/scenario/image"
                    onAcceptPending={(pendingIds) =>
                      handleAcceptPendingMulti("image_ids", pendingIds)
                    }
                    onRejectPending={(pendingIds) =>
                      handleRejectPendingMulti("image_ids", pendingIds)
                    }
                  />
                )}
                {showProblemStatement && (
                  <ProblemStatements
                    problem_statement_id={
                      formState.problem_statement_id ?? null
                    }
                    problem_statement_resource={
                      s?.problem_statements?.find((p: any) => p.selected) ?? null
                    }
                    show_problem_statement={showProblemStatement}
                    problem_statements={s?.problem_statements ?? []}
                    disabled={disabled}
                    onProblemStatementIdChange={(problemStatementId) =>
                      setFormState((prev) => ({
                        ...prev,
                        problem_statement_id: problemStatementId,
                        problem_statement: null,
                        pending_ids: prev.pending_ids.filter((id) => id !== prev.problem_statement_id),
                      }))
                    }
                    onProblemStatementChange={handleProblemStatementChange}
                    label="Problem Statement"
                    placeholder="Define the core problem"
                    required={false}
                    searchTerm={problemStatementSearch ?? undefined}
                    onSearchChange={(term: string) =>
                      setFormData({ problemStatementSearch: term || null })
                    }
                    onAcceptPending={(pendingId) =>
                      handleAcceptPendingField("problem_statement_id", pendingId)
                    }
                    onRejectPending={(pendingId) =>
                      handleRejectPendingField("problem_statement_id", pendingId)
                    }
                  />
                )}
                {showObjectives && (
                  <Objectives
                    objective_ids={formState.objective_ids}
                    objective_resources={s?.objectives?.filter((o: any) => o.selected) ?? []}
                    show_objectives={showObjectives}
                    objectives_required={false}
                    objectives={s?.objectives ?? []}
                    disabled={disabled}
                    onChange={(ids) =>
                      setFormState((prev) => {
                        const removedIds = prev.objective_ids.filter((id) => !ids.includes(id));
                        return {
                          ...prev,
                          objective_ids: ids,
                          pending_ids: prev.pending_ids.filter((id) => !removedIds.includes(id)),
                        };
                      })
                    }
                    onObjectivesChange={handleObjectivesChange}
                    onAcceptPending={(pendingIds) =>
                      handleAcceptPendingMulti("objective_ids", pendingIds)
                    }
                    onRejectPending={(pendingIds) =>
                      handleRejectPendingMulti("objective_ids", pendingIds)
                    }
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
                (s?.show_ai_generate ?? false) ? (
                  <StepCardAiButton
                    stepId="personas"
                    resourceTypes={stepResources["personas"]}
                    canRegenerate={canRegenerate}
                    isGenerating={isGeneratingStepResource}
                    onOpenModal={handleDirectStepGenerate}
                    disabled={disabled}
                    hasPending={stepHasPending("personas")}
                    onAcceptAll={() => handleAcceptAllForStep("personas")}
                    onRejectAll={() => handleRejectAllForStep("personas")}
                  />
                ) : undefined
              }
              {...resetProps}
            >
              <div className="space-y-6">
                <Personas
                  persona_ids={formState.persona_ids}
                  persona_resources={s?.personas?.filter((p: any) => p.selected) ?? []}
                  show_personas={true}
                  persona_suggestions={[]}
                  personas={s?.personas ?? []}
                  disabled={disabled}
                  onChange={(ids) =>
                    setFormState((prev) => {
                      const removedIds = prev.persona_ids.filter((id) => !ids.includes(id));
                      return {
                        ...prev,
                        persona_ids: ids,
                        pending_ids: prev.pending_ids.filter((id) => !removedIds.includes(id)),
                      };
                    })
                  }
                  required={false}
                  videoEnabled={urlVideoEnabled}
                  onAcceptPending={(pendingIds) =>
                    handleAcceptPendingMulti("persona_ids", pendingIds)
                  }
                  onRejectPending={(pendingIds) =>
                    handleRejectPendingMulti("persona_ids", pendingIds)
                  }
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
                (s?.show_ai_generate ?? false) ? (
                  <StepCardAiButton
                    stepId="documents"
                    resourceTypes={stepResources["documents"]}
                    canRegenerate={canRegenerate}
                    isGenerating={isGeneratingStepResource}
                    onOpenModal={handleDirectStepGenerate}
                    disabled={disabled}
                    hasPending={stepHasPending("documents")}
                    onAcceptAll={() => handleAcceptAllForStep("documents")}
                    onRejectAll={() => handleRejectAllForStep("documents")}
                  />
                ) : undefined
              }
              {...resetProps}
            >
              <div className="space-y-6">
                <Documents
                  document_ids={formState.document_ids}
                  document_resources={s?.documents?.filter((d: any) => d.selected) ?? []}
                  show_documents={true}
                  documents={s?.documents ?? []}
                  disabled={disabled}
                  onChange={(ids) =>
                    setFormState((prev) => {
                      const removedIds = prev.document_ids.filter((id) => !ids.includes(id));
                      return {
                        ...prev,
                        document_ids: ids,
                        pending_ids: prev.pending_ids.filter((id) => !removedIds.includes(id)),
                      };
                    })
                  }
                  required={false}
                  videoEnabled={urlVideoEnabled}
                  onAcceptPending={(pendingIds) =>
                    handleAcceptPendingMulti("document_ids", pendingIds)
                  }
                  onRejectPending={(pendingIds) =>
                    handleRejectPendingMulti("document_ids", pendingIds)
                  }
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
                (s?.show_ai_generate ?? false) ? (
                  <StepCardAiButton
                    stepId="parameters"
                    resourceTypes={stepResources["parameters"]}
                    canRegenerate={canRegenerate}
                    isGenerating={isGeneratingStepResource}
                    onOpenModal={handleDirectStepGenerate}
                    disabled={disabled}
                    hasPending={stepHasPending("parameters")}
                    onAcceptAll={() => handleAcceptAllForStep("parameters")}
                    onRejectAll={() => handleRejectAllForStep("parameters")}
                  />
                ) : undefined
              }
              {...resetProps}
            >
              <div className="space-y-6">
                <ParameterFields
                  parameterIds={urlParameterIds}
                  parameterFieldIds={formState.parameter_field_ids}
                  parameterFieldResources={s?.parameter_fields?.filter((f: any) => f.selected) ?? []}
                  allParameters={s?.parameters ?? []}
                  availableFields={s?.parameter_fields ?? []}
                  onToggleParameter={(parameterId, open) => {
                    const current = urlParameterIds;
                    if (open) {
                      setStepFormData({ parameterIds: [...current, parameterId] });
                    } else {
                      setStepFormData({ parameterIds: current.filter((id: string) => id !== parameterId) });
                    }
                  }}
                  onChange={(ids) =>
                    setFormState((prev) => {
                      const removedIds = prev.parameter_field_ids.filter((id) => !ids.includes(id));
                      return {
                        ...prev,
                        parameter_field_ids: ids,
                        pending_ids: prev.pending_ids.filter((id) => !removedIds.includes(id)),
                      };
                    })
                  }
                  onAcceptPending={(pendingIds) =>
                    handleAcceptPendingMulti("parameter_field_ids", pendingIds)
                  }
                  onRejectPending={(pendingIds) =>
                    handleRejectPendingMulti("parameter_field_ids", pendingIds)
                  }
                  disabled={disabled}
                  showAiGenerate={false}
                  required={false}
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
                (s?.show_ai_generate ?? false) ? (
                  <StepCardAiButton
                    stepId="video"
                    resourceTypes={stepResources["video"]}
                    canRegenerate={canRegenerate}
                    isGenerating={isGeneratingStepResource}
                    onOpenModal={handleDirectStepGenerate}
                    disabled={disabled}
                    hasPending={stepHasPending("video")}
                    onAcceptAll={() => handleAcceptAllForStep("video")}
                    onRejectAll={() => handleRejectAllForStep("video")}
                  />
                ) : undefined
              }
              {...resetProps}
            >
              <div className="space-y-4">
                {showVideo && (
                  <Videos
                    video_ids={formState.video_ids}
                    video_resources={s?.videos?.filter((v: any) => v.selected) ?? []}
                    show_videos={showVideo}
                    videos_required={false}
                    videos={s?.videos ?? []}
                    disabled={disabled}
                    onChange={(ids) =>
                      setFormState((prev) => {
                        const removedIds = prev.video_ids.filter((id) => !ids.includes(id));
                        return {
                          ...prev,
                          video_ids: ids,
                          pending_ids: prev.pending_ids.filter((id) => !removedIds.includes(id)),
                        };
                      })
                    }
                    onVideoUploaded={(video_id) =>
                      setFormState((prev) => ({
                        ...prev,
                        video_ids: [...prev.video_ids, video_id],
                      }))
                    }
                    uploadVideo={uploadScenarioVideo}
                    downloadBaseUrl="/api/scenario/video"
                    onAcceptPending={(pendingIds) =>
                      handleAcceptPendingMulti("video_ids", pendingIds)
                    }
                    onRejectPending={(pendingIds) =>
                      handleRejectPendingMulti("video_ids", pendingIds)
                    }
                  />
                )}
                {showQuestions && (
                  <Questions
                    question_ids={formState.question_ids}
                    question_resources={s?.questions?.filter((q: any) => q.selected) ?? []}
                    show_questions={showQuestions}
                    questions_required={false}
                    questions={s?.questions ?? []}
                    disabled={disabled}
                    onChange={(ids) =>
                      setFormState((prev) => {
                        const removedIds = prev.question_ids.filter((id) => !ids.includes(id));
                        return {
                          ...prev,
                          question_ids: ids,
                          pending_ids: prev.pending_ids.filter((id) => !removedIds.includes(id)),
                        };
                      })
                    }
                    onQuestionsChange={handleQuestionsChange}
                    onInternalQuestionsChange={setInternalQuestions}
                    onAcceptPending={(pendingIds) =>
                      handleAcceptPendingMulti("question_ids", pendingIds)
                    }
                    onRejectPending={(pendingIds) =>
                      handleRejectPendingMulti("question_ids", pendingIds)
                    }
                  />
                )}
                {showQuestions && internalQuestions.length > 0 && (
                  <Options
                    option_ids={formState.option_ids}
                    option_resources={s?.options?.filter((o: any) => o.selected) ?? []}
                    show_options={true}
                    options={s?.options ?? []}
                    question_ids={formState.question_ids}
                    question_resources={s?.questions?.filter((q: any) => q.selected) ?? []}
                    internalQuestions={internalQuestions}
                    disabled={disabled}
                    onChange={(ids) =>
                      setFormState((prev) => {
                        const removedIds = prev.option_ids.filter((id) => !ids.includes(id));
                        return {
                          ...prev,
                          option_ids: ids,
                          pending_ids: prev.pending_ids.filter((id) => !removedIds.includes(id)),
                        };
                      })
                    }
                    onOptionsChange={handleOptionsChange}
                    onAcceptPending={(pendingIds) =>
                      handleAcceptPendingMulti("option_ids", pendingIds)
                    }
                    onRejectPending={(pendingIds) =>
                      handleRejectPendingMulti("option_ids", pendingIds)
                    }
                  />
                )}
              </div>
            </StepCard>
          );
        default:
          return null;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      stepHasPending,
      handleAcceptAllForStep,
      handleRejectAllForStep,
      showImagesSection,
      showVideosSection,
      showQuestionsSection,
      internalQuestions,
      showObjectivesSection,
      showProblemStatementSection,
      videoEnabled,
      assessmentMode,
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
