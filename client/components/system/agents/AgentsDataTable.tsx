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
import { Agent } from "@/types";
import { AgentsDataTableToolbar } from "./AgentsDataTableToolbar";

export interface AgentsDataTableProps {
  columns: ColumnDef<Agent>[];
  data: Agent[];
  reasoningOptions: { value: string; label: string }[];
  modelOptions: { value: string; label: string }[];
  temperatureOptions: { value: string; label: string }[];
  renderAgentCard: (agent: Agent) => React.ReactNode;
}

export function AgentsDataTable({
  columns,
  data,
  reasoningOptions,
  modelOptions,
  temperatureOptions,
  renderAgentCard,
}: AgentsDataTableProps) {
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
      <AgentsDataTableToolbar
        table={table}
        reasoningOptions={reasoningOptions}
        modelOptions={modelOptions}
        temperatureOptions={temperatureOptions}
      />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {table.getRowModel().rows.length ? (
          table.getRowModel().rows.map((row) => renderAgentCard(row.original))
        ) : (
          <div className="col-span-full text-center py-8 text-muted-foreground">
            No system agents match the current filters.
          </div>
        )}
      </div>
      <DataTablePagination table={table} />
    </div>
  );
}
