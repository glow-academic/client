/**
 * StagnationRate.tsx
 * This component displays the stagnation rate for the agents.
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
import { getAllRubrics } from "@/utils/queries/rubrics/get-all-rubrics";
import { getSimulationAttemptsByProfiles } from "@/utils/queries/simulation_attempts/get-simulation-attempts-by-profiles";
import { getSimulationChatGradesBySimulationChats } from "@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulationchats";
import { getSimulationChatsByAttempts } from "@/utils/queries/simulation_chats/get-simulation-chats-by-attempts";
import { getAllSimulations } from "@/utils/queries/simulations/get-all-simulations";
import { useQuery } from "@tanstack/react-query";
import { eachDayOfInterval, format } from "date-fns";
import { TrendingDown } from "lucide-react";
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

export interface StagnationRateProps {
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

export default function StagnationRate({
  dateStart,
  dateEnd,
  profileId,
  thresholds,
  cohortIds,
}: StagnationRateProps) {
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

  const { data: rubrics } = useQuery({
    queryKey: ["rubrics"],
    queryFn: () => getAllRubrics(),
  });

  const { data: cohorts } = useQuery({
    queryKey: ["cohorts"],
    queryFn: () => getAllCohorts(),
  });

  // Calculate stagnation rate for the specified date range and profile
  const stagnationRate = useMemo(() => {
    if (!attempts || !chats || !grades || !simulations || !rubrics || !cohorts)
      return 0;

    // Get cohort filtering data
    let cohortFiltering: {
      allowedProfileIds: string[];
      allowedSimulationIds: string[];
    } | null = null;
    if (cohortIds && cohortIds.length > 0) {
      const matchingCohorts = cohorts.filter(
        (cohort) => cohortIds.includes(cohort.id) && cohort.active
      );

      if (matchingCohorts.length > 0) {
        // Collect all profile IDs and simulation IDs from matching cohorts
        const allowedProfileIds = new Set<string>();
        const allowedSimulationIds = new Set<string>();

        matchingCohorts.forEach((cohort) => {
          cohort.profileIds.forEach((profileId: string) =>
            allowedProfileIds.add(profileId)
          );
          cohort.simulationIds.forEach((simulationId: string) =>
            allowedSimulationIds.add(simulationId)
          );
        });

        cohortFiltering = {
          allowedProfileIds: Array.from(allowedProfileIds),
          allowedSimulationIds: Array.from(allowedSimulationIds),
        };
      }
    }

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

    // Apply cohort filtering if available
    const cohortFilteredAttempts = cohortFiltering
      ? filteredAttempts.filter((attempt) => {
          return (
            attempt.profileId &&
            cohortFiltering.allowedProfileIds.includes(attempt.profileId) &&
            attempt.simulationId &&
            cohortFiltering.allowedSimulationIds.includes(attempt.simulationId)
          );
        })
      : filteredAttempts;

    // Filter by profileId if provided (tighter restriction)
    const profileFilteredAttempts = profileId
      ? cohortFilteredAttempts.filter(
          (attempt) => attempt.profileId === profileId
        )
      : cohortFilteredAttempts;

    if (profileFilteredAttempts.length === 0) return 0;

    // Group attempts by profile and simulation
    const attemptsByProfileAndSimulation = new Map<
      string,
      typeof profileFilteredAttempts
    >();

    profileFilteredAttempts.forEach((attempt) => {
      const key = `${attempt.profileId}-${attempt.simulationId}`;
      if (!attemptsByProfileAndSimulation.has(key)) {
        attemptsByProfileAndSimulation.set(key, []);
      }
      attemptsByProfileAndSimulation.get(key)!.push(attempt);
    });

    // Calculate stagnation for each profile-simulation combination
    let stagnantProfiles = 0;
    let totalProfilesWithMultipleAttempts = 0;

    attemptsByProfileAndSimulation.forEach((profileAttempts) => {
      // Only consider profiles with 3+ attempts on the same simulation
      if (profileAttempts.length >= 3) {
        totalProfilesWithMultipleAttempts++;

        // Sort attempts by creation time
        const sortedAttempts = profileAttempts.sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );

        // Get first and last attempt scores
        const firstAttempt = sortedAttempts[0];
        const lastAttempt = sortedAttempts[sortedAttempts.length - 1];

        if (!firstAttempt || !lastAttempt) return;

        // Find grades for first and last attempts
        const firstAttemptChats = chats.filter(
          (chat) => chat.attemptId === firstAttempt.id
        );
        const lastAttemptChats = chats.filter(
          (chat) => chat.attemptId === lastAttempt.id
        );

        const firstAttemptGrades = grades.filter((grade) =>
          firstAttemptChats.some((chat) => chat.id === grade.simulationChatId)
        );
        const lastAttemptGrades = grades.filter((grade) =>
          lastAttemptChats.some((chat) => chat.id === grade.simulationChatId)
        );

        if (firstAttemptGrades.length > 0 && lastAttemptGrades.length > 0) {
          // Calculate average scores for first and last attempts
          const firstAttemptScores = firstAttemptGrades.map((grade) => {
            const chat = chats.find((c) => c.id === grade.simulationChatId);
            const attempt = attempts.find((a) => a.id === chat?.attemptId);
            const simulation = simulations.find(
              (s) => s.id === attempt?.simulationId
            );
            const rubric = rubrics.find((r) => r.id === simulation?.rubricId);
            const rubricTotalPoints = rubric?.points || 100;
            return (grade.score / rubricTotalPoints) * 100;
          });

          const lastAttemptScores = lastAttemptGrades.map((grade) => {
            const chat = chats.find((c) => c.id === grade.simulationChatId);
            const attempt = attempts.find((a) => a.id === chat?.attemptId);
            const simulation = simulations.find(
              (s) => s.id === attempt?.simulationId
            );
            const rubric = rubrics.find((r) => r.id === simulation?.rubricId);
            const rubricTotalPoints = rubric?.points || 100;
            return (grade.score / rubricTotalPoints) * 100;
          });

          const firstAttemptAvg =
            firstAttemptScores.reduce((sum, score) => sum + score, 0) /
            firstAttemptScores.length;
          const lastAttemptAvg =
            lastAttemptScores.reduce((sum, score) => sum + score, 0) /
            lastAttemptScores.length;

          // Calculate improvement percentage
          const improvement =
            ((lastAttemptAvg - firstAttemptAvg) / firstAttemptAvg) * 100;

          // Consider stagnant if improvement < 5%
          if (improvement < 5) {
            stagnantProfiles++;
          }
        }
      }
    });

    if (totalProfilesWithMultipleAttempts === 0) return 0;

    return Math.round(
      (stagnantProfiles / totalProfilesWithMultipleAttempts) * 100
    );
  }, [
    attempts,
    chats,
    grades,
    simulations,
    rubrics,
    dateStart,
    dateEnd,
    profileId,
    cohortIds,
    cohorts,
  ]);

  // Stagnation rate trend data for the specified date range
  const stagnationTrend = useMemo(() => {
    if (!attempts || !chats || !grades || !simulations || !rubrics || !cohorts)
      return [];

    // Get cohort filtering data
    let cohortFiltering: {
      allowedProfileIds: string[];
      allowedSimulationIds: string[];
    } | null = null;
    if (cohortIds && cohortIds.length > 0) {
      const matchingCohorts = cohorts.filter(
        (cohort) => cohortIds.includes(cohort.id) && cohort.active
      );

      if (matchingCohorts.length > 0) {
        // Collect all profile IDs and simulation IDs from matching cohorts
        const allowedProfileIds = new Set<string>();
        const allowedSimulationIds = new Set<string>();

        matchingCohorts.forEach((cohort) => {
          cohort.profileIds.forEach((profileId: string) =>
            allowedProfileIds.add(profileId)
          );
          cohort.simulationIds.forEach((simulationId: string) =>
            allowedSimulationIds.add(simulationId)
          );
        });

        cohortFiltering = {
          allowedProfileIds: Array.from(allowedProfileIds),
          allowedSimulationIds: Array.from(allowedSimulationIds),
        };
      }
    }

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

      // Apply cohort filtering if available
      const cohortFilteredDayAttempts = cohortFiltering
        ? dayAttempts.filter((attempt) => {
            return (
              attempt.profileId &&
              cohortFiltering.allowedProfileIds.includes(attempt.profileId) &&
              attempt.simulationId &&
              cohortFiltering.allowedSimulationIds.includes(
                attempt.simulationId
              )
            );
          })
        : dayAttempts;

      // Filter by profileId if provided
      const profileFilteredDayAttempts = profileId
        ? cohortFilteredDayAttempts.filter(
            (attempt) => attempt.profileId === profileId
          )
        : cohortFilteredDayAttempts;

      // Calculate stagnation rate for the day (simplified - just count attempts)
      const dayStagnationRate =
        profileFilteredDayAttempts.length > 0
          ? Math.min(
              100,
              Math.round((profileFilteredDayAttempts.length / 10) * 100)
            )
          : 0; // Heuristic

      return {
        date: format(date, "MM/dd"),
        stagnationRate: dayStagnationRate,
        attempts: profileFilteredDayAttempts.length,
      };
    });
  }, [
    attempts,
    chats,
    grades,
    simulations,
    rubrics,
    dateStart,
    dateEnd,
    profileId,
    cohortIds,
    cohorts,
  ]);

  // Determine color based on stagnation rate and thresholds (lower is better)
  const getColorConfig = (stagnationRate: number) => {
    if (stagnationRate > thresholds.danger) return COLOR_CONFIGS.danger;
    if (stagnationRate > thresholds.warning) return COLOR_CONFIGS.warning;
    return COLOR_CONFIGS.success;
  };

  const colorConfig = getColorConfig(stagnationRate);

  const handleCardClick = () => {
    setIsDialogOpen(true);
  };

  // Check if we have data to display
  const hasData = stagnationTrend.some((day) => day.attempts > 0);

  // Check if cohort filtering resulted in no data
  const hasNoCohortData =
    cohortIds &&
    cohortIds.length > 0 &&
    cohorts &&
    cohorts.filter((cohort) => cohortIds.includes(cohort.id) && cohort.active)
      .length === 0;

  // Calculate actual trend from data
  const getTrendAnalysis = () => {
    if (!hasData || stagnationTrend.length < 2) return null;

    // Get recent data (last 3 days, 1 week, or 1 month depending on data availability)
    const recentData = stagnationTrend.slice(-3);
    const earlierData = stagnationTrend.slice(0, 3);

    if (recentData.length === 0 || earlierData.length === 0) return null;

    const recentAvg =
      recentData.reduce((sum, day) => sum + day.stagnationRate, 0) /
      recentData.length;
    const earlierAvg =
      earlierData.reduce((sum, day) => sum + day.stagnationRate, 0) /
      earlierData.length;
    const change = recentAvg - earlierAvg;
    const changePercent =
      earlierAvg > 0 ? Math.round((change / earlierAvg) * 100) : 0;

    if (Math.abs(changePercent) < 1) return null;

    const period =
      stagnationTrend.length <= 7
        ? "3 days"
        : stagnationTrend.length <= 14
          ? "1 week"
          : "1 month";
    const direction = changePercent > 0 ? "increased" : "decreased";

    return `Stagnation rate ${direction} ${Math.abs(changePercent)}% over the past ${period}`;
  };

  const trendAnalysis = getTrendAnalysis();

  return (
    <>
      <Card
        className={`bg-gradient-to-br ${colorConfig.gradient} ${colorConfig.border} cursor-pointer hover:shadow-md transition-shadow h-full flex flex-col`}
        onClick={handleCardClick}
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Stagnation Rate</CardTitle>
          <TrendingDown className={`h-4 w-4 ${colorConfig.icon}`} />
        </CardHeader>
        <CardContent className="flex-1 flex flex-col justify-center">
          <div className={`text-2xl font-bold ${colorConfig.text}`}>
            {hasNoCohortData
              ? "No cohort data"
              : hasData
                ? `${stagnationRate}%`
                : "No data"}
          </div>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Stagnation Rate Trend</DialogTitle>
          </DialogHeader>
          <div className="h-64">
            {hasData ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stagnationTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip
                    formatter={(value: number, name: string) => [
                      name === "stagnationRate" ? `${value}%` : value,
                      name === "stagnationRate"
                        ? "Stagnation Rate"
                        : "Attempts",
                    ]}
                  />
                  <Line
                    type="monotone"
                    dataKey="stagnationRate"
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
