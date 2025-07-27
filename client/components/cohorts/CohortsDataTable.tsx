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
import { Cohort } from "@/types";
import { CohortsDataTableToolbar } from "./CohortsDataTableToolbar";

export interface CohortsDataTableProps {
  columns: ColumnDef<Cohort>[];
  data: Cohort[];
  profileOptions: { value: string; label: string }[];
  simulationOptions: { value: string; label: string }[];
  renderCohortCard: (cohort: Cohort) => React.ReactNode;
}

export function CohortsDataTable({
  columns,
  data,
  profileOptions,
  simulationOptions,
  renderCohortCard,
}: CohortsDataTableProps) {
  const [rowSelection, setRowSelection] = React.useState({});
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({});
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    [],
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
      <CohortsDataTableToolbar
        table={table}
        profileOptions={profileOptions}
        simulationOptions={simulationOptions}
      />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {table.getRowModel().rows.length ? (
          table.getRowModel().rows.map((row) => renderCohortCard(row.original))
        ) : (
          <div className="col-span-full text-center py-8 text-muted-foreground">
            No cohorts match the current filters.
          </div>
        )}
      </div>
      <DataTablePagination table={table} />
    </div>
  );
}
