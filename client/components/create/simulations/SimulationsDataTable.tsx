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
  SimulationItem,
} from "@/lib/api/v2/schemas/simulations";
import { SimulationsDataTableToolbar } from "./SimulationsDataTableToolbar";
import { RubricMapping, ScenarioMapping } from "@/lib/api/v2/schemas/base";

export interface SimulationsDataTableProps {
  data: SimulationItem[];
  scenarioMapping: ScenarioMapping;
  rubricMapping: RubricMapping;
  scenarioOptions: { value: string; label: string }[];
  rubricOptions: { value: string; label: string }[];
  timeLimitOptions: { value: string; label: string }[];
  renderSimulationCard: (simulation: SimulationItem) => React.ReactNode;
}

export function SimulationsDataTable({
  data,
  scenarioOptions,
  rubricOptions,
  timeLimitOptions,
  renderSimulationCard,
}: SimulationsDataTableProps) {
  // Minimal columns for filtering/sorting only (card view, no table)
  const columns: ColumnDef<SimulationItem>[] = React.useMemo(
    () => [
      {
        accessorKey: "name",
        header: "Name",
      },
      {
        accessorKey: "scenario_ids",
        header: "Scenarios",
      },
      {
        accessorKey: "rubric_id",
        header: "Rubric",
      },
      {
        accessorKey: "time_limit",
        header: "Time Limit",
      },
    ],
    []
  );
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
        pageSize: 12, // Default to 12 items per page for card layout
      },
    },
  });

  return (
    <div className="space-y-4">
      <SimulationsDataTableToolbar
        table={table}
        scenarioOptions={scenarioOptions}
        rubricOptions={rubricOptions}
        timeLimitOptions={timeLimitOptions}
      />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {table.getRowModel().rows.map((row) => (
          <div key={row.id}>{renderSimulationCard(row.original)}</div>
        ))}
        {table.getRowModel().rows.length === 0 && (
          <div className="col-span-full text-center py-8">
            <p className="text-muted-foreground">No simulations found.</p>
          </div>
        )}
      </div>
      <DataTablePagination table={table} card={true} />
    </div>
  );
}
