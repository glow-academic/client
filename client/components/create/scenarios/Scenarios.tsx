/**
 * Scenarios.tsx
 * Used to display the scenarios page with the new unified simulation playground.
 * @AshokSaravanan222 & @siladiea
 * 06/07/2025
 */
"use client";
import { logError, logInfo } from "@/utils/logger";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  Clock,
  Copy,
  Edit,
  Filter,
  GraduationCap,
  MapPin,
  Trash2,
  Users,
  X,
} from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Cohort, Scenario, Simulation } from "@/types";
import { createScenario } from "@/utils/mutations/scenarios/create-scenario";
import { deleteScenario } from "@/utils/mutations/scenarios/delete-scenario";
import { getAllCohorts } from "@/utils/queries/cohorts/get-all-cohorts";
import { getAllScenarios } from "@/utils/queries/scenarios/get-all-scenarios";
import { getAllSimulations } from "@/utils/queries/simulations/get-all-simulations";

export function Scenarios() {
  const router = useRouter();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteItem, setDeleteItem] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState<string | null>(null);
  const [simulationFilter, setSimulationFilter] = useState<string>("all");
  const [cohortFilter, setCohortFilter] = useState<string>("all");

  // Fetch data
  const { data: scenarios = [], refetch: refetchScenarios } = useQuery({
    queryKey: ["scenarios"],
    queryFn: () => getAllScenarios(),
  });

  const { data: simulations = [] } = useQuery({
    queryKey: ["simulations"],
    queryFn: () => getAllSimulations(),
  });

  const { data: cohorts = [] } = useQuery({
    queryKey: ["cohorts"],
    queryFn: () => getAllCohorts(),
  });

  // Filter scenarios based on selected filters
  const filteredScenarios = scenarios.filter((scenario: Scenario) => {
    let matchesSimulation = simulationFilter === "all";
    let matchesCohort = cohortFilter === "all";

    if (simulationFilter !== "all") {
      const simulation = simulations.find(
        (s: Simulation) => s.id === simulationFilter
      );
      if (simulation && simulation.scenarioIds.includes(scenario.id)) {
        matchesSimulation = true;
      }
    }

    if (cohortFilter !== "all") {
      const simulation = simulations.find(
        (s: Simulation) =>
          s.cohortIds.includes(cohortFilter) &&
          s.scenarioIds.includes(scenario.id)
      );
      if (simulation) {
        matchesCohort = true;
      }
    }

    return matchesSimulation && matchesCohort;
  });

  // Separate scenarios by default status
  const defaultScenarios = filteredScenarios.filter(
    (scenario: Scenario) => scenario.defaultScenario
  );
  const customScenarios = filteredScenarios.filter(
    (scenario: Scenario) => !scenario.defaultScenario
  );

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
    setIsDuplicating(scenario.id);
    try {
      await createScenario({
        ...scenario,
        id: undefined,
        createdAt: undefined,
        updatedAt: undefined,
        defaultScenario: false,
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

  const clearFilters = () => {
    setSimulationFilter("all");
    setCohortFilter("all");
  };

  const hasActiveFilters = simulationFilter !== "all" || cohortFilter !== "all";

  const renderScenarioCard = (scenario: Scenario) => (
    <Card key={scenario.id} className="hover:shadow-md transition-shadow">
      <CardHeader>
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
                {scenario.location && (
                  <Badge variant="outline" className="text-xs">
                    <MapPin className="h-3 w-3 mr-1" />
                    {scenario.location}
                  </Badge>
                )}
                {scenario.seniority && (
                  <Badge variant="outline" className="text-xs">
                    <GraduationCap className="h-3 w-3 mr-1" />
                    {scenario.seniority}
                  </Badge>
                )}
                {scenario.tod && (
                  <Badge variant="outline" className="text-xs">
                    <Clock className="h-3 w-3 mr-1" />
                    {scenario.tod}
                  </Badge>
                )}
                {scenario.urgency && (
                  <Badge variant="outline" className="text-xs">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    {scenario.urgency}
                  </Badge>
                )}
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              {scenario.description || "No description available"}
            </p>
          </div>
          <div className="flex gap-2 items-center">
            {scenario.defaultScenario && (
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
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleEdit(scenario.id)}
            >
              <Edit className="h-4 w-4" />
            </Button>
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
          </div>
        </div>
      </CardHeader>
      <CardContent>
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
      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Filters:</span>
        </div>

        <Select value={simulationFilter} onValueChange={setSimulationFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by simulation" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Simulations</SelectItem>
            {simulations.map((simulation: Simulation) => (
              <SelectItem key={simulation.id} value={simulation.id}>
                {simulation.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={cohortFilter} onValueChange={setCohortFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by cohort" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Cohorts</SelectItem>
            {cohorts.map((cohort: Cohort) => (
              <SelectItem key={cohort.id} value={cohort.id}>
                {cohort.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasActiveFilters && (
          <Button
            variant="outline"
            size="sm"
            onClick={clearFilters}
            className="text-muted-foreground"
          >
            <X className="h-4 w-4 mr-1" />
            Clear Filters
          </Button>
        )}
      </div>

      {/* Default Scenarios Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-semibold">Default Scenarios</h2>
          <Badge variant="outline">{defaultScenarios.length}</Badge>
        </div>
        <div className="grid gap-4">
          {defaultScenarios
            .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
            .map(renderScenarioCard)}
          {defaultScenarios.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No default scenarios found.
            </div>
          )}
        </div>
      </div>

      <Separator />

      {/* Custom Scenarios Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-semibold">Custom Scenarios</h2>
          <Badge variant="outline">{customScenarios.length}</Badge>
        </div>
        <div className="grid gap-4">
          {customScenarios
            .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
            .map(renderScenarioCard)}
          {customScenarios.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No custom scenarios found.
            </div>
          )}
        </div>
      </div>

      {/* Empty State */}
      {filteredScenarios.length === 0 && scenarios.length > 0 && (
        <div className="text-center py-8 text-muted-foreground">
          No scenarios match the selected filters.
        </div>
      )}

      {scenarios.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          No scenarios found. Create your first scenario to get started.
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the scenario "{deleteItem?.name}".
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
