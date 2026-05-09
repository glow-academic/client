/**
 * Parameters.tsx
 * Parameters component showing overview of parameter items
 * @AshokSaravanan222 & @siladiea
 * 07/21/2025
 */
"use client";
import {
  AlertCircle,
  Book,
  Calendar,
  Check,
  Clock,
  Copy,
  Edit,
  Eye,
  List,
  Loader2,
  MapPin,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { parseAsArrayOf, parseAsBoolean, parseAsString, useQueryState } from "nuqs";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

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
import { useArtifactGhosts, type Ghost } from "@/hooks/use-artifact-ghosts";
import { useParameterAi } from "@/hooks/use-parameter-ai";
import { useColumnVisibility } from "@/hooks/use-column-visibility";
import { useProfile } from "@/contexts/profile-context";

import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";

import type {
  DeleteParameterIn,
  DeleteParameterOut,
  DuplicateParameterIn,
  DuplicateParameterOut,
  ParametersListBody,
  ParametersListOut,
  UpdateParameterIn,
  UpdateParameterOut,
} from "@/app/(main)/management/parameters/page";
import { DataTablePagination } from "@/components/common/table/DataTablePagination";
import { DataTableViewOptions } from "@/components/common/table/DataTableViewOptions";
import { ThreePickerFilters } from "@/components/common/table/ThreePickerFilters";
import { Input } from "@/components/ui/input";

export interface ParametersProps {
  // Server-provided data (for server-side rendering)
  listData: ParametersListOut;
  // SSR column visibility from cookie
  initialColumnVisibility?: VisibilityState;
  // Server actions (replaces useMutation)
  duplicateParameterAction?: (
    input: DuplicateParameterIn
  ) => Promise<DuplicateParameterOut>;
  deleteParameterAction?: (
    input: DeleteParameterIn
  ) => Promise<DeleteParameterOut>;
  updateParameterAction?: (
    input: UpdateParameterIn
  ) => Promise<UpdateParameterOut>;
  /** The body the page used for its SSR ``/parameter/search`` call.
   *  Forwarded as filter fields on bulk delete/update calls when the
   *  user is in ``selectAll=1`` mode — the server resolves matching
   *  rows directly, no client-side enumeration. */
  currentSearchBody?: ParametersListBody;
}

const PARAMETERS_INITIAL_COLUMN_VISIBILITY: VisibilityState = {
  status_badge: true,
  card_description: true,
  num_items: true,
  default_badge: true,
};

export default function Parameters({
  listData: serverListData,
  initialColumnVisibility,
  duplicateParameterAction,
  deleteParameterAction,
  updateParameterAction,
  currentSearchBody,
}: ParametersProps) {
  const router = useRouter();
  const { profile } = useProfile();
  const [isDuplicating, setIsDuplicating] = useState<string | null>(null);

  useParameterAi({
    onComplete: () => router.refresh(),
  });
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteItem, setDeleteItem] = useState<{
    id: string;
    name: string;
  } | null>(null);

  // Table state
  const [rowSelection, setRowSelection] = useState({});
  const [columnVisibility, setColumnVisibility] = useColumnVisibility(
    "parameters",
    initialColumnVisibility ?? PARAMETERS_INITIAL_COLUMN_VISIBILITY,
  );
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = useState<SortingState>([
    { id: "updated_at", desc: true },
  ]);

  // Use server-provided data directly
  const parametersData = serverListData;

  // ``baseParameters`` is the SSR-rendered table; ``useArtifactGhosts``
  // overlays create/update/delete/duplicate lifecycle on top — committed
  // rows get merged into ``mergedParameters`` directly so the table
  // stays current without a ``router.refresh()`` (which would re-burst
  // the page's SSR fetches). Same shape applied to persona/scenario.
  const baseParameters = useMemo(
    () => parametersData?.parameters || [],
    [parametersData?.parameters]
  );

  const {
    ghosts: parameterGhosts,
    mergedRows: mergedParameters,
    ack: ackParameterGhost,
    drop: _dropParameterGhost,
  } = useArtifactGhosts({
    artifactType: "parameter",
    // All four CRUD ops the LLM might invoke or the user might trigger
    // from the toolbar/card. Each maps to a distinct ghost visual in
    // ``renderParameterCard``. Without ``duplicate`` here the LLM's
    // duplicate tool dispatch fires audit events that nothing is
    // subscribed to → no ghost.
    ops: ["create", "update", "delete", "duplicate"],
    baseRows: baseParameters,
    rowKey: "parameter_id",
    // ``parameters`` plural matches the field name the create / update
    // / duplicate impls now include on their responses (see
    // ``hydrate_parameter_list_rows``). The hook reads
    // ``output.parameters`` from the audit ``.completed`` payload to
    // materialize new/changed rows directly — no SSR refresh needed.
    artifactPlural: "parameters",
  });

  // Downstream code reads ``parameters`` — keep that name to minimize
  // diff. The active list is the merged view (base + create overlays
  // − delete overlays).
  const parameters = mergedParameters;

  // Flag catalog (e.g. parameter_active) — used to reconstruct flag_ids on bulk edit.
  const flagOptions = useMemo(() => {
    return (parametersData?.flag_filter?.options || [])
      .filter((opt): opt is typeof opt & { id: string; name: string } => !!opt.id && !!opt.name)
      .map((opt) => ({ id: opt.id!, name: opt.name!, type: opt.type ?? null }));
  }, [parametersData?.flag_filter]);

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
  // Shallow updates skip the RSC re-fetch burst. See persona's
  // Personas.tsx for the canonical implementation; same shape applies.
  const [selectedParameterIds, setSelectedParameterIds] = useQueryState(
    "selectedIds",
    parseAsArrayOf(parseAsString).withDefault([]).withOptions({ shallow: true }),
  );
  const [selectAllMatching, setSelectAllMatching] = useQueryState(
    "selectAll",
    parseAsBoolean.withDefault(false).withOptions({ shallow: true }),
  );
  const [excludedParameterIds, setExcludedParameterIds] = useQueryState(
    "excludedIds",
    parseAsArrayOf(parseAsString).withDefault([]).withOptions({ shallow: true }),
  );

  const totalMatchingCount = parametersData?.total_count ?? parameters.length;

  // Single mode-aware read predicate every row uses; downstream code
  // never needs to branch.
  const isSelected = useCallback(
    (id: string | null | undefined) => {
      if (!id) return false;
      return selectAllMatching
        ? !excludedParameterIds.includes(id)
        : selectedParameterIds.includes(id);
    },
    [selectAllMatching, excludedParameterIds, selectedParameterIds],
  );

  const selectedCount = selectAllMatching
    ? Math.max(0, totalMatchingCount - excludedParameterIds.length)
    : selectedParameterIds.length;

  const selectedParameters = useMemo(() => {
    return parameters.filter((p) => p.parameter_id && isSelected(p.parameter_id));
  }, [parameters, isSelected]);

  const deletableParameters = useMemo(
    () => selectedParameters.filter((p) => p.can_delete),
    [selectedParameters],
  );
  const nonDeletableParameters = useMemo(
    () => selectedParameters.filter((p) => !p.can_delete),
    [selectedParameters],
  );
  const editableParameters = useMemo(
    () => selectedParameters.filter((p) => p.can_edit ?? true),
    [selectedParameters],
  );

  // Under all-matching mode every loaded row whose id isn't in
  // ``excludedParameterIds`` is implicitly selected, so the predicate
  // reduces to "no excluded rows on the current page."
  const allPageSelected = useMemo(() => {
    const pageIds = parameters.filter((p) => p.parameter_id).map((p) => p.parameter_id!);
    if (pageIds.length === 0) return false;
    return pageIds.every((id) => isSelected(id));
  }, [parameters, isSelected]);

  // Whether there are more matching rows than what's loaded — used to
  // decide whether to surface the "Select all N matching" affordance.
  const hasMoreThanCurrentPage = totalMatchingCount > parameters.length;

  // Toggle a single row. Under all-matching we toggle membership in
  // excludedIds (deselect ⇒ add to exclusions, re-select ⇒ remove).
  // Under explicit mode it's the straight selectedIds toggle.
  const toggleSelection = useCallback((parameterId: string) => {
    if (selectAllMatching) {
      void setExcludedParameterIds((prev) =>
        prev.includes(parameterId)
          ? prev.filter((id) => id !== parameterId)
          : [...prev, parameterId],
      );
    } else {
      void setSelectedParameterIds((prev) =>
        prev.includes(parameterId)
          ? prev.filter((id) => id !== parameterId)
          : [...prev, parameterId],
      );
    }
  }, [selectAllMatching, setExcludedParameterIds, setSelectedParameterIds]);

  const clearSelection = useCallback(() => {
    void setSelectedParameterIds([]);
    void setSelectAllMatching(false);
    void setExcludedParameterIds([]);
  }, [setSelectedParameterIds, setSelectAllMatching, setExcludedParameterIds]);

  const selectAllOnPage = useCallback(() => {
    const pageIds = parameters.filter((p) => p.parameter_id).map((p) => p.parameter_id!);
    void setSelectAllMatching(false);
    void setExcludedParameterIds([]);
    void setSelectedParameterIds((prev) => Array.from(new Set([...prev, ...pageIds])));
  }, [parameters, setSelectAllMatching, setExcludedParameterIds, setSelectedParameterIds]);

  /** Promote the current page-only selection into "all matching
   *  filter" mode. Clears explicit ids and exclusions — all-matching
   *  mode is the canonical truth from this point. */
  const selectAllMatchingNow = useCallback(() => {
    void setSelectedParameterIds([]);
    void setExcludedParameterIds([]);
    void setSelectAllMatching(true);
  }, [setSelectedParameterIds, setExcludedParameterIds, setSelectAllMatching]);

  // Bulk delete state
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // Bulk edit state
  const [showBulkEditDialog, setShowBulkEditDialog] = useState(false);
  const [isBulkEditing, setIsBulkEditing] = useState(false);
  const [bulkEditActiveStatus, setBulkEditActiveStatus] = useState<boolean | null>(null);

  // Use server-provided facet options directly (ListFilterSection pattern)
  const scenarioOptions = useMemo(
    () =>
      (parametersData?.scenario_filter?.options || [])
        .map((opt) => ({
          value: opt.id as string,
          label: opt.name as string,
          count: opt.count ?? 0,
        }))
        .filter((opt) => opt.value && opt.label),
    [parametersData?.scenario_filter],
  );
  const fieldOptions = useMemo(
    () =>
      (parametersData?.field_filter?.options || [])
        .map((opt) => ({
          value: opt.id as string,
          label: opt.name as string,
          count: opt.count ?? 0,
        }))
        .filter((opt) => opt.value && opt.label),
    [parametersData?.field_filter],
  );
  const departmentOptions = useMemo(
    () =>
      (parametersData?.department_filter?.options || [])
        .map((opt) => ({
          value: opt.id as string,
          label: opt.name as string,
          count: opt.count ?? 0,
        }))
        .filter((opt) => opt.value && opt.label),
    [parametersData?.department_filter],
  );

  // Column definitions for TanStack Table
  const columns = useMemo<ColumnDef<(typeof parameters)[number]>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => row.getValue("name"),
        filterFn: (row, id, value) => {
          const name = String(row.getValue(id)).toLowerCase();
          const desc = String(row.original.description).toLowerCase();
          const query = String(value).toLowerCase();
          return name.includes(query) || desc.includes(query);
        },
      },
      {
        accessorKey: "num_items",
        header: "Items",
        cell: ({ row }) => row.getValue("num_items"),
      },
      {
        accessorKey: "updated_at",
        header: "Updated",
        cell: ({ row }) => row.getValue("updated_at"),
      },
      // Hidden faceting column for Scenarios (array of IDs)
      {
        id: "scenarios",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        // Return the array of scenario IDs for this row
        accessorFn: (row: (typeof parameters)[number]) =>
          row.scenario_ids ?? [],
        // Let filtering check membership - show if parameter is used in ANY selected scenario
        filterFn: (row, _id, value: string[]) => {
          const rowIds = (row.getValue("scenarios") as string[]) ?? [];
          if (value.length === 0) return true;
          return value.some((v) => rowIds.includes(v));
        },
      },
      // Hidden faceting column for Fields (array of IDs)
      {
        id: "fields",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: (typeof parameters)[number]) =>
          row.document_ids ?? [],
        filterFn: (row, _id, value: string[]) => {
          const rowIds = (row.getValue("fields") as string[]) ?? [];
          if (value.length === 0) return true;
          if (rowIds.length === 0) return true;
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
        accessorFn: (row: (typeof parameters)[number]) =>
          row.department_ids ?? [],
        filterFn: (row, _id, value: string[]) => {
          const rowIds = (row.getValue("departments") as string[]) ?? [];
          if (value.length === 0) return true;
          if (rowIds.length === 0) return true; // Show cross-department items when no filter
          return value.some((v) => rowIds.includes(v));
        },
      },
      // Virtual columns for card view toggles
      {
        id: "status_badge",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: (typeof parameters)[number]) => !row.active,
      },
      {
        id: "default_badge",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: (typeof parameters)[number]) => (row.department_ids?.length ?? 0) === 0,
      },
      {
        id: "card_description",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: (typeof parameters)[number]) => row.sample_items ?? [],
      },
    ],
    []
  );

  // Create table instance
  const table = useReactTable({
    data: parameters,
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
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    initialState: {
      pagination: {
        pageSize: 12,
      },
    },
  });

  // Memoize table rows. Including ``parameters`` itself (not just
  // ``parameters.length``) so update events that mutate row content
  // but not list cardinality still invalidate the memo. ``parameters``
  // is stabilized upstream by ``mergedParameters``'s useMemo, so a new
  // reference only appears when ``state.added`` / ``replaced`` /
  // ``hiddenIds`` actually change — no spurious recomputes.
  const pageIndex = table.getState().pagination.pageIndex;
  const pageSize = table.getState().pagination.pageSize;
  const sortingKey = JSON.stringify(sorting);
  const columnFiltersKey = JSON.stringify(columnFilters);
  const tableRows = useMemo(() => {
    return table.getRowModel().rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    sortingKey,
    columnFiltersKey,
    parameters,
    pageIndex,
    pageSize,
  ]);

  const handleDuplicate = async (parameter: (typeof parameters)[number]) => {
    if (!parameter.can_duplicate || !duplicateParameterAction) {
      toast.error("This parameter cannot be duplicated");
      return;
    }

    // Ensure profileId exists - required for API calls
    if (!profile?.id) {
      toast.error("Profile not loaded. Please refresh the page.");
      return;
    }

    if (!parameter.parameter_id) {
      toast.error("Parameter ID is missing");
      return;
    }
    setIsDuplicating(parameter.parameter_id);
    try {
      await duplicateParameterAction({
        body: { parameter_id: parameter.parameter_id, accept: true },
      });
      // profileId comes from X-Profile-Id header automatically
      toast.success(
        `Parameter "${parameter.name || "Unknown Parameter"}" duplicated successfully`
      );
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to duplicate parameter"
      );
    } finally {
      setIsDuplicating(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteItem || !deleteParameterAction) return;

    // Ensure profileId exists - required for API calls
    if (!profile?.id) {
      toast.error("Profile not loaded. Please refresh the page.");
      return;
    }

    try {
      await deleteParameterAction({
        body: { parameter_ids: [deleteItem.id], all: false, accept: true },
      });
      // profileId comes from X-Profile-Id header automatically
      toast.success(`Parameter "${deleteItem.name}" deleted successfully`);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete parameter"
      );
    } finally {
      setShowDeleteDialog(false);
      setDeleteItem(null);
    }
  };

  const handleDeleteClick = (id: string, name: string) => {
    setDeleteItem({ id, name });
    setShowDeleteDialog(true);
  };

  const handleBulkDelete = async () => {
    // Either explicit-mode (deletable rows on current page) OR
    // all-matching mode (server resolves rows via filter). Both
    // converge on the same ``deleteParameterAction`` call shape; only
    // the body differs.
    if (!deleteParameterAction) return;
    if (!selectAllMatching && deletableParameters.length === 0) return;

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
            excluded_ids: excludedParameterIds,
            ...(currentSearchBody ?? {}),
            accept: true,
          }
        : {
            parameter_ids: deletableParameters.map((p) => p.parameter_id!),
            accept: true,
          };

      const result = await deleteParameterAction({ body } as DeleteParameterIn);

      // Per-row results from the server: success entries are actual
      // deletions, failures are soft-skipped rows (no permission /
      // not found). Toast reflects both counts so the user knows
      // some rows were skipped without inspecting the receipt.
      const results = (result as DeleteParameterOut).results ?? [];
      const successCount = results.filter((r) => r.success).length;
      const skippedCount = results.length - successCount;
      if (skippedCount > 0) {
        toast.success(`${successCount} parameter(s) deleted, ${skippedCount} skipped`);
      } else {
        toast.success(`${successCount} parameter(s) deleted successfully`);
      }
      clearSelection();
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to delete parameters";
      toast.error(msg.replace(/^\d{3}\s*/, "") || "Failed to delete parameters");
    } finally {
      setIsBulkDeleting(false);
      setShowBulkDeleteDialog(false);
    }
  };

  const handleBulkEdit = async () => {
    if (!updateParameterAction) return;
    if (!selectAllMatching && editableParameters.length === 0) return;

    const hasActiveChange = bulkEditActiveStatus !== null;
    if (!hasActiveChange) {
      toast.error("No changes selected");
      return;
    }

    // Resolve flag UUIDs by type from the server-provided catalog.
    const activeFlagId = flagOptions.find((f) => f.type === "parameter_active")?.id;

    setIsBulkEditing(true);
    try {
      let body: UpdateParameterIn["body"];
      if (selectAllMatching) {
        // All-matching: the server can't preserve per-row flag state
        // (it doesn't know each row's existing flags), so the active
        // toggle becomes "set to this value across all matching rows"
        // — same semantic as a manual sweep.
        let flag_ids: string[] | undefined;
        if (hasActiveChange) {
          flag_ids = bulkEditActiveStatus && activeFlagId ? [activeFlagId] : [];
        }
        body = {
          all: true,
          excluded_ids: excludedParameterIds,
          ...(currentSearchBody ?? {}),
          patch: {
            ...(hasActiveChange && { flag_ids }),
          },
          accept: true,
        } as UpdateParameterIn["body"];
      } else {
        // Explicit: clone the patch per-row.
        const items = editableParameters.map((p) => {
          let flag_ids: string[] | undefined;
          if (hasActiveChange) {
            flag_ids = bulkEditActiveStatus && activeFlagId ? [activeFlagId] : [];
          }
          return {
            id: p.parameter_id!,
            ...(hasActiveChange && { flag_ids }),
          };
        });
        body = { parameters: items } as UpdateParameterIn["body"];
      }

      const result = await updateParameterAction({ body } as UpdateParameterIn);

      // Per-row results — same soft-skip pattern as bulk delete.
      const results = (result as UpdateParameterOut).results ?? [];
      const successCount = results.filter((r) => r.success).length;
      const skippedCount = results.length - successCount;
      if (skippedCount > 0) {
        toast.success(`${successCount} parameter(s) updated, ${skippedCount} skipped`);
      } else {
        toast.success(`${successCount} parameter(s) updated successfully`);
      }
      clearSelection();
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to update parameters";
      toast.error(msg.replace(/^\d{3}\s*/, "") || "Failed to update parameters");
    } finally {
      setIsBulkEditing(false);
      setShowBulkEditDialog(false);
    }
  };

  const openBulkEditDialog = () => {
    setBulkEditActiveStatus(null);
    setShowBulkEditDialog(true);
  };

  const getParameterIcon = (parameter: (typeof parameters)[number]) => {
    // Return different icons based on parameter name or type
    const name = (parameter.name || "").toLowerCase();
    if (name.includes("class") || name.includes("course"))
      return <Book className="h-5 w-5" />;
    if (name.includes("location") || name.includes("place"))
      return <MapPin className="h-5 w-5" />;
    if (name.includes("deadline") || name.includes("due"))
      return <Calendar className="h-5 w-5" />;
    if (name.includes("time") || name.includes("hour"))
      return <Clock className="h-5 w-5" />;
    return <List className="h-5 w-5" />;
  };

  const renderPreview = (
    items: NonNullable<ParametersListOut["parameters"]>[number]["sample_items"],
    totalCount: number
  ) => {
    // Show name + description
    if (!items || items.length === 0) {
      return <p className="text-sm text-muted-foreground">No items yet</p>;
    }
    return (
      <div className="space-y-2">
        {items.map((item: string, idx: number) => (
          <div
            key={`${item}-${idx}`}
            className="flex items-center justify-between p-2 bg-muted/50 rounded-md"
          >
            <div>
              <p className="text-sm font-medium">{item}</p>
            </div>
          </div>
        ))}
        {totalCount > 3 && (
          <p className="text-xs text-muted-foreground">
            +{totalCount - 3} more
          </p>
        )}
      </div>
    );
  };

  const renderParameterCard = (
    parameter: (typeof parameters)[number],
    ghost?: Ghost<(typeof parameters)[number]>,
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

    const count = parameter.num_items; // Pre-calculated from server
    // Use the mode-aware ``isSelected`` predicate (handles both
    // explicit and all-matching modes uniformly).
    const rowSelected = !isGhost && isSelected(parameter.parameter_id);

    const handleCardClick = (e: React.MouseEvent) => {
      // Don't toggle selection if clicking action buttons or when
      // rendering as a ghost (no real id to select).
      if (isGhost) return;
      if ((e.target as HTMLElement).closest("[data-action-button]")) return;
      if (parameter.parameter_id) {
        toggleSelection(parameter.parameter_id);
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
        key={parameter.parameter_id}
        className={`group relative flex flex-col h-full hover:shadow-md transition-all ${
          isGhost ? "" : "cursor-pointer"
        } ${ghostBorderClass} ${rowSelected ? "ring-2 ring-primary" : ""}`}
        data-testid={isGhost ? "parameter-ghost-card" : "parameter-card"}
        data-parameter-id={parameter.parameter_id}
        data-ghost-state={ghostState}
        role="gridcell"
        aria-label={`parameter card ${parameter.name || (isGhost ? "Generating" : "Unnamed Parameter")}`}
        aria-selected={rowSelected}
        aria-busy={inFlight ? true : undefined}
        onClick={handleCardClick}
      >
        <CardHeader className="pb-3">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
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
                      onCheckedChange={() => {
                        if (parameter.parameter_id) toggleSelection(parameter.parameter_id);
                      }}
                      className="rounded-full h-5 w-5"
                      aria-label={`Select parameter ${parameter.name || "Unnamed"}`}
                    />
                  </div>
                )}
                {/* In-flight ghost without details yet → spinner. Once
                    partial/output arrives, render the regular icon. */}
                {inFlight && !parameter.name ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  getParameterIcon(parameter)
                )}
                <span className="truncate">
                  {parameter.name || (isGhost ? "Generating…" : "Unnamed Parameter")}
                </span>
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
              </CardTitle>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                {columnVisibility["num_items"] !== false && (
                  <Badge variant="outline">
                    {count} {count === 1 ? "item" : "items"}
                  </Badge>
                )}
                {columnVisibility["default_badge"] !== false && parameter.department_ids?.length === 0 && (
                  <Badge variant="secondary" className="text-xs">
                    Default
                  </Badge>
                )}
                {columnVisibility["status_badge"] !== false && !parameter.active && (
                  <Badge variant="secondary" className="text-xs">
                    Inactive
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2" data-action-button>
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
                    onClick={() => ackParameterGhost(ghost.callId, true)}
                  >
                    <Check className="mr-1 h-3.5 w-3.5" />
                    Accept
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8"
                    onClick={() => ackParameterGhost(ghost.callId, false)}
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
              {!isGhost && (parameter.can_edit ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    router.push(
                      `/management/parameters/${parameter.parameter_id}`
                    )
                  }
                  aria-label={`Edit ${parameter.name}`}
                  data-testid="btn-edit-parameter"
                  title={`Edit ${parameter.name}`}
                  className="h-9 px-3"
                >
                  <Edit className="h-4 w-4 md:mr-0 mr-2" />
                  <span className="md:hidden">Edit</span>
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    router.push(
                      `/management/parameters/${parameter.parameter_id}`
                    )
                  }
                  aria-label={`View ${parameter.name}`}
                  data-testid="btn-view-parameter"
                  title={`View ${parameter.name}`}
                  className="h-9 px-3"
                >
                  <Eye className="h-4 w-4 md:mr-0 mr-2" />
                  <span className="md:hidden">View</span>
                </Button>
              ))}
              {!isGhost && parameter.can_duplicate && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDuplicate(parameter)}
                  disabled={isDuplicating === parameter.parameter_id}
                  aria-busy={
                    isDuplicating === parameter.parameter_id ? true : undefined
                  }
                  aria-label={`Duplicate ${parameter.name}`}
                  data-testid="btn-duplicate-parameter"
                  title={`Duplicate ${parameter.name}`}
                  className="h-9 px-3"
                >
                  {isDuplicating === parameter.parameter_id ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent md:mr-0 mr-2" />
                  ) : (
                    <Copy className="h-4 w-4 md:mr-0 mr-2" />
                  )}
                  <span className="md:hidden">
                    {isDuplicating === parameter.parameter_id
                      ? "Duplicating..."
                      : "Duplicate"}
                  </span>
                </Button>
              )}
              {!isGhost && parameter.can_delete && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (!parameter.parameter_id) {
                      toast.error("Parameter ID is missing");
                      return;
                    }
                    handleDeleteClick(
                      parameter.parameter_id,
                      parameter.name || "Unknown Parameter"
                    );
                  }}
                  aria-label={`Delete ${parameter.name || "Unknown Parameter"}`}
                  data-testid="btn-delete-parameter"
                  title={`Delete ${parameter.name || "Unknown Parameter"}`}
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
          <CardContent className="pt-0 flex-grow flex flex-col">
            {!parameter.sample_items || parameter.sample_items.length === 0 ? (
              <p className="text-sm text-muted-foreground">No items yet</p>
            ) : (
              renderPreview(parameter.sample_items, parameter.num_items ?? 0)
            )}
          </CardContent>
        )}
      </Card>
    );
  };

  // Get column references for toolbar
  const nameColumn = table.getColumn("name");
  const scenarioColumn = table.getColumn("scenarios");
  const fieldsColumn = table.getColumn("fields");
  const departmentsColumn = table.getColumn("departments");
  const isFiltered = table.getState().columnFilters.length > 0;

  // Show empty state only when there are no rows AND no in-flight
  // ghosts (a fresh create from an empty list should still render the
  // ghost rather than the empty placeholder).
  const hasActiveGhosts = parameterGhosts.some(
    (g) => g.state !== "committed" && g.state !== "accepted",
  );

  return (
    <div className="space-y-8">
      {parameters.length === 0 && !hasActiveGhosts ? (
        <div className="flex flex-col items-center justify-center py-12">
          <p className="text-muted-foreground">No parameters found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Toolbar — swaps between filter bar and selection action bar */}
          {selectedCount > 0 ? (
            <div className="space-y-2" data-testid="parameters-toolbar">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {deleteParameterAction && (
                  <Button
                    variant="destructive"
                    size="sm"
                    className="h-8"
                    onClick={() => setShowBulkDeleteDialog(true)}
                    disabled={!selectAllMatching && deletableParameters.length === 0}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    {selectAllMatching
                      ? `Delete ${selectedCount} matching`
                      : `Delete ${deletableParameters.length} of ${selectedCount}`}
                  </Button>
                )}
                {updateParameterAction && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8"
                    onClick={openBulkEditDialog}
                    disabled={!selectAllMatching && editableParameters.length === 0}
                  >
                    <Pencil className="mr-2 h-4 w-4" />
                    {selectAllMatching
                      ? `Edit ${selectedCount} matching`
                      : `Edit ${editableParameters.length} of ${selectedCount}`}
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
                hiddenColumns={["name", "updated_at", "scenarios", "fields", "departments"]}
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
                  All {parameters.length} on this page selected.
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
                  All {selectedCount} matching parameters selected
                  {excludedParameterIds.length > 0 && ` (${excludedParameterIds.length} excluded)`}.
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
              data-testid="parameters-toolbar"
            >
              <div className="flex flex-col md:flex-row md:flex-1 md:items-center md:space-x-2 gap-2 md:gap-0">
                <div className="w-full md:w-auto">
                  <Input
                    data-testid="parameters-search"
                    placeholder="Search parameters..."
                    value={(nameColumn?.getFilterValue() as string) ?? ""}
                    onChange={(event) =>
                      nameColumn?.setFilterValue(event.target.value)
                    }
                    className="h-8 w-full md:w-[150px] lg:w-[250px]"
                    aria-label="Search parameters by name"
                    aria-controls="parameters-grid"
                  />
                </div>

                <div className="flex items-center space-x-2 flex-wrap">
                  <ThreePickerFilters
                    slots={[
                      {
                        column: scenarioColumn,
                        title: "Scenario",
                        options: scenarioOptions,
                      },
                      {
                        column: fieldsColumn,
                        title: "Field",
                        options: fieldOptions,
                      },
                      {
                        column: departmentsColumn,
                        title: "Department",
                        options: departmentOptions,
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
                <DataTableViewOptions
                  table={table}
                  hiddenColumns={["name", "updated_at", "scenarios", "fields", "departments"]}
                />
              </div>
            </div>
          )}

          {/* Cards Grid — container-query driven; scales with content area width.
              Ghost cards from in-flight audited writes (create/duplicate/
              update/delete in non-terminal states) are prepended — same
              ``renderParameterCard`` so layout, dimensions, and visual
              language match exactly. Once a ghost commits, its hydrated
              row is in ``mergedRows`` (via ``state.added``) AND the
              ghost's ``state`` flips to "committed" — we filter those
              out so the real row replaces the ghost in place without a
              duplicate frame. */}
          <div className="@container">
            <div
              className="grid gap-4 @2xl:grid-cols-2 @5xl:grid-cols-3 @7xl:grid-cols-4"
              role="grid"
              aria-label="parameters grid"
              data-testid="parameters-grid"
            >
              {parameterGhosts
                .filter((g) => g.state !== "committed" && g.state !== "accepted")
                .map((g) => {
                  // For update/delete, ``before`` is the snapshot lookup
                  // from baseRows (existing row). For create/duplicate,
                  // ``before`` is null and ``partial`` carries streaming
                  // args (often sparse for duplicate, richer for create).
                  const parameterShell = (g.before ?? g.partial) as (typeof parameters)[number];
                  return (
                    <div key={`ghost-${g.callId}`}>
                      {renderParameterCard(parameterShell, g)}
                    </div>
                  );
                })}
              {tableRows.length ? (
                tableRows.map((row) => renderParameterCard(row.original))
              ) : (
                parameterGhosts.length === 0 && (
                  <div className="col-span-full text-center py-8 text-muted-foreground">
                    No parameters match the current filters.
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
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent
          aria-labelledby="delete-parameter-title"
          data-testid="dialog-delete-parameter"
        >
          <AlertDialogHeader>
            <AlertDialogTitle id="delete-parameter-title">
              Delete Parameter
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
        count={selectAllMatching ? selectedCount : deletableParameters.length}
        entityLabel="parameter"
        entityLabelPlural="parameters"
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
                  {" "}parameters will be deleted server-side using the current filter.
                </p>
                {excludedParameterIds.length > 0 && (
                  <p className="mt-1">
                    {excludedParameterIds.length} explicitly excluded.
                  </p>
                )}
                <p className="mt-1">
                  Parameters you don&apos;t have permission to delete will be skipped automatically.
                </p>
              </div>
            ) : (
              <>
                {deletableParameters.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-destructive mb-1">Will be deleted:</p>
                    <ul className="text-sm space-y-0.5">
                      {deletableParameters.map((p) => (
                        <li key={p.parameter_id} className="flex items-center gap-1.5">
                          <Trash2 className="h-3 w-3 text-destructive flex-shrink-0" />
                          {p.name || "Unnamed Parameter"}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {nonDeletableParameters.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-yellow-600 dark:text-yellow-500 mb-1">
                      Cannot be deleted (in use):
                    </p>
                    <ul className="text-sm space-y-0.5">
                      {nonDeletableParameters.map((p) => (
                        <li
                          key={p.parameter_id}
                          className="flex items-center gap-1.5 text-muted-foreground"
                        >
                          {p.name || "Unnamed Parameter"}
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
        count={selectAllMatching ? selectedCount : editableParameters.length}
        entityLabelPlural="parameters"
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
