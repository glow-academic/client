/**
 * TotalAttempts.tsx
 * This component displays the total attempts for the agents.
 * @AshokSaravanan222 & @siladiea
 * 07/23/2025
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
import { getAllSimulations } from "@/utils/queries/simulations/get-all-simulations";
import { useQuery } from "@tanstack/react-query";
import { eachDayOfInterval, format } from "date-fns";
import { Target } from "lucide-react";
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

export interface TotalAttemptsProps {
  dateStart: Date;
  dateEnd: Date;
  profileId?: string;
  thresholds: {
    danger: number;
    warning: number;
    success: number;
  };
}

const COLOR_CONFIGS = {
  danger: {
    gradient: "from-red-50 to-red-100 dark:from-red-950 dark:to-red-900",
    border: "border-red-200",
    text: "text-red-700",
    icon: "text-red-600",
    accent: "text-red-600",
    primary: "#ef4444",
  },
  warning: {
    gradient:
      "from-yellow-50 to-yellow-100 dark:from-yellow-950 dark:to-yellow-900",
    border: "border-yellow-200",
    text: "text-yellow-700",
    icon: "text-yellow-600",
    accent: "text-yellow-600",
    primary: "#eab308",
  },
  success: {
    gradient:
      "from-green-50 to-green-100 dark:from-green-950 dark:to-green-900",
    border: "border-green-200",
    text: "text-green-700",
    icon: "text-green-600",
    accent: "text-green-600",
    primary: "#10b981",
  },
};

export default function TotalAttempts({
  dateStart,
  dateEnd,
  profileId,
  thresholds,
}: TotalAttemptsProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

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

  const { data: simulations } = useQuery({
    queryKey: ["simulations"],
    queryFn: () => getAllSimulations(),
  });

  // Calculate total attempts for the specified date range and profile
  const totalAttempts = useMemo(() => {
    if (!attempts || !simulations) return 0;

    // Filter attempts by date range and exclude practice simulations
    const filteredAttempts = attempts.filter((attempt) => {
      const attemptDate = new Date(attempt.createdAt);
      const simulation = simulations.find((s) => s.id === attempt.simulationId);
      return (
        attemptDate >= dateStart &&
        attemptDate <= dateEnd &&
        !simulation?.practiceSimulation
      );
    });

    // Filter by profileId if provided
    const profileFilteredAttempts = profileId
      ? filteredAttempts.filter((attempt) => attempt.profileId === profileId)
      : filteredAttempts;

    // Count completed attempts only
    return profileFilteredAttempts.length;
  }, [attempts, simulations, dateStart, dateEnd, profileId]);

  // Total attempts trend data for the specified date range
  const attemptsTrend = useMemo(() => {
    if (!attempts || !simulations) return [];

    // Get all days in the date range
    const days = eachDayOfInterval({ start: dateStart, end: dateEnd });

    return days.map((date) => {
      const dateStr = format(date, "yyyy-MM-dd");

      // Filter attempts for this specific day and exclude practice simulations
      const dayAttempts = attempts.filter((attempt) => {
        const attemptDate = format(new Date(attempt.createdAt), "yyyy-MM-dd");
        const simulation = simulations.find(
          (s) => s.id === attempt.simulationId
        );
        return attemptDate === dateStr && !simulation?.practiceSimulation;
      });

      // Filter by profileId if provided
      const profileFilteredDayAttempts = profileId
        ? dayAttempts.filter((attempt) => attempt.profileId === profileId)
        : dayAttempts;

      return {
        date: format(date, "MM/dd"),
        attempts: profileFilteredDayAttempts.length,
        profiles: new Set(profileFilteredDayAttempts.map((a) => a.profileId))
          .size,
      };
    });
  }, [attempts, simulations, dateStart, dateEnd, profileId]);

  // Determine color based on total attempts and thresholds (more attempts is better)
  const getColorConfig = (attempts: number) => {
    if (attempts < thresholds.danger) return COLOR_CONFIGS.danger;
    if (attempts < thresholds.warning) return COLOR_CONFIGS.warning;
    return COLOR_CONFIGS.success;
  };

  const colorConfig = getColorConfig(totalAttempts);

  const handleCardClick = () => {
    setIsDialogOpen(true);
  };

  // Check if we have data to display
  const hasData = attemptsTrend.some((day) => day.attempts > 0);

  // Calculate actual trend from data
  const getTrendAnalysis = () => {
    if (!hasData || attemptsTrend.length < 2) return null;

    // Get recent data (last 3 days, 1 week, or 1 month depending on data availability)
    const recentData = attemptsTrend.slice(-3);
    const earlierData = attemptsTrend.slice(0, 3);

    if (recentData.length === 0 || earlierData.length === 0) return null;

    const recentAvg =
      recentData.reduce((sum, day) => sum + day.attempts, 0) /
      recentData.length;
    const earlierAvg =
      earlierData.reduce((sum, day) => sum + day.attempts, 0) /
      earlierData.length;
    const change = recentAvg - earlierAvg;
    const changePercent =
      earlierAvg > 0 ? Math.round((change / earlierAvg) * 100) : 0;

    if (Math.abs(changePercent) < 1) return null;

    const period =
      attemptsTrend.length <= 7
        ? "3 days"
        : attemptsTrend.length <= 14
          ? "1 week"
          : "1 month";
    const direction = changePercent > 0 ? "increased" : "decreased";

    return `Total attempts ${direction} ${Math.abs(changePercent)}% over the past ${period}`;
  };

  const trendAnalysis = getTrendAnalysis();

  return (
    <>
      <Card
        className={`bg-gradient-to-br ${colorConfig.gradient} ${colorConfig.border} cursor-pointer hover:shadow-md transition-shadow h-full flex flex-col`}
        onClick={handleCardClick}
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Attempts</CardTitle>
          <Target className={`h-4 w-4 ${colorConfig.icon}`} />
        </CardHeader>
        <CardContent className="flex-1 flex flex-col justify-center">
          <div className={`text-2xl font-bold ${colorConfig.text}`}>
            {hasData ? totalAttempts : "No data"}
          </div>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Total Attempts Trend</DialogTitle>
          </DialogHeader>
          <div className="h-64">
            {hasData ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={attemptsTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip
                    formatter={(value: number, name: string) => [
                      value,
                      name === "attempts" ? "Attempts" : "Profiles",
                    ]}
                  />
                  <Bar
                    dataKey="attempts"
                    fill={colorConfig.primary}
                    name="attempts"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                No data available for the selected date range
                {profileId && " and profile"}
              </div>
            )}
          </div>

          {/* Dynamic Trend Analysis */}
          {trendAnalysis && (
            <div className="p-3 bg-gray-50 dark:bg-gray-950 rounded-lg">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {trendAnalysis}
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
