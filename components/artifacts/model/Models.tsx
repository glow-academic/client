/**
 * Models.tsx
 * Used to display the models page with server-side filtering.
 * Hybrid approach: provider/department/agent filters are server-driven,
 * type (custom/standard) and status (active/inactive) remain client-side.
 * @AshokSaravanan222 & @siladiea
 * 06/18/2025
 */
"use client";
import { AlertCircle, Check, Copy, Cpu, Edit, Eye, FileSpreadsheet, Loader2, Pencil, Trash2, X } from "lucide-react";
import { HoverPrefetchLink } from "@/components/common/HoverPrefetchLink";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { parseAsArrayOf, parseAsBoolean, parseAsString, useQueryState } from "nuqs";
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
import { useArtifactGhosts, type Ghost } from "@/hooks/use-artifact-ghosts";
import { ackOperation } from "@/lib/api/ack";
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
  ModelsListBody,
  ModelsListOut,
  UpdateModelIn,
  UpdateModelOut,
  CreateModelIn,
  CreateModelOut,
} from "@/app/(main)/intelligence/models/page";
import BulkImport, { type ImportFieldDef, type ParseCsvResult } from "@/components/common/BulkImport";
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
  createModelAction?: (input: CreateModelIn) => Promise<CreateModelOut>;
  parseCsvAction?: (formData: FormData) => Promise<ParseCsvResult>;
  importFields?: ImportFieldDef[];
  /** The body the page used for its SSR ``/model/search`` call.
   *  Forwarded as the filter envelope on bulk delete/update calls
   *  when the user is in ``selectAll=1`` mode — the server resolves
   *  matching rows directly, no client-side enumeration. */
  currentSearchBody?: ModelsListBody;
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
  createModelAction,
  parseCsvAction,
  importFields,
  currentSearchBody,
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

  // Use server-provided data directly
  const modelsData = serverListData;
  // ``baseModels`` is the SSR-provided list. Ghost rail layers the
  // create/update/delete/duplicate lifecycle on top — committed rows
  // get merged into ``models`` directly so the table stays current
  // without a ``router.refresh()`` (which would re-burst the page's
  // SSR fetches — see GenerationPanel handleSend rationale).
  const baseModels = useMemo(() => modelsData?.models || [], [modelsData?.models]);

  const {
    ghosts: modelGhosts,
    mergedRows: mergedModels,
    ack: ackModelGhost,
    drop: _dropModelGhost,
  } = useArtifactGhosts({
    artifactType: "model",
    // All four CRUD ops the LLM might invoke or the user might trigger
    // from the toolbar/card. Each maps to a distinct ghost visual in
    // ``renderModelCard`` (creating / updating / deleting / duplicating
    // skeleton + pending soft state).
    ops: ["create", "update", "delete", "duplicate"],
    baseRows: baseModels,
    rowKey: "id",
    // ``models`` plural matches the field name the create / duplicate /
    // update impls now include on their responses (see
    // ``hydrate_model_list_rows``). The hook reads ``output.models``
    // from the audit ``.completed`` payload to materialize new/changed
    // rows directly — no SSR refresh needed.
    artifactPlural: "models",
  });

  // Downstream code reads ``models`` — keep that name to minimize diff.
  const models = mergedModels;

  // Unified ack: live in-flight ghosts go through the hook; server-side
  // persistent pending rows (synthesized from ``pending_status``) ack
  // via the generic server action and refresh.
  const handleModelAck = useCallback(
    async (callId: string, accept: boolean, op: Ghost<unknown>["op"]) => {
      const live = modelGhosts.find((g) => g.callId === callId);
      if (live) {
        await ackModelGhost(callId, accept);
        return;
      }
      try {
        await ackOperation({
          artifact: "model",
          operation: op,
          idempotencyKey: callId,
          accept,
        });
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Ack failed");
      }
    },
    [modelGhosts, ackModelGhost, router],
  );

  // Flag catalog (e.g. model_active) — used to reconstruct flag_ids on bulk edit.
  const flagOptions = useMemo(() => {
    return (modelsData?.flag_filter?.options || [])
      .filter((opt): opt is typeof opt & { id: string; name: string } => !!opt.id && !!opt.name)
      .map((opt) => ({ id: opt.id!, name: opt.name!, type: opt.type ?? null }));
  }, [modelsData?.flag_filter]);

  // Selection state — URL-backed so it survives refresh and is
  // craftable as a shareable / LLM-generated focus link. Three params
  // model the full state machine:
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
  // change the filter and "all matching" follows naturally. Shallow
  // updates avoid the RSC re-fetch burst.
  const [selectedModelIds, setSelectedModelIds] = useQueryState(
    "selectedIds",
    parseAsArrayOf(parseAsString).withDefault([]).withOptions({ shallow: true }),
  );
  const [selectAllMatching, setSelectAllMatching] = useQueryState(
    "selectAll",
    parseAsBoolean.withDefault(false).withOptions({ shallow: true }),
  );
  const [excludedModelIds, setExcludedModelIds] = useQueryState(
    "excludedIds",
    parseAsArrayOf(parseAsString).withDefault([]).withOptions({ shallow: true }),
  );

  const totalMatchingCount = totalCount;

  const isSelected = useCallback(
    (id: string | null | undefined) => {
      if (!id) return false;
      return selectAllMatching
        ? !excludedModelIds.includes(id)
        : selectedModelIds.includes(id);
    },
    [selectAllMatching, excludedModelIds, selectedModelIds],
  );

  const selectedCount = selectAllMatching
    ? Math.max(0, totalMatchingCount - excludedModelIds.length)
    : selectedModelIds.length;

  const selectedModels = useMemo(() => {
    return models.filter((m) => m.id && isSelected(m.id));
  }, [models, isSelected]);
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

  // Toggle selection for a single model. Under all-matching mode we
  // toggle membership in ``excludedModelIds`` (deselect ⇒ add to
  // exclusions, re-select ⇒ remove). Under explicit mode it's the
  // straight ``selectedModelIds`` toggle.
  const toggleSelection = useCallback((modelId: string) => {
    if (selectAllMatching) {
      void setExcludedModelIds((prev) =>
        prev.includes(modelId)
          ? prev.filter((id) => id !== modelId)
          : [...prev, modelId],
      );
    } else {
      void setSelectedModelIds((prev) =>
        prev.includes(modelId)
          ? prev.filter((id) => id !== modelId)
          : [...prev, modelId],
      );
    }
  }, [selectAllMatching, setExcludedModelIds, setSelectedModelIds]);

  const clearSelection = useCallback(() => {
    void setSelectedModelIds([]);
    void setSelectAllMatching(false);
    void setExcludedModelIds([]);
  }, [setSelectedModelIds, setSelectAllMatching, setExcludedModelIds]);

  const selectAllOnPage = useCallback(() => {
    const pageIds = models.filter((m) => m.id).map((m) => m.id!);
    void setSelectAllMatching(false);
    void setExcludedModelIds([]);
    void setSelectedModelIds((prev) => Array.from(new Set([...prev, ...pageIds])));
  }, [models, setSelectAllMatching, setExcludedModelIds, setSelectedModelIds]);

  // Promote the current page-only selection into "all matching
  // filter" mode. Clears explicit ids and exclusions — all-matching
  // is the canonical truth from this point.
  const selectAllMatchingNow = useCallback(() => {
    void setSelectedModelIds([]);
    void setExcludedModelIds([]);
    void setSelectAllMatching(true);
  }, [setSelectedModelIds, setExcludedModelIds, setSelectAllMatching]);

  const allPageSelected = useMemo(() => {
    const pageIds = models.filter((m) => m.id).map((m) => m.id!);
    if (pageIds.length === 0) return false;
    return pageIds.every((id) => isSelected(id));
  }, [models, isSelected]);

  // Whether there ARE more matching rows than what's loaded on this
  // page — used to decide whether to surface the "Select all N
  // matching" affordance after the user selects the page.
  const hasMoreThanCurrentPage = totalMatchingCount > models.length;

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

  // Get filtered rows for rendering. Including ``models`` itself (not
  // just ``models.length``) so update events that mutate row content
  // but not list cardinality still invalidate the memo. ``models`` is
  // stabilized upstream by ``mergedModels``'s useMemo, so a new
  // reference only appears when ``state.added``/``replaced``/
  // ``hiddenIds`` actually change — no spurious recomputes.
  const sortingKey = JSON.stringify(sorting);
  const columnFiltersKey = JSON.stringify(columnFilters);
  const tableRows = useMemo(() => {
    return table.getRowModel().rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortingKey, columnFiltersKey, models, pageIndex, pageSize]);

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
        body: { model_ids: [deleteItem.id], all: false, accept: true },
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
    if (!model.id) {
      toast.error("Model ID is missing");
      return;
    }
    setDeleteItem({ id: model.id, name: model.name || "Unknown Model" });
    setShowDeleteDialog(true);
  };

  const handleDuplicateModelClick = async (model: (typeof models)[number]) => {
    if (!duplicateModelAction) return;

    if (!profile?.id) {
      toast.error("Profile not loaded. Please refresh the page.");
      return;
    }

    if (!model.id) {
      toast.error("Model ID is missing");
      return;
    }
    setIsDuplicating(model.id);
    try {
      await duplicateModelAction({
        body: { model_id: model.id, accept: true },
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

  const handleBulkDelete = async () => {
    // Either explicit-mode (deletable rows on current page) OR
    // all-matching mode (server resolves rows via filter). Both
    // converge on the same ``deleteModelAction`` call shape; the
    // body just differs.
    if (!deleteModelAction) return;
    if (!selectAllMatching && deletableModels.length === 0) return;
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
            excluded_ids: excludedModelIds,
            ...(currentSearchBody ?? {}),
            accept: true,
          }
        : {
            model_ids: deletableModels.map((m) => m.id!),
            accept: true,
          };

      const result = await deleteModelAction({ body } as DeleteModelIn);

      // Per-row results from the server: success entries are actual
      // deletions, failures are soft-skipped rows (no permission /
      // not found). Toast reflects both counts so the user knows
      // some rows were skipped without inspecting the receipt.
      const results = (result as DeleteModelOut).results ?? [];
      const successCount = results.filter((r) => r.success).length;
      const skippedCount = results.length - successCount;
      if (skippedCount > 0) {
        toast.success(`${successCount} model(s) deleted, ${skippedCount} skipped`);
      } else {
        toast.success(`${successCount} model(s) deleted successfully`);
      }
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
    if (!updateModelAction) return;
    if (!selectAllMatching && editableModels.length === 0) return;

    const hasActiveChange = bulkEditActiveStatus !== null;
    if (!hasActiveChange) {
      toast.error("No changes selected");
      return;
    }

    // Resolve flag UUIDs by type from the server-provided catalog.
    const activeFlagId = flagOptions.find((f) => f.type === "model_active")?.id;

    setIsBulkEditing(true);
    try {
      let body: UpdateModelIn["body"];
      if (selectAllMatching) {
        // All-matching: the server can't preserve per-row flag state
        // (it doesn't know what each row's existing flags are), so
        // the active toggle becomes "set to this value across all
        // matching rows" — same semantic as a manual sweep.
        let flag_ids: string[] | undefined;
        if (hasActiveChange) {
          flag_ids = [];
          if (bulkEditActiveStatus && activeFlagId) flag_ids.push(activeFlagId);
        }
        body = {
          all: true,
          excluded_ids: excludedModelIds,
          ...(currentSearchBody ?? {}),
          patch: {
            ...(hasActiveChange && { flag_ids }),
          },
          accept: true,
        } as UpdateModelIn["body"];
      } else {
        // Explicit: clone the patch per-row, preserving each row's
        // existing flag state for flags we aren't toggling. (Models
        // currently only expose the active toggle in bulk-edit, so
        // there's no other state to preserve, but the structure
        // mirrors scenario for consistency.)
        const items = editableModels.map((m) => {
          let flag_ids: string[] | undefined;
          if (hasActiveChange) {
            const isActive = bulkEditActiveStatus;
            flag_ids = isActive && activeFlagId ? [activeFlagId] : [];
          }
          return {
            id: m.id!,
            ...(hasActiveChange && { flag_ids }),
          };
        });
        body = { models: items } as UpdateModelIn["body"];
      }

      const result = await updateModelAction({ body } as UpdateModelIn);

      // Per-row results — same soft-skip pattern as bulk delete.
      const results = (result as UpdateModelOut).results ?? [];
      const successCount = results.filter((r) => r.success).length;
      const skippedCount = results.length - successCount;
      if (skippedCount > 0) {
        toast.success(`${successCount} model(s) updated, ${skippedCount} skipped`);
      } else {
        toast.success(`${successCount} model(s) updated successfully`);
      }
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

  const renderModelCard = (
    model: (typeof models)[number],
    ghost?: Ghost<(typeof models)[number]>,
  ) => {
    // Same card visual for real rows and in-flight ghosts — single
    // source of truth for layout, dimensions, badges. Ghost mode swaps
    // action buttons for a status badge (and Accept/Reject for soft-
    // pending), disables selection/click, and tints the border based
    // on lifecycle state.
    const isGhost = ghost != null;
    const ghostState = ghost?.state;
    const inFlight =
      ghostState === "creating" ||
      ghostState === "duplicating" ||
      ghostState === "updating" ||
      ghostState === "deleting";
    const isPending = ghostState === "pending";
    const isFailed = ghostState === "failed";

    const cardSelected = !isGhost ? isSelected(model.id) : false;
    const handleCardClick = (e: React.MouseEvent) => {
      // Don't toggle selection if clicking action buttons or when
      // rendering as a ghost (no real id to select).
      if (isGhost) return;
      if ((e.target as HTMLElement).closest("[data-action-button]")) return;
      if (model.id) {
        toggleSelection(model.id);
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
      key={model.id}
      className={`group hover:shadow-md transition-all flex flex-col h-full min-h-[220px] ${
        isGhost ? "" : "cursor-pointer"
      } ${ghostBorderClass} ${cardSelected ? "ring-2 ring-primary" : ""}`}
      data-testid={isGhost ? "model-ghost-card" : "model-card"}
      data-model-id={model.id}
      data-ghost-state={ghostState}
      role="gridcell"
      aria-label={`model card ${model.name || (isGhost ? "Generating" : "Unnamed Model")}`}
      aria-selected={cardSelected}
      aria-busy={inFlight ? true : undefined}
      onClick={handleCardClick}
    >
      <CardHeader className="flex-0">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2">
          <div className="space-y-1 flex-1 min-w-0">
            <CardTitle className="text-base flex items-center gap-2">
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
                      if (model.id) toggleSelection(model.id);
                    }}
                    className="rounded-full h-5 w-5"
                    aria-label={`Select model ${model.name || "Unnamed"}`}
                  />
                </div>
              )}
              {/* In-flight ghost without a streamed icon yet → spinner. */}
              {inFlight ? (
                <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />
              ) : (
                <Cpu className="h-4 w-4 flex-shrink-0" />
              )}
              <span className="truncate">
                {model.name || (isGhost ? "Generating…" : "Unnamed Model")}
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
              onClick={() => handleModelAck(ghost.callId, true, ghost.op)}
            >
              <Check className="mr-1 h-3.5 w-3.5" />
              Accept
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => handleModelAck(ghost.callId, false, ghost.op)}
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
        {!isGhost && model.id && (<>
        <Button
          asChild
          variant="outline"
          size="sm"
          data-testid="btn-view-model"
          title={`View model ${model.name || "Unknown Model"}`}
          className="h-9 px-3"
        >
          <HoverPrefetchLink
            href={`/intelligence/models/${model.id}`}
            delay={150}
            aria-label={`View model ${model.name || "Unknown Model"}`}
          >
            <Eye className="h-4 w-4 md:mr-0 mr-2" />
            <span className="md:hidden">View</span>
          </HoverPrefetchLink>
        </Button>
        {model.can_edit && (
          <Button
            asChild
            variant="outline"
            size="sm"
            data-testid="btn-edit-model"
            title={`Edit model ${model.name || "Unknown Model"}`}
            className="h-9 px-3"
          >
            <HoverPrefetchLink
              href={`/intelligence/models/${model.id}`}
              delay={150}
              aria-label={`Edit model ${model.name || "Unknown Model"}`}
            >
              <Edit className="h-4 w-4 md:mr-0 mr-2" />
              <span className="md:hidden">Edit</span>
            </HoverPrefetchLink>
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleDuplicateModelClick(model)}
          disabled={isDuplicating === model.id}
          aria-label={`Duplicate model ${model.name}`}
          data-testid="btn-duplicate-model"
          title={`Duplicate model ${model.name}`}
          className="h-9 px-3"
        >
          {isDuplicating === model.id ? (
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
        </>)}
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
            <div className="space-y-2" data-testid="models-toolbar">
            <div
              className="flex items-center justify-between gap-2"
            >
              <div className="flex items-center gap-2">
                {deleteModelAction && (
                  <Button
                    variant="destructive"
                    size="sm"
                    className="h-8"
                    onClick={() => setShowBulkDeleteDialog(true)}
                    disabled={!selectAllMatching && deletableModels.length === 0}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    {selectAllMatching
                      ? `Delete ${selectedCount} matching`
                      : `Delete ${deletableModels.length} of ${selectedCount}`}
                  </Button>
                )}
                {updateModelAction && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8"
                    onClick={openBulkEditDialog}
                    disabled={!selectAllMatching && editableModels.length === 0}
                  >
                    <Pencil className="mr-2 h-4 w-4" />
                    {selectAllMatching
                      ? `Edit ${selectedCount} matching`
                      : `Edit ${editableModels.length} of ${selectedCount}`}
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
                hiddenColumns={["name", "provider", "is_custom", "active", "departments", "agents", "updated_at"]}
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
                  All {models.length} on this page selected.
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
                  All {selectedCount} matching models selected
                  {excludedModelIds.length > 0 && ` (${excludedModelIds.length} excluded)`}.
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
                  hiddenColumns={["name", "provider", "is_custom", "active", "departments", "agents", "updated_at"]}
                />
              </div>
            </div>
          )}

          {/* Cards Grid — container-query driven; scales with content area width.

              Ghost cards from in-flight audited writes (create/duplicate/
              update/delete in non-terminal states) are prepended — same
              ``renderModelCard`` so layout, dimensions, and visual
              language match exactly. Once a ghost commits, its hydrated
              row is in ``mergedRows`` (via ``state.added``) AND the
              ghost's ``state`` flips to "committed" — we filter those
              out so the real row replaces the ghost in place without a
              duplicate frame. */}
          <div className="@container">
            <div
              className="grid gap-4 @2xl:grid-cols-2 @5xl:grid-cols-3 @7xl:grid-cols-4"
              role="grid"
              aria-label="models grid"
              data-testid="models-grid"
            >
              {modelGhosts
                .filter((g) => g.state !== "committed" && g.state !== "accepted")
                .map((g) => {
                  // For update/delete, ``before`` is the snapshot lookup
                  // from baseRows (existing row) — gives us name and
                  // description so the ghost shows what's being changed.
                  // For create/duplicate, ``before`` is null and
                  // ``partial`` carries the streaming args.
                  const modelShell = (g.before ?? g.partial) as (typeof models)[number];
                  return (
                    <div key={`ghost-${g.callId}`}>
                      {renderModelCard(modelShell, g)}
                    </div>
                  );
                })}
              {tableRows.length ? (
                tableRows.map((row) => {
                  const modelRow = row.original;
                  const persistentGhost: Ghost<(typeof models)[number]> | undefined =
                    modelRow.pending_status === "pending" && modelRow.pending_call_id
                      ? {
                          callId: modelRow.pending_call_id,
                          op: (modelRow.pending_operation as Ghost<(typeof models)[number]>["op"]) ?? "create",
                          state: "pending",
                          rowId: modelRow.id ?? null,
                          partial: modelRow as unknown as Ghost<(typeof models)[number]>["partial"],
                          before: modelRow,
                          tool: null,
                          error: null,
                          arguments: {},
                        }
                      : undefined;
                  return renderModelCard(modelRow, persistentGhost);
                })
              ) : (
                modelGhosts.length === 0 && (
                  <div className="col-span-full text-center py-8 text-muted-foreground">
                    No models match the current filters.
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
          count={selectAllMatching ? selectedCount : deletableModels.length}
          entityLabel="model"
          entityLabelPlural="models"
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
                    {" "}models will be deleted server-side using the current filter.
                  </p>
                  {excludedModelIds.length > 0 && (
                    <p className="mt-1">
                      {excludedModelIds.length} explicitly excluded.
                    </p>
                  )}
                  <p className="mt-1">
                    Models you don't have permission to delete will be skipped automatically.
                  </p>
                </div>
              ) : (
                <>
                  {deletableModels.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-destructive mb-1">Will be deleted:</p>
                      <ul className="text-sm space-y-0.5">
                        {deletableModels.map((m) => (
                          <li key={m.id} className="flex items-center gap-1.5">
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
                            key={m.id}
                            className="flex items-center gap-1.5 text-muted-foreground"
                          >
                            {m.name || "Unnamed Model"}
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
          count={selectAllMatching ? selectedCount : editableModels.length}
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

        {/* Bulk Import Dialog */}
        {parseCsvAction && importFields && (
          <BulkImport
            open={showBulkImportDialog}
            onClose={() => {
              setShowBulkImportDialog(false);
              router.refresh();
            }}
            fields={importFields}
            artifactName="Models"
            parseCsvAction={parseCsvAction}
            onSave={async (items) => {
              if (!createModelAction) throw new Error("Create action not available");
              const models = items.map((item) => ({
                name: item["name"] as string | undefined,
                description: item["description"] as string | undefined,
                departments: item["departments"] as string[] | undefined,
              }));
              return createModelAction({ body: { models } } as CreateModelIn);
            }}
          />
        )}

      </div>
    </TooltipProvider>
  );
}
