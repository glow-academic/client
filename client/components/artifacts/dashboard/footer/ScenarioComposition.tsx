/**
 * ScenarioComposition.tsx
 * High vs low performing scenarios at the chat level.
 * Optional scenario picker for filtering; splits scenarios by avg_score.
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

import { cn } from "@/lib/utils";
import { useChartColors } from "@/lib/utils/chartColors";
import { useEffect, useMemo, useState } from "react";
import SimulationCompositionPicker, {
  SimulationCompositionConfig,
} from "../SimulationCompositionPicker";

type ScenarioFact = {
  scenarioId: string;
  name: string;
  avgScore: number;
  completionRate: number;
  totalChats: number;
  simulationCount: number;
};

type ScenarioParameterFactCategorical = {
  scenarioId: string;
  parameterId: string;
  parameterItemId: string;
  chatCount: number;
};

type ScenarioParameterFactNumeric = {
  scenarioId: string;
  parameterId: string;
  avgLevel: number;
  levelLabel: string;
  chatCount: number;
};

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

type HighLowPerforming = {
  name: string;
  value: number;
  icon: string;
  color: string;
  description: string;
  significance: "high" | "medium" | "low" | "none";
};

type Parameter = {
  parameter_id: string;
  name: string;
  description: string;
};

type Field = {
  field_id: string;
  name: string;
  description: string;
  parameter_id: string;
  parameter_name: string;
};

export interface ScenarioCompositionProps {
  scenarioFacts: ScenarioFact[];
  scenarioParameterFactsCategorical: ScenarioParameterFactCategorical[];
  scenarioParameterFactsNumeric: ScenarioParameterFactNumeric[];
  parameters: Parameter[];
  fields: Field[];
  validScenarioIds: string[];
  actionableInsight?: string | null;
  status: "success" | "warning" | "danger" | "neutral";
}

export default function ScenarioComposition({
  scenarioFacts,
  scenarioParameterFactsCategorical,
  scenarioParameterFactsNumeric,
  parameters,
  fields,
  validScenarioIds: _validScenarioIds,
  actionableInsight,
  status,
}: ScenarioCompositionProps) {
  const parameterMapping = useMemo(() => {
    return parameters.reduce(
      (acc, param) => {
        acc[param.parameter_id] = {
          name: param.name,
          description: param.description,
        };
        return acc;
      },
      {} as Record<string, { name: string; description: string }>,
    );
  }, [parameters]);

  const parameterItemMapping = useMemo(() => {
    return fields.reduce(
      (acc, field) => {
        acc[field.field_id] = {
          name: field.name,
          description: field.description,
          parameter_id: field.parameter_id,
          parameter_name: field.parameter_name,
        };
        return acc;
      },
      {} as Record<
        string,
        {
          name: string;
          description: string;
          parameter_id: string;
          parameter_name: string;
        }
      >,
    );
  }, [fields]);

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

  const [isMobile, setIsMobile] = useState(false);
  const chartColors = useChartColors();

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const parameterItemColorMap = useMemo(() => {
    const colorMap = new Map<string, string>();
    [
      ...scenarioParameterFactsCategorical,
      ...scenarioParameterFactsNumeric,
    ].forEach((fact, index) => {
      let key: string;
      if ("parameterItemId" in fact) {
        key = fact.parameterId + ":" + fact.parameterItemId;
      } else {
        key = fact.parameterId + ":" + fact.levelLabel;
      }
      if (!colorMap.has(key)) {
        const colorIndex = index % chartColors.length;
        colorMap.set(key, chartColors[colorIndex] || "#6b7280");
      }
    });
    return colorMap;
  }, [
    scenarioParameterFactsCategorical,
    scenarioParameterFactsNumeric,
    chartColors,
  ]);

  const {
    highPerforming,
    lowPerforming,
    highPerformingDetails,
    lowPerformingDetails,
  } = useMemo(() => {
    if (scenarioFacts.length === 0) {
      return {
        highPerforming: [],
        lowPerforming: [],
        highPerformingDetails: [],
        lowPerformingDetails: [],
      };
    }

    const sorted = [...scenarioFacts].sort((a, b) => b.avgScore - a.avgScore);

    let topCount: number;
    let bottomCount: number;

    switch (config.method) {
      case "percentile":
        topCount = Math.max(
          1,
          Math.floor((config.topPercentage / 100) * sorted.length),
        );
        bottomCount = Math.max(
          1,
          Math.floor((config.bottomPercentage / 100) * sorted.length),
        );
        break;
      case "quartile":
        topCount = Math.max(1, Math.floor(sorted.length / 4));
        bottomCount = Math.max(1, Math.floor(sorted.length / 4));
        break;
      case "standard_deviation": {
        const avgScore =
          sorted.reduce((sum, s) => sum + s.avgScore, 0) / sorted.length;
        const variance =
          sorted.reduce((sum, s) => sum + Math.pow(s.avgScore - avgScore, 2), 0) /
          sorted.length;
        const stdDev = Math.sqrt(variance);
        topCount = sorted.filter((s) => s.avgScore >= avgScore + stdDev).length;
        bottomCount = sorted.filter(
          (s) => s.avgScore <= avgScore - stdDev,
        ).length;
        break;
      }
      default:
        topCount = 1;
        bottomCount = 1;
    }

    const topScenarios = sorted.slice(0, topCount);
    const bottomScenarios = sorted.slice(-bottomCount);

    const highPerforming = buildParameterComposition(
      topScenarios,
      scenarioParameterFactsCategorical,
      scenarioParameterFactsNumeric,
      allParameters,
      allParameterItems,
      parameterItemColorMap,
    );

    const lowPerforming = buildParameterComposition(
      bottomScenarios,
      scenarioParameterFactsCategorical,
      scenarioParameterFactsNumeric,
      allParameters,
      allParameterItems,
      parameterItemColorMap,
    );

    const highPerformingDetails = topScenarios.map((s) => ({
      id: s.scenarioId,
      title: s.name,
      avgScore: s.avgScore,
      completionRate: s.completionRate,
      totalChats: s.totalChats,
      simulationCount: s.simulationCount,
      parameterBreakdown: buildParameterBreakdown(
        s.scenarioId,
        scenarioParameterFactsCategorical,
        scenarioParameterFactsNumeric,
        allParameters,
        allParameterItems,
      ),
    }));

    const lowPerformingDetails = bottomScenarios.map((s) => ({
      id: s.scenarioId,
      title: s.name,
      avgScore: s.avgScore,
      completionRate: s.completionRate,
      totalChats: s.totalChats,
      simulationCount: s.simulationCount,
      parameterBreakdown: buildParameterBreakdown(
        s.scenarioId,
        scenarioParameterFactsCategorical,
        scenarioParameterFactsNumeric,
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
    scenarioFacts,
    config,
    scenarioParameterFactsCategorical,
    scenarioParameterFactsNumeric,
    allParameters,
    allParameterItems,
    parameterItemColorMap,
  ]);

  const thresholdStatus = status;

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
            isMobile ? "flex-col gap-2" : "items-start justify-between",
          )}
        >
          <div className="flex flex-col items-start">
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Scenario Composition
            </CardTitle>
            <CardDescription className="text-sm line-clamp-2">
              {isMobile
                ? "High vs low performing"
                : "High vs low performing scenarios"}
            </CardDescription>
          </div>
          <SimulationCompositionPicker
            currentConfig={config}
            onConfigChange={setConfig}
          />
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col gap-4 min-h-0">
        {highPerforming.length === 0 &&
          lowPerforming.length === 0 &&
          scenarioFacts.length > 0 && (
            <div
              className={cn(
                "text-center bg-muted/50 rounded-lg flex-shrink-0",
                isMobile ? "p-2" : "p-4",
              )}
            >
              <p
                className={cn(
                  "text-muted-foreground",
                  isMobile ? "text-xs mb-1" : "text-sm mb-2",
                )}
              >
                No significant differences found between high and low performing
                scenarios.
              </p>
              <p
                className={cn(
                  "text-muted-foreground",
                  isMobile ? "text-[10px]" : "text-xs",
                )}
              >
                Showing top 3 most common attributes across all scenarios.
              </p>
            </div>
          )}

        <div
          className={cn(
            "flex-1 min-h-0 overflow-auto",
            isMobile ? "min-h-[180px]" : "min-h-[260px]",
          )}
        >
          <div
            className={cn(
              "grid items-start",
              isMobile
                ? "grid-cols-1 gap-2"
                : "grid-cols-1 lg:grid-cols-2 gap-4",
            )}
          >
            {/* High Performing Side */}
            <Dialog>
              <DialogTrigger asChild>
                <div
                  className={cn(
                    "cursor-pointer hover:bg-muted/50 rounded-lg transition-all duration-200 border-2 border-transparent hover:border-green-200 hover:shadow-sm",
                    isMobile ? "p-2" : "p-3",
                  )}
                >
                  <div
                    className={cn("text-center", isMobile ? "mb-2" : "mb-3")}
                  >
                    <h3
                      className={cn(
                        "font-semibold text-green-600 flex items-center justify-center gap-1",
                        isMobile ? "text-xs" : "text-sm",
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
                        isMobile ? "text-[10px]" : "text-xs",
                      )}
                    >
                      {highPerformingDetails.length} scenarios
                    </p>
                  </div>
                  <div className="flex-1">
                    <div
                      className={cn(
                        "overflow-auto rounded-md",
                        isMobile ? "max-h-48" : "max-h-64",
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
                                isMobile ? "p-1 text-[10px]" : "p-2 text-xs",
                              )}
                            >
                              Parameter
                            </TableHead>
                            <TableHead
                              className={cn(
                                "leading-snug text-right shrink-0",
                                isMobile
                                  ? "p-1 text-[10px] w-12"
                                  : "p-2 text-xs w-16",
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
                                    isMobile ? "p-1" : "p-2",
                                  )}
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <div
                                      className={cn(
                                        "rounded-full shrink-0",
                                        isMobile ? "w-1.5 h-1.5" : "w-2 h-2",
                                      )}
                                      style={{ backgroundColor: item.color }}
                                    />
                                    <span
                                      className={cn(
                                        "truncate",
                                        isMobile ? "text-[10px]" : "text-xs",
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
                                      : "p-2 text-xs w-16",
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
                    {getMethodLabel(true)} Performing Scenarios
                  </DialogTitle>
                  <DialogDescription hidden>
                    Detailed breakdown of top performing scenarios and their
                    characteristics
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-6">
                  <div className="space-y-3">
                    <h4 className="font-medium">
                      Scenarios ({highPerformingDetails.length})
                    </h4>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {highPerformingDetails.map((s) => (
                        <div
                          key={s.id}
                          className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                        >
                          <div>
                            <p className="font-medium text-sm">{s.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {s.totalChats} chats • {s.simulationCount}{" "}
                              simulations
                            </p>
                            {s.parameterBreakdown.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {s.parameterBreakdown
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
                                {s.parameterBreakdown.length > 3 && (
                                  <span className="text-xs text-muted-foreground">
                                    +{s.parameterBreakdown.length - 3} more
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium">
                              {s.avgScore}% avg
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {s.completionRate}% completion
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
                    isMobile ? "p-1.5" : "p-3",
                  )}
                >
                  <div
                    className={cn("text-center", isMobile ? "mb-1.5" : "mb-3")}
                  >
                    <h3
                      className={cn(
                        "font-semibold text-red-600 flex items-center justify-center gap-0.5",
                        isMobile ? "text-[10px]" : "text-sm",
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
                        isMobile ? "text-[9px] mt-0.5" : "text-xs",
                      )}
                    >
                      {lowPerformingDetails.length} scenarios
                    </p>
                  </div>
                  <div className="flex-1">
                    <div
                      className={cn(
                        "overflow-auto rounded-md",
                        isMobile ? "max-h-36" : "max-h-64",
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
                                isMobile ? "p-0.5 text-[9px]" : "p-2 text-xs",
                              )}
                            >
                              {isMobile ? "Param" : "Parameter"}
                            </TableHead>
                            <TableHead
                              className={cn(
                                "leading-tight text-right shrink-0",
                                isMobile
                                  ? "p-0.5 text-[9px] w-8"
                                  : "p-2 text-xs w-16",
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
                                    isMobile ? "p-0.5" : "p-2",
                                  )}
                                >
                                  <div className="flex items-center gap-1 min-w-0">
                                    <div
                                      className={cn(
                                        "rounded-full shrink-0",
                                        isMobile ? "w-1 h-1" : "w-2 h-2",
                                      )}
                                      style={{ backgroundColor: item.color }}
                                    />
                                    <span
                                      className={cn(
                                        "truncate",
                                        isMobile ? "text-[9px]" : "text-xs",
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
                                      : "p-2 text-xs w-16",
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
                    {getMethodLabel(false)} Performing Scenarios
                  </DialogTitle>
                  <DialogDescription hidden>
                    Detailed breakdown of low performing scenarios and their
                    characteristics
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-6">
                  <div className="space-y-3">
                    <h4 className="font-medium">
                      Scenarios ({lowPerformingDetails.length})
                    </h4>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {lowPerformingDetails.map((s) => (
                        <div
                          key={s.id}
                          className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                        >
                          <div>
                            <p className="font-medium text-sm">{s.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {s.totalChats} chats • {s.simulationCount}{" "}
                              simulations
                            </p>
                            {s.parameterBreakdown.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {s.parameterBreakdown
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
                                {s.parameterBreakdown.length > 3 && (
                                  <span className="text-xs text-muted-foreground">
                                    +{s.parameterBreakdown.length - 3} more
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium">
                              {s.avgScore}% avg
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {s.completionRate}% completion
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

        {actionableInsight && (
          <div className="flex-shrink-0 w-full">
            <TruncatedInsight text={actionableInsight} isMobile={isMobile} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function buildParameterComposition(
  scenarios: ScenarioFact[],
  categoricalFacts: ScenarioParameterFactCategorical[],
  numericFacts: ScenarioParameterFactNumeric[],
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

  for (const fact of categoricalFacts) {
    if (scenarios.some((s) => s.scenarioId === fact.scenarioId)) {
      const parameter = allParameters.find((p) => p.id === fact.parameterId);
      const parameterItem = allParameterItems.find(
        (pi) => pi.id === fact.parameterItemId,
      );

      if (parameter && parameterItem) {
        const key = `${parameter.name}:${parameterItem.name}`;
        const existing = parameterCounts.get(key);
        if (existing) {
          existing.count += fact.chatCount;
        } else {
          const itemKey = fact.parameterId + ":" + fact.parameterItemId;
          parameterCounts.set(key, {
            count: fact.chatCount,
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

  for (const fact of numericFacts) {
    if (scenarios.some((s) => s.scenarioId === fact.scenarioId)) {
      const parameter = allParameters.find((p) => p.id === fact.parameterId);

      if (parameter) {
        const key = `${parameter.name}:${fact.levelLabel}`;
        const existing = parameterCounts.get(key);
        if (existing) {
          existing.count += fact.chatCount;
        } else {
          const itemKey = fact.parameterId + ":" + fact.levelLabel;
          parameterCounts.set(key, {
            count: fact.chatCount,
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
    .sort((a, b) => b.value - a.value);
}

function buildParameterBreakdown(
  scenarioId: string,
  categoricalFacts: ScenarioParameterFactCategorical[],
  numericFacts: ScenarioParameterFactNumeric[],
  allParameters: LocalParameter[],
  allParameterItems: LocalParameterItem[],
): { parameterName: string; parameterValue: string; isNumerical: boolean }[] {
  const breakdown: {
    parameterName: string;
    parameterValue: string;
    isNumerical: boolean;
  }[] = [];

  for (const fact of categoricalFacts) {
    if (fact.scenarioId === scenarioId) {
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

  for (const fact of numericFacts) {
    if (fact.scenarioId === scenarioId) {
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
