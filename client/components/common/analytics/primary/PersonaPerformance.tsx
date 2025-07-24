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
import { getPersonaConfig } from "@/utils/personas";
import { getAllPersonas } from "@/utils/queries/personas/get-all-personas";
import { getAllProfiles } from "@/utils/queries/profiles/get-all-profiles";
import { getAllRubrics } from "@/utils/queries/rubrics/get-all-rubrics";
import { getAllScenarios } from "@/utils/queries/scenarios/get-all-scenarios";
import { getSimulationAttemptsByProfiles } from "@/utils/queries/simulation_attempts/get-simulation-attempts-by-profiles";
import { getSimulationChatGradesBySimulationChats } from "@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulationchats";
import { getSimulationChatsByAttempts } from "@/utils/queries/simulation_chats/get-simulation-chats-by-attempts";
import { getAllSimulations } from "@/utils/queries/simulations/get-all-simulations";
import { useQuery } from "@tanstack/react-query";
import { format, isAfter, isBefore } from "date-fns";
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
  profileId?: string;
  thresholds: {
    danger: number;
    warning: number;
    success: number;
  };
}

export default function PersonaPerformance({
  dateStart,
  dateEnd,
  profileId,
  thresholds,
}: PersonaPerformanceProps) {
  const [selectedSimulations, setSelectedSimulations] = useState<Simulation[]>(
    []
  );

  // Fetch data
  const { data: profiles } = useQuery({
    queryKey: ["profiles"],
    queryFn: () => getAllProfiles(),
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

  // Filter simulations based on selection
  const filteredSimulations = useMemo(() => {
    if (!simulations) return [];
    if (selectedSimulations.length === 0) return simulations;
    return simulations.filter((s) =>
      selectedSimulations.some((ss) => ss.id === s.id)
    );
  }, [simulations, selectedSimulations]);

  // Get simulations that have scenarios with personas (excluding default simulations)
  const simulationsWithData = useMemo(() => {
    if (!simulations || !scenarios || !personas) return [];

    // Get all simulation IDs that have scenarios with personas and are not default simulations
    const simulationIdsWithPersonas = new Set<string>();

    // For each simulation, check if it has scenarios with personas
    simulations.forEach((simulation) => {
      // Get scenarios for this simulation
      const simulationScenarios = scenarios.filter((scenario) =>
        simulation.scenarioIds.includes(scenario.id)
      );

      // Check if any of these scenarios have a persona
      const hasPersonaScenarios = simulationScenarios.some(
        (scenario) =>
          scenario.personaId &&
          personas.some((persona) => persona.id === scenario.personaId)
      );

      if (hasPersonaScenarios) {
        simulationIdsWithPersonas.add(simulation.id);
      }
    });

    return simulations.filter(
      (s) => simulationIdsWithPersonas.has(s.id) && !s.defaultSimulation
    );
  }, [simulations, scenarios, personas]);

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

    // Filter data by date range, exclude practice simulations, and filter by selected simulations
    const filteredGrades = grades.filter((grade) => {
      const gradeDate = new Date(grade.createdAt);
      const chat = chats.find((c) => c.id === grade.simulationChatId);
      const attempt = attempts.find((a) => a.id === chat?.attemptId);
      const simulation = filteredSimulations.find(
        (s) => s.id === attempt?.simulationId
      );

      // Check date range
      const inDateRange =
        isAfter(gradeDate, dateStart) && isBefore(gradeDate, dateEnd);

      // Exclude practice simulations
      const notPractice = !simulation?.practiceSimulation;

      // Filter by profile if provided
      const profileMatch = profileId ? attempt?.profileId === profileId : true;

      // Filter by TA role
      const profile = profiles?.find((p) => p.id === attempt?.profileId);
      const isTA = profile?.role === "ta";

      // Filter by selected simulations
      const simulationMatch =
        selectedSimulations.length === 0 ||
        (simulation &&
          selectedSimulations.some((ss) => ss.id === simulation.id));

      return (
        inDateRange && notPractice && profileMatch && isTA && simulationMatch
      );
    });

    // Group by persona
    const performanceByPersona = personas
      .filter((persona) => persona.name)
      .map((persona) => {
        const personaScenarios = scenarios.filter(
          (s) => s.personaId === persona.id
        );
        const personaChats = chats.filter((chat) =>
          personaScenarios.some((scenario) => scenario.id === chat.scenarioId)
        );
        const personaGrades = filteredGrades.filter((grade) =>
          personaChats.some((chat) => chat.id === grade.simulationChatId)
        );

        // Calculate average score
        let avgScore = 0;
        if (personaGrades.length > 0) {
          const scoreSum = personaGrades.reduce((sum, grade) => {
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
          avgScore = Math.round(scoreSum / personaGrades.length);
        }

        // Calculate trend data for line chart
        const trendData = personaGrades
          .map((grade) => {
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

            return {
              date: format(new Date(grade.createdAt), "MMM dd"),
              score: scorePercent,
              timestamp: new Date(grade.createdAt).getTime(),
            };
          })
          .sort((a, b) => a.timestamp - b.timestamp);

        return {
          name: persona.name,
          score: avgScore,
          sessions: personaGrades.length,
          color: getPersonaConfig(persona.name).colors.bgColor,
          trendData,
        };
      })
      .filter((persona) => persona.sessions > 0) // Only show personas with sessions
      .sort((a, b) => b.score - a.score); // Sort by score descending

    return performanceByPersona;
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
    filteredSimulations,
  ]);

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

  if (!performanceData.length) {
    return (
      <Card className="w-full h-full flex flex-col">
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
    <Card className="w-full h-full flex flex-col">
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
        <div className="grid gap-6 md:grid-cols-2 h-full">
          {/* Horizontal Bar Chart */}
          <div className="h-full">
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
                      fill={
                        getPersonaConfig(entry.name)
                          .colors.bgColor.replace("bg-", "")
                          .split("-")[0]
                      }
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
                        className={cn("w-4 h-4 rounded-full", persona.color)}
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
                        className={cn("w-4 h-4 rounded-full", persona.color)}
                      />
                      {persona.name} Student Performance
                    </DialogTitle>
                    <DialogDescription>
                      Performance trend over the selected period
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-6">
                    {/* Performance Trend Chart */}
                    <div className="h-64">
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
                            stroke={
                              getPersonaConfig(persona.name)
                                .colors.bgColor.replace("bg-", "")
                                .split("-")[0]
                            }
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
