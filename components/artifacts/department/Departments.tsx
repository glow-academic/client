/**
 * Departments.tsx
 * Used to display the departments page.
 * @AshokSaravanan222 & @siladiea
 * 07/20/2025
 */
"use client";
import { Copy, Edit, Eye, Pencil, Trash2, Users, X } from "lucide-react";
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
import { useDepartmentAi } from "@/hooks/use-department-ai";

import type {
  DeleteDepartmentIn,
  DeleteDepartmentOut,
  DepartmentsListOut,
  DuplicateDepartmentIn,
  DuplicateDepartmentOut,
  UpdateDepartmentIn,
  UpdateDepartmentOut,
} from "@/app/(main)/system/departments/page";
import { DataTablePagination } from "@/components/common/table/DataTablePagination";
import { ThreePickerFilters } from "@/components/common/table/ThreePickerFilters";
import { Input } from "@/components/ui/input";
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";

export interface DepartmentsProps {
  // Server-provided data (for server-side rendering)
  listData: DepartmentsListOut;
  // Server actions (replaces useMutation)
  duplicateDepartmentAction?: (
    input: DuplicateDepartmentIn,
  ) => Promise<DuplicateDepartmentOut>;
  deleteDepartmentAction?: (
    input: DeleteDepartmentIn,
  ) => Promise<DeleteDepartmentOut>;
  updateDepartmentAction?: (
    input: UpdateDepartmentIn,
  ) => Promise<UpdateDepartmentOut>;
}

export default function Departments({
  listData: serverListData,
  duplicateDepartmentAction,
  deleteDepartmentAction,
  updateDepartmentAction,
}: DepartmentsProps) {
  const router = useRouter();

  useDepartmentAi({
    onComplete: () => router.refresh(),
  });

  const [isDuplicating, setIsDuplicating] = useState<string | null>(null);
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
  const departmentsData = serverListData;

  // Extract data from response - arrays instead of dicts (composite types)
  const departments = useMemo(
    () => departmentsData?.departments || [],
    [departmentsData?.departments],
  );
  // Note: cohort/profile filter options removed since faceted filtering
  // is no longer supported without cohort_ids/profile_ids per row

  // Flag catalog (e.g. department_active) — used to reconstruct flag_ids on bulk edit.
  const flagOptions = useMemo(() => {
    return (departmentsData?.flag_filter?.options || [])
      .filter((opt): opt is typeof opt & { id: string; name: string } => !!opt.id && !!opt.name)
      .map((opt) => ({ id: opt.id!, name: opt.name!, type: opt.type ?? null }));
  }, [departmentsData?.flag_filter]);

  // Selection state
  const [selectedDepartmentIds, setSelectedDepartmentIds] = useState<string[]>([]);
  const selectedCount = selectedDepartmentIds.length;
  const selectedDepartments = useMemo(() => {
    return departments.filter(
      (d) => d.department_id && selectedDepartmentIds.includes(d.department_id),
    );
  }, [departments, selectedDepartmentIds]);
  const deletableDepartments = useMemo(
    () => selectedDepartments.filter((d) => d.can_delete),
    [selectedDepartments],
  );
  const nonDeletableDepartments = useMemo(
    () => selectedDepartments.filter((d) => !d.can_delete),
    [selectedDepartments],
  );
  const editableDepartments = useMemo(
    () => selectedDepartments.filter((d) => d.can_edit ?? true),
    [selectedDepartments],
  );

  const toggleSelection = useCallback((departmentId: string) => {
    setSelectedDepartmentIds((prev) =>
      prev.includes(departmentId)
        ? prev.filter((id) => id !== departmentId)
        : [...prev, departmentId],
    );
  }, []);
  const clearSelection = useCallback(() => setSelectedDepartmentIds([]), []);
  const selectAllOnPage = useCallback(() => {
    const pageIds = departments.filter((d) => d.department_id).map((d) => d.department_id!);
    setSelectedDepartmentIds((prev) => Array.from(new Set([...prev, ...pageIds])));
  }, [departments]);
  const allPageSelected = useMemo(() => {
    const pageIds = departments.filter((d) => d.department_id).map((d) => d.department_id!);
    return pageIds.length > 0 && pageIds.every((id) => selectedDepartmentIds.includes(id));
  }, [departments, selectedDepartmentIds]);

  // Bulk delete state
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // Bulk edit state
  const [showBulkEditDialog, setShowBulkEditDialog] = useState(false);
  const [isBulkEditing, setIsBulkEditing] = useState(false);
  const [bulkEditActiveStatus, setBulkEditActiveStatus] = useState<boolean | null>(null);

  // Define table columns inline
  const columns: ColumnDef<(typeof departments)[number]>[] = useMemo(
    () => [
      {
        accessorKey: "name",
        header: "Name",
      },
      {
        accessorKey: "updated_at",
        header: "Updated",
        cell: ({ row }) => {
          const updatedAt = row.original.updated_at;
          if (!updatedAt) {
            return (
              <div className="text-sm text-muted-foreground">-</div>
            );
          }
          const date = new Date(updatedAt);
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
    data: departments,
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
    departments.length,
    // Use pagination primitives directly (not object references)
    pageIndex,
    pageSize,
  ]);

  // Note: cohort/profile faceted filtering removed since the list API
  // no longer returns cohort_ids/profile_ids per department row

  const handleEdit = (id: string) => {
    router.push(`/system/departments/${id}`);
  };

  const handleDuplicate = async (department: (typeof departments)[number]) => {
    if (!department.can_duplicate || !duplicateDepartmentAction) {
      toast.error("This department cannot be duplicated");
      return;
    }

    if (!department.department_id) {
      toast.error("Department ID is required");
      return;
    }
    setIsDuplicating(department.department_id);
    try {
      await duplicateDepartmentAction({
        body: { department_id: department.department_id, accept: true },
      });
      toast.success(`Department "${department.name}" duplicated successfully`);
      router.refresh();
    } catch {
      toast.error("Failed to duplicate department");
    } finally {
      setIsDuplicating(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteItem || !deleteDepartmentAction) return;

    try {
      await deleteDepartmentAction({
        body: { department_ids: [deleteItem.id], accept: true },
      });
      toast.success(`Department "${deleteItem.name || "Unknown"}" deleted successfully`);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete department",
      );
    } finally {
      setShowDeleteDialog(false);
      setDeleteItem(null);
    }
  };

  const handleDeleteClick = (id: string, title: string) => {
    setDeleteItem({ id, name: title });
    setShowDeleteDialog(true);
  };

  const handleBulkDelete = async () => {
    if (!deleteDepartmentAction || deletableDepartments.length === 0) return;
    setIsBulkDeleting(true);
    try {
      const ids = deletableDepartments.map((d) => d.department_id!);
      await deleteDepartmentAction({ body: { department_ids: ids, accept: true } });
      toast.success(`${ids.length} department(s) deleted successfully`);
      clearSelection();
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to delete departments";
      toast.error(msg.replace(/^\d{3}\s*/, "") || "Failed to delete departments");
    } finally {
      setIsBulkDeleting(false);
      setShowBulkDeleteDialog(false);
    }
  };

  const handleBulkEdit = async () => {
    if (!updateDepartmentAction || editableDepartments.length === 0) return;

    const hasActiveChange = bulkEditActiveStatus !== null;
    if (!hasActiveChange) {
      toast.error("No changes selected");
      return;
    }

    const activeFlagId = flagOptions.find((f) => f.type === "department_active")?.id;

    setIsBulkEditing(true);
    try {
      const items = editableDepartments.map((d) => {
        let flag_ids: string[] | undefined;
        if (hasActiveChange) {
          const isActive = bulkEditActiveStatus;
          flag_ids = isActive && activeFlagId ? [activeFlagId] : [];
        }
        return {
          id: d.department_id!,
          ...(hasActiveChange && { flag_ids }),
        };
      });

      await updateDepartmentAction({ body: { departments: items } } as UpdateDepartmentIn);
      toast.success(`${items.length} department(s) updated successfully`);
      clearSelection();
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to update departments";
      toast.error(msg.replace(/^\d{3}\s*/, "") || "Failed to update departments");
    } finally {
      setIsBulkEditing(false);
      setShowBulkEditDialog(false);
    }
  };

  const openBulkEditDialog = () => {
    setBulkEditActiveStatus(null);
    setShowBulkEditDialog(true);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const renderDepartmentCard = (department: (typeof departments)[0]) => {
    const isSelected = department.department_id
      ? selectedDepartmentIds.includes(department.department_id)
      : false;
    return (
    <Card
      key={department.department_id}
      className={`group hover:shadow-md transition-all ${
        isSelected ? "ring-2 ring-primary" : ""
      }`}
      data-testid="department-card"
      data-department-id={department.department_id}
      role="gridcell"
      aria-label={`department card ${department.name || "Unnamed Department"}`}
      aria-selected={isSelected}
    >
      <CardHeader>
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="space-y-2 flex-1 min-w-0">
            <div className="flex items-center gap-2">
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
                    if (department.department_id) toggleSelection(department.department_id);
                  }}
                  className="rounded-full h-5 w-5"
                  aria-label={`Select department ${department.name || "Unnamed"}`}
                />
              </div>
              <CardTitle className="text-base line-clamp-2">
                {department.name || "Unnamed Department"}
              </CardTitle>
            </div>
            <div className="mt-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  <Users className="h-3 w-3 mr-1" />
                  {department.staff_count} staff
                </Badge>
                {department.is_inactive && (
                  <Badge variant="secondary" className="text-xs">
                    Inactive
                  </Badge>
                )}
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              {department.description || "No description available"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            {department.can_edit && department.department_id ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleEdit(department.department_id!)}
                aria-label={`Edit department ${department.name || "Unknown"}`}
                data-testid="btn-edit-department"
                title={`Edit department ${department.name || "Unknown"}`}
                className="h-9 px-3"
              >
                <Edit className="h-4 w-4 md:mr-0 mr-2" />
                <span className="md:hidden">Edit</span>
              </Button>
            ) : department.department_id ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => department.department_id && handleEdit(department.department_id)}
                aria-label={`View department ${department.name || "Unknown"}`}
                data-testid="btn-view-department"
                title={`View department ${department.name || "Unknown"}`}
                className="h-9 px-3"
              >
                <Eye className="h-4 w-4 md:mr-0 mr-2" />
                <span className="md:hidden">View</span>
              </Button>
            ) : null}
            {department.can_duplicate && department.department_id && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDuplicate(department)}
                disabled={isDuplicating === department.department_id}
                aria-busy={
                  isDuplicating === department.department_id ? true : undefined
                }
                aria-label={`Duplicate department ${department.name || "Unknown"}`}
                data-testid="btn-duplicate-department"
                title={`Duplicate department ${department.name || "Unknown"}`}
                className="h-9 px-3"
              >
                {isDuplicating === department.department_id ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent md:mr-0 mr-2" />
                ) : (
                  <Copy className="h-4 w-4 md:mr-0 mr-2" />
                )}
                <span className="md:hidden">
                  {isDuplicating === department.department_id
                    ? "Duplicating..."
                    : "Duplicate"}
                </span>
              </Button>
            )}
            {department.can_delete && department.department_id && (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  handleDeleteClick(department.department_id!, department.name || "Unknown")
                }
                aria-label={`Delete department ${department.name || "Unknown"}`}
                data-testid="btn-delete-department"
                title={`Delete department ${department.name || "Unknown"}`}
                className="h-9 px-3"
              >
                <Trash2 className="h-4 w-4 md:mr-0 mr-2" />
                <span className="md:hidden">Delete</span>
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-sm">
          <span className="text-muted-foreground">Updated:</span>
          <span className="font-medium ml-2">
            {department.updated_at ? formatDate(department.updated_at) : "-"}
          </span>
        </div>
      </CardContent>
    </Card>
    );
  };

  // Get column references for toolbar
  const nameColumn = table.getColumn("name");
  const isFiltered = table.getState().columnFilters.length > 0;

  return (
    <div className="space-y-8" data-page="departments-index">
      <div className="space-y-4">
        {/* Toolbar — swaps between filter bar and selection action bar */}
        {selectedCount > 0 ? (
          <div
            className="flex items-center justify-between gap-2"
            data-testid="departments-toolbar"
          >
            <div className="flex items-center gap-2">
              {deleteDepartmentAction && (
                <Button
                  variant="destructive"
                  size="sm"
                  className="h-8"
                  onClick={() => setShowBulkDeleteDialog(true)}
                  disabled={deletableDepartments.length === 0}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete {deletableDepartments.length} of {selectedCount}
                </Button>
              )}
              {updateDepartmentAction && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={openBulkEditDialog}
                  disabled={editableDepartments.length === 0}
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit {editableDepartments.length} of {selectedCount}
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
            data-testid="departments-toolbar"
          >
            <div className="flex flex-col md:flex-row md:flex-1 md:items-center md:space-x-2 gap-2 md:gap-0">
              <div className="w-full md:w-auto">
                <Input
                  data-testid="departments-search"
                  placeholder="Search departments..."
                  value={(nameColumn?.getFilterValue() as string) ?? ""}
                  onChange={(event) =>
                    nameColumn?.setFilterValue(event.target.value)
                  }
                  className="h-8 w-full md:w-[150px] lg:w-[250px]"
                  aria-label="Search departments by name"
                  aria-controls="departments-grid"
                />
              </div>

              <div className="flex items-center space-x-2 flex-wrap">
                <ThreePickerFilters
                  slots={[
                    { column: undefined, title: "Flag", options: [] },
                    { column: undefined, title: "Department", options: [] },
                    { column: undefined, title: "Filter", options: [] },
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
          aria-label="departments grid"
          data-testid="departments-grid"
        >
          {tableRows.length ? (
            tableRows.map((row) => renderDepartmentCard(row.original))
          ) : (
            <div className="col-span-full text-center py-8 text-muted-foreground">
              No departments match the current filters.
            </div>
          )}
        </div>

        {/* Pagination */}
        <div aria-label="pagination controls">
          <DataTablePagination table={table} card={true} />
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent
          aria-labelledby="delete-department-title"
          data-testid="dialog-delete-department"
        >
          <AlertDialogHeader>
            <AlertDialogTitle id="delete-department-title">
              Delete Department
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
        count={deletableDepartments.length}
        entityLabel="department"
        entityLabelPlural="departments"
        isDeleting={isBulkDeleting}
        onConfirm={handleBulkDelete}
        description={
          <>
            <p>This action cannot be undone.</p>
            {deletableDepartments.length > 0 && (
              <div>
                <p className="text-sm font-medium text-destructive mb-1">Will be deleted:</p>
                <ul className="text-sm space-y-0.5">
                  {deletableDepartments.map((d) => (
                    <li key={d.department_id} className="flex items-center gap-1.5">
                      <Trash2 className="h-3 w-3 text-destructive flex-shrink-0" />
                      {d.name || "Unnamed Department"}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {nonDeletableDepartments.length > 0 && (
              <div>
                <p className="text-sm font-medium text-yellow-600 dark:text-yellow-500 mb-1">
                  Cannot be deleted (in use):
                </p>
                <ul className="text-sm space-y-0.5">
                  {nonDeletableDepartments.map((d) => (
                    <li
                      key={d.department_id}
                      className="flex items-center gap-1.5 text-muted-foreground"
                    >
                      {d.name || "Unnamed Department"}
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
        count={editableDepartments.length}
        entityLabelPlural="departments"
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
