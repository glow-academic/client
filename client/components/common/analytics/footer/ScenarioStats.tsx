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
import type { FilteredData } from "@/utils/analytics/filtering";
import { calculateScenarioPerformance } from "@/utils/analytics/footer";
import { BarChart3, Check, ChevronsUpDown, Info } from "lucide-react";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";

export interface ScenarioStatsProps {
  filteredData: FilteredData | null;
  thresholds: {
    danger: number;
    warning: number;
    success: number;
  };
}

interface MetricOption {
  id: string; // parameterId
  name: string;
  description: string;
}

export default function ScenarioStats({
  filteredData,
  thresholds,
}: ScenarioStatsProps) {
  const [selectedParameterId, setSelectedParameterId] = useState<string>("");
  const [pickerOpen, setPickerOpen] = useState(false);

  // Use centralized datasets from filteredData
  const parameters = filteredData?.parameters;
  const parameterItems = filteredData?.parameterItems;
  const rubrics = filteredData?.rubrics;

  // Get numerical parameters only
  const numericalParameters = useMemo(() => {
    return parameters?.filter((p) => p.numerical && p.active) || [];
  }, [parameters]);

  // Set default selected parameter if none selected and we have numerical parameters
  const selectedParameter = useMemo(() => {
    if (!selectedParameterId && numericalParameters.length > 0) {
      const firstParameter = numericalParameters[0];
      if (firstParameter) {
        setSelectedParameterId(firstParameter.id);
        return firstParameter;
      }
    }
    return numericalParameters.find((p) => p.id === selectedParameterId);
  }, [selectedParameterId, numericalParameters]);

  // Generate metric options from numerical parameters
  const METRIC_OPTIONS: MetricOption[] = useMemo(() => {
    return numericalParameters.map((parameter) => ({
      id: parameter.id,
      name: parameter.name,
      description: `Performance by ${parameter.name.toLowerCase()} value`,
    }));
  }, [numericalParameters]);

  // Calculate performance data using utility function
  const { performanceData: aggregatedPerformanceData, correlationData } =
    useMemo(() => {
      if (!filteredData || !parameterItems || !selectedParameter || !rubrics) {
        return {
          performanceData: [],
          correlationData: { correlation: 0, pValue: 1 },
        };
      }

      return calculateScenarioPerformance(
        filteredData,
        rubrics,
        parameterItems,
        selectedParameter
      );
    }, [filteredData, parameterItems, selectedParameter, rubrics]);

  const { correlation, pValue } = correlationData;

  const selectedMetricOption = METRIC_OPTIONS.find(
    (m) => m.id === selectedParameterId
  );

  // Generate insight text
  const getInsightText = () => {
    const metricName = selectedMetricOption?.name.toLowerCase() || "metric";
    if (correlation > 0.3) {
      return `Higher ${metricName} tends to correlate with better performance.`;
    } else if (correlation < -0.3) {
      return `Higher ${metricName} tends to correlate with worse performance.`;
    } else {
      return `No clear relationship between ${metricName} and performance.`;
    }
  };

  // Calculate threshold status based on correlation and performance
  const getThresholdStatus = () => {
    if (aggregatedPerformanceData.length === 0) return "neutral";

    // Calculate average performance across all metric levels
    const avgPerformance =
      aggregatedPerformanceData.reduce((sum, item) => sum + item.avgScore, 0) /
      aggregatedPerformanceData.length;

    // Consider both average performance and correlation strength
    const performanceThreshold = avgPerformance >= thresholds.success;
    const correlationThreshold = Math.abs(correlation) >= 0.3;

    if (performanceThreshold && correlationThreshold) return "success";
    if (avgPerformance >= thresholds.warning || Math.abs(correlation) >= 0.2)
      return "warning";
    return "danger";
  };

  const thresholdStatus = getThresholdStatus();

  // Show message if no numerical parameters available
  if (numericalParameters.length === 0) {
    return (
      <Card className="w-full h-full flex flex-col">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Scenario Performance Analysis
          </CardTitle>
          <CardDescription>
            Performance correlation with scenario characteristics
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center flex-1">
          <p className="text-muted-foreground">
            No numerical parameters available for analysis.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!aggregatedPerformanceData.length) {
    return (
      <Card className="w-full h-full flex flex-col">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Scenario Performance Analysis
          </CardTitle>
          <CardDescription>
            Performance correlation with scenario characteristics
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center flex-1">
          <p className="text-muted-foreground">
            No scenario data available for the selected time period.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <TooltipProvider>
      <Card className="w-full h-full flex flex-col relative">
        <div
          data-testid="status-indicator"
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

            {/* Metric Picker */}
            <div className="flex items-center gap-2">
              <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={pickerOpen}
                    className="w-48 justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <span>
                        {selectedMetricOption?.name || "Select Parameter"}
                      </span>
                    </div>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-48 p-0">
                  <Command>
                    <CommandInput placeholder="Search parameters..." />
                    <CommandEmpty>No parameter found.</CommandEmpty>
                    <CommandGroup>
                      {METRIC_OPTIONS.map((metric) => (
                        <CommandItem
                          key={metric.id}
                          value={metric.id}
                          onSelect={() => {
                            setSelectedParameterId(metric.id);
                            setPickerOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedParameterId === metric.id
                                ? "opacity-100"
                                : "opacity-0"
                            )}
                          />
                          <div>
                            <div className="font-medium">{metric.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {metric.description}
                            </div>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6 flex-1 flex flex-col">
          {/* Bar Chart */}
          <div className="flex-1 min-h-[300px] h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={aggregatedPerformanceData}
                margin={{ top: 20, right: 20, bottom: 40, left: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="metricLevel"
                  name={selectedMetricOption?.name || "Parameter Level"}
                  fontSize={12}
                  tickFormatter={(value) => value.toString()}
                />
                <YAxis
                  fontSize={12}
                  domain={[0, 100]}
                  tickFormatter={(value) => `${value}%`}
                />
                <RechartsTooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--background))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "6px",
                  }}
                  formatter={(value: number, _name: string) => [
                    `${value}%`,
                    "Average Score",
                  ]}
                  labelFormatter={(label) => {
                    const dataPoint = aggregatedPerformanceData.find(
                      (item) => item.metricLevel === label
                    );
                    const metricName =
                      selectedMetricOption?.name || "Parameter";
                    return `${metricName} Level ${label} (${dataPoint?.scenarioCount || 0} scenarios)`;
                  }}
                />
                <Bar
                  dataKey="avgScore"
                  fill="#3b82f6"
                  name="Average Score"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* X-axis Label and Correlation */}
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground font-medium">
              {selectedMetricOption?.name || "Parameter Level"}
            </div>

            {/* Correlation Component */}
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
                <p className="text-sm">{getInsightText()}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Pearson correlation coefficient with p-value significance test
                </p>
              </TooltipContent>
            </Tooltip>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
