/**
 * Activity.tsx
 * Activity page component with header metrics, feedback entries, and activity table.
 */
"use client";

import { ColumnDef } from "@tanstack/react-table";
import { CheckCircle2, XCircle } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import type { ActivityOut } from "@/app/(main)/analytics/activity/page";
import { DataTableColumnHeader } from "@/components/common/table/DataTableColumnHeader";
import { DataTablePagination } from "@/components/common/table/DataTablePagination";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import TotalActivityEntries from "./header/TotalActivityEntries";
import TotalFeedbackCount from "./header/TotalFeedbackCount";
import UnresolvedFeedbackCount from "./header/UnresolvedFeedbackCount";
import RecentActivity24h from "./header/RecentActivity24h";

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

  // Extract data
  const metrics = activityData.bundleData?.metrics;
  const feedback = activityData.feedbackData?.feedback || [];
  const activityList = activityData.activityData?.data || [];
  const activityTotalCount = activityData.activityData?.totalCount || 0;
  const activityPage = activityData.activityData?.page || 0;
  const activityPageSize = activityData.activityData?.pageSize || 50;
  const activityTotalPages = activityData.activityData?.totalPages || 0;

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

  // Handle resolve feedback
  const handleResolveFeedback = useCallback(
    async (feedbackId: string, resolved: boolean) => {
      try {
        const { api } = await import("@/lib/api/client");
        await api.post("/feedback/resolve", {
          body: {
            feedback_id: feedbackId,
            resolved: !resolved,
          },
        });

        toast.success(
          `Feedback ${!resolved ? "resolved" : "unresolved"} successfully`
        );
        router.refresh();
      } catch (error) {
        toast.error("Failed to resolve feedback");
      }
    },
    [router]
  );

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
    data: activityList,
    columns: activityColumns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount: activityTotalPages,
    state: {
      pagination: {
        pageIndex: activityPage,
        pageSize: activityPageSize,
      },
    },
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

  // Header metrics components
  const headerComponents = useMemo(() => {
    if (!metrics) return [];

    return [
      <TotalActivityEntries
        key="total-activity"
        totalActivityEntries={metrics.total_activity_entries.currentValue}
        hasDataAvailable={metrics.total_activity_entries.hasData}
        status={metrics.total_activity_entries.status}
      />,
      <RecentActivity24h
        key="recent-activity"
        recentActivity24h={metrics.recent_activity_24h.currentValue}
        hasDataAvailable={metrics.recent_activity_24h.hasData}
        status={metrics.recent_activity_24h.status}
      />,
      <UnresolvedFeedbackCount
        key="unresolved-feedback"
        unresolvedFeedbackCount={metrics.unresolved_feedback_count.currentValue}
        hasDataAvailable={metrics.unresolved_feedback_count.hasData}
        status={metrics.unresolved_feedback_count.status}
      />,
      <TotalFeedbackCount
        key="total-feedback"
        totalFeedbackCount={metrics.total_feedback_count.currentValue}
        hasDataAvailable={metrics.total_feedback_count.hasData}
        status={metrics.total_feedback_count.status}
      />,
    ];
  }, [metrics]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64" />
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

      {/* Feedback Entries Section */}
      <Card>
        <CardHeader>
          <CardTitle>Feedback Entries</CardTitle>
        </CardHeader>
        <CardContent>
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
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        handleResolveFeedback(item.feedback_id, item.resolved)
                      }
                    >
                      {item.resolved ? (
                        <>
                          <XCircle className="h-4 w-4 mr-2" />
                          Unresolve
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Resolve
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Activity Table Section */}
      <Card>
        <CardHeader>
          <CardTitle>Activity Log</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Search */}
            <div className="flex items-center gap-2">
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
        </CardContent>
      </Card>
    </div>
  );
}

