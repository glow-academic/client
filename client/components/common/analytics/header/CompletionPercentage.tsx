/**
 * CompletionPercentage.tsx
 * This component displays the completion percentage for the agents.
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
import { Target } from "lucide-react";
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

export interface CompletionPercentageProps {
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

export default function CompletionPercentage({
  dateStart,
  dateEnd,
  profileId,
  thresholds,
  cohortIds,
}: CompletionPercentageProps) {
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
      cohortIds.includes(cohort.id),
    );

    if (filteredCohorts.length === 0) {
      return []; // No matching cohorts, no data allowed
    }

    // If profileId is provided, check if profile belongs to any of the filtered cohorts
    if (profileId) {
      const profileInCohorts = filteredCohorts.some((cohort) =>
        cohort.profileIds.includes(profileId),
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

  // Calculate completion percentage for the specified date range and profile
  const completionPercentage = useMemo(() => {
    if (!chats || !grades || !attempts || !simulations) return 0;

    // Filter chats by date range
    const filteredChats = chats.filter((chat) => {
      const chatDate = new Date(chat.createdAt);
      return chatDate >= dateStart && chatDate <= dateEnd;
    });

    // Filter by profileId if provided and exclude practice simulations
    const profileFilteredChats = profileId
      ? filteredChats.filter((chat) => {
          const attempt = attempts?.find((a) => a.id === chat.attemptId);
          return attempt?.profileId === profileId;
        })
      : filteredChats;

    // Filter out practice simulations
    let nonPracticeChats = profileFilteredChats.filter((chat) => {
      const attempt = attempts?.find((a) => a.id === chat.attemptId);
      const simulation = simulations?.find(
        (s) => s.id === attempt?.simulationId,
      );
      return !simulation?.practiceSimulation;
    });

    // Apply cohort filtering if simulation IDs are restricted
    if (getAllowedSimulationIds !== null) {
      if (getAllowedSimulationIds.length === 0) {
        return 0; // No data allowed due to cohort restrictions
      }

      nonPracticeChats = nonPracticeChats.filter((chat) => {
        const attempt = attempts?.find((a) => a.id === chat.attemptId);
        return getAllowedSimulationIds.includes(attempt?.simulationId || "");
      });
    }

    if (nonPracticeChats.length === 0) return 0;

    // Count chats with passing grades
    const passingChats = nonPracticeChats.filter((chat) => {
      const chatGrade = grades.find(
        (grade) => grade.simulationChatId === chat.id,
      );
      return chatGrade?.passed === true;
    });

    return Math.round((passingChats.length / nonPracticeChats.length) * 100);
  }, [
    chats,
    grades,
    attempts,
    simulations,
    dateStart,
    dateEnd,
    profileId,
    getAllowedSimulationIds,
  ]);

  // Completion trend data for the specified date range
  const completionTrend = useMemo(() => {
    if (!chats || !grades || !attempts || !simulations) return [];

    // Get all days in the date range
    const days = eachDayOfInterval({ start: dateStart, end: dateEnd });

    return days.map((date) => {
      const dateStr = format(date, "yyyy-MM-dd");

      // Filter chats for this specific day
      const dayChats = chats.filter((chat) => {
        const chatDate = format(new Date(chat.createdAt), "yyyy-MM-dd");
        return chatDate === dateStr;
      });

      // Filter by profileId if provided and exclude practice simulations
      const profileFilteredDayChats = profileId
        ? dayChats.filter((chat) => {
            const attempt = attempts?.find((a) => a.id === chat.attemptId);
            return attempt?.profileId === profileId;
          })
        : dayChats;

      // Filter out practice simulations
      let nonPracticeDayChats = profileFilteredDayChats.filter((chat) => {
        const attempt = attempts?.find((a) => a.id === chat.attemptId);
        const simulation = simulations?.find(
          (s) => s.id === attempt?.simulationId,
        );
        return !simulation?.practiceSimulation;
      });

      // Apply cohort filtering if simulation IDs are restricted
      if (getAllowedSimulationIds !== null) {
        if (getAllowedSimulationIds.length === 0) {
          return {
            date: format(date, "MM/dd"),
            rate: 0,
            total: 0,
          };
        }

        nonPracticeDayChats = nonPracticeDayChats.filter((chat) => {
          const attempt = attempts?.find((a) => a.id === chat.attemptId);
          return getAllowedSimulationIds.includes(attempt?.simulationId || "");
        });
      }

      // Calculate completion percentage for the day
      let completionRate = 0;
      if (nonPracticeDayChats.length > 0) {
        const passingDayChats = nonPracticeDayChats.filter((chat) => {
          const chatGrade = grades.find(
            (grade) => grade.simulationChatId === chat.id,
          );
          return chatGrade?.passed === true;
        });
        completionRate = Math.round(
          (passingDayChats.length / nonPracticeDayChats.length) * 100,
        );
      }

      return {
        date: format(date, "MM/dd"),
        rate: completionRate,
        total: nonPracticeDayChats.length,
      };
    });
  }, [
    chats,
    grades,
    attempts,
    simulations,
    dateStart,
    dateEnd,
    profileId,
    getAllowedSimulationIds,
  ]);

  // Determine color based on completion percentage and thresholds
  const getColorConfig = (percentage: number) => {
    if (percentage < thresholds.danger) return COLOR_CONFIGS.danger;
    if (percentage < thresholds.warning) return COLOR_CONFIGS.warning;
    return COLOR_CONFIGS.success;
  };

  const colorConfig = getColorConfig(completionPercentage);

  const handleCardClick = () => {
    setIsDialogOpen(true);
  };

  // Check if we have data to display
  const hasData = completionTrend.some((day) => day.total > 0);

  // Calculate actual trend from data
  const getTrendAnalysis = () => {
    if (!hasData || completionTrend.length < 2) return null;

    // Get recent data (last 3 days, 1 week, or 1 month depending on data availability)
    const recentData = completionTrend.slice(-3);
    const earlierData = completionTrend.slice(0, 3);

    if (recentData.length === 0 || earlierData.length === 0) return null;

    const recentAvg =
      recentData.reduce((sum, day) => sum + day.rate, 0) / recentData.length;
    const earlierAvg =
      earlierData.reduce((sum, day) => sum + day.rate, 0) / earlierData.length;
    const change = recentAvg - earlierAvg;
    const changePercent =
      earlierAvg > 0 ? Math.round((change / earlierAvg) * 100) : 0;

    if (Math.abs(changePercent) < 1) return null;

    const period =
      completionTrend.length <= 7
        ? "3 days"
        : completionTrend.length <= 14
          ? "1 week"
          : "1 month";
    const direction = changePercent > 0 ? "increased" : "decreased";

    return `Completion percentage ${direction} ${Math.abs(changePercent)}% over the past ${period}`;
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
            Completion Percentage
          </CardTitle>
          <Target className={`h-4 w-4 ${colorConfig.icon}`} />
        </CardHeader>
        <CardContent className="flex-1 flex flex-col justify-center">
          <div className={`text-2xl font-bold ${colorConfig.text}`}>
            {hasData ? `${completionPercentage}%` : "No data"}
          </div>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Completion Percentage Trend</DialogTitle>
          </DialogHeader>
          <div className="h-64">
            {hasData ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={completionTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip
                    formatter={(value: number, name: string) => [
                      name === "rate" ? `${value}%` : value,
                      name === "rate" ? "Completion Rate" : "Total Sessions",
                    ]}
                  />
                  <Line
                    type="monotone"
                    dataKey="rate"
                    stroke={colorConfig.primary}
                    strokeWidth={2}
                    dot={{ r: 4 }}
                  />
                </LineChart>
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
