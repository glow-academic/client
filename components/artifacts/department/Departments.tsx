/**
 * Departments.tsx
 * Used to display the departments page.
 * @AshokSaravanan222 & @siladiea
 * 07/20/2025
 */
"use client";
import { AlertCircle, Check, Copy, Edit, Eye, FileSpreadsheet, Loader2, Pencil, Trash2, Users, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { parseAsArrayOf, parseAsBoolean, parseAsString, useQueryState } from "nuqs";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import { useArtifactGhosts, type Ghost } from "@/hooks/use-artifact-ghosts";
import { ackOperation } from "@/lib/api/ack";

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
import { BulkDeleteDialog } from "@/components/common/forms/BulkDeleteDialog";
import { BulkEditDialog } from "@/components/common/forms/BulkEditDialog";
import { BulkEditFlagField } from "@/components/common/forms/BulkEditFlagField";
import { useDepartmentAi } from "@/hooks/use-department-ai";
import { useColumnVisibility } from "@/hooks/use-column-visibility";

import type {
  DeleteDepartmentIn,
  DeleteDepartmentOut,
  DepartmentsListBody,
  DepartmentsListOut,
  DuplicateDepartmentIn,
  DuplicateDepartmentOut,
  UpdateDepartmentIn,
  UpdateDepartmentOut,
  CreateDepartmentIn,
  CreateDepartmentOut,
} from "@/app/(main)/system/departments/page";
import BulkImport, { type ImportFieldDef, type ParseCsvResult } from "@/components/common/BulkImport";
import { DataTablePagination } from "@/components/common/table/DataTablePagination";
import { DataTableViewOptions } from "@/components/common/table/DataTableViewOptions";
import { ThreePickerFilters } from "@/components/common/table/ThreePickerFilters";
import { Input } from "@/components/ui/input";
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";

export interface DepartmentsProps {
  // Server-provided data (for server-side rendering)
  listData: DepartmentsListOut;
  // SSR column visibility from cookie
  initialColumnVisibility?: VisibilityState;
  // Server actions (replaces useMutation)
  duplicateDepartmentAction?: (
    input: DuplicateDepartmentIn,
  ) => Promise<DuplicateDepartmentOut>;
  deleteDepartmentAction?: (
    input: DeleteDepartmentIn,
  ) => Promise<DeleteDepartmentOut>;
  updateDepartmentAction?: (
    input: UpdateDepartmentIn,
  ) => Promise<UpdateDepartmentOut>;
  createDepartmentAction?: (input: CreateDepartmentIn) => Promise<CreateDepartmentOut>;
  parseCsvAction?: (formData: FormData) => Promise<ParseCsvResult>;
  importFields?: ImportFieldDef[];
  /** The body the page used for its SSR ``/department/search`` call.
   *  Forwarded as the filter envelope on bulk delete/update calls
   *  when the user is in ``selectAll=1`` mode — the server resolves
   *  matching rows directly, no client-side enumeration. */
  currentSearchBody?: DepartmentsListBody;
}

const DEPARTMENTS_INITIAL_COLUMN_VISIBILITY: VisibilityState = {
  // Hidden faceting columns
  profile_ids: false,
  setting_ids: false,
  login_ids: false,
  // Toggleable card sections
  staff_count: true,
  status_badge: true,
  card_description: true,
  card_updated_at: true,
};

export default function Departments({
  listData: serverListData,
  initialColumnVisibility,
  duplicateDepartmentAction,
  deleteDepartmentAction,
  updateDepartmentAction,
  createDepartmentAction,
  parseCsvAction,
  importFields,
  currentSearchBody,
}: DepartmentsProps) {
  const router = useRouter();

  useDepartmentAi({
    onComplete: () => router.refresh(),
  });

  const [isDuplicating, setIsDuplicating] = useState<string | null>(null);
  const [showBulkImportDialog, setShowBulkImportDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteItem, setDeleteItem] = useState<{
    id: string;
    name: string;
  } | null>(null);

  // Table state
  const [rowSelection, setRowSelection] = useState({});
  const [columnVisibility, setColumnVisibility] = useColumnVisibility(
    "departments",
    initialColumnVisibility ?? DEPARTMENTS_INITIAL_COLUMN_VISIBILITY,
  );
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = useState<SortingState>([
    { id: "updated_at", desc: true },
  ]);

  // Use server-provided data directly
  const departmentsData = serverListData;

  // SSR-seeded base list. The audit-driven ghost hook layers
  // create/update/delete/duplicate lifecycle on top — committed rows
  // get merged into ``mergedDepartments`` directly so the table stays
  // current without a ``router.refresh()`` (which would re-burst the
  // page's SSR fetches).
  const baseDepartments = useMemo(
    () => departmentsData?.departments || [],
    [departmentsData?.departments],
  );

  const {
    ghosts: departmentGhosts,
    mergedRows: mergedDepartments,
    ack: ackDepartmentGhost,
  } = useArtifactGhosts({
    artifactType: "department",
    // All four CRUD ops the LLM might invoke or the user might trigger
    // from the toolbar/card. Each maps to a distinct ghost visual in
    // ``renderDepartmentCard``. Without ``duplicate`` here the LLM's
    // duplicate tool dispatch fires audit events that nothing is
    // subscribed to → no ghost.
    ops: ["create", "update", "delete", "duplicate"],
    baseRows: baseDepartments,
    rowKey: "department_id",
    // Plural matches the response field name on
    // ``hydrate_department_list_rows`` payloads — the hook reads
    // ``output.departments`` from the audit ``.completed`` payload to
    // materialize new/changed rows directly, no SSR refresh needed.
    artifactPlural: "departments",
  });

  // Downstream code reads ``departments`` — keep that name to minimize
  // diff. The active list is the merged view (base + create overlays
  // − delete overlays).
  const departments = mergedDepartments;

  // Unified ack handler: live in-flight ghosts go through the hook;
  // server-side persistent pending rows ack via the generic action
  // and refresh. Mirrors ``Personas.tsx::handlePersonaAck``.
  const handleDepartmentAck = useCallback(
    async (callId: string, accept: boolean, op: Ghost<unknown>["op"]) => {
      const live = departmentGhosts.find((g) => g.callId === callId);
      if (live) {
        await ackDepartmentGhost(callId, accept);
        return;
      }
      try {
        await ackOperation({
          artifact: "department",
          operation: op,
          idempotencyKey: callId,
          accept,
        });
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Ack failed");
      }
    },
    [departmentGhosts, ackDepartmentGhost, router],
  );
  void handleDepartmentAck;
  // Note: cohort/profile filter options removed since faceted filtering
  // is no longer supported without cohort_ids/profile_ids per row

  // Flag catalog (e.g. department_active) — used to reconstruct flag_ids on bulk edit.
  const flagOptions = useMemo(() => {
    return (departmentsData?.flag_filter?.options || [])
      .filter((opt): opt is typeof opt & { id: string; name: string } => !!opt.id && !!opt.name)
      .map((opt) => ({ id: opt.id!, name: opt.name!, type: opt.type ?? null }));
  }, [departmentsData?.flag_filter]);

  // Picker filter options (all client-faceted; SearchDepartmentApiRequest
  // takes only `search`, no per-facet search params).
  const profileOptions = useMemo(
    () =>
      (departmentsData?.profile_filter?.options || [])
        .map((opt) => ({
          value: opt.id as string,
          label: opt.name as string,
          count: opt.count ?? undefined,
        }))
        .filter((opt) => opt.value && opt.label),
    [departmentsData?.profile_filter]
  );

  const settingsOptions = useMemo(
    () =>
      (departmentsData?.settings_filter?.options || [])
        .map((opt) => ({
          value: opt.id as string,
          label: opt.name as string,
          count: opt.count ?? undefined,
        }))
        .filter((opt) => opt.value && opt.label),
    [departmentsData?.settings_filter]
  );

  const loginsOptions = useMemo(
    () =>
      (departmentsData?.logins_filter?.options || [])
        .map((opt) => ({
          value: opt.id as string,
          label: (opt.name as string) || (opt.id as string),
          count: opt.count ?? undefined,
        }))
        .filter((opt) => opt.value),
    [departmentsData?.logins_filter]
  );

  // Selection state — URL-backed so it survives refresh and is
  // craftable as a shareable / LLM-generated link. Three params model
  // the full state machine:
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
  const [selectedDepartmentIds, setSelectedDepartmentIds] = useQueryState(
    "selectedIds",
    parseAsArrayOf(parseAsString).withDefault([]).withOptions({ shallow: true }),
  );
  const [selectAllMatching, setSelectAllMatching] = useQueryState(
    "selectAll",
    parseAsBoolean.withDefault(false).withOptions({ shallow: true }),
  );
  const [excludedDepartmentIds, setExcludedDepartmentIds] = useQueryState(
    "excludedIds",
    parseAsArrayOf(parseAsString).withDefault([]).withOptions({ shallow: true }),
  );

  // ``isSelected`` is the single read predicate every row uses; it
  // dispatches between explicit-id and all-matching modes so
  // downstream code never needs to branch.
  const totalMatchingCount = departmentsData?.total_count ?? 0;

  const isSelected = useCallback(
    (id: string | null | undefined) => {
      if (!id) return false;
      return selectAllMatching
        ? !excludedDepartmentIds.includes(id)
        : selectedDepartmentIds.includes(id);
    },
    [selectAllMatching, excludedDepartmentIds, selectedDepartmentIds],
  );

  const selectedCount = selectAllMatching
    ? Math.max(0, totalMatchingCount - excludedDepartmentIds.length)
    : selectedDepartmentIds.length;

  /** Selected rows that are loaded on the current page. Under all-
   *  matching mode this is "every loaded row not in excludedIds";
   *  under explicit mode it's the rows whose id is in selectedIds.
   *  Bulk-op handlers dispatch on ``selectAllMatching`` to either
   *  enumerate per-row patches (explicit) or send the filter envelope
   *  + ``patch`` for the server to expand (all-matching). */
  const selectedDepartments = useMemo(() => {
    return departments.filter((d) => isSelected(d.department_id));
  }, [departments, isSelected]);
  const deletableDepartments = useMemo(
    () => selectedDepartments.filter((d) => d.can_delete),
    [selectedDepartments],
  );
  const nonDeletableDepartments = useMemo(
    () => selectedDepartments.filter((d) => !d.can_delete),
    [selectedDepartments],
  );
  const editableDepartments = useMemo(
    () => selectedDepartments.filter((d) => d.can_edit ?? true),
    [selectedDepartments],
  );

  // Toggle selection for a single department. Under all-matching mode
  // we toggle membership in excludedDepartmentIds (deselect ⇒ add to
  // exclusions, re-select ⇒ remove). Under explicit mode it's the
  // straight selectedDepartmentIds toggle.
  const toggleSelection = useCallback((departmentId: string) => {
    if (selectAllMatching) {
      void setExcludedDepartmentIds((prev) =>
        prev.includes(departmentId)
          ? prev.filter((id) => id !== departmentId)
          : [...prev, departmentId],
      );
    } else {
      void setSelectedDepartmentIds((prev) =>
        prev.includes(departmentId)
          ? prev.filter((id) => id !== departmentId)
          : [...prev, departmentId],
      );
    }
  }, [selectAllMatching, setExcludedDepartmentIds, setSelectedDepartmentIds]);

  const clearSelection = useCallback(() => {
    void setSelectedDepartmentIds([]);
    void setSelectAllMatching(false);
    void setExcludedDepartmentIds([]);
  }, [setSelectedDepartmentIds, setSelectAllMatching, setExcludedDepartmentIds]);

  const selectAllOnPage = useCallback(() => {
    const pageIds = departments.filter((d) => d.department_id).map((d) => d.department_id!);
    void setSelectAllMatching(false);
    void setExcludedDepartmentIds([]);
    void setSelectedDepartmentIds((prev) => Array.from(new Set([...prev, ...pageIds])));
  }, [departments, setSelectAllMatching, setExcludedDepartmentIds, setSelectedDepartmentIds]);

  /** Promote the current page-only selection into "all matching
   *  filter" mode. Clears explicit ids and exclusions — the all-
   *  matching mode is the canonical truth from this point. */
  const selectAllMatchingNow = useCallback(() => {
    void setSelectedDepartmentIds([]);
    void setExcludedDepartmentIds([]);
    void setSelectAllMatching(true);
  }, [setSelectedDepartmentIds, setExcludedDepartmentIds, setSelectAllMatching]);

  // Check if all departments on the current page are selected. Under
  // all-matching mode every loaded row whose id isn't in
  // ``excludedDepartmentIds`` is implicitly selected, so the predicate
  // reduces to "no excluded rows on the current page."
  const allPageSelected = useMemo(() => {
    const pageIds = departments.filter((d) => d.department_id).map((d) => d.department_id!);
    if (pageIds.length === 0) return false;
    return pageIds.every((id) => isSelected(id));
  }, [departments, isSelected]);

  // Whether there ARE more matching rows than what's loaded on this
  // page — used to decide whether to surface the "Select all N
  // matching" affordance after the user selects the page.
  const hasMoreThanCurrentPage = totalMatchingCount > departments.length;

  // Bulk delete state
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // Bulk edit state
  const [showBulkEditDialog, setShowBulkEditDialog] = useState(false);
  const [isBulkEditing, setIsBulkEditing] = useState(false);
  const [bulkEditActiveStatus, setBulkEditActiveStatus] = useState<boolean | null>(null);

  // Define table columns inline
  const columns: ColumnDef<(typeof departments)[number]>[] = useMemo(
    () => [
      {
        accessorKey: "name",
        header: "Name",
      },
      {
        accessorKey: "updated_at",
        header: "Updated",
        cell: ({ row }) => {
          const updatedAt = row.original.updated_at;
          if (!updatedAt) {
            return (
              <div className="text-sm text-muted-foreground">-</div>
            );
          }
          const date = new Date(updatedAt);
          return (
            <div className="text-sm text-muted-foreground">
              {date.toLocaleDateString()}
            </div>
          );
        },
      },
      // Hidden faceting column for Profiles (client-faceted)
      {
        id: "profile_ids",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        enableColumnFilter: true,
        accessorFn: (row: (typeof departments)[number]) => row.profile_ids ?? [],
        filterFn: (row, id, filterValue: string[]) =>
          !filterValue?.length || filterValue.some((v) => ((row.getValue(id) as string[]) ?? []).includes(v)),
      },
      // Hidden faceting column for Settings (client-faceted)
      {
        id: "setting_ids",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        enableColumnFilter: true,
        accessorFn: (row: (typeof departments)[number]) => row.setting_ids ?? [],
        filterFn: (row, id, filterValue: string[]) =>
          !filterValue?.length || filterValue.some((v) => ((row.getValue(id) as string[]) ?? []).includes(v)),
      },
      // Hidden faceting column for Logins (client-faceted)
      {
        id: "login_ids",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        enableColumnFilter: true,
        accessorFn: (row: (typeof departments)[number]) => row.login_ids ?? [],
        filterFn: (row, id, filterValue: string[]) =>
          !filterValue?.length || filterValue.some((v) => ((row.getValue(id) as string[]) ?? []).includes(v)),
      },
      // Virtual columns for card view toggles
      {
        id: "staff_count",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: (typeof departments)[number]) => row.staff_count ?? 0,
      },
      {
        id: "status_badge",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: (typeof departments)[number]) => row.is_inactive ?? false,
      },
      {
        id: "card_description",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: (typeof departments)[number]) => row.description ?? "",
      },
      {
        id: "card_updated_at",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: (typeof departments)[number]) => row.updated_at ?? "",
      },
    ],
    [],
  );

  // Create table instance
  const table = useReactTable({
    data: departments,
    columns,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
      columnFilters,
    },
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    initialState: {
      pagination: {
        pageSize: 12,
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
  // Including ``departments`` itself (not just ``departments.length``)
  // so update events that mutate row content but not list cardinality
  // still invalidate the memo. ``departments`` is stabilized upstream
  // by ``mergedDepartments``'s useMemo, so a new reference only
  // appears when ``state.added``/``replaced``/``hiddenIds`` actually
  // change — no spurious recomputes.
  const tableRows = useMemo(() => {
    return table.getRowModel().rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    // Use JSON.stringify for arrays to ensure stable comparison (arrays are compared by reference)
    sortingKey,
    columnFiltersKey,
    departments,
    // Use pagination primitives directly (not object references)
    pageIndex,
    pageSize,
  ]);

  // Note: cohort/profile faceted filtering removed since the list API
  // no longer returns cohort_ids/profile_ids per department row

  const handleEdit = (id: string) => {
    router.push(`/system/departments/${id}`);
  };

  const handleDuplicate = async (department: (typeof departments)[number]) => {
    if (!department.can_duplicate || !duplicateDepartmentAction) {
      toast.error("This department cannot be duplicated");
      return;
    }

    if (!department.department_id) {
      toast.error("Department ID is required");
      return;
    }
    setIsDuplicating(department.department_id);
    try {
      await duplicateDepartmentAction({
        body: { department_id: department.department_id, accept: true },
      });
      toast.success(`Department "${department.name}" duplicated successfully`);
      router.refresh();
    } catch {
      toast.error("Failed to duplicate department");
    } finally {
      setIsDuplicating(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteItem || !deleteDepartmentAction) return;

    try {
      await deleteDepartmentAction({
        body: { department_ids: [deleteItem.id], all: false, accept: true },
      });
      toast.success(`Department "${deleteItem.name || "Unknown"}" deleted successfully`);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete department",
      );
    } finally {
      setShowDeleteDialog(false);
      setDeleteItem(null);
    }
  };

  const handleDeleteClick = (id: string, title: string) => {
    setDeleteItem({ id, name: title });
    setShowDeleteDialog(true);
  };

  const handleBulkDelete = async () => {
    // Either explicit-mode (deletable rows on current page) OR
    // all-matching mode (server resolves rows via filter). Both
    // converge on the same ``deleteDepartmentAction`` call shape; the
    // body just differs.
    if (!deleteDepartmentAction) return;
    if (!selectAllMatching && deletableDepartments.length === 0) return;

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
            excluded_ids: excludedDepartmentIds,
            ...(currentSearchBody ?? {}),
            accept: true,
          }
        : {
            department_ids: deletableDepartments.map((d) => d.department_id!),
            accept: true,
          };

      const result = await deleteDepartmentAction({ body } as DeleteDepartmentIn);

      // Per-row results from the server: success entries are actual
      // deletions, failures are soft-skipped rows (no permission /
      // not found). Toast reflects both counts so the user knows
      // some rows were skipped without inspecting the receipt.
      const results = (result as DeleteDepartmentOut).results ?? [];
      const successCount = results.filter((r) => r.success).length;
      const skippedCount = results.length - successCount;
      if (skippedCount > 0) {
        toast.success(`${successCount} department(s) deleted, ${skippedCount} skipped`);
      } else {
        toast.success(`${successCount} department(s) deleted successfully`);
      }
      clearSelection();
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to delete departments";
      toast.error(msg.replace(/^\d{3}\s*/, "") || "Failed to delete departments");
    } finally {
      setIsBulkDeleting(false);
      setShowBulkDeleteDialog(false);
    }
  };

  const handleBulkEdit = async () => {
    if (!updateDepartmentAction) return;
    if (!selectAllMatching && editableDepartments.length === 0) return;

    const hasActiveChange = bulkEditActiveStatus !== null;
    if (!hasActiveChange) {
      toast.error("No changes selected");
      return;
    }

    const activeFlagId = flagOptions.find((f) => f.type === "department_active")?.id;

    setIsBulkEditing(true);
    try {
      let body: UpdateDepartmentIn["body"];
      if (selectAllMatching) {
        // All-matching: the server can't preserve per-row flag state
        // (it doesn't know what each row's existing flags are), so
        // each toggle becomes "set to this value across all matching
        // rows" — the same semantic as a manual sweep.
        let flag_ids: string[] | undefined;
        if (hasActiveChange) {
          flag_ids = bulkEditActiveStatus && activeFlagId ? [activeFlagId] : [];
        }
        body = {
          all: true,
          excluded_ids: excludedDepartmentIds,
          ...(currentSearchBody ?? {}),
          patch: {
            ...(hasActiveChange && { flag_ids }),
          },
          accept: true,
        } as UpdateDepartmentIn["body"];
      } else {
        // Explicit: clone the patch per-row, preserving each row's
        // existing flag state for flags we aren't toggling.
        const items = editableDepartments.map((d) => {
          let flag_ids: string[] | undefined;
          if (hasActiveChange) {
            flag_ids = bulkEditActiveStatus && activeFlagId ? [activeFlagId] : [];
          }
          return {
            id: d.department_id!,
            ...(hasActiveChange && { flag_ids }),
          };
        });
        body = { departments: items } as UpdateDepartmentIn["body"];
      }

      const result = await updateDepartmentAction({ body } as UpdateDepartmentIn);

      // Per-row results — same soft-skip pattern as bulk delete.
      const results = (result as UpdateDepartmentOut).results ?? [];
      const successCount = results.filter((r) => r.success).length;
      const skippedCount = results.length - successCount;
      if (skippedCount > 0) {
        toast.success(`${successCount} department(s) updated, ${skippedCount} skipped`);
      } else {
        toast.success(`${successCount} department(s) updated successfully`);
      }
      clearSelection();
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to update departments";
      toast.error(msg.replace(/^\d{3}\s*/, "") || "Failed to update departments");
    } finally {
      setIsBulkEditing(false);
      setShowBulkEditDialog(false);
    }
  };

  const openBulkEditDialog = () => {
    setBulkEditActiveStatus(null);
    setShowBulkEditDialog(true);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const renderDepartmentCard = (
    department: (typeof departments)[0],
    ghost?: Ghost<(typeof departments)[0]>,
  ) => {
    // Same card visual for real rows and in-flight ghosts — single
    // source of truth for layout, dimensions, badges. Ghost mode swaps
    // action buttons for a status badge (and Accept/Reject for soft-
    // pending), disables selection/click, and tints the border based
    // on lifecycle state.
    const isGhost = ghost != null;
    const ghostState = ghost?.state;
    const inFlight =
      ghostState === "creating" ||
      ghostState === "duplicating" ||
      ghostState === "updating" ||
      ghostState === "deleting";
    const isPending = ghostState === "pending";
    const isFailed = ghostState === "failed";

    const cardSelected = !isGhost && isSelected(department.department_id);
    const handleCardClick = (e: React.MouseEvent) => {
      // Don't toggle selection if clicking action buttons or rendering
      // as a ghost (no real id to select yet).
      if (isGhost) return;
      if ((e.target as HTMLElement).closest("[data-action-button]")) return;
      if (department.department_id) {
        toggleSelection(department.department_id);
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
      key={department.department_id}
      className={`group hover:shadow-md transition-all ${
        isGhost ? "" : "cursor-pointer"
      } ${ghostBorderClass} ${cardSelected ? "ring-2 ring-primary" : ""}`}
      data-testid={isGhost ? "department-ghost-card" : "department-card"}
      data-department-id={department.department_id}
      data-ghost-state={ghostState}
      role="gridcell"
      aria-label={`department card ${department.name || (isGhost ? "Generating" : "Unnamed Department")}`}
      aria-selected={cardSelected}
      aria-busy={inFlight ? true : undefined}
      onClick={handleCardClick}
    >
      <CardHeader>
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="space-y-2 flex-1 min-w-0">
            <div className="flex items-center gap-2">
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
                    checked={cardSelected}
                    onCheckedChange={() => {
                      if (department.department_id) toggleSelection(department.department_id);
                    }}
                    className="rounded-full h-5 w-5"
                    aria-label={`Select department ${department.name || "Unnamed"}`}
                  />
                </div>
              )}
              {inFlight && !department.name && (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground flex-shrink-0" />
              )}
              <CardTitle className="text-base line-clamp-2">
                {department.name || (isGhost ? "Generating…" : "Unnamed Department")}
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
            <div className="mt-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                {!isGhost && columnVisibility["staff_count"] !== false && (
                  <Badge variant="outline" className="text-xs">
                    <Users className="h-3 w-3 mr-1" />
                    {department.staff_count} staff
                  </Badge>
                )}
                {!isGhost && columnVisibility["status_badge"] !== false && department.is_inactive && (
                  <Badge variant="secondary" className="text-xs">
                    Inactive
                  </Badge>
                )}
              </div>
            </div>
            {columnVisibility["card_description"] !== false && (
              <p className="text-sm text-muted-foreground mt-2">
                {department.description || (isGhost ? "" : "No description available")}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2 items-center" data-action-button>
            {/* Ghost-mode action area: status-aware. Pending →
                Accept/Reject for soft-write ack. Failed → error
                indicator. In-flight → no buttons. */}
            {isGhost && isPending && ghost.callId && (
              <>
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  className="h-8"
                  onClick={() => ackDepartmentGhost(ghost.callId, true)}
                >
                  <Check className="mr-1 h-3.5 w-3.5" />
                  Accept
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={() => ackDepartmentGhost(ghost.callId, false)}
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
            {!isGhost && (department.can_edit && department.department_id ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleEdit(department.department_id!)}
                aria-label={`Edit department ${department.name || "Unknown"}`}
                data-testid="btn-edit-department"
                title={`Edit department ${department.name || "Unknown"}`}
                className="h-9 px-3"
              >
                <Edit className="h-4 w-4 md:mr-0 mr-2" />
                <span className="md:hidden">Edit</span>
              </Button>
            ) : department.department_id ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => department.department_id && handleEdit(department.department_id)}
                aria-label={`View department ${department.name || "Unknown"}`}
                data-testid="btn-view-department"
                title={`View department ${department.name || "Unknown"}`}
                className="h-9 px-3"
              >
                <Eye className="h-4 w-4 md:mr-0 mr-2" />
                <span className="md:hidden">View</span>
              </Button>
            ) : null)}
            {!isGhost && department.can_duplicate && department.department_id && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDuplicate(department)}
                disabled={isDuplicating === department.department_id}
                aria-busy={
                  isDuplicating === department.department_id ? true : undefined
                }
                aria-label={`Duplicate department ${department.name || "Unknown"}`}
                data-testid="btn-duplicate-department"
                title={`Duplicate department ${department.name || "Unknown"}`}
                className="h-9 px-3"
              >
                {isDuplicating === department.department_id ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent md:mr-0 mr-2" />
                ) : (
                  <Copy className="h-4 w-4 md:mr-0 mr-2" />
                )}
                <span className="md:hidden">
                  {isDuplicating === department.department_id
                    ? "Duplicating..."
                    : "Duplicate"}
                </span>
              </Button>
            )}
            {!isGhost && department.can_delete && department.department_id && (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  handleDeleteClick(department.department_id!, department.name || "Unknown")
                }
                aria-label={`Delete department ${department.name || "Unknown"}`}
                data-testid="btn-delete-department"
                title={`Delete department ${department.name || "Unknown"}`}
                className="h-9 px-3"
              >
                <Trash2 className="h-4 w-4 md:mr-0 mr-2" />
                <span className="md:hidden">Delete</span>
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      {columnVisibility["card_updated_at"] !== false && (
        <CardContent>
          <div className="text-sm">
            <span className="text-muted-foreground">Updated:</span>
            <span className="font-medium ml-2">
              {department.updated_at ? formatDate(department.updated_at) : "-"}
            </span>
          </div>
        </CardContent>
      )}
    </Card>
    );
  };

  // Get column references for toolbar
  const nameColumn = table.getColumn("name");
  const profileColumn = table.getColumn("profile_ids");
  const settingsColumn = table.getColumn("setting_ids");
  const loginsColumn = table.getColumn("login_ids");
  const isFiltered = table.getState().columnFilters.length > 0;

  return (
    <div className="space-y-8" data-page="departments-index">
      <div className="space-y-4">
        {/* Toolbar — swaps between filter bar and selection action bar */}
        {selectedCount > 0 ? (
          <div className="space-y-2" data-testid="departments-toolbar">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {deleteDepartmentAction && (
                  <Button
                    variant="destructive"
                    size="sm"
                    className="h-8"
                    onClick={() => setShowBulkDeleteDialog(true)}
                    disabled={!selectAllMatching && deletableDepartments.length === 0}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    {selectAllMatching
                      ? `Delete ${selectedCount} matching`
                      : `Delete ${deletableDepartments.length} of ${selectedCount}`}
                  </Button>
                )}
                {updateDepartmentAction && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8"
                    onClick={openBulkEditDialog}
                    disabled={!selectAllMatching && editableDepartments.length === 0}
                  >
                    <Pencil className="mr-2 h-4 w-4" />
                    {selectAllMatching
                      ? `Edit ${selectedCount} matching`
                      : `Edit ${editableDepartments.length} of ${selectedCount}`}
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
                hiddenColumns={["name", "updated_at", "profile_ids", "setting_ids", "login_ids"]}
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
                  All {departments.length} on this page selected.
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
                  All {selectedCount} matching departments selected
                  {excludedDepartmentIds.length > 0 && ` (${excludedDepartmentIds.length} excluded)`}.
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
            data-testid="departments-toolbar"
          >
            <div className="flex flex-col md:flex-row md:flex-1 md:items-center md:space-x-2 gap-2 md:gap-0">
              <div className="w-full md:w-auto">
                <Input
                  data-testid="departments-search"
                  placeholder="Search departments..."
                  value={(nameColumn?.getFilterValue() as string) ?? ""}
                  onChange={(event) =>
                    nameColumn?.setFilterValue(event.target.value)
                  }
                  className="h-8 w-full md:w-[150px] lg:w-[250px]"
                  aria-label="Search departments by name"
                  aria-controls="departments-grid"
                />
              </div>

              <div className="flex items-center space-x-2 flex-wrap">
                <ThreePickerFilters
                  slots={[
                    {
                      column: profileColumn,
                      title: "Profile",
                      options: profileOptions,
                    },
                    {
                      column: settingsColumn,
                      title: "Settings",
                      options: settingsOptions,
                    },
                    {
                      column: loginsColumn,
                      title: "Logins",
                      options: loginsOptions,
                    },
                  ]}
                />
                {isFiltered && (
                  <Button
                    variant="ghost"
                    onClick={() => table.resetColumnFilters()}
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
                hiddenColumns={["name", "updated_at", "profile_ids", "setting_ids", "login_ids"]}
              />
            </div>
          </div>
        )}

        {/* Cards Grid — container-query driven; scales with content area width.
            Ghost cards from in-flight audited writes (create/duplicate/
            update/delete in non-terminal states) are prepended — same
            ``renderDepartmentCard`` so layout, dimensions, and visual
            language match exactly. Once a ghost commits, its hydrated
            row is in ``mergedRows`` (via ``state.added``) AND the
            ghost's ``state`` flips to "committed" — we filter those
            out so the real row replaces the ghost in place without a
            duplicate frame. */}
        <div className="@container">
          <div
            className="grid gap-4 @2xl:grid-cols-2 @5xl:grid-cols-3 @7xl:grid-cols-4"
            role="grid"
            aria-label="departments grid"
            data-testid="departments-grid"
          >
            {departmentGhosts
              .filter((g) => g.state !== "committed" && g.state !== "accepted")
              .map((g) => {
                // For update/delete, ``before`` is the snapshot lookup
                // from baseRows; for create/duplicate, ``partial`` is
                // the streaming args (often sparse).
                const departmentShell = (g.before ?? g.partial) as (typeof departments)[0];
                return (
                  <div key={`ghost-${g.callId}`}>
                    {renderDepartmentCard(departmentShell, g)}
                  </div>
                );
              })}
            {tableRows.length ? (
              tableRows.map((row) => {
                const department = row.original;
                const persistentGhost: Ghost<(typeof departments)[0]> | undefined =
                  department.pending_status === "pending" && department.pending_call_id
                    ? {
                        callId: department.pending_call_id,
                        op: (department.pending_operation as Ghost<(typeof departments)[0]>["op"]) ?? "create",
                        state: "pending",
                        rowId: department.department_id ?? null,
                        partial: department as unknown as Ghost<(typeof departments)[0]>["partial"],
                        before: department,
                        tool: null,
                        error: null,
                        arguments: {},
                      }
                    : undefined;
                return renderDepartmentCard(department, persistentGhost);
              })
            ) : (
              departmentGhosts.length === 0 && (
                <div className="col-span-full text-center py-8 text-muted-foreground">
                  No departments match the current filters.
                </div>
              )
            )}
          </div>
        </div>

        {/* Pagination */}
        <div aria-label="pagination controls">
          <DataTablePagination table={table} card={true} />
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent
          aria-labelledby="delete-department-title"
          data-testid="dialog-delete-department"
        >
          <AlertDialogHeader>
            <AlertDialogTitle id="delete-department-title">
              Delete Department
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deleteItem?.name}&quot;?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="btn-cancel-delete">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              variant="destructive"
              data-testid="btn-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Confirmation Dialog */}
      <BulkDeleteDialog
        open={showBulkDeleteDialog}
        onOpenChange={setShowBulkDeleteDialog}
        count={selectAllMatching ? selectedCount : deletableDepartments.length}
        entityLabel="department"
        entityLabelPlural="departments"
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
                  {" "}departments will be deleted server-side using the current filter.
                </p>
                {excludedDepartmentIds.length > 0 && (
                  <p className="mt-1">
                    {excludedDepartmentIds.length} explicitly excluded.
                  </p>
                )}
                <p className="mt-1">
                  Departments you don&apos;t have permission to delete will be skipped automatically.
                </p>
              </div>
            ) : (
              <>
                {deletableDepartments.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-destructive mb-1">Will be deleted:</p>
                    <ul className="text-sm space-y-0.5">
                      {deletableDepartments.map((d) => (
                        <li key={d.department_id} className="flex items-center gap-1.5">
                          <Trash2 className="h-3 w-3 text-destructive flex-shrink-0" />
                          {d.name || "Unnamed Department"}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {nonDeletableDepartments.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-yellow-600 dark:text-yellow-500 mb-1">
                      Cannot be deleted (in use):
                    </p>
                    <ul className="text-sm space-y-0.5">
                      {nonDeletableDepartments.map((d) => (
                        <li
                          key={d.department_id}
                          className="flex items-center gap-1.5 text-muted-foreground"
                        >
                          {d.name || "Unnamed Department"}
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
        count={selectAllMatching ? selectedCount : editableDepartments.length}
        entityLabelPlural="departments"
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
          artifactName="Departments"
          parseCsvAction={parseCsvAction}
          onSave={async (items) => {
            if (!createDepartmentAction) throw new Error("Create action not available");
            const departments = items.map((item) => ({
              name: item["name"] as string | undefined,
              description: item["description"] as string | undefined,
            }));
            return createDepartmentAction({ body: { departments } } as CreateDepartmentIn);
          }}
        />
      )}
    </div>
  );
}
