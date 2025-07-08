/**
 * ActiveCohorts.tsx
 * This is used to show the active cohorts.
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
import { getAllCohorts } from "@/utils/queries/cohorts/get-all-cohorts";
import { useQuery } from "@tanstack/react-query";
import { format, subDays } from "date-fns";
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
type TimeRange = "7d" | "30d" | "90d";

interface ActiveCohortsProps {
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
    primary: "#3b82f6",
  },
  green: {
    gradient:
      "from-green-50 to-green-100 dark:from-green-950 dark:to-green-900",
    border: "border-green-200",
    text: "text-green-700",
    icon: "text-green-600",
    accent: "text-green-600",
    primary: "#10b981",
  },
  purple: {
    gradient:
      "from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900",
    border: "border-purple-200",
    text: "text-purple-700",
    icon: "text-purple-600",
    accent: "text-purple-600",
    primary: "#8b5cf6",
  },
  orange: {
    gradient:
      "from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900",
    border: "border-orange-200",
    text: "text-orange-700",
    icon: "text-orange-600",
    accent: "text-orange-600",
    primary: "#f97316",
  },
  teal: {
    gradient: "from-teal-50 to-teal-100 dark:from-teal-950 dark:to-teal-900",
    border: "border-teal-200",
    text: "text-teal-700",
    icon: "text-teal-600",
    accent: "text-teal-600",
    primary: "#14b8a6",
  },
  red: {
    gradient: "from-red-50 to-red-100 dark:from-red-950 dark:to-red-900",
    border: "border-red-200",
    text: "text-red-700",
    icon: "text-red-600",
    accent: "text-red-600",
    primary: "#ef4444",
  },
  emerald: {
    gradient:
      "from-emerald-50 to-emerald-100 dark:from-emerald-950 dark:to-emerald-900",
    border: "border-emerald-200",
    text: "text-emerald-700",
    icon: "text-emerald-600",
    accent: "text-emerald-600",
    primary: "#10b981",
  },
  indigo: {
    gradient:
      "from-indigo-50 to-indigo-100 dark:from-indigo-950 dark:to-indigo-900",
    border: "border-indigo-200",
    text: "text-indigo-700",
    icon: "text-indigo-600",
    accent: "text-indigo-600",
    primary: "#6366f1",
  },
};

export default function ActiveCohorts({
  color = "blue",
  timeRange = "30d",
  title = "Active Cohorts",
  showDialog = true,
}: ActiveCohortsProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const colorConfig = COLOR_CONFIGS[color];

  // Fetch data
  const { data: cohorts } = useQuery({
    queryKey: ["cohorts"],
    queryFn: () => getAllCohorts(),
  });

  // Calculate active cohorts for the selected time range
  const activeCohorts = useMemo(() => {
    if (!cohorts) return 0;

    const getDaysFromTimeRange = (range: TimeRange) => {
      switch (range) {
        case "7d":
          return 7;
        case "30d":
          return 30;
        case "90d":
          return 90;
        default:
          return 30;
      }
    };

    const days = getDaysFromTimeRange(timeRange);
    const cutoffDate = subDays(new Date(), days);

    return cohorts.filter((cohort) => {
      const cohortDate = new Date(cohort.updatedAt || cohort.createdAt);
      return cohortDate >= cutoffDate;
    }).length;
  }, [cohorts, timeRange]);

  // Cohort activity trend data
  const cohortTrend = useMemo(() => {
    if (!cohorts) return [];

    const getDaysFromTimeRange = (range: TimeRange) => {
      switch (range) {
        case "7d":
          return 7;
        case "30d":
          return 30;
        case "90d":
          return 90;
        default:
          return 30;
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

    return Array.from({ length: Math.min(days, 10) }, (_, i) => {
      const date = subDays(new Date(), Math.min(days, 10) - 1 - i);
      const dateStr = format(date, "yyyy-MM-dd");

      const dayCohorts = cohorts.filter((cohort) => {
        const cohortDate = format(
          new Date(cohort.updatedAt || cohort.createdAt),
          "yyyy-MM-dd"
        );
        return cohortDate === dateStr;
      });

      return {
        date: format(date, dateFormat),
        cohorts: dayCohorts.length,
        participants: dayCohorts.reduce(
          (sum, cohort) => sum + (cohort.profileIds?.length || 0),
          0
        ),
      };
    });
  }, [cohorts, timeRange]);

  const getTimeRangeLabel = (range: TimeRange) => {
    switch (range) {
      case "7d":
        return "This week";
      case "30d":
        return "This month";
      case "90d":
        return "Last 3 months";
      default:
        return "This month";
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
          <Users className={`h-4 w-4 ${colorConfig.icon}`} />
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${colorConfig.text}`}>
            {activeCohorts}
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
              <DialogTitle>Cohort Activity Trend</DialogTitle>
            </DialogHeader>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={cohortTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip
                    formatter={(value: number, name: string) => [
                      `${value}`,
                      name === "cohorts" ? "Active Cohorts" : "Participants",
                    ]}
                  />
                  <Bar
                    dataKey="cohorts"
                    fill={colorConfig.primary}
                    name="cohorts"
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
