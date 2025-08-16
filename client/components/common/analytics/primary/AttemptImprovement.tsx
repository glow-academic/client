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
import { calculateAttemptImprovement } from "@/utils/analytics/primary";
import { getAllRubrics } from "@/utils/queries/rubrics/get-all-rubrics";
import { useQuery } from "@tanstack/react-query";

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

  // Fetch rubrics (still needed for calculations)
  const { data: rubrics } = useQuery({
    queryKey: ["rubrics"],
    queryFn: () => getAllRubrics(),
  });

  // Get simulations that have data available
  const simulationsWithData = useMemo(() => {
    if (
      !filteredData?.simulations ||
      !filteredData?.grades ||
      !filteredData?.chats ||
      !filteredData?.attempts
    )
      return [];

    // Get all simulation IDs that have grades (data is already filtered by date)
    const simulationIdsWithData = new Set<string>();

    filteredData.grades.forEach((grade) => {
      const chat = filteredData.chats.find(
        (c) => c.id === grade.simulationChatId
      );
      const attempt = filteredData.attempts.find(
        (a) => a.id === chat?.attemptId
      );

      if (attempt) {
        simulationIdsWithData.add(attempt.simulationId);
      }
    });

    return filteredData.simulations.filter((s) =>
      simulationIdsWithData.has(s.id)
    );
  }, [
    filteredData?.simulations,
    filteredData?.grades,
    filteredData?.chats,
    filteredData?.attempts,
  ]);

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

  if (!improvementData.length) {
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
            {simulationsWithData && simulationsWithData.length > 0 && (
              <SimulationPicker
                simulations={simulationsWithData.map((s) => ({
                  id: s.id,
                  title: s.title,
                  timeLimit: s.timeLimit || undefined,
                  active: s.active,
                  defaultSimulation: s.defaultSimulation,
                  practiceSimulation: s.practiceSimulation,
                }))}
                placeholder="Filter by simulation..."
                onSelect={setSelectedSimulations}
                selectedSimulations={selectedSimulations}
                hideSelectedChips={true}
                showLabel={false}
                buttonClassName="w-48"
              />
            )}
          </div>
        </CardHeader>
        <CardContent className="flex items-center justify-center flex-1">
          <p className="text-muted-foreground">
            No improvement data available. Multiple attempts required.
          </p>
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
          {simulationsWithData && simulationsWithData.length > 0 && (
            <SimulationPicker
              simulations={simulationsWithData.map((s) => ({
                id: s.id,
                title: s.title,
                timeLimit: s.timeLimit || undefined,
                active: s.active,
                defaultSimulation: s.defaultSimulation,
                practiceSimulation: s.practiceSimulation,
              }))}
              placeholder="Filter by simulation..."
              onSelect={setSelectedSimulations}
              selectedSimulations={selectedSimulations}
              hideSelectedChips={true}
              showLabel={false}
              buttonClassName="w-48"
            />
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden">
        <div className="space-y-3">
          {/* Composed Chart with Secondary Y-Axis for Time */}
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={improvementData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="attempt" className="text-xs" />
                <YAxis
                  className="text-xs"
                  label={{
                    value: "Score & Pass Rate (%)",
                    angle: -90,
                  }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  className="text-xs"
                  label={{
                    value: "Time (minutes)",
                    angle: 90,
                  }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--background))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "6px",
                    color: "black",
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
