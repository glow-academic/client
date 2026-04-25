/**
 * Settings.tsx
 * Used to display the settings list page.
 * List-only component following Personas.tsx pattern
 */
"use client";
import { Edit, Eye, Pencil, Settings as SettingsIcon, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

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
  DeleteSettingIn,
  DeleteSettingOut,
  UpdateSettingIn,
  UpdateSettingOut,
} from "@/app/(main)/settings/page";
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
}: SettingsProps) {
  const { departmentIds } = useProfile();
  const router = useRouter();

  useSettingAi({
    onComplete: () => router.refresh(),
  });

  // Table state
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

  // Extract data from response
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const settings = settingsData?.settings || [];

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

  // Selection state
  const [selectedSettingIds, setSelectedSettingIds] = useState<string[]>([]);
  const selectedCount = selectedSettingIds.length;
  const selectedSettings = useMemo(() => {
    return settings.filter((s) => s.settings_id && selectedSettingIds.includes(s.settings_id));
  }, [settings, selectedSettingIds]);
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

  const toggleSelection = useCallback((settingsId: string) => {
    setSelectedSettingIds((prev) =>
      prev.includes(settingsId)
        ? prev.filter((id) => id !== settingsId)
        : [...prev, settingsId]
    );
  }, []);
  const clearSelection = useCallback(() => setSelectedSettingIds([]), []);
  const selectAllOnPage = useCallback(() => {
    const pageIds = settings.filter((s) => s.settings_id).map((s) => s.settings_id!);
    setSelectedSettingIds((prev) => Array.from(new Set([...prev, ...pageIds])));
  }, [settings]);
  const allPageSelected = useMemo(() => {
    const pageIds = settings.filter((s) => s.settings_id).map((s) => s.settings_id!);
    return pageIds.length > 0 && pageIds.every((id) => selectedSettingIds.includes(id));
  }, [settings, selectedSettingIds]);

  // Bulk delete state
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // Bulk edit state
  const [showBulkEditDialog, setShowBulkEditDialog] = useState(false);
  const [isBulkEditing, setIsBulkEditing] = useState(false);
  const [bulkEditActiveStatus, setBulkEditActiveStatus] = useState<boolean | null>(null);

  const handleBulkDelete = async () => {
    if (!deleteSettingAction || deletableSettings.length === 0) return;
    setIsBulkDeleting(true);
    try {
      const ids = deletableSettings.map((s) => s.settings_id!);
      await deleteSettingAction({ body: { setting_ids: ids, accept: true } } as DeleteSettingIn);
      toast.success(`${ids.length} setting(s) deleted successfully`);
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
    if (!updateSettingAction || editableSettings.length === 0) return;

    const hasActiveChange = bulkEditActiveStatus !== null;
    if (!hasActiveChange) {
      toast.error("No changes selected");
      return;
    }

    // Resolve canonical active flag id (so server doesn't have to look it up).
    const activeFlagId = flagOptions.find((f) => f.type === "setting_active")?.id;

    setIsBulkEditing(true);
    try {
      // Canonical flag shape: ship `flag_ids` per item. Server derives semantics
      // by flag type/value. With one flag (setting_active), the array is either
      // [activeFlagId] or [] — no preservation logic needed.
      const items = editableSettings.map((s) => {
        let flag_ids: string[] | undefined;
        if (hasActiveChange) {
          const isActive = bulkEditActiveStatus;
          flag_ids = isActive && activeFlagId ? [activeFlagId] : [];
        }
        return {
          id: s.settings_id!,
          ...(hasActiveChange && { flag_ids }),
        };
      });

      await updateSettingAction({ body: { settings: items } } as UpdateSettingIn);
      toast.success(`${items.length} setting(s) updated successfully`);
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

  // Memoize table rows to avoid calling getRowModel() multiple times
  const pageIndex = table.getState().pagination.pageIndex;
  const pageSize = table.getState().pagination.pageSize;
  const sortingKey = JSON.stringify(sorting);
  const columnFiltersKey = JSON.stringify(columnFilters);
  const tableRows = useMemo(() => {
    return table.getRowModel().rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortingKey, columnFiltersKey, settings.length, pageIndex, pageSize]);

  const handleEdit = (id: string) => {
    router.push(`/settings/${id}`);
  };

  const handleView = (id: string) => {
    router.push(`/settings/${id}`);
  };

  const renderSettingCard = (setting: (typeof settings)[0]) => {
    const settingsId = setting.settings_id;
    const isSelected = settingsId ? selectedSettingIds.includes(settingsId) : false;
    const handleCardClick = (e: React.MouseEvent) => {
      // Don't toggle selection if clicking action buttons
      if ((e.target as HTMLElement).closest("[data-action-button]")) return;
      if (settingsId) {
        toggleSelection(settingsId);
      }
    };
    return (
      <Card
        key={setting.settings_id}
        className={`group hover:shadow-md transition-all cursor-pointer ${
          isSelected ? "ring-2 ring-primary" : ""
        }`}
        data-testid="setting-card"
        data-setting-id={setting.settings_id}
        role="gridcell"
        aria-label={`setting card ${setting.name || "Unnamed Setting"}`}
        aria-selected={isSelected}
        onClick={handleCardClick}
      >
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div className="space-y-2 flex-1 min-w-0">
              <div className="flex items-center gap-2">
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
                      if (settingsId) toggleSelection(settingsId);
                    }}
                    className="rounded-full h-5 w-5"
                    aria-label={`Select setting ${setting.name || "Unnamed"}`}
                  />
                </div>
                <div className="p-2 rounded-lg shadow-lg flex-shrink-0 bg-primary/10">
                  <SettingsIcon className="h-4 w-4 text-primary" />
                </div>
                <CardTitle className="text-lg truncate">
                  {setting.name || "Unnamed Setting"}
                </CardTitle>
              </div>
              <div className="mt-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  {columnVisibility["status_badge"] !== false && (
                    setting.active ? (
                      <Badge variant="default">Active</Badge>
                    ) : (
                      <Badge variant="secondary">Inactive</Badge>
                    )
                  )}
                  {columnVisibility["departments_count"] !== false && setting.department_ids && setting.department_ids.length > 0 && (
                    <Badge variant="outline" className="text-xs">
                      {setting.department_ids.length} department
                      {setting.department_ids.length !== 1 ? "s" : ""}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 items-center" data-action-button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (setting.settings_id) {
                    handleEdit(setting.settings_id);
                  }
                }}
                aria-label={`Edit setting ${setting.name || "Unnamed"}`}
                data-testid="btn-edit-setting"
                title={`Edit setting ${setting.name || "Unnamed"}`}
                className="h-9 px-3"
              >
                <Edit className="h-4 w-4 md:mr-0 mr-2" />
                <span className="md:hidden">Edit</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (setting.settings_id) {
                    handleView(setting.settings_id);
                  }
                }}
                aria-label={`View setting ${setting.name || "Unnamed"}`}
                data-testid="btn-view-setting"
                title={`View setting ${setting.name || "Unnamed"}`}
                className="h-9 px-3"
              >
                <Eye className="h-4 w-4 md:mr-0 mr-2" />
                <span className="md:hidden">View</span>
              </Button>
            </div>
          </div>
        </CardHeader>
        {columnVisibility["card_description"] !== false && (
          <CardContent className="pt-0 flex-grow flex flex-col">
            <p className="text-sm text-muted-foreground line-clamp-2 flex-grow">
              {setting.description || "No description available"}
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
          <div
            className="flex items-center justify-between gap-2"
            data-testid="settings-toolbar"
          >
            <div className="flex items-center gap-2">
              {deleteSettingAction && (
                <Button
                  variant="destructive"
                  size="sm"
                  className="h-8"
                  onClick={() => setShowBulkDeleteDialog(true)}
                  disabled={deletableSettings.length === 0}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete {deletableSettings.length} of {selectedCount}
                </Button>
              )}
              {updateSettingAction && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={openBulkEditDialog}
                  disabled={editableSettings.length === 0}
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit {editableSettings.length} of {selectedCount}
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
              hiddenColumns={["name", "description", "active", "created_at", "departments", "provider_ids", "auth_ids", "system_ids"]}
            />
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
            <DataTableViewOptions
              table={table}
              hiddenColumns={["name", "description", "active", "created_at", "departments", "provider_ids", "auth_ids", "system_ids"]}
            />
          </div>
        </div>
        )}

        {/* Cards Grid */}
        <div
          className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
          role="grid"
          aria-label="settings grid"
          data-testid="settings-grid"
        >
          {tableRows.length ? (
            tableRows.map((row) => renderSettingCard(row.original))
          ) : (
            <div className="col-span-full text-center py-8 text-muted-foreground">
              No settings match the current filters.
            </div>
          )}
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
        count={deletableSettings.length}
        entityLabel="setting"
        entityLabelPlural="settings"
        isDeleting={isBulkDeleting}
        onConfirm={handleBulkDelete}
        description={
          <>
            <p>This action cannot be undone.</p>
            {deletableSettings.length > 0 && (
              <div>
                <p className="text-sm font-medium text-destructive mb-1">Will be deleted:</p>
                <ul className="text-sm space-y-0.5">
                  {deletableSettings.map((s) => (
                    <li key={s.settings_id} className="flex items-center gap-1.5">
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
                      key={s.settings_id}
                      className="flex items-center gap-1.5 text-muted-foreground"
                    >
                      {s.name || "Unnamed Setting"}
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
        count={editableSettings.length}
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
    </div>
  );
}
