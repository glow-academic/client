/**
 * Agents.tsx
 * Used to display the agents page with server-side filtering.
 * @AshokSaravanan222 & @siladiea
 * 07/20/2025
 */
"use client";
import { Brain, Copy, Edit, Eye, Thermometer, Trash2, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import type {
  AgentsListOut,
  DeleteAgentIn,
  DeleteAgentOut,
  DuplicateAgentIn,
  DuplicateAgentOut,
} from "@/app/(main)/intelligence/agents/page";
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
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useProfile } from "@/contexts/profile-context";

export interface AgentsProps {
  // Server-provided data (for server-side rendering)
  listData: AgentsListOut;
  // Server actions (replaces useMutation)
  duplicateAgentAction?: (
    input: DuplicateAgentIn,
  ) => Promise<DuplicateAgentOut>;
  deleteAgentAction?: (input: DeleteAgentIn) => Promise<DeleteAgentOut>;
  // Server-side pagination
  pageIndex: number;
  pageSize: number;
  totalCount: number;
  // Server-side filter search terms
  departmentSearch: string;
  modelSearch: string;
  toolSearch: string;
}

export default function Agents({
  listData: serverListData,
  duplicateAgentAction,
  deleteAgentAction,
  pageIndex,
  pageSize,
  totalCount,
  departmentSearch,
  modelSearch,
  toolSearch,
}: AgentsProps) {
  const { profile } = useProfile();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Delete dialog state
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
    const tIds = searchParams?.getAll("toolIds") ?? [];
    if (deptIds.length > 0) filters.push({ id: "departments", value: deptIds });
    if (mIds.length > 0) filters.push({ id: "model_id", value: mIds });
    if (tIds.length > 0) filters.push({ id: "tools", value: tIds });
    return filters;
  });
  const [sorting, setSorting] = useState<SortingState>([
    { id: "updated_at", desc: true },
  ]);

  // Use server-provided data directly
  const agentsData = serverListData;

  // Extract data from response - agents is now an array (composite types)
  const agents = useMemo(() => {
    const agentsArray = agentsData?.agents || [];
    return agentsArray.sort((a, b) => {
      if (a.updated_at && b.updated_at) {
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      }
      return 0;
    });
  }, [agentsData?.agents]);

  // Build model mapping from agents array (for per-card model name display)
  const modelMapping = useMemo(() => {
    const mapping: Record<string, { name: string; description: string }> = {};
    const agentsArray = agentsData?.agents || [];
    agentsArray.forEach((agent) => {
      if (agent.model_id && agent.model_name) {
        if (!mapping[agent.model_id]) {
          mapping[agent.model_id] = {
            name: agent.model_name || "",
            description: agent.model_description || "",
          };
        }
      }
    });
    return mapping;
  }, [agentsData]);

  // Filter options from server-provided ListFilterSection
  const departmentOptions = useMemo(
    () =>
      (agentsData?.department_filter?.options || [])
        .map((opt) => ({
          value: opt.id as string,
          label: opt.name as string,
          count: opt.count ?? undefined,
        }))
        .filter((opt) => opt.value && opt.label),
    [agentsData?.department_filter],
  );

  const modelOptions = useMemo(
    () =>
      (agentsData?.model_filter?.options || [])
        .map((opt) => ({
          value: opt.id as string,
          label: opt.name as string,
          count: opt.count ?? undefined,
        }))
        .filter((opt) => opt.value && opt.label),
    [agentsData?.model_filter],
  );

  const toolOptions = useMemo(
    () =>
      (agentsData?.tool_filter?.options || [])
        .map((opt) => ({
          value: opt.id as string,
          label: opt.name as string,
          count: opt.count ?? undefined,
        }))
        .filter((opt) => opt.value && opt.label),
    [agentsData?.tool_filter],
  );

  // Helper to update URL search params
  const updateAgentsParams = useCallback(
    (updates: {
      page?: number;
      pageSize?: number;
      search?: string;
      departmentIds?: string[];
      modelIds?: string[];
      toolIds?: string[];
      departmentSearch?: string;
      modelSearch?: string;
      toolSearch?: string;
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

      if (updates.toolIds !== undefined) {
        params.delete("toolIds");
        updates.toolIds.forEach((id) => params.append("toolIds", id));
      }

      if (updates.departmentSearch !== undefined) {
        if (updates.departmentSearch === "") params.delete("departmentSearch");
        else params.set("departmentSearch", updates.departmentSearch);
      }

      if (updates.modelSearch !== undefined) {
        if (updates.modelSearch === "") params.delete("modelSearch");
        else params.set("modelSearch", updates.modelSearch);
      }

      if (updates.toolSearch !== undefined) {
        if (updates.toolSearch === "") params.delete("toolSearch");
        else params.set("toolSearch", updates.toolSearch);
      }

      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  // Commit search to URL
  const commitSearch = useCallback(
    (value: string) => {
      updateAgentsParams({ page: 0, search: value.trim() || "" });
    },
    [updateAgentsParams]
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
  const toolSearchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [localDepartmentSearch, setLocalDepartmentSearch] = useState(departmentSearch);
  const [localModelSearch, setLocalModelSearch] = useState(modelSearch);
  const [localToolSearch, setLocalToolSearch] = useState(toolSearch);

  const handleDepartmentSearchChange = useCallback(
    (value: string) => {
      setLocalDepartmentSearch(value);
      if (departmentSearchTimeoutRef.current) clearTimeout(departmentSearchTimeoutRef.current);
      departmentSearchTimeoutRef.current = setTimeout(() => {
        updateAgentsParams({ departmentSearch: value });
      }, 300);
    },
    [updateAgentsParams]
  );

  const handleModelSearchChange = useCallback(
    (value: string) => {
      setLocalModelSearch(value);
      if (modelSearchTimeoutRef.current) clearTimeout(modelSearchTimeoutRef.current);
      modelSearchTimeoutRef.current = setTimeout(() => {
        updateAgentsParams({ modelSearch: value });
      }, 300);
    },
    [updateAgentsParams]
  );

  const handleToolSearchChange = useCallback(
    (value: string) => {
      setLocalToolSearch(value);
      if (toolSearchTimeoutRef.current) clearTimeout(toolSearchTimeoutRef.current);
      toolSearchTimeoutRef.current = setTimeout(() => {
        updateAgentsParams({ toolSearch: value });
      }, 300);
    },
    [updateAgentsParams]
  );

  // Sync column filters to URL when they change
  const handleColumnFiltersChange = useCallback(
    (updater: ColumnFiltersState | ((prev: ColumnFiltersState) => ColumnFiltersState)) => {
      const newFilters = typeof updater === "function" ? updater(columnFilters) : updater;
      setColumnFilters(newFilters);

      const departmentFilter = newFilters.find((f) => f.id === "departments");
      const modelFilter = newFilters.find((f) => f.id === "model_id");
      const toolFilter = newFilters.find((f) => f.id === "tools");

      updateAgentsParams({
        page: 0,
        departmentIds: (departmentFilter?.value as string[]) || [],
        modelIds: (modelFilter?.value as string[]) || [],
        toolIds: (toolFilter?.value as string[]) || [],
      });
    },
    [columnFilters, updateAgentsParams]
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
      updateAgentsParams({
        page: newPagination.pageIndex,
        pageSize: newPagination.pageSize,
      });
    },
    [pageIndex, pageSize, updateAgentsParams]
  );

  // Compute page count from total
  const pageCount = Math.ceil(totalCount / pageSize);

  // Define table columns inline
  const columns: ColumnDef<(typeof agents)[number]>[] = useMemo(
    () => [
      {
        accessorKey: "name",
        header: "Name",
      },
      {
        accessorKey: "model_id",
        header: "Model",
        cell: ({ row }) => {
          const modelId = row.getValue("model_id") as string;
          return modelMapping[modelId]?.name || modelId;
        },
      },
      // Hidden faceting column for Departments (array of IDs)
      {
        id: "departments",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: (typeof agents)[number]) => row.department_ids ?? [],
        filterFn: (row, _id, value: string[]) => {
          const rowIds = (row.getValue("departments") as string[]) ?? [];
          if (value.length === 0) return true;
          if (rowIds.length === 0) return true;
          return value.some((v) => rowIds.includes(v));
        },
      },
      // Hidden faceting column for Tools
      {
        id: "tools",
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
    [modelMapping],
  );

  // Create table instance with manual pagination and filtering
  const table = useReactTable({
    data: agents,
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
  }, [sortingKey, agents.length, pageIndex, pageSize]);

  const handleEdit = (id: string) => {
    router.push(`/intelligence/agents/${id}`);
  };

  const handleDuplicate = async (id: string) => {
    if (!duplicateAgentAction || !profile?.id) return;

    try {
      await duplicateAgentAction({
        body: { agent_id: id },
      });
      toast.success("Agent duplicated successfully");
      router.refresh();
    } catch {
      toast.error("Failed to duplicate agent");
    }
  };

  const handleDelete = async () => {
    if (!deleteItem || !deleteAgentAction || !profile?.id) return;

    setIsDeleting(true);
    try {
      await deleteAgentAction({
        body: { agent_id: deleteItem.id },
      });
      toast.success("Agent deleted successfully");
      router.refresh();
    } catch {
      toast.error("Failed to delete agent");
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

  const formatTemperature = (temp: number) => {
    return temp.toFixed(2);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const renderAgentCard = (agent: (typeof agents)[0]) => (
    <Card
      key={agent.agent_id}
      className="hover:shadow-md transition-shadow"
      data-testid="agent-card"
      data-agent-id={agent.agent_id}
      role="gridcell"
      aria-label={`agent card ${agent.name || "Unnamed Agent"}`}
    >
      <CardHeader>
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="space-y-2 flex-1 min-w-0">
            <CardTitle className="text-base truncate">
              {agent.name || "Unnamed Agent"}
            </CardTitle>
            <div className="mt-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                {agent.reasoning && (
                  <Badge variant="outline" className="text-xs">
                    <Brain className="h-3 w-3 mr-1" />
                    {agent.reasoning}
                  </Badge>
                )}
                {agent.temperature !== null && agent.temperature !== undefined && (
                  <Badge variant="outline" className="text-xs">
                    <Thermometer className="h-3 w-3 mr-1" />
                    {formatTemperature(agent.temperature)}
                  </Badge>
                )}
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              {agent.description || "No description available"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            {agent.can_edit && agent.agent_id ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleEdit(agent.agent_id!)}
                aria-label={`Edit agent ${agent.name ?? "Unnamed Agent"}`}
                data-testid="btn-edit-agent"
                title={`Edit agent ${agent.name ?? "Unnamed Agent"}`}
                className="h-9 px-3"
              >
                <Edit className="h-4 w-4 md:mr-0 mr-2" />
                <span className="md:hidden">Edit</span>
              </Button>
            ) : agent.agent_id ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleEdit(agent.agent_id!)}
                aria-label={`View agent ${agent.name ?? "Unnamed Agent"}`}
                data-testid="btn-view-agent"
                title={`View agent ${agent.name ?? "Unnamed Agent"}`}
                className="h-9 px-3"
              >
                <Eye className="h-4 w-4 md:mr-0 mr-2" />
                <span className="md:hidden">View</span>
              </Button>
            ) : null}
            {agent.can_duplicate && agent.agent_id && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDuplicate(agent.agent_id!)}
                disabled={false}
                aria-label={`Duplicate agent ${agent.name ?? "Unnamed Agent"}`}
                data-testid="btn-duplicate-agent"
                title={`Duplicate agent ${agent.name ?? "Unnamed Agent"}`}
                className="h-9 px-3"
              >
                <Copy className="h-4 w-4 md:mr-0 mr-2" />
                <span className="md:hidden">Duplicate</span>
              </Button>
            )}
            {agent.can_delete && agent.agent_id && (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  handleDeleteClick(
                    agent.agent_id!,
                    agent.name ?? "Unnamed Agent",
                  )
                }
                aria-label={`Delete agent ${agent.name ?? "Unnamed Agent"}`}
                data-testid="btn-delete-agent"
                title={`Delete agent ${agent.name ?? "Unnamed Agent"}`}
                className="h-9 px-3"
              >
                <Trash2 className="h-4 w-4 md:mr-0 mr-2" />
                <span className="md:hidden">Delete</span>
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-sm">
          <span className="text-muted-foreground">Updated:</span>
          <span className="font-medium ml-2">
            {agent.updated_at ? formatDate(agent.updated_at) : "N/A"}
          </span>
        </div>
      </CardContent>
    </Card>
  );

  // Get column references for toolbar
  const modelColumn = table.getColumn("model_id");
  const departmentsColumn = table.getColumn("departments");
  const toolsColumn = table.getColumn("tools");
  const isFiltered =
    table.getState().columnFilters.length > 0 ||
    searchTerm.length > 0;

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        {/* Toolbar */}
        <div
          className="flex flex-col md:flex-row md:items-center md:justify-between gap-2"
          data-testid="agents-toolbar"
        >
          <div className="flex flex-col md:flex-row md:flex-1 md:items-center md:space-x-2 gap-2 md:gap-0">
            <div className="w-full md:w-auto">
              <Input
                data-testid="agents-search"
                placeholder="Search system agents..."
                value={searchTerm}
                onChange={(event) => handleSearchChange(event.target.value)}
                onBlur={handleSearchBlur}
                onKeyDown={handleSearchKeyDown}
                className="h-8 w-full md:w-[150px] lg:w-[250px]"
                aria-label="Search agents by name"
                aria-controls="agents-grid"
              />
            </div>

            <div className="flex items-center space-x-2 flex-wrap">
              {/* Department Filter */}
              <DataTableFacetedFilter
                column={departmentsColumn}
                title="Department"
                options={departmentOptions}
                isServerDriven={true}
                onSearchChange={handleDepartmentSearchChange}
                searchValue={localDepartmentSearch}
              />

              {/* Model Filter */}
              <DataTableFacetedFilter
                column={modelColumn}
                title="Model"
                options={modelOptions}
                isServerDriven={true}
                onSearchChange={handleModelSearchChange}
                searchValue={localModelSearch}
              />

              {/* Tool Filter */}
              <DataTableFacetedFilter
                column={toolsColumn}
                title="Tool"
                options={toolOptions}
                isServerDriven={true}
                onSearchChange={handleToolSearchChange}
                searchValue={localToolSearch}
              />

              {isFiltered && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setSearchTerm("");
                    setLocalDepartmentSearch("");
                    setLocalModelSearch("");
                    setLocalToolSearch("");
                    table.resetColumnFilters();
                    updateAgentsParams({
                      page: 0,
                      search: "",
                      departmentIds: [],
                      modelIds: [],
                      toolIds: [],
                      departmentSearch: "",
                      modelSearch: "",
                      toolSearch: "",
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
          aria-label="agents grid"
          data-testid="agents-grid"
        >
          {tableRows.length ? (
            tableRows.map((row) => renderAgentCard(row.original))
          ) : (
            <div className="col-span-full text-center py-8 text-muted-foreground">
              No system agents match the current filters.
            </div>
          )}
        </div>

        {/* Pagination */}
        <div aria-label="pagination controls">
          <DataTablePagination table={table} card={true} />
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent
          aria-labelledby="delete-agent-title"
          data-testid="dialog-delete-agent"
        >
          <AlertDialogHeader>
            <AlertDialogTitle id="delete-agent-title">
              Delete Agent
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the agent "{deleteItem?.name}
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
  );
}
