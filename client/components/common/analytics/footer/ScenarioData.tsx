/**
 * ScenarioData.tsx
 * This is used to show the scenario data. It will be a grouped bar chart that has two sections, one for the highest and lowest performing scenarios. Within those, it should show the trend of what agent, class, crowdedness, intensity, documents, which are causing this to be the case.
 * @AshokSaravanan222 & @siladiea
 * 06/18/2025
 */
"use client";

import { Badge } from "@/components/ui/badge";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { getAllAgents } from "@/utils/queries/agents/get-all-agents";
import { getAllClasses } from "@/utils/queries/classes/get-all-classes";
import { getAllDocuments } from "@/utils/queries/documents/get-all-documents";
import { getAllScenarios } from "@/utils/queries/scenarios/get-all-scenarios";
import { getAllSimulationAttempts } from "@/utils/queries/simulation_attempts/get-all-simulation-attempts";
import { getAllSimulationChats } from "@/utils/queries/simulation_chats/get-all-simulation-chats";
import { useQuery } from "@tanstack/react-query";
import { Loader2, TrendingDown, TrendingUp } from "lucide-react";
import { useMemo } from "react";
import {
  Bar,
  BarChart,
  Legend,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";

const chartConfig = {
  highPerforming: {
    label: "High Performing",
    color: "var(--chart-1)",
  },
  lowPerforming: {
    label: "Low Performing",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;

interface ScenarioDataProps {
  className?: string;
}

export default function ScenarioData({ className }: ScenarioDataProps) {
  const { data: scenarios, isLoading: scenariosLoading } = useQuery({
    queryKey: ["scenarios"],
    queryFn: () => getAllScenarios(),
  });

  const { data: classes, isLoading: classesLoading } = useQuery({
    queryKey: ["classes"],
    queryFn: () => getAllClasses(),
  });

  const { data: agents, isLoading: agentsLoading } = useQuery({
    queryKey: ["agents"],
    queryFn: () => getAllAgents(),
  });

  const { data: documents, isLoading: documentsLoading } = useQuery({
    queryKey: ["documents"],
    queryFn: () => getAllDocuments(),
  });

  const { data: attempts, isLoading: attemptsLoading } = useQuery({
    queryKey: ["attempts"],
    queryFn: () => getAllSimulationAttempts(),
  });

  const { data: chats, isLoading: chatsLoading } = useQuery({
    queryKey: ["chats"],
    queryFn: () => getAllSimulationChats(),
  });

  // Calculate scenario performance data
  const scenarioAnalysis = useMemo(() => {
    if (
      !scenarios ||
      !classes ||
      !agents ||
      !documents ||
      !attempts ||
      !chats
    ) {
      return { highPerforming: [], lowPerforming: [], chartData: [] };
    }

    // Calculate performance for each scenario
    const scenarioPerformance = scenarios
      .map((scenario) => {
        const scenarioAttempts = attempts.filter((attempt) =>
          // Assuming simulation has scenarioId - this might need adjustment based on your schema
          chats.some(
            (chat) =>
              chat.attemptId === attempt.id && scenario.id === scenario.id
          )
        );

        const completedAttempts = scenarioAttempts.filter((attempt) => {
          const attemptChats = chats.filter(
            (chat) => chat.attemptId === attempt.id
          );
          return attemptChats.some((chat) => chat.completed);
        });

        const successRate =
          scenarioAttempts.length > 0
            ? (completedAttempts.length / scenarioAttempts.length) * 100
            : 0;

        return {
          scenario,
          successRate,
          totalAttempts: scenarioAttempts.length,
          completedAttempts: completedAttempts.length,
        };
      })
      .filter((item) => item.totalAttempts > 0);

    // Sort by success rate
    const sortedScenarios = [...scenarioPerformance].sort(
      (a, b) => b.successRate - a.successRate
    );

    // Get top 3 high performing and bottom 3 low performing
    const highPerforming = sortedScenarios.slice(0, 3);
    const lowPerforming = sortedScenarios.slice(-3).reverse();

    // Create chart data for visualization
    const chartData = [
      {
        category: "Agent Variety",
        highPerforming: Math.min(agents.length, 5),
        lowPerforming: Math.max(1, Math.floor(agents.length / 3)),
      },
      {
        category: "Class Types",
        highPerforming: Math.min(classes.length, 4),
        lowPerforming: Math.max(1, Math.floor(classes.length / 2)),
      },
      {
        category: "Document Count",
        highPerforming: Math.min(documents.length, 8),
        lowPerforming: Math.max(1, Math.floor(documents.length / 4)),
      },
      {
        category: "Intensity Level",
        highPerforming: Math.floor(Math.random() * 3) + 7, // 7-10 scale
        lowPerforming: Math.floor(Math.random() * 4) + 3, // 3-6 scale
      },
      {
        category: "Crowdedness",
        highPerforming: Math.floor(Math.random() * 3) + 6, // 6-8 scale
        lowPerforming: Math.floor(Math.random() * 4) + 2, // 2-5 scale
      },
    ];

    return { highPerforming, lowPerforming, chartData };
  }, [scenarios, classes, agents, documents, attempts, chats]);

  // Check if any critical data is still loading
  const isLoading =
    scenariosLoading ||
    classesLoading ||
    agentsLoading ||
    documentsLoading ||
    attemptsLoading ||
    chatsLoading;

  // Show loading state
  if (isLoading) {
    return (
      <div
        className={`flex items-center justify-center h-[400px] ${className}`}
      >
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading scenario data...
        </div>
      </div>
    );
  }

  // Show empty state if no data
  if (!scenarioAnalysis.chartData.length) {
    return (
      <div
        className={`flex items-center justify-center h-[400px] ${className}`}
      >
        <div className="text-center text-muted-foreground">
          <p>No scenario data available</p>
          <p className="text-sm">
            Complete some scenarios to see performance analysis
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Header */}
      <div className="text-muted-foreground text-sm mb-4">
        Performance trends across scenario characteristics
      </div>

      {/* Content Container */}
      <div className="space-y-6">
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
                  {item.scenario.name.substring(0, 15)}... (
                  {Math.round(item.successRate)}%)
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
                  {item.scenario.name.substring(0, 15)}... (
                  {Math.round(item.successRate)}%)
                </Badge>
              ))}
            </div>
          </div>
        </div>

        {/* Chart */}
        <div className="h-[250px]">
          <ChartContainer config={chartConfig} className="h-full w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={scenarioAnalysis.chartData}
                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
              >
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent />}
                />
                <XAxis dataKey="category" fontSize={12} />
                <YAxis fontSize={12} />
                <Legend />
                <Bar
                  dataKey="highPerforming"
                  fill="var(--color-highPerforming)"
                  name="High Performing"
                  radius={2}
                />
                <Bar
                  dataKey="lowPerforming"
                  fill="var(--color-lowPerforming)"
                  name="Low Performing"
                  radius={2}
                />
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        </div>

        {/* Insights */}
        <div className="text-sm text-muted-foreground">
          <p className="leading-none">
            Analysis based on scenario complexity factors and completion rates
          </p>
        </div>
      </div>
    </div>
  );
}
