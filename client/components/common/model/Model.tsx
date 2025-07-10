/**
 * Model.tsx
 * Used to create and manage models for the admin dashboard
 * @AshokSaravanan222 & @siladiea
 * 06/18/2025
 */
"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

// UI Components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

import { cn } from "@/lib/utils";
import { createModel } from "@/utils/mutations/models/create-model";
import { updateModel } from "@/utils/mutations/models/update-model";
import { getModel } from "@/utils/queries/models/get-model";
import { getAllProviders } from "@/utils/queries/providers/get-all-providers";
import { useRouter } from "next/navigation";

const MODEL_TYPE_OPTIONS = [
  { id: "ttt", label: "Text-to-Text (TTT)" },
  { id: "stt", label: "Speech-to-Text (STT)" },
  { id: "tts", label: "Text-to-Speech (TTS)" },
] as const;

type ModelTypeId = (typeof MODEL_TYPE_OPTIONS)[number]["id"];

// Normalize incoming DB values (future-proof)
function normaliseModelType(
  raw: string | null | undefined
): ModelTypeId | undefined {
  switch ((raw ?? "").toLowerCase()) {
    case "ttt":
    case "text_to_text":
      return "ttt";
    case "stt":
    case "speech_to_text":
      return "stt";
    case "tts":
    case "text_to_speech":
      return "tts";
    default:
      return undefined; // triggers placeholder + validation
  }
}

interface ModelProps {
  modelId?: string;
}

interface FormErrors {
  name?: string;
  description?: string;
  providerId?: string;
  modelType?: string;
}

interface FormData {
  name?: string;
  description?: string;
  providerId: string;
  active?: boolean;
  modelType?: ModelTypeId | undefined;
}

export default function Model({ modelId }: ModelProps) {
  const queryClient = useQueryClient();
  const router = useRouter();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEditMode = !!modelId;

  const initialFormData: FormData = useMemo(
    () => ({
      name: "",
      description: "",
      providerId: "",
      active: true,
      modelType: undefined,
    }),
    []
  );

  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [errors, setErrors] = useState<FormErrors>({});

  // Fetch the specific model directly if in edit mode
  const { data: modelToEdit, isLoading: isModelLoading } = useQuery({
    queryKey: ["model", modelId],
    queryFn: () => getModel(modelId!),
    enabled: isEditMode,
  });

  const { data: providers } = useQuery({
    queryKey: ["providers"],
    queryFn: () => getAllProviders(),
  });

  // Loading state for the entire form (only when model is loading in edit mode)
  const isFormLoading = isEditMode && isModelLoading;

  // Single consolidated useEffect to handle all form state scenarios
  useEffect(() => {
    if (isEditMode && modelToEdit) {
      // We are in EDIT mode and have the model's data, so populate the form
      setFormData({
        name: modelToEdit.name,
        description: modelToEdit.description,
        providerId: String(modelToEdit.providerId ?? ""),
        active: modelToEdit.active,
        modelType: normaliseModelType(modelToEdit.modelType),
      });
    } else if (!isEditMode) {
      // We are in CREATE mode, so reset the form to its initial state
      setFormData(initialFormData);
    }
  }, [isEditMode, modelToEdit, initialFormData]);

  // Fix for provider field - only set providerId after providers are loaded
  useEffect(() => {
    if (
      isEditMode &&
      modelToEdit &&
      providers &&
      providers.some((p) => String(p.id) === String(modelToEdit.providerId))
    ) {
      setFormData((f) => ({
        ...f,
        providerId: String(modelToEdit.providerId),
      }));
    }
  }, [isEditMode, modelToEdit, providers]);

  const providerMissing =
    !!formData.providerId &&
    !providers?.some((p) => String(p.id) === formData.providerId);

  const modelTypeMissing =
    formData.modelType &&
    !MODEL_TYPE_OPTIONS.some((o) => o.id === formData.modelType);

  const handleInputChange = (
    field: keyof FormData,
    value: string | boolean | ModelTypeId
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.name?.trim()) {
      newErrors.name = "Name is required";
    }

    if (!formData.description?.trim()) {
      newErrors.description = "Description is required";
    }

    if (!formData.providerId.trim()) {
      newErrors.providerId = "Provider is required";
    }

    if (!formData.modelType) {
      newErrors.modelType = "Model type is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const resetFormAndState = () => {
    setFormData(initialFormData);
    setErrors({});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsSubmitting(true);

    try {
      let result;
      if (isEditMode && modelId) {
        result = await updateModel(modelId, {
          ...formData,
          updatedAt: new Date().toISOString(),
        });
      } else {
        result = await createModel({
          name: formData.name || "",
          description: formData.description || "",
          providerId: formData.providerId,
          active: formData.active || true,
          modelType: formData.modelType || "ttt",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }

      if (!result) {
        toast.error("Failed to create model");
        return;
      }

      resetFormAndState();
      queryClient.invalidateQueries({ queryKey: ["models"] });
      if (isEditMode && modelId) {
        queryClient.invalidateQueries({ queryKey: ["model", modelId] });
      }
      toast.success(
        isEditMode && modelId
          ? "Model updated successfully!"
          : "Model created successfully!"
      );
      router.push(`/management/models`);
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
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => handleInputChange("name", e.target.value)}
            placeholder="Enter model name"
            className={errors.name ? "border-destructive" : ""}
          />
          {errors.name && (
            <p className="text-sm text-destructive">{errors.name}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={formData.description || ""}
            onChange={(e) => handleInputChange("description", e.target.value)}
            placeholder="Enter model description"
            rows={3}
            className={errors.description ? "border-destructive" : ""}
          />
          {errors.description && (
            <p className="text-sm text-destructive">{errors.description}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="providerId">Provider</Label>
          {providers && formData.providerId !== undefined ? (
            <Select
              value={providerMissing ? "" : formData.providerId}
              onValueChange={(v) => handleInputChange("providerId", v)}
            >
              <SelectTrigger
                className={cn(errors.providerId && "border-destructive")}
              >
                <SelectValue
                  placeholder={
                    providerMissing
                      ? "Previous provider no longer available"
                      : "Select a provider…"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {providers.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.name} - {p.description}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Skeleton className="h-10 w-full" />
          )}
          {errors.providerId && (
            <p className="text-sm text-destructive">{errors.providerId}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="modelType">Model type</Label>
          {formData.modelType !== undefined ? (
            <Select
              key={formData.modelType}
              value={modelTypeMissing ? "" : (formData.modelType ?? "")}
              onValueChange={(v) =>
                handleInputChange("modelType", v as ModelTypeId)
              }
            >
              <SelectTrigger
                className={cn(errors.modelType && "border-destructive")}
              >
                <SelectValue
                  placeholder={
                    modelTypeMissing
                      ? "Previous type is no longer valid"
                      : "Select model type…"
                  }
                />
              </SelectTrigger>

              <SelectContent>
                {MODEL_TYPE_OPTIONS.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Skeleton className="h-10 w-full" />
          )}
          {errors.modelType && (
            <p className="text-sm text-destructive">{errors.modelType}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="active">Status</Label>
          <Select
            value={formData.active ? "true" : "false"}
            onValueChange={(value) =>
              handleInputChange("active", value === "true")
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="true">Active</SelectItem>
              <SelectItem value="false">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end gap-4">
          <Button
            type="submit"
            disabled={isSubmitting || isFormLoading}
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
