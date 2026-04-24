"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StepCard } from "@/components/common/forms/StepCard";
import { Departments } from "@/components/resources/Departments";
import { Descriptions } from "@/components/resources/Descriptions";
import { Endpoints } from "@/components/resources/Endpoints";
import { Flags } from "@/components/resources/Flags";
import { Keys } from "@/components/resources/Keys";
import { Modalities } from "@/components/resources/Modalities";
import { Names } from "@/components/resources/Names";
import { Pricing } from "@/components/resources/Pricing";
import { Qualities } from "@/components/resources/Qualities";
import { ReasoningLevels } from "@/components/resources/ReasoningLevels";
import { TemperatureLevels } from "@/components/resources/TemperatureLevels";
import { Values } from "@/components/resources/Values";
import { Voices } from "@/components/resources/Voices";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { useRouter } from "next/navigation";
import { parseAsString, useQueryStates } from "nuqs";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

export type InvocationData = OutputOf<"/test/invocation/get", "post">;

type PatchInvocationDraftIn = InputOf<"/test/invocation/draft", "patch">;
type PatchInvocationDraftOut = OutputOf<"/test/invocation/draft", "patch">;

type InvocationFormState = {
  name_id: string | null;
  name: string | null;
  description_id: string | null;
  description: string | null;
  value_id: string | null;
  flag_ids: string[];
  department_ids: string[];
  key_id: string | null;
  endpoint_id: string | null;
  modality_ids: string[];
  temperature_level_id: string | null;
  pricing_id: string | null;
  reasoning_level_id: string | null;
  quality_ids: string[];
  voice_ids: string[];
  pending_ids: string[];
};

function collectPendingIds(data: InvocationData): string[] {
  return [
    ...((data.names ?? []).map((item) => (item.pending ? item.id : null))),
    ...((data.descriptions ?? []).map((item) => (item.pending ? item.id : null))),
    ...((data.values ?? []).map((item) => (item.pending ? item.id : null))),
    ...((data.flags ?? []).map((item) => (item.pending ? item.id : null))),
    ...((data.departments ?? []).map((item) => (item.pending ? item.department_id : null))),
    ...((data.keys ?? []).map((item) => (item.pending ? (item.key_id ?? item.id) : null))),
    ...((data.endpoints ?? []).map((item) => (item.pending ? item.id : null))),
    ...((data.modalities ?? []).map((item) => (item.pending ? (item.modality_id ?? item.id) : null))),
    ...((data.temperature_levels ?? []).map((item) => (item.pending ? item.id : null))),
    ...((data.pricing ?? []).map((item) => (item.pending ? (item.pricing_id ?? item.id) : null))),
    ...((data.reasoning_levels ?? []).map((item) => (item.pending ? item.id : null))),
    ...((data.qualities ?? []).map((item) => (item.pending ? (item.quality_id ?? item.id) : null))),
    ...((data.voices ?? []).map((item) => (item.pending ? item.id : null))),
  ].filter((id): id is string => !!id);
}

function getInitialFormState(data: InvocationData): InvocationFormState {
  return {
    name_id: data.names?.find((item) => item.selected)?.id ?? null,
    name: null,
    description_id: data.descriptions?.find((item) => item.selected)?.id ?? null,
    description: null,
    value_id: data.values?.find((item) => item.selected)?.id ?? null,
    flag_ids: (data.flags ?? [])
      .filter((item) => item.selected)
      .map((item) => item.id)
      .filter((id): id is string => !!id),
    department_ids: (data.departments ?? [])
      .filter((item) => item.selected)
      .map((item) => item.department_id)
      .filter((id): id is string => !!id),
    key_id: data.keys?.find((item) => item.selected)?.id ?? null,
    endpoint_id: data.endpoints?.find((item) => item.selected)?.id ?? null,
    modality_ids: (data.modalities ?? [])
      .filter((item) => item.selected)
      .map((item) => item.modality_id ?? item.id)
      .filter((id): id is string => !!id),
    temperature_level_id: data.temperature_levels?.find((item) => item.selected)?.id ?? null,
    pricing_id: data.pricing?.find((item) => item.selected)?.id ?? null,
    reasoning_level_id: data.reasoning_levels?.find((item) => item.selected)?.id ?? null,
    quality_ids: (data.qualities ?? [])
      .filter((item) => item.selected)
      .map((item) => item.quality_id ?? item.id)
      .filter((id): id is string => !!id),
    voice_ids: (data.voices ?? [])
      .filter((item) => item.selected)
      .map((item) => item.id)
      .filter((id): id is string => !!id),
    pending_ids: data.pending_ids?.length ? data.pending_ids : collectPendingIds(data),
  };
}

interface InvocationProps {
  bundleData: InvocationData;
  testId: string;
  patchInvocationDraftAction: (input: PatchInvocationDraftIn) => Promise<PatchInvocationDraftOut>;
}

export default function Invocation({
  bundleData,
  testId,
  patchInvocationDraftAction,
}: InvocationProps) {
  const router = useRouter();
  const data = bundleData;

  const initialFormState = useMemo(() => getInitialFormState(data), [data]);
  const [formState, setFormState] = useState<InvocationFormState>(initialFormState);
  const formStateRef = useRef(formState);
  const lastPatchedRef = useRef<InvocationFormState>(initialFormState);
  const serverSyncPendingRef = useRef(false);
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const savingRef = useRef(false);

  useEffect(() => {
    formStateRef.current = formState;
  }, [formState]);

  const [urlParams, setUrlParams] = useQueryStates(
    { draftId: parseAsString },
    { history: "replace", shallow: true },
  );
  const [draftId, setDraftId] = useState<string | null>(urlParams.draftId || null);
  const [isSaving, setIsSaving] = useState(false);
  // Per-type boolean view of flag_ids, built from the catalog. Rendered by Flags.
  const flagValues = useMemo<Record<string, boolean | null>>(() => {
    const map: Record<string, boolean | null> = {};
    const byId = new Map(
      (data.flags ?? [])
        .filter((f) => f.id)
        .map((f) => [f.id as string, f]),
    );
    for (const id of formState.flag_ids) {
      const row = byId.get(id);
      if (!row) continue;
      const t = row.type ?? row.name;
      if (t && row.value != null) map[t] = row.value;
    }
    return map;
  }, [formState.flag_ids, data.flags]);

  // Rows grouped by flag type — used when a toggle swaps between true/false ids.
  type InvocationFlagRow = NonNullable<typeof data.flags>[number];
  const flagRowsByType = useMemo(() => {
    const map = new Map<string, InvocationFlagRow[]>();
    for (const f of data.flags ?? []) {
      const t = f.type ?? f.name;
      if (!t) continue;
      const list = map.get(t) ?? [];
      list.push(f);
      map.set(t, list);
    }
    return map;
  }, [data.flags]);

  const handleFlagToggle = useCallback(
    (type: string, next: boolean | null) => {
      setFormState((prev) => {
        const rows = flagRowsByType.get(type) ?? [];
        const rowIdsForType = new Set(
          rows.map((r) => r.id).filter((id): id is string => !!id),
        );
        const retained = prev.flag_ids.filter((id) => !rowIdsForType.has(id));
        const target =
          next == null ? null : rows.find((r) => r.value === next)?.id ?? null;
        const nextIds = target ? [...retained, target] : retained;
        return {
          ...prev,
          flag_ids: nextIds,
          pending_ids: prev.pending_ids.filter(
            (id) => !rowIdsForType.has(id) || nextIds.includes(id),
          ),
        };
      });
    },
    [flagRowsByType],
  );

  useEffect(() => {
    if (draftId && draftId !== urlParams.draftId) {
      void setUrlParams({ draftId });
    }
  }, [draftId, setUrlParams, urlParams.draftId]);

  useEffect(() => {
    const next = getInitialFormState(data);
    setFormState((prev) => {
      if (JSON.stringify(prev) !== JSON.stringify(next)) {
        serverSyncPendingRef.current = true;
        lastPatchedRef.current = next;
        return next;
      }
      return prev;
    });
  }, [data]);

  const saveDraftNow = useCallback(async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    try {
      const current = formStateRef.current;
      const payload: Record<string, unknown> = {
        input_draft_id: draftId,
        draft_id: draftId,
        name_id: current.name_id,
        description_id: current.description_id,
        value_id: current.value_id,
        flag_ids: current.flag_ids,
        department_ids: current.department_ids,
        key_id: current.key_id,
        endpoint_id: current.endpoint_id,
        modality_ids: current.modality_ids,
        temperature_level_id: current.temperature_level_id,
        pricing_id: current.pricing_id,
        reasoning_level_id: current.reasoning_level_id,
        quality_ids: current.quality_ids,
        voice_ids: current.voice_ids,
        pending_ids: current.pending_ids,
      };
      if (current.name !== null) payload["name"] = current.name;
      if (current.description !== null) payload["description"] = current.description;

      const result = await patchInvocationDraftAction({
        body: payload,
      } as PatchInvocationDraftIn);

      if (result.draft_id) {
        setDraftId(result.draft_id);
      }

      const fs = result.form_state;
      if (fs) {
        setFormState((prev) => {
          const nextNameId = fs.name_id ?? prev.name_id;
          const nextDescriptionId = fs.description_id ?? prev.description_id;
          const next = {
            ...prev,
            name_id: nextNameId,
            // Clear value fields only once the server has resolved them to
            // IDs — keeping the value would cause infinite re-saves (value
            // takes precedence → new resource → new id → repeat).
            name: nextNameId ? null : prev.name,
            description_id: nextDescriptionId,
            description: nextDescriptionId ? null : prev.description,
            value_id: fs.value_id ?? prev.value_id,
            flag_ids: fs.flag_ids ?? prev.flag_ids,
            department_ids: fs.department_ids ?? prev.department_ids,
            key_id: fs.key_id ?? prev.key_id,
            endpoint_id: fs.endpoint_id ?? prev.endpoint_id,
            modality_ids: fs.modality_ids ?? prev.modality_ids,
            temperature_level_id: fs.temperature_level_id ?? prev.temperature_level_id,
            pricing_id: fs.pricing_id ?? prev.pricing_id,
            reasoning_level_id: fs.reasoning_level_id ?? prev.reasoning_level_id,
            quality_ids: fs.quality_ids ?? prev.quality_ids,
            voice_ids: fs.voice_ids ?? prev.voice_ids,
            pending_ids: fs.pending_ids ?? prev.pending_ids,
          };
          // Only set the server-sync absorb flag when state actually changes.
          const changed =
            prev.name_id !== next.name_id ||
            prev.name !== next.name ||
            prev.description_id !== next.description_id ||
            prev.description !== next.description ||
            prev.value_id !== next.value_id ||
            prev.key_id !== next.key_id ||
            prev.endpoint_id !== next.endpoint_id ||
            prev.temperature_level_id !== next.temperature_level_id ||
            prev.pricing_id !== next.pricing_id ||
            prev.reasoning_level_id !== next.reasoning_level_id ||
            JSON.stringify(prev.flag_ids) !== JSON.stringify(next.flag_ids) ||
            JSON.stringify(prev.department_ids) !== JSON.stringify(next.department_ids) ||
            JSON.stringify(prev.modality_ids) !== JSON.stringify(next.modality_ids) ||
            JSON.stringify(prev.quality_ids) !== JSON.stringify(next.quality_ids) ||
            JSON.stringify(prev.voice_ids) !== JSON.stringify(next.voice_ids) ||
            JSON.stringify(prev.pending_ids) !== JSON.stringify(next.pending_ids);
          if (!changed) return prev;
          serverSyncPendingRef.current = true;
          return next;
        });
      }

      lastPatchedRef.current = { ...formStateRef.current };
    } catch {
      toast.error("Failed to save invocation draft.");
    } finally {
      savingRef.current = false;
    }
  }, [draftId, patchInvocationDraftAction]);

  useEffect(() => {
    if (serverSyncPendingRef.current) {
      serverSyncPendingRef.current = false;
      return;
    }
    if (JSON.stringify(formState) === JSON.stringify(lastPatchedRef.current)) {
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
    } finally {
      setIsSaving(false);
    }
  }, [draftId, router, saveDraftNow, testId]);

  // --- Stable value-change handlers (extracted from inline arrows) ---
  const handleNameIdChange = useCallback((id: string | null) => {
    setFormState((prev) => ({
      ...prev,
      name_id: id,
      name: null,
      pending_ids: prev.pending_ids.filter(
        (pendingId) => pendingId !== (prev.name_id ?? ""),
      ),
    }));
  }, []);

  const handleNameChange = useCallback((name: string) => {
    setFormState((prev) => ({
      ...prev,
      name: name || null,
      name_id: null,
    }));
  }, []);

  const handleDescriptionIdChange = useCallback((id: string | null) => {
    setFormState((prev) => ({
      ...prev,
      description_id: id,
      description: null,
      pending_ids: prev.pending_ids.filter(
        (pendingId) => pendingId !== (prev.description_id ?? ""),
      ),
    }));
  }, []);

  const handleDescriptionChange = useCallback((description: string) => {
    setFormState((prev) => ({
      ...prev,
      description: description || null,
      description_id: null,
    }));
  }, []);

  if (data.profile_has_access === false) {
    return (
      <p className="text-sm text-muted-foreground">
        You do not have access to this invocation.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <StepCard
        stepStatus="active"
        stepNumber={1}
        stepTitle="Customize Invocation"
        stepDescription="Configure the draft-backed resources for this test invocation."
        customHeader={
          <Names
            name_id={formState.name_id}
            name_resource={data.names?.find((item) => item.selected) ?? null}
            show_name={(data.names?.length ?? 0) > 0}
            names={data.names ?? []}
            disabled={false}
            onNameIdChange={handleNameIdChange}
            onNameChange={handleNameChange}
            placeholder="e.g., Smoke Test Run"
            defaultName="New Invocation"
            hideDescription={true}
          />
        }
      >
      <div className="space-y-4">
      <Descriptions
        description_id={formState.description_id}
        description_resource={data.descriptions?.find((item) => item.selected) ?? null}
        show_description={(data.descriptions?.length ?? 0) > 0}
        descriptions={data.descriptions ?? []}
        disabled={false}
        onDescriptionIdChange={handleDescriptionIdChange}
        onDescriptionChange={handleDescriptionChange}
      />

      <Values
        value_ids={formState.value_id ? [formState.value_id] : []}
        value_resources={formState.value_id ? data.values?.filter((item) => item.id === formState.value_id) ?? [] : []}
        show_values={(data.values?.length ?? 0) > 0}
        values={data.values ?? []}
        disabled={false}
        onChange={(ids) =>
          setFormState((prev) => ({
            ...prev,
            value_id: ids[0] ?? null,
            pending_ids: prev.pending_ids.filter((id) => id !== (prev.value_id ?? "")),
          }))
        }
        label="Value"
      />

      <Flags
        flags={data.flags ?? []}
        values={flagValues}
        onChange={handleFlagToggle}
        show_flags={(data.flags?.length ?? 0) > 0}
        label="Flags"
      />

      <Departments
        department_ids={formState.department_ids}
        department_resources={(data.departments ?? []).filter((item) => item.selected)}
        show_departments={(data.departments?.length ?? 0) > 0}
        departments={data.departments ?? []}
        disabled={false}
        onChange={(ids) =>
          setFormState((prev) => {
            const removed = prev.department_ids.filter((id) => !ids.includes(id));
            return {
              ...prev,
              department_ids: ids,
              pending_ids: prev.pending_ids.filter((id) => !removed.includes(id)),
            };
          })
        }
      />

      <Keys
        key_id={formState.key_id}
        key_resource={data.keys?.find((item) => item.selected) ?? null}
        show_key={(data.keys?.length ?? 0) > 0}
        keys={data.keys ?? []}
        disabled={false}
        onKeyIdChange={(id) =>
          setFormState((prev) => ({
            ...prev,
            key_id: id,
            pending_ids: prev.pending_ids.filter((pendingId) => pendingId !== (prev.key_id ?? "")),
          }))
        }
      />

      <Endpoints
        endpoint_ids={formState.endpoint_id ? [formState.endpoint_id] : []}
        endpoint_resources={formState.endpoint_id ? data.endpoints?.filter((item) => item.id === formState.endpoint_id) ?? [] : []}
        show_endpoints={(data.endpoints?.length ?? 0) > 0}
        endpoints={data.endpoints ?? []}
        disabled={false}
        onChange={(ids) =>
          setFormState((prev) => ({
            ...prev,
            endpoint_id: ids[0] ?? null,
            pending_ids: prev.pending_ids.filter((id) => id !== (prev.endpoint_id ?? "")),
          }))
        }
        label="Endpoint"
      />

      <Modalities
        modality_ids={formState.modality_ids}
        modality_resources={(data.modalities ?? []).filter((item) => item.selected)}
        show_modalities={(data.modalities?.length ?? 0) > 0}
        modalities={data.modalities ?? []}
        disabled={false}
        onChange={(ids) =>
          setFormState((prev) => {
            const removed = prev.modality_ids.filter((id) => !ids.includes(id));
            return {
              ...prev,
              modality_ids: ids,
              pending_ids: prev.pending_ids.filter((id) => !removed.includes(id)),
            };
          })
        }
        label="Modalities"
      />

      <TemperatureLevels
        temperature_level_id={formState.temperature_level_id}
        temperature_level_resource={data.temperature_levels?.find((item) => item.selected) ?? null}
        show_temperature_levels={(data.temperature_levels?.length ?? 0) > 0}
        temperature_levels={data.temperature_levels ?? []}
        disabled={false}
        onTemperatureLevelIdChange={(id) =>
          setFormState((prev) => ({
            ...prev,
            temperature_level_id: id,
            pending_ids: prev.pending_ids.filter((pendingId) => pendingId !== (prev.temperature_level_id ?? "")),
          }))
        }
      />

      <Pricing
        pricing_ids={formState.pricing_id ? [formState.pricing_id] : []}
        pricing_resources={formState.pricing_id ? data.pricing?.filter((item) => (item.pricing_id ?? item.id) === formState.pricing_id) ?? [] : []}
        show_pricing={(data.pricing?.length ?? 0) > 0}
        pricings={data.pricing ?? []}
        disabled={false}
        onChange={(ids) =>
          setFormState((prev) => ({
            ...prev,
            pricing_id: ids[0] ?? null,
            pending_ids: prev.pending_ids.filter((id) => id !== (prev.pricing_id ?? "")),
          }))
        }
        label="Pricing"
      />

      <ReasoningLevels
        reasoning_level_id={formState.reasoning_level_id}
        reasoning_level_resource={data.reasoning_levels?.find((item) => item.selected) ?? null}
        show_reasoning_levels={(data.reasoning_levels?.length ?? 0) > 0}
        reasoning_levels={data.reasoning_levels ?? []}
        disabled={false}
        onReasoningLevelIdChange={(id) =>
          setFormState((prev) => ({
            ...prev,
            reasoning_level_id: id,
            pending_ids: prev.pending_ids.filter((pendingId) => pendingId !== (prev.reasoning_level_id ?? "")),
          }))
        }
      />

      <Qualities
        quality_ids={formState.quality_ids}
        quality_resources={(data.qualities ?? []).filter((item) => item.selected)}
        show_qualities={(data.qualities?.length ?? 0) > 0}
        qualities={data.qualities ?? []}
        disabled={false}
        onChange={(ids) =>
          setFormState((prev) => {
            const removed = prev.quality_ids.filter((id) => !ids.includes(id));
            return {
              ...prev,
              quality_ids: ids,
              pending_ids: prev.pending_ids.filter((id) => !removed.includes(id)),
            };
          })
        }
      />

      <Voices
        voice_ids={formState.voice_ids}
        voice_resources={(data.voices ?? []).filter((item) => item.selected)}
        show_voices={(data.voices?.length ?? 0) > 0}
        voices={data.voices ?? []}
        disabled={false}
        onVoiceIdsChange={(ids) =>
          setFormState((prev) => {
            const removed = prev.voice_ids.filter((id) => !ids.includes(id));
            return {
              ...prev,
              voice_ids: ids,
              pending_ids: prev.pending_ids.filter((id) => !removed.includes(id)),
            };
          })
        }
      />
      </div>
      </StepCard>

      <Card>
        <CardHeader>
          <CardTitle>Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => router.back()}>
              Cancel
            </Button>
            <Button onClick={() => void saveAndReturn()} disabled={isSaving}>
              {isSaving ? "Saving..." : "Save & Return"}
            </Button>
          </div>
          <div className="text-xs text-muted-foreground">
            Invocation drafts are saved against the test-owned invocation surface. Some inherited test resources may still remain base-backed until their draft connections are added.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
