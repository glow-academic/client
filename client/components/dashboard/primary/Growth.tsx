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
import { TruncatedInsight } from "../TruncatedInsight";

type GrowthDataPoint = {
  date: string;
  averageScore: number | null;
  completionRate: number | null;
  firstAttemptPassRate: number | null;
  sessionEfficiency: number | null;
  stagnationRate: number | null;
};

type GrowthMetric = {
  id: string;
  name: string;
  color: string;
  unit: string;
  description: string;
  formatterId: "percent" | "int" | "sec" | "min" | "hours" | "minutes";
};

type GrowthWindowAverage = {
  n: number;
  last: number | null;
  prev: number | null;
};

type GrowthWindowAverages = {
  averageScore: GrowthWindowAverage;
};

type GrowthDataResponse = {
  chartData: GrowthDataPoint[];
  availableMetrics: GrowthMetric[];
  windowAverages: GrowthWindowAverages;
};

import { RubricPicker } from "@/components/common/forms/RubricPicker";
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

// Type for metrics with formatter functions
type GrowthMetricWithFormatter = GrowthMetric & {
  formatter: (value: number) => string;
};

export interface GrowthProps {
  chartData: GrowthDataResponse["chartData"];
  availableMetrics: GrowthMetric[];
  windowAverages: GrowthDataResponse["windowAverages"];
  hasDataAvailable: boolean;
  actionableInsight: string | null;
  status: "success" | "warning" | "danger" | "neutral";
}

export default function Growth({
  chartData,
  availableMetrics,
  windowAverages: _windowAverages,
  hasDataAvailable,
  actionableInsight,
  status,
}: GrowthProps) {
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>([
    "averageScore",
  ]);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024); // lg breakpoint
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Transform availableMetrics to include formatter functions
  const metricsWithFormatters = useMemo(() => {
    const fmt = {
      percent: (v: number) => `${Math.round(v)}%`,
      int: (v: number) => `${Math.round(v)}`,
      sec: (v: number) => `${Math.round(v)} sec`,
      min: (v: number) => `${Math.round(v)} min`,
      hours: (v: number) => `${Math.round(v)}h`,
      minutes: (v: number) => {
        const totalMinutes = Math.round(v);
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        if (hours > 0) {
          return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
        }
        return `${minutes}m`;
      },
    };

    return availableMetrics.map(({ formatterId, ...rest }) => ({
      ...rest,
      formatter: fmt[formatterId],
    })) as GrowthMetricWithFormatter[];
  }, [availableMetrics]);

  // Build metric mapping for RubricPicker
  const metricMapping = useMemo(() => {
    const mapping: Record<string, { name: string; description: string }> = {};
    metricsWithFormatters.forEach((metric) => {
      mapping[metric.id] = {
        name: metric.name,
        description: metric.description || `${metric.name} (${metric.unit})`,
      };
    });
    return mapping;
  }, [metricsWithFormatters]);

  const validMetricIds = useMemo(() => {
    return metricsWithFormatters.map((m) => m.id);
  }, [metricsWithFormatters]);

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

  // Handle metric selection with validation (prevent deselecting all)
  const handleMetricsSelect = (ids: string[]) => {
    // If "Clear All" is clicked (empty array), reset to just the first metric
    if (ids.length === 0 && metricsWithFormatters.length > 0) {
      setSelectedMetrics([metricsWithFormatters[0]!.id]);
      return;
    }
    setSelectedMetrics(ids);
  };

  // Get selected metric objects
  const selectedMetricObjects = useMemo(() => {
    return metricsWithFormatters.filter((metric) =>
      selectedMetrics.includes(metric.id)
    );
  }, [metricsWithFormatters, selectedMetrics]);

  // Use status from server
  const thresholdStatus = status;

  // Normalize to a string once
  const normalizedInsight = useMemo(
    () => (actionableInsight ?? "").trim(),
    [actionableInsight]
  );

  if (!hasDataAvailable) {
    return (
      <Card className="w-full h-full flex flex-col">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex flex-col items-start">
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Platform Growth
              </CardTitle>
              <CardDescription className="text-sm line-clamp-2">
                Platform-wide performance metrics over time
              </CardDescription>
            </div>
          </div>
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
            ? "bg-success"
            : thresholdStatus === "warning"
              ? "bg-warning"
              : thresholdStatus === "danger"
                ? "bg-destructive"
                : "bg-muted-foreground"
        }`}
      />
      <CardHeader className="flex-shrink-0">
        <div className="flex items-start justify-between">
          <div className="flex flex-col items-start">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" data-testid="trending-up-icon" />
              Platform Growth
            </CardTitle>
            <CardDescription className="text-sm line-clamp-2">
              Platform-wide performance metrics over time
            </CardDescription>
          </div>
          <RubricPicker
            mapping={metricMapping}
            validIds={validMetricIds}
            selectedIds={selectedMetrics}
            onSelect={handleMetricsSelect}
            multiSelect={true}
            placeholder="Select metrics..."
            hideSelectedChips={true}
            buttonClassName="w-48"
          />
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 flex flex-col space-y-4">
          {/* Multi-line Chart */}
          <div
            className="flex-1 min-h-0"
            style={
              process.env.NODE_ENV === "test"
                ? { minWidth: 400, minHeight: 280 }
                : { minHeight: 280 }
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
                  tickFormatter={(value: string) => {
                    // Format YYYY-MM-DD to MM-DD
                    const parts = value.split("-");
                    if (parts.length === 3) {
                      return `${parts[1]}-${parts[2]}`;
                    }
                    return value;
                  }}
                />
                <YAxis className="text-xs" domain={[0, 100]} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "black",
                    border: "1px solid black",
                    color: "white",
                    borderRadius: "6px",
                  }}
                  labelStyle={{
                    color: "white",
                  }}
                  itemStyle={{
                    color: "white",
                  }}
                  labelFormatter={(label: string) => {
                    // Format YYYY-MM-DD to MM-DD
                    const parts = label.split("-");
                    if (parts.length === 3) {
                      return `${parts[1]}-${parts[2]}`;
                    }
                    return label;
                  }}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(value: number, _name: string, item: any) => {
                    const id = String(item?.dataKey ?? "");
                    const metric = metricsWithFormatters.find(
                      (m) => m.id === id
                    );

                    // Prefer the metric's own formatter if present
                    if (metric?.formatter) {
                      return [metric.formatter(value), metric.name];
                    }

                    // Smart fallback based on metric id (NOT name)
                    // All remaining metrics are percentages (0-100)
                    const formattedValue = `${Math.round(value)}%`;

                    return [formattedValue, metric?.name ?? id];
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
          {normalizedInsight && (
            <div className="flex-shrink-0 w-full" data-testid="growth-insight">
              <TruncatedInsight text={normalizedInsight} isMobile={isMobile} />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
