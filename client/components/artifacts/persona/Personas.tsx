/**
 * Personas.tsx
 * Used to display the personas page with server-side filtering.
 * @AshokSaravanan222 & @siladiea
 * 06/07/2025
 */
"use client";
import { Brain, Check, CheckCircle, Copy, Edit, Eye, FileSpreadsheet, Pencil, Sparkles, Trash2, Users, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { getIconComponent } from "@/utils/icons";
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
  DeletePersonaIn,
  DeletePersonaOut,
  DuplicatePersonaIn,
  DuplicatePersonaOut,
  ParseCsvIn,
  ParseCsvOut,
  PersonasListOut,
  SavePersonaIn,
  SavePersonaOut,
  SearchColorsOut,
  SearchIconsOut,
  SearchVoicesOut,
} from "@/app/(main)/training/personas/page";
import BulkImport, { type ImportFieldDef } from "@/components/common/BulkImport";
import { DataTableFacetedFilter } from "@/components/common/table/DataTableFacetedFilter";
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
import { GenericPicker } from "@/components/common/forms/GenericPicker";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { useProfile } from "@/contexts/profile-context";
import { useArtifactAi } from "@/hooks/use-artifact-ai";


// Utility function to generate gradient from hex color
const generateGradientFromHex = (hexColor: string): string => {
  // Remove # if present
  const cleanHex = hexColor.replace("#", "");

  // Convert to RGB
  const r = parseInt(cleanHex.substr(0, 2), 16);
  const g = parseInt(cleanHex.substr(2, 2), 16);
  const b = parseInt(cleanHex.substr(4, 2), 16);

  // Create a lighter variant for the gradient (brighter like simulation cards)
  const lighterR = Math.min(255, r + 60);
  const lighterG = Math.min(255, g + 60);
  const lighterB = Math.min(255, b + 60);

  // Convert back to hex
  const lighterHex = `#${lighterR.toString(16).padStart(2, "0")}${lighterG.toString(16).padStart(2, "0")}${lighterB.toString(16).padStart(2, "0")}`;

  return `linear-gradient(135deg, ${lighterHex} 0%, ${hexColor} 100%)`;
};

export interface PersonasProps {
  // Server-provided data (for server-side rendering)
  listData: PersonasListOut;
  // Server actions (replaces useMutation)
  duplicatePersonaAction?: (
    input: DuplicatePersonaIn
  ) => Promise<DuplicatePersonaOut>;
  deletePersonaAction?: (input: DeletePersonaIn) => Promise<DeletePersonaOut>;
  savePersonaAction?: (input: SavePersonaIn) => Promise<SavePersonaOut>;
  searchColorsAction?: () => Promise<SearchColorsOut>;
  searchIconsAction?: () => Promise<SearchIconsOut>;
  searchVoicesAction?: () => Promise<SearchVoicesOut>;
  parseCsvAction?: ((input: ParseCsvIn) => Promise<ParseCsvOut>) | undefined;
  importFields?: ImportFieldDef[] | undefined;
  // Server-side pagination
  pageIndex: number;
  pageSize: number;
  totalCount: number;
  // Server-side filter search terms
  scenarioSearch: string;
  fieldSearch: string;
  departmentSearch: string;
}

export default function Personas({
  listData: serverListData,
  duplicatePersonaAction,
  deletePersonaAction,
  savePersonaAction,
  searchColorsAction,
  searchIconsAction,
  searchVoicesAction,
  parseCsvAction,
  importFields,
  pageIndex,
  pageSize,
  totalCount,
  scenarioSearch,
  fieldSearch,
  departmentSearch,
}: PersonasProps) {
  const { profile } = useProfile();
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

  // Selection state
  const [selectedPersonaIds, setSelectedPersonaIds] = useState<string[]>([]);

  // Bulk delete state
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // Bulk edit state
  const [showBulkEditDialog, setShowBulkEditDialog] = useState(false);
  const [isBulkEditing, setIsBulkEditing] = useState(false);
  const [bulkEditActiveStatus, setBulkEditActiveStatus] = useState<boolean | null>(null); // null = no change
  const [bulkEditColorIds, setBulkEditColorIds] = useState<string[]>([]); // empty = no change
  const [bulkEditIconIds, setBulkEditIconIds] = useState<string[]>([]); // empty = no change
  const [bulkEditDepartmentIds, setBulkEditDepartmentIds] = useState<string[] | null>(null); // null = no change
  const [bulkEditVoiceIds, setBulkEditVoiceIds] = useState<string[] | null>(null); // null = no change

  // Bulk import state
  const [showBulkImportDialog, setShowBulkImportDialog] = useState(false);

  // Lazy-loaded picker options
  const [colorOptions, setColorOptions] = useState<{ id: string; name: string; hex_code?: string | null }[]>([]);
  const [iconOptions, setIconOptions] = useState<{ id: string; name: string; value?: string | null }[]>([]);
  const [voiceOptions, setVoiceOptions] = useState<{ id: string; voice: string }[]>([]);
  const [optionsLoaded, setOptionsLoaded] = useState(false);

  // Socket listener for generation events (toasts, spinners, completion refresh)
  // Generation is dispatched from the GenerationPanel, not from this page
  useArtifactAi({
    artifactType: "persona",
    validResourceTypes: ["names", "descriptions", "colors", "icons", "instructions", "flags", "examples", "parameter_fields", "departments", "parameters", "voices"],
    onComplete: () => router.refresh(),
  });

  // Local search state for debouncing
  const [searchTerm, setSearchTerm] = useState(
    searchParams?.get("search") ?? ""
  );
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Table state
  const [rowSelection, setRowSelection] = useState({});
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>(() => {
    // Initialize column filters from URL params
    const filters: ColumnFiltersState = [];
    const scenarioIds = searchParams?.getAll("scenarioIds") ?? [];
    const fieldIdParams = searchParams?.getAll("fieldIds") ?? [];
    const deptIds = searchParams?.getAll("departmentIds") ?? [];
    if (scenarioIds.length > 0) filters.push({ id: "scenarios", value: scenarioIds });
    if (fieldIdParams.length > 0) filters.push({ id: "fieldIds", value: fieldIdParams });
    if (deptIds.length > 0) filters.push({ id: "departments", value: deptIds });
    return filters;
  });
  const [sorting, setSorting] = useState<SortingState>([
    { id: "updated_at", desc: true },
  ]);

  // Memoize personas data to prevent infinite re-renders
  const personasData = serverListData;

  // Extract personas array
  const personas = useMemo(() => {
    return personasData?.personas || [];
  }, [personasData?.personas]);

  // Computed selection info
  const selectedCount = selectedPersonaIds.length;
  const selectedPersonas = useMemo(() => {
    return personas.filter((p) => p.persona_id && selectedPersonaIds.includes(p.persona_id));
  }, [personas, selectedPersonaIds]);

  const deletablePersonas = useMemo(() => {
    return selectedPersonas.filter((p) => p.can_delete);
  }, [selectedPersonas]);

  const nonDeletablePersonas = useMemo(() => {
    return selectedPersonas.filter((p) => !p.can_delete);
  }, [selectedPersonas]);

  const editablePersonas = useMemo(() => {
    return selectedPersonas.filter((p) => p.can_edit);
  }, [selectedPersonas]);

  // Check if all personas on the current page are selected
  const allPageSelected = useMemo(() => {
    const pageIds = personas.filter((p) => p.persona_id).map((p) => p.persona_id!);
    return pageIds.length > 0 && pageIds.every((id) => selectedPersonaIds.includes(id));
  }, [personas, selectedPersonaIds]);

  // Toggle selection for a single persona
  const toggleSelection = useCallback((personaId: string) => {
    setSelectedPersonaIds((prev) =>
      prev.includes(personaId)
        ? prev.filter((id) => id !== personaId)
        : [...prev, personaId]
    );
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedPersonaIds([]);
  }, []);

  const selectAllOnPage = useCallback(() => {
    const pageIds = personas.filter((p) => p.persona_id).map((p) => p.persona_id!);
    setSelectedPersonaIds((prev) => {
      const combined = new Set([...prev, ...pageIds]);
      return Array.from(combined);
    });
  }, [personas]);

  // Derive options from filter sections (server returns filtered options based on search)
  const scenarioOptions = useMemo(() => {
    return (personasData?.scenario_filter?.options || [])
      .map((opt) => ({
        value: opt.id as string,
        label: opt.name as string,
        count: opt.count ?? undefined,
      }))
      .filter((opt) => opt.value && opt.label);
  }, [personasData?.scenario_filter]);

  const fieldOptions = useMemo(() => {
    return (personasData?.field_filter?.options || [])
      .map((opt) => ({
        value: opt.id as string,
        label: opt.name as string,
        count: opt.count ?? undefined,
      }))
      .filter((opt) => opt.value && opt.label);
  }, [personasData?.field_filter]);

  const departmentOptions = useMemo(() => {
    return (personasData?.department_filter?.options || [])
      .map((opt) => ({
        value: opt.id as string,
        label: opt.name as string,
        count: opt.count ?? undefined,
      }))
      .filter((opt) => opt.value && opt.label);
  }, [personasData?.department_filter]);

  // Helper to update URL search params
  const updatePersonasParams = useCallback(
    (updates: {
      page?: number;
      pageSize?: number;
      search?: string;
      scenarioIds?: string[];
      fieldIds?: string[];
      departmentIds?: string[];
      scenarioSearch?: string;
      fieldSearch?: string;
      departmentSearch?: string;
    }) => {
      const params = new URLSearchParams(searchParams?.toString() || "");

      if (updates.page !== undefined) {
        if (updates.page === 0) {
          params.delete("page");
        } else {
          params.set("page", updates.page.toString());
        }
      }

      if (updates.pageSize !== undefined) {
        if (updates.pageSize === 12) {
          params.delete("pageSize");
        } else {
          params.set("pageSize", updates.pageSize.toString());
        }
      }

      if (updates.search !== undefined) {
        if (updates.search === "") {
          params.delete("search");
        } else {
          params.set("search", updates.search);
        }
      }

      if (updates.scenarioIds !== undefined) {
        params.delete("scenarioIds");
        updates.scenarioIds.forEach((id) => params.append("scenarioIds", id));
      }

      if (updates.fieldIds !== undefined) {
        params.delete("fieldIds");
        updates.fieldIds.forEach((id) => params.append("fieldIds", id));
      }

      if (updates.departmentIds !== undefined) {
        params.delete("departmentIds");
        updates.departmentIds.forEach((id) => params.append("departmentIds", id));
      }

      if (updates.scenarioSearch !== undefined) {
        if (updates.scenarioSearch === "") {
          params.delete("scenarioSearch");
        } else {
          params.set("scenarioSearch", updates.scenarioSearch);
        }
      }

      if (updates.fieldSearch !== undefined) {
        if (updates.fieldSearch === "") {
          params.delete("fieldSearch");
        } else {
          params.set("fieldSearch", updates.fieldSearch);
        }
      }

      if (updates.departmentSearch !== undefined) {
        if (updates.departmentSearch === "") {
          params.delete("departmentSearch");
        } else {
          params.set("departmentSearch", updates.departmentSearch);
        }
      }

      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  // Commit search to URL
  const commitSearch = useCallback(
    (value: string) => {
      updatePersonasParams({
        page: 0,
        search: value.trim() || "",
      });
    },
    [updatePersonasParams]
  );

  // Handle search input change with debounce
  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchTerm(value);

      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }

      if (value === "") {
        commitSearch("");
        return;
      }

      searchTimeoutRef.current = setTimeout(() => {
        commitSearch(value);
      }, 500);
    },
    [commitSearch]
  );

  // Handle search on blur or Enter
  const handleSearchBlur = useCallback(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    commitSearch(searchTerm);
  }, [commitSearch, searchTerm]);

  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        if (searchTimeoutRef.current) {
          clearTimeout(searchTimeoutRef.current);
        }
        commitSearch(searchTerm);
      }
    },
    [commitSearch, searchTerm]
  );

  // Handle filter option search changes (debounced)
  const scenarioSearchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fieldSearchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const departmentSearchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [localScenarioSearch, setLocalScenarioSearch] = useState(scenarioSearch);
  const [localFieldSearch, setLocalFieldSearch] = useState(fieldSearch);
  const [localDepartmentSearch, setLocalDepartmentSearch] = useState(departmentSearch);

  const handleScenarioSearchChange = useCallback(
    (value: string) => {
      setLocalScenarioSearch(value);
      if (scenarioSearchTimeoutRef.current) {
        clearTimeout(scenarioSearchTimeoutRef.current);
      }
      scenarioSearchTimeoutRef.current = setTimeout(() => {
        updatePersonasParams({ scenarioSearch: value });
      }, 300);
    },
    [updatePersonasParams]
  );

  const handleFieldSearchChange = useCallback(
    (value: string) => {
      setLocalFieldSearch(value);
      if (fieldSearchTimeoutRef.current) {
        clearTimeout(fieldSearchTimeoutRef.current);
      }
      fieldSearchTimeoutRef.current = setTimeout(() => {
        updatePersonasParams({ fieldSearch: value });
      }, 300);
    },
    [updatePersonasParams]
  );

  const handleDepartmentSearchChange = useCallback(
    (value: string) => {
      setLocalDepartmentSearch(value);
      if (departmentSearchTimeoutRef.current) {
        clearTimeout(departmentSearchTimeoutRef.current);
      }
      departmentSearchTimeoutRef.current = setTimeout(() => {
        updatePersonasParams({ departmentSearch: value });
      }, 300);
    },
    [updatePersonasParams]
  );

  // Sync column filters to URL when they change
  const handleColumnFiltersChange = useCallback(
    (updater: ColumnFiltersState | ((prev: ColumnFiltersState) => ColumnFiltersState)) => {
      const newFilters = typeof updater === "function" ? updater(columnFilters) : updater;
      setColumnFilters(newFilters);

      // Extract filter values
      const scenarioFilter = newFilters.find((f) => f.id === "scenarios");
      const fieldFilter = newFilters.find((f) => f.id === "fieldIds");
      const departmentFilter = newFilters.find((f) => f.id === "departments");

      updatePersonasParams({
        page: 0,
        scenarioIds: (scenarioFilter?.value as string[]) || [],
        fieldIds: (fieldFilter?.value as string[]) || [],
        departmentIds: (departmentFilter?.value as string[]) || [],
      });
    },
    [columnFilters, updatePersonasParams]
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
      updatePersonasParams({
        page: newPagination.pageIndex,
        pageSize: newPagination.pageSize,
      });
    },
    [pageIndex, pageSize, updatePersonasParams]
  );

  // Compute page count from total
  const pageCount = Math.ceil(totalCount / pageSize);

  // Define table columns
  const columns: ColumnDef<(typeof personas)[number]>[] = useMemo(() => {
    return [
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => {
          const persona = row.original;
          return (
            <div className="font-medium">
              {persona.name || "Unnamed Persona"}
            </div>
          );
        },
      },
      {
        accessorKey: "description",
        header: "Description",
        cell: ({ row }) => {
          const persona = row.original;
          return (
            <div className="text-sm text-muted-foreground">
              {persona.description || "No description available"}
            </div>
          );
        },
      },
      // Hidden faceting column for Scenarios (array of IDs)
      {
        id: "scenarios",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: (typeof personas)[number]) => row.scenario_ids ?? [],
        filterFn: (row, _id, value: string[]) => {
          const rowIds = (row.getValue("scenarios") as string[]) ?? [];
          return value.some((v) => rowIds.includes(v));
        },
      },
      // Hidden faceting column for Fields (array of IDs)
      {
        id: "fieldIds",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: (typeof personas)[number]) => row.field_ids ?? [],
        filterFn: (row, _id, value: string[]) => {
          const rowIds = (row.getValue("fieldIds") as string[]) ?? [];
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
        accessorFn: (row: (typeof personas)[number]) =>
          row.department_ids ?? [],
        filterFn: (row, _id, value: string[]) => {
          const rowIds = (row.getValue("departments") as string[]) ?? [];
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
          if (!updatedAt) {
            return <div className="text-sm text-muted-foreground">—</div>;
          }
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
        id: "ai_badge",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: (typeof personas)[number]) => row.generated ?? false,
      },
      {
        id: "status_badge",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: (typeof personas)[number]) => row.is_inactive ?? false,
      },
      {
        id: "card_description",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: (typeof personas)[number]) => row.description ?? "",
      },
      {
        id: "num_scenarios",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: (typeof personas)[number]) => row.num_scenarios ?? 0,
      },
      {
        id: "num_profiles",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: (typeof personas)[number]) => row.num_profiles ?? 0,
      },
    ];
  }, []);

  // Create table instance with manual pagination and filtering
  const table = useReactTable({
    data: personas,
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
  }, [sortingKey, personas.length, pageIndex, pageSize]);

  const handleDelete = async () => {
    if (!deleteItem || !deletePersonaAction) return;

    if (!profile?.id) {
      toast.error("Profile not loaded. Please refresh the page.");
      return;
    }

    setIsDeleting(true);
    try {
      await deletePersonaAction({
        body: {
          persona_ids: [deleteItem.id],
        },
      });
      toast.success("Persona deleted successfully");
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to delete persona";
      const cleanMsg = msg.replace(/^\d{3}\s*/, "");
      toast.error(cleanMsg || "Failed to delete persona");
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
    if (!deletePersonaAction || deletablePersonas.length === 0) return;

    if (!profile?.id) {
      toast.error("Profile not loaded. Please refresh the page.");
      return;
    }

    setIsBulkDeleting(true);
    try {
      const ids = deletablePersonas.map((p) => p.persona_id!);
      await deletePersonaAction({
        body: {
          persona_ids: ids,
        },
      });
      toast.success(`${ids.length} persona(s) deleted successfully`);
      clearSelection();
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to delete personas";
      const cleanMsg = msg.replace(/^\d{3}\s*/, "");
      toast.error(cleanMsg || "Failed to delete personas");
    } finally {
      setIsBulkDeleting(false);
      setShowBulkDeleteDialog(false);
    }
  };

  const handleBulkEdit = async () => {
    if (!savePersonaAction || editablePersonas.length === 0) return;

    if (!profile?.id) {
      toast.error("Profile not loaded. Please refresh the page.");
      return;
    }

    // Build items with only changed fields
    const hasActiveChange = bulkEditActiveStatus !== null;
    const hasColorChange = bulkEditColorIds.length > 0;
    const hasIconChange = bulkEditIconIds.length > 0;
    const hasDeptChange = bulkEditDepartmentIds !== null;
    const hasVoiceChange = bulkEditVoiceIds !== null;

    if (!hasActiveChange && !hasColorChange && !hasIconChange && !hasDeptChange && !hasVoiceChange) {
      toast.error("No changes selected");
      return;
    }

    setIsBulkEditing(true);
    try {
      const items = editablePersonas.map((p) => ({
        input_persona_id: p.persona_id!,
        ...(hasActiveChange && { active_flag: bulkEditActiveStatus }),
        ...(hasColorChange && { color_id: bulkEditColorIds[0] }),
        ...(hasIconChange && { icon_id: bulkEditIconIds[0] }),
        ...(hasDeptChange && { department_ids: bulkEditDepartmentIds }),
        ...(hasVoiceChange && { voice_ids: bulkEditVoiceIds }),
      }));

      await savePersonaAction({
        body: {
          personas: items,
        },
      });
      toast.success(`${items.length} persona(s) updated successfully`);
      clearSelection();
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to update personas";
      const cleanMsg = msg.replace(/^\d{3}\s*/, "");
      toast.error(cleanMsg || "Failed to update personas");
    } finally {
      setIsBulkEditing(false);
      setShowBulkEditDialog(false);
    }
  };

  const openBulkEditDialog = async () => {
    // Reset form state
    setBulkEditActiveStatus(null);
    setBulkEditColorIds([]);
    setBulkEditIconIds([]);
    setBulkEditDepartmentIds(null);
    setBulkEditVoiceIds(null);

    // Lazy-load picker options
    if (!optionsLoaded) {
      try {
        const [colors, icons, voices] = await Promise.all([
          searchColorsAction?.() ?? Promise.resolve([]),
          searchIconsAction?.() ?? Promise.resolve([]),
          searchVoicesAction?.() ?? Promise.resolve([]),
        ]);
        setColorOptions(
          (colors as { id?: string | null; name?: string | null; hex_code?: string | null }[])
            .filter((c): c is { id: string; name: string; hex_code?: string | null } => !!c.id && !!c.name)
        );
        setIconOptions(
          (icons as { id?: string | null; name?: string | null; value?: string | null }[])
            .filter((i): i is { id: string; name: string; value?: string | null } => !!i.id && !!i.name)
        );
        setVoiceOptions(
          (voices as { id?: string | null; voice?: string | null }[])
            .filter((v): v is { id: string; voice: string } => !!v.id && !!v.voice)
        );
        setOptionsLoaded(true);
      } catch {
        toast.error("Failed to load options");
      }
    }

    setShowBulkEditDialog(true);
  };

  const handleDuplicate = async (personaId: string, personaName: string) => {
    if (!duplicatePersonaAction) return;

    if (!profile?.id) {
      toast.error("Profile not loaded. Please refresh the page.");
      return;
    }

    setIsDuplicating(personaId);
    try {
      await duplicatePersonaAction({
        body: {
          persona_id: personaId,
        },
      });
      toast.success(`Persona "${personaName}" duplicated successfully`);
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to duplicate persona";
      const cleanMsg = msg.replace(/^\d{3}\s*/, "");
      toast.error(cleanMsg || "Failed to duplicate persona");
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
    router.push(`/training/personas/${id}`);
  };

  const handleView = (id: string) => {
    router.push(`/training/personas/${id}`);
  };

  const renderPersonaCard = (persona: (typeof personas)[0]) => {
    // Get the icon component from the persona's stored icon name
    const IconComponent = getIconComponent(persona.icon || "") || Brain;

    // Use the hex color directly with CSS custom properties
    const hexColor = persona.color || "#64748b"; // Default to slate if no color
    const gradientStyle = generateGradientFromHex(hexColor);
    const iconColor = "#ffffff";

    const isSelected = persona.persona_id ? selectedPersonaIds.includes(persona.persona_id) : false;

    const handleCardClick = (e: React.MouseEvent) => {
      // Don't toggle selection if clicking action buttons
      if ((e.target as HTMLElement).closest("[data-action-button]")) return;
      if (persona.persona_id) {
        toggleSelection(persona.persona_id);
      }
    };

    return (
      <Card
        className={`group relative flex flex-col h-full hover:shadow-md transition-all cursor-pointer ${
          isSelected ? "ring-2 ring-primary" : ""
        }`}
        data-testid="persona-card"
        data-persona-id={persona.persona_id}
        role="gridcell"
        aria-label={`persona card ${persona.name || "Unnamed Persona"}`}
        aria-selected={isSelected}
        onClick={handleCardClick}
      >
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div className="space-y-2 flex-1 min-w-0">
              <div className="flex items-center gap-2">
                {/* Selection checkbox — inline before icon */}
                <div
                  className={`transition-all overflow-hidden flex-shrink-0 ${
                    selectedCount > 0 ? "w-5 opacity-100" : "w-0 opacity-0 group-hover:w-5 group-hover:opacity-100"
                  }`}
                  data-action-button
                >
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => {
                      if (persona.persona_id) toggleSelection(persona.persona_id);
                    }}
                    className="rounded-full h-5 w-5"
                    aria-label={`Select persona ${persona.name || "Unnamed"}`}
                  />
                </div>
                <div
                  className="p-2 rounded-lg shadow-lg group-hover:scale-110 transition-transform duration-300 flex-shrink-0"
                  style={{
                    background: gradientStyle,
                  }}
                >
                  <IconComponent
                    className="h-4 w-4"
                    style={{ color: iconColor }}
                  />
                </div>
                <CardTitle className="text-lg truncate">
                  {persona.name || "Unnamed Persona"}
                </CardTitle>
              </div>
              {((columnVisibility.ai_badge !== false && persona.generated) || (columnVisibility.status_badge !== false && persona.is_inactive)) && (
                <div className="mt-1 flex items-center gap-2">
                  {columnVisibility.ai_badge !== false && persona.generated && (
                    <Badge variant="default">
                      <Sparkles className="h-3 w-3 mr-1" />
                      {persona.mcp ? "MCP" : "AI"}
                    </Badge>
                  )}
                  {columnVisibility.status_badge !== false && persona.is_inactive && (
                    <Badge variant="secondary">Inactive</Badge>
                  )}
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2 items-center" data-action-button>
              {persona.can_edit ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (persona.persona_id) {
                          handleEdit(persona.persona_id);
                        }
                      }}
                      aria-label={`Edit persona ${persona.name || "Unnamed"}`}
                      data-testid="btn-edit-persona"
                      data-action-button
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
                      onClick={() => {
                        if (persona.persona_id) {
                          handleView(persona.persona_id);
                        }
                      }}
                      aria-label={`View persona ${persona.name || "Unnamed"}`}
                      data-testid="btn-view-persona"
                      data-action-button
                      className="h-9 px-3"
                    >
                      <Eye className="h-4 w-4 md:mr-0 mr-2" />
                      <span className="md:hidden">View</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>View</TooltipContent>
                </Tooltip>
              )}
              {persona.can_duplicate && persona.persona_id && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (persona.persona_id) {
                          handleDuplicate(
                            persona.persona_id,
                            persona.name || "Unnamed Persona"
                          );
                        }
                      }}
                      disabled={isDuplicating === persona.persona_id}
                      aria-busy={
                        isDuplicating === persona.persona_id ? true : undefined
                      }
                      aria-label={`Duplicate persona ${persona.name || "Unnamed"}`}
                      data-testid="btn-duplicate-persona"
                      data-action-button
                      className="h-9 px-3"
                    >
                      {isDuplicating === persona.persona_id ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent md:mr-0 mr-2" />
                      ) : (
                        <Copy className="h-4 w-4 md:mr-0 mr-2" />
                      )}
                      <span className="md:hidden">
                        {isDuplicating === persona.persona_id
                          ? "Duplicating..."
                          : "Duplicate"}
                      </span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Duplicate</TooltipContent>
                </Tooltip>
              )}
              {persona.can_delete && persona.persona_id && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (persona.persona_id) {
                          handleDeleteClick(
                            persona.persona_id,
                            persona.name || "Unnamed Persona"
                          );
                        }
                      }}
                      aria-label={`Delete persona ${persona.name || "Unnamed"}`}
                      data-testid="btn-delete-persona"
                      data-action-button
                      className="h-9 px-3"
                    >
                      <Trash2 className="h-4 w-4 md:mr-0 mr-2" />
                      <span className="md:hidden">Delete</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Delete</TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0 flex-grow flex flex-col justify-end">
          {columnVisibility.card_description !== false && (
            <p className="text-sm text-muted-foreground line-clamp-2 flex-grow">
              {persona.description || "No description available"}
            </p>
          )}
          {(columnVisibility.num_scenarios !== false || columnVisibility.num_profiles !== false) && (
            <div className="flex items-center gap-1.5 mt-3 text-xs text-muted-foreground">
              {columnVisibility.num_scenarios !== false && (
                <span className="flex items-center gap-1">
                  <Eye className="h-3 w-3" />
                  {persona.num_scenarios} {persona.num_scenarios === 1 ? "scenario" : "scenarios"}
                </span>
              )}
              {columnVisibility.num_scenarios !== false && columnVisibility.num_profiles !== false && (
                <span className="text-muted-foreground">&middot;</span>
              )}
              {columnVisibility.num_profiles !== false && (
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {persona.num_profiles ?? 0} {persona.num_profiles === 1 ? "profile" : "profiles"}
                </span>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  // Get column references for toolbar
  const scenarioColumn = table.getColumn("scenarios");
  const fieldColumn = table.getColumn("fieldIds");
  const departmentsColumn = table.getColumn("departments");
  const isFiltered =
    table.getState().columnFilters.length > 0 ||
    searchTerm.length > 0;

  return (
    <TooltipProvider>
      <div className="space-y-8" data-page="personas-index">
        <div className="space-y-4">
        {/* Toolbar — swaps between filter bar and selection action bar */}
        {selectedCount > 0 ? (
          <div
            className="flex items-center justify-between gap-2"
            data-testid="personas-toolbar"
          >
            <div className="flex items-center gap-2">
              {deletePersonaAction && (
                <Button
                  variant="destructive"
                  size="sm"
                  className="h-8"
                  onClick={() => setShowBulkDeleteDialog(true)}
                  disabled={deletablePersonas.length === 0}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete {deletablePersonas.length} of {selectedCount}
                </Button>
              )}
              {savePersonaAction && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={openBulkEditDialog}
                  disabled={editablePersonas.length === 0}
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit {editablePersonas.length} of {selectedCount}
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
            <DataTableViewOptions table={table} hiddenColumns={["name", "description", "scenarios", "fieldIds", "departments", "updated_at"]} />
          </div>
        ) : (
          <div
            className="flex flex-col md:flex-row md:items-center md:justify-between gap-2"
            data-testid="personas-toolbar"
          >
            <div className="flex flex-col md:flex-row md:flex-1 md:items-center md:space-x-2 gap-2 md:gap-0">
              <div className="w-full md:w-auto">
                <Input
                  data-testid="personas-search"
                  placeholder="Search personas..."
                  value={searchTerm}
                  onChange={(event) => handleSearchChange(event.target.value)}
                  onBlur={handleSearchBlur}
                  onKeyDown={handleSearchKeyDown}
                  className="h-8 w-full md:w-[150px] lg:w-[250px]"
                  aria-label="Search personas by name"
                  aria-controls="personas-grid"
                />
              </div>

              <div className="flex items-center space-x-2 flex-wrap">
                {/* Scenario Filter */}
                <DataTableFacetedFilter
                  column={scenarioColumn}
                  title="Scenario"
                  options={scenarioOptions}
                  isServerDriven={true}
                  onSearchChange={handleScenarioSearchChange}
                  searchValue={localScenarioSearch}
                />

                {/* Field Filter */}
                <DataTableFacetedFilter
                  column={fieldColumn}
                  title="Field"
                  options={fieldOptions}
                  isServerDriven={true}
                  onSearchChange={handleFieldSearchChange}
                  searchValue={localFieldSearch}
                />

                {/* Department Filter */}
                <DataTableFacetedFilter
                  column={departmentsColumn}
                  title="Department"
                  options={departmentOptions}
                  isServerDriven={true}
                  onSearchChange={handleDepartmentSearchChange}
                  searchValue={localDepartmentSearch}
                />

                {isFiltered && (
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setSearchTerm("");
                      setLocalScenarioSearch("");
                      setLocalFieldSearch("");
                      setLocalDepartmentSearch("");
                      table.resetColumnFilters();
                      updatePersonasParams({
                        page: 0,
                        search: "",
                        scenarioIds: [],
                        fieldIds: [],
                        departmentIds: [],
                        scenarioSearch: "",
                        fieldSearch: "",
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
              <DataTableViewOptions table={table} hiddenColumns={["name", "description", "scenarios", "fieldIds", "departments", "updated_at"]} />
            </div>
          </div>
        )}

        {/* Cards Grid */}
        <div
          className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
          role="grid"
          aria-label="personas grid"
          data-testid="personas-grid"
        >
          {tableRows.length ? (
            tableRows.map((row) => {
              const persona = row.original;
              const key = persona.persona_id || `persona-${row.id}`;
              return <div key={key}>{renderPersonaCard(persona)}</div>;
            })
          ) : (
            <div className="col-span-full text-center py-8 text-muted-foreground">
              No personas match the current filters.
            </div>
          )}
        </div>

        {/* Pagination */}
        <div aria-label="pagination controls">
          <DataTablePagination table={table} card={true} />
        </div>
      </div>

      {/* Single Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent
          aria-labelledby="delete-persona-title"
          data-testid="dialog-delete-persona"
        >
          <AlertDialogHeader>
            <AlertDialogTitle id="delete-persona-title">
              Delete Persona
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the persona "{deleteItem?.name}
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
          aria-labelledby="bulk-delete-persona-title"
          data-testid="dialog-bulk-delete-persona"
        >
          <AlertDialogHeader>
            <AlertDialogTitle id="bulk-delete-persona-title">
              Delete {deletablePersonas.length} Persona(s)
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>This action cannot be undone.</p>
                {deletablePersonas.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-destructive mb-1">Will be deleted:</p>
                    <ul className="text-sm space-y-0.5">
                      {deletablePersonas.map((p) => (
                        <li key={p.persona_id} className="flex items-center gap-1.5">
                          <Trash2 className="h-3 w-3 text-destructive flex-shrink-0" />
                          {p.name || "Unnamed Persona"}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {nonDeletablePersonas.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-yellow-600 dark:text-yellow-500 mb-1">Cannot be deleted (in use by scenarios):</p>
                    <ul className="text-sm space-y-0.5">
                      {nonDeletablePersonas.map((p) => (
                        <li key={p.persona_id} className="flex items-center gap-1.5 text-muted-foreground">
                          <CheckCircle className="h-3 w-3 text-yellow-600 dark:text-yellow-500 flex-shrink-0" />
                          {p.name || "Unnamed Persona"}
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
              {isBulkDeleting ? "Deleting..." : `Delete ${deletablePersonas.length}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Edit Modal */}
      <Dialog open={showBulkEditDialog} onOpenChange={setShowBulkEditDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit {editablePersonas.length} Persona(s)</DialogTitle>
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

            {/* Color — GenericPicker single-select */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Color</Label>
              <GenericPicker
                items={colorOptions}
                selectedIds={bulkEditColorIds}
                onSelect={setBulkEditColorIds}
                getId={(c) => c.id}
                getLabel={(c) => c.name}
                placeholder="No change"
                showClearAction
                clearActionLabel="No change"
                searchPlaceholder="Search colors..."
                emptyMessage="No colors found."
                groupHeading="Colors"
                renderItem={(c, isSelected) => (
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2">
                      {c.hex_code && (
                        <span
                          className="inline-block h-3 w-3 rounded-full border flex-shrink-0"
                          style={{ backgroundColor: c.hex_code }}
                        />
                      )}
                      <span className="truncate">{c.name}</span>
                    </div>
                    <Check className={`ml-auto flex-shrink-0 h-4 w-4 ${isSelected ? "opacity-100" : "opacity-0"}`} />
                  </div>
                )}
              />
            </div>

            {/* Icon — GenericPicker single-select */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Icon</Label>
              <GenericPicker
                items={iconOptions}
                selectedIds={bulkEditIconIds}
                onSelect={setBulkEditIconIds}
                getId={(ic) => ic.id}
                getLabel={(ic) => ic.name}
                placeholder="No change"
                showClearAction
                clearActionLabel="No change"
                searchPlaceholder="Search icons..."
                emptyMessage="No icons found."
                groupHeading="Icons"
                renderItem={(ic, isSelected) => {
                  const Ic = getIconComponent(ic.value || ic.name) || Brain;
                  return (
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-2">
                        <Ic className="h-4 w-4 flex-shrink-0" />
                        <span className="truncate">{ic.name}</span>
                      </div>
                      <Check className={`ml-auto flex-shrink-0 h-4 w-4 ${isSelected ? "opacity-100" : "opacity-0"}`} />
                    </div>
                  );
                }}
              />
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

            {/* Voices — GenericPicker multi-select */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Voices</Label>
                {bulkEditVoiceIds !== null && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={() => setBulkEditVoiceIds(null)}
                  >
                    Reset
                  </Button>
                )}
              </div>
              {bulkEditVoiceIds === null ? (
                <Button
                  variant="outline"
                  className="w-full justify-start text-muted-foreground"
                  onClick={() => setBulkEditVoiceIds([])}
                >
                  No change — click to edit voices
                </Button>
              ) : (
                <GenericPicker
                  items={voiceOptions}
                  selectedIds={bulkEditVoiceIds}
                  onSelect={setBulkEditVoiceIds}
                  multiSelect
                  getId={(v) => v.id}
                  getLabel={(v) => v.voice}
                  placeholder="Select voices..."
                  showClearAction
                  clearActionLabel="Clear All"
                  searchPlaceholder="Search voices..."
                  emptyMessage="No voices found."
                  groupHeading="Voices"
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
          parseCsvAction={parseCsvAction}
          onSave={async (items) => {
            if (!savePersonaAction) throw new Error("Save action not available");
            const personas = items.map((item) => ({
              name: item.name as string | undefined,
              description: item.description as string | undefined,
              color: item.color as string | undefined,
              icon: item.icon as string | undefined,
              instructions: item.instructions as string | undefined,
              active_flag: item.active_flag as boolean | undefined,
              departments: item.departments as string[] | undefined,
              parameter_fields: item.parameter_fields as string[] | undefined,
              examples: item.examples as string[] | undefined,
              voices: item.voices as string[] | undefined,
            }));
            return savePersonaAction({ body: { personas } });
          }}
        />
      )}

      </div>
    </TooltipProvider>
  );
}
