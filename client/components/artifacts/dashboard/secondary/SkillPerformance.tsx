"use client";

import { GenericPicker } from "@/components/common/forms/GenericPicker";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useChartColors } from "@/lib/utils/chartColors";
import { GraduationCap } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { TooltipProps } from "recharts";
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { TruncatedInsight } from "../TruncatedInsight";

// Custom tooltip component with liquid glass styling
function CustomRadarTooltip({
  active,
  payload,
  label,
}: TooltipProps<number, string>) {
  if (!active || !payload || !payload.length || !label) return null;

  const item = payload[0];
  const value = item?.value;
  const score = item?.payload?.score;
  const points = item?.payload?.points;

  let displayValue = "";
  if (typeof score === "number" && typeof points === "number") {
    displayValue = `${score.toFixed(2)}/${points}`;
  } else if (typeof value === "number") {
    displayValue = `${(value * 100).toFixed(1)}%`;
  }

  return (
    <div className="rounded-md border border-border bg-muted/70 backdrop-blur px-3 py-2 shadow-sm">
      <div className="font-medium">{label}</div>
      <div className="mt-1 text-xs">
        {typeof score === "number" && typeof points === "number"
          ? `Score: ${displayValue}`
          : `Performance: ${displayValue}`}
      </div>
    </div>
  );
}

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

type Rubric = {
  rubric_id: string;
  name: string;
  description: string;
};

export interface SkillPerformanceProps {
  packages: Package[];
  /** Rubrics array */
  rubrics: Rubric[];
  /** Valid rubric IDs */
  validRubricIds: string[];
  actionableInsight?: string | null;
  status: "success" | "warning" | "danger" | "neutral";
  initialSelectedRubrics?: string[];
  onRubricSelect?: (ids: string[]) => void;
  rubricSearchValue?: string;
  onRubricSearchChange?: (term: string) => void;
}

export default function SkillPerformance({
  packages,
  rubrics,
  validRubricIds,
  actionableInsight,
  status,
  initialSelectedRubrics,
  onRubricSelect,
  rubricSearchValue,
  onRubricSearchChange,
}: SkillPerformanceProps) {
  // Create lookup map from array for backward compatibility
  const rubricMapping = useMemo(() => {
    return rubrics.reduce((acc, rubric) => {
      acc[rubric.rubric_id] = { name: rubric.name, description: rubric.description };
      return acc;
    }, {} as Record<string, { name: string; description: string }>);
  }, [rubrics]);

  const [selectedRubricsInternal, setSelectedRubricsInternal] = useState<string[]>(initialSelectedRubrics ?? []);
  const selectedRubrics = initialSelectedRubrics ?? selectedRubricsInternal;
  const setSelectedRubrics = onRubricSelect ?? setSelectedRubricsInternal;
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
            <GenericPicker
              items={rubricMapping}
              itemIds={validRubricIds}
              selectedIds={selectedRubrics}
              onSelect={setSelectedRubrics}
              getId={(rubric) => (rubric as unknown as { id: string }).id}
              getLabel={(rubric) => rubric.name || ""}
              getSearchText={(rubric) =>
                `${rubric.name} ${rubric.description || ""}`
              }
              placeholder="Filter by rubric..."
              hideSelectedChips={true}
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
              <Tooltip content={<CustomRadarTooltip />} />
              <Radar
                dataKey="value"
                fill={chartColors[0]}
                fillOpacity={0.6}
                stroke={chartColors[0]}
                strokeWidth={2}
                dot={{
                  r: 4,
                  fillOpacity: 1,
                  fill: chartColors[0],
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
