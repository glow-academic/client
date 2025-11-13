/**
 * Scenarios.tsx
 * Used to display the scenarios page with table-based filtering and card layout.
 * @AshokSaravanan222 & @siladiea
 * 06/07/2025
 */
"use client";
import {
  ChevronDown,
  ChevronRight,
  Copy,
  Edit,
  Eye,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import type {
  DeleteScenarioIn,
  DeleteScenarioOut,
  DuplicateScenarioIn,
  DuplicateScenarioOut,
  ScenariosListOut,
} from "@/app/(main)/create/scenarios/page";
import { DataTableFacetedFilter } from "@/components/common/history/DataTableFacetedFilter";
import { DataTablePagination } from "@/components/common/history/DataTablePagination";
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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

export interface ScenariosProps {
  // Server-provided data (for server-side rendering)
  listData: ScenariosListOut;
  // Server actions (replaces useMutation)
  duplicateScenarioAction?: (
    input: DuplicateScenarioIn
  ) => Promise<DuplicateScenarioOut>;
  deleteScenarioAction?: (
    input: DeleteScenarioIn
  ) => Promise<DeleteScenarioOut>;
}

export function Scenarios({
  listData: serverListData,
  duplicateScenarioAction,
  deleteScenarioAction,
}: ScenariosProps) {
  const router = useRouter();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteItem, setDeleteItem] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
    new Set()
  );

  // Table state
  const [rowSelection, setRowSelection] = useState({});
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = useState<SortingState>([
    { id: "updatedAt", desc: true },
  ]);

  // Use server-provided data directly
  const scenariosData = serverListData;

  // Extract data from response
  const scenarios = useMemo(
    () => scenariosData?.scenarios || [],
    [scenariosData?.scenarios]
  );
  const personaMapping = useMemo(
    () => scenariosData?.persona_mapping || {},
    [scenariosData?.persona_mapping]
  );

  // Define GroupedScenario type based on scenarios
  type GroupedScenario = {
    parent: (typeof scenarios)[number];
    children: (typeof scenarios)[number][];
  };

  // Group scenarios using parent_scenario_id from V2 API
  const groupedScenarios = useMemo(() => {
    const groups: GroupedScenario[] = [];

    // Find root scenarios (no parent)
    const roots = scenarios.filter((s) => !s.parent_scenario_id);

    roots.forEach((parent) => {
      const children = scenarios.filter(
        (s) => s.parent_scenario_id === parent.scenario_id
      );
      groups.push({ parent, children });
    });

    return groups;
  }, [scenarios]);

  // Use server-provided facet options directly (no client-side computation)
  const personaOptions = useMemo(
    () =>
      (scenariosData?.persona_options || [])
        .map((opt) => ({
          value: opt["value"] as string,
          label: opt["label"] as string,
        }))
        .filter((opt) => opt.value && opt.label),
    [scenariosData?.persona_options]
  );
  const simulationOptions = useMemo(
    () =>
      (scenariosData?.simulation_options || [])
        .map((opt) => ({
          value: opt["value"] as string,
          label: opt["label"] as string,
        }))
        .filter((opt) => opt.value && opt.label),
    [scenariosData?.simulation_options]
  );
  const departmentOptions = useMemo(
    () =>
      (scenariosData?.department_options || [])
        .map((opt) => ({
          value: opt["value"] as string,
          label: opt["label"] as string,
        }))
        .filter((opt) => opt.value && opt.label),
    [scenariosData?.department_options]
  );

  // Define table columns inline
  const columns: ColumnDef<(typeof scenarios)[number]>[] = useMemo(() => {
    return [
      {
        accessorKey: "title",
        header: "Title",
        cell: ({ row }) => {
          return (
            <div className="font-medium">
              {row.original.title || "Unnamed Scenario"}
            </div>
          );
        },
      },
      {
        accessorKey: "problem_statement",
        header: "Problem Statement",
        cell: ({ row }) => {
          return (
            <div className="text-sm text-muted-foreground line-clamp-2">
              {row.original.problem_statement || "No problem statement"}
            </div>
          );
        },
      },
      // Hidden faceting column for Persona (array of IDs)
      {
        id: "persona_id",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: (typeof scenarios)[number]) => row.persona_ids ?? [],
        filterFn: (row, _id, value: string[]) => {
          const rowIds = (row.getValue("persona_id") as string[]) ?? [];
          if (value.length === 0) return true;
          if (rowIds.length === 0) return true; // Show items with no personas when no filter
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
        accessorFn: (row: (typeof scenarios)[number]) =>
          row.simulation_ids ?? [],
        filterFn: (row, _id, value: string[]) => {
          const rowIds = (row.getValue("simulation_ids") as string[]) ?? [];
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
        accessorFn: (row: (typeof scenarios)[number]) =>
          row.department_ids ?? [],
        filterFn: (row, _id, value: string[]) => {
          const rowIds = (row.getValue("departments") as string[]) ?? [];
          if (value.length === 0) return true;
          if (rowIds.length === 0) return true; // Show cross-department items when no filter
          return value.some((v) => rowIds.includes(v));
        },
      },
      {
        id: "persona_display",
        accessorFn: (row: (typeof scenarios)[number]) =>
          row.persona_ids?.[0] ?? null,
        header: "Persona",
        cell: ({ row }) => {
          const personaIds = row.original.persona_ids ?? [];
          const personaId = personaIds[0]; // TODO: Handle multiple personas
          return (
            <div className="text-sm">
              {personaId && personaMapping[personaId] ? (
                <span className="text-sm">
                  {personaMapping[personaId].name}
                </span>
              ) : (
                <span className="text-muted-foreground">No persona</span>
              )}
            </div>
          );
        },
      },
    ];
  }, [personaMapping]);

  // Create parent scenarios for table (root scenarios only)
  const parentScenarios = useMemo(() => {
    return scenarios.filter((scenario) => !scenario.parent_scenario_id);
  }, [scenarios]);

  // Create table instance
  const table = useReactTable({
    data: parentScenarios,
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
        pageSize: 10,
      },
    },
  });

  // Get the current page's parent scenario IDs
  const currentPageRows = table.getRowModel().rows;
  const orderedParentIds = useMemo(() => {
    return currentPageRows.map((row) => row.original.scenario_id);
  }, [currentPageRows]);

  // Group the current page scenarios in the exact order of the table's sorting
  const currentPageGroupedScenarios = useMemo(() => {
    const groups: GroupedScenario[] = [];

    for (const parentId of orderedParentIds) {
      const parent = scenarios.find(
        (scenario) =>
          !scenario.parent_scenario_id && scenario.scenario_id === parentId
      );
      if (!parent) continue;

      // Find children using parent_scenario_id from V2 API
      const children = scenarios.filter(
        (s) => s.parent_scenario_id === parentId
      );

      groups.push({ parent, children });
    }

    return groups;
  }, [scenarios, orderedParentIds]);

  // Permissions now come from server-side in V2 API
  // No need for client-side permission logic

  const handleDelete = async () => {
    if (!deleteItem || !deleteScenarioAction) return;

    setIsDeleting(true);
    try {
      await deleteScenarioAction({ body: { scenarioId: deleteItem.id } });
      toast.success("Scenario deleted successfully");
      router.refresh();
    } catch {
      toast.error("Failed to delete scenario");
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
      setDeleteItem(null);
    }
  };

  const handleDuplicate = async (scenarioId: string, scenarioName: string) => {
    if (!duplicateScenarioAction) return;

    setIsDuplicating(scenarioId);
    try {
      await duplicateScenarioAction({ body: { scenarioId } });
      toast.success(`Scenario "${scenarioName}" duplicated successfully`);
      router.refresh();
    } catch {
      toast.error("Failed to duplicate scenario");
    } finally {
      setIsDuplicating(null);
    }
  };

  const handleDeleteClick = (id: string, name: string) => {
    setDeleteItem({ id, name });
    setShowDeleteDialog(true);
  };

  const handleEdit = (id: string) => {
    router.push(`/create/scenarios/s/${id}`);
  };

  const handleView = (id: string) => {
    router.push(`/create/scenarios/s/${id}`);
  };

  const toggleGroupCollapse = (parentId: string) => {
    setCollapsedGroups((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(parentId)) {
        newSet.delete(parentId);
      } else {
        newSet.add(parentId);
      }
      return newSet;
    });
  };

  const renderScenarioCard = (
    scenario: (typeof scenarios)[number],
    isChild: boolean = false,
    showDropdown?: boolean,
    isCollapsed?: boolean,
    onToggleCollapse?: () => void
  ) => (
    <Card
      key={scenario.scenario_id}
      data-testid="scenario-card"
      className={`hover:shadow-md transition-shadow flex flex-col h-full ${
        isChild ? "ml-8 border-l-2 border-l-blue-200" : ""
      }`}
    >
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div className="space-y-2 flex-1">
            <div className="flex items-center gap-2">
              {showDropdown && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 hover:bg-muted flex-shrink-0 -ml-1"
                  onClick={onToggleCollapse}
                >
                  {isCollapsed ? (
                    <ChevronRight className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              )}
              <CardTitle className="text-lg flex-1 min-w-0">
                {scenario.title || "Unnamed Scenario"}
              </CardTitle>
              <div className="flex gap-1 flex-wrap flex-shrink-0">
                {!scenario.generated &&
                  !(scenario.department_ids?.length === 0) &&
                  !scenario.active && (
                    <Badge variant="secondary">Inactive</Badge>
                  )}
              </div>
            </div>
          </div>
          <div className="flex gap-2 items-center ml-4">
            {scenario.generated ? (
              // For generated scenarios: only show preview and duplicate
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      data-testid="btn-view-scenario"
                      onClick={() => handleView(scenario.scenario_id)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>View Scenario Details</p>
                  </TooltipContent>
                </Tooltip>
                {scenario.can_duplicate && (
                  <Button
                    variant="outline"
                    size="sm"
                    data-testid="btn-duplicate-scenario"
                    onClick={() =>
                      handleDuplicate(scenario.scenario_id, scenario.title)
                    }
                    disabled={isDuplicating === scenario.scenario_id}
                  >
                    <Copy className="h-4 w-4" />
                    {isDuplicating === scenario.scenario_id ? "..." : ""}
                  </Button>
                )}
              </>
            ) : (
              // For non-generated scenarios: show edit, duplicate, and delete
              <>
                {scenario.can_edit ? (
                  <Button
                    variant="outline"
                    size="sm"
                    data-testid="btn-edit-scenario"
                    onClick={() => handleEdit(scenario.scenario_id)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                ) : (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        data-testid="btn-view-scenario"
                        onClick={() => handleView(scenario.scenario_id)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>View Scenario Details</p>
                    </TooltipContent>
                  </Tooltip>
                )}
                {scenario.can_duplicate && (
                  <Button
                    variant="outline"
                    size="sm"
                    data-testid="btn-duplicate-scenario"
                    onClick={() =>
                      handleDuplicate(scenario.scenario_id, scenario.title)
                    }
                    disabled={isDuplicating === scenario.scenario_id}
                  >
                    <Copy className="h-4 w-4" />
                    {isDuplicating === scenario.scenario_id ? "..." : ""}
                  </Button>
                )}

                {scenario.can_delete && (
                  <Button
                    variant="outline"
                    size="sm"
                    data-testid="btn-delete-scenario"
                    onClick={() =>
                      handleDeleteClick(
                        scenario.scenario_id,
                        scenario.title || "Unnamed Scenario"
                      )
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 flex-grow flex flex-col justify-end">
        <p className="text-sm text-muted-foreground line-clamp-2">
          {scenario.problem_statement ||
            "Scenario will be dynamically generated."}
        </p>
        {!isChild && (
          <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
            <Users className="h-3 w-3" />
            {scenario.num_simulations} simulations
          </div>
        )}
      </CardContent>
    </Card>
  );

  const renderGroupedScenarios = (filteredGroups?: GroupedScenario[]) => {
    const groupsToRender = filteredGroups || groupedScenarios;

    return groupsToRender.map((group) => {
      const isCollapsed = collapsedGroups.has(group.parent.scenario_id);
      const hasChildren = group.children.length > 0;

      return (
        <div key={group.parent.scenario_id} className="space-y-2">
          {/* Parent Scenario Card */}
          {renderScenarioCard(
            group.parent,
            false,
            hasChildren,
            isCollapsed,
            () => toggleGroupCollapse(group.parent.scenario_id)
          )}

          {/* Child Scenarios */}
          {hasChildren && !isCollapsed && (
            <div className="space-y-2">
              {group.children.map((child) => renderScenarioCard(child, true))}
            </div>
          )}
        </div>
      );
    });
  };

  // Get column references for toolbar
  const titleColumn = table.getColumn("title");
  const personaColumn = table.getColumn("persona_id");
  const simulationColumn = table.getColumn("simulation_ids");
  const departmentsColumn = table.getColumn("departments");
  const isFiltered = table.getState().columnFilters.length > 0;

  return (
    <TooltipProvider>
      <div className="space-y-8" data-page="scenarios-index">
        <div className="space-y-4">
          {/* Toolbar */}
          <div
            className="flex items-center justify-between"
            data-testid="scenarios-toolbar"
          >
            <div className="flex flex-1 items-center space-x-2 flex-wrap">
              <div className="mb-2">
                <Input
                  data-testid="scenarios-search"
                  placeholder="Search scenarios..."
                  value={(titleColumn?.getFilterValue() as string) ?? ""}
                  onChange={(event) =>
                    titleColumn?.setFilterValue(event.target.value)
                  }
                  className="h-8 w-[150px] lg:w-[250px]"
                  aria-label="Search scenarios by name"
                  aria-controls="scenarios-grid"
                />
              </div>

              <div className="flex items-center space-x-2 flex-wrap mb-2">
                {/* Simulation Filter */}
                {simulationColumn && simulationOptions.length > 0 && (
                  <DataTableFacetedFilter
                    column={simulationColumn}
                    title="Simulation"
                    options={simulationOptions}
                  />
                )}

                {/* Persona Filter */}
                {personaColumn && personaOptions.length > 0 && (
                  <DataTableFacetedFilter
                    column={personaColumn}
                    title="Persona"
                    options={personaOptions}
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
                    className="h-8 px-2 lg:px-3"
                  >
                    Reset
                    <X className="ml-2 h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Grouped Scenarios */}
          <div
            className="space-y-4"
            role="grid"
            aria-label="scenarios grid"
            data-testid="scenarios-grid"
          >
            {table.getRowModel().rows.length ? (
              renderGroupedScenarios(currentPageGroupedScenarios)
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No scenarios match the current filters.
              </div>
            )}
          </div>

          {/* Pagination */}
          <DataTablePagination table={table} />
        </div>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent
            aria-labelledby="delete-scenario-title"
            data-testid="dialog-delete-scenario"
          >
            <AlertDialogHeader>
              <AlertDialogTitle id="delete-scenario-title">
                Delete Scenario
              </AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete the scenario "{deleteItem?.name}
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
                className="bg-red-600 hover:bg-red-700 text-white"
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
