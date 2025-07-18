/**
 * Provider.tsx
 * Used to display the provider page with all created providers and management functionality.
 * @AshokSaravanan222 & @siladiea
 * 07/18/2025
 */
"use client";
import { logError } from "@/utils/logger";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Eye, EyeOff, Save, Settings } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { maskApiKey } from "@/utils/model/client-model";
import { decryptProviderKey } from "@/utils/model/server-model";
import { updateProviderWithEncryption } from "@/utils/model/update-provider-with-encryption";
import { getProvider } from "@/utils/queries/providers/get-provider";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface ProviderProps {
  providerId?: string;
}

export default function Provider({ providerId }: ProviderProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showApiKey, setShowApiKey] = useState(false);
  const [decryptedApiKey, setDecryptedApiKey] = useState<string>("");
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [isEditingApiKey, setIsEditingApiKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form state for provider editing
  const [editForm, setEditForm] = useState({
    name: "",
    description: "",
    apiKey: "",
    baseUrl: "",
  });

  // Fetch provider data
  const { data: provider, isLoading } = useQuery({
    queryKey: ["provider", providerId],
    queryFn: () => getProvider(providerId!),
    enabled: !!providerId,
  });

  // Initialize form when provider data loads
  useEffect(() => {
    if (provider) {
      setEditForm({
        name: provider.name,
        description: provider.description,
        apiKey: "",
        baseUrl: provider.baseUrl || "",
      });
    }
  }, [provider]);

  // Check if there are any changes to save
  const hasChanges =
    provider &&
    (editForm.name !== provider.name ||
      editForm.description !== provider.description ||
      editForm.baseUrl !== (provider.baseUrl || "") ||
      (isEditingApiKey && editForm.apiKey.trim() !== ""));

  const handleSave = async () => {
    if (!provider || !hasChanges) return;

    setIsSaving(true);
    try {
      // Prepare update data - only include changed fields
      const updateData: {
        name?: string;
        description?: string;
        apiKey?: string;
        baseUrl?: string;
      } = {};

      if (editForm.name !== provider.name) {
        updateData.name = editForm.name;
      }

      if (editForm.description !== provider.description) {
        updateData.description = editForm.description;
      }

      if (editForm.baseUrl !== (provider.baseUrl || "")) {
        updateData.baseUrl = editForm.baseUrl;
      }

      // Only include API key if user is editing it and entered a new one
      if (isEditingApiKey && editForm.apiKey.trim() !== "") {
        updateData.apiKey = editForm.apiKey;
      }

      // Call secure server action that handles encryption
      await updateProviderWithEncryption(provider.id, updateData);

      toast.success("Provider updated successfully");

      // Refresh data
      queryClient.invalidateQueries({ queryKey: ["provider", providerId] });
      queryClient.invalidateQueries({ queryKey: ["providers"] });

      // Reset API key editing state
      setIsEditingApiKey(false);
      setEditForm((prev) => ({ ...prev, apiKey: "" }));
    } catch (error) {
      logError("Error updating provider:", error);
      toast.error("Failed to update provider");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleApiKey = async () => {
    if (!provider) return;

    if (!showApiKey) {
      setIsDecrypting(true);
      try {
        const decrypted = await decryptProviderKey(provider.apiKey);
        setDecryptedApiKey(decrypted);
        setShowApiKey(true);
      } catch (error) {
        logError("Error decrypting API key:", error);
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
    setEditForm((prev) => ({ ...prev, apiKey: "" }));
  };

  const handleCancelEditApiKey = () => {
    setIsEditingApiKey(false);
    setEditForm((prev) => ({ ...prev, apiKey: "" }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-current" />
      </div>
    );
  }

  if (!provider) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Settings className="h-12 w-12 text-muted-foreground" />
        <h3 className="text-lg font-medium">Provider not found</h3>
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Go Back
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Provider Settings</h1>
          <p className="text-muted-foreground">
            Manage settings for {provider.name}
          </p>
        </div>
      </div>

      {/* Provider Settings Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Provider Configuration
          </CardTitle>
          <CardDescription>
            Update your provider settings and API configuration
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Name Field */}
          <div className="space-y-2">
            <Label htmlFor="provider-name">Provider Name</Label>
            <Input
              id="provider-name"
              value={editForm.name}
              onChange={(e) =>
                setEditForm((prev) => ({ ...prev, name: e.target.value }))
              }
              placeholder="Enter provider name"
            />
          </div>

          {/* Description Field */}
          <div className="space-y-2">
            <Label htmlFor="provider-description">Description</Label>
            <Input
              id="provider-description"
              value={editForm.description}
              onChange={(e) =>
                setEditForm((prev) => ({
                  ...prev,
                  description: e.target.value,
                }))
              }
              placeholder="Enter provider description"
            />
          </div>

          {/* Base URL Field */}
          <div className="space-y-2">
            <Label htmlFor="base-url">
              Base URL <span className="text-muted-foreground">(Optional)</span>
            </Label>
            <Input
              id="base-url"
              value={editForm.baseUrl}
              onChange={(e) =>
                setEditForm((prev) => ({
                  ...prev,
                  baseUrl: e.target.value,
                }))
              }
              placeholder="https://api.custom-provider.com/v1"
            />
            <p className="text-sm text-muted-foreground">
              Leave empty to use the default provider URL. Required for custom
              models.
            </p>
          </div>

          {/* API Key Field */}
          <div className="space-y-2">
            <Label htmlFor="api-key">API Key</Label>
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  id="api-key"
                  type={showApiKey ? "text" : "password"}
                  value={
                    isEditingApiKey
                      ? editForm.apiKey
                      : showApiKey
                        ? decryptedApiKey
                        : maskApiKey(provider.apiKey)
                  }
                  onChange={(e) =>
                    isEditingApiKey &&
                    setEditForm((prev) => ({
                      ...prev,
                      apiKey: e.target.value,
                    }))
                  }
                  placeholder={isEditingApiKey ? "Enter new API key" : ""}
                  className="flex-1"
                  readOnly={!isEditingApiKey}
                />

                {!isEditingApiKey ? (
                  <>
                    <Button
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
                      variant="outline"
                      size="sm"
                      onClick={handleStartEditApiKey}
                      className="px-3"
                    >
                      Edit
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCancelEditApiKey}
                    className="px-3"
                  >
                    Cancel
                  </Button>
                )}
              </div>

              {isEditingApiKey && (
                <div className="text-sm text-muted-foreground bg-blue-50 p-3 rounded-md">
                  <strong>Security Note:</strong> API keys are encrypted before
                  storage. This will replace your current API key.
                </div>
              )}
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end pt-4 border-t">
            <Button onClick={handleSave} disabled={!hasChanges || isSaving}>
              {isSaving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
