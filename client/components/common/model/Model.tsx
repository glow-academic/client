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
import { getAllModels } from "@/utils/queries/models/get-all-models";
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
  const [editingModelId, setEditingModelId] = useState<string | null>(null);

  const initialFormData: Partial<ModelType> = {
    name: "",
    description: "",
    providerId: "",
    active: true,
    modelType: "ttt",
  };

  const [formData, setFormData] = useState<Partial<ModelType>>(initialFormData);
  const [errors, setErrors] = useState<FormErrors>({});

  // Fetch models for the list mode
  const { data: models = [] } = useQuery({
    queryKey: ["models"],
    queryFn: () => getAllModels(),
  });

  const { data: providers = [] } = useQuery({
    queryKey: ["providers"],
    queryFn: () => getAllProviders(),
  });

  // Load model data if editing
  useEffect(() => {
    const targetModelId = modelId || editingModelId;
    if (targetModelId) {
      const modelToEdit = models.find((m: ModelType) => m.id === targetModelId);
      if (modelToEdit) {
        setFormData({
          name: modelToEdit.name || "",
          description: modelToEdit.description || "",
          providerId: modelToEdit.providerId || "",
          active: modelToEdit.active ?? true,
          modelType: modelToEdit.modelType || "ttt",
        });
      }
    }
  }, [modelId, editingModelId, models]);

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
    setEditingModelId(null);
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
      const targetModelId = modelId || editingModelId;
      if (targetModelId) {
        result = await updateModel(targetModelId, {
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
      toast.success(
        targetModelId
          ? "Model updated successfully!"
          : "Model created successfully!"
      );
      router.push(`/management/models`);
    } catch (error) {
      const targetModelId = modelId || editingModelId;
      toast.error(
        `Failed to ${targetModelId ? "update" : "create"} model: ${error instanceof Error ? error.message : "Unknown error"}`
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
            disabled={isSubmitting}
            className="min-w-[120px]"
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                {modelId || editingModelId ? "Updating..." : "Creating..."}
              </>
            ) : modelId || editingModelId ? (
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
