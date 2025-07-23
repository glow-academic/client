/**
 * HighestScore.tsx
 * This component displays the highest score for the agents.
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
import { Trophy } from "lucide-react";
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

export interface HighestScoreProps {
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

export default function HighestScore({
  dateStart,
  dateEnd,
  profileId,
  thresholds,
}: HighestScoreProps) {
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

  // Calculate highest score for the specified date range and profile
  const highestScore = useMemo(() => {
    if (!grades || !attempts || !chats || !simulations || !rubrics) return 0;

    // Filter grades by date range and exclude practice simulations
    const filteredGrades = grades.filter((grade) => {
      const gradeDate = new Date(grade.createdAt);
      const chat = chats.find((c) => c.id === grade.simulationChatId);
      const attempt = attempts.find((a) => a.id === chat?.attemptId);
      const simulation = simulations.find(
        (s) => s.id === attempt?.simulationId
      );
      return (
        gradeDate >= dateStart &&
        gradeDate <= dateEnd &&
        !simulation?.practiceSimulation
      );
    });

    // Filter by profileId if provided
    const profileFilteredGrades = profileId
      ? filteredGrades.filter((grade) => {
          const chat = chats.find((c) => c.id === grade.simulationChatId);
          const attempt = attempts.find((a) => a.id === chat?.attemptId);
          return attempt?.profileId === profileId;
        })
      : filteredGrades;

    if (profileFilteredGrades.length === 0) return 0;

    // Calculate scores using rubric points and find the highest
    const scores = profileFilteredGrades.map((grade) => {
      const chat = chats.find((c) => c.id === grade.simulationChatId);
      const attempt = attempts.find((a) => a.id === chat?.attemptId);
      const simulation = simulations.find(
        (s) => s.id === attempt?.simulationId
      );
      const rubric = rubrics.find((r) => r.id === simulation?.rubricId);
      const rubricTotalPoints = rubric?.points || 100;
      return Math.round((grade.score / rubricTotalPoints) * 100);
    });

    return Math.max(...scores);
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

  // Highest score trend data for the specified date range
  const highestScoreTrend = useMemo(() => {
    if (!grades || !attempts || !chats || !simulations || !rubrics) return [];

    // Get all days in the date range
    const days = eachDayOfInterval({ start: dateStart, end: dateEnd });

    return days.map((date) => {
      const dateStr = format(date, "yyyy-MM-dd");

      // Filter grades for this specific day and exclude practice simulations
      const dayGrades = grades.filter((grade) => {
        const gradeDate = format(new Date(grade.createdAt), "yyyy-MM-dd");
        const chat = chats.find((c) => c.id === grade.simulationChatId);
        const attempt = attempts.find((a) => a.id === chat?.attemptId);
        const simulation = simulations.find(
          (s) => s.id === attempt?.simulationId
        );
        return gradeDate === dateStr && !simulation?.practiceSimulation;
      });

      // Filter by profileId if provided
      const profileFilteredDayGrades = profileId
        ? dayGrades.filter((grade) => {
            const chat = chats.find((c) => c.id === grade.simulationChatId);
            const attempt = attempts.find((a) => a.id === chat?.attemptId);
            return attempt?.profileId === profileId;
          })
        : dayGrades;

      // Calculate highest score for the day using rubric points
      let dayHighestScore = 0;
      if (profileFilteredDayGrades.length > 0) {
        const dayScores = profileFilteredDayGrades.map((grade) => {
          const chat = chats.find((c) => c.id === grade.simulationChatId);
          const attempt = attempts.find((a) => a.id === chat?.attemptId);
          const simulation = simulations.find(
            (s) => s.id === attempt?.simulationId
          );
          const rubric = rubrics.find((r) => r.id === simulation?.rubricId);
          const rubricTotalPoints = rubric?.points || 100;
          return Math.round((grade.score / rubricTotalPoints) * 100);
        });
        dayHighestScore = Math.max(...dayScores);
      }

      return {
        date: format(date, "MM/dd"),
        score: dayHighestScore,
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

  const colorConfig = getColorConfig(highestScore);

  const handleCardClick = () => {
    setIsDialogOpen(true);
  };

  // Check if we have data to display
  const hasData = highestScoreTrend.some((day) => day.sessions > 0);

  return (
    <>
      <Card
        className={`bg-gradient-to-br ${colorConfig.gradient} ${colorConfig.border} cursor-pointer hover:shadow-md transition-shadow`}
        onClick={handleCardClick}
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Highest Score</CardTitle>
          <Trophy className={`h-4 w-4 ${colorConfig.icon}`} />
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${colorConfig.text}`}>
            {hasData ? `${highestScore}%` : "No data"}
          </div>
          <p className={`text-xs ${colorConfig.accent} mt-1`}>
            {format(dateStart, "MMM d")} - {format(dateEnd, "MMM d, yyyy")}
            {profileId && " • Individual"}
          </p>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Highest Score Trend</DialogTitle>
          </DialogHeader>
          <div className="h-64">
            {hasData ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={highestScoreTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip
                    formatter={(value: number, name: string) => [
                      name === "score" ? `${value}%` : value,
                      name === "score" ? "Highest Score" : "Sessions",
                    ]}
                  />
                  <Bar
                    dataKey="score"
                    fill={colorConfig.primary}
                    name="score"
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
        </DialogContent>
      </Dialog>
    </>
  );
}
