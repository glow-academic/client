/**
 * Departments.tsx
 * Used to display the departments page.
 * @AshokSaravanan222 & @siladiea
 * 07/20/2025
 */
"use client";
import { Copy, DollarSign, Edit, Eye, Trash2, Users, X } from "lucide-react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import type {
  DeleteDepartmentIn,
  DeleteDepartmentOut,
  DepartmentsListOut,
  DuplicateDepartmentIn,
  DuplicateDepartmentOut,
} from "@/app/(main)/management/departments/page";
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
}

export default function Departments({
  listData: serverListData,
  duplicateDepartmentAction,
  deleteDepartmentAction,
}: DepartmentsProps) {
  const router = useRouter();
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

  // Extract data from response
  const departments = useMemo(
    () => departmentsData?.departments || [],
    [departmentsData?.departments],
  );
  const cohortMapping = useMemo(
    () =>
      (departmentsData?.cohort_mapping as Record<
        string,
        { name: string; description: string }
      >) || {},
    [departmentsData?.cohort_mapping]
  );
  const profileMapping = useMemo(
    () =>
      (departmentsData?.profile_mapping as Record<
        string,
        { name: string; description: string }
      >) || {},
    [departmentsData?.profile_mapping]
  );

  // Build filter options from mappings
  const cohortOptions = useMemo(() => {
    return Object.entries(cohortMapping).map(([id, obj]) => ({
      value: id,
      label: obj?.name || id,
    }));
  }, [cohortMapping]);
  const profileOptions = useMemo(() => {
    return Object.entries(profileMapping).map(([id, obj]) => ({
      value: id,
      label: obj?.name || id,
    }));
  }, [profileMapping]);

  // Define table columns inline
  const columns: ColumnDef<(typeof departments)[number]>[] = useMemo(
    () => [
      {
        accessorKey: "title",
        header: "Title",
      },
      // Hidden faceting column for Price Spent (categorical)
      {
        id: "total_price_spent",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: (typeof departments)[number]) => {
          const price = row.total_price_spent ?? 0;
          if (price === 0) return "0-10";
          if (price <= 10) return "0-10";
          if (price <= 50) return "10-50";
          if (price <= 100) return "50-100";
          return "100+";
        },
      },
      // Hidden faceting column for Cohorts (array of IDs)
      {
        id: "cohorts",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: (typeof departments)[number]) => row.cohort_ids ?? [],
        filterFn: (row, _id, value: string[]) => {
          const rowIds = (row.getValue("cohorts") as string[]) ?? [];
          if (value.length === 0) return true;
          if (rowIds.length === 0) return true; // Show cross-department items when no filter
          return value.some((v) => rowIds.includes(v));
        },
      },
      // Hidden faceting column for Profiles/Names (array of IDs)
      {
        id: "profiles",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: (typeof departments)[number]) => row.profile_ids ?? [],
        filterFn: (row, _id, value: string[]) => {
          const rowIds = (row.getValue("profiles") as string[]) ?? [];
          if (value.length === 0) return true;
          if (rowIds.length === 0) return true; // Show cross-department items when no filter
          return value.some((v) => rowIds.includes(v));
        },
      },
      {
        accessorKey: "active",
        header: "Active",
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
  const tableRows = useMemo(() => {
    return table.getRowModel().rows;
  }, [
    // Use JSON.stringify for arrays to ensure stable comparison (arrays are compared by reference)
    JSON.stringify(sorting),
    JSON.stringify(columnFilters),
    departments.length,
    // Use pagination primitives directly (not object references)
    pageIndex,
    pageSize,
  ]);

  // Filter options based on actual data using faceted values
  const priceSpentColumn = table.getColumn("total_price_spent");
  const cohortsColumn = table.getColumn("cohorts");
  const profilesColumn = table.getColumn("profiles");
  const priceSpentFacets = priceSpentColumn?.getFacetedUniqueValues();

  const priceSpentOptions = useMemo(
    () => {
      const allOptions = [
        { value: "0-10", label: "$0 - $10" },
        { value: "10-50", label: "$10 - $50" },
        { value: "50-100", label: "$50 - $100" },
        { value: "100+", label: "$100+" },
      ];
      // Filter to only show options that have matching departments
      if (!priceSpentFacets) return allOptions;
      return allOptions.filter(opt => priceSpentFacets.has(opt.value));
    },
    [priceSpentFacets],
  );

  const handleEdit = (id: string) => {
    router.push(`/management/departments/d/${id}`);
  };

  const handleDuplicate = async (department: (typeof departments)[number]) => {
    if (!department.can_duplicate || !duplicateDepartmentAction) {
      toast.error("This department cannot be duplicated");
      return;
    }

    setIsDuplicating(department.department_id);
    try {
      await duplicateDepartmentAction({
        body: { departmentId: department.department_id },
      });
      toast.success(`Department "${department.title}" duplicated successfully`);
      router.refresh();
    } catch (error) {
      toast.error("Failed to duplicate department");
    } finally {
      setIsDuplicating(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteItem || !deleteDepartmentAction) return;

    try {
      await deleteDepartmentAction({
        body: { departmentId: deleteItem.id },
      });
      toast.success(`Department "${deleteItem.name}" deleted successfully`);
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const renderDepartmentCard = (department: (typeof departments)[0]) => (
    <Card
      key={department.department_id}
      className="hover:shadow-md transition-shadow"
      data-testid="department-card"
      data-department-id={department.department_id}
      role="gridcell"
      aria-label={`department card ${department.title || "Unnamed Department"}`}
    >
      <CardHeader>
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="space-y-2 flex-1 min-w-0">
            <CardTitle className="text-base line-clamp-2">
              {department.title || "Unnamed Department"}
            </CardTitle>
            <div className="mt-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  <DollarSign className="h-3 w-3 mr-1" />$
                  {department.total_price_spent.toFixed(2)}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  <Users className="h-3 w-3 mr-1" />
                  {department.staff_count} staff
                </Badge>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              {department.description || "No description available"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            {department.can_edit ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleEdit(department.department_id)}
                aria-label={`Edit department ${department.title}`}
                data-testid="btn-edit-department"
                title={`Edit department ${department.title}`}
                className="h-9 px-3"
              >
                <Edit className="h-4 w-4 md:mr-0 mr-2" />
                <span className="md:hidden">Edit</span>
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleEdit(department.department_id)}
                aria-label={`View department ${department.title}`}
                data-testid="btn-view-department"
                title={`View department ${department.title}`}
                className="h-9 px-3"
              >
                <Eye className="h-4 w-4 md:mr-0 mr-2" />
                <span className="md:hidden">View</span>
              </Button>
            )}
            {department.can_duplicate && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDuplicate(department)}
                disabled={isDuplicating === department.department_id}
                aria-busy={
                  isDuplicating === department.department_id ? true : undefined
                }
                aria-label={`Duplicate department ${department.title}`}
                data-testid="btn-duplicate-department"
                title={`Duplicate department ${department.title}`}
                className="h-9 px-3"
              >
                {isDuplicating === department.department_id ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent md:mr-0 mr-2" />
                ) : (
                  <Copy className="h-4 w-4 md:mr-0 mr-2" />
                )}
                <span className="md:hidden">
                  {isDuplicating === department.department_id ? "Duplicating..." : "Duplicate"}
                </span>
              </Button>
            )}
            {department.can_delete && (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  handleDeleteClick(department.department_id, department.title)
                }
                aria-label={`Delete department ${department.title}`}
                data-testid="btn-delete-department"
                title={`Delete department ${department.title}`}
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
            {formatDate(department.updated_at)}
          </span>
        </div>
      </CardContent>
    </Card>
  );

  // Get column references for toolbar
  const nameColumn = table.getColumn("title");
  const isFiltered = table.getState().columnFilters.length > 0;

  return (
    <div className="space-y-8" data-page="departments-index">
      <div className="space-y-4">
        {/* Toolbar */}
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
              {/* Price Spent Filter */}
              {priceSpentColumn && priceSpentOptions.length > 0 && (
                <DataTableFacetedFilter
                  column={priceSpentColumn}
                  title="Price Spent"
                  options={priceSpentOptions}
                />
              )}

              {/* Cohorts Filter */}
              {cohortsColumn && cohortOptions.length > 0 && (
                <DataTableFacetedFilter
                  column={cohortsColumn}
                  title="Cohort"
                  options={cohortOptions}
                />
              )}

              {/* Profiles/Names Filter */}
              {profilesColumn && profileOptions.length > 0 && (
                <DataTableFacetedFilter
                  column={profilesColumn}
                  title="Name"
                  options={profileOptions}
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
              className="bg-red-600 hover:bg-red-700 text-white"
              data-testid="btn-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
