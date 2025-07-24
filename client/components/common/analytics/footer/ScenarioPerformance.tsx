/**
 * ScenarioPerformance.tsx
 * This component displays the scenario performance for the personas.
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
import { BarChart3, TrendingUp } from "lucide-react";
import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
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

export default function ScenarioPerformance({
  dateStart,
  dateEnd,
  profileId,
  thresholds,
}: ScenarioPerformanceProps) {
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

  // Calculate scenario performance data
  const scenarioData = useMemo(() => {
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

    // Group by scenario and calculate metrics
    const scenarioMetrics = new Map<
      string,
      {
        scenarioId: string;
        scenarioName: string;
        attempts: number;
        completed: number;
        scores: number[];
        timeTaken: number[];
      }
    >();

    filteredGrades.forEach((grade) => {
      const chat = chats.find((c) => c.id === grade.simulationChatId);
      if (!chat) return;

      const scenarioId = chat.scenarioId;
      const scenario = scenarios.find((s) => s.id === scenarioId);
      if (!scenario) return;

      if (!scenarioMetrics.has(scenarioId)) {
        scenarioMetrics.set(scenarioId, {
          scenarioId,
          scenarioName: scenario.name,
          attempts: 0,
          completed: 0,
          scores: [],
          timeTaken: [],
        });
      }

      const metrics = scenarioMetrics.get(scenarioId)!;
      metrics.attempts++;
      metrics.scores.push(grade.score);
      metrics.timeTaken.push(grade.timeTaken);

      if (chat.completed) {
        metrics.completed++;
      }
    });

    // Convert to chart data
    const chartData = Array.from(scenarioMetrics.values())
      .map((metrics) => {
        const completionRate = Math.round(
          (metrics.completed / metrics.attempts) * 100
        );
        const avgScore = Math.round(
          metrics.scores.reduce((sum, score) => sum + score, 0) /
            metrics.scores.length
        );
        const avgTime = Math.round(
          metrics.timeTaken.reduce((sum, time) => sum + time, 0) /
            metrics.timeTaken.length /
            60
        ); // Convert to minutes

        return {
          name:
            metrics.scenarioName.length > 20
              ? metrics.scenarioName.substring(0, 20) + "..."
              : metrics.scenarioName,
          completionRate,
          avgScore,
          avgTime,
          attempts: metrics.attempts,
          color:
            completionRate >= thresholds.success
              ? "#10b981"
              : completionRate >= thresholds.warning
                ? "#f59e0b"
                : "#ef4444",
        };
      })
      .filter((scenario) => scenario.attempts >= 3) // Only show scenarios with sufficient data
      .sort((a, b) => b.completionRate - a.completionRate)
      .slice(0, 10); // Show top 10 scenarios

    return chartData;
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
    thresholds,
  ]);

  // Calculate overall performance trend
  const performanceTrend = useMemo(() => {
    if (!scenarioData.length) return { value: 0, isPositive: true };

    const avgCompletion =
      scenarioData.reduce((sum, scenario) => sum + scenario.completionRate, 0) /
      scenarioData.length;
    const avgScore =
      scenarioData.reduce((sum, scenario) => sum + scenario.avgScore, 0) /
      scenarioData.length;

    const overallPerformance = (avgCompletion + avgScore) / 2;
    return {
      value: Math.round(overallPerformance),
      isPositive: overallPerformance >= 70,
    };
  }, [scenarioData]);

  if (!scenarioData.length) {
    return (
      <Card className="w-full h-full flex flex-col">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Scenario Performance
          </CardTitle>
          <CardDescription>
            Performance metrics across different scenarios
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
          Scenario Performance
        </CardTitle>
        <CardDescription>
          Performance metrics across different scenarios
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col justify-end items-start pb-0">
        <div className="h-72 w-full max-w-[90%] self-start">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={scenarioData}
              layout="vertical"
              margin={{ left: 80, right: 30, top: 20, bottom: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis type="number" domain={[0, 100]} className="text-xs" />
              <YAxis
                type="category"
                dataKey="name"
                tickLine={false}
                axisLine={false}
                width={80}
                className="text-xs"
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--background))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "6px",
                }}
                formatter={(value: number, name: string) => [
                  name === "completionRate"
                    ? `${value}%`
                    : name === "avgScore"
                      ? `${value}%`
                      : `${value} min`,
                  name === "completionRate"
                    ? "Completion Rate"
                    : name === "avgScore"
                      ? "Average Score"
                      : "Average Time",
                ]}
              />
              <Bar
                dataKey="completionRate"
                fill="#3b82f6"
                radius={[0, 4, 4, 0]}
              />
              <Bar dataKey="avgScore" fill="#10b981" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
      <CardContent className="flex-col gap-2 text-sm">
        <div className="flex items-center gap-2 leading-none font-medium">
          Overall Performance: {performanceTrend.value}%
          <TrendingUp
            className={`h-4 w-4 ${
              performanceTrend.isPositive ? "" : "rotate-180"
            }`}
          />
        </div>
        <div className="text-muted-foreground leading-none">
          Based on completion rates and average scores
        </div>
      </CardContent>
    </Card>
  );
}
