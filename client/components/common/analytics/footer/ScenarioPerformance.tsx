/**
 * ScenarioPerformance.tsx
 * This component displays scenario attribute breakdown with performance metrics.
 * Shows what percentage of scenarios use each specific attribute and their performance.
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type {
  ScenarioAttributeAttemptFact,
  ScenarioAttributeScenarioFact,
} from "@/lib/api/v2/schemas/dashboard";
import { cn } from "@/lib/utils";
import { BarChart3, Check, ChevronsUpDown } from "lucide-react";
import { useMemo, useState } from "react";
import type { TooltipProps } from "recharts";
import {
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

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

function iconFor(paramName: string, itemName: string) {
  const p = paramName.toLowerCase();
  if (p.includes("difficulty")) return "🎚️";
  if (p.includes("topic")) return "🧩";
  if (p.includes("persona")) return "🧑‍🏫";
  if (p.includes("region")) return "🌍";
  // per-item easter eggs:
  if (/pass/i.test(itemName)) return "✅";
  return ""; // was "•"
}

function CustomPieTooltip({
  active,
  payload,
  getElement,
}: {
  active?: boolean;
  payload?: TooltipProps<number, string>["payload"];
  getElement: (name: string) => AttributeElement | undefined;
}) {
  if (!active || !payload || !payload.length) return null;

  // For Pie, the first payload item corresponds to the hovered slice
  const item = payload[0];
  const name = String(item?.name ?? "");
  const el = getElement(name);
  if (!el) return null;

  return (
    <div className="rounded-md border border-border bg-muted/70 backdrop-blur px-3 py-2 shadow-sm">
      <div className="font-medium">
        {el.icon ? <span className="mr-1">{el.icon}</span> : null}
        {el.displayName}
      </div>
      <div className="mt-1 text-xs space-y-1">
        <div>Usage: {el.percentage}%</div>
        <div>Scenarios: {el.count}</div>
        <div>Avg Score: {el.avgScore}%</div>
        <div>Completion: {el.completionRate}%</div>
        <div>Attempts: {el.totalAttempts}</div>
      </div>
    </div>
  );
}

type AttributeElement = {
  id: string;
  name: string;
  displayName: string;
  icon: string;
  color: string;
  count: number;
  percentage: number;
  avgScore: number;
  completionRate: number;
  totalAttempts: number;
  trendData: { date: string; score: number; timestamp: number }[];
};

export interface ScenarioPerformanceProps {
  attributeAttemptFacts: ScenarioAttributeAttemptFact[];
  attributeScenarioFacts: ScenarioAttributeScenarioFact[];
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
  /** Valid parameter IDs */
  validParameterIds: string[];
  isLoading: boolean;
  isError: boolean;
  actionableInsight?: string | null;
  thresholds: {
    danger: number;
    warning: number;
    success: number;
  };
}

export default function ScenarioPerformance({
  attributeAttemptFacts,
  attributeScenarioFacts,
  parameterMapping,
  parameterItemMapping,
  validParameterIds,
  isLoading,
  isError,
  actionableInsight,
  thresholds,
}: ScenarioPerformanceProps) {
  const [selectedParameterId, setSelectedParameterId] = useState<string>("");

  // Build parameters from mapping
  const allParameters = useMemo(
    () =>
      validParameterIds.map((id) => ({
        id,
        name: parameterMapping[id]?.name || "Unknown",
        description: parameterMapping[id]?.description || "",
        numerical: false,
        active: true,
        departmentId: "",
      })),
    [parameterMapping, validParameterIds]
  );

  // Build parameter items from mapping
  const allParameterItems = useMemo(
    () =>
      Object.entries(parameterItemMapping)
        .filter(([, item]) => validParameterIds.includes(item.parameter_id))
        .map(([id, item]) => ({
          id,
          name: item.name,
          description: item.description || "",
          parameterId: item.parameter_id,
        })),
    [parameterItemMapping, validParameterIds]
  );

  const parameterOptions = useMemo(() => {
    return allParameters
      .filter((p) => !p.numerical && p.active)
      .map((p) => ({
        id: p.id,
        name: p.name,
        description: `Performance by ${p.name.toLowerCase()} value`,
      }));
  }, [allParameters]);

  // pick default
  const activeParameterId = useMemo(() => {
    return selectedParameterId || parameterOptions[0]?.id || "";
  }, [selectedParameterId, parameterOptions]);

  const itemsForParameter = useMemo(
    () =>
      allParameterItems.filter(
        (it) =>
          it.parameterId === activeParameterId &&
          attributeScenarioFacts.some((f) => f.parameterItemId === it.id)
      ),
    [allParameterItems, attributeScenarioFacts, activeParameterId]
  );

  const totalScenariosForParam = useMemo(() => {
    const set = new Set(
      attributeScenarioFacts
        .filter((f) => f.parameterId === activeParameterId)
        .map((f) => f.scenarioId)
    );
    return set.size || 1; // avoid /0
  }, [attributeScenarioFacts, activeParameterId]);

  const elements: AttributeElement[] = useMemo(() => {
    return itemsForParameter.map((it, idx) => {
      const scen = attributeScenarioFacts.filter(
        (f) => f.parameterItemId === it.id
      );
      const scenCount = new Set(scen.map((s) => s.scenarioId)).size;

      const attempts = attributeAttemptFacts.filter(
        (f) => f.parameterItemId === it.id
      );
      const totalAttempts = attempts.reduce((s, a) => s + a.attempts, 0);
      const passed = attempts.reduce((s, a) => s + a.passedAttempts, 0);
      const avgScoreWeighted =
        totalAttempts > 0
          ? Math.round(
              attempts.reduce((s, a) => s + a.avgScore * a.attempts, 0) /
                totalAttempts
            )
          : 0;
      const completionRate =
        totalAttempts > 0 ? Math.round((100 * passed) / totalAttempts) : 0;

      const trendData = attempts
        .slice()
        .sort((a, b) => a.timestamp - b.timestamp)
        .map((a) => ({
          date: a.date,
          score: a.avgScore,
          timestamp: a.timestamp,
        }));

      const color = pickColor(idx);
      const paramName =
        allParameters.find((p) => p.id === activeParameterId)?.name ?? "";

      return {
        id: `param-item-${it.id}`,
        name: it.name,
        displayName: it.name,
        icon: iconFor(paramName, it.name),
        color,
        count: scenCount,
        percentage:
          Math.round((1000 * scenCount) / totalScenariosForParam) / 10, // 1 decimal
        avgScore: avgScoreWeighted,
        completionRate,
        totalAttempts,
        trendData,
      };
    });
  }, [
    itemsForParameter,
    attributeAttemptFacts,
    attributeScenarioFacts,
    totalScenariosForParam,
    activeParameterId,
    allParameters,
  ]);

  const avgPerf = elements.length
    ? elements.reduce((s, e) => s + e.avgScore, 0) / elements.length
    : 0;
  const status =
    elements.length === 0
      ? "neutral"
      : avgPerf >= thresholds.success
        ? "success"
        : avgPerf >= thresholds.warning
          ? "warning"
          : "danger";

  // Create lookup for custom tooltip
  const elementsByName = useMemo(
    () => Object.fromEntries(elements.map((e) => [e.name, e] as const)),
    [elements]
  );

  // Compact legend renderer for single-line layout
  function LegendCompact({
    payload,
    elements,
  }: {
    payload?: Array<{ value: string; color?: string }>;
    elements: AttributeElement[];
  }) {
    const count = payload?.length ?? 0;

    // Density presets based on legend size
    const fontSize = count <= 8 ? 12 : count <= 14 ? 11 : count <= 20 ? 10 : 9;
    const dot = count <= 8 ? 8 : count <= 14 ? 7 : 6;
    const padX = count <= 8 ? "px-2" : count <= 14 ? "px-1.5" : "px-1";
    const padY = count <= 8 ? "py-1" : count <= 14 ? "py-0.5" : "py-0.5";
    const gap = count <= 8 ? "gap-2" : count <= 14 ? "gap-1.5" : "gap-1";
    // Constrain each pill's width so everything fits on one line; truncate long text
    const maxLabelPx = count <= 8 ? 140 : count <= 14 ? 110 : 90;

    return (
      <div
        className={`w-full ${gap} flex items-center justify-center flex-nowrap overflow-x-auto no-scrollbar min-h-7`}
        style={{ lineHeight: 1 }} // keep it one line high
      >
        {payload?.map((entry) => {
          const element = elements.find((e) => e.name === entry.value);
          if (!element) return null;
          return (
            <Dialog key={entry.value}>
              <DialogTrigger asChild>
                <span
                  className={`cursor-pointer hover:text-primary transition-colors inline-flex items-center ${padX} ${padY} rounded border border-border hover:border-primary/50 hover:bg-muted/50 whitespace-nowrap`}
                  style={{ fontSize }}
                  title={element.name} // full name on hover
                >
                  <span
                    className="inline-block rounded-sm mr-1"
                    style={{
                      backgroundColor: element.color,
                      width: dot,
                      height: dot,
                      minWidth: dot,
                    }}
                  />
                  <span className="truncate" style={{ maxWidth: maxLabelPx }}>
                    {element.name}
                  </span>
                </span>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <span className="text-lg">{element.icon}</span>
                    {element.displayName} Performance
                  </DialogTitle>
                  <DialogDescription hidden>Daily trend</DialogDescription>
                </DialogHeader>

                {element.trendData.length > 0 && (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={element.trendData}>
                        <XAxis
                          dataKey="date"
                          className="text-xs"
                          angle={-45}
                          textAnchor="end"
                          height={60}
                        />
                        <YAxis className="text-xs" />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "white",
                            border: "1px solid #e5e7eb",
                            borderRadius: "6px",
                          }}
                          formatter={(v: number) => [`${v}%`, "Score"]}
                        />
                        <Line
                          type="monotone"
                          dataKey="score"
                          stroke={element.color}
                          strokeWidth={2}
                          dot={{ r: 4 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          );
        })}
      </div>
    );
  }

  if (isLoading) {
    return (
      <Card className="w-full h-full flex flex-col">
        <CardHeader>
          <CardTitle>Scenario Attribute Breakdown</CardTitle>
          <CardDescription>Loading scenario data...</CardDescription>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center text-muted-foreground">
          Loading...
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className="w-full h-full flex flex-col">
        <CardHeader>
          <CardTitle>Scenario Attribute Breakdown</CardTitle>
          <CardDescription>Error loading data</CardDescription>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center text-destructive">
          Failed to load scenario data
        </CardContent>
      </Card>
    );
  }

  return (
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
              Scenario Attribute Breakdown
            </CardTitle>
            <CardDescription>
              Performance analysis by scenario attributes
            </CardDescription>
          </div>

          {/* Parameter Picker */}
          <ParamPicker
            options={parameterOptions}
            value={activeParameterId}
            onChange={setSelectedParameterId}
          />
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col gap-2 -mt-2">
        {/* Pie Chart */}
        <div className="flex-1 h-56">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart margin={{ top: -20, right: 8, bottom: 22, left: 8 }}>
              <Pie
                data={elements}
                dataKey="percentage"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={120}
                innerRadius={60}
                paddingAngle={2}
              >
                {elements.map((e, i) => (
                  <Cell key={i} fill={e.color} />
                ))}
              </Pie>
              <Tooltip
                content={
                  <CustomPieTooltip
                    getElement={(name: string) => elementsByName[name]}
                  />
                }
              />
              <Legend
                verticalAlign="bottom"
                height={28}
                wrapperStyle={{ width: "100%" }}
                content={({ payload }) => (
                  <LegendCompact
                    payload={
                      payload as Array<{ value: string; color?: string }>
                    }
                    elements={elements}
                  />
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Actionable Insights */}
        {actionableInsight && (
          <div className="p-3 bg-muted rounded-lg -mt-2">
            <p className="text-sm text-muted-foreground text-center">
              {actionableInsight}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ParamPicker({
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
            {options.map((p) => (
              <CommandItem
                key={p.id}
                value={p.id}
                onSelect={() => {
                  onChange(p.id);
                  setOpen(false);
                }}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    value === p.id ? "opacity-100" : "opacity-0"
                  )}
                />
                <div>
                  <div className="font-medium">{p.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {p.description}
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
