/**
 * CohortPerformance.tsx
 * This component displays the cohort performance for the personas.
 * @AshokSaravanan222 & @siladiea
 * 07/23/2025
 */
"use client";

import {
  SimulationPicker,
  type Simulation,
} from "@/components/common/cohort/SimulationPicker";
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
import { SimulationFilter } from "@/contexts/analytics-context";
import { calculateCohortPerformance } from "@/utils/analytics/secondary";
import { profileRole } from "@/utils/drizzle/schema";
import { getAllCohorts } from "@/utils/queries/cohorts/get-all-cohorts";
import { getAllProfiles } from "@/utils/queries/profiles/get-all-profiles";
import { getAllRubrics } from "@/utils/queries/rubrics/get-all-rubrics";
import { getSimulationAttemptsByProfiles } from "@/utils/queries/simulation_attempts/get-simulation-attempts-by-profiles";
import { getSimulationChatGradesBySimulationChats } from "@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulationchats";
import { getSimulationChatsByAttempts } from "@/utils/queries/simulation_chats/get-simulation-chats-by-attempts";
import { getAllSimulations } from "@/utils/queries/simulations/get-all-simulations";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, TrendingUp } from "lucide-react";
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

export interface CohortPerformanceProps {
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

export default function CohortPerformance({
  dateStart,
  dateEnd,
  profileId,
  thresholds,
  cohortIds,
  selectedRoles,
  simulationFilters,
}: CohortPerformanceProps) {
  const [selectedSimulations, setSelectedSimulations] = useState<Simulation[]>(
    []
  );

  // Fetch data
  const { data: allCohorts } = useQuery({
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

  const { data: rubrics } = useQuery({
    queryKey: ["rubrics"],
    queryFn: () => getAllRubrics(),
  });

  // Use the utility function to calculate cohort performance
  const cohortPerformanceResult = useMemo(() => {
    if (
      !allCohorts ||
      !profiles ||
      !chats ||
      !grades ||
      !attempts ||
      !simulations ||
      !rubrics
    ) {
      return null;
    }

    return calculateCohortPerformance(
      allCohorts,
      profiles,
      chats,
      grades,
      attempts,
      simulations,
      rubrics,
      dateStart,
      dateEnd,
      thresholds,
      profileId,
      cohortIds,
      selectedSimulations.map((s) => s.id),
      selectedRoles,
      simulationFilters
    );
  }, [
    allCohorts,
    profiles,
    chats,
    grades,
    attempts,
    simulations,
    rubrics,
    dateStart,
    dateEnd,
    profileId,
    cohortIds,
    selectedSimulations,
    thresholds,
    selectedRoles,
    simulationFilters,
  ]);

  // Get simulations that have data available
  const simulationsWithData = useMemo(() => {
    if (!simulations || !grades || !chats || !attempts) return [];

    // Get all simulation IDs that have grades in the date range
    const simulationIdsWithData = new Set<string>();

    grades.forEach((grade) => {
      const gradeDate = new Date(grade.createdAt);
      const chat = chats.find((c) => c.id === grade.simulationChatId);
      const attempt = attempts.find((a) => a.id === chat?.attemptId);

      if (!attempt) return;

      // Check date range
      const inDateRange = gradeDate >= dateStart && gradeDate <= dateEnd;

      if (inDateRange) {
        simulationIdsWithData.add(attempt.simulationId);
      }
    });

    return simulations.filter((s) => simulationIdsWithData.has(s.id));
  }, [simulations, grades, chats, attempts, dateStart, dateEnd]);

  // Calculate threshold status based on cohort performance data
  const getThresholdStatus = () => {
    if (!cohortPerformanceResult || !cohortPerformanceResult.hasData)
      return "neutral";

    // Calculate average pass rate across all cohorts
    const avgPassRate =
      cohortPerformanceResult.cohortData.reduce(
        (sum, cohort) => sum + cohort.passRate,
        0
      ) / cohortPerformanceResult.cohortData.length;

    if (avgPassRate >= thresholds.success) return "success";
    if (avgPassRate >= thresholds.warning) return "warning";
    return "danger";
  };

  const thresholdStatus = getThresholdStatus();

  // Show no access message if user doesn't have access to any cohorts
  if (!cohortPerformanceResult?.hasData) {
    return (
      <Card className="w-full h-full flex flex-col relative">
        <div
          className={`absolute top-2 right-2 w-2 h-2 rounded-full ${
            thresholdStatus === "success"
              ? "bg-green-500"
              : thresholdStatus === "warning"
                ? "bg-yellow-500"
                : thresholdStatus === "danger"
                  ? "bg-red-500"
                  : "bg-gray-400"
          }`}
        />
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart3 className="h-4 w-4" />
                Cohort Performance
              </CardTitle>
              <CardDescription className="text-xs">
                Pass rates by cohort
              </CardDescription>
            </div>
            {simulationsWithData && simulationsWithData.length > 0 && (
              <SimulationPicker
                simulations={simulationsWithData.map((s) => ({
                  id: s.id,
                  title: s.title,
                  timeLimit: s.timeLimit || undefined,
                  active: s.active,
                  defaultSimulation: s.defaultSimulation,
                  practiceSimulation: s.practiceSimulation,
                }))}
                placeholder="Filter by simulation..."
                onSelect={setSelectedSimulations}
                selectedSimulations={selectedSimulations}
                hideSelectedChips={true}
                showLabel={false}
              />
            )}
          </div>
        </CardHeader>
        <CardContent className="flex items-center justify-center flex-1 p-3">
          <p className="text-muted-foreground text-sm">
            No cohort data available for the selected time period.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full h-full flex flex-col relative">
      <div
        className={`absolute top-2 right-2 w-2 h-2 rounded-full ${
          thresholdStatus === "success"
            ? "bg-green-500"
            : thresholdStatus === "warning"
              ? "bg-yellow-500"
              : thresholdStatus === "danger"
                ? "bg-red-500"
                : "bg-gray-400"
        }`}
      />
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-4 w-4" />
              Cohort Performance
            </CardTitle>
            <CardDescription className="text-xs">
              Pass rates by cohort
            </CardDescription>
          </div>
          {simulationsWithData && simulationsWithData.length > 0 && (
            <SimulationPicker
              simulations={simulationsWithData.map((s) => ({
                id: s.id,
                title: s.title,
                timeLimit: s.timeLimit || undefined,
                active: s.active,
                defaultSimulation: s.defaultSimulation,
                practiceSimulation: s.practiceSimulation,
              }))}
              placeholder="Filter by simulation..."
              onSelect={setSelectedSimulations}
              selectedSimulations={selectedSimulations}
              hideSelectedChips={true}
              showLabel={false}
            />
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-3">
        <div className="space-y-4">
          {/* Cohort Details Dialog */}
          {cohortPerformanceResult.cohortData.map((cohort) => {
            // Calculate pass rate percentage
            const passRatePercentage =
              (cohort.passedStudents / cohort.totalStudents) * 100;

            // Determine background color based on pass rate
            let bgColor: string;
            if (passRatePercentage === 0) {
              bgColor = "#ef4444"; // Red for 0%
            } else if (passRatePercentage >= thresholds.success) {
              bgColor = "#22c55e"; // Green for success
            } else if (passRatePercentage >= thresholds.warning) {
              bgColor = "#eab308"; // Yellow for warning
            } else {
              bgColor = "#ef4444"; // Red for danger
            }

            return (
              <Dialog key={cohort.id}>
                <DialogTrigger asChild>
                  <div className="p-2 border rounded-md cursor-pointer hover:bg-muted transition-colors relative overflow-hidden">
                    {/* Progress bar background */}
                    <div
                      className="absolute inset-0 opacity-10"
                      style={{ backgroundColor: bgColor }}
                    />

                    {/* Progress bar fill */}
                    <div
                      className="absolute inset-y-0 left-0 opacity-20 transition-all duration-300"
                      style={{
                        backgroundColor: bgColor,
                        width: `${Math.max(passRatePercentage, 1)}%`, // Minimum 1% width for visibility
                      }}
                    />

                    <div className="flex items-center justify-between relative z-10">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm truncate">
                          {cohort.name}
                        </h4>
                        <p className="text-xs text-muted-foreground">
                          {passRatePercentage.toFixed(2)}% of students pass{" "}
                          {selectedSimulations.length} quiz
                          {selectedSimulations.length !== 1 ? "zes" : ""} with a{" "}
                          {Math.round(
                            (cohort.rubricPassPoints / cohort.rubricPoints) *
                              100
                          )}
                          % or better
                        </p>
                      </div>
                      <TrendingUp className="h-3 w-3 text-muted-foreground ml-2 flex-shrink-0" />
                    </div>
                  </div>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>{cohort.name} Performance Details</DialogTitle>
                    <DialogDescription hidden>
                      Daily pass rate trends and insights
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-6">
                    {/* Daily Performance Line Chart */}
                    {cohortPerformanceResult.dailyData.length > 0 && (
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={cohortPerformanceResult.dailyData}>
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
                    {cohortPerformanceResult.insights && (
                      <div className="p-4 bg-muted rounded-lg">
                        <p className="text-sm text-muted-foreground">
                          {cohortPerformanceResult.insights}
                        </p>
                      </div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
