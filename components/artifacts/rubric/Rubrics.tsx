/**
 * Rubrics.tsx
 * Used to display the rubrics page with server-side filtering.
 * Hybrid approach: department/simulation filters are server-driven,
 * passPercentage remains client-side.
 * @AshokSaravanan222 & @siladiea
 * 06/18/2025
 */
"use client";
import { AlertCircle, Check, Copy, Edit, Eye, FileCheck, FileSpreadsheet, Loader2, Pencil, Star, Trash2, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { parseAsArrayOf, parseAsBoolean, parseAsString, useQueryState } from "nuqs";
import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";

import type {
  DeleteRubricIn,
  DeleteRubricOut,
  DuplicateRubricIn,
  DuplicateRubricOut,
  RubricsListOut,
  RubricsListBody,
  UpdateRubricIn,
  UpdateRubricOut,
  CreateRubricIn,
  CreateRubricOut,
} from "@/app/(main)/system/rubrics/page";
import BulkImport, { type ImportFieldDef, type ParseCsvResult } from "@/components/common/BulkImport";
import TableRubric from "@/components/artifacts/rubric/TableRubric";
import { ThreePickerFilters } from "@/components/common/table/ThreePickerFilters";
import { DataTablePagination } from "@/components/common/table/DataTablePagination";
import { DataTableViewOptions } from "@/components/common/table/DataTableViewOptions";
import { useColumnVisibility } from "@/hooks/use-column-visibility";
import { useArtifactGhosts, type Ghost } from "@/hooks/use-artifact-ghosts";
import { BulkDeleteDialog } from "@/components/common/forms/BulkDeleteDialog";
import { BulkEditDialog } from "@/components/common/forms/BulkEditDialog";
import { BulkEditFlagField } from "@/components/common/forms/BulkEditFlagField";
import { Badge } from "@/components/ui/badge";
import { useProfile } from "@/contexts/profile-context";
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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useRubricAi } from "@/hooks/use-rubric-ai";

export interface RubricsProps {
  // Server-provided data (for server-side rendering)
  listData: RubricsListOut;
  // SSR column visibility from cookie
  initialColumnVisibility?: VisibilityState;
  // Server actions (replaces useMutation)
  duplicateRubricAction?: (
    input: DuplicateRubricIn,
  ) => Promise<DuplicateRubricOut>;
  deleteRubricAction?: (input: DeleteRubricIn) => Promise<DeleteRubricOut>;
  updateRubricAction?: (input: UpdateRubricIn) => Promise<UpdateRubricOut>;
  createRubricAction?: (input: CreateRubricIn) => Promise<CreateRubricOut>;
  parseCsvAction?: (formData: FormData) => Promise<ParseCsvResult>;
  importFields?: ImportFieldDef[];
  /** The body the page used for its SSR ``/rubric/search`` call.
   *  Forwarded as the filter on bulk delete/update calls when the
   *  user is in ``selectAll=1`` mode — the server resolves matching
   *  rows directly, no client-side enumeration. */
  currentSearchBody?: RubricsListBody;
  // Server-side pagination
  pageIndex: number;
  pageSize: number;
  totalCount: number;
  // Server-side filter search terms
  departmentSearch: string;
  simulationSearch: string;
}

const RUBRICS_INITIAL_COLUMN_VISIBILITY: VisibilityState = {
  // Hidden faceting columns
  eval_ids: false,
  simulations: false,
  departments: false,
  passPercentage: false,
  // Toggleable card sections
  points_summary: true,
  pass_summary: true,
  card_description: true,
  rubric_table: true,
};

export default function Rubrics({
  listData: serverListData,
  initialColumnVisibility,
  duplicateRubricAction,
  deleteRubricAction,
  updateRubricAction,
  createRubricAction,
  parseCsvAction,
  importFields,
  currentSearchBody,
  pageIndex,
  pageSize,
  totalCount,
  departmentSearch,
  simulationSearch,
}: RubricsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { profile } = useProfile();

  useRubricAi({
    onComplete: () => router.refresh(),
  });

  // Use server-provided data directly
  const rubricsData = serverListData;

  // SSR-seeded base list. The audit-driven ghost hook layers
  // create/update/delete/duplicate lifecycle on top — committed rows
  // get merged into ``mergedRubrics`` directly so the table stays
  // current without a ``router.refresh()`` (which would re-burst the
  // page's SSR fetches — see GenerationPanel handleSend rationale).
  const baseRubrics = useMemo(() => {
    return rubricsData?.rubrics || [];
  }, [rubricsData?.rubrics]);

  const {
    ghosts: rubricGhosts,
    mergedRows: mergedRubrics,
    ack: ackRubricGhost,
    drop: _dropRubricGhost,
  } = useArtifactGhosts({
    artifactType: "rubric",
    // All four CRUD ops the LLM might invoke or the user might trigger
    // from the toolbar/card. Each maps to a distinct ghost visual in
    // ``renderRubricCard`` (creating / updating / deleting /
    // duplicating skeleton + pending soft state).
    ops: ["create", "update", "delete", "duplicate"],
    baseRows: baseRubrics,
    rowKey: "rubric_id",
    // ``rubrics`` plural is auto-derived but kept explicit; matches
    // the response field on create/update/duplicate populated by
    // ``hydrate_rubric_list_rows``. The hook reads ``output.rubrics``
    // from the audit ``.completed`` payload to materialize new/changed
    // rows directly — no SSR refresh needed.
    artifactPlural: "rubrics",
  });

  const [showBulkImportDialog, setShowBulkImportDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteItem, setDeleteItem] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState<string | null>(null);

  // Local search state for debouncing
  const [searchTerm, setSearchTerm] = useState(
    searchParams?.get("search") ?? ""
  );
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Table state
  const [rowSelection, setRowSelection] = useState({});
  const [columnVisibility, setColumnVisibility] = useColumnVisibility(
    "rubrics",
    initialColumnVisibility ?? RUBRICS_INITIAL_COLUMN_VISIBILITY,
  );
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>(() => {
    const filters: ColumnFiltersState = [];
    const deptIds = searchParams?.getAll("departmentIds") ?? [];
    const simIds = searchParams?.getAll("simulationIds") ?? [];
    const evalIds = searchParams?.getAll("evalIds") ?? [];
    if (deptIds.length > 0) filters.push({ id: "departments", value: deptIds });
    if (simIds.length > 0) filters.push({ id: "simulations", value: simIds });
    if (evalIds.length > 0) filters.push({ id: "eval_ids", value: evalIds });
    return filters;
  });
  const [sorting, setSorting] = useState<SortingState>([
    { id: "name", desc: false },
  ]);

  // Downstream code reads ``rubrics`` — keep that name to minimize
  // diff. The active list is the merged view (base + create overlays
  // − delete overlays).
  const rubrics = mergedRubrics;
  const standardGroups = useMemo(
    () => rubricsData?.standard_groups || [],
    [rubricsData],
  );
  const standards = useMemo(
    () => rubricsData?.standards || [],
    [rubricsData],
  );

  // Flag catalog (e.g. rubric_active) — used to reconstruct flag_ids on bulk edit.
  const flagOptions = useMemo(() => {
    return (rubricsData?.flag_filter?.options || [])
      .filter((opt): opt is typeof opt & { id: string; name: string } => !!opt.id && !!opt.name)
      .map((opt) => ({ id: opt.id!, name: opt.name!, type: opt.type ?? null }));
  }, [rubricsData?.flag_filter]);

  // Selection state — URL-backed so it survives refresh and is
  // craftable as a shareable / LLM-generated link. Three params
  // model the full state machine:
  //
  //   - ``selectedIds=A,B``        → explicit selection of named rows
  //   - ``selectAll=1``            → every row matching the active
  //                                  filters/search is selected
  //   - ``selectAll=1&excludedIds=X``
  //                                → all-matching minus exclusions
  //
  // The all-matching mode keeps the URL compact for huge datasets
  // (one boolean instead of N ids) and follows the active filter.
  // Shallow updates avoid the RSC re-fetch burst.
  const [selectedRubricIds, setSelectedRubricIds] = useQueryState(
    "selectedIds",
    parseAsArrayOf(parseAsString).withDefault([]).withOptions({ shallow: true }),
  );
  const [selectAllMatching, setSelectAllMatching] = useQueryState(
    "selectAll",
    parseAsBoolean.withDefault(false).withOptions({ shallow: true }),
  );
  const [excludedRubricIds, setExcludedRubricIds] = useQueryState(
    "excludedIds",
    parseAsArrayOf(parseAsString).withDefault([]).withOptions({ shallow: true }),
  );

  const totalMatchingCount = rubricsData?.total_count ?? 0;

  // ``isSelected`` is the single read predicate every row uses; it
  // dispatches between explicit-id and all-matching modes so
  // downstream code never needs to branch. ``selectedCount`` mirrors
  // that — under all-matching it's ``totalCount - excludedIds.length``.
  const isSelected = useCallback(
    (id: string | null | undefined) => {
      if (!id) return false;
      return selectAllMatching
        ? !excludedRubricIds.includes(id)
        : selectedRubricIds.includes(id);
    },
    [selectAllMatching, excludedRubricIds, selectedRubricIds],
  );

  const selectedCount = selectAllMatching
    ? Math.max(0, totalMatchingCount - excludedRubricIds.length)
    : selectedRubricIds.length;

  const selectedRubrics = useMemo(() => {
    return rubrics.filter((r) => r.rubric_id && isSelected(r.rubric_id));
  }, [rubrics, isSelected]);
  const deletableRubrics = useMemo(
    () => selectedRubrics.filter((r) => r.can_delete),
    [selectedRubrics],
  );
  const nonDeletableRubrics = useMemo(
    () => selectedRubrics.filter((r) => !r.can_delete),
    [selectedRubrics],
  );
  const editableRubrics = useMemo(
    () => selectedRubrics.filter((r) => r.can_edit ?? true),
    [selectedRubrics],
  );

  // Toggle selection for a single rubric. Under all-matching mode
  // we toggle membership in excludedRubricIds (deselect ⇒ add to
  // exclusions, re-select ⇒ remove). Under explicit mode it's the
  // straight selectedRubricIds toggle.
  const toggleSelection = useCallback((rubricId: string) => {
    if (selectAllMatching) {
      void setExcludedRubricIds((prev) =>
        prev.includes(rubricId)
          ? prev.filter((id) => id !== rubricId)
          : [...prev, rubricId],
      );
    } else {
      void setSelectedRubricIds((prev) =>
        prev.includes(rubricId)
          ? prev.filter((id) => id !== rubricId)
          : [...prev, rubricId],
      );
    }
  }, [selectAllMatching, setExcludedRubricIds, setSelectedRubricIds]);

  const clearBulkSelection = useCallback(() => {
    void setSelectedRubricIds([]);
    void setSelectAllMatching(false);
    void setExcludedRubricIds([]);
  }, [setSelectedRubricIds, setSelectAllMatching, setExcludedRubricIds]);

  const selectAllOnPage = useCallback(() => {
    const pageIds = rubrics.filter((r) => r.rubric_id).map((r) => r.rubric_id!);
    void setSelectAllMatching(false);
    void setExcludedRubricIds([]);
    void setSelectedRubricIds((prev) => Array.from(new Set([...prev, ...pageIds])));
  }, [rubrics, setSelectAllMatching, setExcludedRubricIds, setSelectedRubricIds]);

  const allPageSelected = useMemo(() => {
    const pageIds = rubrics.filter((r) => r.rubric_id).map((r) => r.rubric_id!);
    if (pageIds.length === 0) return false;
    return pageIds.every((id) => isSelected(id));
  }, [rubrics, isSelected]);

  // Whether there ARE more matching rows than what's loaded on this
  // page — used to decide whether to surface the "Select all N
  // matching" affordance after the user selects the page.
  const hasMoreThanCurrentPage = totalMatchingCount > rubrics.length;

  /** Promote the current page-only selection into "all matching
   *  filter" mode. Clears explicit ids and exclusions — the all-
   *  matching mode is the canonical truth from this point. */
  const selectAllMatchingNow = useCallback(() => {
    void setSelectedRubricIds([]);
    void setExcludedRubricIds([]);
    void setSelectAllMatching(true);
  }, [setSelectedRubricIds, setExcludedRubricIds, setSelectAllMatching]);

  // Bulk delete state
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // Bulk edit state
  const [showBulkEditDialog, setShowBulkEditDialog] = useState(false);
  const [isBulkEditing, setIsBulkEditing] = useState(false);
  const [bulkEditActiveStatus, setBulkEditActiveStatus] = useState<boolean | null>(null);

  // Filter options from server-provided ListFilterSection
  const departmentOptions = useMemo(
    () =>
      (rubricsData?.department_filter?.options || [])
        .map((opt) => ({
          value: opt.id as string,
          label: opt.name as string,
          count: opt.count ?? undefined,
        }))
        .filter((opt) => opt.value && opt.label),
    [rubricsData?.department_filter]
  );

  const simulationOptions = useMemo(
    () =>
      (rubricsData?.simulation_filter?.options || [])
        .map((opt) => ({
          value: opt.id as string,
          label: opt.name as string,
          count: opt.count ?? undefined,
        }))
        .filter((opt) => opt.value && opt.label),
    [rubricsData?.simulation_filter]
  );

  const evalOptions = useMemo(
    () =>
      (rubricsData?.eval_filter?.options || [])
        .map((opt) => ({
          value: opt.id as string,
          label: opt.name as string,
          count: opt.count ?? undefined,
        }))
        .filter((opt) => opt.value && opt.label),
    [rubricsData?.eval_filter]
  );

  // Helper to update URL search params
  const updateRubricsParams = useCallback(
    (updates: {
      page?: number;
      pageSize?: number;
      search?: string;
      departmentIds?: string[];
      simulationIds?: string[];
      evalIds?: string[];
      departmentSearch?: string;
      simulationSearch?: string;
    }) => {
      const params = new URLSearchParams(searchParams?.toString() || "");

      if (updates.page !== undefined) {
        if (updates.page === 0) params.delete("page");
        else params.set("page", updates.page.toString());
      }

      if (updates.pageSize !== undefined) {
        if (updates.pageSize === 12) params.delete("pageSize");
        else params.set("pageSize", updates.pageSize.toString());
      }

      if (updates.search !== undefined) {
        if (updates.search === "") params.delete("search");
        else params.set("search", updates.search);
      }

      if (updates.departmentIds !== undefined) {
        params.delete("departmentIds");
        updates.departmentIds.forEach((id) => params.append("departmentIds", id));
      }

      if (updates.simulationIds !== undefined) {
        params.delete("simulationIds");
        updates.simulationIds.forEach((id) => params.append("simulationIds", id));
      }

      if (updates.evalIds !== undefined) {
        params.delete("evalIds");
        updates.evalIds.forEach((id) => params.append("evalIds", id));
      }

      if (updates.departmentSearch !== undefined) {
        if (updates.departmentSearch === "") params.delete("departmentSearch");
        else params.set("departmentSearch", updates.departmentSearch);
      }

      if (updates.simulationSearch !== undefined) {
        if (updates.simulationSearch === "") params.delete("simulationSearch");
        else params.set("simulationSearch", updates.simulationSearch);
      }

      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  // Commit search to URL
  const commitSearch = useCallback(
    (value: string) => {
      updateRubricsParams({ page: 0, search: value.trim() || "" });
    },
    [updateRubricsParams]
  );

  // Handle search input change with debounce
  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchTerm(value);
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      if (value === "") { commitSearch(""); return; }
      searchTimeoutRef.current = setTimeout(() => { commitSearch(value); }, 500);
    },
    [commitSearch]
  );

  const handleSearchBlur = useCallback(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    commitSearch(searchTerm);
  }, [commitSearch, searchTerm]);

  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
        commitSearch(searchTerm);
      }
    },
    [commitSearch, searchTerm]
  );

  // Handle filter option search changes (debounced)
  const departmentSearchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const simulationSearchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [localDepartmentSearch, setLocalDepartmentSearch] = useState(departmentSearch);
  const [localSimulationSearch, setLocalSimulationSearch] = useState(simulationSearch);

  const handleDepartmentSearchChange = useCallback(
    (value: string) => {
      setLocalDepartmentSearch(value);
      if (departmentSearchTimeoutRef.current) clearTimeout(departmentSearchTimeoutRef.current);
      departmentSearchTimeoutRef.current = setTimeout(() => {
        updateRubricsParams({ departmentSearch: value });
      }, 300);
    },
    [updateRubricsParams]
  );

  const handleSimulationSearchChange = useCallback(
    (value: string) => {
      setLocalSimulationSearch(value);
      if (simulationSearchTimeoutRef.current) clearTimeout(simulationSearchTimeoutRef.current);
      simulationSearchTimeoutRef.current = setTimeout(() => {
        updateRubricsParams({ simulationSearch: value });
      }, 300);
    },
    [updateRubricsParams]
  );

  // Sync column filters to URL when they change (only server-driven ones)
  const handleColumnFiltersChange = useCallback(
    (updater: ColumnFiltersState | ((prev: ColumnFiltersState) => ColumnFiltersState)) => {
      const newFilters = typeof updater === "function" ? updater(columnFilters) : updater;
      setColumnFilters(newFilters);

      const departmentFilter = newFilters.find((f) => f.id === "departments");
      const simulationFilter = newFilters.find((f) => f.id === "simulations");
      const evalFilter = newFilters.find((f) => f.id === "eval_ids");

      // Check if any server-driven filter actually changed
      const oldDepartmentFilter = columnFilters.find((f) => f.id === "departments");
      const oldSimulationFilter = columnFilters.find((f) => f.id === "simulations");
      const oldEvalFilter = columnFilters.find((f) => f.id === "eval_ids");

      const serverChanged =
        JSON.stringify(departmentFilter?.value) !== JSON.stringify(oldDepartmentFilter?.value) ||
        JSON.stringify(simulationFilter?.value) !== JSON.stringify(oldSimulationFilter?.value);
      const evalChanged =
        JSON.stringify(evalFilter?.value) !== JSON.stringify(oldEvalFilter?.value);

      if (serverChanged || evalChanged) {
        // We push evalIds into the URL too so deep-links survive a refresh,
        // even though the eval slot is client-faceted (no `eval_search` in
        // SearchRubricApiRequest, so server cannot filter on it).
        updateRubricsParams({
          page: 0,
          departmentIds: (departmentFilter?.value as string[]) || [],
          simulationIds: (simulationFilter?.value as string[]) || [],
          evalIds: (evalFilter?.value as string[]) || [],
        });
      }
    },
    [columnFilters, updateRubricsParams]
  );

  // Handle pagination change
  const handlePaginationChange = useCallback(
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
          ? updater({ pageIndex, pageSize })
          : updater;
      updateRubricsParams({
        page: newPagination.pageIndex,
        pageSize: newPagination.pageSize,
      });
    },
    [pageIndex, pageSize, updateRubricsParams]
  );

  // Compute page count from total
  const pageCount = Math.ceil(totalCount / pageSize);

  // Column definitions for TanStack Table
  const columns = useMemo<ColumnDef<(typeof rubrics)[number]>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => row.getValue("name"),
      },
      // Hidden faceting column for Pass Percentage (client-only)
      {
        id: "passPercentage",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: (typeof rubrics)[number]) => {
          const percentage = row.pass_percentage ?? 0;
          if (percentage >= 0 && percentage <= 25) return "0-25";
          if (percentage >= 26 && percentage <= 50) return "26-50";
          if (percentage >= 51 && percentage <= 75) return "51-75";
          if (percentage >= 76 && percentage <= 100) return "76-100";
          return null;
        },
        filterFn: (row, _id, value: string[]) => {
          const percentage = row.original.pass_percentage ?? 0;
          return value.some((range) => {
            const [min, max] = range.split("-").map(Number);
            return (
              min !== undefined &&
              max !== undefined &&
              percentage >= min &&
              percentage <= max
            );
          });
        },
      },
      // Hidden faceting column for Simulation (server-driven; client filterFn
      // is harmless second-pass since server-filtered rows already match).
      {
        id: "simulations",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        enableColumnFilter: true,
        accessorFn: (row: (typeof rubrics)[number]) => row.simulation_ids ?? [],
        filterFn: (row, id, filterValue: string[]) =>
          !filterValue?.length || filterValue.some((v) => ((row.getValue(id) as string[]) ?? []).includes(v)),
      },
      // Hidden faceting column for Departments (server-driven)
      {
        id: "departments",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        enableColumnFilter: true,
        accessorFn: (row: (typeof rubrics)[number]) => row.department_ids ?? [],
        filterFn: (row, id, filterValue: string[]) =>
          !filterValue?.length || filterValue.some((v) => ((row.getValue(id) as string[]) ?? []).includes(v)),
      },
      // Hidden faceting column for Evals (client-faceted; SearchRubricApiRequest
      // has no eval_search/filter_eval_ids, so we filter purely on the client).
      {
        id: "eval_ids",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        enableColumnFilter: true,
        accessorFn: (row: (typeof rubrics)[number]) => row.eval_ids ?? [],
        filterFn: (row, id, filterValue: string[]) =>
          !filterValue?.length || filterValue.some((v) => ((row.getValue(id) as string[]) ?? []).includes(v)),
      },
      // Virtual columns for card view toggles
      {
        id: "points_summary",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: (typeof rubrics)[number]) => row.points ?? 0,
      },
      {
        id: "pass_summary",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: (typeof rubrics)[number]) => row.pass_points ?? 0,
      },
      {
        id: "card_description",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: (typeof rubrics)[number]) => row.description ?? "",
      },
      {
        id: "rubric_table",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: (typeof rubrics)[number]) => row.standard_group_ids ?? [],
      },
    ],
    [],
  );

  // Create table instance - hybrid: manual for server filters, client filtering for passPercentage
  const table = useReactTable({
    data: rubrics,
    columns,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
      columnFilters,
      pagination: {
        pageIndex,
        pageSize,
      },
    },
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: handleColumnFiltersChange,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: handlePaginationChange,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualPagination: true,
    manualFiltering: false, // Client-side filtering for passPercentage on server-provided page
    pageCount,
  });

  // Memoize table rows. Including ``rubrics`` itself (not just
  // ``rubrics.length``) so update events that mutate row content but
  // not list cardinality still invalidate the memo. ``rubrics`` is
  // stabilized upstream by ``mergedRubrics``'s useMemo, so a new
  // reference only appears when ``state.added``/``replaced``/
  // ``hiddenIds`` actually change — no spurious recomputes.
  const sortingKey = JSON.stringify(sorting);
  const columnFiltersKey = JSON.stringify(columnFilters);
  const tableRows = useMemo(() => {
    return table.getRowModel().rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortingKey, columnFiltersKey, rubrics, pageIndex, pageSize]);

  const handleDelete = async () => {
    if (!deleteItem || !deleteRubricAction) return;

    if (!profile?.id) {
      toast.error("Profile not loaded. Please refresh the page.");
      return;
    }

    setIsDeleting(true);
    try {
      await deleteRubricAction({
        body: { rubric_ids: [deleteItem.id], all: false, accept: true },
      });
      toast.success("Rubric deleted successfully");
      router.refresh();
    } catch {
      toast.error("Failed to delete rubric");
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
      setDeleteItem(null);
    }
  };

  const handleDuplicate = async (rubric: (typeof rubrics)[number]) => {
    if (!rubric.can_duplicate || !duplicateRubricAction) {
      toast.error("This rubric cannot be duplicated");
      return;
    }

    if (!profile?.id) {
      toast.error("Profile not loaded. Please refresh the page.");
      return;
    }

    setIsDuplicating(rubric.rubric_id ?? null);
    try {
      await duplicateRubricAction({
        body: { rubric_id: rubric.rubric_id ?? "", accept: true },
      });
      toast.success(`Rubric "${rubric.name}" duplicated successfully`);
      router.refresh();
    } catch {
      toast.error("Failed to duplicate rubric");
    } finally {
      setIsDuplicating(null);
    }
  };

  const handleDeleteClick = (id: string, name: string) => {
    setDeleteItem({ id, name });
    setShowDeleteDialog(true);
  };

  const handleBulkDelete = async () => {
    // Either explicit-mode (deletable rows on current page) OR
    // all-matching mode (server resolves rows via filter). Both
    // converge on the same ``deleteRubricAction`` call shape; the
    // body just differs.
    if (!deleteRubricAction) return;
    if (!selectAllMatching && deletableRubrics.length === 0) return;

    if (!profile?.id) {
      toast.error("Profile not loaded. Please refresh the page.");
      return;
    }

    setIsBulkDeleting(true);
    try {
      const body = selectAllMatching
        ? {
            // Server resolves matching ids from the same filter the
            // page used (currentSearchBody is the SSR body), subtracts
            // ``excluded_ids``, then runs the existing per-row delete.
            // Per-row permission failures soft-skip — surfaced in
            // response.results[].
            all: true as const,
            excluded_ids: excludedRubricIds,
            ...(currentSearchBody ?? {}),
            accept: true,
          }
        : {
            rubric_ids: deletableRubrics.map((r) => r.rubric_id!),
            accept: true,
          };

      const result = await deleteRubricAction({ body } as DeleteRubricIn);

      // Per-row results from the server: success entries are actual
      // deletions, failures are soft-skipped rows (no permission /
      // not found). Toast reflects both counts so the user knows
      // some rows were skipped without inspecting the receipt.
      const results = (result as DeleteRubricOut).results ?? [];
      const successCount = results.filter((r) => r.success).length;
      const skippedCount = results.length - successCount;
      if (skippedCount > 0) {
        toast.success(
          `${successCount} rubric(s) deleted, ${skippedCount} skipped`,
        );
      } else {
        toast.success(`${successCount} rubric(s) deleted successfully`);
      }
      clearBulkSelection();
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to delete rubrics";
      toast.error(msg.replace(/^\d{3}\s*/, "") || "Failed to delete rubrics");
    } finally {
      setIsBulkDeleting(false);
      setShowBulkDeleteDialog(false);
    }
  };

  const handleBulkEdit = async () => {
    if (!updateRubricAction) return;
    if (!selectAllMatching && editableRubrics.length === 0) return;

    if (!profile?.id) {
      toast.error("Profile not loaded. Please refresh the page.");
      return;
    }

    const hasActiveChange = bulkEditActiveStatus !== null;
    const hasAnyFlagChange = hasActiveChange;
    if (!hasActiveChange) {
      toast.error("No changes selected");
      return;
    }

    const activeFlagId = flagOptions.find((f) => f.type === "rubric_active")?.id;

    setIsBulkEditing(true);
    try {
      let body: UpdateRubricIn["body"];
      if (selectAllMatching) {
        // All-matching: the server can't preserve per-row flag state
        // (it doesn't know what each row's existing flags are), so
        // the active toggle becomes "set to this value across all
        // matching rows" — same semantic as a manual sweep.
        let flag_ids: string[] | undefined;
        if (hasAnyFlagChange) {
          flag_ids = [];
          if (bulkEditActiveStatus && activeFlagId) flag_ids.push(activeFlagId);
        }
        body = {
          all: true,
          excluded_ids: excludedRubricIds,
          ...(currentSearchBody ?? {}),
          patch: {
            ...(hasAnyFlagChange && { flag_ids }),
          },
          accept: true,
        } as UpdateRubricIn["body"];
      } else {
        // Explicit: clone the patch per-row, preserving each row's
        // existing flag state for flags we aren't toggling.
        const items = editableRubrics.map((r) => {
          let flag_ids: string[] | undefined;
          if (hasAnyFlagChange) {
            const isActive = hasActiveChange ? bulkEditActiveStatus : !r.is_inactive;
            flag_ids = isActive && activeFlagId ? [activeFlagId] : [];
          }
          return {
            id: r.rubric_id!,
            ...(hasAnyFlagChange && { flag_ids }),
          };
        });
        body = { rubrics: items } as UpdateRubricIn["body"];
      }

      const result = await updateRubricAction({ body } as UpdateRubricIn);

      // Per-row results — same soft-skip pattern as bulk delete.
      const results = (result as UpdateRubricOut).results ?? [];
      const successCount = results.filter((r) => r.success).length;
      const skippedCount = results.length - successCount;
      if (skippedCount > 0) {
        toast.success(
          `${successCount} rubric(s) updated, ${skippedCount} skipped`,
        );
      } else {
        toast.success(`${successCount} rubric(s) updated successfully`);
      }
      clearBulkSelection();
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to update rubrics";
      toast.error(msg.replace(/^\d{3}\s*/, "") || "Failed to update rubrics");
    } finally {
      setIsBulkEditing(false);
      setShowBulkEditDialog(false);
    }
  };

  const openBulkEditDialog = () => {
    setBulkEditActiveStatus(null);
    setShowBulkEditDialog(true);
  };

  const renderRubricCard = (
    rubric: (typeof rubrics)[number],
    ghost?: Ghost<(typeof rubrics)[number]>,
  ) => {
    // Same card visual for real rows and in-flight ghosts — single
    // source of truth for layout, dimensions, badges. Ghost mode swaps
    // action buttons for a status badge (and Accept/Reject for
    // soft-pending), disables selection/click, and tints the border
    // based on lifecycle state.
    const isGhost = ghost != null;
    const ghostState = ghost?.state;
    const inFlight =
      ghostState === "creating" ||
      ghostState === "duplicating" ||
      ghostState === "updating" ||
      ghostState === "deleting";
    const isPending = ghostState === "pending";
    const isFailed = ghostState === "failed";

    const groupIds = rubric.standard_group_ids || [];
    let totalPoints = 0;
    let totalPassPoints = 0;

    groupIds.forEach((groupId) => {
      const group = standardGroups.find((g) => g.standard_group_id === groupId);
      if (group) {
        totalPoints += group.points || 0;
        totalPassPoints += group.pass_points || 0;
      }
    });

    const passPercentage =
      totalPoints > 0
        ? Math.round((totalPassPoints / totalPoints) * 100)
        : (rubric.pass_percentage ?? 0);

    const cardIsSelected = !isGhost && isSelected(rubric.rubric_id);
    const handleCardClick = (e: React.MouseEvent) => {
      // Don't toggle selection if clicking action buttons or when
      // rendering as a ghost (no real id to select).
      if (isGhost) return;
      if ((e.target as HTMLElement).closest("[data-action-button]")) return;
      if (rubric.rubric_id) {
        toggleSelection(rubric.rubric_id);
      }
    };

    // Border tint reflects ghost lifecycle. ``animate-pulse`` while
    // in-flight signals "this is provisional"; failed/pending hold a
    // steady color so the user can decide.
    const ghostBorderClass = isFailed
      ? "border-destructive/40 bg-destructive/5"
      : isPending
      ? "border-amber-500/50 bg-amber-50/40 dark:bg-amber-950/20"
      : ghostState === "deleting"
      ? "border-destructive/30 bg-destructive/5 opacity-70"
      : inFlight
      ? "border-primary/40 bg-primary/5 animate-pulse"
      : "";

    return (
      <Card
        key={rubric.rubric_id}
        className={`group w-full hover:shadow-md transition-all ${
          isGhost ? "" : "cursor-pointer"
        } ${ghostBorderClass} ${cardIsSelected ? "ring-2 ring-primary" : ""}`}
        data-testid={isGhost ? "rubric-ghost-card" : "rubric-card"}
        data-rubric-id={rubric.rubric_id}
        data-ghost-state={ghostState}
        role="gridcell"
        aria-label={`rubric card ${rubric.name || (isGhost ? "Generating" : "Unnamed Rubric")}`}
        aria-selected={cardIsSelected}
        aria-busy={inFlight ? true : undefined}
        onClick={handleCardClick}
      >
        {/* Header */}
        <CardHeader className="border-b">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="space-y-2 flex-1">
              <div className="flex items-center gap-2">
                {/* Selection checkbox — hidden in ghost mode (no real
                    row id to select yet). */}
                {!isGhost && (
                  <div
                    className={`transition-all overflow-hidden flex-shrink-0 ${
                      selectedCount > 0
                        ? "w-5 opacity-100"
                        : "w-0 opacity-0 group-hover:w-5 group-hover:opacity-100"
                    }`}
                    data-action-button
                  >
                    <Checkbox
                      checked={cardIsSelected}
                      onCheckedChange={() => {
                        if (rubric.rubric_id) toggleSelection(rubric.rubric_id);
                      }}
                      className="rounded-full h-5 w-5"
                      aria-label={`Select rubric ${rubric.name || "Unnamed"}`}
                    />
                  </div>
                )}
                {/* In-flight ghost without a streamed name yet → spinner. */}
                {inFlight && !rubric.name && (
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                )}
                <CardTitle className="text-2xl font-bold">
                  {rubric.name || (isGhost ? "Generating…" : "Unnamed Rubric")}
                </CardTitle>
                {isGhost && (
                  <Badge
                    variant={isFailed ? "destructive" : isPending ? "outline" : "secondary"}
                    className={isPending ? "border-amber-500 text-amber-700 dark:text-amber-400" : ""}
                  >
                    {ghostState === "creating" && "Creating…"}
                    {ghostState === "duplicating" && "Duplicating…"}
                    {ghostState === "updating" && "Updating…"}
                    {ghostState === "deleting" && "Deleting…"}
                    {ghostState === "pending" && "Pending"}
                    {ghostState === "failed" && "Failed"}
                  </Badge>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                {columnVisibility["points_summary"] !== false && (
                  <div className="flex items-center gap-2">
                    <Star className="h-4 w-4" />
                    {rubric.points} total points
                  </div>
                )}
                {columnVisibility["pass_summary"] !== false && (
                  <div className="flex items-center gap-2">
                    <FileCheck className="h-4 w-4" />
                    Pass: {rubric.pass_points ?? 0} pts ({passPercentage}%)
                  </div>
                )}
              </div>
              {columnVisibility["card_description"] !== false && rubric.description && (
                <p className="text-sm text-muted-foreground max-w-2xl">
                  {rubric.description}
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2" data-action-button>
              {/* Ghost-mode action area: status-aware. Pending →
                  Accept/Reject for soft-write ack. Failed → error
                  indicator. In-flight → no buttons (read-only until
                  commit/failure). */}
              {isGhost && isPending && ghost.callId && (
                <>
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    className="h-8"
                    onClick={() => ackRubricGhost(ghost.callId, true)}
                  >
                    <Check className="mr-1 h-3.5 w-3.5" />
                    Accept
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8"
                    onClick={() => ackRubricGhost(ghost.callId, false)}
                  >
                    <X className="mr-1 h-3.5 w-3.5" />
                    Reject
                  </Button>
                </>
              )}
              {isGhost && isFailed && ghost.error && (
                <span className="flex items-center gap-1 text-xs text-destructive">
                  <AlertCircle className="h-3.5 w-3.5" />
                  {ghost.error}
                </span>
              )}
              {!isGhost && rubric.rubric_id && (
                <>
                  {rubric.can_edit ? (
                    <Button
                      asChild
                      variant="outline"
                      data-testid="btn-edit-rubric"
                    >
                      <Link
                        href={`/system/rubrics/${rubric.rubric_id}`}
                        prefetch={false}
                        aria-label="Edit rubric"
                      >
                        <Edit className="h-4 w-4 md:mr-0 md:ml-0 mr-2" />
                        <span className="md:hidden">Edit</span>
                      </Link>
                    </Button>
                  ) : (
                    <Button
                      asChild
                      variant="outline"
                      data-testid="btn-view-rubric"
                    >
                      <Link
                        href={`/system/rubrics/${rubric.rubric_id}`}
                        prefetch={false}
                        aria-label={`View ${rubric.name}`}
                      >
                        <Eye className="h-4 w-4 md:mr-0 md:ml-0 mr-2" />
                        <span className="md:hidden">View</span>
                      </Link>
                    </Button>
                  )}
                  {rubric.can_duplicate && (
                    <Button
                      variant="outline"
                      onClick={() => handleDuplicate(rubric)}
                      disabled={isDuplicating === rubric.rubric_id}
                      data-testid="btn-duplicate-rubric"
                      aria-label="Duplicate rubric"
                    >
                      {isDuplicating === rubric.rubric_id ? (
                        <>
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent md:mr-0 md:ml-0 mr-2" />
                          <span className="md:hidden">Duplicating...</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4 md:mr-0 md:ml-0 mr-2" />
                          <span className="md:hidden">Duplicate</span>
                        </>
                      )}
                    </Button>
                  )}
                  {rubric.can_delete && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        if (rubric.rubric_id) {
                          handleDeleteClick(rubric.rubric_id, rubric.name ?? "");
                        }
                      }}
                      data-testid="btn-delete-rubric"
                      aria-label="Delete rubric"
                    >
                      <Trash2 className="h-4 w-4 md:mr-0 md:ml-0 mr-2" />
                      <span className="md:hidden">Delete</span>
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        </CardHeader>

        {/* Rubric Table */}
        {columnVisibility["rubric_table"] !== false && (
        <CardContent className="p-6">
          <TableRubric
            standardGroups={(() => {
              const groupsDict: Record<string, string[]> = {};
              const groupIds = rubric.standard_group_ids || [];
              groupIds.forEach((groupId) => {
                const standardsInGroup = standards
                  .filter((s) => s.standard_group_id === groupId)
                  .map((s) => String(s.standard_id));
                if (standardsInGroup.length > 0) {
                  groupsDict[String(groupId)] = standardsInGroup;
                }
              });
              return groupsDict;
            })()}
            standardGroupsMapping={(() => {
              const mapping: Record<string, { name: string; description: string; points: number; passPoints: number }> = {};
              standardGroups.forEach((group) => {
                if (group.standard_group_id) {
                  mapping[String(group.standard_group_id)] = {
                    name: group.name || "",
                    description: group.description || "",
                    points: group.points || 0,
                    passPoints: group.pass_points || 0,
                  };
                }
              });
              return mapping;
            })()}
            standardsMapping={(() => {
              const mapping: Record<string, { name: string; description: string; points: number }> = {};
              standards.forEach((standard) => {
                if (standard.standard_id) {
                  mapping[String(standard.standard_id)] = {
                    name: standard.name || "",
                    description: standard.description || "",
                    points: standard.points || 0,
                  };
                }
              });
              return mapping;
            })()}
            showFullStandardsOnMobile={true}
          />
        </CardContent>
        )}
      </Card>
    );
  };

  // Get column references for toolbar
  const departmentsColumn = table.getColumn("departments");
  const simulationsColumn = table.getColumn("simulations");
  const evalsColumn = table.getColumn("eval_ids");
  const isFiltered =
    table.getState().columnFilters.length > 0 ||
    searchTerm.length > 0;

  return (
    <div className="space-y-6">
      <div className="space-y-4" data-testid="rubrics-data-table">
        {/* Toolbar — swaps between filter bar and selection action bar */}
        {selectedCount > 0 ? (
          <div className="space-y-2" data-testid="rubrics-toolbar">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {deleteRubricAction && (
                <Button
                  variant="destructive"
                  size="sm"
                  className="h-8"
                  onClick={() => setShowBulkDeleteDialog(true)}
                  disabled={!selectAllMatching && deletableRubrics.length === 0}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {selectAllMatching
                    ? `Delete ${selectedCount} matching`
                    : `Delete ${deletableRubrics.length} of ${selectedCount}`}
                </Button>
              )}
              {updateRubricAction && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={openBulkEditDialog}
                  disabled={!selectAllMatching && editableRubrics.length === 0}
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  {selectAllMatching
                    ? `Edit ${selectedCount} matching`
                    : `Edit ${editableRubrics.length} of ${selectedCount}`}
                </Button>
              )}
              {!allPageSelected && !selectAllMatching && (
                <Button variant="ghost" size="sm" className="h-8" onClick={selectAllOnPage}>
                  Select Page
                </Button>
              )}
              <Button variant="ghost" size="sm" className="h-8" onClick={clearBulkSelection}>
                Unselect All
              </Button>
            </div>
            <DataTableViewOptions
              table={table}
              hiddenColumns={["name", "passPercentage", "simulations", "departments", "eval_ids"]}
            />
          </div>

          {/* Cross-page selection banners. Two states:
              (a) page-all selected, more matching elsewhere → offer
                  "Select all N matching" to flip into all-matching mode.
              (b) all-matching active → show count + Clear so the
                  user always has an obvious escape hatch.
              Mutually exclusive — both never render at once. */}
          {!selectAllMatching && allPageSelected && hasMoreThanCurrentPage && (
            <div
              className="flex items-center justify-between gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm"
              data-testid="select-all-matching-banner"
            >
              <span className="text-muted-foreground">
                All {rubrics.length} on this page selected.
              </span>
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0"
                onClick={selectAllMatchingNow}
              >
                Select all {totalMatchingCount} matching
              </Button>
            </div>
          )}
          {selectAllMatching && (
            <div
              className="flex items-center justify-between gap-2 rounded-md border bg-primary/5 px-3 py-2 text-sm"
              data-testid="all-matching-active-banner"
            >
              <span className="text-muted-foreground">
                All {selectedCount} matching rubrics selected
                {excludedRubricIds.length > 0 && ` (${excludedRubricIds.length} excluded)`}.
              </span>
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0"
                onClick={clearBulkSelection}
              >
                Clear
              </Button>
            </div>
          )}
          </div>
        ) : (
        <div
          className="flex flex-col md:flex-row md:items-center md:justify-between gap-2"
          data-testid="rubrics-toolbar"
        >
          <div className="flex flex-col md:flex-row md:flex-1 md:items-center md:space-x-2 gap-2 md:gap-0">
            <div className="w-full md:w-auto">
              <Input
                placeholder="Search rubrics..."
                value={searchTerm}
                onChange={(event) => handleSearchChange(event.target.value)}
                onBlur={handleSearchBlur}
                onKeyDown={handleSearchKeyDown}
                className="h-8 w-full md:w-[150px] lg:w-[250px]"
                data-testid="rubrics-search"
              />
            </div>

            <div className="flex items-center space-x-2 flex-wrap">
              <ThreePickerFilters
                slots={[
                  {
                    column: evalsColumn,
                    title: "Eval",
                    options: evalOptions,
                  },
                  {
                    column: simulationsColumn,
                    title: "Simulation",
                    options: simulationOptions,
                    isServerDriven: true,
                    onSearchChange: handleSimulationSearchChange,
                    searchValue: localSimulationSearch,
                  },
                  {
                    column: departmentsColumn,
                    title: "Department",
                    options: departmentOptions,
                    isServerDriven: true,
                    onSearchChange: handleDepartmentSearchChange,
                    searchValue: localDepartmentSearch,
                  },
                ]}
              />

              {isFiltered && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setSearchTerm("");
                    setLocalDepartmentSearch("");
                    setLocalSimulationSearch("");
                    table.resetColumnFilters();
                    updateRubricsParams({
                      page: 0,
                      search: "",
                      departmentIds: [],
                      simulationIds: [],
                      evalIds: [],
                      departmentSearch: "",
                      simulationSearch: "",
                    });
                  }}
                  className="h-8 px-2 lg:px-3 hidden md:flex"
                >
                  Reset
                  <X className="ml-2 h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {parseCsvAction && importFields && (
              <Button
                variant="outline"
                size="sm"
                className="h-8"
                onClick={() => setShowBulkImportDialog(true)}
              >
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Import CSV
              </Button>
            )}
            <DataTableViewOptions
              table={table}
              hiddenColumns={["name", "passPercentage", "simulations", "departments", "eval_ids"]}
            />
          </div>
        </div>
        )}

        {/* Rubrics cards.

            Ghost cards from in-flight audited writes
            (create/duplicate/update/delete in non-terminal states) are
            prepended — same ``renderRubricCard`` so layout matches
            exactly. Once a ghost commits, its hydrated row is in
            ``mergedRows`` (via ``state.added``) AND the ghost's
            ``state`` flips to "committed" — we filter those out so the
            real row replaces the ghost in place without a duplicate
            frame. */}
        <div className="space-y-4" data-testid="rubrics-grid">
          {rubricGhosts
            .filter((g) => g.state !== "committed" && g.state !== "accepted")
            .map((g) => {
              // For update/delete, ``before`` is the snapshot lookup
              // from baseRows (existing row) — gives us name and
              // description so the ghost shows what's being
              // deleted/updated. For create/duplicate, ``before`` is
              // null and ``partial`` carries the streaming args.
              const rubricShell = (g.before ?? g.partial) as (typeof rubrics)[number];
              return (
                <div key={`ghost-${g.callId}`}>
                  {renderRubricCard(rubricShell, g)}
                </div>
              );
            })}
          {tableRows.length ? (
            tableRows.map((row) => renderRubricCard(row.original))
          ) : (
            rubricGhosts.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No rubrics match the current filters.
              </div>
            )
          )}
        </div>

        {/* Pagination */}
        <DataTablePagination table={table} card={true} />
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent data-testid="dialog-delete-rubric">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Rubric</AlertDialogTitle>
            <AlertDialogDescription>
              <p>
                Are you sure you want to delete the rubric "{deleteItem?.name}"?
                This action cannot be undone.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={isDeleting}
              data-testid="btn-cancel-delete"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              variant="destructive"
              data-testid="btn-confirm-delete"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Confirmation Dialog */}
      <BulkDeleteDialog
        open={showBulkDeleteDialog}
        onOpenChange={setShowBulkDeleteDialog}
        count={selectAllMatching ? selectedCount : deletableRubrics.length}
        entityLabel="rubric"
        entityLabelPlural="rubrics"
        isDeleting={isBulkDeleting}
        onConfirm={handleBulkDelete}
        description={
          <>
            <p>This action cannot be undone.</p>
            {selectAllMatching ? (
              // All-matching mode: server resolves rows from filter +
              // exclusions; per-row permission failures soft-skip.
              // We can't enumerate names without round-tripping through
              // the search endpoint (which would re-trigger the RSC
              // burst), so show the count + filter state instead.
              <div className="text-sm text-muted-foreground">
                <p>
                  All <span className="font-medium text-foreground">{selectedCount}</span> matching
                  {" "}rubrics will be deleted server-side using the current filter.
                </p>
                {excludedRubricIds.length > 0 && (
                  <p className="mt-1">
                    {excludedRubricIds.length} explicitly excluded.
                  </p>
                )}
                <p className="mt-1">
                  Rubrics you don't have permission to delete will be skipped automatically.
                </p>
              </div>
            ) : (
              <>
                {deletableRubrics.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-destructive mb-1">Will be deleted:</p>
                    <ul className="text-sm space-y-0.5">
                      {deletableRubrics.map((r) => (
                        <li key={r.rubric_id} className="flex items-center gap-1.5">
                          <Trash2 className="h-3 w-3 text-destructive flex-shrink-0" />
                          {r.name || "Unnamed Rubric"}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {nonDeletableRubrics.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-yellow-600 dark:text-yellow-500 mb-1">
                      Cannot be deleted (in use):
                    </p>
                    <ul className="text-sm space-y-0.5">
                      {nonDeletableRubrics.map((r) => (
                        <li
                          key={r.rubric_id}
                          className="flex items-center gap-1.5 text-muted-foreground"
                        >
                          {r.name || "Unnamed Rubric"}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </>
        }
      />

      {/* Bulk Edit Modal */}
      <BulkEditDialog
        open={showBulkEditDialog}
        onOpenChange={setShowBulkEditDialog}
        count={selectAllMatching ? selectedCount : editableRubrics.length}
        entityLabelPlural="rubrics"
        isSaving={isBulkEditing}
        onSave={handleBulkEdit}
      >
        <BulkEditFlagField
          label="Active Status"
          value={bulkEditActiveStatus}
          onChange={setBulkEditActiveStatus}
        />
      </BulkEditDialog>

      {/* Bulk Import Dialog */}
      {parseCsvAction && importFields && (
        <BulkImport
          open={showBulkImportDialog}
          onClose={() => {
            setShowBulkImportDialog(false);
            router.refresh();
          }}
          fields={importFields}
          artifactName="Rubrics"
          parseCsvAction={parseCsvAction}
          onSave={async (items) => {
            if (!createRubricAction) throw new Error("Create action not available");
            const rubrics = items.map((item) => ({
              name: item["name"] as string | undefined,
              description: item["description"] as string | undefined,
              departments: item["departments"] as string[] | undefined,
            }));
            return createRubricAction({ body: { rubrics } } as CreateRubricIn);
          }}
        />
      )}

    </div>
  );
}
