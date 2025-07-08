/**
 * PassRate.tsx
 * This is used to show the pass rate.
 * @AshokSaravanan222 & @siladiea
 * 06/18/2025
 */
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getAllProfiles } from "@/utils/queries/profiles/get-all-profiles";
import { getSimulationAttemptsByProfiles } from "@/utils/queries/simulation_attempts/get-simulation-attempts-by-profiles";
import { getSimulationChatGradesBySimulationChats } from "@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulationchats";
import { getSimulationChatsByAttempts } from "@/utils/queries/simulation_chats/get-simulation-chats-by-attempts";
import { useQuery } from "@tanstack/react-query";
import { format, subDays } from "date-fns";
import { Award } from "lucide-react";
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
type TimeRange = "7d" | "30d" | "90d";

interface PassRateProps {
  color?: ColorTheme;
  timeRange?: TimeRange;
  title?: string;
  showDialog?: boolean;
}

const COLOR_CONFIGS = {
  blue: {
    gradient: "from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900",
    border: "border-blue-200",
    text: "text-blue-700",
    icon: "text-blue-600",
    accent: "text-blue-600",
    success: "#3b82f6",
    danger: "#ef4444",
  },
  green: {
    gradient:
      "from-green-50 to-green-100 dark:from-green-950 dark:to-green-900",
    border: "border-green-200",
    text: "text-green-700",
    icon: "text-green-600",
    accent: "text-green-600",
    success: "#10b981",
    danger: "#ef4444",
  },
  purple: {
    gradient:
      "from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900",
    border: "border-purple-200",
    text: "text-purple-700",
    icon: "text-purple-600",
    accent: "text-purple-600",
    success: "#8b5cf6",
    danger: "#ef4444",
  },
  orange: {
    gradient:
      "from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900",
    border: "border-orange-200",
    text: "text-orange-700",
    icon: "text-orange-600",
    accent: "text-orange-600",
    success: "#f97316",
    danger: "#ef4444",
  },
  teal: {
    gradient: "from-teal-50 to-teal-100 dark:from-teal-950 dark:to-teal-900",
    border: "border-teal-200",
    text: "text-teal-700",
    icon: "text-teal-600",
    accent: "text-teal-600",
    success: "#14b8a6",
    danger: "#ef4444",
  },
  red: {
    gradient: "from-red-50 to-red-100 dark:from-red-950 dark:to-red-900",
    border: "border-red-200",
    text: "text-red-700",
    icon: "text-red-600",
    accent: "text-red-600",
    success: "#ef4444",
    danger: "#dc2626",
  },
  emerald: {
    gradient:
      "from-emerald-50 to-emerald-100 dark:from-emerald-950 dark:to-emerald-900",
    border: "border-emerald-200",
    text: "text-emerald-700",
    icon: "text-emerald-600",
    accent: "text-emerald-600",
    success: "#10b981",
    danger: "#ef4444",
  },
  indigo: {
    gradient:
      "from-indigo-50 to-indigo-100 dark:from-indigo-950 dark:to-indigo-900",
    border: "border-indigo-200",
    text: "text-indigo-700",
    icon: "text-indigo-600",
    accent: "text-indigo-600",
    success: "#6366f1",
    danger: "#ef4444",
  },
};

export default function PassRate({
  color = "emerald",
  timeRange = "7d",
  title = "Pass Rate",
  showDialog = true,
}: PassRateProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
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

  // Calculate pass rate for the selected time range
  const passRate = useMemo(() => {
    if (!grades) return 0;

    const getDaysFromTimeRange = (range: TimeRange) => {
      switch (range) {
        case "7d":
          return 7;
        case "30d":
          return 30;
        case "90d":
          return 90;
        default:
          return 7;
      }
    };

    const days = getDaysFromTimeRange(timeRange);
    const cutoffDate = subDays(new Date(), days);

    const filteredGrades = grades.filter((grade) => {
      const gradeDate = new Date(grade.createdAt);
      return gradeDate >= cutoffDate;
    });

    return filteredGrades.length > 0
      ? Math.round(
          (filteredGrades.filter((g) => g.passed).length /
            filteredGrades.length) *
            100
        )
      : 0;
  }, [grades, timeRange]);

  // Pass/fail trend data for the selected time range
  const passFailTrend = useMemo(() => {
    if (!grades) return [];

    const getDaysFromTimeRange = (range: TimeRange) => {
      switch (range) {
        case "7d":
          return 7;
        case "30d":
          return 30;
        case "90d":
          return 90;
        default:
          return 7;
      }
    };

    const days = getDaysFromTimeRange(timeRange);
    const getDateFormat = (range: TimeRange) => {
      switch (range) {
        case "7d":
          return "MM/dd";
        case "30d":
          return "MM/dd";
        case "90d":
          return "M/d";
        default:
          return "MM/dd";
      }
    };

    const dateFormat = getDateFormat(timeRange);

    return Array.from({ length: days }, (_, i) => {
      const date = subDays(new Date(), days - 1 - i);
      const dateStr = format(date, "yyyy-MM-dd");

      const dayGrades = grades.filter((grade) => {
        const gradeDate = format(new Date(grade.createdAt), "yyyy-MM-dd");
        return gradeDate === dateStr;
      });

      const passRate =
        dayGrades.length > 0
          ? Math.round(
              (dayGrades.filter((g) => g.passed).length / dayGrades.length) *
                100
            )
          : 0;

      return {
        date: format(date, dateFormat),
        passRate,
        passed: dayGrades.filter((g) => g.passed).length,
        failed: dayGrades.filter((g) => !g.passed).length,
      };
    });
  }, [grades, timeRange]);

  const getTimeRangeLabel = (range: TimeRange) => {
    switch (range) {
      case "7d":
        return "Sessions meeting criteria";
      case "30d":
        return "This month";
      case "90d":
        return "Last 3 months";
      default:
        return "Sessions meeting criteria";
    }
  };

  const handleCardClick = () => {
    if (showDialog) {
      setIsDialogOpen(true);
    }
  };

  return (
    <>
      <Card
        className={`bg-gradient-to-br ${colorConfig.gradient} ${colorConfig.border} ${showDialog ? "cursor-pointer hover:shadow-md transition-shadow" : ""}`}
        onClick={handleCardClick}
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          <Award className={`h-4 w-4 ${colorConfig.icon}`} />
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${colorConfig.text}`}>
            {passRate}%
          </div>
          <p className={`text-xs ${colorConfig.accent} mt-1`}>
            {getTimeRangeLabel(timeRange)}
          </p>
        </CardContent>
      </Card>

      {showDialog && (
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Pass/Fail Trend</DialogTitle>
            </DialogHeader>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={passFailTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Bar
                    dataKey="passed"
                    fill={colorConfig.success}
                    name="Passed"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="failed"
                    fill={colorConfig.danger}
                    name="Failed"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
