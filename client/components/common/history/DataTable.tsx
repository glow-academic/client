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

import { Checkbox } from "@/components/ui/checkbox";
import {
  useUpdateSimulationAttempt,
  useUpdateSimulationAttempts,
} from "@/lib/api/hooks/simulation_attempts";
import { log } from "@/utils/logger";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { DataTablePagination } from "./DataTablePagination";
import { DataTableToolbar } from "./DataTableToolbar";

// Type for the enhanced attempt data
interface EnhancedAttempt {
  id: string;
  archived: boolean;
  [key: string]: unknown;
}

export interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  profileOptions: { value: string; label: string }[];
  simulationOptions: { value: string; label: string }[];
  scenarioOptions?: { value: string; label: string }[];
  showExport?: boolean;
  showArchive?: boolean;
  showAll?: boolean;
  startDate?: Date | undefined;
  endDate?: Date | undefined;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  profileOptions,
  simulationOptions,
  scenarioOptions = [],
  showExport = true,
  showArchive = false,
  showAll = false,
  startDate: _startDate,
  endDate: _endDate,
}: DataTableProps<TData, TValue>) {
  const [rowSelection, setRowSelection] = React.useState({});
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({
      // Hide search column by default since it's only used for internal filtering
      search: false,
    });
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  );
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: "createdAt", desc: true }, // Default to descending order by date
  ]);

  // State for selected attempts when showArchive is true
  const [selectedAttempts, setSelectedAttempts] = React.useState<string[]>([]);
  const [showArchiveDialog, setShowArchiveDialog] = React.useState(false);
  const [archiveAction, setArchiveAction] = React.useState<boolean | null>(
    null
  );
  const [isArchiving, setIsArchiving] = React.useState(false);
  const queryClient = useQueryClient();
  const updateSimulationAttemptMutation = useUpdateSimulationAttempt();
  const updateSimulationAttemptsMutation = useUpdateSimulationAttempts();

  // Handle attempt selection
  const _handleAttemptSelect = React.useCallback(
    (attemptId: string, checked: boolean) => {
      if (checked) {
        setSelectedAttempts((prev) => [...prev, attemptId]);
      } else {
        setSelectedAttempts((prev) => prev.filter((id) => id !== attemptId));
      }
    },
    []
  );

  // Handle select all
  const _handleSelectAll = React.useCallback(
    (checked: boolean) => {
      if (checked) {
        setSelectedAttempts(data.map((item) => (item as EnhancedAttempt).id));
      } else {
        setSelectedAttempts([]);
      }
    },
    [data]
  );

  // Calculate archive/unarchive counts
  const { archiveCount, unarchiveCount } = React.useMemo(() => {
    const archiveCount = selectedAttempts.filter((attemptId) => {
      const item = data.find(
        (item) => (item as unknown as EnhancedAttempt).id === attemptId
      );
      return item && !(item as unknown as EnhancedAttempt).archived;
    }).length;

    const unarchiveCount = selectedAttempts.filter((attemptId) => {
      const item = data.find(
        (item) => (item as unknown as EnhancedAttempt).id === attemptId
      );
      return item && (item as unknown as EnhancedAttempt).archived;
    }).length;

    return { archiveCount, unarchiveCount };
  }, [selectedAttempts, data]);

  // Handle bulk archive
  const handleBulkArchive = React.useCallback(async (archive: boolean) => {
    setArchiveAction(archive);
    setShowArchiveDialog(true);
  }, []);

  // Execute bulk archive
  const executeBulkArchive = React.useCallback(async () => {
    if (archiveAction === null) return;

    const attemptsToUpdate = selectedAttempts.filter((attemptId) => {
      const item = data.find(
        (item) => (item as unknown as EnhancedAttempt).id === attemptId
      );
      if (!item) return false;

      const isCurrentlyArchived = (item as unknown as EnhancedAttempt).archived;
      return archiveAction ? !isCurrentlyArchived : isCurrentlyArchived;
    });

    if (attemptsToUpdate.length === 0) return;

    setIsArchiving(true);
    try {
      // Use bulk update for efficiency
      await updateSimulationAttemptsMutation.mutateAsync({
        updates: attemptsToUpdate.map((attemptId) => ({
          id: attemptId,
          archived: archiveAction,
        })),
      });

      // Log success for each attempt
      for (const attemptId of attemptsToUpdate) {
        await log.info("simulation_attempt.bulk_archive.success", {
          message: `Simulation attempt ${archiveAction ? "archived" : "unarchived"}`,
          subject: { entityType: "simulation_attempt", entityId: attemptId },
          context: {
            component: "DataTable",
            function: "executeBulkArchive",
            action: archiveAction ? "archive" : "unarchive",
          },
        });
      }

      toast.success(
        `${attemptsToUpdate.length} simulation attempt(s) ${archiveAction ? "archived" : "unarchived"} successfully`
      );

      // Only close dialog and reset state after successful completion
      setSelectedAttempts([]);
      setShowArchiveDialog(false);
      setArchiveAction(null);

      // Invalidate relevant queries to refresh the data
      queryClient.invalidateQueries({ queryKey: ["simulationAttempts"] });
    } catch (error) {
      await log.error("simulation_attempt.bulk_archive.failed", {
        message: "Error bulk archiving simulation attempts",
        subject: { entityType: "simulation_attempt" },
        context: {
          component: "DataTable",
          function: "executeBulkArchive",
          action: archiveAction ? "archive" : "unarchive",
          count: attemptsToUpdate.length,
        },
        error,
      });
      toast.error("Failed to update simulation archive status");
    } finally {
      setIsArchiving(false);
    }
  }, [
    archiveAction,
    selectedAttempts,
    data,
    queryClient,
    updateSimulationAttemptMutation,
  ]);

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
            table.toggleAllPageRowsSelected(!!value);
            _handleSelectAll(!!value);
          }}
          aria-label="Select all"
          className="translate-y-[2px]"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={selectedAttempts.includes(
            (row.original as unknown as EnhancedAttempt).id
          )}
          onCheckedChange={(value) =>
            _handleAttemptSelect(
              (row.original as unknown as EnhancedAttempt).id,
              !!value
            )
          }
          aria-label="Select row"
          className="translate-y-[2px]"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    };

    return [checkboxColumn, ...columns];
  }, [
    columns,
    showArchive,
    selectedAttempts,
    _handleSelectAll,
    _handleAttemptSelect,
  ]);

  const table = useReactTable({
    data,
    columns: columnsWithCheckbox,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
      columnFilters,
    },
    enableRowSelection: showArchive,
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

  return (
    <div className="space-y-4">
      <DataTableToolbar
        table={table}
        profileOptions={profileOptions}
        simulationOptions={simulationOptions}
        scenarioOptions={scenarioOptions}
        showExport={showExport}
        showAll={showAll}
        showArchive={showArchive}
        selectedAttempts={selectedAttempts}
        onBulkArchive={handleBulkArchive}
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
              <span className="text-sm text-muted-foreground">
                This action cannot be undone.
              </span>
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
