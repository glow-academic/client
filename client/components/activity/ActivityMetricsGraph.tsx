/**
 * ActivityMetricsGraph.tsx
 * Fast and dumb UI component for displaying activity metrics as stacked line chart.
 * All data processing is handled externally via props.
 */
"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { GenericPicker } from "@/components/common/forms/GenericPicker";
import { useChartColors } from "@/lib/utils/chartColors";
import { TrendingUp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { TooltipProps } from "recharts";
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

type ActivityChartDataPoint = {
  date: string;
  activeProfiles: number;
  feedbackEntries: number;
  activityEntries: number;
  errors: number;
};

type ActivityMetric = {
  id: string;
  name: string;
  color: string;
  formatter: (value: number) => string;
};

// Custom tooltip component
function CustomLineTooltip({
  active,
  payload,
  label,
  metricsWithFormatters,
}: TooltipProps<number, string> & {
  metricsWithFormatters: ActivityMetric[];
}) {
  if (!active || !payload || !payload.length || !label) return null;

  // Format date label
  const formatDate = (date: string) => {
    const parts = date.split("-");
    if (parts.length === 3) {
      return `${parts[1]}-${parts[2]}`;
    }
    return date;
  };

  return (
    <div className="rounded-md border border-border bg-muted/70 backdrop-blur px-3 py-2 shadow-sm">
      <div className="font-medium">{formatDate(label)}</div>
      <div className="mt-1 text-xs space-y-1">
        {payload.map((item, index) => {
          const dataKey = String(item.dataKey ?? "");
          const metric = metricsWithFormatters.find((m) => m.id === dataKey);
          const formattedValue = metric?.formatter
            ? metric.formatter(Number(item.value))
            : `${Math.round(Number(item.value))}`;
          return (
            <div key={index}>
              {metric?.name ?? dataKey}: {formattedValue}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export interface ActivityMetricsGraphProps {
  chartData: ActivityChartDataPoint[];
  hasDataAvailable: boolean;
}

export default function ActivityMetricsGraph({
  chartData,
  hasDataAvailable,
}: ActivityMetricsGraphProps) {
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>([
    "activeProfiles",
    "feedbackEntries",
    "activityEntries",
    "errors",
  ]);
  // Note: isMobile state removed as it was unused

  // Get chart colors 1-5 from CSS variables
  const chartColors = useChartColors();

  useEffect(() => {
    const checkMobile = () => {
      // Note: isMobile state removed as it was unused
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Define available metrics
  const availableMetrics: ActivityMetric[] = useMemo(() => {
    return [
      {
        id: "activeProfiles",
        name: "Active Profiles",
        color: chartColors[0] || "#8884d8",
        formatter: (v: number) => `${Math.round(v)}`,
      },
      {
        id: "feedbackEntries",
        name: "Feedback Entries",
        color: chartColors[1] || "#82ca9d",
        formatter: (v: number) => `${Math.round(v)}`,
      },
      {
        id: "activityEntries",
        name: "Activity Entries",
        color: chartColors[2] || "#ffc658",
        formatter: (v: number) => `${Math.round(v)}`,
      },
      {
        id: "errors",
        name: "Errors",
        color: chartColors[3] || "#ff7300",
        formatter: (v: number) => `${Math.round(v)}`,
      },
    ];
  }, [chartColors]);

  // Build metric mapping for GenericPicker
  const metricMapping = useMemo(() => {
    const mapping: Record<string, { name: string; description: string }> = {};
    availableMetrics.forEach((metric) => {
      mapping[metric.id] = {
        name: metric.name,
        description: metric.name,
      };
    });
    return mapping;
  }, [availableMetrics]);

  const validMetricIds = useMemo(() => {
    return availableMetrics.map((m) => m.id);
  }, [availableMetrics]);

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

  // Handle metric selection with validation (prevent deselecting all)
  const handleMetricsSelect = (ids: string[]) => {
    // If "Clear All" is clicked (empty array), reset to just the first metric
    if (ids.length === 0 && availableMetrics.length > 0) {
      setSelectedMetrics([availableMetrics[0]!.id]);
      return;
    }
    setSelectedMetrics(ids);
  };

  // Get selected metric objects
  const selectedMetricObjects = useMemo(() => {
    return availableMetrics.filter((metric) =>
      selectedMetrics.includes(metric.id),
    );
  }, [availableMetrics, selectedMetrics]);

  if (!hasDataAvailable) {
    return (
      <Card className="w-full h-full flex flex-col">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex flex-col items-start">
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Activity Metrics
              </CardTitle>
              <CardDescription className="text-sm line-clamp-2">
                Platform activity metrics over time
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
      <CardHeader className="flex-shrink-0">
        <div className="flex items-start justify-between">
          <div className="flex flex-col items-start">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" data-testid="trending-up-icon" />
              Activity Metrics
            </CardTitle>
            <CardDescription className="text-sm line-clamp-2">
              Platform activity metrics over time
            </CardDescription>
          </div>
          <GenericPicker
            items={metricMapping}
            itemIds={validMetricIds}
            selectedIds={selectedMetrics}
            onSelect={handleMetricsSelect}
            getId={(metric) => (metric as unknown as { id: string }).id}
            getLabel={(metric) => metric.name || ""}
            getSearchText={(metric) =>
              `${metric.name} ${metric.description || ""}`
            }
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
                <YAxis className="text-xs" />
                <Tooltip
                  content={(props) => {
                    if (!props) return null;
                    return (
                      <CustomLineTooltip
                        active={props.active}
                        payload={
                          (props.payload || []) as Array<{
                            dataKey?: string;
                            value?: number;
                            name?: string;
                            color?: string;
                          }>
                        }
                        label={props.label}
                        metricsWithFormatters={availableMetrics}
                      />
                    );
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
        </div>
      </CardContent>
    </Card>
  );
}

