/**
 * Overview.tsx
 * Used to display the overview for the analytics page.
 * @AshokSaravanan222 & @siladiea
 * 06/07/2025
 */
"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Users,
  TrendingUp,
  Clock,
  Target,
  AlertTriangle,
  MessageSquare,
  Brain,
  Zap,
  Calendar,
  Eye,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import { format, subDays, subHours } from "date-fns";
import { getSimulationAttemptsByUsers } from "@/utils/queries/simulation_attempts/get-simulation-attempts-by-users";
import { getAllUsers } from "@/utils/queries/users/get-all-users";
import { getSimulationChatsByAttempts } from "@/utils/queries/simulation_chats/get-simulation-chats-by-attempts";
import { getAllAgents } from "@/utils/queries/agents/get-all-agents";
import { getSimulationChatGradesBySimulationChats } from "@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulationchats";
import { getSimulationChatFeedbacksBySimulationChatGrades } from "@/utils/queries/simulation_chat_feedbacks/get-simulation-chat-feedbacks-by-simulationchatgrades";
import { getAllRubrics } from "@/utils/queries/rubrics/get-all-rubrics";
import { getStandardGroupsByRubrics } from "@/utils/queries/standard_groups/get-standard-groups-by-rubrics";
import { getStandardsByStandardGroups } from "@/utils/queries/standards/get-standards-by-standardgroups";
import { StandardGroup } from "@/types";

// Color palette for charts
const COLORS = {
  primary: "#3b82f6",
  success: "#10b981",
  warning: "#f59e0b",
  danger: "#ef4444",
  purple: "#8b5cf6",
  pink: "#ec4899",
  teal: "#14b8a6",
  orange: "#f97316",
};

export default function Overview() {
  const [performanceTrendTimeRange, setPerformanceTrendTimeRange] = useState<"7d" | "30d" | "90d">("30d");
  const [sessionActivityTimeRange, setSessionActivityTimeRange] = useState<"1h" | "12h" | "24h">("24h");

  // Fetch data
  const { data: users, isLoading: isLoadingUsers } = useQuery({
    queryKey: ["users"],
    queryFn: () => getAllUsers(),
  });

  const { data: agents, isLoading: isLoadingAgents } = useQuery({
    queryKey: ["agents"],
    queryFn: () => getAllAgents(),
  });

  const { data: rubrics, isLoading: isLoadingRubrics } = useQuery({
    queryKey: ["rubrics"],
    queryFn: () => getAllRubrics(),
  });

  const { data: standardGroups, isLoading: isLoadingStandardGroups } = useQuery(
    {
      queryKey: ["standardGroups", rubrics?.map((rubric) => rubric.id)],
      queryFn: () =>
        getStandardGroupsByRubrics(rubrics!.map((rubric) => rubric.id)),
      enabled: !!rubrics && rubrics.length > 0,
    },
  );

  const { data: standards, isLoading: isLoadingStandards } = useQuery({
    queryKey: ["standards", standardGroups?.map((group) => group.id)],
    queryFn: () =>
      getStandardsByStandardGroups(standardGroups!.map((group) => group.id)),
    enabled: !!standardGroups && standardGroups.length > 0,
  });

  const { data: attempts, isLoading: isLoadingAttempts } = useQuery({
    queryKey: ["simulationAttempts", users?.map((user) => user.id)],
    queryFn: () => getSimulationAttemptsByUsers(users!.map((user) => user.id)),
    enabled: !!users && users.length > 0,
  });

  const { data: chats, isLoading: isLoadingChats } = useQuery({
    queryKey: ["simulationChats", attempts?.map((attempt) => attempt.id)],
    queryFn: () =>
      getSimulationChatsByAttempts(attempts!.map((attempt) => attempt.id)),
    enabled: !!attempts && attempts.length > 0,
  });

  const { data: grades, isLoading: isLoadingGrades } = useQuery({
    queryKey: ["simulationGrades", chats?.map((chat) => chat.id)],
    queryFn: () =>
      getSimulationChatGradesBySimulationChats(chats!.map((chat) => chat.id)),
    enabled: !!chats && chats.length > 0,
  });

  const { data: feedbacks, isLoading: isLoadingFeedbacks } = useQuery({
    queryKey: ["simulationFeedbacks", grades?.map((grade) => grade.id)],
    queryFn: () =>
      getSimulationChatFeedbacksBySimulationChatGrades(
        grades!.map((grade) => grade.id),
      ),
    enabled: !!grades && grades.length > 0,
  });

  const isWithinLastWeek = (date: string) => {
    const oneWeekAgo = subDays(new Date(), 7);
    const chatDate = new Date(date);
    return chatDate >= oneWeekAgo;
  };

  // Calculate key metrics
  const analytics = useMemo(() => {
    if (
      !users ||
      !chats ||
      !grades ||
      !agents ||
      !feedbacks ||
      !standards ||
      !standardGroups
    )
      return null;

    const tas = users.filter((user) => user.role === "ta");
    const completedChats = chats.filter((chat) => chat.completed);
    const totalSessions = chats.filter((chat) => isWithinLastWeek(chat.createdAt)).length;
    const completionRate =
      totalSessions > 0 ? (completedChats.length / totalSessions) * 100 : 0;

    // Group standards by their names to create skill categories
    const skillCategories = standardGroups.reduce(
      (acc, group: StandardGroup) => {
        const groupStandards = standards.filter(
          (s) => s.standardGroupId === group.id,
        );
        const groupFeedbacks = feedbacks.filter((f) =>
          groupStandards.some((s) => s.id === f.standardId),
        );

        if (groupFeedbacks.length > 0) {
          const avgScore = Math.round(
            (groupFeedbacks.reduce((sum, f) => sum + f.total, 0) /
              groupFeedbacks.length /
              Math.max(...groupStandards.map((s) => s.points))) *
              100,
          );
          acc[group.shortName] = avgScore;
        }

        return acc;
      },
      {} as Record<string, number>,
    );

    // Calculate overall average score from grades
    const avgOverallScore =
      grades.length > 0
        ? Math.round(
            grades.reduce((sum, g) => sum + g.score, 0) / grades.length,
          )
        : 0;

    // TA performance for struggling count
    const taPerformance = tas.map((ta) => {
      const taAttempts =
        attempts?.filter((attempt) => attempt.userId === ta.id) || [];
      const taChats = chats.filter((chat) =>
        taAttempts.some((attempt) => attempt.id === chat.attemptId),
      );
      const taGrades = grades.filter((grade) =>
        taChats.some((chat) => chat.id === grade.simulationChatId),
      );

      const avgScore =
        taGrades.length > 0
          ? Math.round(
              taGrades.reduce((sum, g) => sum + g.score, 0) / taGrades.length,
            )
          : 0;

      return { avgScore };
    });

    // Time series data for performance trends
    const performanceDays = performanceTrendTimeRange === "7d" ? 7 : performanceTrendTimeRange === "30d" ? 30 : 90;
    const performanceTrendData = Array.from({ length: performanceDays }, (_, i) => {
      const date = subDays(new Date(), performanceDays - 1 - i);
      const dateStr = format(date, "yyyy-MM-dd");

      const dayGrades = grades.filter((grade) => {
        const gradeDate = format(new Date(grade.createdAt), "yyyy-MM-dd");
        return gradeDate === dateStr;
      });

      return {
        date: format(date, performanceDays === 7 ? "MMM dd" : performanceDays === 30 ? "MM/dd" : "M/d"),
        score:
          dayGrades.length > 0
            ? Math.round(
                dayGrades.reduce((sum, g) => sum + g.score, 0) /
                  dayGrades.length,
              )
            : 0,
      };
    });

    // Session activity data with different time ranges
    const getSessionActivityData = () => {
      if (sessionActivityTimeRange === "1h") {
        // Last hour in 10-minute intervals
        return Array.from({ length: 6 }, (_, i) => {
          const time = subHours(new Date(), (5 - i) * (1/6)); // 10-minute intervals
          const timeStr = format(time, "yyyy-MM-dd HH:mm");
          
          const intervalChats = chats.filter((chat) => {
            const chatTime = new Date(chat.createdAt);
            const intervalStart = subHours(new Date(), (6 - i) * (1/6));
            const intervalEnd = subHours(new Date(), (5 - i) * (1/6));
            return chatTime >= intervalStart && chatTime < intervalEnd;
          });

          return {
            date: format(time, "HH:mm"),
            sessions: intervalChats.length,
            completed: intervalChats.filter((chat) => chat.completed).length,
          };
        });
      } else if (sessionActivityTimeRange === "12h") {
        // Last 12 hours in hourly intervals
        return Array.from({ length: 12 }, (_, i) => {
          const time = subHours(new Date(), 11 - i);
          const timeStr = format(time, "yyyy-MM-dd HH");
          
          const hourChats = chats.filter((chat) => {
            const chatTime = format(new Date(chat.createdAt), "yyyy-MM-dd HH");
            return chatTime === timeStr;
          });

          return {
            date: format(time, "HH:mm"),
            sessions: hourChats.length,
            completed: hourChats.filter((chat) => chat.completed).length,
          };
        });
      } else {
        // Last 24 hours in 2-hour intervals
        return Array.from({ length: 12 }, (_, i) => {
          const time = subHours(new Date(), (11 - i) * 2);
          const startTime = subHours(new Date(), (12 - i) * 2);
          const endTime = subHours(new Date(), (11 - i) * 2);
          
          const intervalChats = chats.filter((chat) => {
            const chatTime = new Date(chat.createdAt);
            return chatTime >= startTime && chatTime < endTime;
          });

          return {
            date: format(time, "HH:mm"),
            sessions: intervalChats.length,
            completed: intervalChats.filter((chat) => chat.completed).length,
          };
        });
      }
    };

    const sessionActivityData = getSessionActivityData();

    // Struggling TAs (score < 70)
    const strugglingTAs = taPerformance.filter((ta) => ta.avgScore < 70);

    // Calculate average training time from grades (convert seconds to minutes)
    const avgTrainingTime =
      grades.length > 0
        ? Math.round(
            grades.reduce((sum, g) => sum + g.timeTaken, 0) /
              grades.length /
              60,
          )
        : 45;

    return {
      totalTAs: tas.length,
      totalSessions,
      completionRate,
      avgOverallScore,
      skillCategories,
      performanceTrendData,
      sessionActivityData,
      strugglingTAs,
      avgTrainingTime,
    };
  }, [
    users,
    chats,
    grades,
    agents,
    attempts,
    feedbacks,
    standards,
    standardGroups,
    performanceTrendTimeRange,
    sessionActivityTimeRange,
  ]);

  // Loading state
  if (
    isLoadingUsers ||
    isLoadingAttempts ||
    isLoadingChats ||
    isLoadingGrades ||
    isLoadingAgents ||
    isLoadingFeedbacks ||
    isLoadingStandards ||
    isLoadingStandardGroups ||
    isLoadingRubrics
  ) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading training analytics...</p>
        </div>
      </div>
    );
  }

  if (!analytics) return null;

  // Custom tooltip component for better positioning
  const CustomBarTooltip = ({
    active,
    payload,
    label,
  }: {
    active: boolean;
    payload: { name: string; value: number; color: string }[];
    label: string;
  }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-gray-800 p-3 border rounded-lg shadow-lg text-sm relative z-50">
          <p className="font-medium mb-2">{label}</p>
          {payload.map(
            (
              entry: { name: string; value: number; color: string },
              index: number,
            ) => (
              <div key={index} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-muted-foreground">{entry.name}:</span>
                <span className="font-medium">{entry.value}</span>
              </div>
            ),
          )}
        </div>
      );
    }
    return null;
  };

  // Get top skill categories for display
  const topSkills = Object.entries(analytics.skillCategories)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 4)
    .map(([shortName, score], index) => ({
      shortName,
      score,
      icon: [Target, Brain, Eye, Zap][index] || Target,
    }));

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active TAs</CardTitle>
            <Users className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-700">
              {analytics.totalTAs}
            </div>
            <p className="text-xs text-blue-600 mt-1">
              Graduate teaching assistants
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Training Sessions
            </CardTitle>
            <MessageSquare className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700">
              {analytics.totalSessions}
            </div>
            <p className="text-xs text-green-600 mt-1">This week</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-purple-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Training Hours
            </CardTitle>
            <Clock className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-700">
              {analytics.avgTrainingTime}min
            </div>
            <p className="text-xs text-purple-600 mt-1">
              Avg time per session this week
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900 border-orange-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Need Support</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-700">
              {analytics.strugglingTAs.length}
            </div>
            <p className="text-xs text-orange-600 mt-1">
              TAs scoring below 70%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Performance Trends */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Performance Trends
                </CardTitle>
                <CardDescription>
                  Training scores and session completion over time
                </CardDescription>
              </div>
              <div className="flex gap-1">
                {(["7d", "30d", "90d"] as const).map((range) => (
                  <button
                    key={range}
                    onClick={() => setPerformanceTrendTimeRange(range)}
                    className={`px-3 py-1 text-xs rounded-md transition-colors ${
                      performanceTrendTimeRange === range
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    {range === "7d" ? "7 days" : range === "30d" ? "30 days" : "90 days"}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={analytics.performanceTrendData}>
                  <defs>
                    <linearGradient
                      id="scoreGradient"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="5%"
                        stopColor={COLORS.primary}
                        stopOpacity={0.3}
                      />
                      <stop
                        offset="95%"
                        stopColor={COLORS.primary}
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-muted"
                  />
                  <XAxis dataKey="date" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--background))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "6px",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="score"
                    stroke={COLORS.primary}
                    strokeWidth={2}
                    fill="url(#scoreGradient)"
                    name="Average Score"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Skill Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5" />
              Skill Breakdown
            </CardTitle>
            <CardDescription>Average scores by competency area</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topSkills.length > 0 ? (
                topSkills.map((skill) => (
                  <div key={skill.shortName} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <skill.icon className="h-4 w-4 text-muted-foreground" />
                        <span>{skill.shortName}</span>
                      </div>
                      <span className="font-medium">{skill.score}%</span>
                    </div>
                    <Progress value={skill.score} className="h-2" />
                  </div>
                ))
              ) : (
                <div className="text-center text-muted-foreground py-4">
                  No skill data available
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Session Activity */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Session Activity
              </CardTitle>
              <CardDescription>
                Training session volume and completion rates
              </CardDescription>
            </div>
            <div className="flex gap-1">
              {(["1h", "12h", "24h"] as const).map((range) => (
                <button
                  key={range}
                  onClick={() => setSessionActivityTimeRange(range)}
                  className={`px-3 py-1 text-xs rounded-md transition-colors ${
                    sessionActivityTimeRange === range
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {range === "1h" ? "1 hour" : range === "12h" ? "12 hours" : "24 hours"}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.sessionActivityData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip
                  content={
                    <CustomBarTooltip active={false} payload={[]} label={""} />
                  }
                  position={{ x: 0, y: 0 }}
                  allowEscapeViewBox={{ x: false, y: true }}
                  offset={20}
                />
                <Bar
                  dataKey="sessions"
                  fill={COLORS.primary}
                  name="Total Sessions"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="completed"
                  fill={COLORS.success}
                  name="Completed Sessions"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
