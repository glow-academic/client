/**
 * Models.tsx
 * Used to display the models page with server-side filtering.
 * Hybrid approach: provider/department/agent filters are server-driven,
 * type (custom/standard) and status (active/inactive) remain client-side.
 * @AshokSaravanan222 & @siladiea
 * 06/18/2025
 */
"use client";
import { Copy, Cpu, Edit, Trash2, X } from "lucide-react";
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
import { TooltipProvider } from "@/components/ui/tooltip";
import { useArtifactAi } from "@/hooks/use-artifact-ai";
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
} from "@/app/(main)/intelligence/models/page";
import { DataTableFacetedFilter } from "@/components/common/table/DataTableFacetedFilter";
import { DataTablePagination } from "@/components/common/table/DataTablePagination";
import { Input } from "@/components/ui/input";

export interface ModelsProps {
  // Server-provided data (for server-side rendering)
  listData: ModelsListOut;
  // Server actions (replaces useMutation)
  duplicateModelAction?: (
    input: DuplicateModelIn
  ) => Promise<DuplicateModelOut>;
  deleteModelAction?: (input: DeleteModelIn) => Promise<DeleteModelOut>;
  // Server-side pagination
  pageIndex: number;
  pageSize: number;
  totalCount: number;
  // Server-side filter search terms
  providerSearch: string;
  departmentSearch: string;
  agentSearch: string;
}

export default function Models({
  listData: serverListData,
  duplicateModelAction,
  deleteModelAction,
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
  useArtifactAi({
    artifactType: "model",
    validResourceTypes: ["names", "descriptions", "values", "providers", "flags", "departments", "modalities", "temperature_levels", "pricing", "reasoning_levels"],
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

  const statusOptions = useMemo(
    () => [
      { value: "true", label: "Active" },
      { value: "false", label: "Inactive" },
    ],
    []
  );

  // Table state - initialize server-driven filters from URL, client-only filters start empty
  const [rowSelection, setRowSelection] = useState({});
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
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
  const customModelColumn = table.getColumn("is_custom");
  const activeColumn = table.getColumn("active");
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
        body: {
          model_id: deleteItem.id,
        },
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
        body: {
          model_id: model.model_id,
        },
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

  const renderModelCard = (model: (typeof models)[number]) => (
    <Card
      key={model.model_id}
      className="hover:shadow-md transition-shadow flex flex-col h-full min-h-[220px]"
      data-testid="model-card"
      data-model-id={model.model_id}
      role="gridcell"
      aria-label={`model card ${model.name || "Unnamed Model"}`}
    >
      <CardHeader className="flex-0">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2">
          <div className="space-y-1 flex-1 min-w-0">
            <CardTitle className="text-base flex items-center gap-2">
              <Cpu className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">{model.name}</span>
            </CardTitle>
            <CardDescription className="text-xs line-clamp-2">
              {model.description}
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-1 flex-shrink-0">
            {model.base_url && model.base_url !== "" && (
              <Badge variant="default">Custom</Badge>
            )}
            {!model.active && <Badge variant="secondary">Inactive</Badge>}
          </div>
        </div>
        <div className="mt-2">
          <Badge variant="outline" className="text-xs">
            {model.provider_name || "Custom"}
          </Badge>
        </div>
      </CardHeader>
      <CardFooter className="mt-auto flex flex-wrap justify-end gap-2">
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

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <div className="space-y-4">
          {/* Toolbar */}
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
                <DataTableFacetedFilter
                  column={providerColumn}
                  title="Provider"
                  options={providerOptions}
                  isServerDriven={true}
                  onSearchChange={handleProviderSearchChange}
                  searchValue={localProviderSearch}
                />

                <DataTableFacetedFilter
                  column={departmentsColumn}
                  title="Department"
                  options={departmentOptions}
                  isServerDriven={true}
                  onSearchChange={handleDepartmentSearchChange}
                  searchValue={localDepartmentSearch}
                />

                <DataTableFacetedFilter
                  column={agentsColumn}
                  title="Agent"
                  options={agentOptions}
                  isServerDriven={true}
                  onSearchChange={handleAgentSearchChange}
                  searchValue={localAgentSearch}
                />

                {customModelColumn && (
                  <DataTableFacetedFilter
                    column={customModelColumn}
                    title="Type"
                    options={[
                      { value: "true", label: "Custom Models" },
                      { value: "false", label: "Standard Models" },
                    ]}
                  />
                )}

                {activeColumn && statusOptions.length > 0 && (
                  <DataTableFacetedFilter
                    column={activeColumn}
                    title="Status"
                    options={statusOptions}
                  />
                )}

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
          </div>

          {/* Cards Grid */}
          <div
            className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
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

      </div>
    </TooltipProvider>
  );
}
