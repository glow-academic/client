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
import { Edit, Eye, Trash2 } from "lucide-react";
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
  onPreview: (document: Document) => void;
  onDelete: (document: Document) => void;
  canDelete: (documentId: string) => boolean;
  selectedDocuments: string[];
  onDocumentSelect: (documentId: string, checked: boolean) => void;
  onSelectAll: (checked: boolean) => void;
  onBulkDelete: () => void;
  onBulkEdit: () => void;
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
  onPreview,
  onDelete,
  canDelete,
  selectedDocuments,
  onDocumentSelect,
  onSelectAll,
  onBulkDelete,
  onBulkEdit,
}: DocumentsDataTableProps) {
  const [sorting, setSorting] = React.useState<SortingState>([
    {
      id: "updatedAt",
      desc: true,
    },
  ]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  );
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({});

  // Add checkbox and actions columns to the columns array
  const columnsWithActions = React.useMemo(() => {
    const checkboxColumn: ColumnDef<Document> = {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")
          }
          onCheckedChange={(value) => {
            table.toggleAllPageRowsSelected(!!value);
            onSelectAll(!!value);
          }}
          aria-label="Select all"
          className="translate-y-[2px]"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={selectedDocuments.includes(row.original.id)}
          onCheckedChange={(value) =>
            onDocumentSelect(row.original.id, !!value)
          }
          aria-label="Select row"
          className="translate-y-[2px]"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    };

    const actionsColumn: ColumnDef<Document> = {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const document = row.original;
        return (
          <div className="flex items-center justify-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => onPreview(document)}
            >
              <Eye className="h-3 w-3" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => onEdit(document)}
            >
              <Edit className="h-3 w-3" />
            </Button>
            {canDelete(document.id) && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                onClick={() => {
                  // Add a small confirmation step for single deletion parity with staff
                  const confirmDelete = window.confirm(
                    `Delete "${document.name}"? This action cannot be undone.`
                  );
                  if (confirmDelete) onDelete(document);
                }}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
        );
      },
      enableSorting: false,
      enableHiding: false,
    };

    // Filter out the existing select and actions columns and add our custom ones
    const filteredColumns = columns.filter(
      (col) => col.id !== "select" && col.id !== "actions"
    );
    return [checkboxColumn, ...filteredColumns, actionsColumn];
  }, [
    columns,
    selectedDocuments,
    onDocumentSelect,
    onSelectAll,
    onEdit,
    onPreview,
    onDelete,
    canDelete,
  ]);

  const table = useReactTable({
    data,
    columns: columnsWithActions,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    state: {
      sorting,
      columnFilters,
      columnVisibility,
    },
    initialState: {
      pagination: {
        pageSize: 10, // Default list view page size
      },
    },
  });

  // Switch page size based on view mode
  React.useEffect(() => {
    if (viewMode === "grid") {
      if (table.getState().pagination.pageSize !== 12) {
        table.setPageSize(12);
        table.setPageIndex(0);
      }
    } else {
      if (table.getState().pagination.pageSize !== 10) {
        table.setPageSize(10);
        table.setPageIndex(0);
      }
    }
  }, [viewMode, table]);

  // Get filtered and paginated data for both views
  const filteredDocuments = table.getRowModel().rows.map((row) => row.original);

  return (
    <div className="space-y-4">
      <DocumentsDataTableToolbar
        table={table}
        typeOptions={typeOptions}
        scenarioOptions={scenarioOptions}
        extensionOptions={extensionOptions}
        viewMode={viewMode}
        onViewModeChange={onViewModeChange}
        selectedCount={selectedDocuments.length}
        onBulkDelete={onBulkDelete}
        canDeleteDocument={canDelete}
        selectedDocuments={selectedDocuments}
        onBulkEdit={onBulkEdit}
      />

      {viewMode === "list" ? (
        <div className="space-y-4">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => {
                      return (
                        <TableHead key={header.id}>
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
                        <TableCell key={cell.id}>
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
                      colSpan={columnsWithActions.length}
                      className="h-24 text-center"
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
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredDocuments.length > 0 ? (
              filteredDocuments.map((document) => renderDocumentCard(document))
            ) : (
              <div className="col-span-full text-center py-8 text-muted-foreground">
                No documents match the current filters.
              </div>
            )}
          </div>
          <DataTablePagination table={table} card={true} />
        </div>
      )}
    </div>
  );
}
