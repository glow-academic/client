/**
 * Auths.tsx
 * Auth component showing overview of auth entries
 */
"use client";
import {
  AlertCircle,
  Check,
  Copy,
  Edit,
  Eye,
  Key,
  Loader2,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import { HoverPrefetchLink } from "@/components/common/HoverPrefetchLink";
import { useRouter } from "next/navigation";
import { parseAsArrayOf, parseAsBoolean, parseAsString, useQueryState } from "nuqs";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { ackOperation } from "@/lib/api/ack";

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
import { ThreePickerFilters } from "@/components/common/table/ThreePickerFilters";
import { DataTableViewOptions } from "@/components/common/table/DataTableViewOptions";
import { BulkDeleteDialog } from "@/components/common/forms/BulkDeleteDialog";
import { BulkEditDialog } from "@/components/common/forms/BulkEditDialog";
import { BulkEditFlagField } from "@/components/common/forms/BulkEditFlagField";
import { useAuthAi } from "@/hooks/use-auth-ai";
import { useArtifactGhosts, type Ghost } from "@/hooks/use-artifact-ghosts";
import { useColumnVisibility } from "@/hooks/use-column-visibility";
import { useProfile } from "@/contexts/profile-context";

import type {
  AuthListOut,
  AuthsListBody,
  DeleteAuthIn,
  DeleteAuthOut,
  DuplicateAuthIn,
  DuplicateAuthOut,
  UpdateAuthIn,
  UpdateAuthOut,
} from "@/app/(main)/system/auth/page";

export interface AuthsProps {
  // Server-provided data (for server-side rendering)
  listData: AuthListOut;
  // SSR column visibility from cookie
  initialColumnVisibility?: VisibilityState;
  // Server actions (replaces useMutation)
  duplicateAuthAction?: (input: DuplicateAuthIn) => Promise<DuplicateAuthOut>;
  deleteAuthAction?: (input: DeleteAuthIn) => Promise<DeleteAuthOut>;
  updateAuthAction?: (input: UpdateAuthIn) => Promise<UpdateAuthOut>;
  /** The body the page used for its SSR ``/auth/search`` call.
   *  Forwarded as the filter fields on bulk delete/update calls
   *  when the user is in ``selectAll=1`` mode — the server resolves
   *  matching rows directly, no client-side enumeration. */
  currentSearchBody?: AuthsListBody;
}

const AUTHS_INITIAL_COLUMN_VISIBILITY: VisibilityState = {
  // Hidden faceting columns — always off
  departments: false,
  setting_ids: false,
  auth_item_key_ids: false,
  // Toggleable card sections — default on
  num_items: true,
  status_badge: true,
  card_description: true,
};

export default function Auths({
  listData: serverListData,
  initialColumnVisibility,
  duplicateAuthAction,
  deleteAuthAction,
  updateAuthAction,
  currentSearchBody,
}: AuthsProps) {
  const router = useRouter();
  const { profile } = useProfile();

  // Ghost-rail materializes audit-driven create/update/delete/duplicate
  // outcomes directly from `.completed` payloads, so the page no longer
  // needs to ``router.refresh()`` on AI generation completion (which
  // would re-burst the SSR fetches).
  useAuthAi({});

  const [isDuplicating, setIsDuplicating] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteItem, setDeleteItem] = useState<{
    id: string;
    name: string;
  } | null>(null);

  // Use server-provided data directly
  const authsData = serverListData;

  // SSR-seeded base list. The audit-driven ghost hook layers
  // create/update/delete/duplicate lifecycle on top — committed rows
  // get merged into ``mergedAuths`` directly so the table stays
  // current without a ``router.refresh()`` (which would re-burst the
  // page's SSR fetches).
  const baseAuths = useMemo(() => authsData?.auths || [], [authsData?.auths]);

  const {
    ghosts: authGhosts,
    mergedRows: mergedAuths,
    ack: ackAuthGhost,
  } = useArtifactGhosts({
    artifactType: "auth",
    // All four CRUD ops the LLM might invoke or the user might trigger
    // from the toolbar/card. Each maps to a distinct ghost visual in
    // ``renderAuthCard`` (creating / updating / deleting /
    // duplicating skeleton + pending soft state).
    ops: ["create", "update", "delete", "duplicate"],
    baseRows: baseAuths,
    rowKey: "auth_id",
    // ``auths`` plural matches the field name the create / duplicate /
    // update impls now include on their responses (see
    // ``hydrate_auth_list_rows``). The hook reads ``output.auths``
    // from the audit ``.completed`` payload to materialize new/changed
    // rows directly — no SSR refresh needed.
    artifactPlural: "auths",
  });

  // Downstream code reads ``auths`` — keep that name to minimize diff.
  // Active list is the merged view (base + create overlays − delete overlays).
  const auths = mergedAuths;

  // Unified ack handler: live in-flight ghosts go through the hook;
  // server-side persistent pending rows ack via the generic action
  // and refresh. Mirrors ``Personas.tsx::handlePersonaAck``.
  const handleAuthAck = useCallback(
    async (callId: string, accept: boolean, op: Ghost<unknown>["op"]) => {
      const live = authGhosts.find((g) => g.callId === callId);
      if (live) {
        await ackAuthGhost(callId, accept);
        return;
      }
      try {
        await ackOperation({
          artifact: "auth",
          operation: op,
          idempotencyKey: callId,
          accept,
        });
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Ack failed");
      }
    },
    [authGhosts, ackAuthGhost, router],
  );
  void handleAuthAck;

  // Flag catalog (e.g. auth_active) — used to reconstruct flag_ids on bulk edit.
  const flagOptions = useMemo(() => {
    return (authsData?.flag_filter?.options || [])
      .filter((opt): opt is typeof opt & { id: string; name: string } => !!opt.id && !!opt.name)
      .map((opt) => ({ id: opt.id!, name: opt.name!, type: opt.type ?? null }));
  }, [authsData?.flag_filter]);

  // Department filter options (server returns the full catalog; faceting is client-side
  // because the auth search endpoint is currently call-and-forget without query params).
  const departmentOptions = useMemo(
    () =>
      (authsData?.department_filter?.options || [])
        .map((opt) => ({
          value: opt.id as string,
          label: opt.name as string,
          count: opt.count ?? undefined,
        }))
        .filter((opt) => opt.value && opt.label),
    [authsData?.department_filter]
  );

  const settingsOptions = useMemo(
    () =>
      (authsData?.settings_filter?.options || [])
        .map((opt) => ({
          value: opt.id as string,
          label: opt.name as string,
          count: opt.count ?? undefined,
        }))
        .filter((opt) => opt.value && opt.label),
    [authsData?.settings_filter]
  );

  // auth_item_keys options sometimes carry no `name` (raw keys); fall back to id.
  const authItemKeysOptions = useMemo(
    () =>
      (authsData?.auth_item_keys_filter?.options || [])
        .map((opt) => ({
          value: opt.id as string,
          label: (opt.name as string) || (opt.id as string),
          count: opt.count ?? undefined,
        }))
        .filter((opt) => opt.value),
    [authsData?.auth_item_keys_filter]
  );

  // Table state — needed so the picker slots have columns to drive.
  const [columnVisibility, setColumnVisibility] = useColumnVisibility(
    "auths",
    initialColumnVisibility ?? AUTHS_INITIAL_COLUMN_VISIBILITY,
  );
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = useState<SortingState>([]);

  // Hidden faceting columns for all three picker slots. All three are
  // client-faceted (auth search endpoint takes no facet search params today).
  const columns: ColumnDef<(typeof auths)[number]>[] = useMemo(
    () => [
      {
        id: "departments",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        enableColumnFilter: true,
        accessorFn: (row: (typeof auths)[number]) => row.department_ids ?? [],
        filterFn: (row, _id, value: string[]) => {
          if (!value?.length) return true;
          const rowIds = (row.getValue("departments") as string[]) ?? [];
          if (rowIds.length === 0) return true; // cross-department items always match
          return value.some((v) => rowIds.includes(v));
        },
      },
      {
        id: "setting_ids",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        enableColumnFilter: true,
        accessorFn: (row: (typeof auths)[number]) => row.setting_ids ?? [],
        filterFn: (row, id, filterValue: string[]) =>
          !filterValue?.length || filterValue.some((v) => ((row.getValue(id) as string[]) ?? []).includes(v)),
      },
      {
        id: "auth_item_key_ids",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        enableColumnFilter: true,
        accessorFn: (row: (typeof auths)[number]) => row.auth_item_key_ids ?? [],
        filterFn: (row, id, filterValue: string[]) =>
          !filterValue?.length || filterValue.some((v) => ((row.getValue(id) as string[]) ?? []).includes(v)),
      },
      // Virtual columns for card view toggles
      {
        id: "num_items",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: (typeof auths)[number]) => row.item_count ?? 0,
      },
      {
        id: "status_badge",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: (typeof auths)[number]) => row.is_inactive ?? false,
      },
      {
        id: "card_description",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: (typeof auths)[number]) => row.description ?? "",
      },
    ],
    []
  );

  const table = useReactTable({
    data: auths,
    columns,
    state: {
      sorting,
      columnVisibility,
      columnFilters,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const departmentsColumn = table.getColumn("departments");
  const settingsColumn = table.getColumn("setting_ids");
  const authItemKeysColumn = table.getColumn("auth_item_key_ids");
  const isFiltered = table.getState().columnFilters.length > 0;

  // Selection state — URL-backed so it survives refresh and is
  // craftable as a shareable / LLM-generated link. Three params model
  // the full state machine:
  //
  //   - ``selectedIds=A,B``        → explicit selection
  //   - ``selectAll=1``            → every row matching the active
  //                                  filters is selected
  //   - ``selectAll=1&excludedIds=X``
  //                                → all-matching minus exclusions
  //
  // The all-matching mode keeps the URL compact for huge datasets and
  // follows the active filter — change the filter and "all matching"
  // follows naturally.
  const [selectedAuthIds, setSelectedAuthIds] = useQueryState(
    "selectedIds",
    parseAsArrayOf(parseAsString).withDefault([]).withOptions({ shallow: true }),
  );
  const [selectAllMatching, setSelectAllMatching] = useQueryState(
    "selectAll",
    parseAsBoolean.withDefault(false).withOptions({ shallow: true }),
  );
  const [excludedAuthIds, setExcludedAuthIds] = useQueryState(
    "excludedIds",
    parseAsArrayOf(parseAsString).withDefault([]).withOptions({ shallow: true }),
  );

  // Total matching is the server-reported total_count under the active
  // filter; under all-matching mode it's the universe of rows the
  // server will write to (minus exclusions).
  const totalMatchingCount = authsData?.total_count ?? auths.length;

  const isSelected = useCallback(
    (id: string | null | undefined) => {
      if (!id) return false;
      return selectAllMatching
        ? !excludedAuthIds.includes(id)
        : selectedAuthIds.includes(id);
    },
    [selectAllMatching, excludedAuthIds, selectedAuthIds],
  );

  const selectedCount = selectAllMatching
    ? Math.max(0, totalMatchingCount - excludedAuthIds.length)
    : selectedAuthIds.length;

  const selectedAuths = useMemo(() => {
    return auths.filter((a) => a.auth_id && isSelected(a.auth_id));
  }, [auths, isSelected]);
  const deletableAuths = useMemo(
    () => selectedAuths.filter((a) => a.can_delete),
    [selectedAuths],
  );
  const nonDeletableAuths = useMemo(
    () => selectedAuths.filter((a) => !a.can_delete),
    [selectedAuths],
  );
  const editableAuths = useMemo(
    () => selectedAuths.filter((a) => a.can_edit ?? true),
    [selectedAuths],
  );

  const toggleSelection = useCallback((authId: string) => {
    if (selectAllMatching) {
      void setExcludedAuthIds((prev) =>
        prev.includes(authId)
          ? prev.filter((id) => id !== authId)
          : [...prev, authId],
      );
    } else {
      void setSelectedAuthIds((prev) =>
        prev.includes(authId)
          ? prev.filter((id) => id !== authId)
          : [...prev, authId],
      );
    }
  }, [selectAllMatching, setExcludedAuthIds, setSelectedAuthIds]);

  const clearSelection = useCallback(() => {
    void setSelectedAuthIds([]);
    void setSelectAllMatching(false);
    void setExcludedAuthIds([]);
  }, [setSelectedAuthIds, setSelectAllMatching, setExcludedAuthIds]);

  const selectAllOnPage = useCallback(() => {
    const pageIds = auths.filter((a) => a.auth_id).map((a) => a.auth_id!);
    void setSelectAllMatching(false);
    void setExcludedAuthIds([]);
    void setSelectedAuthIds((prev) => Array.from(new Set([...prev, ...pageIds])));
  }, [auths, setSelectAllMatching, setExcludedAuthIds, setSelectedAuthIds]);

  /** Promote the current page-only selection into "all matching
   *  filter" mode. Clears explicit ids and exclusions. */
  const selectAllMatchingNow = useCallback(() => {
    void setSelectedAuthIds([]);
    void setExcludedAuthIds([]);
    void setSelectAllMatching(true);
  }, [setSelectedAuthIds, setExcludedAuthIds, setSelectAllMatching]);

  const allPageSelected = useMemo(() => {
    const pageIds = auths.filter((a) => a.auth_id).map((a) => a.auth_id!);
    if (pageIds.length === 0) return false;
    return pageIds.every((id) => isSelected(id));
  }, [auths, isSelected]);

  const hasMoreThanCurrentPage = totalMatchingCount > auths.length;

  // Bulk delete state
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // Bulk edit state
  const [showBulkEditDialog, setShowBulkEditDialog] = useState(false);
  const [isBulkEditing, setIsBulkEditing] = useState(false);
  const [bulkEditActiveStatus, setBulkEditActiveStatus] = useState<boolean | null>(null);

  const handleDuplicate = async (auth: (typeof auths)[number]) => {
    if (!auth.can_duplicate || !duplicateAuthAction) {
      toast.error("This auth entry cannot be duplicated");
      return;
    }

    // Ensure profileId exists - required for API calls
    if (!profile?.id) {
      toast.error("Profile not loaded. Please refresh the page.");
      return;
    }

    setIsDuplicating(auth.auth_id ?? null);
    try {
      await duplicateAuthAction({
        body: { auth_id: auth.auth_id || "", accept: true },
      });
      toast.success(`Auth "${auth.name}" duplicated successfully`);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to duplicate auth entry"
      );
    } finally {
      setIsDuplicating(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteItem || !deleteAuthAction) return;

    // Ensure profileId exists - required for API calls
    if (!profile?.id) {
      toast.error("Profile not loaded. Please refresh the page.");
      return;
    }

    try {
      await deleteAuthAction({
        body: { auth_ids: [deleteItem.id], all: false, accept: true },
      });
      toast.success(`Auth "${deleteItem.name}" deleted successfully`);
      // Ghost rail materializes the deletion via the audit ``.completed``
      // payload — no router.refresh() needed.
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete auth entry"
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
    // converge on the same ``deleteAuthAction`` call shape; the body
    // just differs.
    if (!deleteAuthAction) return;
    if (!selectAllMatching && deletableAuths.length === 0) return;

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
            excluded_ids: excludedAuthIds,
            ...(currentSearchBody ?? {}),
            accept: true,
          }
        : {
            auth_ids: deletableAuths.map((a) => a.auth_id!),
            accept: true,
          };

      const result = await deleteAuthAction({ body } as DeleteAuthIn);

      // Per-row results from the server: success entries are actual
      // deletions, failures are soft-skipped rows (no permission /
      // not found). Toast reflects both counts so the user knows
      // some rows were skipped without inspecting the receipt.
      const results = (result as DeleteAuthOut).results ?? [];
      const successCount = results.filter((r) => r.success).length;
      const skippedCount = results.length - successCount;
      if (skippedCount > 0) {
        toast.success(
          `${successCount} auth(s) deleted, ${skippedCount} skipped`,
        );
      } else {
        toast.success(`${successCount} auth(s) deleted successfully`);
      }
      clearSelection();
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to delete auths";
      toast.error(msg.replace(/^\d{3}\s*/, "") || "Failed to delete auths");
    } finally {
      setIsBulkDeleting(false);
      setShowBulkDeleteDialog(false);
    }
  };

  const handleBulkEdit = async () => {
    if (!updateAuthAction) return;
    if (!selectAllMatching && editableAuths.length === 0) return;

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

    const activeFlagId = flagOptions.find((f) => f.type === "auth_active")?.id;

    setIsBulkEditing(true);
    try {
      let body: UpdateAuthIn["body"];
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
          excluded_ids: excludedAuthIds,
          ...(currentSearchBody ?? {}),
          patch: {
            ...(hasAnyFlagChange && { flag_ids }),
          },
          accept: true,
        } as UpdateAuthIn["body"];
      } else {
        // Explicit: clone the patch per-row.
        const items = editableAuths.map((a) => {
          let flag_ids: string[] | undefined;
          if (hasAnyFlagChange) {
            const isActive = bulkEditActiveStatus;
            flag_ids = isActive && activeFlagId ? [activeFlagId] : [];
          }
          return {
            id: a.auth_id!,
            ...(hasAnyFlagChange && { flag_ids }),
          };
        });
        body = { auths: items } as UpdateAuthIn["body"];
      }

      const result = await updateAuthAction({ body } as UpdateAuthIn);

      // Per-row results — same soft-skip pattern as bulk delete.
      const results = (result as UpdateAuthOut).results ?? [];
      const successCount = results.filter((r) => r.success).length;
      const skippedCount = results.length - successCount;
      if (skippedCount > 0) {
        toast.success(
          `${successCount} auth(s) updated, ${skippedCount} skipped`,
        );
      } else {
        toast.success(`${successCount} auth(s) updated successfully`);
      }
      clearSelection();
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to update auths";
      toast.error(msg.replace(/^\d{3}\s*/, "") || "Failed to update auths");
    } finally {
      setIsBulkEditing(false);
      setShowBulkEditDialog(false);
    }
  };

  const openBulkEditDialog = () => {
    setBulkEditActiveStatus(null);
    setShowBulkEditDialog(true);
  };

  const renderAuthCard = (
    auth: (typeof auths)[number],
    ghost?: Ghost<(typeof auths)[0]>,
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

    const count = auth.item_count ?? 0;
    const isCardSelected =
      !isGhost && auth.auth_id ? isSelected(auth.auth_id) : false;

    const handleCardClick = (e: React.MouseEvent) => {
      // Don't toggle selection if clicking action buttons or when
      // rendering as a ghost (no real id to select yet).
      if (isGhost) return;
      if ((e.target as HTMLElement).closest("[data-action-button]")) return;
      if (auth.auth_id) {
        toggleSelection(auth.auth_id);
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
        key={auth.auth_id}
        className={`group relative flex flex-col h-full hover:shadow-md transition-all ${
          isGhost ? "" : "cursor-pointer"
        } ${ghostBorderClass} ${isCardSelected ? "ring-2 ring-primary" : ""}`}
        data-testid={isGhost ? "auth-ghost-card" : "auth-card"}
        data-auth-id={auth.auth_id}
        data-ghost-state={ghostState}
        role="gridcell"
        aria-label={`auth card ${auth.name || (isGhost ? "Generating" : "Unnamed Auth")}`}
        aria-selected={isCardSelected}
        aria-busy={inFlight ? true : undefined}
        onClick={handleCardClick}
      >
        <CardHeader className="pb-3">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-lg flex items-center gap-2">
                {/* Selection checkbox — hidden in ghost mode (no row
                    id to select yet). */}
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
                        if (auth.auth_id) toggleSelection(auth.auth_id);
                      }}
                      className="rounded-full h-5 w-5"
                      aria-label={`Select auth ${auth.name || "Unnamed"}`}
                    />
                  </div>
                )}
                {/* In-flight ghost without a streamed name yet → spinner
                    in the title slot. */}
                {inFlight && !auth.name ? (
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground flex-shrink-0" />
                ) : (
                  <Key className="h-5 w-5" />
                )}
                <span className="truncate">
                  {auth.name || (isGhost ? "Generating…" : "")}
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
                {columnVisibility["num_items"] !== false && !isGhost && (
                  <Badge variant="outline">
                    {count} {count === 1 ? "item" : "items"}
                  </Badge>
                )}
                {columnVisibility["status_badge"] !== false && !isGhost && auth.is_inactive && (
                  <Badge variant="secondary" className="text-xs">
                    Inactive
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2" data-action-button>
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
                    onClick={() => ackAuthGhost(ghost.callId, true)}
                  >
                    <Check className="mr-1 h-3.5 w-3.5" />
                    Accept
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8"
                    onClick={() => ackAuthGhost(ghost.callId, false)}
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
              {!isGhost && auth.auth_id && (
                <>
                  {auth.can_edit ? (
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      data-testid="btn-edit-auth"
                      title={`Edit ${auth.name}`}
                      className="h-9 px-3"
                    >
                      <HoverPrefetchLink
                        href={`/system/auth/${auth.auth_id}`}
                        delay={150}
                        aria-label={`Edit ${auth.name}`}
                      >
                        <Edit className="h-4 w-4 md:mr-0 mr-2" />
                        <span className="md:hidden">Edit</span>
                      </HoverPrefetchLink>
                    </Button>
                  ) : (
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      data-testid="btn-view-auth"
                      title={`View ${auth.name}`}
                      className="h-9 px-3"
                    >
                      <HoverPrefetchLink
                        href={`/system/auth/${auth.auth_id}`}
                        delay={150}
                        aria-label={`View ${auth.name}`}
                      >
                        <Eye className="h-4 w-4 md:mr-0 mr-2" />
                        <span className="md:hidden">View</span>
                      </HoverPrefetchLink>
                    </Button>
                  )}
                  {auth.can_duplicate && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDuplicate(auth)}
                      disabled={isDuplicating === auth.auth_id}
                      aria-busy={isDuplicating === auth.auth_id ? true : undefined}
                      aria-label={`Duplicate ${auth.name}`}
                      data-testid="btn-duplicate-auth"
                      title={`Duplicate ${auth.name}`}
                      className="h-9 px-3"
                    >
                      {isDuplicating === auth.auth_id ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent md:mr-0 mr-2" />
                      ) : (
                        <Copy className="h-4 w-4 md:mr-0 mr-2" />
                      )}
                      <span className="md:hidden">
                        {isDuplicating === auth.auth_id
                          ? "Duplicating..."
                          : "Duplicate"}
                      </span>
                    </Button>
                  )}
                  {auth.can_delete && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        handleDeleteClick(auth.auth_id || "", auth.name || "")
                      }
                      aria-label={`Delete ${auth.name}`}
                      data-testid="btn-delete-auth"
                      title={`Delete ${auth.name}`}
                      className="h-9 px-3"
                    >
                      <Trash2 className="h-4 w-4 md:mr-0 mr-2" />
                      <span className="md:hidden">Delete</span>
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        </CardHeader>
        {columnVisibility["card_description"] !== false && (
          <CardContent className="flex-1">
            <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
              {auth.description}
            </p>
          </CardContent>
        )}
      </Card>
    );
  };

  // Visible ghosts (non-terminal states) — used to keep the grid
  // rendered even when the SSR result is empty so the user sees the
  // in-flight create card immediately. ``committed``/``accepted`` are
  // dropped — the real row has already merged into ``mergedAuths``.
  const visibleAuthGhosts = useMemo(
    () =>
      authGhosts.filter(
        (g) => g.state !== "committed" && g.state !== "accepted",
      ),
    [authGhosts],
  );

  return (
    <div className="space-y-6">
      {/* Toolbar — swaps between filter bar and selection action bar */}
      {selectedCount > 0 ? (
        <div className="space-y-2" data-testid="auths-toolbar">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {deleteAuthAction && (
                <Button
                  variant="destructive"
                  size="sm"
                  className="h-8"
                  onClick={() => setShowBulkDeleteDialog(true)}
                  disabled={!selectAllMatching && deletableAuths.length === 0}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {selectAllMatching
                    ? `Delete ${selectedCount} matching`
                    : `Delete ${deletableAuths.length} of ${selectedCount}`}
                </Button>
              )}
              {updateAuthAction && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={openBulkEditDialog}
                  disabled={!selectAllMatching && editableAuths.length === 0}
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  {selectAllMatching
                    ? `Edit ${selectedCount} matching`
                    : `Edit ${editableAuths.length} of ${selectedCount}`}
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
              hiddenColumns={["departments", "setting_ids", "auth_item_key_ids"]}
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
                All {auths.length} on this page selected.
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
                All {selectedCount} matching auths selected
                {excludedAuthIds.length > 0 && ` (${excludedAuthIds.length} excluded)`}.
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
        <div className="flex items-center justify-between flex-wrap gap-2" data-testid="auths-toolbar">
          <div className="flex items-center space-x-2 flex-wrap">
          <ThreePickerFilters
            slots={[
              {
                column: settingsColumn,
                title: "Settings",
                options: settingsOptions,
              },
              {
                column: authItemKeysColumn,
                title: "Auth Items",
                options: authItemKeysOptions,
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
          <div className="flex items-center gap-2">
            <DataTableViewOptions
              table={table}
              hiddenColumns={["departments", "setting_ids", "auth_item_key_ids"]}
            />
          </div>
        </div>
      )}

      {/* Auth Cards Grid — ghost cards from in-flight audited writes
          (create/duplicate/update/delete in non-terminal states) are
          prepended via the same ``renderAuthCard`` so layout, dimensions,
          and visual language match exactly. Once a ghost commits, its
          hydrated row is in ``mergedAuths`` (via ``state.added``) AND
          the ghost's ``state`` flips to "committed" — we filter those
          out so the real row replaces the ghost in place without a
          duplicate frame. */}
      {table.getRowModel().rows.length === 0 && visibleAuthGhosts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12">
          <p className="text-muted-foreground">
            {auths.length === 0 ? "No auth entries found" : "No auth entries match the current filters."}
          </p>
        </div>
      ) : (
        <div className="@container">
          <div className="grid grid-cols-1 @2xl:grid-cols-2 @5xl:grid-cols-3 @7xl:grid-cols-4 gap-4">
            {visibleAuthGhosts.map((g) => {
              // For update/delete, ``before`` is the snapshot lookup
              // from baseRows (existing row) — gives us name,
              // description so the ghost card shows what's being
              // deleted/updated. For create/duplicate, ``before`` is
              // null and ``partial`` carries the streaming args.
              const authShell = (g.before ?? g.partial) as (typeof auths)[0];
              return (
                <div key={`ghost-${g.callId}`}>
                  {renderAuthCard(authShell, g)}
                </div>
              );
            })}
            {table.getRowModel().rows.map((row) => {
              const auth = row.original;
              const persistentGhost: Ghost<(typeof auths)[0]> | undefined =
                auth.pending_status === "pending" && auth.pending_call_id
                  ? {
                      callId: auth.pending_call_id,
                      op: (auth.pending_operation as Ghost<(typeof auths)[0]>["op"]) ?? "create",
                      state: "pending",
                      rowId: auth.auth_id ?? null,
                      partial: auth as unknown as Ghost<(typeof auths)[0]>["partial"],
                      before: auth,
                      tool: null,
                      error: null,
                      arguments: {},
                    }
                  : undefined;
              return renderAuthCard(auth, persistentGhost);
            })}
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Auth Entry</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteItem?.name}"? This action
              cannot be undone and will remove all associated auth items.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteItem(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
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
        count={selectAllMatching ? selectedCount : deletableAuths.length}
        entityLabel="auth"
        entityLabelPlural="auths"
        isDeleting={isBulkDeleting}
        onConfirm={handleBulkDelete}
        description={
          <>
            <p>This action cannot be undone.</p>
            {selectAllMatching ? (
              // All-matching mode: server resolves rows from filter +
              // exclusions; per-row permission failures soft-skip.
              // We can't enumerate names without round-tripping through
              // the search endpoint, so show the count + filter state.
              <div className="text-sm text-muted-foreground">
                <p>
                  All <span className="font-medium text-foreground">{selectedCount}</span> matching
                  {" "}auths will be deleted server-side using the current filter.
                </p>
                {excludedAuthIds.length > 0 && (
                  <p className="mt-1">
                    {excludedAuthIds.length} explicitly excluded.
                  </p>
                )}
                <p className="mt-1">
                  Auths you don't have permission to delete will be skipped automatically.
                </p>
              </div>
            ) : (
              <>
                {deletableAuths.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-destructive mb-1">Will be deleted:</p>
                    <ul className="text-sm space-y-0.5">
                      {deletableAuths.map((a) => (
                        <li key={a.auth_id} className="flex items-center gap-1.5">
                          <Trash2 className="h-3 w-3 text-destructive flex-shrink-0" />
                          {a.name || "Unnamed Auth"}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {nonDeletableAuths.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-yellow-600 dark:text-yellow-500 mb-1">
                      Cannot be deleted (in use):
                    </p>
                    <ul className="text-sm space-y-0.5">
                      {nonDeletableAuths.map((a) => (
                        <li
                          key={a.auth_id}
                          className="flex items-center gap-1.5 text-muted-foreground"
                        >
                          {a.name || "Unnamed Auth"}
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
        count={selectAllMatching ? selectedCount : editableAuths.length}
        entityLabelPlural="auths"
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
