"use client";

import { RubricPicker } from "@/components/common/forms/RubricPicker";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TruncatedInsight } from "../TruncatedInsight";
import { GraduationCap } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
  description?: string | undefined;
};
type StandardFact = {
  groupId: string;
  groupName: string;
  groupDescription?: string | undefined;
  simulationId: string;
  score: number;
  points: number;
  avgPct: number;
};
type Package = {
  rubricId: string;
  radarData: RadarDatum[];
  groupFacts: StandardFact[];
};

export interface SkillPerformanceProps {
  packages: Package[];
  /** Rubric mapping object */
  rubricMapping: Record<string, { name: string; description: string }>;
  /** Valid rubric IDs */
  validRubricIds: string[];
  actionableInsight?: string | null;
  status: "success" | "warning" | "danger" | "neutral";
}

export default function SkillPerformance({
  packages,
  rubricMapping,
  validRubricIds,
  actionableInsight,
  status,
}: SkillPerformanceProps) {
  const [selectedRubrics, setSelectedRubrics] = useState<string[]>([]);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024); // lg breakpoint
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Default to first valid rubric if none selected
  const activeRubricId = useMemo(() => {
    if (selectedRubrics.length > 0) return selectedRubrics[0];
    return validRubricIds[0];
  }, [selectedRubrics, validRubricIds]);

  const activePackage = useMemo(
    () => packages.find((p) => p.rubricId === activeRubricId),
    [packages, activeRubricId],
  );

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
              <GraduationCap className="h-5 w-5" />
              Skill Performance
            </CardTitle>
            <CardDescription className="text-sm line-clamp-2">
              Performance across key teaching competencies
            </CardDescription>
          </div>
          {validRubricIds.length > 0 && (
            <RubricPicker
              mapping={rubricMapping}
              validIds={validRubricIds}
              selectedIds={selectedRubrics}
              onSelect={setSelectedRubrics}
              placeholder="Filter by rubric..."
              buttonClassName="w-48"
            />
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col">
        <div className="h-[300px] flex items-center justify-center">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart
              data={activePackage?.radarData ?? []}
              margin={{ top: 20, right: 30, bottom: 20, left: 30 }}
            >
              <PolarAngleAxis
                dataKey="metric"
                tick={({ payload, x, y }) => {
                  const dataIndex =
                    activePackage?.radarData?.findIndex(
                      (item) => item.metric === payload.value,
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
                formatter={(
                  value: number,
                  name: string,
                  props: { payload?: { score?: number; points?: number } },
                ) => {
                  if (name === "value") {
                    const score = props?.payload?.score;
                    const points = props?.payload?.points;
                    if (
                      typeof score === "number" &&
                      typeof points === "number"
                    ) {
                      return [`${score.toFixed(2)}/${points}`, "Score"];
                    }
                    // fallback: show percent for the normalized "value"
                    const v = typeof value === "number" ? value : Number(value);
                    return [`${(v * 100).toFixed(1)}%`, "Performance"];
                  }
                  return [value, name];
                }}
                labelFormatter={(label: string) => label}
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
          <TruncatedInsight text={actionableInsight} isMobile={isMobile} />
        )}
      </CardContent>
    </Card>
  );
}
