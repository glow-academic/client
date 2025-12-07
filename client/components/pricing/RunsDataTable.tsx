"use client";

import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  useReactTable,
} from "@tanstack/react-table";
import { Bug } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";

import { DataTableColumnHeader } from "@/components/common/table/DataTableColumnHeader";
import { DataTableFacetedFilter } from "@/components/common/table/DataTableFacetedFilter";
import { DataTablePagination } from "@/components/common/table/DataTablePagination";
import { DataTableViewOptions } from "@/components/common/table/DataTableViewOptions";
import { Button } from "@/components/ui/button";

import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Input } from "@/components/ui/input";

import { Skeleton } from "@/components/ui/skeleton";
import { useProfile } from "@/contexts/profile-context";
import { format } from "date-fns";
import { X } from "lucide-react";

type DebugInfoItem = {
  id: string;
  created_at: string;
  content: string;
};

type ModelMappingWithPricing = {
  name: string;
  description: string;
  input_ppm: number;
  output_ppm: number;
};

const currency = (value: number) =>
  new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 4,
  }).format(value);

export interface ModelRunRow {
  id: string;
  createdAt: string;
  modelId: string | null;
  modelName: string;
  agentId?: string | null;
  agentName?: string;
  personaId?: string | null;
  personaName?: string;
  profileId?: string | null;
  profileName?: string;
  inputTokens: number;
  outputTokens: number;
  debugInfo?: DebugInfoItem[];
  cost: number;
}

export interface RunsDataTableProps {
  rows: ModelRunRow[];
  modelMapping: Record<string, ModelMappingWithPricing>;
  profileMapping: Record<string, string>;
  agentMapping: Record<string, string>;
  personaMapping: Record<string, string>;
  isLoading?: boolean;
  modelOptions: Array<{ value: string; label: string; count?: number }>;
  profileOptions: Array<{ value: string; label: string; count?: number }>;
  actorOptions: Array<{ value: string; label: string; count?: number }>;
  totalCount: number;
  totalPages: number;
}

export function RunsDataTable({
  rows,
  modelMapping: _modelMapping,
  profileMapping: _profileMapping,
  agentMapping: _agentMapping,
  personaMapping: _personaMapping,
  isLoading = false,
  modelOptions,
  profileOptions,
  actorOptions,
  totalCount: _totalCount,
  totalPages,
}: RunsDataTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { effectiveProfile } = useProfile();
  const isSuperadmin = effectiveProfile?.role === "superadmin";

  // Ref for the search input
  const searchInputRef = React.useRef<HTMLInputElement | null>(null);

  // Local search state, initialized from URL
  const [searchTerm, setSearchTerm] = React.useState(
    searchParams.get("pricingSearch") || "",
  );

  // Ref to track debounce timeout for search
  const searchTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  // Keep local state in sync if URL changes (back/forward, link, etc.)
  React.useEffect(() => {
    const urlSearch = searchParams.get("pricingSearch") || "";
    setSearchTerm(urlSearch);
  }, [searchParams]);

  // Whenever we have a searchTerm, keep the input focused
  React.useEffect(() => {
    if (!searchInputRef.current) return;
    if (!searchTerm) return; // don't auto-focus on completely empty state

    const el = searchInputRef.current;
    el.focus();
    const len = searchTerm.length;
    // put cursor at end of text
    try {
      el.setSelectionRange(len, len);
    } catch {
      // some browsers can be picky; ignore
    }
  }, [searchTerm]);

  // Cleanup timeout on unmount
  React.useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({
      modelIdFilter: false,
      profileIdFilter: false,
      actorIdFilter: false,
    });

  // Sync URL params for sorting
  const sortBy = searchParams.get("pricingSortBy") || "createdAt";
  const sortOrder = searchParams.get("pricingSortOrder") || "desc";
  const sorting: SortingState = React.useMemo(
    () => [{ id: sortBy, desc: sortOrder === "desc" }],
    [sortBy, sortOrder],
  );

  // Sync URL params for filters
  const pricingModelIdsParam = searchParams.get("pricingModelIds");
  const pricingProfileIdsParam = searchParams.get("pricingProfileIds");
  const pricingActorIdsParam = searchParams.get("pricingActorIds");

  const pricingModelIds = React.useMemo(
    () =>
      pricingModelIdsParam
        ? pricingModelIdsParam.split(",").filter(Boolean)
        : [],
    [pricingModelIdsParam],
  );
  const pricingProfileIds = React.useMemo(
    () =>
      pricingProfileIdsParam
        ? pricingProfileIdsParam.split(",").filter(Boolean)
        : [],
    [pricingProfileIdsParam],
  );
  const pricingActorIds = React.useMemo(
    () =>
      pricingActorIdsParam
        ? pricingActorIdsParam.split(",").filter(Boolean)
        : [],
    [pricingActorIdsParam],
  );

  // Sync column filters with URL params (for DataTableFacetedFilter compatibility)
  const columnFilters: ColumnFiltersState = React.useMemo(() => {
    const filters: ColumnFiltersState = [];
    if (pricingModelIds.length > 0) {
      filters.push({ id: "modelIdFilter", value: pricingModelIds });
    }
    if (pricingProfileIds.length > 0) {
      filters.push({ id: "profileIdFilter", value: pricingProfileIds });
    }
    if (pricingActorIds.length > 0) {
      filters.push({ id: "actorIdFilter", value: pricingActorIds });
    }
    return filters;
  }, [pricingModelIds, pricingProfileIds, pricingActorIds]);

  // Helper to update URL params (removes default values)
  const updateURLParams = React.useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([key, value]) => {
        if (value === null || value === "") {
          params.delete(key);
        } else {
          // Remove default values from URL
          if (key === "pricingPage" && value === "0") {
            params.delete(key);
          } else if (key === "pricingPageSize" && value === "10") {
            params.delete(key);
          } else if (key === "pricingSortBy" && value === "createdAt") {
            params.delete(key);
          } else if (key === "pricingSortOrder" && value === "desc") {
            params.delete(key);
          } else {
            params.set(key, value);
          }
        }
      });
      router.push(`?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  // Commit search to URL (called on Enter or blur, or after debounce)
  const commitSearch = React.useCallback(
    (value: string) => {
      updateURLParams({
        pricingPage: "0",
        pricingSearch: value.trim() || null,
      });
    },
    [updateURLParams],
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
    [commitSearch],
  );

  const columns = React.useMemo<ColumnDef<ModelRunRow>[]>(() => {
    const cols: ColumnDef<ModelRunRow>[] = [
      {
        accessorKey: "createdAt",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Created" />
        ),
        cell: ({ row }) => (
          <div className="text-sm">
            {format(new Date(row.getValue("createdAt")), "yyyy-MM-dd HH:mm")}
          </div>
        ),
        enableSorting: true,
      },
      {
        accessorKey: "modelName",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Model" />
        ),
        cell: ({ row }) => (
          <div className="text-sm">{row.getValue("modelName")}</div>
        ),
        enableHiding: true,
        filterFn: (row, _id, value) => {
          return (value as string[]).includes(row.original.modelId || "");
        },
      },
      // Hidden faceting column for Model (IDs)
      {
        id: "modelIdFilter",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: ModelRunRow) => row.modelId || "",
        filterFn: (row, _id, value: string[]) => {
          if (!value || value.length === 0) return true;
          const modelId = row.original.modelId || "";
          // Additive filtering: keep row if modelId is in selected values
          return value.includes(modelId);
        },
      },
      {
        accessorKey: "profileName",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Name" />
        ),
        cell: ({ row }) => (
          <div className="text-sm">{row.getValue("profileName")}</div>
        ),
        enableHiding: true,
        filterFn: (row, _id, value) => {
          return (value as string[]).includes(row.original.profileId || "");
        },
      },
      // Hidden faceting column for Profile/Name (IDs)
      {
        id: "profileIdFilter",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: ModelRunRow) => row.profileId || "",
        filterFn: (row, _id, value: string[]) => {
          if (!value || value.length === 0) return true;
          const profileId = row.original.profileId || "";
          // Additive filtering: keep row if profileId is in selected values
          return value.includes(profileId);
        },
      },
      {
        id: "actorId",
        accessorFn: (r) => r.agentId || r.personaId || "",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Agent/Persona" />
        ),
        cell: ({ row }) => {
          const label =
            row.original.agentName || row.original.personaName || "";
          return <div className="text-sm">{label}</div>;
        },
        enableHiding: true,
        filterFn: (row, _id, value) => {
          const selected = (value as string[] | undefined) ?? [];
          const { agentId, personaId } = row.original;
          if (!selected?.length) return true;
          // Additive filtering: keep row if agentId or personaId is in selected values
          if (agentId && selected.includes(agentId)) return true;
          if (personaId && selected.includes(personaId)) return true;
          return false;
        },
      },
      // Hidden faceting column for Actor (Agent/Persona IDs)
      {
        id: "actorIdFilter",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: ModelRunRow) => {
          // Return array of IDs that this row matches (agentId and/or personaId)
          const ids: string[] = [];
          if (row.agentId) ids.push(row.agentId);
          if (row.personaId) ids.push(row.personaId);
          return ids;
        },
        filterFn: (row, _id, value: string[]) => {
          const rowIds = (row.getValue("actorIdFilter") as string[]) ?? [];
          if (!value || value.length === 0) return true;
          // Additive filtering: keep row if it contains ANY selected actor ID
          return value.some((v) => rowIds.includes(v));
        },
      },
      {
        accessorKey: "inputTokens",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Input Tokens" />
        ),
        cell: ({ row }) => (
          <div className="text-sm tabular-nums">
            {row.getValue("inputTokens")}
          </div>
        ),
        enableSorting: true,
      },
      {
        accessorKey: "outputTokens",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Output Tokens" />
        ),
        cell: ({ row }) => (
          <div className="text-sm tabular-nums">
            {row.getValue("outputTokens")}
          </div>
        ),
        enableSorting: true,
      },
      {
        accessorKey: "cost",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Cost" />
        ),
        cell: ({ row }) => (
          <div className="text-sm tabular-nums font-medium">
            {currency(row.getValue("cost") as number)}
          </div>
        ),
        enableSorting: true,
      },
    ];

    if (isSuperadmin) {
      cols.push({
        id: "debug",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Debug" />
        ),
        cell: ({ row }) => {
          const d = row.original.debugInfo || [];
          const has = d.length > 0;
          const content = d[0]?.content ?? null; // display first entry content
          return (
            <HoverCard>
              <HoverCardTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  disabled={!has}
                >
                  <Bug
                    className={`h-4 w-4 ${has ? "text-amber-600" : "text-muted-foreground"}`}
                  />
                </Button>
              </HoverCardTrigger>
              <HoverCardContent align="start" className="max-w-[480px]">
                {content ? (
                  <pre className="text-xs whitespace-pre-wrap break-words">
                    {content}
                  </pre>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    No debug info
                  </span>
                )}
              </HoverCardContent>
            </HoverCard>
          );
        },
      });
    }

    return cols;
  }, [isSuperadmin]);

  // Extract pagination metadata from URL params
  const pricingPage = searchParams.get("pricingPage")
    ? parseInt(searchParams.get("pricingPage") || "0", 10)
    : 0;
  const pricingPageSize = searchParams.get("pricingPageSize")
    ? parseInt(searchParams.get("pricingPageSize") || "10", 10)
    : 10;

  // Handle sorting change
  const handleSortingChange = React.useCallback(
    (updater: SortingState | ((prev: SortingState) => SortingState)) => {
      const newSorting =
        typeof updater === "function" ? updater(sorting) : updater;

      const sortBy = newSorting[0]?.id || "createdAt";
      const sortOrder = newSorting[0]?.desc ? "desc" : "asc";

      // Reset to page 0 whenever sort changes
      updateURLParams({
        pricingPage: "0",
        pricingSortBy: sortBy,
        pricingSortOrder: sortOrder,
      });
    },
    [sorting, updateURLParams],
  );

  // Handle column filters change
  const handleColumnFiltersChange = React.useCallback(
    (
      updater:
        | ColumnFiltersState
        | ((prev: ColumnFiltersState) => ColumnFiltersState),
    ) => {
      const newFilters =
        typeof updater === "function" ? updater(columnFilters) : updater;

      const modelFilter = newFilters.find((f) => f.id === "modelIdFilter");
      const profileFilter = newFilters.find((f) => f.id === "profileIdFilter");
      const actorFilter = newFilters.find((f) => f.id === "actorIdFilter");

      updateURLParams({
        pricingPage: "0",
        pricingModelIds:
          modelFilter &&
          Array.isArray(modelFilter.value) &&
          modelFilter.value.length > 0
            ? modelFilter.value.join(",")
            : null,
        pricingProfileIds:
          profileFilter &&
          Array.isArray(profileFilter.value) &&
          profileFilter.value.length > 0
            ? profileFilter.value.join(",")
            : null,
        pricingActorIds:
          actorFilter &&
          Array.isArray(actorFilter.value) &&
          actorFilter.value.length > 0
            ? actorFilter.value.join(",")
            : null,
      });
    },
    [columnFilters, updateURLParams],
  );

  // Handle pagination change
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
        typeof updater === "function"
          ? updater({ pageIndex: pricingPage, pageSize: pricingPageSize })
          : updater;
      updateURLParams({
        pricingPage: String(newPagination.pageIndex),
        pricingPageSize: String(newPagination.pageSize),
      });
    },
    [pricingPage, pricingPageSize, updateURLParams],
  );

  const table = useReactTable({
    data: rows,
    columns,
    state: {
      sorting,
      columnVisibility,
      columnFilters,
      pagination: {
        pageIndex: pricingPage,
        pageSize: pricingPageSize,
      },
    },
    onSortingChange: handleSortingChange,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnFiltersChange: handleColumnFiltersChange,
    onPaginationChange: handlePaginationChange,
    getCoreRowModel: getCoreRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    manualPagination: true, // Server-driven pagination
    manualSorting: true, // Server-driven sorting
    manualFiltering: true, // Server-driven filtering
    pageCount: totalPages,
    initialState: {
      columnVisibility: {
        actorIdFilter: false,
        modelIdFilter: false,
        profileIdFilter: false,
      },
    },
  });

  // Memoize table rows to avoid calling getRowModel() multiple times and prevent re-render issues
  // Extract pagination primitives directly to avoid object reference issues
  const pageIndex = table.getState().pagination.pageIndex;
  const pageSize = table.getState().pagination.pageSize;
  // Stringify arrays for stable comparison (arrays are compared by reference)
  const sortingKey = JSON.stringify(sorting);
  const columnFiltersKey = JSON.stringify(columnFilters);
  const tableRows = React.useMemo(() => {
    return table.getRowModel().rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    // Use JSON.stringify for arrays to ensure stable comparison (arrays are compared by reference)
    sortingKey,
    columnFiltersKey,
    rows.length,
    // Use pagination primitives directly (not object references)
    pageIndex,
    pageSize,
  ]);

  const actorIdFilterColumn = table.getColumn("actorIdFilter");
  const modelIdFilterColumn = table.getColumn("modelIdFilter");
  const profileIdFilterColumn = table.getColumn("profileIdFilter");
  const isFiltered =
    searchTerm !== "" ||
    (pricingModelIds && pricingModelIds.length > 0) ||
    (pricingProfileIds && pricingProfileIds.length > 0) ||
    (pricingActorIds && pricingActorIds.length > 0);

  return (
    <div className="space-y-3">
      {/* Filters + Search */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        <div className="flex flex-col md:flex-row md:flex-1 md:items-center md:space-x-2 gap-2 md:gap-0">
          {/* Search bar */}
          <div className="w-full md:w-auto">
            <Input
              ref={searchInputRef}
              placeholder="Search by model, persona, agent, name, debug info..."
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
                // Commit on blur so URL stays in sync
                if (
                  event.currentTarget.value !==
                  (searchParams.get("pricingSearch") || "")
                ) {
                  commitSearch(event.currentTarget.value);
                }
              }}
              className="h-8 w-full md:w-[200px]"
            />
          </div>

          {/* Filters */}
          {isLoading ? (
            <>
              {/* Skeleton filters - show typical filter layout */}
              <Skeleton className="h-8 w-[120px]" />
              <Skeleton className="h-8 w-[140px]" />
              <Skeleton className="h-8 w-[160px]" />
            </>
          ) : (
            <>
              {/* Model filter */}
              {modelIdFilterColumn && modelOptions.length > 0 && (
                <DataTableFacetedFilter
                  column={modelIdFilterColumn}
                  title="Model"
                  options={modelOptions}
                  isServerDriven={true}
                />
              )}

              {/* Agent/Persona filter - merged */}
              {actorIdFilterColumn && actorOptions.length > 0 && (
                <DataTableFacetedFilter
                  column={actorIdFilterColumn}
                  title="Agent/Persona"
                  options={actorOptions}
                  isServerDriven={true}
                />
              )}

              {/* Name filter */}
              {profileIdFilterColumn && profileOptions.length > 0 && (
                <DataTableFacetedFilter
                  column={profileIdFilterColumn}
                  title="Name"
                  options={profileOptions}
                  isServerDriven={true}
                />
              )}
            </>
          )}

          {isFiltered && !isLoading && (
            <Button
              variant="ghost"
              onClick={() => {
                updateURLParams({
                  pricingSearch: null,
                  pricingModelIds: null,
                  pricingProfileIds: null,
                  pricingActorIds: null,
                  pricingPage: "0",
                });
              }}
              className="h-8 px-2 lg:px-3 hidden md:flex"
            >
              Reset
              <X className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
        <div className="flex items-center space-x-2">
          <DataTableViewOptions
            table={table}
            hiddenColumns={["actorIdFilter"]}
          />
        </div>
      </div>

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
                        : header.column.columnDef.header?.(header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {isLoading ? (
              // Skeleton rows
              Array.from({ length: pricingPageSize }).map((_, idx) => (
                <tr key={`skeleton-${idx}`} className="border-b">
                  {table.getVisibleLeafColumns().map((column) => (
                    <td key={column.id} className="px-4 py-3">
                      <Skeleton className="h-4 w-full" />
                    </td>
                  ))}
                </tr>
              ))
            ) : tableRows.length ? (
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
                  colSpan={table.getVisibleLeafColumns().length || 1}
                  className="h-24 text-center text-muted-foreground"
                >
                  No runs match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {isLoading ? (
        <div className="flex items-center justify-between px-2">
          <div className="flex-1 text-sm text-muted-foreground">
            <Skeleton className="h-4 w-[200px]" />
          </div>
          <div className="flex items-center space-x-2">
            <Skeleton className="h-8 w-[100px]" />
            <Skeleton className="h-8 w-[100px]" />
          </div>
        </div>
      ) : (
        <DataTablePagination table={table} />
      )}
    </div>
  );
}
