/**
 * PersonaPerformance.tsx
 * This component displays the performance for the personas.
 * @AshokSaravanan222 & @siladiea
 * 07/23/2025
 */
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
import { cn } from "@/lib/utils";
import { useChartColors, useStatusColor } from "@/lib/utils/chartColors";
import { Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { TooltipProps } from "recharts";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { TruncatedInsight } from "../TruncatedInsight";

// Custom tooltip component with liquid glass styling
function CustomBarTooltip({
  active,
  payload,
  label,
}: TooltipProps<number, string>) {
  if (!active || !payload || !payload.length || !label) return null;

  const value = payload[0]?.value;
  if (typeof value !== "number") return null;

  return (
    <div className="rounded-md border border-border bg-muted/70 backdrop-blur px-3 py-2 shadow-sm">
      <div className="font-medium">{label} Students</div>
      <div className="mt-1 text-xs">Average Score: {value}%</div>
    </div>
  );
}

// Helper component for persona trend chart to use hooks properly
function PersonaTrendChart({
  persona,
  trendData,
}: {
  persona: PersonaPerformanceData;
  trendData: PersonaTrendData[];
}) {
  const personaStatusColor = useStatusColor(persona.status);

  return (
    <div
      className="h-64"
      style={
        process.env.NODE_ENV === "test"
          ? { minWidth: 400, minHeight: 300 }
          : undefined
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={trendData}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis
            dataKey="date"
            className="text-xs"
            angle={-45}
            textAnchor="end"
            height={60}
            tickFormatter={(value: string) => {
              // Format YYYY-MM-DD to MM-DD
              const parts = value.split("-");
              if (parts.length === 3) {
                return `${parts[1]}-${parts[2]}`;
              }
              return value;
            }}
          />
          <YAxis className="text-xs" domain={[0, 100]} />
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
            formatter={(value: number) => [`${value}%`, "Score"]}
          />
          <Line
            type="monotone"
            dataKey="score"
            stroke={personaStatusColor}
            strokeWidth={2}
            dot={{ r: 4, fill: personaStatusColor }}
            name="Score"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

type PersonaTrendData = {
  date: string;
  score: number | null;
  timestamp: number;
  simulationId?: string;
};

type PersonaPerformanceData = {
  name: string;
  score: number;
  sessions: number;
  color: string;
  simulationIds?: string[];
  trendData: PersonaTrendData[];
  status: "success" | "warning" | "danger" | "neutral";
};

type SimulationMapping = Record<string, { name: string; description: string }>;

export interface PersonaPerformanceProps {
  chartData: PersonaPerformanceData[];
  simulationMapping: SimulationMapping;
  validSimulationIds: string[];
  personaColors: Record<string, string>;
  hasDataAvailable: boolean;
  performanceStatus: "success" | "warning" | "danger" | "neutral";
  actionableInsights?: Record<string, string | null>; // Key: persona_id, Value: insight text
  thresholds: {
    danger: number;
    warning: number;
    success: number;
  };
}

export default function PersonaPerformance({
  chartData,
  simulationMapping,
  validSimulationIds,
  personaColors,
  hasDataAvailable,
  performanceStatus,
  actionableInsights,
  thresholds,
}: PersonaPerformanceProps) {
  const [selectedSimulations, setSelectedSimulations] = useState<string[]>([]);
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

  // Filter chart data based on selected simulations and limit to top 5
  const filteredChartData = useMemo(() => {
    let data = chartData;
    if (selectedSimulations.length === 0) {
      data = chartData;
    } else {
      // Note: This is a simplified filter - in a real implementation,
      // you might need to filter based on which simulations each persona appears in
      data = chartData;
    }

    // Sort by score descending and limit to top 5
    const sorted = [...data].sort((a, b) => b.score - a.score);
    const limited = sorted.slice(0, 5);

    // Assign chart colors for bars (keep persona colors for dots)
    return limited.map((persona, idx) => ({
      ...persona,
      barColor: chartColors[idx % chartColors.length], // For bar chart
      // Keep original persona.color for the dot indicator
    }));
  }, [chartData, selectedSimulations, chartColors]);

  // Use hasDataAvailable to determine threshold status
  const thresholdStatus = hasDataAvailable ? performanceStatus : "neutral";

  // Status color classes
  const statusIndicatorClass =
    thresholdStatus === "success"
      ? "bg-success"
      : thresholdStatus === "warning"
        ? "bg-warning"
        : thresholdStatus === "danger"
          ? "bg-destructive"
          : "bg-muted-foreground";

  // Filter trend data for each persona based on selected simulations
  const getFilteredTrendData = (persona: PersonaPerformanceData) => {
    if (selectedSimulations.length === 0) return persona.trendData;

    const selectedIds = new Set(selectedSimulations);
    return persona.trendData.filter(
      (d) => !d.simulationId || selectedIds.has(d.simulationId)
    );
  };

  // Background color by thresholds using shadcn colors
  const getBackgroundColor = (score: number) => {
    if (score >= thresholds.success) return "bg-success/10 dark:bg-success/20";
    if (score >= thresholds.warning) return "bg-warning/10 dark:bg-warning/20";
    return "bg-destructive/10 dark:bg-destructive/20";
  };

  if (!hasDataAvailable) {
    return (
      <Card className="w-full h-full flex flex-col">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex flex-col items-start">
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Persona Performance
              </CardTitle>
              <CardDescription className="text-sm line-clamp-2">
                Performance analysis by student persona type
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center">
          <div className="text-muted-foreground">
            No data available for the selected period
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full h-full flex flex-col relative">
      <div
        className={`absolute top-2 right-2 w-2 h-2 rounded-full ${statusIndicatorClass}`}
      />
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex flex-col items-start">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Persona Performance
            </CardTitle>
            <CardDescription className="text-sm line-clamp-2">
              Performance analysis by student persona type
            </CardDescription>
          </div>
          <SimulationPicker
            simulationMapping={simulationMapping}
            validSimulationIds={validSimulationIds}
            placeholder="Filter by simulation..."
            onSelect={setSelectedSimulations}
            selectedSimulationIds={selectedSimulations}
            hideSelectedChips={true}
            showLabel={false}
            buttonClassName="w-48"
          />
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden">
        <div className="grid gap-6 md:grid-cols-2 h-full">
          {/* Horizontal Bar Chart */}
          <div
            className="h-full"
            style={
              process.env.NODE_ENV === "test"
                ? { minWidth: 400, minHeight: 300 }
                : undefined
            }
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={filteredChartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis type="number" domain={[0, 100]} className="text-xs" />
                <YAxis
                  dataKey="name"
                  type="category"
                  width={80}
                  className="text-xs"
                />
                <Tooltip content={<CustomBarTooltip />} />
                <Bar
                  dataKey="score"
                  radius={[0, 4, 4, 0]}
                  name="Average Score"
                  className="cursor-pointer"
                >
                  {filteredChartData.map((entry, index) => {
                    const entryWithBarColor =
                      entry as PersonaPerformanceData & { barColor?: string };
                    return (
                      <Cell
                        key={`cell-${index}`}
                        fill={
                          entryWithBarColor.barColor ||
                          chartColors[index % chartColors.length]
                        }
                        className="hover:opacity-80 transition-opacity"
                      />
                    );
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Persona Cards */}
          <div className="space-y-4 overflow-y-auto">
            {filteredChartData.map((persona) => (
              <Dialog key={persona.name}>
                <DialogTrigger asChild>
                  <div
                    className={cn(
                      "flex items-center justify-between p-4 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors",
                      getBackgroundColor(persona.score)
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{
                          backgroundColor:
                            personaColors[persona.name] || persona.color,
                        }}
                      />
                      <div>
                        <p className="font-medium">{persona.name} Student</p>
                        <p className="text-sm text-muted-foreground">
                          {persona.sessions} sessions
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold">{persona.score}%</p>
                    </div>
                  </div>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{
                          backgroundColor:
                            personaColors[persona.name] || persona.color,
                        }}
                      />
                      {persona.name} Student Performance
                    </DialogTitle>
                    <DialogDescription hidden>
                      This chart shows the persona performance over time.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-6">
                    {/* Performance Trend Chart */}
                    <PersonaTrendChart
                      persona={persona}
                      trendData={getFilteredTrendData(persona)}
                    />

                    {/* Actionable Insights */}
                    {actionableInsights && actionableInsights[persona.name] && (
                      <TruncatedInsight
                        text={actionableInsights[persona.name] ?? ""}
                        isMobile={isMobile}
                      />
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
