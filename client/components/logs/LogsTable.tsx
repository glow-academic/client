"use client";

/**
 * LogsTable.tsx
 * Table component for logs with filters, pagination, and sorting.
 */

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { BulkDeleteLogsDialog } from "./BulkDeleteLogsDialog";
import type {
  BulkDeleteLogsIn,
  BulkDeleteLogsOut,
  LogsRunsOut,
} from "@/app/(main)/system/logs/page";
import { DataTableColumnHeader } from "@/components/common/table/DataTableColumnHeader";
import { DataTableFacetedFilter } from "@/components/common/table/DataTableFacetedFilter";
import { DataTablePagination } from "@/components/common/table/DataTablePagination";
import { DataTableViewOptions } from "@/components/common/table/DataTableViewOptions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { formatTimestamp, getLogLevelVariant } from "@/utils/logs";
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { FileText, RefreshCw, Trash2, X } from "lucide-react";

export interface LogsTableProps {
  runsData: LogsRunsOut;
  isLoading: boolean;
  bulkDeleteLogsAction: (input: BulkDeleteLogsIn) => Promise<BulkDeleteLogsOut>;
}

export default function LogsTable({
  runsData,
  isLoading,
  bulkDeleteLogsAction,
}: LogsTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [selectedLog, setSelectedLog] = useState<
    LogsRunsOut["data"][number] | null
  >(null);

  // Ref for the search input
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Local search state, initialized from URL
  const [searchTerm, setSearchTerm] = useState(
    searchParams.get("logsSearch") || "",
  );

  // Ref to track debounce timeout for search
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Keep local state in sync if URL changes (back/forward, link, etc.)
  useEffect(() => {
    const urlSearch = searchParams.get("logsSearch") || "";
    setSearchTerm(urlSearch);
  }, [searchParams]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  // Helper to update URL params (removes default values)
  const updateURLParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([key, value]) => {
        if (value === null || value === "") {
          params.delete(key);
        } else {
          // Remove default values from URL
          if (key === "logsPage" && value === "0") {
            params.delete(key);
          } else if (key === "logsPageSize" && value === "10") {
            params.delete(key);
          } else if (key === "logsSortBy" && value === "createdAt") {
            params.delete(key);
          } else if (key === "logsSortOrder" && value === "desc") {
            params.delete(key);
          } else {
            params.set(key, value);
          }
        }
      });
      router.push(`?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  // Commit search to URL (called on Enter or blur, or after debounce)
  const commitSearch = useCallback(
    (value: string) => {
      updateURLParams({
        logsPage: "0",
        logsSearch: value.trim() || null,
      });
    },
    [updateURLParams],
  );

  // Handle search input change with debounce
  const handleSearchChange = useCallback(
    (value: string) => {
      // Update local state immediately for responsive UI
      setSearchTerm(value);

      // Clear existing timeout
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }

      // If query becomes empty, commit immediately (no debounce)
      if (value === "") {
        commitSearch("");
        return;
      }

      // Otherwise, debounce the search (500ms delay)
      searchTimeoutRef.current = setTimeout(() => {
        commitSearch(value);
      }, 500);
    },
    [commitSearch],
  );

  // Sync URL params for sorting
  const sortBy = searchParams.get("logsSortBy") || "createdAt";
  const sortOrder = searchParams.get("logsSortOrder") || "desc";
  const sorting: SortingState = useMemo(
    () => [
      {
        id: sortBy === "createdAt" ? "created_at" : sortBy,
        desc: sortOrder === "desc",
      },
    ],
    [sortBy, sortOrder],
  );

  // Sync URL params for filters
  const logsLevelsParam = searchParams.get("logsLevels");
  const logsLoggerNamesParam = searchParams.get("logsLoggerNames");
  const logsActorNamesParam = searchParams.get("logsActorNames");

  const logsLevels = useMemo(
    () => (logsLevelsParam ? logsLevelsParam.split(",").filter(Boolean) : []),
    [logsLevelsParam],
  );
  const logsLoggerNames = useMemo(
    () =>
      logsLoggerNamesParam
        ? logsLoggerNamesParam.split(",").filter(Boolean)
        : [],
    [logsLoggerNamesParam],
  );
  const logsActorNames = useMemo(
    () =>
      logsActorNamesParam ? logsActorNamesParam.split(",").filter(Boolean) : [],
    [logsActorNamesParam],
  );

  // Sync column filters with URL params (for DataTableFacetedFilter compatibility)
  const columnFilters: ColumnFiltersState = useMemo(() => {
    const filters: ColumnFiltersState = [];
    if (logsLevels.length > 0) {
      filters.push({ id: "level", value: logsLevels });
    }
    if (logsLoggerNames.length > 0) {
      filters.push({ id: "logger_name", value: logsLoggerNames });
    }
    if (logsActorNames.length > 0) {
      filters.push({ id: "actor_name", value: logsActorNames });
    }
    return filters;
  }, [logsLevels, logsLoggerNames, logsActorNames]);

  // Sync URL params for pagination
  const page = parseInt(searchParams.get("logsPage") || "0", 10);
  const pageSize = parseInt(searchParams.get("logsPageSize") || "10", 10);

  // Column visibility state
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});

  // Logs table columns
  const logs = useMemo(() => runsData?.data || [], [runsData]);
  const columns = useMemo<ColumnDef<(typeof logs)[number]>[]>(
    () => [
      {
        accessorKey: "created_at",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Created At" />
        ),
        cell: ({ row }) => (
          <div className="text-sm">
            {formatTimestamp(row.getValue("created_at"))}
          </div>
        ),
        enableSorting: true,
      },
      {
        accessorKey: "id",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="ID" />
        ),
        cell: ({ row }) => (
          <div className="font-medium font-mono text-xs">
            {row.getValue("id")}
          </div>
        ),
        enableSorting: true,
      },
      {
        accessorKey: "logger_name",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Logger" />
        ),
        cell: ({ row }) => {
          const loggerName = row.getValue("logger_name") as string;
          return (
            <span
              className="truncate max-w-xs inline-block font-mono text-xs"
              title={loggerName}
            >
              {loggerName}
            </span>
          );
        },
        enableSorting: true,
      },
      {
        accessorKey: "level",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Level" />
        ),
        cell: ({ row }) => {
          const level = row.getValue("level") as string;
          return (
            <Badge variant={getLogLevelVariant(level)}>
              {level.toUpperCase()}
            </Badge>
          );
        },
        enableSorting: true,
      },
      {
        accessorKey: "actor_name",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Actor" />
        ),
        cell: ({ row }) => {
          const actorName = row.getValue("actor_name") as string | null;
          return actorName ? (
            <span className="font-mono text-xs">{actorName}</span>
          ) : (
            <span className="text-muted-foreground">N/A</span>
          );
        },
        enableSorting: true,
      },
      {
        accessorKey: "extra",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Extra" />
        ),
        cell: ({ row }) => {
          return (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedLog(row.original)}
              className="h-8 px-2"
            >
              <FileText className="h-3 w-3 mr-1" />
              View JSON
            </Button>
          );
        },
      },
    ],
    [],
  );

  const handleColumnFiltersChange = useCallback(
    (
      updater:
        | ColumnFiltersState
        | ((prev: ColumnFiltersState) => ColumnFiltersState),
    ) => {
      const newFilters =
        typeof updater === "function" ? updater(columnFilters) : updater;
      const levelFilter = newFilters.find((f) => f.id === "level");
      const loggerFilter = newFilters.find((f) => f.id === "logger_name");
      const actorFilter = newFilters.find((f) => f.id === "actor_name");

      updateURLParams({
        logsPage: "0",
        logsLevels:
          levelFilter &&
          Array.isArray(levelFilter.value) &&
          levelFilter.value.length > 0
            ? levelFilter.value.join(",")
            : null,
        logsLoggerNames:
          loggerFilter &&
          Array.isArray(loggerFilter.value) &&
          loggerFilter.value.length > 0
            ? loggerFilter.value.join(",")
            : null,
        logsActorNames:
          actorFilter &&
          Array.isArray(actorFilter.value) &&
          actorFilter.value.length > 0
            ? actorFilter.value.join(",")
            : null,
      });
    },
    [columnFilters, updateURLParams],
  );

  const table = useReactTable({
    data: logs,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: (updater) => {
      const newSorting =
        typeof updater === "function" ? updater(sorting) : updater;
      if (newSorting && newSorting.length > 0) {
        const sort = newSorting[0];
        if (sort) {
          const sortBy = sort.id === "created_at" ? "createdAt" : sort.id;
          const sortOrder = sort.desc ? "desc" : "asc";
          updateURLParams({
            logsPage: "0",
            logsSortBy: sortBy,
            logsSortOrder: sortOrder,
          });
        }
      }
    },
    onColumnFiltersChange: handleColumnFiltersChange,
    onPaginationChange: (updater) => {
      const newPagination =
        typeof updater === "function"
          ? updater({ pageIndex: page, pageSize })
          : updater;
      if (newPagination.pageIndex !== undefined) {
        updateURLParams({
          logsPage: newPagination.pageIndex.toString(),
        });
      }
      if (newPagination.pageSize !== undefined) {
        updateURLParams({
          logsPage: "0",
          logsPageSize: newPagination.pageSize.toString(),
        });
      }
    },
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      pagination: {
        pageIndex: page,
        pageSize,
      },
    },
    onColumnVisibilityChange: setColumnVisibility,
    manualPagination: true,
    manualFiltering: true,
    pageCount: runsData?.totalPages || 0,
  });

  const handleRefresh = useCallback(() => {
    router.refresh();
  }, [router]);

  const handleBulkDelete = () => {
    setShowBulkDeleteDialog(true);
  };

  const handleBulkDeleteSuccess = useCallback(() => {
    router.refresh();
  }, [router]);

  const levelColumn = table.getColumn("level");
  const loggerNameColumn = table.getColumn("logger_name");
  const actorColumn = table.getColumn("actor_name");

  const levelOptions = useMemo(
    () =>
      runsData?.levelOptions?.map((opt) => ({
        value: opt.value,
        label: opt.label,
        count: opt.count,
      })) || [],
    [runsData],
  );

  const loggerOptions = useMemo(
    () =>
      runsData?.loggerOptions?.map((opt) => ({
        value: opt.value,
        label: opt.label,
        count: opt.count,
      })) || [],
    [runsData],
  );

  const actorOptions = useMemo(
    () =>
      runsData?.actorOptions?.map((opt) => ({
        value: opt.value,
        label: opt.label,
        count: opt.count,
      })) || [],
    [runsData],
  );

  const isFiltered = columnFilters.length > 0 || searchTerm.length > 0;

  return (
    <>
      <div className="space-y-3">
        {/* Filters + Search + Toolbar */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <div className="flex flex-col md:flex-row md:flex-1 md:items-center md:space-x-2 gap-2 md:gap-0">
            {/* Search bar */}
            <div className="w-full md:w-auto">
              <Input
                ref={searchInputRef}
                placeholder="Search logs..."
                value={searchTerm}
                onChange={(e) => handleSearchChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.currentTarget.blur();
                    commitSearch(searchTerm);
                  }
                }}
                onBlur={() => commitSearch(searchTerm)}
                className="h-8 w-full md:w-[200px]"
              />
            </div>

            {/* Filters */}
            {isLoading ? (
              <>
                {/* Skeleton filters - show typical filter layout */}
                <Skeleton className="h-8 w-[120px]" />
                <Skeleton className="h-8 w-[140px]" />
                <Skeleton className="h-8 w-[160px]" />
              </>
            ) : (
              <>
                {levelColumn && levelOptions.length > 0 && (
                  <DataTableFacetedFilter
                    column={levelColumn}
                    title="Level"
                    options={levelOptions}
                    isServerDriven={true}
                  />
                )}
                {loggerNameColumn && loggerOptions.length > 0 && (
                  <DataTableFacetedFilter
                    column={loggerNameColumn}
                    title="Logger"
                    options={loggerOptions}
                    isServerDriven={true}
                  />
                )}
                {actorColumn && actorOptions.length > 0 && (
                  <DataTableFacetedFilter
                    column={actorColumn}
                    title="Actor"
                    options={actorOptions}
                    isServerDriven={true}
                  />
                )}
              </>
            )}

            {isFiltered && !isLoading && (
              <Button
                variant="ghost"
                onClick={() => {
                  updateURLParams({
                    logsPage: "0",
                    logsSearch: null,
                    logsLevels: null,
                    logsLoggerNames: null,
                    logsActorNames: null,
                  });
                }}
                className="h-8 px-2 lg:px-3 hidden md:flex"
              >
                Reset
                <X className="ml-2 h-4 w-4" />
              </Button>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleBulkDelete}
              className="h-8 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isLoading}
              className="h-8 px-2"
            >
              <RefreshCw
                className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
              />
            </Button>
            <DataTableViewOptions table={table} />
          </div>
        </div>

        {/* Table */}
        <div className="border rounded-lg overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="px-4 py-3 text-left text-sm font-medium"
                    >
                      {header.isPlaceholder
                        ? null
                        : typeof header.column.columnDef.header === "string"
                          ? header.column.columnDef.header
                          : header.column.columnDef.header?.(
                              header.getContext(),
                            )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {isLoading ? (
                // Skeleton rows
                Array.from({ length: pageSize }).map((_, idx) => (
                  <tr key={`skeleton-${idx}`} className="border-b">
                    {table.getVisibleLeafColumns().map((column) => (
                      <td key={column.id} className="px-4 py-3">
                        <Skeleton className="h-4 w-full" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : table.getRowModel().rows.length > 0 ? (
                table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b hover:bg-muted/50 transition-colors"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-4 py-3 text-sm">
                        {typeof cell.column.columnDef.cell === "function"
                          ? cell.column.columnDef.cell(cell.getContext())
                          : cell.getValue()}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={table.getVisibleLeafColumns().length || 1}
                    className="h-24 text-center text-muted-foreground"
                  >
                    No logs found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {isLoading ? (
          <div className="flex items-center justify-between px-2">
            <div className="flex-1 text-sm text-muted-foreground">
              <Skeleton className="h-4 w-[200px]" />
            </div>
            <div className="flex items-center space-x-2">
              <Skeleton className="h-8 w-[100px]" />
              <Skeleton className="h-8 w-[100px]" />
            </div>
          </div>
        ) : (
          runsData && <DataTablePagination table={table} />
        )}
      </div>

      {/* Detail Dialog */}
      <Dialog
        open={selectedLog !== null}
        onOpenChange={(open) => !open && setSelectedLog(null)}
      >
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogDescription hidden>
            This dialog shows the log details.
          </DialogDescription>
          <div className="space-y-4">
            {selectedLog && (
              <div className="pt-4 pb-4 space-y-3">
                {/* Render a compact overview */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Logger:</span>{" "}
                    <span className="font-mono text-xs">
                      {selectedLog.logger_name}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Level:</span>{" "}
                    <Badge variant={getLogLevelVariant(selectedLog.level)}>
                      {selectedLog.level.toUpperCase()}
                    </Badge>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Created:</span>{" "}
                    {formatTimestamp(selectedLog.created_at)}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Profile ID:</span>{" "}
                    <span className="font-mono text-xs">
                      {selectedLog.profile_id || "N/A"}
                    </span>
                  </div>
                  {selectedLog.actor_name && (
                    <div>
                      <span className="text-muted-foreground">Actor:</span>{" "}
                      {selectedLog.actor_name}
                    </div>
                  )}
                  {(() => {
                    const extra = selectedLog.extra as Record<
                      string,
                      unknown
                    > | null;
                    const correlationId =
                      extra?.["correlation_id"] || extra?.["correlationId"];
                    return correlationId &&
                      typeof correlationId === "string" ? (
                      <div className="col-span-2">
                        <span className="text-muted-foreground">
                          Correlation:
                        </span>{" "}
                        <span className="font-mono text-xs">
                          {correlationId}
                        </span>
                      </div>
                    ) : null;
                  })()}
                  {selectedLog.message && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Message:</span>{" "}
                      <div className="mt-1 p-2 bg-muted rounded text-xs">
                        {selectedLog.message}
                      </div>
                    </div>
                  )}
                </div>

                {/* Extra JSONB data */}
                {selectedLog.extra && (
                  <div className="space-y-2">
                    <div className="text-sm font-medium">Extra Data:</div>
                    <div className="bg-muted p-4 rounded-lg">
                      <pre className="whitespace-pre-wrap text-xs font-mono">
                        {JSON.stringify(selectedLog.extra, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}

                {/* Full JSON (for debugging) */}
                <details className="mt-4">
                  <summary className="text-sm font-medium cursor-pointer">
                    Full JSON (Debug)
                  </summary>
                  <div className="bg-muted p-4 rounded-lg mt-2">
                    <pre className="whitespace-pre-wrap text-xs font-mono">
                      {JSON.stringify(selectedLog, null, 2)}
                    </pre>
                  </div>
                </details>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Dialog */}
      <BulkDeleteLogsDialog
        open={showBulkDeleteDialog}
        onOpenChange={setShowBulkDeleteDialog}
        logs={logs.map((l) => ({
          log_id: l.id,
          logger_name: l.logger_name,
          level: l.level,
          message: "",
          profile_id: "",
          extra: l.extra || null,
          created_at: l.created_at,
          actor_name: l.actor_name,
        }))}
        onSuccess={handleBulkDeleteSuccess}
        bulkDeleteLogsAction={bulkDeleteLogsAction}
      />
    </>
  );
}
