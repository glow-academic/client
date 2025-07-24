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
import { useMemo } from "react";
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

export interface GrowthProps {
  dateStart: Date;
  dateEnd: Date;
  profileId?: string;
}

export default function Growth({
  dateStart,
  dateEnd,
  profileId,
}: GrowthProps) {
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

        const passRate =
          dayData.total > 0
            ? Math.round((dayData.passed / dayData.total) * 100)
            : 0;

        const completionRate =
          dayData.total > 0
            ? Math.round((dayData.completed / dayData.total) * 100)
            : 0;

        const avgTimeMinutes =
          dayData.timeTaken.length > 0
            ? dayData.timeTaken.reduce((sum, time) => sum + time, 0) /
              dayData.timeTaken.length /
              60
            : 1; // Avoid division by zero

        // Session Efficiency Index: (Average Score %) / (Average Time per Session in minutes)
        const efficiencyIndex =
          avgTimeMinutes > 0
            ? Math.round((avgScore / avgTimeMinutes) * 10) // Scale factor of 10 for better visibility
            : 0;

        return {
          date: dayData.date,
          avgScore,
          passRate,
          completionRate,
          efficiencyIndex,
        };
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Scale efficiency index to 0-100 range relative to the dataset
    if (growthMetrics.length > 0) {
      const maxEfficiency = Math.max(
        ...growthMetrics.map((m) => m.efficiencyIndex)
      );
      const minEfficiency = Math.min(
        ...growthMetrics.map((m) => m.efficiencyIndex)
      );
      const efficiencyRange = maxEfficiency - minEfficiency;

      if (efficiencyRange > 0) {
        growthMetrics.forEach((metric) => {
          metric.efficiencyIndex = Math.round(
            ((metric.efficiencyIndex - minEfficiency) / efficiencyRange) * 100
          );
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

    const metrics = [
      {
        name: "Average Score",
        current: latest.avgScore,
        previous: previous.avgScore,
        color: "#3b82f6",
      },
      {
        name: "Pass Rate",
        current: latest.passRate,
        previous: previous.passRate,
        color: "#10b981",
      },
      {
        name: "Completion Rate",
        current: latest.completionRate,
        previous: previous.completionRate,
        color: "#8b5cf6",
      },
      {
        name: "Efficiency Index",
        current: latest.efficiencyIndex,
        previous: previous.efficiencyIndex,
        color: "#f97316",
      },
    ];

    // Find the metric with the biggest decline
    const worstMetric = metrics.reduce((worst, metric) => {
      const change = metric.current - metric.previous;
      const worstChange = worst.current - worst.previous;
      return change < worstChange ? metric : worst;
    });

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
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Platform Growth
          </CardTitle>
          <CardDescription>
            Platform-wide performance metrics over time
          </CardDescription>
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
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Platform Growth
        </CardTitle>
        <CardDescription>
          Platform-wide performance metrics over time
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden">
        <div className="space-y-6">
          {/* Multi-line Chart */}
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={growthData}>
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
                  formatter={(value: number, name: string) => [
                    `${value}%`,
                    name === "avgScore"
                      ? "Average Score"
                      : name === "passRate"
                        ? "Pass Rate"
                        : name === "completionRate"
                          ? "Completion Rate"
                          : "Efficiency Index",
                  ]}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="avgScore"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  name="Average Score"
                />
                <Line
                  type="monotone"
                  dataKey="passRate"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  name="Pass Rate"
                />
                <Line
                  type="monotone"
                  dataKey="completionRate"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  name="Completion Rate"
                />
                <Line
                  type="monotone"
                  dataKey="efficiencyIndex"
                  stroke="#f97316"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  name="Efficiency Index"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Actionable Insights */}
          {getActionableInsights() && (
            <div className="p-4 bg-muted rounded-lg">
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
