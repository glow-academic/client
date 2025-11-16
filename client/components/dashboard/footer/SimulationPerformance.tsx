/**
 * SimulationPerformance.tsx
 * This component displays scenario performance within a selected simulation.
 * @AshokSaravanan222 & @siladiea
 * 07/23/2025
 */
"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { BarChart3, Check, ChevronsUpDown } from "lucide-react";
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
  thresholds: {
    danger: number;
    warning: number;
    success: number;
  };
}

export default function SimulationPerformance({
  validSimulationIds,
  scenarioFacts,
  simulationMapping,
  actionableInsight,
  thresholds,
}: SimulationPerformanceProps) {
  const [selectedSimulationId, setSelectedSimulationId] = useState<string>("");

  // Build picker options from mapping
  const pickerOptions = useMemo(
    () =>
      validSimulationIds.map((id) => ({
        id,
        title: simulationMapping[id]?.name || "Unknown",
      })),
    [simulationMapping, validSimulationIds]
  );

  useEffect(() => {
    if (!selectedSimulationId && pickerOptions[0]) {
      setSelectedSimulationId(pickerOptions[0].id);
    } else if (
      selectedSimulationId &&
      !pickerOptions.some((s) => s.id === selectedSimulationId)
    ) {
      setSelectedSimulationId(pickerOptions[0]?.id || "");
    }
  }, [pickerOptions, selectedSimulationId]);

  const data = useMemo(
    () =>
      scenarioFacts
        .filter((f) => f.simulationId === selectedSimulationId)
        .sort((a, b) => a.scenarioName.localeCompare(b.scenarioName)),
    [scenarioFacts, selectedSimulationId]
  );

  const status = useMemo(() => {
    if (!data.length) return "neutral";
    const avgScore = data.reduce((s, d) => s + d.avgScore, 0) / data.length;
    const avgSucc = data.reduce((s, d) => s + d.successRate, 0) / data.length;
    const combined = 0.7 * avgScore + 0.3 * avgSucc;
    if (combined >= thresholds.success) return "success";
    if (combined >= thresholds.warning) return "warning";
    return "danger";
  }, [data, thresholds]);

  // Create lookup for custom tooltip
  const dataByName = useMemo(
    () => Object.fromEntries(data.map((d) => [d.scenarioName, d] as const)),
    [data]
  );

  return (
    <Card className="w-full h-full flex flex-col relative">
      <div
        className={`absolute top-2 right-2 w-2 h-2 rounded-full ${
          status === "success"
            ? "bg-green-500"
            : status === "warning"
              ? "bg-yellow-500"
              : status === "danger"
                ? "bg-red-500"
                : "bg-gray-400"
        }`}
      />
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Simulation Performance
            </CardTitle>
            <CardDescription className="text-sm">
              Performance trends for simulations
            </CardDescription>
          </div>

          <SimPicker
            options={pickerOptions}
            value={selectedSimulationId}
            onChange={setSelectedSimulationId}
          />
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col gap-2">
        {/* Chart */}
        <div className="min-h-[300px] h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 10, right: 10, bottom: X_AXIS_HEIGHT, left: 10 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="scenarioName"
                interval={0} // don't skip ticks
                tickLine={false}
                axisLine={true}
                tick={<WrappedTick maxWidth={90} />}
                height={X_AXIS_HEIGHT} // <- match margin.bottom exactly
                tickMargin={2} // <- minimal extra space
              />
              <YAxis domain={[0, 100]} fontSize={10} />
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
                wrapperStyle={{ right: 8, top: 8 }}
                content={({ payload }) => {
                  if (!payload) return null;
                  // Only show the two series we care about (order stable)
                  const items = payload.filter((p) =>
                    ["Average Score", "Success Rate"].includes(String(p.value))
                  );
                  return (
                    <div className="flex flex-col gap-1 p-2 rounded-md bg-muted/70 backdrop-blur border border-border shadow-sm">
                      {items.map((p) => (
                        <div
                          key={String(p.value)}
                          className="flex items-center gap-2 text-[10px] leading-none"
                        >
                          <span
                            className="inline-block w-2 h-2 rounded"
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
                fill="#3b82f6"
                name="Average Score"
                radius={[2, 2, 0, 0]}
              />
              <Bar
                dataKey="successRate"
                fill="#10b981"
                name="Success Rate"
                radius={[2, 2, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Actionable Insights */}
        {actionableInsight && (
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground line-clamp-2">
              {actionableInsight}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SimPicker({
  options,
  value,
  onChange,
}: {
  options: { id: string; title: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.id === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-64 justify-between text-sm h-8"
        >
          <span className="truncate text-left">
            {selected ? selected.title : "Select simulation..."}
          </span>
          <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0">
        <Command>
          <CommandInput placeholder="Search simulations..." />
          <CommandEmpty>No simulation found.</CommandEmpty>
          <CommandGroup>
            {options.map((s) => (
              <CommandItem
                key={s.id}
                value={s.id}
                onSelect={() => {
                  onChange(s.id);
                  setOpen(false);
                }}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4 shrink-0",
                    value === s.id ? "opacity-100" : "opacity-0"
                  )}
                />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{s.title}</div>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
