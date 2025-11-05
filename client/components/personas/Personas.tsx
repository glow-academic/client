/**
 * Personas.tsx
 * Used to display the personas page.
 * @AshokSaravanan222 & @siladiea
 * 06/07/2025
 */
"use client";
import { Brain, Copy, Edit, Eye, Thermometer, Trash2, X } from "lucide-react";
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
import { DataTableFacetedFilter } from "@/components/common/history/DataTableFacetedFilter";
import { DataTablePagination } from "@/components/common/history/DataTablePagination";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
    { id: "updatedAt", desc: true },
  ]);

  // Use server-provided data directly
  const personasData = serverListData;
  const isLoading = false; // No loading when using server data

  // Extract data from response
  const personas = personasData?.personas || [];
  const scenarioMapping = useMemo(
    () => personasData?.scenario_mapping || {},
    [personasData?.scenario_mapping]
  );
  const modelMapping = useMemo(
    () => personasData?.model_mapping || {},
    [personasData?.model_mapping]
  );

  // Create filter options from mappings
  const scenarioOptions = useMemo(() => {
    const entries = Object.entries(scenarioMapping);

    // Count occurrences of each name to detect duplicates
    const nameCounts = new Map<string, number>();
    entries.forEach(([_, obj]) => {
      nameCounts.set(obj.name, (nameCounts.get(obj.name) || 0) + 1);
    });

    // Track how many times we've seen each duplicate name
    const nameIndices = new Map<string, number>();

    return entries.map(([id, obj]) => {
      const isDuplicate = (nameCounts.get(obj.name) || 0) > 1;

      if (isDuplicate) {
        // For duplicates, add a disambiguator using short ID
        const index = (nameIndices.get(obj.name) || 0) + 1;
        nameIndices.set(obj.name, index);

        // Use last 8 characters of UUID for disambiguation
        const shortId = id.slice(-8);
        return {
          value: id,
          label: `${obj.name} (${shortId})`,
        };
      }

      return {
        value: id,
        label: obj.name,
      };
    });
  }, [scenarioMapping]);

  const modelOptions = useMemo(() => {
    return Object.entries(modelMapping).map(([id, obj]) => ({
      value: id,
      label: obj.name,
    }));
  }, [modelMapping]);

  const reasoningOptions = useMemo(
    () => [
      { value: "none", label: "None" },
      { value: "minimal", label: "Minimal" },
      { value: "low", label: "Low" },
      { value: "medium", label: "Medium" },
      { value: "high", label: "High" },
    ],
    []
  );

  const temperatureOptions = useMemo(
    () => [
      { value: "low", label: "Low (0.0-0.33)" },
      { value: "medium", label: "Medium (0.34-0.66)" },
      { value: "high", label: "High (0.67-1.0)" },
    ],
    []
  );

  // Build department options from mapping
  const departmentMapping = useMemo(
    () =>
      (personasData?.department_mapping as Record<
        string,
        { name: string; description: string }
      >) || {},
    [personasData?.department_mapping]
  );

  const departmentOptions = useMemo(() => {
    return Object.entries(departmentMapping).map(([id, obj]) => ({
      value: id,
      label: obj?.name || id,
    }));
  }, [departmentMapping]);

  // Helper function to get temperature range
  const getTemperatureRange = (temperature: number) => {
    if (temperature <= 0.33) return "low";
    if (temperature <= 0.66) return "medium";
    return "high";
  };

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
      // Hidden faceting column for Temperature (categorical) - returns category for filtering
      {
        id: "temperature",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        // Return the temperature category for faceting and filtering
        accessorFn: (row: (typeof personas)[number]) =>
          getTemperatureRange(row.temperature),
      },
      // Display column for Temperature - shows actual value
      {
        id: "temperature_display",
        accessorKey: "temperature",
        header: "Temperature",
        cell: ({ row }) => {
          const persona = row.original;
          const temp = persona.temperature.toFixed(2);
          return <div className="text-sm">{temp}</div>;
        },
      },
      // Hidden faceting column for Model (single ID) with correct ID
      {
        id: "modelId",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorKey: "model_id",
      },
      {
        accessorKey: "model_id",
        header: "Model",
        cell: ({ row }) => {
          const persona = row.original;
          const modelName = modelMapping[persona.model_id];
          return (
            <div className="text-sm">
              {modelName ? (
                <span className="text-sm">{modelName.name}</span>
              ) : (
                <span className="text-muted-foreground">No model</span>
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
    ];
  }, [modelMapping]);

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

  // Permissions now come from server-side in V2 API
  // No need for client-side permission logic

  const handleDelete = async () => {
    if (!deleteItem || !deletePersonaAction) return;

    setIsDeleting(true);
    try {
      await deletePersonaAction({ body: { personaId: deleteItem.id } });
      toast.success("Persona deleted successfully");
      // Refresh page to get updated data
      router.refresh();
    } catch {
      toast.error("Failed to delete persona");
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
      setDeleteItem(null);
    }
  };

  const handleDuplicate = async (personaId: string, personaName: string) => {
    if (!duplicatePersonaAction) return;

    setIsDuplicating(personaId);
    try {
      await duplicatePersonaAction({ body: { personaId } });
      toast.success(`Persona "${personaName}" duplicated successfully`);
      // Refresh page to get updated data
      router.refresh();
    } catch {
      toast.error("Failed to duplicate persona");
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

  const formatTemperature = (temp: number) => {
    return temp.toFixed(2);
  };

  // no-op

  const renderPersonaCard = (persona: (typeof personas)[0]) => {
    // Get the icon component from the persona's stored icon name
    const IconComponent = getPersonaIconComponent(persona.icon) || Brain;

    // Use the hex color directly with CSS custom properties
    const hexColor = persona.color || "#64748b"; // Default to slate if no color

    // Generate gradient from hex color
    const gradientStyle = generateGradientFromHex(hexColor);

    // Always use white icon for consistency with gradient backgrounds
    const iconColor = "#ffffff";

    return (
      <Card
        key={persona.persona_id}
        className="hover:shadow-md transition-shadow"
      >
        <CardHeader>
          <div className="flex justify-between items-start">
            <div className="space-y-2 flex-1">
              <div className="flex items-center gap-2">
                <div
                  className="p-2 rounded-lg shadow-lg group-hover:scale-110 transition-transform duration-300"
                  style={{
                    background: gradientStyle,
                  }}
                >
                  <IconComponent
                    className="h-4 w-4"
                    style={{ color: iconColor }}
                  />
                </div>
                <CardTitle className="text-lg">
                  {persona.name || "Unnamed Persona"}
                </CardTitle>
              </div>
              <div className="mt-1 space-y-2">
                <div className="flex items-center gap-2">
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
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant="outline" className="text-xs cursor-help">
                        <Thermometer className="h-3 w-3 mr-1" />
                        {formatTemperature(persona.temperature)}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Randomness Level</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                {!persona.active && (
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">Inactive</Badge>
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-2 items-center">
              {persona.can_edit ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEdit(persona.persona_id)}
                >
                  <Edit className="h-4 w-4" />
                </Button>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleView(persona.persona_id)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>View Persona Details</p>
                  </TooltipContent>
                </Tooltip>
              )}
              {persona.can_duplicate && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    handleDuplicate(persona.persona_id, persona.name)
                  }
                  disabled={isDuplicating === persona.persona_id}
                >
                  <Copy className="h-4 w-4" />
                  {isDuplicating === persona.persona_id ? "..." : ""}
                </Button>
              )}
              {persona.can_delete && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    handleDeleteClick(
                      persona.persona_id,
                      persona.name || "Unnamed Persona"
                    )
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
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

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-4">
        {/* Toolbar skeleton */}
        <div className="flex items-center justify-between">
          <div className="flex flex-1 items-center space-x-2">
            <Skeleton className="h-8 w-[150px] lg:w-[250px]" />
            <Skeleton className="h-8 w-[120px]" />
            <Skeleton className="h-8 w-[120px]" />
            <Skeleton className="h-8 w-[120px]" />
            <Skeleton className="h-8 w-[120px]" />
          </div>
        </div>

        {/* Cards grid skeleton */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-8 w-8 rounded-lg" />
                      <Skeleton className="h-6 w-2/3" />
                    </div>
                    <div className="mt-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <Skeleton className="h-5 w-20" />
                        <Skeleton className="h-5 w-16" />
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 items-center">
                    <Skeleton className="h-9 w-9" />
                    <Skeleton className="h-9 w-9" />
                    <Skeleton className="h-9 w-9" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0 flex-grow flex flex-col">
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-3/4 mb-3" />
                <div className="flex items-center gap-2 mt-3">
                  <Skeleton className="h-3 w-24" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Pagination skeleton */}
        <div className="flex items-center justify-between px-2">
          <Skeleton className="h-8 w-[100px]" />
          <div className="flex items-center space-x-2">
            <Skeleton className="h-8 w-[70px]" />
            <Skeleton className="h-8 w-[70px]" />
          </div>
        </div>
      </div>
    );
  }

  // Get column references for toolbar
  const nameColumn = table.getColumn("name");
  const reasoningColumn = table.getColumn("reasoning");
  const modelColumn = table.getColumn("modelId");
  const temperatureColumn = table.getColumn("temperature");
  const scenarioColumn = table.getColumn("scenarios");
  const departmentsColumn = table.getColumn("departments");
  const isFiltered = table.getState().columnFilters.length > 0;

  return (
    <TooltipProvider>
      <div className="space-y-8">
        <div className="space-y-4">
          {/* Toolbar */}
          <div className="flex items-center justify-between">
            <div className="flex flex-1 items-center space-x-2 flex-wrap">
              <div className="mb-2">
                <Input
                  placeholder="Search personas..."
                  value={(nameColumn?.getFilterValue() as string) ?? ""}
                  onChange={(event) =>
                    nameColumn?.setFilterValue(event.target.value)
                  }
                  className="h-8 w-[150px] lg:w-[250px]"
                />
              </div>

              <div className="flex items-center space-x-2 flex-wrap mb-2">
                {/* Scenario Filter */}
                {scenarioColumn && scenarioOptions.length > 0 && (
                  <DataTableFacetedFilter
                    column={scenarioColumn}
                    title="Scenario"
                    options={scenarioOptions}
                  />
                )}

                {/* Reasoning Filter */}
                {reasoningColumn && reasoningOptions.length > 0 && (
                  <DataTableFacetedFilter
                    column={reasoningColumn}
                    title="Reasoning"
                    options={reasoningOptions}
                  />
                )}

                {/* Model Filter */}
                {modelColumn && modelOptions.length > 0 && (
                  <DataTableFacetedFilter
                    column={modelColumn}
                    title="Model"
                    options={modelOptions}
                  />
                )}

                {/* Temperature Filter */}
                {temperatureColumn && temperatureOptions.length > 0 && (
                  <DataTableFacetedFilter
                    column={temperatureColumn}
                    title="Temperature"
                    options={temperatureOptions}
                  />
                )}

                {/* Department Filter */}
                {departmentsColumn && departmentOptions.length > 0 && (
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
                    className="h-8 px-2 lg:px-3"
                  >
                    Reset
                    <X className="ml-2 h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Cards Grid */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {table.getRowModel().rows.length ? (
              table
                .getRowModel()
                .rows.map((row) => renderPersonaCard(row.original))
            ) : (
              <div className="col-span-full text-center py-8 text-muted-foreground">
                No personas match the current filters.
              </div>
            )}
          </div>

          {/* Pagination */}
          <DataTablePagination table={table} card={true} />
        </div>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Persona</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete the persona "{deleteItem?.name}
                "? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={isDeleting}
                className="bg-red-600 hover:bg-red-700 text-white"
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
