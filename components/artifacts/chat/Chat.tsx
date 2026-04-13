"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { useAttemptLifecycle } from "@/hooks/use-attempt-lifecycle";
import type {
  AttemptChatStartedEvent,
  AttemptEndedEvent,
  AttemptErrorEvent,
} from "@/hooks/use-attempt-lifecycle";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { useRouter } from "next/navigation";
import { parseAsBoolean, parseAsString, useQueryStates } from "nuqs";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

type GetChatOut = OutputOf<
  "/chat/get",
  "post"
>;
export type ChatData = GetChatOut;
type PatchChatDraftIn = InputOf<
  "/chat/draft",
  "patch"
>;
type PatchChatDraftOut = OutputOf<
  "/chat/draft",
  "patch"
>;

type ChatFormState = {
  department_ids: string[];
  persona_ids: string[];
  document_ids: string[];
  parameter_field_ids: string[];
  question_ids: string[];
  option_ids: string[];
  video_ids: string[];
  image_ids: string[];
  problem_statement_ids: string[];
  objective_ids: string[];
  // Value fields for unified draft (creatable resources)
  name: string | null;
  description: string | null;
};

interface ChatProps {
  bundleData: GetChatOut;
  patchChatDraftAction: (
    input: PatchChatDraftIn,
  ) => Promise<PatchChatDraftOut>;
  attemptId: string;
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

export default function Chat({
  bundleData,
  patchChatDraftAction,
  attemptId,
}: ChatProps) {
  const router = useRouter();
  const { socket, isConnected } = useSocket();
  const s = bundleData;
  const isStartingRef = useRef(false);

  const initialFormState = useMemo<ChatFormState>(
    () => ({
      department_ids: extractIds(s.departments?.current, "department_id"),
      persona_ids: extractIds(s.personas?.current, "persona_id"),
      document_ids: extractIds(s.documents?.current, "document_id"),
      parameter_field_ids: extractIds(
        s.parameter_fields?.current,
        "field_id",
      ),
      question_ids: extractIds(s.questions?.current, "question_id"),
      option_ids: extractIds(s.options?.current, "option_id"),
      video_ids: extractIds(s.videos?.current, "video_id"),
      image_ids: extractIds(s.images?.current, "image_id"),
      problem_statement_ids: extractIds(
        s.problem_statements?.current,
        "problem_statement_id",
      ),
      objective_ids: extractIds(s.objectives?.current, "objective_id"),
      name: null,
      description: null,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
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

  // Listen for attempt lifecycle events after submitting
  const { nextScenario } = useAttemptLifecycle({
    socket,
    attemptId,
    onChatStarted: useCallback(
      (data: AttemptChatStartedEvent) => {
        if (!isStartingRef.current) return;
        isStartingRef.current = false;
        setIsSaving(false);
        if (data.attempt_id === attemptId) {
          router.refresh();
        }
      },
      [attemptId, router],
    ),
    onEnded: useCallback(
      (data: AttemptEndedEvent) => {
        if (!isStartingRef.current) return;
        isStartingRef.current = false;
        setIsSaving(false);
        if (data.attempt_id === attemptId) {
          router.push(`/attempt/${attemptId}/results`);
        }
      },
      [attemptId, router],
    ),
    onError: useCallback((data: AttemptErrorEvent) => {
      if (!isStartingRef.current) return;
      if (
        data.type === "end" ||
        data.type === "start" ||
        data.type === "next"
      ) {
        isStartingRef.current = false;
        setIsSaving(false);
        toast.error(data.message || "Failed to start training.");
      }
    }, []),
  });

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
        input_draft_id: draftId,
        department_ids: formState.department_ids,
        persona_ids: formState.persona_ids,
        document_ids: formState.document_ids,
        parameter_field_ids: formState.parameter_field_ids,
        question_ids: formState.question_ids,
        option_ids: formState.option_ids,
        video_ids: formState.video_ids,
        image_ids: formState.image_ids,
        problem_statement_ids: formState.problem_statement_ids,
        objective_ids: formState.objective_ids,
      };

      // Single-select creatables: value clears the corresponding IDs
      if (formState.name) {
        payload["name"] = formState.name;
        delete payload["name_ids"];
      }
      if (formState.description) {
        payload["description"] = formState.description;
        delete payload["description_ids"];
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
        department_ids?: string[];
        persona_ids?: string[];
        document_ids?: string[];
        parameter_field_ids?: string[];
        question_ids?: string[];
        option_ids?: string[];
        video_ids?: string[];
        image_ids?: string[];
        problem_statement_ids?: string[];
        objective_ids?: string[];
      } | undefined;
      if (formStateData) {
        serverSyncPendingRef.current = true;
        setFormState((prev) => ({
          ...prev,
          department_ids: formStateData.department_ids ?? prev.department_ids,
          persona_ids: formStateData.persona_ids ?? prev.persona_ids,
          document_ids: formStateData.document_ids ?? prev.document_ids,
          parameter_field_ids: formStateData.parameter_field_ids ?? prev.parameter_field_ids,
          question_ids: formStateData.question_ids ?? prev.question_ids,
          option_ids: formStateData.option_ids ?? prev.option_ids,
          video_ids: formStateData.video_ids ?? prev.video_ids,
          image_ids: formStateData.image_ids ?? prev.image_ids,
          problem_statement_ids: formStateData.problem_statement_ids ?? prev.problem_statement_ids,
          objective_ids: formStateData.objective_ids ?? prev.objective_ids,
          // Clear value fields after server resolves them
          name: null,
          description: null,
        }));
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
      nextScenario(attemptId, { draftId: draftId ?? undefined });
    } catch {
      setIsSaving(false);
      isStartingRef.current = false;
      toast.error("Failed to save draft.");
    }
  }, [socket, isConnected, saveDraftNow, attemptId, draftId, nextScenario]);

  if (!s.profile_has_access) {
    return (
      <p className="text-sm text-muted-foreground">
        You do not have access to this training bundle.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Customize Training</h1>
        <p className="text-sm text-muted-foreground">
          {s.simulation_name || "Training bundle"}
        </p>
      </div>

      {s.names?.show && (
        <Names
          name_id={s.names.current?.[0]?.name_id ?? null}
          name_resource={s.names.current?.[0] ?? null}
          show_name={s.names.show}
          names={s.names.resources ?? []}
          disabled={false}
          onNameIdChange={(nameId) =>
            setFormState((prev) => ({ ...prev, name: null, name_id: nameId }))
          }
          onNameChange={(name) =>
            setFormState((prev) => ({ ...prev, name: name || null }))
          }
          placeholder="Enter name"
        />
      )}

      {s.departments?.show && (
        <Departments
          department_ids={formState.department_ids}
          department_resources={s.departments.current ?? []}
          show_departments={s.departments.show}
          departments={s.departments.resources ?? []}
          onChange={(ids) =>
            setFormState((prev) => ({ ...prev, department_ids: ids }))
          }
          disabled={false}
          label="Departments"
        />
      )}

      {s.personas?.show && (
        <Personas
          persona_ids={formState.persona_ids}
          persona_resources={s.personas.current ?? []}
          show_personas={s.personas.show}
          personas={s.personas.resources ?? []}
          onChange={(ids) =>
            setFormState((prev) => ({ ...prev, persona_ids: ids }))
          }
          disabled={false}
          label="Personas"
        />
      )}

      {s.documents?.show && (
        <Documents
          document_ids={formState.document_ids}
          document_resources={s.documents.current ?? []}
          show_documents={s.documents.show}
          documents={s.documents.resources ?? []}
          onChange={(ids) =>
            setFormState((prev) => ({ ...prev, document_ids: ids }))
          }
          disabled={false}
          label="Documents"
        />
      )}

      {s.parameter_fields?.show && (
        <ParameterFields
          parameter_field_ids={formState.parameter_field_ids}
          parameter_field_resources={s.parameter_fields.current ?? []}
          show_parameter_fields={s.parameter_fields.show}
          parameter_fields={s.parameter_fields.resources ?? []}
          onChange={(ids) =>
            setFormState((prev) => ({ ...prev, parameter_field_ids: ids }))
          }
          disabled={false}
          label="Parameter Fields"
        />
      )}

      {s.questions?.show && (
        <Questions
          question_ids={formState.question_ids}
          question_resources={s.questions.current ?? []}
          show_questions={s.questions.show}
          questions={s.questions.resources ?? []}
          onChange={(ids) =>
            setFormState((prev) => ({ ...prev, question_ids: ids }))
          }
          disabled={false}
          label="Questions"
        />
      )}

      {s.options?.show && (
        <Options
          option_ids={formState.option_ids}
          option_resources={s.options.current ?? []}
          show_options={s.options.show}
          options={s.options.resources ?? []}
          question_ids={formState.question_ids}
          question_resources={s.questions?.current ?? []}
          disabled={false}
          onChange={(ids) =>
            setFormState((prev) => ({ ...prev, option_ids: ids }))
          }
        />
      )}

      {s.videos?.show && (
        <Videos
          video_ids={formState.video_ids}
          video_resources={s.videos.current ?? []}
          show_videos={s.videos.show}
          videos={s.videos.resources ?? []}
          onChange={(ids) =>
            setFormState((prev) => ({ ...prev, video_ids: ids }))
          }
          disabled={false}
          label="Videos"
        />
      )}

      {s.images?.show && (
        <Images
          image_ids={formState.image_ids}
          image_resources={s.images.current ?? []}
          show_images={s.images.show}
          images={s.images.resources ?? []}
          onChange={(ids) =>
            setFormState((prev) => ({ ...prev, image_ids: ids }))
          }
          disabled={false}
          label="Images"
        />
      )}

      {s.problem_statements?.show && (
        <ProblemStatements
          problem_statement_ids={formState.problem_statement_ids}
          problem_statement_resources={s.problem_statements.current ?? []}
          show_problem_statements={s.problem_statements.show}
          problem_statements={s.problem_statements.resources ?? []}
          onChange={(ids) =>
            setFormState((prev) => ({
              ...prev,
              problem_statement_ids: ids,
            }))
          }
          disabled={false}
          label="Problem Statements"
        />
      )}

      {s.objectives?.show && (
        <Objectives
          objective_ids={formState.objective_ids}
          objective_resources={s.objectives.current ?? []}
          show_objectives={s.objectives.show}
          objectives={s.objectives.resources ?? []}
          onChange={(ids) =>
            setFormState((prev) => ({ ...prev, objective_ids: ids }))
          }
          disabled={false}
          label="Objectives"
        />
      )}

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
