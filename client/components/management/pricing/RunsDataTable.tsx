"use client";

import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  useReactTable,
} from "@tanstack/react-table";
import * as React from "react";
import { Bug } from "lucide-react";

import { DataTablePagination } from "@/components/common/history/DataTablePagination";
import { DataTableColumnHeader } from "@/components/common/history/DataTableColumnHeader";
import { Button } from "@/components/ui/button";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { DataTableFacetedFilter } from "@/components/common/history/DataTableFacetedFilter";
import { DataTableViewOptions } from "@/components/common/history/DataTableViewOptions";
import { DebugInfo } from "@/types";
import { format } from "date-fns";

export interface ModelRunRow {
  id: string;
  createdAt: string;
  modelId: string | null;
  modelName: string;
  agentId?: string | null;
  agentName?: string;
  personaId?: string | null;
  personaName?: string;
  profileId?: string | null;
  profileName?: string;
  inputTokens: number;
  outputTokens: number;
  debugInfo?: DebugInfo[];
}

export interface RunsDataTableProps {
  rows: ModelRunRow[];
}

export function RunsDataTable({ rows }: RunsDataTableProps) {
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: "createdAt", desc: true },
  ]);

  const columns = React.useMemo<ColumnDef<ModelRunRow>[]>(
    () => [
      {
        accessorKey: "createdAt",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Created" />
        ),
        cell: ({ row }) => (
          <div className="text-sm">
            {format(new Date(row.getValue("createdAt")), "yyyy-MM-dd HH:mm")}
          </div>
        ),
        enableSorting: true,
      },
      {
        accessorKey: "modelName",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Model" />
        ),
        cell: ({ row }) => <div className="text-sm">{row.getValue("modelName")}</div>,
        filterFn: (row, id, value) => {
          return (value as string[]).includes(row.original.modelId || "");
        },
      },
      {
        accessorKey: "profileName",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Person" />
        ),
        cell: ({ row }) => <div className="text-sm">{row.getValue("profileName")}</div>,
        filterFn: (row, _id, value) => {
          return (value as string[]).includes(row.original.profileId || "");
        },
      },
      {
        accessorKey: "agentName",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Agent" />
        ),
        cell: ({ row }) => <div className="text-sm">{row.getValue("agentName")}</div>,
        filterFn: (row, _id, value) => {
          return (value as string[]).includes(row.original.agentId || "");
        },
      },
      {
        accessorKey: "personaName",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Persona" />
        ),
        cell: ({ row }) => <div className="text-sm">{row.getValue("personaName")}</div>,
        filterFn: (row, _id, value) => {
          return (value as string[]).includes(row.original.personaId || "");
        },
      },
      {
        accessorKey: "inputTokens",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Input tokens" />
        ),
        cell: ({ row }) => <div className="text-sm tabular-nums">{row.getValue("inputTokens")}</div>,
        enableSorting: true,
      },
      {
        accessorKey: "outputTokens",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Output tokens" />
        ),
        cell: ({ row }) => (
          <div className="text-sm tabular-nums">{row.getValue("outputTokens")}</div>
        ),
        enableSorting: true,
      },
      {
        id: "debug",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Debug" />
        ),
        cell: ({ row }) => {
          const d = row.original.debugInfo || [];
          const has = d.length > 0;
          const content = has ? d[0].content : null; // display first entry content
          return (
            <HoverCard>
              <HoverCardTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={!has}>
                  <Bug className={`h-4 w-4 ${has ? "text-amber-600" : "text-muted-foreground"}`} />
                </Button>
              </HoverCardTrigger>
              <HoverCardContent align="start" className="max-w-[480px]">
                {content ? (
                  <pre className="text-xs whitespace-pre-wrap break-words">{content}</pre>
                ) : (
                  <span className="text-xs text-muted-foreground">No debug info</span>
                )}
              </HoverCardContent>
            </HoverCard>
          );
        },
      },
    ],
    [],
  );

  const table = useReactTable({
    data: rows,
    columns,
    state: {
      sorting,
      columnVisibility,
      columnFilters,
    },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnFiltersChange: setColumnFilters,
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

  // Build option lists from faceted values
  const modelOptions = React.useMemo(() => {
    const set = new Map<string, string>();
    rows.forEach((r) => {
      if (r.modelId) set.set(r.modelId, r.modelName);
    });
    return Array.from(set.entries()).map(([value, label]) => ({ value, label }));
  }, [rows]);
  const agentOptions = React.useMemo(() => {
    const set = new Map<string, string>();
    rows.forEach((r) => {
      if (r.agentId) set.set(r.agentId, r.agentName || r.agentId);
    });
    return Array.from(set.entries()).map(([value, label]) => ({ value, label }));
  }, [rows]);
  const profileOptions = React.useMemo(() => {
    const set = new Map<string, string>();
    rows.forEach((r) => {
      if (r.profileId) set.set(r.profileId, r.profileName || r.profileId);
    });
    return Array.from(set.entries()).map(([value, label]) => ({ value, label }));
  }, [rows]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <DataTableFacetedFilter
            column={table.getColumn("modelName")}
            title="Model"
            options={modelOptions}
          />
          <DataTableFacetedFilter
            column={table.getColumn("agentName")}
            title="Agent"
            options={agentOptions}
          />
          <DataTableFacetedFilter
            column={table.getColumn("profileName")}
            title="Person"
            options={profileOptions}
          />
          {table.getState().columnFilters.length > 0 && (
            <Button
              variant="ghost"
              className="h-8 px-2"
              onClick={() => table.resetColumnFilters()}
            >
              Reset
            </Button>
          )}
        </div>
        <DataTableViewOptions table={table} />
      </div>
      <div className="border rounded-lg">
        <table className="w-full">
          <thead className="bg-muted/50">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th key={header.id} className="px-4 py-3 text-left text-sm font-medium">
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
                <tr key={row.id} className="border-b hover:bg-muted/50 transition-colors">
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
                <td colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                  No runs match the current filters.
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


