/**
 * SimulationComposition.tsx
 * This component displays the anatomy of high vs low performing simulations.
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
import { getAllProfiles } from "@/utils/queries/profiles/get-all-profiles";
import { getAllScenarios } from "@/utils/queries/scenarios/get-all-scenarios";
import { getSimulationAttemptsByProfiles } from "@/utils/queries/simulation_attempts/get-simulation-attempts-by-profiles";
import { getSimulationChatGradesBySimulationChats } from "@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulationchats";
import { getSimulationChatsByAttempts } from "@/utils/queries/simulation_chats/get-simulation-chats-by-attempts";
import { getAllSimulations } from "@/utils/queries/simulations/get-all-simulations";
import { useQuery } from "@tanstack/react-query";
import { isAfter, isBefore } from "date-fns";
import { BarChart3, TrendingDown, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import SimulationCompositionPicker, {
  SimulationCompositionConfig,
} from "./SimulationCompositionPicker";

export interface SimulationCompositionProps {
  dateStart: Date;
  dateEnd: Date;
  profileId?: string;
}

interface SimulationAttribute {
  id: string;
  name: string;
  icon: string;
  color: string;
  highPerforming: number;
  lowPerforming: number;
  description: string;
}

export default function SimulationComposition({
  dateStart,
  dateEnd,
  profileId,
}: SimulationCompositionProps) {
  // Configuration state
  const [config, setConfig] = useState<SimulationCompositionConfig>({
    method: "percentile",
    topPercentage: 25,
    bottomPercentage: 25,
    description: "Top 25% vs Bottom 25% - Best vs Worst",
  });

  // Fetch data
  const { data: profiles } = useQuery({
    queryKey: ["profiles"],
    queryFn: () => getAllProfiles(),
  });

  const { data: scenarios } = useQuery({
    queryKey: ["scenarios"],
    queryFn: () => getAllScenarios(),
  });

  const { data: simulations } = useQuery({
    queryKey: ["simulations"],
    queryFn: () => getAllSimulations(),
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

  // Calculate simulation composition data
  const simulationComposition = useMemo(() => {
    if (
      !scenarios ||
      !simulations ||
      !chats ||
      !grades ||
      !attempts ||
      !profiles
    ) {
      return { highPerforming: [], lowPerforming: [], attributes: [] };
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

    if (filteredGrades.length === 0) {
      return { highPerforming: [], lowPerforming: [], attributes: [] };
    }

    // Group by simulation and calculate performance
    const simulationPerformance = new Map<
      string,
      {
        simulation: (typeof simulations)[0];
        grades: typeof grades;
        chats: typeof chats;
        avgScore: number;
        completionRate: number;
        totalAttempts: number;
      }
    >();

    filteredGrades.forEach((grade) => {
      const chat = chats.find((c) => c.id === grade.simulationChatId);
      if (!chat) return;

      const attempt = attempts.find((a) => a.id === chat.attemptId);
      if (!attempt) return;

      const simulation = simulations.find((s) => s.id === attempt.simulationId);
      if (!simulation) return;

      if (!simulationPerformance.has(simulation.id)) {
        simulationPerformance.set(simulation.id, {
          simulation,
          grades: [],
          chats: [],
          avgScore: 0,
          completionRate: 0,
          totalAttempts: 0,
        });
      }

      const performance = simulationPerformance.get(simulation.id)!;
      performance.grades.push(grade);
      performance.chats.push(chat);
    });

    // Calculate performance metrics for each simulation
    simulationPerformance.forEach((performance) => {
      const completedChats = performance.chats.filter((chat) => chat.completed);
      performance.avgScore =
        performance.grades.reduce((sum, grade) => sum + grade.score, 0) /
        performance.grades.length;
      performance.completionRate =
        (completedChats.length / performance.chats.length) * 100;
      performance.totalAttempts = performance.chats.length;
    });

    // Calculate relative performance metrics
    const allSimulations = Array.from(simulationPerformance.values());

    if (allSimulations.length === 0) {
      return { highPerforming: [], lowPerforming: [], attributes: [] };
    }

    // Calculate combined performance score (weighted average of score and completion rate)
    const simulationsWithScore = allSimulations.map((sim) => ({
      ...sim,
      combinedScore: sim.avgScore * 0.7 + sim.completionRate * 0.3, // Weight score more heavily
    }));

    // Sort by combined performance score
    simulationsWithScore.sort((a, b) => b.combinedScore - a.combinedScore);

    // Apply statistical method to determine high and low performers
    let highPerformingSims: typeof simulationsWithScore = [];
    let lowPerformingSims: typeof simulationsWithScore = [];

    switch (config.method) {
      case "percentile":
        const topCount = Math.ceil(
          (simulationsWithScore.length * config.topPercentage) / 100
        );
        const bottomCount = Math.ceil(
          (simulationsWithScore.length * config.bottomPercentage) / 100
        );
        highPerformingSims = simulationsWithScore.slice(0, topCount);
        lowPerformingSims = simulationsWithScore.slice(-bottomCount);
        break;

      case "quartile":
        // For quartile, we use Q1 (top 25%) and Q4 (bottom 25%)
        const q1Count = Math.ceil(simulationsWithScore.length * 0.25);
        const q4Count = Math.ceil(simulationsWithScore.length * 0.25);
        highPerformingSims = simulationsWithScore.slice(0, q1Count);
        lowPerformingSims = simulationsWithScore.slice(-q4Count);
        break;

      case "standard_deviation":
        // Calculate mean and standard deviation
        const scores = simulationsWithScore.map((sim) => sim.combinedScore);
        const mean =
          scores.reduce((sum, score) => sum + score, 0) / scores.length;
        const variance =
          scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) /
          scores.length;
        const stdDev = Math.sqrt(variance);

        // Select simulations above mean + 1σ and below mean - 1σ
        const upperThreshold = mean + stdDev;
        const lowerThreshold = mean - stdDev;

        highPerformingSims = simulationsWithScore.filter(
          (sim) => sim.combinedScore >= upperThreshold
        );
        lowPerformingSims = simulationsWithScore.filter(
          (sim) => sim.combinedScore <= lowerThreshold
        );
        break;

      default:
        // Fallback to percentile
        const fallbackTopCount = Math.ceil(
          (simulationsWithScore.length * 25) / 100
        );
        const fallbackBottomCount = Math.ceil(
          (simulationsWithScore.length * 25) / 100
        );
        highPerformingSims = simulationsWithScore.slice(0, fallbackTopCount);
        lowPerformingSims = simulationsWithScore.slice(-fallbackBottomCount);
    }

    // Define simulation attributes to analyze
    const attributes: SimulationAttribute[] = [
      {
        id: "intensity",
        name: "High Intensity",
        icon: "🔥",
        color: "#ef4444",
        highPerforming: 0,
        lowPerforming: 0,
        description: "Scenarios with intensity ≥7",
      },
      {
        id: "crowdedness",
        name: "High Crowdedness",
        icon: "👥",
        color: "#f59e0b",
        highPerforming: 0,
        lowPerforming: 0,
        description: "Scenarios with crowdedness ≥6",
      },
      {
        id: "documents",
        name: "Document Heavy",
        icon: "📚",
        color: "#8b5cf6",
        highPerforming: 0,
        lowPerforming: 0,
        description: "Scenarios with ≥3 documents",
      },
      {
        id: "scenarios",
        name: "Multi-Scenario",
        icon: "🎯",
        color: "#06b6d4",
        highPerforming: 0,
        lowPerforming: 0,
        description: "Simulations with ≥3 scenarios",
      },
      {
        id: "complexity",
        name: "High Complexity",
        icon: "🧩",
        color: "#10b981",
        highPerforming: 0,
        lowPerforming: 0,
        description: "Complex scenario combinations",
      },
    ];

    // Analyze high performing simulations
    highPerformingSims.forEach((sim) => {
      const simScenarios = scenarios.filter((s) =>
        sim.simulation.scenarioIds?.includes(s.id)
      );

      // Count high intensity scenarios
      const highIntensity = simScenarios.filter(
        (s) => s.intensity && s.intensity >= 7
      ).length;
      if (attributes[0]) attributes[0].highPerforming += highIntensity;

      // Count high crowdedness scenarios
      const highCrowdedness = simScenarios.filter(
        (s) => s.crowdedness && s.crowdedness >= 6
      ).length;
      if (attributes[1]) attributes[1].highPerforming += highCrowdedness;

      // Count document heavy scenarios
      const documentHeavy = simScenarios.filter(
        (s) => s.documentIds && s.documentIds.length >= 3
      ).length;
      if (attributes[2]) attributes[2].highPerforming += documentHeavy;

      // Check if multi-scenario
      if (
        sim.simulation.scenarioIds &&
        sim.simulation.scenarioIds.length >= 3
      ) {
        if (attributes[3]) attributes[3].highPerforming += 1;
      }

      // Check complexity (combination of factors)
      const complexScenarios = simScenarios.filter(
        (s) =>
          s.intensity &&
          s.intensity >= 6 &&
          s.crowdedness &&
          s.crowdedness >= 5 &&
          s.documentIds &&
          s.documentIds.length >= 2
      ).length;
      if (attributes[4]) attributes[4].highPerforming += complexScenarios;
    });

    // Analyze low performing simulations
    lowPerformingSims.forEach((sim) => {
      const simScenarios = scenarios.filter((s) =>
        sim.simulation.scenarioIds?.includes(s.id)
      );

      // Count high intensity scenarios
      const highIntensity = simScenarios.filter(
        (s) => s.intensity && s.intensity >= 7
      ).length;
      if (attributes[0]) attributes[0].lowPerforming += highIntensity;

      // Count high crowdedness scenarios
      const highCrowdedness = simScenarios.filter(
        (s) => s.crowdedness && s.crowdedness >= 6
      ).length;
      if (attributes[1]) attributes[1].lowPerforming += highCrowdedness;

      // Count document heavy scenarios
      const documentHeavy = simScenarios.filter(
        (s) => s.documentIds && s.documentIds.length >= 3
      ).length;
      if (attributes[2]) attributes[2].lowPerforming += documentHeavy;

      // Check if multi-scenario
      if (
        sim.simulation.scenarioIds &&
        sim.simulation.scenarioIds.length >= 3
      ) {
        if (attributes[3]) attributes[3].lowPerforming += 1;
      }

      // Check complexity (combination of factors)
      const complexScenarios = simScenarios.filter(
        (s) =>
          s.intensity &&
          s.intensity >= 6 &&
          s.crowdedness &&
          s.crowdedness >= 5 &&
          s.documentIds &&
          s.documentIds.length >= 2
      ).length;
      if (attributes[4]) attributes[4].lowPerforming += complexScenarios;
    });

    // Convert to chart data format
    const highPerformingData = attributes
      .filter((attr) => attr.highPerforming > 0)
      .map((attr) => ({
        name: attr.name,
        value: attr.highPerforming,
        icon: attr.icon,
        color: attr.color,
        description: attr.description,
      }));

    const lowPerformingData = attributes
      .filter((attr) => attr.lowPerforming > 0)
      .map((attr) => ({
        name: attr.name,
        value: attr.lowPerforming,
        icon: attr.icon,
        color: attr.color,
        description: attr.description,
      }));

    return {
      highPerforming: highPerformingData,
      lowPerforming: lowPerformingData,
      attributes,
      highPerformingCount: highPerformingSims.length,
      lowPerformingCount: lowPerformingSims.length,
    };
  }, [
    scenarios,
    simulations,
    chats,
    grades,
    attempts,
    profiles,
    dateStart,
    dateEnd,
    profileId,
    config.method,
    config.topPercentage,
    config.bottomPercentage,
  ]);

  if (
    !simulationComposition.highPerforming.length &&
    !simulationComposition.lowPerforming.length
  ) {
    return (
      <Card className="w-full h-full flex flex-col">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Simulation Composition
          </CardTitle>
          <CardDescription>
            Anatomy of high vs low performing simulations
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center flex-1">
          <p className="text-muted-foreground">
            No simulation data available for the selected time period.
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
          Simulation Composition
        </CardTitle>
        <CardDescription>
          Anatomy of high vs low performing simulations
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6 flex-1 flex flex-col">
        {/* Configuration Picker */}
        <SimulationCompositionPicker
          currentConfig={config}
          onConfigChange={setConfig}
        />

        {/* Performance Summary */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium">High Performers:</span>
                <span className="text-sm text-muted-foreground">
                  {simulationComposition.highPerformingCount} simulations
                </span>
              </div>
              <div className="flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-red-600" />
                <span className="text-sm font-medium">Low Performers:</span>
                <span className="text-sm text-muted-foreground">
                  {simulationComposition.lowPerformingCount} simulations
                </span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {config.description}
            </p>
          </div>
        </div>

        {/* Side-by-side Donut Charts */}
        <div className="flex-1 min-h-[400px] grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* High Performing Simulations */}
          <div className="space-y-4">
            <div className="text-center">
              <h3 className="font-semibold text-green-600 flex items-center justify-center gap-2">
                <TrendingUp className="h-4 w-4" />
                {config.method === "percentile" &&
                  `Top ${config.topPercentage}%`}
                {config.method === "quartile" && "Q1 (Top 25%)"}
                {config.method === "standard_deviation" && "Above 1σ"}
                Simulations
              </h3>
              <p className="text-xs text-muted-foreground">
                Common characteristics of successful simulations
              </p>
            </div>

            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={simulationComposition.highPerforming}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    innerRadius={40}
                    paddingAngle={2}
                  >
                    {simulationComposition.highPerforming.map(
                      (entry, index) => (
                        <Cell key={`high-cell-${index}`} fill={entry.color} />
                      )
                    )}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--background))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "6px",
                    }}
                    formatter={(value: number, name: string) => [
                      `${value} instances`,
                      name,
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* High Performing Legend */}
            <div className="space-y-2">
              {simulationComposition.highPerforming.map((item, index) => (
                <div
                  key={`high-legend-${index}`}
                  className="flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <span>
                      {item.icon} {item.name}
                    </span>
                  </div>
                  <span className="font-medium">{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Low Performing Simulations */}
          <div className="space-y-4">
            <div className="text-center">
              <h3 className="font-semibold text-red-600 flex items-center justify-center gap-2">
                <TrendingDown className="h-4 w-4" />
                {config.method === "percentile" &&
                  `Bottom ${config.bottomPercentage}%`}
                {config.method === "quartile" && "Q4 (Bottom 25%)"}
                {config.method === "standard_deviation" && "Below 1σ"}
                Simulations
              </h3>
              <p className="text-xs text-muted-foreground">
                Common characteristics of struggling simulations
              </p>
            </div>

            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={simulationComposition.lowPerforming}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    innerRadius={40}
                    paddingAngle={2}
                  >
                    {simulationComposition.lowPerforming.map((entry, index) => (
                      <Cell key={`low-cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--background))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "6px",
                    }}
                    formatter={(value: number, name: string) => [
                      `${value} instances`,
                      name,
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Low Performing Legend */}
            <div className="space-y-2">
              {simulationComposition.lowPerforming.map((item, index) => (
                <div
                  key={`low-legend-${index}`}
                  className="flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <span>
                      {item.icon} {item.name}
                    </span>
                  </div>
                  <span className="font-medium">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Insights */}
        <div className="text-sm text-muted-foreground">
          <p className="leading-relaxed">
            {simulationComposition.highPerforming.length > 0 &&
              simulationComposition.lowPerforming.length > 0 && (
                <>
                  {config.method === "percentile" && (
                    <>
                      Top {config.topPercentage}% performing simulations tend to
                      have more{" "}
                      {simulationComposition.highPerforming[0]?.name.toLowerCase()}
                      , while bottom {config.bottomPercentage}% performing
                      simulations show higher rates of{" "}
                      {simulationComposition.lowPerforming[0]?.name.toLowerCase()}
                      .
                    </>
                  )}
                  {config.method === "quartile" && (
                    <>
                      Q1 (top 25%) performing simulations tend to have more{" "}
                      {simulationComposition.highPerforming[0]?.name.toLowerCase()}
                      , while Q4 (bottom 25%) performing simulations show higher
                      rates of{" "}
                      {simulationComposition.lowPerforming[0]?.name.toLowerCase()}
                      .
                    </>
                  )}
                  {config.method === "standard_deviation" && (
                    <>
                      Statistical outliers above 1σ tend to have more{" "}
                      {simulationComposition.highPerforming[0]?.name.toLowerCase()}
                      , while outliers below 1σ show higher rates of{" "}
                      {simulationComposition.lowPerforming[0]?.name.toLowerCase()}
                      .
                    </>
                  )}
                  This analysis shows that{" "}
                  {simulationComposition.highPerforming[0]?.description.toLowerCase()}{" "}
                  may contribute to better outcomes compared to other
                  simulations in this period.
                </>
              )}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
