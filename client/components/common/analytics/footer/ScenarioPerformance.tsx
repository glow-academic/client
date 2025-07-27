/**
 * ScenarioPerformance.tsx
 * This component displays scenario attribute breakdown with performance metrics.
 * Shows what percentage of scenarios use each specific attribute and their performance.
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { getAllCohorts } from "@/utils/queries/cohorts/get-all-cohorts";
import { getAllParameterItems } from "@/utils/queries/parameter_items/get-all-parameter-items";
import { getAllParameters } from "@/utils/queries/parameters/get-all-parameters";
import { getAllProfiles } from "@/utils/queries/profiles/get-all-profiles";
import { getAllScenarios } from "@/utils/queries/scenarios/get-all-scenarios";
import { getSimulationAttemptsByProfiles } from "@/utils/queries/simulation_attempts/get-simulation-attempts-by-profiles";
import { getSimulationChatGradesBySimulationChats } from "@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulationchats";
import { getSimulationChatsByAttempts } from "@/utils/queries/simulation_chats/get-simulation-chats-by-attempts";
import { getAllSimulations } from "@/utils/queries/simulations/get-all-simulations";
import { useQuery } from "@tanstack/react-query";
import { format, isAfter, isBefore } from "date-fns";
import { BarChart3, Check, ChevronsUpDown } from "lucide-react";
import { useMemo, useState } from "react";
import {
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface ScenarioPerformanceProps {
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

interface AttributeElement {
  id: string;
  name: string;
  displayName: string;
  icon: string;
  color: string;
  count: number;
  percentage: number;
  avgScore: number;
  completionRate: number;
  totalAttempts: number;
  trendData: Array<{
    date: string;
    score: number;
    timestamp: number;
  }>;
  insight: string;
}

interface ParameterOption {
  id: string; // parameterId
  name: string;
  description: string;
}

export default function ScenarioPerformance({
  dateStart,
  dateEnd,
  profileId,
  thresholds,
  cohortIds,
}: ScenarioPerformanceProps) {
  const [selectedParameterId, setSelectedParameterId] = useState<string>("");
  const [pickerOpen, setPickerOpen] = useState(false);

  // Helper function to format time values
  const formatTimeValue = (timeString: string) => {
    try {
      const time = new Date(`1970-01-01T${timeString}`);
      return time.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    } catch {
      return timeString;
    }
  };

  // Fetch data
  const { data: profiles } = useQuery({
    queryKey: ["profiles"],
    queryFn: () => getAllProfiles(),
  });

  const { data: cohorts } = useQuery({
    queryKey: ["cohorts"],
    queryFn: () => getAllCohorts(),
  });

  const { data: scenarios } = useQuery({
    queryKey: ["scenarios"],
    queryFn: () => getAllScenarios(),
  });

  const { data: simulations } = useQuery({
    queryKey: ["simulations"],
    queryFn: () => getAllSimulations(),
  });

  const { data: parameters } = useQuery({
    queryKey: ["parameters"],
    queryFn: () => getAllParameters(),
  });

  const { data: parameterItems } = useQuery({
    queryKey: ["parameterItems"],
    queryFn: () => getAllParameterItems(),
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

  // Get non-numerical parameters only
  const nonNumericalParameters = useMemo(() => {
    return parameters?.filter((p) => !p.numerical && p.active) || [];
  }, [parameters]);

  // Set default selected parameter if none selected and we have non-numerical parameters
  const selectedParameter = useMemo(() => {
    if (!selectedParameterId && nonNumericalParameters.length > 0) {
      const firstParameter = nonNumericalParameters[0];
      if (firstParameter) {
        setSelectedParameterId(firstParameter.id);
        return firstParameter;
      }
    }
    return nonNumericalParameters.find((p) => p.id === selectedParameterId);
  }, [selectedParameterId, nonNumericalParameters]);

  // Get parameter items for the selected parameter
  const parameterItemsForSelected = useMemo(() => {
    if (!parameterItems || !selectedParameter) return [];
    return parameterItems
      .filter((item) => item.parameterId === selectedParameter.id)
      .sort((a, b) => a.value.localeCompare(b.value));
  }, [parameterItems, selectedParameter]);

  // Generate parameter options from non-numerical parameters
  const PARAMETER_OPTIONS: ParameterOption[] = useMemo(() => {
    return nonNumericalParameters.map((parameter) => ({
      id: parameter.id,
      name: parameter.name,
      description: `Performance by ${parameter.name.toLowerCase()} value`,
    }));
  }, [nonNumericalParameters]);

  // Helper function to get allowed simulation IDs based on cohort filtering
  const getAllowedSimulationIds = useMemo(() => {
    if (!cohorts || !cohortIds || cohortIds.length === 0) {
      return null; // No cohort filtering, allow all simulations
    }

    // Filter cohorts to only those in cohortIds
    const filteredCohorts = cohorts.filter((cohort) =>
      cohortIds.includes(cohort.id),
    );

    if (filteredCohorts.length === 0) {
      return []; // No matching cohorts, no data allowed
    }

    // If profileId is provided, check if profile belongs to any of the filtered cohorts
    if (profileId) {
      const profileInCohorts = filteredCohorts.some((cohort) =>
        cohort.profileIds.includes(profileId),
      );

      if (!profileInCohorts) {
        return []; // Profile not in any of the specified cohorts, no data allowed
      }
    }

    // Get union of all simulation IDs from matching cohorts
    const allowedSimulationIds = new Set<string>();
    filteredCohorts.forEach((cohort) => {
      cohort.simulationIds.forEach((simId) => {
        if (simId !== "RAY") {
          // Exclude placeholder
          allowedSimulationIds.add(simId);
        }
      });
    });

    return Array.from(allowedSimulationIds);
  }, [cohorts, cohortIds, profileId]);

  // Calculate attribute breakdown
  const attributeElements = useMemo(() => {
    if (
      !scenarios ||
      !simulations ||
      !chats ||
      !grades ||
      !attempts ||
      !profiles ||
      !parameterItemsForSelected ||
      !selectedParameter
    ) {
      return [];
    }

    // Filter grades by date range, exclude practice simulations, and filter by TA role
    let filteredGrades = grades.filter((grade) => {
      const gradeDate = new Date(grade.createdAt);
      const chat = chats.find((c) => c.id === grade.simulationChatId);
      const attempt = attempts.find((a) => a.id === chat?.attemptId);
      const simulation = simulations.find(
        (s) => s.id === attempt?.simulationId,
      );
      const profile = profiles?.find((p) => p.id === attempt?.profileId);

      // Check date range
      const inDateRange =
        isAfter(gradeDate, dateStart) && isBefore(gradeDate, dateEnd);

      // Exclude practice simulations
      const notPractice = !simulation?.practiceSimulation;

      // Filter by TA role (temporarily relaxed for debugging)
      const isTA = profile?.role === "ta" || true; // Temporarily allow all roles for debugging

      // Filter by profile if provided
      const profileMatch = profileId ? attempt?.profileId === profileId : true;

      return inDateRange && notPractice && isTA && profileMatch;
    });

    // Apply cohort filtering if simulation IDs are restricted
    if (getAllowedSimulationIds !== null) {
      if (getAllowedSimulationIds.length === 0) {
        return []; // No data allowed due to cohort restrictions
      }

      filteredGrades = filteredGrades.filter((grade) => {
        const chat = chats.find((c) => c.id === grade.simulationChatId);
        const attempt = attempts.find((a) => a.id === chat?.attemptId);
        return getAllowedSimulationIds.includes(attempt?.simulationId || "");
      });
    }

    if (filteredGrades.length === 0) {
      return [];
    }

    // Get all scenarios that were attempted in the filtered data
    const attemptedScenarioIds = new Set<string>();
    filteredGrades.forEach((grade) => {
      const chat = chats.find((c) => c.id === grade.simulationChatId);
      if (chat) {
        attemptedScenarioIds.add(chat.scenarioId);
      }
    });

    const attemptedScenarios = scenarios.filter((scenario) =>
      attemptedScenarioIds.has(scenario.id),
    );

    // Calculate total scenarios for percentage calculation
    const totalScenarios = attemptedScenarios.length;

    // Generate colors for each attribute
    const colors = [
      "#3b82f6",
      "#ef4444",
      "#10b981",
      "#f59e0b",
      "#8b5cf6",
      "#06b6d4",
      "#84cc16",
      "#f97316",
      "#ec4899",
      "#6366f1",
      "#14b8a6",
      "#f43f5e",
    ];

    // Analyze each parameter item
    const elements: AttributeElement[] = parameterItemsForSelected.map(
      (paramItem, index) => {
        // Find scenarios that use this parameter item
        const scenariosWithAttribute = attemptedScenarios.filter((scenario) => {
          return scenario.parameterItemIds?.includes(paramItem.id);
        });

        const count = scenariosWithAttribute.length;
        const percentage =
          totalScenarios > 0 ? (count / totalScenarios) * 100 : 0;

        // Calculate performance metrics for this attribute
        let totalScore = 0;
        let totalCompletion = 0;
        let totalAttempts = 0;
        let gradeCount = 0;

        // Collect grades for trend data
        const attributeGrades: Array<{ score: number; createdAt: string }> = [];

        scenariosWithAttribute.forEach((scenario) => {
          const scenarioChats = chats.filter(
            (chat) => chat.scenarioId === scenario.id,
          );
          const scenarioGrades = filteredGrades.filter((grade) => {
            const chat = chats.find((c) => c.id === grade.simulationChatId);
            return chat?.scenarioId === scenario.id;
          });

          scenarioGrades.forEach((grade) => {
            totalScore += grade.score;
            gradeCount++;
            attributeGrades.push({
              score: grade.score,
              createdAt: grade.createdAt,
            });
          });

          scenarioChats.forEach((chat) => {
            if (chat.completed) {
              totalCompletion++;
            }
            totalAttempts++;
          });
        });

        const avgScore = gradeCount > 0 ? totalScore / gradeCount : 0;
        const completionRate =
          totalAttempts > 0 ? (totalCompletion / totalAttempts) * 100 : 0;

        // Calculate trend data for line chart
        const trendData = attributeGrades
          .map((grade) => ({
            date: format(new Date(grade.createdAt), "MMM dd"),
            score: Math.round(grade.score),
            timestamp: new Date(grade.createdAt).getTime(),
          }))
          .sort((a, b) => a.timestamp - b.timestamp);

        // Generate insight for this attribute
        let insight = "";
        if (trendData.length >= 2) {
          const recentScores = trendData.slice(-3);
          const earlierScores = trendData.slice(0, 3);

          if (recentScores.length > 0 && earlierScores.length > 0) {
            const recentAvg =
              recentScores.reduce((sum, item) => sum + item.score, 0) /
              recentScores.length;
            const earlierAvg =
              earlierScores.reduce((sum, item) => sum + item.score, 0) /
              earlierScores.length;
            const improvement = recentAvg - earlierAvg;

            if (improvement > 5) {
              insight = `Performance has improved by ${Math.round(improvement)}% recently. Consider using this ${selectedParameter.name.toLowerCase()} more frequently.`;
            } else if (improvement < -5) {
              insight = `Performance has declined by ${Math.round(Math.abs(improvement))}% recently. Review training approach for this ${selectedParameter.name.toLowerCase()}.`;
            } else {
              insight = `Performance has remained stable. Current average score is ${Math.round(avgScore)}% with ${Math.round(completionRate)}% completion rate.`;
            }
          }
        } else {
          insight = `Limited data available. Current average score is ${Math.round(avgScore)}% with ${Math.round(completionRate)}% completion rate.`;
        }

        // Format display name based on parameter type
        let displayName = paramItem.value;
        if (selectedParameter.name.toLowerCase().includes("time")) {
          displayName = formatTimeValue(paramItem.value);
        }

        return {
          id: paramItem.id,
          name: paramItem.value,
          displayName,
          icon: "📊", // Generic icon since we don't have specific icons for parameters
          color: colors[index % colors.length] || "#3b82f6",
          count,
          percentage: Math.round(percentage * 10) / 10, // Round to 1 decimal place
          avgScore: Math.round(avgScore),
          completionRate: Math.round(completionRate),
          totalAttempts,
          trendData,
          insight,
        };
      },
    );

    // Filter out attributes with no usage and sort by percentage descending
    return elements
      .filter((element) => element.count > 0)
      .sort((a, b) => b.percentage - a.percentage);
  }, [
    scenarios,
    simulations,
    chats,
    grades,
    attempts,
    profiles,
    dateStart,
    dateEnd,
    profileId,
    parameterItemsForSelected,
    selectedParameter,
    getAllowedSimulationIds,
  ]);

  // Calculate threshold status based on attribute performance
  const getThresholdStatus = () => {
    if (attributeElements.length === 0) return "neutral";

    // Calculate average performance across all attributes
    const avgPerformance =
      attributeElements.reduce((sum, element) => sum + element.avgScore, 0) /
      attributeElements.length;

    if (avgPerformance >= thresholds.success) return "success";
    if (avgPerformance >= thresholds.warning) return "warning";
    return "danger";
  };

  const thresholdStatus = getThresholdStatus();

  const selectedParameterOption = PARAMETER_OPTIONS.find(
    (p) => p.id === selectedParameterId,
  );

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
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Scenario Attribute Breakdown
            </CardTitle>
            <CardDescription>
              Performance analysis by scenario attributes
            </CardDescription>
          </div>

          {/* Parameter Picker */}
          <div className="flex items-center gap-2">
            <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={pickerOpen}
                  className="w-48 justify-between"
                >
                  <div className="flex items-center gap-2">
                    <span>
                      {selectedParameterOption?.name || "Select Parameter"}
                    </span>
                  </div>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-48 p-0">
                <Command>
                  <CommandInput placeholder="Search parameters..." />
                  <CommandEmpty>No parameter found.</CommandEmpty>
                  <CommandGroup>
                    {PARAMETER_OPTIONS.map((parameter) => (
                      <CommandItem
                        key={parameter.id}
                        value={parameter.id}
                        onSelect={() => {
                          setSelectedParameterId(parameter.id);
                          setPickerOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            selectedParameterId === parameter.id
                              ? "opacity-100"
                              : "opacity-0",
                          )}
                        />
                        <div>
                          <div className="font-medium">{parameter.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {parameter.description}
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
        {attributeElements.length === 0 ? (
          <div className="flex items-center justify-center flex-1">
            <p className="text-muted-foreground">
              No scenario data available for the selected time period.
            </p>
          </div>
        ) : (
          <>
            {/* Pie Chart */}
            <div className="flex-1 min-h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={attributeElements}
                    dataKey="percentage"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={120}
                    innerRadius={60}
                    paddingAngle={2}
                  >
                    {attributeElements.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--background))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "6px",
                    }}
                    formatter={(
                      value: number,
                      name: string,
                      _props: unknown,
                    ) => {
                      const element = attributeElements.find(
                        (e) => e.name === name,
                      );
                      if (!element) return [value, name];

                      return [
                        <div key="tooltip" className="space-y-2">
                          <div className="font-medium">
                            {element.icon} {element.displayName}
                          </div>
                          <div className="text-sm space-y-1">
                            <div>Usage: {element.percentage}%</div>
                            <div>Scenarios: {element.count}</div>
                            <div>Avg Score: {element.avgScore}%</div>
                            <div>Completion: {element.completionRate}%</div>
                            <div>Attempts: {element.totalAttempts}</div>
                          </div>
                        </div>,
                        "",
                      ];
                    }}
                    labelFormatter={() => ""}
                  />
                  <Legend
                    verticalAlign="bottom"
                    height={36}
                    content={({ payload }) => (
                      <div className="flex items-center justify-center gap-4 pt-3">
                        {payload?.map((entry, index) => {
                          const element = attributeElements[index];
                          if (!element) return null;
                          return (
                            <Dialog key={entry.value}>
                              <DialogTrigger asChild>
                                <span className="text-xs cursor-pointer hover:text-primary transition-colors flex items-center gap-1 px-2 py-1 rounded border border-border hover:border-primary/50 hover:bg-muted/50">
                                  <span style={{ color: element.color }}>
                                    ●
                                  </span>
                                  {element.name}
                                </span>
                              </DialogTrigger>
                              <DialogContent className="max-w-2xl">
                                <DialogHeader>
                                  <DialogTitle className="flex items-center gap-2">
                                    <span className="text-lg">
                                      {element.icon}
                                    </span>
                                    {element.displayName} Performance
                                  </DialogTitle>
                                  <DialogDescription>
                                    Detailed performance analysis for{" "}
                                    {element.displayName}{" "}
                                    {selectedParameter?.name.toLowerCase()}
                                  </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-6">
                                  {/* Performance Trend Chart */}
                                  {element.trendData.length > 0 && (
                                    <div className="h-64">
                                      <ResponsiveContainer
                                        width="100%"
                                        height="100%"
                                      >
                                        <LineChart data={element.trendData}>
                                          <XAxis
                                            dataKey="date"
                                            className="text-xs"
                                            angle={-45}
                                            textAnchor="end"
                                            height={60}
                                          />
                                          <YAxis className="text-xs" />
                                          <Tooltip
                                            contentStyle={{
                                              backgroundColor:
                                                "hsl(var(--background))",
                                              border:
                                                "1px solid hsl(var(--border))",
                                              borderRadius: "6px",
                                            }}
                                            formatter={(value: number) => [
                                              `${value}%`,
                                              "Score",
                                            ]}
                                          />
                                          <Line
                                            type="monotone"
                                            dataKey="score"
                                            stroke={element.color}
                                            strokeWidth={2}
                                            dot={{ r: 4 }}
                                            name="Score"
                                          />
                                        </LineChart>
                                      </ResponsiveContainer>
                                    </div>
                                  )}

                                  {/* Actionable Insights */}
                                  <div className="p-3 bg-muted rounded-lg">
                                    <p className="text-sm text-muted-foreground">
                                      {element.insight}
                                    </p>
                                  </div>
                                </div>
                              </DialogContent>
                            </Dialog>
                          );
                        })}
                      </div>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
