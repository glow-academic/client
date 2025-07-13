/**
 * TrainingInsights.tsx
 * This is used to show the insights of the training, powered by AI.
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
import { cn } from "@/lib/utils";
import { getAllProfiles } from "@/utils/queries/profiles/get-all-profiles";
import { getAllRubrics } from "@/utils/queries/rubrics/get-all-rubrics";
import { getSimulationAttemptsByProfiles } from "@/utils/queries/simulation_attempts/get-simulation-attempts-by-profiles";
import { getSimulationChatGradesBySimulationChats } from "@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulationchats";
import { getSimulationChatsByAttempts } from "@/utils/queries/simulation_chats/get-simulation-chats-by-attempts";
import { getAllSimulations } from "@/utils/queries/simulations/get-all-simulations";
import { useQuery } from "@tanstack/react-query";
import { subDays } from "date-fns";
import { Award, Clock, MessageSquare, Target, TrendingUp } from "lucide-react";
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

export interface TrainingInsightsProps {
  className?: string;
  color?: ColorTheme;
  maxItems?: number;
  title?: string;
  layout?: Layout;
}

const COLOR_CONFIGS = {
  blue: {
    weeklyTrend: {
      bg: "bg-blue-50 dark:bg-blue-950",
      border: "border-blue-200 dark:border-blue-800",
      icon: "text-blue-600",
      title: "text-blue-800 dark:text-blue-200",
      text: "text-blue-700 dark:text-blue-300",
    },
    sessionEfficiency: {
      bg: "bg-blue-100 dark:bg-blue-900",
      border: "border-blue-300 dark:border-blue-700",
      icon: "text-blue-700",
      title: "text-blue-900 dark:text-blue-100",
      text: "text-blue-800 dark:text-blue-200",
    },
    successRate: {
      bg: "bg-blue-200 dark:bg-blue-800",
      border: "border-blue-400 dark:border-blue-600",
      icon: "text-blue-800",
      title: "text-blue-900 dark:text-blue-100",
      text: "text-blue-800 dark:text-blue-200",
    },
    overallPerformance: {
      bg: "bg-blue-300 dark:bg-blue-700",
      border: "border-blue-500 dark:border-blue-500",
      icon: "text-blue-900",
      title: "text-blue-900 dark:text-blue-100",
      text: "text-blue-800 dark:text-blue-200",
    },
  },
  green: {
    weeklyTrend: {
      bg: "bg-green-50 dark:bg-green-950",
      border: "border-green-200 dark:border-green-800",
      icon: "text-green-600",
      title: "text-green-800 dark:text-green-200",
      text: "text-green-700 dark:text-green-300",
    },
    sessionEfficiency: {
      bg: "bg-green-100 dark:bg-green-900",
      border: "border-green-300 dark:border-green-700",
      icon: "text-green-700",
      title: "text-green-900 dark:text-green-100",
      text: "text-green-800 dark:text-green-200",
    },
    successRate: {
      bg: "bg-green-200 dark:bg-green-800",
      border: "border-green-400 dark:border-green-600",
      icon: "text-green-800",
      title: "text-green-900 dark:text-green-100",
      text: "text-green-800 dark:text-green-200",
    },
    overallPerformance: {
      bg: "bg-green-300 dark:bg-green-700",
      border: "border-green-500 dark:border-green-500",
      icon: "text-green-900",
      title: "text-green-900 dark:text-green-100",
      text: "text-green-800 dark:text-green-200",
    },
  },
  purple: {
    weeklyTrend: {
      bg: "bg-purple-50 dark:bg-purple-950",
      border: "border-purple-200 dark:border-purple-800",
      icon: "text-purple-600",
      title: "text-purple-800 dark:text-purple-200",
      text: "text-purple-700 dark:text-purple-300",
    },
    sessionEfficiency: {
      bg: "bg-purple-100 dark:bg-purple-900",
      border: "border-purple-300 dark:border-purple-700",
      icon: "text-purple-700",
      title: "text-purple-900 dark:text-purple-100",
      text: "text-purple-800 dark:text-purple-200",
    },
    successRate: {
      bg: "bg-purple-200 dark:bg-purple-800",
      border: "border-purple-400 dark:border-purple-600",
      icon: "text-purple-800",
      title: "text-purple-900 dark:text-purple-100",
      text: "text-purple-800 dark:text-purple-200",
    },
    overallPerformance: {
      bg: "bg-purple-300 dark:bg-purple-700",
      border: "border-purple-500 dark:border-purple-500",
      icon: "text-purple-900",
      title: "text-purple-900 dark:text-purple-100",
      text: "text-purple-800 dark:text-purple-200",
    },
  },
  orange: {
    weeklyTrend: {
      bg: "bg-orange-50 dark:bg-orange-950",
      border: "border-orange-200 dark:border-orange-800",
      icon: "text-orange-600",
      title: "text-orange-800 dark:text-orange-200",
      text: "text-orange-700 dark:text-orange-300",
    },
    sessionEfficiency: {
      bg: "bg-orange-100 dark:bg-orange-900",
      border: "border-orange-300 dark:border-orange-700",
      icon: "text-orange-700",
      title: "text-orange-900 dark:text-orange-100",
      text: "text-orange-800 dark:text-orange-200",
    },
    successRate: {
      bg: "bg-orange-200 dark:bg-orange-800",
      border: "border-orange-400 dark:border-orange-600",
      icon: "text-orange-800",
      title: "text-orange-900 dark:text-orange-100",
      text: "text-orange-800 dark:text-orange-200",
    },
    overallPerformance: {
      bg: "bg-orange-300 dark:bg-orange-700",
      border: "border-orange-500 dark:border-orange-500",
      icon: "text-orange-900",
      title: "text-orange-900 dark:text-orange-100",
      text: "text-orange-800 dark:text-orange-200",
    },
  },
  teal: {
    weeklyTrend: {
      bg: "bg-teal-50 dark:bg-teal-950",
      border: "border-teal-200 dark:border-teal-800",
      icon: "text-teal-600",
      title: "text-teal-800 dark:text-teal-200",
      text: "text-teal-700 dark:text-teal-300",
    },
    sessionEfficiency: {
      bg: "bg-teal-100 dark:bg-teal-900",
      border: "border-teal-300 dark:border-teal-700",
      icon: "text-teal-700",
      title: "text-teal-900 dark:text-teal-100",
      text: "text-teal-800 dark:text-teal-200",
    },
    successRate: {
      bg: "bg-teal-200 dark:bg-teal-800",
      border: "border-teal-400 dark:border-teal-600",
      icon: "text-teal-800",
      title: "text-teal-900 dark:text-teal-100",
      text: "text-teal-800 dark:text-teal-200",
    },
    overallPerformance: {
      bg: "bg-teal-300 dark:bg-teal-700",
      border: "border-teal-500 dark:border-teal-500",
      icon: "text-teal-900",
      title: "text-teal-900 dark:text-teal-100",
      text: "text-teal-800 dark:text-teal-200",
    },
  },
  red: {
    weeklyTrend: {
      bg: "bg-red-50 dark:bg-red-950",
      border: "border-red-200 dark:border-red-800",
      icon: "text-red-600",
      title: "text-red-800 dark:text-red-200",
      text: "text-red-700 dark:text-red-300",
    },
    sessionEfficiency: {
      bg: "bg-red-100 dark:bg-red-900",
      border: "border-red-300 dark:border-red-700",
      icon: "text-red-700",
      title: "text-red-900 dark:text-red-100",
      text: "text-red-800 dark:text-red-200",
    },
    successRate: {
      bg: "bg-red-200 dark:bg-red-800",
      border: "border-red-400 dark:border-red-600",
      icon: "text-red-800",
      title: "text-red-900 dark:text-red-100",
      text: "text-red-800 dark:text-red-200",
    },
    overallPerformance: {
      bg: "bg-red-300 dark:bg-red-700",
      border: "border-red-500 dark:border-red-500",
      icon: "text-red-900",
      title: "text-red-900 dark:text-red-100",
      text: "text-red-800 dark:text-red-200",
    },
  },
  emerald: {
    weeklyTrend: {
      bg: "bg-emerald-50 dark:bg-emerald-950",
      border: "border-emerald-200 dark:border-emerald-800",
      icon: "text-emerald-600",
      title: "text-emerald-800 dark:text-emerald-200",
      text: "text-emerald-700 dark:text-emerald-300",
    },
    sessionEfficiency: {
      bg: "bg-emerald-100 dark:bg-emerald-900",
      border: "border-emerald-300 dark:border-emerald-700",
      icon: "text-emerald-700",
      title: "text-emerald-900 dark:text-emerald-100",
      text: "text-emerald-800 dark:text-emerald-200",
    },
    successRate: {
      bg: "bg-emerald-200 dark:bg-emerald-800",
      border: "border-emerald-400 dark:border-emerald-600",
      icon: "text-emerald-800",
      title: "text-emerald-900 dark:text-emerald-100",
      text: "text-emerald-800 dark:text-emerald-200",
    },
    overallPerformance: {
      bg: "bg-emerald-300 dark:bg-emerald-700",
      border: "border-emerald-500 dark:border-emerald-500",
      icon: "text-emerald-900",
      title: "text-emerald-900 dark:text-emerald-100",
      text: "text-emerald-800 dark:text-emerald-200",
    },
  },
  indigo: {
    weeklyTrend: {
      bg: "bg-indigo-50 dark:bg-indigo-950",
      border: "border-indigo-200 dark:border-indigo-800",
      icon: "text-indigo-600",
      title: "text-indigo-800 dark:text-indigo-200",
      text: "text-indigo-700 dark:text-indigo-300",
    },
    sessionEfficiency: {
      bg: "bg-indigo-100 dark:bg-indigo-900",
      border: "border-indigo-300 dark:border-indigo-700",
      icon: "text-indigo-700",
      title: "text-indigo-900 dark:text-indigo-100",
      text: "text-indigo-800 dark:text-indigo-200",
    },
    successRate: {
      bg: "bg-indigo-200 dark:bg-indigo-800",
      border: "border-indigo-400 dark:border-indigo-600",
      icon: "text-indigo-800",
      title: "text-indigo-900 dark:text-indigo-100",
      text: "text-indigo-800 dark:text-indigo-200",
    },
    overallPerformance: {
      bg: "bg-indigo-300 dark:bg-indigo-700",
      border: "border-indigo-500 dark:border-indigo-500",
      icon: "text-indigo-900",
      title: "text-indigo-900 dark:text-indigo-100",
      text: "text-indigo-800 dark:text-indigo-200",
    },
  },
};

export default function TrainingInsights({
  className,
  color = "blue",
  maxItems = 4,
  title = "Training Insights",
  layout: _layout = "vertical",
}: TrainingInsightsProps) {
  const colorConfig = COLOR_CONFIGS[color];

  // Fetch data
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

  const { data: grades } = useQuery({
    queryKey: ["simulationGrades", chats?.map((chat) => chat.id)],
    queryFn: () =>
      getSimulationChatGradesBySimulationChats(chats!.map((chat) => chat.id)),
    enabled: !!chats && chats.length > 0,
  });

  const { data: simulations } = useQuery({
    queryKey: ["simulations"],
    queryFn: () => getAllSimulations(),
  });

  const { data: rubrics } = useQuery({
    queryKey: ["rubrics"],
    queryFn: () => getAllRubrics(),
  });

  // Calculate insights
  const insights = useMemo(() => {
    if (!grades || !profiles || !chats || !attempts || !simulations || !rubrics)
      return null;

    // Calculate dynamic metrics for training insights
    const currentWeekGrades = grades.filter((grade) => {
      const gradeDate = new Date(grade.createdAt);
      const weekAgo = subDays(new Date(), 7);
      return gradeDate >= weekAgo;
    });

    const lastWeekGrades = grades.filter((grade) => {
      const gradeDate = new Date(grade.createdAt);
      const twoWeeksAgo = subDays(new Date(), 14);
      const weekAgo = subDays(new Date(), 7);
      return gradeDate >= twoWeeksAgo && gradeDate < weekAgo;
    });

    // Calculate current week average using rubric points
    let currentWeekAvg = 0;
    if (currentWeekGrades.length > 0) {
      const currentWeekSum = currentWeekGrades.reduce((sum, grade) => {
        const chat = chats.find((c) => c.id === grade.simulationChatId);
        const attempt = attempts.find((a) => a.id === chat?.attemptId);
        const simulation = simulations.find(
          (s) => s.id === attempt?.simulationId
        );
        const rubric = rubrics.find((r) => r.id === simulation?.rubricId);
        const rubricTotalPoints = rubric?.points || 100;
        const scorePercent = Math.round(
          (grade.score / rubricTotalPoints) * 100
        );
        return sum + scorePercent;
      }, 0);
      currentWeekAvg = Math.round(currentWeekSum / currentWeekGrades.length);
    }

    // Calculate last week average using rubric points
    let lastWeekAvg = 0;
    if (lastWeekGrades.length > 0) {
      const lastWeekSum = lastWeekGrades.reduce((sum, grade) => {
        const chat = chats.find((c) => c.id === grade.simulationChatId);
        const attempt = attempts.find((a) => a.id === chat?.attemptId);
        const simulation = simulations.find(
          (s) => s.id === attempt?.simulationId
        );
        const rubric = rubrics.find((r) => r.id === simulation?.rubricId);
        const rubricTotalPoints = rubric?.points || 100;
        const scorePercent = Math.round(
          (grade.score / rubricTotalPoints) * 100
        );
        return sum + scorePercent;
      }, 0);
      lastWeekAvg = Math.round(lastWeekSum / lastWeekGrades.length);
    }

    const weeklyTrend = currentWeekAvg - lastWeekAvg;
    const passRate =
      grades.length > 0
        ? Math.round(
            (grades.filter((g) => g.passed).length / grades.length) * 100
          )
        : 0;

    // Calculate average training time from grades (convert seconds to minutes)
    const avgTrainingTime =
      grades.length > 0
        ? Math.round(
            grades.reduce((sum, g) => sum + g.timeTaken, 0) / grades.length / 60
          )
        : 45;

    // Calculate overall average score from grades using rubric points
    let avgOverallScore = 0;
    if (grades.length > 0) {
      const totalScoreSum = grades.reduce((sum, grade) => {
        const chat = chats.find((c) => c.id === grade.simulationChatId);
        const attempt = attempts.find((a) => a.id === chat?.attemptId);
        const simulation = simulations.find(
          (s) => s.id === attempt?.simulationId
        );
        const rubric = rubrics.find((r) => r.id === simulation?.rubricId);
        const rubricTotalPoints = rubric?.points || 100;
        const scorePercent = Math.round(
          (grade.score / rubricTotalPoints) * 100
        );
        return sum + scorePercent;
      }, 0);
      avgOverallScore = Math.round(totalScoreSum / grades.length);
    }

    return {
      weeklyTrend,
      avgTrainingTime,
      passRate,
      avgOverallScore,
    };
  }, [grades, profiles, chats, attempts, simulations, rubrics]);

  if (!insights) {
    return (
      <Card className={cn("w-full h-full flex flex-col", className)}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            {title}
          </CardTitle>
          <CardDescription>AI-powered recommendations</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center flex-1">
          <p className="text-muted-foreground">Loading training insights...</p>
        </CardContent>
      </Card>
    );
  }

  // Create insights array and limit by maxItems
  const insightItems = [
    {
      key: "weeklyTrend",
      icon: TrendingUp,
      title: "Weekly Trend",
      text:
        insights.weeklyTrend > 0
          ? `Scores improved by ${insights.weeklyTrend}% this week`
          : insights.weeklyTrend < 0
            ? `Scores decreased by ${Math.abs(insights.weeklyTrend)}% this week`
            : "Scores remained stable this week",
      config: colorConfig.weeklyTrend,
    },
    {
      key: "sessionEfficiency",
      icon: Clock,
      title: "Session Efficiency",
      text: `Average session time: ${insights.avgTrainingTime} minutes`,
      config: colorConfig.sessionEfficiency,
    },
    {
      key: "successRate",
      icon: Award,
      title: "Success Rate",
      text: `${insights.passRate}% of sessions meet passing criteria`,
      config: colorConfig.successRate,
    },
    {
      key: "overallPerformance",
      icon: MessageSquare,
      title: "Overall Performance",
      text: `Average score across all sessions: ${insights.avgOverallScore}%`,
      config: colorConfig.overallPerformance,
    },
  ].slice(0, maxItems);

  return (
    <Card className={cn("w-full h-full flex flex-col", className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5" />
          {title}
        </CardTitle>
        <CardDescription>AI-powered recommendations</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto">
        <div className="space-y-3">
          {insightItems.map((item) => (
            <div
              key={item.key}
              className={`p-3 ${item.config.bg} border ${item.config.border} rounded-lg`}
            >
              <div className="flex items-start gap-2">
                <item.icon className={`h-4 w-4 ${item.config.icon} mt-0.5`} />
                <div>
                  <div className={`text-sm font-medium ${item.config.title}`}>
                    {item.title}
                  </div>
                  <div className={`text-xs ${item.config.text} mt-1`}>
                    {item.text}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
