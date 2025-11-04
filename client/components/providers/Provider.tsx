/**
 * Provider.tsx
 * Used to display the provider page with all created providers and management functionality.
 * @AshokSaravanan222 & @siladiea
 * 07/18/2025
 */
"use client";
import { Eye, EyeOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useBreadcrumbContext } from "@/contexts/breadcrumb-context";
import { useProfile } from "@/contexts/profile-context";
import { api } from "@/lib/api/client";
import { keys } from "@/lib/query/keys";
import { maskApiKey } from "@/utils/model-utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export interface ProviderProps {
  providerId?: string;
}

interface FormErrors {
  name?: string;
  description?: string;
  apiKey?: string;
}

interface FormData {
  name?: string;
  description?: string;
  apiKey?: string;
  baseUrl?: string;
}

export default function Provider({ providerId }: ProviderProps) {
  const router = useRouter();
  const { effectiveProfile } = useProfile();
  const { setEntityMetadata, clearEntityMetadata } = useBreadcrumbContext();
  const [showApiKey, setShowApiKey] = useState(false);
  const [decryptedApiKey, setDecryptedApiKey] = useState<string>("");
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [isEditingApiKey, setIsEditingApiKey] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isEditMode = !!providerId;

  const initialFormData: FormData = useMemo(
    () => ({
      name: "",
      description: "",
      apiKey: "",
      baseUrl: "",
    }),
    []
  );

  const [formData, setFormData] = useState<FormData>({});
  const [errors, setErrors] = useState<FormErrors>({});
  const queryClient = useQueryClient();

  // V3 API - fetch provider detail when editing
  const { data: providerDetail, isLoading: isLoadingProviderDetail } = useQuery(
    {
      queryKey: keys.providers.with({
        providerId: providerId || "",
        profileId: effectiveProfile?.id || "",
      }),
      queryFn: () =>
        api.post("/providers/detail", {
          body: {
            providerId: providerId || "",
            profileId: effectiveProfile?.id || "",
          },
        }),
      enabled: !!providerId && isEditMode && !!effectiveProfile?.id,
    }
  );

  const isLoading = isLoadingProviderDetail;

  // V3 API mutations
  const createProviderMutation = useMutation({
    mutationFn: (body: {
      name: string;
      description: string;
      api_key: string;
      base_url: string | null;
    }) => api.post("/providers/create", { body }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.providers.all });
    },
  });

  const updateProviderMutation = useMutation({
    mutationFn: (body: {
      providerId: string;
      name: string;
      description: string;
      api_key?: string;
      base_url?: string | null;
    }) => api.post("/providers/update", { body }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.providers.all });
    },
  });

  const decryptProviderKeyMutation = useMutation({
    mutationFn: (body: { providerId: string; profileId: string }) =>
      api.post("/providers/decrypt-key", { body }),
  });

  // Set breadcrumb context when provider data is loaded
  useEffect(() => {
    if (providerDetail?.name && providerId && isEditMode) {
      setEntityMetadata({
        entityId: providerId,
        entityName: providerDetail.name,
        entityType: "provider",
      });
    }
    return () => clearEntityMetadata();
  }, [
    providerDetail,
    providerId,
    isEditMode,
    setEntityMetadata,
    clearEntityMetadata,
  ]);

  // Initialize form when provider data loads or in create mode
  useEffect(() => {
    if (isEditMode && providerDetail) {
      setFormData({
        name: providerDetail.name,
        description: providerDetail.description,
        apiKey: "",
        baseUrl: providerDetail.base_url || "",
      });
    } else if (!isEditMode) {
      setFormData(initialFormData);
    }
  }, [isEditMode, providerDetail, initialFormData]);

  const handleInputChange = (
    field: keyof FormData,
    value: string | undefined
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const resetFormAndState = () => {
    setFormData(initialFormData);
    setErrors({});
    setShowApiKey(false);
    setDecryptedApiKey("");
    setIsEditingApiKey(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
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

    if (!isEditMode && !formData.apiKey) {
      setErrors((prev) => ({
        ...prev,
        apiKey: "API Key is required",
      }));
      return;
    }

    setIsSubmitting(true);

    try {
      if (isEditMode && providerId && providerDetail) {
        // For updates, we use the updateProvider mutation
        const updateBody: {
          providerId: string;
          name: string;
          description: string;
          api_key?: string;
          base_url?: string | null;
        } = {
          providerId: providerId,
          name: formData.name!,
          description: formData.description!,
          base_url: formData.baseUrl || null,
        };
        if (
          isEditingApiKey &&
          formData.apiKey &&
          formData.apiKey.trim() !== ""
        ) {
          updateBody.api_key = formData.apiKey;
        }
        await updateProviderMutation.mutateAsync(updateBody);
        resetFormAndState();
        toast.success("Provider updated successfully!");
        router.push(`/system/providers`);
      } else {
        // For creates
        await createProviderMutation.mutateAsync({
          name: formData.name!,
          description: formData.description!,
          api_key: formData.apiKey!,
          base_url: formData.baseUrl || null,
        });
        resetFormAndState();
        toast.success("Provider created successfully!");
        router.push(`/system/providers`);
      }
    } catch (error) {
      toast.error(
        `Failed to ${isEditMode ? "update" : "create"} provider: ${error instanceof Error ? error.message : "Unknown error"}`
      );
      setIsSubmitting(false);
    }
  };

  const handleToggleApiKey = async () => {
    if (!providerDetail || !effectiveProfile) return;

    if (!showApiKey) {
      setIsDecrypting(true);
      try {
        const result = await decryptProviderKeyMutation.mutateAsync({
          providerId: providerId || "",
          profileId: effectiveProfile.id,
        });
        if (result && typeof result === "object" && "api_key" in result) {
          setDecryptedApiKey(result.api_key as string);
          setShowApiKey(true);
        }
      } catch {
        toast.error("Failed to decrypt API key");
      } finally {
        setIsDecrypting(false);
      }
    } else {
      setShowApiKey(false);
      setDecryptedApiKey("");
    }
  };

  const handleStartEditApiKey = () => {
    setIsEditingApiKey(true);
    setFormData((prev) => ({ ...prev, apiKey: "" }));
  };

  const handleCancelEditApiKey = () => {
    setIsEditingApiKey(false);
    setFormData((prev) => ({ ...prev, apiKey: "" }));
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Name Field */}
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          {formData.name !== undefined && !isLoading ? (
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleInputChange("name", e.target.value)}
              placeholder="Enter provider name"
              className={errors.name ? "border-destructive" : ""}
            />
          ) : (
            <Skeleton className="h-10 w-full" />
          )}
          {errors.name && (
            <p className="text-sm text-destructive">{errors.name}</p>
          )}
        </div>

        {/* Description Field */}
        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          {formData.description !== undefined && !isLoading ? (
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange("description", e.target.value)}
              placeholder="Enter provider description"
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

        {/* API Key Field */}
        <div className="space-y-2">
          <Label htmlFor="apiKey">API Key</Label>
          {formData.apiKey !== undefined && !isLoading ? (
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  id="apiKey"
                  type={showApiKey ? "text" : "password"}
                  value={
                    isEditMode
                      ? isEditingApiKey
                        ? formData.apiKey
                        : showApiKey
                          ? decryptedApiKey
                          : maskApiKey(providerDetail?.api_key || "")
                      : formData.apiKey
                  }
                  onChange={(e) =>
                    (isEditMode ? isEditingApiKey : true) &&
                    handleInputChange("apiKey", e.target.value)
                  }
                  placeholder={
                    isEditMode && !isEditingApiKey ? "" : "Enter API key"
                  }
                  className={`flex-1 ${errors.apiKey ? "border-destructive" : ""}`}
                  readOnly={isEditMode && !isEditingApiKey}
                />

                {isEditMode && !isEditingApiKey ? (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleToggleApiKey}
                      disabled={isDecrypting}
                      className="px-3"
                    >
                      {isDecrypting ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
                      ) : showApiKey ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleStartEditApiKey}
                      className="px-3"
                    >
                      Edit
                    </Button>
                  </>
                ) : isEditMode && isEditingApiKey ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleCancelEditApiKey}
                    className="px-3"
                  >
                    Cancel
                  </Button>
                ) : null}
              </div>

              {isEditMode && isEditingApiKey && (
                <div className="text-sm text-muted-foreground bg-blue-50 p-3 rounded-md">
                  <strong>Security Note:</strong> API keys are encrypted before
                  storage. This will replace your current API key.
                </div>
              )}
              {errors.apiKey && (
                <p className="text-sm text-destructive">{errors.apiKey}</p>
              )}
            </div>
          ) : (
            <Skeleton className="h-10 w-full" />
          )}
        </div>

        {/* Base URL Field */}
        <div className="space-y-2">
          <Label htmlFor="baseUrl">
            Base URL <span className="text-muted-foreground">(Optional)</span>
          </Label>
          {formData.baseUrl !== undefined && !isLoading ? (
            <Input
              id="baseUrl"
              value={formData.baseUrl}
              onChange={(e) => handleInputChange("baseUrl", e.target.value)}
              placeholder="https://api.custom-provider.com/v1"
            />
          ) : (
            <Skeleton className="h-10 w-full" />
          )}
          <p className="text-sm text-muted-foreground">
            Leave empty to use the default provider URL. Required for custom
            models.
          </p>
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
            disabled={
              isSubmitting ||
              isLoading ||
              createProviderMutation.isPending ||
              updateProviderMutation.isPending
            }
            className="min-w-[120px]"
          >
            {isSubmitting ||
            createProviderMutation.isPending ||
            updateProviderMutation.isPending ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                {isEditMode ? "Updating..." : "Creating..."}
              </>
            ) : isEditMode ? (
              "Update Provider"
            ) : (
              "Create Provider"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
