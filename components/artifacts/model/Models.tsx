/**
 * Models.tsx
 * Used to display the models page with server-side filtering.
 * Hybrid approach: provider/department/agent filters are server-driven,
 * type (custom/standard) and status (active/inactive) remain client-side.
 * @AshokSaravanan222 & @siladiea
 * 06/18/2025
 */
"use client";
import { Copy, Cpu, Edit, Eye, Pencil, Trash2, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";
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
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BulkDeleteDialog } from "@/components/common/forms/BulkDeleteDialog";
import { BulkEditDialog } from "@/components/common/forms/BulkEditDialog";
import { BulkEditFlagField } from "@/components/common/forms/BulkEditFlagField";
import { useModelAi } from "@/hooks/use-model-ai";
import { useProfile } from "@/contexts/profile-context";
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

import type {
  DeleteModelIn,
  DeleteModelOut,
  DuplicateModelIn,
  DuplicateModelOut,
  ModelsListOut,
  UpdateModelIn,
  UpdateModelOut,
} from "@/app/(main)/intelligence/models/page";
import { ThreePickerFilters } from "@/components/common/table/ThreePickerFilters";
import { DataTablePagination } from "@/components/common/table/DataTablePagination";
import { DataTableViewOptions } from "@/components/common/table/DataTableViewOptions";
import { Input } from "@/components/ui/input";
import { useColumnVisibility } from "@/hooks/use-column-visibility";

export interface ModelsProps {
  // Server-provided data (for server-side rendering)
  listData: ModelsListOut;
  // SSR column visibility from cookie
  initialColumnVisibility?: VisibilityState;
  // Server actions (replaces useMutation)
  duplicateModelAction?: (
    input: DuplicateModelIn
  ) => Promise<DuplicateModelOut>;
  deleteModelAction?: (input: DeleteModelIn) => Promise<DeleteModelOut>;
  updateModelAction?: (input: UpdateModelIn) => Promise<UpdateModelOut>;
  // Server-side pagination
  pageIndex: number;
  pageSize: number;
  totalCount: number;
  // Server-side filter search terms
  providerSearch: string;
  departmentSearch: string;
  agentSearch: string;
}

const MODELS_INITIAL_COLUMN_VISIBILITY: VisibilityState = {
  custom_badge: true,
  status_badge: true,
  card_description: true,
  provider_badge: true,
};

export default function Models({
  listData: serverListData,
  initialColumnVisibility,
  duplicateModelAction,
  deleteModelAction,
  updateModelAction,
  pageIndex,
  pageSize,
  totalCount,
  providerSearch,
  departmentSearch,
  agentSearch,
}: ModelsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { profile } = useProfile();

  // AI generation listener
  useModelAi({
    onComplete: () => router.refresh(),
  });
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteItem, setDeleteItem] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState<string | null>(null);

  // Local search state for debouncing
  const [searchTerm, setSearchTerm] = useState(
    searchParams?.get("search") ?? ""
  );
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Use server-provided data directly
  const modelsData = serverListData;
  const models = useMemo(() => modelsData?.models || [], [modelsData?.models]);

  // Flag catalog (e.g. model_active) — used to reconstruct flag_ids on bulk edit.
  const flagOptions = useMemo(() => {
    return (modelsData?.flag_filter?.options || [])
      .filter((opt): opt is typeof opt & { id: string; name: string } => !!opt.id && !!opt.name)
      .map((opt) => ({ id: opt.id!, name: opt.name!, type: opt.type ?? null }));
  }, [modelsData?.flag_filter]);

  // Selection state
  const [selectedModelIds, setSelectedModelIds] = useState<string[]>([]);
  const selectedCount = selectedModelIds.length;
  const selectedModels = useMemo(() => {
    return models.filter((m) => m.model_id && selectedModelIds.includes(m.model_id));
  }, [models, selectedModelIds]);
  const deletableModels = useMemo(
    () => selectedModels.filter((m) => m.can_delete),
    [selectedModels],
  );
  const nonDeletableModels = useMemo(
    () => selectedModels.filter((m) => !m.can_delete),
    [selectedModels],
  );
  const editableModels = useMemo(
    () => selectedModels.filter((m) => m.can_edit ?? true),
    [selectedModels],
  );
  const toggleSelection = useCallback((modelId: string) => {
    setSelectedModelIds((prev) =>
      prev.includes(modelId) ? prev.filter((id) => id !== modelId) : [...prev, modelId]
    );
  }, []);
  const clearSelection = useCallback(() => setSelectedModelIds([]), []);
  const selectAllOnPage = useCallback(() => {
    const pageIds = models.filter((m) => m.model_id).map((m) => m.model_id!);
    setSelectedModelIds((prev) => Array.from(new Set([...prev, ...pageIds])));
  }, [models]);
  const allPageSelected = useMemo(() => {
    const pageIds = models.filter((m) => m.model_id).map((m) => m.model_id!);
    return pageIds.length > 0 && pageIds.every((id) => selectedModelIds.includes(id));
  }, [models, selectedModelIds]);

  // Bulk delete state
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // Bulk edit state
  const [showBulkEditDialog, setShowBulkEditDialog] = useState(false);
  const [isBulkEditing, setIsBulkEditing] = useState(false);
  const [bulkEditActiveStatus, setBulkEditActiveStatus] = useState<boolean | null>(null);

  // Filter options from server-provided ListFilterSection
  const providerOptions = useMemo(
    () =>
      (modelsData?.provider_filter?.options || [])
        .map((opt) => ({
          value: opt.id as string,
          label: opt.name as string,
          count: opt.count ?? undefined,
        }))
        .filter((opt) => opt.value && opt.label),
    [modelsData?.provider_filter]
  );

  const departmentOptions = useMemo(
    () =>
      (modelsData?.department_filter?.options || [])
        .map((opt) => ({
          value: opt.id as string,
          label: opt.name as string,
          count: opt.count ?? undefined,
        }))
        .filter((opt) => opt.value && opt.label),
    [modelsData?.department_filter]
  );

  const agentOptions = useMemo(
    () =>
      (modelsData?.agent_filter?.options || [])
        .map((opt) => ({
          value: opt.id as string,
          label: opt.name as string,
          count: opt.count ?? undefined,
        }))
        .filter((opt) => opt.value && opt.label),
    [modelsData?.agent_filter]
  );

  // Table state - initialize server-driven filters from URL, client-only filters start empty
  const [rowSelection, setRowSelection] = useState({});
  const [columnVisibility, setColumnVisibility] = useColumnVisibility(
    "models",
    initialColumnVisibility ?? MODELS_INITIAL_COLUMN_VISIBILITY,
  );
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>(() => {
    const filters: ColumnFiltersState = [];
    const provIds = searchParams?.getAll("providerIds") ?? [];
    const deptIds = searchParams?.getAll("departmentIds") ?? [];
    const agIds = searchParams?.getAll("agentIds") ?? [];
    if (provIds.length > 0) filters.push({ id: "provider", value: provIds });
    if (deptIds.length > 0) filters.push({ id: "departments", value: deptIds });
    if (agIds.length > 0) filters.push({ id: "agents", value: agIds });
    return filters;
  });
  const [sorting, setSorting] = useState<SortingState>([
    { id: "updated_at", desc: true },
  ]);

  // Helper to update URL search params
  const updateModelsParams = useCallback(
    (updates: {
      page?: number;
      pageSize?: number;
      search?: string;
      providerIds?: string[];
      departmentIds?: string[];
      agentIds?: string[];
      providerSearch?: string;
      departmentSearch?: string;
      agentSearch?: string;
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

      if (updates.providerIds !== undefined) {
        params.delete("providerIds");
        updates.providerIds.forEach((id) => params.append("providerIds", id));
      }

      if (updates.departmentIds !== undefined) {
        params.delete("departmentIds");
        updates.departmentIds.forEach((id) => params.append("departmentIds", id));
      }

      if (updates.agentIds !== undefined) {
        params.delete("agentIds");
        updates.agentIds.forEach((id) => params.append("agentIds", id));
      }

      if (updates.providerSearch !== undefined) {
        if (updates.providerSearch === "") params.delete("providerSearch");
        else params.set("providerSearch", updates.providerSearch);
      }

      if (updates.departmentSearch !== undefined) {
        if (updates.departmentSearch === "") params.delete("departmentSearch");
        else params.set("departmentSearch", updates.departmentSearch);
      }

      if (updates.agentSearch !== undefined) {
        if (updates.agentSearch === "") params.delete("agentSearch");
        else params.set("agentSearch", updates.agentSearch);
      }

      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  // Commit search to URL
  const commitSearch = useCallback(
    (value: string) => {
      updateModelsParams({ page: 0, search: value.trim() || "" });
    },
    [updateModelsParams]
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
  const providerSearchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const departmentSearchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const agentSearchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [localProviderSearch, setLocalProviderSearch] = useState(providerSearch);
  const [localDepartmentSearch, setLocalDepartmentSearch] = useState(departmentSearch);
  const [localAgentSearch, setLocalAgentSearch] = useState(agentSearch);

  const handleProviderSearchChange = useCallback(
    (value: string) => {
      setLocalProviderSearch(value);
      if (providerSearchTimeoutRef.current) clearTimeout(providerSearchTimeoutRef.current);
      providerSearchTimeoutRef.current = setTimeout(() => {
        updateModelsParams({ providerSearch: value });
      }, 300);
    },
    [updateModelsParams]
  );

  const handleDepartmentSearchChange = useCallback(
    (value: string) => {
      setLocalDepartmentSearch(value);
      if (departmentSearchTimeoutRef.current) clearTimeout(departmentSearchTimeoutRef.current);
      departmentSearchTimeoutRef.current = setTimeout(() => {
        updateModelsParams({ departmentSearch: value });
      }, 300);
    },
    [updateModelsParams]
  );

  const handleAgentSearchChange = useCallback(
    (value: string) => {
      setLocalAgentSearch(value);
      if (agentSearchTimeoutRef.current) clearTimeout(agentSearchTimeoutRef.current);
      agentSearchTimeoutRef.current = setTimeout(() => {
        updateModelsParams({ agentSearch: value });
      }, 300);
    },
    [updateModelsParams]
  );

  // Sync column filters to URL when they change (only server-driven ones)
  const handleColumnFiltersChange = useCallback(
    (updater: ColumnFiltersState | ((prev: ColumnFiltersState) => ColumnFiltersState)) => {
      const newFilters = typeof updater === "function" ? updater(columnFilters) : updater;
      setColumnFilters(newFilters);

      // Only push server-driven filters to URL
      const providerFilter = newFilters.find((f) => f.id === "provider");
      const departmentFilter = newFilters.find((f) => f.id === "departments");
      const agentFilter = newFilters.find((f) => f.id === "agents");

      // Check if any server-driven filter actually changed
      const oldProviderFilter = columnFilters.find((f) => f.id === "provider");
      const oldDepartmentFilter = columnFilters.find((f) => f.id === "departments");
      const oldAgentFilter = columnFilters.find((f) => f.id === "agents");

      const serverChanged =
        JSON.stringify(providerFilter?.value) !== JSON.stringify(oldProviderFilter?.value) ||
        JSON.stringify(departmentFilter?.value) !== JSON.stringify(oldDepartmentFilter?.value) ||
        JSON.stringify(agentFilter?.value) !== JSON.stringify(oldAgentFilter?.value);

      if (serverChanged) {
        updateModelsParams({
          page: 0,
          providerIds: (providerFilter?.value as string[]) || [],
          departmentIds: (departmentFilter?.value as string[]) || [],
          agentIds: (agentFilter?.value as string[]) || [],
        });
      }
    },
    [columnFilters, updateModelsParams]
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
      updateModelsParams({
        page: newPagination.pageIndex,
        pageSize: newPagination.pageSize,
      });
    },
    [pageIndex, pageSize, updateModelsParams]
  );

  // Compute page count from total
  const pageCount = Math.ceil(totalCount / pageSize);

  const columns = useMemo<ColumnDef<(typeof models)[number]>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => row.getValue("name"),
      },
      // Hidden faceting column for Provider (server-driven)
      {
        id: "provider",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row) => row.provider_id,
        filterFn: (row, _id, value: string[]) => {
          const provider = String(row.getValue("provider"));
          return value.includes(provider);
        },
      },
      // Hidden faceting column for Custom Model (client-only)
      {
        id: "is_custom",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row) =>
          row.base_url && row.base_url !== "" ? "true" : "false",
        filterFn: (row, _id, value: string[]) => {
          const isCustom = String(row.getValue("is_custom"));
          return value.includes(isCustom);
        },
      },
      // Hidden faceting column for Active Status (client-only)
      {
        id: "active",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row) => (row.active ? "true" : "false"),
        filterFn: (row, _id, value: string[]) => {
          const status = String(row.getValue("active"));
          return value.includes(status);
        },
      },
      // Hidden faceting column for Departments (server-driven)
      {
        id: "departments",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row) => row.department_ids ?? [],
        filterFn: (row, _id, value: string[]) => {
          const rowIds = (row.getValue("departments") as string[]) ?? [];
          if (value.length === 0) return true;
          if (rowIds.length === 0) return true;
          return value.some((v) => rowIds.includes(v));
        },
      },
      // Hidden faceting column for Agents (server-driven)
      {
        id: "agents",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: () => [] as string[],
        filterFn: () => true,
      },
      {
        accessorKey: "updated_at",
        header: "Updated",
        cell: ({ row }) => {
          const updatedAt = row.original.updated_at;
          if (!updatedAt)
            return <div className="text-sm text-muted-foreground">—</div>;
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
        id: "custom_badge",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: (typeof models)[number]) => !!row.base_url,
      },
      {
        id: "status_badge",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: (typeof models)[number]) => !row.active,
      },
      {
        id: "card_description",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: (typeof models)[number]) => row.description ?? "",
      },
      {
        id: "provider_badge",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: (typeof models)[number]) => row.provider_name ?? "",
      },
    ],
    []
  );

  // Create table instance - hybrid: manual for server filters, client filtering for type/status
  const table = useReactTable({
    data: models,
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
    manualFiltering: false, // Client-side filtering for type/status on server-provided page
    pageCount,
  });

  // Get filtered rows for rendering
  const sortingKey = JSON.stringify(sorting);
  const columnFiltersKey = JSON.stringify(columnFilters);
  const tableRows = useMemo(() => {
    return table.getRowModel().rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortingKey, columnFiltersKey, models.length, pageIndex, pageSize]);

  // Get column references for toolbar
  const providerColumn = table.getColumn("provider");
  const departmentsColumn = table.getColumn("departments");
  const agentsColumn = table.getColumn("agents");
  const isFiltered =
    table.getState().columnFilters.length > 0 ||
    searchTerm.length > 0;

  const handleDelete = async () => {
    if (!deleteItem || !deleteModelAction) return;

    if (!profile?.id) {
      toast.error("Profile not loaded. Please refresh the page.");
      return;
    }

    setIsDeleting(true);
    try {
      await deleteModelAction({
        body: { model_ids: [deleteItem.id], accept: true },
      });
      toast.success("Model deleted successfully");
      router.refresh();
    } catch {
      toast.error("Failed to delete model");
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
      setDeleteItem(null);
    }
  };

  const handleDeleteClick = (model: (typeof models)[number]) => {
    if (!model.can_delete) {
      toast.error("Cannot delete model: It is currently in use");
      return;
    }
    if (!model.model_id) {
      toast.error("Model ID is missing");
      return;
    }
    setDeleteItem({ id: model.model_id, name: model.name || "Unknown Model" });
    setShowDeleteDialog(true);
  };

  const handleDuplicateModelClick = async (model: (typeof models)[number]) => {
    if (!duplicateModelAction) return;

    if (!profile?.id) {
      toast.error("Profile not loaded. Please refresh the page.");
      return;
    }

    if (!model.model_id) {
      toast.error("Model ID is missing");
      return;
    }
    setIsDuplicating(model.model_id);
    try {
      await duplicateModelAction({
        body: { model_id: model.model_id, accept: true },
      });
      toast.success(
        `Model '${model.name || "Unknown Model"}' duplicated successfully`
      );
      router.refresh();
    } catch {
      toast.error("Failed to duplicate model");
    } finally {
      setIsDuplicating(null);
    }
  };

  const handleEdit = (modelId: string) => {
    router.push(`/intelligence/models/${modelId}`);
  };

  const handleBulkDelete = async () => {
    if (!deleteModelAction || deletableModels.length === 0) return;
    setIsBulkDeleting(true);
    try {
      const ids = deletableModels.map((m) => m.model_id!);
      await deleteModelAction({ body: { model_ids: ids, accept: true } });
      toast.success(`${ids.length} model(s) deleted successfully`);
      clearSelection();
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to delete models";
      toast.error(msg.replace(/^\d{3}\s*/, "") || "Failed to delete models");
    } finally {
      setIsBulkDeleting(false);
      setShowBulkDeleteDialog(false);
    }
  };

  const handleBulkEdit = async () => {
    if (!updateModelAction || editableModels.length === 0) return;

    const hasActiveChange = bulkEditActiveStatus !== null;
    if (!hasActiveChange) {
      toast.error("No changes selected");
      return;
    }

    const activeFlagId = flagOptions.find((f) => f.type === "model_active")?.id;

    setIsBulkEditing(true);
    try {
      const items = editableModels.map((m) => {
        let flag_ids: string[] | undefined;
        if (hasActiveChange) {
          const isActive = bulkEditActiveStatus;
          flag_ids = isActive && activeFlagId ? [activeFlagId] : [];
        }
        return {
          id: m.model_id!,
          ...(hasActiveChange && { flag_ids }),
        };
      });

      await updateModelAction({ body: { models: items } } as UpdateModelIn);
      toast.success(`${items.length} model(s) updated successfully`);
      clearSelection();
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to update models";
      toast.error(msg.replace(/^\d{3}\s*/, "") || "Failed to update models");
    } finally {
      setIsBulkEditing(false);
      setShowBulkEditDialog(false);
    }
  };

  const openBulkEditDialog = () => {
    setBulkEditActiveStatus(null);
    setShowBulkEditDialog(true);
  };

  const renderModelCard = (model: (typeof models)[number]) => {
    const isSelected = model.model_id ? selectedModelIds.includes(model.model_id) : false;
    const handleCardClick = (e: React.MouseEvent) => {
      // Don't toggle selection if clicking action buttons
      if ((e.target as HTMLElement).closest("[data-action-button]")) return;
      if (model.model_id) {
        toggleSelection(model.model_id);
      }
    };
    return (
    <Card
      key={model.model_id}
      className={`group hover:shadow-md transition-all flex flex-col h-full min-h-[220px] cursor-pointer ${
        isSelected ? "ring-2 ring-primary" : ""
      }`}
      data-testid="model-card"
      data-model-id={model.model_id}
      role="gridcell"
      aria-label={`model card ${model.name || "Unnamed Model"}`}
      aria-selected={isSelected}
      onClick={handleCardClick}
    >
      <CardHeader className="flex-0">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2">
          <div className="space-y-1 flex-1 min-w-0">
            <CardTitle className="text-base flex items-center gap-2">
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
                    if (model.model_id) toggleSelection(model.model_id);
                  }}
                  className="rounded-full h-5 w-5"
                  aria-label={`Select model ${model.name || "Unnamed"}`}
                />
              </div>
              <Cpu className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">{model.name}</span>
            </CardTitle>
            {columnVisibility["card_description"] !== false && (
              <CardDescription className="text-xs line-clamp-2">
                {model.description}
              </CardDescription>
            )}
          </div>
          <div className="flex flex-wrap gap-1 flex-shrink-0">
            {columnVisibility["custom_badge"] !== false && model.base_url && model.base_url !== "" && (
              <Badge variant="default">Custom</Badge>
            )}
            {columnVisibility["status_badge"] !== false && !model.active && <Badge variant="secondary">Inactive</Badge>}
          </div>
        </div>
        {columnVisibility["provider_badge"] !== false && (
          <div className="mt-2">
            <Badge variant="outline" className="text-xs">
              {model.provider_name || "Custom"}
            </Badge>
          </div>
        )}
      </CardHeader>
      <CardFooter className="mt-auto flex flex-wrap justify-end gap-2" data-action-button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => model.model_id && router.push(`/intelligence/models/${model.model_id}`)}
          aria-label={`View model ${model.name || "Unknown Model"}`}
          data-testid="btn-view-model"
          title={`View model ${model.name || "Unknown Model"}`}
          className="h-9 px-3"
        >
          <Eye className="h-4 w-4 md:mr-0 mr-2" />
          <span className="md:hidden">View</span>
        </Button>
        {model.can_edit && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => model.model_id && handleEdit(model.model_id)}
            aria-label={`Edit model ${model.name || "Unknown Model"}`}
            data-testid="btn-edit-model"
            title={`Edit model ${model.name || "Unknown Model"}`}
            className="h-9 px-3"
          >
            <Edit className="h-4 w-4 md:mr-0 mr-2" />
            <span className="md:hidden">Edit</span>
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleDuplicateModelClick(model)}
          disabled={isDuplicating === model.model_id}
          aria-label={`Duplicate model ${model.name}`}
          data-testid="btn-duplicate-model"
          title={`Duplicate model ${model.name}`}
          className="h-9 px-3"
        >
          {isDuplicating === model.model_id ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : (
            <>
              <Copy className="h-4 w-4 md:mr-0 mr-2" />
              <span className="md:hidden">Duplicate</span>
            </>
          )}
        </Button>
        {model.can_delete && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleDeleteClick(model)}
            aria-label={`Delete model ${model.name}`}
            data-testid="btn-delete-model"
            title={`Delete model ${model.name}`}
            className="h-9 px-3"
          >
            <Trash2 className="h-4 w-4 md:mr-0 mr-2" />
            <span className="md:hidden">Delete</span>
          </Button>
        )}
      </CardFooter>
    </Card>
    );
  };

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <div className="space-y-4">
          {/* Toolbar — swaps between filter bar and selection action bar */}
          {selectedCount > 0 ? (
            <div
              className="flex items-center justify-between gap-2"
              data-testid="models-toolbar"
            >
              <div className="flex items-center gap-2">
                {deleteModelAction && (
                  <Button
                    variant="destructive"
                    size="sm"
                    className="h-8"
                    onClick={() => setShowBulkDeleteDialog(true)}
                    disabled={deletableModels.length === 0}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete {deletableModels.length} of {selectedCount}
                  </Button>
                )}
                {updateModelAction && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8"
                    onClick={openBulkEditDialog}
                    disabled={editableModels.length === 0}
                  >
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit {editableModels.length} of {selectedCount}
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
                hiddenColumns={["name", "provider", "is_custom", "active", "departments", "agents", "updated_at"]}
              />
            </div>
          ) : (
            <div
              className="flex flex-col md:flex-row md:items-center md:justify-between gap-2"
              data-testid="models-toolbar"
            >
              <div className="flex flex-col md:flex-row md:flex-1 md:items-center md:space-x-2 gap-2 md:gap-0">
                <div className="w-full md:w-auto">
                  <Input
                    data-testid="models-search"
                    placeholder="Search models..."
                    value={searchTerm}
                    onChange={(event) => handleSearchChange(event.target.value)}
                    onBlur={handleSearchBlur}
                    onKeyDown={handleSearchKeyDown}
                    className="h-8 w-full md:w-[150px] lg:w-[250px]"
                    aria-label="Search models by name"
                    aria-controls="models-grid"
                  />
                </div>

                <div className="flex items-center space-x-2 flex-wrap">
                  <ThreePickerFilters
                    slots={[
                      {
                        column: providerColumn,
                        title: "Provider",
                        options: providerOptions,
                        isServerDriven: true,
                        onSearchChange: handleProviderSearchChange,
                        searchValue: localProviderSearch,
                      },
                      {
                        column: agentsColumn,
                        title: "Agent",
                        options: agentOptions,
                        isServerDriven: true,
                        onSearchChange: handleAgentSearchChange,
                        searchValue: localAgentSearch,
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
                        setLocalProviderSearch("");
                        setLocalDepartmentSearch("");
                        setLocalAgentSearch("");
                        table.resetColumnFilters();
                        updateModelsParams({
                          page: 0,
                          search: "",
                          providerIds: [],
                          departmentIds: [],
                          agentIds: [],
                          providerSearch: "",
                          departmentSearch: "",
                          agentSearch: "",
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
                  hiddenColumns={["name", "provider", "is_custom", "active", "departments", "agents", "updated_at"]}
                />
              </div>
            </div>
          )}

          {/* Cards Grid — container-query driven; scales with content area width */}
          <div className="@container">
            <div
              className="grid gap-4 @2xl:grid-cols-2 @5xl:grid-cols-3 @7xl:grid-cols-4"
              role="grid"
              aria-label="models grid"
              data-testid="models-grid"
            >
              {tableRows.length ? (
                tableRows.map((row) => renderModelCard(row.original))
              ) : (
                <div className="col-span-full text-center py-8 text-muted-foreground">
                  No models match the current filters.
                </div>
              )}
            </div>
          </div>

          {/* Pagination */}
          <DataTablePagination table={table} card={true} />
        </div>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent
            aria-labelledby="delete-model-title"
            data-testid="dialog-delete-model"
          >
            <AlertDialogHeader>
              <AlertDialogTitle id="delete-model-title">
                Delete Model
              </AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete the model "{deleteItem?.name}
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
          count={deletableModels.length}
          entityLabel="model"
          entityLabelPlural="models"
          isDeleting={isBulkDeleting}
          onConfirm={handleBulkDelete}
          description={
            <>
              <p>This action cannot be undone.</p>
              {deletableModels.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-destructive mb-1">Will be deleted:</p>
                  <ul className="text-sm space-y-0.5">
                    {deletableModels.map((m) => (
                      <li key={m.model_id} className="flex items-center gap-1.5">
                        <Trash2 className="h-3 w-3 text-destructive flex-shrink-0" />
                        {m.name || "Unnamed Model"}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {nonDeletableModels.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-yellow-600 dark:text-yellow-500 mb-1">
                    Cannot be deleted (in use):
                  </p>
                  <ul className="text-sm space-y-0.5">
                    {nonDeletableModels.map((m) => (
                      <li
                        key={m.model_id}
                        className="flex items-center gap-1.5 text-muted-foreground"
                      >
                        {m.name || "Unnamed Model"}
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
          count={editableModels.length}
          entityLabelPlural="models"
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
    </TooltipProvider>
  );
}
