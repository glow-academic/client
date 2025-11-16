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
  Plus,
  Settings,
  Sparkles,
  Trash2,
  X,
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
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";

import type {
  DeleteModelIn,
  DeleteModelOut,
  DeleteProviderIn,
  DeleteProviderOut,
  DuplicateModelIn,
  DuplicateModelOut,
  DuplicateProviderIn,
  DuplicateProviderOut,
  ProvidersListOut,
} from "@/app/(main)/system/providers/page";
import { DataTableFacetedFilter } from "@/components/common/table/DataTableFacetedFilter";
import { DataTablePagination } from "@/components/common/table/DataTablePagination";
import { Input } from "@/components/ui/input";

type ModelItem = {
  model_id: string;
  name: string;
  description: string;
  active: boolean;
  custom_model: boolean;
  updated_at: string;
  can_edit: boolean;
  can_delete: boolean;
};

type ProviderWithModels = {
  provider_id: string;
  name: string;
  description: string;
  can_edit: boolean;
  can_delete: boolean;
  models: ModelItem[];
};

export interface ProvidersProps {
  // Server-provided data (for server-side rendering)
  listData: ProvidersListOut;
  // Server actions (replaces useMutation)
  duplicateProviderAction?: (
    input: DuplicateProviderIn,
  ) => Promise<DuplicateProviderOut>;
  deleteProviderAction?: (
    input: DeleteProviderIn,
  ) => Promise<DeleteProviderOut>;
  duplicateModelAction?: (
    input: DuplicateModelIn,
  ) => Promise<DuplicateModelOut>;
  deleteModelAction?: (input: DeleteModelIn) => Promise<DeleteModelOut>;
}

export default function Providers({
  listData: serverListData,
  duplicateProviderAction,
  deleteProviderAction,
  duplicateModelAction,
  deleteModelAction,
}: ProvidersProps) {
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
  // Use server-provided data directly
  const providersData = serverListData;

  // Use server-provided data directly
  const providers = useMemo(
    () => providersData?.providers || [],
    [providersData],
  );

  // Use server-provided facet options directly (no client-side computation)
  const providerOptions = useMemo(
    () =>
      (providersData?.provider_options || [])
        .map((opt) => ({
          value: opt["value"] as string,
          label: opt["label"] as string,
        }))
        .filter((opt) => opt.value && opt.label),
    [providersData?.provider_options]
  );
  const customModelOptions = useMemo(
    () =>
      (providersData?.custom_model_options || [])
        .map((opt) => ({
          value: opt["value"] as string,
          label: opt["label"] as string,
        }))
        .filter((opt) => opt.value && opt.label),
    [providersData?.custom_model_options]
  );
  const statusOptions = useMemo(
    () =>
      (providersData?.status_options || [])
        .map((opt) => ({
          value: opt["value"] as string,
          label: opt["label"] as string,
        }))
        .filter((opt) => opt.value && opt.label),
    [providersData?.status_options]
  );

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

  // Flatten providers/models into rows for table filtering
  const rows = useMemo<ProviderModelRow[]>(() => {
    const flattened: ProviderModelRow[] = [];
    providers.forEach((provider) => {
      provider.models.forEach((model) => {
        flattened.push({
          ...model,
          provider_id: provider.provider_id,
          provider_name: provider.name,
          provider_description: provider.description,
          provider_can_edit: provider.can_edit,
          provider_can_delete: provider.can_delete,
        });
      });
      // Also add a row for providers with 0 models (for filtering)
      if (provider.models.length === 0) {
        flattened.push({
          model_id: `${provider.provider_id}-empty`,
          name: "",
          description: "",
          active: false,
          custom_model: false,
          updated_at: "",
          can_edit: false,
          can_delete: false,
          provider_id: provider.provider_id,
          provider_name: provider.name,
          provider_description: provider.description,
          provider_can_edit: provider.can_edit,
          provider_can_delete: provider.can_delete,
        });
      }
    });
    return flattened;
  }, [providers]);

  // Table state
  const [rowSelection, setRowSelection] = useState({});
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = useState<SortingState>([
    { id: "provider_name", desc: false },
    { id: "name", desc: false },
  ]);

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
    [],
  );

  // Create table instance
  const table = useReactTable({
    data: rows,
    columns,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
      columnFilters,
    },
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    initialState: {
      pagination: {
        pageSize: 12,
      },
    },
  });

  // Group filtered rows back by provider for rendering
  const filteredProviders = useMemo(() => {
    const providerMap = new Map<string, ProviderWithModels>();
    const selectedProviderIds =
      (table.getColumn("provider_id")?.getFilterValue() as string[]) || [];

    // Get all filtered model IDs
    const filteredModelIds = new Set<string>();
    table.getRowModel().rows.forEach((row) => {
      const modelId = row.original.model_id;
      // Only include actual models, not empty provider placeholders
      if (!modelId.endsWith("-empty")) {
        filteredModelIds.add(modelId);
      }
    });

    // Process each provider
    providers.forEach((provider) => {
      // Filter models for this provider based on filtered rows
      const filteredModels = provider.models.filter((model) =>
        filteredModelIds.has(model.model_id),
      );

      // Include provider if:
      // 1. It has filtered models, OR
      // 2. It was explicitly selected (even if 0 models)
      const isSelected = selectedProviderIds.includes(provider.provider_id);
      const hasFilteredModels = filteredModels.length > 0;

      // If provider filter is active, only show if selected
      // If provider filter is not active, show if has filtered models
      if (selectedProviderIds.length > 0) {
        if (isSelected) {
          providerMap.set(provider.provider_id, {
            ...provider,
            models: filteredModels,
          });
        }
      } else if (hasFilteredModels || filteredModelIds.size === 0) {
        // If no filters applied or provider has models, include it
        providerMap.set(provider.provider_id, {
          ...provider,
          models: filteredModels,
        });
      }
    });

    return Array.from(providerMap.values());
  }, [table, providers]);

  // Get column references for toolbar
  const nameColumn = table.getColumn("name");
  const providerColumn = table.getColumn("provider_id");
  const customModelColumn = table.getColumn("custom_model");
  const activeColumn = table.getColumn("active");
  const isFiltered = table.getState().columnFilters.length > 0;

  const handleDelete = async () => {
    if (!deleteItem || !deleteModelAction) return;

    setIsDeleting(true);
    try {
      await deleteModelAction({ body: { modelId: deleteItem.id } });
      toast.success("Model deleted successfully");
      router.refresh();
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
    if (!deleteProviderItem || !deleteProviderAction) return;

    setIsDeletingProvider(true);
    try {
      await deleteProviderAction({
        body: { providerId: deleteProviderItem.id },
      });
      toast.success("Provider deleted successfully");
      router.refresh();
    } catch {
      toast.error("Failed to delete provider");
    } finally {
      setIsDeletingProvider(false);
      setShowDeleteProviderDialog(false);
      setDeleteProviderItem(null);
    }
  };

  const handleDuplicateProviderClick = async (provider: ProviderWithModels) => {
    if (!duplicateProviderAction) return;

    try {
      await duplicateProviderAction({
        body: { providerId: provider.provider_id },
      });
      toast.success(`Provider '${provider.name}' duplicated successfully`);
      router.refresh();
    } catch {
      toast.error("Failed to duplicate provider");
    }
  };

  const handleDuplicateModelClick = async (model: ModelItem) => {
    if (!duplicateModelAction) return;

    try {
      await duplicateModelAction({ body: { modelId: model.model_id } });
      toast.success(`Model '${model.name}' duplicated successfully`);
      router.refresh();
    } catch {
      toast.error("Failed to duplicate model");
    }
  };

  const handleEdit = (model: ModelItem, provider: ProviderWithModels) => {
    router.push(
      `/system/providers/p/${provider.provider_id}/m/${model.model_id}`,
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
    <div
      key={provider.provider_id}
      className="space-y-4"
      data-testid="provider-card"
      data-provider-id={provider.provider_id}
    >
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
                  aria-label={`Edit provider ${provider.name}`}
                  data-testid="btn-edit-provider"
                  title={`Edit provider ${provider.name}`}
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
                disabled={false}
                aria-label={`Duplicate provider ${provider.name}`}
                data-testid="btn-duplicate-provider"
                title={`Duplicate provider ${provider.name}`}
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
                  aria-label={`Delete provider ${provider.name}`}
                  data-testid="btn-delete-provider"
                  title={`Delete provider ${provider.name}`}
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
              data-testid="model-card"
              data-model-id={model.model_id}
              data-provider-id={provider.provider_id}
              role="gridcell"
              aria-label={`model card ${model.name || "Unnamed Model"}`}
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
                    aria-label={`Edit model ${model.name}`}
                    data-testid="btn-edit-model"
                    title={`Edit model ${model.name}`}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDuplicateModelClick(model)}
                  disabled={false}
                  aria-label={`Duplicate model ${model.name}`}
                  data-testid="btn-duplicate-model"
                  title={`Duplicate model ${model.name}`}
                >
                  <Copy className="h-4 w-4" />
                </Button>
                {model.can_delete && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteClick(model)}
                    aria-label={`Delete model ${model.name}`}
                    data-testid="btn-delete-model"
                    title={`Delete model ${model.name}`}
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
        {providers.length === 0 ? (
          renderEmptyState()
        ) : (
          <div className="space-y-4">
            {/* Toolbar */}
            <div
              className="flex items-center justify-between"
              data-testid="providers-toolbar"
            >
              <div className="flex flex-1 items-center space-x-2 flex-wrap">
                <div className="mb-2">
                  <Input
                    data-testid="providers-search"
                    placeholder="Search models..."
                    value={(nameColumn?.getFilterValue() as string) ?? ""}
                    onChange={(event) =>
                      nameColumn?.setFilterValue(event.target.value)
                    }
                    className="h-8 w-[150px] lg:w-[250px]"
                    aria-label="Search models by name"
                    aria-controls="providers-grid"
                  />
                </div>

                <div className="flex items-center space-x-2 flex-wrap mb-2">
                  {providerColumn && providerOptions.length > 0 && (
                    <DataTableFacetedFilter
                      column={providerColumn}
                      title="Provider"
                      options={providerOptions}
                    />
                  )}

                  {customModelColumn && customModelOptions.length > 0 && (
                    <DataTableFacetedFilter
                      column={customModelColumn}
                      title="Type"
                      options={customModelOptions}
                    />
                  )}

                  {activeColumn && statusOptions.length > 0 && (
                    <DataTableFacetedFilter
                      column={activeColumn}
                      title="Status"
                      options={statusOptions}
                    />
                  )}

                  {isFiltered && (
                    <Button
                      variant="ghost"
                      onClick={() => table.resetColumnFilters()}
                      className="h-8 px-2 lg:px-3"
                    >
                      Reset
                      <X className="ml-2 h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Provider groups */}
            {filteredProviders.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No models match the current filters.
              </div>
            ) : (
              <div
                className="space-y-6"
                role="grid"
                aria-label="providers grid"
                data-testid="providers-grid"
              >
                {filteredProviders.map((provider) =>
                  renderProviderGroup(provider),
                )}
              </div>
            )}

            <DataTablePagination table={table} card={true} />
          </div>
        )}

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent
            aria-labelledby="delete-model-title"
            data-testid="dialog-delete-model"
          >
            <AlertDialogHeader>
              <AlertDialogTitle id="delete-model-title">
                Delete Model
              </AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete the model "{deleteItem?.name}
                "? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel
                disabled={isDeleting}
                data-testid="btn-cancel-delete"
              >
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={isDeleting}
                className="bg-red-600 hover:bg-red-700 text-white"
                data-testid="btn-confirm-delete"
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete Provider Confirmation Dialog */}
        <AlertDialog
          open={showDeleteProviderDialog}
          onOpenChange={setShowDeleteProviderDialog}
        >
          <AlertDialogContent
            aria-labelledby="delete-provider-title"
            data-testid="dialog-delete-provider"
          >
            <AlertDialogHeader>
              <AlertDialogTitle id="delete-provider-title">
                Delete Provider
              </AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete the provider "
                {deleteProviderItem?.name}"? This will also delete all
                associated models. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeletingProvider}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteProvider}
                disabled={isDeletingProvider}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {isDeletingProvider ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
}
