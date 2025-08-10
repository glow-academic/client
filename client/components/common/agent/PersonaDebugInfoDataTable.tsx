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

import { DataTableColumnHeader } from "@/components/common/history/DataTableColumnHeader";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { PersonaDebugInfoRow } from "./PersonaDebugInfo";
import PersonaDebugInfoDataTableToolbar from "./PersonaDebugInfoDataTableToolbar";

export interface PersonaDebugInfoDataTableProps {
  data: PersonaDebugInfoRow[];
  modelOptions: { value: string; label: string }[];
  isLoading?: boolean;
}

export default function PersonaDebugInfoDataTable({
  data,
  modelOptions,
  isLoading = false,
}: PersonaDebugInfoDataTableProps) {
  const columns = React.useMemo<ColumnDef<PersonaDebugInfoRow>[]>(
    () => [
      {
        accessorKey: "createdAt",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Created" />
        ),
        cell: ({ row }) => (
          <span className="whitespace-nowrap">
            {new Date(row.original.createdAt).toLocaleString()}
          </span>
        ),
        enableSorting: true,
      },
      {
        accessorKey: "modelId",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Model" />
        ),
        cell: ({ row }) => (
          <Badge variant="outline">
            {row.original.modelName || row.original.modelId}
          </Badge>
        ),
        enableColumnFilter: true,
        enableSorting: true,
      },
      {
        accessorKey: "content",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Content" />
        ),
        cell: ({ row }) => (
          <div className="max-w-[800px] whitespace-pre-wrap break-words text-sm">
            {row.original.content}
          </div>
        ),
        enableSorting: true,
        sortingFn: (rowA, rowB, columnId) => {
          const a = ((rowA.getValue(columnId) as string) || "").length;
          const b = ((rowB.getValue(columnId) as string) || "").length;
          return a === b ? 0 : a > b ? 1 : -1;
        },
      },
    ],
    []
  );

  const [rowSelection, setRowSelection] = React.useState({});
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({});
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  );
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: "createdAt", desc: true },
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
      pagination: { pageSize: 10 },
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PersonaDebugInfoDataTableToolbar
        table={table}
        modelOptions={modelOptions}
      />
      <div className="rounded-md border">
        <div className="grid grid-cols-12 gap-3 p-3 font-medium text-sm bg-muted/50">
          <div className="col-span-3">
            <DataTableColumnHeader
              column={table.getColumn("createdAt")!}
              title="Created"
            />
          </div>
          <div className="col-span-3">
            <DataTableColumnHeader
              column={table.getColumn("modelId")!}
              title="Model"
            />
          </div>
          <div className="col-span-6">
            <DataTableColumnHeader
              column={table.getColumn("content")!}
              title="Content"
            />
          </div>
        </div>
        <ScrollArea className="h-[360px]">
          <div className="divide-y">
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <div
                  key={row.id}
                  className="grid grid-cols-12 gap-3 p-3 text-sm"
                >
                  <div className="col-span-3 whitespace-nowrap">
                    {new Date(row.original.createdAt).toLocaleString()}
                  </div>
                  <div className="col-span-3">
                    <Badge variant="outline">
                      {row.original.modelName || row.original.modelId}
                    </Badge>
                  </div>
                  <div className="col-span-6 whitespace-pre-wrap break-words">
                    {row.original.content}
                  </div>
                </div>
              ))
            ) : (
              <div className="p-6 text-center text-muted-foreground text-sm">
                No debug info yet for this persona.
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
