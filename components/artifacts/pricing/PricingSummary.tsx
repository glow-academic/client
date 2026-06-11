"use client";

/**
 * PricingSummary.tsx
 * Summary cards and chart for pricing analytics.
 * This component stays outside Suspense boundaries to prevent remounting on table interactions.
 */

import type { PricingOut } from "@/app/(main)/analytics/pricing/page";
import { format } from "date-fns";
import { useMemo } from "react";
import type { TooltipProps } from "recharts";

import { useChartColors, getStatusColor } from "@/lib/utils/chartColors";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
} from "@/components/ui/chart";

import { Area, AreaChart, CartesianGrid, Line, XAxis, YAxis } from "recharts";

const currency = (value: number) =>
  new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);

// Parse a ``YYYY-MM-DD`` bucket key into a LOCAL Date. ``new Date("2026-06-09")``
// parses as UTC midnight, which then renders under the *previous* day once
// formatted in a negative-offset local zone (e.g. US-Eastern) — every spend
// bucket would shift back a day. Building the date from its parts keeps it in
// local time (mirrors the string-split convention in RubricTrend.tsx). Returns
// null for a missing/malformed key so callers can guard against the
// RangeError that ``format(new Date(undefined), …)`` would otherwise throw.
function parseLocalDateKey(key: string | null | undefined): Date | null {
  if (!key) return null;
  const parts = key.split("-");
  if (parts.length !== 3) return null;
  const [year, month, day] = parts.map((p) => Number(p));
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

// Custom tooltip content that sorts items by value descending
function SortedChartTooltipContent({
  active,
  payload,
  label,
  chartConfig,
}: {
  active?: boolean;
  payload?: TooltipProps<number, string>["payload"];
  label?: string;
  chartConfig: Record<string, { label: string; color: string }>;
}) {
  if (!active || !payload?.length) {
    return null;
  }

  // Filter out items with zero or near-zero values and items without config, then sort by value descending
  const filteredAndSortedPayload = [...payload]
    .filter((item) => {
      const value = typeof item.value === "number" ? item.value : 0;
      // Filter out items with value less than 0.01 (essentially $0.00)
      if (value < 0.01) {
        return false;
      }

      // Filter out items that don't have a matching config entry
      const modelId = String(item.dataKey || item.name || "");
      const configItem = (
        chartConfig as Record<string, { label: string; color: string }>
      )[modelId];

      return !!configItem;
    })
    .sort((a, b) => {
      const aValue = typeof a.value === "number" ? a.value : 0;
      const bValue = typeof b.value === "number" ? b.value : 0;
      return bValue - aValue;
    });

  // Don't show tooltip if no items after filtering
  if (filteredAndSortedPayload.length === 0) {
    return null;
  }

  return (
    <div className="border-border/50 bg-background grid min-w-[8rem] items-start gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs shadow-xl">
      {label && <div className="font-medium mb-1">{label}</div>}
      <div className="grid gap-1.5">
        {filteredAndSortedPayload.map((item, index) => {
          // Use dataKey (modelId) to look up config, fallback to name
          const modelId = String(item.dataKey || item.name || "");
          const configItem = (
            chartConfig as Record<string, { label: string; color: string }>
          )[modelId];

          // This should never happen due to filtering above, but add as safety check
          if (!configItem) {
            return null;
          }

          const label = configItem.label || modelId;
          const color = configItem.color;
          const value = typeof item.value === "number" ? item.value : 0;

          return (
            <div
              key={item.dataKey || item.name || index}
              className="flex w-full flex-wrap items-center gap-2"
            >
              <div
                className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
                style={{
                  backgroundColor: color,
                }}
              />
              <div className="flex flex-1 justify-between items-center leading-none gap-4">
                <span className="text-muted-foreground">{label}</span>
                <span className="text-foreground font-mono font-medium tabular-nums">
                  {currency(value)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface PricingSummaryProps {
  pricingData: PricingOut;
}

export function PricingSummary({ pricingData }: PricingSummaryProps) {
  // Extract data from artifacts/pricing response
  const dailyItems = useMemo(
    () => pricingData?.daily || [],
    [pricingData]
  );
  const modelResources = useMemo(
    () => pricingData?.resources?.models || {},
    [pricingData]
  );
  // Note: group_summary is available at pricingData?.views?.group_summary
  // but we use dailyItems for totals since it's not paginated

  // Get chart colors from CSS variables
  const chartColors = useChartColors();

  // Get muted color for "total" line (using neutral status color)
  const mutedColor = useMemo(() => getStatusColor("neutral"), []);

  // Compute chart data and totals from daily aggregates
  const { chartData, totals, chartConfig } = useMemo(() => {
    // Calculate totals from daily data (aggregated across all dates, not paginated)
    const totalSpend = dailyItems.reduce(
      (sum, item) => sum + Number(item.total_cost || 0),
      0
    );
    const runCount = dailyItems.reduce(
      (sum, item) => sum + (item.run_count || 0),
      0
    );

    if (!dailyItems?.length) {
      return {
        chartData: [] as Array<Record<string, number | string>>,
        totals: {
          totalSpend: Number(totalSpend.toFixed(2)),
          runCount,
          avgCost: runCount ? Number((totalSpend / runCount).toFixed(2)) : 0,
        },
        chartConfig: {} as Record<string, { label: string; color: string }>,
      };
    }

    // Collect unique model IDs from daily data
    const modelIds = new Set<string>();
    for (const item of dailyItems) {
      if (item.model_id) {
        modelIds.add(item.model_id);
      }
    }

    // Group daily items by date
    const byDay = new Map<
      string,
      { dateLabel: string; values: Record<string, number> }
    >();

    for (const item of dailyItems) {
      const dateKey = item.date_key;
      const parsedDate = parseLocalDateKey(dateKey);
      // Guard the null/malformed case — fall back to the raw key rather than
      // letting date-fns throw a RangeError and crash the whole summary.
      const dateLabel = parsedDate ? format(parsedDate, "MMM dd") : (dateKey ?? "—");
      const modelId = item.model_id || "unknown";
      const cost = Number(item.total_cost || 0);

      if (!byDay.has(dateKey)) {
        byDay.set(dateKey, { dateLabel, values: {} });
      }

      const bucket = byDay.get(dateKey)!;
      bucket.values[modelId] = (bucket.values[modelId] || 0) + cost;
    }

    const data = Array.from(byDay.entries())
      // ``YYYY-MM-DD`` keys sort lexicographically = chronologically, which
      // avoids the NaN a malformed key would produce via ``new Date(...)``.
      .sort((a, b) => String(a[0]).localeCompare(String(b[0])))
      .map(([_, { dateLabel, values }]) => {
        const row: Record<string, number | string> = { date: dateLabel };
        for (const id of modelIds) {
          const value = Number((values[id] || 0).toFixed(2));
          if (value > 0) {
            row[id] = value;
          }
        }
        row["total"] = Number(
          Object.values(values)
            .reduce((s, v) => s + (v || 0), 0)
            .toFixed(2)
        );
        return row;
      });

    // Assign colors to models
    const config: Record<string, { label: string; color: string }> = {};
    let colorIdx = 0;
    for (const id of modelIds) {
      const resolved = modelResources[id];
      const label =
        resolved && typeof resolved["name"] === "string"
          ? resolved["name"]
          : id;
      config[id] = {
        label,
        color: chartColors[colorIdx % chartColors.length] ?? "#999999",
      };
      colorIdx += 1;
    }
    config["total"] = { label: "Total", color: mutedColor };

    return {
      chartData: data,
      totals: {
        totalSpend: Number(totalSpend.toFixed(2)),
        runCount,
        avgCost: runCount ? Number((totalSpend / runCount).toFixed(2)) : 0,
      },
      chartConfig: config,
    };
  }, [dailyItems, chartColors, mutedColor, modelResources]);

  // Get model IDs for chart rendering
  const modelIds = useMemo(() => {
    const ids = new Set<string>();
    for (const item of dailyItems) {
      if (item.model_id) {
        ids.add(item.model_id);
      }
    }
    return Array.from(ids);
  }, [dailyItems]);

  return (
    <div className="flex flex-col gap-4" data-testid="pricing-summary">
      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card data-testid="pricing-card-total-spend">
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium">Total spend</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-semibold">
              {currency(totals.totalSpend)}
            </div>
          </CardContent>
        </Card>
        <Card data-testid="pricing-card-run-count">
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium">
              Number of runs
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-semibold">{totals.runCount}</div>
          </CardContent>
        </Card>
        <Card data-testid="pricing-card-avg-cost">
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
      <Card className="w-full" data-testid="pricing-chart">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Spend over time</CardTitle>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <div className="flex h-64 items-center justify-center text-muted-foreground">
              No data for the selected range/models
            </div>
          ) : (
            <ChartContainer
              config={Object.fromEntries(
                Object.entries(chartConfig).map(([k, v]) => [
                  k,
                  { label: v.label, color: v.color },
                ]),
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
                  content={
                    <SortedChartTooltipContent chartConfig={chartConfig} />
                  }
                />
                <ChartLegend content={<ChartLegendContent />} />

                {/* Stacked areas per model */}
                {modelIds.map((id) => (
                  <Area
                    key={id}
                    type="monotone"
                    dataKey={id}
                    stackId="1"
                    stroke={chartConfig[id]?.color}
                    fill={chartConfig[id]?.color}
                    fillOpacity={0.2}
                    strokeWidth={2}
                    dot={false}
                  />
                ))}

                {/* Total spend line */}
                <Line
                  type="monotone"
                  dataKey="total"
                  stroke={chartConfig["total"]?.color}
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
