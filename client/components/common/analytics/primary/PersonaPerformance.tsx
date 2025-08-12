/**
 * PersonaPerformance.tsx
 * This component displays the performance for the personas.
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
import { cn } from "@/lib/utils";
import { calculatePersonaPerformance } from "@/utils/analytics/primary";
import { profileRole } from "@/utils/drizzle/schema";
import { getAllCohorts } from "@/utils/queries/cohorts/get-all-cohorts";
import { getAllPersonas } from "@/utils/queries/personas/get-all-personas";
import { getAllProfiles } from "@/utils/queries/profiles/get-all-profiles";
import { getAllRubrics } from "@/utils/queries/rubrics/get-all-rubrics";
import { getAllScenarios } from "@/utils/queries/scenarios/get-all-scenarios";
import { getSimulationAttemptsByProfiles } from "@/utils/queries/simulation_attempts/get-simulation-attempts-by-profiles";
import { getSimulationChatGradesBySimulationChats } from "@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulationchats";
import { getSimulationChatsByAttempts } from "@/utils/queries/simulation_chats/get-simulation-chats-by-attempts";
import { getAllSimulations } from "@/utils/queries/simulations/get-all-simulations";
import { useQuery } from "@tanstack/react-query";

import { Users } from "lucide-react";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface PersonaPerformanceProps {
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
  showGeneral: boolean;
}

export default function PersonaPerformance({
  dateStart,
  dateEnd,
  profileId,
  cohortIds,
  thresholds,
  selectedRoles,
  showPractice,
}: PersonaPerformanceProps) {
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

  const { data: personas } = useQuery({
    queryKey: ["personas"],
    queryFn: () => getAllPersonas(),
  });

  const { data: scenarios } = useQuery({
    queryKey: ["scenarios"],
    queryFn: () => getAllScenarios(),
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

  // Map persona name -> hex color from personas table
  const personaColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    if (personas && personas.length > 0) {
      for (const persona of personas) {
        if (persona?.name && persona?.color) {
          map[persona.name] = persona.color;
        }
      }
    }
    return map;
  }, [personas]);

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

  // Get simulations that have data (simplified logic)
  const simulationsWithData = useMemo(() => {
    if (!simulations) return [];

    // Filter by cohorts first
    let filtered = simulations.filter((s) => !s.practiceSimulation);
    if (cohortIds && cohortIds.length > 0) {
      filtered = filtered.filter((s) => isSimulationInCohorts(s.id));
    }

    return filtered;
  }, [simulations, cohortIds, isSimulationInCohorts]);

  // Calculate performance by persona
  const performanceData = useMemo(() => {
    if (
      !personas ||
      !scenarios ||
      !chats ||
      !grades ||
      !attempts ||
      !simulations ||
      !rubrics
    ) {
      return [];
    }

    return calculatePersonaPerformance(
      grades || [],
      chats || [],
      attempts || [],
      simulations || [],
      rubrics || [],
      profiles || [],
      personas || [],
      scenarios || [],
      dateStart,
      dateEnd,
      profileId,
      cohorts || [],
      cohortIds,
      selectedSimulations.map((s) => s.id),
      selectedRoles,
      showPractice
    );
  }, [
    personas,
    scenarios,
    chats,
    grades,
    attempts,
    simulations,
    rubrics,
    profiles,
    dateStart,
    dateEnd,
    profileId,
    selectedSimulations,
    selectedRoles,
    showPractice,
    cohorts,
    cohortIds,
  ]);

  // Calculate threshold status based on persona performance data
  const getThresholdStatus = () => {
    if (performanceData.length === 0) return "neutral";

    // Calculate average score across all personas
    const avgScore =
      performanceData.reduce((sum, persona) => sum + persona.score, 0) /
      performanceData.length;

    if (avgScore >= thresholds.success) return "success";
    if (avgScore >= thresholds.warning) return "warning";
    return "danger";
  };

  const thresholdStatus = getThresholdStatus();

  // Get background color based on performance thresholds
  const getBackgroundColor = (score: number) => {
    if (score >= thresholds.success) return "bg-green-50 dark:bg-green-950";
    if (score >= thresholds.warning) return "bg-yellow-50 dark:bg-yellow-950";
    return "bg-red-50 dark:bg-red-950";
  };

  // Get actionable insights
  const getActionableInsights = (trendData: Array<{ score: number }>) => {
    if (trendData.length < 2) return null;

    const recentScores = trendData.slice(-3);
    const earlierScores = trendData.slice(0, 3);

    if (recentScores.length === 0 || earlierScores.length === 0) return null;

    const recentAvg =
      recentScores.reduce((sum, item) => sum + item.score, 0) /
      recentScores.length;
    const earlierAvg =
      earlierScores.reduce((sum, item) => sum + item.score, 0) /
      earlierScores.length;
    const improvement = recentAvg - earlierAvg;

    if (improvement > 5) {
      return "Performance has improved significantly. Consider advancing to more challenging scenarios.";
    } else if (improvement < -5) {
      return "Performance has declined. Review training approach for this persona type.";
    }

    return null;
  };

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
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Persona Performance
          </CardTitle>
          <CardDescription>
            Performance analysis by student persona type
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center flex-1">
          <p className="text-muted-foreground">
            No data available for the selected cohorts
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!performanceData.length) {
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
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Persona Performance
          </CardTitle>
          <CardDescription>
            Performance analysis by student persona type
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center flex-1">
          <p className="text-muted-foreground">
            No performance data found for the selected date range
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
              <Users className="h-5 w-5" />
              Persona Performance
            </CardTitle>
            <CardDescription>
              Performance analysis by student persona type
            </CardDescription>
          </div>
          {simulations && simulations.length > 0 && (
            <SimulationPicker
              simulations={(simulationsWithData.length > 0
                ? simulationsWithData
                : simulations
              ).map((s) => ({
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
        <div className="grid gap-6 md:grid-cols-2 h-full">
          {/* Horizontal Bar Chart */}
          <div
            className="h-full"
            style={
              process.env.NODE_ENV === "test"
                ? { minWidth: 400, minHeight: 300 }
                : undefined
            }
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={performanceData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis type="number" domain={[0, 100]} className="text-xs" />
                <YAxis
                  dataKey="name"
                  type="category"
                  width={80}
                  className="text-xs"
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--background))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "6px",
                  }}
                  formatter={(value: number) => [`${value}%`, "Average Score"]}
                  labelFormatter={(label) => `${label} Students`}
                />
                <Bar
                  dataKey="score"
                  radius={[0, 4, 4, 0]}
                  name="Average Score"
                  className="cursor-pointer"
                >
                  {performanceData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={personaColorMap[entry.name] ?? "#999999"}
                      className="hover:opacity-80 transition-opacity"
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Persona Cards */}
          <div className="space-y-4 overflow-y-auto">
            {performanceData.map((persona) => (
              <Dialog key={persona.name}>
                <DialogTrigger asChild>
                  <div
                    className={cn(
                      "flex items-center justify-between p-4 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors",
                      getBackgroundColor(persona.score)
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={cn("w-4 h-4 rounded-full")}
                        style={{
                          backgroundColor:
                            personaColorMap[persona.name] ?? "#999999",
                        }}
                      />
                      <div>
                        <p className="font-medium">{persona.name} Student</p>
                        <p className="text-sm text-muted-foreground">
                          {persona.sessions} sessions
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold">{persona.score}%</p>
                    </div>
                  </div>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <div
                        className={cn("w-4 h-4 rounded-full")}
                        style={{
                          backgroundColor:
                            personaColorMap[persona.name] ?? "#999999",
                        }}
                      />
                      {persona.name} Student Performance
                    </DialogTitle>
                    <DialogDescription hidden>
                      This chart shows the persona performance over time.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-6">
                    {/* Performance Trend Chart */}
                    <div
                      className="h-64"
                      style={
                        process.env.NODE_ENV === "test"
                          ? { minWidth: 400, minHeight: 300 }
                          : undefined
                      }
                    >
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={persona.trendData}>
                          <CartesianGrid
                            strokeDasharray="3 3"
                            className="stroke-muted"
                          />
                          <XAxis
                            dataKey="date"
                            className="text-xs"
                            angle={-45}
                            textAnchor="end"
                            height={60}
                          />
                          <YAxis className="text-xs" domain={[0, 100]} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "hsl(var(--background))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: "6px",
                            }}
                            formatter={(value: number) => [
                              `${value}%`,
                              "Score",
                            ]}
                          />
                          <Line
                            type="monotone"
                            dataKey="score"
                            stroke={personaColorMap[persona.name] ?? "#999999"}
                            strokeWidth={2}
                            dot={{ r: 4 }}
                            name="Score"
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Actionable Insights */}
                    {getActionableInsights(persona.trendData) && (
                      <div className="p-3 bg-muted rounded-lg">
                        <p className="text-sm text-muted-foreground">
                          {getActionableInsights(persona.trendData)}
                        </p>
                      </div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
