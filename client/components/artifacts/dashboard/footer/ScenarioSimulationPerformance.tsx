/**
 * ScenarioSimulationPerformance.tsx
 * Pick a scenario, see how it performs across different simulations.
 * X-axis = simulation names, Y-axis = avg_score + success_rate.
 */
"use client";

import { GenericPicker } from "@/components/common/forms/GenericPicker";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useChartColors } from "@/lib/utils/chartColors";
import { BarChart3 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { TooltipProps } from "recharts";
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
import { TruncatedInsight } from "../TruncatedInsight";

type SimulationFact = {
  scenarioId: string;
  simulationId: string;
  simulationName: string;
  avgScore: number;
  successRate: number;
  totalAttempts: number;
  completedAttempts: number;
};

function CustomBarTooltip({
  active,
  payload,
  label,
  getDataPoint,
}: {
  active?: boolean;
  payload?: TooltipProps<number, string>["payload"];
  label?: string;
  getDataPoint: (label: string) =>
    | {
        simulationName: string;
        avgScore: number;
        successRate: number;
        totalAttempts: number;
      }
    | undefined;
}) {
  if (!active || !payload || !payload.length || !label) return null;

  const dataPoint = getDataPoint(label);
  if (!dataPoint) return null;

  return (
    <div className="rounded-md border border-border bg-muted/70 backdrop-blur px-3 py-2 shadow-sm">
      <div className="font-medium">{dataPoint.simulationName}</div>
      <div className="mt-1 text-xs space-y-1">
        <div>Average Score: {dataPoint.avgScore}%</div>
        <div>Success Rate: {dataPoint.successRate}%</div>
        <div>Attempts: {dataPoint.totalAttempts}</div>
      </div>
    </div>
  );
}

const X_TICK_LINE_HEIGHT = 11;
const X_TICK_MAX_LINES = 2;
const X_TICK_PAD = 4;
const X_AXIS_HEIGHT = X_TICK_MAX_LINES * X_TICK_LINE_HEIGHT + X_TICK_PAD;

function WrappedTick({
  x,
  y,
  payload,
  maxWidth = 90,
  lineHeight = X_TICK_LINE_HEIGHT,
  maxLines = X_TICK_MAX_LINES,
}: {
  x?: number;
  y?: number;
  payload?: { value: string };
  maxWidth?: number;
  lineHeight?: number;
  maxLines?: number;
}) {
  if (x == null || y == null || !payload) return null;
  const text = String(payload.value ?? "");
  const charsPerLine = Math.max(1, Math.floor(maxWidth / 7));
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = "";

  words.forEach((w0) => {
    let w = w0;
    if ((cur + (cur ? " " : "") + w).length <= charsPerLine) {
      cur = cur ? cur + " " + w : w;
    } else {
      if (cur) lines.push(cur);
      while (w.length > charsPerLine) {
        lines.push(w.slice(0, charsPerLine));
        w = w.slice(charsPerLine);
      }
      cur = w;
    }
  });
  if (cur) lines.push(cur);

  const clamped =
    lines.length > maxLines
      ? [...lines.slice(0, maxLines - 1), lines[maxLines - 1] + "…"]
      : lines;

  const startY = y + 6;

  return (
    <text x={x} y={startY} textAnchor="middle" fontSize={10}>
      {clamped.map((line, i) => (
        <tspan key={i} x={x} dy={i === 0 ? 0 : lineHeight}>
          {line}
        </tspan>
      ))}
    </text>
  );
}

export interface ScenarioSimulationPerformanceProps {
  validScenarioIds: string[];
  simulationFacts: SimulationFact[];
  scenarios: Array<{ scenario_id: string; name: string; description: string }>;
  actionableInsight?: string | null;
  status: "success" | "warning" | "danger" | "neutral";
  initialSelectedScenarios?: string[] | undefined;
  onScenarioSelect?: ((ids: string[]) => void) | undefined;
  scenarioSearchValue?: string | undefined;
  onScenarioSearchChange?: ((term: string) => void) | undefined;
}

export default function ScenarioSimulationPerformance({
  validScenarioIds,
  simulationFacts,
  scenarios,
  actionableInsight,
  status,
  initialSelectedScenarios,
  onScenarioSelect,
  scenarioSearchValue,
  onScenarioSearchChange,
}: ScenarioSimulationPerformanceProps) {
  const scenarioMapping = useMemo(() => {
    return scenarios.reduce(
      (acc, s) => {
        acc[s.scenario_id] = { name: s.name, description: s.description };
        return acc;
      },
      {} as Record<string, { name: string; description: string }>,
    );
  }, [scenarios]);

  const [selectedScenarioIdInternal, setSelectedScenarioIdInternal] =
    useState<string>(initialSelectedScenarios?.[0] ?? "");
  const selectedScenarioId =
    initialSelectedScenarios?.[0] ?? selectedScenarioIdInternal;
  const setSelectedScenarioId = (id: string) => {
    if (onScenarioSelect) {
      onScenarioSelect(id ? [id] : []);
    } else {
      setSelectedScenarioIdInternal(id);
    }
  };
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

  useEffect(() => {
    if (!selectedScenarioId && validScenarioIds[0]) {
      setSelectedScenarioId(validScenarioIds[0]);
    } else if (
      selectedScenarioId &&
      !validScenarioIds.includes(selectedScenarioId)
    ) {
      setSelectedScenarioId(validScenarioIds[0] || "");
    }
  }, [validScenarioIds, selectedScenarioId]);

  const data = useMemo(
    () =>
      simulationFacts
        .filter((f) => f.scenarioId === selectedScenarioId)
        .sort((a, b) => a.simulationName.localeCompare(b.simulationName)),
    [simulationFacts, selectedScenarioId],
  );

  const dataByName = useMemo(
    () => Object.fromEntries(data.map((d) => [d.simulationName, d] as const)),
    [data],
  );

  return (
    <Card className="w-full h-full flex flex-col relative">
      <div
        className={`absolute top-2 right-2 w-2 h-2 rounded-full ${
          status === "success"
            ? "bg-success"
            : status === "warning"
              ? "bg-warning"
              : status === "danger"
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
              Scenario Performance
            </CardTitle>
            <CardDescription className="text-sm line-clamp-2">
              How a scenario performs across simulations
            </CardDescription>
          </div>

          <GenericPicker
            items={scenarioMapping}
            itemIds={validScenarioIds}
            selectedIds={selectedScenarioId ? [selectedScenarioId] : []}
            onSelect={(ids) => setSelectedScenarioId(ids[0] || "")}
            getId={(s) => (s as unknown as { id: string }).id}
            getLabel={(s) => s.name || ""}
            getSearchText={(s) => `${s.name} ${s.description || ""}`}
            renderPreview={(s) => (
              <div className="grid gap-2">
                <h4 className="font-medium leading-none">{s.name}</h4>
                <div className="text-sm text-muted-foreground">
                  {s.description || "No description available"}
                </div>
              </div>
            )}
            multiSelect={false}
            placeholder="Select scenario..."
            hideSelectedChips={true}
            showLabel={false}
            buttonClassName={cn(isMobile ? "w-full" : "w-64")}
            groupHeading="Scenarios"
            {...(scenarioSearchValue !== undefined && {
              initialSearchTerm: scenarioSearchValue,
            })}
            {...(onScenarioSearchChange !== undefined && {
              onSearchChange: onScenarioSearchChange,
            })}
          />
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col gap-2">
        <div
          className={cn(
            "flex-1 min-h-0",
            isMobile ? "min-h-[250px]" : "min-h-[300px]",
          )}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{
                top: 10,
                right: isMobile ? 5 : 10,
                bottom: X_AXIS_HEIGHT,
                left: isMobile ? 5 : 10,
              }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="simulationName"
                interval={0}
                tickLine={false}
                axisLine={true}
                tick={<WrappedTick maxWidth={isMobile ? 60 : 90} />}
                height={X_AXIS_HEIGHT}
                tickMargin={2}
                fontSize={isMobile ? 8 : 10}
              />
              <YAxis domain={[0, 100]} fontSize={isMobile ? 8 : 10} />
              <Tooltip
                content={
                  <CustomBarTooltip
                    getDataPoint={(label: string) => dataByName[label]}
                  />
                }
              />
              <Legend
                layout="vertical"
                align="right"
                verticalAlign="top"
                wrapperStyle={{ right: isMobile ? 4 : 8, top: 8 }}
                content={({ payload }) => {
                  if (!payload) return null;
                  const items = payload.filter((p) =>
                    ["Average Score", "Success Rate"].includes(String(p.value)),
                  );
                  return (
                    <div
                      className={cn(
                        "flex flex-col rounded-md bg-muted/70 backdrop-blur border border-border shadow-sm",
                        isMobile ? "gap-0.5 p-1" : "gap-1 p-2",
                      )}
                    >
                      {items.map((p) => (
                        <div
                          key={String(p.value)}
                          className={cn(
                            "flex items-center gap-1 leading-none",
                            isMobile ? "text-[9px]" : "text-[10px]",
                          )}
                        >
                          <span
                            className={cn(
                              "inline-block rounded",
                              isMobile ? "w-1.5 h-1.5" : "w-2 h-2",
                            )}
                            style={{ background: p.color }}
                          />
                          <span className="whitespace-nowrap">
                            {String(p.value)}
                          </span>
                        </div>
                      ))}
                    </div>
                  );
                }}
              />
              <Bar
                dataKey="avgScore"
                fill={chartColors[0]}
                name="Average Score"
                radius={[2, 2, 0, 0]}
              />
              <Bar
                dataKey="successRate"
                fill={chartColors[1]}
                name="Success Rate"
                radius={[2, 2, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {actionableInsight && (
          <div className={cn(isMobile && "px-0")}>
            <TruncatedInsight text={actionableInsight} isMobile={isMobile} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
