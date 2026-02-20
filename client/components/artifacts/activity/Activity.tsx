"use client";

import { ColumnDef, ColumnFiltersState } from "@tanstack/react-table";
import { AlertTriangle } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { ActivityOut } from "@/app/(main)/analytics/activity/page";
import { DataTableColumnHeader } from "@/components/common/table/DataTableColumnHeader";
import { DataTableFacetedFilter } from "@/components/common/table/DataTableFacetedFilter";
import { DataTablePagination } from "@/components/common/table/DataTablePagination";
import { Badge } from "@/components/ui/badge";
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
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  useReactTable,
} from "@tanstack/react-table";
import SessionsMetric from "./header/SessionsMetric";
import ActiveProfilesMetric from "./header/ActiveProfilesMetric";
import LoginsMetric from "./header/LoginsMetric";
import EmulationsMetric from "./header/ContentCreatedMetric";
import ActivityMetricsGraph from "./ActivityMetricsGraph";

interface ActivityProps {
  activityData: ActivityOut;
  isLoading?: boolean;
}

type SessionRow = {
  session_id: string;
  created_at: string;
  profile_name: string;
  profile_id: string;
  active: boolean;
};

export default function Activity({
  activityData,
  isLoading = false,
}: ActivityProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const bundleData = activityData.bundleData;
  const sessionsList = useMemo(() => {
    const items = activityData.activityData?.items || [];
    return items.map((item) => ({
      ...item,
      created_at: item.session_created_at ?? "",
    }));
  }, [activityData.activityData?.items]);
  const sessionsPage = activityData.activityData?.page || 0;
  const sessionsPageSize = activityData.activityData?.page_size || 50;
  const sessionsTotalPages = activityData.activityData?.total_pages || 0;

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

  // Extract chart data and available events from bundle
  const chartPoints = useMemo(() => {
    const raw = bundleData?.chart_data || [];
    return raw
      .filter((p) => p.date && p.event_id)
      .map((p) => ({
        date: p.date!,
        event_id: p.event_id!,
        count: p.count ?? 0,
      }));
  }, [bundleData?.chart_data]);

  const availableEvents = useMemo(() => {
    const raw = bundleData?.available_events || [];
    return raw
      .filter((e) => e.id && e.name)
      .map((e) => ({
        id: e.id!,
        name: e.name!,
        total_count: e.total_count ?? 0,
      }));
  }, [bundleData?.available_events]);

  // Problems from bundle
  const problems = useMemo(() => bundleData?.problems || [], [bundleData?.problems]);

  // Extract unique profiles for faceted filter
  const profileOptions = useMemo(() => {
    const profileMap = new Map<string, { label: string; value: string }>();
    sessionsList.forEach((item) => {
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
  }, [sessionsList]);

  // Column filters state
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  // Define sessions table columns
  const sessionsColumns: ColumnDef<SessionRow>[] = useMemo(
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
        accessorKey: "profile_name",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Profile" />
        ),
        cell: ({ row }) => (
          <div className="text-sm">{row.getValue("profile_name")}</div>
        ),
      },
      // Hidden faceting column for Profile (IDs)
      {
        id: "profileId",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: SessionRow) => row.profile_id || "",
        filterFn: (row, _id, value: string[]) => {
          if (!value || value.length === 0) return true;
          const profileId = row.original.profile_id || "";
          return value.includes(profileId);
        },
      },
      {
        accessorKey: "active",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Status" />
        ),
        cell: ({ row }) => {
          const active = row.getValue("active") as boolean;
          return (
            <Badge variant={active ? "default" : "secondary"}>
              {active ? "Active" : "Inactive"}
            </Badge>
          );
        },
      },
    ],
    []
  );

  // Sessions table
  const sessionsTable = useReactTable({
    data: sessionsList as SessionRow[],
    columns: sessionsColumns as ColumnDef<SessionRow>[],
    getCoreRowModel: getCoreRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    manualPagination: true,
    pageCount: sessionsTotalPages,
    state: {
      pagination: {
        pageIndex: sessionsPage,
        pageSize: sessionsPageSize,
      },
      columnFilters,
    },
    onColumnFiltersChange: setColumnFilters,
    onPaginationChange: (updater) => {
      const newPagination =
        typeof updater === "function"
          ? updater({ pageIndex: sessionsPage, pageSize: sessionsPageSize })
          : updater;
      updateURLParams({
        activityPage: newPagination.pageIndex.toString(),
        activityPageSize: newPagination.pageSize.toString(),
      });
    },
  });

  // Get profile column for faceted filter
  const profileIdColumn = sessionsTable.getColumn("profileId");

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
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
        <SessionsMetric sessionsCount={bundleData?.sessions_count ?? 0} />
        <ActiveProfilesMetric activeProfilesCount={bundleData?.active_profiles_count ?? 0} />
        <LoginsMetric loginsCount={bundleData?.logins_count ?? 0} />
        <EmulationsMetric emulationsCount={bundleData?.emulations_count ?? 0} />
      </div>

      {/* Main Content: Graph (2/3) + Problems List (1/3) */}
      <div className="flex gap-4 min-h-[500px] max-h-[500px]">
        {/* Activity Metrics Graph - 2/3 width */}
        <div className="flex-[2]">
          <ActivityMetricsGraph
            chartPoints={chartPoints}
            availableEvents={availableEvents}
            hasDataAvailable={chartPoints.length > 0}
          />
        </div>

        {/* Problems List - 1/3 width */}
        <div className="flex-1">
          <Card className="h-full flex flex-col">
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                <div className="flex-1">
                  <CardTitle>Problems</CardTitle>
                  <CardDescription>
                    Recent issues and warnings
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto">
              <div className="space-y-4">
                {problems.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    No problems found.
                  </div>
                ) : (
                  problems.map((item) => (
                    <div
                      key={item.problem_id}
                      className={`p-4 border rounded-lg ${
                        item.resolved ? "opacity-60" : ""
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant={item.resolved ? "secondary" : "destructive"}>
                              {item.type}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {item.profile_name}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {item.created_at ? new Date(item.created_at).toLocaleDateString() : ""}
                            </span>
                            {item.resolved && (
                              <span className="text-xs text-success">Resolved</span>
                            )}
                          </div>
                          <p className="text-sm">{item.message}</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Sessions Table Section */}
      <div className="space-y-4">
        {/* Search and Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <Input
            ref={searchInputRef}
            placeholder="Search sessions..."
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
              {sessionsTable.getHeaderGroups().map((headerGroup) => (
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
              {sessionsTable.getRowModel().rows?.length ? (
                sessionsTable.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() =>
                      router.push(
                        `/session/${row.original.session_id}`
                      )
                    }
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
                    colSpan={sessionsColumns.length}
                    className="h-24 text-center"
                  >
                    No sessions found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        <DataTablePagination table={sessionsTable} />
      </div>
    </div>
  );
}
