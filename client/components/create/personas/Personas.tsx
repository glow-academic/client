/**
 * Personas.tsx
 * Used to display the personas page.
 * @AshokSaravanan222 & @siladiea
 * 06/07/2025
 */
"use client";
import { Brain, Copy, Edit, Eye, Thermometer, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { api } from "@/lib/api/client";
import { PersonaItem } from "@/lib/api/v2/schemas/personas";
import { keys } from "@/lib/query/keys";
import { getPersonaIconComponent } from "@/utils/persona-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";

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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useProfile } from "@/contexts/profile-context";
import { PersonasDataTable } from "./PersonasDataTable";

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

export default function Personas() {
  const router = useRouter();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteItem, setDeleteItem] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState<string | null>(null);
  const { effectiveProfile } = useProfile();
  const qc = useQueryClient();

  // V3 API - Proof of Concept with generated keys
  const filters = { profileId: effectiveProfile?.id || "" };
  const { data: personasData, isLoading } = useQuery({
    queryKey: keys.personas.with(filters),
    queryFn: () => api.post("/personas/list", { body: filters }),
    enabled: !!effectiveProfile?.id,
  });

  // Duplicate mutation with v3 API
  const duplicatePersonaMutation = useMutation({
    mutationFn: (req: { personaId: string }) =>
      api.post("/personas/duplicate", { body: req }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.personas.all });
    },
  });

  // Delete mutation with v3 API
  const deletePersonaMutation = useMutation({
    mutationFn: (req: { personaId: string }) =>
      api.post("/personas/delete", { body: req }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.personas.all });
    },
  });

  // Extract data from V2 response
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
  const columns: ColumnDef<PersonaItem>[] = useMemo(() => {
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
        accessorFn: (row: PersonaItem) => row.scenario_ids ?? [],
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
        accessorFn: (row: PersonaItem) => getTemperatureRange(row.temperature),
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
        accessorFn: (row: PersonaItem) => row.department_ids ?? [],
        filterFn: (row, _id, value: string[]) => {
          const rowIds = (row.getValue("departments") as string[]) ?? [];
          if (value.length === 0) return true;
          if (rowIds.length === 0) return true; // Show cross-department items when no filter
          return value.some((v) => rowIds.includes(v));
        },
      },
    ];
  }, [modelMapping]);

  // Permissions now come from server-side in V2 API
  // No need for client-side permission logic

  const handleDelete = async () => {
    if (!deleteItem) return;

    setIsDeleting(true);
    try {
      await deletePersonaMutation.mutateAsync({ personaId: deleteItem.id });
      toast.success("Persona deleted successfully");
    } catch (error) {
      toast.error("Failed to delete persona");
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
      setDeleteItem(null);
    }
  };

  const handleDuplicate = async (personaId: string, personaName: string) => {
    setIsDuplicating(personaId);
    try {
      await duplicatePersonaMutation.mutateAsync({ personaId });
      toast.success(`Persona "${personaName}" duplicated successfully`);
    } catch (error) {
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
                  disabled={
                    isDuplicating === persona.persona_id ||
                    duplicatePersonaMutation.isPending
                  }
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

  return (
    <TooltipProvider>
      <div className="space-y-8">
        <PersonasDataTable
          columns={columns}
          data={personas}
          scenarioMapping={scenarioMapping}
          modelMapping={modelMapping}
          scenarioOptions={scenarioOptions}
          reasoningOptions={reasoningOptions}
          modelOptions={modelOptions}
          temperatureOptions={temperatureOptions}
          departmentOptions={departmentOptions}
          renderPersonaCard={renderPersonaCard}
        />

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
              <AlertDialogCancel
                disabled={isDeleting || deletePersonaMutation.isPending}
              >
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={isDeleting || deletePersonaMutation.isPending}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {isDeleting || deletePersonaMutation.isPending
                  ? "Deleting..."
                  : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
}
