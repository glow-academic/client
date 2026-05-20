/**
 * Cohorts.tsx
 * Used to display the cohorts page with table-based filtering and card layout.
 * Server-side filtering with nuqs URL-backed state.
 * @AshokSaravanan222 & @siladiea
 * 06/18/2025
 */
"use client";
import { AlertCircle, Check, CheckCircle, Copy, Edit, Eye, FileSpreadsheet, Loader2, Pencil, Play, Search, Sparkles, Trash2, Users, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { parseAsArrayOf, parseAsBoolean, parseAsString, useQueryState } from "nuqs";
import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ackOperation } from "@/lib/api/ack";

import type {
  CohortsListOut,
  CohortsListBody,
  DeleteCohortIn,
  DeleteCohortOut,
  DuplicateCohortIn,
  DuplicateCohortOut,
  CreateCohortIn,
  CreateCohortOut,
  UpdateCohortIn,
  UpdateCohortOut,
} from "@/app/(main)/training/cohorts/page";
import BulkImport, { type ImportFieldDef, type ParseCsvResult } from "@/components/common/BulkImport";
import { DataTablePagination } from "@/components/common/table/DataTablePagination";
import { DataTableViewOptions } from "@/components/common/table/DataTableViewOptions";
import { ThreePickerFilters } from "@/components/common/table/ThreePickerFilters";
import { GenericPicker } from "@/components/common/forms/GenericPicker";
import { BulkDeleteDialog } from "@/components/common/forms/BulkDeleteDialog";
import { BulkEditDialog } from "@/components/common/forms/BulkEditDialog";
import { BulkEditFlagField } from "@/components/common/forms/BulkEditFlagField";
import { Input } from "@/components/ui/input";
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";

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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useArtifactGhosts, type Ghost } from "@/hooks/use-artifact-ghosts";
import { useCohortAi } from "@/hooks/use-cohort-ai";
import { useColumnVisibility } from "@/hooks/use-column-visibility";

export interface CohortsProps {
  // Server-provided data (for server-side rendering)
  listData: CohortsListOut;
  // SSR column visibility from cookie
  initialColumnVisibility?: VisibilityState;
  // Server actions (replaces useMutation)
  duplicateCohortAction?: (
    input: DuplicateCohortIn,
  ) => Promise<DuplicateCohortOut>;
  deleteCohortAction?: (input: DeleteCohortIn) => Promise<DeleteCohortOut>;
  createCohortAction?: (input: CreateCohortIn) => Promise<CreateCohortOut>;
  updateCohortAction?: (input: UpdateCohortIn) => Promise<UpdateCohortOut>;
  parseCsvAction?: (formData: FormData) => Promise<ParseCsvResult>;
  /** The body the page used for its SSR ``/cohort/search`` call.
   *  Forwarded as the filter envelope on bulk delete/update calls
   *  when the user is in ``selectAll=1`` mode — the server resolves
   *  matching rows directly, no client-side enumeration. */
  currentSearchBody?: CohortsListBody;
  importFields?: ImportFieldDef[];
  // Server-side pagination/filtering state
  pageIndex: number;
  pageSize: number;
  totalCount: number;
  simulationSearch: string;
  profileSearch: string;
  departmentSearch: string;
  flagSearch: string;
}

export default function Cohorts({
  listData: serverListData,
  initialColumnVisibility,
  duplicateCohortAction,
  deleteCohortAction,
  createCohortAction,
  updateCohortAction,
  parseCsvAction,
  currentSearchBody,
  importFields,
  pageIndex,
  pageSize,
  totalCount,
  simulationSearch,
  profileSearch,
  departmentSearch,
  flagSearch,
}: CohortsProps) {
  const router = useRouter();
  useCohortAi({
    onComplete: () => router.refresh(),
  });
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteItem, setDeleteItem] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState<string | null>(null);

  // Selection state — URL-backed so it survives refresh and is
  // craftable as a shareable / LLM-generated focus link. Three params
  // model the full state machine:
  //
  //   - ``selectedIds=A,B``        → explicit selection of named rows
  //   - ``selectAll=1``            → every row matching the active
  //                                  filters/search is selected
  //   - ``selectAll=1&excludedIds=X``
  //                                → all-matching minus exclusions
  //   - (none of the above)        → empty selection
  //
  // The all-matching mode keeps the URL compact for huge datasets
  // (one boolean instead of N ids) and follows the active filter —
  // change the filter and "all matching" follows naturally. Shallow
  // updates avoid the RSC re-fetch burst.
  const [selectedCohortIds, setSelectedCohortIds] = useQueryState(
    "selectedIds",
    parseAsArrayOf(parseAsString).withDefault([]).withOptions({ shallow: true }),
  );
  const [selectAllMatching, setSelectAllMatching] = useQueryState(
    "selectAll",
    parseAsBoolean.withDefault(false).withOptions({ shallow: true }),
  );
  const [excludedCohortIds, setExcludedCohortIds] = useQueryState(
    "excludedIds",
    parseAsArrayOf(parseAsString).withDefault([]).withOptions({ shallow: true }),
  );

  // Bulk delete state
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // Bulk import state
  const [showBulkImportDialog, setShowBulkImportDialog] = useState(false);

  // Bulk edit state
  const [showBulkEditDialog, setShowBulkEditDialog] = useState(false);
  const [isBulkEditing, setIsBulkEditing] = useState(false);
  const [bulkEditActiveStatus, setBulkEditActiveStatus] = useState<boolean | null>(null);
  const [bulkEditDepartmentIds, setBulkEditDepartmentIds] = useState<string[] | null>(null);

  // Debounce refs
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const simulationSearchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const profileSearchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const departmentSearchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flagSearchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Local search state (for immediate UI feedback while debouncing)
  const [localSearch, setLocalSearch] = useState(searchParams.get("search") ?? "");
  const [_localFlagSearch, setLocalFlagSearch] = useState(flagSearch);

  // URL parameter update helper
  const updateCohortsParams = useCallback(
    (updates: Record<string, string | string[] | null | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === undefined || value === "" || (Array.isArray(value) && value.length === 0)) {
          params.delete(key);
        } else if (Array.isArray(value)) {
          params.delete(key);
          value.forEach((v) => params.append(key, v));
        } else {
          params.set(key, value);
        }
      }
      // Reset page when filters change (unless page is explicitly set in updates)
      if (!("page" in updates)) {
        params.delete("page");
      }
      const query = params.toString();
      router.push(query ? `${pathname}?${query}` : pathname);
    },
    [searchParams, pathname, router],
  );

  // Table state
  const [rowSelection, setRowSelection] = useState({});
  const [columnVisibility, setColumnVisibility] = useColumnVisibility("cohorts", initialColumnVisibility);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>(() => {
    // Initialize from URL params
    const filters: ColumnFiltersState = [];
    const simulationIds = searchParams.getAll("simulationIds");
    if (simulationIds.length > 0) filters.push({ id: "simulation_ids", value: simulationIds });
    const profileIds = searchParams.getAll("profileIds");
    if (profileIds.length > 0) filters.push({ id: "profile_ids", value: profileIds });
    const departmentIds = searchParams.getAll("departmentIds");
    if (departmentIds.length > 0) filters.push({ id: "departments", value: departmentIds });
    return filters;
  });
  const [sorting, setSorting] = useState<SortingState>([
    { id: "updated_at", desc: true },
  ]);

  // Use server-provided data directly
  const cohortsData = serverListData;

  // Base server-rendered rows. ``useArtifactGhosts`` overlays the
  // create/update/delete/duplicate lifecycle on top — committed rows
  // get merged into ``mergedCohorts`` directly so the table stays
  // current without a ``router.refresh()`` (which would re-burst the
  // page's SSR fetches — see GenerationPanel handleSend rationale).
  const baseCohorts = useMemo(
    () => cohortsData?.cohorts || [],
    [cohortsData?.cohorts],
  );

  const {
    ghosts: cohortGhosts,
    mergedRows: mergedCohorts,
    ack: ackCohortGhost,
    drop: _dropCohortGhost,
  } = useArtifactGhosts({
    artifactType: "cohort",
    // All four CRUD ops the LLM might invoke or the user might trigger
    // from the toolbar/card. Each maps to a distinct ghost visual in
    // ``renderCohortCard`` (creating / updating / deleting /
    // duplicating skeleton + pending soft state). Without
    // ``duplicate`` here the LLM's duplicate tool dispatch fires
    // audit events that nothing is subscribed to → no ghost.
    ops: ["create", "update", "delete", "duplicate"],
    baseRows: baseCohorts,
    rowKey: "cohort_id",
    // ``cohorts`` plural matches the field name the create /
    // duplicate / update impls now include on their responses (see
    // ``hydrate_cohort_list_rows``). The hook reads
    // ``output.cohorts`` from the audit ``.completed`` payload to
    // materialize new/changed rows directly — no SSR refresh needed.
    artifactPlural: "cohorts",
  });

  // Downstream code reads ``cohorts`` — keep that name to minimize
  // diff. The active list is the merged view (base + create overlays
  // − delete overlays).
  const cohorts = mergedCohorts;

  // Unified ack handler: live in-flight ghosts go through the hook;
  // server-side persistent pending rows ack via the generic action
  // and refresh. Mirrors ``Personas.tsx::handlePersonaAck``.
  const handleCohortAck = useCallback(
    async (callId: string, accept: boolean, op: Ghost<unknown>["op"]) => {
      const live = cohortGhosts.find((g) => g.callId === callId);
      if (live) {
        await ackCohortGhost(callId, accept);
        return;
      }
      try {
        await ackOperation({
          artifact: "cohort",
          operation: op,
          idempotencyKey: callId,
          accept,
        });
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Ack failed");
      }
    },
    [cohortGhosts, ackCohortGhost, router],
  );
  void handleCohortAck;

  // ---- Selection helpers ----------------------------------------
  // ``isSelected`` is the single read predicate every row uses; it
  // dispatches between explicit-id and all-matching modes so
  // downstream code never needs to branch. ``selectedCount`` mirrors
  // that — under all-matching it's ``totalCount - excludedIds.length``.

  const totalMatchingCount = cohortsData?.total_count ?? 0;

  const isSelected = useCallback(
    (id: string | null | undefined) => {
      if (!id) return false;
      return selectAllMatching
        ? !excludedCohortIds.includes(id)
        : selectedCohortIds.includes(id);
    },
    [selectAllMatching, excludedCohortIds, selectedCohortIds],
  );

  const selectedCount = selectAllMatching
    ? Math.max(0, totalMatchingCount - excludedCohortIds.length)
    : selectedCohortIds.length;

  const selectedCohorts = useMemo(() => {
    return cohorts.filter((c) => c.cohort_id && isSelected(c.cohort_id));
  }, [cohorts, isSelected]);

  const deletableCohorts = useMemo(() => {
    return selectedCohorts.filter((c) => c.can_delete);
  }, [selectedCohorts]);

  const nonDeletableCohorts = useMemo(() => {
    return selectedCohorts.filter((c) => !c.can_delete);
  }, [selectedCohorts]);

  const editableCohorts = useMemo(() => {
    return selectedCohorts.filter((c) => c.can_edit);
  }, [selectedCohorts]);

  // Check if all cohorts on the current page are selected.
  // Under all-matching mode every loaded row whose id isn't in
  // ``excludedCohortIds`` is implicitly selected, so the predicate
  // reduces to "no excluded rows on the current page."
  const allPageSelected = useMemo(() => {
    const pageIds = cohorts.filter((c) => c.cohort_id).map((c) => c.cohort_id!);
    if (pageIds.length === 0) return false;
    return pageIds.every((id) => isSelected(id));
  }, [cohorts, isSelected]);

  // Whether there ARE more matching rows than what's loaded on this
  // page — used to decide whether to surface the "Select all N
  // matching" affordance after the user selects the page.
  const hasMoreThanCurrentPage = totalMatchingCount > cohorts.length;

  // Toggle selection for a single cohort. Under all-matching mode
  // we toggle membership in excludedCohortIds (deselect ⇒ add to
  // exclusions, re-select ⇒ remove). Under explicit mode it's the
  // straight selectedCohortIds toggle.
  const toggleSelection = useCallback((cohortId: string) => {
    if (selectAllMatching) {
      void setExcludedCohortIds((prev) =>
        prev.includes(cohortId)
          ? prev.filter((id) => id !== cohortId)
          : [...prev, cohortId],
      );
    } else {
      void setSelectedCohortIds((prev) =>
        prev.includes(cohortId)
          ? prev.filter((id) => id !== cohortId)
          : [...prev, cohortId],
      );
    }
  }, [selectAllMatching, setExcludedCohortIds, setSelectedCohortIds]);

  const clearSelection = useCallback(() => {
    void setSelectedCohortIds([]);
    void setSelectAllMatching(false);
    void setExcludedCohortIds([]);
  }, [setSelectedCohortIds, setSelectAllMatching, setExcludedCohortIds]);

  const selectAllOnPage = useCallback(() => {
    const pageIds = cohorts.filter((c) => c.cohort_id).map((c) => c.cohort_id!);
    void setSelectAllMatching(false);
    void setExcludedCohortIds([]);
    void setSelectedCohortIds((prev) => {
      const combined = new Set([...prev, ...pageIds]);
      return Array.from(combined);
    });
  }, [cohorts, setSelectAllMatching, setExcludedCohortIds, setSelectedCohortIds]);

  /** Promote the current page-only selection into "all matching
   *  filter" mode. Clears explicit ids and exclusions — the all-
   *  matching mode is the canonical truth from this point. */
  const selectAllMatchingNow = useCallback(() => {
    void setSelectedCohortIds([]);
    void setExcludedCohortIds([]);
    void setSelectAllMatching(true);
  }, [setSelectedCohortIds, setExcludedCohortIds, setSelectAllMatching]);

  // Use server-provided facet options directly (filtered by search term server-side)
  const simulationOptions = useMemo(
    () =>
      (cohortsData?.simulation_filter?.options || [])
        .map((opt) => ({
          value: opt.id as string,
          label: opt.name as string,
          count: opt.count ?? undefined,
        }))
        .filter((opt) => opt.value && opt.label),
    [cohortsData?.simulation_filter],
  );
  const profileOptions = useMemo(
    () =>
      (cohortsData?.profile_filter?.options || [])
        .map((opt) => ({
          value: opt.id as string,
          label: opt.name as string,
          count: opt.count ?? undefined,
        }))
        .filter((opt) => opt.value && opt.label),
    [cohortsData?.profile_filter],
  );
  const departmentOptions = useMemo(
    () =>
      (cohortsData?.department_filter?.options || [])
        .map((opt) => ({
          value: opt.id as string,
          label: opt.name as string,
          count: opt.count ?? undefined,
        }))
        .filter((opt) => opt.value && opt.label),
    [cohortsData?.department_filter],
  );
  const flagOptions = useMemo(() => {
    return (cohortsData?.flag_filter?.options || [])
      .filter((opt): opt is typeof opt & { id: string; name: string } => !!opt.id && !!opt.name)
      .map((opt) => ({ id: opt.id!, name: opt.name!, type: opt.type ?? null }));
  }, [cohortsData?.flag_filter]);

  // Define table columns inline
  const columns: ColumnDef<(typeof cohorts)[number]>[] = useMemo(
    () => [
      {
        accessorKey: "name",
        header: "Name",
      },
      // Hidden faceting column for Profiles (array of IDs)
      {
        id: "profile_ids",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: (typeof cohorts)[number]) => row.profile_ids ?? [],
        filterFn: (row, _id, value: string[]) => {
          const rowIds = (row.getValue("profile_ids") as string[]) ?? [];
          if (value.length === 0) return true;
          if (rowIds.length === 0) return false;
          return value.some((v) => rowIds.includes(v));
        },
      },
      // Hidden faceting column for Simulations (array of IDs)
      {
        id: "simulation_ids",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: (typeof cohorts)[number]) => row.simulation_ids ?? [],
        filterFn: (row, _id, value: string[]) => {
          const rowIds = (row.getValue("simulation_ids") as string[]) ?? [];
          if (value.length === 0) return true;
          if (rowIds.length === 0) return false;
          return value.some((v) => rowIds.includes(v));
        },
      },
      // Hidden faceting column for Departments (array of IDs)
      {
        id: "departments",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: (typeof cohorts)[number]) => row.department_ids ?? [],
        filterFn: (row, _id, value: string[]) => {
          const rowIds = (row.getValue("departments") as string[]) ?? [];
          if (value.length === 0) return true;
          if (rowIds.length === 0) return false;
          return value.some((v) => rowIds.includes(v));
        },
      },
      {
        accessorKey: "updated_at",
        header: "Updated",
        cell: ({ row }) => {
          if (!row.original.updated_at) {
            return <div className="text-sm text-muted-foreground">-</div>;
          }
          const date = new Date(row.original.updated_at);
          return (
            <div className="text-sm text-muted-foreground">
              {date.toLocaleDateString()}
            </div>
          );
        },
      },
      // Virtual columns for card view toggles
      {
        id: "ai_badge",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: (typeof cohorts)[number]) => row.generated ?? false,
      },
      {
        id: "status_badge",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: (typeof cohorts)[number]) => row.is_inactive ?? false,
      },
      {
        id: "card_description",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: (typeof cohorts)[number]) => row.description ?? "",
      },
      {
        id: "card_members",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: (typeof cohorts)[number]) => row.num_members ?? 0,
      },
      {
        id: "card_simulations",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: (typeof cohorts)[number]) => row.simulation_ids ?? [],
      },
    ],
    [],
  );

  // Page count for manual pagination
  const pageCount = Math.ceil(totalCount / pageSize);

  // Create table instance with manual pagination/filtering
  const table = useReactTable({
    data: cohorts,
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
    pageCount,
    manualPagination: true,
    manualFiltering: true,
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: (updater) => {
      const newFilters = typeof updater === "function" ? updater(columnFilters) : updater;
      setColumnFilters(newFilters);
      // Sync filter changes to URL
      const simulationFilter = newFilters.find((f) => f.id === "simulation_ids");
      const profileFilter = newFilters.find((f) => f.id === "profile_ids");
      const departmentFilter = newFilters.find((f) => f.id === "departments");
      updateCohortsParams({
        simulationIds: (simulationFilter?.value as string[] | undefined) ?? null,
        profileIds: (profileFilter?.value as string[] | undefined) ?? null,
        departmentIds: (departmentFilter?.value as string[] | undefined) ?? null,
      });
    },
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: (updater) => {
      const current = { pageIndex, pageSize };
      const next = typeof updater === "function" ? updater(current) : updater;
      updateCohortsParams({
        page: next.pageIndex > 0 ? String(next.pageIndex) : null,
        pageSize: next.pageSize !== 12 ? String(next.pageSize) : null,
      });
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  // Memoize table rows. Including ``cohorts`` itself (not just
  // ``cohorts.length``) so update events that mutate row content but
  // not list cardinality still invalidate the memo. ``cohorts`` is
  // stabilized upstream by ``mergedCohorts``'s useMemo, so a new
  // reference only appears when ``state.added``/``replaced``/
  // ``hiddenIds`` actually change — no spurious recomputes.
  const sortingKey = JSON.stringify(sorting);
  const tableRows = useMemo(() => {
    return table.getRowModel().rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortingKey, cohorts, pageIndex, pageSize]);

  // Debounced search handler
  const handleSearchChange = useCallback(
    (value: string) => {
      setLocalSearch(value);
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
      searchDebounceRef.current = setTimeout(() => {
        updateCohortsParams({ search: value || null });
      }, 500);
    },
    [updateCohortsParams],
  );

  const handleSearchBlur = useCallback(() => {
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
      searchDebounceRef.current = null;
    }
    updateCohortsParams({ search: localSearch || null });
  }, [localSearch, updateCohortsParams]);

  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        if (searchDebounceRef.current) {
          clearTimeout(searchDebounceRef.current);
          searchDebounceRef.current = null;
        }
        updateCohortsParams({ search: localSearch || null });
      }
    },
    [localSearch, updateCohortsParams],
  );

  // Filter option search handlers (300ms debounce)
  const handleSimulationSearchChange = useCallback(
    (term: string) => {
      if (simulationSearchDebounceRef.current) clearTimeout(simulationSearchDebounceRef.current);
      simulationSearchDebounceRef.current = setTimeout(() => {
        updateCohortsParams({ simulationSearch: term || null });
      }, 300);
    },
    [updateCohortsParams],
  );

  const handleProfileSearchChange = useCallback(
    (term: string) => {
      if (profileSearchDebounceRef.current) clearTimeout(profileSearchDebounceRef.current);
      profileSearchDebounceRef.current = setTimeout(() => {
        updateCohortsParams({ profileSearch: term || null });
      }, 300);
    },
    [updateCohortsParams],
  );

  const handleDepartmentSearchChange = useCallback(
    (term: string) => {
      if (departmentSearchDebounceRef.current) clearTimeout(departmentSearchDebounceRef.current);
      departmentSearchDebounceRef.current = setTimeout(() => {
        updateCohortsParams({ departmentSearch: term || null });
      }, 300);
    },
    [updateCohortsParams],
  );

  const _handleFlagSearchChange = useCallback(
    (term: string) => {
      setLocalFlagSearch(term);
      if (flagSearchTimeoutRef.current) clearTimeout(flagSearchTimeoutRef.current);
      flagSearchTimeoutRef.current = setTimeout(() => {
        updateCohortsParams({ flagSearch: term || null });
      }, 300);
    },
    [updateCohortsParams],
  );

  // Reset all filters
  const handleResetFilters = useCallback(() => {
    setColumnFilters([]);
    setLocalSearch("");
    setLocalFlagSearch("");
    updateCohortsParams({
      search: null,
      simulationIds: null,
      profileIds: null,
      departmentIds: null,
      simulationSearch: null,
      profileSearch: null,
      departmentSearch: null,
      flagSearch: null,
      page: null,
    });
  }, [updateCohortsParams]);

  const handleDelete = async () => {
    if (!deleteItem || !deleteCohortAction) return;

    setIsDeleting(true);
    try {
      await deleteCohortAction({ body: { cohort_ids: [deleteItem.id], accept: true } });
      toast.success("Cohort deleted successfully");
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to delete cohort";
      const cleanMsg = msg.replace(/^\d{3}\s*/, "");
      toast.error(cleanMsg || "Failed to delete cohort");
      if (msg.startsWith("404")) {
        router.refresh();
      }
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
      setDeleteItem(null);
    }
  };

  const handleBulkDelete = async () => {
    // Either explicit-mode (deletable rows on current page) OR
    // all-matching mode (server resolves rows via filter). Both
    // converge on the same ``deleteCohortAction`` call shape; the
    // body just differs.
    if (!deleteCohortAction) return;
    if (!selectAllMatching && deletableCohorts.length === 0) return;

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
            excluded_ids: excludedCohortIds,
            ...(currentSearchBody ?? {}),
            accept: true,
          }
        : {
            cohort_ids: deletableCohorts.map((c) => c.cohort_id!),
            accept: true,
          };

      const result = await deleteCohortAction({ body } as DeleteCohortIn);

      // Per-row results from the server: success entries are actual
      // deletions, failures are soft-skipped rows (no permission /
      // not found). Toast reflects both counts so the user knows
      // some rows were skipped without inspecting the receipt.
      const results = (result as DeleteCohortOut).results ?? [];
      const successCount = results.filter((r) => r.success).length;
      const skippedCount = results.length - successCount;
      if (skippedCount > 0) {
        toast.success(
          `${successCount} cohort(s) deleted, ${skippedCount} skipped`,
        );
      } else {
        toast.success(`${successCount} cohort(s) deleted successfully`);
      }
      clearSelection();
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to delete cohorts";
      const cleanMsg = msg.replace(/^\d{3}\s*/, "");
      toast.error(cleanMsg || "Failed to delete cohorts");
    } finally {
      setIsBulkDeleting(false);
      setShowBulkDeleteDialog(false);
    }
  };

  const handleBulkEdit = async () => {
    if (!updateCohortAction) return;
    if (!selectAllMatching && editableCohorts.length === 0) return;

    const hasActiveChange = bulkEditActiveStatus !== null;
    const hasDeptChange = bulkEditDepartmentIds !== null;
    const hasAnyFlagChange = hasActiveChange;

    if (!hasActiveChange && !hasDeptChange) {
      toast.error("No changes selected");
      return;
    }

    // Resolve flag UUIDs by type from the server-provided catalog.
    const flagId = (type: string) => flagOptions.find((f) => f.type === type)?.id;
    const activeFlagId = flagId("cohort_active");

    setIsBulkEditing(true);
    try {
      // Shared change set used by both paths. Under all-matching the
      // server clones this per resolved row (stamping each id);
      // under explicit we clone client-side, preserving per-row flag
      // state for fields we aren't toggling.
      const sharedPatch = {
        ...(hasDeptChange && { department_ids: bulkEditDepartmentIds }),
      };

      let body: UpdateCohortIn["body"];
      if (selectAllMatching) {
        // All-matching: the server can't preserve per-row flag state
        // (it doesn't know what each row's existing flags are), so
        // the active toggle becomes "set to this value across all
        // matching rows" — the same semantic as a manual sweep.
        let flag_ids: string[] | undefined;
        if (hasAnyFlagChange) {
          flag_ids = [];
          if (bulkEditActiveStatus && activeFlagId) flag_ids.push(activeFlagId);
        }
        body = {
          all: true,
          excluded_ids: excludedCohortIds,
          ...(currentSearchBody ?? {}),
          patch: {
            ...sharedPatch,
            ...(hasAnyFlagChange && { flag_ids }),
          },
          accept: true,
        } as UpdateCohortIn["body"];
      } else {
        // Explicit: clone the patch per-row, preserving each row's
        // existing flag state for flags we aren't toggling.
        const items = editableCohorts.map((cohort) => {
          let flag_ids: string[] | undefined;
          if (hasAnyFlagChange) {
            const isActive = hasActiveChange ? bulkEditActiveStatus : !cohort.is_inactive;
            flag_ids = [];
            if (isActive && activeFlagId) flag_ids.push(activeFlagId);
          }
          return {
            id: cohort.cohort_id!,
            ...sharedPatch,
            ...(hasAnyFlagChange && { flag_ids }),
          };
        });
        body = { cohorts: items } as UpdateCohortIn["body"];
      }

      const result = await updateCohortAction({ body } as UpdateCohortIn);

      // Per-row results — same soft-skip pattern as bulk delete.
      const results = (result as UpdateCohortOut).results ?? [];
      const successCount = results.filter((r) => r.success).length;
      const skippedCount = results.length - successCount;
      if (skippedCount > 0) {
        toast.success(
          `${successCount} cohort(s) updated, ${skippedCount} skipped`,
        );
      } else {
        toast.success(`${successCount} cohort(s) updated successfully`);
      }
      clearSelection();
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to update cohorts";
      const cleanMsg = msg.replace(/^\d{3}\s*/, "");
      toast.error(cleanMsg || "Failed to update cohorts");
    } finally {
      setIsBulkEditing(false);
      setShowBulkEditDialog(false);
    }
  };

  const openBulkEditDialog = () => {
    // Reset form state
    setBulkEditActiveStatus(null);
    setBulkEditDepartmentIds(null);
    setShowBulkEditDialog(true);
  };

  const handleDuplicate = async (cohortId: string, cohortName: string) => {
    if (!duplicateCohortAction) return;

    setIsDuplicating(cohortId);
    try {
      await duplicateCohortAction({ body: { cohort_id: cohortId, accept: true } });
      toast.success(`Cohort "${cohortName}" duplicated successfully`);
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to duplicate cohort";
      const cleanMsg = msg.replace(/^\d{3}\s*/, "");
      toast.error(cleanMsg || "Failed to duplicate cohort");
      if (msg.startsWith("404")) {
        router.refresh();
      }
    } finally {
      setIsDuplicating(null);
    }
  };

  const handleDeleteClick = (id: string, name: string) => {
    setDeleteItem({ id, name });
    setShowDeleteDialog(true);
  };

  const renderCohortCard = (
    cohort: (typeof cohorts)[number],
    ghost?: Ghost<(typeof cohorts)[number]>,
  ) => {
    // Same card visual for real rows and in-flight ghosts — single
    // source of truth for layout, dimensions, badges. Ghost mode swaps
    // action buttons for a status badge (and Accept/Reject for soft-
    // pending), disables selection/click, and tints the border based
    // on lifecycle state. Avoids the prior banner approach where the
    // ghost was a full-width row that didn't match the cohort-card
    // visual language.
    const isGhost = ghost != null;
    const ghostState = ghost?.state;
    const inFlight =
      ghostState === "creating" ||
      ghostState === "duplicating" ||
      ghostState === "updating" ||
      ghostState === "deleting";
    const isPending = ghostState === "pending";
    const isFailed = ghostState === "failed";

    const isSelectedRow = !isGhost && cohort.cohort_id ? isSelected(cohort.cohort_id) : false;

    const handleCardClick = (e: React.MouseEvent) => {
      // Don't toggle selection if clicking action buttons or when
      // rendering as a ghost (no real id to select).
      if (isGhost) return;
      if ((e.target as HTMLElement).closest("[data-action-button]")) return;
      if (cohort.cohort_id) {
        toggleSelection(cohort.cohort_id);
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
      key={cohort.cohort_id || ""}
      {...(cohort.name ? { "aria-label": cohort.name } : {})}
      data-testid={isGhost ? "cohort-ghost-card" : "cohort-card"}
      {...(cohort.cohort_id ? { "data-cohort-id": cohort.cohort_id } : {})}
      data-ghost-state={ghostState}
      className={`group relative flex flex-col h-full hover:shadow-md transition-all ${
        isGhost ? "" : "cursor-pointer"
      } ${ghostBorderClass} ${isSelectedRow ? "ring-2 ring-primary" : ""}`}
      aria-selected={isSelectedRow}
      aria-busy={inFlight ? true : undefined}
      onClick={handleCardClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              {/* Selection checkbox — inline before name. Hidden in
                  ghost mode (no row id to select yet). */}
              {!isGhost && (
                <div
                  className={`transition-all overflow-hidden flex-shrink-0 ${
                    selectedCount > 0 ? "w-5 opacity-100" : "w-0 opacity-0 group-hover:w-5 group-hover:opacity-100"
                  }`}
                  data-action-button
                >
                  <Checkbox
                    checked={isSelectedRow}
                    onCheckedChange={() => {
                      if (cohort.cohort_id) toggleSelection(cohort.cohort_id);
                    }}
                    className="rounded-full h-5 w-5"
                    aria-label={`Select cohort ${cohort.name || "Unnamed"}`}
                  />
                </div>
              )}
              {inFlight && (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground flex-shrink-0" />
              )}
              <CardTitle className="text-lg">
                {cohort.name || (isGhost ? "Generating…" : "")}
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
            {((columnVisibility.ai_badge !== false && cohort.generated) || (columnVisibility.status_badge !== false && cohort.is_inactive)) && (
              <div className="mt-1 flex items-center gap-2">
                {columnVisibility.ai_badge !== false && cohort.generated && (
                  <Badge variant="default">
                    <Sparkles className="h-3 w-3 mr-1" />
                    {cohort.mcp ? "MCP" : "AI"}
                  </Badge>
                )}
                {columnVisibility.status_badge !== false && cohort.is_inactive && (
                  <Badge variant="secondary">Inactive</Badge>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1" data-action-button>
            {/* Ghost-mode action area: status-aware. Pending → Accept/
                Reject for soft-write ack. Failed → error indicator.
                In-flight → no buttons (the streaming card is read-only
                until commit/failure). */}
            {isGhost && isPending && ghost.callId && (
              <>
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  className="h-8"
                  onClick={() => ackCohortGhost(ghost.callId, true)}
                >
                  <Check className="mr-1 h-3.5 w-3.5" />
                  Accept
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={() => ackCohortGhost(ghost.callId, false)}
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
            {!isGhost && cohort.cohort_id && (<>{cohort.can_edit ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    data-testid={`edit-${cohort.cohort_id}`}
                  >
                    <Link
                      href={`/training/cohorts/${cohort.cohort_id}`}
                      prefetch={false}
                      {...(cohort.name
                        ? { "aria-label": `Edit ${cohort.name}` }
                        : {})}
                    >
                      <Edit className="h-4 w-4" />
                    </Link>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Edit</TooltipContent>
              </Tooltip>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    data-testid={`view-${cohort.cohort_id}`}
                  >
                    <Link
                      href={`/training/cohorts/${cohort.cohort_id}`}
                      prefetch={false}
                      {...(cohort.name
                        ? { "aria-label": `View ${cohort.name}` }
                        : {})}
                    >
                      <Eye className="h-4 w-4" />
                    </Link>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>View</TooltipContent>
              </Tooltip>
            )}
            {cohort.can_duplicate && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      cohort.cohort_id &&
                      cohort.name &&
                      handleDuplicate(cohort.cohort_id, cohort.name)
                    }
                    disabled={
                      !cohort.cohort_id ||
                      isDuplicating === cohort.cohort_id
                    }
                    {...(cohort.name
                      ? { "aria-label": `Duplicate ${cohort.name}` }
                      : {})}
                    data-testid="btn-duplicate-cohort"
                  >
                    {cohort.cohort_id && isDuplicating === cohort.cohort_id ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Duplicate</TooltipContent>
              </Tooltip>
            )}
            {cohort.can_delete && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    data-testid={`delete-${cohort.cohort_id}`}
                    onClick={() =>
                      cohort.cohort_id &&
                      handleDeleteClick(cohort.cohort_id, cohort.name || "Untitled Cohort")
                    }
                    {...(cohort.name
                      ? { "aria-label": `Delete ${cohort.name}` }
                      : {})}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Delete</TooltipContent>
              </Tooltip>
            )}</>)}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 flex-grow flex flex-col justify-end">
        {columnVisibility.card_description !== false && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {cohort.description || "No description available"}
          </p>
        )}
        {(columnVisibility.card_members !== false || columnVisibility.card_simulations !== false) && (
          <div className="flex items-center gap-1.5 mt-3 text-xs text-muted-foreground flex-wrap">
            {columnVisibility.card_members !== false && (
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {cohort.num_members} members
              </span>
            )}
            {columnVisibility.card_members !== false && columnVisibility.card_simulations !== false && cohort.simulation_ids && cohort.simulation_ids.length > 0 && (
              <span className="text-muted-foreground">•</span>
            )}
            {columnVisibility.card_simulations !== false && cohort.simulation_ids && cohort.simulation_ids.length > 0 && (
              <span className="flex items-center gap-1">
                <Play className="h-3 w-3" />
                {cohort.simulation_ids.length}{" "}
                {cohort.simulation_ids.length === 1
                  ? "simulation"
                  : "simulations"}
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
    );
  };

  // Get column references for toolbar
  const profileColumn = table.getColumn("profile_ids");
  const simulationColumn = table.getColumn("simulation_ids");
  const departmentsColumn = table.getColumn("departments");
  const isFiltered = columnFilters.length > 0 || localSearch.length > 0;

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <div className="space-y-4">
          {/* Toolbar — swaps between filter bar and selection action bar */}
          {selectedCount > 0 ? (
            <div className="space-y-2" data-testid="cohorts-toolbar">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {deleteCohortAction && (
                  <Button
                    variant="destructive"
                    size="sm"
                    className="h-8"
                    onClick={() => setShowBulkDeleteDialog(true)}
                    disabled={!selectAllMatching && deletableCohorts.length === 0}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    {selectAllMatching
                      ? `Delete ${selectedCount} matching`
                      : `Delete ${deletableCohorts.length} of ${selectedCount}`}
                  </Button>
                )}
                {updateCohortAction && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8"
                    onClick={openBulkEditDialog}
                    disabled={!selectAllMatching && editableCohorts.length === 0}
                  >
                    <Pencil className="mr-2 h-4 w-4" />
                    {selectAllMatching
                      ? `Edit ${selectedCount} matching`
                      : `Edit ${editableCohorts.length} of ${selectedCount}`}
                  </Button>
                )}
                {!allPageSelected && !selectAllMatching && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8"
                    onClick={selectAllOnPage}
                  >
                    Select Page
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8"
                  onClick={clearSelection}
                >
                  Unselect All
                </Button>
              </div>
              <DataTableViewOptions table={table} hiddenColumns={["name", "profile_ids", "simulation_ids", "departments", "updated_at"]} />
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
                  All {cohorts.length} on this page selected.
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
                  All {selectedCount} matching cohorts selected
                  {excludedCohortIds.length > 0 && ` (${excludedCohortIds.length} excluded)`}.
                </span>
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0"
                  onClick={clearSelection}
                >
                  Clear
                </Button>
              </div>
            )}
            </div>
          ) : (
          <div
            className="flex flex-col md:flex-row md:items-center md:justify-between gap-2"
            data-testid="cohorts-toolbar"
          >
            <div className="flex flex-col md:flex-row md:flex-1 md:items-center md:space-x-2 gap-2 md:gap-0">
              <div className="w-full md:w-auto">
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    data-testid="cohorts-search"
                    placeholder="Search cohorts..."
                    value={localSearch}
                    onChange={(event) => handleSearchChange(event.target.value)}
                    onBlur={handleSearchBlur}
                    onKeyDown={handleSearchKeyDown}
                    className="h-8 w-full md:w-[150px] lg:w-[250px] pl-8"
                    aria-label="Search cohorts by name"
                    aria-controls="cohorts-grid"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2 flex-wrap">
                <ThreePickerFilters
                  slots={[
                    {
                      column: simulationColumn,
                      title: "Simulation",
                      options: simulationOptions,
                      isServerDriven: true,
                      onSearchChange: handleSimulationSearchChange,
                      searchValue: simulationSearch,
                    },
                    {
                      column: profileColumn,
                      title: "Profile",
                      options: profileOptions,
                      isServerDriven: true,
                      onSearchChange: handleProfileSearchChange,
                      searchValue: profileSearch,
                    },
                    {
                      column: departmentsColumn,
                      title: "Department",
                      options: departmentOptions,
                      isServerDriven: true,
                      onSearchChange: handleDepartmentSearchChange,
                      searchValue: departmentSearch,
                    },
                  ]}
                />

                {isFiltered && (
                  <Button
                    variant="ghost"
                    onClick={handleResetFilters}
                    className="h-8 px-2 lg:px-3 hidden md:flex"
                  >
                    Reset
                    <X className="ml-2 h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
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
            <DataTableViewOptions table={table} hiddenColumns={["name", "profile_ids", "simulation_ids", "departments", "updated_at"]} />
          </div>
          )}

          {/* Cards Grid — container-query driven; scales with content area width.

              Ghost cards from in-flight audited writes (create/duplicate/
              update/delete in non-terminal states) are prepended — same
              ``renderCohortCard`` so layout, dimensions, and visual
              language match exactly. Once a ghost commits, its hydrated
              row is in ``mergedRows`` (via ``state.added``) AND the
              ghost's ``state`` flips to "committed" — we filter those
              out so the real row replaces the ghost in place without a
              duplicate frame. */}
          <div className="@container">
            <div
              className="grid gap-4 @2xl:grid-cols-2 @5xl:grid-cols-3 @7xl:grid-cols-4"
              role="grid"
              aria-label="cohorts grid"
              data-testid="cohorts-grid"
            >
              {cohortGhosts
                .filter((g) => g.state !== "committed" && g.state !== "accepted")
                .map((g) => {
                  // For update/delete, ``before`` is the snapshot lookup
                  // from baseRows (existing row) — gives us name and
                  // counts so the ghost card shows what's being
                  // deleted/updated. For create/duplicate, ``before`` is
                  // null and ``partial`` carries the streaming args.
                  const cohortShell = (g.before ?? g.partial) as (typeof cohorts)[number];
                  return (
                    <div key={`ghost-${g.callId}`}>
                      {renderCohortCard(cohortShell, g)}
                    </div>
                  );
                })}
              {tableRows.length ? (
                tableRows.map((row) => {
                  const cohort = row.original;
                  const key = cohort.cohort_id || `cohort-${row.id}`;
                  const persistentGhost: Ghost<(typeof cohorts)[number]> | undefined =
                    cohort.pending_status === "pending" && cohort.pending_call_id
                      ? {
                          callId: cohort.pending_call_id,
                          op: (cohort.pending_operation as Ghost<(typeof cohorts)[number]>["op"]) ?? "create",
                          state: "pending",
                          rowId: cohort.cohort_id ?? null,
                          partial: cohort as unknown as Ghost<(typeof cohorts)[number]>["partial"],
                          before: cohort,
                          tool: null,
                          error: null,
                          arguments: {},
                        }
                      : undefined;
                  return <div key={key}>{renderCohortCard(cohort, persistentGhost)}</div>;
                })
              ) : (
                cohortGhosts.length === 0 && (
                  <div className="col-span-full text-center py-8 text-muted-foreground">
                    No cohorts match the current filters.
                  </div>
                )
              )}
            </div>
          </div>

          {/* Pagination */}
          <DataTablePagination table={table} card={true} />
        </div>

        {/* Single Delete Confirmation Dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent
            aria-labelledby="delete-cohort-title"
            data-testid="dialog-delete-cohort"
          >
            <AlertDialogHeader>
              <AlertDialogTitle id="delete-cohort-title">
                Delete Cohort
              </AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete the cohort "{deleteItem?.name}"?
                This action cannot be undone.
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
          count={selectAllMatching ? selectedCount : deletableCohorts.length}
          entityLabel="cohort"
          entityLabelPlural="cohorts"
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
                    {" "}cohorts will be deleted server-side using the current filter.
                  </p>
                  {excludedCohortIds.length > 0 && (
                    <p className="mt-1">
                      {excludedCohortIds.length} explicitly excluded.
                    </p>
                  )}
                  <p className="mt-1">
                    Cohorts you don't have permission to delete will be skipped automatically.
                  </p>
                </div>
              ) : (
                <>
                  {deletableCohorts.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-destructive mb-1">Will be deleted:</p>
                      <ul className="text-sm space-y-0.5">
                        {deletableCohorts.map((c) => (
                          <li key={c.cohort_id} className="flex items-center gap-1.5">
                            <Trash2 className="h-3 w-3 text-destructive flex-shrink-0" />
                            {c.name || "Unnamed Cohort"}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {nonDeletableCohorts.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-yellow-600 dark:text-yellow-500 mb-1">Cannot be deleted (in use):</p>
                      <ul className="text-sm space-y-0.5">
                        {nonDeletableCohorts.map((c) => (
                          <li key={c.cohort_id} className="flex items-center gap-1.5 text-muted-foreground">
                            <CheckCircle className="h-3 w-3 text-yellow-600 dark:text-yellow-500 flex-shrink-0" />
                            {c.name || "Unnamed Cohort"}
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
          count={selectAllMatching ? selectedCount : editableCohorts.length}
          entityLabelPlural="cohorts"
          isSaving={isBulkEditing}
          onSave={handleBulkEdit}
        >
          <BulkEditFlagField
            label="Active Status"
            value={bulkEditActiveStatus}
            onChange={setBulkEditActiveStatus}
          />

          {/* Departments — GenericPicker multi-select */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Departments</Label>
              {bulkEditDepartmentIds !== null && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() => setBulkEditDepartmentIds(null)}
                >
                  Reset
                </Button>
              )}
            </div>
            {bulkEditDepartmentIds === null ? (
              <Button
                variant="outline"
                className="w-full justify-start text-muted-foreground"
                onClick={() => setBulkEditDepartmentIds([])}
              >
                No change — click to edit departments
              </Button>
            ) : (
              <GenericPicker
                items={departmentOptions}
                selectedIds={bulkEditDepartmentIds}
                onSelect={setBulkEditDepartmentIds}
                multiSelect
                getId={(d) => d.value}
                getLabel={(d) => d.label}
                placeholder="Select departments..."
                showClearAction
                clearActionLabel="Clear All"
                searchPlaceholder="Search departments..."
                emptyMessage="No departments found."
                groupHeading="Departments"
                hideSelectedChips={false}
                showClearAll
              />
            )}
          </div>
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
            artifactName="Cohorts"
            parseCsvAction={parseCsvAction}
            onSave={async (items) => {
              if (!createCohortAction) throw new Error("Create action not available");
              const cohorts = items.map((item) => ({
                name: item.name as string | undefined,
                description: item.description as string | undefined,
                is_inactive: item.is_inactive as boolean | undefined,
                departments: item.departments as string[] | undefined,
                simulations: item.simulations as string[] | undefined,
                profiles: item.profiles as string[] | undefined,
              }));
              return createCohortAction({ body: { cohorts } } as CreateCohortIn);
            }}
          />
        )}

      </div>
    </TooltipProvider>
  );
}
