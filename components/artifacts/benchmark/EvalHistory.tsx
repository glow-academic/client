/**
 * EvalHistory.tsx
 * History component for displaying benchmark tests with pagination, search,
 * faceted filters, bulk archive, and per-row continue/view actions.
 *
 * Mirrors components/common/SimulationHistory.tsx — eval is the analog of
 * simulation. Domain mapping:
 *   simulation → eval / benchmark
 *   attempt    → test (test_id)
 *   scenarios  → models (model_ids/names, num_models, num_models_completed)
 *   personas   → rubric (single chip from rubric_id/rubric_name)
 *   no time_limit
 */

"use client";

import { DataTableColumnHeader } from "@/components/common/table/DataTableColumnHeader";
import { DataTableFacetedFilter } from "@/components/common/table/DataTableFacetedFilter";
import { DataTablePagination } from "@/components/common/table/DataTablePagination";
import { DataTableViewOptions } from "@/components/common/table/DataTableViewOptions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { useColumnVisibility } from "@/hooks/use-column-visibility";
import { useProfile } from "@/contexts/profile-context";
import {
  Column,
  ColumnDef,
  ColumnFiltersState,
  Row,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  useReactTable,
} from "@tanstack/react-table";
import {
  Archive,
  ArrowRight,
  Infinity as InfinityIcon,
  RotateCcw,
  Unlock,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

// Strong server types
import type { components } from "@/lib/api/schema";
export type BenchmarkHistoryItem = components["schemas"]["BenchmarkHistoryItem"];
export type BenchmarkFilterOption = components["schemas"]["FilterOption"];

/** ---- Bulk archive types (mirror server ArchiveTestsRequest/Response) ---- */
export type BulkArchiveTestsIn = {
  body: components["schemas"]["ArchiveTestsRequest"];
};
export type BulkArchiveTestsOut = components["schemas"]["ArchiveTestsResponse"];

/** ---- Inlined per-row actions ---- */
function HistoryRowActions({
  item,
  onRetryTest,
}: {
  item: BenchmarkHistoryItem;
  onRetryTest:
    | ((item: BenchmarkHistoryItem) => Promise<void> | void)
    | undefined;
}) {
  const { profile } = useProfile();
  const [isRetrying, setIsRetrying] = React.useState(false);

  const isCurrentUser = profile?.id === item.profile_id;

  // View vs Continue: server flag + ownership
  const wantContinue = Boolean(item.show_continue) && isCurrentUser;
  const buttonText = wantContinue ? "Continue" : "View";
  const linkHref = `/test/${item.test_id}`;

  const isOwnTest = isCurrentUser;
  const hasEval = (item.eval_id ?? "") !== "";
  // Retry: owner, has eval, can't continue (i.e. fully completed) — re-run from scratch
  const shouldShowRetry =
    isOwnTest && hasEval && !item.show_continue;
  // Try eval: not the owner, but they can fire off their own test
  const shouldShowTry = !isOwnTest && hasEval;

  const handleRetry = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!onRetryTest) {
      // TODO: wire a server-side retry/start-test action analogous to
      // simulation_start. The /test/start endpoint exists (TestStartPayload)
      // but is currently invoked elsewhere via useTestLifecycle. When the
      // benchmark page exposes a retry hook, pass it down via onRetryTest.
      toast.info("Retry coming soon");
      return;
    }
    setIsRetrying(true);
    try {
      await onRetryTest(item);
    } catch {
      toast.error("Failed to start test. Please try again.");
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Link href={linkHref}>
        <Button
          variant="outline"
          size="sm"
          className={`h-8${wantContinue ? " min-w-[96px]" : ""}`}
          disabled={!item.show_view && !wantContinue}
        >
          {buttonText}
        </Button>
      </Link>

      {shouldShowRetry && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Retry"
              className="h-8 w-8 inline-flex items-center justify-center border-input bg-background hover:bg-accent hover:text-accent-foreground"
              disabled={isRetrying}
              onClick={handleRetry}
            >
              <RotateCcw
                className={`h-4 w-4 ${isRetrying ? "animate-spin" : ""}`}
              />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Retry</p>
          </TooltipContent>
        </Tooltip>
      )}

      {shouldShowTry && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Start Test"
              className="h-8 w-8 inline-flex items-center justify-center border-input bg-background hover:bg-accent hover:text-accent-foreground"
              disabled={isRetrying}
              onClick={handleRetry}
            >
              <ArrowRight
                className={`h-4 w-4 ${isRetrying ? "animate-spin" : ""}`}
              />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Try Eval</p>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}

/** ---- Component props ---- */
export interface EvalHistoryProps {
  /** History rows */
  data: BenchmarkHistoryItem[];

  /** Total matching rows for pagination */
  totalCount: number;

  /** Current page (0-based) */
  pageIndex: number;

  /** Current page size */
  pageSize: number;

  /** Whether to show archive checkbox + bulk actions */
  showArchive?: boolean | undefined;

  /** Loading state */
  isLoading?: boolean | undefined;

  /** Filter options from server response */
  evalOptions?: BenchmarkFilterOption[] | undefined;
  modelOptions?: BenchmarkFilterOption[] | undefined;
  profileOptions?: BenchmarkFilterOption[] | undefined;
  rubricOptions?: BenchmarkFilterOption[] | undefined;

  /** Server-driven faceted filter search terms */
  evalSearch?: string | undefined;
  modelSearch?: string | undefined;
  profileSearch?: string | undefined;
  rubricSearch?: string | undefined;

  /** SSR column visibility from cookie */
  initialColumnVisibility?: VisibilityState | undefined;

  /**
   * Optional bulk archive server action. If absent, bulk archive UI is
   * disabled with a tooltip (`showArchive` ignored).
   */
  bulkArchiveTestsAction?:
    | ((input: BulkArchiveTestsIn) => Promise<BulkArchiveTestsOut>)
    | undefined;

  /**
   * Optional per-row retry action. If absent, retry button shows a toast.
   * Wire this from a parent that has access to a transport/socket.
   */
  onRetryTest?:
    | ((item: BenchmarkHistoryItem) => Promise<void> | void)
    | undefined;
}

export default function EvalHistory({
  data,
  totalCount,
  pageIndex,
  pageSize,
  showArchive = true,
  isLoading = false,
  evalOptions = [],
  modelOptions = [],
  profileOptions = [],
  rubricOptions = [],
  evalSearch = "",
  modelSearch = "",
  profileSearch = "",
  rubricSearch = "",
  initialColumnVisibility,
  bulkArchiveTestsAction,
  onRetryTest,
}: EvalHistoryProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Whether bulk archive is actually wired
  const canBulkArchive = showArchive && Boolean(bulkArchiveTestsAction);

  /** ---- Search ---- */
  const searchInputRef = React.useRef<HTMLInputElement | null>(null);
  const [searchTerm, setSearchTerm] = React.useState(
    searchParams?.get("historySearch") || "",
  );
  const searchTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  // Local faceted filter searches (server-driven)
  const [localEvalSearch, setLocalEvalSearch] = React.useState(evalSearch);
  const [localModelSearch, setLocalModelSearch] = React.useState(modelSearch);
  const [localProfileSearch, setLocalProfileSearch] = React.useState(profileSearch);
  const [localRubricSearch, setLocalRubricSearch] = React.useState(rubricSearch);
  const evalSearchTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const modelSearchTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const profileSearchTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const rubricSearchTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    const urlSearch = searchParams?.get("historySearch") || "";
    setSearchTerm(urlSearch);
  }, [searchParams]);

  React.useEffect(() => { setLocalEvalSearch(evalSearch); }, [evalSearch]);
  React.useEffect(() => { setLocalModelSearch(modelSearch); }, [modelSearch]);
  React.useEffect(() => { setLocalProfileSearch(profileSearch); }, [profileSearch]);
  React.useEffect(() => { setLocalRubricSearch(rubricSearch); }, [rubricSearch]);

  // Keep input focused while typing
  React.useEffect(() => {
    if (!searchInputRef.current) return;
    if (!searchTerm) return;
    const el = searchInputRef.current;
    el.focus();
    const len = searchTerm.length;
    try {
      el.setSelectionRange(len, len);
    } catch {
      /* noop */
    }
  }, [searchTerm]);

  // Cleanup timeouts on unmount
  React.useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      if (evalSearchTimeoutRef.current) clearTimeout(evalSearchTimeoutRef.current);
      if (modelSearchTimeoutRef.current) clearTimeout(modelSearchTimeoutRef.current);
      if (profileSearchTimeoutRef.current) clearTimeout(profileSearchTimeoutRef.current);
      if (rubricSearchTimeoutRef.current) clearTimeout(rubricSearchTimeoutRef.current);
    };
  }, []);

  /** ---- Column filters (URL-persisted) ---- */
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(() => {
    const filters: ColumnFiltersState = [];
    const profileIds = searchParams?.get("historyProfileIds");
    if (profileIds) {
      filters.push({ id: "profileId", value: profileIds.split(",").filter(Boolean) });
    }
    const evalIds = searchParams?.get("historyEvalIds");
    if (evalIds) {
      filters.push({ id: "evalId", value: evalIds.split(",").filter(Boolean) });
    }
    const modelIds = searchParams?.get("historyModelIds");
    if (modelIds) {
      filters.push({ id: "models", value: modelIds.split(",").filter(Boolean) });
    }
    const rubricIds = searchParams?.get("historyRubricIds");
    if (rubricIds) {
      filters.push({ id: "rubricId", value: rubricIds.split(",").filter(Boolean) });
    }
    return filters;
  });

  /** ---- Sorting (URL-persisted) ---- */
  const [sorting, setSorting] = React.useState<SortingState>(() => {
    const sortBy = searchParams?.get("historySortBy") || "date";
    const sortOrder = searchParams?.get("historySortOrder") || "desc";
    return [{ id: sortBy, desc: sortOrder === "desc" }];
  });

  /** ---- Other table state ---- */
  const [rowSelection, setRowSelection] = React.useState({});
  const [columnVisibility, setColumnVisibility] = useColumnVisibility(
    "eval-history-columns",
    {
      search: false,
      profileId: false,
      evalId: false,
      models: false,
      rubricId: false,
      ...initialColumnVisibility,
    },
  );

  const [showArchiveDialog, setShowArchiveDialog] = React.useState(false);
  const [archiveAction, setArchiveAction] = React.useState<boolean | null>(null);
  const [isArchiving, setIsArchiving] = React.useState(false);

  /** ---- URL helper ---- */
  const updateHistoryParams = React.useCallback(
    (updates: {
      page?: number;
      pageSize?: number;
      search?: string;
      profileIds?: string[];
      evalIds?: string[];
      modelIds?: string[];
      rubricIds?: string[];
      sortBy?: string;
      sortOrder?: string;
      evalSearchTerm?: string;
      modelSearchTerm?: string;
      profileSearchTerm?: string;
      rubricSearchTerm?: string;
    }) => {
      const params = new URLSearchParams(searchParams?.toString() || "");

      if (updates.page !== undefined) {
        if (updates.page === 0) params.delete("historyPage");
        else params.set("historyPage", updates.page.toString());
      }
      if (updates.pageSize !== undefined) {
        if (updates.pageSize === 10) params.delete("historyPageSize");
        else params.set("historyPageSize", updates.pageSize.toString());
      }
      if (updates.search !== undefined) {
        if (!updates.search) params.delete("historySearch");
        else params.set("historySearch", updates.search);
      }
      if (updates.profileIds !== undefined) {
        if (!updates.profileIds.length) params.delete("historyProfileIds");
        else params.set("historyProfileIds", updates.profileIds.join(","));
      }
      if (updates.evalIds !== undefined) {
        if (!updates.evalIds.length) params.delete("historyEvalIds");
        else params.set("historyEvalIds", updates.evalIds.join(","));
      }
      if (updates.modelIds !== undefined) {
        if (!updates.modelIds.length) params.delete("historyModelIds");
        else params.set("historyModelIds", updates.modelIds.join(","));
      }
      if (updates.rubricIds !== undefined) {
        if (!updates.rubricIds.length) params.delete("historyRubricIds");
        else params.set("historyRubricIds", updates.rubricIds.join(","));
      }
      if (updates.sortBy !== undefined && updates.sortOrder !== undefined) {
        if (updates.sortBy === "date" && updates.sortOrder === "desc") {
          params.delete("historySortBy");
          params.delete("historySortOrder");
        } else {
          params.set("historySortBy", updates.sortBy);
          params.set("historySortOrder", updates.sortOrder);
        }
      }
      if (updates.evalSearchTerm !== undefined) {
        if (!updates.evalSearchTerm) params.delete("historyEvalSearch");
        else params.set("historyEvalSearch", updates.evalSearchTerm);
      }
      if (updates.modelSearchTerm !== undefined) {
        if (!updates.modelSearchTerm) params.delete("historyModelSearch");
        else params.set("historyModelSearch", updates.modelSearchTerm);
      }
      if (updates.profileSearchTerm !== undefined) {
        if (!updates.profileSearchTerm) params.delete("historyProfileSearch");
        else params.set("historyProfileSearch", updates.profileSearchTerm);
      }
      if (updates.rubricSearchTerm !== undefined) {
        if (!updates.rubricSearchTerm) params.delete("historyRubricSearch");
        else params.set("historyRubricSearch", updates.rubricSearchTerm);
      }

      const newUrl = `${pathname}${params.toString() ? `?${params.toString()}` : ""}`;
      router.replace(newUrl, { scroll: false });
    },
    [searchParams, pathname, router],
  );

  /** ---- Search handlers ---- */
  const commitSearch = React.useCallback(
    (value: string) => {
      updateHistoryParams({ page: 0, search: value.trim() || "" });
    },
    [updateHistoryParams],
  );

  const handleSearchChange = React.useCallback(
    (value: string) => {
      setSearchTerm(value);
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      if (value === "") {
        commitSearch("");
        return;
      }
      searchTimeoutRef.current = setTimeout(() => {
        commitSearch(value);
      }, 500);
    },
    [commitSearch],
  );

  const handleEvalSearchChange = React.useCallback(
    (value: string) => {
      setLocalEvalSearch(value);
      if (evalSearchTimeoutRef.current) clearTimeout(evalSearchTimeoutRef.current);
      evalSearchTimeoutRef.current = setTimeout(() => {
        updateHistoryParams({ evalSearchTerm: value });
      }, 300);
    },
    [updateHistoryParams],
  );
  const handleModelSearchChange = React.useCallback(
    (value: string) => {
      setLocalModelSearch(value);
      if (modelSearchTimeoutRef.current) clearTimeout(modelSearchTimeoutRef.current);
      modelSearchTimeoutRef.current = setTimeout(() => {
        updateHistoryParams({ modelSearchTerm: value });
      }, 300);
    },
    [updateHistoryParams],
  );
  const handleProfileSearchChange = React.useCallback(
    (value: string) => {
      setLocalProfileSearch(value);
      if (profileSearchTimeoutRef.current) clearTimeout(profileSearchTimeoutRef.current);
      profileSearchTimeoutRef.current = setTimeout(() => {
        updateHistoryParams({ profileSearchTerm: value });
      }, 300);
    },
    [updateHistoryParams],
  );
  const handleRubricSearchChange = React.useCallback(
    (value: string) => {
      setLocalRubricSearch(value);
      if (rubricSearchTimeoutRef.current) clearTimeout(rubricSearchTimeoutRef.current);
      rubricSearchTimeoutRef.current = setTimeout(() => {
        updateHistoryParams({ rubricSearchTerm: value });
      }, 300);
    },
    [updateHistoryParams],
  );

  /** ---- Filter option mapping (FilterOption -> {value, label, count}) ---- */
  const mapOptions = React.useCallback(
    (
      opts: BenchmarkFilterOption[],
    ): { value: string; label: string; count?: number }[] =>
      opts.map((o) => {
        const base = { value: o.value, label: o.label ?? o.value };
        return o.count != null ? { ...base, count: o.count } : base;
      }),
    [],
  );
  const filteredEvalOptions = React.useMemo(() => mapOptions(evalOptions), [evalOptions, mapOptions]);
  const filteredModelOptions = React.useMemo(() => mapOptions(modelOptions), [modelOptions, mapOptions]);
  const filteredProfileOptions = React.useMemo(() => mapOptions(profileOptions), [profileOptions, mapOptions]);
  const filteredRubricOptions = React.useMemo(() => mapOptions(rubricOptions), [rubricOptions, mapOptions]);

  /** ---- Row id + archive helpers ---- */
  const getRowId = (item: BenchmarkHistoryItem) => String(item.test_id ?? "");
  const getArchived = (item: BenchmarkHistoryItem) => Boolean(item.is_archived);

  /** ---- Bulk archive ---- */
  const handleBulkArchive = React.useCallback(async (archive: boolean) => {
    setArchiveAction(archive);
    setShowArchiveDialog(true);
  }, []);

  /** ---- Filter / sort / pagination handlers ---- */
  const handleColumnFiltersChange = React.useCallback(
    (
      updater: ColumnFiltersState | ((prev: ColumnFiltersState) => ColumnFiltersState),
    ) => {
      const newFilters = typeof updater === "function" ? updater(columnFilters) : updater;
      setColumnFilters(newFilters);

      const profileIds = newFilters.find((f) => f.id === "profileId")?.value as string[] | undefined;
      const evalIds = newFilters.find((f) => f.id === "evalId")?.value as string[] | undefined;
      const modelIds = newFilters.find((f) => f.id === "models")?.value as string[] | undefined;
      const rubricIds = newFilters.find((f) => f.id === "rubricId")?.value as string[] | undefined;

      updateHistoryParams({
        page: 0,
        profileIds: profileIds || [],
        evalIds: evalIds || [],
        modelIds: modelIds || [],
        rubricIds: rubricIds || [],
      });
    },
    [columnFilters, updateHistoryParams],
  );

  const handleSortingChange = React.useCallback(
    (updater: SortingState | ((prev: SortingState) => SortingState)) => {
      const newSorting = typeof updater === "function" ? updater(sorting) : updater;
      setSorting(newSorting);
      const sortBy = newSorting[0]?.id || "date";
      const sortOrder = newSorting[0]?.desc ? "desc" : "asc";
      updateHistoryParams({ page: 0, sortBy, sortOrder });
    },
    [sorting, updateHistoryParams],
  );

  const handlePaginationChange = React.useCallback(
    (
      updater:
        | { pageIndex: number; pageSize: number }
        | ((prev: { pageIndex: number; pageSize: number }) => {
            pageIndex: number;
            pageSize: number;
          }),
    ) => {
      const newPagination =
        typeof updater === "function" ? updater({ pageIndex, pageSize }) : updater;
      updateHistoryParams({
        page: newPagination.pageIndex,
        pageSize: newPagination.pageSize,
      });
    },
    [pageIndex, pageSize, updateHistoryParams],
  );

  /** ---- Columns ---- */
  const columns = React.useMemo<ColumnDef<BenchmarkHistoryItem>[]>(() => {
    return [
      // Hidden faceting: profileId
      {
        accessorKey: "profile_id",
        id: "profileId",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        filterFn: (row, _id, value) => {
          if (!value || !Array.isArray(value) || value.length === 0) return true;
          return value.includes(row.original.profile_id);
        },
      },
      // Hidden faceting: evalId
      {
        accessorKey: "eval_id",
        id: "evalId",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        filterFn: (row, _id, value) => {
          if (!value || !Array.isArray(value) || value.length === 0) return true;
          return value.includes(row.original.eval_id);
        },
      },
      // Hidden faceting: models (array membership)
      {
        id: "models",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row) => row.model_ids ?? [],
        filterFn: (row, _id, value: string[]) => {
          if (!value || value.length === 0) return true;
          const rowIds = (row.original.model_ids ?? []) as string[];
          return value.some((v) => rowIds.includes(v));
        },
      },
      // Hidden faceting: rubricId
      {
        accessorKey: "rubric_id",
        id: "rubricId",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        filterFn: (row, _id, value) => {
          if (!value || !Array.isArray(value) || value.length === 0) return true;
          return value.includes(row.original.rubric_id);
        },
      },
      // Date column
      {
        accessorKey: "date",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Date" />
        ),
        cell: ({ row }) => {
          const raw = row.getValue("date") as string | null | undefined;
          if (!raw) {
            return <div className="text-sm text-muted-foreground">—</div>;
          }
          const date = new Date(raw);
          if (Number.isNaN(date.getTime())) {
            return <div className="text-sm text-muted-foreground">Invalid Date</div>;
          }
          const day = String(date.getDate()).padStart(2, "0");
          const month = String(date.getMonth() + 1).padStart(2, "0");
          const year = String(date.getFullYear()).slice(-2);
          const time = date.toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          });
          const isArchived = Boolean(row.original.is_archived);
          return (
            <div className="flex items-center justify-between">
              <div className="font-medium text-sm">
                <div>{month}-{day}-{year}</div>
                <div className="text-xs text-muted-foreground">{time}</div>
              </div>
              {isArchived && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="w-2 h-2 rounded-full bg-red-500 ml-2" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Archived</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          );
        },
        enableSorting: true,
        sortDescFirst: true,
      },
      // Profile (Name) column
      {
        accessorKey: "profile_name",
        id: "profileName",
        header: ({ column }: { column: Column<BenchmarkHistoryItem, unknown> }) => (
          <DataTableColumnHeader column={column} title="Name" />
        ),
        cell: ({ row }: { row: Row<BenchmarkHistoryItem> }) => {
          const profileName = row.original.profile_name || "";
          return (
            <div className="flex items-center min-w-0 max-w-[200px]">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="truncate">{profileName}</span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{profileName}</p>
                </TooltipContent>
              </Tooltip>
            </div>
          );
        },
        enableSorting: true,
      },
      // Eval column (linked to /test/{test_id})
      {
        accessorKey: "eval_name",
        id: "evalName",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Eval" />
        ),
        cell: ({ row }) => {
          const evalName = row.original.eval_name || "Untitled Eval";
          const testId = row.original.test_id;
          const isInfinite = row.original.infinite_mode;
          return (
            <div className="flex items-center space-x-1 min-w-0 max-w-[280px]">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    href={`/test/${testId}`}
                    className="truncate font-medium hover:underline"
                  >
                    {evalName}
                  </Link>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{evalName}</p>
                </TooltipContent>
              </Tooltip>
              {isInfinite && (
                <InfinityIcon className="h-3 w-3 text-muted-foreground flex-shrink-0" />
              )}
            </div>
          );
        },
        enableHiding: true,
      },
      // Models completion + rubric chip
      {
        accessorKey: "num_models_completed",
        id: "numModelsCompleted",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Models" />
        ),
        cell: ({ row }) => {
          const completedCount = row.original.num_models_completed ?? 0;
          const totalCount = row.original.num_models ?? 0;
          const isInfinite = row.original.infinite_mode;
          const modelNames = row.original.model_names ?? [];
          const rubricName = row.original.rubric_name;

          return (
            <div className="text-center">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="font-medium inline-flex items-center gap-1">
                    {completedCount}
                    <span>/</span>
                    {isInfinite ? (
                      <InfinityIcon className="h-3 w-3 text-muted-foreground" />
                    ) : (
                      <span>{totalCount}</span>
                    )}
                  </span>
                </TooltipTrigger>
                {modelNames.length > 0 && (
                  <TooltipContent>
                    <p className="font-medium mb-1">Models:</p>
                    <ul className="text-xs">
                      {modelNames.map((m, i) => (
                        <li key={i}>• {m}</li>
                      ))}
                    </ul>
                  </TooltipContent>
                )}
              </Tooltip>
              <div className="text-xs text-muted-foreground">completed</div>
              {/* Rubric chip — eval has exactly one rubric */}
              {rubricName && (
                <div className="flex items-center justify-center mt-1.5">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 max-w-[160px]">
                        <span className="truncate">{rubricName}</span>
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Rubric: {rubricName}</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              )}
            </div>
          );
        },
        enableSorting: true,
        accessorFn: (row) => {
          const total = row.num_models ?? 0;
          if (total === 0) return 0;
          return (row.num_models_completed ?? 0) / total;
        },
      },
      // Score column
      {
        accessorKey: "score",
        id: "score",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Score" />
        ),
        accessorFn: (row) => row.score,
        cell: ({ row }) => {
          const score = row.original.score;
          const scoreStatus = row.original.score_status;
          if (score === null || score === undefined) {
            return (
              <div className="text-muted-foreground text-center min-w-0 max-w-[100px]">
                Not graded
              </div>
            );
          }
          const badgeClassName =
            scoreStatus === "high" || scoreStatus === "pass"
              ? "bg-success/10 text-success border-success/30 hover:bg-success/20"
              : scoreStatus === "medium" || scoreStatus === "in_progress"
                ? "bg-warning/10 text-warning border-warning/30 hover:bg-warning/20"
                : scoreStatus === "low" || scoreStatus === "fail"
                  ? "bg-destructive/10 text-destructive border-destructive/30 hover:bg-destructive/20"
                  : "";
          return (
            <div className="text-center min-w-0 max-w-[100px]">
              <Badge variant="outline" className={`text-xs font-semibold ${badgeClassName}`}>
                {score}%
              </Badge>
            </div>
          );
        },
        enableSorting: true,
      },
      // Actions
      {
        id: "actions",
        cell: ({ row }) => (
          <HistoryRowActions item={row.original} onRetryTest={onRetryTest} />
        ),
      },
    ];
  }, [onRetryTest]);

  // Optional checkbox column
  const columnsWithCheckbox = React.useMemo<ColumnDef<BenchmarkHistoryItem>[]>(() => {
    if (!showArchive) return columns;
    const checkboxColumn: ColumnDef<BenchmarkHistoryItem> = {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")
          }
          onCheckedChange={(value) => {
            if (value) table.toggleAllPageRowsSelected(true);
            else table.resetRowSelection();
          }}
          aria-label="Select all"
          className="translate-y-[2px]"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(val) => row.toggleSelected(!!val)}
          aria-label="Select row"
          className="translate-y-[2px]"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    };
    return [checkboxColumn, ...columns];
  }, [columns, showArchive]);

  /** ---- Table ---- */
  const table = useReactTable({
    data,
    columns: columnsWithCheckbox,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
      columnFilters,
      pagination: { pageIndex, pageSize },
    },
    enableRowSelection: showArchive,
    onRowSelectionChange: setRowSelection,
    onSortingChange: handleSortingChange,
    onColumnFiltersChange: handleColumnFiltersChange,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: handlePaginationChange,
    manualPagination: true,
    manualFiltering: true,
    manualSorting: true,
    pageCount: Math.ceil(totalCount / pageSize),
    getCoreRowModel: getCoreRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    getRowId: (row, index) => getRowId(row) || String(index),
  });

  /** ---- Reset ---- */
  const handleResetAll = React.useCallback(() => {
    table.resetColumnFilters();
    table.resetSorting();
    setColumnFilters([]);
    setSearchTerm("");
    setSorting([{ id: "date", desc: true }]);
    setLocalEvalSearch("");
    setLocalModelSearch("");
    setLocalProfileSearch("");
    setLocalRubricSearch("");
    updateHistoryParams({
      page: 0,
      search: "",
      profileIds: [],
      evalIds: [],
      modelIds: [],
      rubricIds: [],
      sortBy: "date",
      sortOrder: "desc",
      evalSearchTerm: "",
      modelSearchTerm: "",
      profileSearchTerm: "",
      rubricSearchTerm: "",
    });
  }, [table, updateHistoryParams]);

  const visibleColumns = table.getVisibleLeafColumns();

  /** ---- Row selection bookkeeping ---- */
  const rowSelectionState = table.getState().rowSelection;
  const selectedTestIds = React.useMemo(() => {
    return table
      .getSelectedRowModel()
      .flatRows.map((r) => getRowId(r.original));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, rowSelectionState]);

  const { archiveCount, unarchiveCount } = React.useMemo(() => {
    const selectedRows = table.getSelectedRowModel().flatRows;
    let a = 0, u = 0;
    for (const r of selectedRows) {
      if (getArchived(r.original)) u++;
      else a++;
    }
    return { archiveCount: a, unarchiveCount: u };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, rowSelectionState]);

  /** ---- Execute bulk archive ---- */
  const executeBulkArchive = React.useCallback(async () => {
    if (archiveAction === null || !bulkArchiveTestsAction) return;
    setIsArchiving(true);
    try {
      const selectedRows = table.getSelectedRowModel().flatRows;
      const testIdsToUpdate = selectedRows
        .map((r) => r.original)
        .filter((item) => {
          const isArchived = getArchived(item);
          return archiveAction ? !isArchived : isArchived;
        })
        .map((item) => getRowId(item))
        .filter(Boolean);

      if (testIdsToUpdate.length === 0) {
        setIsArchiving(false);
        return;
      }

      const result = await bulkArchiveTestsAction({
        body: {
          test_ids: testIdsToUpdate,
          archived: archiveAction,
        },
      });

      const updated = result.updated_count ?? testIdsToUpdate.length;
      toast.success(
        `${updated} test${updated === 1 ? "" : "s"} ${archiveAction ? "archived" : "unarchived"} successfully`,
      );

      table.resetRowSelection();
      setShowArchiveDialog(false);
      setArchiveAction(null);

      const params = new URLSearchParams(searchParams?.toString() || "");
      params.set("_refresh", Date.now().toString());
      const newUrl = `${pathname}${params.toString() ? `?${params.toString()}` : ""}`;
      router.replace(newUrl, { scroll: false });
      await router.refresh();
    } catch {
      toast.error("Failed to update test archive status");
    } finally {
      setIsArchiving(false);
    }
  }, [
    archiveAction,
    bulkArchiveTestsAction,
    router,
    table,
    searchParams,
    pathname,
  ]);

  /** ---- Toolbar state ---- */
  const currentSortBy = sorting[0]?.id || "date";
  const currentSortOrder = sorting[0]?.desc ? "desc" : "asc";
  const isFiltered =
    table.getState().columnFilters.length > 0 ||
    searchTerm !== "" ||
    localEvalSearch !== "" ||
    localModelSearch !== "" ||
    localProfileSearch !== "" ||
    localRubricSearch !== "" ||
    currentSortBy !== "date" ||
    currentSortOrder !== "desc";

  const profileIdColumn = table.getColumn("profileId");
  const evalIdColumn = table.getColumn("evalId");
  const modelsColumn = table.getColumn("models");
  const rubricIdColumn = table.getColumn("rubricId");

  /** ---- Memoize rows for stable re-renders ---- */
  const tablePageIndex = table.getState().pagination.pageIndex;
  const tablePageSize = table.getState().pagination.pageSize;
  const sortingKey = JSON.stringify(sorting);
  const columnFiltersKey = JSON.stringify(columnFilters);
  const tableRows = React.useMemo(() => {
    return table.getRowModel().rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    sortingKey,
    columnFiltersKey,
    data.length,
    tablePageIndex,
    tablePageSize,
  ]);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        <div className="flex flex-col md:flex-row md:flex-1 md:items-center md:space-x-2 gap-2 md:gap-0 min-w-0">
          <Input
            ref={searchInputRef}
            placeholder="Search by name, eval, or models..."
            value={searchTerm}
            onChange={(e) => handleSearchChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
                commitSearch(e.currentTarget.value);
              }
            }}
            onBlur={(e) => {
              if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
              if (e.currentTarget.value !== (searchParams?.get("historySearch") || "")) {
                commitSearch(e.currentTarget.value);
              }
            }}
            className="h-8 w-full md:w-[150px] lg:w-[250px]"
          />

          {isLoading ? (
            <div className="flex items-center space-x-2 overflow-x-auto flex-nowrap min-w-0 max-w-[600px] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              <Skeleton className="h-8 w-[120px]" />
              <Skeleton className="h-8 w-[120px]" />
              <Skeleton className="h-8 w-[140px]" />
              <Skeleton className="h-8 w-[120px]" />
            </div>
          ) : (
            <div className="flex items-center space-x-2 overflow-x-auto flex-nowrap min-w-0 max-w-[600px] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              {evalIdColumn && filteredEvalOptions.length > 0 && (
                <DataTableFacetedFilter
                  column={evalIdColumn}
                  title="Eval"
                  options={filteredEvalOptions}
                  isServerDriven={true}
                  onSearchChange={handleEvalSearchChange}
                  searchValue={localEvalSearch}
                />
              )}
              {modelsColumn && filteredModelOptions.length > 0 && (
                <DataTableFacetedFilter
                  column={modelsColumn}
                  title="Model"
                  options={filteredModelOptions}
                  isServerDriven={true}
                  onSearchChange={handleModelSearchChange}
                  searchValue={localModelSearch}
                />
              )}
              {profileIdColumn && filteredProfileOptions.length > 0 && (
                <DataTableFacetedFilter
                  column={profileIdColumn}
                  title="Profile"
                  options={filteredProfileOptions}
                  isServerDriven={true}
                  onSearchChange={handleProfileSearchChange}
                  searchValue={localProfileSearch}
                />
              )}
              {rubricIdColumn && filteredRubricOptions.length > 0 && (
                <DataTableFacetedFilter
                  column={rubricIdColumn}
                  title="Rubric"
                  options={filteredRubricOptions}
                  isServerDriven={true}
                  onSearchChange={handleRubricSearchChange}
                  searchValue={localRubricSearch}
                />
              )}
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
          )}
        </div>

        <div className="flex items-center space-x-2">
          {showArchive && selectedTestIds.length > 0 && (
            <>
              {archiveCount > 0 && (
                canBulkArchive ? (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleBulkArchive(true)}
                    className="h-8"
                  >
                    <Archive className="mr-2 h-4 w-4" />
                    Archive {archiveCount}
                  </Button>
                ) : (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span>
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled
                          className="h-8 opacity-60"
                        >
                          <Archive className="mr-2 h-4 w-4" />
                          Archive {archiveCount}
                        </Button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      {/* TODO: wire bulkArchiveTestsAction in app/(main)/benchmark/page.tsx */}
                      <p>Bulk archive not wired yet</p>
                    </TooltipContent>
                  </Tooltip>
                )
              )}
              {unarchiveCount > 0 && (
                canBulkArchive ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleBulkArchive(false)}
                    className="h-8"
                  >
                    <Unlock className="mr-2 h-4 w-4" />
                    Restore {unarchiveCount}
                  </Button>
                ) : (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled
                          className="h-8 opacity-60"
                        >
                          <Unlock className="mr-2 h-4 w-4" />
                          Restore {unarchiveCount}
                        </Button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Bulk restore not wired yet</p>
                    </TooltipContent>
                  </Tooltip>
                )
              )}
            </>
          )}
          <DataTableViewOptions table={table} />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} colSpan={header.colSpan} className="pl-6">
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: pageSize || 10 }).map((_, i) => (
                <TableRow key={`skeleton-${i}`}>
                  {visibleColumns.map((column) => {
                    const id = column.id;
                    if (id === "select") {
                      return (
                        <TableCell key={id} className="px-6">
                          <Skeleton className="h-4 w-4 rounded-sm" />
                        </TableCell>
                      );
                    }
                    if (id === "date") {
                      return (
                        <TableCell key={id} className="px-6">
                          <div className="flex items-center justify-between">
                            <div>
                              <Skeleton className="h-4 w-20 mb-1" />
                              <Skeleton className="h-3 w-12" />
                            </div>
                            <Skeleton className="h-2 w-2 rounded-full" />
                          </div>
                        </TableCell>
                      );
                    }
                    if (id === "profileName") {
                      return (
                        <TableCell key={id} className="px-6">
                          <Skeleton className="h-4 w-28" />
                        </TableCell>
                      );
                    }
                    if (id === "evalName") {
                      return (
                        <TableCell key={id} className="px-6">
                          <Skeleton className="h-4 w-40" />
                        </TableCell>
                      );
                    }
                    if (id === "numModelsCompleted") {
                      return (
                        <TableCell key={id} className="px-6">
                          <div className="flex flex-col items-center gap-1">
                            <Skeleton className="h-4 w-16" />
                            <Skeleton className="h-3 w-20" />
                            <Skeleton className="h-4 w-24 rounded-full" />
                          </div>
                        </TableCell>
                      );
                    }
                    if (id === "score") {
                      return (
                        <TableCell key={id} className="px-6">
                          <div className="flex justify-center">
                            <Skeleton className="h-6 w-16 rounded-full" />
                          </div>
                        </TableCell>
                      );
                    }
                    if (id === "actions") {
                      return (
                        <TableCell key={id} className="px-6">
                          <div className="flex justify-end gap-2">
                            <Skeleton className="h-8 w-20 rounded-md" />
                            <Skeleton className="h-8 w-8 rounded-md" />
                          </div>
                        </TableCell>
                      );
                    }
                    return (
                      <TableCell key={id} className="px-6">
                        <Skeleton className="h-4 w-[70%]" />
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))
            ) : tableRows?.length ? (
              tableRows.map((row) => (
                <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="px-6">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columnsWithCheckbox.length} className="h-24 text-center px-6">
                  No tests found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {isLoading ? (
        <div className="flex items-center px-2">
          <div className="hidden md:flex items-center justify-between w-full">
            <div className="flex-1"></div>
            <div className="flex items-center space-x-6 lg:space-x-8">
              <div className="flex items-center space-x-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-[70px]" />
              </div>
              <Skeleton className="h-4 w-[100px]" />
              <div className="flex items-center space-x-2">
                <Skeleton className="h-8 w-8 rounded-md hidden lg:block" />
                <Skeleton className="h-8 w-8 rounded-md" />
                <Skeleton className="h-8 w-8 rounded-md" />
                <Skeleton className="h-8 w-8 rounded-md hidden lg:block" />
              </div>
            </div>
          </div>
        </div>
      ) : (
        <DataTablePagination table={table} />
      )}

      {/* Bulk Archive Confirmation Dialog */}
      <AlertDialog open={showArchiveDialog} onOpenChange={setShowArchiveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {archiveAction
                ? `Archive ${archiveCount} Test${archiveCount > 1 ? "s" : ""}`
                : `Restore ${unarchiveCount} Test${unarchiveCount > 1 ? "s" : ""}`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {archiveAction
                ? `Are you sure you want to archive ${archiveCount} test${archiveCount > 1 ? "s" : ""}? They will be hidden from the main test list but can be accessed through archived filters.`
                : `Are you sure you want to restore ${unarchiveCount} test${unarchiveCount > 1 ? "s" : ""}? They will be visible again in the main test list.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isArchiving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={executeBulkArchive}
              disabled={isArchiving}
              className={isArchiving ? "opacity-50 cursor-not-allowed" : ""}
            >
              {isArchiving ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Processing...
                </div>
              ) : archiveAction ? (
                "Archive"
              ) : (
                "Restore"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export function EvalHistorySkeleton({ rows = 10 }: { rows?: number }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex flex-1 items-center space-x-2">
          <Skeleton className="h-8 w-[250px]" />
          <Skeleton className="h-8 w-[120px]" />
          <Skeleton className="h-8 w-[120px]" />
          <Skeleton className="h-8 w-[140px]" />
          <Skeleton className="h-8 w-[120px]" />
        </div>
        <div className="flex items-center space-x-2">
          <Skeleton className="h-8 w-[90px]" />
        </div>
      </div>
      <div className="rounded-md border">
        <div className="grid grid-cols-6 gap-0 px-6 py-3 border-b">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-40 col-span-2" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-16 justify-self-end" />
        </div>
        <div className="divide-y">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="grid grid-cols-6 gap-0 px-6 py-4">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-[90%] col-span-2" />
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-10" />
                <Skeleton className="h-4 w-10" />
              </div>
              <div className="flex items-center justify-end gap-2">
                <Skeleton className="h-8 w-20" />
                <Skeleton className="h-8 w-8" />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-end px-2">
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-[70px]" />
          </div>
          <Skeleton className="h-4 w-24" />
          <div className="flex items-center space-x-2">
            <Skeleton className="h-8 w-8" />
            <Skeleton className="h-8 w-8" />
            <Skeleton className="h-8 w-8" />
            <Skeleton className="h-8 w-8" />
          </div>
        </div>
      </div>
    </div>
  );
}
