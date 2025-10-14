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
import { useDepartments } from "@/contexts/departments-context";
import { useProfile } from "@/contexts/profile-context";
import {
  useDeleteSimulation,
  useDuplicateSimulation,
  useSimulationsList,
} from "@/lib/api/v2/hooks/simulations";
import { SimulationItem } from "@/lib/api/v2/schemas/simulations";
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

  // V2 API hooks - single fetch with all data
  const { data: simulationsData } = useSimulationsList(
    {
      departmentIds: effectiveDepartmentIds,
      profileId: effectiveProfile?.id || "",
    },
    { enabled: !!effectiveProfile?.id && effectiveDepartmentIds.length > 0 }
  );

  // Mutation hooks
  const duplicateSimulationMutation = useDuplicateSimulation();
  const deleteSimulationMutation = useDeleteSimulation();

  // Extract data from V2 response
  const simulations = useMemo(
    () => simulationsData?.simulations || [],
    [simulationsData?.simulations]
  );
  const scenarioMapping = useMemo(
    () => simulationsData?.scenario_mapping || {},
    [simulationsData?.scenario_mapping]
  );
  const rubricMapping = useMemo(
    () => simulationsData?.rubric_mapping || {},
    [simulationsData?.rubric_mapping]
  );

  // Create filter options from mappings
  const scenarioOptions = useMemo(() => {
    return Object.entries(scenarioMapping).map(([id, name]) => ({
      value: id,
      label: name,
    }));
  }, [scenarioMapping]);

  const rubricOptions = useMemo(() => {
    return Object.entries(rubricMapping).map(([id, name]) => ({
      value: id,
      label: name,
    }));
  }, [rubricMapping]);

  const timeLimitOptions = useMemo(
    () => [
      { value: "no-limit", label: "No Time Limit" },
      { value: "0-30", label: "0-30 minutes" },
      { value: "30-60", label: "30-60 minutes" },
      { value: "60-120", label: "60-120 minutes" },
      { value: "120+", label: "120+ minutes" },
    ],
    []
  );

  // Permissions now come from server-side in V2 API
  // No need for client-side permission logic

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
      await deleteSimulationMutation.mutateAsync({
        simulationId: deleteItem.id,
      });

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

  const handleDuplicate = async (
    simulationId: string,
    simulationName: string
  ) => {
    setIsDuplicating(simulationId);
    try {
      await log.info("simulation.duplicate.start", {
        message: "Duplicating simulation",
        subject: { entityType: "simulation", entityId: simulationId },
        context: {
          component: "Simulations",
          function: "handleDuplicate",
          title: simulationName,
        },
      });

      await duplicateSimulationMutation.mutateAsync({ simulationId });

      toast.success("Simulation duplicated successfully");
      await log.info("simulation.duplicate.success", {
        message: "Simulation duplicated successfully",
        subject: { entityType: "simulation", entityId: simulationId },
        context: {
          component: "Simulations",
          function: "handleDuplicate",
          title: simulationName,
        },
      });
    } catch (error) {
      await log.error("simulation.duplicate.failed", {
        message: "Error duplicating simulation",
        subject: { entityType: "simulation", entityId: simulationId },
        context: { component: "Simulations", function: "handleDuplicate" },
        error,
      });
      toast.error("Failed to duplicate simulation");
    } finally {
      setIsDuplicating(null);
    }
  };

  const renderSimulationCard = (simulation: SimulationItem) => (
    <Card
      key={simulation.simulation_id}
      aria-label={simulation.name}
      data-testid={`card-${simulation.simulation_id}`}
      className="relative flex flex-col h-full hover:shadow-md transition-shadow"
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg">{simulation.name}</CardTitle>
            <div className="mt-1 space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline">
                  <Timer className="h-3 w-3 mr-1" />
                  {simulation.time_limit
                    ? `${simulation.time_limit} minutes`
                    : "No time limit"}
                </Badge>
                {simulation.practice_simulation && (
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
            {simulation.can_edit ? (
              <Button
                variant="outline"
                size="sm"
                data-testid={`edit-${simulation.simulation_id}`}
                onClick={() => handleEdit(simulation.simulation_id)}
                aria-label={`Edit ${simulation.name}`}
              >
                <Edit className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                data-testid={`view-${simulation.simulation_id}`}
                onClick={() => handleEdit(simulation.simulation_id)}
                aria-label={`View ${simulation.name}`}
              >
                <Eye className="h-4 w-4" />
              </Button>
            )}
            {simulation.can_duplicate && (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  handleDuplicate(simulation.simulation_id, simulation.name)
                }
                disabled={
                  isDuplicating === simulation.simulation_id ||
                  duplicateSimulationMutation.isPending
                }
                aria-label={`Duplicate ${simulation.name}`}
              >
                {isDuplicating === simulation.simulation_id ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            )}
            {simulation.can_delete && (
              <Button
                variant="outline"
                size="sm"
                data-testid={`delete-${simulation.simulation_id}`}
                onClick={() =>
                  handleDeleteClick(simulation.simulation_id, simulation.name)
                }
                aria-label={`Delete ${simulation.name}`}
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
          {simulation.num_scenarios} scenarios
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <SimulationsDataTable
        data={simulations}
        scenarioMapping={scenarioMapping}
        rubricMapping={rubricMapping}
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
