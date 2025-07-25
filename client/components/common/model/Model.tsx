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

import { Model as ModelType } from "@/types";
import { createModel } from "@/utils/mutations/models/create-model";
import { updateModel } from "@/utils/mutations/models/update-model";
import { getModel } from "@/utils/queries/models/get-model";
import { useRouter } from "next/navigation";
interface FormErrors {
  name?: string;
  description?: string;
}

interface FormData {
  name?: string;
  description?: string;
  active?: string;
}

export interface ModelProps {
  modelId?: string;
  providerId: string;
}

export default function Model({ modelId, providerId }: ModelProps) {
  const queryClient = useQueryClient();
  const router = useRouter();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEditMode = !!modelId;

  const initialFormData: FormData = useMemo(
    () => ({
      name: "",
      description: "",
      active: "true",
    }),
    []
  );

  const [formData, setFormData] = useState<FormData>({});
  const [errors, setErrors] = useState<FormErrors>({});

  // Fetch the specific model directly if in edit mode
  const { data: modelToEdit, isLoading: isModelLoading } = useQuery({
    queryKey: ["model", modelId],
    queryFn: () => getModel(modelId!),
    enabled: isEditMode,
  });

  const isLoading = isModelLoading;

  // Single consolidated useEffect to handle all form state scenarios
  useEffect(() => {
    if (isEditMode && modelToEdit) {
      // We are in EDIT mode and have the model's data, so populate the form
      setFormData({
        name: modelToEdit.name,
        description: modelToEdit.description,
        active: modelToEdit.active ? "true" : "false",
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

    setIsSubmitting(true);

    try {
      let result;
      if (isEditMode && modelId) {
        result = await updateModel(modelId, {
          name: formData.name,
          description: formData.description,
          active: formData.active === "true" ? true : false,
          updatedAt: new Date().toISOString(),
        });
      } else {
        result = await createModel({
          name: formData.name,
          description: formData.description,
          providerId: providerId,
          active: formData.active === "true" ? true : false,
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

        <div className="space-y-2">
          <Label htmlFor="active">Status</Label>
          {formData.active !== undefined && !isLoading ? (
            <Select
              value={formData.active}
              onValueChange={(value) => handleInputChange("active", value)}
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
