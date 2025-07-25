/**
 * SimulationPerformance.tsx
 * This component displays scenario performance within a selected simulation.
 * @AshokSaravanan222 & @siladiea
 * 07/23/2025
 */
"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Simulation } from "@/types";
import { getAllCohorts } from "@/utils/queries/cohorts/get-all-cohorts";
import { getAllProfiles } from "@/utils/queries/profiles/get-all-profiles";
import { getAllRubrics } from "@/utils/queries/rubrics/get-all-rubrics";
import { getAllScenarios } from "@/utils/queries/scenarios/get-all-scenarios";
import { getSimulationAttemptsByProfiles } from "@/utils/queries/simulation_attempts/get-simulation-attempts-by-profiles";
import { getSimulationChatGradesBySimulationChats } from "@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulationchats";
import { getSimulationChatsByAttempts } from "@/utils/queries/simulation_chats/get-simulation-chats-by-attempts";
import { getAllSimulations } from "@/utils/queries/simulations/get-all-simulations";
import { useQuery } from "@tanstack/react-query";
import { isAfter, isBefore } from "date-fns";
import { BarChart3, Check, ChevronsUpDown } from "lucide-react";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface SimulationPerformanceProps {
  dateStart: Date;
  dateEnd: Date;
  thresholds: {
    danger: number;
    warning: number;
    success: number;
  };
  profileId: string | undefined;
  cohortIds: string[];
}

export default function SimulationPerformance({
  dateStart,
  dateEnd,
  profileId,
  cohortIds,
  thresholds,
}: SimulationPerformanceProps) {
  const [selectedSimulation, setSelectedSimulation] =
    useState<Simulation | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Fetch data
  const { data: profiles } = useQuery({
    queryKey: ["profiles"],
    queryFn: () => getAllProfiles(),
  });

  const { data: cohorts } = useQuery({
    queryKey: ["cohorts"],
    queryFn: () => getAllCohorts(),
  });

  const { data: simulations } = useQuery({
    queryKey: ["simulations"],
    queryFn: () => getAllSimulations(),
  });

  const { data: scenarios } = useQuery({
    queryKey: ["scenarios"],
    queryFn: () => getAllScenarios(),
  });

  const { data: rubrics } = useQuery({
    queryKey: ["rubrics"],
    queryFn: () => getAllRubrics(),
  });

  // Calculate cohort-based filters
  const cohortFilters = useMemo(() => {
    if (!cohorts || !cohortIds || cohortIds.length === 0) {
      return {
        allowedProfileIds: null,
        allowedSimulationIds: null,
        hasMatchingCohorts: true, // Show all data if no cohort filtering
      };
    }

    // Filter cohorts based on provided cohortIds
    const matchingCohorts = cohorts.filter((cohort) =>
      cohortIds.includes(cohort.id)
    );

    if (matchingCohorts.length === 0) {
      return {
        allowedProfileIds: null,
        allowedSimulationIds: null,
        hasMatchingCohorts: false,
      };
    }

    // Extract all profileIds and simulationIds from matching cohorts
    const allProfileIds = new Set<string>();
    const allSimulationIds = new Set<string>();

    matchingCohorts.forEach((cohort) => {
      cohort.profileIds?.forEach((id) => allProfileIds.add(id));
      cohort.simulationIds?.forEach((id) => allSimulationIds.add(id));
    });

    return {
      allowedProfileIds: Array.from(allProfileIds),
      allowedSimulationIds: Array.from(allSimulationIds),
      hasMatchingCohorts: true,
    };
  }, [cohorts, cohortIds]);

  const { data: attempts } = useQuery({
    queryKey: ["simulationAttempts", profiles?.map((profile) => profile.id)],
    queryFn: () =>
      getSimulationAttemptsByProfiles(profiles!.map((profile) => profile.id)),
    enabled: !!profiles && profiles.length > 0,
  });

  const { data: chats } = useQuery({
    queryKey: ["simulationChats", attempts?.map((attempt) => attempt.id)],
    queryFn: () =>
      getSimulationChatsByAttempts(attempts!.map((attempt) => attempt.id)),
    enabled: !!attempts && attempts.length > 0,
  });

  const { data: grades } = useQuery({
    queryKey: ["simulationGrades", chats?.map((chat) => chat.id)],
    queryFn: () =>
      getSimulationChatGradesBySimulationChats(chats!.map((chat) => chat.id)),
    enabled: !!chats && chats.length > 0,
  });

  // Filter simulations to exclude practice simulations and those without data
  const availableSimulations = useMemo(() => {
    if (!simulations || !chats || !grades || !attempts || !profiles) return [];

    // First, get all non-practice, active simulations
    const activeSimulations = simulations
      .filter((sim) => !sim.practiceSimulation && sim.active)
      .map((sim) => ({
        ...sim,
        id: sim.id,
        title: sim.title,
        description: `Simulation with ${sim.scenarioIds?.length || 0} scenarios`,
        scenarioIds: sim.scenarioIds || [],
        active: sim.active,
        practiceSimulation: sim.practiceSimulation,
        rubricId: sim.rubricId,
      }));

    // Apply cohort-based simulation filtering
    const cohortFilteredSimulations = cohortFilters.allowedSimulationIds
      ? activeSimulations.filter((sim) =>
          cohortFilters.allowedSimulationIds!.includes(sim.id)
        )
      : activeSimulations;

    // Filter out simulations that don't have data in the selected date range
    const simulationsWithData = cohortFilteredSimulations.filter((sim) => {
      // Check if this simulation has any attempts in the date range
      const simulationAttempts = attempts.filter(
        (attempt) => attempt.simulationId === sim.id
      );

      if (simulationAttempts.length === 0) return false;

      // Check if any of these attempts have grades in the date range
      const simulationChats = chats.filter((chat) =>
        simulationAttempts.some((attempt) => attempt.id === chat.attemptId)
      );

      const simulationGrades = grades.filter((grade) => {
        const gradeDate = new Date(grade.createdAt);
        const chat = simulationChats.find(
          (c) => c.id === grade.simulationChatId
        );
        if (!chat) return false;

        const attempt = attempts.find((a) => a.id === chat.attemptId);
        const profile = profiles?.find((p) => p.id === attempt?.profileId);

        // Check date range
        const inDateRange =
          isAfter(gradeDate, dateStart) && isBefore(gradeDate, dateEnd);

        // Filter by TA role
        const isTA = profile?.role === "ta";

        // Filter by profile if provided
        const profileMatch = profileId
          ? attempt?.profileId === profileId
          : true;

        // Apply cohort-based profile filtering
        const cohortProfileMatch = cohortFilters.allowedProfileIds
          ? profile && cohortFilters.allowedProfileIds.includes(profile.id)
          : true;

        return inDateRange && isTA && profileMatch && cohortProfileMatch;
      });

      // Only include simulations that have at least 1 grade (reduced from 2 for better data visibility)
      return simulationGrades.length >= 1;
    });

    return simulationsWithData;
  }, [
    simulations,
    chats,
    grades,
    attempts,
    profiles,
    dateStart,
    dateEnd,
    profileId,
    cohortFilters,
  ]);

  // Auto-select simulation if enabled and available
  useMemo(() => {
    if (availableSimulations.length > 0) {
      // If no simulation is selected, select the first one
      if (!selectedSimulation) {
        const firstSimulation = availableSimulations[0];
        if (firstSimulation) {
          setSelectedSimulation(firstSimulation);
        }
      } else {
        // If selected simulation is no longer available, select the first available one
        const isStillAvailable = availableSimulations.some(
          (sim) => sim.id === selectedSimulation.id
        );
        if (!isStillAvailable) {
          const firstSimulation = availableSimulations[0];
          if (firstSimulation) {
            setSelectedSimulation(firstSimulation);
          }
        }
      }
    }
  }, [availableSimulations, selectedSimulation]);

  // Calculate scenario performance data for selected simulation
  const scenarioPerformanceData = useMemo(() => {
    if (
      !selectedSimulation ||
      !scenarios ||
      !chats ||
      !grades ||
      !attempts ||
      !profiles ||
      !rubrics
    ) {
      return [];
    }

    // Get rubric for score calculation
    const rubric = rubrics.find((r) => r.id === selectedSimulation.rubricId);
    const rubricTotalPoints = rubric?.points || 100;

    // Filter data by date range, selected simulation, and filter by TA role
    const filteredGrades = grades.filter((grade) => {
      const gradeDate = new Date(grade.createdAt);
      const chat = chats.find((c) => c.id === grade.simulationChatId);
      const attempt = attempts.find((a) => a.id === chat?.attemptId);
      const profile = profiles?.find((p) => p.id === attempt?.profileId);

      // Check date range
      const inDateRange =
        isAfter(gradeDate, dateStart) && isBefore(gradeDate, dateEnd);

      // Check if it's from the selected simulation
      const isSelectedSimulation =
        attempt?.simulationId === selectedSimulation.id;

      // Filter by TA role
      const isTA = profile?.role === "ta";

      // Filter by profile if provided
      const profileMatch = profileId ? attempt?.profileId === profileId : true;

      // Apply cohort-based profile filtering
      const cohortProfileMatch = cohortFilters.allowedProfileIds
        ? profile && cohortFilters.allowedProfileIds.includes(profile.id)
        : true;

      return (
        inDateRange &&
        isSelectedSimulation &&
        isTA &&
        profileMatch &&
        cohortProfileMatch
      );
    });

    if (filteredGrades.length === 0) return [];

    // Get scenarios for the selected simulation
    const simulationScenarios = scenarios.filter((scenario) =>
      selectedSimulation.scenarioIds.includes(scenario.id)
    );

    // Calculate performance for each scenario
    const scenarioData = simulationScenarios
      .map((scenario) => {
        const scenarioChats = chats.filter(
          (chat) => chat.scenarioId === scenario.id
        );
        const scenarioGrades = filteredGrades.filter((grade) =>
          scenarioChats.some((chat) => chat.id === grade.simulationChatId)
        );

        if (scenarioGrades.length === 0) return null;

        const completedChats = scenarioChats.filter((chat) => chat.completed);
        const successRate = Math.round(
          (completedChats.length / scenarioChats.length) * 100
        );

        // Calculate average score as percentage
        const avgScore = Math.round(
          (scenarioGrades.reduce((sum, grade) => sum + grade.score, 0) /
            scenarioGrades.length /
            rubricTotalPoints) *
            100
        );

        // Calculate performance trend (simple comparison with previous period)
        const midPoint = new Date(
          (dateStart.getTime() + dateEnd.getTime()) / 2
        );
        const recentGrades = scenarioGrades.filter(
          (grade) => new Date(grade.createdAt) >= midPoint
        );
        const olderGrades = scenarioGrades.filter(
          (grade) => new Date(grade.createdAt) < midPoint
        );

        let performanceChange = 0;
        if (recentGrades.length > 0 && olderGrades.length > 0) {
          const recentAvg =
            recentGrades.reduce((sum, grade) => sum + grade.score, 0) /
            recentGrades.length;
          const olderAvg =
            olderGrades.reduce((sum, grade) => sum + grade.score, 0) /
            olderGrades.length;
          performanceChange = Math.round(
            ((recentAvg - olderAvg) / rubricTotalPoints) * 100
          );
        }

        return {
          scenarioId: scenario.id,
          scenarioName: scenario.name,
          avgScore,
          successRate,
          performanceChange,
          totalAttempts: scenarioChats.length,
          completedAttempts: completedChats.length,
          color:
            avgScore >= thresholds.success
              ? "#10b981"
              : avgScore >= thresholds.warning
                ? "#f59e0b"
                : "#ef4444",
        };
      })
      .filter(
        (item): item is NonNullable<typeof item> =>
          item !== null && item.totalAttempts >= 1 // Reduced from 2 to 1
      )
      .sort((a, b) => b.avgScore - a.avgScore);

    return scenarioData;
  }, [
    selectedSimulation,
    scenarios,
    chats,
    grades,
    attempts,
    profiles,
    rubrics,
    dateStart,
    dateEnd,
    profileId,
    thresholds,
    cohortFilters,
  ]);

  // Calculate insights
  const insights = useMemo(() => {
    if (!scenarioPerformanceData.length) {
      return "No scenario data available for analysis.";
    }

    const totalChange = scenarioPerformanceData.reduce(
      (sum, scenario) => sum + scenario.performanceChange,
      0
    );
    const avgChange = Math.round(totalChange / scenarioPerformanceData.length);

    // Generate insights
    const topPerformer = scenarioPerformanceData[0];
    const bottomPerformer =
      scenarioPerformanceData[scenarioPerformanceData.length - 1];
    const avgScore = Math.round(
      scenarioPerformanceData.reduce(
        (sum, scenario) => sum + scenario.avgScore,
        0
      ) / scenarioPerformanceData.length
    );

    let insightText = "";
    if (avgChange > 5) {
      insightText = `Scenarios show strong improvement (+${avgChange}%). ${topPerformer?.scenarioName || "Unknown"} leads with ${topPerformer?.avgScore || 0}% average score.`;
    } else if (avgChange < -5) {
      insightText = `Performance declined by ${Math.abs(avgChange)}%. Focus on ${bottomPerformer?.scenarioName || "Unknown"} (${bottomPerformer?.avgScore || 0}%) for improvement.`;
    } else {
      insightText = `Stable performance with ${avgScore}% average. ${topPerformer?.scenarioName || "Unknown"} excels at ${topPerformer?.avgScore || 0}%.`;
    }

    return insightText;
  }, [scenarioPerformanceData]);

  // Calculate threshold status based on scenario performance
  const getThresholdStatus = () => {
    if (!scenarioPerformanceData.length) return "neutral";

    // Calculate average performance across all scenarios
    const avgPerformance =
      scenarioPerformanceData.reduce(
        (sum, scenario) => sum + scenario.avgScore,
        0
      ) / scenarioPerformanceData.length;

    // Consider both average score and success rate
    const avgSuccessRate =
      scenarioPerformanceData.reduce(
        (sum, scenario) => sum + scenario.successRate,
        0
      ) / scenarioPerformanceData.length;

    const combinedScore = avgPerformance * 0.7 + avgSuccessRate * 0.3;

    if (combinedScore >= thresholds.success) return "success";
    if (combinedScore >= thresholds.warning) return "warning";
    return "danger";
  };

  const thresholdStatus = getThresholdStatus();

  // Show no data message if no matching cohorts found
  if (!cohortFilters.hasMatchingCohorts) {
    return (
      <Card className="w-full h-full flex flex-col">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Scenario Performance
          </CardTitle>
          <CardDescription className="text-sm">
            Performance trends for scenarios within simulations
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center flex-1">
          <div className="text-center space-y-2">
            <p className="text-muted-foreground text-sm">
              No data available for the selected cohorts.
            </p>
            <p className="text-xs text-muted-foreground">
              The selected profile is not a member of any of the specified
              cohorts.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!availableSimulations.length) {
    return (
      <Card className="w-full h-full flex flex-col">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Scenario Performance
          </CardTitle>
          <CardDescription className="text-sm">
            Performance trends for scenarios within simulations
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center flex-1">
          <div className="text-center space-y-2">
            <p className="text-muted-foreground text-sm">
              No simulations with data available for the selected time period.
            </p>
            <p className="text-xs text-muted-foreground">
              This could be due to:
            </p>
            <ul className="text-xs text-muted-foreground text-left list-disc list-inside space-y-1">
              <li>No TA role profiles in the selected date range</li>
              <li>No completed simulation attempts</li>
              <li>No simulations with sufficient data (≥1 grade)</li>
              <li>Date range too restrictive</li>
              <li>No matching simulations in selected cohorts</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full h-full flex flex-col relative">
      <div
        className={`absolute top-2 right-2 w-2 h-2 rounded-full ${
          thresholdStatus === "success"
            ? "bg-green-500"
            : thresholdStatus === "warning"
              ? "bg-yellow-500"
              : thresholdStatus === "danger"
                ? "bg-red-500"
                : "bg-gray-400"
        }`}
      />
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Simulation Performance
            </CardTitle>
            <CardDescription className="text-sm">
              Performance trends for scenarios within simulations
            </CardDescription>
          </div>

          {/* Simulation Picker */}
          <div className="flex items-center gap-2">
            <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={pickerOpen}
                  className="w-48 justify-between text-sm h-8"
                >
                  <span className="truncate text-left">
                    {selectedSimulation
                      ? selectedSimulation.title
                      : "Select simulation..."}
                  </span>
                  <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-0">
                <Command>
                  <CommandInput placeholder="Search simulations..." />
                  <CommandEmpty>No simulation found.</CommandEmpty>
                  <CommandGroup>
                    {availableSimulations.map((simulation) => (
                      <CommandItem
                        key={simulation.id}
                        value={simulation.id}
                        onSelect={() => {
                          setSelectedSimulation(simulation);
                          setPickerOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4 shrink-0",
                            selectedSimulation?.id === simulation.id
                              ? "opacity-100"
                              : "opacity-0"
                          )}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">
                            {simulation.title}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {simulation.description}
                          </div>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 flex-1 flex flex-col">
        {!selectedSimulation ? (
          <div className="flex items-center justify-center flex-1">
            <p className="text-muted-foreground text-sm">
              Please select a simulation to view scenario performance.
            </p>
          </div>
        ) : !scenarioPerformanceData.length ? (
          <div className="flex items-center justify-center flex-1">
            <p className="text-muted-foreground text-sm">
              No scenario data available for the selected simulation and time
              period.
            </p>
          </div>
        ) : (
          <>
            {/* Bar Chart */}
            <div className="flex-1 min-h-[200px] h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={scenarioPerformanceData}
                  margin={{ top: 10, right: 10, bottom: 30, left: 10 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-muted"
                  />
                  <XAxis
                    dataKey="scenarioName"
                    fontSize={10}
                    height={40}
                    angle={-45}
                    textAnchor="end"
                    tickFormatter={(name: string) =>
                      name.length > 12 ? name.slice(0, 11) + "…" : name
                    }
                  />
                  <YAxis domain={[0, 100]} fontSize={10} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--background))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "6px",
                    }}
                    formatter={(value: number, name: string) => [
                      `${value}%`,
                      name === "avgScore" ? "Average Score" : "Success Rate",
                    ]}
                  />
                  <Bar
                    dataKey="avgScore"
                    fill="#3b82f6"
                    name="Average Score"
                    radius={[2, 2, 0, 0]}
                  />
                  <Bar
                    dataKey="successRate"
                    fill="#10b981"
                    name="Success Rate"
                    radius={[2, 2, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Legend */}
            <div className="flex items-center justify-center gap-4 text-xs">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded bg-blue-500"></div>
                <span>Average Score</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded bg-green-500"></div>
                <span>Success Rate</span>
              </div>
            </div>

            {/* Data-Driven Insights */}
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground leading-relaxed">
                {insights}
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
