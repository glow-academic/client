/**
 * Simulations.tsx
 * Used to display the simulations page with the new unified simulation playground.
 * @AshokSaravanan222 & @siladiea
 * 06/07/2025
 */
"use client";
import { logError, logInfo } from "@/utils/logger";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Edit, Plus, Sparkles, Timer, Trash2, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { createSimulation } from "@/utils/mutations/simulations/create-simulation";
import { deleteSimulation } from "@/utils/mutations/simulations/delete-simulation";
import { getAllCohorts } from "@/utils/queries/cohorts/get-all-cohorts";
import { getAllRubrics } from "@/utils/queries/rubrics/get-all-rubrics";
import { getAllScenarios } from "@/utils/queries/scenarios/get-all-scenarios";
import { getAllSimulations } from "@/utils/queries/simulations/get-all-simulations";

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
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useSimulationColumns } from "@/hooks/use-simulation-columns";
import { Simulation } from "@/types";
import { SimulationsDataTable } from "./SimulationsDataTable";

export function Simulations() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteItem, setDeleteItem] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState<string | null>(null);

  // Fetch all required data
  const { data: simulations = [], refetch: refetchSimulations } = useQuery({
    queryKey: ["simulations"],
    queryFn: () => getAllSimulations(),
  });

  const { data: cohorts = [] } = useQuery({
    queryKey: ["cohorts"],
    queryFn: () => getAllCohorts(),
  });

  const { data: scenarios = [] } = useQuery({
    queryKey: ["scenarios"],
    queryFn: () => getAllScenarios(),
  });

  const { data: rubrics = [] } = useQuery({
    queryKey: ["rubrics"],
    queryFn: () => getAllRubrics(),
  });

  // Create table columns
  const { columns } = useSimulationColumns({
    cohorts,
    scenarios,
    rubrics,
  });

  // Create filter options
  const cohortOptions = cohorts.map((cohort) => ({
    value: cohort.id,
    label: cohort.title,
  }));

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
      logInfo("Deleting simulation:", {
        simulationId: deleteItem.id,
        name: deleteItem.name,
      });
      await deleteSimulation(deleteItem.id);

      toast.success("Simulation deleted successfully");
      // Invalidate queries to ensure all components refresh
      queryClient.invalidateQueries({ queryKey: ["simulations"] });
      refetchSimulations();
      logInfo("Simulation deleted successfully:", {
        simulationId: deleteItem.id,
      });
    } catch (error) {
      logError("Error deleting simulation:", error);
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

  const handleCreateNew = () => {
    router.push("/create");
  };

  const handleDuplicate = async (simulation: Simulation) => {
    // Only allow duplicating default simulations (reverse logic from cohorts)
    if (!simulation.defaultSimulation) {
      toast.error("This simulation cannot be duplicated");
      return;
    }

    setIsDuplicating(simulation.id);
    try {
      logInfo("Duplicating simulation:", {
        simulationId: simulation.id,
        title: simulation.title,
      });

      const duplicatedSimulation = {
        title: `${simulation.title} Copy`,
        timeLimit: simulation.timeLimit,
        active: simulation.active,
        scenarioIds: simulation.scenarioIds,
        cohortIds: simulation.cohortIds,
        rubricId: simulation.rubricId,
        defaultSimulation: false, // Duplicated simulations are not default
      };

      await createSimulation(duplicatedSimulation);

      toast.success("Simulation duplicated successfully");
      queryClient.invalidateQueries({ queryKey: ["simulations"] });
      refetchSimulations();
      logInfo("Simulation duplicated successfully:", {
        originalId: simulation.id,
        title: duplicatedSimulation.title,
      });
    } catch (error) {
      logError("Error duplicating simulation:", error);
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
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <CardTitle className="text-base">{simulation.title}</CardTitle>
            <CardDescription className="flex items-center gap-2">
              <Timer className="h-3 w-3" />
              {simulation.timeLimit
                ? `${simulation.timeLimit} minutes`
                : "No time limit"}

              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="h-3 w-3" />
                {simulation.scenarioIds?.length || 0} scenarios
              </div>
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={simulation.active ? "default" : "secondary"}>
              {simulation.active ? "Active" : "Inactive"}
            </Badge>
            {simulation.defaultSimulation && (
              <Badge variant="outline" className="text-xs">
                Default
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardFooter className="flex justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleEdit(simulation.id)}
        >
          <Edit className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleDuplicate(simulation)}
          disabled={
            !canDuplicate(simulation) || isDuplicating === simulation.id
          }
        >
          {isDuplicating === simulation.id ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleDeleteClick(simulation.id, simulation.title)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </CardFooter>
    </Card>
  );

  if (simulations.length === 0) {
    return (
      <div className="space-y-6">
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Sparkles className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No simulations yet</h3>
            <p className="text-muted-foreground text-center mb-4">
              Create your first simulation using our interactive playground
            </p>
            <Button onClick={handleCreateNew}>
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Simulation
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SimulationsDataTable
        columns={columns}
        data={simulations}
        cohortOptions={cohortOptions}
        scenarioOptions={scenarioOptions}
        rubricOptions={rubricOptions}
        timeLimitOptions={timeLimitOptions}
        renderSimulationCard={renderSimulationCard}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the simulation "{deleteItem?.name}".
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
