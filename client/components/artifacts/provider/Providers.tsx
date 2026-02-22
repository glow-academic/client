/**
 * Providers.tsx
 * Used to display the providers page with server-side filtering.
 */
"use client";
import { Edit, Trash2, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import type {
  DeleteProviderIn,
  DeleteProviderOut,
  ProvidersListOut,
} from "@/app/(main)/intelligence/providers/page";
import { DataTableFacetedFilter } from "@/components/common/table/DataTableFacetedFilter";
import { DataTablePagination } from "@/components/common/table/DataTablePagination";
import { Input } from "@/components/ui/input";
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
import { GenerateRegenerateModal } from "@/components/common/forms/GenerateRegenerateModal";
import { useArtifactAi } from "@/hooks/use-artifact-ai";
import { useGenerationModal } from "@/hooks/use-generation-modal";

export interface ProvidersProps {
  // Server-provided data (for server-side rendering)
  listData: ProvidersListOut;
  // Server actions (replaces useMutation)
  deleteProviderAction?: (
    input: DeleteProviderIn
  ) => Promise<DeleteProviderOut>;
  // Server-side pagination
  pageIndex: number;
  pageSize: number;
  totalCount: number;
  // Server-side filter search terms
  departmentSearch: string;
  modelSearch: string;
}

export default function Providers({
  listData: serverListData,
  deleteProviderAction,
  pageIndex,
  pageSize,
  totalCount,
  departmentSearch,
  modelSearch,
}: ProvidersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Generation modal via shared hook
  type ProviderResourceType = "names" | "descriptions" | "flags" | "departments" | "values" | "endpoints";
  const { generate } = useArtifactAi({
    artifactType: "provider",
    groupId: null,
    validResourceTypes: ["names", "descriptions", "flags", "departments", "values", "endpoints"],
  });
  const { handleOpenStepCardModal, modalProps } = useGenerationModal<ProviderResourceType>({
    stepResources: {
      all: ["names", "descriptions", "flags", "departments", "values", "endpoints"],
    },
    resourceLabels: {
      names: "Name",
      descriptions: "Description",
      flags: "Configuration",
      departments: "Departments",
      values: "Values",
      endpoints: "Endpoints",
    },
    canRegenerate: () => true,
    onGenerate: (selectedResources, instructions) => {
      generate(selectedResources, {
        user_instructions: instructions?.trim() ? [instructions.trim()] : null,
      });
    },
    isGenerating: () => false,
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
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
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
        body: {
          provider_id: deleteItem.id,
        },
      });
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

  const handleEdit = (id: string) => {
    router.push(`/intelligence/providers/${id}`);
  };

  const renderProviderCard = (provider: (typeof providers)[number]) => {
    const providerId = provider.provider_id;
    const providerName = provider.name;
    if (!providerId) return null;

    return (
      <Card
        key={providerId}
        aria-label={providerName ?? undefined}
        data-testid="provider-card"
        data-provider-id={providerId}
        className="relative flex flex-col h-full"
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-lg">{provider.name}</CardTitle>
              <div className="mt-1 space-y-2">
                <div className="flex items-center gap-2">
                  {!provider.active && (
                    <Badge variant="secondary">Inactive</Badge>
                  )}
                  <Badge variant="outline">{provider.value}</Badge>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
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
        <CardContent className="pt-0 flex-1 flex flex-col">
          <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
            {provider.description || "No description"}
          </p>
        </CardContent>
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
      {/* Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
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
          <DataTableFacetedFilter
            column={departmentsColumn}
            title="Department"
            options={departmentOptions}
            isServerDriven={true}
            onSearchChange={handleDepartmentSearchChange}
            searchValue={localDepartmentSearch}
          />
          <DataTableFacetedFilter
            column={modelsColumn}
            title="Model"
            options={modelOptions}
            isServerDriven={true}
            onSearchChange={handleModelSearchChange}
            searchValue={localModelSearch}
          />
          {statusColumn && statusOptions.length > 0 && (
            <DataTableFacetedFilter
              column={statusColumn}
              title="Status"
              options={statusOptions}
              isServerDriven={true}
            />
          )}
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
      </div>

      {/* Providers Grid */}
      {tableRows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12">
          <p className="text-muted-foreground">No providers found</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tableRows.map((row) => renderProviderCard(row.original))}
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

      <GenerateRegenerateModal {...modalProps} />
    </div>
  );
}
