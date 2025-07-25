/**
 * FirstAttemptPassRate.tsx
 * This component displays the first attempt pass rate for the agents.
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
import { getAllCohorts } from "@/utils/queries/cohorts/get-all-cohorts";
import { getAllProfiles } from "@/utils/queries/profiles/get-all-profiles";
import { getSimulationAttemptsByProfiles } from "@/utils/queries/simulation_attempts/get-simulation-attempts-by-profiles";
import { getSimulationChatGradesBySimulationChats } from "@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulationchats";
import { getSimulationChatsByAttempts } from "@/utils/queries/simulation_chats/get-simulation-chats-by-attempts";
import { getAllSimulations } from "@/utils/queries/simulations/get-all-simulations";
import { useQuery } from "@tanstack/react-query";
import { eachDayOfInterval, format } from "date-fns";
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

export interface FirstAttemptPassRateProps {
  dateStart: Date;
  dateEnd: Date;
  thresholds: {
    danger: number;
    warning: number;
    success: number;
  };
  profileId: string | undefined;
  cohortIds: string[];
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

export default function FirstAttemptPassRate({
  dateStart,
  dateEnd,
  profileId,
  thresholds,
  cohortIds,
}: FirstAttemptPassRateProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Fetch data
  const { data: profiles } = useQuery({
    queryKey: ["profiles"],
    queryFn: () => getAllProfiles(),
  });

  const { data: cohorts } = useQuery({
    queryKey: ["cohorts"],
    queryFn: () => getAllCohorts(),
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

  // Helper function to get allowed simulation IDs based on cohort filtering
  const getAllowedSimulationIds = useMemo(() => {
    if (!cohorts || !cohortIds || cohortIds.length === 0) {
      return null; // No cohort filtering, allow all simulations
    }

    // Filter cohorts to only those in cohortIds
    const filteredCohorts = cohorts.filter((cohort) =>
      cohortIds.includes(cohort.id)
    );

    if (filteredCohorts.length === 0) {
      return []; // No matching cohorts, no data allowed
    }

    // If profileId is provided, check if profile belongs to any of the filtered cohorts
    if (profileId) {
      const profileInCohorts = filteredCohorts.some((cohort) =>
        cohort.profileIds.includes(profileId)
      );

      if (!profileInCohorts) {
        return []; // Profile not in any of the specified cohorts, no data allowed
      }
    }

    // Get union of all simulation IDs from matching cohorts
    const allowedSimulationIds = new Set<string>();
    filteredCohorts.forEach((cohort) => {
      cohort.simulationIds.forEach((simId) => {
        if (simId !== "RAY") {
          // Exclude placeholder
          allowedSimulationIds.add(simId);
        }
      });
    });

    return Array.from(allowedSimulationIds);
  }, [cohorts, cohortIds, profileId]);

  // Calculate first attempt pass rate for the specified date range and profile
  const firstAttemptPassRate = useMemo(() => {
    if (!attempts || !chats || !grades || !simulations) return 0;

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
    let profileFilteredAttempts = profileId
      ? filteredAttempts.filter((attempt) => attempt.profileId === profileId)
      : filteredAttempts;

    // Apply cohort filtering if simulation IDs are restricted
    if (getAllowedSimulationIds !== null) {
      if (getAllowedSimulationIds.length === 0) {
        return 0; // No data allowed due to cohort restrictions
      }

      profileFilteredAttempts = profileFilteredAttempts.filter((attempt) =>
        getAllowedSimulationIds.includes(attempt.simulationId)
      );
    }

    if (profileFilteredAttempts.length === 0) return 0;

    // Group attempts by profileId + simulationId to find first attempts
    const firstAttempts = profileFilteredAttempts.reduce(
      (acc, attempt) => {
        const key = `${attempt.profileId}-${attempt.simulationId}`;
        if (
          !acc[key] ||
          new Date(attempt.createdAt) < new Date(acc[key].createdAt)
        ) {
          acc[key] = attempt;
        }
        return acc;
      },
      {} as Record<string, (typeof attempts)[0]>
    );

    const firstAttemptsList = Object.values(firstAttempts);

    // Count first attempts that passed (have at least one chat with passed grade)
    const passedFirstAttempts = firstAttemptsList.filter((attempt) => {
      const attemptChats = chats.filter(
        (chat) => chat.attemptId === attempt.id
      );
      return attemptChats.some((chat) => {
        const chatGrade = grades.find(
          (grade) => grade.simulationChatId === chat.id
        );
        return chatGrade?.passed === true;
      });
    });

    return Math.round(
      (passedFirstAttempts.length / firstAttemptsList.length) * 100
    );
  }, [
    attempts,
    chats,
    grades,
    simulations,
    dateStart,
    dateEnd,
    profileId,
    getAllowedSimulationIds,
  ]);

  // First attempt pass rate trend data for the specified date range
  const passRateTrend = useMemo(() => {
    if (!attempts || !chats || !grades || !simulations) return [];

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
      let profileFilteredDayAttempts = profileId
        ? dayAttempts.filter((attempt) => attempt.profileId === profileId)
        : dayAttempts;

      // Apply cohort filtering if simulation IDs are restricted
      if (getAllowedSimulationIds !== null) {
        if (getAllowedSimulationIds.length === 0) {
          return {
            date: format(date, "MM/dd"),
            passRate: 0,
            total: 0,
          };
        }

        profileFilteredDayAttempts = profileFilteredDayAttempts.filter(
          (attempt) => getAllowedSimulationIds.includes(attempt.simulationId)
        );
      }

      // Group attempts by profileId + simulationId to find first attempts for this day
      const dayFirstAttempts = profileFilteredDayAttempts.reduce(
        (acc, attempt) => {
          const key = `${attempt.profileId}-${attempt.simulationId}`;
          if (
            !acc[key] ||
            new Date(attempt.createdAt) < new Date(acc[key].createdAt)
          ) {
            acc[key] = attempt;
          }
          return acc;
        },
        {} as Record<string, (typeof attempts)[0]>
      );

      const dayFirstAttemptsList = Object.values(dayFirstAttempts);

      // Calculate pass rate for the day
      let passRate = 0;
      if (dayFirstAttemptsList.length > 0) {
        const passedDayFirstAttempts = dayFirstAttemptsList.filter(
          (attempt) => {
            const attemptChats = chats.filter(
              (chat) => chat.attemptId === attempt.id
            );
            return attemptChats.some((chat) => {
              const chatGrade = grades.find(
                (grade) => grade.simulationChatId === chat.id
              );
              return chatGrade?.passed === true;
            });
          }
        );
        passRate = Math.round(
          (passedDayFirstAttempts.length / dayFirstAttemptsList.length) * 100
        );
      }

      return {
        date: format(date, "MM/dd"),
        passRate,
        total: dayFirstAttemptsList.length,
      };
    });
  }, [
    attempts,
    chats,
    grades,
    simulations,
    dateStart,
    dateEnd,
    profileId,
    getAllowedSimulationIds,
  ]);

  // Determine color based on pass rate and thresholds
  const getColorConfig = (rate: number) => {
    if (rate < thresholds.danger) return COLOR_CONFIGS.danger;
    if (rate < thresholds.warning) return COLOR_CONFIGS.warning;
    return COLOR_CONFIGS.success;
  };

  const colorConfig = getColorConfig(firstAttemptPassRate);

  const handleCardClick = () => {
    setIsDialogOpen(true);
  };

  // Check if we have data to display
  const hasData = passRateTrend.some((day) => day.total > 0);

  // Calculate actual trend from data
  const getTrendAnalysis = () => {
    if (!hasData || passRateTrend.length < 2) return null;

    // Get recent data (last 3 days, 1 week, or 1 month depending on data availability)
    const recentData = passRateTrend.slice(-3);
    const earlierData = passRateTrend.slice(0, 3);

    if (recentData.length === 0 || earlierData.length === 0) return null;

    const recentAvg =
      recentData.reduce((sum, day) => sum + day.passRate, 0) /
      recentData.length;
    const earlierAvg =
      earlierData.reduce((sum, day) => sum + day.passRate, 0) /
      earlierData.length;
    const change = recentAvg - earlierAvg;
    const changePercent =
      earlierAvg > 0 ? Math.round((change / earlierAvg) * 100) : 0;

    if (Math.abs(changePercent) < 1) return null;

    const period =
      passRateTrend.length <= 7
        ? "3 days"
        : passRateTrend.length <= 14
          ? "1 week"
          : "1 month";
    const direction = changePercent > 0 ? "increased" : "decreased";

    return `First attempt pass rate ${direction} ${Math.abs(changePercent)}% over the past ${period}`;
  };

  const trendAnalysis = getTrendAnalysis();

  return (
    <>
      <Card
        className={`bg-gradient-to-br ${colorConfig.gradient} ${colorConfig.border} cursor-pointer hover:shadow-md transition-shadow h-full flex flex-col`}
        onClick={handleCardClick}
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            First Attempt Pass Rate
          </CardTitle>
          <Award className={`h-4 w-4 ${colorConfig.icon}`} />
        </CardHeader>
        <CardContent className="flex-1 flex flex-col justify-center">
          <div className={`text-2xl font-bold ${colorConfig.text}`}>
            {hasData ? `${firstAttemptPassRate}%` : "No data"}
          </div>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>First Attempt Pass Rate Trend</DialogTitle>
          </DialogHeader>
          <div className="h-64">
            {hasData ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={passRateTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip
                    formatter={(value: number, name: string) => [
                      name === "passRate" ? `${value}%` : value,
                      name === "passRate"
                        ? "Pass Rate"
                        : "Total First Attempts",
                    ]}
                  />
                  <Bar
                    dataKey="passRate"
                    fill={colorConfig.primary}
                    name="passRate"
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
