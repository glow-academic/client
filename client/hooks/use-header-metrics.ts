"use client";
import type { AnalyticsFilters, MetricResponse } from "@/lib/analytics";
import {
  useAnalyticsAverageScore,
  useAnalyticsCompletionPercentage,
  useAnalyticsFirstAttemptPassRate,
  useAnalyticsHighestScore,
  useAnalyticsMessagesPerSession,
  useAnalyticsPersonaResponseTimes,
  useAnalyticsSessionEfficiency,
  useAnalyticsStagnationRate,
  useAnalyticsTimeSpent,
  useAnalyticsTotalAttempts,
} from "@/lib/api/hooks/analytics";
import type { RowFilter } from "@/utils/analytics/metric-recompute-utils";
import {
  recomputeAttemptsSummary,
  recomputeAverageScoreSummary,
  recomputeCompletionSummary,
  recomputeEfficiencySummary,
  recomputeFirstPassSummary,
  recomputeMessagesSummary,
  recomputePersonaRTSummary,
  recomputeStagnationSummary,
  recomputeTimeSummary,
  recomputeTopScores,
} from "@/utils/analytics/metric-recompute-utils";
import { useMemo } from "react";

export type HeaderMetricsWithRowFilter = {
  averageScore: MetricResponse | undefined;
  completionPercentage: MetricResponse | undefined;
  firstAttemptPassRate: MetricResponse | undefined;
  highestScore: MetricResponse | undefined;
  messagesPerSession: MetricResponse | undefined;
  personaResponseTimes: MetricResponse | undefined;
  sessionEfficiency: MetricResponse | undefined;
  stagnationRate: MetricResponse | undefined;
  timeSpent: MetricResponse | undefined;
  totalAttempts: MetricResponse | undefined;
};

export type RecomputedSummaries = {
  averageScore: ReturnType<typeof recomputeAverageScoreSummary> | undefined;
  completionPercentage:
    | ReturnType<typeof recomputeCompletionSummary>
    | undefined;
  firstAttemptPassRate:
    | ReturnType<typeof recomputeFirstPassSummary>
    | undefined;
  highestScoreTop: ReturnType<typeof recomputeTopScores> | undefined;
  messagesPerSession: ReturnType<typeof recomputeMessagesSummary> | undefined;
  personaResponseTimes:
    | ReturnType<typeof recomputePersonaRTSummary>
    | undefined;
  sessionEfficiency: ReturnType<typeof recomputeEfficiencySummary> | undefined;
  stagnationRate: ReturnType<typeof recomputeStagnationSummary> | undefined;
  timeSpent: ReturnType<typeof recomputeTimeSummary> | undefined;
  totalAttempts: ReturnType<typeof recomputeAttemptsSummary> | undefined;
};

export function useHeaderMetrics(
  filters: AnalyticsFilters,
  rowFilter?: RowFilter
) {
  const averageScore = useAnalyticsAverageScore(filters);
  const completionPercentage = useAnalyticsCompletionPercentage(filters);
  const firstAttemptPassRate = useAnalyticsFirstAttemptPassRate(filters);
  const highestScore = useAnalyticsHighestScore(filters);
  const messagesPerSession = useAnalyticsMessagesPerSession(filters);
  const personaResponseTimes = useAnalyticsPersonaResponseTimes(filters);
  const sessionEfficiency = useAnalyticsSessionEfficiency(filters);
  const stagnationRate = useAnalyticsStagnationRate(filters);
  const timeSpent = useAnalyticsTimeSpent(filters);
  const totalAttempts = useAnalyticsTotalAttempts(filters);

  const isLoading = [
    averageScore,
    completionPercentage,
    firstAttemptPassRate,
    highestScore,
    messagesPerSession,
    personaResponseTimes,
    sessionEfficiency,
    stagnationRate,
    timeSpent,
    totalAttempts,
  ].some((q) => q.isLoading);

  const isError = [
    averageScore,
    completionPercentage,
    firstAttemptPassRate,
    highestScore,
    messagesPerSession,
    personaResponseTimes,
    sessionEfficiency,
    stagnationRate,
    timeSpent,
    totalAttempts,
  ].some((q) => q.isError);

  // Recomputed summaries constrained by current row filter
  const summaries: RecomputedSummaries = useMemo(
    () => ({
      averageScore: averageScore.data
        ? recomputeAverageScoreSummary(averageScore.data, rowFilter)
        : undefined,
      completionPercentage: completionPercentage.data
        ? recomputeCompletionSummary(completionPercentage.data, rowFilter)
        : undefined,
      firstAttemptPassRate: firstAttemptPassRate.data
        ? recomputeFirstPassSummary(firstAttemptPassRate.data, rowFilter)
        : undefined,
      highestScoreTop: highestScore.data
        ? recomputeTopScores(highestScore.data, rowFilter, 3)
        : undefined,
      messagesPerSession: messagesPerSession.data
        ? recomputeMessagesSummary(messagesPerSession.data, rowFilter)
        : undefined,
      personaResponseTimes: personaResponseTimes.data
        ? recomputePersonaRTSummary(personaResponseTimes.data, rowFilter)
        : undefined,
      sessionEfficiency: sessionEfficiency.data
        ? recomputeEfficiencySummary(sessionEfficiency.data, rowFilter)
        : undefined,
      stagnationRate: stagnationRate.data
        ? recomputeStagnationSummary(stagnationRate.data, rowFilter)
        : undefined,
      timeSpent: timeSpent.data
        ? recomputeTimeSummary(timeSpent.data, rowFilter)
        : undefined,
      totalAttempts: totalAttempts.data
        ? recomputeAttemptsSummary(totalAttempts.data, rowFilter)
        : undefined,
    }),
    [
      rowFilter,
      averageScore.data,
      completionPercentage.data,
      firstAttemptPassRate.data,
      highestScore.data,
      messagesPerSession.data,
      personaResponseTimes.data,
      sessionEfficiency.data,
      stagnationRate.data,
      timeSpent.data,
      totalAttempts.data,
    ]
  );

  const raw: HeaderMetricsWithRowFilter = {
    averageScore: averageScore.data,
    completionPercentage: completionPercentage.data,
    firstAttemptPassRate: firstAttemptPassRate.data,
    highestScore: highestScore.data,
    messagesPerSession: messagesPerSession.data,
    personaResponseTimes: personaResponseTimes.data,
    sessionEfficiency: sessionEfficiency.data,
    stagnationRate: stagnationRate.data,
    timeSpent: timeSpent.data,
    totalAttempts: totalAttempts.data,
  };

  return {
    isLoading,
    isError,
    raw,
    summaries, // <- use these for your header/hover cards tied to the current row selection
  };
}
