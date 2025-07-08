/**
 * SessionActivity.tsx
 * This is used to show the grouped bar chart of session activity.
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
import { getSimulationChatsByAttempts } from "@/utils/queries/simulation_chats/get-simulation-chats-by-attempts";
import { useQuery } from "@tanstack/react-query";
import { format, subDays, subHours } from "date-fns";
import { Calendar } from "lucide-react";
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
type TimeRange = "1h" | "12h" | "24h" | "1d" | "3d" | "7d" | "14d" | "30d";
type ChartType = "bar";

interface SessionActivityProps {
  color?: ColorTheme;
  defaultTimeRange?: TimeRange;
  chartType?: ChartType;
  title?: string;
  showTimeSelector?: boolean;
}

const COLOR_CONFIGS = {
  blue: {
    primary: "#3b82f6",
    success: "#60a5fa",
  },
  green: {
    primary: "#10b981",
    success: "#34d399",
  },
  purple: {
    primary: "#8b5cf6",
    success: "#a78bfa",
  },
  orange: {
    primary: "#f97316",
    success: "#fb923c",
  },
  teal: {
    primary: "#14b8a6",
    success: "#2dd4bf",
  },
  red: {
    primary: "#ef4444",
    success: "#f87171",
  },
  emerald: {
    primary: "#10b981",
    success: "#34d399",
  },
  indigo: {
    primary: "#6366f1",
    success: "#818cf8",
  },
};

// Custom tooltip component
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
            index: number
          ) => (
            <div key={index} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-muted-foreground">{entry.name}:</span>
              <span className="font-medium">{entry.value}</span>
            </div>
          )
        )}
      </div>
    );
  }
  return null;
};

export default function SessionActivity({
  color = "blue",
  defaultTimeRange = "24h",
  chartType: _chartType = "bar",
  title = "Session Activity",
  showTimeSelector = true,
}: SessionActivityProps) {
  const [sessionActivityTimeRange, setSessionActivityTimeRange] =
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

  // Calculate session activity data
  const sessionActivityData = useMemo(() => {
    if (!chats) return [];

    if (sessionActivityTimeRange === "1h") {
      // Last hour in 10-minute intervals
      return Array.from({ length: 6 }, (_, i) => {
        const time = subHours(new Date(), (5 - i) * (1 / 6)); // 10-minute intervals

        const intervalChats = chats.filter((chat) => {
          const chatTime = new Date(chat.createdAt);
          const intervalStart = subHours(new Date(), (6 - i) * (1 / 6));
          const intervalEnd = subHours(new Date(), (5 - i) * (1 / 6));
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
    } else if (sessionActivityTimeRange === "24h") {
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
    } else {
      // Daily ranges: 1d, 3d, 7d, 14d, 30d
      const getDaysFromTimeRange = (range: TimeRange) => {
        switch (range) {
          case "1d":
            return 1;
          case "3d":
            return 3;
          case "7d":
            return 7;
          case "14d":
            return 14;
          case "30d":
            return 30;
          default:
            return 7;
        }
      };

      const days = getDaysFromTimeRange(sessionActivityTimeRange);
      const getDateFormat = (range: TimeRange) => {
        switch (range) {
          case "1d":
            return "HH:mm";
          case "3d":
            return "MM/dd";
          case "7d":
            return "MM/dd";
          case "14d":
            return "MM/dd";
          case "30d":
            return "M/d";
          default:
            return "MM/dd";
        }
      };

      const dateFormat = getDateFormat(sessionActivityTimeRange);

      if (sessionActivityTimeRange === "1d") {
        // For 1 day, show hourly data
        return Array.from({ length: 24 }, (_, i) => {
          const time = subHours(new Date(), 23 - i);
          const timeStr = format(time, "yyyy-MM-dd HH");

          const hourChats = chats.filter((chat) => {
            const chatTime = format(new Date(chat.createdAt), "yyyy-MM-dd HH");
            return chatTime === timeStr;
          });

          return {
            date: format(time, dateFormat),
            sessions: hourChats.length,
            completed: hourChats.filter((chat) => chat.completed).length,
          };
        });
      } else {
        // For multi-day ranges, show daily data
        return Array.from({ length: days }, (_, i) => {
          const date = subDays(new Date(), days - 1 - i);
          const dateStr = format(date, "yyyy-MM-dd");

          const dayChats = chats.filter((chat) => {
            const chatDate = format(new Date(chat.createdAt), "yyyy-MM-dd");
            return chatDate === dateStr;
          });

          return {
            date: format(date, dateFormat),
            sessions: dayChats.length,
            completed: dayChats.filter((chat) => chat.completed).length,
          };
        });
      }
    }
  }, [chats, sessionActivityTimeRange]);

  const timeOptions = [
    // Hourly group
    { value: "1h" as const, label: "1 hour", group: "hourly" },
    { value: "12h" as const, label: "12 hours", group: "hourly" },
    { value: "24h" as const, label: "24 hours", group: "hourly" },
    // Daily group
    { value: "1d" as const, label: "1 day", group: "daily" },
    { value: "3d" as const, label: "3 days", group: "daily" },
    { value: "7d" as const, label: "7 days", group: "daily" },
    // Weekly group
    { value: "14d" as const, label: "14 days", group: "weekly" },
    { value: "30d" as const, label: "30 days", group: "weekly" },
  ];

  if (!sessionActivityData.length) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                {title}
              </CardTitle>
              <CardDescription>
                Training session volume and completion rates
              </CardDescription>
            </div>
            {showTimeSelector && (
              <div className="flex gap-1 flex-wrap">
                {timeOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setSessionActivityTimeRange(option.value)}
                    className={`px-3 py-1 text-xs rounded-md transition-colors ${
                      sessionActivityTimeRange === option.value
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
              No session activity data available
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
              <Calendar className="h-5 w-5" />
              {title}
            </CardTitle>
            <CardDescription>
              Training session volume and completion rates
            </CardDescription>
          </div>
          {showTimeSelector && (
            <div className="flex gap-1 flex-wrap">
              {timeOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setSessionActivityTimeRange(option.value)}
                  className={`px-3 py-1 text-xs rounded-md transition-colors ${
                    sessionActivityTimeRange === option.value
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
            <BarChart data={sessionActivityData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="date" className="text-xs" />
              <YAxis className="text-xs" />
              <Tooltip
                content={
                  <CustomBarTooltip active={false} payload={[]} label="" />
                }
              />
              <Bar
                dataKey="sessions"
                fill={colorConfig.primary}
                name="Total Sessions"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="completed"
                fill={colorConfig.success}
                name="Completed Sessions"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
