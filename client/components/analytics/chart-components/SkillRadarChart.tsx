/**
 * SkillRadarChart.tsx
 * Radar chart component for skill development visualization
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
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
import { TrendingUp } from "lucide-react";
import { useMemo } from "react";
import { PolarAngleAxis, PolarGrid, Radar, RadarChart } from "recharts";

const radarChartConfig = {
  score: {
    label: "Performance Score",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

interface SkillRadarChartProps {
  grades: Array<{
    id: string;
    score: number;
    timeTaken: number;
    createdAt: string;
    simulationChatId: string;
  }>;
  feedbacks: Array<{
    id: string;
    standardId: string;
    total: number;
  }>;
  standards: Array<{
    id: string;
    standardGroupId: string;
  }>;
  standardGroups: Array<{
    id: string;
    name: string;
    shortName: string;
    rubricId: string;
  }>;
  chats: Array<{
    id: string;
    completed: boolean;
  }>;
  rubrics: Array<{
    id: string;
    points: number;
  }>;
}

export default function SkillRadarChart({
  grades,
  feedbacks,
  standards,
  standardGroups,
  chats,
  rubrics,
}: SkillRadarChartProps) {
  // Calculate radar chart data (skill development)
  const radarData = useMemo(() => {
    if (!grades || !feedbacks || !standards || !standardGroups || !rubrics)
      return [];

    if (grades.length === 0) return [];

    // Calculate overall score from grades - normalize to percentage based on rubric total points
    const rubric = rubrics?.find((r) =>
      standardGroups?.some((sg) => sg.rubricId === r.id)
    );
    const rubricTotalPoints = rubric?.points || 20;

    const avgScore = Math.round(
      (grades.reduce((sum, grade) => sum + grade.score, 0) /
        grades.length /
        rubricTotalPoints) *
        100
    );

    // Calculate skill-based scores from feedbacks and standards using rubric total points
    const skillScores = standardGroups.reduce(
      (acc, group) => {
        const groupStandards = standards.filter(
          (s) => s.standardGroupId === group.id
        );
        const groupFeedbacks = feedbacks.filter((f) =>
          groupStandards.some((s) => s.id === f.standardId)
        );

        if (groupFeedbacks.length > 0) {
          const rubric = rubrics?.find((r) => r.id === group.rubricId);
          const rubricTotalPoints = rubric?.points || 20;

          const avgScore = Math.round(
            (groupFeedbacks.reduce((sum, f) => sum + f.total, 0) /
              groupFeedbacks.length /
              rubricTotalPoints) *
              100
          );
          acc[group.name.toLowerCase().replace(/\s+/g, "")] = avgScore;
        }

        return acc;
      },
      {} as Record<string, number>
    );

    // Calculate time management score from grades (inverse of time taken, normalized)
    const avgTimeTaken =
      grades.reduce((sum, grade) => sum + grade.timeTaken, 0) / grades.length;
    const timeManagementScore = Math.max(
      0,
      Math.min(100, 100 - avgTimeTaken / 3600)
    ); // Normalize based on hours

    // Calculate engagement score based on interaction frequency and completion
    const completedChats = chats?.filter((chat) => chat.completed).length || 0;
    const totalChats = chats?.length || 0;
    const engagementScore =
      totalChats > 0 ? Math.round((completedChats / totalChats) * 100) : 0;

    // Create dynamic metrics based on actual standard groups
    const dynamicMetrics = [
      {
        metric: "Overall Score",
        value: avgScore,
        fullMark: 100,
      },
    ];

    // Add skill scores based on actual standard groups
    standardGroups.forEach((group) => {
      const skillKey = group.name.toLowerCase().replace(/\s+/g, "");
      const skillValue = skillScores[skillKey] || 0;
      dynamicMetrics.push({
        metric: group.shortName || group.name,
        value: skillValue,
        fullMark: 100,
      });
    });

    // Add calculated metrics
    dynamicMetrics.push(
      {
        metric: "Time Management",
        value: Math.round(timeManagementScore),
        fullMark: 100,
      },
      {
        metric: "Engagement",
        value: engagementScore,
        fullMark: 100,
      }
    );

    return dynamicMetrics;
  }, [grades, feedbacks, standards, standardGroups, chats, rubrics]);

  // Calculate growth trend
  const growthTrend = useMemo(() => {
    if (!grades || grades.length < 2 || !rubrics || !standardGroups)
      return { value: 0, isPositive: true };

    // Get the rubric total points dynamically
    const rubric = rubrics?.find((r) =>
      standardGroups?.some((sg) => sg.rubricId === r.id)
    );
    const rubricTotalPoints = rubric?.points || 20;

    // Sort grades by creation date
    const sortedGrades = [...grades].sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    const recentCount = Math.min(5, Math.floor(sortedGrades.length / 2));
    const recent = sortedGrades.slice(-recentCount);
    const previous = sortedGrades.slice(0, recentCount);

    if (previous.length === 0) return { value: 0, isPositive: true };

    // Normalize scores to percentage based on rubric total points
    const recentAvg =
      (recent.reduce((sum, g) => sum + g.score, 0) /
        recent.length /
        rubricTotalPoints) *
      100;
    const previousAvg =
      (previous.reduce((sum, g) => sum + g.score, 0) /
        previous.length /
        rubricTotalPoints) *
      100;

    const change = Math.round(((recentAvg - previousAvg) / previousAvg) * 100);
    return { value: Math.abs(change), isPositive: change >= 0 };
  }, [grades, rubrics, standardGroups]);

  return (
    <Card>
      <CardHeader className="items-center">
        <CardTitle>Skill Development</CardTitle>
        <CardDescription>
          Performance across key teaching competencies
        </CardDescription>
      </CardHeader>
      <CardContent className="pb-0">
        <ChartContainer
          config={radarChartConfig}
          className="mx-auto aspect-square max-h-[400px]"
        >
          <RadarChart data={radarData}>
            <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
            <PolarAngleAxis dataKey="metric" />
            <PolarGrid />
            <Radar
              dataKey="value"
              fill="var(--color-score)"
              fillOpacity={0.6}
              dot={{
                r: 4,
                fillOpacity: 1,
              }}
            />
          </RadarChart>
        </ChartContainer>
      </CardContent>
      {radarData.length > 0 && (
        <CardContent className="flex-col gap-2 text-sm">
          <div className="flex items-center gap-2 leading-none font-medium">
            {growthTrend.isPositive ? "Trending up" : "Needs attention"}
            {growthTrend.value > 0 && ` by ${growthTrend.value}%`}
            <TrendingUp
              className={`h-4 w-4 ${growthTrend.isPositive ? "" : "rotate-180"}`}
            />
          </div>
          <div className="text-muted-foreground flex items-center gap-2 leading-none">
            Based on recent training sessions
          </div>
        </CardContent>
      )}
    </Card>
  );
}
