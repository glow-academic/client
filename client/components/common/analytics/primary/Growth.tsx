/**
 * Growth.tsx
 * This component displays the growth for the personas.
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
import { getAllRubrics } from "@/utils/queries/rubrics/get-all-rubrics";
import { getSimulationAttemptsByProfiles } from "@/utils/queries/simulation_attempts/get-simulation-attempts-by-profiles";
import { getSimulationChatGradesBySimulationChats } from "@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulationchats";
import { getSimulationChatsByAttempts } from "@/utils/queries/simulation_chats/get-simulation-chats-by-attempts";
import { getAllSimulations } from "@/utils/queries/simulations/get-all-simulations";
import { useQuery } from "@tanstack/react-query";
import { format, isAfter, isBefore } from "date-fns";
import { TrendingUp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import GrowthPicker, { type GrowthMetric } from "../GrowthPicker";

export interface GrowthProps {
  dateStart: Date;
  dateEnd: Date;
  profileId?: string;
}

export default function Growth({ dateStart, dateEnd, profileId }: GrowthProps) {
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>([
    "averageScore",
  ]);

  // Define all available metrics (expandable to all 10 header metrics)
  const availableMetrics: GrowthMetric[] = useMemo(
    () => [
      {
        id: "averageScore",
        name: "Average Score",
        color: "#3b82f6",
        description: "Average performance score across all sessions",
        unit: "%",
        formatter: (value: number) => `${value}%`,
      },
      {
        id: "passRate",
        name: "Pass Rate",
        color: "#10b981",
        description: "Percentage of sessions that meet passing criteria",
        unit: "%",
        formatter: (value: number) => `${value}%`,
      },
      {
        id: "completionRate",
        name: "Completion Rate",
        color: "#8b5cf6",
        description: "Percentage of sessions that were completed",
        unit: "%",
        formatter: (value: number) => `${value}%`,
      },
      {
        id: "efficiencyIndex",
        name: "Efficiency Index",
        color: "#f97316",
        description: "Performance efficiency relative to time spent",
        unit: "%",
        formatter: (value: number) => `${value}%`,
      },
      {
        id: "messagesPerSession",
        name: "Messages Per Session",
        color: "#06b6d4",
        description: "Average number of messages per session",
        unit: "msgs",
        formatter: (value: number) => `${value} msgs`,
      },
      {
        id: "personaResponseTimes",
        name: "Response Times",
        color: "#84cc16",
        description: "Average response time to persona interactions",
        unit: "min",
        formatter: (value: number) => `${value}m`,
      },
      {
        id: "sessionEfficiency",
        name: "Session Efficiency",
        color: "#ec4899",
        description: "Overall session efficiency rating",
        unit: "%",
        formatter: (value: number) => `${value}%`,
      },
      {
        id: "stagnationRate",
        name: "Stagnation Rate",
        color: "#ef4444",
        description: "Rate of performance stagnation",
        unit: "%",
        formatter: (value: number) => `${value}%`,
      },
      {
        id: "timeSpent",
        name: "Time Spent",
        color: "#a855f7",
        description: "Average time spent per session",
        unit: "min",
        formatter: (value: number) => `${value}m`,
      },
      {
        id: "totalAttempts",
        name: "Total Attempts",
        color: "#f59e0b",
        description: "Total number of simulation attempts",
        unit: "attempts",
        formatter: (value: number) => `${value} attempts`,
      },
    ],
    []
  );

  // Ensure at least one metric is always selected
  useEffect(() => {
    if (
      selectedMetrics.length === 0 &&
      availableMetrics.length > 0 &&
      availableMetrics[0]
    ) {
      setSelectedMetrics([availableMetrics[0].id]);
    }
  }, [selectedMetrics.length, availableMetrics]);

  // Get selected metric objects
  const selectedMetricObjects = useMemo(() => {
    return availableMetrics.filter((metric) =>
      selectedMetrics.includes(metric.id)
    );
  }, [availableMetrics, selectedMetrics]);

  // Fetch data
  const { data: profiles } = useQuery({
    queryKey: ["profiles"],
    queryFn: () => getAllProfiles(),
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

  const { data: simulations } = useQuery({
    queryKey: ["simulations"],
    queryFn: () => getAllSimulations(),
  });

  const { data: rubrics } = useQuery({
    queryKey: ["rubrics"],
    queryFn: () => getAllRubrics(),
  });

  // Calculate growth data
  const growthData = useMemo(() => {
    if (
      !profiles ||
      !chats ||
      !grades ||
      !attempts ||
      !simulations ||
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
      const profile = profiles.find((p) => p.id === attempt?.profileId);

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

    // Group by date (daily intervals)
    const dailyData = new Map<
      string,
      {
        date: string;
        scores: number[];
        passed: number;
        total: number;
        completed: number;
        timeTaken: number[];
        messages: number[];
        responseTimes: number[];
        attempts: number[];
        firstAttemptPassed: number[];
      }
    >();

    filteredGrades.forEach((grade) => {
      const gradeDate = new Date(grade.createdAt);
      const dateKey = format(gradeDate, "yyyy-MM-dd");
      const chat = chats.find((c) => c.id === grade.simulationChatId);

      if (!dailyData.has(dateKey)) {
        dailyData.set(dateKey, {
          date: format(gradeDate, "MMM dd"),
          scores: [],
          passed: 0,
          total: 0,
          completed: 0,
          timeTaken: [],
          messages: [],
          responseTimes: [],
          attempts: [],
          firstAttemptPassed: [],
        });
      }

      const dayData = dailyData.get(dateKey)!;

      // Calculate score percentage
      const attempt = attempts.find((a) => a.id === chat?.attemptId);
      const simulation = simulations.find(
        (s) => s.id === attempt?.simulationId
      );
      const rubric = rubrics.find((r) => r.id === simulation?.rubricId);
      const rubricTotalPoints = rubric?.points || 100;
      const scorePercent = Math.round((grade.score / rubricTotalPoints) * 100);

      dayData.scores.push(scorePercent);
      dayData.total++;
      dayData.timeTaken.push(grade.timeTaken);

      if (grade.passed) {
        dayData.passed++;
      }

      if (chat?.completed) {
        dayData.completed++;
      }

      // Calculate additional metrics
      // Messages per session (estimated from chat data)
      const messageCount = 0; // TODO: Get actual message count from chat data
      dayData.messages.push(messageCount);

      // Response times (estimated from time taken and message count)
      const avgResponseTime =
        messageCount > 0 ? grade.timeTaken / messageCount / 60 : 0;
      dayData.responseTimes.push(avgResponseTime);

      // Track attempts
      dayData.attempts.push(1);

      // First attempt pass rate (simplified - assuming first attempt if no previous attempts)
      const isFirstAttempt = !attempts.some(
        (a) =>
          a.profileId === attempt?.profileId &&
          a.simulationId === attempt?.simulationId &&
          new Date(a.createdAt) < new Date(attempt.createdAt)
      );
      if (isFirstAttempt && grade.passed) {
        dayData.firstAttemptPassed.push(1);
      } else if (isFirstAttempt) {
        dayData.firstAttemptPassed.push(0);
      }
    });

    // Convert to array and calculate metrics
    const growthMetrics = Array.from(dailyData.values())
      .map((dayData) => {
        const avgScore =
          dayData.scores.length > 0
            ? Math.round(
                dayData.scores.reduce((sum, score) => sum + score, 0) /
                  dayData.scores.length
              )
            : 0;

        const completionPercentage =
          dayData.total > 0
            ? Math.round((dayData.completed / dayData.total) * 100)
            : 0;

        const firstAttemptPassRate =
          dayData.firstAttemptPassed.length > 0
            ? Math.round(
                (dayData.firstAttemptPassed.reduce(
                  (sum, passed) => sum + passed,
                  0
                ) /
                  dayData.firstAttemptPassed.length) *
                  100
              )
            : 0;

        const highestScore =
          dayData.scores.length > 0 ? Math.max(...dayData.scores) : 0;

        const messagesPerSession =
          dayData.messages.length > 0
            ? Math.round(
                dayData.messages.reduce((sum, msg) => sum + msg, 0) /
                  dayData.messages.length
              )
            : 0;

        const personaResponseTimes =
          dayData.responseTimes.length > 0
            ? Math.round(
                dayData.responseTimes.reduce((sum, time) => sum + time, 0) /
                  dayData.responseTimes.length
              )
            : 0;

        const avgTimeMinutes =
          dayData.timeTaken.length > 0
            ? dayData.timeTaken.reduce((sum, time) => sum + time, 0) /
              dayData.timeTaken.length /
              60
            : 1; // Avoid division by zero

        // Session Efficiency Index: (Average Score %) / (Average Time per Session in minutes)
        const sessionEfficiency =
          avgTimeMinutes > 0
            ? Math.round((avgScore / avgTimeMinutes) * 10) // Scale factor of 10 for better visibility
            : 0;

        // Stagnation Rate (simplified - based on score variance)
        const scoreVariance =
          dayData.scores.length > 1
            ? Math.sqrt(
                dayData.scores.reduce(
                  (sum, score) => sum + Math.pow(score - avgScore, 2),
                  0
                ) /
                  (dayData.scores.length - 1)
              )
            : 0;
        const stagnationRate = Math.round(Math.min(scoreVariance / 10, 100));

        const timeSpent = Math.round(avgTimeMinutes);

        const totalAttempts = dayData.attempts.reduce(
          (sum, attempt) => sum + attempt,
          0
        );

        return {
          date: dayData.date,
          averageScore: avgScore,
          completionPercentage,
          firstAttemptPassRate,
          highestScore,
          messagesPerSession,
          personaResponseTimes,
          sessionEfficiency,
          stagnationRate,
          timeSpent,
          totalAttempts,
          // Legacy fields for backward compatibility
          avgScore,
          passRate: firstAttemptPassRate,
          completionRate: completionPercentage,
          efficiencyIndex: sessionEfficiency,
        };
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Scale efficiency index to 0-100 range relative to the dataset
    if (growthMetrics.length > 0) {
      const maxEfficiency = Math.max(
        ...growthMetrics.map((m) => m.sessionEfficiency)
      );
      const minEfficiency = Math.min(
        ...growthMetrics.map((m) => m.sessionEfficiency)
      );
      const efficiencyRange = maxEfficiency - minEfficiency;

      if (efficiencyRange > 0) {
        growthMetrics.forEach((metric) => {
          metric.sessionEfficiency = Math.round(
            ((metric.sessionEfficiency - minEfficiency) / efficiencyRange) * 100
          );
          metric.efficiencyIndex = metric.sessionEfficiency; // Keep legacy field in sync
        });
      }
    }

    return growthMetrics;
  }, [
    profiles,
    chats,
    grades,
    attempts,
    simulations,
    rubrics,
    dateStart,
    dateEnd,
    profileId,
  ]);

  // Get actionable insights
  const getActionableInsights = () => {
    if (growthData.length < 2) return null;

    const latest = growthData[growthData.length - 1];
    const previous = growthData[Math.floor(growthData.length / 2)]; // Mid-point for comparison

    if (!latest || !previous) return null;

    const metrics = selectedMetricObjects.map((metric) => ({
      name: metric.name,
      current: latest[metric.id as keyof typeof latest] as number,
      previous: previous[metric.id as keyof typeof previous] as number,
      color: metric.color,
    }));

    // Find the metric with the biggest decline
    const worstMetric = metrics.reduce((worst, metric) => {
      const change = metric.current - metric.previous;
      const worstChange = worst.current - worst.previous;
      return change < worstChange ? metric : worst;
    }, metrics[0]!); // Use non-null assertion since we already checked metrics.length > 0

    if (!worstMetric) return null;

    const change = worstMetric.current - worstMetric.previous;

    if (change < -5) {
      if (worstMetric.name === "Pass Rate") {
        return `${worstMetric.name} has declined by ${Math.abs(change)}%. Consider making scenarios more challenging.`;
      } else if (worstMetric.name === "Completion Rate") {
        return `${worstMetric.name} has declined by ${Math.abs(change)}%. Review session time limits and difficulty.`;
      } else if (worstMetric.name === "Efficiency Index") {
        return `${worstMetric.name} has declined by ${Math.abs(change)}%. Focus on time management training.`;
      } else {
        return `${worstMetric.name} has declined by ${Math.abs(change)}%. Consider additional training support.`;
      }
    }

    return null;
  };

  if (!growthData.length) {
    return (
      <Card className="w-full h-full flex flex-col">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Platform Growth
              </CardTitle>
              <CardDescription>
                Platform-wide performance metrics over time
              </CardDescription>
            </div>
            <GrowthPicker
              availableMetrics={availableMetrics}
              selectedMetrics={selectedMetrics}
              onMetricsChange={setSelectedMetrics}
            />
          </div>
        </CardHeader>
        <CardContent className="flex items-center justify-center flex-1">
          <p className="text-muted-foreground">
            No growth data found for the selected date range
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
              <TrendingUp className="h-5 w-5" />
              Platform Growth
            </CardTitle>
            <CardDescription>
              Platform-wide performance metrics over time
            </CardDescription>
          </div>
          <GrowthPicker
            availableMetrics={availableMetrics}
            selectedMetrics={selectedMetrics}
            onMetricsChange={setSelectedMetrics}
          />
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden">
        <div className="space-y-6">
          {/* Multi-line Chart */}
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={growthData} margin={{ bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="date"
                  className="text-xs"
                  angle={-45}
                  textAnchor="end"
                  height={60}
                />
                <YAxis className="text-xs" domain={[0, 100]} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--background))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "6px",
                  }}
                  formatter={(value: number, name: string) => {
                    const metric = availableMetrics.find((m) => m.id === name);
                    const formattedValue = metric?.formatter
                      ? metric.formatter(value)
                      : `${value}%`;
                    return [formattedValue, metric?.name || name];
                  }}
                />
                <Legend />
                {selectedMetricObjects.map((metric) => (
                  <Line
                    key={metric.id}
                    type="monotone"
                    dataKey={metric.id}
                    stroke={metric.color}
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    name={metric.name}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Actionable Insights */}
          {getActionableInsights() && (
            <div className="p-3 bg-muted rounded-lg mt-2">
              <p className="text-sm text-muted-foreground">
                {getActionableInsights()}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
