"use client";

import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import * as React from "react";
import { DateRange } from "react-day-picker";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { DataTablePagination } from "./DataTablePagination";
import { DataTableToolbar } from "./DataTableToolbar";

export interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  profileOptions: { value: string; label: string }[];
  simulationOptions: { value: string; label: string }[];
  showExport?: boolean;
  showAll?: boolean;
  startDate?: Date | undefined;
  endDate?: Date | undefined;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  profileOptions,
  simulationOptions,
  showExport = true,
  showAll = false,
  startDate,
  endDate,
}: DataTableProps<TData, TValue>) {
  const [rowSelection, setRowSelection] = React.useState({});
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({
      // No columns hidden by default - clean slate
    });
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  );
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: "createdAt", desc: true }, // Default to descending order by date
  ]);
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>();

  // Initialize dateRange from props if provided
  React.useEffect(() => {
    if (startDate && endDate) {
      setDateRange({ from: startDate, to: endDate });
    }
  }, [startDate, endDate]);

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
  });

  // Effect to update date filter when dateRange changes - only apply filter when user selects a date
  React.useEffect(() => {
    // Get the createdAt column reference
    const createdAtColumn = table.getColumn("createdAt");
    if (!createdAtColumn) return;

    // Only set filter if there's a valid date range with both from and to dates
    if (dateRange?.from && dateRange?.to) {
      const fromDate = new Date(dateRange.from);
      fromDate.setHours(0, 0, 0, 0);

      const toDate = new Date(dateRange.to);
      toDate.setHours(23, 59, 59, 999);

      // Apply the date filter
      createdAtColumn.setFilterValue([fromDate, toDate]);
    } else {
      // Clear the filter if date range is missing or incomplete
      createdAtColumn.setFilterValue(undefined);
    }
  }, [dateRange, table]);

  return (
    <div className="space-y-4">
      <DataTableToolbar
        table={table}
        profileOptions={profileOptions}
        simulationOptions={simulationOptions}
        showExport={showExport}
        showAll={showAll}
      />
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead
                      key={header.id}
                      colSpan={header.colSpan}
                      className="pl-6"
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="px-6">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center px-6"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <DataTablePagination table={table} />
    </div>
  );
}
