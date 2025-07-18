/**
 * Providers.tsx
 * Used to display the models page with all created models and management functionality.
 * @AshokSaravanan222 & @siladiea
 * 06/18/2025
 */
"use client";
import { logError } from "@/utils/logger";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Cpu,
  Edit,
  Eye,
  EyeOff,
  Plus,
  Save,
  Settings,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { maskApiKey } from "@/utils/model/client-model";
import { decryptProviderKey } from "@/utils/model/server-model";
import { updateProviderWithEncryption } from "@/utils/model/update-provider-with-encryption";
import { deleteModel } from "@/utils/mutations/models/delete-model";
import { getAllModels } from "@/utils/queries/models/get-all-models";
import { getAllProviders } from "@/utils/queries/providers/get-all-providers";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Model, Provider } from "@/types";

interface ProviderGroup {
  provider: Provider;
  models: Model[];
}

export default function Providers() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showProviderDialog, setShowProviderDialog] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(
    null
  );
  const [showApiKey, setShowApiKey] = useState(false);
  const [decryptedApiKey, setDecryptedApiKey] = useState<string>("");
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [deleteItem, setDeleteItem] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Form state for provider editing
  const [editForm, setEditForm] = useState({
    name: "",
    description: "",
    apiKey: "",
  });

  // API key editing state
  const [isEditingApiKey, setIsEditingApiKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch models and providers data
  const { data: models = [], refetch: refetchModels } = useQuery({
    queryKey: ["models"],
    queryFn: () => getAllModels(),
  });

  const { data: providers = [] } = useQuery({
    queryKey: ["providers"],
    queryFn: () => getAllProviders(),
  });

  // Group models by provider
  const providerGroups: ProviderGroup[] = providers
    .map((provider: Provider) => ({
      provider,
      models: models.filter((model: Model) => model.providerId === provider.id),
    }))
    .filter((group: ProviderGroup) => group.models.length > 0);

  // Check if there are any changes to save
  const hasChanges =
    selectedProvider &&
    (editForm.name !== selectedProvider.name ||
      editForm.description !== selectedProvider.description ||
      (isEditingApiKey && editForm.apiKey.trim() !== ""));

  const handleDelete = async () => {
    if (!deleteItem) return;

    setIsDeleting(true);
    try {
      await deleteModel(deleteItem.id);

      toast.success("Model deleted successfully");
      // Invalidate queries to ensure all components refresh
      queryClient.invalidateQueries({ queryKey: ["models"] });
      refetchModels();
    } catch (error) {
      logError("Error deleting model:", error);
      toast.error("Failed to delete model");
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
      setDeleteItem(null);
    }
  };

  const handleDeleteClick = (id: string, name: string) => {
    setDeleteItem({ id, name });
    setShowDeleteDialog(true);
  };

  const handleEdit = (id: string) => {
    router.push(`/management/models/m/${id}`);
  };

  const handleProviderSettings = (provider: Provider) => {
    setSelectedProvider(provider);
    setEditForm({
      name: provider.name,
      description: provider.description,
      apiKey: "",
    });
    setShowProviderDialog(true);
    setShowApiKey(false);
    setDecryptedApiKey("");
    setIsEditingApiKey(false);
  };

  const handleStartEditApiKey = () => {
    setIsEditingApiKey(true);
    setEditForm((prev) => ({ ...prev, apiKey: "" }));
  };

  const handleCancelEditApiKey = () => {
    setIsEditingApiKey(false);
    setEditForm((prev) => ({ ...prev, apiKey: "" }));
  };

  const handleSave = async () => {
    if (!selectedProvider || !hasChanges) return;

    setIsSaving(true);
    try {
      // Prepare update data - only include changed fields
      const updateData: {
        name?: string;
        description?: string;
        apiKey?: string;
      } = {};

      if (editForm.name !== selectedProvider.name) {
        updateData.name = editForm.name;
      }

      if (editForm.description !== selectedProvider.description) {
        updateData.description = editForm.description;
      }

      // Only include API key if user is editing it and entered a new one
      if (isEditingApiKey && editForm.apiKey.trim() !== "") {
        updateData.apiKey = editForm.apiKey;
      }

      // Call secure server action that handles encryption
      await updateProviderWithEncryption(selectedProvider.id, updateData);

      toast.success("Provider updated successfully");

      // Refresh data
      queryClient.invalidateQueries({ queryKey: ["providers"] });
      queryClient.invalidateQueries({ queryKey: ["models"] });

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
    if (!selectedProvider) return;

    if (!showApiKey) {
      setIsDecrypting(true);
      try {
        const decrypted = await decryptProviderKey(selectedProvider.apiKey);
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

  const handleCloseProviderDialog = () => {
    setShowProviderDialog(false);
    setSelectedProvider(null);
    setShowApiKey(false);
    setDecryptedApiKey("");
    setIsEditingApiKey(false);
    setEditForm({ name: "", description: "", apiKey: "" });
  };

  return (
    <div className="space-y-6">
      {providerGroups.length === 0 && (
        <div className="col-span-full">
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Sparkles className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No models yet</h3>
            </CardContent>
          </Card>
        </div>
      )}

      {providerGroups.map((group: ProviderGroup) => (
        <div key={group.provider.id} className="space-y-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <Badge variant="secondary" className="text-sm px-3 py-1">
                {group.provider.name}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {group.provider.description}
              </span>
            </div>
            <Button
              variant="default"
              size="sm"
              onClick={() => handleProviderSettings(group.provider)}
              className="h-8 w-8 p-0"
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {group.models
              .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
              .map((model: Model) => (
                <Card
                  key={model.id}
                  className="hover:shadow-md transition-shadow"
                >
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Cpu className="h-4 w-4" />
                          {model.name}
                        </CardTitle>
                        <CardDescription className="text-xs line-clamp-2">
                          {model.description}
                        </CardDescription>
                      </div>
                      <Badge variant={model.active ? "default" : "secondary"}>
                        {model.active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardFooter className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(model.id)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteClick(model.id, model.name)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </CardFooter>
                </Card>
              ))}

            {/* Create New Model Card */}
            <Card
              className="border-dashed border-2 hover:border-dashed hover:border-primary/50 transition-colors cursor-pointer"
              onClick={() => router.push(`/models/p/${group.provider.id}/new`)}
            >
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Plus className="h-8 w-8 text-muted-foreground mb-3" />
                <h3 className="text-sm font-medium text-muted-foreground mb-1">
                  Create New Model
                </h3>
                <p className="text-xs text-muted-foreground text-center">
                  Add a new model to {group.provider.name}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      ))}

      {/* Provider Settings Dialog */}
      <Dialog
        open={showProviderDialog}
        onOpenChange={handleCloseProviderDialog}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Provider Settings</DialogTitle>
            <DialogDescription>
              Manage settings for {selectedProvider?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {/* Name Field - Always Editable */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="provider-name" className="text-right">
                Name
              </Label>
              <Input
                id="provider-name"
                value={editForm.name}
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, name: e.target.value }))
                }
                className="col-span-3"
                placeholder="Provider name"
              />
            </div>

            {/* Description Field - Always Editable */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="provider-description" className="text-right">
                Description
              </Label>
              <Input
                id="provider-description"
                value={editForm.description}
                onChange={(e) =>
                  setEditForm((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                className="col-span-3"
                placeholder="Provider description"
              />
            </div>

            {/* API Key Field - With Edit Mode */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="api-key" className="text-right">
                API Key
              </Label>
              <div className="col-span-3 space-y-2">
                <div className="flex gap-2">
                  <Input
                    id="api-key"
                    type={showApiKey ? "text" : "password"}
                    value={
                      isEditingApiKey
                        ? editForm.apiKey
                        : showApiKey
                          ? decryptedApiKey
                          : maskApiKey(selectedProvider?.apiKey || "")
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
                        <Edit className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCancelEditApiKey}
                      className="px-3"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                {isEditingApiKey && (
                  <div className="text-sm text-muted-foreground bg-blue-50 p-3 rounded-md">
                    <strong>Security Note:</strong> API keys are encrypted
                    before storage. This will replace your current API key.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button onClick={handleSave} disabled={!hasChanges || isSaving}>
              {isSaving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the model "{deleteItem?.name}". This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
