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

export type HeaderMetrics = {
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

export function useHeaderMetrics(filters: AnalyticsFilters) {
  // Use the individual hooks directly instead of trying to access queryFn
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

  const data: HeaderMetrics = {
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

  return { data, isLoading, isError };
}
