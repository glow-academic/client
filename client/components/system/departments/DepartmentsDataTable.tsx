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
import type { DepartmentItem } from "@/lib/api/v2/schemas/departments";
import { DepartmentsDataTableToolbar } from "./DepartmentsDataTableToolbar";

export interface DepartmentsDataTableProps {
  data: DepartmentItem[];
  priceSpentOptions: { value: string; label: string }[];
  staffCountOptions: { value: string; label: string }[];
  renderDepartmentCard: (department: DepartmentItem) => React.ReactNode;
}

export function DepartmentsDataTable({
  data,
  priceSpentOptions,
  staffCountOptions,
  renderDepartmentCard,
}: DepartmentsDataTableProps) {
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({});
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  );
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: "updated_at", desc: true }, // Default to descending order by date
  ]);
  const [rowSelection, setRowSelection] = React.useState({});

  // Define columns inline for filtering
  const columns = React.useMemo<ColumnDef<DepartmentItem>[]>(
    () => [
      {
        accessorKey: "title",
        header: "Title",
      },
      {
        accessorKey: "total_price_spent",
        header: "Price Spent",
      },
      {
        accessorKey: "staff_count",
        header: "Staff Count",
      },
      {
        accessorKey: "active",
        header: "Active",
      },
    ],
    []
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
      <DepartmentsDataTableToolbar
        table={table}
        priceSpentOptions={priceSpentOptions}
        staffCountOptions={staffCountOptions}
      />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {table.getRowModel().rows.length ? (
          table
            .getRowModel()
            .rows.map((row) => renderDepartmentCard(row.original))
        ) : (
          <div className="col-span-full text-center py-8 text-muted-foreground">
            No departments match the current filters.
          </div>
        )}
      </div>
      <DataTablePagination table={table} card={true} />
    </div>
  );
}
