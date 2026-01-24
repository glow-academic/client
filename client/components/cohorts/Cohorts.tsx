/**
 * Cohorts.tsx
 * Used to display the cohorts page with table-based filtering and card layout.
 * @AshokSaravanan222 & @siladiea
 * 06/18/2025
 */
"use client";
import { Copy, Edit, Eye, Play, Trash2, Users, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import type {
  CohortsListOut,
  DeleteCohortIn,
  DeleteCohortOut,
  DuplicateCohortIn,
  DuplicateCohortOut,
} from "@/app/(main)/create/cohorts/page";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export interface CohortsProps {
  // Server-provided data (for server-side rendering)
  listData: CohortsListOut;
  // Server actions (replaces useMutation)
  duplicateCohortAction?: (
    input: DuplicateCohortIn
  ) => Promise<DuplicateCohortOut>;
  deleteCohortAction?: (input: DeleteCohortIn) => Promise<DeleteCohortOut>;
}

export default function Cohorts({
  listData: serverListData,
  duplicateCohortAction,
  deleteCohortAction,
}: CohortsProps) {
  const router = useRouter();
  // effectiveProfile not used in this component
  // const { effectiveProfile } = useProfile();
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
    { id: "updated_at", desc: true },
  ]);

  // Use server-provided data directly
  const cohortsData = serverListData;
  const isLoading = false; // No loading when using server data

  // Extract data from response
  const cohorts = useMemo(
    () => cohortsData?.cohorts || [],
    [cohortsData?.cohorts]
  );

  // Convert full object arrays to options arrays for faceted filters
  // Backend returns full objects as arrays (composite types), frontend needs options format
  const profileOptions = useMemo(() => {
    const profiles = cohortsData?.profiles || [];
    // Handle both array (new format) and legacy format
    const profilesArray = Array.isArray(profiles)
      ? profiles
      : Object.values(profiles);
    return profilesArray
      .map((item) => {
        // Type guard for profile item
        if (
          item &&
          typeof item === "object" &&
          "profile_id" in item &&
          "name" in item
        ) {
          return {
            value: String(item.profile_id || ""),
            label: String(item.name || ""),
          };
        }
        return null;
      })
      .filter(
        (opt): opt is { value: string; label: string } =>
          opt !== null && !!opt.value && !!opt.label
      );
  }, [cohortsData?.profiles]);

  const simulationOptions = useMemo(() => {
    const simulations = cohortsData?.simulations || [];
    // Handle both array (new format) and legacy format
    const simulationsArray = Array.isArray(simulations)
      ? simulations
      : Object.values(simulations);
    return simulationsArray
      .map((item) => {
        // Type guard for simulation item
        if (
          item &&
          typeof item === "object" &&
          "simulation_id" in item &&
          "name" in item
        ) {
          return {
            value: String(item.simulation_id || ""),
            label: String(item.name || ""),
          };
        }
        return null;
      })
      .filter(
        (opt): opt is { value: string; label: string } =>
          opt !== null && !!opt.value && !!opt.label
      );
  }, [cohortsData?.simulations]);

  const departmentOptions = useMemo(() => {
    const departments = cohortsData?.departments || [];
    // Handle both array (new format) and legacy format
    const departmentsArray = Array.isArray(departments)
      ? departments
      : Object.values(departments);
    return departmentsArray
      .map((item) => {
        // Type guard for department item
        if (
          item &&
          typeof item === "object" &&
          "department_id" in item &&
          "name" in item
        ) {
          return {
            value: String(item.department_id || ""),
            label: String(item.name || ""),
          };
        }
        return null;
      })
      .filter(
        (opt): opt is { value: string; label: string } =>
          opt !== null && !!opt.value && !!opt.label
      );
  }, [cohortsData?.departments]);

  // Define table columns inline
  const columns: ColumnDef<(typeof cohorts)[number]>[] = useMemo(
    () => [
      {
        accessorKey: "name",
        header: "Name",
      },
      {
        accessorKey: "profile_ids",
        header: "Profiles",
      },
      {
        accessorKey: "simulation_ids",
        header: "Simulations",
      },
      // Hidden faceting column for Departments (array of IDs)
      {
        id: "departments",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: (typeof cohorts)[number]) => row.department_ids ?? [],
        filterFn: (row, _id, value: string[]) => {
          const rowIds = (row.getValue("departments") as string[]) ?? [];
          if (value.length === 0) return true;
          if (rowIds.length === 0) return true;
          return value.some((v) => rowIds.includes(v));
        },
      },
      {
        accessorKey: "updated_at",
        header: "Updated",
        cell: ({ row }) => {
          if (!row.original.updated_at) {
            return <div className="text-sm text-muted-foreground">-</div>;
          }
          const date = new Date(row.original.updated_at);
          return (
            <div className="text-sm text-muted-foreground">
              {date.toLocaleDateString()}
            </div>
          );
        },
      },
    ],
    []
  );

  // Create table instance
  const table = useReactTable({
    data: cohorts,
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
    cohorts.length,
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

        {/* Cohorts grid skeleton */}
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
                <div className="flex items-center gap-2">
                  <Skeleton className="h-3 w-3" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Permissions now come from server-side in V3 API
  // Cohorts are pre-filtered by role on the server
  // No need for client-side permission or filtering logic

  const handleDelete = async () => {
    if (!deleteItem || !deleteCohortAction) return;

    setIsDeleting(true);
    try {
      await deleteCohortAction({ body: { cohort_id: deleteItem.id } });
      toast.success("Cohort deleted successfully");
      router.refresh();
    } catch {
      toast.error("Failed to delete cohort");
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
      setDeleteItem(null);
    }
  };


  const handleDuplicate = async (cohortId: string, cohortName: string) => {
    if (!duplicateCohortAction) return;

    setIsDuplicating(cohortId);
    try {
      await duplicateCohortAction({ body: { cohort_id: cohortId } });
      toast.success(`Cohort "${cohortName}" duplicated successfully`);
      router.refresh();
    } catch {
      toast.error("Failed to duplicate cohort");
    } finally {
      setIsDuplicating(null);
    }
  };

  const handleDeleteClick = (id: string, name: string) => {
    setDeleteItem({ id, name });
    setShowDeleteDialog(true);
  };

  const handleEdit = (id: string) => {
    router.push(`/create/cohorts/c/${id}`);
  };

  const handleView = (id: string) => {
    router.push(`/create/cohorts/c/${id}`);
  };

  const renderCohortCard = (cohort: (typeof cohorts)[number]) => (
    <Card
      key={cohort.cohort_id || ""}
      {...(cohort.name ? { "aria-label": cohort.name } : {})}
      data-testid="cohort-card"
      {...(cohort.cohort_id ? { "data-cohort-id": cohort.cohort_id } : {})}
      className="relative flex flex-col h-full"
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg">{cohort.name}</CardTitle>
            {!cohort.active && (
              <div className="mt-1 flex items-center gap-2">
                <Badge variant="secondary">Inactive</Badge>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1">
            {cohort.can_edit ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    data-testid={`edit-${cohort.cohort_id}`}
                    onClick={() =>
                      cohort.cohort_id && handleEdit(cohort.cohort_id)
                    }
                    {...(cohort.name
                      ? { "aria-label": `Edit ${cohort.name}` }
                      : {})}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Edit</TooltipContent>
              </Tooltip>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    data-testid={`view-${cohort.cohort_id}`}
                    onClick={() =>
                      cohort.cohort_id && handleView(cohort.cohort_id)
                    }
                    {...(cohort.name
                      ? { "aria-label": `View ${cohort.name}` }
                      : {})}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>View</TooltipContent>
              </Tooltip>
            )}
            {cohort.can_duplicate && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      cohort.cohort_id &&
                      cohort.name &&
                      handleDuplicate(cohort.cohort_id, cohort.name)
                    }
                    disabled={
                      !cohort.cohort_id ||
                      isDuplicating === cohort.cohort_id ||
                      false // No pending state for server action
                    }
                    {...(cohort.name
                      ? { "aria-label": `Duplicate ${cohort.name}` }
                      : {})}
                    data-testid="btn-duplicate-cohort"
                  >
                    {cohort.cohort_id && isDuplicating === cohort.cohort_id ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Duplicate</TooltipContent>
              </Tooltip>
            )}
            {cohort.can_delete && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    data-testid={`delete-${cohort.cohort_id}`}
                    onClick={() =>
                      cohort.cohort_id &&
                      cohort.name &&
                      handleDeleteClick(cohort.cohort_id, cohort.name)
                    }
                    {...(cohort.name
                      ? { "aria-label": `Delete ${cohort.name}` }
                      : {})}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Delete</TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 flex-grow flex flex-col justify-end">
        <p className="text-sm text-muted-foreground line-clamp-2">
          {cohort.description || "No description available"}
        </p>
        {/* Compact info row: Members • Simulations */}
        <div className="flex items-center gap-1.5 mt-3 text-xs text-muted-foreground flex-wrap">
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            {cohort.num_members} members
          </span>
          {/* Simulation count */}
          {cohort.simulation_ids && cohort.simulation_ids.length > 0 && (
            <>
              <span className="text-muted-foreground">•</span>
              <span className="flex items-center gap-1">
                <Play className="h-3 w-3" />
                {cohort.simulation_ids.length}{" "}
                {cohort.simulation_ids.length === 1
                  ? "simulation"
                  : "simulations"}
              </span>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );

  // Get column references for toolbar
  const nameColumn = table.getColumn("name");
  const profileColumn = table.getColumn("profile_ids");
  const simulationColumn = table.getColumn("simulation_ids");
  const departmentsColumn = table.getColumn("departments");
  const isFiltered = table.getState().columnFilters.length > 0;

  return (
    <TooltipProvider>
      <div className="space-y-6">
      {cohorts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12">
          <p className="text-muted-foreground">No cohorts found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Toolbar */}
          <div
            className="flex flex-col md:flex-row md:items-center md:justify-between gap-2"
            data-testid="cohorts-toolbar"
          >
            <div className="flex flex-col md:flex-row md:flex-1 md:items-center md:space-x-2 gap-2 md:gap-0">
              <div className="w-full md:w-auto">
                <Input
                  data-testid="cohorts-search"
                  placeholder="Search cohorts..."
                  value={(nameColumn?.getFilterValue() as string) ?? ""}
                  onChange={(event) =>
                    nameColumn?.setFilterValue(event.target.value)
                  }
                  className="h-8 w-full md:w-[150px] lg:w-[250px]"
                  aria-label="Search cohorts by name"
                  aria-controls="cohorts-grid"
                />
              </div>

              <div className="flex items-center space-x-2 flex-wrap">
                {/* Profile Filter */}
                {profileColumn && (
                  <DataTableFacetedFilter
                    column={profileColumn}
                    title="Profile"
                    options={profileOptions}
                  />
                )}

                {/* Simulation Filter */}
                {simulationColumn && (
                  <DataTableFacetedFilter
                    column={simulationColumn}
                    title="Simulation"
                    options={simulationOptions}
                  />
                )}

                {/* Department Filter */}
                {departmentsColumn && (
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
            aria-label="cohorts grid"
            data-testid="cohorts-grid"
          >
            {tableRows.length ? (
              tableRows.map((row) => renderCohortCard(row.original))
            ) : (
              <div className="col-span-full text-center py-8 text-muted-foreground">
                No cohorts match the current filters.
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
          aria-labelledby="delete-cohort-title"
          data-testid="dialog-delete-cohort"
        >
          <AlertDialogHeader>
            <AlertDialogTitle id="delete-cohort-title">
              Delete Cohort
            </AlertDialogTitle>
            <AlertDialogDescription>
              <p>
                Are you sure you want to delete the cohort "{deleteItem?.name}"?
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
