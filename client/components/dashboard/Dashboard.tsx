/**
 * Dashboard.tsx
 * Used to display the main dashboard for the analytics page.
 * Refactored to use single v2 bundle endpoint for optimal performance.
 * @AshokSaravanan222 & @siladiea
 * 10/15/2025
 */
"use client";

import type { DashboardOut } from "@/app/(main)/analytics/dashboard/page";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { HistorySkeleton } from "../common/history/SimulationHistory";
import ScenarioPerformance from "./footer/ScenarioPerformance";
import ScenarioStats from "./footer/ScenarioStats";
import SimulationComposition from "./footer/SimulationComposition";
import SimulationPerformance from "./footer/SimulationPerformance";
import AverageScore from "./header/AverageScore";
import CompletionPercentage from "./header/CompletionPercentage";
import FirstAttemptPassRate from "./header/FirstAttemptPassRate";
import HighestScore from "./header/HighestScore";
import MessagesPerSession from "./header/MessagesPerSession";
import PersonaResponseTimes from "./header/PersonaResponseTimes";
import SessionEfficiency from "./header/SessionEfficiency";
import StagnationRate from "./header/StagnationRate";
import TimeSpent from "./header/TimeSpent";
import TotalAttempts from "./header/TotalAttempts";
import Growth from "./primary/Growth";
import PersonaPerformance from "./primary/PersonaPerformance";
import RubricHeatmap from "./primary/RubricHeatmap";
import AttemptImprovement from "./secondary/AttemptImprovement";
import CohortPerformance from "./secondary/CohortPerformance";
import SkillPerformance from "./secondary/SkillPerformance";

interface DashboardProps {
  profileId?: string;
  dashboardData: DashboardOut;
}

// Helper function to validate and cast status values
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

export default function Dashboard({
  profileId,
  dashboardData,
}: DashboardProps) {
  // Carousel states
  const [headerCarouselIndex, setHeaderCarouselIndex] = useState(0);
  const [primaryCarouselIndex, setPrimaryCarouselIndex] = useState(0);
  const [secondaryCarouselIndex, setSecondaryCarouselIndex] = useState(0);
  const [leftFooterCarouselIndex, setLeftFooterCarouselIndex] = useState(0);
  const [rightFooterCarouselIndex, setRightFooterCarouselIndex] = useState(0);

  // Hover states for arrow visibility
  const [isHeaderHovered, setIsHeaderHovered] = useState(false);
  const [isPrimaryHovered, setIsPrimaryHovered] = useState(false);
  const [isSecondaryHovered, setIsSecondaryHovered] = useState(false);
  const [isLeftFooterHovered, setIsLeftFooterHovered] = useState(false);
  const [isRightFooterHovered, setIsRightFooterHovered] = useState(false);

  const bundle = dashboardData;

  // API returns arrays directly (simulations, rubrics, parameters, fields)
  // Components receive arrays and do lookups internally if needed

  // Get trend analysis from server (computed server-side)
  const trendAnalysis = useMemo(() => {
    if (!bundle) {
      return {
        averageScore: null as string | null,
        completion: null as string | null,
        passRate: null as string | null,
        highestScore: null as string | null,
        messages: null as string | null,
        responseTime: null as string | null,
        sessionEfficiency: null as string | null,
        stagnationRate: null as string | null,
        timeSpent: null as string | null,
        totalAttempts: null as string | null,
      };
    }

    if (!bundle.header_metrics) {
      return {
        averageScore: null as string | null,
        completion: null as string | null,
        passRate: null as string | null,
        highestScore: null as string | null,
        messages: null as string | null,
        responseTime: null as string | null,
        sessionEfficiency: null as string | null,
        stagnationRate: null as string | null,
        timeSpent: null as string | null,
        totalAttempts: null as string | null,
      };
    }

    return {
      averageScore: bundle.header_metrics.average_score?.trend_analysis ?? null,
      completion: bundle.header_metrics.completion_percentage?.trend_analysis ?? null,
      passRate: bundle.header_metrics.first_attempt_pass_rate?.trend_analysis ?? null,
      highestScore: bundle.header_metrics.highest_score?.trend_analysis ?? null,
      messages: bundle.header_metrics.messages_per_session?.trend_analysis ?? null,
      responseTime: bundle.header_metrics.persona_response_times?.trend_analysis ?? null,
      sessionEfficiency: bundle.header_metrics.session_efficiency?.trend_analysis ?? null,
      stagnationRate: bundle.header_metrics.stagnation_rate?.trend_analysis ?? null,
      timeSpent: bundle.header_metrics.time_spent?.trend_analysis ?? null,
      totalAttempts: bundle.header_metrics.total_attempts?.trend_analysis ?? null,
    };
  }, [bundle]);

  // Build header components from bundle data
  const headerComponents = useMemo(() => {
    if (!bundle || !bundle.header_metrics) return [];

    return [
      <AverageScore
        key="average-score"
        averageScore={bundle.header_metrics.average_score?.current_value ?? 0}
        scoreTrend={(bundle.header_metrics.average_score?.trend_data || []).filter((t): t is { date: string; value: number; count: number } => t.date !== null && t.value !== null && t.count !== null).map(t => ({ date: t.date!, value: t.value!, count: t.count! }))}
        hasDataAvailable={bundle.header_metrics.average_score?.has_data ?? false}
        trendAnalysis={trendAnalysis.averageScore}
        status={validateStatus(bundle.header_metrics.average_score?.status)}
      />,
      <CompletionPercentage
        key="completion-percentage"
        completionPercentage={bundle.header_metrics.completion_percentage?.current_value ?? 0}
        completionTrend={(bundle.header_metrics.completion_percentage?.trend_data || []).filter((t): t is { date: string; value: number; count: number } => t.date !== null && t.value !== null && t.count !== null).map(t => ({ date: t.date!, value: t.value!, count: t.count! }))}
        hasDataAvailable={bundle.header_metrics.completion_percentage?.has_data ?? false}
        trendAnalysis={trendAnalysis.completion}
        status={(bundle.header_metrics.completion_percentage?.status ?? "neutral") as "neutral" | "success" | "warning" | "danger"}
      />,
      <FirstAttemptPassRate
        key="first-attempt-pass-rate"
        firstAttemptPassRate={bundle.header_metrics.first_attempt_pass_rate?.current_value ?? 0}
        passRateTrend={(bundle.header_metrics.first_attempt_pass_rate?.trend_data || []).filter((t): t is { date: string; value: number; count: number } => t.date !== null && t.value !== null && t.count !== null).map(t => ({ date: t.date!, value: t.value!, count: t.count! }))}
        hasDataAvailable={bundle.header_metrics.first_attempt_pass_rate?.has_data ?? false}
        trendAnalysis={trendAnalysis.passRate}
        status={(bundle.header_metrics.first_attempt_pass_rate?.status ?? "neutral") as "neutral" | "success" | "warning" | "danger"}
      />,
      <HighestScore
        key="highest-score"
        highestScore={bundle.header_metrics.highest_score?.current_value ?? 0}
        scoreTrend={(bundle.header_metrics.highest_score?.trend_data || []).filter((t): t is { date: string; value: number; count: number } => t.date !== null && t.value !== null && t.count !== null).map(t => ({ date: t.date!, value: t.value!, count: t.count! }))}
        hasDataAvailable={bundle.header_metrics.highest_score?.has_data ?? false}
        trendAnalysis={trendAnalysis.highestScore}
        status={(bundle.header_metrics.highest_score?.status ?? "neutral") as "neutral" | "success" | "warning" | "danger"}
      />,
      <MessagesPerSession
        key="messages-per-session"
        averageMessagesPerSession={
          bundle.header_metrics.messages_per_session?.current_value ?? 0
        }
        messagesTrend={(bundle.header_metrics.messages_per_session?.trend_data || []).filter((t): t is { date: string; value: number; count: number } => t.date !== null && t.value !== null && t.count !== null).map(t => ({ date: t.date!, value: t.value!, count: t.count! }))}
        hasDataAvailable={bundle.header_metrics.messages_per_session?.has_data ?? false}
        trendAnalysis={trendAnalysis.messages}
        status={(bundle.header_metrics.messages_per_session?.status ?? "neutral") as "neutral" | "success" | "warning" | "danger"}
      />,
      <PersonaResponseTimes
        key="persona-response-times"
        averageResponseTime={bundle.header_metrics.persona_response_times?.current_value ?? 0}
        responseTimeTrend={(bundle.header_metrics.persona_response_times?.trend_data || []).filter((t): t is { date: string; value: number; count: number } => t.date !== null && t.value !== null && t.count !== null).map(t => ({ date: t.date!, value: t.value!, count: t.count! }))}
        hasDataAvailable={bundle.header_metrics.persona_response_times?.has_data ?? false}
        trendAnalysis={trendAnalysis.responseTime}
        status={(bundle.header_metrics.persona_response_times?.status ?? "neutral") as "neutral" | "success" | "warning" | "danger"}
      />,
      <SessionEfficiency
        key="session-efficiency"
        sessionEfficiency={bundle.header_metrics.session_efficiency?.current_value ?? 0}
        efficiencyTrend={(bundle.header_metrics.session_efficiency?.trend_data || []).filter((t): t is { date: string; value: number; count: number } => t.date !== null && t.value !== null && t.count !== null).map(t => ({ date: t.date!, value: t.value!, count: t.count! }))}
        hasDataAvailable={bundle.header_metrics.session_efficiency?.has_data ?? false}
        trendAnalysis={trendAnalysis.sessionEfficiency}
        status={(bundle.header_metrics.session_efficiency?.status ?? "neutral") as "neutral" | "success" | "warning" | "danger"}
      />,
      <StagnationRate
        key="stagnation-rate"
        stagnationRate={bundle.header_metrics.stagnation_rate?.current_value ?? 0}
        stagnationTrend={(bundle.header_metrics.stagnation_rate?.trend_data || []).filter((t): t is { date: string; value: number; count: number } => t.date !== null && t.value !== null && t.count !== null).map(t => ({ date: t.date!, value: t.value!, count: t.count! }))}
        hasDataAvailable={bundle.header_metrics.stagnation_rate?.has_data ?? false}
        trendAnalysis={trendAnalysis.stagnationRate}
        status={(bundle.header_metrics.stagnation_rate?.status ?? "neutral") as "neutral" | "success" | "warning" | "danger"}
      />,
      <TimeSpent
        key="time-spent"
        totalTimeSpent={(bundle.header_metrics.time_spent?.current_value ?? 0) * 60}
        timeSpentTrend={(bundle.header_metrics.time_spent?.trend_data || []).filter((t): t is { date: string; value: number; count: number } => t.date !== null && t.value !== null && t.count !== null).map(t => ({ date: t.date!, value: Math.round(t.value! * 60), count: t.count! }))}
        hasDataAvailable={bundle.header_metrics.time_spent?.has_data ?? false}
        trendAnalysis={trendAnalysis.timeSpent}
        status={(bundle.header_metrics.time_spent?.status ?? "neutral") as "neutral" | "success" | "warning" | "danger"}
      />,
      <TotalAttempts
        key="total-attempts"
        totalAttempts={bundle.header_metrics.total_attempts?.current_value ?? 0}
        attemptsTrend={(bundle.header_metrics.total_attempts?.trend_data || []).filter((t): t is { date: string; value: number; count: number } => t.date !== null && t.value !== null && t.count !== null).map(t => ({ date: t.date!, value: t.value!, count: t.count! }))}
        hasDataAvailable={bundle.header_metrics.total_attempts?.has_data ?? false}
        trendAnalysis={trendAnalysis.totalAttempts}
        status={(bundle.header_metrics.total_attempts?.status ?? "neutral") as "neutral" | "success" | "warning" | "danger"}
      />,
    ];
  }, [bundle, trendAnalysis]);

  // Build primary components from bundle data
  const primaryComponents = useMemo(() => {
    if (!bundle || !bundle.primary_metrics) return [];

    const growthData = bundle.primary_metrics.growth_data;
    const personaPerformance = bundle.primary_metrics.persona_performance;
    const rubricHeatmap = bundle.primary_metrics.rubric_heatmap;

    if (!growthData || !personaPerformance || !rubricHeatmap) return [];

    // Normalize Growth chartData to ensure all required fields are present
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

    // Normalize PersonaPerformance chartData to ensure score is always present
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

    // Normalize RubricHeatmap matrices to ensure required fields
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

    // Normalize windowAverages to ensure last and prev are always present
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
        actionableInsight={bundle.insights?.growth ?? null}
        status={validateStatus(growthData.status)}
      />,
      <PersonaPerformance
        key="persona-performance"
        chartData={normalizedPersonaChartData}
        simulations={(bundle.simulations || []).map((s) => ({
          simulation_id: s.simulation_id || "",
          name: s.name || "",
          description: s.description || "",
          department_ids: s.department_ids || null,
          time_limit: s.time_limit ?? null,
        }))}
        validSimulationIds={personaPerformance.valid_simulation_ids || []}
        personaColors={(personaPerformance.persona_colors || []).reduce((acc, p) => {
          if (p.persona_name) {
            acc[p.persona_name] = p.color || "";
          }
          return acc;
        }, {} as Record<string, string>)}
        hasDataAvailable={(personaPerformance.chart_data || []).length > 0}
        {...(bundle.insights?.persona ? {
          actionableInsights: Object.fromEntries(
            Object.entries(bundle.insights.persona).map(([k, v]) => {
              const insight = typeof v === "object" && v !== null && "insight" in v ? (v as { insight: string | null }).insight : (typeof v === "string" ? v : null);
              return [k, insight];
            })
          ) as Record<string, string | null>
        } : {})}
        performanceStatus="neutral"
        thresholds={bundle.thresholds ? {
          success: bundle.thresholds.success ?? 0,
          warning: bundle.thresholds.warning ?? 0,
          danger: bundle.thresholds.danger ?? 0,
        } : { success: 0, warning: 0, danger: 0 }}
      />,
      <RubricHeatmap
        key="rubric-heatmap"
        matrices={normalizedRubricMatrices}
        rubrics={(bundle.rubrics || []).filter((r) => r.rubric_id && r.name).map((r) => {
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
        actionableInsight={bundle.insights?.rubric_heatmap ?? null}
        status={validateStatus(rubricHeatmap.status)}
      />,
    ];
  }, [bundle]);

  // Build secondary components from bundle data
  const secondaryComponents = useMemo(() => {
    if (!bundle || !bundle.secondary_metrics) return [];

    const cohortPerformance = bundle.secondary_metrics.cohort_performance;
    const attemptImprovement = bundle.secondary_metrics.attempt_improvement;
    const skillPerformance = bundle.secondary_metrics.skill_performance;

    if (!cohortPerformance || !attemptImprovement || !skillPerformance) return [];

    // Normalize CohortPerformance dailyData to convert null to undefined
    const normalizedDailyData = (cohortPerformance.daily_data || []).map((d) => ({
      date: d.date,
      avgScore: d.avg_score,
      cohortId: d.cohort_id ?? undefined,
    }));

    // Normalize SkillPerformance packages to convert null to undefined
    const normalizedSkillPackages = (skillPerformance.packages || []).map((pkg) => ({
      rubric_id: pkg.rubric_id,
      radar_data: pkg.radar_data,
      group_facts: pkg.group_facts,
    }));

    return [
      <CohortPerformance
        key="cohort-performance"
        cohortData={(cohortPerformance.cohort_data || []).map((c) => ({
          id: c.id || "",
          name: c.name || "",
          passRate: c.pass_rate ?? 0,
          avgPercentageScore: c.avg_percentage_score ?? 0,
          totalStudents: c.total_students ?? 0,
          passedStudents: c.passed_students ?? 0,
          totalAttempts: c.total_attempts ?? 0,
          passedAttempts: c.passed_attempts ?? 0,
          simulationCount: c.simulation_count ?? 0,
          requiredSimulations: c.required_simulations ?? 0,
          status: validateStatus(c.status),
        }))}
        dailyData={normalizedDailyData.map((d) => ({
          date: d.date || "",
          avgScore: d.avgScore ?? 0,
          cohortId: d.cohortId,
        }))}
        cohortFacts={(cohortPerformance.cohort_facts || []).map((f) => ({
          cohortId: f.cohort_id || "",
          simulationId: f.simulation_id || "",
          passRate: f.pass_rate ?? 0,
          avgScore: f.avg_score ?? 0,
          attempts: f.attempts ?? 0,
        }))}
        dailyFacts={(cohortPerformance.daily_facts || []).map((f) => ({
          date: f.date || "",
          simulationId: f.simulation_id || "",
          avgScore: f.avg_score ?? 0,
        }))}
        simulations={(bundle.simulations || []).map((s) => ({
          simulation_id: s.simulation_id || "",
          name: s.name || "",
          description: s.description || "",
          department_ids: s.department_ids || null,
          time_limit: s.time_limit ?? null,
        }))}
        validSimulationIds={cohortPerformance.valid_simulation_ids || []}
        profileId={profileId}
        {...(bundle.insights?.cohort ? {
          actionableInsights: Object.fromEntries(
            Object.entries(bundle.insights.cohort).map(([k, v]) => {
              const insight = typeof v === "object" && v !== null && "insight" in v ? (v as { insight: string | null }).insight : (typeof v === "string" ? v : null);
              return [k, insight];
            })
          ) as Record<string, string | null>
        } : {})}
        status={validateStatus(cohortPerformance.status)}
      />,
      <AttemptImprovement
        key="attempt-improvement"
        chartData={(attemptImprovement.chart_data || []).map((d) => ({
          attempt: d.attempt || "",
          average_score: d.average_score ?? 0,
          average_time: d.average_time ?? 0,
          pass_rate: d.pass_rate ?? 0,
        }))}
        facts={(attemptImprovement.facts || []).map((f) => ({
          simulationId: f.simulation_id || "",
          attemptNo: f.attempt_no ?? 0,
          avgGrade: f.avg_grade ?? 0,
          avgMinutes: f.avg_minutes ?? 0,
          passRate: f.pass_rate ?? 0,
        }))}
        simulations={(bundle.simulations || []).map((s) => ({
          simulation_id: s.simulation_id || "",
          name: s.name || "",
          description: s.description || "",
        }))}
        validSimulationIds={attemptImprovement.valid_simulation_ids || []}
        actionableInsight={bundle.insights?.attempt_improvement ?? null}
        status={validateStatus(attemptImprovement.status)}
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
        rubrics={(bundle.rubrics || []).filter((r) => r.rubric_id && r.name).map((r) => {
          const rubricId = r.rubric_id;
          const name = r.name;
          if (!rubricId || !name) return null;
          return {
            rubric_id: String(rubricId),
            name: String(name),
            description: r.description || "",
          };
        }).filter((r): r is { rubric_id: string; name: string; description: string } => r !== null)}
        validRubricIds={skillPerformance.valid_rubric_ids || []}
        actionableInsight={bundle.insights?.skill_performance ?? null}
        status={validateStatus(skillPerformance.status)}
      />,
    ];
  }, [bundle, profileId]);

  // Build footer components from bundle data
  const leftFooterComponents = useMemo(() => {
    if (!bundle || !bundle.footer_metrics) return [];

    const scenarioPerformance = bundle.footer_metrics.scenario_performance;
    const scenarioStats = bundle.footer_metrics.scenario_stats;

    if (!scenarioPerformance || !scenarioStats) return [];

    return [
      <ScenarioPerformance
        key="scenario-performance"
        attributeAttemptFacts={(scenarioPerformance.attribute_attempt_facts || []).map((f) => ({
          parameterId: f.parameter_id || "",
          parameterItemId: f.parameter_item_id || "",
          date: f.date || "",
          timestamp: f.timestamp ?? 0,
          avgScore: f.avg_score ?? 0,
          attempts: f.attempts ?? 0,
          passedAttempts: f.passed_attempts ?? 0,
        }))}
        attributeScenarioFacts={(scenarioPerformance.attribute_scenario_facts || []).map((f) => ({
          parameterId: f.parameter_id || "",
          parameterItemId: f.parameter_item_id || "",
          scenarioId: f.scenario_id || "",
        }))}
        parameters={(bundle.parameters || []).map((p) => ({
          parameter_id: p.parameter_id || "",
          name: p.name || "",
          description: p.description || "",
          numerical: p.numerical ?? false,
          document_parameter: p.document_parameter ?? false,
          persona_parameter: p.persona_parameter ?? false,
        }))}
        fields={(bundle.fields || []).map((f) => ({
          field_id: f.field_id || "",
          name: f.name || "",
          description: f.description || "",
          parameter_id: f.parameter_id || "",
          parameter_name: f.parameter_name || "",
        }))}
        validParameterIds={scenarioPerformance.valid_parameter_ids || []}
        actionableInsight={bundle.insights?.scenario_performance ?? null}
        status={validateStatus(scenarioPerformance.status)}
      />,
      <ScenarioStats
        key="scenario-stats"
        numericAttemptFacts={(scenarioStats.numeric_attempt_facts || []).map((f) => ({
          parameterId: f.parameter_id || "",
          levelLabel: f.level_label || "",
          levelValue: f.level_value ?? 0,
          score: f.score ?? 0,
          attempts: f.attempts ?? 0,
        }))}
        numericScenarioFacts={(scenarioStats.numeric_scenario_facts || []).map((f) => ({
          parameterId: f.parameter_id || "",
          scenarioId: f.scenario_id || "",
          levelLabel: f.level_label || "",
          levelValue: f.level_value ?? 0,
        }))}
        parameters={(bundle.parameters || []).map((p) => ({
          parameter_id: p.parameter_id || "",
          name: p.name || "",
          description: p.description || "",
          numerical: p.numerical ?? false,
          document_parameter: p.document_parameter ?? false,
          persona_parameter: p.persona_parameter ?? false,
        }))}
        validNumericParameterIds={scenarioStats.valid_numeric_parameter_ids || []}
        actionableInsight={bundle.insights?.scenario_stats ?? null}
        status={validateStatus(scenarioStats.status)}
      />,
    ];
  }, [bundle]);

  const rightFooterComponents = useMemo(() => {
    if (!bundle || !bundle.footer_metrics) return [];

    const simulationPerformance = bundle.footer_metrics.simulation_performance;
    const simulationComposition = bundle.footer_metrics.simulation_composition;

    if (!simulationPerformance || !simulationComposition) return [];

    return [
      <SimulationPerformance
        key="simulation-performance"
        validSimulationIds={simulationPerformance.valid_simulation_ids || []}
        scenarioFacts={(simulationPerformance.scenario_facts || []).map((f) => ({
          simulationId: f.simulation_id || "",
          scenarioId: f.scenario_id || "",
          scenarioName: f.scenario_name || "",
          avgScore: f.avg_score ?? 0,
          successRate: f.success_rate ?? 0,
          totalAttempts: f.total_attempts ?? 0,
          completedAttempts: f.completed_attempts ?? 0,
        }))}
        simulations={(bundle.simulations || []).map((s) => ({
          simulation_id: s.simulation_id || "",
          name: s.name || "",
          description: s.description || "",
        }))}
        actionableInsight={bundle.insights?.simulation_performance ?? null}
        status={validateStatus(simulationPerformance.status)}
      />,
      <SimulationComposition
        key="simulation-composition"
        simulationFacts={(simulationComposition.simulation_facts || []).map((f) => ({
          simulationId: f.simulation_id || "",
          title: f.title || "",
          avgScore: f.avg_score ?? 0,
          completionRate: f.completion_rate ?? 0,
          totalAttempts: f.total_attempts ?? 0,
          scenarioCount: f.scenario_count ?? 0,
        }))}
        simulationParameterFactsCategorical={
          (simulationComposition.simulation_parameter_facts_categorical || []).map((f) => ({
            simulationId: f.simulation_id || "",
            parameterId: f.parameter_id || "",
            parameterItemId: f.parameter_item_id || "",
            scenarioCount: f.scenario_count ?? 0,
          }))
        }
        simulationParameterFactsNumeric={
          (simulationComposition.simulation_parameter_facts_numeric || []).map((f) => ({
            simulationId: f.simulation_id || "",
            parameterId: f.parameter_id || "",
            avgLevel: f.avg_level ?? 0,
            levelLabel: f.level_label || "",
            scenarioCount: f.scenario_count ?? 0,
          }))
        }
        simulations={(bundle.simulations || []).map((s) => ({
          simulation_id: s.simulation_id || "",
          name: s.name || "",
          description: s.description || "",
        }))}
        parameters={(bundle.parameters || []).map((p) => ({
          parameter_id: p.parameter_id || "",
          name: p.name || "",
          description: p.description || "",
          numerical: p.numerical ?? false,
          document_parameter: p.document_parameter ?? false,
          persona_parameter: p.persona_parameter ?? false,
        }))}
        fields={(bundle.fields || []).map((f) => ({
          field_id: f.field_id || "",
          name: f.name || "",
          description: f.description || "",
          parameter_id: f.parameter_id || "",
          parameter_name: f.parameter_name || "",
        }))}
        validSimulationIds={simulationComposition.valid_simulation_ids || []}
        actionableInsight={bundle.insights?.simulation_composition ?? null}
        status={validateStatus(simulationComposition.status)}
      />,
    ];
  }, [bundle]);

  // Header pagination logic - responsive cards per page
  // Mobile: 2 cards per page, Desktop: 5 cards per page
  const HEADER_CARDS_PER_PAGE_MOBILE = 2;
  const HEADER_CARDS_PER_PAGE_DESKTOP = 5;

  // Use a state to track window size for responsive behavior
  const [isMobile, setIsMobile] = useState(false);

  // Check window size on mount and resize
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024); // lg breakpoint
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const headerCardsPerPage = isMobile
    ? HEADER_CARDS_PER_PAGE_MOBILE
    : HEADER_CARDS_PER_PAGE_DESKTOP;

  // Reset carousel index when switching between mobile/desktop to prevent out-of-bounds
  useEffect(() => {
    const maxPages = Math.ceil(headerComponents.length / headerCardsPerPage);
    if (headerCarouselIndex >= maxPages) {
      setHeaderCarouselIndex(0);
    }
  }, [
    isMobile,
    headerComponents.length,
    headerCardsPerPage,
    headerCarouselIndex,
  ]);

  const totalHeaderPages = Math.ceil(
    headerComponents.length / headerCardsPerPage,
  );

  const getVisibleHeaderComponents = () => {
    const startIndex = headerCarouselIndex * headerCardsPerPage;
    return headerComponents.slice(startIndex, startIndex + headerCardsPerPage);
  };

  // Navigation functions
  const navigateHeader = (direction: "prev" | "next") => {
    if (direction === "prev") {
      setHeaderCarouselIndex(
        (prev: number) => (prev - 1 + totalHeaderPages) % totalHeaderPages,
      );
    } else {
      setHeaderCarouselIndex((prev: number) => (prev + 1) % totalHeaderPages);
    }
  };

  const navigatePrimary = (direction: "prev" | "next") => {
    const length = primaryComponents.length;
    if (length === 0) return;

    if (direction === "prev") {
      setPrimaryCarouselIndex((prev: number) => (prev - 1 + length) % length);
    } else {
      setPrimaryCarouselIndex((prev: number) => (prev + 1) % length);
    }
  };

  const navigateSecondary = (direction: "prev" | "next") => {
    const length = secondaryComponents.length;
    if (length === 0) return;

    if (direction === "prev") {
      setSecondaryCarouselIndex((prev: number) => (prev - 1 + length) % length);
    } else {
      setSecondaryCarouselIndex((prev: number) => (prev + 1) % length);
    }
  };

  const navigateLeftFooter = (direction: "prev" | "next") => {
    const length = leftFooterComponents.length;
    if (length === 0) return;

    if (direction === "prev") {
      setLeftFooterCarouselIndex(
        (prev: number) => (prev - 1 + length) % length,
      );
    } else {
      setLeftFooterCarouselIndex((prev: number) => (prev + 1) % length);
    }
  };

  const navigateRightFooter = (direction: "prev" | "next") => {
    const length = rightFooterComponents.length;
    if (length === 0) return;

    if (direction === "prev") {
      setRightFooterCarouselIndex(
        (prev: number) => (prev - 1 + length) % length,
      );
    } else {
      setRightFooterCarouselIndex((prev: number) => (prev + 1) % length);
    }
  };

  // Show no data state
  if (!bundle) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">No dashboard data available</div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="dashboard-container">
      {/* Header Metrics with Dynamic Pagination */}
      {headerComponents.length > 0 && (
        <div className="space-y-4">
          <div
            className="relative group"
            onMouseEnter={() => setIsHeaderHovered(true)}
            onMouseLeave={() => setIsHeaderHovered(false)}
          >
            <div
              className="grid gap-4"
              style={{
                gridTemplateColumns: `repeat(${Math.min(headerCardsPerPage, headerComponents.length)}, 1fr)`,
                gridAutoRows: "1fr",
              }}
            >
              {getVisibleHeaderComponents().map((component, index) => (
                <div
                  key={`header-${headerCarouselIndex}-${index}`}
                  className="transition-all duration-500 ease-in-out"
                >
                  {component}
                </div>
              ))}
            </div>

            {/* Header Navigation Arrows */}
            {totalHeaderPages > 1 && (
              <>
                <Button
                  variant="secondary"
                  size="icon"
                  className={`absolute left-4 top-1/2 -translate-y-1/2 z-10 transition-opacity duration-200 ${
                    isHeaderHovered ? "opacity-100" : "opacity-0"
                  } hover:opacity-100`}
                  onClick={() => navigateHeader("prev")}
                  data-testid="dashboard-header-carousel-prev"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="secondary"
                  size="icon"
                  className={`absolute right-4 top-1/2 -translate-y-1/2 z-10 transition-opacity duration-200 ${
                    isHeaderHovered ? "opacity-100" : "opacity-0"
                  } hover:opacity-100`}
                  onClick={() => navigateHeader("next")}
                  data-testid="dashboard-header-carousel-next"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>

          {/* Header carousel indicators */}
          {totalHeaderPages > 1 && (
            <div className="flex justify-center gap-2">
              {Array.from({ length: totalHeaderPages }, (_, index) => (
                <button
                  key={index}
                  onClick={() => setHeaderCarouselIndex(index)}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    index === headerCarouselIndex ? "bg-primary" : "bg-muted"
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Main Content Section with Responsive Layout */}
      {(primaryComponents.length > 0 || secondaryComponents.length > 0) && (
        <div
          className="grid gap-6 grid-cols-1 lg:grid-cols-[3fr_2fr] pb-2 items-stretch"
          style={{ gridAutoRows: "1fr" }}
        >
          {/* Primary Section */}
          {primaryComponents.length > 0 && (
            <div className="flex flex-col space-y-4">
              <div
                className="relative group min-h-[500px] max-h-[500px]"
                onMouseEnter={() => setIsPrimaryHovered(true)}
                onMouseLeave={() => setIsPrimaryHovered(false)}
              >
                <div className="transition-all duration-300 ease-in-out h-full">
                  <div className="h-full">
                    {primaryComponents.length > 0 &&
                      primaryComponents[
                        primaryCarouselIndex % primaryComponents.length
                      ]}
                  </div>
                </div>

                {/* Primary Navigation Arrows */}
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

              {/* Primary carousel indicators */}
              {primaryComponents.length > 1 && (
                <div className="flex justify-center gap-2">
                  {primaryComponents.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setPrimaryCarouselIndex(index)}
                      className={`w-2 h-2 rounded-full transition-colors ${
                        index === primaryCarouselIndex
                          ? "bg-primary"
                          : "bg-muted"
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Secondary Section */}
          {secondaryComponents.length > 0 && (
            <div className="flex flex-col space-y-4">
              <div
                className="relative group min-h-[500px] max-h-[500px]"
                onMouseEnter={() => setIsSecondaryHovered(true)}
                onMouseLeave={() => setIsSecondaryHovered(false)}
              >
                <div className="transition-all duration-300 ease-in-out h-full">
                  <div className="h-full">
                    {secondaryComponents.length > 0 &&
                      secondaryComponents[
                        secondaryCarouselIndex % secondaryComponents.length
                      ]}
                  </div>
                </div>

                {/* Secondary Navigation Arrows */}
                {secondaryComponents.length > 1 && (
                  <>
                    <Button
                      variant="secondary"
                      size="icon"
                      className={`absolute left-4 top-1/2 -translate-y-1/2 z-10 transition-opacity duration-200 ${
                        isSecondaryHovered ? "opacity-100" : "opacity-0"
                      } hover:opacity-100`}
                      onClick={() => navigateSecondary("prev")}
                      data-testid="dashboard-secondary-carousel-prev"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="secondary"
                      size="icon"
                      className={`absolute right-4 top-1/2 -translate-y-1/2 z-10 transition-opacity duration-200 ${
                        isSecondaryHovered ? "opacity-100" : "opacity-0"
                      } hover:opacity-100`}
                      onClick={() => navigateSecondary("next")}
                      data-testid="dashboard-secondary-carousel-next"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>

              {/* Secondary carousel indicators */}
              {secondaryComponents.length > 1 && (
                <div className="flex justify-center gap-2">
                  {secondaryComponents.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setSecondaryCarouselIndex(index)}
                      className={`w-2 h-2 rounded-full transition-colors ${
                        index === secondaryCarouselIndex
                          ? "bg-primary"
                          : "bg-muted"
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Footer Section with Dynamic Column Count */}
      {[leftFooterComponents, rightFooterComponents].filter((c) => c.length > 0)
        .length > 0 && (
        <div className="pb-8">
          <div className="grid gap-6 items-stretch grid-cols-1 lg:grid-cols-2">
            {/* Left Footer Section */}
            {leftFooterComponents.length > 0 && (
              <div className="flex flex-col space-y-4">
                <div
                  className="relative group min-h-[500px] max-h-[500px]"
                  onMouseEnter={() => setIsLeftFooterHovered(true)}
                  onMouseLeave={() => setIsLeftFooterHovered(false)}
                >
                  <div className="transition-all duration-300 ease-in-out h-full">
                    <div className="h-full">
                      {leftFooterComponents.length > 0 &&
                        leftFooterComponents[
                          leftFooterCarouselIndex % leftFooterComponents.length
                        ]}
                    </div>
                  </div>

                  {/* Left Footer Navigation Arrows */}
                  {leftFooterComponents.length > 1 && (
                    <>
                      <Button
                        variant="secondary"
                        size="icon"
                        className={`absolute left-4 top-1/2 -translate-y-1/2 z-10 transition-opacity duration-200 ${
                          isLeftFooterHovered ? "opacity-100" : "opacity-0"
                        } hover:opacity-100`}
                        onClick={() => navigateLeftFooter("prev")}
                        data-testid="dashboard-left-footer-carousel-prev"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="secondary"
                        size="icon"
                        className={`absolute right-4 top-1/2 -translate-y-1/2 z-10 transition-opacity duration-200 ${
                          isLeftFooterHovered ? "opacity-100" : "opacity-0"
                        } hover:opacity-100`}
                        onClick={() => navigateLeftFooter("next")}
                        data-testid="dashboard-left-footer-carousel-next"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>

                {/* Left footer carousel indicators */}
                {leftFooterComponents.length > 1 && (
                  <div className="flex justify-center gap-2">
                    {leftFooterComponents.map((_, index) => (
                      <button
                        key={index}
                        onClick={() => setLeftFooterCarouselIndex(index)}
                        className={`w-2 h-2 rounded-full transition-colors ${
                          index === leftFooterCarouselIndex
                            ? "bg-primary"
                            : "bg-muted"
                        }`}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Right Footer Section */}
            {rightFooterComponents.length > 0 && (
              <div className="flex flex-col space-y-4">
                <div
                  className="relative group min-h-[500px] max-h-[500px]"
                  onMouseEnter={() => setIsRightFooterHovered(true)}
                  onMouseLeave={() => setIsRightFooterHovered(false)}
                >
                  <div className="transition-all duration-300 ease-in-out h-full">
                    <div className="h-full">
                      {rightFooterComponents.length > 0 &&
                        rightFooterComponents[
                          rightFooterCarouselIndex %
                            rightFooterComponents.length
                        ]}
                    </div>
                  </div>

                  {/* Right Footer Navigation Arrows */}
                  {rightFooterComponents.length > 1 && (
                    <>
                      <Button
                        variant="secondary"
                        size="icon"
                        className={`absolute left-4 top-1/2 -translate-y-1/2 z-10 transition-opacity duration-200 ${
                          isRightFooterHovered ? "opacity-100" : "opacity-0"
                        } hover:opacity-100`}
                        onClick={() => navigateRightFooter("prev")}
                        data-testid="dashboard-right-footer-carousel-prev"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="secondary"
                        size="icon"
                        className={`absolute right-4 top-1/2 -translate-y-1/2 z-10 transition-opacity duration-200 ${
                          isRightFooterHovered ? "opacity-100" : "opacity-0"
                        } hover:opacity-100`}
                        onClick={() => navigateRightFooter("next")}
                        data-testid="dashboard-right-footer-carousel-next"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>

                {/* Right footer carousel indicators */}
                {rightFooterComponents.length > 1 && (
                  <div className="flex justify-center gap-2">
                    {rightFooterComponents.map((_, index) => (
                      <button
                        key={index}
                        onClick={() => setRightFooterCarouselIndex(index)}
                        className={`w-2 h-2 rounded-full transition-colors ${
                          index === rightFooterCarouselIndex
                            ? "bg-primary"
                            : "bg-muted"
                        }`}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function DashboardSkeleton() {
  const HEADER_CARD_COUNT = 5;
  const HISTORY_ROWS = 8;

  return (
    <div className="space-y-6">
      {/* Header metrics carousel */}
      <section className="space-y-4">
        <div
          className="grid gap-4"
          style={{
            gridTemplateColumns: `repeat(${HEADER_CARD_COUNT}, minmax(0, 1fr))`,
            gridAutoRows: "1fr",
          }}
        >
          {Array.from({ length: HEADER_CARD_COUNT }).map((_, index) => (
            <Card key={`header-card-${index}`} className="flex flex-col h-full">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-4 rounded-full" />
              </CardHeader>
              <CardContent className="flex-1 flex flex-col justify-center">
                <Skeleton className="h-8 w-20" />
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex justify-center gap-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton
              key={`header-indicator-${index}`}
              className={`h-2 rounded-full ${index === 0 ? "w-6" : "w-2"}`}
            />
          ))}
        </div>
      </section>

      {/* Main content (primary + secondary carousels) */}
      <section className="grid gap-6 grid-cols-1 lg:grid-cols-[3fr_2fr] pb-2 items-stretch">
        {[0, 1].map((column) => (
          <div
            key={`main-column-${column}`}
            className="flex flex-col space-y-4"
          >
            <Card className="min-h-[500px] max-h-[500px]">
              <CardHeader className="space-y-2">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-72 w-full rounded-2xl" />
              </CardContent>
            </Card>

            <div className="flex justify-center gap-2">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton
                  key={`main-indicator-${column}-${index}`}
                  className={`h-2 rounded-full ${index === 0 ? "w-6" : "w-2"}`}
                />
              ))}
            </div>
          </div>
        ))}
      </section>

      {/* Footer carousels */}
      <section className="pb-8">
        <div className="grid gap-6 items-stretch grid-cols-1 lg:grid-cols-2">
          {[0, 1].map((column) => (
            <div
              key={`footer-column-${column}`}
              className="flex flex-col space-y-4"
            >
              <Card className="min-h-[500px] max-h-[500px]">
                <CardHeader className="space-y-2">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-4 w-28" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-64 w-full rounded-xl" />
                </CardContent>
              </Card>

              <div className="flex justify-center gap-2">
                {Array.from({ length: 2 }).map((_, index) => (
                  <Skeleton
                    key={`footer-indicator-${column}-${index}`}
                    className={`h-2 rounded-full ${index === 0 ? "w-6" : "w-2"}`}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Simulation history */}
      <section className="space-y-4">
        <HistorySkeleton rows={HISTORY_ROWS} />
      </section>
    </div>
  );
}
