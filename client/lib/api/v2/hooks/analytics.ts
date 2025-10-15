/**
 * Analytics hooks for v2 API
 * These hooks call client-side BFF routes at /api/v2/analytics/*
 * which then proxy to the FastAPI server
 */

import { api } from "@/lib/api/fetcher";
import {
  analyticsAttemptHistoryKeys,
  analyticsAttemptImprovementKeys,
  analyticsAverageScoreKeys,
  analyticsCohortPerformanceKeys,
  analyticsCompletionPercentageKeys,
  analyticsDashboardBundleKeys,
  analyticsFirstAttemptPassRateKeys,
  analyticsGrowthDataKeys,
  analyticsHighestScoreKeys,
  analyticsHomeOverviewKeys,
  analyticsImprovementPerDayKeys,
  analyticsLeaderboardBundleKeys,
  analyticsMessagesPerSessionKeys,
  analyticsPerfectScoresKeys,
  analyticsPersonaPerformanceKeys,
  analyticsPersonaResponseTimesKeys,
  analyticsPracticeOverviewKeys,
  analyticsPricingKeys,
  analyticsQuickestPassKeys,
  analyticsRefreshKeys,
  analyticsReportsBundleKeys,
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
} from "@/lib/api/v2/keys";
import {
  AnalyticsFilters,
  AttemptHistoryResponseSchema,
  AttemptImprovementResponseSchema,
  CohortPerformanceResponseSchema,
  DashboardBundleResponseSchema,
  GrowthDataResponseSchema,
  HomeOverviewResponseSchema,
  LeaderboardBundleResponseSchema,
  MetricResponseSchema,
  PersonaPerformanceResponseSchema,
  PracticeOverviewResponseSchema,
  PricingAnalyticsResponseSchema,
  RefreshResponseSchema,
  ReportsBundleResponseSchema,
  RubricHeatmapResponseSchema,
  ScenarioPerformanceResponseSchema,
  ScenarioStatsResponseSchema,
  SimulationCompositionResponseSchema,
  SimulationPerformanceResponseSchema,
  SkillPerformanceResponseSchema,
} from "@/lib/api/v2/schemas/analytics";
import { log } from "@/utils/logger";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

// Type for analytics hook options
type AnalyticsHookOptions = {
  enabled?: boolean;
  staleTime?: number;
};

// ============================================================================
// HEADER ANALYTICS HOOKS (10 metrics)
// ============================================================================

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
      const res = await api<unknown>("/api/v2/analytics/header/average-score", {
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
        "/api/v2/analytics/header/completion-percentage",
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
        "/api/v2/analytics/header/first-attempt-pass-rate",
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
      const res = await api<unknown>("/api/v2/analytics/header/highest-score", {
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
        "/api/v2/analytics/header/messages-per-session",
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
        "/api/v2/analytics/header/persona-response-times",
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
        "/api/v2/analytics/header/session-efficiency",
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
        "/api/v2/analytics/header/stagnation-rate",
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
      const res = await api<unknown>("/api/v2/analytics/header/time-spent", {
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
        "/api/v2/analytics/header/total-attempts",
        {
          method: "POST",
          body: JSON.stringify(filters),
        }
      );
      return MetricResponseSchema.parse(res);
    },
  });
}

// ============================================================================
// PRIMARY ANALYTICS HOOKS (3 metrics)
// ============================================================================

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
        "/api/v2/analytics/primary/rubric-heatmap",
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
      const res = await api<unknown>("/api/v2/analytics/primary/growth-data", {
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
        "/api/v2/analytics/primary/persona-performance",
        {
          method: "POST",
          body: JSON.stringify(filters),
        }
      );
      return PersonaPerformanceResponseSchema.parse(res);
    },
  });
}

// ============================================================================
// SECONDARY ANALYTICS HOOKS (3 metrics)
// ============================================================================

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
        "/api/v2/analytics/secondary/attempt-improvement",
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
        "/api/v2/analytics/secondary/cohort-performance",
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
        "/api/v2/analytics/secondary/skill-performance",
        {
          method: "POST",
          body: JSON.stringify(filters),
        }
      );
      return SkillPerformanceResponseSchema.parse(res);
    },
  });
}

// ============================================================================
// FOOTER ANALYTICS HOOKS (4 metrics)
// ============================================================================

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
        "/api/v2/analytics/footer/scenario-performance",
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
        "/api/v2/analytics/footer/scenario-stats",
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
        "/api/v2/analytics/footer/simulation-composition",
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
        "/api/v2/analytics/footer/simulation-performance",
        {
          method: "POST",
          body: JSON.stringify(filters),
        }
      );
      return SimulationPerformanceResponseSchema.parse(res);
    },
  });
}

// ============================================================================
// PAGE-SPECIFIC ANALYTICS HOOKS (3 metrics)
// ============================================================================

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
      const res = await api<unknown>("/api/v2/analytics/home", {
        method: "POST",
        body: JSON.stringify(filters),
      });
      return HomeOverviewResponseSchema.parse(res);
    },
  });
}

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
      const res = await api<unknown>("/api/v2/analytics/history", {
        method: "POST",
        body: JSON.stringify(filters),
      });
      return AttemptHistoryResponseSchema.parse(res);
    },
  });
}

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
      const res = await api<unknown>("/api/v2/analytics/practice", {
        method: "POST",
        body: JSON.stringify(filters),
      });
      return PracticeOverviewResponseSchema.parse(res);
    },
  });
}

// ============================================================================
// BUNDLE ANALYTICS HOOKS (2 metrics)
// ============================================================================

export function useAnalyticsReportsBundle(
  filters: AnalyticsFilters,
  options: AnalyticsHookOptions | boolean = true
) {
  const queryOptions =
    typeof options === "boolean"
      ? { enabled: options }
      : { enabled: true, ...options };

  return useQuery({
    queryKey: analyticsReportsBundleKeys.list(filters),
    ...queryOptions,
    queryFn: async () => {
      const res = await api<unknown>("/api/v2/analytics/reports", {
        method: "POST",
        body: JSON.stringify(filters),
      });
      return ReportsBundleResponseSchema.parse(res);
    },
  });
}

export function useAnalyticsLeaderboardBundle(
  filters: AnalyticsFilters,
  options: AnalyticsHookOptions | boolean = true
) {
  const queryOptions =
    typeof options === "boolean" ? { enabled: options } : options;

  return useQuery({
    queryKey: analyticsLeaderboardBundleKeys.list(filters),
    ...queryOptions,
    queryFn: async () => {
      const res = await api<unknown>("/api/v2/analytics/leaderboard", {
        method: "POST",
        body: JSON.stringify(filters),
      });
      return LeaderboardBundleResponseSchema.parse(res);
    },
  });
}

// ============================================================================
// LEADERBOARD-SPECIFIC HOOKS (3 metrics)
// ============================================================================

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
        "/api/v2/analytics/leaderboard/improvement-per-day",
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
        "/api/v2/analytics/leaderboard/perfect-scores",
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
        "/api/v2/analytics/leaderboard/quickest-pass",
        {
          method: "POST",
          body: JSON.stringify(filters),
        }
      );
      return MetricResponseSchema.parse(res);
    },
  });
}

// ============================================================================
// UTILITY HOOKS
// ============================================================================

export function useRefreshAnalytics() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: analyticsRefreshKeys.all,
    mutationFn: async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      try {
        const res = await api<unknown>("/api/v2/analytics/refresh", {
          method: "POST",
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        return RefreshResponseSchema.parse(res);
      } catch (error) {
        clearTimeout(timeoutId);
        throw error;
      }
    },
    onSuccess: () => {
      // Invalidate all v2 analytics queries to refresh the data
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === "string" && key.startsWith("analytics:v2:");
        },
      });
    },
    onError: (error) => {
      log.error("analytics.v2.refresh.hook.failed", {
        message: "Failed to refresh analytics in v2 hook",
        error,
        context: { function: "useRefreshAnalytics" },
      });
    },
    retry: false,
    networkMode: "online",
    gcTime: 0,
    meta: {
      errorMessage: "Failed to refresh analytics data",
    },
  });
}

// ============================================================================
// DASHBOARD BUNDLE HOOK
// ============================================================================

export function useDashboardBundle(
  filters: AnalyticsFilters,
  options: AnalyticsHookOptions | boolean = true
) {
  const queryOptions =
    typeof options === "boolean"
      ? { enabled: options }
      : { enabled: true, ...options };

  return useQuery({
    queryKey: analyticsDashboardBundleKeys.list(filters),
    ...queryOptions,
    queryFn: async () => {
      const res = await api<unknown>("/api/v2/analytics/dashboard", {
        method: "POST",
        body: JSON.stringify(filters),
      });
      return DashboardBundleResponseSchema.parse(res);
    },
  });
}

// ============================================================================
// PRICING ANALYTICS HOOK
// ============================================================================

export function usePricingAnalytics(
  filters: AnalyticsFilters,
  options: AnalyticsHookOptions | boolean = true
) {
  const queryOptions =
    typeof options === "boolean"
      ? { enabled: options }
      : { enabled: true, ...options };

  return useQuery({
    queryKey: analyticsPricingKeys.list(filters),
    ...queryOptions,
    queryFn: async () => {
      const res = await api<unknown>("/api/v2/analytics/pricing", {
        method: "POST",
        body: JSON.stringify(filters),
      });
      return PricingAnalyticsResponseSchema.parse(res);
    },
  });
}
