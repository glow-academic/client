/**
 * PersonaPerformance.tsx
 * This component displays the performance for the personas.
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

import { cn } from "@/lib/utils";
import type { FilteredData } from "@/utils/analytics/filtering";
import { calculatePersonaPerformance } from "@/utils/analytics/primary";
import { getAllPersonas } from "@/utils/queries/personas/get-all-personas";
import { useQuery } from "@tanstack/react-query";
import { Users } from "lucide-react";
import { useMemo, useState } from "react";
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

export interface PersonaPerformanceProps {
  filteredData: FilteredData | null;
  thresholds: {
    danger: number;
    warning: number;
    success: number;
  };
}

export default function PersonaPerformance({
  filteredData,
  thresholds,
}: PersonaPerformanceProps) {
  const [selectedSimulations, setSelectedSimulations] = useState<Simulation[]>(
    []
  );

  // Use datasets sourced from filtered data where available
  const rubrics = filteredData?.rubrics;
  const scenarios = filteredData?.scenarios;
  // Personas are not included in filtered data yet; fetch minimally
  const { data: personas } = useQuery({
    queryKey: ["personas"],
    queryFn: () => getAllPersonas(),
  });

  // Map persona name -> hex color from personas table
  const personaColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    if (personas && personas.length > 0) {
      for (const persona of personas) {
        if (persona?.name && persona?.color) {
          map[persona.name] = persona.color;
        }
      }
    }
    return map;
  }, [personas]);

  // Get simulations that have data (simplified logic)
  const simulationsWithData = useMemo(() => {
    if (!filteredData?.simulations) return [];

    // Filter out practice simulations (data is already filtered by date and cohorts)
    return filteredData.simulations.filter((s) => !s.practiceSimulation);
  }, [filteredData?.simulations]);

  // Calculate performance by persona
  const performanceData = useMemo(() => {
    if (!filteredData || !scenarios || !rubrics || !personas) {
      return [];
    }

    return calculatePersonaPerformance(
      filteredData,
      rubrics,
      personas,
      scenarios
    );
  }, [filteredData, rubrics, personas, scenarios]);

  // Calculate threshold status based on persona performance data
  const getThresholdStatus = () => {
    if (performanceData.length === 0) return "neutral";

    // Calculate average score across all personas
    const avgScore =
      performanceData.reduce((sum, persona) => sum + persona.score, 0) /
      performanceData.length;

    if (avgScore >= thresholds.success) return "success";
    if (avgScore >= thresholds.warning) return "warning";
    return "danger";
  };

  const thresholdStatus = getThresholdStatus();

  // Get background color based on performance thresholds
  const getBackgroundColor = (score: number) => {
    if (score >= thresholds.success) return "bg-green-50 dark:bg-green-950";
    if (score >= thresholds.warning) return "bg-yellow-50 dark:bg-yellow-950";
    return "bg-red-50 dark:bg-red-950";
  };

  // Get actionable insights
  const getActionableInsights = (trendData: Array<{ score: number }>) => {
    if (trendData.length < 2) return null;

    const recentScores = trendData.slice(-3);
    const earlierScores = trendData.slice(0, 3);

    if (recentScores.length === 0 || earlierScores.length === 0) return null;

    const recentAvg =
      recentScores.reduce((sum, item) => sum + item.score, 0) /
      recentScores.length;
    const earlierAvg =
      earlierScores.reduce((sum, item) => sum + item.score, 0) /
      earlierScores.length;
    const improvement = recentAvg - earlierAvg;

    if (improvement > 5) {
      return "Performance has improved significantly. Consider advancing to more challenging scenarios.";
    } else if (improvement < -5) {
      return "Performance has declined. Review training approach for this persona type.";
    }

    return null;
  };

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
          {filteredData?.simulations && filteredData.simulations.length > 0 && (
            <SimulationPicker
              simulations={(simulationsWithData.length > 0
                ? simulationsWithData
                : filteredData.simulations
              ).map((s) => ({
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
              showPracticeSimulations={true}
              buttonClassName="w-48"
            />
          )}
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
              <BarChart data={performanceData} layout="vertical">
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
                    backgroundColor: "hsl(var(--background))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "6px",
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
                  {performanceData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={personaColorMap[entry.name] ?? "#999999"}
                      className="hover:opacity-80 transition-opacity"
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Persona Cards */}
          <div className="space-y-4 overflow-y-auto">
            {performanceData.map((persona) => (
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
                        className={cn("w-4 h-4 rounded-full")}
                        style={{
                          backgroundColor:
                            personaColorMap[persona.name] ?? "#999999",
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
                        className={cn("w-4 h-4 rounded-full")}
                        style={{
                          backgroundColor:
                            personaColorMap[persona.name] ?? "#999999",
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
                        <LineChart data={persona.trendData}>
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
                              backgroundColor: "hsl(var(--background))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: "6px",
                            }}
                            formatter={(value: number) => [
                              `${value}%`,
                              "Score",
                            ]}
                          />
                          <Line
                            type="monotone"
                            dataKey="score"
                            stroke={personaColorMap[persona.name] ?? "#999999"}
                            strokeWidth={2}
                            dot={{ r: 4 }}
                            name="Score"
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Actionable Insights */}
                    {getActionableInsights(persona.trendData) && (
                      <div className="p-3 bg-muted rounded-lg">
                        <p className="text-sm text-muted-foreground">
                          {getActionableInsights(persona.trendData)}
                        </p>
                      </div>
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
