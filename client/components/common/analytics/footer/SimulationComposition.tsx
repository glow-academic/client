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
import type {
  SimulationFact,
  SimulationParameterFactCategorical,
  SimulationParameterFactNumeric,
} from "@/lib/analytics";
import { Parameter, ParameterItem, Simulation } from "@/types";
import { BarChart3, TrendingDown, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";

type SimulationCompositionConfig = {
  method: "percentile" | "quartile" | "standard_deviation";
  topPercentage: number;
  bottomPercentage: number;
  description: string;
};

type HighLowPerforming = {
  name: string;
  value: number;
  icon: string;
  color: string;
  description: string;
  significance: "high" | "medium" | "low" | "none";
};

export interface SimulationCompositionProps {
  simulationFacts: SimulationFact[];
  simulationParameterFactsCategorical: SimulationParameterFactCategorical[];
  simulationParameterFactsNumeric: SimulationParameterFactNumeric[];
  allSimulations: Simulation[];
  allParameters: Parameter[];
  allParameterItems: ParameterItem[];
  isLoading: boolean;
  isError: boolean;
  actionableInsight?: string | null;
  thresholds: {
    danger: number;
    warning: number;
    success: number; 
  };
}

export default function SimulationComposition({
  simulationFacts,
  simulationParameterFactsCategorical,
  simulationParameterFactsNumeric,
  allSimulations: _allSimulations,
  allParameters,
  allParameterItems,
  isLoading,
  isError,
  actionableInsight,
  thresholds,
}: SimulationCompositionProps) {
  const [config, setConfig] = useState<SimulationCompositionConfig>({
    method: "percentile",
    topPercentage: 25,
    bottomPercentage: 25,
    description: "Top 25% vs Bottom 25% - Best vs Worst",
  });

  // Compute high and low performing simulations based on config
  const {
    highPerforming,
    lowPerforming,
    highPerformingDetails,
    lowPerformingDetails,
  } = useMemo(() => {
    if (simulationFacts.length === 0) {
      return {
        highPerforming: [],
        lowPerforming: [],
        highPerformingDetails: [],
        lowPerformingDetails: [],
      };
    }

    // Sort simulations by average score
    const sortedSims = [...simulationFacts].sort(
      (a, b) => b.avgScore - a.avgScore
    );

    let topCount: number;
    let bottomCount: number;

    switch (config.method) {
      case "percentile":
        topCount = Math.max(
          1,
          Math.floor((config.topPercentage / 100) * sortedSims.length)
        );
        bottomCount = Math.max(
          1,
          Math.floor((config.bottomPercentage / 100) * sortedSims.length)
        );
        break;
      case "quartile":
        topCount = Math.max(1, Math.floor(sortedSims.length / 4));
        bottomCount = Math.max(1, Math.floor(sortedSims.length / 4));
        break;
      case "standard_deviation":
        const avgScore =
          sortedSims.reduce((sum, sim) => sum + sim.avgScore, 0) /
          sortedSims.length;
        const variance =
          sortedSims.reduce(
            (sum, sim) => sum + Math.pow(sim.avgScore - avgScore, 2),
            0
          ) / sortedSims.length;
        const stdDev = Math.sqrt(variance);
        topCount = sortedSims.filter(
          (sim) => sim.avgScore >= avgScore + stdDev
        ).length;
        bottomCount = sortedSims.filter(
          (sim) => sim.avgScore <= avgScore - stdDev
        ).length;
        break;
      default:
        topCount = 1;
        bottomCount = 1;
    }

    const topSims = sortedSims.slice(0, topCount);
    const bottomSims = sortedSims.slice(-bottomCount);

    // Build parameter composition for high performers
    const highPerforming = buildParameterComposition(
      topSims,
      simulationParameterFactsCategorical,
      simulationParameterFactsNumeric,
      allParameters,
      allParameterItems
    );

    // Build parameter composition for low performers
    const lowPerforming = buildParameterComposition(
      bottomSims,
      simulationParameterFactsCategorical,
      simulationParameterFactsNumeric,
      allParameters,
      allParameterItems
    );

    // Build detailed simulation information
    const highPerformingDetails = topSims.map((sim) => ({
      id: sim.simulationId,
      title: sim.title,
      avgScore: sim.avgScore,
      completionRate: sim.completionRate,
      totalAttempts: sim.totalAttempts,
      scenarioCount: sim.scenarioCount,
      parameterBreakdown: buildParameterBreakdown(
        sim.simulationId,
        simulationParameterFactsCategorical,
        simulationParameterFactsNumeric,
        allParameters,
        allParameterItems
      ),
    }));

    const lowPerformingDetails = bottomSims.map((sim) => ({
      id: sim.simulationId,
      title: sim.title,
      avgScore: sim.avgScore,
      completionRate: sim.completionRate,
      totalAttempts: sim.totalAttempts,
      scenarioCount: sim.scenarioCount,
      parameterBreakdown: buildParameterBreakdown(
        sim.simulationId,
        simulationParameterFactsCategorical,
        simulationParameterFactsNumeric,
        allParameters,
        allParameterItems
      ),
    }));

    return {
      highPerforming,
      lowPerforming,
      highPerformingDetails,
      lowPerformingDetails,
    };
  }, [
    simulationFacts,
    config,
    simulationParameterFactsCategorical,
    simulationParameterFactsNumeric,
    allParameters,
    allParameterItems,
  ]);

  // Compute threshold status
  const getThresholdStatus = () => {
    if (simulationFacts.length === 0) return "neutral";

    const avgScore =
      simulationFacts.reduce((sum, sim) => sum + sim.avgScore, 0) /
      simulationFacts.length;
    const avgCompletion =
      simulationFacts.reduce((sum, sim) => sum + sim.completionRate, 0) /
      simulationFacts.length;

    if (avgScore >= thresholds.success && avgCompletion >= 80) return "success";
    if (avgScore >= thresholds.warning || avgCompletion >= 70) return "warning";
    return "danger";
  };

  const thresholdStatus = getThresholdStatus();

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

  if (isLoading) {
    return (
      <Card className="w-full h-full flex flex-col">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Simulation Composition
          </CardTitle>
          <CardDescription>High vs low performing simulations</CardDescription>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
            <p className="text-sm text-muted-foreground">
              Loading simulation composition...
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className="w-full h-full flex flex-col">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Simulation Composition
          </CardTitle>
          <CardDescription>High vs low performing simulations</CardDescription>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              Failed to load simulation composition data.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full h-full flex flex-col relative">
      <div
        data-testid="status-indicator"
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
        {highPerforming.length === 0 &&
          lowPerforming.length === 0 &&
          simulationFacts.length > 0 && (
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
                      {highPerformingDetails.length} simulations
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
                        {highPerforming.slice(0, 8).map((item, index) => (
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
                      Simulations ({highPerformingDetails.length})
                    </h4>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {highPerformingDetails.map((sim) => (
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
                      {lowPerformingDetails.length} simulations
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
                        {lowPerforming.slice(0, 8).map((item, index) => (
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
                      Simulations ({lowPerformingDetails.length})
                    </h4>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {lowPerformingDetails.map((sim) => (
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
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Actionable Insights */}
        {actionableInsight && (
          <div className="p-4 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">{actionableInsight}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Helper function to build parameter composition
function buildParameterComposition(
  simulations: SimulationFact[],
  categoricalFacts: SimulationParameterFactCategorical[],
  numericFacts: SimulationParameterFactNumeric[],
  allParameters: Parameter[],
  allParameterItems: ParameterItem[]
): HighLowPerforming[] {
  const parameterCounts = new Map<
    string,
    {
      count: number;
      name: string;
      icon: string;
      color: string;
      description: string;
    }
  >();

  // Process categorical parameters
  for (const fact of categoricalFacts) {
    if (simulations.some((sim) => sim.simulationId === fact.simulationId)) {
      const parameter = allParameters.find((p) => p.id === fact.parameterId);
      const parameterItem = allParameterItems.find(
        (pi) => pi.id === fact.parameterItemId
      );

      if (parameter && parameterItem) {
        const key = `${parameter.name}:${parameterItem.name}`;
        const existing = parameterCounts.get(key);
        if (existing) {
          existing.count += fact.scenarioCount;
        } else {
          parameterCounts.set(key, {
            count: fact.scenarioCount,
            name: parameterItem.name,
            icon: parameterItem.description || "📊",
            color: parameterItem.value || "#888888",
            description: "",
          });
        }
      }
    }
  }

  // Process numeric parameters
  for (const fact of numericFacts) {
    if (simulations.some((sim) => sim.simulationId === fact.simulationId)) {
      const parameter = allParameters.find((p) => p.id === fact.parameterId);

      if (parameter) {
        const key = `${parameter.name}:${fact.levelLabel}`;
        const existing = parameterCounts.get(key);
        if (existing) {
          existing.count += fact.scenarioCount;
        } else {
          parameterCounts.set(key, {
            count: fact.scenarioCount,
            name: `${parameter.name} ${fact.levelLabel}`,
            icon: "📈",
            color: "#3b82f6",
            description: "",
          });
        }
      }
    }
  }

  // Convert to array and sort by count
  return Array.from(parameterCounts.entries())
    .map(([_key, data]) => ({
      name: data.name,
      value: data.count,
      icon: data.icon,
      color: data.color,
      description: data.description,
      significance:
        data.count > 5
          ? "high"
          : data.count > 2
            ? "medium"
            : ("low" as "high" | "medium" | "low" | "none"),
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);
}

// Helper function to build parameter breakdown for a simulation
function buildParameterBreakdown(
  simulationId: string,
  categoricalFacts: SimulationParameterFactCategorical[],
  numericFacts: SimulationParameterFactNumeric[],
  allParameters: Parameter[],
  allParameterItems: ParameterItem[]
): { parameterName: string; parameterValue: string; isNumerical: boolean }[] {
  const breakdown: {
    parameterName: string;
    parameterValue: string;
    isNumerical: boolean;
  }[] = [];

  // Add categorical parameters
  for (const fact of categoricalFacts) {
    if (fact.simulationId === simulationId) {
      const parameter = allParameters.find((p) => p.id === fact.parameterId);
      const parameterItem = allParameterItems.find(
        (pi) => pi.id === fact.parameterItemId
      );

      if (parameter && parameterItem) {
        breakdown.push({
          parameterName: parameter.name,
          parameterValue: parameterItem.name,
          isNumerical: false,
        });
      }
    }
  }

  // Add numeric parameters
  for (const fact of numericFacts) {
    if (fact.simulationId === simulationId) {
      const parameter = allParameters.find((p) => p.id === fact.parameterId);

      if (parameter) {
        breakdown.push({
          parameterName: parameter.name,
          parameterValue: fact.levelLabel,
          isNumerical: true,
        });
      }
    }
  }

  return breakdown;
}

// Configuration picker component
function SimulationCompositionPicker({
  currentConfig,
  onConfigChange,
}: {
  currentConfig: SimulationCompositionConfig;
  onConfigChange: (config: SimulationCompositionConfig) => void;
}) {
  const configs: SimulationCompositionConfig[] = [
    {
      method: "percentile",
      topPercentage: 25,
      bottomPercentage: 25,
      description: "Top 25% vs Bottom 25% - Best vs Worst",
    },
    {
      method: "percentile",
      topPercentage: 10,
      bottomPercentage: 10,
      description: "Top 10% vs Bottom 10% - Elite vs Struggling",
    },
    {
      method: "quartile",
      topPercentage: 25,
      bottomPercentage: 25,
      description: "Q1 vs Q4 - Quartile Analysis",
    },
    {
      method: "standard_deviation",
      topPercentage: 0,
      bottomPercentage: 0,
      description: "Above 1σ vs Below 1σ - Statistical Analysis",
    },
  ];

  return (
    <div className="flex items-center gap-2">
      <select
        value={configs.findIndex(
          (c) =>
            c.method === currentConfig.method &&
            c.topPercentage === currentConfig.topPercentage &&
            c.bottomPercentage === currentConfig.bottomPercentage
        )}
        onChange={(e) => {
          const selectedConfig = configs[parseInt(e.target.value)];
          if (selectedConfig) {
            onConfigChange(selectedConfig);
          }
        }}
        className="text-xs border rounded px-2 py-1 bg-background"
      >
        {configs.map((config, index) => (
          <option key={index} value={index}>
            {config.description}
          </option>
        ))}
      </select>
    </div>
  );
}
