/**
 * AttemptImprovement.tsx
 * This component displays the attempt improvement for the personas.
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
import { getAllProfiles } from "@/utils/queries/profiles/get-all-profiles";
import { getAllRubrics } from "@/utils/queries/rubrics/get-all-rubrics";
import { getSimulationAttemptsByProfiles } from "@/utils/queries/simulation_attempts/get-simulation-attempts-by-profiles";
import { getSimulationChatGradesBySimulationChats } from "@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulationchats";
import { getSimulationChatsByAttempts } from "@/utils/queries/simulation_chats/get-simulation-chats-by-attempts";
import { getAllSimulations } from "@/utils/queries/simulations/get-all-simulations";
import { useQuery } from "@tanstack/react-query";
import { isAfter, isBefore } from "date-fns";
import { TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface AttemptImprovementProps {
  dateStart: Date;
  dateEnd: Date;
  profileId?: string;
}

export default function AttemptImprovement({
  dateStart,
  dateEnd,
  profileId,
}: AttemptImprovementProps) {
  const [selectedSimulations, setSelectedSimulations] = useState<Simulation[]>(
    []
  );

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

  // Calculate attempt improvement data
  const improvementData = useMemo(() => {
    if (
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

    // Group attempts by simulation and profile
    const simulationAttempts = new Map<
      string,
      {
        simulationId: string;
        profileId: string;
        attempts: Array<{
          attemptId: string;
          attemptNumber: number;
          score: number;
          timeTaken: number;
          passed: boolean;
          createdAt: Date;
        }>;
      }
    >();

    // Group attempts by simulation and profile
    attempts.forEach((attempt) => {
      const chat = chats.find((c) => c.attemptId === attempt.id);
      const grade = filteredGrades.find((g) => g.simulationChatId === chat?.id);

      if (!chat || !grade) return;

      const simulation = filteredSimulations.find(
        (s) => s.id === attempt.simulationId
      );
      if (!simulation) return;

      const key = `${attempt.simulationId}-${attempt.profileId || "unknown"}`;

      if (!simulationAttempts.has(key)) {
        simulationAttempts.set(key, {
          simulationId: attempt.simulationId,
          profileId: attempt.profileId || "unknown",
          attempts: [],
        });
      }

      const simulationData = simulationAttempts.get(key);
      if (!simulationData) return;

      // Calculate score percentage
      const rubric = rubrics.find((r) => r.id === simulation.rubricId);
      const rubricTotalPoints = rubric?.points || 100;
      const scorePercent = Math.round((grade.score / rubricTotalPoints) * 100);

      simulationData.attempts.push({
        attemptId: attempt.id,
        attemptNumber: simulationData.attempts.length + 1,
        score: scorePercent,
        timeTaken: grade.timeTaken,
        passed: grade.passed,
        createdAt: new Date(grade.createdAt),
      });
    });

    // Filter to only include simulations with multiple attempts
    const multiAttemptSimulations = Array.from(simulationAttempts.values())
      .filter((sim) => sim.attempts.length > 1)
      .sort((a, b) => {
        const aFirst = a.attempts[0];
        const bFirst = b.attempts[0];
        if (!aFirst || !bFirst) return 0;
        return aFirst.createdAt.getTime() - bFirst.createdAt.getTime();
      });

    if (multiAttemptSimulations.length === 0) return [];

    // Calculate average metrics by attempt number
    const maxAttempts = Math.min(
      Math.max(...multiAttemptSimulations.map((sim) => sim.attempts.length)),
      5 // Limit to 5 attempts for clean visualization
    );

    const attemptMetrics = new Map<
      number,
      {
        attemptNumber: number;
        scores: number[];
        times: number[];
        passRates: number[];
        count: number;
      }
    >();

    // Initialize attempt metrics
    for (let i = 1; i <= maxAttempts; i++) {
      attemptMetrics.set(i, {
        attemptNumber: i,
        scores: [],
        times: [],
        passRates: [],
        count: 0,
      });
    }

    // Aggregate data by attempt number
    multiAttemptSimulations.forEach((sim) => {
      sim.attempts.slice(0, maxAttempts).forEach((attempt) => {
        const metrics = attemptMetrics.get(attempt.attemptNumber);
        if (metrics) {
          metrics.scores.push(attempt.score);
          metrics.times.push(attempt.timeTaken / 60); // Convert to minutes
          metrics.passRates.push(attempt.passed ? 100 : 0);
          metrics.count++;
        }
      });
    });

    // Calculate averages and create chart data
    const chartData = Array.from(attemptMetrics.values())
      .filter((metrics) => metrics.count > 0)
      .map((metrics) => {
        const avgScore = Math.round(
          metrics.scores.reduce((sum, score) => sum + score, 0) /
            metrics.scores.length
        );
        const avgTime = Math.round(
          metrics.times.reduce((sum, time) => sum + time, 0) /
            metrics.times.length
        );
        const avgPassRate = Math.round(
          metrics.passRates.reduce((sum, rate) => sum + rate, 0) /
            metrics.passRates.length
        );

        return {
          attempt: `Attempt ${metrics.attemptNumber}`,
          "Average Score": avgScore,
          "Average Time": avgTime,
          "Pass Rate": avgPassRate,
        };
      });

    return chartData;
  }, [
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

  // Get actionable insights
  const getActionableInsights = () => {
    if (improvementData.length < 2) return null;

    // Get first and last attempts to check improvement
    const firstAttempt = improvementData[0];
    const lastAttempt = improvementData[improvementData.length - 1];

    if (!firstAttempt || !lastAttempt) return null;

    const firstScore = firstAttempt["Average Score"];
    const lastScore = lastAttempt["Average Score"];

    if (typeof firstScore !== "number" || typeof lastScore !== "number")
      return null;

    const scoreImprovement = lastScore - firstScore;

    if (scoreImprovement > 5) {
      return `Users improve by ${scoreImprovement}% on average between attempts. Consider advancing to more challenging scenarios.`;
    } else if (scoreImprovement < -5) {
      return `Performance declined by ${Math.abs(scoreImprovement)}% between attempts. Review training approach.`;
    }

    return null;
  };

  if (!improvementData.length) {
    return (
      <Card className="w-full h-full flex flex-col">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Attempt Improvement
              </CardTitle>
              <CardDescription>
                Performance improvement across multiple attempts
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
                buttonClassName="w-48"
              />
            )}
          </div>
        </CardHeader>
        <CardContent className="flex items-center justify-center flex-1">
          <p className="text-muted-foreground">
            No improvement data available. Multiple attempts required.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full h-full flex flex-col">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Attempt Improvement
            </CardTitle>
            <CardDescription>
              Performance improvement across multiple attempts
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
              buttonClassName="w-48"
            />
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden">
        <div className="space-y-6">
          {/* Grouped Bar Chart */}
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={improvementData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="attempt" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--background))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "6px",
                  }}
                  formatter={(value: number, name: string) => [
                    name === "Average Time" ? `${value} min` : `${value}%`,
                    name,
                  ]}
                />
                <Legend />
                <Bar
                  dataKey="Average Score"
                  fill="hsl(120, 70%, 50%)"
                  name="Average Score"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="Average Time"
                  fill="hsl(200, 70%, 50%)"
                  name="Average Time"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="Pass Rate"
                  fill="hsl(280, 70%, 50%)"
                  name="Pass Rate"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Actionable Insights */}
          {getActionableInsights() && (
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">
                {getActionableInsights()}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
