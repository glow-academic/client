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
import { useAnalytics } from "@/contexts/analytics-context";
import { getAnalyticsDashboard } from "@/utils/api/analytics/get-dashboard";
import { BarChart3, TrendingDown, TrendingUp } from "lucide-react";
import { useState } from "react";
import SimulationCompositionPicker, {
  SimulationCompositionConfig,
} from "../SimulationCompositionPicker";

export interface SimulationCompositionProps {
  thresholds: {
    danger: number;
    warning: number;
    success: number;
  };
}

export default function SimulationComposition({
  thresholds,
}: SimulationCompositionProps) {
  // Configuration state
  const [config, setConfig] = useState<SimulationCompositionConfig>({
    method: "percentile",
    topPercentage: 25,
    bottomPercentage: 25,
    description: "Top 25% vs Bottom 25% - Best vs Worst",
  });
  const {
    startDate,
    endDate,
    selectedCohortIds,
    selectedRoles,
    simulationFilters,
  } = useAnalytics();
  const [simulationComposition, setSimulationComposition] = useState<{
    highPerforming: Array<{ name: string; value: number; icon?: string }>;
    lowPerforming: Array<{ name: string; value: number; icon?: string }>;
    highPerformingCount: number;
    lowPerformingCount: number;
    highPerformingDetails: Array<{
      id: string;
      title: string;
      avgScore: number;
      completionRate: number;
      totalAttempts: number;
      scenarioCount: number;
      parameterBreakdown: Array<{
        parameterName: string;
        parameterValue: string;
      }>;
    }>;
    lowPerformingDetails: Array<{
      id: string;
      title: string;
      avgScore: number;
      completionRate: number;
      totalAttempts: number;
      scenarioCount: number;
      parameterBreakdown: Array<{
        parameterName: string;
        parameterValue: string;
      }>;
    }>;
  }>({
    highPerforming: [],
    lowPerforming: [],
    highPerformingCount: 0,
    lowPerformingCount: 0,
    highPerformingDetails: [],
    lowPerformingDetails: [],
  });

  useEffect(() => {
    let aborted = false;
    async function run() {
      try {
        const data = await getAnalyticsDashboard(
          {
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            cohortIds: selectedCohortIds,
            roles: selectedRoles,
            simulationFilters,
          },
          [
            {
              name: "calculateSimulationComposition",
              args: { config },
            },
          ]
        );
        if (!aborted) {
          const payload =
            (data.results[
              "calculateSimulationComposition"
            ] as typeof simulationComposition) ?? simulationComposition;
          setSimulationComposition(payload);
        }
      } catch {
        if (!aborted)
          setSimulationComposition({
            highPerforming: [],
            lowPerforming: [],
            highPerformingCount: 0,
            lowPerformingCount: 0,
            highPerformingDetails: [],
            lowPerformingDetails: [],
          });
      }
    }
    run();
    return () => {
      aborted = true;
    };
  }, [
    startDate,
    endDate,
    selectedCohortIds,
    selectedRoles,
    simulationFilters,
    config,
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

    return `${methodLabel} performing simulations ${significanceText} tend to have more ${topAttribute.name}, suggesting that ${topAttribute.description} may ${impactDirection} better outcomes.`;
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
