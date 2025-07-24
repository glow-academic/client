/**
 * ScenarioStats.tsx
 * This component displays the scenario stats for the personas with scatter plots.
 * @AshokSaravanan222 & @siladiea
 * 07/23/2025
 */
"use client";

import { Badge } from "@/components/ui/badge";
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
import { getAllDocuments } from "@/utils/queries/documents/get-all-documents";
import { getAllPersonas } from "@/utils/queries/personas/get-all-personas";
import { getAllProfiles } from "@/utils/queries/profiles/get-all-profiles";
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
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
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
    attemptsLoading ||
    chatsLoading ||
    gradesLoading;

  // Calculate scenario performance data for scatter plots
  const scenarioPerformanceData = useMemo(() => {
    if (
      !scenarios ||
      !personas ||
      !documents ||
      !attempts ||
      !chats ||
      !grades ||
      !simulations ||
      !profiles
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

    // Calculate performance for each scenario
    const scenarioData = scenarios
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

        return {
          scenarioId: scenario.id,
          scenarioName: scenario.name,
          metricValue,
          avgScore,
          successRate,
          totalAttempts: scenarioChats.length,
          completedAttempts: completedChats.length,
        };
      })
      .filter(
        (item): item is NonNullable<typeof item> =>
          item !== null && item.totalAttempts >= 3 && item.metricValue > 0
      );

    return scenarioData;
  }, [
    scenarios,
    personas,
    documents,
    attempts,
    chats,
    grades,
    simulations,
    profiles,
    dateStart,
    dateEnd,
    profileId,
    selectedMetric,
  ]);

  // Calculate correlation coefficient
  const correlation = useMemo(() => {
    if (scenarioPerformanceData.length < 2) return 0;

    const n = scenarioPerformanceData.length;
    const sumX = scenarioPerformanceData.reduce(
      (sum, item) => sum + item.metricValue,
      0
    );
    const sumY = scenarioPerformanceData.reduce(
      (sum, item) => sum + item.avgScore,
      0
    );
    const sumXY = scenarioPerformanceData.reduce(
      (sum, item) => sum + item.metricValue * item.avgScore,
      0
    );
    const sumX2 = scenarioPerformanceData.reduce(
      (sum, item) => sum + item.metricValue * item.metricValue,
      0
    );
    const sumY2 = scenarioPerformanceData.reduce(
      (sum, item) => sum + item.avgScore * item.avgScore,
      0
    );

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt(
      (n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY)
    );

    return denominator === 0 ? 0 : numerator / denominator;
  }, [scenarioPerformanceData]);

  const selectedMetricOption = METRIC_OPTIONS.find(
    (m) => m.id === selectedMetric
  );

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

  if (!scenarioPerformanceData.length) {
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
            <Label className="text-sm font-medium">Metric:</Label>
            <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={pickerOpen}
                  className="w-48 justify-between"
                >
                  <div className="flex items-center gap-2">
                    <span>{selectedMetricOption?.icon}</span>
                    <span>{selectedMetricOption?.name}</span>
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

      <CardContent className="space-y-6 flex-1 flex flex-col">
        {/* Correlation Summary */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Correlation:</span>
              <Badge
                variant={Math.abs(correlation) > 0.5 ? "default" : "secondary"}
                className={cn(
                  Math.abs(correlation) > 0.7
                    ? "bg-green-100 text-green-800"
                    : Math.abs(correlation) > 0.5
                      ? "bg-yellow-100 text-yellow-800"
                      : "bg-gray-100 text-gray-800"
                )}
              >
                {correlation.toFixed(3)}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {Math.abs(correlation) > 0.7
                ? "Strong correlation"
                : Math.abs(correlation) > 0.5
                  ? "Moderate correlation"
                  : Math.abs(correlation) > 0.3
                    ? "Weak correlation"
                    : "No significant correlation"}{" "}
              between {selectedMetricOption?.name.toLowerCase()} and performance
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

        {/* Scatter Plot */}
        <div className="flex-1 min-h-[300px] h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                type="number"
                dataKey="avgScore"
                name="Average Score"
                fontSize={12}
                domain={[0, 100]}
                tickFormatter={(value) => `${value}%`}
              />
              <YAxis
                type="number"
                dataKey="metricValue"
                name={selectedMetricOption?.name || "Metric"}
                fontSize={12}
                tickFormatter={(value) => {
                  if (selectedMetric === "documentCount")
                    return value.toString();
                  return value.toString();
                }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--background))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "6px",
                }}
                formatter={(value: number, name: string) => [
                  name === "avgScore" ? `${value}%` : value,
                  name === "avgScore"
                    ? "Average Score"
                    : selectedMetricOption?.name,
                ]}
                labelFormatter={(label) => {
                  const dataPoint = scenarioPerformanceData.find(
                    (item) => item.avgScore === label
                  );
                  return dataPoint ? dataPoint.scenarioName : label;
                }}
              />
              <Legend />
              <Scatter
                data={scenarioPerformanceData}
                dataKey="metricValue"
                fill="#3b82f6"
                name={selectedMetricOption?.name || "Metric"}
              >
                {scenarioPerformanceData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={
                      entry.successRate > 80
                        ? "#10b981"
                        : entry.successRate > 60
                          ? "#f59e0b"
                          : "#ef4444"
                    }
                    opacity={0.8}
                  />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-6 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500 opacity-80"></div>
            <span>High Success Rate (&gt;80%)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-yellow-500 opacity-80"></div>
            <span>Medium Success Rate (60-80%)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500 opacity-80"></div>
            <span>Low Success Rate (&lt;60%)</span>
          </div>
        </div>

        {/* Insights */}
        <div className="text-sm text-muted-foreground">
          <p className="leading-relaxed">
            {correlation > 0.3
              ? `Higher ${selectedMetricOption?.name.toLowerCase()} tends to correlate with ${correlation > 0 ? "better" : "worse"} performance.`
              : `No clear relationship between ${selectedMetricOption?.name.toLowerCase()} and performance.`}{" "}
            Each point represents a scenario's{" "}
            {selectedMetricOption?.name.toLowerCase()} vs average score.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
