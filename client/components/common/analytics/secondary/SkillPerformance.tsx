/**
 * SkillPerformance.tsx
 * This component displays the skill performance for the personas.
 * @AshokSaravanan222 & @siladiea
 * 07/23/2025
 */
"use client";

import {
  RubricPicker,
  type Rubric,
} from "@/components/common/rubric/RubricPicker";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { FilteredData } from "@/utils/analytics/filtering";
import { calculateSkillPerformance } from "@/utils/analytics/secondary";
import { GraduationCap, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

export interface SkillPerformanceProps {
  filteredData: FilteredData | null;
  thresholds: {
    danger: number;
    warning: number;
    success: number;
  };
}

export default function SkillPerformance({
  filteredData,
  thresholds,
}: SkillPerformanceProps) {
  const [selectedRubrics, setSelectedRubrics] = useState<Rubric[]>([]);

  // Use centralized datasets from filteredData
  const rubrics = filteredData?.rubrics;

  // Set default selection to first rubric when rubrics are loaded
  const defaultRubrics = useMemo(() => {
    if (rubrics && rubrics.length > 0 && selectedRubrics.length === 0) {
      return [rubrics[0]!];
    }
    return selectedRubrics;
  }, [rubrics, selectedRubrics]);

  // Filter rubrics based on selection
  const filteredRubrics = useMemo(() => {
    if (!rubrics) return [];
    if (defaultRubrics.length === 0) return rubrics;
    return rubrics.filter((r) => defaultRubrics.some((sr) => sr.id === r.id));
  }, [rubrics, defaultRubrics]);

  const standardGroups = filteredData?.standardGroups;
  const standards = filteredData?.standards;

  // Calculate skill performance using utility function
  const skillPerformanceResult = useMemo(() => {
    if (!filteredData || !standards || !standardGroups || !filteredRubrics) {
      return null;
    }

    return calculateSkillPerformance(
      filteredData,
      standards,
      standardGroups,
      filteredRubrics,
      filteredRubrics.map((r) => r.id)
    );
  }, [filteredData, standards, standardGroups, filteredRubrics]);

  // Calculate threshold status based on skill performance data
  const getThresholdStatus = () => {
    if (!skillPerformanceResult || !skillPerformanceResult.hasData)
      return "neutral";

    // Calculate average skill performance across all skills
    const avgSkillPerformance =
      skillPerformanceResult.radarData.reduce(
        (sum, skill) => sum + skill.value,
        0
      ) / skillPerformanceResult.radarData.length;

    if (avgSkillPerformance >= thresholds.success) return "success";
    if (avgSkillPerformance >= thresholds.warning) return "warning";
    return "danger";
  };

  const thresholdStatus = getThresholdStatus();

  // Check if any critical data is still loading
  const isLoading = !rubrics || !standardGroups || !standards;

  // Show loading state
  if (isLoading) {
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
                <GraduationCap className="h-5 w-5" />
                Skill Performance
              </CardTitle>
              <CardDescription>
                Performance across key teaching competencies
              </CardDescription>
            </div>
            {rubrics && rubrics.length > 0 && (
              <RubricPicker
                rubrics={rubrics.map((r) => ({
                  id: r.id,
                  name: r.name,
                  description: r.description,
                  points: r.points,
                  active: r.active,
                }))}
                placeholder="Filter by rubric..."
                onSelect={setSelectedRubrics}
                selectedRubrics={defaultRubrics}
                buttonClassName="w-48"
              />
            )}
          </div>
        </CardHeader>
        <CardContent className="flex items-center justify-center flex-1">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading skill data...
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
              <GraduationCap className="h-5 w-5" />
              Skill Performance
            </CardTitle>
            <CardDescription>
              Performance across key teaching competencies
            </CardDescription>
          </div>
          {rubrics && rubrics.length > 0 && (
            <RubricPicker
              rubrics={rubrics.map((r) => ({
                id: r.id,
                name: r.name,
                description: r.description,
                points: r.points,
                active: r.active,
              }))}
              placeholder="Filter by rubric..."
              onSelect={setSelectedRubrics}
              selectedRubrics={defaultRubrics}
              buttonClassName="w-48"
            />
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden flex flex-col justify-center">
        <div className="h-96 flex items-center justify-center">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart
              data={skillPerformanceResult?.radarData ?? []}
              margin={{ top: 60, right: 30, bottom: 10, left: 30 }} // Move chart higher by increasing top margin, reducing bottom
            >
              <PolarAngleAxis
                dataKey="metric"
                // Custom tick function to angle labels with their radar points and prevent cutoff
                tick={({ payload, x, y }) => {
                  // Get the index of this tick in the data array
                  const dataIndex =
                    skillPerformanceResult?.radarData?.findIndex(
                      (item) => item.metric === payload.value
                    ) ?? 0;
                  const totalItems =
                    skillPerformanceResult?.radarData?.length ?? 1;

                  // Calculate the angle for this tick (radar charts start from top and go clockwise)
                  const angle = (dataIndex * 360) / totalItems;

                  // Calculate the angle for proper text positioning
                  // Radar charts start from the top (0°) and go clockwise
                  let textAnchor = "middle";
                  let rotation = 0;

                  // Determine text anchor and rotation to center text around the point
                  // The key is to use "middle" anchor and adjust the rotation to point outward
                  if (angle >= 0 && angle <= 90) {
                    // Top-right quadrant - rotate to point outward
                    textAnchor = "middle";
                    rotation = angle;
                  } else if (angle > 90 && angle <= 180) {
                    // Bottom-right quadrant - rotate to point outward and flip text upright
                    textAnchor = "middle";
                    rotation = angle + 180;
                  } else if (angle > 180 && angle <= 270) {
                    // Bottom-left quadrant - rotate to point outward and flip text upright
                    textAnchor = "middle";
                    rotation = angle + 180;
                  } else {
                    // Top-left quadrant - rotate to point outward
                    textAnchor = "middle";
                    rotation = angle;
                  }

                  // Only render if we have valid coordinates
                  if (x === undefined || y === undefined) {
                    return <g />;
                  }

                  return (
                    <g transform={`translate(${x},${y})`}>
                      <text
                        x={0}
                        y={0}
                        dy={
                          angle > 90 && angle <= 270
                            ? 10 // Bottom right or left
                            : -10 // Top right or left
                        }
                        textAnchor={textAnchor}
                        fill="hsl(var(--muted-foreground))"
                        fontSize={11}
                        transform={`rotate(${rotation})`}
                        className="fill-muted-foreground"
                        style={{ fontWeight: 500 }}
                      >
                        {payload.value}
                      </text>
                    </g>
                  );
                }}
              />
              <PolarGrid />
              <PolarRadiusAxis domain={[0, 1]} axisLine={false} tick={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--background))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "6px",
                }}
                formatter={(
                  value: number,
                  name: string,
                  props: { payload?: { score: number; points: number } }
                ) => {
                  if (name === "value" && props?.payload) {
                    const data = props.payload;
                    return [`${data.score}/${data.points}`, "Score"];
                  }
                  return [value, name];
                }}
                labelFormatter={(label: string) => `Skill: ${label}`}
              />
              <Radar
                dataKey="value"
                fill="#3b82f6"
                fillOpacity={0.6}
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{
                  r: 4,
                  fillOpacity: 1,
                  fill: "#3b82f6",
                }}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
