/**
 * Dashboard.tsx
 * Used to display the main dashboard for the analytics page.
 * Refactored to use single v2 bundle endpoint for optimal performance.
 * @AshokSaravanan222 & @siladiea
 * 10/15/2025
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { Button } from "@/components/ui/button";
import { useAnalytics } from "@/contexts/analytics-context";
import { useProfile } from "@/contexts/profile-context";
import { useDashboard } from "@/lib/api/v2/hooks/dashboard";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import ScenarioPerformance from "../common/analytics/footer/ScenarioPerformance";
import ScenarioStats from "../common/analytics/footer/ScenarioStats";
import SimulationComposition from "../common/analytics/footer/SimulationComposition";
import SimulationPerformance from "../common/analytics/footer/SimulationPerformance";
import AverageScore from "../common/analytics/header/AverageScore";
import CompletionPercentage from "../common/analytics/header/CompletionPercentage";
import FirstAttemptPassRate from "../common/analytics/header/FirstAttemptPassRate";
import HighestScore from "../common/analytics/header/HighestScore";
import MessagesPerSession from "../common/analytics/header/MessagesPerSession";
import PersonaResponseTimes from "../common/analytics/header/PersonaResponseTimes";
import SessionEfficiency from "../common/analytics/header/SessionEfficiency";
import StagnationRate from "../common/analytics/header/StagnationRate";
import TimeSpent from "../common/analytics/header/TimeSpent";
import TotalAttempts from "../common/analytics/header/TotalAttempts";
import Growth from "../common/analytics/primary/Growth";
import PersonaPerformance from "../common/analytics/primary/PersonaPerformance";
import RubricHeatmap from "../common/analytics/primary/RubricHeatmap";
import AttemptImprovement from "../common/analytics/secondary/AttemptImprovement";
import CohortPerformance from "../common/analytics/secondary/CohortPerformance";
import SkillPerformance from "../common/analytics/secondary/SkillPerformance";
import SimulationHistory from "../common/history/SimulationHistory";

interface DashboardProps {
  profileId?: string;
}

export default function Dashboard({ profileId }: DashboardProps) {
  const { effectiveProfile, effectiveDepartmentIds } = useProfile();

  const {
    startDate,
    endDate,
    effectiveCohortIds,
    effectiveRoles,
    effectiveSimulationFilters,
  } = useAnalytics();

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

  // Build filters for bundle request
  const filters = useMemo(
    () => ({
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      cohortIds: effectiveCohortIds,
      roles: effectiveRoles,
      simulationFilters: effectiveSimulationFilters,
      profileId,
      departmentIds: effectiveDepartmentIds,
    }),
    [
      startDate,
      endDate,
      effectiveCohortIds,
      effectiveRoles,
      effectiveSimulationFilters,
      profileId,
      effectiveDepartmentIds,
    ]
  );

  // Stable React Query options
  const rqOpts = useMemo(
    () => ({
      enabled: true,
      staleTime: 60_000,
    }),
    []
  );

  // Fetch complete dashboard bundle with single API call
  const {
    data: bundle,
    isLoading,
    isError,
    error,
  } = useDashboard(filters, rqOpts);

  // Get thresholds from server (or use defaults if not available)
  const thresholds = useMemo(
    () => bundle?.thresholds ?? { danger: 60, warning: 75, success: 85 },
    [bundle?.thresholds]
  );

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

    return {
      averageScore: bundle.header.average_score.trendAnalysis ?? null,
      completion: bundle.header.completion_percentage.trendAnalysis ?? null,
      passRate: bundle.header.first_attempt_pass_rate.trendAnalysis ?? null,
      highestScore: bundle.header.highest_score.trendAnalysis ?? null,
      messages: bundle.header.messages_per_session.trendAnalysis ?? null,
      responseTime: bundle.header.persona_response_times.trendAnalysis ?? null,
      sessionEfficiency: bundle.header.session_efficiency.trendAnalysis ?? null,
      stagnationRate: bundle.header.stagnation_rate.trendAnalysis ?? null,
      timeSpent: bundle.header.time_spent.trendAnalysis ?? null,
      totalAttempts: bundle.header.total_attempts.trendAnalysis ?? null,
    };
  }, [bundle]);

  // Build header components from bundle data
  const headerComponents = useMemo(() => {
    if (!bundle) return [];

    return [
      <AverageScore
        key="average-score"
        averageScore={bundle.header.average_score.currentValue}
        scoreTrend={bundle.header.average_score.trendData}
        hasDataAvailable={bundle.header.average_score.hasData}
        trendAnalysis={trendAnalysis.averageScore}
        thresholds={thresholds}
        isLoading={isLoading}
        isError={isError}
      />,
      <CompletionPercentage
        key="completion-percentage"
        completionPercentage={bundle.header.completion_percentage.currentValue}
        completionTrend={bundle.header.completion_percentage.trendData}
        hasDataAvailable={bundle.header.completion_percentage.hasData}
        trendAnalysis={trendAnalysis.completion}
        thresholds={thresholds}
        isLoading={isLoading}
        isError={isError}
      />,
      <FirstAttemptPassRate
        key="first-attempt-pass-rate"
        firstAttemptPassRate={
          bundle.header.first_attempt_pass_rate.currentValue
        }
        passRateTrend={bundle.header.first_attempt_pass_rate.trendData}
        hasDataAvailable={bundle.header.first_attempt_pass_rate.hasData}
        trendAnalysis={trendAnalysis.passRate}
        thresholds={thresholds}
        isLoading={isLoading}
        isError={isError}
      />,
      <HighestScore
        key="highest-score"
        highestScore={bundle.header.highest_score.currentValue}
        scoreTrend={bundle.header.highest_score.trendData}
        hasDataAvailable={bundle.header.highest_score.hasData}
        trendAnalysis={trendAnalysis.highestScore}
        thresholds={thresholds}
        isLoading={isLoading}
        isError={isError}
      />,
      <MessagesPerSession
        key="messages-per-session"
        averageMessagesPerSession={
          bundle.header.messages_per_session.currentValue
        }
        messagesTrend={bundle.header.messages_per_session.trendData}
        hasDataAvailable={bundle.header.messages_per_session.hasData}
        trendAnalysis={trendAnalysis.messages}
        thresholds={thresholds}
        isLoading={isLoading}
        isError={isError}
      />,
      <PersonaResponseTimes
        key="persona-response-times"
        averageResponseTime={bundle.header.persona_response_times.currentValue}
        responseTimeTrend={bundle.header.persona_response_times.trendData}
        hasDataAvailable={bundle.header.persona_response_times.hasData}
        trendAnalysis={trendAnalysis.responseTime}
        thresholds={thresholds}
        isLoading={isLoading}
        isError={isError}
      />,
      <SessionEfficiency
        key="session-efficiency"
        sessionEfficiency={bundle.header.session_efficiency.currentValue}
        efficiencyTrend={bundle.header.session_efficiency.trendData}
        hasDataAvailable={bundle.header.session_efficiency.hasData}
        trendAnalysis={trendAnalysis.sessionEfficiency}
        thresholds={thresholds}
        isLoading={isLoading}
        isError={isError}
      />,
      <StagnationRate
        key="stagnation-rate"
        stagnationRate={bundle.header.stagnation_rate.currentValue}
        stagnationTrend={bundle.header.stagnation_rate.trendData}
        hasDataAvailable={bundle.header.stagnation_rate.hasData}
        trendAnalysis={trendAnalysis.stagnationRate}
        thresholds={thresholds}
        isLoading={isLoading}
        isError={isError}
      />,
      <TimeSpent
        key="time-spent"
        totalTimeSpent={bundle.header.time_spent.currentValue * 60}
        timeSpentTrend={bundle.header.time_spent.trendData.map((t) => ({
          ...t,
          value: Math.round(t.value * 60),
        }))}
        hasDataAvailable={bundle.header.time_spent.hasData}
        trendAnalysis={trendAnalysis.timeSpent}
        thresholds={thresholds}
        isLoading={isLoading}
        isError={isError}
      />,
      <TotalAttempts
        key="total-attempts"
        totalAttempts={bundle.header.total_attempts.currentValue}
        attemptsTrend={bundle.header.total_attempts.trendData}
        hasDataAvailable={bundle.header.total_attempts.hasData}
        trendAnalysis={trendAnalysis.totalAttempts}
        thresholds={thresholds}
        isLoading={isLoading}
        isError={isError}
      />,
    ];
  }, [bundle, trendAnalysis, isLoading, isError, thresholds]);

  // Build primary components from bundle data
  const primaryComponents = useMemo(() => {
    if (!bundle) return [];

    return [
      <Growth
        key="growth"
        {...bundle.primary.growth_data}
        hasDataAvailable={bundle.primary.growth_data.chartData.length > 0}
        actionableInsight={bundle.insights.growth}
        thresholds={thresholds}
        isLoading={isLoading}
        isError={isError}
      />,
      <PersonaPerformance
        key="persona-performance"
        chartData={bundle.primary.persona_performance.chartData}
        simulationMapping={bundle.simulation_mapping}
        validSimulationIds={
          bundle.primary.persona_performance.validSimulationIds
        }
        personaColors={bundle.primary.persona_performance.personaColors}
        hasDataAvailable={
          bundle.primary.persona_performance.chartData.length > 0
        }
        actionableInsights={bundle.insights.persona}
        thresholds={thresholds}
        isLoading={isLoading}
        isError={isError}
        performanceStatus="neutral"
      />,
      <RubricHeatmap
        key="rubric-heatmap"
        matrices={bundle.primary.rubric_heatmap.matrices}
        rubricMapping={bundle.rubric_mapping}
        validRubricIds={bundle.primary.rubric_heatmap.validRubricIds}
        hasDataAvailable={bundle.primary.rubric_heatmap.matrices.length > 0}
        actionableInsight={bundle.insights.rubric_heatmap}
        thresholds={thresholds}
        isLoading={isLoading}
        isError={isError}
      />,
    ];
  }, [bundle, isLoading, isError, thresholds]);

  // Build secondary components from bundle data
  const secondaryComponents = useMemo(() => {
    if (!bundle) return [];

    // Normalize simulation_mapping to convert undefined to null for exactOptionalPropertyTypes
    // For CohortPerformance: optional department_ids and time_limit
    const normalizedSimulationMapping = Object.entries(
      bundle.simulation_mapping
    ).reduce(
      (acc, [key, value]) => {
        const normalized: {
          name: string;
          description: string;
          department_ids?: string[] | null;
          time_limit?: number | null;
        } = {
          name: value.name,
          description: value.description,
        };
        // Only include optional properties if they're not undefined
        if (value.department_ids !== undefined) {
          normalized.department_ids = value.department_ids;
        }
        if (value.time_limit !== undefined) {
          normalized.time_limit = value.time_limit;
        }
        acc[key] = normalized;
        return acc;
      },
      {} as Record<
        string,
        {
          name: string;
          description: string;
          department_ids?: string[] | null;
          time_limit?: number | null;
        }
      >
    );

    // For AttemptImprovement: required department_ids (must always be present)
    const normalizedSimulationMappingRequired = Object.entries(
      bundle.simulation_mapping
    ).reduce(
      (acc, [key, value]) => {
        acc[key] = {
          name: value.name,
          description: value.description,
          department_ids: value.department_ids ?? null,
        };
        return acc;
      },
      {} as Record<
        string,
        { name: string; description: string; department_ids: string[] | null }
      >
    );

    return [
      <CohortPerformance
        key="cohort-performance"
        cohortData={bundle.secondary.cohort_performance.cohortData}
        dailyData={bundle.secondary.cohort_performance.dailyData}
        cohortFacts={bundle.secondary.cohort_performance.cohortFacts}
        dailyFacts={bundle.secondary.cohort_performance.dailyFacts}
        simulationMapping={normalizedSimulationMapping}
        validSimulationIds={
          bundle.secondary.cohort_performance.validSimulationIds
        }
        profileId={profileId}
        actionableInsights={bundle.insights.cohort}
        thresholds={thresholds}
        isLoading={isLoading}
        isError={isError}
      />,
      <AttemptImprovement
        key="attempt-improvement"
        chartData={bundle.secondary.attempt_improvement.chartData}
        facts={bundle.secondary.attempt_improvement.facts}
        simulationMapping={normalizedSimulationMappingRequired}
        validSimulationIds={
          bundle.secondary.attempt_improvement.validSimulationIds
        }
        actionableInsight={bundle.insights.attempt_improvement}
        thresholds={thresholds}
        isLoading={isLoading}
        isError={isError}
      />,
      <SkillPerformance
        key="skill-performance"
        packages={bundle.secondary.skill_performance.packages}
        rubricMapping={bundle.rubric_mapping}
        validRubricIds={bundle.secondary.skill_performance.validRubricIds}
        actionableInsight={bundle.insights.skill_performance}
        thresholds={thresholds}
        isLoading={isLoading}
        isError={isError}
      />,
    ];
  }, [bundle, profileId, isLoading, isError, thresholds]);

  // Build footer components from bundle data
  const leftFooterComponents = useMemo(() => {
    if (!bundle) return [];

    return [
      <ScenarioPerformance
        key="scenario-performance"
        attributeAttemptFacts={
          bundle.footer.scenario_performance.attributeAttemptFacts
        }
        attributeScenarioFacts={
          bundle.footer.scenario_performance.attributeScenarioFacts
        }
        parameterMapping={bundle.parameter_mapping}
        parameterItemMapping={bundle.parameter_item_mapping}
        validParameterIds={bundle.footer.scenario_performance.validParameterIds}
        actionableInsight={bundle.insights.scenario_performance}
        thresholds={thresholds}
        isLoading={isLoading}
        isError={isError}
      />,
      <ScenarioStats
        key="scenario-stats"
        numericAttemptFacts={bundle.footer.scenario_stats.numericAttemptFacts}
        numericScenarioFacts={bundle.footer.scenario_stats.numericScenarioFacts}
        parameterMapping={bundle.parameter_mapping}
        validNumericParameterIds={
          bundle.footer.scenario_stats.validNumericParameterIds
        }
        actionableInsight={bundle.insights.scenario_stats}
        thresholds={thresholds}
        isLoading={isLoading}
        isError={isError}
      />,
    ];
  }, [bundle, isLoading, isError, thresholds]);

  const rightFooterComponents = useMemo(() => {
    if (!bundle) return [];

    return [
      <SimulationPerformance
        key="simulation-performance"
        validSimulationIds={
          bundle.footer.simulation_performance.validSimulationIds
        }
        scenarioFacts={bundle.footer.simulation_performance.scenarioFacts}
        simulationMapping={bundle.simulation_mapping}
        actionableInsight={bundle.insights.simulation_performance}
        thresholds={thresholds}
        isLoading={isLoading}
        isError={isError}
      />,
      <SimulationComposition
        key="simulation-composition"
        simulationFacts={bundle.footer.simulation_composition.simulationFacts}
        simulationParameterFactsCategorical={
          bundle.footer.simulation_composition
            .simulationParameterFactsCategorical
        }
        simulationParameterFactsNumeric={
          bundle.footer.simulation_composition.simulationParameterFactsNumeric
        }
        simulationMapping={bundle.simulation_mapping}
        parameterMapping={bundle.parameter_mapping}
        parameterItemMapping={bundle.parameter_item_mapping}
        validSimulationIds={
          bundle.footer.simulation_composition.validSimulationIds
        }
        actionableInsight={bundle.insights.simulation_composition}
        thresholds={thresholds}
        isLoading={isLoading}
        isError={isError}
      />,
    ];
  }, [bundle, isLoading, isError, thresholds]);

  // Header pagination logic
  const HEADER_CARDS_PER_PAGE = 5;
  const totalHeaderPages = Math.ceil(
    headerComponents.length / HEADER_CARDS_PER_PAGE
  );

  const getVisibleHeaderComponents = () => {
    const startIndex = headerCarouselIndex * HEADER_CARDS_PER_PAGE;
    return headerComponents.slice(
      startIndex,
      startIndex + HEADER_CARDS_PER_PAGE
    );
  };

  // Navigation functions
  const navigateHeader = (direction: "prev" | "next") => {
    if (direction === "prev") {
      setHeaderCarouselIndex(
        (prev: number) => (prev - 1 + totalHeaderPages) % totalHeaderPages
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
        (prev: number) => (prev - 1 + length) % length
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
        (prev: number) => (prev - 1 + length) % length
      );
    } else {
      setRightFooterCarouselIndex((prev: number) => (prev + 1) % length);
    }
  };

  // Determine if user can archive
  const canArchive =
    effectiveProfile?.role === "instructional" ||
    effectiveProfile?.role === "admin" ||
    effectiveProfile?.role === "superadmin";

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Loading dashboard data...</div>
      </div>
    );
  }

  // Show error state
  if (isError) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-destructive">
          Error loading dashboard: {error?.toString() || "Unknown error"}
        </div>
      </div>
    );
  }

  // Show no data state
  if (!bundle) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">No dashboard data available</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
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
                gridTemplateColumns: `repeat(${Math.min(HEADER_CARDS_PER_PAGE, headerComponents.length)}, 1fr)`,
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

      <SimulationHistory
        data={
          (bundle?.history || []).map((item) => ({
            ...item,
            date: new Date(item.date),
            passPct: item.passPct || 70,
          })) as any
        }
        showExport={false}
        showArchive={canArchive}
        singleProfile={false}
        isLoading={isLoading}
      />
    </div>
  );
}
