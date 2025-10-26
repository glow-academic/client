"use client";

import * as React from "react";

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

import { DataTablePagination } from "@/components/common/history/DataTablePagination";
import type { ParameterItem } from "@/lib/api/v2/schemas/parameters";
import { ParametersDataTableToolbar } from "./ParametersDataTableToolbar";

export interface ParametersDataTableProps {
  columns: ColumnDef<ParameterItem>[];
  parameters: ParameterItem[];
  renderParameterCard: (parameter: ParameterItem) => React.ReactNode;
}

export function ParametersDataTable({
  columns,
  parameters,
  renderParameterCard,
}: ParametersDataTableProps) {
  const [rowSelection, setRowSelection] = React.useState({});
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({});
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  );
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: "updated_at", desc: true },
  ]);

  const table = useReactTable({
    data: parameters,
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
      <ParametersDataTableToolbar table={table} />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {table.getRowModel().rows.length ? (
          table
            .getRowModel()
            .rows.map((row) => renderParameterCard(row.original))
        ) : (
          <div className="col-span-full text-center py-8 text-muted-foreground">
            No parameters match the current filters.
          </div>
        )}
      </div>

      <DataTablePagination table={table} card={true} />
    </div>
  );
}
