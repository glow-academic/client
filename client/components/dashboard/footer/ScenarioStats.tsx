/**
 * ScenarioStats.tsx
 * This component displays the scenario stats for the personas with bar charts.
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { BarChart3, Check, ChevronsUpDown, Info } from "lucide-react";
import { useMemo, useState } from "react";
import type { TooltipProps } from "recharts";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";

type NumericAttemptFact = {
  parameterId: string;
  levelLabel: string;
  levelValue: number;
  score: number;
  attempts: number;
};

type NumericScenarioFact = {
  parameterId: string;
  scenarioId: string;
  levelLabel: string;
  levelValue: number;
};

// Static chart palette for reliable colors
const CHART_PALETTE = [
  "#2563eb", // blue
  "#7c3aed", // purple
  "#10b981", // green
  "#f59e0b", // orange
  "#ef4444", // red
  "#06b6d4", // teal
  "#84cc16", // lime
  "#a855f7", // violet
];

function pickColor(fallbackIndex = 0): string {
  // Use the fallbackIndex directly to ensure different colors
  const idx = fallbackIndex % CHART_PALETTE.length;
  return CHART_PALETTE[idx] ?? CHART_PALETTE[0] ?? "#2563eb";
}

function CustomBarTooltip({
  active,
  payload,
  label,
  getRowData,
}: {
  active?: boolean;
  payload?: TooltipProps<number, string>["payload"];
  label?: string;
  getRowData: (label: string) =>
    | {
        metricLevel: string;
        avgScore: number;
        scenarioCount: number;
        totalAttempts: number;
      }
    | undefined;
}) {
  if (!active || !payload || !payload.length || !label) return null;

  const rowData = getRowData(label);
  if (!rowData) return null;

  return (
    <div className="rounded-md border border-border bg-muted/70 backdrop-blur px-3 py-2 shadow-sm">
      <div className="font-medium">{rowData.metricLevel}</div>
      <div className="mt-1 text-xs space-y-1">
        <div>Average Score: {rowData.avgScore}%</div>
        <div>Scenarios: {rowData.scenarioCount}</div>
        <div>Total Attempts: {rowData.totalAttempts}</div>
      </div>
    </div>
  );
}

export interface ScenarioStatsProps {
  numericAttemptFacts: NumericAttemptFact[];
  numericScenarioFacts: NumericScenarioFact[];
  /** Parameter mapping object */
  parameterMapping: Record<string, { name: string; description: string }>;
  /** Valid numeric parameter IDs */
  validNumericParameterIds: string[];
  actionableInsight?: string | null;
  thresholds: {
    danger: number;
    warning: number;
    success: number;
  };
}

export default function ScenarioStats({
  numericAttemptFacts,
  numericScenarioFacts,
  parameterMapping,
  validNumericParameterIds,
  actionableInsight,
  thresholds,
}: ScenarioStatsProps) {
  const [selectedParameterId, setSelectedParameterId] = useState<string>("");

  // Build all parameters from mapping
  const allParameters = useMemo(
    () =>
      validNumericParameterIds.map((id) => ({
        id,
        name: parameterMapping[id]?.name || "Unknown",
        description: parameterMapping[id]?.description || "",
        numerical: true,
        active: true,
      })),
    [parameterMapping, validNumericParameterIds],
  );

  const metricOptions = useMemo(
    () =>
      allParameters
        .filter((p) => p.numerical && p.active)
        .map((p) => ({
          id: p.id,
          name: p.name,
          description: `Performance by ${p.name.toLowerCase()} value`,
        })),
    [allParameters],
  );

  const activeParamId = useMemo(
    () => selectedParameterId || metricOptions[0]?.id || "",
    [selectedParameterId, metricOptions],
  );

  // Build chart rows + scenarioCount using facts
  const chartRows = useMemo(() => {
    const facts = numericAttemptFacts.filter(
      (f) => f.parameterId === activeParamId,
    );
    const byLevel = new Map<
      string,
      {
        label: string;
        value: number;
        sumScore: number;
        sumW: number;
        attempts: number;
      }
    >();
    for (const f of facts) {
      const k = f.levelLabel;
      const acc = byLevel.get(k) ?? {
        label: f.levelLabel,
        value: f.levelValue,
        sumScore: 0,
        sumW: 0,
        attempts: 0,
      };
      acc.sumScore += f.score * f.attempts;
      acc.sumW += f.attempts;
      acc.attempts += f.attempts;
      byLevel.set(k, acc);
    }

    // scenario counts per level
    const scen = numericScenarioFacts.filter(
      (s) => s.parameterId === activeParamId,
    );
    const scenCountByLevel = new Map<string, number>();
    for (const s of scen) {
      scenCountByLevel.set(
        s.levelLabel,
        (scenCountByLevel.get(s.levelLabel) ?? 0) + 1,
      );
    }

    return [...byLevel.values()]
      .sort((a, b) => a.value - b.value)
      .map((r, idx) => ({
        metricLevel: r.label,
        avgScore: r.sumW ? Math.round(r.sumScore / r.sumW) : 0,
        scenarioCount: scenCountByLevel.get(r.label) ?? 0,
        totalAttempts: r.attempts,
        color: pickColor(idx),
      }));
  }, [numericAttemptFacts, numericScenarioFacts, activeParamId]);

  // Weighted Pearson correlation between levelValue and score using attempt counts as weights
  const { correlation, pValue } = useMemo(() => {
    const rows = numericAttemptFacts.filter(
      (f) => f.parameterId === activeParamId,
    );
    if (rows.length === 0) return { correlation: 0, pValue: 1 };

    let wSum = 0,
      xSum = 0,
      ySum = 0,
      xxSum = 0,
      yySum = 0,
      xySum = 0;
    let nEff = 0; // effective df count (distinct groups)
    const groups = new Set<string>();

    for (const r of rows) {
      const w = Math.max(1, r.attempts);
      const x = r.levelValue;
      const y = r.score;
      wSum += w;
      xSum += w * x;
      ySum += w * y;
      xxSum += w * x * x;
      yySum += w * y * y;
      xySum += w * x * y;
      groups.add(r.levelLabel);
    }
    nEff = groups.size;

    const cov = xySum - (xSum * ySum) / wSum;
    const varX = xxSum - (xSum * xSum) / wSum;
    const varY = yySum - (ySum * ySum) / wSum;
    const r = varX <= 0 || varY <= 0 ? 0 : cov / Math.sqrt(varX * varY);

    // approximate two-sided p-value via t distribution with nEff-2 dof
    const df = Math.max(1, nEff - 2);
    const t = Math.abs(r) * Math.sqrt(df / Math.max(1e-9, 1 - r * r));
    // simple survival approx using Student's t CDF ~ not exact; fine for UI hint
    const p = approxTPValue(t, df);
    return { correlation: r, pValue: p };
  }, [numericAttemptFacts, activeParamId]);

  const status = useMemo(() => {
    if (chartRows.length === 0) return "neutral";
    const avg =
      chartRows.reduce((s, r) => s + r.avgScore, 0) / chartRows.length;
    if (avg >= thresholds.success) return "success";
    if (avg >= thresholds.warning) return "warning";
    return "danger";
  }, [chartRows, thresholds]);

  // Create lookup for custom tooltip
  const chartRowsByName = useMemo(
    () => Object.fromEntries(chartRows.map((r) => [r.metricLevel, r] as const)),
    [chartRows],
  );

  return (
    <TooltipProvider>
      <Card className="w-full h-full flex flex-col relative">
        <div
          data-testid="status-indicator"
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
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Scenario Performance Analysis
              </CardTitle>
              <CardDescription>
                Performance correlation with scenario characteristics
              </CardDescription>
            </div>

            <MetricPicker
              options={metricOptions}
              value={activeParamId}
              onChange={setSelectedParameterId}
            />
          </div>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col gap-2">
          <div className="flex-1 h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartRows}
                margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="metricLevel" fontSize={12} />
                <YAxis
                  fontSize={12}
                  domain={[0, 100]}
                  tickFormatter={(v) => `${v}%`}
                />
                <RTooltip
                  content={
                    <CustomBarTooltip
                      getRowData={(label: string) => chartRowsByName[label]}
                    />
                  }
                />
                <Bar
                  dataKey="avgScore"
                  name="Average Score"
                  radius={[4, 4, 0, 0]}
                >
                  {chartRows.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Correlation */}
          <div className="flex items-center justify-end">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="bg-background/90 backdrop-blur-sm border rounded-md px-2 py-1 shadow-sm">
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-medium">Pearson r:</span>
                    <span className="text-xs font-bold">
                      {correlation > 0 ? "+" : ""}
                      {correlation.toFixed(2)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      (p={pValue.toFixed(3)})
                    </span>
                    <Info className="h-3 w-3 text-muted-foreground" />
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent className="w-64 p-3">
                <p className="text-sm">
                  Relationship between the numeric parameter level and average
                  score (weighted by attempts).
                </p>
              </TooltipContent>
            </Tooltip>
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
    </TooltipProvider>
  );
}

function MetricPicker({
  options,
  value,
  onChange,
}: {
  options: { id: string; name: string; description: string }[];
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
          className="w-48 justify-between"
        >
          <span className="truncate">
            {selected?.name || "Select Parameter"}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-0">
        <Command>
          <CommandInput placeholder="Search parameters..." />
          <CommandEmpty>No parameter found.</CommandEmpty>
          <CommandGroup>
            {options.map((m) => (
              <CommandItem
                key={m.id}
                value={m.id}
                onSelect={() => {
                  onChange(m.id);
                  setOpen(false);
                }}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    value === m.id ? "opacity-100" : "opacity-0",
                  )}
                />
                <div>
                  <div className="font-medium">{m.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {m.description}
                  </div>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/** quick t-dist tail approximation for p-value (two-sided) */
function approxTPValue(t: number, df: number) {
  // simple logistic-ish approximation (good enough for UI)
  const x = Math.log1p((t * t) / df);
  const pOneSide = 1 / (1 + Math.exp(1.2 + 1.4 * x));
  return Math.min(1, 2 * pOneSide);
}
