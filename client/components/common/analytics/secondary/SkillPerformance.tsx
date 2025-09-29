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
import { GraduationCap } from "lucide-react";
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

type RadarDatum = {
  metric: string;
  value: number;
  fullMark: number;
};
type GroupFact = {
  groupId: string;
  groupName: string;
  simulationId: string;
  score: number;
  points: number;
};
type Package = {
  rubricId: string;
  radarData: RadarDatum[];
  groupFacts: GroupFact[];
};

export interface SkillPerformanceProps {
  packages: Package[];
  /** All rubrics from client cache/store */
  allRubrics: Rubric[];
  isLoading: boolean;
  isError: boolean;
  actionableInsight?: string | null;
  thresholds: {
    danger: number;
    warning: number;
    success: number;
  };
}

export default function SkillPerformance({
  packages,
  allRubrics,
  isLoading,
  isError,
  actionableInsight,
  thresholds,
}: SkillPerformanceProps) {
  const [selectedRubrics, setSelectedRubrics] = useState<Rubric[]>([]);

  const pickerRubrics = useMemo(() => allRubrics, [allRubrics]);

  // Default to first valid rubric if none selected
  const activeRubricId = useMemo(() => {
    if (selectedRubrics.length > 0) return selectedRubrics[0]!.id;
    return pickerRubrics[0]?.id;
  }, [selectedRubrics, pickerRubrics]);

  const activePackage = useMemo(
    () => packages.find((p) => p.rubricId === activeRubricId),
    [packages, activeRubricId]
  );

  // Calculate threshold status based on skill performance data
  const getThresholdStatus = () => {
    if (!activePackage?.radarData || activePackage.radarData.length === 0)
      return "neutral";

    // Calculate average skill performance across all skills
    const avgSkillPerformance =
      activePackage.radarData.reduce((sum, skill) => sum + skill.value, 0) /
      activePackage.radarData.length;

    if (avgSkillPerformance >= thresholds.success) return "success";
    if (avgSkillPerformance >= thresholds.warning) return "warning";
    return "danger";
  };

  const thresholdStatus = getThresholdStatus();

  if (isLoading) {
    return (
      <Card className="w-full h-full flex flex-col">
        <CardHeader>
          <CardTitle>Skill Performance</CardTitle>
          <CardDescription>Loading skill data...</CardDescription>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center text-muted-foreground">
          Loading...
        </CardContent>
      </Card>
    );
  }
  if (isError) {
    return (
      <Card className="w-full h-full flex flex-col">
        <CardHeader>
          <CardTitle>Skill Performance</CardTitle>
          <CardDescription>Error loading data</CardDescription>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center text-destructive">
          Failed to load skill data
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
          {pickerRubrics.length > 0 && (
            <RubricPicker
              rubrics={pickerRubrics}
              placeholder="Filter by rubric..."
              onSelect={setSelectedRubrics}
              selectedRubrics={
                selectedRubrics.length
                  ? selectedRubrics
                  : pickerRubrics.slice(0, 1)
              }
              buttonClassName="w-48"
            />
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden flex flex-col justify-center">
        <div className="h-96 flex items-center justify-center">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart
              data={activePackage?.radarData ?? []}
              margin={{ top: 60, right: 30, bottom: 10, left: 30 }}
            >
              <PolarAngleAxis
                dataKey="metric"
                tick={({ payload, x, y }) => {
                  const dataIndex =
                    activePackage?.radarData?.findIndex(
                      (item) => item.metric === payload.value
                    ) ?? 0;
                  const totalItems = activePackage?.radarData?.length ?? 1;
                  const angle = (dataIndex * 360) / totalItems;

                  let textAnchor = "middle";
                  let rotation = 0;

                  if (angle >= 0 && angle <= 90) {
                    textAnchor = "middle";
                    rotation = angle;
                  } else if (angle > 90 && angle <= 180) {
                    textAnchor = "middle";
                    rotation = angle + 180;
                  } else if (angle > 180 && angle <= 270) {
                    textAnchor = "middle";
                    rotation = angle + 180;
                  } else {
                    textAnchor = "middle";
                    rotation = angle;
                  }

                  if (x === undefined || y === undefined) {
                    return <g />;
                  }

                  return (
                    <g transform={`translate(${x},${y})`}>
                      <text
                        x={0}
                        y={0}
                        dy={angle > 90 && angle <= 270 ? 10 : -10}
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
                    return [`${data.score.toFixed(2)}/${data.points}`, "Score"];
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

        {/* Actionable Insights */}
        {actionableInsight && (
          <div className="p-4 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">{actionableInsight}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
