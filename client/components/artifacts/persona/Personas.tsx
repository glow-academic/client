/**
 * Personas.tsx
 * Used to display the personas page with server-side filtering.
 * @AshokSaravanan222 & @siladiea
 * 06/07/2025
 */
"use client";
import { Brain, Copy, Edit, Eye, Trash2, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { getPersonaIconComponent } from "@/utils/persona-icons";
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
  PersonasListOut,
} from "@/app/(main)/training/personas/page";
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { GenerateRegenerateModal, type GenerateRegenerateModalResource } from "@/components/common/forms/GenerateRegenerateModal";
import { useProfile } from "@/contexts/profile-context";

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
  pageIndex,
  pageSize,
  totalCount,
  scenarioSearch,
  fieldSearch,
  departmentSearch,
}: PersonasProps) {
  const { profile, socket, isConnected } = useProfile();
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

  // Generation modal state
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [modalResources, setModalResources] = useState<GenerateRegenerateModalResource[]>([]);
  const [modalInstructions, setModalInstructions] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  // Handle opening the generate modal
  const handleOpenGenerateModal = useCallback(() => {
    const resources: GenerateRegenerateModalResource[] = [
      { id: "names", label: "Name", active: true },
      { id: "descriptions", label: "Description", active: true },
      { id: "colors", label: "Color", active: true },
      { id: "icons", label: "Icon", active: true },
      { id: "instructions", label: "Instructions", active: true },
      { id: "flags", label: "Configuration", active: true },
      { id: "examples", label: "Examples", active: true },
      { id: "fields", label: "Fields", active: true },
      { id: "departments", label: "Departments", active: true },
    ];
    setModalResources(resources);
    setModalInstructions("");
    setShowGenerateModal(true);
  }, []);

  // Listen for full-page-generate event
  useEffect(() => {
    const handleFullPageGenerate = () => {
      handleOpenGenerateModal();
    };
    window.addEventListener("full-page-generate", handleFullPageGenerate);
    return () =>
      window.removeEventListener("full-page-generate", handleFullPageGenerate);
  }, [handleOpenGenerateModal]);

  // Handle modal generate (create new persona + generate)
  const handleModalGenerate = useCallback(
    async (selectedResources: string[], instructions: string) => {
      if (!socket || !isConnected) return;
      setIsGenerating(true);
      socket.emit("persona_generate", {
        resource_types: selectedResources,
        user_instructions: instructions.trim() ? [instructions.trim()] : null,
        persona_id: null,
        mcp: false,
      });
      setShowGenerateModal(false);
      setIsGenerating(false);
      toast.success("Generation started for new persona");
    },
    [socket, isConnected]
  );

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

  // Derive options from full arrays (server returns filtered options based on search)
  const scenarioOptions = useMemo(() => {
    const scenarios = personasData?.scenarios || [];
    return scenarios
      .map((item) => ({
        value: String(item.scenario_id || ""),
        label: item.name || "",
        count: typeof item.count === "number" ? item.count : undefined,
      }))
      .filter((opt) => opt.value && opt.label);
  }, [personasData?.scenarios]);

  const fieldOptions = useMemo(() => {
    const fields = personasData?.fields || [];
    return fields
      .map((item) => ({
        value: String(item.field_id || ""),
        label: item.name || "",
        count: typeof item.count === "number" ? item.count : undefined,
      }))
      .filter((opt) => opt.value && opt.label);
  }, [personasData?.fields]);

  const departmentOptions = useMemo(() => {
    const departments = personasData?.departments || [];
    return departments
      .map((item) => ({
        value: String(item.department_id || ""),
        label: item.name || "",
        count: typeof item.count === "number" ? item.count : undefined,
      }))
      .filter((opt) => opt.value && opt.label);
  }, [personasData?.departments]);

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
          persona_id: deleteItem.id,
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
    const IconComponent = getPersonaIconComponent(persona.icon || "") || Brain;

    // Use the hex color directly with CSS custom properties
    const hexColor = persona.color || "#64748b"; // Default to slate if no color

    // Generate gradient from hex color
    const gradientStyle = generateGradientFromHex(hexColor);

    // Always use white icon for consistency with gradient backgrounds
    const iconColor = "#ffffff";

    return (
      <Card
        className="relative flex flex-col h-full hover:shadow-md transition-shadow"
        data-testid="persona-card"
        data-persona-id={persona.persona_id}
        role="gridcell"
        aria-label={`persona card ${persona.name || "Unnamed Persona"}`}
      >
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div className="space-y-2 flex-1 min-w-0">
              <div className="flex items-center gap-2">
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
              {persona.is_inactive && (
                <div className="mt-1">
                  <Badge variant="secondary">Inactive</Badge>
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2 items-center">
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
          <p className="text-sm text-muted-foreground line-clamp-2 flex-grow">
            {persona.description || "No description available"}
          </p>
          <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
            <Eye className="h-3 w-3" />
            {persona.num_scenarios} scenarios
          </div>
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
        {/* Toolbar */}
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
        </div>

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

      {/* Delete Confirmation Dialog */}
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

      <GenerateRegenerateModal
        open={showGenerateModal}
        onOpenChange={setShowGenerateModal}
        resources={modalResources}
        onResourcesChange={setModalResources}
        instructions={modalInstructions}
        onInstructionsChange={setModalInstructions}
        onGenerate={handleModalGenerate}
        isGenerating={isGenerating}
        mode="generate"
      />
      </div>
    </TooltipProvider>
  );
}
