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
  scenarioTypeOptions: { value: string; label: string }[];
  renderScenarioCard: (scenario: Scenario) => React.ReactNode;
}

export function ScenariosDataTable({
  columns,
  data,
  simulationOptions,
  cohortOptions,
  personaOptions,
  scenarioTypeOptions,
  renderScenarioCard,
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

  const table = useReactTable({
    data,
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

  return (
    <div className="space-y-4">
      <ScenariosDataTableToolbar
        table={table}
        simulationOptions={simulationOptions}
        cohortOptions={cohortOptions}
        personaOptions={personaOptions}
        scenarioTypeOptions={scenarioTypeOptions}
      />
      <div className="grid gap-4">
        {table.getRowModel().rows.length ? (
          table
            .getRowModel()
            .rows.map((row) => renderScenarioCard(row.original))
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
