/**
 * EvalAttemptsTable.tsx
 * Table component for displaying eval attempts
 * @AshokSaravanan222 & @siladiea
 * 01/XX/2025
 */

"use client";

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
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Search,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

/** ---- Strong types from OpenAPI ---- */
type EvalAttemptsListIn = InputOf<"/api/v3/evals/attempts/list", "post">;
type EvalAttemptsListOut = OutputOf<"/api/v3/evals/attempts/list", "post">;
type EvalAttemptItem = EvalAttemptsListOut["attempts"][number];

/** ---- Fetch eval attempts ---- */
const getEvalAttempts = async (
  input: EvalAttemptsListIn
): Promise<EvalAttemptsListOut> => {
  return api.post("/evals/attempts/list", input, {
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
  const searchParams = useSearchParams();

  const [attempts, setAttempts] = useState<EvalAttemptItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(initialPage);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  // Get filters from URL
  useEffect(() => {
    const urlPage = searchParams?.get("attemptsPage");
    const urlPageSize = searchParams?.get("attemptsPageSize");
    const urlSearch = searchParams?.get("attemptsSearch");
    const urlStatus = searchParams?.get("attemptsStatus");

    if (urlPage) setPage(parseInt(urlPage, 10));
    if (urlPageSize) setPageSize(parseInt(urlPageSize, 10));
    if (urlSearch !== null) setSearchTerm(urlSearch);
    if (urlStatus !== null) setStatusFilter(urlStatus || null);
  }, [searchParams]);

  // Fetch attempts
  useEffect(() => {
    const fetchAttempts = async () => {
      setLoading(true);
      try {
        const filters: EvalAttemptsListIn = {
          body: {
            page,
            pageSize,
            ...(statusFilter && { status: statusFilter }),
            ...(searchTerm && { search: searchTerm }),
          },
        };

        const data = await getEvalAttempts(filters);
        setAttempts(data.attempts);
        setTotalCount(data.total_count);
      } catch (error) {
        console.error("Failed to fetch eval attempts:", error);
        setAttempts([]);
        setTotalCount(0);
      } finally {
        setLoading(false);
      }
    };

    fetchAttempts();
  }, [page, pageSize, statusFilter, searchTerm]);

  // Update URL when filters change
  const updateUrl = (updates: {
    page?: number;
    pageSize?: number;
    search?: string;
    status?: string | null;
  }) => {
    const params = new URLSearchParams(searchParams?.toString() || "");
    if (updates.page !== undefined) {
      params.set("attemptsPage", updates.page.toString());
    }
    if (updates.pageSize !== undefined) {
      params.set("attemptsPageSize", updates.pageSize.toString());
    }
    if (updates.search !== undefined) {
      if (updates.search) {
        params.set("attemptsSearch", updates.search);
      } else {
        params.delete("attemptsSearch");
      }
    }
    if (updates.status !== undefined) {
      if (updates.status) {
        params.set("attemptsStatus", updates.status);
      } else {
        params.delete("attemptsStatus");
      }
    }
    router.push(`?${params.toString()}`, { scroll: false });
  };

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setPage(0);
    updateUrl({ search: value, page: 0 });
  };

  const handleStatusFilterChange = (status: string | null) => {
    setStatusFilter(status);
    setPage(0);
    updateUrl({ status, page: 0 });
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    updateUrl({ page: newPage });
  };

  const totalPages = Math.ceil(totalCount / pageSize);

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

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateString;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <h2 className="text-2xl font-bold">Evaluation Attempts</h2>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search evals..."
              value={searchTerm}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-8 w-full sm:w-64"
            />
          </div>
          {/* Status filter */}
          <div className="flex gap-2">
            <Button
              variant={statusFilter === null ? "default" : "outline"}
              size="sm"
              onClick={() => handleStatusFilterChange(null)}
            >
              All
            </Button>
            <Button
              variant={statusFilter === "pending" ? "default" : "outline"}
              size="sm"
              onClick={() => handleStatusFilterChange("pending")}
            >
              Pending
            </Button>
            <Button
              variant={statusFilter === "running" ? "default" : "outline"}
              size="sm"
              onClick={() => handleStatusFilterChange("running")}
            >
              Running
            </Button>
            <Button
              variant={statusFilter === "completed" ? "default" : "outline"}
              size="sm"
              onClick={() => handleStatusFilterChange("completed")}
            >
              Completed
            </Button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Eval Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Runs</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: pageSize }).map((_, i) => (
                <TableRow key={`skeleton-${i}`}>
                  <TableCell>
                    <Skeleton className="h-4 w-48" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-20 rounded-full" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-16" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-32" />
                  </TableCell>
                  <TableCell className="text-right">
                    <Skeleton className="h-8 w-20 ml-auto" />
                  </TableCell>
                </TableRow>
              ))
            ) : attempts.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-center text-muted-foreground"
                >
                  No attempts found
                </TableCell>
              </TableRow>
            ) : (
              attempts.map((attempt) => (
                <TableRow key={attempt.attempt_id}>
                  <TableCell className="font-medium">
                    {attempt.eval_name}
                  </TableCell>
                  <TableCell>{getStatusBadge(attempt.status)}</TableCell>
                  <TableCell>
                    {attempt.completed_runs} / {attempt.total_runs}
                  </TableCell>
                  <TableCell>{formatDate(attempt.created_at)}</TableCell>
                  <TableCell className="text-right">
                    <Link href={`/benchmark/a/${attempt.attempt_id}`}>
                      <Button variant="ghost" size="sm">
                        View
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Showing {page * pageSize + 1} to{" "}
            {Math.min((page + 1) * pageSize, totalCount)} of {totalCount}{" "}
            attempts
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(page - 1)}
              disabled={page === 0}
            >
              Previous
            </Button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 5) {
                  pageNum = i;
                } else if (page < 2) {
                  pageNum = i;
                } else if (page > totalPages - 3) {
                  pageNum = totalPages - 5 + i;
                } else {
                  pageNum = page - 2 + i;
                }
                return (
                  <Button
                    key={pageNum}
                    variant={page === pageNum ? "default" : "outline"}
                    size="sm"
                    onClick={() => handlePageChange(pageNum)}
                  >
                    {pageNum + 1}
                  </Button>
                );
              })}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(page + 1)}
              disabled={page >= totalPages - 1}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
