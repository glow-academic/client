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
import { RubricMapping, ScenarioMapping } from "@/lib/api/v2/schemas/base";
import { SimulationItem } from "@/lib/api/v2/schemas/simulations";
import { SimulationsDataTableToolbar } from "./SimulationsDataTableToolbar";

export interface SimulationsDataTableProps {
  data: SimulationItem[];
  scenarioMapping: ScenarioMapping;
  rubricMapping: RubricMapping;
  scenarioOptions: { value: string; label: string }[];
  rubricOptions: { value: string; label: string }[];
  timeLimitOptions: { value: string; label: string }[];
  departmentOptions?: { value: string; label: string }[];
  renderSimulationCard: (simulation: SimulationItem) => React.ReactNode;
}

export function SimulationsDataTable({
  data,
  scenarioOptions,
  rubricOptions,
  timeLimitOptions,
  departmentOptions = [],
  renderSimulationCard,
}: SimulationsDataTableProps) {
  // Minimal columns for filtering/sorting only (card view, no table)
  const columns: ColumnDef<SimulationItem>[] = React.useMemo(
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
        // Return the array of scenario IDs for this row
        accessorFn: (row: SimulationItem) => row.scenario_ids ?? [],
        // Let filtering check membership - show if simulation contains ANY selected scenario
        filterFn: (row, _id, value: string[]) => {
          const rowIds = (row.getValue("scenario_ids") as string[]) ?? [];
          return value.some((v) => rowIds.includes(v));
        },
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
      // Hidden faceting column for Time Limit (categorical)
      {
        id: "time_limit_category",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        // Convert time_limit (seconds) to category
        accessorFn: (row: SimulationItem) => {
          const seconds = row.time_limit;
          if (seconds === null) return "no-limit";
          if (seconds <= 1800) return "0-30"; // 0-30 minutes
          if (seconds <= 3600) return "30-60"; // 30-60 minutes
          if (seconds <= 7200) return "60-120"; // 60-120 minutes
          return "120+"; // 120+ minutes
        },
      },
      // Hidden faceting column for Departments (array of IDs)
      {
        id: "departments",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: SimulationItem) => row.department_ids ?? [],
        filterFn: (row, _id, value: string[]) => {
          const rowIds = (row.getValue("departments") as string[]) ?? [];
          if (value.length === 0) return true;
          if (rowIds.length === 0) return true; // Show cross-department items when no filter
          return value.some((v) => rowIds.includes(v));
        },
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
        departmentOptions={departmentOptions}
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
