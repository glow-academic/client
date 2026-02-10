/**
 * Model.tsx
 * Implementation using modular resource components
 * Used to create and manage models - supports both creation and editing
 * Section-first API pattern (gold standard)
 * @AshokSaravanan222 & @siladiea
 * 01/08/2026
 */
"use client";

import { useRouter } from "next/navigation";
import React, {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { toast } from "sonner";

import {
  GenericForm,
  type StepStatus,
} from "@/components/common/forms/GenericForm";
import { GenericPicker } from "@/components/common/forms/GenericPicker";
import { StepCard } from "@/components/common/forms/StepCard";
import { ProviderCardGrid } from "@/components/common/models/ProviderCardGrid";
import { ReadOnlyBanner } from "@/components/common/ReadOnlyBanner";
import { Descriptions } from "@/components/resources/Descriptions";
import { Flags } from "@/components/resources/FlagsLegacy";
import { Modalities } from "@/components/resources/Modalities";
import { Names } from "@/components/resources/Names";
import { Pricing } from "@/components/resources/Pricing";
import { Qualities } from "@/components/resources/Qualities";
import { ReasoningLevels } from "@/components/resources/ReasoningLevels";
import { TemperatureLevels } from "@/components/resources/TemperatureLevels";
import { Values } from "@/components/resources/Values";
import { Voices } from "@/components/resources/Voices";
import { Label } from "@/components/ui/label";
import { useBreadcrumbContext } from "@/contexts/breadcrumb-context";
import { useProfile } from "@/contexts/profile-context";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { ResourceType } from "@/lib/resources/types";
import { getDefaultDepartmentIds } from "@/utils/department-picker-helpers";
import { parseAsString, type Parser } from "nuqs";

import { useAiGeneration } from "@/hooks/use-ai-generation";

const MODEL_VALID_RESOURCE_TYPES: ResourceType[] = [
  "names",
  "descriptions",
  "flags",
  "temperature_levels",
  "reasoning_levels",
  "voices",
];

// Helper: find current flag option ID from flags section by key
const findCurrentFlagId = (
  flags:
    | Array<{ key?: string; flag_option_id?: string | null }>
    | null
    | undefined,
  key: string,
): string | null => flags?.find((f) => f.key === key)?.flag_option_id ?? null;

// Types defined inline using InputOf/OutputOf
type SaveModelIn = InputOf<"/api/v4/artifacts/models/save", "post">;
type SaveModelOut = OutputOf<"/api/v4/artifacts/models/save", "post">;
type PatchModelDraftIn = InputOf<"/api/v4/artifacts/models/draft", "patch">;
type PatchModelDraftOut = OutputOf<"/api/v4/artifacts/models/draft", "patch">;

type ModelData = OutputOf<"/api/v4/artifacts/models/get", "post">;

type CreateDraftNamesIn = InputOf<"/api/v4/resources/names", "post">;
type CreateDraftNamesOut = OutputOf<"/api/v4/resources/names", "post">;
type CreateDraftDescriptionsIn = InputOf<
  "/api/v4/resources/descriptions",
  "post"
>;
type CreateDraftDescriptionsOut = OutputOf<
  "/api/v4/resources/descriptions",
  "post"
>;
type CreateDraftValuesIn = InputOf<"/api/v4/resources/values", "post">;
type CreateDraftValuesOut = OutputOf<"/api/v4/resources/values", "post">;
type CreateDraftPricingIn = InputOf<"/api/v4/resources/pricing", "post">;
type CreateDraftPricingOut = OutputOf<"/api/v4/resources/pricing", "post">;
type CreateDraftVoicesIn = InputOf<"/api/v4/resources/voices", "post">;
type CreateDraftVoicesOut = OutputOf<"/api/v4/resources/voices", "post">;

export interface ModelProps {
  modelId?: string;
  modelDetailDefault?: ModelData;
  modelDetail?: ModelData;
  saveModelAction?: (input: SaveModelIn) => Promise<SaveModelOut>;
  patchModelDraftAction?: (
    input: PatchModelDraftIn,
  ) => Promise<PatchModelDraftOut>;
  createNamesAction?: (
    input: CreateDraftNamesIn,
  ) => Promise<CreateDraftNamesOut>;
  createDescriptionsAction?: (
    input: CreateDraftDescriptionsIn,
  ) => Promise<CreateDraftDescriptionsOut>;
  createValuesAction?: (
    input: CreateDraftValuesIn,
  ) => Promise<CreateDraftValuesOut>;
  createPricingAction?: (
    input: CreateDraftPricingIn,
  ) => Promise<CreateDraftPricingOut>;
  createVoicesAction?: (
    input: CreateDraftVoicesIn,
  ) => Promise<CreateDraftVoicesOut>;
}

function ModelComponent({
  modelId,
  modelDetailDefault,
  modelDetail: serverModelDetail,
  saveModelAction,
  patchModelDraftAction,
  createNamesAction,
  createDescriptionsAction,
  createValuesAction,
  createPricingAction,
  createVoicesAction,
}: ModelProps) {
  const router = useRouter();
  const isEditMode = !!modelId;
  const { profile, selectedDraftId, setSelectedDraftId, socket, isConnected } =
    useProfile();
  const { setEntityMetadata, clearEntityMetadata } = useBreadcrumbContext();

  // AI generation completion handler - uses formStateUpdater for complex array dedup
  const onAiComplete = useCallback((data: Record<string, unknown>) => {
    return {
      aiUpdates: {} as Record<string, unknown>,
      formStateUpdater: (prev: Record<string, unknown>) => {
        const updates: Record<string, unknown> = {};

        // Single-value fields
        if (data["name_id"]) updates["name_id"] = data["name_id"];
        if (data["description_id"])
          updates["description_id"] = data["description_id"];
        if (data["value_id"]) updates["value_id"] = data["value_id"];
        if (data["active_flag_id"])
          updates["active_flag_id"] = data["active_flag_id"];
        if (data["modalities_enabled_flag_id"])
          updates["modalities_enabled_flag_id"] =
            data["modalities_enabled_flag_id"];
        if (data["temperature_enabled_flag_id"])
          updates["temperature_enabled_flag_id"] =
            data["temperature_enabled_flag_id"];
        if (data["pricing_enabled_flag_id"])
          updates["pricing_enabled_flag_id"] = data["pricing_enabled_flag_id"];
        if (data["voices_enabled_flag_id"])
          updates["voices_enabled_flag_id"] = data["voices_enabled_flag_id"];
        if (data["reasoning_levels_enabled_flag_id"])
          updates["reasoning_levels_enabled_flag_id"] =
            data["reasoning_levels_enabled_flag_id"];
        if (data["qualities_enabled_flag_id"])
          updates["qualities_enabled_flag_id"] =
            data["qualities_enabled_flag_id"];

        // Array fields with dedup
        const arrayFields = [
          { key: "modality_ids" },
          { key: "temperature_level_ids" },
          { key: "reasoning_level_ids" },
          { key: "quality_ids" },
          { key: "pricing_ids" },
          { key: "voice_ids" },
        ];
        for (const { key } of arrayFields) {
          const newIds = data[key] as string[] | undefined;
          if (newIds && newIds.length > 0) {
            const prevIds = (prev[key] as string[]) ?? [];
            updates[key] = [
              ...prevIds,
              ...newIds.filter((id: string) => !prevIds.includes(id)),
            ];
          }
        }

        return { ...prev, ...updates };
      },
    };
  }, []);

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

  // Use server-provided data (section-first)
  const modelData = isEditMode ? serverModelDetail : modelDetailDefault;
  // Shorthand for section-first data access
  const s = modelData;

  const modelDataRef = React.useRef(modelData);
  React.useEffect(() => {
    modelDataRef.current = modelData;
  }, [modelData]);

  const isSuperadmin = profile?.role === "superadmin";
  const defaultDepartmentIds = useMemo(
    () =>
      getDefaultDepartmentIds(
        isSuperadmin,
        profile?.primary_department_id || null,
      ),
    [isSuperadmin, profile?.primary_department_id],
  );

  const getInitialFormState = useCallback(() => {
    const data = modelDataRef.current;
    if (!data) {
      return {
        name_id: null as string | null,
        description_id: null as string | null,
        value_id: null as string | null,
        provider_id: null as string | null,
        active_flag_id: null as string | null,
        modalities_enabled_flag_id: null as string | null,
        temperature_enabled_flag_id: null as string | null,
        pricing_enabled_flag_id: null as string | null,
        voices_enabled_flag_id: null as string | null,
        reasoning_levels_enabled_flag_id: null as string | null,
        qualities_enabled_flag_id: null as string | null,
        modality_ids: [] as string[],
        temperature_level_ids: [] as string[],
        reasoning_level_ids: [] as string[],
        quality_ids: [] as string[],
        pricing_ids: [] as string[],
        voice_ids: [] as string[],
        departmentIds: defaultDepartmentIds,
      };
    }

    // Section-first: extract resource IDs from section structure
    const curFlags = data.flags?.current ?? [];

    return {
      // Single-select IDs from section.resource.id
      name_id: (data.names?.resource?.id as string) ?? null,
      description_id: (data.descriptions?.resource?.id as string) ?? null,
      value_id: (data.values?.resource?.id as string) ?? null,
      provider_id: (data.providers?.resource?.id as string) ?? null,

      // Flag IDs from flags section by key
      active_flag_id: findCurrentFlagId(curFlags, "active"),
      modalities_enabled_flag_id: findCurrentFlagId(
        curFlags,
        "modalities_enabled",
      ),
      temperature_enabled_flag_id: findCurrentFlagId(
        curFlags,
        "temperature_enabled",
      ),
      pricing_enabled_flag_id: findCurrentFlagId(curFlags, "pricing_enabled"),
      voices_enabled_flag_id: findCurrentFlagId(curFlags, "voices_enabled"),
      reasoning_levels_enabled_flag_id: findCurrentFlagId(
        curFlags,
        "reasoning_levels_enabled",
      ),
      qualities_enabled_flag_id: findCurrentFlagId(
        curFlags,
        "qualities_enabled",
      ),

      // Multi-select IDs from section.current arrays (unified modalities)
      modality_ids: (data.modalities?.current ?? [])
        .map((m) => m.id as string)
        .filter(Boolean),
      temperature_level_ids: (data.temperature_levels?.current ?? [])
        .map((t) => t.id as string)
        .filter(Boolean),
      reasoning_level_ids: (data.reasoning_levels?.current ?? [])
        .map((r) => r.id as string)
        .filter(Boolean),
      quality_ids: (data.qualities?.current ?? [])
        .map((q) => q.id as string)
        .filter(Boolean),
      pricing_ids: (data.pricing?.current ?? [])
        .map((p) => p.id as string)
        .filter(Boolean),
      voice_ids: (data.voices?.current ?? [])
        .map((v) => v.id as string)
        .filter(Boolean),
      departmentIds: (() => {
        const ids = (data.departments?.current ?? [])
          .map((d) => d.department_id as string)
          .filter(Boolean);
        return ids.length > 0 ? ids : defaultDepartmentIds;
      })(),
    };
  }, [defaultDepartmentIds]);

  const [formState, setFormState] = useState(getInitialFormState);

  // AI generation via shared hook
  const {
    generatingResources: _generatingResources,
    setGeneratingResources,
    isGenerating,
  } = useAiGeneration<ResourceType, Record<string, unknown>>({
    socket,
    isConnected,
    artifactType: "model",
    groupId: s?.group_id,
    eventPrefix: "model_generation",
    validResourceTypes: MODEL_VALID_RESOURCE_TYPES,
    onComplete: onAiComplete,
    setFormState: setFormState as Dispatch<
      SetStateAction<Record<string, unknown>>
    >,
  });

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
    [s?.departments?.current],
  );
  const modalityIdsStr = React.useMemo(
    () =>
      JSON.stringify(
        (s?.modalities?.current ?? []).map((m) => m.id).filter(Boolean),
      ),
    [s?.modalities?.current],
  );
  const temperatureLevelIdsStr = React.useMemo(
    () =>
      JSON.stringify(
        (s?.temperature_levels?.current ?? [])
          .map((t) => t.id)
          .filter(Boolean),
      ),
    [s?.temperature_levels?.current],
  );
  const reasoningLevelIdsStr = React.useMemo(
    () =>
      JSON.stringify(
        (s?.reasoning_levels?.current ?? []).map((r) => r.id).filter(Boolean),
      ),
    [s?.reasoning_levels?.current],
  );
  const qualityIdsStr = React.useMemo(
    () =>
      JSON.stringify(
        (s?.qualities?.current ?? []).map((q) => q.id).filter(Boolean),
      ),
    [s?.qualities?.current],
  );
  const pricingIdsStr = React.useMemo(
    () =>
      JSON.stringify(
        (s?.pricing?.current ?? []).map((p) => p.id).filter(Boolean),
      ),
    [s?.pricing?.current],
  );
  const voiceIdsStr = React.useMemo(
    () =>
      JSON.stringify(
        (s?.voices?.current ?? []).map((v) => v.id).filter(Boolean),
      ),
    [s?.voices?.current],
  );

  // Memoize formState array strings for draft listener
  const formStateDepartmentIdsStr = React.useMemo(
    () => JSON.stringify(formState.departmentIds),
    [formState.departmentIds],
  );
  const formStateModalityIdsStr = React.useMemo(
    () => JSON.stringify(formState.modality_ids),
    [formState.modality_ids],
  );
  const formStateTemperatureLevelIdsStr = React.useMemo(
    () => JSON.stringify(formState.temperature_level_ids),
    [formState.temperature_level_ids],
  );
  const formStateReasoningLevelIdsStr = React.useMemo(
    () => JSON.stringify(formState.reasoning_level_ids),
    [formState.reasoning_level_ids],
  );
  const formStateQualityIdsStr = React.useMemo(
    () => JSON.stringify(formState.quality_ids),
    [formState.quality_ids],
  );
  const formStatePricingIdsStr = React.useMemo(
    () => JSON.stringify(formState.pricing_ids),
    [formState.pricing_ids],
  );
  const formStateVoiceIdsStr = React.useMemo(
    () => JSON.stringify(formState.voice_ids),
    [formState.voice_ids],
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
        prev.active_flag_id !== newState.active_flag_id ||
        prev.modalities_enabled_flag_id !==
          newState.modalities_enabled_flag_id ||
        prev.temperature_enabled_flag_id !==
          newState.temperature_enabled_flag_id ||
        prev.pricing_enabled_flag_id !== newState.pricing_enabled_flag_id ||
        prev.voices_enabled_flag_id !== newState.voices_enabled_flag_id ||
        prev.reasoning_levels_enabled_flag_id !==
          newState.reasoning_levels_enabled_flag_id ||
        prev.qualities_enabled_flag_id !== newState.qualities_enabled_flag_id ||
        JSON.stringify(prev.departmentIds) !==
          JSON.stringify(newState.departmentIds) ||
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
        JSON.stringify(prev.voice_ids) !== JSON.stringify(newState.voice_ids)
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

  // Draft version tracking
  const [lastSavedVersion, setLastSavedVersion] = useState(0);
  const lastSavedVersionRef = React.useRef(0);
  React.useEffect(() => {
    lastSavedVersionRef.current = lastSavedVersion;
  }, [lastSavedVersion]);
  const draftVersion = s?.draft_version;
  React.useEffect(() => {
    if (
      typeof draftVersion === "number" &&
      draftVersion !== lastSavedVersionRef.current
    ) {
      setLastSavedVersion(draftVersion);
      lastSavedVersionRef.current = draftVersion;
    }
  }, [draftVersion]);

  // Get draftId from GenericForm's URL state
  const [draftId, setDraftId] = useState<string | null>(null);
  const setUrlFormDataRef = React.useRef<
    null | ((updates: Record<string, unknown>) => void)
  >(null);

  const formDataRef = React.useRef<Record<string, unknown>>({});

  const onFormDataChange = React.useCallback((fd: Record<string, unknown>) => {
    formDataRef.current = fd;
    const next = (fd["draftId"] as string | undefined) ?? null;
    setDraftId((prev) => (prev === next ? prev : next));
  }, []);

  // Sync URL draftId to profile context
  useEffect(() => {
    if (draftId !== selectedDraftId) {
      setSelectedDraftId(draftId);
    }
  }, [draftId, selectedDraftId, setSelectedDraftId]);

  const patchModelDraftActionRef = React.useRef(patchModelDraftAction);
  React.useEffect(() => {
    patchModelDraftActionRef.current = patchModelDraftAction;
  }, [patchModelDraftAction]);

  // Build stable key for draft patch dedup
  const draftPatchKey = React.useMemo(() => {
    return JSON.stringify({
      draftId: draftId || null,
      name_id: formState.name_id,
      description_id: formState.description_id,
      value_id: formState.value_id,
      provider_id: formState.provider_id,
      active_flag_id: formState.active_flag_id,
      modalities_enabled_flag_id: formState.modalities_enabled_flag_id,
      temperature_enabled_flag_id: formState.temperature_enabled_flag_id,
      pricing_enabled_flag_id: formState.pricing_enabled_flag_id,
      voices_enabled_flag_id: formState.voices_enabled_flag_id,
      reasoning_levels_enabled_flag_id:
        formState.reasoning_levels_enabled_flag_id,
      qualities_enabled_flag_id: formState.qualities_enabled_flag_id,
      departmentIds: formState.departmentIds,
      modality_ids: formState.modality_ids,
      temperature_level_ids: formState.temperature_level_ids,
      reasoning_level_ids: formState.reasoning_level_ids,
      quality_ids: formState.quality_ids,
      pricing_ids: formState.pricing_ids,
      voice_ids: formState.voice_ids,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    draftId,
    formState.name_id,
    formState.description_id,
    formState.value_id,
    formState.provider_id,
    formState.active_flag_id,
    formState.modalities_enabled_flag_id,
    formState.temperature_enabled_flag_id,
    formState.pricing_enabled_flag_id,
    formState.voices_enabled_flag_id,
    formState.reasoning_levels_enabled_flag_id,
    formState.qualities_enabled_flag_id,
    formStateDepartmentIdsStr,
    formStateModalityIdsStr,
    formStateTemperatureLevelIdsStr,
    formStateReasoningLevelIdsStr,
    formStateQualityIdsStr,
    formStatePricingIdsStr,
    formStateVoiceIdsStr,
  ]);

  const lastPatchedKeyRef = React.useRef<string | null>(null);

  // Draft change listener - section-first draft patching with nested resource actions
  useEffect(() => {
    const hasResourceIds =
      formState.name_id ||
      formState.description_id ||
      formState.value_id ||
      formState.provider_id ||
      formState.active_flag_id ||
      formState.modalities_enabled_flag_id ||
      formState.temperature_enabled_flag_id ||
      formState.pricing_enabled_flag_id ||
      formState.voices_enabled_flag_id ||
      formState.reasoning_levels_enabled_flag_id ||
      formState.qualities_enabled_flag_id ||
      formState.departmentIds.length > 0 ||
      formState.modality_ids.length > 0 ||
      formState.temperature_level_ids.length > 0 ||
      formState.reasoning_level_ids.length > 0 ||
      formState.quality_ids.length > 0 ||
      formState.pricing_ids.length > 0 ||
      formState.voice_ids.length > 0;

    if (!hasResourceIds || !patchModelDraftActionRef.current) {
      return;
    }

    if (lastPatchedKeyRef.current === draftPatchKey) {
      return;
    }

    const timer = setTimeout(async () => {
      try {
        if (!patchModelDraftActionRef.current) return;
        const result = await patchModelDraftActionRef.current({
          body: {
            input_draft_id: draftId || null,
            group_id: s?.group_id || "",
            names: { resource_id: formState.name_id || null },
            descriptions: { resource_id: formState.description_id || null },
            values: { resource_id: formState.value_id || null },
            providers: { resource_id: formState.provider_id || null },
            flags: {
              resource_ids: [
                formState.active_flag_id,
                formState.modalities_enabled_flag_id,
                formState.temperature_enabled_flag_id,
                formState.pricing_enabled_flag_id,
                formState.voices_enabled_flag_id,
                formState.reasoning_levels_enabled_flag_id,
                formState.qualities_enabled_flag_id,
              ].filter((id): id is string => id != null),
            },
            departments: {
              resource_ids:
                formState.departmentIds.length > 0
                  ? formState.departmentIds
                  : null,
            },
            modalities: {
              resource_ids:
                formState.modality_ids.length > 0
                  ? formState.modality_ids
                  : null,
            },
            temperature_levels: {
              resource_ids:
                formState.temperature_level_ids.length > 0
                  ? formState.temperature_level_ids
                  : null,
            },
            pricing: {
              resource_ids:
                formState.pricing_ids.length > 0
                  ? formState.pricing_ids
                  : null,
            },
            reasoning_levels: {
              resource_ids:
                formState.reasoning_level_ids.length > 0
                  ? formState.reasoning_level_ids
                  : null,
            },
            qualities: {
              resource_ids:
                formState.quality_ids.length > 0
                  ? formState.quality_ids
                  : null,
            },
            voices: {
              resource_ids:
                formState.voice_ids.length > 0 ? formState.voice_ids : null,
            },
            expected_version: lastSavedVersionRef.current,
          },
        });

        lastPatchedKeyRef.current = draftPatchKey;

        if (!draftId && result.draft_id) {
          setUrlFormDataRef.current?.({ draftId: result.draft_id });
        }

        if ((result.new_version ?? 0) !== lastSavedVersionRef.current) {
          setLastSavedVersion(result.new_version ?? 0);
          lastSavedVersionRef.current = result.new_version ?? 0;
        }
      } catch {
        // Failed to save draft
      }
    }, 1000);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftPatchKey]);

  // Generation handler - uses resource_types directly (no domain_ids)
  const handleGenerateResources = useCallback(
    async (resourceTypes: ResourceType[], userInstructions?: string) => {
      if (!socket || !isConnected) {
        toast.error("WebSocket not connected");
        return;
      }

      setGeneratingResources((prev) => {
        const next = new Set(prev);
        resourceTypes.forEach((rt) => next.add(rt));
        return next;
      });

      const formData = formDataRef.current;
      const draftId = (formData["draftId"] as string | undefined) ?? null;

      // Emit model_generate with resource_types (gold standard pattern)
      socket.emit("model_generate", {
        resource_types: resourceTypes,
        user_instructions: userInstructions ? [userInstructions] : null,
        draft_id: draftId || null,
        model_id: modelId || null,
      });
    },
    [socket, isConnected, modelId, setGeneratingResources],
  );

  const handleGenerateName = useCallback(
    async () => handleGenerateResources(["names"]),
    [handleGenerateResources],
  );

  const handleGenerateDescription = useCallback(
    async () => handleGenerateResources(["descriptions"]),
    [handleGenerateResources],
  );

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

  // Set breadcrumb context
  useEffect(() => {
    const modelName = s?.names?.resource?.name;
    if (modelName && modelId && isEditMode) {
      setEntityMetadata({
        entityId: modelId,
        entityName: modelName,
        entityType: "model",
      });
    }
    return () => {
      if (modelId) {
        clearEntityMetadata(modelId);
      }
    };
  }, [
    s?.names?.resource?.name,
    modelId,
    isEditMode,
    setEntityMetadata,
    clearEntityMetadata,
  ]);

  // Step-to-resources mapping
  const stepResources: Record<string, ResourceType[]> = useMemo(
    () => ({
      basic: ["names", "descriptions", "flags"],
      provider: [],
      modalities: [],
      temperature: ["temperature_levels"],
      pricing: [],
      reasoning: ["reasoning_levels"],
      voices: ["voices"],
      qualities: [],
      all: [
        "names",
        "descriptions",
        "flags",
        "temperature_levels",
        "reasoning_levels",
        "voices",
      ],
    }),
    [],
  );

  // Listen for full-page-generate event
  useEffect(() => {
    const handleFullPageGenerate = (
      event: CustomEvent<{ agentId?: string }>,
    ) => {
      const agentId = event.detail?.agentId;
      if (agentId) {
        handleGenerateResources(stepResources["all"] || []);
      }
    };
    window.addEventListener(
      "full-page-generate",
      handleFullPageGenerate as EventListener,
    );
    return () =>
      window.removeEventListener(
        "full-page-generate",
        handleFullPageGenerate as EventListener,
      );
  }, [handleGenerateResources, stepResources]);

  // Submit handler - builds nested resource actions for save
  const handleSubmit = useCallback(
    async (_formData: Record<string, unknown>) => {
      if (s?.names?.required && !formState.name_id) {
        toast.error("Model name is required");
        throw new Error("Model name is required");
      }

      if (s?.values?.required && !formState.value_id) {
        toast.error("Model value is required");
        throw new Error("Model value is required");
      }

      if (!formState.provider_id) {
        toast.error("Provider is required");
        throw new Error("Provider is required");
      }

      if (!profile?.id) {
        toast.error("Profile not loaded. Please refresh the page.");
        throw new Error("Profile not loaded");
      }

      if (!saveModelAction) {
        toast.error("Save action not available");
        throw new Error("Save action not available");
      }

      try {
        await saveModelAction({
          body: {
            input_model_id: isEditMode && modelId ? modelId : null,
            group_id: s?.group_id || "",
            names: { resource_id: formState.name_id || null },
            descriptions: { resource_id: formState.description_id || null },
            values: { resource_id: formState.value_id || null },
            providers: { resource_id: formState.provider_id || null },
            flags: {
              resource_ids: [
                formState.active_flag_id,
                formState.modalities_enabled_flag_id,
                formState.temperature_enabled_flag_id,
                formState.pricing_enabled_flag_id,
                formState.voices_enabled_flag_id,
                formState.reasoning_levels_enabled_flag_id,
                formState.qualities_enabled_flag_id,
              ].filter((id): id is string => id != null),
            },
            departments: {
              resource_ids:
                formState.departmentIds.length > 0
                  ? formState.departmentIds
                  : null,
            },
            modalities: {
              resource_ids:
                formState.modality_ids.length > 0
                  ? formState.modality_ids
                  : null,
            },
            temperature_levels: {
              resource_ids:
                formState.temperature_level_ids.length > 0
                  ? formState.temperature_level_ids
                  : null,
            },
            pricing: {
              resource_ids:
                formState.pricing_ids.length > 0
                  ? formState.pricing_ids
                  : null,
            },
            reasoning_levels: {
              resource_ids:
                formState.reasoning_level_ids.length > 0
                  ? formState.reasoning_level_ids
                  : null,
            },
            qualities: {
              resource_ids:
                formState.quality_ids.length > 0
                  ? formState.quality_ids
                  : null,
            },
            voices: {
              resource_ids:
                formState.voice_ids.length > 0 ? formState.voice_ids : null,
            },
          },
        });
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
      formState,
      isEditMode,
      modelId,
      profile?.id,
      saveModelAction,
      router,
      s?.names?.required,
      s?.values?.required,
      s?.group_id,
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
      const modalities_enabled_flag_id = formState.modalities_enabled_flag_id;
      const temperature_enabled_flag_id = formState.temperature_enabled_flag_id;
      const pricing_enabled_flag_id = formState.pricing_enabled_flag_id;
      const voices_enabled_flag_id = formState.voices_enabled_flag_id;
      const reasoning_levels_enabled_flag_id =
        formState.reasoning_levels_enabled_flag_id;
      const qualities_enabled_flag_id = formState.qualities_enabled_flag_id;

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
    [formState],
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
          "active_flag_id",
          "modalities_enabled_flag_id",
          "temperature_enabled_flag_id",
          "pricing_enabled_flag_id",
          "voices_enabled_flag_id",
          "reasoning_levels_enabled_flag_id",
          "qualities_enabled_flag_id",
          "departmentSearch",
          "departmentIds",
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
      "active_flag_id",
      "modalities_enabled_flag_id",
      "temperature_enabled_flag_id",
      "pricing_enabled_flag_id",
      "voices_enabled_flag_id",
      "reasoning_levels_enabled_flag_id",
      "qualities_enabled_flag_id",
      "value_id",
      "provider_id",
      "departmentIds",
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
            active_flag_id: null,
            modalities_enabled_flag_id: null,
            temperature_enabled_flag_id: null,
            pricing_enabled_flag_id: null,
            voices_enabled_flag_id: null,
            reasoning_levels_enabled_flag_id: null,
            qualities_enabled_flag_id: null,
            departmentIds: [],
          };
        case "provider":
          return { ...prev, provider_id: null };
        case "modalities":
          return { ...prev, modality_ids: [] };
        case "temperature":
          return { ...prev, temperature_level_ids: [] };
        case "pricing":
          return { ...prev, pricing_ids: [] };
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
      const departmentSearch =
        (formData["departmentSearch"] as string | undefined) ?? "";
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
      const flagConfig = (key: string) => allFlags.find((f) => f.key === key);
      const flagResource = (key: string) => {
        const cfg = flagConfig(key);
        return cfg
          ? {
              id: cfg.flag_option_id ?? null,
              name: cfg.label ?? null,
              description: cfg.description ?? null,
              icon: cfg.icon_id ?? null,
              generated: cfg.generated ?? null,
            }
          : null;
      };

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
                  onNameIdChange={(id) =>
                    setFormState((prev) => ({ ...prev, name_id: id }))
                  }
                  onGenerate={handleGenerateName}
                  isGenerating={isGenerating("names")}
                  placeholder="e.g., GPT-4"
                  defaultName="New Model"
                  required={s?.names?.required ?? true}
                  hideDescription={true}
                  group_id={s?.group_id ?? null}
                  create_tool_id={s?.names?.create_tool_id ?? null}
                  link_tool_id={s?.names?.link_tool_id ?? null}
                  showAiGenerate={s?.names?.show_ai_generate ?? false}
                  createNamesAction={createNamesAction}
                />
              }
              resetFields={[
                "name_id",
                "description_id",
                "value_id",
                "active_flag_id",
                "modalities_enabled_flag_id",
                "temperature_enabled_flag_id",
                "pricing_enabled_flag_id",
                "voices_enabled_flag_id",
                "reasoning_levels_enabled_flag_id",
                "qualities_enabled_flag_id",
                "departmentIds",
              ]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
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
                  onDescriptionIdChange={(id) =>
                    setFormState((prev) => ({ ...prev, description_id: id }))
                  }
                  onGenerate={handleGenerateDescription}
                  isGenerating={isGenerating("descriptions")}
                  placeholder="Enter a brief description"
                  required={s?.descriptions?.required ?? false}
                  group_id={s?.group_id ?? null}
                  create_tool_id={s?.descriptions?.create_tool_id ?? null}
                  link_tool_id={s?.descriptions?.link_tool_id ?? null}
                  showAiGenerate={s?.descriptions?.show_ai_generate ?? false}
                  createDescriptionsAction={createDescriptionsAction}
                />

                <Values
                  value_ids={formState.value_id ? [formState.value_id] : []}
                  value_resources={
                    formState.value_id && s?.values?.resource
                      ? [
                          {
                            value_id: s.values.resource.id,
                            name: s.values.resource.value,
                            generated: s.values.resource.generated,
                          },
                        ]
                      : []
                  }
                  show_values={s?.values?.show ?? true}
                  value_suggestions={s?.values?.suggestions ?? []}
                  values={(s?.values?.resources ?? []).map((v) => ({
                    value_id: v.id,
                    name: v.value,
                    generated: v.generated,
                  }))}
                  searchTerm={valueSearch}
                  onSearchChange={(term: string) =>
                    setFormData({ valueSearch: term || null })
                  }
                  disabled={disabled}
                  onChange={(ids) =>
                    setFormState({
                      ...formState,
                      value_id: ids.length > 0 ? (ids[0] ?? null) : null,
                    })
                  }
                  label="Value"
                  placeholder="Select model value identifier (e.g., gpt-4, gemini-pro)"
                  required={s?.values?.required ?? true}
                  description="Unique identifier for this model (used in API calls)"
                  group_id={s?.group_id ?? null}
                  create_tool_id={s?.values?.create_tool_id ?? null}
                  link_tool_id={s?.values?.link_tool_id ?? null}
                  showAiGenerate={s?.values?.show_ai_generate ?? false}
                  createValuesAction={createValuesAction}
                />

                {validDepartmentIds && validDepartmentIds.length > 1 && (
                  <div className="space-y-2">
                    <Label htmlFor="department">Department</Label>
                    <GenericPicker
                      items={departments.map((d) => ({
                        id: d.department_id ?? "",
                        name: d.name ?? "",
                        description: d.description ?? "",
                      }))}
                      itemIds={validDepartmentIds}
                      selectedIds={formState.departmentIds}
                      onSelect={(ids) =>
                        setFormState({
                          ...formState,
                          departmentIds: ids.length > 0 ? ids : [],
                        })
                      }
                      getId={(dept: { id: string }) => dept.id}
                      getLabel={(dept: { name?: string | null }) =>
                        dept.name || ""
                      }
                      getSearchText={(dept: {
                        name?: string | null;
                        description?: string | null;
                      }) => `${dept.name || ""} ${dept.description || ""}`}
                      {...{ initialSearchTerm: departmentSearch }}
                      {...{
                        onSearchChange: (term: string) =>
                          setFormData({ departmentSearch: term || null }),
                      }}
                      placeholder="All Departments"
                      disabled={disabled}
                      multiSelect={true}
                      hideSelectedChips={true}
                      buttonClassName="w-full"
                    />
                  </div>
                )}

                <Flags
                  flag_id={formState.active_flag_id ?? null}
                  flag_resource={flagResource("active")}
                  show_flag={flagConfig("active")?.show ?? false}
                  disabled={disabled}
                  onFlagIdChange={(id) =>
                    setFormState((prev) => ({ ...prev, active_flag_id: id }))
                  }
                  label="Active"
                  helpText="Inactive models will not be available for selection"
                  required={flagConfig("active")?.required ?? false}
                  group_id={s?.group_id ?? null}
                  link_tool_id={s?.flags?.link_tool_id ?? null}
                  showAiGenerate={s?.flags?.show_ai_generate ?? false}

                />

                <Flags
                  flag_id={formState.modalities_enabled_flag_id ?? null}
                  flag_resource={flagResource("modalities_enabled")}
                  show_flag={flagConfig("modalities_enabled")?.show ?? false}
                  disabled={disabled}
                  onFlagIdChange={(id) => {
                    setFormState((prev) => ({
                      ...prev,
                      modalities_enabled_flag_id: id,
                      modality_ids: id ? prev.modality_ids : [],
                    }));
                  }}
                  label="Modalities"
                  helpText="Enable modalities configuration"
                  required={flagConfig("modalities_enabled")?.required ?? false}
                  group_id={s?.group_id ?? null}
                  link_tool_id={s?.flags?.link_tool_id ?? null}
                  showAiGenerate={s?.flags?.show_ai_generate ?? false}

                />

                <Flags
                  flag_id={formState.temperature_enabled_flag_id ?? null}
                  flag_resource={flagResource("temperature_enabled")}
                  show_flag={flagConfig("temperature_enabled")?.show ?? false}
                  disabled={disabled}
                  onFlagIdChange={(id) => {
                    setFormState((prev) => ({
                      ...prev,
                      temperature_enabled_flag_id: id,
                      temperature_level_ids: id
                        ? prev.temperature_level_ids
                        : [],
                    }));
                  }}
                  label="Temperature"
                  helpText="Configure temperature levels for this model"
                  required={
                    flagConfig("temperature_enabled")?.required ?? false
                  }
                  group_id={s?.group_id ?? null}
                  link_tool_id={s?.flags?.link_tool_id ?? null}
                  showAiGenerate={s?.flags?.show_ai_generate ?? false}

                />

                <Flags
                  flag_id={formState.pricing_enabled_flag_id ?? null}
                  flag_resource={flagResource("pricing_enabled")}
                  show_flag={flagConfig("pricing_enabled")?.show ?? false}
                  disabled={disabled}
                  onFlagIdChange={(id) => {
                    setFormState((prev) => ({
                      ...prev,
                      pricing_enabled_flag_id: id,
                      pricing_ids: id ? prev.pricing_ids : [],
                    }));
                  }}
                  label="Pricing"
                  helpText="Configure pricing for this model"
                  required={flagConfig("pricing_enabled")?.required ?? false}
                  group_id={s?.group_id ?? null}
                  link_tool_id={s?.flags?.link_tool_id ?? null}
                  showAiGenerate={s?.flags?.show_ai_generate ?? false}

                />

                <Flags
                  flag_id={formState.voices_enabled_flag_id ?? null}
                  flag_resource={flagResource("voices_enabled")}
                  show_flag={flagConfig("voices_enabled")?.show ?? false}
                  disabled={disabled}
                  onFlagIdChange={(id) => {
                    setFormState((prev) => ({
                      ...prev,
                      voices_enabled_flag_id: id,
                      voice_ids: id ? prev.voice_ids : [],
                    }));
                  }}
                  label="Voices"
                  helpText="Select voices for this model"
                  required={flagConfig("voices_enabled")?.required ?? false}
                  group_id={s?.group_id ?? null}
                  link_tool_id={s?.flags?.link_tool_id ?? null}
                  showAiGenerate={s?.flags?.show_ai_generate ?? false}

                />

                <Flags
                  flag_id={formState.reasoning_levels_enabled_flag_id ?? null}
                  flag_resource={flagResource("reasoning_levels_enabled")}
                  show_flag={
                    flagConfig("reasoning_levels_enabled")?.show ?? false
                  }
                  disabled={disabled}
                  onFlagIdChange={(id) => {
                    setFormState((prev) => ({
                      ...prev,
                      reasoning_levels_enabled_flag_id: id,
                      reasoning_level_ids: id ? prev.reasoning_level_ids : [],
                    }));
                  }}
                  label="Reasoning Levels"
                  helpText="Select reasoning levels for this model"
                  required={
                    flagConfig("reasoning_levels_enabled")?.required ?? false
                  }
                  group_id={s?.group_id ?? null}
                  link_tool_id={s?.flags?.link_tool_id ?? null}
                  showAiGenerate={s?.flags?.show_ai_generate ?? false}

                />

                <Flags
                  flag_id={formState.qualities_enabled_flag_id ?? null}
                  flag_resource={flagResource("qualities_enabled")}
                  show_flag={flagConfig("qualities_enabled")?.show ?? false}
                  disabled={disabled}
                  onFlagIdChange={(id) => {
                    setFormState((prev) => ({
                      ...prev,
                      qualities_enabled_flag_id: id,
                      quality_ids: id ? prev.quality_ids : [],
                    }));
                  }}
                  label="Qualities"
                  helpText="Select quality levels for this model"
                  required={flagConfig("qualities_enabled")?.required ?? false}
                  group_id={s?.group_id ?? null}
                  link_tool_id={s?.flags?.link_tool_id ?? null}
                  showAiGenerate={s?.flags?.show_ai_generate ?? false}

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
              <ProviderCardGrid
                providerMapping={providers.reduce(
                  (
                    acc: Record<string, { name: string; description: string }>,
                    p,
                  ) => {
                    const providerId = p.id ?? null;
                    if (providerId) {
                      acc[String(providerId)] = {
                        name: p.name ?? "",
                        description: p.description ?? "",
                      };
                    }
                    return acc;
                  },
                  {} as Record<string, { name: string; description: string }>,
                )}
                validProviderIds={providers
                  .map((p) => p.id ?? null)
                  .filter((id): id is string => !!id)
                  .map((id) => String(id))}
                selectedProviderId={formState.provider_id || null}
                onSelect={(providerId) => {
                  setFormState({
                    ...formState,
                    provider_id: providerId || null,
                  });
                }}
                readonly={disabled}
              />
            </StepCard>
          );

        case "modalities":
          if (!formState.modalities_enabled_flag_id) return null;
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
            >
              <Modalities
                modality_ids={formState.modality_ids}
                modality_resources={(s?.modalities?.current ?? []).map((m) => ({
                  modality_id: m.id,
                  name: m.modality,
                  generated: m.generated,
                }))}
                show_modalities={s?.modalities?.show ?? true}
                modality_suggestions={s?.modalities?.suggestions ?? []}
                modalities={(s?.modalities?.resources ?? []).map((m) => ({
                  modality_id: m.id,
                  name: m.modality,
                  generated: m.generated,
                }))}
                searchTerm={modalitySearch}
                onSearchChange={(term: string) =>
                  setFormData({ modalitySearch: term || null })
                }
                disabled={disabled}
                onChange={(ids) =>
                  setFormState({ ...formState, modality_ids: ids })
                }
                label="Modalities"
                placeholder="Select modalities"
                required={s?.modalities?.required ?? true}
                group_id={s?.group_id ?? null}
                link_tool_id={s?.modalities?.link_tool_id ?? null}
                showAiGenerate={s?.modalities?.show_ai_generate ?? false}

              />
            </StepCard>
          );

        case "temperature":
          if (!formState.temperature_enabled_flag_id) return null;
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
            >
              <TemperatureLevels
                temperature_level_id={
                  formState.temperature_level_ids.length > 0
                    ? (formState.temperature_level_ids[0] ?? null)
                    : null
                }
                temperature_level_resource={
                  formState.temperature_level_ids.length > 0 &&
                  s?.temperature_levels?.current?.[0]
                    ? {
                        id: s.temperature_levels.current[0].id,
                        temperature: String(
                          s.temperature_levels.current[0].temperature,
                        ),
                        is_upper: false,
                        generated: s.temperature_levels.current[0].generated,
                      }
                    : null
                }
                show_temperature_levels={s?.temperature_levels?.show ?? true}
                temperature_level_suggestions={
                  s?.temperature_levels?.suggestions ?? []
                }
                temperature_levels={(
                  s?.temperature_levels?.resources ?? []
                ).map((t) => ({
                  id: t.id,
                  temperature: String(t.temperature),
                  is_upper: false,
                  generated: t.generated,
                }))}
                searchTerm={temperatureSearch}
                onSearchChange={(term: string) =>
                  setFormData({ temperatureSearch: term || null })
                }
                disabled={disabled}
                onTemperatureLevelIdChange={(id) =>
                  setFormState({
                    ...formState,
                    temperature_level_ids: id ? [id] : [],
                  })
                }
                label="Temperature Levels"
                placeholder="Select temperature levels"
                required={s?.temperature_levels?.required ?? false}
                group_id={s?.group_id ?? null}
                link_tool_id={s?.temperature_levels?.link_tool_id ?? null}
                showAiGenerate={
                  s?.temperature_levels?.show_ai_generate ?? false
                }
              />
            </StepCard>
          );

        case "pricing":
          if (!formState.pricing_enabled_flag_id) return null;
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
            >
              <Pricing
                pricing_ids={formState.pricing_ids}
                pricing_resources={(s?.pricing?.current ?? []).map((p) => ({
                  pricing_id: p.id,
                  name: `${p.pricing_type}`,
                  description: `${p.price}`,
                  generated: p.generated,
                }))}
                show_pricing={s?.pricing?.show ?? true}
                pricing_suggestions={s?.pricing?.suggestions ?? []}
                pricings={(s?.pricing?.resources ?? []).map((p) => ({
                  pricing_id: p.id,
                  name: `${p.pricing_type}`,
                  description: `${p.price}`,
                  generated: p.generated,
                }))}
                searchTerm={pricingSearch}
                onSearchChange={(term: string) =>
                  setFormData({ pricingSearch: term || null })
                }
                disabled={disabled}
                onChange={(ids) =>
                  setFormState({ ...formState, pricing_ids: ids })
                }
                label="Pricing"
                placeholder="Select pricing configurations"
                required={s?.pricing?.required ?? false}
                group_id={s?.group_id ?? null}
                link_tool_id={s?.pricing?.link_tool_id ?? null}
                showAiGenerate={s?.pricing?.show_ai_generate ?? false}
                createPricingAction={createPricingAction}
              />
            </StepCard>
          );

        case "reasoning":
          if (!formState.reasoning_levels_enabled_flag_id) return null;
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
            >
              <ReasoningLevels
                reasoning_level_id={
                  formState.reasoning_level_ids.length > 0
                    ? (formState.reasoning_level_ids[0] ?? null)
                    : null
                }
                reasoning_level_resource={
                  formState.reasoning_level_ids.length > 0 &&
                  s?.reasoning_levels?.current?.[0]
                    ? {
                        id: s.reasoning_levels.current[0].id,
                        reasoning_level:
                          s.reasoning_levels.current[0].reasoning_level,
                        generated: s.reasoning_levels.current[0].generated,
                      }
                    : null
                }
                show_reasoning_levels={s?.reasoning_levels?.show ?? true}
                reasoning_level_suggestions={
                  s?.reasoning_levels?.suggestions ?? []
                }
                reasoning_levels={(s?.reasoning_levels?.resources ?? []).map(
                  (r) => ({
                    id: r.id,
                    reasoning_level: r.reasoning_level,
                    generated: r.generated,
                  }),
                )}
                searchTerm={reasoningSearch}
                onSearchChange={(term: string) =>
                  setFormData({ reasoningSearch: term || null })
                }
                disabled={disabled}
                onReasoningLevelIdChange={(id) =>
                  setFormState({
                    ...formState,
                    reasoning_level_ids: id ? [id] : [],
                  })
                }
                label="Reasoning Levels"
                placeholder="Select reasoning levels"
                required={s?.reasoning_levels?.required ?? false}
                group_id={s?.group_id ?? null}
                link_tool_id={s?.reasoning_levels?.link_tool_id ?? null}
                showAiGenerate={
                  s?.reasoning_levels?.show_ai_generate ?? false
                }
              />
            </StepCard>
          );

        case "voices":
          if (!formState.voices_enabled_flag_id) return null;
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
            >
              <Voices
                voice_ids={formState.voice_ids}
                voice_resources={s?.voices?.current ?? []}
                show_voices={s?.voices?.show ?? true}
                voice_suggestions={s?.voices?.suggestions ?? []}
                voices={s?.voices?.resources ?? []}
                searchTerm={voiceSearch}
                onSearchChange={(term: string) =>
                  setFormData({ voiceSearch: term || null })
                }
                disabled={disabled}
                onVoiceIdsChange={(ids) =>
                  setFormState({ ...formState, voice_ids: ids })
                }
                label="Voices"
                placeholder="Select voices"
                required={s?.voices?.required ?? false}
                group_id={s?.group_id ?? null}
                link_tool_id={s?.voices?.link_tool_id ?? null}
                createVoicesAction={createVoicesAction}
              />
            </StepCard>
          );

        case "qualities":
          if (!formState.qualities_enabled_flag_id) return null;
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
            >
              <Qualities
                quality_ids={formState.quality_ids}
                quality_resources={(s?.qualities?.current ?? []).map((q) => ({
                  quality_id: q.id,
                  name: q.quality,
                  generated: q.generated,
                }))}
                show_qualities={s?.qualities?.show ?? true}
                quality_suggestions={s?.qualities?.suggestions ?? []}
                qualities={(s?.qualities?.resources ?? []).map((q) => ({
                  quality_id: q.id,
                  name: q.quality,
                  generated: q.generated,
                }))}
                searchTerm={qualitySearch}
                onSearchChange={(term: string) =>
                  setFormData({ qualitySearch: term || null })
                }
                disabled={disabled}
                onChange={(ids) =>
                  setFormState({ ...formState, quality_ids: ids })
                }
                label="Qualities"
                placeholder="Select quality levels"
                required={s?.qualities?.required ?? false}
                group_id={s?.group_id ?? null}
                link_tool_id={s?.qualities?.link_tool_id ?? null}
                showAiGenerate={s?.qualities?.show_ai_generate ?? false}
              />
            </StepCard>
          );

        default:
          return null;
      }
    },
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
      createNamesAction,
      createDescriptionsAction,
      createValuesAction,
      createPricingAction,
      createVoicesAction,
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
