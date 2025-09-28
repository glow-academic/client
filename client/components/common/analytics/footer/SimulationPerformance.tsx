/**
 * SimulationPerformance.tsx
 * This component displays scenario performance within a selected simulation.
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
import { AnalyticsFilters } from "@/lib/analytics";
import { useAnalyticsSimulationPerformance } from "@/lib/api/hooks/analytics";
import { cn } from "@/lib/utils";
import { buildSimulationScenarioBars } from "@/utils/client-aggregators";
import { BarChart3, Check, ChevronsUpDown } from "lucide-react";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface SimulationPerformanceProps {
  filters: AnalyticsFilters;
  thresholds: {
    danger: number;
    warning: number;
    success: number;
  };
}

export default function SimulationPerformance({
  filters,
  thresholds,
}: SimulationPerformanceProps) {
  const [selectedSimulationId, setSelectedSimulationId] = useState<
    string | null
  >(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Fetch analytics data using the new hook
  const {
    data: analyticsData,
    isLoading,
    error,
  } = useAnalyticsSimulationPerformance(filters);

  // Get simulations with valid data for this component
  const validSimulations = useMemo(() => {
    if (!analyticsData) return [];
    return analyticsData.validSimulations || [];
  }, [analyticsData]);

  // Auto-select simulation if enabled and available
  useMemo(() => {
    if (validSimulations.length > 0) {
      // If no simulation is selected, select the first one
      if (!selectedSimulationId) {
        const firstSimulation = validSimulations[0];
        if (firstSimulation) {
          setSelectedSimulationId(firstSimulation.id);
        }
      } else {
        // If selected simulation is no longer available, select the first available one
        const isStillAvailable = validSimulations.some(
          (sim) => sim.id === selectedSimulationId
        );
        if (!isStillAvailable) {
          const firstSimulation = validSimulations[0];
          if (firstSimulation) {
            setSelectedSimulationId(firstSimulation.id);
          }
        }
      }
    }
  }, [validSimulations, selectedSimulationId]);

  // Calculate scenario performance data for selected simulation using client aggregator
  const scenarioPerformanceData = useMemo(() => {
    if (!selectedSimulationId || !analyticsData) {
      return [];
    }

    const result = buildSimulationScenarioBars(
      analyticsData.scenarioFacts,
      selectedSimulationId,
      thresholds
    );
    return result.rows;
  }, [selectedSimulationId, analyticsData, thresholds]);

  // Calculate insights
  const insights = useMemo(() => {
    if (!scenarioPerformanceData.length) {
      return "No scenario data available for analysis.";
    }

    // Use insights from the client aggregator if available
    if (analyticsData && selectedSimulationId) {
      const result = buildSimulationScenarioBars(
        analyticsData.scenarioFacts,
        selectedSimulationId,
        thresholds
      );
      return result.insights;
    }

    // Fallback insight generation
    const topPerformer = scenarioPerformanceData[0];
    const avgScore = Math.round(
      scenarioPerformanceData.reduce(
        (sum, scenario) => sum + scenario.avgScore,
        0
      ) / scenarioPerformanceData.length
    );

    return `Stable performance with ${avgScore}% average. ${topPerformer?.scenarioName || "Unknown"} excels at ${topPerformer?.avgScore || 0}%.`;
  }, [
    scenarioPerformanceData,
    analyticsData,
    selectedSimulationId,
    thresholds,
  ]);

  // Calculate threshold status based on scenario performance
  const getThresholdStatus = () => {
    if (!scenarioPerformanceData.length) return "neutral";

    // Calculate average performance across all scenarios
    const avgPerformance =
      scenarioPerformanceData.reduce(
        (sum, scenario) => sum + scenario.avgScore,
        0
      ) / scenarioPerformanceData.length;

    // Consider both average score and success rate
    const avgSuccessRate =
      scenarioPerformanceData.reduce(
        (sum, scenario) => sum + scenario.successRate,
        0
      ) / scenarioPerformanceData.length;

    const combinedScore = avgPerformance * 0.7 + avgSuccessRate * 0.3;

    if (combinedScore >= thresholds.success) return "success";
    if (combinedScore >= thresholds.warning) return "warning";
    return "danger";
  };

  const thresholdStatus = getThresholdStatus();

  // Show loading state
  if (isLoading) {
    return (
      <Card className="w-full h-full flex flex-col">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Simulation Performance
          </CardTitle>
          <CardDescription className="text-sm">
            Performance trends for scenarios within simulations
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            Loading simulation performance data...
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show error state
  if (error) {
    return (
      <Card className="w-full h-full flex flex-col">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Simulation Performance
          </CardTitle>
          <CardDescription className="text-sm">
            Performance trends for scenarios within simulations
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center">
          <div className="text-center text-red-500">
            Error loading simulation performance data
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
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Simulation Performance
            </CardTitle>
            <CardDescription className="text-sm">
              Performance trends for scenarios within simulations
            </CardDescription>
          </div>

          {/* Simulation Picker */}
          <div className="flex items-center gap-2">
            <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={pickerOpen}
                  className="w-48 justify-between text-sm h-8"
                >
                  <span className="truncate text-left">
                    {selectedSimulationId
                      ? validSimulations.find(
                          (s) => s.id === selectedSimulationId
                        )?.title
                      : "Select simulation..."}
                  </span>
                  <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-0">
                <Command>
                  <CommandInput placeholder="Search simulations..." />
                  <CommandEmpty>No simulation found.</CommandEmpty>
                  <CommandGroup>
                    {validSimulations.map((simulation) => (
                      <CommandItem
                        key={simulation.id}
                        value={simulation.id}
                        onSelect={() => {
                          setSelectedSimulationId(simulation.id);
                          setPickerOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4 shrink-0",
                            selectedSimulationId === simulation.id
                              ? "opacity-100"
                              : "opacity-0"
                          )}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">
                            {simulation.title}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {simulation.scenarioIds?.length || 0} scenarios
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

      <CardContent className="space-y-4 flex-1 flex flex-col">
        {/* Bar Chart */}
        <div className="flex-1 min-h-[180px] h-[180px] mb-2">
          <div
            style={
              process.env.NODE_ENV === "test"
                ? { minWidth: 400, minHeight: 300 }
                : { width: "100%", height: "100%" }
            }
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={scenarioPerformanceData}
                margin={{ top: 10, right: 10, bottom: 30, left: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="scenarioName"
                  fontSize={10}
                  height={40}
                  angle={-45}
                  textAnchor="end"
                  tickFormatter={(name: string) =>
                    name.length > 12 ? name.slice(0, 11) + "…" : name
                  }
                />
                <YAxis domain={[0, 100]} fontSize={10} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--background))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "6px",
                    color: "#000000",
                  }}
                  labelStyle={{
                    color: "#000000",
                  }}
                  formatter={(value: number, name: string) => [
                    `${value}%`,
                    name === "avgScore" ? "Average Score" : "Success Rate",
                  ]}
                />
                <Bar
                  dataKey="avgScore"
                  fill="#3b82f6"
                  name="Average Score"
                  radius={[2, 2, 0, 0]}
                />
                <Bar
                  dataKey="successRate"
                  fill="#10b981"
                  name="Success Rate"
                  radius={[2, 2, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-4 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded bg-blue-500"></div>
            <span>Average Score</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded bg-green-500"></div>
            <span>Success Rate</span>
          </div>
        </div>

        {/* Data-Driven Insights */}
        <div className="p-3 bg-muted rounded-lg">
          <p className="text-sm text-muted-foreground leading-relaxed">
            {insights}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
