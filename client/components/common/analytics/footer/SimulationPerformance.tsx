/**
 * SimulationPerformance.tsx
 * This is used to show the simulation performance. It will be a horizontal bar chart, following these docs: https://ui.shadcn.com/charts/bar#charts. It will have a selector in the top right corner, similar to the cohort completion, so they can select
 * @AshokSaravanan222 & @siladiea
 * 06/18/2025
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
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { getAllCohorts } from "@/utils/queries/cohorts/get-all-cohorts";
import { getAllProfiles } from "@/utils/queries/profiles/get-all-profiles";
import { getAllSimulationAttempts } from "@/utils/queries/simulation_attempts/get-all-simulation-attempts";
import { getAllSimulationChats } from "@/utils/queries/simulation_chats/get-all-simulation-chats";
import { getAllSimulations } from "@/utils/queries/simulations/get-all-simulations";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, Loader2, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis } from "recharts";

type ColorTheme =
  | "blue"
  | "green"
  | "purple"
  | "orange"
  | "teal"
  | "red"
  | "emerald"
  | "indigo";
type ChartType = "bar";

export interface SimulationPerformanceProps {
  className?: string;
  color?: ColorTheme;
  defaultSelection?: string;
  chartType?: ChartType;
  title?: string;
  showSelector?: boolean;
}

const COLOR_CONFIGS = {
  blue: {
    completionRate: "#3b82f6",
    averageScore: "#60a5fa",
    trend: "text-blue-600",
  },
  green: {
    completionRate: "#10b981",
    averageScore: "#34d399",
    trend: "text-green-600",
  },
  purple: {
    completionRate: "#8b5cf6",
    averageScore: "#a78bfa",
    trend: "text-purple-600",
  },
  orange: {
    completionRate: "#f97316",
    averageScore: "#fb923c",
    trend: "text-orange-600",
  },
  teal: {
    completionRate: "#14b8a6",
    averageScore: "#2dd4bf",
    trend: "text-teal-600",
  },
  red: {
    completionRate: "#ef4444",
    averageScore: "#f87171",
    trend: "text-red-600",
  },
  emerald: {
    completionRate: "#10b981",
    averageScore: "#34d399",
    trend: "text-emerald-600",
  },
  indigo: {
    completionRate: "#6366f1",
    averageScore: "#818cf8",
    trend: "text-indigo-600",
  },
};

export default function SimulationPerformance({
  className,
  color = "blue",
  defaultSelection = "all",
  chartType: _chartType = "bar",
  title = "Simulation Performance",
  showSelector = true,
}: SimulationPerformanceProps) {
  const colorConfig = COLOR_CONFIGS[color];

  const chartConfig = {
    completionRate: {
      label: "Completion Rate",
      color: colorConfig.completionRate,
    },
    averageScore: {
      label: "Average Score",
      color: colorConfig.averageScore,
    },
  } satisfies ChartConfig;

  const { data: cohorts, isLoading: cohortsLoading } = useQuery({
    queryKey: ["cohorts"],
    queryFn: () => getAllCohorts(),
  });

  const { data: simulations, isLoading: simulationsLoading } = useQuery({
    queryKey: ["simulations"],
    queryFn: () => getAllSimulations(),
  });

  const { data: attempts, isLoading: attemptsLoading } = useQuery({
    queryKey: ["attempts"],
    queryFn: () => getAllSimulationAttempts(),
  });

  const { data: chats, isLoading: chatsLoading } = useQuery({
    queryKey: ["chats"],
    queryFn: () => getAllSimulationChats(),
  });

  const { data: profiles, isLoading: profilesLoading } = useQuery({
    queryKey: ["profiles"],
    queryFn: () => getAllProfiles(),
  });

  // State for selected cohort
  const [selectedCohortId, setSelectedCohortId] =
    useState<string>(defaultSelection);

  // Calculate simulation performance data
  const performanceData = useMemo(() => {
    if (!simulations || !attempts || !chats || !cohorts || !profiles) return [];

    // Filter profiles by selected cohort
    const filteredProfiles =
      selectedCohortId === "all"
        ? profiles
        : profiles.filter((profile) =>
            cohorts
              .find((cohort) => cohort.id === selectedCohortId)
              ?.profileIds.includes(profile.id)
          );

    return simulations
      .map((simulation) => {
        // Get attempts for this simulation from filtered profiles
        const simulationAttempts = attempts.filter(
          (attempt) =>
            attempt.simulationId === simulation.id &&
            filteredProfiles.some((profile) => profile.id === attempt.profileId)
        );

        if (simulationAttempts.length === 0) {
          return {
            name: simulation.title,
            completionRate: 0,
            averageScore: 0,
            totalAttempts: 0,
          };
        }

        // Calculate completion rate
        const completedAttempts = simulationAttempts.filter((attempt) => {
          const attemptChats = chats.filter(
            (chat) => chat.attemptId === attempt.id
          );
          return attemptChats.some((chat) => chat.completed);
        });

        const completionRate = Math.round(
          (completedAttempts.length / simulationAttempts.length) * 100
        );

        // Calculate average score (placeholder calculation)
        const averageScore =
          completedAttempts.length > 0
            ? Math.round(Math.random() * 40 + 60) // Placeholder: generates score between 60-100
            : 0;

        return {
          name:
            simulation.title.length > 20
              ? simulation.title.substring(0, 20) + "..."
              : simulation.title,
          completionRate,
          averageScore,
          totalAttempts: simulationAttempts.length,
        };
      })
      .filter((sim) => sim.totalAttempts > 0)
      .slice(0, 10); // Show top 10 simulations with attempts
  }, [simulations, attempts, chats, cohorts, profiles, selectedCohortId]);

  // Calculate performance trend
  const performanceTrend = useMemo(() => {
    if (!performanceData.length) return { value: 0, isPositive: true };

    const avgCompletion =
      performanceData.reduce((sum, sim) => sum + sim.completionRate, 0) /
      performanceData.length;
    const avgScore =
      performanceData.reduce((sum, sim) => sum + sim.averageScore, 0) /
      performanceData.length;

    // Simple trend calculation based on performance metrics
    const overallPerformance = (avgCompletion + avgScore) / 2;
    return {
      value: Math.round(overallPerformance),
      isPositive: overallPerformance >= 70,
    };
  }, [performanceData]);

  // Check if any critical data is still loading
  const isLoading =
    cohortsLoading ||
    simulationsLoading ||
    attemptsLoading ||
    chatsLoading ||
    profilesLoading;

  // Show loading state
  if (isLoading) {
    return (
      <Card className={cn("w-full h-full flex flex-col", className)}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            {title}
          </CardTitle>
          <CardDescription>
            Performance metrics across different simulations
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center flex-1">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading simulation data...
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show empty state if no data
  if (!performanceData.length) {
    return (
      <Card className={cn("w-full h-full flex flex-col", className)}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                {title}
              </CardTitle>
              <CardDescription>
                Performance metrics across different simulations
              </CardDescription>
            </div>
            {showSelector && cohorts && cohorts.length > 0 && (
              <Select
                value={selectedCohortId}
                onValueChange={setSelectedCohortId}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Select a cohort" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Cohorts</SelectItem>
                  {cohorts.map((cohort) => (
                    <SelectItem key={cohort.id} value={cohort.id}>
                      {cohort.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </CardHeader>
        <CardContent className="flex items-center justify-center flex-1">
          <div className="text-center text-muted-foreground">
            <p>No simulation data available</p>
            <p className="text-sm">
              Complete some simulations to see performance metrics
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("w-full h-full flex flex-col", className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              {title}
            </CardTitle>
            <CardDescription>
              Performance metrics across different simulations
            </CardDescription>
          </div>
          {showSelector && cohorts && cohorts.length > 0 && (
            <Select
              value={selectedCohortId}
              onValueChange={setSelectedCohortId}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select a cohort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Cohorts</SelectItem>
                {cohorts.map((cohort) => (
                  <SelectItem key={cohort.id} value={cohort.id}>
                    {cohort.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col justify-end items-start pb-0">
        <ChartContainer
          config={chartConfig}
          className="h-72 w-full max-w-[90%] self-start"
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={performanceData}
              layout="vertical"
              margin={{ left: 60, right: 30, top: 20, bottom: 20 }}
            >
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent indicator="line" />}
              />
              <XAxis type="number" domain={[0, 100]} />
              <YAxis
                type="category"
                dataKey="name"
                tickLine={false}
                axisLine={false}
                width={120}
              />
              <Bar
                dataKey="completionRate"
                fill="var(--color-completionRate)"
                radius={4}
              />
              <Bar
                dataKey="averageScore"
                fill="var(--color-averageScore)"
                radius={4}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
      <CardContent className="flex-col gap-2 text-sm">
        <div className="flex items-center gap-2 leading-none font-medium">
          Overall Performance: {performanceTrend.value}%
          <TrendingUp
            className={`h-4 w-4 ${performanceTrend.isPositive ? colorConfig.trend : colorConfig.trend.replace("600", "600 rotate-180")}`}
          />
        </div>
        <div className="text-muted-foreground leading-none">
          Based on completion rates and average scores
        </div>
      </CardContent>
    </Card>
  );
}
