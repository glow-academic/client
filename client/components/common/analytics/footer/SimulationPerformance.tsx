/**
 * SimulationPerformance.tsx
 * This component displays scenario performance within a selected simulation.
 * @AshokSaravanan222 & @siladiea
 * 07/23/2025
 */
"use client";

import {
  SimulationPicker,
  type Simulation,
} from "@/components/common/cohort/SimulationPicker";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAnalytics } from "@/contexts/analytics-context";
import { useSimulations } from "@/lib/api/hooks/simulations";
import { getAnalyticsDashboard } from "@/utils/api/analytics/get-dashboard";
import { BarChart3 } from "lucide-react";
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
  thresholds: {
    danger: number;
    warning: number;
    success: number;
  };
}

export default function SimulationPerformance({
  thresholds,
}: SimulationPerformanceProps) {
  const [selectedSimulation, setSelectedSimulation] =
    useState<Simulation | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const {
    startDate,
    endDate,
    selectedCohortIds,
    selectedRoles,
    simulationFilters,
  } = useAnalytics();
  const { data: simulations } = useSimulations();

  type ScenarioRow = {
    scenarioId: string;
    scenarioName: string;
    avgScore: number;
    successRate: number;
    performanceChange: number;
  };
  const [scenarioPerformanceData, setScenarioPerformanceData] = useState<
    ScenarioRow[]
  >([]);

  useEffect(() => {
    // Default selection to first available simulation
    if (
      !selectedSimulation &&
      Array.isArray(simulations) &&
      simulations.length > 0
    ) {
      setSelectedSimulation(simulations[0] as unknown as Simulation);
    }
  }, [simulations, selectedSimulation]);

  useEffect(() => {
    let aborted = false;
    async function run() {
      if (!selectedSimulation) {
        setScenarioPerformanceData([]);
        return;
      }
      try {
        const data = await getAnalyticsDashboard(
          {
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            cohortIds: selectedCohortIds,
            roles: selectedRoles,
            simulationFilters,
          },
          [
            {
              name: "calculateScenarioPerformanceWithinSimulation",
              args: { selectedSimulationId: selectedSimulation.id, thresholds },
            },
          ]
        );
        if (!aborted) {
          const payload =
            (data.results[
              "calculateScenarioPerformanceWithinSimulation"
            ] as ScenarioRow[]) ?? [];
          setScenarioPerformanceData(payload);
        }
      } catch {
        if (!aborted) setScenarioPerformanceData([]);
      }
    }
    run();
    return () => {
      aborted = true;
    };
  }, [
    startDate,
    endDate,
    selectedCohortIds,
    selectedRoles,
    simulationFilters,
    selectedSimulation,
    thresholds,
  ]);

  // Calculate insights
  const insights = useMemo(() => {
    if (!scenarioPerformanceData.length) {
      return "No scenario data available for analysis.";
    }

    const totalChange = scenarioPerformanceData.reduce(
      (sum, scenario) => sum + scenario.performanceChange,
      0
    );
    const avgChange = Math.round(totalChange / scenarioPerformanceData.length);

    // Generate insights
    const topPerformer = scenarioPerformanceData[0];
    const bottomPerformer =
      scenarioPerformanceData[scenarioPerformanceData.length - 1];
    const avgScore = Math.round(
      scenarioPerformanceData.reduce(
        (sum, scenario) => sum + scenario.avgScore,
        0
      ) / scenarioPerformanceData.length
    );

    let insightText = "";
    if (avgChange > 5) {
      insightText = `Scenarios show strong improvement (+${avgChange}%). ${topPerformer?.scenarioName || "Unknown"} leads with ${topPerformer?.avgScore || 0}% average score.`;
    } else if (avgChange < -5) {
      insightText = `Performance declined by ${Math.abs(avgChange)}%. Focus on ${bottomPerformer?.scenarioName || "Unknown"} (${bottomPerformer?.avgScore || 0}%) for improvement.`;
    } else {
      insightText = `Stable performance with ${avgScore}% average. ${topPerformer?.scenarioName || "Unknown"} excels at ${topPerformer?.avgScore || 0}%.`;
    }

    return insightText;
  }, [scenarioPerformanceData]);

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
            <SimulationPicker
              simulations={(simulations as unknown as Simulation[]) ?? []}
              placeholder="Select simulation..."
              onSelect={(s) => {
                setSelectedSimulation(s[0] ?? null);
              }}
              selectedSimulations={
                selectedSimulation ? [selectedSimulation] : []
              }
              singleSelect
              hideSelectedChips
              showLabel={false}
              buttonClassName="w-48 h-8 text-sm"
            />
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
