/**
 * EvalAttemptsTable.tsx
 * Table component for displaying eval attempts using TanStack React Table
 * @AshokSaravanan222 & @siladiea
 * 01/XX/2025
 */

"use client";

import { DataTableColumnHeader } from "@/components/common/table/DataTableColumnHeader";
import { DataTableFacetedFilter } from "@/components/common/table/DataTableFacetedFilter";
import { DataTablePagination } from "@/components/common/table/DataTablePagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  useReactTable,
} from "@tanstack/react-table";
import { AlertCircle, ArrowRight, CheckCircle2, Clock, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import * as React from "react";

/** ---- Strong types from OpenAPI ---- */
type BenchmarkBundleIn = InputOf<"/api/v4/artifacts/benchmark/get", "post">;
type BenchmarkBundleOut = OutputOf<"/api/v4/artifacts/benchmark/get", "post">;
type AttemptsArray = NonNullable<BenchmarkBundleOut["attempts"]>;
type EvalAttemptItem = AttemptsArray extends Array<infer T> ? T : never;

/** ---- Fetch benchmark bundle (includes attempts) ---- */
const getBenchmarkBundle = async (
  input: BenchmarkBundleIn
): Promise<BenchmarkBundleOut> => {
  return api.post("/artifacts/benchmark/get", input, {
    cache: "no-store",
  });
};

export interface EvalAttemptsTableProps {
  initialPage?: number;
  initialPageSize?: number;
}

export default function EvalAttemptsTable({
  initialPage = 0,
  initialPageSize = 20,
}: EvalAttemptsTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [attempts, setAttempts] = React.useState<EvalAttemptItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [totalCount, setTotalCount] = React.useState(0);
  const [page, setPage] = React.useState(initialPage);
  const [pageSize, setPageSize] = React.useState(initialPageSize);
  const [searchTerm, setSearchTerm] = React.useState("");

  // Search input ref for focus management
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const searchTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  // Initialize column filters from URL search params
  const [columnFilters, setColumnFilters] = React.useState<
    Array<{ id: string; value: unknown }>
  >(() => {
    const filters: Array<{ id: string; value: unknown }> = [];
    const urlStatus = searchParams?.get("attemptsStatus");
    if (urlStatus) {
      filters.push({
        id: "status",
        value: [urlStatus],
      });
    }
    return filters;
  });

  // Initialize sorting from URL search params
  const [sorting, setSorting] = React.useState<
    Array<{ id: string; desc: boolean }>
  >(() => {
    const sortBy = searchParams?.get("attemptsSortBy") || "created_at";
    const sortOrder = searchParams?.get("attemptsSortOrder") || "desc";
    return [
      {
        id: sortBy,
        desc: sortOrder === "desc",
      },
    ];
  });

  // Get filters from URL on mount
  React.useEffect(() => {
    const urlPage = searchParams?.get("attemptsPage");
    const urlPageSize = searchParams?.get("attemptsPageSize");
    const urlSearch = searchParams?.get("attemptsSearch");
    const urlStatus = searchParams?.get("attemptsStatus");

    if (urlPage) setPage(parseInt(urlPage, 10));
    if (urlPageSize) setPageSize(parseInt(urlPageSize, 10));
    if (urlSearch !== null) setSearchTerm(urlSearch);
    if (urlStatus) {
      setColumnFilters([{ id: "status", value: [urlStatus] }]);
    }
  }, [searchParams]);

  // Fetch attempts
  React.useEffect(() => {
    const fetchAttempts = async () => {
      setLoading(true);
      try {
        const statusFilter = columnFilters.find((f) => f.id === "status")
          ?.value as string[] | undefined;
        const status =
          statusFilter && statusFilter.length > 0 ? statusFilter[0] : undefined;

        const filters: BenchmarkBundleIn = {
          body: {
            page,
            page_size: pageSize, // snake_case
            ...(status && { status }),
            ...(searchTerm && { search: searchTerm }),
          },
        };

        const data = await getBenchmarkBundle(filters);
        setAttempts(data.attempts ?? []);
        setTotalCount(data.total_count ?? 0);
      } catch {
        setAttempts([]);
        setTotalCount(0);
      } finally {
        setLoading(false);
      }
    };

    fetchAttempts();
  }, [page, pageSize, columnFilters, searchTerm]);

  // Helper function to update URL search params
  const updateAttemptsParams = React.useCallback(
    (updates: {
      page?: number;
      pageSize?: number;
      search?: string;
      status?: string | null;
      sortBy?: string;
      sortOrder?: string;
    }) => {
      const params = new URLSearchParams(searchParams?.toString() || "");

      // Update pagination
      if (updates.page !== undefined) {
        if (updates.page === 0) {
          params.delete("attemptsPage");
        } else {
          params.set("attemptsPage", updates.page.toString());
        }
      }
      if (updates.pageSize !== undefined) {
        if (updates.pageSize === 20) {
          params.delete("attemptsPageSize");
        } else {
          params.set("attemptsPageSize", updates.pageSize.toString());
        }
      }

      // Update search
      if (updates.search !== undefined) {
        if (!updates.search) {
          params.delete("attemptsSearch");
        } else {
          params.set("attemptsSearch", updates.search);
        }
      }

      // Update status filter
      if (updates.status !== undefined) {
        if (!updates.status) {
          params.delete("attemptsStatus");
        } else {
          params.set("attemptsStatus", updates.status);
        }
      }

      // Update sorting
      if (updates.sortBy !== undefined && updates.sortOrder !== undefined) {
        if (updates.sortBy === "created_at" && updates.sortOrder === "desc") {
          params.delete("attemptsSortBy");
          params.delete("attemptsSortOrder");
        } else {
          params.set("attemptsSortBy", updates.sortBy);
          params.set("attemptsSortOrder", updates.sortOrder);
        }
      }

      const newUrl = `${pathname}${params.toString() ? `?${params.toString()}` : ""}`;
      router.replace(newUrl, { scroll: false });
    },
    [searchParams, pathname, router]
  );

  // Commit search to URL (called on Enter or blur, or after debounce)
  const commitSearch = React.useCallback(
    (value: string) => {
      updateAttemptsParams({
        page: 0,
        search: value.trim() || "",
      });
    },
    [updateAttemptsParams]
  );

  // Handle search input change with debounce
  const handleSearchChange = React.useCallback(
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
    [commitSearch]
  );

  // Create status options from data
  const statusOptions = React.useMemo(() => {
    const statuses = new Set(attempts.map((a) => a.status));
    return [
      { value: "pending", label: "Pending" },
      { value: "running", label: "Running" },
      { value: "completed", label: "Completed" },
    ].filter((opt) => statuses.has(opt.value));
  }, [attempts]);

  // Handle column filters change
  const handleColumnFiltersChange = React.useCallback(
    (
      updater:
        | ColumnFiltersState
        | ((prev: ColumnFiltersState) => ColumnFiltersState)
    ) => {
      const newFilters =
        typeof updater === "function" ? updater(columnFilters) : updater;
      setColumnFilters(newFilters);

      // Extract status filter value and update URL
      const statusFilter = newFilters.find((f) => f.id === "status")?.value as
        | string[]
        | undefined;
      const status =
        statusFilter && statusFilter.length > 0 ? statusFilter[0] : null;

      updateAttemptsParams({
        page: 0,
        ...(status !== undefined && { status: status ?? null }),
      });
    },
    [columnFilters, updateAttemptsParams]
  );

  // Handle sorting change
  const handleSortingChange = React.useCallback(
    (updater: SortingState | ((prev: SortingState) => SortingState)) => {
      const newSorting =
        typeof updater === "function" ? updater(sorting) : updater;
      setSorting(newSorting);

      const sortBy = newSorting[0]?.id || "created_at";
      const sortOrder = newSorting[0]?.desc ? "desc" : "asc";

      // Reset to page 0 whenever sort changes
      updateAttemptsParams({
        page: 0,
        sortBy,
        sortOrder,
      });
    },
    [sorting, updateAttemptsParams]
  );

  // Handle pagination change
  const handlePaginationChange = React.useCallback(
    (
      updater:
        | { pageIndex: number; pageSize: number }
        | ((prev: { pageIndex: number; pageSize: number }) => {
            pageIndex: number;
            pageSize: number;
          })
    ) => {
      const newPagination =
        typeof updater === "function"
          ? updater({ pageIndex: page, pageSize })
          : updater;
      updateAttemptsParams({
        page: newPagination.pageIndex,
        pageSize: newPagination.pageSize,
      });
    },
    [page, pageSize, updateAttemptsParams]
  );

  // Get status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <Badge variant="default" className="bg-green-500">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Completed
          </Badge>
        );
      case "running":
        return (
          <Badge variant="secondary">
            <Clock className="h-3 w-3 mr-1" />
            Running
          </Badge>
        );
      default:
        return (
          <Badge variant="outline">
            <AlertCircle className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
    }
  };

  // Define columns
  const columns = React.useMemo<ColumnDef<EvalAttemptItem>[]>(
    () => [
      // Hidden faceting column for Status
      {
        id: "status",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        filterFn: (row, _id, value) => {
          if (!value || !Array.isArray(value) || value.length === 0)
            return true;
          const status = row.original.status;
          return value.includes(status);
        },
      },
      // Name column
      {
        accessorKey: "eval_name",
        id: "eval_name",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Name" />
        ),
        cell: ({ row }) => {
          const evalName = row.original.eval_name;
          return (
            <div className="flex items-center min-w-0 max-w-[200px]">
              <span className="truncate font-medium">{evalName}</span>
            </div>
          );
        },
        enableSorting: true,
      },
      // Eval column (description)
      {
        accessorKey: "eval_description",
        id: "eval_description",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Eval" />
        ),
        cell: ({ row }) => {
          const description = row.original.eval_description;
          return (
            <div className="flex items-center min-w-0 max-w-[280px]">
              <span className="truncate text-sm text-muted-foreground">
                {description || "No description"}
              </span>
            </div>
          );
        },
        enableSorting: false,
      },
      // Runs column
      {
        accessorKey: "completed_runs",
        id: "runs",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Runs" />
        ),
        cell: ({ row }) => {
          const completedRuns = row.original.completed_runs;
          const totalRuns = row.original.total_runs;
          return (
            <div className="text-center">
              <span className="font-medium">
                {completedRuns} / {totalRuns}
              </span>
            </div>
          );
        },
        enableSorting: true,
        accessorFn: (row) => {
          // Sort by completion ratio
          const totalRuns = row.total_runs ?? 0;
          const completedRuns = row.completed_runs ?? 0;
          if (totalRuns === 0) return 0;
          return completedRuns / totalRuns;
        },
      },
      // Status column
      {
        accessorKey: "status",
        id: "status_display",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Status" />
        ),
        cell: ({ row }) => {
          return getStatusBadge(row.original.status ?? "unknown");
        },
        enableSorting: true,
      },
      // View button column
      {
        id: "actions",
        cell: ({ row }) => {
          const attemptId = row.original.attempt_id;
          return (
            <div className="text-right">
              <Link href={`/benchmark/a/${attemptId}`}>
                <Button variant="ghost" size="sm">
                  View
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
            </div>
          );
        },
      },
    ],
    []
  );

  const table = useReactTable({
    data: attempts,
    columns,
    state: {
      sorting,
      columnFilters,
      pagination: { pageIndex: page, pageSize },
    },
    onSortingChange: handleSortingChange,
    onColumnFiltersChange: handleColumnFiltersChange,
    onPaginationChange: handlePaginationChange,
    manualPagination: true,
    manualFiltering: true,
    manualSorting: true,
    pageCount: Math.ceil(totalCount / pageSize),
    getCoreRowModel: getCoreRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    getRowId: (row) => row.attempt_id ?? "",
  });

  // Handle comprehensive reset (filters, search, sorting, pagination)
  const handleResetAll = React.useCallback(() => {
    // Reset table state
    table.resetColumnFilters();
    table.resetSorting();

    // Reset local state
    setColumnFilters([]);
    setSearchTerm("");
    setSorting([{ id: "created_at", desc: true }]);

    // Update URL with all reset values (preserve pageSize)
    updateAttemptsParams({
      page: 0,
      search: "",
      status: null,
      sortBy: "created_at",
      sortOrder: "desc",
    });
  }, [table, updateAttemptsParams]);

  // Toolbar state - check if any filters/search/sorting are active
  const currentSortBy = sorting[0]?.id || "created_at";
  const currentSortOrder = sorting[0]?.desc ? "desc" : "asc";
  const isFiltered =
    table.getState().columnFilters.length > 0 ||
    searchTerm !== "" ||
    currentSortBy !== "created_at" ||
    currentSortOrder !== "desc";

  const statusColumn = table.getColumn("status");

  // Get visible columns for skeleton rows
  const visibleColumns = table.getVisibleLeafColumns();

  // Memoize table rows
  const tableRows = React.useMemo(() => {
    return table.getRowModel().rows;
  }, [table]);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        <div className="flex flex-col md:flex-row md:flex-1 md:items-center md:space-x-2 gap-2 md:gap-0 min-w-0">
          {/* Search */}
          <Input
            ref={searchInputRef}
            placeholder="Search by name or description..."
            value={searchTerm}
            onChange={(event) => {
              handleSearchChange(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                // Clear timeout and commit immediately
                if (searchTimeoutRef.current) {
                  clearTimeout(searchTimeoutRef.current);
                }
                commitSearch(event.currentTarget.value);
              }
            }}
            onBlur={(event) => {
              // Clear timeout and commit immediately on blur
              if (searchTimeoutRef.current) {
                clearTimeout(searchTimeoutRef.current);
              }
              commitSearch(event.currentTarget.value);
            }}
            className="h-8 w-full md:w-[200px] lg:w-[250px]"
          />

          {/* Status filter */}
          {statusColumn && statusOptions.length > 0 && (
            <DataTableFacetedFilter
              column={statusColumn}
              title="Status"
              options={statusOptions}
              isServerDriven={false}
            />
          )}

          {/* Reset button */}
          {isFiltered && (
            <Button
              variant="ghost"
              onClick={handleResetAll}
              className="h-8 px-2 lg:px-3 hidden md:flex"
            >
              Reset
              <X className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
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
            {loading ? (
              Array.from({ length: pageSize }).map((_, i) => (
                <TableRow key={`skeleton-${i}`}>
                  {visibleColumns.map((column) => (
                    <TableCell key={column.id}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : tableRows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="text-center text-muted-foreground"
                >
                  No attempts found
                </TableCell>
              </TableRow>
            ) : (
              tableRows.map((row) => (
                <TableRow key={row.id}>
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
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <DataTablePagination table={table} />
    </div>
  );
}
