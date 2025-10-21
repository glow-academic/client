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
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

import { useBreadcrumbContext } from "@/contexts/breadcrumb-context";
import { useProfile } from "@/contexts/profile-context";
import {
  useCreateModel,
  useModelDetail,
  useProviderDetail,
  useUpdateModel,
} from "@/lib/api/v2/hooks/providers";
import { useRouter } from "next/navigation";
interface FormErrors {
  name?: string;
  description?: string;
  inputPpm?: string;
  outputPpm?: string;
}

interface FormData {
  name?: string;
  description?: string;
  active?: boolean;
  customModel?: boolean;
  inputPpm?: string; // USD per 1M input tokens
  outputPpm?: string; // USD per 1M output tokens
}

export interface ModelProps {
  modelId?: string;
  providerId: string;
}

export default function Model({ modelId, providerId }: ModelProps) {
  const router = useRouter();
  const { effectiveProfile } = useProfile();
  const { setEntityMetadata, clearEntityMetadata } = useBreadcrumbContext();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEditMode = !!modelId;

  const initialFormData: FormData = useMemo(
    () => ({
      name: "",
      description: "",
      active: true,
      customModel: false,
      inputPpm: "0",
      outputPpm: "0",
    }),
    []
  );

  const [formData, setFormData] = useState<FormData>({});
  const [errors, setErrors] = useState<FormErrors>({});

  // V2 API hooks
  const { data: providerDetail } = useProviderDetail(
    providerId,
    effectiveProfile?.id || "",
    true
  );

  const { data: modelDetail, isLoading: isLoadingModelDetail } = useModelDetail(
    modelId || "",
    providerId,
    effectiveProfile?.id || "",
    !!modelId && isEditMode
  );

  const isLoading = isLoadingModelDetail;

  // Mutation hooks
  const { mutate: createModel } = useCreateModel();
  const { mutate: updateModel } = useUpdateModel();

  // Set breadcrumb context for provider
  useEffect(() => {
    if (providerDetail?.name && providerId) {
      setEntityMetadata({
        entityId: providerId,
        entityName: providerDetail.name,
        entityType: "provider",
      });
    }
  }, [providerDetail, providerId, setEntityMetadata]);

  // Set breadcrumb context for model
  useEffect(() => {
    if (modelDetail?.name && modelId && isEditMode) {
      setEntityMetadata({
        entityId: modelId,
        entityName: modelDetail.name,
        entityType: "model",
      });
    }
    // Only clear the model entity, not the provider
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
        active: modelDetail.active,
        customModel: modelDetail.custom_model,
        inputPpm: modelDetail.input_ppm?.toString?.() ?? "0",
        outputPpm: modelDetail.output_ppm?.toString?.() ?? "0",
      });
    } else if (!isEditMode) {
      // We are in CREATE mode, so reset the form to its initial state
      setFormData(initialFormData);
    }
  }, [isEditMode, modelDetail, initialFormData]);

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
        updateModel(
          {
            modelId: modelId,
            name: formData.name!,
            description: formData.description!,
            active: formData.active ?? true,
            custom_model: formData.customModel ?? false,
            input_ppm: inputPpmNum,
            output_ppm: outputPpmNum,
          },
          {
            onSuccess: () => {
              resetFormAndState();
              toast.success("Model updated successfully!");
              router.push(`/system/providers`);
            },
            onError: (error) => {
              toast.error(`Failed to update model: ${error.message}`);
              setIsSubmitting(false);
            },
          }
        );
      } else {
        createModel(
          {
            provider_id: providerId,
            name: formData.name!,
            description: formData.description!,
            active: formData.active ?? true,
            custom_model: formData.customModel ?? false,
            input_ppm: inputPpmNum,
            output_ppm: outputPpmNum,
          },
          {
            onSuccess: () => {
              resetFormAndState();
              toast.success("Model created successfully!");
              router.push(`/system/providers`);
            },
            onError: (error) => {
              toast.error(`Failed to create model: ${error.message}`);
              setIsSubmitting(false);
            },
          }
        );
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
          {formData.name !== undefined && !isLoading ? (
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleInputChange("name", e.target.value)}
              placeholder="Enter model name"
              className={errors.name ? "border-destructive" : ""}
            />
          ) : (
            <Skeleton className="h-10 w-full" />
          )}
          {errors.name && (
            <p className="text-sm text-destructive">{errors.name}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          {formData.description !== undefined && !isLoading ? (
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange("description", e.target.value)}
              placeholder="Enter model description"
              rows={3}
              className={errors.description ? "border-destructive" : ""}
            />
          ) : (
            <Skeleton className="h-10 w-full" />
          )}
          {errors.description && (
            <p className="text-sm text-destructive">{errors.description}</p>
          )}
        </div>

        {/* Custom Model and Active Switches */}
        <div className="space-y-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="customModel" className="text-sm">
              Custom Model
            </Label>
            {formData.customModel !== undefined && !isLoading ? (
              <Switch
                id="customModel"
                checked={formData.customModel}
                onCheckedChange={(checked) =>
                  handleInputChange("customModel", checked)
                }
              />
            ) : (
              <Skeleton className="h-6 w-11" />
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="active" className="text-sm">
              Model Active
            </Label>
            {formData.active !== undefined && !isLoading ? (
              <Switch
                id="active"
                checked={formData.active}
                onCheckedChange={(checked) =>
                  handleInputChange("active", checked)
                }
              />
            ) : (
              <Skeleton className="h-6 w-11" />
            )}
          </div>
        </div>

        {/* Pricing */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="inputPpm">Input price (USD per 1M tokens)</Label>
            {formData.inputPpm !== undefined && !isLoading ? (
              <Input
                id="inputPpm"
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
            ) : (
              <Skeleton className="h-10 w-full" />
            )}
            {errors.inputPpm && (
              <p className="text-sm text-destructive">{errors.inputPpm}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="outputPpm">Output price (USD per 1M tokens)</Label>
            {formData.outputPpm !== undefined && !isLoading ? (
              <Input
                id="outputPpm"
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
            ) : (
              <Skeleton className="h-10 w-full" />
            )}
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
            disabled={isSubmitting || isLoading}
          >
            Back
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting || isLoading}
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
