/**
 * Scenarios.tsx
 * Used to display the scenarios page with table-based filtering and card layout.
 * @AshokSaravanan222 & @siladiea
 * 06/07/2025
 */
"use client";
import {
  ChevronDown,
  ChevronRight,
  Copy,
  Edit,
  Eye,
  Trash2,
  Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useProfile } from "@/contexts/profile-context";
import { useLogger } from "@/lib/api/v2/hooks/logs";
import {
  useDeleteScenario,
  useDuplicateScenario,
  useScenariosList,
} from "@/lib/api/v2/hooks/scenarios";
import { ScenarioItem } from "@/lib/api/v2/schemas/scenarios";
import { ColumnDef } from "@tanstack/react-table";
import { ScenariosDataTable } from "./ScenariosDataTable";

interface GroupedScenario {
  parent: ScenarioItem;
  children: ScenarioItem[];
}

export function Scenarios() {
  const router = useRouter();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteItem, setDeleteItem] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
    new Set()
  );
  const { effectiveProfile } = useProfile();
  const log = useLogger();
  // V2 API hooks - single fetch with all data
  const { data: scenariosData, isLoading } = useScenariosList(
    {
      profileId: effectiveProfile?.id || "",
    },
    { enabled: !!effectiveProfile?.id }
  );

  // Mutation hooks
  const duplicateScenarioMutation = useDuplicateScenario();
  const deleteScenarioMutation = useDeleteScenario();

  // Extract data from V2 response
  const scenarios = useMemo(
    () => scenariosData?.scenarios || [],
    [scenariosData?.scenarios]
  );
  const personaMapping = useMemo(
    () => scenariosData?.persona_mapping || {},
    [scenariosData?.persona_mapping]
  );
  const cohortMapping = useMemo(
    () => scenariosData?.cohort_mapping || {},
    [scenariosData?.cohort_mapping]
  );
  const simulationMapping = useMemo(
    () => scenariosData?.simulation_mapping || {},
    [scenariosData?.simulation_mapping]
  );
  const parameterItemMapping = useMemo(
    () => scenariosData?.parameter_item_mapping || {},
    [scenariosData?.parameter_item_mapping]
  );

  // Group scenarios using parent_scenario_id from V2 API
  const groupedScenarios = useMemo(() => {
    const groups: GroupedScenario[] = [];

    // Find root scenarios (no parent)
    const roots = scenarios.filter((s) => !s.parent_scenario_id);

    roots.forEach((parent) => {
      const children = scenarios.filter(
        (s) => s.parent_scenario_id === parent.scenario_id
      );
      groups.push({ parent, children });
    });

    return groups;
  }, [scenarios]);

  // Create filter options from mappings
  const personaOptions = useMemo(() => {
    return Object.entries(personaMapping).map(([id, obj]) => ({
      value: id,
      label: obj.name,
    }));
  }, [personaMapping]);

  const cohortOptions = useMemo(() => {
    return Object.entries(cohortMapping).map(([id, obj]) => ({
      value: id,
      label: obj.name,
    }));
  }, [cohortMapping]);

  const simulationOptions = useMemo(() => {
    return Object.entries(simulationMapping).map(([id, obj]) => ({
      value: id,
      label: obj.name,
    }));
  }, [simulationMapping]);

  // Define table columns inline
  const columns: ColumnDef<ScenarioItem>[] = useMemo(() => {
    return [
      {
        accessorKey: "title",
        header: "Title",
        cell: ({ row }) => {
          return (
            <div className="font-medium">
              {row.original.title || "Unnamed Scenario"}
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
      // Hidden faceting column for Cohorts (array of IDs)
      {
        id: "cohort_ids",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: ScenarioItem) => row.cohort_ids ?? [],
        filterFn: (row, _id, value: string[]) => {
          const rowIds = (row.getValue("cohort_ids") as string[]) ?? [];
          return value.some((v) => rowIds.includes(v));
        },
      },
      // Hidden faceting column for Persona (single ID)
      {
        id: "persona_id",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorKey: "persona_id",
      },
      // Hidden faceting column for Simulations (array of IDs)
      {
        id: "simulation_ids",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: ScenarioItem) => row.simulation_ids ?? [],
        filterFn: (row, _id, value: string[]) => {
          const rowIds = (row.getValue("simulation_ids") as string[]) ?? [];
          return value.some((v) => rowIds.includes(v));
        },
      },
      {
        accessorKey: "persona_id",
        header: "Persona",
        cell: ({ row }) => {
          const personaId = row.original.persona_id;
          return (
            <div className="text-sm">
              {personaId && personaMapping[personaId] ? (
                <span className="text-sm">
                  {personaMapping[personaId].name}
                </span>
              ) : (
                <span className="text-muted-foreground">No persona</span>
              )}
            </div>
          );
        },
      },
    ];
  }, [personaMapping]);

  // Permissions now come from server-side in V2 API
  // No need for client-side permission logic

  const handleDelete = async () => {
    if (!deleteItem) return;

    setIsDeleting(true);
    try {
      await deleteScenarioMutation.mutateAsync({ scenarioId: deleteItem.id });
      await log.info("scenario.delete.success", {
        message: "Scenario deleted successfully",
        subject: { entityType: "scenario", entityId: deleteItem.id },
        context: {
          component: "Scenarios",
          function: "handleDelete",
          name: deleteItem.name,
        },
      });
      toast.success("Scenario deleted successfully");
    } catch (error) {
      await log.error("scenario.delete.failed", {
        message: "Error deleting scenario",
        subject: { entityType: "scenario", entityId: deleteItem?.id },
        context: { component: "Scenarios", function: "handleDelete" },
        error,
      });
      toast.error("Failed to delete scenario");
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
      setDeleteItem(null);
    }
  };

  const handleDuplicate = async (scenarioId: string, scenarioName: string) => {
    setIsDuplicating(scenarioId);
    try {
      await duplicateScenarioMutation.mutateAsync({ scenarioId });
      await log.info("scenario.duplicate.success", {
        message: "Scenario duplicated successfully",
        subject: { entityType: "scenario", entityId: scenarioId },
        context: {
          component: "Scenarios",
          function: "handleDuplicate",
          originalName: scenarioName,
        },
      });
      toast.success(`Scenario "${scenarioName}" duplicated successfully`);
    } catch (error) {
      await log.error("scenario.duplicate.failed", {
        message: "Error duplicating scenario",
        subject: { entityType: "scenario", entityId: scenarioId },
        context: {
          component: "Scenarios",
          function: "handleDuplicate",
          originalName: scenarioName,
        },
        error,
      });
      toast.error("Failed to duplicate scenario");
    } finally {
      setIsDuplicating(null);
    }
  };

  const handleDeleteClick = (id: string, name: string) => {
    setDeleteItem({ id, name });
    setShowDeleteDialog(true);
  };

  const handleEdit = (id: string) => {
    router.push(`/create/scenarios/s/${id}`);
  };

  const handleView = (id: string) => {
    router.push(`/create/scenarios/s/${id}`);
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

  const renderScenarioCard = (
    scenario: ScenarioItem,
    isChild: boolean = false,
    showDropdown?: boolean,
    isCollapsed?: boolean,
    onToggleCollapse?: () => void
  ) => (
    <Card
      key={scenario.scenario_id}
      className={`hover:shadow-md transition-shadow flex flex-col h-full ${
        isChild ? "ml-8 border-l-2 border-l-blue-200" : ""
      }`}
    >
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div className="space-y-2 flex-1">
            <div className="flex items-center gap-2">
              {showDropdown && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 hover:bg-muted flex-shrink-0 -ml-1"
                  onClick={onToggleCollapse}
                >
                  {isCollapsed ? (
                    <ChevronRight className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              )}
              <CardTitle className="text-lg flex-1 min-w-0">
                {scenario.title || "Unnamed Scenario"}
              </CardTitle>
              <div className="flex gap-1 flex-wrap flex-shrink-0">
                {!scenario.generated &&
                  !(scenario.department_ids?.length === 0) &&
                  !scenario.active && (
                    <Badge variant="secondary">Inactive</Badge>
                  )}
              </div>
            </div>
          </div>
          <div className="flex gap-2 items-center ml-4">
            {scenario.generated ? (
              // For generated scenarios: only show preview and duplicate
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleView(scenario.scenario_id)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>View Scenario Details</p>
                  </TooltipContent>
                </Tooltip>
                {scenario.can_duplicate && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      handleDuplicate(scenario.scenario_id, scenario.title)
                    }
                    disabled={
                      isDuplicating === scenario.scenario_id ||
                      duplicateScenarioMutation.isPending
                    }
                  >
                    <Copy className="h-4 w-4" />
                    {isDuplicating === scenario.scenario_id ? "..." : ""}
                  </Button>
                )}
              </>
            ) : (
              // For non-generated scenarios: show edit, duplicate, and delete
              <>
                {scenario.can_edit ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(scenario.scenario_id)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                ) : (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleView(scenario.scenario_id)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>View Scenario Details</p>
                    </TooltipContent>
                  </Tooltip>
                )}
                {scenario.can_duplicate && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      handleDuplicate(scenario.scenario_id, scenario.title)
                    }
                    disabled={
                      isDuplicating === scenario.scenario_id ||
                      duplicateScenarioMutation.isPending
                    }
                  >
                    <Copy className="h-4 w-4" />
                    {isDuplicating === scenario.scenario_id ? "..." : ""}
                  </Button>
                )}

                {scenario.can_delete && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      handleDeleteClick(
                        scenario.scenario_id,
                        scenario.title || "Unnamed Scenario"
                      )
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 flex-grow flex flex-col justify-end">
        <p className="text-sm text-muted-foreground line-clamp-2">
          {scenario.problem_statement ||
            "Scenario will be dynamically generated."}
        </p>
        {!isChild && (
          <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
            <Users className="h-3 w-3" />
            {scenario.num_simulations} simulations
          </div>
        )}
      </CardContent>
    </Card>
  );

  const renderGroupedScenarios = (filteredGroups?: GroupedScenario[]) => {
    const groupsToRender = filteredGroups || groupedScenarios;

    return groupsToRender.map((group) => {
      const isCollapsed = collapsedGroups.has(group.parent.scenario_id);
      const hasChildren = group.children.length > 0;

      return (
        <div key={group.parent.scenario_id} className="space-y-2">
          {/* Parent Scenario Card */}
          {renderScenarioCard(
            group.parent,
            false,
            hasChildren,
            isCollapsed,
            () => toggleGroupCollapse(group.parent.scenario_id)
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
          </div>
        </div>

        {/* Grouped scenarios skeleton - using space-y like the actual layout */}
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <Card
              key={i}
              className="hover:shadow-md transition-shadow flex flex-col h-full"
            >
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-6 w-3/4" />
                    </div>
                  </div>
                  <div className="flex gap-2 items-center ml-4">
                    <Skeleton className="h-9 w-9" />
                    <Skeleton className="h-9 w-9" />
                    <Skeleton className="h-9 w-9" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0 flex-grow flex flex-col justify-end">
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-2/3 mb-3" />
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
      <div className="space-y-6">
        <ScenariosDataTable
          columns={columns}
          data={scenarios}
          personaMapping={personaMapping}
          cohortMapping={cohortMapping}
          simulationMapping={simulationMapping}
          parameterItemMapping={parameterItemMapping}
          personaOptions={personaOptions}
          cohortOptions={cohortOptions}
          simulationOptions={simulationOptions}
          renderGroupedScenarios={renderGroupedScenarios}
        />

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Scenario</AlertDialogTitle>
              <AlertDialogDescription>
                <p>
                  Are you sure you want to delete the scenario "
                  {deleteItem?.name}
                  "? This action cannot be undone.
                </p>
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
