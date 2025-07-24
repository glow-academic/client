/**
 * ScenarioStats.tsx
 * This component displays the scenario stats for the personas.
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
import { getAllDocuments } from "@/utils/queries/documents/get-all-documents";
import { getAllPersonas } from "@/utils/queries/personas/get-all-personas";
import { getAllProfiles } from "@/utils/queries/profiles/get-all-profiles";
import { getAllScenarios } from "@/utils/queries/scenarios/get-all-scenarios";
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

export interface ScenarioStatsProps {
  dateStart: Date;
  dateEnd: Date;
  profileId?: string;
  _thresholds: {
    danger: number;
    warning: number;
    success: number;
  };
}

export default function ScenarioStats({
  dateStart,
  dateEnd,
  profileId,
  _thresholds,
}: ScenarioStatsProps) {
  // Fetch data
  const { data: scenarios } = useQuery({
    queryKey: ["scenarios"],
    queryFn: () => getAllScenarios(),
  });

  const { data: personas } = useQuery({
    queryKey: ["personas"],
    queryFn: () => getAllPersonas(),
  });

  const { data: documents } = useQuery({
    queryKey: ["documents"],
    queryFn: () => getAllDocuments(),
  });

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

  // Calculate scenario analysis data
  const scenarioAnalysis = useMemo(() => {
    if (
      !scenarios ||
      !personas ||
      !documents ||
      !attempts ||
      !chats ||
      !grades ||
      !simulations ||
      !profiles
    ) {
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

    // Calculate performance for each scenario
    const scenarioPerformance = scenarios
      .map((scenario) => {
        const scenarioChats = chats.filter(
          (chat) => chat.scenarioId === scenario.id
        );
        const scenarioGrades = filteredGrades.filter((grade) =>
          scenarioChats.some((chat) => chat.id === grade.simulationChatId)
        );

        if (scenarioGrades.length === 0) return null;

        const completedChats = scenarioChats.filter((chat) => chat.completed);
        const successRate = Math.round(
          (completedChats.length / scenarioChats.length) * 100
        );

        const avgScore = Math.round(
          scenarioGrades.reduce((sum, grade) => sum + grade.score, 0) /
            scenarioGrades.length
        );

        return {
          scenario,
          successRate,
          avgScore,
          totalAttempts: scenarioChats.length,
          completedAttempts: completedChats.length,
        };
      })
      .filter(
        (item): item is NonNullable<typeof item> =>
          item !== null && item.totalAttempts >= 3
      );

    // Sort by success rate
    const sortedScenarios = [...scenarioPerformance].sort(
      (a, b) => b.successRate - a.successRate
    );

    // Get top 3 high performing and bottom 3 low performing
    const highPerforming = sortedScenarios.slice(0, 3);
    const lowPerforming = sortedScenarios.slice(-3).reverse();

    // Analyze traits for high vs low performing scenarios
    const analyzeTraits = (scenarioList: typeof highPerforming) => {
      const traitCounts = {
        personaVariety: 0,
        documentCount: 0,
        intensityLevel: 0,
        crowdedness: 0,
      };

      scenarioList.forEach((item) => {
        const scenario = item.scenario;

        // Count unique personas
        if (scenario.personaId) traitCounts.personaVariety++;

        // Count documents
        if (scenario.documentIds && scenario.documentIds.length > 0) {
          traitCounts.documentCount += scenario.documentIds.length;
        }

        // Average intensity and crowdedness
        if (scenario.intensity)
          traitCounts.intensityLevel += scenario.intensity;
        if (scenario.crowdedness)
          traitCounts.crowdedness += scenario.crowdedness;
      });

      const count = scenarioList.length;
      return {
        personaVariety: Math.round(traitCounts.personaVariety / count),
        documentCount: Math.round(traitCounts.documentCount / count),
        intensityLevel: Math.round(traitCounts.intensityLevel / count),
        crowdedness: Math.round(traitCounts.crowdedness / count),
      };
    };

    const highTraits = analyzeTraits(highPerforming);
    const lowTraits = analyzeTraits(lowPerforming);

    // Create chart data for visualization
    const chartData = [
      {
        category: "Persona Variety",
        highPerforming: highTraits.personaVariety,
        lowPerforming: lowTraits.personaVariety,
      },
      {
        category: "Document Count",
        highPerforming: highTraits.documentCount,
        lowPerforming: lowTraits.documentCount,
      },
      {
        category: "Intensity Level",
        highPerforming: highTraits.intensityLevel,
        lowPerforming: lowTraits.intensityLevel,
      },
      {
        category: "Crowdedness",
        highPerforming: highTraits.crowdedness,
        lowPerforming: lowTraits.crowdedness,
      },
    ];

    return { highPerforming, lowPerforming, chartData };
  }, [
    scenarios,
    personas,
    documents,
    attempts,
    chats,
    grades,
    simulations,
    profiles,
    dateStart,
    dateEnd,
    profileId,
  ]);

  if (!scenarioAnalysis.chartData.length) {
    return (
      <Card className="w-full h-full flex flex-col">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Scenario Analysis
          </CardTitle>
          <CardDescription>
            Performance trends across scenario characteristics
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center flex-1">
          <p className="text-muted-foreground">
            No scenario data available for the selected time period.
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
          Scenario Analysis
        </CardTitle>
        <CardDescription>
          Performance trends across scenario characteristics
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
              {scenarioAnalysis.highPerforming.map((item, index) => (
                <Badge key={index} variant="outline" className="text-xs">
                  {item.scenario.name.substring(0, 15)}... ({item.successRate}%)
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
              {scenarioAnalysis.lowPerforming.map((item, index) => (
                <Badge key={index} variant="outline" className="text-xs">
                  {item.scenario.name.substring(0, 15)}... ({item.successRate}%)
                </Badge>
              ))}
            </div>
          </div>
        </div>

        {/* Chart */}
        <div className="flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={scenarioAnalysis.chartData}
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
            Analysis based on scenario complexity factors and completion rates
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
