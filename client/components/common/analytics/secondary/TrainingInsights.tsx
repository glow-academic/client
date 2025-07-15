/**
 * TrainingInsights.tsx
 * This is used to show the insights of the training, powered by AI.
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
import { getSimulationChatGradesBySimulationChats } from "@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulationchats";
import { getSimulationChatsByAttempts } from "@/utils/queries/simulation_chats/get-simulation-chats-by-attempts";
import { getAllSimulations } from "@/utils/queries/simulations/get-all-simulations";
import { useQuery } from "@tanstack/react-query";
import { format, subDays } from "date-fns";
import {
  Award,
  BarChart3,
  Clock,
  Info,
  MessageSquare,
  Target,
  TrendingUp,
  Users,
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

interface InsightDetail {
  key: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  text: string;
  value: number;
  config: {
    bg: string;
    border: string;
    icon: string;
    title: string;
    text: string;
  };
  historicalData: Array<{
    date: string;
    value: number;
    label: string;
  }>;
  recommendations: string[];
  trend: number;
  status: "improving" | "declining" | "stable";
}

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

  // Calculate insights with detailed metrics
  const insights = useMemo(() => {
    if (!grades || !profiles || !chats || !attempts || !simulations || !rubrics)
      return null;

    // Helper function to calculate weekly data
    const getWeeklyData = (weeksBack: number) => {
      const weekStart = subDays(new Date(), weeksBack * 7);
      const weekEnd = subDays(new Date(), (weeksBack - 1) * 7);
      return grades.filter((grade) => {
        const gradeDate = new Date(grade.createdAt);
        return gradeDate >= weekStart && gradeDate < weekEnd;
      });
    };

    // Calculate historical data for the last 8 weeks
    const historicalWeeks = Array.from({ length: 8 }, (_, i) => {
      const weekGrades = getWeeklyData(i + 1);
      const weekScores = weekGrades.map((grade) => {
        const chat = chats.find((c) => c.id === grade.simulationChatId);
        const attempt = attempts.find((a) => a.id === chat?.attemptId);
        const simulation = simulations.find(
          (s) => s.id === attempt?.simulationId
        );
        const rubric = rubrics.find((r) => r.id === simulation?.rubricId);
        const rubricTotalPoints = rubric?.points || 100;
        return Math.round((grade.score / rubricTotalPoints) * 100);
      });

      const avgScore =
        weekScores.length > 0
          ? Math.round(
              weekScores.reduce((sum, score) => sum + score, 0) /
                weekScores.length
            )
          : 0;

      const avgTime =
        weekGrades.length > 0
          ? Math.round(
              weekGrades.reduce((sum, g) => sum + g.timeTaken, 0) /
                weekGrades.length /
                60
            )
          : 0;

      const passRate =
        weekGrades.length > 0
          ? Math.round(
              (weekGrades.filter((g) => g.passed).length / weekGrades.length) *
                100
            )
          : 0;

      return {
        week: i + 1,
        date: format(subDays(new Date(), i * 7), "MMM dd"),
        avgScore,
        avgTime,
        passRate,
        sessions: weekGrades.length,
      };
    }).reverse();

    // Calculate current metrics
    const currentWeekGrades = getWeeklyData(1);
    const lastWeekGrades = getWeeklyData(2);

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

    // Create detailed insight items
    const insightItems: InsightDetail[] = [
      {
        key: "weeklyTrend",
        icon: TrendingUp,
        title: "Weekly Trend",
        text:
          weeklyTrend > 0
            ? `Scores improved by ${weeklyTrend}% this week`
            : weeklyTrend < 0
              ? `Scores decreased by ${Math.abs(weeklyTrend)}% this week`
              : "Scores remained stable this week",
        value: weeklyTrend,
        config: colorConfig.weeklyTrend,
        historicalData: historicalWeeks.map((week) => ({
          date: week.date,
          value: week.avgScore,
          label: `Week ${week.week}: ${week.avgScore}%`,
        })),
        recommendations: [
          ...(weeklyTrend < -5
            ? [
                "Investigate recent performance decline",
                "Consider additional training sessions",
              ]
            : []),
          ...(weeklyTrend > 5
            ? [
                "Maintain current training approach",
                "Consider advanced scenarios",
              ]
            : []),
          ...(weeklyTrend === 0
            ? ["Monitor for consistency", "Look for improvement opportunities"]
            : []),
        ],
        trend: weeklyTrend,
        status:
          weeklyTrend > 2
            ? "improving"
            : weeklyTrend < -2
              ? "declining"
              : "stable",
      },
      {
        key: "sessionEfficiency",
        icon: Clock,
        title: "Session Efficiency",
        text: `Average session time: ${avgTrainingTime} minutes`,
        value: avgTrainingTime,
        config: colorConfig.sessionEfficiency,
        historicalData: historicalWeeks.map((week) => ({
          date: week.date,
          value: week.avgTime,
          label: `Week ${week.week}: ${week.avgTime}m`,
        })),
        recommendations: [
          ...(avgTrainingTime > 45
            ? [
                "Consider time management strategies",
                "Review session complexity",
              ]
            : []),
          ...(avgTrainingTime < 20
            ? [
                "Ensure adequate depth in training",
                "Consider more complex scenarios",
              ]
            : []),
          ...(avgTrainingTime >= 20 && avgTrainingTime <= 45
            ? ["Optimal session duration", "Maintain current pacing"]
            : []),
        ],
        trend:
          historicalWeeks.length > 1
            ? (historicalWeeks[historicalWeeks.length - 1]?.avgTime || 0) -
              (historicalWeeks[historicalWeeks.length - 2]?.avgTime || 0)
            : 0,
        status:
          avgTrainingTime > 45
            ? "declining"
            : avgTrainingTime < 30
              ? "improving"
              : "stable",
      },
      {
        key: "successRate",
        icon: Award,
        title: "Success Rate",
        text: `${passRate}% of sessions meet passing criteria`,
        value: passRate,
        config: colorConfig.successRate,
        historicalData: historicalWeeks.map((week) => ({
          date: week.date,
          value: week.passRate,
          label: `Week ${week.week}: ${week.passRate}%`,
        })),
        recommendations: [
          ...(passRate < 70
            ? ["Review failing scenarios", "Provide additional support"]
            : []),
          ...(passRate >= 70 && passRate < 85
            ? ["Identify improvement opportunities", "Focus on consistency"]
            : []),
          ...(passRate >= 85
            ? ["Excellent performance", "Consider advanced challenges"]
            : []),
        ],
        trend:
          historicalWeeks.length > 1
            ? (historicalWeeks[historicalWeeks.length - 1]?.passRate || 0) -
              (historicalWeeks[historicalWeeks.length - 2]?.passRate || 0)
            : 0,
        status:
          passRate >= 85 ? "improving" : passRate < 70 ? "declining" : "stable",
      },
      {
        key: "overallPerformance",
        icon: MessageSquare,
        title: "Overall Performance",
        text: `Average score across all sessions: ${avgOverallScore}%`,
        value: avgOverallScore,
        config: colorConfig.overallPerformance,
        historicalData: historicalWeeks.map((week) => ({
          date: week.date,
          value: week.avgScore,
          label: `Week ${week.week}: ${week.avgScore}%`,
        })),
        recommendations: [
          ...(avgOverallScore < 70
            ? ["Focus on foundational skills", "Increase practice frequency"]
            : []),
          ...(avgOverallScore >= 70 && avgOverallScore < 85
            ? ["Target specific weak areas", "Maintain consistent training"]
            : []),
          ...(avgOverallScore >= 85
            ? ["Outstanding performance", "Ready for advanced scenarios"]
            : []),
        ],
        trend:
          historicalWeeks.length > 1
            ? (historicalWeeks[historicalWeeks.length - 1]?.avgScore || 0) -
              (historicalWeeks[historicalWeeks.length - 2]?.avgScore || 0)
            : 0,
        status:
          avgOverallScore >= 85
            ? "improving"
            : avgOverallScore < 70
              ? "declining"
              : "stable",
      },
    ];

    return {
      weeklyTrend,
      avgTrainingTime,
      passRate,
      avgOverallScore,
      insightItems,
      historicalWeeks,
    };
  }, [grades, profiles, chats, attempts, simulations, rubrics, colorConfig]);

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
  const insightItems = insights?.insightItems?.slice(0, maxItems) || [];

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
            <Dialog key={item.key}>
              <DialogTrigger asChild>
                <div
                  className={`p-3 ${item.config.bg} border ${item.config.border} rounded-lg cursor-pointer hover:opacity-90 transition-opacity`}
                >
                  <div className="flex items-start gap-2">
                    <item.icon
                      className={`h-4 w-4 ${item.config.icon} mt-0.5`}
                    />
                    <div className="flex-1">
                      <div
                        className={`text-sm font-medium ${item.config.title} flex items-center gap-2`}
                      >
                        {item.title}
                        <Info className="h-3 w-3 text-muted-foreground" />
                      </div>
                      <div className={`text-xs ${item.config.text} mt-1`}>
                        {item.text}
                      </div>
                    </div>
                  </div>
                </div>
              </DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <item.icon className={`h-5 w-5 ${item.config.icon}`} />
                    {item.title} Analysis
                  </DialogTitle>
                  <DialogDescription>
                    Detailed insights and recommendations for{" "}
                    {item.title.toLowerCase()}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-6">
                  {/* Current Status */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="text-center p-4 bg-muted rounded-lg">
                      <div className="text-3xl font-bold text-primary">
                        {item.value}
                        {item.key === "weeklyTrend"
                          ? "%"
                          : item.key === "sessionEfficiency"
                            ? "m"
                            : "%"}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Current Value
                      </div>
                    </div>
                    <div className="text-center p-4 bg-muted rounded-lg">
                      <div
                        className={`text-3xl font-bold ${item.trend >= 0 ? "text-green-600" : "text-red-600"}`}
                      >
                        {item.trend >= 0 ? "+" : ""}
                        {item.trend}
                        {item.key === "sessionEfficiency" ? "m" : "%"}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Weekly Change
                      </div>
                    </div>
                    <div className="text-center p-4 bg-muted rounded-lg">
                      <Badge
                        variant={
                          item.status === "improving"
                            ? "default"
                            : item.status === "declining"
                              ? "destructive"
                              : "secondary"
                        }
                        className="text-sm"
                      >
                        {item.status === "improving"
                          ? "Improving"
                          : item.status === "declining"
                            ? "Declining"
                            : "Stable"}
                      </Badge>
                      <div className="text-sm text-muted-foreground mt-2">
                        Status
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Historical Trend */}
                  <div>
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <BarChart3 className="h-4 w-4" />
                      8-Week Historical Trend
                    </h4>
                    <div className="space-y-2">
                      {item.historicalData.map((dataPoint, index) => (
                        <div key={index} className="flex items-center gap-3">
                          <div className="w-16 text-sm text-muted-foreground">
                            {dataPoint.date}
                          </div>
                          <div className="flex-1">
                            <Progress
                              value={
                                item.key === "sessionEfficiency"
                                  ? Math.min((dataPoint.value / 60) * 100, 100)
                                  : dataPoint.value
                              }
                              className="h-2"
                            />
                          </div>
                          <div className="w-16 text-sm text-right">
                            {dataPoint.value}
                            {item.key === "sessionEfficiency" ? "m" : "%"}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  {/* Key Insights */}
                  <div>
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <Target className="h-4 w-4" />
                      Key Insights
                    </h4>
                    <div className="text-sm text-muted-foreground space-y-2">
                      <div className="p-3 bg-muted rounded-lg">
                        <strong>Performance Pattern:</strong> {item.text}
                      </div>
                      <div className="p-3 bg-muted rounded-lg">
                        <strong>Trend Analysis:</strong>{" "}
                        {item.trend > 0
                          ? "Positive"
                          : item.trend < 0
                            ? "Negative"
                            : "Neutral"}{" "}
                        trend over the past week
                      </div>
                      <div className="p-3 bg-muted rounded-lg">
                        <strong>Historical Context:</strong> Based on{" "}
                        {item.historicalData.length} weeks of data
                      </div>
                    </div>
                  </div>

                  {/* Recommendations */}
                  <div>
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" />
                      Recommendations
                    </h4>
                    <div className="text-sm text-muted-foreground space-y-1">
                      {item.recommendations.length > 0 ? (
                        item.recommendations.map((rec, index) => (
                          <p key={index}>• {rec}</p>
                        ))
                      ) : (
                        <p>
                          • Continue current approach - performance is within
                          expected range
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Action Items */}
                  <div>
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Suggested Actions
                    </h4>
                    <div className="text-sm text-muted-foreground space-y-1">
                      {item.status === "declining" && (
                        <>
                          <p>• Schedule review meeting with training team</p>
                          <p>• Analyze recent session data for patterns</p>
                          <p>• Consider adjusting training methodology</p>
                        </>
                      )}
                      {item.status === "improving" && (
                        <>
                          <p>• Document successful practices for replication</p>
                          <p>• Consider expanding current training approach</p>
                          <p>• Prepare for next level challenges</p>
                        </>
                      )}
                      {item.status === "stable" && (
                        <>
                          <p>• Monitor for consistency over time</p>
                          <p>• Look for optimization opportunities</p>
                          <p>• Maintain current training standards</p>
                        </>
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
