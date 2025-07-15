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
import { Class } from "@/types";
import { ClassesDataTableToolbar } from "./ClassesDataTableToolbar";

export interface ClassesDataTableProps {
  columns: ColumnDef<Class>[];
  data: Class[];
  yearOptions: { value: string; label: string }[];
  termOptions: { value: string; label: string }[];
  profileOptions: { value: string; label: string }[];
  documentCountOptions: { value: string; label: string }[];
  renderClassCard: (classItem: Class) => React.ReactNode;
}

export function ClassesDataTable({
  columns,
  data,
  yearOptions,
  termOptions,
  profileOptions,
  documentCountOptions,
  renderClassCard,
}: ClassesDataTableProps) {
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
        pageSize: 10, // Default to 10 items per page
      },
    },
  });

  return (
    <div className="space-y-4">
      <ClassesDataTableToolbar
        table={table}
        yearOptions={yearOptions}
        termOptions={termOptions}
        profileOptions={profileOptions}
        documentCountOptions={documentCountOptions}
      />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {table.getRowModel().rows.map((row) => (
          <div key={row.id}>{renderClassCard(row.original)}</div>
        ))}
        {table.getRowModel().rows.length === 0 && (
          <div className="col-span-full text-center py-8">
            <p className="text-muted-foreground">No classes found.</p>
          </div>
        )}
      </div>
      <DataTablePagination table={table} />
    </div>
  );
}
