/**
 * Settings.tsx
 * Used to display the settings list page.
 * List-only component following Personas.tsx pattern
 */
"use client";
import { AlertCircle, Check, Edit, Eye, FileSpreadsheet, Loader2, Pencil, Settings as SettingsIcon, Trash2, X } from "lucide-react";
import { HoverPrefetchLink } from "@/components/common/HoverPrefetchLink";
import { useRouter } from "next/navigation";
import { parseAsArrayOf, parseAsBoolean, parseAsString, useQueryState } from "nuqs";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import { useArtifactGhosts, type Ghost } from "@/hooks/use-artifact-ghosts";
import { ackOperation } from "@/lib/api/ack";

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
  SettingsListOut,
  SettingsListBody,
  DeleteSettingIn,
  DeleteSettingOut,
  UpdateSettingIn,
  UpdateSettingOut,
  CreateSettingIn,
  CreateSettingOut,
} from "@/app/(main)/settings/page";
import BulkImport, { type ImportFieldDef, type ParseCsvResult } from "@/components/common/BulkImport";
import { ThreePickerFilters } from "@/components/common/table/ThreePickerFilters";
import { DataTablePagination } from "@/components/common/table/DataTablePagination";
import { DataTableViewOptions } from "@/components/common/table/DataTableViewOptions";
import { BulkDeleteDialog } from "@/components/common/forms/BulkDeleteDialog";
import { BulkEditDialog } from "@/components/common/forms/BulkEditDialog";
import { BulkEditFlagField } from "@/components/common/forms/BulkEditFlagField";
import { useColumnVisibility } from "@/hooks/use-column-visibility";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useSettingAi } from "@/hooks/use-setting-ai";
import { useProfile } from "@/contexts/profile-context";

export interface SettingsProps {
  // Server-provided data (for server-side rendering)
  listData: SettingsListOut;
  // SSR column visibility from cookie
  initialColumnVisibility?: VisibilityState;
  deleteSettingAction?: (input: DeleteSettingIn) => Promise<DeleteSettingOut>;
  updateSettingAction?: (input: UpdateSettingIn) => Promise<UpdateSettingOut>;
  createSettingAction?: (input: CreateSettingIn) => Promise<CreateSettingOut>;
  parseCsvAction?: (formData: FormData) => Promise<ParseCsvResult>;
  importFields?: ImportFieldDef[];
  /** The body the page used for its SSR ``/setting/search`` call.
   *  Forwarded as the filter envelope on bulk delete/update calls
   *  when the user is in ``selectAll=1`` mode — the server resolves
   *  matching rows directly, no client-side enumeration. */
  currentSearchBody?: SettingsListBody;
  /** Total number of matching rows server-side. Used to decide
   *  whether to surface the "Select all N matching" affordance and
   *  to size the all-matching mode count. */
  totalCount?: number;
}

const SETTINGS_INITIAL_COLUMN_VISIBILITY: VisibilityState = {
  // Hidden faceting columns
  departments: false,
  provider_ids: false,
  auth_ids: false,
  system_ids: false,
  // Toggleable card sections
  status_badge: true,
  departments_count: true,
  card_description: true,
};

export default function Settings({
  listData: serverListData,
  initialColumnVisibility,
  deleteSettingAction,
  updateSettingAction,
  createSettingAction,
  parseCsvAction,
  importFields,
  currentSearchBody,
  totalCount,
}: SettingsProps) {
  const { departmentIds } = useProfile();
  const router = useRouter();

  useSettingAi({
    onComplete: () => router.refresh(),
  });

  // Table state
  const [showBulkImportDialog, setShowBulkImportDialog] = useState(false);
  const [rowSelection, setRowSelection] = useState({});
  const [columnVisibility, setColumnVisibility] = useColumnVisibility(
    "settings",
    initialColumnVisibility ?? SETTINGS_INITIAL_COLUMN_VISIBILITY,
  );
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = useState<SortingState>([
    { id: "created_at", desc: true },
  ]);

  // Use server-provided data directly
  const settingsData = serverListData;

  // SSR-seeded base list. The audit-driven ghost hook layers
  // create/update/delete/duplicate lifecycle on top — committed rows
  // get merged into ``mergedSettings`` directly so the table stays
  // current without a ``router.refresh()`` (which would re-burst the
  // page's SSR fetches — see GenerationPanel handleSend rationale).
  const baseSettings = useMemo(() => {
    return settingsData?.settings || [];
  }, [settingsData?.settings]);

  const {
    ghosts: settingGhosts,
    mergedRows: mergedSettings,
    ack: ackSettingGhost,
    drop: _dropSettingGhost,
  } = useArtifactGhosts({
    artifactType: "setting",
    // All four CRUD ops the LLM might invoke or the user might trigger
    // from the toolbar/card. Each maps to a distinct ghost visual in
    // ``renderSettingCard`` (creating / updating / deleting /
    // duplicating skeleton + pending soft state). Without
    // ``duplicate`` here the LLM's duplicate tool dispatch fires
    // audit events that nothing is subscribed to → no ghost.
    ops: ["create", "update", "delete", "duplicate"],
    baseRows: baseSettings,
    rowKey: "id",
    // ``settings`` plural matches the field name the create /
    // duplicate / update impls now include on their responses (see
    // ``hydrate_setting_list_rows``). The hook reads ``output.settings``
    // from the audit ``.completed`` payload to materialize new/changed
    // rows directly — no SSR refresh needed.
    artifactPlural: "settings",
  });

  // Downstream code reads ``settings`` — keep that name to minimize
  // diff. The active list is the merged view (base + create overlays
  // − delete overlays).
  const settings = mergedSettings;

  // Unified ack: live ghosts → hook; persistent pending → ackOperation+refresh.
  const handleSettingAck = useCallback(
    async (callId: string, accept: boolean, op: Ghost<unknown>["op"]) => {
      const live = settingGhosts.find((g) => g.callId === callId);
      if (live) {
        await ackSettingGhost(callId, accept);
        return;
      }
      try {
        await ackOperation({
          artifact: "setting",
          operation: op,
          idempotencyKey: callId,
          accept,
        });
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Ack failed");
      }
    },
    [settingGhosts, ackSettingGhost, router],
  );

  // Flag catalog (e.g. setting_active) — used to look up the active flag id for bulk edit.
  const flagOptions = useMemo(() => {
    return (settingsData?.flag_filter?.options || [])
      .filter((opt): opt is typeof opt & { id: string; name: string } => !!opt.id && !!opt.name)
      .map((opt) => ({ id: opt.id!, name: opt.name!, type: opt.type ?? null }));
  }, [settingsData?.flag_filter]);

  // Picker filter options (all client-faceted; SearchSettingApiRequest is a
  // bare object — no facet search params at all).
  const providersOptions = useMemo(
    () =>
      (settingsData?.providers_filter?.options || [])
        .map((opt) => ({
          value: opt.id as string,
          label: opt.name as string,
          count: opt.count ?? undefined,
        }))
        .filter((opt) => opt.value && opt.label),
    [settingsData?.providers_filter]
  );

  const authOptions = useMemo(
    () =>
      (settingsData?.auth_filter?.options || [])
        .map((opt) => ({
          value: opt.id as string,
          label: opt.name as string,
          count: opt.count ?? undefined,
        }))
        .filter((opt) => opt.value && opt.label),
    [settingsData?.auth_filter]
  );

  const systemsOptions = useMemo(
    () =>
      (settingsData?.systems_filter?.options || [])
        .map((opt) => ({
          value: opt.id as string,
          label: (opt.name as string) || (opt.id as string),
          count: opt.count ?? undefined,
        }))
        .filter((opt) => opt.value),
    [settingsData?.systems_filter]
  );

  // Selection state — URL-backed so it survives refresh and is
  // craftable as a shareable / LLM-generated focus link. Three params
  // model the full state machine:
  //
  //   - ``selectedIds=A,B``       → explicit selection of named rows
  //   - ``selectAll=1``           → every row matching the active
  //                                 filters/search is selected
  //   - ``selectAll=1&excludedIds=X``
  //                               → all-matching minus exclusions
  //   - (none of the above)       → empty selection
  //
  // The all-matching mode keeps the URL compact for huge datasets
  // (one boolean instead of N ids) and follows the active filter —
  // change the filter and "all matching" follows naturally. Shallow
  // updates skip the RSC re-fetch burst.
  const [selectedSettingIds, setSelectedSettingIds] = useQueryState(
    "selectedIds",
    parseAsArrayOf(parseAsString).withDefault([]).withOptions({ shallow: true }),
  );
  const [selectAllMatching, setSelectAllMatching] = useQueryState(
    "selectAll",
    parseAsBoolean.withDefault(false).withOptions({ shallow: true }),
  );
  const [excludedSettingIds, setExcludedSettingIds] = useQueryState(
    "excludedIds",
    parseAsArrayOf(parseAsString).withDefault([]).withOptions({ shallow: true }),
  );

  // ---- Selection helpers ----------------------------------------
  // ``isSelected`` is the single read predicate every row uses; it
  // dispatches between explicit-id and all-matching modes so
  // downstream code never needs to branch. ``selectedCount`` mirrors
  // that — under all-matching it's ``totalCount - excludedIds.length``.

  const totalMatchingCount = totalCount ?? settings.length;

  const isSelected = useCallback(
    (id: string | null | undefined) => {
      if (!id) return false;
      return selectAllMatching
        ? !excludedSettingIds.includes(id)
        : selectedSettingIds.includes(id);
    },
    [selectAllMatching, excludedSettingIds, selectedSettingIds],
  );

  const selectedCount = selectAllMatching
    ? Math.max(0, totalMatchingCount - excludedSettingIds.length)
    : selectedSettingIds.length;

  const selectedSettings = useMemo(() => {
    return settings.filter((s) => s.id && isSelected(s.id));
  }, [settings, isSelected]);
  const deletableSettings = useMemo(
    () => selectedSettings.filter((s) => s.can_delete),
    [selectedSettings],
  );
  const nonDeletableSettings = useMemo(
    () => selectedSettings.filter((s) => !s.can_delete),
    [selectedSettings],
  );
  const editableSettings = useMemo(
    () => selectedSettings.filter((s) => s.can_edit ?? true),
    [selectedSettings],
  );

  // Toggle selection for a single setting. Under all-matching mode
  // we toggle membership in excludedSettingIds (deselect ⇒ add to
  // exclusions, re-select ⇒ remove). Under explicit mode it's the
  // straight selectedSettingIds toggle.
  const toggleSelection = useCallback((settingsId: string) => {
    if (selectAllMatching) {
      void setExcludedSettingIds((prev) =>
        prev.includes(settingsId)
          ? prev.filter((id) => id !== settingsId)
          : [...prev, settingsId],
      );
    } else {
      void setSelectedSettingIds((prev) =>
        prev.includes(settingsId)
          ? prev.filter((id) => id !== settingsId)
          : [...prev, settingsId],
      );
    }
  }, [selectAllMatching, setExcludedSettingIds, setSelectedSettingIds]);

  const clearSelection = useCallback(() => {
    void setSelectedSettingIds([]);
    void setSelectAllMatching(false);
    void setExcludedSettingIds([]);
  }, [setSelectedSettingIds, setSelectAllMatching, setExcludedSettingIds]);

  const selectAllOnPage = useCallback(() => {
    const pageIds = settings.filter((s) => s.id).map((s) => s.id!);
    void setSelectAllMatching(false);
    void setExcludedSettingIds([]);
    void setSelectedSettingIds((prev) => Array.from(new Set([...prev, ...pageIds])));
  }, [settings, setSelectAllMatching, setExcludedSettingIds, setSelectedSettingIds]);

  const allPageSelected = useMemo(() => {
    const pageIds = settings.filter((s) => s.id).map((s) => s.id!);
    if (pageIds.length === 0) return false;
    return pageIds.every((id) => isSelected(id));
  }, [settings, isSelected]);

  // Whether there ARE more matching rows than what's loaded on this
  // page — used to decide whether to surface the "Select all N
  // matching" affordance after the user selects the page.
  const hasMoreThanCurrentPage = totalMatchingCount > settings.length;

  /** Promote the current page-only selection into "all matching
   *  filter" mode. Clears explicit ids and exclusions — the all-
   *  matching mode is the canonical truth from this point. */
  const selectAllMatchingNow = useCallback(() => {
    void setSelectedSettingIds([]);
    void setExcludedSettingIds([]);
    void setSelectAllMatching(true);
  }, [setSelectedSettingIds, setExcludedSettingIds, setSelectAllMatching]);

  // Bulk delete state
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // Bulk edit state
  const [showBulkEditDialog, setShowBulkEditDialog] = useState(false);
  const [isBulkEditing, setIsBulkEditing] = useState(false);
  const [bulkEditActiveStatus, setBulkEditActiveStatus] = useState<boolean | null>(null);

  const handleBulkDelete = async () => {
    // Either explicit-mode (deletable rows on current page) OR
    // all-matching mode (server resolves rows via filter). Both
    // converge on the same ``deleteSettingAction`` call shape; the
    // body just differs.
    if (!deleteSettingAction) return;
    if (!selectAllMatching && deletableSettings.length === 0) return;

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
            excluded_ids: excludedSettingIds,
            ...(currentSearchBody ?? {}),
            accept: true,
          }
        : {
            setting_ids: deletableSettings.map((s) => s.id!),
            accept: true,
          };

      const result = await deleteSettingAction({ body } as DeleteSettingIn);

      // Per-row results from the server: success entries are actual
      // deletions, failures are soft-skipped rows (no permission /
      // not found). Toast reflects both counts so the user knows
      // some rows were skipped without inspecting the receipt.
      const results = (result as DeleteSettingOut).results ?? [];
      const successCount = results.filter((r) => r.success).length;
      const skippedCount = results.length - successCount;
      if (skippedCount > 0) {
        toast.success(`${successCount} setting(s) deleted, ${skippedCount} skipped`);
      } else {
        toast.success(`${successCount} setting(s) deleted successfully`);
      }
      clearSelection();
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to delete settings";
      toast.error(msg.replace(/^\d{3}\s*/, "") || "Failed to delete settings");
    } finally {
      setIsBulkDeleting(false);
      setShowBulkDeleteDialog(false);
    }
  };

  const handleBulkEdit = async () => {
    if (!updateSettingAction) return;
    if (!selectAllMatching && editableSettings.length === 0) return;

    const hasActiveChange = bulkEditActiveStatus !== null;
    if (!hasActiveChange) {
      toast.error("No changes selected");
      return;
    }

    // Resolve canonical active flag id (so server doesn't have to look it up).
    const activeFlagId = flagOptions.find((f) => f.type === "setting_active")?.id;

    setIsBulkEditing(true);
    try {
      let body: UpdateSettingIn["body"];
      if (selectAllMatching) {
        // All-matching: the server can't preserve per-row flag state
        // (it doesn't know what each row's existing flags are), so
        // the active toggle becomes "set to this value across all
        // matching rows" — the same semantic as a manual sweep.
        const flag_ids: string[] = [];
        if (bulkEditActiveStatus && activeFlagId) flag_ids.push(activeFlagId);
        body = {
          all: true,
          excluded_ids: excludedSettingIds,
          ...(currentSearchBody ?? {}),
          patch: { flag_ids },
          accept: true,
        } as UpdateSettingIn["body"];
      } else {
        // Explicit: clone the patch per-row. With one flag
        // (setting_active), the array is either [activeFlagId] or [].
        const items = editableSettings.map((s) => {
          const flag_ids: string[] = [];
          if (bulkEditActiveStatus && activeFlagId) flag_ids.push(activeFlagId);
          return {
            id: s.id!,
            flag_ids,
          };
        });
        body = { settings: items } as UpdateSettingIn["body"];
      }

      const result = await updateSettingAction({ body } as UpdateSettingIn);

      // Per-row results — same soft-skip pattern as bulk delete.
      const results = (result as UpdateSettingOut).results ?? [];
      const successCount = results.filter((r) => r.success).length;
      const skippedCount = results.length - successCount;
      if (skippedCount > 0) {
        toast.success(`${successCount} setting(s) updated, ${skippedCount} skipped`);
      } else {
        toast.success(`${successCount} setting(s) updated successfully`);
      }
      clearSelection();
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to update settings";
      toast.error(msg.replace(/^\d{3}\s*/, "") || "Failed to update settings");
    } finally {
      setIsBulkEditing(false);
      setShowBulkEditDialog(false);
    }
  };

  const openBulkEditDialog = () => {
    setBulkEditActiveStatus(null);
    setShowBulkEditDialog(true);
  };

  // Define table columns
  const columns: ColumnDef<(typeof settings)[number]>[] = useMemo(() => {
    return [
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => {
          const setting = row.original;
          return (
            <div className="font-medium">
              {setting.name || "Unnamed Setting"}
            </div>
          );
        },
      },
      {
        accessorKey: "description",
        header: "Description",
        cell: ({ row }) => {
          const setting = row.original;
          return (
            <div className="text-sm text-muted-foreground">
              {setting.description || "No description available"}
            </div>
          );
        },
      },
      // Hidden faceting column for Departments (array of IDs)
      {
        id: "departments",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: (typeof settings)[number]) =>
          row.department_ids ?? [],
        filterFn: (row, _id, value: string[]) => {
          const rowIds = (row.getValue("departments") as string[]) ?? [];
          if (value.length === 0) return true;
          if (rowIds.length === 0) return true; // Show cross-department items when no filter
          return value.some((v) => rowIds.includes(v));
        },
      },
      // Hidden faceting column for Providers (client-faceted)
      {
        id: "provider_ids",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        enableColumnFilter: true,
        accessorFn: (row: (typeof settings)[number]) => row.provider_ids ?? [],
        filterFn: (row, id, filterValue: string[]) =>
          !filterValue?.length || filterValue.some((v) => ((row.getValue(id) as string[]) ?? []).includes(v)),
      },
      // Hidden faceting column for Auths (client-faceted)
      {
        id: "auth_ids",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        enableColumnFilter: true,
        accessorFn: (row: (typeof settings)[number]) => row.auth_ids ?? [],
        filterFn: (row, id, filterValue: string[]) =>
          !filterValue?.length || filterValue.some((v) => ((row.getValue(id) as string[]) ?? []).includes(v)),
      },
      // Hidden faceting column for Systems (client-faceted)
      {
        id: "system_ids",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        enableColumnFilter: true,
        accessorFn: (row: (typeof settings)[number]) => row.system_ids ?? [],
        filterFn: (row, id, filterValue: string[]) =>
          !filterValue?.length || filterValue.some((v) => ((row.getValue(id) as string[]) ?? []).includes(v)),
      },
      {
        accessorKey: "active",
        header: "Status",
        cell: ({ row }) => {
          const setting = row.original;
          return (
            <div className="text-sm">
              {setting.active ? (
                <Badge variant="default">Active</Badge>
              ) : (
                <Badge variant="secondary">Inactive</Badge>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: "created_at",
        header: "Created",
        cell: ({ row }) => {
          const createdAt = row.original.created_at;
          if (!createdAt) {
            return <div className="text-sm text-muted-foreground">—</div>;
          }
          const date = new Date(createdAt);
          return (
            <div className="text-sm text-muted-foreground">
              {date.toLocaleDateString()}
            </div>
          );
        },
      },
      // Virtual columns for card view toggles
      {
        id: "status_badge",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: (typeof settings)[number]) => row.active ?? false,
      },
      {
        id: "departments_count",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: (typeof settings)[number]) => row.department_ids?.length ?? 0,
      },
      {
        id: "card_description",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: (typeof settings)[number]) => row.description ?? "",
      },
    ];
  }, []);

  // Create table instance
  const table = useReactTable({
    data: settings,
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

  // Memoize table rows. Including ``settings`` itself (not just
  // ``settings.length``) so update events that mutate row content but
  // not list cardinality still invalidate the memo. ``settings`` is
  // stabilized upstream by ``mergedSettings``'s useMemo, so a new
  // reference only appears when ``state.added`` / ``replaced`` /
  // ``hiddenIds`` actually change — no spurious recomputes.
  const pageIndex = table.getState().pagination.pageIndex;
  const pageSize = table.getState().pagination.pageSize;
  const sortingKey = JSON.stringify(sorting);
  const columnFiltersKey = JSON.stringify(columnFilters);
  const tableRows = useMemo(() => {
    return table.getRowModel().rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortingKey, columnFiltersKey, settings, pageIndex, pageSize]);

  const renderSettingCard = (
    setting: (typeof settings)[0],
    ghost?: Ghost<(typeof settings)[0]>,
  ) => {
    const settingsId = setting?.id;
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

    // Mode-aware: under all-matching, every loaded row whose id isn't
    // in ``excludedSettingIds`` reads as selected; under explicit it's
    // the straight ``selectedSettingIds.includes`` check. Delegated to
    // the outer ``isSelected`` so the row branch stays single-source.
    const isCardSelected = !isGhost && isSelected(settingsId);
    const handleCardClick = (e: React.MouseEvent) => {
      // Don't toggle selection if clicking action buttons or when
      // rendering as a ghost (no real id to select yet).
      if (isGhost) return;
      if ((e.target as HTMLElement).closest("[data-action-button]")) return;
      if (settingsId) {
        toggleSelection(settingsId);
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
        key={settingsId}
        className={`group hover:shadow-md transition-all ${
          isGhost ? "" : "cursor-pointer"
        } ${ghostBorderClass} ${isCardSelected ? "ring-2 ring-primary" : ""}`}
        data-testid={isGhost ? "setting-ghost-card" : "setting-card"}
        data-setting-id={settingsId}
        data-ghost-state={ghostState}
        role="gridcell"
        aria-label={`setting card ${setting?.name || (isGhost ? "Generating" : "Unnamed Setting")}`}
        aria-selected={isCardSelected}
        aria-busy={inFlight ? true : undefined}
        onClick={handleCardClick}
      >
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div className="space-y-2 flex-1 min-w-0">
              <div className="flex items-center gap-2">
                {/* Selection checkbox — inline before icon. Hidden in
                    ghost mode (no row id to select yet). */}
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
                      checked={isCardSelected}
                      onCheckedChange={() => {
                        if (settingsId) toggleSelection(settingsId);
                      }}
                      className="rounded-full h-5 w-5"
                      aria-label={`Select setting ${setting?.name || "Unnamed"}`}
                    />
                  </div>
                )}
                <div className="p-2 rounded-lg shadow-lg flex-shrink-0 bg-primary/10">
                  {/* In-flight ghost without a hydrated row yet → spinner.
                      Once the row commits, the regular gear icon returns. */}
                  {inFlight && !setting?.name ? (
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  ) : (
                    <SettingsIcon className="h-4 w-4 text-primary" />
                  )}
                </div>
                <CardTitle className="text-lg truncate">
                  {setting?.name || (isGhost ? "Generating…" : "Unnamed Setting")}
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
                  {columnVisibility["status_badge"] !== false && (
                    setting?.active ? (
                      <Badge variant="default">Active</Badge>
                    ) : (
                      <Badge variant="secondary">Inactive</Badge>
                    )
                  )}
                  {columnVisibility["departments_count"] !== false && setting?.department_ids && setting.department_ids.length > 0 && (
                    <Badge variant="outline" className="text-xs">
                      {setting.department_ids.length} department
                      {setting.department_ids.length !== 1 ? "s" : ""}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 items-center" data-action-button>
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
                    onClick={() => handleSettingAck(ghost.callId, true, ghost.op)}
                  >
                    <Check className="mr-1 h-3.5 w-3.5" />
                    Accept
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8"
                    onClick={() => handleSettingAck(ghost.callId, false, ghost.op)}
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
              {!isGhost && settingsId && (
                <>
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    data-testid="btn-edit-setting"
                    title={`Edit setting ${setting?.name || "Unnamed"}`}
                    className="h-9 px-3"
                  >
                    <HoverPrefetchLink
                      href={`/settings/${settingsId}`}
                      delay={150}
                      aria-label={`Edit setting ${setting?.name || "Unnamed"}`}
                    >
                      <Edit className="h-4 w-4 md:mr-0 mr-2" />
                      <span className="md:hidden">Edit</span>
                    </HoverPrefetchLink>
                  </Button>
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    data-testid="btn-view-setting"
                    title={`View setting ${setting?.name || "Unnamed"}`}
                    className="h-9 px-3"
                  >
                    <HoverPrefetchLink
                      href={`/settings/${settingsId}`}
                      delay={150}
                      aria-label={`View setting ${setting?.name || "Unnamed"}`}
                    >
                      <Eye className="h-4 w-4 md:mr-0 mr-2" />
                      <span className="md:hidden">View</span>
                    </HoverPrefetchLink>
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardHeader>
        {columnVisibility["card_description"] !== false && (
          <CardContent className="pt-0 flex-grow flex flex-col">
            <p className="text-sm text-muted-foreground line-clamp-2 flex-grow">
              {setting?.description || "No description available"}
            </p>
          </CardContent>
        )}
      </Card>
    );
  };

  // Get column references for toolbar
  const nameColumn = table.getColumn("name");
  const providersColumn = table.getColumn("provider_ids");
  const authColumn = table.getColumn("auth_ids");
  const systemsColumn = table.getColumn("system_ids");
  const isFiltered = table.getState().columnFilters.length > 0;

  return (
    <div className="space-y-8" data-page="settings-index">
      <div className="space-y-4">
        {/* Toolbar — swaps between filter bar and selection action bar */}
        {selectedCount > 0 ? (
          <div className="space-y-2" data-testid="settings-toolbar">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {deleteSettingAction && (
                <Button
                  variant="destructive"
                  size="sm"
                  className="h-8"
                  onClick={() => setShowBulkDeleteDialog(true)}
                  disabled={!selectAllMatching && deletableSettings.length === 0}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {selectAllMatching
                    ? `Delete ${selectedCount} matching`
                    : `Delete ${deletableSettings.length} of ${selectedCount}`}
                </Button>
              )}
              {updateSettingAction && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={openBulkEditDialog}
                  disabled={!selectAllMatching && editableSettings.length === 0}
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  {selectAllMatching
                    ? `Edit ${selectedCount} matching`
                    : `Edit ${editableSettings.length} of ${selectedCount}`}
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
              hiddenColumns={["name", "description", "active", "created_at", "departments", "provider_ids", "auth_ids", "system_ids"]}
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
                All {settings.length} on this page selected.
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
                All {selectedCount} matching settings selected
                {excludedSettingIds.length > 0 && ` (${excludedSettingIds.length} excluded)`}.
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
          data-testid="settings-toolbar"
        >
          <div className="flex flex-col md:flex-row md:flex-1 md:items-center md:space-x-2 gap-2 md:gap-0">
            <div className="w-full md:w-auto">
              <Input
                data-testid="settings-search"
                placeholder="Search settings..."
                value={(nameColumn?.getFilterValue() as string) ?? ""}
                onChange={(event) =>
                  nameColumn?.setFilterValue(event.target.value)
                }
                className="h-8 w-full md:w-[150px] lg:w-[250px]"
                aria-label="Search settings by name"
                aria-controls="settings-grid"
              />
            </div>

            <div className="flex items-center space-x-2 flex-wrap">
              <ThreePickerFilters
                slots={[
                  {
                    column: providersColumn,
                    title: "Providers",
                    options: providersOptions,
                  },
                  {
                    column: authColumn,
                    title: "Auth",
                    options: authOptions,
                  },
                  {
                    column: systemsColumn,
                    title: "Systems",
                    options: systemsOptions,
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
              hiddenColumns={["name", "description", "active", "created_at", "departments", "provider_ids", "auth_ids", "system_ids"]}
            />
          </div>
        </div>
        )}

        {/* Cards Grid — container-query driven; scales with content area width.

            Ghost cards from in-flight audited writes (create/duplicate/
            update/delete in non-terminal states) are prepended — same
            ``renderSettingCard`` so layout, dimensions, and visual
            language match exactly. Once a ghost commits, its hydrated
            row is in ``mergedRows`` (via ``state.added``) AND the
            ghost's ``state`` flips to "committed" — we filter those
            out so the real row replaces the ghost in place without a
            duplicate frame. */}
        <div className="@container">
          <div
            className="grid gap-4 @2xl:grid-cols-2 @5xl:grid-cols-3 @7xl:grid-cols-4"
            role="grid"
            aria-label="settings grid"
            data-testid="settings-grid"
          >
            {settingGhosts
              .filter((g) => g.state !== "committed" && g.state !== "accepted")
              .map((g) => {
                // For update/delete, ``before`` is the snapshot lookup
                // from baseRows (existing row) — gives us name/desc/
                // status so the ghost card shows what's being deleted/
                // updated. For create/duplicate, ``before`` is null
                // and ``partial`` carries the streaming args.
                const settingShell = (g.before ?? g.partial) as (typeof settings)[number];
                return (
                  <div key={`ghost-${g.callId}`}>
                    {renderSettingCard(settingShell, g)}
                  </div>
                );
              })}
            {tableRows.length ? (
              tableRows.map((row) => {
                const setting = row.original;
                const persistentGhost: Ghost<(typeof settings)[0]> | undefined =
                  setting.pending_status === "pending" && setting.pending_call_id
                    ? {
                        callId: setting.pending_call_id,
                        op: (setting.pending_operation as Ghost<(typeof settings)[0]>["op"]) ?? "create",
                        state: "pending",
                        rowId: setting.id ?? null,
                        partial: setting as unknown as Ghost<(typeof settings)[0]>["partial"],
                        before: setting,
                        tool: null,
                        error: null,
                        arguments: {},
                      }
                    : undefined;
                return renderSettingCard(setting, persistentGhost);
              })
            ) : (
              settingGhosts.length === 0 && (
                <div className="col-span-full text-center py-8 text-muted-foreground">
                  No settings match the current filters.
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

      {/* Bulk Delete Confirmation Dialog */}
      <BulkDeleteDialog
        open={showBulkDeleteDialog}
        onOpenChange={setShowBulkDeleteDialog}
        count={selectAllMatching ? selectedCount : deletableSettings.length}
        entityLabel="setting"
        entityLabelPlural="settings"
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
                  {" "}settings will be deleted server-side using the current filter.
                </p>
                {excludedSettingIds.length > 0 && (
                  <p className="mt-1">
                    {excludedSettingIds.length} explicitly excluded.
                  </p>
                )}
                <p className="mt-1">
                  Settings you don't have permission to delete will be skipped automatically.
                </p>
              </div>
            ) : (
              <>
                {deletableSettings.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-destructive mb-1">Will be deleted:</p>
                    <ul className="text-sm space-y-0.5">
                      {deletableSettings.map((s) => (
                        <li key={s.id} className="flex items-center gap-1.5">
                          <Trash2 className="h-3 w-3 text-destructive flex-shrink-0" />
                          {s.name || "Unnamed Setting"}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {nonDeletableSettings.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-yellow-600 dark:text-yellow-500 mb-1">
                      Cannot be deleted (in use):
                    </p>
                    <ul className="text-sm space-y-0.5">
                      {nonDeletableSettings.map((s) => (
                        <li
                          key={s.id}
                          className="flex items-center gap-1.5 text-muted-foreground"
                        >
                          {s.name || "Unnamed Setting"}
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
        count={selectAllMatching ? selectedCount : editableSettings.length}
        entityLabelPlural="settings"
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
          artifactName="Settings"
          parseCsvAction={parseCsvAction}
          onSave={async (items) => {
            if (!createSettingAction) throw new Error("Create action not available");
            const settings = items.map((item) => ({
              name: item["name"] as string | undefined,
              description: item["description"] as string | undefined,
              departments: item["departments"] as string[] | undefined,
            }));
            return createSettingAction({ body: { settings } } as CreateSettingIn);
          }}
        />
      )}
    </div>
  );
}
