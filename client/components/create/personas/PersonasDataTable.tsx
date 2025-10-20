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
  PersonaItem,
} from "@/lib/api/v2/schemas/personas";
import { PersonasDataTableToolbar } from "./PersonasDataTableToolbar";
import { ModelMapping, ScenarioMapping } from "@/lib/api/v2/schemas/base";

export interface PersonasDataTableProps {
  columns: ColumnDef<PersonaItem>[];
  data: PersonaItem[];
  scenarioMapping: ScenarioMapping;
  modelMapping: ModelMapping;
  scenarioOptions: { value: string; label: string }[];
  reasoningOptions: { value: string; label: string }[];
  modelOptions: { value: string; label: string }[];
  temperatureOptions: { value: string; label: string }[];
  renderPersonaCard: (persona: PersonaItem) => React.ReactNode;
}

export function PersonasDataTable({
  columns,
  data,
  scenarioOptions,
  reasoningOptions,
  modelOptions,
  temperatureOptions,
  renderPersonaCard,
}: PersonasDataTableProps) {
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
      <PersonasDataTableToolbar
        table={table}
        scenarioOptions={scenarioOptions}
        reasoningOptions={reasoningOptions}
        modelOptions={modelOptions}
        temperatureOptions={temperatureOptions}
      />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {table.getRowModel().rows.length ? (
          table.getRowModel().rows.map((row) => renderPersonaCard(row.original))
        ) : (
          <div className="col-span-full text-center py-8 text-muted-foreground">
            No personas match the current filters.
          </div>
        )}
      </div>
      <DataTablePagination table={table} card={true} />
    </div>
  );
}
