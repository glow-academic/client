/**
 * Simulations.tsx
 * Used to display the simulations page with the new unified simulation playground.
 * Server-side filtering with nuqs URL-backed state.
 * @AshokSaravanan222 & @siladiea
 * 06/07/2025
 */
"use client";
import { Copy, Edit, Eye, Search, Sparkles, Trash2, Users, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import type {
  DeleteSimulationIn,
  DeleteSimulationOut,
  DuplicateSimulationIn,
  DuplicateSimulationOut,
  SimulationsListOut,
} from "@/app/(main)/training/simulations/page";
import { GenerateRegenerateModal } from "@/components/common/forms/GenerateRegenerateModal";
import { useGenerationModal } from "@/hooks/use-generation-modal";
import { useArtifactAi } from "@/hooks/use-artifact-ai";
import { DataTableFacetedFilter } from "@/components/common/table/DataTableFacetedFilter";
import { DataTablePagination } from "@/components/common/table/DataTablePagination";
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

export interface SimulationsProps {
  // Server-provided data (for server-side rendering)
  listData: SimulationsListOut;
  // Server actions (replaces useMutation)
  duplicateSimulationAction?: (
    input: DuplicateSimulationIn,
  ) => Promise<DuplicateSimulationOut>;
  deleteSimulationAction?: (
    input: DeleteSimulationIn,
  ) => Promise<DeleteSimulationOut>;
  // Server-side pagination/filtering state
  pageIndex: number;
  pageSize: number;
  totalCount: number;
  scenarioSearch: string;
  cohortSearch: string;
  departmentSearch: string;
}

export function Simulations({
  listData: serverListData,
  duplicateSimulationAction,
  deleteSimulationAction,
  pageIndex,
  pageSize,
  totalCount,
  scenarioSearch,
  cohortSearch,
  departmentSearch,
}: SimulationsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteItem, setDeleteItem] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState<string | null>(null);

  // Generation via useArtifactAi hook
  type SimulationResourceType = "names" | "descriptions" | "flags" | "departments" | "scenarios" | "scenario_flags" | "scenario_positions" | "scenario_rubrics" | "scenario_time_limits";

  const { generate } = useArtifactAi({
    artifactType: "simulation",
    groupId: null,
    validResourceTypes: ["names", "descriptions", "flags", "departments", "scenarios", "scenario_flags", "scenario_positions", "scenario_rubrics", "scenario_time_limits"],
    onComplete: () => router.refresh(),
  });

  const { handleOpenStepCardModal, modalProps } = useGenerationModal<SimulationResourceType>({
    stepResources: {
      all: ["names", "descriptions", "flags", "departments", "scenarios", "scenario_flags", "scenario_positions", "scenario_rubrics", "scenario_time_limits"],
    },
    resourceLabels: {
      names: "Name",
      descriptions: "Description",
      flags: "Configuration",
      departments: "Departments",
      scenarios: "Scenarios",
      scenario_flags: "Scenario Configuration",
      scenario_positions: "Scenario Positions",
      scenario_rubrics: "Scenario Rubrics",
      scenario_time_limits: "Scenario Time Limits",
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
  const scenarioSearchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cohortSearchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const departmentSearchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Local search state (for immediate UI feedback while debouncing)
  const [localSearch, setLocalSearch] = useState(searchParams.get("search") ?? "");

  // URL parameter update helper
  const updateSimulationsParams = useCallback(
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
    const scenarioIds = searchParams.getAll("scenarioIds");
    if (scenarioIds.length > 0) filters.push({ id: "scenario_ids", value: scenarioIds });
    const cohortIds = searchParams.getAll("cohortIds");
    if (cohortIds.length > 0) filters.push({ id: "cohort_ids", value: cohortIds });
    const departmentIds = searchParams.getAll("departmentIds");
    if (departmentIds.length > 0) filters.push({ id: "departments", value: departmentIds });
    return filters;
  });
  const [sorting, setSorting] = useState<SortingState>([
    { id: "updated_at", desc: true },
  ]);

  // Use server-provided data directly
  const simulationsData = serverListData;

  // Extract data from response - arrays directly (composite types)
  const simulations = useMemo(
    () => simulationsData?.simulations || [],
    [simulationsData?.simulations],
  );

  // Create scenario mapping dict client-side for lookups (from scenarios array)
  const scenarioMapping = useMemo(() => {
    const scenarios = simulationsData?.scenarios || [];
    return scenarios.reduce((acc, scenario) => {
      if (scenario.scenario_id) {
        acc[scenario.scenario_id] = scenario;
      }
      return acc;
    }, {} as Record<string, typeof scenarios[0]>);
  }, [simulationsData?.scenarios]);

  // Use server-provided facet options directly (filtered by search term server-side)
  const scenarioOptions = useMemo(
    () =>
      (simulationsData?.scenario_filter?.options || [])
        .map((opt) => ({
          value: opt.id as string,
          label: opt.name as string,
          count: opt.count ?? undefined,
        }))
        .filter((opt) => opt.value && opt.label),
    [simulationsData?.scenario_filter],
  );
  const cohortOptions = useMemo(
    () =>
      (simulationsData?.cohort_filter?.options || [])
        .map((opt) => ({
          value: opt.id as string,
          label: opt.name as string,
          count: opt.count ?? undefined,
        }))
        .filter((opt) => opt.value && opt.label),
    [simulationsData?.cohort_filter],
  );
  const departmentOptions = useMemo(
    () =>
      (simulationsData?.department_filter?.options || [])
        .map((opt) => ({
          value: opt.id as string,
          label: opt.name as string,
          count: opt.count ?? undefined,
        }))
        .filter((opt) => opt.value && opt.label),
    [simulationsData?.department_filter],
  );

  // Define table columns inline
  const columns: ColumnDef<(typeof simulations)[number]>[] = useMemo(
    () => [
      {
        accessorKey: "name",
        header: "Name",
      },
      // Hidden faceting column for Scenarios (array of IDs)
      {
        id: "scenario_ids",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: (typeof simulations)[number]) => row.scenario_ids ?? [],
        filterFn: (row, _id, value: string[]) => {
          const rowIds = (row.getValue("scenario_ids") as string[]) ?? [];
          if (value.length === 0) return true;
          if (rowIds.length === 0) return false;
          return value.some((v) => rowIds.includes(v));
        },
      },
      // Hidden faceting column for Cohorts (array of IDs)
      {
        id: "cohort_ids",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: (typeof simulations)[number]) => row.cohort_ids ?? [],
        filterFn: (row, _id, value: string[]) => {
          const rowIds = (row.getValue("cohort_ids") as string[]) ?? [];
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
        accessorFn: (row: (typeof simulations)[number]) =>
          row.department_ids ?? [],
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
          if (!row.original.updated_at) return null;
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
    data: simulations,
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
      const scenarioFilter = newFilters.find((f) => f.id === "scenario_ids");
      const cohortFilter = newFilters.find((f) => f.id === "cohort_ids");
      const departmentFilter = newFilters.find((f) => f.id === "departments");
      updateSimulationsParams({
        scenarioIds: (scenarioFilter?.value as string[] | undefined) ?? null,
        cohortIds: (cohortFilter?.value as string[] | undefined) ?? null,
        departmentIds: (departmentFilter?.value as string[] | undefined) ?? null,
      });
    },
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: (updater) => {
      const current = { pageIndex, pageSize };
      const next = typeof updater === "function" ? updater(current) : updater;
      updateSimulationsParams({
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
        updateSimulationsParams({ search: value || null });
      }, 500);
    },
    [updateSimulationsParams],
  );

  const handleSearchBlur = useCallback(() => {
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
      searchDebounceRef.current = null;
    }
    updateSimulationsParams({ search: localSearch || null });
  }, [localSearch, updateSimulationsParams]);

  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        if (searchDebounceRef.current) {
          clearTimeout(searchDebounceRef.current);
          searchDebounceRef.current = null;
        }
        updateSimulationsParams({ search: localSearch || null });
      }
    },
    [localSearch, updateSimulationsParams],
  );

  // Filter option search handlers (300ms debounce)
  const handleScenarioSearchChange = useCallback(
    (term: string) => {
      if (scenarioSearchDebounceRef.current) clearTimeout(scenarioSearchDebounceRef.current);
      scenarioSearchDebounceRef.current = setTimeout(() => {
        updateSimulationsParams({ scenarioSearch: term || null });
      }, 300);
    },
    [updateSimulationsParams],
  );

  const handleCohortSearchChange = useCallback(
    (term: string) => {
      if (cohortSearchDebounceRef.current) clearTimeout(cohortSearchDebounceRef.current);
      cohortSearchDebounceRef.current = setTimeout(() => {
        updateSimulationsParams({ cohortSearch: term || null });
      }, 300);
    },
    [updateSimulationsParams],
  );

  const handleDepartmentSearchChange = useCallback(
    (term: string) => {
      if (departmentSearchDebounceRef.current) clearTimeout(departmentSearchDebounceRef.current);
      departmentSearchDebounceRef.current = setTimeout(() => {
        updateSimulationsParams({ departmentSearch: term || null });
      }, 300);
    },
    [updateSimulationsParams],
  );

  // Reset all filters
  const handleResetFilters = useCallback(() => {
    setColumnFilters([]);
    setLocalSearch("");
    updateSimulationsParams({
      search: null,
      scenarioIds: null,
      cohortIds: null,
      departmentIds: null,
      scenarioSearch: null,
      cohortSearch: null,
      departmentSearch: null,
      page: null,
    });
  }, [updateSimulationsParams]);

  const handleDelete = async () => {
    if (!deleteItem || !deleteSimulationAction) return;

    setIsDeleting(true);
    try {
      await deleteSimulationAction({ body: { simulation_id: deleteItem.id } });
      toast.success("Simulation deleted successfully");
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to delete simulation";
      const cleanMsg = msg.replace(/^\d{3}\s*/, "");
      toast.error(cleanMsg || "Failed to delete simulation");
      if (msg.startsWith("404")) {
        router.refresh();
      }
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
    router.push(`/training/simulations/${id}`);
  };

  const handleDuplicate = async (
    simulationId: string,
    _simulationName: string,
  ) => {
    if (!duplicateSimulationAction) return;

    setIsDuplicating(simulationId);
    try {
      await duplicateSimulationAction({ body: { simulation_id: simulationId } });
      toast.success("Simulation duplicated successfully");
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to duplicate simulation";
      const cleanMsg = msg.replace(/^\d{3}\s*/, "");
      toast.error(cleanMsg || "Failed to duplicate simulation");
      if (msg.startsWith("404")) {
        router.refresh();
      }
    } finally {
      setIsDuplicating(null);
    }
  };

  const renderSimulationCard = (simulation: (typeof simulations)[number]) => {
    if (!simulation.simulation_id) return null;
    return (
    <Card
      key={simulation.simulation_id}
      aria-label={simulation.name || undefined}
      data-testid="simulation-card"
      data-simulation-id={simulation.simulation_id}
      className="relative flex flex-col h-full hover:shadow-md transition-shadow"
      role="gridcell"
    >
      <CardHeader className="pb-3">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-lg truncate">
              {simulation.name}
            </CardTitle>
            {(simulation.generated || simulation.is_inactive || simulation.practice_simulation) && (
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {simulation.generated && (
                <Badge variant="default">
                  <Sparkles className="h-3 w-3 mr-1" />
                  {simulation.mcp ? "MCP" : "AI"}
                </Badge>
              )}
              {simulation.practice_simulation && (
                <Badge variant="outline" className="text-xs">
                  Practice
                </Badge>
              )}
              {simulation.is_inactive && (
                <Badge variant="secondary">Inactive</Badge>
              )}
            </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1">
            {simulation.can_edit ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    data-testid="btn-edit-simulation"
                    onClick={() =>
                      simulation.simulation_id &&
                      handleEdit(simulation.simulation_id)
                    }
                    aria-label={`Edit ${simulation.name || "Simulation"}`}
                    className="h-9 px-3"
                  >
                    <Edit className="h-4 w-4 md:mr-0 mr-2" />
                    <span className="md:hidden">Edit</span>
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
                    data-testid="btn-view-simulation"
                    onClick={() =>
                      simulation.simulation_id &&
                      handleEdit(simulation.simulation_id)
                    }
                    aria-label={`View ${simulation.name}`}
                    className="h-9 px-3"
                  >
                    <Eye className="h-4 w-4 md:mr-0 mr-2" />
                    <span className="md:hidden">View</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>View</TooltipContent>
              </Tooltip>
            )}
            {simulation.can_duplicate && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    data-testid="btn-duplicate-simulation"
                    onClick={() =>
                      simulation.simulation_id &&
                      handleDuplicate(
                        simulation.simulation_id,
                        simulation.name || "Simulation"
                      )
                    }
                    disabled={
                      isDuplicating === simulation.simulation_id ||
                      !simulation.simulation_id
                    }
                    aria-busy={
                      isDuplicating === simulation.simulation_id
                        ? true
                        : undefined
                    }
                    aria-label={`Duplicate ${simulation.name || "Simulation"}`}
                    className="h-9 px-3"
                  >
                    {isDuplicating === simulation.simulation_id ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent md:mr-0 mr-2" />
                    ) : (
                      <Copy className="h-4 w-4 md:mr-0 mr-2" />
                    )}
                    <span className="md:hidden">
                      {isDuplicating === simulation.simulation_id
                        ? "Duplicating..."
                        : "Duplicate"}
                    </span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Duplicate</TooltipContent>
              </Tooltip>
            )}
            {simulation.can_delete && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    data-testid="btn-delete-simulation"
                    onClick={() =>
                      simulation.simulation_id &&
                      handleDeleteClick(
                        simulation.simulation_id,
                        simulation.name || "Simulation"
                      )
                    }
                    aria-label={`Delete ${simulation.name || "Simulation"}`}
                    className="h-9 px-3"
                  >
                    <Trash2 className="h-4 w-4 md:mr-0 mr-2" />
                    <span className="md:hidden">Delete</span>
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
          {simulation.description || "No description available"}
        </p>
        {/* Compact info row: Cohorts and Scenario dots */}
        <div className="flex items-center gap-1.5 mt-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            {simulation.num_cohorts}{" "}
            {simulation.num_cohorts === 1 ? "cohort" : "cohorts"}
          </span>
          <div className="flex-grow" />
          {/* Scenario dots - colored by persona */}
          {simulation.scenario_ids && simulation.scenario_ids.length > 0 && (
            <div className="flex items-center gap-1">
              {simulation.scenario_ids.map((scenarioId) => {
                const scenario = scenarioMapping[scenarioId];
                if (!scenario) return null;

                // Get first persona color
                const firstPersonaId = scenario.persona_ids?.[0];
                const persona = firstPersonaId && scenario.persona_mapping
                  ? scenario.persona_mapping.find(p => String(p.persona_id) === String(firstPersonaId))
                  : null;
                const personaColor = persona?.color || "#9CA3AF"; // gray-400 fallback

                return (
                  <Tooltip key={scenarioId}>
                    <TooltipTrigger asChild>
                      <div
                        className="w-2 h-2 rounded-full cursor-pointer"
                        style={{
                          backgroundColor: personaColor,
                        }}
                        aria-label={scenario.name || undefined}
                      />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{scenario.name}</p>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
    );
  };

  // Get column references for toolbar
  const scenarioColumn = table.getColumn("scenario_ids");
  const cohortColumn = table.getColumn("cohort_ids");
  const departmentsColumn = table.getColumn("departments");
  const isFiltered = columnFilters.length > 0 || localSearch.length > 0;

  return (
    <TooltipProvider>
      <div className="space-y-6" data-page="simulations-index">
        <div className="space-y-4">
          {/* Toolbar */}
          <div
            className="flex flex-col md:flex-row md:items-center md:justify-between gap-2"
            data-testid="simulations-toolbar"
          >
            <div className="flex flex-col md:flex-row md:flex-1 md:items-center md:space-x-2 gap-2 md:gap-0">
              <div className="w-full md:w-auto">
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    data-testid="simulations-search"
                    placeholder="Search simulations..."
                    value={localSearch}
                    onChange={(event) => handleSearchChange(event.target.value)}
                    onBlur={handleSearchBlur}
                    onKeyDown={handleSearchKeyDown}
                    className="h-8 w-full md:w-[150px] lg:w-[250px] pl-8"
                    aria-label="Search simulations by name"
                    aria-controls="simulations-grid"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2 flex-wrap">
                {/* Scenario Filter */}
                {scenarioColumn && (
                  <DataTableFacetedFilter
                    column={scenarioColumn}
                    title="Scenario"
                    options={scenarioOptions}
                    isServerDriven={true}
                    onSearchChange={handleScenarioSearchChange}
                    searchValue={scenarioSearch}
                  />
                )}

                {/* Cohort Filter */}
                {cohortColumn && (
                  <DataTableFacetedFilter
                    column={cohortColumn}
                    title="Cohort"
                    options={cohortOptions}
                    isServerDriven={true}
                    onSearchChange={handleCohortSearchChange}
                    searchValue={cohortSearch}
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
            aria-label="simulations grid"
            data-testid="simulations-grid"
          >
            {simulations.length ? (
              simulations.map((simulation) => (
                <div key={simulation.simulation_id}>{renderSimulationCard(simulation)}</div>
              ))
            ) : (
              <div className="col-span-full text-center py-8 text-muted-foreground">
                No simulations match the current filters.
              </div>
            )}
          </div>

          {/* Pagination */}
          <DataTablePagination table={table} card={true} />
        </div>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent
            aria-labelledby="delete-simulation-title"
            data-testid="dialog-delete-simulation"
          >
            <AlertDialogHeader>
              <AlertDialogTitle id="delete-simulation-title">
                Delete Simulation
              </AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete the simulation "
                {deleteItem?.name}
                "? This action cannot be undone.
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
