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
  initialParameterIds?: string[] | undefined;
  parameterSearch?: string | undefined;
  initialParameterIndex?: number;
  initialScenarioIds?: string[] | undefined;
  scenarioSearch?: string | undefined;
  initialScenarioIndex?: number;
}

export default function DashboardFooter({
  data,
  initialParameterIds,
  parameterSearch,
  initialParameterIndex = 0,
  initialScenarioIds,
  scenarioSearch,
  initialScenarioIndex = 0,
}: DashboardFooterProps) {
  const {
    params: sectionParams,
    setParameterIds,
    setParameterSearch,
    setParameterIndex,
    setScenarioIds,
    setScenarioSearch,
    setScenarioIndex,
  } = useDashboardSectionParams();

  const effectiveOnParameterChange = setParameterIds;
  const effectiveOnParameterSearch = setParameterSearch;
  const effectiveParameterSearch = parameterSearch ?? sectionParams.parameterSearch ?? undefined;

  const effectiveOnScenarioChange = setScenarioIds;
  const effectiveOnScenarioSearch = setScenarioSearch;
  const effectiveScenarioSearch = scenarioSearch ?? sectionParams.scenarioSearch ?? undefined;

  const [leftFooterCarouselIndex, setLeftFooterCarouselIndex] = useState(initialParameterIndex);
  const [rightFooterCarouselIndex, setRightFooterCarouselIndex] = useState(initialScenarioIndex);
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
        initialSelectedParameters={initialParameterIds}
        onParameterSelect={effectiveOnParameterChange}
        parameterSearchValue={effectiveParameterSearch}
        onParameterSearchChange={effectiveOnParameterSearch}
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
        initialSelectedParameters={initialParameterIds}
        onParameterSelect={effectiveOnParameterChange}
        parameterSearchValue={effectiveParameterSearch}
        onParameterSearchChange={effectiveOnParameterSearch}
      />,
    ];
  }, [data, initialParameterIds, effectiveOnParameterChange, effectiveParameterSearch, effectiveOnParameterSearch]);

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
        initialSelectedScenarios={initialScenarioIds}
        onScenarioSelect={effectiveOnScenarioChange}
        scenarioSearchValue={effectiveScenarioSearch}
        onScenarioSearchChange={effectiveOnScenarioSearch}
      />,
      <ScenarioComposition
        key="scenario-composition"
        scenarioSummaries={(scenarioComp.scenario_summaries || []).map((f) => ({
          scenarioId: f.scenario_id || "",
          name: f.name || "",
          totalChats: f.total_chats ?? 0,
          highCount: f.high_count ?? 0,
          lowCount: f.low_count ?? 0,
          highAvgScore: f.high_avg_score ?? 0,
          lowAvgScore: f.low_avg_score ?? 0,
        }))}
        chatParameterFacts={(scenarioComp.chat_parameter_facts || []).map((f) => ({
          scenarioId: f.scenario_id || "",
          group: (f.group || "high") as "high" | "low",
          parameterId: f.parameter_id || "",
          parameterItemId: f.parameter_item_id || "",
          chatCount: f.chat_count ?? 0,
        }))}
        scenarios={(data.scenarios || []).map((s) => ({
          scenario_id: s.scenario_id || "",
          name: s.name || "",
          description: s.description || "",
        }))}
        parameters={(data.parameters || []).map((p) => ({
          parameter_id: p.parameter_id || "",
          name: p.name || "",
          description: p.description || "",
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
        initialSelectedScenarios={initialScenarioIds}
        onScenarioSelect={effectiveOnScenarioChange}
        scenarioSearchValue={effectiveScenarioSearch}
        onScenarioSearchChange={effectiveOnScenarioSearch}
      />,
    ];
  }, [data, initialScenarioIds, effectiveOnScenarioChange, effectiveScenarioSearch, effectiveOnScenarioSearch]);

  const navigateLeftFooter = (direction: "prev" | "next") => {
    const length = leftFooterComponents.length;
    if (length === 0) return;
    let newIndex: number;
    if (direction === "prev") {
      newIndex = (leftFooterCarouselIndex - 1 + length) % length;
    } else {
      newIndex = (leftFooterCarouselIndex + 1) % length;
    }
    setLeftFooterCarouselIndex(newIndex);
    setParameterIndex(newIndex);
  };

  const navigateRightFooter = (direction: "prev" | "next") => {
    const length = rightFooterComponents.length;
    if (length === 0) return;
    let newIndex: number;
    if (direction === "prev") {
      newIndex = (rightFooterCarouselIndex - 1 + length) % length;
    } else {
      newIndex = (rightFooterCarouselIndex + 1) % length;
    }
    setRightFooterCarouselIndex(newIndex);
    setScenarioIndex(newIndex);
  };

  const setLeftIndex = (index: number) => {
    setLeftFooterCarouselIndex(index);
    setParameterIndex(index);
  };

  const setRightIndex = (index: number) => {
    setRightFooterCarouselIndex(index);
    setScenarioIndex(index);
  };

  if (leftFooterComponents.length === 0 && rightFooterComponents.length === 0) return null;

  return (
    <div className="pb-8">
      <div className="grid gap-6 items-stretch grid-cols-1 lg:grid-cols-2">
        {/* Left Footer Section (Parameter) */}
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
                    onClick={() => setLeftIndex(index)}
                    className={`w-2 h-2 rounded-full transition-colors ${
                      index === leftFooterCarouselIndex ? "bg-primary" : "bg-muted"
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Right Footer Section (Scenario) */}
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
                    onClick={() => setRightIndex(index)}
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
