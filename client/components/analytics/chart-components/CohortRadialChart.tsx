/**
 * CohortRadialChart.tsx
 * Radial chart component for cohort progress visualization
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
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
import { useMemo } from "react";
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

interface CohortRadialChartProps {
  cohorts: Array<{
    id: string;
    title: string;
    description: string | null;
    profileIds: string[];
    simulationIds: string[];
  }>;
  profiles: Array<{
    id: string;
    role: string;
  }>;
  attempts: Array<{
    id: string;
    profileId: string | null;
    simulationId: string;
  }>;
  chats: Array<{
    id: string;
    attemptId: string;
    completed: boolean;
  }>;
}

export default function CohortRadialChart({
  cohorts,
  profiles,
  attempts,
  chats,
}: CohortRadialChartProps) {
  // Calculate radial chart data (cohort progress)
  const radialData = useMemo(() => {
    if (!cohorts || !profiles || !attempts) return [];

    return cohorts.map((cohort) => {
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
  }, [cohorts, profiles, attempts, chats]);

  return (
    <Card>
      <CardHeader className="items-center">
        <CardTitle>Cohort Progress</CardTitle>
        <CardDescription>
          Training completion rates across different cohorts
        </CardDescription>
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
