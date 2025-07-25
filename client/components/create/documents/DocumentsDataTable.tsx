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

import { DataTablePagination } from "@/components/common/history/DataTablePagination";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Document } from "@/types";
import { Edit, Trash2 } from "lucide-react";
import { DocumentsDataTableToolbar } from "./DocumentsDataTableToolbar";

export interface DocumentsDataTableProps {
  columns: ColumnDef<Document>[];
  data: Document[];
  typeOptions: { value: string; label: string }[];
  scenarioOptions: { value: string; label: string }[];
  extensionOptions: { value: string; label: string }[];
  renderDocumentCard: (document: Document) => React.ReactNode;
  viewMode: "grid" | "list";
  onViewModeChange: (mode: "grid" | "list") => void;
  onEdit: (document: Document) => void;
  onDelete: (document: Document) => void;
  canDelete: (documentId: string) => boolean;
  selectedDocuments: string[];
  onDocumentSelect: (documentId: string, checked: boolean) => void;
  onSelectAll: (checked: boolean) => void;
  onBulkDelete: () => void;
}

export function DocumentsDataTable({
  columns,
  data,
  typeOptions,
  scenarioOptions,
  extensionOptions,
  renderDocumentCard,
  viewMode,
  onViewModeChange,
  onEdit,
  onDelete,
  canDelete,
}: DocumentsDataTableProps) {
  const [rowSelection, setRowSelection] = React.useState({});
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({});
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  );
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: "updatedAt", desc: true }, // Default to descending order by date
  ]);

  // Add checkbox column to the beginning
  const columnsWithCheckbox = React.useMemo(() => {
    const checkboxColumn: ColumnDef<Document> = {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
          className="translate-y-[2px]"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
          className="translate-y-[2px]"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    };

    // Add actions column at the end
    const actionsColumn: ColumnDef<Document> = {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const document = row.original;
        return (
          <div className="flex items-center justify-center gap-1">
            {onEdit && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onEdit(document)}
              >
                <Edit className="h-4 w-4" />
              </Button>
            )}
            {onDelete && canDelete && canDelete(document.id) && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => onDelete(document)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        );
      },
      enableSorting: false,
      enableHiding: false,
    };

    return [checkboxColumn, ...columns, actionsColumn];
  }, [columns, onEdit, onDelete, canDelete]);

  const table = useReactTable({
    data,
    columns: columnsWithCheckbox,
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
      <DocumentsDataTableToolbar
        table={table}
        typeOptions={typeOptions}
        scenarioOptions={scenarioOptions}
        extensionOptions={extensionOptions}
        viewMode={viewMode}
        onViewModeChange={onViewModeChange}
      />

      {viewMode === "grid" ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {table.getRowModel().rows.length ? (
            table
              .getRowModel()
              .rows.map((row) => renderDocumentCard(row.original))
          ) : (
            <div className="col-span-full text-center py-8 text-muted-foreground">
              No documents match the current filters.
            </div>
          )}
        </div>
      ) : (
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
                        className={`border-r px-2 py-1 text-center ${
                          cell.column.id === "select" ? "w-12" : ""
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
                    colSpan={columnsWithCheckbox.length}
                    className="h-24 text-center px-6"
                  >
                    No results.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <DataTablePagination table={table} />
    </div>
  );
}
