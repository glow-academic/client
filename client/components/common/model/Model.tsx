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
import { Model as ModelType } from "@/types";
import { modelType } from "@/utils/drizzle/schema";
interface FormErrors {
  name?: string;
  description?: string;
  providerId?: string;
  modelType?: string;
}

interface FormData {
  name?: string;
  description?: string;
  providerId?: string;
  active?: string;
  modelType?: ModelType["modelType"];
}

interface ModelProps {
  modelId?: string;
}

export default function Model({ modelId }: ModelProps) {
  const queryClient = useQueryClient();
  const router = useRouter();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEditMode = !!modelId;

  const initialFormData: FormData = useMemo(() => ({}), []);

  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [errors, setErrors] = useState<FormErrors>({});

  const { data: providers } = useQuery({
    queryKey: ["providers"],
    queryFn: () => getAllProviders(),
  });

  // Fetch the specific model directly if in edit mode
  const { data: modelToEdit } = useQuery({
    queryKey: ["model", modelId],
    queryFn: () => getModel(modelId!),
    enabled: isEditMode,
  });

  // Single consolidated useEffect to handle all form state scenarios
  useEffect(() => {
    if (isEditMode && modelToEdit) {
      // We are in EDIT mode and have the model's data, so populate the form
      setFormData({
        name: modelToEdit.name,
        description: modelToEdit.description,
        providerId: modelToEdit.providerId,
        active: modelToEdit.active ? "true" : "false",
        modelType: modelToEdit.modelType,
      });
    } else if (!isEditMode) {
      // We are in CREATE mode, so reset the form to its initial state
      setFormData(initialFormData);
    }
  }, [isEditMode, modelToEdit, initialFormData]);

  const handleInputChange = (
    field: keyof ModelType,
    value: string | boolean | ModelType["modelType"] | undefined
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
      setErrors((prev) => ({ ...prev, description: "Description is required" }));
      return;
    }

    if (!formData.providerId) {
      setErrors((prev) => ({ ...prev, providerId: "Provider is required" }));
      return;
    }

    if (!formData.modelType) {
      setErrors((prev) => ({ ...prev, modelType: "Model type is required" }));
      return;
    }

    setIsSubmitting(true);

    try {
      let result;
      if (isEditMode && modelId) {
        result = await updateModel(modelId, {
          ...formData,
          active: formData.active === "true" ? true : false,
          updatedAt: new Date().toISOString(),
        });
      } else {
        result = await createModel({
          name: formData.name,
          description: formData.description,
          providerId: formData.providerId,
          active: formData.active === "true" ? true : false,
          modelType: formData.modelType,
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
          {formData.name !== undefined ? (
            <Input
            id="name"
            value={formData.name}
            onChange={(e) => handleInputChange("name", e.target.value)}
            placeholder="Enter model name"
            className={errors.name ? "border-destructive" : ""}
          />) : (
            <Skeleton className="h-10 w-full" />
          )}
          {errors.name && (
            <p className="text-sm text-destructive">{errors.name}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          {formData.description !== undefined ? (<Textarea
            id="description"
            value={formData.description}
            onChange={(e) => handleInputChange("description", e.target.value)}
            placeholder="Enter model description"
            rows={3}
            className={errors.description ? "border-destructive" : ""}
          />) : (
            <Skeleton className="h-10 w-full" />
          )}
          {errors.description && (
            <p className="text-sm text-destructive">{errors.description}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="providerId">Provider</Label>
          {providers && formData.providerId !== undefined ? (
            <Select
              value={formData.providerId}
              onValueChange={(v) => handleInputChange("providerId", v)}
            >
              <SelectTrigger
                className={cn(errors.providerId && "border-destructive")}
              >
                <SelectValue
                  placeholder={
                    "Select a provider…"
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
              value={formData.modelType}
              onValueChange={(v) =>
                handleInputChange("modelType", v as ModelType["modelType"])
              }
            >
              <SelectTrigger
                className={cn(errors.modelType && "border-destructive")}
              >
                <SelectValue
                  placeholder={
                    "Select model type…"
                  }
                />
              </SelectTrigger>

              <SelectContent>
                {Object.values(modelType.enumValues).map((o) => (
                  <SelectItem key={o} value={o}>
                    {o.toUpperCase()}
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
          {formData.active !== undefined ? (
            <Select
            value={formData.active}
            onValueChange={(value) =>
              handleInputChange("active", value)
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
          ) : (
            <Skeleton className="h-10 w-full" />
          )}
        </div>

        {/* Submit Button */}
        <div className="flex justify-end gap-4">
          <Button
            type="submit"
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
