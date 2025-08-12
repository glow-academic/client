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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { calculateSimulationComposition } from "@/utils/analytics/footer";
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
import { BarChart3, TrendingDown, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";
import SimulationCompositionPicker, {
  SimulationCompositionConfig,
} from "../SimulationCompositionPicker";
import { profileRole } from "@/utils/drizzle/schema";

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
  selectedRoles: (typeof profileRole.enumValues)[number][];
  showPractice: boolean;
  showNormal: boolean;
}

export default function SimulationComposition({
  dateStart,
  dateEnd,
  profileId,
  cohortIds,
  thresholds,
  selectedRoles,
  showPractice,
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

  // Calculate simulation composition data using utility function
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
        highPerformingCount: 0,
        lowPerformingCount: 0,
        highPerformingDetails: [],
        lowPerformingDetails: [],
      };
    }

    return calculateSimulationComposition(
      grades,
      chats,
      attempts,
      simulations,
      scenarios,
      profiles,
      parameters,
      parameterItems,
      dateStart,
      dateEnd,
      profileId,
      cohorts || [],
      cohortIds,
      config,
      selectedRoles,
      showPractice
    );
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
    cohorts,
    cohortIds,
    config,
    selectedRoles,
    showPractice,
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
        0
      ) / Math.max(simulationComposition.highPerformingDetails.length, 1);

    const lowPerformingAvg =
      simulationComposition.lowPerformingDetails.reduce(
        (sum, sim) => sum + sim.avgScore,
        0
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
  if (
    !cohorts ||
    cohortIds.length === 0 ||
    !cohorts.some((cohort) => cohortIds.includes(cohort.id))
  ) {
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

        {/* Parameter Comparison Table */}
        <div className="flex-1 min-h-[300px]">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-full">
            {/* High Performing Side */}
            <Dialog>
              <DialogTrigger asChild>
                <div className="cursor-pointer hover:bg-muted/50 rounded-lg p-3 transition-all duration-200 border-2 border-transparent hover:border-green-200 hover:shadow-sm h-full">
                  <div className="text-center mb-3">
                    <h3 className="font-semibold text-green-600 flex items-center justify-center gap-2 text-sm">
                      <TrendingUp className="h-4 w-4" />
                      {getMethodLabel(true)}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {simulationComposition.highPerformingCount} simulations
                    </p>
                  </div>

                  <div className="overflow-x-auto flex-1">
                    <Table className="w-full">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="p-2 text-xs">
                            Parameter
                          </TableHead>
                          <TableHead className="p-2 text-xs text-center">
                            Count
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {simulationComposition.highPerforming
                          .slice(0, 8)
                          .map((item, index) => (
                            <TableRow key={`high-${index}`}>
                              <TableCell className="p-2 text-xs">
                                <div className="flex items-center gap-1">
                                  <span>{item.icon}</span>
                                  <span className="truncate">{item.name}</span>
                                </div>
                              </TableCell>
                              <TableCell className="p-2 text-xs text-center font-mono">
                                {item.value}
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-green-600" />
                    {getMethodLabel(true)} Performing Simulations
                  </DialogTitle>
                  <DialogDescription hidden>
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
                      {simulationComposition.highPerformingDetails.map(
                        (sim) => (
                          <div
                            key={sim.id}
                            className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                          >
                            <div>
                              <p className="font-medium text-sm">{sim.title}</p>
                              <p className="text-xs text-muted-foreground">
                                {sim.totalAttempts} attempts •{" "}
                                {sim.scenarioCount} scenarios
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
                        )
                      )}
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

            {/* Low Performing Side */}
            <Dialog>
              <DialogTrigger asChild>
                <div className="cursor-pointer hover:bg-muted/50 rounded-lg p-3 transition-all duration-200 border-2 border-transparent hover:border-red-200 hover:shadow-sm h-full">
                  <div className="text-center mb-3">
                    <h3 className="font-semibold text-red-600 flex items-center justify-center gap-2 text-sm">
                      <TrendingDown className="h-4 w-4" />
                      {getMethodLabel(false)}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {simulationComposition.lowPerformingCount} simulations
                    </p>
                  </div>

                  <div className="overflow-x-auto flex-1">
                    <Table className="w-full">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="p-2 text-xs">
                            Parameter
                          </TableHead>
                          <TableHead className="p-2 text-xs text-center">
                            Count
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {simulationComposition.lowPerforming
                          .slice(0, 8)
                          .map((item, index) => (
                            <TableRow key={`low-${index}`}>
                              <TableCell className="p-2 text-xs">
                                <div className="flex items-center gap-1">
                                  <span>{item.icon}</span>
                                  <span className="truncate">{item.name}</span>
                                </div>
                              </TableCell>
                              <TableCell className="p-2 text-xs text-center font-mono">
                                {item.value}
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <TrendingDown className="h-5 w-5 text-red-600" />
                    {getMethodLabel(false)} Performing Simulations
                  </DialogTitle>
                  <DialogDescription hidden>
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
        </div>
      </CardContent>
    </Card>
  );
}
