"use client";

import type { OutputOf } from "@/lib/api/types";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";

import { useDashboardSectionParams } from "@/hooks/use-dashboard-section-params";

import RubricHeatmap from "./primary/RubricHeatmap";
import RubricTrend from "./primary/RubricTrend";
import SkillPerformance from "./primary/SkillPerformance";

export type PrimaryOut = OutputOf<"/api/v5/artifacts/dashboard/get", "post">;

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
  initialRubricIds?: string[] | undefined;
  rubricSearch?: string | undefined;
  initialIndex?: number;
}

export default function DashboardPrimary({
  data,
  initialRubricIds,
  rubricSearch,
  initialIndex = 0,
}: DashboardPrimaryProps) {
  const {
    params: sectionParams,
    setRubricIds,
    setRubricSearch,
    setRubricIndex,
  } = useDashboardSectionParams();

  const effectiveOnRubricChange = setRubricIds;
  const effectiveOnRubricSearch = setRubricSearch;
  const effectiveRubricSearch = rubricSearch ?? sectionParams.rubricSearch ?? undefined;

  const [primaryCarouselIndex, setPrimaryCarouselIndex] = useState(initialIndex);
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
        initialSelectedRubrics={initialRubricIds}
        onRubricSelect={effectiveOnRubricChange}
        rubricSearchValue={effectiveRubricSearch}
        onRubricSearchChange={effectiveOnRubricSearch}
      />,
      <RubricTrend
        key="rubric-trend"
        trendData={normalizedTrendData}
        rubrics={rubricsMeta}
        validRubricIds={rubricTrend.valid_rubric_ids || []}
        hasDataAvailable={(rubricTrend.trend_data || []).length > 0}
        actionableInsight={data.insights?.rubric_trend ?? null}
        status={validateStatus(rubricTrend.status)}
        initialSelectedRubrics={initialRubricIds}
        onRubricSelect={effectiveOnRubricChange}
        rubricSearchValue={effectiveRubricSearch}
        onRubricSearchChange={effectiveOnRubricSearch}
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
        initialSelectedRubrics={initialRubricIds}
        onRubricSelect={effectiveOnRubricChange}
        rubricSearchValue={effectiveRubricSearch}
        onRubricSearchChange={effectiveOnRubricSearch}
      />,
    ];
  }, [data, initialRubricIds, effectiveOnRubricChange, effectiveRubricSearch, effectiveOnRubricSearch]);

  const navigatePrimary = (direction: "prev" | "next") => {
    const length = primaryComponents.length;
    if (length === 0) return;
    let newIndex: number;
    if (direction === "prev") {
      newIndex = (primaryCarouselIndex - 1 + length) % length;
    } else {
      newIndex = (primaryCarouselIndex + 1) % length;
    }
    setPrimaryCarouselIndex(newIndex);
    setRubricIndex(newIndex);
  };

  const setIndex = (index: number) => {
    setPrimaryCarouselIndex(index);
    setRubricIndex(index);
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
              onClick={() => setIndex(index)}
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
