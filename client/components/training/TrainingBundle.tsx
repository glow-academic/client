"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Departments } from "@/components/resources/Departments";
import { Personas } from "@/components/resources/Personas";
import { Documents } from "@/components/resources/Documents";
import { ParameterFields } from "@/components/resources/ParameterFields";
import { Scenarios } from "@/components/resources/Scenarios";
import { Parameters } from "@/components/resources/Parameters";
import { Fields } from "@/components/resources/Fields";
import { Questions } from "@/components/resources/Questions";
import { Videos } from "@/components/resources/Videos";
import { Images } from "@/components/resources/Images";
import { Templates } from "@/components/resources/Templates";
import { ProblemStatements } from "@/components/resources/ProblemStatements";
import { Objectives } from "@/components/resources/Objectives";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { useRouter } from "next/navigation";
import { parseAsBoolean, parseAsString, useQueryStates } from "nuqs";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

type GetTrainingBundleOut = OutputOf<
  "/api/v4/artifacts/training/bundle/get",
  "post"
>;
export type TrainingBundleData = GetTrainingBundleOut;
type PatchTrainingBundleDraftIn = InputOf<
  "/api/v4/artifacts/training/draft",
  "patch"
>;
type PatchTrainingBundleDraftOut = OutputOf<
  "/api/v4/artifacts/training/draft",
  "patch"
>;

type TrainingBundleFormState = {
  department_ids: string[];
  persona_ids: string[];
  document_ids: string[];
  parameter_field_ids: string[];
  scenario_ids: string[];
  parameter_ids: string[];
  field_ids: string[];
  question_ids: string[];
  option_ids: string[];
  video_ids: string[];
  image_ids: string[];
  template_ids: string[];
  problem_statement_ids: string[];
  objective_ids: string[];
};

interface TrainingBundleProps {
  mode: "practice" | "home";
  bundleData: GetTrainingBundleOut;
  patchTrainingDraftAction: (
    input: PatchTrainingBundleDraftIn,
  ) => Promise<PatchTrainingBundleDraftOut>;
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

export default function TrainingBundle({
  mode,
  bundleData,
  patchTrainingDraftAction,
  attemptId,
}: TrainingBundleProps) {
  const router = useRouter();
  const s = bundleData;

  const initialFormState = useMemo<TrainingBundleFormState>(
    () => ({
      department_ids: extractIds(s.departments?.current, "department_id"),
      persona_ids: extractIds(s.personas?.current, "persona_id"),
      document_ids: extractIds(s.documents?.current, "document_id"),
      parameter_field_ids: extractIds(
        s.parameter_fields?.current,
        "field_id",
      ),
      scenario_ids: extractIds(s.scenarios?.current, "scenario_id"),
      parameter_ids: extractIds(s.parameters?.current, "parameter_id"),
      field_ids: extractIds(s.fields?.current, "field_id"),
      question_ids: extractIds(s.questions?.current, "question_id"),
      option_ids: extractIds(s.options?.current, "option_id"),
      video_ids: extractIds(s.videos?.current, "video_id"),
      image_ids: extractIds(s.images?.current, "image_id"),
      template_ids: extractIds(s.templates?.current, "template_id"),
      problem_statement_ids: extractIds(
        s.problem_statements?.current,
        "problem_statement_id",
      ),
      objective_ids: extractIds(s.objectives?.current, "objective_id"),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const [formState, setFormState] =
    useState<TrainingBundleFormState>(initialFormState);

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
  const [draftVersion, setDraftVersion] = useState<number>(
    s.draft_version ?? 0,
  );
  const [isSaving, setIsSaving] = useState(false);

  const infiniteMode = urlParams.infiniteMode ?? false;
  const userInstructions = urlParams.userInstructions || "";

  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const savingRef = useRef(false);

  useEffect(() => {
    if (draftId && draftId !== urlParams.draftId) {
      void setUrlParams({ draftId });
    }
  }, [draftId, setUrlParams, urlParams.draftId]);

  const saveDraftNow = useCallback(async () => {
    if (savingRef.current) return;

    savingRef.current = true;
    try {
      const result = await patchTrainingDraftAction({
        body: {
          input_draft_id: draftId,
          expected_version: draftVersion,
          departments: { resource_ids: formState.department_ids },
          personas: { resource_ids: formState.persona_ids },
          documents: { resource_ids: formState.document_ids },
          parameter_fields: { resource_ids: formState.parameter_field_ids },
          parameters: { resource_ids: formState.parameter_ids },
          fields: { resource_ids: formState.field_ids },
          questions: { resource_ids: formState.question_ids },
          options: { resource_ids: formState.option_ids },
          videos: { resource_ids: formState.video_ids },
          images: { resource_ids: formState.image_ids },
          templates: { resource_ids: formState.template_ids },
          problem_statements: {
            resource_ids: formState.problem_statement_ids,
          },
          objectives: { resource_ids: formState.objective_ids },
        },
      } as PatchTrainingBundleDraftIn);

      if (result.draft_id) {
        setDraftId(result.draft_id);
      }
      if (typeof result.new_version === "number") {
        setDraftVersion(result.new_version);
      }
    } catch {
      toast.error("Failed to save draft selections.");
    } finally {
      savingRef.current = false;
    }
  }, [draftId, draftVersion, formState, patchTrainingDraftAction]);

  // Debounced autosave on form state change
  useEffect(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      void saveDraftNow();
    }, 700);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [formState, saveDraftNow]);

  const saveAndReturn = useCallback(async () => {
    setIsSaving(true);
    try {
      await saveDraftNow();
      const basePath = mode === "practice" ? "/practice" : "/home";
      const params = new URLSearchParams();
      if (draftId) params.set("draftId", draftId);
      if (infiniteMode) params.set("infiniteMode", "true");
      if (userInstructions.trim()) params.set("userInstructions", userInstructions.trim());
      const qs = params.toString();
      router.push(`${basePath}/a/${attemptId}${qs ? `?${qs}` : ""}`);
    } catch {
      toast.error("Failed to save draft.");
    } finally {
      setIsSaving(false);
    }
  }, [saveDraftNow, mode, attemptId, draftId, infiniteMode, userInstructions, router]);

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

      {s.scenarios?.show && (
        <Scenarios
          scenario_ids={formState.scenario_ids}
          scenario_resources={s.scenarios.current ?? []}
          show_scenarios={s.scenarios.show}
          scenarios={s.scenarios.resources ?? []}
          onChange={(ids) =>
            setFormState((prev) => ({ ...prev, scenario_ids: ids }))
          }
          disabled={false}
          label="Scenarios"
        />
      )}

      {s.parameters?.show && (
        <Parameters
          parameter_ids={formState.parameter_ids}
          parameter_resources={s.parameters.current ?? []}
          show_parameters={s.parameters.show}
          parameters={s.parameters.resources ?? []}
          onChange={(ids) =>
            setFormState((prev) => ({ ...prev, parameter_ids: ids }))
          }
          disabled={false}
          label="Parameters"
        />
      )}

      {s.fields?.show && (
        <Fields
          field_ids={formState.field_ids}
          field_resources={s.fields.current ?? []}
          show_fields={s.fields.show}
          fields={s.fields.resources ?? []}
          onChange={(ids) =>
            setFormState((prev) => ({ ...prev, field_ids: ids }))
          }
          disabled={false}
          label="Fields"
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

      {s.templates?.show && (
        <Templates
          template_ids={formState.template_ids}
          template_resources={s.templates.current ?? []}
          show_templates={s.templates.show}
          templates={s.templates.resources ?? []}
          onChange={(ids) =>
            setFormState((prev) => ({ ...prev, template_ids: ids }))
          }
          disabled={false}
          label="Templates"
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
              onClick={() => void saveAndReturn()}
              disabled={isSaving}
            >
              {isSaving ? "Saving..." : "Save & Return"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
