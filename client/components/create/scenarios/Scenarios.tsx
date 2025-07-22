/**
 * Scenarios.tsx
 * Used to display the scenarios page with table-based filtering and card layout.
 * @AshokSaravanan222 & @siladiea
 * 06/07/2025
 */
"use client";
import { logError, logInfo } from "@/utils/logger";
import { useQuery } from "@tanstack/react-query";
import { Activity, Copy, Edit, Trash2, Users } from "lucide-react";
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
import { useScenarioColumns } from "@/hooks/use-scenario-columns";
import { Scenario } from "@/types";
import { createScenario } from "@/utils/mutations/scenarios/create-scenario";
import { deleteScenario } from "@/utils/mutations/scenarios/delete-scenario";
import { getAllScenarios } from "@/utils/queries/scenarios/get-all-scenarios";
import { getAllSimulations } from "@/utils/queries/simulations/get-all-simulations";
import { ScenariosDataTable } from "./ScenariosDataTable";

export function Scenarios() {
  const router = useRouter();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteItem, setDeleteItem] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState<string | null>(null);

  // Fetch scenarios data
  const { data: scenarios = [], refetch: refetchScenarios } = useQuery({
    queryKey: ["scenarios"],
    queryFn: () => getAllScenarios(),
  });

  const { data: simulations = [] } = useQuery({
    queryKey: ["simulations"],
    queryFn: () => getAllSimulations(),
  });

  // Check if a scenario is being used by any simulations
  const isScenarioInUse = (scenarioId: string) => {
    return simulations.some(
      (sim) => sim.scenarioIds && sim.scenarioIds.includes(scenarioId)
    );
  };

  // Check if user can edit (fully immutable)
  const canEditScenario = (scenarioId: string) => {
    return !isScenarioInUse(scenarioId);
  };

  // Get table columns and filter options
  const {
    columns,
    simulationOptions,
    cohortOptions,
    personaOptions,
    scenarioTypeOptions,
  } = useScenarioColumns();

  const handleDelete = async () => {
    if (!deleteItem) return;

    setIsDeleting(true);
    try {
      await deleteScenario(deleteItem.id);
      logInfo("Scenario deleted successfully:", {
        id: deleteItem.id,
        name: deleteItem.name,
      });
      toast.success("Scenario deleted successfully");
      refetchScenarios();
    } catch (error) {
      logError("Error deleting scenario:", error);
      toast.error("Failed to delete scenario");
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
      setDeleteItem(null);
    }
  };

  const handleDuplicate = async (scenario: Scenario) => {
    // Only allow duplicating non-generated scenarios
    if (scenario.generated === true) {
      toast.error("This scenario cannot be duplicated");
      return;
    }

    setIsDuplicating(scenario.id);
    try {
      await createScenario({
        ...scenario,
        id: undefined,
        createdAt: undefined,
        updatedAt: undefined,
        defaultScenario: false,
        generated: false,
        name: `${scenario.name} Copy`,
      });
      logInfo("Scenario duplicated successfully:", {
        originalId: scenario.id,
        originalName: scenario.name,
      });
      toast.success(`Scenario "${scenario.name}" duplicated successfully`);
      refetchScenarios();
    } catch (error) {
      logError("Error duplicating scenario:", error);
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const canDuplicate = (scenario: Scenario) => {
    // Can duplicate general scenarios and default scenarios (but not generated ones)
    return scenario.generated !== true;
  };

  const renderScenarioCard = (scenario: Scenario) => (
    <Card
      key={scenario.id}
      className="hover:shadow-md transition-shadow flex flex-col h-full"
    >
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div className="space-y-2 flex-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">
                {scenario.name || "Unnamed Scenario"}
              </CardTitle>
              <div className="flex gap-1 flex-wrap">
                {scenario.defaultScenario && (
                  <Badge variant="secondary" className="text-xs">
                    Default
                  </Badge>
                )}
                {scenario.generated === true && (
                  <Badge variant="outline" className="text-xs">
                    Generated
                  </Badge>
                )}
              </div>
            </div>
            <p className="text-sm text-muted-foreground line-clamp-2">
              {scenario.description || "No description available"}
            </p>
          </div>
          <div className="flex gap-2 items-center ml-4">
            {canDuplicate(scenario) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDuplicate(scenario)}
                disabled={isDuplicating === scenario.id}
              >
                <Copy className="h-4 w-4" />
                {isDuplicating === scenario.id ? "..." : ""}
              </Button>
            )}
            {canEditScenario(scenario.id) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleEdit(scenario.id)}
              >
                <Edit className="h-4 w-4" />
              </Button>
            )}
            {!isScenarioInUse(scenario.id) && (
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
          </div>
        </div>
      </CardHeader>
      <div className="flex-grow"></div>
      <CardContent className="pt-0">
        <div className="grid grid-cols-2 gap-4 text-sm">
          {scenario.crowdedness !== null && (
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Crowdedness:</span>
              <span className="font-medium">{scenario.crowdedness}/10</span>
            </div>
          )}
          {scenario.intensity !== null && (
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Intensity:</span>
              <span className="font-medium">{scenario.intensity}/10</span>
            </div>
          )}
          <div className="col-span-2">
            <span className="text-muted-foreground">Updated:</span>
            <span className="font-medium ml-2">
              {formatDate(scenario.updatedAt)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <ScenariosDataTable
        columns={columns}
        data={scenarios}
        simulationOptions={simulationOptions}
        cohortOptions={cohortOptions}
        personaOptions={personaOptions}
        scenarioTypeOptions={scenarioTypeOptions}
        renderScenarioCard={renderScenarioCard}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Scenario</AlertDialogTitle>
            <AlertDialogDescription>
              <p>
                Are you sure you want to delete the scenario "{deleteItem?.name}
                "? This action cannot be undone.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
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
  );
}
