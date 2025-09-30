/**
 * Dashboard.tsx
 * Used to display the main dashboard for the analytics page.
 * Now fully dynamic using database components and dashboards.
 * @AshokSaravanan222 & @siladiea
 * 06/07/2025
 */
"use client";

import { Button } from "@/components/ui/button";
import { useAnalytics } from "@/contexts/analytics-context";
import { useProfile } from "@/contexts/profile-context";
import {
  computeAttemptImprovementActionableInsight,
  computeCohortPerformanceActionableInsight,
  computeCurrent,
  computeGrowthActionableInsight,
  computePersonaActionableInsight,
  computePersonaPerformanceStatus,
  computeRubricHeatmapActionableInsight,
  computeScenarioPerformanceActionableInsight,
  computeScenarioStatsActionableInsight,
  computeSimulationCompositionActionableInsight,
  computeSimulationPerformanceActionableInsight,
  computeSkillPerformanceActionableInsight,
  computeTrendAnalysis,
  MetricResponse,
  TrendData,
} from "@/lib/analytics";
import {
  useAnalyticsAttemptHistory,
  useAnalyticsAttemptImprovement,
  useAnalyticsAverageScore,
  useAnalyticsCohortPerformance,
  useAnalyticsCompletionPercentage,
  useAnalyticsFirstAttemptPassRate,
  useAnalyticsGrowthData,
  useAnalyticsHighestScore,
  useAnalyticsMessagesPerSession,
  useAnalyticsPersonaPerformance,
  useAnalyticsPersonaResponseTimes,
  useAnalyticsRubricHeatmap,
  useAnalyticsScenarioPerformance,
  useAnalyticsScenarioStats,
  useAnalyticsSessionEfficiency,
  useAnalyticsSimulationComposition,
  useAnalyticsSimulationPerformance,
  useAnalyticsSkillPerformance,
  useAnalyticsStagnationRate,
  useAnalyticsTimeSpent,
  useAnalyticsTotalAttempts,
} from "@/lib/api/hooks/analytics";
import { useParameterItems } from "@/lib/api/hooks/parameter_items";
import { useParameters } from "@/lib/api/hooks/parameters";
import { useRubrics } from "@/lib/api/hooks/rubrics";
import { useSimulations } from "@/lib/api/hooks/simulations";
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
  const { effectiveProfile } = useProfile();

  const {
    startDate,
    endDate,
    selectedCohortIds,
    selectedRoles,
    simulationFilters,
  } = useAnalytics();

  // Threshold data
  const thresholds = {
    danger: 60,
    warning: 75,
    success: 85,
  };

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

  const filters = useMemo(
    () => ({
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      cohortIds: selectedCohortIds,
      roles: selectedRoles,
      simulationFilters,
    }),
    [startDate, endDate, selectedCohortIds, selectedRoles, simulationFilters]
  );

  // Stable React Query options to prevent unnecessary refetches
  const rqOpts = useMemo(
    () => ({
      enabled: true,
      staleTime: 60_000,
    }),
    []
  );

  // Fetch data and process it inline
  const {
    data: averageScoreData,
    isLoading: averageScoreLoading,
    isError: averageScoreError,
  } = useAnalyticsAverageScore(filters, rqOpts);
  const {
    data: completionData,
    isLoading: completionLoading,
    isError: completionError,
  } = useAnalyticsCompletionPercentage(filters, rqOpts);
  const {
    data: passRateData,
    isLoading: passRateLoading,
    isError: passRateError,
  } = useAnalyticsFirstAttemptPassRate(filters, rqOpts);
  const {
    data: highestScoreData,
    isLoading: highestScoreLoading,
    isError: highestScoreError,
  } = useAnalyticsHighestScore(filters, rqOpts);
  const {
    data: messagesData,
    isLoading: messagesLoading,
    isError: messagesError,
  } = useAnalyticsMessagesPerSession(filters, rqOpts);
  const {
    data: responseTimeData,
    isLoading: responseTimeLoading,
    isError: responseTimeError,
  } = useAnalyticsPersonaResponseTimes(filters, rqOpts);
  const {
    data: sessionEfficiencyData,
    isLoading: sessionEfficiencyLoading,
    isError: sessionEfficiencyError,
  } = useAnalyticsSessionEfficiency(filters, rqOpts);
  const {
    data: stagnationRateData,
    isLoading: stagnationRateLoading,
    isError: stagnationRateError,
  } = useAnalyticsStagnationRate(filters, rqOpts);
  const {
    data: timeSpentData,
    isLoading: timeSpentLoading,
    isError: timeSpentError,
  } = useAnalyticsTimeSpent(filters, rqOpts);
  const {
    data: totalAttemptsData,
    isLoading: totalAttemptsLoading,
    isError: totalAttemptsError,
  } = useAnalyticsTotalAttempts(filters, rqOpts);
  const {
    data: growthData,
    isLoading: growthLoading,
    isError: growthError,
  } = useAnalyticsGrowthData(filters, rqOpts);
  const {
    data: personaData,
    isLoading: personaLoading,
    isError: personaError,
  } = useAnalyticsPersonaPerformance(filters, rqOpts);

  // Fetch all simulations and rubrics
  const { data: allSimulations = [] } = useSimulations();
  const { data: allRubrics = [] } = useRubrics();
  const { data: allParameters = [] } = useParameters();
  const { data: allParameterItems = [] } = useParameterItems();

  // Fetch rubric heatmap data
  const {
    data: rubricHeatmapData,
    isLoading: rubricHeatmapLoading,
    isError: rubricHeatmapError,
  } = useAnalyticsRubricHeatmap(filters, rqOpts);

  // Fetch secondary analytics data
  const {
    data: attemptImprovementData,
    isLoading: attemptImprovementLoading,
    isError: attemptImprovementError,
  } = useAnalyticsAttemptImprovement(filters, rqOpts);

  const {
    data: cohortPerformanceData,
    isLoading: cohortPerformanceLoading,
    isError: cohortPerformanceError,
  } = useAnalyticsCohortPerformance(filters, rqOpts);

  const {
    data: skillPerformanceData,
    isLoading: skillPerformanceLoading,
    isError: skillPerformanceError,
  } = useAnalyticsSkillPerformance(filters, rqOpts);

  // Footer Analytics Data Fetching
  const {
    data: scenarioPerformanceData,
    isLoading: scenarioPerformanceLoading,
    isError: scenarioPerformanceError,
  } = useAnalyticsScenarioPerformance(filters, rqOpts);

  const {
    data: scenarioStatsData,
    isLoading: scenarioStatsLoading,
    isError: scenarioStatsError,
  } = useAnalyticsScenarioStats(filters, rqOpts);

  const {
    data: simulationPerformanceData,
    isLoading: simulationPerformanceLoading,
    isError: simulationPerformanceError,
  } = useAnalyticsSimulationPerformance(filters, rqOpts);

  const {
    data: simulationCompositionData,
    isLoading: simulationCompositionLoading,
    isError: simulationCompositionError,
  } = useAnalyticsSimulationComposition(filters, rqOpts);

  // Fetch history data for the dashboard
  const historyFilters = useMemo(
    () => ({
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      cohortIds: selectedCohortIds,
      roles: selectedRoles,
      simulationFilters: simulationFilters?.map((f) => f.toLowerCase()) as (
        | "general"
        | "practice"
        | "archived"
      )[],
      // For dashboard, show all users' history (no profileId filter)
      // unless it's a specific profile view
      ...(profileId && { profileId }),
    }),
    [
      startDate,
      endDate,
      selectedCohortIds,
      selectedRoles,
      simulationFilters,
      profileId,
    ]
  );

  const { data: historyData, isLoading: isHistoryLoading } =
    useAnalyticsAttemptHistory(historyFilters, rqOpts);

  // Process the data inline
  const averageScoreProcessed = (() => {
    const resp = averageScoreData as MetricResponse | undefined;
    if (!resp) {
      return {
        averageScore: 0,
        scoreTrend: [] as TrendData[],
        hasDataAvailable: false,
      };
    }

    // Use all data points for aggregate view
    const points = resp.dataPoints;
    const current = computeCurrent(resp.method, points);

    return {
      averageScore: Number.isFinite(current) ? current : 0,
      scoreTrend: resp.trendData ?? [],
      hasDataAvailable: !!resp.hasData && points.length > 0,
    };
  })();

  // Process completion percentage data
  const completionProcessed = (() => {
    const resp = completionData as MetricResponse | undefined;
    if (!resp) {
      return {
        completionPercentage: 0,
        completionTrend: [] as TrendData[],
        hasDataAvailable: false,
      };
    }

    const points = resp.dataPoints;
    const current = computeCurrent(resp.method, points);

    return {
      completionPercentage: Number.isFinite(current) ? current : 0,
      completionTrend: resp.trendData ?? [],
      hasDataAvailable: !!resp.hasData && points.length > 0,
    };
  })();

  // Process first attempt pass rate data
  const passRateProcessed = (() => {
    const resp = passRateData as MetricResponse | undefined;
    if (!resp) {
      return {
        firstAttemptPassRate: 0,
        passRateTrend: [] as TrendData[],
        hasDataAvailable: false,
      };
    }

    const points = resp.dataPoints;
    const current = computeCurrent(resp.method, points);

    return {
      firstAttemptPassRate: Number.isFinite(current) ? current : 0,
      passRateTrend: resp.trendData ?? [],
      hasDataAvailable: !!resp.hasData && points.length > 0,
    };
  })();

  // Process highest score data
  const highestScoreProcessed = (() => {
    const resp = highestScoreData as MetricResponse | undefined;
    if (!resp) {
      return {
        highestScore: 0,
        scoreTrend: [] as TrendData[],
        hasDataAvailable: false,
      };
    }

    const points = resp.dataPoints;
    const current = computeCurrent(resp.method, points);

    return {
      highestScore: Number.isFinite(current) ? current : 0,
      scoreTrend: resp.trendData ?? [],
      hasDataAvailable: !!resp.hasData && points.length > 0,
    };
  })();

  // Process messages per session data
  const messagesProcessed = (() => {
    const resp = messagesData as MetricResponse | undefined;
    if (!resp) {
      return {
        averageMessagesPerSession: 0,
        messagesTrend: [] as TrendData[],
        hasDataAvailable: false,
      };
    }

    const points = resp.dataPoints;
    const current = computeCurrent(resp.method, points);

    return {
      averageMessagesPerSession: Number.isFinite(current)
        ? Math.round(current)
        : 0,
      messagesTrend: resp.trendData ?? [],
      hasDataAvailable: !!resp.hasData && points.length > 0,
    };
  })();

  // Process persona response times data
  const responseTimeProcessed = (() => {
    const resp = responseTimeData as MetricResponse | undefined;
    if (!resp) {
      return {
        averageResponseTime: 0,
        responseTimeTrend: [] as TrendData[],
        hasDataAvailable: false,
      };
    }

    const points = resp.dataPoints;
    const current = computeCurrent(resp.method, points);

    return {
      averageResponseTime: Number.isFinite(current) ? Math.round(current) : 0,
      responseTimeTrend: resp.trendData ?? [],
      hasDataAvailable: !!resp.hasData && points.length > 0,
    };
  })();

  // Process session efficiency data
  const sessionEfficiencyProcessed = (() => {
    const resp = sessionEfficiencyData as MetricResponse | undefined;
    if (!resp) {
      return {
        sessionEfficiency: 0,
        efficiencyTrend: [] as TrendData[],
        hasDataAvailable: false,
      };
    }

    const points = resp.dataPoints;
    const current = computeCurrent(resp.method, points);

    return {
      sessionEfficiency: Number.isFinite(current) ? current : 0,
      efficiencyTrend: resp.trendData ?? [],
      hasDataAvailable: !!resp.hasData && points.length > 0,
    };
  })();

  // Process stagnation rate data
  const stagnationRateProcessed = (() => {
    const resp = stagnationRateData as MetricResponse | undefined;
    if (!resp) {
      return {
        stagnationRate: 0,
        stagnationTrend: [] as TrendData[],
        hasDataAvailable: false,
      };
    }

    const points = resp.dataPoints;
    const current = computeCurrent(resp.method, points);

    return {
      stagnationRate: Number.isFinite(current) ? current : 0,
      stagnationTrend: resp.trendData ?? [],
      hasDataAvailable: !!resp.hasData && points.length > 0,
    };
  })();

  // Process time spent data
  const timeSpentProcessed = (() => {
    const resp = timeSpentData as MetricResponse | undefined;
    if (!resp) {
      return {
        totalTimeSpent: 0,
        timeSpentTrend: [] as TrendData[],
        hasDataAvailable: false,
      };
    }

    const points = resp.dataPoints;
    const current = computeCurrent(resp.method, points);

    return {
      totalTimeSpent: Number.isFinite(current) ? Math.round(current) : 0,
      timeSpentTrend: resp.trendData ?? [],
      hasDataAvailable: !!resp.hasData && points.length > 0,
    };
  })();

  // Process total attempts data
  const totalAttemptsProcessed = (() => {
    const resp = totalAttemptsData as MetricResponse | undefined;
    if (!resp) {
      return {
        totalAttempts: 0,
        attemptsTrend: [] as TrendData[],
        hasDataAvailable: false,
      };
    }

    const points = resp.dataPoints;
    const current = computeCurrent(resp.method, points);

    return {
      totalAttempts: Number.isFinite(current) ? Math.round(current) : 0,
      attemptsTrend: resp.trendData ?? [],
      hasDataAvailable: !!resp.hasData && points.length > 0,
    };
  })();

  // Trend analysis using utility function
  const averageScoreTrendAnalysis = computeTrendAnalysis(
    averageScoreProcessed.scoreTrend,
    "Average score"
  );
  const completionTrendAnalysis = computeTrendAnalysis(
    completionProcessed.completionTrend,
    "Completion percentage"
  );
  const passRateTrendAnalysis = computeTrendAnalysis(
    passRateProcessed.passRateTrend,
    "First attempt pass rate"
  );
  const highestScoreTrendAnalysis = computeTrendAnalysis(
    highestScoreProcessed.scoreTrend,
    "Highest score"
  );
  const messagesTrendAnalysis = computeTrendAnalysis(
    messagesProcessed.messagesTrend,
    "Messages per session"
  );
  const responseTimeTrendAnalysis = computeTrendAnalysis(
    responseTimeProcessed.responseTimeTrend,
    "Response time"
  );
  const sessionEfficiencyTrendAnalysis = computeTrendAnalysis(
    sessionEfficiencyProcessed.efficiencyTrend,
    "Session efficiency"
  );
  const stagnationRateTrendAnalysis = computeTrendAnalysis(
    stagnationRateProcessed.stagnationTrend,
    "Stagnation rate"
  );
  const timeSpentTrendAnalysis = computeTrendAnalysis(
    timeSpentProcessed.timeSpentTrend,
    "Time spent"
  );
  const totalAttemptsTrendAnalysis = computeTrendAnalysis(
    totalAttemptsProcessed.attemptsTrend,
    "Total attempts"
  );

  // Process growth data
  const growthProcessed = (() => {
    if (!growthData) {
      return {
        chartData: [],
        availableMetrics: [],
        windowAverages: { averageScore: { n: 7, last: null, prev: null } },
        hasDataAvailable: false,
        actionableInsight: null,
      };
    }

    const windowAverages = growthData.windowAverages || {
      averageScore: { n: 7, last: null, prev: null },
    };

    return {
      chartData: growthData.chartData || [],
      availableMetrics: growthData.availableMetrics || [],
      windowAverages,
      hasDataAvailable: growthData.chartData && growthData.chartData.length > 0,
      actionableInsight: computeGrowthActionableInsight(windowAverages),
    };
  })();

  // Process persona performance data
  const personaProcessed = (() => {
    if (!personaData) {
      return {
        chartData: [],
        availableSimulations: [],
        validSimulationIds: [],
        personaColors: {},
        hasDataAvailable: false,
        performanceStatus: "neutral" as const,
        actionableInsights: {},
      };
    }

    const chartData = personaData.chartData || [];
    const performanceStatus = computePersonaPerformanceStatus(
      chartData,
      thresholds
    );

    // Compute actionable insights for each persona
    const actionableInsights: Record<string, string | null> = {};
    chartData.forEach((persona) => {
      actionableInsights[persona.name] = computePersonaActionableInsight(
        persona.trendData
      );
    });

    // Filter simulations by validSimulationIds
    const validSimulationIds = personaData.validSimulationIds || [];
    const validSimulationIdsSet = new Set(validSimulationIds);
    const availableSimulations = allSimulations.filter((sim) =>
      validSimulationIdsSet.has(sim.id)
    );

    return {
      chartData,
      availableSimulations,
      personaColors: personaData.personaColors || {},
      hasDataAvailable: chartData.length > 0,
      performanceStatus,
      actionableInsights,
    };
  })();

  // Process rubric heatmap data
  const rubricHeatmapProcessed = (() => {
    if (!rubricHeatmapData) {
      return {
        matrices: [],
        availableRubrics: [],
        hasDataAvailable: false,
      };
    }

    // Filter rubrics by validRubricIds
    const validRubricIds = rubricHeatmapData.validRubricIds || [];
    const validRubricIdsSet = new Set(validRubricIds);
    const availableRubrics = allRubrics.filter((rubric) =>
      validRubricIdsSet.has(rubric.id)
    );

    const matrices = rubricHeatmapData.matrices || [];
    const actionableInsight = computeRubricHeatmapActionableInsight(matrices);

    return {
      matrices,
      availableRubrics,
      hasDataAvailable: matrices.length > 0,
      actionableInsight,
    };
  })();

  // Process attempt improvement data
  const attemptImprovementProcessed = (() => {
    if (!attemptImprovementData) {
      return {
        chartData: [],
        facts: [],
        validSimulationIds: [],
        hasDataAvailable: false,
        performanceStatus: "neutral" as const,
        actionableInsight: null,
      };
    }

    const chartData = attemptImprovementData.chartData || [];

    // Filter simulations by validSimulationIds
    const validSimulationIds = attemptImprovementData.validSimulationIds || [];
    const validSimulationIdsSet = new Set(validSimulationIds);
    const availableSimulations = allSimulations.filter((sim) =>
      validSimulationIdsSet.has(sim.id)
    );

    const actionableInsight =
      computeAttemptImprovementActionableInsight(chartData);

    return {
      chartData,
      facts: attemptImprovementData.facts || [],
      availableSimulations,
      hasDataAvailable: chartData.length > 0,
      actionableInsight,
    };
  })();

  // Process cohort performance data
  const cohortPerformanceProcessed = (() => {
    if (!cohortPerformanceData) {
      return {
        cohortData: [],
        dailyData: [],
        cohortFacts: [],
        dailyFacts: [],
        validSimulationIds: [],
        hasDataAvailable: false,
        performanceStatus: "neutral" as const,
        actionableInsight: null,
      };
    }

    const cohortData = cohortPerformanceData.cohortData || [];

    // Filter simulations by validSimulationIds
    const validSimulationIds = cohortPerformanceData.validSimulationIds || [];
    const validSimulationIdsSet = new Set(validSimulationIds);
    const availableSimulations = allSimulations.filter((sim) =>
      validSimulationIdsSet.has(sim.id)
    );

    const actionableInsight =
      computeCohortPerformanceActionableInsight(cohortData);

    return {
      cohortData,
      dailyData: cohortPerformanceData.dailyData || [],
      cohortFacts: cohortPerformanceData.cohortFacts || [],
      dailyFacts: cohortPerformanceData.dailyFacts || [],
      availableSimulations,
      hasDataAvailable: cohortData.length > 0,
      actionableInsight,
    };
  })();

  // Process skill performance data
  const skillPerformanceProcessed = (() => {
    if (!skillPerformanceData) {
      return {
        packages: [],
        validRubricIds: [],
        hasDataAvailable: false,
        performanceStatus: "neutral" as const,
        actionableInsight: null,
      };
    }

    const packages = skillPerformanceData.packages || [];

    // Filter rubrics by validRubricIds
    const validRubricIds = skillPerformanceData.validRubricIds || [];
    const validRubricIdsSet = new Set(validRubricIds);
    const availableRubrics = allRubrics.filter((rubric) =>
      validRubricIdsSet.has(rubric.id)
    );

    const activePackage = packages[0]; // Use first package for insight calculation
    const radarData = activePackage?.radarData || [];
    const actionableInsight =
      computeSkillPerformanceActionableInsight(radarData);

    return {
      packages,
      availableRubrics,
      hasDataAvailable: packages.length > 0,
      actionableInsight,
    };
  })();

  // Process footer analytics data
  const scenarioPerformanceProcessed = (() => {
    if (!scenarioPerformanceData) {
      return {
        attributeAttemptFacts: [],
        attributeScenarioFacts: [],
        availableParameters: [],
        availableParameterItems: [],
        hasDataAvailable: false,
        actionableInsight: null,
      };
    }

    const validParameterIds = scenarioPerformanceData.validParameterIds || [];
    const attributeAttemptFacts =
      scenarioPerformanceData.attributeAttemptFacts || [];
    const attributeScenarioFacts =
      scenarioPerformanceData.attributeScenarioFacts || [];

    // Filter parameters and parameter items by valid IDs
    const validParameterIdsSet = new Set(validParameterIds);
    const availableParameters = allParameters.filter((param) =>
      validParameterIdsSet.has(param.id)
    );

    // Filter parameter items that belong to valid parameters
    const availableParameterItems = allParameterItems.filter((item) =>
      validParameterIdsSet.has(item.parameterId)
    );

    const actionableInsight = computeScenarioPerformanceActionableInsight(
      attributeAttemptFacts
    );

    return {
      attributeAttemptFacts,
      attributeScenarioFacts,
      availableParameters,
      availableParameterItems,
      hasDataAvailable: attributeAttemptFacts.length > 0,
      actionableInsight,
    };
  })();

  const scenarioStatsProcessed = (() => {
    if (!scenarioStatsData) {
      return {
        numericAttemptFacts: [],
        numericScenarioFacts: [],
        availableParameters: [],
        hasDataAvailable: false,
        actionableInsight: null,
      };
    }

    const validNumericParameterIds =
      scenarioStatsData.validNumericParameterIds || [];
    const numericAttemptFacts = scenarioStatsData.numericAttemptFacts || [];
    const numericScenarioFacts = scenarioStatsData.numericScenarioFacts || [];

    // Filter parameters by valid numeric parameter IDs
    const validNumericParameterIdsSet = new Set(validNumericParameterIds);
    const availableParameters = allParameters.filter((param) =>
      validNumericParameterIdsSet.has(param.id)
    );

    const actionableInsight =
      computeScenarioStatsActionableInsight(numericAttemptFacts);

    return {
      numericAttemptFacts,
      numericScenarioFacts,
      availableParameters,
      hasDataAvailable: numericAttemptFacts.length > 0,
      actionableInsight,
    };
  })();

  const simulationPerformanceProcessed = (() => {
    if (!simulationPerformanceData) {
      return {
        validSimulationIds: [],
        scenarioFacts: [],
        hasDataAvailable: false,
        actionableInsight: null,
      };
    }

    const validSimulationIds =
      simulationPerformanceData.validSimulationIds || [];
    const scenarioFacts = simulationPerformanceData.scenarioFacts || [];

    const actionableInsight =
      computeSimulationPerformanceActionableInsight(scenarioFacts);

    return {
      validSimulationIds,
      scenarioFacts,
      hasDataAvailable: scenarioFacts.length > 0,
      actionableInsight,
    };
  })();

  const simulationCompositionProcessed = (() => {
    if (!simulationCompositionData) {
      return {
        simulationFacts: [],
        simulationParameterFactsCategorical: [],
        simulationParameterFactsNumeric: [],
        availableSimulations: [],
        availableParameters: [],
        availableParameterItems: [],
        hasDataAvailable: false,
        actionableInsight: null,
      };
    }

    const validSimulationIds =
      simulationCompositionData.validSimulationIds || [];
    const simulationFacts = simulationCompositionData.simulationFacts || [];
    const simulationParameterFactsCategorical =
      simulationCompositionData.simulationParameterFactsCategorical || [];
    const simulationParameterFactsNumeric =
      simulationCompositionData.simulationParameterFactsNumeric || [];

    // Filter simulations by valid IDs
    const validSimulationIdsSet = new Set(validSimulationIds);
    const availableSimulations = allSimulations.filter((sim) =>
      validSimulationIdsSet.has(sim.id)
    );

    // Get all parameter IDs that appear in the facts
    const parameterIds = new Set<string>();
    simulationParameterFactsCategorical.forEach((fact) =>
      parameterIds.add(fact.parameterId)
    );
    simulationParameterFactsNumeric.forEach((fact) =>
      parameterIds.add(fact.parameterId)
    );

    // Filter parameters and parameter items by the IDs that appear in facts
    const availableParameters = allParameters.filter((param) =>
      parameterIds.has(param.id)
    );
    const availableParameterItems = allParameterItems.filter((item) =>
      parameterIds.has(item.parameterId)
    );

    const actionableInsight =
      computeSimulationCompositionActionableInsight(simulationFacts);

    return {
      simulationFacts,
      simulationParameterFactsCategorical,
      simulationParameterFactsNumeric,
      availableSimulations,
      availableParameters,
      availableParameterItems,
      hasDataAvailable: simulationFacts.length > 0,
      actionableInsight,
    };
  })();

  const headerComponents = [
    <AverageScore
      key="average-score"
      averageScore={averageScoreProcessed.averageScore}
      scoreTrend={averageScoreProcessed.scoreTrend}
      hasDataAvailable={averageScoreProcessed.hasDataAvailable}
      isLoading={averageScoreLoading}
      isError={averageScoreError}
      trendAnalysis={averageScoreTrendAnalysis}
      thresholds={thresholds}
    />,
    <CompletionPercentage
      key="completion-percentage"
      completionPercentage={completionProcessed.completionPercentage}
      completionTrend={completionProcessed.completionTrend}
      hasDataAvailable={completionProcessed.hasDataAvailable}
      isLoading={completionLoading}
      isError={completionError}
      trendAnalysis={completionTrendAnalysis}
      thresholds={thresholds}
    />,
    <FirstAttemptPassRate
      key="first-attempt-pass-rate"
      firstAttemptPassRate={passRateProcessed.firstAttemptPassRate}
      passRateTrend={passRateProcessed.passRateTrend}
      hasDataAvailable={passRateProcessed.hasDataAvailable}
      isLoading={passRateLoading}
      isError={passRateError}
      trendAnalysis={passRateTrendAnalysis}
      thresholds={thresholds}
    />,
    <HighestScore
      key="highest-score"
      highestScore={highestScoreProcessed.highestScore}
      scoreTrend={highestScoreProcessed.scoreTrend}
      hasDataAvailable={highestScoreProcessed.hasDataAvailable}
      isLoading={highestScoreLoading}
      isError={highestScoreError}
      trendAnalysis={highestScoreTrendAnalysis}
      thresholds={thresholds}
    />,
    <MessagesPerSession
      key="messages-per-session"
      averageMessagesPerSession={messagesProcessed.averageMessagesPerSession}
      messagesTrend={messagesProcessed.messagesTrend}
      hasDataAvailable={messagesProcessed.hasDataAvailable}
      isLoading={messagesLoading}
      isError={messagesError}
      trendAnalysis={messagesTrendAnalysis}
      thresholds={thresholds}
    />,
    <PersonaResponseTimes
      key="persona-response-times"
      averageResponseTime={responseTimeProcessed.averageResponseTime}
      responseTimeTrend={responseTimeProcessed.responseTimeTrend}
      hasDataAvailable={responseTimeProcessed.hasDataAvailable}
      isLoading={responseTimeLoading}
      isError={responseTimeError}
      trendAnalysis={responseTimeTrendAnalysis}
      thresholds={thresholds}
    />,
    <SessionEfficiency
      key="session-efficiency"
      sessionEfficiency={sessionEfficiencyProcessed.sessionEfficiency}
      efficiencyTrend={sessionEfficiencyProcessed.efficiencyTrend}
      hasDataAvailable={sessionEfficiencyProcessed.hasDataAvailable}
      isLoading={sessionEfficiencyLoading}
      isError={sessionEfficiencyError}
      trendAnalysis={sessionEfficiencyTrendAnalysis}
      thresholds={thresholds}
    />,
    <StagnationRate
      key="stagnation-rate"
      stagnationRate={stagnationRateProcessed.stagnationRate}
      stagnationTrend={stagnationRateProcessed.stagnationTrend}
      hasDataAvailable={stagnationRateProcessed.hasDataAvailable}
      isLoading={stagnationRateLoading}
      isError={stagnationRateError}
      trendAnalysis={stagnationRateTrendAnalysis}
      thresholds={thresholds}
    />,
    <TimeSpent
      key="time-spent"
      totalTimeSpent={timeSpentProcessed.totalTimeSpent}
      timeSpentTrend={timeSpentProcessed.timeSpentTrend}
      hasDataAvailable={timeSpentProcessed.hasDataAvailable}
      isLoading={timeSpentLoading}
      isError={timeSpentError}
      trendAnalysis={timeSpentTrendAnalysis}
      thresholds={thresholds}
    />,
    <TotalAttempts
      key="total-attempts"
      totalAttempts={totalAttemptsProcessed.totalAttempts}
      attemptsTrend={totalAttemptsProcessed.attemptsTrend}
      hasDataAvailable={totalAttemptsProcessed.hasDataAvailable}
      isLoading={totalAttemptsLoading}
      isError={totalAttemptsError}
      trendAnalysis={totalAttemptsTrendAnalysis}
      thresholds={thresholds}
    />,
  ];

  const primaryComponents = [
    <Growth
      key="growth"
      chartData={growthProcessed.chartData}
      availableMetrics={growthProcessed.availableMetrics}
      windowAverages={growthProcessed.windowAverages}
      hasDataAvailable={growthProcessed.hasDataAvailable}
      isLoading={growthLoading}
      isError={growthError}
      actionableInsight={growthProcessed.actionableInsight}
      thresholds={thresholds}
    />,
    <PersonaPerformance
      key="persona-performance"
      chartData={personaProcessed.chartData}
      availableSimulations={personaProcessed.availableSimulations}
      personaColors={personaProcessed.personaColors}
      hasDataAvailable={personaProcessed.hasDataAvailable}
      isLoading={personaLoading}
      isError={personaError}
      performanceStatus={personaProcessed.performanceStatus}
      actionableInsights={personaProcessed.actionableInsights}
      thresholds={thresholds}
    />,
    <RubricHeatmap
      key="rubric-heatmap"
      matrices={rubricHeatmapProcessed.matrices}
      availableRubrics={rubricHeatmapProcessed.availableRubrics}
      hasDataAvailable={rubricHeatmapProcessed.hasDataAvailable}
      isLoading={rubricHeatmapLoading}
      isError={rubricHeatmapError}
      actionableInsight={rubricHeatmapProcessed.actionableInsight}
      thresholds={thresholds}
    />,
  ];

  const secondaryComponents = [
    <CohortPerformance
      key="cohort-performance"
      cohortData={cohortPerformanceProcessed.cohortData}
      dailyData={cohortPerformanceProcessed.dailyData}
      cohortFacts={cohortPerformanceProcessed.cohortFacts}
      dailyFacts={cohortPerformanceProcessed.dailyFacts}
      allSimulations={(
        cohortPerformanceProcessed.availableSimulations || []
      ).map((sim) => ({
        ...sim,
        timeLimit: sim.timeLimit ?? undefined,
      }))}
      isLoading={cohortPerformanceLoading}
      isError={cohortPerformanceError}
      profileId={profileId}
      actionableInsight={cohortPerformanceProcessed.actionableInsight}
      thresholds={thresholds}
    />,
    <AttemptImprovement
      key="attempt-improvement"
      chartData={attemptImprovementProcessed.chartData}
      facts={attemptImprovementProcessed.facts}
      allSimulations={(
        attemptImprovementProcessed.availableSimulations || []
      ).map((sim) => ({
        ...sim,
        timeLimit: sim.timeLimit ?? undefined,
      }))}
      isLoading={attemptImprovementLoading}
      isError={attemptImprovementError}
      actionableInsight={attemptImprovementProcessed.actionableInsight}
      thresholds={thresholds}
    />,
    <SkillPerformance
      key="skill-performance"
      packages={skillPerformanceProcessed.packages}
      allRubrics={skillPerformanceProcessed.availableRubrics || []}
      isLoading={skillPerformanceLoading}
      isError={skillPerformanceError}
      actionableInsight={skillPerformanceProcessed.actionableInsight}
      thresholds={thresholds}
    />,
  ];

  const leftFooterComponents = [
    <ScenarioPerformance
      key="scenario-performance"
      attributeAttemptFacts={scenarioPerformanceProcessed.attributeAttemptFacts}
      attributeScenarioFacts={
        scenarioPerformanceProcessed.attributeScenarioFacts
      }
      allParameters={scenarioPerformanceProcessed.availableParameters}
      allParameterItems={scenarioPerformanceProcessed.availableParameterItems}
      isLoading={scenarioPerformanceLoading}
      isError={scenarioPerformanceError}
      actionableInsight={scenarioPerformanceProcessed.actionableInsight}
      thresholds={thresholds}
    />,
    <ScenarioStats
      key="scenario-stats"
      numericAttemptFacts={scenarioStatsProcessed.numericAttemptFacts}
      numericScenarioFacts={scenarioStatsProcessed.numericScenarioFacts}
      allParameters={scenarioStatsProcessed.availableParameters}
      isLoading={scenarioStatsLoading}
      isError={scenarioStatsError}
      actionableInsight={scenarioStatsProcessed.actionableInsight}
      thresholds={thresholds}
    />,
  ];

  const rightFooterComponents = [
    <SimulationPerformance
      key="simulation-performance"
      validSimulationIds={simulationPerformanceProcessed.validSimulationIds}
      scenarioFacts={simulationPerformanceProcessed.scenarioFacts}
      allSimulations={allSimulations}
      isLoading={simulationPerformanceLoading}
      isError={simulationPerformanceError}
      actionableInsight={simulationPerformanceProcessed.actionableInsight}
      thresholds={thresholds}
    />,
    <SimulationComposition
      key="simulation-composition"
      simulationFacts={simulationCompositionProcessed.simulationFacts}
      simulationParameterFactsCategorical={
        simulationCompositionProcessed.simulationParameterFactsCategorical
      }
      simulationParameterFactsNumeric={
        simulationCompositionProcessed.simulationParameterFactsNumeric
      }
      allSimulations={simulationCompositionProcessed.availableSimulations}
      allParameters={simulationCompositionProcessed.availableParameters}
      allParameterItems={simulationCompositionProcessed.availableParameterItems}
      isLoading={simulationCompositionLoading}
      isError={simulationCompositionError}
      actionableInsight={simulationCompositionProcessed.actionableInsight}
      thresholds={thresholds}
    />,
  ];

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

  // Determine if user can archive (instructional, admin, superadmin)
  const canArchive =
    effectiveProfile?.role === "instructional" ||
    effectiveProfile?.role === "admin" ||
    effectiveProfile?.role === "superadmin";

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
                onMouseEnter={() => {
                  setIsPrimaryHovered(true);
                }}
                onMouseLeave={() => {
                  setIsPrimaryHovered(false);
                }}
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
          historyData
            ? historyData.map((item) => ({
                attemptId: item.attemptId,
                date: new Date(item.date),
                profileId: item.profileId,
                profileName: item.profileName,
                simulationName: item.simulationName,
                numScenarios: item.numScenarios,
                numScenariosCompleted: item.numScenariosCompleted,
                infiniteMode: item.infiniteMode,
                personaNames: item.personaNames,
                personaColors: item.personaColors,
                scenario_titles: item.scenario_titles,
                score: item.score,
                simulation_id: item.simulation_id,
                scenario_ids: item.scenario_ids,
                isArchived: item.isArchived,
                showView: item.showView,
                showContinue: item.showContinue,
                practiceSimulation: item.practiceSimulation,
                passPct: item.passPct || 70, // Use rubric pass percentage or default to 70
              }))
            : []
        }
        showExport={false}
        showArchive={canArchive}
        singleProfile={false}
        isLoading={isHistoryLoading}
      />
    </div>
  );
}
