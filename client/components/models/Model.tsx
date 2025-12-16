/**
 * Model.tsx
 * Used to create and manage models for the admin dashboard
 * @AshokSaravanan222 & @siladiea
 * 06/18/2025
 */
"use client";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";

// UI Components
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

import { GenericPicker } from "@/components/common/forms/GenericPicker";
import {
  TemperatureBoundsPicker,
  type TemperatureBounds,
} from "@/components/common/forms/TemperatureBoundsPicker";
import { InputModalityCardGrid } from "@/components/common/models/InputModalityCardGrid";
import { OutputModalityCardGrid } from "@/components/common/models/OutputModalityCardGrid";
import { PricingTypeCardGrid } from "@/components/common/models/PricingTypeCardGrid";
import { ProviderCardGrid } from "@/components/common/models/ProviderCardGrid";
import { QualityCardGrid } from "@/components/common/models/QualityCardGrid";
import { ReasoningCardGrid } from "@/components/common/models/ReasoningCardGrid";
import { UnitCardGrid } from "@/components/common/models/UnitCardGrid";
import { VoiceCardGrid } from "@/components/common/models/VoiceCardGrid";
import { useBreadcrumbContext } from "@/contexts/breadcrumb-context";
import { useProfile } from "@/contexts/profile-context";
import { cn } from "@/lib/utils";
import { getDefaultDepartmentIds } from "@/utils/department-picker-helpers";
import {
  Brain,
  Check,
  DollarSign,
  Edit,
  Image,
  Power,
  Settings,
  Thermometer,
  Volume2,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";

type StepStatus = "pending" | "active" | "completed";

interface Step {
  id: string;
  title: string;
  description: string;
  status: StepStatus;
}

interface FormErrors {
  name?: string;
  description?: string;
  provider_id?: string;
  value?: string;
  baseUrl?: string;
}

interface FormData {
  name?: string;
  description?: string;
  provider_id?: string;
  value?: string;
  active?: boolean;
  departmentIds?: string[] | null;
  keyId?: string | null; // Kept for backward compatibility, not rendered
  customModel?: boolean;
  baseUrl?: string;
  // Feature toggles
  enableModalities?: boolean;
  enableTemperature?: boolean;
  enablePricing?: boolean;
  enableVoices?: boolean;
  enableReasoningLevels?: boolean;
  enableQualities?: boolean;
  // Configuration fields
  temperature_bounds?: TemperatureBounds;
  pricing?: Record<string, { unit_id: string; price: number }[]>; // Changed from PricingEntry[]
  selectedPricingTypes?: string[]; // Selected pricing types (input/output/cached)
  modalities?: { input: string[]; output: string[] };
  reasoning_levels?: string[];
  voices?: string[];
  qualities?: string[];
}

// Type-only import from server pages
import type {
  ModelDetailOut,
  UpdateModelIn,
  UpdateModelOut,
} from "@/app/(main)/engine/models/[modelId]/page";
import type {
  CreateKeyIn,
  CreateKeyOut,
  CreateModelIn,
  CreateModelOut,
  DecryptKeyIn,
  DecryptKeyOut,
  ModelNewOut,
  UpdateKeyIn,
  UpdateKeyOut,
} from "@/app/(main)/engine/models/new/page";

export interface ModelProps {
  modelId?: string;
  // For create mode: default model detail with provider mapping
  modelDetailDefault?: ModelNewOut;
  // For edit mode: model detail with provider mapping
  modelDetail?: ModelDetailOut;
  createModelAction?: (input: CreateModelIn) => Promise<CreateModelOut>;
  updateModelAction?: (input: UpdateModelIn) => Promise<UpdateModelOut>;
  // Key management actions
  createKeyAction?: (input: CreateKeyIn) => Promise<CreateKeyOut>;
  decryptKeyAction?: (input: DecryptKeyIn) => Promise<DecryptKeyOut>;
  updateKeyAction?: (input: UpdateKeyIn) => Promise<UpdateKeyOut>;
}

export default function Model({
  modelId,
  modelDetailDefault,
  modelDetail: serverModelDetail,
  createModelAction,
  updateModelAction,
  createKeyAction: _createKeyAction,
  decryptKeyAction: _decryptKeyAction,
  updateKeyAction: _updateKeyAction,
}: ModelProps) {
  const router = useRouter();
  const { setEntityMetadata, clearEntityMetadata } = useBreadcrumbContext();
  const { effectiveProfile } = useProfile();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditingBaseUrl, setIsEditingBaseUrl] = useState(false);
  const [editingBaseUrlValue, setEditingBaseUrlValue] = useState("");
  const [dotsCount, setDotsCount] = useState(100);
  const dotsContainerRef = useRef<HTMLDivElement>(null);
  const isEditMode = !!modelId;

  const isSuperadmin = effectiveProfile?.role === "superadmin";
  const defaultDepartmentIds = useMemo(
    () =>
      getDefaultDepartmentIds(
        isSuperadmin,
        effectiveProfile?.primaryDepartmentId || null
      ),
    [isSuperadmin, effectiveProfile?.primaryDepartmentId]
  );

  const initialFormData: FormData = useMemo(
    () => ({
      name: "New Model",
      description: "",
      provider_id: "",
      value: "",
      active: true,
      departmentIds: defaultDepartmentIds,
      keyId: null,
      customModel: false,
      baseUrl: "",
    }),
    [defaultDepartmentIds]
  );

  const [formData, setFormData] = useState<FormData>({});
  const [errors, setErrors] = useState<FormErrors>({});

  // Use server-provided data
  const modelDetail = serverModelDetail;

  // Extract body types from server action types for type safety
  type CreateModelBody = CreateModelIn extends { body: infer B } ? B : never;
  type UpdateModelBody = UpdateModelIn extends { body: infer B } ? B : never;

  // Use server actions directly (no mutations needed)
  const handleCreateModel = async (body: CreateModelBody) => {
    if (!createModelAction) {
      throw new Error("createModelAction is required");
    }
    await createModelAction({ body });
  };

  const handleUpdateModel = async (body: UpdateModelBody) => {
    if (!updateModelAction) {
      throw new Error("updateModelAction is required");
    }
    await updateModelAction({ body });
  };

  // Readonly logic - models are always editable for now (no can_edit field in API)
  const isReadonly = useMemo(() => {
    // Models don't have can_edit field yet, so always allow editing
    // TODO: Add can_edit field to ModelDetailResponse if needed
    return false;
  }, []);

  // Get department and key mappings
  const modelDataForMappings = isEditMode ? modelDetail : modelDetailDefault;
  const departmentMapping = useMemo(() => {
    return modelDataForMappings?.department_mapping || {};
  }, [modelDataForMappings]);

  const validDepartmentIds = useMemo(() => {
    return modelDataForMappings?.valid_department_ids || [];
  }, [modelDataForMappings]);

  // Get provider mapping and convert to ProviderOption array
  const providerMapping = useMemo(() => {
    return modelDataForMappings?.provider_mapping || {};
  }, [modelDataForMappings]);

  // Get current department_ids and key_id for edit mode
  const currentDepartmentIds = useMemo(() => {
    if (isEditMode && modelDetail && "department_ids" in modelDetail) {
      return (modelDetail.department_ids as string[]) || [];
    }
    return defaultDepartmentIds;
  }, [isEditMode, modelDetail, defaultDepartmentIds]);

  const currentKeyId = useMemo(() => {
    if (isEditMode && modelDetail && "default_key_id" in modelDetail) {
      return (modelDetail.default_key_id as string | null) || null;
    }
    return null;
  }, [isEditMode, modelDetail]);

  // Set breadcrumb context for model (edit mode only)
  useEffect(() => {
    if (modelDetail?.name && modelId && isEditMode) {
      setEntityMetadata({
        entityId: modelId,
        entityName: modelDetail.name,
        entityType: "model",
      });
    }
    return () => {
      if (modelId) {
        clearEntityMetadata(modelId);
      }
    };
  }, [
    modelDetail,
    modelId,
    isEditMode,
    setEntityMetadata,
    clearEntityMetadata,
  ]);

  // Get units from model detail response (already included)
  const units = useMemo(() => {
    return modelDetail?.units || modelDetailDefault?.units || [];
  }, [modelDetail, modelDetailDefault]);

  // Single consolidated useEffect to handle all form state scenarios
  useEffect(() => {
    if (isEditMode && modelDetail) {
      // We are in EDIT mode and have the model's data, so populate the form
      // Parse temperature bounds (always range)
      // API returns temperature_lower and temperature_upper, construct temperature_bounds
      let temperature_bounds: TemperatureBounds | undefined;
      const modelDetailWithTemp = modelDetail as typeof modelDetail & {
        temperature_lower?: number;
        temperature_upper?: number;
        temperature_values?: string[];
      };

      // Check if model has temperature constraints configured
      // Has temperature if temperature_values exist (indicates temperature_levels table has entries)
      const hasTempValues =
        modelDetailWithTemp.temperature_values &&
        modelDetailWithTemp.temperature_values.length > 0;
      const tempLower = modelDetailWithTemp.temperature_lower ?? 0.0;
      const tempUpper = modelDetailWithTemp.temperature_upper ?? 1.0;

      if (hasTempValues) {
        temperature_bounds = {
          type: "range",
          lower: tempLower,
          upper: tempUpper,
        };
      }

      // Parse pricing - transform to new structure
      const pricingArray =
        modelDetail.pricing?.map(
          (p: {
            type?: string;
            pricing_type?: string;
            unit_id: string;
            price: number;
          }) => ({
            type: (p.type || p.pricing_type) as "input" | "output" | "cached",
            unit_id: p.unit_id,
            price: p.price,
          })
        ) || [];

      // Transform pricing array to Record structure
      const pricing: Record<string, { unit_id: string; price: number }[]> = {};
      const selectedPricingTypesSet = new Set<string>();
      pricingArray.forEach((entry) => {
        const type = entry.type;
        selectedPricingTypesSet.add(type);
        if (!pricing[type]) {
          pricing[type] = [];
        }
        pricing[type].push({
          unit_id: entry.unit_id,
          price: entry.price,
        });
      });
      const selectedPricingTypes = Array.from(selectedPricingTypesSet);

      // Parse modalities
      const modalities = {
        input: modelDetail.modalities?.input || [],
        output: modelDetail.modalities?.output || [],
      };

      // Determine feature toggles based on existing data
      const hasModalities =
        modalities.input.length > 0 || modalities.output.length > 0;
      const hasTemperature = !!temperature_bounds;
      const hasPricing = pricing && Object.keys(pricing).length > 0;
      const hasVoices =
        modelDetail.voices &&
        (modelDetail.voices as Array<string | { voice: string }>).length > 0;
      const hasReasoningLevels =
        modelDetail.reasoning_levels && modelDetail.reasoning_levels.length > 0;
      const hasQualities =
        modelDetail.qualities && modelDetail.qualities.length > 0;

      // Determine if custom model based on base_url
      const baseUrl = modelDetail.base_url || "";
      const customModel = baseUrl !== "" && baseUrl.trim() !== "";

      setFormData({
        name: modelDetail.name,
        description: modelDetail.description,
        provider_id: modelDetail.provider_id,
        value: modelDetail.value || "",
        active:
          typeof modelDetail.active === "boolean" ? modelDetail.active : true,
        departmentIds: currentDepartmentIds,
        keyId: currentKeyId,
        customModel,
        baseUrl,
        enableModalities: hasModalities,
        enableTemperature: hasTemperature,
        enablePricing: hasPricing,
        enableVoices: hasVoices,
        enableReasoningLevels: hasReasoningLevels,
        enableQualities: hasQualities,
        ...(temperature_bounds ? { temperature_bounds } : {}),
        pricing,
        selectedPricingTypes,
        modalities:
          modalities.input.length > 0 || modalities.output.length > 0
            ? modalities
            : { input: ["text"], output: ["text"] },
        reasoning_levels: modelDetail.reasoning_levels || [],
        voices: modelDetail.voices
          ? (modelDetail.voices as Array<string | { voice: string }>)
              .map((v: string | { voice: string }) =>
                typeof v === "string" ? v : v.voice
              )
              .filter(Boolean)
          : [],
        qualities: modelDetail.qualities || [],
      });
    } else if (!isEditMode) {
      // We are in CREATE mode, so reset the form to its initial state
      setFormData({
        ...initialFormData,
        customModel: false,
        baseUrl: "",
        enableModalities: true, // Default to enabled with text/text
        enableTemperature: false,
        enablePricing: false,
        enableVoices: false,
        enableReasoningLevels: false,
        enableQualities: false,
        pricing: {},
        selectedPricingTypes: [],
        modalities: { input: ["text"], output: ["text"] }, // Default to text/text
        reasoning_levels: [],
        voices: [],
        qualities: [],
      });
    }
  }, [
    isEditMode,
    modelDetail,
    initialFormData,
    currentDepartmentIds,
    currentKeyId,
  ]);

  const handleInputChange = (
    field: keyof FormData,
    value: string | boolean | undefined
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const resetFormAndState = () => {
    setFormData(initialFormData);
    setErrors({});
  };

  // Step status logic
  const getStepStatus = useCallback(
    (stepId: string): StepStatus => {
      const hasName = !!formData?.name?.trim();
      const hasValue = !!formData?.value?.trim();
      const hasDescription = !!formData?.description?.trim();
      const hasProvider = !!formData?.provider_id?.trim();
      const hasCustomUrl =
        !formData?.customModel ||
        (formData.customModel && !!formData.baseUrl?.trim());
      const hasInputModalities =
        formData?.modalities && formData.modalities.input.length > 0;
      const hasOutputModalities =
        formData?.modalities && formData.modalities.output.length > 0;
      const hasModalities = hasInputModalities && hasOutputModalities;

      switch (stepId) {
        case "basic":
          return hasName && hasValue && hasDescription ? "completed" : "active";
        case "customUrl":
          if (!hasName || !hasValue || !hasDescription) return "pending";
          return hasCustomUrl ? "completed" : "active";
        case "provider":
          if (!hasName || !hasValue || !hasDescription) return "pending";
          return hasProvider ? "completed" : "active";
        case "inputModalities":
          if (!hasName || !hasValue || !hasDescription || !hasProvider)
            return "pending";
          return hasInputModalities ? "completed" : "active";
        case "outputModalities":
          if (!hasName || !hasValue || !hasDescription || !hasProvider)
            return "pending";
          if (!hasInputModalities) return "pending";
          return hasOutputModalities ? "completed" : "active";
        case "modalities":
          // Keep for backward compatibility, but use inputModalities and outputModalities instead
          if (!hasName || !hasValue || !hasDescription || !hasProvider)
            return "pending";
          return hasModalities ? "completed" : "active";
        case "temperature":
          if (!hasName || !hasValue || !hasDescription || !hasProvider)
            return "pending";
          if (!hasInputModalities || !hasOutputModalities) return "pending";
          return formData?.enableTemperature && formData?.temperature_bounds
            ? "completed"
            : formData?.enableTemperature
              ? "active"
              : "pending";
        case "pricing":
          if (!hasName || !hasValue || !hasDescription || !hasProvider)
            return "pending";
          if (!hasInputModalities || !hasOutputModalities) return "pending";
          // Check if pricing has any entries (new Record structure)
          const hasPricingEntries =
            formData?.enablePricing &&
            formData?.pricing &&
            Object.values(formData.pricing).some(
              (entries) => entries && entries.length > 0
            );
          return hasPricingEntries
            ? "completed"
            : formData?.enablePricing
              ? "active"
              : "pending";
        case "reasoning":
          if (!hasName || !hasValue || !hasDescription || !hasProvider)
            return "pending";
          if (!hasInputModalities || !hasOutputModalities) return "pending";
          if (!formData?.modalities?.output?.includes("text")) return "pending";
          return formData?.enableReasoningLevels &&
            formData?.reasoning_levels?.length
            ? "completed"
            : formData?.enableReasoningLevels
              ? "active"
              : "pending";
        case "voices":
          if (!hasName || !hasValue || !hasDescription || !hasProvider)
            return "pending";
          if (!hasInputModalities || !hasOutputModalities) return "pending";
          if (
            !formData?.modalities?.input?.includes("audio") ||
            !formData?.modalities?.output?.includes("audio")
          )
            return "pending";
          return formData?.enableVoices && formData?.voices?.length
            ? "completed"
            : formData?.enableVoices
              ? "active"
              : "pending";
        case "qualities":
          if (!hasName || !hasValue || !hasDescription || !hasProvider)
            return "pending";
          if (!hasInputModalities || !hasOutputModalities) return "pending";
          if (
            !formData?.modalities?.output?.includes("image") &&
            !formData?.modalities?.output?.includes("audio")
          )
            return "pending";
          return formData?.enableQualities && formData?.qualities?.length
            ? "completed"
            : formData?.enableQualities
              ? "active"
              : "pending";
        default:
          return "pending";
      }
    },
    [formData]
  );

  // Steps array
  const steps: Step[] = useMemo(() => {
    return [
      {
        id: "basic",
        title: "Basic Information",
        description:
          "Set the model name, description, value, departments, and switches.",
        status: getStepStatus("basic"),
      },
      {
        id: "customUrl",
        title: "Custom Model URL",
        description: "Configure custom base URL for this model (optional).",
        status: getStepStatus("customUrl"),
      },
      {
        id: "provider",
        title: "Provider",
        description: "Select the provider for this model.",
        status: getStepStatus("provider"),
      },
      {
        id: "inputModalities",
        title: "Input Modalities",
        description: "Configure input modalities.",
        status: getStepStatus("inputModalities"),
      },
      {
        id: "outputModalities",
        title: "Output Modalities",
        description: "Configure output modalities.",
        status: getStepStatus("outputModalities"),
      },
      {
        id: "temperature",
        title: "Temperature",
        description: "Configure temperature bounds (optional).",
        status: getStepStatus("temperature"),
      },
      {
        id: "pricing",
        title: "Pricing",
        description: "Configure pricing for this model (optional).",
        status: getStepStatus("pricing"),
      },
      {
        id: "reasoning",
        title: "Reasoning Levels",
        description: "Select reasoning levels (optional, text output only).",
        status: getStepStatus("reasoning"),
      },
      {
        id: "voices",
        title: "Voices",
        description: "Select voices (optional, audio input/output only).",
        status: getStepStatus("voices"),
      },
      {
        id: "qualities",
        title: "Qualities",
        description: "Select qualities (optional, image/audio output only).",
        status: getStepStatus("qualities"),
      },
    ];
  }, [getStepStatus]);

  // Helper to get step by ID
  const getStepById = useCallback(
    (stepId: string) => steps.find((s) => s.id === stepId),
    [steps]
  );

  // Helper to get step number (1-indexed) based on visible steps
  const getStepNumber = useCallback(
    (stepId: string): number => {
      const visibleSteps = steps.filter((step) => {
        if (step.id === "customUrl" && !formData?.customModel) return false;
        if (
          step.id === "reasoning" &&
          !formData?.modalities?.output?.includes("text")
        )
          return false;
        if (
          step.id === "voices" &&
          (!formData?.modalities?.input?.includes("audio") ||
            !formData?.modalities?.output?.includes("audio"))
        )
          return false;
        if (
          step.id === "qualities" &&
          !formData?.modalities?.output?.includes("image") &&
          !formData?.modalities?.output?.includes("audio")
        )
          return false;
        // Filter out old "modalities" step if it exists
        if (step.id === "modalities") return false;
        return true;
      });
      const index = visibleSteps.findIndex((s) => s.id === stepId);
      return index >= 0 ? index + 1 : 0;
    },
    [steps, formData]
  );

  // Custom URL editing handlers
  const handleStartEditBaseUrl = () => {
    setIsEditingBaseUrl(true);
    setEditingBaseUrlValue(formData.baseUrl || "");
  };

  const handleSaveEditBaseUrl = () => {
    handleInputChange("baseUrl", editingBaseUrlValue);
    setIsEditingBaseUrl(false);
    setEditingBaseUrlValue("");
  };

  const handleCancelEditBaseUrl = () => {
    setIsEditingBaseUrl(false);
    setEditingBaseUrlValue("");
  };

  // Calculate dots dynamically based on container width (for custom URL display)
  useEffect(() => {
    const calculateDots = () => {
      if (!dotsContainerRef.current) return;

      const container = dotsContainerRef.current;
      const containerWidth = container.offsetWidth;
      const padding = 24; // p-3 = 12px on each side
      const availableWidth = containerWidth - padding;

      // Approximate width of a dot character at text-lg (18px)
      const tempSpan = document.createElement("span");
      tempSpan.style.fontSize = "18px";
      tempSpan.style.visibility = "hidden";
      tempSpan.style.position = "absolute";
      tempSpan.textContent = "•";
      document.body.appendChild(tempSpan);
      const dotWidth = tempSpan.offsetWidth;
      document.body.removeChild(tempSpan);

      const dotsNeeded = Math.floor(availableWidth / dotWidth);
      setDotsCount(Math.max(50, dotsNeeded));
    };

    calculateDots();

    const resizeObserver = new ResizeObserver(calculateDots);
    if (dotsContainerRef.current) {
      resizeObserver.observe(dotsContainerRef.current);
    }

    window.addEventListener("resize", calculateDots);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", calculateDots);
    };
  }, [isEditMode, isEditingBaseUrl]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name) {
      setErrors((prev) => ({ ...prev, name: "Name is required" }));
      return;
    }

    if (!formData.description) {
      setErrors((prev) => ({
        ...prev,
        description: "Description is required",
      }));
      return;
    }

    if (!formData.provider_id) {
      setErrors((prev) => ({
        ...prev,
        provider_id: "Provider is required",
      }));
      return;
    }

    if (!formData.value) {
      setErrors((prev) => ({
        ...prev,
        value: "Model value is required",
      }));
      return;
    }

    // Validate base_url if custom model
    if (
      formData.customModel &&
      (!formData.baseUrl || formData.baseUrl.trim() === "")
    ) {
      setErrors((prev) => ({
        ...prev,
        baseUrl: "Base URL is required for custom models",
      }));
      return;
    }

    setIsSubmitting(true);

    try {
      // Transform temperature bounds for API (only if enabled)
      const temperature_bounds =
        formData.enableTemperature && formData.temperature_bounds
          ? {
              type: "range" as const,
              lower: formData.temperature_bounds.lower ?? 0.0,
              upper: formData.temperature_bounds.upper ?? 1.0,
            }
          : undefined;

      // Transform pricing for API (only if enabled)
      // Convert Record structure to PricingEntry[] format
      const pricing =
        formData.enablePricing &&
        formData.pricing &&
        Object.keys(formData.pricing).length > 0
          ? Object.entries(formData.pricing).flatMap(([type, entries]) =>
              entries.map((entry) => ({
                type: type as "input" | "output" | "cached",
                unit_id: entry.unit_id,
                price: entry.price,
              }))
            )
          : undefined;

      // Transform modalities for API (default to text/text if not set)
      const modalities =
        formData.modalities &&
        (formData.modalities.input.length > 0 ||
          formData.modalities.output.length > 0)
          ? {
              input: formData.modalities.input,
              output: formData.modalities.output,
            }
          : { input: ["text"], output: ["text"] }; // Server-side default

      // Ensure profileId exists - required for API calls
      if (!effectiveProfile?.id) {
        toast.error("Profile not loaded. Please refresh the page.");
        return;
      }

      // Transform voices for API (only if enabled, otherwise all voices)
      // Empty array means "all voices" (like department picker)
      const voices =
        formData.enableVoices && formData.voices && formData.voices.length > 0
          ? formData.voices
          : null; // null or empty array means "all voices" - server interprets as all

      if (isEditMode && modelId) {
        await handleUpdateModel({
          modelId: modelId,
          provider_id: formData.provider_id!,
          name: formData.name!,
          description: formData.description!,
          active: formData.active ?? true,
          value: formData.value!,
          department_ids: formData.departmentIds || null,
          base_url: formData.customModel ? formData.baseUrl || null : null,
          ...(temperature_bounds ? { temperature_bounds } : {}),
          ...(pricing ? { pricing } : {}),
          modalities,
          reasoning_levels:
            formData.enableReasoningLevels &&
            formData.reasoning_levels &&
            formData.reasoning_levels.length > 0
              ? formData.reasoning_levels
              : null,
          voices,
          qualities:
            formData.enableQualities &&
            formData.qualities &&
            formData.qualities.length > 0
              ? formData.qualities
              : null,
          profileId: effectiveProfile.id,
        });
        resetFormAndState();
        toast.success("Model updated successfully!");
        router.push(`/engine/models`);
      } else {
        await handleCreateModel({
          provider_id: formData.provider_id!,
          name: formData.name!,
          description: formData.description!,
          active: formData.active ?? true,
          value: formData.value!,
          department_ids: formData.departmentIds || null,
          base_url: formData.customModel ? formData.baseUrl || null : null,
          ...(temperature_bounds ? { temperature_bounds } : {}),
          ...(pricing ? { pricing } : {}),
          modalities,
          reasoning_levels:
            formData.enableReasoningLevels &&
            formData.reasoning_levels &&
            formData.reasoning_levels.length > 0
              ? formData.reasoning_levels
              : null,
          voices,
          qualities:
            formData.enableQualities &&
            formData.qualities &&
            formData.qualities.length > 0
              ? formData.qualities
              : null,
          profileId: effectiveProfile.id,
        });
        resetFormAndState();
        toast.success("Model created successfully!");
        router.push(`/engine/models`);
      }
    } catch (error) {
      toast.error(
        `Failed to ${isEditMode && modelId ? "update" : "create"} model: ${error instanceof Error ? error.message : "Unknown error"}`
      );
      setIsSubmitting(false);
    }
  };

  const basicStepStatus = getStepStatus("basic");

  return (
    <div className="w-full p-6 space-y-8">
      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Step 1: Basic Information */}
        <Card className="transition-all">
          <CardContent className="pt-3">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium shrink-0",
                  basicStepStatus === "completed"
                    ? "bg-green-500 text-white"
                    : "bg-primary text-primary-foreground"
                )}
              >
                {basicStepStatus === "completed" ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <span>1</span>
                )}
              </div>
              <div className="flex-1">
                {formData?.name !== undefined ? (
                  <input
                    type="text"
                    id="name"
                    data-testid="input-model-name"
                    value={formData.name}
                    onChange={(e) => handleInputChange("name", e.target.value)}
                    onFocus={(e) => {
                      if (!e.target.value || e.target.value.trim() === "") {
                        e.target.select();
                      }
                    }}
                    onBlur={() => {
                      // If empty on blur, don't revert (let validation handle it)
                    }}
                    className={cn(
                      "w-full text-2xl font-semibold border-none outline-none bg-transparent px-2 py-1 hover:bg-muted/50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:bg-muted/50 focus:ring-2 focus:ring-primary/20",
                      errors.name && "border-destructive"
                    )}
                    placeholder="New Model"
                    disabled={isReadonly || isSubmitting}
                  />
                ) : null}
                <p className="text-xs text-muted-foreground mt-1 px-2">
                  {formData?.name === "" || !formData?.name
                    ? "Click to edit • Name will be auto-generated if unchanged"
                    : "Click to edit"}
                </p>
                {errors.name && (
                  <p className="text-sm text-destructive mt-1 px-2">
                    {errors.name}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
          <CardContent className="pt-0 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              {formData?.description !== undefined ? (
                <Textarea
                  id="description"
                  data-testid="input-model-description"
                  value={formData.description || ""}
                  onChange={(e) =>
                    handleInputChange("description", e.target.value)
                  }
                  placeholder="Enter a brief description"
                  rows={3}
                  disabled={isReadonly || isSubmitting}
                  className={errors.description ? "border-destructive" : ""}
                />
              ) : null}
              {errors.description && (
                <p className="text-sm text-destructive">{errors.description}</p>
              )}
            </div>

            {/* Value */}
            <div className="space-y-2">
              <Label htmlFor="value">Value</Label>
              {formData.value !== undefined ? (
                <Input
                  id="value"
                  data-testid="input-model-value"
                  value={formData.value}
                  onChange={(e) => handleInputChange("value", e.target.value)}
                  placeholder="Enter model value identifier (e.g., gpt-4, gemini-pro)"
                  className={errors.value ? "border-destructive" : ""}
                  disabled={isReadonly || isSubmitting}
                />
              ) : null}
              {errors.value && (
                <p className="text-sm text-destructive">{errors.value}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Unique identifier for this model (used in API calls)
              </p>
            </div>

            {/* Department Selection */}
            {validDepartmentIds && validDepartmentIds.length > 1 && (
              <div className="space-y-2">
                <Label htmlFor="department">Department</Label>
                {formData?.departmentIds !== undefined ? (
                  <GenericPicker
                    items={departmentMapping}
                    itemIds={validDepartmentIds}
                    selectedIds={formData.departmentIds || []}
                    onSelect={(ids) =>
                      setFormData((prev) => ({
                        ...prev,
                        departmentIds: ids,
                      }))
                    }
                    getId={(dept) => (dept as unknown as { id: string }).id}
                    getLabel={(dept) => dept.name || ""}
                    getSearchText={(dept) =>
                      `${dept.name} ${dept.description || ""}`
                    }
                    placeholder="All Departments"
                    disabled={isReadonly || isSubmitting}
                    multiSelect={true}
                    hideSelectedChips={true}
                    buttonClassName="w-full"
                  />
                ) : null}
              </div>
            )}

            {/* Active Switch */}
            <div className="space-y-2 pt-2">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Label
                    htmlFor="active"
                    className="text-sm flex items-center gap-1.5"
                  >
                    <Power className="h-3.5 w-3.5 text-muted-foreground" />
                    Active
                  </Label>
                  {formData?.active !== undefined ? (
                    <Switch
                      id="active"
                      data-testid="switch-model-active"
                      checked={formData.active ?? true}
                      onCheckedChange={(checked) =>
                        handleInputChange("active", checked)
                      }
                      disabled={isReadonly || isSubmitting}
                    />
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground pl-5">
                  Inactive models will not be available for selection
                </p>
              </div>

              {/* Custom Model Switch */}
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Label
                    htmlFor="customModel"
                    className="text-sm flex items-center gap-1.5"
                  >
                    <Settings className="h-3.5 w-3.5 text-muted-foreground" />
                    Custom Model
                  </Label>
                  {formData?.customModel !== undefined ? (
                    <Switch
                      id="customModel"
                      data-testid="switch-model-custom"
                      checked={formData.customModel}
                      onCheckedChange={(checked) => {
                        handleInputChange("customModel", checked);
                        if (!checked) {
                          handleInputChange("baseUrl", "");
                        }
                      }}
                      disabled={isSubmitting || isReadonly}
                    />
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground pl-5">
                  Use a custom base URL for this model
                </p>
              </div>

              {/* Temperature Switch */}
              <div className="space-y-2 pt-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Label
                      htmlFor="enable-temperature"
                      className="text-sm flex items-center gap-1.5"
                    >
                      <Thermometer className="h-3.5 w-3.5 text-muted-foreground" />
                      Temperature
                    </Label>
                    {formData?.enableTemperature !== undefined ? (
                      <Switch
                        id="enable-temperature"
                        data-testid="switch-model-temperature"
                        checked={formData.enableTemperature || false}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setFormData((prev) => ({
                              ...prev,
                              enableTemperature: true,
                              temperature_bounds: prev.temperature_bounds || {
                                type: "range",
                                lower: 0.0,
                                upper: 1.0,
                              },
                            }));
                          } else {
                            const { temperature_bounds: _, ...rest } = formData;
                            setFormData({
                              ...rest,
                              enableTemperature: false,
                            } as FormData);
                          }
                        }}
                        disabled={isSubmitting || isReadonly}
                      />
                    ) : null}
                  </div>
                  <p className="text-xs text-muted-foreground pl-5">
                    Configure temperature bounds for this model
                  </p>
                </div>
              </div>

              {/* Pricing Switch */}
              <div className="space-y-2 pt-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Label
                      htmlFor="enable-pricing"
                      className="text-sm flex items-center gap-1.5"
                    >
                      <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                      Pricing
                    </Label>
                    {formData?.enablePricing !== undefined ? (
                      <Switch
                        id="enable-pricing"
                        data-testid="switch-model-pricing"
                        checked={formData.enablePricing || false}
                        onCheckedChange={(checked) => {
                          setFormData((prev) => ({
                            ...prev,
                            enablePricing: checked,
                            pricing: checked ? prev.pricing || {} : {},
                            selectedPricingTypes: checked
                              ? prev.selectedPricingTypes || []
                              : [],
                          }));
                        }}
                        disabled={isSubmitting || isReadonly}
                      />
                    ) : null}
                  </div>
                  <p className="text-xs text-muted-foreground pl-5">
                    Configure pricing for this model
                  </p>
                </div>
              </div>

              {/* Reasoning Switch */}
              <div className="space-y-2 pt-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Label
                      htmlFor="enable-reasoning"
                      className="text-sm flex items-center gap-1.5"
                    >
                      <Brain className="h-3.5 w-3.5 text-muted-foreground" />
                      Reasoning
                    </Label>
                    {formData?.enableReasoningLevels !== undefined ? (
                      <Switch
                        id="enable-reasoning"
                        data-testid="switch-model-reasoning"
                        checked={formData.enableReasoningLevels || false}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setFormData((prev) => ({
                              ...prev,
                              enableReasoningLevels: true,
                              reasoning_levels:
                                prev.reasoning_levels &&
                                prev.reasoning_levels.length > 0
                                  ? prev.reasoning_levels
                                  : [],
                            }));
                          } else {
                            const { reasoning_levels: _, ...rest } = formData;
                            setFormData({
                              ...rest,
                              enableReasoningLevels: false,
                            } as FormData);
                          }
                        }}
                        disabled={isSubmitting || isReadonly}
                      />
                    ) : null}
                  </div>
                  <p className="text-xs text-muted-foreground pl-5">
                    Select reasoning levels for this model
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Step 2: Custom Model URL */}
        {formData?.customModel &&
          (() => {
            const step = getStepById("customUrl");
            const stepNumber = getStepNumber("customUrl");
            return (
              <Card
                className={cn(
                  "transition-all",
                  !isEditMode &&
                    step?.status === "active" &&
                    "ring-2 ring-primary",
                  !isEditMode && step?.status === "pending" && "opacity-50"
                )}
              >
                <CardHeader className="flex flex-row items-center space-y-0 pb-2 justify-between">
                  <div className="flex items-center space-x-3">
                    <div
                      className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium",
                        step?.status === "completed"
                          ? "bg-green-500 text-white"
                          : step?.status === "active"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                      )}
                    >
                      {step?.status === "completed" ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <span>{stepNumber}</span>
                      )}
                    </div>
                    <div>
                      <CardTitle className="text-lg">
                        {step?.title || "Custom Model URL"}
                      </CardTitle>
                      <CardDescription>
                        {step?.description ||
                          "Configure custom base URL for this model (optional)."}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 px-6">
                  <div className="space-y-2">
                    <Label htmlFor="baseUrl">Base URL</Label>
                    {!isEditMode || isEditingBaseUrl ? (
                      <div className="flex items-center gap-2">
                        <Textarea
                          id="baseUrl"
                          data-testid="input-model-base-url"
                          value={
                            isEditingBaseUrl
                              ? editingBaseUrlValue
                              : formData.baseUrl || ""
                          }
                          onChange={(e) => {
                            if (isEditingBaseUrl) {
                              setEditingBaseUrlValue(e.target.value);
                            } else {
                              handleInputChange("baseUrl", e.target.value);
                            }
                          }}
                          placeholder="e.g. https://api.example.com/v1"
                          className={cn(
                            "flex-1 h-10 resize-none",
                            errors.baseUrl ? "border-destructive" : ""
                          )}
                          disabled={isReadonly || isSubmitting}
                          onKeyDown={(e) => {
                            if (isEditingBaseUrl) {
                              if (e.key === "Enter" && e.ctrlKey) {
                                handleSaveEditBaseUrl();
                              } else if (e.key === "Escape") {
                                handleCancelEditBaseUrl();
                              }
                            }
                          }}
                        />
                        {isEditingBaseUrl && (
                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                handleSaveEditBaseUrl();
                              }}
                              disabled={isReadonly || isSubmitting}
                              className="h-6 w-6 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                            >
                              <Check className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                handleCancelEditBaseUrl();
                              }}
                              disabled={isReadonly || isSubmitting}
                              className="h-6 w-6 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 w-full">
                        <div
                          ref={dotsContainerRef}
                          className="flex-1 p-3 bg-muted rounded-md border h-10 flex items-center w-full overflow-hidden"
                        >
                          {formData.baseUrl ? (
                            <code className="text-sm break-all w-full">
                              {formData.baseUrl}
                            </code>
                          ) : (
                            <span className="text-muted-foreground text-lg whitespace-nowrap">
                              {"•".repeat(dotsCount)}
                            </span>
                          )}
                        </div>
                        {!isReadonly && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={handleStartEditBaseUrl}
                            disabled={isSubmitting}
                            className="shrink-0"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    )}
                    {errors.baseUrl && (
                      <p className="text-sm text-destructive">
                        {errors.baseUrl}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })()}

        {/* Step 3: Provider Selection */}
        {(() => {
          const step = getStepById("provider");
          const stepNumber = getStepNumber("provider");
          return (
            <Card
              className={cn(
                "transition-all",
                !isEditMode &&
                  step?.status === "active" &&
                  "ring-2 ring-primary",
                !isEditMode && step?.status === "pending" && "opacity-50"
              )}
            >
              <CardHeader className="flex flex-row items-center space-y-0 pb-2 justify-between">
                <div className="flex items-center space-x-3">
                  <div
                    className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium",
                      step?.status === "completed"
                        ? "bg-green-500 text-white"
                        : step?.status === "active"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                    )}
                  >
                    {step?.status === "completed" ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <span>{stepNumber}</span>
                    )}
                  </div>
                  <div>
                    <CardTitle className="text-lg">
                      {step?.title || "Provider"}
                    </CardTitle>
                    <CardDescription>
                      {step?.description ||
                        "Select the provider for this model."}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 px-6">
                <ProviderCardGrid
                  providerMapping={providerMapping}
                  validProviderIds={Object.keys(providerMapping)}
                  selectedProviderId={formData.provider_id || null}
                  onSelect={(providerId) => {
                    handleInputChange("provider_id", providerId || "");
                  }}
                  readonly={isReadonly || isSubmitting}
                />
                {errors.provider_id && (
                  <p className="text-sm text-destructive">
                    {errors.provider_id}
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })()}

        {/* Step 4: Input Modalities */}
        {(() => {
          const step = getStepById("inputModalities");
          const stepNumber = getStepNumber("inputModalities");
          return (
            <Card
              className={cn(
                "transition-all",
                !isEditMode &&
                  step?.status === "active" &&
                  "ring-2 ring-primary",
                !isEditMode && step?.status === "pending" && "opacity-50"
              )}
            >
              <CardHeader className="flex flex-row items-center space-y-0 pb-2 justify-between">
                <div className="flex items-center space-x-3">
                  <div
                    className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium",
                      step?.status === "completed"
                        ? "bg-green-500 text-white"
                        : step?.status === "active"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                    )}
                  >
                    {step?.status === "completed" ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <span>{stepNumber}</span>
                    )}
                  </div>
                  <div>
                    <CardTitle className="text-lg">
                      {step?.title || "Input Modalities"}
                    </CardTitle>
                    <CardDescription>
                      {step?.description || "Configure input modalities."}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 px-6">
                <InputModalityCardGrid
                  selectedIds={formData.modalities?.input || ["text"]}
                  onSelect={(ids) =>
                    setFormData((prev) => ({
                      ...prev,
                      modalities: {
                        input: ids.length > 0 ? ids : ["text"],
                        output: prev.modalities?.output || ["text"],
                      },
                    }))
                  }
                  readonly={isReadonly || isSubmitting}
                />
              </CardContent>
            </Card>
          );
        })()}

        {/* Step 5: Output Modalities */}
        {(() => {
          const step = getStepById("outputModalities");
          const stepNumber = getStepNumber("outputModalities");
          return (
            <Card
              className={cn(
                "transition-all",
                !isEditMode &&
                  step?.status === "active" &&
                  "ring-2 ring-primary",
                !isEditMode && step?.status === "pending" && "opacity-50"
              )}
            >
              <CardHeader className="flex flex-row items-center space-y-0 pb-2 justify-between">
                <div className="flex items-center space-x-3">
                  <div
                    className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium",
                      step?.status === "completed"
                        ? "bg-green-500 text-white"
                        : step?.status === "active"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                    )}
                  >
                    {step?.status === "completed" ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <span>{stepNumber}</span>
                    )}
                  </div>
                  <div>
                    <CardTitle className="text-lg">
                      {step?.title || "Output Modalities"}
                    </CardTitle>
                    <CardDescription>
                      {step?.description || "Configure output modalities."}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 px-6">
                <OutputModalityCardGrid
                  selectedIds={formData.modalities?.output || ["text"]}
                  onSelect={(ids) =>
                    setFormData((prev) => ({
                      ...prev,
                      modalities: {
                        input: prev.modalities?.input || ["text"],
                        output: ids.length > 0 ? ids : ["text"],
                      },
                    }))
                  }
                  readonly={isReadonly || isSubmitting}
                />
              </CardContent>
            </Card>
          );
        })()}

        {/* Step 6: Temperature */}
        {formData.enableTemperature &&
          (() => {
            const step = getStepById("temperature");
            const stepNumber = getStepNumber("temperature");
            return (
              <Card
                className={cn(
                  "transition-all",
                  !isEditMode &&
                    step?.status === "active" &&
                    "ring-2 ring-primary",
                  !isEditMode && step?.status === "pending" && "opacity-50"
                )}
              >
                <CardHeader className="flex flex-row items-center space-y-0 pb-2 justify-between">
                  <div className="flex items-center space-x-3">
                    <div
                      className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium",
                        step?.status === "completed"
                          ? "bg-green-500 text-white"
                          : step?.status === "active"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                      )}
                    >
                      {step?.status === "completed" ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <span>{stepNumber}</span>
                      )}
                    </div>
                    <div>
                      <CardTitle className="text-lg">
                        {step?.title || "Temperature"}
                      </CardTitle>
                      <CardDescription>
                        {step?.description ||
                          "Configure temperature bounds (optional)."}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 px-6">
                  <TemperatureBoundsPicker
                    bounds={
                      formData.temperature_bounds || {
                        type: "range",
                        lower: 0.0,
                        upper: 1.0,
                      }
                    }
                    onBoundsChange={(bounds) =>
                      setFormData((prev) => ({
                        ...prev,
                        temperature_bounds: bounds,
                      }))
                    }
                    disabled={isSubmitting || isReadonly}
                  />
                </CardContent>
              </Card>
            );
          })()}

        {/* Step 7: Pricing */}
        {formData.enablePricing &&
          (() => {
            const step = getStepById("pricing");
            const stepNumber = getStepNumber("pricing");

            // Step for pricing type selection
            return (
              <>
                <Card
                  className={cn(
                    "transition-all",
                    !isEditMode &&
                      step?.status === "active" &&
                      "ring-2 ring-primary",
                    !isEditMode && step?.status === "pending" && "opacity-50"
                  )}
                >
                  <CardHeader className="flex flex-row items-center space-y-0 pb-2 justify-between">
                    <div className="flex items-center space-x-3">
                      <div
                        className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium",
                          step?.status === "completed"
                            ? "bg-green-500 text-white"
                            : step?.status === "active"
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted"
                        )}
                      >
                        {step?.status === "completed" ? (
                          <Check className="w-4 h-4" />
                        ) : (
                          <span>{stepNumber}</span>
                        )}
                      </div>
                      <div>
                        <CardTitle className="text-lg">
                          {step?.title || "Pricing"}
                        </CardTitle>
                        <CardDescription>
                          {step?.description ||
                            "Configure pricing for this model (optional)."}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4 px-6">
                    <PricingTypeCardGrid
                      selectedIds={formData.selectedPricingTypes || []}
                      onSelect={(ids) => {
                        setFormData((prev) => {
                          const newPricing = { ...prev.pricing };
                          const newSelectedTypes = ids;

                          // Remove pricing data for deselected types
                          Object.keys(newPricing).forEach((type) => {
                            if (!newSelectedTypes.includes(type)) {
                              delete newPricing[type];
                            }
                          });

                          // Initialize empty arrays for newly selected types
                          newSelectedTypes.forEach((type) => {
                            if (!newPricing[type]) {
                              newPricing[type] = [];
                            }
                          });

                          return {
                            ...prev,
                            selectedPricingTypes: newSelectedTypes,
                            pricing: newPricing,
                          };
                        });
                      }}
                      readonly={isReadonly || isSubmitting}
                    />
                  </CardContent>
                </Card>

                {/* Individual Pricing Type Sections */}
                {(formData.selectedPricingTypes || []).map((pricingType) => {
                  const pricingEntries = formData.pricing?.[pricingType] || [];
                  const selectedUnitIds = pricingEntries.map((e) => e.unit_id);
                  const typeLabel =
                    pricingType.charAt(0).toUpperCase() + pricingType.slice(1);

                  return (
                    <Card
                      key={pricingType}
                      className={cn(
                        "transition-all",
                        !isEditMode &&
                          step?.status === "active" &&
                          "ring-2 ring-primary",
                        !isEditMode &&
                          step?.status === "pending" &&
                          "opacity-50"
                      )}
                    >
                      <CardHeader className="flex flex-row items-center space-y-0 pb-2 justify-between">
                        <div className="flex items-center space-x-3">
                          <div
                            className={cn(
                              "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium",
                              pricingEntries.length > 0
                                ? "bg-green-500 text-white"
                                : step?.status === "active"
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-muted"
                            )}
                          >
                            {pricingEntries.length > 0 ? (
                              <Check className="w-4 h-4" />
                            ) : (
                              <span>{stepNumber}</span>
                            )}
                          </div>
                          <div>
                            <CardTitle className="text-lg">
                              {typeLabel} Pricing
                            </CardTitle>
                            <CardDescription>
                              Configure pricing entries for {pricingType} tokens
                            </CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-6 px-6">
                        {/* Unit Selection with Inline Price Editing */}
                        <UnitCardGrid
                          units={units}
                          selectedIds={selectedUnitIds}
                          onSelect={(unitIds) => {
                            setFormData((prev) => {
                              const newPricing = { ...prev.pricing };
                              if (!newPricing[pricingType]) {
                                newPricing[pricingType] = [];
                              }

                              // Get current entries
                              const currentEntries =
                                newPricing[pricingType] || [];
                              const currentUnitIds = new Set(
                                currentEntries.map((e) => e.unit_id)
                              );

                              // Find added and removed units
                              const newUnitIds = new Set(unitIds);
                              const addedUnitIds = unitIds.filter(
                                (id) => !currentUnitIds.has(id)
                              );
                              const removedUnitIds = Array.from(
                                currentUnitIds
                              ).filter((id) => !newUnitIds.has(id));

                              // Remove entries for deselected units
                              const updatedEntries = currentEntries.filter(
                                (e) => !removedUnitIds.includes(e.unit_id)
                              );

                              // Add entries for newly selected units
                              addedUnitIds.forEach((unitId) => {
                                updatedEntries.push({
                                  unit_id: unitId,
                                  price: 0.0,
                                });
                              });

                              newPricing[pricingType] = updatedEntries;

                              return {
                                ...prev,
                                pricing: newPricing,
                              };
                            });
                          }}
                          readonly={isReadonly || isSubmitting}
                          enablePriceEditing={true}
                          prices={Object.fromEntries(
                            pricingEntries.map((e) => [e.unit_id, e.price])
                          )}
                          onPriceChange={(unitId, price) => {
                            setFormData((prev) => {
                              const newPricing = { ...prev.pricing };
                              if (!newPricing[pricingType]) {
                                newPricing[pricingType] = [];
                              }

                              // Find and update the entry for this unit
                              const entries = newPricing[pricingType] || [];
                              const entryIndex = entries.findIndex(
                                (e) => e.unit_id === unitId
                              );

                              if (entryIndex >= 0 && entries[entryIndex]) {
                                entries[entryIndex] = {
                                  unit_id: entries[entryIndex].unit_id,
                                  price,
                                };
                              } else {
                                // If entry doesn't exist, add it
                                entries.push({
                                  unit_id: unitId,
                                  price,
                                });
                              }

                              newPricing[pricingType] = entries;

                              return {
                                ...prev,
                                pricing: newPricing,
                              };
                            });
                          }}
                        />
                      </CardContent>
                    </Card>
                  );
                })}
              </>
            );
          })()}

        {/* Step 8: Reasoning Levels */}
        {formData.modalities?.output?.includes("text") &&
          formData.enableReasoningLevels &&
          (() => {
            const step = getStepById("reasoning");
            const stepNumber = getStepNumber("reasoning");
            return (
              <Card
                className={cn(
                  "transition-all",
                  !isEditMode &&
                    step?.status === "active" &&
                    "ring-2 ring-primary",
                  !isEditMode && step?.status === "pending" && "opacity-50"
                )}
              >
                <CardHeader className="flex flex-row items-center space-y-0 pb-2 justify-between">
                  <div className="flex items-center space-x-3">
                    <div
                      className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium",
                        step?.status === "completed"
                          ? "bg-green-500 text-white"
                          : step?.status === "active"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                      )}
                    >
                      {step?.status === "completed" ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <span>{stepNumber}</span>
                      )}
                    </div>
                    <div>
                      <CardTitle className="text-lg">
                        {step?.title || "Reasoning Levels"}
                      </CardTitle>
                      <CardDescription>
                        {step?.description ||
                          "Select reasoning levels (optional, text output only)."}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 px-6">
                  <ReasoningCardGrid
                    selectedIds={formData.reasoning_levels || []}
                    onSelect={(ids) =>
                      setFormData((prev) => ({
                        ...prev,
                        reasoning_levels: ids,
                      }))
                    }
                    readonly={isReadonly || isSubmitting}
                  />
                </CardContent>
              </Card>
            );
          })()}

        {/* Step 9: Voices */}
        {formData.modalities?.input?.includes("audio") &&
          formData.modalities?.output?.includes("audio") &&
          (() => {
            const step = getStepById("voices");
            const stepNumber = getStepNumber("voices");
            return (
              <Card
                className={cn(
                  "transition-all",
                  !isEditMode &&
                    step?.status === "active" &&
                    "ring-2 ring-primary",
                  !isEditMode && step?.status === "pending" && "opacity-50"
                )}
              >
                <CardHeader className="flex flex-row items-center space-y-0 pb-2 justify-between">
                  <div className="flex items-center space-x-3">
                    <div
                      className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium",
                        step?.status === "completed"
                          ? "bg-green-500 text-white"
                          : step?.status === "active"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                      )}
                    >
                      {step?.status === "completed" ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <span>{stepNumber}</span>
                      )}
                    </div>
                    <div>
                      <CardTitle className="text-lg">
                        {step?.title || "Voices"}
                      </CardTitle>
                      <CardDescription>
                        {step?.description ||
                          "Select voices (optional, audio input/output only)."}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 px-6">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Volume2 className="h-4 w-4 text-muted-foreground" />
                      <Label
                        htmlFor="enable-voices"
                        className="text-sm font-medium"
                      >
                        Enable Voice Selection
                      </Label>
                      <Switch
                        id="enable-voices"
                        checked={formData.enableVoices || false}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setFormData((prev) => ({
                              ...prev,
                              enableVoices: true,
                              voices:
                                prev.voices && prev.voices.length > 0
                                  ? prev.voices
                                  : [],
                            }));
                          } else {
                            const { voices: _, ...rest } = formData;
                            setFormData({
                              ...rest,
                              enableVoices: false,
                            } as FormData);
                          }
                        }}
                        disabled={isSubmitting || isReadonly}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground pl-6">
                      Select specific voices for this model. If disabled or none
                      selected, all available voices are allowed.
                    </p>
                  </div>
                  {formData.enableVoices && (
                    <div className="pt-2">
                      <VoiceCardGrid
                        selectedIds={formData.voices || []}
                        onSelect={(ids) =>
                          setFormData((prev) => ({
                            ...prev,
                            voices: ids.length > 0 ? ids : [],
                          }))
                        }
                        readonly={isReadonly || isSubmitting}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })()}

        {/* Step 10: Qualities */}
        {(formData.modalities?.output?.includes("image") ||
          formData.modalities?.output?.includes("audio")) &&
          (() => {
            const step = getStepById("qualities");
            const stepNumber = getStepNumber("qualities");
            return (
              <Card
                className={cn(
                  "transition-all",
                  !isEditMode &&
                    step?.status === "active" &&
                    "ring-2 ring-primary",
                  !isEditMode && step?.status === "pending" && "opacity-50"
                )}
              >
                <CardHeader className="flex flex-row items-center space-y-0 pb-2 justify-between">
                  <div className="flex items-center space-x-3">
                    <div
                      className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium",
                        step?.status === "completed"
                          ? "bg-green-500 text-white"
                          : step?.status === "active"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                      )}
                    >
                      {step?.status === "completed" ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <span>{stepNumber}</span>
                      )}
                    </div>
                    <div>
                      <CardTitle className="text-lg">
                        {step?.title || "Qualities"}
                      </CardTitle>
                      <CardDescription>
                        {step?.description ||
                          "Select qualities (optional, image/audio output only)."}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 px-6">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      {/* eslint-disable-next-line jsx-a11y/alt-text */}
                      <Image
                        className="h-4 w-4 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <Label
                        htmlFor="enable-qualities"
                        className="text-sm font-medium"
                      >
                        Enable Qualities
                      </Label>
                      <Switch
                        id="enable-qualities"
                        checked={formData.enableQualities || false}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setFormData((prev) => ({
                              ...prev,
                              enableQualities: true,
                              qualities:
                                prev.qualities && prev.qualities.length > 0
                                  ? prev.qualities
                                  : [],
                            }));
                          } else {
                            const { qualities: _, ...rest } = formData;
                            setFormData({
                              ...rest,
                              enableQualities: false,
                            } as FormData);
                          }
                        }}
                        disabled={isSubmitting || isReadonly}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground pl-6">
                      Select specific quality levels for this model. If
                      disabled, all available quality levels are allowed.
                    </p>
                  </div>
                  {formData.enableQualities && (
                    <div className="pt-2">
                      <QualityCardGrid
                        selectedIds={formData.qualities || []}
                        onSelect={(ids) =>
                          setFormData((prev) => ({ ...prev, qualities: ids }))
                        }
                        readonly={isReadonly || isSubmitting}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })()}

        {/* Submit Button */}
        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={isSubmitting}
          >
            Back
          </Button>
          <Button
            type="submit"
            data-testid="btn-submit-model"
            disabled={isSubmitting}
            className="min-w-[120px]"
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                {isEditMode && modelId ? "Updating..." : "Creating..."}
              </>
            ) : isEditMode && modelId ? (
              "Update Model"
            ) : (
              "Create Model"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
