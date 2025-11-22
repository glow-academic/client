/**
 * Keys.tsx
 * Used to display the keys page with table-based filtering and card layout.
 */
"use client";
import { Edit, Eye, Key, Plus, Sparkles, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import type {
  DeleteKeyIn,
  DeleteKeyOut,
  KeysListOut,
} from "@/app/(main)/engine/keys/page";
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
import { useProfile } from "@/contexts/profile-context";

export interface KeysProps {
  // Server-provided data (for server-side rendering)
  listData: KeysListOut;
  // Server actions (replaces useMutation)
  deleteKeyAction?: (input: DeleteKeyIn) => Promise<DeleteKeyOut>;
}

export default function Keys({
  listData: serverListData,
  deleteKeyAction,
}: KeysProps) {
  const router = useRouter();
  const { effectiveProfile } = useProfile();
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
    { id: "created_at", desc: true },
  ]);

  // Use server-provided data directly
  const keysData = serverListData;
  const isLoading = false; // No loading when using server data

  // Extract data from response
  const keys = useMemo(() => keysData?.keys || [], [keysData?.keys]);

  // Use server-provided facet options directly (no client-side computation)
  const departmentOptions = useMemo(
    () =>
      (keysData?.department_options || [])
        .map((opt) => ({
          value: opt["value"] as string,
          label: opt["label"] as string,
        }))
        .filter((opt) => opt.value && opt.label),
    [keysData?.department_options]
  );
  const typeOptions = useMemo(
    () =>
      (keysData?.type_options || [])
        .map((opt) => ({
          value: opt["value"] as string,
          label: opt["label"] as string,
        }))
        .filter((opt) => opt.value && opt.label),
    [keysData?.type_options]
  );
  const modelOptions = useMemo(
    () =>
      (keysData?.model_options || [])
        .map((opt) => ({
          value: opt["value"] as string,
          label: opt["label"] as string,
        }))
        .filter((opt) => opt.value && opt.label),
    [keysData?.model_options]
  );

  // Define table columns inline
  const columns: ColumnDef<(typeof keys)[number]>[] = useMemo(
    () => [
      {
        accessorKey: "name",
        header: "Name",
      },
      {
        accessorKey: "type",
        header: "Type",
      },
      // Hidden faceting column for Departments (array of IDs)
      {
        id: "departments",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: (typeof keys)[number]) => row.department_ids ?? [],
        filterFn: (row, _id, value: string[]) => {
          const rowIds = (row.getValue("departments") as string[]) ?? [];
          if (value.length === 0) return true;
          if (rowIds.length === 0) return true;
          return value.some((v) => rowIds.includes(v));
        },
      },
      // Hidden faceting column for Models (array of IDs)
      {
        id: "models",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: (typeof keys)[number]) => row.model_ids ?? [],
        filterFn: (row, _id, value: string[]) => {
          const rowIds = (row.getValue("models") as string[]) ?? [];
          if (value.length === 0) return true;
          if (rowIds.length === 0) return true;
          return value.some((v) => rowIds.includes(v));
        },
      },
    ],
    []
  );

  // Create table instance
  const table = useReactTable({
    data: keys,
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
    keys.length,
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
              <Skeleton className="h-8 w-[110px]" />
            </div>
          </div>
        </div>

        {/* Keys grid skeleton */}
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
    if (!deleteItem || !deleteKeyAction) return;

    setIsDeleting(true);
    try {
      await deleteKeyAction({
        body: { keyId: deleteItem.id, profileId: effectiveProfile?.id || "" },
      });
      toast.success("Key deleted successfully");
      router.refresh();
    } catch {
      toast.error("Failed to delete key");
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
    router.push(`/engine/keys/k/${id}`);
  };

  const handleView = (id: string) => {
    router.push(`/engine/keys/k/${id}`);
  };

  const handleCreateNew = () => {
    router.push("/engine/keys/new");
  };

  const renderKeyCard = (key: (typeof keys)[number]) => (
    <Card
      key={key.key_id}
      aria-label={key.name}
      data-testid="key-card"
      data-key-id={key.key_id}
      className="relative flex flex-col h-full"
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg">{key.name}</CardTitle>
            <div className="mt-1 space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline">
                  <Key className="h-3 w-3 mr-1" />
                  {key.type.toUpperCase()}
                </Badge>
                {!key.active && <Badge variant="secondary">Inactive</Badge>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {key.can_edit ? (
              <Button
                variant="outline"
                size="sm"
                data-testid={`edit-${key.key_id}`}
                onClick={() => handleEdit(key.key_id)}
                aria-label={`Edit ${key.name}`}
              >
                <Edit className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                data-testid={`view-${key.key_id}`}
                onClick={() => handleView(key.key_id)}
                aria-label={`View ${key.name}`}
              >
                <Eye className="h-4 w-4" />
              </Button>
            )}
            {key.can_delete && (
              <Button
                variant="outline"
                size="sm"
                data-testid={`delete-${key.key_id}`}
                onClick={() => handleDeleteClick(key.key_id, key.name)}
                aria-label={`Delete ${key.name}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 flex-grow flex flex-col justify-end">
        <p className="text-sm text-muted-foreground mb-2">{key.key_masked}</p>
        {/* Info row: Models count */}
        {key.model_ids && key.model_ids.length > 0 && (
          <div className="flex items-center gap-1.5 mt-3 text-xs text-muted-foreground">
            <span>
              {key.model_ids.length}{" "}
              {key.model_ids.length === 1 ? "model" : "models"}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );

  const renderEmptyState = () => (
    <div className="col-span-full">
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Sparkles className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No keys yet</h3>
          <p className="text-muted-foreground text-center mb-4">
            Create your first key to manage API and auth credentials
          </p>
          <Button onClick={handleCreateNew}>
            <Plus className="h-4 w-4 mr-2" />
            Create Your First Key
          </Button>
        </CardContent>
      </Card>
    </div>
  );

  // Get column references for toolbar
  const nameColumn = table.getColumn("name");
  const typeColumn = table.getColumn("type");
  const departmentsColumn = table.getColumn("departments");
  const modelsColumn = table.getColumn("models");
  const isFiltered = table.getState().columnFilters.length > 0;

  return (
    <div className="space-y-6">
      {keys.length === 0 ? (
        renderEmptyState()
      ) : (
        <div className="space-y-4">
          {/* Toolbar */}
          <div
            className="flex flex-col md:flex-row md:items-center md:justify-between gap-2"
            data-testid="keys-toolbar"
          >
            <div className="flex flex-col md:flex-row md:flex-1 md:items-center md:space-x-2 gap-2 md:gap-0">
              <div className="w-full md:w-auto">
                <Input
                  data-testid="keys-search"
                  placeholder="Search keys..."
                  value={(nameColumn?.getFilterValue() as string) ?? ""}
                  onChange={(event) =>
                    nameColumn?.setFilterValue(event.target.value)
                  }
                  className="h-8 w-full md:w-[150px] lg:w-[250px]"
                  aria-label="Search keys by name"
                  aria-controls="keys-grid"
                />
              </div>

              <div className="flex items-center space-x-2 flex-wrap">
                {/* Department Filter */}
                {departmentsColumn && departmentOptions.length > 0 && (
                  <DataTableFacetedFilter
                    column={departmentsColumn}
                    title="Department"
                    options={departmentOptions}
                  />
                )}

                {/* Type Filter */}
                {typeColumn && typeOptions.length > 0 && (
                  <DataTableFacetedFilter
                    column={typeColumn}
                    title="Type"
                    options={typeOptions}
                  />
                )}

                {/* Model Filter */}
                {modelsColumn && modelOptions.length > 0 && (
                  <DataTableFacetedFilter
                    column={modelsColumn}
                    title="Model"
                    options={modelOptions}
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
            aria-label="keys grid"
            data-testid="keys-grid"
          >
            {tableRows.length ? (
              tableRows.map((row) => renderKeyCard(row.original))
            ) : (
              <div className="col-span-full text-center py-8 text-muted-foreground">
                No keys match the current filters.
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
          aria-labelledby="delete-key-title"
          data-testid="dialog-delete-key"
        >
          <AlertDialogHeader>
            <AlertDialogTitle id="delete-key-title">
              Delete Key
            </AlertDialogTitle>
            <AlertDialogDescription>
              <p>
                Are you sure you want to delete the key "{deleteItem?.name}"?
                This action cannot be undone.
              </p>
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
    </div>
  );
}
