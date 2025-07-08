/**
 * PerformanceByPersonality.tsx
 * This is used to show the bar chart of performance by personality.
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
import { getAllProfiles } from "@/utils/queries/profiles/get-all-profiles";
import { getSimulationAttemptsByProfiles } from "@/utils/queries/simulation_attempts/get-simulation-attempts-by-profiles";
import { getSimulationChatGradesBySimulationChats } from "@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulationchats";
import { getSimulationChatsByAttempts } from "@/utils/queries/simulation_chats/get-simulation-chats-by-attempts";
import { useQuery } from "@tanstack/react-query";
import { subDays } from "date-fns";
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
  color = "purple",
  defaultTimeRange = "30d",
  chartType: _chartType = "bar",
  title = "Performance by Personality",
  showTimeSelector = true,
}: PerformanceByPersonalityProps) {
  const [performanceTimeRange, setPerformanceTimeRange] =
    useState<TimeRange>(defaultTimeRange);
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

  // Calculate performance by personality data
  const performanceByPersonalityData = useMemo(() => {
    if (!profiles || !grades) return [];

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

    const days = getDaysFromTimeRange(performanceTimeRange);
    const cutoffDate = subDays(new Date(), days);

    // Filter grades by time range
    const filteredGrades = grades.filter((grade) => {
      const gradeDate = new Date(grade.createdAt);
      return gradeDate >= cutoffDate;
    });

    // Group profiles by personality type (using a placeholder field)
    const personalityGroups = profiles.reduce(
      (acc, profile) => {
        // Placeholder: use first letter of firstName as personality type
        // In real implementation, this would use actual personality data
        const personality =
          profile.firstName?.charAt(0)?.toUpperCase() || "Unknown";

        if (!acc[personality]) {
          acc[personality] = [];
        }
        acc[personality].push(profile.id);
        return acc;
      },
      {} as Record<string, string[]>
    );

    // Calculate average scores for each personality type
    return Object.entries(personalityGroups)
      .map(([personality, profileIds]) => {
        const personalityGrades = filteredGrades.filter((grade) => {
          // Find the profile for this grade through attempts and chats
          const relatedChat = chats?.find(
            (chat) => chat.id === grade.simulationChatId
          );
          const relatedAttempt = attempts?.find(
            (attempt) => attempt.id === relatedChat?.attemptId
          );
          return profileIds.includes(relatedAttempt?.profileId || "");
        });

        const avgScore =
          personalityGrades.length > 0
            ? Math.round(
                personalityGrades.reduce((sum, g) => sum + g.score, 0) /
                  personalityGrades.length
              )
            : 0;

        return {
          personality:
            personality.length > 10
              ? personality.substring(0, 10) + "..."
              : personality,
          score: avgScore,
          sessions: personalityGrades.length,
        };
      })
      .filter((item) => item.sessions > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8); // Show top 8 personality types
  }, [profiles, grades, chats, attempts, performanceTimeRange]);

  const timeOptions = [
    // Weekly group
    { value: "7d" as const, label: "7 days", group: "weekly" },
    { value: "14d" as const, label: "14 days", group: "weekly" },
    // Monthly group
    { value: "30d" as const, label: "30 days", group: "monthly" },
    { value: "60d" as const, label: "60 days", group: "monthly" },
    { value: "90d" as const, label: "90 days", group: "monthly" },
  ];

  if (!performanceByPersonalityData.length) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                {title}
              </CardTitle>
              <CardDescription>
                Average performance scores by personality type
              </CardDescription>
            </div>
            {showTimeSelector && (
              <div className="flex gap-1 flex-wrap">
                {timeOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setPerformanceTimeRange(option.value)}
                    className={`px-3 py-1 text-xs rounded-md transition-colors ${
                      performanceTimeRange === option.value
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
        <CardContent>
          <div className="flex items-center justify-center h-[300px]">
            <p className="text-muted-foreground">
              No personality performance data available
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              {title}
            </CardTitle>
            <CardDescription>
              Average performance scores by personality type
            </CardDescription>
          </div>
          {showTimeSelector && (
            <div className="flex gap-1 flex-wrap">
              {timeOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setPerformanceTimeRange(option.value)}
                  className={`px-3 py-1 text-xs rounded-md transition-colors ${
                    performanceTimeRange === option.value
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
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={performanceByPersonalityData}
              margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="personality"
                className="text-xs"
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis className="text-xs" domain={[0, 100]} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--background))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "6px",
                }}
                formatter={(value: number, name: string) => [
                  name === "score" ? `${value}%` : value,
                  name === "score" ? "Average Score" : "Sessions",
                ]}
              />
              <Bar
                dataKey="score"
                fill={colorConfig.primary}
                name="score"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
