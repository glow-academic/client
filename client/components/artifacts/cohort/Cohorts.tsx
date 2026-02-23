/**
 * Cohorts.tsx
 * Used to display the cohorts page with table-based filtering and card layout.
 * Server-side filtering with nuqs URL-backed state.
 * @AshokSaravanan222 & @siladiea
 * 06/18/2025
 */
"use client";
import { Copy, Edit, Eye, Play, Search, Sparkles, Trash2, Users, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import type {
  CohortsListOut,
  DeleteCohortIn,
  DeleteCohortOut,
  DuplicateCohortIn,
  DuplicateCohortOut,
} from "@/app/(main)/training/cohorts/page";
import { DataTableFacetedFilter } from "@/components/common/table/DataTableFacetedFilter";
import { DataTablePagination } from "@/components/common/table/DataTablePagination";
import { Input } from "@/components/ui/input";
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  getCoreRowModel,
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { GenerateRegenerateModal } from "@/components/common/forms/GenerateRegenerateModal";
import { useGenerationModal } from "@/hooks/use-generation-modal";
import { useArtifactAi } from "@/hooks/use-artifact-ai";

export interface CohortsProps {
  // Server-provided data (for server-side rendering)
  listData: CohortsListOut;
  // Server actions (replaces useMutation)
  duplicateCohortAction?: (
    input: DuplicateCohortIn,
  ) => Promise<DuplicateCohortOut>;
  deleteCohortAction?: (input: DeleteCohortIn) => Promise<DeleteCohortOut>;
  // Server-side pagination/filtering state
  pageIndex: number;
  pageSize: number;
  totalCount: number;
  simulationSearch: string;
  profileSearch: string;
  departmentSearch: string;
}

export default function Cohorts({
  listData: serverListData,
  duplicateCohortAction,
  deleteCohortAction,
  pageIndex,
  pageSize,
  totalCount,
  simulationSearch,
  profileSearch,
  departmentSearch,
}: CohortsProps) {
  const router = useRouter();
  const { generate } = useArtifactAi({
    artifactType: "cohort",
    groupId: null,
    validResourceTypes: ["names", "descriptions", "flags", "departments", "simulations", "simulation_positions", "simulation_availability", "profiles", "profile_personas"],
    onComplete: () => router.refresh(),
  });
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteItem, setDeleteItem] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState<string | null>(null);

  // Generation modal via shared hook
  type CohortResourceType = "names" | "descriptions" | "flags" | "departments" | "simulations" | "simulation_positions" | "simulation_availability" | "profiles" | "profile_personas";
  const { handleOpenStepCardModal, modalProps } = useGenerationModal<CohortResourceType>({
    stepResources: {
      all: ["names", "descriptions", "flags", "departments", "simulations", "simulation_positions", "simulation_availability", "profiles", "profile_personas"],
    },
    resourceLabels: {
      names: "Name",
      descriptions: "Description",
      flags: "Configuration",
      departments: "Departments",
      simulations: "Simulations",
      simulation_positions: "Simulation Positions",
      simulation_availability: "Simulation Availability",
      profiles: "Profiles",
      profile_personas: "Profile Personas",
    },
    canRegenerate: () => true,
    onGenerate: (selectedResources, instructions) => {
      generate(selectedResources, {
        user_instructions: instructions?.trim() ? [instructions.trim()] : null,
        save: true,
      });
    },
    isGenerating: () => false,
  });

  // Debounce refs
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const simulationSearchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const profileSearchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const departmentSearchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Local search state (for immediate UI feedback while debouncing)
  const [localSearch, setLocalSearch] = useState(searchParams.get("search") ?? "");

  // URL parameter update helper
  const updateCohortsParams = useCallback(
    (updates: Record<string, string | string[] | null | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === undefined || value === "" || (Array.isArray(value) && value.length === 0)) {
          params.delete(key);
        } else if (Array.isArray(value)) {
          params.delete(key);
          value.forEach((v) => params.append(key, v));
        } else {
          params.set(key, value);
        }
      }
      // Reset page when filters change (unless page is explicitly set in updates)
      if (!("page" in updates)) {
        params.delete("page");
      }
      const query = params.toString();
      router.push(query ? `${pathname}?${query}` : pathname);
    },
    [searchParams, pathname, router],
  );

  // Table state
  const [rowSelection, setRowSelection] = useState({});
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>(() => {
    // Initialize from URL params
    const filters: ColumnFiltersState = [];
    const simulationIds = searchParams.getAll("simulationIds");
    if (simulationIds.length > 0) filters.push({ id: "simulation_ids", value: simulationIds });
    const profileIds = searchParams.getAll("profileIds");
    if (profileIds.length > 0) filters.push({ id: "profile_ids", value: profileIds });
    const departmentIds = searchParams.getAll("departmentIds");
    if (departmentIds.length > 0) filters.push({ id: "departments", value: departmentIds });
    return filters;
  });
  const [sorting, setSorting] = useState<SortingState>([
    { id: "updated_at", desc: true },
  ]);

  // Use server-provided data directly
  const cohortsData = serverListData;

  // Extract data from response
  const cohorts = useMemo(
    () => cohortsData?.cohorts || [],
    [cohortsData?.cohorts],
  );

  // Use server-provided facet options directly (filtered by search term server-side)
  const simulationOptions = useMemo(
    () =>
      (cohortsData?.simulation_filter?.options || [])
        .map((opt) => ({
          value: opt.id as string,
          label: opt.name as string,
          count: opt.count ?? undefined,
        }))
        .filter((opt) => opt.value && opt.label),
    [cohortsData?.simulation_filter],
  );
  const profileOptions = useMemo(
    () =>
      (cohortsData?.profile_filter?.options || [])
        .map((opt) => ({
          value: opt.id as string,
          label: opt.name as string,
          count: opt.count ?? undefined,
        }))
        .filter((opt) => opt.value && opt.label),
    [cohortsData?.profile_filter],
  );
  const departmentOptions = useMemo(
    () =>
      (cohortsData?.department_filter?.options || [])
        .map((opt) => ({
          value: opt.id as string,
          label: opt.name as string,
          count: opt.count ?? undefined,
        }))
        .filter((opt) => opt.value && opt.label),
    [cohortsData?.department_filter],
  );

  // Define table columns inline
  const columns: ColumnDef<(typeof cohorts)[number]>[] = useMemo(
    () => [
      {
        accessorKey: "name",
        header: "Name",
      },
      // Hidden faceting column for Profiles (array of IDs)
      {
        id: "profile_ids",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: (typeof cohorts)[number]) => row.profile_ids ?? [],
        filterFn: (row, _id, value: string[]) => {
          const rowIds = (row.getValue("profile_ids") as string[]) ?? [];
          if (value.length === 0) return true;
          if (rowIds.length === 0) return false;
          return value.some((v) => rowIds.includes(v));
        },
      },
      // Hidden faceting column for Simulations (array of IDs)
      {
        id: "simulation_ids",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: (typeof cohorts)[number]) => row.simulation_ids ?? [],
        filterFn: (row, _id, value: string[]) => {
          const rowIds = (row.getValue("simulation_ids") as string[]) ?? [];
          if (value.length === 0) return true;
          if (rowIds.length === 0) return false;
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
        accessorFn: (row: (typeof cohorts)[number]) => row.department_ids ?? [],
        filterFn: (row, _id, value: string[]) => {
          const rowIds = (row.getValue("departments") as string[]) ?? [];
          if (value.length === 0) return true;
          if (rowIds.length === 0) return false;
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
    [],
  );

  // Page count for manual pagination
  const pageCount = Math.ceil(totalCount / pageSize);

  // Create table instance with manual pagination/filtering
  const table = useReactTable({
    data: cohorts,
    columns,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
      columnFilters,
      pagination: {
        pageIndex,
        pageSize,
      },
    },
    pageCount,
    manualPagination: true,
    manualFiltering: true,
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: (updater) => {
      const newFilters = typeof updater === "function" ? updater(columnFilters) : updater;
      setColumnFilters(newFilters);
      // Sync filter changes to URL
      const simulationFilter = newFilters.find((f) => f.id === "simulation_ids");
      const profileFilter = newFilters.find((f) => f.id === "profile_ids");
      const departmentFilter = newFilters.find((f) => f.id === "departments");
      updateCohortsParams({
        simulationIds: (simulationFilter?.value as string[] | undefined) ?? null,
        profileIds: (profileFilter?.value as string[] | undefined) ?? null,
        departmentIds: (departmentFilter?.value as string[] | undefined) ?? null,
      });
    },
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: (updater) => {
      const current = { pageIndex, pageSize };
      const next = typeof updater === "function" ? updater(current) : updater;
      updateCohortsParams({
        page: next.pageIndex > 0 ? String(next.pageIndex) : null,
        pageSize: next.pageSize !== 12 ? String(next.pageSize) : null,
      });
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  // Debounced search handler
  const handleSearchChange = useCallback(
    (value: string) => {
      setLocalSearch(value);
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
      searchDebounceRef.current = setTimeout(() => {
        updateCohortsParams({ search: value || null });
      }, 500);
    },
    [updateCohortsParams],
  );

  const handleSearchBlur = useCallback(() => {
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
      searchDebounceRef.current = null;
    }
    updateCohortsParams({ search: localSearch || null });
  }, [localSearch, updateCohortsParams]);

  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        if (searchDebounceRef.current) {
          clearTimeout(searchDebounceRef.current);
          searchDebounceRef.current = null;
        }
        updateCohortsParams({ search: localSearch || null });
      }
    },
    [localSearch, updateCohortsParams],
  );

  // Filter option search handlers (300ms debounce)
  const handleSimulationSearchChange = useCallback(
    (term: string) => {
      if (simulationSearchDebounceRef.current) clearTimeout(simulationSearchDebounceRef.current);
      simulationSearchDebounceRef.current = setTimeout(() => {
        updateCohortsParams({ simulationSearch: term || null });
      }, 300);
    },
    [updateCohortsParams],
  );

  const handleProfileSearchChange = useCallback(
    (term: string) => {
      if (profileSearchDebounceRef.current) clearTimeout(profileSearchDebounceRef.current);
      profileSearchDebounceRef.current = setTimeout(() => {
        updateCohortsParams({ profileSearch: term || null });
      }, 300);
    },
    [updateCohortsParams],
  );

  const handleDepartmentSearchChange = useCallback(
    (term: string) => {
      if (departmentSearchDebounceRef.current) clearTimeout(departmentSearchDebounceRef.current);
      departmentSearchDebounceRef.current = setTimeout(() => {
        updateCohortsParams({ departmentSearch: term || null });
      }, 300);
    },
    [updateCohortsParams],
  );

  // Reset all filters
  const handleResetFilters = useCallback(() => {
    setColumnFilters([]);
    setLocalSearch("");
    updateCohortsParams({
      search: null,
      simulationIds: null,
      profileIds: null,
      departmentIds: null,
      simulationSearch: null,
      profileSearch: null,
      departmentSearch: null,
      page: null,
    });
  }, [updateCohortsParams]);

  const handleDelete = async () => {
    if (!deleteItem || !deleteCohortAction) return;

    setIsDeleting(true);
    try {
      await deleteCohortAction({ body: { cohort_id: deleteItem.id } });
      toast.success("Cohort deleted successfully");
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to delete cohort";
      const cleanMsg = msg.replace(/^\d{3}\s*/, "");
      toast.error(cleanMsg || "Failed to delete cohort");
      if (msg.startsWith("404")) {
        router.refresh();
      }
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
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to duplicate cohort";
      const cleanMsg = msg.replace(/^\d{3}\s*/, "");
      toast.error(cleanMsg || "Failed to duplicate cohort");
      if (msg.startsWith("404")) {
        router.refresh();
      }
    } finally {
      setIsDuplicating(null);
    }
  };

  const handleDeleteClick = (id: string, name: string) => {
    setDeleteItem({ id, name });
    setShowDeleteDialog(true);
  };

  const handleEdit = (id: string) => {
    router.push(`/training/cohorts/${id}`);
  };

  const handleView = (id: string) => {
    router.push(`/training/cohorts/${id}`);
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
            {(cohort.generated || cohort.is_inactive) && (
              <div className="mt-1 flex items-center gap-2">
                {cohort.generated && (
                  <Badge variant="default">
                    <Sparkles className="h-3 w-3 mr-1" />
                    {cohort.mcp ? "MCP" : "AI"}
                  </Badge>
                )}
                {cohort.is_inactive && (
                  <Badge variant="secondary">Inactive</Badge>
                )}
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
                      isDuplicating === cohort.cohort_id
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
  const profileColumn = table.getColumn("profile_ids");
  const simulationColumn = table.getColumn("simulation_ids");
  const departmentsColumn = table.getColumn("departments");
  const isFiltered = columnFilters.length > 0 || localSearch.length > 0;

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <div className="space-y-4">
          {/* Toolbar */}
          <div
            className="flex flex-col md:flex-row md:items-center md:justify-between gap-2"
            data-testid="cohorts-toolbar"
          >
            <div className="flex flex-col md:flex-row md:flex-1 md:items-center md:space-x-2 gap-2 md:gap-0">
              <div className="w-full md:w-auto">
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    data-testid="cohorts-search"
                    placeholder="Search cohorts..."
                    value={localSearch}
                    onChange={(event) => handleSearchChange(event.target.value)}
                    onBlur={handleSearchBlur}
                    onKeyDown={handleSearchKeyDown}
                    className="h-8 w-full md:w-[150px] lg:w-[250px] pl-8"
                    aria-label="Search cohorts by name"
                    aria-controls="cohorts-grid"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2 flex-wrap">
                {/* Simulation Filter */}
                {simulationColumn && (
                  <DataTableFacetedFilter
                    column={simulationColumn}
                    title="Simulation"
                    options={simulationOptions}
                    isServerDriven={true}
                    onSearchChange={handleSimulationSearchChange}
                    searchValue={simulationSearch}
                  />
                )}

                {/* Profile Filter */}
                {profileColumn && (
                  <DataTableFacetedFilter
                    column={profileColumn}
                    title="Profile"
                    options={profileOptions}
                    isServerDriven={true}
                    onSearchChange={handleProfileSearchChange}
                    searchValue={profileSearch}
                  />
                )}

                {/* Department Filter */}
                {departmentsColumn && (
                  <DataTableFacetedFilter
                    column={departmentsColumn}
                    title="Department"
                    options={departmentOptions}
                    isServerDriven={true}
                    onSearchChange={handleDepartmentSearchChange}
                    searchValue={departmentSearch}
                  />
                )}

                {isFiltered && (
                  <Button
                    variant="ghost"
                    onClick={handleResetFilters}
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
            {cohorts.length ? (
              cohorts.map((cohort) => (
                <div key={cohort.cohort_id}>{renderCohortCard(cohort)}</div>
              ))
            ) : (
              <div className="col-span-full text-center py-8 text-muted-foreground">
                No cohorts match the current filters.
              </div>
            )}
          </div>

          {/* Pagination */}
          <DataTablePagination table={table} card={true} />
        </div>

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
                Are you sure you want to delete the cohort "{deleteItem?.name}"?
                This action cannot be undone.
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

        <GenerateRegenerateModal {...modalProps} />
      </div>
    </TooltipProvider>
  );
}
