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
import { calculateAttemptImprovement } from "@/utils/analytics/primary";
import { profileRole } from "@/utils/drizzle/schema";
import { getAllCohorts } from "@/utils/queries/cohorts/get-all-cohorts";
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
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface AttemptImprovementProps {
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
  showPractice: boolean;
  showNormal: boolean;
}

export default function AttemptImprovement({
  dateStart,
  dateEnd,
  profileId,
  cohortIds,
  thresholds,
  selectedRoles,
  showPractice,
  showNormal,
}: AttemptImprovementProps) {
  const [selectedSimulations, setSelectedSimulations] = useState<Simulation[]>(
    []
  );

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

  const { data: rubrics } = useQuery({
    queryKey: ["rubrics"],
    queryFn: () => getAllRubrics(),
  });

  // Helper function to check if a profile is in any of the specified cohorts
  const isProfileInCohorts = useMemo(() => {
    if (!cohortIds || cohortIds.length === 0) return () => true;
    if (!cohorts) return () => false;

    return (profileId: string) => {
      return cohorts.some(
        (cohort) =>
          cohort.profileIds.includes(profileId) && cohortIds.includes(cohort.id)
      );
    };
  }, [cohortIds, cohorts]);

  // Helper function to check if a simulation is in any of the specified cohorts
  const isSimulationInCohorts = useMemo(() => {
    if (!cohortIds || cohortIds.length === 0) return () => true;
    if (!cohorts) return () => false;

    return (simulationId: string) => {
      return cohorts.some(
        (cohort) =>
          cohort.simulationIds.includes(simulationId) &&
          cohortIds.includes(cohort.id)
      );
    };
  }, [cohortIds, cohorts]);

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

    // Filter by cohorts
    let filtered = simulations.filter((s) => simulationIdsWithData.has(s.id));
    if (cohortIds && cohortIds.length > 0) {
      filtered = filtered.filter((s) => isSimulationInCohorts(s.id));
    }

    return filtered;
  }, [
    simulations,
    grades,
    chats,
    attempts,
    dateStart,
    dateEnd,
    cohortIds,
    isSimulationInCohorts,
  ]);

  // Calculate attempt improvement data
  const improvementData = useMemo(() => {
    if (
      !profiles ||
      !chats ||
      !grades ||
      !attempts ||
      !simulations ||
      !rubrics ||
      !cohorts
    ) {
      return [];
    }

    return calculateAttemptImprovement(
      grades,
      chats,
      attempts,
      simulations,
      rubrics,
      profiles,
      dateStart,
      dateEnd,
      profileId,
      cohorts,
      cohortIds,
      selectedSimulations.map((s) => s.id),
      selectedRoles,
      showPractice,
      showNormal
    );
  }, [
    profiles,
    chats,
    grades,
    attempts,
    simulations,
    rubrics,
    cohorts,
    dateStart,
    dateEnd,
    profileId,
    cohortIds,
    selectedSimulations,
    selectedRoles,
    showPractice,
    showNormal,
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

  // Calculate threshold status based on improvement data
  const getThresholdStatus = () => {
    if (improvementData.length < 2) return "neutral";

    const firstAttempt = improvementData[0];
    const lastAttempt = improvementData[improvementData.length - 1];

    if (!firstAttempt || !lastAttempt) return "neutral";

    const firstScore = firstAttempt["Average Score"];
    const lastScore = lastAttempt["Average Score"];

    if (typeof firstScore !== "number" || typeof lastScore !== "number")
      return "neutral";

    const scoreImprovement = lastScore - firstScore;

    if (scoreImprovement >= thresholds.success) return "success";
    if (scoreImprovement >= thresholds.warning) return "warning";
    return "danger";
  };

  const thresholdStatus = getThresholdStatus();

  // Check if we have any data after cohort filtering
  const hasDataAfterCohortFilter = useMemo(() => {
    if (!cohortIds || cohortIds.length === 0) return true;
    if (!profiles || !cohorts) return false;

    // Check if any profile is in the specified cohorts
    return profiles.some((profile) => isProfileInCohorts(profile.id));
  }, [cohortIds, profiles, cohorts, isProfileInCohorts]);

  if (!hasDataAfterCohortFilter) {
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
          </div>
        </CardHeader>
        <CardContent className="flex items-center justify-center flex-1">
          <p className="text-muted-foreground">
            No data available for the selected cohorts
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!improvementData.length) {
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
        <div className="space-y-3">
          {/* Composed Chart with Secondary Y-Axis for Time */}
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={improvementData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="attempt" className="text-xs" />
                <YAxis
                  className="text-xs"
                  label={{
                    value: "Score & Pass Rate (%)",
                    angle: -90,
                  }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  className="text-xs"
                  label={{
                    value: "Time (minutes)",
                    angle: 90,
                  }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--background))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "6px",
                    color: "black",
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
                  dataKey="Pass Rate"
                  fill="hsl(280, 70%, 50%)"
                  name="Pass Rate"
                  radius={[4, 4, 0, 0]}
                />
                <Line
                  type="monotone"
                  dataKey="Average Time"
                  stroke="hsl(200, 70%, 50%)"
                  strokeWidth={2}
                  dot={{ fill: "hsl(200, 70%, 50%)", strokeWidth: 2, r: 4 }}
                  yAxisId="right"
                  name="Average Time"
                />
              </ComposedChart>
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
