import {
  AnalyticsFilters,
  AttemptImprovementFilters,
  AttemptImprovementResponseSchema,
  CohortPerformanceResponseSchema,
  GrowthDataResponseSchema,
  MetricResponseSchema,
  PersonaPerformanceFilters,
  PersonaPerformanceResponseSchema,
  RubricHeatmapFilters,
  RubricHeatmapResponseSchema,
  SkillPerformanceFilters,
  SkillPerformanceResponseSchema,
} from "@/lib/analytics";
import { api } from "@/lib/api/fetcher";
import {
  analyticsAttemptImprovementKeys,
  analyticsAverageScoreKeys,
  analyticsCohortPerformanceKeys,
  analyticsCompletionPercentageKeys,
  analyticsFirstAttemptPassRateKeys,
  analyticsGrowthDataKeys,
  analyticsHighestScoreKeys,
  analyticsImprovementPerDayKeys,
  analyticsMessagesPerSessionKeys,
  analyticsPerfectScoresKeys,
  analyticsPersonaPerformanceKeys,
  analyticsPersonaResponseTimesKeys,
  analyticsQuickestPassKeys,
  analyticsRubricHeatmapKeys,
  analyticsSessionEfficiencyKeys,
  analyticsSkillPerformanceKeys,
  analyticsStagnationRateKeys,
  analyticsTimeSpentKeys,
  analyticsTotalAttemptsKeys,
} from "@/lib/api/keys";
import { useQuery } from "@tanstack/react-query";

// Header Analytics Hooks (10 metrics)

export function useAnalyticsAverageScore(
  filters: AnalyticsFilters,
  enabled = true
) {
  return useQuery({
    queryKey: analyticsAverageScoreKeys.list(filters),
    enabled,
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
  enabled = true
) {
  return useQuery({
    queryKey: analyticsCompletionPercentageKeys.list(filters),
    enabled,
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
  enabled = true
) {
  return useQuery({
    queryKey: analyticsFirstAttemptPassRateKeys.list(filters),
    enabled,
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
  enabled = true
) {
  return useQuery({
    queryKey: analyticsHighestScoreKeys.list(filters),
    enabled,
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
  enabled = true
) {
  return useQuery({
    queryKey: analyticsMessagesPerSessionKeys.list(filters),
    enabled,
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
  enabled = true
) {
  return useQuery({
    queryKey: analyticsPersonaResponseTimesKeys.list(filters),
    enabled,
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
  enabled = true
) {
  return useQuery({
    queryKey: analyticsSessionEfficiencyKeys.list(filters),
    enabled,
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
  enabled = true
) {
  return useQuery({
    queryKey: analyticsStagnationRateKeys.list(filters),
    enabled,
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
  enabled = true
) {
  return useQuery({
    queryKey: analyticsTimeSpentKeys.list(filters),
    enabled,
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
  enabled = true
) {
  return useQuery({
    queryKey: analyticsTotalAttemptsKeys.list(filters),
    enabled,
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
  enabled = true
) {
  return useQuery({
    queryKey: analyticsImprovementPerDayKeys.list(filters),
    enabled,
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
  enabled = true
) {
  return useQuery({
    queryKey: analyticsPerfectScoresKeys.list(filters),
    enabled,
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
  enabled = true
) {
  return useQuery({
    queryKey: analyticsQuickestPassKeys.list(filters),
    enabled,
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
  filters: RubricHeatmapFilters,
  enabled = true
) {
  return useQuery({
    queryKey: analyticsRubricHeatmapKeys.list(filters),
    enabled,
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
  enabled = true
) {
  return useQuery({
    queryKey: analyticsGrowthDataKeys.list(filters),
    enabled,
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
  filters: PersonaPerformanceFilters,
  enabled = true
) {
  return useQuery({
    queryKey: analyticsPersonaPerformanceKeys.list(filters),
    enabled,
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
  filters: AttemptImprovementFilters,
  enabled = true
) {
  return useQuery({
    queryKey: analyticsAttemptImprovementKeys.list(filters),
    enabled,
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
  enabled = true
) {
  return useQuery({
    queryKey: analyticsCohortPerformanceKeys.list(filters),
    enabled,
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
  filters: SkillPerformanceFilters,
  enabled = true
) {
  return useQuery({
    queryKey: analyticsSkillPerformanceKeys.list(filters),
    enabled,
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
