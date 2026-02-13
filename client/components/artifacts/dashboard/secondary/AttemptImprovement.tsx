"use client";

import { GenericPicker } from "@/components/common/forms/GenericPicker";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useChartColors } from "@/lib/utils/chartColors";
import { TrendingUp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { TooltipProps } from "recharts";
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
import { TruncatedInsight } from "../TruncatedInsight";

// Custom tooltip component with liquid glass styling
function CustomComposedTooltip({
  active,
  payload,
  label,
}: TooltipProps<number, string>) {
  if (!active || !payload || !payload.length || !label) return null;

  return (
    <div className="rounded-md border border-border bg-muted/70 backdrop-blur px-3 py-2 shadow-sm">
      <div className="font-medium">{label}</div>
      <div className="mt-1 text-xs space-y-1">
        {payload.map((item, index) => {
          const name = item.name || "";
          const value = item.value;
          const formattedValue =
            name === "Average Time" ? `${value} min` : `${value}%`;
          return (
            <div key={index}>
              {name}: {formattedValue}
            </div>
          );
        })}
      </div>
    </div>
  );
}

type AttemptRow = {
  attempt: string;
  average_score: number;
  average_time: number;
  pass_rate: number;
};
type AttemptFact = {
  simulationId: string;
  attemptNo: number;
  avgGrade: number;
  avgMinutes: number;
  passRate: number;
};

type Simulation = {
  simulation_id: string;
  name: string;
  description: string;
  department_ids?: string[] | null;
  time_limit?: number | null;
};

export interface AttemptImprovementProps {
  chartData: AttemptRow[];
  facts: AttemptFact[];
  /** Simulations array */
  simulations: Simulation[];
  /** Valid simulation IDs */
  validSimulationIds: string[];
  actionableInsight?: string | null;
  status: "success" | "warning" | "danger" | "neutral";
  initialSelectedSimulations?: string[] | undefined;
  onSimulationSelect?: ((ids: string[]) => void) | undefined;
  simulationSearchValue?: string | undefined;
  onSimulationSearchChange?: ((term: string) => void) | undefined;
}

export default function AttemptImprovement({
  chartData,
  facts,
  simulations,
  validSimulationIds,
  actionableInsight,
  status,
  initialSelectedSimulations,
  onSimulationSelect,
  simulationSearchValue,
  onSimulationSearchChange,
}: AttemptImprovementProps) {
  // Create lookup map from array for backward compatibility
  const simulationMapping = useMemo(() => {
    return simulations.reduce((acc, sim) => {
      acc[sim.simulation_id] = {
        name: sim.name,
        description: sim.description,
        department_ids: sim.department_ids ?? null,
      };
      return acc;
    }, {} as Record<string, { name: string; description: string; department_ids: string[] | null }>);
  }, [simulations]);

  const [selectedInternal, setSelectedInternal] = useState<string[]>(initialSelectedSimulations ?? []);
  const selected = initialSelectedSimulations ?? selectedInternal;
  const setSelected = onSimulationSelect ?? setSelectedInternal;
  const [isMobile, setIsMobile] = useState(false);

  // Get chart colors 1-5 from CSS variables
  const chartColors = useChartColors();

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024); // lg breakpoint
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

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
        average_score: Math.round(acc.gradeSum / Math.max(1, acc.n)),
        average_time: Math.round(acc.minSum / Math.max(1, acc.n)),
        pass_rate: Math.round(acc.passSum / Math.max(1, acc.n)),
      }));
  }, [selected, chartData, facts]);

  // Use status from server
  const thresholdStatus = status;

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
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex flex-col items-start">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Attempt Improvement
            </CardTitle>
            <CardDescription className="text-sm line-clamp-2">
              Performance improvement across multiple attempts
            </CardDescription>
          </div>
          <GenericPicker
            items={simulationMapping}
            itemIds={validSimulationIds}
            selectedIds={selected}
            onSelect={setSelected}
            getId={(sim) => (sim as unknown as { id: string }).id}
            getLabel={(sim) => sim.name || ""}
            getSearchText={(sim) => `${sim.name} ${sim.description || ""}`}
            renderPreview={(sim) => {
              const formatTimeLimit = (timeLimit?: number | null) => {
                if (!timeLimit || timeLimit === 0) return "No time limit";
                if (timeLimit < 60) return `${timeLimit} minutes`;
                const hours = Math.floor(timeLimit / 60);
                const minutes = timeLimit % 60;
                if (minutes === 0)
                  return `${hours} hour${hours !== 1 ? "s" : ""}`;
                return `${hours}h ${minutes}m`;
              };
              return (
                <div className="grid gap-2">
                  <h4 className="font-medium leading-none">{sim.name}</h4>
                  <div className="text-sm text-muted-foreground">
                    {sim.description || "No description available"}
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    <Badge variant="outline" className="text-xs">
                      {formatTimeLimit(
                        (sim as { time_limit?: number | null }).time_limit,
                      )}
                    </Badge>
                  </div>
                </div>
              );
            }}
            placeholder="Filter by simulation..."
            hideSelectedChips={true}
            showLabel={false}
            multiSelect={true}
            buttonClassName="w-48"
            groupHeading="Simulations"
            {...(simulationSearchValue !== undefined && { initialSearchTerm: simulationSearchValue })}
            {...(onSimulationSearchChange !== undefined && { onSearchChange: onSimulationSearchChange })}
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
                <Tooltip content={<CustomComposedTooltip />} />
                <Legend />
                <Bar
                  dataKey="average_score"
                  fill={chartColors[0]}
                  name="Average Score"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="pass_rate"
                  fill={chartColors[1]}
                  name="Pass Rate"
                  radius={[4, 4, 0, 0]}
                />
                <Line
                  type="monotone"
                  dataKey="average_time"
                  stroke={chartColors[2]}
                  strokeWidth={2}
                  dot={{ fill: chartColors[2], strokeWidth: 2, r: 4 }}
                  yAxisId="right"
                  name="Average Time"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Actionable Insights */}
          {actionableInsight && (
            <TruncatedInsight text={actionableInsight} isMobile={isMobile} />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
