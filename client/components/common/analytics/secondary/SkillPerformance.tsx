/**
 * SkillPerformance.tsx
 * This component displays the skill performance for the personas.
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
import { getAllRubrics } from "@/utils/queries/rubrics/get-all-rubrics";
import { getSimulationChatFeedbacksBySimulationChatGrades } from "@/utils/queries/simulation_chat_feedbacks/get-simulation-chat-feedbacks-by-simulationchatgrades";
import { getSimulationChatGradesByRubrics } from "@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-rubrics";
import { getStandardGroupsByRubrics } from "@/utils/queries/standard_groups/get-standard-groups-by-rubrics";
import { getStandardsByStandardGroups } from "@/utils/queries/standards/get-standards-by-standardgroups";
import { useQuery } from "@tanstack/react-query";
import { isAfter, isBefore } from "date-fns";
import { GraduationCap, Loader2 } from "lucide-react";
import { useMemo } from "react";
import {
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from "recharts";

export interface SkillPerformanceProps {
  dateStart: Date;
  dateEnd: Date;
  _profileId?: string;
  _thresholds: {
    danger: number;
    warning: number;
    success: number;
  };
}

export default function SkillPerformance({
  dateStart,
  dateEnd,
  _profileId,
  _thresholds,
}: SkillPerformanceProps) {
  // Fetch data
  const { data: rubrics, isLoading: rubricsLoading } = useQuery({
    queryKey: ["rubrics"],
    queryFn: () => getAllRubrics(),
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

  // Calculate radar chart data (skill development) - filtered by date range
  const radarData = useMemo(() => {
    if (!grades || !feedbacks || !standards || !standardGroups || !rubrics) {
      return [];
    }

    if (grades.length === 0) return [];

    // Filter grades by date range
    const filteredGrades = grades.filter((grade) => {
      const gradeDate = new Date(grade.createdAt);
      return isAfter(gradeDate, dateStart) && isBefore(gradeDate, dateEnd);
    });

    if (filteredGrades.length === 0) return [];

    // Filter feedbacks to only include those from filtered grades
    const filteredFeedbacks = feedbacks.filter((feedback) =>
      filteredGrades.some(
        (grade) => grade.id === feedback.simulationChatGradeId
      )
    );

    // Calculate skill-based scores from feedbacks and standards
    const skillScores = standardGroups.reduce(
      (acc, group) => {
        const groupStandards = standards.filter(
          (s) => s.standardGroupId === group.id
        );
        const groupFeedbacks = filteredFeedbacks.filter((f) =>
          groupStandards.some((s) => s.id === f.standardId)
        );

        if (groupFeedbacks.length > 0) {
          // Get the rubric for this standard group
          const rubric = rubrics.find((r) => r.id === group.rubricId);
          const rubricTotalPoints = rubric?.points || 100;

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

    // Create metrics based on standard groups
    const dynamicMetrics: Array<{
      metric: string;
      value: number;
      fullMark: number;
    }> = [];

    // Add skill scores based on standard groups
    standardGroups.forEach((group) => {
      const skillKey = group.name.toLowerCase().replace(/\s+/g, "");
      const skillValue = skillScores[skillKey] || 0;
      dynamicMetrics.push({
        metric: group.shortName || group.name,
        value: skillValue,
        fullMark: 100,
      });
    });

    return dynamicMetrics;
  }, [
    grades,
    feedbacks,
    standards,
    standardGroups,
    rubrics,
    dateStart,
    dateEnd,
  ]);

  // Check if any critical data is still loading
  const isLoading =
    rubricsLoading ||
    standardGroupsLoading ||
    standardsLoading ||
    gradesLoading ||
    feedbacksLoading;

  // Show loading state
  if (isLoading) {
    return (
      <Card className="w-full h-full flex flex-col">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5" />
            Skill Performance
          </CardTitle>
          <CardDescription>
            Performance across key teaching competencies
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center flex-1">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading skill data...
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show empty state if no data
  if (!radarData.length) {
    return (
      <Card className="w-full h-full flex flex-col">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5" />
            Skill Performance
          </CardTitle>
          <CardDescription>
            Performance across key teaching competencies
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center flex-1">
          <div className="text-center text-muted-foreground">
            <p>No skill data available for the selected time period</p>
            <p className="text-sm">
              Complete some training sessions to see your progress
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full h-full flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GraduationCap className="h-5 w-5" />
          Skill Performance
        </CardTitle>
        <CardDescription>
          Performance across key teaching competencies
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden">
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={radarData}>
              <PolarAngleAxis dataKey="metric" />
              <PolarGrid />
              <Radar
                dataKey="value"
                fill="#3b82f6"
                fillOpacity={0.6}
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{
                  r: 4,
                  fillOpacity: 1,
                  fill: "#3b82f6",
                }}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
