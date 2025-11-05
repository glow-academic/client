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
} from "@/app/(main)/system/departments/page";
import { DataTableFacetedFilter } from "@/components/common/history/DataTableFacetedFilter";
import { DataTablePagination } from "@/components/common/history/DataTablePagination";
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
    input: DuplicateDepartmentIn
  ) => Promise<DuplicateDepartmentOut>;
  deleteDepartmentAction?: (
    input: DeleteDepartmentIn
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
  const isLoading = false; // No loading when using server data

  // Extract data from response
  const departments = useMemo(
    () => departmentsData?.departments || [],
    [departmentsData?.departments]
  );

  // Filter options (inline)
  const priceSpentOptions = useMemo(
    () => [
      { value: "0-10", label: "$0 - $10" },
      { value: "10-50", label: "$10 - $50" },
      { value: "50-100", label: "$50 - $100" },
      { value: "100+", label: "$100+" },
    ],
    []
  );

  const staffCountOptions = useMemo(
    () => [
      { value: "1-5", label: "1-5 staff" },
      { value: "6-10", label: "6-10 staff" },
      { value: "11-20", label: "11-20 staff" },
      { value: "20+", label: "20+ staff" },
    ],
    []
  );

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
      // Hidden faceting column for Staff Count (categorical)
      {
        id: "staff_count",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: (typeof departments)[number]) => {
          const count = row.staff_count ?? 0;
          if (count === 0) return "1-5";
          if (count <= 5) return "1-5";
          if (count <= 10) return "6-10";
          if (count <= 20) return "11-20";
          return "20+";
        },
      },
      {
        accessorKey: "active",
        header: "Active",
      },
    ],
    []
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

  const handleEdit = (id: string) => {
    router.push(`/system/departments/d/${id}`);
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
        error instanceof Error ? error.message : "Failed to delete department"
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
    >
      <CardHeader>
        <div className="flex justify-between items-start">
          <div className="space-y-2 flex-1">
            <CardTitle className="text-base">
              {department.title || "Unnamed Department"}
            </CardTitle>
            <div className="mt-1 space-y-2">
              <div className="flex items-center gap-2">
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
          <div className="flex gap-2 items-center">
            {department.can_edit ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleEdit(department.department_id)}
              >
                <Edit className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleEdit(department.department_id)}
              >
                <Eye className="h-4 w-4" />
              </Button>
            )}
            {department.can_duplicate && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDuplicate(department)}
                disabled={isDuplicating === department.department_id}
              >
                {isDuplicating === department.department_id ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            )}
            {department.can_delete && (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  handleDeleteClick(department.department_id, department.title)
                }
              >
                <Trash2 className="h-4 w-4" />
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

  if (isLoading) {
    return (
      <div className="space-y-8">
        <Card>
          <CardContent className="p-6">
            <div className="text-center">Loading departments...</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Get column references for toolbar
  const nameColumn = table.getColumn("title");
  const priceSpentColumn = table.getColumn("total_price_spent");
  const staffCountColumn = table.getColumn("staff_count");
  const isFiltered = table.getState().columnFilters.length > 0;

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        {/* Toolbar */}
        <div className="flex items-center justify-between">
          <div className="flex flex-1 items-center space-x-2 flex-wrap">
            <div className="mb-2">
              <Input
                placeholder="Search departments..."
                value={(nameColumn?.getFilterValue() as string) ?? ""}
                onChange={(event) =>
                  nameColumn?.setFilterValue(event.target.value)
                }
                className="h-8 w-[150px] lg:w-[250px]"
              />
            </div>

            <div className="flex items-center space-x-2 flex-wrap mb-2">
              {/* Price Spent Filter */}
              {priceSpentColumn && priceSpentOptions.length > 0 && (
                <DataTableFacetedFilter
                  column={priceSpentColumn}
                  title="Price Spent"
                  options={priceSpentOptions}
                />
              )}

              {/* Staff Count Filter */}
              {staffCountColumn && staffCountOptions.length > 0 && (
                <DataTableFacetedFilter
                  column={staffCountColumn}
                  title="Staff Count"
                  options={staffCountOptions}
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

        {/* Cards Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {table.getRowModel().rows.length ? (
            table
              .getRowModel()
              .rows.map((row) => renderDepartmentCard(row.original))
          ) : (
            <div className="col-span-full text-center py-8 text-muted-foreground">
              No departments match the current filters.
            </div>
          )}
        </div>

        {/* Pagination */}
        <DataTablePagination table={table} card={true} />
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Department</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deleteItem?.name}&quot;?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
