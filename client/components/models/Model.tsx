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
import { Power } from "lucide-react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api/client";

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
      if (modelDetail.temperature_bounds) {
        const tb = modelDetail.temperature_bounds;
        temperature_bounds = {
          type: "range",
          lower: tb.lower ?? 0.0,
          upper: tb.upper ?? 1.0,
        };
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
        active:
          typeof modelDetail.active === "boolean" ? modelDetail.active : true,
        baseUrl: modelDetail.base_url || "",
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
      // Transform temperature bounds for API (always range)
      const temperature_bounds = formData.temperature_bounds
        ? {
            type: "range" as const,
            lower: formData.temperature_bounds.lower ?? 0.0,
            upper: formData.temperature_bounds.upper ?? 1.0,
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
          name: formData.name!,
          description: formData.description!,
          active: formData.active ?? true,
          department_ids: formData.departmentIds || null,
          key_id: formData.keyId || null,
          base_url: formData.provider === "custom" ? formData.baseUrl || null : null,
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
          name: formData.name!,
          description: formData.description!,
          active: formData.active ?? true,
          department_ids: formData.departmentIds || null,
          key_id: formData.keyId || null,
          base_url: formData.provider === "custom" ? formData.baseUrl || null : null,
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

        {/* Temperature Bounds */}
        <div className="space-y-2">
          <Label>Temperature Bounds</Label>
          <TemperatureBoundsPicker
            bounds={formData.temperature_bounds || { type: "range", lower: 0.0, upper: 1.0 }}
            onBoundsChange={(bounds) =>
              setFormData((prev) => ({ ...prev, temperature_bounds: bounds }))
            }
            disabled={isSubmitting || isReadonly}
          />
        </div>

        {/* Modalities */}
        <div className="space-y-2">
          <Label>Modalities</Label>
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
        </div>

        {/* Pricing */}
        <div className="space-y-2">
          <Label>Pricing</Label>
          <PricingPicker
            pricing={formData.pricing || []}
            units={units}
            onPricingChange={(pricing) =>
              setFormData((prev) => ({ ...prev, pricing }))
            }
            disabled={isSubmitting || isReadonly}
          />
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

        {/* Voices - Show if model supports audio output */}
        {formData.modalities?.output?.includes("audio") && (
          <div className="space-y-2">
            <Label>Voices</Label>
            <VoiceMultiPicker
              selectedIds={formData.voices || []}
              onSelect={(ids) =>
                setFormData((prev) => ({ ...prev, voices: ids }))
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
