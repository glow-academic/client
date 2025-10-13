/**
 * Scenarios.tsx
 * Used to display the scenarios page with table-based filtering and card layout.
 * @AshokSaravanan222 & @siladiea
 * 06/07/2025
 */
"use client";
import { log } from "@/utils/logger";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useDepartments } from "@/contexts/departments-context";
import { useScenarioColumns } from "@/hooks/use-scenario-columns";
import { useParameterItems } from "@/lib/api/v1/hooks/parameter_items";
import { useParametersByDepartmentIdBatch } from "@/lib/api/v1/hooks/parameters";
import { useScenarioTrees } from "@/lib/api/v1/hooks/scenario_tree";
import {
  useCreateScenario,
  useDeleteScenario,
  useScenariosByDepartmentIdBatch,
} from "@/lib/api/v1/hooks/scenarios";
import { useSimulationScenarios } from "@/lib/api/v1/hooks/simulation_scenarios";
import { useSimulationsByDepartmentIdBatch } from "@/lib/api/v1/hooks/simulations";
import type { ScenarioTree } from "@/lib/repos/scenarioTreeRepo";
import { Scenario } from "@/types";
import { ScenariosDataTable } from "./ScenariosDataTable";

interface GroupedScenario {
  parent: Scenario;
  children: Scenario[];
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
  const { effectiveDepartmentIds } = useDepartments();

  // Mutation hooks
  const createScenarioMutation = useCreateScenario();
  const deleteScenarioMutation = useDeleteScenario();

  const { data: scenarios = [] } = useScenariosByDepartmentIdBatch(
    effectiveDepartmentIds
  );
  const { data: treeEdges = [] } = useScenarioTrees();
  const { data: allSimulationScenarios = [] } = useSimulationScenarios();
  const { data: _simulations = [] } = useSimulationsByDepartmentIdBatch(
    effectiveDepartmentIds
  );
  const { data: _parameters = [] } = useParametersByDepartmentIdBatch(
    effectiveDepartmentIds
  );
  const { data: _parameterItems = [] } = useParameterItems();

  // Group scenarios using scenario_tree junction table
  const groupedScenarios = useMemo(() => {
    const groups: GroupedScenario[] = [];

    // Find root scenarios (self-edges in scenario_tree where parent_id === child_id)
    const rootScenarioIds = treeEdges
      .filter((edge: ScenarioTree) => edge.parentId === edge.childId)
      .map((edge: ScenarioTree) => edge.childId);

    // Build groups for each root
    rootScenarioIds.forEach((rootId: string) => {
      const parentScenario = scenarios.find((s) => s.id === rootId);
      if (!parentScenario) return;

      // Find children (edges where parent is this root but not self-edge)
      const childrenIds = treeEdges
        .filter(
          (edge: ScenarioTree) =>
            edge.parentId === rootId && edge.parentId !== edge.childId
        )
        .map((edge: ScenarioTree) => edge.childId);

      const children = scenarios.filter((s) => childrenIds.includes(s.id));

      groups.push({
        parent: parentScenario,
        children: children,
      });
    });

    // Add standalone scenarios that aren't in the tree at all
    const scenariosInTree = new Set([
      ...treeEdges.map((e: ScenarioTree) => e.parentId),
      ...treeEdges.map((e: ScenarioTree) => e.childId),
    ]);

    scenarios.forEach((scenario) => {
      if (!scenariosInTree.has(scenario.id)) {
        groups.push({ parent: scenario, children: [] });
      }
    });

    return groups;
  }, [scenarios, treeEdges]);

  // Check if a scenario is being used by any simulations via junction table
  const isScenarioInUse = (scenarioId: string) => {
    return allSimulationScenarios.some((ss) => ss.scenarioId === scenarioId);
  };

  // Check if user can edit (fully immutable)
  const canEditScenario = (scenarioId: string) => {
    return !isScenarioInUse(scenarioId);
  };

  // Check if scenario can be deleted (default scenarios cannot be deleted)
  const canDeleteScenario = (scenario: Scenario) => {
    return !scenario.defaultScenario && !isScenarioInUse(scenario.id);
  };

  // Get table columns and filter options
  const { columns, simulationOptions, cohortOptions, personaOptions } =
    useScenarioColumns();

  const handleDelete = async () => {
    if (!deleteItem) return;

    setIsDeleting(true);
    try {
      await deleteScenarioMutation.mutateAsync(deleteItem.id);
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

  const handleDuplicate = async (scenario: Scenario) => {
    setIsDuplicating(scenario.id);
    try {
      await createScenarioMutation.mutateAsync({
        ...scenario,
        id: undefined,
        createdAt: undefined,
        updatedAt: undefined,
        defaultScenario: false,
        active: false,
        generated: false,
        name: `${scenario.name} Copy`,
      });
      await log.info("scenario.duplicate.success", {
        message: "Scenario duplicated successfully",
        subject: { entityType: "scenario", entityId: scenario.id },
        context: {
          component: "Scenarios",
          function: "handleDuplicate",
          originalName: scenario.name,
        },
      });
      toast.success(`Scenario "${scenario.name}" duplicated successfully`);
    } catch (error) {
      await log.error("scenario.duplicate.failed", {
        message: "Error duplicating scenario",
        subject: { entityType: "scenario", entityId: scenario.id },
        context: {
          component: "Scenarios",
          function: "handleDuplicate",
          originalName: scenario.name,
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

  // no-op

  const canDuplicate = (_scenario: Scenario) => {
    // Allow all scenarios to be duplicated for ease of use
    return true;
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

  // TODO: Add parameter badge display (load from scenario_parameter_items junction)

  const renderScenarioCard = (
    scenario: Scenario,
    isChild: boolean = false,
    showDropdown?: boolean,
    isCollapsed?: boolean,
    onToggleCollapse?: () => void
  ) => (
    <Card
      key={scenario.id}
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
                {scenario.name || "Unnamed Scenario"}
              </CardTitle>
              <div className="flex gap-1 flex-wrap flex-shrink-0">
                {/* Practice is now simulation-level only */}
                {!scenario.generated &&
                  !scenario.defaultScenario &&
                  !scenario.active && (
                    <Badge variant="secondary">Inactive</Badge>
                  )}
              </div>
            </div>
            {/* Parameter badges - TODO: Load from junction table */}
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
                      onClick={() => handleView(scenario.id)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>View Scenario Details</p>
                  </TooltipContent>
                </Tooltip>
                {canDuplicate(scenario) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDuplicate(scenario)}
                    disabled={
                      isDuplicating === scenario.id ||
                      createScenarioMutation.isPending
                    }
                  >
                    <Copy className="h-4 w-4" />
                    {isDuplicating === scenario.id ? "..." : ""}
                  </Button>
                )}
              </>
            ) : (
              // For non-generated scenarios: show edit, duplicate, and delete
              <>
                {canEditScenario(scenario.id) ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(scenario.id)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                ) : (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleView(scenario.id)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>View Scenario Details</p>
                    </TooltipContent>
                  </Tooltip>
                )}
                {canDuplicate(scenario) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDuplicate(scenario)}
                    disabled={
                      isDuplicating === scenario.id ||
                      createScenarioMutation.isPending
                    }
                  >
                    <Copy className="h-4 w-4" />
                    {isDuplicating === scenario.id ? "..." : ""}
                  </Button>
                )}

                {canDeleteScenario(scenario) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      handleDeleteClick(
                        scenario.id,
                        scenario.name || "Unnamed Scenario"
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
          {scenario.problemStatement ||
            "Scenario will be dynamically generated."}
        </p>
        {!isChild && (
          <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
            <Users className="h-3 w-3" />
            {
              allSimulationScenarios.filter(
                (ss) => ss.scenarioId === scenario.id
              ).length
            }{" "}
            simulations
          </div>
        )}
      </CardContent>
    </Card>
  );

  const renderGroupedScenarios = (filteredGroups?: GroupedScenario[]) => {
    const groupsToRender = filteredGroups || groupedScenarios;

    return groupsToRender.map((group) => {
      const isCollapsed = collapsedGroups.has(group.parent.id);
      const hasChildren = group.children.length > 0;

      return (
        <div key={group.parent.id} className="space-y-2">
          {/* Parent Scenario Card */}
          {renderScenarioCard(
            group.parent,
            false,
            hasChildren,
            isCollapsed,
            () => toggleGroupCollapse(group.parent.id)
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

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <ScenariosDataTable
          columns={columns}
          data={scenarios}
          simulationOptions={simulationOptions}
          cohortOptions={cohortOptions}
          personaOptions={personaOptions}
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
