/**
 * SkillPerformance.tsx
 * This component displays the skill performance for the personas.
 * @AshokSaravanan222 & @siladiea
 * 07/23/2025
 */
"use client";

import {
  RubricPicker,
  type Rubric,
} from "@/components/common/rubric/RubricPicker";
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
import { useMemo, useState } from "react";
import {
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

export interface SkillPerformanceProps {
  dateStart: Date;
  dateEnd: Date;
}

export default function SkillPerformance({
  dateStart,
  dateEnd,
}: SkillPerformanceProps) {
  const [selectedRubrics, setSelectedRubrics] = useState<Rubric[]>([]);

  // Fetch data
  const { data: rubrics, isLoading: rubricsLoading } = useQuery({
    queryKey: ["rubrics"],
    queryFn: () => getAllRubrics(),
  });

  // Set default selection to first rubric when rubrics are loaded
  const defaultRubrics = useMemo(() => {
    if (rubrics && rubrics.length > 0 && selectedRubrics.length === 0) {
      return [rubrics[0]!];
    }
    return selectedRubrics;
  }, [rubrics, selectedRubrics]);

  // Filter rubrics based on selection
  const filteredRubrics = useMemo(() => {
    if (!rubrics) return [];
    if (defaultRubrics.length === 0) return rubrics;
    return rubrics.filter((r) => defaultRubrics.some((sr) => sr.id === r.id));
  }, [rubrics, defaultRubrics]);

  const { data: standardGroups, isLoading: standardGroupsLoading } = useQuery({
    queryKey: ["standardGroups", filteredRubrics?.map((r) => r.id) || []],
    queryFn: () =>
      getStandardGroupsByRubrics(filteredRubrics?.map((r) => r.id) || []),
    enabled: !!filteredRubrics && filteredRubrics.length > 0,
  });

  const { data: standards, isLoading: standardsLoading } = useQuery({
    queryKey: ["standards", standardGroups?.map((sg) => sg.id) || []],
    queryFn: () =>
      getStandardsByStandardGroups(standardGroups?.map((sg) => sg.id) || []),
    enabled: !!standardGroups && standardGroups.length > 0,
  });

  const { data: grades, isLoading: gradesLoading } = useQuery({
    queryKey: ["grades", filteredRubrics?.map((r) => r.id) || []],
    queryFn: () =>
      getSimulationChatGradesByRubrics(filteredRubrics?.map((r) => r.id) || []),
    enabled: !!filteredRubrics && filteredRubrics.length > 0,
  });

  const { data: feedbacks, isLoading: feedbacksLoading } = useQuery({
    queryKey: ["feedbacks", grades?.map((g) => g.id) || []],
    queryFn: () =>
      getSimulationChatFeedbacksBySimulationChatGrades(
        grades?.map((g) => g.id) || []
      ),
    enabled: !!grades && grades.length > 0,
  });

  // Calculate radar chart data (skill development) - filtered by date range and selected rubrics
  const radarData = useMemo(() => {
    if (
      !grades ||
      !feedbacks ||
      !standards ||
      !standardGroups ||
      !filteredRubrics
    ) {
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
        // Find all standards that belong to this standard group
        const groupStandards = standards.filter(
          (s) => s.standardGroupId === group.id
        );

        // Find all feedbacks that correspond to standards in this group
        const groupFeedbacks = filteredFeedbacks.filter((feedback) =>
          groupStandards.some((standard) => standard.id === feedback.standardId)
        );

        if (groupFeedbacks.length > 0) {
          // Group feedbacks by grade (user session) to calculate per-user performance
          const feedbacksByGrade = new Map<string, typeof groupFeedbacks>();

          groupFeedbacks.forEach((feedback) => {
            const gradeId = feedback.simulationChatGradeId;
            if (!feedbacksByGrade.has(gradeId)) {
              feedbacksByGrade.set(gradeId, []);
            }
            feedbacksByGrade.get(gradeId)!.push(feedback);
          });

          // Calculate performance for each user session
          const userPerformances: number[] = [];

          feedbacksByGrade.forEach((userFeedbacks) => {
            // Sum up all feedback totals for this user in this standard group
            const userTotalPoints = userFeedbacks.reduce(
              (sum, feedback) => sum + feedback.total,
              0
            );

            // Calculate user's percentage for this standard group
            const userPercentage =
              group.points > 0 ? (userTotalPoints / group.points) * 100 : 0;

            userPerformances.push(userPercentage);
          });

          // Calculate average performance across all users for this standard group
          const averagePerformance =
            userPerformances.length > 0
              ? Math.round(
                  userPerformances.reduce((sum, perf) => sum + perf, 0) /
                    userPerformances.length
                )
              : 0;

          acc[group.shortName || group.name] = averagePerformance;
        } else {
          // No feedback for this standard group, set to 0
          acc[group.shortName || group.name] = 0;
        }

        return acc;
      },
      {} as Record<string, number>
    );

    // Create metrics based on standard groups using shortName
    const dynamicMetrics: Array<{
      metric: string;
      value: number;
      fullMark: number;
    }> = [];

    // Add skill scores based on standard groups
    standardGroups.forEach((group) => {
      const skillKey = group.shortName || group.name;
      const skillValue = skillScores[skillKey] || 0;
      dynamicMetrics.push({
        metric: skillKey,
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
    filteredRubrics,
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
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <GraduationCap className="h-5 w-5" />
                Skill Performance
              </CardTitle>
              <CardDescription>
                Performance across key teaching competencies
              </CardDescription>
            </div>
            {rubrics && rubrics.length > 0 && (
              <RubricPicker
                rubrics={rubrics.map((r) => ({
                  id: r.id,
                  name: r.name,
                  description: r.description,
                  points: r.points,
                  active: r.active,
                }))}
                placeholder="Filter by rubric..."
                onSelect={setSelectedRubrics}
                selectedRubrics={defaultRubrics}
                buttonClassName="w-48"
              />
            )}
          </div>
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
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <GraduationCap className="h-5 w-5" />
                Skill Performance
              </CardTitle>
              <CardDescription>
                Performance across key teaching competencies
              </CardDescription>
            </div>
            {rubrics && rubrics.length > 0 && (
              <RubricPicker
                rubrics={rubrics.map((r) => ({
                  id: r.id,
                  name: r.name,
                  description: r.description,
                  points: r.points,
                  active: r.active,
                }))}
                placeholder="Filter by rubric..."
                onSelect={setSelectedRubrics}
                selectedRubrics={defaultRubrics}
                buttonClassName="w-48"
              />
            )}
          </div>
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
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5" />
              Skill Performance
            </CardTitle>
            <CardDescription>
              Performance across key teaching competencies
            </CardDescription>
          </div>
          {rubrics && rubrics.length > 0 && (
            <RubricPicker
              rubrics={rubrics.map((r) => ({
                id: r.id,
                name: r.name,
                description: r.description,
                points: r.points,
                active: r.active,
              }))}
              placeholder="Filter by rubric..."
              onSelect={setSelectedRubrics}
              selectedRubrics={defaultRubrics}
              buttonClassName="w-48"
            />
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden">
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={radarData}>
              <PolarAngleAxis dataKey="metric" />
              <PolarGrid />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--background))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "6px",
                }}
                formatter={(value: number, name: string) => [
                  `${value}%`,
                  name === "value" ? "Score" : name,
                ]}
                labelFormatter={(label: string) => `Skill: ${label}`}
              />
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
