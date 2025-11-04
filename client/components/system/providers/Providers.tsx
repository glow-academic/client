/**
 * Providers.tsx
 * Used to display the models page with all created models and management functionality.
 * @AshokSaravanan222 & @siladiea
 * 06/18/2025
 */
"use client";
import {
  Copy,
  Cpu,
  Edit,
  Loader2,
  Plus,
  Settings,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
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
import { ColumnDef } from "@tanstack/react-table";

import { useProfile } from "@/contexts/profile-context";

import { api } from "@/lib/api/client";
import {
  useDeleteModel,
  useDeleteProvider,
  useDuplicateModel,
  useDuplicateProvider,
} from "@/lib/api/v2/hooks/providers";
import type {
  ModelItem,
  ProviderWithModels,
} from "@/lib/api/v2/schemas/providers";
import { keys } from "@/lib/query/keys";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ProvidersDataTable } from "./ProvidersDataTable";

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
  const { effectiveProfile } = useProfile();
  const queryClient = useQueryClient();

  // V3 API: Single fetch with hierarchical data and permissions
  // Note: Providers are global (not department-specific)
  const filters = useMemo(
    () => ({
      profileId: effectiveProfile?.id || "",
    }),
    [effectiveProfile?.id]
  );

  const { data: providersData, isLoading } = useQuery({
    queryKey: keys.providers.list(filters),
    queryFn: () => api.post("/providers/list", { body: filters }),
    enabled: !!effectiveProfile?.id,
  });

  // Mutation hooks - using v2 hooks temporarily until v3 endpoints are available
  // Note: Provider/model mutation endpoints not yet available in v3 API
  const deleteModelMutation = useDeleteModel();
  const deleteProviderMutation = useDeleteProvider();
  const duplicateProviderMutation = useDuplicateProvider();
  const duplicateModelMutation = useDuplicateModel();

  // Invalidate queries after mutations
  const invalidateProviders = () => {
    queryClient.invalidateQueries({ queryKey: keys.providers.all });
  };
  const providers = useMemo(
    () => providersData?.providers || [],
    [providersData]
  );

  // Build filter options
  const providerOptions = useMemo(
    () => providers.map((p) => ({ value: p.provider_id, label: p.name })),
    [providers]
  );

  const customModelOptions = [
    { value: "true", label: "Custom Models" },
    { value: "false", label: "Standard Models" },
  ];

  const statusOptions = [
    { value: "true", label: "Active" },
    { value: "false", label: "Inactive" },
  ];

  // Column definitions for TanStack Table (flattened model rows)
  type ProviderModelRow = {
    model_id: string;
    name: string;
    description: string;
    active: boolean;
    custom_model: boolean;
    updated_at: string;
    can_edit: boolean;
    can_delete: boolean;
    provider_id: string;
    provider_name: string;
    provider_description: string;
    provider_can_edit: boolean;
    provider_can_delete: boolean;
  };

  const columns = useMemo<ColumnDef<ProviderModelRow>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => row.getValue("name"),
        filterFn: (row, id, value) => {
          const name = String(row.getValue(id)).toLowerCase();
          const desc = String(row.original.description).toLowerCase();
          const query = String(value).toLowerCase();
          return name.includes(query) || desc.includes(query);
        },
      },
      // Hidden faceting column for Provider
      {
        id: "provider_id",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: ProviderModelRow) => row.provider_id,
        filterFn: (row, _id, value: string[]) => {
          const providerId = String(row.getValue("provider_id"));
          return value.includes(providerId);
        },
      },
      // Hidden faceting column for Custom Model
      {
        id: "custom_model",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: ProviderModelRow) =>
          row.custom_model ? "true" : "false",
        filterFn: (row, _id, value: string[]) => {
          const isCustom = String(row.getValue("custom_model"));
          return value.includes(isCustom);
        },
      },
      // Hidden faceting column for Active Status
      {
        id: "active",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: ProviderModelRow) => (row.active ? "true" : "false"),
        filterFn: (row, _id, value: string[]) => {
          const status = String(row.getValue("active"));
          return value.includes(status);
        },
      },
    ],
    []
  );

  const handleDelete = async () => {
    if (!deleteItem) return;

    setIsDeleting(true);
    try {
      await deleteModelMutation.mutateAsync({ modelId: deleteItem.id });
      invalidateProviders();
      toast.success("Model deleted successfully");
    } catch {
      toast.error("Failed to delete model");
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
      setDeleteItem(null);
    }
  };

  const handleDeleteClick = (model: ModelItem) => {
    if (!model.can_delete) {
      toast.error("Cannot delete model: It is currently in use");
      return;
    }
    setDeleteItem({ id: model.model_id, name: model.name });
    setShowDeleteDialog(true);
  };

  const handleDeleteProviderClick = (provider: ProviderWithModels) => {
    if (!provider.can_delete) {
      toast.error("Cannot delete provider: Some models are in use");
      return;
    }
    setDeleteProviderItem({ id: provider.provider_id, name: provider.name });
    setShowDeleteProviderDialog(true);
  };

  const handleDeleteProvider = async () => {
    if (!deleteProviderItem) return;

    setIsDeletingProvider(true);
    try {
      await deleteProviderMutation.mutateAsync({
        providerId: deleteProviderItem.id,
      });
      invalidateProviders();
      toast.success("Provider deleted successfully");
    } catch {
      toast.error("Failed to delete provider");
    } finally {
      setIsDeletingProvider(false);
      setShowDeleteProviderDialog(false);
      setDeleteProviderItem(null);
    }
  };

  const handleDuplicateProviderClick = async (provider: ProviderWithModels) => {
    try {
      await duplicateProviderMutation.mutateAsync({
        providerId: provider.provider_id,
      });
      invalidateProviders();
      toast.success(`Provider '${provider.name}' duplicated successfully`);
    } catch {
      toast.error("Failed to duplicate provider");
    }
  };

  const handleDuplicateModelClick = async (model: ModelItem) => {
    try {
      await duplicateModelMutation.mutateAsync({
        modelId: model.model_id,
      });
      invalidateProviders();
      toast.success(`Model '${model.name}' duplicated successfully`);
    } catch {
      toast.error("Failed to duplicate model");
    }
  };

  const handleEdit = (model: ModelItem, provider: ProviderWithModels) => {
    router.push(
      `/system/providers/p/${provider.provider_id}/m/${model.model_id}`
    );
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

  const renderProviderGroup = (provider: ProviderWithModels) => (
    <div key={provider.provider_id} className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="text-sm px-3 py-1">
            {provider.name}
          </Badge>
          <span className="text-sm text-muted-foreground">
            {provider.description}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {provider.can_edit && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() =>
                    router.push(`/system/providers/p/${provider.provider_id}`)
                  }
                >
                  <Settings className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Provider Settings</p>
              </TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDuplicateProviderClick(provider)}
                disabled={duplicateProviderMutation.isPending}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Duplicate Provider</p>
            </TooltipContent>
          </Tooltip>
          {provider.can_delete && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDeleteProviderClick(provider)}
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
        {provider.models
          .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
          .map((model) => (
            <Card
              key={model.model_id}
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
                    {model.custom_model && (
                      <Badge variant="default">Custom</Badge>
                    )}
                    {!model.active && (
                      <Badge variant="secondary">Inactive</Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardFooter className="mt-auto flex justify-end gap-2">
                {model.can_edit && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(model, provider)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDuplicateModelClick(model)}
                  disabled={duplicateModelMutation.isPending}
                >
                  <Copy className="h-4 w-4" />
                </Button>
                {model.can_delete && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteClick(model)}
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
            router.push(`/system/providers/p/${provider.provider_id}/new`)
          }
        >
          <CardContent className="flex flex-col items-center justify-center py-12 grow">
            <Plus className="h-8 w-8 text-muted-foreground mb-3" />
            <h3 className="text-sm font-medium text-muted-foreground mb-1">
              Create New Model
            </h3>
            <p className="text-xs text-muted-foreground text-center">
              Add a new model to {provider.name}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : providers.length === 0 ? (
          renderEmptyState()
        ) : (
          <ProvidersDataTable
            columns={columns}
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
