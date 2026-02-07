/**
 * Model.tsx
 * Implementation using modular resource components
 * Used to create and manage models - supports both creation and editing
 * @AshokSaravanan222 & @siladiea
 * 01/08/2026
 */
"use client";

import { useRouter } from "next/navigation";
import React, { useCallback, useEffect, useMemo, useState } from "react";
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
import { Endpoints } from "@/components/resources/Endpoints";
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

// Helper: find current flag option ID from resources.current.flags by key
const findCurrentFlagId = (
  flags: Array<{ key?: string; flag_option_id?: string | null }> | null | undefined,
  key: string
): string | null =>
  flags?.find((f) => f.key === key)?.flag_option_id ?? null;

// Types defined inline using InputOf/OutputOf
type SaveModelIn = InputOf<"/api/v4/models/save", "post">;
type SaveModelOut = OutputOf<"/api/v4/models/save", "post">;
type PatchModelDraftIn = InputOf<"/api/v4/models/draft", "patch">;
type PatchModelDraftOut = OutputOf<"/api/v4/models/draft", "patch">;

type ModelData = OutputOf<"/api/v4/models/get", "post">;

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
type CreateDraftEndpointsIn = InputOf<"/api/v4/resources/endpoints", "post">;
type CreateDraftEndpointsOut = OutputOf<"/api/v4/resources/endpoints", "post">;
type CreateDraftFlagsIn = InputOf<"/api/v4/resources/flags", "post">;
type CreateDraftFlagsOut = OutputOf<"/api/v4/resources/flags", "post">;
type CreateDraftModalitiesIn = InputOf<"/api/v4/resources/modalities", "post">;
type CreateDraftModalitiesOut = OutputOf<"/api/v4/resources/modalities", "post">;
type CreateDraftTemperatureLevelsIn = InputOf<
  "/api/v4/resources/temperature_levels",
  "post"
>;
type CreateDraftTemperatureLevelsOut = OutputOf<
  "/api/v4/resources/temperature_levels",
  "post"
>;
type CreateDraftReasoningLevelsIn = InputOf<
  "/api/v4/resources/reasoning_levels",
  "post"
>;
type CreateDraftReasoningLevelsOut = OutputOf<
  "/api/v4/resources/reasoning_levels",
  "post"
>;
type CreateDraftPricingIn = InputOf<"/api/v4/resources/pricing", "post">;
type CreateDraftPricingOut = OutputOf<"/api/v4/resources/pricing", "post">;
type CreateDraftVoicesIn = InputOf<"/api/v4/resources/voices", "post">;
type CreateDraftVoicesOut = OutputOf<"/api/v4/resources/voices", "post">;
type CreateDraftQualitiesIn = InputOf<"/api/v4/resources/qualities", "post">;
type CreateDraftQualitiesOut = OutputOf<"/api/v4/resources/qualities", "post">;

type PatchModelDraftActionInput = {
  body: {
    input_draft_id: string | null;
    name_id: string | null;
    description_id: string | null;
    value_id: string | null;
    endpoint_id: string | null;
    provider_id: string | null;
    active_flag_id: string | null;
    modalities_enabled_flag_id: string | null;
    temperature_enabled_flag_id: string | null;
    pricing_enabled_flag_id: string | null;
    voices_enabled_flag_id: string | null;
    reasoning_levels_enabled_flag_id: string | null;
    qualities_enabled_flag_id: string | null;
    department_ids: string[];
    input_modality_ids: string[];
    output_modality_ids: string[];
    temperature_level_ids: string[];
    reasoning_level_ids: string[];
    quality_ids: string[];
    pricing_ids: string[];
    voice_ids: string[];
    expected_version: number;
  };
};

export interface ModelProps {
  modelId?: string;
  // For create mode: default model detail with provider mapping
  modelDetailDefault?: ModelData;
  // For edit mode: model detail with provider mapping
  modelDetail?: ModelData;
  saveModelAction?: (input: SaveModelIn) => Promise<SaveModelOut>;
  patchModelDraftAction?: (
    input: PatchModelDraftIn
  ) => Promise<PatchModelDraftOut>;
  createNamesAction?: (
    input: CreateDraftNamesIn
  ) => Promise<CreateDraftNamesOut>;
  createDescriptionsAction?: (
    input: CreateDraftDescriptionsIn
  ) => Promise<CreateDraftDescriptionsOut>;
  createValuesAction?: (
    input: CreateDraftValuesIn
  ) => Promise<CreateDraftValuesOut>;
  createEndpointsAction?: (
    input: CreateDraftEndpointsIn
  ) => Promise<CreateDraftEndpointsOut>;
  createFlagsAction?: (
    input: CreateDraftFlagsIn
  ) => Promise<CreateDraftFlagsOut>;
  createModalitiesAction?: (
    input: CreateDraftModalitiesIn
  ) => Promise<CreateDraftModalitiesOut>;
  createTemperatureLevelsAction?: (
    input: CreateDraftTemperatureLevelsIn
  ) => Promise<CreateDraftTemperatureLevelsOut>;
  createReasoningLevelsAction?: (
    input: CreateDraftReasoningLevelsIn
  ) => Promise<CreateDraftReasoningLevelsOut>;
  createPricingAction?: (
    input: CreateDraftPricingIn
  ) => Promise<CreateDraftPricingOut>;
  createVoicesAction?: (
    input: CreateDraftVoicesIn
  ) => Promise<CreateDraftVoicesOut>;
  createQualitiesAction?: (
    input: CreateDraftQualitiesIn
  ) => Promise<CreateDraftQualitiesOut>;
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
  createEndpointsAction,
  createFlagsAction,
  createModalitiesAction,
  createTemperatureLevelsAction,
  createReasoningLevelsAction,
  createPricingAction,
  createVoicesAction,
  createQualitiesAction,
}: ModelProps) {
  const router = useRouter();
  const isEditMode = !!modelId;
  const {
    profile,
    selectedDraftId,
    setSelectedDraftId,
    socket,
    isConnected,
  } = useProfile();
  const { setEntityMetadata, clearEntityMetadata } = useBreadcrumbContext();

  // Generation state for AI workflows - simplified using ResourceType
  const [generatingResources, setGeneratingResources] = useState<
    Set<ResourceType>
  >(new Set());

  const isGenerating = useCallback(
    (resourceType: ResourceType) => generatingResources.has(resourceType),
    [generatingResources]
  );

  // nuqs parsers for URL-backed state (will be passed to GenericForm)
  // Memoize to prevent new object reference on every render
  const modelSearchParamsClient = useMemo(
    () => ({
      // Draft ID (URL-backed, updated when draft is created)
      draftId: parseAsString,
      descriptionSearch: parseAsString,
      valueSearch: parseAsString,
      endpointSearch: parseAsString,
      departmentSearch: parseAsString,
      inputModalitySearch: parseAsString,
      outputModalitySearch: parseAsString,
      temperatureSearch: parseAsString,
      pricingSearch: parseAsString,
      reasoningSearch: parseAsString,
      voiceSearch: parseAsString,
      qualitySearch: parseAsString,
    }),
    []
  );

  // Use server-provided data
  const modelData = isEditMode ? serverModelDetail : modelDetailDefault;

  // Local form state (not in URL) - stores only resource IDs
  // Display values are managed inside resource components
  // Use ref to store modelData to prevent callback recreation on every render
  const modelDataRef = React.useRef(modelData);
  React.useEffect(() => {
    modelDataRef.current = modelData;
  }, [modelData]);

  const isSuperadmin = profile?.role === "superadmin";
  const defaultDepartmentIds = useMemo(
    () =>
      getDefaultDepartmentIds(
        isSuperadmin,
        profile?.primary_department_id || null
      ),
    [isSuperadmin, profile?.primary_department_id]
  );

  const getInitialFormState = useCallback(() => {
    const data = modelDataRef.current;
    if (!data) {
      return {
        name_id: null as string | null,
        description_id: null as string | null,
        value_id: null as string | null,
        endpoint_id: null as string | null,
        provider_id: null as string | null,
        active_flag_id: null as string | null,
        modalities_enabled_flag_id: null as string | null,
        temperature_enabled_flag_id: null as string | null,
        pricing_enabled_flag_id: null as string | null,
        voices_enabled_flag_id: null as string | null,
        reasoning_levels_enabled_flag_id: null as string | null,
        qualities_enabled_flag_id: null as string | null,
        input_modality_ids: [] as string[],
        output_modality_ids: [] as string[],
        temperature_level_ids: [] as string[],
        reasoning_level_ids: [] as string[],
        quality_ids: [] as string[],
        pricing_ids: [] as string[],
        voice_ids: [] as string[],
        departmentIds: defaultDepartmentIds,
      };
    }
    // Extract resource IDs from bucket pattern
    const cur = data.resources?.current;
    const curFlags = cur?.flags ?? [];

    return {
      // Single-select IDs from resources.current.*[0].id
      name_id: (cur?.names?.[0]?.id as string) ?? null,
      description_id: (cur?.descriptions?.[0]?.id as string) ?? null,
      value_id: (cur?.values?.[0]?.id as string) ?? null,
      endpoint_id: (cur?.endpoints?.[0]?.id as string) ?? null,
      provider_id: (cur?.providers?.[0]?.id as string) ?? null,

      // Flag IDs from resources.current.flags by key
      active_flag_id: findCurrentFlagId(curFlags, "active"),
      modalities_enabled_flag_id: findCurrentFlagId(curFlags, "modalities_enabled"),
      temperature_enabled_flag_id: findCurrentFlagId(curFlags, "temperature_enabled"),
      pricing_enabled_flag_id: findCurrentFlagId(curFlags, "pricing_enabled"),
      voices_enabled_flag_id: findCurrentFlagId(curFlags, "voices_enabled"),
      reasoning_levels_enabled_flag_id: findCurrentFlagId(curFlags, "reasoning_levels_enabled"),
      qualities_enabled_flag_id: findCurrentFlagId(curFlags, "qualities_enabled"),

      // Multi-select IDs from resources.current.* arrays
      input_modality_ids: (cur?.input_modalities ?? []).map((m) => m.id as string).filter(Boolean),
      output_modality_ids: (cur?.output_modalities ?? []).map((m) => m.id as string).filter(Boolean),
      temperature_level_ids: (cur?.temperature_levels ?? []).map((t) => t.id as string).filter(Boolean),
      reasoning_level_ids: (cur?.reasoning_levels ?? []).map((r) => r.id as string).filter(Boolean),
      quality_ids: (cur?.qualities ?? []).map((q) => q.id as string).filter(Boolean),
      pricing_ids: (cur?.pricing ?? []).map((p) => p.id as string).filter(Boolean),
      voice_ids: (cur?.voices ?? []).map((v) => v.id as string).filter(Boolean),
      departmentIds: (() => {
        const ids = (cur?.departments ?? []).map((d) => d.department_id as string).filter(Boolean);
        return ids.length > 0 ? ids : defaultDepartmentIds;
      })(),
    };
  }, [defaultDepartmentIds]);

  const [formState, setFormState] = useState(getInitialFormState);
  // Use ref to access formState in renderStep without depending on it
  const formStateRef = React.useRef(formState);
  React.useEffect(() => {
    formStateRef.current = formState;
  }, [formState]);

  // Memoize stringified array dependencies to prevent effect from running when array references change but content is same
  const cur = modelData?.resources?.current;
  const departmentIdsStr = React.useMemo(
    () => JSON.stringify((cur?.departments ?? []).map((d) => d.department_id).filter(Boolean)),
    [cur?.departments]
  );
  const inputModalityIdsStr = React.useMemo(
    () => JSON.stringify((cur?.input_modalities ?? []).map((m) => m.id).filter(Boolean)),
    [cur?.input_modalities]
  );
  const outputModalityIdsStr = React.useMemo(
    () => JSON.stringify((cur?.output_modalities ?? []).map((m) => m.id).filter(Boolean)),
    [cur?.output_modalities]
  );
  const temperatureLevelIdsStr = React.useMemo(
    () => JSON.stringify((cur?.temperature_levels ?? []).map((t) => t.id).filter(Boolean)),
    [cur?.temperature_levels]
  );
  const reasoningLevelIdsStr = React.useMemo(
    () => JSON.stringify((cur?.reasoning_levels ?? []).map((r) => r.id).filter(Boolean)),
    [cur?.reasoning_levels]
  );
  const qualityIdsStr = React.useMemo(
    () => JSON.stringify((cur?.qualities ?? []).map((q) => q.id).filter(Boolean)),
    [cur?.qualities]
  );
  const pricingIdsStr = React.useMemo(
    () => JSON.stringify((cur?.pricing ?? []).map((p) => p.id).filter(Boolean)),
    [cur?.pricing]
  );
  const voiceIdsStr = React.useMemo(
    () => JSON.stringify((cur?.voices ?? []).map((v) => v.id).filter(Boolean)),
    [cur?.voices]
  );

  // Memoize stringified formState arrays for draft listener effect dependencies
  const formStateDepartmentIdsStr = React.useMemo(
    () => JSON.stringify(formState.departmentIds),
    [formState.departmentIds]
  );
  const formStateInputModalityIdsStr = React.useMemo(
    () => JSON.stringify(formState.input_modality_ids),
    [formState.input_modality_ids]
  );
  const formStateOutputModalityIdsStr = React.useMemo(
    () => JSON.stringify(formState.output_modality_ids),
    [formState.output_modality_ids]
  );
  const formStateTemperatureLevelIdsStr = React.useMemo(
    () => JSON.stringify(formState.temperature_level_ids),
    [formState.temperature_level_ids]
  );
  const formStateReasoningLevelIdsStr = React.useMemo(
    () => JSON.stringify(formState.reasoning_level_ids),
    [formState.reasoning_level_ids]
  );
  const formStateQualityIdsStr = React.useMemo(
    () => JSON.stringify(formState.quality_ids),
    [formState.quality_ids]
  );
  const formStatePricingIdsStr = React.useMemo(
    () => JSON.stringify(formState.pricing_ids),
    [formState.pricing_ids]
  );
  const formStateVoiceIdsStr = React.useMemo(
    () => JSON.stringify(formState.voice_ids),
    [formState.voice_ids]
  );

  // Update form state when server data changes
  useEffect(() => {
    const newState = getInitialFormState();
    setFormState((prev) => {
      // Only update if resource IDs actually changed
      if (
        prev.name_id !== newState.name_id ||
        prev.description_id !== newState.description_id ||
        prev.value_id !== newState.value_id ||
        prev.endpoint_id !== newState.endpoint_id ||
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
        JSON.stringify(prev.input_modality_ids) !==
          JSON.stringify(newState.input_modality_ids) ||
        JSON.stringify(prev.output_modality_ids) !==
          JSON.stringify(newState.output_modality_ids) ||
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
    // Resources bucket triggers (single-select via current arrays, flags via curFlags)
    cur?.names,
    cur?.descriptions,
    cur?.values,
    cur?.endpoints,
    cur?.providers,
    cur?.flags,
    departmentIdsStr,
    inputModalityIdsStr,
    outputModalityIdsStr,
    temperatureLevelIdsStr,
    reasoningLevelIdsStr,
    qualityIdsStr,
    pricingIdsStr,
    voiceIdsStr,
  ]);

  // Draft version tracking for optimistic concurrency control
  // Keep version in a ref so updating it doesn't retrigger the effect
  const [lastSavedVersion, setLastSavedVersion] = useState(0);
  const lastSavedVersionRef = React.useRef(0);
  React.useEffect(() => {
    lastSavedVersionRef.current = lastSavedVersion;
  }, [lastSavedVersion]);
  // Sync draft_version from server to avoid unintended draft forks.
  const draftVersion =
    modelData && "draft_version" in modelData
      ? (modelData as { draft_version?: number | null }).draft_version
      : null;
  React.useEffect(() => {
    if (
      typeof draftVersion === "number" &&
      draftVersion !== lastSavedVersionRef.current
    ) {
      setLastSavedVersion(draftVersion);
      lastSavedVersionRef.current = draftVersion;
    }
  }, [draftVersion]);

  // Get draftId from GenericForm's URL state via bridge (GenericForm is single source of truth)
  const [draftId, setDraftId] = useState<string | null>(null);
  const setUrlFormDataRef = React.useRef<
    null | ((updates: Record<string, unknown>) => void)
  >(null);

  // Store formData from GenericForm to access search params
  const formDataRef = React.useRef<Record<string, unknown>>({});

  // Memoized callback to sync draftId from GenericForm - only update if value changed
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

  // Use ref to stabilize patchModelDraftAction to prevent effect recreation when prop reference changes
  const patchModelDraftActionRef = React.useRef(patchModelDraftAction);
  React.useEffect(() => {
    patchModelDraftActionRef.current = patchModelDraftAction;
  }, [patchModelDraftAction]);

  // Build a stable key for "what would we patch" - only changes when form data actually changes
  const draftPatchKey = React.useMemo(() => {
    return JSON.stringify({
      draftId: draftId || null,
      name_id: formState.name_id,
      description_id: formState.description_id,
      value_id: formState.value_id,
      endpoint_id: formState.endpoint_id,
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
      input_modality_ids: formState.input_modality_ids,
      output_modality_ids: formState.output_modality_ids,
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
    formState.endpoint_id,
    formState.provider_id,
    formState.active_flag_id,
    formState.modalities_enabled_flag_id,
    formState.temperature_enabled_flag_id,
    formState.pricing_enabled_flag_id,
    formState.voices_enabled_flag_id,
    formState.reasoning_levels_enabled_flag_id,
    formState.qualities_enabled_flag_id,
    formStateDepartmentIdsStr,
    formStateInputModalityIdsStr,
    formStateOutputModalityIdsStr,
    formStateTemperatureLevelIdsStr,
    formStateReasoningLevelIdsStr,
    formStateQualityIdsStr,
    formStatePricingIdsStr,
    formStateVoiceIdsStr,
  ]);

  // Track last patched payload so we don't repatch identical state
  const lastPatchedKeyRef = React.useRef<string | null>(null);

  // Draft change listener - watches resource IDs and patches draft
  useEffect(() => {
    const hasResourceIds =
      formState.name_id ||
      formState.description_id ||
      formState.value_id ||
      formState.endpoint_id ||
      formState.provider_id ||
      formState.active_flag_id ||
      formState.modalities_enabled_flag_id ||
      formState.temperature_enabled_flag_id ||
      formState.pricing_enabled_flag_id ||
      formState.voices_enabled_flag_id ||
      formState.reasoning_levels_enabled_flag_id ||
      formState.qualities_enabled_flag_id ||
      formState.departmentIds.length > 0 ||
      formState.input_modality_ids.length > 0 ||
      formState.output_modality_ids.length > 0 ||
      formState.temperature_level_ids.length > 0 ||
      formState.reasoning_level_ids.length > 0 ||
      formState.quality_ids.length > 0 ||
      formState.pricing_ids.length > 0 ||
      formState.voice_ids.length > 0;

    if (!hasResourceIds || !patchModelDraftActionRef.current) {
      return;
    }

    // If nothing changed since the last successful patch, do nothing.
    if (lastPatchedKeyRef.current === draftPatchKey) {
      return;
    }

    const timer = setTimeout(async () => {
      try {
        if (!patchModelDraftActionRef.current) return;
        const patchAction =
          patchModelDraftActionRef.current as
            | ((input: PatchModelDraftActionInput) => Promise<PatchModelDraftOut>)
            | undefined;
        if (!patchAction) return;
        const result = await patchAction({
          body: {
            input_draft_id: draftId || null,
            name_id: formState.name_id,
            description_id: formState.description_id,
            value_id: formState.value_id,
            endpoint_id: formState.endpoint_id,
            active_flag_id: formState.active_flag_id,
            modalities_enabled_flag_id: formState.modalities_enabled_flag_id,
            temperature_enabled_flag_id: formState.temperature_enabled_flag_id,
            pricing_enabled_flag_id: formState.pricing_enabled_flag_id,
            voices_enabled_flag_id: formState.voices_enabled_flag_id,
            reasoning_levels_enabled_flag_id:
              formState.reasoning_levels_enabled_flag_id,
            qualities_enabled_flag_id: formState.qualities_enabled_flag_id,
            provider_id: formState.provider_id,
            department_ids: formState.departmentIds,
            input_modality_ids: formState.input_modality_ids,
            output_modality_ids: formState.output_modality_ids,
            temperature_level_ids: formState.temperature_level_ids,
            reasoning_level_ids: formState.reasoning_level_ids,
            quality_ids: formState.quality_ids,
            pricing_ids: formState.pricing_ids,
            voice_ids: formState.voice_ids,
            expected_version: lastSavedVersionRef.current,
          },
        });

        // Mark this payload as patched so we don't loop
        lastPatchedKeyRef.current = draftPatchKey;

        if (!draftId && result.draft_id) {
          // Update URL when draft is created via GenericForm bridge (GenericForm owns URL state)
          setUrlFormDataRef.current?.({ draftId: result.draft_id });
        }

        if ((result.new_version ?? 0) !== lastSavedVersionRef.current) {
          setLastSavedVersion(result.new_version ?? 0);
          lastSavedVersionRef.current = result.new_version ?? 0;
        }
      } catch {
        // Failed to save draft - error already logged by API
        // Don't update lastPatchedKeyRef on failure so we retry on next change
      }
    }, 1000);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftPatchKey]);

  // WebSocket handlers for AI generation - unified handler for all resource types
  useEffect(() => {
    if (!socket || !isConnected) return;

    // Use single group_id from modelData (no need to track multiple)
    const currentGroupId = modelData?.group_id;

    const handleGenerationComplete = (data: {
      artifact_type?: string;
      group_id?: string;
      resource_type?: string;
      name_id?: string | null;
      description_id?: string | null;
      value_id?: string | null;
      endpoint_id?: string | null;
      active_flag_id?: string | null;
      modalities_enabled_flag_id?: string | null;
      temperature_enabled_flag_id?: string | null;
      pricing_enabled_flag_id?: string | null;
      voices_enabled_flag_id?: string | null;
      reasoning_levels_enabled_flag_id?: string | null;
      qualities_enabled_flag_id?: string | null;
      input_modality_ids?: string[];
      output_modality_ids?: string[];
      temperature_level_ids?: string[];
      reasoning_level_ids?: string[];
      quality_ids?: string[];
      pricing_ids?: string[];
      voice_ids?: string[];
      message?: string;
      success?: boolean;
      [key: string]: unknown;
    }) => {
      // Filter by artifact_type and group_id
      if (
        data.artifact_type !== "model" ||
        !data.group_id ||
        data.group_id !== currentGroupId
      ) {
        return; // Not for this model or wrong group_id
      }

      const validResourceTypes: ResourceType[] = [
        "names",
        "descriptions",
        "flags",
        "temperature_levels",
        "reasoning_levels",
        "voices",
      ];
      if (
        data.resource_type &&
        validResourceTypes.includes(data.resource_type as ResourceType)
      ) {
        // Update formState with the resource ID that was generated
        setFormState((prev) => {
          const updates: Partial<typeof prev> = {};

          if (data.name_id) updates.name_id = data.name_id;
          if (data.description_id) updates.description_id = data.description_id;
          if (data.value_id) updates.value_id = data.value_id;
          if (data.endpoint_id) updates.endpoint_id = data.endpoint_id;
          if (data.active_flag_id) updates.active_flag_id = data.active_flag_id;
          if (data.modalities_enabled_flag_id)
            updates.modalities_enabled_flag_id =
              data.modalities_enabled_flag_id;
          if (data.temperature_enabled_flag_id)
            updates.temperature_enabled_flag_id =
              data.temperature_enabled_flag_id;
          if (data.pricing_enabled_flag_id)
            updates.pricing_enabled_flag_id = data.pricing_enabled_flag_id;
          if (data.voices_enabled_flag_id)
            updates.voices_enabled_flag_id = data.voices_enabled_flag_id;
          if (data.reasoning_levels_enabled_flag_id)
            updates.reasoning_levels_enabled_flag_id =
              data.reasoning_levels_enabled_flag_id;
          if (data.qualities_enabled_flag_id)
            updates.qualities_enabled_flag_id = data.qualities_enabled_flag_id;
          if (data.input_modality_ids && data.input_modality_ids.length > 0) {
            const newIds = data.input_modality_ids.filter(
              (id) => !prev.input_modality_ids.includes(id)
            );
            updates.input_modality_ids = [
              ...prev.input_modality_ids,
              ...newIds,
            ];
          }
          if (data.output_modality_ids && data.output_modality_ids.length > 0) {
            const newIds = data.output_modality_ids.filter(
              (id) => !prev.output_modality_ids.includes(id)
            );
            updates.output_modality_ids = [
              ...prev.output_modality_ids,
              ...newIds,
            ];
          }
          if (
            data.temperature_level_ids &&
            data.temperature_level_ids.length > 0
          ) {
            const newIds = data.temperature_level_ids.filter(
              (id) => !prev.temperature_level_ids.includes(id)
            );
            updates.temperature_level_ids = [
              ...prev.temperature_level_ids,
              ...newIds,
            ];
          }
          if (data.reasoning_level_ids && data.reasoning_level_ids.length > 0) {
            const newIds = data.reasoning_level_ids.filter(
              (id) => !prev.reasoning_level_ids.includes(id)
            );
            updates.reasoning_level_ids = [
              ...prev.reasoning_level_ids,
              ...newIds,
            ];
          }
          if (data.quality_ids && data.quality_ids.length > 0) {
            const newIds = data.quality_ids.filter(
              (id) => !prev.quality_ids.includes(id)
            );
            updates.quality_ids = [...prev.quality_ids, ...newIds];
          }
          if (data.pricing_ids && data.pricing_ids.length > 0) {
            const newIds = data.pricing_ids.filter(
              (id) => !prev.pricing_ids.includes(id)
            );
            updates.pricing_ids = [...prev.pricing_ids, ...newIds];
          }
          if (data.voice_ids && data.voice_ids.length > 0) {
            const newIds = data.voice_ids.filter(
              (id) => !prev.voice_ids.includes(id)
            );
            updates.voice_ids = [...prev.voice_ids, ...newIds];
          }

          return { ...prev, ...updates };
        });

        setGeneratingResources((prev) => {
          const next = new Set(prev);
          next.delete(data.resource_type as ResourceType);
          return next;
        });
        if (data.success) {
          toast.success(
            data.message || `${data.resource_type} generated successfully`
          );
        } else {
          toast.error(
            data.message || `Failed to generate ${data.resource_type}`
          );
        }
      }
    };

    const handleGenerationProgress = (data: {
      artifact_type?: string;
      group_id?: string;
      resource_type?: string;
      [key: string]: unknown;
    }) => {
      // Filter by artifact_type and group_id
      if (
        data.artifact_type !== "model" ||
        !data.group_id ||
        data.group_id !== currentGroupId
      ) {
        return; // Not for this model or wrong group_id
      }
      // Handle progress updates if needed
    };

    const handleGenerationError = (data: {
      artifact_type?: string;
      group_id?: string;
      message?: string;
      resource_type?: string;
      resource_types?: string[];
    }) => {
      // Filter by artifact_type and group_id
      if (
        data.artifact_type !== "model" ||
        !data.group_id ||
        data.group_id !== currentGroupId
      ) {
        return; // Not for this model or wrong group_id
      }

      const validResourceTypes: ResourceType[] = [
        "names",
        "descriptions",
        "flags",
        "temperature_levels",
        "reasoning_levels",
        "voices",
      ];
      const resourceTypes =
        data.resource_types || (data.resource_type ? [data.resource_type] : []);
      setGeneratingResources((prev) => {
        const next = new Set(prev);
        resourceTypes.forEach((rt) => {
          if (validResourceTypes.includes(rt as ResourceType)) {
            next.delete(rt as ResourceType);
          }
        });
        return next;
      });
      toast.error(data.message || "Generation failed");
    };

    // Listen to model-specific events filtered by artifact_type and group_id
    socket.on("model_generation_progress", handleGenerationProgress);
    socket.on("model_generation_complete", handleGenerationComplete);
    socket.on("model_generation_error", handleGenerationError);

    return () => {
      socket.off("model_generation_progress", handleGenerationProgress);
      socket.off("model_generation_complete", handleGenerationComplete);
      socket.off("model_generation_error", handleGenerationError);
    };
  }, [socket, isConnected, modelData?.group_id]);

  // Multi-generation handler - accepts list of resource types and optional user instructions
  // Helper function to get domain_ids from resource types
  const getDomainIds = useCallback(
    (resourceTypes: ResourceType[]): string[] => {
      if (!modelData) return [];
      const domainIdMap: Record<string, string | null | undefined> = {
        names: modelData.name_domain_id,
        descriptions: modelData.description_domain_id,
        flags: modelData.flag_domain_id,
        departments: modelData.departments_domain_id,
        temperature_levels: modelData.temperature_levels_domain_id,
        reasoning_levels: modelData.reasoning_levels_domain_id,
        voices: modelData.voices_domain_id,
      };
      return resourceTypes
        .map((rt) => domainIdMap[rt])
        .filter((id): id is string => id != null);
    },
    [modelData]
  );

  const handleGenerateResources = useCallback(
    async (
      resourceTypes: ResourceType[],
      userInstructions?: string
    ) => {
      if (!socket || !isConnected) {
        toast.error("WebSocket not connected");
        return;
      }

      // Set all resources as generating
      setGeneratingResources((prev) => {
        const next = new Set(prev);
        resourceTypes.forEach((rt) => next.add(rt));
        return next;
      });

      // Read search params from formData
      const formData = formDataRef.current;
      const draftId = (formData["draftId"] as string | undefined) ?? null;

      // Emit model_generate event
      const domainIds = getDomainIds(resourceTypes);
      socket.emit("model_generate", {
        resource_types: resourceTypes,
        domain_ids: domainIds,
        user_instructions: userInstructions ? [userInstructions] : null,
        draft_id: draftId || null,
        mcp: false,
        model_id: modelId || null,
      });
    },
    [socket, isConnected, modelId, getDomainIds]
  );

  // Individual generation handlers - generate directly without modals
  const handleGenerateName = useCallback(
    async () => handleGenerateResources(["names"]),
    [handleGenerateResources]
  );

  const handleGenerateDescription = useCallback(
    async () => handleGenerateResources(["descriptions"]),
    [handleGenerateResources]
  );

  // Disabled logic based on can_edit flag - standardized for all resource components
  // Check can_edit in both new and edit modes to show disabled_reason when agents are missing
  const disabled = useMemo(() => {
    if (!modelData) return false;
    return !modelData.can_edit;
  }, [modelData]);

  // Get department and provider arrays from resources bucket
  const departments = useMemo(() => {
    return modelData?.resources?.resources?.departments || [];
  }, [modelData?.resources?.resources?.departments]);

  const validDepartmentIds = useMemo(() => {
    return (modelData?.resources?.resources?.departments ?? [])
      .map((d) => d.department_id as string)
      .filter(Boolean);
  }, [modelData?.resources?.resources?.departments]);

  const providers = useMemo(() => {
    return modelData?.resources?.resources?.providers || [];
  }, [modelData?.resources?.resources?.providers]);

  // Set breadcrumb context when model data is loaded
  useEffect(() => {
    const modelName = modelData?.resources?.current?.names?.[0]?.name;
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
    modelData?.resources?.current?.names,
    modelId,
    isEditMode,
    setEntityMetadata,
    clearEntityMetadata,
  ]);

  // Set generation capability when model data is loaded
  // Step-to-resources mapping for multi-generation
  // Note: Some resource types may not be in ResourceType enum - using type assertions where needed
  const stepResources: Record<string, ResourceType[]> = useMemo(
    () => ({
      basic: ["names", "descriptions", "flags"],
      customUrl: [],
      provider: [],
      inputModalities: [],
      outputModalities: [],
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
      ], // All resources for full-page generation (only those in ResourceType enum)
    }),
    []
  );

  // Listen for full-page-generate event from layout
  useEffect(() => {
    const handleFullPageGenerate = (
      event: CustomEvent<{ agentId?: string }>
    ) => {
      const agentId = event.detail?.agentId;
      if (agentId) {
        // For now, generate basic resources directly
        // In future, can open modal similar to Persona pattern
        handleGenerateResources(stepResources["all"] || []);
      }
    };
    window.addEventListener(
      "full-page-generate",
      handleFullPageGenerate as EventListener
    );
    return () =>
      window.removeEventListener(
        "full-page-generate",
        handleFullPageGenerate as EventListener
      );
  }, [handleGenerateResources, stepResources]);

  // Submit handler for GenericForm (uses formState, not formData parameter)
  const handleSubmit = useCallback(
    async (_formData: Record<string, unknown>) => {
      // Validate required resource IDs using {resource}_required flags from modelData
      if (modelData?.name_required && !formState.name_id) {
        toast.error("Model name is required");
        throw new Error("Model name is required");
      }

      if (modelData?.value_required && !formState.value_id) {
        toast.error("Model value is required");
        throw new Error("Model value is required");
      }

      if (!formState.provider_id) {
        toast.error("Provider is required");
        throw new Error("Provider is required");
      }

      // Ensure profileId exists - required for API calls
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
            provider_id: formState.provider_id!,
            name_id: formState.name_id || null,
            description_id: formState.description_id || null,
            active_flag_id: formState.active_flag_id || null,
            modalities_enabled_flag_id:
              formState.modalities_enabled_flag_id || null,
            temperature_enabled_flag_id:
              formState.temperature_enabled_flag_id || null,
            pricing_enabled_flag_id: formState.pricing_enabled_flag_id || null,
            voices_enabled_flag_id: formState.voices_enabled_flag_id || null,
            reasoning_levels_enabled_flag_id:
              formState.reasoning_levels_enabled_flag_id || null,
            qualities_enabled_flag_id:
              formState.qualities_enabled_flag_id || null,
            value_id: formState.value_id || null,
            endpoint_id: formState.endpoint_id || null,
            department_ids: formState.departmentIds || null,
            input_modality_ids:
              formState.input_modality_ids.length > 0
                ? formState.input_modality_ids
                : null,
            output_modality_ids:
              formState.output_modality_ids.length > 0
                ? formState.output_modality_ids
                : null,
            temperature_level_ids:
              formState.temperature_level_ids.length > 0
                ? formState.temperature_level_ids
                : null,
            reasoning_level_ids:
              formState.reasoning_level_ids.length > 0
                ? formState.reasoning_level_ids
                : null,
            quality_ids:
              formState.quality_ids.length > 0 ? formState.quality_ids : null,
            pricing_ids:
              formState.pricing_ids.length > 0 ? formState.pricing_ids : null,
            voice_ids:
              formState.voice_ids.length > 0 ? formState.voice_ids : null,
          },
        });
        toast.success(
          `Model ${isEditMode ? "updated" : "created"} successfully!`
        );
        router.push(`/intelligence/models`);
      } catch (error) {
        toast.error(
          `Failed to ${isEditMode ? "update" : "create"} model: ${error instanceof Error ? error.message : "Unknown error"}`
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
      modelData?.name_required,
      modelData?.value_required,
    ]
  );

  // Step status logic (for GenericForm) - check resource IDs instead of display values
  const getStepStatus = useCallback(
    (stepId: string, _formData: Record<string, unknown>): StepStatus => {
      // Check resource IDs from formState (components manage their own display state)
      const hasName = !!formState.name_id;
      const hasValue = !!formState.value_id;
      const hasDescription = !!formState.description_id;
      const hasProvider = !!formState.provider_id;
      const hasEndpoint = !!formState.endpoint_id;
      const hasInputModalities = formState.input_modality_ids.length > 0;
      const hasOutputModalities = formState.output_modality_ids.length > 0;
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
        case "customUrl":
          if (!hasName || !hasValue || !hasDescription) return "pending";
          return hasEndpoint ? "completed" : "active";
        case "provider":
          if (!hasName || !hasValue || !hasDescription) return "pending";
          return hasProvider ? "completed" : "active";
        case "inputModalities":
          if (!hasName || !hasValue || !hasDescription || !hasProvider)
            return "pending";
          if (!modalities_enabled_flag_id) return "pending";
          return hasInputModalities ? "completed" : "active";
        case "outputModalities":
          if (!hasName || !hasValue || !hasDescription || !hasProvider)
            return "pending";
          if (!modalities_enabled_flag_id || !hasInputModalities)
            return "pending";
          return hasOutputModalities ? "completed" : "active";
        case "temperature":
          if (!hasName || !hasValue || !hasDescription || !hasProvider)
            return "pending";
          if (
            !modalities_enabled_flag_id ||
            !hasInputModalities ||
            !hasOutputModalities
          )
            return "pending";
          return temperature_enabled_flag_id &&
            formState.temperature_level_ids.length > 0
            ? "completed"
            : temperature_enabled_flag_id
              ? "active"
              : "pending";
        case "pricing":
          if (!hasName || !hasValue || !hasDescription || !hasProvider)
            return "pending";
          if (
            !modalities_enabled_flag_id ||
            !hasInputModalities ||
            !hasOutputModalities
          )
            return "pending";
          return pricing_enabled_flag_id && formState.pricing_ids.length > 0
            ? "completed"
            : pricing_enabled_flag_id
              ? "active"
              : "pending";
        case "reasoning":
          if (!hasName || !hasValue || !hasDescription || !hasProvider)
            return "pending";
          if (
            !modalities_enabled_flag_id ||
            !hasInputModalities ||
            !hasOutputModalities
          )
            return "pending";
          return reasoning_levels_enabled_flag_id &&
            formState.reasoning_level_ids.length > 0
            ? "completed"
            : reasoning_levels_enabled_flag_id
              ? "active"
              : "pending";
        case "voices":
          if (!hasName || !hasValue || !hasDescription || !hasProvider)
            return "pending";
          if (
            !modalities_enabled_flag_id ||
            !hasInputModalities ||
            !hasOutputModalities
          )
            return "pending";
          return voices_enabled_flag_id && formState.voice_ids.length > 0
            ? "completed"
            : voices_enabled_flag_id
              ? "active"
              : "pending";
        case "qualities":
          if (!hasName || !hasValue || !hasDescription || !hasProvider)
            return "pending";
          if (
            !modalities_enabled_flag_id ||
            !hasInputModalities ||
            !hasOutputModalities
          )
            return "pending";
          return qualities_enabled_flag_id && formState.quality_ids.length > 0
            ? "completed"
            : qualities_enabled_flag_id
              ? "active"
              : "pending";
        default:
          return "pending";
      }
    },
    [formState]
  );

  // Steps configuration for GenericForm
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
          "endpoint_id",
          "departmentSearch",
          "departmentIds",
        ],
      },
      {
        id: "customUrl",
        title: "Custom Model URL",
        description: "Configure custom base URL for this model (optional).",
        resetFields: ["endpoint_id", "endpointSearch"],
        optional: true,
      },
      {
        id: "provider",
        title: "Provider",
        description: "Select the provider for this model.",
        resetFields: ["provider_id"],
      },
      {
        id: "inputModalities",
        title: "Input Modalities",
        description: "Configure input modalities.",
        resetFields: ["input_modality_ids", "inputModalitySearch"],
      },
      {
        id: "outputModalities",
        title: "Output Modalities",
        description: "Configure output modalities.",
        resetFields: ["output_modality_ids", "outputModalitySearch"],
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
    []
  );

  // Form field keys (for GenericForm) - using resource IDs
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
      "endpoint_id",
      "provider_id",
      "departmentIds",
      "input_modality_ids",
      "output_modality_ids",
      "temperature_level_ids",
      "pricing_ids",
      "reasoning_level_ids",
      "voice_ids",
      "quality_ids",
      "descriptionSearch",
      "valueSearch",
      "endpointSearch",
      "departmentSearch",
      "inputModalitySearch",
      "outputModalitySearch",
      "temperatureSearch",
      "pricingSearch",
      "reasoningSearch",
      "voiceSearch",
      "qualitySearch",
    ],
    []
  );

  // Reset success message (for GenericForm)
  const resetSuccessMessage = useCallback((stepId: string) => {
    switch (stepId) {
      case "basic":
        return "Basic information reset";
      case "customUrl":
        return "Custom URL reset";
      case "provider":
        return "Provider reset";
      case "inputModalities":
        return "Input modalities reset";
      case "outputModalities":
        return "Output modalities reset";
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
            endpoint_id: null,
            departmentIds: [],
          };
        case "customUrl":
          return {
            ...prev,
            endpoint_id: null,
          };
        case "provider":
          return {
            ...prev,
            provider_id: null,
          };
        case "inputModalities":
          return {
            ...prev,
            input_modality_ids: [],
          };
        case "outputModalities":
          return {
            ...prev,
            output_modality_ids: [],
          };
        case "temperature":
          return {
            ...prev,
            temperature_level_ids: [],
          };
        case "pricing":
          return {
            ...prev,
            pricing_ids: [],
          };
        case "reasoning":
          return {
            ...prev,
            reasoning_level_ids: [],
          };
        case "voices":
          return {
            ...prev,
            voice_ids: [],
          };
        case "qualities":
          return {
            ...prev,
            quality_ids: [],
          };
        default:
          return prev;
      }
    });
  }, []);

  // Submit button config (for GenericForm)
  const submitButton = useMemo(
    () => ({
      backUrl: "/intelligence/models",
      backLabel: "Back",
      createLabel: "Create Model",
      updateLabel: "Update Model",
    }),
    []
  );

  // Memoize renderStep to prevent GenericForm re-renders
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
      const endpointSearch =
        (formData["endpointSearch"] as string | undefined) ?? "";
      const departmentSearch =
        (formData["departmentSearch"] as string | undefined) ?? "";
      const inputModalitySearch =
        (formData["inputModalitySearch"] as string | undefined) ?? "";
      const outputModalitySearch =
        (formData["outputModalitySearch"] as string | undefined) ?? "";
      const temperatureSearch =
        (formData["temperatureSearch"] as string | undefined) ?? "";
      const pricingSearch =
        (formData["pricingSearch"] as string | undefined) ?? "";
      const reasoningSearch =
        (formData["reasoningSearch"] as string | undefined) ?? "";
      const voiceSearch = (formData["voiceSearch"] as string | undefined) ?? "";
      const qualitySearch =
        (formData["qualitySearch"] as string | undefined) ?? "";

      // Use formState directly (components manage their own display state)
      // Pre-extract flag configs from resources bucket
      const allFlags = modelData?.resources?.resources?.flags ?? [];
      const flagConfig = (key: string) => allFlags.find((f) => f.key === key);
      const flagResource = (key: string) => {
        const cfg = flagConfig(key);
        return cfg ? {
          id: cfg.flag_option_id ?? null,
          name: cfg.label ?? null,
          description: cfg.description ?? null,
          icon: cfg.icon_id ?? null,
          generated: cfg.generated ?? null,
        } : null;
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
                  name_resource={modelData?.resources?.current?.names?.[0] ?? null}
                  show_name={modelData?.show_name ?? true}
                  name_suggestions={modelData?.name_suggestions ?? []}
                  names={modelData?.resources?.resources?.names ?? []}
                  disabled={disabled}
                  onNameIdChange={(id) =>
                    setFormState((prev) => ({ ...prev, name_id: id }))
                  }
                  onGenerate={handleGenerateName}
                  isGenerating={isGenerating("names")}
                  placeholder="e.g., GPT-4"
                  defaultName="New Model"
                  required={modelData?.name_required ?? true}
                  hideDescription={true}
                  group_id={modelData?.names_group_id ?? null}
                  create_tool_id={modelData?.name_create_tool_id ?? null}
                  link_tool_id={modelData?.name_link_tool_id ?? null}
                  showAiGenerate={modelData?.name_show_ai_generate ?? false}
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
                "endpoint_id",
                "departmentIds",
              ]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
            >
              <div className="space-y-4">
                <Descriptions
                  description_id={formState.description_id ?? null}
                  description_resource={modelData?.resources?.current?.descriptions?.[0] ?? null}
                  show_description={modelData?.show_description ?? true}
                  description_suggestions={
                    modelData?.description_suggestions ?? []
                  }
                  descriptions={modelData?.resources?.resources?.descriptions ?? []}
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
                  required={modelData?.description_required ?? false}
                  group_id={modelData?.descriptions_group_id ?? null}
                  create_tool_id={modelData?.description_create_tool_id ?? null}
                  link_tool_id={modelData?.description_link_tool_id ?? null}
                  showAiGenerate={modelData?.description_show_ai_generate ?? false}
                  createDescriptionsAction={createDescriptionsAction}
                />

                <Values
                  value_ids={formState.value_id ? [formState.value_id] : []}
                  value_resources={
                    formState.value_id && modelData?.resources?.current?.values?.[0]
                      ? [
                          {
                            value_id: modelData.resources.current.values[0].id,
                            name: modelData.resources.current.values[0].value,
                            generated: modelData.resources.current.values[0].generated,
                          },
                        ]
                      : []
                  }
                  show_values={modelData?.show_value ?? true}
                  value_suggestions={modelData?.value_suggestions ?? []}
                  values={
                    (modelData?.resources?.resources?.values ?? []).map((v) => ({
                      value_id: v.id,
                      name: v.value,
                      generated: v.generated,
                    }))
                  }
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
                  required={modelData?.value_required ?? true}
                  description="Unique identifier for this model (used in API calls)"
                  group_id={modelData?.values_group_id ?? null}
                  create_tool_id={modelData?.value_create_tool_id ?? null}
                  link_tool_id={modelData?.value_link_tool_id ?? null}
                  showAiGenerate={modelData?.value_show_ai_generate ?? false}
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
                  group_id={modelData?.flags_group_id ?? null}
                  link_tool_id={modelData?.flag_link_tool_id ?? null}
                  showAiGenerate={modelData?.flag_show_ai_generate ?? false}
                  createFlagsAction={createFlagsAction}
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
                      input_modality_ids: id ? prev.input_modality_ids : [],
                      output_modality_ids: id ? prev.output_modality_ids : [],
                    }));
                  }}
                  label="Modalities"
                  helpText="Enable input/output modalities configuration"
                  required={flagConfig("modalities_enabled")?.required ?? false}
                  group_id={modelData?.flags_group_id ?? null}
                  link_tool_id={modelData?.flag_link_tool_id ?? null}
                  showAiGenerate={modelData?.flag_show_ai_generate ?? false}
                  createFlagsAction={createFlagsAction}
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
                  required={flagConfig("temperature_enabled")?.required ?? false}
                  group_id={modelData?.flags_group_id ?? null}
                  link_tool_id={modelData?.flag_link_tool_id ?? null}
                  showAiGenerate={modelData?.flag_show_ai_generate ?? false}
                  createFlagsAction={createFlagsAction}
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
                  group_id={modelData?.flags_group_id ?? null}
                  link_tool_id={modelData?.flag_link_tool_id ?? null}
                  showAiGenerate={modelData?.flag_show_ai_generate ?? false}
                  createFlagsAction={createFlagsAction}
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
                  group_id={modelData?.flags_group_id ?? null}
                  link_tool_id={modelData?.flag_link_tool_id ?? null}
                  showAiGenerate={modelData?.flag_show_ai_generate ?? false}
                  createFlagsAction={createFlagsAction}
                />

                <Flags
                  flag_id={formState.reasoning_levels_enabled_flag_id ?? null}
                  flag_resource={flagResource("reasoning_levels_enabled")}
                  show_flag={flagConfig("reasoning_levels_enabled")?.show ?? false}
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
                  required={flagConfig("reasoning_levels_enabled")?.required ?? false}
                  group_id={modelData?.flags_group_id ?? null}
                  link_tool_id={modelData?.flag_link_tool_id ?? null}
                  showAiGenerate={modelData?.flag_show_ai_generate ?? false}
                  createFlagsAction={createFlagsAction}
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
                  group_id={modelData?.flags_group_id ?? null}
                  link_tool_id={modelData?.flag_link_tool_id ?? null}
                  showAiGenerate={modelData?.flag_show_ai_generate ?? false}
                  createFlagsAction={createFlagsAction}
                />
              </div>
            </StepCard>
          );

        case "customUrl":
          if (!formState.endpoint_id && !formState.modalities_enabled_flag_id)
            return null;
          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={disabled}
              isEditMode={isEditMode}
              searchTerm={endpointSearch}
              onSearchChange={(term) =>
                setFormData({ endpointSearch: term || null })
              }
              searchPlaceholder="Search endpoints..."
              resetFields={["endpoint_id"]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
            >
              <Endpoints
                endpoint_ids={
                  formState.endpoint_id ? [formState.endpoint_id] : []
                }
                endpoint_resources={
                  formState.endpoint_id && modelData?.resources?.current?.endpoints?.[0]
                    ? [
                        {
                          endpoint_id: modelData.resources.current.endpoints[0].id,
                          name: modelData.resources.current.endpoints[0].base_url,
                          generated: modelData.resources.current.endpoints[0].generated,
                        },
                      ]
                    : []
                }
                show_endpoints={modelData?.show_endpoint ?? true}
                endpoint_suggestions={modelData?.endpoint_suggestions ?? []}
                endpoints={
                  (modelData?.resources?.resources?.endpoints ?? []).map((e) => ({
                    endpoint_id: e.id,
                    name: e.base_url,
                    generated: e.generated,
                  }))
                }
                searchTerm={endpointSearch}
                onSearchChange={(term: string) =>
                  setFormData({ endpointSearch: term || null })
                }
                disabled={disabled}
                onChange={(ids) =>
                  setFormState({
                    ...formState,
                    endpoint_id: ids.length > 0 ? ids[0] : null,
                  })
                }
                label="Endpoint"
                placeholder="Select endpoint base URL"
                required={modelData?.endpoint_required ?? false}
                description="Custom base URL for this model"
                group_id={modelData?.endpoints_group_id ?? null}
                create_tool_id={modelData?.endpoint_create_tool_id ?? null}
                link_tool_id={modelData?.endpoint_link_tool_id ?? null}
                showAiGenerate={modelData?.endpoint_show_ai_generate ?? false}
                createEndpointsAction={createEndpointsAction}
              />
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
                    p
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
                  {} as Record<string, { name: string; description: string }>
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

        case "inputModalities":
          if (!formState.modalities_enabled_flag_id) return null;
          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={disabled}
              isEditMode={isEditMode}
              searchTerm={inputModalitySearch}
              onSearchChange={(term) =>
                setFormData({ inputModalitySearch: term || null })
              }
              searchPlaceholder="Search input modalities..."
              resetFields={["input_modality_ids"]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
            >
              <Modalities
                modality_ids={formState.input_modality_ids}
                modality_resources={
                  (modelData?.resources?.current?.input_modalities ?? []).map((m) => ({
                    modality_id: m.id,
                    name: m.modality,
                    generated: m.generated,
                  }))
                }
                show_modalities={modelData?.show_modalities ?? true}
                modality_suggestions={
                  modelData?.input_modality_suggestions ?? []
                }
                modalities={
                  (modelData?.resources?.resources?.input_modalities ?? []).map((m) => ({
                    modality_id: m.id,
                    name: m.modality,
                    generated: m.generated,
                  }))
                }
                searchTerm={inputModalitySearch}
                onSearchChange={(term: string) =>
                  setFormData({ inputModalitySearch: term || null })
                }
                disabled={disabled}
                onChange={(ids) =>
                  setFormState({ ...formState, input_modality_ids: ids })
                }
                label="Input Modalities"
                placeholder="Select input modalities"
                required={modelData?.modalities_required ?? true}
                group_id={modelData?.modalities_group_id ?? null}
                link_tool_id={modelData?.modalities_link_tool_id ?? null}
                showAiGenerate={modelData?.modalities_show_ai_generate ?? false}
                createModalitiesAction={createModalitiesAction}
              />
            </StepCard>
          );

        case "outputModalities":
          if (!formState.modalities_enabled_flag_id) return null;
          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={disabled}
              isEditMode={isEditMode}
              searchTerm={outputModalitySearch}
              onSearchChange={(term) =>
                setFormData({ outputModalitySearch: term || null })
              }
              searchPlaceholder="Search output modalities..."
              resetFields={["output_modality_ids"]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
            >
              <Modalities
                modality_ids={formState.output_modality_ids}
                modality_resources={
                  (modelData?.resources?.current?.output_modalities ?? []).map((m) => ({
                    modality_id: m.id,
                    name: m.modality,
                    generated: m.generated,
                  }))
                }
                show_modalities={modelData?.show_modalities ?? true}
                modality_suggestions={
                  modelData?.output_modality_suggestions ?? []
                }
                modalities={
                  (modelData?.resources?.resources?.output_modalities ?? []).map((m) => ({
                    modality_id: m.id,
                    name: m.modality,
                    generated: m.generated,
                  }))
                }
                searchTerm={outputModalitySearch}
                onSearchChange={(term: string) =>
                  setFormData({ outputModalitySearch: term || null })
                }
                disabled={disabled}
                onChange={(ids) =>
                  setFormState({ ...formState, output_modality_ids: ids })
                }
                label="Output Modalities"
                placeholder="Select output modalities"
                required={modelData?.modalities_required ?? true}
                group_id={modelData?.modalities_group_id ?? null}
                link_tool_id={modelData?.modalities_link_tool_id ?? null}
                showAiGenerate={modelData?.modalities_show_ai_generate ?? false}
                createModalitiesAction={createModalitiesAction}
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
                  modelData?.resources?.current?.temperature_levels?.[0]
                    ? {
                        id: modelData.resources.current.temperature_levels[0].id,
                        temperature: String(
                          modelData.resources.current.temperature_levels[0].temperature
                        ),
                        is_upper:
                          modelData.resources.current.temperature_levels[0].is_upper,
                        generated:
                          modelData.resources.current.temperature_levels[0].generated,
                      }
                    : null
                }
                show_temperature_levels={
                  modelData?.show_temperature_levels ?? true
                }
                temperature_level_suggestions={
                  modelData?.temperature_level_suggestions ?? []
                }
                temperature_levels={
                  (modelData?.resources?.resources?.temperature_levels ?? []).map((t) => ({
                    id: t.id,
                    temperature: String(t.temperature),
                    is_upper: t.is_upper,
                    generated: t.generated,
                  }))
                }
                searchTerm={temperatureSearch}
                onSearchChange={(term: string) =>
                  setFormData({ temperatureSearch: term || null })
                }
                disabled={disabled}
                onTemperatureLevelIdChange={(id) =>
                  setFormState({
                    ...formState,
                    temperature_level_ids: (id ?? null) ? [id] : [],
                  })
                }
                label="Temperature Levels"
                placeholder="Select temperature levels"
                required={modelData?.temperature_levels_required ?? false}
                group_id={modelData?.temperature_levels_group_id ?? null}
                link_tool_id={modelData?.temperature_levels_link_tool_id ?? null}
                showAiGenerate={modelData?.temperature_levels_show_ai_generate ?? false}
                createTemperatureLevelsAction={createTemperatureLevelsAction}
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
                pricing_resources={
                  (modelData?.resources?.current?.pricing ?? []).map((p) => ({
                    pricing_id: p.id,
                    name: `${p.pricing_type}`,
                    description: `${p.price}`,
                    generated: p.generated,
                  }))
                }
                show_pricing={modelData?.show_pricing ?? true}
                pricing_suggestions={modelData?.pricing_suggestions ?? []}
                pricings={
                  (modelData?.resources?.resources?.pricing ?? []).map((p) => ({
                    pricing_id: p.id,
                    name: `${p.pricing_type}`,
                    description: `${p.price}`,
                    generated: p.generated,
                  }))
                }
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
                required={modelData?.pricing_required ?? false}
                group_id={modelData?.pricing_group_id ?? null}
                link_tool_id={modelData?.pricing_link_tool_id ?? null}
                showAiGenerate={modelData?.pricing_show_ai_generate ?? false}
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
                  modelData?.resources?.current?.reasoning_levels?.[0]
                    ? {
                        id: modelData.resources.current.reasoning_levels[0].id,
                        reasoning_level:
                          modelData.resources.current.reasoning_levels[0]
                            .reasoning_level,
                        generated:
                          modelData.resources.current.reasoning_levels[0].generated,
                      }
                    : null
                }
                show_reasoning_levels={modelData?.show_reasoning_levels ?? true}
                reasoning_level_suggestions={
                  modelData?.reasoning_level_suggestions ?? []
                }
                reasoning_levels={
                  (modelData?.resources?.resources?.reasoning_levels ?? []).map((r) => ({
                    id: r.id,
                    reasoning_level: r.reasoning_level,
                    generated: r.generated,
                  }))
                }
                searchTerm={reasoningSearch}
                onSearchChange={(term: string) =>
                  setFormData({ reasoningSearch: term || null })
                }
                disabled={disabled}
                onReasoningLevelIdChange={(id) =>
                  setFormState({
                    ...formState,
                    reasoning_level_ids: (id ?? null) ? [id] : [],
                  })
                }
                label="Reasoning Levels"
                placeholder="Select reasoning levels"
                required={modelData?.reasoning_levels_required ?? false}
                group_id={modelData?.reasoning_levels_group_id ?? null}
                link_tool_id={modelData?.reasoning_levels_link_tool_id ?? null}
                showAiGenerate={modelData?.reasoning_levels_show_ai_generate ?? false}
                createReasoningLevelsAction={createReasoningLevelsAction}
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
                voice_resources={modelData?.resources?.current?.voices ?? []}
                show_voices={modelData?.show_voices ?? true}
                voice_suggestions={modelData?.voice_suggestions ?? []}
                voices={modelData?.resources?.resources?.voices ?? []}
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
                required={modelData?.voices_required ?? false}
                group_id={modelData?.voices_group_id ?? null}
                link_tool_id={modelData?.voices_link_tool_id ?? null}
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
                quality_resources={
                  (modelData?.resources?.current?.qualities ?? []).map((q) => ({
                    quality_id: q.id,
                    name: q.quality,
                    generated: q.generated,
                  }))
                }
                show_qualities={modelData?.show_qualities ?? true}
                quality_suggestions={modelData?.quality_suggestions ?? []}
                qualities={
                  (modelData?.resources?.resources?.qualities ?? []).map((q) => ({
                    quality_id: q.id,
                    name: q.quality,
                    generated: q.generated,
                  }))
                }
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
                required={modelData?.qualities_required ?? false}
                group_id={modelData?.qualities_group_id ?? null}
                link_tool_id={modelData?.qualities_link_tool_id ?? null}
                showAiGenerate={modelData?.qualities_show_ai_generate ?? false}
                createQualitiesAction={createQualitiesAction}
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
      modelData,
      handleGenerateName,
      handleGenerateDescription,
      isGenerating,
      createNamesAction,
      createDescriptionsAction,
      createValuesAction,
      createEndpointsAction,
      createFlagsAction,
      createModalitiesAction,
      createTemperatureLevelsAction,
      createReasoningLevelsAction,
      createPricingAction,
      createVoicesAction,
      createQualitiesAction,
    ]
  );

  return (
    <div className="w-full p-6 space-y-8">
      <ReadOnlyBanner
        disabled={disabled}
        disabledReason={modelData?.disabled_reason ?? null}
        entityType="model"
      />
      <GenericForm
        nuqsParsers={modelSearchParamsClient as Record<string, Parser<unknown>>}
        steps={steps}
        getStepStatus={getStepStatus}
        serverData={modelData}
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

// Memoize component to prevent re-renders when only prop references change (content is same)
export default React.memo(ModelComponent, (prevProps, nextProps) => {
  const prevModelData = prevProps.modelDetail ?? prevProps.modelDetailDefault;
  const nextModelData = nextProps.modelDetail ?? nextProps.modelDetailDefault;

  if (prevProps.modelId !== nextProps.modelId) return false;

  // Compare by resources reference
  if (
    JSON.stringify(prevModelData?.resources) !==
    JSON.stringify(nextModelData?.resources)
  ) {
    return false; // Resources changed, re-render
  }

  return true; // Props unchanged, skip re-render
});
