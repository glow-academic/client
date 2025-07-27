/**
 * SimulationComposition.tsx
 * This component displays the anatomy of high vs low performing simulations.
 * Compact design with comprehensive attribute analysis.
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { getAllAgents } from "@/utils/queries/agents/get-all-agents";
import { getAllCohorts } from "@/utils/queries/cohorts/get-all-cohorts";
import { getAllParameterItems } from "@/utils/queries/parameter_items/get-all-parameter-items";
import { getAllParameters } from "@/utils/queries/parameters/get-all-parameters";
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
import { useMemo, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import SimulationCompositionPicker, {
  SimulationCompositionConfig,
} from "../SimulationCompositionPicker";

export interface SimulationCompositionProps {
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

interface SimulationAttribute {
  id: string;
  name: string;
  icon: string;
  color: string;
  highPerforming: number;
  lowPerforming: number;
  description: string;
  difference: number;
  significance: "high" | "medium" | "low" | "none";
  parameterId: string;
  parameterItemId: string;
  value: string;
  isNumerical: boolean;
}

interface SimulationDetail {
  id: string;
  title: string;
  avgScore: number;
  completionRate: number;
  totalAttempts: number;
  combinedScore: number;
  timeLimit: number | undefined;
  scenarioCount: number;
  parameterBreakdown: Array<{
    parameterName: string;
    parameterValue: string;
    isNumerical: boolean;
  }>;
}

export default function SimulationComposition({
  dateStart,
  dateEnd,
  profileId,
  cohortIds,
  thresholds,
}: SimulationCompositionProps) {
  // Configuration state
  const [config, setConfig] = useState<SimulationCompositionConfig>({
    method: "percentile",
    topPercentage: 25,
    bottomPercentage: 25,
    description: "Top 25% vs Bottom 25% - Best vs Worst",
  });

  // Fetch comprehensive data
  const { data: profiles } = useQuery({
    queryKey: ["profiles"],
    queryFn: () => getAllProfiles(),
  });

  const { data: cohorts } = useQuery({
    queryKey: ["cohorts"],
    queryFn: () => getAllCohorts(),
  });

  const { data: scenarios } = useQuery({
    queryKey: ["scenarios"],
    queryFn: () => getAllScenarios(),
  });

  const { data: simulations } = useQuery({
    queryKey: ["simulations"],
    queryFn: () => getAllSimulations(),
  });

  const { data: personas } = useQuery({
    queryKey: ["personas"],
    queryFn: () => getAllPersonas(),
  });

  const { data: agents } = useQuery({
    queryKey: ["agents"],
    queryFn: () => getAllAgents(),
  });

  const { data: parameters } = useQuery({
    queryKey: ["parameters"],
    queryFn: () => getAllParameters(),
  });

  const { data: parameterItems } = useQuery({
    queryKey: ["parameterItems"],
    queryFn: () => getAllParameterItems(),
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

  // Calculate cohort-based filters
  const cohortFilters = useMemo(() => {
    if (!cohorts || !cohortIds || cohortIds.length === 0) {
      return {
        allowedProfileIds: null,
        allowedSimulationIds: null,
        hasMatchingCohorts: true, // Show all data if no cohort filtering
      };
    }

    // Filter cohorts based on provided cohortIds
    const matchingCohorts = cohorts.filter((cohort) =>
      cohortIds.includes(cohort.id),
    );

    if (matchingCohorts.length === 0) {
      return {
        allowedProfileIds: null,
        allowedSimulationIds: null,
        hasMatchingCohorts: false,
      };
    }

    // Extract all profileIds and simulationIds from matching cohorts
    const allProfileIds = new Set<string>();
    const allSimulationIds = new Set<string>();

    matchingCohorts.forEach((cohort) => {
      cohort.profileIds?.forEach((id) => allProfileIds.add(id));
      cohort.simulationIds?.forEach((id) => allSimulationIds.add(id));
    });

    return {
      allowedProfileIds: Array.from(allProfileIds),
      allowedSimulationIds: Array.from(allSimulationIds),
      hasMatchingCohorts: true,
    };
  }, [cohorts, cohortIds]);

  // Calculate simulation composition data
  const simulationComposition = useMemo(() => {
    if (
      !scenarios ||
      !simulations ||
      !chats ||
      !grades ||
      !attempts ||
      !profiles ||
      !personas ||
      !agents ||
      !parameters ||
      !parameterItems
    ) {
      return {
        highPerforming: [],
        lowPerforming: [],
        attributes: [],
        highPerformingDetails: [],
        lowPerformingDetails: [],
      };
    }

    // Filter data by date range, exclude practice simulations, and filter by TA role
    const filteredGrades = grades.filter((grade) => {
      const gradeDate = new Date(grade.createdAt);
      const chat = chats.find((c) => c.id === grade.simulationChatId);
      const attempt = attempts.find((a) => a.id === chat?.attemptId);
      const simulation = simulations.find(
        (s) => s.id === attempt?.simulationId,
      );
      const profile = profiles?.find((p) => p.id === attempt?.profileId);

      // Check date range
      const inDateRange =
        isAfter(gradeDate, dateStart) && isBefore(gradeDate, dateEnd);

      // Exclude practice simulations
      const notPractice = !simulation?.practiceSimulation;

      // Filter by TA role (relaxed for better data availability)
      const isTA = profile?.role === "ta" || true; // Temporarily allow all roles

      // Filter by profile if provided
      const profileMatch = profileId ? attempt?.profileId === profileId : true;

      // Apply cohort-based profile filtering
      const cohortProfileMatch = cohortFilters.allowedProfileIds
        ? profile && cohortFilters.allowedProfileIds.includes(profile.id)
        : true;

      // Apply cohort-based simulation filtering
      const cohortSimulationMatch = cohortFilters.allowedSimulationIds
        ? simulation &&
          cohortFilters.allowedSimulationIds.includes(simulation.id)
        : true;

      return (
        inDateRange &&
        notPractice &&
        isTA &&
        profileMatch &&
        cohortProfileMatch &&
        cohortSimulationMatch
      );
    });

    if (filteredGrades.length === 0) {
      return {
        highPerforming: [],
        lowPerforming: [],
        attributes: [],
        highPerformingDetails: [],
        lowPerformingDetails: [],
      };
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
        timeLimit: number | undefined;
        scenarioCount: number;
        parameterBreakdown: Array<{
          parameterName: string;
          parameterValue: string;
          isNumerical: boolean;
        }>;
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
          timeLimit: simulation.timeLimit ?? undefined,
          scenarioCount: simulation.scenarioIds?.length || 0,
          parameterBreakdown: [],
        });
      }

      const performance = simulationPerformance.get(simulation.id)!;
      performance.grades.push(grade);
      performance.chats.push(chat);
    });

    // Calculate performance metrics and parameter breakdown for each simulation
    simulationPerformance.forEach((performance) => {
      const completedChats = performance.chats.filter((chat) => chat.completed);
      performance.avgScore =
        performance.grades.reduce((sum, grade) => sum + grade.score, 0) /
        performance.grades.length;
      performance.completionRate =
        (completedChats.length / performance.chats.length) * 100;
      performance.totalAttempts = performance.chats.length;

      // Calculate parameter breakdown for this simulation
      const simScenarios = scenarios.filter((s) =>
        performance.simulation.scenarioIds?.includes(s.id),
      );

      // Collect all parameter items used in this simulation's scenarios
      const usedParameterItems = new Map<
        string,
        {
          parameterName: string;
          parameterValue: string;
          isNumerical: boolean;
          count: number;
        }
      >();

      simScenarios.forEach((scenario) => {
        scenario.parameterItemIds?.forEach((paramItemId) => {
          const paramItem = parameterItems.find((pi) => pi.id === paramItemId);
          if (paramItem) {
            const parameter = parameters.find(
              (p) => p.id === paramItem.parameterId,
            );
            if (parameter) {
              const key = `${paramItem.parameterId}-${paramItem.id}`;
              if (usedParameterItems.has(key)) {
                usedParameterItems.get(key)!.count++;
              } else {
                usedParameterItems.set(key, {
                  parameterName: parameter.name,
                  parameterValue: paramItem.value,
                  isNumerical: parameter.numerical,
                  count: 1,
                });
              }
            }
          }
        });
      });

      // Convert to array and sort by frequency
      performance.parameterBreakdown = Array.from(usedParameterItems.values())
        .sort((a, b) => b.count - a.count)
        .map(({ parameterName, parameterValue, isNumerical }) => ({
          parameterName,
          parameterValue,
          isNumerical,
        }));
    });

    // Calculate relative performance metrics
    const allSimulations = Array.from(simulationPerformance.values());

    if (allSimulations.length === 0) {
      return {
        highPerforming: [],
        lowPerforming: [],
        attributes: [],
        highPerformingDetails: [],
        lowPerformingDetails: [],
      };
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
          (simulationsWithScore.length * config.topPercentage) / 100,
        );
        const bottomCount = Math.ceil(
          (simulationsWithScore.length * config.bottomPercentage) / 100,
        );
        highPerformingSims = simulationsWithScore.slice(0, topCount);
        lowPerformingSims = simulationsWithScore.slice(-bottomCount);
        break;

      case "quartile":
        const q1Count = Math.ceil(simulationsWithScore.length * 0.25);
        const q4Count = Math.ceil(simulationsWithScore.length * 0.25);
        highPerformingSims = simulationsWithScore.slice(0, q1Count);
        lowPerformingSims = simulationsWithScore.slice(-q4Count);
        break;

      case "standard_deviation":
        const scores = simulationsWithScore.map((sim) => sim.combinedScore);
        const mean =
          scores.reduce((sum, score) => sum + score, 0) / scores.length;
        const variance =
          scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) /
          scores.length;
        const stdDev = Math.sqrt(variance);

        const upperThreshold = mean + stdDev;
        const lowerThreshold = mean - stdDev;

        highPerformingSims = simulationsWithScore.filter(
          (sim) => sim.combinedScore >= upperThreshold,
        );
        lowPerformingSims = simulationsWithScore.filter(
          (sim) => sim.combinedScore <= lowerThreshold,
        );
        break;

      default:
        const fallbackTopCount = Math.ceil(
          (simulationsWithScore.length * 25) / 100,
        );
        const fallbackBottomCount = Math.ceil(
          (simulationsWithScore.length * 25) / 100,
        );
        highPerformingSims = simulationsWithScore.slice(0, fallbackTopCount);
        lowPerformingSims = simulationsWithScore.slice(-fallbackBottomCount);
    }

    // Create detailed simulation lists for dialog
    const highPerformingDetails: SimulationDetail[] = highPerformingSims.map(
      (sim) => ({
        id: sim.simulation.id,
        title: sim.simulation.title,
        avgScore: Math.round(sim.avgScore),
        completionRate: Math.round(sim.completionRate),
        totalAttempts: sim.totalAttempts,
        combinedScore: Math.round(sim.combinedScore),
        timeLimit: sim.timeLimit,
        scenarioCount: sim.scenarioCount,
        parameterBreakdown: sim.parameterBreakdown,
      }),
    );

    const lowPerformingDetails: SimulationDetail[] = lowPerformingSims.map(
      (sim) => ({
        id: sim.simulation.id,
        title: sim.simulation.title,
        avgScore: Math.round(sim.avgScore),
        completionRate: Math.round(sim.completionRate),
        totalAttempts: sim.totalAttempts,
        combinedScore: Math.round(sim.combinedScore),
        timeLimit: sim.timeLimit,
        scenarioCount: sim.scenarioCount,
        parameterBreakdown: sim.parameterBreakdown,
      }),
    );

    // Generate colors for attributes
    const colors = [
      "#3b82f6",
      "#ef4444",
      "#10b981",
      "#f59e0b",
      "#8b5cf6",
      "#06b6d4",
      "#84cc16",
      "#f97316",
      "#ec4899",
      "#6366f1",
      "#14b8a6",
      "#f43f5e",
    ];

    // Analyze parameter usage patterns
    const parameterUsage = new Map<string, SimulationAttribute>();

    // Helper function to get or create attribute
    const getOrCreateAttribute = (
      parameterId: string,
      parameterItemId: string,
      parameterName: string,
      parameterValue: string,
      isNumerical: boolean,
    ): SimulationAttribute => {
      const key = `${parameterId}-${parameterItemId}`;
      if (!parameterUsage.has(key)) {
        const colorIndex = parameterUsage.size % colors.length;
        parameterUsage.set(key, {
          id: key,
          name: `${parameterName}: ${parameterValue}`,
          icon: isNumerical ? "📊" : "🏷️",
          color: colors[colorIndex] || "#000000",
          highPerforming: 0,
          lowPerforming: 0,
          description: `${parameterName} with value ${parameterValue}`,
          difference: 0,
          significance: "none",
          parameterId,
          parameterItemId,
          value: parameterValue,
          isNumerical,
        });
      }
      return parameterUsage.get(key)!;
    };

    // Analyze high performing simulations
    highPerformingSims.forEach((sim) => {
      sim.parameterBreakdown.forEach((param) => {
        // Find the parameter item for this value
        const paramItem = parameterItems.find(
          (pi) => pi.value === param.parameterValue,
        );

        if (paramItem && paramItem.parameterId) {
          const attribute = getOrCreateAttribute(
            paramItem.parameterId,
            paramItem.id,
            param.parameterName,
            param.parameterValue,
            param.isNumerical,
          );
          attribute.highPerforming += 1;
        }
      });
    });

    // Analyze low performing simulations
    lowPerformingSims.forEach((sim) => {
      sim.parameterBreakdown.forEach((param) => {
        // Find the parameter item for this value
        const paramItem = parameterItems.find(
          (pi) => pi.value === param.parameterValue,
        );

        if (paramItem && paramItem.parameterId) {
          const attribute = getOrCreateAttribute(
            paramItem.parameterId,
            paramItem.id,
            param.parameterName,
            param.parameterValue,
            param.isNumerical,
          );
          attribute.lowPerforming += 1;
        }
      });
    });

    // Calculate differences and significance
    parameterUsage.forEach((attr) => {
      attr.difference = attr.highPerforming - attr.lowPerforming;
      const totalHigh = highPerformingSims.length;
      const totalLow = lowPerformingSims.length;

      if (totalHigh > 0 && totalLow > 0) {
        const highRate = attr.highPerforming / totalHigh;
        const lowRate = attr.lowPerforming / totalLow;
        const rateDiff = Math.abs(highRate - lowRate);

        // Lowered thresholds for better data visibility
        if (rateDiff > 0.2) {
          attr.significance = "high";
        } else if (rateDiff > 0.1) {
          attr.significance = "medium";
        } else if (rateDiff > 0.02) {
          attr.significance = "low";
        } else {
          attr.significance = "none";
        }
      }
    });

    // Create separate attribute lists for high and low performing simulations
    const highPerformingAttributes = Array.from(parameterUsage.values())
      .filter((attr) => attr.highPerforming > 0)
      .sort((a, b) => {
        // Sort by significance first, then by high performing value
        if (a.significance !== b.significance) {
          const significanceOrder = { high: 3, medium: 2, low: 1, none: 0 };
          return (
            significanceOrder[b.significance] -
            significanceOrder[a.significance]
          );
        }
        return b.highPerforming - a.highPerforming;
      })
      .slice(0, 5); // Show top 5 for high performing

    const lowPerformingAttributes = Array.from(parameterUsage.values())
      .filter((attr) => attr.lowPerforming > 0)
      .sort((a, b) => {
        // Sort by significance first, then by low performing value
        if (a.significance !== b.significance) {
          const significanceOrder = { high: 3, medium: 2, low: 1, none: 0 };
          return (
            significanceOrder[b.significance] -
            significanceOrder[a.significance]
          );
        }
        return b.lowPerforming - a.lowPerforming;
      })
      .slice(0, 5); // Show top 5 for low performing

    // Convert to chart data format using the separate attribute lists
    const highPerformingData = highPerformingAttributes.map((attr) => ({
      name: attr.name,
      value: attr.highPerforming,
      icon: attr.icon,
      color: attr.color,
      description: attr.description,
      significance: attr.significance,
    }));

    const lowPerformingData = lowPerformingAttributes.map((attr) => ({
      name: attr.name,
      value: attr.lowPerforming,
      icon: attr.icon,
      color: attr.color,
      description: attr.description,
      significance: attr.significance,
    }));

    return {
      highPerforming: highPerformingData,
      lowPerforming: lowPerformingData,
      attributes: [...highPerformingAttributes, ...lowPerformingAttributes],
      highPerformingCount: highPerformingSims.length,
      lowPerformingCount: lowPerformingSims.length,
      highPerformingDetails,
      lowPerformingDetails,
    };
  }, [
    scenarios,
    simulations,
    chats,
    grades,
    attempts,
    profiles,
    personas,
    agents,
    parameters,
    parameterItems,
    dateStart,
    dateEnd,
    profileId,
    config.method,
    config.topPercentage,
    config.bottomPercentage,
    cohortFilters,
  ]);

  // Get method label for dialog titles
  const getMethodLabel = (isHigh: boolean) => {
    switch (config.method) {
      case "percentile":
        return isHigh
          ? `Top ${config.topPercentage}%`
          : `Bottom ${config.bottomPercentage}%`;
      case "quartile":
        return isHigh ? "Q1 (Top 25%)" : "Q4 (Bottom 25%)";
      case "standard_deviation":
        return isHigh ? "Above 1σ" : "Below 1σ";
      default:
        return isHigh ? "Top 25%" : "Bottom 25%";
    }
  };

  // Get insight text
  const getInsightText = (isHigh: boolean) => {
    const data = isHigh
      ? simulationComposition.highPerforming
      : simulationComposition.lowPerforming;
    if (data.length === 0) return "No significant patterns identified.";

    const topAttribute = data[0];
    if (!topAttribute) return "No significant patterns identified.";

    const methodLabel = getMethodLabel(isHigh);

    // Handle fallback case (no significant differences)
    if (topAttribute.significance === "none" || !topAttribute.significance) {
      return `${methodLabel} performing simulations show ${topAttribute.name.toLowerCase()} as one of the most common characteristics. This may indicate typical simulation composition rather than performance correlation.`;
    }

    const significanceText =
      topAttribute.significance === "high"
        ? "strongly"
        : topAttribute.significance === "medium"
          ? "moderately"
          : "slightly";

    // For high performing simulations, the presence of these attributes suggests they contribute to success
    // For low performing simulations, the presence of these attributes suggests they may hinder success
    const impactDirection = isHigh ? "contribute to" : "hinder";

    return `${methodLabel} performing simulations ${significanceText} tend to have more ${topAttribute.name.toLowerCase()}, suggesting that ${topAttribute.description.toLowerCase()} may ${impactDirection} better outcomes.`;
  };

  // Check if we have any data at all
  const hasAnyData =
    simulationComposition.highPerforming.length > 0 ||
    simulationComposition.lowPerforming.length > 0 ||
    (simulationComposition.highPerformingCount ?? 0) > 0 ||
    (simulationComposition.lowPerformingCount ?? 0) > 0;

  // Calculate threshold status based on performance differences
  const getThresholdStatus = () => {
    if (!hasAnyData) return "neutral";

    // Calculate average performance of high vs low performing simulations
    const highPerformingAvg =
      simulationComposition.highPerformingDetails.reduce(
        (sum, sim) => sum + sim.avgScore,
        0,
      ) / Math.max(simulationComposition.highPerformingDetails.length, 1);

    const lowPerformingAvg =
      simulationComposition.lowPerformingDetails.reduce(
        (sum, sim) => sum + sim.avgScore,
        0,
      ) / Math.max(simulationComposition.lowPerformingDetails.length, 1);

    const performanceGap = highPerformingAvg - lowPerformingAvg;

    // Determine status based on performance gap and overall performance
    if (
      performanceGap >= thresholds.success &&
      highPerformingAvg >= thresholds.success
    )
      return "success";
    if (
      performanceGap >= thresholds.warning ||
      highPerformingAvg >= thresholds.warning
    )
      return "warning";
    return "danger";
  };

  const thresholdStatus = getThresholdStatus();

  // Show no data message if no matching cohorts found
  if (!cohortFilters.hasMatchingCohorts) {
    return (
      <Card className="w-full h-full flex flex-col">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Simulation Composition
          </CardTitle>
          <CardDescription>High vs low performing simulations</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center flex-1">
          <div className="text-center space-y-2">
            <p className="text-muted-foreground">
              No data available for the selected cohorts.
            </p>
            <p className="text-xs text-muted-foreground">
              The selected profile is not a member of any of the specified
              cohorts.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!hasAnyData) {
    return (
      <Card className="w-full h-full flex flex-col">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Simulation Composition
          </CardTitle>
          <CardDescription>High vs low performing simulations</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center flex-1">
          <div className="text-center space-y-2">
            <p className="text-muted-foreground">
              No simulation data available for the selected time period.
            </p>
            <p className="text-xs text-muted-foreground">
              Try expanding the date range or check if simulations have been
              completed.
            </p>
          </div>
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
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Simulation Composition
            </CardTitle>
            <CardDescription>
              High vs low performing simulations
            </CardDescription>
          </div>
          <SimulationCompositionPicker
            currentConfig={config}
            onConfigChange={setConfig}
          />
        </div>
      </CardHeader>

      <CardContent className="space-y-4 flex-1 flex flex-col">
        {/* Show fallback message if no meaningful differences found */}
        {simulationComposition.highPerforming.length === 0 &&
          simulationComposition.lowPerforming.length === 0 &&
          (simulationComposition.highPerformingCount ?? 0) > 0 && (
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground mb-2">
                No significant differences found between high and low performing
                simulations.
              </p>
              <p className="text-xs text-muted-foreground">
                Showing top 3 most common attributes across all simulations.
              </p>
            </div>
          )}

        {/* Compact Side-by-side Charts */}
        <div className="flex-1 min-h-[300px] grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* High Performing Simulations */}
          <Dialog>
            <DialogTrigger asChild>
              <div className="cursor-pointer hover:bg-muted/50 rounded-lg p-3 transition-all duration-200 border-2 border-transparent hover:border-green-200 hover:shadow-sm">
                <div className="text-center mb-3">
                  <h3 className="font-semibold text-green-600 flex items-center justify-center gap-2 text-sm">
                    <TrendingUp className="h-4 w-4" />
                    {getMethodLabel(true)}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {simulationComposition.highPerformingCount} simulations
                  </p>
                </div>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={simulationComposition.highPerforming}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={60}
                        innerRadius={30}
                        paddingAngle={2}
                      >
                        {simulationComposition.highPerforming.map(
                          (entry, index) => (
                            <Cell
                              key={`high-cell-${index}`}
                              fill={entry.color}
                            />
                          ),
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
                {/* Compact Legend */}
                <div className="space-y-1 mt-2">
                  {simulationComposition.highPerforming
                    .slice(0, 3)
                    .map((item, index) => (
                      <div
                        key={`high-legend-${index}`}
                        className="flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-1">
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: item.color }}
                          />
                          <span className="truncate">
                            {item.icon} {item.name}
                          </span>
                        </div>
                        <span className="font-medium text-xs">
                          {item.value}
                        </span>
                      </div>
                    ))}
                  {simulationComposition.highPerforming.length > 3 && (
                    <div className="text-xs text-muted-foreground text-center">
                      +{simulationComposition.highPerforming.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                  {getMethodLabel(true)} Performing Simulations
                </DialogTitle>
                <DialogDescription>
                  Detailed breakdown of top performing simulations and their
                  characteristics
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-6">
                {/* Simulation List */}
                <div className="space-y-3">
                  <h4 className="font-medium">
                    Simulations (
                    {simulationComposition.highPerformingDetails.length})
                  </h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {simulationComposition.highPerformingDetails.map((sim) => (
                      <div
                        key={sim.id}
                        className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                      >
                        <div>
                          <p className="font-medium text-sm">{sim.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {sim.totalAttempts} attempts • {sim.scenarioCount}{" "}
                            scenarios
                          </p>
                          {/* Parameter breakdown */}
                          {sim.parameterBreakdown.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {sim.parameterBreakdown
                                .slice(0, 3)
                                .map((param, idx) => (
                                  <span
                                    key={idx}
                                    className="text-xs bg-blue-100 dark:bg-blue-900 px-1 rounded"
                                  >
                                    {param.parameterName}:{" "}
                                    {param.parameterValue}
                                  </span>
                                ))}
                              {sim.parameterBreakdown.length > 3 && (
                                <span className="text-xs text-muted-foreground">
                                  +{sim.parameterBreakdown.length - 3} more
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium">
                            {sim.avgScore}% avg
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {sim.completionRate}% completion
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Insight */}
                <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                  <p className="text-sm text-green-800 dark:text-green-200">
                    {getInsightText(true)}
                  </p>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Low Performing Simulations */}
          <Dialog>
            <DialogTrigger asChild>
              <div className="cursor-pointer hover:bg-muted/50 rounded-lg p-3 transition-all duration-200 border-2 border-transparent hover:border-red-200 hover:shadow-sm">
                <div className="text-center mb-3">
                  <h3 className="font-semibold text-red-600 flex items-center justify-center gap-2 text-sm">
                    <TrendingDown className="h-4 w-4" />
                    {getMethodLabel(false)}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {simulationComposition.lowPerformingCount} simulations
                  </p>
                </div>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={simulationComposition.lowPerforming}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={60}
                        innerRadius={30}
                        paddingAngle={2}
                      >
                        {simulationComposition.lowPerforming.map(
                          (entry, index) => (
                            <Cell
                              key={`low-cell-${index}`}
                              fill={entry.color}
                            />
                          ),
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
                {/* Compact Legend */}
                <div className="space-y-1 mt-2">
                  {simulationComposition.lowPerforming
                    .slice(0, 3)
                    .map((item, index) => (
                      <div
                        key={`low-legend-${index}`}
                        className="flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-1">
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: item.color }}
                          />
                          <span className="truncate">
                            {item.icon} {item.name}
                          </span>
                        </div>
                        <span className="font-medium text-xs">
                          {item.value}
                        </span>
                      </div>
                    ))}
                  {simulationComposition.lowPerforming.length > 3 && (
                    <div className="text-xs text-muted-foreground text-center">
                      +{simulationComposition.lowPerforming.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <TrendingDown className="h-5 w-5 text-red-600" />
                  {getMethodLabel(false)} Performing Simulations
                </DialogTitle>
                <DialogDescription>
                  Detailed breakdown of low performing simulations and their
                  characteristics
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-6">
                {/* Simulation List */}
                <div className="space-y-3">
                  <h4 className="font-medium">
                    Simulations (
                    {simulationComposition.lowPerformingDetails.length})
                  </h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {simulationComposition.lowPerformingDetails.map((sim) => (
                      <div
                        key={sim.id}
                        className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                      >
                        <div>
                          <p className="font-medium text-sm">{sim.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {sim.totalAttempts} attempts • {sim.scenarioCount}{" "}
                            scenarios
                          </p>
                          {/* Parameter breakdown */}
                          {sim.parameterBreakdown.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {sim.parameterBreakdown
                                .slice(0, 3)
                                .map((param, idx) => (
                                  <span
                                    key={idx}
                                    className="text-xs bg-red-100 dark:bg-red-900 px-1 rounded"
                                  >
                                    {param.parameterName}:{" "}
                                    {param.parameterValue}
                                  </span>
                                ))}
                              {sim.parameterBreakdown.length > 3 && (
                                <span className="text-xs text-muted-foreground">
                                  +{sim.parameterBreakdown.length - 3} more
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium">
                            {sim.avgScore}% avg
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {sim.completionRate}% completion
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Insight */}
                <div className="p-3 bg-red-50 dark:bg-red-950 rounded-lg">
                  <p className="text-sm text-red-800 dark:text-red-200">
                    {getInsightText(false)}
                  </p>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardContent>
    </Card>
  );
}
