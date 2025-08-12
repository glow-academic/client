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
import { calculatePlatformGrowth } from "@/utils/analytics/primary";
import { profileRole } from "@/utils/drizzle/schema";
import { getAllCohorts } from "@/utils/queries/cohorts/get-all-cohorts";
import { getAllProfiles } from "@/utils/queries/profiles/get-all-profiles";
import { getAllRubrics } from "@/utils/queries/rubrics/get-all-rubrics";
import { getSimulationAttemptsByProfiles } from "@/utils/queries/simulation_attempts/get-simulation-attempts-by-profiles";
import { getSimulationChatGradesBySimulationChats } from "@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulationchats";
import { getSimulationChatsByAttempts } from "@/utils/queries/simulation_chats/get-simulation-chats-by-attempts";
import { getAllSimulations } from "@/utils/queries/simulations/get-all-simulations";
import { useQuery } from "@tanstack/react-query";
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
  thresholds: {
    danger: number;
    warning: number;
    success: number;
  };
  profileId: string | undefined;
  cohortIds: string[];
  selectedRoles: (typeof profileRole.enumValues)[number][];
  showPractice: boolean;
  showNormal: boolean;
}

export default function Growth({
  dateStart,
  dateEnd,
  profileId,
  cohortIds,
  thresholds,
  selectedRoles,
  showPractice,
  showNormal,
}: GrowthProps) {
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
        id: "firstAttemptPassRate",
        name: "First Attempt Pass Rate",
        color: "#f97316",
        description: "Percentage of first attempts that passed",
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

  const { data: cohorts } = useQuery({
    queryKey: ["cohorts"],
    queryFn: () => getAllCohorts(),
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

  // Helper function to check if a profile is in any of the specified cohorts
  const isProfileInCohorts = useMemo(() => {
    if (!cohortIds || cohortIds.length === 0) return () => true;
    if (!cohorts) return () => false;

    return (profileId: string) => {
      return cohorts.some(
        (cohort) =>
          cohort.profileIds.includes(profileId) && cohortIds.includes(cohort.id)
      );
    };
  }, [cohortIds, cohorts]);

  // Calculate growth data using utility function
  const growthData = useMemo(() => {
    return calculatePlatformGrowth(
      grades || [],
      chats || [],
      attempts || [],
      simulations || [],
      rubrics || [],
      profiles || [],
      dateStart,
      dateEnd,
      profileId,
      cohorts || [],
      cohortIds,
      selectedRoles,
      showPractice,
      showNormal
    );
  }, [
    grades,
    chats,
    attempts,
    simulations,
    rubrics,
    profiles,
    dateStart,
    dateEnd,
    profileId,
    cohorts,
    cohortIds,
    selectedRoles,
    showPractice,
    showNormal,
  ]);

  // Calculate threshold status based on growth data
  const getThresholdStatus = () => {
    if (growthData.length < 2) return "neutral";

    const latest = growthData[growthData.length - 1];
    const previous = growthData[Math.floor(growthData.length / 2)]; // Mid-point for comparison

    if (!latest || !previous) return "neutral";

    // Calculate average improvement across selected metrics
    const improvements = selectedMetricObjects.map((metric) => {
      const current = latest[metric.id as keyof typeof latest] as number;
      const prev = previous[metric.id as keyof typeof previous] as number;
      return current - prev;
    });

    const avgImprovement =
      improvements.reduce((sum, imp) => sum + imp, 0) / improvements.length;

    if (avgImprovement >= thresholds.success) return "success";
    if (avgImprovement >= thresholds.warning) return "warning";
    return "danger";
  };

  const thresholdStatus = getThresholdStatus();

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

  // Check if we have any data after cohort filtering
  const hasDataAfterCohortFilter = useMemo(() => {
    if (!cohortIds || cohortIds.length === 0) return true;
    if (!profiles || !cohorts) return false;

    // Check if any profile is in the specified cohorts
    return profiles.some((profile) => isProfileInCohorts(profile.id));
  }, [cohortIds, profiles, cohorts, isProfileInCohorts]);

  if (!hasDataAfterCohortFilter) {
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
            No data available for the selected cohorts
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!growthData.length) {
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
              <TrendingUp className="h-5 w-5" data-testid="trending-up-icon" />
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
          <div
            className="h-72"
            style={
              process.env.NODE_ENV === "test"
                ? { minWidth: 400, minHeight: 300 }
                : undefined
            }
          >
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
