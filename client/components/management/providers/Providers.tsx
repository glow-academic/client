/**
 * Providers.tsx
 * Used to display the models page with all created models and management functionality.
 * @AshokSaravanan222 & @siladiea
 * 06/18/2025
 */
"use client";
import { log } from "@/utils/logger";
import { Cpu, Edit, Plus, Settings, Sparkles, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { useProviderColumns } from "@/hooks/use-provider-columns";
import { useAgents } from "@/lib/api/hooks/agents";
import { useDeleteModel, useModels } from "@/lib/api/hooks/models";
import { usePersonas } from "@/lib/api/hooks/personas";
import { useDeleteProvider, useProviders } from "@/lib/api/hooks/providers";
import { Model, Provider } from "@/types";
import { ProvidersDataTable } from "./ProvidersDataTable";

interface ProviderGroup {
  provider: Provider;
  models: Model[];
}

export default function Providers() {
  const router = useRouter();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteItem, setDeleteItem] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteProviderDialog, setShowDeleteProviderDialog] =
    useState(false);
  const [deleteProviderItem, setDeleteProviderItem] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [isDeletingProvider, setIsDeletingProvider] = useState(false);

  // Mutation hooks
  const deleteModelMutation = useDeleteModel();
  const deleteProviderMutation = useDeleteProvider();

  const { data: models = [] } = useModels();
  const { data: providers = [] } = useProviders();
  const { data: personas = [] } = usePersonas();
  const { data: agents = [] } = useAgents();

  // Get filter options
  const { columns, providerOptions, customModelOptions, statusOptions } =
    useProviderColumns();

  const handleDelete = async () => {
    if (!deleteItem) return;

    setIsDeleting(true);
    try {
      await deleteModelMutation.mutateAsync(deleteItem.id);

      toast.success("Model deleted successfully");
    } catch (error) {
      log.error("provider.model.delete.failed", {
        message: "Error deleting model",
        error,
        context: {
          component: "Providers",
          function: "handleDelete",
          modelId: deleteItem.id,
        },
      });
      toast.error("Failed to delete model");
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
      setDeleteItem(null);
    }
  };

  const handleDeleteClick = (id: string, name: string) => {
    const model = models.find((m) => m.id === id);
    if (model && !canDeleteModel(model)) {
      toast.error(
        "Cannot delete model: It is currently in use by personas or agents"
      );
      return;
    }
    setDeleteItem({ id, name });
    setShowDeleteDialog(true);
  };

  const handleDeleteProviderClick = (provider: Provider) => {
    if (!canDeleteProvider(provider)) {
      toast.error(
        "Cannot delete provider: Some models are currently in use by personas or agents"
      );
      return;
    }
    setDeleteProviderItem({ id: provider.id, name: provider.name });
    setShowDeleteProviderDialog(true);
  };

  const handleDeleteProvider = async () => {
    if (!deleteProviderItem) return;

    setIsDeletingProvider(true);
    try {
      await deleteProviderMutation.mutateAsync(deleteProviderItem.id);

      toast.success("Provider deleted successfully");
    } catch (error) {
      log.error("provider.delete.failed", {
        message: "Error deleting provider",
        error,
        context: {
          component: "Providers",
          function: "handleDeleteProvider",
          providerId: deleteProviderItem.id,
        },
      });
      toast.error("Failed to delete provider");
    } finally {
      setIsDeletingProvider(false);
      setShowDeleteProviderDialog(false);
      setDeleteProviderItem(null);
    }
  };

  // Check if a model is being used by any personas or agents
  const isModelInUse = (modelId: string) => {
    const usedByPersonas = personas.some(
      (persona) => persona.modelId === modelId
    );
    const usedByAgents = agents.some((agent) => agent.modelId === modelId);

    return usedByPersonas || usedByAgents;
  };

  const canDeleteModel = (model: Model) => {
    // Don't allow deletion if model is in use
    if (isModelInUse(model.id)) return false;
    return true;
  };

  const canDeleteProvider = (provider: Provider) => {
    // Get all models for this provider
    const providerModels = models.filter(
      (model) => model.providerId === provider.id
    );

    // Check if any of the provider's models are in use
    const hasModelsInUse = providerModels.some((model) =>
      isModelInUse(model.id)
    );

    // Can only delete if no models are in use
    return !hasModelsInUse;
  };

  const handleEdit = (modelId: string) => {
    // Find the model to get its provider ID
    const model = models.find((m) => m.id === modelId);
    if (model) {
      router.push(`/management/providers/p/${model.providerId}/m/${modelId}`);
    } else {
      // Fallback if model not found
      router.push(`/management/providers/p/${modelId}/m/${modelId}`);
    }
  };

  const renderEmptyState = () => (
    <div className="col-span-full">
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Sparkles className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No models yet</h3>
          <p className="text-muted-foreground text-center mb-4">
            Create your first model to get started
          </p>
        </CardContent>
      </Card>
    </div>
  );

  const renderProviderGroup = (providerGroup: ProviderGroup) => (
    <div key={providerGroup.provider.id} className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="text-sm px-3 py-1">
            {providerGroup.provider.name}
          </Badge>
          <span className="text-sm text-muted-foreground">
            {providerGroup.provider.description}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="default"
                size="sm"
                onClick={() =>
                  router.push(
                    `/management/providers/p/${providerGroup.provider.id}`
                  )
                }
              >
                <Settings className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Provider Settings</p>
            </TooltipContent>
          </Tooltip>
          {canDeleteProvider(providerGroup.provider) && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    handleDeleteProviderClick(providerGroup.provider)
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Delete Provider</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 items-stretch">
        {providerGroup.models
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
          .map((model: Model) => (
            <Card
              key={model.id}
              className="hover:shadow-md transition-shadow flex flex-col h-full min-h-[220px]"
            >
              <CardHeader className="flex-0">
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
                  <div className="flex gap-1">
                    {model.customModel && (
                      <Badge variant="default">Custom</Badge>
                    )}
                    {!model.active && (
                      <Badge variant="secondary">Inactive</Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardFooter className="mt-auto flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEdit(model.id)}
                >
                  <Edit className="h-4 w-4" />
                </Button>
                {canDeleteModel(model) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteClick(model.id, model.name)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </CardFooter>
            </Card>
          ))}

        {/* Create New Model Card for this provider */}
        <Card
          className="border-dashed border-2 hover:border-dashed hover:border-primary/50 transition-colors cursor-pointer flex flex-col h-full min-h-[220px]"
          onClick={() =>
            router.push(
              `/management/providers/p/${providerGroup.provider.id}/new`
            )
          }
        >
          <CardContent className="flex flex-col items-center justify-center py-12 grow">
            <Plus className="h-8 w-8 text-muted-foreground mb-3" />
            <h3 className="text-sm font-medium text-muted-foreground mb-1">
              Create New Model
            </h3>
            <p className="text-xs text-muted-foreground text-center">
              Add a new model to {providerGroup.provider.name}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {models.length === 0 ? (
          renderEmptyState()
        ) : (
          <ProvidersDataTable
            columns={columns}
            data={models}
            providers={providers}
            providerOptions={providerOptions}
            customModelOptions={customModelOptions}
            statusOptions={statusOptions}
            renderProviderGroup={renderProviderGroup}
          />
        )}

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete the model "{deleteItem?.name}".
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel
                disabled={isDeleting || deleteModelMutation.isPending}
              >
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={isDeleting || deleteModelMutation.isPending}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isDeleting || deleteModelMutation.isPending
                  ? "Deleting..."
                  : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete Provider Confirmation Dialog */}
        <AlertDialog
          open={showDeleteProviderDialog}
          onOpenChange={setShowDeleteProviderDialog}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Provider</AlertDialogTitle>
              <AlertDialogDescription>
                <p>
                  Are you sure you want to delete the provider "
                  {deleteProviderItem?.name}"? This will also delete all
                  associated models. This action cannot be undone.
                </p>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel
                disabled={
                  isDeletingProvider || deleteProviderMutation.isPending
                }
              >
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteProvider}
                disabled={
                  isDeletingProvider || deleteProviderMutation.isPending
                }
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isDeletingProvider || deleteProviderMutation.isPending
                  ? "Deleting..."
                  : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
}
