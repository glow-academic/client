/**
 * Tools.tsx
 * Used to display the tools page with server-side filtering.
 */
"use client";
import { Copy, Edit, Eye, Trash2, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";

import type {
  DeleteToolIn,
  DeleteToolOut,
  DuplicateToolIn,
  DuplicateToolOut,
  ToolsListOut,
} from "@/app/(main)/intelligence/tools/page";
import { DataTableFacetedFilter } from "@/components/common/table/DataTableFacetedFilter";
import { DataTablePagination } from "@/components/common/table/DataTablePagination";
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
import { Input } from "@/components/ui/input";
import { GenerateRegenerateModal } from "@/components/common/forms/GenerateRegenerateModal";
import { useSocket } from "@/contexts/socket-context";
import { useGenerationModal } from "@/hooks/use-generation-modal";

export interface ToolsProps {
  // Server-provided data (for server-side rendering)
  listData: ToolsListOut;
  // Server actions (replaces useMutation)
  duplicateToolAction?: (input: DuplicateToolIn) => Promise<DuplicateToolOut>;
  deleteToolAction?: (input: DeleteToolIn) => Promise<DeleteToolOut>;
  // Server-side pagination
  pageIndex: number;
  pageSize: number;
  totalCount: number;
  // Server-side filter search terms
  departmentSearch: string;
  agentSearch: string;
}

export default function Tools({
  listData: serverListData,
  duplicateToolAction,
  deleteToolAction,
  pageIndex,
  pageSize,
  totalCount,
  departmentSearch,
  agentSearch,
}: ToolsProps) {
  const { socket, isConnected } = useSocket();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Generation modal via shared hook
  type ToolResourceType = "names" | "descriptions" | "args" | "arg_positions" | "args_outputs" | "flags";
  const { handleOpenStepCardModal, modalProps } = useGenerationModal<ToolResourceType>({
    stepResources: {
      all: ["names", "descriptions", "args", "arg_positions", "args_outputs", "flags"],
    },
    resourceLabels: {
      names: "Name",
      descriptions: "Description",
      args: "Arguments",
      arg_positions: "Argument Positions",
      args_outputs: "Argument Outputs",
      flags: "Configuration",
    },
    canRegenerate: () => true,
    onGenerate: (selectedResources, instructions) => {
      if (!socket || !isConnected) return;
      socket.emit("tool_generate", {
        resource_types: selectedResources,
        user_instructions: instructions?.trim() ? [instructions.trim()] : null,
        tool_id: null,
        draft_id: null,
      });
      toast.success("Generation started for new tool");
    },
    isGenerating: () => false,
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

  // Table state
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>(() => {
    const filters: ColumnFiltersState = [];
    const deptIds = searchParams?.getAll("departmentIds") ?? [];
    const agIds = searchParams?.getAll("agentIds") ?? [];
    const crIds = searchParams?.getAll("creatableIds") ?? [];
    if (deptIds.length > 0) filters.push({ id: "departments", value: deptIds });
    if (agIds.length > 0) filters.push({ id: "agents", value: agIds });
    if (crIds.length > 0) filters.push({ id: "creatable", value: crIds });
    return filters;
  });
  const [sorting, setSorting] = useState<SortingState>([
    { id: "updated_at", desc: true },
  ]);

  // Use server-provided data directly
  const toolsData = serverListData;

  // Extract data from response
  const tools = toolsData?.tools || [];
  const toolsArray = Array.isArray(tools) ? tools : [];

  // Filter options from server-provided ListFilterSection
  const departmentOptions = useMemo(
    () =>
      (toolsData?.department_filter?.options || [])
        .map((opt) => ({
          value: opt.id as string,
          label: opt.name as string,
          count: opt.count ?? undefined,
        }))
        .filter((opt) => opt.value && opt.label),
    [toolsData?.department_filter]
  );

  const agentOptions = useMemo(
    () =>
      (toolsData?.agent_filter?.options || [])
        .map((opt) => ({
          value: opt.id as string,
          label: opt.name as string,
          count: opt.count ?? undefined,
        }))
        .filter((opt) => opt.value && opt.label),
    [toolsData?.agent_filter]
  );

  const creatableOptions = useMemo(
    () =>
      (toolsData?.creatable_filter?.options || [])
        .map((opt) => ({
          value: opt.id as string,
          label: opt.name as string,
          count: opt.count ?? undefined,
        }))
        .filter((opt) => opt.value && opt.label),
    [toolsData?.creatable_filter]
  );

  // Helper to update URL search params
  const updateToolsParams = useCallback(
    (updates: {
      page?: number;
      pageSize?: number;
      search?: string;
      departmentIds?: string[];
      agentIds?: string[];
      creatableIds?: string[];
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

      if (updates.departmentIds !== undefined) {
        params.delete("departmentIds");
        updates.departmentIds.forEach((id) => params.append("departmentIds", id));
      }

      if (updates.agentIds !== undefined) {
        params.delete("agentIds");
        updates.agentIds.forEach((id) => params.append("agentIds", id));
      }

      if (updates.creatableIds !== undefined) {
        params.delete("creatableIds");
        updates.creatableIds.forEach((id) => params.append("creatableIds", id));
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
      updateToolsParams({ page: 0, search: value.trim() || "" });
    },
    [updateToolsParams]
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
  const agentSearchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [localDepartmentSearch, setLocalDepartmentSearch] = useState(departmentSearch);
  const [localAgentSearch, setLocalAgentSearch] = useState(agentSearch);

  const handleDepartmentSearchChange = useCallback(
    (value: string) => {
      setLocalDepartmentSearch(value);
      if (departmentSearchTimeoutRef.current) clearTimeout(departmentSearchTimeoutRef.current);
      departmentSearchTimeoutRef.current = setTimeout(() => {
        updateToolsParams({ departmentSearch: value });
      }, 300);
    },
    [updateToolsParams]
  );

  const handleAgentSearchChange = useCallback(
    (value: string) => {
      setLocalAgentSearch(value);
      if (agentSearchTimeoutRef.current) clearTimeout(agentSearchTimeoutRef.current);
      agentSearchTimeoutRef.current = setTimeout(() => {
        updateToolsParams({ agentSearch: value });
      }, 300);
    },
    [updateToolsParams]
  );

  // Sync column filters to URL when they change
  const handleColumnFiltersChange = useCallback(
    (updater: ColumnFiltersState | ((prev: ColumnFiltersState) => ColumnFiltersState)) => {
      const newFilters = typeof updater === "function" ? updater(columnFilters) : updater;
      setColumnFilters(newFilters);

      const departmentFilter = newFilters.find((f) => f.id === "departments");
      const agentFilter = newFilters.find((f) => f.id === "agents");
      const creatableFilter = newFilters.find((f) => f.id === "creatable");

      updateToolsParams({
        page: 0,
        departmentIds: (departmentFilter?.value as string[]) || [],
        agentIds: (agentFilter?.value as string[]) || [],
        creatableIds: (creatableFilter?.value as string[]) || [],
      });
    },
    [columnFilters, updateToolsParams]
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
      updateToolsParams({
        page: newPagination.pageIndex,
        pageSize: newPagination.pageSize,
      });
    },
    [pageIndex, pageSize, updateToolsParams]
  );

  // Compute page count from total
  const pageCount = Math.ceil(totalCount / pageSize);

  // Define table columns for filtering/sorting
  const columns: ColumnDef<(typeof toolsArray)[number]>[] = useMemo(
    () => [
      { accessorKey: "name", header: "Name" },
      {
        id: "updated_at",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: true,
        accessorFn: (row: (typeof toolsArray)[number]) => row.updated_at ?? null,
      },
      {
        id: "departments",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: () => [] as string[],
        filterFn: () => true,
      },
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
        id: "creatable",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: () => "" as string,
        filterFn: () => true,
      },
    ],
    []
  );

  // Create table instance with manual pagination and filtering
  const table = useReactTable({
    data: toolsArray,
    columns,
    state: {
      sorting,
      columnVisibility,
      columnFilters,
      pagination: {
        pageIndex,
        pageSize,
      },
    },
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
  }, [sortingKey, toolsArray.length, pageIndex, pageSize]);

  const handleDuplicate = async (toolId: string) => {
    if (isDuplicating === toolId || !duplicateToolAction) return;
    setIsDuplicating(toolId);
    try {
      const result = await duplicateToolAction({
        body: { tool_id: toolId },
      });
      if (result.tool_id) {
        const tool = toolsArray.find((t) => t.tool_id === toolId);
        toast.success(
          result.message || `Tool '${tool?.name || "Unknown"}' duplicated successfully`
        );
        router.push(`/intelligence/tools/${result.tool_id}`);
      }
    } catch (error) {
      toast.error(
        `Failed to duplicate tool: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    } finally {
      setIsDuplicating(null);
    }
  };

  const renderToolCard = (tool: (typeof toolsArray)[number]) => {
    const toolId = tool.tool_id ?? "";
    const toolName = tool.name ?? "";

    if (!toolId) return null;

    return (
      <Card
        key={toolId}
        className="relative flex flex-col h-full hover:shadow-md transition-shadow"
        data-testid="tool-card"
        data-tool-id={toolId}
        role="gridcell"
        aria-label={`tool card ${toolName}`}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-lg line-clamp-2">{toolName}</CardTitle>
              <div className="mt-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant={tool.active ? "default" : "secondary"}
                    className="text-xs"
                  >
                    {tool.active ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {tool.can_edit && toolId ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push(`/intelligence/tools/${toolId}`)}
                  aria-label={`Edit ${toolName}`}
                  data-testid={`btn-edit-tool-${toolId}`}
                  title={`Edit ${toolName}`}
                  className="h-9 px-3"
                >
                  <Edit className="h-4 w-4 md:mr-0 mr-2" />
                  <span className="md:hidden">Edit</span>
                </Button>
              ) : toolId ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push(`/intelligence/tools/${toolId}`)}
                  aria-label={`View ${toolName}`}
                  data-testid={`btn-view-tool-${toolId}`}
                  title={`View ${toolName}`}
                  className="h-9 px-3"
                >
                  <Eye className="h-4 w-4 md:mr-0 mr-2" />
                  <span className="md:hidden">View</span>
                </Button>
              ) : null}
              {tool.can_duplicate && duplicateToolAction && toolId && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDuplicate(toolId);
                  }}
                  disabled={isDuplicating === toolId}
                  aria-label={`Duplicate ${toolName}`}
                  data-testid={`btn-duplicate-tool-${toolId}`}
                  title={`Duplicate ${toolName}`}
                  className="h-9 px-3"
                >
                  {isDuplicating === toolId ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  ) : (
                    <>
                      <Copy className="h-4 w-4 md:mr-0 mr-2" />
                      <span className="md:hidden">Duplicate</span>
                    </>
                  )}
                </Button>
              )}
              {tool.can_delete && deleteToolAction && toolId && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteItem({ id: toolId, name: toolName });
                    setShowDeleteDialog(true);
                  }}
                  aria-label={`Delete ${toolName}`}
                  data-testid={`btn-delete-tool-${toolId}`}
                  title={`Delete ${toolName}`}
                  className="h-9 px-3"
                >
                  <Trash2 className="h-4 w-4 md:mr-0 mr-2" />
                  <span className="md:hidden">Delete</span>
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0 flex-1 flex flex-col">
          <p className="text-sm text-muted-foreground line-clamp-2">
            {tool.description || "No description"}
          </p>
        </CardContent>
      </Card>
    );
  };

  const handleDelete = async () => {
    if (!deleteItem || !deleteToolAction) return;
    setIsDeleting(true);
    try {
      const result = await deleteToolAction({
        body: { tool_id: deleteItem.id },
      });
      if (result.success) {
        toast.success(
          result.message || `Tool '${deleteItem.name}' deleted successfully`
        );
        setShowDeleteDialog(false);
        setDeleteItem(null);
        router.refresh();
      } else {
        toast.error(
          result.message || `Failed to delete tool: ${deleteItem.name}`
        );
      }
    } catch (error) {
      toast.error(
        `Failed to delete tool: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    } finally {
      setIsDeleting(false);
    }
  };

  // Get column references for toolbar
  const departmentsColumn = table.getColumn("departments");
  const agentsColumn = table.getColumn("agents");
  const creatableColumn = table.getColumn("creatable");
  const isFiltered =
    table.getState().columnFilters.length > 0 ||
    searchTerm.length > 0;

  return (
    <div className="space-y-6" data-page="tools-index">
      <div className="space-y-4">
        {/* Toolbar */}
        <div
          className="flex flex-col md:flex-row md:items-center md:justify-between gap-2"
          data-testid="tools-toolbar"
        >
          <div className="flex flex-col md:flex-row md:flex-1 md:items-center md:space-x-2 gap-2 md:gap-0">
            <div className="w-full md:w-auto">
              <Input
                data-testid="tools-search"
                placeholder="Search tools..."
                value={searchTerm}
                onChange={(event) => handleSearchChange(event.target.value)}
                onBlur={handleSearchBlur}
                onKeyDown={handleSearchKeyDown}
                className="h-8 w-full md:w-[150px] lg:w-[250px]"
                aria-label="Search tools by name"
                aria-controls="tools-grid"
              />
            </div>

            <div className="flex items-center space-x-2 flex-wrap">
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

              {creatableOptions.length > 0 && (
                <DataTableFacetedFilter
                  column={creatableColumn}
                  title="Type"
                  options={creatableOptions}
                  isServerDriven={true}
                />
              )}

              {isFiltered && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setSearchTerm("");
                    setLocalDepartmentSearch("");
                    setLocalAgentSearch("");
                    table.resetColumnFilters();
                    updateToolsParams({
                      page: 0,
                      search: "",
                      departmentIds: [],
                      agentIds: [],
                      creatableIds: [],
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
          aria-label="tools grid"
          data-testid="tools-grid"
        >
          {tableRows.length ? (
            tableRows.map((row) => renderToolCard(row.original))
          ) : (
            <div className="col-span-full text-center py-8 text-muted-foreground">
              No tools match the current filters.
            </div>
          )}
        </div>

        {/* Pagination */}
        <DataTablePagination table={table} card={true} />
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Tool</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteItem?.name}"? This action
              cannot be undone.
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
