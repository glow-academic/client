/**
 * Evals.tsx
 * Evals list component with card-based layout and server-side filtering
 * @AshokSaravanan222
 * 01/26/2025
 */
"use client";

import { AlertCircle, Check, Edit, Eye, Loader2, Pencil, Trash2, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { parseAsArrayOf, parseAsBoolean, parseAsString, useQueryState } from "nuqs";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import type {
  DeleteEvalIn,
  DeleteEvalOut,
  EvalsListOut,
  EvalsListBody,
  UpdateEvalIn,
  UpdateEvalOut,
} from "@/app/(main)/system/evals/page";
import { ThreePickerFilters } from "@/components/common/table/ThreePickerFilters";
import { DataTablePagination } from "@/components/common/table/DataTablePagination";
import { DataTableViewOptions } from "@/components/common/table/DataTableViewOptions";
import { useColumnVisibility } from "@/hooks/use-column-visibility";
import { BulkDeleteDialog } from "@/components/common/forms/BulkDeleteDialog";
import { BulkEditDialog } from "@/components/common/forms/BulkEditDialog";
import { BulkEditFlagField } from "@/components/common/forms/BulkEditFlagField";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Input } from "@/components/ui/input";
import { useEvalAi } from "@/hooks/use-eval-ai";
import { useArtifactGhosts, type Ghost } from "@/hooks/use-artifact-ghosts";
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

export interface EvalsProps {
  listData: EvalsListOut;
  // SSR column visibility from cookie
  initialColumnVisibility?: VisibilityState;
  deleteEvalAction?: (input: DeleteEvalIn) => Promise<DeleteEvalOut>;
  updateEvalAction?: (input: UpdateEvalIn) => Promise<UpdateEvalOut>;
  /** The body the page used for its SSR ``/eval/search`` call.
   *  Forwarded as flat filter fields on bulk delete/update calls when
   *  the user is in ``selectAll=1`` mode — the server resolves matching
   *  rows directly, no client-side enumeration. */
  currentSearchBody?: EvalsListBody;
  // Server-side pagination
  pageIndex: number;
  pageSize: number;
  totalCount: number;
  // Server-side filter search terms
  departmentSearch: string;
}

const EVALS_INITIAL_COLUMN_VISIBILITY: VisibilityState = {
  // Hidden faceting columns
  departments: false,
  model_ids: false,
  rubric_ids: false,
  updated_at: false,
  // Toggleable card sections
  num_runs: true,
  status_badge: true,
  card_description: true,
};

export default function Evals({
  listData: serverListData,
  initialColumnVisibility,
  deleteEvalAction,
  updateEvalAction,
  currentSearchBody,
  pageIndex,
  pageSize,
  totalCount,
  departmentSearch,
}: EvalsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEvalAi({
    onComplete: () => router.refresh(),
  });

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteItem, setDeleteItem] = useState<{
    id: string;
    name: string;
  } | null>(null);

  // Local search state for debouncing
  const [searchTerm, setSearchTerm] = useState(
    searchParams?.get("search") ?? ""
  );
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Table state — hidden faceting columns default to off
  const [rowSelection, setRowSelection] = useState({});
  const [columnVisibility, setColumnVisibility] = useColumnVisibility(
    "evals",
    initialColumnVisibility ?? EVALS_INITIAL_COLUMN_VISIBILITY,
  );
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>(() => {
    const filters: ColumnFiltersState = [];
    const deptIds = searchParams?.getAll("departmentIds") ?? [];
    const modelIds = searchParams?.getAll("modelIds") ?? [];
    const rubricIds = searchParams?.getAll("rubricIds") ?? [];
    if (deptIds.length > 0) filters.push({ id: "departments", value: deptIds });
    if (modelIds.length > 0) filters.push({ id: "model_ids", value: modelIds });
    if (rubricIds.length > 0) filters.push({ id: "rubric_ids", value: rubricIds });
    return filters;
  });
  const [sorting, setSorting] = useState<SortingState>([
    { id: "updated_at", desc: true },
  ]);

  // Use server-provided data directly
  const evalsData = serverListData;

  // Extract data from response - ensure it's always an array
  const [evalsList, setEvalsList] = useState<
    NonNullable<EvalsListOut["evals"]>
  >(Array.isArray(evalsData?.evals) ? evalsData.evals : []);

  useEffect(() => {
    const evalsArray = Array.isArray(evalsData?.evals) ? evalsData.evals : [];
    setEvalsList(evalsArray);
  }, [evalsData?.evals]);

  // Filter options from server-provided ListFilterSection
  const departmentOptions = useMemo(
    () =>
      (evalsData?.department_filter?.options || [])
        .map((opt) => ({
          value: opt.id as string,
          label: opt.name as string,
          count: opt.count ?? undefined,
        }))
        .filter((opt) => opt.value && opt.label),
    [evalsData?.department_filter]
  );

  const modelOptions = useMemo(
    () =>
      (evalsData?.model_filter?.options || [])
        .map((opt) => ({
          value: opt.id as string,
          label: opt.name as string,
          count: opt.count ?? undefined,
        }))
        .filter((opt) => opt.value && opt.label),
    [evalsData?.model_filter]
  );

  const rubricOptions = useMemo(
    () =>
      (evalsData?.rubric_filter?.options || [])
        .map((opt) => ({
          value: opt.id as string,
          label: opt.name as string,
          count: opt.count ?? undefined,
        }))
        .filter((opt) => opt.value && opt.label),
    [evalsData?.rubric_filter]
  );

  // Flag catalog (e.g. eval_active) — used to reconstruct flag_ids on bulk edit.
  const flagOptions = useMemo(() => {
    return (evalsData?.flag_filter?.options || [])
      .filter((opt): opt is typeof opt & { id: string; name: string } => !!opt.id && !!opt.name)
      .map((opt) => ({ id: opt.id!, name: opt.name!, type: opt.type ?? null }));
  }, [evalsData?.flag_filter]);

  // Selection state — URL-backed so it survives refresh and is
  // craftable as a shareable / LLM-generated link. Three params model
  // the full state machine:
  //
  //   - ``selectedIds=A,B``      → explicit selection of named rows
  //   - ``selectAll=1``          → every row matching active filters
  //   - ``selectAll=1&excludedIds=X`` → all-matching minus exclusions
  //   - (none)                   → empty selection
  //
  // Shallow updates skip the RSC re-fetch burst.
  const [selectedEvalIds, setSelectedEvalIds] = useQueryState(
    "selectedIds",
    parseAsArrayOf(parseAsString).withDefault([]).withOptions({ shallow: true }),
  );
  const [selectAllMatching, setSelectAllMatching] = useQueryState(
    "selectAll",
    parseAsBoolean.withDefault(false).withOptions({ shallow: true }),
  );
  const [excludedEvalIds, setExcludedEvalIds] = useQueryState(
    "excludedIds",
    parseAsArrayOf(parseAsString).withDefault([]).withOptions({ shallow: true }),
  );

  const totalMatchingCount = evalsData?.total_count ?? 0;

  // Mode-aware predicate — every row read goes through this so the
  // rest of the component never branches on ``selectAllMatching``.
  const isSelected = useCallback(
    (id: string | null | undefined) => {
      if (!id) return false;
      return selectAllMatching
        ? !excludedEvalIds.includes(id)
        : selectedEvalIds.includes(id);
    },
    [selectAllMatching, excludedEvalIds, selectedEvalIds],
  );

  const selectedCount = selectAllMatching
    ? Math.max(0, totalMatchingCount - excludedEvalIds.length)
    : selectedEvalIds.length;

  const selectedEvals = useMemo(() => {
    return (Array.isArray(evalsData?.evals) ? evalsData.evals : []).filter(
      (e) => e.eval_id && isSelected(e.eval_id)
    );
  }, [evalsData?.evals, isSelected]);
  const deletableEvals = useMemo(
    () => selectedEvals.filter((e) => e.can_delete),
    [selectedEvals],
  );
  const nonDeletableEvals = useMemo(
    () => selectedEvals.filter((e) => !e.can_delete),
    [selectedEvals],
  );
  const editableEvals = useMemo(
    () => selectedEvals.filter((e) => e.can_edit ?? true),
    [selectedEvals],
  );

  // Toggle selection for a single eval. Under all-matching mode toggle
  // membership in excludedEvalIds; otherwise toggle selectedEvalIds.
  const toggleSelection = useCallback((evalId: string) => {
    if (selectAllMatching) {
      void setExcludedEvalIds((prev) =>
        prev.includes(evalId)
          ? prev.filter((id) => id !== evalId)
          : [...prev, evalId],
      );
    } else {
      void setSelectedEvalIds((prev) =>
        prev.includes(evalId)
          ? prev.filter((id) => id !== evalId)
          : [...prev, evalId],
      );
    }
  }, [selectAllMatching, setExcludedEvalIds, setSelectedEvalIds]);

  const clearSelection = useCallback(() => {
    void setSelectedEvalIds([]);
    void setSelectAllMatching(false);
    void setExcludedEvalIds([]);
  }, [setSelectedEvalIds, setSelectAllMatching, setExcludedEvalIds]);

  /** Promote the page-only selection into "all matching filter" mode.
   *  Clears explicit ids and exclusions — the all-matching mode is the
   *  canonical truth from this point. */
  const selectAllMatchingNow = useCallback(() => {
    void setSelectedEvalIds([]);
    void setExcludedEvalIds([]);
    void setSelectAllMatching(true);
  }, [setSelectedEvalIds, setExcludedEvalIds, setSelectAllMatching]);

  // Bulk delete state
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // Bulk edit state
  const [showBulkEditDialog, setShowBulkEditDialog] = useState(false);
  const [isBulkEditing, setIsBulkEditing] = useState(false);
  const [bulkEditActiveStatus, setBulkEditActiveStatus] = useState<boolean | null>(null);

  // WebSocket integration for real-time updates
  // No `eval_completed` route exists in the OpenAPI socket map; listener
  // removed until a server-emitted event is canonicalized.

  // Helper to update URL search params
  const updateEvalsParams = useCallback(
    (updates: {
      page?: number;
      pageSize?: number;
      search?: string;
      departmentIds?: string[];
      modelIds?: string[];
      rubricIds?: string[];
      departmentSearch?: string;
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

      if (updates.modelIds !== undefined) {
        params.delete("modelIds");
        updates.modelIds.forEach((id) => params.append("modelIds", id));
      }

      if (updates.rubricIds !== undefined) {
        params.delete("rubricIds");
        updates.rubricIds.forEach((id) => params.append("rubricIds", id));
      }

      if (updates.departmentSearch !== undefined) {
        if (updates.departmentSearch === "") params.delete("departmentSearch");
        else params.set("departmentSearch", updates.departmentSearch);
      }

      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  // Commit search to URL
  const commitSearch = useCallback(
    (value: string) => {
      updateEvalsParams({ page: 0, search: value.trim() || "" });
    },
    [updateEvalsParams]
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
  const [localDepartmentSearch, setLocalDepartmentSearch] = useState(departmentSearch);

  const handleDepartmentSearchChange = useCallback(
    (value: string) => {
      setLocalDepartmentSearch(value);
      if (departmentSearchTimeoutRef.current) clearTimeout(departmentSearchTimeoutRef.current);
      departmentSearchTimeoutRef.current = setTimeout(() => {
        updateEvalsParams({ departmentSearch: value });
      }, 300);
    },
    [updateEvalsParams]
  );

  // Sync column filters to URL when they change
  const handleColumnFiltersChange = useCallback(
    (updater: ColumnFiltersState | ((prev: ColumnFiltersState) => ColumnFiltersState)) => {
      const newFilters = typeof updater === "function" ? updater(columnFilters) : updater;
      setColumnFilters(newFilters);

      const departmentFilter = newFilters.find((f) => f.id === "departments");
      const modelFilter = newFilters.find((f) => f.id === "model_ids");
      const rubricFilter = newFilters.find((f) => f.id === "rubric_ids");

      updateEvalsParams({
        page: 0,
        departmentIds: (departmentFilter?.value as string[]) || [],
        modelIds: (modelFilter?.value as string[]) || [],
        rubricIds: (rubricFilter?.value as string[]) || [],
      });
    },
    [columnFilters, updateEvalsParams]
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
      updateEvalsParams({
        page: newPagination.pageIndex,
        pageSize: newPagination.pageSize,
      });
    },
    [pageIndex, pageSize, updateEvalsParams]
  );

  // Compute page count from total
  const pageCount = Math.ceil(totalCount / pageSize);

  const handleDelete = async () => {
    if (!deleteItem || !deleteEvalAction) return;

    try {
      await deleteEvalAction({
        body: {
          eval_ids: [deleteItem.id],
          all: false,
          accept: true,
        },
      });
      toast.success(`Eval "${deleteItem.name}" deleted successfully`);
      setShowDeleteDialog(false);
      setDeleteItem(null);
      router.refresh();
    } catch (error) {
      toast.error(`Failed to delete eval: ${error}`);
    }
  };

  // Ensure evalsList is always an array for type safety
  const baseEvalsArray = Array.isArray(evalsList) ? evalsList : [];

  // SSR-seeded base list. The audit-driven ghost hook layers
  // create/update/delete/duplicate lifecycle on top — committed rows
  // get merged into ``mergedEvals`` directly so the table stays
  // current without a ``router.refresh()`` (which would re-burst the
  // page's SSR fetches — see GenerationPanel handleSend rationale).
  const {
    ghosts: evalGhosts,
    mergedRows: mergedEvals,
    ack: ackEvalGhost,
  } = useArtifactGhosts({
    artifactType: "eval",
    // All four CRUD ops the LLM might invoke or the user might
    // trigger from the toolbar/card. Each maps to a distinct ghost
    // visual in ``renderEvalCard`` (creating / updating / deleting /
    // duplicating skeleton + pending soft state). Without
    // ``duplicate`` here the LLM's duplicate tool dispatch fires
    // audit events that nothing is subscribed to → no ghost.
    ops: ["create", "update", "delete", "duplicate"],
    baseRows: baseEvalsArray,
    rowKey: "eval_id",
    // ``evals`` plural matches the field name the create / duplicate
    // / update impls now include on their responses (see
    // ``hydrate_eval_list_rows``). The hook reads ``output.evals``
    // from the audit ``.completed`` payload to materialize new/
    // changed rows directly — no SSR refresh needed.
    artifactPlural: "evals",
  });

  // Downstream code reads ``evalsListArray`` — keep that name to
  // minimize diff. The active list is the merged view (base + create
  // overlays − delete overlays).
  const evalsListArray = mergedEvals;

  const selectAllOnPage = useCallback(() => {
    const pageIds = evalsListArray.filter((e) => e.eval_id).map((e) => e.eval_id!);
    void setSelectAllMatching(false);
    void setExcludedEvalIds([]);
    void setSelectedEvalIds((prev) => Array.from(new Set([...prev, ...pageIds])));
  }, [evalsListArray, setSelectAllMatching, setExcludedEvalIds, setSelectedEvalIds]);

  // Under all-matching mode every loaded row whose id isn't in
  // ``excludedEvalIds`` is implicitly selected, so the predicate
  // reduces to "no excluded rows on the current page."
  const allPageSelected = useMemo(() => {
    const pageIds = evalsListArray.filter((e) => e.eval_id).map((e) => e.eval_id!);
    if (pageIds.length === 0) return false;
    return pageIds.every((id) => isSelected(id));
  }, [evalsListArray, isSelected]);

  // Whether there ARE more matching rows than what's loaded on this
  // page — used to decide whether to surface the "Select all N
  // matching" affordance after the user selects the page.
  const hasMoreThanCurrentPage = totalMatchingCount > evalsListArray.length;

  const handleBulkDelete = async () => {
    // Either explicit-mode (deletable rows on current page) OR
    // all-matching mode (server resolves rows via filter). Both
    // converge on the same ``deleteEvalAction`` call shape; the body
    // just differs.
    if (!deleteEvalAction) return;
    if (!selectAllMatching && deletableEvals.length === 0) return;

    setIsBulkDeleting(true);
    try {
      const body = selectAllMatching
        ? ({
            // Server resolves matching ids from the same filter the
            // page used (currentSearchBody is the SSR body), subtracts
            // ``excluded_ids``, then runs the existing per-row delete.
            // Per-row permission failures soft-skip — surfaced in
            // response.results[]. Cast via ``unknown`` because the
            // ``all``/``excluded_ids``/filter fields lag the generated
            // OpenAPI types until the next regen.
            all: true as const,
            excluded_ids: excludedEvalIds,
            ...(currentSearchBody ?? {}),
            accept: true,
          } as unknown as DeleteEvalIn["body"])
        : ({
            eval_ids: deletableEvals.map((e) => e.eval_id!),
            accept: true,
          } as DeleteEvalIn["body"]);

      const result = await deleteEvalAction({ body } as DeleteEvalIn);

      // Per-row results — soft-skip count surfaces partial success.
      const results = (result as DeleteEvalOut).results ?? [];
      const successCount = results.filter((r) => r.success).length;
      const skippedCount = results.length - successCount;
      if (skippedCount > 0) {
        toast.success(`${successCount} eval(s) deleted, ${skippedCount} skipped`);
      } else {
        toast.success(`${successCount} eval(s) deleted successfully`);
      }
      clearSelection();
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to delete evals";
      toast.error(msg.replace(/^\d{3}\s*/, "") || "Failed to delete evals");
    } finally {
      setIsBulkDeleting(false);
      setShowBulkDeleteDialog(false);
    }
  };

  const handleBulkEdit = async () => {
    if (!updateEvalAction) return;
    if (!selectAllMatching && editableEvals.length === 0) return;

    const hasActiveChange = bulkEditActiveStatus !== null;
    const hasAnyFlagChange = hasActiveChange;
    if (!hasActiveChange) {
      toast.error("No changes selected");
      return;
    }

    const activeFlagId = flagOptions.find((f) => f.type === "eval_active")?.id;

    setIsBulkEditing(true);
    try {
      let body: UpdateEvalIn["body"];
      if (selectAllMatching) {
        // All-matching: the server can't preserve per-row flag state
        // (it doesn't know each row's existing flags), so the active
        // toggle becomes "set to this value across all matching rows"
        // — same semantic as a manual sweep.
        let flag_ids: string[] | undefined;
        if (hasAnyFlagChange) {
          flag_ids = [];
          if (bulkEditActiveStatus && activeFlagId) flag_ids.push(activeFlagId);
        }
        body = {
          all: true,
          excluded_ids: excludedEvalIds,
          ...(currentSearchBody ?? {}),
          patch: {
            ...(hasAnyFlagChange && { flag_ids }),
          },
          accept: true,
        } as unknown as UpdateEvalIn["body"];
      } else {
        // Explicit: clone the patch per-row.
        const items = editableEvals.map((e) => {
          let flag_ids: string[] | undefined;
          if (hasAnyFlagChange) {
            const isActive = bulkEditActiveStatus;
            flag_ids = isActive && activeFlagId ? [activeFlagId] : [];
          }
          return {
            id: e.eval_id!,
            ...(hasAnyFlagChange && { flag_ids }),
          };
        });
        body = { evals: items } as UpdateEvalIn["body"];
      }

      const result = await updateEvalAction({ body } as UpdateEvalIn);

      const results = (result as UpdateEvalOut).results ?? [];
      const successCount = results.filter((r) => r.success).length;
      const skippedCount = results.length - successCount;
      if (skippedCount > 0) {
        toast.success(`${successCount} eval(s) updated, ${skippedCount} skipped`);
      } else {
        toast.success(`${successCount} eval(s) updated successfully`);
      }
      clearSelection();
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to update evals";
      toast.error(msg.replace(/^\d{3}\s*/, "") || "Failed to update evals");
    } finally {
      setIsBulkEditing(false);
      setShowBulkEditDialog(false);
    }
  };

  const openBulkEditDialog = () => {
    setBulkEditActiveStatus(null);
    setShowBulkEditDialog(true);
  };

  // Define table columns inline
  const columns: ColumnDef<(typeof evalsListArray)[number]>[] = useMemo(
    () => [
      {
        accessorKey: "name",
        header: "Name",
      },
      // Hidden column for sorting by updated_at
      {
        id: "updated_at",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: true,
        accessorFn: (row: (typeof evalsListArray)[number]) => {
          return row.updated_at ?? null;
        },
      },
      // Hidden faceting column for Departments (server-driven; client filterFn
      // is a harmless second pass).
      {
        id: "departments",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        enableColumnFilter: true,
        accessorFn: (row: (typeof evalsListArray)[number]) => row.department_ids ?? [],
        filterFn: (row, id, filterValue: string[]) =>
          !filterValue?.length || filterValue.some((v) => ((row.getValue(id) as string[]) ?? []).includes(v)),
      },
      // Hidden faceting column for Models (client-faceted)
      {
        id: "model_ids",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        enableColumnFilter: true,
        accessorFn: (row: (typeof evalsListArray)[number]) => row.model_ids ?? [],
        filterFn: (row, id, filterValue: string[]) =>
          !filterValue?.length || filterValue.some((v) => ((row.getValue(id) as string[]) ?? []).includes(v)),
      },
      // Hidden faceting column for Rubrics (client-faceted)
      {
        id: "rubric_ids",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        enableColumnFilter: true,
        accessorFn: (row: (typeof evalsListArray)[number]) => row.rubric_ids ?? [],
        filterFn: (row, id, filterValue: string[]) =>
          !filterValue?.length || filterValue.some((v) => ((row.getValue(id) as string[]) ?? []).includes(v)),
      },
      // Virtual columns for card view toggles
      {
        id: "num_runs",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: (typeof evalsListArray)[number]) => row.num_runs ?? 0,
      },
      {
        id: "status_badge",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: (typeof evalsListArray)[number]) => row.is_inactive ?? false,
      },
      {
        id: "card_description",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: (typeof evalsListArray)[number]) => row.description ?? "",
      },
    ],
    []
  );

  // Create table instance with manual pagination and filtering
  const table = useReactTable({
    data: evalsListArray,
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
    // Client-side filterFns run for slots whose API does not support server-side
    // filtering (model, rubric). Server-driven slots (departments) get
    // pre-filtered rows from the server, so client filterFn is a harmless
    // second pass.
    manualFiltering: false,
    pageCount,
  });

  // Memoize table rows. Including ``evalsListArray`` itself (not just
  // ``.length``) so update events that mutate row content but not
  // list cardinality still invalidate the memo. The reference is
  // stabilized upstream by ``mergedEvals``'s useMemo.
  const sortingKey = JSON.stringify(sorting);
  const tableRows = useMemo(() => {
    return table.getRowModel().rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortingKey, evalsListArray, pageIndex, pageSize]);

  const renderEvalCard = (
    evalItem: (typeof evalsListArray)[number],
    ghost?: Ghost<(typeof evalsListArray)[number]>,
  ) => {
    const isGhost = ghost != null;
    const ghostState = ghost?.state;
    const inFlight =
      ghostState === "creating" ||
      ghostState === "duplicating" ||
      ghostState === "updating" ||
      ghostState === "deleting";
    const isPending = ghostState === "pending";
    const isFailed = ghostState === "failed";

    const evalId = evalItem?.eval_id ?? "";
    const evalName = evalItem?.name ?? "";

    // Real rows must have an id; ghosts may not yet (creating). Skip
    // rendering only for non-ghost rows missing an id.
    if (!evalId && !isGhost) return null;
    const rowSelected = !isGhost && evalId ? isSelected(evalId) : false;

    const handleCardClick = (e: React.MouseEvent) => {
      if (isGhost) return;
      // Don't toggle selection if clicking action buttons
      if ((e.target as HTMLElement).closest("[data-action-button]")) return;
      toggleSelection(evalId);
    };

    // Border tint reflects ghost lifecycle. ``animate-pulse`` while
    // in-flight signals "this is provisional"; failed/pending hold
    // a steady color so the user can decide.
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
        key={isGhost ? `ghost-${ghost.callId}` : evalId}
        className={`group relative flex flex-col h-full transition-all hover:shadow-md ${
          isGhost ? "" : "cursor-pointer"
        } ${ghostBorderClass} ${
          rowSelected ? "ring-2 ring-primary" : ""
        }`}
        data-testid={isGhost ? "eval-ghost-card" : "eval-card"}
        data-eval-id={evalId}
        data-ghost-state={ghostState}
        role="gridcell"
        aria-label={`eval card ${evalName || (isGhost ? "Generating" : "")}`}
        aria-selected={rowSelected}
        aria-busy={inFlight ? true : undefined}
        onClick={handleCardClick}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-lg flex items-center gap-2">
                {/* Selection checkbox — hidden in ghost mode (no row id
                    to select yet). */}
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
                      checked={rowSelected}
                      onCheckedChange={() => toggleSelection(evalId)}
                      className="rounded-full h-5 w-5"
                      aria-label={`Select eval ${evalName || "Unnamed"}`}
                    />
                  </div>
                )}
                {/* Spinner replaces the checkbox slot for in-flight
                    create/duplicate ghosts so the visual mass is
                    similar (otherwise the ghost card looks oddly
                    smaller). */}
                {isGhost && inFlight && (
                  <Loader2 className="h-4 w-4 animate-spin text-primary flex-shrink-0" />
                )}
                <span className="line-clamp-2">
                  {evalName || (isGhost ? "Generating…" : "")}
                </span>
                {isGhost && (
                  <Badge
                    variant={isFailed ? "destructive" : isPending ? "outline" : "secondary"}
                    className={
                      isPending
                        ? "border-amber-500 text-amber-700 dark:text-amber-400"
                        : ""
                    }
                  >
                    {ghostState === "creating" && "Creating…"}
                    {ghostState === "duplicating" && "Duplicating…"}
                    {ghostState === "updating" && "Updating…"}
                    {ghostState === "deleting" && "Deleting…"}
                    {ghostState === "pending" && "Pending"}
                    {ghostState === "failed" && "Failed"}
                  </Badge>
                )}
              </CardTitle>
              <div className="mt-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  {columnVisibility["num_runs"] !== false && (
                    <Badge variant="outline">
                      {evalItem.num_runs ?? 0}{" "}
                      {(evalItem.num_runs ?? 0) === 1 ? "run" : "runs"}
                    </Badge>
                  )}
                  {columnVisibility["status_badge"] !== false && evalItem.is_inactive && (
                    <Badge variant="secondary" className="text-xs">
                      Inactive
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2" data-action-button>
              {/* Ghost-mode action area: status-aware. Pending →
                  Accept/Reject for soft-write ack. Failed → error
                  indicator. In-flight → no buttons (the streaming
                  card is read-only until commit/failure). */}
              {isGhost && isPending && ghost.callId && (
                <>
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    className="h-8"
                    onClick={() => ackEvalGhost(ghost.callId, true)}
                  >
                    <Check className="mr-1 h-3.5 w-3.5" />
                    Accept
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8"
                    onClick={() => ackEvalGhost(ghost.callId, false)}
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
              {!isGhost && evalItem.can_edit && evalId ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push(`/system/evals/${evalId}`)}
                  aria-label={`Edit ${evalName}`}
                  data-testid={`btn-edit-eval-${evalId}`}
                  title={`Edit ${evalName}`}
                  className="h-9 px-3"
                >
                  <Edit className="h-4 w-4 md:mr-0 mr-2" />
                  <span className="md:hidden">Edit</span>
                </Button>
              ) : !isGhost && evalId ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push(`/system/evals/${evalId}`)}
                  aria-label={`View ${evalName}`}
                  data-testid={`btn-view-eval-${evalId}`}
                  title={`View ${evalName}`}
                  className="h-9 px-3"
                >
                  <Eye className="h-4 w-4 md:mr-0 mr-2" />
                  <span className="md:hidden">View</span>
                </Button>
              ) : null}
              {!isGhost && evalItem.can_delete && deleteEvalAction && evalId && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    const evalName = evalItem.name ?? "";
                    setDeleteItem({ id: evalId, name: evalName });
                    setShowDeleteDialog(true);
                  }}
                  aria-label={`Delete ${evalName}`}
                  data-testid={`btn-delete-eval-${evalId}`}
                  title={`Delete ${evalName}`}
                  className="h-9 px-3"
                >
                  <Trash2 className="h-4 w-4 md:mr-0 mr-2" />
                  <span className="md:hidden">Delete</span>
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        {columnVisibility["card_description"] !== false && (
          <CardContent className="pt-0 flex-1 flex flex-col">
            <p className="text-sm text-muted-foreground line-clamp-2">
              {evalItem.description || "No description"}
            </p>
          </CardContent>
        )}
      </Card>
    );
  };

  // Get column references for toolbar
  const departmentsColumn = table.getColumn("departments");
  const modelsColumn = table.getColumn("model_ids");
  const rubricsColumn = table.getColumn("rubric_ids");
  const isFiltered =
    table.getState().columnFilters.length > 0 ||
    searchTerm.length > 0;

  return (
    <div className="space-y-6" data-page="evals-index">
      <div className="space-y-4">
        {/* Toolbar — swaps between filter bar and selection action bar */}
        {selectedCount > 0 ? (
          <div className="space-y-2" data-testid="evals-toolbar">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {deleteEvalAction && (
                <Button
                  variant="destructive"
                  size="sm"
                  className="h-8"
                  onClick={() => setShowBulkDeleteDialog(true)}
                  disabled={!selectAllMatching && deletableEvals.length === 0}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {selectAllMatching
                    ? `Delete ${selectedCount} matching`
                    : `Delete ${deletableEvals.length} of ${selectedCount}`}
                </Button>
              )}
              {updateEvalAction && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={openBulkEditDialog}
                  disabled={!selectAllMatching && editableEvals.length === 0}
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  {selectAllMatching
                    ? `Edit ${selectedCount} matching`
                    : `Edit ${editableEvals.length} of ${selectedCount}`}
                </Button>
              )}
              {!allPageSelected && !selectAllMatching && (
                <Button variant="ghost" size="sm" className="h-8" onClick={selectAllOnPage}>
                  Select Page
                </Button>
              )}
              <Button variant="ghost" size="sm" className="h-8" onClick={clearSelection}>
                Unselect All
              </Button>
            </div>
            <DataTableViewOptions
              table={table}
              hiddenColumns={["name", "departments", "model_ids", "rubric_ids", "updated_at"]}
            />
          </div>

          {/* Cross-page selection banners. Two states:
              (a) page-all selected, more matching elsewhere → offer
                  "Select all N matching" to flip into all-matching mode.
              (b) all-matching active → show count + Clear so the user
                  always has an obvious escape hatch.
              Mutually exclusive — both never render at once. */}
          {!selectAllMatching && allPageSelected && hasMoreThanCurrentPage && (
            <div
              className="flex items-center justify-between gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm"
              data-testid="select-all-matching-banner"
            >
              <span className="text-muted-foreground">
                All {evalsListArray.length} on this page selected.
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
                All {selectedCount} matching evals selected
                {excludedEvalIds.length > 0 && ` (${excludedEvalIds.length} excluded)`}.
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
          data-testid="evals-toolbar"
        >
          <div className="flex flex-col md:flex-row md:flex-1 md:items-center md:space-x-2 gap-2 md:gap-0">
            <div className="w-full md:w-auto">
              <Input
                data-testid="evals-search"
                placeholder="Search evals..."
                value={searchTerm}
                onChange={(event) => handleSearchChange(event.target.value)}
                onBlur={handleSearchBlur}
                onKeyDown={handleSearchKeyDown}
                className="h-8 w-full md:w-[150px] lg:w-[250px]"
                aria-label="Search evals by name"
                aria-controls="evals-grid"
              />
            </div>

            <div className="flex items-center space-x-2 flex-wrap">
              <ThreePickerFilters
                slots={[
                  {
                    column: modelsColumn,
                    title: "Model",
                    options: modelOptions,
                  },
                  {
                    column: rubricsColumn,
                    title: "Rubric",
                    options: rubricOptions,
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
                    table.resetColumnFilters();
                    updateEvalsParams({
                      page: 0,
                      search: "",
                      departmentIds: [],
                      modelIds: [],
                      rubricIds: [],
                      departmentSearch: "",
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
            <DataTableViewOptions
              table={table}
              hiddenColumns={["name", "departments", "model_ids", "rubric_ids", "updated_at"]}
            />
          </div>
        </div>
        )}

        {/* Cards Grid — container-query driven; scales with content area width */}
        <div className="@container">
          <div
            className="grid gap-4 @2xl:grid-cols-2 @5xl:grid-cols-3 @7xl:grid-cols-4"
            role="grid"
            aria-label="evals grid"
            data-testid="evals-grid"
          >
            {/* Ghost cards from in-flight audited writes (create /
                duplicate / update / delete in non-terminal states)
                are prepended — same ``renderEvalCard`` so layout,
                dimensions, and visual language match exactly. Once a
                ghost commits, its hydrated row is in ``mergedRows``
                (via ``state.added``) AND the ghost's ``state`` flips
                to "committed" — we filter those out so the real row
                replaces the ghost in place without a duplicate
                frame. */}
            {evalGhosts
              .filter((g) => g.state !== "committed" && g.state !== "accepted")
              .map((g) => {
                // For update/delete, ``before`` is the snapshot
                // lookup from baseRows (existing row) — gives us
                // name, description so the ghost card shows what's
                // being deleted/updated. For create/duplicate,
                // ``before`` is null and ``partial`` carries the
                // streaming args (often sparse for duplicate, richer
                // for create).
                const evalShell = (g.before ?? g.partial) as (typeof evalsListArray)[number];
                return (
                  <div key={`ghost-${g.callId}`}>
                    {renderEvalCard(evalShell, g)}
                  </div>
                );
              })}
            {tableRows.length ? (
              tableRows.map((row) => renderEvalCard(row.original))
            ) : (
              evalGhosts.length === 0 && (
                <div className="col-span-full text-center py-8 text-muted-foreground">
                  No evals match the current filters.
                </div>
              )
            )}
          </div>
        </div>

        {/* Pagination */}
        <DataTablePagination table={table} card={true} />
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Eval</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteItem?.name}"? This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Confirmation Dialog */}
      <BulkDeleteDialog
        open={showBulkDeleteDialog}
        onOpenChange={setShowBulkDeleteDialog}
        count={selectAllMatching ? selectedCount : deletableEvals.length}
        entityLabel="eval"
        entityLabelPlural="evals"
        isDeleting={isBulkDeleting}
        onConfirm={handleBulkDelete}
        description={
          <>
            <p>This action cannot be undone.</p>
            {selectAllMatching ? (
              // All-matching mode: server resolves rows from filter +
              // exclusions; per-row permission failures soft-skip. We
              // can't enumerate names without round-tripping through
              // the search endpoint, so show count + filter state.
              <div className="text-sm text-muted-foreground">
                <p>
                  All <span className="font-medium text-foreground">{selectedCount}</span> matching
                  {" "}evals will be deleted server-side using the current filter.
                </p>
                {excludedEvalIds.length > 0 && (
                  <p className="mt-1">{excludedEvalIds.length} explicitly excluded.</p>
                )}
                <p className="mt-1">
                  Evals you don't have permission to delete will be skipped automatically.
                </p>
              </div>
            ) : (
              <>
                {deletableEvals.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-destructive mb-1">Will be deleted:</p>
                    <ul className="text-sm space-y-0.5">
                      {deletableEvals.map((e) => (
                        <li key={e.eval_id} className="flex items-center gap-1.5">
                          <Trash2 className="h-3 w-3 text-destructive flex-shrink-0" />
                          {e.name || "Unnamed Eval"}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {nonDeletableEvals.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-yellow-600 dark:text-yellow-500 mb-1">
                      Cannot be deleted (in use):
                    </p>
                    <ul className="text-sm space-y-0.5">
                      {nonDeletableEvals.map((e) => (
                        <li
                          key={e.eval_id}
                          className="flex items-center gap-1.5 text-muted-foreground"
                        >
                          {e.name || "Unnamed Eval"}
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
        count={selectAllMatching ? selectedCount : editableEvals.length}
        entityLabelPlural="evals"
        isSaving={isBulkEditing}
        onSave={handleBulkEdit}
      >
        <BulkEditFlagField
          label="Active Status"
          value={bulkEditActiveStatus}
          onChange={setBulkEditActiveStatus}
        />
      </BulkEditDialog>

    </div>
  );
}
