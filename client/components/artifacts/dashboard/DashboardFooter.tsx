"use client";

import type { OutputOf } from "@/lib/api/types";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";

import { useDashboardSectionParams } from "@/hooks/use-dashboard-section-params";

import ScenarioComposition from "./footer/ScenarioComposition";
import ScenarioPerformance from "./footer/ScenarioPerformance";
import ScenarioSimulationPerformance from "./footer/ScenarioSimulationPerformance";
import ScenarioStats from "./footer/ScenarioStats";

export type FooterOut = OutputOf<"/api/v4/artifacts/dashboard/get", "post">;

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

export interface DashboardFooterProps {
  data: FooterOut;
  initialScenarioPerfParameters?: string[] | undefined;
  onScenarioPerfParameterChange?: ((ids: string[]) => void) | undefined;
  scenarioPerfParamSearch?: string | undefined;
  onScenarioPerfParamSearchChange?: ((term: string) => void) | undefined;
  initialScenarioStatsParameters?: string[] | undefined;
  onScenarioStatsParameterChange?: ((ids: string[]) => void) | undefined;
  scenarioStatsParamSearch?: string | undefined;
  onScenarioStatsParamSearchChange?: ((term: string) => void) | undefined;
  initialScenarioSimPerfScenarios?: string[] | undefined;
  onScenarioSimPerfScenarioChange?: ((ids: string[]) => void) | undefined;
  scenarioSimPerfScenarioSearch?: string | undefined;
  onScenarioSimPerfScenarioSearchChange?: ((term: string) => void) | undefined;
}

export default function DashboardFooter({
  data,
  initialScenarioPerfParameters,
  onScenarioPerfParameterChange,
  scenarioPerfParamSearch,
  onScenarioPerfParamSearchChange,
  initialScenarioStatsParameters,
  onScenarioStatsParameterChange,
  scenarioStatsParamSearch,
  onScenarioStatsParamSearchChange,
  initialScenarioSimPerfScenarios,
  onScenarioSimPerfScenarioChange,
  scenarioSimPerfScenarioSearch,
  onScenarioSimPerfScenarioSearchChange,
}: DashboardFooterProps) {
  const {
    params: sectionParams,
    setScenarioPerfParameterIds,
    setScenarioPerfParamSearch,
    setScenarioStatsParameterIds,
    setScenarioStatsParamSearch,
    setScenarioSimPerfScenarioIds,
    setScenarioSimPerfScenarioSearch,
  } = useDashboardSectionParams();

  const effectiveOnScenarioPerfChange = onScenarioPerfParameterChange ?? setScenarioPerfParameterIds;
  const effectiveOnScenarioPerfSearch = onScenarioPerfParamSearchChange ?? setScenarioPerfParamSearch;
  const effectiveScenarioPerfSearch = scenarioPerfParamSearch ?? sectionParams.scenarioPerfParamSearch ?? undefined;

  const effectiveOnScenarioStatsChange = onScenarioStatsParameterChange ?? setScenarioStatsParameterIds;
  const effectiveOnScenarioStatsSearch = onScenarioStatsParamSearchChange ?? setScenarioStatsParamSearch;
  const effectiveScenarioStatsSearch = scenarioStatsParamSearch ?? sectionParams.scenarioStatsParamSearch ?? undefined;

  const effectiveOnScenarioSimPerfChange = onScenarioSimPerfScenarioChange ?? setScenarioSimPerfScenarioIds;
  const effectiveOnScenarioSimPerfSearch = onScenarioSimPerfScenarioSearchChange ?? setScenarioSimPerfScenarioSearch;
  const effectiveScenarioSimPerfSearch = scenarioSimPerfScenarioSearch ?? sectionParams.scenarioSimPerfScenarioSearch ?? undefined;

  const [leftFooterCarouselIndex, setLeftFooterCarouselIndex] = useState(0);
  const [rightFooterCarouselIndex, setRightFooterCarouselIndex] = useState(0);
  const [isLeftFooterHovered, setIsLeftFooterHovered] = useState(false);
  const [isRightFooterHovered, setIsRightFooterHovered] = useState(false);

  const leftFooterComponents = useMemo(() => {
    if (!data?.footer_metrics) return [];

    const scenarioPerformance = data.footer_metrics.scenario_performance;
    const scenarioStats = data.footer_metrics.scenario_stats;

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
        parameters={(data.parameters || []).map((p) => ({
          parameter_id: p.parameter_id || "",
          name: p.name || "",
          description: p.description || "",
          numerical: p.numerical ?? false,
          document_parameter: p.document_parameter ?? false,
          persona_parameter: p.persona_parameter ?? false,
        }))}
        fields={(data.fields || []).map((f) => ({
          field_id: f.field_id || "",
          name: f.name || "",
          description: f.description || "",
          parameter_id: f.parameter_id || "",
          parameter_name: f.parameter_name || "",
        }))}
        validParameterIds={scenarioPerformance.valid_parameter_ids || []}
        actionableInsight={data.insights?.scenario_performance ?? null}
        status={validateStatus(scenarioPerformance.status)}
        initialSelectedParameters={initialScenarioPerfParameters}
        onParameterSelect={effectiveOnScenarioPerfChange}
        parameterSearchValue={effectiveScenarioPerfSearch}
        onParameterSearchChange={effectiveOnScenarioPerfSearch}
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
        parameters={(data.parameters || []).map((p) => ({
          parameter_id: p.parameter_id || "",
          name: p.name || "",
          description: p.description || "",
          numerical: p.numerical ?? false,
          document_parameter: p.document_parameter ?? false,
          persona_parameter: p.persona_parameter ?? false,
        }))}
        validNumericParameterIds={scenarioStats.valid_numeric_parameter_ids || []}
        actionableInsight={data.insights?.scenario_stats ?? null}
        status={validateStatus(scenarioStats.status)}
        initialSelectedParameters={initialScenarioStatsParameters}
        onParameterSelect={effectiveOnScenarioStatsChange}
        parameterSearchValue={effectiveScenarioStatsSearch}
        onParameterSearchChange={effectiveOnScenarioStatsSearch}
      />,
    ];
  }, [data, initialScenarioPerfParameters, effectiveOnScenarioPerfChange, effectiveScenarioPerfSearch, effectiveOnScenarioPerfSearch, initialScenarioStatsParameters, effectiveOnScenarioStatsChange, effectiveScenarioStatsSearch, effectiveOnScenarioStatsSearch]);

  const rightFooterComponents = useMemo(() => {
    if (!data?.footer_metrics) return [];

    const scenarioSimPerf = data.footer_metrics.scenario_simulation_performance;
    const scenarioComp = data.footer_metrics.scenario_composition;

    if (!scenarioSimPerf || !scenarioComp) return [];

    return [
      <ScenarioSimulationPerformance
        key="scenario-simulation-performance"
        validScenarioIds={scenarioSimPerf.valid_scenario_ids || []}
        simulationFacts={(scenarioSimPerf.simulation_facts || []).map((f) => ({
          scenarioId: f.scenario_id || "",
          simulationId: f.simulation_id || "",
          simulationName: f.simulation_name || "",
          avgScore: f.avg_score ?? 0,
          successRate: f.success_rate ?? 0,
          totalAttempts: f.total_attempts ?? 0,
          completedAttempts: f.completed_attempts ?? 0,
        }))}
        scenarios={(data.scenarios || []).map((s) => ({
          scenario_id: s.scenario_id || "",
          name: s.name || "",
          description: s.description || "",
        }))}
        actionableInsight={data.insights?.scenario_simulation_performance ?? null}
        status={validateStatus(scenarioSimPerf.status)}
        initialSelectedScenarios={initialScenarioSimPerfScenarios}
        onScenarioSelect={effectiveOnScenarioSimPerfChange}
        scenarioSearchValue={effectiveScenarioSimPerfSearch}
        onScenarioSearchChange={effectiveOnScenarioSimPerfSearch}
      />,
      <ScenarioComposition
        key="scenario-composition"
        scenarioFacts={(scenarioComp.scenario_facts || []).map((f) => ({
          scenarioId: f.scenario_id || "",
          name: f.name || "",
          avgScore: f.avg_score ?? 0,
          completionRate: f.completion_rate ?? 0,
          totalChats: f.total_chats ?? 0,
          simulationCount: f.simulation_count ?? 0,
        }))}
        scenarioParameterFactsCategorical={
          (scenarioComp.scenario_parameter_facts_categorical || []).map((f) => ({
            scenarioId: f.scenario_id || "",
            parameterId: f.parameter_id || "",
            parameterItemId: f.parameter_item_id || "",
            chatCount: f.chat_count ?? 0,
          }))
        }
        scenarioParameterFactsNumeric={
          (scenarioComp.scenario_parameter_facts_numeric || []).map((f) => ({
            scenarioId: f.scenario_id || "",
            parameterId: f.parameter_id || "",
            avgLevel: f.avg_level ?? 0,
            levelLabel: f.level_label || "",
            chatCount: f.chat_count ?? 0,
          }))
        }
        parameters={(data.parameters || []).map((p) => ({
          parameter_id: p.parameter_id || "",
          name: p.name || "",
          description: p.description || "",
          numerical: p.numerical ?? false,
          document_parameter: p.document_parameter ?? false,
          persona_parameter: p.persona_parameter ?? false,
        }))}
        fields={(data.fields || []).map((f) => ({
          field_id: f.field_id || "",
          name: f.name || "",
          description: f.description || "",
          parameter_id: f.parameter_id || "",
          parameter_name: f.parameter_name || "",
        }))}
        validScenarioIds={scenarioComp.valid_scenario_ids || []}
        actionableInsight={data.insights?.scenario_composition ?? null}
        status={validateStatus(scenarioComp.status)}
      />,
    ];
  }, [data, initialScenarioSimPerfScenarios, effectiveOnScenarioSimPerfChange, effectiveScenarioSimPerfSearch, effectiveOnScenarioSimPerfSearch]);

  const navigateLeftFooter = (direction: "prev" | "next") => {
    const length = leftFooterComponents.length;
    if (length === 0) return;
    if (direction === "prev") {
      setLeftFooterCarouselIndex((prev: number) => (prev - 1 + length) % length);
    } else {
      setLeftFooterCarouselIndex((prev: number) => (prev + 1) % length);
    }
  };

  const navigateRightFooter = (direction: "prev" | "next") => {
    const length = rightFooterComponents.length;
    if (length === 0) return;
    if (direction === "prev") {
      setRightFooterCarouselIndex((prev: number) => (prev - 1 + length) % length);
    } else {
      setRightFooterCarouselIndex((prev: number) => (prev + 1) % length);
    }
  };

  if (leftFooterComponents.length === 0 && rightFooterComponents.length === 0) return null;

  return (
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
                  {leftFooterComponents[leftFooterCarouselIndex % leftFooterComponents.length]}
                </div>
              </div>

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

            {leftFooterComponents.length > 1 && (
              <div className="flex justify-center gap-2">
                {leftFooterComponents.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setLeftFooterCarouselIndex(index)}
                    className={`w-2 h-2 rounded-full transition-colors ${
                      index === leftFooterCarouselIndex ? "bg-primary" : "bg-muted"
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
                  {rightFooterComponents[rightFooterCarouselIndex % rightFooterComponents.length]}
                </div>
              </div>

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

            {rightFooterComponents.length > 1 && (
              <div className="flex justify-center gap-2">
                {rightFooterComponents.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setRightFooterCarouselIndex(index)}
                    className={`w-2 h-2 rounded-full transition-colors ${
                      index === rightFooterCarouselIndex ? "bg-primary" : "bg-muted"
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
