/**
 * Fields.tsx
 * Used to display the fields page with table-based filtering and card layout.
 * @AshokSaravanan222 & @siladiea
 * 12/05/2025
 */
"use client";
import { Copy, Edit, Plus, Sparkles, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import type {
  FieldsListOut,
  DeleteFieldIn,
  DeleteFieldOut,
  DuplicateFieldIn,
  DuplicateFieldOut,
} from "@/app/(main)/management/fields/page";
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

export interface FieldsProps {
  // Server-provided data (for server-side rendering)
  listData: FieldsListOut;
  // Server actions (replaces useMutation)
  duplicateFieldAction?: (
    input: DuplicateFieldIn,
  ) => Promise<DuplicateFieldOut>;
  deleteFieldAction?: (input: DeleteFieldIn) => Promise<DeleteFieldOut>;
}

export default function Fields({
  listData: serverListData,
  duplicateFieldAction,
  deleteFieldAction,
}: FieldsProps) {
  const router = useRouter();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteItem, setDeleteItem] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState<string | null>(null);

  // Table state
  const [rowSelection, setRowSelection] = useState({});
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = useState<SortingState>([
    { id: "name", desc: false },
  ]);

  // Use server-provided data directly
  const fieldsData = serverListData;
  const isLoading = false; // No loading when using server data

  // Extract data from response
  const fields = useMemo(() => fieldsData?.fields || [], [fieldsData?.fields]);

  // Use server-provided facet options directly (no client-side computation)
  const parameterOptions = useMemo(
    () =>
      (fieldsData?.parameter_options || [])
        .map((opt) => ({
          value: opt["value"] as string,
          label: opt["label"] as string,
        }))
        .filter((opt) => opt.value && opt.label),
    [fieldsData?.parameter_options],
  );
  const departmentOptions = useMemo(
    () =>
      (fieldsData?.department_options || [])
        .map((opt) => ({
          value: opt["value"] as string,
          label: opt["label"] as string,
        }))
        .filter((opt) => opt.value && opt.label),
    [fieldsData?.department_options],
  );

  // Define table columns inline
  const columns: ColumnDef<(typeof fields)[number]>[] = useMemo(
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
      // Hidden faceting column for Parameters (array of IDs)
      {
        id: "parameters",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: (typeof fields)[number]) => row.parameter_ids ?? [],
        filterFn: (row, _id, value: string[]) => {
          const rowIds = (row.getValue("parameters") as string[]) ?? [];
          if (value.length === 0) return true;
          if (rowIds.length === 0) return true;
          return value.some((v) => rowIds.includes(v));
        },
      },
      // Hidden faceting column for Departments (array of IDs)
      {
        id: "departments",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: (typeof fields)[number]) => row.department_ids ?? [],
        filterFn: (row, _id, value: string[]) => {
          const rowIds = (row.getValue("departments") as string[]) ?? [];
          if (value.length === 0) return true;
          if (rowIds.length === 0) return true;
          return value.some((v) => rowIds.includes(v));
        },
      },
    ],
    [],
  );

  // Create table instance
  const table = useReactTable({
    data: fields,
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

  // Memoize table rows
  const pageIndex = table.getState().pagination.pageIndex;
  const pageSize = table.getState().pagination.pageSize;
  const sortingKey = JSON.stringify(sorting);
  const columnFiltersKey = JSON.stringify(columnFilters);
  const tableRows = useMemo(() => {
    return table.getRowModel().rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortingKey, columnFiltersKey, fields.length, pageIndex, pageSize]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <div className="flex flex-col md:flex-row md:flex-1 md:items-center md:space-x-2 gap-2 md:gap-0">
            <Skeleton className="h-8 w-full md:w-[150px] lg:w-[250px]" />
            <div className="flex items-center space-x-2">
              <Skeleton className="h-8 w-[100px]" />
              <Skeleton className="h-8 w-[120px]" />
            </div>
          </div>
        </div>
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
                    <Skeleton className="h-8 w-8 rounded" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-3/4 mb-3" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const handleDelete = async () => {
    if (!deleteItem || !deleteFieldAction) return;

    setIsDeleting(true);
    try {
      await deleteFieldAction({
        body: {
          fieldId: deleteItem.id,
          profileId: "", // Will be set from session in server action
        },
      });
      toast.success(`Field '${deleteItem.name}' deleted successfully`);
      setShowDeleteDialog(false);
      setDeleteItem(null);
      router.refresh();
    } catch (error) {
      toast.error(
        `Failed to delete field: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteClick = (fieldId: string, name: string) => {
    setDeleteItem({ id: fieldId, name });
    setShowDeleteDialog(true);
  };

  const handleDuplicate = async (fieldId: string, name: string) => {
    if (!duplicateFieldAction) return;

    setIsDuplicating(fieldId);
    try {
      await duplicateFieldAction({
        body: {
          fieldId,
          profileId: "", // Will be set from session in server action
        },
      });
      toast.success(`Field '${name}' duplicated successfully`);
      router.refresh();
    } catch (error) {
      toast.error(
        `Failed to duplicate field: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } finally {
      setIsDuplicating(null);
    }
  };

  const handleEdit = (fieldId: string) => {
    router.push(`/management/fields/${fieldId}`);
  };

  const handleCreateNew = () => {
    router.push("/management/fields/new");
  };

  const renderFieldCard = (field: (typeof fields)[number]) => {
    const parameterMapping = fieldsData?.parameter_mapping || {};
    const departmentMapping = fieldsData?.department_mapping || {};

    return (
      <Card
        key={field.field_id}
        className="flex flex-col h-full hover:shadow-md transition-shadow"
        data-testid={`field-card-${field.field_id}`}
      >
        <CardHeader className="pb-4 flex-shrink-0">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-lg font-semibold truncate">
                {field.name}
              </CardTitle>
            </div>
            <div className="flex items-center gap-1 ml-2 flex-shrink-0">
              {field.can_edit && (
                <Button
                  variant="outline"
                  size="sm"
                  data-testid={`edit-${field.field_id}`}
                  onClick={() => handleEdit(field.field_id)}
                  aria-label={`Edit ${field.name}`}
                >
                  <Edit className="h-4 w-4" />
                </Button>
              )}
              {field.can_duplicate && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDuplicate(field.field_id, field.name)}
                  disabled={isDuplicating === field.field_id}
                  aria-label={`Duplicate ${field.name}`}
                  data-testid="btn-duplicate-field"
                >
                  {isDuplicating === field.field_id ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              )}
              {field.can_delete && (
                <Button
                  variant="outline"
                  size="sm"
                  data-testid={`delete-${field.field_id}`}
                  onClick={() => handleDeleteClick(field.field_id, field.name)}
                  aria-label={`Delete ${field.name}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0 flex-grow flex flex-col justify-end">
          <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
            {field.description || "No description available"}
          </p>
          {/* Parameters and Departments */}
          <div className="flex flex-col gap-2 text-xs text-muted-foreground">
            {field.parameter_ids && field.parameter_ids.length > 0 && (
              <div className="flex flex-wrap gap-1">
                <span className="font-medium">Parameters:</span>
                {field.parameter_ids.slice(0, 3).map((pid) => (
                  <Badge key={pid} variant="outline" className="text-xs">
                    {parameterMapping[pid]?.["name"] || pid.slice(0, 8)}
                  </Badge>
                ))}
                {field.parameter_ids.length > 3 && (
                  <Badge variant="outline" className="text-xs">
                    +{field.parameter_ids.length - 3} more
                  </Badge>
                )}
              </div>
            )}
            {field.department_ids && field.department_ids.length > 0 && (
              <div className="flex flex-wrap gap-1">
                <span className="font-medium">Departments:</span>
                {field.department_ids.slice(0, 2).map((did) => (
                  <Badge key={did} variant="outline" className="text-xs">
                    {departmentMapping[did]?.name || did.slice(0, 8)}
                  </Badge>
                ))}
                {field.department_ids.length > 2 && (
                  <Badge variant="outline" className="text-xs">
                    +{field.department_ids.length - 2} more
                  </Badge>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderEmptyState = () => (
    <div className="col-span-full">
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Sparkles className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No fields yet</h3>
          <p className="text-muted-foreground text-center mb-4">
            Create your first field to organize parameter values
          </p>
          <Button onClick={handleCreateNew}>
            <Plus className="h-4 w-4 mr-2" />
            Create Your First Field
          </Button>
        </CardContent>
      </Card>
    </div>
  );

  // Get column references for toolbar
  const nameColumn = table.getColumn("name");
  const parameterColumn = table.getColumn("parameters");
  const departmentsColumn = table.getColumn("departments");
  const isFiltered = table.getState().columnFilters.length > 0;

  return (
    <div className="space-y-6">
      {fields.length === 0 ? (
        renderEmptyState()
      ) : (
        <div className="space-y-4">
          {/* Toolbar */}
          <div
            className="flex flex-col md:flex-row md:items-center md:justify-between gap-2"
            data-testid="fields-toolbar"
          >
            <div className="flex flex-col md:flex-row md:flex-1 md:items-center md:space-x-2 gap-2 md:gap-0">
              <div className="w-full md:w-auto">
                <Input
                  data-testid="fields-search"
                  placeholder="Search fields..."
                  value={(nameColumn?.getFilterValue() as string) ?? ""}
                  onChange={(event) =>
                    nameColumn?.setFilterValue(event.target.value)
                  }
                  className="h-8 w-full md:w-[150px] lg:w-[250px]"
                  aria-label="Search fields by name"
                  aria-controls="fields-grid"
                />
              </div>

              <div className="flex items-center space-x-2 flex-wrap">
                {/* Parameter Filter */}
                {parameterColumn && parameterOptions.length > 0 && (
                  <DataTableFacetedFilter
                    column={parameterColumn}
                    title="Parameter"
                    options={parameterOptions}
                  />
                )}

                {/* Department Filter */}
                {departmentsColumn && departmentOptions.length > 0 && (
                  <DataTableFacetedFilter
                    column={departmentsColumn}
                    title="Department"
                    options={departmentOptions}
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
            aria-label="fields grid"
            data-testid="fields-grid"
          >
            {tableRows.length ? (
              tableRows.map((row) => renderFieldCard(row.original))
            ) : (
              <div className="col-span-full text-center py-8 text-muted-foreground">
                No fields match the current filters.
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
          aria-labelledby="delete-field-title"
          data-testid="dialog-delete-field"
        >
          <AlertDialogHeader>
            <AlertDialogTitle id="delete-field-title">
              Delete Field
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteItem?.name}"? This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setShowDeleteDialog(false);
                setDeleteItem(null);
              }}
              data-testid="btn-cancel-delete-field"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="btn-confirm-delete-field"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
