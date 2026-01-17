/**
 * Activity.tsx
 * Activity page component with header metrics, feedback entries, and activity table.
 */
"use client";

import { ColumnDef, ColumnFiltersState } from "@tanstack/react-table";
import { MessageSquare } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import type { ActivityOut } from "@/app/(main)/analytics/activity/page";
import { DataTableColumnHeader } from "@/components/common/table/DataTableColumnHeader";
import { DataTableFacetedFilter } from "@/components/common/table/DataTableFacetedFilter";
import { DataTablePagination } from "@/components/common/table/DataTablePagination";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  useReactTable,
} from "@tanstack/react-table";
import ActiveProfilesMetric from "./header/ActiveProfilesMetric";
import TotalActivityEntries from "./header/TotalActivityEntries";
import TotalFeedbackCount from "./header/TotalFeedbackCount";
import TotalErrorsMetric from "./header/TotalErrorsMetric";
import ActivityMetricsGraph from "./ActivityMetricsGraph";

interface ActivityProps {
  activityData: ActivityOut;
  isLoading?: boolean;
}

type ActivityRow = {
  activity_id: string;
  created_at: string;
  message: string;
  error: boolean;
  profile_name: string;
  profile_id: string;
};

type FeedbackItem = {
  feedback_id: string;
  type: string;
  message: string;
  created_at: string;
  resolved: boolean;
  author_name: string;
  author_email: string;
  author_emails: string[];
  author_profile_id: string;
};

export default function Activity({
  activityData,
  isLoading = false,
}: ActivityProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Extract data from flat fields (server returns flat structure, not nested metrics)
  const bundleData = activityData.bundleData;
  // Feedback removed - should come from bundle or use static data
  const feedback: Array<{
    feedback_id: string;
    type: string;
    message: string;
    resolved: boolean;
  }> = [];
  const activityList = useMemo(() => activityData.activityData?.activities || [], [activityData.activityData?.activities]);
  const activityPage = activityData.activityData?.page || 0;
  const activityPageSize = activityData.activityData?.page_size || 50;
  const activityTotalPages = activityData.activityData?.total_pages || 0;

  // Search state
  const [searchTerm, setSearchTerm] = useState(
    searchParams.get("activitySearch") || ""
  );
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Sync URL params
  useEffect(() => {
    const urlSearch = searchParams.get("activitySearch") || "";
    setSearchTerm(urlSearch);
  }, [searchParams]);

  // Update URL params helper
  const updateURLParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([key, value]) => {
        if (value === null || value === "") {
          params.delete(key);
        } else {
          if (key === "activityPage" && value === "0") {
            params.delete(key);
          } else if (key === "activityPageSize" && value === "50") {
            params.delete(key);
          } else {
            params.set(key, value);
          }
        }
      });
      router.push(`?${params.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  // Commit search to URL
  const commitSearch = useCallback(
    (value: string) => {
      updateURLParams({
        activityPage: "0",
        activitySearch: value.trim() || null,
      });
    },
    [updateURLParams]
  );

  // Handle search input change with debounce
  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchTerm(value);
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      if (value === "") {
        commitSearch("");
        return;
      }
      searchTimeoutRef.current = setTimeout(() => {
        commitSearch(value);
      }, 500);
    },
    [commitSearch]
  );

  // Feedback resolve removed - no resolve functionality needed

  // Helper function to compute status based on value and thresholds
  const computeStatus = (
    value: number,
    thresholdWarning: number = 0,
    thresholdDanger: number = 0
  ): "success" | "warning" | "danger" | "neutral" => {
    if (value >= thresholdWarning) {
      return "success";
    } else if (value >= thresholdDanger) {
      return "warning";
    } else {
      return "neutral";
    }
  };

  // Helper function to calculate trend data from chart_data for a specific metric
  const calculateTrendData = (
    chartData: Array<{
      date: string | null;
      active_profiles: number | null;
      feedback_entries: number | null;
      activity_entries: number | null;
      errors: number | null;
    }>,
    metricKey: "active_profiles" | "feedback_entries" | "activity_entries" | "errors"
  ): Array<{ date: string; value: number; count: number }> => {
    if (!chartData || chartData.length === 0) return [];

    // Get last 30 days of data
    const recentData = chartData.slice(-30);

    return recentData.map((point) => ({
      date: point.date || "",
      value: point[metricKey] || 0,
      count: 1,
    }));
  };

  // Build metrics structure from flat fields (client-side transformation)
  const metrics = useMemo(() => {
    if (!bundleData) return null;

    const activeProfiles = bundleData.active_profiles_count || 0;
    const totalFeedback = bundleData.total_feedback_count || 0;
    const totalActivity = bundleData.total_activity_entries || 0;
    const totalErrors = bundleData.total_errors_count || 0;
    const chartData = bundleData.chart_data || [];

    return {
      active_profiles_count: {
        currentValue: activeProfiles,
        trendData: calculateTrendData(chartData, "active_profiles"),
        hasData: activeProfiles > 0,
        status: computeStatus(activeProfiles),
      },
      total_feedback_count: {
        currentValue: totalFeedback,
        trendData: calculateTrendData(chartData, "feedback_entries"),
        hasData: totalFeedback > 0,
        status: computeStatus(totalFeedback),
      },
      total_activity_entries: {
        currentValue: totalActivity,
        trendData: calculateTrendData(chartData, "activity_entries"),
        hasData: totalActivity > 0,
        status: computeStatus(totalActivity),
      },
      total_errors_count: {
        currentValue: totalErrors,
        trendData: calculateTrendData(chartData, "errors"),
        hasData: totalErrors > 0,
        status: computeStatus(totalErrors, 10, 50), // threshold_warning=10, threshold_danger=50
      },
    };
  }, [bundleData]);

  // Header metrics components
  const headerComponents = useMemo(() => {
    if (!metrics) return [];

    return [
      <ActiveProfilesMetric
        key="active-profiles"
        activeProfilesCount={metrics.active_profiles_count.currentValue}
        trendData={metrics.active_profiles_count.trendData}
        hasDataAvailable={metrics.active_profiles_count.hasData}
        status={metrics.active_profiles_count.status}
      />,
      <TotalFeedbackCount
        key="total-feedback"
        totalFeedbackCount={metrics.total_feedback_count.currentValue}
        trendData={metrics.total_feedback_count.trendData}
        hasDataAvailable={metrics.total_feedback_count.hasData}
        status={metrics.total_feedback_count.status}
      />,
      <TotalActivityEntries
        key="total-activity"
        totalActivityEntries={metrics.total_activity_entries.currentValue}
        trendData={metrics.total_activity_entries.trendData}
        hasDataAvailable={metrics.total_activity_entries.hasData}
        status={metrics.total_activity_entries.status}
      />,
      <TotalErrorsMetric
        key="total-errors"
        totalErrorsCount={metrics.total_errors_count.currentValue}
        trendData={metrics.total_errors_count.trendData}
        hasDataAvailable={metrics.total_errors_count.hasData}
        status={metrics.total_errors_count.status}
      />,
    ];
  }, [metrics]);

  // Extract chart data from bundle and transform to camelCase for ActivityMetricsGraph
  const chartData = useMemo(() => {
    const rawChartData = activityData.bundleData?.chart_data || [];
    return rawChartData
      .filter((point) => point.date !== null && point.date !== undefined)
      .map((point) => ({
        date: point.date!,
        activeProfiles: point.active_profiles ?? 0,
        feedbackEntries: point.feedback_entries ?? 0,
        activityEntries: point.activity_entries ?? 0,
        errors: point.errors ?? 0,
      }));
  }, [activityData.bundleData?.chart_data]);

  // Extract unique profiles for faceted filter
  const profileOptions = useMemo(() => {
    const profileMap = new Map<string, { label: string; value: string }>();
    activityList.forEach((item) => {
      if (item.profile_id && item.profile_name) {
        if (!profileMap.has(item.profile_id)) {
          profileMap.set(item.profile_id, {
            label: item.profile_name,
            value: item.profile_id,
          });
        }
      }
    });
    return Array.from(profileMap.values());
  }, [activityList]);

  // Column filters state
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  // Define activity table columns
  const activityColumns: ColumnDef<ActivityRow>[] = useMemo(
    () => [
      {
        accessorKey: "created_at",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Time" />
        ),
        cell: ({ row }) => {
          const date = new Date(row.getValue("created_at") as string);
          return (
            <div className="text-sm">
              {date.toLocaleString(undefined, {
                year: "numeric",
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
          );
        },
      },
      {
        accessorKey: "message",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Message" />
        ),
        cell: ({ row }) => (
          <div className="text-sm max-w-md">{row.getValue("message")}</div>
        ),
        filterFn: (row, id, value) => {
          const message = String(row.getValue(id)).toLowerCase();
          const query = String(value).toLowerCase();
          return message.includes(query);
        },
      },
      // Hidden faceting column for Profile (IDs)
      {
        id: "profileId",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: ActivityRow) => row.profile_id || "",
        filterFn: (row, _id, value: string[]) => {
          if (!value || value.length === 0) return true;
          const profileId = row.original.profile_id || "";
          return value.includes(profileId);
        },
      },
      {
        accessorKey: "profile_name",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Profile" />
        ),
        cell: ({ row }) => (
          <div className="text-sm">{row.getValue("profile_name")}</div>
        ),
      },
    ],
    []
  );

  // Activity table
  const activityTable = useReactTable({
    data: activityList as ActivityRow[],
    columns: activityColumns as ColumnDef<ActivityRow>[],
    getCoreRowModel: getCoreRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    manualPagination: true,
    pageCount: activityTotalPages,
    state: {
      pagination: {
        pageIndex: activityPage,
        pageSize: activityPageSize,
      },
      columnFilters,
    },
    onColumnFiltersChange: setColumnFilters,
    onPaginationChange: (updater) => {
      const newPagination =
        typeof updater === "function"
          ? updater({ pageIndex: activityPage, pageSize: activityPageSize })
          : updater;
      updateURLParams({
        activityPage: newPagination.pageIndex.toString(),
        activityPageSize: newPagination.pageSize.toString(),
      });
    },
  });

  // Get profile column for faceted filter
  const profileIdColumn = activityTable.getColumn("profileId");

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <div className="flex gap-4 min-h-[500px] max-h-[500px]">
          <Skeleton className="flex-[2]" />
          <Skeleton className="flex-1" />
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="activity-container">
      {/* Header Metrics */}
      {headerComponents.length > 0 && (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
          {headerComponents.map((component) => component)}
        </div>
      )}

      {/* Main Content: Graph (2/3) + Feedback List (1/3) */}
      <div className="flex gap-4 min-h-[500px] max-h-[500px]">
        {/* Activity Metrics Graph - 2/3 width */}
        <div className="flex-[2]">
          <ActivityMetricsGraph
            chartData={chartData}
            hasDataAvailable={chartData.length > 0}
          />
        </div>

        {/* Feedback List - 1/3 width */}
        <div className="flex-1">
          <Card className="h-full flex flex-col">
            <CardHeader>
              <div className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                <div className="flex-1">
                  <CardTitle>Feedback Entries</CardTitle>
                  <CardDescription>
                    User feedback and feature requests
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto">
              <div className="space-y-4">
                {feedback.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    No feedback entries found.
                  </div>
                ) : (
                  feedback.map((item: FeedbackItem) => (
                    <div
                      key={item.feedback_id}
                      className={`p-4 border rounded-lg ${
                        item.resolved ? "opacity-60" : ""
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-sm font-medium">{item.type}</span>
                            <span className="text-xs text-muted-foreground">
                              by {item.author_name}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(item.created_at).toLocaleDateString()}
                            </span>
                            {item.resolved && (
                              <span className="text-xs text-success">Resolved</span>
                            )}
                          </div>
                          <p className="text-sm">{item.message}</p>
                        </div>
                        {/* Resolve button removed - no resolve functionality */}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Activity Table Section */}
      <div className="space-y-4">
        {/* Search and Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <Input
            ref={searchInputRef}
            placeholder="Search activity..."
            value={searchTerm}
            onChange={(e) => handleSearchChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                commitSearch(searchTerm);
              }
            }}
            className="max-w-sm"
          />
          {profileIdColumn && profileOptions.length > 0 && (
            <DataTableFacetedFilter
              column={profileIdColumn}
              title="Profile"
              options={profileOptions}
            />
          )}
        </div>

        {/* Table */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              {activityTable.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {activityTable.getRowModel().rows?.length ? (
                activityTable.getRowModel().rows.map((row) => (
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
                    colSpan={activityColumns.length}
                    className="h-24 text-center"
                  >
                    No activity entries found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        <DataTablePagination table={activityTable} />
      </div>
    </div>
  );
}

