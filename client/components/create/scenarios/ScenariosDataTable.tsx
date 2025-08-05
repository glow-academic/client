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
    filteredGroups?: { parent: Scenario; children: Scenario[] }[]
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
    []
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
  const currentPageParentIds = React.useMemo(() => {
    return new Set(currentPageRows.map((row) => row.original.id));
  }, [currentPageRows]);

  // Get all scenarios that should be shown on current page
  const currentPageScenarios = React.useMemo(() => {
    const parentScenariosOnPage = data.filter(
      (scenario) => !scenario.generated && currentPageParentIds.has(scenario.id)
    );

    const childScenariosOnPage = data.filter(
      (scenario) =>
        scenario.generated &&
        scenario.parentId &&
        currentPageParentIds.has(scenario.parentId)
    );

    return [...parentScenariosOnPage, ...childScenariosOnPage];
  }, [data, currentPageParentIds]);

  // Group the current page scenarios
  const currentPageGroupedScenarios = React.useMemo(() => {
    const groups: { parent: Scenario; children: Scenario[] }[] = [];
    const parentMap = new Map<string, Scenario>();
    const childMap = new Map<string, Scenario[]>();

    // First pass: identify parents and collect children
    currentPageScenarios.forEach((scenario) => {
      if (scenario.generated && scenario.parentId) {
        // This is a generated scenario with a parent
        if (!childMap.has(scenario.parentId)) {
          childMap.set(scenario.parentId, []);
        }
        childMap.get(scenario.parentId)!.push(scenario);
      } else if (!scenario.generated) {
        // This is a parent scenario
        parentMap.set(scenario.id, scenario);
      }
    });

    // Second pass: create groups
    parentMap.forEach((parent) => {
      const children = childMap.get(parent.id) || [];
      groups.push({ parent, children });
    });

    // Add standalone generated scenarios (those without parents or with missing parents)
    currentPageScenarios.forEach((scenario) => {
      if (
        scenario.generated &&
        (!scenario.parentId || !parentMap.has(scenario.parentId))
      ) {
        groups.push({ parent: scenario, children: [] });
      }
    });

    return groups;
  }, [currentPageScenarios]);

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
