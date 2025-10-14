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
import type { LogItem } from "@/lib/api/v2/schemas/logs";
import type { DateRange } from "react-day-picker";
import { LogsDataTableToolbar } from "./LogsDataTableToolbar";

export interface LogsDataTableProps {
  data: LogItem[];
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
  onViewLog: (log: LogItem) => void;
}

export function LogsDataTable({
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
  onViewLog,
}: LogsDataTableProps) {
  const [rowSelection, setRowSelection] = React.useState({});
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({
      log_id: false,
      correlation_id: false,
      context_provider: false,
      context_model: false,
      context_function: false,
    });
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  );
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: "created_at", desc: true }, // Default to descending order by date
  ]);

  // Define columns inline with proper JSONB access
  const columns = React.useMemo<ColumnDef<LogItem>[]>(
    () => [
      {
        accessorKey: "log_id",
        header: "ID",
      },
      {
        accessorKey: "event",
        header: "Event",
      },
      {
        accessorKey: "level",
        header: "Level",
      },
      {
        accessorKey: "actor_name",
        header: "Actor",
      },
      {
        id: "context_component",
        accessorFn: (row) => row.context?.component || "",
        header: "Component",
      },
      {
        id: "context_function",
        accessorFn: (row) => row.context?.function || "",
        header: "Function",
      },
      {
        id: "context_provider",
        accessorFn: (row) => row.context?.provider || "",
        header: "Provider",
      },
      {
        id: "context_model",
        accessorFn: (row) => row.context?.model || "",
        header: "Model",
      },
      {
        accessorKey: "correlation_id",
        header: "Correlation ID",
      },
      {
        accessorKey: "created_at",
        header: "Created At",
        cell: ({ row }) => {
          const date = row.getValue("created_at") as string;
          return new Date(date).toLocaleString();
        },
      },
    ],
    []
  );

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
        log_id: false,
        correlation_id: false,
        context_provider: false,
        context_model: false,
        context_function: false,
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
        onViewLog={onViewLog}
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
