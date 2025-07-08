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
import { cn } from "@/lib/utils";
import { getAgentConfig } from "@/utils/agents";
import { getAllAgents } from "@/utils/queries/agents/get-all-agents";
import { getAllProfiles } from "@/utils/queries/profiles/get-all-profiles";
import { getAllScenarios } from "@/utils/queries/scenarios/get-all-scenarios";
import { getSimulationAttemptsByProfiles } from "@/utils/queries/simulation_attempts/get-simulation-attempts-by-profiles";
import { getSimulationChatGradesBySimulationChats } from "@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulationchats";
import { getSimulationChatsByAttempts } from "@/utils/queries/simulation_chats/get-simulation-chats-by-attempts";
import { useQuery } from "@tanstack/react-query";
import { isAfter, subDays } from "date-fns";
import { Users } from "lucide-react";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
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

interface PerformanceByPersonalityProps {
  className?: string;
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
  className,
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

  // Calculate performance by personality
  const performanceData = useMemo(() => {
    if (!agents || !scenarios || !chats || !grades) return [];

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

        const avgScore =
          agentGrades.length > 0
            ? Math.round(
                agentGrades.reduce((sum, g) => sum + g.score, 0) /
                  agentGrades.length
              )
            : 0;

        return {
          name: agent.name,
          score: avgScore,
          sessions: agentChats.length,
          color: getAgentConfig(agent.name).colors.bgColor,
        };
      })
      .filter((agent) => agent.sessions > 0) // Only show agents with sessions
      .sort((a, b) => b.score - a.score); // Sort by score descending

    return performanceByType;
  }, [agents, scenarios, chats, grades, personalityTimeRange]);

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
      <Card className={cn("w-full h-full flex flex-col", className)}>
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
    <Card className={cn("w-full h-full flex flex-col", className)}>
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
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-4 overflow-y-auto">
            {performanceData.map((type) => (
              <div
                key={type.name}
                className="flex items-center justify-between p-4 rounded-lg border"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-4 h-4 rounded-full ${type.color}`}></div>
                  <div>
                    <p className="font-medium">{type.name} Student</p>
                    <p className="text-sm text-muted-foreground">
                      {type.sessions} sessions
                    </p>
                  </div>
                </div>
                <div className="text-right">
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
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
