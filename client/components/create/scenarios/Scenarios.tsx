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
import { Agent, Cohort, Scenario, Simulation } from "@/types";
import { createScenario } from "@/utils/mutations/scenarios/create-scenario";
import { deleteScenario } from "@/utils/mutations/scenarios/delete-scenario";
import { getAllAgents } from "@/utils/queries/agents/get-all-agents";
import { getAllCohorts } from "@/utils/queries/cohorts/get-all-cohorts";
import { getAllScenarios } from "@/utils/queries/scenarios/get-all-scenarios";
import { getAllSimulations } from "@/utils/queries/simulations/get-all-simulations";

const ITEMS_PER_PAGE_OPTIONS = [5, 10, 15, 20];
const DEFAULT_ITEMS_PER_PAGE = 10;

export function Scenarios() {
  const router = useRouter();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteItem, setDeleteItem] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState<string | null>(null);
  const [simulationFilter, setSimulationFilter] = useState<string[]>([]);
  const [cohortFilter, setCohortFilter] = useState<string[]>([]);
  const [agentFilter, setAgentFilter] = useState<string[]>([]);
  const [scenarioTypeFilter, setScenarioTypeFilter] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
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

  const { data: agents = [] } = useQuery({
    queryKey: ["agents"],
    queryFn: () => getAllAgents(),
  });

  // Filter scenarios based on selected filters and search
  const filteredScenarios = useMemo(() => {
    return scenarios.filter((scenario: Scenario) => {
      let matchesSimulation = simulationFilter.length === 0;
      let matchesCohort = cohortFilter.length === 0;
      let matchesAgent = agentFilter.length === 0;
      let matchesScenarioType = scenarioTypeFilter.length === 0;
      let matchesSearch = true;

      if (simulationFilter.length > 0) {
        matchesSimulation = simulationFilter.some((filterId) => {
          const simulation = simulations.find(
            (s: Simulation) => s.id === filterId
          );
          return simulation && simulation.scenarioIds.includes(scenario.id);
        });
      }

      if (cohortFilter.length > 0) {
        matchesCohort = cohortFilter.some((filterId) => {
          const simulation = simulations.find(
            (s: Simulation) =>
              s.cohortIds.includes(filterId) &&
              s.scenarioIds.includes(scenario.id)
          );
          return !!simulation;
        });
      }

      if (agentFilter.length > 0) {
        matchesAgent = agentFilter.includes(scenario.agentId || "");
      }

      if (scenarioTypeFilter.length > 0) {
        if (
          scenarioTypeFilter.includes("general") &&
          !scenario.defaultScenario &&
          !scenario.generated
        ) {
          matchesScenarioType = true;
        }
        if (
          scenarioTypeFilter.includes("generated") &&
          scenario.generated === true
        ) {
          matchesScenarioType = true;
        }
        if (
          scenarioTypeFilter.includes("default") &&
          scenario.defaultScenario
        ) {
          matchesScenarioType = true;
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

      return (
        matchesSimulation &&
        matchesCohort &&
        matchesAgent &&
        matchesScenarioType &&
        matchesSearch
      );
    });
  }, [
    scenarios,
    simulationFilter,
    cohortFilter,
    agentFilter,
    scenarioTypeFilter,
    searchTerm,
    simulations,
  ]);

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
    return getPaginatedScenarios(filteredScenarios, currentPage);
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
    setSimulationFilter([]);
    setCohortFilter([]);
    setAgentFilter([]);
    setScenarioTypeFilter([]);
    setSearchTerm("");
  };

  const hasActiveFilters =
    simulationFilter.length > 0 ||
    cohortFilter.length > 0 ||
    agentFilter.length > 0 ||
    scenarioTypeFilter.length > 0 ||
    searchTerm;

  const canDuplicate = (scenario: Scenario) => {
    // Can only duplicate general scenarios (not default or generated)
    return !scenario.defaultScenario && scenario.generated !== true;
  };

  // Filter options
  const simulationOptions = simulations.map((simulation: Simulation) => ({
    value: simulation.id,
    label: simulation.title,
  }));

  const cohortOptions = cohorts.map((cohort: Cohort) => ({
    value: cohort.id,
    label: cohort.title,
  }));

  const agentOptions = agents.map((agent: Agent) => ({
    value: agent.id,
    label: agent.name,
  }));

  const scenarioTypeOptions = [
    { value: "general", label: "General" },
    { value: "generated", label: "Generated" },
    { value: "default", label: "Default" },
  ];

  // Filter button components
  const FilterButton = ({
    title,
    options,
    selectedValues,
    onValueChange,
  }: {
    title: string;
    options: { value: string; label: string }[];
    selectedValues: string[];
    onValueChange: (values: string[]) => void;
  }) => {
    return (
      <div className="relative">
        <Select
          key={selectedValues.join(",")}
          defaultValue=""
          onValueChange={(value) => {
            if (value && !selectedValues.includes(value)) {
              onValueChange([...selectedValues, value]);
            }
          }}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder={title} />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedValues.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {selectedValues.map((value) => {
              const option = options.find((o) => o.value === value);
              return (
                <Badge key={value} variant="secondary" className="text-xs">
                  {option?.label}
                  <button
                    onClick={() =>
                      onValueChange(selectedValues.filter((v) => v !== value))
                    }
                    className="ml-1 hover:bg-destructive/20 rounded-full"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              );
            })}
          </div>
        )}
      </div>
    );
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
    const totalPages = getTotalPages(filteredScenarios);

    if (totalPages <= 1) return null;

    return (
      <div className="flex items-center justify-between px-2">
        <div className="flex-1 text-sm text-muted-foreground">
          Showing{" "}
          {Math.min(
            (currentPage - 1) * itemsPerPage + 1,
            filteredScenarios.length
          )}{" "}
          to {Math.min(currentPage * itemsPerPage, filteredScenarios.length)} of{" "}
          {filteredScenarios.length} scenarios
        </div>
        <div className="flex items-center space-x-6 lg:space-x-8">
          <div className="flex items-center space-x-2">
            <p className="text-sm font-medium">Rows per page</p>
            <Select
              value={`${itemsPerPage}`}
              onValueChange={(value) => {
                setItemsPerPage(Number(value));
                setCurrentPage(1); // Reset to first page when changing page size
              }}
            >
              <SelectTrigger className="h-8 w-[70px]">
                <SelectValue placeholder={itemsPerPage} />
              </SelectTrigger>
              <SelectContent side="top">
                {ITEMS_PER_PAGE_OPTIONS.map((pageSize) => (
                  <SelectItem key={pageSize} value={`${pageSize}`}>
                    {pageSize}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex w-[100px] items-center justify-center text-sm font-medium">
            Page {currentPage} of {totalPages}
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              className="h-8 w-8 p-0"
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
            >
              <span className="sr-only">Go to previous page</span>
              Previous
            </Button>
            <Button
              variant="outline"
              className="h-8 w-8 p-0"
              onClick={() =>
                setCurrentPage(Math.min(totalPages, currentPage + 1))
              }
              disabled={currentPage === totalPages}
            >
              <span className="sr-only">Go to next page</span>
              Next
            </Button>
          </div>
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

          <FilterButton
            title="Filter by simulation"
            options={simulationOptions}
            selectedValues={simulationFilter}
            onValueChange={setSimulationFilter}
          />

          <FilterButton
            title="Filter by cohort"
            options={cohortOptions}
            selectedValues={cohortFilter}
            onValueChange={setCohortFilter}
          />

          <FilterButton
            title="Filter by agent"
            options={agentOptions}
            selectedValues={agentFilter}
            onValueChange={setAgentFilter}
          />

          <FilterButton
            title="Filter by scenario type"
            options={scenarioTypeOptions}
            selectedValues={scenarioTypeFilter}
            onValueChange={setScenarioTypeFilter}
          />

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
      <div className="grid gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Scenarios</h2>
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

        <div className="grid gap-4">
          {getCurrentPageScenarios()
            .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
            .map(renderScenarioCard)}
          {getCurrentPageScenarios().length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              {filteredScenarios.length === 0
                ? "No scenarios match the current filters."
                : "No scenarios found."}
            </div>
          )}
        </div>
        {renderPagination()}
      </div>

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
