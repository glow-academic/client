/**
 * AttemptImprovement.tsx
 * Server-typed version using useAnalyticsAttemptImprovement + Zod schemas
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

import { TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// ✅ typed analytics
import {
  type AnalyticsFilters,
  type AttemptImprovementData,
  type AttemptImprovementResponse,
} from "@/lib/analytics";
import { useAnalyticsAttemptImprovement } from "@/lib/api/hooks/analytics";
import { useSimulations } from "@/lib/api/hooks/simulations";
import { buildAttemptImprovementChart } from "@/utils/client-aggregators";

export interface AttemptImprovementProps {
  filters: AnalyticsFilters;
  thresholds: {
    danger: number;
    warning: number;
    success: number;
  };
}

export default function AttemptImprovement({
  filters,
  thresholds,
}: AttemptImprovementProps) {
  const [selectedSimulations, setSelectedSimulations] = useState<Simulation[]>(
    []
  );

  // Build base filters without simulationIds for the API call
  const baseFilters: AnalyticsFilters = useMemo(() => {
    return { ...filters };
  }, [filters]);

  // Call the server hook (Zod-validated) - no simulationIds in the query
  const { data, isLoading, isError, error } = useAnalyticsAttemptImprovement(
    baseFilters,
    true // enable
  );

  // Get all simulations for the picker
  const { data: simulations } = useSimulations();

  // Use client-side aggregation with facts
  const improvementData: AttemptImprovementData[] = useMemo(() => {
    if (!data?.facts) return data?.chartData ?? [];

    const selectedSimulationIds =
      selectedSimulations.length > 0
        ? selectedSimulations.map((s) => s.id)
        : undefined;

    return buildAttemptImprovementChart(data.facts, selectedSimulationIds);
  }, [data?.facts, data?.chartData, selectedSimulations]);

  // Filter simulations to only include those with attempt data from the server
  const pickerSimulations: Simulation[] = useMemo(() => {
    if (!simulations || !data) return [];

    // Get the IDs of simulations that have attempt data
    const availableSimulationIds = new Set(
      (data as AttemptImprovementResponse).availableSimulations?.map(
        (s) => s.id
      ) ?? []
    );

    // Filter the full simulations list to only include those with data
    return simulations
      .filter((s) => availableSimulationIds.has(s.id))
      .map((s) => ({
        id: s.id,
        title: s.title,
        timeLimit: s.timeLimit ?? 0,
        active: s.active,
        description: s.description,
        defaultSimulation: s.defaultSimulation,
        practiceSimulation: s.practiceSimulation,
        scenarioIds: s.scenarioIds,
        updatedAt: s.updatedAt,
      }));
  }, [simulations, data]);

  // Insights (unchanged)
  const getActionableInsights = () => {
    if (improvementData.length < 2) return null;
    const first = improvementData[0];
    const last = improvementData[improvementData.length - 1];
    const a = first?.["Average Score"];
    const b = last?.["Average Score"];
    if (typeof a !== "number" || typeof b !== "number") return null;
    const delta = b - a;
    if (delta > 5) {
      return `Users improve by ${delta}% on average between attempts. Consider advancing to more challenging scenarios.`;
    } else if (delta < -5) {
      return `Performance declined by ${Math.abs(delta)}% between attempts. Review training approach.`;
    }
    return null;
  };

  const getThresholdStatus = () => {
    if (improvementData.length < 2) return "neutral" as const;
    const first = improvementData[0];
    const last = improvementData[improvementData.length - 1];
    const a = first?.["Average Score"];
    const b = last?.["Average Score"];
    if (typeof a !== "number" || typeof b !== "number") return "neutral";
    const delta = b - a;
    if (delta >= thresholds.success) return "success";
    if (delta >= thresholds.warning) return "warning";
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
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Attempt Improvement
            </CardTitle>
            <CardDescription>
              Performance improvement across multiple attempts
            </CardDescription>
          </div>
          <SimulationPicker
            simulations={pickerSimulations}
            placeholder="Filter by simulation..."
            onSelect={setSelectedSimulations}
            selectedSimulations={selectedSimulations}
            hideSelectedChips={true}
            showLabel={false}
            showPracticeSimulations={true}
            buttonClassName="w-48"
          />
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden">
        {isLoading && (
          <div className="h-full grid place-items-center text-sm text-muted-foreground">
            Loading attempt improvement…
          </div>
        )}
        {isError && (
          <div className="h-full grid place-items-center text-sm text-red-500">
            Failed to load. {error instanceof Error ? error.message : "Error"}
          </div>
        )}
        {!isLoading && !isError && improvementData.length === 0 && (
          <div className="h-full grid place-items-center text-sm text-muted-foreground">
            No attempt data for the selected filters.
          </div>
        )}

        {!isLoading && !isError && improvementData.length > 0 && (
          <div className="space-y-3 h-full flex flex-col">
            <div className="flex-1 w-full min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={improvementData}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-muted"
                  />
                  <XAxis dataKey="attempt" className="text-xs" />
                  <YAxis
                    className="text-xs"
                    dx={0}
                    label={{
                      value: "Score & Pass Rate (%)",
                      angle: -90,
                      dx: -10,
                    }}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    className="text-xs"
                    dx={0}
                    label={{
                      value: "Time (minutes)",
                      angle: 90,
                      dx: 10,
                    }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "black",
                      border: "1px solid black",
                      color: "white",
                      borderRadius: "6px",
                    }}
                    formatter={(value: number, name: string) => [
                      name === "Average Time" ? `${value} min` : `${value}%`,
                      name,
                    ]}
                  />
                  <Legend />
                  <Bar
                    dataKey="Average Score"
                    fill="hsl(120, 70%, 50%)"
                    name="Average Score"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="Pass Rate"
                    fill="hsl(280, 70%, 50%)"
                    name="Pass Rate"
                    radius={[4, 4, 0, 0]}
                  />
                  <Line
                    type="monotone"
                    dataKey="Average Time"
                    stroke="hsl(200, 70%, 50%)"
                    strokeWidth={2}
                    dot={{ fill: "hsl(200, 70%, 50%)", strokeWidth: 2, r: 4 }}
                    yAxisId="right"
                    name="Average Time"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {(() => {
              const insight = getActionableInsights();
              return insight ? (
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">{insight}</p>
                </div>
              ) : null;
            })()}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
