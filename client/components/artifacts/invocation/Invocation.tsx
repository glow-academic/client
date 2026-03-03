"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Departments } from "@/components/resources/Departments";
import { Models } from "@/components/resources/Models";
import { Prompts } from "@/components/resources/Prompts";
import { Instructions } from "@/components/resources/Instructions";
import { Voices } from "@/components/resources/Voices";
import { TemperatureLevels } from "@/components/resources/TemperatureLevels";
import { ReasoningLevels } from "@/components/resources/ReasoningLevels";
import { Tools } from "@/components/resources/Tools";
import { Keys } from "@/components/resources/Keys";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { useRouter } from "next/navigation";
import { parseAsString, useQueryStates } from "nuqs";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

type GetBenchmarkBundleOut = OutputOf<
  "/api/v5/artifacts/invocation/get",
  "post"
>;
export type InvocationData = GetBenchmarkBundleOut;
type PatchBenchmarkBundleDraftIn = InputOf<
  "/api/v5/artifacts/invocation/draft",
  "patch"
>;
type PatchBenchmarkBundleDraftOut = OutputOf<
  "/api/v5/artifacts/invocation/draft",
  "patch"
>;

type BenchmarkBundleFormState = {
  department_ids: string[];
  model_ids: string[];
  prompt_ids: string[];
  instruction_ids: string[];
  voice_ids: string[];
  temperature_level_ids: string[];
  reasoning_level_ids: string[];
  tool_ids: string[];
  key_ids: string[];
};

function extractIds<T>(
  items: T[] | null | undefined,
  idKey: keyof T,
): string[] {
  if (!items) return [];
  return items
    .map((item) => item[idKey] as string | null | undefined)
    .filter((id): id is string => !!id);
}

interface InvocationProps {
  bundleData: GetBenchmarkBundleOut;
  testId: string;
  patchBenchmarkDraftAction: (
    input: PatchBenchmarkBundleDraftIn,
  ) => Promise<PatchBenchmarkBundleDraftOut>;
}

export default function Invocation({
  bundleData,
  testId,
  patchBenchmarkDraftAction,
}: InvocationProps) {
  const router = useRouter();
  const s = bundleData;

  const initialFormState = useMemo<BenchmarkBundleFormState>(
    () => ({
      department_ids: extractIds(s.departments?.current, "department_id"),
      model_ids: extractIds(s.models?.current, "id"),
      prompt_ids: extractIds(s.prompts?.current, "id"),
      instruction_ids: extractIds(s.instructions?.current, "id"),
      voice_ids: extractIds(s.voices?.current, "id"),
      temperature_level_ids: extractIds(s.temperature_levels?.current, "id"),
      reasoning_level_ids: extractIds(s.reasoning_levels?.current, "id"),
      tool_ids: extractIds(s.tools?.current, "id"),
      key_ids: extractIds(s.keys?.current, "id"),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const [formState, setFormState] =
    useState<BenchmarkBundleFormState>(initialFormState);

  const [urlParams, setUrlParams] = useQueryStates(
    {
      draftId: parseAsString,
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
      const result = await patchBenchmarkDraftAction({
        body: {
          input_draft_id: draftId,
          expected_version: draftVersion,
          department_ids: formState.department_ids,
          model_ids: formState.model_ids,
          prompt_ids: formState.prompt_ids,
          instruction_ids: formState.instruction_ids,
          voice_ids: formState.voice_ids,
          temperature_level_ids: formState.temperature_level_ids,
          reasoning_level_ids: formState.reasoning_level_ids,
          tool_ids: formState.tool_ids,
          key_ids: formState.key_ids,
        },
      } as PatchBenchmarkBundleDraftIn);

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
  }, [draftId, draftVersion, formState, patchBenchmarkDraftAction]);

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
      const params = new URLSearchParams();
      if (draftId) params.set("draftId", draftId);
      const qs = params.toString();
      router.push(`/test/${testId}${qs ? `?${qs}` : ""}`);
    } catch {
      toast.error("Failed to save draft.");
    } finally {
      setIsSaving(false);
    }
  }, [saveDraftNow, testId, draftId, router]);

  if (!s.profile_has_access) {
    return (
      <p className="text-sm text-muted-foreground">
        You do not have access to this benchmark bundle.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Customize Benchmark</h1>
        <p className="text-sm text-muted-foreground">
          Configure resources for this benchmark run.
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

      {s.models?.show && (
        <Models
          model_id={formState.model_ids[0] ?? null}
          model_resource={s.models.current?.[0] ?? null}
          show_models={s.models.show}
          models={s.models.resources ?? []}
          disabled={false}
          onModelIdChange={(id: string | null) =>
            setFormState((prev) => ({ ...prev, model_ids: id ? [id] : [] }))
          }
          label="Models"
        />
      )}

      {s.prompts?.show && (
        <Prompts
          prompt_id={formState.prompt_ids[0] ?? null}
          prompt_resource={s.prompts.current?.[0] ?? null}
          show_prompts={s.prompts.show}
          prompts={s.prompts.resources ?? []}
          disabled={false}
          onPromptIdChange={(id: string | null) =>
            setFormState((prev) => ({ ...prev, prompt_ids: id ? [id] : [] }))
          }
          label="Prompts"
        />
      )}

      {s.instructions?.show && (
        <Instructions
          instruction_id={formState.instruction_ids[0] ?? null}
          instruction_resource={s.instructions.current?.[0] ?? null}
          show_instructions={s.instructions.show}
          instructions={s.instructions.resources ?? []}
          disabled={false}
          onInstructionIdChange={(id: string | null) =>
            setFormState((prev) => ({
              ...prev,
              instruction_ids: id ? [id] : [],
            }))
          }
          label="Instructions"
        />
      )}

      {s.voices?.show && (
        <Voices
          voice_ids={formState.voice_ids}
          voice_resources={s.voices.current ?? []}
          show_voices={s.voices.show}
          voices={s.voices.resources ?? []}
          disabled={false}
          onVoiceIdsChange={(ids) =>
            setFormState((prev) => ({ ...prev, voice_ids: ids }))
          }
          label="Voices"
        />
      )}

      {s.temperature_levels?.show && (
        <TemperatureLevels
          temperature_level_id={formState.temperature_level_ids[0] ?? null}
          temperature_level_resource={s.temperature_levels.current?.[0] ?? null}
          show_temperature_levels={s.temperature_levels.show}
          temperature_levels={s.temperature_levels.resources ?? []}
          disabled={false}
          onTemperatureLevelIdChange={(id: string | null) =>
            setFormState((prev) => ({
              ...prev,
              temperature_level_ids: id ? [id] : [],
            }))
          }
        />
      )}

      {s.reasoning_levels?.show && (
        <ReasoningLevels
          reasoning_level_id={formState.reasoning_level_ids[0] ?? null}
          reasoning_level_resource={s.reasoning_levels.current?.[0] ?? null}
          show_reasoning_levels={s.reasoning_levels.show}
          reasoning_levels={s.reasoning_levels.resources ?? []}
          disabled={false}
          onReasoningLevelIdChange={(id: string | null) =>
            setFormState((prev) => ({
              ...prev,
              reasoning_level_ids: id ? [id] : [],
            }))
          }
        />
      )}

      {s.tools?.show && (
        <Tools
          tool_ids={formState.tool_ids}
          tool_resources={s.tools.current ?? []}
          show_tools={s.tools.show}
          tools={s.tools.resources ?? []}
          disabled={false}
          onChange={(ids) =>
            setFormState((prev) => ({ ...prev, tool_ids: ids }))
          }
        />
      )}

      {s.keys?.show && (
        <Keys
          key_id={formState.key_ids[0] ?? null}
          key_resource={s.keys.current?.[0] ?? null}
          show_key={s.keys.show}
          keys={s.keys.resources ?? []}
          disabled={false}
          onKeyIdChange={(id: string | null) =>
            setFormState((prev) => ({ ...prev, key_ids: id ? [id] : [] }))
          }
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle>Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
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
