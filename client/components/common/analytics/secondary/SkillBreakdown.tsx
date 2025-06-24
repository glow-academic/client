/**
 * SkillBreakdown.tsx
 * This is used to show the progress bars of the skill breakdown.
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
import { Progress } from "@/components/ui/progress";
import { getAllProfiles } from "@/utils/queries/profiles/get-all-profiles";
import { getAllRubrics } from "@/utils/queries/rubrics/get-all-rubrics";
import { getSimulationAttemptsByProfiles } from "@/utils/queries/simulation_attempts/get-simulation-attempts-by-profiles";
import { getSimulationChatFeedbacksBySimulationChatGrades } from "@/utils/queries/simulation_chat_feedbacks/get-simulation-chat-feedbacks-by-simulationchatgrades";
import { getSimulationChatGradesBySimulationChats } from "@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulationchats";
import { getSimulationChatsByAttempts } from "@/utils/queries/simulation_chats/get-simulation-chats-by-attempts";
import { getStandardGroupsByRubrics } from "@/utils/queries/standard_groups/get-standard-groups-by-rubrics";
import { getStandardsByStandardGroups } from "@/utils/queries/standards/get-standards-by-standardgroups";
import { useQuery } from "@tanstack/react-query";
import { Brain, Eye, GraduationCap, Target, Zap } from "lucide-react";
import { useMemo } from "react";

export default function SkillBreakdown() {
  // Fetch data
  const { data: profiles } = useQuery({
    queryKey: ["profiles"],
    queryFn: () => getAllProfiles(),
  });

  const { data: rubrics } = useQuery({
    queryKey: ["rubrics"],
    queryFn: () => getAllRubrics(),
  });

  const { data: standardGroups } = useQuery({
    queryKey: ["standardGroups", rubrics?.map((rubric) => rubric.id)],
    queryFn: () =>
      getStandardGroupsByRubrics(rubrics!.map((rubric) => rubric.id)),
    enabled: !!rubrics && rubrics.length > 0,
  });

  const { data: standards } = useQuery({
    queryKey: ["standards", standardGroups?.map((group) => group.id)],
    queryFn: () =>
      getStandardsByStandardGroups(standardGroups!.map((group) => group.id)),
    enabled: !!standardGroups && standardGroups.length > 0,
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

  const { data: feedbacks } = useQuery({
    queryKey: ["simulationFeedbacks", grades?.map((grade) => grade.id)],
    queryFn: () =>
      getSimulationChatFeedbacksBySimulationChatGrades(
        grades!.map((grade) => grade.id)
      ),
    enabled: !!grades && grades.length > 0,
  });

  // Calculate skill categories
  const skillCategories = useMemo(() => {
    if (!standardGroups || !standards || !feedbacks || !rubrics) return [];

    const skillScores = standardGroups.reduce(
      (acc, group) => {
        const groupStandards = standards.filter(
          (s) => s.standardGroupId === group.id
        );
        const groupFeedbacks = feedbacks.filter((f) =>
          groupStandards.some((s) => s.id === f.standardId)
        );

        if (groupFeedbacks.length > 0) {
          // Use the rubric's total points instead of max standard points
          const rubric = rubrics?.find((r) => r.id === group.rubricId);
          const rubricTotalPoints = rubric?.points || 100;

          const avgScore = Math.round(
            (groupFeedbacks.reduce((sum, f) => sum + f.total, 0) /
              groupFeedbacks.length /
              rubricTotalPoints) *
              100
          );
          acc[group.shortName || group.name] = avgScore;
        }

        return acc;
      },
      {} as Record<string, number>
    );

    // Get top skill categories for display
    return Object.entries(skillScores)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 4)
      .map(([shortName, score], index) => ({
        shortName,
        score,
        icon: [Target, Brain, Eye, Zap][index] || Target,
      }));
  }, [standardGroups, standards, feedbacks, rubrics]);

  if (!skillCategories.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5" />
            Skill Breakdown
          </CardTitle>
          <CardDescription>Top performing competencies</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[300px]">
            <p className="text-muted-foreground">
              No skill breakdown data available
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GraduationCap className="h-5 w-5" />
          Skill Breakdown
        </CardTitle>
        <CardDescription>Top performing competencies</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6 h-[300px] overflow-y-auto">
          {skillCategories.map((skill) => (
            <div key={skill.shortName} className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <skill.icon className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{skill.shortName}</span>
                </div>
                <span className="font-bold text-lg">{skill.score}%</span>
              </div>
              <Progress value={skill.score} className="h-2" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
