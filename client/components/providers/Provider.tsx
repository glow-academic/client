/**
 * Provider.tsx
 * Used to create and manage providers for the admin dashboard
 */
"use client";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

// UI Components
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

import { Textarea } from "@/components/ui/textarea";
import { useBreadcrumbContext } from "@/contexts/breadcrumb-context";
import { useProfile } from "@/contexts/profile-context";
import { cn } from "@/lib/utils";
import { Check, Power } from "lucide-react";
import { useRouter } from "next/navigation";

// Type-only import from server pages
import type {
  CreateProviderIn,
  CreateProviderOut,
} from "@/app/(main)/system/providers/new/page";
import type {
  ProviderDetailOut,
  UpdateProviderIn,
  UpdateProviderOut,
} from "@/app/(main)/system/providers/p/[providerId]/page";

interface FormErrors {
  name?: string;
  value?: string;
  description?: string;
}

interface FormData {
  name?: string;
  description?: string;
  value?: string;
  active?: boolean;
}

type StepStatus = "pending" | "active" | "completed";

export interface ProviderProps {
  providerId?: string;
  // For edit mode: provider detail
  providerDetail?: ProviderDetailOut;
  createProviderAction?: (
    input: CreateProviderIn,
  ) => Promise<CreateProviderOut>;
  updateProviderAction?: (
    input: UpdateProviderIn,
  ) => Promise<UpdateProviderOut>;
}

export default function Provider({
  providerId,
  providerDetail: serverProviderDetail,
  createProviderAction,
  updateProviderAction,
}: ProviderProps) {
  const router = useRouter();
  const { setEntityMetadata, clearEntityMetadata } = useBreadcrumbContext();
  const { effectiveProfile } = useProfile();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEditMode = !!providerId;

  const initialFormData: FormData = useMemo(
    () => ({
      name: "New Provider",
      description: "",
      value: "",
      active: true,
    }),
    [],
  );

  const [formData, setFormData] = useState<FormData>({});
  const [errors, setErrors] = useState<FormErrors>({});

  // Use server-provided data
  const providerDetail = serverProviderDetail;

  // Extract body types from server action types for type safety
  type CreateProviderBody = CreateProviderIn extends { body: infer B }
    ? B
    : never;
  type UpdateProviderBody = UpdateProviderIn extends { body: infer B }
    ? B
    : never;

  // Use server actions directly (no mutations needed)
  const handleCreateProvider = async (body: CreateProviderBody) => {
    if (!createProviderAction) {
      throw new Error("createProviderAction is required");
    }
    await createProviderAction({ body });
  };

  const handleUpdateProvider = async (body: UpdateProviderBody) => {
    if (!updateProviderAction) {
      throw new Error("updateProviderAction is required");
    }
    await updateProviderAction({ body });
  };

  // Check if readonly
  const isReadonly = useMemo(() => {
    if (isEditMode && providerDetail) {
      return !providerDetail.can_edit;
    }
    return false;
  }, [isEditMode, providerDetail]);

  // Set breadcrumb context for provider (edit mode only)
  useEffect(() => {
    if (providerDetail?.name && providerId && isEditMode) {
      setEntityMetadata({
        entityId: providerId,
        entityName: providerDetail.name,
        entityType: "provider",
      });
    }
    return () => {
      if (providerId) {
        clearEntityMetadata(providerId);
      }
    };
  }, [
    providerDetail,
    providerId,
    isEditMode,
    setEntityMetadata,
    clearEntityMetadata,
  ]);

  // Step status logic
  const getStepStatus = useCallback(
    (stepId: string): StepStatus => {
      const hasName =
        !!formData?.name?.trim() && formData.name !== "New Provider";
      switch (stepId) {
        case "basic":
          return hasName ? "completed" : "active";
        default:
          return "pending";
      }
    },
    [formData?.name],
  );

  // Single consolidated useEffect to handle all form state scenarios
  useEffect(() => {
    if (isEditMode && providerDetail) {
      // We are in EDIT mode and have the provider's data, so populate the form
      setFormData({
        name: providerDetail.name,
        description: providerDetail.description || "",
        value: providerDetail.value || "",
        active: providerDetail.active,
      });
    } else if (!isEditMode) {
      // We are in CREATE mode, so reset the form to its initial state
      setFormData(initialFormData);
    }
  }, [isEditMode, providerDetail, initialFormData]);

  const handleInputChange = (
    field: keyof FormData,
    value: string | boolean | undefined,
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

    // Ensure profileId exists - required for API calls
    if (!effectiveProfile?.id) {
      toast.error("Profile not loaded. Please refresh the page.");
      return;
    }

    if (!formData.name) {
      setErrors((prev) => ({ ...prev, name: "Name is required" }));
      return;
    }

    if (!formData.value) {
      setErrors((prev) => ({ ...prev, value: "Value is required" }));
      return;
    }

    setIsSubmitting(true);

    try {
      if (isEditMode && providerId) {
        await handleUpdateProvider({
          providerId: providerId,
          name: formData.name!,
          description: formData.description || "",
          value: formData.value!,
          active: formData.active ?? true,
          // profileId comes from X-Profile-Id header automatically
        });
        resetFormAndState();
        toast.success("Provider updated successfully!");
        router.push(`/system/providers`);
      } else {
        await handleCreateProvider({
          name: formData.name!,
          description: formData.description || "",
          value: formData.value!,
          active: formData.active ?? true,
          // profileId comes from X-Profile-Id header automatically
        });
        resetFormAndState();
        toast.success("Provider created successfully!");
        router.push(`/system/providers`);
      }
    } catch (error) {
      toast.error(
        `Failed to ${isEditMode && providerId ? "update" : "create"} provider: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      setIsSubmitting(false);
    }
  };

  const stepStatus = getStepStatus("basic");

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Step 1: Basic Information */}
        <Card className="transition-all">
          <CardContent className="pt-3">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium shrink-0",
                  stepStatus === "completed"
                    ? "bg-green-500 text-white"
                    : stepStatus === "active"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted",
                )}
              >
                {stepStatus === "completed" ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <span>1</span>
                )}
              </div>
              <div className="flex-1">
                {formData?.name !== undefined ? (
                  <input
                    type="text"
                    id="name"
                    data-testid="input-provider-name"
                    value={formData.name}
                    onChange={(e) => handleInputChange("name", e.target.value)}
                    onFocus={(e) => {
                      if (e.target.value === "New Provider") {
                        e.target.select();
                      }
                    }}
                    onBlur={(e) => {
                      // If empty on blur, revert to default name
                      if (!e.target.value || e.target.value.trim() === "") {
                        handleInputChange("name", "New Provider");
                      }
                    }}
                    className={cn(
                      "w-full text-2xl font-semibold border-none outline-none bg-transparent px-2 py-1 hover:bg-muted/50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:bg-muted/50 focus:ring-2 focus:ring-primary/20",
                      errors.name && "border-destructive",
                    )}
                    placeholder="New Provider"
                    disabled={isReadonly || isSubmitting}
                  />
                ) : null}
                <p className="text-xs text-muted-foreground mt-1 px-2">
                  Click to edit
                </p>
                {errors.name && (
                  <p className="text-sm text-destructive mt-1 px-2">
                    {errors.name}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
          <CardContent className="pt-0 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="value">Value</Label>
              {formData.value !== undefined ? (
                <Input
                  id="value"
                  data-testid="input-provider-value"
                  value={formData.value}
                  onChange={(e) => handleInputChange("value", e.target.value)}
                  placeholder="Enter provider value identifier (e.g., openai, gemini, custom)"
                  className={errors.value ? "border-destructive" : ""}
                  disabled={isReadonly || isSubmitting}
                />
              ) : null}
              {errors.value && (
                <p className="text-sm text-destructive">{errors.value}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Unique identifier for this provider (used in API calls)
              </p>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              {formData.description !== undefined ? (
                <Textarea
                  id="description"
                  data-testid="input-provider-description"
                  value={formData.description || ""}
                  onChange={(e) =>
                    handleInputChange("description", e.target.value)
                  }
                  placeholder="Enter a brief description (optional)"
                  rows={3}
                  disabled={isReadonly || isSubmitting}
                  className={errors.description ? "border-destructive" : ""}
                />
              ) : null}
              {errors.description && (
                <p className="text-sm text-destructive">{errors.description}</p>
              )}
            </div>

            {/* Active Switch */}
            <div className="space-y-2 pt-2">
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
                      data-testid="switch-provider-active"
                      checked={formData.active ?? true}
                      onCheckedChange={(checked) =>
                        handleInputChange("active", checked)
                      }
                      disabled={isReadonly || isSubmitting}
                    />
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground pl-5">
                  Inactive providers will not be available for selection
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Submit Button */}
        {!isReadonly && (
          <div className="flex justify-end gap-3">
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
              data-testid="btn-submit-provider"
              disabled={isSubmitting}
              className="min-w-[120px]"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  {isEditMode && providerId ? "Updating..." : "Creating..."}
                </>
              ) : isEditMode && providerId ? (
                "Update Provider"
              ) : (
                "Create Provider"
              )}
            </Button>
          </div>
        )}
      </form>
    </div>
  );
}
