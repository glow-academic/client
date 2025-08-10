"use client";

/**
 * Pricing.tsx
 * Interactive pricing analytics for model runs.
 * - Filters by date range and models
 * - Computes spend from input/output tokens using model ppm
 * - Displays summary cards and a stacked area chart (per model) + total line
 */

import { useQuery } from "@tanstack/react-query";
import { format, isAfter, isBefore } from "date-fns";
import { useEffect, useMemo, useState } from "react";
import type { DateRange } from "react-day-picker";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePickerWithRange } from "@/components/ui/date-picker-range";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import { Area, AreaChart, CartesianGrid, Line, XAxis, YAxis } from "recharts";

import { Model, ModelRun } from "@/types";
import { getAllModelRuns } from "@/utils/queries/model_runs/get-all-model-runs";
import { getAllModels } from "@/utils/queries/models/get-all-models";
import { ChevronDown, Loader2 } from "lucide-react";

const currency = (value: number) =>
  new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);

const COLOR_PALETTE = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
  "#84cc16",
  "#ec4899",
  "#14b8a6",
  "#f97316",
];

export default function Pricing() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const now = new Date();
    const start = new Date(now);
    // Default: last 30 days
    start.setDate(start.getDate() - 30);
    start.setHours(0, 0, 0, 0);
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    return { from: start, to: end };
  });

  const { data: models = [], isLoading: modelsLoading } = useQuery({
    queryKey: ["models"],
    queryFn: () => getAllModels() as Promise<Model[]>,
  });

  const { data: runs = [], isLoading: runsLoading } = useQuery({
    queryKey: ["model_runs"],
    queryFn: () => getAllModelRuns() as Promise<ModelRun[]>,
  });

  const [selectedModelIds, setSelectedModelIds] = useState<string[]>([]);

  // Ensure at least one model selected by default once models load
  useEffect(() => {
    if (models.length && selectedModelIds.length === 0) {
      setSelectedModelIds(
        models.slice(0, Math.min(4, models.length)).map((m) => m.id)
      );
    }
  }, [models, selectedModelIds.length]);

  const modelIdToMeta = useMemo(() => {
    const map = new Map<string, Model>();
    models.forEach((m) => map.set(m.id, m));
    return map;
  }, [models]);

  // Compute spend per run and aggregate by day per model
  const { chartData, totals, chartConfig } = useMemo(() => {
    if (!runs?.length || !models?.length) {
      return {
        chartData: [] as Array<Record<string, number | string>>,
        totals: { totalSpend: 0, runCount: 0, avgCost: 0 },
        chartConfig: {} as Record<string, { label: string; color: string }>,
      };
    }

    const dateFiltered = runs.filter((r) => {
      if (!dateRange?.from || !dateRange?.to) return true;
      const d = new Date(r.createdAt);
      return isAfter(d, dateRange.from) && isBefore(d, dateRange.to);
    });

    const include = new Set(
      selectedModelIds.length ? selectedModelIds : models.map((m) => m.id)
    );

    const byDay = new Map<
      string,
      { dateLabel: string; values: Record<string, number> }
    >();

    let totalSpend = 0;
    let runCount = 0;

    for (const run of dateFiltered) {
      if (!include.has(run.modelId)) continue;
      const meta = modelIdToMeta.get(run.modelId);
      if (!meta) continue;

      const spend =
        (run.inputTokens / 1_000_000) * (meta.inputPpm || 0) +
        (run.outputTokens / 1_000_000) * (meta.outputPpm || 0);

      const dateKey = format(new Date(run.createdAt), "yyyy-MM-dd");
      const dateLabel = format(new Date(run.createdAt), "MMM dd");

      if (!byDay.has(dateKey)) {
        byDay.set(dateKey, { dateLabel, values: {} });
      }

      const bucket = byDay.get(dateKey)!;
      bucket.values[run.modelId] = (bucket.values[run.modelId] || 0) + spend;

      totalSpend += spend;
      runCount += 1;
    }

    const data = Array.from(byDay.entries())
      .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
      .map(([_, { dateLabel, values }]) => {
        const row: Record<string, number | string> = { date: dateLabel };
        for (const modelId of include) {
          row[modelId] = Number((values[modelId] || 0).toFixed(2));
        }
        row["total"] = Number(
          Object.values(values)
            .reduce((s, v) => s + (v || 0), 0)
            .toFixed(2)
        );
        return row;
      });

    const modelIdToColor: Record<string, string> = {};
    let colorIdx = 0;
    for (const modelId of include) {
      modelIdToColor[modelId] =
        COLOR_PALETTE[colorIdx % COLOR_PALETTE.length] ?? "#999999";
      colorIdx += 1;
    }

    const config: Record<string, { label: string; color: string }> = {};
    for (const modelId of include) {
      const meta = modelIdToMeta.get(modelId);
      config[modelId] = {
        label: meta?.name ?? modelId,
        color: modelIdToColor[modelId] ?? "#999999",
      };
    }
    config["total"] = { label: "Total", color: "#334155" };

    return {
      chartData: data,
      totals: {
        totalSpend: Number(totalSpend.toFixed(2)),
        runCount,
        avgCost: runCount ? Number((totalSpend / runCount).toFixed(2)) : 0,
      },
      chartConfig: config,
    };
  }, [runs, models, dateRange, selectedModelIds, modelIdToMeta]);

  const loading = modelsLoading || runsLoading;

  return (
    <div className="flex flex-col gap-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <DatePickerWithRange
          dateRange={dateRange}
          setDateRange={setDateRange}
        />

        {/* Model Multi-select */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="secondary" size="sm" className="h-8">
              Models
              <ChevronDown className="ml-1 h-3.5 w-3.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-72 p-3">
            <div className="max-h-64 overflow-y-auto pr-1 space-y-2">
              {models.map((m) => {
                const checked = selectedModelIds.includes(m.id);
                return (
                  <label
                    key={m.id}
                    className="flex items-center gap-2 cursor-pointer text-sm"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(v) => {
                        setSelectedModelIds((prev) => {
                          const next = new Set(prev);
                          if (v) next.add(m.id);
                          else next.delete(m.id);
                          return Array.from(next);
                        });
                      }}
                    />
                    <span className="truncate">{m.name}</span>
                  </label>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>

        {/* Selected badges */}
        <div className="flex flex-wrap gap-1">
          {(selectedModelIds.length
            ? selectedModelIds
            : models.map((m) => m.id)
          )
            .slice(0, 6)
            .map((id) => {
              const meta = modelIdToMeta.get(id);
              return (
                <Badge key={id} variant="secondary" className="font-normal">
                  {meta?.name || id}
                </Badge>
              );
            })}
          {selectedModelIds.length > 6 && (
            <Badge variant="outline">+{selectedModelIds.length - 6}</Badge>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium">Total spend</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-semibold">
              {currency(totals.totalSpend)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium">
              Number of runs
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-semibold">{totals.runCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium">
              Avg cost / run
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-semibold">
              {currency(totals.avgCost)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      <Card className="w-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Spend over time</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex h-64 items-center justify-center text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading pricing
              data…
            </div>
          ) : chartData.length === 0 ? (
            <div className="flex h-64 items-center justify-center text-muted-foreground">
              No data for the selected range/models
            </div>
          ) : (
            <ChartContainer
              config={Object.fromEntries(
                Object.entries(chartConfig).map(([k, v]) => [
                  k,
                  { label: v.label, color: v.color },
                ])
              )}
              className="aspect-[16/7]"
            >
              <AreaChart
                data={chartData}
                margin={{ left: 8, right: 8, bottom: 12 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tickLine={false} axisLine={false} />
                <YAxis
                  tickFormatter={(v) => `$${v}`}
                  width={64}
                  tickLine={false}
                  axisLine={false}
                />
                <ChartTooltip
                  content={<ChartTooltipContent />}
                  formatter={(value: number, name: string) => [
                    currency(value),
                    (
                      chartConfig as Record<
                        string,
                        { label: string; color: string }
                      >
                    )[name]?.label || name,
                  ]}
                />
                <ChartLegend content={<ChartLegendContent />} />

                {/* Stacked areas per model */}
                {(selectedModelIds.length
                  ? selectedModelIds
                  : models.map((m) => m.id)
                ).map((modelId) => (
                  <Area
                    key={modelId}
                    type="monotone"
                    dataKey={modelId}
                    stackId="1"
                    stroke={
                      (
                        chartConfig as Record<
                          string,
                          { label: string; color: string }
                        >
                      )[modelId]?.color
                    }
                    fill={
                      (
                        chartConfig as Record<
                          string,
                          { label: string; color: string }
                        >
                      )[modelId]?.color
                    }
                    fillOpacity={0.2}
                    strokeWidth={2}
                    dot={false}
                  />
                ))}

                {/* Total spend line */}
                <Line
                  type="monotone"
                  dataKey="total"
                  stroke={
                    (
                      chartConfig as Record<
                        string,
                        { label: string; color: string }
                      >
                    )["total"]?.color
                  }
                  strokeWidth={2}
                  dot={false}
                  name="Total"
                />
              </AreaChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
