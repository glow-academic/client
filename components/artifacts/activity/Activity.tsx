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
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  flexRender, getCoreRowModel, getFacetedRowModel, getFacetedUniqueValues, useReactTable,
} from "@tanstack/react-table";
import SessionsMetric from "./header/SessionsMetric";
import ActiveProfilesMetric from "./header/ActiveProfilesMetric";
import LoginsMetric from "./header/LoginsMetric";
import EmulationsMetric from "./header/ContentCreatedMetric";
import ProfileSummaryCard from "./ProfileSummaryCard";

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
  chat_count: number;
  attempt_count: number;
  message_count: number;
  problem_count: number;
};

function formatDuration(start: string | null | undefined, end: string | null | undefined): string {
  if (!start) return "-";
  const startDate = new Date(start);
  const endDate = end ? new Date(end) : new Date();
  const diffMs = endDate.getTime() - startDate.getTime();
  if (diffMs < 0) return "-";
  const mins = Math.floor(diffMs / 60000);
  const hrs = Math.floor(mins / 60);
  if (hrs > 0) return `${hrs}h ${mins % 60}m`;
  return `${mins}m`;
}

export default function Activity({ activityData, isLoading = false }: ActivityProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const bundleData = activityData.bundleData;
  const sessionsList = useMemo(() => {
    const items = activityData.activityData?.items || [];
    return items.map((item) => ({
      ...item,
      created_at: item.session_created_at ?? "",
      chat_count: item.chat_count ?? 0,
      attempt_count: item.attempt_count ?? 0,
      message_count: item.message_count ?? 0,
      problem_count: item.problem_count ?? 0,
    }));
  }, [activityData.activityData?.items]);
  const sessionsPage = activityData.activityData?.page || 0;
  const sessionsPageSize = activityData.activityData?.page_size || 50;
  const sessionsTotalPages = activityData.activityData?.total_pages || 0;

  const summaryProfileId = searchParams.get("summaryProfileId") || undefined;

  const [searchTerm, setSearchTerm] = useState(searchParams.get("activitySearch") || "");
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const urlSearch = searchParams.get("activitySearch") || "";
    setSearchTerm(urlSearch);
  }, [searchParams]);

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

  const commitSearch = useCallback(
    (value: string) => {
      updateURLParams({ activityPage: "0", activitySearch: value.trim() || null });
    },
    [updateURLParams]
  );

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchTerm(value);
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      if (value === "") { commitSearch(""); return; }
      searchTimeoutRef.current = setTimeout(() => { commitSearch(value); }, 500);
    },
    [commitSearch]
  );

  const problems = useMemo(() => bundleData?.problems || [], [bundleData?.problems]);
  const profileSummary = useMemo(() => bundleData?.profile_summary || [], [bundleData?.profile_summary]);

  const profileOptions = useMemo(() => {
    const profileMap = new Map<string, { label: string; value: string }>();
    sessionsList.forEach((item) => {
      if (item.profile_id && item.profile_name) {
        if (!profileMap.has(item.profile_id)) {
          profileMap.set(item.profile_id, { label: item.profile_name, value: item.profile_id });
        }
      }
    });
    return Array.from(profileMap.values());
  }, [sessionsList]);

  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  const sessionsColumns: ColumnDef<SessionRow>[] = useMemo(() => [
    {
      accessorKey: "created_at",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Time" />,
      cell: ({ row }) => {
        const date = new Date(row.getValue("created_at") as string);
        return (
          <div className="text-sm">
            {date.toLocaleString(undefined, {
              year: "numeric", month: "short", day: "numeric",
              hour: "2-digit", minute: "2-digit",
            })}
          </div>
        );
      },
    },
    {
      accessorKey: "profile_name",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Profile" />,
      cell: ({ row }) => <div className="text-sm">{row.getValue("profile_name")}</div>,
    },
    {
      id: "profileId",
      header: () => null,
      cell: () => null,
      enableHiding: true,
      enableSorting: false,
      accessorFn: (row: SessionRow) => row.profile_id || "",
      filterFn: (row, _id, value: string[]) => {
        if (!value || value.length === 0) return true;
        return value.includes(row.original.profile_id || "");
      },
    },
    {
      id: "duration",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Duration" />,
      cell: ({ row }) => {
        const orig = row.original as SessionRow & { first_run_at?: string; last_run_at?: string };
        return <div className="text-sm text-muted-foreground">{formatDuration(orig.first_run_at, orig.last_run_at)}</div>;
      },
    },
    {
      accessorKey: "chat_count",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Chats" />,
      cell: ({ row }) => <div className="text-sm tabular-nums">{row.getValue("chat_count")}</div>,
    },
    {
      accessorKey: "attempt_count",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Attempts" />,
      cell: ({ row }) => <div className="text-sm tabular-nums">{row.getValue("attempt_count")}</div>,
    },
    {
      accessorKey: "message_count",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Messages" />,
      cell: ({ row }) => <div className="text-sm tabular-nums">{row.getValue("message_count")}</div>,
    },
    {
      accessorKey: "problem_count",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Problems" />,
      cell: ({ row }) => {
        const count = row.getValue("problem_count") as number;
        if (count > 0) {
          return <Badge variant="destructive">{count}</Badge>;
        }
        return <div className="text-sm tabular-nums text-muted-foreground">0</div>;
      },
    },
    {
      accessorKey: "active",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
      cell: ({ row }) => {
        const active = row.getValue("active") as boolean;
        return (
          <Badge variant={active ? "default" : "secondary"}>
            {active ? "Active" : "Inactive"}
          </Badge>
        );
      },
    },
  ], []);

  const sessionsTable = useReactTable({
    data: sessionsList as SessionRow[],
    columns: sessionsColumns as ColumnDef<SessionRow>[],
    getCoreRowModel: getCoreRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    manualPagination: true,
    pageCount: sessionsTotalPages,
    state: {
      pagination: { pageIndex: sessionsPage, pageSize: sessionsPageSize },
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

  const profileIdColumn = sessionsTable.getColumn("profileId");

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
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

      {/* Main Content: Profile Summary (2/3) + Problems List (1/3) */}
      <div className="flex gap-4 min-h-[300px] max-h-[400px]">
        <div className="flex-[2]">
          <ProfileSummaryCard
            items={profileSummary}
            selectedProfileId={summaryProfileId}
          />
        </div>
        <div className="flex-1">
          <Card className="h-full flex flex-col">
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                <div className="flex-1">
                  <CardTitle>Problems</CardTitle>
                  <CardDescription>Recent issues and warnings</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto">
              <div className="space-y-4">
                {problems.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">No problems found.</div>
                ) : (
                  problems.map((item) => (
                    <div
                      key={item.problem_id}
                      className={`p-4 border rounded-lg ${item.resolved ? "opacity-60" : ""}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant={item.resolved ? "secondary" : "destructive"}>
                              {item.type}
                            </Badge>
                            <span className="text-xs text-muted-foreground">{item.profile_name}</span>
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
        <div className="flex items-center gap-2 flex-wrap">
          <Input
            ref={searchInputRef}
            placeholder="Search sessions..."
            value={searchTerm}
            onChange={(e) => handleSearchChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") commitSearch(searchTerm); }}
            className="max-w-sm"
          />
          {profileIdColumn && profileOptions.length > 0 && (
            <DataTableFacetedFilter column={profileIdColumn} title="Profile" options={profileOptions} />
          )}
        </div>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              {sessionsTable.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
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
                    onClick={() => router.push(`/session/${row.original.session_id}`)}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={sessionsColumns.length} className="h-24 text-center">
                    No sessions found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <DataTablePagination table={sessionsTable} />
      </div>
    </div>
  );
}
