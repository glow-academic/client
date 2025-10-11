/**
 * Simulations.tsx
 * Used to display the simulations page with the new unified simulation playground.
 * @AshokSaravanan222 & @siladiea
 * 06/07/2025
 */
"use client";
import { log } from "@/utils/logger";
import { Copy, Edit, Eye, Timer, Trash2, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
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
import { useDepartments } from "@/contexts/departments-context";
import { useProfile } from "@/contexts/profile-context";
import { useSimulationColumns } from "@/hooks/use-simulation-columns";
import { useCohortsByDepartmentIdBatch } from "@/lib/api/hooks/cohorts";
import { useRubricsByDepartmentIdBatch } from "@/lib/api/hooks/rubrics";
import { useScenariosByDepartmentIdBatch } from "@/lib/api/hooks/scenarios";
import {
  useCreateSimulation,
  useDeleteSimulation,
  useSimulationsByDepartmentIdBatch,
} from "@/lib/api/hooks/simulations";
import { Simulation } from "@/types";
import { SimulationsDataTable } from "./SimulationsDataTable";

export function Simulations() {
  const router = useRouter();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteItem, setDeleteItem] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState<string | null>(null);
  const { effectiveProfile } = useProfile();
  const { effectiveDepartmentIds } = useDepartments();

  // Mutation hooks
  const createSimulationMutation = useCreateSimulation();
  const deleteSimulationMutation = useDeleteSimulation();

  const { data: simulations = [] } = useSimulationsByDepartmentIdBatch(
    effectiveDepartmentIds
  );
  const { data: scenarios = [] } = useScenariosByDepartmentIdBatch(
    effectiveDepartmentIds
  );
  const { data: rubrics = [] } = useRubricsByDepartmentIdBatch(
    effectiveDepartmentIds
  );
  const { data: cohorts = [] } = useCohortsByDepartmentIdBatch(
    effectiveDepartmentIds
  );

  // Check if a simulation is being used by any cohorts
  const isSimulationInUse = (simulationId: string) => {
    return cohorts.some(
      (cohort) =>
        cohort.simulationIds && cohort.simulationIds.includes(simulationId)
    );
  };

  const canDeleteSimulation = (simulation: Simulation) => {
    if (isSimulationInUse(simulation.id)) return false;
    if (simulation.defaultSimulation) {
      const isSuperadmin = effectiveProfile?.role === "superadmin";
      return isSuperadmin && !simulation.active;
    }
    return true;
  };

  // Only superadmins can edit default items; others can edit non-default if admin/superadmin or not in use
  const canEditSimulation = (simulationId: string) => {
    const isAdmin =
      effectiveProfile?.role === "admin" ||
      effectiveProfile?.role === "superadmin";
    const sim = simulations.find((s) => s.id === simulationId);
    if (!sim) return false;
    if (sim.defaultSimulation) {
      return effectiveProfile?.role === "superadmin";
    }
    return isAdmin || !isSimulationInUse(simulationId);
  };

  // Create table columns
  const { columns } = useSimulationColumns({
    scenarios,
    rubrics,
  });

  // Create filter options
  const scenarioOptions = scenarios.map((scenario) => ({
    value: scenario.id,
    label: scenario.name,
  }));

  const rubricOptions = rubrics.map((rubric) => ({
    value: rubric.id,
    label: rubric.name,
  }));

  const timeLimitOptions = [
    { value: "no-limit", label: "No Time Limit" },
    { value: "0-30", label: "0-30 minutes" },
    { value: "30-60", label: "30-60 minutes" },
    { value: "60-120", label: "60-120 minutes" },
    { value: "120+", label: "120+ minutes" },
  ];

  const handleDelete = async () => {
    if (!deleteItem) return;

    setIsDeleting(true);
    try {
      await log.info("simulation.delete.start", {
        message: "Deleting simulation",
        subject: { entityType: "simulation", entityId: deleteItem.id },
        context: {
          component: "Simulations",
          function: "handleDelete",
          name: deleteItem.name,
        },
      });
      await deleteSimulationMutation.mutateAsync(deleteItem.id);

      toast.success("Simulation deleted successfully");
      await log.info("simulation.delete.success", {
        message: "Simulation deleted successfully",
        subject: { entityType: "simulation", entityId: deleteItem.id },
        context: { component: "Simulations", function: "handleDelete" },
      });
    } catch (error) {
      await log.error("simulation.delete.failed", {
        message: "Error deleting simulation",
        subject: { entityType: "simulation", entityId: deleteItem?.id },
        context: { component: "Simulations", function: "handleDelete" },
        error,
      });
      toast.error("Failed to delete simulation");
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
      setDeleteItem(null);
    }
  };

  const handleDeleteClick = (id: string, name: string) => {
    setDeleteItem({ id, name });
    setShowDeleteDialog(true);
  };

  const handleEdit = (id: string) => {
    router.push(`/create/simulations/s/${id}`);
  };

  const handleDuplicate = async (simulation: Simulation) => {
    // Only allow duplicating default simulations
    if (!simulation.defaultSimulation) {
      toast.error("This simulation cannot be duplicated");
      return;
    }

    setIsDuplicating(simulation.id);
    try {
      await log.info("simulation.duplicate.start", {
        message: "Duplicating simulation",
        subject: { entityType: "simulation", entityId: simulation.id },
        context: {
          component: "Simulations",
          function: "handleDuplicate",
          title: simulation.title,
        },
      });

      const duplicatedSimulation = {
        title: `${simulation.title} Copy`,
        timeLimit: simulation.timeLimit,
        active: false,
        // scenarioIds managed via simulation_scenarios junction now
        rubricId: simulation.rubricId,
        departmentId: effectiveProfile?.departmentId || "",
        defaultSimulation: false, // Duplicated simulations are not default
      };

      await createSimulationMutation.mutateAsync(duplicatedSimulation);

      toast.success("Simulation duplicated successfully");
      await log.info("simulation.duplicate.success", {
        message: "Simulation duplicated successfully",
        subject: { entityType: "simulation", entityId: simulation.id },
        context: {
          component: "Simulations",
          function: "handleDuplicate",
          title: duplicatedSimulation.title,
        },
      });
    } catch (error) {
      await log.error("simulation.duplicate.failed", {
        message: "Error duplicating simulation",
        subject: { entityType: "simulation", entityId: simulation.id },
        context: { component: "Simulations", function: "handleDuplicate" },
        error,
      });
      toast.error("Failed to duplicate simulation");
    } finally {
      setIsDuplicating(null);
    }
  };

  const canDuplicate = (simulation: Simulation) => {
    // Can only duplicate default simulations
    return simulation.defaultSimulation;
  };

  const renderSimulationCard = (simulation: Simulation) => (
    <Card
      key={simulation.id}
      aria-label={simulation.title}
      data-testid={`card-${simulation.id}`}
      className="relative flex flex-col h-full hover:shadow-md transition-shadow"
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg">{simulation.title}</CardTitle>
            <div className="mt-1 space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline">
                  <Timer className="h-3 w-3 mr-1" />
                  {simulation.timeLimit
                    ? `${simulation.timeLimit} minutes`
                    : "No time limit"}
                </Badge>
                {simulation.practiceSimulation && (
                  <Badge variant="default" className="text-xs">
                    Practice
                  </Badge>
                )}
              </div>
              {!simulation.active && (
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">Inactive</Badge>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            {canEditSimulation(simulation.id) ? (
              <Button
                variant="outline"
                size="sm"
                data-testid={`edit-${simulation.id}`}
                onClick={() => handleEdit(simulation.id)}
                aria-label={`Edit ${simulation.title}`}
              >
                <Edit className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                data-testid={`view-${simulation.id}`}
                onClick={() => handleEdit(simulation.id)}
                aria-label={`View ${simulation.title}`}
              >
                <Eye className="h-4 w-4" />
              </Button>
            )}
            {canDuplicate(simulation) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDuplicate(simulation)}
                disabled={
                  isDuplicating === simulation.id ||
                  createSimulationMutation.isPending
                }
                aria-label={`Duplicate ${simulation.title}`}
              >
                {isDuplicating === simulation.id ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            )}
            {canDeleteSimulation(simulation) && (
              <Button
                variant="outline"
                size="sm"
                data-testid={`delete-${simulation.id}`}
                onClick={() =>
                  handleDeleteClick(simulation.id, simulation.title)
                }
                aria-label={`Delete ${simulation.title}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 flex-grow flex flex-col justify-end">
        <p className="text-sm text-muted-foreground line-clamp-2">
          {simulation.description || "No description available"}
        </p>
        <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
          <Users className="h-3 w-3" />
          {/* TODO: Load scenario count from simulation_scenarios junction */}{" "}
          scenarios
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <SimulationsDataTable
        columns={columns}
        data={simulations}
        scenarioOptions={scenarioOptions}
        rubricOptions={rubricOptions}
        timeLimitOptions={timeLimitOptions}
        renderSimulationCard={renderSimulationCard}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Simulation</AlertDialogTitle>
            <AlertDialogDescription>
              <p>
                Are you sure you want to delete the simulation "
                {deleteItem?.name}"? This action cannot be undone.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={isDeleting || deleteSimulationMutation.isPending}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting || deleteSimulationMutation.isPending}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isDeleting || deleteSimulationMutation.isPending
                ? "Deleting..."
                : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
