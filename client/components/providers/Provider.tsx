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
import { Textarea } from "@/components/ui/textarea";
import { useBreadcrumbContext } from "@/contexts/breadcrumb-context";
import { useProfile } from "@/contexts/profile-context";
import { maskApiKey } from "@/utils/model-utils";

// Type-only import from server page (for edit mode)
import type {
  CreateProviderIn,
  CreateProviderOut,
  DecryptProviderKeyIn,
  DecryptProviderKeyOut,
  ProviderDetailOut,
  UpdateProviderIn,
  UpdateProviderOut,
} from "@/app/(main)/system/providers/p/[providerId]/page";

export interface ProviderProps {
  providerId?: string;
  // Optional server-provided data and actions (for server-side rendering)
  providerDetail?: ProviderDetailOut;
  createProviderAction?: (
    input: CreateProviderIn,
  ) => Promise<CreateProviderOut>;
  updateProviderAction?: (
    input: UpdateProviderIn,
  ) => Promise<UpdateProviderOut>;
  decryptProviderKeyAction?: (
    input: DecryptProviderKeyIn,
  ) => Promise<DecryptProviderKeyOut>;
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

export default function Provider({
  providerId,
  providerDetail: serverProviderDetail,
  createProviderAction,
  updateProviderAction,
  decryptProviderKeyAction,
}: ProviderProps) {
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
    [],
  );

  const [formData, setFormData] = useState<FormData>({});
  const [errors, setErrors] = useState<FormErrors>({});

  // Use server-provided data (no React Query needed when server data is provided)
  const providerDetail = serverProviderDetail;

  // Extract body types from server action types for type safety
  type CreateProviderBody = CreateProviderIn extends { body: infer B }
    ? B
    : never;
  type UpdateProviderBody = UpdateProviderIn extends { body: infer B }
    ? B
    : never;
  type DecryptProviderKeyBody = DecryptProviderKeyIn extends { body: infer B }
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

  const handleDecryptProviderKey = async (body: DecryptProviderKeyBody) => {
    if (!decryptProviderKeyAction) {
      throw new Error("decryptProviderKeyAction is required");
    }
    return await decryptProviderKeyAction({ body });
  };

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
    value: string | undefined,
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
        // For updates, we use the server action
        const updateBody: UpdateProviderBody = {
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
        await handleUpdateProvider(updateBody);
        resetFormAndState();
        toast.success("Provider updated successfully!");
        router.push(`/system/providers`);
      } else {
        // For creates, we use the server action
        await handleCreateProvider({
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
        `Failed to ${isEditMode ? "update" : "create"} provider: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      setIsSubmitting(false);
    }
  };

  const handleToggleApiKey = async () => {
    if (!providerDetail || !effectiveProfile || !providerId) return;

    if (!showApiKey) {
      setIsDecrypting(true);
      try {
        const result = await handleDecryptProviderKey({
          providerId: providerId,
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
          {formData.name !== undefined ? (
            <Input
              id="name"
              data-testid="input-provider-name"
              value={formData.name}
              onChange={(e) => handleInputChange("name", e.target.value)}
              placeholder="Enter provider name"
              className={errors.name ? "border-destructive" : ""}
            />
          ) : null}
          {errors.name && (
            <p className="text-sm text-destructive">{errors.name}</p>
          )}
        </div>

        {/* Description Field */}
        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          {formData.description !== undefined ? (
            <Textarea
              id="description"
              data-testid="input-provider-description"
              value={formData.description}
              onChange={(e) => handleInputChange("description", e.target.value)}
              placeholder="Enter provider description"
              rows={3}
              className={errors.description ? "border-destructive" : ""}
            />
          ) : null}
          {errors.description && (
            <p className="text-sm text-destructive">{errors.description}</p>
          )}
        </div>

        {/* API Key Field */}
        <div className="space-y-2">
          <Label htmlFor="apiKey">API Key</Label>
          {formData.apiKey !== undefined ? (
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  id="apiKey"
                  data-testid="input-provider-api-key"
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
                      data-testid="btn-toggle-api-key"
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
                      data-testid="btn-edit-api-key"
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
          ) : null}
        </div>

        {/* Base URL Field */}
        <div className="space-y-2">
          <Label htmlFor="baseUrl">
            Base URL <span className="text-muted-foreground">(Optional)</span>
          </Label>
          {formData.baseUrl !== undefined ? (
            <Input
              id="baseUrl"
              data-testid="input-provider-base-url"
              value={formData.baseUrl}
              onChange={(e) => handleInputChange("baseUrl", e.target.value)}
              placeholder="https://api.custom-provider.com/v1"
            />
          ) : null}
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
