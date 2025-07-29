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
import { getAllCohorts } from "@/utils/queries/cohorts/get-all-cohorts";
import { getAllProfiles } from "@/utils/queries/profiles/get-all-profiles";
import { getAllRubrics } from "@/utils/queries/rubrics/get-all-rubrics";
import { getSimulationAttemptsByProfiles } from "@/utils/queries/simulation_attempts/get-simulation-attempts-by-profiles";
import { getSimulationChatFeedbacksBySimulationChatGrades } from "@/utils/queries/simulation_chat_feedbacks/get-simulation-chat-feedbacks-by-simulationchatgrades";
import { getSimulationChatGradesByRubrics } from "@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-rubrics";
import { getSimulationChatsByAttempts } from "@/utils/queries/simulation_chats/get-simulation-chats-by-attempts";
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
  thresholds: {
    danger: number;
    warning: number;
    success: number;
  };
  profileId: string | undefined;
  cohortIds: string[];
}

export default function SkillPerformance({
  dateStart,
  dateEnd,
  thresholds,
  profileId,
  cohortIds,
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
        grades?.map((g) => g.id) || [],
      ),
    enabled: !!grades && grades.length > 0,
  });

  // Fetch cohorts for filtering
  const { data: allCohorts } = useQuery({
    queryKey: ["cohorts"],
    queryFn: () => getAllCohorts(),
  });

  // Filter cohorts based on cohortIds and profileId
  const filteredCohorts = useMemo(() => {
    if (!allCohorts) return [];

    let availableCohorts = allCohorts;

    // If profileId is provided, filter to cohorts that contain this profile
    if (profileId) {
      availableCohorts = availableCohorts.filter((cohort) =>
        cohort.profileIds.includes(profileId),
      );
    }

    // If cohortIds are provided, filter to only those cohorts
    if (cohortIds && cohortIds.length > 0) {
      availableCohorts = availableCohorts.filter((cohort) =>
        cohortIds.includes(cohort.id),
      );
    }

    return availableCohorts;
  }, [allCohorts, profileId, cohortIds]);

  // Check if user has access to any cohorts
  const hasCohortAccess = useMemo(() => {
    return filteredCohorts.length > 0;
  }, [filteredCohorts]);

  // Fetch chats and attempts for profile filtering
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

  // Calculate radar chart data (skill development) - filtered by date range and selected rubrics
  const radarData = useMemo(() => {
    if (
      !grades ||
      !feedbacks ||
      !standards ||
      !standardGroups ||
      !filteredRubrics ||
      !filteredCohorts
    ) {
      return [];
    }

    if (grades.length === 0) return [];

    // Filter grades by date range, profile, and cohort access
    const filteredGrades = grades.filter((grade) => {
      const gradeDate = new Date(grade.createdAt);
      const inDateRange =
        isAfter(gradeDate, dateStart) && isBefore(gradeDate, dateEnd);

      // Filter by profile if provided - need to get profile through chat -> attempt
      let profileMatch = true;
      if (profileId) {
        // Find the chat for this grade
        const chat = chats?.find((c) => c.id === grade.simulationChatId);
        if (chat) {
          // Find the attempt for this chat
          const attempt = attempts?.find((a) => a.id === chat.attemptId);
          profileMatch = attempt?.profileId === profileId;
        } else {
          profileMatch = false;
        }
      }

      // Filter by cohort access - check if the profile belongs to any of the filtered cohorts
      let cohortMatch = true;
      if (filteredCohorts.length > 0) {
        const chat = chats?.find((c) => c.id === grade.simulationChatId);
        if (chat) {
          const attempt = attempts?.find((a) => a.id === chat.attemptId);
          if (attempt?.profileId) {
            const profile = profiles?.find((p) => p.id === attempt.profileId);
            if (profile) {
              // Check if this profile belongs to any of the filtered cohorts
              cohortMatch = filteredCohorts.some((cohort) =>
                cohort.profileIds.includes(profile.id),
              );
            } else {
              cohortMatch = false;
            }
          } else {
            cohortMatch = false;
          }
        } else {
          cohortMatch = false;
        }
      }

      return inDateRange && profileMatch && cohortMatch;
    });

    if (filteredGrades.length === 0) return [];

    // Filter feedbacks to only include those from filtered grades
    const filteredFeedbacks = feedbacks.filter((feedback) =>
      filteredGrades.some(
        (grade) => grade.id === feedback.simulationChatGradeId,
      ),
    );

    // Calculate skill-based scores from feedbacks and standards
    const skillScores = standardGroups.reduce(
      (acc, group) => {
        // Find all standards that belong to this standard group
        const groupStandards = standards.filter(
          (s) => s.standardGroupId === group.id,
        );

        // Find all feedbacks that correspond to standards in this group
        const groupFeedbacks = filteredFeedbacks.filter((feedback) =>
          groupStandards.some(
            (standard) => standard.id === feedback.standardId,
          ),
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
              0,
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
                    userPerformances.length,
                )
              : 0;

          acc[group.shortName || group.name] = averagePerformance;
        } else {
          // No feedback for this standard group, set to 0
          acc[group.shortName || group.name] = 0;
        }

        return acc;
      },
      {} as Record<string, number>,
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
    profileId,
    chats,
    attempts,
    filteredCohorts,
    profiles,
  ]);

  // Calculate threshold status based on skill performance data
  const getThresholdStatus = () => {
    if (radarData.length === 0) return "neutral";

    // Calculate average skill performance across all skills
    const avgSkillPerformance =
      radarData.reduce((sum, skill) => sum + skill.value, 0) / radarData.length;

    if (avgSkillPerformance >= thresholds.success) return "success";
    if (avgSkillPerformance >= thresholds.warning) return "warning";
    return "danger";
  };

  const thresholdStatus = getThresholdStatus();

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

  // Show no access message if user doesn't have access to any cohorts
  if (!hasCohortAccess) {
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
            <p>No cohort access available</p>
            <p className="text-sm">
              {profileId
                ? "You don't have access to any of the specified cohorts."
                : "No cohorts match the specified criteria."}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show empty state if no data
  if (!radarData.length) {
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
