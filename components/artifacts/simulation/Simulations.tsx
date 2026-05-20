/**
 * Simulations.tsx
 * Used to display the simulations page with the new unified simulation playground.
 * Server-side filtering with nuqs URL-backed state.
 * @AshokSaravanan222 & @siladiea
 * 06/07/2025
 */
"use client";
import { AlertCircle, Check, CheckCircle, Copy, Edit, Eye, FileSpreadsheet, Loader2, Pencil, Search, Sparkles, Trash2, Users, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { parseAsArrayOf, parseAsBoolean, parseAsString, useQueryState } from "nuqs";
import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import type {
  DeleteSimulationIn,
  DeleteSimulationOut,
  DuplicateSimulationIn,
  DuplicateSimulationOut,
  CreateSimulationIn,
  CreateSimulationOut,
  UpdateSimulationIn,
  UpdateSimulationOut,
  SimulationsListOut,
  SimulationsListBody,
} from "@/app/(main)/training/simulations/page";
import { useArtifactGhosts, type Ghost } from "@/hooks/use-artifact-ghosts";
import { ackOperation } from "@/lib/api/ack";
import BulkImport, { type ImportFieldDef, type ParseCsvResult } from "@/components/common/BulkImport";
import { GenericPicker } from "@/components/common/forms/GenericPicker";
import { BulkDeleteDialog } from "@/components/common/forms/BulkDeleteDialog";
import { BulkEditDialog } from "@/components/common/forms/BulkEditDialog";
import { BulkEditFlagField } from "@/components/common/forms/BulkEditFlagField";
import { useSimulationAi } from "@/hooks/use-simulation-ai";
import { useColumnVisibility } from "@/hooks/use-column-visibility";
import { DataTablePagination } from "@/components/common/table/DataTablePagination";
import { DataTableViewOptions } from "@/components/common/table/DataTableViewOptions";
import { ThreePickerFilters } from "@/components/common/table/ThreePickerFilters";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";

export interface SimulationsProps {
  // Server-provided data (for server-side rendering)
  listData: SimulationsListOut;
  // SSR column visibility from cookie
  initialColumnVisibility?: VisibilityState;
  // Server actions (replaces useMutation)
  duplicateSimulationAction?: (
    input: DuplicateSimulationIn,
  ) => Promise<DuplicateSimulationOut>;
  deleteSimulationAction?: (
    input: DeleteSimulationIn,
  ) => Promise<DeleteSimulationOut>;
  createSimulationAction?: (input: CreateSimulationIn) => Promise<CreateSimulationOut>;
  updateSimulationAction?: (input: UpdateSimulationIn) => Promise<UpdateSimulationOut>;
  parseCsvAction?: (formData: FormData) => Promise<ParseCsvResult>;
  /** The body the page used for its SSR ``/simulation/search`` call.
   *  Forwarded as the filter envelope on bulk delete/update calls
   *  when the user is in ``selectAll=1`` mode — the server resolves
   *  matching rows directly, no client-side enumeration. */
  currentSearchBody?: SimulationsListBody;
  importFields?: ImportFieldDef[];
  // Server-side pagination/filtering state
  pageIndex: number;
  pageSize: number;
  totalCount: number;
  scenarioSearch: string;
  cohortSearch: string;
  departmentSearch: string;
  flagSearch: string;
}

export function Simulations({
  listData: serverListData,
  initialColumnVisibility,
  duplicateSimulationAction,
  deleteSimulationAction,
  createSimulationAction,
  updateSimulationAction,
  parseCsvAction,
  currentSearchBody,
  importFields,
  pageIndex,
  pageSize,
  totalCount,
  scenarioSearch,
  cohortSearch,
  departmentSearch,
  flagSearch,
}: SimulationsProps) {
  const router = useRouter();
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
  // updates skip the RSC re-fetch burst.
  const [selectedSimulationIds, setSelectedSimulationIds] = useQueryState(
    "selectedIds",
    parseAsArrayOf(parseAsString).withDefault([]).withOptions({ shallow: true }),
  );
  const [selectAllMatching, setSelectAllMatching] = useQueryState(
    "selectAll",
    parseAsBoolean.withDefault(false).withOptions({ shallow: true }),
  );
  const [excludedSimulationIds, setExcludedSimulationIds] = useQueryState(
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
  const [bulkEditPracticeMode, setBulkEditPracticeMode] = useState<boolean | null>(null);
  const [bulkEditDepartmentIds, setBulkEditDepartmentIds] = useState<string[] | null>(null);

  useSimulationAi({
    onComplete: () => router.refresh(),
  });

  // Debounce refs
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scenarioSearchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cohortSearchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const departmentSearchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flagSearchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Local search state (for immediate UI feedback while debouncing)
  const [localSearch, setLocalSearch] = useState(searchParams.get("search") ?? "");
  const [_localFlagSearch, setLocalFlagSearch] = useState(flagSearch);

  // URL parameter update helper
  const updateSimulationsParams = useCallback(
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
  const [columnVisibility, setColumnVisibility] = useColumnVisibility("simulations", initialColumnVisibility);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>(() => {
    // Initialize from URL params
    const filters: ColumnFiltersState = [];
    const scenarioIds = searchParams.getAll("scenarioIds");
    if (scenarioIds.length > 0) filters.push({ id: "scenario_ids", value: scenarioIds });
    const cohortIds = searchParams.getAll("cohortIds");
    if (cohortIds.length > 0) filters.push({ id: "cohort_ids", value: cohortIds });
    const departmentIds = searchParams.getAll("departmentIds");
    if (departmentIds.length > 0) filters.push({ id: "departments", value: departmentIds });
    return filters;
  });
  const [sorting, setSorting] = useState<SortingState>([
    { id: "updated_at", desc: true },
  ]);

  // Use server-provided data directly
  const simulationsData = serverListData;

  // SSR-seeded base list. The audit-driven ghost hook layers
  // create/update/delete/duplicate lifecycle on top — committed rows
  // get merged into ``mergedSimulations`` directly so the table stays
  // current without a ``router.refresh()`` (which would re-burst the
  // page's SSR fetches — see GenerationPanel handleSend rationale).
  const baseSimulations = useMemo(
    () => simulationsData?.simulations || [],
    [simulationsData?.simulations],
  );

  const {
    ghosts: simulationGhosts,
    mergedRows: mergedSimulations,
    ack: ackSimulationGhost,
    drop: _dropSimulationGhost,
  } = useArtifactGhosts({
    artifactType: "simulation",
    // All four CRUD ops the LLM might invoke or the user might trigger
    // from the toolbar/card. Each maps to a distinct ghost visual in
    // ``renderSimulationCard`` (creating / updating / deleting /
    // duplicating skeleton + pending soft state). Without
    // ``duplicate`` here the LLM's duplicate tool dispatch fires
    // audit events that nothing is subscribed to → no ghost.
    ops: ["create", "update", "delete", "duplicate"],
    baseRows: baseSimulations,
    rowKey: "simulation_id",
    // ``simulations`` plural is auto-derived as ``simulation`` + "s" —
    // kept explicit here for clarity; matches the field name the
    // create / duplicate / update impls now include on their
    // responses (see ``hydrate_simulation_list_rows``). The hook
    // reads ``output.simulations`` from the audit ``.completed``
    // payload to materialize new/changed rows directly — no SSR
    // refresh needed.
    artifactPlural: "simulations",
  });

  // Downstream code reads ``simulations`` — keep that name to
  // minimize diff. The active list is the merged view (base +
  // create overlays − delete overlays).
  const simulations = mergedSimulations;

  // Unified ack: live ghosts → hook; persistent pending → ackOperation+refresh.
  const handleSimulationAck = useCallback(
    async (callId: string, accept: boolean, op: Ghost<unknown>["op"]) => {
      const live = simulationGhosts.find((g) => g.callId === callId);
      if (live) {
        await ackSimulationGhost(callId, accept);
        return;
      }
      try {
        await ackOperation({
          artifact: "simulation",
          operation: op,
          idempotencyKey: callId,
          accept,
        });
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Ack failed");
      }
    },
    [simulationGhosts, ackSimulationGhost, router],
  );

  // ---- Selection helpers ----------------------------------------
  // ``isSelected`` is the single read predicate every row uses; it
  // dispatches between explicit-id and all-matching modes so
  // downstream code never needs to branch. ``selectedCount`` mirrors
  // that — under all-matching it's ``totalCount - excludedIds.length``.

  const totalMatchingCount = simulationsData?.total_count ?? 0;

  const isSelected = useCallback(
    (id: string | null | undefined) => {
      if (!id) return false;
      return selectAllMatching
        ? !excludedSimulationIds.includes(id)
        : selectedSimulationIds.includes(id);
    },
    [selectAllMatching, excludedSimulationIds, selectedSimulationIds],
  );

  const selectedCount = selectAllMatching
    ? Math.max(0, totalMatchingCount - excludedSimulationIds.length)
    : selectedSimulationIds.length;

  const selectedSimulations = useMemo(() => {
    return simulations.filter((s) => s.simulation_id && isSelected(s.simulation_id));
  }, [simulations, isSelected]);

  const deletableSimulations = useMemo(() => {
    return selectedSimulations.filter((s) => s.can_delete);
  }, [selectedSimulations]);

  const nonDeletableSimulations = useMemo(() => {
    return selectedSimulations.filter((s) => !s.can_delete);
  }, [selectedSimulations]);

  const editableSimulations = useMemo(() => {
    return selectedSimulations.filter((s) => s.can_edit);
  }, [selectedSimulations]);

  // Check if all simulations on the current page are selected.
  // Under all-matching mode every loaded row whose id isn't in
  // ``excludedSimulationIds`` is implicitly selected, so the predicate
  // reduces to "no excluded rows on the current page."
  const allPageSelected = useMemo(() => {
    const pageIds = simulations.filter((s) => s.simulation_id).map((s) => s.simulation_id!);
    if (pageIds.length === 0) return false;
    return pageIds.every((id) => isSelected(id));
  }, [simulations, isSelected]);

  // Whether there ARE more matching rows than what's loaded on this
  // page — used to decide whether to surface the "Select all N
  // matching" affordance after the user selects the page.
  const hasMoreThanCurrentPage = totalMatchingCount > simulations.length;

  // Toggle selection for a single simulation. Under all-matching mode
  // we toggle membership in excludedSimulationIds (deselect ⇒ add to
  // exclusions, re-select ⇒ remove). Under explicit mode it's the
  // straight selectedSimulationIds toggle.
  const toggleSelection = useCallback((simulationId: string) => {
    if (selectAllMatching) {
      void setExcludedSimulationIds((prev) =>
        prev.includes(simulationId)
          ? prev.filter((id) => id !== simulationId)
          : [...prev, simulationId],
      );
    } else {
      void setSelectedSimulationIds((prev) =>
        prev.includes(simulationId)
          ? prev.filter((id) => id !== simulationId)
          : [...prev, simulationId],
      );
    }
  }, [selectAllMatching, setExcludedSimulationIds, setSelectedSimulationIds]);

  const clearSelection = useCallback(() => {
    void setSelectedSimulationIds([]);
    void setSelectAllMatching(false);
    void setExcludedSimulationIds([]);
  }, [setSelectedSimulationIds, setSelectAllMatching, setExcludedSimulationIds]);

  const selectAllOnPage = useCallback(() => {
    const pageIds = simulations.filter((s) => s.simulation_id).map((s) => s.simulation_id!);
    void setSelectAllMatching(false);
    void setExcludedSimulationIds([]);
    void setSelectedSimulationIds((prev) => {
      const combined = new Set([...prev, ...pageIds]);
      return Array.from(combined);
    });
  }, [simulations, setSelectAllMatching, setExcludedSimulationIds, setSelectedSimulationIds]);

  /** Promote the current page-only selection into "all matching
   *  filter" mode. Clears explicit ids and exclusions — the all-
   *  matching mode is the canonical truth from this point. */
  const selectAllMatchingNow = useCallback(() => {
    void setSelectedSimulationIds([]);
    void setExcludedSimulationIds([]);
    void setSelectAllMatching(true);
  }, [setSelectedSimulationIds, setExcludedSimulationIds, setSelectAllMatching]);

  // Create scenario mapping dict client-side for lookups (from scenarios array)
  const scenarioMapping = useMemo(() => {
    const scenarios = simulationsData?.scenarios || [];
    return scenarios.reduce((acc, scenario) => {
      if (scenario.scenario_id) {
        acc[scenario.scenario_id] = scenario;
      }
      return acc;
    }, {} as Record<string, typeof scenarios[0]>);
  }, [simulationsData?.scenarios]);

  // Use server-provided facet options directly (filtered by search term server-side)
  const scenarioOptions = useMemo(
    () =>
      (simulationsData?.scenario_filter?.options || [])
        .map((opt) => ({
          value: opt.id as string,
          label: opt.name as string,
          count: opt.count ?? undefined,
        }))
        .filter((opt) => opt.value && opt.label),
    [simulationsData?.scenario_filter],
  );
  const cohortOptions = useMemo(
    () =>
      (simulationsData?.cohort_filter?.options || [])
        .map((opt) => ({
          value: opt.id as string,
          label: opt.name as string,
          count: opt.count ?? undefined,
        }))
        .filter((opt) => opt.value && opt.label),
    [simulationsData?.cohort_filter],
  );
  const departmentOptions = useMemo(
    () =>
      (simulationsData?.department_filter?.options || [])
        .map((opt) => ({
          value: opt.id as string,
          label: opt.name as string,
          count: opt.count ?? undefined,
        }))
        .filter((opt) => opt.value && opt.label),
    [simulationsData?.department_filter],
  );
  const flagOptions = useMemo(() => {
    return (simulationsData?.flag_filter?.options || [])
      .filter((opt): opt is typeof opt & { id: string; name: string } => !!opt.id && !!opt.name)
      .map((opt) => ({ id: opt.id!, name: opt.name!, type: opt.type ?? null }));
  }, [simulationsData?.flag_filter]);

  // Define table columns inline
  const columns: ColumnDef<(typeof simulations)[number]>[] = useMemo(
    () => [
      {
        accessorKey: "name",
        header: "Name",
      },
      // Hidden faceting column for Scenarios (array of IDs)
      {
        id: "scenario_ids",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: (typeof simulations)[number]) => row.scenario_ids ?? [],
        filterFn: (row, _id, value: string[]) => {
          const rowIds = (row.getValue("scenario_ids") as string[]) ?? [];
          if (value.length === 0) return true;
          if (rowIds.length === 0) return false;
          return value.some((v) => rowIds.includes(v));
        },
      },
      // Hidden faceting column for Cohorts (array of IDs)
      {
        id: "cohort_ids",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: (typeof simulations)[number]) => row.cohort_ids ?? [],
        filterFn: (row, _id, value: string[]) => {
          const rowIds = (row.getValue("cohort_ids") as string[]) ?? [];
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
        accessorFn: (row: (typeof simulations)[number]) =>
          row.department_ids ?? [],
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
          if (!row.original.updated_at) return null;
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
        accessorFn: (row: (typeof simulations)[number]) => row.generated ?? false,
      },
      {
        id: "practice_badge",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: (typeof simulations)[number]) => row.practice_simulation ?? false,
      },
      {
        id: "status_badge",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: (typeof simulations)[number]) => row.is_inactive ?? false,
      },
      {
        id: "card_description",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: (typeof simulations)[number]) => row.description ?? "",
      },
      {
        id: "card_cohorts",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: (typeof simulations)[number]) => row.num_cohorts ?? 0,
      },
      {
        id: "scenario_dots",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: (typeof simulations)[number]) => row.scenario_ids ?? [],
      },
    ],
    [],
  );

  // Page count for manual pagination
  const pageCount = Math.ceil(totalCount / pageSize);

  // Create table instance with manual pagination/filtering
  const table = useReactTable({
    data: simulations,
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
      const scenarioFilter = newFilters.find((f) => f.id === "scenario_ids");
      const cohortFilter = newFilters.find((f) => f.id === "cohort_ids");
      const departmentFilter = newFilters.find((f) => f.id === "departments");
      updateSimulationsParams({
        scenarioIds: (scenarioFilter?.value as string[] | undefined) ?? null,
        cohortIds: (cohortFilter?.value as string[] | undefined) ?? null,
        departmentIds: (departmentFilter?.value as string[] | undefined) ?? null,
      });
    },
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: (updater) => {
      const current = { pageIndex, pageSize };
      const next = typeof updater === "function" ? updater(current) : updater;
      updateSimulationsParams({
        page: next.pageIndex > 0 ? String(next.pageIndex) : null,
        pageSize: next.pageSize !== 12 ? String(next.pageSize) : null,
      });
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  // Memoize table rows. Including ``simulations`` itself (not just
  // ``simulations.length``) so update events that mutate row content
  // but not list cardinality still invalidate the memo. ``simulations``
  // is stabilized upstream by ``mergedSimulations``'s useMemo, so a
  // new reference only appears when ``state.added``/``replaced``/
  // ``hiddenIds`` actually change — no spurious recomputes.
  const sortingKey = JSON.stringify(sorting);
  const tableRows = useMemo(() => {
    return table.getRowModel().rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortingKey, simulations, pageIndex, pageSize]);

  // Debounced search handler
  const handleSearchChange = useCallback(
    (value: string) => {
      setLocalSearch(value);
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
      searchDebounceRef.current = setTimeout(() => {
        updateSimulationsParams({ search: value || null });
      }, 500);
    },
    [updateSimulationsParams],
  );

  const handleSearchBlur = useCallback(() => {
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
      searchDebounceRef.current = null;
    }
    updateSimulationsParams({ search: localSearch || null });
  }, [localSearch, updateSimulationsParams]);

  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        if (searchDebounceRef.current) {
          clearTimeout(searchDebounceRef.current);
          searchDebounceRef.current = null;
        }
        updateSimulationsParams({ search: localSearch || null });
      }
    },
    [localSearch, updateSimulationsParams],
  );

  // Filter option search handlers (300ms debounce)
  const handleScenarioSearchChange = useCallback(
    (term: string) => {
      if (scenarioSearchDebounceRef.current) clearTimeout(scenarioSearchDebounceRef.current);
      scenarioSearchDebounceRef.current = setTimeout(() => {
        updateSimulationsParams({ scenarioSearch: term || null });
      }, 300);
    },
    [updateSimulationsParams],
  );

  const handleCohortSearchChange = useCallback(
    (term: string) => {
      if (cohortSearchDebounceRef.current) clearTimeout(cohortSearchDebounceRef.current);
      cohortSearchDebounceRef.current = setTimeout(() => {
        updateSimulationsParams({ cohortSearch: term || null });
      }, 300);
    },
    [updateSimulationsParams],
  );

  const handleDepartmentSearchChange = useCallback(
    (term: string) => {
      if (departmentSearchDebounceRef.current) clearTimeout(departmentSearchDebounceRef.current);
      departmentSearchDebounceRef.current = setTimeout(() => {
        updateSimulationsParams({ departmentSearch: term || null });
      }, 300);
    },
    [updateSimulationsParams],
  );

  const _handleFlagSearchChange = useCallback(
    (term: string) => {
      setLocalFlagSearch(term);
      if (flagSearchTimeoutRef.current) clearTimeout(flagSearchTimeoutRef.current);
      flagSearchTimeoutRef.current = setTimeout(() => {
        updateSimulationsParams({ flagSearch: term || null });
      }, 300);
    },
    [updateSimulationsParams],
  );

  // Reset all filters
  const handleResetFilters = useCallback(() => {
    setColumnFilters([]);
    setLocalSearch("");
    setLocalFlagSearch("");
    updateSimulationsParams({
      search: null,
      scenarioIds: null,
      cohortIds: null,
      departmentIds: null,
      scenarioSearch: null,
      cohortSearch: null,
      departmentSearch: null,
      flagSearch: null,
      page: null,
    });
  }, [updateSimulationsParams]);

  const handleDelete = async () => {
    if (!deleteItem || !deleteSimulationAction) return;

    setIsDeleting(true);
    try {
      await deleteSimulationAction({ body: { simulation_ids: [deleteItem.id], accept: true } });
      toast.success("Simulation deleted successfully");
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to delete simulation";
      const cleanMsg = msg.replace(/^\d{3}\s*/, "");
      toast.error(cleanMsg || "Failed to delete simulation");
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
    // converge on the same ``deleteSimulationAction`` call shape; the
    // body just differs.
    if (!deleteSimulationAction) return;
    if (!selectAllMatching && deletableSimulations.length === 0) return;

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
            excluded_ids: excludedSimulationIds,
            ...(currentSearchBody ?? {}),
            accept: true,
          }
        : {
            simulation_ids: deletableSimulations.map((s) => s.simulation_id!),
            accept: true,
          };

      const result = await deleteSimulationAction({ body } as DeleteSimulationIn);

      // Per-row results from the server: success entries are actual
      // deletions, failures are soft-skipped rows (no permission /
      // not found). Toast reflects both counts so the user knows
      // some rows were skipped without inspecting the receipt.
      const results = (result as DeleteSimulationOut).results ?? [];
      const successCount = results.filter((r) => r.success).length;
      const skippedCount = results.length - successCount;
      if (skippedCount > 0) {
        toast.success(
          `${successCount} simulation(s) deleted, ${skippedCount} skipped`,
        );
      } else {
        toast.success(`${successCount} simulation(s) deleted successfully`);
      }
      clearSelection();
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to delete simulations";
      const cleanMsg = msg.replace(/^\d{3}\s*/, "");
      toast.error(cleanMsg || "Failed to delete simulations");
    } finally {
      setIsBulkDeleting(false);
      setShowBulkDeleteDialog(false);
    }
  };

  const handleBulkEdit = async () => {
    if (!updateSimulationAction) return;
    if (!selectAllMatching && editableSimulations.length === 0) return;

    const hasActiveChange = bulkEditActiveStatus !== null;
    const hasPracticeChange = bulkEditPracticeMode !== null;
    const hasDeptChange = bulkEditDepartmentIds !== null;
    const hasAnyFlagChange = hasActiveChange || hasPracticeChange;

    if (!hasAnyFlagChange && !hasDeptChange) {
      toast.error("No changes selected");
      return;
    }

    // Find flag IDs by type from lazy-loaded flagOptions
    const activeFlagId = flagOptions.find((f) => f.type === "simulation_active")?.id;
    const practiceFlagId = flagOptions.find((f) => f.type === "practice")?.id;

    setIsBulkEditing(true);
    try {
      // Shared change set used by both paths. Under all-matching the
      // server clones this per resolved row (stamping each id);
      // under explicit we clone client-side, preserving per-row flag
      // state for fields we aren't toggling.
      const sharedPatch = {
        ...(hasDeptChange && { department_ids: bulkEditDepartmentIds }),
      };

      let body: UpdateSimulationIn["body"];
      if (selectAllMatching) {
        // All-matching: the server can't preserve per-row flag state
        // (it doesn't know what each row's existing flags are), so
        // active/practice toggles become "set to this value across
        // all matching rows" — the same semantic as a manual sweep.
        let flag_ids: string[] | undefined;
        if (hasAnyFlagChange) {
          flag_ids = [];
          if (bulkEditActiveStatus && activeFlagId) flag_ids.push(activeFlagId);
          if (bulkEditPracticeMode && practiceFlagId) flag_ids.push(practiceFlagId);
        }
        body = {
          all: true,
          excluded_ids: excludedSimulationIds,
          ...(currentSearchBody ?? {}),
          patch: {
            ...sharedPatch,
            ...(hasAnyFlagChange && { flag_ids }),
          },
          accept: true,
        } as UpdateSimulationIn["body"];
      } else {
        // Explicit: clone the patch per-row, preserving each row's
        // existing flag state for flags we aren't toggling.
        const items = editableSimulations.map((sim) => {
          let flagIds: string[] | undefined;
          if (hasAnyFlagChange) {
            const isActive = hasActiveChange ? bulkEditActiveStatus : !sim.is_inactive;
            const isPractice = hasPracticeChange ? bulkEditPracticeMode : !!sim.practice_simulation;
            flagIds = [];
            if (isActive && activeFlagId) flagIds.push(activeFlagId);
            if (isPractice && practiceFlagId) flagIds.push(practiceFlagId);
          }
          return {
            id: sim.simulation_id!,
            ...sharedPatch,
            ...(hasAnyFlagChange && { flag_ids: flagIds }),
          };
        });
        body = { simulations: items } as UpdateSimulationIn["body"];
      }

      const result = await updateSimulationAction({ body } as UpdateSimulationIn);

      // Per-row results — same soft-skip pattern as bulk delete.
      const results = (result as UpdateSimulationOut).results ?? [];
      const successCount = results.filter((r) => r.success).length;
      const skippedCount = results.length - successCount;
      if (skippedCount > 0) {
        toast.success(
          `${successCount} simulation(s) updated, ${skippedCount} skipped`,
        );
      } else {
        toast.success(`${successCount} simulation(s) updated successfully`);
      }
      clearSelection();
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to update simulations";
      const cleanMsg = msg.replace(/^\d{3}\s*/, "");
      toast.error(cleanMsg || "Failed to update simulations");
    } finally {
      setIsBulkEditing(false);
      setShowBulkEditDialog(false);
    }
  };

  const openBulkEditDialog = () => {
    // Reset form state
    setBulkEditActiveStatus(null);
    setBulkEditPracticeMode(null);
    setBulkEditDepartmentIds(null);

    setShowBulkEditDialog(true);
  };

  const handleDeleteClick = (id: string, name: string) => {
    setDeleteItem({ id, name });
    setShowDeleteDialog(true);
  };


  const handleDuplicate = async (
    simulationId: string,
    _simulationName: string,
  ) => {
    if (!duplicateSimulationAction) return;

    setIsDuplicating(simulationId);
    try {
      await duplicateSimulationAction({ body: { simulation_id: simulationId, accept: true } });
      toast.success("Simulation duplicated successfully");
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to duplicate simulation";
      const cleanMsg = msg.replace(/^\d{3}\s*/, "");
      toast.error(cleanMsg || "Failed to duplicate simulation");
      if (msg.startsWith("404")) {
        router.refresh();
      }
    } finally {
      setIsDuplicating(null);
    }
  };

  const renderSimulationCard = (
    simulation: (typeof simulations)[number],
    ghost?: Ghost<(typeof simulations)[number]>,
  ) => {
    // Same card visual for real rows and in-flight ghosts — single
    // source of truth for layout, dimensions, badges. Ghost mode
    // swaps action buttons for a status badge (and Accept/Reject for
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

    if (!isGhost && !simulation.simulation_id) return null;

    const isSelected = !isGhost && simulation.simulation_id
      ? selectedSimulationIds.includes(simulation.simulation_id)
      : false;

    const handleCardClick = (e: React.MouseEvent) => {
      // Don't toggle selection if clicking action buttons or when
      // rendering as a ghost (no real id to select yet).
      if (isGhost) return;
      if ((e.target as HTMLElement).closest("[data-action-button]")) return;
      if (simulation.simulation_id) {
        toggleSelection(simulation.simulation_id);
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
      key={simulation.simulation_id || ghost?.callId}
      aria-label={simulation.name || (isGhost ? "Generating" : undefined)}
      data-testid={isGhost ? "simulation-ghost-card" : "simulation-card"}
      data-simulation-id={simulation.simulation_id}
      data-ghost-state={ghostState}
      className={`group relative flex flex-col h-full hover:shadow-md transition-all ${
        isGhost ? "" : "cursor-pointer"
      } ${ghostBorderClass} ${isSelected ? "ring-2 ring-primary" : ""}`}
      role="gridcell"
      aria-selected={isSelected}
      aria-busy={inFlight ? true : undefined}
      onClick={handleCardClick}
    >
      <CardHeader className="pb-3">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="flex-1 min-w-0">
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
                    checked={isSelected}
                    onCheckedChange={() => {
                      if (simulation.simulation_id) toggleSelection(simulation.simulation_id);
                    }}
                    className="rounded-full h-5 w-5"
                    aria-label={`Select simulation ${simulation.name || "Unnamed"}`}
                  />
                </div>
              )}
              {/* In-flight ghost without a streamed name yet → spinner. */}
              {inFlight && !simulation.name && (
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
              )}
              <CardTitle className="text-lg truncate">
                {simulation.name || (isGhost ? "Generating…" : "")}
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
            {((columnVisibility.ai_badge !== false && simulation.generated) || (columnVisibility.practice_badge !== false && simulation.practice_simulation) || (columnVisibility.status_badge !== false && simulation.is_inactive)) && (
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {columnVisibility.ai_badge !== false && simulation.generated && (
                <Badge variant="default">
                  <Sparkles className="h-3 w-3 mr-1" />
                  {simulation.mcp ? "MCP" : "AI"}
                </Badge>
              )}
              {columnVisibility.practice_badge !== false && simulation.practice_simulation && (
                <Badge variant="outline" className="text-xs">
                  Practice
                </Badge>
              )}
              {columnVisibility.status_badge !== false && simulation.is_inactive && (
                <Badge variant="secondary">Inactive</Badge>
              )}
            </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1" data-action-button>
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
                  onClick={() => handleSimulationAck(ghost.callId, true, ghost.op)}
                >
                  <Check className="mr-1 h-3.5 w-3.5" />
                  Accept
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={() => handleSimulationAck(ghost.callId, false, ghost.op)}
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
            {!isGhost && simulation.simulation_id && (<>{simulation.can_edit ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    data-testid="btn-edit-simulation"
                    className="h-9 px-3"
                  >
                    <Link
                      href={`/training/simulations/${simulation.simulation_id}`}
                      prefetch={false}
                      aria-label={`Edit ${simulation.name || "Simulation"}`}
                    >
                      <Edit className="h-4 w-4 md:mr-0 mr-2" />
                      <span className="md:hidden">Edit</span>
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
                    data-testid="btn-view-simulation"
                    className="h-9 px-3"
                  >
                    <Link
                      href={`/training/simulations/${simulation.simulation_id}`}
                      prefetch={false}
                      aria-label={`View ${simulation.name}`}
                    >
                      <Eye className="h-4 w-4 md:mr-0 mr-2" />
                      <span className="md:hidden">View</span>
                    </Link>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>View</TooltipContent>
              </Tooltip>
            )}
            {simulation.can_duplicate && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    data-testid="btn-duplicate-simulation"
                    onClick={() =>
                      simulation.simulation_id &&
                      handleDuplicate(
                        simulation.simulation_id,
                        simulation.name || "Simulation"
                      )
                    }
                    disabled={
                      isDuplicating === simulation.simulation_id ||
                      !simulation.simulation_id
                    }
                    aria-busy={
                      isDuplicating === simulation.simulation_id
                        ? true
                        : undefined
                    }
                    aria-label={`Duplicate ${simulation.name || "Simulation"}`}
                    className="h-9 px-3"
                  >
                    {isDuplicating === simulation.simulation_id ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent md:mr-0 mr-2" />
                    ) : (
                      <Copy className="h-4 w-4 md:mr-0 mr-2" />
                    )}
                    <span className="md:hidden">
                      {isDuplicating === simulation.simulation_id
                        ? "Duplicating..."
                        : "Duplicate"}
                    </span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Duplicate</TooltipContent>
              </Tooltip>
            )}
            {simulation.can_delete && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    data-testid="btn-delete-simulation"
                    onClick={() =>
                      simulation.simulation_id &&
                      handleDeleteClick(
                        simulation.simulation_id,
                        simulation.name || "Simulation"
                      )
                    }
                    aria-label={`Delete ${simulation.name || "Simulation"}`}
                    className="h-9 px-3"
                  >
                    <Trash2 className="h-4 w-4 md:mr-0 mr-2" />
                    <span className="md:hidden">Delete</span>
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
            {simulation.description || "No description available"}
          </p>
        )}
        {(columnVisibility.card_cohorts !== false || columnVisibility.scenario_dots !== false) && (
          <div className="flex items-center gap-1.5 mt-3 text-xs text-muted-foreground">
            {columnVisibility.card_cohorts !== false && (
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {simulation.num_cohorts}{" "}
                {simulation.num_cohorts === 1 ? "cohort" : "cohorts"}
              </span>
            )}
            <div className="flex-grow" />
            {columnVisibility.scenario_dots !== false && simulation.scenario_ids && simulation.scenario_ids.length > 0 && (
              <div className="flex items-center gap-1">
                {simulation.scenario_ids.map((scenarioId) => {
                  const scenario = scenarioMapping[scenarioId];
                  if (!scenario) return null;

                  const firstPersonaId = scenario.persona_ids?.[0];
                  const persona = firstPersonaId && scenario.persona_mapping
                    ? scenario.persona_mapping.find(p => String(p.persona_id) === String(firstPersonaId))
                    : null;
                  const personaColor = persona?.color || "#9CA3AF";

                  return (
                    <Tooltip key={scenarioId}>
                      <TooltipTrigger asChild>
                        <div
                          className="w-2 h-2 rounded-full cursor-pointer"
                          style={{
                            backgroundColor: personaColor,
                          }}
                          aria-label={scenario.name || undefined}
                        />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{scenario.name}</p>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
    );
  };

  // Get column references for toolbar
  const scenarioColumn = table.getColumn("scenario_ids");
  const cohortColumn = table.getColumn("cohort_ids");
  const departmentsColumn = table.getColumn("departments");
  const isFiltered = columnFilters.length > 0 || localSearch.length > 0;

  return (
    <TooltipProvider>
      <div className="space-y-6" data-page="simulations-index">
        <div className="space-y-4">
          {/* Toolbar — swaps between filter bar and selection action bar */}
          {selectedCount > 0 ? (
            <div className="space-y-2" data-testid="simulations-toolbar">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {deleteSimulationAction && (
                  <Button
                    variant="destructive"
                    size="sm"
                    className="h-8"
                    onClick={() => setShowBulkDeleteDialog(true)}
                    disabled={!selectAllMatching && deletableSimulations.length === 0}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    {selectAllMatching
                      ? `Delete ${selectedCount} matching`
                      : `Delete ${deletableSimulations.length} of ${selectedCount}`}
                  </Button>
                )}
                {updateSimulationAction && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8"
                    onClick={openBulkEditDialog}
                    disabled={!selectAllMatching && editableSimulations.length === 0}
                  >
                    <Pencil className="mr-2 h-4 w-4" />
                    {selectAllMatching
                      ? `Edit ${selectedCount} matching`
                      : `Edit ${editableSimulations.length} of ${selectedCount}`}
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
              <DataTableViewOptions table={table} hiddenColumns={["name", "scenario_ids", "cohort_ids", "departments", "updated_at"]} />
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
                  All {simulations.length} on this page selected.
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
                  All {selectedCount} matching simulations selected
                  {excludedSimulationIds.length > 0 && ` (${excludedSimulationIds.length} excluded)`}.
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
            data-testid="simulations-toolbar"
          >
            <div className="flex flex-col md:flex-row md:flex-1 md:items-center md:space-x-2 gap-2 md:gap-0">
              <div className="w-full md:w-auto">
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    data-testid="simulations-search"
                    placeholder="Search simulations..."
                    value={localSearch}
                    onChange={(event) => handleSearchChange(event.target.value)}
                    onBlur={handleSearchBlur}
                    onKeyDown={handleSearchKeyDown}
                    className="h-8 w-full md:w-[150px] lg:w-[250px] pl-8"
                    aria-label="Search simulations by name"
                    aria-controls="simulations-grid"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2 flex-wrap">
                <ThreePickerFilters
                  slots={[
                    {
                      column: scenarioColumn,
                      title: "Scenario",
                      options: scenarioOptions,
                      isServerDriven: true,
                      onSearchChange: handleScenarioSearchChange,
                      searchValue: scenarioSearch,
                    },
                    {
                      column: cohortColumn,
                      title: "Cohort",
                      options: cohortOptions,
                      isServerDriven: true,
                      onSearchChange: handleCohortSearchChange,
                      searchValue: cohortSearch,
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
              <DataTableViewOptions table={table} hiddenColumns={["name", "scenario_ids", "cohort_ids", "departments", "updated_at"]} />
            </div>
          </div>
          )}

          {/* Cards Grid — container-query driven; scales with content
              area width.

              Ghost cards from in-flight audited writes (create/duplicate/
              update/delete in non-terminal states) are prepended — same
              ``renderSimulationCard`` so layout, dimensions, and visual
              language match exactly. Once a ghost commits, its hydrated
              row is in ``mergedRows`` (via ``state.added``) AND the
              ghost's ``state`` flips to "committed" — we filter those
              out so the real row replaces the ghost in place without a
              duplicate frame. */}
          <div className="@container">
            <div
              className="grid gap-4 @2xl:grid-cols-2 @5xl:grid-cols-3 @7xl:grid-cols-4"
              role="grid"
              aria-label="simulations grid"
              data-testid="simulations-grid"
            >
              {simulationGhosts
                .filter((g) => g.state !== "committed" && g.state !== "accepted")
                .map((g) => {
                  // For update/delete, ``before`` is the snapshot lookup
                  // from baseRows (existing row) — gives us name/desc
                  // so the ghost card shows what's being deleted/updated.
                  // For create/duplicate, ``before`` is null and
                  // ``partial`` carries the streaming args.
                  const simulationShell = (g.before ?? g.partial) as (typeof simulations)[number];
                  return (
                    <div key={`ghost-${g.callId}`}>
                      {renderSimulationCard(simulationShell, g)}
                    </div>
                  );
                })}
              {tableRows.length ? (
                tableRows.map((row) => {
                  const simulation = row.original;
                  const key = simulation.simulation_id || `simulation-${row.id}`;
                  const persistentGhost: Ghost<(typeof simulations)[number]> | undefined =
                    simulation.pending_status === "pending" && simulation.pending_call_id
                      ? {
                          callId: simulation.pending_call_id,
                          op: (simulation.pending_operation as Ghost<(typeof simulations)[number]>["op"]) ?? "create",
                          state: "pending",
                          rowId: simulation.simulation_id ?? null,
                          partial: simulation as unknown as Ghost<(typeof simulations)[number]>["partial"],
                          before: simulation,
                          tool: null,
                          error: null,
                          arguments: {},
                        }
                      : undefined;
                  return <div key={key}>{renderSimulationCard(simulation, persistentGhost)}</div>;
                })
              ) : (
                simulationGhosts.length === 0 && (
                  <div className="col-span-full text-center py-8 text-muted-foreground">
                    No simulations match the current filters.
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
            aria-labelledby="delete-simulation-title"
            data-testid="dialog-delete-simulation"
          >
            <AlertDialogHeader>
              <AlertDialogTitle id="delete-simulation-title">
                Delete Simulation
              </AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete the simulation "
                {deleteItem?.name}
                "? This action cannot be undone.
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
          count={selectAllMatching ? selectedCount : deletableSimulations.length}
          entityLabel="simulation"
          entityLabelPlural="simulations"
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
                    {" "}simulations will be deleted server-side using the current filter.
                  </p>
                  {excludedSimulationIds.length > 0 && (
                    <p className="mt-1">
                      {excludedSimulationIds.length} explicitly excluded.
                    </p>
                  )}
                  <p className="mt-1">
                    Simulations you don't have permission to delete will be skipped automatically.
                  </p>
                </div>
              ) : (
                <>
                  {deletableSimulations.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-destructive mb-1">Will be deleted:</p>
                      <ul className="text-sm space-y-0.5">
                        {deletableSimulations.map((s) => (
                          <li key={s.simulation_id} className="flex items-center gap-1.5">
                            <Trash2 className="h-3 w-3 text-destructive flex-shrink-0" />
                            {s.name || "Unnamed Simulation"}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {nonDeletableSimulations.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-yellow-600 dark:text-yellow-500 mb-1">Cannot be deleted (in use by cohorts):</p>
                      <ul className="text-sm space-y-0.5">
                        {nonDeletableSimulations.map((s) => (
                          <li key={s.simulation_id} className="flex items-center gap-1.5 text-muted-foreground">
                            <CheckCircle className="h-3 w-3 text-yellow-600 dark:text-yellow-500 flex-shrink-0" />
                            {s.name || "Unnamed Simulation"}
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
          count={selectAllMatching ? selectedCount : editableSimulations.length}
          entityLabelPlural="simulations"
          isSaving={isBulkEditing}
          onSave={handleBulkEdit}
        >
          <BulkEditFlagField
            label="Active Status"
            value={bulkEditActiveStatus}
            onChange={setBulkEditActiveStatus}
          />

          <BulkEditFlagField
            label="Practice Mode"
            trueLabel="Enabled"
            falseLabel="Disabled"
            value={bulkEditPracticeMode}
            onChange={setBulkEditPracticeMode}
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
          artifactName="Simulations"
          parseCsvAction={parseCsvAction}
          onSave={async (items) => {
            if (!createSimulationAction) throw new Error("Create action not available");
            const simulations = items.map((item) => ({
              name: item.name as string | undefined,
              description: item.description as string | undefined,
              is_inactive: item.is_inactive as boolean | undefined,
              is_practice: item.is_practice as boolean | undefined,
              departments: item.departments as string[] | undefined,
              scenarios: item.scenarios as string[] | undefined,
            }));
            return createSimulationAction({ body: { simulations } } as CreateSimulationIn);
          }}
        />
      )}

      </div>
    </TooltipProvider>
  );
}
