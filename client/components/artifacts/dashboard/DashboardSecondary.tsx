"use client";

import type { OutputOf } from "@/lib/api/types";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";

import { useDashboardSectionParams } from "@/hooks/use-dashboard-section-params";

import AttemptImprovement from "./secondary/AttemptImprovement";
import CohortPerformance from "./secondary/CohortPerformance";
import SkillPerformance from "./secondary/SkillPerformance";

export type SecondaryOut = OutputOf<"/api/v4/artifacts/dashboard/secondary", "post">;

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

export interface DashboardSecondaryProps {
  data: SecondaryOut;
  profileId?: string | undefined;
  initialCohortSimulations?: string[] | undefined;
  onCohortSimulationChange?: ((ids: string[]) => void) | undefined;
  cohortSimulationsSearch?: string | undefined;
  onCohortSimulationsSearchChange?: ((term: string) => void) | undefined;
  initialImprovementSimulations?: string[] | undefined;
  onImprovementSimulationChange?: ((ids: string[]) => void) | undefined;
  improvementSimulationsSearch?: string | undefined;
  onImprovementSimulationsSearchChange?: ((term: string) => void) | undefined;
  initialSkillRubrics?: string[] | undefined;
  onSkillRubricChange?: ((ids: string[]) => void) | undefined;
  skillRubricSearch?: string | undefined;
  onSkillRubricSearchChange?: ((term: string) => void) | undefined;
}

export default function DashboardSecondary({
  data,
  profileId,
  initialCohortSimulations,
  onCohortSimulationChange,
  cohortSimulationsSearch,
  onCohortSimulationsSearchChange,
  initialImprovementSimulations,
  onImprovementSimulationChange,
  improvementSimulationsSearch,
  onImprovementSimulationsSearchChange,
  initialSkillRubrics,
  onSkillRubricChange,
  skillRubricSearch,
  onSkillRubricSearchChange,
}: DashboardSecondaryProps) {
  const {
    params: sectionParams,
    setCohortSimulationIds,
    setCohortSimulationsSearch,
    setImprovementSimulationIds,
    setImprovementSimulationsSearch,
    setSkillRubricIds,
    setSkillRubricSearch,
  } = useDashboardSectionParams();

  const effectiveOnCohortChange = onCohortSimulationChange ?? setCohortSimulationIds;
  const effectiveOnCohortSearch = onCohortSimulationsSearchChange ?? setCohortSimulationsSearch;
  const effectiveCohortSearch = cohortSimulationsSearch ?? sectionParams.cohortSimulationsSearch ?? undefined;

  const effectiveOnImprovementChange = onImprovementSimulationChange ?? setImprovementSimulationIds;
  const effectiveOnImprovementSearch = onImprovementSimulationsSearchChange ?? setImprovementSimulationsSearch;
  const effectiveImprovementSearch = improvementSimulationsSearch ?? sectionParams.improvementSimulationsSearch ?? undefined;

  const effectiveOnSkillChange = onSkillRubricChange ?? setSkillRubricIds;
  const effectiveOnSkillSearch = onSkillRubricSearchChange ?? setSkillRubricSearch;
  const effectiveSkillSearch = skillRubricSearch ?? sectionParams.skillRubricSearch ?? undefined;

  const [secondaryCarouselIndex, setSecondaryCarouselIndex] = useState(0);
  const [isSecondaryHovered, setIsSecondaryHovered] = useState(false);

  const secondaryComponents = useMemo(() => {
    if (!data?.secondary_metrics) return [];

    const cohortPerformance = data.secondary_metrics.cohort_performance;
    const attemptImprovement = data.secondary_metrics.attempt_improvement;
    const skillPerformance = data.secondary_metrics.skill_performance;

    if (!cohortPerformance || !attemptImprovement || !skillPerformance) return [];

    const normalizedDailyData = (cohortPerformance.daily_data || []).map((d) => ({
      date: d.date,
      avgScore: d.avg_score,
      cohortId: d.cohort_id ?? undefined,
    }));

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
        simulations={(data.simulations || []).map((s) => ({
          simulation_id: s.simulation_id || "",
          name: s.name || "",
          description: s.description || "",
          department_ids: s.department_ids || null,
          time_limit: s.time_limit ?? null,
        }))}
        validSimulationIds={cohortPerformance.valid_simulation_ids || []}
        profileId={profileId}
        {...(data.insights?.cohort ? {
          actionableInsights: Object.fromEntries(
            Object.entries(data.insights.cohort).map(([k, v]) => {
              const insight = typeof v === "object" && v !== null && "insight" in v ? (v as { insight: string | null }).insight : (typeof v === "string" ? v : null);
              return [k, insight];
            })
          ) as Record<string, string | null>
        } : {})}
        status={validateStatus(cohortPerformance.status)}
        initialSelectedSimulations={initialCohortSimulations}
        onSimulationSelect={effectiveOnCohortChange}
        simulationSearchValue={effectiveCohortSearch}
        onSimulationSearchChange={effectiveOnCohortSearch}
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
        simulations={(data.simulations || []).map((s) => ({
          simulation_id: s.simulation_id || "",
          name: s.name || "",
          description: s.description || "",
        }))}
        validSimulationIds={attemptImprovement.valid_simulation_ids || []}
        actionableInsight={data.insights?.attempt_improvement ?? null}
        status={validateStatus(attemptImprovement.status)}
        initialSelectedSimulations={initialImprovementSimulations}
        onSimulationSelect={effectiveOnImprovementChange}
        simulationSearchValue={effectiveImprovementSearch}
        onSimulationSearchChange={effectiveOnImprovementSearch}
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
        validRubricIds={skillPerformance.valid_rubric_ids || []}
        actionableInsight={data.insights?.skill_performance ?? null}
        status={validateStatus(skillPerformance.status)}
        initialSelectedRubrics={initialSkillRubrics}
        onRubricSelect={effectiveOnSkillChange}
        rubricSearchValue={effectiveSkillSearch}
        onRubricSearchChange={effectiveOnSkillSearch}
      />,
    ];
  }, [data, profileId, initialCohortSimulations, effectiveOnCohortChange, effectiveCohortSearch, effectiveOnCohortSearch, initialImprovementSimulations, effectiveOnImprovementChange, effectiveImprovementSearch, effectiveOnImprovementSearch, initialSkillRubrics, effectiveOnSkillChange, effectiveSkillSearch, effectiveOnSkillSearch]);

  const navigateSecondary = (direction: "prev" | "next") => {
    const length = secondaryComponents.length;
    if (length === 0) return;
    if (direction === "prev") {
      setSecondaryCarouselIndex((prev: number) => (prev - 1 + length) % length);
    } else {
      setSecondaryCarouselIndex((prev: number) => (prev + 1) % length);
    }
  };

  if (secondaryComponents.length === 0) return null;

  return (
    <div className="flex flex-col space-y-4">
      <div
        className="relative group min-h-[500px] max-h-[500px]"
        onMouseEnter={() => setIsSecondaryHovered(true)}
        onMouseLeave={() => setIsSecondaryHovered(false)}
      >
        <div className="transition-all duration-300 ease-in-out h-full">
          <div className="h-full">
            {secondaryComponents[secondaryCarouselIndex % secondaryComponents.length]}
          </div>
        </div>

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

      {secondaryComponents.length > 1 && (
        <div className="flex justify-center gap-2">
          {secondaryComponents.map((_, index) => (
            <button
              key={index}
              onClick={() => setSecondaryCarouselIndex(index)}
              className={`w-2 h-2 rounded-full transition-colors ${
                index === secondaryCarouselIndex ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
