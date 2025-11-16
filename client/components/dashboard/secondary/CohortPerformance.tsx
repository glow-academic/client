"use client";

import { SimulationPicker } from "@/components/common/forms/SimulationPicker";
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
import { TruncatedInsight } from "../TruncatedInsight";
import { BarChart3 } from "lucide-react";
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

type CohortRow = {
  id: string;
  name: string;
  passRate: number;
  avgPercentageScore: number;
  totalStudents: number;
  passedStudents: number;
  totalAttempts: number;
  passedAttempts: number;
  simulationCount: number;
  requiredSimulations: number;
};
type DailyRow = {
  date: string;
  avgScore: number;
  cohortId?: string | undefined;
};
type CohortFact = {
  cohortId: string;
  simulationId: string;
  passRate: number;
  avgScore: number;
  attempts: number;
};
type DailyFact = { date: string; simulationId: string; avgScore: number };

export interface CohortPerformanceProps {
  cohortData: CohortRow[];
  dailyData: DailyRow[];
  cohortFacts: CohortFact[];
  dailyFacts: DailyFact[];
  /** Simulation mapping object */
  simulationMapping: Record<
    string,
    {
      name: string;
      description: string;
      department_ids?: string[] | null;
      time_limit?: number | null;
    }
  >;
  /** Valid simulation IDs */
  validSimulationIds: string[];
  /** If rendering for a single learner detail view */
  profileId?: string | undefined;
  actionableInsights?: Record<string, string | null>; // Key: cohort_id, Value: insight text
  thresholds: {
    danger: number;
    warning: number;
    success: number;
  };
}

export default function CohortPerformance({
  cohortData,
  dailyData,
  cohortFacts,
  dailyFacts: _dailyFacts,
  simulationMapping,
  validSimulationIds,
  profileId,
  actionableInsights,
  thresholds,
}: CohortPerformanceProps) {
  const [selected, setSelected] = useState<string[]>([]);
  const isSingleProfileMode = !!profileId;

  // Recompute cohort metrics from selected sims using cohortFacts (attempt-weighted)
  const displayCohorts = useMemo<CohortRow[]>(() => {
    if (!selected.length) return cohortData;
    const sel = new Set(selected);
    const byCohort = new Map<
      string,
      {
        name: string;
        totalStudents: number;
        passedStudents: number;
        simulationCount: number;
        requiredSimulations: number;
        wPass: number;
        wScore: number;
        w: number;
        totalAttempts: number;
        passedAttempts: number;
      }
    >();

    cohortData.forEach((c) =>
      byCohort.set(c.id, {
        name: c.name,
        totalStudents: c.totalStudents,
        passedStudents: c.passedStudents,
        simulationCount: c.simulationCount,
        requiredSimulations: c.requiredSimulations,
        wPass: 0,
        wScore: 0,
        w: 0,
        totalAttempts: 0,
        passedAttempts: c.passedAttempts, // not recomputed (per-student), keep original
      }),
    );

    cohortFacts.forEach((f) => {
      if (!sel.has(f.simulationId)) return;
      const acc = byCohort.get(f.cohortId);
      if (!acc) return;
      acc.wPass += f.passRate * f.attempts;
      acc.wScore += f.avgScore * f.attempts;
      acc.w += f.attempts;
      acc.totalAttempts += f.attempts;
    });

    return [...byCohort.entries()].map(([id, a]) => ({
      id,
      name: a.name,
      passRate: a.w ? Math.round(a.wPass / a.w) : 0,
      avgPercentageScore: a.w ? Math.round(a.wScore / a.w) : 0,
      totalStudents: a.totalStudents,
      passedStudents: a.passedStudents,
      totalAttempts: a.totalAttempts,
      passedAttempts: a.passedAttempts,
      simulationCount: a.simulationCount,
      requiredSimulations: a.requiredSimulations,
    }));
  }, [selected, cohortData, cohortFacts]);

  // Calculate threshold status based on cohort performance data
  const getThresholdStatus = () => {
    if (displayCohorts.length === 0) return "neutral";

    // Calculate average pass rate across all cohorts
    const avgPassRate =
      displayCohorts.reduce((sum, cohort) => sum + cohort.passRate, 0) /
      displayCohorts.length;

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
            simulationMapping={simulationMapping}
            validSimulationIds={validSimulationIds}
            selectedSimulationIds={selected}
            onSelect={setSelected}
            placeholder="Filter by simulation..."
            hideSelectedChips={true}
            showLabel={false}
          />
        </div>
      </CardHeader>
      <CardContent className="flex-1 p-3">
        {/* Scrollable list if > 5 cohorts */}
        <div className="h-full overflow-y-auto">
          <div
            className="grid gap-3 h-full"
            style={{
              // up to 5 equal-height rows; each row ~ 1/5 height
              gridTemplateRows: `repeat(${Math.min(displayCohorts.length || 1, 5)}, minmax(0, 1fr))`,
            }}
          >
            {displayCohorts.map((cohort) => {
              // Use the passRate from backend instead of recalculating
              const passRatePct = cohort.passRate;

              // Determine background color based on pass rate
              let bgColor: string;
              if (passRatePct === 0) {
                bgColor = "#ef4444"; // Red for 0%
              } else if (passRatePct >= 85) {
                bgColor = "#22c55e"; // Green for success
              } else if (passRatePct >= 75) {
                bgColor = "#eab308"; // Yellow for warning
              } else {
                bgColor = "#ef4444"; // Red for danger
              }

              return (
                <Dialog key={cohort.id}>
                  <DialogTrigger asChild>
                    {/* Each item fills its grid row height */}
                    <div className="h-full p-2 border rounded-md cursor-pointer hover:bg-muted transition-colors relative overflow-hidden">
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
                          width: `${Math.max(passRatePct, 1)}%`, // Minimum 1% width for visibility
                        }}
                      />

                      <div className="flex items-center justify-between relative z-10 h-full">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-sm truncate">
                            {cohort.name}
                          </h4>
                          <p className="text-xs text-muted-foreground">
                            {isSingleProfileMode
                              ? `${passRatePct.toFixed(2)}% pass rate for `
                              : `${passRatePct.toFixed(2)}% of students pass `}
                            {cohort.simulationCount > 0
                              ? cohort.simulationCount
                              : 0}{" "}
                            quiz
                            {cohort.simulationCount > 0
                              ? cohort.simulationCount !== 1
                                ? "zes"
                                : ""
                              : "zes"}
                            {cohort.simulationCount > 0 && (
                              <> with a 80 % or better</>
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  </DialogTrigger>

                  {/* Modal contents */}
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>
                        {cohort.name} performance details
                      </DialogTitle>
                      <DialogDescription hidden>
                        Daily pass rate trends and insights
                      </DialogDescription>
                    </DialogHeader>

                    {/* Daily trend chart inside the modal */}
                    {(() => {
                      // Filter daily data for this specific cohort
                      const cohortDailyData = dailyData.filter(
                        (d: DailyRow) => d.cohortId === cohort.id,
                      );
                      if (cohortDailyData.length === 0) return null;

                      return (
                        <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={cohortDailyData}>
                              <CartesianGrid
                                strokeDasharray="3 3"
                                className="stroke-muted"
                              />
                              <XAxis dataKey="date" className="text-xs" />
                              <YAxis domain={[0, 100]} className="text-xs" />
                              <Tooltip
                                contentStyle={{
                                  backgroundColor: "white",
                                  border: "1px solid #e5e7eb",
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
                                strokeWidth={2}
                                dot={{ r: 4 }}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      );
                    })()}

                    {/* Actionable insight inside the modal */}
                    {actionableInsights && actionableInsights[cohort.id] && (
                      <TruncatedInsight text={actionableInsights[cohort.id]} />
                    )}
                  </DialogContent>
                </Dialog>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
