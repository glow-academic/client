/**
 * PerformanceTrends.tsx
 * This is used to show the line chart of trends of performance.
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
import { format, subDays } from "date-fns";
import { TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const COLORS = {
  primary: "#3b82f6",
};
export default function PerformanceTrends() {
  const [performanceTrendTimeRange, setPerformanceTrendTimeRange] = useState<
    "7d" | "30d" | "90d"
  >("30d");

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

  // Calculate performance trends
  const performanceTrendData = useMemo(() => {
    if (!grades) return [];

    const days = performanceTrendTimeRange === "7d" ? 7 : performanceTrendTimeRange === "30d" ? 30 : 90;

    return Array.from({ length: days }, (_, i) => {
      const date = subDays(new Date(), days - 1 - i);
      const dateStr = format(date, "yyyy-MM-dd");

      const dayGrades = grades.filter((grade) => {
        const gradeDate = format(new Date(grade.createdAt), "yyyy-MM-dd");
        return gradeDate === dateStr;
      });

      return {
        date: format(
          date,
          days === 7 ? "MMM dd" : days === 30 ? "MM/dd" : "M/d"
        ),
        score:
          dayGrades.length > 0
            ? Math.round(
                dayGrades.reduce((sum, g) => sum + g.score, 0) /
                  dayGrades.length
              )
            : 0,
      };
    });
  }, [grades, performanceTrendTimeRange]);

  const timeOptions = [
    { value: "7d" as const, label: "7 days" },
    { value: "30d" as const, label: "30 days" },
    { value: "90d" as const, label: "90 days" },
  ];

  if (!performanceTrendData.length) {
    return (
      <Card>
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
              {timeOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setPerformanceTrendTimeRange(option.value)}
                  className={`px-3 py-1 text-xs rounded-md transition-colors ${
                    performanceTrendTimeRange === option.value
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[300px]">
            <p className="text-muted-foreground">
              No performance trend data available
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
              <TrendingUp className="h-5 w-5" />
              Performance Trends
            </CardTitle>
            <CardDescription>
              Training scores and session completion over time
            </CardDescription>
          </div>
          <div className="flex gap-1">
            {timeOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => setPerformanceTrendTimeRange(option.value)}
                className={`px-3 py-1 text-xs rounded-md transition-colors ${
                  performanceTrendTimeRange === option.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={performanceTrendData}>
              <defs>
                <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
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
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
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
  );
}
