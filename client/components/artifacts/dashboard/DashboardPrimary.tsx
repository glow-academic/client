"use client";

import type { OutputOf } from "@/lib/api/types";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";

import { useDashboardSectionParams } from "@/hooks/use-dashboard-section-params";

import Growth from "./primary/Growth";
import PersonaPerformance from "./primary/PersonaPerformance";
import RubricHeatmap from "./primary/RubricHeatmap";

export type PrimaryOut = OutputOf<"/api/v4/artifacts/dashboard/primary", "post">;

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
  initialPersonaSimulations?: string[] | undefined;
  onPersonaSimulationChange?: ((ids: string[]) => void) | undefined;
  personaSimulationsSearch?: string | undefined;
  onPersonaSimulationsSearchChange?: ((term: string) => void) | undefined;
  initialHeatmapRubrics?: string[] | undefined;
  onHeatmapRubricChange?: ((ids: string[]) => void) | undefined;
  heatmapRubricSearch?: string | undefined;
  onHeatmapRubricSearchChange?: ((term: string) => void) | undefined;
}

export default function DashboardPrimary({
  data,
  initialPersonaSimulations,
  onPersonaSimulationChange,
  personaSimulationsSearch,
  onPersonaSimulationsSearchChange,
  initialHeatmapRubrics,
  onHeatmapRubricChange,
  heatmapRubricSearch,
  onHeatmapRubricSearchChange,
}: DashboardPrimaryProps) {
  const {
    params: sectionParams,
    setPersonaSimulationIds,
    setPersonaSimulationsSearch,
    setHeatmapRubricIds,
    setHeatmapRubricSearch,
  } = useDashboardSectionParams();

  const effectiveOnPersonaChange = onPersonaSimulationChange ?? setPersonaSimulationIds;
  const effectiveOnPersonaSearch = onPersonaSimulationsSearchChange ?? setPersonaSimulationsSearch;
  const effectivePersonaSearch = personaSimulationsSearch ?? sectionParams.personaSimulationsSearch ?? undefined;

  const effectiveOnHeatmapChange = onHeatmapRubricChange ?? setHeatmapRubricIds;
  const effectiveOnHeatmapSearch = onHeatmapRubricSearchChange ?? setHeatmapRubricSearch;
  const effectiveHeatmapSearch = heatmapRubricSearch ?? sectionParams.heatmapRubricSearch ?? undefined;

  const [primaryCarouselIndex, setPrimaryCarouselIndex] = useState(0);
  const [isPrimaryHovered, setIsPrimaryHovered] = useState(false);

  const primaryComponents = useMemo(() => {
    if (!data?.primary_metrics) return [];

    const growthData = data.primary_metrics.growth_data;
    const personaPerformance = data.primary_metrics.persona_performance;
    const rubricHeatmap = data.primary_metrics.rubric_heatmap;

    if (!growthData || !personaPerformance || !rubricHeatmap) return [];

    const normalizedGrowthChartData = (growthData.chart_data || []).map(
      (point) => ({
        date: point.date || "",
        averageScore: point.average_score ?? null,
        completionRate: point.completion_rate ?? null,
        firstAttemptPassRate: point.first_attempt_pass_rate ?? null,
        sessionEfficiency: point.session_efficiency ?? null,
        stagnationRate: point.stagnation_rate ?? null,
      }),
    ) as Array<{
      date: string;
      averageScore: number | null;
      completionRate: number | null;
      firstAttemptPassRate: number | null;
      sessionEfficiency: number | null;
      stagnationRate: number | null;
    }>;

    const normalizedPersonaChartData = (personaPerformance.chart_data || []).map((persona) => ({
      name: persona.name || "",
      score: persona.score ?? 0,
      sessions: persona.sessions ?? 0,
      color: persona.color || "",
      trendData: (persona.trend_data || []).map((td) => ({
        date: td.date || "",
        score: td.score ?? null,
        timestamp: td.timestamp ?? 0,
        simulationId: td.simulation_id || "",
      })),
      simulationIds: persona.simulation_ids || [],
      status: validateStatus(persona.status),
    }));

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

    const normalizedWindowAverages = growthData.window_averages ? {
      averageScore: {
        n: growthData.window_averages.average_score?.n ?? 0,
        last: growthData.window_averages.average_score?.last ?? null,
        prev: growthData.window_averages.average_score?.prev ?? null,
      },
    } : {
      averageScore: {
        n: 0,
        last: null,
        prev: null,
      },
    };

    return [
      <Growth
        key="growth"
        chartData={normalizedGrowthChartData}
        availableMetrics={(growthData.available_metrics || []).map((m) => ({
          id: m.id || "",
          name: m.name || "",
          color: m.color || "",
          unit: m.unit || "",
          description: m.description || "",
          formatterId: (m.formatter_id || "int") as "percent" | "int" | "sec" | "min" | "hours" | "minutes",
        }))}
        windowAverages={normalizedWindowAverages}
        hasDataAvailable={(growthData.chart_data || []).length > 0}
        actionableInsight={data.insights?.growth ?? null}
        status={validateStatus(growthData.status)}
      />,
      <PersonaPerformance
        key="persona-performance"
        chartData={normalizedPersonaChartData}
        simulations={(data.simulations || []).map((s) => ({
          simulation_id: s.simulation_id || "",
          name: s.name || "",
          description: s.description || "",
          department_ids: s.department_ids || null,
          time_limit: s.time_limit ?? null,
        }))}
        validSimulationIds={personaPerformance.valid_simulation_ids || []}
        personaColors={(personaPerformance.persona_colors_junction || []).reduce((acc: Record<string, string>, p: { persona_name?: string | null; color?: string | null }) => {
          if (p.persona_name) {
            acc[p.persona_name] = p.color || "";
          }
          return acc;
        }, {} as Record<string, string>)}
        hasDataAvailable={(personaPerformance.chart_data || []).length > 0}
        {...(data.insights?.persona ? {
          actionableInsights: Object.fromEntries(
            Object.entries(data.insights.persona).map(([k, v]) => {
              const insight = typeof v === "object" && v !== null && "insight" in v ? (v as { insight: string | null }).insight : (typeof v === "string" ? v : null);
              return [k, insight];
            })
          ) as Record<string, string | null>
        } : {})}
        performanceStatus="neutral"
        thresholds={data.thresholds ? {
          success: data.thresholds.success ?? 0,
          warning: data.thresholds.warning ?? 0,
          danger: data.thresholds.danger ?? 0,
        } : { success: 0, warning: 0, danger: 0 }}
        initialSelectedSimulations={initialPersonaSimulations}
        onSimulationSelect={effectiveOnPersonaChange}
        simulationSearchValue={effectivePersonaSearch}
        onSimulationSearchChange={effectiveOnPersonaSearch}
      />,
      <RubricHeatmap
        key="rubric-heatmap"
        matrices={normalizedRubricMatrices}
        rubrics={(data.rubrics || []).filter((r) => r.rubric_id && r.name).map((r) => {
          const rubricId = r.rubric_id;
          const name = r.name;
          if (!rubricId || !name) return null;
          return {
            rubric_id: String(rubricId),
            name: String(name),
            description: r.description || "",
          };
        }).filter((r): r is { rubric_id: string; name: string; description: string } => r !== null)}
        validRubricIds={rubricHeatmap.valid_rubric_ids || []}
        hasDataAvailable={(rubricHeatmap.matrices || []).length > 0}
        actionableInsight={data.insights?.rubric_heatmap ?? null}
        status={validateStatus(rubricHeatmap.status)}
        initialSelectedRubrics={initialHeatmapRubrics}
        onRubricSelect={effectiveOnHeatmapChange}
        rubricSearchValue={effectiveHeatmapSearch}
        onRubricSearchChange={effectiveOnHeatmapSearch}
      />,
    ];
  }, [data, initialPersonaSimulations, effectiveOnPersonaChange, effectivePersonaSearch, effectiveOnPersonaSearch, initialHeatmapRubrics, effectiveOnHeatmapChange, effectiveHeatmapSearch, effectiveOnHeatmapSearch]);

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
