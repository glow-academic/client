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
} from "@/lib/analytics";
import { cn } from "@/lib/utils";
import { BarChart3, Check, ChevronsUpDown } from "lucide-react";
import { useMemo, useState } from "react";
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

type Parameter = {
  id: string;
  name: string;
  numerical: boolean;
  active: boolean;
  description?: string | null;
};
type ParameterItem = {
  id: string;
  parameterId: string;
  name: string;
  description?: string | null;
  value?: string | null;
};

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
  allParameters: Parameter[]; // from client cache
  allParameterItems: ParameterItem[]; // from client cache
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
  allParameters,
  allParameterItems,
  isLoading,
  isError,
  actionableInsight,
  thresholds,
}: ScenarioPerformanceProps) {
  const [selectedParameterId, setSelectedParameterId] = useState<string>("");

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
    return itemsForParameter.map((it) => {
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

      return {
        id: `param-item-${it.id}`,
        name: it.name,
        displayName: it.name,
        icon: it.description ?? "",
        color: it.value || "#888888",
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

      <CardContent className="space-y-6 flex-1 flex flex-col">
        {/* Pie */}
        <div className="flex-1 min-h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
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
                contentStyle={{
                  backgroundColor: "hsl(var(--background))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "6px",
                }}
                formatter={(value: number, name: string) => {
                  const element = elements.find((e) => e.name === name);
                  if (!element) return [value, name];
                  return [
                    <div key="t" className="space-y-2">
                      <div className="font-medium">
                        {element.icon} {element.displayName}
                      </div>
                      <div className="text-sm space-y-1">
                        <div>Usage: {element.percentage}%</div>
                        <div>Scenarios: {element.count}</div>
                        <div>Avg Score: {element.avgScore}%</div>
                        <div>Completion: {element.completionRate}%</div>
                        <div>Attempts: {element.totalAttempts}</div>
                      </div>
                    </div>,
                    "",
                  ];
                }}
                labelFormatter={() => ""}
              />
              <Legend
                verticalAlign="bottom"
                height={80}
                content={({ payload }) => (
                  <div className="flex items-center justify-center gap-2 pt-1 flex-wrap">
                    {payload?.map((entry: { value: string }, idx: number) => {
                      const element = elements[idx];
                      if (!element) return null;
                      return (
                        <Dialog key={entry.value}>
                          <DialogTrigger asChild>
                            <span className="text-xs cursor-pointer hover:text-primary transition-colors flex items-center gap-1 px-2 py-1 rounded border border-border hover:border-primary/50 hover:bg-muted/50 whitespace-nowrap">
                              <span style={{ color: element.color }}>●</span>
                              {element.name}
                            </span>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl">
                            <DialogHeader>
                              <DialogTitle className="flex items-center gap-2">
                                <span className="text-lg">{element.icon}</span>
                                {element.displayName} Performance
                              </DialogTitle>
                              <DialogDescription hidden>
                                Daily trend
                              </DialogDescription>
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
                                        backgroundColor:
                                          "hsl(var(--background))",
                                        border: "1px solid hsl(var(--border))",
                                        borderRadius: "6px",
                                      }}
                                      formatter={(v: number) => [
                                        `${v}%`,
                                        "Score",
                                      ]}
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
                )}
              />
            </PieChart>
          </ResponsiveContainer>
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
