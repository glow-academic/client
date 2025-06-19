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
import { getAllCohorts } from "@/utils/queries/cohorts/get-all-cohorts";
import { getAllProfiles } from "@/utils/queries/profiles/get-all-profiles";
import { getAllSimulationAttempts } from "@/utils/queries/simulation_attempts/get-all-simulation-attempts";
import { getAllSimulationChats } from "@/utils/queries/simulation_chats/get-all-simulation-chats";
import { getAllSimulations } from "@/utils/queries/simulations/get-all-simulations";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, Loader2, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";
import { Bar, BarChart, XAxis, YAxis } from "recharts";

const chartConfig = {
  completionRate: {
    label: "Completion Rate",
    color: "var(--chart-1)",
  },
  averageScore: {
    label: "Average Score",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;

interface SimulationPerformanceProps {
  className?: string;
}

export default function SimulationPerformance({
  className,
}: SimulationPerformanceProps) {
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
  const [selectedCohortId, setSelectedCohortId] = useState<string>("all");

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
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Simulation Performance
          </CardTitle>
          <CardDescription>
            Performance metrics across different simulations
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[400px]">
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
      <Card className={className}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Simulation Performance
              </CardTitle>
              <CardDescription>
                Performance metrics across different simulations
              </CardDescription>
            </div>
            {cohorts && cohorts.length > 0 && (
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
        <CardContent className="flex items-center justify-center h-[400px]">
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
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Simulation Performance
            </CardTitle>
            <CardDescription>
              Performance metrics across different simulations
            </CardDescription>
          </div>
          {cohorts && cohorts.length > 0 && (
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
      <CardContent className="pb-0">
        <ChartContainer config={chartConfig} className="max-h-[400px] w-full">
          <BarChart
            data={performanceData}
            layout="horizontal"
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
        </ChartContainer>
      </CardContent>
      <CardContent className="flex-col gap-2 text-sm">
        <div className="flex items-center gap-2 leading-none font-medium">
          Overall Performance: {performanceTrend.value}%
          <TrendingUp
            className={`h-4 w-4 ${performanceTrend.isPositive ? "text-green-600" : "text-red-600 rotate-180"}`}
          />
        </div>
        <div className="text-muted-foreground leading-none">
          Based on completion rates and average scores
        </div>
      </CardContent>
    </Card>
  );
}
