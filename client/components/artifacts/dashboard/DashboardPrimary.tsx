"use client";

import type { OutputOf } from "@/lib/api/types";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";

import { useDashboardSectionParams } from "@/hooks/use-dashboard-section-params";

import RubricHeatmap from "./primary/RubricHeatmap";
import RubricTrend from "./primary/RubricTrend";
import SkillPerformance from "./primary/SkillPerformance";

export type PrimaryOut = OutputOf<"/api/v4/artifacts/dashboard/get", "post">;

function validateStatus(
  status: string | null | undefined,
  defaultValue: "neutral" | "success" | "warning" | "danger" = "neutral"
): "neutral" | "success" | "warning" | "danger" {
  if (!status) return defaultValue;
  if (status === "neutral" || status === "success" || status === "warning" || status === "danger") {
    return status;
  }
  return defaultValue;
}

export interface DashboardPrimaryProps {
  data: PrimaryOut;
  initialHeatmapRubrics?: string[] | undefined;
  onHeatmapRubricChange?: ((ids: string[]) => void) | undefined;
  heatmapRubricSearch?: string | undefined;
  onHeatmapRubricSearchChange?: ((term: string) => void) | undefined;
  initialTrendRubrics?: string[] | undefined;
  onTrendRubricChange?: ((ids: string[]) => void) | undefined;
  trendRubricSearch?: string | undefined;
  onTrendRubricSearchChange?: ((term: string) => void) | undefined;
  initialSkillRubrics?: string[] | undefined;
  onSkillRubricChange?: ((ids: string[]) => void) | undefined;
  skillRubricSearch?: string | undefined;
  onSkillRubricSearchChange?: ((term: string) => void) | undefined;
}

export default function DashboardPrimary({
  data,
  initialHeatmapRubrics,
  onHeatmapRubricChange,
  heatmapRubricSearch,
  onHeatmapRubricSearchChange,
  initialTrendRubrics,
  onTrendRubricChange,
  trendRubricSearch,
  onTrendRubricSearchChange,
  initialSkillRubrics,
  onSkillRubricChange,
  skillRubricSearch,
  onSkillRubricSearchChange,
}: DashboardPrimaryProps) {
  const {
    params: sectionParams,
    setHeatmapRubricIds,
    setHeatmapRubricSearch,
    setTrendRubricIds,
    setTrendRubricSearch,
    setSkillRubricIds,
    setSkillRubricSearch,
  } = useDashboardSectionParams();

  const effectiveOnHeatmapChange = onHeatmapRubricChange ?? setHeatmapRubricIds;
  const effectiveOnHeatmapSearch = onHeatmapRubricSearchChange ?? setHeatmapRubricSearch;
  const effectiveHeatmapSearch = heatmapRubricSearch ?? sectionParams.heatmapRubricSearch ?? undefined;

  const effectiveOnTrendChange = onTrendRubricChange ?? setTrendRubricIds;
  const effectiveOnTrendSearch = onTrendRubricSearchChange ?? setTrendRubricSearch;
  const effectiveTrendSearch = trendRubricSearch ?? sectionParams.trendRubricSearch ?? undefined;

  const effectiveOnSkillChange = onSkillRubricChange ?? setSkillRubricIds;
  const effectiveOnSkillSearch = onSkillRubricSearchChange ?? setSkillRubricSearch;
  const effectiveSkillSearch = skillRubricSearch ?? sectionParams.skillRubricSearch ?? undefined;

  const [primaryCarouselIndex, setPrimaryCarouselIndex] = useState(0);
  const [isPrimaryHovered, setIsPrimaryHovered] = useState(false);

  const primaryComponents = useMemo(() => {
    if (!data?.primary_metrics) return [];

    const rubricHeatmap = data.primary_metrics.rubric_heatmap;
    const rubricTrend = data.primary_metrics.rubric_trend;
    const skillPerformance = data.primary_metrics.skill_performance;

    if (!rubricHeatmap || !rubricTrend || !skillPerformance) return [];

    const normalizedRubricMatrices = (rubricHeatmap.matrices || []).map(
      (matrix) => ({
        rubricId: matrix.rubric_id || "",
        standardGroups: (matrix.standard_groups || []).map((sg) => ({
          id: sg.id || "",
          name: sg.name || "",
          shortName: sg.short_name ?? null,
          rubricId: sg.rubric_id || "",
        })),
        matrix: Array.isArray(matrix.matrix)
          ? (matrix.matrix as unknown as Array<{
              cells?: Array<{
                rubric_id?: string | null;
                correlation?: number | null;
                p_value?: number | null;
                color?: string | null;
                strength?: string | null;
                data_points?: number | null;
                [key: string]: unknown;
              }> | null;
              [key: string]: unknown;
            }>).map((row) =>
              Array.isArray(row.cells)
                ? row.cells.map((cell) => ({
                    rubricId: cell.rubric_id || "",
                    correlation: cell.correlation ?? 0,
                    pValue: cell.p_value ?? null,
                    color: cell.color || "",
                    strength: cell.strength || "",
                    dataPoints: cell.data_points ?? 0,
                  }))
                : []
            )
          : [],
        insights: matrix.insights ?? null,
        hasData: matrix.has_data ?? false,
      }),
    );

    const normalizedTrendData = (rubricTrend.trend_data || []).map((point) => ({
      date: point.date ?? null,
      standard_group_id: point.standard_group_id ?? null,
      standard_group_name: point.standard_group_name ?? null,
      avg_pct: point.avg_pct ?? null,
    }));

    const normalizedSkillPackages = (skillPerformance.packages || []).map((pkg) => ({
      rubric_id: pkg.rubric_id,
      radar_data: pkg.radar_data,
      group_facts: pkg.group_facts,
    }));

    const rubricsMeta = (data.rubrics || []).filter((r) => r.rubric_id && r.name).map((r) => {
      const rubricId = r.rubric_id;
      const name = r.name;
      if (!rubricId || !name) return null;
      return {
        rubric_id: String(rubricId),
        name: String(name),
        description: r.description || "",
      };
    }).filter((r): r is { rubric_id: string; name: string; description: string } => r !== null);

    return [
      <RubricHeatmap
        key="rubric-heatmap"
        matrices={normalizedRubricMatrices}
        rubrics={rubricsMeta}
        validRubricIds={rubricHeatmap.valid_rubric_ids || []}
        hasDataAvailable={(rubricHeatmap.matrices || []).length > 0}
        actionableInsight={data.insights?.rubric_heatmap ?? null}
        status={validateStatus(rubricHeatmap.status)}
        initialSelectedRubrics={initialHeatmapRubrics}
        onRubricSelect={effectiveOnHeatmapChange}
        rubricSearchValue={effectiveHeatmapSearch}
        onRubricSearchChange={effectiveOnHeatmapSearch}
      />,
      <RubricTrend
        key="rubric-trend"
        trendData={normalizedTrendData}
        rubrics={rubricsMeta}
        validRubricIds={rubricTrend.valid_rubric_ids || []}
        hasDataAvailable={(rubricTrend.trend_data || []).length > 0}
        actionableInsight={data.insights?.rubric_trend ?? null}
        status={validateStatus(rubricTrend.status)}
        initialSelectedRubrics={initialTrendRubrics}
        onRubricSelect={effectiveOnTrendChange}
        rubricSearchValue={effectiveTrendSearch}
        onRubricSearchChange={effectiveOnTrendSearch}
      />,
      <SkillPerformance
        key="skill-performance"
        packages={normalizedSkillPackages.map((pkg) => ({
          rubricId: pkg.rubric_id || "",
          radarData: (pkg.radar_data || []).map((rd) => ({
            metric: rd.metric || "",
            description: rd.description ?? undefined,
            value: rd.value ?? 0,
            fullMark: rd.full_mark ?? 0,
          })),
          groupFacts: (pkg.group_facts || []).map((gf) => ({
            groupId: gf.group_id || "",
            groupName: gf.group_name || "",
            groupDescription: gf.group_description ?? undefined,
            simulationId: gf.simulation_id || "",
            score: gf.score ?? 0,
            points: gf.points ?? 0,
            avgPct: gf.avg_pct ?? 0,
          })),
        }))}
        rubrics={rubricsMeta}
        validRubricIds={skillPerformance.valid_rubric_ids || []}
        actionableInsight={data.insights?.skill_performance ?? null}
        status={validateStatus(skillPerformance.status)}
        initialSelectedRubrics={initialSkillRubrics}
        onRubricSelect={effectiveOnSkillChange}
        rubricSearchValue={effectiveSkillSearch}
        onRubricSearchChange={effectiveOnSkillSearch}
      />,
    ];
  }, [data, initialHeatmapRubrics, effectiveOnHeatmapChange, effectiveHeatmapSearch, effectiveOnHeatmapSearch, initialTrendRubrics, effectiveOnTrendChange, effectiveTrendSearch, effectiveOnTrendSearch, initialSkillRubrics, effectiveOnSkillChange, effectiveSkillSearch, effectiveOnSkillSearch]);

  const navigatePrimary = (direction: "prev" | "next") => {
    const length = primaryComponents.length;
    if (length === 0) return;
    if (direction === "prev") {
      setPrimaryCarouselIndex((prev: number) => (prev - 1 + length) % length);
    } else {
      setPrimaryCarouselIndex((prev: number) => (prev + 1) % length);
    }
  };

  if (primaryComponents.length === 0) return null;

  return (
    <div className="flex flex-col space-y-4">
      <div
        className="relative group min-h-[500px] max-h-[500px]"
        onMouseEnter={() => setIsPrimaryHovered(true)}
        onMouseLeave={() => setIsPrimaryHovered(false)}
      >
        <div className="transition-all duration-300 ease-in-out h-full">
          <div className="h-full">
            {primaryComponents[primaryCarouselIndex % primaryComponents.length]}
          </div>
        </div>

        {primaryComponents.length > 1 && (
          <>
            <Button
              variant="secondary"
              size="icon"
              className={`absolute left-4 top-1/2 -translate-y-1/2 z-10 transition-opacity duration-200 ${
                isPrimaryHovered ? "opacity-100" : "opacity-0"
              } hover:opacity-100`}
              onClick={() => navigatePrimary("prev")}
              data-testid="dashboard-primary-carousel-prev"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="secondary"
              size="icon"
              className={`absolute right-4 top-1/2 -translate-y-1/2 z-10 transition-opacity duration-200 ${
                isPrimaryHovered ? "opacity-100" : "opacity-0"
              } hover:opacity-100`}
              onClick={() => navigatePrimary("next")}
              data-testid="dashboard-primary-carousel-next"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>

      {primaryComponents.length > 1 && (
        <div className="flex justify-center gap-2">
          {primaryComponents.map((_, index) => (
            <button
              key={index}
              onClick={() => setPrimaryCarouselIndex(index)}
              className={`w-2 h-2 rounded-full transition-colors ${
                index === primaryCarouselIndex ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
