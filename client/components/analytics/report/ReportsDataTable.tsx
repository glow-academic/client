"use client";

import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import * as React from "react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { TAPerformanceData } from "@/hooks/use-report-columns";
import { ReportsDataTableToolbar } from "./ReportsDataTableToolbar";

export interface ReportsDataTableProps {
  columns: ColumnDef<TAPerformanceData>[];
  data: TAPerformanceData[];
  performanceOptions: { value: string; label: string }[];
  cohortOptions: { value: string; label: string }[];
  agentOptions: { value: string; label: string }[];
  scenarioOptions: { value: string; label: string }[];
  simulationOptions: { value: string; label: string }[];
  showExport?: boolean;
}

export function ReportsDataTable({
  columns,
  data,
  performanceOptions,
  cohortOptions,
  agentOptions,
  scenarioOptions,
  simulationOptions,
  showExport = true,
}: ReportsDataTableProps) {
  const [rowSelection, setRowSelection] = React.useState({});
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({
      agentsTested: false,
      scenarioIds: false,
      simulationIds: false,
      // Hide these columns by default
      totalAttempts: false,
      lastActivity: false,
      completionRate: false,
      avgTimeMinutes: false,
      passRate: false,
    });
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  );
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: "avgScore", desc: true }, // Default sort by score descending
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
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  });

  return (
    <div className="space-y-2">
      <ReportsDataTableToolbar
        table={table}
        performanceOptions={performanceOptions}
        cohortOptions={cohortOptions}
        agentOptions={agentOptions}
        scenarioOptions={scenarioOptions}
        simulationOptions={simulationOptions}
        showExport={showExport}
      />
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="h-8">
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead
                      key={header.id}
                      colSpan={header.colSpan}
                      className={`border-r py-1 text-xs text-center ${
                        header.id === "select" ? "w-12" : ""
                      } ${header.column.getCanSort() ? "pl-4" : ""}`}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className={`h-8 ${
                    row.original.isStruggling
                      ? "bg-orange-50/50 border-orange-200"
                      : "hover:bg-muted/30"
                  } transition-colors`}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={`border-r px-2 py-1 text-center ${
                        cell.column.id === "select" ? "w-12" : ""
                      }`}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center px-6"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
