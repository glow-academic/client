/**
 * Logs.tsx
 * Interactive dashboard for logs with health KPIs, metrics graph, feedback, and logs table.
 * @AshokSaravanan222 & @siladiea
 * 06/18/2025
 */
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { BulkDeleteLogsDialog } from "./BulkDeleteLogsDialog";
import AuthenticationKPI from "./kpis/AuthenticationKPI";
import DatabaseKPI from "./kpis/DatabaseKPI";
import DocumentKPI from "./kpis/DocumentKPI";
import RedisKPI from "./kpis/RedisKPI";
import WebSocketKPI from "./kpis/WebSocketKPI";

import type {
  BulkDeleteLogsIn,
  BulkDeleteLogsOut,
  LogsBundleOut,
  LogsRunsIn,
  LogsRunsOut,
} from "@/app/(main)/system/logs/page";
import { DataTableColumnHeader } from "@/components/common/table/DataTableColumnHeader";
import { DataTableFacetedFilter } from "@/components/common/table/DataTableFacetedFilter";
import { DataTablePagination } from "@/components/common/table/DataTablePagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { FileText, RefreshCw, Trash2, X } from "lucide-react";

export interface LogsProps {
  // Server-provided data (for server-side rendering)
  bundleData: LogsBundleOut;
  // Server actions
  getLogsRunsAction: (input: LogsRunsIn) => Promise<LogsRunsOut>;
  bulkDeleteLogsAction: (input: BulkDeleteLogsIn) => Promise<BulkDeleteLogsOut>;
}

export default function Logs({
  bundleData: serverBundleData,
  getLogsRunsAction,
  bulkDeleteLogsAction,
}: LogsProps) {
  const router = useRouter();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [selectedLog, setSelectedLog] = useState<LogsRunsOut["data"][number] | null>(null);

  // Logs table state
  const [logsData, setLogsData] = useState<LogsRunsOut | null>(null);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = useState<SortingState>([
    { id: "created_at", desc: true },
  ]);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);

  // Fetch logs data
  const fetchLogs = useCallback(async () => {
    setIsLoadingLogs(true);
    try {
      const result = await getLogsRunsAction({
        body: {
          profileId: "",
          page,
          pageSize,
          search: searchQuery || undefined,
          levels: columnFilters
            .find((f) => f.id === "level")
            ?.value as string[] | undefined,
        },
      });
      setLogsData(result);
    } catch (error) {
      toast.error("Failed to fetch logs");
      console.error(error);
    } finally {
      setIsLoadingLogs(false);
    }
  }, [getLogsRunsAction, page, pageSize, searchQuery, columnFilters]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Extract data from bundle
  const healthKPIs = useMemo(() => serverBundleData?.health_kpis, [serverBundleData]);
  const metrics = useMemo(() => serverBundleData?.metrics || [], [serverBundleData]);
  const feedback = useMemo(() => serverBundleData?.feedback || [], [serverBundleData]);

  // Prepare metrics chart data
  const metricsChartData = useMemo(() => {
    return metrics.map((m) => ({
      date: m.date,
      cpu: m.cpu_percent,
      latency: m.latency_ms,
      memory: m.memory_bytes / 1024 / 1024, // Convert to MB
      requests: m.requests_total,
      errors: m.errors_total,
    }));
  }, [metrics]);

  // Logs table columns (simplified)
  const logs = useMemo(() => logsData?.data || [], [logsData]);
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
          <div className="font-medium font-mono text-xs">{row.getValue("id")}</div>
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
          if (!value || value.length === 0) return true;
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
          const actorName = (row.getValue(id) as string | null) ?? "";
          return value.includes(actorName);
        },
        enableSorting: true,
      },
      {
        accessorKey: "extra",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Extra" />
        ),
        cell: ({ row }) => {
          const extra = row.getValue("extra") as Record<string, unknown> | null;
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
    []
  );

  const table = useReactTable({
    data: logs,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    onColumnFiltersChange: setColumnFilters,
    onSortingChange: setSorting,
    onPaginationChange: (updater) => {
      const newPagination = typeof updater === "function" 
        ? updater({ pageIndex: page, pageSize })
        : updater;
      if (newPagination.pageIndex !== undefined) {
        setPage(newPagination.pageIndex);
      }
      if (newPagination.pageSize !== undefined) {
        setPageSize(newPagination.pageSize);
        setPage(0); // Reset to first page when page size changes
      }
    },
    state: {
      columnFilters,
      sorting,
      pagination: {
        pageIndex: page,
        pageSize,
      },
    },
    manualPagination: true,
    pageCount: logsData?.totalPages || 0,
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      router.refresh();
      await fetchLogs();
      toast.success("Logs refreshed successfully");
    } catch {
      toast.error("Failed to refresh logs");
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleBulkDelete = () => {
    setShowBulkDeleteDialog(true);
  };

  const handleBulkDeleteSuccess = () => {
    fetchLogs();
  };

  const levelColumn = table.getColumn("level");
  const loggerNameColumn = table.getColumn("logger_name");
  const actorColumn = table.getColumn("actor_name");
  
  const levelOptions = useMemo(
    () =>
      logsData?.levelOptions?.map((opt) => ({
        value: opt.value,
        label: opt.label,
      })) || [],
    [logsData]
  );

  const loggerOptions = useMemo(
    () =>
      logsData?.loggerOptions?.map((opt) => ({
        value: opt.value,
        label: opt.label,
      })) || [],
    [logsData]
  );

  // Extract actor options from logs data
  const actorOptions = useMemo(() => {
    const actors = new Set<string>();
    logs.forEach((log) => {
      if (log.actor_name) {
        actors.add(log.actor_name);
      }
    });
    return Array.from(actors)
      .sort()
      .map((v) => ({ value: v, label: v }));
  }, [logs]);

  const isFiltered = columnFilters.length > 0 || searchQuery.length > 0;

  return (
    <div className="space-y-6" data-page="logs-dashboard">
      {/* Top Section - 5 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {healthKPIs && (
          <>
            <WebSocketKPI
              ok={healthKPIs.websocket.ok}
              latency_ms={healthKPIs.websocket.latency_ms}
              error={healthKPIs.websocket.error}
              trend={healthKPIs.websocket.trend || []}
            />
            <RedisKPI
              ok={healthKPIs.redis.ok}
              latency_ms={healthKPIs.redis.latency_ms}
              error={healthKPIs.redis.error}
              trend={healthKPIs.redis.trend || []}
            />
            <DocumentKPI
              ok={healthKPIs.document.ok}
              latency_ms={healthKPIs.document.latency_ms}
              error={healthKPIs.document.error}
              trend={healthKPIs.document.trend || []}
            />
            <DatabaseKPI
              ok={healthKPIs.database.ok}
              latency_ms={healthKPIs.database.latency_ms}
              error={healthKPIs.database.error}
              trend={healthKPIs.database.trend || []}
            />
            <AuthenticationKPI
              ok={healthKPIs.authentication.ok}
              latency_ms={healthKPIs.authentication.latency_ms}
              error={healthKPIs.authentication.error}
              trend={healthKPIs.authentication.trend || []}
            />
          </>
        )}
      </div>

      {/* Middle Section - Metrics Graph + Feedback */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Metrics Graph - 2/3 width */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Application Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={metricsChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(dateStr) => {
                        const date = new Date(dateStr);
                        return date.toLocaleString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        });
                      }}
                      angle={-45}
                      textAnchor="end"
                      height={80}
                    />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip
                      formatter={(value: number, name: string) => {
                        if (name === "cpu") return [`${value.toFixed(1)}%`, "CPU"];
                        if (name === "latency") return [`${value.toFixed(1)}ms`, "Latency"];
                        if (name === "memory") return [`${value.toFixed(1)}MB`, "Memory"];
                        if (name === "requests") return [value.toLocaleString(), "Requests"];
                        if (name === "errors") return [value.toLocaleString(), "Errors"];
                        return [value, name];
                      }}
                      labelFormatter={(dateStr) => {
                        const date = new Date(dateStr);
                        return date.toLocaleString();
                      }}
                    />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="cpu"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      name="cpu"
                    />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="latency"
                      stroke="#ef4444"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      name="latency"
                    />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="memory"
                      stroke="#22c55e"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      name="memory"
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="requests"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      name="requests"
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="errors"
                      stroke="#ef4444"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      name="errors"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Feedback Cards - 1/3 width */}
        <div className="lg:col-span-1">
          <Card className="flex flex-col">
            <CardHeader>
              <CardTitle>Recent Feedback</CardTitle>
            </CardHeader>
            <CardContent className="overflow-y-auto" style={{ maxHeight: '320px' }}>
              <div className="space-y-3">
                {feedback.length === 0 ? (
                  <div className="text-sm text-muted-foreground text-center py-8">
                    No feedback yet
                  </div>
                ) : (
                  feedback.map((item) => (
                    <Card key={item.feedback_id} className="p-3">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <Badge variant="outline">{item.type}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatTimestamp(item.created_at)}
                        </span>
                      </div>
                      <p className="text-sm mb-1">{item.message}</p>
                      <p className="text-xs text-muted-foreground">
                        by {item.author_name}
                      </p>
                    </Card>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
            </div>
          </div>

      {/* Bottom Section - Logs Table */}
      <div className="space-y-4">
        <div className="flex items-center justify-end">
          <div className="flex items-center gap-2">
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
              disabled={isRefreshing || isLoadingLogs}
              className="h-8 px-2"
            >
              <RefreshCw
                className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
              />
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center space-x-2 flex-wrap">
          <div className="w-full md:w-auto mb-2 md:mb-0">
            <Input
              placeholder="Search logs..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(0);
              }}
              className="h-8 w-full md:w-[200px]"
            />
          </div>
          <div className="flex items-center space-x-2 flex-wrap mb-2">
            {levelColumn && levelOptions.length > 0 && (
              <DataTableFacetedFilter
                column={levelColumn}
                title="Level"
                options={levelOptions}
              />
            )}
            {loggerNameColumn && loggerOptions.length > 0 && (
              <DataTableFacetedFilter
                column={loggerNameColumn}
                title="Logger"
                options={loggerOptions}
              />
            )}
            {actorColumn && actorOptions.length > 0 && (
              <DataTableFacetedFilter
                column={actorColumn}
                title="Actor"
                options={actorOptions}
              />
            )}
            {isFiltered && (
              <Button
                variant="ghost"
                onClick={() => {
                  setColumnFilters([]);
                  setSearchQuery("");
                  setPage(0);
                }}
                className="h-8 px-2 lg:px-3"
              >
                Reset
                <X className="ml-2 h-4 w-4" />
              </Button>
            )}
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
              {isLoadingLogs ? (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="h-24 text-center text-muted-foreground"
                  >
                    Loading logs...
                  </td>
                </tr>
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
                    colSpan={columns.length}
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
        {logsData && <DataTablePagination table={table} />}
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
                    const extra = selectedLog.extra as Record<string, unknown> | null;
                    const correlationId = extra?.correlation_id || extra?.correlationId;
                    return correlationId && typeof correlationId === "string" ? (
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
    </div>
  );
}
