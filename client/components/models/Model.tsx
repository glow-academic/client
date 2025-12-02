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
import { ModelTypePicker } from "@/components/common/forms/ModelTypePicker";
import { ProviderPicker } from "@/components/common/forms/ProviderPicker";
import { TemperatureBoundsPicker, type TemperatureBounds } from "@/components/common/forms/TemperatureBoundsPicker";
import { PricingPicker, type PricingEntry } from "@/components/common/forms/PricingPicker";
import { ModalityPicker } from "@/components/common/forms/ModalityPicker";
import { ReasoningLevelPicker } from "@/components/common/forms/ReasoningLevelPicker";
import { VoiceMultiPicker } from "@/components/common/forms/VoiceMultiPicker";
import { QualityPicker } from "@/components/common/forms/QualityPicker";
import { UnitPicker, type UnitItem } from "@/components/common/forms/UnitPicker";
import { useBreadcrumbContext } from "@/contexts/breadcrumb-context";
import { useProfile } from "@/contexts/profile-context";
import { getDefaultDepartmentIds } from "@/utils/department-picker-helpers";
import { Power, Settings } from "lucide-react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api/client";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";

interface FormErrors {
  name?: string;
  description?: string;
  provider?: string;
  inputPpm?: string;
  outputPpm?: string;
  baseUrl?: string;
}

interface FormData {
  name?: string;
  description?: string;
  provider?: string;
  modelType?: string;
  active?: boolean;
  customModel?: boolean; // Determined by provider === 'custom' or baseUrl presence
  baseUrl?: string;
  inputPpm?: string; // USD per 1M input tokens (deprecated, use pricing)
  outputPpm?: string; // USD per 1M output tokens (deprecated, use pricing)
  departmentIds?: string[] | null;
  keyId?: string | null;
  // New configuration fields
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
      modelType: "text",
      active: true,
      customModel: false,
      baseUrl: "",
      inputPpm: "0",
      outputPpm: "0",
      departmentIds: defaultDepartmentIds,
      keyId: null,
    }),
    [defaultDepartmentIds]
  );

  const [formData, setFormData] = useState<FormData>({});
  const [errors, setErrors] = useState<FormErrors>({});
  const [units, setUnits] = useState<UnitItem[]>([]);
  const [loadingUnits, setLoadingUnits] = useState(false);

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

  // Store image_model from modelDetail for mutations
  const imageModel = modelDetail?.image_model ?? false;

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

  // Load units from API
  useEffect(() => {
    const loadUnits = async () => {
      setLoadingUnits(true);
      try {
        const response = await api.post("/units/list", { body: {} });
        setUnits(response.units || []);
      } catch (error) {
        console.error("Failed to load units:", error);
        toast.error("Failed to load units");
      } finally {
        setLoadingUnits(false);
      }
    };
    loadUnits();
  }, []);

  // Single consolidated useEffect to handle all form state scenarios
  useEffect(() => {
    if (isEditMode && modelDetail) {
      // We are in EDIT mode and have the model's data, so populate the form
      // Parse temperature bounds
      let temperature_bounds: TemperatureBounds | undefined;
      if (modelDetail.temperature_bounds) {
        const tb = modelDetail.temperature_bounds;
        if (tb.values && tb.values.length > 0) {
          temperature_bounds = {
            type: "values",
            values: tb.values,
          };
        } else {
          temperature_bounds = {
            type: "range",
            lower: tb.lower ?? 0.0,
            upper: tb.upper ?? 1.0,
          };
        }
      }

      // Parse pricing
      const pricing: PricingEntry[] =
        modelDetail.pricing?.map((p) => ({
          type: p.pricing_type as "input" | "output" | "cached",
          unit_id: p.unit_id,
          price: p.price,
        })) || [];

      // Parse modalities
      const modalities = {
        input: modelDetail.modalities?.input || [],
        output: modelDetail.modalities?.output || [],
      };

      setFormData({
        name: modelDetail.name,
        description: modelDetail.description,
        provider: modelDetail.provider,
        modelType: modelDetail.model_type || "text",
        active:
          typeof modelDetail.active === "boolean" ? modelDetail.active : true,
        baseUrl: modelDetail.base_url || "",
        inputPpm: modelDetail.input_ppm?.toString?.() ?? "0",
        outputPpm: modelDetail.output_ppm?.toString?.() ?? "0",
        departmentIds: currentDepartmentIds,
        keyId: currentKeyId,
        temperature_bounds,
        pricing,
        modalities,
        reasoning_levels: modelDetail.reasoning_levels || [],
        voices: modelDetail.voices || [],
        qualities: modelDetail.qualities || [],
      });
    } else if (!isEditMode) {
      // We are in CREATE mode, so reset the form to its initial state
      setFormData({
        ...initialFormData,
        temperature_bounds: {
          type: "range",
          lower: 0.0,
          upper: 1.0,
        },
        pricing: [],
        modalities: { input: [], output: [] },
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

    if (!formData.modelType) {
      // Model type is always set to default "text" in initialFormData, so this shouldn't happen
      // But adding validation for completeness
      toast.error("Model type is required");
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

    // Validate pricing fields
    const inputPpmNum = parseFloat(formData.inputPpm ?? "0");
    const outputPpmNum = parseFloat(formData.outputPpm ?? "0");
    const priceErrors: FormErrors = {};
    if (Number.isNaN(inputPpmNum) || inputPpmNum < 0) {
      priceErrors.inputPpm = "Enter a valid non-negative number";
    }
    if (Number.isNaN(outputPpmNum) || outputPpmNum < 0) {
      priceErrors.outputPpm = "Enter a valid non-negative number";
    }
    if (priceErrors.inputPpm || priceErrors.outputPpm) {
      setErrors((prev) => ({ ...prev, ...priceErrors }));
      return;
    }

    setIsSubmitting(true);

    try {
      // Transform temperature bounds for API
      const temperature_bounds = formData.temperature_bounds
        ? {
            type: formData.temperature_bounds.type,
            ...(formData.temperature_bounds.type === "range"
              ? {
                  lower: formData.temperature_bounds.lower ?? 0.0,
                  upper: formData.temperature_bounds.upper ?? 1.0,
                }
              : {
                  values: formData.temperature_bounds.values || [],
                }),
          }
        : undefined;

      // Transform pricing for API
      const pricing = formData.pricing && formData.pricing.length > 0
        ? formData.pricing.map((p) => ({
            type: p.type,
            unit_id: p.unit_id,
            price: p.price,
          }))
        : undefined;

      // Transform modalities for API
      const modalities =
        formData.modalities &&
        (formData.modalities.input.length > 0 ||
          formData.modalities.output.length > 0)
          ? {
              input: formData.modalities.input,
              output: formData.modalities.output,
            }
          : undefined;

      if (isEditMode && modelId) {
        await handleUpdateModel({
          modelId: modelId,
          provider: formData.provider!,
          model_type: formData.modelType!,
          name: formData.name!,
          description: formData.description!,
          active: formData.active ?? true,
          image_model: imageModel,
          input_ppm: inputPpmNum,
          output_ppm: outputPpmNum,
          department_ids: formData.departmentIds || null,
          key_id: formData.keyId || null,
          base_url: formData.customModel ? formData.baseUrl || null : null,
          temperature_bounds,
          pricing,
          modalities,
          reasoning_levels: formData.reasoning_levels && formData.reasoning_levels.length > 0 ? formData.reasoning_levels : null,
          voices: formData.voices && formData.voices.length > 0 ? formData.voices : null,
          qualities: formData.qualities && formData.qualities.length > 0 ? formData.qualities : null,
          profileId: effectiveProfile?.id || "guest-profile-id",
        });
        resetFormAndState();
        toast.success("Model updated successfully!");
        router.push(`/engine/models`);
      } else {
        await handleCreateModel({
          provider: formData.provider!,
          model_type: formData.modelType!,
          name: formData.name!,
          description: formData.description!,
          active: formData.active ?? true,
          image_model: false, // Default to false for new models
          input_ppm: inputPpmNum,
          output_ppm: outputPpmNum,
          department_ids: formData.departmentIds || null,
          key_id: formData.keyId || null,
          base_url: formData.customModel ? formData.baseUrl || null : null,
          temperature_bounds,
          pricing,
          modalities,
          reasoning_levels: formData.reasoning_levels && formData.reasoning_levels.length > 0 ? formData.reasoning_levels : null,
          voices: formData.voices && formData.voices.length > 0 ? formData.voices : null,
          qualities: formData.qualities && formData.qualities.length > 0 ? formData.qualities : null,
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

        {/* Provider and Model Type Selection */}
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
          {/* Provider Selection */}
          <div className="space-y-2">
            <Label htmlFor="provider">Provider</Label>
            <div data-testid="picker-provider">
              <ProviderPicker
                selectedProvider={formData.provider || ""}
                onSelect={(provider) => {
                  handleInputChange("provider", provider);
                  // Auto-enable custom model if provider is 'custom'
                  if (provider === "custom") {
                    handleInputChange("customModel", true);
                  } else if (formData.provider === "custom") {
                    // If switching away from custom, disable custom model
                    handleInputChange("customModel", false);
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
          </div>

          {/* Model Type Selection */}
          <div className="space-y-2">
            <Label htmlFor="modelType">Model Type</Label>
            <div data-testid="picker-model-type">
              <ModelTypePicker
                selectedModelType={formData.modelType || "text"}
                onSelect={(modelType) => {
                  handleInputChange("modelType", modelType);
                }}
                placeholder="Select model type..."
                disabled={isEditMode} // Model type is immutable after creation
                buttonClassName={errors.provider ? "border-destructive" : ""}
              />
            </div>
            {isEditMode && (
              <p className="text-xs text-muted-foreground">
                Model type cannot be changed after creation
              </p>
            )}
          </div>
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

        {/* Active and Custom Model Switches */}
        <div className="space-y-2 pt-2">
          {/* Active Switch */}
          <div className="space-y-1">
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
          <div className="space-y-1">
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
                />
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground pl-5">
              Use a custom base URL for this model
            </p>
            {formData.customModel && (
              <div className="space-y-2 pt-2">
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
        </div>

        {/* Legacy Pricing (deprecated, kept for backward compatibility) */}
        <Collapsible defaultOpen={false}>
          <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
            <ChevronDown className="h-4 w-4 transition-transform data-[state=open]:rotate-180" />
            Legacy Pricing (Deprecated)
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="inputPpm">Input price (USD per 1M tokens)</Label>
                {formData.inputPpm !== undefined ? (
                  <Input
                    id="inputPpm"
                    data-testid="input-model-input-ppm"
                    type="number"
                    step="0.0001"
                    min="0"
                    value={formData.inputPpm}
                    onChange={(e) =>
                      handleInputChange(
                        "inputPpm" as keyof FormData,
                        e.target.value
                      )
                    }
                    placeholder="e.g. 3.00"
                    className={errors.inputPpm ? "border-destructive" : ""}
                  />
                ) : null}
                {errors.inputPpm && (
                  <p className="text-sm text-destructive">{errors.inputPpm}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="outputPpm">Output price (USD per 1M tokens)</Label>
                {formData.outputPpm !== undefined ? (
                  <Input
                    id="outputPpm"
                    data-testid="input-model-output-ppm"
                    type="number"
                    step="0.0001"
                    min="0"
                    value={formData.outputPpm}
                    onChange={(e) =>
                      handleInputChange(
                        "outputPpm" as keyof FormData,
                        e.target.value
                      )
                    }
                    placeholder="e.g. 15.00"
                    className={errors.outputPpm ? "border-destructive" : ""}
                  />
                ) : null}
                {errors.outputPpm && (
                  <p className="text-sm text-destructive">{errors.outputPpm}</p>
                )}
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Model Configuration Sections */}
        <div className="space-y-6 border-t pt-6">
          <h3 className="text-lg font-semibold">Model Configuration</h3>

          {/* Temperature Bounds */}
          <Collapsible defaultOpen={true}>
            <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium">
              <ChevronDown className="h-4 w-4 transition-transform data-[state=open]:rotate-180" />
              Temperature Bounds
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-4">
              <TemperatureBoundsPicker
                bounds={formData.temperature_bounds || { type: "range", lower: 0.0, upper: 1.0 }}
                onBoundsChange={(bounds) =>
                  setFormData((prev) => ({ ...prev, temperature_bounds: bounds }))
                }
                disabled={isSubmitting || isReadonly}
              />
            </CollapsibleContent>
          </Collapsible>

          {/* Modalities */}
          <Collapsible defaultOpen={true}>
            <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium">
              <ChevronDown className="h-4 w-4 transition-transform data-[state=open]:rotate-180" />
              Modalities
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-4">
              <ModalityPicker
                inputModalities={formData.modalities?.input || []}
                outputModalities={formData.modalities?.output || []}
                onInputChange={(modalities) =>
                  setFormData((prev) => ({
                    ...prev,
                    modalities: {
                      input: modalities,
                      output: prev.modalities?.output || [],
                    },
                  }))
                }
                onOutputChange={(modalities) =>
                  setFormData((prev) => ({
                    ...prev,
                    modalities: {
                      input: prev.modalities?.input || [],
                      output: modalities,
                    },
                  }))
                }
                disabled={isSubmitting || isReadonly}
              />
            </CollapsibleContent>
          </Collapsible>

          {/* Pricing */}
          <Collapsible defaultOpen={true}>
            <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium">
              <ChevronDown className="h-4 w-4 transition-transform data-[state=open]:rotate-180" />
              Pricing
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-4">
              <PricingPicker
                pricing={formData.pricing || []}
                units={units}
                onPricingChange={(pricing) =>
                  setFormData((prev) => ({ ...prev, pricing }))
                }
                disabled={isSubmitting || isReadonly || loadingUnits}
              />
            </CollapsibleContent>
          </Collapsible>

          {/* Reasoning Levels - Show if model supports text output */}
          {formData.modalities?.output?.includes("text") && (
            <Collapsible defaultOpen={false}>
              <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium">
                <ChevronDown className="h-4 w-4 transition-transform data-[state=open]:rotate-180" />
                Reasoning Levels
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-4">
                <ReasoningLevelPicker
                  selectedIds={formData.reasoning_levels || []}
                  onSelect={(ids) =>
                    setFormData((prev) => ({ ...prev, reasoning_levels: ids }))
                  }
                  disabled={isSubmitting || isReadonly}
                />
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Voices - Show if model supports audio output */}
          {formData.modalities?.output?.includes("audio") && (
            <Collapsible defaultOpen={false}>
              <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium">
                <ChevronDown className="h-4 w-4 transition-transform data-[state=open]:rotate-180" />
                Voices
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-4">
                <VoiceMultiPicker
                  selectedIds={formData.voices || []}
                  onSelect={(ids) =>
                    setFormData((prev) => ({ ...prev, voices: ids }))
                  }
                  disabled={isSubmitting || isReadonly}
                />
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Qualities - Show if model supports image output */}
          {formData.modalities?.output?.includes("image") && (
            <Collapsible defaultOpen={false}>
              <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium">
                <ChevronDown className="h-4 w-4 transition-transform data-[state=open]:rotate-180" />
                Qualities
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-4">
                <QualityPicker
                  selectedIds={formData.qualities || []}
                  onSelect={(ids) =>
                    setFormData((prev) => ({ ...prev, qualities: ids }))
                  }
                  disabled={isSubmitting || isReadonly}
                />
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>

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
