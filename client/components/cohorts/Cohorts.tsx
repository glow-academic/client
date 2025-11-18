/**
 * Cohorts.tsx
 * Used to display the cohorts page with table-based filtering and card layout.
 * @AshokSaravanan222 & @siladiea
 * 06/18/2025
 */
"use client";
import {
  Copy,
  Edit,
  Eye,
  LogOut,
  Play,
  Plus,
  Sparkles,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import type {
  CohortsListOut,
  DeleteCohortIn,
  DeleteCohortOut,
  DuplicateCohortIn,
  DuplicateCohortOut,
  LeaveCohortIn,
  LeaveCohortOut,
} from "@/app/(main)/cohorts/page";
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

export interface CohortsProps {
  // Server-provided data (for server-side rendering)
  listData: CohortsListOut;
  // Server actions (replaces useMutation)
  duplicateCohortAction?: (
    input: DuplicateCohortIn
  ) => Promise<DuplicateCohortOut>;
  deleteCohortAction?: (input: DeleteCohortIn) => Promise<DeleteCohortOut>;
  leaveCohortAction?: (input: LeaveCohortIn) => Promise<LeaveCohortOut>;
}

export default function Cohorts({
  listData: serverListData,
  duplicateCohortAction,
  deleteCohortAction,
  leaveCohortAction,
}: CohortsProps) {
  const router = useRouter();
  const { effectiveProfile } = useProfile();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteItem, setDeleteItem] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState<string | null>(null);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [leaveItem, setLeaveItem] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [isLeaving, setIsLeaving] = useState(false);

  // Table state
  const [rowSelection, setRowSelection] = useState({});
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = useState<SortingState>([
    { id: "updatedAt", desc: true },
  ]);

  // Use server-provided data directly
  const cohortsData = serverListData;
  const isLoading = false; // No loading when using server data

  // Extract data from response
  const cohorts = useMemo(
    () => cohortsData?.cohorts || [],
    [cohortsData?.cohorts]
  );

  // Use server-provided facet options directly (no client-side computation)
  const profileOptions = useMemo(
    () =>
      (cohortsData?.profile_options || [])
        .map((opt) => ({
          value: opt["value"] as string,
          label: opt["label"] as string,
        }))
        .filter((opt) => opt.value && opt.label),
    [cohortsData?.profile_options]
  );
  const simulationOptions = useMemo(
    () =>
      (cohortsData?.simulation_options || [])
        .map((opt) => ({
          value: opt["value"] as string,
          label: opt["label"] as string,
        }))
        .filter((opt) => opt.value && opt.label),
    [cohortsData?.simulation_options]
  );
  const departmentOptions = useMemo(
    () =>
      (cohortsData?.department_options || [])
        .map((opt) => ({
          value: opt["value"] as string,
          label: opt["label"] as string,
        }))
        .filter((opt) => opt.value && opt.label),
    [cohortsData?.department_options]
  );

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

  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Header skeleton */}
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
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
      await deleteCohortAction({ body: { cohortId: deleteItem.id } });
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

  const handleLeave = async () => {
    if (!leaveItem || !leaveCohortAction) return;

    setIsLeaving(true);
    try {
      await leaveCohortAction({
        body: { cohortId: leaveItem.id, profileId: effectiveProfile?.id || "" },
      });
      toast.success("Left cohort successfully");
      router.refresh();
    } catch {
      toast.error("Failed to leave cohort");
    } finally {
      setIsLeaving(false);
      setShowLeaveDialog(false);
      setLeaveItem(null);
    }
  };

  const handleDuplicate = async (cohortId: string, cohortName: string) => {
    if (!duplicateCohortAction) return;

    setIsDuplicating(cohortId);
    try {
      await duplicateCohortAction({ body: { cohortId } });
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

  const handleLeaveClick = (id: string, name: string) => {
    setLeaveItem({ id, name });
    setShowLeaveDialog(true);
  };

  const handleEdit = (id: string) => {
    router.push(`/cohorts/e/${id}`);
  };

  const handleView = (id: string) => {
    router.push(`/cohorts/e/${id}`);
  };

  const handleCreateNew = () => {
    router.push("/cohorts/new");
  };

  const renderCohortCard = (cohort: (typeof cohorts)[number]) => (
    <Card
      key={cohort.cohort_id}
      aria-label={cohort.name}
      data-testid="cohort-card"
      data-cohort-id={cohort.cohort_id}
      className="relative flex flex-col h-full"
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg">{cohort.name}</CardTitle>
            <div className="mt-1 space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline">
                  <Users className="h-3 w-3 mr-1" />
                  {cohort.num_members} members
                </Badge>
              </div>
              {!cohort.active && (
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">Inactive</Badge>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            {cohort.can_edit ? (
              <Button
                variant="outline"
                size="sm"
                data-testid={`edit-${cohort.cohort_id}`}
                onClick={() => handleEdit(cohort.cohort_id)}
                aria-label={`Edit ${cohort.name}`}
              >
                <Edit className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                data-testid={`view-${cohort.cohort_id}`}
                onClick={() => handleView(cohort.cohort_id)}
                aria-label={`View ${cohort.name}`}
              >
                <Eye className="h-4 w-4" />
              </Button>
            )}
            {cohort.can_duplicate && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDuplicate(cohort.cohort_id, cohort.name)}
                disabled={
                  isDuplicating === cohort.cohort_id || false // No pending state for server action
                }
                aria-label={`Duplicate ${cohort.name}`}
                data-testid="btn-duplicate-cohort"
                title={`Duplicate ${cohort.name}`}
              >
                {isDuplicating === cohort.cohort_id ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            )}
            {cohort.can_delete && (
              <Button
                variant="outline"
                size="sm"
                data-testid={`delete-${cohort.cohort_id}`}
                onClick={() => handleDeleteClick(cohort.cohort_id, cohort.name)}
                aria-label={`Delete ${cohort.name}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
            {cohort.can_leave && (
              <Button
                variant="outline"
                size="sm"
                data-testid={`leave-${cohort.cohort_id}`}
                onClick={() => handleLeaveClick(cohort.cohort_id, cohort.name)}
                aria-label={`Leave ${cohort.name}`}
              >
                <LogOut className="h-4 w-4" />
              </Button>
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

  const renderEmptyState = () => (
    <div className="col-span-full">
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Sparkles className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No cohorts yet</h3>
          <p className="text-muted-foreground text-center mb-4">
            Create your first cohort to organize students into groups
          </p>
          <Button onClick={handleCreateNew}>
            <Plus className="h-4 w-4 mr-2" />
            Create Your First Cohort
          </Button>
        </CardContent>
      </Card>
    </div>
  );

  // Get column references for toolbar
  const nameColumn = table.getColumn("name");
  const profileColumn = table.getColumn("profile_ids");
  const simulationColumn = table.getColumn("simulation_ids");
  const departmentsColumn = table.getColumn("departments");
  const isFiltered = table.getState().columnFilters.length > 0;

  return (
    <div className="space-y-6">
      {cohorts.length === 0 ? (
        renderEmptyState()
      ) : (
        <div className="space-y-4">
          {/* Toolbar */}
          <div
            className="flex items-center justify-between"
            data-testid="cohorts-toolbar"
          >
            <div className="flex flex-1 items-center space-x-2 flex-wrap">
              <div className="w-full md:w-auto mb-2 md:mb-0">
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

              <div className="flex items-center space-x-2 flex-wrap mb-2">
                {/* Profile Filter */}
                {profileColumn && profileOptions.length > 0 && (
                  <DataTableFacetedFilter
                    column={profileColumn}
                    title="Profile"
                    options={profileOptions}
                  />
                )}

                {/* Simulation Filter */}
                {simulationColumn && simulationOptions.length > 0 && (
                  <DataTableFacetedFilter
                    column={simulationColumn}
                    title="Simulation"
                    options={simulationOptions}
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
            aria-label="cohorts grid"
            data-testid="cohorts-grid"
          >
            {table.getRowModel().rows.length ? (
              table
                .getRowModel()
                .rows.map((row) => renderCohortCard(row.original))
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
              className="bg-red-600 hover:bg-red-700 text-white"
              data-testid="btn-confirm-delete"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Leave Cohort Confirmation Dialog */}
      <AlertDialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
        <AlertDialogContent
          aria-labelledby="leave-cohort-title"
          data-testid="dialog-leave-cohort"
        >
          <AlertDialogHeader>
            <AlertDialogTitle id="leave-cohort-title">
              Leave Cohort
            </AlertDialogTitle>
            <AlertDialogDescription>
              <p>
                Are you sure you want to leave the cohort "{leaveItem?.name}"?
                This action cannot be undone.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={isLeaving}
              data-testid="btn-cancel-leave"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleLeave}
              disabled={isLeaving}
              className="bg-destructive hover:bg-destructive/90 text-white"
              data-testid="btn-confirm-leave"
            >
              {isLeaving ? "Leaving..." : "Leave Cohort"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
