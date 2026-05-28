/**
 * Agents.tsx
 * Used to display the agents page with server-side filtering.
 * @AshokSaravanan222 & @siladiea
 * 07/20/2025
 */
"use client";
import { AlertCircle, Brain, Check, Copy, Edit, Eye, FileSpreadsheet, Loader2, Pencil, Thermometer, Trash2, X } from "lucide-react";
import { HoverPrefetchLink } from "@/components/common/HoverPrefetchLink";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { parseAsArrayOf, parseAsBoolean, parseAsString, useQueryState } from "nuqs";
import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ackOperation } from "@/lib/api/ack";

import type {
  AgentsListOut,
  AgentsListBody,
  DeleteAgentIn,
  DeleteAgentOut,
  DuplicateAgentIn,
  DuplicateAgentOut,
  UpdateAgentIn,
  UpdateAgentOut,
  CreateAgentIn,
  CreateAgentOut,
} from "@/app/(main)/intelligence/agents/page";
import BulkImport, { type ImportFieldDef, type ParseCsvResult } from "@/components/common/BulkImport";
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
import { useArtifactGhosts, type Ghost } from "@/hooks/use-artifact-ghosts";
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
  createAgentAction?: (input: CreateAgentIn) => Promise<CreateAgentOut>;
  parseCsvAction?: (formData: FormData) => Promise<ParseCsvResult>;
  importFields?: ImportFieldDef[];
  /** The body the page used for its SSR ``/agent/search`` call.
   *  Spread into bulk delete/update calls when the user is in
   *  ``selectAll=1`` mode — the server resolves matching rows
   *  directly from the same predicates, no client-side enumeration. */
  currentSearchBody?: AgentsListBody;
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
  createAgentAction,
  parseCsvAction,
  importFields,
  currentSearchBody,
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
  const [showBulkImportDialog, setShowBulkImportDialog] = useState(false);
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

  // SSR-seeded base list. The audit-driven ghost hook layers
  // create/update/delete/duplicate lifecycle on top — committed rows
  // get merged into ``mergedAgents`` directly so the table stays
  // current without a ``router.refresh()`` (which would re-burst the
  // page's SSR fetches — see GenerationPanel handleSend rationale).
  const baseAgents = useMemo(() => {
    const agentsArray = agentsData?.agents || [];
    return [...agentsArray].sort((a, b) => {
      if (a.updated_at && b.updated_at) {
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      }
      return 0;
    });
  }, [agentsData?.agents]);

  const {
    ghosts: agentGhosts,
    mergedRows: mergedAgents,
    ack: ackAgentGhost,
  } = useArtifactGhosts({
    artifactType: "agent",
    // All four CRUD ops the LLM might invoke or the user might trigger
    // from the toolbar/card. Each maps to a distinct ghost visual in
    // ``renderAgentCard`` (creating / updating / deleting /
    // duplicating skeleton + pending soft state). The hook reads
    // ``output.agents`` from the audit ``.completed`` payload to
    // materialize new/changed rows directly — no SSR refresh needed.
    ops: ["create", "update", "delete", "duplicate"],
    baseRows: baseAgents,
    rowKey: "id",
    artifactPlural: "agents",
  });

  // Downstream code reads ``agents`` — keep that name to minimize
  // diff. The active list is the merged view (base + create overlays
  // − delete overlays).
  const agents = mergedAgents;

  // Unified ack handler: live in-flight ghosts go through the hook;
  // server-side persistent pending rows ack via the generic action
  // and refresh. Mirrors ``Personas.tsx::handlePersonaAck``.
  const handleAgentAck = useCallback(
    async (callId: string, accept: boolean, op: Ghost<unknown>["op"]) => {
      const live = agentGhosts.find((g) => g.callId === callId);
      if (live) {
        await ackAgentGhost(callId, accept);
        return;
      }
      try {
        await ackOperation({
          artifact: "agent",
          operation: op,
          idempotencyKey: callId,
          accept,
        });
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Ack failed");
      }
    },
    [agentGhosts, ackAgentGhost, router],
  );
  void handleAgentAck;

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

  // Selection state — URL-backed so it survives refresh and is
  // craftable as a shareable / LLM-generated link. Three params model
  // the full state machine:
  //
  //   - ``selectedIds=A,B``        → explicit selection of named rows
  //   - ``selectAll=1``            → every row matching the active
  //                                  filters/search is selected
  //   - ``selectAll=1&excludedIds=X``
  //                                → all-matching minus exclusions
  //   - (none of the above)        → empty selection
  //
  // The all-matching mode keeps the URL compact for huge datasets
  // (one boolean instead of N ids) and follows the active filter —
  // change the filter and "all matching" follows naturally. Excluded-
  // id growth is naturally bounded by what the user can see and
  // deselect (one page at a time), so we don't enforce a hard cap.
  // Shallow updates avoid the RSC re-fetch burst.
  const [selectedAgentIds, setSelectedAgentIds] = useQueryState(
    "selectedIds",
    parseAsArrayOf(parseAsString).withDefault([]).withOptions({ shallow: true }),
  );
  const [selectAllMatching, setSelectAllMatching] = useQueryState(
    "selectAll",
    parseAsBoolean.withDefault(false).withOptions({ shallow: true }),
  );
  const [excludedAgentIds, setExcludedAgentIds] = useQueryState(
    "excludedIds",
    parseAsArrayOf(parseAsString).withDefault([]).withOptions({ shallow: true }),
  );

  // ---- Selection helpers ----------------------------------------
  // ``isSelected`` is the single read predicate every row uses; it
  // dispatches between explicit-id and all-matching modes so
  // downstream code never needs to branch. ``selectedCount`` mirrors
  // that — under all-matching it's ``totalCount - excludedIds.length``.

  const totalMatchingCount = agentsData?.total_count ?? 0;

  const isSelected = useCallback(
    (id: string | null | undefined) => {
      if (!id) return false;
      return selectAllMatching
        ? !excludedAgentIds.includes(id)
        : selectedAgentIds.includes(id);
    },
    [selectAllMatching, excludedAgentIds, selectedAgentIds],
  );

  const selectedCount = selectAllMatching
    ? Math.max(0, totalMatchingCount - excludedAgentIds.length)
    : selectedAgentIds.length;

  const selectedAgents = useMemo(() => {
    return agents.filter((a) => a.id && isSelected(a.id));
  }, [agents, isSelected]);
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

  // Toggle selection for a single agent. Under all-matching mode
  // we toggle membership in excludedAgentIds (deselect ⇒ add to
  // exclusions, re-select ⇒ remove). Under explicit mode it's the
  // straight selectedAgentIds toggle.
  const toggleSelection = useCallback((agentId: string) => {
    if (selectAllMatching) {
      void setExcludedAgentIds((prev) =>
        prev.includes(agentId)
          ? prev.filter((id) => id !== agentId)
          : [...prev, agentId],
      );
    } else {
      void setSelectedAgentIds((prev) =>
        prev.includes(agentId)
          ? prev.filter((id) => id !== agentId)
          : [...prev, agentId],
      );
    }
  }, [selectAllMatching, setExcludedAgentIds, setSelectedAgentIds]);

  const clearSelection = useCallback(() => {
    void setSelectedAgentIds([]);
    void setSelectAllMatching(false);
    void setExcludedAgentIds([]);
  }, [setSelectedAgentIds, setSelectAllMatching, setExcludedAgentIds]);

  const selectAllOnPage = useCallback(() => {
    const pageIds = agents.filter((a) => a.id).map((a) => a.id!);
    void setSelectAllMatching(false);
    void setExcludedAgentIds([]);
    void setSelectedAgentIds((prev) => Array.from(new Set([...prev, ...pageIds])));
  }, [agents, setSelectAllMatching, setExcludedAgentIds, setSelectedAgentIds]);

  /** Promote the current page-only selection into "all matching
   *  filter" mode. Clears explicit ids and exclusions — the all-
   *  matching mode is the canonical truth from this point. */
  const selectAllMatchingNow = useCallback(() => {
    void setSelectedAgentIds([]);
    void setExcludedAgentIds([]);
    void setSelectAllMatching(true);
  }, [setSelectedAgentIds, setExcludedAgentIds, setSelectAllMatching]);

  // Check if all agents on the current page are selected. Under
  // all-matching mode every loaded row whose id isn't in
  // ``excludedAgentIds`` is implicitly selected, so the predicate
  // reduces to "no excluded rows on the current page."
  const allPageSelected = useMemo(() => {
    const pageIds = agents.filter((a) => a.id).map((a) => a.id!);
    if (pageIds.length === 0) return false;
    return pageIds.every((id) => isSelected(id));
  }, [agents, isSelected]);

  // Whether there ARE more matching rows than what's loaded on this
  // page — used to decide whether to surface the "Select all N
  // matching" affordance after the user selects the page.
  const hasMoreThanCurrentPage = totalMatchingCount > agents.length;

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

  // Memoize table rows. Including ``agents`` itself (not just
  // ``agents.length``) so update events that mutate row content but
  // not list cardinality still invalidate the memo. ``agents`` is
  // stabilized upstream by ``mergedAgents``'s useMemo, so a new
  // reference only appears when ``state.added``/``replaced``/
  // ``hiddenIds`` actually change — no spurious recomputes.
  const sortingKey = JSON.stringify(sorting);
  const tableRows = useMemo(() => {
    return table.getRowModel().rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortingKey, agents, pageIndex, pageSize]);

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
        body: { agent_ids: [deleteItem.id], accept: true } as DeleteAgentIn["body"],
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
    // Either explicit-mode (deletable rows on current page) OR
    // all-matching mode (server resolves rows via filter). Both
    // converge on the same ``deleteAgentAction`` call shape; the
    // body just differs.
    if (!deleteAgentAction) return;
    if (!selectAllMatching && deletableAgents.length === 0) return;

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
            excluded_ids: excludedAgentIds,
            ...(currentSearchBody ?? {}),
            accept: true,
          }
        : {
            agent_ids: deletableAgents.map((a) => a.id!),
            accept: true,
          };

      const result = await deleteAgentAction({ body } as DeleteAgentIn);

      // Per-row results from the server: success entries are actual
      // deletions, failures are soft-skipped rows (no permission /
      // not found). Toast reflects both counts so the user knows
      // some rows were skipped without inspecting the receipt.
      const results = (result as DeleteAgentOut).results ?? [];
      const successCount = results.filter((r) => r.success).length;
      const skippedCount = results.length - successCount;
      if (skippedCount > 0) {
        toast.success(
          `${successCount} agent(s) deleted, ${skippedCount} skipped`,
        );
      } else {
        toast.success(`${successCount} agent(s) deleted successfully`);
      }
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
    if (!updateAgentAction) return;
    if (!selectAllMatching && editableAgents.length === 0) return;

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
      let body: UpdateAgentIn["body"];
      if (selectAllMatching) {
        // All-matching: the server can't preserve per-row flag state
        // (it doesn't know what each row's existing flags are), so
        // a flag toggle becomes "set to this value across all
        // matching rows" — the same semantic as a manual sweep.
        let flag_ids: string[] | undefined;
        if (hasAnyFlagChange) {
          flag_ids = [];
          if (bulkEditActiveStatus && activeFlagId) flag_ids.push(activeFlagId);
          if (bulkEditMcpStatus && mcpFlagId) flag_ids.push(mcpFlagId);
        }
        body = {
          all: true,
          excluded_ids: excludedAgentIds,
          ...(currentSearchBody ?? {}),
          patch: {
            ...(hasAnyFlagChange && { flag_ids }),
          },
          accept: true,
        } as UpdateAgentIn["body"];
      } else {
        // Explicit: clone the patch per-row, preserving each row's
        // existing flag state for flags we aren't toggling.
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
            id: row.id!,
            ...(hasAnyFlagChange && { flag_ids }),
          };
        });
        body = { agents: items } as UpdateAgentIn["body"];
      }

      const result = await updateAgentAction({ body } as UpdateAgentIn);

      // Per-row results — same soft-skip pattern as bulk delete.
      const results = (result as UpdateAgentOut).results ?? [];
      const successCount = results.filter((r) => r.success).length;
      const skippedCount = results.length - successCount;
      if (skippedCount > 0) {
        toast.success(
          `${successCount} agent(s) updated, ${skippedCount} skipped`,
        );
      } else {
        toast.success(`${successCount} agent(s) updated successfully`);
      }
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

  const renderAgentCard = (
    agent: (typeof agents)[0],
    ghost?: Ghost<(typeof agents)[0]>,
  ) => {
    // Same card visual for real rows and in-flight ghosts — single
    // source of truth for layout/dimensions/badges. Ghost mode swaps
    // action buttons for a status badge (Accept/Reject for soft-
    // pending), disables selection/click, and tints the border by
    // lifecycle state.
    const isGhost = ghost != null;
    const ghostState = ghost?.state;
    const inFlight =
      ghostState === "creating" ||
      ghostState === "duplicating" ||
      ghostState === "updating" ||
      ghostState === "deleting";
    const isPending = ghostState === "pending";
    const isFailed = ghostState === "failed";

    const cardSelected = !isGhost && agent.id ? isSelected(agent.id) : false;
    const handleCardClick = (e: React.MouseEvent) => {
      // Don't toggle selection if clicking action buttons or when
      // rendering as a ghost (no real id to select yet).
      if (isGhost) return;
      if ((e.target as HTMLElement).closest("[data-action-button]")) return;
      if (agent.id) {
        toggleSelection(agent.id);
      }
    };

    // Border tint reflects ghost lifecycle. ``animate-pulse`` while
    // in-flight signals "this is provisional"; failed/pending hold a
    // steady color so the user can decide.
    const ghostBorderClass = isFailed
      ? "border-destructive/40 bg-destructive/5"
      : isPending
      ? "border-amber-500/50 bg-amber-50/40 dark:bg-amber-950/20"
      : ghostState === "deleting"
      ? "border-destructive/30 bg-destructive/5 opacity-70"
      : inFlight
      ? "border-primary/40 bg-primary/5 animate-pulse"
      : "";
    return (
    <Card
      key={agent.id}
      className={`group hover:shadow-md transition-all ${
        isGhost ? "" : "cursor-pointer"
      } ${ghostBorderClass} ${
        cardSelected ? "ring-2 ring-primary" : ""
      }`}
      data-testid={isGhost ? "agent-ghost-card" : "agent-card"}
      data-agent-id={agent.id}
      data-ghost-state={ghostState}
      role="gridcell"
      aria-label={`agent card ${agent.name || (isGhost ? "Generating" : "Unnamed Agent")}`}
      aria-selected={cardSelected}
      aria-busy={inFlight ? true : undefined}
      onClick={handleCardClick}
    >
      <CardHeader>
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="space-y-2 flex-1 min-w-0">
            <CardTitle className="text-base truncate flex items-center gap-2">
              {/* Selection checkbox — hidden in ghost mode (no row id
                  to select yet). */}
              {!isGhost && (
                <div
                  className={`transition-all overflow-hidden flex-shrink-0 ${
                    selectedCount > 0
                      ? "w-5 opacity-100"
                      : "w-0 opacity-0 group-hover:w-5 group-hover:opacity-100"
                  }`}
                  data-action-button
                >
                  <Checkbox
                    checked={cardSelected}
                    onCheckedChange={() => {
                      if (agent.id) toggleSelection(agent.id);
                    }}
                    className="rounded-full h-5 w-5"
                    aria-label={`Select agent ${agent.name || "Unnamed"}`}
                  />
                </div>
              )}
              {/* In-flight ghost without a streamed name yet → spinner. */}
              {isGhost && inFlight && !agent.name && (
                <Loader2 className="h-4 w-4 animate-spin text-primary flex-shrink-0" />
              )}
              <span className="truncate">{agent.name || (isGhost ? "Generating…" : "Unnamed Agent")}</span>
              {isGhost && (
                <Badge
                  variant={isFailed ? "destructive" : isPending ? "outline" : "secondary"}
                  className={isPending ? "border-amber-500 text-amber-700 dark:text-amber-400" : ""}
                >
                  {ghostState === "creating" && "Creating…"}
                  {ghostState === "duplicating" && "Duplicating…"}
                  {ghostState === "updating" && "Updating…"}
                  {ghostState === "deleting" && "Deleting…"}
                  {ghostState === "pending" && "Pending"}
                  {ghostState === "failed" && "Failed"}
                </Badge>
              )}
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
            {/* Ghost-mode action area: status-aware. Pending → Accept/
                Reject for soft-write ack. Failed → error indicator.
                In-flight → no buttons (the streaming card is read-only
                until commit/failure). */}
            {isGhost && isPending && ghost.callId && (
              <>
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  className="h-8"
                  onClick={() => ackAgentGhost(ghost.callId, true)}
                >
                  <Check className="mr-1 h-3.5 w-3.5" />
                  Accept
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={() => ackAgentGhost(ghost.callId, false)}
                >
                  <X className="mr-1 h-3.5 w-3.5" />
                  Reject
                </Button>
              </>
            )}
            {isGhost && isFailed && ghost.error && (
              <span className="flex items-center gap-1 text-xs text-destructive">
                <AlertCircle className="h-3.5 w-3.5" />
                {ghost.error}
              </span>
            )}
            {!isGhost && agent.can_edit && agent.id ? (
              <Button
                asChild
                variant="outline"
                size="sm"
                data-testid="btn-edit-agent"
                title={`Edit agent ${agent.name ?? "Unnamed Agent"}`}
                className="h-9 px-3"
              >
                <HoverPrefetchLink
                  href={`/intelligence/agents/${agent.id}`}
                  delay={150}
                  aria-label={`Edit agent ${agent.name ?? "Unnamed Agent"}`}
                >
                  <Edit className="h-4 w-4 md:mr-0 mr-2" />
                  <span className="md:hidden">Edit</span>
                </HoverPrefetchLink>
              </Button>
            ) : !isGhost && agent.id ? (
              <Button
                asChild
                variant="outline"
                size="sm"
                data-testid="btn-view-agent"
                title={`View agent ${agent.name ?? "Unnamed Agent"}`}
                className="h-9 px-3"
              >
                <HoverPrefetchLink
                  href={`/intelligence/agents/${agent.id}`}
                  delay={150}
                  aria-label={`View agent ${agent.name ?? "Unnamed Agent"}`}
                >
                  <Eye className="h-4 w-4 md:mr-0 mr-2" />
                  <span className="md:hidden">View</span>
                </HoverPrefetchLink>
              </Button>
            ) : null}
            {!isGhost && agent.can_duplicate && agent.id && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDuplicate(agent.id!)}
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
            {!isGhost && agent.can_delete && agent.id && (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  handleDeleteClick(
                    agent.id!,
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
          <div className="space-y-2" data-testid="agents-toolbar">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {deleteAgentAction && (
                <Button
                  variant="destructive"
                  size="sm"
                  className="h-8"
                  onClick={() => setShowBulkDeleteDialog(true)}
                  disabled={!selectAllMatching && deletableAgents.length === 0}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {selectAllMatching
                    ? `Delete ${selectedCount} matching`
                    : `Delete ${deletableAgents.length} of ${selectedCount}`}
                </Button>
              )}
              {updateAgentAction && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={openBulkEditDialog}
                  disabled={!selectAllMatching && editableAgents.length === 0}
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  {selectAllMatching
                    ? `Edit ${selectedCount} matching`
                    : `Edit ${editableAgents.length} of ${selectedCount}`}
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
              hiddenColumns={["name", "model_id", "departments", "tools", "updated_at"]}
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
                All {agents.length} on this page selected.
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
                All {selectedCount} matching agents selected
                {excludedAgentIds.length > 0 && ` (${excludedAgentIds.length} excluded)`}.
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
              {parseCsvAction && importFields && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={() => setShowBulkImportDialog(true)}
                >
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  Import CSV
                </Button>
              )}
              <DataTableViewOptions
                table={table}
                hiddenColumns={["name", "model_id", "departments", "tools", "updated_at"]}
              />
            </div>
          </div>
        )}

        {/* Cards Grid — container-query driven; scales with content area width.
            Ghost cards from in-flight audited writes (create/duplicate/
            update/delete in non-terminal states) are prepended — same
            ``renderAgentCard`` so layout, dimensions, and visual
            language match exactly. Once a ghost commits, its hydrated
            row is in ``mergedRows`` (via ``state.added``) AND the
            ghost's ``state`` flips to "committed"/"accepted" — we
            filter those out so the real row replaces the ghost in
            place without a duplicate frame. */}
        <div className="@container">
          <div
            className="grid gap-4 @2xl:grid-cols-2 @5xl:grid-cols-3 @7xl:grid-cols-4"
            role="grid"
            aria-label="agents grid"
            data-testid="agents-grid"
          >
            {agentGhosts
              .filter((g) => g.state !== "committed" && g.state !== "accepted")
              .map((g) => {
                // For update/delete, ``before`` is the snapshot lookup
                // from baseRows (existing row). For create/duplicate,
                // ``before`` is null and ``partial`` carries the
                // streaming args.
                const agentShell = (g.before ?? g.partial) as (typeof agents)[0];
                return (
                  <div key={`ghost-${g.callId}`}>
                    {renderAgentCard(agentShell, g)}
                  </div>
                );
              })}
            {tableRows.length ? (
              tableRows.map((row) => {
                const agent = row.original;
                // Server-side pending status (from soft_calls_mv) — render
                // the row as a pending ghost so Accept/Reject controls
                // appear and the agent-card visual reflects the dormant
                // state. Live in-flight ghosts come from the audit hub.
                const persistentGhost: Ghost<(typeof agents)[0]> | undefined =
                  agent.pending_status === "pending" && agent.pending_call_id
                    ? {
                        callId: agent.pending_call_id,
                        op: (agent.pending_operation as Ghost<(typeof agents)[0]>["op"]) ?? "create",
                        state: "pending",
                        rowId: agent.id ?? null,
                        partial: agent as unknown as Ghost<(typeof agents)[0]>["partial"],
                        before: agent,
                        tool: null,
                        error: null,
                        arguments: {},
                      }
                    : undefined;
                return renderAgentCard(agent, persistentGhost);
              })
            ) : (
              agentGhosts.length === 0 && (
                <div className="col-span-full text-center py-8 text-muted-foreground">
                  No system agents match the current filters.
                </div>
              )
            )}
          </div>
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
        count={selectAllMatching ? selectedCount : deletableAgents.length}
        entityLabel="agent"
        entityLabelPlural="agents"
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
                  {" "}agents will be deleted server-side using the current filter.
                </p>
                {excludedAgentIds.length > 0 && (
                  <p className="mt-1">
                    {excludedAgentIds.length} explicitly excluded.
                  </p>
                )}
                <p className="mt-1">
                  Agents you don&apos;t have permission to delete will be skipped automatically.
                </p>
              </div>
            ) : (
              <>
                {deletableAgents.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-destructive mb-1">Will be deleted:</p>
                    <ul className="text-sm space-y-0.5">
                      {deletableAgents.map((a) => (
                        <li key={a.id} className="flex items-center gap-1.5">
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
                          key={a.id}
                          className="flex items-center gap-1.5 text-muted-foreground"
                        >
                          {a.name || "Unnamed Agent"}
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
        count={selectAllMatching ? selectedCount : editableAgents.length}
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

      {/* Bulk Import Dialog */}
      {parseCsvAction && importFields && (
        <BulkImport
          open={showBulkImportDialog}
          onClose={() => {
            setShowBulkImportDialog(false);
            router.refresh();
          }}
          fields={importFields}
          artifactName="Agents"
          parseCsvAction={parseCsvAction}
          onSave={async (items) => {
            if (!createAgentAction) throw new Error("Create action not available");
            const agents = items.map((item) => ({
              name: item["name"] as string | undefined,
              description: item["description"] as string | undefined,
              departments: item["departments"] as string[] | undefined,
            }));
            return createAgentAction({ body: { agents } } as CreateAgentIn);
          }}
        />
      )}

    </div>
  );
}
