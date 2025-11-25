/**
 * Models.tsx
 * Used to display the models page with all created models and management functionality.
 * @AshokSaravanan222 & @siladiea
 * 06/18/2025
 */
"use client";
import { Copy, Cpu, Edit, Sparkles, Trash2, X } from "lucide-react";
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
import { TooltipProvider } from "@/components/ui/tooltip";
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
  DuplicateModelIn,
  DuplicateModelOut,
  ModelsListOut,
} from "@/app/(main)/engine/models/page";
import { DataTableFacetedFilter } from "@/components/common/table/DataTableFacetedFilter";
import { DataTablePagination } from "@/components/common/table/DataTablePagination";
import { Input } from "@/components/ui/input";

export interface ModelsProps {
  // Server-provided data (for server-side rendering)
  listData: ModelsListOut;
  // Server actions (replaces useMutation)
  duplicateModelAction?: (
    input: DuplicateModelIn
  ) => Promise<DuplicateModelOut>;
  deleteModelAction?: (input: DeleteModelIn) => Promise<DeleteModelOut>;
}

export default function Models({
  listData: serverListData,
  duplicateModelAction,
  deleteModelAction,
}: ModelsProps) {
  const router = useRouter();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteItem, setDeleteItem] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState<string | null>(null);

  // Use server-provided data directly
  const modelsData = serverListData;

  // Use server-provided data directly
  const models = useMemo(() => modelsData?.models || [], [modelsData?.models]);

  // Use server-provided facet options directly (no client-side computation)
  const providerOptions = useMemo(
    () =>
      (modelsData?.provider_options || [])
        .map((opt) => ({
          value: opt["value"] as string,
          label: opt["label"] as string,
        }))
        .filter((opt) => opt.value && opt.label),
    [modelsData?.provider_options]
  );
  const statusOptions = useMemo(
    () =>
      (modelsData?.status_options || [])
        .map((opt) => ({
          value: opt["value"] as string,
          label: opt["label"] as string,
        }))
        .filter((opt) => opt.value && opt.label),
    [modelsData?.status_options]
  );

  // Table state
  const [rowSelection, setRowSelection] = useState({});
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = useState<SortingState>([
    { id: "updated_at", desc: true },
  ]);

  const columns = useMemo<ColumnDef<(typeof models)[number]>[]>(
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
        id: "provider",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row) => row.provider,
        filterFn: (row, _id, value: string[]) => {
          const provider = String(row.getValue("provider"));
          return value.includes(provider);
        },
      },
      // Hidden faceting column for Custom Model (based on base_url presence)
      {
        id: "is_custom",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row) =>
          row.base_url && row.base_url !== "" ? "true" : "false",
        filterFn: (row, _id, value: string[]) => {
          const isCustom = String(row.getValue("is_custom"));
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
        accessorFn: (row) => (row.active ? "true" : "false"),
        filterFn: (row, _id, value: string[]) => {
          const status = String(row.getValue("active"));
          return value.includes(status);
        },
      },
    ],
    []
  );

  // Create table instance
  const table = useReactTable({
    data: models,
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

  // Get filtered rows for rendering
  const tableRows = table.getRowModel().rows;

  // Get column references for toolbar
  const nameColumn = table.getColumn("name");
  const providerColumn = table.getColumn("provider");
  const customModelColumn = table.getColumn("is_custom");
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

  const handleDeleteClick = (model: (typeof models)[number]) => {
    if (!model.can_delete) {
      toast.error("Cannot delete model: It is currently in use");
      return;
    }
    setDeleteItem({ id: model.model_id, name: model.name });
    setShowDeleteDialog(true);
  };

  const handleDuplicateModelClick = async (model: (typeof models)[number]) => {
    if (!duplicateModelAction) return;

    setIsDuplicating(model.model_id);
    try {
      await duplicateModelAction({ body: { modelId: model.model_id } });
      toast.success(`Model '${model.name}' duplicated successfully`);
      router.refresh();
    } catch {
      toast.error("Failed to duplicate model");
    } finally {
      setIsDuplicating(null);
    }
  };

  const handleEdit = (modelId: string) => {
    router.push(`/engine/models/${modelId}`);
  };

  const renderModelCard = (model: (typeof models)[number]) => (
    <Card
      key={model.model_id}
      className="hover:shadow-md transition-shadow flex flex-col h-full min-h-[220px]"
      data-testid="model-card"
      data-model-id={model.model_id}
      role="gridcell"
      aria-label={`model card ${model.name || "Unnamed Model"}`}
    >
      <CardHeader className="flex-0">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2">
          <div className="space-y-1 flex-1 min-w-0">
            <CardTitle className="text-base flex items-center gap-2">
              <Cpu className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">{model.name}</span>
            </CardTitle>
            <CardDescription className="text-xs line-clamp-2">
              {model.description}
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-1 flex-shrink-0">
            {model.base_url && model.base_url !== "" && (
              <Badge variant="default">Custom</Badge>
            )}
            {!model.active && <Badge variant="secondary">Inactive</Badge>}
          </div>
        </div>
        <div className="mt-2">
          <Badge variant="outline" className="text-xs">
            {model.provider === "openai"
              ? "OpenAI"
              : model.provider === "gemini"
                ? "Gemini"
                : "Custom"}
          </Badge>
        </div>
      </CardHeader>
      <CardFooter className="mt-auto flex flex-wrap justify-end gap-2">
        {model.can_edit && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleEdit(model.model_id)}
            aria-label={`Edit model ${model.name}`}
            data-testid="btn-edit-model"
            title={`Edit model ${model.name}`}
            className="h-9 px-3"
          >
            <Edit className="h-4 w-4 md:mr-0 mr-2" />
            <span className="md:hidden">Edit</span>
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleDuplicateModelClick(model)}
          disabled={isDuplicating === model.model_id}
          aria-label={`Duplicate model ${model.name}`}
          data-testid="btn-duplicate-model"
          title={`Duplicate model ${model.name}`}
          className="h-9 px-3"
        >
          {isDuplicating === model.model_id ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : (
            <>
              <Copy className="h-4 w-4 md:mr-0 mr-2" />
              <span className="md:hidden">Duplicate</span>
            </>
          )}
        </Button>
        {model.can_delete && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleDeleteClick(model)}
            aria-label={`Delete model ${model.name}`}
            data-testid="btn-delete-model"
            title={`Delete model ${model.name}`}
            className="h-9 px-3"
          >
            <Trash2 className="h-4 w-4 md:mr-0 mr-2" />
            <span className="md:hidden">Delete</span>
          </Button>
        )}
      </CardFooter>
    </Card>
  );

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

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {models.length === 0 ? (
          renderEmptyState()
        ) : (
          <div className="space-y-4">
            {/* Toolbar */}
            <div
              className="flex flex-col md:flex-row md:items-center md:justify-between gap-2"
              data-testid="models-toolbar"
            >
              <div className="flex flex-col md:flex-row md:flex-1 md:items-center md:space-x-2 gap-2 md:gap-0">
                <div className="w-full md:w-auto">
                  <Input
                    data-testid="models-search"
                    placeholder="Search models..."
                    value={(nameColumn?.getFilterValue() as string) ?? ""}
                    onChange={(event) =>
                      nameColumn?.setFilterValue(event.target.value)
                    }
                    className="h-8 w-full md:w-[150px] lg:w-[250px]"
                    aria-label="Search models by name"
                    aria-controls="models-grid"
                  />
                </div>

                <div className="flex items-center space-x-2 flex-wrap">
                  {providerColumn && providerOptions.length > 0 && (
                    <DataTableFacetedFilter
                      column={providerColumn}
                      title="Provider"
                      options={providerOptions}
                    />
                  )}

                  {customModelColumn && (
                    <DataTableFacetedFilter
                      column={customModelColumn}
                      title="Type"
                      options={[
                        { value: "true", label: "Custom Models" },
                        { value: "false", label: "Standard Models" },
                      ]}
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
                      className="h-8 px-2 lg:px-3 hidden md:flex"
                    >
                      Reset
                      <X className="ml-2 h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Cards Grid */}
            <div
              className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
              role="grid"
              aria-label="models grid"
              data-testid="models-grid"
            >
              {tableRows.length ? (
                tableRows.map((row) => renderModelCard(row.original))
              ) : (
                <div className="col-span-full text-center py-8 text-muted-foreground">
                  No models match the current filters.
                </div>
              )}
            </div>

            {/* Pagination */}
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
                variant="destructive"
                data-testid="btn-confirm-delete"
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
}
