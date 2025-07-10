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
  GraduationCap,
  MapPin,
  Search,
  Trash2,
  Users,
  X,
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Cohort, Scenario, Simulation } from "@/types";
import { createScenario } from "@/utils/mutations/scenarios/create-scenario";
import { deleteScenario } from "@/utils/mutations/scenarios/delete-scenario";
import { getAllCohorts } from "@/utils/queries/cohorts/get-all-cohorts";
import { getAllScenarios } from "@/utils/queries/scenarios/get-all-scenarios";
import { getAllSimulations } from "@/utils/queries/simulations/get-all-simulations";

const ITEMS_PER_PAGE_OPTIONS = [10, 20, 50, 100];
const DEFAULT_ITEMS_PER_PAGE = 20;

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
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("general");

  // Pagination states for each tab
  const [generalPage, setGeneralPage] = useState(1);
  const [generatedPage, setGeneratedPage] = useState(1);
  const [defaultPage, setDefaultPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(DEFAULT_ITEMS_PER_PAGE);

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

  // Filter scenarios based on selected filters and search
  const filteredScenarios = useMemo(() => {
    return scenarios.filter((scenario: Scenario) => {
      let matchesSimulation = simulationFilter === "all";
      let matchesCohort = cohortFilter === "all";
      let matchesSearch = true;

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

      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        matchesSearch =
          (scenario.name?.toLowerCase().includes(searchLower) ?? false) ||
          (scenario.description?.toLowerCase().includes(searchLower) ??
            false) ||
          (scenario.location?.toLowerCase().includes(searchLower) ?? false) ||
          (scenario.seniority?.toLowerCase().includes(searchLower) ?? false) ||
          (scenario.tod?.toLowerCase().includes(searchLower) ?? false) ||
          (scenario.urgency?.toLowerCase().includes(searchLower) ?? false);
      }

      return matchesSimulation && matchesCohort && matchesSearch;
    });
  }, [scenarios, simulationFilter, cohortFilter, searchTerm, simulations]);

  // Separate scenarios by type
  const generalScenarios = useMemo(() => {
    return filteredScenarios.filter(
      (scenario: Scenario) => !scenario.defaultScenario && !scenario.generated
    );
  }, [filteredScenarios]);

  const generatedScenarios = useMemo(() => {
    return filteredScenarios.filter(
      (scenario: Scenario) => scenario.generated === true
    );
  }, [filteredScenarios]);

  const defaultScenarios = useMemo(() => {
    return filteredScenarios.filter(
      (scenario: Scenario) => scenario.defaultScenario
    );
  }, [filteredScenarios]);

  // Pagination logic
  const getPaginatedScenarios = (scenarios: Scenario[], page: number) => {
    const startIndex = (page - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return scenarios.slice(startIndex, endIndex);
  };

  const getTotalPages = (scenarios: Scenario[]) => {
    return Math.ceil(scenarios.length / itemsPerPage);
  };

  const getCurrentPageScenarios = () => {
    switch (activeTab) {
      case "general":
        return getPaginatedScenarios(generalScenarios, generalPage);
      case "generated":
        return getPaginatedScenarios(generatedScenarios, generatedPage);
      case "default":
        return getPaginatedScenarios(defaultScenarios, defaultPage);
      default:
        return [];
    }
  };

  const getCurrentPage = () => {
    switch (activeTab) {
      case "general":
        return generalPage;
      case "generated":
        return generatedPage;
      case "default":
        return defaultPage;
      default:
        return 1;
    }
  };

  const setCurrentPage = (page: number) => {
    switch (activeTab) {
      case "general":
        setGeneralPage(page);
        break;
      case "generated":
        setGeneratedPage(page);
        break;
      case "default":
        setDefaultPage(page);
        break;
    }
  };

  const getCurrentScenarios = () => {
    switch (activeTab) {
      case "general":
        return generalScenarios;
      case "generated":
        return generatedScenarios;
      case "default":
        return defaultScenarios;
      default:
        return [];
    }
  };

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
    // Only allow duplicating general scenarios
    if (scenario.defaultScenario || scenario.generated === true) {
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

  const clearFilters = () => {
    setSimulationFilter("all");
    setCohortFilter("all");
    setSearchTerm("");
  };

  const hasActiveFilters =
    simulationFilter !== "all" || cohortFilter !== "all" || searchTerm;

  const canDuplicate = (scenario: Scenario) => {
    // Can only duplicate general scenarios (not default or generated)
    return !scenario.defaultScenario && scenario.generated !== true;
  };

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
                {scenario.generated === true && (
                  <Badge variant="outline" className="text-xs">
                    Generated
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

  const renderPagination = () => {
    const currentScenarios = getCurrentScenarios();
    const totalPages = getTotalPages(currentScenarios);
    const currentPage = getCurrentPage();

    if (totalPages <= 1) return null;

    return (
      <div className="flex items-center justify-between mt-6 mb-10">
        <div className="text-sm text-muted-foreground">
          Showing{" "}
          {Math.min(
            (currentPage - 1) * itemsPerPage + 1,
            currentScenarios.length
          )}{" "}
          to {Math.min(currentPage * itemsPerPage, currentScenarios.length)} of{" "}
          {currentScenarios.length} scenarios
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
          >
            Previous
          </Button>
          <span className="text-sm">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setCurrentPage(Math.min(totalPages, currentPage + 1))
            }
            disabled={currentPage === totalPages}
          >
            Next
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Search and Filters */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search scenarios..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
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

        {/* Items per page selector */}
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-6"
      >
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="general" className="flex items-center gap-2">
              General
              <Badge variant="outline" className="text-xs">
                {generalScenarios.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="generated" className="flex items-center gap-2">
              Generated
              <Badge variant="outline" className="text-xs">
                {generatedScenarios.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="default" className="flex items-center gap-2">
              Default
              <Badge variant="outline" className="text-xs">
                {defaultScenarios.length}
              </Badge>
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Items per page:</span>
            <Select
              value={itemsPerPage.toString()}
              onValueChange={(value) => setItemsPerPage(parseInt(value))}
            >
              <SelectTrigger className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ITEMS_PER_PAGE_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option.toString()}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <TabsContent value="general" className="space-y-4">
          <div className="grid gap-4">
            {getCurrentPageScenarios()
              .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
              .map(renderScenarioCard)}
            {getCurrentPageScenarios().length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                {generalScenarios.length === 0
                  ? "No general scenarios found."
                  : "No scenarios match the current filters."}
              </div>
            )}
          </div>
          {renderPagination()}
        </TabsContent>

        <TabsContent value="generated" className="space-y-4">
          <div className="grid gap-4">
            {getCurrentPageScenarios()
              .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
              .map(renderScenarioCard)}
            {getCurrentPageScenarios().length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                {generatedScenarios.length === 0
                  ? "No generated scenarios found."
                  : "No scenarios match the current filters."}
              </div>
            )}
          </div>
          {renderPagination()}
        </TabsContent>

        <TabsContent value="default" className="space-y-4">
          <div className="grid gap-4">
            {getCurrentPageScenarios()
              .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
              .map(renderScenarioCard)}
            {getCurrentPageScenarios().length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                {defaultScenarios.length === 0
                  ? "No default scenarios found."
                  : "No scenarios match the current filters."}
              </div>
            )}
          </div>
          {renderPagination()}
        </TabsContent>
      </Tabs>

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
