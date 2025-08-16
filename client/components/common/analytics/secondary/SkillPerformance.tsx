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
      <CardContent className="flex-1 overflow-hidden">
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={skillPerformanceResult?.radarData ?? []}>
              <PolarAngleAxis dataKey="metric" />
              <PolarGrid />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--background))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "6px",
                }}
                formatter={(value: number, name: string) => [
                  `${value}%`,
                  name === "value" ? "Score" : name,
                ]}
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
