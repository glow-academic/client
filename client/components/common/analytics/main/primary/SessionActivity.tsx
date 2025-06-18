/**
 * SessionActivity.tsx
 * This is used to show the grouped bar chart of session activity.
 * @AshokSaravanan222 & @siladiea
 * 06/18/2025
 */
"use client";

import { getAllProfiles } from "@/utils/queries/profiles/get-all-profiles";
import { getSimulationAttemptsByProfiles } from "@/utils/queries/simulation_attempts/get-simulation-attempts-by-profiles";
import { getSimulationChatsByAttempts } from "@/utils/queries/simulation_chats/get-simulation-chats-by-attempts";
import { useQuery } from "@tanstack/react-query";
import { format, subHours } from "date-fns";
import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const COLORS = {
  primary: "#3b82f6",
  success: "#10b981",
};

interface SessionActivityProps {
  timeRange: "1h" | "12h" | "24h";
}

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

export default function SessionActivity({ timeRange }: SessionActivityProps) {
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

    if (timeRange === "1h") {
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
    } else if (timeRange === "12h") {
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
  }, [chats, timeRange]);

  if (!sessionActivityData.length) {
    return (
      <div className="flex items-center justify-center h-[300px]">
        <p className="text-muted-foreground">
          No session activity data available
        </p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={sessionActivityData}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="date" className="text-xs" />
        <YAxis className="text-xs" />
        <Tooltip
          content={<CustomBarTooltip active={false} payload={[]} label={""} />}
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
  );
}
