"use client";

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
import * as React from "react";

import { DataTablePagination } from "@/components/common/history/DataTablePagination";
import {
  ScenarioItem,
} from "@/lib/api/v2/schemas/scenarios";
import { ScenariosDataTableToolbar } from "./ScenariosDataTableToolbar";
import { CohortMapping, ParameterItemMapping, PersonaMapping } from "@/lib/api/v2/schemas/base";

export interface ScenariosDataTableProps {
  columns: ColumnDef<ScenarioItem>[];
  data: ScenarioItem[];
  personaMapping: PersonaMapping;
  cohortMapping: CohortMapping;
  parameterItemMapping: ParameterItemMapping;
  personaOptions: { value: string; label: string }[];
  cohortOptions: { value: string; label: string }[];
  renderGroupedScenarios: (
    filteredGroups?: { parent: ScenarioItem; children: ScenarioItem[] }[]
  ) => React.ReactNode;
}

export function ScenariosDataTable({
  columns,
  data,
  personaOptions,
  cohortOptions,
  renderGroupedScenarios,
}: ScenariosDataTableProps) {
  const [rowSelection, setRowSelection] = React.useState({});
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({});
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  );
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: "updatedAt", desc: true }, // Default to descending order by date
  ]);

  // Create a table with parent scenarios only for pagination (root scenarios, not children)
  const parentScenarios = React.useMemo(() => {
    return data.filter((scenario) => !scenario.parent_scenario_id);
  }, [data]);

  const table = useReactTable({
    data: parentScenarios, // Use parent scenarios for pagination
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
  const orderedParentIds = React.useMemo(() => {
    return currentPageRows.map((row) => row.original.scenario_id);
  }, [currentPageRows]);

  // Group the current page scenarios in the exact order of the table's sorting
  const currentPageGroupedScenarios = React.useMemo(() => {
    const groups: { parent: ScenarioItem; children: ScenarioItem[] }[] = [];

    for (const parentId of orderedParentIds) {
      const parent = data.find(
        (scenario) =>
          !scenario.parent_scenario_id && scenario.scenario_id === parentId
      );
      if (!parent) continue;

      // Find children using parent_scenario_id from V2 API
      const children = data.filter((s) => s.parent_scenario_id === parentId);

      groups.push({ parent, children });
    }

    return groups;
  }, [data, orderedParentIds]);

  return (
    <div className="space-y-4">
      <ScenariosDataTableToolbar
        table={table}
        cohortOptions={cohortOptions}
        personaOptions={personaOptions}
      />
      <div className="space-y-4">
        {table.getRowModel().rows.length ? (
          renderGroupedScenarios(currentPageGroupedScenarios)
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            No scenarios match the current filters.
          </div>
        )}
      </div>
      <DataTablePagination table={table} />
    </div>
  );
}
