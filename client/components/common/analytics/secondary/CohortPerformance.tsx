/**
 * CohortPerformance.tsx
 * This component displays the cohort performance for the personas.
 * @AshokSaravanan222 & @siladiea
 * 07/23/2025
 */
"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { getAllCohorts } from "@/utils/queries/cohorts/get-all-cohorts";
import { getAllProfiles } from "@/utils/queries/profiles/get-all-profiles";
import { getSimulationAttemptsByProfiles } from "@/utils/queries/simulation_attempts/get-simulation-attempts-by-profiles";
import { getSimulationChatGradesBySimulationChats } from "@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulationchats";
import { getSimulationChatsByAttempts } from "@/utils/queries/simulation_chats/get-simulation-chats-by-attempts";
import { getAllSimulations } from "@/utils/queries/simulations/get-all-simulations";
import { useQuery } from "@tanstack/react-query";
import { format, isAfter, isBefore, startOfDay } from "date-fns";
import { BarChart3, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface CohortPerformanceProps {
  dateStart: Date;
  dateEnd: Date;
  profileId?: string;
  thresholds: {
    danger: number;
    warning: number;
    success: number;
  };
}

export default function CohortPerformance({
  dateStart,
  dateEnd,
  profileId,
  thresholds,
}: CohortPerformanceProps) {
  const [selectedCohort, setSelectedCohort] = useState<string | null>(null);

  // Fetch data
  const { data: cohorts } = useQuery({
    queryKey: ["cohorts"],
    queryFn: () => getAllCohorts(),
  });

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

  // Calculate cohort performance data
  const cohortData = useMemo(() => {
    if (
      !cohorts ||
      !profiles ||
      !chats ||
      !grades ||
      !attempts ||
      !simulations
    ) {
      return [];
    }

    // Filter data by date range, exclude practice simulations, and filter by TA role
    const filteredGrades = grades.filter((grade) => {
      const gradeDate = new Date(grade.createdAt);
      const chat = chats.find((c) => c.id === grade.simulationChatId);
      const attempt = attempts.find((a) => a.id === chat?.attemptId);
      const simulation = simulations.find(
        (s) => s.id === attempt?.simulationId
      );
      const profile = profiles?.find((p) => p.id === attempt?.profileId);

      // Check date range
      const inDateRange =
        isAfter(gradeDate, dateStart) && isBefore(gradeDate, dateEnd);

      // Exclude practice simulations
      const notPractice = !simulation?.practiceSimulation;

      // Filter by TA role
      const isTA = profile?.role === "ta";

      // Filter by profile if provided
      const profileMatch = profileId ? attempt?.profileId === profileId : true;

      return inDateRange && notPractice && isTA && profileMatch;
    });

    if (filteredGrades.length === 0) return [];

    // Calculate average scores per cohort
    const cohortScores = new Map<string, { scores: number[]; count: number }>();

    // Initialize all cohorts
    cohorts.forEach((cohort) => {
      cohortScores.set(cohort.id, { scores: [], count: 0 });
    });

    // Aggregate scores by cohort
    filteredGrades.forEach((grade) => {
      const chat = chats.find((c) => c.id === grade.simulationChatId);
      const attempt = attempts.find((a) => a.id === chat?.attemptId);
      const profile = profiles?.find((p) => p.id === attempt?.profileId);

      if (!profile) return;

      // Find which cohort this profile belongs to
      const cohort = cohorts.find((c) => c.profileIds.includes(profile.id));

      if (cohort) {
        const cohortData = cohortScores.get(cohort.id);
        if (cohortData) {
          cohortData.scores.push(grade.score);
          cohortData.count++;
        }
      }
    });

    // Calculate averages and create chart data
    const chartData = Array.from(cohortScores.entries())
      .map(([cohortId, data]) => {
        const cohort = cohorts.find((c) => c.id === cohortId);
        const avgScore =
          data.count > 0
            ? Math.round(
                data.scores.reduce((sum, score) => sum + score, 0) /
                  data.scores.length
              )
            : 0;

        return {
          id: cohortId,
          name: cohort?.title || "Unknown Cohort",
          avgScore,
          count: data.count,
          color:
            avgScore >= thresholds.success
              ? "#10b981"
              : avgScore >= thresholds.warning
                ? "#f59e0b"
                : "#ef4444",
        };
      })
      .filter((cohort) => cohort.count > 0) // Only show cohorts with data
      .sort((a, b) => b.avgScore - a.avgScore);

    return chartData;
  }, [
    cohorts,
    profiles,
    chats,
    grades,
    attempts,
    simulations,
    dateStart,
    dateEnd,
    profileId,
    thresholds,
  ]);

  // Get daily performance data for selected cohort
  const dailyData = useMemo(() => {
    if (
      !selectedCohort ||
      !cohorts ||
      !profiles ||
      !chats ||
      !grades ||
      !attempts ||
      !simulations
    ) {
      return [];
    }

    const cohort = cohorts.find((c) => c.id === selectedCohort);
    if (!cohort) return [];

    // Get profiles in this cohort
    const cohortProfiles = profiles.filter(
      (p) => cohort.profileIds.includes(p.id) && p.role === "ta"
    );

    // Filter grades for this cohort in date range
    const cohortGrades = grades.filter((grade) => {
      const gradeDate = new Date(grade.createdAt);
      const chat = chats.find((c) => c.id === grade.simulationChatId);
      const attempt = attempts.find((a) => a.id === chat?.attemptId);
      const simulation = simulations.find(
        (s) => s.id === attempt?.simulationId
      );
      const profile = profiles?.find((p) => p.id === attempt?.profileId);

      // Check if profile is in selected cohort
      const inCohort = cohortProfiles.some((p) => p.id === profile?.id);

      // Check date range
      const inDateRange =
        isAfter(gradeDate, dateStart) && isBefore(gradeDate, dateEnd);

      // Exclude practice simulations
      const notPractice = !simulation?.practiceSimulation;

      // Filter by profile if provided
      const profileMatch = profileId ? attempt?.profileId === profileId : true;

      return inCohort && inDateRange && notPractice && profileMatch;
    });

    if (cohortGrades.length === 0) return [];

    // Group by day and calculate daily averages
    const dailyScores = new Map<string, { scores: number[]; count: number }>();

    cohortGrades.forEach((grade) => {
      const gradeDate = new Date(grade.createdAt);
      const dayKey = format(startOfDay(gradeDate), "yyyy-MM-dd");

      if (!dailyScores.has(dayKey)) {
        dailyScores.set(dayKey, { scores: [], count: 0 });
      }

      const dayData = dailyScores.get(dayKey)!;
      dayData.scores.push(grade.score);
      dayData.count++;
    });

    // Convert to chart data
    const chartData = Array.from(dailyScores.entries())
      .map(([day, data]) => ({
        date: format(new Date(day), "MMM dd"),
        avgScore: Math.round(
          data.scores.reduce((sum, score) => sum + score, 0) /
            data.scores.length
        ),
        count: data.count,
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return chartData;
  }, [
    selectedCohort,
    cohorts,
    profiles,
    chats,
    grades,
    attempts,
    simulations,
    dateStart,
    dateEnd,
    profileId,
  ]);

  // Get actionable insights for selected cohort
  const getCohortInsights = () => {
    if (!dailyData.length || dailyData.length < 2) return null;

    const avgScore =
      dailyData.reduce((sum, day) => sum + day.avgScore, 0) / dailyData.length;

    if (avgScore < thresholds.warning) {
      return `This cohort is performing below expectations (${avgScore}% average). Consider additional training sessions or one-on-one support.`;
    } else if (avgScore >= thresholds.success) {
      return `This cohort is performing excellently (${avgScore}% average). Consider advancing to more challenging scenarios.`;
    }

    return `This cohort is performing adequately (${avgScore}% average). Monitor progress and provide targeted feedback.`;
  };

  if (!cohortData.length) {
    return (
      <Card className="w-full h-full flex flex-col">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Cohort Performance
          </CardTitle>
          <CardDescription>Average scores by cohort</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center flex-1">
          <p className="text-muted-foreground">
            No cohort data available for the selected time period.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full h-full flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Cohort Performance
        </CardTitle>
        <CardDescription>Average scores by cohort</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden">
        <div className="space-y-6">
          {/* Bar Chart */}
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cohortData} layout="horizontal">
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis type="number" domain={[0, 100]} className="text-xs" />
                <YAxis
                  dataKey="name"
                  type="category"
                  width={120}
                  className="text-xs"
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--background))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "6px",
                  }}
                  formatter={(value: number) => [`${value}%`, "Average Score"]}
                />
                <Bar dataKey="avgScore" fill="#3b82f6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Cohort Details Dialog */}
          {cohortData.map((cohort) => (
            <Dialog key={cohort.id}>
              <DialogTrigger asChild>
                <div
                  className="p-4 border rounded-lg cursor-pointer hover:bg-muted transition-colors"
                  onClick={() => setSelectedCohort(cohort.id)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">{cohort.name}</h4>
                      <p className="text-sm text-muted-foreground">
                        {cohort.count} attempts • {cohort.avgScore}% average
                      </p>
                    </div>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>{cohort.name} Performance Details</DialogTitle>
                  <DialogDescription>
                    Daily performance trends and insights
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-6">
                  {/* Daily Performance Line Chart */}
                  {dailyData.length > 0 && (
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={dailyData}>
                          <CartesianGrid
                            strokeDasharray="3 3"
                            className="stroke-muted"
                          />
                          <XAxis dataKey="date" className="text-xs" />
                          <YAxis domain={[0, 100]} className="text-xs" />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "hsl(var(--background))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: "6px",
                            }}
                            formatter={(value: number) => [
                              `${value}%`,
                              "Average Score",
                            ]}
                          />
                          <Line
                            type="monotone"
                            dataKey="avgScore"
                            stroke="#3b82f6"
                            strokeWidth={2}
                            dot={{ r: 4 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {/* Actionable Insights */}
                  {getCohortInsights() && (
                    <div className="p-4 bg-muted rounded-lg">
                      <p className="text-sm text-muted-foreground">
                        {getCohortInsights()}
                      </p>
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
