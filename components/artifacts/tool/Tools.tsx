/**
 * Tools.tsx
 * Used to display the tools page with server-side filtering.
 */
"use client";
import { Copy, Edit, Eye, Pencil, Trash2, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";
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

import type {
  DeleteToolIn,
  DeleteToolOut,
  DuplicateToolIn,
  DuplicateToolOut,
  ToolsListOut,
  UpdateToolIn,
  UpdateToolOut,
} from "@/app/(main)/intelligence/tools/page";
import { ThreePickerFilters } from "@/components/common/table/ThreePickerFilters";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { BulkDeleteDialog } from "@/components/common/forms/BulkDeleteDialog";
import { BulkEditDialog } from "@/components/common/forms/BulkEditDialog";
import { BulkEditFlagField } from "@/components/common/forms/BulkEditFlagField";
import { useToolAi } from "@/hooks/use-tool-ai";

export interface ToolsProps {
  // Server-provided data (for server-side rendering)
  listData: ToolsListOut;
  // Server actions (replaces useMutation)
  duplicateToolAction?: (input: DuplicateToolIn) => Promise<DuplicateToolOut>;
  deleteToolAction?: (input: DeleteToolIn) => Promise<DeleteToolOut>;
  updateToolAction?: (input: UpdateToolIn) => Promise<UpdateToolOut>;
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
  updateToolAction,
  pageIndex,
  pageSize,
  totalCount,
  departmentSearch,
  agentSearch,
}: ToolsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useToolAi({
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

  // Table state — hidden columns default to off so they don't show in DataTableViewOptions
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({
    departments: false,
    agents: false,
    permissions: false,
    creatable: false,
  });
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>(() => {
    const filters: ColumnFiltersState = [];
    const deptIds = searchParams?.getAll("departmentIds") ?? [];
    const agIds = searchParams?.getAll("agentIds") ?? [];
    const crIds = searchParams?.getAll("creatableIds") ?? [];
    const permIds = searchParams?.getAll("permissionIds") ?? [];
    if (deptIds.length > 0) filters.push({ id: "departments", value: deptIds });
    if (agIds.length > 0) filters.push({ id: "agents", value: agIds });
    if (crIds.length > 0) filters.push({ id: "creatable", value: crIds });
    if (permIds.length > 0) filters.push({ id: "permissions", value: permIds });
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

  // Flag catalog (e.g. tool_active) — used to reconstruct flag_ids on bulk edit.
  const flagOptions = useMemo(() => {
    return (toolsData?.flag_filter?.options || [])
      .filter((opt): opt is typeof opt & { id: string; name: string } => !!opt.id && !!opt.name)
      .map((opt) => ({ id: opt.id!, name: opt.name!, type: opt.type ?? null }));
  }, [toolsData?.flag_filter]);

  // Selection state
  const [selectedToolIds, setSelectedToolIds] = useState<string[]>([]);
  const selectedCount = selectedToolIds.length;
  const selectedTools = useMemo(() => {
    return toolsArray.filter((t) => t.tool_id && selectedToolIds.includes(t.tool_id));
  }, [toolsArray, selectedToolIds]);
  const deletableTools = useMemo(
    () => selectedTools.filter((t) => t.can_delete),
    [selectedTools],
  );
  const nonDeletableTools = useMemo(
    () => selectedTools.filter((t) => !t.can_delete),
    [selectedTools],
  );
  const editableTools = useMemo(
    () => selectedTools.filter((t) => t.can_edit ?? true),
    [selectedTools],
  );
  const toggleSelection = useCallback((toolId: string) => {
    setSelectedToolIds((prev) =>
      prev.includes(toolId) ? prev.filter((id) => id !== toolId) : [...prev, toolId]
    );
  }, []);
  const clearSelection = useCallback(() => setSelectedToolIds([]), []);
  const selectAllOnPage = useCallback(() => {
    const pageIds = toolsArray.filter((t) => t.tool_id).map((t) => t.tool_id!);
    setSelectedToolIds((prev) => Array.from(new Set([...prev, ...pageIds])));
  }, [toolsArray]);
  const allPageSelected = useMemo(() => {
    const pageIds = toolsArray.filter((t) => t.tool_id).map((t) => t.tool_id!);
    return pageIds.length > 0 && pageIds.every((id) => selectedToolIds.includes(id));
  }, [toolsArray, selectedToolIds]);

  // Bulk delete state
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // Bulk edit state
  const [showBulkEditDialog, setShowBulkEditDialog] = useState(false);
  const [isBulkEditing, setIsBulkEditing] = useState(false);
  const [bulkEditActiveStatus, setBulkEditActiveStatus] = useState<boolean | null>(null);

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

  const permissionsOptions = useMemo(
    () =>
      (toolsData?.permissions_filter?.options || [])
        .map((opt) => ({
          value: opt.id as string,
          label: opt.name as string,
          count: opt.count ?? undefined,
        }))
        .filter((opt) => opt.value && opt.label),
    [toolsData?.permissions_filter]
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
      permissionIds?: string[];
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

      if (updates.permissionIds !== undefined) {
        params.delete("permissionIds");
        updates.permissionIds.forEach((id) => params.append("permissionIds", id));
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

  // Handle filter option search changes (debounced) — only departments is
  // server-driven (department_search is in SearchToolApiRequest). agents and
  // permissions are client-faceted so no URL/search state is needed for them.
  const departmentSearchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [localDepartmentSearch, setLocalDepartmentSearch] = useState(departmentSearch);
  // Reference unused props so they aren't stripped by lint (page-level wiring
  // still passes agentSearch even though it's not surfaced as a server search).
  void agentSearch;

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

  // Sync column filters to URL when they change
  const handleColumnFiltersChange = useCallback(
    (updater: ColumnFiltersState | ((prev: ColumnFiltersState) => ColumnFiltersState)) => {
      const newFilters = typeof updater === "function" ? updater(columnFilters) : updater;
      setColumnFilters(newFilters);

      const departmentFilter = newFilters.find((f) => f.id === "departments");
      const agentFilter = newFilters.find((f) => f.id === "agents");
      const creatableFilter = newFilters.find((f) => f.id === "creatable");
      const permissionsFilter = newFilters.find((f) => f.id === "permissions");

      updateToolsParams({
        page: 0,
        departmentIds: (departmentFilter?.value as string[]) || [],
        agentIds: (agentFilter?.value as string[]) || [],
        creatableIds: (creatableFilter?.value as string[]) || [],
        permissionIds: (permissionsFilter?.value as string[]) || [],
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
        enableColumnFilter: true,
        accessorFn: (row: (typeof toolsArray)[number]) => row.department_ids ?? [],
        filterFn: (row, id, filterValue: string[]) =>
          !filterValue?.length || filterValue.some((v) => ((row.getValue(id) as string[]) ?? []).includes(v)),
      },
      {
        id: "agents",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        enableColumnFilter: true,
        accessorFn: (row: (typeof toolsArray)[number]) => row.agent_ids ?? [],
        filterFn: (row, id, filterValue: string[]) =>
          !filterValue?.length || filterValue.some((v) => ((row.getValue(id) as string[]) ?? []).includes(v)),
      },
      {
        id: "permissions",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        enableColumnFilter: true,
        accessorFn: (row: (typeof toolsArray)[number]) => row.permission_ids ?? [],
        filterFn: (row, id, filterValue: string[]) =>
          !filterValue?.length || filterValue.some((v) => ((row.getValue(id) as string[]) ?? []).includes(v)),
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
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualPagination: true,
    // Client-side filterFns run for slots whose API does not support server-side
    // filtering (e.g. permissions). Server-driven slots (departments, agents)
    // already get pre-filtered rows from the server, so the client filterFn is
    // a harmless second pass.
    manualFiltering: false,
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
        body: { tool_id: toolId, accept: true },
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

  const handleBulkDelete = async () => {
    if (!deleteToolAction || deletableTools.length === 0) return;
    setIsBulkDeleting(true);
    try {
      const ids = deletableTools.map((t) => t.tool_id!);
      await deleteToolAction({ body: { tool_ids: ids, accept: true } });
      toast.success(`${ids.length} tool(s) deleted successfully`);
      clearSelection();
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to delete tools";
      toast.error(msg.replace(/^\d{3}\s*/, "") || "Failed to delete tools");
    } finally {
      setIsBulkDeleting(false);
      setShowBulkDeleteDialog(false);
    }
  };

  const handleBulkEdit = async () => {
    if (!updateToolAction || editableTools.length === 0) return;

    const hasActiveChange = bulkEditActiveStatus !== null;
    if (!hasActiveChange) {
      toast.error("No changes selected");
      return;
    }

    const activeFlagId = flagOptions.find((f) => f.type === "tool_active")?.id;

    setIsBulkEditing(true);
    try {
      const items = editableTools.map((t) => {
        let flag_ids: string[] | undefined;
        if (hasActiveChange) {
          const isActive = bulkEditActiveStatus;
          flag_ids = isActive && activeFlagId ? [activeFlagId] : [];
        }
        return {
          id: t.tool_id!,
          ...(hasActiveChange && { flag_ids }),
        };
      });

      await updateToolAction({ body: { tools: items } } as UpdateToolIn);
      toast.success(`${items.length} tool(s) updated successfully`);
      clearSelection();
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to update tools";
      toast.error(msg.replace(/^\d{3}\s*/, "") || "Failed to update tools");
    } finally {
      setIsBulkEditing(false);
      setShowBulkEditDialog(false);
    }
  };

  const openBulkEditDialog = () => {
    setBulkEditActiveStatus(null);
    setShowBulkEditDialog(true);
  };

  const renderToolCard = (tool: (typeof toolsArray)[number]) => {
    const toolId = tool.tool_id ?? "";
    const toolName = tool.name ?? "";

    if (!toolId) return null;

    const isSelected = selectedToolIds.includes(toolId);

    const handleCardClick = (e: React.MouseEvent) => {
      // Don't toggle selection if clicking action buttons
      if ((e.target as HTMLElement).closest("[data-action-button]")) return;
      toggleSelection(toolId);
    };

    return (
      <Card
        key={toolId}
        className={`group relative flex flex-col h-full hover:shadow-md transition-all cursor-pointer ${
          isSelected ? "ring-2 ring-primary" : ""
        }`}
        data-testid="tool-card"
        data-tool-id={toolId}
        role="gridcell"
        aria-label={`tool card ${toolName}`}
        aria-selected={isSelected}
        onClick={handleCardClick}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-lg line-clamp-2 flex items-center gap-2">
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
                    onCheckedChange={() => toggleSelection(toolId)}
                    className="rounded-full h-5 w-5"
                    aria-label={`Select tool ${toolName || "Unnamed"}`}
                  />
                </div>
                <span className="truncate">{toolName}</span>
              </CardTitle>
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
            <div className="flex items-center gap-2" data-action-button>
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
      await deleteToolAction({
        body: { tool_ids: [deleteItem.id], accept: true },
      });
      toast.success(`Tool '${deleteItem.name}' deleted successfully`);
      setShowDeleteDialog(false);
      setDeleteItem(null);
      router.refresh();
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
  const permissionsColumn = table.getColumn("permissions");
  const isFiltered =
    table.getState().columnFilters.length > 0 ||
    searchTerm.length > 0;

  return (
    <div className="space-y-6" data-page="tools-index">
      <div className="space-y-4">
        {/* Toolbar — swaps between filter bar and selection action bar */}
        {selectedCount > 0 ? (
          <div
            className="flex items-center justify-between gap-2"
            data-testid="tools-toolbar"
          >
            <div className="flex items-center gap-2">
              {deleteToolAction && (
                <Button
                  variant="destructive"
                  size="sm"
                  className="h-8"
                  onClick={() => setShowBulkDeleteDialog(true)}
                  disabled={deletableTools.length === 0}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete {deletableTools.length} of {selectedCount}
                </Button>
              )}
              {updateToolAction && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={openBulkEditDialog}
                  disabled={editableTools.length === 0}
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit {editableTools.length} of {selectedCount}
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
          </div>
        ) : (
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
                <ThreePickerFilters
                  slots={[
                    {
                      column: permissionsColumn,
                      title: "Permissions",
                      options: permissionsOptions,
                    },
                    {
                      column: agentsColumn,
                      title: "Agent",
                      options: agentOptions,
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
                      table.resetColumnFilters();
                      updateToolsParams({
                        page: 0,
                        search: "",
                        departmentIds: [],
                        agentIds: [],
                        creatableIds: [],
                        permissionIds: [],
                        departmentSearch: "",
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
        )}

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

      {/* Bulk Delete Confirmation Dialog */}
      <BulkDeleteDialog
        open={showBulkDeleteDialog}
        onOpenChange={setShowBulkDeleteDialog}
        count={deletableTools.length}
        entityLabel="tool"
        entityLabelPlural="tools"
        isDeleting={isBulkDeleting}
        onConfirm={handleBulkDelete}
        description={
          <>
            <p>This action cannot be undone.</p>
            {deletableTools.length > 0 && (
              <div>
                <p className="text-sm font-medium text-destructive mb-1">Will be deleted:</p>
                <ul className="text-sm space-y-0.5">
                  {deletableTools.map((t) => (
                    <li key={t.tool_id} className="flex items-center gap-1.5">
                      <Trash2 className="h-3 w-3 text-destructive flex-shrink-0" />
                      {t.name || "Unnamed Tool"}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {nonDeletableTools.length > 0 && (
              <div>
                <p className="text-sm font-medium text-yellow-600 dark:text-yellow-500 mb-1">
                  Cannot be deleted (in use):
                </p>
                <ul className="text-sm space-y-0.5">
                  {nonDeletableTools.map((t) => (
                    <li
                      key={t.tool_id}
                      className="flex items-center gap-1.5 text-muted-foreground"
                    >
                      {t.name || "Unnamed Tool"}
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
        count={editableTools.length}
        entityLabelPlural="tools"
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
