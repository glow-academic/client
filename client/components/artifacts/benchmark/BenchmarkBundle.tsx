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
import type { OutputOf } from "@/lib/api/types";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type GetBenchmarkBundleOut = OutputOf<
  "/api/v4/artifacts/benchmark/bundle/get",
  "post"
>;
export type BenchmarkBundleData = GetBenchmarkBundleOut;

type BenchmarkBundleFormState = {
  department_ids: string[];
  model_id: string | null;
  prompt_id: string | null;
  instruction_id: string | null;
  voice_ids: string[];
  temperature_level_id: string | null;
  reasoning_level_id: string | null;
  tool_ids: string[];
  key_id: string | null;
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

function extractFirstId<T>(
  items: T[] | null | undefined,
  idKey: keyof T,
): string | null {
  if (!items || items.length === 0) return null;
  const val = items[0][idKey] as string | null | undefined;
  return val ?? null;
}

interface BenchmarkBundleProps {
  bundleData: GetBenchmarkBundleOut;
  testId: string;
}

export default function BenchmarkBundle({
  bundleData,
  testId,
}: BenchmarkBundleProps) {
  const router = useRouter();
  const s = bundleData;

  const initialFormState = useMemo<BenchmarkBundleFormState>(
    () => ({
      department_ids: extractIds(s.departments?.current, "department_id"),
      model_id: extractFirstId(s.models?.current, "id"),
      prompt_id: extractFirstId(s.prompts?.current, "id"),
      instruction_id: extractFirstId(s.instructions?.current, "id"),
      voice_ids: extractIds(s.voices?.current, "id"),
      temperature_level_id: extractFirstId(s.temperature_levels?.current, "id"),
      reasoning_level_id: extractFirstId(s.reasoning_levels?.current, "id"),
      tool_ids: extractIds(s.tools?.current, "id"),
      key_id: extractFirstId(s.keys?.current, "id"),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const [formState, setFormState] =
    useState<BenchmarkBundleFormState>(initialFormState);
  const [isSaving, setIsSaving] = useState(false);

  const saveAndReturn = async () => {
    setIsSaving(true);
    try {
      router.push(`/benchmark/${testId}`);
    } finally {
      setIsSaving(false);
    }
  };

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
          model_id={formState.model_id}
          model_resource={
            s.models.current?.[0]
              ? {
                  id: s.models.current[0].id ?? null,
                  name: s.models.current[0].name ?? null,
                  description: s.models.current[0].description ?? null,
                }
              : null
          }
          show_models={s.models.show}
          models={
            s.models.resources?.map((m) => ({
              model_id: m.id ?? null,
              name: m.name ?? null,
              description: m.description ?? null,
            })) ?? []
          }
          disabled={false}
          onModelIdChange={(id) =>
            setFormState((prev) => ({ ...prev, model_id: id }))
          }
          label="Models"
        />
      )}

      {s.prompts?.show && (
        <Prompts
          prompt_id={formState.prompt_id}
          prompt_resource={
            s.prompts.current?.[0]
              ? {
                  id: s.prompts.current[0].id ?? null,
                  name: s.prompts.current[0].name ?? null,
                  description: s.prompts.current[0].description ?? null,
                  system_prompt: s.prompts.current[0].system_prompt ?? null,
                }
              : null
          }
          show_prompts={s.prompts.show}
          prompts={
            s.prompts.resources?.map((p) => ({
              prompt_id: p.id ?? null,
              name: p.name ?? null,
              description: p.description ?? null,
              system_prompt: p.system_prompt ?? null,
            })) ?? []
          }
          disabled={false}
          onPromptIdChange={(id) =>
            setFormState((prev) => ({ ...prev, prompt_id: id }))
          }
          label="Prompts"
        />
      )}

      {s.instructions?.show && (
        <Instructions
          instruction_id={formState.instruction_id}
          instruction_resource={
            s.instructions.current?.[0]
              ? {
                  id: s.instructions.current[0].id ?? null,
                  template: s.instructions.current[0].template ?? null,
                }
              : null
          }
          show_instructions={s.instructions.show}
          instructions={
            s.instructions.resources?.map((i) => ({
              instruction_id: i.id ?? null,
              template: i.template ?? null,
            })) ?? []
          }
          disabled={false}
          onInstructionIdChange={(id) =>
            setFormState((prev) => ({ ...prev, instruction_id: id }))
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
          temperature_level_id={formState.temperature_level_id}
          temperature_level_resource={
            s.temperature_levels.current?.[0]
              ? {
                  id: s.temperature_levels.current[0].id ?? null,
                  temperature:
                    s.temperature_levels.current[0].temperature != null
                      ? String(s.temperature_levels.current[0].temperature)
                      : null,
                }
              : null
          }
          show_temperature_levels={s.temperature_levels.show}
          temperature_levels={
            s.temperature_levels.resources?.map((t) => ({
              id: t.id ?? null,
              temperature: t.temperature != null ? String(t.temperature) : null,
            })) ?? []
          }
          disabled={false}
          onTemperatureLevelIdChange={(id) =>
            setFormState((prev) => ({ ...prev, temperature_level_id: id }))
          }
        />
      )}

      {s.reasoning_levels?.show && (
        <ReasoningLevels
          reasoning_level_id={formState.reasoning_level_id}
          reasoning_level_resource={
            s.reasoning_levels.current?.[0]
              ? {
                  id: s.reasoning_levels.current[0].id ?? null,
                  reasoning_level:
                    s.reasoning_levels.current[0].reasoning_level ?? null,
                }
              : null
          }
          show_reasoning_levels={s.reasoning_levels.show}
          reasoning_levels={
            s.reasoning_levels.resources?.map((r) => ({
              id: r.id ?? null,
              reasoning_level: r.reasoning_level ?? null,
            })) ?? []
          }
          disabled={false}
          onReasoningLevelIdChange={(id) =>
            setFormState((prev) => ({ ...prev, reasoning_level_id: id }))
          }
        />
      )}

      {s.tools?.show && (
        <Tools
          tool_ids={formState.tool_ids}
          tool_resources={
            s.tools.current?.map((t) => ({
              tool_id: t.id ?? null,
              name: t.name ?? null,
              description: t.description ?? null,
            })) ?? []
          }
          show_tools={s.tools.show}
          tools={
            s.tools.resources?.map((t) => ({
              tool_id: t.id ?? null,
              name: t.name ?? null,
              description: t.description ?? null,
            })) ?? []
          }
          disabled={false}
          onChange={(ids) =>
            setFormState((prev) => ({ ...prev, tool_ids: ids }))
          }
        />
      )}

      {s.keys?.show && (
        <Keys
          key_id={formState.key_id}
          key_resource={
            s.keys.current?.[0]
              ? {
                  id: s.keys.current[0].id ?? null,
                  name: s.keys.current[0].name ?? null,
                  description: s.keys.current[0].description ?? null,
                  key_masked: null,
                  active: null,
                }
              : null
          }
          show_key={s.keys.show}
          keys={
            s.keys.resources?.map((k) => ({
              id: k.id ?? null,
              name: k.name ?? null,
              description: k.description ?? null,
              key_masked: null,
              active: null,
            })) ?? []
          }
          disabled={false}
          onKeyIdChange={(id) =>
            setFormState((prev) => ({ ...prev, key_id: id }))
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
