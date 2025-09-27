/**
 * CohortPerformance.tsx
 * This component displays the cohort performance for the personas.
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import type { FilteredData } from "@/utils/analytics/filtering";
import { getSimulationsWithValidData } from "@/utils/analytics/filtering";
import { calculateCohortPerformance } from "@/utils/analytics/secondary";
import { BarChart3, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface CohortPerformanceProps {
  filteredData: FilteredData | null;
  profileId: string | undefined;
  thresholds: {
    danger: number;
    warning: number;
    success: number;
  };
}

export default function CohortPerformance({
  filteredData,
  profileId,
  thresholds,
}: CohortPerformanceProps) {
  const [selectedSimulations, setSelectedSimulations] = useState<Simulation[]>(
    []
  );

  const rubrics = filteredData?.rubrics;

  const isSingleProfileMode = profileId !== undefined;

  // Use the utility function to calculate cohort performance
  const cohortPerformanceResult = useMemo(() => {
    if (!filteredData || !rubrics) {
      return null;
    }

    const result = calculateCohortPerformance(
      filteredData,
      rubrics,
      thresholds,
      selectedSimulations.map((s) => s.id)
    );

    return result;
  }, [filteredData, rubrics, thresholds, selectedSimulations]);

  // Calculate threshold status based on cohort performance data
  const getThresholdStatus = () => {
    if (!cohortPerformanceResult || !cohortPerformanceResult.hasData)
      return "neutral";

    // Calculate average pass rate across all cohorts
    const avgPassRate =
      cohortPerformanceResult.cohortData.reduce(
        (sum, cohort) => sum + cohort.passRate,
        0
      ) / cohortPerformanceResult.cohortData.length;

    if (avgPassRate >= thresholds.success) return "success";
    if (avgPassRate >= thresholds.warning) return "warning";
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
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-4 w-4" />
              Cohort Performance
            </CardTitle>
            <CardDescription className="text-xs">
              Pass rates by cohort
            </CardDescription>
          </div>
          <SimulationPicker
            simulations={
              filteredData && rubrics
                ? getSimulationsWithValidData(filteredData, rubrics).map(
                    (s) => ({
                      ...s,
                      timeLimit: s.timeLimit || undefined,
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
          />
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-3">
        <div className="space-y-4">
          {/* Cohort Details Dialog */}
          {cohortPerformanceResult?.cohortData.map((cohort) => {
            // Calculate pass rate percentage
            const passRatePercentage =
              cohort.totalStudents > 0
                ? (cohort.passedStudents /
                    (isSingleProfileMode ? 1 : cohort.totalStudents)) *
                  100
                : 0;

            // Determine background color based on pass rate
            let bgColor: string;
            if (passRatePercentage === 0) {
              bgColor = "#ef4444"; // Red for 0%
            } else if (passRatePercentage >= thresholds.success) {
              bgColor = "#22c55e"; // Green for success
            } else if (passRatePercentage >= thresholds.warning) {
              bgColor = "#eab308"; // Yellow for warning
            } else {
              bgColor = "#ef4444"; // Red for danger
            }

            return (
              <Dialog key={cohort.id}>
                <DialogTrigger asChild>
                  <div className="p-2 border rounded-md cursor-pointer hover:bg-muted transition-colors relative overflow-hidden">
                    {/* Progress bar background */}
                    <div
                      className="absolute inset-0 opacity-10"
                      style={{ backgroundColor: bgColor }}
                    />

                    {/* Progress bar fill */}
                    <div
                      className="absolute inset-y-0 left-0 opacity-20 transition-all duration-300"
                      style={{
                        backgroundColor: bgColor,
                        width: `${Math.max(passRatePercentage, 1)}%`, // Minimum 1% width for visibility
                      }}
                    />

                    <div className="flex items-center justify-between relative z-10">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm truncate">
                          {cohort.name}
                        </h4>
                        <p className="text-xs text-muted-foreground">
                          {isSingleProfileMode
                            ? `${passRatePercentage.toFixed(2)}% pass rate for `
                            : `${passRatePercentage.toFixed(2)}% of students pass `}
                          {cohort.rubricPoints > 0
                            ? cohort.availableSimulations
                            : 0}{" "}
                          quiz
                          {cohort.rubricPoints > 0
                            ? cohort.availableSimulations !== 1
                              ? "zes"
                              : ""
                            : "zes"}
                          {cohort.rubricPoints > 0 && (
                            <>
                              {" "}
                              with a{" "}
                              {Math.round(
                                (cohort.rubricPassPoints /
                                  cohort.rubricPoints) *
                                  100
                              )}
                              % or better
                            </>
                          )}
                        </p>
                      </div>
                      <TrendingUp className="h-3 w-3 text-muted-foreground ml-2 flex-shrink-0" />
                    </div>
                  </div>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>{cohort.name} Performance Details</DialogTitle>
                    <DialogDescription hidden>
                      Daily pass rate trends and insights
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-6">
                    {/* Daily Performance Line Chart */}
                    {cohortPerformanceResult?.dailyData.length > 0 && (
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={cohortPerformanceResult.dailyData}>
                            <CartesianGrid
                              strokeDasharray="3 3"
                              className="stroke-muted"
                            />
                            <XAxis dataKey="date" className="text-xs" />
                            <YAxis domain={[0, 100]} className="text-xs" />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: "hsl(var(--background))",
                                border: "1px solid hsl(var(--border))",
                                borderRadius: "6px",
                              }}
                              formatter={(value: number) => [
                                `${value}%`,
                                "Average Score",
                              ]}
                            />
                            <Line
                              type="monotone"
                              dataKey="avgScore"
                              stroke="#3b82f6"
                              strokeWidth={2}
                              dot={{ r: 4 }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    )}

                    {/* Actionable Insights */}
                    {cohortPerformanceResult?.insights && (
                      <div className="p-4 bg-muted rounded-lg">
                        <p className="text-sm text-muted-foreground">
                          {cohortPerformanceResult.insights}
                        </p>
                      </div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
