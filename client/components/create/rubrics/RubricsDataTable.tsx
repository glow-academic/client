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
import { Rubric } from "@/types";
import { RubricsDataTableToolbar } from "./RubricsDataTableToolbar";

export interface RubricsDataTableProps {
  columns: ColumnDef<Rubric>[];
  data: Rubric[];
  passPointsOptions: { value: string; label: string }[];
  totalPointsOptions: { value: string; label: string }[];
  passPercentageOptions: { value: string; label: string }[];
  renderRubricCard: (rubric: Rubric) => React.ReactNode;
}

export function RubricsDataTable({
  columns,
  data,
  passPointsOptions,
  totalPointsOptions,
  passPercentageOptions,
  renderRubricCard,
}: RubricsDataTableProps) {
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
    <div className="space-y-4" data-testid="rubrics-data-table">
      <RubricsDataTableToolbar
        table={table}
        passPointsOptions={passPointsOptions}
        totalPointsOptions={totalPointsOptions}
        passPercentageOptions={passPercentageOptions}
      />
      <div className="space-y-6">
        {table.getRowModel().rows.length ? (
          table.getRowModel().rows.map((row) => renderRubricCard(row.original))
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            No rubrics match the current filters.
          </div>
        )}
      </div>
      <DataTablePagination table={table} />
    </div>
  );
}
