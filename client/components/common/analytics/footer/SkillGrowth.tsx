/**
 * SkillGrowth.tsx
 * This is used to show a radar chart of the skills on rubrics. There will be no concept of all rubrics, just be able to see how each one is doing.
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
import { getAllRubrics } from "@/utils/queries/rubrics/get-all-rubrics";
import { getSimulationChatFeedbacksBySimulationChatGrades } from "@/utils/queries/simulation_chat_feedbacks/get-simulation-chat-feedbacks-by-simulationchatgrades";
import { getSimulationChatGradesByRubrics } from "@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-rubrics";
import { getAllSimulationChats } from "@/utils/queries/simulation_chats/get-all-simulation-chats";
import { getStandardGroupsByRubrics } from "@/utils/queries/standard_groups/get-standard-groups-by-rubrics";
import { getStandardsByStandardGroups } from "@/utils/queries/standards/get-standards-by-standardgroups";
import { useQuery } from "@tanstack/react-query";
import { GraduationCap, Loader2, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";
import { PolarAngleAxis, PolarGrid, Radar, RadarChart } from "recharts";

const radarChartConfig = {
  score: {
    label: "Performance Score",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

interface SkillGrowthProps {
  className?: string;
}

export default function SkillGrowth({ className }: SkillGrowthProps) {
  const { data: rubrics, isLoading: rubricsLoading } = useQuery({
    queryKey: ["rubrics"],
    queryFn: () => getAllRubrics(),
  });

  const { data: chats, isLoading: chatsLoading } = useQuery({
    queryKey: ["chats"],
    queryFn: () => getAllSimulationChats(),
  });

  const { data: standardGroups, isLoading: standardGroupsLoading } = useQuery({
    queryKey: ["standardGroups", rubrics?.map((r) => r.id) || []],
    queryFn: () => getStandardGroupsByRubrics(rubrics?.map((r) => r.id) || []),
    enabled: !!rubrics && rubrics.length > 0,
  });

  const { data: standards, isLoading: standardsLoading } = useQuery({
    queryKey: ["standards", standardGroups?.map((sg) => sg.id) || []],
    queryFn: () =>
      getStandardsByStandardGroups(standardGroups?.map((sg) => sg.id) || []),
    enabled: !!standardGroups && standardGroups.length > 0,
  });

  const { data: grades, isLoading: gradesLoading } = useQuery({
    queryKey: ["grades", rubrics?.map((r) => r.id) || []],
    queryFn: () =>
      getSimulationChatGradesByRubrics(rubrics?.map((r) => r.id) || []),
    enabled: !!rubrics && rubrics.length > 0,
  });

  const { data: feedbacks, isLoading: feedbacksLoading } = useQuery({
    queryKey: ["feedbacks", grades?.map((g) => g.id) || []],
    queryFn: () =>
      getSimulationChatFeedbacksBySimulationChatGrades(
        grades?.map((g) => g.id) || []
      ),
    enabled: !!grades && grades.length > 0,
  });

  // State for selected rubric
  const [selectedRubricId, setSelectedRubricId] = useState<string>(() => {
    // Default to the first rubric if available
    return rubrics?.[0]?.id || "";
  });

  // Get unique rubrics from the data
  const availableRubrics = useMemo(() => {
    if (!rubrics || !standardGroups) return [];

    return rubrics.filter((rubric) =>
      standardGroups.some((sg) => sg.rubricId === rubric.id)
    );
  }, [rubrics, standardGroups]);

  // Update selected rubric if it becomes unavailable or set initial value
  useMemo(() => {
    if (!selectedRubricId && availableRubrics.length > 0) {
      setSelectedRubricId(availableRubrics[0]?.id || "");
    } else if (
      selectedRubricId &&
      !availableRubrics.some((r) => r.id === selectedRubricId)
    ) {
      setSelectedRubricId(availableRubrics[0]?.id || "");
    }
  }, [selectedRubricId, availableRubrics]);

  // Calculate radar chart data (skill development) - filtered by selected rubric
  const radarData = useMemo(() => {
    if (!grades || !feedbacks || !standards || !standardGroups || !rubrics)
      return [];

    if (grades.length === 0 || !selectedRubricId) return [];

    // Filter standard groups by selected rubric
    const filteredStandardGroups = standardGroups.filter(
      (sg) => sg.rubricId === selectedRubricId
    );

    if (filteredStandardGroups.length === 0) return [];

    // Get the selected rubric
    const selectedRubric = rubrics.find((r) => r.id === selectedRubricId);
    const rubricTotalPoints = selectedRubric?.points || 20;

    // Calculate overall score from grades - normalize to percentage based on rubric total points
    const avgScore = Math.round(
      (grades.reduce((sum, grade) => sum + grade.score, 0) /
        grades.length /
        rubricTotalPoints) *
        100
    );

    // Calculate skill-based scores from feedbacks and standards using rubric total points
    const skillScores = filteredStandardGroups.reduce(
      (acc, group) => {
        const groupStandards = standards.filter(
          (s) => s.standardGroupId === group.id
        );
        const groupFeedbacks = feedbacks.filter((f) =>
          groupStandards.some((s) => s.id === f.standardId)
        );

        if (groupFeedbacks.length > 0) {
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

    // Create dynamic metrics based on filtered standard groups
    const dynamicMetrics = [
      {
        metric: "Overall Score",
        value: avgScore,
        fullMark: 100,
      },
    ];

    // Add skill scores based on filtered standard groups
    filteredStandardGroups.forEach((group) => {
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
  }, [
    grades,
    feedbacks,
    standards,
    standardGroups,
    chats,
    rubrics,
    selectedRubricId,
  ]);

  // Calculate growth trend - filtered by selected rubric
  const growthTrend = useMemo(() => {
    if (
      !grades ||
      grades.length < 2 ||
      !rubrics ||
      !standardGroups ||
      !selectedRubricId
    )
      return { value: 0, isPositive: true };

    // Get the selected rubric
    const selectedRubric = rubrics.find((r) => r.id === selectedRubricId);
    const rubricTotalPoints = selectedRubric?.points || 20;

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
  }, [grades, rubrics, standardGroups, selectedRubricId]);

  // Check if any critical data is still loading
  const isLoading =
    rubricsLoading ||
    chatsLoading ||
    standardGroupsLoading ||
    standardsLoading ||
    gradesLoading ||
    feedbacksLoading;

  // Show loading state
  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5" />
            Skill Development
          </CardTitle>
          <CardDescription>
            Performance across key teaching competencies
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[400px]">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading skill data...
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show empty state if no data
  if (!availableRubrics.length || !radarData.length) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5" />
            Skill Development
          </CardTitle>
          <CardDescription>
            Performance across key teaching competencies
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[400px]">
          <div className="text-center text-muted-foreground">
            <p>No skill data available</p>
            <p className="text-sm">
              Complete some training sessions to see your progress
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
              <GraduationCap className="h-5 w-5" />
              Skill Development
            </CardTitle>
            <CardDescription>
              Performance across key teaching competencies
            </CardDescription>
          </div>
          {availableRubrics.length > 1 && (
            <Select
              value={selectedRubricId}
              onValueChange={setSelectedRubricId}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select a rubric" />
              </SelectTrigger>
              <SelectContent>
                {availableRubrics.map((rubric) => (
                  <SelectItem key={rubric.id} value={rubric.id}>
                    {rubric.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
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
