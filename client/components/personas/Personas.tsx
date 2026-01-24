/**
 * Personas.tsx
 * Used to display the personas page.
 * @AshokSaravanan222 & @siladiea
 * 06/07/2025
 */
"use client";
import { Brain, Copy, Edit, Eye, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { getPersonaIconComponent } from "@/utils/persona-icons";
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";

import type {
  DeletePersonaIn,
  DeletePersonaOut,
  DuplicatePersonaIn,
  DuplicatePersonaOut,
  PersonasListOut,
} from "@/app/(main)/create/personas/page";
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
}

export default function Personas({
  listData: serverListData,
  duplicatePersonaAction,
  deletePersonaAction,
}: PersonasProps) {
  const { departmentIds, effectiveProfile } = useProfile();
  const router = useRouter();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteItem, setDeleteItem] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState<string | null>(null);

  // Table state
  const [rowSelection, setRowSelection] = useState({});
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = useState<SortingState>([
    { id: "updated_at", desc: true },
  ]);

  // Memoize personas data to prevent infinite re-renders
  const personasData = serverListData;

  // Extract personas array - use useMemo with stable dependency
  // The key insight: serverListData.personas should be a stable reference from Next.js
  // If it changes, we want to update, so we depend on it directly
  const personas = useMemo(() => {
    return personasData?.personas || [];
  }, [personasData?.personas]);

  // Derive options from full arrays (server always returns arrays)
  const scenarioOptions = useMemo(() => {
    const scenarios = personasData?.scenarios || [];
    return scenarios
      .map((item) => ({
        value: String(item.scenario_id || ""),
        label: item.name || "",
      }))
      .filter((opt) => opt.value && opt.label);
  }, [personasData?.scenarios]);

  const agentOptions = useMemo(() => {
    const agents = personasData?.agents || [];
    return agents
      .map((item) => ({
        value: String(item.agent_id || ""),
        label: item.name || "",
      }))
      .filter((opt) => opt.value && opt.label);
  }, [personasData?.agents]);

  const departmentOptions = useMemo(() => {
    const departments = personasData?.departments || [];
    return departments
      .map((item) => ({
        value: String(item.department_id || ""),
        label: item.name || "",
      }))
      .filter((opt) => opt.value && opt.label);
  }, [personasData?.departments]);

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
        // Return the array of scenario IDs for this row
        accessorFn: (row: (typeof personas)[number]) => row.scenario_ids ?? [],
        // Let filtering check membership - show if persona is used in ANY selected scenario
        filterFn: (row, _id, value: string[]) => {
          const rowIds = (row.getValue("scenarios") as string[]) ?? [];
          return value.some((v) => rowIds.includes(v));
        },
      },
      {
        accessorKey: "reasoning",
        header: "Reasoning",
        cell: ({ row }) => {
          const persona = row.original;
          return (
            <div className="text-sm">
              {persona.reasoning ? (
                <span className="capitalize">{persona.reasoning}</span>
              ) : (
                <span className="text-muted-foreground">None</span>
              )}
            </div>
          );
        },
      },
      // Display column for Temperature - shows actual value
      {
        id: "temperature_display",
        accessorKey: "temperature",
        header: "Temperature",
        cell: ({ row }) => {
          const persona = row.original;
          // Use server-provided temperature_display
          return <div className="text-sm">{persona.temperature_display}</div>;
        },
      },
      // Hidden faceting column for Model (single ID) with correct ID
      {
        id: "agentId",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorKey: "agent_id",
      },
      {
        accessorKey: "agent_id",
        header: "Agent",
        cell: ({ row }) => {
          const persona = row.original;
          // Use server-provided agent_name
          return (
            <div className="text-sm">
              {persona.agent_name ? (
                <span className="text-sm">{persona.agent_name}</span>
              ) : (
                <span className="text-muted-foreground">No agent</span>
              )}
            </div>
          );
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
          if (rowIds.length === 0) return true; // Show cross-department items when no filter
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

  // Create table instance
  const table = useReactTable({
    data: personas,
    columns,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
      columnFilters,
    },
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    initialState: {
      pagination: {
        pageSize: 12,
      },
    },
  });

  // Memoize table rows to avoid calling getRowModel() multiple times and prevent re-render issues
  // Extract pagination primitives directly to avoid object reference issues
  const pageIndex = table.getState().pagination.pageIndex;
  const pageSize = table.getState().pagination.pageSize;
  // Stringify arrays for stable comparison (arrays are compared by reference)
  const sortingKey = JSON.stringify(sorting);
  const columnFiltersKey = JSON.stringify(columnFilters);
  const tableRows = useMemo(() => {
    return table.getRowModel().rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    // Use JSON.stringify for arrays to ensure stable comparison (arrays are compared by reference)
    sortingKey,
    columnFiltersKey,
    personas.length,
    // Use pagination primitives directly (not object references)
    pageIndex,
    pageSize,
  ]);

  // Permissions now come from server-side in V2 API
  // No need for client-side permission logic

  const handleDelete = async () => {
    if (!deleteItem || !deletePersonaAction) return;

    // Ensure profileId exists - required for API calls
    if (!effectiveProfile?.id) {
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
      // profileId comes from X-Profile-Id header automatically
      toast.success("Persona deleted successfully");
      // Refresh page to get updated data
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

    // Ensure profileId exists - required for API calls
    if (!effectiveProfile?.id) {
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
      // profileId comes from X-Profile-Id header automatically
      toast.success(`Persona "${personaName}" duplicated successfully`);
      // Refresh page to get updated data
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
    router.push(`/create/personas/p/${id}`);
  };

  const handleView = (id: string) => {
    router.push(`/create/personas/p/${id}`);
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
        className="hover:shadow-md transition-shadow"
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
              <div className="mt-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  {persona.reasoning && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge
                          variant="outline"
                          className="text-xs cursor-help"
                        >
                          <Brain className="h-3 w-3 mr-1" />
                          {persona.reasoning}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Reasoning Level</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
                {persona.is_inactive && (
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">Inactive</Badge>
                  </div>
                )}
              </div>
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
        <CardContent className="pt-0 flex-grow flex flex-col">
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
  const nameColumn = table.getColumn("name");
  const agentColumn = table.getColumn("agentId");
  const scenarioColumn = table.getColumn("scenarios");
  const departmentsColumn = table.getColumn("departments");
  const isFiltered = table.getState().columnFilters.length > 0;

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
                value={(nameColumn?.getFilterValue() as string) ?? ""}
                onChange={(event) =>
                  nameColumn?.setFilterValue(event.target.value)
                }
                className="h-8 w-full md:w-[150px] lg:w-[250px]"
                aria-label="Search personas by name"
                aria-controls="personas-grid"
              />
            </div>

            <div className="flex items-center space-x-2 flex-wrap">
              {/* Scenario Filter */}
              {scenarioColumn && (
                <DataTableFacetedFilter
                  column={scenarioColumn}
                  title="Scenario"
                  options={scenarioOptions}
                />
              )}

              {/* Agent Filter */}
              {agentColumn && (
                <DataTableFacetedFilter
                  column={agentColumn}
                  title="Agent"
                  options={agentOptions}
                />
              )}

              {/* Department Filter */}
              {departmentsColumn && (
                <DataTableFacetedFilter
                  column={departmentsColumn}
                  title="Department"
                  options={departmentOptions}
                />
              )}

              {isFiltered && (
                <Button
                  variant="ghost"
                  onClick={() => table.resetColumnFilters()}
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
              // Ensure unique key - use persona_id, fallback to index if missing
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
      </div>
    </TooltipProvider>
  );
}
