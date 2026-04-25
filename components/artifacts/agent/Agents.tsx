/**
 * Agents.tsx
 * Used to display the agents page with server-side filtering.
 * @AshokSaravanan222 & @siladiea
 * 07/20/2025
 */
"use client";
import { Brain, Copy, Edit, Eye, Pencil, Thermometer, Trash2, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import type {
  AgentsListOut,
  DeleteAgentIn,
  DeleteAgentOut,
  DuplicateAgentIn,
  DuplicateAgentOut,
  UpdateAgentIn,
  UpdateAgentOut,
} from "@/app/(main)/intelligence/agents/page";
import { ThreePickerFilters } from "@/components/common/table/ThreePickerFilters";
import { DataTablePagination } from "@/components/common/table/DataTablePagination";
import { DataTableViewOptions } from "@/components/common/table/DataTableViewOptions";
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
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useAgentAi } from "@/hooks/use-agent-ai";
import { useColumnVisibility } from "@/hooks/use-column-visibility";
import { useProfile } from "@/contexts/profile-context";

export interface AgentsProps {
  // Server-provided data (for server-side rendering)
  listData: AgentsListOut;
  // SSR column visibility from cookie
  initialColumnVisibility?: VisibilityState;
  // Server actions (replaces useMutation)
  duplicateAgentAction?: (
    input: DuplicateAgentIn,
  ) => Promise<DuplicateAgentOut>;
  deleteAgentAction?: (input: DeleteAgentIn) => Promise<DeleteAgentOut>;
  updateAgentAction?: (input: UpdateAgentIn) => Promise<UpdateAgentOut>;
  // Server-side pagination
  pageIndex: number;
  pageSize: number;
  totalCount: number;
  // Server-side filter search terms
  departmentSearch: string;
  modelSearch: string;
  toolSearch: string;
}

const AGENTS_INITIAL_COLUMN_VISIBILITY: VisibilityState = {
  reasoning_badge: true,
  temperature_badge: true,
  card_description: true,
  card_updated_at: true,
};

export default function Agents({
  listData: serverListData,
  initialColumnVisibility,
  duplicateAgentAction,
  deleteAgentAction,
  updateAgentAction,
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

  useAgentAi({
    onComplete: () => router.refresh(),
  });

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
  const [columnVisibility, setColumnVisibility] = useColumnVisibility(
    "agents",
    initialColumnVisibility ?? AGENTS_INITIAL_COLUMN_VISIBILITY,
  );
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

  // Flag catalog (e.g. agent_active, agent_mcp) — used to reconstruct flag_ids on bulk edit.
  const flagOptions = useMemo(() => {
    return (agentsData?.flag_filter?.options || [])
      .filter((opt): opt is typeof opt & { id: string; name: string } => !!opt.id && !!opt.name)
      .map((opt) => ({ id: opt.id!, name: opt.name!, type: opt.type ?? null }));
  }, [agentsData?.flag_filter]);

  // Selection state
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([]);
  const selectedCount = selectedAgentIds.length;
  const selectedAgents = useMemo(() => {
    return agents.filter((a) => a.agent_id && selectedAgentIds.includes(a.agent_id));
  }, [agents, selectedAgentIds]);
  const deletableAgents = useMemo(
    () => selectedAgents.filter((a) => a.can_delete),
    [selectedAgents],
  );
  const nonDeletableAgents = useMemo(
    () => selectedAgents.filter((a) => !a.can_delete),
    [selectedAgents],
  );
  const editableAgents = useMemo(
    () => selectedAgents.filter((a) => a.can_edit ?? true),
    [selectedAgents],
  );
  const toggleSelection = useCallback((agentId: string) => {
    setSelectedAgentIds((prev) =>
      prev.includes(agentId) ? prev.filter((id) => id !== agentId) : [...prev, agentId]
    );
  }, []);
  const clearSelection = useCallback(() => setSelectedAgentIds([]), []);
  const selectAllOnPage = useCallback(() => {
    const pageIds = agents.filter((a) => a.agent_id).map((a) => a.agent_id!);
    setSelectedAgentIds((prev) => Array.from(new Set([...prev, ...pageIds])));
  }, [agents]);
  const allPageSelected = useMemo(() => {
    const pageIds = agents.filter((a) => a.agent_id).map((a) => a.agent_id!);
    return pageIds.length > 0 && pageIds.every((id) => selectedAgentIds.includes(id));
  }, [agents, selectedAgentIds]);

  // Bulk delete state
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // Bulk edit state
  const [showBulkEditDialog, setShowBulkEditDialog] = useState(false);
  const [isBulkEditing, setIsBulkEditing] = useState(false);
  const [bulkEditActiveStatus, setBulkEditActiveStatus] = useState<boolean | null>(null);
  const [bulkEditMcpStatus, setBulkEditMcpStatus] = useState<boolean | null>(null);

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
      // Virtual columns for card view toggles
      {
        id: "reasoning_badge",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: (typeof agents)[number]) => row.reasoning ?? "",
      },
      {
        id: "temperature_badge",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: (typeof agents)[number]) => row.temperature ?? null,
      },
      {
        id: "card_description",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: (typeof agents)[number]) => row.description ?? "",
      },
      {
        id: "card_updated_at",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: (typeof agents)[number]) => row.updated_at ?? "",
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
        body: { agent_id: id, accept: true },
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
        body: { agent_ids: [deleteItem.id], accept: true },
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

  const handleBulkDelete = async () => {
    if (!deleteAgentAction || deletableAgents.length === 0) return;
    setIsBulkDeleting(true);
    try {
      const ids = deletableAgents.map((a) => a.agent_id!);
      await deleteAgentAction({ body: { agent_ids: ids, accept: true } });
      toast.success(`${ids.length} agent(s) deleted successfully`);
      clearSelection();
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to delete agents";
      toast.error(msg.replace(/^\d{3}\s*/, "") || "Failed to delete agents");
    } finally {
      setIsBulkDeleting(false);
      setShowBulkDeleteDialog(false);
    }
  };

  const handleBulkEdit = async () => {
    if (!updateAgentAction || editableAgents.length === 0) return;

    const hasActiveChange = bulkEditActiveStatus !== null;
    const hasMcpChange = bulkEditMcpStatus !== null;
    const hasAnyFlagChange = hasActiveChange || hasMcpChange;

    if (!hasAnyFlagChange) {
      toast.error("No changes selected");
      return;
    }

    const activeFlagId = flagOptions.find((f) => f.type === "agent_active")?.id;
    const mcpFlagId = flagOptions.find((f) => f.type === "agent_mcp")?.id;

    setIsBulkEditing(true);
    try {
      const items = editableAgents.map((row) => {
        let flag_ids: string[] | undefined;
        if (hasAnyFlagChange) {
          const isActive = hasActiveChange ? bulkEditActiveStatus : !row.is_inactive;
          const isMcp = hasMcpChange ? bulkEditMcpStatus : !!row.is_mcp;
          flag_ids = [];
          if (isActive && activeFlagId) flag_ids.push(activeFlagId);
          if (isMcp && mcpFlagId) flag_ids.push(mcpFlagId);
        }
        return {
          id: row.agent_id!,
          ...(hasAnyFlagChange && { flag_ids }),
        };
      });

      await updateAgentAction({ body: { agents: items } } as UpdateAgentIn);
      toast.success(`${items.length} agent(s) updated successfully`);
      clearSelection();
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to update agents";
      toast.error(msg.replace(/^\d{3}\s*/, "") || "Failed to update agents");
    } finally {
      setIsBulkEditing(false);
      setShowBulkEditDialog(false);
    }
  };

  const openBulkEditDialog = () => {
    setBulkEditActiveStatus(null);
    setBulkEditMcpStatus(null);
    setShowBulkEditDialog(true);
  };

  const renderAgentCard = (agent: (typeof agents)[0]) => {
    const isSelected = agent.agent_id ? selectedAgentIds.includes(agent.agent_id) : false;
    const handleCardClick = (e: React.MouseEvent) => {
      // Don't toggle selection if clicking action buttons
      if ((e.target as HTMLElement).closest("[data-action-button]")) return;
      if (agent.agent_id) {
        toggleSelection(agent.agent_id);
      }
    };
    return (
    <Card
      key={agent.agent_id}
      className={`group hover:shadow-md transition-all cursor-pointer ${
        isSelected ? "ring-2 ring-primary" : ""
      }`}
      data-testid="agent-card"
      data-agent-id={agent.agent_id}
      role="gridcell"
      aria-label={`agent card ${agent.name || "Unnamed Agent"}`}
      aria-selected={isSelected}
      onClick={handleCardClick}
    >
      <CardHeader>
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="space-y-2 flex-1 min-w-0">
            <CardTitle className="text-base truncate flex items-center gap-2">
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
                    if (agent.agent_id) toggleSelection(agent.agent_id);
                  }}
                  className="rounded-full h-5 w-5"
                  aria-label={`Select agent ${agent.name || "Unnamed"}`}
                />
              </div>
              <span className="truncate">{agent.name || "Unnamed Agent"}</span>
            </CardTitle>
            <div className="mt-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                {columnVisibility["reasoning_badge"] !== false && agent.reasoning && (
                  <Badge variant="outline" className="text-xs">
                    <Brain className="h-3 w-3 mr-1" />
                    {agent.reasoning}
                  </Badge>
                )}
                {columnVisibility["temperature_badge"] !== false && agent.temperature !== null && agent.temperature !== undefined && (
                  <Badge variant="outline" className="text-xs">
                    <Thermometer className="h-3 w-3 mr-1" />
                    {formatTemperature(agent.temperature)}
                  </Badge>
                )}
              </div>
            </div>
            {columnVisibility["card_description"] !== false && (
              <p className="text-sm text-muted-foreground">
                {agent.description || "No description available"}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2 items-center" data-action-button>
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
      {columnVisibility["card_updated_at"] !== false && (
        <CardContent>
          <div className="text-sm">
            <span className="text-muted-foreground">Updated:</span>
            <span className="font-medium ml-2">
              {agent.updated_at ? formatDate(agent.updated_at) : "N/A"}
            </span>
          </div>
        </CardContent>
      )}
    </Card>
    );
  };

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
        {/* Toolbar — swaps between filter bar and selection action bar */}
        {selectedCount > 0 ? (
          <div
            className="flex items-center justify-between gap-2"
            data-testid="agents-toolbar"
          >
            <div className="flex items-center gap-2">
              {deleteAgentAction && (
                <Button
                  variant="destructive"
                  size="sm"
                  className="h-8"
                  onClick={() => setShowBulkDeleteDialog(true)}
                  disabled={deletableAgents.length === 0}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete {deletableAgents.length} of {selectedCount}
                </Button>
              )}
              {updateAgentAction && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={openBulkEditDialog}
                  disabled={editableAgents.length === 0}
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit {editableAgents.length} of {selectedCount}
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
              hiddenColumns={["name", "model_id", "departments", "tools", "updated_at"]}
            />
          </div>
        ) : (
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
                <ThreePickerFilters
                  slots={[
                    {
                      column: toolsColumn,
                      title: "Tool",
                      options: toolOptions,
                      isServerDriven: true,
                      onSearchChange: handleToolSearchChange,
                      searchValue: localToolSearch,
                    },
                    {
                      column: modelColumn,
                      title: "Model",
                      options: modelOptions,
                      isServerDriven: true,
                      onSearchChange: handleModelSearchChange,
                      searchValue: localModelSearch,
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
            <div className="flex items-center gap-2">
              <DataTableViewOptions
                table={table}
                hiddenColumns={["name", "model_id", "departments", "tools", "updated_at"]}
              />
            </div>
          </div>
        )}

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

      {/* Bulk Delete Confirmation Dialog */}
      <BulkDeleteDialog
        open={showBulkDeleteDialog}
        onOpenChange={setShowBulkDeleteDialog}
        count={deletableAgents.length}
        entityLabel="agent"
        entityLabelPlural="agents"
        isDeleting={isBulkDeleting}
        onConfirm={handleBulkDelete}
        description={
          <>
            <p>This action cannot be undone.</p>
            {deletableAgents.length > 0 && (
              <div>
                <p className="text-sm font-medium text-destructive mb-1">Will be deleted:</p>
                <ul className="text-sm space-y-0.5">
                  {deletableAgents.map((a) => (
                    <li key={a.agent_id} className="flex items-center gap-1.5">
                      <Trash2 className="h-3 w-3 text-destructive flex-shrink-0" />
                      {a.name || "Unnamed Agent"}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {nonDeletableAgents.length > 0 && (
              <div>
                <p className="text-sm font-medium text-yellow-600 dark:text-yellow-500 mb-1">
                  Cannot be deleted (in use):
                </p>
                <ul className="text-sm space-y-0.5">
                  {nonDeletableAgents.map((a) => (
                    <li
                      key={a.agent_id}
                      className="flex items-center gap-1.5 text-muted-foreground"
                    >
                      {a.name || "Unnamed Agent"}
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
        count={editableAgents.length}
        entityLabelPlural="agents"
        isSaving={isBulkEditing}
        onSave={handleBulkEdit}
      >
        <BulkEditFlagField
          label="Active status"
          value={bulkEditActiveStatus}
          onChange={setBulkEditActiveStatus}
        />
        <BulkEditFlagField
          label="MCP"
          trueLabel="Enabled"
          falseLabel="Disabled"
          value={bulkEditMcpStatus}
          onChange={setBulkEditMcpStatus}
        />
      </BulkEditDialog>

    </div>
  );
}
