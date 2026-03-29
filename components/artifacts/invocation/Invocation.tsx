"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Names } from "@/components/resources/Names";
import { Descriptions } from "@/components/resources/Descriptions";
import { Values } from "@/components/resources/Values";
import { Flags } from "@/components/resources/Flags";
import { Departments } from "@/components/resources/Departments";
import { Keys } from "@/components/resources/Keys";
import { Endpoints } from "@/components/resources/Endpoints";
import { Modalities } from "@/components/resources/Modalities";
import { TemperatureLevels } from "@/components/resources/TemperatureLevels";
import { Pricing } from "@/components/resources/Pricing";
import { ReasoningLevels } from "@/components/resources/ReasoningLevels";
import { Qualities } from "@/components/resources/Qualities";
import { Voices } from "@/components/resources/Voices";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { useRouter } from "next/navigation";
import { parseAsString, useQueryStates } from "nuqs";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

type GetBenchmarkBundleOut = OutputOf<
  "/invocation/get",
  "post"
>;
export type InvocationData = GetBenchmarkBundleOut;
type PatchBenchmarkBundleDraftIn = InputOf<
  "/invocation/draft",
  "patch"
>;
type PatchBenchmarkBundleDraftOut = OutputOf<
  "/invocation/draft",
  "patch"
>;

type BenchmarkBundleFormState = {
  name: string | null;
  description: string | null;
  name_ids: string[];
  description_ids: string[];
  value_ids: string[];
  flag_ids: string[];
  department_ids: string[];
  key_ids: string[];
  endpoint_ids: string[];
  modality_ids: string[];
  temperature_level_ids: string[];
  pricing_ids: string[];
  reasoning_level_ids: string[];
  quality_ids: string[];
  voice_ids: string[];
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
      name: null,
      description: null,
      name_ids: extractIds(s.names?.current, "id"),
      description_ids: extractIds(s.descriptions?.current, "id"),
      value_ids: extractIds(s.values?.current, "id"),
      flag_ids: extractIds(s.flags?.current, "id"),
      department_ids: extractIds(s.departments?.current, "department_id"),
      key_ids: extractIds(s.keys?.current, "id"),
      endpoint_ids: extractIds(s.endpoints?.current, "id"),
      modality_ids: extractIds(s.modalities?.current, "id"),
      temperature_level_ids: extractIds(s.temperature_levels?.current, "id"),
      pricing_ids: extractIds(s.pricing?.current, "id"),
      reasoning_level_ids: extractIds(s.reasoning_levels?.current, "id"),
      quality_ids: extractIds(s.qualities?.current, "id"),
      voice_ids: extractIds(s.voices?.current, "id"),
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
  const serverSyncPendingRef = useRef(false);

  useEffect(() => {
    if (draftId && draftId !== urlParams.draftId) {
      void setUrlParams({ draftId });
    }
  }, [draftId, setUrlParams, urlParams.draftId]);

  const saveDraftNow = useCallback(async () => {
    if (savingRef.current) return;

    savingRef.current = true;
    try {
      // Build payload with ID fields
      const payload: Record<string, unknown> = {
        input_draft_id: draftId,
        expected_version: draftVersion,
        name_ids: formState.name_ids,
        description_ids: formState.description_ids,
        value_ids: formState.value_ids,
        flag_ids: formState.flag_ids,
        department_ids: formState.department_ids,
        key_ids: formState.key_ids,
        endpoint_ids: formState.endpoint_ids,
        temperature_level_ids: formState.temperature_level_ids,
        pricing_ids: formState.pricing_ids,
        reasoning_level_ids: formState.reasoning_level_ids,
        voice_ids: formState.voice_ids,
      };

      // Overlay value fields (name/description) if set
      if (formState.name !== null) {
        payload["name"] = formState.name;
      }
      if (formState.description !== null) {
        payload["description"] = formState.description;
      }

      const result = await patchBenchmarkDraftAction({
        body: payload,
      } as PatchBenchmarkBundleDraftIn);

      if (result.draft_id) {
        setDraftId(result.draft_id);
      }
      if (typeof result.new_version === "number") {
        setDraftVersion(result.new_version);
      }

      // Sync form state from server response (server is source of truth)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fs = (result as any).form_state as
        | {
            name_ids: string[];
            description_ids: string[];
            value_ids: string[];
            flag_ids: string[];
            department_ids: string[];
            key_ids: string[];
            endpoint_ids: string[];
            temperature_level_ids: string[];
            pricing_ids: string[];
            reasoning_level_ids: string[];
            voice_ids: string[];
          }
        | undefined;
      if (fs) {
        serverSyncPendingRef.current = true;
        setFormState((prev) => ({
          ...prev,
          name: null,
          description: null,
          name_ids: fs.name_ids,
          description_ids: fs.description_ids,
          value_ids: fs.value_ids,
          flag_ids: fs.flag_ids,
          department_ids: fs.department_ids,
          key_ids: fs.key_ids,
          endpoint_ids: fs.endpoint_ids,
          temperature_level_ids: fs.temperature_level_ids,
          pricing_ids: fs.pricing_ids,
          reasoning_level_ids: fs.reasoning_level_ids,
          voice_ids: fs.voice_ids,
        }));
      }
    } catch {
      toast.error("Failed to save draft selections.");
    } finally {
      savingRef.current = false;
    }
  }, [draftId, draftVersion, formState, patchBenchmarkDraftAction]);

  // Debounced autosave on form state change
  useEffect(() => {
    // Skip autosave when syncing server state
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

      {s.names?.show && (
        <Names
          name_id={formState.name_ids[0] ?? null}
          name_resource={s.names.current?.[0] ?? null}
          show_name={s.names.show}
          names={s.names.resources ?? []}
          disabled={false}
          onNameIdChange={(id: string | null) =>
            setFormState((prev) => ({
              ...prev,
              name_ids: id ? [id] : [],
            }))
          }
          onNameChange={(name: string) =>
            setFormState((prev) => ({ ...prev, name }))
          }
        />
      )}

      {s.descriptions?.show && (
        <Descriptions
          description_id={formState.description_ids[0] ?? null}
          description_resource={s.descriptions.current?.[0] ?? null}
          show_description={s.descriptions.show}
          descriptions={s.descriptions.resources ?? []}
          disabled={false}
          onDescriptionIdChange={(id: string | null) =>
            setFormState((prev) => ({
              ...prev,
              description_ids: id ? [id] : [],
            }))
          }
          onDescriptionChange={(description: string) =>
            setFormState((prev) => ({ ...prev, description }))
          }
        />
      )}

      {s.values?.show && (
        <Values
          value_ids={formState.value_ids}
          value_resources={s.values.current ?? []}
          show_values={s.values.show}
          values={s.values.resources ?? []}
          disabled={false}
          onChange={(ids) =>
            setFormState((prev) => ({ ...prev, value_ids: ids }))
          }
          label="Values"
        />
      )}

      {s.flags?.show && (
        <Flags
          flags={
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (s.flags.resources ?? []).map((f: any) => ({
              key: f.id,
              label: f.name ?? f.id,
              description: f.description ?? null,
              flag_option_id: formState.flag_ids.includes(f.id) ? f.id : null,
              show: true,
            }))
          }
          show_flags={s.flags.show}
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

      {s.endpoints?.show && (
        <Endpoints
          endpoint_ids={formState.endpoint_ids}
          endpoint_resources={s.endpoints.current ?? []}
          show_endpoints={s.endpoints.show}
          endpoints={s.endpoints.resources ?? []}
          disabled={false}
          onChange={(ids) =>
            setFormState((prev) => ({ ...prev, endpoint_ids: ids }))
          }
          label="Endpoints"
        />
      )}

      {s.modalities?.show && (
        <Modalities
          modality_ids={formState.modality_ids}
          modality_resources={s.modalities.current ?? []}
          show_modalities={s.modalities.show}
          modalities={s.modalities.resources ?? []}
          disabled={false}
          onChange={(ids) =>
            setFormState((prev) => ({ ...prev, modality_ids: ids }))
          }
          label="Modalities"
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

      {s.pricing?.show && (
        <Pricing
          pricing_ids={formState.pricing_ids}
          pricing_resources={s.pricing.current ?? []}
          show_pricing={s.pricing.show}
          pricings={s.pricing.resources ?? []}
          disabled={false}
          onChange={(ids) =>
            setFormState((prev) => ({ ...prev, pricing_ids: ids }))
          }
          label="Pricing"
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

      {s.qualities?.show && (
        <Qualities
          quality_ids={formState.quality_ids}
          quality_resources={s.qualities.current ?? []}
          show_qualities={s.qualities.show}
          qualities={s.qualities.resources ?? []}
          disabled={false}
          onChange={(ids) =>
            setFormState((prev) => ({ ...prev, quality_ids: ids }))
          }
          label="Qualities"
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
