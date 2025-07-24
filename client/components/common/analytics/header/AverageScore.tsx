/**
 * AverageScore.tsx
 * This component displays the average score for the agents.
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
import { getAllRubrics } from "@/utils/queries/rubrics/get-all-rubrics";
import { getSimulationAttemptsByProfiles } from "@/utils/queries/simulation_attempts/get-simulation-attempts-by-profiles";
import { getSimulationChatGradesBySimulationChats } from "@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulationchats";
import { getSimulationChatsByAttempts } from "@/utils/queries/simulation_chats/get-simulation-chats-by-attempts";
import { getAllSimulations } from "@/utils/queries/simulations/get-all-simulations";
import { useQuery } from "@tanstack/react-query";
import { eachDayOfInterval, format } from "date-fns";
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

export interface AverageScoreProps {
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

export default function AverageScore({
  dateStart,
  dateEnd,
  profileId,
  thresholds,
}: AverageScoreProps) {
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

  // Calculate average score for the specified date range and profile
  const averageScore = useMemo(() => {
    if (!grades || !attempts || !chats || !simulations || !rubrics) return 0;

    // Filter grades by date range
    const filteredGrades = grades.filter((grade) => {
      const gradeDate = new Date(grade.createdAt);
      return gradeDate >= dateStart && gradeDate <= dateEnd;
    });

    // Filter by profileId if provided and exclude practice simulations
    const profileFilteredGrades = profileId
      ? filteredGrades.filter((grade) => {
          const chat = chats.find((c) => c.id === grade.simulationChatId);
          const attempt = attempts.find((a) => a.id === chat?.attemptId);
          const simulation = simulations.find(
            (s) => s.id === attempt?.simulationId
          );
          return (
            attempt?.profileId === profileId && !simulation?.practiceSimulation
          );
        })
      : filteredGrades.filter((grade) => {
          const chat = chats.find((c) => c.id === grade.simulationChatId);
          const attempt = attempts.find((a) => a.id === chat?.attemptId);
          const simulation = simulations.find(
            (s) => s.id === attempt?.simulationId
          );
          return !simulation?.practiceSimulation;
        });

    if (profileFilteredGrades.length === 0) return 0;

    // Calculate average score using rubric points
    const scoreSum = profileFilteredGrades.reduce((sum, grade) => {
      const chat = chats.find((c) => c.id === grade.simulationChatId);
      const attempt = attempts.find((a) => a.id === chat?.attemptId);
      const simulation = simulations.find(
        (s) => s.id === attempt?.simulationId
      );
      const rubric = rubrics.find((r) => r.id === simulation?.rubricId);
      const rubricTotalPoints = rubric?.points || 100;
      const scorePercent = Math.round((grade.score / rubricTotalPoints) * 100);
      return sum + scorePercent;
    }, 0);

    return Math.round(scoreSum / profileFilteredGrades.length);
  }, [
    grades,
    attempts,
    chats,
    simulations,
    rubrics,
    dateStart,
    dateEnd,
    profileId,
  ]);

  // Score trend data for the specified date range
  const scoreTrend = useMemo(() => {
    if (!grades || !attempts || !chats || !simulations || !rubrics) return [];

    // Get all days in the date range
    const days = eachDayOfInterval({ start: dateStart, end: dateEnd });

    return days.map((date) => {
      const dateStr = format(date, "yyyy-MM-dd");

      // Filter grades for this specific day
      const dayGrades = grades.filter((grade) => {
        const gradeDate = format(new Date(grade.createdAt), "yyyy-MM-dd");
        return gradeDate === dateStr;
      });

      // Filter by profileId if provided and exclude practice simulations
      const profileFilteredDayGrades = profileId
        ? dayGrades.filter((grade) => {
            const chat = chats.find((c) => c.id === grade.simulationChatId);
            const attempt = attempts.find((a) => a.id === chat?.attemptId);
            const simulation = simulations.find(
              (s) => s.id === attempt?.simulationId
            );
            return (
              attempt?.profileId === profileId &&
              !simulation?.practiceSimulation
            );
          })
        : dayGrades.filter((grade) => {
            const chat = chats.find((c) => c.id === grade.simulationChatId);
            const attempt = attempts.find((a) => a.id === chat?.attemptId);
            const simulation = simulations.find(
              (s) => s.id === attempt?.simulationId
            );
            return !simulation?.practiceSimulation;
          });

      // Calculate average score for the day using rubric points
      let avgScore = 0;
      if (profileFilteredDayGrades.length > 0) {
        const dayScoreSum = profileFilteredDayGrades.reduce((sum, grade) => {
          const chat = chats.find((c) => c.id === grade.simulationChatId);
          const attempt = attempts.find((a) => a.id === chat?.attemptId);
          const simulation = simulations.find(
            (s) => s.id === attempt?.simulationId
          );
          const rubric = rubrics.find((r) => r.id === simulation?.rubricId);
          const rubricTotalPoints = rubric?.points || 100;
          const scorePercent = Math.round(
            (grade.score / rubricTotalPoints) * 100
          );
          return sum + scorePercent;
        }, 0);
        avgScore = Math.round(dayScoreSum / profileFilteredDayGrades.length);
      }

      return {
        date: format(date, "MM/dd"),
        score: avgScore,
        sessions: profileFilteredDayGrades.length,
      };
    });
  }, [
    grades,
    attempts,
    chats,
    simulations,
    rubrics,
    dateStart,
    dateEnd,
    profileId,
  ]);

  // Determine color based on score and thresholds
  const getColorConfig = (score: number) => {
    if (score < thresholds.danger) return COLOR_CONFIGS.danger;
    if (score < thresholds.warning) return COLOR_CONFIGS.warning;
    return COLOR_CONFIGS.success;
  };

  const colorConfig = getColorConfig(averageScore);

  const handleCardClick = () => {
    setIsDialogOpen(true);
  };

  // Check if we have data to display
  const hasData = scoreTrend.some((day) => day.sessions > 0);

  // Calculate actual trend from data
  const getTrendAnalysis = () => {
    if (!hasData || scoreTrend.length < 2) return null;

    // Get recent data (last 3 days, 1 week, or 1 month depending on data availability)
    const recentData = scoreTrend.slice(-3);
    const earlierData = scoreTrend.slice(0, 3);

    if (recentData.length === 0 || earlierData.length === 0) return null;

    const recentAvg =
      recentData.reduce((sum, day) => sum + day.score, 0) / recentData.length;
    const earlierAvg =
      earlierData.reduce((sum, day) => sum + day.score, 0) / earlierData.length;
    const change = recentAvg - earlierAvg;
    const changePercent =
      earlierAvg > 0 ? Math.round((change / earlierAvg) * 100) : 0;

    if (Math.abs(changePercent) < 1) return null;

    const period =
      scoreTrend.length <= 7
        ? "3 days"
        : scoreTrend.length <= 14
          ? "1 week"
          : "1 month";
    const direction = changePercent > 0 ? "increased" : "decreased";

    return `Average score ${direction} ${Math.abs(changePercent)}% over the past ${period}`;
  };

  const trendAnalysis = getTrendAnalysis();

  return (
    <>
      <Card
        className={`bg-gradient-to-br ${colorConfig.gradient} ${colorConfig.border} cursor-pointer hover:shadow-md transition-shadow h-full flex flex-col`}
        onClick={handleCardClick}
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Average Score</CardTitle>
          <TrendingUp className={`h-4 w-4 ${colorConfig.icon}`} />
        </CardHeader>
        <CardContent className="flex-1 flex flex-col justify-center">
          <div className={`text-2xl font-bold ${colorConfig.text}`}>
            {hasData ? `${averageScore}%` : "No data"}
          </div>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Average Score Trend</DialogTitle>
          </DialogHeader>
          <div className="h-64">
            {hasData ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={scoreTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip
                    formatter={(value: number, name: string) => [
                      name === "score" ? `${value}%` : value,
                      name === "score" ? "Average Score" : "Sessions",
                    ]}
                  />
                  <Area
                    type="monotone"
                    dataKey="score"
                    stroke={colorConfig.primary}
                    fill={colorConfig.primary}
                    fillOpacity={0.3}
                    name="score"
                  />
                </AreaChart>
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
