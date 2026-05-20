/**
 * Tools.tsx
 * Used to display the tools page with server-side filtering.
 */
"use client";
import { AlertCircle, Check, Copy, Edit, Eye, FileSpreadsheet, Loader2, Pencil, Trash2, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { parseAsArrayOf, parseAsBoolean, parseAsString, useQueryState } from "nuqs";
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
  ToolsListBody,
  ToolsListOut,
  UpdateToolIn,
  UpdateToolOut,
  CreateToolIn,
  CreateToolOut,
} from "@/app/(main)/intelligence/tools/page";
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
import { useArtifactGhosts, type Ghost } from "@/hooks/use-artifact-ghosts";
import { ackOperation } from "@/lib/api/ack";
import { useToolAi } from "@/hooks/use-tool-ai";
import { useColumnVisibility } from "@/hooks/use-column-visibility";

export interface ToolsProps {
  // Server-provided data (for server-side rendering)
  listData: ToolsListOut;
  // SSR column visibility from cookie
  initialColumnVisibility?: VisibilityState;
  // Server actions (replaces useMutation)
  duplicateToolAction?: (input: DuplicateToolIn) => Promise<DuplicateToolOut>;
  deleteToolAction?: (input: DeleteToolIn) => Promise<DeleteToolOut>;
  updateToolAction?: (input: UpdateToolIn) => Promise<UpdateToolOut>;
  createToolAction?: (input: CreateToolIn) => Promise<CreateToolOut>;
  parseCsvAction?: (formData: FormData) => Promise<ParseCsvResult>;
  importFields?: ImportFieldDef[];
  /** The body the page used for its SSR ``/tool/search`` call.
   *  Forwarded as the flat filter fields on bulk delete/update calls
   *  when the user is in ``selectAll=1`` mode — the server resolves
   *  matching rows directly, no client-side enumeration. */
  currentSearchBody?: ToolsListBody;
  // Server-side pagination
  pageIndex: number;
  pageSize: number;
  totalCount: number;
  // Server-side filter search terms
  departmentSearch: string;
  agentSearch: string;
}

const TOOLS_INITIAL_COLUMN_VISIBILITY: VisibilityState = {
  // Hidden faceting columns — always off
  departments: false,
  agents: false,
  permissions: false,
  creatable: false,
  // Toggleable card sections — default on
  status_badge: true,
  card_description: true,
};

export default function Tools({
  listData: serverListData,
  initialColumnVisibility,
  duplicateToolAction,
  deleteToolAction,
  updateToolAction,
  createToolAction,
  parseCsvAction,
  importFields,
  currentSearchBody,
  pageIndex,
  pageSize,
  totalCount,
  departmentSearch,
  agentSearch,
}: ToolsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // ``useToolAi`` previously listened for ``tool.generate.completed``
  // and called ``router.refresh()`` so the list view updated after
  // generation. Removed — the audit framework already surfaces every
  // operation in the activity rail, and the duplicate-SSR-burst on
  // every generate cycle was visible noise. The ghost rail
  // (``useArtifactGhosts``) materializes fresh rows directly from the
  // ``output.tools`` payload — no SSR refresh needed.
  useToolAi({});

  const [showBulkImportDialog, setShowBulkImportDialog] = useState(false);
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
  const [columnVisibility, setColumnVisibility] = useColumnVisibility(
    "tools",
    initialColumnVisibility ?? TOOLS_INITIAL_COLUMN_VISIBILITY,
  );
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

  // SSR-seeded base list. The audit-driven ghost hook layers
  // create/update/delete/duplicate lifecycle on top — committed rows
  // get merged into ``mergedTools`` directly so the table stays current
  // without a ``router.refresh()`` (which would re-burst the page's
  // SSR fetches).
  const baseTools = useMemo(() => {
    return toolsData?.tools || [];
  }, [toolsData?.tools]);

  const {
    ghosts: toolGhosts,
    mergedRows: mergedTools,
    ack: ackToolGhost,
  } = useArtifactGhosts({
    artifactType: "tool",
    // All four CRUD ops the LLM might invoke or the user might trigger
    // from the toolbar/card. Each maps to a distinct ghost visual in
    // ``renderToolCard`` (creating / updating / deleting / duplicating
    // skeleton + pending soft state). Without ``duplicate`` here the
    // LLM's duplicate dispatch fires audit events that nothing is
    // subscribed to → no ghost.
    ops: ["create", "update", "delete", "duplicate"],
    baseRows: baseTools,
    rowKey: "tool_id",
    // ``tools`` plural is auto-derived as ``tool`` + "s" — kept
    // explicit here for clarity; matches the field name the create /
    // duplicate / update impls now include on their responses (see
    // ``hydrate_tool_list_rows``). The hook reads ``output.tools`` from
    // the audit ``.completed`` payload to materialize new/changed rows
    // directly — no SSR refresh needed.
    artifactPlural: "tools",
  });

  // Downstream code reads ``toolsArray`` — keep that name to minimize
  // diff. The active list is the merged view (base + create overlays
  // − delete overlays).
  const toolsArray = mergedTools;

  // Unified ack: live ghosts → hook; persistent pending → ackOperation+refresh.
  const handleToolAck = useCallback(
    async (callId: string, accept: boolean, op: Ghost<unknown>["op"]) => {
      const live = toolGhosts.find((g) => g.callId === callId);
      if (live) {
        await ackToolGhost(callId, accept);
        return;
      }
      try {
        await ackOperation({
          artifact: "tool",
          operation: op,
          idempotencyKey: callId,
          accept,
        });
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Ack failed");
      }
    },
    [toolGhosts, ackToolGhost, router],
  );

  // Flag catalog (e.g. tool_active) — used to reconstruct flag_ids on bulk edit.
  const flagOptions = useMemo(() => {
    return (toolsData?.flag_filter?.options || [])
      .filter((opt): opt is typeof opt & { id: string; name: string } => !!opt.id && !!opt.name)
      .map((opt) => ({ id: opt.id!, name: opt.name!, type: opt.type ?? null }));
  }, [toolsData?.flag_filter]);

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
  const [selectedToolIds, setSelectedToolIds] = useQueryState(
    "selectedIds",
    parseAsArrayOf(parseAsString).withDefault([]).withOptions({ shallow: true }),
  );
  const [selectAllMatching, setSelectAllMatching] = useQueryState(
    "selectAll",
    parseAsBoolean.withDefault(false).withOptions({ shallow: true }),
  );
  const [excludedToolIds, setExcludedToolIds] = useQueryState(
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
        ? !excludedToolIds.includes(id)
        : selectedToolIds.includes(id);
    },
    [selectAllMatching, excludedToolIds, selectedToolIds],
  );

  const selectedCount = selectAllMatching
    ? Math.max(0, totalMatchingCount - excludedToolIds.length)
    : selectedToolIds.length;

  /** Selected rows that are loaded on the current page. Under all-
   *  matching mode this is "every loaded row not in excludedIds";
   *  under explicit mode it's the rows whose id is in selectedIds. */
  const selectedTools = useMemo(() => {
    return toolsArray.filter((t) => t.tool_id && isSelected(t.tool_id));
  }, [toolsArray, isSelected]);
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

  // Toggle selection for a single tool. Under all-matching mode we
  // toggle membership in excludedToolIds (deselect ⇒ add to
  // exclusions, re-select ⇒ remove). Under explicit mode it's the
  // straight selectedToolIds toggle.
  const toggleSelection = useCallback((toolId: string) => {
    if (selectAllMatching) {
      void setExcludedToolIds((prev) =>
        prev.includes(toolId)
          ? prev.filter((id) => id !== toolId)
          : [...prev, toolId],
      );
    } else {
      void setSelectedToolIds((prev) =>
        prev.includes(toolId)
          ? prev.filter((id) => id !== toolId)
          : [...prev, toolId],
      );
    }
  }, [selectAllMatching, setExcludedToolIds, setSelectedToolIds]);

  const clearSelection = useCallback(() => {
    void setSelectedToolIds([]);
    void setSelectAllMatching(false);
    void setExcludedToolIds([]);
  }, [setSelectedToolIds, setSelectAllMatching, setExcludedToolIds]);

  const selectAllOnPage = useCallback(() => {
    const pageIds = toolsArray.filter((t) => t.tool_id).map((t) => t.tool_id!);
    void setSelectAllMatching(false);
    void setExcludedToolIds([]);
    void setSelectedToolIds((prev) => Array.from(new Set([...prev, ...pageIds])));
  }, [toolsArray, setSelectAllMatching, setExcludedToolIds, setSelectedToolIds]);

  /** Promote the current page-only selection into "all matching
   *  filter" mode. Clears explicit ids and exclusions — the all-
   *  matching mode is the canonical truth from this point. */
  const selectAllMatchingNow = useCallback(() => {
    void setSelectedToolIds([]);
    void setExcludedToolIds([]);
    void setSelectAllMatching(true);
  }, [setSelectedToolIds, setExcludedToolIds, setSelectAllMatching]);

  // Check if all tools on the current page are selected. Under all-
  // matching mode every loaded row whose id isn't in
  // ``excludedToolIds`` is implicitly selected, so the predicate
  // reduces to "no excluded rows on the current page."
  const allPageSelected = useMemo(() => {
    const pageIds = toolsArray.filter((t) => t.tool_id).map((t) => t.tool_id!);
    if (pageIds.length === 0) return false;
    return pageIds.every((id) => isSelected(id));
  }, [toolsArray, isSelected]);

  // Whether there ARE more matching rows than what's loaded on this
  // page — used to decide whether to surface the "Select all N
  // matching" affordance after the user selects the page.
  const hasMoreThanCurrentPage = totalMatchingCount > toolsArray.length;

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
      // Virtual columns for card view toggles
      {
        id: "status_badge",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: (typeof toolsArray)[number]) => row.active ?? false,
      },
      {
        id: "card_description",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: (typeof toolsArray)[number]) => row.description ?? "",
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

  // Memoize table rows. Including ``toolsArray`` itself (not just
  // ``toolsArray.length``) so update events that mutate row content
  // but not list cardinality still invalidate the memo. ``toolsArray``
  // is stabilized upstream by ``mergedTools``'s useMemo, so a new
  // reference only appears when ``state.added``/``replaced``/
  // ``hiddenIds`` actually change — no spurious recomputes.
  const sortingKey = JSON.stringify(sorting);
  const tableRows = useMemo(() => {
    return table.getRowModel().rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortingKey, toolsArray, pageIndex, pageSize]);

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
    // Either explicit-mode (deletable rows on current page) OR
    // all-matching mode (server resolves rows via filter). Both
    // converge on the same ``deleteToolAction`` call shape; the body
    // just differs.
    if (!deleteToolAction) return;
    if (!selectAllMatching && deletableTools.length === 0) return;

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
            excluded_ids: excludedToolIds,
            ...(currentSearchBody ?? {}),
            accept: true,
          }
        : {
            tool_ids: deletableTools.map((t) => t.tool_id!),
            accept: true,
          };

      const result = await deleteToolAction({ body } as DeleteToolIn);

      // Per-row results from the server: success entries are actual
      // deletions, failures are soft-skipped rows (no permission /
      // not found). Toast reflects both counts so the user knows
      // some rows were skipped without inspecting the receipt.
      const results = (result as DeleteToolOut).results ?? [];
      const successCount = results.filter((r) => r.success).length;
      const skippedCount = results.length - successCount;
      if (skippedCount > 0) {
        toast.success(`${successCount} tool(s) deleted, ${skippedCount} skipped`);
      } else {
        toast.success(`${successCount} tool(s) deleted successfully`);
      }
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
    if (!updateToolAction) return;
    if (!selectAllMatching && editableTools.length === 0) return;

    const hasActiveChange = bulkEditActiveStatus !== null;
    if (!hasActiveChange) {
      toast.error("No changes selected");
      return;
    }

    const activeFlagId = flagOptions.find((f) => f.type === "tool_active")?.id;

    setIsBulkEditing(true);
    try {
      let body: UpdateToolIn["body"];
      if (selectAllMatching) {
        // All-matching: the server can't preserve per-row flag state
        // (it doesn't know what each row's existing flags are), so the
        // active toggle becomes "set to this value across all matching
        // rows" — same semantic as a manual sweep.
        let flag_ids: string[] | undefined;
        if (hasActiveChange) {
          flag_ids = bulkEditActiveStatus && activeFlagId ? [activeFlagId] : [];
        }
        body = {
          all: true,
          excluded_ids: excludedToolIds,
          ...(currentSearchBody ?? {}),
          patch: {
            ...(hasActiveChange && { flag_ids }),
          },
          accept: true,
        } as UpdateToolIn["body"];
      } else {
        // Explicit: clone the patch per-row.
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
        body = { tools: items } as UpdateToolIn["body"];
      }

      const result = await updateToolAction({ body } as UpdateToolIn);

      // Per-row results — same soft-skip pattern as bulk delete.
      const results = (result as UpdateToolOut).results ?? [];
      const successCount = results.filter((r) => r.success).length;
      const skippedCount = results.length - successCount;
      if (skippedCount > 0) {
        toast.success(`${successCount} tool(s) updated, ${skippedCount} skipped`);
      } else {
        toast.success(`${successCount} tool(s) updated successfully`);
      }
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

  const renderToolCard = (
    tool: (typeof toolsArray)[number],
    ghost?: Ghost<(typeof toolsArray)[number]>,
  ) => {
    // Same card visual for real rows and in-flight ghosts — single
    // source of truth for layout, dimensions, badges. Ghost mode swaps
    // action buttons for a status badge (and Accept/Reject for
    // soft-pending), disables selection/click, and tints the border
    // based on lifecycle state.
    const isGhost = ghost != null;
    const ghostState = ghost?.state;
    const inFlight =
      ghostState === "creating" ||
      ghostState === "duplicating" ||
      ghostState === "updating" ||
      ghostState === "deleting";
    const isPending = ghostState === "pending";
    const isFailed = ghostState === "failed";

    const toolId = tool?.tool_id ?? "";
    const toolName = tool?.name ?? "";

    if (!isGhost && !toolId) return null;

    const rowSelected = !isGhost && toolId ? isSelected(toolId) : false;

    const handleCardClick = (e: React.MouseEvent) => {
      if (isGhost) return;
      // Don't toggle selection if clicking action buttons
      if ((e.target as HTMLElement).closest("[data-action-button]")) return;
      if (toolId) toggleSelection(toolId);
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
        key={isGhost ? `ghost-${ghost?.callId ?? toolId}` : toolId}
        className={`group relative flex flex-col h-full hover:shadow-md transition-all ${
          isGhost ? "" : "cursor-pointer"
        } ${ghostBorderClass} ${rowSelected ? "ring-2 ring-primary" : ""}`}
        data-testid={isGhost ? "tool-ghost-card" : "tool-card"}
        data-tool-id={toolId}
        data-ghost-state={ghostState}
        role="gridcell"
        aria-label={`tool card ${toolName || (isGhost ? "Generating" : "Unnamed Tool")}`}
        aria-selected={rowSelected}
        aria-busy={inFlight ? true : undefined}
        onClick={handleCardClick}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-lg line-clamp-2 flex items-center gap-2">
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
                      checked={rowSelected}
                      onCheckedChange={() => toggleSelection(toolId)}
                      className="rounded-full h-5 w-5"
                      aria-label={`Select tool ${toolName || "Unnamed"}`}
                    />
                  </div>
                )}
                {/* In-flight ghost without a streamed name yet → spinner. */}
                {inFlight && !toolName && (
                  <Loader2 className="h-4 w-4 animate-spin text-primary flex-shrink-0" />
                )}
                <span className="truncate">
                  {toolName || (isGhost ? "Generating…" : "")}
                </span>
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
              {!isGhost && columnVisibility["status_badge"] !== false && (
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
              )}
            </div>
            <div className="flex items-center gap-2" data-action-button>
              {/* Ghost-mode action area: status-aware. Pending →
                  Accept/Reject for soft-write ack. Failed → error
                  indicator. In-flight → no buttons. */}
              {isGhost && isPending && ghost?.callId && (
                <>
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    className="h-8"
                    onClick={() => handleToolAck(ghost.callId, true, ghost.op)}
                  >
                    <Check className="mr-1 h-3.5 w-3.5" />
                    Accept
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8"
                    onClick={() => handleToolAck(ghost.callId, false, ghost.op)}
                  >
                    <X className="mr-1 h-3.5 w-3.5" />
                    Reject
                  </Button>
                </>
              )}
              {isGhost && isFailed && ghost?.error && (
                <span className="flex items-center gap-1 text-xs text-destructive">
                  <AlertCircle className="h-3.5 w-3.5" />
                  {ghost.error}
                </span>
              )}
              {!isGhost && (tool.can_edit && toolId ? (
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  data-testid={`btn-edit-tool-${toolId}`}
                  title={`Edit ${toolName}`}
                  className="h-9 px-3"
                >
                  <Link
                    href={`/intelligence/tools/${toolId}`}
                    prefetch={false}
                    aria-label={`Edit ${toolName}`}
                  >
                    <Edit className="h-4 w-4 md:mr-0 mr-2" />
                    <span className="md:hidden">Edit</span>
                  </Link>
                </Button>
              ) : toolId ? (
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  data-testid={`btn-view-tool-${toolId}`}
                  title={`View ${toolName}`}
                  className="h-9 px-3"
                >
                  <Link
                    href={`/intelligence/tools/${toolId}`}
                    prefetch={false}
                    aria-label={`View ${toolName}`}
                  >
                    <Eye className="h-4 w-4 md:mr-0 mr-2" />
                    <span className="md:hidden">View</span>
                  </Link>
                </Button>
              ) : null)}
              {!isGhost && tool.can_duplicate && duplicateToolAction && toolId && (
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
              {!isGhost && tool.can_delete && deleteToolAction && toolId && (
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
        {columnVisibility["card_description"] !== false && (
          <CardContent className="pt-0 flex-1 flex flex-col">
            <p className="text-sm text-muted-foreground line-clamp-2">
              {tool?.description || (isGhost ? "" : "No description")}
            </p>
          </CardContent>
        )}
      </Card>
    );
  };

  const handleDelete = async () => {
    if (!deleteItem || !deleteToolAction) return;
    setIsDeleting(true);
    try {
      await deleteToolAction({
        body: { tool_ids: [deleteItem.id], all: false, accept: true },
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
          <div className="space-y-2" data-testid="tools-toolbar">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {deleteToolAction && (
                <Button
                  variant="destructive"
                  size="sm"
                  className="h-8"
                  onClick={() => setShowBulkDeleteDialog(true)}
                  disabled={!selectAllMatching && deletableTools.length === 0}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {selectAllMatching
                    ? `Delete ${selectedCount} matching`
                    : `Delete ${deletableTools.length} of ${selectedCount}`}
                </Button>
              )}
              {updateToolAction && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={openBulkEditDialog}
                  disabled={!selectAllMatching && editableTools.length === 0}
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  {selectAllMatching
                    ? `Edit ${selectedCount} matching`
                    : `Edit ${editableTools.length} of ${selectedCount}`}
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
              hiddenColumns={["name", "departments", "agents", "permissions", "creatable", "updated_at"]}
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
                All {toolsArray.length} on this page selected.
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
                All {selectedCount} matching tools selected
                {excludedToolIds.length > 0 && ` (${excludedToolIds.length} excluded)`}.
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
                hiddenColumns={["name", "departments", "agents", "permissions", "creatable", "updated_at"]}
              />
            </div>
          </div>
        )}

        {/* Cards Grid — container-query driven; scales with content area width.

            Ghost cards from in-flight audited writes (create/duplicate/
            update/delete in non-terminal states) are prepended — same
            ``renderToolCard`` so layout, dimensions, and visual
            language match exactly. Once a ghost commits, its hydrated
            row is in ``mergedRows`` (via ``state.added``) AND the
            ghost's ``state`` flips to "committed" — we filter those
            out so the real row replaces the ghost in place without a
            duplicate frame. */}
        <div className="@container">
          <div
            className="grid gap-4 @2xl:grid-cols-2 @5xl:grid-cols-3 @7xl:grid-cols-4"
            role="grid"
            aria-label="tools grid"
            data-testid="tools-grid"
          >
            {toolGhosts
              .filter((g) => g.state !== "committed" && g.state !== "accepted")
              .map((g) => {
                // For update/delete, ``before`` is the snapshot lookup
                // from baseRows (existing row); for create/duplicate,
                // ``before`` is null and ``partial`` carries the
                // streaming args (often sparse for duplicate, richer
                // for create).
                const toolShell = (g.before ?? g.partial) as (typeof toolsArray)[number];
                return (
                  <div key={`ghost-${g.callId}`}>
                    {renderToolCard(toolShell, g)}
                  </div>
                );
              })}
            {tableRows.length ? (
              tableRows.map((row) => {
                const tool = row.original;
                const persistentGhost: Ghost<(typeof toolsArray)[number]> | undefined =
                  tool.pending_status === "pending" && tool.pending_call_id
                    ? {
                        callId: tool.pending_call_id,
                        op: (tool.pending_operation as Ghost<(typeof toolsArray)[number]>["op"]) ?? "create",
                        state: "pending",
                        rowId: tool.tool_id ?? null,
                        partial: tool as unknown as Ghost<(typeof toolsArray)[number]>["partial"],
                        before: tool,
                        tool: null,
                        error: null,
                        arguments: {},
                      }
                    : undefined;
                return renderToolCard(tool, persistentGhost);
              })
            ) : (
              toolGhosts.length === 0 && (
                <div className="col-span-full text-center py-8 text-muted-foreground">
                  No tools match the current filters.
                </div>
              )
            )}
          </div>
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
        count={selectAllMatching ? selectedCount : deletableTools.length}
        entityLabel="tool"
        entityLabelPlural="tools"
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
                  {" "}tools will be deleted server-side using the current filter.
                </p>
                {excludedToolIds.length > 0 && (
                  <p className="mt-1">
                    {excludedToolIds.length} explicitly excluded.
                  </p>
                )}
                <p className="mt-1">
                  Tools you don't have permission to delete will be skipped automatically.
                </p>
              </div>
            ) : (
              <>
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
            )}
          </>
        }
      />

      {/* Bulk Edit Modal */}
      <BulkEditDialog
        open={showBulkEditDialog}
        onOpenChange={setShowBulkEditDialog}
        count={selectAllMatching ? selectedCount : editableTools.length}
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

      {/* Bulk Import Dialog */}
      {parseCsvAction && importFields && (
        <BulkImport
          open={showBulkImportDialog}
          onClose={() => {
            setShowBulkImportDialog(false);
            router.refresh();
          }}
          fields={importFields}
          artifactName="Tools"
          parseCsvAction={parseCsvAction}
          onSave={async (items) => {
            if (!createToolAction) throw new Error("Create action not available");
            const tools = items.map((item) => ({
              name: item["name"] as string | undefined,
              description: item["description"] as string | undefined,
              departments: item["departments"] as string[] | undefined,
            }));
            return createToolAction({ body: { tools } } as CreateToolIn);
          }}
        />
      )}

    </div>
  );
}
