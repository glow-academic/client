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
import { Scenario } from "@/types";
import { ScenariosDataTableToolbar } from "./ScenariosDataTableToolbar";

export interface ScenariosDataTableProps {
  columns: ColumnDef<Scenario>[];
  data: Scenario[];
  simulationOptions: { value: string; label: string }[];
  cohortOptions: { value: string; label: string }[];
  personaOptions: { value: string; label: string }[];
  renderGroupedScenarios: (
    filteredGroups?: { parent: Scenario; children: Scenario[] }[],
  ) => React.ReactNode;
}

export function ScenariosDataTable({
  columns,
  data,
  simulationOptions,
  cohortOptions,
  personaOptions,
  renderGroupedScenarios,
}: ScenariosDataTableProps) {
  const [rowSelection, setRowSelection] = React.useState({});
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({});
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    [],
  );
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: "updatedAt", desc: true }, // Default to descending order by date
  ]);

  // Create a table with parent scenarios only for pagination
  const parentScenarios = React.useMemo(() => {
    return data.filter((scenario) => !scenario.generated);
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
    return currentPageRows.map((row) => row.original.id);
  }, [currentPageRows]);

  // Group the current page scenarios in the exact order of the table's sorting
  const currentPageGroupedScenarios = React.useMemo(() => {
    const groups: { parent: Scenario; children: Scenario[] }[] = [];

    for (const parentId of orderedParentIds) {
      const parent = data.find(
        (scenario) => !scenario.generated && scenario.id === parentId,
      );
      if (!parent) continue;

      // Note: parentId removed in BCNF migration, hierarchy now in scenario_tree junction
      // TODO: Load children from scenario_tree if grouping is needed
      const children = data.filter(() => false); // No automatic grouping for now

      groups.push({ parent, children });
    }

    return groups;
  }, [data, orderedParentIds]);

  return (
    <div className="space-y-4">
      <ScenariosDataTableToolbar
        table={table}
        simulationOptions={simulationOptions}
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
