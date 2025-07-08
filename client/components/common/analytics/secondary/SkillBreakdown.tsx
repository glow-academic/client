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
import { cn } from "@/lib/utils";
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

type ColorTheme =
  | "blue"
  | "green"
  | "purple"
  | "orange"
  | "teal"
  | "red"
  | "emerald"
  | "indigo";
type Layout = "vertical" | "horizontal";

interface SkillBreakdownProps {
  className?: string;
  color?: ColorTheme;
  maxItems?: number;
  title?: string;
  layout?: Layout;
}

const COLOR_CONFIGS = {
  blue: {
    accent: "text-blue-600",
  },
  green: {
    accent: "text-green-600",
  },
  purple: {
    accent: "text-purple-600",
  },
  orange: {
    accent: "text-orange-600",
  },
  teal: {
    accent: "text-teal-600",
  },
  red: {
    accent: "text-red-600",
  },
  emerald: {
    accent: "text-emerald-600",
  },
  indigo: {
    accent: "text-indigo-600",
  },
};

export default function SkillBreakdown({
  className,
  color = "blue",
  maxItems = 4,
  title = "Skill Breakdown",
  layout = "vertical",
}: SkillBreakdownProps) {
  const colorConfig = COLOR_CONFIGS[color];

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
      .slice(0, maxItems)
      .map(([shortName, score], index) => ({
        shortName,
        score,
        icon: [Target, Brain, Eye, Zap][index] || Target,
      }));
  }, [standardGroups, standards, feedbacks, rubrics, maxItems]);

  if (!skillCategories.length) {
    return (
      <Card className={cn("w-full h-full flex flex-col", className)}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5" />
            {title}
          </CardTitle>
          <CardDescription>Top performing competencies</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center flex-1">
          <p className="text-muted-foreground">
            No skill breakdown data available
          </p>
        </CardContent>
      </Card>
    );
  }

  const containerClasses =
    layout === "horizontal"
      ? "grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 overflow-y-auto"
      : "space-y-6 flex-1 overflow-y-auto";

  const itemClasses = layout === "horizontal" ? "space-y-6" : "space-y-4";

  return (
    <Card className={cn("w-full h-full flex flex-col", className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GraduationCap className="h-5 w-5" />
          {title}
        </CardTitle>
        <CardDescription>Top performing competencies</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden">
        <div className={containerClasses}>
          {skillCategories.map((skill) => (
            <div key={skill.shortName} className={itemClasses}>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <skill.icon className={`h-4 w-4 ${colorConfig.accent}`} />
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
