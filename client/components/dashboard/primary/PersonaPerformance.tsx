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
import { TruncatedInsight } from "../TruncatedInsight";
import { cn } from "@/lib/utils";
import { Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024); // lg breakpoint
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Filter chart data based on selected simulations
  const filteredChartData = useMemo(() => {
    if (selectedSimulations.length === 0) return chartData;

    // Note: This is a simplified filter - in a real implementation,
    // you might need to filter based on which simulations each persona appears in
    return chartData;
  }, [chartData, selectedSimulations]);

  // Use hasDataAvailable to determine threshold status
  const thresholdStatus = hasDataAvailable ? performanceStatus : "neutral";

  // Filter trend data for each persona based on selected simulations
  const getFilteredTrendData = (persona: PersonaPerformanceData) => {
    if (selectedSimulations.length === 0) return persona.trendData;

    const selectedIds = new Set(selectedSimulations);
    return persona.trendData.filter(
      (d) => !d.simulationId || selectedIds.has(d.simulationId),
    );
  };

  // Background color by thresholds
  const getBackgroundColor = (score: number) => {
    if (score >= thresholds.success) return "bg-green-50 dark:bg-green-950";
    if (score >= thresholds.warning) return "bg-yellow-50 dark:bg-yellow-950";
    return "bg-red-50 dark:bg-red-950";
  };

  if (!hasDataAvailable) {
    return (
      <Card className="w-full h-full flex flex-col">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Persona Performance
          </CardTitle>
          <CardDescription>
            Performance analysis by student persona type
          </CardDescription>
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
              <Users className="h-5 w-5" />
              Persona Performance
            </CardTitle>
            <CardDescription>
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
                  formatter={(value: number) => [`${value}%`, "Average Score"]}
                  labelFormatter={(label) => `${label} Students`}
                />
                <Bar
                  dataKey="score"
                  radius={[0, 4, 4, 0]}
                  name="Average Score"
                  className="cursor-pointer"
                >
                  {filteredChartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={
                        personaColors[entry.name] ?? entry.color ?? "#999999"
                      }
                      className="hover:opacity-80 transition-opacity"
                    />
                  ))}
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
                      getBackgroundColor(persona.score),
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{
                          backgroundColor:
                            personaColors[persona.name] ??
                            persona.color ??
                            "#999999",
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
                            personaColors[persona.name] ??
                            persona.color ??
                            "#999999",
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
                    <div
                      className="h-64"
                      style={
                        process.env.NODE_ENV === "test"
                          ? { minWidth: 400, minHeight: 300 }
                          : undefined
                      }
                    >
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={getFilteredTrendData(persona)}>
                          <CartesianGrid
                            strokeDasharray="3 3"
                            className="stroke-muted"
                          />
                          <XAxis
                            dataKey="date"
                            className="text-xs"
                            angle={-45}
                            textAnchor="end"
                            height={60}
                          />
                          <YAxis className="text-xs" domain={[0, 100]} />
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
                            formatter={(value: number) => [
                              `${value}%`,
                              "Score",
                            ]}
                          />
                          <Line
                            type="monotone"
                            dataKey="score"
                            stroke={
                              personaColors[persona.name] ??
                              persona.color ??
                              "#999999"
                            }
                            strokeWidth={2}
                            dot={{ r: 4 }}
                            name="Score"
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Actionable Insights */}
                    {actionableInsights && actionableInsights[persona.name] && (
                      <TruncatedInsight 
                        text={actionableInsights[persona.name]} 
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
