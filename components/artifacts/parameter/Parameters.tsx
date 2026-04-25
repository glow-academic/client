/**
 * Parameters.tsx
 * Parameters component showing overview of parameter items
 * @AshokSaravanan222 & @siladiea
 * 07/21/2025
 */
"use client";
import {
  Book,
  Calendar,
  Clock,
  Copy,
  Edit,
  Eye,
  List,
  MapPin,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { BulkDeleteDialog } from "@/components/common/forms/BulkDeleteDialog";
import { BulkEditDialog } from "@/components/common/forms/BulkEditDialog";
import { BulkEditFlagField } from "@/components/common/forms/BulkEditFlagField";
import { useParameterAi } from "@/hooks/use-parameter-ai";
import { useProfile } from "@/contexts/profile-context";

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
  DeleteParameterIn,
  DeleteParameterOut,
  DuplicateParameterIn,
  DuplicateParameterOut,
  ParametersListOut,
  UpdateParameterIn,
  UpdateParameterOut,
} from "@/app/(main)/management/parameters/page";
import { DataTablePagination } from "@/components/common/table/DataTablePagination";
import { ThreePickerFilters } from "@/components/common/table/ThreePickerFilters";
import { Input } from "@/components/ui/input";

export interface ParametersProps {
  // Server-provided data (for server-side rendering)
  listData: ParametersListOut;
  // Server actions (replaces useMutation)
  duplicateParameterAction?: (
    input: DuplicateParameterIn
  ) => Promise<DuplicateParameterOut>;
  deleteParameterAction?: (
    input: DeleteParameterIn
  ) => Promise<DeleteParameterOut>;
  updateParameterAction?: (
    input: UpdateParameterIn
  ) => Promise<UpdateParameterOut>;
}

export default function Parameters({
  listData: serverListData,
  duplicateParameterAction,
  deleteParameterAction,
  updateParameterAction,
}: ParametersProps) {
  const router = useRouter();
  const { profile } = useProfile();
  const [isDuplicating, setIsDuplicating] = useState<string | null>(null);

  useParameterAi({
    onComplete: () => router.refresh(),
  });
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteItem, setDeleteItem] = useState<{
    id: string;
    name: string;
  } | null>(null);

  // Table state
  const [rowSelection, setRowSelection] = useState({});
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = useState<SortingState>([
    { id: "updated_at", desc: true },
  ]);

  // Use server-provided data directly
  const parametersData = serverListData;

  const parameters = useMemo(
    () => parametersData?.parameters || [],
    [parametersData]
  );

  // Flag catalog (e.g. parameter_active) — used to reconstruct flag_ids on bulk edit.
  const flagOptions = useMemo(() => {
    return (parametersData?.flag_filter?.options || [])
      .filter((opt): opt is typeof opt & { id: string; name: string } => !!opt.id && !!opt.name)
      .map((opt) => ({ id: opt.id!, name: opt.name!, type: opt.type ?? null }));
  }, [parametersData?.flag_filter]);

  // Selection state
  const [selectedParameterIds, setSelectedParameterIds] = useState<string[]>([]);
  const selectedCount = selectedParameterIds.length;
  const selectedParameters = useMemo(() => {
    return parameters.filter((p) => p.parameter_id && selectedParameterIds.includes(p.parameter_id));
  }, [parameters, selectedParameterIds]);
  const deletableParameters = useMemo(
    () => selectedParameters.filter((p) => p.can_delete),
    [selectedParameters],
  );
  const nonDeletableParameters = useMemo(
    () => selectedParameters.filter((p) => !p.can_delete),
    [selectedParameters],
  );
  const editableParameters = useMemo(
    () => selectedParameters.filter((p) => p.can_edit ?? true),
    [selectedParameters],
  );

  const toggleSelection = useCallback((parameterId: string) => {
    setSelectedParameterIds((prev) =>
      prev.includes(parameterId)
        ? prev.filter((id) => id !== parameterId)
        : [...prev, parameterId]
    );
  }, []);
  const clearSelection = useCallback(() => setSelectedParameterIds([]), []);
  const selectAllOnPage = useCallback(() => {
    const pageIds = parameters.filter((p) => p.parameter_id).map((p) => p.parameter_id!);
    setSelectedParameterIds((prev) => Array.from(new Set([...prev, ...pageIds])));
  }, [parameters]);
  const allPageSelected = useMemo(() => {
    const pageIds = parameters.filter((p) => p.parameter_id).map((p) => p.parameter_id!);
    return pageIds.length > 0 && pageIds.every((id) => selectedParameterIds.includes(id));
  }, [parameters, selectedParameterIds]);

  // Bulk delete state
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // Bulk edit state
  const [showBulkEditDialog, setShowBulkEditDialog] = useState(false);
  const [isBulkEditing, setIsBulkEditing] = useState(false);
  const [bulkEditActiveStatus, setBulkEditActiveStatus] = useState<boolean | null>(null);

  // Use server-provided facet options directly (ListFilterSection pattern)
  const scenarioOptions = useMemo(
    () =>
      (parametersData?.scenario_filter?.options || [])
        .map((opt) => ({
          value: opt.id as string,
          label: opt.name as string,
          count: opt.count ?? 0,
        }))
        .filter((opt) => opt.value && opt.label),
    [parametersData?.scenario_filter],
  );
  const fieldOptions = useMemo(
    () =>
      (parametersData?.field_filter?.options || [])
        .map((opt) => ({
          value: opt.id as string,
          label: opt.name as string,
          count: opt.count ?? 0,
        }))
        .filter((opt) => opt.value && opt.label),
    [parametersData?.field_filter],
  );
  const departmentOptions = useMemo(
    () =>
      (parametersData?.department_filter?.options || [])
        .map((opt) => ({
          value: opt.id as string,
          label: opt.name as string,
          count: opt.count ?? 0,
        }))
        .filter((opt) => opt.value && opt.label),
    [parametersData?.department_filter],
  );

  // Column definitions for TanStack Table
  const columns = useMemo<ColumnDef<(typeof parameters)[number]>[]>(
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
      {
        accessorKey: "num_items",
        header: "Items",
        cell: ({ row }) => row.getValue("num_items"),
      },
      {
        accessorKey: "updated_at",
        header: "Updated",
        cell: ({ row }) => row.getValue("updated_at"),
      },
      // Hidden faceting column for Scenarios (array of IDs)
      {
        id: "scenarios",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        // Return the array of scenario IDs for this row
        accessorFn: (row: (typeof parameters)[number]) =>
          row.scenario_ids ?? [],
        // Let filtering check membership - show if parameter is used in ANY selected scenario
        filterFn: (row, _id, value: string[]) => {
          const rowIds = (row.getValue("scenarios") as string[]) ?? [];
          if (value.length === 0) return true;
          return value.some((v) => rowIds.includes(v));
        },
      },
      // Hidden faceting column for Fields (array of IDs)
      {
        id: "fields",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: (typeof parameters)[number]) =>
          row.document_ids ?? [],
        filterFn: (row, _id, value: string[]) => {
          const rowIds = (row.getValue("fields") as string[]) ?? [];
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
        accessorFn: (row: (typeof parameters)[number]) =>
          row.department_ids ?? [],
        filterFn: (row, _id, value: string[]) => {
          const rowIds = (row.getValue("departments") as string[]) ?? [];
          if (value.length === 0) return true;
          if (rowIds.length === 0) return true; // Show cross-department items when no filter
          return value.some((v) => rowIds.includes(v));
        },
      },
    ],
    []
  );

  // Create table instance
  const table = useReactTable({
    data: parameters,
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
    parameters.length,
    // Use pagination primitives directly (not object references)
    pageIndex,
    pageSize,
  ]);

  const handleDuplicate = async (parameter: (typeof parameters)[number]) => {
    if (!parameter.can_duplicate || !duplicateParameterAction) {
      toast.error("This parameter cannot be duplicated");
      return;
    }

    // Ensure profileId exists - required for API calls
    if (!profile?.id) {
      toast.error("Profile not loaded. Please refresh the page.");
      return;
    }

    if (!parameter.parameter_id) {
      toast.error("Parameter ID is missing");
      return;
    }
    setIsDuplicating(parameter.parameter_id);
    try {
      await duplicateParameterAction({
        body: { parameter_id: parameter.parameter_id, accept: true },
      });
      // profileId comes from X-Profile-Id header automatically
      toast.success(
        `Parameter "${parameter.name || "Unknown Parameter"}" duplicated successfully`
      );
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to duplicate parameter"
      );
    } finally {
      setIsDuplicating(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteItem || !deleteParameterAction) return;

    // Ensure profileId exists - required for API calls
    if (!profile?.id) {
      toast.error("Profile not loaded. Please refresh the page.");
      return;
    }

    try {
      await deleteParameterAction({
        body: { parameter_ids: [deleteItem.id], accept: true },
      });
      // profileId comes from X-Profile-Id header automatically
      toast.success(`Parameter "${deleteItem.name}" deleted successfully`);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete parameter"
      );
    } finally {
      setShowDeleteDialog(false);
      setDeleteItem(null);
    }
  };

  const handleDeleteClick = (id: string, name: string) => {
    setDeleteItem({ id, name });
    setShowDeleteDialog(true);
  };

  const handleBulkDelete = async () => {
    if (!deleteParameterAction || deletableParameters.length === 0) return;
    setIsBulkDeleting(true);
    try {
      const ids = deletableParameters.map((p) => p.parameter_id!);
      await deleteParameterAction({ body: { parameter_ids: ids, accept: true } });
      toast.success(`${ids.length} parameter(s) deleted successfully`);
      clearSelection();
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to delete parameters";
      toast.error(msg.replace(/^\d{3}\s*/, "") || "Failed to delete parameters");
    } finally {
      setIsBulkDeleting(false);
      setShowBulkDeleteDialog(false);
    }
  };

  const handleBulkEdit = async () => {
    if (!updateParameterAction || editableParameters.length === 0) return;

    const hasActiveChange = bulkEditActiveStatus !== null;
    if (!hasActiveChange) {
      toast.error("No changes selected");
      return;
    }

    const activeFlagId = flagOptions.find((f) => f.type === "parameter_active")?.id;

    setIsBulkEditing(true);
    try {
      const items = editableParameters.map((p) => {
        let flag_ids: string[] | undefined;
        if (hasActiveChange) {
          const isActive = bulkEditActiveStatus;
          flag_ids = isActive && activeFlagId ? [activeFlagId] : [];
        }
        return {
          id: p.parameter_id!,
          ...(hasActiveChange && { flag_ids }),
        };
      });

      await updateParameterAction({ body: { parameters: items } } as UpdateParameterIn);
      toast.success(`${items.length} parameter(s) updated successfully`);
      clearSelection();
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to update parameters";
      toast.error(msg.replace(/^\d{3}\s*/, "") || "Failed to update parameters");
    } finally {
      setIsBulkEditing(false);
      setShowBulkEditDialog(false);
    }
  };

  const openBulkEditDialog = () => {
    setBulkEditActiveStatus(null);
    setShowBulkEditDialog(true);
  };

  const getParameterIcon = (parameter: (typeof parameters)[number]) => {
    // Return different icons based on parameter name or type
    const name = (parameter.name || "").toLowerCase();
    if (name.includes("class") || name.includes("course"))
      return <Book className="h-5 w-5" />;
    if (name.includes("location") || name.includes("place"))
      return <MapPin className="h-5 w-5" />;
    if (name.includes("deadline") || name.includes("due"))
      return <Calendar className="h-5 w-5" />;
    if (name.includes("time") || name.includes("hour"))
      return <Clock className="h-5 w-5" />;
    return <List className="h-5 w-5" />;
  };

  const renderPreview = (
    items: NonNullable<ParametersListOut["parameters"]>[number]["sample_items"],
    totalCount: number
  ) => {
    // Show name + description
    if (!items || items.length === 0) {
      return <p className="text-sm text-muted-foreground">No items yet</p>;
    }
    return (
      <div className="space-y-2">
        {items.map((item: string, idx: number) => (
          <div
            key={`${item}-${idx}`}
            className="flex items-center justify-between p-2 bg-muted/50 rounded-md"
          >
            <div>
              <p className="text-sm font-medium">{item}</p>
            </div>
          </div>
        ))}
        {totalCount > 3 && (
          <p className="text-xs text-muted-foreground">
            +{totalCount - 3} more
          </p>
        )}
      </div>
    );
  };

  const renderParameterCard = (parameter: (typeof parameters)[number]) => {
    const count = parameter.num_items; // Pre-calculated from server
    const isSelected = parameter.parameter_id
      ? selectedParameterIds.includes(parameter.parameter_id)
      : false;

    const handleCardClick = (e: React.MouseEvent) => {
      // Don't toggle selection if clicking action buttons
      if ((e.target as HTMLElement).closest("[data-action-button]")) return;
      if (parameter.parameter_id) {
        toggleSelection(parameter.parameter_id);
      }
    };

    return (
      <Card
        key={parameter.parameter_id}
        className={`group relative flex flex-col h-full hover:shadow-md transition-all cursor-pointer ${
          isSelected ? "ring-2 ring-primary" : ""
        }`}
        data-testid="parameter-card"
        data-parameter-id={parameter.parameter_id}
        role="gridcell"
        aria-label={`parameter card ${parameter.name}`}
        aria-selected={isSelected}
        onClick={handleCardClick}
      >
        <CardHeader className="pb-3">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-lg flex items-center gap-2">
                <div
                  className={`transition-all overflow-hidden flex-shrink-0 ${
                    selectedCount > 0
                      ? "w-5 opacity-100"
                      : "w-0 opacity-0 group-hover:w-5 group-hover:opacity-100"
                  }`}
                  data-action-button
                >
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => {
                      if (parameter.parameter_id) toggleSelection(parameter.parameter_id);
                    }}
                    className="rounded-full h-5 w-5"
                    aria-label={`Select parameter ${parameter.name || "Unnamed"}`}
                  />
                </div>
                {getParameterIcon(parameter)}
                <span className="truncate">{parameter.name}</span>
              </CardTitle>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <Badge variant="outline">
                  {count} {count === 1 ? "item" : "items"}
                </Badge>
                {parameter.department_ids?.length === 0 && (
                  <Badge variant="secondary" className="text-xs">
                    Default
                  </Badge>
                )}
                {!parameter.active && (
                  <Badge variant="secondary" className="text-xs">
                    Inactive
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2" data-action-button>
              {parameter.can_edit ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    router.push(
                      `/management/parameters/${parameter.parameter_id}`
                    )
                  }
                  aria-label={`Edit ${parameter.name}`}
                  data-testid="btn-edit-parameter"
                  title={`Edit ${parameter.name}`}
                  className="h-9 px-3"
                >
                  <Edit className="h-4 w-4 md:mr-0 mr-2" />
                  <span className="md:hidden">Edit</span>
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    router.push(
                      `/management/parameters/${parameter.parameter_id}`
                    )
                  }
                  aria-label={`View ${parameter.name}`}
                  data-testid="btn-view-parameter"
                  title={`View ${parameter.name}`}
                  className="h-9 px-3"
                >
                  <Eye className="h-4 w-4 md:mr-0 mr-2" />
                  <span className="md:hidden">View</span>
                </Button>
              )}
              {parameter.can_duplicate && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDuplicate(parameter)}
                  disabled={isDuplicating === parameter.parameter_id}
                  aria-busy={
                    isDuplicating === parameter.parameter_id ? true : undefined
                  }
                  aria-label={`Duplicate ${parameter.name}`}
                  data-testid="btn-duplicate-parameter"
                  title={`Duplicate ${parameter.name}`}
                  className="h-9 px-3"
                >
                  {isDuplicating === parameter.parameter_id ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent md:mr-0 mr-2" />
                  ) : (
                    <Copy className="h-4 w-4 md:mr-0 mr-2" />
                  )}
                  <span className="md:hidden">
                    {isDuplicating === parameter.parameter_id
                      ? "Duplicating..."
                      : "Duplicate"}
                  </span>
                </Button>
              )}
              {parameter.can_delete && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (!parameter.parameter_id) {
                      toast.error("Parameter ID is missing");
                      return;
                    }
                    handleDeleteClick(
                      parameter.parameter_id,
                      parameter.name || "Unknown Parameter"
                    );
                  }}
                  aria-label={`Delete ${parameter.name || "Unknown Parameter"}`}
                  data-testid="btn-delete-parameter"
                  title={`Delete ${parameter.name || "Unknown Parameter"}`}
                  className="h-9 px-3"
                >
                  <Trash2 className="h-4 w-4 md:mr-0 mr-2" />
                  <span className="md:hidden">Delete</span>
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0 flex-grow flex flex-col">
          {!parameter.sample_items || parameter.sample_items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No items yet</p>
          ) : (
            renderPreview(parameter.sample_items, parameter.num_items ?? 0)
          )}
        </CardContent>
      </Card>
    );
  };

  // Get column references for toolbar
  const nameColumn = table.getColumn("name");
  const scenarioColumn = table.getColumn("scenarios");
  const fieldsColumn = table.getColumn("fields");
  const departmentsColumn = table.getColumn("departments");
  const isFiltered = table.getState().columnFilters.length > 0;

  return (
    <div className="space-y-8">
      {parameters.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12">
          <p className="text-muted-foreground">No parameters found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Toolbar — swaps between filter bar and selection action bar */}
          {selectedCount > 0 ? (
            <div
              className="flex items-center justify-between gap-2"
              data-testid="parameters-toolbar"
            >
              <div className="flex items-center gap-2">
                {deleteParameterAction && (
                  <Button
                    variant="destructive"
                    size="sm"
                    className="h-8"
                    onClick={() => setShowBulkDeleteDialog(true)}
                    disabled={deletableParameters.length === 0}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete {deletableParameters.length} of {selectedCount}
                  </Button>
                )}
                {updateParameterAction && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8"
                    onClick={openBulkEditDialog}
                    disabled={editableParameters.length === 0}
                  >
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit {editableParameters.length} of {selectedCount}
                  </Button>
                )}
                {!allPageSelected && (
                  <Button variant="ghost" size="sm" className="h-8" onClick={selectAllOnPage}>
                    Select All
                  </Button>
                )}
                <Button variant="ghost" size="sm" className="h-8" onClick={clearSelection}>
                  Unselect All
                </Button>
              </div>
            </div>
          ) : (
            <div
              className="flex flex-col md:flex-row md:items-center md:justify-between gap-2"
              data-testid="parameters-toolbar"
            >
              <div className="flex flex-col md:flex-row md:flex-1 md:items-center md:space-x-2 gap-2 md:gap-0">
                <div className="w-full md:w-auto">
                  <Input
                    data-testid="parameters-search"
                    placeholder="Search parameters..."
                    value={(nameColumn?.getFilterValue() as string) ?? ""}
                    onChange={(event) =>
                      nameColumn?.setFilterValue(event.target.value)
                    }
                    className="h-8 w-full md:w-[150px] lg:w-[250px]"
                    aria-label="Search parameters by name"
                    aria-controls="parameters-grid"
                  />
                </div>

                <div className="flex items-center space-x-2 flex-wrap">
                  <ThreePickerFilters
                    slots={[
                      {
                        column: scenarioColumn,
                        title: "Scenario",
                        options: scenarioOptions,
                      },
                      {
                        column: fieldsColumn,
                        title: "Field",
                        options: fieldOptions,
                      },
                      {
                        column: departmentsColumn,
                        title: "Department",
                        options: departmentOptions,
                      },
                    ]}
                  />

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
          )}

          {/* Cards Grid */}
          <div
            className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
            role="grid"
            aria-label="parameters grid"
            data-testid="parameters-grid"
          >
            {tableRows.length ? (
              tableRows.map((row) => renderParameterCard(row.original))
            ) : (
              <div className="col-span-full text-center py-8 text-muted-foreground">
                No parameters match the current filters.
              </div>
            )}
          </div>

          {/* Pagination */}
          <div aria-label="pagination controls">
            <DataTablePagination table={table} card={true} />
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent
          aria-labelledby="delete-parameter-title"
          data-testid="dialog-delete-parameter"
        >
          <AlertDialogHeader>
            <AlertDialogTitle id="delete-parameter-title">
              Delete Parameter
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deleteItem?.name}&quot;?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="btn-cancel-delete">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              variant="destructive"
              data-testid="btn-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Confirmation Dialog */}
      <BulkDeleteDialog
        open={showBulkDeleteDialog}
        onOpenChange={setShowBulkDeleteDialog}
        count={deletableParameters.length}
        entityLabel="parameter"
        entityLabelPlural="parameters"
        isDeleting={isBulkDeleting}
        onConfirm={handleBulkDelete}
        description={
          <>
            <p>This action cannot be undone.</p>
            {deletableParameters.length > 0 && (
              <div>
                <p className="text-sm font-medium text-destructive mb-1">Will be deleted:</p>
                <ul className="text-sm space-y-0.5">
                  {deletableParameters.map((p) => (
                    <li key={p.parameter_id} className="flex items-center gap-1.5">
                      <Trash2 className="h-3 w-3 text-destructive flex-shrink-0" />
                      {p.name || "Unnamed Parameter"}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {nonDeletableParameters.length > 0 && (
              <div>
                <p className="text-sm font-medium text-yellow-600 dark:text-yellow-500 mb-1">
                  Cannot be deleted (in use):
                </p>
                <ul className="text-sm space-y-0.5">
                  {nonDeletableParameters.map((p) => (
                    <li
                      key={p.parameter_id}
                      className="flex items-center gap-1.5 text-muted-foreground"
                    >
                      {p.name || "Unnamed Parameter"}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        }
      />

      {/* Bulk Edit Modal */}
      <BulkEditDialog
        open={showBulkEditDialog}
        onOpenChange={setShowBulkEditDialog}
        count={editableParameters.length}
        entityLabelPlural="parameters"
        isSaving={isBulkEditing}
        onSave={handleBulkEdit}
      >
        <BulkEditFlagField
          label="Active Status"
          value={bulkEditActiveStatus}
          onChange={setBulkEditActiveStatus}
        />
      </BulkEditDialog>

    </div>
  );
}
