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

import {
  useCreateModel,
  useModel,
  useUpdateModel,
} from "@/lib/api/hooks/models";
import { Model as ModelType } from "@/types";
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

  const { data: modelToEdit, isLoading: isModelLoading } = useModel(
    modelId!,
    !!modelId
  );

  // Mutation hooks
  const createModelMutation = useCreateModel();
  const updateModelMutation = useUpdateModel();

  const isLoading = isModelLoading;

  // Single consolidated useEffect to handle all form state scenarios
  useEffect(() => {
    if (isEditMode && modelToEdit) {
      // We are in EDIT mode and have the model's data, so populate the form
      setFormData({
        name: modelToEdit.name,
        description: modelToEdit.description,
        active: modelToEdit.active,
        customModel: modelToEdit.customModel,
        inputPpm: modelToEdit.inputPpm?.toString?.() ?? "0",
        outputPpm: modelToEdit.outputPpm?.toString?.() ?? "0",
      });
    } else if (!isEditMode) {
      // We are in CREATE mode, so reset the form to its initial state
      setFormData(initialFormData);
    }
  }, [isEditMode, modelToEdit, initialFormData]);

  const handleInputChange = (
    field: keyof ModelType,
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
        await updateModelMutation.mutateAsync({
          id: modelId,
          name: formData.name,
          description: formData.description,
          active: formData.active,
          customModel: formData.customModel,
          inputPpm: inputPpmNum,
          outputPpm: outputPpmNum,
          updatedAt: new Date().toISOString(),
        });
      } else {
        await createModelMutation.mutateAsync({
          name: formData.name,
          description: formData.description,
          providerId: providerId,
          active: formData.active,
          customModel: formData.customModel,
          inputPpm: inputPpmNum,
          outputPpm: outputPpmNum,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }

      resetFormAndState();
      toast.success(
        isEditMode && modelId
          ? "Model updated successfully!"
          : "Model created successfully!"
      );
      router.push(`/management/providers`);
    } catch (error) {
      toast.error(
        `Failed to ${isEditMode && modelId ? "update" : "create"} model: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    } finally {
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
                    "inputPpm" as keyof ModelType,
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
                    "outputPpm" as keyof ModelType,
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
