"use client";

import { SimulationPicker } from "@/components/common/cohort/SimulationPicker";
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

type AttemptRow = {
  attempt: string;
  "Average Score": number;
  "Average Time": number;
  "Pass Rate": number;
};
type AttemptFact = {
  simulationId: string;
  attemptNo: number;
  avgGrade: number;
  avgMinutes: number;
  passRate: number;
};

export interface AttemptImprovementProps {
  chartData: AttemptRow[];
  facts: AttemptFact[];
  /** Simulation mapping object */
  simulationMapping: Record<string, { name: string; description: string }>;
  /** Valid simulation IDs */
  validSimulationIds: string[];
  isLoading: boolean;
  isError: boolean;
  actionableInsight?: string | null;
  thresholds: {
    danger: number;
    warning: number;
    success: number;
  };
}

export default function AttemptImprovement({
  chartData,
  facts,
  simulationMapping,
  validSimulationIds,
  isLoading,
  isError,
  actionableInsight,
  thresholds,
}: AttemptImprovementProps) {
  const [selected, setSelected] = useState<string[]>([]);

  // If sims selected, recompute chart from facts; else use server aggregate
  const displayData = useMemo<AttemptRow[]>(() => {
    if (!selected.length) return chartData;

    const sel = new Set(selected);
    const byAttempt = new Map<
      number,
      { gradeSum: number; minSum: number; passSum: number; n: number }
    >();

    facts.forEach((f) => {
      if (!sel.has(f.simulationId) || f.attemptNo > 5) return; // Limit to 5 attempts
      const acc = byAttempt.get(f.attemptNo) ?? {
        gradeSum: 0,
        minSum: 0,
        passSum: 0,
        n: 0,
      };
      acc.gradeSum += f.avgGrade;
      acc.minSum += f.avgMinutes;
      acc.passSum += f.passRate;
      acc.n += 1;
      byAttempt.set(f.attemptNo, acc);
    });

    return [...byAttempt.entries()]
      .sort(([a], [b]) => a - b)
      .map(([attemptNo, acc]) => ({
        attempt: `Attempt ${attemptNo}`,
        "Average Score": Math.round(acc.gradeSum / Math.max(1, acc.n)),
        "Average Time": Math.round(acc.minSum / Math.max(1, acc.n)),
        "Pass Rate": Math.round(acc.passSum / Math.max(1, acc.n)),
      }));
  }, [selected, chartData, facts]);

  // Calculate threshold status based on improvement data
  const getThresholdStatus = () => {
    if (displayData.length < 2) return "neutral";

    const firstAttempt = displayData[0];
    const lastAttempt = displayData[displayData.length - 1];

    if (!firstAttempt || !lastAttempt) return "neutral";

    const firstScore = firstAttempt["Average Score"];
    const lastScore = lastAttempt["Average Score"];

    if (typeof firstScore !== "number" || typeof lastScore !== "number")
      return "neutral";

    const scoreImprovement = lastScore - firstScore;

    if (scoreImprovement >= thresholds.success) return "success";
    if (scoreImprovement >= thresholds.warning) return "warning";
    return "danger";
  };

  const thresholdStatus = getThresholdStatus();

  if (isLoading) {
    return (
      <Card className="w-full h-full flex flex-col">
        <CardHeader>
          <CardTitle>Attempt Improvement</CardTitle>
          <CardDescription>Loading attempt data...</CardDescription>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center text-muted-foreground">
          Loading...
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className="w-full h-full flex flex-col">
        <CardHeader>
          <CardTitle>Attempt Improvement</CardTitle>
          <CardDescription>Error loading data</CardDescription>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center text-destructive">
          Failed to load attempt data
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
            simulationMapping={simulationMapping}
            validSimulationIds={validSimulationIds}
            selectedSimulationIds={selected}
            onSelect={setSelected}
            placeholder="Filter by simulation..."
            hideSelectedChips
            showLabel={false}
            buttonClassName="w-48"
          />
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden">
        <div className="space-y-3 h-full flex flex-col">
          {/* Composed Chart with Secondary Y-Axis for Time */}
          <div className="flex-1 w-full min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={displayData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
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
                  labelStyle={{
                    color: "white",
                  }}
                  itemStyle={{
                    color: "white",
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

          {/* Actionable Insights */}
          {actionableInsight && (
            <div className="p-4 bg-muted rounded-lg">
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
