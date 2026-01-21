/**
 * Simulations.tsx
 * Used to display the simulations page with the new unified simulation playground.
 * @AshokSaravanan222 & @siladiea
 * 06/07/2025
 */
"use client";
import { Copy, Edit, Eye, Search, Timer, Trash2, Users, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
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
} from "@/app/(main)/create/simulations/page";
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
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
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
}

export function Simulations({
  listData: serverListData,
  duplicateSimulationAction,
  deleteSimulationAction,
}: SimulationsProps) {
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

  // Use server-provided facet options directly (no client-side computation)
  const rubricOptions = useMemo(
    () =>
      (simulationsData?.rubric_options || [])
        .map((opt) => ({
          value: opt["value"] as string,
          label: opt["label"] as string,
        }))
        .filter((opt) => opt.value && opt.label),
    [simulationsData?.rubric_options],
  );
  const cohortOptions = useMemo(
    () =>
      (simulationsData?.cohort_options || [])
        .map((opt) => ({
          value: opt["value"] as string,
          label: opt["label"] as string,
        }))
        .filter((opt) => opt.value && opt.label),
    [simulationsData?.cohort_options],
  );
  const departmentOptions = useMemo(
    () =>
      (simulationsData?.department_options || [])
        .map((opt) => ({
          value: opt["value"] as string,
          label: opt["label"] as string,
        }))
        .filter((opt) => opt.value && opt.label),
    [simulationsData?.department_options],
  );

  // Define table columns inline
  const columns: ColumnDef<(typeof simulations)[number]>[] = useMemo(
    () => [
      {
        accessorKey: "name",
        header: "Name",
      },
      // Hidden faceting column for Rubric (single ID)
      {
        id: "rubric_id",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorKey: "rubric_id",
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
        accessorFn: (row: (typeof simulations)[number]) =>
          row.department_ids ?? [],
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

  // Create table instance
  const table = useReactTable({
    data: simulations,
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
    simulations.length,
    // Use pagination primitives directly (not object references)
    pageIndex,
    pageSize,
  ]);

  // Permissions now come from server-side in V2 API
  // No need for client-side permission logic

  const handleDelete = async () => {
    if (!deleteItem || !deleteSimulationAction) return;

    setIsDeleting(true);
    try {
      await deleteSimulationAction({ body: { simulation_id: deleteItem.id } });
      toast.success("Simulation deleted successfully");
      router.refresh();
    } catch {
      toast.error("Failed to delete simulation");
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
    router.push(`/create/simulations/s/${id}`);
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
    } catch {
      toast.error("Failed to duplicate simulation");
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
            <div className="mt-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">
                  <Timer className="h-3 w-3 mr-1" />
                  {simulation.time_limit
                    ? `${simulation.time_limit} minutes`
                    : "No time limit"}
                </Badge>
                {simulation.practice_simulation && (
                  <Badge variant="default" className="text-xs">
                    Practice
                  </Badge>
                )}
              </div>
              {!simulation.active && (
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">Inactive</Badge>
                </div>
              )}
            </div>
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
  const nameColumn = table.getColumn("name");
  const rubricColumn = table.getColumn("rubric_id");
  const cohortColumn = table.getColumn("cohort_ids");
  const departmentsColumn = table.getColumn("departments");
  const isFiltered = table.getState().columnFilters.length > 0;

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
                    value={(nameColumn?.getFilterValue() as string) ?? ""}
                    onChange={(event) =>
                      nameColumn?.setFilterValue(event.target.value)
                    }
                    className="h-8 w-full md:w-[150px] lg:w-[250px] pl-8"
                    aria-label="Search simulations by name"
                    aria-controls="simulations-grid"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2 flex-wrap">
                {/* Rubric Filter */}
                {rubricColumn && rubricOptions.length > 0 && (
                  <DataTableFacetedFilter
                    column={rubricColumn}
                    title="Rubric"
                    options={rubricOptions}
                  />
                )}

                {/* Cohort Filter */}
                {cohortColumn && cohortOptions.length > 0 && (
                  <DataTableFacetedFilter
                    column={cohortColumn}
                    title="Cohort"
                    options={cohortOptions}
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
            aria-label="simulations grid"
            data-testid="simulations-grid"
          >
            {tableRows.length ? (
              tableRows.map((row) => (
                <div key={row.id}>{renderSimulationCard(row.original)}</div>
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
      </div>
    </TooltipProvider>
  );
}
