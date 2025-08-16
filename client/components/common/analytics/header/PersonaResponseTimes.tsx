/**
 * PersonaResponseTimes.tsx
 * This component displays the response times for the personas.
 * @AshokSaravanan222 & @siladiea
 * 07/23/2025
 */
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SimulationFilter } from "@/contexts/analytics-context";
import { calculatePersonaResponseTimes } from "@/utils/analytics/header";
import { profileRole } from "@/utils/drizzle/schema";
import { getAllCohorts } from "@/utils/queries/cohorts/get-all-cohorts";
import { getAllProfiles } from "@/utils/queries/profiles/get-all-profiles";
import { getSimulationAttemptsByProfiles } from "@/utils/queries/simulation_attempts/get-simulation-attempts-by-profiles";
import { getSimulationChatsByAttempts } from "@/utils/queries/simulation_chats/get-simulation-chats-by-attempts";
import { getSimulationMessagesByChats } from "@/utils/queries/simulation_messages/get-simulation-messages-by-chats";
import { getAllSimulations } from "@/utils/queries/simulations/get-all-simulations";
import { useQuery } from "@tanstack/react-query";
import { Clock } from "lucide-react";
import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface PersonaResponseTimesProps {
  dateStart: Date;
  dateEnd: Date;
  thresholds: {
    danger: number;
    warning: number;
    success: number;
  };
  profileId: string | undefined;
  cohortIds: string[];
  selectedRoles: (typeof profileRole.enumValues)[number][];
  simulationFilters: SimulationFilter[];
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

export default function PersonaResponseTimes({
  dateStart,
  dateEnd,
  profileId,
  thresholds,
  cohortIds,
  selectedRoles,
  simulationFilters,
}: PersonaResponseTimesProps) {
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

  const { data: chats } = useQuery({
    queryKey: ["simulationChats", attempts?.map((attempt) => attempt.id)],
    queryFn: () =>
      getSimulationChatsByAttempts(attempts!.map((attempt) => attempt.id)),
    enabled: !!attempts && attempts.length > 0,
  });

  const { data: messages } = useQuery({
    queryKey: ["simulationMessages", chats?.map((chat) => chat.id)],
    queryFn: () => getSimulationMessagesByChats(chats!.map((chat) => chat.id)),
    enabled: !!chats && chats.length > 0,
  });

  const { data: simulations } = useQuery({
    queryKey: ["simulations"],
    queryFn: () => getAllSimulations(),
  });

  const { data: cohorts } = useQuery({
    queryKey: ["cohorts"],
    queryFn: () => getAllCohorts(),
  });

  // Calculate average response time using utility function
  const responseTimeResult = useMemo(() => {
    if (!messages || !chats || !attempts || !simulations || !cohorts) {
      return { currentValue: 0, trendData: [], hasData: false };
    }

    return calculatePersonaResponseTimes(
      messages,
      chats,
      attempts,
      simulations,
      dateStart,
      dateEnd,
      profileId,
      cohorts,
      cohortIds,
      selectedRoles,
      simulationFilters,
      profiles?.map((p) => ({ id: p.id, role: p.role }))
    );
  }, [
    messages,
    chats,
    attempts,
    simulations,
    cohorts,
    dateStart,
    dateEnd,
    profileId,
    cohortIds,
    selectedRoles,
    simulationFilters,
    profiles,
  ]);

  const {
    currentValue: averageResponseTime,
    trendData: responseTimeTrend,
    hasData: hasDataAvailable,
  } = responseTimeResult;

  // Determine color based on response time and thresholds (lower is better)
  const getColorConfig = (responseTime: number) => {
    if (responseTime > thresholds.danger) return COLOR_CONFIGS.danger;
    if (responseTime > thresholds.warning) return COLOR_CONFIGS.warning;
    return COLOR_CONFIGS.success;
  };

  const colorConfig = getColorConfig(averageResponseTime);

  const handleCardClick = () => {
    setIsDialogOpen(true);
  };

  // Check if cohort filtering resulted in no data
  const hasNoCohortData =
    cohortIds &&
    cohortIds.length > 0 &&
    cohorts &&
    cohorts.filter((cohort) => cohortIds.includes(cohort.id) && cohort.active)
      .length === 0;

  // Calculate actual trend from data
  const getTrendAnalysis = () => {
    if (!hasDataAvailable || responseTimeTrend.length < 2) return null;

    // Get recent data (last 3 days, 1 week, or 1 month depending on data availability)
    const recentData = responseTimeTrend.slice(-3);
    const earlierData = responseTimeTrend.slice(0, 3);

    if (recentData.length === 0 || earlierData.length === 0) return null;

    const recentAvg =
      recentData.reduce((sum, day) => sum + day.value, 0) / recentData.length;
    const earlierAvg =
      earlierData.reduce((sum, day) => sum + day.value, 0) / earlierData.length;
    const change = recentAvg - earlierAvg;
    const changePercent =
      earlierAvg > 0 ? Math.round((change / earlierAvg) * 100) : 0;

    if (Math.abs(changePercent) < 1) return null;

    const period =
      responseTimeTrend.length <= 7
        ? "3 days"
        : responseTimeTrend.length <= 14
          ? "1 week"
          : "1 month";
    const direction = changePercent > 0 ? "increased" : "decreased";

    return `Response time ${direction} ${Math.abs(changePercent)}% over the past ${period}`;
  };

  const trendAnalysis = getTrendAnalysis();

  // Format response time for display
  const formatResponseTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  return (
    <>
      <Card
        className={`bg-gradient-to-br ${colorConfig.gradient} ${colorConfig.border} cursor-pointer hover:shadow-md transition-shadow h-full flex flex-col`}
        onClick={handleCardClick}
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Persona Response Times
          </CardTitle>
          <Clock className={`h-4 w-4 ${colorConfig.icon}`} />
        </CardHeader>
        <CardContent className="flex-1 flex flex-col justify-center">
          <div className={`text-2xl font-bold ${colorConfig.text}`}>
            {hasNoCohortData
              ? "No cohort data"
              : hasDataAvailable
                ? formatResponseTime(averageResponseTime)
                : "No data"}
          </div>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Persona Response Time Trend</DialogTitle>
            <DialogDescription hidden>
              This chart shows the persona response time over time.
            </DialogDescription>
          </DialogHeader>
          <div className="h-64">
            {hasDataAvailable ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={responseTimeTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip
                    formatter={(value: number, name: string) => [
                      name === "value" ? formatResponseTime(value) : value,
                      name === "value" ? "Avg Response Time" : "Interactions",
                    ]}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke={colorConfig.primary}
                    strokeWidth={2}
                    dot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                {hasNoCohortData
                  ? "No data available for the selected cohorts"
                  : `No data available for the selected date range${profileId ? " and profile" : ""}`}
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
