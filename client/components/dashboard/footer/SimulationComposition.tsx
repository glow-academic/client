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
import { BarChart3, TrendingDown, TrendingUp } from "lucide-react";
import { TruncatedInsight } from "../TruncatedInsight";

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

import { cn } from "@/lib/utils";
import { useEffect, useMemo, useState } from "react";
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
  status: "success" | "warning" | "danger" | "neutral";
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
  status,
}: SimulationCompositionProps) {
  // Build entities from mappings
  const allParameters = useMemo(
    (): LocalParameter[] =>
      Object.entries(parameterMapping).map(([id, param]) => ({
        id,
        name: param.name,
        description: param.description || "",
      })),
    [parameterMapping]
  );

  const allParameterItems = useMemo(
    (): LocalParameterItem[] =>
      Object.entries(parameterItemMapping).map(([id, item]) => ({
        id,
        name: item.name,
        description: item.description || "",
        parameterId: item.parameter_id,
      })),
    [parameterItemMapping]
  );

  const [config, setConfig] = useState<SimulationCompositionConfig>({
    method: "percentile",
    topPercentage: 25,
    bottomPercentage: 25,
    description: "Top 25% vs Bottom 25% - Best vs Worst",
  });

  // Track mobile viewport for responsive design
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024); // lg breakpoint
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

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
          (nf) => nf.parameterId === fact.parameterId
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
      allParameterItems,
      parameterItemColorMap
    );

    // Build parameter composition for low performers
    const lowPerforming = buildParameterComposition(
      bottomSims,
      simulationParameterFactsCategorical,
      simulationParameterFactsNumeric,
      allParameters,
      allParameterItems,
      parameterItemColorMap
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
    parameterItemColorMap,
  ]);

  // Use status from server
  const thresholdStatus = status;

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
            ? "bg-success"
            : thresholdStatus === "warning"
              ? "bg-warning"
              : thresholdStatus === "danger"
                ? "bg-destructive"
                : "bg-muted-foreground"
        }`}
      />
      <CardHeader className={cn("pb-3", isMobile && "pb-2")}>
        <div
          className={cn(
            "flex",
            isMobile ? "flex-col gap-2" : "items-center justify-between"
          )}
        >
          <div>
            <CardTitle
              className={cn(
                "flex items-center gap-2",
                isMobile ? "text-sm" : "text-base"
              )}
            >
              <BarChart3 className={cn(isMobile ? "h-3 w-3" : "h-4 w-4")} />
              Simulation Composition
            </CardTitle>
            <CardDescription
              className={cn(isMobile ? "text-[10px]" : "text-xs")}
            >
              {isMobile
                ? "High vs low performing"
                : "High vs low performing simulations"}
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
            <div
              className={cn(
                "text-center bg-muted/50 rounded-lg",
                isMobile ? "p-2" : "p-4"
              )}
            >
              <p
                className={cn(
                  "text-muted-foreground",
                  isMobile ? "text-xs mb-1" : "text-sm mb-2"
                )}
              >
                No significant differences found between high and low performing
                simulations.
              </p>
              <p
                className={cn(
                  "text-muted-foreground",
                  isMobile ? "text-[10px]" : "text-xs"
                )}
              >
                Showing top 3 most common attributes across all simulations.
              </p>
            </div>
          )}

        {/* Parameter Comparison Table */}
        <div
          className={cn("flex-1", isMobile ? "min-h-[180px]" : "min-h-[260px]")}
        >
          <div
            className={cn(
              "grid items-start",
              isMobile
                ? "grid-cols-1 gap-2"
                : "grid-cols-1 lg:grid-cols-2 gap-4"
            )}
          >
            {/* High Performing Side */}
            <Dialog>
              <DialogTrigger asChild>
                <div
                  className={cn(
                    "cursor-pointer hover:bg-muted/50 rounded-lg transition-all duration-200 border-2 border-transparent hover:border-green-200 hover:shadow-sm",
                    isMobile ? "p-2" : "p-3"
                  )}
                >
                  <div
                    className={cn("text-center", isMobile ? "mb-2" : "mb-3")}
                  >
                    <h3
                      className={cn(
                        "font-semibold text-green-600 flex items-center justify-center gap-1",
                        isMobile ? "text-xs" : "text-sm"
                      )}
                    >
                      <TrendingUp
                        className={cn(isMobile ? "h-2.5 w-2.5" : "h-3 w-3")}
                      />
                      {getMethodLabel(true)}
                    </h3>
                    <p
                      className={cn(
                        "text-muted-foreground",
                        isMobile ? "text-[10px]" : "text-xs"
                      )}
                    >
                      {highPerformingDetails.length} simulations
                    </p>
                  </div>
                  <div className="flex-1">
                    <div
                      className={cn(
                        "overflow-auto rounded-md",
                        isMobile ? "max-h-48" : "max-h-64"
                      )}
                    >
                      <Table className="w-full table-fixed">
                        <colgroup>
                          <col className="w-[75%]" />
                          <col className="w-[25%]" />
                        </colgroup>
                        <TableHeader>
                          <TableRow>
                            <TableHead
                              className={cn(
                                "leading-snug",
                                isMobile ? "p-1 text-[10px]" : "p-2 text-xs"
                              )}
                            >
                              Parameter
                            </TableHead>
                            <TableHead
                              className={cn(
                                "leading-snug text-right shrink-0",
                                isMobile
                                  ? "p-1 text-[10px] w-12"
                                  : "p-2 text-xs w-16"
                              )}
                            >
                              Count
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {highPerforming
                            .slice(0, isMobile ? 4 : 5)
                            .map((item, index) => (
                              <TableRow
                                key={`high-${index}`}
                                className="hover:bg-muted/50"
                              >
                                <TableCell
                                  className={cn(
                                    "leading-snug",
                                    isMobile ? "p-1" : "p-2"
                                  )}
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <div
                                      className={cn(
                                        "rounded-full shrink-0",
                                        isMobile ? "w-1.5 h-1.5" : "w-2 h-2"
                                      )}
                                      style={{ backgroundColor: item.color }}
                                    />
                                    <span
                                      className={cn(
                                        "truncate",
                                        isMobile ? "text-[10px]" : "text-xs"
                                      )}
                                      title={item.name}
                                    >
                                      {item.name}
                                    </span>
                                  </div>
                                </TableCell>
                                <TableCell
                                  className={cn(
                                    "font-mono tabular-nums text-right shrink-0",
                                    isMobile
                                      ? "p-1 text-[10px] w-12"
                                      : "p-2 text-xs w-16"
                                  )}
                                >
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
                <div
                  className={cn(
                    "cursor-pointer hover:bg-muted/50 rounded-lg transition-all duration-200 border-2 border-transparent hover:border-red-200 hover:shadow-sm",
                    isMobile ? "p-1.5" : "p-3"
                  )}
                >
                  <div
                    className={cn("text-center", isMobile ? "mb-1.5" : "mb-3")}
                  >
                    <h3
                      className={cn(
                        "font-semibold text-red-600 flex items-center justify-center gap-0.5",
                        isMobile ? "text-[10px]" : "text-sm"
                      )}
                    >
                      <TrendingDown
                        className={cn(isMobile ? "h-2 w-2" : "h-3 w-3")}
                      />
                      <span className="truncate">{getMethodLabel(false)}</span>
                    </h3>
                    <p
                      className={cn(
                        "text-muted-foreground",
                        isMobile ? "text-[9px] mt-0.5" : "text-xs"
                      )}
                    >
                      {lowPerformingDetails.length} sims
                    </p>
                  </div>
                  <div className="flex-1">
                    <div
                      className={cn(
                        "overflow-auto rounded-md",
                        isMobile ? "max-h-36" : "max-h-64"
                      )}
                    >
                      <Table className="w-full table-fixed">
                        <colgroup>
                          <col
                            className={cn(isMobile ? "w-[70%]" : "w-[75%]")}
                          />
                          <col
                            className={cn(isMobile ? "w-[30%]" : "w-[25%]")}
                          />
                        </colgroup>
                        <TableHeader>
                          <TableRow>
                            <TableHead
                              className={cn(
                                "leading-tight",
                                isMobile ? "p-0.5 text-[9px]" : "p-2 text-xs"
                              )}
                            >
                              {isMobile ? "Param" : "Parameter"}
                            </TableHead>
                            <TableHead
                              className={cn(
                                "leading-tight text-right shrink-0",
                                isMobile
                                  ? "p-0.5 text-[9px] w-8"
                                  : "p-2 text-xs w-16"
                              )}
                            >
                              #
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {lowPerforming
                            .slice(0, isMobile ? 3 : 5)
                            .map((item, index) => (
                              <TableRow
                                key={`low-${index}`}
                                className="hover:bg-muted/50"
                              >
                                <TableCell
                                  className={cn(
                                    "leading-tight",
                                    isMobile ? "p-0.5" : "p-2"
                                  )}
                                >
                                  <div className="flex items-center gap-1 min-w-0">
                                    <div
                                      className={cn(
                                        "rounded-full shrink-0",
                                        isMobile ? "w-1 h-1" : "w-2 h-2"
                                      )}
                                      style={{ backgroundColor: item.color }}
                                    />
                                    <span
                                      className={cn(
                                        "truncate",
                                        isMobile ? "text-[9px]" : "text-xs"
                                      )}
                                      title={item.name}
                                    >
                                      {item.name}
                                    </span>
                                  </div>
                                </TableCell>
                                <TableCell
                                  className={cn(
                                    "font-mono tabular-nums text-right shrink-0",
                                    isMobile
                                      ? "p-0.5 text-[9px] w-8"
                                      : "p-2 text-xs w-16"
                                  )}
                                >
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
        {actionableInsight && (
          <TruncatedInsight text={actionableInsight} isMobile={isMobile} />
        )}
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
  parameterItemColorMap: Map<string, string>
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
        (pi) => pi.id === fact.parameterItemId
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
  allParameterItems: LocalParameterItem[]
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
