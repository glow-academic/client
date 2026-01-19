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
import { Flags } from "@/components/resources/Flags";
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
import { useGenerationContext } from "@/contexts/generation-context";
import { useProfile } from "@/contexts/profile-context";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { ResourceType } from "@/lib/resources/types";
import { getDefaultDepartmentIds } from "@/utils/department-picker-helpers";
import { parseAsString, type Parser } from "nuqs";

// Types defined inline using InputOf/OutputOf
type SaveModelIn = InputOf<"/api/v4/models/save", "post">;
type SaveModelOut = OutputOf<"/api/v4/models/save", "post">;
type PatchModelDraftIn = InputOf<"/api/v4/models/draft", "patch">;
type PatchModelDraftOut = OutputOf<"/api/v4/models/draft", "patch">;

type ModelData = OutputOf<"/api/v4/models/get", "post">;

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
}

function ModelComponent({
  modelId,
  modelDetailDefault,
  modelDetail: serverModelDetail,
  saveModelAction,
  patchModelDraftAction,
}: ModelProps) {
  const router = useRouter();
  const isEditMode = !!modelId;
  const {
    effectiveProfile,
    selectedDraftId,
    setSelectedDraftId,
    socket,
    isConnected,
  } = useProfile();
  const { setEntityMetadata, clearEntityMetadata } = useBreadcrumbContext();
  const { setGenerationCapability, clearGenerationCapability } =
    useGenerationContext();

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

  const isSuperadmin = effectiveProfile?.role === "superadmin";
  const defaultDepartmentIds = useMemo(
    () =>
      getDefaultDepartmentIds(
        isSuperadmin,
        effectiveProfile?.primary_department_id || null
      ),
    [isSuperadmin, effectiveProfile?.primary_department_id]
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
    // Extract resource IDs from server data
    // Note: Server data may have display values, but we only store IDs here
    return {
      name_id: data.name_id ?? null,
      description_id: data.description_id ?? null,
      value_id: data.value_id ?? null,
      endpoint_id: data.endpoint_id ?? null,
      provider_id: data.provider_id ?? null,
      active_flag_id: data.active_flag_id ?? null,
      modalities_enabled_flag_id: data.modalities_enabled_flag_id ?? null,
      temperature_enabled_flag_id: data.temperature_enabled_flag_id ?? null,
      pricing_enabled_flag_id: data.pricing_enabled_flag_id ?? null,
      voices_enabled_flag_id: data.voices_enabled_flag_id ?? null,
      reasoning_levels_enabled_flag_id:
        data.reasoning_levels_enabled_flag_id ?? null,
      qualities_enabled_flag_id: data.qualities_enabled_flag_id ?? null,
      input_modality_ids: data.input_modality_ids ?? [],
      output_modality_ids: data.output_modality_ids ?? [],
      temperature_level_ids: data.temperature_level_ids ?? [],
      reasoning_level_ids: data.reasoning_level_ids ?? [],
      quality_ids: data.quality_ids ?? [],
      pricing_ids: data.pricing_ids ?? [],
      voice_ids: data.voice_ids ?? [],
      departmentIds: data.department_ids ?? defaultDepartmentIds,
    };
  }, [defaultDepartmentIds]);

  const [formState, setFormState] = useState(getInitialFormState);
  // Use ref to access formState in renderStep without depending on it
  const formStateRef = React.useRef(formState);
  React.useEffect(() => {
    formStateRef.current = formState;
  }, [formState]);

  // Memoize stringified array dependencies to prevent effect from running when array references change but content is same
  const departmentIdsStr = React.useMemo(
    () => JSON.stringify(modelData?.department_ids ?? []),
    [modelData?.department_ids]
  );
  const inputModalityIdsStr = React.useMemo(
    () => JSON.stringify(modelData?.input_modality_ids ?? []),
    [modelData?.input_modality_ids]
  );
  const outputModalityIdsStr = React.useMemo(
    () => JSON.stringify(modelData?.output_modality_ids ?? []),
    [modelData?.output_modality_ids]
  );
  const temperatureLevelIdsStr = React.useMemo(
    () => JSON.stringify(modelData?.temperature_level_ids ?? []),
    [modelData?.temperature_level_ids]
  );
  const reasoningLevelIdsStr = React.useMemo(
    () => JSON.stringify(modelData?.reasoning_level_ids ?? []),
    [modelData?.reasoning_level_ids]
  );
  const qualityIdsStr = React.useMemo(
    () => JSON.stringify(modelData?.quality_ids ?? []),
    [modelData?.quality_ids]
  );
  const pricingIdsStr = React.useMemo(
    () => JSON.stringify(modelData?.pricing_ids ?? []),
    [modelData?.pricing_ids]
  );
  const voiceIdsStr = React.useMemo(
    () => JSON.stringify(modelData?.voice_ids ?? []),
    [modelData?.voice_ids]
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
    modelData?.name_id,
    modelData?.description_id,
    modelData?.value_id,
    modelData?.endpoint_id,
    modelData?.provider_id,
    modelData?.active_flag_id,
    modelData?.modalities_enabled_flag_id,
    modelData?.temperature_enabled_flag_id,
    modelData?.pricing_enabled_flag_id,
    modelData?.voices_enabled_flag_id,
    modelData?.reasoning_levels_enabled_flag_id,
    modelData?.qualities_enabled_flag_id,
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
        // Note: SQL function only accepts name_id, description_id, active_flag_id, provider_id
        // Other fields will need to be added to SQL function in future
        const result = await patchModelDraftActionRef.current({
          body: {
            input_draft_id: draftId || null,
            name_id: formState.name_id,
            description_id: formState.description_id,
            active_flag_id: formState.active_flag_id,
            provider_id: formState.provider_id,
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
  // Helper function to determine agent_type from resource types
  const determineAgentType = useCallback(
    (resourceTypes: ResourceType[]): string | null => {
      // For models, we can use a general agent or specific agent types
      // This is a simplified version - adjust based on actual model agent structure
      if (resourceTypes.length === 1) {
        const agentTypeMap: Partial<Record<ResourceType, string>> = {
          names: "name",
          descriptions: "description",
          flags: "flags",
          temperature_levels: "temperature_levels",
          reasoning_levels: "reasoning_levels",
          voices: "voices",
        };
        const firstType = resourceTypes[0];
        if (firstType && firstType in agentTypeMap) {
          return agentTypeMap[firstType] ?? null;
        }
      }
      return "general";
    },
    []
  );

  const handleGenerateResources = useCallback(
    async (
      resourceTypes: ResourceType[],
      agentType: string | null,
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
      socket.emit("model_generate", {
        resource_types: resourceTypes,
        agent_type: agentType,
        user_instructions: userInstructions ? [userInstructions] : null,
        draft_id: draftId || null,
        mcp: false,
        model_id: modelId || null,
      });
    },
    [socket, isConnected, modelId]
  );

  // Individual generation handlers - generate directly without modals
  const handleGenerateName = useCallback(
    async () =>
      handleGenerateResources(["names"], determineAgentType(["names"])),
    [handleGenerateResources, determineAgentType]
  );

  const handleGenerateDescription = useCallback(
    async () =>
      handleGenerateResources(
        ["descriptions"],
        determineAgentType(["descriptions"])
      ),
    [handleGenerateResources, determineAgentType]
  );

  // Disabled logic based on can_edit flag - standardized for all resource components
  // Check can_edit in both new and edit modes to show disabled_reason when agents are missing
  const disabled = useMemo(() => {
    if (!modelData) return false;
    return !modelData.can_edit;
  }, [modelData]);

  // Get department and provider arrays
  const departments = useMemo(() => {
    return modelData?.departments || [];
  }, [modelData]);

  const validDepartmentIds = useMemo(() => {
    // API returns department_ids, not valid_department_ids
    // Use department_ids if available, otherwise empty array
    return modelData?.department_ids || [];
  }, [modelData]);

  const providers = useMemo(() => {
    return modelData?.providers || [];
  }, [modelData]);

  // Set breadcrumb context when model data is loaded
  useEffect(() => {
    const modelName = modelData?.name_resource?.name;
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
    modelData?.name_resource?.name,
    modelId,
    isEditMode,
    setEntityMetadata,
    clearEntityMetadata,
  ]);

  // Set generation capability when model data is loaded
  useEffect(() => {
    // Note: models may not have general_agent_id - check for alternative agent ID field
    // For now, check if any agent_id exists to enable generation
    const hasAgentId =
      modelData?.name_agent_id ||
      modelData?.description_agent_id ||
      modelData?.value_agent_id;
    if (hasAgentId) {
      setGenerationCapability({
        artifactType: "model",
        canGenerate: true,
        agentId: modelData?.name_agent_id || null,
      });
    } else {
      setGenerationCapability({
        artifactType: "model",
        canGenerate: false,
        agentId: null,
      });
    }
    return () => clearGenerationCapability();
  }, [
    modelData?.name_agent_id,
    modelData?.description_agent_id,
    modelData?.value_agent_id,
    setGenerationCapability,
    clearGenerationCapability,
  ]);

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
    const handleFullPageGenerate = () => {
      const hasAgentId =
        modelData?.name_agent_id ||
        modelData?.description_agent_id ||
        modelData?.value_agent_id;
      if (hasAgentId) {
        // For now, generate basic resources directly
        // In future, can open modal similar to Persona pattern
        handleGenerateResources(
          stepResources["all"] || [],
          determineAgentType(stepResources["all"] || [])
        );
      }
    };
    window.addEventListener("full-page-generate", handleFullPageGenerate);
    return () =>
      window.removeEventListener("full-page-generate", handleFullPageGenerate);
  }, [
    modelData?.name_agent_id,
    modelData?.description_agent_id,
    modelData?.value_agent_id,
    handleGenerateResources,
    stepResources,
    determineAgentType,
  ]);

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
      if (!effectiveProfile?.id) {
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
        router.push(`/engine/models`);
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
      effectiveProfile?.id,
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
        ],
      },
      {
        id: "customUrl",
        title: "Custom Model URL",
        description: "Configure custom base URL for this model (optional).",
        resetFields: ["endpoint_id"],
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
        resetFields: ["input_modality_ids"],
      },
      {
        id: "outputModalities",
        title: "Output Modalities",
        description: "Configure output modalities.",
        resetFields: ["output_modality_ids"],
      },
      {
        id: "temperature",
        title: "Temperature",
        description: "Configure temperature levels (optional).",
        resetFields: ["temperature_level_ids"],
        optional: true,
      },
      {
        id: "pricing",
        title: "Pricing",
        description: "Configure pricing for this model (optional).",
        resetFields: ["pricing_ids"],
        optional: true,
      },
      {
        id: "reasoning",
        title: "Reasoning Levels",
        description: "Select reasoning levels (optional).",
        resetFields: ["reasoning_level_ids"],
        optional: true,
      },
      {
        id: "voices",
        title: "Voices",
        description: "Select voices (optional).",
        resetFields: ["voice_ids"],
        optional: true,
      },
      {
        id: "qualities",
        title: "Qualities",
        description: "Select qualities (optional).",
        resetFields: ["quality_ids"],
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

  // Submit button config (for GenericForm)
  const submitButton = useMemo(
    () => ({
      backUrl: "/engine/models",
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
      formData: _stepFormData,
      setFormData: _setStepFormData,
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
      // Use formState directly (components manage their own display state)
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
                  name_resource={modelData?.name_resource ?? null}
                  show_name={modelData?.show_name ?? true}
                  name_suggestions={modelData?.name_suggestions ?? []}
                  names={modelData?.names ?? []}
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
                  group_id={modelData?.group_id ?? null}
                  agent_id={modelData?.name_agent_id ?? null}
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
                  description_resource={modelData?.description_resource ?? null}
                  show_description={modelData?.show_description ?? true}
                  description_suggestions={
                    modelData?.description_suggestions ?? []
                  }
                  descriptions={modelData?.descriptions ?? []}
                  disabled={disabled}
                  onDescriptionIdChange={(id) =>
                    setFormState((prev) => ({ ...prev, description_id: id }))
                  }
                  onGenerate={handleGenerateDescription}
                  isGenerating={isGenerating("descriptions")}
                  placeholder="Enter a brief description"
                  required={modelData?.description_required ?? false}
                  group_id={modelData?.group_id ?? null}
                  agent_id={modelData?.description_agent_id ?? null}
                />

                <Values
                  value_ids={formState.value_id ? [formState.value_id] : []}
                  value_resources={
                    formState.value_id && modelData?.value_resource
                      ? [
                          {
                            value_id: modelData.value_resource.id,
                            name: modelData.value_resource.value,
                            generated: modelData.value_resource.generated,
                          },
                        ]
                      : []
                  }
                  show_values={modelData?.show_value ?? true}
                  value_suggestions={modelData?.value_suggestions ?? []}
                  values={
                    (
                      modelData as {
                        values?: Array<{
                          id: string | null;
                          value: string | null;
                          generated: boolean | null;
                        }>;
                      }
                    )?.values?.map((v) => ({
                      value_id: v.id,
                      name: v.value,
                      generated: v.generated,
                    })) ?? []
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
                  group_id={modelData?.group_id ?? null}
                  agent_id={modelData?.value_agent_id ?? null}
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
                  flag_resource={modelData?.flag_resource ?? null}
                  show_flag={modelData?.show_flag ?? false}
                  disabled={disabled}
                  onFlagIdChange={(id) =>
                    setFormState((prev) => ({ ...prev, active_flag_id: id }))
                  }
                  label="Active"
                  helpText="Inactive models will not be available for selection"
                  required={modelData?.flag_required ?? false}
                  group_id={modelData?.group_id ?? null}
                  agent_id={modelData?.flag_agent_id ?? null}
                />

                <Flags
                  flag_id={formState.modalities_enabled_flag_id ?? null}
                  flag_resource={
                    modelData?.modalities_enabled_flag_resource ?? null
                  }
                  show_flag={modelData?.show_modalities_enabled_flag ?? false}
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
                  required={
                    modelData?.modalities_enabled_flag_required ?? false
                  }
                  group_id={modelData?.group_id ?? null}
                  agent_id={modelData?.modalities_enabled_flag_agent_id ?? null}
                />

                <Flags
                  flag_id={formState.temperature_enabled_flag_id ?? null}
                  flag_resource={
                    modelData?.temperature_enabled_flag_resource ?? null
                  }
                  show_flag={modelData?.show_temperature_enabled_flag ?? false}
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
                    modelData?.temperature_enabled_flag_required ?? false
                  }
                  group_id={modelData?.group_id ?? null}
                  agent_id={
                    modelData?.temperature_enabled_flag_agent_id ?? null
                  }
                />

                <Flags
                  flag_id={formState.pricing_enabled_flag_id ?? null}
                  flag_resource={
                    modelData?.pricing_enabled_flag_resource ?? null
                  }
                  show_flag={modelData?.show_pricing_enabled_flag ?? false}
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
                  required={modelData?.pricing_enabled_flag_required ?? false}
                  group_id={modelData?.group_id ?? null}
                  agent_id={modelData?.pricing_enabled_flag_agent_id ?? null}
                />

                <Flags
                  flag_id={formState.voices_enabled_flag_id ?? null}
                  flag_resource={
                    modelData?.voices_enabled_flag_resource ?? null
                  }
                  show_flag={modelData?.show_voices_enabled_flag ?? false}
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
                  required={modelData?.voices_enabled_flag_required ?? false}
                  group_id={modelData?.group_id ?? null}
                  agent_id={modelData?.voices_enabled_flag_agent_id ?? null}
                />

                <Flags
                  flag_id={formState.reasoning_levels_enabled_flag_id ?? null}
                  flag_resource={
                    modelData?.reasoning_levels_enabled_flag_resource ?? null
                  }
                  show_flag={
                    modelData?.show_reasoning_levels_enabled_flag ?? false
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
                    modelData?.reasoning_levels_enabled_flag_required ?? false
                  }
                  group_id={modelData?.group_id ?? null}
                  agent_id={
                    modelData?.reasoning_levels_enabled_flag_agent_id ?? null
                  }
                />

                <Flags
                  flag_id={formState.qualities_enabled_flag_id ?? null}
                  flag_resource={
                    modelData?.qualities_enabled_flag_resource ?? null
                  }
                  show_flag={modelData?.show_qualities_enabled_flag ?? false}
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
                  required={modelData?.qualities_enabled_flag_required ?? false}
                  group_id={modelData?.group_id ?? null}
                  agent_id={modelData?.qualities_enabled_flag_agent_id ?? null}
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
              resetFields={["endpoint_id"]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
            >
              <Endpoints
                endpoint_ids={
                  formState.endpoint_id ? [formState.endpoint_id] : []
                }
                endpoint_resources={
                  formState.endpoint_id && modelData?.endpoint_resource
                    ? [
                        {
                          endpoint_id: modelData.endpoint_resource.id,
                          name: modelData.endpoint_resource.base_url,
                          generated: modelData.endpoint_resource.generated,
                        },
                      ]
                    : []
                }
                show_endpoints={modelData?.show_endpoint ?? true}
                endpoint_suggestions={modelData?.endpoint_suggestions ?? []}
                endpoints={
                  modelData?.endpoints?.map((e) => ({
                    endpoint_id: e.id,
                    name: e.base_url,
                    generated: e.generated,
                  })) ?? []
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
                group_id={modelData?.group_id ?? null}
                agent_id={modelData?.endpoint_agent_id ?? null}
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
              resetFields={["input_modality_ids"]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
            >
              <Modalities
                modality_ids={formState.input_modality_ids}
                modality_resources={
                  modelData?.input_modality_resources?.map((m) => ({
                    modality_id: m.modality_id,
                    name: m.modality,
                    generated: m.generated,
                  })) ?? []
                }
                show_modalities={modelData?.show_input_modalities ?? true}
                modality_suggestions={
                  modelData?.input_modality_suggestions ?? []
                }
                modalities={
                  modelData?.input_modalities?.map((m) => ({
                    modality_id: m.modality_id,
                    name: m.modality,
                    generated: m.generated,
                  })) ?? []
                }
                disabled={disabled}
                onChange={(ids) =>
                  setFormState({ ...formState, input_modality_ids: ids })
                }
                label="Input Modalities"
                placeholder="Select input modalities"
                required={modelData?.input_modalities_required ?? true}
                group_id={modelData?.group_id ?? null}
                agent_id={modelData?.input_modalities_agent_id ?? null}
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
              resetFields={["output_modality_ids"]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
            >
              <Modalities
                modality_ids={formState.output_modality_ids}
                modality_resources={
                  modelData?.output_modality_resources?.map((m) => ({
                    modality_id: m.modality_id,
                    name: m.modality,
                    generated: m.generated,
                  })) ?? []
                }
                show_modalities={modelData?.show_output_modalities ?? true}
                modality_suggestions={
                  modelData?.output_modality_suggestions ?? []
                }
                modalities={
                  modelData?.output_modalities?.map((m) => ({
                    modality_id: m.modality_id,
                    name: m.modality,
                    generated: m.generated,
                  })) ?? []
                }
                disabled={disabled}
                onChange={(ids) =>
                  setFormState({ ...formState, output_modality_ids: ids })
                }
                label="Output Modalities"
                placeholder="Select output modalities"
                required={modelData?.output_modalities_required ?? true}
                group_id={modelData?.group_id ?? null}
                agent_id={modelData?.output_modalities_agent_id ?? null}
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
                  modelData?.temperature_level_resources?.[0]
                    ? {
                        id: modelData.temperature_level_resources[0]
                          .temperature_level_id,
                        temperature: String(
                          modelData.temperature_level_resources[0].temperature
                        ),
                        is_upper:
                          modelData.temperature_level_resources[0].is_upper,
                        generated:
                          modelData.temperature_level_resources[0].generated,
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
                  modelData?.temperature_levels?.map((t) => ({
                    id: t.temperature_level_id,
                    temperature: String(t.temperature),
                    is_upper: t.is_upper,
                    generated: t.generated,
                  })) ?? []
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
                group_id={modelData?.group_id ?? null}
                agent_id={modelData?.temperature_levels_agent_id ?? null}
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
              resetFields={["pricing_ids"]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
            >
              <Pricing
                pricing_ids={formState.pricing_ids}
                pricing_resources={
                  modelData?.pricing_resources?.map((p) => ({
                    pricing_id: p.pricing_id,
                    name: `${p.pricing_type} - ${p.unit_name}`,
                    description: `${p.price} per ${p.unit_name}`,
                    generated: p.generated,
                  })) ?? []
                }
                show_pricing={modelData?.show_pricing ?? true}
                pricing_suggestions={modelData?.pricing_suggestions ?? []}
                pricings={
                  modelData?.pricings?.map((p) => ({
                    pricing_id: p.pricing_id,
                    name: `${p.pricing_type} - ${p.unit_name}`,
                    description: `${p.price} per ${p.unit_name}`,
                    generated: p.generated,
                  })) ?? []
                }
                disabled={disabled}
                onChange={(ids) =>
                  setFormState({ ...formState, pricing_ids: ids })
                }
                label="Pricing"
                placeholder="Select pricing configurations"
                required={modelData?.pricing_required ?? false}
                group_id={modelData?.group_id ?? null}
                agent_id={modelData?.pricing_agent_id ?? null}
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
                  modelData?.reasoning_level_resources?.[0]
                    ? {
                        id: modelData.reasoning_level_resources[0]
                          .reasoning_level_id,
                        reasoning_level:
                          modelData.reasoning_level_resources[0]
                            .reasoning_level,
                        generated:
                          modelData.reasoning_level_resources[0].generated,
                      }
                    : null
                }
                show_reasoning_levels={modelData?.show_reasoning_levels ?? true}
                reasoning_level_suggestions={
                  modelData?.reasoning_level_suggestions ?? []
                }
                reasoning_levels={
                  modelData?.reasoning_levels?.map((r) => ({
                    id: r.reasoning_level_id,
                    reasoning_level: r.reasoning_level,
                    generated: r.generated,
                  })) ?? []
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
                group_id={modelData?.group_id ?? null}
                agent_id={modelData?.reasoning_levels_agent_id ?? null}
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
              resetFields={["voice_ids"]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
            >
              <Voices
                voice_ids={formState.voice_ids}
                voice_resources={modelData?.voice_resources ?? []}
                show_voices={modelData?.show_voices ?? true}
                voice_suggestions={modelData?.voice_suggestions ?? []}
                voices={modelData?.voices ?? []}
                disabled={disabled}
                onVoiceIdsChange={(ids) =>
                  setFormState({ ...formState, voice_ids: ids })
                }
                label="Voices"
                placeholder="Select voices"
                required={modelData?.voices_required ?? false}
                group_id={modelData?.group_id ?? null}
                agent_id={modelData?.voices_agent_id ?? null}
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
              resetFields={["quality_ids"]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
            >
              <Qualities
                quality_ids={formState.quality_ids}
                quality_resources={
                  modelData?.quality_resources?.map((q) => ({
                    quality_id: q.quality_id,
                    name: q.quality,
                    generated: q.generated,
                  })) ?? []
                }
                show_qualities={modelData?.show_qualities ?? true}
                quality_suggestions={modelData?.quality_suggestions ?? []}
                qualities={
                  modelData?.qualities?.map((q) => ({
                    quality_id: q.quality_id,
                    name: q.quality,
                    generated: q.generated,
                  })) ?? []
                }
                disabled={disabled}
                onChange={(ids) =>
                  setFormState({ ...formState, quality_ids: ids })
                }
                label="Qualities"
                placeholder="Select quality levels"
                required={modelData?.qualities_required ?? false}
                group_id={modelData?.group_id ?? null}
                agent_id={modelData?.qualities_agent_id ?? null}
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
  // Compare by resource IDs, not object references
  const prevModelData = prevProps.modelDetail ?? prevProps.modelDetailDefault;
  const nextModelData = nextProps.modelDetail ?? nextProps.modelDetailDefault;
  const prevIds = {
    name_id: prevModelData?.name_id,
    description_id: prevModelData?.description_id,
    value_id: prevModelData?.value_id,
    endpoint_id: prevModelData?.endpoint_id,
    provider_id: prevModelData?.provider_id,
    active_flag_id: prevModelData?.active_flag_id,
    modalities_enabled_flag_id: prevModelData?.modalities_enabled_flag_id,
    temperature_enabled_flag_id: prevModelData?.temperature_enabled_flag_id,
    pricing_enabled_flag_id: prevModelData?.pricing_enabled_flag_id,
    voices_enabled_flag_id: prevModelData?.voices_enabled_flag_id,
    reasoning_levels_enabled_flag_id:
      prevModelData?.reasoning_levels_enabled_flag_id,
    qualities_enabled_flag_id: prevModelData?.qualities_enabled_flag_id,
    input_modality_ids: prevModelData?.input_modality_ids,
    output_modality_ids: prevModelData?.output_modality_ids,
    temperature_level_ids: prevModelData?.temperature_level_ids,
    reasoning_level_ids: prevModelData?.reasoning_level_ids,
    quality_ids: prevModelData?.quality_ids,
    pricing_ids: prevModelData?.pricing_ids,
    voice_ids: prevModelData?.voice_ids,
    department_ids: prevModelData?.department_ids,
  };
  const nextIds = {
    name_id: nextModelData?.name_id,
    description_id: nextModelData?.description_id,
    value_id: nextModelData?.value_id,
    endpoint_id: nextModelData?.endpoint_id,
    provider_id: nextModelData?.provider_id,
    active_flag_id: nextModelData?.active_flag_id,
    modalities_enabled_flag_id: nextModelData?.modalities_enabled_flag_id,
    temperature_enabled_flag_id: nextModelData?.temperature_enabled_flag_id,
    pricing_enabled_flag_id: nextModelData?.pricing_enabled_flag_id,
    voices_enabled_flag_id: nextModelData?.voices_enabled_flag_id,
    reasoning_levels_enabled_flag_id:
      nextModelData?.reasoning_levels_enabled_flag_id,
    qualities_enabled_flag_id: nextModelData?.qualities_enabled_flag_id,
    input_modality_ids: nextModelData?.input_modality_ids,
    output_modality_ids: nextModelData?.output_modality_ids,
    temperature_level_ids: nextModelData?.temperature_level_ids,
    reasoning_level_ids: nextModelData?.reasoning_level_ids,
    quality_ids: nextModelData?.quality_ids,
    pricing_ids: nextModelData?.pricing_ids,
    voice_ids: nextModelData?.voice_ids,
    department_ids: nextModelData?.department_ids,
  };

  // Compare primitive props
  if (
    prevProps.modelId !== nextProps.modelId ||
    JSON.stringify(prevIds) !== JSON.stringify(nextIds)
  ) {
    return false; // Props changed, re-render
  }

  return true; // Props unchanged, skip re-render
});
