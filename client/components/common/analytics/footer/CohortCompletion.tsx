/**
 * CohortCompletion.tsx
 * This is used to show a radial chart of the completion of a cohort. There will be a select in the top right corner to select all the cohorts.
 * @AshokSaravanan222 & @siladiea
 * 06/18/2025
 */
"use client";

import { Badge } from "@/components/ui/badge";
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
import { Progress } from "@/components/ui/progress";
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
import { useQuery } from "@tanstack/react-query";
import { Loader2, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { PolarRadiusAxis, RadialBar, RadialBarChart } from "recharts";

const radialChartConfig = {
  progress: {
    label: "Progress",
    color: "var(--chart-2)",
  },
  completed: {
    label: "Completed",
    color: "var(--chart-3)",
  },
} satisfies ChartConfig;

interface CohortCompletionProps {
  className?: string;
}

export default function CohortCompletion({ className }: CohortCompletionProps) {
  const { data: cohorts, isLoading: cohortsLoading } = useQuery({
    queryKey: ["cohorts"],
    queryFn: () => getAllCohorts(),
  });

  const { data: profiles, isLoading: profilesLoading } = useQuery({
    queryKey: ["profiles"],
    queryFn: () => getAllProfiles(),
  });

  const { data: attempts, isLoading: attemptsLoading } = useQuery({
    queryKey: ["attempts"],
    queryFn: () => getAllSimulationAttempts(),
  });

  const { data: chats, isLoading: chatsLoading } = useQuery({
    queryKey: ["chats"],
    queryFn: () => getAllSimulationChats(),
  });

  // State for selected cohort
  const [selectedCohortId, setSelectedCohortId] = useState<string>(() => {
    return cohorts?.[0]?.id || "all";
  });

  // Update selected cohort if it becomes unavailable or set initial value
  useMemo(() => {
    if (!selectedCohortId && cohorts && cohorts.length > 0) {
      setSelectedCohortId("all");
    } else if (
      selectedCohortId !== "all" &&
      cohorts &&
      !cohorts.some((c) => c.id === selectedCohortId)
    ) {
      setSelectedCohortId("all");
    }
  }, [selectedCohortId, cohorts]);

  // Calculate radial chart data (cohort progress) - filtered by selected cohort
  const radialData = useMemo(() => {
    if (!cohorts || !profiles || !attempts) return [];

    // Filter cohorts based on selection
    const filteredCohorts =
      selectedCohortId === "all"
        ? cohorts
        : cohorts.filter((cohort) => cohort.id === selectedCohortId);

    return filteredCohorts.map((cohort) => {
      // Filter profiles that belong to this cohort
      const cohortProfiles = profiles.filter((profile) =>
        cohort.profileIds.includes(profile.id)
      );

      // Calculate completion rate for this cohort
      const cohortAttempts = attempts.filter((attempt) =>
        cohortProfiles.some((profile) => profile.id === attempt.profileId)
      );

      const completedAttempts = cohortAttempts.filter((attempt) => {
        const attemptChats = chats?.filter(
          (chat) => chat.attemptId === attempt.id
        );
        return attemptChats?.some((chat) => chat.completed);
      });

      const progressPercentage =
        cohortAttempts.length > 0
          ? Math.round((completedAttempts.length / cohortAttempts.length) * 100)
          : 0;

      return {
        name: cohort.title,
        progress: progressPercentage,
        completed: completedAttempts.length,
        total: cohortAttempts.length,
        fill: `var(--chart-${(cohorts.indexOf(cohort) % 5) + 1})`,
      };
    });
  }, [cohorts, profiles, attempts, chats, selectedCohortId]);

  // Check if any critical data is still loading
  const isLoading =
    cohortsLoading || profilesLoading || attemptsLoading || chatsLoading;

  // Show loading state
  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Cohort Progress
          </CardTitle>
          <CardDescription>
            Completion rates across different cohorts
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[400px]">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading cohort data...
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show empty state if no data
  if (!cohorts?.length || !radialData.length) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Cohort Progress
          </CardTitle>
          <CardDescription>
            Completion rates across different cohorts
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[400px]">
          <div className="text-center text-muted-foreground">
            <p>No cohort data available</p>
            <p className="text-sm">Create cohorts to track training progress</p>
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
              <Users className="h-5 w-5" />
              Cohort Progress
            </CardTitle>
            <CardDescription>
              Completion rates across different cohorts
            </CardDescription>
          </div>
          {cohorts && cohorts.length > 1 && (
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
        <ChartContainer
          config={radialChartConfig}
          className="mx-auto aspect-square max-h-[400px]"
        >
          <RadialBarChart
            data={radialData}
            startAngle={-90}
            endAngle={270}
            innerRadius={30}
            outerRadius={110}
          >
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent hideLabel nameKey="name" />}
            />
            <PolarRadiusAxis tick={false} tickLine={false} axisLine={false} />
            <RadialBar
              dataKey="progress"
              background
              cornerRadius={10}
              fill="var(--color-progress)"
            />
          </RadialBarChart>
        </ChartContainer>
      </CardContent>
      {radialData.length > 0 && (
        <CardContent className="space-y-3">
          {radialData.map((cohort) => (
            <div
              key={cohort.name}
              className="flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: cohort.fill }}
                />
                <span className="text-sm font-medium">{cohort.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <Progress value={cohort.progress} className="w-16 h-2" />
                <span className="text-sm text-muted-foreground w-12">
                  {cohort.progress}%
                </span>
                <Badge variant="outline" className="text-xs">
                  {cohort.completed}/{cohort.total}
                </Badge>
              </div>
            </div>
          ))}
        </CardContent>
      )}
    </Card>
  );
}
