/**
 * Scenarios.tsx
 * Used to display the scenarios page with table-based filtering and card layout.
 * Server-side filtering with nuqs URL-backed state.
 * @AshokSaravanan222 & @siladiea
 * 06/07/2025
 */
"use client";
import {
  AlertCircle,
  Check,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Copy,
  Edit,
  Eye,
  FileSpreadsheet,
  Loader2,
  Pencil,
  Sparkles,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { parseAsArrayOf, parseAsBoolean, parseAsString, useQueryState } from "nuqs";
import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { useScenarioAi } from "@/hooks/use-scenario-ai";
import { useArtifactGhosts, type Ghost } from "@/hooks/use-artifact-ghosts";
import { useColumnVisibility } from "@/hooks/use-column-visibility";
import { ackOperation } from "@/lib/api/ack";

import type {
  DeleteScenarioIn,
  DeleteScenarioOut,
  DuplicateScenarioIn,
  DuplicateScenarioOut,
  CreateScenarioIn,
  CreateScenarioOut,
  UpdateScenarioIn,
  UpdateScenarioOut,
  ScenariosListOut,
  ScenariosListBody,
} from "@/app/(main)/training/scenarios/page";
import BulkImport, { type ImportFieldDef, type ParseCsvResult } from "@/components/common/BulkImport";
import { DataTablePagination } from "@/components/common/table/DataTablePagination";
import { DataTableViewOptions } from "@/components/common/table/DataTableViewOptions";
import { ThreePickerFilters } from "@/components/common/table/ThreePickerFilters";
import { GenericPicker } from "@/components/common/forms/GenericPicker";
import { BulkDeleteDialog } from "@/components/common/forms/BulkDeleteDialog";
import { BulkEditDialog } from "@/components/common/forms/BulkEditDialog";
import { BulkEditFlagField } from "@/components/common/forms/BulkEditFlagField";
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
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";

export interface ScenariosProps {
  // Server-provided data (for server-side rendering)
  listData: ScenariosListOut;
  // SSR column visibility from cookie
  initialColumnVisibility?: VisibilityState;
  // Server actions (replaces useMutation)
  duplicateScenarioAction?: (
    input: DuplicateScenarioIn,
  ) => Promise<DuplicateScenarioOut>;
  deleteScenarioAction?: (
    input: DeleteScenarioIn,
  ) => Promise<DeleteScenarioOut>;
  createScenarioAction?: (input: CreateScenarioIn) => Promise<CreateScenarioOut>;
  updateScenarioAction?: (input: UpdateScenarioIn) => Promise<UpdateScenarioOut>;
  parseCsvAction?: (formData: FormData) => Promise<ParseCsvResult>;
  /** The body the page used for its SSR ``/scenario/search`` call.
   *  Forwarded as the filter envelope on bulk delete/update calls
   *  when the user is in ``selectAll=1`` mode — the server resolves
   *  matching rows directly, no client-side enumeration. */
  currentSearchBody?: ScenariosListBody;
  importFields?: ImportFieldDef[];
  // Server-side pagination/filtering state
  pageIndex: number;
  pageSize: number;
  totalCount: number;
  personaSearch: string;
  simulationSearch: string;
  departmentSearch: string;
  flagSearch: string;
}

export function Scenarios({
  listData: serverListData,
  initialColumnVisibility,
  duplicateScenarioAction,
  deleteScenarioAction,
  createScenarioAction,
  updateScenarioAction,
  parseCsvAction,
  currentSearchBody,
  importFields,
  pageIndex,
  pageSize,
  totalCount,
  personaSearch,
  simulationSearch,
  departmentSearch,
  flagSearch,
}: ScenariosProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteItem, setDeleteItem] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
    new Set(),
  );

  // Selection state (root/parent scenarios only) — URL-backed so it
  // survives refresh and is craftable as a shareable / LLM-generated
  // focus link. Three params model the full state machine:
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
  const [selectedScenarioIds, setSelectedScenarioIds] = useQueryState(
    "selectedIds",
    parseAsArrayOf(parseAsString).withDefault([]).withOptions({ shallow: true }),
  );
  const [selectAllMatching, setSelectAllMatching] = useQueryState(
    "selectAll",
    parseAsBoolean.withDefault(false).withOptions({ shallow: true }),
  );
  const [excludedScenarioIds, setExcludedScenarioIds] = useQueryState(
    "excludedIds",
    parseAsArrayOf(parseAsString).withDefault([]).withOptions({ shallow: true }),
  );

  // Bulk delete state
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // Bulk edit state
  const [showBulkEditDialog, setShowBulkEditDialog] = useState(false);
  const [showBulkImportDialog, setShowBulkImportDialog] = useState(false);
  const [isBulkEditing, setIsBulkEditing] = useState(false);
  const [bulkEditActiveStatus, setBulkEditActiveStatus] = useState<boolean | null>(null);
  const [bulkEditDepartmentIds, setBulkEditDepartmentIds] = useState<string[] | null>(null);

  useScenarioAi({
    onComplete: () => router.refresh(),
  });

  // Debounce refs
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const personaSearchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const simulationSearchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const departmentSearchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flagSearchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Local search state (for immediate UI feedback while debouncing)
  const [localSearch, setLocalSearch] = useState(searchParams.get("search") ?? "");
  const [_localFlagSearch, setLocalFlagSearch] = useState(flagSearch);

  // URL parameter update helper
  const updateScenariosParams = useCallback(
    (updates: Record<string, string | string[] | null | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === undefined || value === "" || (Array.isArray(value) && value.length === 0)) {
          params.delete(key);
        } else if (Array.isArray(value)) {
          params.delete(key);
          value.forEach((v) => params.append(key, v));
        } else {
          params.set(key, value);
        }
      }
      // Reset page when filters change (unless page is explicitly set in updates)
      if (!("page" in updates)) {
        params.delete("page");
      }
      const query = params.toString();
      router.push(query ? `${pathname}?${query}` : pathname);
    },
    [searchParams, pathname, router],
  );

  // Table state
  const [rowSelection, setRowSelection] = useState({});
  const [columnVisibility, setColumnVisibility] = useColumnVisibility("scenarios", initialColumnVisibility);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>(() => {
    // Initialize from URL params
    const filters: ColumnFiltersState = [];
    const personaIds = searchParams.getAll("personaIds");
    if (personaIds.length > 0) filters.push({ id: "persona_id", value: personaIds });
    const simulationIds = searchParams.getAll("simulationIds");
    if (simulationIds.length > 0) filters.push({ id: "simulation_ids", value: simulationIds });
    const departmentIds = searchParams.getAll("departmentIds");
    if (departmentIds.length > 0) filters.push({ id: "departments", value: departmentIds });
    return filters;
  });
  const [sorting, setSorting] = useState<SortingState>([
    { id: "updated_at", desc: true },
  ]);

  // Use server-provided data directly
  const scenariosData = serverListData;

  // SSR-seeded base list. The audit-driven ghost hook layers
  // create/update/delete/duplicate lifecycle on top — committed rows
  // get merged into ``mergedScenarios`` directly so the table stays
  // current without a ``router.refresh()`` (which would re-burst the
  // page's SSR fetches — see GenerationPanel handleSend rationale).
  const baseScenarios = useMemo(
    () => scenariosData?.scenarios || [],
    [scenariosData?.scenarios],
  );

  const {
    ghosts: scenarioGhosts,
    mergedRows: mergedScenarios,
    ack: ackScenarioGhost,
    drop: _dropScenarioGhost,
  } = useArtifactGhosts({
    artifactType: "scenario",
    // All four CRUD ops the LLM might invoke or the user might trigger
    // from the toolbar/card. Each maps to a distinct ghost visual in
    // ``renderScenarioCard`` (creating / updating / deleting /
    // duplicating skeleton + pending soft state). Without
    // ``duplicate`` here the LLM's duplicate tool dispatch fires
    // audit events that nothing is subscribed to → no ghost.
    ops: ["create", "update", "delete", "duplicate"],
    baseRows: baseScenarios,
    rowKey: "scenario_id",
    // ``scenarios`` plural matches the field name the create /
    // duplicate / update impls now include on their responses (see
    // ``hydrate_scenario_list_rows``). The hook reads
    // ``output.scenarios`` from the audit ``.completed`` payload to
    // materialize new/changed rows directly — no SSR refresh needed.
    artifactPlural: "scenarios",
  });

  // Downstream code reads ``scenarios`` — keep that name to minimize
  // diff. The active list is the merged view (base + create overlays
  // − delete overlays).
  const scenarios = mergedScenarios;

  // Unified ack: live in-flight ghosts go through the hook; server-side
  // persistent pending rows (synthesized from row.pending_status === "pending")
  // ack via ackOperation + router.refresh. Mirrors handlePersonaAck.
  const handleScenarioAck = useCallback(
    async (callId: string, accept: boolean, op: Ghost<unknown>["op"]) => {
      const live = scenarioGhosts.find((g) => g.callId === callId);
      if (live) {
        await ackScenarioGhost(callId, accept);
        return;
      }
      try {
        await ackOperation({
          artifact: "scenario",
          operation: op,
          idempotencyKey: callId,
          accept,
        });
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Ack failed");
      }
    },
    [scenarioGhosts, ackScenarioGhost, router],
  );
  const personaMapping = useMemo(
    () => {
      const data = scenariosData;
      const map: Record<string, { name: string; description: string; color: string; icon: string }> = {};
      if (data?.personas && Array.isArray(data.personas)) {
        data.personas.forEach((p) => {
          if (typeof p === "object" && p !== null && "persona_id" in p && p.persona_id) {
            map[String(p.persona_id)] = {
              name: (typeof p.name === "string" ? p.name : "") || "",
              description: (typeof p.description === "string" ? p.description : "") || "",
              color: (typeof p.color === "string" ? p.color : "") || "",
              icon: (typeof p.icon === "string" ? p.icon : "") || "",
            };
          }
        });
      }
      return map;
    },
    [scenariosData],
  );

  const fieldMapping = useMemo(
    () => {
      const data = scenariosData;
      const map: Record<string, { name: string; description: string }> = {};
      if (data?.fields && Array.isArray(data.fields)) {
        data.fields.forEach((f) => {
          if (typeof f === "object" && f !== null && "field_id" in f && f.field_id) {
            map[String(f.field_id)] = {
              name: (typeof f.name === "string" ? f.name : "") || "",
              description: (typeof f.description === "string" ? f.description : "") || "",
            };
          }
        });
      }
      return map;
    },
    [scenariosData],
  );

  // Define GroupedScenario type based on scenarios
  type GroupedScenario = {
    parent: (typeof scenarios)[number];
    children: (typeof scenarios)[number][];
  };

  // Computed selection info (only root/parent scenarios)
  const parentScenarios = useMemo(() => {
    return scenarios.filter((scenario) => !scenario.parent_scenario_id);
  }, [scenarios]);

  // ---- Selection helpers ----------------------------------------
  // ``isSelected`` is the single read predicate every row uses; it
  // dispatches between explicit-id and all-matching modes so
  // downstream code never needs to branch. ``selectedCount`` mirrors
  // that — under all-matching it's ``totalCount - excludedIds.length``.

  const totalMatchingCount = scenariosData?.total_count ?? 0;

  const isSelected = useCallback(
    (id: string | null | undefined) => {
      if (!id) return false;
      return selectAllMatching
        ? !excludedScenarioIds.includes(id)
        : selectedScenarioIds.includes(id);
    },
    [selectAllMatching, excludedScenarioIds, selectedScenarioIds],
  );

  const selectedCount = selectAllMatching
    ? Math.max(0, totalMatchingCount - excludedScenarioIds.length)
    : selectedScenarioIds.length;

  const selectedScenarios = useMemo(() => {
    return parentScenarios.filter((s) => s.scenario_id && isSelected(s.scenario_id));
  }, [parentScenarios, isSelected]);

  const deletableScenarios = useMemo(() => {
    return selectedScenarios.filter((s) => s.can_delete);
  }, [selectedScenarios]);

  const nonDeletableScenarios = useMemo(() => {
    return selectedScenarios.filter((s) => !s.can_delete);
  }, [selectedScenarios]);

  const editableScenarios = useMemo(() => {
    return selectedScenarios.filter((s) => s.can_edit);
  }, [selectedScenarios]);

  // Check if all parent scenarios on the current page are selected.
  // Under all-matching mode every loaded row whose id isn't in
  // ``excludedScenarioIds`` is implicitly selected, so the predicate
  // reduces to "no excluded rows on the current page."
  const allPageSelected = useMemo(() => {
    const pageIds = parentScenarios.filter((s) => s.scenario_id).map((s) => s.scenario_id!);
    if (pageIds.length === 0) return false;
    return pageIds.every((id) => isSelected(id));
  }, [parentScenarios, isSelected]);

  // Whether there ARE more matching rows than what's loaded on this
  // page — used to decide whether to surface the "Select all N
  // matching" affordance after the user selects the page.
  const hasMoreThanCurrentPage = totalMatchingCount > parentScenarios.length;

  // Toggle selection for a single scenario. Under all-matching mode
  // we toggle membership in excludedScenarioIds (deselect ⇒ add to
  // exclusions, re-select ⇒ remove). Under explicit mode it's the
  // straight selectedScenarioIds toggle.
  const toggleSelection = useCallback((scenarioId: string) => {
    if (selectAllMatching) {
      void setExcludedScenarioIds((prev) =>
        prev.includes(scenarioId)
          ? prev.filter((id) => id !== scenarioId)
          : [...prev, scenarioId],
      );
    } else {
      void setSelectedScenarioIds((prev) =>
        prev.includes(scenarioId)
          ? prev.filter((id) => id !== scenarioId)
          : [...prev, scenarioId],
      );
    }
  }, [selectAllMatching, setExcludedScenarioIds, setSelectedScenarioIds]);

  const clearSelection = useCallback(() => {
    void setSelectedScenarioIds([]);
    void setSelectAllMatching(false);
    void setExcludedScenarioIds([]);
  }, [setSelectedScenarioIds, setSelectAllMatching, setExcludedScenarioIds]);

  const selectAllOnPage = useCallback(() => {
    const pageIds = parentScenarios.filter((s) => s.scenario_id).map((s) => s.scenario_id!);
    void setSelectAllMatching(false);
    void setExcludedScenarioIds([]);
    void setSelectedScenarioIds((prev) => {
      const combined = new Set([...prev, ...pageIds]);
      return Array.from(combined);
    });
  }, [parentScenarios, setSelectAllMatching, setExcludedScenarioIds, setSelectedScenarioIds]);

  /** Promote the current page-only selection into "all matching
   *  filter" mode. Clears explicit ids and exclusions — the all-
   *  matching mode is the canonical truth from this point. */
  const selectAllMatchingNow = useCallback(() => {
    void setSelectedScenarioIds([]);
    void setExcludedScenarioIds([]);
    void setSelectAllMatching(true);
  }, [setSelectedScenarioIds, setExcludedScenarioIds, setSelectAllMatching]);

  // Use server-provided facet options directly (filtered by search term server-side)
  const personaOptions = useMemo(
    () =>
      (scenariosData?.persona_filter?.options || [])
        .map((opt) => ({
          value: opt.id as string,
          label: opt.name as string,
          count: opt.count ?? undefined,
        }))
        .filter((opt) => opt.value && opt.label),
    [scenariosData?.persona_filter],
  );
  const simulationOptions = useMemo(
    () =>
      (scenariosData?.simulation_filter?.options || [])
        .map((opt) => ({
          value: opt.id as string,
          label: opt.name as string,
          count: opt.count ?? undefined,
        }))
        .filter((opt) => opt.value && opt.label),
    [scenariosData?.simulation_filter],
  );
  const departmentOptions = useMemo(
    () =>
      (scenariosData?.department_filter?.options || [])
        .map((opt) => ({
          value: opt.id as string,
          label: opt.name as string,
          count: opt.count ?? undefined,
        }))
        .filter((opt) => opt.value && opt.label),
    [scenariosData?.department_filter],
  );
  const flagOptions = useMemo(() => {
    return (scenariosData?.flag_filter?.options || [])
      .filter((opt): opt is typeof opt & { id: string; name: string } => !!opt.id && !!opt.name)
      .map((opt) => ({ id: opt.id!, name: opt.name!, type: opt.type ?? null }));
  }, [scenariosData?.flag_filter]);

  // Define table columns inline
  const columns: ColumnDef<(typeof scenarios)[number]>[] = useMemo(() => {
    return [
      {
        accessorKey: "name",
        header: "Title",
        cell: ({ row }) => {
          return (
            <div className="font-medium">
              {row.original.name || "Unnamed Scenario"}
            </div>
          );
        },
      },
      {
        accessorKey: "problem_statement",
        header: "Problem Statement",
        cell: ({ row }) => {
          return (
            <div className="text-sm text-muted-foreground line-clamp-2">
              {row.original.problem_statement || "No problem statement"}
            </div>
          );
        },
      },
      // Hidden faceting column for Persona (array of IDs)
      {
        id: "persona_id",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: (typeof scenarios)[number]) => row.persona_ids ?? [],
        filterFn: (row, _id, value: string[]) => {
          const rowIds = (row.getValue("persona_id") as string[]) ?? [];
          if (value.length === 0) return true;
          if (rowIds.length === 0) return false;
          return value.some((v) => rowIds.includes(v));
        },
      },
      // Hidden faceting column for Simulations (array of IDs)
      {
        id: "simulation_ids",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: (typeof scenarios)[number]) =>
          row.simulation_ids ?? [],
        filterFn: (row, _id, value: string[]) => {
          const rowIds = (row.getValue("simulation_ids") as string[]) ?? [];
          return value.some((v) => rowIds.includes(v));
        },
      },
      // Hidden faceting column for Departments (array of IDs)
      {
        id: "departments",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: (typeof scenarios)[number]) =>
          row.department_ids ?? [],
        filterFn: (row, _id, value: string[]) => {
          const rowIds = (row.getValue("departments") as string[]) ?? [];
          if (value.length === 0) return true;
          if (rowIds.length === 0) return false;
          return value.some((v) => rowIds.includes(v));
        },
      },
      {
        id: "persona_display",
        accessorFn: (row: (typeof scenarios)[number]) =>
          row.persona_ids?.[0] ?? null,
        header: "Persona",
        cell: ({ row }) => {
          const personaIds = row.original.persona_ids ?? [];
          return (
            <div className="text-sm flex flex-wrap gap-1">
              {personaIds.length > 0 ? (
                personaIds.map((personaId) => {
                  const persona = personaMapping[personaId];
                  if (!persona) return null;
                  return (
                    <span key={personaId} className="text-sm">
                      {persona.name}
                    </span>
                  );
                })
              ) : (
                <span className="text-muted-foreground">No persona</span>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: "updated_at",
        header: "Updated",
        cell: ({ row }) => {
          if (!row.original.updated_at) return null;
          const date = new Date(row.original.updated_at);
          return (
            <div className="text-sm text-muted-foreground">
              {date.toLocaleDateString()}
            </div>
          );
        },
      },
      // Virtual columns for card view toggles
      {
        id: "ai_badge",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: (typeof scenarios)[number]) => row.generated ?? false,
      },
      {
        id: "status_badge",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: (typeof scenarios)[number]) => row.is_inactive ?? false,
      },
      {
        id: "problem_statement",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: (typeof scenarios)[number]) => row.problem_statement ?? "",
      },
      {
        id: "card_num_simulations",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: (typeof scenarios)[number]) => row.num_simulations ?? 0,
      },
      {
        id: "persona_badges",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: (typeof scenarios)[number]) => row.persona_ids ?? [],
      },
      {
        id: "field_badges",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: (typeof scenarios)[number]) => row.field_ids ?? [],
      },
    ];
  }, [personaMapping]);

  // Group scenarios: roots and their children (server already returns only current page)
  const currentPageGroupedScenarios = useMemo(() => {
    const groups: GroupedScenario[] = [];
    const roots = scenarios.filter((s) => !s.parent_scenario_id);
    roots.forEach((parent) => {
      const children = scenarios.filter(
        (s) => s.parent_scenario_id === parent.scenario_id,
      );
      groups.push({ parent, children });
    });
    return groups;
  }, [scenarios]);

  // Page count for manual pagination
  const pageCount = Math.ceil(totalCount / pageSize);

  // Create table instance with manual pagination/filtering
  const table = useReactTable({
    data: parentScenarios,
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
    pageCount,
    manualPagination: true,
    manualFiltering: true,
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: (updater) => {
      const newFilters = typeof updater === "function" ? updater(columnFilters) : updater;
      setColumnFilters(newFilters);
      // Sync filter changes to URL
      const personaFilter = newFilters.find((f) => f.id === "persona_id");
      const simulationFilter = newFilters.find((f) => f.id === "simulation_ids");
      const departmentFilter = newFilters.find((f) => f.id === "departments");
      updateScenariosParams({
        personaIds: (personaFilter?.value as string[] | undefined) ?? null,
        simulationIds: (simulationFilter?.value as string[] | undefined) ?? null,
        departmentIds: (departmentFilter?.value as string[] | undefined) ?? null,
      });
    },
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: (updater) => {
      const current = { pageIndex, pageSize };
      const next = typeof updater === "function" ? updater(current) : updater;
      updateScenariosParams({
        page: next.pageIndex > 0 ? String(next.pageIndex) : null,
        pageSize: next.pageSize !== 10 ? String(next.pageSize) : null,
      });
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  // Permissions now come from server-side in V2 API
  // No need for client-side permission logic

  const handleDelete = async () => {
    if (!deleteItem || !deleteScenarioAction) return;

    setIsDeleting(true);
    try {
      await deleteScenarioAction({ body: { scenario_ids: [deleteItem.id], accept: true } });
      toast.success("Scenario deleted successfully");
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to delete scenario";
      const cleanMsg = msg.replace(/^\d{3}\s*/, "");
      toast.error(cleanMsg || "Failed to delete scenario");
      if (msg.startsWith("404")) {
        router.refresh();
      }
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
      setDeleteItem(null);
    }
  };

  const handleBulkDelete = async () => {
    // Either explicit-mode (deletable rows on current page) OR
    // all-matching mode (server resolves rows via filter). Both
    // converge on the same ``deleteScenarioAction`` call shape; the
    // body just differs.
    if (!deleteScenarioAction) return;
    if (!selectAllMatching && deletableScenarios.length === 0) return;

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
            excluded_ids: excludedScenarioIds,
            ...(currentSearchBody ?? {}),
            accept: true,
          }
        : {
            scenario_ids: deletableScenarios.map((s) => s.scenario_id!),
            accept: true,
          };

      const result = await deleteScenarioAction({ body } as DeleteScenarioIn);

      // Per-row results from the server: success entries are actual
      // deletions, failures are soft-skipped rows (no permission /
      // not found). Toast reflects both counts so the user knows
      // some rows were skipped without inspecting the receipt.
      const results = (result as DeleteScenarioOut).results ?? [];
      const successCount = results.filter((r) => r.success).length;
      const skippedCount = results.length - successCount;
      if (skippedCount > 0) {
        toast.success(
          `${successCount} scenario(s) deleted, ${skippedCount} skipped`,
        );
      } else {
        toast.success(`${successCount} scenario(s) deleted successfully`);
      }
      clearSelection();
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to delete scenarios";
      const cleanMsg = msg.replace(/^\d{3}\s*/, "");
      toast.error(cleanMsg || "Failed to delete scenarios");
    } finally {
      setIsBulkDeleting(false);
      setShowBulkDeleteDialog(false);
    }
  };

  const handleBulkEdit = async () => {
    if (!updateScenarioAction) return;
    if (!selectAllMatching && editableScenarios.length === 0) return;

    const hasActiveChange = bulkEditActiveStatus !== null;
    const hasDeptChange = bulkEditDepartmentIds !== null;
    const hasAnyFlagChange = hasActiveChange;

    if (!hasActiveChange && !hasDeptChange) {
      toast.error("No changes selected");
      return;
    }

    // Resolve flag UUIDs by type from the server-provided catalog.
    const flagId = (type: string) => flagOptions.find((f) => f.type === type)?.id;
    const activeFlagId = flagId("scenario_active");

    setIsBulkEditing(true);
    try {
      // Shared change set used by both paths. Under all-matching the
      // server clones this per resolved row (stamping each id);
      // under explicit we clone client-side, preserving per-row flag
      // state for fields we aren't toggling.
      const sharedPatch = {
        ...(hasDeptChange && { department_ids: bulkEditDepartmentIds }),
      };

      let body: UpdateScenarioIn["body"];
      if (selectAllMatching) {
        // All-matching: the server can't preserve per-row flag state
        // (it doesn't know what each row's existing flags are), so
        // the active toggle becomes "set to this value across all
        // matching rows" — the same semantic as a manual sweep.
        let flag_ids: string[] | undefined;
        if (hasAnyFlagChange) {
          flag_ids = [];
          if (bulkEditActiveStatus && activeFlagId) flag_ids.push(activeFlagId);
        }
        body = {
          all: true,
          excluded_ids: excludedScenarioIds,
          ...(currentSearchBody ?? {}),
          patch: {
            ...sharedPatch,
            ...(hasAnyFlagChange && { flag_ids }),
          },
          accept: true,
        } as UpdateScenarioIn["body"];
      } else {
        // Explicit: clone the patch per-row, preserving each row's
        // existing flag state for flags we aren't toggling.
        const items = editableScenarios.map((scenario) => {
          let flag_ids: string[] | undefined;
          if (hasAnyFlagChange) {
            const isActive = hasActiveChange ? bulkEditActiveStatus : !scenario.is_inactive;
            flag_ids = [];
            if (isActive && activeFlagId) flag_ids.push(activeFlagId);
          }
          return {
            id: scenario.scenario_id!,
            ...sharedPatch,
            ...(hasAnyFlagChange && { flag_ids }),
          };
        });
        body = { scenarios: items } as UpdateScenarioIn["body"];
      }

      const result = await updateScenarioAction({ body } as UpdateScenarioIn);

      // Per-row results — same soft-skip pattern as bulk delete.
      const results = (result as UpdateScenarioOut).results ?? [];
      const successCount = results.filter((r) => r.success).length;
      const skippedCount = results.length - successCount;
      if (skippedCount > 0) {
        toast.success(
          `${successCount} scenario(s) updated, ${skippedCount} skipped`,
        );
      } else {
        toast.success(`${successCount} scenario(s) updated successfully`);
      }
      clearSelection();
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to update scenarios";
      const cleanMsg = msg.replace(/^\d{3}\s*/, "");
      toast.error(cleanMsg || "Failed to update scenarios");
    } finally {
      setIsBulkEditing(false);
      setShowBulkEditDialog(false);
    }
  };

  const openBulkEditDialog = () => {
    // Reset form state
    setBulkEditActiveStatus(null);
    setBulkEditDepartmentIds(null);

    setShowBulkEditDialog(true);
  };

  const handleDuplicate = async (scenarioId: string, scenarioName: string) => {
    if (!duplicateScenarioAction) return;

    setIsDuplicating(scenarioId);
    try {
      await duplicateScenarioAction({ body: { scenario_id: scenarioId, accept: true } });
      toast.success(`Scenario "${scenarioName}" duplicated successfully`);
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to duplicate scenario";
      const cleanMsg = msg.replace(/^\d{3}\s*/, "");
      toast.error(cleanMsg || "Failed to duplicate scenario");
      if (msg.startsWith("404")) {
        router.refresh();
      }
    } finally {
      setIsDuplicating(null);
    }
  };

  const handleDeleteClick = (id: string, name: string) => {
    setDeleteItem({ id, name });
    setShowDeleteDialog(true);
  };

  const handleEdit = (id: string) => {
    router.push(`/training/scenarios/${id}`);
  };

  const handleView = (id: string) => {
    router.push(`/training/scenarios/${id}`);
  };

  const toggleGroupCollapse = (parentId: string) => {
    setCollapsedGroups((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(parentId)) {
        newSet.delete(parentId);
      } else {
        newSet.add(parentId);
      }
      return newSet;
    });
  };

  // Debounced search handler
  const handleSearchChange = useCallback(
    (value: string) => {
      setLocalSearch(value);
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
      searchDebounceRef.current = setTimeout(() => {
        updateScenariosParams({ search: value || null });
      }, 500);
    },
    [updateScenariosParams],
  );

  const handleSearchBlur = useCallback(() => {
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
      searchDebounceRef.current = null;
    }
    updateScenariosParams({ search: localSearch || null });
  }, [localSearch, updateScenariosParams]);

  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        if (searchDebounceRef.current) {
          clearTimeout(searchDebounceRef.current);
          searchDebounceRef.current = null;
        }
        updateScenariosParams({ search: localSearch || null });
      }
    },
    [localSearch, updateScenariosParams],
  );

  // Filter option search handlers (300ms debounce)
  const handlePersonaSearchChange = useCallback(
    (term: string) => {
      if (personaSearchDebounceRef.current) clearTimeout(personaSearchDebounceRef.current);
      personaSearchDebounceRef.current = setTimeout(() => {
        updateScenariosParams({ personaSearch: term || null });
      }, 300);
    },
    [updateScenariosParams],
  );

  const handleSimulationSearchChange = useCallback(
    (term: string) => {
      if (simulationSearchDebounceRef.current) clearTimeout(simulationSearchDebounceRef.current);
      simulationSearchDebounceRef.current = setTimeout(() => {
        updateScenariosParams({ simulationSearch: term || null });
      }, 300);
    },
    [updateScenariosParams],
  );

  const handleDepartmentSearchChange = useCallback(
    (term: string) => {
      if (departmentSearchDebounceRef.current) clearTimeout(departmentSearchDebounceRef.current);
      departmentSearchDebounceRef.current = setTimeout(() => {
        updateScenariosParams({ departmentSearch: term || null });
      }, 300);
    },
    [updateScenariosParams],
  );

  const _handleFlagSearchChange = useCallback(
    (term: string) => {
      setLocalFlagSearch(term);
      if (flagSearchDebounceRef.current) clearTimeout(flagSearchDebounceRef.current);
      flagSearchDebounceRef.current = setTimeout(() => {
        updateScenariosParams({ flagSearch: term || null });
      }, 300);
    },
    [updateScenariosParams],
  );

  // Reset all filters
  const handleResetFilters = useCallback(() => {
    setColumnFilters([]);
    setLocalSearch("");
    setLocalFlagSearch("");
    updateScenariosParams({
      search: null,
      personaIds: null,
      simulationIds: null,
      departmentIds: null,
      personaSearch: null,
      simulationSearch: null,
      departmentSearch: null,
      flagSearch: null,
      page: null,
    });
  }, [updateScenariosParams]);

  const renderScenarioCard = (
    scenario: (typeof scenarios)[number],
    isChild: boolean = false,
    showDropdown?: boolean,
    isCollapsed?: boolean,
    onToggleCollapse?: () => void,
    ghost?: Ghost<(typeof scenarios)[number]>,
  ) => {
    // Same card visual for real rows and in-flight ghosts — single
    // source of truth for layout, badges, dimensions. Ghost mode swaps
    // action buttons for a status badge (and Accept/Reject for soft-
    // pending), disables selection/click, and tints the border based on
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

    const isSelectedRow = !isGhost && !isChild && scenario.scenario_id ? isSelected(scenario.scenario_id) : false;

    const handleCardClick = (e: React.MouseEvent) => {
      // Don't toggle selection if clicking action buttons, on a child,
      // or when rendering as a ghost (no real id to select).
      if (isGhost) return;
      if (isChild) return;
      if ((e.target as HTMLElement).closest("[data-action-button]")) return;
      if (scenario.scenario_id) {
        toggleSelection(scenario.scenario_id);
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
        key={scenario.scenario_id}
        data-testid={isGhost ? "scenario-ghost-card" : "scenario-card"}
        data-scenario-id={scenario.scenario_id}
        data-ghost-state={ghostState}
        className={`group relative flex flex-col h-full hover:shadow-md transition-all ${
          isChild ? "ml-8 border-l-2 border-l-blue-200" : isGhost ? "" : "cursor-pointer"
        } ${ghostBorderClass} ${isSelectedRow ? "ring-2 ring-primary" : ""}`}
        aria-selected={!isChild && !isGhost ? isSelectedRow : undefined}
        aria-busy={inFlight ? true : undefined}
        onClick={handleCardClick}
      >
        <CardHeader className="pb-3">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div className="space-y-2 flex-1 min-w-0">
              <div className="flex items-center gap-2">
                {/* Selection checkbox — inline before name (parent only).
                    Hidden in ghost mode (no row id to select yet). */}
                {!isChild && !isGhost && (
                  <div
                    className={`transition-all overflow-hidden flex-shrink-0 ${
                      selectedCount > 0 ? "w-5 opacity-100" : "w-0 opacity-0 group-hover:w-5 group-hover:opacity-100"
                    }`}
                    data-action-button
                  >
                    <Checkbox
                      checked={isSelectedRow}
                      onCheckedChange={() => {
                        if (scenario.scenario_id) toggleSelection(scenario.scenario_id);
                      }}
                      className="rounded-full h-5 w-5"
                      aria-label={`Select scenario ${scenario.name || "Unnamed"}`}
                    />
                  </div>
                )}
                {/* In-flight ghost without a streamed name yet → spinner. */}
                {isGhost && inFlight && (
                  <Loader2 className="h-4 w-4 animate-spin flex-shrink-0 text-muted-foreground" />
                )}
                {showDropdown && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 hover:bg-muted flex-shrink-0 -ml-1"
                    onClick={onToggleCollapse}
                    data-action-button
                  >
                    {isCollapsed ? (
                      <ChevronRight className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                )}
                <CardTitle className="text-lg flex-1 min-w-0 truncate">
                  {scenario.name || (isGhost ? "Generating…" : "Unnamed Scenario")}
                </CardTitle>
                <div className="flex gap-1 flex-wrap flex-shrink-0">
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
                  {!isGhost && columnVisibility.ai_badge !== false && scenario.generated && (
                    <Badge variant="default">
                      <Sparkles className="h-3 w-3 mr-1" />
                      {scenario.mcp ? "MCP" : "AI"}
                    </Badge>
                  )}
                  {!isGhost && columnVisibility.status_badge !== false && scenario.is_inactive && (
                    <Badge variant="secondary">Inactive</Badge>
                  )}
                </div>
              </div>
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
                    onClick={() => handleScenarioAck(ghost.callId, true, ghost.op)}
                  >
                    <Check className="mr-1 h-3.5 w-3.5" />
                    Accept
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8"
                    onClick={() => handleScenarioAck(ghost.callId, false, ghost.op)}
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
              {!isGhost && (scenario.generated ? (
                // For generated scenarios: only show preview and duplicate
                <>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        data-testid="btn-view-scenario"
                        onClick={() =>
                          scenario.scenario_id &&
                          handleView(scenario.scenario_id)
                        }
                        className="h-9 px-3"
                      >
                        <Eye className="h-4 w-4 md:mr-0 mr-2" />
                        <span className="md:hidden">View</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>View</TooltipContent>
                  </Tooltip>
                  {scenario.can_duplicate && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          data-testid="btn-duplicate-scenario"
                          onClick={() =>
                            scenario.scenario_id &&
                            handleDuplicate(
                              scenario.scenario_id,
                              scenario.name || "Unnamed Scenario"
                            )
                          }
                          disabled={
                            isDuplicating === scenario.scenario_id ||
                            !scenario.scenario_id
                          }
                          className="h-9 px-3"
                        >
                          {isDuplicating === scenario.scenario_id ? (
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent md:mr-0 mr-2" />
                          ) : (
                            <Copy className="h-4 w-4 md:mr-0 mr-2" />
                          )}
                          <span className="md:hidden">
                            {isDuplicating === scenario.scenario_id
                              ? "Duplicating..."
                              : "Duplicate"}
                          </span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Duplicate</TooltipContent>
                    </Tooltip>
                  )}
                </>
              ) : (
                // For non-generated scenarios: show edit, duplicate, and delete
                <>
                  {scenario.can_edit ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          data-testid="btn-edit-scenario"
                          onClick={() =>
                            scenario.scenario_id &&
                            handleEdit(scenario.scenario_id)
                          }
                          className="h-9 px-3"
                        >
                          <Edit className="h-4 w-4 md:mr-0 mr-2" />
                          <span className="md:hidden">Edit</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Edit</TooltipContent>
                    </Tooltip>
                  ) : (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          data-testid="btn-view-scenario"
                          onClick={() =>
                            scenario.scenario_id &&
                            handleView(scenario.scenario_id)
                          }
                          className="h-9 px-3"
                        >
                          <Eye className="h-4 w-4 md:mr-0 mr-2" />
                          <span className="md:hidden">View</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>View</TooltipContent>
                    </Tooltip>
                  )}
                  {scenario.can_duplicate && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          data-testid="btn-duplicate-scenario"
                          onClick={() =>
                            scenario.scenario_id &&
                            handleDuplicate(
                              scenario.scenario_id,
                              scenario.name || "Unnamed Scenario"
                            )
                          }
                          disabled={
                            isDuplicating === scenario.scenario_id ||
                            !scenario.scenario_id
                          }
                          className="h-9 px-3"
                        >
                          {isDuplicating === scenario.scenario_id ? (
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent md:mr-0 mr-2" />
                          ) : (
                            <Copy className="h-4 w-4 md:mr-0 mr-2" />
                          )}
                          <span className="md:hidden">
                            {isDuplicating === scenario.scenario_id
                              ? "Duplicating..."
                              : "Duplicate"}
                          </span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Duplicate</TooltipContent>
                    </Tooltip>
                  )}

                  {scenario.can_delete && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          data-testid="btn-delete-scenario"
                          onClick={() =>
                            scenario.scenario_id &&
                            handleDeleteClick(
                              scenario.scenario_id,
                              scenario.name || "Unnamed Scenario"
                            )
                          }
                          className="h-9 px-3"
                        >
                          <Trash2 className="h-4 w-4 md:mr-0 mr-2" />
                          <span className="md:hidden">Delete</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Delete</TooltipContent>
                    </Tooltip>
                  )}
                </>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0 flex-grow flex flex-col justify-end">
          {columnVisibility.problem_statement !== false && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {scenario.problem_statement ||
                "Scenario will be dynamically generated."}
            </p>
          )}
          {!isChild && (columnVisibility.card_num_simulations !== false || columnVisibility.persona_badges !== false || columnVisibility.field_badges !== false) && (
            <div className="flex items-center gap-1.5 mt-3 text-xs text-muted-foreground flex-wrap">
              {columnVisibility.card_num_simulations !== false && (
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {scenario.num_simulations} simulation
                  {scenario.num_simulations !== 1 ? "s" : ""}
                </span>
              )}
              {columnVisibility.persona_badges !== false && scenario.persona_ids && scenario.persona_ids.length > 0 && (
                <>
                  {columnVisibility.card_num_simulations !== false && (
                    <span className="text-muted-foreground">•</span>
                  )}
                  <div className="flex items-center gap-1 flex-wrap">
                    {scenario.persona_ids.map((personaId) => {
                      const persona = personaMapping[personaId];
                      if (!persona) return null;
                      return (
                        <Tooltip key={personaId}>
                          <TooltipTrigger asChild>
                            <Badge
                              variant="outline"
                              className="text-xs"
                              style={{
                                backgroundColor: persona.color
                                  ? `${persona.color}20`
                                  : undefined,
                                borderColor: persona.color || undefined,
                                color: persona.color || undefined,
                              }}
                            >
                              {persona.name}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{persona.description || persona.name}</p>
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>
                </>
              )}
              {columnVisibility.field_badges !== false && scenario.field_ids && scenario.field_ids.length > 0 && (
                <>
                  {(columnVisibility.card_num_simulations !== false || (columnVisibility.persona_badges !== false && scenario.persona_ids && scenario.persona_ids.length > 0)) && (
                    <span className="text-muted-foreground">•</span>
                  )}
                  <div className="flex items-center gap-1 flex-wrap">
                    {scenario.field_ids.slice(0, 4).map((fieldId) => {
                      const field = fieldMapping[fieldId];
                      if (!field) return null;
                      return (
                        <Tooltip key={fieldId}>
                          <TooltipTrigger asChild>
                            <Badge variant="outline" className="text-xs">
                              {field.name}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{field.description || field.name}</p>
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                    {scenario.field_ids.length > 4 && (
                      <span className="text-xs text-muted-foreground">
                        +{scenario.field_ids.length - 4} more
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderGroupedScenarios = () => {
    return currentPageGroupedScenarios.map((group) => {
      const parentId = group.parent.scenario_id;
      if (!parentId) return null;
      const isCollapsed = collapsedGroups.has(parentId);
      const hasChildren = group.children.length > 0;

      // Server-side pending status (from soft_calls_mv) — render the row
      // as a pending ghost so Accept/Reject controls appear. Live in-flight
      // ghosts continue to come from the audit hub (rendered separately).
      const persistentGhost: Ghost<(typeof scenarios)[number]> | undefined =
        group.parent.pending_status === "pending" && group.parent.pending_call_id
          ? {
              callId: group.parent.pending_call_id,
              op: (group.parent.pending_operation as Ghost<(typeof scenarios)[number]>["op"]) ?? "create",
              state: "pending",
              rowId: group.parent.scenario_id ?? null,
              partial: group.parent as unknown as Ghost<(typeof scenarios)[number]>["partial"],
              before: group.parent,
              tool: null,
              error: null,
              arguments: {},
            }
          : undefined;

      return (
        <div key={parentId} className="space-y-2">
          {/* Parent Scenario Card */}
          {renderScenarioCard(
            group.parent,
            false,
            hasChildren,
            isCollapsed,
            () => toggleGroupCollapse(parentId),
            persistentGhost,
          )}

          {/* Child Scenarios */}
          {hasChildren && !isCollapsed && (
            <div className="space-y-2">
              {group.children.map((child) => renderScenarioCard(child, true))}
            </div>
          )}
        </div>
      );
    });
  };

  // Get column references for toolbar
  const personaColumn = table.getColumn("persona_id");
  const simulationColumn = table.getColumn("simulation_ids");
  const departmentsColumn = table.getColumn("departments");
  const isFiltered = columnFilters.length > 0 || localSearch.length > 0;

  return (
    <TooltipProvider>
      <div className="space-y-8" data-page="scenarios-index">
        <div className="space-y-4">
          {/* Toolbar — swaps between filter bar and selection action bar */}
          {selectedCount > 0 ? (
            <div className="space-y-2" data-testid="scenarios-toolbar">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {deleteScenarioAction && (
                  <Button
                    variant="destructive"
                    size="sm"
                    className="h-8"
                    onClick={() => setShowBulkDeleteDialog(true)}
                    disabled={!selectAllMatching && deletableScenarios.length === 0}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    {selectAllMatching
                      ? `Delete ${selectedCount} matching`
                      : `Delete ${deletableScenarios.length} of ${selectedCount}`}
                  </Button>
                )}
                {updateScenarioAction && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8"
                    onClick={openBulkEditDialog}
                    disabled={!selectAllMatching && editableScenarios.length === 0}
                  >
                    <Pencil className="mr-2 h-4 w-4" />
                    {selectAllMatching
                      ? `Edit ${selectedCount} matching`
                      : `Edit ${editableScenarios.length} of ${selectedCount}`}
                  </Button>
                )}
                {!allPageSelected && !selectAllMatching && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8"
                    onClick={selectAllOnPage}
                  >
                    Select Page
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8"
                  onClick={clearSelection}
                >
                  Unselect All
                </Button>
              </div>
              <DataTableViewOptions table={table} hiddenColumns={["name", "problem_statement", "persona_id", "simulation_ids", "departments", "persona_display", "updated_at"]} />
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
                  All {parentScenarios.length} on this page selected.
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
                  All {selectedCount} matching scenarios selected
                  {excludedScenarioIds.length > 0 && ` (${excludedScenarioIds.length} excluded)`}.
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
            data-testid="scenarios-toolbar"
          >
            <div className="flex flex-col md:flex-row md:flex-1 md:items-center md:space-x-2 gap-2 md:gap-0">
              <div className="w-full md:w-auto">
                <Input
                  data-testid="scenarios-search"
                  placeholder="Search scenarios..."
                  value={localSearch}
                  onChange={(event) => handleSearchChange(event.target.value)}
                  onBlur={handleSearchBlur}
                  onKeyDown={handleSearchKeyDown}
                  className="h-8 w-full md:w-[150px] lg:w-[250px]"
                  aria-label="Search scenarios by name"
                  aria-controls="scenarios-grid"
                />
              </div>

              <div className="flex items-center space-x-2 flex-wrap">
                <ThreePickerFilters
                  slots={[
                    {
                      column: personaColumn,
                      title: "Persona",
                      options: personaOptions,
                      isServerDriven: true,
                      onSearchChange: handlePersonaSearchChange,
                      searchValue: personaSearch,
                    },
                    {
                      column: simulationColumn,
                      title: "Simulation",
                      options: simulationOptions,
                      isServerDriven: true,
                      onSearchChange: handleSimulationSearchChange,
                      searchValue: simulationSearch,
                    },
                    {
                      column: departmentsColumn,
                      title: "Department",
                      options: departmentOptions,
                      isServerDriven: true,
                      onSearchChange: handleDepartmentSearchChange,
                      searchValue: departmentSearch,
                    },
                  ]}
                />

                {isFiltered && (
                  <Button
                    variant="ghost"
                    onClick={handleResetFilters}
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
              <DataTableViewOptions table={table} hiddenColumns={["name", "problem_statement", "persona_id", "simulation_ids", "departments", "persona_display", "updated_at"]} />
            </div>
          </div>
          )}

          {/* Grouped Scenarios

              Ghost cards from in-flight audited writes (create/duplicate/
              update/delete in non-terminal states) are prepended — same
              ``renderScenarioCard`` so layout, dimensions, and visual
              language match exactly. Once a ghost commits, its hydrated
              row is in ``mergedRows`` (via ``state.added``) AND the
              ghost's ``state`` flips to "committed" — we filter those
              out so the real row replaces the ghost in place without a
              duplicate frame. */}
          <div
            className="space-y-4"
            role="grid"
            aria-label="scenarios grid"
            data-testid="scenarios-grid"
          >
            {scenarioGhosts
              .filter((g) => g.state !== "committed" && g.state !== "accepted")
              .map((g) => {
                // For update/delete, ``before`` is the snapshot lookup
                // from baseRows (existing row) — gives us name,
                // problem_statement so the ghost card shows what's being
                // deleted/updated. For create/duplicate, ``before`` is
                // null and ``partial`` carries the streaming args.
                const scenarioShell = (g.before ?? g.partial) as (typeof scenarios)[number];
                return (
                  <div key={`ghost-${g.callId}`}>
                    {renderScenarioCard(scenarioShell, false, false, false, undefined, g)}
                  </div>
                );
              })}
            {currentPageGroupedScenarios.length > 0 ? (
              renderGroupedScenarios()
            ) : (
              scenarioGhosts.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No scenarios match the current filters.
                </div>
              )
            )}
          </div>

          {/* Pagination */}
          <DataTablePagination table={table} />
        </div>

        {/* Single Delete Confirmation Dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent
            aria-labelledby="delete-scenario-title"
            data-testid="dialog-delete-scenario"
          >
            <AlertDialogHeader>
              <AlertDialogTitle id="delete-scenario-title">
                Delete Scenario
              </AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete the scenario "{deleteItem?.name}
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
          count={selectAllMatching ? selectedCount : deletableScenarios.length}
          entityLabel="scenario"
          entityLabelPlural="scenarios"
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
                    {" "}scenarios will be deleted server-side using the current filter.
                  </p>
                  {excludedScenarioIds.length > 0 && (
                    <p className="mt-1">
                      {excludedScenarioIds.length} explicitly excluded.
                    </p>
                  )}
                  <p className="mt-1">
                    Scenarios you don't have permission to delete will be skipped automatically.
                  </p>
                </div>
              ) : (
                <>
                  {deletableScenarios.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-destructive mb-1">Will be deleted:</p>
                      <ul className="text-sm space-y-0.5">
                        {deletableScenarios.map((s) => (
                          <li key={s.scenario_id} className="flex items-center gap-1.5">
                            <Trash2 className="h-3 w-3 text-destructive flex-shrink-0" />
                            {s.name || "Unnamed Scenario"}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {nonDeletableScenarios.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-yellow-600 dark:text-yellow-500 mb-1">Cannot be deleted (in use by simulations):</p>
                      <ul className="text-sm space-y-0.5">
                        {nonDeletableScenarios.map((s) => (
                          <li key={s.scenario_id} className="flex items-center gap-1.5 text-muted-foreground">
                            <CheckCircle className="h-3 w-3 text-yellow-600 dark:text-yellow-500 flex-shrink-0" />
                            {s.name || "Unnamed Scenario"}
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
          count={selectAllMatching ? selectedCount : editableScenarios.length}
          entityLabelPlural="scenarios"
          isSaving={isBulkEditing}
          onSave={handleBulkEdit}
        >
          {/* Active status — tri-state flag field */}
          <BulkEditFlagField
            label="Active Status"
            value={bulkEditActiveStatus}
            onChange={setBulkEditActiveStatus}
          />

          {/* Departments — GenericPicker multi-select */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Departments</Label>
              {bulkEditDepartmentIds !== null && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() => setBulkEditDepartmentIds(null)}
                >
                  Reset
                </Button>
              )}
            </div>
            {bulkEditDepartmentIds === null ? (
              <Button
                variant="outline"
                className="w-full justify-start text-muted-foreground"
                onClick={() => setBulkEditDepartmentIds([])}
              >
                No change — click to edit departments
              </Button>
            ) : (
              <GenericPicker
                items={departmentOptions}
                selectedIds={bulkEditDepartmentIds}
                onSelect={setBulkEditDepartmentIds}
                multiSelect
                getId={(d) => d.value}
                getLabel={(d) => d.label}
                placeholder="Select departments..."
                showClearAction
                clearActionLabel="Clear All"
                searchPlaceholder="Search departments..."
                emptyMessage="No departments found."
                groupHeading="Departments"
                hideSelectedChips={false}
                showClearAll
              />
            )}
          </div>
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
          artifactName="Scenarios"
          parseCsvAction={parseCsvAction}
          onSave={async (items) => {
            if (!createScenarioAction) throw new Error("Create action not available");
            const scenarios = items.map((item) => ({
              name: item.name as string | undefined,
              description: item.description as string | undefined,
              problem_statement: item.problem_statement as string | undefined,
              active_flag: item.active_flag as boolean | undefined,
              departments: item.departments as string[] | undefined,
              personas: item.personas as string[] | undefined,
              documents: item.documents as string[] | undefined,
              parameter_fields: item.parameter_fields as string[] | undefined,
              objectives: item.objectives as string[] | undefined,
              images: item.images as string[] | undefined,
              videos: item.videos as string[] | undefined,
              questions: item.questions as string[] | undefined,
              options: item.options as string[] | undefined,
            }));
            return createScenarioAction({ body: { scenarios } } as CreateScenarioIn);
          }}
        />
      )}

      </div>
    </TooltipProvider>
  );
}
