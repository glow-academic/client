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
import type {
  RubricItem,
  StandardGroupsMapping,
  StandardsMapping,
} from "@/lib/api/v2/schemas/rubrics";
import { RubricsDataTableToolbar } from "./RubricsDataTableToolbar";

export interface RubricsDataTableProps {
  columns: ColumnDef<RubricItem>[];
  rubrics: RubricItem[];
  standardGroupsMapping: StandardGroupsMapping;
  standardsMapping: StandardsMapping;
  departmentOptions: { value: string; label: string }[];
  passPointsOptions: { value: string; label: string }[];
  totalPointsOptions: { value: string; label: string }[];
  passPercentageOptions: { value: string; label: string }[];
  renderRubricCard: (rubric: RubricItem) => React.ReactNode;
}

export function RubricsDataTable({
  columns,
  rubrics,
  standardGroupsMapping: _standardGroupsMapping,
  standardsMapping: _standardsMapping,
  departmentOptions,
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
    { id: "name", desc: false },
  ]);

  const table = useReactTable({
    data: rubrics,
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
    <div className="space-y-4" data-testid="rubrics-data-table">
      <RubricsDataTableToolbar
        table={table}
        departmentOptions={departmentOptions}
        passPointsOptions={passPointsOptions}
        totalPointsOptions={totalPointsOptions}
        passPercentageOptions={passPercentageOptions}
      />

      {/* Rubrics cards */}
      <div className="space-y-4">
        {table.getRowModel().rows.length ? (
          table.getRowModel().rows.map((row) => renderRubricCard(row.original))
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            No rubrics match the current filters.
          </div>
        )}
      </div>

      <DataTablePagination table={table} card={true} />
    </div>
  );
}
