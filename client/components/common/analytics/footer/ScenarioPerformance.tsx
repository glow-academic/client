/**
 * ScenarioPerformance.tsx
 * This component displays scenario attribute breakdown with performance metrics.
 * Shows what percentage of scenarios use each specific attribute and their performance.
 * @AshokSaravanan222 & @siladiea
 * 07/23/2025
 */
"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { getAllProfiles } from "@/utils/queries/profiles/get-all-profiles";
import { getAllScenarioClasses } from "@/utils/queries/scenario_classes/get-all-scenario-classes";
import { getAllScenarioDeadlines } from "@/utils/queries/scenario_deadlines/get-all-scenario-deadlines";
import { getAllScenarioLocations } from "@/utils/queries/scenario_locations/get-all-scenario-locations";
import { getAllScenarioTimes } from "@/utils/queries/scenario_times/get-all-scenario-times";
import { getAllScenarios } from "@/utils/queries/scenarios/get-all-scenarios";
import { getSimulationAttemptsByProfiles } from "@/utils/queries/simulation_attempts/get-simulation-attempts-by-profiles";
import { getSimulationChatGradesBySimulationChats } from "@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulationchats";
import { getSimulationChatsByAttempts } from "@/utils/queries/simulation_chats/get-simulation-chats-by-attempts";
import { getAllSimulations } from "@/utils/queries/simulations/get-all-simulations";
import { useQuery } from "@tanstack/react-query";
import { format, isAfter, isBefore } from "date-fns";
import { BarChart3 } from "lucide-react";
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
import ScenarioAttributePicker, {
  ScenarioAttributeType,
} from "./ScenarioAttributePicker";

export interface ScenarioPerformanceProps {
  dateStart: Date;
  dateEnd: Date;
  profileId?: string;
  thresholds: {
    danger: number;
    warning: number;
    success: number;
  };
}

interface AttributeElement {
  id: string;
  name: string;
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
}

export default function ScenarioPerformance({
  dateStart,
  dateEnd,
  profileId,
}: Omit<ScenarioPerformanceProps, "thresholds">) {
  const [selectedAttribute, setSelectedAttribute] =
    useState<ScenarioAttributeType>("classes");

  // Fetch data
  const { data: profiles } = useQuery({
    queryKey: ["profiles"],
    queryFn: () => getAllProfiles(),
  });

  const { data: scenarios } = useQuery({
    queryKey: ["scenarios"],
    queryFn: () => getAllScenarios(),
  });

  const { data: simulations } = useQuery({
    queryKey: ["simulations"],
    queryFn: () => getAllSimulations(),
  });

  const { data: scenarioClasses } = useQuery({
    queryKey: ["scenarioClasses"],
    queryFn: () => getAllScenarioClasses(),
  });

  const { data: scenarioLocations } = useQuery({
    queryKey: ["scenarioLocations"],
    queryFn: () => getAllScenarioLocations(),
  });

  const { data: scenarioDeadlines } = useQuery({
    queryKey: ["scenarioDeadlines"],
    queryFn: () => getAllScenarioDeadlines(),
  });

  const { data: scenarioTimes } = useQuery({
    queryKey: ["scenarioTimes"],
    queryFn: () => getAllScenarioTimes(),
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

  // Calculate attribute breakdown
  const attributeElements = useMemo(() => {
    if (
      !scenarios ||
      !simulations ||
      !chats ||
      !grades ||
      !attempts ||
      !profiles ||
      !scenarioClasses ||
      !scenarioLocations ||
      !scenarioDeadlines ||
      !scenarioTimes
    ) {
      return [];
    }

    // Filter data by date range, exclude practice simulations, and filter by profile
    const filteredGrades = grades.filter((grade) => {
      const gradeDate = new Date(grade.createdAt);
      const chat = chats.find((c) => c.id === grade.simulationChatId);
      const attempt = attempts.find((a) => a.id === chat?.attemptId);
      const simulation = simulations.find(
        (s) => s.id === attempt?.simulationId
      );

      // Check date range
      const inDateRange =
        isAfter(gradeDate, dateStart) && isBefore(gradeDate, dateEnd);

      // Exclude practice simulations
      const notPractice = !simulation?.practiceSimulation;

      // Filter by profile if provided
      const profileMatch = profileId ? attempt?.profileId === profileId : true;

      return inDateRange && notPractice && profileMatch;
    });

    if (filteredGrades.length === 0) {
      return [];
    }

    // Get the relevant attribute data based on selection
    let attributeData:
      | typeof scenarioClasses
      | typeof scenarioLocations
      | typeof scenarioDeadlines
      | typeof scenarioTimes = [];
    let attributeKey: string = "";
    let nameKey: string = "";
    let icon: string = "";

    switch (selectedAttribute) {
      case "classes":
        attributeData = scenarioClasses;
        attributeKey = "classId";
        nameKey = "name";
        icon = "👨‍🏫";
        break;
      case "locations":
        attributeData = scenarioLocations;
        attributeKey = "locationId";
        nameKey = "name";
        icon = "📍";
        break;
      case "deadlines":
        attributeData = scenarioDeadlines;
        attributeKey = "deadlineId";
        nameKey = "deadline";
        icon = "⏰";
        break;
      case "times":
        attributeData = scenarioTimes;
        attributeKey = "timeId";
        nameKey = "description";
        icon = "🕐";
        break;
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
      attemptedScenarioIds.has(scenario.id)
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

    // Analyze each attribute
    const elements: AttributeElement[] = attributeData.map((attr, index) => {
      // Find scenarios that use this attribute
      const scenariosWithAttribute = attemptedScenarios.filter(
        (scenario) =>
          scenario[attributeKey as keyof typeof scenario] === attr.id
      );

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
          (chat) => chat.scenarioId === scenario.id
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

      return {
        id: attr.id,
        name: attr[nameKey as keyof typeof attr] as string,
        icon,
        color: colors[index % colors.length] || "#3b82f6",
        count,
        percentage: Math.round(percentage * 10) / 10, // Round to 1 decimal place
        avgScore: Math.round(avgScore),
        completionRate: Math.round(completionRate),
        totalAttempts,
        trendData,
      };
    });

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
    scenarioClasses,
    scenarioLocations,
    scenarioDeadlines,
    scenarioTimes,
    dateStart,
    dateEnd,
    profileId,
    selectedAttribute,
  ]);

  // Get actionable insights
  const getActionableInsights = (element: AttributeElement) => {
    if (element.trendData.length < 2) return null;

    const recentScores = element.trendData.slice(-3);
    const earlierScores = element.trendData.slice(0, 3);

    if (recentScores.length === 0 || earlierScores.length === 0) return null;

    const recentAvg =
      recentScores.reduce((sum, item) => sum + item.score, 0) /
      recentScores.length;
    const earlierAvg =
      earlierScores.reduce((sum, item) => sum + item.score, 0) /
      earlierScores.length;
    const improvement = recentAvg - earlierAvg;

    if (improvement > 5) {
      return `Performance with ${element.name} ${selectedAttribute.slice(0, -1)} has improved significantly. Consider using this attribute more frequently.`;
    } else if (improvement < -5) {
      return `Performance with ${element.name} ${selectedAttribute.slice(0, -1)} has declined. Review training approach for this attribute.`;
    }

    return null;
  };

  if (!attributeElements.length) {
    return (
      <Card className="w-full h-full flex flex-col">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Scenario Attribute Breakdown
          </CardTitle>
          <CardDescription>
            Performance analysis by scenario attributes
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
              Scenario Attribute Breakdown
            </CardTitle>
            <CardDescription>
              Performance analysis by scenario attributes
            </CardDescription>
          </div>
          <ScenarioAttributePicker
            selectedAttribute={selectedAttribute}
            onAttributeChange={setSelectedAttribute}
          />
        </div>
      </CardHeader>

      <CardContent className="space-y-6 flex-1 flex flex-col">
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
                formatter={(value: number, name: string, _props: unknown) => {
                  const element = attributeElements.find(
                    (e) => e.name === name
                  );
                  if (!element) return [value, name];

                  return [
                    <div key="tooltip" className="space-y-2">
                      <div className="font-medium">
                        {element.icon} {element.name}
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
              />
              <Legend
                verticalAlign="bottom"
                height={36}
                formatter={(_, __, index) => {
                  const element = attributeElements[index];
                  if (!element) return <span className="text-xs">Unknown</span>;
                  return (
                    <Dialog>
                      <DialogTrigger asChild>
                        <span className="text-xs cursor-pointer hover:text-primary transition-colors">
                          {element.icon} {element.name}
                        </span>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl">
                        <DialogHeader>
                          <DialogTitle className="flex items-center gap-2">
                            <span className="text-lg">{element.icon}</span>
                            {element.name} Performance
                          </DialogTitle>
                          <DialogDescription>
                            Detailed performance analysis for {element.name}{" "}
                            {selectedAttribute.slice(0, -1)}
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-6">
                          {/* Performance Metrics */}
                          <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 rounded-lg border">
                              <div className="text-2xl font-bold">
                                {element.avgScore}%
                              </div>
                              <div className="text-sm text-muted-foreground">
                                Average Score
                              </div>
                            </div>
                            <div className="p-4 rounded-lg border">
                              <div className="text-2xl font-bold">
                                {element.completionRate}%
                              </div>
                              <div className="text-sm text-muted-foreground">
                                Completion Rate
                              </div>
                            </div>
                            <div className="p-4 rounded-lg border">
                              <div className="text-2xl font-bold">
                                {element.count}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                Scenarios Used
                              </div>
                            </div>
                            <div className="p-4 rounded-lg border">
                              <div className="text-2xl font-bold">
                                {element.totalAttempts}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                Total Attempts
                              </div>
                            </div>
                          </div>

                          {/* Performance Trend Chart */}
                          {element.trendData.length > 0 && (
                            <div className="h-64">
                              <ResponsiveContainer width="100%" height="100%">
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
                                      backgroundColor: "hsl(var(--background))",
                                      border: "1px solid hsl(var(--border))",
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
                          {getActionableInsights(element) && (
                            <div className="p-3 bg-muted rounded-lg">
                              <p className="text-sm text-muted-foreground">
                                {getActionableInsights(element)}
                              </p>
                            </div>
                          )}
                        </div>
                      </DialogContent>
                    </Dialog>
                  );
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Insights */}
        <div className="text-sm text-muted-foreground">
          <p className="leading-relaxed">
            {attributeElements.length > 0 && (
              <>
                {attributeElements[0]?.name || "Some"} is the most commonly used{" "}
                {selectedAttribute.slice(0, -1)} (
                {attributeElements[0]?.percentage}% usage), while{" "}
                {attributeElements[attributeElements.length - 1]?.name ||
                  "others"}
                are used less frequently. Performance varies across different{" "}
                {selectedAttribute}, with{" "}
                {attributeElements.find(
                  (e) =>
                    e.avgScore ===
                    Math.max(...attributeElements.map((e) => e.avgScore))
                )?.name || "some"}{" "}
                showing the best results.
              </>
            )}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
