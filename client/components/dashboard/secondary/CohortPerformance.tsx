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
import { useStatusColor } from "@/lib/utils/chartColors";
import { BarChart3 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { TruncatedInsight } from "../TruncatedInsight";

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
  status?: "success" | "warning" | "danger" | "neutral";
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
  status: "success" | "warning" | "danger" | "neutral";
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
  status,
}: CohortPerformanceProps) {
  const [selected, setSelected] = useState<string[]>([]);
  const isSingleProfileMode = !!profileId;
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024); // lg breakpoint
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

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

  // Use status from server
  const thresholdStatus = status;

  // Get status colors for all status types
  const successColor = useStatusColor("success");
  const warningColor = useStatusColor("warning");
  const dangerColor = useStatusColor("danger");
  const neutralColor = useStatusColor("neutral");

  // Helper function to calculate status for a cohort based on pass rate
  const getCohortStatus = (
    passRate: number,
  ): "success" | "warning" | "danger" | "neutral" => {
    if (passRate === 0) return "neutral";
    if (passRate >= 85) return "success";
    if (passRate >= 80) return "warning";
    return "danger";
  };

  // Helper function to get color for a cohort status
  const getCohortColor = (
    cohortStatus: "success" | "warning" | "danger" | "neutral",
  ): string => {
    switch (cohortStatus) {
      case "success":
        return successColor;
      case "warning":
        return warningColor;
      case "danger":
        return dangerColor;
      default:
        return neutralColor;
    }
  };

  return (
    <Card className="w-full h-full flex flex-col relative">
      <div
        className={`absolute top-2 right-2 w-2 h-2 rounded-full ${
          thresholdStatus === "success"
            ? "bg-success"
            : thresholdStatus === "warning"
              ? "bg-warning"
              : thresholdStatus === "danger"
                ? "bg-destructive"
                : "bg-muted-foreground"
        }`}
      />
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex flex-col items-start">
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Cohort Performance
            </CardTitle>
            <CardDescription className="text-sm line-clamp-2">
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

              // Use status from server (already computed), fallback to calculation if not present
              const cohortStatus =
                cohort.status || getCohortStatus(passRatePct);
              const cohortColor = getCohortColor(cohortStatus);

              return (
                <Dialog key={cohort.id}>
                  <DialogTrigger asChild>
                    {/* Each item fills its grid row height */}
                    <div className="h-full p-2 border rounded-md cursor-pointer hover:bg-muted transition-colors relative overflow-hidden">
                      {/* Progress bar background */}
                      <div
                        className="absolute inset-0 opacity-10"
                        style={{ backgroundColor: cohortColor }}
                      />

                      {/* Progress bar fill */}
                      <div
                        className="absolute inset-y-0 left-0 opacity-20 transition-all duration-300"
                        style={{
                          backgroundColor: cohortColor,
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
                              : `${passRatePct.toFixed(2)}% pass `}
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
                              <XAxis
                                dataKey="date"
                                className="text-xs"
                                tickFormatter={(value: string) => {
                                  // Format YYYY-MM-DD to MM-DD
                                  const parts = value.split("-");
                                  if (parts.length === 3) {
                                    return `${parts[1]}-${parts[2]}`;
                                  }
                                  return value;
                                }}
                              />
                              <YAxis domain={[0, 100]} className="text-xs" />
                              <Tooltip
                                contentStyle={{
                                  backgroundColor: "white",
                                  border: "1px solid #e5e7eb",
                                  borderRadius: "6px",
                                }}
                                labelFormatter={(label: string) => {
                                  // Format YYYY-MM-DD to MM-DD
                                  const parts = label.split("-");
                                  if (parts.length === 3) {
                                    return `${parts[1]}-${parts[2]}`;
                                  }
                                  return label;
                                }}
                                formatter={(value: number) => [
                                  `${value}%`,
                                  "Average Score",
                                ]}
                              />
                              <Line
                                type="monotone"
                                dataKey="avgScore"
                                stroke={cohortColor}
                                strokeWidth={2}
                                dot={{ r: 4, fill: cohortColor }}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      );
                    })()}

                    {/* Actionable insight inside the modal */}
                    {actionableInsights && actionableInsights[cohort.id] && (
                      <TruncatedInsight
                        text={actionableInsights[cohort.id] ?? ""}
                        isMobile={isMobile}
                      />
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
