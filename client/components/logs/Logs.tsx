/**
 * Logs.tsx
 * Used to display the logs page with table-based filtering and card layout.
 * @AshokSaravanan222 & @siladiea
 * 06/18/2025
 */
"use client";

import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import { BulkDeleteLogsDialog } from "./BulkDeleteLogsDialog";

import type {
  BulkDeleteLogsIn,
  BulkDeleteLogsOut,
  GetHealthCheckOut,
  LogsListOut,
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
import { formatTimestamp, getLogLevelVariant } from "@/utils/logs";
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
import { Activity, FileText, RefreshCw, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { HealthModal } from "./HealthModal";

export interface LogsProps {
  // Server-provided data (for server-side rendering)
  listData: LogsListOut;
  // Server actions (replaces useMutation)
  bulkDeleteLogsAction: (input: BulkDeleteLogsIn) => Promise<BulkDeleteLogsOut>;
  getHealthCheckAction: () => Promise<GetHealthCheckOut>;
}

export default function Logs({
  listData: serverListData,
  bulkDeleteLogsAction,
  getHealthCheckAction,
}: LogsProps) {
  const router = useRouter();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [showHealthModal, setShowHealthModal] = useState(false);

  // Table state
  const [rowSelection, setRowSelection] = useState({});
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({
    log_id: false,
    event: false, // Keep event hidden (logger_name is the new primary)
    context_provider: false,
    context_model: false,
    context_function: false,
    created_time: false,
    extra: false,
  });
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = useState<SortingState>([
    { id: "created_at", desc: true },
  ]);

  // Use server-provided data directly
  const logsData = serverListData;

  // Extract data from V3 response (new simplified structure)
  const logs = useMemo(() => {
    if (!logsData?.logs) return [];

    return logsData.logs.map((log) => {
      // Extract context fields from extra jsonb
      const extra = (log.extra as Record<string, unknown>) || {};
      const context = (extra["context"] as Record<string, unknown>) || {};

      // Helper to safely extract nested values
      const getExtraValue = (path: string): string | null => {
        const parts = path.split(".");
        let value: unknown = extra;
        for (const part of parts) {
          if (value && typeof value === "object" && value !== null) {
            value = (value as Record<string, unknown>)[part];
          } else {
            return null;
          }
        }
        return typeof value === "string" ? value : null;
      };

      // Safely extract values from extra/jsonb
      const getStringValue = (
        obj: Record<string, unknown>,
        key: string
      ): string | null => {
        const val = obj[key];
        return typeof val === "string" ? val : null;
      };

      return {
        log_id: log.log_id,
        logger_name: log.logger_name || "",
        level: log.level || "",
        message: log.message || "",
        profile_id: log.profile_id || "",
        extra: log.extra || null,
        created_at: log.created_at || "",
        actor_name: log.actor_name || "",
        // Extract context fields from extra for backward compatibility with filters
        context: {
          route:
            getStringValue(extra, "route") ||
            getStringValue(context, "route") ||
            getExtraValue("context.route") ||
            null,
          function:
            getStringValue(extra, "function") ||
            getStringValue(context, "function") ||
            getExtraValue("context.function") ||
            null,
          component:
            getStringValue(extra, "component") ||
            getStringValue(context, "component") ||
            getExtraValue("context.component") ||
            null,
          provider:
            getStringValue(extra, "provider") ||
            getStringValue(context, "provider") ||
            getExtraValue("context.provider") ||
            null,
          model:
            getStringValue(extra, "model") ||
            getStringValue(context, "model") ||
            getExtraValue("context.model") ||
            null,
        },
        // For backward compatibility - map logger_name to event
        event: log.logger_name || "",
        // Extract correlation_id from extra if present
        correlation_id:
          getStringValue(extra, "correlation_id") ||
          getStringValue(extra, "correlationId") ||
          null,
      };
    });
  }, [logsData?.logs]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      router.refresh();
      toast.success("Logs refreshed successfully");
    } catch {
      toast.error("Failed to refresh logs");
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleViewLog = useCallback((logItem: (typeof logs)[number]) => {
    setSelectedLog(logItem);
  }, []);

  const handleBulkDelete = () => {
    setShowBulkDeleteDialog(true);
  };

  const handleBulkDeleteSuccess = () => {
    // The query will be invalidated by the mutation hook
    // Dialog will close automatically after successful deletion
  };

  // Filter options using V2 typed JSONB fields
  const levelOptions = useMemo(
    () => [
      { value: "error", label: "Error" },
      { value: "warn", label: "Warn" },
      { value: "info", label: "Info" },
      { value: "debug", label: "Debug" },
    ],
    []
  );

  const {
    loggerNameOptions,
    providerOptions,
    modelOptions,
    actorOptions,
    componentOptions,
    functionOptions,
    dateOptions,
    timeOptions,
  } = useMemo(() => {
    // Extract logger names (replaces event)
    const loggerNames = new Set<string>(
      logs
        .map((l) => l.logger_name)
        .filter((v): v is string => typeof v === "string" && v !== "")
    );

    // Extract context fields from extra jsonb
    const providers = new Set<string>();
    const models = new Set<string>();
    const components = new Set<string>();
    const functions = new Set<string>();

    logs.forEach((l) => {
      const extra = (l.extra as Record<string, unknown>) || {};
      const context = (extra["context"] as Record<string, unknown>) || {};

      const getStringVal = (
        obj: Record<string, unknown>,
        key: string
      ): string | null => {
        const val = obj[key];
        return typeof val === "string" ? val : null;
      };

      const providerVal =
        getStringVal(extra, "provider") || getStringVal(context, "provider");
      if (providerVal) providers.add(providerVal);

      const modelVal =
        getStringVal(extra, "model") || getStringVal(context, "model");
      if (modelVal) models.add(modelVal);

      const componentVal =
        getStringVal(extra, "component") || getStringVal(context, "component");
      if (componentVal) components.add(componentVal);

      const functionVal =
        getStringVal(extra, "function") || getStringVal(context, "function");
      if (functionVal) functions.add(functionVal);

      // Also check legacy context structure for backward compatibility
      if (l.context?.provider) providers.add(l.context.provider);
      if (l.context?.model) models.add(l.context.model);
      if (l.context?.component) components.add(l.context.component);
      if (l.context?.function) functions.add(l.context.function);
    });

    const actors = new Set<string>(
      logs
        .map((l) => l.actor_name)
        .filter((v): v is string => typeof v === "string" && v !== "")
    );

    const dates = new Set<string>();
    const hours = new Set<number>();

    logs.forEach((logItem) => {
      if (logItem.created_at) {
        const date = new Date(logItem.created_at);
        // Format as MM/DD for date options
        const dateStr = `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}`;
        dates.add(dateStr);
        hours.add(date.getHours());
      }
    });

    return {
      loggerNameOptions: Array.from(loggerNames)
        .sort()
        .map((v) => ({ value: v, label: v })),
      providerOptions: Array.from(providers)
        .sort()
        .map((v) => ({ value: v, label: v })),
      modelOptions: Array.from(models)
        .sort()
        .map((v) => ({ value: v, label: v })),
      actorOptions: Array.from(actors)
        .sort()
        .map((v) => ({ value: v, label: v })),
      componentOptions: Array.from(components)
        .sort()
        .map((v) => ({ value: v, label: v })),
      functionOptions: Array.from(functions)
        .sort()
        .map((v) => ({ value: v, label: v })),
      dateOptions: Array.from(dates)
        .sort()
        .map((d) => ({ value: d, label: d })),
      timeOptions: Array.from(hours)
        .sort((a, b) => a - b)
        .map((h) => ({
          value: String(h),
          label: `${String(h).padStart(2, "0")}:00`,
        })),
    };
  }, [logs]);

  const [selectedLog, setSelectedLog] = useState<(typeof logs)[number] | null>(
    null
  );

  // Define columns with rich visual styling
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
        filterFn: (row, id, value) => {
          if (!value || value.length === 0) return true;
          const created = row.getValue(id) as string | null;
          if (!created) return false;
          const date = new Date(created);
          const dateStr = `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}`;
          return value.includes(dateStr);
        },
      },
      {
        id: "created_time",
        accessorFn: (row) => {
          if (!row.created_at) return null;
          return String(new Date(row.created_at).getHours());
        },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Time (Hour)" />
        ),
        cell: ({ row }) => {
          const hour = row.getValue("created_time") as string | null;
          if (!hour) return <span className="text-muted-foreground">N/A</span>;
          return <div className="text-sm">{`${hour.padStart(2, "0")}:00`}</div>;
        },
        enableSorting: true,
        filterFn: (row, id, value) => {
          if (!value || value.length === 0) return true;
          const hour = row.getValue(id) as string | null;
          return hour ? value.includes(hour) : false;
        },
      },
      {
        accessorKey: "log_id",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="ID" />
        ),
        cell: ({ row }) => (
          <div className="font-medium">{row.getValue("log_id")}</div>
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
        filterFn: (row, id, value) => {
          if (!value || value.length === 0) return true;
          const loggerName = (row.getValue(id) as string) ?? "";
          return value.includes(loggerName);
        },
        enableSorting: true,
      },
      {
        accessorKey: "event",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Event" />
        ),
        cell: ({ row }) => {
          const event = row.getValue("event") as string;
          return (
            <span className="truncate max-w-xs inline-block">{event}</span>
          );
        },
        filterFn: (row, id, value) => {
          if (!value || value.length === 0) return true;
          const event = (row.getValue(id) as string) ?? "";
          return value.includes(event);
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
        filterFn: (row, id, value) => {
          return value.includes(row.getValue(id));
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
        filterFn: (row, id, value) => {
          if (!value || value.length === 0) return true;
          const v = (row.getValue(id) as string | null) ?? "";
          return value.includes(v);
        },
        enableSorting: true,
      },
      {
        id: "context_component",
        accessorFn: (row) => {
          // Extract from extra jsonb or legacy context
          const extra = (row.extra as Record<string, unknown>) || {};
          const context = (extra["context"] as Record<string, unknown>) || {};
          const extraComponent =
            typeof extra["component"] === "string" ? extra["component"] : null;
          const contextComponent =
            typeof context["component"] === "string"
              ? context["component"]
              : null;
          return (
            extraComponent || contextComponent || row.context?.component || null
          );
        },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Component" />
        ),
        cell: ({ row }) => {
          const v =
            (row.getValue("context_component") as string | null) ?? null;
          return v ? v : <span className="text-muted-foreground">N/A</span>;
        },
        filterFn: (row, id, value) => {
          if (!value || value.length === 0) return true;
          const v = (row.getValue(id) as string | null) ?? "";
          return value.includes(v);
        },
        enableSorting: true,
      },
      {
        id: "context_function",
        accessorFn: (row) => {
          // Extract from extra jsonb or legacy context
          const extra = (row.extra as Record<string, unknown>) || {};
          const context = (extra["context"] as Record<string, unknown>) || {};
          const extraFunction =
            typeof extra["function"] === "string" ? extra["function"] : null;
          const contextFunction =
            typeof context["function"] === "string"
              ? context["function"]
              : null;
          return (
            extraFunction || contextFunction || row.context?.function || null
          );
        },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Function" />
        ),
        cell: ({ row }) => {
          const v = (row.getValue("context_function") as string | null) ?? null;
          return v ? v : <span className="text-muted-foreground">N/A</span>;
        },
        filterFn: (row, id, value) => {
          if (!value || value.length === 0) return true;
          const v = (row.getValue(id) as string | null) ?? "";
          return value.includes(v);
        },
        enableSorting: true,
      },
      {
        id: "context_provider",
        accessorFn: (row) => {
          // Extract from extra jsonb or legacy context
          const extra = (row.extra as Record<string, unknown>) || {};
          const context = (extra["context"] as Record<string, unknown>) || {};
          const extraProvider =
            typeof extra["provider"] === "string" ? extra["provider"] : null;
          const contextProvider =
            typeof context["provider"] === "string"
              ? context["provider"]
              : null;
          return (
            extraProvider || contextProvider || row.context?.provider || null
          );
        },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Provider" />
        ),
        cell: ({ row }) => {
          const provider =
            (row.getValue("context_provider") as string | null) ?? null;
          return provider ? (
            provider
          ) : (
            <span className="text-muted-foreground">N/A</span>
          );
        },
        filterFn: (row, id, value) => {
          if (!value || value.length === 0) return true;
          const v = (row.getValue(id) as string | null) ?? "";
          return value.includes(v);
        },
        enableSorting: true,
      },
      {
        id: "context_model",
        accessorFn: (row) => {
          // Extract from extra jsonb or legacy context
          const extra = (row.extra as Record<string, unknown>) || {};
          const context = (extra["context"] as Record<string, unknown>) || {};
          const extraModel =
            typeof extra["model"] === "string" ? extra["model"] : null;
          const contextModel =
            typeof context["model"] === "string" ? context["model"] : null;
          return extraModel || contextModel || row.context?.model || null;
        },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Model" />
        ),
        cell: ({ row }) => {
          const model =
            (row.getValue("context_model") as string | null) ?? null;
          return model ? (
            model
          ) : (
            <span className="text-muted-foreground">N/A</span>
          );
        },
        filterFn: (row, id, value) => {
          if (!value || value.length === 0) return true;
          const v = (row.getValue(id) as string | null) ?? "";
          return value.includes(v);
        },
        enableSorting: true,
      },
      {
        id: "extra",
        accessorKey: "extra",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Extra" />
        ),
        cell: ({ row }) => {
          const extra = row.getValue("extra");
          return extra ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleViewLog(row.original)}
              className="h-8 px-2"
            >
              <FileText className="h-3 w-3 mr-1" />
              View JSON
            </Button>
          ) : (
            <span className="text-muted-foreground">None</span>
          );
        },
        enableSorting: false,
      },
    ],
    [handleViewLog]
  );

  // Create table instance
  const table = useReactTable({
    data: logs,
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
        pageSize: 20,
      },
      columnVisibility: {
        log_id: false,
        event: false,
        context_provider: false,
        context_model: false,
        context_function: false,
        created_time: false,
        extra: false,
      } as VisibilityState,
    },
  });

  // Memoize table rows to avoid calling getRowModel() multiple times and prevent re-render issues
  // Extract pagination primitives directly to avoid object reference issues
  const pageIndex = table.getState().pagination.pageIndex;
  const pageSize = table.getState().pagination.pageSize;
  // Stringify arrays for stable comparison (arrays are compared by reference)
  const sortingKey = JSON.stringify(sorting);
  const columnFiltersKey = JSON.stringify(columnFilters);
  const tableRows = useMemo(() => {
    return table.getRowModel().rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    // Use JSON.stringify for arrays to ensure stable comparison (arrays are compared by reference)
    sortingKey,
    columnFiltersKey,
    logs.length,
    // Use pagination primitives directly (not object references)
    pageIndex,
    pageSize,
  ]);

  // Get column references for toolbar
  const loggerNameColumn = table.getColumn("logger_name");
  const levelColumn = table.getColumn("level");
  const actorColumn = table.getColumn("actor_name");
  const componentColumn = table.getColumn("context_component");
  const functionColumn = table.getColumn("context_function");
  const providerColumn = table.getColumn("context_provider");
  const modelColumn = table.getColumn("context_model");
  const createdAtColumn = table.getColumn("created_at");
  const createdTimeColumn = table.getColumn("created_time");
  const isFiltered = table.getState().columnFilters.length > 0;

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        {/* Toolbar */}
        <div className="flex items-center justify-between">
          <div className="flex flex-1 items-center space-x-2 flex-wrap">
            <div className="w-full md:w-auto mb-2 md:mb-0">
              <Input
                placeholder="Search by logger..."
                value={(loggerNameColumn?.getFilterValue() as string) ?? ""}
                onChange={(event) =>
                  loggerNameColumn?.setFilterValue(event.target.value)
                }
                className="h-8 w-full md:w-[150px] lg:w-[250px]"
              />
            </div>

            <div className="flex items-center space-x-2 flex-wrap mb-2">
              {/* Level Filter */}
              {levelColumn && levelOptions.length > 0 && (
                <DataTableFacetedFilter
                  column={levelColumn}
                  title="Level"
                  options={levelOptions}
                />
              )}

              {/* Logger Name Filter */}
              {loggerNameColumn && loggerNameOptions.length > 0 && (
                <DataTableFacetedFilter
                  column={loggerNameColumn}
                  title="Logger"
                  options={loggerNameOptions}
                />
              )}

              {/* Provider Filter */}
              {providerColumn && providerOptions.length > 0 && (
                <DataTableFacetedFilter
                  column={providerColumn}
                  title="Provider"
                  options={providerOptions}
                />
              )}

              {/* Model Filter */}
              {modelColumn && modelOptions.length > 0 && (
                <DataTableFacetedFilter
                  column={modelColumn}
                  title="Model"
                  options={modelOptions}
                />
              )}

              {/* Actor Filter */}
              {actorColumn && actorOptions.length > 0 && (
                <DataTableFacetedFilter
                  column={actorColumn}
                  title="Actor"
                  options={actorOptions}
                />
              )}

              {/* Component Filter */}
              {componentColumn && componentOptions.length > 0 && (
                <DataTableFacetedFilter
                  column={componentColumn}
                  title="Component"
                  options={componentOptions}
                />
              )}

              {/* Function Filter */}
              {functionColumn && functionOptions.length > 0 && (
                <DataTableFacetedFilter
                  column={functionColumn}
                  title="Function"
                  options={functionOptions}
                />
              )}

              {/* Date Filter */}
              {createdAtColumn && dateOptions.length > 0 && (
                <DataTableFacetedFilter
                  column={createdAtColumn}
                  title="Date"
                  options={dateOptions}
                />
              )}

              {/* Time Filter */}
              {createdTimeColumn && timeOptions.length > 0 && (
                <DataTableFacetedFilter
                  column={createdTimeColumn}
                  title="Hour"
                  options={timeOptions}
                />
              )}

              {isFiltered && (
                <Button
                  variant="ghost"
                  onClick={() => table.resetColumnFilters()}
                  className="h-8 px-2 lg:px-3 hidden md:flex"
                >
                  Reset
                  <X className="ml-2 h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Bulk Delete Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleBulkDelete}
              className="h-8 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
            {/* Refresh Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="h-8 px-2"
            >
              <RefreshCw
                className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
              />
            </Button>

            {/* Health Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowHealthModal(true)}
              className="h-8 px-2"
            >
              <Activity className="h-4 w-4" />
            </Button>

            {/* Column Visibility */}
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
                              header.getContext()
                            )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {tableRows.length ? (
                tableRows.map((row) => (
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
                    colSpan={columns.length}
                    className="h-24 text-center text-muted-foreground"
                  >
                    No logs match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <DataTablePagination table={table} />
      </div>

      {/* Health Modal */}
      <HealthModal
        open={showHealthModal}
        onOpenChange={setShowHealthModal}
        getHealthCheckAction={getHealthCheckAction}
      />

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
                      {selectedLog.logger_name || selectedLog.event}
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
                    {selectedLog.created_at ?? ""}
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
                  {selectedLog.correlation_id && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground">
                        Correlation:
                      </span>{" "}
                      <span className="font-mono text-xs">
                        {selectedLog.correlation_id}
                      </span>
                    </div>
                  )}
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Message:</span>{" "}
                    <div className="mt-1 p-2 bg-muted rounded text-xs">
                      {selectedLog.message}
                    </div>
                  </div>
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
        logs={logs}
        onSuccess={handleBulkDeleteSuccess}
        bulkDeleteLogsAction={bulkDeleteLogsAction}
      />
    </div>
  );
}
