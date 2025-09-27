/**
 * AttemptImprovement.tsx
 * This component displays the attempt improvement for the personas.
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

import type { FilteredData } from "@/utils/analytics/filtering";
import { getSimulationsWithValidAttemptData } from "@/utils/analytics/filtering";
import { calculateAttemptImprovement } from "@/utils/analytics/primary";

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

export interface AttemptImprovementProps {
  filteredData: FilteredData | null;
  thresholds: {
    danger: number;
    warning: number;
    success: number;
  };
}

export default function AttemptImprovement({
  filteredData,
  thresholds,
}: AttemptImprovementProps) {
  const [selectedSimulations, setSelectedSimulations] = useState<Simulation[]>(
    []
  );

  const rubrics = filteredData?.rubrics;

  // Calculate attempt improvement data
  const improvementData = useMemo(() => {
    if (!filteredData || !rubrics) {
      return [];
    }

    return calculateAttemptImprovement(
      filteredData,
      rubrics,
      selectedSimulations.map((s) => s.id)
    );
  }, [filteredData, rubrics, selectedSimulations]);

  // Get actionable insights
  const getActionableInsights = () => {
    if (improvementData.length < 2) return null;

    // Get first and last attempts to check improvement
    const firstAttempt = improvementData[0];
    const lastAttempt = improvementData[improvementData.length - 1];

    if (!firstAttempt || !lastAttempt) return null;

    const firstScore = firstAttempt["Average Score"];
    const lastScore = lastAttempt["Average Score"];

    if (typeof firstScore !== "number" || typeof lastScore !== "number")
      return null;

    const scoreImprovement = lastScore - firstScore;

    if (scoreImprovement > 5) {
      return `Users improve by ${scoreImprovement}% on average between attempts. Consider advancing to more challenging scenarios.`;
    } else if (scoreImprovement < -5) {
      return `Performance declined by ${Math.abs(scoreImprovement)}% between attempts. Review training approach.`;
    }

    return null;
  };

  // Calculate threshold status based on improvement data
  const getThresholdStatus = () => {
    if (improvementData.length < 2) return "neutral";

    const firstAttempt = improvementData[0];
    const lastAttempt = improvementData[improvementData.length - 1];

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
            simulations={
              filteredData && rubrics
                ? getSimulationsWithValidAttemptData(filteredData, rubrics).map(
                    (s) => ({
                      ...s,
                      timeLimit: s.timeLimit ?? 0,
                    })
                  )
                : []
            }
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
        <div className="space-y-3 h-full flex flex-col">
          {/* Composed Chart with Secondary Y-Axis for Time */}
          <div className="flex-1 w-full min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={improvementData}>
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
          {getActionableInsights() && (
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">
                {getActionableInsights()}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
