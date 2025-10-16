/**
 * Query keys for v2 API endpoints (server-side analytics)
 * These keys are used by React Query for caching and invalidation
 */

import { AnalyticsFilters } from "@/lib/api/v2/schemas/analytics";

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

// Dashboard Bundle Keys
export const analyticsDashboardBundleKeys = {
  all: ["analytics:v2:dashboard"] as const,
  lists: () => [...analyticsDashboardBundleKeys.all, "list"] as const,
  list: (filters: AnalyticsFilters) =>
    [...analyticsDashboardBundleKeys.lists(), filters] as const,
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

// Profile Keys (unified auth + staff)
export const profileListKeys = {
  all: ["profile:v2:list"] as const,
  list: (filters: { departmentIds: string[]; profileId: string }) =>
    [...profileListKeys.all, { filters }] as const,
};

export const profileDetailKeys = {
  all: ["profile:v2:detail"] as const,
  detail: (profileId: string, currentProfileId: string) =>
    [...profileDetailKeys.all, { profileId, currentProfileId }] as const,
};

export const profileDetailBulkKeys = {
  all: ["profile:v2:detail-bulk"] as const,
  detail: (profileIds: string[], currentProfileId: string) =>
    [...profileDetailBulkKeys.all, { profileIds, currentProfileId }] as const,
};

export const profileContextKeys = {
  all: ["profile:v2:context"] as const,
  detail: (userId: string, effectiveProfileId: string, pathname: string) =>
    [
      ...profileContextKeys.all,
      { userId, effectiveProfileId, pathname },
    ] as const,
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

// Departments Keys
export const departmentsListKeys = {
  all: ["departments:v2:list"] as const,
  list: (filters: { departmentIds: string[]; profileId: string }) =>
    [...departmentsListKeys.all, { filters }] as const,
};

export const departmentsDetailKeys = {
  all: ["departments:v2:detail"] as const,
  detail: (departmentId: string, profileId: string) =>
    [...departmentsDetailKeys.all, { departmentId, profileId }] as const,
};

export const departmentsDetailDefaultKeys = {
  all: ["departments:v2:detail-default"] as const,
  detail: (profileId: string) =>
    [...departmentsDetailDefaultKeys.all, { profileId }] as const,
};

// Agents Keys
export const agentsListKeys = {
  all: ["agents:v2:list"] as const,
  list: (profileId: string) => [...agentsListKeys.all, { profileId }] as const,
};

export const agentsDetailKeys = {
  all: ["agents:v2:detail"] as const,
  detail: (agentId: string, profileId: string) =>
    [...agentsDetailKeys.all, { agentId, profileId }] as const,
};

// Feedback Keys (read-only)
export const feedbackListKeys = {
  all: ["feedback:v2:list"] as const,
  list: (profileId: string) =>
    [...feedbackListKeys.all, { profileId }] as const,
};

// Logs Keys (read-only)
export const logsListKeys = {
  all: ["logs:v2:list"] as const,
  list: (profileId: string) => [...logsListKeys.all, { profileId }] as const,
};

// Attempts Keys (full data with chats, messages, hints, grades)
export const attemptsFullKeys = {
  all: ["v2", "attempts"] as const,
  lists: () => [...attemptsFullKeys.all, "list"] as const,
  details: () => [...attemptsFullKeys.all, "detail"] as const,
  detail: (attemptId: string) =>
    [...attemptsFullKeys.details(), attemptId, "full"] as const,
};

// Assistant Chats Keys (full data with messages and tool calls)
export const assistantChatsFullKeys = {
  all: ["v2", "assistant", "chats"] as const,
  lists: () => [...assistantChatsFullKeys.all, "list"] as const,
  details: () => [...assistantChatsFullKeys.all, "detail"] as const,
  detail: (chatId: string | undefined, profileId: string) =>
    [
      ...assistantChatsFullKeys.details(),
      chatId || "new",
      "full",
      profileId,
    ] as const,
};

// Profile Simple Keys (lightweight profile data)
export const profileSimpleKeys = {
  all: ["v2", "profile", "simple"] as const,
  detail: (profileId: string) => [...profileSimpleKeys.all, profileId] as const,
};

// Layout Context Keys (profile + departments + simulations + cohorts)
export const layoutContextKeys = {
  all: ["v2", "layout", "context"] as const,
  detail: (userId: string, effectiveProfileId: string, pathname: string) =>
    [...layoutContextKeys.all, userId, effectiveProfileId, pathname] as const,
};
