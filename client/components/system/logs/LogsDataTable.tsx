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
import { AppLog } from "@/hooks/use-log-columns";
import type { DateRange } from "react-day-picker";
import { LogsDataTableToolbar } from "./LogsDataTableToolbar";

export interface LogsDataTableProps {
  columns: ColumnDef<AppLog>[];
  data: AppLog[];
  levelOptions: { value: string; label: string }[];
  onRefresh: () => void;
  isRefreshing: boolean;
  eventOptions: { value: string; label: string }[];
  providerOptions: { value: string; label: string }[];
  modelOptions: { value: string; label: string }[];
  actorOptions: { value: string; label: string }[];
  componentOptions: { value: string; label: string }[];
  functionOptions: { value: string; label: string }[];
  dateRange: DateRange | undefined;
  setDateRange: (range: DateRange | undefined) => void;
  onBulkDelete: () => void;
}

export function LogsDataTable({
  columns,
  data,
  levelOptions,
  onRefresh,
  isRefreshing,
  eventOptions,
  providerOptions,
  modelOptions,
  actorOptions,
  componentOptions,
  functionOptions,
  dateRange,
  setDateRange,
  onBulkDelete,
}: LogsDataTableProps) {
  const [rowSelection, setRowSelection] = React.useState({});
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({
      id: false,
      durationMs: false,
      hasError: false,
      correlationId: false,
      provider: false,
      model: false,
      function: false,
    });
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    [],
  );
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: "createdAt", desc: true }, // Default to descending order by date
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
        pageSize: 20,
      },
      columnVisibility: {
        message: false,
        correlationId: false,
        durationMs: false,
        provider: false,
        model: false,
        context: false,
      } as VisibilityState,
    },
  });

  return (
    <div className="space-y-4">
      <LogsDataTableToolbar
        table={table}
        levelOptions={levelOptions}
        eventOptions={eventOptions}
        providerOptions={providerOptions}
        modelOptions={modelOptions}
        actorOptions={actorOptions}
        componentOptions={componentOptions}
        functionOptions={functionOptions}
        dateRange={dateRange}
        setDateRange={setDateRange}
        onRefresh={onRefresh}
        isRefreshing={isRefreshing}
        onBulkDelete={onBulkDelete}
      />
      <div className="border rounded-lg">
        <table className="w-full">
          <thead className="bg-muted/50">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-4 py-3 text-left text-sm font-medium"
                  >
                    {header.isPlaceholder
                      ? null
                      : typeof header.column.columnDef.header === "string"
                        ? header.column.columnDef.header
                        : header.column.columnDef.header?.(header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b hover:bg-muted/50 transition-colors"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3 text-sm">
                      {typeof cell.column.columnDef.cell === "function"
                        ? cell.column.columnDef.cell(cell.getContext())
                        : cell.getValue()}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  No logs match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <DataTablePagination table={table} />
    </div>
  );
}
