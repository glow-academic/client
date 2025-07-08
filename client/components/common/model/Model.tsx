/**
 * Model.tsx
 * Used to create and manage models for the admin dashboard
 * @AshokSaravanan222 & @siladiea
 * 06/18/2025
 */
"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";

// UI Components
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import { useRole } from "@/contexts/role-context";
import { Model as ModelType, Provider } from "@/types";
import { createModel } from "@/utils/mutations/models/create-model";
import { updateModel } from "@/utils/mutations/models/update-model";
import { getModel } from "@/utils/queries/models/get-model";
import { getAllProviders } from "@/utils/queries/providers/get-all-providers";
import { useRouter } from "next/navigation";

interface ModelProps {
  modelId?: string;
}

interface FormErrors {
  name?: string;
  description?: string;
  providerId?: string;
  modelType?: string;
}

export default function Model({ modelId }: ModelProps) {
  const queryClient = useQueryClient();
  const router = useRouter();

  // Role-based access control
  const { effectiveRole } = useRole();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEditMode = !!modelId;

  const initialFormData: Partial<ModelType> = {
    name: "",
    description: "",
    providerId: "",
    active: true,
    modelType: "ttt",
  };

  const [formData, setFormData] = useState<Partial<ModelType>>(initialFormData);
  const [errors, setErrors] = useState<FormErrors>({});

  // Fetch the specific model directly if in edit mode
  const { data: modelToEdit, isLoading: isModelLoading } = useQuery({
    queryKey: ["model", modelId],
    queryFn: () => getModel(modelId!),
    enabled: isEditMode,
  });

  const { data: providers = [], isLoading: areProvidersLoading } = useQuery({
    queryKey: ["providers"],
    queryFn: () => getAllProviders(),
  });

  // Combined loading state
  const isLoading = (isEditMode && isModelLoading) || areProvidersLoading;

  // Load model data if editing
  useEffect(() => {
    if (isEditMode && modelToEdit) {
      setFormData({
        name: modelToEdit.name || "",
        description: modelToEdit.description || "",
        providerId: modelToEdit.providerId || "",
        active: modelToEdit.active ?? true,
        modelType: modelToEdit.modelType || "ttt",
      });
    }
  }, [isEditMode, modelToEdit]);

  // Role-based access control - check after all hooks
  if (effectiveRole !== "admin") {
    return (
      <div className="flex items-center justify-center h-64">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-destructive">Access Denied</CardTitle>
            <CardDescription>
              You need admin privileges to access model management.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // Show loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <div className="h-4 bg-muted rounded animate-pulse w-16" />
          <div className="h-10 bg-muted rounded animate-pulse" />
        </div>
        <div className="space-y-2">
          <div className="h-4 bg-muted rounded animate-pulse w-20" />
          <div className="h-20 bg-muted rounded animate-pulse" />
        </div>
        <div className="space-y-2">
          <div className="h-4 bg-muted rounded animate-pulse w-16" />
          <div className="h-10 bg-muted rounded animate-pulse" />
        </div>
        <div className="space-y-2">
          <div className="h-4 bg-muted rounded animate-pulse w-20" />
          <div className="h-10 bg-muted rounded animate-pulse" />
        </div>
        <div className="space-y-2">
          <div className="h-4 bg-muted rounded animate-pulse w-12" />
          <div className="h-10 bg-muted rounded animate-pulse" />
        </div>
      </div>
    );
  }

  // Show error state if model not found (only in edit mode)
  if (isEditMode && !isLoading && !modelToEdit) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Model Not Found</CardTitle>
            <CardDescription>
              The requested model could not be found.
            </CardDescription>
          </CardHeader>
          <div className="p-6">
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">
                The model with ID "{modelId}" does not exist or you don't have
                permission to view it.
              </p>
              <Button onClick={() => router.push("/management/models")}>
                Back to Models
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  const handleInputChange = (
    field: keyof Partial<ModelType>,
    value: string | boolean
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

    if (!formData.providerId) {
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
          providerId: formData.providerId || "",
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
          <Select
            value={formData.providerId || ""}
            onValueChange={(value) => handleInputChange("providerId", value)}
          >
            <SelectTrigger
              className={errors.providerId ? "border-destructive" : ""}
            >
              <SelectValue placeholder="Select a provider..." />
            </SelectTrigger>
            <SelectContent>
              {providers.map((provider: Provider) => (
                <SelectItem key={provider.id} value={provider.id}>
                  {provider.name} - {provider.description}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.providerId && (
            <p className="text-sm text-destructive">{errors.providerId}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="modelType">Model Type</Label>
          <Select
            value={formData.modelType || "ttt"}
            onValueChange={(value) => handleInputChange("modelType", value)}
          >
            <SelectTrigger
              className={errors.modelType ? "border-destructive" : ""}
            >
              <SelectValue placeholder="Select model type..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ttt">Text-to-Text (TTT)</SelectItem>
              <SelectItem value="stt">Speech-to-Text (STT)</SelectItem>
              <SelectItem value="tts">Text-to-Speech (TTS)</SelectItem>
            </SelectContent>
          </Select>
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
