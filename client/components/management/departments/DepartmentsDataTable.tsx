"use client";

import {
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
import { Department } from "@/types";
import { DepartmentsDataTableToolbar } from "./DepartmentsDataTableToolbar";

export interface DepartmentsDataTableProps {
  data: Department[];
  departmentCodeOptions: { value: string; label: string }[];
  profileOptions: { value: string; label: string }[];
  classCountOptions: { value: string; label: string }[];
  locationCountOptions: { value: string; label: string }[];
  renderDepartmentCard: (department: Department) => React.ReactNode;
}

export function DepartmentsDataTable({
  data,
  departmentCodeOptions,
  profileOptions,
  classCountOptions,
  locationCountOptions,
  renderDepartmentCard,
}: DepartmentsDataTableProps) {
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
    columns: [], // We'll define columns in the toolbar
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
      <DepartmentsDataTableToolbar
        table={table}
        departmentCodeOptions={departmentCodeOptions}
        profileOptions={profileOptions}
        classCountOptions={classCountOptions}
        locationCountOptions={locationCountOptions}
      />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {table.getRowModel().rows.map((row) => (
          <div key={row.id}>{renderDepartmentCard(row.original)}</div>
        ))}
        {table.getRowModel().rows.length === 0 && (
          <div className="col-span-full text-center py-8">
            <p className="text-muted-foreground">No departments found.</p>
          </div>
        )}
      </div>
      <DataTablePagination table={table} />
    </div>
  );
}
