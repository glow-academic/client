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
import { useRouter } from "next/navigation";
import * as React from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import type {
  BulkArchiveAttemptsIn,
  BulkArchiveAttemptsOut,
} from "@/app/(main)/analytics/dashboard/page";
import { DataTablePagination } from "@/components/common/table/DataTablePagination";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { DataTableToolbar } from "./DataTableToolbar";
// Legacy interface - no longer used

export interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  profileOptions: { value: string; label: string; count?: number }[];
  simulationOptions: { value: string; label: string; count?: number }[];
  scenarioOptions?: { value: string; label: string; count?: number }[];
  infiniteModeOptions?: { value: string; label: string; count?: number }[];
  showExport?: boolean;
  showArchive?: boolean;
  showAll?: boolean;
  startDate?: Date | undefined;
  endDate?: Date | undefined;
  bulkArchiveAttemptsAction?: (
    input: BulkArchiveAttemptsIn
  ) => Promise<BulkArchiveAttemptsOut>;
  // Server-driven pagination props
  isServerDriven?: boolean;
  pageCount?: number;
  onPaginationChange?: (
    updater:
      | { pageIndex: number; pageSize: number }
      | ((prev: { pageIndex: number; pageSize: number }) => {
          pageIndex: number;
          pageSize: number;
        })
  ) => void;
  // Controlled state from parent when server-driven
  columnFiltersState?: ColumnFiltersState;
  sortingState?: SortingState;
  onColumnFiltersChange?: (
    updater:
      | Array<{ id: string; value: unknown }>
      | ((
          prev: Array<{ id: string; value: unknown }>
        ) => Array<{ id: string; value: unknown }>)
  ) => void;
  onSortingChange?: (
    updater:
      | Array<{ id: string; desc: boolean }>
      | ((
          prev: Array<{ id: string; desc: boolean }>
        ) => Array<{ id: string; desc: boolean }>)
  ) => void;
  onSearchChange?: (value: string) => void;
  searchValue?: string;
  paginationState?: { pageIndex: number; pageSize: number };
}

export function DataTable<TData, TValue>({
  columns,
  data,
  profileOptions,
  simulationOptions,
  scenarioOptions = [],
  infiniteModeOptions = [],
  showExport = true,
  showArchive = false,
  showAll = false,
  startDate: _startDate,
  endDate: _endDate,
  bulkArchiveAttemptsAction,
  isServerDriven = false,
  pageCount,
  onPaginationChange,
  columnFiltersState,
  sortingState,
  onColumnFiltersChange,
  onSortingChange,
  onSearchChange,
  searchValue,
  paginationState,
}: DataTableProps<TData, TValue>) {
  const router = useRouter();
  const [rowSelection, setRowSelection] = React.useState({});
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({
      search: false,
      profileId: false,
      simulationId: false,
      scenarios: false,
      infiniteMode: false,
    });

  // Internal state only used when NOT server-driven
  const [internalColumnFilters, setInternalColumnFilters] =
    React.useState<ColumnFiltersState>([]);
  const [internalSorting, setInternalSorting] = React.useState<SortingState>([
    { id: "date", desc: true }, // Default to descending order by date
  ]);

  // Choose which state to use
  const columnFilters = isServerDriven
    ? (columnFiltersState ?? [])
    : internalColumnFilters;

  const sorting = isServerDriven ? (sortingState ?? []) : internalSorting;

  // Handle column filters change (server-driven or client-side)
  const handleColumnFiltersChange = React.useCallback(
    (
      updater:
        | ColumnFiltersState
        | ((prev: ColumnFiltersState) => ColumnFiltersState)
    ) => {
      if (isServerDriven && onColumnFiltersChange) {
        const current = columnFiltersState ?? [];
        const next = typeof updater === "function" ? updater(current) : updater;
        onColumnFiltersChange(next);
      } else {
        setInternalColumnFilters((prev) =>
          typeof updater === "function" ? updater(prev) : updater
        );
      }
    },
    [isServerDriven, onColumnFiltersChange, columnFiltersState]
  );

  // Handle sorting change (server-driven or client-side)
  const handleSortingChange = React.useCallback(
    (updater: SortingState | ((prev: SortingState) => SortingState)) => {
      if (isServerDriven && onSortingChange) {
        const current = sortingState ?? [];
        const next = typeof updater === "function" ? updater(current) : updater;
        onSortingChange(next);
      } else {
        setInternalSorting((prev) =>
          typeof updater === "function" ? updater(prev) : updater
        );
      }
    },
    [isServerDriven, onSortingChange, sortingState]
  );

  // State for archive dialog
  const [showArchiveDialog, setShowArchiveDialog] = React.useState(false);
  const [archiveAction, setArchiveAction] = React.useState<boolean | null>(
    null
  );
  const [isArchiving, setIsArchiving] = React.useState(false);
  // Helper functions to normalize id and archived fields
  const getRowId = (item: unknown) => {
    const obj = item as Record<string, unknown>;
    return String(obj["id"] ?? obj["attemptId"] ?? "");
  };

  const getArchived = (item: unknown) => {
    const obj = item as Record<string, unknown>;
    return Boolean(obj["archived"] ?? obj["isArchived"] ?? false);
  };

  // Handle bulk archive
  const handleBulkArchive = React.useCallback(async (archive: boolean) => {
    setArchiveAction(archive);
    setShowArchiveDialog(true);
  }, []);

  // Add checkbox column when showArchive is true
  const columnsWithCheckbox = React.useMemo(() => {
    if (!showArchive) return columns;

    const checkboxColumn: ColumnDef<TData> = {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")
          }
          onCheckedChange={(value) => {
            if (value) {
              // select just the current page
              table.toggleAllPageRowsSelected(true);
            } else {
              // clear *all* selection, not only the page
              table.resetRowSelection();
            }
          }}
          aria-label="Select all"
          className="translate-y-[2px]"
        />
      ),
      cell: ({ row }) => {
        return (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(val) => row.toggleSelected(!!val)}
            aria-label="Select row"
            className="translate-y-[2px]"
          />
        );
      },
      enableSorting: false,
      enableHiding: false,
    };

    return [checkboxColumn, ...columns];
  }, [columns, showArchive]);

  const table = useReactTable({
    data,
    columns: columnsWithCheckbox,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
      columnFilters,
      pagination: paginationState || {
        pageIndex: 0,
        pageSize: 10,
      },
    },
    enableRowSelection: showArchive,
    onRowSelectionChange: setRowSelection,
    onSortingChange: handleSortingChange,
    onColumnFiltersChange: handleColumnFiltersChange,
    onColumnVisibilityChange: setColumnVisibility,
    ...(isServerDriven && onPaginationChange ? { onPaginationChange } : {}),
    manualPagination: isServerDriven,
    manualFiltering: isServerDriven,
    manualSorting: isServerDriven,
    ...(isServerDriven && pageCount !== undefined ? { pageCount } : {}),
    getCoreRowModel: getCoreRowModel(),
    ...(!isServerDriven ? { getFilteredRowModel: getFilteredRowModel() } : {}),
    ...(!isServerDriven
      ? { getPaginationRowModel: getPaginationRowModel() }
      : {}),
    ...(!isServerDriven ? { getSortedRowModel: getSortedRowModel() } : {}),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    getRowId: (row, index) => getRowId(row) || String(index),
    initialState: {
      columnVisibility: {
        search: false,
        profileId: false,
        simulationId: false,
        scenarios: false,
        infiniteMode: false,
      },
    },
  });

  // Memoize table rows to avoid calling getRowModel() multiple times and prevent re-render issues
  // Extract pagination primitives directly to avoid object reference issues
  const pageIndex = table.getState().pagination.pageIndex;
  const pageSize = table.getState().pagination.pageSize;
  // Stringify arrays for stable comparison (arrays are compared by reference)
  const sortingKey = JSON.stringify(sorting);
  const columnFiltersKey = JSON.stringify(columnFilters);
  const tableRows = React.useMemo(() => {
    return table.getRowModel().rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    // Use JSON.stringify for arrays to ensure stable comparison (arrays are compared by reference)
    sortingKey,
    columnFiltersKey,
    data.length,
    // Use pagination primitives directly (not object references)
    pageIndex,
    pageSize,
  ]);

  // Extract row selection state for dependency tracking
  const rowSelectionState = table.getState().rowSelection;

  // Derive selectedAttempts from table selection (single source of truth)
  const selectedAttempts = React.useMemo(() => {
    return table
      .getSelectedRowModel()
      .flatRows.map((r) => getRowId(r.original));
  }, [table, rowSelectionState]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle select all visible rows (for the "Select All Rows" button)
  const handleSelectAllVisibleRows = React.useCallback(() => {
    // Select all filtered rows (respects filters, ignores pagination)
    const visible = table.getFilteredRowModel().rows;
    const next: Record<string, boolean> = {};
    visible.forEach((r) => {
      next[r.id] = true;
    });
    table.setRowSelection(next);
  }, [table]);

  // Calculate archive/unarchive counts from selected rows
  const { archiveCount, unarchiveCount } = React.useMemo(() => {
    const selectedRows = table.getSelectedRowModel().flatRows;
    let a = 0,
      u = 0;
    for (const r of selectedRows) {
      if (getArchived(r.original)) u++;
      else a++;
    }
    return { archiveCount: a, unarchiveCount: u };
  }, [table, rowSelectionState]); // eslint-disable-line react-hooks/exhaustive-deps

  // Execute bulk archive
  const executeBulkArchive = React.useCallback(async () => {
    if (archiveAction === null || !bulkArchiveAttemptsAction) return;

    const selectedRows = table.getSelectedRowModel().flatRows;
    const attemptsToUpdate = selectedRows
      .map((r) => r.original)
      .filter((item) => {
        const isArchived = getArchived(item);
        return archiveAction ? !isArchived : isArchived;
      })
      .map((item) => getRowId(item));

    if (attemptsToUpdate.length === 0) return;

    setIsArchiving(true);
    try {
      await bulkArchiveAttemptsAction({
        body: {
          attemptIds: attemptsToUpdate,
          archived: archiveAction,
        },
      });

      toast.success(
        `${attemptsToUpdate.length} simulation attempt(s) ${archiveAction ? "archived" : "unarchived"} successfully`
      );

      // Clear selection after success
      table.resetRowSelection();
      setShowArchiveDialog(false);
      setArchiveAction(null);

      // Refresh the page to refetch data with updated archive status
      // router.refresh() preserves scroll position in Next.js App Router, so no scroll jump
      router.refresh();
    } catch {
      toast.error("Failed to update simulation archive status");
    } finally {
      setIsArchiving(false);
    }
  }, [archiveAction, table, bulkArchiveAttemptsAction, router]);

  return (
    <div className="space-y-4">
      <DataTableToolbar
        table={table}
        profileOptions={profileOptions}
        simulationOptions={simulationOptions}
        scenarioOptions={scenarioOptions}
        infiniteModeOptions={infiniteModeOptions}
        showExport={showExport}
        showAll={showAll}
        showArchive={showArchive}
        selectedAttempts={selectedAttempts}
        onBulkArchive={handleBulkArchive}
        onSelectAllVisibleRows={handleSelectAllVisibleRows}
        isServerDriven={isServerDriven}
        {...(onSearchChange ? { onSearchChange } : {})}
        {...(searchValue !== undefined ? { searchValue } : {})}
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
            {tableRows?.length ? (
              tableRows.map((row) => (
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
      <DataTablePagination table={table} />

      {/* Bulk Archive Confirmation Dialog */}
      <AlertDialog open={showArchiveDialog} onOpenChange={setShowArchiveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {archiveAction
                ? `Archive ${archiveCount} Simulation Attempt${archiveCount > 1 ? "s" : ""}`
                : `Unarchive ${unarchiveCount} Simulation Attempt${unarchiveCount > 1 ? "s" : ""}`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {archiveAction
                ? `Are you sure you want to archive ${archiveCount} simulation attempt${archiveCount > 1 ? "s" : ""}? They will be hidden from the main simulation list but can be accessed through archived filters.`
                : `Are you sure you want to unarchive ${unarchiveCount} simulation attempt${unarchiveCount > 1 ? "s" : ""}? They will be visible again in the main simulation list.`}
              <br />
              <br />
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isArchiving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={executeBulkArchive}
              disabled={isArchiving}
              className={isArchiving ? "opacity-50 cursor-not-allowed" : ""}
            >
              {isArchiving ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Processing...
                </div>
              ) : archiveAction ? (
                "Archive"
              ) : (
                "Unarchive"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
