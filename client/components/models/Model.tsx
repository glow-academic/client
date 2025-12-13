/**
 * Model.tsx
 * Used to create and manage models for the admin dashboard
 * @AshokSaravanan222 & @siladiea
 * 06/18/2025
 */
"use client";
import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

// UI Components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

import { GenericPicker } from "@/components/common/forms/GenericPicker";
import { MODALITIES } from "@/components/common/forms/modalities";
import {
  PricingPicker,
  type PricingEntry,
} from "@/components/common/forms/PricingPicker";
import { ProviderPicker } from "@/components/common/forms/ProviderPicker";
import { QUALITIES } from "@/components/common/forms/qualities";
import { REASONING_LEVELS } from "@/components/common/forms/reasoning-levels";
import {
  TemperatureBoundsPicker,
  type TemperatureBounds,
} from "@/components/common/forms/TemperatureBoundsPicker";
import { VOICES } from "@/components/common/forms/voices";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { useBreadcrumbContext } from "@/contexts/breadcrumb-context";
import { useProfile } from "@/contexts/profile-context";
import { getDefaultDepartmentIds } from "@/utils/department-picker-helpers";
import {
  Brain,
  DollarSign,
  Image,
  Layers,
  Power,
  Settings,
  Thermometer,
  Volume2,
} from "lucide-react";
import { useRouter } from "next/navigation";

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
  pricing?: PricingEntry[];
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
      name: "",
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


  // Convert provider_mapping to ProviderOption array for ProviderPicker
  const providerOptions = useMemo(() => {
    return Object.entries(providerMapping).map(([id, data]) => ({
      id,
      name: data.name,
      description: data.description,
      value: "", // Will be populated from provider detail if needed
    }));
  }, [providerMapping]);

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

      // Parse pricing
      const pricing: PricingEntry[] =
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

      // Parse modalities
      const modalities = {
        input: modelDetail.modalities?.input || [],
        output: modelDetail.modalities?.output || [],
      };

      // Determine feature toggles based on existing data
      const hasModalities =
        modalities.input.length > 0 || modalities.output.length > 0;
      const hasTemperature = !!temperature_bounds;
      const hasPricing = pricing && pricing.length > 0;
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
        pricing: [],
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
      const pricing =
        formData.enablePricing &&
        formData.pricing &&
        formData.pricing.length > 0
          ? formData.pricing.map((p) => ({
              type: p.type,
              unit_id: p.unit_id,
              price: p.price,
            }))
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

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Model Information */}
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          {formData.name !== undefined ? (
            <Input
              id="name"
              data-testid="input-model-name"
              value={formData.name}
              onChange={(e) => handleInputChange("name", e.target.value)}
              placeholder="Enter model name"
              className={errors.name ? "border-destructive" : ""}
            />
          ) : null}
          {errors.name && (
            <p className="text-sm text-destructive">{errors.name}</p>
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

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          {formData.description !== undefined ? (
            <Textarea
              id="description"
              data-testid="input-model-description"
              value={formData.description}
              onChange={(e) => handleInputChange("description", e.target.value)}
              placeholder="Enter model description"
              rows={3}
              className={errors.description ? "border-destructive" : ""}
            />
          ) : null}
          {errors.description && (
            <p className="text-sm text-destructive">{errors.description}</p>
          )}
        </div>

        {/* Department Selection */}
        {validDepartmentIds && validDepartmentIds.length > 1 ? (
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
                multiSelect={true}
                hideSelectedChips={true}
                buttonClassName="w-full"
              />
            ) : null}
          </div>
        ) : null}

        {/* Active Switch */}
        <div className="space-y-1 pt-2">
          <div className="flex items-center gap-2">
            <Label
              htmlFor="active"
              className="text-sm flex items-center gap-1.5"
            >
              <Power className="h-3.5 w-3.5 text-muted-foreground" />
              Active
            </Label>
            {formData.active !== undefined ? (
              <Switch
                id="active"
                data-testid="switch-model-active"
                checked={formData.active}
                onCheckedChange={(checked) =>
                  handleInputChange("active", checked)
                }
              />
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground pl-5">
            Inactive models will not be available for selection
          </p>
        </div>

        {/* Custom Model Switch */}
        <div className="space-y-1 pt-2">
          <div className="flex items-center gap-2">
            <Label
              htmlFor="customModel"
              className="text-sm flex items-center gap-1.5"
            >
              <Settings className="h-3.5 w-3.5 text-muted-foreground" />
              Custom Model
            </Label>
            {formData.customModel !== undefined ? (
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
          {formData.customModel && (
            <div className="space-y-2 pt-2 pl-5">
              <Input
                id="baseUrl"
                type="url"
                value={formData.baseUrl || ""}
                onChange={(e) => handleInputChange("baseUrl", e.target.value)}
                placeholder="e.g. https://api.example.com/v1"
                disabled={isSubmitting || isReadonly}
                className={errors.baseUrl ? "border-destructive" : ""}
                data-testid="input-model-base-url"
              />
              {errors.baseUrl && (
                <p className="text-sm text-destructive">{errors.baseUrl}</p>
              )}
            </div>
          )}
        </div>

        {/* Provider Selection */}
        <div className="space-y-2">
          <Label htmlFor="provider">Provider</Label>
          <div data-testid="picker-provider">
            <ProviderPicker
              providers={providerOptions}
              selectedProvider={formData.provider_id || ""}
              onSelect={(providerId) => {
                handleInputChange("provider_id", providerId);
              }}
              placeholder="Select a provider..."
              buttonClassName={errors.provider_id ? "border-destructive" : ""}
            />
          </div>
          {errors.provider_id && (
            <p className="text-sm text-destructive">{errors.provider_id}</p>
          )}
        </div>

        {/* Modalities - Collapsible with Switch */}
        <Collapsible
          open={formData.enableModalities !== false}
          onOpenChange={(open) => {
            setFormData((prev) => ({
              ...prev,
              enableModalities: open,
              modalities: open
                ? prev.modalities || { input: ["text"], output: ["text"] }
                : { input: ["text"], output: ["text"] },
            }));
          }}
        >
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <div className="space-y-1 flex-1">
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-muted-foreground" />
                  <Label
                    htmlFor="enable-modalities"
                    className="text-sm font-medium"
                  >
                    Modalities
                  </Label>
                  <Switch
                    id="enable-modalities"
                    checked={formData.enableModalities !== false}
                    onCheckedChange={(checked) => {
                      setFormData((prev) => ({
                        ...prev,
                        enableModalities: checked,
                        modalities: checked
                          ? prev.modalities || {
                              input: ["text"],
                              output: ["text"],
                            }
                          : { input: ["text"], output: ["text"] },
                      }));
                    }}
                    disabled={isSubmitting || isReadonly}
                  />
                </div>
                <p className="text-xs text-muted-foreground pl-6">
                  Configure input and output modalities for this model. Defaults
                  to text/text.
                </p>
              </div>
            </div>
            <CollapsibleContent>
              {formData.enableModalities !== false && (
                <div className="pl-6 pt-1">
                  <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Input</label>
                      <GenericPicker
                        items={[...MODALITIES]}
                        selectedIds={formData.modalities?.input || ["text"]}
                        onSelect={(modalities) =>
                          setFormData((prev) => ({
                            ...prev,
                            modalities: {
                              input: modalities.length > 0 ? modalities : ["text"],
                              output: prev.modalities?.output || ["text"],
                            },
                          }))
                        }
                        getId={(item) => item.id}
                        getLabel={(item) => item.name}
                        getSearchText={(item) => item.name}
                        disabled={isSubmitting || isReadonly}
                        multiSelect={true}
                        hideSelectedChips={true}
                        buttonClassName="w-full"
                        groupHeading="Input Modalities"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Output</label>
                      <GenericPicker
                        items={[...MODALITIES]}
                        selectedIds={formData.modalities?.output || ["text"]}
                        onSelect={(modalities) =>
                          setFormData((prev) => ({
                            ...prev,
                            modalities: {
                              input: prev.modalities?.input || ["text"],
                              output: modalities.length > 0 ? modalities : ["text"],
                            },
                          }))
                        }
                        getId={(item) => item.id}
                        getLabel={(item) => item.name}
                        getSearchText={(item) => item.name}
                        disabled={isSubmitting || isReadonly}
                        multiSelect={true}
                        hideSelectedChips={true}
                        buttonClassName="w-full"
                        groupHeading="Output Modalities"
                      />
                    </div>
                  </div>
                </div>
              )}
            </CollapsibleContent>
          </div>
        </Collapsible>

        {/* Advanced Configuration Section */}
        <div className="space-y-4">
          {/* Temperature Bounds - Collapsible with Switch */}
          <Collapsible
            open={formData.enableTemperature || false}
            onOpenChange={(open) => {
              setFormData((prev) => ({
                ...prev,
                enableTemperature: open,
                ...(open
                  ? {
                      temperature_bounds: prev.temperature_bounds || {
                        type: "range",
                        lower: 0.0,
                        upper: 1.0,
                      },
                    }
                  : {}),
              }));
            }}
          >
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    <Thermometer className="h-4 w-4 text-muted-foreground" />
                    <Label
                      htmlFor="enable-temperature"
                      className="text-sm font-medium"
                    >
                      Temperature
                    </Label>
                    <Switch
                      id="enable-temperature"
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
                  </div>
                  <p className="text-xs text-muted-foreground pl-6">
                    Restrict temperature values for this model. If disabled, any
                    temperature value is allowed.
                  </p>
                </div>
              </div>
              <CollapsibleContent>
                {formData.enableTemperature && (
                  <div className="pl-6 pt-1">
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
                  </div>
                )}
              </CollapsibleContent>
            </div>
          </Collapsible>

          {/* Pricing - Collapsible with Switch */}
          <Collapsible
            open={formData.enablePricing || false}
            onOpenChange={(open) => {
              setFormData((prev) => ({
                ...prev,
                enablePricing: open,
                pricing: open ? prev.pricing || [] : [],
              }));
            }}
          >
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    <Label
                      htmlFor="enable-pricing"
                      className="text-sm font-medium"
                    >
                      Pricing
                    </Label>
                    <Switch
                      id="enable-pricing"
                      checked={formData.enablePricing || false}
                      onCheckedChange={(checked) => {
                        setFormData((prev) => ({
                          ...prev,
                          enablePricing: checked,
                          pricing: checked ? prev.pricing || [] : [],
                        }));
                      }}
                      disabled={isSubmitting || isReadonly}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground pl-6">
                    Configure pricing for this model. If disabled, the model is
                    free to use.
                  </p>
                </div>
              </div>
              <CollapsibleContent>
                {formData.enablePricing && (
                  <div className="pl-6 pt-1">
                    <PricingPicker
                      pricing={formData.pricing || []}
                      units={units}
                      onPricingChange={(pricing) =>
                        setFormData((prev) => ({ ...prev, pricing }))
                      }
                      disabled={isSubmitting || isReadonly}
                    />
                  </div>
                )}
              </CollapsibleContent>
            </div>
          </Collapsible>

          {/* Reasoning Levels - Collapsible with Switch, only show if model supports text output */}
          {formData.modalities?.output?.includes("text") && (
            <Collapsible
              open={formData.enableReasoningLevels || false}
              onOpenChange={(open) => {
                if (open) {
                  setFormData((prev) => ({
                    ...prev,
                    enableReasoningLevels: true,
                    reasoning_levels:
                      prev.reasoning_levels && prev.reasoning_levels.length > 0
                        ? prev.reasoning_levels
                        : [],
                  }));
                } else {
                  const { reasoning_levels: _, ...rest } = formData;
                  setFormData({
                    ...rest,
                    enableReasoningLevels: false,
                  });
                }
              }}
            >
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <Brain className="h-4 w-4 text-muted-foreground" />
                      <Label
                        htmlFor="enable-reasoning-levels"
                        className="text-sm font-medium"
                      >
                        Reasoning Levels
                      </Label>
                      <Switch
                        id="enable-reasoning-levels"
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
                    </div>
                    <p className="text-xs text-muted-foreground pl-6">
                      Select specific reasoning levels for this model. If
                      disabled, all available reasoning levels are allowed.
                    </p>
                  </div>
                </div>
                <CollapsibleContent>
                  {formData.enableReasoningLevels && (
                    <div className="pl-6 pt-1">
                      <GenericPicker
                        items={[...REASONING_LEVELS]}
                        selectedIds={formData.reasoning_levels || []}
                        onSelect={(ids) =>
                          setFormData((prev) => ({
                            ...prev,
                            reasoning_levels: ids,
                          }))
                        }
                        getId={(item) => item.id}
                        getLabel={(item) => item.name}
                        getSearchText={(item) => `${item.name} ${item.description || ""}`}
                        renderPreview={(item) => (
                          <div className="grid gap-2">
                            <h4 className="font-medium leading-none">{item.name || "No level selected"}</h4>
                            <div className="text-sm text-muted-foreground">
                              {item.description || "No description available"}
                            </div>
                          </div>
                        )}
                        renderItem={(item, _isSelected) => (
                          <div className="flex items-center justify-between w-full">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <div className="flex-1 min-w-0">
                                <div className="truncate">{item.name}</div>
                                {item.description && (
                                  <div className="text-xs text-muted-foreground mt-1 truncate group-data-[selected=true]:text-primary-foreground group-data-[highlighted=true]:text-primary-foreground">
                                    {item.description}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                        multiSelect={true}
                        hideSelectedChips={true}
                        buttonClassName="w-full"
                        groupHeading="Reasoning Levels"
                        disabled={isSubmitting || isReadonly}
                      />
                    </div>
                  )}
                </CollapsibleContent>
              </div>
            </Collapsible>
          )}

          {/* Voices - Collapsible with Switch, only show if both input and output have audio */}
          {formData.modalities?.input?.includes("audio") &&
            formData.modalities?.output?.includes("audio") && (
              <Collapsible
                open={formData.enableVoices || false}
                onOpenChange={(open) => {
                  if (open) {
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
                    });
                  }
                }}
              >
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <Volume2 className="h-4 w-4 text-muted-foreground" />
                        <Label
                          htmlFor="enable-voices"
                          className="text-sm font-medium"
                        >
                          Voice Selection
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
                        Select specific voices for this model. If disabled or
                        none selected, all available voices are allowed.
                      </p>
                    </div>
                  </div>
                  <CollapsibleContent>
                    {formData.enableVoices && (
                      <div className="pl-6 pt-1">
                        <GenericPicker
                          items={[...VOICES]}
                          selectedIds={formData.voices || []}
                          onSelect={(ids) =>
                            setFormData((prev) => ({
                              ...prev,
                              voices: ids.length > 0 ? ids : [],
                            }))
                          }
                          getId={(item) => item.id}
                          getLabel={(item) => item.name}
                          getSearchText={(item) => item.name}
                          disabled={isSubmitting || isReadonly}
                          multiSelect={true}
                          hideSelectedChips={true}
                          buttonClassName="w-full"
                          groupHeading="Voices"
                        />
                      </div>
                    )}
                  </CollapsibleContent>
                </div>
              </Collapsible>
            )}
        </div>

        {/* Qualities - Collapsible with Switch, only show if model supports image or audio output */}
        {(formData.modalities?.output?.includes("image") ||
          formData.modalities?.output?.includes("audio")) && (
          <Collapsible
            open={formData.enableQualities || false}
            onOpenChange={(open) => {
              if (open) {
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
                });
              }
            }}
          >
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    {/* eslint-disable-next-line jsx-a11y/alt-text */}
                    <Image className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    <Label
                      htmlFor="enable-qualities"
                      className="text-sm font-medium"
                    >
                      Qualities
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
                    Select specific quality levels for this model. If disabled,
                    all available quality levels are allowed.
                  </p>
                </div>
              </div>
              <CollapsibleContent>
                {formData.enableQualities && (
                  <div className="pl-6 pt-1">
                    <GenericPicker
                      items={[...QUALITIES]}
                      selectedIds={formData.qualities || []}
                      onSelect={(ids) =>
                        setFormData((prev) => ({ ...prev, qualities: ids }))
                      }
                      getId={(item) => item.id}
                      getLabel={(item) => item.name}
                      getSearchText={(item) => `${item.name} ${item.description || ""}`}
                      renderPreview={(item) => (
                        <div className="grid gap-2">
                          <h4 className="font-medium leading-none">{item.name || "No quality selected"}</h4>
                          <div className="text-sm text-muted-foreground">
                            {item.description || "No description available"}
                          </div>
                        </div>
                      )}
                      renderItem={(item, _isSelected) => (
                        <div className="flex items-center justify-between w-full">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <div className="flex-1 min-w-0">
                              <div className="truncate">{item.name}</div>
                              {item.description && (
                                <div className="text-xs text-muted-foreground mt-1 truncate group-data-[selected=true]:text-primary-foreground group-data-[highlighted=true]:text-primary-foreground">
                                  {item.description}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                      disabled={isSubmitting || isReadonly}
                      multiSelect={true}
                      hideSelectedChips={true}
                      buttonClassName="w-full"
                      groupHeading="Qualities"
                    />
                  </div>
                )}
              </CollapsibleContent>
            </div>
          </Collapsible>
        )}

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
