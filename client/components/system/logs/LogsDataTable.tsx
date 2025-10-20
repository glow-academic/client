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

import { DataTableColumnHeader } from "@/components/common/history/DataTableColumnHeader";
import { DataTablePagination } from "@/components/common/history/DataTablePagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { LogItem } from "@/lib/api/v2/schemas/logs";
import { formatTimestamp, getLogLevelVariant } from "@/utils/logs/log-utils";
import { FileText } from "lucide-react";
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
  dateOptions: { value: string; label: string }[];
  timeOptions: { value: string; label: string }[];
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
  dateOptions,
  timeOptions,
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
      created_time: false,
    });
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  );
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: "created_at", desc: true }, // Default to descending order by date
  ]);

  // Define columns with rich visual styling
  const columns = React.useMemo<ColumnDef<LogItem>[]>(
    () => [
      {
        accessorKey: "created_at",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Created At" />
        ),
        cell: ({ row }) => (
          <div className="text-sm">
            {formatTimestamp(row.getValue("created_at"))}
          </div>
        ),
        enableSorting: true,
        filterFn: (row, id, value) => {
          if (!value || value.length === 0) return true;
          const created = row.getValue(id) as string | null;
          if (!created) return false;
          const date = new Date(created);
          const dateStr = `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}`;
          return value.includes(dateStr);
        },
      },
      {
        id: "created_time",
        accessorFn: (row) => {
          if (!row.created_at) return null;
          return String(new Date(row.created_at).getHours());
        },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Time (Hour)" />
        ),
        cell: ({ row }) => {
          const hour = row.getValue("created_time") as string | null;
          if (!hour) return <span className="text-muted-foreground">N/A</span>;
          return <div className="text-sm">{`${hour.padStart(2, "0")}:00`}</div>;
        },
        enableSorting: true,
        filterFn: (row, id, value) => {
          if (!value || value.length === 0) return true;
          const hour = row.getValue(id) as string | null;
          return hour ? value.includes(hour) : false;
        },
      },
      {
        accessorKey: "log_id",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="ID" />
        ),
        cell: ({ row }) => (
          <div className="font-medium">{row.getValue("log_id")}</div>
        ),
        enableSorting: true,
      },
      {
        accessorKey: "event",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Event" />
        ),
        cell: ({ row }) => {
          const event = row.getValue("event") as string;
          return (
            <span className="truncate max-w-xs inline-block">{event}</span>
          );
        },
        filterFn: (row, id, value) => {
          if (!value || value.length === 0) return true;
          const event = (row.getValue(id) as string) ?? "";
          return value.includes(event);
        },
        enableSorting: true,
      },
      {
        accessorKey: "level",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Level" />
        ),
        cell: ({ row }) => {
          const level = row.getValue("level") as string;
          return (
            <Badge variant={getLogLevelVariant(level)}>
              {level.toUpperCase()}
            </Badge>
          );
        },
        filterFn: (row, id, value) => {
          return value.includes(row.getValue(id));
        },
        enableSorting: true,
      },
      {
        accessorKey: "actor_name",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Actor" />
        ),
        cell: ({ row }) => {
          const actorName = row.getValue("actor_name") as string | null;
          return actorName ? (
            <span className="font-mono text-xs">{actorName}</span>
          ) : (
            <span className="text-muted-foreground">N/A</span>
          );
        },
        filterFn: (row, id, value) => {
          if (!value || value.length === 0) return true;
          const v = (row.getValue(id) as string | null) ?? "";
          return value.includes(v);
        },
        enableSorting: true,
      },
      {
        id: "context_component",
        accessorFn: (row) => row.context?.component || null,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Component" />
        ),
        cell: ({ row }) => {
          const v =
            (row.getValue("context_component") as string | null) ?? null;
          return v ? v : <span className="text-muted-foreground">N/A</span>;
        },
        filterFn: (row, id, value) => {
          if (!value || value.length === 0) return true;
          const v = (row.getValue(id) as string | null) ?? "";
          return value.includes(v);
        },
        enableSorting: true,
      },
      {
        id: "context_function",
        accessorFn: (row) => row.context?.function || null,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Function" />
        ),
        cell: ({ row }) => {
          const v = (row.getValue("context_function") as string | null) ?? null;
          return v ? v : <span className="text-muted-foreground">N/A</span>;
        },
        filterFn: (row, id, value) => {
          if (!value || value.length === 0) return true;
          const v = (row.getValue(id) as string | null) ?? "";
          return value.includes(v);
        },
        enableSorting: true,
      },
      {
        id: "context_provider",
        accessorFn: (row) => row.context?.provider || null,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Provider" />
        ),
        cell: ({ row }) => {
          const provider =
            (row.getValue("context_provider") as string | null) ?? null;
          return provider ? (
            provider
          ) : (
            <span className="text-muted-foreground">N/A</span>
          );
        },
        filterFn: (row, id, value) => {
          if (!value || value.length === 0) return true;
          const v = (row.getValue(id) as string | null) ?? "";
          return value.includes(v);
        },
        enableSorting: true,
      },
      {
        id: "context_model",
        accessorFn: (row) => row.context?.model || null,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Model" />
        ),
        cell: ({ row }) => {
          const model =
            (row.getValue("context_model") as string | null) ?? null;
          return model ? (
            model
          ) : (
            <span className="text-muted-foreground">N/A</span>
          );
        },
        filterFn: (row, id, value) => {
          if (!value || value.length === 0) return true;
          const v = (row.getValue(id) as string | null) ?? "";
          return value.includes(v);
        },
        enableSorting: true,
      },
      {
        accessorKey: "correlation_id",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Correlation" />
        ),
        cell: ({ row }) => {
          const corr = (row.getValue("correlation_id") as string | null) ?? "";
          return (
            <span className="font-mono text-xs truncate inline-block max-w-[160px]">
              {corr}
            </span>
          );
        },
        enableSorting: true,
      },
      {
        id: "context",
        accessorKey: "context",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Context" />
        ),
        cell: ({ row }) => {
          const context = row.getValue("context");
          return context ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onViewLog(row.original)}
              className="h-8 px-2"
            >
              <FileText className="h-3 w-3 mr-1" />
              View JSON
            </Button>
          ) : (
            <span className="text-muted-foreground">None</span>
          );
        },
        enableSorting: false,
      },
    ],
    [onViewLog]
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
        created_time: false,
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
        dateOptions={dateOptions}
        timeOptions={timeOptions}
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
