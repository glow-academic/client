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
import { TruncatedInsight } from "../TruncatedInsight";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BarChart3, TrendingDown, TrendingUp } from "lucide-react";

type SimulationFact = {
  simulationId: string;
  title: string;
  avgScore: number;
  completionRate: number;
  totalAttempts: number;
  scenarioCount: number;
};

type SimulationParameterFactCategorical = {
  simulationId: string;
  parameterId: string;
  parameterItemId: string;
  scenarioCount: number;
};

type SimulationParameterFactNumeric = {
  simulationId: string;
  parameterId: string;
  avgLevel: number;
  levelLabel: string;
  scenarioCount: number;
};

import { useMemo, useState } from "react";
import SimulationCompositionPicker, {
  SimulationCompositionConfig,
} from "../SimulationCompositionPicker";

type HighLowPerforming = {
  name: string;
  value: number;
  icon: string;
  color: string;
  description: string;
  significance: "high" | "medium" | "low" | "none";
};

// Local types for this component's internal use
type LocalParameter = {
  id: string;
  name: string;
  description: string;
};

type LocalParameterItem = {
  id: string;
  name: string;
  description: string;
  parameterId: string;
};

export interface SimulationCompositionProps {
  simulationFacts: SimulationFact[];
  simulationParameterFactsCategorical: SimulationParameterFactCategorical[];
  simulationParameterFactsNumeric: SimulationParameterFactNumeric[];
  /** Simulation mapping object */
  simulationMapping: Record<string, { name: string; description: string }>;
  /** Parameter mapping object */
  parameterMapping: Record<string, { name: string; description: string }>;
  /** Parameter item mapping object */
  parameterItemMapping: Record<
    string,
    {
      name: string;
      description: string;
      parameter_id: string;
      parameter_name: string;
    }
  >;
  /** Valid simulation IDs */
  validSimulationIds: string[];
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
  simulationMapping: _simulationMapping,
  parameterMapping,
  parameterItemMapping,
  validSimulationIds: _validSimulationIds,
  actionableInsight,
  thresholds,
}: SimulationCompositionProps) {
  // Build entities from mappings
  const allParameters = useMemo(
    (): LocalParameter[] =>
      Object.entries(parameterMapping).map(([id, param]) => ({
        id,
        name: param.name,
        description: param.description || "",
      })),
    [parameterMapping],
  );

  const allParameterItems = useMemo(
    (): LocalParameterItem[] =>
      Object.entries(parameterItemMapping).map(([id, item]) => ({
        id,
        name: item.name,
        description: item.description || "",
        parameterId: item.parameter_id,
      })),
    [parameterItemMapping],
  );

  const [config, setConfig] = useState<SimulationCompositionConfig>({
    method: "percentile",
    topPercentage: 25,
    bottomPercentage: 25,
    description: "Top 25% vs Bottom 25% - Best vs Worst",
  });

  // Create a global color mapping for parameter items
  const parameterItemColorMap = useMemo(() => {
    const colorMap = new Map<string, string>();

    // Process all parameter items to create unique color mapping
    [
      ...simulationParameterFactsCategorical,
      ...simulationParameterFactsNumeric,
    ].forEach((fact) => {
      let key: string;
      if ("parameterItemId" in fact) {
        key = fact.parameterId + ":" + fact.parameterItemId;
      } else {
        key = fact.parameterId + ":" + fact.levelLabel;
      }

      if (!colorMap.has(key)) {
        const isNumeric = simulationParameterFactsNumeric.some(
          (nf) => nf.parameterId === fact.parameterId,
        );
        colorMap.set(key, getParameterColor(key, isNumeric));
      }
    });

    return colorMap;
  }, [simulationParameterFactsCategorical, simulationParameterFactsNumeric]);

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
      (a, b) => b.avgScore - a.avgScore,
    );

    let topCount: number;
    let bottomCount: number;

    switch (config.method) {
      case "percentile":
        topCount = Math.max(
          1,
          Math.floor((config.topPercentage / 100) * sortedSims.length),
        );
        bottomCount = Math.max(
          1,
          Math.floor((config.bottomPercentage / 100) * sortedSims.length),
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
            0,
          ) / sortedSims.length;
        const stdDev = Math.sqrt(variance);
        topCount = sortedSims.filter(
          (sim) => sim.avgScore >= avgScore + stdDev,
        ).length;
        bottomCount = sortedSims.filter(
          (sim) => sim.avgScore <= avgScore - stdDev,
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
      allParameterItems,
      parameterItemColorMap,
    );

    // Build parameter composition for low performers
    const lowPerforming = buildParameterComposition(
      bottomSims,
      simulationParameterFactsCategorical,
      simulationParameterFactsNumeric,
      allParameters,
      allParameterItems,
      parameterItemColorMap,
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
        allParameterItems,
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
        allParameterItems,
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
    parameterItemColorMap,
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
        <div className="flex-1 min-h-[260px]">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
            {/* High Performing Side */}
            <Dialog>
              <DialogTrigger asChild>
                <div className="cursor-pointer hover:bg-muted/50 rounded-lg p-3 transition-all duration-200 border-2 border-transparent hover:border-green-200 hover:shadow-sm">
                  <div className="text-center mb-3">
                    <h3 className="font-semibold text-green-600 flex items-center justify-center gap-1 text-sm">
                      <TrendingUp className="h-3 w-3" />
                      {getMethodLabel(true)}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {highPerformingDetails.length} simulations
                    </p>
                  </div>
                  <div className="flex-1">
                    <div className="max-h-64 overflow-auto rounded-md">
                      <Table className="w-full table-fixed">
                        <colgroup>
                          <col className="w-[75%]" />
                          <col className="w-[25%]" />
                        </colgroup>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="p-2 text-xs leading-snug">
                              Parameter
                            </TableHead>
                            <TableHead className="p-2 text-xs leading-snug w-16 text-right">
                              Count
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {highPerforming.slice(0, 5).map((item, index) => (
                            <TableRow
                              key={`high-${index}`}
                              className="hover:bg-muted/50"
                            >
                              <TableCell className="p-2 text-xs leading-snug">
                                <div className="flex items-center gap-2 min-w-0">
                                  <div
                                    className="w-2 h-2 rounded-full shrink-0"
                                    style={{ backgroundColor: item.color }}
                                  />
                                  <span
                                    className="truncate text-xs"
                                    title={item.name}
                                  >
                                    {item.name}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="p-2 text-xs font-mono tabular-nums text-right w-16 shrink-0">
                                {item.value}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
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
                <div className="cursor-pointer hover:bg-muted/50 rounded-lg p-3 transition-all duration-200 border-2 border-transparent hover:border-red-200 hover:shadow-sm">
                  <div className="text-center mb-3">
                    <h3 className="font-semibold text-red-600 flex items-center justify-center gap-1 text-sm">
                      <TrendingDown className="h-3 w-3" />
                      {getMethodLabel(false)}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {lowPerformingDetails.length} simulations
                    </p>
                  </div>
                  <div className="flex-1">
                    <div className="max-h-64 overflow-auto rounded-md">
                      <Table className="w-full table-fixed">
                        <colgroup>
                          <col className="w-[75%]" />
                          <col className="w-[25%]" />
                        </colgroup>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="p-2 text-xs leading-snug">
                              Parameter
                            </TableHead>
                            <TableHead className="p-2 text-xs leading-snug w-16 text-right">
                              Count
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {lowPerforming.slice(0, 5).map((item, index) => (
                            <TableRow
                              key={`low-${index}`}
                              className="hover:bg-muted/50"
                            >
                              <TableCell className="p-2 text-xs leading-snug">
                                <div className="flex items-center gap-2 min-w-0">
                                  <div
                                    className="w-2 h-2 rounded-full shrink-0"
                                    style={{ backgroundColor: item.color }}
                                  />
                                  <span
                                    className="truncate text-xs"
                                    title={item.name}
                                  >
                                    {item.name}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="p-2 text-xs font-mono tabular-nums text-right w-16 shrink-0">
                                {item.value}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
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
        {actionableInsight && <TruncatedInsight text={actionableInsight} />}
      </CardContent>
    </Card>
  );
}

// Helper function to get color based on parameter ID
function getParameterColor(parameterId: string, isNumeric: boolean): string {
  const colors = {
    numeric: [
      "#3b82f6", // blue
      "#10b981", // emerald
      "#f59e0b", // amber
      "#ef4444", // red
      "#8b5cf6", // violet
      "#06b6d4", // cyan
      "#84cc16", // lime
      "#f97316", // orange
    ],
    categorical: [
      "#ec4899", // pink
      "#14b8a6", // teal
      "#6366f1", // indigo
      "#f43f5e", // rose
      "#8b5cf6", // purple
      "#06b6d4", // sky
      "#10b981", // green
      "#f59e0b", // yellow
    ],
  };

  // Use parameter ID as seed for consistent color selection
  let hash = 0;
  for (let i = 0; i < parameterId.length; i++) {
    const char = parameterId.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }

  const colorSet = isNumeric ? colors.numeric : colors.categorical;
  const index = Math.abs(hash) % colorSet.length;
  return colorSet[index] || "#6b7280";
}

// Helper function to build parameter composition
function buildParameterComposition(
  simulations: SimulationFact[],
  categoricalFacts: SimulationParameterFactCategorical[],
  numericFacts: SimulationParameterFactNumeric[],
  allParameters: LocalParameter[],
  allParameterItems: LocalParameterItem[],
  parameterItemColorMap: Map<string, string>,
): HighLowPerforming[] {
  const parameterCounts = new Map<
    string,
    {
      count: number;
      name: string;
      icon: string;
      color: string;
      description: string;
      isNumeric: boolean;
    }
  >();

  // Process categorical parameters
  for (const fact of categoricalFacts) {
    if (simulations.some((sim) => sim.simulationId === fact.simulationId)) {
      const parameter = allParameters.find((p) => p.id === fact.parameterId);
      const parameterItem = allParameterItems.find(
        (pi) => pi.id === fact.parameterItemId,
      );

      if (parameter && parameterItem) {
        const key = `${parameter.name}:${parameterItem.name}`;
        const existing = parameterCounts.get(key);
        if (existing) {
          existing.count += fact.scenarioCount;
        } else {
          const itemKey = fact.parameterId + ":" + fact.parameterItemId;
          parameterCounts.set(key, {
            count: fact.scenarioCount,
            name: parameterItem.name,
            icon: "",
            color: parameterItemColorMap.get(itemKey) || "#6b7280",
            description: "",
            isNumeric: false,
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
          const itemKey = fact.parameterId + ":" + fact.levelLabel;
          parameterCounts.set(key, {
            count: fact.scenarioCount,
            name: `${parameter.name} ${fact.levelLabel}`,
            icon: "",
            color: parameterItemColorMap.get(itemKey) || "#6b7280",
            description: "",
            isNumeric: true,
          });
        }
      }
    }
  }

  // Convert to array and sort by count
  const allParametersArray = Array.from(parameterCounts.entries())
    .map(([_key, data]) => ({
      name: data.name,
      value: data.count,
      icon: data.icon,
      color: data.color,
      description: data.description,
      isNumeric: data.isNumeric,
      significance:
        data.count > 5
          ? "high"
          : data.count > 2
            ? "medium"
            : ("low" as "high" | "medium" | "low" | "none"),
    }))
    .sort((a, b) => b.value - a.value);

  return allParametersArray;
}

// Helper function to build parameter breakdown for a simulation
function buildParameterBreakdown(
  simulationId: string,
  categoricalFacts: SimulationParameterFactCategorical[],
  numericFacts: SimulationParameterFactNumeric[],
  allParameters: LocalParameter[],
  allParameterItems: LocalParameterItem[],
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
        (pi) => pi.id === fact.parameterItemId,
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
