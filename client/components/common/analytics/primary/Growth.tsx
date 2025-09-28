/**
 * Growth.tsx
 * Fast and dumb UI component for displaying growth analytics.
 * All data processing is handled externally via props.
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

import type { GrowthDataResponse, GrowthMetric } from "@/lib/analytics";
import { attachFormatters } from "@/lib/analyticsAdapters";
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
import GrowthPicker from "../GrowthPicker";

// Type for metrics with formatter functions
type GrowthMetricWithFormatter = GrowthMetric & {
  formatter: (value: number) => string;
};

export interface GrowthProps {
  chartData: GrowthDataResponse["chartData"];
  availableMetrics: GrowthMetric[];
  windowAverages: GrowthDataResponse["windowAverages"];
  hasDataAvailable: boolean;
  isLoading: boolean;
  isError: boolean;
  actionableInsight: string | null;
  thresholds: {
    danger: number;
    warning: number;
    success: number;
  };
}

export default function Growth({
  chartData,
  availableMetrics,
  windowAverages,
  hasDataAvailable,
  isLoading,
  isError,
  actionableInsight,
  thresholds,
}: GrowthProps) {
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>([
    "averageScore",
  ]);

  // Transform availableMetrics to include formatter functions
  const metricsWithFormatters = useMemo(() => {
    const result = attachFormatters({ availableMetrics });
    return result["availableMetrics"] as GrowthMetricWithFormatter[];
  }, [availableMetrics]);

  // Ensure at least one metric is always selected
  useEffect(() => {
    if (
      selectedMetrics.length === 0 &&
      metricsWithFormatters.length > 0 &&
      metricsWithFormatters[0]
    ) {
      setSelectedMetrics([metricsWithFormatters[0].id]);
    }
  }, [selectedMetrics.length, metricsWithFormatters]);

  // Get selected metric objects
  const selectedMetricObjects = useMemo(() => {
    return metricsWithFormatters.filter((metric) =>
      selectedMetrics.includes(metric.id)
    );
  }, [metricsWithFormatters, selectedMetrics]);

  // Calculate threshold status based on window averages
  const getThresholdStatus = () => {
    if (!hasDataAvailable) return "neutral";

    if (
      !windowAverages?.averageScore?.last ||
      !windowAverages?.averageScore?.prev
    ) {
      return "neutral";
    }

    const improvement =
      windowAverages.averageScore.last - windowAverages.averageScore.prev;

    if (improvement >= thresholds.success) return "success";
    if (improvement >= thresholds.warning) return "warning";
    return "danger";
  };

  const thresholdStatus = getThresholdStatus();

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

  if (isError) {
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

  if (!hasDataAvailable) {
    return (
      <Card className="w-full h-full flex flex-col">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Platform Growth
          </CardTitle>
          <CardDescription>
            Platform-wide performance metrics over time
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center">
          <div className="text-muted-foreground">
            No data available for the selected period
          </div>
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
            availableMetrics={metricsWithFormatters}
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
                <YAxis className="text-xs" domain={[0, 100]} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--background))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "6px",
                  }}
                  formatter={(value: number, name: string) => {
                    const metric = metricsWithFormatters.find(
                      (m) => m.id === name
                    );
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
          {actionableInsight && (
            <div className="p-3 bg-muted rounded-lg mt-2">
              <p className="text-sm text-muted-foreground">
                {actionableInsight}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
