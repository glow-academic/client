/**
 * Auths.tsx
 * Auth component showing overview of auth entries
 */
"use client";
import { Copy, Edit, Eye, Key, Pencil, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
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
import { useColumnVisibility } from "@/hooks/use-column-visibility";
import { useProfile } from "@/contexts/profile-context";

import type {
  AuthListOut,
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
}: AuthsProps) {
  const router = useRouter();
  const { profile } = useProfile();

  useAuthAi({
    onComplete: () => router.refresh(),
  });

  const [isDuplicating, setIsDuplicating] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteItem, setDeleteItem] = useState<{
    id: string;
    name: string;
  } | null>(null);

  // Use server-provided data directly
  const authsData = serverListData;

  const auths = useMemo(() => authsData?.auths || [], [authsData]);

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

  // Selection state
  const [selectedAuthIds, setSelectedAuthIds] = useState<string[]>([]);
  const selectedCount = selectedAuthIds.length;
  const selectedAuths = useMemo(() => {
    return auths.filter((a) => a.auth_id && selectedAuthIds.includes(a.auth_id));
  }, [auths, selectedAuthIds]);
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
    setSelectedAuthIds((prev) =>
      prev.includes(authId)
        ? prev.filter((id) => id !== authId)
        : [...prev, authId]
    );
  }, []);
  const clearSelection = useCallback(() => setSelectedAuthIds([]), []);
  const selectAllOnPage = useCallback(() => {
    const pageIds = auths.filter((a) => a.auth_id).map((a) => a.auth_id!);
    setSelectedAuthIds((prev) => Array.from(new Set([...prev, ...pageIds])));
  }, [auths]);
  const allPageSelected = useMemo(() => {
    const pageIds = auths.filter((a) => a.auth_id).map((a) => a.auth_id!);
    return pageIds.length > 0 && pageIds.every((id) => selectedAuthIds.includes(id));
  }, [auths, selectedAuthIds]);

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
        body: { auth_ids: [deleteItem.id], accept: true },
      });
      toast.success(`Auth "${deleteItem.name}" deleted successfully`);
      router.refresh();
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
    if (!deleteAuthAction || deletableAuths.length === 0) return;
    setIsBulkDeleting(true);
    try {
      const ids = deletableAuths.map((a) => a.auth_id!);
      await deleteAuthAction({ body: { auth_ids: ids, accept: true } });
      toast.success(`${ids.length} auth(s) deleted successfully`);
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
    if (!updateAuthAction || editableAuths.length === 0) return;

    const hasActiveChange = bulkEditActiveStatus !== null;
    if (!hasActiveChange) {
      toast.error("No changes selected");
      return;
    }

    const activeFlagId = flagOptions.find((f) => f.type === "auth_active")?.id;

    setIsBulkEditing(true);
    try {
      const items = editableAuths.map((a) => {
        let flag_ids: string[] | undefined;
        if (hasActiveChange) {
          const isActive = bulkEditActiveStatus;
          flag_ids = isActive && activeFlagId ? [activeFlagId] : [];
        }
        return {
          id: a.auth_id!,
          ...(hasActiveChange && { flag_ids }),
        };
      });

      await updateAuthAction({ body: { auths: items } } as UpdateAuthIn);
      toast.success(`${items.length} auth(s) updated successfully`);
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

  const renderAuthCard = (auth: (typeof auths)[number]) => {
    const count = auth.item_count ?? 0;
    const isSelected = auth.auth_id ? selectedAuthIds.includes(auth.auth_id) : false;

    const handleCardClick = (e: React.MouseEvent) => {
      // Don't toggle selection if clicking action buttons
      if ((e.target as HTMLElement).closest("[data-action-button]")) return;
      if (auth.auth_id) {
        toggleSelection(auth.auth_id);
      }
    };

    return (
      <Card
        key={auth.auth_id}
        className={`group relative flex flex-col h-full hover:shadow-md transition-all cursor-pointer ${
          isSelected ? "ring-2 ring-primary" : ""
        }`}
        data-testid="auth-card"
        data-auth-id={auth.auth_id}
        role="gridcell"
        aria-label={`auth card ${auth.name}`}
        aria-selected={isSelected}
        onClick={handleCardClick}
      >
        <CardHeader className="pb-3">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-lg flex items-center gap-2">
                <div
                  className={`transition-all overflow-hidden flex-shrink-0 ${
                    selectedCount > 0
                      ? "w-5 opacity-100"
                      : "w-0 opacity-0 group-hover:w-5 group-hover:opacity-100"
                  }`}
                  data-action-button
                >
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => {
                      if (auth.auth_id) toggleSelection(auth.auth_id);
                    }}
                    className="rounded-full h-5 w-5"
                    aria-label={`Select auth ${auth.name || "Unnamed"}`}
                  />
                </div>
                <Key className="h-5 w-5" />
                <span className="truncate">{auth.name}</span>
              </CardTitle>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                {columnVisibility["num_items"] !== false && (
                  <Badge variant="outline">
                    {count} {count === 1 ? "item" : "items"}
                  </Badge>
                )}
                {columnVisibility["status_badge"] !== false && auth.is_inactive && (
                  <Badge variant="secondary" className="text-xs">
                    Inactive
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2" data-action-button>
              {auth.can_edit ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push(`/system/auth/${auth.auth_id}`)}
                  aria-label={`Edit ${auth.name}`}
                  data-testid="btn-edit-auth"
                  title={`Edit ${auth.name}`}
                  className="h-9 px-3"
                >
                  <Edit className="h-4 w-4 md:mr-0 mr-2" />
                  <span className="md:hidden">Edit</span>
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push(`/system/auth/${auth.auth_id}`)}
                  aria-label={`View ${auth.name}`}
                  data-testid="btn-view-auth"
                  title={`View ${auth.name}`}
                  className="h-9 px-3"
                >
                  <Eye className="h-4 w-4 md:mr-0 mr-2" />
                  <span className="md:hidden">View</span>
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

  return (
    <div className="space-y-6">
      {/* Toolbar — swaps between filter bar and selection action bar */}
      {selectedCount > 0 ? (
        <div
          className="flex items-center justify-between gap-2"
          data-testid="auths-toolbar"
        >
          <div className="flex items-center gap-2">
            {deleteAuthAction && (
              <Button
                variant="destructive"
                size="sm"
                className="h-8"
                onClick={() => setShowBulkDeleteDialog(true)}
                disabled={deletableAuths.length === 0}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete {deletableAuths.length} of {selectedCount}
              </Button>
            )}
            {updateAuthAction && (
              <Button
                variant="outline"
                size="sm"
                className="h-8"
                onClick={openBulkEditDialog}
                disabled={editableAuths.length === 0}
              >
                <Pencil className="mr-2 h-4 w-4" />
                Edit {editableAuths.length} of {selectedCount}
              </Button>
            )}
            {!allPageSelected && (
              <Button variant="ghost" size="sm" className="h-8" onClick={selectAllOnPage}>
                Select All
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

      {/* Auth Cards Grid */}
      {table.getRowModel().rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12">
          <p className="text-muted-foreground">
            {auths.length === 0 ? "No auth entries found" : "No auth entries match the current filters."}
          </p>
        </div>
      ) : (
        <div className="@container">
          <div className="grid grid-cols-1 @2xl:grid-cols-2 @5xl:grid-cols-3 @7xl:grid-cols-4 gap-4">
            {table.getRowModel().rows.map((row) => renderAuthCard(row.original))}
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
        count={deletableAuths.length}
        entityLabel="auth"
        entityLabelPlural="auths"
        isDeleting={isBulkDeleting}
        onConfirm={handleBulkDelete}
        description={
          <>
            <p>This action cannot be undone.</p>
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
        }
      />

      {/* Bulk Edit Modal */}
      <BulkEditDialog
        open={showBulkEditDialog}
        onOpenChange={setShowBulkEditDialog}
        count={editableAuths.length}
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
