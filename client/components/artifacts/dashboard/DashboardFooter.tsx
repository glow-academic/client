"use client";

import type { OutputOf } from "@/lib/api/types";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";

import ScenarioPerformance from "./footer/ScenarioPerformance";
import ScenarioStats from "./footer/ScenarioStats";
import SimulationComposition from "./footer/SimulationComposition";
import SimulationPerformance from "./footer/SimulationPerformance";

export type FooterOut = OutputOf<"/api/v4/artifacts/dashboard/footer", "post">;

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
  initialScenarioPerfParameters?: string[];
  onScenarioPerfParameterChange?: (ids: string[]) => void;
  scenarioPerfParamSearch?: string;
  onScenarioPerfParamSearchChange?: (term: string) => void;
  initialScenarioStatsParameters?: string[];
  onScenarioStatsParameterChange?: (ids: string[]) => void;
  scenarioStatsParamSearch?: string;
  onScenarioStatsParamSearchChange?: (term: string) => void;
  initialSimPerfSimulations?: string[];
  onSimPerfSimulationChange?: (ids: string[]) => void;
  simPerfSimulationSearch?: string;
  onSimPerfSimulationSearchChange?: (term: string) => void;
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
  initialSimPerfSimulations,
  onSimPerfSimulationChange,
  simPerfSimulationSearch,
  onSimPerfSimulationSearchChange,
}: DashboardFooterProps) {
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
        onParameterSelect={onScenarioPerfParameterChange}
        parameterSearchValue={scenarioPerfParamSearch}
        onParameterSearchChange={onScenarioPerfParamSearchChange}
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
        onParameterSelect={onScenarioStatsParameterChange}
        parameterSearchValue={scenarioStatsParamSearch}
        onParameterSearchChange={onScenarioStatsParamSearchChange}
      />,
    ];
  }, [data, initialScenarioPerfParameters, onScenarioPerfParameterChange, scenarioPerfParamSearch, onScenarioPerfParamSearchChange, initialScenarioStatsParameters, onScenarioStatsParameterChange, scenarioStatsParamSearch, onScenarioStatsParamSearchChange]);

  const rightFooterComponents = useMemo(() => {
    if (!data?.footer_metrics) return [];

    const simulationPerformance = data.footer_metrics.simulation_performance;
    const simulationComposition = data.footer_metrics.simulation_composition;

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
        simulations={(data.simulations || []).map((s) => ({
          simulation_id: s.simulation_id || "",
          name: s.name || "",
          description: s.description || "",
        }))}
        actionableInsight={data.insights?.simulation_performance ?? null}
        status={validateStatus(simulationPerformance.status)}
        initialSelectedSimulations={initialSimPerfSimulations}
        onSimulationSelect={onSimPerfSimulationChange}
        simulationSearchValue={simPerfSimulationSearch}
        onSimulationSearchChange={onSimPerfSimulationSearchChange}
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
        simulations={(data.simulations || []).map((s) => ({
          simulation_id: s.simulation_id || "",
          name: s.name || "",
          description: s.description || "",
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
        validSimulationIds={simulationComposition.valid_simulation_ids || []}
        actionableInsight={data.insights?.simulation_composition ?? null}
        status={validateStatus(simulationComposition.status)}
      />,
    ];
  }, [data, initialSimPerfSimulations, onSimPerfSimulationChange, simPerfSimulationSearch, onSimPerfSimulationSearchChange]);

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
