/**
 * Fields.tsx
 * Used to display the fields page with table-based filtering and card layout.
 * @AshokSaravanan222 & @siladiea
 * 12/05/2025
 */
"use client";
import { AlertCircle, Check, Copy, Edit, Eye, FileSpreadsheet, Loader2, Pencil, Trash2, X } from "lucide-react";
import { HoverPrefetchLink } from "@/components/common/HoverPrefetchLink";
import { useRouter } from "next/navigation";
import { parseAsArrayOf, parseAsBoolean, parseAsString, useQueryState } from "nuqs";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import type {
  DeleteFieldIn,
  DeleteFieldOut,
  DuplicateFieldIn,
  DuplicateFieldOut,
  FieldsListBody,
  FieldsListOut,
  UpdateFieldIn,
  UpdateFieldOut,
  CreateFieldIn,
  CreateFieldOut,
} from "@/app/(main)/management/fields/page";
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
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
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
import { Skeleton } from "@/components/ui/skeleton";
import { BulkDeleteDialog } from "@/components/common/forms/BulkDeleteDialog";
import { BulkEditDialog } from "@/components/common/forms/BulkEditDialog";
import { BulkEditFlagField } from "@/components/common/forms/BulkEditFlagField";
import { useArtifactGhosts, type Ghost } from "@/hooks/use-artifact-ghosts";
import { ackOperation } from "@/lib/api/ack";
import { useFieldAi } from "@/hooks/use-field-ai";
import { useColumnVisibility } from "@/hooks/use-column-visibility";

export interface FieldsProps {
  // Server-provided data (for server-side rendering)
  listData: FieldsListOut;
  // SSR column visibility from cookie
  initialColumnVisibility?: VisibilityState;
  // Server actions (replaces useMutation)
  duplicateFieldAction?: (
    input: DuplicateFieldIn
  ) => Promise<DuplicateFieldOut>;
  deleteFieldAction?: (input: DeleteFieldIn) => Promise<DeleteFieldOut>;
  updateFieldAction?: (input: UpdateFieldIn) => Promise<UpdateFieldOut>;
  createFieldAction?: (input: CreateFieldIn) => Promise<CreateFieldOut>;
  parseCsvAction?: (formData: FormData) => Promise<ParseCsvResult>;
  importFields?: ImportFieldDef[];
  /** The body the page used for its SSR ``/field/search`` call.
   *  Forwarded as the filter envelope on bulk delete/update calls
   *  when the user is in ``selectAll=1`` mode — the server resolves
   *  matching rows directly, no client-side enumeration. */
  currentSearchBody?: FieldsListBody;
}

const FIELDS_INITIAL_COLUMN_VISIBILITY: VisibilityState = {
  card_description: true,
  card_parameters: true,
  card_departments: true,
};

export default function Fields({
  listData: serverListData,
  initialColumnVisibility,
  duplicateFieldAction,
  deleteFieldAction,
  updateFieldAction,
  createFieldAction,
  parseCsvAction,
  importFields,
  currentSearchBody,
}: FieldsProps) {
  const router = useRouter();

  // ``useFieldAi`` previously listened for ``field.generate.completed``
  // and called ``router.refresh()`` so the list view updated after
  // generation. Removed — the audit framework already surfaces every
  // operation in the activity rail (so the user knows it happened),
  // and the duplicate-SSR-burst on every generate cycle was visible
  // noise. Newly-generated fields appear on next manual refresh or
  // when the user navigates back to this page. The ghost rail
  // (``useArtifactGhosts`` below) materializes create/update/delete/
  // duplicate write outcomes directly from the audit ``.completed``
  // payloads — no SSR refresh needed.
  useFieldAi({});

  const [showBulkImportDialog, setShowBulkImportDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteItem, setDeleteItem] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState<string | null>(null);

  // Table state
  const [rowSelection, setRowSelection] = useState({});
  const [columnVisibility, setColumnVisibility] = useColumnVisibility(
    "fields",
    initialColumnVisibility ?? FIELDS_INITIAL_COLUMN_VISIBILITY,
  );
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = useState<SortingState>([
    { id: "name", desc: false },
  ]);

  // Use server-provided data directly
  const fieldsData = serverListData;
  const isLoading = false; // No loading when using server data

  // SSR-seeded base list. The audit-driven ghost hook layers
  // create/update/delete/duplicate lifecycle on top — committed rows
  // get merged into ``mergedFields`` directly so the table stays
  // current without a ``router.refresh()`` (which would re-burst the
  // page's SSR fetches).
  const baseFields = useMemo(
    () => fieldsData?.fields || [],
    [fieldsData?.fields],
  );

  const {
    ghosts: fieldGhosts,
    mergedRows: mergedFields,
    ack: ackFieldGhost,
    drop: _dropFieldGhost,
  } = useArtifactGhosts({
    artifactType: "field",
    // All four CRUD ops the LLM might invoke or the user might trigger
    // from the toolbar/card. Each maps to a distinct ghost visual in
    // ``renderFieldCard`` (creating / updating / deleting /
    // duplicating skeleton + pending soft state). Without
    // ``duplicate`` here the LLM's duplicate tool dispatch fires
    // audit events that nothing is subscribed to → no ghost.
    ops: ["create", "update", "delete", "duplicate"],
    baseRows: baseFields,
    rowKey: "id",
    // ``fields`` plural matches the field name the create / duplicate /
    // update impls now include on their responses (see
    // ``hydrate_field_list_rows``). The hook reads ``output.fields``
    // from the audit ``.completed`` payload to materialize new/changed
    // rows directly — no SSR refresh needed.
    artifactPlural: "fields",
  });

  // Downstream code reads ``fields`` — keep that name to minimize
  // diff. The active list is the merged view (base + create overlays
  // − delete overlays).
  const fields = mergedFields;

  // Unified ack: live in-flight ghosts go through the hook; server-side
  // persistent pending rows (synthesized from ``pending_status``) ack
  // via the generic server action and refresh.
  const handleFieldAck = useCallback(
    async (callId: string, accept: boolean, op: Ghost<unknown>["op"]) => {
      const live = fieldGhosts.find((g) => g.callId === callId);
      if (live) {
        await ackFieldGhost(callId, accept);
        return;
      }
      try {
        await ackOperation({
          artifact: "field",
          operation: op,
          idempotencyKey: callId,
          accept,
        });
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Ack failed");
      }
    },
    [fieldGhosts, ackFieldGhost, router],
  );

  // Flag catalog (e.g. field_active) — used to reconstruct flag_ids on bulk edit.
  const flagOptions = useMemo(() => {
    return (fieldsData?.flag_filter?.options || [])
      .filter((opt): opt is typeof opt & { id: string; name: string } => !!opt.id && !!opt.name)
      .map((opt) => ({ id: opt.id!, name: opt.name!, type: opt.type ?? null }));
  }, [fieldsData?.flag_filter]);

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
  const [selectedFieldIds, setSelectedFieldIds] = useQueryState(
    "selectedIds",
    parseAsArrayOf(parseAsString).withDefault([]).withOptions({ shallow: true }),
  );
  const [selectAllMatching, setSelectAllMatching] = useQueryState(
    "selectAll",
    parseAsBoolean.withDefault(false).withOptions({ shallow: true }),
  );
  const [excludedFieldIds, setExcludedFieldIds] = useQueryState(
    "excludedIds",
    parseAsArrayOf(parseAsString).withDefault([]).withOptions({ shallow: true }),
  );

  // ---- Selection helpers ----------------------------------------
  // ``isSelected`` is the single read predicate every row uses; it
  // dispatches between explicit-id and all-matching modes so
  // downstream code never needs to branch. ``selectedCount`` mirrors
  // that — under all-matching it's ``totalCount - excludedIds.length``.
  const totalMatchingCount = fieldsData?.total_count ?? fields.length;

  const isSelected = useCallback(
    (id: string | null | undefined) => {
      if (!id) return false;
      return selectAllMatching
        ? !excludedFieldIds.includes(id)
        : selectedFieldIds.includes(id);
    },
    [selectAllMatching, excludedFieldIds, selectedFieldIds],
  );

  const selectedCount = selectAllMatching
    ? Math.max(0, totalMatchingCount - excludedFieldIds.length)
    : selectedFieldIds.length;

  const selectedFields = useMemo(() => {
    return fields.filter((f) => f.id && isSelected(f.id));
  }, [fields, isSelected]);
  const deletableFields = useMemo(
    () => selectedFields.filter((f) => f.can_delete),
    [selectedFields],
  );
  const nonDeletableFields = useMemo(
    () => selectedFields.filter((f) => !f.can_delete),
    [selectedFields],
  );
  const editableFields = useMemo(
    () => selectedFields.filter((f) => f.can_edit ?? true),
    [selectedFields],
  );

  // Toggle selection for a single field. Under all-matching mode we
  // toggle membership in excludedFieldIds (deselect ⇒ add to
  // exclusions, re-select ⇒ remove). Under explicit mode it's the
  // straight selectedFieldIds toggle.
  const toggleSelection = useCallback((fieldId: string) => {
    if (selectAllMatching) {
      void setExcludedFieldIds((prev) =>
        prev.includes(fieldId)
          ? prev.filter((id) => id !== fieldId)
          : [...prev, fieldId],
      );
    } else {
      void setSelectedFieldIds((prev) =>
        prev.includes(fieldId) ? prev.filter((id) => id !== fieldId) : [...prev, fieldId]
      );
    }
  }, [selectAllMatching, setExcludedFieldIds, setSelectedFieldIds]);

  const clearSelection = useCallback(() => {
    void setSelectedFieldIds([]);
    void setSelectAllMatching(false);
    void setExcludedFieldIds([]);
  }, [setSelectedFieldIds, setSelectAllMatching, setExcludedFieldIds]);

  const selectAllOnPage = useCallback(() => {
    const pageIds = fields.filter((f) => f.id).map((f) => f.id!);
    void setSelectAllMatching(false);
    void setExcludedFieldIds([]);
    void setSelectedFieldIds((prev) => Array.from(new Set([...prev, ...pageIds])));
  }, [fields, setSelectAllMatching, setExcludedFieldIds, setSelectedFieldIds]);

  // Check if all fields on the current page are selected. Under
  // all-matching mode every loaded row whose id isn't in
  // ``excludedFieldIds`` is implicitly selected.
  const allPageSelected = useMemo(() => {
    const pageIds = fields.filter((f) => f.id).map((f) => f.id!);
    if (pageIds.length === 0) return false;
    return pageIds.every((id) => isSelected(id));
  }, [fields, isSelected]);

  // Whether there ARE more matching rows than what's loaded on this
  // page — used to decide whether to surface the "Select all N
  // matching" affordance after the user selects the page.
  const hasMoreThanCurrentPage = totalMatchingCount > fields.length;

  /** Promote the current page-only selection into "all matching
   *  filter" mode. Clears explicit ids and exclusions — the all-
   *  matching mode is the canonical truth from this point. */
  const selectAllMatchingNow = useCallback(() => {
    void setSelectedFieldIds([]);
    void setExcludedFieldIds([]);
    void setSelectAllMatching(true);
  }, [setSelectedFieldIds, setExcludedFieldIds, setSelectAllMatching]);

  // Bulk delete state
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // Bulk edit state
  const [showBulkEditDialog, setShowBulkEditDialog] = useState(false);
  const [isBulkEditing, setIsBulkEditing] = useState(false);
  const [bulkEditActiveStatus, setBulkEditActiveStatus] = useState<boolean | null>(null);

  // Use server-provided facet options directly (ListFilterSection pattern)
  const parameterOptions = useMemo(
    () =>
      (fieldsData?.parameter_filter?.options || [])
        .map((opt) => ({
          value: opt.id as string,
          label: opt.name as string,
          count: opt.count ?? 0,
        }))
        .filter((opt) => opt.value && opt.label),
    [fieldsData?.parameter_filter],
  );
  const personaOptions = useMemo(
    () =>
      (fieldsData?.persona_filter?.options || [])
        .map((opt) => ({
          value: opt.id as string,
          label: opt.name as string,
          count: opt.count ?? 0,
        }))
        .filter((opt) => opt.value && opt.label),
    [fieldsData?.persona_filter],
  );
  const departmentOptions = useMemo(
    () =>
      (fieldsData?.department_filter?.options || [])
        .map((opt) => ({
          value: opt.id as string,
          label: opt.name as string,
          count: opt.count ?? 0,
        }))
        .filter((opt) => opt.value && opt.label),
    [fieldsData?.department_filter],
  );

  // Define table columns inline
  const columns: ColumnDef<(typeof fields)[number]>[] = useMemo(
    () => [
      {
        accessorKey: "name",
        header: "Name",
      },
      {
        accessorKey: "description",
        header: "Description",
      },
      {
        accessorKey: "value",
        header: "Value",
      },
      // Hidden faceting column for Parameters (array of IDs)
      {
        id: "parameters",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: (typeof fields)[number]) => row.conditional_parameter_ids ?? [],
        filterFn: (row, _id, value: string[]) => {
          const rowIds = (row.getValue("parameters") as string[]) ?? [];
          if (value.length === 0) return true;
          if (rowIds.length === 0) return true;
          return value.some((v) => rowIds.includes(v));
        },
      },
      // Hidden faceting column for Personas (array of IDs)
      {
        id: "personas",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: (typeof fields)[number]) => row.persona_ids ?? [],
        filterFn: (row, _id, value: string[]) => {
          const rowIds = (row.getValue("personas") as string[]) ?? [];
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
        accessorFn: (row: (typeof fields)[number]) => row.department_ids ?? [],
        filterFn: (row, _id, value: string[]) => {
          const rowIds = (row.getValue("departments") as string[]) ?? [];
          if (value.length === 0) return true;
          if (rowIds.length === 0) return true;
          return value.some((v) => rowIds.includes(v));
        },
      },
      // Virtual columns for card view toggles
      {
        id: "card_description",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: (typeof fields)[number]) => row.description ?? "",
      },
      {
        id: "card_parameters",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: (typeof fields)[number]) => row.conditional_parameter_ids ?? [],
      },
      {
        id: "card_departments",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: (typeof fields)[number]) => row.department_ids ?? [],
      },
    ],
    []
  );

  // Create table instance
  const table = useReactTable({
    data: fields,
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

  // Memoize table rows. Including ``fields`` itself (not just
  // ``fields.length``) so update events that mutate row content but
  // not list cardinality still invalidate the memo. ``fields`` is
  // stabilized upstream by ``mergedFields``'s useMemo, so a new
  // reference only appears when ``state.added``/``replaced``/
  // ``hiddenIds`` actually change — no spurious recomputes.
  const pageIndex = table.getState().pagination.pageIndex;
  const pageSize = table.getState().pagination.pageSize;
  const sortingKey = JSON.stringify(sorting);
  const columnFiltersKey = JSON.stringify(columnFilters);
  const tableRows = useMemo(() => {
    return table.getRowModel().rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortingKey, columnFiltersKey, fields, pageIndex, pageSize]);

  // Convert filter options to mappings for UI display (must be before early return)
  const parameterMapping = useMemo(() => {
    const options = fieldsData?.parameter_filter?.options || [];
    return Object.fromEntries(
      options.map((opt) => [opt.id, { name: opt.name || "" }])
    ) as Record<string, { name: string }>;
  }, [fieldsData?.parameter_filter]);

  const departmentMapping = useMemo(() => {
    const options = fieldsData?.department_filter?.options || [];
    return Object.fromEntries(
      options.map((opt) => [opt.id, { name: opt.name || "" }])
    ) as Record<string, { name: string }>;
  }, [fieldsData?.department_filter]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <div className="flex flex-col md:flex-row md:flex-1 md:items-center md:space-x-2 gap-2 md:gap-0">
            <Skeleton className="h-8 w-full md:w-[150px] lg:w-[250px]" />
            <div className="flex items-center space-x-2">
              <Skeleton className="h-8 w-[100px]" />
              <Skeleton className="h-8 w-[120px]" />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                  <div className="flex space-x-2">
                    <Skeleton className="h-8 w-8 rounded" />
                    <Skeleton className="h-8 w-8 rounded" />
                    <Skeleton className="h-8 w-8 rounded" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-3/4 mb-3" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const handleDelete = async () => {
    if (!deleteItem || !deleteFieldAction) return;

    setIsDeleting(true);
    try {
      await deleteFieldAction({
        body: { field_ids: [deleteItem.id], all: false, accept: true },
      });
      // profileId comes from X-Profile-Id header automatically
      toast.success(`Field '${deleteItem.name}' deleted successfully`);
      setShowDeleteDialog(false);
      setDeleteItem(null);
      router.refresh();
    } catch (error) {
      toast.error(
        `Failed to delete field: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteClick = (fieldId: string, name: string) => {
    setDeleteItem({ id: fieldId, name });
    setShowDeleteDialog(true);
  };

  const handleDuplicate = async (fieldId: string, name: string) => {
    if (!duplicateFieldAction) return;

    setIsDuplicating(fieldId);
    try {
      await duplicateFieldAction({
        body: { field_id: fieldId, accept: true },
      });
      // profileId comes from X-Profile-Id header automatically
      toast.success(`Field '${name}' duplicated successfully`);
      router.refresh();
    } catch (error) {
      toast.error(
        `Failed to duplicate field: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    } finally {
      setIsDuplicating(null);
    }
  };

  const handleBulkDelete = async () => {
    // Either explicit-mode (deletable rows on current page) OR
    // all-matching mode (server resolves rows via filter). Both
    // converge on the same ``deleteFieldAction`` call shape; the
    // body just differs.
    if (!deleteFieldAction) return;
    if (!selectAllMatching && deletableFields.length === 0) return;

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
            excluded_ids: excludedFieldIds,
            ...(currentSearchBody ?? {}),
            accept: true,
          }
        : {
            field_ids: deletableFields.map((f) => f.id!),
            accept: true,
          };

      const result = await deleteFieldAction({ body } as DeleteFieldIn);

      // Per-row results from the server: success entries are actual
      // deletions, failures are soft-skipped rows (no permission /
      // not found). Toast reflects both counts so the user knows
      // some rows were skipped without inspecting the receipt.
      const results = (result as DeleteFieldOut).results ?? [];
      const successCount = results.filter((r) => r.success).length;
      const skippedCount = results.length - successCount;
      if (skippedCount > 0) {
        toast.success(`${successCount} field(s) deleted, ${skippedCount} skipped`);
      } else {
        toast.success(`${successCount} field(s) deleted successfully`);
      }
      clearSelection();
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to delete fields";
      toast.error(msg.replace(/^\d{3}\s*/, "") || "Failed to delete fields");
    } finally {
      setIsBulkDeleting(false);
      setShowBulkDeleteDialog(false);
    }
  };

  const handleBulkEdit = async () => {
    if (!updateFieldAction) return;
    if (!selectAllMatching && editableFields.length === 0) return;

    const hasActiveChange = bulkEditActiveStatus !== null;
    if (!hasActiveChange) {
      toast.error("No changes selected");
      return;
    }

    const activeFlagId = flagOptions.find((f) => f.type === "field_active")?.id;

    setIsBulkEditing(true);
    try {
      // Shared change set used by both paths. Under all-matching the
      // server clones this per resolved row (stamping each id);
      // under explicit we clone client-side.
      let body: UpdateFieldIn["body"];
      if (selectAllMatching) {
        // All-matching: the server can't preserve per-row flag state
        // (it doesn't know what each row's existing flags are), so
        // the active toggle becomes "set to this value across all
        // matching rows" — the same semantic as a manual sweep.
        let flag_ids: string[] | undefined;
        if (hasActiveChange) {
          flag_ids = bulkEditActiveStatus && activeFlagId ? [activeFlagId] : [];
        }
        body = {
          all: true,
          excluded_ids: excludedFieldIds,
          ...(currentSearchBody ?? {}),
          patch: {
            ...(hasActiveChange && { flag_ids }),
          },
          accept: true,
        } as UpdateFieldIn["body"];
      } else {
        // Explicit: clone the patch per-row.
        const items = editableFields.map((f) => {
          let flag_ids: string[] | undefined;
          if (hasActiveChange) {
            flag_ids = bulkEditActiveStatus && activeFlagId ? [activeFlagId] : [];
          }
          return {
            id: f.id!,
            ...(hasActiveChange && { flag_ids }),
          };
        });
        body = { fields: items } as UpdateFieldIn["body"];
      }

      const result = await updateFieldAction({ body } as UpdateFieldIn);

      // Per-row results — same soft-skip pattern as bulk delete.
      const results = (result as UpdateFieldOut).results ?? [];
      const successCount = results.filter((r) => r.success).length;
      const skippedCount = results.length - successCount;
      if (skippedCount > 0) {
        toast.success(`${successCount} field(s) updated, ${skippedCount} skipped`);
      } else {
        toast.success(`${successCount} field(s) updated successfully`);
      }
      clearSelection();
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to update fields";
      toast.error(msg.replace(/^\d{3}\s*/, "") || "Failed to update fields");
    } finally {
      setIsBulkEditing(false);
      setShowBulkEditDialog(false);
    }
  };

  const openBulkEditDialog = () => {
    setBulkEditActiveStatus(null);
    setShowBulkEditDialog(true);
  };

  const renderFieldCard = (
    field: (typeof fields)[number],
    ghost?: Ghost<(typeof fields)[0]>,
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

    const isRowSelected =
      !isGhost && field.id ? isSelected(field.id) : false;
    const handleCardClick = (e: React.MouseEvent) => {
      // Don't toggle selection if clicking action buttons or when
      // rendering as a ghost (no real id to select yet).
      if (isGhost) return;
      if ((e.target as HTMLElement).closest("[data-action-button]")) return;
      if (field.id) {
        toggleSelection(field.id);
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
        key={field.id}
        className={`group flex flex-col h-full hover:shadow-md transition-all ${
          isGhost ? "" : "cursor-pointer"
        } ${ghostBorderClass} ${isRowSelected ? "ring-2 ring-primary" : ""}`}
        data-testid={isGhost ? "field-ghost-card" : `field-card-${field.id}`}
        data-field-id={field.id}
        data-ghost-state={ghostState}
        role="gridcell"
        aria-label={`field card ${field.name || (isGhost ? "Generating" : "Unnamed Field")}`}
        aria-selected={isRowSelected}
        aria-busy={inFlight ? true : undefined}
        onClick={handleCardClick}
      >
        <CardHeader className="pb-4 flex-shrink-0">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0 flex items-center gap-2">
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
                    checked={isRowSelected}
                    onCheckedChange={() => {
                      if (field.id) toggleSelection(field.id);
                    }}
                    className="rounded-full h-5 w-5"
                    aria-label={`Select field ${field.name || "Unnamed"}`}
                  />
                </div>
              )}
              {/* In-flight ghost without a streamed name yet → spinner
                  in the title slot via inline icon. */}
              {inFlight && !field.name && (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground flex-shrink-0" />
              )}
              <CardTitle className="text-lg font-semibold truncate">
                {field.name || (isGhost ? "Generating…" : "Unnamed Field")}
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
            <div className="flex items-center gap-1 ml-2 flex-shrink-0" data-action-button>
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
                    onClick={() => handleFieldAck(ghost.callId, true, ghost.op)}
                  >
                    <Check className="mr-1 h-3.5 w-3.5" />
                    Accept
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8"
                    onClick={() => handleFieldAck(ghost.callId, false, ghost.op)}
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
              {!isGhost && field.id && (
                <>
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    data-testid={`view-${field.id}`}
                    title="View"
                  >
                    <HoverPrefetchLink
                      href={`/management/fields/${field.id}`}
                      delay={150}
                      aria-label={`View ${field.name ?? ""}`}
                    >
                      <Eye className="h-4 w-4" />
                    </HoverPrefetchLink>
                  </Button>
                  {field.can_edit && (
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      data-testid={`edit-${field.id}`}
                    >
                      <HoverPrefetchLink
                        href={`/management/fields/${field.id}`}
                        delay={150}
                        aria-label={`Edit ${field.name ?? ""}`}
                      >
                        <Edit className="h-4 w-4" />
                      </HoverPrefetchLink>
                    </Button>
                  )}
                  {field.can_duplicate && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const fieldId = field.id;
                        const fieldName = field.name ?? "";
                        if (fieldId) handleDuplicate(fieldId, fieldName);
                      }}
                      disabled={isDuplicating === field.id}
                      aria-label={`Duplicate ${field.name}`}
                      data-testid="btn-duplicate-field"
                    >
                      {isDuplicating === field.id ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                  {field.can_delete && (
                    <Button
                      variant="outline"
                      size="sm"
                      data-testid={`delete-${field.id}`}
                      onClick={() => {
                        const fieldId = field.id;
                        const fieldName = field.name ?? "";
                        if (fieldId) handleDeleteClick(fieldId, fieldName);
                      }}
                      aria-label={`Delete ${field.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0 flex-grow flex flex-col justify-end">
          {columnVisibility["card_description"] !== false && (
            <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
              {field.description || "No description available"}
            </p>
          )}
          {/* Parameters and Departments */}
          <div className="flex flex-col gap-2 text-xs text-muted-foreground">
            {columnVisibility["card_parameters"] !== false && field.conditional_parameter_ids && field.conditional_parameter_ids.length > 0 && (
              <div className="flex flex-wrap gap-1">
                <span className="font-medium">Parameters:</span>
                {field.conditional_parameter_ids.slice(0, 3).map((pid) => (
                  <Badge key={pid} variant="outline" className="text-xs">
                    {parameterMapping[pid]?.["name"] || pid.slice(0, 8)}
                  </Badge>
                ))}
                {field.conditional_parameter_ids.length > 3 && (
                  <Badge variant="outline" className="text-xs">
                    +{field.conditional_parameter_ids.length - 3} more
                  </Badge>
                )}
              </div>
            )}
            {columnVisibility["card_departments"] !== false && field.department_ids && field.department_ids.length > 0 && (
              <div className="flex flex-wrap gap-1">
                <span className="font-medium">Departments:</span>
                {field.department_ids.slice(0, 2).map((did) => (
                  <Badge key={did} variant="outline" className="text-xs">
                    {departmentMapping[did]?.name || did.slice(0, 8)}
                  </Badge>
                ))}
                {field.department_ids.length > 2 && (
                  <Badge variant="outline" className="text-xs">
                    +{field.department_ids.length - 2} more
                  </Badge>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  // Get column references for toolbar
  const nameColumn = table.getColumn("name");
  const parameterColumn = table.getColumn("parameters");
  const personaColumn = table.getColumn("personas");
  const departmentsColumn = table.getColumn("departments");
  const isFiltered = table.getState().columnFilters.length > 0;

  // Visible ghosts (non-terminal states) — used to keep the grid
  // rendered even when the SSR result is empty so the user sees the
  // in-flight create card immediately (e.g. first field on a fresh
  // org). ``committed``/``accepted`` are dropped — the real row has
  // already merged into ``mergedFields``.
  const visibleGhosts = useMemo(
    () =>
      fieldGhosts.filter(
        (g) => g.state !== "committed" && g.state !== "accepted",
      ),
    [fieldGhosts],
  );

  return (
    <div className="space-y-6">
      {fields.length === 0 && visibleGhosts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12">
          <p className="text-muted-foreground">No fields found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Toolbar — swaps between filter bar and selection action bar */}
          {selectedCount > 0 ? (
            <div className="space-y-2" data-testid="fields-toolbar">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {deleteFieldAction && (
                  <Button
                    variant="destructive"
                    size="sm"
                    className="h-8"
                    onClick={() => setShowBulkDeleteDialog(true)}
                    disabled={!selectAllMatching && deletableFields.length === 0}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    {selectAllMatching
                      ? `Delete ${selectedCount} matching`
                      : `Delete ${deletableFields.length} of ${selectedCount}`}
                  </Button>
                )}
                {updateFieldAction && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8"
                    onClick={openBulkEditDialog}
                    disabled={!selectAllMatching && editableFields.length === 0}
                  >
                    <Pencil className="mr-2 h-4 w-4" />
                    {selectAllMatching
                      ? `Edit ${selectedCount} matching`
                      : `Edit ${editableFields.length} of ${selectedCount}`}
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
                hiddenColumns={["name", "description", "value", "parameters", "personas", "departments"]}
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
                  All {fields.length} on this page selected.
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
                  All {selectedCount} matching fields selected
                  {excludedFieldIds.length > 0 && ` (${excludedFieldIds.length} excluded)`}.
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
              data-testid="fields-toolbar"
            >
              <div className="flex flex-col md:flex-row md:flex-1 md:items-center md:space-x-2 gap-2 md:gap-0">
                <div className="w-full md:w-auto">
                  <Input
                    data-testid="fields-search"
                    placeholder="Search fields..."
                    value={(nameColumn?.getFilterValue() as string) ?? ""}
                    onChange={(event) =>
                      nameColumn?.setFilterValue(event.target.value)
                    }
                    className="h-8 w-full md:w-[150px] lg:w-[250px]"
                    aria-label="Search fields by name"
                    aria-controls="fields-grid"
                  />
                </div>

                <div className="flex items-center space-x-2 flex-wrap">
                  <ThreePickerFilters
                    slots={[
                      {
                        column: parameterColumn,
                        title: "Parameter",
                        options: parameterOptions,
                      },
                      {
                        column: personaColumn,
                        title: "Persona",
                        options: personaOptions,
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
                  hiddenColumns={["name", "description", "value", "parameters", "personas", "departments"]}
                />
              </div>
            </div>
          )}

          {/* Cards Grid — container-query driven; scales with content area width.
              Ghost cards from in-flight audited writes (create/duplicate/
              update/delete in non-terminal states) are prepended — same
              ``renderFieldCard`` so layout, dimensions, and visual
              language match exactly. Once a ghost commits, its
              hydrated row is in ``mergedRows`` (via ``state.added``)
              AND the ghost's ``state`` flips to "committed" — we
              filter those out so the real row replaces the ghost in
              place without a duplicate frame. */}
          <div className="@container">
            <div
              className="grid gap-4 @2xl:grid-cols-2 @5xl:grid-cols-3 @7xl:grid-cols-4"
              role="grid"
              aria-label="fields grid"
              data-testid="fields-grid"
            >
              {visibleGhosts.map((g) => {
                // For update/delete, ``before`` is the snapshot lookup
                // from baseRows (existing row) — gives us name,
                // description so the ghost card shows what's being
                // deleted/updated. For create/duplicate, ``before`` is
                // null and ``partial`` carries the streaming args
                // (often sparse for duplicate, richer for create).
                const fieldShell = (g.before ?? g.partial) as (typeof fields)[0];
                return (
                  <div key={`ghost-${g.callId}`}>
                    {renderFieldCard(fieldShell, g)}
                  </div>
                );
              })}
              {tableRows.length ? (
                tableRows.map((row) => {
                  const fieldRow = row.original;
                  const persistentGhost: Ghost<(typeof fields)[0]> | undefined =
                    fieldRow.pending_status === "pending" && fieldRow.pending_call_id
                      ? {
                          callId: fieldRow.pending_call_id,
                          op: (fieldRow.pending_operation as Ghost<(typeof fields)[0]>["op"]) ?? "create",
                          state: "pending",
                          rowId: fieldRow.id ?? null,
                          partial: fieldRow as unknown as Ghost<(typeof fields)[0]>["partial"],
                          before: fieldRow,
                          tool: null,
                          error: null,
                          arguments: {},
                        }
                      : undefined;
                  return renderFieldCard(fieldRow, persistentGhost);
                })
              ) : (
                visibleGhosts.length === 0 && (
                  <div className="col-span-full text-center py-8 text-muted-foreground">
                    No fields match the current filters.
                  </div>
                )
              )}
            </div>
          </div>

          {/* Pagination */}
          <DataTablePagination table={table} card={true} />
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent
          aria-labelledby="delete-field-title"
          data-testid="dialog-delete-field"
        >
          <AlertDialogHeader>
            <AlertDialogTitle id="delete-field-title">
              Delete Field
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteItem?.name}"? This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setShowDeleteDialog(false);
                setDeleteItem(null);
              }}
              data-testid="btn-cancel-delete-field"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="btn-confirm-delete-field"
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
        count={selectAllMatching ? selectedCount : deletableFields.length}
        entityLabel="field"
        entityLabelPlural="fields"
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
                  {" "}fields will be deleted server-side using the current filter.
                </p>
                {excludedFieldIds.length > 0 && (
                  <p className="mt-1">
                    {excludedFieldIds.length} explicitly excluded.
                  </p>
                )}
                <p className="mt-1">
                  Fields you don't have permission to delete will be skipped automatically.
                </p>
              </div>
            ) : (
              <>
                {deletableFields.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-destructive mb-1">Will be deleted:</p>
                    <ul className="text-sm space-y-0.5">
                      {deletableFields.map((f) => (
                        <li key={f.id} className="flex items-center gap-1.5">
                          <Trash2 className="h-3 w-3 text-destructive flex-shrink-0" />
                          {f.name || "Unnamed Field"}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {nonDeletableFields.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-yellow-600 dark:text-yellow-500 mb-1">
                      Cannot be deleted (in use):
                    </p>
                    <ul className="text-sm space-y-0.5">
                      {nonDeletableFields.map((f) => (
                        <li
                          key={f.id}
                          className="flex items-center gap-1.5 text-muted-foreground"
                        >
                          {f.name || "Unnamed Field"}
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
        count={selectAllMatching ? selectedCount : editableFields.length}
        entityLabelPlural="fields"
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
          artifactName="Fields"
          parseCsvAction={parseCsvAction}
          onSave={async (items) => {
            if (!createFieldAction) throw new Error("Create action not available");
            const fields = items.map((item) => ({
              name: item["name"] as string | undefined,
              description: item["description"] as string | undefined,
              value: item["value"] as string | undefined,
              departments: item["departments"] as string[] | undefined,
            }));
            return createFieldAction({ body: { fields } } as CreateFieldIn);
          }}
        />
      )}

    </div>
  );
}
