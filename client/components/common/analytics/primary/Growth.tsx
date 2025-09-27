/**
 * Growth.tsx
 * This component displays the growth for the personas.
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

import type { AnalyticsFilters } from "@/lib/analytics";
import { attachFormatters } from "@/lib/analyticsAdapters";
import { useAnalyticsGrowthData } from "@/lib/api/hooks/analytics";
import { TrendingUp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import GrowthPicker, { type GrowthMetric } from "../GrowthPicker";
export interface GrowthProps {
  filters: AnalyticsFilters;
}

export default function Growth({ filters }: GrowthProps) {
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>([
    "averageScore",
  ]);

  // Fetch growth data using the hook
  const { data: rawData, isLoading, error } = useAnalyticsGrowthData(filters);

  // Transform data to include formatter functions
  const data = rawData ? attachFormatters(rawData) : undefined;

  const chartData = useMemo(
    () => (data?.["chartData"] as unknown[]) ?? [],
    [data]
  );
  const availableMetrics = useMemo(
    () => (data?.["availableMetrics"] ?? []) as GrowthMetric[],
    [data]
  );

  // Ensure at least one metric is always selected
  useEffect(() => {
    if (
      selectedMetrics.length === 0 &&
      availableMetrics.length > 0 &&
      availableMetrics[0]
    ) {
      setSelectedMetrics([availableMetrics[0].id]);
    }
  }, [selectedMetrics.length, availableMetrics]);

  // Get selected metric objects
  const selectedMetricObjects = useMemo(() => {
    return availableMetrics.filter((metric) =>
      selectedMetrics.includes(metric.id)
    );
  }, [availableMetrics, selectedMetrics]);

  // Use server-provided growth status, fallback to local calculation if needed
  const thresholdStatus = data?.["growthStatus"] ?? "neutral";

  // Use server-provided actionable insight
  const insight = data?.["actionableInsight"] ?? null;

  if (isLoading) {
    return (
      <Card className="w-full h-full flex flex-col">
        <CardHeader>
          <CardTitle>Growth Analytics</CardTitle>
          <CardDescription>Loading growth data...</CardDescription>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center">
          <div className="text-muted-foreground">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-full h-full flex flex-col">
        <CardHeader>
          <CardTitle>Growth Analytics</CardTitle>
          <CardDescription>Error loading growth data</CardDescription>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center">
          <div className="text-destructive">Failed to load growth data</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full h-full flex flex-col relative">
      <div
        className={`absolute top-2 right-2 w-2 h-2 rounded-full ${
          thresholdStatus === "success"
            ? "bg-green-500"
            : thresholdStatus === "warning"
              ? "bg-yellow-500"
              : thresholdStatus === "danger"
                ? "bg-red-500"
                : "bg-gray-400"
        }`}
      />
      <CardHeader className="flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" data-testid="trending-up-icon" />
              Platform Growth
            </CardTitle>
            <CardDescription>
              Platform-wide performance metrics over time
            </CardDescription>
          </div>
          <GrowthPicker
            availableMetrics={availableMetrics}
            selectedMetrics={selectedMetrics}
            onMetricsChange={setSelectedMetrics}
          />
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 flex flex-col space-y-6">
          {/* Multi-line Chart */}
          <div
            className="flex-1 min-h-0"
            style={
              process.env.NODE_ENV === "test"
                ? { minWidth: 400, minHeight: 300 }
                : undefined
            }
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="date"
                  className="text-xs"
                  angle={-45}
                  textAnchor="end"
                  height={60}
                />
                <YAxis className="text-xs" domain={[0, "auto"]} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--background))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "6px",
                  }}
                  formatter={(value: number, name: string) => {
                    const metric = availableMetrics.find((m) => m.id === name);
                    const formattedValue = metric?.formatter
                      ? metric.formatter(value)
                      : `${value}%`;
                    return [formattedValue, metric?.name || name];
                  }}
                />
                <Legend />
                {selectedMetricObjects.map((metric) => (
                  <Line
                    key={metric.id}
                    type="monotone"
                    dataKey={metric.id}
                    stroke={metric.color}
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    name={metric.name}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Actionable Insights */}
          {insight && (
            <div className="p-3 bg-muted rounded-lg mt-2">
              <p className="text-sm text-muted-foreground">{String(insight)}</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
