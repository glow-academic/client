import {
  AnalyticsFilters,
  AttemptHistoryResponseSchema,
  AttemptImprovementResponseSchema,
  CohortPerformanceResponseSchema,
  GrowthDataResponseSchema,
  HomeOverviewResponseSchema,
  MetricResponseSchema,
  PersonaPerformanceResponseSchema,
  PracticeOverviewResponseSchema,
  RubricHeatmapResponseSchema,
  ScenarioPerformanceResponseSchema,
  ScenarioStatsResponseSchema,
  SimulationCompositionResponseSchema,
  SimulationPerformanceResponseSchema,
  SkillPerformanceResponseSchema,
} from "@/lib/analytics";
import { api } from "@/lib/api/fetcher";
import {
  analyticsAttemptHistoryKeys,
  analyticsAttemptImprovementKeys,
  analyticsAverageScoreKeys,
  analyticsCohortPerformanceKeys,
  analyticsCompletionPercentageKeys,
  analyticsFirstAttemptPassRateKeys,
  analyticsGrowthDataKeys,
  analyticsHighestScoreKeys,
  analyticsHomeOverviewKeys,
  analyticsImprovementPerDayKeys,
  analyticsMessagesPerSessionKeys,
  analyticsPerfectScoresKeys,
  analyticsPersonaPerformanceKeys,
  analyticsPersonaResponseTimesKeys,
  analyticsPracticeOverviewKeys,
  analyticsQuickestPassKeys,
  analyticsRubricHeatmapKeys,
  analyticsScenarioPerformanceKeys,
  analyticsScenarioStatsKeys,
  analyticsSessionEfficiencyKeys,
  analyticsSimulationCompositionKeys,
  analyticsSimulationPerformanceKeys,
  analyticsSkillPerformanceKeys,
  analyticsStagnationRateKeys,
  analyticsTimeSpentKeys,
  analyticsTotalAttemptsKeys,
} from "@/lib/api/keys";
import { useQuery } from "@tanstack/react-query";

// Type for analytics hook options
type AnalyticsHookOptions = {
  enabled?: boolean;
  staleTime?: number;
};

// Header Analytics Hooks (10 metrics)

export function useAnalyticsAverageScore(
  filters: AnalyticsFilters,
  options: AnalyticsHookOptions | boolean = true
) {
  const queryOptions =
    typeof options === "boolean"
      ? { enabled: options }
      : { enabled: true, ...options };

  return useQuery({
    queryKey: analyticsAverageScoreKeys.list(filters),
    ...queryOptions,
    queryFn: async () => {
      const res = await api<unknown>("/api/v1/analytics/header/average-score", {
        method: "POST",
        body: JSON.stringify(filters),
      });
      return MetricResponseSchema.parse(res);
    },
  });
}

export function useAnalyticsCompletionPercentage(
  filters: AnalyticsFilters,
  options: AnalyticsHookOptions | boolean = true
) {
  const queryOptions =
    typeof options === "boolean"
      ? { enabled: options }
      : { enabled: true, ...options };

  return useQuery({
    queryKey: analyticsCompletionPercentageKeys.list(filters),
    ...queryOptions,
    queryFn: async () => {
      const res = await api<unknown>(
        "/api/v1/analytics/header/completion-percentage",
        {
          method: "POST",
          body: JSON.stringify(filters),
        }
      );
      return MetricResponseSchema.parse(res);
    },
  });
}

export function useAnalyticsFirstAttemptPassRate(
  filters: AnalyticsFilters,
  options: AnalyticsHookOptions | boolean = true
) {
  const queryOptions =
    typeof options === "boolean"
      ? { enabled: options }
      : { enabled: true, ...options };

  return useQuery({
    queryKey: analyticsFirstAttemptPassRateKeys.list(filters),
    ...queryOptions,
    queryFn: async () => {
      const res = await api<unknown>(
        "/api/v1/analytics/header/first-attempt-pass-rate",
        {
          method: "POST",
          body: JSON.stringify(filters),
        }
      );
      return MetricResponseSchema.parse(res);
    },
  });
}

export function useAnalyticsHighestScore(
  filters: AnalyticsFilters,
  options: AnalyticsHookOptions | boolean = true
) {
  const queryOptions =
    typeof options === "boolean"
      ? { enabled: options }
      : { enabled: true, ...options };

  return useQuery({
    queryKey: analyticsHighestScoreKeys.list(filters),
    ...queryOptions,
    queryFn: async () => {
      const res = await api<unknown>("/api/v1/analytics/header/highest-score", {
        method: "POST",
        body: JSON.stringify(filters),
      });
      return MetricResponseSchema.parse(res);
    },
  });
}

export function useAnalyticsMessagesPerSession(
  filters: AnalyticsFilters,
  options: AnalyticsHookOptions | boolean = true
) {
  const queryOptions =
    typeof options === "boolean"
      ? { enabled: options }
      : { enabled: true, ...options };

  return useQuery({
    queryKey: analyticsMessagesPerSessionKeys.list(filters),
    ...queryOptions,
    queryFn: async () => {
      const res = await api<unknown>(
        "/api/v1/analytics/header/messages-per-session",
        {
          method: "POST",
          body: JSON.stringify(filters),
        }
      );
      return MetricResponseSchema.parse(res);
    },
  });
}

export function useAnalyticsPersonaResponseTimes(
  filters: AnalyticsFilters,
  options: AnalyticsHookOptions | boolean = true
) {
  const queryOptions =
    typeof options === "boolean"
      ? { enabled: options }
      : { enabled: true, ...options };

  return useQuery({
    queryKey: analyticsPersonaResponseTimesKeys.list(filters),
    ...queryOptions,
    queryFn: async () => {
      const res = await api<unknown>(
        "/api/v1/analytics/header/persona-response-times",
        {
          method: "POST",
          body: JSON.stringify(filters),
        }
      );
      return MetricResponseSchema.parse(res);
    },
  });
}

export function useAnalyticsSessionEfficiency(
  filters: AnalyticsFilters,
  options: AnalyticsHookOptions | boolean = true
) {
  const queryOptions =
    typeof options === "boolean"
      ? { enabled: options }
      : { enabled: true, ...options };

  return useQuery({
    queryKey: analyticsSessionEfficiencyKeys.list(filters),
    ...queryOptions,
    queryFn: async () => {
      const res = await api<unknown>(
        "/api/v1/analytics/header/session-efficiency",
        {
          method: "POST",
          body: JSON.stringify(filters),
        }
      );
      return MetricResponseSchema.parse(res);
    },
  });
}

export function useAnalyticsStagnationRate(
  filters: AnalyticsFilters,
  options: AnalyticsHookOptions | boolean = true
) {
  const queryOptions =
    typeof options === "boolean"
      ? { enabled: options }
      : { enabled: true, ...options };

  return useQuery({
    queryKey: analyticsStagnationRateKeys.list(filters),
    ...queryOptions,
    queryFn: async () => {
      const res = await api<unknown>(
        "/api/v1/analytics/header/stagnation-rate",
        {
          method: "POST",
          body: JSON.stringify(filters),
        }
      );
      return MetricResponseSchema.parse(res);
    },
  });
}

export function useAnalyticsTimeSpent(
  filters: AnalyticsFilters,
  options: AnalyticsHookOptions | boolean = true
) {
  const queryOptions =
    typeof options === "boolean"
      ? { enabled: options }
      : { enabled: true, ...options };

  return useQuery({
    queryKey: analyticsTimeSpentKeys.list(filters),
    ...queryOptions,
    queryFn: async () => {
      const res = await api<unknown>("/api/v1/analytics/header/time-spent", {
        method: "POST",
        body: JSON.stringify(filters),
      });
      return MetricResponseSchema.parse(res);
    },
  });
}

export function useAnalyticsTotalAttempts(
  filters: AnalyticsFilters,
  options: AnalyticsHookOptions | boolean = true
) {
  const queryOptions =
    typeof options === "boolean"
      ? { enabled: options }
      : { enabled: true, ...options };

  return useQuery({
    queryKey: analyticsTotalAttemptsKeys.list(filters),
    ...queryOptions,
    queryFn: async () => {
      const res = await api<unknown>(
        "/api/v1/analytics/header/total-attempts",
        {
          method: "POST",
          body: JSON.stringify(filters),
        }
      );
      return MetricResponseSchema.parse(res);
    },
  });
}

// Leaderboard Analytics Hooks (3 metrics)

export function useAnalyticsImprovementPerDay(
  filters: AnalyticsFilters,
  options: AnalyticsHookOptions | boolean = true
) {
  const queryOptions =
    typeof options === "boolean"
      ? { enabled: options }
      : { enabled: true, ...options };

  return useQuery({
    queryKey: analyticsImprovementPerDayKeys.list(filters),
    ...queryOptions,
    queryFn: async () => {
      const res = await api<unknown>(
        "/api/v1/analytics/leaderboard/improvement-per-day",
        {
          method: "POST",
          body: JSON.stringify(filters),
        }
      );
      return MetricResponseSchema.parse(res);
    },
  });
}

export function useAnalyticsPerfectScores(
  filters: AnalyticsFilters,
  options: AnalyticsHookOptions | boolean = true
) {
  const queryOptions =
    typeof options === "boolean"
      ? { enabled: options }
      : { enabled: true, ...options };

  return useQuery({
    queryKey: analyticsPerfectScoresKeys.list(filters),
    ...queryOptions,
    queryFn: async () => {
      const res = await api<unknown>(
        "/api/v1/analytics/leaderboard/perfect-scores",
        {
          method: "POST",
          body: JSON.stringify(filters),
        }
      );
      return MetricResponseSchema.parse(res);
    },
  });
}

export function useAnalyticsQuickestPass(
  filters: AnalyticsFilters,
  options: AnalyticsHookOptions | boolean = true
) {
  const queryOptions =
    typeof options === "boolean"
      ? { enabled: options }
      : { enabled: true, ...options };

  return useQuery({
    queryKey: analyticsQuickestPassKeys.list(filters),
    ...queryOptions,
    queryFn: async () => {
      const res = await api<unknown>(
        "/api/v1/analytics/leaderboard/quickest-pass",
        {
          method: "POST",
          body: JSON.stringify(filters),
        }
      );
      return MetricResponseSchema.parse(res);
    },
  });
}

// Primary Analytics Hooks (3 complex metrics)

export function useAnalyticsRubricHeatmap(
  filters: AnalyticsFilters,
  options: AnalyticsHookOptions | boolean = true
) {
  const queryOptions =
    typeof options === "boolean"
      ? { enabled: options }
      : { enabled: true, ...options };

  return useQuery({
    queryKey: analyticsRubricHeatmapKeys.list(filters),
    ...queryOptions,
    queryFn: async () => {
      const res = await api<unknown>(
        "/api/v1/analytics/primary/rubric-heatmap",
        {
          method: "POST",
          body: JSON.stringify(filters),
        }
      );
      return RubricHeatmapResponseSchema.parse(res);
    },
  });
}

export function useAnalyticsGrowthData(
  filters: AnalyticsFilters,
  options: AnalyticsHookOptions | boolean = true
) {
  const queryOptions =
    typeof options === "boolean"
      ? { enabled: options }
      : { enabled: true, ...options };

  return useQuery({
    queryKey: analyticsGrowthDataKeys.list(filters),
    ...queryOptions,
    queryFn: async () => {
      const res = await api<unknown>("/api/v1/analytics/primary/growth-data", {
        method: "POST",
        body: JSON.stringify(filters),
      });
      return GrowthDataResponseSchema.parse(res);
    },
  });
}

export function useAnalyticsPersonaPerformance(
  filters: AnalyticsFilters,
  options: AnalyticsHookOptions | boolean = true
) {
  const queryOptions =
    typeof options === "boolean"
      ? { enabled: options }
      : { enabled: true, ...options };

  return useQuery({
    queryKey: analyticsPersonaPerformanceKeys.list(filters),
    ...queryOptions,
    queryFn: async () => {
      const res = await api<unknown>(
        "/api/v1/analytics/primary/persona-performance",
        {
          method: "POST",
          body: JSON.stringify(filters),
        }
      );
      return PersonaPerformanceResponseSchema.parse(res);
    },
  });
}

// Secondary Analytics Hooks (3 complex metrics)

export function useAnalyticsAttemptImprovement(
  filters: AnalyticsFilters,
  options: AnalyticsHookOptions | boolean = true
) {
  const queryOptions =
    typeof options === "boolean"
      ? { enabled: options }
      : { enabled: true, ...options };

  return useQuery({
    queryKey: analyticsAttemptImprovementKeys.list(filters),
    ...queryOptions,
    queryFn: async () => {
      const res = await api<unknown>(
        "/api/v1/analytics/secondary/attempt-improvement",
        {
          method: "POST",
          body: JSON.stringify(filters),
        }
      );
      return AttemptImprovementResponseSchema.parse(res);
    },
  });
}

export function useAnalyticsCohortPerformance(
  filters: AnalyticsFilters,
  options: AnalyticsHookOptions | boolean = true
) {
  const queryOptions =
    typeof options === "boolean"
      ? { enabled: options }
      : { enabled: true, ...options };

  return useQuery({
    queryKey: analyticsCohortPerformanceKeys.list(filters),
    ...queryOptions,
    queryFn: async () => {
      const res = await api<unknown>(
        "/api/v1/analytics/secondary/cohort-performance",
        {
          method: "POST",
          body: JSON.stringify(filters),
        }
      );
      return CohortPerformanceResponseSchema.parse(res);
    },
  });
}

export function useAnalyticsSkillPerformance(
  filters: AnalyticsFilters,
  options: AnalyticsHookOptions | boolean = true
) {
  const queryOptions =
    typeof options === "boolean"
      ? { enabled: options }
      : { enabled: true, ...options };

  return useQuery({
    queryKey: analyticsSkillPerformanceKeys.list(filters),
    ...queryOptions,
    queryFn: async () => {
      const res = await api<unknown>(
        "/api/v1/analytics/secondary/skill-performance",
        {
          method: "POST",
          body: JSON.stringify(filters),
        }
      );
      return SkillPerformanceResponseSchema.parse(res);
    },
  });
}

// Footer Analytics Hooks (4 new metrics)

export function useAnalyticsScenarioPerformance(
  filters: AnalyticsFilters,
  options: AnalyticsHookOptions | boolean = true
) {
  const queryOptions =
    typeof options === "boolean"
      ? { enabled: options }
      : { enabled: true, ...options };

  return useQuery({
    queryKey: analyticsScenarioPerformanceKeys.list(filters),
    ...queryOptions,
    queryFn: async () => {
      const res = await api<unknown>(
        "/api/v1/analytics/footer/scenario-performance",
        {
          method: "POST",
          body: JSON.stringify(filters),
        }
      );
      return ScenarioPerformanceResponseSchema.parse(res);
    },
  });
}

export function useAnalyticsScenarioStats(
  filters: AnalyticsFilters,
  options: AnalyticsHookOptions | boolean = true
) {
  const queryOptions =
    typeof options === "boolean"
      ? { enabled: options }
      : { enabled: true, ...options };

  return useQuery({
    queryKey: analyticsScenarioStatsKeys.list(filters),
    ...queryOptions,
    queryFn: async () => {
      const res = await api<unknown>(
        "/api/v1/analytics/footer/scenario-stats",
        {
          method: "POST",
          body: JSON.stringify(filters),
        }
      );
      return ScenarioStatsResponseSchema.parse(res);
    },
  });
}

export function useAnalyticsSimulationComposition(
  filters: AnalyticsFilters,
  options: AnalyticsHookOptions | boolean = true
) {
  const queryOptions =
    typeof options === "boolean"
      ? { enabled: options }
      : { enabled: true, ...options };

  return useQuery({
    queryKey: analyticsSimulationCompositionKeys.list(filters),
    ...queryOptions,
    queryFn: async () => {
      const res = await api<unknown>(
        "/api/v1/analytics/footer/simulation-composition",
        {
          method: "POST",
          body: JSON.stringify(filters),
        }
      );
      return SimulationCompositionResponseSchema.parse(res);
    },
  });
}

export function useAnalyticsSimulationPerformance(
  filters: AnalyticsFilters,
  options: AnalyticsHookOptions | boolean = true
) {
  const queryOptions =
    typeof options === "boolean"
      ? { enabled: options }
      : { enabled: true, ...options };

  return useQuery({
    queryKey: analyticsSimulationPerformanceKeys.list(filters),
    ...queryOptions,
    queryFn: async () => {
      const res = await api<unknown>(
        "/api/v1/analytics/footer/simulation-performance",
        {
          method: "POST",
          body: JSON.stringify(filters),
        }
      );
      return SimulationPerformanceResponseSchema.parse(res);
    },
  });
}

// Home Analytics Hooks

export function useAnalyticsHomeOverview(
  filters: AnalyticsFilters,
  options: AnalyticsHookOptions | boolean = true
) {
  const queryOptions =
    typeof options === "boolean"
      ? { enabled: options }
      : { enabled: true, ...options };

  return useQuery({
    queryKey: analyticsHomeOverviewKeys.list(filters),
    ...queryOptions,
    queryFn: async () => {
      const res = await api<unknown>("/api/v1/analytics/home", {
        method: "POST",
        body: JSON.stringify(filters),
      });
      return HomeOverviewResponseSchema.parse(res);
    },
  });
}

// Practice Analytics Hooks

export function useAnalyticsPracticeOverview(
  filters: AnalyticsFilters,
  options: AnalyticsHookOptions | boolean = true
) {
  const queryOptions =
    typeof options === "boolean"
      ? { enabled: options }
      : { enabled: true, ...options };

  return useQuery({
    queryKey: analyticsPracticeOverviewKeys.list(filters),
    ...queryOptions,
    queryFn: async () => {
      const res = await api<unknown>("/api/v1/analytics/practice", {
        method: "POST",
        body: JSON.stringify(filters),
      });
      return PracticeOverviewResponseSchema.parse(res);
    },
  });
}

// History Analytics Hooks

export function useAnalyticsAttemptHistory(
  filters: AnalyticsFilters,
  options: AnalyticsHookOptions | boolean = true
) {
  const queryOptions =
    typeof options === "boolean"
      ? { enabled: options }
      : { enabled: true, ...options };

  return useQuery({
    queryKey: analyticsAttemptHistoryKeys.list(filters),
    ...queryOptions,
    queryFn: async () => {
      const res = await api<unknown>("/api/v1/analytics/history", {
        method: "POST",
        body: JSON.stringify(filters),
      });
      return AttemptHistoryResponseSchema.parse(res);
    },
  });
}
