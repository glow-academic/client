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
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { getAllProfiles } from "@/utils/queries/profiles/get-all-profiles";
import { getAllScenarios } from "@/utils/queries/scenarios/get-all-scenarios";
import { getSimulationAttemptsByProfiles } from "@/utils/queries/simulation_attempts/get-simulation-attempts-by-profiles";
import { getSimulationChatGradesBySimulationChats } from "@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulationchats";
import { getSimulationChatsByAttempts } from "@/utils/queries/simulation_chats/get-simulation-chats-by-attempts";
import { getAllSimulations } from "@/utils/queries/simulations/get-all-simulations";
import { useQuery } from "@tanstack/react-query";
import { isAfter, isBefore } from "date-fns";
import {
  BarChart3,
  Check,
  ChevronsUpDown,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
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
  profileId?: string;
  thresholds: {
    danger: number;
    warning: number;
    success: number;
  };
  autoSelectSimulation?: boolean; // New prop to control auto-selection
}

interface Simulation {
  id: string;
  title: string;
  description?: string;
  scenarioIds: string[];
  active: boolean;
  practiceSimulation: boolean;
}

export default function SimulationPerformance({
  dateStart,
  dateEnd,
  profileId,
  thresholds,
  autoSelectSimulation = true,
}: SimulationPerformanceProps) {
  const [selectedSimulation, setSelectedSimulation] =
    useState<Simulation | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Fetch data
  const { data: profiles } = useQuery({
    queryKey: ["profiles"],
    queryFn: () => getAllProfiles(),
  });

  const { data: simulations } = useQuery({
    queryKey: ["simulations"],
    queryFn: () => getAllSimulations(),
  });

  const { data: scenarios } = useQuery({
    queryKey: ["scenarios"],
    queryFn: () => getAllScenarios(),
  });

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
        id: sim.id,
        title: sim.title,
        description: `Simulation with ${sim.scenarioIds?.length || 0} scenarios`,
        scenarioIds: sim.scenarioIds || [],
        active: sim.active,
        practiceSimulation: sim.practiceSimulation,
      }));

    // Filter out simulations that don't have data in the selected date range
    const simulationsWithData = activeSimulations.filter((sim) => {
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

        return inDateRange && isTA && profileMatch;
      });

      // Only include simulations that have at least 2 grades (minimum for meaningful data)
      return simulationGrades.length >= 2;
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
  ]);

  // Auto-select simulation if enabled and available
  useMemo(() => {
    if (autoSelectSimulation && availableSimulations.length > 0) {
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
  }, [autoSelectSimulation, availableSimulations, selectedSimulation]);

  // Calculate scenario performance data for selected simulation
  const scenarioPerformanceData = useMemo(() => {
    if (
      !selectedSimulation ||
      !scenarios ||
      !chats ||
      !grades ||
      !attempts ||
      !profiles
    ) {
      return [];
    }

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

      return inDateRange && isSelectedSimulation && isTA && profileMatch;
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

        const avgScore = Math.round(
          scenarioGrades.reduce((sum, grade) => sum + grade.score, 0) /
            scenarioGrades.length
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
          performanceChange = Math.round(recentAvg - olderAvg);
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
          item !== null && item.totalAttempts >= 2
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
    dateStart,
    dateEnd,
    profileId,
    thresholds,
  ]);

  // Calculate overall performance trend
  const overallTrend = useMemo(() => {
    if (!scenarioPerformanceData.length) return { value: 0, isPositive: true };

    const totalChange = scenarioPerformanceData.reduce(
      (sum, scenario) => sum + scenario.performanceChange,
      0
    );
    const avgChange = Math.round(totalChange / scenarioPerformanceData.length);

    return {
      value: avgChange,
      isPositive: avgChange >= 0,
    };
  }, [scenarioPerformanceData]);

  if (!availableSimulations.length) {
    return (
      <Card className="w-full h-full flex flex-col">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Scenario Performance
          </CardTitle>
          <CardDescription>
            Performance trends for scenarios within simulations
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center flex-1">
          <div className="text-center space-y-2">
            <p className="text-muted-foreground">
              No simulations with data available for the selected time period.
            </p>
            <p className="text-xs text-muted-foreground">
              This could be due to:
            </p>
            <ul className="text-xs text-muted-foreground text-left list-disc list-inside space-y-1">
              <li>No TA role profiles in the selected date range</li>
              <li>No completed simulation attempts</li>
              <li>No simulations with sufficient data (≥2 grades)</li>
              <li>Date range too restrictive</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full h-full flex flex-col">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Scenario Performance
            </CardTitle>
            <CardDescription>
              Performance trends for scenarios within simulations
            </CardDescription>
          </div>

          {/* Simulation Picker */}
          <div className="flex items-center gap-2">
            <Label className="text-sm font-medium">Simulation:</Label>
            <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={pickerOpen}
                  className="w-48 justify-between"
                >
                  {selectedSimulation
                    ? selectedSimulation.title
                    : "Select simulation..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-48 p-0">
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
                            "mr-2 h-4 w-4",
                            selectedSimulation?.id === simulation.id
                              ? "opacity-100"
                              : "opacity-0"
                          )}
                        />
                        <div>
                          <div className="font-medium">{simulation.title}</div>
                          <div className="text-xs text-muted-foreground">
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

      <CardContent className="space-y-6 flex-1 flex flex-col">
        {!selectedSimulation ? (
          <div className="flex items-center justify-center flex-1">
            <p className="text-muted-foreground">
              Please select a simulation to view scenario performance.
            </p>
          </div>
        ) : !scenarioPerformanceData.length ? (
          <div className="flex items-center justify-center flex-1">
            <p className="text-muted-foreground">
              No scenario data available for the selected simulation and time
              period.
            </p>
          </div>
        ) : (
          <>
            {/* Performance Summary */}
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Overall Trend:</span>
                  <div className="flex items-center gap-1">
                    {overallTrend.isPositive ? (
                      <TrendingUp className="h-4 w-4 text-green-600" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-red-600" />
                    )}
                    <span
                      className={`text-sm font-medium ${
                        overallTrend.isPositive
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      {overallTrend.isPositive ? "+" : ""}
                      {overallTrend.value}%
                    </span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Average performance change across all scenarios
                </p>
              </div>

              <div className="text-right">
                <div className="text-sm font-medium">
                  {scenarioPerformanceData.length} scenarios
                </div>
                <div className="text-xs text-muted-foreground">
                  with sufficient data
                </div>
              </div>
            </div>

            {/* Bar Chart */}
            <div className="flex-1 min-h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={scenarioPerformanceData}
                  margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-muted"
                  />
                  <XAxis
                    dataKey="scenarioName"
                    fontSize={12}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                  />
                  <YAxis domain={[0, 100]} fontSize={12} />
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
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="successRate"
                    fill="#10b981"
                    name="Success Rate"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Legend */}
            <div className="flex items-center justify-center gap-6 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-blue-500"></div>
                <span>Average Score</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-green-500"></div>
                <span>Success Rate</span>
              </div>
            </div>

            {/* Insights */}
            <div className="text-sm text-muted-foreground">
              <p className="leading-relaxed">
                {overallTrend.isPositive
                  ? `Scenarios in ${selectedSimulation.title} show an average improvement of ${overallTrend.value}%.`
                  : `Scenarios in ${selectedSimulation.title} show an average decline of ${Math.abs(overallTrend.value)}%.`}{" "}
                Each bar represents a scenario's performance metrics.
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
