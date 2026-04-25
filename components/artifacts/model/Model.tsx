/**
 * Model.tsx
 * Implementation using modular resource components
 * Used to create and manage models - supports both creation and editing
 * Canonical composed GET + draft flow
 * @AshokSaravanan222 & @siladiea
 * 01/08/2026
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
import { StepCardAiButton } from "@/components/common/forms/StepCardAiButton";
import { Departments } from "@/components/resources/Departments";
import { StepCard } from "@/components/common/forms/StepCard";
import { Providers } from "@/components/resources/Providers";
import { ReadOnlyBanner } from "@/components/common/forms/ReadOnlyBanner";
import { Descriptions } from "@/components/resources/Descriptions";
import { Flags } from "@/components/resources/Flags";
import { Modalities } from "@/components/resources/Modalities";
import { Names } from "@/components/resources/Names";
import { Pricing } from "@/components/resources/Pricing";
import { Qualities } from "@/components/resources/Qualities";
import { ReasoningLevels } from "@/components/resources/ReasoningLevels";
import { TemperatureLevels } from "@/components/resources/TemperatureLevels";
import { Values } from "@/components/resources/Values";
import { Voices } from "@/components/resources/Voices";
import { useProfile } from "@/contexts/profile-context";
import { useDrafts } from "@/contexts/draft-context";
import { useDraftLifecycle } from "@/hooks/use-draft-lifecycle";
import type { InputOf, OutputOf } from "@/lib/api/types";
import {
  checkHasResourceIds,
  type ResourceConfig,
} from "@/lib/resources/action-builders";
import type { ResourceType } from "@/lib/resources/types";
import { getDefaultDepartmentIds } from "@/utils/department-picker-helpers";
import { parseAsString, type Parser } from "nuqs";

import { useModelAi } from "@/hooks/use-model-ai";

// Canonical: server returns one ModelFlagResource row per flags_resource entry
// (typically two per logical flag: value=true and value=false). The client
// carries selection as a flat `flag_ids: string[]`.

// Map of flag type → per-feature ids array to clear when the flag turns off.
// Keys match the raw `flags_resource.type` values returned by the server
// (no stripping). This mirrors the canonical Setting.tsx pattern: read the
// type as-is from the catalog, look up everything by the same key.
const MODEL_FLAG_TYPE_TO_IDS_FIELD: Record<string, string | undefined> = {
  model_modalities_enabled: "modality_ids",
  model_temperature_enabled: "temperature_level_ids",
  model_pricing_enabled: "pricing_ids",
  model_voices_enabled: "voice_ids",
  model_reasoning_levels_enabled: "reasoning_level_ids",
  model_qualities_enabled: "quality_ids",
};

// Types defined inline using InputOf/OutputOf
type CreateModelIn = InputOf<"/model/create", "post">;
type CreateModelOut = OutputOf<"/model/create", "post">;
type UpdateModelIn = InputOf<"/model/update", "post">;
type UpdateModelOut = OutputOf<"/model/update", "post">;
type PatchModelDraftIn = InputOf<"/model/draft", "patch">;
type PatchModelDraftOut = OutputOf<"/model/draft", "patch">;

type ModelData = OutputOf<"/model/get", "post">;

const toSingleSection = <T extends { id?: string | null; selected?: boolean | null; suggested?: boolean | null }>(
  items: T[] | null | undefined,
  opts: { show?: boolean; required?: boolean; showAiGenerate?: boolean } = {},
) => {
  const list = items ?? [];
  return {
    resource: list.find((item) => item.selected) ?? null,
    resources: list,
    suggestions: list.filter((item) => item.suggested).map((item) => item.id).filter(Boolean),
    show: opts.show ?? true,
    required: opts.required ?? false,
    show_ai_generate: opts.showAiGenerate ?? false,
  };
};

const toMultiSection = <T extends { id?: string | null; selected?: boolean | null; suggested?: boolean | null }>(
  items: T[] | null | undefined,
  opts: { show?: boolean; required?: boolean; showAiGenerate?: boolean } = {},
) => {
  const list = items ?? [];
  return {
    current: list.filter((item) => item.selected),
    resources: list,
    suggestions: list.filter((item) => item.suggested).map((item) => item.id).filter(Boolean),
    show: opts.show ?? true,
    required: opts.required ?? false,
    show_ai_generate: opts.showAiGenerate ?? false,
  };
};

const MODEL_RESOURCES: ResourceConfig[] = [
  { key: "names", formKey: "name_id", flushKey: null, type: "single" },
  {
    key: "descriptions",
    formKey: "description_id",
    flushKey: null,
    type: "single",
  },
  { key: "values", formKey: "value_id", flushKey: null, type: "single" },
  { key: "providers", formKey: "provider_id", flushKey: null, type: "single" },
  { key: "flags", formKey: "flag_ids", flushKey: null, type: "multi" },
  {
    key: "departments",
    formKey: "department_ids",
    flushKey: null,
    type: "multi",
  },
  { key: "modalities", formKey: "modality_ids", flushKey: null, type: "multi" },
  {
    key: "temperature_levels",
    formKey: "temperature_level_ids",
    flushKey: null,
    type: "multi",
  },
  { key: "pricing", formKey: "pricing_ids", flushKey: null, type: "multi" },
  {
    key: "reasoning_levels",
    formKey: "reasoning_level_ids",
    flushKey: null,
    type: "multi",
  },
  { key: "qualities", formKey: "quality_ids", flushKey: null, type: "multi" },
  { key: "voices", formKey: "voice_ids", flushKey: null, type: "multi" },
];

export interface ModelProps {
  modelId?: string;
  modelDetailDefault?: ModelData;
  modelDetail?: ModelData;
  createModelAction?: (input: CreateModelIn) => Promise<CreateModelOut>;
  updateModelAction?: (input: UpdateModelIn) => Promise<UpdateModelOut>;
  patchModelDraftAction?: (
    input: PatchModelDraftIn,
  ) => Promise<PatchModelDraftOut>;
}

function ModelComponent({
  modelId,
  modelDetailDefault,
  modelDetail: serverModelDetail,
  createModelAction,
  updateModelAction,
  patchModelDraftAction,
}: ModelProps) {
  const router = useRouter();
  const isEditMode = !!modelId;
  const { profile } = useProfile();
  const { isAutosaveEnabled, setSelectedDraftId } = useDrafts();
  const emptyFlushRegistryRef = useRef<
    Map<string, () => Promise<Record<string, unknown> | void>>
  >(new Map());

  // nuqs parsers for URL-backed state (will be passed to GenericForm)
  const modelSearchParamsClient = useMemo(
    () => ({
      draftId: parseAsString,
      descriptionSearch: parseAsString,
      valueSearch: parseAsString,
      departmentSearch: parseAsString,
      modalitySearch: parseAsString,
      temperatureSearch: parseAsString,
      pricingSearch: parseAsString,
      reasoningSearch: parseAsString,
      voiceSearch: parseAsString,
      qualitySearch: parseAsString,
    }),
    [],
  );

  const modelData = (
    isEditMode ? serverModelDetail : modelDetailDefault
  ) as ModelData | undefined;
  const s = useMemo(() => {
    if (!modelData) return null;
    return {
      ...modelData,
      names: toSingleSection(modelData.names, {
        show: true,
        required: true,
        showAiGenerate: !!modelData.basic_show_ai_generate,
      }),
      descriptions: toSingleSection(modelData.descriptions, {
        show: true,
        required: false,
        showAiGenerate: !!modelData.basic_show_ai_generate,
      }),
      values: toSingleSection(modelData.values, {
        show: true,
        required: true,
        showAiGenerate: !!modelData.basic_show_ai_generate,
      }),
      providers: toSingleSection(modelData.providers, {
        show: true,
        required: true,
        showAiGenerate: !!modelData.provider_show_ai_generate,
      }),
      flags: {
        // The server's flag catalog doesn't carry a `selected` field
        // (a flag is "on" when its flag_option_id is assigned to the
        // artifact in form state, not when a catalog entry says so),
        // so `current` stays empty. Callers that used to read it have
        // been migrated to `resources`.
        current: [] as typeof modelData.flags,
        resources: modelData.flags ?? [],
        show: true,
        required: false,
        show_ai_generate: !!modelData.basic_show_ai_generate,
      },
      departments: {
        current: (modelData.departments ?? []).filter((item) => item.selected),
        resources: modelData.departments ?? [],
        show: true,
        required: false,
        show_ai_generate: false,
      },
      modalities: toMultiSection(modelData.modalities, {
        show: true,
        required: false,
        showAiGenerate: !!modelData.features_show_ai_generate,
      }),
      temperature_levels: toMultiSection(modelData.temperature_levels, {
        show: true,
        required: false,
        showAiGenerate: !!modelData.features_show_ai_generate,
      }),
      pricing: toMultiSection(modelData.pricing, {
        show: true,
        required: false,
        showAiGenerate: !!modelData.features_show_ai_generate,
      }),
      reasoning_levels: toMultiSection(modelData.reasoning_levels, {
        show: true,
        required: false,
        showAiGenerate: !!modelData.features_show_ai_generate,
      }),
      qualities: toMultiSection(modelData.qualities, {
        show: true,
        required: false,
        showAiGenerate: !!modelData.features_show_ai_generate,
      }),
      voices: toMultiSection(modelData.voices, {
        show: true,
        required: false,
        showAiGenerate: !!modelData.features_show_ai_generate,
      }),
    };
  }, [modelData]);

  const modelDataRef = React.useRef(modelData);
  React.useEffect(() => {
    modelDataRef.current = modelData;
  }, [modelData]);

  const isSuperadmin = true;
  const primaryDepartmentId =
    (
      profile as { primary_department_id?: string | null } | null | undefined
    )?.primary_department_id ?? null;
  const defaultDepartmentIds = useMemo(
    () =>
      getDefaultDepartmentIds(
        isSuperadmin,
        primaryDepartmentId,
      ),
    [isSuperadmin, primaryDepartmentId],
  );

  const getInitialFormState = useCallback(() => {
    const data = modelDataRef.current;
    if (!data) {
      return {
        name: null as string | null,
        name_id: null as string | null,
        description: null as string | null,
        description_id: null as string | null,
        value: null as string | null,
        value_id: null as string | null,
        provider_id: null as string | null,
        flag_ids: [] as string[],
        modality_ids: [] as string[],
        temperature_level_ids: [] as string[],
        reasoning_level_ids: [] as string[],
        quality_ids: [] as string[],
        pricing_ids: [] as string[],
        // Inline-create value-objects. Server resolves id=null entries
        // and merges resulting ids into pricing_ids; we replace this
        // array with the echoed list on save.
        pricing: null as
          | Array<{
              id: string | null;
              pricing_type: string;
              price: number;
              unit_name: string;
              unit_category: string;
              unit_value: number;
            }>
          | null,
        voice_ids: [] as string[],
        department_ids: defaultDepartmentIds,
        pending_ids: [] as string[],
      };
    }

    return {
      name: null as string | null,
      value: null as string | null,
      description: null as string | null,
      name_id: data.names?.find((item) => item.selected)?.id ?? null,
      description_id:
        data.descriptions?.find((item) => item.selected)?.id ?? null,
      value_id: data.values?.find((item) => item.selected)?.id ?? null,
      provider_id: data.providers?.find((item) => item.selected)?.id ?? null,
      flag_ids: (data.flags ?? [])
        .filter((f: any) => f.selected)
        .map((f: any) => f.id)
        .filter((id: any): id is string => !!id),
      modality_ids: (data.modalities ?? [])
        .filter((item) => item.selected)
        .map((m) => m.id as string)
        .filter(Boolean),
      temperature_level_ids: (data.temperature_levels ?? [])
        .filter((item) => item.selected)
        .map((t) => t.id as string)
        .filter(Boolean),
      reasoning_level_ids: (data.reasoning_levels ?? [])
        .filter((item) => item.selected)
        .map((r) => r.id as string)
        .filter(Boolean),
      quality_ids: (data.qualities ?? [])
        .filter((item) => item.selected)
        .map((q) => q.id as string)
        .filter(Boolean),
      pricing_ids: (data.pricing ?? [])
        .filter((item) => item.selected)
        .map((p) => p.id as string)
        .filter(Boolean),
      // Inline-create list — empty on hydrate; populated only when user
      // adds new pricing entries locally. Server echoes resolved ids back
      // on save and we replace the whole array.
      pricing: null as
        | Array<{
            id: string | null;
            pricing_type: string;
            price: number;
            unit_name: string;
            unit_category: string;
            unit_value: number;
          }>
        | null,
      voice_ids: (data.voices ?? [])
        .filter((item) => item.selected)
        .map((v) => v.id as string)
        .filter(Boolean),
      department_ids: (() => {
        const ids = (data.departments ?? [])
          .filter((item) => item.selected)
          .map((d) => d.department_id as string)
          .filter(Boolean);
        return ids.length > 0 ? ids : defaultDepartmentIds;
      })(),
      pending_ids: data.pending_ids ?? [],
    };
  }, [defaultDepartmentIds]);

  const [formState, setFormState] = useState(getInitialFormState);

  // Pending tracking by section — mirrors Setting.tsx so handleFlagToggle
  // (and any other section change) can prune stale pending_ids on each save.
  const pendingFlagIds = useMemo(
    () =>
      new Set(
        (modelData?.flags ?? [])
          .filter((f: any) => f.pending && f.id)
          .map((f: any) => f.id as string),
      ),
    [modelData?.flags],
  );
  const pruneFlagsPending = useCallback(
    (nextIds: string[]) => {
      return formState.pending_ids.filter(
        (id) => !pendingFlagIds.has(id) || nextIds.includes(id),
      );
    },
    [pendingFlagIds, formState.pending_ids],
  );

  // Per-type boolean view of flag_ids, built from the catalog. Keyed by raw
  // `flags_resource.type` (e.g. `model_active`, `model_modalities_enabled`).
  // Used by getStepStatus and the canonical <Flags> picker.
  const flagValues = useMemo<Record<string, boolean | null>>(() => {
    const map: Record<string, boolean | null> = {};
    const byId = new Map(
      (modelData?.flags ?? [])
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
  }, [formState.flag_ids, modelData?.flags]);

  type FlagRow = NonNullable<NonNullable<typeof modelData>["flags"]>[number];
  const flagRowsByType = useMemo(() => {
    const map = new Map<string, FlagRow[]>();
    for (const f of modelData?.flags ?? []) {
      const t = (f as any).type ?? (f as any).name;
      if (!t) continue;
      const list = map.get(t) ?? [];
      list.push(f as FlagRow);
      map.set(t, list);
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelData?.flags]);

  const handleFlagToggle = useCallback(
    (type: string, next: boolean | null) => {
      // The Flags catalog rows carry the raw type (`model_active`,
      // `model_modalities_enabled`, …) and emit it verbatim. Look up rows,
      // ids field, and pending state by that same raw key — no stripping.
      setFormState((prev) => {
        const rows = (flagRowsByType.get(type) ?? []) as Array<{
          id?: string | null;
          value?: boolean | null;
        }>;
        const rowIdsForType = new Set(
          rows.map((r) => r.id).filter((id): id is string => !!id),
        );
        const retained = prev.flag_ids.filter(
          (id: string) => !rowIdsForType.has(id),
        );
        const target =
          next == null
            ? null
            : (rows.find((r) => r.value === next)?.id ?? null);
        const nextIds = target ? [...retained, target] : retained;
        // When a feature flag turns off, also clear its associated multi-select.
        const idsField = MODEL_FLAG_TYPE_TO_IDS_FIELD[type];
        const cleared: Record<string, string[]> =
          next === false && idsField ? { [idsField]: [] } : {};
        return {
          ...prev,
          flag_ids: nextIds,
          pending_ids: pruneFlagsPending(nextIds),
          ...cleared,
        };
      });
    },
    [flagRowsByType, pruneFlagsPending],
  );

  // AI generation via shared hook
  const { isGenerating, generate } = useModelAi({});

  const formStateRef = React.useRef(formState);
  React.useEffect(() => {
    formStateRef.current = formState;
  }, [formState]);

  // Memoize stringified array dependencies
  const departmentIdsStr = React.useMemo(
    () =>
      JSON.stringify(
        (s?.departments?.current ?? [])
          .map((d) => d.department_id)
          .filter(Boolean),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [s?.departments?.current],
  );
  const modalityIdsStr = React.useMemo(
    () =>
      JSON.stringify(
        (s?.modalities?.current ?? []).map((m) => m.id).filter(Boolean),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [s?.modalities?.current],
  );
  const temperatureLevelIdsStr = React.useMemo(
    () =>
      JSON.stringify(
        (s?.temperature_levels?.current ?? [])
          .map((t) => t.id)
          .filter(Boolean),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [s?.temperature_levels?.current],
  );
  const reasoningLevelIdsStr = React.useMemo(
    () =>
      JSON.stringify(
        (s?.reasoning_levels?.current ?? []).map((r) => r.id).filter(Boolean),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [s?.reasoning_levels?.current],
  );
  const qualityIdsStr = React.useMemo(
    () =>
      JSON.stringify(
        (s?.qualities?.current ?? []).map((q) => q.id).filter(Boolean),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [s?.qualities?.current],
  );
  const pricingIdsStr = React.useMemo(
    () =>
      JSON.stringify(
        (s?.pricing?.current ?? []).map((p) => p.id).filter(Boolean),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [s?.pricing?.current],
  );
  const voiceIdsStr = React.useMemo(
    () =>
      JSON.stringify(
        (s?.voices?.current ?? []).map((v) => v.id).filter(Boolean),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [s?.voices?.current],
  );

  // Update form state when server data changes
  useEffect(() => {
    const newState = getInitialFormState();
    setFormState((prev) => {
      if (
        prev.name_id !== newState.name_id ||
        prev.description_id !== newState.description_id ||
        prev.value_id !== newState.value_id ||
        prev.provider_id !== newState.provider_id ||
        JSON.stringify(prev.flag_ids) !== JSON.stringify(newState.flag_ids) ||
        JSON.stringify(prev.department_ids) !==
          JSON.stringify(newState.department_ids) ||
        JSON.stringify(prev.modality_ids) !==
          JSON.stringify(newState.modality_ids) ||
        JSON.stringify(prev.temperature_level_ids) !==
          JSON.stringify(newState.temperature_level_ids) ||
        JSON.stringify(prev.reasoning_level_ids) !==
          JSON.stringify(newState.reasoning_level_ids) ||
        JSON.stringify(prev.quality_ids) !==
          JSON.stringify(newState.quality_ids) ||
        JSON.stringify(prev.pricing_ids) !==
          JSON.stringify(newState.pricing_ids) ||
        JSON.stringify(prev.voice_ids) !== JSON.stringify(newState.voice_ids) ||
        JSON.stringify(prev.pending_ids) !== JSON.stringify(newState.pending_ids)
      ) {
        return newState;
      }
      return prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    s?.names?.resource,
    s?.descriptions?.resource,
    s?.values?.resource,
    s?.providers?.resource,
    s?.flags?.current,
    departmentIdsStr,
    modalityIdsStr,
    temperatureLevelIdsStr,
    reasoningLevelIdsStr,
    qualityIdsStr,
    pricingIdsStr,
    voiceIdsStr,
  ]);

  const formStateKey = React.useMemo(() => JSON.stringify(formState), [formState]);

  const patchActionRef = React.useRef<
    ((payload: Record<string, unknown>) => Promise<{ draft_id?: string | null }>) | undefined
  >(undefined);
  React.useEffect(() => {
    if (patchModelDraftAction) {
      patchActionRef.current = async (payload: Record<string, unknown>) => {
        const res = await patchModelDraftAction({
          body: payload,
        } as PatchModelDraftIn);
        // Sync form state from server-authoritative form_state
        const fs = (res as { form_state?: Partial<typeof formState> | null })
          .form_state;
        if (fs) {
          setFormState((prev) => {
            const next = {
              ...prev,
              name_id: fs.name_id ?? prev.name_id,
              // Clear value fields only once the server has resolved them to
              // IDs — keeping the value would cause infinite re-saves (value
              // takes precedence → new resource → new id → repeat).
              name: fs.name_id ? null : prev.name,
              description_id: fs.description_id ?? prev.description_id,
              description: fs.description_id ? null : prev.description,
              value_id: fs.value_id ?? prev.value_id,
              value: fs.value_id ? null : prev.value,
              provider_id: fs.provider_id ?? prev.provider_id,
              flag_ids:
                ((fs as Record<string, unknown>)["flag_ids"] as string[] | null) ??
                prev.flag_ids,
              department_ids: fs.department_ids ?? prev.department_ids,
              modality_ids: fs.modality_ids ?? prev.modality_ids,
              temperature_level_ids:
                fs.temperature_level_ids ?? prev.temperature_level_ids,
              pricing_ids: fs.pricing_ids ?? prev.pricing_ids,
              // Inline-created pricing entries: server fills in ids for
              // id=null entries we sent. Replace the whole array so
              // subsequent saves don't re-create the same rows.
              pricing:
                ((fs as Record<string, unknown>)["pricing"] as
                  | typeof prev.pricing
                  | undefined) ?? prev.pricing,
              reasoning_level_ids:
                fs.reasoning_level_ids ?? prev.reasoning_level_ids,
              quality_ids: fs.quality_ids ?? prev.quality_ids,
              voice_ids: fs.voice_ids ?? prev.voice_ids,
              pending_ids: fs.pending_ids ?? prev.pending_ids,
            };
            // Only set the server-sync absorb flag when state actually changes
            // (same fix as Persona / Agent / Parameter).
            const changed =
              prev.name_id !== next.name_id ||
              prev.name !== next.name ||
              prev.description_id !== next.description_id ||
              prev.description !== next.description ||
              prev.value_id !== next.value_id ||
              prev.value !== next.value ||
              prev.provider_id !== next.provider_id ||
              JSON.stringify(prev.flag_ids) !== JSON.stringify(next.flag_ids) ||
              JSON.stringify(prev.department_ids) !== JSON.stringify(next.department_ids) ||
              JSON.stringify(prev.modality_ids) !== JSON.stringify(next.modality_ids) ||
              JSON.stringify(prev.temperature_level_ids) !== JSON.stringify(next.temperature_level_ids) ||
              JSON.stringify(prev.pricing_ids) !== JSON.stringify(next.pricing_ids) ||
              JSON.stringify(prev.reasoning_level_ids) !== JSON.stringify(next.reasoning_level_ids) ||
              JSON.stringify(prev.quality_ids) !== JSON.stringify(next.quality_ids) ||
              JSON.stringify(prev.voice_ids) !== JSON.stringify(next.voice_ids) ||
              JSON.stringify(prev.pending_ids) !== JSON.stringify(next.pending_ids);
            if (!changed) return prev;
            serverSyncPendingRef.current = true;
            return next;
          });
        }
        return res;
      };
    } else {
      patchActionRef.current = undefined;
    }
  }, [patchModelDraftAction]);

  const hasResourceIds =
    checkHasResourceIds(
      MODEL_RESOURCES,
      formState as unknown as Record<string, unknown>,
    ) ||
    !!formState.name ||
    !!formState.description ||
    !!formState.value ||
    !!formState.value_id ||
    formState.flag_ids.length > 0 ||
    formState.pending_ids.length > 0;

  const buildPatchPayload = useCallback((): Record<string, unknown> => {
    const current = formStateRef.current as typeof formState;
    const payload: Record<string, unknown> = {};

    if (current.name != null) payload["name"] = current.name;
    else if (current.name_id) payload["name_id"] = current.name_id;

    if (current.description != null) payload["description"] = current.description;
    else if (current.description_id) payload["description_id"] = current.description_id;

    if (current.value != null) payload["value"] = current.value;
    else if (current.value_id) payload["value_id"] = current.value_id;

    if (current.provider_id) payload["provider_id"] = current.provider_id;

    if (current.flag_ids.length > 0) payload["flag_ids"] = current.flag_ids;
    if (current.department_ids.length > 0) payload["department_ids"] = current.department_ids;
    if (current.modality_ids.length > 0) payload["modality_ids"] = current.modality_ids;
    if (current.temperature_level_ids.length > 0) payload["temperature_level_ids"] = current.temperature_level_ids;
    if (current.pricing_ids.length > 0) payload["pricing_ids"] = current.pricing_ids;
    // Inline-created pricing value-objects: send the array whenever the user
    // has authored any new entries. Server creates rows for id=null entries
    // and merges resolved IDs into pricing_ids on the response.
    if (current.pricing && current.pricing.length > 0) {
      payload["pricing"] = current.pricing;
    }
    if (current.reasoning_level_ids.length > 0) payload["reasoning_level_ids"] = current.reasoning_level_ids;
    if (current.quality_ids.length > 0) payload["quality_ids"] = current.quality_ids;
    if (current.voice_ids.length > 0) payload["voice_ids"] = current.voice_ids;

    if (current.pending_ids.length > 0) payload["pending_ids"] = current.pending_ids;
    return payload;
  }, []);

  // --- Stable value-change handlers (extracted from inline arrows) ---
  const handleNameIdChange = useCallback((id: string | null) => {
    setFormState((prev) => ({ ...prev, name_id: id, name: null }));
  }, []);

  const handleNameChange = useCallback((name: string) => {
    setFormState((prev) => ({ ...prev, name, name_id: null }));
  }, []);

  const handleDescriptionIdChange = useCallback((id: string | null) => {
    setFormState((prev) => ({ ...prev, description_id: id, description: null }));
  }, []);

  const handleDescriptionChange = useCallback((description: string) => {
    setFormState((prev) => ({ ...prev, description, description_id: null }));
  }, []);

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
      flushRegistryRef: emptyFlushRegistryRef,
      formStateRef: formStateRef as React.MutableRefObject<Record<string, unknown>>,
    });

  // Generation handler - uses resource_types directly (no domain_ids)
  const handleGenerateResources = useCallback(
    async (resourceTypes: ResourceType[], userInstructions?: string) => {
      let currentDraftId =
        (formDataRef.current["draftId"] as string | undefined) ?? null;
      if (!currentDraftId) {
        currentDraftId = await flushAllAndSave();
      }
      if (!currentDraftId) {
        toast.error("Please save a draft before generating with AI");
        return;
      }

      generate(resourceTypes, {
        draft_id: currentDraftId,
        artifact_id: modelId || null,
        user_instructions: userInstructions ? [userInstructions] : null,
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [modelId, generate, flushAllAndSave],
  );

  const handleGenerateName = useCallback(
    async () => handleGenerateResources(["names"]),
    [handleGenerateResources],
  );

  const handleGenerateDescription = useCallback(
    async () => handleGenerateResources(["descriptions"]),
    [handleGenerateResources],
  );
  // AI-generate callbacks for the sub-resource pickers were wired as
  // onGenerate props; those props no longer exist on the resource
  // components (AI generation is driven by StepCardAiButton in each
  // step's header). The dedicated handlers are kept in
  // handleGenerateResources; the per-resource wrappers were dead code.

  const disabled = useMemo(() => {
    if (!s) return false;
    return !s.can_edit;
  }, [s]);

  // Get departments and providers from section-first structure
  const departments = useMemo(() => {
    return s?.departments?.resources || [];
  }, [s?.departments?.resources]);

  const validDepartmentIds = useMemo(() => {
    return (s?.departments?.resources ?? [])
      .map((d) => d.department_id as string)
      .filter(Boolean);
  }, [s?.departments?.resources]);

  const providers = useMemo(() => {
    return s?.providers?.resources || [];
  }, [s?.providers?.resources]);

  // Step-to-resources mapping
  const stepResources: Record<string, ResourceType[]> = useMemo(
    () => ({
      basic: ["names", "descriptions", "flags"],
      provider: [],
      modalities: ["modalities"],
      temperature: ["temperature_levels"],
      pricing: ["pricing"],
      reasoning: ["reasoning_levels"],
      voices: ["voices"],
      qualities: ["qualities"],
      all: [
        "names",
        "descriptions",
        "flags",
        "modalities",
        "temperature_levels",
        "pricing",
        "reasoning_levels",
        "voices",
        "qualities",
      ],
    }),
    [],
  );

  const canRegenerate = useCallback(
    (resourceType: ResourceType): boolean => {
      if (!s) return false;
      switch (resourceType) {
        case "names":
          return s.names?.resource?.generated ?? false;
        case "descriptions":
          return s.descriptions?.resource?.generated ?? false;
        case "flags":
          return s.flags?.resources?.some((f) => f.generated) ?? false;
        case "modalities":
          return s.modalities?.current?.some((m) => m.generated) ?? false;
        case "temperature_levels":
          return s.temperature_levels?.current?.some((t) => t.generated) ?? false;
        case "pricing":
          return s.pricing?.current?.some((p) => p.generated) ?? false;
        case "reasoning_levels":
          return s.reasoning_levels?.current?.some((r) => r.generated) ?? false;
        case "voices":
          return s.voices?.current?.some((v) => v.generated) ?? false;
        case "qualities":
          return s.qualities?.current?.some((q) => q.generated) ?? false;
        default:
          return false;
      }
    },
    [s],
  );
  const canRegenerateForStepCard = useCallback(
    (resourceType: string) => canRegenerate(resourceType as ResourceType),
    [canRegenerate],
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

  // Submit handler - saves the canonical selected IDs
  const handleSubmit = useCallback(
    async (_formData: Record<string, unknown>) => {
      const effectiveFormState = formStateRef.current as typeof formState;

      if (s?.names?.required && !effectiveFormState.name_id) {
        toast.error("Model name is required");
        throw new Error("Model name is required");
      }

      if (s?.values?.required && !effectiveFormState.value_id) {
        toast.error("Model value is required");
        throw new Error("Model value is required");
      }

      if (!effectiveFormState.provider_id) {
        toast.error("Provider is required");
        throw new Error("Provider is required");
      }

      if (!profile?.id) {
        toast.error("Profile not loaded. Please refresh the page.");
        throw new Error("Profile not loaded");
      }

      try {
        const efs = effectiveFormState;
        const flagIds = efs.flag_ids ?? [];

        if (isEditMode && modelId && updateModelAction) {
          await updateModelAction({
            body: {
              models: [{
                id: modelId,
                name_id: efs.name_id!,
                description_id: efs.description_id ?? null,
                provider_id: efs.provider_id ?? null,
                value_id: efs.value_id ?? null,
                flag_ids: flagIds.length ? flagIds : null,
                department_ids: efs.department_ids?.length ? efs.department_ids : null,
                modality_ids: efs.modality_ids?.length ? efs.modality_ids : null,
                temperature_level_ids: efs.temperature_level_ids?.length ? efs.temperature_level_ids : null,
                pricing_ids: efs.pricing_ids?.length ? efs.pricing_ids : null,
                reasoning_level_ids: efs.reasoning_level_ids?.length ? efs.reasoning_level_ids : null,
                quality_ids: efs.quality_ids?.length ? efs.quality_ids : null,
                voice_ids: efs.voice_ids?.length ? efs.voice_ids : null,
              }],
            },
          } as unknown as UpdateModelIn);
        } else if (createModelAction) {
          await createModelAction({
            body: {
              models: [{
                name_id: efs.name_id!,
                description_id: efs.description_id ?? null,
                provider_id: efs.provider_id ?? null,
                value_id: efs.value_id ?? null,
                flag_ids: flagIds.length ? flagIds : null,
                department_ids: efs.department_ids?.length ? efs.department_ids : null,
                modality_ids: efs.modality_ids?.length ? efs.modality_ids : null,
                temperature_level_ids: efs.temperature_level_ids?.length ? efs.temperature_level_ids : null,
                pricing_ids: efs.pricing_ids?.length ? efs.pricing_ids : null,
                reasoning_level_ids: efs.reasoning_level_ids?.length ? efs.reasoning_level_ids : null,
                quality_ids: efs.quality_ids?.length ? efs.quality_ids : null,
                voice_ids: efs.voice_ids?.length ? efs.voice_ids : null,
              }],
            },
          } as unknown as CreateModelIn);
        } else {
          toast.error("Save action not available");
          throw new Error("Save action not available");
        }
        toast.success(
          `Model ${isEditMode ? "updated" : "created"} successfully!`,
        );
        router.push(`/intelligence/models`);
      } catch (error) {
        toast.error(
          `Failed to ${isEditMode ? "update" : "create"} model: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
        throw error;
      }
    },
    [
      isEditMode,
      modelId,
      profile?.id,
      createModelAction,
      updateModelAction,
      router,
      s?.names?.required,
      s?.values?.required,
    ],
  );

  // Step status logic
  const getStepStatus = useCallback(
    (stepId: string, _formData: Record<string, unknown>): StepStatus => {
      const hasName = !!formState.name_id;
      const hasValue = !!formState.value_id;
      const hasDescription = !!formState.description_id;
      const hasProvider = !!formState.provider_id;
      const hasModalities = formState.modality_ids.length > 0;
      const modalities_enabled_flag_id = !!flagValues["model_modalities_enabled"];
      const temperature_enabled_flag_id = !!flagValues["model_temperature_enabled"];
      const pricing_enabled_flag_id = !!flagValues["model_pricing_enabled"];
      const voices_enabled_flag_id = !!flagValues["model_voices_enabled"];
      const reasoning_levels_enabled_flag_id = !!flagValues["model_reasoning_levels_enabled"];
      const qualities_enabled_flag_id = !!flagValues["model_qualities_enabled"];

      switch (stepId) {
        case "basic":
          return hasName && hasValue && hasDescription ? "completed" : "active";
        case "provider":
          if (!hasName || !hasValue || !hasDescription) return "pending";
          return hasProvider ? "completed" : "active";
        case "modalities":
          if (!hasName || !hasValue || !hasDescription || !hasProvider)
            return "pending";
          if (!modalities_enabled_flag_id) return "pending";
          return hasModalities ? "completed" : "active";
        case "temperature":
          if (!hasName || !hasValue || !hasDescription || !hasProvider)
            return "pending";
          if (!modalities_enabled_flag_id || !hasModalities) return "pending";
          return temperature_enabled_flag_id &&
            formState.temperature_level_ids.length > 0
            ? "completed"
            : temperature_enabled_flag_id
              ? "active"
              : "pending";
        case "pricing":
          if (!hasName || !hasValue || !hasDescription || !hasProvider)
            return "pending";
          if (!modalities_enabled_flag_id || !hasModalities) return "pending";
          return pricing_enabled_flag_id && formState.pricing_ids.length > 0
            ? "completed"
            : pricing_enabled_flag_id
              ? "active"
              : "pending";
        case "reasoning":
          if (!hasName || !hasValue || !hasDescription || !hasProvider)
            return "pending";
          if (!modalities_enabled_flag_id || !hasModalities) return "pending";
          return reasoning_levels_enabled_flag_id &&
            formState.reasoning_level_ids.length > 0
            ? "completed"
            : reasoning_levels_enabled_flag_id
              ? "active"
              : "pending";
        case "voices":
          if (!hasName || !hasValue || !hasDescription || !hasProvider)
            return "pending";
          if (!modalities_enabled_flag_id || !hasModalities) return "pending";
          return voices_enabled_flag_id && formState.voice_ids.length > 0
            ? "completed"
            : voices_enabled_flag_id
              ? "active"
              : "pending";
        case "qualities":
          if (!hasName || !hasValue || !hasDescription || !hasProvider)
            return "pending";
          if (!modalities_enabled_flag_id || !hasModalities) return "pending";
          return qualities_enabled_flag_id && formState.quality_ids.length > 0
            ? "completed"
            : qualities_enabled_flag_id
              ? "active"
              : "pending";
        default:
          return "pending";
      }
    },
    [formState, flagValues],
  );

  // Steps configuration
  const steps = useMemo(
    () => [
      {
        id: "basic",
        title: "Basic Information",
        description:
          "Set the model name, description, value, departments, and switches.",
        resetFields: [
          "name_id",
          "description_id",
          "descriptionSearch",
          "value_id",
          "valueSearch",
          "flag_ids",
          "departmentSearch",
          "department_ids",
        ],
      },
      {
        id: "provider",
        title: "Provider",
        description: "Select the provider for this model.",
        resetFields: ["provider_id"],
      },
      {
        id: "modalities",
        title: "Modalities",
        description: "Configure modalities for this model.",
        resetFields: ["modality_ids", "modalitySearch"],
      },
      {
        id: "temperature",
        title: "Temperature",
        description: "Configure temperature levels (optional).",
        resetFields: ["temperature_level_ids", "temperatureSearch"],
        optional: true,
      },
      {
        id: "pricing",
        title: "Pricing",
        description: "Configure pricing for this model (optional).",
        resetFields: ["pricing_ids", "pricingSearch"],
        optional: true,
      },
      {
        id: "reasoning",
        title: "Reasoning Levels",
        description: "Select reasoning levels (optional).",
        resetFields: ["reasoning_level_ids", "reasoningSearch"],
        optional: true,
      },
      {
        id: "voices",
        title: "Voices",
        description: "Select voices (optional).",
        resetFields: ["voice_ids", "voiceSearch"],
        optional: true,
      },
      {
        id: "qualities",
        title: "Qualities",
        description: "Select qualities (optional).",
        resetFields: ["quality_ids", "qualitySearch"],
        optional: true,
      },
    ],
    [],
  );

  // Form field keys
  const formFieldKeys = useMemo(
    () => [
      "name_id",
      "description_id",
      "flag_ids",
      "value_id",
      "provider_id",
      "department_ids",
      "modality_ids",
      "temperature_level_ids",
      "pricing_ids",
      "reasoning_level_ids",
      "voice_ids",
      "quality_ids",
      "descriptionSearch",
      "valueSearch",
      "departmentSearch",
      "modalitySearch",
      "temperatureSearch",
      "pricingSearch",
      "reasoningSearch",
      "voiceSearch",
      "qualitySearch",
    ],
    [],
  );

  const resetSuccessMessage = useCallback((stepId: string) => {
    switch (stepId) {
      case "basic":
        return "Basic information reset";
      case "provider":
        return "Provider reset";
      case "modalities":
        return "Modalities reset";
      case "temperature":
        return "Temperature reset";
      case "pricing":
        return "Pricing reset";
      case "reasoning":
        return "Reasoning levels reset";
      case "voices":
        return "Voices reset";
      case "qualities":
        return "Qualities reset";
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
            description_id: null,
            value_id: null,
            flag_ids: [],
            department_ids: [],
          };
        case "provider":
          return { ...prev, provider_id: null };
        case "modalities":
          return { ...prev, modality_ids: [] };
        case "temperature":
          return { ...prev, temperature_level_ids: [] };
        case "pricing":
          return { ...prev, pricing_ids: [], pricing: null };
        case "reasoning":
          return { ...prev, reasoning_level_ids: [] };
        case "voices":
          return { ...prev, voice_ids: [] };
        case "qualities":
          return { ...prev, quality_ids: [] };
        default:
          return prev;
      }
    });
  }, []);

  const submitButton = useMemo(
    () => ({
      backUrl: "/intelligence/models",
      backLabel: "Back",
      createLabel: "Create Model",
      updateLabel: "Update Model",
    }),
    [],
  );

  // Render step - section-first data access
  const renderStep = useCallback(
    ({
      stepId,
      stepStatus,
      stepTitle,
      stepDescription,
      stepNumber,
      formData,
      setFormData,
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
      onReset?: () => void;
    }) => {
      const descriptionSearch =
        (formData["descriptionSearch"] as string | undefined) ?? "";
      const valueSearch = (formData["valueSearch"] as string | undefined) ?? "";
      const modalitySearch =
        (formData["modalitySearch"] as string | undefined) ?? "";
      const temperatureSearch =
        (formData["temperatureSearch"] as string | undefined) ?? "";
      const pricingSearch =
        (formData["pricingSearch"] as string | undefined) ?? "";
      const reasoningSearch =
        (formData["reasoningSearch"] as string | undefined) ?? "";
      const voiceSearch = (formData["voiceSearch"] as string | undefined) ?? "";
      const qualitySearch =
        (formData["qualitySearch"] as string | undefined) ?? "";

      // Section-first flag access
      const allFlags = s?.flags?.resources ?? [];

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
                  names={s?.names?.resources ?? []}
                  disabled={disabled}
                  onNameIdChange={handleNameIdChange}
                  onNameChange={handleNameChange}
                  placeholder="e.g., GPT-4"
                  defaultName="New Model"
                  required={s?.names?.required ?? true}
                  hideDescription={true}
                />
              }
              resetFields={[
                "name_id",
                "description_id",
                "value_id",
                "flag_ids",
                "department_ids",
              ]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
              actions={
                stepResources["basic"] &&
                stepResources["basic"].length > 0 &&
                s?.basic_show_ai_generate ? (
                  <StepCardAiButton
                    stepId="basic"
                    resourceTypes={stepResources["basic"]}
                    canRegenerate={canRegenerateForStepCard}
                    isGenerating={isGenerating}
                    onOpenModal={handleDirectStepGenerate}
                    disabled={disabled}
                  />
                ) : undefined
              }
            >
              <div className="space-y-4">
                <Descriptions
                  description_id={formState.description_id ?? null}
                  description_resource={s?.descriptions?.resource ?? null}
                  show_description={s?.descriptions?.show ?? true}
                  descriptions={s?.descriptions?.resources ?? []}
                  searchTerm={descriptionSearch}
                  onSearchChange={(term: string) =>
                    setFormData({ descriptionSearch: term || null })
                  }
                  disabled={disabled}
                  onDescriptionIdChange={handleDescriptionIdChange}
                  onDescriptionChange={handleDescriptionChange}
                  placeholder="Enter a brief description"
                  required={s?.descriptions?.required ?? false}
                />

                <Values
                  value_ids={formState.value_id ? [formState.value_id] : []}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  value_resources={((formState.value_id && s?.values?.resource
                      ? [
                          {
                            id: s.values.resource.id,
                            value: s.values.resource.value,
                            generated: s.values.resource.generated,
                          },
                        ]
                      : []) as any)}
                  show_values={s?.values?.show ?? true}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  values={((s?.values?.resources ?? []).map((v) => ({
                    id: v.id,
                    value: v.value,
                    generated: v.generated,
                    suggested: v.suggested,
                    pending: v.pending,
                    selected: v.selected,
                  })) as any)}
                  searchTerm={valueSearch}
                  onSearchChange={(term: string) =>
                    setFormData({ valueSearch: term || null })
                  }
                  disabled={disabled}
                  onChange={(ids) =>
                    setFormState({
                      ...formState,
                      value_id: ids.length > 0 ? (ids[0] ?? null) : null,
                      value: null,
                    })
                  }
                  value={formState.value}
                  onValueChange={(nextValue) =>
                    setFormState((prev) => ({
                      ...prev,
                      value: nextValue,
                      value_id: nextValue ? null : prev.value_id,
                    }))
                  }
                  label="Value"
                  placeholder="Select model value identifier (e.g., gpt-4, gemini-pro)"
                  required={s?.values?.required ?? true}
                  description="Unique identifier for this model (used in API calls)"
                />

                {/* Departments: canonical multi-select grid, always shown so
                    Model parity matches Scenario/Eval/etc. */}
                <Departments
                  department_ids={formState.department_ids}
                  department_resources={departments.filter(
                    (d) => d.selected,
                  )}
                  show_departments={true}
                  departments={departments}
                  disabled={disabled}
                  onChange={(ids) =>
                    setFormState((prev) => ({
                      ...prev,
                      department_ids: ids,
                    }))
                  }
                />

                {/* Unified multi-flag picker. The seven model flag groups
                    (active + six *_enabled toggles) collapse to one render
                    driven by MODEL_FLAG_KEY_TO_FIELD. The per-key onChange
                    still clears the associated ids array when a toggle
                    turns off (e.g. modalities_enabled → modality_ids). */}
                <Flags
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  flags={allFlags as any}
                  values={flagValues}
                  show_flags={allFlags.length > 0}
                  columns={1}
                  label="Flags"
                  disabled={disabled}
                  onChange={handleFlagToggle}
                />
              </div>
            </StepCard>
          );

        case "provider":
          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={disabled}
              isEditMode={isEditMode}
              resetFields={["provider_id"]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
            >
              <Providers
                provider_id={formState.provider_id}
                providers={providers}
                provider_resource={
                  providers.find((p) => p.id === formState.provider_id) ?? null
                }
                show_providers={providers.length > 0}
                disabled={disabled}
                onChange={(providerId) =>
                  setFormState((prev) => ({
                    ...prev,
                    provider_id: providerId,
                  }))
                }
                required={s?.providers?.required ?? true}
              />
            </StepCard>
          );

        case "modalities":
          if (!flagValues["model_modalities_enabled"]) return null;
          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={disabled}
              isEditMode={isEditMode}
              searchTerm={modalitySearch}
              onSearchChange={(term) =>
                setFormData({ modalitySearch: term || null })
              }
              searchPlaceholder="Search modalities..."
              resetFields={["modality_ids"]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
              actions={
                stepResources["modalities"] &&
                stepResources["modalities"].length > 0 &&
                s?.modalities?.show_ai_generate ? (
                  <StepCardAiButton
                    stepId="modalities"
                    resourceTypes={stepResources["modalities"]}
                    canRegenerate={canRegenerateForStepCard}
                    isGenerating={isGenerating}
                    onOpenModal={handleDirectStepGenerate}
                    disabled={disabled}
                  />
                ) : undefined
              }
            >
              {(() => {
                // Group modalities by `is_input` and render one bucket per
                // role (Input / Output). Storage stays flat as
                // `modality_ids: string[]`; each picker emits its bucket's
                // ids while the parent retains rows from the other bucket.
                type ModalityRow = NonNullable<
                  NonNullable<typeof s>["modalities"]
                >["resources"][number];
                const allRows: ModalityRow[] = s?.modalities?.resources ?? [];
                const buckets: Array<{
                  key: string;
                  label: string;
                  rows: ModalityRow[];
                }> = [
                  {
                    key: "input",
                    label: "Input Modalities",
                    rows: allRows.filter((m) => m.is_input === true),
                  },
                  {
                    key: "output",
                    label: "Output Modalities",
                    rows: allRows.filter((m) => m.is_input === false),
                  },
                ];

                return (
                  <div className="space-y-6">
                    {buckets.map((bucket) => {
                      const bucketIds = new Set(
                        bucket.rows
                          .map((r) => r.id)
                          .filter((id): id is string => !!id),
                      );
                      const currentIds = formState.modality_ids.filter((id) =>
                        bucketIds.has(id),
                      );
                      return (
                        <Modalities
                          key={bucket.key}
                          modality_ids={currentIds}
                          show_modalities={s?.modalities?.show ?? true}
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          modalities={(bucket.rows.map((m) => ({
                            modality_id: m.id,
                            name: m.modality,
                            generated: m.generated,
                            suggested: m.suggested,
                            pending: m.pending,
                          })) as any)}
                          disabled={disabled}
                          onChange={(nextBucketIds) =>
                            setFormState((prev) => {
                              const retained = prev.modality_ids.filter(
                                (id) => !bucketIds.has(id),
                              );
                              return {
                                ...prev,
                                modality_ids: [...retained, ...nextBucketIds],
                              };
                            })
                          }
                          label={bucket.label}
                          required={
                            bucket.key === "input"
                              ? (s?.modalities?.required ?? true)
                              : false
                          }
                        />
                      );
                    })}
                  </div>
                );
              })()}
            </StepCard>
          );

        case "temperature":
          if (!flagValues["model_temperature_enabled"]) return null;
          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={disabled}
              isEditMode={isEditMode}
              searchTerm={temperatureSearch}
              onSearchChange={(term) =>
                setFormData({ temperatureSearch: term || null })
              }
              searchPlaceholder="Search temperature levels..."
              resetFields={["temperature_level_ids"]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
              actions={
                stepResources["temperature"] &&
                stepResources["temperature"].length > 0 &&
                s?.temperature_levels?.show_ai_generate ? (
                  <StepCardAiButton
                    stepId="temperature"
                    resourceTypes={stepResources["temperature"]}
                    canRegenerate={canRegenerateForStepCard}
                    isGenerating={isGenerating}
                    onOpenModal={handleDirectStepGenerate}
                    disabled={disabled}
                  />
                ) : undefined
              }
            >
              <TemperatureLevels
                temperature_level_ids={formState.temperature_level_ids}
                show_temperature_levels={s?.temperature_levels?.show ?? true}
                temperature_levels={(s?.temperature_levels?.resources ?? []).map(
                  (t) => ({
                    id: t.id,
                    temperature: t.temperature,
                    generated: t.generated,
                    suggested: t.suggested,
                    pending: t.pending,
                  }),
                )}
                disabled={disabled}
                onChange={(nextIds) =>
                  setFormState({
                    ...formState,
                    temperature_level_ids: nextIds,
                  })
                }
                label="Temperature Range"
                required={s?.temperature_levels?.required ?? false}
              />
            </StepCard>
          );

        case "pricing":
          if (!flagValues["model_pricing_enabled"]) return null;
          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={disabled}
              isEditMode={isEditMode}
              searchTerm={pricingSearch}
              onSearchChange={(term) =>
                setFormData({ pricingSearch: term || null })
              }
              searchPlaceholder="Search pricing..."
              resetFields={["pricing_ids"]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
              actions={
                stepResources["pricing"] &&
                stepResources["pricing"].length > 0 &&
                s?.pricing?.show_ai_generate ? (
                  <StepCardAiButton
                    stepId="pricing"
                    resourceTypes={stepResources["pricing"]}
                    canRegenerate={canRegenerateForStepCard}
                    isGenerating={isGenerating}
                    onOpenModal={handleDirectStepGenerate}
                    disabled={disabled}
                  />
                ) : undefined
              }
            >
              <Pricing
                pricing_ids={formState.pricing_ids}
                show_pricing={s?.pricing?.show ?? true}
                pricings={(s?.pricing?.resources ?? []).map((p) => ({
                  pricing_id: p.id ?? null,
                  pricing_type: p.pricing_type ?? null,
                  name: `${p.pricing_type ?? ""}${
                    p.price != null && p.unit_name
                      ? ` — $${p.price}/${p.unit_name}`
                      : ""
                  }`,
                  description: p.unit_category ?? null,
                  price: p.price ?? null,
                  unit_name: p.unit_name ?? null,
                  unit_category: p.unit_category ?? null,
                  unit_value:
                    typeof p.unit_value === "number"
                      ? p.unit_value
                      : p.unit_value != null
                        ? Number(p.unit_value)
                        : null,
                  generated: p.generated ?? null,
                  suggested: p.suggested ?? null,
                  pending: p.pending ?? null,
                }))}
                searchTerm={pricingSearch}
                onSearchChange={(term: string) =>
                  setFormData({ pricingSearch: term || null })
                }
                disabled={disabled}
                onChange={(ids) =>
                  setFormState({ ...formState, pricing_ids: ids })
                }
                onCreate={(draft) =>
                  setFormState((prev) => ({
                    ...prev,
                    pricing: [
                      ...(prev.pricing ?? []),
                      { id: null, ...draft },
                    ],
                  }))
                }
                label="Pricing"
                placeholder="Select pricing configurations"
                required={s?.pricing?.required ?? false}
              />
            </StepCard>
          );

        case "reasoning":
          if (!flagValues["model_reasoning_levels_enabled"]) return null;
          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={disabled}
              isEditMode={isEditMode}
              searchTerm={reasoningSearch}
              onSearchChange={(term) =>
                setFormData({ reasoningSearch: term || null })
              }
              searchPlaceholder="Search reasoning levels..."
              resetFields={["reasoning_level_ids"]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
              actions={
                stepResources["reasoning"] &&
                stepResources["reasoning"].length > 0 &&
                s?.reasoning_levels?.show_ai_generate ? (
                  <StepCardAiButton
                    stepId="reasoning"
                    resourceTypes={stepResources["reasoning"]}
                    canRegenerate={canRegenerateForStepCard}
                    isGenerating={isGenerating}
                    onOpenModal={handleDirectStepGenerate}
                    disabled={disabled}
                  />
                ) : undefined
              }
            >
              <ReasoningLevels
                reasoning_level_id={
                  formState.reasoning_level_ids.length > 0
                    ? (formState.reasoning_level_ids[0] ?? null)
                    : null
                }
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                reasoning_level_resource={((formState.reasoning_level_ids.length > 0 &&
                  s?.reasoning_levels?.current?.[0]
                    ? {
                        id: s.reasoning_levels.current[0].id,
                        reasoning_level:
                          s.reasoning_levels.current[0].reasoning_level,
                        generated: s.reasoning_levels.current[0].generated,
                      }
                    : null) as any)}
                show_reasoning_levels={s?.reasoning_levels?.show ?? true}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                reasoning_levels={((s?.reasoning_levels?.resources ?? []).map(
                  (r) => ({
                    id: r.id,
                    reasoning_level: r.reasoning_level,
                    generated: r.generated,
                    suggested: r.suggested,
                    pending: r.pending,
                  }),
                ) as any)}
                disabled={disabled}
                onReasoningLevelIdChange={(id) =>
                  setFormState({
                    ...formState,
                    reasoning_level_ids: id ? [id] : [],
                  })
                }
                label="Reasoning Level"
                required={s?.reasoning_levels?.required ?? false}
              />
            </StepCard>
          );

        case "voices":
          if (!flagValues["model_voices_enabled"]) return null;
          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={disabled}
              isEditMode={isEditMode}
              searchTerm={voiceSearch}
              onSearchChange={(term) =>
                setFormData({ voiceSearch: term || null })
              }
              searchPlaceholder="Search voices..."
              resetFields={["voice_ids"]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
              actions={
                stepResources["voices"] &&
                stepResources["voices"].length > 0 &&
                s?.voices?.show_ai_generate ? (
                  <StepCardAiButton
                    stepId="voices"
                    resourceTypes={stepResources["voices"]}
                    canRegenerate={canRegenerateForStepCard}
                    isGenerating={isGenerating}
                    onOpenModal={handleDirectStepGenerate}
                    disabled={disabled}
                  />
                ) : undefined
              }
            >
              <Voices
                voice_ids={formState.voice_ids}
                voice_resources={s?.voices?.current ?? []}
                show_voices={s?.voices?.show ?? true}
                voices={s?.voices?.resources ?? []}
                disabled={disabled}
                onVoiceIdsChange={(ids) =>
                  setFormState({ ...formState, voice_ids: ids })
                }
                label="Voices"
                required={s?.voices?.required ?? false}
              />
            </StepCard>
          );

        case "qualities":
          if (!flagValues["model_qualities_enabled"]) return null;
          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={disabled}
              isEditMode={isEditMode}
              searchTerm={qualitySearch}
              onSearchChange={(term) =>
                setFormData({ qualitySearch: term || null })
              }
              searchPlaceholder="Search qualities..."
              resetFields={["quality_ids"]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
              actions={
                stepResources["qualities"] &&
                stepResources["qualities"].length > 0 &&
                s?.qualities?.show_ai_generate ? (
                  <StepCardAiButton
                    stepId="qualities"
                    resourceTypes={stepResources["qualities"]}
                    canRegenerate={canRegenerateForStepCard}
                    isGenerating={isGenerating}
                    onOpenModal={handleDirectStepGenerate}
                    disabled={disabled}
                  />
                ) : undefined
              }
            >
              <Qualities
                quality_ids={formState.quality_ids}
                quality_resources={((s?.qualities?.current ?? []).map((q) => ({
                  quality_id: q.id,
                  name: q.quality,
                  generated: q.generated,
                })) as any)}
                show_qualities={s?.qualities?.show ?? true}
                qualities={((s?.qualities?.resources ?? []).map((q) => ({
                  quality_id: q.id,
                  name: q.quality,
                  generated: q.generated,
                })) as any)}
                disabled={disabled}
                onChange={(ids) =>
                  setFormState({ ...formState, quality_ids: ids })
                }
                label="Qualities"
                required={s?.qualities?.required ?? false}
              />
            </StepCard>
          );

        default:
          return null;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      disabled,
      isEditMode,
      formState,
      validDepartmentIds,
      departments,
      providers,
      s,
      handleGenerateName,
      handleGenerateDescription,
      isGenerating,
    ],
  );

  return (
    <div className="w-full p-6 space-y-8">
      <ReadOnlyBanner
        disabled={disabled}
        disabledReason={s?.disabled_reason ?? null}
        entityType="model"
      />
      <GenericForm
        nuqsParsers={modelSearchParamsClient as Record<string, Parser<unknown>>}
        steps={steps}
        getStepStatus={getStepStatus}
        serverData={s}
        formFieldKeys={formFieldKeys}
        onReset={(stepId) => handleReset(stepId)}
        resetSuccessMessage={resetSuccessMessage}
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
    </div>
  );
}

export default React.memo(ModelComponent, (prevProps, nextProps) => {
  const prevModelData = prevProps.modelDetail ?? prevProps.modelDetailDefault;
  const nextModelData = nextProps.modelDetail ?? nextProps.modelDetailDefault;

  if (prevProps.modelId !== nextProps.modelId) return false;

  // Compare key sections
  if (
    JSON.stringify(prevModelData?.names) !==
    JSON.stringify(nextModelData?.names)
  ) {
    return false;
  }
  if (
    JSON.stringify(prevModelData?.descriptions) !==
    JSON.stringify(nextModelData?.descriptions)
  ) {
    return false;
  }
  if (
    JSON.stringify(prevModelData?.flags) !==
    JSON.stringify(nextModelData?.flags)
  ) {
    return false;
  }

  return true;
});
