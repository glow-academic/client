/**
 * SkillBreakdown.tsx
 * This is used to show the progress bars of the skill breakdown.
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
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
import {
  Brain,
  CheckCircle,
  Eye,
  GraduationCap,
  Info,
  Target,
  TrendingUp,
  Zap,
} from "lucide-react";
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

interface StandardDetail {
  id: string;
  name: string;
  description: string;
  avgScore: number;
  totalFeedbacks: number;
  recentScores: number[];
  trend: number;
}

interface SkillCategory {
  shortName: string;
  fullName: string;
  score: number;
  icon: React.ComponentType<{ className?: string }>;
  standards: StandardDetail[];
  totalFeedbacks: number;
  passRate: number;
  improvement: number;
}

export interface SkillBreakdownProps {
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

  // Calculate skill categories with detailed metrics
  const skillCategories = useMemo((): SkillCategory[] => {
    if (!standardGroups || !standards || !feedbacks || !rubrics) return [];

    const skillData = standardGroups.map((group, index) => {
      const groupStandards = standards.filter(
        (s) => s.standardGroupId === group.id
      );
      const groupFeedbacks = feedbacks.filter((f) =>
        groupStandards.some((s) => s.id === f.standardId)
      );

      // Calculate detailed metrics for each standard
      const standardDetails: StandardDetail[] = groupStandards.map(
        (standard) => {
          const standardFeedbacks = feedbacks.filter(
            (f) => f.standardId === standard.id
          );
          const avgScore =
            standardFeedbacks.length > 0
              ? standardFeedbacks.reduce((sum, f) => sum + f.total, 0) /
                standardFeedbacks.length
              : 0;

          // Get recent scores for trend calculation (last 10 feedbacks)
          const recentScores = standardFeedbacks
            .sort(
              (a, b) =>
                new Date(b.createdAt).getTime() -
                new Date(a.createdAt).getTime()
            )
            .slice(0, 10)
            .map((f) => f.total);

          // Calculate trend (recent vs older scores)
          const recentAvg =
            recentScores.length > 0
              ? recentScores.reduce((sum, score) => sum + score, 0) /
                recentScores.length
              : avgScore;
          const olderScores = standardFeedbacks
            .sort(
              (a, b) =>
                new Date(b.createdAt).getTime() -
                new Date(a.createdAt).getTime()
            )
            .slice(10, 20)
            .map((f) => f.total);
          const olderAvg =
            olderScores.length > 0
              ? olderScores.reduce((sum, score) => sum + score, 0) /
                olderScores.length
              : avgScore;
          const trend = recentAvg - olderAvg;

          return {
            id: standard.id,
            name: standard.name,
            description: standard.description || "No description available",
            avgScore: Math.round(avgScore * 10) / 10,
            totalFeedbacks: standardFeedbacks.length,
            recentScores,
            trend: Math.round(trend * 10) / 10,
          };
        }
      );

      // Calculate group-level metrics
      const avgScore =
        groupFeedbacks.length > 0
          ? groupFeedbacks.reduce((sum, f) => sum + f.total, 0) /
            groupFeedbacks.length
          : 0;

      const passRate =
        groupFeedbacks.length > 0
          ? Math.round(
              (groupFeedbacks.filter((f) => f.total >= 3).length /
                groupFeedbacks.length) *
                100
            )
          : 0;

      // Calculate improvement over time
      const recentFeedbacks = groupFeedbacks
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
        .slice(0, Math.floor(groupFeedbacks.length / 2));
      const olderFeedbacks = groupFeedbacks
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
        .slice(Math.floor(groupFeedbacks.length / 2));

      const recentAvg =
        recentFeedbacks.length > 0
          ? recentFeedbacks.reduce((sum, f) => sum + f.total, 0) /
            recentFeedbacks.length
          : avgScore;
      const olderAvg =
        olderFeedbacks.length > 0
          ? olderFeedbacks.reduce((sum, f) => sum + f.total, 0) /
            olderFeedbacks.length
          : avgScore;
      const improvement = Math.round((recentAvg - olderAvg) * 10) / 10;

      return {
        shortName: group.shortName || group.name,
        fullName: group.name,
        score: Math.round(avgScore * 10) / 10,
        icon: [Target, Brain, Eye, Zap][index] || Target,
        standards: standardDetails,
        totalFeedbacks: groupFeedbacks.length,
        passRate,
        improvement,
      };
    });

    // Get top skill categories for display
    return skillData
      .filter((skill) => skill.totalFeedbacks > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxItems);
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
            <Dialog key={skill.shortName}>
              <DialogTrigger asChild>
                <div
                  className={`${itemClasses} cursor-pointer hover:bg-muted/50 p-3 rounded-lg transition-colors`}
                >
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <skill.icon className={`h-4 w-4 ${colorConfig.accent}`} />
                      <span className="font-medium">{skill.shortName}</span>
                      <Info className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <span className="font-bold text-lg">{skill.score}/5</span>
                  </div>
                  <Progress value={(skill.score / 5) * 100} className="h-2" />
                </div>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <skill.icon className={`h-5 w-5 ${colorConfig.accent}`} />
                    {skill.fullName}
                  </DialogTitle>
                  <DialogDescription>
                    Detailed breakdown of {skill.shortName} competency
                    performance
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-6">
                  {/* Key Metrics */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-3 bg-muted rounded-lg">
                      <div className="text-2xl font-bold text-primary">
                        {skill.score}/5
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Average Score
                      </div>
                    </div>
                    <div className="text-center p-3 bg-muted rounded-lg">
                      <div className="text-2xl font-bold text-primary">
                        {skill.totalFeedbacks}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Total Assessments
                      </div>
                    </div>
                    <div className="text-center p-3 bg-muted rounded-lg">
                      <div className="text-2xl font-bold text-primary">
                        {skill.passRate}%
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Pass Rate
                      </div>
                    </div>
                    <div className="text-center p-3 bg-muted rounded-lg">
                      <div
                        className={`text-2xl font-bold ${skill.improvement >= 0 ? "text-green-600" : "text-red-600"}`}
                      >
                        {skill.improvement >= 0 ? "+" : ""}
                        {skill.improvement}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Improvement
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Individual Standards */}
                  <div>
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <CheckCircle className="h-4 w-4" />
                      Individual Standards
                    </h4>
                    <div className="space-y-3">
                      {skill.standards.map((standard) => (
                        <div
                          key={standard.id}
                          className="p-4 bg-muted rounded-lg"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <div className="font-medium text-sm">
                                {standard.name}
                              </div>
                              <div className="text-xs text-muted-foreground mt-1">
                                {standard.description}
                              </div>
                            </div>
                            <div className="text-right ml-4">
                              <div className="text-lg font-bold">
                                {standard.avgScore}/5
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {standard.totalFeedbacks} assessments
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-4 mt-3">
                            <div className="flex-1">
                              <Progress
                                value={(standard.avgScore / 5) * 100}
                                className="h-2"
                              />
                            </div>
                            <div className="flex items-center gap-1">
                              {standard.trend !== 0 && (
                                <Badge
                                  variant={
                                    standard.trend >= 0
                                      ? "default"
                                      : "destructive"
                                  }
                                  className="text-xs"
                                >
                                  {standard.trend >= 0 ? "+" : ""}
                                  {standard.trend}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  {/* Performance Distribution */}
                  <div>
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <Target className="h-4 w-4" />
                      Performance Distribution
                    </h4>
                    <div className="space-y-2">
                      {[
                        {
                          range: "Excellent (4.5-5.0)",
                          count: skill.standards.filter(
                            (s) => s.avgScore >= 4.5
                          ).length,
                          color: "bg-green-500",
                        },
                        {
                          range: "Good (3.5-4.4)",
                          count: skill.standards.filter(
                            (s) => s.avgScore >= 3.5 && s.avgScore < 4.5
                          ).length,
                          color: "bg-blue-500",
                        },
                        {
                          range: "Average (2.5-3.4)",
                          count: skill.standards.filter(
                            (s) => s.avgScore >= 2.5 && s.avgScore < 3.5
                          ).length,
                          color: "bg-yellow-500",
                        },
                        {
                          range: "Below Average (1.5-2.4)",
                          count: skill.standards.filter(
                            (s) => s.avgScore >= 1.5 && s.avgScore < 2.5
                          ).length,
                          color: "bg-orange-500",
                        },
                        {
                          range: "Poor (0-1.4)",
                          count: skill.standards.filter((s) => s.avgScore < 1.5)
                            .length,
                          color: "bg-red-500",
                        },
                      ].map((item) => (
                        <div
                          key={item.range}
                          className="flex items-center gap-3"
                        >
                          <div className="w-32 text-sm text-muted-foreground">
                            {item.range}
                          </div>
                          <div className="flex-1">
                            <Progress
                              value={
                                skill.standards.length > 0
                                  ? (item.count / skill.standards.length) * 100
                                  : 0
                              }
                              className="h-2"
                            />
                          </div>
                          <div className="w-8 text-sm text-right">
                            {item.count}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Recommendations */}
                  <div>
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" />
                      Recommendations
                    </h4>
                    <div className="text-sm text-muted-foreground space-y-1">
                      {skill.score < 3 && (
                        <p>
                          • Focus on foundational training for {skill.shortName}{" "}
                          competency
                        </p>
                      )}
                      {skill.passRate < 70 && (
                        <p>
                          • Low pass rate indicates need for additional practice
                          sessions
                        </p>
                      )}
                      {skill.improvement < 0 && (
                        <p>
                          • Recent performance decline - consider refresher
                          training
                        </p>
                      )}
                      {skill.standards.filter((s) => s.avgScore < 2.5).length >
                        0 && (
                        <p>
                          •{" "}
                          {
                            skill.standards.filter((s) => s.avgScore < 2.5)
                              .length
                          }{" "}
                          standards need immediate attention
                        </p>
                      )}
                      {skill.score >= 4 && skill.improvement >= 0 && (
                        <p>
                          • Excellent performance! Consider advanced scenarios
                          or peer mentoring
                        </p>
                      )}
                      {skill.standards.some((s) => s.trend > 0.5) && (
                        <p>
                          • Strong improvement trend - maintain current training
                          approach
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
