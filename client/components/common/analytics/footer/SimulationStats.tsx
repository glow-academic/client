/**
 * SimulationStats.tsx
 * This component displays the simulation stats for the personas.
 * @AshokSaravanan222 & @siladiea
 * 07/23/2025
 */
"use client";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getAllProfiles } from "@/utils/queries/profiles/get-all-profiles";
import { getSimulationAttemptsByProfiles } from "@/utils/queries/simulation_attempts/get-simulation-attempts-by-profiles";
import { getSimulationChatGradesBySimulationChats } from "@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulationchats";
import { getSimulationChatsByAttempts } from "@/utils/queries/simulation_chats/get-simulation-chats-by-attempts";
import { getAllSimulations } from "@/utils/queries/simulations/get-all-simulations";
import { useQuery } from "@tanstack/react-query";
import { isAfter, isBefore } from "date-fns";
import { BarChart3, TrendingDown, TrendingUp } from "lucide-react";
import { useMemo } from "react";
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

export interface SimulationStatsProps {
  dateStart: Date;
  dateEnd: Date;
  profileId?: string;
}

export default function SimulationStats({
  dateStart,
  dateEnd,
  profileId,
}: SimulationStatsProps) {
  // Fetch data
  const { data: profiles } = useQuery({
    queryKey: ["profiles"],
    queryFn: () => getAllProfiles(),
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

  // Calculate simulation analysis data
  const simulationAnalysis = useMemo(() => {
    if (!simulations || !chats || !grades || !attempts || !profiles) {
      return { highPerforming: [], lowPerforming: [], chartData: [] };
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

    if (filteredGrades.length === 0)
      return { highPerforming: [], lowPerforming: [], chartData: [] };

    // Calculate performance for each simulation
    const simulationPerformance = simulations
      .map((simulation) => {
        const simulationAttempts = attempts.filter(
          (attempt) => attempt.simulationId === simulation.id
        );

        if (simulationAttempts.length === 0) return null;

        const simulationChats = chats.filter((chat) =>
          simulationAttempts.some((attempt) => attempt.id === chat.attemptId)
        );

        const simulationGrades = filteredGrades.filter((grade) =>
          simulationChats.some((chat) => chat.id === grade.simulationChatId)
        );

        if (simulationGrades.length === 0) return null;

        const completedChats = simulationChats.filter((chat) => chat.completed);
        const successRate = Math.round(
          (completedChats.length / simulationChats.length) * 100
        );

        const avgScore = Math.round(
          simulationGrades.reduce((sum, grade) => sum + grade.score, 0) /
            simulationGrades.length
        );

        return {
          simulation,
          successRate,
          avgScore,
          totalAttempts: simulationChats.length,
          completedAttempts: completedChats.length,
        };
      })
      .filter(
        (item): item is NonNullable<typeof item> =>
          item !== null && item.totalAttempts >= 3
      );

    // Sort by success rate
    const sortedSimulations = [...simulationPerformance].sort(
      (a, b) => b.successRate - a.successRate
    );

    // Get top 3 high performing and bottom 3 low performing
    const highPerforming = sortedSimulations.slice(0, 3);
    const lowPerforming = sortedSimulations.slice(-3).reverse();

    // Analyze traits for high vs low performing simulations
    const analyzeTraits = (simulationList: typeof highPerforming) => {
      const traitCounts = {
        timeLimit: 0,
        scenarioCount: 0,
        complexity: 0,
        defaultSimulation: 0,
      };

      simulationList.forEach((item) => {
        const simulation = item.simulation;

        // Average time limit
        if (simulation.timeLimit) traitCounts.timeLimit += simulation.timeLimit;

        // Average scenario count
        if (simulation.scenarioIds) {
          traitCounts.scenarioCount += simulation.scenarioIds.length;
        }

        // Complexity (based on time limit and scenario count)
        const complexity =
          (simulation.timeLimit || 0) * (simulation.scenarioIds?.length || 1);
        traitCounts.complexity += complexity;

        // Count default simulations
        if (simulation.defaultSimulation) traitCounts.defaultSimulation++;
      });

      const count = simulationList.length;
      return {
        timeLimit: Math.round(traitCounts.timeLimit / count),
        scenarioCount: Math.round(traitCounts.scenarioCount / count),
        complexity: Math.round(traitCounts.complexity / count),
        defaultSimulation: Math.round(
          (traitCounts.defaultSimulation / count) * 100
        ),
      };
    };

    const highTraits = analyzeTraits(highPerforming);
    const lowTraits = analyzeTraits(lowPerforming);

    // Create chart data for visualization
    const chartData = [
      {
        category: "Time Limit (min)",
        highPerforming: highTraits.timeLimit,
        lowPerforming: lowTraits.timeLimit,
      },
      {
        category: "Scenario Count",
        highPerforming: highTraits.scenarioCount,
        lowPerforming: lowTraits.scenarioCount,
      },
      {
        category: "Complexity Score",
        highPerforming: highTraits.complexity,
        lowPerforming: lowTraits.complexity,
      },
      {
        category: "Default Simulations (%)",
        highPerforming: highTraits.defaultSimulation,
        lowPerforming: lowTraits.defaultSimulation,
      },
    ];

    return { highPerforming, lowPerforming, chartData };
  }, [
    simulations,
    chats,
    grades,
    attempts,
    profiles,
    dateStart,
    dateEnd,
    profileId,
  ]);

  if (!simulationAnalysis.chartData.length) {
    return (
      <Card className="w-full h-full flex flex-col">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Simulation Analysis
          </CardTitle>
          <CardDescription>
            Performance trends across simulation characteristics
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
          Simulation Analysis
        </CardTitle>
        <CardDescription>
          Performance trends across simulation characteristics
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 flex-1 flex flex-col">
        {/* Performance Summary */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium">High Performing</span>
            </div>
            <div className="space-y-1">
              {simulationAnalysis.highPerforming.map((item, index) => (
                <Badge key={index} variant="outline" className="text-xs">
                  {item.simulation.title.substring(0, 15)}... (
                  {item.successRate}%)
                </Badge>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-red-600" />
              <span className="text-sm font-medium">Needs Attention</span>
            </div>
            <div className="space-y-1">
              {simulationAnalysis.lowPerforming.map((item, index) => (
                <Badge key={index} variant="outline" className="text-xs">
                  {item.simulation.title.substring(0, 15)}... (
                  {item.successRate}%)
                </Badge>
              ))}
            </div>
          </div>
        </div>

        {/* Chart */}
        <div className="flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={simulationAnalysis.chartData}
              margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="category" fontSize={12} />
              <YAxis fontSize={12} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--background))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "6px",
                }}
              />
              <Legend />
              <Bar
                dataKey="highPerforming"
                fill="#10b981"
                name="High Performing"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="lowPerforming"
                fill="#ef4444"
                name="Low Performing"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Insights */}
        <div className="text-sm text-muted-foreground">
          <p className="leading-none">
            Analysis based on simulation configuration and completion rates
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
