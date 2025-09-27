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
import { cn } from "@/lib/utils";
import type { FilteredData } from "@/utils/analytics/filtering";
import { calculateScenarioAttributeBreakdown } from "@/utils/analytics/footer";
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

export interface ScenarioPerformanceProps {
  filteredData: FilteredData | null;
  thresholds: {
    danger: number;
    warning: number;
    success: number;
  };
}

interface ParameterOption {
  id: string; // parameterId
  name: string;
  description: string;
}

export default function ScenarioPerformance({
  filteredData,
  thresholds,
}: ScenarioPerformanceProps) {
  const [selectedParameterId, setSelectedParameterId] = useState<string>("");
  const [pickerOpen, setPickerOpen] = useState(false);

  // Use centralized datasets from filteredData
  const parameters = filteredData?.parameters;
  const parameterItems = filteredData?.parameterItems;
  const rubrics = filteredData?.rubrics;

  // Get non-numerical parameters only
  const nonNumericalParameters = useMemo(() => {
    return parameters?.filter((p) => !p.numerical && p.active) || [];
  }, [parameters]);

  // Set default selected parameter if none selected and we have non-numerical parameters
  const selectedParameter = useMemo(() => {
    if (!selectedParameterId && nonNumericalParameters.length > 0) {
      const firstParameter = nonNumericalParameters[0];
      if (firstParameter) {
        setSelectedParameterId(firstParameter.id);
        return firstParameter;
      }
    }
    return nonNumericalParameters.find((p) => p.id === selectedParameterId);
  }, [selectedParameterId, nonNumericalParameters]);

  // Generate parameter options from non-numerical parameters
  const PARAMETER_OPTIONS: ParameterOption[] = useMemo(() => {
    return nonNumericalParameters.map((parameter) => ({
      id: parameter.id,
      name: parameter.name,
      description: `Performance by ${parameter.name.toLowerCase()} value`,
    }));
  }, [nonNumericalParameters]);

  // Calculate attribute breakdown using utility function
  const attributeElements = useMemo(() => {
    if (!filteredData || !parameterItems || !selectedParameter || !rubrics) {
      return [];
    }

    return calculateScenarioAttributeBreakdown(
      filteredData,
      rubrics,
      parameterItems,
      selectedParameter
    );
  }, [filteredData, parameterItems, selectedParameter, rubrics]);

  // Calculate threshold status based on attribute performance
  const getThresholdStatus = () => {
    if (attributeElements.length === 0) return "neutral";

    // Calculate average performance across all attributes
    const avgPerformance =
      attributeElements.reduce((sum, element) => sum + element.avgScore, 0) /
      attributeElements.length;

    if (avgPerformance >= thresholds.success) return "success";
    if (avgPerformance >= thresholds.warning) return "warning";
    return "danger";
  };

  const thresholdStatus = getThresholdStatus();

  const selectedParameterOption = PARAMETER_OPTIONS.find(
    (p) => p.id === selectedParameterId
  );

  return (
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
              Scenario Attribute Breakdown
            </CardTitle>
            <CardDescription>
              Performance analysis by scenario attributes
            </CardDescription>
          </div>

          {/* Parameter Picker */}
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
                      {selectedParameterOption?.name || "Select Parameter"}
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
                    {PARAMETER_OPTIONS.map((parameter) => (
                      <CommandItem
                        key={parameter.id}
                        value={parameter.id}
                        onSelect={() => {
                          setSelectedParameterId(parameter.id);
                          setPickerOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            selectedParameterId === parameter.id
                              ? "opacity-100"
                              : "opacity-0"
                          )}
                        />
                        <div>
                          <div className="font-medium">{parameter.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {parameter.description}
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
            {/* Pie Chart */}
            <div className="flex-1 min-h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={attributeElements}
                    dataKey="percentage"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={120}
                    innerRadius={60}
                    paddingAngle={2}
                  >
                    {attributeElements.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--background))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "6px",
                    }}
                    formatter={(
                      value: number,
                      name: string,
                      _props: unknown
                    ) => {
                      const element = attributeElements.find(
                        (e) => e.name === name
                      );
                      if (!element) return [value, name];

                      return [
                        <div key="tooltip" className="space-y-2">
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
                        {payload?.map((entry, index) => {
                          const element = attributeElements[index];
                          if (!element) return null;
                          return (
                            <Dialog key={entry.value}>
                              <DialogTrigger asChild>
                                <span className="text-xs cursor-pointer hover:text-primary transition-colors flex items-center gap-1 px-2 py-1 rounded border border-border hover:border-primary/50 hover:bg-muted/50 whitespace-nowrap">
                                  <span style={{ color: element.color }}>
                                    ●
                                  </span>
                                  {element.name}
                                </span>
                              </DialogTrigger>
                              <DialogContent className="max-w-2xl">
                                <DialogDescription hidden>
                                  This chart shows the scenario performance over
                                  time.
                                </DialogDescription>
                                <DialogHeader>
                                  <DialogTitle className="flex items-center gap-2">
                                    <span className="text-lg">
                                      {element.icon}
                                    </span>
                                    {element.displayName} Performance
                                  </DialogTitle>
                                  <DialogDescription>
                                    Detailed performance analysis for{" "}
                                    {element.displayName}{" "}
                                    {selectedParameter?.name.toLowerCase()}
                                  </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-6">
                                  {/* Performance Trend Chart */}
                                  {element.trendData.length > 0 && (
                                    <div className="h-64">
                                      <ResponsiveContainer
                                        width="100%"
                                        height="100%"
                                      >
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
                                              border:
                                                "1px solid hsl(var(--border))",
                                              borderRadius: "6px",
                                            }}
                                            formatter={(value: number) => [
                                              `${value}%`,
                                              "Score",
                                            ]}
                                          />
                                          <Line
                                            type="monotone"
                                            dataKey="score"
                                            stroke={element.color}
                                            strokeWidth={2}
                                            dot={{ r: 4 }}
                                            name="Score"
                                          />
                                        </LineChart>
                                      </ResponsiveContainer>
                                    </div>
                                  )}

                                  {/* Actionable Insights */}
                                  <div className="p-3 bg-muted rounded-lg">
                                    <p className="text-sm text-muted-foreground">
                                      {element.insight}
                                    </p>
                                  </div>
                                </div>
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
      </CardContent>
    </Card>
  );
}
