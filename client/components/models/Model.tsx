/**
 * Model.tsx
 * Used to create and manage models for the admin dashboard
 * @AshokSaravanan222 & @siladiea
 * 06/18/2025
 */
"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

// UI Components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import {
  GenericForm,
  type StepStatus,
} from "@/components/common/forms/GenericForm";
import { GenericPicker } from "@/components/common/forms/GenericPicker";
import { StepCard } from "@/components/common/forms/StepCard";
import { Names } from "@/components/resources/Names";
import { Descriptions } from "@/components/resources/Descriptions";
import { Flags } from "@/components/resources/Flags";
import { Values } from "@/components/resources/Values";
import { Endpoints } from "@/components/resources/Endpoints";
import { Modalities } from "@/components/resources/Modalities";
import { TemperatureLevels } from "@/components/resources/TemperatureLevels";
import { ReasoningLevels } from "@/components/resources/ReasoningLevels";
import { Qualities } from "@/components/resources/Qualities";
import { Pricing } from "@/components/resources/Pricing";
import { Voices } from "@/components/resources/Voices";
import { ProviderCardGrid } from "@/components/common/models/ProviderCardGrid";
import { ReadOnlyBanner } from "@/components/common/ReadOnlyBanner";
import { useBreadcrumbContext } from "@/contexts/breadcrumb-context";
import { useProfile } from "@/contexts/profile-context";
import { useDraftAutosave } from "@/hooks/use-draft-autosave";
import { cn } from "@/lib/utils";
import { getDefaultDepartmentIds } from "@/utils/department-picker-helpers";
import {
  Check,
  Edit,
  Image,
  Power,
  Settings,
  Volume2,
  X,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Parser } from "nuqs";
import { parseAsString, useQueryStates } from "nuqs";

interface FormErrors {
  name_id?: string;
  description_id?: string;
  provider_id?: string;
  value_id?: string;
  endpoint_id?: string;
}

// Type-only import from server pages
import type {
  GetModelOut,
  PatchModelDraftIn,
  PatchModelDraftOut,
  SaveModelIn,
  SaveModelOut,
} from "@/app/(main)/engine/models/[modelId]/page";

// Type guard to check if data has ModelDetailOut properties
function isModelDetailOut(d: unknown): d is ModelDetailOut {
  return typeof d === "object" && d !== null && "name" in d;
}


export interface ModelProps {
  modelId?: string;
  // For create mode: default model detail with provider mapping
  modelDetailDefault?: GetModelOut;
  // For edit mode: model detail with provider mapping
  modelDetail?: GetModelOut;
  saveModelAction?: (input: SaveModelIn) => Promise<SaveModelOut>;
  patchModelDraftAction?: (
    input: PatchModelDraftIn
  ) => Promise<PatchModelDraftOut>;
}

export default function Model({
  modelId,
  modelDetailDefault,
  modelDetail: serverModelDetail,
  saveModelAction,
  patchModelDraftAction,
}: ModelProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setEntityMetadata, clearEntityMetadata } = useBreadcrumbContext();
  const { effectiveProfile } = useProfile();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEditMode = !!modelId;

  // Inline parsers for URL-backed state (draftId only for now)
  const modelSearchParamsClient = {
    draftId: parseAsString,
  } as const;

  // URL-backed state using nuqs (only draftId)
  const [urlParams, setUrlParams] = useQueryStates(modelSearchParamsClient, {
    history: "replace",
    shallow: true,
  });

  // Get draftId from URL (managed by nuqs via urlParams)
  const urlDraftId = urlParams.draftId || null;
  const draftId = urlDraftId;

  // Use server-provided data
  const modelData = isEditMode ? serverModelDetail : modelDetailDefault;

  // Draft state type (all form fields that should be saved to draft)
  type DraftState = {
    // Single-select resource IDs (following Persona pattern)
    name_id: string | null;
    description_id: string | null;
    active_flag_id: string | null;
    modalities_enabled_flag_id: string | null;
    temperature_enabled_flag_id: string | null;
    pricing_enabled_flag_id: string | null;
    voices_enabled_flag_id: string | null;
    reasoning_levels_enabled_flag_id: string | null;
    qualities_enabled_flag_id: string | null;
    value_id: string | null;
    endpoint_id: string | null;
    // Multi-select resource IDs
    input_modality_ids: string[];
    output_modality_ids: string[];
    temperature_level_ids: string[];
    reasoning_level_ids: string[];
    quality_ids: string[];
    pricing_ids: string[];
    voice_ids: string[];
    // Other fields
    provider_id: string;
    departmentIds: string[];
  };

  const isSuperadmin = effectiveProfile?.role === "superadmin";
  const defaultDepartmentIds = useMemo(
    () =>
      getDefaultDepartmentIds(
        isSuperadmin,
        effectiveProfile?.primary_department_id || null
      ),
    [isSuperadmin, effectiveProfile?.primary_department_id]
  );

  // Initialize draft state from server data - extract resource IDs (following Persona pattern)
  const initialDraftState = useMemo((): DraftState => {
    if (!modelData) {
      return {
        name_id: null,
        description_id: null,
        active_flag_id: null,
        modalities_enabled_flag_id: null,
        temperature_enabled_flag_id: null,
        pricing_enabled_flag_id: null,
        voices_enabled_flag_id: null,
        reasoning_levels_enabled_flag_id: null,
        qualities_enabled_flag_id: null,
        value_id: null,
        endpoint_id: null,
        input_modality_ids: [],
        output_modality_ids: [],
        temperature_level_ids: [],
        reasoning_level_ids: [],
        quality_ids: [],
        pricing_ids: [],
        voice_ids: [],
        provider_id: "",
        departmentIds: defaultDepartmentIds,
      };
    }

    // Extract resource IDs from server data (following Persona pattern)
    // Note: Server data may have display values, but we only store IDs here
    const data = modelData as ModelDetailOut | ModelNewOut;

    return {
      name_id: data?.name_id ?? null,
      description_id: data?.description_id ?? null,
      active_flag_id: data?.active_flag_id ?? null,
      modalities_enabled_flag_id: (data as any)?.modalities_enabled_flag_id ?? null,
      temperature_enabled_flag_id: (data as any)?.temperature_enabled_flag_id ?? null,
      pricing_enabled_flag_id: (data as any)?.pricing_enabled_flag_id ?? null,
      voices_enabled_flag_id: (data as any)?.voices_enabled_flag_id ?? null,
      reasoning_levels_enabled_flag_id: (data as any)?.reasoning_levels_enabled_flag_id ?? null,
      qualities_enabled_flag_id: (data as any)?.qualities_enabled_flag_id ?? null,
      value_id: data?.value_id ?? null,
      endpoint_id: data?.endpoint_id ?? null,
      input_modality_ids: data?.input_modality_ids ?? [],
      output_modality_ids: data?.output_modality_ids ?? [],
      temperature_level_ids: data?.temperature_level_ids ?? [],
      reasoning_level_ids: data?.reasoning_level_ids ?? [],
      quality_ids: data?.quality_ids ?? [],
      pricing_ids: data?.pricing_ids ?? [],
      voice_ids: data?.voice_ids ?? [],
      provider_id: data?.provider_id ?? "",
      departmentIds: data?.department_ids ?? defaultDepartmentIds,
    };
  }, [modelData, defaultDepartmentIds]);

  const [draftState, setDraftState] = useState<DraftState>(initialDraftState);

  // Track previous initialDraftState content to avoid unnecessary updates
  const prevInitialDraftStateRef = useRef<string>(
    JSON.stringify(initialDraftState)
  );

  // Update draft state when server data changes (e.g., draft selected)
  useEffect(() => {
    const currentStateStr = prevInitialDraftStateRef.current;
    const newStateStr = JSON.stringify(initialDraftState);

    if (currentStateStr !== newStateStr) {
      prevInitialDraftStateRef.current = newStateStr;
      setDraftState(initialDraftState);
    }
  }, [initialDraftState]);

  // Integrate autosave hook
  const {
    saveStatus: _saveStatus,
    saveNow: _saveNow,
    lastSavedVersion: _lastSavedVersion,
  } = useDraftAutosave({
    draftId,
    draftState,
    initialVersion: modelData?.draft_version || 0,
    patchDraftAction: patchModelDraftAction
      ? async (input) => {
          const result = await patchModelDraftAction({
            body: {
              input_draft_id: input.body.draft_id || null,
              patch: input.body.patch as Record<string, unknown>,
              expected_version: input.body.expected_version,
            } as PatchModelDraftIn["body"],
          });
          return {
            draftId: result.draft_id || "",
            newVersion: result.new_version || 0,
            draftExists: result.draft_exists || false,
          };
        }
      : async () => ({ draftId: "", newVersion: 0, draftExists: false }),
    debounceMs: 1000,
    onDraftCreated: useCallback(
      (newDraftId: string) => {
        const currentUrlDraftId = searchParams.get("draftId");
        if (newDraftId === currentUrlDraftId) {
          return;
        }
        const params = new URLSearchParams(searchParams.toString());
        params.set("draftId", newDraftId);
        const newUrl = `?${params.toString()}`;
        router.replace(newUrl, { scroll: false });
        router.refresh();
      },
      [router, searchParams]
    ),
  });

  // Merge draftState with urlParams for formData (GenericForm expects single formData object)
  const formData = useMemo(() => {
    return {
      ...draftState,
      draftId: urlParams.draftId || null,
    } as Record<string, unknown>;
  }, [draftState, urlParams]);

  // Wrapper for setFormData that updates draftState for form fields, urlParams for navigation
  const setFormData = useCallback(
    (
      updates:
        | Partial<Record<string, unknown>>
        | ((prev: Record<string, unknown>) => Partial<Record<string, unknown>>)
    ) => {
      const resolvedUpdates =
        typeof updates === "function" ? updates(formData) : updates;

      const draftUpdates: Partial<DraftState> = {};
      const urlUpdates: Partial<Record<string, unknown>> = {};

      // Typed adapter pattern: check URL parsers vs draft state (following Persona pattern)
      Object.entries(resolvedUpdates).forEach(([key, value]) => {
        // If key exists in URL parsers, update URL params
        if (key in modelSearchParamsClient) {
          urlUpdates[key] = value;
        } else {
          // Otherwise, update draft state
          draftUpdates[key as keyof DraftState] = value as never;
        }
      });

      if (Object.keys(draftUpdates).length > 0) {
        setDraftState((prev) => ({ ...prev, ...draftUpdates }));
      }
      if (Object.keys(urlUpdates).length > 0) {
        const hasChanges = Object.keys(urlUpdates).some((key) => {
          const newValue = urlUpdates[key];
          const currentValue = urlParams[key as keyof typeof urlParams];
          return newValue !== currentValue;
        });

        if (hasChanges) {
          setUrlParams(urlUpdates as Parameters<typeof setUrlParams>[0]);
        }
      }
    },
    [formData, setUrlParams, modelSearchParamsClient]
  );

  const [errors, setErrors] = useState<FormErrors>({});

  // Extract body types from server action types for type safety
  type SaveModelBody = SaveModelIn extends { body: infer B } ? B : never;

  // Use server actions directly (no mutations needed)
  const handleSaveModel = useCallback(
    async (body: SaveModelBody) => {
      if (!saveModelAction) {
        throw new Error("saveModelAction is required");
      }
      await saveModelAction({ body });
    },
    [saveModelAction]
  );

  // Readonly logic - check can_edit flag from API response
  const isReadonly = useMemo(() => {
    if (!modelData) return false;
    return !modelData.can_edit;
  }, [modelData]);

  // Use server-provided data (for breadcrumbs and other non-form uses)
  const modelDetail = isEditMode ? serverModelDetail : modelDetailDefault;

  // Get department and key arrays (replacing mappings)
  const modelDataForArrays = isEditMode ? modelDetail : modelDetailDefault;
  const departments = useMemo(() => {
    return modelDataForArrays?.departments || [];
  }, [modelDataForArrays]);

  const validDepartmentIds = useMemo(() => {
    return modelDataForArrays?.valid_department_ids || [];
  }, [modelDataForArrays]);

  // Get provider array (replacing provider_mapping)
  // New API returns providers as array of provider_option objects with id, name, description
  const providers = useMemo(() => {
    return modelDataForArrays?.providers || [];
  }, [modelDataForArrays]);

  // Get keys array (replacing key_mapping) - unused but kept for potential future use
  // const _keys = useMemo(() => {
  //   return modelDataForArrays?.keys || [];
  // }, [modelDataForArrays]);

  // Get current department_ids and key_id for edit mode - unused but kept for potential future use
  // const _currentDepartmentIds = useMemo(() => {
  //   if (isEditMode && modelDetail && "department_ids" in modelDetail) {
  //     return (modelDetail.department_ids as string[]) || [];
  //   }
  //   return defaultDepartmentIds;
  // }, [isEditMode, modelDetail, defaultDepartmentIds]);

  // const _currentKeyId = useMemo(() => {
  //   if (isEditMode && modelDetail && "default_key_id" in modelDetail) {
  //     return (modelDetail.default_key_id as string | null) || null;
  //   }
  //   return null;
  // }, [isEditMode, modelDetail]);

  // Set breadcrumb context for model (edit mode only)
  useEffect(() => {
    const detailName = modelDetail?.name_resource?.name ?? null;
    if (detailName && modelId && isEditMode) {
      setEntityMetadata({
        entityId: modelId,
        entityName: detailName,
        entityType: "model",
      });
    }
    return () => {
      if (modelId) {
        clearEntityMetadata(modelId);
      }
    };
  }, [
    modelDetail?.name_resource?.name,
    modelId,
    isEditMode,
    setEntityMetadata,
    clearEntityMetadata,
  ]);

  // Listen for full-page-generate event from layout
  useEffect(() => {
    const handleFullPageGenerate = () => {
      // TODO: Implement generation logic for models
      // For now, check if generation capability exists
      if (modelData?.general_agent_id) {
        // When generation is implemented, trigger it here
        // handleGenerateResources([...]);
        toast.info("Generation not yet implemented for models");
      }
    };
    window.addEventListener("full-page-generate", handleFullPageGenerate);
    return () =>
      window.removeEventListener("full-page-generate", handleFullPageGenerate);
  }, [modelData?.general_agent_id]);

  // Get units from model detail response (already included)
  // Map server units to Unit type expected by UnitCardGrid
  const units = useMemo(() => {
    if (!modelData?.units) return [];
    return modelData.units
      .filter(
        (
          u
        ): u is NonNullable<typeof u> & {
          unit_id: string;
          name: string;
          value: number;
        } =>
          u !== null &&
          u.unit_id !== null &&
          u.name !== null &&
          u.value !== null
      )
      .map((u) => ({
        id: u.unit_id,
        name: u.name,
        unit_category: u.unit_category || "",
        value: u.value,
      }));
  }, [modelData]);

  const resetFormAndState = useCallback(() => {
    setDraftState(initialDraftState);
    setErrors({});
  }, [initialDraftState]);

  // Step status logic (for GenericForm) - using resource IDs
  const getStepStatus = useCallback(
    (stepId: string, formData: Record<string, unknown>): StepStatus => {
      const hasName = !!(formData["name_id"] as string | null | undefined);
      const hasValue = !!(formData["value_id"] as string | null | undefined);
      const hasDescription = !!(formData["description_id"] as string | null | undefined);
      const hasProvider = !!(formData["provider_id"] as string | null | undefined)?.trim();
      const hasEndpoint = !!(formData["endpoint_id"] as string | null | undefined);
      const input_modality_ids = (formData["input_modality_ids"] as string[] | null | undefined) || [];
      const output_modality_ids = (formData["output_modality_ids"] as string[] | null | undefined) || [];
      const hasInputModalities = input_modality_ids.length > 0;
      const hasOutputModalities = output_modality_ids.length > 0;
      const hasModalities = hasInputModalities && hasOutputModalities;
      const modalities_enabled_flag_id = formData["modalities_enabled_flag_id"] as string | null | undefined;
      const temperature_enabled_flag_id = formData["temperature_enabled_flag_id"] as string | null | undefined;
      const pricing_enabled_flag_id = formData["pricing_enabled_flag_id"] as string | null | undefined;
      const voices_enabled_flag_id = formData["voices_enabled_flag_id"] as string | null | undefined;
      const reasoning_levels_enabled_flag_id = formData["reasoning_levels_enabled_flag_id"] as string | null | undefined;
      const qualities_enabled_flag_id = formData["qualities_enabled_flag_id"] as string | null | undefined;

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
          if (!modalities_enabled_flag_id || !hasInputModalities) return "pending";
          return hasOutputModalities ? "completed" : "active";
        case "temperature":
          if (!hasName || !hasValue || !hasDescription || !hasProvider)
            return "pending";
          if (!modalities_enabled_flag_id || !hasInputModalities || !hasOutputModalities) return "pending";
          const temperature_level_ids = (formData["temperature_level_ids"] as string[] | null | undefined) || [];
          return temperature_enabled_flag_id && temperature_level_ids.length > 0
            ? "completed"
            : temperature_enabled_flag_id
              ? "active"
              : "pending";
        case "pricing":
          if (!hasName || !hasValue || !hasDescription || !hasProvider)
            return "pending";
          if (!modalities_enabled_flag_id || !hasInputModalities || !hasOutputModalities) return "pending";
          const pricing_ids = (formData["pricing_ids"] as string[] | null | undefined) || [];
          return pricing_enabled_flag_id && pricing_ids.length > 0
            ? "completed"
            : pricing_enabled_flag_id
              ? "active"
              : "pending";
        case "reasoning":
          if (!hasName || !hasValue || !hasDescription || !hasProvider)
            return "pending";
          if (!modalities_enabled_flag_id || !hasInputModalities || !hasOutputModalities) return "pending";
          const reasoning_level_ids = (formData["reasoning_level_ids"] as string[] | null | undefined) || [];
          return reasoning_levels_enabled_flag_id && reasoning_level_ids.length > 0
            ? "completed"
            : reasoning_levels_enabled_flag_id
              ? "active"
              : "pending";
        case "voices":
          if (!hasName || !hasValue || !hasDescription || !hasProvider)
            return "pending";
          if (!modalities_enabled_flag_id || !hasInputModalities || !hasOutputModalities) return "pending";
          const voice_ids = (formData["voice_ids"] as string[] | null | undefined) || [];
          return voices_enabled_flag_id && voice_ids.length > 0
            ? "completed"
            : voices_enabled_flag_id
              ? "active"
              : "pending";
        case "qualities":
          if (!hasName || !hasValue || !hasDescription || !hasProvider)
            return "pending";
          if (!modalities_enabled_flag_id || !hasInputModalities || !hasOutputModalities) return "pending";
          const quality_ids = (formData["quality_ids"] as string[] | null | undefined) || [];
          return qualities_enabled_flag_id && quality_ids.length > 0
            ? "completed"
            : qualities_enabled_flag_id
              ? "active"
              : "pending";
        default:
          return "pending";
      }
    },
    []
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

  // Initialize form from server data (for GenericForm)
  const initializeForm = useCallback(
    (
      _serverData: unknown,
      _isEditMode: boolean
    ): Partial<Record<string, unknown>> => {
      // Form is already initialized via initialDraftState, so return empty object
      // GenericForm will use the formData prop we provide
      return {};
    },
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

  // Custom URL editing handlers removed - not used in renderStep

  // Calculate dots dynamically based on container width (for custom URL display)
  // Removed dots calculation useEffect - dotsCount is managed in ModelStepContent component

  // Submit handler for GenericForm
  const handleSubmit = useCallback(
    async (formData: Record<string, unknown>): Promise<void> => {
      // Extract resource IDs directly from formData (following Persona pattern)
      const name_id = formData["name_id"] as string | null | undefined;
      const description_id = formData["description_id"] as string | null | undefined;
      const active_flag_id = formData["active_flag_id"] as string | null | undefined;
      const modalities_enabled_flag_id = formData["modalities_enabled_flag_id"] as string | null | undefined;
      const temperature_enabled_flag_id = formData["temperature_enabled_flag_id"] as string | null | undefined;
      const pricing_enabled_flag_id = formData["pricing_enabled_flag_id"] as string | null | undefined;
      const voices_enabled_flag_id = formData["voices_enabled_flag_id"] as string | null | undefined;
      const reasoning_levels_enabled_flag_id = formData["reasoning_levels_enabled_flag_id"] as string | null | undefined;
      const qualities_enabled_flag_id = formData["qualities_enabled_flag_id"] as string | null | undefined;
      const value_id = formData["value_id"] as string | null | undefined;
      const endpoint_id = formData["endpoint_id"] as string | null | undefined;
      const provider_id = formData["provider_id"] as string | null | undefined;
      const input_modality_ids = formData["input_modality_ids"] as string[] | null | undefined;
      const output_modality_ids = formData["output_modality_ids"] as string[] | null | undefined;
      const temperature_level_ids = formData["temperature_level_ids"] as string[] | null | undefined;
      const reasoning_level_ids = formData["reasoning_level_ids"] as string[] | null | undefined;
      const quality_ids = formData["quality_ids"] as string[] | null | undefined;
      const pricing_ids = formData["pricing_ids"] as string[] | null | undefined;
      const voice_ids = formData["voice_ids"] as string[] | null | undefined;
      const departmentIds = formData["departmentIds"] as string[] | null | undefined;

      // Validation
      if (!name_id) {
        setErrors((prev) => ({ ...prev, name_id: "Name is required" }));
        return;
      }

      if (!provider_id) {
        setErrors((prev) => ({
          ...prev,
          provider_id: "Provider is required",
        }));
        return;
      }

      if (!value_id) {
        setErrors((prev) => ({
          ...prev,
          value_id: "Model value is required",
        }));
        return;
      }

      // Ensure profileId exists - required for API calls
      if (!effectiveProfile?.id) {
        toast.error("Profile not loaded. Please refresh the page.");
        setIsSubmitting(false);
        return;
      }

      setIsSubmitting(true);

      try {
        // Forward IDs directly to save endpoint (no transformations needed)
        await handleSaveModel({
          input_model_id: isEditMode && modelId ? modelId : null,
          provider_id: provider_id!,
          name_id: name_id || null,
          description_id: description_id || null,
          active_flag_id: active_flag_id || null,
          modalities_enabled_flag_id: modalities_enabled_flag_id || null,
          temperature_enabled_flag_id: temperature_enabled_flag_id || null,
          pricing_enabled_flag_id: pricing_enabled_flag_id || null,
          voices_enabled_flag_id: voices_enabled_flag_id || null,
          reasoning_levels_enabled_flag_id: reasoning_levels_enabled_flag_id || null,
          qualities_enabled_flag_id: qualities_enabled_flag_id || null,
          value_id: value_id || null,
          endpoint_id: endpoint_id || null,
          department_ids: departmentIds || null,
          input_modality_ids: input_modality_ids && input_modality_ids.length > 0 ? input_modality_ids : null,
          output_modality_ids: output_modality_ids && output_modality_ids.length > 0 ? output_modality_ids : null,
          temperature_level_ids: temperature_level_ids && temperature_level_ids.length > 0 ? temperature_level_ids : null,
          reasoning_level_ids: reasoning_level_ids && reasoning_level_ids.length > 0 ? reasoning_level_ids : null,
          quality_ids: quality_ids && quality_ids.length > 0 ? quality_ids : null,
          pricing_ids: pricing_ids && pricing_ids.length > 0 ? pricing_ids : null,
          voice_ids: voice_ids && voice_ids.length > 0 ? voice_ids : null,
        });
        resetFormAndState();
        toast.success(
          `Model ${isEditMode && modelId ? "updated" : "created"} successfully!`
        );
        router.push(`/engine/models`);
      } catch (error) {
        toast.error(
          `Failed to ${isEditMode && modelId ? "update" : "create"} model: ${error instanceof Error ? error.message : "Unknown error"}`
        );
        setIsSubmitting(false);
        throw error;
      }
    },
    [
      isEditMode,
      modelId,
      effectiveProfile?.id,
      handleSaveModel,
      resetFormAndState,
      router,
    ]
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
      formData: stepFormData,
      setFormData: setStepFormData,
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
      // Get current form values with proper typing (using resource IDs)
      const name_id = (stepFormData["name_id"] as string | null | undefined) ?? null;
      const description_id = (stepFormData["description_id"] as string | null | undefined) ?? null;
      const active_flag_id = (stepFormData["active_flag_id"] as string | null | undefined) ?? null;
      const modalities_enabled_flag_id = (stepFormData["modalities_enabled_flag_id"] as string | null | undefined) ?? null;
      const temperature_enabled_flag_id = (stepFormData["temperature_enabled_flag_id"] as string | null | undefined) ?? null;
      const pricing_enabled_flag_id = (stepFormData["pricing_enabled_flag_id"] as string | null | undefined) ?? null;
      const voices_enabled_flag_id = (stepFormData["voices_enabled_flag_id"] as string | null | undefined) ?? null;
      const reasoning_levels_enabled_flag_id = (stepFormData["reasoning_levels_enabled_flag_id"] as string | null | undefined) ?? null;
      const qualities_enabled_flag_id = (stepFormData["qualities_enabled_flag_id"] as string | null | undefined) ?? null;
      const value_id = (stepFormData["value_id"] as string | null | undefined) ?? null;
      const endpoint_id = (stepFormData["endpoint_id"] as string | null | undefined) ?? null;
      const provider_id =
        (stepFormData["provider_id"] as string | null | undefined) ?? "";
      const departmentIds =
        (stepFormData["departmentIds"] as string[] | null | undefined) || [];
      const input_modality_ids =
        (stepFormData["input_modality_ids"] as string[] | null | undefined) || [];
      const output_modality_ids =
        (stepFormData["output_modality_ids"] as string[] | null | undefined) || [];
      const temperature_level_ids =
        (stepFormData["temperature_level_ids"] as string[] | null | undefined) || [];
      const reasoning_level_ids =
        (stepFormData["reasoning_level_ids"] as string[] | null | undefined) || [];
      const quality_ids =
        (stepFormData["quality_ids"] as string[] | null | undefined) || [];
      const pricing_ids =
        (stepFormData["pricing_ids"] as string[] | null | undefined) || [];
      const voice_ids =
        (stepFormData["voice_ids"] as string[] | null | undefined) || [];

      switch (stepId) {
        case "basic":
          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={isReadonly}
              isEditMode={isEditMode}
              customHeader={
                <Names
                  name_id={name_id ?? null}
                  name_resource={modelData?.name_resource ?? null}
                  show_name={modelData?.show_name ?? true}
                  name_suggestions={modelData?.name_suggestions ?? []}
                  names={modelData?.names ?? []}
                  disabled={isReadonly}
                  onNameIdChange={(id) =>
                    setStepFormData({ name_id: id })
                  }
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
                  description_id={description_id ?? null}
                  description_resource={modelData?.description_resource ?? null}
                  show_description={modelData?.show_description ?? true}
                  description_suggestions={modelData?.description_suggestions ?? []}
                  descriptions={modelData?.descriptions ?? []}
                  disabled={isReadonly}
                  onDescriptionIdChange={(id) =>
                    setStepFormData({ description_id: id })
                  }
                  placeholder="Enter a brief description"
                  required={modelData?.description_required ?? false}
                  group_id={modelData?.group_id ?? null}
                  agent_id={modelData?.description_agent_id ?? null}
                />

                <Values
                  value_ids={value_id ? [value_id] : []}
                  value_resources={value_id && modelData?.value_resource ? [modelData.value_resource] : []}
                  show_values={modelData?.show_value ?? true}
                  value_suggestions={modelData?.value_suggestions ?? []}
                  values={modelData?.values ?? []}
                  disabled={isReadonly}
                  onChange={(ids) =>
                    setStepFormData({ value_id: ids.length > 0 ? ids[0] : null })
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
                      selectedIds={departmentIds}
                      onSelect={(ids) =>
                        setStepFormData({
                          departmentIds: ids.length > 0 ? ids : null,
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
                      disabled={isReadonly}
                      multiSelect={true}
                      hideSelectedChips={true}
                      buttonClassName="w-full"
                    />
                  </div>
                )}

                <Flags
                  flag_id={active_flag_id ?? null}
                  flag_resource={modelData?.flag_resource ?? null}
                  show_flag={modelData?.show_flag ?? false}
                  disabled={isReadonly}
                  onFlagIdChange={(id) =>
                    setStepFormData({ active_flag_id: id })
                  }
                  label="Active"
                  helpText="Inactive models will not be available for selection"
                  required={modelData?.flag_required ?? false}
                  group_id={modelData?.group_id ?? null}
                  agent_id={modelData?.flag_agent_id ?? null}
                />


                <Flags
                  flag_id={modalities_enabled_flag_id ?? null}
                  flag_resource={(modelData as any)?.modalities_enabled_flag_resource ?? null}
                  show_flag={(modelData as any)?.show_modalities_enabled_flag ?? false}
                  disabled={isReadonly}
                  onFlagIdChange={(id) => {
                    // Flags component calls this with null when toggling off, or with flag_id when creating/selecting
                    // For feature toggles, we want to use existing flag resources, not create new ones
                    // So if id is provided, use it; if null, check if we should look up existing flag
                    let flagId = id;
                    if (!flagId && !modalities_enabled_flag_id && modelData?.flags) {
                      // User toggled on but no flag_id - look up existing flag resource
                      const modalitiesFlag = (modelData.flags as Array<{ id: string; name: string }>).find(
                        (f) => f.name === "modalities_enabled"
                      );
                      flagId = modalitiesFlag?.id ?? null;
                    }
                    setStepFormData({
                      modalities_enabled_flag_id: flagId,
                      input_modality_ids: flagId ? input_modality_ids : [],
                      output_modality_ids: flagId ? output_modality_ids : [],
                    });
                  }}
                  label="Modalities"
                  helpText="Enable input/output modalities configuration"
                  required={(modelData as any)?.modalities_enabled_flag_required ?? false}
                  group_id={modelData?.group_id ?? null}
                  agent_id={(modelData as any)?.modalities_enabled_flag_agent_id ?? null}
                />

                <Flags
                  flag_id={temperature_enabled_flag_id ?? null}
                  flag_resource={(modelData as any)?.temperature_enabled_flag_resource ?? null}
                  show_flag={(modelData as any)?.show_temperature_enabled_flag ?? false}
                  disabled={isReadonly}
                  onFlagIdChange={(id) => {
                    let flagId = id;
                    if (!flagId && !temperature_enabled_flag_id && modelData?.flags) {
                      const temperatureFlag = (modelData.flags as Array<{ id: string; name: string }>).find(
                        (f) => f.name === "temperature_enabled"
                      );
                      flagId = temperatureFlag?.id ?? null;
                    }
                    setStepFormData({
                      temperature_enabled_flag_id: flagId,
                      temperature_level_ids: flagId ? temperature_level_ids : [],
                    });
                  }}
                  label="Temperature"
                  helpText="Configure temperature levels for this model"
                  required={(modelData as any)?.temperature_enabled_flag_required ?? false}
                  group_id={modelData?.group_id ?? null}
                  agent_id={(modelData as any)?.temperature_enabled_flag_agent_id ?? null}
                />

                <Flags
                  flag_id={pricing_enabled_flag_id ?? null}
                  flag_resource={(modelData as any)?.pricing_enabled_flag_resource ?? null}
                  show_flag={(modelData as any)?.show_pricing_enabled_flag ?? false}
                  disabled={isReadonly}
                  onFlagIdChange={(id) => {
                    let flagId = id;
                    if (!flagId && !pricing_enabled_flag_id && modelData?.flags) {
                      const pricingFlag = (modelData.flags as Array<{ id: string; name: string }>).find(
                        (f) => f.name === "pricing_enabled"
                      );
                      flagId = pricingFlag?.id ?? null;
                    }
                    setStepFormData({
                      pricing_enabled_flag_id: flagId,
                      pricing_ids: flagId ? pricing_ids : [],
                    });
                  }}
                  label="Pricing"
                  helpText="Configure pricing for this model"
                  required={(modelData as any)?.pricing_enabled_flag_required ?? false}
                  group_id={modelData?.group_id ?? null}
                  agent_id={(modelData as any)?.pricing_enabled_flag_agent_id ?? null}
                />

                <Flags
                  flag_id={voices_enabled_flag_id ?? null}
                  flag_resource={(modelData as any)?.voices_enabled_flag_resource ?? null}
                  show_flag={(modelData as any)?.show_voices_enabled_flag ?? false}
                  disabled={isReadonly}
                  onFlagIdChange={(id) => {
                    let flagId = id;
                    if (!flagId && !voices_enabled_flag_id && modelData?.flags) {
                      const voicesFlag = (modelData.flags as Array<{ id: string; name: string }>).find(
                        (f) => f.name === "voices_enabled"
                      );
                      flagId = voicesFlag?.id ?? null;
                    }
                    setStepFormData({
                      voices_enabled_flag_id: flagId,
                      voice_ids: flagId ? voice_ids : [],
                    });
                  }}
                  label="Voices"
                  helpText="Select voices for this model"
                  required={(modelData as any)?.voices_enabled_flag_required ?? false}
                  group_id={modelData?.group_id ?? null}
                  agent_id={(modelData as any)?.voices_enabled_flag_agent_id ?? null}
                />

                <Flags
                  flag_id={reasoning_levels_enabled_flag_id ?? null}
                  flag_resource={(modelData as any)?.reasoning_levels_enabled_flag_resource ?? null}
                  show_flag={(modelData as any)?.show_reasoning_levels_enabled_flag ?? false}
                  disabled={isReadonly}
                  onFlagIdChange={(id) => {
                    let flagId = id;
                    if (!flagId && !reasoning_levels_enabled_flag_id && modelData?.flags) {
                      const reasoningFlag = (modelData.flags as Array<{ id: string; name: string }>).find(
                        (f) => f.name === "reasoning_levels_enabled"
                      );
                      flagId = reasoningFlag?.id ?? null;
                    }
                    setStepFormData({
                      reasoning_levels_enabled_flag_id: flagId,
                      reasoning_level_ids: flagId ? reasoning_level_ids : [],
                    });
                  }}
                  label="Reasoning Levels"
                  helpText="Select reasoning levels for this model"
                  required={(modelData as any)?.reasoning_levels_enabled_flag_required ?? false}
                  group_id={modelData?.group_id ?? null}
                  agent_id={(modelData as any)?.reasoning_levels_enabled_flag_agent_id ?? null}
                />

                <Flags
                  flag_id={qualities_enabled_flag_id ?? null}
                  flag_resource={(modelData as any)?.qualities_enabled_flag_resource ?? null}
                  show_flag={(modelData as any)?.show_qualities_enabled_flag ?? false}
                  disabled={isReadonly}
                  onFlagIdChange={(id) => {
                    let flagId = id;
                    if (!flagId && !qualities_enabled_flag_id && modelData?.flags) {
                      const qualitiesFlag = (modelData.flags as Array<{ id: string; name: string }>).find(
                        (f) => f.name === "qualities_enabled"
                      );
                      flagId = qualitiesFlag?.id ?? null;
                    }
                    setStepFormData({
                      qualities_enabled_flag_id: flagId,
                      quality_ids: flagId ? quality_ids : [],
                    });
                  }}
                  label="Qualities"
                  helpText="Select quality levels for this model"
                  required={(modelData as any)?.qualities_enabled_flag_required ?? false}
                  group_id={modelData?.group_id ?? null}
                  agent_id={(modelData as any)?.qualities_enabled_flag_agent_id ?? null}
                />
              </div>
              </div>
            </StepCard>
          );

        case "customUrl":
          if (!endpoint_id && !modalities_enabled_flag_id) return null; // Show if endpoint is set or modalities enabled
          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={isReadonly}
              isEditMode={isEditMode}
              resetFields={["endpoint_id"]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
            >
              <Endpoints
                endpoint_ids={endpoint_id ? [endpoint_id] : []}
                endpoint_resources={endpoint_id && modelData?.endpoint_resource ? [modelData.endpoint_resource] : []}
                show_endpoints={modelData?.show_endpoint ?? true}
                endpoint_suggestions={modelData?.endpoint_suggestions ?? []}
                endpoints={modelData?.endpoints ?? []}
                disabled={isReadonly}
                onChange={(ids) =>
                  setStepFormData({ endpoint_id: ids.length > 0 ? ids[0] : null })
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
              isReadonly={isReadonly}
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
                    // New API returns providers with 'id' field (not 'provider_id')
                    const providerId =
                      (p as { id?: string | null }).id ??
                      (p as { provider_id?: string | null }).provider_id ??
                      null;
                    if (providerId) {
                      acc[String(providerId)] = {
                        name: (p as { name?: string | null }).name ?? "",
                        description:
                          (p as { description?: string | null }).description ??
                          "",
                      };
                    }
                    return acc;
                  },
                  {} as Record<string, { name: string; description: string }>
                )}
                validProviderIds={providers
                  .map(
                    (p) =>
                      (p as { id?: string | null }).id ??
                      (p as { provider_id?: string | null }).provider_id ??
                      null
                  )
                  .filter((id): id is string => !!id)
                  .map((id) => String(id))}
                selectedProviderId={provider_id || null}
                onSelect={(providerId) => {
                  setStepFormData({ provider_id: providerId || null });
                }}
                readonly={isReadonly}
              />
              {errors.provider_id && (
                <p className="text-sm text-destructive mt-2">
                  {errors.provider_id}
                </p>
              )}
            </StepCard>
          );

        case "inputModalities":
          if (!modalities_enabled_flag_id) return null;
          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={isReadonly}
              isEditMode={isEditMode}
              resetFields={["input_modality_ids"]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
            >
              <Modalities
                modality_ids={input_modality_ids}
                modality_resources={modelData?.input_modality_resources ?? []}
                show_modalities={modelData?.show_input_modalities ?? true}
                modality_suggestions={modelData?.input_modality_suggestions ?? []}
                modalities={modelData?.input_modalities ?? []}
                disabled={isReadonly}
                onChange={(ids) =>
                  setStepFormData({ input_modality_ids: ids })
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
          if (!enableModalities) return null;
          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={isReadonly}
              isEditMode={isEditMode}
              resetFields={["output_modality_ids"]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
            >
              <Modalities
                modality_ids={output_modality_ids}
                modality_resources={modelData?.output_modality_resources ?? []}
                show_modalities={modelData?.show_output_modalities ?? true}
                modality_suggestions={modelData?.output_modality_suggestions ?? []}
                modalities={modelData?.output_modalities ?? []}
                disabled={isReadonly}
                onChange={(ids) =>
                  setStepFormData({ output_modality_ids: ids })
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
          if (!temperature_enabled_flag_id) return null;
          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={isReadonly}
              isEditMode={isEditMode}
              resetFields={["temperature_level_ids"]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
            >
              <TemperatureLevels
                temperature_level_ids={temperature_level_ids}
                temperature_level_resources={modelData?.temperature_level_resources ?? []}
                show_temperature_levels={modelData?.show_temperature_levels ?? true}
                temperature_level_suggestions={modelData?.temperature_level_suggestions ?? []}
                temperature_levels={modelData?.temperature_levels ?? []}
                disabled={isReadonly}
                onChange={(ids) =>
                  setStepFormData({ temperature_level_ids: ids })
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
          if (!enablePricing) return null;
          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={isReadonly}
              isEditMode={isEditMode}
              resetFields={["pricing_ids"]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
            >
              <Pricing
                pricing_ids={pricing_ids}
                pricing_resources={modelData?.pricing_resources ?? []}
                show_pricing={modelData?.show_pricing ?? true}
                pricing_suggestions={modelData?.pricing_suggestions ?? []}
                pricings={modelData?.pricings ?? []}
                disabled={isReadonly}
                onChange={(ids) =>
                  setStepFormData({ pricing_ids: ids })
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
          if (!reasoning_levels_enabled_flag_id) return null;
          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={isReadonly}
              isEditMode={isEditMode}
              resetFields={["reasoning_level_ids"]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
            >
              <ReasoningLevels
                reasoning_level_ids={reasoning_level_ids}
                reasoning_level_resources={modelData?.reasoning_level_resources ?? []}
                show_reasoning_levels={modelData?.show_reasoning_levels ?? true}
                reasoning_level_suggestions={modelData?.reasoning_level_suggestions ?? []}
                reasoning_levels={modelData?.reasoning_levels ?? []}
                disabled={isReadonly}
                onChange={(ids) =>
                  setStepFormData({ reasoning_level_ids: ids })
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
          if (!enableVoices) return null;
          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={isReadonly}
              isEditMode={isEditMode}
              resetFields={["voice_ids"]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
            >
              <Voices
                voice_ids={voice_ids}
                voice_resources={modelData?.voice_resources ?? []}
                show_voices={modelData?.show_voices ?? true}
                voice_suggestions={modelData?.voice_suggestions ?? []}
                voices={modelData?.voices ?? []}
                disabled={isReadonly}
                onChange={(ids) =>
                  setStepFormData({ voice_ids: ids })
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
          if (!qualities_enabled_flag_id) return null;
          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={isReadonly}
              isEditMode={isEditMode}
              resetFields={["quality_ids"]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
            >
              <Qualities
                quality_ids={quality_ids}
                quality_resources={modelData?.quality_resources ?? []}
                show_qualities={modelData?.show_qualities ?? true}
                quality_suggestions={modelData?.quality_suggestions ?? []}
                qualities={modelData?.qualities ?? []}
                disabled={isReadonly}
                onChange={(ids) =>
                  setStepFormData({ quality_ids: ids })
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
      isReadonly,
      isEditMode,
      isSubmitting,
      errors,
      validDepartmentIds,
      departments,
      providers,
      modelData,
    ]
  );

  return (
    <div className="w-full p-6 space-y-8">
      <ReadOnlyBanner
        disabled={isReadonly}
        disabledReason={modelData?.disabled_reason ?? null}
        entityType="model"
      />
      <GenericForm
        nuqsParsers={modelSearchParamsClient as Record<string, Parser<unknown>>}
        steps={steps}
        getStepStatus={getStepStatus}
        formData={formData}
        setFormData={setFormData}
        serverData={modelData}
        initializeForm={initializeForm}
        formFieldKeys={formFieldKeys}
        resetSuccessMessage={resetSuccessMessage}
        onSubmit={handleSubmit}
        submitButton={submitButton}
        isReadonly={isReadonly}
        isEditMode={isEditMode}
        renderStep={renderStep}
      />
    </div>
  );
}
