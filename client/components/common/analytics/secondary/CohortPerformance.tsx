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
import { getAllCohorts } from "@/utils/queries/cohorts/get-all-cohorts";
import { getAllProfiles } from "@/utils/queries/profiles/get-all-profiles";
import { getAllRubrics } from "@/utils/queries/rubrics/get-all-rubrics";
import { getSimulationAttemptsByProfiles } from "@/utils/queries/simulation_attempts/get-simulation-attempts-by-profiles";
import { getSimulationChatGradesBySimulationChats } from "@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulationchats";
import { getSimulationChatsByAttempts } from "@/utils/queries/simulation_chats/get-simulation-chats-by-attempts";
import { getAllSimulations } from "@/utils/queries/simulations/get-all-simulations";
import { useQuery } from "@tanstack/react-query";
import { format, isAfter, isBefore, startOfDay } from "date-fns";
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
}

export default function CohortPerformance({
  dateStart,
  dateEnd,
  profileId,
  thresholds,
  cohortIds,
}: CohortPerformanceProps) {
  const [selectedCohort, setSelectedCohort] = useState<string | null>(null);
  const [selectedSimulations, setSelectedSimulations] = useState<Simulation[]>(
    []
  );

  // Fetch data
  const { data: allCohorts } = useQuery({
    queryKey: ["cohorts"],
    queryFn: () => getAllCohorts(),
  });

  // Filter cohorts based on cohortIds and profileId
  const filteredCohorts = useMemo(() => {
    if (!allCohorts) return [];

    let availableCohorts = allCohorts;

    // If profileId is provided, filter to cohorts that contain this profile
    if (profileId) {
      availableCohorts = availableCohorts.filter((cohort) =>
        cohort.profileIds.includes(profileId)
      );
    }

    // If cohortIds are provided, filter to only those cohorts
    if (cohortIds && cohortIds.length > 0) {
      availableCohorts = availableCohorts.filter((cohort) =>
        cohortIds.includes(cohort.id)
      );
    }

    return availableCohorts;
  }, [allCohorts, profileId, cohortIds]);

  // Check if user has access to any cohorts
  const hasCohortAccess = useMemo(() => {
    return filteredCohorts.length > 0;
  }, [filteredCohorts]);

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

  // Filter simulations based on selection
  const filteredSimulations = useMemo(() => {
    if (!simulations) return [];
    if (selectedSimulations.length === 0) return simulations;
    return simulations.filter((s) =>
      selectedSimulations.some((ss) => ss.id === s.id)
    );
  }, [simulations, selectedSimulations]);

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
      const inDateRange =
        isAfter(gradeDate, dateStart) && isBefore(gradeDate, dateEnd);

      if (inDateRange) {
        simulationIdsWithData.add(attempt.simulationId);
      }
    });

    return simulations.filter((s) => simulationIdsWithData.has(s.id));
  }, [simulations, grades, chats, attempts, dateStart, dateEnd]);

  // Calculate cohort performance data
  const cohortData = useMemo(() => {
    if (
      !filteredCohorts ||
      !profiles ||
      !chats ||
      !grades ||
      !attempts ||
      !filteredSimulations ||
      !rubrics
    ) {
      return [];
    }

    // Filter data by date range, exclude practice simulations, filter by TA role, and filter by selected simulations
    const filteredGrades = grades.filter((grade) => {
      const gradeDate = new Date(grade.createdAt);
      const chat = chats.find((c) => c.id === grade.simulationChatId);
      const attempt = attempts.find((a) => a.id === chat?.attemptId);
      const simulation = filteredSimulations.find(
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

      // Filter by selected simulations
      const simulationMatch =
        selectedSimulations.length === 0 ||
        (simulation &&
          selectedSimulations.some((ss) => ss.id === simulation.id));

      return (
        inDateRange && notPractice && isTA && profileMatch && simulationMatch
      );
    });

    if (filteredGrades.length === 0) return [];

    // Calculate pass rates per cohort
    const cohortStats = new Map<
      string,
      {
        totalAttempts: number;
        passedAttempts: number;
        totalStudents: Set<string>;
        passedStudents: Set<string>;
        totalScores: number[];
        rubricPoints: number;
        rubricPassPoints: number;
        // Track which simulations each student has passed
        studentSimulationPasses: Map<string, Set<string>>;
        // Track which simulations are available for this cohort
        availableSimulations: Set<string>;
      }
    >();

    // Initialize all filtered cohorts
    filteredCohorts.forEach((cohort) => {
      cohortStats.set(cohort.id, {
        totalAttempts: 0,
        passedAttempts: 0,
        totalStudents: new Set(),
        passedStudents: new Set(),
        totalScores: [],
        rubricPoints: 0,
        rubricPassPoints: 0,
        studentSimulationPasses: new Map(),
        availableSimulations: new Set(),
      });
    });

    // Aggregate data by cohort
    filteredGrades.forEach((grade) => {
      const chat = chats.find((c) => c.id === grade.simulationChatId);
      const attempt = attempts.find((a) => a.id === chat?.attemptId);
      const profile = profiles?.find((p) => p.id === attempt?.profileId);
      const rubric = rubrics?.find((r) => r.id === grade.rubricId);
      const simulation = filteredSimulations.find(
        (s) => s.id === attempt?.simulationId
      );

      if (!profile || !rubric || !simulation) return;

      // Find which cohort this profile belongs to
      const cohort = filteredCohorts.find((c) =>
        c.profileIds.includes(profile.id)
      );

      if (cohort) {
        const cohortData = cohortStats.get(cohort.id);
        if (cohortData) {
          cohortData.totalAttempts++;
          cohortData.totalStudents.add(profile.id);
          cohortData.totalScores.push(grade.score);
          cohortData.rubricPoints = rubric.points;
          cohortData.rubricPassPoints = rubric.passPoints;
          cohortData.availableSimulations.add(simulation.id);

          // Check if this attempt passed based on rubric pass points
          const passed = grade.score >= rubric.passPoints;
          if (passed) {
            cohortData.passedAttempts++;

            // Track which simulation this student passed
            if (!cohortData.studentSimulationPasses.has(profile.id)) {
              cohortData.studentSimulationPasses.set(profile.id, new Set());
            }
            cohortData.studentSimulationPasses
              .get(profile.id)!
              .add(simulation.id);
          }
        }
      }
    });

    // Calculate which students have passed all simulations in their cohort
    cohortStats.forEach((cohortData, cohortId) => {
      const cohort = filteredCohorts.find((c) => c.id === cohortId);
      if (!cohort) return;

      // Determine which simulations to check based on selection
      const simulationsToCheck =
        selectedSimulations.length > 0
          ? selectedSimulations.map((s) => s.id)
          : cohort.simulationIds; // Use the actual assigned simulations from the cohort

      // For each student in this cohort, check if they've passed all relevant simulations
      cohort.profileIds.forEach((profileId) => {
        const studentPassedSimulations =
          cohortData.studentSimulationPasses.get(profileId) || new Set();

        // Check if student has passed all relevant simulations
        const hasPassedAll = simulationsToCheck.every((simId) =>
          studentPassedSimulations.has(simId)
        );

        if (hasPassedAll) {
          cohortData.passedStudents.add(profileId);
        }
      });
    });

    // Calculate pass rates and create chart data
    const chartData = Array.from(cohortStats.entries())
      .map(([cohortId, data]) => {
        const cohort = filteredCohorts.find((c) => c.id === cohortId);
        const passRate =
          data.totalStudents.size > 0
            ? Math.round(
                (data.passedStudents.size / data.totalStudents.size) * 100
              )
            : 0;

        // Calculate average percentage score (score out of rubric.points)
        const avgPercentageScore =
          data.totalScores.length > 0
            ? Math.round(
                (data.totalScores.reduce((sum, score) => sum + score, 0) /
                  data.totalScores.length /
                  data.rubricPoints) *
                  100
              )
            : 0;

        // Determine color based on pass rate and thresholds
        let color: string;
        if (passRate >= thresholds.success) {
          color = "#10b981"; // Green
        } else if (passRate >= thresholds.warning) {
          color = "#f59e0b"; // Yellow
        } else {
          color = "#ef4444"; // Red
        }

        return {
          id: cohortId,
          name: cohort?.title || "Unknown Cohort",
          passRate,
          avgPercentageScore,
          totalStudents: data.totalStudents.size,
          passedStudents: data.passedStudents.size,
          totalAttempts: data.totalAttempts,
          passedAttempts: data.passedAttempts,
          rubricPoints: data.rubricPoints,
          rubricPassPoints: data.rubricPassPoints,
          availableSimulations: data.availableSimulations.size,
          color,
        };
      })
      .filter((cohort) => cohort.totalStudents > 0) // Only show cohorts with data
      .filter((cohort) => {
        // If simulations are selected, only show cohorts that have those simulations
        if (selectedSimulations.length > 0) {
          return cohort.availableSimulations > 0;
        }
        return true;
      })
      .sort((a, b) => b.passRate - a.passRate);

    return chartData;
  }, [
    filteredCohorts,
    profiles,
    chats,
    grades,
    attempts,
    filteredSimulations,
    rubrics,
    dateStart,
    dateEnd,
    profileId,
    thresholds,
    selectedSimulations,
  ]);

  // Get daily performance data for selected cohort
  const dailyData = useMemo(() => {
    if (
      !selectedCohort ||
      !filteredCohorts ||
      !profiles ||
      !chats ||
      !grades ||
      !attempts ||
      !filteredSimulations ||
      !rubrics
    ) {
      return [];
    }

    const cohort = filteredCohorts.find((c) => c.id === selectedCohort);
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
      const simulation = filteredSimulations.find(
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

      // Filter by selected simulations
      const simulationMatch =
        selectedSimulations.length === 0 ||
        (simulation &&
          selectedSimulations.some((ss) => ss.id === simulation.id));

      return (
        inCohort &&
        inDateRange &&
        notPractice &&
        profileMatch &&
        simulationMatch
      );
    });

    if (cohortGrades.length === 0) return [];

    // Group by day and calculate daily average scores
    const dailyStats = new Map<
      string,
      {
        totalAttempts: number;
        passedAttempts: number;
        totalStudents: Set<string>;
        passedStudents: Set<string>;
        scores: number[];
        rubricPoints: number;
      }
    >();

    cohortGrades.forEach((grade) => {
      const gradeDate = new Date(grade.createdAt);
      const dayKey = format(startOfDay(gradeDate), "yyyy-MM-dd");
      const chat = chats.find((c) => c.id === grade.simulationChatId);
      const attempt = attempts.find((a) => a.id === chat?.attemptId);
      const profile = profiles?.find((p) => p.id === attempt?.profileId);
      const rubric = rubrics?.find((r) => r.id === grade.rubricId);

      if (!profile || !rubric) return;

      if (!dailyStats.has(dayKey)) {
        dailyStats.set(dayKey, {
          totalAttempts: 0,
          passedAttempts: 0,
          totalStudents: new Set(),
          passedStudents: new Set(),
          scores: [],
          rubricPoints: rubric.points,
        });
      }

      const dayData = dailyStats.get(dayKey)!;
      dayData.totalAttempts++;
      dayData.totalStudents.add(profile.id);
      dayData.scores.push(grade.score);

      // Check if this attempt passed based on rubric pass points
      const passed = grade.score >= rubric.passPoints;
      if (passed) {
        dayData.passedAttempts++;
        dayData.passedStudents.add(profile.id);
      }
    });

    // Convert to chart data
    const chartData = Array.from(dailyStats.entries())
      .map(([day, data]) => {
        const avgScore =
          data.scores.length > 0
            ? Math.round(
                (data.scores.reduce((sum, score) => sum + score, 0) /
                  data.scores.length /
                  data.rubricPoints) *
                  100
              )
            : 0;

        const passRate =
          data.totalStudents.size > 0
            ? Math.round(
                (data.passedStudents.size / data.totalStudents.size) * 100
              )
            : 0;

        return {
          date: format(new Date(day), "MMM dd"),
          avgScore,
          passRate,
          totalAttempts: data.totalAttempts,
          passedAttempts: data.passedAttempts,
        };
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return chartData;
  }, [
    selectedCohort,
    filteredCohorts,
    profiles,
    chats,
    grades,
    attempts,
    filteredSimulations,
    rubrics,
    dateStart,
    dateEnd,
    profileId,
    selectedSimulations,
  ]);

  // Get actionable insights for selected cohort
  const getCohortInsights = () => {
    if (!dailyData.length || dailyData.length < 2) return null;

    const avgScore =
      dailyData.reduce((sum, day) => sum + day.avgScore, 0) / dailyData.length;

    if (avgScore < thresholds.warning) {
      return `This cohort is performing below expectations (${avgScore.toFixed(2)}% average score). Consider additional training sessions or one-on-one support.`;
    } else if (avgScore >= thresholds.success) {
      return `This cohort is performing excellently (${avgScore.toFixed(2)}% average score). Consider advancing to more challenging scenarios.`;
    }

    return `This cohort is performing adequately (${avgScore.toFixed(2)}% average score). Monitor progress and provide targeted feedback.`;
  };

  // Calculate threshold status based on cohort performance data
  const getThresholdStatus = () => {
    if (cohortData.length === 0) return "neutral";

    // Calculate average pass rate across all cohorts
    const avgPassRate =
      cohortData.reduce((sum, cohort) => sum + cohort.passRate, 0) /
      cohortData.length;

    if (avgPassRate >= thresholds.success) return "success";
    if (avgPassRate >= thresholds.warning) return "warning";
    return "danger";
  };

  const thresholdStatus = getThresholdStatus();

  // Show no access message if user doesn't have access to any cohorts
  if (!hasCohortAccess) {
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
          </div>
        </CardHeader>
        <CardContent className="flex items-center justify-center flex-1 p-3">
          <div className="text-center text-muted-foreground text-sm">
            <p>No cohort access available</p>
            <p className="text-xs mt-1">
              {profileId
                ? "You don't have access to any of the specified cohorts."
                : "No cohorts match the specified criteria."}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!cohortData.length) {
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
          {cohortData.map((cohort) => {
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
                  <div
                    className="p-2 border rounded-md cursor-pointer hover:bg-muted transition-colors relative overflow-hidden"
                    onClick={() => setSelectedCohort(cohort.id)}
                  >
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
                          {passRatePercentage}% of students pass{" "}
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
                    <DialogDescription>
                      Daily pass rate trends and insights
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
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
