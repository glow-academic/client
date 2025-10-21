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

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { DataTableColumnHeader } from "@/components/common/history/DataTableColumnHeader";
import { DataTablePagination } from "@/components/common/history/DataTablePagination";
import { Badge } from "@/components/ui/badge";
import type { FeedbackItem } from "@/lib/api/v2/schemas/feedback";
import { FeedbackDataTableToolbar } from "./FeedbackDataTableToolbar";

// Helper functions
const getFeedbackTypeVariant = (
  type: string
): "destructive" | "default" | "secondary" | "outline" => {
  switch (type) {
    case "bug":
      return "destructive";
    case "feature":
      return "default";
    case "question":
      return "secondary";
    case "other":
      return "outline";
    default:
      return "default";
  }
};

const getFeedbackTypeIcon = (type: string): string => {
  switch (type) {
    case "bug":
      return "🐛";
    case "feature":
      return "✨";
    case "question":
      return "❓";
    case "other":
      return "📝";
    default:
      return "📝";
  }
};

export interface FeedbackDataTableProps {
  data: FeedbackItem[];
  typeOptions: { value: string; label: string }[];
  profileOptions: { value: string; label: string }[];
  isRefreshing: boolean;
  onRefresh: () => void;
  onBulkDelete: () => void;
}

export function FeedbackDataTable({
  data,
  typeOptions,
  profileOptions,
  isRefreshing,
  onRefresh,
  onBulkDelete,
}: FeedbackDataTableProps) {
  const [rowSelection, setRowSelection] = React.useState({});
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({});
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  );
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: "created_at", desc: true }, // Default to descending order by date
  ]);

  // Define columns with rich visual styling
  const columns = React.useMemo<ColumnDef<FeedbackItem>[]>(
    () => [
      {
        accessorKey: "type",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Type" />
        ),
        cell: ({ row }) => {
          const type = row.getValue("type") as string;
          return (
            <div className="flex justify-center">
              <Badge variant={getFeedbackTypeVariant(type)}>
                {getFeedbackTypeIcon(type)} {type.toUpperCase()}
              </Badge>
            </div>
          );
        },
        enableSorting: true,
        enableHiding: false,
        enableColumnFilter: true,
        filterFn: (row, _, value) => {
          if (!value || value.length === 0) return true;
          return value.includes(row.getValue("type"));
        },
      },
      {
        accessorKey: "message",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Message" />
        ),
        cell: ({ row }) => (
          <div className="max-w-lg text-left mx-auto text-sm whitespace-normal break-words">
            {row.getValue("message") ?? "N/A"}
          </div>
        ),
        enableSorting: true,
        enableHiding: false,
      },
      {
        accessorKey: "author_name",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Author" />
        ),
        cell: ({ row }) => {
          const feedback = row.original;
          return (
            <div className="flex flex-col">
              <span className="font-medium text-sm">
                {feedback.author_name}
              </span>
              {feedback.author_alias && (
                <span className="text-xs text-muted-foreground">
                  {feedback.author_alias}
                </span>
              )}
            </div>
          );
        },
        enableSorting: true,
        enableHiding: false,
        enableColumnFilter: true,
        filterFn: (row, _, value) => {
          if (!value || value.length === 0) return true;
          return value.includes(row.getValue("author_name"));
        },
      },
      {
        accessorKey: "created_at",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Created At" />
        ),
        cell: ({ row }) => {
          const date = row.getValue("created_at") as string;
          return (
            <div className="text-sm text-center">
              {new Date(date).toLocaleString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
          );
        },
        enableSorting: true,
        enableHiding: false,
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
        pageSize: 10,
      },
    },
  });

  return (
    <div className="space-y-4">
      <FeedbackDataTableToolbar
        table={table}
        typeOptions={typeOptions}
        profileOptions={profileOptions}
        isRefreshing={isRefreshing}
        onRefresh={onRefresh}
        onBulkDelete={onBulkDelete}
      />
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="h-8">
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead
                      key={header.id}
                      colSpan={header.colSpan}
                      className={`border-r py-1 text-xs text-center ${
                        header.id === "select" ? "w-12" : ""
                      } ${header.column.getCanSort() ? "pl-4" : ""}`}
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
                  className="h-6 hover:bg-muted/30 transition-colors"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={`border-r px-2 py-1 ${
                        cell.column.id === "select" ? "w-12 text-center" : ""
                      } ${
                        cell.column.id === "message"
                          ? "text-left align-top"
                          : "text-center"
                      }`}
                    >
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
                  No feedback found.
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
