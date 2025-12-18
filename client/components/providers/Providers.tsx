/**
 * Providers.tsx
 * Used to display the providers page with table-based filtering and card layout.
 */
"use client";
import { Edit, Plus, Sparkles, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import type {
  DeleteProviderIn,
  DeleteProviderOut,
  ProvidersListOut,
} from "@/app/(main)/system/providers/page";
import { DataTableFacetedFilter } from "@/components/common/table/DataTableFacetedFilter";
import { DataTablePagination } from "@/components/common/table/DataTablePagination";
import { Input } from "@/components/ui/input";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export interface ProvidersProps {
  // Server-provided data (for server-side rendering)
  listData: ProvidersListOut;
  // Server actions (replaces useMutation)
  deleteProviderAction?: (
    input: DeleteProviderIn,
  ) => Promise<DeleteProviderOut>;
}

export default function Providers({
  listData: serverListData,
  deleteProviderAction,
}: ProvidersProps) {
  const router = useRouter();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteItem, setDeleteItem] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Table state
  const [rowSelection, setRowSelection] = useState({});
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = useState<SortingState>([
    { id: "updated_at", desc: true },
  ]);

  // Use server-provided data directly
  const providersData = serverListData;
  const isLoading = false; // No loading when using server data

  // Extract data from response
  const providers = useMemo(
    () => providersData?.providers || [],
    [providersData?.providers],
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
    [providersData?.provider_options],
  );
  const statusOptions = useMemo(
    () =>
      (providersData?.status_options || [])
        .map((opt) => ({
          value: opt["value"] as string,
          label: opt["label"] as string,
        }))
        .filter((opt) => opt.value && opt.label),
    [providersData?.status_options],
  );

  // Define table columns inline
  const columns: ColumnDef<(typeof providers)[number]>[] = useMemo(
    () => [
      {
        accessorKey: "name",
        header: "Name",
      },
      {
        accessorKey: "description",
        header: "Description",
      },
      {
        accessorKey: "value",
        header: "Value",
      },
      {
        accessorKey: "base_url",
        header: "Base URL",
      },
      // Hidden faceting column for Status
      {
        id: "status",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: (typeof providers)[number]) =>
          row.active ? "true" : "false",
        filterFn: (row, _id, value: string[]) => {
          const rowStatus = row.getValue("status") as string;
          if (value.length === 0) return true;
          return value.includes(rowStatus);
        },
      },
      // Hidden faceting column for Provider
      {
        id: "provider",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: (typeof providers)[number]) => row.value,
        filterFn: (row, _id, value: string[]) => {
          const rowProvider = row.getValue("provider") as string;
          if (value.length === 0) return true;
          return value.includes(rowProvider);
        },
      },
      {
        accessorKey: "updated_at",
        header: "Updated",
        cell: ({ row }) => {
          const date = new Date(row.original.updated_at);
          return (
            <div className="text-sm text-muted-foreground">
              {date.toLocaleDateString()}
            </div>
          );
        },
      },
    ],
    [],
  );

  // Create table instance
  const table = useReactTable({
    data: providers,
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

  // Memoize table rows to avoid calling getRowModel() multiple times and prevent re-render issues
  // Extract pagination primitives directly to avoid object reference issues
  const pageIndex = table.getState().pagination.pageIndex;
  const pageSize = table.getState().pagination.pageSize;
  // Stringify arrays for stable comparison (arrays are compared by reference)
  const sortingKey = JSON.stringify(sorting);
  const columnFiltersKey = JSON.stringify(columnFilters);
  const tableRows = useMemo(() => {
    return table.getRowModel().rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    // Use JSON.stringify for arrays to ensure stable comparison (arrays are compared by reference)
    sortingKey,
    columnFiltersKey,
    providers.length,
    // Use pagination primitives directly (not object references)
    pageIndex,
    pageSize,
  ]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Header skeleton */}
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>

        {/* Toolbar skeleton */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <div className="flex flex-col md:flex-row md:flex-1 md:items-center md:space-x-2 gap-2 md:gap-0">
            <Skeleton className="h-8 w-full md:w-[150px] lg:w-[250px]" />
            <div className="flex items-center space-x-2">
              <Skeleton className="h-8 w-[100px]" />
              <Skeleton className="h-8 w-[120px]" />
            </div>
          </div>
        </div>

        {/* Providers grid skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                  <div className="flex space-x-2">
                    <Skeleton className="h-8 w-8 rounded" />
                    <Skeleton className="h-8 w-8 rounded" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-3/4" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const handleDelete = async () => {
    if (!deleteItem || !deleteProviderAction) return;

    setIsDeleting(true);
    try {
      await deleteProviderAction({
        body: {
          providerId: deleteItem.id,
        },
      });
      // profileId comes from X-Profile-Id header automatically
      toast.success("Provider deleted successfully");
      router.refresh();
    } catch {
      toast.error("Failed to delete provider");
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
    router.push(`/system/providers/p/${id}`);
  };

  const handleCreateNew = () => {
    router.push("/system/providers/new");
  };

  const renderProviderCard = (provider: (typeof providers)[number]) => (
    <Card
      key={provider.provider_id}
      aria-label={provider.name}
      data-testid="provider-card"
      data-provider-id={provider.provider_id}
      className="relative flex flex-col h-full"
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg">{provider.name}</CardTitle>
            <div className="mt-1 space-y-2">
              <div className="flex items-center gap-2">
                {!provider.active && (
                  <Badge variant="secondary">Inactive</Badge>
                )}
                <Badge variant="outline">{provider.value}</Badge>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {provider.can_edit && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleEdit(provider.provider_id)}
                aria-label={`Edit ${provider.name}`}
                data-testid={`btn-edit-provider-${provider.provider_id}`}
              >
                <Edit className="h-4 w-4" />
              </Button>
            )}
            {provider.can_delete && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() =>
                  handleDeleteClick(provider.provider_id, provider.name)
                }
                aria-label={`Delete ${provider.name}`}
                data-testid={`btn-delete-provider-${provider.provider_id}`}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 flex-1 flex flex-col">
        <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
          {provider.description || "No description"}
        </p>
        {provider.base_url && (
          <p className="text-xs text-muted-foreground mt-auto">
            <span className="font-medium">Base URL:</span> {provider.base_url}
          </p>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6" data-page="providers-index">
      {/* Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        <div className="flex flex-col md:flex-row md:flex-1 md:items-center md:space-x-2 gap-2 md:gap-0">
          <Input
            placeholder="Search providers..."
            value={(table.getColumn("name")?.getFilterValue() as string) ?? ""}
            onChange={(event) =>
              table.getColumn("name")?.setFilterValue(event.target.value)
            }
            className="h-8 w-full md:w-[150px] lg:w-[250px]"
            data-testid="input-search-providers"
          />
          {providerOptions.length > 0 && table.getColumn("provider") && (
            <DataTableFacetedFilter
              column={table.getColumn("provider")!}
              title="Provider"
              options={providerOptions}
            />
          )}
          {statusOptions.length > 0 && table.getColumn("status") && (
            <DataTableFacetedFilter
              column={table.getColumn("status")!}
              title="Status"
              options={statusOptions}
            />
          )}
          {table.getState().columnFilters.length > 0 && (
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

      {/* Providers Grid */}
      {tableRows.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Sparkles className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No providers found</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {table.getState().columnFilters.length > 0
                ? "Try adjusting your filters"
                : "Get started by creating a new provider"}
            </p>
            {table.getState().columnFilters.length === 0 && (
              <Button onClick={handleCreateNew} variant="outline">
                <Plus className="mr-2 h-4 w-4" />
                Create Provider
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tableRows.map((row) => renderProviderCard(row.original))}
          </div>
          <DataTablePagination table={table} />
        </>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Provider</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteItem?.name}"? This action
              cannot be undone.
              {deleteItem && (
                <span className="block mt-2 text-destructive font-medium">
                  Warning: This provider may be in use by models. Deletion will
                  fail if any models are using it.
                </span>
              )}
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
