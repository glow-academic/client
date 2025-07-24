/**
 * ScenarioStats.tsx
 * This component displays the scenario stats for the personas with bar charts.
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { getAllDocuments } from "@/utils/queries/documents/get-all-documents";
import { getAllPersonas } from "@/utils/queries/personas/get-all-personas";
import { getAllProfiles } from "@/utils/queries/profiles/get-all-profiles";
import { getAllRubrics } from "@/utils/queries/rubrics/get-all-rubrics";
import { getAllScenarios } from "@/utils/queries/scenarios/get-all-scenarios";
import { getSimulationAttemptsByProfiles } from "@/utils/queries/simulation_attempts/get-simulation-attempts-by-profiles";
import { getSimulationChatGradesBySimulationChats } from "@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulationchats";
import { getSimulationChatsByAttempts } from "@/utils/queries/simulation_chats/get-simulation-chats-by-attempts";
import { getAllSimulations } from "@/utils/queries/simulations/get-all-simulations";
import { useQuery } from "@tanstack/react-query";
import { isAfter, isBefore } from "date-fns";
import { BarChart3, Check, ChevronsUpDown, Info } from "lucide-react";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";

export interface ScenarioStatsProps {
  dateStart: Date;
  dateEnd: Date;
  profileId?: string;
}

type MetricType = "intensity" | "crowdedness" | "documentCount";

interface MetricOption {
  id: MetricType;
  name: string;
  description: string;
  icon: string;
}

const METRIC_OPTIONS: MetricOption[] = [
  {
    id: "intensity",
    name: "Intensity Level",
    description: "Scenario intensity rating (1-10)",
    icon: "🔥",
  },
  {
    id: "crowdedness",
    name: "Crowdedness",
    description: "Number of students in scenario (1-10)",
    icon: "👥",
  },
  {
    id: "documentCount",
    name: "Document Count",
    description: "Number of documents available",
    icon: "📄",
  },
];

export default function ScenarioStats({
  dateStart,
  dateEnd,
  profileId,
}: ScenarioStatsProps) {
  const [selectedMetric, setSelectedMetric] = useState<MetricType>("intensity");
  const [pickerOpen, setPickerOpen] = useState(false);

  // Fetch data
  const { data: scenarios, isLoading: scenariosLoading } = useQuery({
    queryKey: ["scenarios"],
    queryFn: () => getAllScenarios(),
  });

  const { data: personas, isLoading: personasLoading } = useQuery({
    queryKey: ["personas"],
    queryFn: () => getAllPersonas(),
  });

  const { data: documents, isLoading: documentsLoading } = useQuery({
    queryKey: ["documents"],
    queryFn: () => getAllDocuments(),
  });

  const { data: profiles, isLoading: profilesLoading } = useQuery({
    queryKey: ["profiles"],
    queryFn: () => getAllProfiles(),
  });

  const { data: simulations, isLoading: simulationsLoading } = useQuery({
    queryKey: ["simulations"],
    queryFn: () => getAllSimulations(),
  });

  const { data: rubrics, isLoading: rubricsLoading } = useQuery({
    queryKey: ["rubrics"],
    queryFn: () => getAllRubrics(),
  });

  const { data: attempts, isLoading: attemptsLoading } = useQuery({
    queryKey: ["simulationAttempts", profiles?.map((profile) => profile.id)],
    queryFn: () =>
      getSimulationAttemptsByProfiles(profiles!.map((profile) => profile.id)),
    enabled: !!profiles && profiles.length > 0,
  });

  const { data: chats, isLoading: chatsLoading } = useQuery({
    queryKey: ["simulationChats", attempts?.map((attempt) => attempt.id)],
    queryFn: () =>
      getSimulationChatsByAttempts(attempts!.map((attempt) => attempt.id)),
    enabled: !!attempts && attempts.length > 0,
  });

  const { data: grades, isLoading: gradesLoading } = useQuery({
    queryKey: ["simulationGrades", chats?.map((chat) => chat.id)],
    queryFn: () =>
      getSimulationChatGradesBySimulationChats(chats!.map((chat) => chat.id)),
    enabled: !!chats && chats.length > 0,
  });

  // Check if any data is still loading
  const isLoading =
    scenariosLoading ||
    personasLoading ||
    documentsLoading ||
    profilesLoading ||
    simulationsLoading ||
    rubricsLoading ||
    attemptsLoading ||
    chatsLoading ||
    gradesLoading;

  // Calculate aggregated performance data by metric level
  const aggregatedPerformanceData = useMemo(() => {
    if (
      !scenarios ||
      !personas ||
      !documents ||
      !attempts ||
      !chats ||
      !grades ||
      !simulations ||
      !profiles ||
      !rubrics
    ) {
      return [];
    }

    // Filter data by date range, exclude practice simulations, and filter by TA role
    const filteredGrades = grades.filter((grade) => {
      const gradeDate = new Date(grade.createdAt);
      const chat = chats.find((c) => c.id === grade.simulationChatId);
      const attempt = attempts.find((a) => a.id === chat?.attemptId);
      const simulation = simulations.find(
        (s) => s.id === attempt?.simulationId
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

    if (filteredGrades.length === 0) {
      return [];
    }

    // Group scenarios by metric level and calculate average performance
    const metricGroups: {
      [key: number]: { scores: number[]; count: number; rubricPoints: number };
    } = {};

    scenarios.forEach((scenario) => {
      const scenarioChats = chats.filter(
        (chat) => chat.scenarioId === scenario.id
      );
      const scenarioGrades = filteredGrades.filter((grade) =>
        scenarioChats.some((chat) => chat.id === grade.simulationChatId)
      );

      if (scenarioGrades.length === 0) return;

      // Get metric value based on selected metric
      let metricValue = 0;
      switch (selectedMetric) {
        case "intensity":
          metricValue = scenario.intensity || 0;
          break;
        case "crowdedness":
          metricValue = scenario.crowdedness || 0;
          break;
        case "documentCount":
          metricValue = scenario.documentIds?.length || 0;
          break;
      }

      if (metricValue > 0) {
        // Calculate percentage scores based on rubric points
        const percentageScores = scenarioGrades.map((grade) => {
          const rubric = rubrics.find((r) => r.id === grade.rubricId);
          if (!rubric || rubric.points === 0) return 0;

          // Calculate percentage score (score out of rubric.points)
          return Math.round((grade.score / rubric.points) * 100);
        });

        const avgScore = Math.round(
          percentageScores.reduce((sum, score) => sum + score, 0) /
            percentageScores.length
        );

        if (!metricGroups[metricValue]) {
          metricGroups[metricValue] = { scores: [], count: 0, rubricPoints: 0 };
        }
        const group = metricGroups[metricValue];
        if (group) {
          group.scores.push(avgScore);
          group.count += scenarioChats.length;

          // Store rubric points for reference (use the first one found)
          if (group.rubricPoints === 0) {
            const firstGrade = scenarioGrades[0];
            if (firstGrade) {
              const rubric = rubrics.find((r) => r.id === firstGrade.rubricId);
              group.rubricPoints = rubric?.points || 0;
            }
          }
        }
      }
    });

    // Convert to array format for chart
    const chartData = Object.entries(metricGroups)
      .map(([metricLevel, data]) => ({
        metricLevel: parseInt(metricLevel),
        avgScore: Math.round(
          data.scores.reduce((sum, score) => sum + score, 0) /
            data.scores.length
        ),
        scenarioCount: data.scores.length,
        totalAttempts: data.count,
        rubricPoints: data.rubricPoints,
      }))
      .sort((a, b) => a.metricLevel - b.metricLevel)
      .filter((item) => item.scenarioCount >= 1); // Show all levels with at least 1 scenario

    return chartData;
  }, [
    scenarios,
    personas,
    documents,
    attempts,
    chats,
    grades,
    simulations,
    profiles,
    rubrics,
    dateStart,
    dateEnd,
    profileId,
    selectedMetric,
  ]);

  // Calculate correlation coefficient
  const correlation = useMemo(() => {
    if (aggregatedPerformanceData.length < 2) return 0;

    const n = aggregatedPerformanceData.length;
    const sumX = aggregatedPerformanceData.reduce(
      (sum, item) => sum + item.metricLevel,
      0
    );
    const sumY = aggregatedPerformanceData.reduce(
      (sum, item) => sum + item.avgScore,
      0
    );
    const sumXY = aggregatedPerformanceData.reduce(
      (sum, item) => sum + item.metricLevel * item.avgScore,
      0
    );
    const sumX2 = aggregatedPerformanceData.reduce(
      (sum, item) => sum + item.metricLevel * item.metricLevel,
      0
    );
    const sumY2 = aggregatedPerformanceData.reduce(
      (sum, item) => sum + item.avgScore * item.avgScore,
      0
    );

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt(
      (n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY)
    );

    return denominator === 0 ? 0 : numerator / denominator;
  }, [aggregatedPerformanceData]);

  const selectedMetricOption = METRIC_OPTIONS.find(
    (m) => m.id === selectedMetric
  );

  // Generate insight text
  const getInsightText = () => {
    const metricName = selectedMetricOption?.name.toLowerCase() || "metric";
    if (correlation > 0.3) {
      return `Higher ${metricName} tends to correlate with better performance.`;
    } else if (correlation < -0.3) {
      return `Higher ${metricName} tends to correlate with worse performance.`;
    } else {
      return `No clear relationship between ${metricName} and performance.`;
    }
  };

  if (isLoading) {
    return (
      <Card className="w-full h-full flex flex-col">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Scenario Performance Analysis
          </CardTitle>
          <CardDescription>
            Performance correlation with scenario characteristics
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center flex-1">
          <p className="text-muted-foreground">Loading scenario data...</p>
        </CardContent>
      </Card>
    );
  }

  if (!aggregatedPerformanceData.length) {
    return (
      <Card className="w-full h-full flex flex-col">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Scenario Performance Analysis
          </CardTitle>
          <CardDescription>
            Performance correlation with scenario characteristics
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center flex-1">
          <p className="text-muted-foreground">
            No scenario data available for the selected time period.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <TooltipProvider>
      <Card className="w-full h-full flex flex-col">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Scenario Performance Analysis
              </CardTitle>
              <CardDescription>
                Performance correlation with scenario characteristics
              </CardDescription>
            </div>

            {/* Metric Picker */}
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
                      <span>{selectedMetricOption?.icon || "📊"}</span>
                      <span>{selectedMetricOption?.name || "Metric"}</span>
                    </div>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-48 p-0">
                  <Command>
                    <CommandInput placeholder="Search metrics..." />
                    <CommandEmpty>No metric found.</CommandEmpty>
                    <CommandGroup>
                      {METRIC_OPTIONS.map((metric) => (
                        <CommandItem
                          key={metric.id}
                          value={metric.id}
                          onSelect={() => {
                            setSelectedMetric(metric.id);
                            setPickerOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedMetric === metric.id
                                ? "opacity-100"
                                : "opacity-0"
                            )}
                          />
                          <div className="flex items-center gap-2">
                            <span>{metric.icon}</span>
                            <div>
                              <div className="font-medium">{metric.name}</div>
                              <div className="text-xs text-muted-foreground">
                                {metric.description}
                              </div>
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

        <CardContent className="space-y-6 flex-1 flex flex-col relative">
          {/* Correlation Card */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="absolute top-2 right-2 z-10">
                <div className="bg-background/90 backdrop-blur-sm border rounded-md px-2 py-1 shadow-sm">
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-medium">Correlation:</span>
                    <span className="text-xs font-bold">
                      {correlation > 0 ? "+" : ""}
                      {correlation.toFixed(2)}
                    </span>
                    <Info className="h-3 w-3 text-muted-foreground" />
                  </div>
                </div>
              </div>
            </TooltipTrigger>
            <TooltipContent className="w-64 p-3">
              <p className="text-sm">{getInsightText()}</p>
            </TooltipContent>
          </Tooltip>

          {/* Bar Chart */}
          <div className="flex-1 min-h-[300px] h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={aggregatedPerformanceData}
                margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="metricLevel"
                  name={selectedMetricOption?.name || "Metric Level"}
                  fontSize={12}
                  tickFormatter={(value) => {
                    if (selectedMetric === "documentCount")
                      return value.toString();
                    return value.toString();
                  }}
                />
                <YAxis
                  fontSize={12}
                  domain={[0, 100]}
                  tickFormatter={(value) => `${value}%`}
                />
                <RechartsTooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--background))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "6px",
                  }}
                  formatter={(value: number, _name: string) => [
                    `${value}%`,
                    "Average Score",
                  ]}
                  labelFormatter={(label) => {
                    const dataPoint = aggregatedPerformanceData.find(
                      (item) => item.metricLevel === label
                    );
                    const metricName = selectedMetricOption?.name || "Metric";
                    return `${metricName} Level ${label} (${dataPoint?.scenarioCount || 0} scenarios)`;
                  }}
                />
                <Bar
                  dataKey="avgScore"
                  fill="#3b82f6"
                  name="Average Score"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
