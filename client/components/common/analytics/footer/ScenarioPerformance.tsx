/**
 * ScenarioPerformance.tsx
 * This component displays scenario elements breakdown with performance metrics.
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
import { getAllProfiles } from "@/utils/queries/profiles/get-all-profiles";
import { getAllScenarios } from "@/utils/queries/scenarios/get-all-scenarios";
import { getSimulationAttemptsByProfiles } from "@/utils/queries/simulation_attempts/get-simulation-attempts-by-profiles";
import { getSimulationChatGradesBySimulationChats } from "@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulationchats";
import { getSimulationChatsByAttempts } from "@/utils/queries/simulation_chats/get-simulation-chats-by-attempts";
import { getAllSimulations } from "@/utils/queries/simulations/get-all-simulations";
import { useQuery } from "@tanstack/react-query";
import { isAfter, isBefore } from "date-fns";
import { BarChart3 } from "lucide-react";
import { useMemo } from "react";
import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

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

interface ScenarioElement {
  id: string;
  name: string;
  icon: string;
  color: string;
  count: number;
  avgScore: number;
  completionRate: number;
  totalAttempts: number;
}

export default function ScenarioPerformance({
  dateStart,
  dateEnd,
  profileId,
}: Omit<ScenarioPerformanceProps, "thresholds">) {
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

  // Calculate scenario elements breakdown
  const scenarioElements = useMemo(() => {
    if (
      !scenarios ||
      !simulations ||
      !chats ||
      !grades ||
      !attempts ||
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

      // Filter by TA role
      const isTA = profile?.role === "ta";

      // Filter by profile if provided
      const profileMatch = profileId ? attempt?.profileId === profileId : true;

      return inDateRange && notPractice && isTA && profileMatch;
    });

    if (filteredGrades.length === 0) return [];

    // Define scenario element categories
    const elementCategories: { [key: string]: ScenarioElement } = {
      class: {
        id: "class",
        name: "Class Management",
        icon: "👨‍🏫",
        color: "#3b82f6",
        count: 0,
        avgScore: 0,
        completionRate: 0,
        totalAttempts: 0,
      },
      deadlines: {
        id: "deadlines",
        name: "Deadlines & Time",
        icon: "⏰",
        color: "#ef4444",
        count: 0,
        avgScore: 0,
        completionRate: 0,
        totalAttempts: 0,
      },
      locations: {
        id: "locations",
        name: "Location & Space",
        icon: "📍",
        color: "#10b981",
        count: 0,
        completionRate: 0,
        avgScore: 0,
        totalAttempts: 0,
      },
      students: {
        id: "students",
        name: "Student Interactions",
        icon: "👥",
        color: "#f59e0b",
        count: 0,
        avgScore: 0,
        completionRate: 0,
        totalAttempts: 0,
      },
      content: {
        id: "content",
        name: "Content & Materials",
        icon: "📚",
        color: "#8b5cf6",
        count: 0,
        avgScore: 0,
        completionRate: 0,
        totalAttempts: 0,
      },
      objectives: {
        id: "objectives",
        name: "Learning Objectives",
        icon: "🎯",
        color: "#06b6d4",
        count: 0,
        avgScore: 0,
        completionRate: 0,
        totalAttempts: 0,
      },
    };

    // Analyze scenarios and categorize them
    const scenarioAnalysis = new Map<
      string,
      {
        scenario: (typeof scenarios)[0];
        grades: typeof grades;
        chats: typeof chats;
      }
    >();

    filteredGrades.forEach((grade) => {
      const chat = chats.find((c) => c.id === grade.simulationChatId);
      if (!chat) return;

      const scenario = scenarios.find((s) => s.id === chat.scenarioId);
      if (!scenario) return;

      if (!scenarioAnalysis.has(scenario.id)) {
        scenarioAnalysis.set(scenario.id, {
          scenario,
          grades: [],
          chats: [],
        });
      }

      const analysis = scenarioAnalysis.get(scenario.id)!;
      analysis.grades.push(grade);
      analysis.chats.push(chat);
    });

    // Categorize scenarios based on their characteristics
    scenarioAnalysis.forEach(({ scenario, grades, chats }) => {
      const completedChats = chats.filter((chat) => chat.completed);
      const avgScore =
        grades.reduce((sum, grade) => sum + grade.score, 0) / grades.length;
      const completionRate = (completedChats.length / chats.length) * 100;

      // Determine which category this scenario belongs to based on its characteristics
      let primaryCategory = "class"; // default

      // Class management scenarios (high intensity, multiple students)
      if (
        scenario.intensity &&
        scenario.intensity >= 7 &&
        scenario.crowdedness &&
        scenario.crowdedness >= 7
      ) {
        primaryCategory = "class";
      }
      // Deadline/time pressure scenarios
      else if (scenario.intensity && scenario.intensity >= 8) {
        primaryCategory = "deadlines";
      }
      // Location/space management scenarios
      else if (scenario.crowdedness && scenario.crowdedness >= 6) {
        primaryCategory = "locations";
      }
      // Student interaction scenarios
      else if (scenario.crowdedness && scenario.crowdedness >= 5) {
        primaryCategory = "students";
      }
      // Content/material heavy scenarios
      else if (scenario.documentIds && scenario.documentIds.length >= 3) {
        primaryCategory = "content";
      }
      // Learning objective focused scenarios
      else {
        primaryCategory = "objectives";
      }

      const category = elementCategories[primaryCategory];
      if (category) {
        category.count++;
        category.totalAttempts += chats.length;
        category.avgScore =
          (category.avgScore * (category.count - 1) + avgScore) /
          category.count;
        category.completionRate =
          (category.completionRate * (category.count - 1) + completionRate) /
          category.count;
      }
    });

    // Convert to array and filter out categories with no data
    return Object.values(elementCategories).filter(
      (element) => element.count > 0
    );
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
  ]);

  // Calculate overall performance
  const overallPerformance = useMemo(() => {
    if (!scenarioElements.length) return { avgScore: 0, completionRate: 0 };

    const totalAvgScore = scenarioElements.reduce(
      (sum, element) => sum + element.avgScore,
      0
    );
    const totalCompletionRate = scenarioElements.reduce(
      (sum, element) => sum + element.completionRate,
      0
    );

    return {
      avgScore: Math.round(totalAvgScore / scenarioElements.length),
      completionRate: Math.round(totalCompletionRate / scenarioElements.length),
    };
  }, [scenarioElements]);

  if (!scenarioElements.length) {
    return (
      <Card className="w-full h-full flex flex-col">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Scenario Elements Breakdown
          </CardTitle>
          <CardDescription>
            Performance analysis by scenario element categories
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
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Scenario Elements Breakdown
        </CardTitle>
        <CardDescription>
          Performance analysis by scenario element categories
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6 flex-1 flex flex-col">
        {/* Performance Summary */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Avg Score:</span>
                <span className="text-sm text-muted-foreground">
                  {overallPerformance.avgScore}%
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Completion:</span>
                <span className="text-sm text-muted-foreground">
                  {overallPerformance.completionRate}%
                </span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Overall performance across all scenario elements
            </p>
          </div>

          <div className="text-right">
            <div className="text-sm font-medium">
              {scenarioElements.length} categories
            </div>
            <div className="text-xs text-muted-foreground">
              with performance data
            </div>
          </div>
        </div>

        {/* Pie Chart */}
        <div className="flex-1 min-h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={scenarioElements}
                dataKey="count"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={120}
                innerRadius={60}
                paddingAngle={2}
              >
                {scenarioElements.map((entry, index) => (
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
                  const element = scenarioElements.find((e) => e.name === name);
                  if (!element) return [value, name];

                  return [
                    <div key="tooltip" className="space-y-2">
                      <div className="font-medium">
                        {element.icon} {element.name}
                      </div>
                      <div className="text-sm space-y-1">
                        <div>Scenarios: {element.count}</div>
                        <div>Avg Score: {Math.round(element.avgScore)}%</div>
                        <div>
                          Completion: {Math.round(element.completionRate)}%
                        </div>
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
                formatter={(value, entry, index) => {
                  const element = scenarioElements[index];
                  if (!element) return <span className="text-xs">Unknown</span>;
                  return (
                    <span className="text-xs">
                      {element.icon} {element.name}
                    </span>
                  );
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Element Details */}
        <div className="grid grid-cols-2 gap-4 text-xs">
          {scenarioElements.map((element) => (
            <div
              key={element.id}
              className="flex items-center justify-between p-3 rounded-lg border"
              style={{ borderLeftColor: element.color, borderLeftWidth: "4px" }}
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">{element.icon}</span>
                <div>
                  <div className="font-medium">{element.name}</div>
                  <div className="text-muted-foreground">
                    {element.count} scenarios
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-medium">
                  {Math.round(element.avgScore)}%
                </div>
                <div className="text-muted-foreground">avg score</div>
              </div>
            </div>
          ))}
        </div>

        {/* Insights */}
        <div className="text-sm text-muted-foreground">
          <p className="leading-relaxed">
            {scenarioElements.length > 0 && (
              <>
                {scenarioElements.find(
                  (e) =>
                    e.avgScore ===
                    Math.max(...scenarioElements.map((e) => e.avgScore))
                )?.name || "Some"}
                scenarios show the best performance, while
                {scenarioElements.find(
                  (e) =>
                    e.avgScore ===
                    Math.min(...scenarioElements.map((e) => e.avgScore))
                )?.name || "other"}
                scenarios may need additional support.
              </>
            )}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
