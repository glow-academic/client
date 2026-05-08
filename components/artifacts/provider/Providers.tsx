/**
 * Providers.tsx
 * Used to display the providers page with server-side filtering.
 */
"use client";
import { Edit, Eye, Pencil, Trash2, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { parseAsArrayOf, parseAsBoolean, parseAsString, useQueryState } from "nuqs";
import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import type {
  DeleteProviderIn,
  DeleteProviderOut,
  ProvidersListBody,
  ProvidersListOut,
  UpdateProviderIn,
  UpdateProviderOut,
} from "@/app/(main)/intelligence/providers/page";
import { ThreePickerFilters } from "@/components/common/table/ThreePickerFilters";
import { DataTablePagination } from "@/components/common/table/DataTablePagination";
import { DataTableViewOptions } from "@/components/common/table/DataTableViewOptions";
import { BulkDeleteDialog } from "@/components/common/forms/BulkDeleteDialog";
import { BulkEditDialog } from "@/components/common/forms/BulkEditDialog";
import { BulkEditFlagField } from "@/components/common/forms/BulkEditFlagField";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useColumnVisibility } from "@/hooks/use-column-visibility";
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
import { useProviderAi } from "@/hooks/use-provider-ai";

export interface ProvidersProps {
  // Server-provided data (for server-side rendering)
  listData: ProvidersListOut;
  // SSR column visibility from cookie
  initialColumnVisibility?: VisibilityState;
  // Server actions (replaces useMutation)
  deleteProviderAction?: (
    input: DeleteProviderIn
  ) => Promise<DeleteProviderOut>;
  updateProviderAction?: (
    input: UpdateProviderIn
  ) => Promise<UpdateProviderOut>;
  /** The body the page used for its SSR ``/provider/search`` call.
   *  Forwarded as the filter envelope on bulk delete/update calls
   *  when the user is in ``selectAll=1`` mode — the server resolves
   *  matching rows directly, no client-side enumeration. */
  currentSearchBody?: ProvidersListBody;
  // Server-side pagination
  pageIndex: number;
  pageSize: number;
  totalCount: number;
  // Server-side filter search terms
  departmentSearch: string;
  modelSearch: string;
}

const PROVIDERS_INITIAL_COLUMN_VISIBILITY: VisibilityState = {
  status_badge: true,
  value_badge: true,
  card_description: true,
};

export default function Providers({
  listData: serverListData,
  initialColumnVisibility,
  deleteProviderAction,
  updateProviderAction,
  currentSearchBody,
  pageIndex,
  pageSize,
  totalCount,
  departmentSearch,
  modelSearch,
}: ProvidersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useProviderAi({
    onComplete: () => router.refresh(),
  });

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteItem, setDeleteItem] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Local search state for debouncing
  const [searchTerm, setSearchTerm] = useState(
    searchParams?.get("search") ?? ""
  );
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Table state
  const [rowSelection, setRowSelection] = useState({});
  const [columnVisibility, setColumnVisibility] = useColumnVisibility(
    "providers",
    initialColumnVisibility ?? PROVIDERS_INITIAL_COLUMN_VISIBILITY,
  );
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>(() => {
    const filters: ColumnFiltersState = [];
    const deptIds = searchParams?.getAll("departmentIds") ?? [];
    const mIds = searchParams?.getAll("modelIds") ?? [];
    const sIds = searchParams?.getAll("statusIds") ?? [];
    if (deptIds.length > 0) filters.push({ id: "departments", value: deptIds });
    if (mIds.length > 0) filters.push({ id: "models", value: mIds });
    if (sIds.length > 0) filters.push({ id: "status", value: sIds });
    return filters;
  });
  const [sorting, setSorting] = useState<SortingState>([
    { id: "updated_at", desc: true },
  ]);

  // Use server-provided data directly
  const providersData = serverListData;

  // Extract data from response
  const providers = useMemo(
    () => providersData?.providers || [],
    [providersData?.providers]
  );

  // Filter options from server-provided ListFilterSection
  const departmentOptions = useMemo(
    () =>
      (providersData?.department_filter?.options || [])
        .map((opt) => ({
          value: opt.id as string,
          label: opt.name as string,
          count: opt.count ?? undefined,
        }))
        .filter((opt) => opt.value && opt.label),
    [providersData?.department_filter]
  );

  const modelOptions = useMemo(
    () =>
      (providersData?.model_filter?.options || [])
        .map((opt) => ({
          value: opt.id as string,
          label: opt.name as string,
          count: opt.count ?? undefined,
        }))
        .filter((opt) => opt.value && opt.label),
    [providersData?.model_filter]
  );

  const statusOptions = useMemo(
    () =>
      (providersData?.status_filter?.options || [])
        .map((opt) => ({
          value: opt.id as string,
          label: opt.name as string,
          count: opt.count ?? undefined,
        }))
        .filter((opt) => opt.value && opt.label),
    [providersData?.status_filter]
  );

  // Flag catalog (e.g. provider_active) — used to reconstruct flag_ids on bulk edit.
  const flagOptions = useMemo(() => {
    return (providersData?.flag_filter?.options || [])
      .filter((opt): opt is typeof opt & { id: string; name: string } => !!opt.id && !!opt.name)
      .map((opt) => ({ id: opt.id!, name: opt.name!, type: opt.type ?? null }));
  }, [providersData?.flag_filter]);

  // Selection state — URL-backed so it survives refresh and is
  // craftable as a shareable / LLM-generated focus link. Three
  // params model the full state machine:
  //
  //   - ``selectedIds=A,B``        → explicit selection of named rows
  //   - ``selectAll=1``            → every row matching the active
  //                                  filters/search is selected
  //   - ``selectAll=1&excludedIds=X``
  //                                → all-matching minus exclusions
  //   - (none of the above)        → empty selection
  //
  // Shallow updates skip the RSC re-fetch burst.
  const [selectedProviderIds, setSelectedProviderIds] = useQueryState(
    "selectedIds",
    parseAsArrayOf(parseAsString).withDefault([]).withOptions({ shallow: true }),
  );
  const [selectAllMatching, setSelectAllMatching] = useQueryState(
    "selectAll",
    parseAsBoolean.withDefault(false).withOptions({ shallow: true }),
  );
  const [excludedProviderIds, setExcludedProviderIds] = useQueryState(
    "excludedIds",
    parseAsArrayOf(parseAsString).withDefault([]).withOptions({ shallow: true }),
  );

  // ---- Selection helpers ----------------------------------------
  // ``isSelected`` is the single read predicate every row uses; it
  // dispatches between explicit-id and all-matching modes so
  // downstream code never needs to branch. ``selectedCount`` mirrors
  // that — under all-matching it's ``totalCount - excludedIds.length``.
  const totalMatchingCount = totalCount;

  const isSelected = useCallback(
    (id: string | null | undefined) => {
      if (!id) return false;
      return selectAllMatching
        ? !excludedProviderIds.includes(id)
        : selectedProviderIds.includes(id);
    },
    [selectAllMatching, excludedProviderIds, selectedProviderIds],
  );

  const selectedCount = selectAllMatching
    ? Math.max(0, totalMatchingCount - excludedProviderIds.length)
    : selectedProviderIds.length;

  const selectedProviders = useMemo(() => {
    return providers.filter((p) => p.provider_id && isSelected(p.provider_id));
  }, [providers, isSelected]);
  const deletableProviders = useMemo(
    () => selectedProviders.filter((p) => p.can_delete),
    [selectedProviders],
  );
  const nonDeletableProviders = useMemo(
    () => selectedProviders.filter((p) => !p.can_delete),
    [selectedProviders],
  );
  const editableProviders = useMemo(
    () => selectedProviders.filter((p) => p.can_edit ?? true),
    [selectedProviders],
  );

  // Toggle selection for a single provider. Under all-matching mode
  // we toggle membership in excludedProviderIds (deselect ⇒ add to
  // exclusions, re-select ⇒ remove). Under explicit mode it's the
  // straight selectedProviderIds toggle.
  const toggleSelection = useCallback((providerId: string) => {
    if (selectAllMatching) {
      void setExcludedProviderIds((prev) =>
        prev.includes(providerId)
          ? prev.filter((id) => id !== providerId)
          : [...prev, providerId],
      );
    } else {
      void setSelectedProviderIds((prev) =>
        prev.includes(providerId)
          ? prev.filter((id) => id !== providerId)
          : [...prev, providerId]
      );
    }
  }, [selectAllMatching, setExcludedProviderIds, setSelectedProviderIds]);

  const clearSelection = useCallback(() => {
    void setSelectedProviderIds([]);
    void setSelectAllMatching(false);
    void setExcludedProviderIds([]);
  }, [setSelectedProviderIds, setSelectAllMatching, setExcludedProviderIds]);

  const selectAllOnPage = useCallback(() => {
    const pageIds = providers.filter((p) => p.provider_id).map((p) => p.provider_id!);
    void setSelectAllMatching(false);
    void setExcludedProviderIds([]);
    void setSelectedProviderIds((prev) => Array.from(new Set([...prev, ...pageIds])));
  }, [providers, setSelectAllMatching, setExcludedProviderIds, setSelectedProviderIds]);

  /** Promote the current page-only selection into "all matching
   *  filter" mode. Clears explicit ids and exclusions — the all-
   *  matching mode is the canonical truth from this point. */
  const selectAllMatchingNow = useCallback(() => {
    void setSelectedProviderIds([]);
    void setExcludedProviderIds([]);
    void setSelectAllMatching(true);
  }, [setSelectedProviderIds, setExcludedProviderIds, setSelectAllMatching]);

  // Check if all parent providers on the current page are selected.
  // Under all-matching mode every loaded row whose id isn't in
  // ``excludedProviderIds`` is implicitly selected, so the predicate
  // reduces to "no excluded rows on the current page."
  const allPageSelected = useMemo(() => {
    const pageIds = providers.filter((p) => p.provider_id).map((p) => p.provider_id!);
    if (pageIds.length === 0) return false;
    return pageIds.every((id) => isSelected(id));
  }, [providers, isSelected]);

  // Whether there ARE more matching rows than what's loaded on this
  // page — used to decide whether to surface the "Select all N
  // matching" affordance after the user selects the page.
  const hasMoreThanCurrentPage = totalMatchingCount > providers.length;

  // Bulk delete state
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // Bulk edit state
  const [showBulkEditDialog, setShowBulkEditDialog] = useState(false);
  const [isBulkEditing, setIsBulkEditing] = useState(false);
  const [bulkEditActiveStatus, setBulkEditActiveStatus] = useState<boolean | null>(null);

  // Helper to update URL search params
  const updateProvidersParams = useCallback(
    (updates: {
      page?: number;
      pageSize?: number;
      search?: string;
      departmentIds?: string[];
      modelIds?: string[];
      statusIds?: string[];
      departmentSearch?: string;
      modelSearch?: string;
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

      if (updates.statusIds !== undefined) {
        params.delete("statusIds");
        updates.statusIds.forEach((id) => params.append("statusIds", id));
      }

      if (updates.departmentSearch !== undefined) {
        if (updates.departmentSearch === "") params.delete("departmentSearch");
        else params.set("departmentSearch", updates.departmentSearch);
      }

      if (updates.modelSearch !== undefined) {
        if (updates.modelSearch === "") params.delete("modelSearch");
        else params.set("modelSearch", updates.modelSearch);
      }

      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  // Commit search to URL
  const commitSearch = useCallback(
    (value: string) => {
      updateProvidersParams({ page: 0, search: value.trim() || "" });
    },
    [updateProvidersParams]
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
  const modelSearchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [localDepartmentSearch, setLocalDepartmentSearch] = useState(departmentSearch);
  const [localModelSearch, setLocalModelSearch] = useState(modelSearch);

  const handleDepartmentSearchChange = useCallback(
    (value: string) => {
      setLocalDepartmentSearch(value);
      if (departmentSearchTimeoutRef.current) clearTimeout(departmentSearchTimeoutRef.current);
      departmentSearchTimeoutRef.current = setTimeout(() => {
        updateProvidersParams({ departmentSearch: value });
      }, 300);
    },
    [updateProvidersParams]
  );

  const handleModelSearchChange = useCallback(
    (value: string) => {
      setLocalModelSearch(value);
      if (modelSearchTimeoutRef.current) clearTimeout(modelSearchTimeoutRef.current);
      modelSearchTimeoutRef.current = setTimeout(() => {
        updateProvidersParams({ modelSearch: value });
      }, 300);
    },
    [updateProvidersParams]
  );

  // Sync column filters to URL when they change
  const handleColumnFiltersChange = useCallback(
    (updater: ColumnFiltersState | ((prev: ColumnFiltersState) => ColumnFiltersState)) => {
      const newFilters = typeof updater === "function" ? updater(columnFilters) : updater;
      setColumnFilters(newFilters);

      const departmentFilter = newFilters.find((f) => f.id === "departments");
      const modelFilter = newFilters.find((f) => f.id === "models");
      const statusFilter = newFilters.find((f) => f.id === "status");

      updateProvidersParams({
        page: 0,
        departmentIds: (departmentFilter?.value as string[]) || [],
        modelIds: (modelFilter?.value as string[]) || [],
        statusIds: (statusFilter?.value as string[]) || [],
      });
    },
    [columnFilters, updateProvidersParams]
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
      updateProvidersParams({
        page: newPagination.pageIndex,
        pageSize: newPagination.pageSize,
      });
    },
    [pageIndex, pageSize, updateProvidersParams]
  );

  // Compute page count from total
  const pageCount = Math.ceil(totalCount / pageSize);

  // Define table columns inline
  const columns: ColumnDef<(typeof providers)[number]>[] = useMemo(
    () => [
      { accessorKey: "name", header: "Name" },
      { accessorKey: "description", header: "Description" },
      { accessorKey: "value", header: "Value" },
      {
        id: "status",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: (typeof providers)[number]) =>
          row.active ? "true" : "false",
        filterFn: (row, _id, value: string[]) => {
          const rowStatus = row.getValue("status") as string;
          if (value.length === 0) return true;
          return value.includes(rowStatus);
        },
      },
      {
        id: "departments",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: (typeof providers)[number]) => row.department_ids?.map(String) ?? [],
        filterFn: (row, _id, value: string[]) => {
          const rowIds = (row.getValue("departments") as string[]) ?? [];
          if (value.length === 0) return true;
          if (rowIds.length === 0) return true;
          return value.some((v) => rowIds.includes(v));
        },
      },
      {
        id: "models",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: (typeof providers)[number]) => row.model_ids?.map(String) ?? [],
        filterFn: (row, _id, value: string[]) => {
          const rowIds = (row.getValue("models") as string[]) ?? [];
          if (value.length === 0) return true;
          if (rowIds.length === 0) return true;
          return value.some((v) => rowIds.includes(v));
        },
      },
      {
        accessorKey: "updated_at",
        header: "Updated",
        cell: ({ row }) => {
          const updatedAt = row.original.updated_at;
          if (!updatedAt) return null;
          const date = new Date(updatedAt);
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
        accessorFn: (row: (typeof providers)[number]) => !row.active,
      },
      {
        id: "value_badge",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: (typeof providers)[number]) => row.value ?? "",
      },
      {
        id: "card_description",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: (typeof providers)[number]) => row.description ?? "",
      },
    ],
    []
  );

  // Create table instance with manual pagination and filtering
  const table = useReactTable({
    data: providers,
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
    getSortedRowModel: getSortedRowModel(),
    manualPagination: true,
    manualFiltering: true,
    pageCount,
  });

  // Memoize table rows
  const sortingKey = JSON.stringify(sorting);
  const tableRows = useMemo(() => {
    return table.getRowModel().rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortingKey, providers.length, pageIndex, pageSize]);

  const handleDelete = async () => {
    if (!deleteItem || !deleteProviderAction) return;

    setIsDeleting(true);
    try {
      await deleteProviderAction({
        body: { provider_ids: [deleteItem.id], accept: true },
      } as DeleteProviderIn);
      toast.success("Provider deleted successfully");
      router.refresh();
    } catch {
      toast.error("Failed to delete provider");
    } finally {
      setIsDeleting(false);
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
    // converge on the same ``deleteProviderAction`` call shape; the
    // body just differs.
    if (!deleteProviderAction) return;
    if (!selectAllMatching && deletableProviders.length === 0) return;
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
            excluded_ids: excludedProviderIds,
            ...(currentSearchBody ?? {}),
            accept: true,
          }
        : {
            provider_ids: deletableProviders.map((p) => p.provider_id!),
            accept: true,
          };

      const result = await deleteProviderAction({ body } as DeleteProviderIn);

      // Per-row results from the server: success entries are actual
      // deletions, failures are soft-skipped rows (no permission /
      // not found). Toast reflects both counts so the user knows
      // some rows were skipped without inspecting the receipt.
      const results = (result as DeleteProviderOut).results ?? [];
      const successCount = results.filter((r) => r.success).length;
      const skippedCount = results.length - successCount;
      if (skippedCount > 0) {
        toast.success(
          `${successCount} provider(s) deleted, ${skippedCount} skipped`,
        );
      } else {
        toast.success(`${successCount} provider(s) deleted successfully`);
      }
      clearSelection();
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to delete providers";
      toast.error(msg.replace(/^\d{3}\s*/, "") || "Failed to delete providers");
    } finally {
      setIsBulkDeleting(false);
      setShowBulkDeleteDialog(false);
    }
  };

  const handleBulkEdit = async () => {
    if (!updateProviderAction) return;
    if (!selectAllMatching && editableProviders.length === 0) return;

    const hasActiveChange = bulkEditActiveStatus !== null;
    if (!hasActiveChange) {
      toast.error("No changes selected");
      return;
    }

    const activeFlagId = flagOptions.find((f) => f.type === "provider_active")?.id;

    setIsBulkEditing(true);
    try {
      let body: UpdateProviderIn["body"];
      if (selectAllMatching) {
        // All-matching: the server can't preserve per-row flag state
        // (it doesn't know what each row's existing flags are), so
        // the active toggle becomes "set to this value across all
        // matching rows" — the same semantic as a manual sweep.
        let flag_ids: string[] | undefined;
        if (hasActiveChange) {
          flag_ids = [];
          if (bulkEditActiveStatus && activeFlagId) flag_ids.push(activeFlagId);
        }
        body = {
          all: true,
          excluded_ids: excludedProviderIds,
          ...(currentSearchBody ?? {}),
          patch: {
            ...(hasActiveChange && { flag_ids }),
          },
          accept: true,
        } as UpdateProviderIn["body"];
      } else {
        // Explicit: clone the patch per-row, preserving each row's
        // existing flag state for flags we aren't toggling.
        const items = editableProviders.map((p) => {
          let flag_ids: string[] | undefined;
          if (hasActiveChange) {
            const isActive = bulkEditActiveStatus;
            flag_ids = isActive && activeFlagId ? [activeFlagId] : [];
          }
          return {
            id: p.provider_id!,
            ...(hasActiveChange && { flag_ids }),
          };
        });
        body = { providers: items } as UpdateProviderIn["body"];
      }

      const result = await updateProviderAction({ body } as UpdateProviderIn);

      const results = (result as UpdateProviderOut).results ?? [];
      const successCount = results.filter((r) => r.success).length;
      const skippedCount = results.length - successCount;
      if (skippedCount > 0) {
        toast.success(
          `${successCount} provider(s) updated, ${skippedCount} skipped`,
        );
      } else {
        toast.success(`${successCount} provider(s) updated successfully`);
      }
      clearSelection();
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to update providers";
      toast.error(msg.replace(/^\d{3}\s*/, "") || "Failed to update providers");
    } finally {
      setIsBulkEditing(false);
      setShowBulkEditDialog(false);
    }
  };

  const openBulkEditDialog = () => {
    setBulkEditActiveStatus(null);
    setShowBulkEditDialog(true);
  };

  const handleEdit = (id: string) => {
    router.push(`/intelligence/providers/${id}`);
  };

  const renderProviderCard = (provider: (typeof providers)[number]) => {
    const providerId = provider.provider_id;
    const providerName = provider.name;
    if (!providerId) return null;
    const isSelectedRow = isSelected(providerId);

    const handleCardClick = (e: React.MouseEvent) => {
      // Don't toggle selection if clicking action buttons
      if ((e.target as HTMLElement).closest("[data-action-button]")) return;
      toggleSelection(providerId);
    };

    return (
      <Card
        key={providerId}
        aria-label={providerName ? `provider card ${providerName}` : undefined}
        data-testid="provider-card"
        data-provider-id={providerId}
        className={`group relative flex flex-col h-full hover:shadow-md transition-all cursor-pointer ${
          isSelectedRow ? "ring-2 ring-primary" : ""
        }`}
        role="gridcell"
        aria-selected={isSelectedRow}
        onClick={handleCardClick}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
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
                    checked={isSelectedRow}
                    onCheckedChange={() => toggleSelection(providerId)}
                    className="rounded-full h-5 w-5"
                    aria-label={`Select provider ${providerName || "Unnamed"}`}
                  />
                </div>
                <span className="truncate">{provider.name}</span>
              </CardTitle>
              <div className="mt-1 space-y-2">
                <div className="flex items-center gap-2">
                  {columnVisibility["status_badge"] !== false && !provider.active && (
                    <Badge variant="secondary">Inactive</Badge>
                  )}
                  {columnVisibility["value_badge"] !== false && (
                    <Badge variant="outline">{provider.value}</Badge>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2" data-action-button>
              {providerId && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => router.push(`/intelligence/providers/${providerId}`)}
                  aria-label={providerName ? `View ${providerName}` : undefined}
                  data-testid={`btn-view-provider-${providerId}`}
                  title="View"
                >
                  <Eye className="h-4 w-4" />
                </Button>
              )}
              {provider.can_edit && providerId && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleEdit(providerId)}
                  aria-label={providerName ? `Edit ${providerName}` : undefined}
                  data-testid={`btn-edit-provider-${providerId}`}
                >
                  <Edit className="h-4 w-4" />
                </Button>
              )}
              {provider.can_delete && providerId && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    handleDeleteClick(providerId, providerName ?? "")
                  }
                  aria-label={
                    providerName ? `Delete ${providerName}` : undefined
                  }
                  data-testid={`btn-delete-provider-${providerId}`}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        {columnVisibility["card_description"] !== false && (
          <CardContent className="pt-0 flex-1 flex flex-col">
            <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
              {provider.description || "No description"}
            </p>
          </CardContent>
        )}
      </Card>
    );
  };

  // Get column references for toolbar
  const departmentsColumn = table.getColumn("departments");
  const modelsColumn = table.getColumn("models");
  const statusColumn = table.getColumn("status");
  const isFiltered =
    table.getState().columnFilters.length > 0 ||
    searchTerm.length > 0;

  return (
    <div className="space-y-6" data-page="providers-index">
      {/* Toolbar — swaps between filter bar and selection action bar */}
      {selectedCount > 0 ? (
        <div className="space-y-2" data-testid="providers-toolbar">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {deleteProviderAction && (
                <Button
                  variant="destructive"
                  size="sm"
                  className="h-8"
                  onClick={() => setShowBulkDeleteDialog(true)}
                  disabled={!selectAllMatching && deletableProviders.length === 0}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {selectAllMatching
                    ? `Delete ${selectedCount} matching`
                    : `Delete ${deletableProviders.length} of ${selectedCount}`}
                </Button>
              )}
              {updateProviderAction && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={openBulkEditDialog}
                  disabled={!selectAllMatching && editableProviders.length === 0}
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  {selectAllMatching
                    ? `Edit ${selectedCount} matching`
                    : `Edit ${editableProviders.length} of ${selectedCount}`}
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
              hiddenColumns={["name", "description", "value", "departments", "models", "status", "updated_at"]}
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
                All {providers.length} on this page selected.
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
                All {selectedCount} matching providers selected
                {excludedProviderIds.length > 0 && ` (${excludedProviderIds.length} excluded)`}.
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
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2" data-testid="providers-toolbar">
        <div className="flex flex-col md:flex-row md:flex-1 md:items-center md:space-x-2 gap-2 md:gap-0">
          <Input
            placeholder="Search providers..."
            value={searchTerm}
            onChange={(event) => handleSearchChange(event.target.value)}
            onBlur={handleSearchBlur}
            onKeyDown={handleSearchKeyDown}
            className="h-8 w-full md:w-[150px] lg:w-[250px]"
            data-testid="input-search-providers"
          />
          <ThreePickerFilters
            slots={[
              {
                column: modelsColumn,
                title: "Model",
                options: modelOptions,
                isServerDriven: true,
                onSearchChange: handleModelSearchChange,
                searchValue: localModelSearch,
              },
              {
                column: statusColumn,
                title: "Status",
                options: statusOptions,
                isServerDriven: true,
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
                setLocalModelSearch("");
                table.resetColumnFilters();
                updateProvidersParams({
                  page: 0,
                  search: "",
                  departmentIds: [],
                  modelIds: [],
                  statusIds: [],
                  departmentSearch: "",
                  modelSearch: "",
                });
              }}
              className="h-8 px-2 lg:px-3"
            >
              Reset
              <X className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <DataTableViewOptions
            table={table}
            hiddenColumns={["name", "description", "value", "departments", "models", "status", "updated_at"]}
          />
        </div>
      </div>
      )}

      {/* Providers Grid */}
      {tableRows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12">
          <p className="text-muted-foreground">No providers found</p>
        </div>
      ) : (
        <>
          <div className="@container">
            <div className="grid grid-cols-1 @2xl:grid-cols-2 @5xl:grid-cols-3 @7xl:grid-cols-4 gap-6">
              {tableRows.map((row) => renderProviderCard(row.original))}
            </div>
          </div>
          <DataTablePagination table={table} />
        </>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Provider</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteItem?.name}"? This action
              cannot be undone.
              {deleteItem && (
                <span className="block mt-2 text-destructive font-medium">
                  Warning: This provider may be in use by models. Deletion will
                  fail if any models are using it.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
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
        count={selectAllMatching ? selectedCount : deletableProviders.length}
        entityLabel="provider"
        entityLabelPlural="providers"
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
                  {" "}providers will be deleted server-side using the current filter.
                </p>
                {excludedProviderIds.length > 0 && (
                  <p className="mt-1">
                    {excludedProviderIds.length} explicitly excluded.
                  </p>
                )}
                <p className="mt-1">
                  Providers you don't have permission to delete will be skipped automatically.
                </p>
              </div>
            ) : (
              <>
                {deletableProviders.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-destructive mb-1">Will be deleted:</p>
                    <ul className="text-sm space-y-0.5">
                      {deletableProviders.map((p) => (
                        <li key={p.provider_id} className="flex items-center gap-1.5">
                          <Trash2 className="h-3 w-3 text-destructive flex-shrink-0" />
                          {p.name || "Unnamed Provider"}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {nonDeletableProviders.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-yellow-600 dark:text-yellow-500 mb-1">
                      Cannot be deleted (in use):
                    </p>
                    <ul className="text-sm space-y-0.5">
                      {nonDeletableProviders.map((p) => (
                        <li
                          key={p.provider_id}
                          className="flex items-center gap-1.5 text-muted-foreground"
                        >
                          {p.name || "Unnamed Provider"}
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
        count={selectAllMatching ? selectedCount : editableProviders.length}
        entityLabelPlural="providers"
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
