/**
 * SimulationPerformance.tsx
 * This component displays scenario performance within a selected simulation.
 * @AshokSaravanan222 & @siladiea
 * 07/23/2025
 */
"use client";

import { SimulationPicker } from "@/components/common/forms/SimulationPicker";
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

type ScenarioFact = {
  simulationId: string;
  scenarioId: string;
  scenarioName: string;
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
        scenarioName: string;
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
      <div className="font-medium">{dataPoint.scenarioName}</div>
      <div className="mt-1 text-xs space-y-1">
        <div>Average Score: {dataPoint.avgScore}%</div>
        <div>Success Rate: {dataPoint.successRate}%</div>
        <div>Attempts: {dataPoint.totalAttempts}</div>
      </div>
    </div>
  );
}

// Constants for consistent spacing
const X_TICK_LINE_HEIGHT = 11; // was 12
const X_TICK_MAX_LINES = 2; // was 3
const X_TICK_PAD = 4; // small padding
const X_AXIS_HEIGHT = X_TICK_MAX_LINES * X_TICK_LINE_HEIGHT + X_TICK_PAD; // = 26

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

  // naive width-to-chars estimate (~7px per char at ~10–11px font)
  const charsPerLine = Math.max(1, Math.floor(maxWidth / 7));

  // word-wrap into lines
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = "";

  words.forEach((w0) => {
    let w = w0;
    if ((cur + (cur ? " " : "") + w).length <= charsPerLine) {
      cur = cur ? cur + " " + w : w;
    } else {
      if (cur) lines.push(cur);
      // overly long single word: hard-break
      while (w.length > charsPerLine) {
        lines.push(w.slice(0, charsPerLine));
        w = w.slice(charsPerLine);
      }
      cur = w;
    }
  });
  if (cur) lines.push(cur);

  // clamp & add ellipsis if needed
  const clamped =
    lines.length > maxLines
      ? [...lines.slice(0, maxLines - 1), lines[maxLines - 1] + "…"]
      : lines;

  const startY = y + 6; // was 8 — tighter

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

export interface SimulationPerformanceProps {
  validSimulationIds: string[];
  scenarioFacts: ScenarioFact[];
  /** Simulation mapping object */
  simulationMapping: Record<string, { name: string; description: string }>;
  actionableInsight?: string | null;
  status: "success" | "warning" | "danger" | "neutral";
}

export default function SimulationPerformance({
  validSimulationIds,
  scenarioFacts,
  simulationMapping,
  actionableInsight,
  status,
}: SimulationPerformanceProps) {
  const [selectedSimulationId, setSelectedSimulationId] = useState<string>("");
  const [isMobile, setIsMobile] = useState(false);

  // Get chart colors 1-5 from CSS variables
  const chartColors = useChartColors();

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024); // lg breakpoint
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    if (!selectedSimulationId && validSimulationIds[0]) {
      setSelectedSimulationId(validSimulationIds[0]);
    } else if (
      selectedSimulationId &&
      !validSimulationIds.includes(selectedSimulationId)
    ) {
      setSelectedSimulationId(validSimulationIds[0] || "");
    }
  }, [validSimulationIds, selectedSimulationId]);

  const data = useMemo(
    () =>
      scenarioFacts
        .filter((f) => f.simulationId === selectedSimulationId)
        .sort((a, b) => a.scenarioName.localeCompare(b.scenarioName)),
    [scenarioFacts, selectedSimulationId],
  );

  // Use status from server
  const thresholdStatus = status;

  // Create lookup for custom tooltip
  const dataByName = useMemo(
    () => Object.fromEntries(data.map((d) => [d.scenarioName, d] as const)),
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
              Simulation Performance
            </CardTitle>
            <CardDescription className="text-sm line-clamp-2">
              Performance trends for simulations
            </CardDescription>
          </div>

          <SimulationPicker
            simulationMapping={simulationMapping}
            validSimulationIds={validSimulationIds}
            selectedSimulationIds={
              selectedSimulationId ? [selectedSimulationId] : []
            }
            onSelect={(ids) => setSelectedSimulationId(ids[0] || "")}
            multiSelect={false}
            placeholder="Select simulation..."
            hideSelectedChips={true}
            showLabel={false}
            buttonClassName={cn(isMobile ? "w-full" : "w-64")}
          />
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col gap-2">
        {/* Chart */}
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
                dataKey="scenarioName"
                interval={0} // don't skip ticks
                tickLine={false}
                axisLine={true}
                tick={<WrappedTick maxWidth={isMobile ? 60 : 90} />}
                height={X_AXIS_HEIGHT} // <- match margin.bottom exactly
                tickMargin={2} // <- minimal extra space
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
                  // Only show the two series we care about (order stable)
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

        {/* Actionable Insights */}
        {actionableInsight && (
          <div className={cn(isMobile && "px-0")}>
            <TruncatedInsight text={actionableInsight} isMobile={isMobile} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
