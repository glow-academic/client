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

import { DepartmentPicker } from "@/components/common/forms/DepartmentPicker";
import { KeyPicker } from "@/components/common/forms/KeyPicker";
import { ModalityPicker } from "@/components/common/forms/ModalityPicker";
import {
  PricingPicker,
  type PricingEntry,
} from "@/components/common/forms/PricingPicker";
import { ProviderPicker } from "@/components/common/forms/ProviderPicker";
import { QualityPicker } from "@/components/common/forms/QualityPicker";
import { ReasoningLevelPicker } from "@/components/common/forms/ReasoningLevelPicker";
import {
  TemperatureBoundsPicker,
  type TemperatureBounds,
} from "@/components/common/forms/TemperatureBoundsPicker";
import {
  VoiceMultiPicker,
  VOICES,
} from "@/components/common/forms/VoiceMultiPicker";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { useBreadcrumbContext } from "@/contexts/breadcrumb-context";
import { useProfile } from "@/contexts/profile-context";
import { getDefaultDepartmentIds } from "@/utils/department-picker-helpers";
import {
  DollarSign,
  Power,
  Settings2,
  Thermometer,
  Volume2,
} from "lucide-react";
import { useRouter } from "next/navigation";

interface FormErrors {
  name?: string;
  description?: string;
  provider?: string;
  baseUrl?: string;
}

interface FormData {
  name?: string;
  description?: string;
  provider?: string;
  active?: boolean;
  baseUrl?: string;
  departmentIds?: string[] | null;
  keyId?: string | null;
  // Feature toggles
  enableTemperature?: boolean;
  enablePricing?: boolean;
  enableVoices?: boolean;
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
      provider: "",
      active: true,
      baseUrl: "",
      departmentIds: defaultDepartmentIds,
      keyId: null,
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

  // Get key mapping type for filteredKeyMapping
  type KeyMappingType = typeof modelDataForMappings extends {
    key_mapping?: infer K;
  }
    ? K
    : Record<
        string,
        {
          name: string;
          description: string;
          key_masked: string;
          active: boolean;
          department_ids: string[] | null;
        }
      >;

  const validKeyIds = useMemo(() => {
    return modelDataForMappings?.valid_key_ids || [];
  }, [modelDataForMappings]);

  // Filter key_mapping client-side based on selected departments from form
  // API returns all keys user has access to, then we filter by selected departments
  // Show: default keys + keys for selected departments + cross-department keys (no department_ids)
  const filteredKeyMapping = useMemo(() => {
    if (!isEditMode || !modelDetail?.key_mapping) {
      return modelDetail?.key_mapping || modelDetailDefault?.key_mapping || {};
    }

    const selectedDeptIds = formData?.departmentIds || [];
    const filtered: Record<string, NonNullable<KeyMappingType>[string]> = {};

    for (const [keyId, keyInfoRaw] of Object.entries(modelDetail.key_mapping)) {
      // Add default values for department_ids if missing (for backward compatibility)
      const rawInfo = keyInfoRaw as typeof keyInfoRaw & {
        department_ids?: string[] | null;
      };
      const keyInfo = {
        ...keyInfoRaw,
        department_ids: rawInfo.department_ids || null,
      };

      if (selectedDeptIds.length === 0) {
        // "All Departments" selected - show ALL keys (default and department-specific)
        filtered[keyId] = keyInfo;
      } else {
        // Specific departments selected - show default keys, cross-department keys, and keys for selected departments
        const isDefaultOrCrossDepartment =
          !keyInfo.department_ids || keyInfo.department_ids.length === 0;
        const isForSelectedDepartment =
          keyInfo.department_ids &&
          keyInfo.department_ids.some((deptId) =>
            selectedDeptIds.includes(deptId)
          );

        if (isDefaultOrCrossDepartment || isForSelectedDepartment) {
          filtered[keyId] = keyInfo;
        }
      }
    }
    return filtered;
  }, [
    formData?.departmentIds,
    modelDetail?.key_mapping,
    modelDetailDefault?.key_mapping,
    isEditMode,
  ]);

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
      let temperature_bounds: TemperatureBounds | undefined;
      const modelDetailWithBounds = modelDetail as typeof modelDetail & {
        temperature_bounds?: { lower?: number; upper?: number };
      };
      if (modelDetailWithBounds.temperature_bounds) {
        const tb = modelDetailWithBounds.temperature_bounds;
        temperature_bounds = {
          type: "range",
          lower: tb.lower ?? 0.0,
          upper: tb.upper ?? 1.0,
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
      const hasTemperature = !!temperature_bounds;
      const hasPricing = pricing && pricing.length > 0;
      const hasVoices =
        modelDetail.voices &&
        (modelDetail.voices as Array<string | { voice: string }>).length > 0;

      setFormData({
        name: modelDetail.name,
        description: modelDetail.description,
        provider: modelDetail.provider,
        active:
          typeof modelDetail.active === "boolean" ? modelDetail.active : true,
        baseUrl: modelDetail.base_url || "",
        departmentIds: currentDepartmentIds,
        keyId: currentKeyId,
        enableTemperature: hasTemperature,
        enablePricing: hasPricing,
        enableVoices: hasVoices,
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
        enableTemperature: false,
        enablePricing: false,
        enableVoices: false,
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

    if (!formData.provider) {
      setErrors((prev) => ({
        ...prev,
        provider: "Provider is required",
      }));
      return;
    }

    // Validate base_url if custom provider
    if (
      formData.provider === "custom" &&
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

      // Transform voices for API (only if enabled, otherwise all voices)
      // If voices switch is off, we'll handle "all voices" server-side
      const voices =
        formData.enableVoices && formData.voices && formData.voices.length > 0
          ? formData.voices
          : formData.enableVoices === false
            ? null // Explicitly disabled - server will handle default (all voices)
            : formData.voices && formData.voices.length > 0
              ? formData.voices
              : null; // Not set - server will create all voices

      if (isEditMode && modelId) {
        await handleUpdateModel({
          modelId: modelId,
          provider: formData.provider!,
          name: formData.name!,
          description: formData.description!,
          active: formData.active ?? true,
          department_ids: formData.departmentIds || null,
          key_id: formData.keyId || null,
          base_url:
            formData.provider === "custom" ? formData.baseUrl || null : null,
          ...(temperature_bounds ? { temperature_bounds } : {}),
          ...(pricing ? { pricing } : {}),
          modalities,
          reasoning_levels:
            formData.reasoning_levels && formData.reasoning_levels.length > 0
              ? formData.reasoning_levels
              : null,
          voices,
          qualities:
            formData.qualities && formData.qualities.length > 0
              ? formData.qualities
              : null,
          profileId: effectiveProfile?.id || "guest-profile-id",
        });
        resetFormAndState();
        toast.success("Model updated successfully!");
        router.push(`/engine/models`);
      } else {
        await handleCreateModel({
          provider: formData.provider!,
          name: formData.name!,
          description: formData.description!,
          active: formData.active ?? true,
          department_ids: formData.departmentIds || null,
          key_id: formData.keyId || null,
          base_url:
            formData.provider === "custom" ? formData.baseUrl || null : null,
          ...(temperature_bounds ? { temperature_bounds } : {}),
          ...(pricing ? { pricing } : {}),
          modalities,
          reasoning_levels:
            formData.reasoning_levels && formData.reasoning_levels.length > 0
              ? formData.reasoning_levels
              : null,
          voices,
          qualities:
            formData.qualities && formData.qualities.length > 0
              ? formData.qualities
              : null,
          profileId: effectiveProfile?.id || "guest-profile-id",
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
              <DepartmentPicker
                mapping={departmentMapping}
                validIds={validDepartmentIds}
                selectedIds={formData.departmentIds || []}
                onSelect={(ids) =>
                  setFormData((prev) => ({
                    ...prev,
                    departmentIds: ids,
                  }))
                }
                placeholder="All Departments"
                multiSelect={true}
                triggerProps={{ "data-testid": "picker-department" }}
              />
            ) : null}
          </div>
        ) : null}

        {/* Key Selection */}
        {validKeyIds && validKeyIds.length > 0 ? (
          <div className="space-y-2">
            <Label htmlFor="keyId">API Key</Label>
            {formData?.keyId !== undefined ? (
              <KeyPicker
                mapping={filteredKeyMapping}
                validIds={validKeyIds.filter((id) => filteredKeyMapping[id])}
                selectedIds={formData.keyId ? [formData.keyId] : []}
                defaultKeyId={modelDetail?.default_key_id || null}
                onSelect={(ids) =>
                  setFormData((prev) => ({
                    ...prev,
                    keyId: ids[0] || null,
                  }))
                }
                multiSelect={false}
                placeholder="Select key..."
                disabled={isReadonly || isSubmitting}
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

        {/* Provider Selection */}
        <div className="space-y-2">
          <Label htmlFor="provider">Provider</Label>
          <div data-testid="picker-provider">
            <ProviderPicker
              selectedProvider={formData.provider || ""}
              onSelect={(provider) => {
                handleInputChange("provider", provider);
                // Clear base URL if switching away from custom
                if (provider !== "custom") {
                  handleInputChange("baseUrl", "");
                }
              }}
              placeholder="Select a provider..."
              buttonClassName={errors.provider ? "border-destructive" : ""}
            />
          </div>
          {errors.provider && (
            <p className="text-sm text-destructive">{errors.provider}</p>
          )}
          {/* Show base URL input when custom provider is selected */}
          {formData.provider === "custom" && (
            <div className="space-y-2 pt-2">
              <Label htmlFor="baseUrl">Base URL</Label>
              <Input
                id="baseUrl"
                type="url"
                value={formData.baseUrl || ""}
                onChange={(e) => handleInputChange("baseUrl", e.target.value)}
                placeholder="e.g. https://api.example.com/v1"
                disabled={isSubmitting}
                className={errors.baseUrl ? "border-destructive" : ""}
                data-testid="input-model-base-url"
              />
              {errors.baseUrl && (
                <p className="text-sm text-destructive">{errors.baseUrl}</p>
              )}
            </div>
          )}
        </div>

        {/* Modalities - Always visible, defaults to text/text */}
        <div className="space-y-2">
          <Label>Modalities</Label>
          <ModalityPicker
            inputModalities={formData.modalities?.input || ["text"]}
            outputModalities={formData.modalities?.output || ["text"]}
            onInputChange={(modalities) =>
              setFormData((prev) => ({
                ...prev,
                modalities: {
                  input: modalities.length > 0 ? modalities : ["text"],
                  output: prev.modalities?.output || ["text"],
                },
              }))
            }
            onOutputChange={(modalities) =>
              setFormData((prev) => ({
                ...prev,
                modalities: {
                  input: prev.modalities?.input || ["text"],
                  output: modalities.length > 0 ? modalities : ["text"],
                },
              }))
            }
            disabled={isSubmitting || isReadonly}
          />
        </div>

        {/* Advanced Configuration Section */}
        <div className="space-y-4 border-t pt-6">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Advanced Configuration
          </h3>

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
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    <Thermometer className="h-4 w-4 text-muted-foreground" />
                    <Label
                      htmlFor="enable-temperature"
                      className="text-sm font-medium"
                    >
                      Temperature Constraints
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
                  <div className="pl-6 pt-2">
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
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    <Label
                      htmlFor="enable-pricing"
                      className="text-sm font-medium"
                    >
                      Pricing Configuration
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
                  <div className="pl-6 pt-2">
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

          {/* Reasoning Levels - Show if model supports text output */}
          {formData.modalities?.output?.includes("text") && (
            <div className="space-y-2">
              <Label>Reasoning Levels</Label>
              <ReasoningLevelPicker
                selectedIds={formData.reasoning_levels || []}
                onSelect={(ids) =>
                  setFormData((prev) => ({ ...prev, reasoning_levels: ids }))
                }
                disabled={isSubmitting || isReadonly}
              />
            </div>
          )}

          {/* Voices - Collapsible with Switch, only show if audio output */}
          {formData.modalities?.output?.includes("audio") && (
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
                        : VOICES.map((v) => v.id),
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
              <div className="space-y-2">
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
                                  : VOICES.map((v) => v.id), // Default to all voices
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
                      Select specific voices for this model. If disabled, all
                      available voices are allowed.
                    </p>
                  </div>
                </div>
                <CollapsibleContent>
                  {formData.enableVoices && (
                    <div className="pl-6 pt-2">
                      <VoiceMultiPicker
                        selectedIds={formData.voices || VOICES.map((v) => v.id)}
                        onSelect={(ids) =>
                          setFormData((prev) => ({
                            ...prev,
                            voices:
                              ids.length > 0 ? ids : VOICES.map((v) => v.id),
                          }))
                        }
                        disabled={isSubmitting || isReadonly}
                      />
                    </div>
                  )}
                </CollapsibleContent>
              </div>
            </Collapsible>
          )}
        </div>

        {/* Reasoning Levels - Show if model supports text output */}
        {formData.modalities?.output?.includes("text") && (
          <div className="space-y-2">
            <Label>Reasoning Levels</Label>
            <ReasoningLevelPicker
              selectedIds={formData.reasoning_levels || []}
              onSelect={(ids) =>
                setFormData((prev) => ({ ...prev, reasoning_levels: ids }))
              }
              disabled={isSubmitting || isReadonly}
            />
          </div>
        )}

        {/* Qualities - Show if model supports image output */}
        {formData.modalities?.output?.includes("image") && (
          <div className="space-y-2">
            <Label>Qualities</Label>
            <QualityPicker
              selectedIds={formData.qualities || []}
              onSelect={(ids) =>
                setFormData((prev) => ({ ...prev, qualities: ids }))
              }
              disabled={isSubmitting || isReadonly}
            />
          </div>
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
