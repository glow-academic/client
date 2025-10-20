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
import type { AgentItem } from "@/lib/api/v2/schemas/agents";
import { AgentsDataTableToolbar } from "./AgentsDataTableToolbar";

export interface AgentsDataTableProps {
  data: AgentItem[];
  modelMapping: Record<string, { name: string; description: string }>;
  reasoningOptions: { value: string; label: string }[];
  modelOptions: { value: string; label: string }[];
  temperatureOptions: { value: string; label: string }[];
  renderAgentCard: (agent: AgentItem) => React.ReactNode;
}

export function AgentsDataTable({
  data,
  modelMapping,
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
    { id: "updated_at", desc: true }, // Default to descending order by date
  ]);

  // Define columns inline for filtering
  const columns = React.useMemo<ColumnDef<AgentItem>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Name",
      },
      {
        accessorKey: "model_id",
        header: "Model",
        cell: ({ row }) => {
          const modelId = row.getValue("model_id") as string;
          return modelMapping[modelId] || modelId;
        },
      },
      {
        accessorKey: "reasoning",
        header: "Reasoning",
      },
      {
        accessorKey: "temperature",
        header: "Temperature",
      },
    ],
    [modelMapping]
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
        pageSize: 12, // Default to 12 items per page for card layout
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
      <DataTablePagination table={table} card={true} />
    </div>
  );
}
