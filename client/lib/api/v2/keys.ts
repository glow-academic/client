/**
 * Query keys for v2 API endpoints (server-side analytics)
 * These keys are used by React Query for caching and invalidation
 */

import { AnalyticsFilters } from "@/lib/analytics";

// Analytics Query Keys - v2 (server-side)

// Header Analytics Keys (10 metrics)
export const analyticsAverageScoreKeys = {
  all: ["analytics:v2:average-score"] as const,
  list: (filters: AnalyticsFilters) =>
    [...analyticsAverageScoreKeys.all, { filters }] as const,
};

export const analyticsCompletionPercentageKeys = {
  all: ["analytics:v2:completion-percentage"] as const,
  list: (filters: AnalyticsFilters) =>
    [...analyticsCompletionPercentageKeys.all, { filters }] as const,
};

export const analyticsFirstAttemptPassRateKeys = {
  all: ["analytics:v2:first-attempt-pass-rate"] as const,
  list: (filters: AnalyticsFilters) =>
    [...analyticsFirstAttemptPassRateKeys.all, { filters }] as const,
};

export const analyticsHighestScoreKeys = {
  all: ["analytics:v2:highest-score"] as const,
  list: (filters: AnalyticsFilters) =>
    [...analyticsHighestScoreKeys.all, { filters }] as const,
};

export const analyticsMessagesPerSessionKeys = {
  all: ["analytics:v2:messages-per-session"] as const,
  list: (filters: AnalyticsFilters) =>
    [...analyticsMessagesPerSessionKeys.all, { filters }] as const,
};

export const analyticsPersonaResponseTimesKeys = {
  all: ["analytics:v2:persona-response-times"] as const,
  list: (filters: AnalyticsFilters) =>
    [...analyticsPersonaResponseTimesKeys.all, { filters }] as const,
};

export const analyticsSessionEfficiencyKeys = {
  all: ["analytics:v2:session-efficiency"] as const,
  list: (filters: AnalyticsFilters) =>
    [...analyticsSessionEfficiencyKeys.all, { filters }] as const,
};

export const analyticsStagnationRateKeys = {
  all: ["analytics:v2:stagnation-rate"] as const,
  list: (filters: AnalyticsFilters) =>
    [...analyticsStagnationRateKeys.all, { filters }] as const,
};

export const analyticsTimeSpentKeys = {
  all: ["analytics:v2:time-spent"] as const,
  list: (filters: AnalyticsFilters) =>
    [...analyticsTimeSpentKeys.all, { filters }] as const,
};

export const analyticsTotalAttemptsKeys = {
  all: ["analytics:v2:total-attempts"] as const,
  list: (filters: AnalyticsFilters) =>
    [...analyticsTotalAttemptsKeys.all, { filters }] as const,
};

// Primary Analytics Keys (3 metrics)
export const analyticsRubricHeatmapKeys = {
  all: ["analytics:v2:rubric-heatmap"] as const,
  list: (filters: AnalyticsFilters) =>
    [...analyticsRubricHeatmapKeys.all, { filters }] as const,
};

export const analyticsGrowthDataKeys = {
  all: ["analytics:v2:growth-data"] as const,
  list: (filters: AnalyticsFilters) =>
    [...analyticsGrowthDataKeys.all, { filters }] as const,
};

export const analyticsPersonaPerformanceKeys = {
  all: ["analytics:v2:persona-performance"] as const,
  list: (filters: AnalyticsFilters) =>
    [...analyticsPersonaPerformanceKeys.all, { filters }] as const,
};

// Secondary Analytics Keys (3 metrics)
export const analyticsAttemptImprovementKeys = {
  all: ["analytics:v2:attempt-improvement"] as const,
  list: (filters: AnalyticsFilters) =>
    [...analyticsAttemptImprovementKeys.all, { filters }] as const,
};

export const analyticsCohortPerformanceKeys = {
  all: ["analytics:v2:cohort-performance"] as const,
  list: (filters: AnalyticsFilters) =>
    [...analyticsCohortPerformanceKeys.all, { filters }] as const,
};

export const analyticsSkillPerformanceKeys = {
  all: ["analytics:v2:skill-performance"] as const,
  list: (filters: AnalyticsFilters) =>
    [...analyticsSkillPerformanceKeys.all, { filters }] as const,
};

// Footer Analytics Keys (4 metrics)
export const analyticsScenarioPerformanceKeys = {
  all: ["analytics:v2:scenario-performance"] as const,
  list: (filters: AnalyticsFilters) =>
    [...analyticsScenarioPerformanceKeys.all, { filters }] as const,
};

export const analyticsScenarioStatsKeys = {
  all: ["analytics:v2:scenario-stats"] as const,
  list: (filters: AnalyticsFilters) =>
    [...analyticsScenarioStatsKeys.all, { filters }] as const,
};

export const analyticsSimulationCompositionKeys = {
  all: ["analytics:v2:simulation-composition"] as const,
  list: (filters: AnalyticsFilters) =>
    [...analyticsSimulationCompositionKeys.all, { filters }] as const,
};

export const analyticsSimulationPerformanceKeys = {
  all: ["analytics:v2:simulation-performance"] as const,
  list: (filters: AnalyticsFilters) =>
    [...analyticsSimulationPerformanceKeys.all, { filters }] as const,
};

// Page-Specific Analytics Keys (3 metrics)
export const analyticsHomeOverviewKeys = {
  all: ["analytics:v2:home-overview"] as const,
  list: (filters: AnalyticsFilters) =>
    [...analyticsHomeOverviewKeys.all, { filters }] as const,
};

export const analyticsAttemptHistoryKeys = {
  all: ["analytics:v2:attempt-history"] as const,
  list: (filters: AnalyticsFilters) =>
    [...analyticsAttemptHistoryKeys.all, { filters }] as const,
};

export const analyticsPracticeOverviewKeys = {
  all: ["analytics:v2:practice-overview"] as const,
  list: (filters: AnalyticsFilters) =>
    [...analyticsPracticeOverviewKeys.all, { filters }] as const,
};

// Bundle Analytics Keys (2 metrics)
export const analyticsReportsBundleKeys = {
  all: ["analytics:v2:reports-bundle"] as const,
  list: (filters: AnalyticsFilters) =>
    [...analyticsReportsBundleKeys.all, { filters }] as const,
};

export const analyticsLeaderboardBundleKeys = {
  all: ["analytics:v2:leaderboard-bundle"] as const,
  list: (filters: AnalyticsFilters) =>
    [...analyticsLeaderboardBundleKeys.all, { filters }] as const,
};

// Leaderboard-Specific Keys (3 metrics)
export const analyticsImprovementPerDayKeys = {
  all: ["analytics:v2:improvement-per-day"] as const,
  list: (filters: AnalyticsFilters) =>
    [...analyticsImprovementPerDayKeys.all, { filters }] as const,
};

export const analyticsPerfectScoresKeys = {
  all: ["analytics:v2:perfect-scores"] as const,
  list: (filters: AnalyticsFilters) =>
    [...analyticsPerfectScoresKeys.all, { filters }] as const,
};

export const analyticsQuickestPassKeys = {
  all: ["analytics:v2:quickest-pass"] as const,
  list: (filters: AnalyticsFilters) =>
    [...analyticsQuickestPassKeys.all, { filters }] as const,
};

// Utility Keys
export const analyticsRefreshKeys = {
  all: ["analytics:v2:refresh"] as const,
};

// Pricing Analytics Keys
export const analyticsPricingKeys = {
  all: ["analytics:v2:pricing"] as const,
  list: (filters: AnalyticsFilters) =>
    [...analyticsPricingKeys.all, { filters }] as const,
};

// Personas Keys
export const personasListKeys = {
  all: ["personas:v2:list"] as const,
  list: (filters: { departmentIds: string[]; profileId: string }) =>
    [...personasListKeys.all, { filters }] as const,
};

export const personasDetailKeys = {
  all: ["personas:v2:detail"] as const,
  detail: (personaId: string, profileId: string) =>
    [...personasDetailKeys.all, { personaId, profileId }] as const,
};

export const personasDetailDefaultKeys = {
  all: ["personas:v2:detail-default"] as const,
  detail: (profileId: string) =>
    [...personasDetailDefaultKeys.all, { profileId }] as const,
};

// Documents Keys
export const documentsListKeys = {
  all: ["documents:v2:list"] as const,
  list: (filters: { departmentIds: string[]; profileId: string }) =>
    [...documentsListKeys.all, { filters }] as const,
};

export const documentsDetailKeys = {
  all: ["documents:v2:detail"] as const,
  detail: (documentId: string, profileId: string) =>
    [...documentsDetailKeys.all, { documentId, profileId }] as const,
};

export const documentsDetailBulkKeys = {
  all: ["documents:v2:detail-bulk"] as const,
  detail: (documentIds: string[], profileId: string) =>
    [...documentsDetailBulkKeys.all, { documentIds, profileId }] as const,
};

// Scenarios Keys
export const scenariosListKeys = {
  all: ["scenarios:v2:list"] as const,
  list: (filters: { departmentIds: string[]; profileId: string }) =>
    [...scenariosListKeys.all, { filters }] as const,
};

export const scenariosDetailKeys = {
  all: ["scenarios:v2:detail"] as const,
  detail: (scenarioId: string, profileId: string) =>
    [...scenariosDetailKeys.all, { scenarioId, profileId }] as const,
};

export const scenariosDetailDefaultKeys = {
  all: ["scenarios:v2:detail-default"] as const,
  detail: (profileId: string) =>
    [...scenariosDetailDefaultKeys.all, { profileId }] as const,
};

// Simulations Keys
export const simulationsListKeys = {
  all: ["simulations:v2:list"] as const,
  list: (filters: { departmentIds: string[]; profileId: string }) =>
    [...simulationsListKeys.all, { filters }] as const,
};

export const simulationsDetailKeys = {
  all: ["simulations:v2:detail"] as const,
  detail: (simulationId: string, profileId: string) =>
    [...simulationsDetailKeys.all, { simulationId, profileId }] as const,
};

export const simulationsDetailDefaultKeys = {
  all: ["simulations:v2:detail-default"] as const,
  detail: (profileId: string) =>
    [...simulationsDetailDefaultKeys.all, { profileId }] as const,
};

// Rubrics Keys
export const rubricsListKeys = {
  all: ["rubrics:v2:list"] as const,
  list: (filters: { departmentIds: string[]; profileId: string }) =>
    [...rubricsListKeys.all, { filters }] as const,
};

export const rubricsDetailKeys = {
  all: ["rubrics:v2:detail"] as const,
  detail: (rubricId: string, profileId: string) =>
    [...rubricsDetailKeys.all, { rubricId, profileId }] as const,
};

export const rubricsDetailDefaultKeys = {
  all: ["rubrics:v2:detail-default"] as const,
  detail: (profileId: string) =>
    [...rubricsDetailDefaultKeys.all, { profileId }] as const,
};

// Staff Keys
export const staffListKeys = {
  all: ["staff:v2:list"] as const,
  list: (filters: { departmentIds: string[]; profileId: string }) =>
    [...staffListKeys.all, { filters }] as const,
};

export const staffDetailKeys = {
  all: ["staff:v2:detail"] as const,
  detail: (profileId: string, currentProfileId: string) =>
    [...staffDetailKeys.all, { profileId, currentProfileId }] as const,
};

export const staffDetailBulkKeys = {
  all: ["staff:v2:detail-bulk"] as const,
  detail: (profileIds: string[], currentProfileId: string) =>
    [...staffDetailBulkKeys.all, { profileIds, currentProfileId }] as const,
};

// Cohorts Keys
export const cohortsListKeys = {
  all: ["cohorts:v2:list"] as const,
  list: (filters: { departmentIds: string[]; profileId: string }) =>
    [...cohortsListKeys.all, { filters }] as const,
};

export const cohortsDetailKeys = {
  all: ["cohorts:v2:detail"] as const,
  detail: (cohortId: string, profileId: string) =>
    [...cohortsDetailKeys.all, { cohortId, profileId }] as const,
};

export const cohortsDetailDefaultKeys = {
  all: ["cohorts:v2:detail-default"] as const,
  detail: (profileId: string) =>
    [...cohortsDetailDefaultKeys.all, { profileId }] as const,
};

// Providers Keys
export const providersListKeys = {
  all: ["providers:v2:list"] as const,
  list: (filters: { departmentIds: string[]; profileId: string }) =>
    [...providersListKeys.all, { filters }] as const,
};

export const providersDetailKeys = {
  all: ["providers:v2:detail"] as const,
  detail: (providerId: string, profileId: string) =>
    [...providersDetailKeys.all, { providerId, profileId }] as const,
};

// Models Keys
export const modelsDetailKeys = {
  all: ["models:v2:detail"] as const,
  detail: (modelId: string, providerId: string, profileId: string) =>
    [...modelsDetailKeys.all, { modelId, providerId, profileId }] as const,
};

// Parameters Keys
export const parametersListKeys = {
  all: ["parameters:v2:list"] as const,
  list: (filters: { departmentIds: string[]; profileId: string }) =>
    [...parametersListKeys.all, { filters }] as const,
};

export const parametersDetailKeys = {
  all: ["parameters:v2:detail"] as const,
  detail: (parameterId: string, profileId: string) =>
    [...parametersDetailKeys.all, { parameterId, profileId }] as const,
};

export const parametersDetailDefaultKeys = {
  all: ["parameters:v2:detail-default"] as const,
  detail: (profileId: string) =>
    [...parametersDetailDefaultKeys.all, { profileId }] as const,
};
