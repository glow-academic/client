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
import { useBreadcrumbContext } from "@/contexts/breadcrumb-context";
import { useProfile } from "@/contexts/profile-context";
import { getDefaultDepartmentIds } from "@/utils/department-picker-helpers";
import { Power, Settings } from "lucide-react";
import { useRouter } from "next/navigation";

interface FormErrors {
  name?: string;
  description?: string;
  providerId?: string;
  inputPpm?: string;
  outputPpm?: string;
}

interface FormData {
  name?: string;
  description?: string;
  providerId?: string;
  active?: boolean;
  customModel?: boolean;
  inputPpm?: string; // USD per 1M input tokens
  outputPpm?: string; // USD per 1M output tokens
  departmentIds?: string[] | null;
  keyId?: string | null;
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
  ModelDetailDefaultOut,
  UpdateKeyIn,
  UpdateKeyOut,
} from "@/app/(main)/engine/models/new/page";

export interface ModelProps {
  modelId?: string;
  // For create mode: default model detail with provider mapping
  modelDetailDefault?: ModelDetailDefaultOut;
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
  createKeyAction,
  decryptKeyAction,
  updateKeyAction,
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
      providerId: "",
      active: true,
      customModel: false,
      inputPpm: "0",
      outputPpm: "0",
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

  // Get provider mapping and valid IDs
  const providerMapping = useMemo(() => {
    if (isEditMode && modelDetail) {
      return modelDetail.provider_mapping || {};
    }
    if (!isEditMode && modelDetailDefault) {
      return modelDetailDefault.provider_mapping || {};
    }
    return {};
  }, [isEditMode, modelDetail, modelDetailDefault]);

  const validProviderIds = useMemo(() => {
    if (isEditMode && modelDetail) {
      return modelDetail.valid_provider_ids || [];
    }
    if (!isEditMode && modelDetailDefault) {
      return modelDetailDefault.valid_provider_ids || [];
    }
    return [];
  }, [isEditMode, modelDetail, modelDetailDefault]);

  // Get department and key mappings
  const modelDataForMappings = isEditMode ? modelDetail : modelDetailDefault;
  const departmentMapping = useMemo(() => {
    return modelDataForMappings?.department_mapping || {};
  }, [modelDataForMappings]);

  const validDepartmentIds = useMemo(() => {
    return modelDataForMappings?.valid_department_ids || [];
  }, [modelDataForMappings]);

  const keyMapping = useMemo(() => {
    return modelDataForMappings?.key_mapping || {};
  }, [modelDataForMappings]);

  const validKeyIds = useMemo(() => {
    return modelDataForMappings?.valid_key_ids || [];
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

  // Single consolidated useEffect to handle all form state scenarios
  useEffect(() => {
    if (isEditMode && modelDetail) {
      // We are in EDIT mode and have the model's data, so populate the form
      setFormData({
        name: modelDetail.name,
        description: modelDetail.description,
        providerId: modelDetail.provider_id,
        active: modelDetail.active,
        customModel: modelDetail.custom_model,
        inputPpm: modelDetail.input_ppm?.toString?.() ?? "0",
        outputPpm: modelDetail.output_ppm?.toString?.() ?? "0",
        departmentIds: currentDepartmentIds,
        keyId: currentKeyId,
      });
    } else if (!isEditMode) {
      // We are in CREATE mode, so reset the form to its initial state
      setFormData(initialFormData);
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

    if (!formData.providerId) {
      setErrors((prev) => ({
        ...prev,
        providerId: "Provider is required",
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
      if (isEditMode && modelId) {
        await handleUpdateModel({
          modelId: modelId,
          provider_id: formData.providerId!,
          name: formData.name!,
          description: formData.description!,
          active: formData.active ?? true,
          custom_model: formData.customModel ?? false,
          image_model: imageModel,
          input_ppm: inputPpmNum,
          output_ppm: outputPpmNum,
          department_ids: formData.departmentIds || null,
          key_id: formData.keyId || null,
        });
        resetFormAndState();
        toast.success("Model updated successfully!");
        router.push(`/engine/models`);
      } else {
        await handleCreateModel({
          provider_id: formData.providerId!,
          name: formData.name!,
          description: formData.description!,
          active: formData.active ?? true,
          custom_model: formData.customModel ?? false,
          image_model: false, // Default to false for new models
          input_ppm: inputPpmNum,
          output_ppm: outputPpmNum,
          department_ids: formData.departmentIds || null,
          key_id: formData.keyId || null,
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

        {/* Provider Selection */}
        <div className="space-y-2">
          <Label htmlFor="providerId">Provider</Label>
          <div data-testid="picker-provider">
            <ProviderPicker
              mapping={providerMapping}
              validIds={validProviderIds}
              selectedIds={formData.providerId ? [formData.providerId] : []}
              onSelect={(ids) => handleInputChange("providerId", ids[0] || "")}
              placeholder="Select a provider..."
              hideSelectedChips={true}
              buttonClassName={errors.providerId ? "border-destructive" : ""}
            />
          </div>
          {errors.providerId && (
            <p className="text-sm text-destructive">{errors.providerId}</p>
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
                mapping={keyMapping}
                validIds={validKeyIds}
                selectedIds={formData.keyId ? [formData.keyId] : []}
                onSelect={(ids) =>
                  setFormData((prev) => ({
                    ...prev,
                    keyId: ids[0] || null,
                  }))
                }
                multiSelect={false}
                keyType="api"
                {...(createKeyAction && { createKeyAction })}
                {...(decryptKeyAction && { decryptKeyAction })}
                {...(updateKeyAction && { updateKeyAction })}
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
                  onCheckedChange={(checked) =>
                    handleInputChange("customModel", checked)
                  }
                />
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground pl-5">
              Uses the base URL from the provider
            </p>
          </div>
        </div>

        {/* Pricing */}
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
