/**
 * Rubrics.tsx
 * Used to display the rubrics page with table-based filtering and card layout.
 * @AshokSaravanan222 & @siladiea
 * 06/18/2025
 */
"use client";
import {
  Copy,
  Edit,
  Eye,
  FileCheck,
  Loader2,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

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
  CreateRubricIn,
  CreateRubricOut,
  DeleteRubricIn,
  DeleteRubricOut,
  DuplicateRubricIn,
  DuplicateRubricOut,
  RubricsListOut,
  UpdateRubricIn,
  UpdateRubricOut,
} from "@/app/(main)/management/rubrics/page";
import { DataTableFacetedFilter } from "@/components/common/history/DataTableFacetedFilter";
import { DataTablePagination } from "@/components/common/history/DataTablePagination";
import TableRubric from "@/components/common/rubric/TableRubric";
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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export interface RubricsProps {
  // Server-provided data (for server-side rendering)
  listData: RubricsListOut;
  // Server actions (replaces useMutation)
  duplicateRubricAction?: (
    input: DuplicateRubricIn
  ) => Promise<DuplicateRubricOut>;
  deleteRubricAction?: (input: DeleteRubricIn) => Promise<DeleteRubricOut>;
  createRubricAction?: (input: CreateRubricIn) => Promise<CreateRubricOut>;
  updateRubricAction?: (input: UpdateRubricIn) => Promise<UpdateRubricOut>;
}

export default function Rubrics({
  listData: serverListData,
  duplicateRubricAction,
  deleteRubricAction,
}: RubricsProps) {
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
  const rubricsData = serverListData;
  const isLoading = false; // No loading when using server data

  const rubrics = useMemo(() => rubricsData?.rubrics || [], [rubricsData]);
  const standardGroupsMapping = useMemo(
    () => rubricsData?.standard_groups_mapping || {},
    [rubricsData]
  );
  const standardsMapping = useMemo(
    () => rubricsData?.standards_mapping || {},
    [rubricsData]
  );
  const departmentMapping = useMemo(
    () =>
      (rubricsData?.department_mapping as Record<
        string,
        { name: string; description: string }
      >) || {},
    [rubricsData]
  );

  // Build filter options
  const departmentOptions = useMemo(() => {
    return Object.entries(departmentMapping).map(([id, obj]) => ({
      value: id,
      label: obj?.name || id,
    }));
  }, [departmentMapping]);

  const passPointsOptions = [
    { value: "0-25", label: "0-25 points" },
    { value: "26-50", label: "26-50 points" },
    { value: "51-75", label: "51-75 points" },
    { value: "76-100", label: "76-100 points" },
    { value: "100+", label: "100+ points" },
  ];

  const totalPointsOptions = [
    { value: "0-25", label: "0-25 points" },
    { value: "26-50", label: "26-50 points" },
    { value: "51-75", label: "51-75 points" },
    { value: "76-100", label: "76-100 points" },
    { value: "100+", label: "100+ points" },
  ];

  const passPercentageOptions = [
    { value: "0-25", label: "0-25%" },
    { value: "26-50", label: "26-50%" },
    { value: "51-75", label: "51-75%" },
    { value: "76-100", label: "76-100%" },
  ];

  // Column definitions for TanStack Table
  const columns = useMemo<ColumnDef<(typeof rubrics)[number]>[]>(
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
      // Hidden faceting column for Pass Points
      {
        id: "passPoints",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: (typeof rubrics)[number]) => row.passPoints,
        filterFn: (row, _id, value: string[]) => {
          const passPoints = Number(row.getValue("passPoints"));
          return value.some((range) => {
            if (range === "100+") return passPoints >= 100;
            const [min, max] = range.split("-").map(Number);
            return (
              min !== undefined &&
              max !== undefined &&
              passPoints >= min &&
              passPoints <= max
            );
          });
        },
      },
      // Hidden faceting column for Total Points
      {
        id: "points",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: (typeof rubrics)[number]) => row.points,
        filterFn: (row, _id, value: string[]) => {
          const points = Number(row.getValue("points"));
          return value.some((range) => {
            if (range === "100+") return points >= 100;
            const [min, max] = range.split("-").map(Number);
            return (
              min !== undefined &&
              max !== undefined &&
              points >= min &&
              points <= max
            );
          });
        },
      },
      // Hidden faceting column for Pass Percentage (computed)
      {
        id: "passPercentage",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: (typeof rubrics)[number]) => {
          const points = row.points;
          if (!points || points === 0) return 0;
          return Math.round((row.passPoints / points) * 100);
        },
        filterFn: (row, _id, value: string[]) => {
          const percentage =
            row.original.points > 0
              ? Math.round(
                  (row.original.passPoints / row.original.points) * 100
                )
              : 0;
          return value.some((range) => {
            const [min, max] = range.split("-").map(Number);
            return (
              min !== undefined &&
              max !== undefined &&
              percentage >= min &&
              percentage <= max
            );
          });
        },
      },
      // Hidden faceting column for Departments (array of IDs)
      {
        id: "departments",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: (typeof rubrics)[number]) => row.department_ids ?? [],
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
    data: rubrics,
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

  const handleDelete = async () => {
    if (!deleteItem || !deleteRubricAction) return;

    setIsDeleting(true);
    try {
      await deleteRubricAction({ body: { rubricId: deleteItem.id } });
      toast.success("Rubric deleted successfully");
      router.refresh();
    } catch {
      toast.error("Failed to delete rubric");
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
      setDeleteItem(null);
    }
  };

  const handleDuplicate = async (rubric: (typeof rubrics)[number]) => {
    if (!rubric.can_duplicate || !duplicateRubricAction) {
      toast.error("This rubric cannot be duplicated");
      return;
    }

    setIsDuplicating(rubric.rubric_id);
    try {
      await duplicateRubricAction({ body: { rubricId: rubric.rubric_id } });
      toast.success(`Rubric "${rubric.name}" duplicated successfully`);
      router.refresh();
    } catch {
      toast.error("Failed to duplicate rubric");
    } finally {
      setIsDuplicating(null);
    }
  };

  const handleDeleteClick = (id: string, name: string) => {
    setDeleteItem({ id, name });
    setShowDeleteDialog(true);
  };

  const handleEdit = (id: string) => {
    router.push(`/management/rubrics/r/${id}`);
  };

  const getPassPercentage = (rubric: (typeof rubrics)[number]) => {
    if (!rubric.points || rubric.points === 0) return 0;
    return Math.round((rubric.passPoints / rubric.points) * 100);
  };

  const renderRubricCard = (rubric: (typeof rubrics)[number]) => {
    const passPercentage = getPassPercentage(rubric);

    return (
      <Card key={rubric.rubric_id} className="w-full">
        {/* Header */}
        <CardHeader className="border-b">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <CardTitle className="text-2xl font-bold">
                {rubric.name}
              </CardTitle>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Star className="h-4 w-4" />
                  {rubric.points} total points
                </div>
                <div className="flex items-center gap-2">
                  <FileCheck className="h-4 w-4" />
                  Pass: {rubric.passPoints} pts ({passPercentage}%)
                </div>
              </div>
              {rubric.description && (
                <p className="text-sm text-muted-foreground max-w-2xl">
                  {rubric.description}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {rubric.can_edit ? (
                <Button
                  variant="outline"
                  onClick={() => handleEdit(rubric.rubric_id)}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEdit(rubric.rubric_id)}
                  aria-label={`View ${rubric.name}`}
                >
                  <Eye className="h-4 w-4" />
                </Button>
              )}
              {rubric.can_duplicate && (
                <Button
                  variant="outline"
                  onClick={() => handleDuplicate(rubric)}
                  disabled={isDuplicating === rubric.rubric_id}
                >
                  {isDuplicating === rubric.rubric_id ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent mr-2" />
                  ) : (
                    <Copy className="h-4 w-4 mr-2" />
                  )}
                  Duplicate
                </Button>
              )}
              {rubric.can_delete && (
                <Button
                  variant="outline"
                  onClick={() =>
                    handleDeleteClick(rubric.rubric_id, rubric.name)
                  }
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        {/* Rubric Table */}
        <CardContent className="p-6">
          <TableRubric
            standardGroups={rubric.standard_groups}
            standardGroupsMapping={standardGroupsMapping}
            standardsMapping={standardsMapping}
          />
        </CardContent>
      </Card>
    );
  };

  // Get column references for toolbar
  const nameColumn = table.getColumn("name");
  const passPointsColumn = table.getColumn("passPoints");
  const pointsColumn = table.getColumn("points");
  const passPercentageColumn = table.getColumn("passPercentage");
  const departmentsColumn = table.getColumn("departments");
  const isFiltered = table.getState().columnFilters.length > 0;

  return (
    <div className="space-y-6">
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-4" data-testid="rubrics-data-table">
          {/* Toolbar */}
          <div className="flex items-center justify-between">
            <div className="flex flex-1 items-center space-x-2 flex-wrap">
              <div className="mb-2">
                <Input
                  placeholder="Search rubrics..."
                  value={(nameColumn?.getFilterValue() as string) ?? ""}
                  onChange={(event) =>
                    nameColumn?.setFilterValue(event.target.value)
                  }
                  className="h-8 w-[150px] lg:w-[250px]"
                />
              </div>

              <div className="flex items-center space-x-2 flex-wrap mb-2">
                {passPointsColumn && passPointsOptions.length > 0 && (
                  <DataTableFacetedFilter
                    column={passPointsColumn}
                    title="Pass Points"
                    options={passPointsOptions}
                  />
                )}

                {pointsColumn && totalPointsOptions.length > 0 && (
                  <DataTableFacetedFilter
                    column={pointsColumn}
                    title="Total Points"
                    options={totalPointsOptions}
                  />
                )}

                {passPercentageColumn && passPercentageOptions.length > 0 && (
                  <DataTableFacetedFilter
                    column={passPercentageColumn}
                    title="Pass %"
                    options={passPercentageOptions}
                  />
                )}

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
                    className="h-8 px-2 lg:px-3"
                  >
                    Reset
                    <X className="ml-2 h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Rubrics cards */}
          <div className="space-y-4">
            {table.getRowModel().rows.length ? (
              table
                .getRowModel()
                .rows.map((row) => renderRubricCard(row.original))
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No rubrics match the current filters.
              </div>
            )}
          </div>

          {/* Pagination */}
          <DataTablePagination table={table} card={true} />
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Rubric</AlertDialogTitle>
            <AlertDialogDescription>
              <p>
                Are you sure you want to delete the rubric "{deleteItem?.name}"?
                This action cannot be undone.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
