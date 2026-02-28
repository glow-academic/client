/**
 * Scenarios.tsx
 * Used to display the scenarios page with table-based filtering and card layout.
 * Server-side filtering with nuqs URL-backed state.
 * @AshokSaravanan222 & @siladiea
 * 06/07/2025
 */
"use client";
import {
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Copy,
  Edit,
  Eye,
  FileSpreadsheet,
  Pencil,
  Sparkles,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { useArtifactAi } from "@/hooks/use-artifact-ai";

import type {
  DeleteScenarioIn,
  DeleteScenarioOut,
  DuplicateScenarioIn,
  DuplicateScenarioOut,
  ParseCsvIn,
  ParseCsvOut,
  SaveScenarioIn,
  SaveScenarioOut,
  ScenariosListOut,
  SearchFlagsOut,
} from "@/app/(main)/training/scenarios/page";
import BulkImport, { type ImportFieldDef } from "@/components/common/BulkImport";
import { DataTableFacetedFilter } from "@/components/common/table/DataTableFacetedFilter";
import { DataTablePagination } from "@/components/common/table/DataTablePagination";
import { DataTableViewOptions } from "@/components/common/table/DataTableViewOptions";
import { GenericPicker } from "@/components/common/forms/GenericPicker";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
  // Server actions (replaces useMutation)
  duplicateScenarioAction?: (
    input: DuplicateScenarioIn,
  ) => Promise<DuplicateScenarioOut>;
  deleteScenarioAction?: (
    input: DeleteScenarioIn,
  ) => Promise<DeleteScenarioOut>;
  saveScenarioAction?: (input: SaveScenarioIn) => Promise<SaveScenarioOut>;
  searchFlagsAction?: () => Promise<SearchFlagsOut>;
  parseCsvAction?: (input: ParseCsvIn) => Promise<ParseCsvOut>;
  importFields?: ImportFieldDef[];
  // Server-side pagination/filtering state
  pageIndex: number;
  pageSize: number;
  totalCount: number;
  personaSearch: string;
  simulationSearch: string;
  departmentSearch: string;
}

export function Scenarios({
  listData: serverListData,
  duplicateScenarioAction,
  deleteScenarioAction,
  saveScenarioAction,
  searchFlagsAction,
  parseCsvAction,
  importFields,
  pageIndex,
  pageSize,
  totalCount,
  personaSearch,
  simulationSearch,
  departmentSearch,
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

  // Selection state (root/parent scenarios only)
  const [selectedScenarioIds, setSelectedScenarioIds] = useState<string[]>([]);

  // Bulk delete state
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // Bulk edit state
  const [showBulkEditDialog, setShowBulkEditDialog] = useState(false);
  const [showBulkImportDialog, setShowBulkImportDialog] = useState(false);
  const [isBulkEditing, setIsBulkEditing] = useState(false);
  const [bulkEditActiveStatus, setBulkEditActiveStatus] = useState<boolean | null>(null);
  const [bulkEditDepartmentIds, setBulkEditDepartmentIds] = useState<string[] | null>(null);

  // Lazy-loaded flag options
  const [flagOptions, setFlagOptions] = useState<{ id: string; name: string; type: string }[]>([]);
  const [flagsLoaded, setFlagsLoaded] = useState(false);

  useArtifactAi({
    artifactType: "scenario",
    validResourceTypes: ["names", "descriptions", "problem_statements", "objectives", "scenario_flags", "departments", "personas", "documents", "parameters", "parameter_fields", "images", "videos", "questions"],
    onComplete: () => router.refresh(),
  });

  // Debounce refs
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const personaSearchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const simulationSearchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const departmentSearchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Local search state (for immediate UI feedback while debouncing)
  const [localSearch, setLocalSearch] = useState(searchParams.get("search") ?? "");

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
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
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

  // Extract data from response - scenarios from paginated page
  const scenarios = useMemo(
    () => scenariosData?.scenarios || [],
    [scenariosData?.scenarios],
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

  const selectedCount = selectedScenarioIds.length;
  const selectedScenarios = useMemo(() => {
    return parentScenarios.filter((s) => s.scenario_id && selectedScenarioIds.includes(s.scenario_id));
  }, [parentScenarios, selectedScenarioIds]);

  const deletableScenarios = useMemo(() => {
    return selectedScenarios.filter((s) => s.can_delete);
  }, [selectedScenarios]);

  const nonDeletableScenarios = useMemo(() => {
    return selectedScenarios.filter((s) => !s.can_delete);
  }, [selectedScenarios]);

  const editableScenarios = useMemo(() => {
    return selectedScenarios.filter((s) => s.can_edit);
  }, [selectedScenarios]);

  // Check if all parent scenarios on the current page are selected
  const allPageSelected = useMemo(() => {
    const pageIds = parentScenarios.filter((s) => s.scenario_id).map((s) => s.scenario_id!);
    return pageIds.length > 0 && pageIds.every((id) => selectedScenarioIds.includes(id));
  }, [parentScenarios, selectedScenarioIds]);

  // Toggle selection for a single scenario
  const toggleSelection = useCallback((scenarioId: string) => {
    setSelectedScenarioIds((prev) =>
      prev.includes(scenarioId)
        ? prev.filter((id) => id !== scenarioId)
        : [...prev, scenarioId]
    );
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedScenarioIds([]);
  }, []);

  const selectAllOnPage = useCallback(() => {
    const pageIds = parentScenarios.filter((s) => s.scenario_id).map((s) => s.scenario_id!);
    setSelectedScenarioIds((prev) => {
      const combined = new Set([...prev, ...pageIds]);
      return Array.from(combined);
    });
  }, [parentScenarios]);

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
      await deleteScenarioAction({ body: { scenario_ids: [deleteItem.id] } });
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
    if (!deleteScenarioAction || deletableScenarios.length === 0) return;

    setIsBulkDeleting(true);
    try {
      const ids = deletableScenarios.map((s) => s.scenario_id!);
      await deleteScenarioAction({ body: { scenario_ids: ids } });
      toast.success(`${ids.length} scenario(s) deleted successfully`);
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
    if (!saveScenarioAction || editableScenarios.length === 0) return;

    const hasActiveChange = bulkEditActiveStatus !== null;
    const hasDeptChange = bulkEditDepartmentIds !== null;

    if (!hasActiveChange && !hasDeptChange) {
      toast.error("No changes selected");
      return;
    }

    // Find the scenario_active flag ID from lazy-loaded flagOptions
    const activeFlagId = flagOptions.find((f) => f.type === "scenario_active")?.id;

    setIsBulkEditing(true);
    try {
      const items = editableScenarios.map((scenario) => {
        // active_flag_id is a dedicated field: set to the active flag ID when active, null when inactive
        let activeFlag: string | null | undefined;
        if (hasActiveChange) {
          activeFlag = bulkEditActiveStatus && activeFlagId ? activeFlagId : null;
        }

        return {
          input_scenario_id: scenario.scenario_id!,
          ...(hasActiveChange && { active_flag_id: activeFlag }),
          ...(hasDeptChange && { department_ids: bulkEditDepartmentIds }),
        };
      });

      await saveScenarioAction({
        body: {
          scenarios: items,
        },
      });
      toast.success(`${items.length} scenario(s) updated successfully`);
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

  const openBulkEditDialog = async () => {
    // Reset form state
    setBulkEditActiveStatus(null);
    setBulkEditDepartmentIds(null);

    // Lazy-load flag options
    if (!flagsLoaded) {
      try {
        const flags = await searchFlagsAction?.() ?? [];
        setFlagOptions(
          (flags as { id?: string | null; name?: string | null; type?: string | null }[])
            .filter((f): f is { id: string; name: string; type: string } => !!f.id && !!f.name && !!f.type)
        );
        setFlagsLoaded(true);
      } catch {
        toast.error("Failed to load flag options");
      }
    }

    setShowBulkEditDialog(true);
  };

  const handleDuplicate = async (scenarioId: string, scenarioName: string) => {
    if (!duplicateScenarioAction) return;

    setIsDuplicating(scenarioId);
    try {
      await duplicateScenarioAction({ body: { scenario_id: scenarioId } });
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

  // Reset all filters
  const handleResetFilters = useCallback(() => {
    setColumnFilters([]);
    setLocalSearch("");
    updateScenariosParams({
      search: null,
      personaIds: null,
      simulationIds: null,
      departmentIds: null,
      personaSearch: null,
      simulationSearch: null,
      departmentSearch: null,
      page: null,
    });
  }, [updateScenariosParams]);

  const renderScenarioCard = (
    scenario: (typeof scenarios)[number],
    isChild: boolean = false,
    showDropdown?: boolean,
    isCollapsed?: boolean,
    onToggleCollapse?: () => void,
  ) => {
    const isSelected = !isChild && scenario.scenario_id ? selectedScenarioIds.includes(scenario.scenario_id) : false;

    const handleCardClick = (e: React.MouseEvent) => {
      // Don't toggle selection if clicking action buttons or if it's a child scenario
      if (isChild) return;
      if ((e.target as HTMLElement).closest("[data-action-button]")) return;
      if (scenario.scenario_id) {
        toggleSelection(scenario.scenario_id);
      }
    };

    return (
      <Card
        key={scenario.scenario_id}
        data-testid="scenario-card"
        data-scenario-id={scenario.scenario_id}
        className={`group relative flex flex-col h-full hover:shadow-md transition-all ${
          isChild ? "ml-8 border-l-2 border-l-blue-200" : "cursor-pointer"
        } ${isSelected ? "ring-2 ring-primary" : ""}`}
        aria-selected={!isChild ? isSelected : undefined}
        onClick={handleCardClick}
      >
        <CardHeader className="pb-3">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div className="space-y-2 flex-1 min-w-0">
              <div className="flex items-center gap-2">
                {/* Selection checkbox — inline before name (parent only) */}
                {!isChild && (
                  <div
                    className={`transition-all overflow-hidden flex-shrink-0 ${
                      selectedCount > 0 ? "w-5 opacity-100" : "w-0 opacity-0 group-hover:w-5 group-hover:opacity-100"
                    }`}
                    data-action-button
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => {
                        if (scenario.scenario_id) toggleSelection(scenario.scenario_id);
                      }}
                      className="rounded-full h-5 w-5"
                      aria-label={`Select scenario ${scenario.name || "Unnamed"}`}
                    />
                  </div>
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
                  {scenario.name || "Unnamed Scenario"}
                </CardTitle>
                <div className="flex gap-1 flex-wrap flex-shrink-0">
                  {columnVisibility.ai_badge !== false && scenario.generated && (
                    <Badge variant="default">
                      <Sparkles className="h-3 w-3 mr-1" />
                      {scenario.mcp ? "MCP" : "AI"}
                    </Badge>
                  )}
                  {columnVisibility.status_badge !== false && scenario.is_inactive && (
                    <Badge variant="secondary">Inactive</Badge>
                  )}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 items-center" data-action-button>
              {scenario.generated ? (
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
              )}
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

      return (
        <div key={parentId} className="space-y-2">
          {/* Parent Scenario Card */}
          {renderScenarioCard(
            group.parent,
            false,
            hasChildren,
            isCollapsed,
            () => toggleGroupCollapse(parentId),
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
            <div
              className="flex items-center justify-between gap-2"
              data-testid="scenarios-toolbar"
            >
              <div className="flex items-center gap-2">
                {deleteScenarioAction && (
                  <Button
                    variant="destructive"
                    size="sm"
                    className="h-8"
                    onClick={() => setShowBulkDeleteDialog(true)}
                    disabled={deletableScenarios.length === 0}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete {deletableScenarios.length} of {selectedCount}
                  </Button>
                )}
                {saveScenarioAction && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8"
                    onClick={openBulkEditDialog}
                    disabled={editableScenarios.length === 0}
                  >
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit {editableScenarios.length} of {selectedCount}
                  </Button>
                )}
                {!allPageSelected && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8"
                    onClick={selectAllOnPage}
                  >
                    Select All
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
                {/* Simulation Filter */}
                {simulationColumn && (
                  <DataTableFacetedFilter
                    column={simulationColumn}
                    title="Simulation"
                    options={simulationOptions}
                    isServerDriven={true}
                    onSearchChange={handleSimulationSearchChange}
                    searchValue={simulationSearch}
                  />
                )}

                {/* Persona Filter */}
                {personaColumn && (
                  <DataTableFacetedFilter
                    column={personaColumn}
                    title="Persona"
                    options={personaOptions}
                    isServerDriven={true}
                    onSearchChange={handlePersonaSearchChange}
                    searchValue={personaSearch}
                  />
                )}

                {/* Department Filter */}
                {departmentsColumn && (
                  <DataTableFacetedFilter
                    column={departmentsColumn}
                    title="Department"
                    options={departmentOptions}
                    isServerDriven={true}
                    onSearchChange={handleDepartmentSearchChange}
                    searchValue={departmentSearch}
                  />
                )}

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

          {/* Grouped Scenarios */}
          <div
            className="space-y-4"
            role="grid"
            aria-label="scenarios grid"
            data-testid="scenarios-grid"
          >
            {currentPageGroupedScenarios.length > 0 ? (
              renderGroupedScenarios()
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No scenarios match the current filters.
              </div>
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
        <AlertDialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
          <AlertDialogContent
            aria-labelledby="bulk-delete-scenario-title"
            data-testid="dialog-bulk-delete-scenario"
          >
            <AlertDialogHeader>
              <AlertDialogTitle id="bulk-delete-scenario-title">
                Delete {deletableScenarios.length} Scenario(s)
              </AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-3">
                  <p>This action cannot be undone.</p>
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
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isBulkDeleting}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleBulkDelete}
                disabled={isBulkDeleting}
                variant="destructive"
              >
                {isBulkDeleting ? "Deleting..." : `Delete ${deletableScenarios.length}`}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Bulk Edit Modal */}
        <Dialog open={showBulkEditDialog} onOpenChange={setShowBulkEditDialog}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Edit {editableScenarios.length} Scenario(s)</DialogTitle>
              <DialogDescription>
                Only changed fields will be applied. Unchanged fields keep their current values.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-5 py-4">
              {/* Active Status — Switch with tri-state */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Active Status</Label>
                <div className="flex items-center gap-3">
                  {bulkEditActiveStatus === null ? (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">No change</span>
                      <span className="text-xs text-muted-foreground">—</span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => setBulkEditActiveStatus(true)}
                      >
                        Set Active
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => setBulkEditActiveStatus(false)}
                      >
                        Set Inactive
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <Switch
                        checked={bulkEditActiveStatus}
                        onCheckedChange={setBulkEditActiveStatus}
                      />
                      <span className="text-sm">{bulkEditActiveStatus ? "Active" : "Inactive"}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs text-muted-foreground"
                        onClick={() => setBulkEditActiveStatus(null)}
                      >
                        Reset
                      </Button>
                    </div>
                  )}
                </div>
              </div>

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
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowBulkEditDialog(false)} disabled={isBulkEditing}>
                Cancel
              </Button>
              <Button onClick={handleBulkEdit} disabled={isBulkEditing}>
                {isBulkEditing ? "Applying..." : "Apply Changes"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

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
            if (!saveScenarioAction) throw new Error("Save action not available");
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
            return saveScenarioAction({ body: { scenarios } });
          }}
        />
      )}

      </div>
    </TooltipProvider>
  );
}
