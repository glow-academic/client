/**
 * EvalHistory.tsx
 * History component for displaying eval attempts with pagination and search
 * Similar to SimulationHistory but eval-focused
 */

"use client";

import { DataTableColumnHeader } from "@/components/common/table/DataTableColumnHeader";
import { DataTablePagination } from "@/components/common/table/DataTablePagination";
import { Badge } from "@/components/ui/badge";
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
  CheckCircle2,
  Clock,
  AlertCircle,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import {
  ColumnDef,
  SortingState,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";

/** ---- Types ---- */
type EvalAttemptItem = {
  attempt_id: string;
  eval_id?: string | null;
  eval_name?: string | null;
  eval_description?: string | null;
  rubric_id?: string | null;
  rubric_name?: string | null;
  created_at?: string | null;
  archived?: boolean;
  status?: string;
  total_runs?: number;
  completed_runs?: number;
  pending_runs?: number;
};

export interface EvalHistoryProps {
  data: EvalAttemptItem[];
  totalCount: number;
  pageIndex: number;
  pageSize: number;
  isLoading?: boolean;
}

export default function EvalHistory({
  data,
  totalCount,
  pageIndex,
  pageSize,
  isLoading = false,
}: EvalHistoryProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Local search state, initialized from URL
  const [searchTerm, setSearchTerm] = React.useState(
    searchParams?.get("historySearch") || "",
  );

  // Ref to track debounce timeout for search
  const searchTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  // Keep local state in sync if URL changes
  React.useEffect(() => {
    const urlSearch = searchParams?.get("historySearch") || "";
    setSearchTerm(urlSearch);
  }, [searchParams]);

  // Update URL when search term changes (debounced)
  React.useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      const params = new URLSearchParams(searchParams?.toString() || "");
      if (searchTerm) {
        params.set("historySearch", searchTerm);
        params.set("historyPage", "0"); // Reset to first page on search
      } else {
        params.delete("historySearch");
      }
      router.push(`${pathname}?${params.toString()}`);
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchTerm, router, pathname, searchParams]);

  // Initialize sorting from URL search params
  const [sorting, setSorting] = React.useState<SortingState>(() => {
    const sortBy = searchParams?.get("historySortBy") || "created_at";
    const sortOrder = searchParams?.get("historySortOrder") || "desc";
    return [
      {
        id: sortBy,
        desc: sortOrder === "desc",
      },
    ];
  });

  // Update URL when sorting changes
  const handleSortingChange = React.useCallback(
    (updater: SortingState | ((old: SortingState) => SortingState)) => {
      const newSorting =
        typeof updater === "function" ? updater(sorting) : updater;
      setSorting(newSorting);

      const params = new URLSearchParams(searchParams?.toString() || "");
      if (newSorting.length > 0 && newSorting[0]) {
        params.set("historySortBy", newSorting[0].id);
        params.set("historySortOrder", newSorting[0].desc ? "desc" : "asc");
      } else {
        params.delete("historySortBy");
        params.delete("historySortOrder");
      }
      router.push(`${pathname}?${params.toString()}`);
    },
    [sorting, router, pathname, searchParams],
  );

  // Status badge component
  const StatusBadge = ({ status }: { status: string | null | undefined }) => {
    if (!status) return null;
    const statusConfig = {
      pending: { label: "Pending", icon: Clock, variant: "secondary" as const },
      running: { label: "Running", icon: Clock, variant: "default" as const },
      completed: {
        label: "Completed",
        icon: CheckCircle2,
        variant: "default" as const,
      },
    };
    const config = statusConfig[status as keyof typeof statusConfig] || {
      label: status,
      icon: AlertCircle,
      variant: "secondary" as const,
    };
    const Icon = config.icon;
    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  // Define columns
  const columns: ColumnDef<EvalAttemptItem>[] = React.useMemo(
    () => [
      {
        accessorKey: "eval_name",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Eval Name" />
        ),
        cell: ({ row }) => {
          const evalName = row.original.eval_name || "Unnamed Eval";
          const attemptId = row.original.attempt_id;
          return (
            <div className="flex flex-col">
              {attemptId ? (
                <Link
                  href={`/benchmark/a/${attemptId}`}
                  className="font-medium hover:underline"
                >
                  {evalName}
                </Link>
              ) : (
                <span className="font-medium">{evalName}</span>
              )}
              {row.original.eval_description && (
                <span className="text-xs text-muted-foreground">
                  {row.original.eval_description}
                </span>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: "rubric_name",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Rubric" />
        ),
        cell: ({ row }) => row.original.rubric_name || "-",
      },
      {
        accessorKey: "status",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Status" />
        ),
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        accessorKey: "total_runs",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Runs" />
        ),
        cell: ({ row }) => {
          const total = row.original.total_runs || 0;
          const completed = row.original.completed_runs || 0;
          const pending = row.original.pending_runs || 0;
          return (
            <div className="text-sm">
              {completed}/{total}
              {pending > 0 && (
                <span className="text-muted-foreground ml-1">
                  ({pending} pending)
                </span>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: "created_at",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Created" />
        ),
        cell: ({ row }) => {
          const date = row.original.created_at;
          if (!date) return "-";
          return new Date(date).toLocaleDateString();
        },
      },
    ],
    [],
  );

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
    },
    onSortingChange: handleSortingChange,
    manualPagination: true,
    manualSorting: true,
    getCoreRowModel: getCoreRowModel(),
    pageCount: Math.ceil(totalCount / pageSize),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <div className="flex items-center gap-2">
        <Input
          placeholder="Search evals..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                ))}
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
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No attempts found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <DataTablePagination
        table={table}
        totalCount={totalCount}
        pageIndex={pageIndex}
        pageSize={pageSize}
        onPageChange={(page) => {
          const params = new URLSearchParams(searchParams?.toString() || "");
          params.set("historyPage", page.toString());
          router.push(`${pathname}?${params.toString()}`);
        }}
        onPageSizeChange={(size) => {
          const params = new URLSearchParams(searchParams?.toString() || "");
          params.set("historyPageSize", size.toString());
          params.set("historyPage", "0"); // Reset to first page
          router.push(`${pathname}?${params.toString()}`);
        }}
      />
    </div>
  );
}
