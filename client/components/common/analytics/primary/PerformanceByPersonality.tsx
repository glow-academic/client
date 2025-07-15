/**
 * PerformanceByPersonality.tsx
 * This is used to show the horizontal bar chart of performance by personality.
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
import { getAgentConfig } from "@/utils/agents";
import { getAllAgents } from "@/utils/queries/agents/get-all-agents";
import { getAllProfiles } from "@/utils/queries/profiles/get-all-profiles";
import { getAllRubrics } from "@/utils/queries/rubrics/get-all-rubrics";
import { getAllScenarios } from "@/utils/queries/scenarios/get-all-scenarios";
import { getSimulationAttemptsByProfiles } from "@/utils/queries/simulation_attempts/get-simulation-attempts-by-profiles";
import { getSimulationChatGradesBySimulationChats } from "@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulationchats";
import { getSimulationChatsByAttempts } from "@/utils/queries/simulation_chats/get-simulation-chats-by-attempts";
import { getAllSimulations } from "@/utils/queries/simulations/get-all-simulations";
import { useQuery } from "@tanstack/react-query";
import { isAfter, subDays } from "date-fns";
import { Clock, Info, Target, TrendingUp, Users } from "lucide-react";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type ColorTheme =
  | "blue"
  | "green"
  | "purple"
  | "orange"
  | "teal"
  | "red"
  | "emerald"
  | "indigo";
type TimeRange = "7d" | "14d" | "30d" | "60d" | "90d";
type ChartType = "bar";

export interface PerformanceByPersonalityProps {
  color?: ColorTheme;
  defaultTimeRange?: TimeRange;
  chartType?: ChartType;
  title?: string;
  showTimeSelector?: boolean;
}

const COLOR_CONFIGS = {
  blue: {
    primary: "#3b82f6",
  },
  green: {
    primary: "#10b981",
  },
  purple: {
    primary: "#8b5cf6",
  },
  orange: {
    primary: "#f97316",
  },
  teal: {
    primary: "#14b8a6",
  },
  red: {
    primary: "#ef4444",
  },
  emerald: {
    primary: "#10b981",
  },
  indigo: {
    primary: "#6366f1",
  },
};

export default function PerformanceByPersonality({
  color = "blue",
  defaultTimeRange = "30d",
  chartType: _chartType = "bar",
  title = "Performance by Personality",
  showTimeSelector = true,
}: PerformanceByPersonalityProps) {
  const [personalityTimeRange, setPersonalityTimeRange] =
    useState<TimeRange>(defaultTimeRange);
  const colorConfig = COLOR_CONFIGS[color];

  // Fetch data
  const { data: profiles } = useQuery({
    queryKey: ["profiles"],
    queryFn: () => getAllProfiles(),
  });

  const { data: agents } = useQuery({
    queryKey: ["agents"],
    queryFn: () => getAllAgents(),
  });

  const { data: scenarios } = useQuery({
    queryKey: ["scenarios"],
    queryFn: () => getAllScenarios(),
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

  // Calculate performance by personality with detailed metrics
  const performanceData = useMemo(() => {
    if (
      !agents ||
      !scenarios ||
      !chats ||
      !grades ||
      !attempts ||
      !simulations ||
      !rubrics
    )
      return [];

    // Filter data by time range
    const getDaysFromTimeRange = (range: TimeRange) => {
      switch (range) {
        case "7d":
          return 7;
        case "14d":
          return 14;
        case "30d":
          return 30;
        case "60d":
          return 60;
        case "90d":
          return 90;
        default:
          return 30;
      }
    };

    const days = getDaysFromTimeRange(personalityTimeRange);
    const cutoff = subDays(new Date(), days);
    const filteredGrades = grades.filter((grade) =>
      isAfter(new Date(grade.createdAt), cutoff)
    );

    // Performance by student type (scenario-based)
    const performanceByType = agents
      .filter((agent) => agent.name) // Filter for student agents
      .map((agent) => {
        const agentScenarios = scenarios.filter((s) => s.agentId === agent.id);
        const agentChats = chats.filter((chat) =>
          agentScenarios.some((scenario) => scenario.id === chat.scenarioId)
        );
        const agentGrades = filteredGrades.filter((grade) =>
          agentChats.some((chat) => chat.id === grade.simulationChatId)
        );

        // Calculate detailed metrics
        const scoreDistribution = agentGrades.map((grade) => {
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
          return {
            score: scorePercent,
            timeTaken: Math.round(grade.timeTaken / 60), // Convert to minutes
            passed: grade.passed,
            createdAt: grade.createdAt,
          };
        });

        // Calculate average score
        let avgScore = 0;
        if (agentGrades.length > 0) {
          const scoreSum = scoreDistribution.reduce(
            (sum, item) => sum + item.score,
            0
          );
          avgScore = Math.round(scoreSum / agentGrades.length);
        }

        // Calculate average time
        const avgTime =
          scoreDistribution.length > 0
            ? Math.round(
                scoreDistribution.reduce(
                  (sum, item) => sum + item.timeTaken,
                  0
                ) / scoreDistribution.length
              )
            : 0;

        // Calculate pass rate
        const passRate =
          scoreDistribution.length > 0
            ? Math.round(
                (scoreDistribution.filter((item) => item.passed).length /
                  scoreDistribution.length) *
                  100
              )
            : 0;

        // Calculate trend (last 7 days vs previous 7 days)
        const last7Days = scoreDistribution.filter((item) =>
          isAfter(new Date(item.createdAt), subDays(new Date(), 7))
        );
        const previous7Days = scoreDistribution.filter((item) => {
          const itemDate = new Date(item.createdAt);
          return (
            itemDate >= subDays(new Date(), 14) &&
            itemDate < subDays(new Date(), 7)
          );
        });

        const recentAvg =
          last7Days.length > 0
            ? Math.round(
                last7Days.reduce((sum, item) => sum + item.score, 0) /
                  last7Days.length
              )
            : avgScore;
        const previousAvg =
          previous7Days.length > 0
            ? Math.round(
                previous7Days.reduce((sum, item) => sum + item.score, 0) /
                  previous7Days.length
              )
            : avgScore;
        const trend = recentAvg - previousAvg;

        return {
          name: agent.name,
          score: avgScore,
          sessions: agentChats.length,
          color: getAgentConfig(agent.name).colors.bgColor,
          scoreDistribution,
          avgTime,
          passRate,
          trend,
          recentSessions: last7Days.length,
        };
      })
      .filter((agent) => agent.sessions > 0) // Only show agents with sessions
      .sort((a, b) => b.score - a.score); // Sort by score descending

    return performanceByType;
  }, [
    agents,
    scenarios,
    chats,
    grades,
    attempts,
    simulations,
    rubrics,
    personalityTimeRange,
  ]);

  const timeOptions = [
    // Weekly group
    { value: "7d" as const, label: "7 days", group: "weekly" },
    { value: "14d" as const, label: "14 days", group: "weekly" },
    // Monthly group
    { value: "30d" as const, label: "30 days", group: "monthly" },
    { value: "60d" as const, label: "60 days", group: "monthly" },
    { value: "90d" as const, label: "90 days", group: "monthly" },
  ];


  if (!performanceData.length) {
    return (
      <Card className={cn("w-full h-full flex flex-col")}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                {title}
              </CardTitle>
              <CardDescription>
                How TAs handle different student types during training
              </CardDescription>
            </div>
            {showTimeSelector && (
              <div className="flex gap-1 flex-wrap">
                {timeOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setPersonalityTimeRange(option.value)}
                    className={`px-3 py-1 text-xs rounded-md transition-colors ${
                      personalityTimeRange === option.value
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="flex items-center justify-center flex-1">
          <p className="text-muted-foreground">No performance data available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("w-full h-full flex flex-col")}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              {title}
            </CardTitle>
            <CardDescription>
              How TAs handle different student types during training
            </CardDescription>
          </div>
          {showTimeSelector && (
            <div className="flex gap-1 flex-wrap">
              {timeOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setPersonalityTimeRange(option.value)}
                  className={`px-3 py-1 text-xs rounded-md transition-colors ${
                    personalityTimeRange === option.value
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden">
        <div className="grid gap-6 md:grid-cols-2 h-full">
          <div className="h-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={performanceData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis type="number" domain={[0, 100]} className="text-xs" />
                <YAxis
                  dataKey="name"
                  type="category"
                  width={80}
                  className="text-xs"
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--background))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "6px",
                  }}
                  formatter={(value: number) => [`${value}%`, "Average Score"]}
                  labelFormatter={(label) => `${label} Students`}
                />
                <Bar
                  dataKey="score"
                  fill={colorConfig.primary}
                  radius={[0, 4, 4, 0]}
                  name="Average Score"
                  className="cursor-pointer"
                >
                  {performanceData.map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      className="hover:opacity-80 transition-opacity"
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-4 overflow-y-auto">
            {performanceData.map((type) => (
              <Dialog key={type.name}>
                <DialogTrigger asChild>
                  <div className="flex items-center justify-between p-4 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-4 h-4 rounded-full ${type.color}`}
                      ></div>
                      <div>
                        <p className="font-medium">{type.name} Student</p>
                        <p className="text-sm text-muted-foreground">
                          {type.sessions} sessions
                        </p>
                      </div>
                    </div>
                    <div className="text-right flex items-center gap-2">
                      <div>
                        <p className="text-lg font-bold">{type.score}%</p>
                        <Badge
                          variant={
                            type.score >= 80
                              ? "default"
                              : type.score >= 70
                                ? "secondary"
                                : "destructive"
                          }
                        >
                          {type.score >= 80
                            ? "Excellent"
                            : type.score >= 70
                              ? "Good"
                              : "Needs Work"}
                        </Badge>
                      </div>
                      <Info className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <div
                        className={`w-4 h-4 rounded-full ${type.color}`}
                      ></div>
                      {type.name} Student Performance
                    </DialogTitle>
                    <DialogDescription>
                      Detailed performance analysis for {type.name} student
                      interactions
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-6">
                    {/* Key Metrics */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center p-3 bg-muted rounded-lg">
                        <div className="text-2xl font-bold text-primary">
                          {type.score}%
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Avg Score
                        </div>
                      </div>
                      <div className="text-center p-3 bg-muted rounded-lg">
                        <div className="text-2xl font-bold text-primary">
                          {type.avgTime}m
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Avg Time
                        </div>
                      </div>
                      <div className="text-center p-3 bg-muted rounded-lg">
                        <div className="text-2xl font-bold text-primary">
                          {type.passRate}%
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Pass Rate
                        </div>
                      </div>
                      <div className="text-center p-3 bg-muted rounded-lg">
                        <div
                          className={`text-2xl font-bold ${type.trend >= 0 ? "text-green-600" : "text-red-600"}`}
                        >
                          {type.trend >= 0 ? "+" : ""}
                          {type.trend}%
                        </div>
                        <div className="text-sm text-muted-foreground">
                          7-day Trend
                        </div>
                      </div>
                    </div>

                    <Separator />

                    {/* Performance Distribution */}
                    <div>
                      <h4 className="font-medium mb-3 flex items-center gap-2">
                        <Target className="h-4 w-4" />
                        Score Distribution
                      </h4>
                      <div className="space-y-2">
                        {[
                          {
                            range: "90-100%",
                            count: type.scoreDistribution.filter(
                              (s) => s.score >= 90
                            ).length,
                            color: "bg-green-500",
                          },
                          {
                            range: "80-89%",
                            count: type.scoreDistribution.filter(
                              (s) => s.score >= 80 && s.score < 90
                            ).length,
                            color: "bg-blue-500",
                          },
                          {
                            range: "70-79%",
                            count: type.scoreDistribution.filter(
                              (s) => s.score >= 70 && s.score < 80
                            ).length,
                            color: "bg-yellow-500",
                          },
                          {
                            range: "60-69%",
                            count: type.scoreDistribution.filter(
                              (s) => s.score >= 60 && s.score < 70
                            ).length,
                            color: "bg-orange-500",
                          },
                          {
                            range: "Below 60%",
                            count: type.scoreDistribution.filter(
                              (s) => s.score < 60
                            ).length,
                            color: "bg-red-500",
                          },
                        ].map((item) => (
                          <div
                            key={item.range}
                            className="flex items-center gap-3"
                          >
                            <div className="w-16 text-sm text-muted-foreground">
                              {item.range}
                            </div>
                            <div className="flex-1">
                              <Progress
                                value={
                                  type.scoreDistribution.length > 0
                                    ? (item.count /
                                        type.scoreDistribution.length) *
                                      100
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

                    <Separator />

                    {/* Recent Activity */}
                    <div>
                      <h4 className="font-medium mb-3 flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Recent Activity
                      </h4>
                      <div className="text-sm text-muted-foreground space-y-1">
                        <p>
                          • {type.recentSessions} sessions in the last 7 days
                        </p>
                        <p>
                          •{" "}
                          {
                            type.scoreDistribution.filter((s) => s.passed)
                              .length
                          }{" "}
                          out of {type.scoreDistribution.length} sessions passed
                        </p>
                        <p>
                          • Average session duration: {type.avgTime} minutes
                        </p>
                        {type.trend !== 0 && (
                          <p
                            className={
                              type.trend >= 0
                                ? "text-green-600"
                                : "text-red-600"
                            }
                          >
                            • Performance{" "}
                            {type.trend >= 0 ? "improved" : "declined"} by{" "}
                            {Math.abs(type.trend)}% this week
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Recommendations */}
                    <div>
                      <h4 className="font-medium mb-3 flex items-center gap-2">
                        <TrendingUp className="h-4 w-4" />
                        Recommendations
                      </h4>
                      <div className="text-sm text-muted-foreground space-y-1">
                        {type.score < 70 && (
                          <p>
                            • Focus on additional training scenarios for{" "}
                            {type.name} students
                          </p>
                        )}
                        {type.avgTime > 30 && (
                          <p>
                            • Consider time management strategies for{" "}
                            {type.name} interactions
                          </p>
                        )}
                        {type.passRate < 80 && (
                          <p>
                            • Review common failure patterns in {type.name}{" "}
                            scenarios
                          </p>
                        )}
                        {type.trend < 0 && (
                          <p>
                            • Recent performance decline - consider refresher
                            training
                          </p>
                        )}
                        {type.score >= 80 && type.trend >= 0 && (
                          <p>
                            • Excellent performance! Consider advanced scenarios
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
