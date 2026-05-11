"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StepCard } from "@/components/common/forms/StepCard";
import { Departments } from "@/components/resources/Departments";
import { Personas } from "@/components/resources/Personas";
import { Documents } from "@/components/resources/Documents";
import { ParameterFields } from "@/components/resources/ParameterFields";
import { Names } from "@/components/resources/Names";
import { Options } from "@/components/resources/Options";
import { Questions } from "@/components/resources/Questions";
import { Videos } from "@/components/resources/Videos";
import { Images } from "@/components/resources/Images";
import { ProblemStatements } from "@/components/resources/ProblemStatements";
import { Objectives } from "@/components/resources/Objectives";
import { useSocket } from "@/contexts/socket-context";
import { useAttemptGenerate } from "@/hooks/use-attempt-generate";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { useRouter } from "next/navigation";
import { parseAsBoolean, parseAsString, useQueryStates } from "nuqs";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

type GetChatOut = OutputOf<
  "/attempt/chat_get",
  "post"
>;
export type ChatData = GetChatOut & {
  profile_has_access?: boolean | null;
  simulation_name?: string | null;
  names?: Array<{ id?: string | null; name?: string | null; selected?: boolean | null; suggested?: boolean | null; pending?: boolean | null; generated?: boolean | null }> | null;
  descriptions?: Array<{ id?: string | null; description?: string | null; selected?: boolean | null; suggested?: boolean | null; pending?: boolean | null; generated?: boolean | null }> | null;
  departments?: Array<{ department_id?: string | null; name?: string | null; description?: string | null; selected?: boolean | null; suggested?: boolean | null; pending?: boolean | null; generated?: boolean | null }> | null;
  personas?: Array<{ persona_id?: string | null; name?: string | null; description?: string | null; color?: string | null; icon?: string | null; selected?: boolean | null; suggested?: boolean | null; pending?: boolean | null; generated?: boolean | null }> | null;
  documents?: Array<{ document_id?: string | null; name?: string | null; description?: string | null; selected?: boolean | null; suggested?: boolean | null; pending?: boolean | null; generated?: boolean | null }> | null;
  parameter_fields?: Array<{ id?: string | null; field_id?: string | null; parameter_id?: string | null; name?: string | null; parameter_name?: string | null; selected?: boolean | null; suggested?: boolean | null; pending?: boolean | null; generated?: boolean | null }> | null;
  questions?: Array<{ question_id?: string | null; question_text?: string | null; selected?: boolean | null; suggested?: boolean | null; pending?: boolean | null; generated?: boolean | null }> | null;
  options?: Array<{ option_id?: string | null; option_text?: string | null; question_id?: string | null; is_correct?: boolean | null; selected?: boolean | null; suggested?: boolean | null; pending?: boolean | null; generated?: boolean | null }> | null;
  videos?: Array<{ video_id?: string | null; name?: string | null; upload_id?: string | null; selected?: boolean | null; suggested?: boolean | null; pending?: boolean | null; generated?: boolean | null }> | null;
  images?: Array<{ image_id?: string | null; id?: string | null; name?: string | null; upload_id?: string | null; selected?: boolean | null; suggested?: boolean | null; pending?: boolean | null; generated?: boolean | null }> | null;
  problem_statements?: Array<{ problem_statement_id?: string | null; problem_statement?: string | null; selected?: boolean | null; suggested?: boolean | null; pending?: boolean | null; generated?: boolean | null }> | null;
  objectives?: Array<{ id?: string | null; objective?: string | null; selected?: boolean | null; suggested?: boolean | null; pending?: boolean | null; generated?: boolean | null }> | null;
  scenario_ids?: string[] | null;
  field_ids?: string[] | null;
  flag_ids?: string[] | null;
};
type PatchChatDraftIn = InputOf<
  "/attempt/draft",
  "post"
>;
type PatchChatDraftOut = OutputOf<
  "/attempt/draft",
  "post"
>;

type ChatFormState = {
  name_id: string | null;
  name: string | null;
  description_id: string | null;
  description: string | null;
  problem_statement_id: string | null;
  problem_statement: string | null;
  department_ids: string[];
  persona_ids: string[];
  document_ids: string[];
  parameter_field_ids: string[];
  scenario_ids: string[];
  field_ids: string[];
  flag_ids: string[];
  question_ids: string[];
  option_ids: string[];
  video_ids: string[];
  image_ids: string[];
  objective_ids: string[];
  pending_ids: string[];
};

interface ChatProps {
  bundleData: GetChatOut;
  patchChatDraftAction: (
    input: PatchChatDraftIn,
  ) => Promise<PatchChatDraftOut>;
  attemptId: string;
  chatEntryId: string;
}

function extractIds<T>(
  items: T[] | null | undefined,
  idKey: keyof T,
): string[] {
  if (!items) return [];
  return items
    .map((item) => item[idKey] as string | null | undefined)
    .filter((id): id is string => !!id);
}

function selectedItem<T extends { selected?: boolean | null }>(
  items: T[] | null | undefined,
): T | null {
  return items?.find((item) => item.selected) ?? null;
}

export default function Chat({
  bundleData,
  patchChatDraftAction,
  attemptId,
  chatEntryId,
}: ChatProps) {
  const router = useRouter();
  const { socket, isConnected } = useSocket();
  const s = bundleData as ChatData;
  const isStartingRef = useRef(false);

  const selectedName = useMemo(() => selectedItem(s.names), [s.names]);
  const selectedDescription = useMemo(
    () => selectedItem(s.descriptions),
    [s.descriptions],
  );
  const selectedProblemStatement = useMemo(
    () => selectedItem(s.problem_statements),
    [s.problem_statements],
  );
  const selectedQuestions = useMemo(
    () => (s.questions ?? []).filter((q) => q.selected),
    [s.questions],
  );

  const allParameters = useMemo(() => {
    const seen = new Set<string>();
    return (s.parameter_fields ?? [])
      .filter((field) => field.parameter_id && field.parameter_name)
      .filter((field) => {
        const parameterId = field.parameter_id!;
        if (seen.has(parameterId)) return false;
        seen.add(parameterId);
        return true;
      })
      .map((field) => ({
        parameter_id: field.parameter_id ?? null,
        name: field.parameter_name ?? null,
        description: null,
        conditional: false,
      }));
  }, [s.parameter_fields]);

  const [expandedParameterIds, setExpandedParameterIds] = useState<string[]>([]);

  const initialFormState = useMemo<ChatFormState>(
    () => ({
      name_id: selectedName?.id ?? null,
      name: selectedName?.name ?? null,
      description_id: selectedDescription?.id ?? null,
      description: selectedDescription?.description ?? null,
      problem_statement_id: selectedProblemStatement?.problem_statement_id ?? null,
      problem_statement: selectedProblemStatement?.problem_statement ?? null,
      department_ids: extractIds((s.departments ?? []).filter((item) => item.selected), "department_id"),
      persona_ids: extractIds((s.personas ?? []).filter((item) => item.selected), "persona_id"),
      document_ids: extractIds((s.documents ?? []).filter((item) => item.selected), "document_id"),
      parameter_field_ids: extractIds((s.parameter_fields ?? []).filter((item) => item.selected), "id"),
      scenario_ids: s.scenario_ids ?? [],
      field_ids: s.field_ids ?? [],
      flag_ids: s.flag_ids ?? [],
      question_ids: extractIds(selectedQuestions, "question_id"),
      option_ids: extractIds((s.options ?? []).filter((item) => item.selected), "option_id"),
      video_ids: extractIds((s.videos ?? []).filter((item) => item.selected), "video_id"),
      image_ids: extractIds((s.images ?? []).filter((item) => item.selected), "image_id"),
      objective_ids: extractIds((s.objectives ?? []).filter((item) => item.selected), "id"),
      pending_ids: [
        ...extractIds((s.names ?? []).filter((item) => item.pending), "id"),
        ...extractIds((s.descriptions ?? []).filter((item) => item.pending), "id"),
        ...extractIds((s.departments ?? []).filter((item) => item.pending), "department_id"),
        ...extractIds((s.personas ?? []).filter((item) => item.pending), "persona_id"),
        ...extractIds((s.documents ?? []).filter((item) => item.pending), "document_id"),
        ...extractIds((s.parameter_fields ?? []).filter((item) => item.pending), "id"),
        ...extractIds((s.questions ?? []).filter((item) => item.pending), "question_id"),
        ...extractIds((s.options ?? []).filter((item) => item.pending), "option_id"),
        ...extractIds((s.videos ?? []).filter((item) => item.pending), "video_id"),
        ...extractIds((s.images ?? []).filter((item) => item.pending), "image_id"),
        ...extractIds((s.problem_statements ?? []).filter((item) => item.pending), "problem_statement_id"),
        ...extractIds((s.objectives ?? []).filter((item) => item.pending), "id"),
      ],
    }),
    [s, selectedName, selectedDescription, selectedProblemStatement, selectedQuestions],
  );

  const [formState, setFormState] =
    useState<ChatFormState>(initialFormState);

  const [urlParams, setUrlParams] = useQueryStates(
    {
      draftId: parseAsString,
      infiniteMode: parseAsBoolean,
      userInstructions: parseAsString,
    },
    { history: "replace", shallow: true },
  );

  const [draftId, setDraftId] = useState<string | null>(
    urlParams.draftId || null,
  );
  const [isSaving, setIsSaving] = useState(false);

  const infiniteMode = urlParams.infiniteMode ?? false;
  const userInstructions = urlParams.userInstructions || "";

  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const savingRef = useRef(false);
  const serverSyncPendingRef = useRef(false);

  // Generate hook — saves draft then generates
  const { generate, error: generateError } = useAttemptGenerate();

  useEffect(() => {
    if (draftId && draftId !== urlParams.draftId) {
      void setUrlParams({ draftId });
    }
  }, [draftId, setUrlParams, urlParams.draftId]);

  const saveDraftNow = useCallback(async () => {
    if (savingRef.current) return;

    savingRef.current = true;
    try {
      // Build payload — ID fields + value fields for creatables
      const payload: Record<string, unknown> = {
        draft_id: draftId,
        name_id: formState.name_id,
        description_id: formState.description_id,
        problem_statement_id: formState.problem_statement_id,
        department_ids: formState.department_ids,
        persona_ids: formState.persona_ids,
        document_ids: formState.document_ids,
        parameter_field_ids: formState.parameter_field_ids,
        scenario_ids: formState.scenario_ids,
        field_ids: formState.field_ids,
        flag_ids: formState.flag_ids,
        question_ids: formState.question_ids,
        option_ids: formState.option_ids,
        video_ids: formState.video_ids,
        image_ids: formState.image_ids,
        objective_ids: formState.objective_ids,
        pending_ids: formState.pending_ids,
      };

      // Single-select creatables: value clears the corresponding IDs
      if (formState.name && !formState.name_id) {
        payload["name"] = formState.name;
      }
      if (formState.description && !formState.description_id) {
        payload["description"] = formState.description;
      }
      if (
        formState.problem_statement &&
        !formState.problem_statement_id
      ) {
        payload["problem_statement"] = formState.problem_statement;
      }

      const result = await patchChatDraftAction({
        body: payload,
      } as PatchChatDraftIn);

      if (result.draft_id) {
        setDraftId(result.draft_id);
      }

      // Sync form_state from server response (server is source of truth)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const formStateData = (result as any).form_state as {
        name_id?: string | null;
        name?: string | null;
        description_id?: string | null;
        description?: string | null;
        problem_statement_id?: string | null;
        problem_statement?: string | null;
        department_ids?: string[];
        persona_ids?: string[];
        document_ids?: string[];
        parameter_field_ids?: string[];
        scenario_ids?: string[];
        field_ids?: string[];
        flag_ids?: string[];
        question_ids?: string[];
        option_ids?: string[];
        video_ids?: string[];
        image_ids?: string[];
        objective_ids?: string[];
        pending_ids?: string[];
      } | undefined;
      if (formStateData) {
        setFormState((prev) => {
          const nextNameId = formStateData.name_id ?? prev.name_id;
          const nextDescriptionId =
            formStateData.description_id ?? prev.description_id;
          const nextProblemStatementId =
            formStateData.problem_statement_id ?? prev.problem_statement_id;
          const next = {
            ...prev,
            name_id: nextNameId,
            // Clear value fields only once the server has resolved them to
            // IDs — keeping the value would cause infinite re-saves (value
            // takes precedence → new resource → new id → repeat).
            name: nextNameId ? null : prev.name,
            description_id: nextDescriptionId,
            description: nextDescriptionId ? null : prev.description,
            problem_statement_id: nextProblemStatementId,
            problem_statement: nextProblemStatementId ? null : prev.problem_statement,
            department_ids: formStateData.department_ids ?? prev.department_ids,
            persona_ids: formStateData.persona_ids ?? prev.persona_ids,
            document_ids: formStateData.document_ids ?? prev.document_ids,
            parameter_field_ids:
              formStateData.parameter_field_ids ?? prev.parameter_field_ids,
            scenario_ids: formStateData.scenario_ids ?? prev.scenario_ids,
            field_ids: formStateData.field_ids ?? prev.field_ids,
            flag_ids: formStateData.flag_ids ?? prev.flag_ids,
            question_ids: formStateData.question_ids ?? prev.question_ids,
            option_ids: formStateData.option_ids ?? prev.option_ids,
            video_ids: formStateData.video_ids ?? prev.video_ids,
            image_ids: formStateData.image_ids ?? prev.image_ids,
            objective_ids: formStateData.objective_ids ?? prev.objective_ids,
            pending_ids: formStateData.pending_ids ?? prev.pending_ids,
          };
          // Only set the server-sync absorb flag when state actually changes
          // — otherwise the flag sticks after a no-op sync and the next
          // autosave-effect run silently absorbs the next user action.
          const changed =
            prev.name_id !== next.name_id ||
            prev.name !== next.name ||
            prev.description_id !== next.description_id ||
            prev.description !== next.description ||
            prev.problem_statement_id !== next.problem_statement_id ||
            prev.problem_statement !== next.problem_statement ||
            JSON.stringify(prev.department_ids) !== JSON.stringify(next.department_ids) ||
            JSON.stringify(prev.persona_ids) !== JSON.stringify(next.persona_ids) ||
            JSON.stringify(prev.document_ids) !== JSON.stringify(next.document_ids) ||
            JSON.stringify(prev.parameter_field_ids) !== JSON.stringify(next.parameter_field_ids) ||
            JSON.stringify(prev.scenario_ids) !== JSON.stringify(next.scenario_ids) ||
            JSON.stringify(prev.field_ids) !== JSON.stringify(next.field_ids) ||
            JSON.stringify(prev.flag_ids) !== JSON.stringify(next.flag_ids) ||
            JSON.stringify(prev.question_ids) !== JSON.stringify(next.question_ids) ||
            JSON.stringify(prev.option_ids) !== JSON.stringify(next.option_ids) ||
            JSON.stringify(prev.video_ids) !== JSON.stringify(next.video_ids) ||
            JSON.stringify(prev.image_ids) !== JSON.stringify(next.image_ids) ||
            JSON.stringify(prev.objective_ids) !== JSON.stringify(next.objective_ids) ||
            JSON.stringify(prev.pending_ids) !== JSON.stringify(next.pending_ids);
          if (!changed) return prev;
          serverSyncPendingRef.current = true;
          return next;
        });
      }
    } catch {
      toast.error("Failed to save draft selections.");
    } finally {
      savingRef.current = false;
    }
  }, [draftId, formState, patchChatDraftAction]);

  // Debounced autosave on form state change
  useEffect(() => {
    // Skip autosave if this change was from server sync (prevents re-triggering)
    if (serverSyncPendingRef.current) {
      serverSyncPendingRef.current = false;
      return;
    }

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      void saveDraftNow();
    }, 700);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [formState, saveDraftNow]);

  const saveAndStart = useCallback(async () => {
    if (!socket || !isConnected) {
      toast.error("WebSocket not connected. Please refresh the page.");
      return;
    }

    setIsSaving(true);
    isStartingRef.current = true;
    try {
      await saveDraftNow();
      await generate({
        attemptId,
        chatId: chatEntryId,
        chatConfig: {
          ...formState,
          problem_statement_ids: formState.problem_statement_id
            ? [formState.problem_statement_id]
            : [],
        } as unknown as Record<string, unknown>,
        ...(draftId ? { draftId } : {}),
      });
      setIsSaving(false);
      isStartingRef.current = false;
    } catch {
      setIsSaving(false);
      isStartingRef.current = false;
      toast.error(generateError || "Failed to start training.");
    }
  }, [socket, isConnected, saveDraftNow, attemptId, chatEntryId, formState, draftId, generate, generateError]);

  // --- Stable value-change handlers (extracted from inline arrows) ---
  const handleNameIdChange = useCallback(
    (nameId: string | null) => {
      setFormState((prev) => ({
        ...prev,
        name_id: nameId,
        name: nameId
          ? (s.names?.find((item) => item.id === nameId)?.name ?? null)
          : null,
      }));
    },
    [s.names],
  );

  const handleNameChange = useCallback((name: string) => {
    setFormState((prev) => ({
      ...prev,
      name: name || null,
      name_id: null,
    }));
  }, []);

  const handleProblemStatementIdChange = useCallback(
    (problemStatementId: string | null) => {
      setFormState((prev) => ({
        ...prev,
        problem_statement_id: problemStatementId,
        problem_statement: problemStatementId
          ? (s.problem_statements?.find(
              (item) => item.problem_statement_id === problemStatementId,
            )?.problem_statement ?? null)
          : null,
      }));
    },
    [s.problem_statements],
  );

  const handleProblemStatementChange = useCallback(
    (problemStatement: string) => {
      setFormState((prev) => ({
        ...prev,
        problem_statement: problemStatement || null,
        problem_statement_id: null,
      }));
    },
    [],
  );

  if (!s.profile_has_access) {
    return (
      <p className="text-sm text-muted-foreground">
        You do not have access to this training bundle.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <StepCard
        stepStatus="active"
        stepNumber={1}
        stepTitle="Customize Training"
        stepDescription={s.simulation_name || "Training bundle"}
        customHeader={
          s.names ? (
            <Names
              name_id={formState.name_id}
              name_resource={selectedName}
              show_name={true}
              names={s.names ?? []}
              disabled={false}
              onNameIdChange={handleNameIdChange}
              onNameChange={handleNameChange}
              placeholder="e.g., My Training Session"
              defaultName="New Training"
              hideDescription={true}
            />
          ) : undefined
        }
      >
      <div className="space-y-4">
      {s.departments && (
        <Departments
          department_ids={formState.department_ids}
          department_resources={(s.departments ?? []).filter((item) => item.selected)}
          show_departments={true}
          departments={s.departments ?? []}
          onChange={(ids) =>
            setFormState((prev) => ({ ...prev, department_ids: ids }))
          }
          disabled={false}
          label="Departments"
        />
      )}

      {s.personas && (
        <Personas
          persona_ids={formState.persona_ids}
          persona_resources={(s.personas ?? []).filter((item) => item.selected)}
          show_personas={true}
          personas={s.personas ?? []}
          onChange={(ids) =>
            setFormState((prev) => ({ ...prev, persona_ids: ids }))
          }
          disabled={false}
          label="Personas"
        />
      )}

      {s.documents && (
        <Documents
          document_ids={formState.document_ids}
          document_resources={(s.documents ?? []).filter((item) => item.selected)}
          show_documents={true}
          documents={s.documents ?? []}
          onChange={(ids) =>
            setFormState((prev) => ({ ...prev, document_ids: ids }))
          }
          disabled={false}
          label="Documents"
        />
      )}

      {s.parameter_fields && (
        <ParameterFields
          parameterIds={expandedParameterIds}
          parameterFieldIds={formState.parameter_field_ids}
          parameterFieldResources={(s.parameter_fields ?? []).filter((item) => item.selected)}
          allParameters={allParameters}
          availableFields={s.parameter_fields ?? []}
          onToggleParameter={(parameterId, open) =>
            setExpandedParameterIds((prev) =>
              open
                ? Array.from(new Set([...prev, parameterId]))
                : prev.filter((id) => id !== parameterId),
            )
          }
          onChange={(ids) =>
            setFormState((prev) => ({ ...prev, parameter_field_ids: ids }))
          }
          disabled={false}
          label="Parameter Fields"
        />
      )}

      {s.questions && (
        <Questions
          question_ids={formState.question_ids}
          question_resources={selectedQuestions}
          show_questions={true}
          questions={s.questions ?? []}
          onChange={(ids) =>
            setFormState((prev) => ({ ...prev, question_ids: ids }))
          }
          disabled={false}
          label="Questions"
        />
      )}

      {s.options && (
        <Options
          option_ids={formState.option_ids}
          option_resources={(s.options ?? []).filter((item) => item.selected)}
          show_options={true}
          options={s.options ?? []}
          question_ids={formState.question_ids}
          question_resources={selectedQuestions}
          disabled={false}
          onChange={(ids) =>
            setFormState((prev) => ({ ...prev, option_ids: ids }))
          }
        />
      )}

      {s.videos && (
        <Videos
          video_ids={formState.video_ids}
          video_resources={(s.videos ?? []).filter((item) => item.selected)}
          show_videos={true}
          videos={s.videos ?? []}
          onChange={(ids) =>
            setFormState((prev) => ({ ...prev, video_ids: ids }))
          }
          disabled={false}
          label="Videos"
        />
      )}

      {s.images && (
        <Images
          image_ids={formState.image_ids}
          image_resources={(s.images ?? []).filter((item) => item.selected)}
          show_images={true}
          images={s.images ?? []}
          onChange={(ids) =>
            setFormState((prev) => ({ ...prev, image_ids: ids }))
          }
          disabled={false}
          label="Images"
        />
      )}

      {s.problem_statements && (
        <ProblemStatements
          problem_statement_id={formState.problem_statement_id}
          problem_statement_resource={selectedProblemStatement}
          show_problem_statement={true}
          problem_statements={s.problem_statements ?? []}
          onProblemStatementIdChange={handleProblemStatementIdChange}
          onProblemStatementChange={handleProblemStatementChange}
          disabled={false}
          label="Problem Statements"
        />
      )}

      {s.objectives && (
        <Objectives
          objective_ids={formState.objective_ids}
          objective_resources={(s.objectives ?? []).filter((item) => item.selected)}
          show_objectives={true}
          objectives={s.objectives ?? []}
          onChange={(ids) =>
            setFormState((prev) => ({ ...prev, objective_ids: ids }))
          }
          disabled={false}
          label="Objectives"
        />
      )}
      </div>
      </StepCard>

      <Card>
        <CardHeader>
          <CardTitle>Session Options</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={infiniteMode}
              onChange={(e) =>
                void setUrlParams({ infiniteMode: e.target.checked })
              }
            />
            <span>Infinite mode</span>
          </label>

          <div className="space-y-2">
            <Label htmlFor="user-instructions">User instructions</Label>
            <Input
              id="user-instructions"
              value={userInstructions}
              onChange={(e) =>
                void setUrlParams({
                  userInstructions: e.target.value || null,
                })
              }
              placeholder="Optional hint for generation"
            />
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => router.back()}>
              Cancel
            </Button>
            <Button
              onClick={() => void saveAndStart()}
              disabled={isSaving || !isConnected}
            >
              {isSaving ? "Starting..." : "Save & Start"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
