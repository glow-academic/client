/**
 * Simulations.tsx
 * Used to display the simulations page with the new unified simulation playground.
 * @AshokSaravanan222 & @siladiea
 * 06/07/2025
 */
"use client";
import { logError, logInfo } from "@/utils/logger";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Edit, Timer, Trash2, Users } from "lucide-react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSimulationColumns } from "@/hooks/use-simulation-columns";
import { Cohort, Scenario, Simulation } from "@/types";
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
  const [affectedScenarios, setAffectedScenarios] = useState<Scenario[]>([]);
  const [affectedCohorts, setAffectedCohorts] = useState<Cohort[]>([]);
  const [isLoadingImpact, setIsLoadingImpact] = useState(false);

  // Fetch all required data
  const { data: simulations = [], refetch: refetchSimulations } = useQuery({
    queryKey: ["simulations"],
    queryFn: () => getAllSimulations(),
  });

  const { data: scenarios = [] } = useQuery({
    queryKey: ["scenarios"],
    queryFn: () => getAllScenarios(),
  });

  const { data: rubrics = [] } = useQuery({
    queryKey: ["rubrics"],
    queryFn: () => getAllRubrics(),
  });

  const { data: cohorts = [] } = useQuery({
    queryKey: ["cohorts"],
    queryFn: () => getAllCohorts(),
  });

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
    const simulationToDelete = simulations.find((s) => s.id === id);
    if (simulationToDelete) {
      setDeleteItem({ id, name });
      setIsLoadingImpact(true);

      // Calculate impact on scenarios
      const affectedScenariosList = scenarios.filter(
        (scenario) =>
          simulationToDelete.scenarioIds &&
          simulationToDelete.scenarioIds.includes(scenario.id)
      );

      // Calculate impact on cohorts
      const affectedCohortsList = cohorts.filter(
        (cohort) =>
          cohort.simulationIds &&
          cohort.simulationIds.includes(simulationToDelete.id)
      );

      setAffectedScenarios(affectedScenariosList);
      setAffectedCohorts(affectedCohortsList);
      setIsLoadingImpact(false);
      setShowDeleteDialog(true);
    }
  };

  const handleEdit = (id: string) => {
    router.push(`/create/simulations/s/${id}`);
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
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline">
                <Timer className="h-3 w-3 mr-1" />
                {simulation.timeLimit
                  ? `${simulation.timeLimit} minutes`
                  : "No time limit"}
              </Badge>
              <Badge variant={simulation.active ? "default" : "secondary"}>
                {simulation.active ? "Active" : "Inactive"}
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {canDuplicate(simulation) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDuplicate(simulation)}
                disabled={isDuplicating === simulation.id}
                aria-label={`Duplicate ${simulation.title}`}
              >
                {isDuplicating === simulation.id ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              data-testid={`edit-${simulation.id}`}
              onClick={() => handleEdit(simulation.id)}
              aria-label={`Edit ${simulation.title}`}
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              data-testid={`delete-${simulation.id}`}
              onClick={() => handleDeleteClick(simulation.id, simulation.title)}
              aria-label={`Delete ${simulation.title}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 flex-grow flex flex-col">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Users className="h-3 w-3" />
          {simulation.scenarioIds?.length || 0} scenarios
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
              {isLoadingImpact ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Loading impact analysis...
                </div>
              ) : (
                <div className="space-y-3">
                  <p>
                    Are you sure you want to delete the simulation "
                    {deleteItem?.name}"? This action cannot be undone.
                  </p>

                  {(affectedScenarios.length > 0 ||
                    affectedCohorts.length > 0) && (
                    <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
                      <div className="font-medium text-red-800 mb-2">
                        ⚠️ Impact of deletion:
                      </div>

                      {affectedCohorts.length > 0 && (
                        <div className="mb-2">
                          <span className="font-medium text-red-700">
                            {affectedCohorts.length} cohort
                            {affectedCohorts.length !== 1 ? "s" : ""} will be
                            affected:
                          </span>
                          <ul className="mt-1 list-disc list-inside text-sm text-red-600">
                            {affectedCohorts.slice(0, 3).map((cohort) => (
                              <li key={cohort.id}>{cohort.title}</li>
                            ))}
                            {affectedCohorts.length > 3 && (
                              <li>...and {affectedCohorts.length - 3} more</li>
                            )}
                          </ul>
                        </div>
                      )}

                      {affectedScenarios.length > 0 && (
                        <div>
                          <span className="font-medium text-red-700">
                            {affectedScenarios.length} scenario
                            {affectedScenarios.length !== 1 ? "s" : ""} are used
                            in this simulation:
                          </span>
                          <ul className="mt-1 list-disc list-inside text-sm text-red-600">
                            {affectedScenarios.slice(0, 3).map((scenario) => (
                              <li key={scenario.id}>{scenario.name}</li>
                            ))}
                            {affectedScenarios.length > 3 && (
                              <li>
                                ...and {affectedScenarios.length - 3} more
                              </li>
                            )}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="mt-3 text-sm font-medium text-red-700">
                    This action will permanently remove the simulation and
                    cannot be undone.
                  </div>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting || isLoadingImpact}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
